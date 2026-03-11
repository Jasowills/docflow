import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  InviteWorkspaceMemberRequest,
  UpdateWorkspaceRequest,
  UpdateWorkspaceMemberRoleRequest,
  WorkspaceDetails,
  WorkspaceInvitation,
} from '@docflow/shared';
import { WorkspacesRepository } from '../auth/workspaces.repository';

@Injectable()
export class WorkspacesService {
  constructor(private readonly repository: WorkspacesRepository) {}

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
    return this.repository.createInvitation(workspaceId, invitedByUserId, request);
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
