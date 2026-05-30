# NetAlign - Network Topology Manager

A premium, interactive full-stack network topology visualizer and editor. Built using **Bun** and **Hono (TypeScript)** on the backend for high-performance REST APIs, and **Vite**, **Glassmorphic CSS**, and **Cytoscape.js** on the frontend for an elegant, responsive visualization dashboard.

---

## 🌟 Features

*   **Dynamic Auto-Layout Solver**: Automatically calculates coordinates $(X, Y)$ for all subnets, routers, and VM instances. Subnets align as elegant vertical columns, while routers and instances stack horizontally beside them to minimize crossings.
*   **Perfect Horizontal Straight Connectors**: No diagonal lines. Edges connect to subnets and nodes using dynamically computed offset endpoints, ensuring all connector lines are completely horizontal and straight.
*   **Vibrant Color Synchronization**: Subnets receive distinct, vibrant colors dynamically from a premium dark-mode friendly palette. Connectors automatically inherit the color of their respective subnet.
*   **Interactive Sidebar Control Panel**:
    *   **Topology Manager**: Create, select, or delete multiple topology configurations.
    *   **Node Manager**: Add new Subnets, Routers, or VM Instances dynamically.
    *   **Edge Manager**: Connect nodes visually with real-time topology-rule validation (e.g., routers and instances can only connect directly to subnets).
*   **Click-to-Select and Cascading Deletion**: Clicking on any node or edge in the graph highlights the element, displays detailed properties in the sidebar, and enables instant visual and database deletion.
*   **Fast Persistent File DB**: Topologies are saved persistently on the disk under `server/data/` as individual JSON files utilizing Bun's ultra-fast native File I/O.

---

## 🛠️ Tech Stack

*   **Backend Runtime**: [Bun](https://bun.sh/) (ultra-fast JS/TS runtime)
*   **Backend Framework**: [Hono](https://hono.dev/) (lightweight, ultra-fast web framework running on Bun)
*   **Language**: TypeScript (Backend), ES6 JavaScript (Frontend)
*   **Frontend Dev Server**: [Vite](https://vite.dev/) (configured with an internal API proxy)
*   **Visual Rendering**: [Cytoscape.js](https://js.cytoscape.org/) (high-performance graph theory library)
*   **Styling**: Modern CSS Glassmorphism with 'Outfit' typography

---

## 📂 Project Structure

```text
/home/wardix/agy/scratchpad/
├── server/
│   ├── data/                 # JSON file persistence database
│   │   └── topology-1.json   # Seed/default network topology
│   └── index.ts              # Hono REST API server in TypeScript
├── index.html                # Sidebar dashboard structures
├── script.js                 # Frontend state manager & Cytoscape renderer
├── style.css                 # Premium glassmorphic styling sheet
├── vite.config.js            # Vite configurations & port 5000 proxy
├── package.json              # System scripts and frontend dependencies
└── README.md                 # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
Make sure [Bun](https://bun.sh/) is installed on your Linux system. If not, install it with:
```bash
curl -fsSL https://bun.sh/install | bash
```

### Installation
Clone or navigate to the workspace directory and install dependencies:
```bash
bun install
```

### Running the Application

For a fully operational full-stack application, run both the backend API server and the frontend dev server simultaneously.

1.  **Start the Hono Backend Server** (runs on port `5000`):
    ```bash
    bun run server/index.ts
    ```
2.  **Start the Vite Frontend Server** (runs on port `3000`):
    ```bash
    bun run dev
    ```

Once both servers are running, open your web browser and navigate to:
👉 **[http://localhost:3000/](http://localhost:3000/)** (or the host domain/IP bound in `vite.config.js`)

---

## 🌐 Deployment & Cross-Origin Setup (Approach 2)

NetAlign natively supports separate cross-origin deployment (e.g. hosting the static frontend on Netlify/Vercel CDN, and hosting the Hono backend on a dedicated VPS/Cloud instance).

### Dynamic API Base URL Resolution:
The frontend [script.js](file:///home/wardix/agy/scratchpad/script.js) features an automated environment detector at the very top of the file:
1.  **Local Development**: If the browser's hostname is `localhost`, `127.0.0.1`, or an agent development domain, it resolves `API_BASE` to `''` (empty string). This routes all AJAX calls through Vite's local development proxy to prevent CORS issues.
2.  **Production Deployment**: On any other production domain, it automatically appends your live backend domain to all REST API endpoints.

### Steps to Deploy Separately:
1.  Open [script.js](file:///home/wardix/agy/scratchpad/script.js) and locate the `API_BASE` configuration at the top (Line 12).
2.  Replace `'https://api.netalign.com'` with your live Hono backend VPS domain (e.g. `https://api.yourcompany.com`).
3.  Build the static optimized frontend bundle:
    ```bash
    bun run build
    ```
4.  Upload the contents of the newly generated **`dist/`** directory directly to your static hosting platform (e.g. Vercel, Netlify, or AWS S3).
5.  Deploy the backend server to your VPS running Bun, and set the custom `PORT` variable in your production environment variables (refer to `.env.example`).

---

## 🔌 API Endpoints Reference

All requests must be prefixed with `/api`. Vite automatically routes `/api/*` traffic from port `3000` to the Bun backend on port `5000`.

### 1. Topology Management
*   `GET /api/topologies` - Lists all available topologies `{ id, name }`.
*   `GET /api/topologies/:id` - Fetches detailed JSON content (nodes & edges) of a topology.
*   `POST /api/topologies` - Creates a new empty topology. Body: `{ name }`.
*   `DELETE /api/topologies/:id` - Deletes a topology file from disk.

### 2. Node & Edge Management (inside a specific topology)
*   `POST /api/topologies/:id/nodes` - Adds a node. Body: `{ nodeId, type, label }`.
*   `DELETE /api/topologies/:id/nodes/:nodeId` - Deletes a node and automatically cascades to delete all its connected edges.
*   `POST /api/topologies/:id/edges` - Connects two nodes with an edge. Body: `{ source, target }`.
*   `DELETE /api/topologies/:id/edges/:edgeId` - Deletes a single connector edge.
