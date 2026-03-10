import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, Shield, MailPlus } from 'lucide-react';
import type { WorkspaceDetails, WorkspaceInvitation, WorkspaceMember } from '@docflow/shared';
import { useApi } from '../hooks/use-api';
import { useAuth } from '../auth/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Spinner } from '../components/ui/spinner';

const INVITABLE_ROLES: WorkspaceInvitation['role'][] = ['admin', 'editor', 'viewer'];
const MEMBER_ROLES: WorkspaceMember['role'][] = ['owner', 'admin', 'editor', 'viewer'];

export function WorkspacePage() {
  const { user } = useAuth();
  const {
    getCurrentWorkspace,
    inviteWorkspaceMember,
    updateWorkspaceMemberRole,
    revokeWorkspaceInvitation,
  } = useApi();
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceInvitation['role']>('viewer');
  const [loading, setLoading] = useState(true);
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const canManageWorkspace = useMemo(
    () => !!user?.roles?.some((role) => role === 'owner' || role === 'admin'),
    [user?.roles],
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkspace(await getCurrentWorkspace());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace.');
    } finally {
      setLoading(false);
    }
  }, [getCurrentWorkspace]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setError('Invite email is required.');
      return;
    }
    setSubmittingInvite(true);
    setError(null);
    try {
      const invitation = await inviteWorkspaceMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setWorkspace((previous) =>
        previous
          ? { ...previous, invitations: [invitation, ...previous.invitations] }
          : previous,
      );
      setInviteEmail('');
      setInviteRole('viewer');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to send invitation.');
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleRoleChange = async (member: WorkspaceMember, role: WorkspaceMember['role']) => {
    setBusyKey(`member:${member.userId}`);
    setError(null);
    try {
      await updateWorkspaceMemberRole(member.userId, { role });
      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              members: previous.members.map((item) =>
                item.userId === member.userId ? { ...item, role } : item,
              ),
            }
          : previous,
      );
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : 'Unable to update member role.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    setBusyKey(`invite:${invitationId}`);
    setError(null);
    try {
      await revokeWorkspaceInvitation(invitationId);
      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              invitations: previous.invitations.map((invite) =>
                invite.invitationId === invitationId ? { ...invite, status: 'revoked' } : invite,
              ),
            }
          : previous,
      );
    } catch (revokeError) {
      setError(
        revokeError instanceof Error ? revokeError.message : 'Unable to revoke invitation.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspace</h1>
          <p className="text-muted-foreground mt-1">
            Manage the current workspace, member roles, and invitations.
          </p>
        </div>
        {loading ? <Spinner className="text-primary mt-1" /> : null}
      </div>

      {workspace ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {workspace.name}
            </CardTitle>
            <CardDescription>
              {workspace.accountType === 'team'
                ? 'Team workspace'
                : 'Individual workspace'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">{workspace.accountType}</Badge>
            <Badge variant="outline">{workspace.members.length} members</Badge>
            <Badge variant="outline">{workspace.invitations.length} invitations</Badge>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MailPlus className="h-5 w-5" />
              Invite member
            </CardTitle>
            <CardDescription>
              Invite teammates into this workspace with the role they need.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canManageWorkspace ? (
              <p className="text-sm text-muted-foreground">
                You can view this workspace, but only owners and admins can invite members.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <select
                    id="invite-role"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value as WorkspaceInvitation['role'])
                    }
                  >
                    {INVITABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={() => void handleInvite()} disabled={submittingInvite}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {submittingInvite ? 'Sending invite...' : 'Invite member'}
                </Button>
              </>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Members & invitations
            </CardTitle>
            <CardDescription>
              Current members and outstanding invitations for this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Members</h2>
              {workspace?.members.length ? (
                workspace.members.map((member) => (
                  <div
                    key={member.userId}
                    className="rounded-md border border-border/80 bg-background/60 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm">{member.displayName}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canManageWorkspace ? (
                        <select
                          className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={member.role}
                          disabled={busyKey === `member:${member.userId}`}
                          onChange={(event) =>
                            void handleRoleChange(
                              member,
                              event.target.value as WorkspaceMember['role'],
                            )
                          }
                        >
                          {MEMBER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant="outline">{member.role}</Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No members found.</p>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Invitations</h2>
              {workspace?.invitations.length ? (
                workspace.invitations.map((invite) => (
                  <div
                    key={invite.invitationId}
                    className="rounded-md border border-border/80 bg-background/60 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm">{invite.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {invite.role} • {invite.status} • invited{' '}
                        {new Date(invite.invitedAtUtc).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={invite.status === 'pending' ? 'secondary' : 'outline'}>
                        {invite.status}
                      </Badge>
                      {canManageWorkspace && invite.status === 'pending' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRevoke(invite.invitationId)}
                          disabled={busyKey === `invite:${invite.invitationId}`}
                        >
                          {busyKey === `invite:${invite.invitationId}` ? 'Revoking...' : 'Revoke'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No invitations yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
