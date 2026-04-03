import { useEffect, useMemo, useState } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
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
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import type { AuthProviderConfig } from "@docflow/shared";

type Mode = "login" | "register";
type AccountType = "individual" | "team";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect");
  const isInvitationFlow = searchParams.get("invitation") === "1";
  const inviteEmail = searchParams.get("inviteEmail") || "";
  const urlMode = searchParams.get("mode");
  // Extract token from redirect URL if present
  const inviteToken = useMemo(() => {
    if (!redirectUrl) return null;
    const match = redirectUrl.match(/token=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [redirectUrl]);
  const { isAuthenticated, user, login, loginWithGoogle, register } = useAuth();
  const { getAuthProviders } = useApi();
  const [mode, setMode] = useState<Mode>(urlMode === "register" ? "register" : "login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providerConfig, setProviderConfig] =
    useState<AuthProviderConfig | null>(null);
  const [providerConfigLoaded, setProviderConfigLoaded] = useState(false);

  // Clear stale auth state when entering invitation flow to prevent
  // "account not found" errors from deleted/expired accounts
  useEffect(() => {
    if (isInvitationFlow) {
      // Store the token so we can auto-accept after registration
      if (inviteToken) {
        sessionStorage.setItem("invitationToken", inviteToken);
      }
      const storedUser = localStorage.getItem("docflow.auth.user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser) as { userId?: string; email?: string };
          const inviteEmailLower = inviteEmail.toLowerCase();
          // If the stored user's email doesn't match the invite email, clear it
          if (parsed.email && parsed.email.toLowerCase() !== inviteEmailLower) {
            localStorage.removeItem("docflow.auth.user");
            localStorage.removeItem("docflow.auth.accessToken");
            localStorage.removeItem("docflow.auth.refreshToken");
          }
        } catch {
          localStorage.removeItem("docflow.auth.user");
          localStorage.removeItem("docflow.auth.accessToken");
          localStorage.removeItem("docflow.auth.refreshToken");
        }
      }
    }
  }, [isInvitationFlow, inviteEmail]);

  useEffect(() => {
    getAuthProviders()
      .then((config) => {
        setProviderConfig(config);
        setProviderConfigLoaded(true);
      })
      .catch(() => {
        setProviderConfig(null);
        setProviderConfigLoaded(true);
      });
  }, [getAuthProviders]);

  if (isAuthenticated) {
    // If they explicitly came to register, let them — don't redirect away
    if (urlMode === "register") {
      // Stay on login with register tab active
    } else if (isInvitationFlow && redirectUrl) {
      const emailsMatch = user?.email?.toLowerCase() === inviteEmail.toLowerCase();
      if (!emailsMatch) {
        localStorage.removeItem("docflow.auth.user");
        localStorage.removeItem("docflow.auth.accessToken");
        localStorage.removeItem("docflow.auth.refreshToken");
        window.location.reload();
        return null;
      }
      sessionStorage.setItem("skipAccountSetupCheck", "1");
      return <Navigate to={redirectUrl} replace />;
    } else {
      return <Navigate to="/app" replace />;
    }
  }

  const isRegister = mode === "register";
  const googleEnabled =
    providerConfigLoaded && !!providerConfig?.googleSignInEnabled;
  const showProviderButtons = providerConfigLoaded && googleEnabled;

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          accountType,
          teamName: accountType === "team" ? teamName.trim() : undefined,
        });
      } else {
        await login({ email: email.trim(), password });
      }
      // Redirect after registration
      const finalRedirect = redirectUrl || sessionStorage.getItem("authRedirectUrl");
      if (finalRedirect) {
        sessionStorage.removeItem("authRedirectUrl");
        if (isInvitationFlow && inviteToken) {
          // Auto-accept invitation by redirect to join-workspace page
          sessionStorage.setItem("skipAccountSetupCheck", "1");
          window.location.href = `/join-workspace?token=${encodeURIComponent(inviteToken)}`;
        } else {
          window.location.href = finalRedirect;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setIsSubmitting(false);
    }
  };

  const handleGoogleAction = () => {
    if (providerConfig?.googleClientId && providerConfig?.googleCallbackUrl) {
      // Store redirect URL for after Google OAuth completes
      if (redirectUrl) {
        sessionStorage.setItem("authRedirectUrl", redirectUrl);
      }
      loginWithGoogle(
        providerConfig.googleClientId,
        providerConfig.googleCallbackUrl,
      );
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
        <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
          <CardHeader className="space-y-4 p-6 text-center sm:p-8">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-primary/80">
                DocFlow
              </p>
              <CardTitle className="text-2xl tracking-tight">
                {isRegister ? "Create your account" : "Welcome back"}
              </CardTitle>
              <CardDescription className="mx-auto max-w-md text-sm leading-6">
                {isRegister
                  ? isInvitationFlow
                    ? "Create an account to accept the workspace invitation."
                    : "Choose how you'll use DocFlow and get set up."
                  : "Sign in to access your workspace and documents."}
              </CardDescription>
              {isInvitationFlow && inviteEmail ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-center">
                  <p className="text-xs text-muted-foreground">Sign in as</p>
                  <p className="text-sm font-medium text-foreground">{inviteEmail}</p>
                </div>
              ) : null}
            </div>
            <div className="inline-flex self-center rounded-sm border border-border bg-background/50 p-1">
              <button
                type="button"
                className={`min-w-[132px] rounded-sm px-4 py-2 text-sm font-medium transition ${!isRegister ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setMode("login")}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`min-w-[132px] rounded-sm px-4 py-2 text-sm font-medium transition ${isRegister ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setMode("register")}
              >
                Create account
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-0 sm:p-8 sm:pt-0">
            {!providerConfigLoaded ? (
              <div className="rounded-sm border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground animate-pulse">
                Setting up authentication...
              </div>
            ) : null}

            {showProviderButtons ? (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-center px-4 py-6"
                  onClick={() => void handleGoogleAction()}
                  type="button"
                  disabled={!googleEnabled || isSubmitting}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </Button>
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground">
                      or use email
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {isRegister && providerConfigLoaded && !isInvitationFlow ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className={`rounded-lg border px-4 py-4 text-left transition ${accountType === "individual" ? "border-primary bg-primary/5" : "border-border bg-background/40 hover:bg-accent/40"}`}
                      onClick={() => setAccountType("individual")}
                    >
                      <div className="font-medium">Individual</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        For solo creators and analysts
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg border px-4 py-4 text-left transition ${accountType === "team" ? "border-primary bg-primary/5" : "border-border bg-background/40 hover:bg-accent/40"}`}
                      onClick={() => setAccountType("team")}
                    >
                      <div className="font-medium">Team</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        For shared workspaces and invites
                      </div>
                    </button>
                  </div>
                </div>
                {accountType === "team" ? (
                  <div className="space-y-2">
                    <Label htmlFor="teamName">Team name</Label>
                    <Input
                      id="teamName"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {isRegister && providerConfigLoaded && isInvitationFlow ? (
              <div className="space-y-2">
                <Label htmlFor="displayName">Full name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            ) : null}

            {providerConfigLoaded ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {providerConfigLoaded ? (
              <div className="pt-1">
                <Button
                  className="w-full justify-center px-4 py-6"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? isRegister
                      ? "Creating account..."
                      : "Signing in..."
                    : isRegister
                      ? "Create account"
                      : "Sign in"}
                </Button>
              </div>
            ) : null}
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
          <Link to="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
