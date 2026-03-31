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
import { useAuth } from '../auth/auth-context';
import { useAccessToken } from '../auth/use-access-token';
import { getApiBaseUrl } from '../config/runtime-config';
import type { AuditLogEntry } from '@docflow/shared';
import { emitSessionExpired } from '../auth/session-events';
import { pushDebugTrace } from '../lib/debug-trace';

export interface RecordingPersistedEvent {
  recordingId: string;
  name: string;
  uploadedAtUtc: string;
  eventCount: number;
}

export interface DocumentPersistedEvent {
  documentId: string;
  documentTitle: string;
  documentType: string;
  createdAtUtc: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  source: 'audit';
  actorName?: string;
}

type RealtimeStatus = 'disconnected' | 'connecting' | 'connected';

interface RealtimeState {
  status: RealtimeStatus;
  error: string | null;
  lastRecordingPersisted: RecordingPersistedEvent | null;
  lastDocumentPersisted: DocumentPersistedEvent | null;
  notifications: NotificationItem[];
}

type RealtimeAction =
  | { type: 'CONNECTING' }
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED'; error?: string }
  | { type: 'RESET' }
  | { type: 'SET_AUDIT_NOTIFICATIONS'; payload: NotificationItem[]; markAsRead?: boolean }
  | { type: 'RECORDING_PERSISTED'; payload: RecordingPersistedEvent }
  | { type: 'DOCUMENT_PERSISTED'; payload: DocumentPersistedEvent }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' };

const initialState: RealtimeState = {
  status: 'disconnected',
  error: null,
  lastRecordingPersisted: null,
  lastDocumentPersisted: null,
  notifications: [],
};

function reducer(state: RealtimeState, action: RealtimeAction): RealtimeState {
  switch (action.type) {
    case 'CONNECTING':
      return { ...state, status: 'connecting', error: null };
    case 'CONNECTED':
      return { ...state, status: 'connected', error: null };
    case 'DISCONNECTED':
      return { ...state, status: 'disconnected', error: action.error || null };
    case 'RESET':
      return { ...initialState };
    case 'SET_AUDIT_NOTIFICATIONS':
      return {
        ...state,
        notifications: mergeNotifications(
          action.markAsRead
            ? action.payload.map((n) => ({ ...n, read: true }))
            : action.payload,
          state.notifications,
        ),
      };
    case 'RECORDING_PERSISTED':
      return {
        ...state,
        lastRecordingPersisted: action.payload,
      };
    case 'DOCUMENT_PERSISTED':
      return {
        ...state,
        lastDocumentPersisted: action.payload,
      };
    case 'MARK_ALL_NOTIFICATIONS_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };
    default:
      return state;
  }
}

interface RealtimeStoreValue extends RealtimeState {
  clearRealtimeError: () => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;
}

interface RealtimeEventsValue {
  status: RealtimeStatus;
  error: string | null;
  lastRecordingPersisted: RecordingPersistedEvent | null;
  lastDocumentPersisted: DocumentPersistedEvent | null;
  clearRealtimeError: () => void;
}

interface RealtimeNotificationsValue {
  notifications: NotificationItem[];
  unreadCount: number;
  markAllNotificationsRead: () => void;
}

const RealtimeStoreContext = createContext<RealtimeStoreValue | null>(null);
const RealtimeEventsContext = createContext<RealtimeEventsValue | null>(null);
const RealtimeNotificationsContext = createContext<RealtimeNotificationsValue | null>(null);

