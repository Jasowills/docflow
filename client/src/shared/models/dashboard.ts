import type { DocumentSummary } from './document';
import type { RecordingSummary } from './recording';
import type { TestPlan } from './test-plan';

export interface DashboardMetricSummary {
  recordings: number;
  documents: number;
  activeTestPlans: number;
  connectedRepos: number;
  teamMembers: number;
}

export interface DashboardSeriesPoint {
  label: string;
  value: number;
}

export interface DashboardActivityItem {
  id: string;
  type: 'recording' | 'document' | 'test-plan' | 'workspace';
  title: string;
  description: string;
  timestampUtc: string;
}

export interface DashboardSetupState {
  onboardingCompleted: boolean;
  githubConnected: boolean;
  missingSteps: string[];
}

export interface DashboardSummary {
  metrics: DashboardMetricSummary;
  recentRecordings: RecordingSummary[];
  recentDocuments: DocumentSummary[];
  recentTestPlans: TestPlan[];
  recentActivity: DashboardActivityItem[];
  recordingsTrend: DashboardSeriesPoint[];
  documentsTrend: DashboardSeriesPoint[];
  testPlanStatus: DashboardSeriesPoint[];
  setup: DashboardSetupState;
}
