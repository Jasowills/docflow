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
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../auth/auth-context';
import { useAccessToken } from '../auth/use-access-token';
import { getApiBaseUrl, getRealtimeBaseUrl } from '../config/runtime-config';
import type { AuditLogEntry } from '@docflow/shared';
import { emitSessionExpired } from '../auth/session-events';

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

const RealtimeStoreContext = createContext<RealtimeStoreValue | null>(null);

export function RealtimeStoreProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const { getAccessToken } = useAccessToken();
  const [state, dispatch] = useReducer(reducer, initialState);
  const userId = user?.userId ?? null;
  const auditFetchInFlightRef = useRef<Promise<void> | null>(null);
  const lastAuditFetchAtRef = useRef(0);

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
        const token = await getAccessToken();
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
        const readIds = loadReadNotificationIds(userId);
        const mapped = entries.map((entry) => {
          const next = toAuditNotification(entry);
          return {
            ...next,
            read: markAsRead || readIds.has(next.id),
          };
        });
        if (markAsRead) {
          persistReadNotificationIds(
            userId,
            mapped.map((item) => item.id),
          );
        }
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
    [getAccessToken, userId],
  );

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
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
      dispatch({ type: 'RESET' });
      return;
    }

    if (!userId) {
      dispatch({ type: 'DISCONNECTED', error: 'Missing user claim for realtime session' });
      return;
    }

    dispatch({ type: 'CONNECTING' });
    const baseUrl = getRealtimeBaseUrl();
    const socket: Socket = io(baseUrl, {
      path: '/socket.io',
      auth: { userId },
    });

    socket.on('connect', () => dispatch({ type: 'CONNECTED' }));
    socket.on('disconnect', () => dispatch({ type: 'DISCONNECTED' }));
    socket.on('connect_error', (err: Error) =>
      dispatch({ type: 'DISCONNECTED', error: err.message || 'Realtime connection failed' }),
    );
    socket.on('recording.persisted', (payload: RecordingPersistedEvent) =>
      void (async () => {
        dispatch({ type: 'RECORDING_PERSISTED', payload });
        await fetchAuditNotifications(false);
      })(),
    );
    socket.on('document.persisted', (payload: DocumentPersistedEvent) =>
      void (async () => {
        dispatch({ type: 'DOCUMENT_PERSISTED', payload });
        await fetchAuditNotifications(false);
      })(),
    );

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, fetchAuditNotifications, userId]);

  const clearRealtimeError = useCallback(() => {
    dispatch({ type: 'DISCONNECTED' });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
    persistReadNotificationIds(
      userId,
      state.notifications.map((item) => item.id),
    );
  }, [state.notifications, userId]);

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
    <RealtimeStoreContext.Provider value={value}>
      {children}
    </RealtimeStoreContext.Provider>
  );
}

function readNotificationKey(userId: string | null): string | null {
  if (!userId) return null;
  return `rt-notification-read:${window.location.origin}:${userId}`;
}

function loadReadNotificationIds(userId: string | null): Set<string> {
  const key = readNotificationKey(userId);
  if (!key) return new Set<string>();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed.filter((value) => typeof value === 'string'));
  } catch {
    return new Set<string>();
  }
}

function persistReadNotificationIds(userId: string | null, ids: string[]) {
  const key = readNotificationKey(userId);
  if (!key) return;
  try {
    const existing = loadReadNotificationIds(userId);
    for (const id of ids) existing.add(id);
    const next = Array.from(existing).slice(-1000);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage write errors.
  }
}

export function useRealtimeStore() {
  const ctx = useContext(RealtimeStoreContext);
  if (!ctx) {
    throw new Error('useRealtimeStore must be used within RealtimeStoreProvider');
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

