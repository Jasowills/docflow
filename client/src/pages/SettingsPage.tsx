import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FolderGit2,
  LayoutGrid,
  Settings2,
  SlidersHorizontal,
  UserCircle2,
  Users,
} from "lucide-react";
import type {
  GithubRepoSelection,
  GithubRepositorySummary,
  SystemConfig,
  WorkspaceDetails,
} from "@docflow/shared";
import { useApi } from "../hooks/use-api";
import { useAuth } from "../auth/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Spinner } from "../components/ui/spinner";

type SettingsSection =
  | "workspace"
  | "members"
  | "github"
  | "profile"
  | "preferences"
  | "configuration";

const settingsSections: Array<{
  key: SettingsSection;
  label: string;
  icon: typeof Settings2;
}> = [
  { key: "workspace", label: "Workspace", icon: LayoutGrid },
  { key: "members", label: "Members", icon: Users },
  { key: "github", label: "GitHub", icon: FolderGit2 },
  { key: "profile", label: "Profile", icon: UserCircle2 },
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { key: "configuration", label: "Configuration", icon: Settings2 },
];

export function SettingsPage() {
  const { user } = useAuth();
  const {
    getCurrentWorkspace,
    updateCurrentWorkspace,
    inviteWorkspaceMember,
    updateWorkspaceMemberRole,
    revokeWorkspaceInvitation,
    getGithubStatus,
    getGithubInstallUrl,
    listGithubRepos,
    listSelectedGithubRepos,
    updateSelectedGithubRepos,
    getConfig,
  } = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
  const [githubStatus, setGithubStatus] = useState<Awaited<ReturnType<typeof getGithubStatus>> | null>(null);
  const [repos, setRepos] = useState<GithubRepositorySummary[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<GithubRepoSelection[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [loading, setLoading] = useState(true);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingRepos, setSavingRepos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const section = (searchParams.get("section") as SettingsSection) || "workspace";
  const canManageWorkspace = !!user?.roles?.some((role) => role === "owner" || role === "admin");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workspaceResponse, githubResponse, selectedReposResponse, configResponse] =
        await Promise.all([
          getCurrentWorkspace(),
          getGithubStatus(),
          listSelectedGithubRepos(),
          getConfig().catch(() => null),
        ]);
      setWorkspace(workspaceResponse);
      setWorkspaceName(workspaceResponse.name);
      setGithubStatus(githubResponse);
      setSelectedRepos(selectedReposResponse);
      setConfig(configResponse);

      if (githubResponse.connected) {
        setRepos(await listGithubRepos());
      } else {
        setRepos([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }, [
    getConfig,
    getCurrentWorkspace,
    getGithubStatus,
    listGithubRepos,
    listSelectedGithubRepos,
  ]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const selectedRepoIds = useMemo(
    () => new Set(selectedRepos.map((repo) => repo.repositoryId)),
    [selectedRepos],
  );

  const toggleRepoSelection = (repo: GithubRepositorySummary) => {
    setSelectedRepos((current) => {
      if (current.some((item) => item.repositoryId === repo.id)) {
        return current.filter((item) => item.repositoryId !== repo.id);
      }

      return [
        ...current,
        {
          repositoryId: repo.id,
          fullName: repo.fullName,
          ownerLogin: repo.ownerLogin,
          defaultBranch: repo.defaultBranch,
          private: repo.private,
          htmlUrl: repo.htmlUrl,
        },
      ];
    });
  };

  const handleSaveWorkspace = async () => {
    setSavingWorkspace(true);
    setError(null);
    try {
      const updated = (await updateCurrentWorkspace({
        name: workspaceName.trim(),
      })) as WorkspaceDetails;
      setWorkspace((current) =>
        current ? { ...current, ...updated, name: updated.name } : current,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update workspace.");
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleConnectGithub = async () => {
    setError(null);
    try {
      const { installUrl } = await getGithubInstallUrl();
      window.location.assign(installUrl);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Unable to connect GitHub App.");
    }
  };

  const handleSaveRepos = async () => {
    setSavingRepos(true);
    setError(null);
    try {
      const updated = await updateSelectedGithubRepos({ repositories: selectedRepos });
      setSelectedRepos(updated);
      setGithubStatus(await getGithubStatus());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save selected repositories.");
    } finally {
      setSavingRepos(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setError("Invite email is required.");
      return;
    }
    try {
      const invitation = await inviteWorkspaceMember({ email: inviteEmail.trim(), role: inviteRole });
      setWorkspace((current) =>
        current ? { ...current, invitations: [invitation, ...current.invitations] } : current,
      );
      setInviteEmail("");
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to invite member.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="app-page-header">
        <div>
          <p className="app-page-eyebrow">Settings</p>
          <h1 className="app-page-title">Workspace settings</h1>
          <p className="app-page-copy">
            Manage workspace structure, teammates, GitHub access, profile details, and system preferences from one surface.
          </p>
        </div>
        {loading ? <Spinner className="text-primary" /> : null}
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="app-settings-shell">
        <aside className="app-settings-nav">
          {settingsSections.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                data-active={active}
                onClick={() => setSearchParams({ section: item.key })}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {active ? <Badge variant="secondary">Current</Badge> : null}
              </button>
            );
          })}
        </aside>

        <div className="space-y-6">
          {section === "workspace" ? (
            <Card>
              <CardHeader>
                <CardTitle>Workspace</CardTitle>
                <CardDescription>Workspace identity and operational summary.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Workspace name</Label>
                    <Input
                      id="workspace-name"
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      disabled={!canManageWorkspace}
                    />
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <span>Account type: {workspace?.accountType || "Unknown"}</span>
                    <span>Members: {workspace?.members.length || 0}</span>
                    <span>Invitations: {workspace?.invitations.length || 0}</span>
                  </div>
                </div>
                {canManageWorkspace ? (
                  <Button onClick={() => void handleSaveWorkspace()} disabled={savingWorkspace}>
                    {savingWorkspace ? "Saving..." : "Save workspace"}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {section === "members" ? (
            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>Invite teammates and manage workspace roles.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {canManageWorkspace ? (
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_auto]">
                    <Input
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                    <select
                      className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value as "admin" | "editor" | "viewer")}
                    >
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                      <option value="admin">admin</option>
                    </select>
                    <Button onClick={() => void handleInvite()}>Invite member</Button>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {(workspace?.members || []).map((member) => (
                    <div
                      key={member.userId}
                      className="rounded-2xl border border-border/80 bg-background/55 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{member.displayName}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{member.role}</Badge>
                          {canManageWorkspace && member.role !== "owner" ? (
                            <select
                              className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                              value={member.role}
                              onChange={(event) =>
                                void updateWorkspaceMemberRole(member.userId, {
                                  role: event.target.value as "owner" | "admin" | "editor" | "viewer",
                                }).then(() => void loadPage())
                              }
                            >
                              <option value="admin">admin</option>
                              <option value="editor">editor</option>
                              <option value="viewer">viewer</option>
                            </select>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Pending invitations</h3>
                  {(workspace?.invitations || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No invitations yet.</p>
                  ) : (
                    workspace?.invitations.map((invite) => (
                      <div
                        key={invite.invitationId}
                        className="rounded-2xl border border-border/80 bg-background/55 px-4 py-3"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{invite.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {invite.role} · {invite.status}
                            </p>
                          </div>
                          {canManageWorkspace && invite.status === "pending" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void revokeWorkspaceInvitation(invite.invitationId).then(() => void loadPage())}
                            >
                              Revoke
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {section === "github" ? (
            <Card>
              <CardHeader>
                <CardTitle>GitHub</CardTitle>
                <CardDescription>Authorize the DocFlow GitHub App and control workspace repository access.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={githubStatus?.connected ? "secondary" : "outline"}>
                    {githubStatus?.connected ? "GitHub App connected" : "GitHub App not connected"}
                  </Badge>
                  {githubStatus?.username ? <Badge variant="outline">@{githubStatus.username}</Badge> : null}
                  {githubStatus?.installationId ? (
                    <Badge variant="outline">Installation #{githubStatus.installationId}</Badge>
                  ) : null}
                </div>

                {!githubStatus?.connected ? (
                  <div className="context-help-card">
                    <p className="text-sm text-muted-foreground">
                      Connect the DocFlow GitHub App to authorize repository access for the entire workspace. Personal access tokens are not part of the product flow.
                    </p>
                    <Button className="mt-4" onClick={() => void handleConnectGithub()}>
                      Connect GitHub App
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-border/80 bg-background/55 px-4 py-4">
                      <p className="text-sm font-medium text-foreground">Accessible repositories</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Select which repositories should be considered active for planning and future automation.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {repos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No repositories returned for this installation yet.</p>
                      ) : (
                        repos.map((repo) => {
                          const selected = selectedRepoIds.has(repo.id);
                          return (
                            <button
                              key={repo.id}
                              type="button"
                              className={`flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition ${
                                selected
                                  ? "border-primary/40 bg-accent/65"
                                  : "border-border/80 bg-background/55 hover:bg-accent/45"
                              }`}
                              onClick={() => toggleRepoSelection(repo)}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-foreground">{repo.fullName}</span>
                                <Badge variant={selected ? "secondary" : "outline"}>
                                  {selected ? "Selected" : repo.private ? "Private" : "Public"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Default branch: {repo.defaultBranch || "Not reported"}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => void handleSaveRepos()} disabled={savingRepos}>
                        {savingRepos ? "Saving..." : "Save selected repos"}
                      </Button>
                      <a
                        href="https://github.com/apps"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-input px-4 text-sm font-medium text-foreground transition hover:bg-accent sm:w-auto"
                      >
                        Manage installation in GitHub
                      </a>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {section === "profile" ? (
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Current identity and workspace context.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <ProfileField label="Name" value={user?.displayName || "Unknown"} />
                <ProfileField label="Email" value={user?.email || "Unknown"} />
                <ProfileField label="Account type" value={user?.accountType || "Unknown"} />
                <ProfileField label="Workspace" value={user?.workspaceName || "Unknown"} />
              </CardContent>
            </Card>
          ) : null}

          {section === "preferences" ? (
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>Operational defaults and contextual help.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                  <p className="text-sm font-medium text-foreground">Theme</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    DocFlow now uses a unified dark black/green workspace theme.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                  <p className="text-sm font-medium text-foreground">Extension guidance</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Setup help now appears contextually in Recordings rather than as a permanent nav page.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {section === "configuration" ? (
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Admin-level generation templates and folders.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                  <p className="text-sm text-muted-foreground">
                    Document types: {config?.documentTypes.length || 0} · Folder configs: {config?.folderConfigs.length || 0}
                  </p>
                </div>
                <Link to="/app/admin/config" className="block sm:inline-block">
                  <Button variant="outline" className="w-full sm:w-auto">Open advanced configuration</Button>
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
