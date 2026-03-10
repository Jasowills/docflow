export interface AuthProviderConfig {
  primaryProvider: 'jwt' | 'logto';
  logtoEnabled: boolean;
  githubSignInEnabled: boolean;
  logtoSignInUrl?: string;
  logtoGithubSignInUrl?: string;
}

export interface GithubConnectionStatus {
  connected: boolean;
  provider: 'manual-token' | 'oauth' | null;
  username?: string;
  connectedAtUtc?: string;
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
