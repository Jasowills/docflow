import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UserContext } from '@docflow/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { InviteWorkspaceMemberDto, UpdateWorkspaceMemberRoleDto } from './dto/workspace.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get the current workspace details' })
  getCurrent(@CurrentUser() user: UserContext) {
    return this.workspacesService.getWorkspace(user.workspaceId);
  }

  @Post('current/invitations')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Invite a member to the current workspace' })
  invite(
    @CurrentUser() user: UserContext,
    @Body() body: InviteWorkspaceMemberDto,
  ) {
    return this.workspacesService.inviteMember(user.workspaceId, user.userId, body);
  }

  @Patch('current/members/:userId')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update a workspace member role' })
  updateMemberRole(
    @CurrentUser() user: UserContext,
    @Param('userId') userId: string,
    @Body() body: UpdateWorkspaceMemberRoleDto,
  ) {
    return this.workspacesService.updateMemberRole(user.workspaceId, userId, body);
  }

  @Delete('current/invitations/:invitationId')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Revoke a pending workspace invitation' })
  revokeInvitation(
    @CurrentUser() user: UserContext,
    @Param('invitationId') invitationId: string,
  ) {
    return this.workspacesService.revokeInvitation(user.workspaceId, invitationId);
  }
}
