// Resolve API base URL for development (Vite proxy) vs production (VITE_API_BASE).

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Prefer `VITE_API_BASE` when set at build time (including empty string for same-origin).
 * Otherwise use relative URLs on localhost / agent dev hosts so Vite can proxy `/api`.
 * No production domain is hardcoded.
 */
export function resolveApiBase(
  envValue: string | undefined,
  hostname: string,
): string {
  if (envValue !== undefined) {
    return stripTrailingSlash(envValue.trim());
  }

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('agentix.nusa.net.id')
  ) {
    return '';
  }

  // Same-origin fallback when the SPA is served by (or reverse-proxied with) the API.
  return '';
}

export const API_BASE = resolveApiBase(
  import.meta.env.VITE_API_BASE,
  typeof window !== 'undefined' ? window.location.hostname : 'localhost',
);
