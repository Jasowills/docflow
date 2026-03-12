export type TestPlanStatus = 'draft' | 'ready' | 'archived';

export type TestPlanRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';

export interface TestPlan {
  planId: string;
  workspaceId: string;
  name: string;
  description?: string;
  repositoryFullName?: string;
  branch?: string;
  targetEnvironment?: string;
  status: TestPlanStatus;
  createdAtUtc: string;
  createdBy: string;
  lastModifiedAtUtc?: string;
  testCaseIds: string[];
}

export interface CreateTestPlanRequest {
  name: string;
  description?: string;
  repositoryFullName?: string;
  branch?: string;
  targetEnvironment?: string;
  testCaseIds?: string[];
}

export interface TestPlanAttachedSuite {
  documentId: string;
  documentTitle: string;
  recordingId: string;
  recordingName: string;
  productArea: string;
  createdAtUtc: string;
  createdBy: string;
}

export interface TestPlanExecutionRun {
  runId: string;
  planId: string;
  workspaceId: string;
  status: TestPlanRunStatus;
  trigger: 'manual';
  source: 'docflow';
  branch?: string;
  targetEnvironment?: string;
  notes?: string;
  createdAtUtc: string;
  createdBy: string;
  startedAtUtc?: string;
  completedAtUtc?: string;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
}

export interface TestPlanDetail {
  plan: TestPlan;
  attachedSuites: TestPlanAttachedSuite[];
  runs: TestPlanExecutionRun[];
}

export interface AttachTestPlanSuitesRequest {
  documentIds: string[];
}

export interface CreateTestPlanRunRequest {
  branch?: string;
  targetEnvironment?: string;
  notes?: string;
}
