# Authentication and topology ownership

## Choice (v1)

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **Session cookie + local username/password** | Simple, works offline, cookie `HttpOnly`, easy tests | No SSO, password storage responsibility | **Chosen for v1** |
| API keys only | Easy for scripts | Poor browser UX | Supported via `Authorization: Bearer <session token>` |
| OAuth (GitHub/Google) | Familiar login | Extra deps, secrets, redirect URLs | Later |

## Mode

| `NETALIGN_AUTH_MODE` | Behavior |
|----------------------|----------|
| `on` / `true` / `1` | Topology routes require a session; list/mutate scoped to owner |
| `off` / `false` / `0` | Open access (legacy); topologies still store `owner_id` |
| *(unset)* | **`on` in production**, **`off` otherwise** |

## Schema migration

On server start (`initializeSchema`):

1. Create `users` and `sessions` tables if missing.
2. Ensure `topologies.owner_id` column exists (`ALTER TABLE` when upgrading older DBs).
3. Insert system user `user-legacy` / `__legacy__` if missing (not a login account).
4. `UPDATE topologies SET owner_id = 'user-legacy' WHERE owner_id IS NULL`.

New topologies created while authenticated get `owner_id = <current user id>`.

## HTTP API

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/auth/status` | `{ enabled, authenticated, user }` |
| `GET` | `/api/auth/me` | Current user or 401 when auth on |
| `POST` | `/api/auth/register` | `{ username, password }` → set cookie |
| `POST` | `/api/auth/login` | same |
| `POST` | `/api/auth/logout` | clear session |

Session cookie: `netalign_session` (HttpOnly, SameSite=Lax, Secure in production, 14-day TTL).

## Authorization rules (auth on)

- **401** `AUTH_REQUIRED` — no valid session on `/api/topologies*`.
- **403** `AUTH_FORBIDDEN` — session valid but topology owned by someone else.
- **404** — topology id does not exist.
- List only returns the caller’s topologies.

Health, OpenAPI, and auth routes remain public.

## Frontend

When `/api/auth/status` reports `enabled: true` and the user is not authenticated, the UI shows a login/register screen. Fetch uses `credentials: 'include'`.

## Production checklist

1. Set `NODE_ENV=production` (auth on by default) or `NETALIGN_AUTH_MODE=on`.
2. Configure `CORS_ORIGINS` to explicit frontend origins (credentials cannot use `*`).
3. Serve the API over HTTPS so `Secure` cookies work.
4. Register the first admin user via `/api/auth/register` (open registration is v1; restrict later if needed).
