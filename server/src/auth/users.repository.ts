import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../database/supabase.providers';
import type { AuthUserRecord } from './auth.types';

@Injectable()
export class UsersRepository {
  private readonly logger = new Logger(UsersRepository.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const { data, error } = await this.supabase
      .from('docflow_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to find user by email: ${error.message}`);
      throw new Error('Failed to load user.');
    }

    return data ? this.mapRow(data) : null;
  }

  async findByExternalIdentity(
    provider: AuthUserRecord['externalProvider'],
    externalSubject: string,
  ): Promise<AuthUserRecord | null> {
    const { data, error } = await this.supabase
      .from('docflow_users')
      .select('*')
      .eq('external_provider', provider)
      .eq('external_subject', externalSubject)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to find user by external identity: ${error.message}`);
      throw new Error('Failed to load user.');
    }

    return data ? this.mapRow(data) : null;
  }

  async findByUserId(userId: string): Promise<AuthUserRecord | null> {
    const { data, error } = await this.supabase
      .from('docflow_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to find user by userId: ${error.message}`);
      throw new Error('Failed to load user.');
    }

    return data ? this.mapRow(data) : null;
  }

  async insert(user: AuthUserRecord): Promise<AuthUserRecord> {
    const { error } = await this.supabase.from('docflow_users').insert({
      user_id: user.userId,
      email: user.email,
      display_name: user.displayName,
      password_hash: user.passwordHash || null,
      external_provider: user.externalProvider || null,
      external_subject: user.externalSubject || null,
      account_type: user.accountType,
      team_name: user.teamName || null,
      default_workspace_id: user.defaultWorkspaceId || null,
      created_at_utc: user.createdAtUtc,
      last_login_at_utc: user.lastLoginAtUtc || null,
    });

    if (error) {
      this.logger.error(`Failed to insert user ${user.email}: ${error.message}`);
      throw new Error('Failed to create user.');
    }
    return user;
  }

  async updateLastLogin(userId: string, timestamp: string): Promise<void> {
    const { error } = await this.supabase
      .from('docflow_users')
      .update({ last_login_at_utc: timestamp })
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to update last login for ${userId}: ${error.message}`);
      throw new Error('Failed to update user login timestamp.');
    }
  }

  async linkExternalIdentity(
    userId: string,
    provider: AuthUserRecord['externalProvider'],
    externalSubject: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('docflow_users')
      .update({
        external_provider: provider,
        external_subject: externalSubject,
      })
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to link external identity for ${userId}: ${error.message}`);
      throw new Error('Failed to link user identity.');
    }
  }

  private mapRow(row: Record<string, unknown>): AuthUserRecord {
    return {
      userId: String(row.user_id || ''),
      email: String(row.email || ''),
      displayName: String(row.display_name || ''),
      passwordHash: typeof row.password_hash === 'string' ? row.password_hash : undefined,
      externalProvider:
        row.external_provider === 'logto' ? 'logto' : undefined,
      externalSubject:
        typeof row.external_subject === 'string' ? row.external_subject : undefined,
      accountType: (row.account_type as AuthUserRecord['accountType']) || 'individual',
      teamName: typeof row.team_name === 'string' ? row.team_name : undefined,
      defaultWorkspaceId:
        typeof row.default_workspace_id === 'string' ? row.default_workspace_id : undefined,
      roles: row.account_type === 'team' ? ['owner'] : ['member'],
      createdAtUtc: String(row.created_at_utc || ''),
      lastLoginAtUtc:
        typeof row.last_login_at_utc === 'string' ? row.last_login_at_utc : undefined,
    };
  }
}
