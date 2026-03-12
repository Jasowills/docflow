import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import type {
  CreateTestPlanRequest,
  CreateTestPlanRunRequest,
  TestPlan,
  TestPlanExecutionRun,
} from '@docflow/shared';
import { SUPABASE_CLIENT } from '../database/supabase.providers';

@Injectable()
export class TestPlansRepository {
  private readonly logger = new Logger(TestPlansRepository.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async create(
    workspaceId: string,
    createdBy: string,
    request: CreateTestPlanRequest,
  ): Promise<TestPlan> {
    const now = new Date().toISOString();
    const plan: TestPlan = {
      planId: uuidv4(),
      workspaceId,
      name: request.name.trim(),
      description: request.description?.trim() || undefined,
      repositoryFullName: request.repositoryFullName?.trim() || undefined,
      branch: request.branch?.trim() || undefined,
      targetEnvironment: request.targetEnvironment?.trim() || undefined,
      status: 'draft',
      createdAtUtc: now,
      createdBy,
      lastModifiedAtUtc: now,
      testCaseIds: request.testCaseIds || [],
    };

    const { error } = await this.supabase.from('test_plans').insert({
      plan_id: plan.planId,
      workspace_id: plan.workspaceId,
      name: plan.name,
      description: plan.description || null,
      repository_full_name: plan.repositoryFullName || null,
      branch: plan.branch || null,
      target_environment: plan.targetEnvironment || null,
      status: plan.status,
      created_at_utc: plan.createdAtUtc,
      created_by: plan.createdBy,
      last_modified_at_utc: plan.lastModifiedAtUtc,
      test_case_ids: plan.testCaseIds,
    });

    if (error) {
      this.logger.error(`Failed to create test plan ${plan.planId}: ${error.message}`);
      throw new Error('Failed to create test plan.');
    }

    return plan;
  }

  async listByWorkspace(workspaceId: string): Promise<TestPlan[]> {
    const { data, error } = await this.supabase
      .from('test_plans')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at_utc', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list test plans for ${workspaceId}: ${error.message}`);
      throw new Error('Failed to load test plans.');
    }

    return ((data as Array<Record<string, unknown>> | null) || []).map((row) => this.mapPlan(row));
  }

