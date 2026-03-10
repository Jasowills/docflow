import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Upload, FileJson, Check, AlertCircle } from 'lucide-react';
import type { Recording } from '@docflow/shared';
import {
  EXTENSION_CONNECTED_UNTIL_KEY,
  clearExtensionConnectionCache,
  getExtensionUploadAuthStatus,
  sendExtensionUploadAuth,
} from '../lib/extension-bridge';
import { getApiBaseUrl } from '../config/runtime-config';

type ExtensionLikeEvent = {
  timestampMs?: number;
  type?: string;
  data?: Record<string, unknown>;
};

type ExtensionLikeTranscript = {
  startMs?: number;
  text?: string;
};

type RecordingScreenshotItem = NonNullable<Recording['screenshots']>[number];

function normalizeScreenshots(input: unknown): Recording['screenshots'] {
  if (!Array.isArray(input)) return [];

  return input.filter((shot): shot is RecordingScreenshotItem => {
    if (!shot || typeof shot !== 'object') return false;
    const candidate = shot as { imageDataUrl?: unknown };
    return (
      typeof candidate.imageDataUrl === 'string' &&
      candidate.imageDataUrl.startsWith('data:image/')
    );
  });
}

function generateRecordingId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rec-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function normalizeEventType(type?: string): Recording['events'][number]['type'] {
  switch (type) {
    case 'navigation':
    case 'click':
    case 'input':
      return type;
    default:
      return 'custom';
  }
}

function normalizeRecordingInput(parsed: any): Recording {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid recording JSON');
  }

  if (!Array.isArray(parsed.events)) {
    throw new Error('Invalid recording JSON: events must be an array');
  }

  // Already in backend/shared schema
  if (parsed.metadata?.recordingId && parsed.metadata?.name) {
    return {
      metadata: parsed.metadata,
      events: parsed.events,
      speechTranscripts: Array.isArray(parsed.speechTranscripts) ? parsed.speechTranscripts : [],
      screenshots: normalizeScreenshots(parsed.screenshots),
    } as Recording;
  }

  // Extension export schema -> normalize to backend/shared schema
  const metadata = parsed.metadata ?? {};
  const now = new Date().toISOString();
  const events = (parsed.events as ExtensionLikeEvent[]).map((event) => {
    const data = event.data ?? {};
    return {
      timestampMs: typeof event.timestampMs === 'number' ? event.timestampMs : 0,
      type: normalizeEventType(event.type),
      url: typeof data.url === 'string' ? data.url : undefined,
      title: typeof data.title === 'string' ? data.title : undefined,
      selector:
        typeof data.selector === 'string'
          ? data.selector
          : typeof data.tag === 'string'
            ? data.tag
            : undefined,
      label:
        typeof data.text === 'string'
          ? data.text
          : typeof data.ariaLabel === 'string'
            ? data.ariaLabel
            : undefined,
      fieldName:
        typeof data.name === 'string'
          ? data.name
          : typeof data.id === 'string'
            ? data.id
            : undefined,
      value: typeof data.value === 'string' ? data.value : undefined,
      description:
        typeof data.description === 'string'
          ? data.description
          : undefined,
      eventContext:
        typeof data.eventContext === 'string'
          ? data.eventContext
          : undefined,
    };
  });

  const transcriptSource = Array.isArray(parsed.speechTranscripts)
    ? parsed.speechTranscripts
    : Array.isArray(parsed.speechTranscript)
      ? parsed.speechTranscript
      : [];

  const speechTranscripts = (transcriptSource as ExtensionLikeTranscript[])
    .filter((seg) => typeof seg.text === 'string' && seg.text.trim().length > 0)
    .map((seg) => ({
      timestampMs: typeof seg.startMs === 'number' ? seg.startMs : 0,
      speaker: 'host',
      text: seg.text!.trim(),
    }));

  const normalized: Recording = {
    metadata: {
      recordingId: generateRecordingId(),
      name: typeof metadata.title === 'string' && metadata.title.trim() ? metadata.title.trim() : 'DocFlow Recording',
      createdAtUtc: typeof metadata.capturedAt === 'string' ? metadata.capturedAt : now,
      createdBy: typeof metadata.recordedBy === 'string' && metadata.recordedBy.trim() ? metadata.recordedBy.trim() : 'extension-user',
      productName: typeof metadata.productName === 'string' && metadata.productName.trim() ? metadata.productName.trim() : 'DocFlow Capture',
      productArea: typeof metadata.productArea === 'string' ? metadata.productArea : 'Web App',
      applicationVersion: typeof metadata.productVersion === 'string' ? metadata.productVersion : undefined,
      environment: typeof metadata.environment === 'string' ? metadata.environment : undefined,
    },
    events,
    speechTranscripts,
    screenshots: normalizeScreenshots(parsed.screenshots),
  };

  return normalized;
}

