import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/use-api";
import { useClientDataStore } from "../state/client-data-store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";
import { Upload, Sparkles, FileText, PlugZap, Github, ClipboardCheck } from "lucide-react";
import type { PaginatedResponse, DocumentSummary } from "@docflow/shared";
import {
  EXTENSION_CONNECTED_UNTIL_KEY,
  clearExtensionConnectionCache,
  getExtensionUploadAuthStatus,
  sendExtensionUploadAuth,
} from "../lib/extension-bridge";
import { getApiBaseUrl } from "../config/runtime-config";

export function DashboardPage() {
  const TOKEN_REVALIDATE_INTERVAL_MS = 30000;
  const { listDocuments, listRecordings, createExtensionUploadToken } =
    useApi();
  const { dashboard, ensureDashboard } = useClientDataStore();
  const [loadingDashboard, setLoadingDashboard] = useState(!dashboard);
  const [connectingExtension, setConnectingExtension] = useState(false);
  const [extensionConnectedUntilUtc, setExtensionConnectedUntilUtc] = useState<
    string | null
  >(null);
  const [extensionStatus, setExtensionStatus] =
    useState<string>("Not connected");
  const pendingExpiryUtcRef = useRef<string | null>(null);

  useEffect(() => {
    const syncConnectionFromToken = async () => {
      const status = await getExtensionUploadAuthStatus();
      if (!status.connected || !status.expiresAtUtc) {
        clearExtensionConnectionCache();
        setExtensionConnectedUntilUtc(null);
        setExtensionStatus("Not connected");
        return;
      }

      const expiryMs = new Date(status.expiresAtUtc).getTime();
      if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
        clearExtensionConnectionCache();
        setExtensionConnectedUntilUtc(null);
        setExtensionStatus("Not connected");
        return;
      }

      localStorage.setItem(EXTENSION_CONNECTED_UNTIL_KEY, status.expiresAtUtc);
      setExtensionConnectedUntilUtc(status.expiresAtUtc);
      setExtensionStatus(
        `Connected until ${new Date(status.expiresAtUtc).toLocaleTimeString()}`,
      );
    };

    void syncConnectionFromToken();

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;
      const data = event.data as {
        source?: string;
        type?: string;
        ok?: boolean;
      };
      if (data.source !== "docflow-recorder-extension") return;
      if (data.type !== "SET_EXTENSION_UPLOAD_AUTH_RESULT") return;

      if (data.ok) {
        const expiryUtc =
          pendingExpiryUtcRef.current ||
          localStorage.getItem(EXTENSION_CONNECTED_UNTIL_KEY);
        if (expiryUtc) {
          localStorage.setItem(EXTENSION_CONNECTED_UNTIL_KEY, expiryUtc);
          setExtensionConnectedUntilUtc(expiryUtc);
          setExtensionStatus(
            `Connected until ${new Date(expiryUtc).toLocaleTimeString()}`,
          );
        } else {
          setExtensionStatus("Extension connected.");
        }
      } else {
        setExtensionStatus("Connection failed. Reload extension and retry.");
      }
    };
    const onWindowFocus = () => {
      void syncConnectionFromToken();
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", onWindowFocus);
    const revalidateTimer = window.setInterval(
      () => {
        void syncConnectionFromToken();
      },
      TOKEN_REVALIDATE_INTERVAL_MS,
    );
    void ensureDashboard(async () => {
      const [docsRes, recordingsRes] = await Promise.all([
        listDocuments({ pageSize: 5 }),
        listRecordings({ pageSize: 1 }),
      ]);
      return {
        recentDocs: (docsRes as PaginatedResponse<DocumentSummary>).items,
        docCount: docsRes.total,
        recordingCount: recordingsRes.total,
      };
    }).finally(() => setLoadingDashboard(false));

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", onWindowFocus);
      window.clearInterval(revalidateTimer);
    };
  }, [dashboard, ensureDashboard, listDocuments, listRecordings]);

  const handleConnectExtension = async () => {
    setConnectingExtension(true);
    setExtensionStatus("Connecting extension. This can take a few seconds on first load...");
    try {
      const { token, expiresAtUtc } = await createExtensionUploadToken();
      const apiBaseUrl = getApiBaseUrl();
      const ok = await sendExtensionUploadAuth(
        { apiBaseUrl, bearerToken: token },
        { attempts: 20, pingTimeoutMs: 1000, ackTimeoutMs: 1300, retryDelayMs: 450 },
      );
      if (!ok) {
        setExtensionStatus("Extension is still initializing. Keep this page open and click Connect Extension again in a few seconds.");
        return;
      }
      pendingExpiryUtcRef.current = null;
      localStorage.setItem(EXTENSION_CONNECTED_UNTIL_KEY, expiresAtUtc);
      setExtensionConnectedUntilUtc(expiresAtUtc);
      setExtensionStatus(
        `Connected until ${new Date(expiresAtUtc).toLocaleTimeString()}`,
      );
    } catch (error: unknown) {
      setExtensionStatus(
        error instanceof Error ? error.message : "Failed to connect extension",
      );
    } finally {
      setConnectingExtension(false);
    }
  };

  const isExtensionConnected =
    !!extensionConnectedUntilUtc &&
    new Date(extensionConnectedUntilUtc).getTime() > Date.now();
  const recordingCount = dashboard?.recordingCount;
  const docCount = dashboard?.docCount;
  const recentDocs = dashboard?.recentDocs || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome to DocFlow
          </p>
        </div>
        {loadingDashboard ? <Spinner className="text-primary mt-1" /> : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recordings
            </CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {recordingCount ?? "--"}
              {loadingDashboard && recordingCount == null ? (
                <Spinner className="h-4 w-4 text-primary" />
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Documents Generated
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {docCount ?? "--"}
              {loadingDashboard && docCount == null ? (
                <Spinner className="h-4 w-4 text-primary" />
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Quick Actions
            </CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link to="/app/recordings/upload">
              <Button variant="outline" size="sm">
                Upload
              </Button>
            </Link>
            <Link to="/app/generate">
              <Button size="sm">Generate</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              GitHub
            </CardTitle>
            <Github className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm font-medium">Connect repositories</div>
            <p className="text-xs text-muted-foreground">
              Link GitHub to browse repos and create repo-aware test plans.
            </p>
            <Link to="/app/github">
              <Button variant="outline" size="sm">Open GitHub</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Test Plans
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm font-medium">Plan execution</div>
            <p className="text-xs text-muted-foreground">
              Organize planned validation by repository, branch, and environment.
            </p>
            <Link to="/app/test-plans">
              <Button variant="outline" size="sm">Open Test Plans</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">
            DocFlow Recorder Extension
          </CardTitle>
          <PlugZap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge variant={isExtensionConnected ? "secondary" : "outline"}>
              {isExtensionConnected
                ? "DocFlow Recorder Extension Connected"
                : "Not connected"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {extensionStatus}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleConnectExtension}
              loading={connectingExtension}
              disabled={isExtensionConnected}
            >
              {connectingExtension
                ? "Connecting..."
                : isExtensionConnected
                  ? "DocFlow Recorder Extension Connected"
                  : "Connect Extension"}
            </Button>
            <Link to="/app/recordings/upload">
              <Button variant="outline">Open Upload Page</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDashboard && recentDocs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Loading recent documents...
            </p>
          ) : recentDocs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No documents generated yet. Upload a recording and generate your
              first document.
            </p>
          ) : (
            <div className="space-y-2">
              {recentDocs.map((doc) => (
                <Link
                  key={doc.documentId}
                  to={`/app/documents/${doc.documentId}`}
                  className="flex flex-col gap-2 rounded-md border p-3 transition-colors hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium text-sm">
                      {doc.documentTitle}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {doc.documentType} &middot; {doc.recordingName}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(doc.createdAtUtc).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


