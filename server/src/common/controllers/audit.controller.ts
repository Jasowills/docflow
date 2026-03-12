import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators';
import { AuditService } from '../services/audit.service';
import type { AuditLogEntry, UserContext } from '@docflow/shared';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List audit logs for the current workspace' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @CurrentUser() user: UserContext,
    @Query('limit') limit?: string,
  ): Promise<AuditLogEntry[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.auditService.listForWorkspace(user.workspaceId, parsedLimit);
  }
}


