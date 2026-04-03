import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UserContext, WorkspaceSummary } from '@docflow/shared';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { InviteWorkspaceMemberDto, SwitchWorkspaceDto, UpdateWorkspaceMemberRoleDto } from './dto/workspace.dto';
import { AcceptInvitationDto } from './dto/invitation.dto';
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

  @Get('memberships')
  @ApiOperation({ summary: 'List all workspaces the current user belongs to' })
  listMemberships(@CurrentUser() user: UserContext) {
    return this.workspacesService.listUserMemberships(user.userId);
  }

  @Post('switch')
  @ApiOperation({ summary: 'Switch the current user to a different workspace' })
  switchWorkspace(
    @CurrentUser() user: UserContext,
    @Body() body: SwitchWorkspaceDto,
  ) {
    return this.workspacesService.switchWorkspace(user.userId, body.workspaceId);
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

  @Patch('current')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update the current workspace basics' })
  updateWorkspace(
    @CurrentUser() user: UserContext,
    @Body() body: { name: string },
  ) {
    return this.workspacesService.updateWorkspace(user.workspaceId, body);
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

  @Public()
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Get invitation details by token' })
  getInvitationDetails(@Param('token') token: string) {
    return this.workspacesService.getInvitationDetails(token);
  }

  @Post('invitations/accept')
  @ApiOperation({ summary: 'Accept a workspace invitation' })
  acceptInvitation(
    @CurrentUser() user: UserContext,
    @Body() body: AcceptInvitationDto,
  ): Promise<WorkspaceSummary> {
    return this.workspacesService.acceptInvitation(
      body.token,
      user.userId,
      user.email,
      user.displayName,
    );
  }

  @Delete('current/leave')
  @ApiOperation({ summary: 'Leave the current workspace' })
  leaveWorkspace(
    @CurrentUser() user: UserContext,
  ) {
    if (!user.workspaceId) {
      throw new BadRequestException('No active workspace.');
    }
    return this.workspacesService.leaveWorkspace(user.userId, user.workspaceId);
  }
}
