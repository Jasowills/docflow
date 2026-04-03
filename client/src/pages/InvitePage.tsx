import { useCallback, useEffect, useState } from "react";
import { useSearchParams, Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { useApi } from "../hooks/use-api";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Spinner } from "../components/ui/spinner";

type InviteState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "expired" }
  | { kind: "already-accepted"; workspaceName: string }
  | {
      kind: "pending";
      workspaceName: string;
      role: string;
      inviterDisplayName: string;
      email: string;
    };

function loginUrl(token: string, inviteEmail: string, mode?: "register") {
  return `/login?redirect=${encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`)}&invitation=1&inviteEmail=${encodeURIComponent(inviteEmail)}${mode === "register" ? "&mode=register" : ""}`;
}

export function InvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { isAuthenticated, user, isLoading: authLoading, refreshUser } = useAuth();
  const { getInvitationDetails, acceptWorkspaceInvitation } = useApi();

  const [inviteState, setInviteState] = useState<InviteState>({
    kind: "loading",
  });
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInviteState({ kind: "not-found" });
      return;
    }

    getInvitationDetails(token)
      .then((details) => {
        if (details.status === "expired" || details.isExpired) {
          setInviteState({ kind: "expired" });
        } else if (details.status === "accepted") {
          setInviteState({
            kind: "already-accepted",
            workspaceName: details.workspaceName,
          });
        } else if (details.status === "revoked") {
          setInviteState({ kind: "not-found" });
        } else {
          setInviteState({
            kind: "pending",
            workspaceName: details.workspaceName,
            role: details.role,
            inviterDisplayName: details.inviterDisplayName,
            email: details.email,
          });
        }
      })
      .catch(() => {
        setInviteState({ kind: "not-found" });
      });
  }, [token, getInvitationDetails]);

  const handleAccept = useCallback(async () => {
    if (!token || inviteState.kind !== "pending") return;
    setError(null);
    setIsAccepting(true);
    try {
      const workspace = await acceptWorkspaceInvitation(token);
      await refreshUser();
      sessionStorage.setItem("skipAccountSetupCheck", "1");
      void navigate("/app/dashboard", {
        replace: true,
        state: { invitedToWorkspace: workspace.name, skipAccountSetupCheck: true },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to accept invitation";
      setError(message);
      setIsAccepting(false);
    }
  }, [token, inviteState, acceptWorkspaceInvitation, refreshUser, navigate]);

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="p-6 text-center sm:p-8">
              <CardTitle className="text-2xl tracking-tight text-destructive">
                Invalid Invitation
              </CardTitle>
              <CardDescription>
                No invitation token was provided. Please check your email and
                use the link provided.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
              <Link to="/">
                <Button className="w-full">Go to Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (authLoading || inviteState.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 px-4 py-3">
          <Spinner className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Loading invitation...
          </span>
        </div>
      </div>
    );
  }

  // Authenticated — accept or handle errors
  if (isAuthenticated && inviteState.kind === "pending") {
    const userEmailLower = user?.email?.toLowerCase() || "";
    const inviteEmailLower = inviteState.email.toLowerCase();
    const emailMismatch = userEmailLower !== inviteEmailLower;
    const isAccountNotFound = error?.includes("account could not be found");

    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="space-y-4 p-6 text-center sm:p-8">
              <p className="text-xs uppercase tracking-[0.22em] text-primary/80">
                DocFlow
              </p>
              <CardTitle className="text-2xl tracking-tight">
                {emailMismatch
                  ? "Email Address Mismatch"
                  : isAccountNotFound
                    ? "Account Not Found"
                    : "Accept Invitation"}
              </CardTitle>
              <CardDescription className="mx-auto max-w-md text-sm leading-6">
                {emailMismatch
                  ? `This invitation is for ${inviteState.email}, but you're signed in as ${user?.email}. Please sign in or create an account with the correct email.`
                  : isAccountNotFound
                    ? `Your session is linked but your account could not be found in our database. Sign in again or create a new account with ${inviteState.email} to join ${inviteState.workspaceName}.`
                    : `${inviteState.inviterDisplayName} has invited you to join ${inviteState.workspaceName} as an ${inviteState.role}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6 pt-0 sm:p-8 sm:pt-0">
              {emailMismatch ? (
                <div>
                  <Link to={loginUrl(token, inviteState.email)} className="block mb-4">
                    <Button variant="outline" className="w-full">
                      Sign in as {inviteState.email}
                    </Button>
                  </Link>
                  <Link to={loginUrl(token, inviteState.email, "register")} className="block">
                    <Button className="w-full">Create account</Button>
                  </Link>
                </div>
              ) : isAccountNotFound ? (
                <div>
                  <Link to={loginUrl(token, inviteState.email)} className="block mb-4">
                    <Button variant="outline" className="w-full">
                      Sign in again
                    </Button>
                  </Link>
                  <Link to={loginUrl(token, inviteState.email, "register")} className="block">
                    <Button className="w-full">Create account</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                  ) : null}
                  <Button
                    className="w-full justify-center px-4 py-6"
                    onClick={() => void handleAccept()}
                    disabled={isAccepting}
                  >
                    {isAccepting ? (
                      <span className="flex items-center gap-2">
                        <Spinner className="h-4 w-4" />
                        Joining workspace...
                      </span>
                    ) : (
                      "Accept & Join Workspace"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Not authenticated — show invitation and prompt to sign in
  if (!isAuthenticated && inviteState.kind === "pending") {
    const redirectUrl = `/invite?token=${encodeURIComponent(token)}`;

    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="space-y-4 p-6 text-center sm:p-8">
              <p className="text-xs uppercase tracking-[0.22em] text-primary/80">
                DocFlow
              </p>
              <CardTitle className="text-2xl tracking-tight">
                You're invited!
              </CardTitle>
              <CardDescription className="mx-auto max-w-md text-sm leading-6">
                <span className="block">
                  <strong>{inviteState.inviterDisplayName}</strong> has invited
                  you to join <strong>{inviteState.workspaceName}</strong> as an{" "}
                  <strong>{inviteState.role}</strong>.
                </span>
                <span className="mt-2 block text-muted-foreground">
                  Sign in or create an account with{" "}
                  <strong>{inviteState.email}</strong> to accept.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-6 pt-0 sm:p-8 sm:pt-0">
              <div>
                <Link to={`/login?redirect=${encodeURIComponent(redirectUrl)}&invitation=1&inviteEmail=${encodeURIComponent(inviteState.email)}`} className="block mb-4">
                  <Button className="w-full justify-center px-4 py-6">
                    Sign In
                  </Button>
                </Link>
                <Link to={loginUrl(token, inviteState.email, "register")} className="block">
                  <Button variant="outline" className="w-full">
                    Create Account
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link
              to="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <span>·</span>
            <Link
              to="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Expired invitation
  if (inviteState.kind === "expired") {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="p-6 text-center sm:p-8">
              <CardTitle className="text-2xl tracking-tight text-destructive">
                Invitation Expired
              </CardTitle>
              <CardDescription>
                This invitation has expired. Please request a new invitation
                from the workspace admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
              <Link to="/">
                <Button className="w-full">Go to Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Already accepted
  if (inviteState.kind === "already-accepted") {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="p-6 text-center sm:p-8">
              <CardTitle className="text-2xl tracking-tight text-primary">
                Already a Member
              </CardTitle>
              <CardDescription>
                You've already accepted this invitation and joined{" "}
                {inviteState.workspaceName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
              <Link to="/app/dashboard">
                <Button className="w-full">Go to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Not found / revoked
  if (inviteState.kind === "not-found") {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="p-6 text-center sm:p-8">
              <CardTitle className="text-2xl tracking-tight text-destructive">
                Invitation Not Found
              </CardTitle>
              <CardDescription>
                This invitation may have been revoked or is invalid. Please
                contact the workspace admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
              <Link to="/">
                <Button className="w-full">Go to Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <Navigate to="/" replace />;
}
