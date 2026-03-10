import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/auth-context";
import { Button } from "../ui/button";
import lightLogo from "../../assets/docflow-logo-light.svg";
import darkLogo from "../../assets/docflow-logo-dark.svg";
import {
  FileText,
  BookOpenCheck,
  List,
  Sparkles,
  Settings,
  LogOut,
  LayoutDashboard,
  Moon,
  Sun,
  Bell,
  X,
  Menu,
  Github,
  ClipboardCheck,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRealtimeStore, type NotificationItem } from "../../state/realtime-store";
import { SESSION_EXPIRED_EVENT } from "../../auth/session-events";
import { useApi } from "../../hooks/use-api";
import { getApiBaseUrl } from "../../config/runtime-config";
import {
  EXTENSION_CONNECTED_UNTIL_KEY,
  isExtensionTokenStillValid,
  sendExtensionUploadAuth,
} from "../../lib/extension-bridge";

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

const navItems = [
  { path: "/app/getting-started", label: "Getting Started", icon: BookOpenCheck },
  { path: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/app/recordings", label: "Recordings", icon: List },
  { path: "/app/generate", label: "Generate Docs", icon: Sparkles },
  { path: "/app/documents", label: "Documents", icon: FileText },
  { path: "/app/workspace", label: "Workspace", icon: Users },
  { path: "/app/github", label: "GitHub", icon: Github },
  { path: "/app/test-plans", label: "Test Plans", icon: ClipboardCheck },
  { path: "/app/admin/config", label: "Settings", icon: Settings },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { createExtensionUploadToken } = useApi();
  const location = useLocation();
  const { notifications, unreadCount, markAllNotificationsRead } = useRealtimeStore();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [toastItems, setToastItems] = useState<NotificationItem[]>([]);
  const [sessionToast, setSessionToast] = useState<string | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsHydratedRef = useRef(false);
  const sessionExpiryHandledRef = useRef(false);
  const extensionRefreshInFlightRef = useRef(false);
  const pendingExtensionExpiryUtcRef = useRef<string | null>(null);

  useEffect(() => {
    ensureAudioUnlockListener();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // Don't toast historical notifications loaded during initial page hydration.
    if (!notificationsHydratedRef.current) {
      if (notifications.length === 0) {
        return;
      }
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
    setToastItems((prev) => [...nextRealtimeItems.reverse(), ...prev].slice(0, 4));
    playNotificationTone();
  }, [notifications]);

  useEffect(() => {
    if (toastItems.length === 0) return;
    const timers = toastItems.map((item) =>
      window.setTimeout(() => {
        setToastItems((prev) => prev.filter((t) => t.id !== item.id));
      }, 4000),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [toastItems]);

  const handleLogout = () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    logout();
    window.location.assign('/login');
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
  }, [handleLogout]);

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
        // Silent by design: auto-connect should not block app usage.
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
      await pushFreshExtensionToken();
    };

    void ensureFreshExtensionToken();
    const refreshTimer = window.setInterval(
      () => void ensureFreshExtensionToken(),
      EXTENSION_REFRESH_CHECK_INTERVAL_MS,
    );

    return () => window.clearInterval(refreshTimer);
  }, [user, createExtensionUploadToken]);
  const logoSrc = theme === "dark" ? darkLogo : lightLogo;

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex flex-col items-start">
          <img
            src={logoSrc}
            alt="DocFlow"
            className="h-8 w-auto object-contain"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 md:grid-cols-1 md:gap-1">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-4 mt-auto">
        <div className="rounded-md border border-border bg-background/70 p-3">
          <div className="text-sm font-medium truncate">
            {user?.displayName || "User"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {user?.email || ""}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start"
            onClick={handleLogout}
            disabled={isSigningOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen md:h-screen flex flex-col md:flex-row md:overflow-hidden">
      <aside className="hidden md:flex w-72 h-screen shrink-0 border-r border-border bg-card/80 backdrop-blur-xl flex-col overflow-hidden">
        {sidebarContent}
      </aside>

      <div
        className={`fixed inset-0 z-50 md:hidden transition ${
          isSidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            isSidebarOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-card border-r border-border shadow-2xl transition-transform ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } flex flex-col`}
        >
          {sidebarContent}
        </aside>
      </div>

      <main className="flex-1 min-h-0 overflow-visible md:overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto p-4 md:px-8 flex items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <h1 className="text-lg font-bold tracking-tight">DocFlow</h1>
              <span className="hidden sm:inline">|</span>
              <p className="hidden sm:block text-xs text-muted-foreground">
                Workflow Documentation Platform
              </p>
            </div>
            <p className="hidden lg:block text-sm text-muted-foreground">
              Capture flows. Generate docs, tests, and release-ready assets.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsNotificationOpen(true)}
                aria-label="Open notifications"
                className="relative"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-sm bg-primary text-[10px] text-primary-foreground leading-4">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </header>
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {toastItems.length > 0 && (
        <div className="fixed right-4 top-20 z-40 space-y-2 w-[min(20rem,calc(100vw-2rem))]">
          {toastItems.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-border bg-card p-3 shadow-lg"
            >
              <p className="text-sm">
                {item.actorName ? (
                  <>
                    <span className="font-semibold text-foreground">
                      {item.actorName}
                    </span>
                    <span className="text-muted-foreground">
                      {item.title.startsWith(item.actorName)
                        ? item.title.slice(item.actorName.length)
                        : ` ${item.title}`}
                    </span>
                  </>
                ) : (
                  <span className="font-semibold">{item.title}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {item.message}
              </p>
            </div>
          ))}
        </div>
      )}
      {sessionToast && (
        <div className="fixed right-4 top-4 z-[60] rounded-md border border-primary/30 bg-card px-3 py-2 shadow-lg">
          <p className="text-sm text-foreground">{sessionToast}</p>
        </div>
      )}

      <div
        className={`fixed inset-0 z-50 transition ${
          isNotificationOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity ${
            isNotificationOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsNotificationOpen(false)}
        />
        <aside
          className={`absolute right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl transition-transform ${
            isNotificationOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Notifications</h2>
                <p className="text-xs text-muted-foreground">
                  Audit logs and realtime events
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllNotificationsRead}
                >
                  Mark all read
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsNotificationOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-md border p-3 ${
                      item.read
                        ? "bg-background border-border"
                        : "bg-accent/40 border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm">
                        {item.actorName ? (
                          <>
                            <span className="font-semibold text-foreground">
                              {item.actorName}
                            </span>
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
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
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
    note1.frequency.setValueAtTime(784, now); // G5
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
    note2.frequency.setValueAtTime(1175, now + 0.1); // D6
    note2.frequency.exponentialRampToValueAtTime(1047, now + 0.26); // C6
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

