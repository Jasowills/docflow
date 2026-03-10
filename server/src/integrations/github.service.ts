import { Injectable } from '@nestjs/common';
import type {
  ConnectGithubRequest,
  GithubConnectionStatus,
  GithubRepositorySummary,
} from '@docflow/shared';
import { GithubRepository } from './github.repository';

@Injectable()
export class GithubService {
  constructor(private readonly repository: GithubRepository) {}

  async getStatus(userId: string): Promise<GithubConnectionStatus> {
    const connection = await this.repository.findConnectionByUserId(userId);
    return this.repository.toStatus(connection);
  }

  async connect(userId: string, request: ConnectGithubRequest): Promise<GithubConnectionStatus> {
    const profile = await fetchGithubProfile(request.accessToken);
    await this.repository.upsertConnection(
      userId,
      request.provider || 'manual-token',
      request.accessToken,
      profile.login,
    );
    return {
      connected: true,
      provider: request.provider || 'manual-token',
      username: profile.login,
      connectedAtUtc: new Date().toISOString(),
    };
  }

  async disconnect(userId: string): Promise<void> {
    await this.repository.deleteConnection(userId);
  }

  async listRepositories(userId: string): Promise<GithubRepositorySummary[]> {
    const connection = await this.repository.findConnectionByUserId(userId);
    if (!connection) {
      return [];
    }

    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DocFlow',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub repository listing failed (${response.status}).`);
    }

    const repos = (await response.json()) as Array<Record<string, unknown>>;
    return repos.map((repo) => ({
      id: String(repo.id),
      name: String(repo.name || ''),
      fullName: String(repo.full_name || ''),
      private: Boolean(repo.private),
      defaultBranch: typeof repo.default_branch === 'string' ? repo.default_branch : undefined,
      htmlUrl: String(repo.html_url || ''),
      ownerLogin:
        typeof repo.owner === 'object' && repo.owner && typeof (repo.owner as Record<string, unknown>).login === 'string'
          ? String((repo.owner as Record<string, unknown>).login)
          : '',
    }));
  }
}

async function fetchGithubProfile(accessToken: string): Promise<{ login: string }> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'DocFlow',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub connection failed (${response.status}).`);
  }

  const profile = (await response.json()) as { login?: string };
  if (!profile.login) {
    throw new Error('GitHub profile did not include a username.');
  }
  return { login: profile.login };
}
