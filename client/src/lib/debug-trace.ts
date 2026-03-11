export type DebugTraceKind = 'render' | 'effect' | 'api' | 'state' | 'nav';

export interface DebugTraceEntry {
  id: string;
  kind: DebugTraceKind;
  source: string;
  message: string;
  timestamp: string;
  path: string;
  meta?: Record<string, unknown>;
}

const MAX_TRACE_ENTRIES = 250;
const DEBUG_TRACE_EVENT = 'docflow:debug-trace';

declare global {
  interface Window {
    __DOCFLOW_DEBUG_TRACE__?: DebugTraceEntry[];
  }
}

export function pushDebugTrace(
  kind: DebugTraceKind,
  source: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  if (typeof window === 'undefined') return;

  const entry: DebugTraceEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    source,
    message,
    timestamp: new Date().toISOString(),
    path: window.location.pathname + window.location.search,
    meta,
  };

  window.__DOCFLOW_DEBUG_TRACE__ = [...(window.__DOCFLOW_DEBUG_TRACE__ || []), entry].slice(-MAX_TRACE_ENTRIES);
  window.dispatchEvent(new CustomEvent<DebugTraceEntry>(DEBUG_TRACE_EVENT, { detail: entry }));
  console.debug(`[DocFlowDebug][${kind}] ${source}: ${message}`, meta || {});
}

export function readDebugTrace(): DebugTraceEntry[] {
  if (typeof window === 'undefined') return [];
  return window.__DOCFLOW_DEBUG_TRACE__ || [];
}

export function clearDebugTrace() {
  if (typeof window === 'undefined') return;
  window.__DOCFLOW_DEBUG_TRACE__ = [];
}

export function subscribeDebugTrace(listener: (entry: DebugTraceEntry) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<DebugTraceEntry>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(DEBUG_TRACE_EVENT, handler);
  return () => window.removeEventListener(DEBUG_TRACE_EVENT, handler);
}
