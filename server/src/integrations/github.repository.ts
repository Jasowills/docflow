import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../database/supabase.providers';
import type { GithubConnectionStatus } from '@docflow/shared';

interface GithubConnectionRow {
  user_id: string;
  provider: 'manual-token' | 'oauth';
  github_username: string | null;
  access_token: string;
  connected_at_utc: string;
}

@Injectable()
export class GithubRepository {
  private readonly logger = new Logger(GithubRepository.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async upsertConnection(
    userId: string,
    provider: 'manual-token' | 'oauth',
    accessToken: string,
    username: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase.from('github_connections').upsert(
      {
        user_id: userId,
        provider,
        github_username: username,
        access_token: accessToken,
        connected_at_utc: now,
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      this.logger.error(`Failed to save GitHub connection for ${userId}: ${error.message}`);
      throw new Error('Failed to save GitHub connection.');
    }
  }

  async findConnectionByUserId(userId: string): Promise<GithubConnectionRow | null> {
    const { data, error } = await this.supabase
      .from('github_connections')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to load GitHub connection for ${userId}: ${error.message}`);
      throw new Error('Failed to load GitHub connection.');
    }

    return (data as GithubConnectionRow | null) ?? null;
  }

  async deleteConnection(userId: string): Promise<void> {
    const { error } = await this.supabase.from('github_connections').delete().eq('user_id', userId);
    if (error) {
      this.logger.error(`Failed to delete GitHub connection for ${userId}: ${error.message}`);
      throw new Error('Failed to delete GitHub connection.');
    }
  }

  toStatus(row: GithubConnectionRow | null): GithubConnectionStatus {
    if (!row) {
      return {
        connected: false,
        provider: null,
      };
    }

    return {
      connected: true,
      provider: row.provider,
      username: row.github_username || undefined,
      connectedAtUtc: row.connected_at_utc,
    };
  }
}
