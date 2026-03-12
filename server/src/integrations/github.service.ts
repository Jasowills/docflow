import { BadRequestException, Injectable } from '@nestjs/common';
import { SignJWT } from 'jose';
import { createPrivateKey } from 'node:crypto';
import type {
  ConnectGithubRequest,
  GithubConnectionStatus,
  GithubInstallUrlResponse,
  GithubRepoSelection,
  GithubRepositorySummary,
  UpdateGithubRepoSelectionsRequest,
} from '@docflow/shared';
import { AppConfig } from '../config/app-config';
import { GithubRepository } from './github.repository';

@Injectable()
export class GithubService {
  private static readonly installCookieName = 'docflow_github_install';

  constructor(
    private readonly repository: GithubRepository,
    private readonly config: AppConfig,
  ) {}

  async getStatus(userId: string, workspaceId?: string): Promise<GithubConnectionStatus> {
    if (workspaceId) {
      const workspaceStatus = await this.repository.getWorkspaceGithubStatus(workspaceId);
      if (workspaceStatus.connected) {
        const repos = await this.listRepositories(userId, workspaceId);
        return {
          ...workspaceStatus,
          repoCount: repos.length,
        };
      }
    }

    const connection = await this.repository.findConnectionByUserId(userId);
    return this.repository.toStatus(connection);
  }

  async getInstallUrl(userId: string, workspaceId?: string): Promise<GithubInstallUrlResponse> {
    if (!workspaceId) {
      throw new BadRequestException('A workspace is required.');
    }
    if (!this.config.githubAppSlug) {
      throw new BadRequestException('GitHub App is not configured.');
    }

    const state = await this.createGithubStateToken(userId, workspaceId);
    return {
      installUrl: `${this.config.docflowApiBaseUrl.replace(/\/+$/, '')}/api/integrations/github/app/install?token=${encodeURIComponent(state)}`,
    };
  }

  async beginAppInstall(token?: string): Promise<{
    installUrl: string;
    cookieValue: string;
    cookieName: string;
  }> {
    if (!token) {
      throw new BadRequestException('Missing GitHub app install token.');
    }
    if (!this.config.githubAppSlug) {
      throw new BadRequestException('GitHub App is not configured.');
    }

    await this.verifyGithubStateToken(token);
    return {
      installUrl: `https://github.com/apps/${this.config.githubAppSlug}/installations/new?state=${encodeURIComponent(token)}`,
      cookieValue: token,
      cookieName: GithubService.installCookieName,
    };
  }

  async handleAppCallback(input: {
    installationId?: number;
    setupAction?: string;
    state?: string;
    cookieState?: string;
  }): Promise<string> {
    const stateToken = input.state || input.cookieState;
    if (!stateToken) {
      throw new BadRequestException('Missing GitHub app state.');
    }

    const payload = await this.verifyGithubStateToken(stateToken);
    if (!payload.workspaceId || !input.installationId) {
      throw new BadRequestException('Missing GitHub installation details.');
    }

    const installationMeta = await this.getInstallationMetadata(input.installationId);
    await this.repository.setWorkspaceInstallation(
      payload.workspaceId,
      input.installationId,
      installationMeta.accountLogin,
    );

    return `${this.config.docflowWebBaseUrl.replace(/\/+$/, '')}/app/settings?section=github&github=connected&installation_id=${input.installationId}&setup_action=${encodeURIComponent(input.setupAction || 'install')}`;
  }

