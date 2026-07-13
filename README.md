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

Run the backend and frontend in separate terminals:

1. **Start the Hono backend** (port `5000`):

   ```bash
   bun run server
   ```

2. **Start the Vite frontend** (port `3000`):

   ```bash
   bun run dev
   ```

Open **[http://localhost:3000/](http://localhost:3000/)** in your browser.

On first startup, the backend creates `server/data/netalign.db` and imports any `*.json` seed files from `server/data/`.

### Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Vite dev server on port 3000 |
| `bun run server` | Hono API server on port 5000 |
| `bun run build` | Type-check and build production bundle to `dist/` |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run oxlint |
| `bun run test` | Unit and API tests (SQLite preload) |
| `bun run test:e2e` | Playwright E2E tests (starts both servers) |
| `bun run test:e2e:headed` | E2E tests with visible browser |
| `bun run install:playwright` | Install Playwright Chromium |

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
| `VITE_API_BASE` | (unset → proxy/same-origin) | Frontend API origin at **build** time |

---

## API Endpoints

All requests are prefixed with `/api`. Vite proxies `/api/*` from port 3000 to the backend on port 5000.

### Topology Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/topologies` | List all topologies `{ id, name }` |
| `GET` | `/api/topologies/:id` | Fetch full topology (nodes and edges) |
| `POST` | `/api/topologies` | Create topology. Body: `{ name }` |
| `PATCH` | `/api/topologies/:id` | Rename topology. Body: `{ name }` |
| `DELETE` | `/api/topologies/:id` | Delete topology |
| `POST` | `/api/topologies/:id/delete` | Delete topology (legacy alias) |

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