  async findById(workspaceId: string, planId: string): Promise<TestPlan | null> {
    const { data, error } = await this.supabase
      .from('test_plans')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('plan_id', planId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to load test plan ${planId}: ${error.message}`);
      throw new Error('Failed to load test plan.');
    }

    if (!data) {
      return null;
    }

    return this.mapPlan(data as Record<string, unknown>);
  }

  async updateAttachedSuites(
    workspaceId: string,
    planId: string,
    documentIds: string[],
  ): Promise<TestPlan | null> {
    const now = new Date().toISOString();
    const uniqueIds = Array.from(new Set(documentIds.map((value) => value.trim()).filter(Boolean)));
    const { error } = await this.supabase
      .from('test_plans')
      .update({
        test_case_ids: uniqueIds,
        last_modified_at_utc: now,
      })
      .eq('workspace_id', workspaceId)
      .eq('plan_id', planId);

    if (error) {
      this.logger.error(`Failed to update attached suites for ${planId}: ${error.message}`);
      throw new Error('Failed to update test plan.');
    }

    return this.findById(workspaceId, planId);
  }

  async createRun(
    workspaceId: string,
    planId: string,
    createdBy: string,
    request: CreateTestPlanRunRequest,
  ): Promise<TestPlanExecutionRun> {
    const now = new Date().toISOString();
    const run: TestPlanExecutionRun = {
      runId: uuidv4(),
      planId,
      workspaceId,
      status: 'queued',
      trigger: 'manual',
      source: 'docflow',
      branch: request.branch?.trim() || undefined,
      targetEnvironment: request.targetEnvironment?.trim() || undefined,
      notes: request.notes?.trim() || undefined,
      createdAtUtc: now,
      createdBy,
    };

    const { error } = await this.supabase.from('test_plan_runs').insert({
      run_id: run.runId,
      plan_id: run.planId,
      workspace_id: run.workspaceId,
      status: run.status,
      trigger: run.trigger,
      source: run.source,
      branch: run.branch || null,
      target_environment: run.targetEnvironment || null,
      notes: run.notes || null,
      created_at_utc: run.createdAtUtc,
      created_by: run.createdBy,
      started_at_utc: run.startedAtUtc || null,
      completed_at_utc: run.completedAtUtc || null,
      total_tests: run.totalTests ?? null,
      passed_tests: run.passedTests ?? null,
      failed_tests: run.failedTests ?? null,
      skipped_tests: run.skippedTests ?? null,
    });

    if (error) {
      if (isMissingRelationError(error)) {
        this.logger.warn(
          'Test plan run table is missing. Apply the latest Supabase schema to enable execution runs.',
        );
        throw new Error('Test plan runs are not available until the latest Supabase schema is applied.');
      }
      this.logger.error(`Failed to create run for ${planId}: ${error.message}`);
      throw new Error('Failed to create test plan run.');
    }

    return run;
  }

  async listRuns(workspaceId: string, planId: string): Promise<TestPlanExecutionRun[]> {
    const { data, error } = await this.supabase
      .from('test_plan_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('plan_id', planId)
      .order('created_at_utc', { ascending: false });

    if (error) {
      if (isMissingRelationError(error)) {
        this.logger.warn(
          'Test plan run table is missing. Returning an empty run list until the latest Supabase schema is applied.',
        );
        return [];
      }
      this.logger.error(`Failed to list runs for ${planId}: ${error.message}`);
      throw new Error('Failed to load test plan runs.');
    }

    return ((data as Array<Record<string, unknown>> | null) || []).map((row) => this.mapRun(row));
  }

  private mapPlan(row: Record<string, unknown>): TestPlan {
    return {
      planId: String(row.plan_id || ''),
      workspaceId: String(row.workspace_id || ''),
      name: String(row.name || ''),
      description: typeof row.description === 'string' ? row.description : undefined,
      repositoryFullName:
        typeof row.repository_full_name === 'string' ? row.repository_full_name : undefined,
      branch: typeof row.branch === 'string' ? row.branch : undefined,
      targetEnvironment:
        typeof row.target_environment === 'string' ? row.target_environment : undefined,
      status: (row.status as TestPlan['status']) || 'draft',
      createdAtUtc: String(row.created_at_utc || ''),
      createdBy: String(row.created_by || ''),
      lastModifiedAtUtc:
        typeof row.last_modified_at_utc === 'string' ? row.last_modified_at_utc : undefined,
      testCaseIds: Array.isArray(row.test_case_ids)
        ? row.test_case_ids.map((value) => String(value))
        : [],
    };
  }

  private mapRun(row: Record<string, unknown>): TestPlanExecutionRun {
    return {
      runId: String(row.run_id || ''),
      planId: String(row.plan_id || ''),
      workspaceId: String(row.workspace_id || ''),
      status: (row.status as TestPlanExecutionRun['status']) || 'queued',
      trigger: (row.trigger as TestPlanExecutionRun['trigger']) || 'manual',
      source: (row.source as TestPlanExecutionRun['source']) || 'docflow',
      branch: typeof row.branch === 'string' ? row.branch : undefined,
      targetEnvironment:
        typeof row.target_environment === 'string' ? row.target_environment : undefined,
      notes: typeof row.notes === 'string' ? row.notes : undefined,
      createdAtUtc: String(row.created_at_utc || ''),
      createdBy: String(row.created_by || ''),
      startedAtUtc: typeof row.started_at_utc === 'string' ? row.started_at_utc : undefined,
      completedAtUtc: typeof row.completed_at_utc === 'string' ? row.completed_at_utc : undefined,
      totalTests: typeof row.total_tests === 'number' ? row.total_tests : undefined,
      passedTests: typeof row.passed_tests === 'number' ? row.passed_tests : undefined,
      failedTests: typeof row.failed_tests === 'number' ? row.failed_tests : undefined,
      skippedTests: typeof row.skipped_tests === 'number' ? row.skipped_tests : undefined,
    };
  }
}

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false;
  }

  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    String(error.message || '').toLowerCase().includes("could not find the table 'public.test_plan_runs'")
  );
}
