import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators';
import { AuditService } from '../services/audit.service';
import type { AuditLogEntry, UserContext } from '@docflow/shared';
import { IsArray, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class MarkReadDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  auditLogIds!: number[];
}

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
    return this.auditService.listForWorkspace(user.workspaceId, parsedLimit, user.userId);
  }

  @Post('mark-read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark specific audit log entries as read' })
  async markAsRead(
    @CurrentUser() user: UserContext,
    @Body() dto: MarkReadDto,
  ): Promise<{ success: boolean }> {
    await this.auditService.markAsRead(user.userId, dto.auditLogIds);
    return { success: true };
  }

  @Post('mark-all-read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all audit log entries as read for the workspace' })
  async markAllAsRead(
    @CurrentUser() user: UserContext,
  ): Promise<{ success: boolean; markedCount: number }> {
    const markedCount = await this.auditService.markAllAsRead(user.userId, user.workspaceId);
    return { success: true, markedCount };
  }
}


