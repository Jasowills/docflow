import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronsRight,
  FileText,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../auth/auth-context";
import { Button } from "../ui/button";
import logo from "../../assets/docflow-logo-dark.svg";
import { useRealtimeNotificationsStore } from "../../state/realtime-store";
import { SESSION_EXPIRED_EVENT } from "../../auth/session-events";
import { useApi } from "../../hooks/use-api";
import { getApiBaseUrl } from "../../config/runtime-config";
import {
  EXTENSION_CONNECTED_UNTIL_KEY,
  isRecorderExtensionAvailable,
  isExtensionTokenStillValid,
  sendExtensionUploadAuth,
} from "../../lib/extension-bridge";
import { APP_TOAST_EVENT, type AppToastDetail } from "../../lib/app-toast";
import { DebugPanel } from "../debug/DebugPanel";
import { pushDebugTrace } from "../../lib/debug-trace";

type AppToastItem = {
  id: string;
  title: string;
  message: string;
  variant: "info" | "success" | "error";
};

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { path: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/app/recordings", label: "Recordings", icon: List },
  { path: "/app/generate", label: "Generate", icon: Sparkles },
  { path: "/app/documents", label: "Documents", icon: FileText },
  { path: "/app/settings", label: "Settings", icon: Settings },
];

let canPlayNotificationAudio = false;
let audioUnlockBound = false;

