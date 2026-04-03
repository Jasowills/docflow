import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
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
import { CheckCircle2 } from "lucide-react";

export function JoinWorkspacePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { isAuthenticated, user, isLoading: authLoading, refreshUser } = useAuth();
  const { getInvitationDetails, acceptWorkspaceInvitation } = useApi();

  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !isAuthenticated) return;

    // Auto-accept the invitation
    setIsAccepting(true);
    acceptWorkspaceInvitation(token)
      .then(async (workspace) => {
        await refreshUser();
        setWorkspaceName(workspace.name);
        setHasJoined(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to join workspace");
      })
      .finally(() => {
        setIsAccepting(false);
      });
  }, [token, isAuthenticated, acceptWorkspaceInvitation, refreshUser]);

  // If user tries to access directly without auth or token
  if (!token) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="p-6 text-center sm:p-8">
              <CardTitle className="text-2xl tracking-tight text-destructive">
                No Invitation Found
              </CardTitle>
              <CardDescription>
                No invitation token was provided. Please check your email and use the link provided.
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

  if (authLoading || (isAuthenticated && isAccepting)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 px-4 py-3">
          <Spinner className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            {workspaceName ? "Setting up your workspace..." : "Joining workspace..."}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="p-6 text-center sm:p-8">
              <CardTitle className="text-2xl tracking-tight text-destructive">
                Could Not Join Workspace
              </CardTitle>
              <CardDescription>{error}</CardDescription>
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

  if (hasJoined && workspaceName) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="p-6 text-center sm:p-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl tracking-tight">
                You're in!
              </CardTitle>
              <CardDescription className="mx-auto max-w-md text-sm leading-6">
                You've successfully joined <strong>{workspaceName}</strong>.
                Your workspace is ready to go.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
              <Link to="/app/dashboard">
                <Button className="w-full justify-center px-4 py-6" size="lg">
                  Go to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Not authenticated — should not happen as registration should have redirected here
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
        <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
          <CardHeader className="p-6 text-center sm:p-8">
            <CardTitle className="text-2xl tracking-tight">Sign In Required</CardTitle>
            <CardDescription>
              Please sign in or create an account to join the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
            <Link to={`/login?redirect=${encodeURIComponent(`/join-workspace?token=${encodeURIComponent(token)}`)}&invitation=1`}>
              <Button className="w-full">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
