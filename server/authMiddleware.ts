import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { buildApiError } from '../shared/apiErrors.ts';
import { isAuthEnabled, SESSION_COOKIE_NAME } from '../shared/authConfig.ts';
import { getUserForSession, type AuthUser } from './authStore.ts';

export type AuthVariables = {
  user: AuthUser | null;
  authEnabled: boolean;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser | null;
    authEnabled: boolean;
  }
}

export function extractSessionToken(c: Context): string | null {
  const cookie = getCookie(c, SESSION_COOKIE_NAME);
  if (cookie) return cookie;

  const header = c.req.header('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    return token || null;
  }
  return null;
}

/** Attach user (if any) and authEnabled flag to every request. */
export async function attachAuthContext(c: Context, next: Next) {
  const enabled = isAuthEnabled();
  c.set('authEnabled', enabled);
  const token = extractSessionToken(c);
  // Always resolve session when present so /api/auth/me works even if mode is off.
  c.set('user', getUserForSession(token));
  await next();
}

/**
 * When auth is enabled, require a valid session for the route.
 * Public routes should not use this middleware.
 */
export async function requireAuth(c: Context, next: Next) {
  if (!c.get('authEnabled')) {
    await next();
    return;
  }
  const user = c.get('user');
  if (!user) {
    return c.json(buildApiError('AUTH_REQUIRED'), 401);
  }
  await next();
}

export function currentUserId(c: Context): string | null {
  return c.get('user')?.id ?? null;
}
