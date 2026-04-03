import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./auth/auth-context";
import { Layout } from "./components/layout/Layout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UploadRecordingPage } from "./pages/UploadRecordingPage";
import { RecordingsListPage } from "./pages/RecordingsListPage";
import { RecordingDetailPage } from "./pages/RecordingDetailPage";
import { GenerateDocPage } from "./pages/GenerateDocPage";
import { DocumentsListPage } from "./pages/DocumentsListPage";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { AdminConfigPage } from "./pages/AdminConfigPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { GoogleCallbackPage } from "./pages/GoogleCallbackPage";
import { LandingPage } from "./pages/LandingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { GettingStartedPage } from "./pages/GettingStartedPage";
import { AccountSetupPage } from "./pages/AccountSetupPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { TermsOfServicePage } from "./pages/TermsOfServicePage";
import { InvitePage } from "./pages/InvitePage";
import { JoinWorkspacePage } from "./pages/JoinWorkspacePage";
import { Spinner } from "./components/ui/spinner";

function DebugPanel({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="fixed top-2 left-2 z-[100] max-h-80 w-[22rem] overflow-auto rounded-md border border-cyan-500/40 bg-black/90 p-3 font-mono text-[11px] text-cyan-300">
      <div className="mb-1 font-bold text-cyan-200">DEBUG: App Router</div>
      <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (import.meta.env.DEV) {
    console.log("[ProtectedRoute] path:", location.pathname, "isAuth:", isAuthenticated, "needsSetup:", !!(user?.onboardingState as Record<string, unknown>)?.needsAccountSetup);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 px-4 py-3">
          <Spinner className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Loading workspace...
          </span>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  const needsAccountSetup = !!(user?.onboardingState as Record<string, unknown>)
    ?.needsAccountSetup;
  const skipAccountSetupCheck =
    location.state?.skipAccountSetupCheck === true ||
    sessionStorage.getItem("skipAccountSetupCheck") === "1";
  if (needsAccountSetup && !skipAccountSetupCheck) {
    return <Navigate to="/account-setup" replace />;
  }
  // Clear the skip flag after it's used once
  if (skipAccountSetupCheck && sessionStorage.getItem("skipAccountSetupCheck") === "1") {
    sessionStorage.removeItem("skipAccountSetupCheck");
  }
  const isOnboardingRoute = location.pathname.startsWith("/app/onboarding");
  const hasCompletedOnboarding = !!user?.onboardingCompletedAt;
  const cameFromGuide = location.state?.fromGuide === true;
  if (hasCompletedOnboarding && isOnboardingRoute && !cameFromGuide) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = !!user?.roles?.some((r) => r === "owner" || r === "admin");
  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/account-setup" element={<AccountSetupPage />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/join-workspace" element={<JoinWorkspacePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="getting-started" element={<GettingStartedPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="recordings" element={<RecordingsListPage />} />
          <Route path="recordings/:id" element={<RecordingDetailPage />} />
          <Route path="recordings/upload" element={<UploadRecordingPage />} />
          <Route path="generate" element={<GenerateDocPage />} />
          <Route path="documents" element={<DocumentsListPage />} />
          <Route path="documents/:id" element={<DocumentDetailPage />} />
          <Route
            path="workspace"
            element={<Navigate to="/app/settings?section=workspace" replace />}
          />
          <Route
            path="github"
            element={<Navigate to="/app/dashboard" replace />}
          />
          <Route
            path="test-plans"
            element={<Navigate to="/app/dashboard" replace />}
          />
          <Route
            path="test-plans/:id"
            element={<Navigate to="/app/dashboard" replace />}
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="admin/config"
            element={
              <AdminRoute>
                <AdminConfigPage />
              </AdminRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
