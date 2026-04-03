export type AccountType = 'individual' | 'team';

export interface Workspace {
  workspaceId: string;
  name: string;
  slug: string;
  accountType: AccountType;
  createdAtUtc: string;
  updatedAtUtc: string;
  createdByUserId: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'editor';
  joinedAtUtc: string;
}

export interface WorkspaceInvitation {
  invitationId: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'editor';
  invitedByUserId: string;
  invitedAtUtc: string;
  acceptedAtUtc?: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
}

export interface WorkspaceSummary {
  workspaceId: string;
  name: string;
  accountType: AccountType;
  createdByUserId: string;
  githubInstallationId?: number;
  githubConnectedAtUtc?: string;
  githubAccountLogin?: string;
}

export interface WorkspaceDetails extends WorkspaceSummary {
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
}

export interface UpdateWorkspaceRequest {
  name: string;
}

export interface InviteWorkspaceMemberRequest {
  email: string;
  role: 'admin' | 'editor';
}

export interface UpdateWorkspaceMemberRoleRequest {
  role: 'owner' | 'admin' | 'editor';
}
