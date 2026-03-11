import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import { TestPlansPage } from "./pages/TestPlansPage";
import { LandingPage } from "./pages/LandingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { OnboardingPage } from "./pages/OnboardingPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  const isOnboardingRoute = location.pathname.startsWith("/app/onboarding");
  const hasCompletedOnboarding = !!user?.onboardingCompletedAt;
  if (!hasCompletedOnboarding && !isOnboardingRoute) {
    return <Navigate to="/app/onboarding" replace />;
  }
  if (hasCompletedOnboarding && isOnboardingRoute) {
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
          <Route path="getting-started" element={<Navigate to="/app/onboarding" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="recordings" element={<RecordingsListPage />} />
          <Route path="recordings/:id" element={<RecordingDetailPage />} />
          <Route path="recordings/upload" element={<UploadRecordingPage />} />
          <Route path="generate" element={<GenerateDocPage />} />
          <Route path="documents" element={<DocumentsListPage />} />
          <Route path="documents/:id" element={<DocumentDetailPage />} />
          <Route path="workspace" element={<Navigate to="/app/settings?section=workspace" replace />} />
          <Route path="github" element={<Navigate to="/app/settings?section=github" replace />} />
          <Route path="test-plans" element={<TestPlansPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin/config" element={<AdminConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
