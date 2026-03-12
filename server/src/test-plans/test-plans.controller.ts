import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AttachTestPlanSuitesRequest,
  CreateTestPlanRequest,
  CreateTestPlanRunRequest,
  UserContext,
} from '@docflow/shared';
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a test plan detail view for the current workspace' })
  getById(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    return this.testPlansService.getDetail(user.workspaceId, id, user.userId);
  }

  @Put(':id/test-suites')
  @ApiOperation({ summary: 'Replace attached generated test suites for a test plan' })
  attachSuites(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
    @Body() body: AttachTestPlanSuitesRequest,
  ) {
    return this.testPlansService.attachSuites(user.workspaceId, id, body, user.userId);
  }

  @Post(':id/runs')
  @ApiOperation({ summary: 'Create a manual execution run for a test plan' })
  createRun(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
    @Body() body: CreateTestPlanRunRequest,
  ) {
    return this.testPlansService.createRun(user.workspaceId, id, user.userId, body);
  }
}
