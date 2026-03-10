import { useCallback, useEffect, useMemo, useState } from 'react';
import { Github, Link2, ShieldCheck, Unplug } from 'lucide-react';
import { useApi } from '../hooks/use-api';
import type { GithubConnectionStatus, GithubRepositorySummary } from '@docflow/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Spinner } from '../components/ui/spinner';

export function GithubPage() {
  const { getGithubStatus, connectGithub, disconnectGithub, listGithubRepos } = useApi();
  const [status, setStatus] = useState<GithubConnectionStatus | null>(null);
  const [repos, setRepos] = useState<GithubRepositorySummary[]>([]);
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGithub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStatus = await getGithubStatus();
      setStatus(nextStatus);
      if (nextStatus.connected) {
        setLoadingRepos(true);
        try {
          setRepos(await listGithubRepos());
        } finally {
          setLoadingRepos(false);
        }
      } else {
        setRepos([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load GitHub integration.');
    } finally {
      setLoading(false);
    }
  }, [getGithubStatus, listGithubRepos]);

  useEffect(() => {
    void loadGithub();
  }, [loadGithub]);

  const connectedRepoSummary = useMemo(() => {
    const privateCount = repos.filter((repo) => repo.private).length;
    return `${repos.length} repos${repos.length ? ` • ${privateCount} private` : ''}`;
  }, [repos]);

  const handleConnect = async () => {
    if (!accessToken.trim()) {
      setError('Enter a GitHub personal access token to connect.');
      return;
    }

    setConnecting(true);
    setError(null);
    try {
      const nextStatus = await connectGithub({
        accessToken: accessToken.trim(),
        provider: 'manual-token',
      });
      setStatus(nextStatus);
      setAccessToken('');
      setLoadingRepos(true);
      try {
        setRepos(await listGithubRepos());
      } finally {
        setLoadingRepos(false);
      }
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect GitHub.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnectGithub();
      setStatus({ connected: false, provider: null });
      setRepos([]);
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : 'Unable to disconnect GitHub.',
      );
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GitHub Integration</h1>
          <p className="text-muted-foreground mt-1">
            Connect your GitHub account to browse repositories and power repo-aware test plans.
          </p>
        </div>
        {loading ? <Spinner className="text-primary mt-1" /> : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Connection
            </CardTitle>
            <CardDescription>
              Start with a GitHub token now. GitHub App and richer OAuth setup will sit on top of this.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status?.connected ? 'secondary' : 'outline'}>
                {status?.connected ? 'Connected' : 'Not connected'}
              </Badge>
              {status?.username ? (
                <span className="text-sm text-muted-foreground">@{status.username}</span>
              ) : null}
            </div>

            {status?.connected ? (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-2">
                <div className="font-medium">Connection details</div>
                <p className="text-muted-foreground">
                  Provider: {status.provider === 'manual-token' ? 'Manual token' : status.provider || 'Unknown'}
                </p>
                {status.connectedAtUtc ? (
                  <p className="text-muted-foreground">
                    Connected {new Date(status.connectedAtUtc).toLocaleString()}
                  </p>
                ) : null}
                <p className="text-muted-foreground">{connectedRepoSummary}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="github-token">GitHub personal access token</Label>
                  <Input
                    id="github-token"
                    type="password"
                    placeholder="ghp_..."
                    value={accessToken}
                    onChange={(event) => setAccessToken(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use a token with repository read access for the repos you want to work with.
                  </p>
                </div>
                <Button onClick={() => void handleConnect()} disabled={connecting}>
                  <Github className="h-4 w-4 mr-2" />
                  {connecting ? 'Connecting...' : 'Connect GitHub'}
                </Button>
              </>
            )}

            {status?.connected ? (
              <Button variant="outline" onClick={() => void handleDisconnect()} disabled={disconnecting}>
                <Unplug className="h-4 w-4 mr-2" />
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Repositories
            </CardTitle>
            <CardDescription>
              Repositories available to the connected GitHub identity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!status?.connected ? (
              <p className="text-sm text-muted-foreground">
                Connect GitHub to browse repositories and attach them to test plans.
              </p>
            ) : loadingRepos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4 text-primary" />
                Loading repositories...
              </div>
            ) : repos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No repositories were returned for this account.
              </p>
            ) : (
              <div className="space-y-3">
                {repos.map((repo) => (
                  <div
                    key={repo.id}
                    className="flex flex-col gap-3 rounded-md border border-border/80 bg-background/60 p-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm">{repo.fullName}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Default branch: {repo.defaultBranch || 'Not reported'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={repo.private ? 'secondary' : 'outline'}>
                        {repo.private ? 'Private' : 'Public'}
                      </Badge>
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
