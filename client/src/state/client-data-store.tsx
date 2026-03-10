import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import {
  useRealtimeStore,
  type RecordingPersistedEvent,
  type DocumentPersistedEvent,
} from './realtime-store';
import type {
  DocumentSummary,
  ExtensionReleaseInfo,
  PaginatedResponse,
  RecordingSummary,
} from '@docflow/shared';

interface DashboardSnapshot {
  recentDocs: DocumentSummary[];
  recordingCount: number;
  docCount: number;
  loadedAtUtc: string;
}

interface ClientDataState {
  dashboard: DashboardSnapshot | null;
  documentsLists: Record<string, PaginatedResponse<DocumentSummary>>;
  recordingsLists: Record<string, PaginatedResponse<RecordingSummary>>;
  extensionRelease: ExtensionReleaseInfo | null;
}

type ClientDataAction =
  | { type: 'SET_DASHBOARD'; payload: DashboardSnapshot }
  | { type: 'INCREMENT_RECORDING_COUNT' }
  | { type: 'INCREMENT_DOC_COUNT' }
  | { type: 'UPSERT_RECORDING_FROM_REALTIME'; payload: RecordingPersistedEvent }
  | { type: 'UPSERT_DOCUMENT_FROM_REALTIME'; payload: DocumentPersistedEvent }
  | { type: 'SET_DOCUMENTS_LIST'; key: string; payload: PaginatedResponse<DocumentSummary> }
  | { type: 'SET_RECORDINGS_LIST'; key: string; payload: PaginatedResponse<RecordingSummary> }
  | { type: 'SET_EXTENSION_RELEASE'; payload: ExtensionReleaseInfo | null }
  | { type: 'EVICT_RECORDING'; recordingId: string }
  | { type: 'EVICT_DOCUMENT'; documentId: string }
  | { type: 'RESET_DOCUMENTS_LISTS' };

const initialState: ClientDataState = {
  dashboard: null,
  documentsLists: {},
  recordingsLists: {},
  extensionRelease: null,
};

