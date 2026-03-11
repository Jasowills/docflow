import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { useApi } from '../hooks/use-api';
import { ApiError } from '../services/api-client';
import { useClientDataStore } from '../state/client-data-store';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { ArrowLeft, Download, Trash2 } from 'lucide-react';
import type { RecordingDocument, RecordingEvent } from '@docflow/shared';

export function RecordingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getRecording, deleteRecording } = useApi();
  const { evictRecording } = useClientDataStore();
  const [recording, setRecording] = useState<RecordingDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      navigate('/app/recordings');
      return;
    }
    setLoading(true);
    getRecording(id)
      .then(setRecording)
      .catch((err) => {
        console.error(err);
        navigate('/app/recordings');
      })
      .finally(() => setLoading(false));
  }, [id, getRecording, navigate]);

  useEffect(() => {
    if (!deleteToast) return;
    const timer = window.setTimeout(() => setDeleteToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [deleteToast]);

  const eventPreview = useMemo(
    () => (recording?.events || []).slice(0, 200),
    [recording?.events],
  );
  const currentUserId = user?.userId || '';
  const currentUserEmail = user?.email || '';
  const canDeleteRecording =
    !!recording &&
    ((!!currentUserId && recording.userId === currentUserId) ||
      (!!currentUserEmail && recording.metadata.createdBy === currentUserEmail));

  const handleDelete = async () => {
    if (!recording) return;
    setIsDeleting(true);
    try {
      const recordingId = recording.metadata.recordingId || id;
      if (!recordingId) return;
      await deleteRecording(recordingId);
      evictRecording(recordingId);
      navigate('/app/recordings');
    } catch (err) {
      console.error(err);
      if (err instanceof ApiError && err.statusCode === 403) {
        setDeleteToast('You cannot delete another user\'s recording.');
      } else {
        setDeleteToast('Unable to delete this recording right now.');
      }
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleDownloadJson = () => {
    if (!recording) return;
    const blob = new Blob([JSON.stringify(recording, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getRecordingName(recording).replace(/[^a-z0-9]+/gi, '_').slice(0, 64)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-muted-foreground">Loading recording...</p>
      </div>
    );
  }

  if (!recording) return null;

  return (
    <div className="space-y-6">
      {deleteToast && (
        <div className="fixed right-4 top-20 z-40 rounded-md border border-border bg-card px-3 py-2 shadow-lg">
          <p className="text-sm text-foreground">{deleteToast}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate('/app/recordings')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to recordings
          </button>
          <h1 className="text-3xl font-bold tracking-tight truncate">{getRecordingName(recording)}</h1>
          <div className="flex items-center flex-wrap gap-2 mt-2">
            <Badge variant="secondary">{normalizeEnv(recording.metadata.environment) || 'N/A'}</Badge>
            <span className="text-sm text-muted-foreground">{recording.metadata.productArea || 'Unknown area'}</span>
            <span className="text-sm text-muted-foreground">
              {new Date(recording.metadata.createdAtUtc || recording.uploadedAtUtc).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadJson}>
            <Download className="h-4 w-4 mr-1" />
            Download JSON
          </Button>
          {canDeleteRecording ? (
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete recording?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this recording and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleDelete()} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Recording ID" value={recording.metadata.recordingId} />
            <Row label="Created by" value={recording.metadata.createdBy} />
            <Row label="Product" value={recording.metadata.productName} />
            <Row label="Version" value={recording.metadata.applicationVersion || 'N/A'} />
            <Row label="Uploaded" value={new Date(recording.uploadedAtUtc).toLocaleString()} />
            <Row label="Events" value={String(recording.events.length)} />
            <Row label="Transcripts" value={String(recording.speechTranscripts.length)} />
            <Row label="Screenshots" value={String(recording.screenshots?.length ?? 0)} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Captured Events ({recording.events.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {recording.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events captured for this recording.</p>
            ) : (
              <div className="max-h-[420px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr className="text-left">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Time (ms)</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventPreview.map((event, index) => (
                      <tr key={`${event.timestampMs}-${index}`} className="border-b last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                        <td className="px-3 py-2 tabular-nums">{event.timestampMs}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">{event.type}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {compactEventText(event)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {recording.events.length > eventPreview.length && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing first {eventPreview.length} events. Download JSON for full event stream.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key Screenshots ({recording.screenshots?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!recording.screenshots || recording.screenshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No screenshots captured for this recording.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {recording.screenshots.slice(0, 12).map((shot) => {
                const fullSrc = shot.imageUrl || shot.imageDataUrl || '';
                const previewSrc = shot.thumbnailUrl || shot.thumbnailDataUrl || fullSrc;
                const blobUrl = typeof shot.imageUrl === 'string' ? shot.imageUrl : '';
                const canOpen = blobUrl.startsWith('http');
                return canOpen ? (
                  <a
                    key={shot.id}
                    href={blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block border rounded-md overflow-hidden bg-muted/20 hover:ring-2 hover:ring-primary/40 transition"
                  >
                    <img
                      src={previewSrc}
                      alt={shot.label || shot.reason || 'Screenshot'}
                      className="w-full h-28 object-cover"
                      onError={(event) => {
                        const target = event.currentTarget;
                        if (target.src !== fullSrc) {
                          target.src = fullSrc;
                        }
                      }}
                    />
                    <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      {shot.reason} • {shot.timestampMs}ms
                    </div>
                  </a>
                ) : (
                  <div key={shot.id} className="block border rounded-md overflow-hidden bg-muted/20">
                    <div className="w-full h-28 flex items-center justify-center text-xs text-muted-foreground">
                      Screenshot unavailable
                    </div>
                    <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      {shot.reason} • {shot.timestampMs}ms • local fallback
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Speech Transcript ({recording.speechTranscripts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {recording.speechTranscripts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcript segments captured.</p>
          ) : (
            <div className="max-h-[280px] overflow-auto rounded-md border divide-y">
              {recording.speechTranscripts.map((segment, index) => (
                <div key={`${segment.timestampMs}-${index}`} className="px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">
                    {segment.speaker} • {segment.timestampMs}ms
                  </p>
                  <p>{segment.text}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right break-all">{value}</span>
    </div>
  );
}

function getRecordingName(recording: RecordingDocument): string {
  const metadata = recording.metadata as unknown as Record<string, unknown>;
  const titleCandidate = metadata.title;
  return (
    (recording.metadata?.name as string | undefined) ||
    (typeof titleCandidate === 'string' ? titleCandidate : undefined) ||
    recording.metadata.recordingId ||
    'Untitled recording'
  );
}

function normalizeEnv(value?: string): string {
  return (value || '').toUpperCase();
}

function compactEventText(event: RecordingEvent): string {
  const preferred: Array<keyof RecordingEvent> = ['title', 'url', 'label', 'fieldName', 'value', 'description', 'eventContext'];
  for (const key of preferred) {
    const value = event[key];
    if (typeof value === 'string' && value.trim()) {
      return value.length > 140 ? `${value.slice(0, 140)}...` : value;
    }
  }
  return 'No additional details';
}



