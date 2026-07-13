# Antigravity CLI - AI-to-AI Handover Guide for NetAlign

> **Dear Antigravity AI Agent (or subsequent Engineer),**
> Please read this document first. It gives instant context on the **NetAlign** codebase, architecture rules, layout constraints, and suggested next milestones.

---

## Project Overview

**NetAlign** is an interactive full-stack network topology manager with premium dark-mode aesthetics inspired by OpenStack Horizon.

* **Runtime & Backend**: Bun + Hono (TypeScript) on port `5000`.
* **Frontend**: React + TypeScript + Ant Design + Cytoscape.js on port `3000` (proxied to `5000` for `/api/*` via Vite).
* **Persistence**: SQLite (`bun:sqlite`) at `server/data/netalign.db`. JSON seed files in `server/data/` are auto-imported on first startup.
* **Shared Code**: Types, layout engine, and validation live in `shared/` and are used by both frontend and backend.
* **i18n**: Default UI locale is Indonesian (`id`) with ID/EN toggle in `src/i18n/`.

---

## Strict Visual & Layout Constraints

If you modify the layout engine in `shared/layoutEngine.ts` or the Cytoscape renderer in `src/components/TopologyGraph.tsx`, **you must adhere to these rules**:

1. **Node Types**:
   * `subnet`: Thin vertical bars (`width: 20`, `height: 200`, shape: `round-rectangle`).
   * `router`: Magenta diamonds (`width: 60`, `height: 60`, shape: `diamond`).
   * `instance` (VM): Coral rounded rectangles (`width: 90`, `height: 36`, shape: `round-rectangle`).
2. **Horizontal Alignment**:
   * Routers and instances **must** connect only to subnets.
   * Routers and instances **must never** be placed above or below subnets. They align horizontally.
3. **Orthogonal Straight Horizontal Edges**:
   * All connector edges **must be completely horizontal** (no diagonal slopes).
   * Match the $Y$ coordinate of the peer node with the calculated vertical connection slot on the subnet.
   * Both `source-endpoint` and `target-endpoint` in Cytoscape.js must be explicitly calculated relative to node centers.
4. **Color Sync**:
   * Topology data **does not contain color properties**.
   * Subnet colors are allocated dynamically from a premium palette (`SUBNET_PALETTE` in the layout engine).
   * Edges inherit the color of their connected subnet.
   * Routers and instances use uniform dark-mode static colors.
5. **Multi-Subnet Routers**:
   * Routers connected to multiple subnets are placed at the horizontal midpoint between those subnets ($X_{router} = \frac{X_{subnet1} + X_{subnet2}}{2}$) with a stable, non-overlapping $Y$ coordinate.

---

## Mathematical Positioning & Offset Rules

Implemented in `shared/layoutEngine.ts`. Cytoscape.js endpoints use pixel offsets from node centers:

* **Subnet X-offset**: Left `-10px`, right `10px` (half-width of `20px`).
* **Subnet Y-offset (vertical slots)**:
  $$Y = SUBNET\_Y - \frac{SUBNET\_HEIGHT}{2} + \frac{SUBNET\_HEIGHT}{N + 1} \times (k + 1)$$
  where $N$ is the number of connected nodes on that side, and $k$ is the node index ($0$ to $N-1$).
* **Router X-offset**: Left `-30px`, right `30px` (half-width of `60px`).
* **Instance X-offset**: Left `-45px`, right `45px` (half-width of `90px`).

---

## Key Architecture

| Layer | Location | Role |
|-------|----------|------|
| API server | `server/index.ts` | Hono routes, validation, CORS |
| Data store | `server/topologyStore.ts` | SQLite CRUD via `server/db.ts` |
| Shared types | `shared/types.ts` | `Topology`, `TopologyNode`, `TopologyEdge`, request bodies |
| Layout engine | `shared/layoutEngine.ts` | Auto-layout, edge endpoints, color palette |
| API client | `src/api/client.ts`, `src/api/topologies.ts` | Frontend fetch layer |
| React hooks | `src/hooks/useTopologies.ts`, `src/hooks/useTopology.ts` | Data fetching and state |
| Graph UI | `src/components/TopologyGraph.tsx` | Cytoscape rendering, drag-and-drop |
| Production API URL | `src/api.ts` | `API_BASE` for dev proxy vs production |

---

## How to Bootstrap the Development Environment

1. Install dependencies:

   ```bash
   bun install
   ```

2. Start the Hono backend (port 5000):

   ```bash
   bun run server
   ```

3. Start the Vite frontend (port 3000):

   ```bash
   bun run dev
   ```

4. Open `http://localhost:3000/`.

5. Run tests:

   ```bash
   bun run test        # unit + API
   bun run test:e2e    # Playwright E2E
   bun run lint        # oxlint
   bun run build       # production build
   ```

---

## Completed Roadmap Items

These features are already implemented:

* **Drag-and-Drop Save**: Node positions persist via `PUT /api/topologies/:id/nodes/:nodeId` with `{ position: { x, y } }`.
* **SQLite Database**: `server/db.ts` + `server/topologyStore.ts` replace raw JSON file persistence.
* **Edge Gateway/IP Labels**: Optional `gateway` field on edges with validation in `shared/edgeGateway.ts`.
* **React Migration**: Full React + TypeScript + Ant Design frontend with code splitting.
* **Shared Types**: `shared/types.ts` used by frontend and backend.
* **API Client & Hooks**: `src/api/` and `src/hooks/` for data fetching.
* **Code Splitting**: Lazy-loaded `TopologyGraph` and vendor chunks in `vite.config.ts`.

---

## Suggested Next Iterations

Prompts for future work:

* **Undo/Redo**:
  > *"Add undo/redo for topology edits (node add/delete, edge add/delete, drag positions) with a command history stack."*
* **Export/Import**:
  > *"Add export topology to JSON and import from JSON file, with validation against shared types."*
* **Multi-User / Auth**:
  > *"Add authentication and per-user topology ownership on top of the SQLite store."*
* **Real-Time Collaboration**:
  > *"Add WebSocket sync so multiple users can edit the same topology concurrently."*