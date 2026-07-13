/**
 * Authentication mode for NetAlign.
 *
 * - `on` / `true` / `1`: require session for topology routes; scope by owner.
 * - `off` / `false` / `0`: legacy open access (no ownership checks).
 * - unset: `on` in production, `off` otherwise (local dev / unit tests).
 *
 * Override with env `NETALIGN_AUTH_MODE`.
 */
export type AuthMode = 'on' | 'off';

/** Test-only override (null = use env / defaults). */
let authModeOverride: AuthMode | null = null;

/** Used by unit tests to force auth on/off without polluting other suites. */
export function setAuthModeOverride(mode: AuthMode | null): void {
  authModeOverride = mode;
}

export function resolveAuthMode(
  authModeEnv: string | undefined,
  nodeEnv: string | undefined,
): AuthMode {
  if (authModeOverride) return authModeOverride;
  const raw = authModeEnv?.trim().toLowerCase();
  if (raw === 'on' || raw === 'true' || raw === '1' || raw === 'required') return 'on';
  if (raw === 'off' || raw === 'false' || raw === '0' || raw === 'disabled') return 'off';
  return nodeEnv === 'production' ? 'on' : 'off';
}

export function readProcessAuthEnv(): {
  NETALIGN_AUTH_MODE?: string;
  NODE_ENV?: string;
} {
  const g = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  const env = g.process?.env ?? {};
  return {
    NETALIGN_AUTH_MODE: env.NETALIGN_AUTH_MODE,
    NODE_ENV: env.NODE_ENV,
  };
}

export function isAuthEnabled(
  env: { NETALIGN_AUTH_MODE?: string; NODE_ENV?: string } = readProcessAuthEnv(),
): boolean {
  return resolveAuthMode(env.NETALIGN_AUTH_MODE, env.NODE_ENV) === 'on';
}

export const SESSION_COOKIE_NAME = 'netalign_session';
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const LEGACY_OWNER_ID = 'user-legacy';
