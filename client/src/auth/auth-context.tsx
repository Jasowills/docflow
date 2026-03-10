import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLogto } from '@logto/react';
import { emitSessionExpired } from './session-events';
import {
  getApiBaseUrl,
  getAuthMode,
  getLogtoApiResource,
  getLogtoCallbackUrl,
} from '../config/runtime-config';
import type { AccountType } from '@docflow/shared';

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  accountType: AccountType;
  teamName?: string;
  workspaceId?: string;
  workspaceName?: string;
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
}

const ACCESS_TOKEN_KEY = 'docflow.auth.accessToken';
const REFRESH_TOKEN_KEY = 'docflow.auth.refreshToken';
const USER_KEY = 'docflow.auth.user';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  return getAuthMode() === 'logto' ? (
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
        throw new Error('Email and password are required.');
      }
      const response = await fetchJson<AuthResponse>('/auth/login', payload);
      persistAuth(response);
    },
    [persistAuth],
  );

  const register = useCallback(
    async (payload?: RegisterPayload) => {
      if (!payload) {
        throw new Error('Registration details are required.');
      }
      const response = await fetchJson<AuthResponse>('/auth/register', payload);
      persistAuth(response);
    },
    [persistAuth],
  );

  const refresh = useCallback(async (): Promise<string> => {
    if (!refreshToken) {
      logout();
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetchJson<AuthResponse>('/auth/refresh', {
        refreshToken,
      });
      persistAuth(response);
      return response.accessToken;
    } catch (error) {
      logout();
      emitSessionExpired('Session expired. Please sign in again.');
      throw error;
    }
  }, [refreshToken, persistAuth, logout]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (!accessToken) {
      throw new Error('No authenticated session');
    }

    if (!isJwtExpired(accessToken)) {
      return accessToken;
    }

    return refresh();
  }, [accessToken, refresh]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      getAccessToken,
    }),
    [user, isLoading, login, register, logout, getAccessToken],
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
  } = useLogto();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    clearStoredAuth();
    void signOut(`${window.location.origin}/login`);
  }, [signOut]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    const resource = getLogtoApiResource();
    const token = resource
      ? await getLogtoAccessToken(resource)
      : await getLogtoAccessToken();
    if (!token) {
      throw new Error('No authenticated session');
    }
    return token;
  }, [getLogtoAccessToken]);

  const bootstrapUser = useCallback(async () => {
    if (!isAuthenticated) {
      setUser(null);
      clearStoredAuth();
      setIsBootstrapping(false);
      return;
    }

    try {
      const token = await getAccessToken();
      const profile = await fetchMe(token);
      setUser(profile);
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } catch (error) {
      setUser(null);
      clearStoredAuth();
      emitSessionExpired('Unable to restore your DocFlow session. Please sign in again.');
      throw error;
    } finally {
      setIsBootstrapping(false);
    }
  }, [getAccessToken, isAuthenticated]);

  useEffect(() => {
    void bootstrapUser().catch(() => {
      void signOut(`${window.location.origin}/login`);
    });
  }, [bootstrapUser, signOut]);

  const login = useCallback(async () => {
    await signIn({
      redirectUri: getLogtoCallbackUrl(),
      firstScreen: 'sign_in',
      interactionMode: 'signIn',
    });
  }, [signIn]);

  const register = useCallback(async () => {
    await signIn({
      redirectUri: getLogtoCallbackUrl(),
      firstScreen: 'identifier:register',
      interactionMode: 'signUp',
    });
  }, [signIn]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user && isAuthenticated,
      isLoading: isLogtoLoading || isBootstrapping,
      login,
      register,
      logout,
      getAccessToken,
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
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

async function fetchJson<T>(path: string, body: unknown): Promise<T> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    const payload = token.split('.')[1];
    if (!payload) return true;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
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
