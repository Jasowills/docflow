import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/use-api';
import { useClientDataStore } from '../state/client-data-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import { Download, Chrome, BookOpenCheck, ArrowRight } from 'lucide-react';

export function GettingStartedPage() {
  const { getLatestExtensionRelease } = useApi();
  const { extensionRelease, ensureExtensionRelease } = useClientDataStore();
  const navigate = useNavigate();

  const [loadingRelease, setLoadingRelease] = useState(!extensionRelease);
  const [downloading, setDownloading] = useState(false);
  const [releaseFetchError, setReleaseFetchError] = useState<string | null>(null);
  const fallbackDownloadUrl = import.meta.env.VITE_EXTENSION_DOWNLOAD_URL;
  const downloadUrl = extensionRelease?.downloadUrl || fallbackDownloadUrl;

  useEffect(() => {
    let mounted = true;
    if (extensionRelease) {
      setLoadingRelease(false);
      return;
    }
    ensureExtensionRelease(() => getLatestExtensionRelease())
      .then((release) => {
        if (!mounted) return;
        void release;
        setReleaseFetchError(null);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'No published extension release yet.';
        setReleaseFetchError(message);
      })
      .finally(() => {
        if (mounted) setLoadingRelease(false);
      });
    return () => {
      mounted = false;
    };
  }, [extensionRelease, ensureExtensionRelease, getLatestExtensionRelease]);

  const handleContinue = () => {
    navigate('/app/dashboard');
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    setDownloading(true);
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => setDownloading(false), 900);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="secondary" className="rounded-sm px-2.5 py-1 text-xs">
            First-Time Setup
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight mt-2">Getting Started</h1>
          <p className="text-muted-foreground mt-1">
            Set up DocFlow Recorder once, then you can capture and upload recordings anytime.
          </p>
        </div>
        {loadingRelease ? <Spinner className="text-primary mt-1" /> : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5" />
              1. Download Extension
            </CardTitle>
          <CardDescription>
            Use the latest extension package. This page remains available later from the sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {extensionRelease && (
            <div className="rounded-sm border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Latest published release: v{extensionRelease.version}</p>
              <p className="text-muted-foreground mt-1">
                Published {new Date(extensionRelease.publishedAtUtc).toLocaleString()}
              </p>
              {extensionRelease.notes && (
                <p className="text-muted-foreground mt-2">{extensionRelease.notes}</p>
              )}
            </div>
          )}
          {downloadUrl ? (
            <Button className="w-full" onClick={handleDownload} loading={downloading}>
              {downloading ? 'Starting download...' : 'Download DocFlow Recorder'}
            </Button>
          ) : (
            <div className="rounded-sm border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {loadingRelease
                ? 'Loading latest extension release...'
                : releaseFetchError || 'Download URL is not configured yet.'}
            </div>
          )}
          <div className="rounded-sm border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">After download</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
              <li>Open your browser extensions page.</li>
              <li>Enable developer mode.</li>
              <li>Load the extension package and pin DocFlow Recorder.</li>
            </ul>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Chrome className="h-5 w-5" />
              2. Enable in Chrome or Edge
            </CardTitle>
            <CardDescription>
              Load the unpacked extension once; then pin it for quick access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-semibold">Chrome</p>
              <ol className="list-decimal pl-5 mt-1 space-y-1 text-muted-foreground">
                <li>Open `chrome://extensions`.</li>
                <li>Turn on Developer mode.</li>
                <li>Click Load unpacked and select the extension `DocFlow Recorder` folder.</li>
                <li>Pin DocFlow Recorder from the extensions menu.</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold">Edge</p>
              <ol className="list-decimal pl-5 mt-1 space-y-1 text-muted-foreground">
                <li>Open `edge://extensions`.</li>
                <li>Turn on Developer mode.</li>
                <li>Click Load unpacked and select the extension `DocFlow Recorder` folder.</li>
                <li>Pin DocFlow Recorder for quick access.</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5" />
            3. Connect and Start Recording
          </CardTitle>
          <CardDescription>
            After enabling the extension, connect it from DocFlow and start uploading recordings.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link to="/app/recordings/upload">
            <Button variant="outline">Open Upload Setup</Button>
          </Link>
          <Link to="/app/recordings">
            <Button variant="outline">Open Recordings</Button>
          </Link>
          <Button onClick={handleContinue}>
            Continue to Dashboard
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

