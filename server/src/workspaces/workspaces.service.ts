import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  InviteWorkspaceMemberRequest,
  UpdateWorkspaceRequest,
  UpdateWorkspaceMemberRoleRequest,
  WorkspaceDetails,
  WorkspaceInvitation,
  WorkspaceSummary,
} from '@docflow/shared';
import { WorkspacesRepository } from '../auth/workspaces.repository';
import { UsersRepository } from '../auth/users.repository';
import { EmailService } from '../common/services/email.service';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly repository: WorkspacesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly emailService: EmailService,
  ) {}

  async getWorkspace(workspaceId: string | undefined): Promise<WorkspaceDetails> {
    if (!workspaceId) {
      throw new BadRequestException('A workspace is required.');
    }

    const workspace = await this.repository.getWorkspaceDetails(workspaceId);
    if (!workspace) {
      throw new BadRequestException('Workspace not found.');
    }
    return workspace;
  }

  async inviteMember(
    workspaceId: string | undefined,
    invitedByUserId: string,
    request: InviteWorkspaceMemberRequest,
  ): Promise<WorkspaceInvitation> {
    if (!workspaceId) {
      throw new BadRequestException('A workspace is required.');
    }
    
    const invitation = await this.repository.createInvitation(workspaceId, invitedByUserId, request);

    void this.sendInvitationEmail(workspaceId, invitedByUserId, invitation);

    return invitation;
  }

  private async sendInvitationEmail(
    workspaceId: string,
    invitedByUserId: string,
    invitation: WorkspaceInvitation,
  ): Promise<void> {
    try {
      const [workspace, inviter] = await Promise.all([
        this.repository.findSummaryById(workspaceId),
        this.usersRepository.findByUserId(invitedByUserId),
      ]);

      if (!workspace || !inviter) {
        this.logger.warn('Could not send invitation email: missing workspace or inviter data');
        return;
      }

      await this.emailService.sendInvitationEmail({
        to: invitation.email,
        workspaceName: workspace.name,
        inviterName: inviter.displayName || inviter.email,
        invitationToken: invitation.invitationId,
      });
    } catch (error) {
      this.logger.error(`Failed to send invitation email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateMemberRole(
    workspaceId: string | undefined,
    userId: string,
    request: UpdateWorkspaceMemberRoleRequest,
  ): Promise<void> {
    if (!workspaceId) {
      throw new BadRequestException('A workspace is required.');
    }
    await this.repository.updateMemberRole(workspaceId, userId, request);
  }

  async revokeInvitation(workspaceId: string | undefined, invitationId: string): Promise<void> {
    if (!workspaceId) {
      throw new BadRequestException('A workspace is required.');
    }
    await this.repository.revokeInvitation(workspaceId, invitationId);
  }

  async listUserMemberships(userId: string) {
    return this.repository.listUserMemberships(userId);
  }

  async switchWorkspace(
    userId: string,
    targetWorkspaceId: string,
  ): Promise<{
    workspaceId: string;
    workspaceName: string;
    role: string;
  }> {
    // Verify user is a member of the target workspace
    const role = await this.repository.getMemberRole(targetWorkspaceId, userId);
    if (!role) {
      throw new BadRequestException('You are not a member of this workspace.');
    }

    // Update the user's default workspace
    await this.usersRepository.updateDefaultWorkspace(userId, targetWorkspaceId);

    const workspace = await this.repository.findSummaryById(targetWorkspaceId);
    if (!workspace) {
      throw new BadRequestException('Workspace not found.');
    }

    return {
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.name,
      role,
    };
  }

  async getInvitationDetails(token: string): Promise<{
    invitationId: string;
    workspaceId: string;
    workspaceName: string;
    email: string;
    role: string;
    inviterDisplayName: string;
    status: string;
    isExpired: boolean;
  }> {
    const invitation = await this.repository.findInvitationByToken(token);
    if (!invitation) {
      throw new NotFoundException('Invitation not found or has been revoked.');
    }

    const isExpired = invitation.status === 'pending' &&
      new Date(invitation.invitedAtUtc).getTime() + 7 * 24 * 60 * 60 * 1000 < Date.now();

    return {
      invitationId: invitation.invitationId,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspaceName,
      email: invitation.email,
      role: invitation.role,
      inviterDisplayName: invitation.inviterDisplayName,
      status: isExpired ? 'expired' : invitation.status,
      isExpired,
    };
  }

  async acceptInvitation(
    token: string,
    userId: string,
    userEmail: string,
    userDisplayName: string,
  ): Promise<WorkspaceSummary> {
    this.logger.log(`acceptInvitation called: userId=${userId}, email=${userEmail}, displayName=${userDisplayName}`);

    const invitation = await this.repository.findInvitationByToken(token);

    if (!invitation) {
      throw new NotFoundException('Invitation not found or has been revoked.');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('This invitation has already been used or was revoked.');
    }

    // Check 7-day expiry
    const invitedAt = new Date(invitation.invitedAtUtc).getTime();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    if (invitedAt + sevenDaysInMs < Date.now()) {
      await this.repository.acceptInvitation(invitation.workspaceId, invitation.invitationId);
      await this.repository['supabase']
        .from('workspace_invitations')
        .update({ status: 'expired' })
        .eq('invitation_id', invitation.invitationId);
      throw new BadRequestException('This invitation has expired.');
    }

    // Verify email match
    if (invitation.email !== userEmail.toLowerCase()) {
      throw new BadRequestException(
        'This invitation is for a different email address.',
      );
    }

    // Verify the authenticated user actually exists in the database
    const existingUser = await this.usersRepository.findByUserId(userId);
    this.logger.log(`findByUserId(${userId}) returned: ${existingUser ? `email=${existingUser.email}, onboardingState=${JSON.stringify(existingUser.onboardingState)}` : 'NULL'}`);
    if (!existingUser) {
      throw new BadRequestException(
        'Your account could not be found. Please sign in again and retry.',
      );
    }

    this.logger.log(`acceptInvitation: userId=${userId}, email=${userEmail}, displayName=${userDisplayName}, onboardingState=${JSON.stringify(existingUser.onboardingState)}`);

    // Check the user isn't already a member of this workspace
    const existingMembers = await this.repository.listMembers(invitation.workspaceId);
    const alreadyMember = existingMembers.some((m) => m.userId === userId);
    if (alreadyMember) {
      throw new BadRequestException(
        'You are already a member of this workspace.',
      );
    }

    // Add user as workspace member
    await this.repository.addMemberFromInvitation(
      {
        workspaceId: invitation.workspaceId,
        email: invitation.email,
        role: invitation.role,
      },
      userId,
      userDisplayName,
    );

    // Mark invitation as accepted
    await this.repository.acceptInvitation(invitation.workspaceId, invitation.invitationId);

    // Update user's default workspace to the invited workspace
    await this.usersRepository.updateDefaultWorkspace(userId, invitation.workspaceId);

    // Clear needsAccountSetup so the user isn't redirected to account setup
    this.logger.log(`About to clearAccountSetupRequired for userId=${userId}`);
    await this.usersRepository.clearAccountSetupRequired(userId);
    this.logger.log(`clearAccountSetupRequired complete for userId=${userId}`);

    const workspace = await this.repository.findSummaryById(invitation.workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found after accepting invitation.');
    }

    return workspace;
  }

  async updateWorkspace(
    workspaceId: string | undefined,
    request: UpdateWorkspaceRequest,
  ) {
    if (!workspaceId) {
      throw new BadRequestException('A workspace is required.');
    }
    if (!request.name?.trim()) {
      throw new BadRequestException('Workspace name is required.');
    }

    const workspace = await this.repository.updateWorkspace(workspaceId, request);
    if (!workspace) {
      throw new BadRequestException('Workspace not found.');
    }
    return workspace;
  }
}
