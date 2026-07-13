/** Default protected seed topology id (matches `server/data/topology-1.json`). */
export const DEFAULT_PROTECTED_TOPOLOGY_IDS = ['topology-1'] as const;

export const PROTECTED_TOPOLOGY_DELETE_ERROR =
  'This topology is protected and cannot be deleted';

/**
 * Parse a comma-separated protected topology id list.
 * Empty / whitespace-only values fall back to the default seed id list.
 */
export function parseProtectedTopologyIds(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') {
    return [...DEFAULT_PROTECTED_TOPOLOGY_IDS];
  }
  const ids = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : [...DEFAULT_PROTECTED_TOPOLOGY_IDS];
}

export function isProtectedTopologyId(
  topologyId: string,
  protectedIds: readonly string[] = DEFAULT_PROTECTED_TOPOLOGY_IDS,
): boolean {
  return protectedIds.includes(topologyId);
}

/** Resolve protected ids from an env bag (server passes `process.env` / `Bun.env`). */
export function getProtectedTopologyIdsFromEnv(env: {
  PROTECTED_TOPOLOGY_IDS?: string;
}): string[] {
  return parseProtectedTopologyIds(env.PROTECTED_TOPOLOGY_IDS);
}
