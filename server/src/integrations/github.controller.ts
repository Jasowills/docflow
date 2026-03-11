import { Body, Controller, Delete, Get, Post, Query, Redirect, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ConnectGithubRequest, GithubRepoSelection, UserContext } from '@docflow/shared';
import { CurrentUser } from '../auth/decorators';
import { GithubService } from './github.service';

@ApiTags('GitHub')
@ApiBearerAuth()
@Controller('integrations/github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get the current GitHub connection status' })
  getStatus(@CurrentUser() user: UserContext) {
    return this.githubService.getStatus(user.userId, user.workspaceId);
  }

  @Get('app/install-url')
  @ApiOperation({ summary: 'Get the GitHub App installation URL for the current workspace' })
  getInstallUrl(@CurrentUser() user: UserContext) {
    return this.githubService.getInstallUrl(user.userId, user.workspaceId);
  }

  @Get('app/callback')
  @Redirect()
  @ApiOperation({ summary: 'Handle the GitHub App setup callback' })
  async handleCallback(
    @Query('installation_id') installationId?: string,
    @Query('setup_action') setupAction?: string,
    @Query('state') state?: string,
  ) {
    const url = await this.githubService.handleAppCallback({
      installationId: installationId ? Number(installationId) : undefined,
      setupAction,
      state,
    });
    return { url };
  }

  @Post('connect')
  @ApiOperation({ summary: 'Connect a GitHub account token to the current user' })
  connect(
    @CurrentUser() user: UserContext,
    @Body() body: ConnectGithubRequest,
  ) {
    return this.githubService.connect(user.userId, body);
  }

  @Delete('connect')
  @ApiOperation({ summary: 'Disconnect the current GitHub account' })
  disconnect(@CurrentUser() user: UserContext) {
    return this.githubService.disconnect(user.userId, user.workspaceId);
  }

  @Get('repos')
  @ApiOperation({ summary: 'List GitHub repositories available to the current user' })
  listRepos(@CurrentUser() user: UserContext) {
    return this.githubService.listRepositories(user.userId, user.workspaceId);
  }

  @Get('repos/selected')
  @ApiOperation({ summary: 'List workspace-selected repositories' })
  listSelectedRepos(@CurrentUser() user: UserContext) {
    return this.githubService.listSelectedRepositories(user.workspaceId);
  }

  @Put('repos/selected')
  @ApiOperation({ summary: 'Replace workspace-selected repositories' })
  updateSelectedRepos(
    @CurrentUser() user: UserContext,
    @Body() body: { repositories: GithubRepoSelection[] },
  ) {
    return this.githubService.updateSelectedRepositories(user.workspaceId, body);
  }
}
