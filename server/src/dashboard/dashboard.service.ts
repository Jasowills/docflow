import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DashboardActivityItem,
  DashboardSeriesPoint,
  DashboardSummary,
  DocumentSummary,
  RecordingSummary,
  TestPlan,
} from '@docflow/shared';
import { SUPABASE_CLIENT } from '../database/supabase.providers';
import { WorkspacesRepository } from '../auth/workspaces.repository';
import { GithubRepository } from '../integrations/github.repository';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly githubRepository: GithubRepository,
  ) {}

  async getSummary(userId: string, workspaceId?: string): Promise<DashboardSummary> {
    if (!workspaceId) {
      throw new BadRequestException('A workspace is required.');
    }

    const workspace = await this.workspacesRepository.getWorkspaceDetails(workspaceId);
    if (!workspace) {
      throw new BadRequestException('Workspace not found.');
    }

    const memberIds = workspace.members.map((member) => member.userId);
    const [recordings, documents, testPlans, repoSelections, fallbackGithubStatus] = await Promise.all([
      this.loadRecentRecordings(memberIds),
      this.loadRecentDocuments(memberIds),
      this.loadRecentTestPlans(workspaceId),
      this.loadSelectedRepoCount(workspaceId),
      this.githubRepository.findConnectionByUserId(userId),
    ]);

    const recordingsTrend = buildDailyTrend(
      recordings.items.map((item) => item.uploadedAtUtc),
    );
    const documentsTrend = buildDailyTrend(
      documents.items.map((item) => item.createdAtUtc),
    );
    const testPlanStatus = buildStatusSeries(testPlans);

    const githubConnected =
      !!workspace.githubInstallationId || !!fallbackGithubStatus;

    return {
      metrics: {
        recordings: recordings.total,
        documents: documents.total,
        activeTestPlans: testPlans.filter((item) => item.status !== 'archived').length,
        connectedRepos: repoSelections,
        teamMembers: workspace.members.length,
      },
      recentRecordings: recordings.items,
      recentDocuments: documents.items,
      recentTestPlans: testPlans.slice(0, 5),
      recentActivity: buildRecentActivity(recordings.items, documents.items, testPlans),
      recordingsTrend,
      documentsTrend,
      testPlanStatus,
      setup: {
        onboardingCompleted: false,
        githubConnected,
        missingSteps: buildMissingSteps({
          githubConnected,
          hasRecordings: recordings.total > 0,
          hasDocuments: documents.total > 0,
          teamMembers: workspace.members.length,
          accountType: workspace.accountType,
        }),
      },
    };
  }

  private async loadRecentRecordings(userIds: string[]): Promise<{
    items: RecordingSummary[];
    total: number;
  }> {
    if (userIds.length === 0) {
      return { items: [], total: 0 };
    }

    const { data, count, error } = await this.supabase
      .from('recordings')
      .select('recording_id, metadata, uploaded_at_utc, event_count, transcript_count, screenshot_count', {
        count: 'exact',
      })
      .in('user_id', userIds)
      .order('uploaded_at_utc', { ascending: false })
      .limit(5);

    if (error) {
      throw new Error('Failed to load dashboard recordings.');
    }

    const items = ((data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      recordingId: String(row.recording_id || ''),
      metadata: row.metadata as RecordingSummary['metadata'],
      uploadedAtUtc: String(row.uploaded_at_utc || ''),
      eventCount: Number(row.event_count || 0),
      transcriptCount: Number(row.transcript_count || 0),
      screenshotCount: Number(row.screenshot_count || 0),
    }));

    return { items, total: count || 0 };
  }

  private async loadRecentDocuments(userIds: string[]): Promise<{
    items: DocumentSummary[];
    total: number;
  }> {
    if (userIds.length === 0) {
      return { items: [], total: 0 };
    }

    const { data, count, error } = await this.supabase
      .from('documents')
      .select('document_id, document_title, document_type, recording_id, recording_name, product_area, folder, created_at_utc, created_by', {
        count: 'exact',
      })
      .in('created_by', userIds)
      .order('created_at_utc', { ascending: false })
      .limit(5);

    if (error) {
      throw new Error('Failed to load dashboard documents.');
    }

    const items = ((data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      documentId: String(row.document_id || ''),
      documentTitle: String(row.document_title || ''),
      documentType: String(row.document_type || ''),
      recordingId: String(row.recording_id || ''),
      recordingName: String(row.recording_name || ''),
      productArea: String(row.product_area || ''),
      folder: typeof row.folder === 'string' ? row.folder : undefined,
      createdAtUtc: String(row.created_at_utc || ''),
      createdBy: String(row.created_by || ''),
    }));

    return { items, total: count || 0 };
  }

  private async loadRecentTestPlans(workspaceId: string): Promise<TestPlan[]> {
    const { data, error } = await this.supabase
      .from('test_plans')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at_utc', { ascending: false })
      .limit(5);

    if (error) {
      throw new Error('Failed to load dashboard test plans.');
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
      status: String(row.status || 'draft') as TestPlan['status'],
      createdAtUtc: String(row.created_at_utc || ''),
      createdBy: String(row.created_by || ''),
      lastModifiedAtUtc:
        typeof row.last_modified_at_utc === 'string' ? row.last_modified_at_utc : undefined,
      testCaseIds: Array.isArray(row.test_case_ids)
        ? (row.test_case_ids as string[])
        : [],
    }));
  }

  private async loadSelectedRepoCount(workspaceId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('workspace_repo_selections')
      .select('repository_id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (error) {
      throw new Error('Failed to load selected repositories.');
    }

    return count || 0;
  }
}

