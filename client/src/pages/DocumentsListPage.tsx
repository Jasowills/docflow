import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApi } from '../hooks/use-api';
import { useClientDataStore } from '../state/client-data-store';
import { useRealtimeStore } from '../state/realtime-store';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Spinner } from '../components/ui/spinner';
import { Search, ArrowLeft, Star, Pencil } from 'lucide-react';
import type { DocumentSummary, DocumentListQuery, FolderConfig } from '@docflow/shared';

export function DocumentsListPage() {
  const location = useLocation();
  const { listDocuments, getConfig } = useApi();
  const { documentsLists, ensureDocumentsList } = useClientDataStore();
  const { lastDocumentPersisted } = useRealtimeStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [folderConfigs, setFolderConfigs] = useState<FolderConfig[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  useEffect(() => {
    const incomingFolder = String((location.state as { folderFilter?: string } | null)?.folderFilter || '').trim();
    if (!incomingFolder) return;
    setFolderFilter(incomingFolder);
  }, [location.state]);

  const baseQuery: DocumentListQuery = useMemo(
    () => ({
      page: 1,
      pageSize: 200,
      search: search || undefined,
      documentType: typeFilter || undefined,
      folder: undefined,
    }),
    [search, typeFilter],
  );
  const baseCacheKey = useMemo(
    () =>
      JSON.stringify({
        page: 1,
        pageSize: 200,
        search: search || '',
        documentType: typeFilter || '',
        folder: '',
      }),
    [search, typeFilter],
  );

  const folderQuery: DocumentListQuery = useMemo(
    () => ({
      ...baseQuery,
      folder: folderFilter || undefined,
    }),
    [baseQuery, folderFilter],
  );
  const folderCacheKey = useMemo(
    () =>
      JSON.stringify({
        page: 1,
        pageSize: 200,
        search: search || '',
        documentType: typeFilter || '',
        folder: folderFilter || '',
      }),
    [search, typeFilter, folderFilter],
  );

  const baseCached = documentsLists[baseCacheKey];
  const folderCached = documentsLists[folderCacheKey];
  const baseDocuments: DocumentSummary[] = baseCached?.items || [];
  const folderDocuments: DocumentSummary[] =
    folderFilter.trim().length > 0 ? folderCached?.items || [] : baseDocuments;

  useEffect(() => {
    let mounted = true;
    setLoadingFolders(true);
    getConfig()
      .then((cfg) => {
        if (mounted) {
          setFolderConfigs(cfg.folderConfigs || []);
        }
      })
      .catch(() => {
        if (mounted) {
          setFolderConfigs([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingFolders(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [getConfig]);

  useEffect(() => {
    let mounted = true;
    if (baseCached) return;
    setLoading(true);
    ensureDocumentsList(baseCacheKey, () => listDocuments(baseQuery))
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [baseCacheKey, baseCached, ensureDocumentsList, listDocuments, baseQuery]);

  useEffect(() => {
    if (!folderFilter.trim()) return;
    let mounted = true;
    if (folderCached) return;
    setLoading(true);
    ensureDocumentsList(folderCacheKey, () => listDocuments(folderQuery))
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [folderFilter, folderCacheKey, folderCached, ensureDocumentsList, listDocuments, folderQuery]);

  useEffect(() => {
    if (!lastDocumentPersisted) return;
    let mounted = true;
    setLoading(true);
    ensureDocumentsList(baseCacheKey, () => listDocuments(baseQuery), true)
      .then(async () => {
        if (folderFilter.trim()) {
          await ensureDocumentsList(folderCacheKey, () => listDocuments(folderQuery), true);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [
    lastDocumentPersisted?.documentId,
    baseCacheKey,
    baseQuery,
    folderCacheKey,
    folderFilter,
    folderQuery,
    ensureDocumentsList,
    listDocuments,
  ]);

  const docTypeLabels: Record<string, string> = {
    user_reference: 'Reference',
    tutorial: 'Tutorial',
    test_case_suite: 'Test Cases',
    release_notes: 'Release Notes',
  };

  const folderConfigByKey = useMemo(() => {
    const map = new Map<string, FolderConfig>();
    for (const cfg of folderConfigs) {
      map.set(normalizeLookupKey(cfg.key), cfg);
    }
    return map;
  }, [folderConfigs]);

  const shelves = useMemo(() => {
    const map = new Map<string, { key: string; docs: DocumentSummary[] }>();
    for (const doc of baseDocuments) {
      const folder = normalizeFolder(doc.folder);
      const normalizedKey = normalizeLookupKey(folder);
      const existing = map.get(normalizedKey) || { key: folder, docs: [] };
      existing.docs.push(doc);
      map.set(normalizedKey, existing);
    }

    for (const config of folderConfigs) {
      const configuredKey = normalizeLookupKey(config.key || config.displayName);
      if (!map.has(configuredKey)) {
        map.set(configuredKey, {
          key: normalizeFolder(config.displayName || config.key),
          docs: [],
        });
      }
    }

    const items = Array.from(map.values()).map((entry) => {
      const config = folderConfigByKey.get(normalizeLookupKey(entry.key));
      const createdAtValues = entry.docs.map((doc) => new Date(doc.createdAtUtc).getTime());
      const fallbackCreatedAtMs = config?.createdAtUtc
        ? new Date(config.createdAtUtc).getTime()
        : Date.now();
      const fallbackUpdatedAtMs = config?.lastModifiedAtUtc
        ? new Date(config.lastModifiedAtUtc).getTime()
        : fallbackCreatedAtMs;

      return {
        key: entry.key,
        title: config?.displayName || toNormalText(entry.key),
        docs: entry.docs,
        count: entry.docs.length,
        createdAtMs: createdAtValues.length > 0 ? Math.min(...createdAtValues) : fallbackCreatedAtMs,
        updatedAtMs: createdAtValues.length > 0 ? Math.max(...createdAtValues) : fallbackUpdatedAtMs,
        subtitle: config?.description || describeShelf(entry.docs),
        previewImageUrl: config?.previewImageUrl || '',
        sortOrder: config?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      };
    });

    return items.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title);
    });
  }, [baseDocuments, folderConfigByKey, folderConfigs]);

  const visibleDocs = useMemo(() => {
    const docs = [...folderDocuments];
    docs.sort((a, b) => a.documentTitle.localeCompare(b.documentTitle));
    return docs;
  }, [folderDocuments]);

  const activeFolderConfig = useMemo(() => {
    if (!folderFilter.trim()) return null;
    return folderConfigByKey.get(normalizeLookupKey(folderFilter)) || null;
  }, [folderFilter, folderConfigByKey]);

  return (
    <div className="space-y-6 rounded-md border border-border bg-card p-5 text-foreground shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Organize documents by application folder.</p>
        </div>
        <div className="flex items-center gap-3">
          {folderFilter ? (
            <button
              onClick={() => setFolderFilter('')}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Documents
            </button>
          ) : null}
          {loadingFolders ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="text-primary" />
              Loading folders...
            </span>
          ) : loading ? <Spinner className="text-primary" /> : null}
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {['', 'user_reference', 'tutorial', 'test_case_suite', 'release_notes'].map((type) => (
            <Badge
              key={type}
              variant={typeFilter === type ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => {
                setTypeFilter(type);
              }}
            >
              {type === '' ? 'All' : docTypeLabels[type] || type}
            </Badge>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          <Spinner className="text-primary" />
          Fetching documents...
        </div>
      ) : null}

      {!folderFilter ? (
        shelves.length === 0 ? (
          <div className="rounded-md border border-border bg-muted/20 p-8 text-sm text-muted-foreground">
            No folders found. Move documents into folders to populate this view.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {shelves.map((shelf) => (
              <button
                key={shelf.key}
                type="button"
                onClick={() => setFolderFilter(shelf.key)}
                className="overflow-hidden rounded-md border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                <FolderCardPreview imageUrl={shelf.previewImageUrl} title={shelf.title} />
                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="text-xl leading-snug font-medium text-foreground">{shelf.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{shelf.subtitle}</p>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Star className="h-3.5 w-3.5" />
                      <span className="font-medium">Created</span>
                      <span>{timeAgo(shelf.createdAtMs)}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="font-medium">Updated</span>
                      <span>{timeAgo(shelf.updatedAtMs)}</span>
                    </p>
                    <p>{shelf.count} document{shelf.count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : visibleDocs.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/20 p-8 text-sm text-muted-foreground">
          No documents found in "{folderFilter}".
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleDocs.map((doc) => (
            <Link
              key={doc.documentId}
              to={`/app/documents/${doc.documentId}`}
              state={{ folderFilter }}
              className="rounded-md border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-accent/40"
            >
              <p className="line-clamp-2 text-base font-medium text-foreground">{doc.documentTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{doc.recordingName}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary">
                  {activeFolderConfig?.tag || docTypeLabels[doc.documentType] || doc.documentType}
                </Badge>
                <span className="text-xs text-muted-foreground">{timeAgo(new Date(doc.createdAtUtc).getTime())}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FolderCardPreview({
  imageUrl,
  title,
}: {
  imageUrl?: string;
  title: string;
}) {
  const [hasError, setHasError] = useState(false);
  const showImage = Boolean(imageUrl) && !hasError;

  return (
    <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-muted/60 via-muted/30 to-muted/10">
      {showImage ? (
        <img
          src={imageUrl}
          alt={`${title} preview`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : null}
    </div>
  );
}

function normalizeFolder(folder?: string): string {
  const trimmed = (folder || '').trim();
  return trimmed || 'Unfiled';
}

function describeShelf(docs: DocumentSummary[]): string {
  const area = docs[0]?.productArea || 'Web App';
  return `${toNormalText(area)} documentation`;
}

function normalizeLookupKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function toNormalText(value?: string): string {
  const text = String(value || '').trim();
  if (!text) return 'Unfiled';
  if (text.includes(' ')) {
    return text
      .split(' ')
      .filter(Boolean)
      .map((part) => normalizeWord(part))
      .join(' ');
  }
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => normalizeWord(part))
    .join(' ');
}

function normalizeWord(word: string): string {
  if (/^[A-Z0-9]{2,}$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function timeAgo(input: number): string {
  const deltaMs = Math.max(0, Date.now() - input);
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

