export const SESSION_EXPIRED_EVENT = 'routectrl:session-expired';

interface SessionExpiredDetail {
  message?: string;
}

export function emitSessionExpired(message?: string) {
  window.dispatchEvent(
    new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, {
      detail: { message },
    }),
  );
}

