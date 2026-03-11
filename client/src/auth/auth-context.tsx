import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLogto } from "@logto/react";
import { emitSessionExpired } from "./session-events";
import { pushDebugTrace } from "../lib/debug-trace";
import {
  getApiBaseUrl,
  getAuthMode,
  getLogtoApiResource,
  getLogtoCallbackUrl,
} from "../config/runtime-config";
import type { AccountType } from "@docflow/shared";

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  accountType: AccountType;
  teamName?: string;
  workspaceId?: string;
  workspaceName?: string;
  onboardingCompletedAt?: string;
  onboardingState?: Record<string, unknown>;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface RegisterPayload {
  displayName: string;
  email: string;
  password: string;
  accountType: AccountType;
  teamName?: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload?: LoginPayload) => Promise<void>;
  register: (payload?: RegisterPayload) => Promise<void>;
  logout: () => void;
  getAccessToken: () => Promise<string>;
  refreshUser: () => Promise<void>;
}

const ACCESS_TOKEN_KEY = "docflow.auth.accessToken";
const REFRESH_TOKEN_KEY = "docflow.auth.refreshToken";
const USER_KEY = "docflow.auth.user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  return getAuthMode() === "logto" ? (
    <LogtoManagedAuthProvider>{children}</LogtoManagedAuthProvider>
  ) : (
    <JwtAuthProvider>{children}</JwtAuthProvider>
  );
}

function JwtAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(USER_KEY);
      const storedAccess = localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);

      setUser(storedUser ? (JSON.parse(storedUser) as AuthUser) : null);
      setAccessToken(storedAccess || null);
      setRefreshToken(storedRefresh || null);
    } catch {
      clearStoredAuth();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persistAuth = useCallback((payload: AuthResponse) => {
    setUser(payload.user);
    setAccessToken(payload.accessToken);
    setRefreshToken(payload.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    clearStoredAuth();
  }, []);

  const login = useCallback(
    async (payload?: LoginPayload) => {
      if (!payload) {
        throw new Error("Email and password are required.");
      }
      const response = await fetchJson<AuthResponse>("/auth/login", payload);
      persistAuth(response);
    },
    [persistAuth],
  );

  const register = useCallback(
    async (payload?: RegisterPayload) => {
      if (!payload) {
        throw new Error("Registration details are required.");
      }
      const response = await fetchJson<AuthResponse>("/auth/register", payload);
      persistAuth(response);
    },
    [persistAuth],
  );

  const refresh = useCallback(async (): Promise<string> => {
    if (!refreshToken) {
      logout();
      throw new Error("No refresh token available");
    }

    try {
      const response = await fetchJson<AuthResponse>("/auth/refresh", {
        refreshToken,
      });
      persistAuth(response);
      return response.accessToken;
    } catch (error) {
      logout();
      emitSessionExpired("Session expired. Please sign in again.");
      throw error;
    }
  }, [refreshToken, persistAuth, logout]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (!accessToken) {
      throw new Error("No authenticated session");
    }

    if (!isJwtExpired(accessToken)) {
      return accessToken;
    }

    return refresh();
  }, [accessToken, refresh]);

  const refreshUser = useCallback(async () => {
    const token = await getAccessToken();
    const profile = await fetchMe(token);
    setUser(profile);
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
  }, [getAccessToken]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      getAccessToken,
      refreshUser,
    }),
    [user, isLoading, login, register, logout, getAccessToken, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function LogtoManagedAuthProvider({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isLoading: isLogtoLoading,
    signIn,
    signOut,
    getAccessToken: getLogtoAccessToken,
    fetchUserInfo,
  } = useLogto();
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const storedUser = localStorage.getItem(USER_KEY);
      return storedUser ? (JSON.parse(storedUser) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const getLogtoAccessTokenRef = useRef(getLogtoAccessToken);
  const fetchUserInfoRef = useRef(fetchUserInfo);
  const userRef = useRef<AuthUser | null>(user);
  const lastBootstrappedTokenRef = useRef<string | null>(null);
  const bootstrapInFlightRef = useRef<Promise<void> | null>(null);
  const bootstrapSettledRef = useRef(false);

  useEffect(() => {
    getLogtoAccessTokenRef.current = getLogtoAccessToken;
  }, [getLogtoAccessToken]);

  useEffect(() => {
    fetchUserInfoRef.current = fetchUserInfo;
  }, [fetchUserInfo]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    pushDebugTrace("state", "AuthProvider", "Auth state changed", {
      authMode: "logto",
      isAuthenticated,
      isLogtoLoading,
      isBootstrapping,
      userId: user?.userId || null,
      workspaceId: user?.workspaceId || null,
    });
  }, [isAuthenticated, isLogtoLoading, isBootstrapping, user?.userId, user?.workspaceId]);

  const logout = useCallback(() => {
    setUser(null);
    clearStoredAuth();
    lastBootstrappedTokenRef.current = null;
    bootstrapInFlightRef.current = null;
    bootstrapSettledRef.current = false;
    void signOut(`${window.location.origin}/login`);
  }, [signOut]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    const resource = getLogtoApiResource();
    const token = resource
      ? await getLogtoAccessTokenRef.current(resource)
      : await getLogtoAccessTokenRef.current();
    if (!token) {
      throw new Error("No authenticated session");
    }
    return token;
  }, []);

  const bootstrapLogtoUser = useCallback(async (token: string): Promise<AuthUser> => {
    const userInfo = await fetchUserInfoRef.current().catch(() => null);

    const email =
      typeof userInfo?.email === "string" && userInfo.email.trim()
        ? userInfo.email.trim()
        : undefined;
    const displayName = resolvePreferredProfileName({
      name: typeof userInfo?.name === "string" ? userInfo.name : undefined,
      username: typeof userInfo?.username === "string" ? userInfo.username : undefined,
      email,
    });

    if (!email && !displayName) {
      throw new Error("Logto profile did not include usable identity fields.");
    }

    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/auth/logto-bootstrap`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        displayName,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        errorBody.message || `Request failed with status ${response.status}`,
      );
    }

    return response.json() as Promise<AuthUser>;
  }, []);

  useEffect(() => {
    if (isLogtoLoading) {
      return;
    }

    if (!isAuthenticated) {
      clearStoredAuth();
      setUser(null);
      setIsBootstrapping(false);
      lastBootstrappedTokenRef.current = null;
      bootstrapInFlightRef.current = null;
      bootstrapSettledRef.current = false;
      return;
    }

    if (bootstrapInFlightRef.current || bootstrapSettledRef.current) {
      return;
    }

    setIsBootstrapping(true);
    const run = async () => {
      try {
        const token = await getAccessToken();
        if (userRef.current && lastBootstrappedTokenRef.current === token) {
          bootstrapSettledRef.current = true;
          return;
        }

        const profile =
          lastBootstrappedTokenRef.current === token
            ? await fetchMe(token)
            : await bootstrapLogtoUser(token);

        setUser(profile);
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        lastBootstrappedTokenRef.current = token;
        bootstrapSettledRef.current = true;
      } catch {
        setUser(null);
        clearStoredAuth();
        bootstrapSettledRef.current = false;
      } finally {
        setIsBootstrapping(false);
        bootstrapInFlightRef.current = null;
      }
    };

    bootstrapInFlightRef.current = run();
    void bootstrapInFlightRef.current;
  }, [bootstrapLogtoUser, getAccessToken, isAuthenticated, isLogtoLoading]);

  const refreshUser = useCallback(async () => {
    const token = await getAccessToken();
    const profile = await fetchMe(token);
    setUser(profile);
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    lastBootstrappedTokenRef.current = token;
    bootstrapSettledRef.current = true;
  }, [getAccessToken]);

  const login = useCallback(async () => {
    await signIn({
      redirectUri: getLogtoCallbackUrl(),
      firstScreen: "sign_in",
      interactionMode: "signIn",
    });
  }, [signIn]);

  const register = useCallback(async () => {
    await signIn({
      redirectUri: getLogtoCallbackUrl(),
      firstScreen: "identifier:register",
      interactionMode: "signUp",
    });
  }, [signIn]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user && isAuthenticated,
      isLoading: !user && (isLogtoLoading || isBootstrapping),
      login,
      register,
      logout,
      getAccessToken,
      refreshUser,
    }),
    [
      user,
      isAuthenticated,
      isLogtoLoading,
      isBootstrapping,
      login,
      register,
      logout,
      getAccessToken,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

async function fetchJson<T>(path: string, body: unknown): Promise<T> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Request failed with status ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

async function fetchMe(accessToken: string): Promise<AuthUser> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Request failed with status ${response.status}`,
    );
  }

  return response.json() as Promise<AuthUser>;
}

function isJwtExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as {
      exp?: number;
    };
    if (!decoded.exp) return true;
    return decoded.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

function clearStoredAuth() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function resolvePreferredProfileName(profile: {
  name?: string;
  username?: string;
  email?: string;
}): string | undefined {
  const name = profile.name?.trim();
  if (name) return name;

  const emailName = humanizeIdentityToken(profile.email?.split("@")[0]);
  if (emailName) return emailName;

  const username = profile.username?.trim();
  if (username && !looksOpaqueIdentifier(username)) return username;

  return humanizeIdentityToken(username) || profile.email?.trim();
}

function humanizeIdentityToken(value?: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;

  const cleaned = normalized
    .replace(/[@].*$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return undefined;

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function looksOpaqueIdentifier(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length >= 8 &&
    !/\s/.test(normalized) &&
    /[a-z]/i.test(normalized) &&
    /\d/.test(normalized)
  );
}
