# 🤖 Antigravity CLI - AI-to-AI Handover Guide for NetAlign

> [!NOTE]
> **Dear Antigravity AI Agent (or subsequent Engineer),**
> Please read this document first. It is designed to give you instant, complete context of the **NetAlign** codebase, architecture rules, mathematical layout constraints, and next roadmap milestones so you can continue development flawlessly.

---

## 📌 Project Overview
**NetAlign** is an interactive full-stack network topology manager designed to mimic an OpenStack Horizon topology viewer with premium dark-mode glassmorphic aesthetics.
*   **Runtime & Backend**: Bun + Hono (TypeScript) on port `5000`.
*   **Frontend**: HTML5 + Vanilla CSS + Cytoscape.js on port `3000` (proxied to `5000` for `/api/*` via Vite).
*   **Persistence**: Raw JSON files stored on the disk under `server/data/`.

---

## 📐 Strict Visual & Layout Constraints
The user has established strict design rules. If you modify the layout engine in `script.js`, **you must adhere to these rules**:

1.  **Node Types**:
    *   `subnet`: Rendered as thin vertical bars (`width: 20`, `height: 200`, shape: `round-rectangle`).
    *   `router`: Rendered as magenta diamonds (`width: 60`, `height: 60`, shape: `diamond`).
    *   `instance` (VM): Rendered as coral rounded rectangles (`width: 90`, `height: 36`, shape: `round-rectangle`).
2.  **Horizontal Alignment**:
    *   All routers and instances **must** connect only to subnets.
    *   Routers and instances **must never** be placed above or below subnets. They must align horizontally.
3.  **Orthogonal Straight Horizontal Edges**:
    *   All connector edges **must be completely horizontal straight lines** (no diagonal slopes).
    *   Achieved by matching the $Y$ coordinate of the peer node with the calculated vertical connection slot on the subnet.
    *   Both `source-endpoint` and `target-endpoint` in Cytoscape.js must be explicitly calculated and applied relative to the node centers.
4.  **Color Sync**:
    *   `topology.json` files **do not contain any color properties**.
    *   Subnet colors are allocated dynamically in JavaScript from a premium palette (`SUBNET_PALETTE`).
    *   Edges must automatically inherit the exact color of their connected subnet.
    *   Routers and instances share uniform, premium dark-mode static colors.
5.  **Multi-Subnet Routers**:
    *   Routers connected to multiple subnets must be placed horizontally in the midpoint between those subnets ($X_{router} = \frac{X_{subnet1} + X_{subnet2}}{2}$) and share a stable, non-overlapping $Y$ coordinate.

---

## 💾 Mathematical Positioning & Offset Rules (for script.js)

To maintain straight horizontal lines, Cytoscape.js endpoints are defined using pixel offsets from node centers:
*   **Subnet X-offset**: Left side is `-10px`, Right side is `10px` (based on half-width of `20px`).
*   **Subnet Y-offset (Vertical Slots)**: Nodes on the same side of a subnet are distributed vertically using:
    $$Y = SUBNET\_Y - \frac{SUBNET\_HEIGHT}{2} + \frac{SUBNET\_HEIGHT}{N + 1} \times (k + 1)$$
    where $N$ is the number of connected nodes on that side, and $k$ is the current node index ($0$ to $N-1$).
*   **Router X-offset**: Left edge is `-30px`, Right edge is `30px` (based on half-width of `60px`).
*   **Instance X-offset**: Left edge is `-45px`, Right edge is `45px` (based on half-width of `90px`).

---

## 🛠️ How to Bootstrap the Development Environment
1.  Install project dependencies:
    ```bash
    bun install
    ```
2.  Launch the Hono backend server (port 5000):
    ```bash
    bun run server/index.ts
    ```
3.  Launch the Vite frontend dev server (port 3000):
    ```bash
    bun run dev
    ```
4.  Access the application at `http://localhost:3000/`.

---

## 🎯 Development Roadmap (Prompts for Next Iterations)
Here are suggested tasks/prompts the next engineer can input into Antigravity CLI to easily extend NetAlign:

*   **Prompt for Drag-and-Drop Save**:
    > *"Enable visual node drag-and-drop on the Cytoscape canvas and save the new positions persistently to the Hono backend without breaking the horizontal alignment of connected edges."*
*   **Prompt for Real database**:
    > *"Replace the server file-based JSON persistence in `server/index.ts` with a SQLite database integration using Bun's native `bun:sqlite` module."*
*   **Prompt for Edge Customization**:
    > *"Add a dropdown or interface in the Edge Manager to select an optional gateway/IP interface for the connection and display it as an elegant, glowing text label on the horizontal edge."*
