import { useState } from "react";
import { Navigate } from "react-router-dom";
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

type AccountType = "individual" | "team";

export function AccountSetupPage() {
  const { user, refreshUser } = useAuth();
  const { updateAccountSetup } = useApi();
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const needsSetup = !!(user.onboardingState as Record<string, unknown>)
    ?.needsAccountSetup;

  if (!needsSetup) {
    return <Navigate to="/app" replace />;
  }

  const handleSubmit = async () => {
    setError(null);

    if (accountType === "team" && !teamName.trim()) {
      setError("Team name is required for team accounts.");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateAccountSetup({
        accountType,
        teamName: accountType === "team" ? teamName.trim() : undefined,
      });
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center justify-center">
        <Card className="w-full border-border/80 bg-card/95 backdrop-blur">
          <CardHeader className="space-y-3 p-6 text-center sm:p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-primary/80">
              DocFlow
            </p>
            <CardTitle className="text-2xl tracking-tight">
              Set up your account
            </CardTitle>
            <CardDescription className="mx-auto max-w-md text-sm leading-6">
              Welcome, {user.displayName}! Choose how you'll use DocFlow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-0 sm:p-8 sm:pt-0">
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
                  placeholder="e.g. Acme Product Team"
                />
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="pt-1">
              <Button
                className="w-full justify-center px-4 py-6"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
