import type { AccountType } from '@docflow/shared';

export interface AuthUserRecord {
  _id?: string;
  userId: string;
  email: string;
  displayName: string;
  passwordHash?: string;
  externalProvider?: 'logto';
  externalSubject?: string;
  accountType: AccountType;
  teamName?: string;
  defaultWorkspaceId?: string;
  roles: string[];
  createdAtUtc: string;
  lastLoginAtUtc?: string;
  onboardingCompletedAt?: string;
  onboardingState?: Record<string, unknown>;
}
