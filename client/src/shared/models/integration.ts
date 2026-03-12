export interface AuthProviderConfig {
  primaryProvider: 'jwt' | 'logto';
  logtoEnabled: boolean;
  githubSignInEnabled: boolean;
  logtoSignInUrl?: string;
  logtoGithubSignInUrl?: string;
  logtoGithubIdpName?: string;
}

export interface GithubConnectionStatus {
  connected: boolean;
  provider: 'manual-token' | 'oauth' | 'github-app' | null;
  username?: string;
  connectedAtUtc?: string;
  installationId?: number;
  installUrl?: string;
  repoCount?: number;
  selectedRepoCount?: number;
  mode?: 'workspace-app' | 'user-token';
}

export interface GithubRepositorySummary {
  id: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch?: string;
  htmlUrl: string;
  ownerLogin: string;
}

export interface ConnectGithubRequest {
  accessToken: string;
  provider?: 'manual-token' | 'oauth';
}

export interface GithubInstallUrlResponse {
  installUrl: string;
}

export interface GithubRepoSelection {
  repositoryId: string;
  fullName: string;
  ownerLogin: string;
  defaultBranch?: string;
  private: boolean;
  htmlUrl: string;
}

export interface UpdateGithubRepoSelectionsRequest {
  repositories: GithubRepoSelection[];
}