  getGithubSettingsRedirectUrl(status: 'connected' | 'error'): string {
    return `${this.config.docflowWebBaseUrl.replace(/\/+$/, '')}/app/settings?section=github&github=${status}`;
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
      mode: 'user-token',
    };
  }

  async disconnect(userId: string, workspaceId?: string): Promise<void> {
    if (workspaceId) {
      const workspaceStatus = await this.repository.getWorkspaceGithubStatus(workspaceId);
      if (workspaceStatus.connected && workspaceStatus.provider === 'github-app') {
        await this.repository.setWorkspaceInstallation(workspaceId, null, null);
        await this.repository.replaceSelectedRepos(workspaceId, []);
        return;
      }
    }

    await this.repository.deleteConnection(userId);
  }

  async listRepositories(userId: string, workspaceId?: string): Promise<GithubRepositorySummary[]> {
    if (workspaceId) {
      const workspaceStatus = await this.repository.getWorkspaceGithubStatus(workspaceId);
      if (workspaceStatus.connected && workspaceStatus.installationId) {
        return this.listInstallationRepositories(workspaceStatus.installationId);
      }
    }

    const connection = await this.repository.findConnectionByUserId(userId);
    if (!connection) {
      return [];
    }

    return listUserRepositories(connection.access_token);
  }

  async listSelectedRepositories(workspaceId?: string): Promise<GithubRepoSelection[]> {
    if (!workspaceId) {
      return [];
    }
    return this.repository.listSelectedRepos(workspaceId);
  }

  async updateSelectedRepositories(
    workspaceId: string | undefined,
    request: UpdateGithubRepoSelectionsRequest,
  ): Promise<GithubRepoSelection[]> {
    if (!workspaceId) {
      throw new BadRequestException('A workspace is required.');
    }

    await this.repository.replaceSelectedRepos(workspaceId, request.repositories);
    return this.repository.listSelectedRepos(workspaceId);
  }

  private async listInstallationRepositories(
    installationId: number,
  ): Promise<GithubRepositorySummary[]> {
    const accessToken = await this.createInstallationAccessToken(installationId);
    const response = await fetch(`https://api.github.com/installation/repositories?per_page=100`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DocFlow',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub installation repository listing failed (${response.status}).`);
    }

    const payload = (await response.json()) as { repositories?: Array<Record<string, unknown>> };
    return (payload.repositories || []).map(mapGithubRepo);
  }

  private async getInstallationMetadata(
    installationId: number,
  ): Promise<{ accountLogin?: string }> {
    const appJwt = await this.createGithubAppJwt();
    const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DocFlow',
      },
    });

    if (!response.ok) {
      return {};
    }

    const payload = (await response.json()) as {
      account?: { login?: string };
    };
    return {
      accountLogin: payload.account?.login,
    };
  }

  private async createInstallationAccessToken(installationId: number): Promise<string> {
    const appJwt = await this.createGithubAppJwt();
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'DocFlow',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub App installation token failed (${response.status}).`);
    }

    const payload = (await response.json()) as { token?: string };
    if (!payload.token) {
      throw new Error('GitHub App token response did not include a token.');
    }
    return payload.token;
  }

  private async createGithubAppJwt(): Promise<string> {
    if (!this.config.githubAppId || !this.config.githubAppPrivateKey) {
      throw new BadRequestException('GitHub App credentials are not configured.');
    }

    const normalizedKey = this.config.githubAppPrivateKey.replace(/\\n/g, '\n');
    const key = createPrivateKey(normalizedKey);
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt(now - 60)
      .setIssuer(this.config.githubAppId)
      .setExpirationTime(now + 9 * 60)
      .sign(key);
  }

  private async createGithubStateToken(userId: string, workspaceId: string): Promise<string> {
    return new SignJWT({
      userId,
      workspaceId,
      type: 'github-install-state',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(this.config.jwtAccessTokenSecret));
  }

  private async verifyGithubStateToken(
    token: string,
  ): Promise<{ userId?: string; workspaceId?: string }> {
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(this.config.jwtAccessTokenSecret),
      {
        algorithms: ['HS256'],
      },
    );

    return {
      userId: typeof payload.userId === 'string' ? payload.userId : undefined,
      workspaceId: typeof payload.workspaceId === 'string' ? payload.workspaceId : undefined,
    };
  }

  getInstallCookieName(): string {
    return GithubService.installCookieName;
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

async function listUserRepositories(accessToken: string): Promise<GithubRepositorySummary[]> {
  const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'DocFlow',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub repository listing failed (${response.status}).`);
  }

  const repos = (await response.json()) as Array<Record<string, unknown>>;
  return repos.map(mapGithubRepo);
}

function mapGithubRepo(repo: Record<string, unknown>): GithubRepositorySummary {
  return {
    id: String(repo.id || ''),
    name: String(repo.name || ''),
    fullName: String(repo.full_name || ''),
    private: Boolean(repo.private),
    defaultBranch: typeof repo.default_branch === 'string' ? repo.default_branch : undefined,
    htmlUrl: String(repo.html_url || ''),
    ownerLogin:
      typeof repo.owner === 'object' &&
      repo.owner &&
      typeof (repo.owner as Record<string, unknown>).login === 'string'
        ? String((repo.owner as Record<string, unknown>).login)
        : '',
  };
}
