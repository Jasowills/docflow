import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ConnectGithubRequest, UserContext } from '@docflow/shared';
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
    return this.githubService.getStatus(user.userId);
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
    return this.githubService.disconnect(user.userId);
  }

  @Get('repos')
  @ApiOperation({ summary: 'List GitHub repositories available to the current user' })
  listRepos(@CurrentUser() user: UserContext) {
    return this.githubService.listRepositories(user.userId);
  }
}
