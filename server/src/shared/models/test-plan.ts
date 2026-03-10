export interface TestPlan {
  planId: string;
  workspaceId: string;
  name: string;
  description?: string;
  repositoryFullName?: string;
  branch?: string;
  targetEnvironment?: string;
  status: 'draft' | 'ready' | 'archived';
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
