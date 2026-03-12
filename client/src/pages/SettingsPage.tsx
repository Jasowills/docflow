import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  LayoutGrid,
  Settings2,
  SlidersHorizontal,
  UserCircle2,
  Users,
} from "lucide-react";
import type {
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
  { key: "profile", label: "Profile", icon: UserCircle2 },
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { key: "configuration", label: "Configuration", icon: Settings2 },
];

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const {
    getCurrentWorkspace,
    updateCurrentWorkspace,
    inviteWorkspaceMember,
    updateWorkspaceMemberRole,
    revokeWorkspaceInvitation,
    getConfig,
  } = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [loading, setLoading] = useState(true);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestedSection = searchParams.get("section") as SettingsSection | null;
  const section = settingsSections.some((item) => item.key === requestedSection)
    ? (requestedSection as SettingsSection)
    : "workspace";
  const canManageWorkspace = !!user?.roles?.some((role) => role === "owner" || role === "admin");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workspaceResponse, configResponse] =
        await Promise.all([
          getCurrentWorkspace(),
          getConfig().catch(() => null),
        ]);
      setWorkspace(workspaceResponse);
      setWorkspaceName(workspaceResponse.name);
      setConfig(configResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }, [getConfig, getCurrentWorkspace]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

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
      await refreshUser();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update workspace.");
    } finally {
      setSavingWorkspace(false);
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
            Manage workspace structure, teammates, profile details, and system preferences from one surface.
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
