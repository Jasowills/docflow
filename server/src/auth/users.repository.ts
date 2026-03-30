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
      throw mapSupabaseUserError(error.message, 'load user');
    }

    return data ? this.mapRow(data as Record<string, unknown>) : null;
  }

  async findByExternalIdentity(
    provider: AuthUserRecord['externalProvider'],
    externalSubject: string,
  ): Promise<AuthUserRecord | null> {
    const { data, error } = await retrySupabaseRead(() =>
      this.supabase
        .from('docflow_users')
        .select('*')
        .eq('external_provider', provider)
        .eq('external_subject', externalSubject)
        .maybeSingle(),
    );

    if (error) {
      this.logger.error(`Failed to find user by external identity: ${error.message}`);
      throw mapSupabaseUserError(error.message, 'load user');
    }

    return data ? this.mapRow(data) : null;
  }

  async findByUserId(userId: string): Promise<AuthUserRecord | null> {
    const { data, error } = await retrySupabaseRead(() =>
      this.supabase
        .from('docflow_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
    );

    if (error) {
      this.logger.error(`Failed to find user by userId: ${error.message}`);
      throw mapSupabaseUserError(error.message, 'load user');
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
      onboarding_completed_at: user.onboardingCompletedAt || null,
      onboarding_state: user.onboardingState || {},
    });

    if (error) {
      this.logger.error(`Failed to insert user ${user.email}: ${error.message}`);
      throw mapSupabaseUserError(error.message, 'create user');
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
      throw mapSupabaseUserError(error.message, 'update user login timestamp');
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
      throw mapSupabaseUserError(error.message, 'link user identity');
    }
  }

  async updateOnboarding(
    userId: string,
    updates: {
      onboardingCompletedAt?: string | null;
      onboardingState?: Record<string, unknown>;
    },
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if ('onboardingCompletedAt' in updates) {
      payload.onboarding_completed_at = updates.onboardingCompletedAt ?? null;
    }
    if ('onboardingState' in updates) {
      payload.onboarding_state = updates.onboardingState ?? {};
    }

    const { error } = await this.supabase
      .from('docflow_users')
      .update(payload)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to update onboarding for ${userId}: ${error.message}`);
      throw mapSupabaseUserError(error.message, 'update onboarding');
    }
  }

  async updateProfile(
    userId: string,
    updates: {
      email?: string;
      displayName?: string;
      externalProvider?: AuthUserRecord['externalProvider'];
      externalSubject?: string;
    },
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.email) payload.email = updates.email.trim().toLowerCase();
    if (updates.displayName) payload.display_name = updates.displayName.trim();
    if ('externalProvider' in updates) {
      payload.external_provider = updates.externalProvider ?? null;
    }
    if ('externalSubject' in updates) {
      payload.external_subject = updates.externalSubject ?? null;
    }

    const { error } = await this.supabase
      .from('docflow_users')
      .update(payload)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to update profile for ${userId}: ${error.message}`);
      throw mapSupabaseUserError(error.message, 'update user profile');
    }
  }

  async updateAccountSetup(
    userId: string,
    updates: {
      accountType: 'individual' | 'team';
      teamName?: string;
    },
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      account_type: updates.accountType,
      team_name: updates.accountType === 'team' ? (updates.teamName?.trim() || null) : null,
    };

    const { error } = await this.supabase
      .from('docflow_users')
      .update(payload)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to update account setup for ${userId}: ${error.message}`);
      throw mapSupabaseUserError(error.message, 'update account setup');
    }
  }

  private mapRow(row: Record<string, unknown>): AuthUserRecord {
    return {
      userId: String(row.user_id || ''),
      email: String(row.email || ''),
      displayName: String(row.display_name || ''),
      passwordHash: typeof row.password_hash === 'string' ? row.password_hash : undefined,
      externalProvider:
        row.external_provider === 'logto' || row.external_provider === 'google' ? row.external_provider : undefined,
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
      onboardingCompletedAt:
        typeof row.onboarding_completed_at === 'string' ? row.onboarding_completed_at : undefined,
      onboardingState:
        row.onboarding_state && typeof row.onboarding_state === 'object'
          ? (row.onboarding_state as Record<string, unknown>)
          : {},
    };
  }
}

function mapSupabaseUserError(message: string, action: string): Error {
  if (message.includes("Could not find the table 'public.docflow_users'")) {
    return new Error(
      "Supabase schema is missing. Run docs/supabase-schema.sql so DocFlow can create and load users.",
    );
  }

  return new Error(`Failed to ${action}.`);
}

async function retrySupabaseRead<T>(
  operation: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<{ data: T | null; error: { message: string } | null }> {
  const first = await Promise.resolve(operation());
  if (!first.error || !first.error.message.toLowerCase().includes('fetch failed')) {
    return first;
  }

  await new Promise((resolve) => setTimeout(resolve, 250));
  return Promise.resolve(operation());
}
