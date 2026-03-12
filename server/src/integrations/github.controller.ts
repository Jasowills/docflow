import { Body, Controller, Delete, Get, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ConnectGithubRequest, GithubRepoSelection, UserContext } from '@docflow/shared';
import type { Request, Response } from 'express';
import { CurrentUser, Public } from '../auth/decorators';
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

  @Get('app/install')
  @Public()
  @ApiOperation({ summary: 'Start the GitHub App installation flow' })
  async beginInstall(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.githubService.beginAppInstall(token);
    res.cookie(result.cookieName, result.cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/integrations/github/app',
      maxAge: 10 * 60 * 1000,
    });
    return res.redirect(result.installUrl);
  }

  @Get('app/callback')
  @Public()
  @ApiOperation({ summary: 'Handle the GitHub App setup callback' })
  async handleCallback(
    @Query('installation_id') installationId?: string,
    @Query('setup_action') setupAction?: string,
    @Query('state') state?: string,
    @Req() req?: Request,
    @Res() res?: Response,
  ) {
    const cookieName = this.githubService.getInstallCookieName();
    const cookieState = readCookie(req?.headers.cookie, cookieName);

    try {
      const url = await this.githubService.handleAppCallback({
        installationId: installationId ? Number(installationId) : undefined,
        setupAction,
        state,
        cookieState,
      });
      res?.clearCookie(cookieName, { path: '/api/integrations/github/app' });
      return res?.redirect(url);
    } catch {
      res?.clearCookie(cookieName, { path: '/api/integrations/github/app' });
      return res?.redirect(this.githubService.getGithubSettingsRedirectUrl('error'));
    }
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

function readCookie(rawCookieHeader: string | undefined, name: string): string | undefined {
  if (!rawCookieHeader) {
    return undefined;
  }

  const prefix = `${name}=`;
  return rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}
