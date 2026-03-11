import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../database/supabase.providers';
import type { GithubConnectionStatus, GithubRepoSelection } from '@docflow/shared';
import { WorkspacesRepository } from '../auth/workspaces.repository';

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
    private readonly workspacesRepository: WorkspacesRepository,
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

  async getWorkspaceGithubStatus(workspaceId: string): Promise<GithubConnectionStatus> {
    const workspace = await this.workspacesRepository.findSummaryById(workspaceId);
    if (!workspace?.githubInstallationId) {
      return {
        connected: false,
        provider: null,
      };
    }

    const selectedRepoCount = await this.countSelectedRepos(workspaceId);
    return {
      connected: true,
      provider: 'github-app',
      installationId: workspace.githubInstallationId,
      connectedAtUtc: workspace.githubConnectedAtUtc,
      username: workspace.githubAccountLogin,
      selectedRepoCount,
      mode: 'workspace-app',
    };
  }

  async setWorkspaceInstallation(
    workspaceId: string,
    installationId: number | null,
    accountLogin?: string | null,
  ): Promise<void> {
    await this.workspacesRepository.setGithubInstallation(workspaceId, {
      installationId,
      connectedAtUtc: installationId ? new Date().toISOString() : null,
      accountLogin: accountLogin ?? null,
    });
  }

  async replaceSelectedRepos(
    workspaceId: string,
    repositories: GithubRepoSelection[],
  ): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('workspace_repo_selections')
      .delete()
      .eq('workspace_id', workspaceId);

    if (deleteError) {
      this.logger.error(`Failed to reset selected repos for ${workspaceId}: ${deleteError.message}`);
      throw new Error('Failed to update selected repositories.');
    }

    if (repositories.length === 0) {
      return;
    }

    const { error } = await this.supabase.from('workspace_repo_selections').insert(
      repositories.map((repository) => ({
        workspace_id: workspaceId,
        repository_id: repository.repositoryId,
        full_name: repository.fullName,
        owner_login: repository.ownerLogin,
        default_branch: repository.defaultBranch || null,
        private: repository.private,
        html_url: repository.htmlUrl,
      })),
    );

    if (error) {
      this.logger.error(`Failed to save selected repos for ${workspaceId}: ${error.message}`);
      throw new Error('Failed to update selected repositories.');
    }
  }

  async listSelectedRepos(workspaceId: string): Promise<GithubRepoSelection[]> {
    const { data, error } = await this.supabase
      .from('workspace_repo_selections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('full_name', { ascending: true });

    if (error) {
      this.logger.error(`Failed to load selected repos for ${workspaceId}: ${error.message}`);
      throw new Error('Failed to load selected repositories.');
    }

    return ((data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      repositoryId: String(row.repository_id || ''),
      fullName: String(row.full_name || ''),
      ownerLogin: String(row.owner_login || ''),
      defaultBranch:
        typeof row.default_branch === 'string' ? row.default_branch : undefined,
      private: Boolean(row.private),
      htmlUrl: String(row.html_url || ''),
    }));
  }

  async countSelectedRepos(workspaceId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('workspace_repo_selections')
      .select('repository_id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (error) {
      this.logger.error(`Failed to count selected repos for ${workspaceId}: ${error.message}`);
      throw new Error('Failed to load selected repositories.');
    }

    return count || 0;
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
