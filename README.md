# NetAlign - Network Topology Manager

A premium, interactive full-stack network topology visualizer and editor. Built with **Bun** and **Hono (TypeScript)** on the backend, and **React**, **TypeScript**, **Ant Design**, and **Cytoscape.js** on the frontend.

---

## Features

* **Dynamic Auto-Layout Solver**: Automatically calculates coordinates for subnets, routers, and VM instances. Subnets align as vertical columns; routers and instances stack horizontally beside them to minimize crossings.
* **Perfect Horizontal Straight Connectors**: Edges connect using dynamically computed offset endpoints so connector lines stay completely horizontal.
* **Vibrant Color Synchronization**: Subnets receive distinct colors from a premium dark-mode palette. Connectors inherit the color of their respective subnet.
* **Interactive Sidebar Control Panel**:
  * **Topology Manager**: Create, rename, select, export/import, or delete multiple topology configurations.
  * **Node Manager**: Add subnets, routers, or VM instances dynamically.
  * **Edge Manager**: Connect nodes with real-time topology-rule validation and optional gateway/IP labels.
* **Drag-and-Drop Positioning**: Move nodes on the canvas; positions persist via batch position API.
* **Click-to-Select and Cascading Deletion**: Select nodes or edges in the graph to view properties in the sidebar and delete them instantly.
* **Undo / Redo**: Local command history (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z) with server-backed recovery on failure.
* **Canvas UX**: Node search, minimap, zoom/fit/focus, empty-topology wizard and sample scaffold.
* **Real-time Collaboration**: WebSocket fan-out so other clients see mutations without refresh (last-write-wins). See [`docs/collaboration.md`](docs/collaboration.md).
* **Authentication & Ownership**: Optional local username/password sessions; topologies scoped per owner. See [`docs/auth.md`](docs/auth.md).
* **OpenAPI Contract**: Machine-readable REST spec at `/api/openapi.json` (Swagger UI at `/api/docs` in non-production).
* **SQLite Persistence**: Topologies in `server/data/netalign.db` (WAL); JSON seeds imported on first empty DB; backup/restore CLI.
* **Internationalization**: Default UI locale is Indonesian (`id`) with an ID/EN toggle.
* **Accessibility**: Skip link, labeled shell/sidebar, keyboard shortcuts for undo and selection; canvas remains primarily pointer-oriented (see Accessibility below).

---

## Tech Stack

