import { BadRequestException, Injectable } from '@nestjs/common';
import type { CreateTestPlanRequest, TestPlan } from '@docflow/shared';
import { TestPlansRepository } from './test-plans.repository';

@Injectable()
export class TestPlansService {
  constructor(private readonly repository: TestPlansRepository) {}

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
}
