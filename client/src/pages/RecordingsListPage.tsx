import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApi } from '../hooks/use-api';
import { useClientDataStore } from '../state/client-data-store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Spinner } from '../components/ui/spinner';
import { pushDebugTrace } from '../lib/debug-trace';
import { Search } from 'lucide-react';
import type { RecordingSummary, RecordingListQuery } from '@docflow/shared';

const ENV_FILTERS = ['', 'DEV', 'UAT', 'STAGING', 'TEST', 'PROD', 'DEMO'];

export function RecordingsListPage() {
  const { listRecordings } = useApi();
  const { recordingsLists, ensureRecordingsList } = useClientDataStore();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [environment, setEnvironment] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;
  const query: RecordingListQuery = useMemo(
    () => ({
      page,
      pageSize,
      search: search || undefined,
    }),
    [page, pageSize, search],
  );
  const cacheKey = useMemo(
    () =>
      JSON.stringify({
        page,
        pageSize,
        search: search || '',
      }),
    [page, pageSize, search],
  );
  const cached = recordingsLists[cacheKey];

  useEffect(() => {
    pushDebugTrace('render', 'RecordingsListPage', 'Rendered', {
      cacheKey,
      hasCached: !!cached,
      page,
      pageSize,
      search,
      environment,
    });
  });

  useEffect(() => {
    let mounted = true;
    if (cached) {
      pushDebugTrace('effect', 'RecordingsListPage.useEffect', 'Skipped fetch because cache exists', {
        cacheKey,
      });
      return;
    }
    pushDebugTrace('effect', 'RecordingsListPage.useEffect', 'Triggering recordings list fetch', {
      cacheKey,
      page,
      pageSize,
      search,
    });
    setLoading(true);
    ensureRecordingsList(cacheKey, () => listRecordings(query))
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      pushDebugTrace('effect', 'RecordingsListPage.useEffect', 'Cleanup', { cacheKey });
    };
  }, [cacheKey, cached, ensureRecordingsList, listRecordings, query]);

  const sourceItems = cached?.items || [];
  const items = environment
    ? sourceItems.filter((item) => normalizeEnv(item.metadata?.environment) === environment)
    : sourceItems;
  const total = environment ? items.length : cached?.total ?? 0;

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recordings</h1>
          <p className="text-muted-foreground mt-1">
            Browse uploaded recordings and inspect captured events.
          </p>
        </div>
        {loading && !cached ? <Spinner className="text-primary mt-1" /> : null}
      </div>

      <div className="context-help-card">
        <p className="text-sm font-medium text-foreground">Capture workflows, then operationalize them.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the DocFlow recorder extension for structured browser capture, or upload a prepared recording to seed your workspace. Recordings become the source for generated docs, test cases, and future test plan execution.
        </p>
      </div>

      <div className="inline-flex max-w-full overflow-x-auto rounded-md border border-border bg-card p-1">
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

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">{total} recording{total === 1 ? '' : 's'}</CardTitle>
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <div className="relative w-full sm:flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                className="pl-9 h-10"
                placeholder="Search by title or metadata..."
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {ENV_FILTERS.map((value) => (
                <Badge
                  key={value || 'all'}
                  variant={environment === value ? 'default' : 'outline'}
                  className="cursor-pointer h-8 px-3 rounded-sm"
                  onClick={() => {
                    setEnvironment(value);
                    setPage(1);
                  }}
                >
                  {value || 'All envs'}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !cached ? (
            <div className="px-6 py-10">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Spinner className="text-primary" />
                Loading recordings...
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-10">
              <p className="text-sm text-muted-foreground">No recordings found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {items.map((recording) => {
                const name = getRecordingName(recording);
                const createdAt = recording.metadata?.createdAtUtc || recording.uploadedAtUtc;
                const env = normalizeEnv(recording.metadata?.environment);
                const routeId = getRouteId(recording);
                return (
                  <Link
                    key={routeId}
                    to={`/app/recordings/${routeId}`}
                    className="block px-6 py-4 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium truncate">{name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {recording.metadata?.productArea || 'Unknown area'} {'\u00b7'} {recording.eventCount ?? 0} events
                          {' \u00b7 '}
                          {recording.transcriptCount ?? 0} transcripts
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <Badge variant="secondary" className="rounded-sm">{env || 'N/A'}</Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {createdAt ? new Date(createdAt).toLocaleString() : 'Unknown time'}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {total > pageSize && (
            <div className="flex items-center justify-center gap-4 px-6 py-4 border-t border-border/70">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="text-sm text-primary disabled:text-muted-foreground"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <button
                onClick={() => setPage((prev) => prev + 1)}
                disabled={page >= pageCount}
                className="text-sm text-primary disabled:text-muted-foreground"
              >
                Next
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getRecordingName(recording: RecordingSummary): string {
  const metadata = recording.metadata as unknown as Record<string, unknown>;
  const titleCandidate = metadata.title;
  return (
    (recording.metadata?.name as string | undefined) ||
    (typeof titleCandidate === 'string' ? titleCandidate : undefined) ||
    recording.recordingId ||
    'Untitled recording'
  );
}

function getRouteId(recording: RecordingSummary): string {
  return recording.recordingId || recording.metadata?.recordingId || String(recording._id || 'unknown');
}

function normalizeEnv(value?: string): string {
  return (value || '').toUpperCase();
}

