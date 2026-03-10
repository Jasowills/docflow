import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CreateTestPlanRequest, UserContext } from '@docflow/shared';
import { CurrentUser } from '../auth/decorators';
import { TestPlansService } from './test-plans.service';

@ApiTags('Test Plans')
@ApiBearerAuth()
@Controller('test-plans')
export class TestPlansController {
  constructor(private readonly testPlansService: TestPlansService) {}

  @Get()
  @ApiOperation({ summary: 'List test plans for the current workspace' })
  list(@CurrentUser() user: UserContext) {
    return this.testPlansService.list(user.workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a test plan for the current workspace' })
  create(
    @CurrentUser() user: UserContext,
    @Body() body: CreateTestPlanRequest,
  ) {
    return this.testPlansService.create(user.workspaceId, user.userId, body);
  }
}
