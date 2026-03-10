const GETTING_STARTED_KEY_PREFIX = 'docflow.gettingStarted.completed';

function getUserStableId(userId?: string | null): string {
  return userId?.trim() || 'anonymous';
}

export function getGettingStartedStorageKey(userId?: string | null): string {
  return `${GETTING_STARTED_KEY_PREFIX}.${getUserStableId(userId)}`;
}

export function hasCompletedGettingStarted(userId?: string | null): boolean {
  return localStorage.getItem(getGettingStartedStorageKey(userId)) === 'true';
}

export function markGettingStartedCompleted(userId?: string | null): void {
  localStorage.setItem(getGettingStartedStorageKey(userId), 'true');
}
