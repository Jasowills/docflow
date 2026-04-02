import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../database/supabase.providers';
import type {
  AccountType,
  InviteWorkspaceMemberRequest,
  UpdateWorkspaceRequest,
  UpdateWorkspaceMemberRoleRequest,
  WorkspaceDetails,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceSummary,
} from '@docflow/shared';
import { v4 as uuidv4 } from 'uuid';

interface CreateWorkspaceParams {
  workspaceId: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  accountType: AccountType;
  workspaceName: string;
}

@Injectable()
export class WorkspacesRepository {
  private readonly logger = new Logger(WorkspacesRepository.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async createDefaultWorkspace(params: CreateWorkspaceParams): Promise<WorkspaceSummary> {
    const now = new Date().toISOString();
    const slug = slugifyWorkspaceName(params.workspaceName);

    const { error: workspaceError } = await this.supabase.from('workspaces').insert({
      workspace_id: params.workspaceId,
      name: params.workspaceName,
      slug,
      account_type: params.accountType,
      created_at_utc: now,
      updated_at_utc: now,
      created_by_user_id: params.ownerUserId,
    });

    if (workspaceError) {
      this.logger.error(`Failed to create workspace ${params.workspaceId}: ${workspaceError.message}`);
      throw new Error('Failed to create workspace.');
    }

    const { error: membershipError } = await this.supabase
      .from('workspace_members')
      .insert({
        workspace_id: params.workspaceId,
        user_id: params.ownerUserId,
        email: params.ownerEmail,
        display_name: params.ownerDisplayName,
        role: 'owner',
        joined_at_utc: now,
      });

    if (membershipError) {
      this.logger.error(
        `Failed to create workspace membership for ${params.ownerUserId}: ${membershipError.message}`,
      );
      throw new Error('Failed to create workspace membership.');
    }

    return {
      workspaceId: params.workspaceId,
      name: params.workspaceName,
      accountType: params.accountType,
      githubInstallationId: undefined,
      githubConnectedAtUtc: undefined,
      githubAccountLogin: undefined,
    };
  }

  async findSummaryById(workspaceId: string): Promise<WorkspaceSummary | null> {
    const { data, error } = await this.supabase
      .from('workspaces')
      .select('workspace_id, name, account_type, github_installation_id, github_connected_at_utc, github_account_login')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to fetch workspace ${workspaceId}: ${error.message}`);
      throw new Error('Failed to load workspace.');
    }

    if (!data) return null;

    return {
      workspaceId: data.workspace_id as string,
      name: data.name as string,
      accountType: data.account_type as AccountType,
      githubInstallationId:
        typeof data.github_installation_id === 'number' ? data.github_installation_id : undefined,
      githubConnectedAtUtc:
        typeof data.github_connected_at_utc === 'string' ? data.github_connected_at_utc : undefined,
      githubAccountLogin:
        typeof data.github_account_login === 'string' ? data.github_account_login : undefined,
    };
  }

  async updateWorkspace(workspaceId: string, request: UpdateWorkspaceRequest): Promise<WorkspaceSummary | null> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from('workspaces')
      .update({
        name: request.name.trim(),
        slug: slugifyWorkspaceName(request.name),
        updated_at_utc: now,
      })
      .eq('workspace_id', workspaceId);

    if (error) {
      this.logger.error(`Failed to update workspace ${workspaceId}: ${error.message}`);
      throw new Error('Failed to update workspace.');
    }

    return this.findSummaryById(workspaceId);
  }

  async renameWorkspace(workspaceId: string, name: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from('workspaces')
      .update({
        name: name.trim(),
        slug: slugifyWorkspaceName(name),
        updated_at_utc: now,
      })
      .eq('workspace_id', workspaceId);

    if (error) {
      this.logger.error(`Failed to rename workspace ${workspaceId}: ${error.message}`);
      throw new Error('Failed to rename workspace.');
    }
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const { error } = await this.supabase
      .from('workspaces')
      .delete()
      .eq('workspace_id', workspaceId);

    if (error) {
      this.logger.error(`Failed to delete workspace ${workspaceId}: ${error.message}`);
      throw new Error('Failed to delete workspace.');
    }
  }

  async getWorkspaceDetails(workspaceId: string): Promise<WorkspaceDetails | null> {
    const [workspace, members, invitations] = await Promise.all([
      this.findSummaryById(workspaceId),
      this.listMembers(workspaceId),
      this.listInvitations(workspaceId),
    ]);

    if (!workspace) return null;

    return {
      ...workspace,
      members,
      invitations,
    };
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select('workspace_id, user_id, email, display_name, role, joined_at_utc')
      .eq('workspace_id', workspaceId)
      .order('joined_at_utc', { ascending: true });

    if (error) {
      this.logger.error(`Failed to list workspace members for ${workspaceId}: ${error.message}`);
      throw new Error('Failed to load workspace members.');
    }

    return (data || []).map((row) => ({
      workspaceId: String(row.workspace_id),
      userId: String(row.user_id),
      email: String(row.email),
      displayName: String(row.display_name),
      role: row.role as WorkspaceMember['role'],
      joinedAtUtc: String(row.joined_at_utc),
    }));
  }

  async getMemberRole(workspaceId: string, userId: string): Promise<WorkspaceMember['role'] | null> {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to fetch member role for ${workspaceId}/${userId}: ${error.message}`);
      throw new Error('Failed to load workspace member role.');
    }