export function RealtimeStoreProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const { getAccessToken } = useAccessToken();
  const [state, dispatch] = useReducer(reducer, initialState);
  const userId = user?.userId ?? null;
  const getAccessTokenRef = useRef(getAccessToken);
  const notificationsRef = useRef(state.notifications);
  const auditFetchInFlightRef = useRef<Promise<void> | null>(null);
  const lastAuditFetchAtRef = useRef(0);

  useEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  }, [getAccessToken]);

  useEffect(() => {
    notificationsRef.current = state.notifications;
  }, [state.notifications]);

  useEffect(() => {
    pushDebugTrace('state', 'RealtimeStore', 'Realtime state changed', {
      status: state.status,
      error: state.error,
      notifications: state.notifications.length,
      unreadCount: state.notifications.filter((n) => !n.read).length,
      lastRecordingPersisted: state.lastRecordingPersisted?.recordingId || null,
      lastDocumentPersisted: state.lastDocumentPersisted?.documentId || null,
    });
  }, [
    state.status,
    state.error,
    state.notifications,
    state.lastRecordingPersisted?.recordingId,
    state.lastDocumentPersisted?.documentId,
  ]);

  const fetchAuditNotifications = useCallback(
    async (markAsRead = false) => {
      const now = Date.now();
      if (!markAsRead && auditFetchInFlightRef.current) {
        return auditFetchInFlightRef.current;
      }
      if (!markAsRead && now - lastAuditFetchAtRef.current < 1500) {
        return;
      }

      const run = async () => {
        lastAuditFetchAtRef.current = Date.now();
        const token = await getAccessTokenRef.current();
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/audit?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 401) {
            emitSessionExpired('Session expired. Signing out...');
            return;
          }
          dispatch({
            type: 'SET_AUDIT_NOTIFICATIONS',
            payload: [
              {
                id: `audit-fetch-error:${Date.now()}`,
                title: 'Audit notifications unavailable',
                message: `Failed to load audit logs (${res.status})`,
                timestamp: new Date().toISOString(),
                read: false,
                source: 'audit',
              },
            ],
          });
          return;
        }
        const entries = (await res.json()) as AuditLogEntry[];
        const mapped = entries.map((entry) => {
          const next = toAuditNotification(entry);
          return {
            ...next,
            read: entry.read ?? false,
          };
        });
        dispatch({
          type: 'SET_AUDIT_NOTIFICATIONS',
          payload: mapped,
        });
      };

      const promise = run().finally(() => {
        if (auditFetchInFlightRef.current === promise) {
          auditFetchInFlightRef.current = null;
        }
      });
      if (!markAsRead) {
        auditFetchInFlightRef.current = promise;
      }
      return promise;
    },
    [userId],
  );

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    pushDebugTrace('effect', 'RealtimeStore.fetchAuditNotifications', 'Initial audit notification fetch', {
      userId,
    });
    void (async () => {
      try {
        await fetchAuditNotifications(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load audit logs';
        if (message.toLowerCase().includes('authentication expired')) {
          emitSessionExpired('Session expired. Signing out...');
          return;
        }
        dispatch({
          type: 'SET_AUDIT_NOTIFICATIONS',
          payload: [
            {
              id: `audit-fetch-error:${Date.now()}`,
              title: 'Audit notifications unavailable',
              message,
              timestamp: new Date().toISOString(),
              read: false,
              source: 'audit',
            },
          ],
        });
      }
    })();
  }, [isAuthenticated, fetchAuditNotifications, userId]);

  useEffect(() => {
    if (!isAuthenticated) {
      pushDebugTrace('effect', 'RealtimeStore.sse', 'Resetting realtime because user is not authenticated');
      dispatch({ type: 'RESET' });
      return;
    }

    if (!userId) {
      pushDebugTrace('effect', 'RealtimeStore.sse', 'Missing userId for realtime session');
      dispatch({ type: 'DISCONNECTED', error: 'Missing user claim for realtime session' });
      return;
    }

    pushDebugTrace('effect', 'RealtimeStore.sse', 'Opening SSE connection', { userId });
    dispatch({ type: 'CONNECTING' });

    const baseUrl = getApiBaseUrl();
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isManualClose = false;

    const connect = async () => {
      if (!isAuthenticated) return;

      const token = await getAccessTokenRef.current();
      if (!token) {
        dispatch({ type: 'DISCONNECTED', error: 'No access token available' });
        return;
      }

      eventSource = new EventSource(`${baseUrl}/api/realtime/events`, {
        withCredentials: true,
      });

      eventSource.onopen = () => {
        pushDebugTrace('state', 'RealtimeStore.sse', 'SSE connected', { userId });
        dispatch({ type: 'CONNECTED' });
      };

      eventSource.onerror = () => {
        pushDebugTrace('state', 'RealtimeStore.sse', 'SSE error', { userId });
        if (eventSource?.readyState === EventSource.CLOSED || isManualClose) {
          dispatch({ type: 'DISCONNECTED' });
          return;
        }
        dispatch({ type: 'DISCONNECTED', error: 'SSE connection lost' });
        eventSource?.close();
        reconnectTimeout = setTimeout(connect, 5000);
      };

      eventSource.addEventListener('recording.persisted', async (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data) as RecordingPersistedEvent;
          pushDebugTrace('state', 'RealtimeStore.sse', 'recording.persisted received', {
            recordingId: payload.recordingId,
          });
          dispatch({ type: 'RECORDING_PERSISTED', payload });
          await fetchAuditNotifications(false);
        } catch (parseErr) {
          console.warn('Failed to parse recording.persisted event:', parseErr);
        }
      });

      eventSource.addEventListener('document.persisted', async (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data) as DocumentPersistedEvent;
          pushDebugTrace('state', 'RealtimeStore.sse', 'document.persisted received', {
            documentId: payload.documentId,
          });
          dispatch({ type: 'DOCUMENT_PERSISTED', payload });
          await fetchAuditNotifications(false);
        } catch (parseErr) {
          console.warn('Failed to parse document.persisted event:', parseErr);
        }
      });
    };

    void connect();

    return () => {
      isManualClose = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        pushDebugTrace('effect', 'RealtimeStore.sse', 'Closing SSE connection', { userId });
        eventSource.close();
      }
      dispatch({ type: 'DISCONNECTED' });
    };
  }, [isAuthenticated, fetchAuditNotifications, userId]);

  const clearRealtimeError = useCallback(() => {
    dispatch({ type: 'DISCONNECTED' });
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
    
    try {
      const token = await getAccessToken();
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/audit/mark-all-read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.warn('Failed to mark all notifications as read on server');
      }
    } catch (error) {
      console.warn('Failed to mark all notifications as read:', error);
    }
  }, [userId, getAccessToken]);

  const eventsValue = useMemo<RealtimeEventsValue>(
    () => ({
      status: state.status,
      error: state.error,
      lastRecordingPersisted: state.lastRecordingPersisted,
      lastDocumentPersisted: state.lastDocumentPersisted,
      clearRealtimeError,
    }),
    [
      state.status,
      state.error,
      state.lastRecordingPersisted,
      state.lastDocumentPersisted,
      clearRealtimeError,
    ],
  );

  const notificationsValue = useMemo<RealtimeNotificationsValue>(
    () => ({
      notifications: state.notifications,
      unreadCount: state.notifications.filter((n) => !n.read).length,
      markAllNotificationsRead,
    }),
    [state.notifications, markAllNotificationsRead],
  );

  const value = useMemo(
    () => ({
      ...state,
      clearRealtimeError,
      markAllNotificationsRead,
      unreadCount: state.notifications.filter((n) => !n.read).length,
    }),
    [state, clearRealtimeError, markAllNotificationsRead],
  );

  return (
    <RealtimeEventsContext.Provider value={eventsValue}>
      <RealtimeNotificationsContext.Provider value={notificationsValue}>
        <RealtimeStoreContext.Provider value={value}>
          {children}
        </RealtimeStoreContext.Provider>
      </RealtimeNotificationsContext.Provider>
    </RealtimeEventsContext.Provider>
  );
}