function reducer(state: ClientDataState, action: ClientDataAction): ClientDataState {
  switch (action.type) {
    case 'SET_DASHBOARD':
      return { ...state, dashboard: action.payload };
    case 'INCREMENT_RECORDING_COUNT':
      if (!state.dashboard) return state;
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          recordingCount: state.dashboard.recordingCount + 1,
        },
      };
    case 'INCREMENT_DOC_COUNT':
      if (!state.dashboard) return state;
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          docCount: state.dashboard.docCount + 1,
        },
      };
    case 'UPSERT_RECORDING_FROM_REALTIME': {
      const nextLists = Object.fromEntries(
        Object.entries(state.recordingsLists).map(([key, list]) => {
          const parsed = parseCacheKey(key);
          if (parsed.page && parsed.page !== 1) return [key, list];
          if (parsed.search) {
            const query = String(parsed.search).toLowerCase();
            if (!action.payload.name.toLowerCase().includes(query)) return [key, list];
          }

          const existingIndex = list.items.findIndex(
            (item) => item.metadata.recordingId === action.payload.recordingId,
          );
          const realtimeItem: RecordingSummary = {
            recordingId: action.payload.recordingId,
            metadata: {
              recordingId: action.payload.recordingId,
              name: action.payload.name,
              createdAtUtc: action.payload.uploadedAtUtc,
              createdBy: 'realtime',
              productName: 'DocFlow Capture',
              productArea: 'Web App',
            },
            uploadedAtUtc: action.payload.uploadedAtUtc,
            eventCount: action.payload.eventCount,
            transcriptCount: 0,
            screenshotCount: 0,
          };
          const nextItems =
            existingIndex >= 0
              ? list.items.map((item, index) =>
                  index === existingIndex
                    ? { ...item, ...realtimeItem, metadata: { ...item.metadata, ...realtimeItem.metadata } }
                    : item,
                )
              : [realtimeItem, ...list.items].slice(0, list.items.length || 20);
          return [key, { ...list, items: nextItems }];
        }),
      ) as Record<string, PaginatedResponse<RecordingSummary>>;
      return {
        ...state,
        recordingsLists: nextLists,
      };
    }
    case 'UPSERT_DOCUMENT_FROM_REALTIME': {
      const nextLists = Object.fromEntries(
        Object.entries(state.documentsLists).map(([key, list]) => {
          const parsed = parseCacheKey(key);
          if (parsed.page && parsed.page !== 1) return [key, list];
          if (parsed.search) {
            const query = String(parsed.search).toLowerCase();
            if (!action.payload.documentTitle.toLowerCase().includes(query)) return [key, list];
          }
          if (
            parsed.documentType &&
            String(parsed.documentType).length > 0 &&
            String(parsed.documentType) !== action.payload.documentType
          ) {
            return [key, list];
          }
          if (
            parsed.folder &&
            String(parsed.folder).length > 0 &&
            String(parsed.folder).toLowerCase() !== 'unfiled'
          ) {
            return [key, list];
          }

          const existingIndex = list.items.findIndex(
            (item) => item.documentId === action.payload.documentId,
          );
          const realtimeItem: DocumentSummary = {
            documentId: action.payload.documentId,
            documentTitle: action.payload.documentTitle,
            documentType: action.payload.documentType,
            recordingId: '',
            recordingName: 'Realtime update',
            productArea: 'Other',
            folder: 'Unfiled',
            createdAtUtc: action.payload.createdAtUtc,
            createdBy: 'realtime',
          };
          const nextItems =
            existingIndex >= 0
              ? list.items.map((item, index) =>
                  index === existingIndex ? { ...item, ...realtimeItem } : item,
                )
              : [realtimeItem, ...list.items].slice(0, list.items.length || 20);
          return [key, { ...list, items: nextItems }];
        }),
      ) as Record<string, PaginatedResponse<DocumentSummary>>;
      return {
        ...state,
        documentsLists: nextLists,
      };
    }
    case 'SET_DOCUMENTS_LIST':
      return {
        ...state,
        documentsLists: {
          ...state.documentsLists,
          [action.key]: action.payload,
        },
      };
    case 'SET_RECORDINGS_LIST':
      return {
        ...state,
        recordingsLists: {
          ...state.recordingsLists,
          [action.key]: action.payload,
        },
      };
    case 'SET_EXTENSION_RELEASE':
      return {
        ...state,
        extensionRelease: action.payload,
      };
    case 'EVICT_RECORDING': {
      let wasRemoved = false;
      const nextLists = Object.fromEntries(
        Object.entries(state.recordingsLists).map(([key, list]) => {
          const nextItems = list.items.filter((item) => {
            if (item.metadata?.recordingId === action.recordingId) {
              wasRemoved = true;
              return false;
            }
            return true;
          });
          if (nextItems.length === list.items.length) {
            return [key, list];
          }
          return [
            key,
            {
              ...list,
              items: nextItems,
              total: Math.max(0, list.total - 1),
            },
          ];
        }),
      ) as Record<string, PaginatedResponse<RecordingSummary>>;
      return {
        ...state,
        recordingsLists: nextLists,
        dashboard:
          wasRemoved && state.dashboard
            ? {
                ...state.dashboard,
                recordingCount: Math.max(0, state.dashboard.recordingCount - 1),
              }
            : state.dashboard,
      };
    }
    case 'EVICT_DOCUMENT': {
      let wasRemoved = false;
      const nextLists = Object.fromEntries(
        Object.entries(state.documentsLists).map(([key, list]) => {
          const nextItems = list.items.filter((item) => {
            if (item.documentId === action.documentId) {
              wasRemoved = true;
              return false;
            }
            return true;
          });
          if (nextItems.length === list.items.length) {
            return [key, list];
          }
          return [
            key,
            {
              ...list,
              items: nextItems,
              total: Math.max(0, list.total - 1),
            },
          ];
        }),
      ) as Record<string, PaginatedResponse<DocumentSummary>>;
      return {
        ...state,
        documentsLists: nextLists,
        dashboard:
          wasRemoved && state.dashboard
            ? {
                ...state.dashboard,
                docCount: Math.max(0, state.dashboard.docCount - 1),
                recentDocs: state.dashboard.recentDocs.filter(
                  (item) => item.documentId !== action.documentId,
                ),
              }
            : state.dashboard,
      };
    }
    case 'RESET_DOCUMENTS_LISTS':
      return {
        ...state,
        documentsLists: {},
      };
    default:
      return state;
  }
}

interface ClientDataStoreValue extends ClientDataState {
  ensureDashboard: (
    fetcher: () => Promise<Omit<DashboardSnapshot, 'loadedAtUtc'>>,
    force?: boolean,
  ) => Promise<DashboardSnapshot>;
  ensureDocumentsList: (
    key: string,
    fetcher: () => Promise<PaginatedResponse<DocumentSummary>>,
    force?: boolean,
  ) => Promise<PaginatedResponse<DocumentSummary>>;
  ensureRecordingsList: (
    key: string,
    fetcher: () => Promise<PaginatedResponse<RecordingSummary>>,
    force?: boolean,
  ) => Promise<PaginatedResponse<RecordingSummary>>;
  ensureExtensionRelease: (
    fetcher: () => Promise<ExtensionReleaseInfo>,
    force?: boolean,
  ) => Promise<ExtensionReleaseInfo>;
  evictRecording: (recordingId: string) => void;
  evictDocument: (documentId: string) => void;
  resetDocumentsLists: () => void;
}

const ClientDataStoreContext = createContext<ClientDataStoreValue | null>(null);