    return data?.role ? (data.role as WorkspaceMember['role']) : null;
  }

  async listInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const { data, error } = await this.supabase
      .from('workspace_invitations')
      .select(
        'invitation_id, workspace_id, email, role, invited_by_user_id, invited_at_utc, accepted_at_utc, status',
      )
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('invited_at_utc', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list workspace invitations for ${workspaceId}: ${error.message}`);
      throw new Error('Failed to load workspace invitations.');
    }

    return (data || []).map((row) => ({
      invitationId: String(row.invitation_id),
      workspaceId: String(row.workspace_id),
      email: String(row.email),
      role: row.role as WorkspaceInvitation['role'],
      invitedByUserId: String(row.invited_by_user_id),
      invitedAtUtc: String(row.invited_at_utc),
      acceptedAtUtc:
        typeof row.accepted_at_utc === 'string' ? row.accepted_at_utc : undefined,
      status: row.status as WorkspaceInvitation['status'],
    }));
  }

  async createInvitation(
    workspaceId: string,
    invitedByUserId: string,
    request: InviteWorkspaceMemberRequest,
  ): Promise<WorkspaceInvitation> {
    const email = request.email.trim().toLowerCase();
    const existingMember = await this.supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('email', email)
      .maybeSingle();

    if (existingMember.error) {
      this.logger.error(
        `Failed to validate existing member for ${workspaceId}: ${existingMember.error.message}`,
      );
      throw new Error('Failed to validate workspace member.');
    }

    if (existingMember.data) {
      throw new BadRequestException('This user is already a member of the workspace.');
    }

    const invitationId = uuidv4();
    const invitedAtUtc = new Date().toISOString();
    const { error } = await this.supabase.from('workspace_invitations').insert({
      invitation_id: invitationId,
      workspace_id: workspaceId,
      email,
      role: request.role,
      invited_by_user_id: invitedByUserId,
      invited_at_utc: invitedAtUtc,
      status: 'pending',
    });

    if (error) {
      this.logger.error(`Failed to create invitation for ${workspaceId}: ${error.message}`);
      throw new Error('Failed to create workspace invitation.');
    }

    return {
      invitationId,
      workspaceId,
      email,
      role: request.role,
      invitedByUserId,
      invitedAtUtc,
      status: 'pending',
    };
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    request: UpdateWorkspaceMemberRoleRequest,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('workspace_members')
      .update({ role: request.role })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to update member role for ${workspaceId}/${userId}: ${error.message}`);
      throw new Error('Failed to update member role.');
    }
  }

  async revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('workspace_invitations')
      .update({ status: 'revoked' })
      .eq('workspace_id', workspaceId)
      .eq('invitation_id', invitationId);

    if (error) {
      this.logger.error(`Failed to revoke invitation ${invitationId}: ${error.message}`);
      throw new Error('Failed to revoke workspace invitation.');
    }
  }

  async setGithubInstallation(
    workspaceId: string,
    input: {
      installationId: number | null;
      connectedAtUtc?: string | null;
      accountLogin?: string | null;
    },
  ): Promise<void> {
    const { error } = await this.supabase
      .from('workspaces')
      .update({
        github_installation_id: input.installationId,
        github_connected_at_utc: input.connectedAtUtc ?? null,
        github_account_login: input.accountLogin ?? null,
        updated_at_utc: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId);

    if (error) {
      this.logger.error(`Failed to set GitHub installation for ${workspaceId}: ${error.message}`);
      throw new Error('Failed to update GitHub installation.');
    }
  }

  async syncMemberProfile(
    workspaceId: string,
    userId: string,
    updates: {
      email?: string;
      displayName?: string;
    },
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.email) payload.email = updates.email.trim().toLowerCase();
    if (updates.displayName) payload.display_name = updates.displayName.trim();
    if (Object.keys(payload).length === 0) return;

    const { error } = await this.supabase
      .from('workspace_members')
      .update(payload)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to sync member profile for ${workspaceId}/${userId}: ${error.message}`);
      throw new Error('Failed to sync workspace member profile.');
    }
  }
}

function slugifyWorkspaceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
