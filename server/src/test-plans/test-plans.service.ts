import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AttachTestPlanSuitesRequest,
  CreateTestPlanRequest,
  CreateTestPlanRunRequest,
  TestPlan,
  TestPlanDetail,
  TestPlanExecutionRun,
} from '@docflow/shared';
import { DocumentsRepository } from '../documents/documents.repository';
import { WorkspacesRepository } from '../auth/workspaces.repository';
import { TestPlansRepository } from './test-plans.repository';

@Injectable()
export class TestPlansService {
  constructor(
    private readonly repository: TestPlansRepository,
    private readonly documentsRepository: DocumentsRepository,
    private readonly workspacesRepository: WorkspacesRepository,
  ) {}

  async create(
    workspaceId: string | undefined,
    createdBy: string,
    request: CreateTestPlanRequest,
  ): Promise<TestPlan> {
    if (!workspaceId) {
      throw new BadRequestException('A workspace is required to create a test plan.');
    }
    if (!request.name?.trim()) {
      throw new BadRequestException('Test plan name is required.');
    }
    return this.repository.create(workspaceId, createdBy, request);
  }

  async list(workspaceId: string | undefined): Promise<TestPlan[]> {
    if (!workspaceId) {
      return [];
    }
    return this.repository.listByWorkspace(workspaceId);
  }

  async getDetail(
    workspaceId: string | undefined,
    planId: string,
    userId: string,
  ): Promise<TestPlanDetail> {
    if (!workspaceId) {
      throw new NotFoundException('Test plan not found.');
    }

    const plan = await this.repository.findById(workspaceId, planId);
    if (!plan) {
      throw new NotFoundException('Test plan not found.');
    }

    const scopeUserIds = await this.resolveScopeUserIds(workspaceId, userId);
    const [suiteSummaries, runs] = await Promise.all([
      this.documentsRepository.findSummariesByIds(plan.testCaseIds, scopeUserIds),
      this.repository.listRuns(workspaceId, planId),
    ]);

    return {
      plan,
      attachedSuites: suiteSummaries
        .filter((suite) => suite.documentType === 'test_case_suite')
        .map((suite) => ({
          documentId: suite.documentId,
          documentTitle: suite.documentTitle,
          recordingId: suite.recordingId,
          recordingName: suite.recordingName,
          productArea: suite.productArea,
          createdAtUtc: suite.createdAtUtc,
          createdBy: suite.createdBy,
        })),
      runs,
    };
  }

  async attachSuites(
    workspaceId: string | undefined,
    planId: string,
    request: AttachTestPlanSuitesRequest,
    userId: string,
  ): Promise<TestPlanDetail> {
    if (!workspaceId) {
      throw new NotFoundException('Test plan not found.');
    }

    const documentIds = Array.isArray(request.documentIds)
      ? request.documentIds.map((value) => String(value))
      : [];

    const scopeUserIds = await this.resolveScopeUserIds(workspaceId, userId);
    const suites = await this.documentsRepository.findSummariesByIds(documentIds, scopeUserIds);
    if (suites.length !== documentIds.length) {
      throw new BadRequestException('One or more selected test suites could not be found.');
    }
    if (suites.some((suite) => suite.documentType !== 'test_case_suite')) {
      throw new BadRequestException('Only generated test case suites can be attached to a plan.');
    }

    const updatedPlan = await this.repository.updateAttachedSuites(workspaceId, planId, documentIds);
    if (!updatedPlan) {
      throw new NotFoundException('Test plan not found.');
    }

    const runs = await this.repository.listRuns(workspaceId, planId);
    return {
      plan: updatedPlan,
      attachedSuites: suites.map((suite) => ({
        documentId: suite.documentId,
        documentTitle: suite.documentTitle,
        recordingId: suite.recordingId,
        recordingName: suite.recordingName,
        productArea: suite.productArea,
        createdAtUtc: suite.createdAtUtc,
        createdBy: suite.createdBy,
      })),
      runs,
    };
  }

  async createRun(
    workspaceId: string | undefined,
    planId: string,
    createdBy: string,
    request: CreateTestPlanRunRequest,
  ): Promise<TestPlanExecutionRun> {
    if (!workspaceId) {
      throw new NotFoundException('Test plan not found.');
    }

    const plan = await this.repository.findById(workspaceId, planId);
    if (!plan) {
      throw new NotFoundException('Test plan not found.');
    }

    return this.repository.createRun(workspaceId, planId, createdBy, {
      branch: request.branch?.trim() || plan.branch,
      targetEnvironment: request.targetEnvironment?.trim() || plan.targetEnvironment,
      notes: request.notes?.trim() || undefined,
    });
  }

  private async resolveScopeUserIds(workspaceId: string, fallbackUserId: string): Promise<string[]> {
    const members = await this.workspacesRepository.listMembers(workspaceId);
    const userIds = members.map((member) => member.userId).filter(Boolean);
    return userIds.length > 0 ? userIds : [fallbackUserId];
  }
}
