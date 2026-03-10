import { emitSessionExpired } from '../auth/session-events';
import { getApiBaseUrl } from '../config/runtime-config';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Create an authenticated API client function.
 * Returns a function that makes requests to the backend API with the given access token.
 */
export function createApiClient(getAccessToken: () => Promise<string>) {
  return async function apiRequest<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const token = await getAccessToken();

    const fetchHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...headers,
    };

    if (body && !(body instanceof FormData)) {
      fetchHeaders['Content-Type'] = 'application/json';
    }

    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api${path}`, {
      method,
      headers: fetchHeaders,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401) {
        emitSessionExpired('Session expired. Signing out...');
      }
      const errorBody = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorBody.message || `Request failed with status ${response.status}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  };
}

export function createPublicApiClient() {
  return async function publicApiRequest<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const fetchHeaders: Record<string, string> = {
      ...headers,
    };

    if (body && !(body instanceof FormData)) {
      fetchHeaders['Content-Type'] = 'application/json';
    }

    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api${path}`, {
      method,
      headers: fetchHeaders,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorBody.message || `Request failed with status ${response.status}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
