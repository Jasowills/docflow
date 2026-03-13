import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Sparkles, UploadCloud, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { useApi } from "../hooks/use-api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

type OnboardingStepKey =
  | "workspace"
  | "extension"
  | "recording"
  | "generation";

export function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const {
    updateOnboarding,
    updateCurrentWorkspace,
  } = useApi();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState(getSuggestedWorkspaceName(user));
  const [localOnboardingState, setLocalOnboardingState] = useState<Record<string, unknown>>(
    () => ({ ...(user?.onboardingState || {}) }),
  );
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWorkspaceName(getSuggestedWorkspaceName(user));
    setLocalOnboardingState({ ...(user?.onboardingState || {}) });
  }, [user?.workspaceName, user?.onboardingState]);

  const onboardingState = localOnboardingState as Partial<Record<OnboardingStepKey, boolean>>;
  const completedSteps = useMemo(
    () => new Set(Object.entries(onboardingState).filter(([, value]) => !!value).map(([key]) => key as OnboardingStepKey)),
    [onboardingState],
  );

  const markStep = async (step: OnboardingStepKey) => {
    const nextState = {
      ...localOnboardingState,
      [step]: true,
    };
    setLocalOnboardingState(nextState);
    await updateOnboarding({
      state: nextState,
    });
  };

  const handleSaveWorkspace = async () => {
    if (!workspaceName.trim()) {
      setError("Workspace name is required.");
      return;
    }
    setSavingWorkspace(true);
    setError(null);
    try {
      await updateCurrentWorkspace({ name: workspaceName.trim() });
      await refreshUser();
      await markStep("workspace");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save workspace.");
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setCompleting(true);
    setError(null);
    try {
      const nextState = {
        ...localOnboardingState,
        workspace: true,
        extension: true,
        recording: true,
        generation: true,
      };
      setLocalOnboardingState(nextState);
      await updateOnboarding({
        completed: true,
        state: nextState,
      });
      await refreshUser();
      navigate("/app/dashboard", { replace: true });
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Unable to complete onboarding.");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="app-page-header">
        <div>
          <p className="app-page-eyebrow">Onboarding</p>
          <h1 className="app-page-title">Set up your workspace once</h1>
          <p className="app-page-copy">
            {user?.accountType === "team"
              ? "Get your team workspace ready for capture, generation, and shared documentation."
              : "Finish your personal workspace setup, then move straight into recordings, generation, and documents."}
          </p>
        </div>
        <Badge variant="secondary">
          {completedSteps.size}/4 steps
        </Badge>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Workspace basics</CardTitle>
              <CardDescription>Name the workspace your team or personal operating area will use.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                />
              </div>
              <div className="pt-2">
                <Button onClick={() => void handleSaveWorkspace()} disabled={savingWorkspace}>
                  {savingWorkspace ? "Saving..." : completedSteps.has("workspace") ? "Update workspace" : "Save workspace"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>2. Install the recorder</CardTitle>
                <CardDescription>Capture web flows with the DocFlow browser extension.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Install the extension, connect it once, then capture recordings directly from product flows.
                </p>
                <div className="pt-2">
                  <Link to="/app/recordings/upload" onClick={() => void markStep("extension")}>
                    <Button variant="outline">Open recorder setup</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Capture your first recording</CardTitle>
                <CardDescription>Build the first workflow artifact for your workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload a test recording or capture a live product flow to seed your workspace activity.
                </p>
                <div className="pt-2">
                  <Link to="/app/recordings" onClick={() => void markStep("recording")}>
                    <Button variant="outline">Open recordings</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>4. Generate your first asset</CardTitle>
              <CardDescription>Create documentation, test cases, or release notes from recorded work.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generation is the core DocFlow loop: capture, generate, review, and operationalize.
              </p>
              <div className="pt-2">
                <Link to="/app/generate" onClick={() => void markStep("generation")}>
                  <Button>Open generate</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <CardDescription>Finish these steps once. Contextual guidance appears in the relevant pages afterward.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <OnboardingStepItem
                icon={Users}
                label="Workspace basics"
                done={completedSteps.has("workspace")}
              />
              <OnboardingStepItem
                icon={UploadCloud}
                label="Recorder setup"
                done={completedSteps.has("extension")}
              />
              <OnboardingStepItem
                icon={CheckCircle2}
                label="First recording"
                done={completedSteps.has("recording")}
              />
              <OnboardingStepItem
                icon={Sparkles}
                label="First generated asset"
                done={completedSteps.has("generation")}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Finish later?</CardTitle>
              <CardDescription>DocFlow recommends finishing setup now so the dashboard reflects a fully operational workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Once completed, onboarding disappears from navigation and help shows contextually inside Recordings, Generate, Documents, and Settings.
              </p>
              <div className="pt-2">
                <Button onClick={() => void handleCompleteOnboarding()} disabled={completing}>
                  {completing ? "Completing..." : "Complete onboarding"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function getSuggestedWorkspaceName(
  user: ReturnType<typeof useAuth>["user"],
): string {
  const currentWorkspaceName = user?.workspaceName?.trim();
  if (
    currentWorkspaceName &&
    !looksGeneratedWorkspaceName(currentWorkspaceName, user) &&
    !looksOpaqueWorkspaceName(currentWorkspaceName)
  ) {
    return currentWorkspaceName;
  }

  const preferredName = getPreferredWorkspaceOwnerName(user);
  if (preferredName) {
    return user?.accountType === "team" ? preferredName : `${preferredName}'s Workspace`;
  }

  return currentWorkspaceName || "";
}

function getPreferredWorkspaceOwnerName(
  user: ReturnType<typeof useAuth>["user"],
): string | undefined {
  const teamName = user?.teamName?.trim();
  if (user?.accountType === "team" && teamName && !looksOpaqueIdentifier(teamName)) {
    return teamName;
  }

  const displayName = user?.displayName?.trim();
  if (displayName && !looksOpaqueIdentifier(displayName)) {
    return displayName;
  }

  const emailLocalPart = user?.email?.split("@")[0];
  return humanizeIdentityToken(emailLocalPart) || humanizeIdentityToken(displayName);
}

function looksGeneratedWorkspaceName(
  workspaceName: string,
  user: ReturnType<typeof useAuth>["user"],
): boolean {
  const normalized = workspaceName.trim();
  const displayName = user?.displayName?.trim();
  const generatedFromDisplayName = displayName ? `${displayName}'s Workspace` : null;
  const teamName = user?.teamName?.trim();
  const generatedFromTeamName = teamName ? `${teamName}'s Workspace` : null;

  return (
    (!!generatedFromDisplayName &&
      normalized === generatedFromDisplayName &&
      looksOpaqueIdentifier(displayName)) ||
    (!!generatedFromTeamName &&
      normalized === generatedFromTeamName &&
      looksOpaqueIdentifier(teamName))
  );
}

function looksOpaqueWorkspaceName(value: string): boolean {
  const normalized = value.trim();
  const withoutSuffix = normalized.replace(/'s Workspace$/i, "").trim();
  return looksOpaqueIdentifier(withoutSuffix);
}

function humanizeIdentityToken(value?: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;

  const cleaned = normalized
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return undefined;

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function looksOpaqueIdentifier(value?: string): boolean {
  const normalized = value?.trim();
  if (!normalized) return false;

  return (
    normalized.length >= 8 &&
    !/\s/.test(normalized) &&
    /[a-z]/i.test(normalized) &&
    /\d/.test(normalized)
  );
}

function OnboardingStepItem({
  icon: Icon,
  label,
  done,
}: {
  icon: typeof Users;
  label: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/55 px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      {done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
}