function ensureAudioUnlockListener() {
  if (audioUnlockBound) return;
  audioUnlockBound = true;

  const unlock = () => {
    canPlayNotificationAudio = true;
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };

  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

export function Layout() {
  const { user, logout } = useAuth();
  const { createExtensionUploadToken } = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllNotificationsRead } = useRealtimeNotificationsStore();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [toastItems, setToastItems] = useState<AppToastItem[]>([]);
  const [sessionToast, setSessionToast] = useState<string | null>(null);
  const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsHydratedRef = useRef(false);
  const sessionExpiryHandledRef = useRef(false);
  const extensionRefreshInFlightRef = useRef(false);
  const pendingExtensionExpiryUtcRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    ensureAudioUnlockListener();
  }, []);

  useEffect(() => {
    setIsSidebarOpen(false);
    setPendingNavigationPath(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!notificationsHydratedRef.current) {
      if (notifications.length === 0) return;
      notificationsHydratedRef.current = true;
      for (const item of notifications) {
        seenNotificationIdsRef.current.add(item.id);
      }
      return;
    }

    const nextRealtimeItems = notifications
      .filter((n) => !n.read)
      .filter((n) => !seenNotificationIdsRef.current.has(n.id))
      .slice(0, 3);

    if (nextRealtimeItems.length === 0) return;
    for (const item of nextRealtimeItems) {
      seenNotificationIdsRef.current.add(item.id);
    }
    setToastItems((prev) => [
      ...nextRealtimeItems.reverse().map((item) => ({
        id: item.id,
        title: item.actorName ? `${item.actorName} ${item.title}`.trim() : item.title,
        message: item.message,
        variant: "info" as const,
      })),
      ...prev,
    ].slice(0, 4));
    playNotificationTone();
  }, [notifications]);

  useEffect(() => {
    const onAppToast = (event: Event) => {
      const detail = (event as CustomEvent<AppToastDetail>).detail;
      if (!detail?.title) return;

      setToastItems((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: detail.title,
          message: detail.message || "",
          variant: detail.variant || "info",
        },
        ...prev,
      ].slice(0, 4));
    };

    window.addEventListener(APP_TOAST_EVENT, onAppToast);
    return () => window.removeEventListener(APP_TOAST_EVENT, onAppToast);
  }, []);

  useEffect(() => {
    if (toastItems.length === 0) return;
    const timers = toastItems.map((item) =>
      window.setTimeout(() => {
        setToastItems((prev) => prev.filter((t) => t.id !== item.id));
      }, 4000),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toastItems]);

  const handleLogout = () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    logout();
    window.location.assign("/login");
  };

  const handleNavClick = (item: NavItem) => {
    setIsSidebarOpen(false);

    const isCurrentRoute =
      location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

    if (isCurrentRoute) {
      return;
    }

    setPendingNavigationPath(item.path);
    navigate(item.path);
  };

  const handleOpenNotifications = () => {
    setIsNotificationOpen(true);

    if (unreadCount > 0) {
      pushDebugTrace(
        "effect",
        "Layout.notifications",
        "Opened notification drawer and marked unread items as read",
        { unreadCount },
      );
      markAllNotificationsRead();
      return;
    }

    pushDebugTrace(
      "effect",
      "Layout.notifications",
      "Opened notification drawer with no unread items",
    );
  };

  useEffect(() => {
    const onSessionExpired = (event: Event) => {
      if (sessionExpiryHandledRef.current) return;
      sessionExpiryHandledRef.current = true;
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setSessionToast(detail?.message || "Session expired. Signing out...");
      window.setTimeout(() => {
        handleLogout();
      }, 900);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    };
  }, []);

  useEffect(() => {
    const onExtensionAuthResult = (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;
      const data = event.data as {
        source?: string;
        type?: string;
        ok?: boolean;
      };
      if (
        data.source !== "docflow-recorder-extension" ||
        data.type !== "SET_EXTENSION_UPLOAD_AUTH_RESULT"
      ) {
        return;
      }

      if (data.ok && pendingExtensionExpiryUtcRef.current) {
        localStorage.setItem(
          EXTENSION_CONNECTED_UNTIL_KEY,
          pendingExtensionExpiryUtcRef.current,
        );
        pendingExtensionExpiryUtcRef.current = null;
      }
    };

    window.addEventListener("message", onExtensionAuthResult);
    return () => {
      window.removeEventListener("message", onExtensionAuthResult);
    };
  }, []);

  useEffect(() => {
    const EXTENSION_REFRESH_BUFFER_MS = 2 * 60 * 1000;
    const EXTENSION_REFRESH_CHECK_INTERVAL_MS = 60 * 1000;
    const EXTENSION_PING_TIMEOUT_MS = 700;
    if (!user) return;

    const pushFreshExtensionToken = async () => {
      if (extensionRefreshInFlightRef.current) return;
      extensionRefreshInFlightRef.current = true;
      try {
        const { token, expiresAtUtc } = await createExtensionUploadToken();
        const apiBaseUrl = getApiBaseUrl();
        const ok = await sendExtensionUploadAuth(
          { apiBaseUrl, bearerToken: token },
          { attempts: 4, pingTimeoutMs: 900, ackTimeoutMs: 1200, retryDelayMs: 350 },
        );
        if (ok) {
          pendingExtensionExpiryUtcRef.current = null;
          localStorage.setItem(EXTENSION_CONNECTED_UNTIL_KEY, expiresAtUtc);
        }
      } catch {
        // Silent by design.
      } finally {
        extensionRefreshInFlightRef.current = false;
      }
    };

    const ensureFreshExtensionToken = async () => {
      const connectedUntilUtc = localStorage.getItem(EXTENSION_CONNECTED_UNTIL_KEY);
      const millisecondsUntilExpiry = connectedUntilUtc
        ? new Date(connectedUntilUtc).getTime() - Date.now()
        : -1;
      if (isExtensionTokenStillValid() && millisecondsUntilExpiry > EXTENSION_REFRESH_BUFFER_MS) {
        return;
      }

      const extensionAvailable = await isRecorderExtensionAvailable(EXTENSION_PING_TIMEOUT_MS);
      if (!extensionAvailable) {
        return;
      }

      await pushFreshExtensionToken();
    };

    void ensureFreshExtensionToken();
    const refreshTimer = window.setInterval(
      () => void ensureFreshExtensionToken(),
      EXTENSION_REFRESH_CHECK_INTERVAL_MS,
    );

    return () => window.clearInterval(refreshTimer);
  }, [user, createExtensionUploadToken]);

  const sidebarContent = (
    <>
      <div className="border-b border-border/70 p-5">
        <div className="flex items-start justify-between gap-3 md:hidden">
          <img src={logo} alt="DOCFLOW" className="h-8 w-auto object-contain" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="hidden md:block">
          <img src={logo} alt="DOCFLOW" className="h-8 w-auto object-contain" />
        </div>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.26em] text-primary/75">
          Workspace
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          {user?.workspaceName || "DocFlow"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {user?.accountType === "team"
            ? "Shared operations for product, QA, and delivery teams."
            : "Personal operations for workflow capture and generation."}
        </p>
      </div>

      <div className="px-4 pt-4">
        <Link to="/app/generate">
          <Button className="w-full justify-between rounded-xl">
            New generation
            <PlusCircle className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <nav className="grid gap-1 p-4">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);
          const Icon = item.icon;
          const isPending = pendingNavigationPath === item.path;

          return (
            <button
              key={item.path}
              type="button"
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_14px_28px_hsl(var(--primary)/0.24)]"
                  : isPending
                    ? "bg-accent/80 text-foreground"
                    : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
              }`}
              onClick={() => handleNavClick(item)}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {isActive || isPending ? <ChevronsRight className="h-4 w-4" /> : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-4 pb-4">
        <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
          <div className="text-sm font-medium text-foreground">{user?.displayName || "User"}</div>
          <div className="mt-1 text-xs text-muted-foreground">{user?.email || ""}</div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-start"
            onClick={handleLogout}
            disabled={isSigningOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden">
      <div className="flex min-h-screen flex-col md:h-screen md:flex-row">
        <aside className="app-sidebar hidden h-screen w-72 shrink-0 border-r border-border/70 md:flex md:flex-col md:overflow-hidden">
          {sidebarContent}
        </aside>

        <div
          className={`fixed inset-0 z-50 md:hidden transition ${
            isSidebarOpen ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <div
            className={`absolute inset-0 bg-black/60 transition-opacity ${
              isSidebarOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setIsSidebarOpen(false)}
          />
          <aside
            className={`app-sidebar absolute left-0 top-0 flex h-full w-80 max-w-[88vw] flex-col border-r border-border/70 shadow-2xl transition-transform ${
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {sidebarContent}
          </aside>
        </div>

        <main className="app-shell flex-1 min-h-0 overflow-visible md:overflow-y-auto">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/72 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 p-4 md:px-8">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open sidebar"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
                    DocFlow Ops
                  </p>
                  <h1 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
                    {user?.workspaceName || "Workspace"}
                  </h1>
                </div>
              </div>

              <p className="hidden lg:block text-sm text-muted-foreground">
                Capture flows and generate structured documentation from one workspace.
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleOpenNotifications}
                  aria-label="Open notifications"
                  className="relative"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 min-w-4 rounded-sm bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </Button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {toastItems.length > 0 ? (
        <div className="fixed right-4 top-20 z-40 w-[min(22rem,calc(100vw-2rem))] space-y-2">
          {toastItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border bg-card/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.36)] ${
                item.variant === "error"
                  ? "border-destructive/40"
                  : item.variant === "success"
                    ? "border-primary/30"
                    : "border-border/80"
              }`}
            >
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              {item.message ? (
                <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {sessionToast ? (
        <div className="fixed right-4 top-4 z-[60] rounded-2xl border border-primary/30 bg-card px-4 py-3 shadow-lg">
          <p className="text-sm text-foreground">{sessionToast}</p>
        </div>
      ) : null}

      <div
        className={`fixed inset-0 z-50 transition ${
          isNotificationOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            isNotificationOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsNotificationOpen(false)}
        />
        <aside
          className={`absolute right-0 top-0 h-full w-full max-w-md border-l border-border/70 bg-background/92 shadow-2xl backdrop-blur-xl transition-transform ${
            isNotificationOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border/70 p-4">
              <div>
                <h2 className="text-base font-semibold">Notifications</h2>
                <p className="text-xs text-muted-foreground">Activity and realtime events</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={markAllNotificationsRead}>
                  Mark all read
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsNotificationOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-auto p-3">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications yet.</p>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 ${
                      item.read
                        ? "border-border/70 bg-background/40"
                        : "border-primary/20 bg-accent/55"
                    }`}
                  >
                    <p className="text-sm">
                      {item.actorName ? (
                        <>
                          <span className="font-semibold text-foreground">{item.actorName}</span>
                          <span className="text-muted-foreground">
                            {item.title.startsWith(item.actorName)
                              ? item.title.slice(item.actorName.length)
                              : ` ${item.title}`}
                          </span>
                        </>
                      ) : (
                        <span className="font-medium">{item.title}</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      <DebugPanel />
    </div>
  );
}

function playNotificationTone() {
  if (!canPlayNotificationAudio) {
    return;
  }

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    master.connect(ctx.destination);

    const note1 = ctx.createOscillator();
    const note1Gain = ctx.createGain();
    note1.type = "triangle";
    note1.frequency.setValueAtTime(784, now);
    note1.frequency.exponentialRampToValueAtTime(740, now + 0.14);
    note1Gain.gain.setValueAtTime(0.0001, now);
    note1Gain.gain.exponentialRampToValueAtTime(0.7, now + 0.018);
    note1Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    note1.connect(note1Gain);
    note1Gain.connect(master);
    note1.start(now);
    note1.stop(now + 0.18);

    const note2 = ctx.createOscillator();
    const note2Gain = ctx.createGain();
    note2.type = "sine";
    note2.frequency.setValueAtTime(1175, now + 0.1);
    note2.frequency.exponentialRampToValueAtTime(1047, now + 0.26);
    note2Gain.gain.setValueAtTime(0.0001, now + 0.09);
    note2Gain.gain.exponentialRampToValueAtTime(0.52, now + 0.125);
    note2Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    note2.connect(note2Gain);
    note2Gain.connect(master);
    note2.start(now + 0.09);
    note2.stop(now + 0.33);

    window.setTimeout(() => void ctx.close(), 700);
  } catch {
    // Ignore audio playback errors.
  }
}
