import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useAuth } from "../auth/auth-context";
import { useApi } from "../hooks/use-api";

interface Membership {
  workspaceId: string;
  workspaceName: string;
  accountType: string;
  role: string;
  joinedAtUtc: string;
}

export function WorkspaceSwitcher() {
  const { user, refreshUser } = useAuth();
  const { listMemberships, switchWorkspace } = useApi();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || memberships.length > 0) return;
    listMemberships()
      .then((result) => setMemberships(result))
      .catch(() => {});
  }, [isOpen, memberships.length, listMemberships]);

  const handleSwitch = useCallback(
    async (workspaceId: string) => {
      if (workspaceId === user?.workspaceId || isSwitching) return;
      setIsSwitching(workspaceId);
      try {
        await switchWorkspace(workspaceId);
        await refreshUser();
        window.location.reload();
      } catch {
        setIsSwitching(null);
      }
    },
    [user?.workspaceId, isSwitching, switchWorkspace, refreshUser],
  );

  const currentWorkspace = memberships.find(
    (m) => m.workspaceId === user?.workspaceId,
  );
  const currentName = currentWorkspace?.workspaceName || user?.workspaceName || "DocFlow";

  if (memberships.length <= 1) {
    return (
      <div>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.26em] text-primary/75">
          Workspace
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          {currentName}
        </h2>
      </div>
    );
  }

  return (
    <div>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.26em] text-primary/75">
        Workspace
      </p>
      <div ref={containerRef} className="relative mt-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border/80 bg-background/60 px-3 py-2.5 text-left text-sm text-foreground transition hover:border-primary/50"
        >
          <span className="truncate font-semibold">{currentName}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {isOpen ? (
          <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-border/80 bg-card/95 p-1 shadow-lg backdrop-blur">
            {memberships.map((m) => {
              const isActive = m.workspaceId === user?.workspaceId;
              const isBusy = isSwitching === m.workspaceId;
              return (
                <button
                  key={m.workspaceId}
                  type="button"
                  disabled={isActive || !!isSwitching}
                  onClick={() => void handleSwitch(m.workspaceId)}
                  className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm transition ${
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "opacity-0"}`}
                  />
                  <span className="truncate">{m.workspaceName}</span>
                  {isBusy ? (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      Switching...
                    </span>
                  ) : (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {m.role}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
