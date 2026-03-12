import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/supabase.providers';
import { WorkspacesRepository } from '../../auth/workspaces.repository';

export interface AuditEntry {
  action: string;
  userId: string;
  userEmail: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly workspacesRepository: WorkspacesRepository,
  ) {}

  async log(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
    const auditEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    try {
      const { error } = await this.supabase.from('audit_log').insert({
        action: auditEntry.action,
        user_id: auditEntry.userId,
        user_email: auditEntry.userEmail,
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

  async listAll(limit = 50): Promise<AuditEntry[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(safeLimit);

    if (error) {
      this.logger.error(`Failed to load audit log: ${error.message}`);
      throw new Error('Failed to load audit log.');
    }

    return ((data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      action: String(row.action || ''),
      userId: String(row.user_id || ''),
      userEmail: String(row.user_email || ''),
      resourceType: String(row.resource_type || ''),
      resourceId: typeof row.resource_id === 'string' ? row.resource_id : undefined,
      details: (row.details as Record<string, unknown> | null) || undefined,
      timestamp: String(row.timestamp || ''),
    }));
  }

  async listForWorkspace(workspaceId: string | undefined, limit = 50): Promise<AuditEntry[]> {
    const userIds = await this.resolveWorkspaceUserIds(workspaceId);
    if (userIds.length === 0) {
      return [];
    }
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('*')
      .in('user_id', userIds)
      .order('timestamp', { ascending: false })
      .limit(safeLimit);

    if (error) {
      this.logger.error(`Failed to load workspace audit log: ${error.message}`);
      throw new Error('Failed to load workspace audit log.');
    }

    return ((data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      action: String(row.action || ''),
      userId: String(row.user_id || ''),
      userEmail: String(row.user_email || ''),
      resourceType: String(row.resource_type || ''),
      resourceId: typeof row.resource_id === 'string' ? row.resource_id : undefined,
      details: (row.details as Record<string, unknown> | null) || undefined,
      timestamp: String(row.timestamp || ''),
    }));
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