export function UploadRecordingPage() {
  const TOKEN_REVALIDATE_INTERVAL_MS = 30000;
  const navigate = useNavigate();
  const location = useLocation();
  const { uploadRecording, createExtensionUploadToken } = useApi();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<string | null>(null);
  const [connectingExtension, setConnectingExtension] = useState(false);
  const [extensionConnectedUntilUtc, setExtensionConnectedUntilUtc] = useState<string | null>(null);
  const pendingExpiryUtcRef = useRef<string | null>(null);

  useEffect(() => {
    const syncConnectionFromToken = async () => {
      const status = await getExtensionUploadAuthStatus();
      if (!status.connected || !status.expiresAtUtc) {
        clearExtensionConnectionCache();
        setExtensionConnectedUntilUtc(null);
        setExtensionStatus('Not connected');
        return;
      }

      const expiryMs = new Date(status.expiresAtUtc).getTime();
      if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
        clearExtensionConnectionCache();
        setExtensionConnectedUntilUtc(null);
        setExtensionStatus('Not connected');
        return;
      }

      localStorage.setItem(EXTENSION_CONNECTED_UNTIL_KEY, status.expiresAtUtc);
      setExtensionConnectedUntilUtc(status.expiresAtUtc);
      setExtensionStatus(`Connected until ${new Date(status.expiresAtUtc).toLocaleTimeString()}`);
    };

    void syncConnectionFromToken();

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;
      const data = event.data as { source?: string; type?: string; ok?: boolean };
      if (
        data.source === 'docflow-recorder-extension'
        && data.type === 'SET_EXTENSION_UPLOAD_AUTH_RESULT'
      ) {
        if (data.ok) {
          const nextExpiryUtc =
            pendingExpiryUtcRef.current || localStorage.getItem(EXTENSION_CONNECTED_UNTIL_KEY);
          if (nextExpiryUtc) {
            localStorage.setItem(EXTENSION_CONNECTED_UNTIL_KEY, nextExpiryUtc);
            setExtensionConnectedUntilUtc(nextExpiryUtc);
            setExtensionStatus(`Connected until ${new Date(nextExpiryUtc).toLocaleTimeString()}`);
          } else {
            setExtensionStatus('Extension connected.');
          }
        } else {
          setExtensionStatus('Extension did not confirm connection. Reload extension and try again.');
        }
      }
    };
    const onWindowFocus = () => {
      void syncConnectionFromToken();
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', onWindowFocus);
    const revalidateTimer = window.setInterval(
      () => {
        void syncConnectionFromToken();
      },
      TOKEN_REVALIDATE_INTERVAL_MS,
    );
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', onWindowFocus);
      window.clearInterval(revalidateTimer);
    };
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      setSuccess(false);
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      if (!selectedFile.name.endsWith('.json')) {
        setError('Please select a JSON file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          const normalized = normalizeRecordingInput(parsed);
          setRecording(normalized);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to parse JSON file');
        }
      };
      reader.readAsText(selectedFile);
    },
    [],
  );

  const handleUpload = async () => {
    if (!recording) return;
    setUploading(true);
    setError(null);
    try {
      await uploadRecording(recording);
      setSuccess(true);
      setTimeout(() => navigate('/app/generate'), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleConnectExtension = async () => {
    setConnectingExtension(true);
    setExtensionStatus('Connecting extension. This can take a few seconds on first load...');
    try {
      const { token, expiresAtUtc } = await createExtensionUploadToken();
      const apiBaseUrl = getApiBaseUrl();
      const ok = await sendExtensionUploadAuth(
        { apiBaseUrl, bearerToken: token },
        { attempts: 20, pingTimeoutMs: 1000, ackTimeoutMs: 1300, retryDelayMs: 450 },
      );
      if (!ok) {
        setExtensionStatus('Extension is still initializing. Keep this page open and click Connect Extension again in a few seconds.');
        return;
      }
      pendingExpiryUtcRef.current = null;
      localStorage.setItem(EXTENSION_CONNECTED_UNTIL_KEY, expiresAtUtc);
      setExtensionConnectedUntilUtc(expiresAtUtc);
      setExtensionStatus(`Connected until ${new Date(expiresAtUtc).toLocaleTimeString()}`);
    } catch (err: unknown) {
      setExtensionStatus(err instanceof Error ? err.message : 'Failed to connect extension');
    } finally {
      setConnectingExtension(false);
    }
  };

  const isExtensionConnected =
    !!extensionConnectedUntilUtc && new Date(extensionConnectedUntilUtc).getTime() > Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Recording</h1>
        <p className="text-muted-foreground mt-1">
          Upload a recording JSON file exported from the DocFlow Recorder extension.
        </p>
      </div>

      <div className="inline-flex rounded-md border border-border bg-card p-1">
        <Link
          to="/app/recordings"
          className={`px-4 py-2 text-sm rounded-sm transition-colors ${
            location.pathname === '/app/recordings'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          List
        </Link>
        <Link
          to="/app/recordings/upload"
          className={`px-4 py-2 text-sm rounded-sm transition-colors ${
            location.pathname === '/app/recordings/upload'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Upload
        </Link>
      </div>

      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-lg">Connect Extension</CardTitle>
          <CardDescription>
            Auto-send a short-lived upload token to the browser extension on this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Status: {isExtensionConnected ? 'DocFlow Recorder Extension Connected' : 'Not connected'}
          </p>
          <Button
            onClick={handleConnectExtension}
            loading={connectingExtension}
            disabled={isExtensionConnected}
          >
            {connectingExtension
              ? 'Connecting...'
              : isExtensionConnected
                ? 'DocFlow Recorder Extension Connected'
                : 'Connect DocFlow Recorder Extension'}
          </Button>
          {extensionStatus && (
            <p className="text-sm text-muted-foreground">{extensionStatus}</p>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Select Recording File
          </CardTitle>
          <CardDescription>
            Choose the .json file produced by the browser extension recorder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="recording-file">Recording JSON File</Label>
            <Input
              id="recording-file"
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="mt-1"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {recording && !error && (
            <div className="rounded-md border p-4 space-y-2 bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileJson className="h-4 w-4 text-primary" />
                Recording Preview
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name: </span>
                  {recording.metadata.name}
                </div>
                <div>
                  <span className="text-muted-foreground">Product Area: </span>
                  {recording.metadata.productArea}
                </div>
                <div>
                  <span className="text-muted-foreground">Events: </span>
                  {recording.events.length}
                </div>
                <div>
                  <span className="text-muted-foreground">Transcripts: </span>
                  {recording.speechTranscripts.length}
                </div>
                <div>
                  <span className="text-muted-foreground">Screenshots: </span>
                  {recording.screenshots?.length ?? 0}
                </div>
                <div>
                  <span className="text-muted-foreground">Created: </span>
                  {new Date(recording.metadata.createdAtUtc).toLocaleString()}
                </div>
                {recording.metadata.environment && (
                  <div>
                    <span className="text-muted-foreground">Environment: </span>
                    {recording.metadata.environment}
                  </div>
                )}
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Recording uploaded successfully! Redirecting...
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!recording || uploading || success}
            loading={uploading}
            className="w-full"
          >
            {uploading ? 'Uploading...' : 'Upload Recording'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}



