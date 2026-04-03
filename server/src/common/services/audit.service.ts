import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/supabase.providers';
import { WorkspacesRepository } from '../../auth/workspaces.repository';
import type { AuditLogEntry } from '@docflow/shared';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly workspacesRepository: WorkspacesRepository,
  ) {}

  async log(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    try {
      const { error } = await this.supabase.from('audit_log').insert({
        action: auditEntry.action,
        user_id: auditEntry.userId,
        user_email: auditEntry.userEmail,
        user_name: (auditEntry as unknown as { userName?: string }).userName || auditEntry.userEmail,
        resource_type: auditEntry.resourceType,
        resource_id: auditEntry.resourceId || null,
        details: auditEntry.details || null,
        timestamp: auditEntry.timestamp,
      });
      if (error) {
        this.logger.error(`Failed to write audit log: ${error.message}`);
        return;
      }
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
    }
  }

  async listForWorkspace(workspaceId: string | undefined, limit = 50, userId?: string): Promise<AuditLogEntry[]> {
    const userIds = await this.resolveWorkspaceUserIds(workspaceId);
    if (userIds.length === 0) {
      return [];
    }
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('*, notification_reads!left(user_id, read_at_utc)')
      .in('user_id', userIds)
      .order('timestamp', { ascending: false })
      .limit(safeLimit);

    if (error) {
      this.logger.error(`Failed to load workspace audit log: ${error.message}`);
      throw new Error('Failed to load workspace audit log.');
    }

    const readMap = new Map<number, { readAtUtc: string }>();
    if (userId && data) {
      for (const row of data as Array<Record<string, unknown>>) {
        const reads = row.notification_reads as Array<{ user_id: string; read_at_utc: string }> | null;
        if (reads && reads.length > 0) {
          readMap.set(row.id as number, { readAtUtc: reads[0].read_at_utc });
        }
      }
    }

    return ((data as Array<Record<string, unknown>> | null) || []).map((row) => {
      const readInfo = readMap.get(row.id as number);
      return {
        id: row.id as number,
        action: String(row.action || ''),
        userId: String(row.user_id || ''),
        userEmail: String(row.user_email || ''),
        userName: String(row.user_name || row.user_email || ''),
        resourceType: String(row.resource_type || ''),
        resourceId: typeof row.resource_id === 'string' ? row.resource_id : undefined,
        details: (row.details as Record<string, unknown> | null) || undefined,
        timestamp: String(row.timestamp || ''),
        read: !!readInfo,
        readAtUtc: readInfo?.readAtUtc,
      };
    });
  }

  async markAsRead(userId: string, auditLogIds: number[]): Promise<void> {
    if (auditLogIds.length === 0) return;
    
    const now = new Date().toISOString();
    const rowsToInsert = auditLogIds.map((id) => ({
      user_id: userId,
      audit_log_id: id,
      read_at_utc: now,
    }));

    const { error } = await this.supabase
      .from('notification_reads')
      .upsert(rowsToInsert, {
        onConflict: 'user_id,audit_log_id',
        ignoreDuplicates: true,
      });

    if (error) {
      this.logger.error(`Failed to mark notifications as read: ${error.message}`);
      throw new Error('Failed to mark notifications as read.');
    }
  }

  async markAllAsRead(userId: string, workspaceId?: string): Promise<number> {
    const userIds = await this.resolveWorkspaceUserIds(workspaceId);
    if (userIds.length === 0) return 0;

    const { data: auditLogs, error: auditError } = await this.supabase
      .from('audit_log')
      .select('id')
      .in('user_id', userIds);

    if (auditError) {
      this.logger.error(`Failed to fetch audit logs: ${auditError.message}`);
      throw new Error('Failed to fetch audit logs.');
    }

    const { data: readEntries, error: readError } = await this.supabase
      .from('notification_reads')
      .select('audit_log_id')
      .eq('user_id', userId);

    if (readError) {
      this.logger.error(`Failed to fetch read entries: ${readError.message}`);
      throw new Error('Failed to fetch read entries.');
    }

    const readIds = new Set((readEntries as Array<{ audit_log_id: number }> | null)?.map((r) => r.audit_log_id) || []);
    const allIds = (auditLogs as Array<{ id: number }> | null)?.map((r) => r.id) || [];
    const unreadIds = allIds.filter((id) => !readIds.has(id));

    if (unreadIds.length === 0) return 0;

    await this.markAsRead(userId, unreadIds);
    return unreadIds.length;
  }

  private async resolveWorkspaceUserIds(workspaceId: string | undefined): Promise<string[]> {
    if (!workspaceId) {
      return [];
    }

    const members = await this.workspacesRepository.listMembers(workspaceId);
    const userIds = members.map((member) => member.userId).filter(Boolean);
    return userIds;
  }
}
