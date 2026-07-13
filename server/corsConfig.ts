/**
 * CORS origin policy for the Hono API.
 *
 * CORS_ORIGINS: comma-separated list of allowed browser origins.
 * - Unset/empty in non-production: allow common local frontend origins.
 * - Unset/empty in production: deny browser cross-origin (no Access-Control-Allow-Origin).
 * - Explicit `*`: allow any origin (opt-in only).
 */

export type CorsOriginDecision = string | null;

export function parseCorsOriginsList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

export function createCorsOriginResolver(
  corsOriginsEnv: string | undefined,
  nodeEnv: string | undefined,
): (origin: string | undefined) => CorsOriginDecision {
  const list = parseCorsOriginsList(corsOriginsEnv);
  const isProduction = nodeEnv === 'production';

  if (list.includes('*')) {
    return origin => origin || '*';
  }

  const allowed =
    list.length > 0
      ? list
      : isProduction
        ? []
        : [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
          ];

  return (origin: string | undefined) => {
    // Non-browser clients (curl, same-origin, server tests) often omit Origin.
    if (!origin) return allowed[0] ?? null;
    if (allowed.includes(origin)) return origin;
    return null;
  };
}
