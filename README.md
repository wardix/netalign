# NetAlign - Network Topology Manager

A premium, interactive full-stack network topology visualizer and editor. Built with **Bun** and **Hono (TypeScript)** on the backend, and **React**, **TypeScript**, **Ant Design**, and **Cytoscape.js** on the frontend.

---

## Features

* **Dynamic Auto-Layout Solver**: Automatically calculates coordinates for subnets, routers, and VM instances. Subnets align as vertical columns; routers and instances stack horizontally beside them to minimize crossings.
* **Perfect Horizontal Straight Connectors**: Edges connect using dynamically computed offset endpoints so connector lines stay completely horizontal.
* **Vibrant Color Synchronization**: Subnets receive distinct colors from a premium dark-mode palette. Connectors inherit the color of their respective subnet.
* **Interactive Sidebar Control Panel**:
  * **Topology Manager**: Create, rename, select, or delete multiple topology configurations.
  * **Node Manager**: Add subnets, routers, or VM instances dynamically.
  * **Edge Manager**: Connect nodes with real-time topology-rule validation and optional gateway/IP labels.
* **Drag-and-Drop Positioning**: Move nodes on the canvas; positions persist to the backend via the REST API.
* **Click-to-Select and Cascading Deletion**: Select nodes or edges in the graph to view properties in the sidebar and delete them instantly.
* **SQLite Persistence**: Topologies are stored in `server/data/netalign.db`. JSON seed files in `server/data/` are auto-imported on first startup.
* **Internationalization**: Default UI locale is Indonesian (`id`) with an ID/EN toggle.

---

## Tech Stack

* **Backend Runtime**: [Bun](https://bun.sh/)
* **Backend Framework**: [Hono](https://hono.dev/)
* **Language**: TypeScript (frontend and backend)
* **Frontend**: [React](https://react.dev/) + [Ant Design](https://ant.design/)
* **Frontend Dev Server**: [Vite](https://vite.dev/) (API proxy to port 5000)
* **Visual Rendering**: [Cytoscape.js](https://js.cytoscape.org/) via `react-cytoscapejs`
* **Persistence**: SQLite via Bun's native `bun:sqlite`
* **Testing**: Bun test (unit/API), Playwright (E2E)

---

## Project Structure

```text
netalign/
├── server/
│   ├── data/
│   │   ├── topology-1.json   # Seed topology (imported to SQLite on first run)
│   │   └── netalign.db       # SQLite database (gitignored)
│   ├── db.ts                 # Schema, migrations, JSON seed import
│   ├── topologyStore.ts      # CRUD operations
│   ├── index.ts              # Hono REST API server
│   ├── paths.ts              # Route ID validation
│   └── testPreload.ts        # Test database setup
├── shared/
│   ├── types.ts              # Shared TypeScript types
│   ├── layoutEngine.ts       # Auto-layout and edge endpoint math
│   ├── edgeValidation.ts     # Topology connection rules
│   ├── edgeGateway.ts        # Gateway/IP validation
│   └── nodePosition.ts       # Position validation
├── src/
│   ├── api.ts                # API_BASE config (dev proxy vs production)
│   ├── api/
│   │   ├── client.ts         # Fetch wrapper
│   │   └── topologies.ts     # Topology API functions
│   ├── hooks/
│   │   ├── useTopologies.ts
│   │   └── useTopology.ts
│   ├── components/
│   │   └── TopologyGraph.tsx # Cytoscape graph renderer
│   ├── i18n/                 # Indonesian/English translations
│   ├── App.tsx
│   ├── Root.tsx
│   └── main.tsx
├── tests/                    # Playwright E2E specs
├── index.html
├── vite.config.ts
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
| `bun run server` | Hono API server on port 5000 |
| `bun run db:reset` | Delete local SQLite files (re-seed on next server start) |
| `bun run db:backup` | Consistent SQLite snapshot (`VACUUM INTO`, WAL-safe) |
| `bun run db:restore -- <file.db> [--force]` | Restore snapshot (stop the server first) |
| `bun run build` | Type-check and build production bundle to `dist/` |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run oxlint |
| `bun run test` | Unit and API tests (SQLite preload) |
| `bun run test:e2e` | Playwright E2E tests (starts both servers) |
| `bun run test:e2e:headed` | E2E tests with visible browser |
| `bun run install:playwright` | Install Playwright Chromium |

### Docker (API only)

Build and run the API with a persistent SQLite volume:

```bash
docker compose up --build
# Health: http://localhost:5000/api/health
# Ready:  http://localhost:5000/api/ready
```

- DB file lives in volume `netalign-data` at `/data/netalign.db`.
- Seed JSON is baked into the image; import runs only when that DB is empty.
- For a local UI against Docker API: `bun run dev` (Vite proxy still targets `localhost:5000`), or set `CORS_ORIGINS` / `VITE_API_BASE` for a split host.

```bash
# Example: allow a custom frontend origin
CORS_ORIGINS=http://localhost:3000 docker compose up --build
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
   ```

4. Ensure the browser origin of the SPA is listed in `CORS_ORIGINS` (comma-separated if multiple).

---

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Hono backend listen port |
| `NODE_ENV` | `development` | Environment mode |
| `NETALIGN_DB_PATH` | `server/data/netalign.db` | SQLite database file path |
| `CORS_ORIGINS` | (dev local origins) | Comma-separated allowed browser origins; empty in production denies cross-origin |
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

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/ready` | Readiness probe (SQLite) |

### Topology Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/topologies` | List all topologies `{ id, name }` |
| `GET` | `/api/topologies/:id` | Fetch full topology (nodes and edges) |
| `POST` | `/api/topologies` | Create topology. Body: `{ name }` |
| `PATCH` | `/api/topologies/:id` | Rename topology. Body: `{ name }` |
| `DELETE` | `/api/topologies/:id` | Delete topology |
| `POST` | `/api/topologies/:id/delete` | **Deprecated** alias for delete (returns `Deprecation` / `Sunset` headers; prefer `DELETE`) |

### Error responses

Failed requests return:

```json
{ "error": "Human-readable English message", "code": "STABLE_ERROR_CODE" }
```

Codes are defined in `shared/apiErrors.ts` (e.g. `TOPOLOGY_NOT_FOUND`, `EDGE_INVALID_CONNECTION`, `TOPOLOGY_PROTECTED`). Clients should branch on `code`; `error` remains for debugging and logs.

### Node Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/topologies/:id/nodes` | Add node. Body: `{ nodeId, type, label }` |
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