function buildDailyTrend(timestamps: string[]): DashboardSeriesPoint[] {
  const days = 7;
  const counts = new Map<string, number>();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    counts.set(key, 0);
  }

  for (const timestamp of timestamps) {
    const key = new Date(timestamp).toISOString().slice(0, 10);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([key, value]) => ({
    label: key.slice(5),
    value,
  }));
}

function buildStatusSeries(testPlans: TestPlan[]): DashboardSeriesPoint[] {
  const statuses: TestPlan['status'][] = ['draft', 'ready', 'archived'];
  return statuses.map((status) => ({
    label: status,
    value: testPlans.filter((item) => item.status === status).length,
  }));
}

function buildRecentActivity(
  recordings: RecordingSummary[],
  documents: DocumentSummary[],
  testPlans: TestPlan[],
): DashboardActivityItem[] {
  const items: DashboardActivityItem[] = [
    ...recordings.map((recording) => ({
      id: `recording:${recording.recordingId}`,
      type: 'recording' as const,
      title: recording.metadata.name,
      description: 'Recording uploaded',
      timestampUtc: recording.uploadedAtUtc,
    })),
    ...documents.map((document) => ({
      id: `document:${document.documentId}`,
      type: 'document' as const,
      title: document.documentTitle,
      description: `${document.documentType} generated`,
      timestampUtc: document.createdAtUtc,
    })),
    ...testPlans.map((plan) => ({
      id: `test-plan:${plan.planId}`,
      type: 'test-plan' as const,
      title: plan.name,
      description: `Test plan ${plan.status}`,
      timestampUtc: plan.createdAtUtc,
    })),
  ];

  return items
    .sort((a, b) => new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime())
    .slice(0, 8);
}

function buildMissingSteps(input: {
  githubConnected: boolean;
  hasRecordings: boolean;
  hasDocuments: boolean;
  teamMembers: number;
  accountType: 'individual' | 'team';
}): string[] {
  const items: string[] = [];
  if (!input.githubConnected) items.push('Connect GitHub App');
  if (!input.hasRecordings) items.push('Capture or upload your first recording');
  if (!input.hasDocuments) items.push('Generate your first document');
  if (input.accountType === 'team' && input.teamMembers <= 1) {
    items.push('Invite teammates');
  }
  return items;
}