export function useRealtimeStore() {
  const ctx = useContext(RealtimeStoreContext);
  if (!ctx) {
    throw new Error('useRealtimeStore must be used within RealtimeStoreProvider');
  }
  return ctx;
}

export function useRealtimeEventsStore() {
  const ctx = useContext(RealtimeEventsContext);
  if (!ctx) {
    throw new Error('useRealtimeEventsStore must be used within RealtimeStoreProvider');
  }
  return ctx;
}

export function useRealtimeNotificationsStore() {
  const ctx = useContext(RealtimeNotificationsContext);
  if (!ctx) {
    throw new Error('useRealtimeNotificationsStore must be used within RealtimeStoreProvider');
  }
  return ctx;
}

function mergeNotifications(incoming: NotificationItem[], existing: NotificationItem[]) {
  const map = new Map<string, NotificationItem>();
  for (const n of existing) {
    map.set(n.id, n);
  }
  for (const n of incoming) {
    const prev = map.get(n.id);
    map.set(n.id, {
      ...n,
      // Preserve already-read state when refetching the same notification IDs.
      read: prev?.read ?? n.read,
    });
  }
  return Array.from(map.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 200);
}

function toAuditNotification(entry: AuditLogEntry): NotificationItem {
  const actor = deriveDisplayName(entry.userEmail);
  const resourceLabel = entry.resourceType.replace(/_/g, ' ');
  const actionLabel = humanizeAction(entry.action);
  const objectName = deriveObjectName(entry);

  return {
    id: `audit:${entry.userId}:${entry.timestamp}:${entry.action}:${entry.resourceId || 'na'}`,
    title: `${actor} ${actionLabel} ${withArticle(resourceLabel)}`.trim(),
    message: objectName || `${resourceLabel}${entry.resourceId ? ` (${entry.resourceId})` : ''}`,
    timestamp: entry.timestamp,
    read: false,
    source: 'audit',
    actorName: actor,
  };
}


function deriveDisplayName(emailOrUpn: string): string {
  const localPart = emailOrUpn.split('@')[0] || '';
  const normalized = localPart
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  if (!normalized) return 'User';
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function humanizeAction(action: string): string {
  const normalized = action.toLowerCase();
  if (normalized.includes('upload')) return 'uploaded';
  if (normalized.includes('generate')) return 'generated';
  if (normalized.includes('delete')) return 'deleted';
  if (normalized.includes('update') || normalized.includes('upsert')) return 'updated';
  if (normalized.includes('create')) return 'created';
  return normalized.replace(/_/g, ' ');
}

function withArticle(resourceType: string): string {
  const first = resourceType.charAt(0).toLowerCase();
  const article = ['a', 'e', 'i', 'o', 'u'].includes(first) ? 'an' : 'a';
  return `${article} ${resourceType}`;
}

function deriveObjectName(entry: AuditLogEntry): string {
  const details = entry.details || {};
  const candidate = [
    details.name,
    details.documentTitle,
    details.recordingName,
  ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;
  return candidate ? `"${candidate}"` : '';
}

