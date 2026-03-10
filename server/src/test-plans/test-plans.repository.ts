import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import type { CreateTestPlanRequest, TestPlan } from '@docflow/shared';
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

    return ((data as Array<Record<string, unknown>> | null) || []).map((row) => ({
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
    }));
  }
}