* **Backend Runtime**: [Bun](https://bun.sh/)
* **Backend Framework**: [Hono](https://hono.dev/) (REST + Bun WebSocket)
* **Language**: TypeScript (frontend and backend)
* **Frontend**: [React](https://react.dev/) + [Ant Design](https://ant.design/)
* **Frontend Dev Server**: [Vite](https://vite.dev/) (API + WebSocket proxy to port 5000)
* **Visual Rendering**: [Cytoscape.js](https://js.cytoscape.org/) via `react-cytoscapejs`
* **Persistence**: SQLite via Bun's native `bun:sqlite`
* **Auth**: Local sessions (HttpOnly cookie / Bearer), bcrypt password hashes
* **Testing**: Bun test (unit/API), Playwright (E2E)
* **Docs**: OpenAPI 3 + `docs/auth.md` + `docs/collaboration.md`

---

## Project Structure

```text
netalign/
├── docs/
│   ├── auth.md               # Session auth + ownership
│   └── collaboration.md      # WebSocket collab protocol (LWW)
├── server/
│   ├── data/
│   │   ├── topology-1.json   # Seed topology (imported to SQLite on first run)
│   │   └── netalign.db       # SQLite database (gitignored)
│   ├── authStore.ts          # Users, sessions, password hashing
│   ├── authMiddleware.ts     # Session attach + requireAuth
│   ├── collabHub.ts          # In-memory WS rooms
│   ├── collabWs.ts           # /api/ws upgrade + broadcast helpers
│   ├── db.ts                 # Schema, migrations, JSON seed import
│   ├── topologyStore.ts      # CRUD + owner_id scoping
│   ├── health.ts             # Liveness / readiness
│   ├── openapiUi.ts          # Swagger UI HTML (dev)
│   ├── index.ts              # Hono app + Bun serve (HTTP + WS)
│   ├── paths.ts              # Route ID validation
│   └── testPreload.ts        # In-memory test DB
├── shared/
│   ├── types.ts              # Domain types
│   ├── apiErrors.ts          # Stable error codes
│   ├── authConfig.ts         # NETALIGN_AUTH_MODE resolution
│   ├── collabProtocol.ts     # WS message shapes
│   ├── openapi.ts            # OpenAPI 3 document + validateOpenApiDocument
│   ├── layoutEngine.ts       # Auto-layout and edge endpoint math
│   ├── edgeValidation.ts     # Topology connection rules
│   └── …                     # gateway, positions, import, search, …
├── src/
│   ├── api.ts                # API_BASE config
│   ├── api/                  # client, topologies, auth
│   ├── auth/                 # AuthProvider
│   ├── collab/               # clientId + WS URL helpers
│   ├── history/              # Undo/redo stack
│   ├── hooks/                # topologies, mutations, collab, selection, …
│   ├── components/           # Graph, sidebar, auth screen, …
│   ├── i18n/                 # id / en translations
│   ├── App.tsx
│   ├── Root.tsx              # Auth gate + Ant Design locale
│   └── main.tsx
├── scripts/                  # db:reset, db:backup, db:restore
├── tests/                    # Playwright E2E
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

Install [Bun](https://bun.sh/):

```bash
curl -fsSL https://bun.sh/install | bash
```

### Installation

```bash
bun install
```

### Running the Application

**One command** (API + Vite):

```bash
bun run dev:all
```

This starts the Hono backend on port `5000` and the Vite frontend on port `3000`. Open **[http://localhost:3000/](http://localhost:3000/)**.

Or run them in separate terminals:

```bash
bun run server   # API → http://localhost:5000
bun run dev      # UI  → http://localhost:3000 (proxies /api → 5000)
```

### Database and seeds

| Situation | Behavior |
|-----------|----------|
| **Empty / missing DB** | Server creates `server/data/netalign.db` (or `NETALIGN_DB_PATH`) and imports every valid `server/data/*.json` topology once. |
| **Existing DB** | JSON seeds are **not** re-imported (data is already in SQLite). |
| **Reset local DB** | `bun run db:reset` deletes the DB (+ WAL/SHM), then the next `bun run server` recreates and re-seeds. |

Default seed file: `server/data/topology-1.json` (protected from delete; see `PROTECTED_TOPOLOGY_IDS`).

#### Backup and restore (SQLite)

The API uses **WAL mode** (`PRAGMA journal_mode = WAL`). Do **not** rely on a naive `cp netalign.db` while the server is writing — you can capture an incomplete snapshot. Prefer:

**Backup** (safe while the server is running — uses SQLite `VACUUM INTO`):

```bash
bun run db:backup
# → server/data/backups/netalign-<timestamp>.db

# Or choose the destination path:
bun run db:backup -- ./backups/prod-2026-07-13.db
```

**Restore** (stop the API first so nothing holds the file open):

```bash
# stop: Ctrl+C on `bun run server` / `docker compose stop`
bun run db:restore -- ./server/data/backups/netalign-<timestamp>.db --force
bun run server   # or docker compose up
```

Restore overwrites `NETALIGN_DB_PATH` and removes leftover `-wal` / `-shm` companions so SQLite does not replay stale WAL against the new file.

| Mechanism | Scope | Notes |
|-----------|--------|--------|
| `db:backup` / `db:restore` | **Entire** SQLite DB (all topologies) | Ops / disaster recovery |
| UI **Export / Import** | **One** topology as JSON | Share or migrate a single graph |
| `db:reset` | Wipe local DB | Dev only; re-seeds from `server/data/*.json` |

Env: `NETALIGN_BACKUP_DIR` (default `server/data/backups`). Keep backup files out of git (directory is gitignored via `*.db` patterns under `server/data/`).

### Scripts

| Script | Description |
|--------|-------------|
| `bun run dev:all` | API + Vite together (recommended for local work) |
| `bun run dev` | Vite dev server on port 3000 |
| `bun run server` | Hono API + WebSocket server on port 5000 |
| `bun run db:reset` | Delete local SQLite files (re-seed on next server start) |
| `bun run db:backup` | Consistent SQLite snapshot (`VACUUM INTO`, WAL-safe) |
| `bun run db:restore -- <file.db> [--force]` | Restore snapshot (stop the server first) |
| `bun run build` | Type-check and build production bundle to `dist/` |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run oxlint |
| `bun run test` | Unit and API tests (SQLite preload) |
| `bun run openapi:check` | Validate OpenAPI document structure |
| `bun run test:e2e` | Playwright E2E tests (starts both servers) |
| `bun run test:e2e:headed` | E2E tests with visible browser |
| `bun run install:playwright` | Install Playwright Chromium |

### Docker (API only)

Build and run the API with a persistent SQLite volume:

```bash
docker compose up --build
# Health: http://localhost:5000/api/health
# Ready:  http://localhost:5000/api/ready
# OpenAPI: http://localhost:5000/api/openapi.json
```

- DB file lives in volume `netalign-data` at `/data/netalign.db`.
- Seed JSON is baked into the image; import runs only when that DB is empty.
- Production images typically set `NODE_ENV=production` → **auth on** by default; register the first user via the UI or `POST /api/auth/register`.
- For a local UI against Docker API: `bun run dev` (Vite proxies `/api` and WS to `localhost:5000`), or set `CORS_ORIGINS` / `VITE_API_BASE` for a split host. Prefer an **explicit** frontend origin (not `*`) when using cookies.

```bash
# Example: allow a custom frontend origin + force auth
CORS_ORIGINS=http://localhost:3000 NETALIGN_AUTH_MODE=on docker compose up --build
```

---

## Deployment and Cross-Origin Setup

NetAlign supports separate deployment (e.g. static frontend on Netlify/Vercel, backend on a VPS).

### Dynamic API Base URL

The frontend resolves `API_BASE` in `src/api.ts`:

1. **`VITE_API_BASE`** (build-time): When set, used as the absolute backend origin (trailing slash stripped). Set to empty string for same-origin requests.
2. **Local development**: If `VITE_API_BASE` is unset and the page is on `localhost`, `127.0.0.1`, or the agent development domain, `API_BASE` is `''` so `/api` goes through the Vite proxy (no CORS issues).
3. **Otherwise**: Same-origin (`''`) — no production API domain is hardcoded.

### Steps to Deploy Separately

1. Build the frontend with your API origin:

   ```bash
   VITE_API_BASE=https://api.example.com bun run build
   ```

2. Upload the contents of `dist/` to your static hosting platform.
3. Deploy the backend on a VPS with Bun. Set at least:

   ```bash
   NODE_ENV=production
   CORS_ORIGINS=https://your-frontend.example.com
   PORT=5000
   # optional: NETALIGN_DB_PATH=/var/lib/netalign/netalign.db
   # optional: NETALIGN_AUTH_MODE=on   # default when NODE_ENV=production
   ```

4. Ensure the browser origin of the SPA is listed in `CORS_ORIGINS` (comma-separated if multiple). Do **not** use `CORS_ORIGINS=*` if you rely on session cookies (`credentials: include`).
5. Serve the API over **HTTPS** so the session cookie can be `Secure`.
6. Register the first user (`/api/auth/register` or the login screen). Seed topologies under the legacy owner are not listed for new users until reassigned or recreated.

---

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Hono backend listen port |
| `NODE_ENV` | `development` | Environment mode (`production` turns auth on unless overridden) |
| `NETALIGN_DB_PATH` | `server/data/netalign.db` | SQLite database file path |
| `NETALIGN_BACKUP_DIR` | `server/data/backups` | Directory for `db:backup` timestamped files |
| `NETALIGN_AUTH_MODE` | `off` (dev) / `on` (production) | Require login and scope topologies by owner. See [`docs/auth.md`](docs/auth.md). |
| `NETALIGN_OPENAPI_UI` | on when not production | Set `1` to force Swagger UI at `/api/docs`; `0` to disable |
| `CORS_ORIGINS` | (dev local origins) | Comma-separated allowed browser origins; empty in production denies cross-origin; avoid `*` with cookies |
| `PROTECTED_TOPOLOGY_IDS` | `topology-1` | Topology ids that cannot be deleted (seed safety) |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` (JSON logs to stdout/stderr) |
| `LOG_REQUESTS` | `true` in production | Set `1`/`true` to log each HTTP request; `0`/`false` to disable |
| `VITE_API_BASE` | (unset → proxy/same-origin) | Frontend API origin at **build** time |

### Health checks

| Endpoint | Use | Success |
|----------|-----|---------|
| `GET /api/health` | Liveness (process up) | `200` `{ status: "ok", ... }` |
| `GET /api/ready` | Readiness (SQLite query works) | `200` ready / `503` not_ready |

Logs are one JSON object per line (`ts`, `level`, `msg`, plus fields). Sensitive keys (`password`, `token`, …) are redacted. Every response includes `x-request-id` (echoed from the request header when provided).

### Accessibility

- **Skip link**: first Tab focuses “Skip to canvas” / “Lompat ke kanvas”.
- **Sidebar**: labeled navigation region; forms use Ant Design labels; topology select and actions are keyboard-reachable (Tab / Enter / Space). Delete/confirm flows use Ant Design modals (keyboard OK/Cancel).
- **Header**: panel toggle, undo/redo, and locale control expose accessible names; undo/redo advertise shortcuts via `aria-keyshortcuts`.
- **Canvas chrome**: zoom / fit / auto-layout toolbar buttons have visible text or `aria-label` (not icon-only without names). Focus rings are visible on toolbar buttons.
- **Document language**: `<html lang>` follows the UI locale (`id` / `en`).

**Known canvas limitation (Cytoscape):** the graph surface is primarily pointer/touch oriented. Screen-reader users should manage topology structure via the **sidebar** (add/rename/delete nodes and edges). Selection of graph elements is click/tap based; full canvas keyboard navigation (arrow keys between nodes, etc.) is **not** implemented. Prefer the control panel for structural edits.

#### Canvas keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Clear graph selection |
| `Delete` / `Backspace` | Delete selected node or edge (confirm dialog) |
| `Ctrl/⌘+Z` | Undo |
| `Ctrl/⌘+Shift+Z` or `Ctrl+Y` | Redo |

Also: search box (top-left) finds nodes by label/ID; toolbar **Fit** / **Focus**; optional **minimap** (bottom-left) to jump to a node.

---

## API Endpoints

All requests are prefixed with `/api`. Vite proxies `/api/*` from port 3000 to the backend on port 5000.

### OpenAPI

Machine-readable contract (aligned with `shared/types.ts` and `shared/apiErrors.ts`):

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/openapi.json` | OpenAPI 3.0 document |
| `GET` | `/api/docs` | Swagger UI (non-production by default; set `NETALIGN_OPENAPI_UI=1` to force on) |

Validate the spec locally: `bun run openapi:check` (also covered by unit tests).

### Authentication

Local **username/password sessions** with per-user topology ownership.

| Item | Detail |
|------|--------|
| Default | Auth **on** in production, **off** for local/dev/tests |
| Override | `NETALIGN_AUTH_MODE=on` or `off` |
| Cookie | `netalign_session` (HttpOnly, SameSite=Lax, Secure in production); also `Authorization: Bearer <token>` |
| Docs | [`docs/auth.md`](docs/auth.md) |

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/status` | `{ enabled, authenticated, user }` (public) |
| `GET` | `/api/auth/me` | Current user (401 when auth on and logged out) |
| `POST` | `/api/auth/register` | Body: `{ username, password }` → set session cookie |
| `POST` | `/api/auth/login` | Body: `{ username, password }` → set session cookie |
| `POST` | `/api/auth/logout` | Clear session |

When auth is **on**, all `/api/topologies*` routes require a valid session (**401**). Accessing another user's topology returns **403** `AUTH_FORBIDDEN`. List only returns the caller's topologies.

### Real-time collaboration (WebSocket)

Multiple clients on the same topology receive live updates after REST mutations.

| Item | Detail |
|------|--------|
| Endpoint | `WS /api/ws?topologyId=&clientId=` |
| Model | **Last-write-wins** (SQLite is source of truth; no OT/CRDT) |
| Echo filter | `X-Collab-Client-Id` on REST + matching WS client id |
| Reconnect | Silent full topology refetch (store cannot stay corrupt) |
| Docs | [`docs/collaboration.md`](docs/collaboration.md) |

**Note:** HTTP topology routes enforce ownership when auth is on. The WebSocket channel currently relies on same-origin cookies for presence and does not re-check ownership on every event; treat collab as a trusted-network feature and keep auth on for public deploys. See [`docs/collaboration.md`](docs/collaboration.md).

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/ready` | Readiness probe (SQLite) |

### Topology Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/topologies` | List topologies for the current user (or all when auth off) `{ id, name }` |
| `GET` | `/api/topologies/:id` | Fetch full topology (nodes and edges) |
| `POST` | `/api/topologies` | Create topology. Body: `{ name }` |
| `POST` | `/api/topologies/import` | Import topology document as a new topology |
| `PATCH` | `/api/topologies/:id` | Rename topology. Body: `{ name }` |
| `DELETE` | `/api/topologies/:id` | Delete topology |
| `POST` | `/api/topologies/:id/delete` | **Deprecated** alias for delete (returns `Deprecation` / `Sunset` headers; prefer `DELETE`) |

### Error responses

Failed requests return:

```json
{ "error": "Human-readable English message", "code": "STABLE_ERROR_CODE" }
```

Codes are defined in `shared/apiErrors.ts` (e.g. `TOPOLOGY_NOT_FOUND`, `EDGE_INVALID_CONNECTION`, `TOPOLOGY_PROTECTED`, `AUTH_REQUIRED`, `AUTH_FORBIDDEN`). Clients should branch on `code`; `error` remains for debugging and logs.

### Node Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/topologies/:id/nodes` | Add node. Body: `{ nodeId, type, label }` |
| `PUT` | `/api/topologies/:id/nodes/positions` | Batch-update positions. Body: `{ updates: [{ nodeId, position }] }` |
| `PUT` | `/api/topologies/:id/nodes/:nodeId` | Update label and/or position. Body: `{ label? }` or `{ position: { x, y } }` |
| `DELETE` | `/api/topologies/:id/nodes/:nodeId` | Delete node and connected edges |

### Edge Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/topologies/:id/edges` | Add edge. Body: `{ source, target, gateway? }` |
| `PUT` | `/api/topologies/:id/edges/:edgeId` | Update gateway. Body: `{ gateway }` |
| `DELETE` | `/api/topologies/:id/edges/:edgeId` | Delete edge |

**Topology rules**: Routers and instances may only connect directly to subnets. Routers and instances must not connect to each other.

---

## CI

GitHub Actions runs on every push and pull request to `main`:

1. Lint (`bun run lint`)
2. Unit and API tests (`bun run test`)
3. Production build (`bun run build`)
4. E2E tests (`bun run test:e2e`)