export function ClientDataStoreProvider({ children }: { children: ReactNode }) {
  const { lastRecordingPersisted, lastDocumentPersisted } = useRealtimeStore();
  const [state, dispatch] = useReducer(reducer, initialState);
  const inflightRef = useRef<Map<string, Promise<unknown>>>(new Map());

  const withInflightDedup = useCallback(async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    const existing = inflightRef.current.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const promise = (async () => {
      try {
        return await fn();
      } finally {
        inflightRef.current.delete(key);
      }
    })();
    inflightRef.current.set(key, promise);
    return promise;
  }, []);

  const ensureDashboard = useCallback(
    async (
      fetcher: () => Promise<Omit<DashboardSnapshot, 'loadedAtUtc'>>,
      force = false,
    ): Promise<DashboardSnapshot> => {
      if (!force && state.dashboard) return state.dashboard;
      return withInflightDedup('dashboard', async () => {
        const data = await fetcher();
        const snapshot: DashboardSnapshot = {
          ...data,
          loadedAtUtc: new Date().toISOString(),
        };
        dispatch({ type: 'SET_DASHBOARD', payload: snapshot });
        return snapshot;
      });
    },
    [state.dashboard, withInflightDedup],
  );

  const ensureDocumentsList = useCallback(
    async (
      key: string,
      fetcher: () => Promise<PaginatedResponse<DocumentSummary>>,
      force = false,
    ): Promise<PaginatedResponse<DocumentSummary>> => {
      const cached = state.documentsLists[key];
      if (!force && cached) return cached;
      return withInflightDedup(`documents:${key}`, async () => {
        const result = await fetcher();
        dispatch({ type: 'SET_DOCUMENTS_LIST', key, payload: result });
        return result;
      });
    },
    [state.documentsLists, withInflightDedup],
  );

  const ensureRecordingsList = useCallback(
    async (
      key: string,
      fetcher: () => Promise<PaginatedResponse<RecordingSummary>>,
      force = false,
    ): Promise<PaginatedResponse<RecordingSummary>> => {
      const cached = state.recordingsLists[key];
      if (!force && cached) return cached;
      return withInflightDedup(`recordings:${key}`, async () => {
        const result = await fetcher();
        dispatch({ type: 'SET_RECORDINGS_LIST', key, payload: result });
        return result;
      });
    },
    [state.recordingsLists, withInflightDedup],
  );

  const ensureExtensionRelease = useCallback(
    async (
      fetcher: () => Promise<ExtensionReleaseInfo>,
      force = false,
    ): Promise<ExtensionReleaseInfo> => {
      if (!force && state.extensionRelease) return state.extensionRelease;
      return withInflightDedup('extension-release', async () => {
        const result = await fetcher();
        dispatch({ type: 'SET_EXTENSION_RELEASE', payload: result });
        return result;
      });
    },
    [state.extensionRelease, withInflightDedup],
  );

  const evictRecording = useCallback((recordingId: string) => {
    dispatch({ type: 'EVICT_RECORDING', recordingId });
  }, []);

  const evictDocument = useCallback((documentId: string) => {
    dispatch({ type: 'EVICT_DOCUMENT', documentId });
  }, []);

  const resetDocumentsLists = useCallback(() => {
    dispatch({ type: 'RESET_DOCUMENTS_LISTS' });
  }, []);

  useEffect(() => {
    if (!lastRecordingPersisted) return;
    dispatch({ type: 'INCREMENT_RECORDING_COUNT' });
    dispatch({ type: 'UPSERT_RECORDING_FROM_REALTIME', payload: lastRecordingPersisted });
  }, [lastRecordingPersisted?.recordingId]);

  useEffect(() => {
    if (!lastDocumentPersisted) return;
    dispatch({ type: 'INCREMENT_DOC_COUNT' });
    dispatch({ type: 'UPSERT_DOCUMENT_FROM_REALTIME', payload: lastDocumentPersisted });
  }, [lastDocumentPersisted?.documentId]);

  const value = useMemo<ClientDataStoreValue>(
    () => ({
      ...state,
      ensureDashboard,
      ensureDocumentsList,
      ensureRecordingsList,
      ensureExtensionRelease,
      evictRecording,
      evictDocument,
      resetDocumentsLists,
    }),
    [
      state,
      ensureDashboard,
      ensureDocumentsList,
      ensureRecordingsList,
      ensureExtensionRelease,
      evictRecording,
      evictDocument,
      resetDocumentsLists,
    ],
  );

  return (
    <ClientDataStoreContext.Provider value={value}>
      {children}
    </ClientDataStoreContext.Provider>
  );
}

export function useClientDataStore() {
  const ctx = useContext(ClientDataStoreContext);
  if (!ctx) {
    throw new Error('useClientDataStore must be used within ClientDataStoreProvider');
  }
  return ctx;
}

function parseCacheKey(key: string): Record<string, unknown> {
  try {
    return JSON.parse(key) as Record<string, unknown>;
  } catch {
    return {};
  }
}

