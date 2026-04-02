import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  InviteWorkspaceMemberRequest,
  UpdateWorkspaceRequest,
  UpdateWorkspaceMemberRoleRequest,
  WorkspaceDetails,
  WorkspaceInvitation,
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
