import { useEffect, useMemo, useState } from 'react';
import { clearDebugTrace, pushDebugTrace, readDebugTrace, subscribeDebugTrace, type DebugTraceEntry } from '../../lib/debug-trace';

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DebugTraceEntry[]>(() => readDebugTrace());
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeDebugTrace(() => setEntries(readDebugTrace())), []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const visibleEntries = useMemo(() => entries.slice(-20).reverse(), [entries]);

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[min(32rem,calc(100vw-2rem))]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mb-2 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground shadow-lg"
      >
        Debug
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{entries.length}</span>
      </button>

      {open ? (
        <div className="rounded-2xl border border-border bg-background/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Client Trace</p>
              <p className="text-xs text-muted-foreground">Recent renders, effects, state updates, and API calls</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const payload = JSON.stringify(readDebugTrace(), null, 2);
                await navigator.clipboard.writeText(payload);
                setCopied(true);
                pushDebugTrace('state', 'DebugPanel', 'Trace log copied to clipboard', {
                  entries: readDebugTrace().length,
                });
              }}
              className="rounded-lg border border-border px-2 py-1 text-xs text-foreground"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => {
                clearDebugTrace();
                setEntries([]);
                pushDebugTrace('state', 'DebugPanel', 'Trace log cleared');
              }}
              className="rounded-lg border border-border px-2 py-1 text-xs text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="max-h-[50vh] overflow-auto p-3">
            {visibleEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trace entries yet.</p>
            ) : (
              <div className="space-y-2">
                {visibleEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-border/80 bg-card px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {entry.kind}
                        </span>
                        <span className="text-xs font-medium text-foreground">{entry.source}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground">{entry.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{entry.path}</p>
                    {entry.meta ? (
                      <pre className="mt-2 overflow-auto rounded-md bg-muted/40 p-2 text-[10px] text-muted-foreground">
                        {JSON.stringify(entry.meta, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
