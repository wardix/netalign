const STORAGE_KEY = 'netalign.collabClientId';

/** Stable per-tab id used to filter echo of own REST mutations on the WS channel. */
export function getCollabClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      const existing = sessionStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const id = crypto.randomUUID();
      sessionStorage.setItem(STORAGE_KEY, id);
      return id;
    } catch {
      // sessionStorage may be unavailable (private mode / SSR)
    }
  }
  return `client-${Math.random().toString(36).slice(2, 12)}`;
}
