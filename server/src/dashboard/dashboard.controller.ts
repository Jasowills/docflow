import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UserContext } from '@docflow/shared';
import { CurrentUser } from '../auth/decorators';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get workspace operations dashboard summary' })
  getSummary(@CurrentUser() user: UserContext) {
    return this.dashboardService.getSummary(user.userId, user.workspaceId);
  }
}

