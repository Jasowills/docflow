import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth/auth-context";
import { Layout } from "./components/layout/Layout";
import { LoginPage } from "./pages/LoginPage";
import { GettingStartedPage } from "./pages/GettingStartedPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UploadRecordingPage } from "./pages/UploadRecordingPage";
import { RecordingsListPage } from "./pages/RecordingsListPage";
import { RecordingDetailPage } from "./pages/RecordingDetailPage";
import { GenerateDocPage } from "./pages/GenerateDocPage";
import { DocumentsListPage } from "./pages/DocumentsListPage";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { AdminConfigPage } from "./pages/AdminConfigPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { GithubPage } from "./pages/GithubPage";
import { TestPlansPage } from "./pages/TestPlansPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { LandingPage } from "./pages/LandingPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
          <Route path="getting-started" element={<GettingStartedPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="recordings" element={<RecordingsListPage />} />
          <Route path="recordings/:id" element={<RecordingDetailPage />} />
          <Route path="recordings/upload" element={<UploadRecordingPage />} />
          <Route path="generate" element={<GenerateDocPage />} />
          <Route path="documents" element={<DocumentsListPage />} />
          <Route path="documents/:id" element={<DocumentDetailPage />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="github" element={<GithubPage />} />
          <Route path="test-plans" element={<TestPlansPage />} />
          <Route path="admin/config" element={<AdminConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
