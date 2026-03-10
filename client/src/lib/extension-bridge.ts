export const EXTENSION_CONNECTED_UNTIL_KEY = 'docflow.extension.connectedUntilUtc';
const EXTENSION_PING_MISS_COUNT_KEY = 'docflow.extension.pingMissCount';

type ExtensionPingResponse = {
  source?: string;
  type?: string;
  ok?: boolean;
  nonce?: string;
};

type ExtensionUploadAuthResponse = {
  source?: string;
  type?: string;
  ok?: boolean;
};

type ExtensionUploadAuthStatusResponse = {
  source?: string;
  type?: string;
  ok?: boolean;
  connected?: boolean;
  expiresAtUtc?: string | null;
  nonce?: string;
};

function createNonce() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `nonce-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function isExtensionTokenStillValid() {
  const expiryUtc = localStorage.getItem(EXTENSION_CONNECTED_UNTIL_KEY);
  return !!expiryUtc && new Date(expiryUtc).getTime() > Date.now();
}

export function clearExtensionConnectionCache() {
  localStorage.removeItem(EXTENSION_CONNECTED_UNTIL_KEY);
  sessionStorage.removeItem(EXTENSION_PING_MISS_COUNT_KEY);
}

export function resetExtensionPingFailures() {
  sessionStorage.removeItem(EXTENSION_PING_MISS_COUNT_KEY);
}

export function noteExtensionPingFailureAndShouldInvalidate(maxFailures = 2) {
  const current = Number(sessionStorage.getItem(EXTENSION_PING_MISS_COUNT_KEY) || '0');
  const next = current + 1;
  sessionStorage.setItem(EXTENSION_PING_MISS_COUNT_KEY, String(next));
  return next >= maxFailures;
}

export async function pingRecorderExtension(timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const nonce = createNonce();
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeout);
    };

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;
      const data = event.data as ExtensionPingResponse;
      if (data.source !== 'docflow-recorder-extension') return;
      if (data.type !== 'PING_EXTENSION_RESULT') return;
      if (data.nonce !== nonce) return;
      finish(!!data.ok);
    };

    const timeout = window.setTimeout(() => finish(false), timeoutMs);
    window.addEventListener('message', onMessage);

    window.postMessage(
      {
        source: 'docflow-app',
        type: 'PING_EXTENSION',
        payload: { nonce },
      },
      '*',
    );
  });
}

export async function sendExtensionUploadAuth(
  payload: { apiBaseUrl: string; bearerToken: string },
  options?: { attempts?: number; pingTimeoutMs?: number; ackTimeoutMs?: number; retryDelayMs?: number },
): Promise<boolean> {
  const attempts = Math.max(1, options?.attempts ?? 4);
  const pingTimeoutMs = options?.pingTimeoutMs ?? 900;
  const ackTimeoutMs = options?.ackTimeoutMs ?? 1200;
  const retryDelayMs = options?.retryDelayMs ?? 350;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const extensionReady = await pingRecorderExtension(pingTimeoutMs);
    if (!extensionReady) {
      if (attempt < attempts - 1) {
        await wait(retryDelayMs);
      }
      continue;
    }

    const ack = await postUploadAuthAndAwaitAck(payload, ackTimeoutMs);
    if (ack) {
      return true;
    }

    if (attempt < attempts - 1) {
      await wait(retryDelayMs);
    }
  }

  return false;
}

export async function getExtensionUploadAuthStatus(
  timeoutMs = 1000,
): Promise<{ connected: boolean; expiresAtUtc: string | null }> {
  return new Promise((resolve) => {
    const nonce = createNonce();
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeout);
    };

    const finish = (connected: boolean, expiresAtUtc: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ connected, expiresAtUtc });
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;
      const data = event.data as ExtensionUploadAuthStatusResponse;
      if (data.source !== 'docflow-recorder-extension') return;
      if (data.type !== 'GET_EXTENSION_UPLOAD_AUTH_STATUS_RESULT') return;
      if (data.nonce !== nonce) return;
      finish(!!data.connected, data.expiresAtUtc || null);
    };

    const timeout = window.setTimeout(() => finish(false, null), timeoutMs);
    window.addEventListener('message', onMessage);

    window.postMessage(
      {
        source: 'docflow-app',
        type: 'GET_EXTENSION_UPLOAD_AUTH_STATUS',
        payload: { nonce },
      },
      '*',
    );
  });
}

async function postUploadAuthAndAwaitAck(
  payload: { apiBaseUrl: string; bearerToken: string },
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeout);
    };

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;
      const data = event.data as ExtensionUploadAuthResponse;
      if (data.source !== 'docflow-recorder-extension') return;
      if (data.type !== 'SET_EXTENSION_UPLOAD_AUTH_RESULT') return;
      finish(!!data.ok);
    };

    const timeout = window.setTimeout(() => finish(false), timeoutMs);
    window.addEventListener('message', onMessage);

    window.postMessage(
      {
        source: 'docflow-app',
        type: 'SET_EXTENSION_UPLOAD_AUTH',
        payload,
      },
      '*',
    );
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
