function isLocalhostHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function isLocalhostUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return isLocalhostHost(parsed.hostname);
  } catch {
    return false;
  }
}

export function getApiBaseUrl(): string {
  const envBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!envBase) {
    return window.location.origin;
  }

  const appIsLocalhost = isLocalhostHost(window.location.hostname);
  if (!appIsLocalhost && isLocalhostUrl(envBase)) {
    return window.location.origin;
  }

  return envBase.replace(/\/$/, '');
}

export function getRealtimeBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/?$/, '');
}

export function getAuthMode(): 'jwt' | 'logto' {
  const mode = String(import.meta.env.VITE_AUTH_MODE || 'jwt').trim().toLowerCase();
  return mode === 'logto' ? 'logto' : 'jwt';
}

export function getLogtoEndpoint(): string {
  return String(import.meta.env.VITE_LOGTO_ENDPOINT || '').trim().replace(/\/+$/, '');
}

export function getLogtoAppId(): string {
  return String(import.meta.env.VITE_LOGTO_APP_ID || '').trim();
}

export function getLogtoCallbackPath(): string {
  const configured = String(import.meta.env.VITE_LOGTO_CALLBACK_PATH || '/callback').trim();
  if (!configured) return '/callback';
  return configured.startsWith('/') ? configured : `/${configured}`;
}

export function getLogtoApiResource(): string | undefined {
  const resource = String(import.meta.env.VITE_LOGTO_API_RESOURCE || '').trim();
  return resource || undefined;
}

export function getLogtoCallbackUrl(): string {
  return `${window.location.origin}${getLogtoCallbackPath()}`;
}
