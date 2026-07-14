# Real-time collaboration

NetAlign can keep multiple browser sessions viewing the **same topology** in sync.

## Overview

| Layer | Role |
|-------|------|
| REST + SQLite | Source of truth for all mutations |
| WebSocket `/api/ws` | Fan-out of successful mutations + presence |
| Client | Applies remote events; full silent refetch on reconnect |

## Concurrency model: last-write-wins (LWW)

- There is **no operational transform or CRDT**. Concurrent edits of the same node/edge field resolve to whichever write commits last in SQLite.
- After each successful REST mutation the server broadcasts a structured event to the topology room.
- The originator of a mutation is identified by the `X-Collab-Client-Id` header (and matching WS `clientId`). That client is **excluded** from the broadcast so optimistic local UI is not double-applied.
- On WebSocket (re)connect the client always performs a **silent full topology reload**. A disconnect cannot leave the store permanently out of sync.

## Protocol (summary)

Connect:

```text
ws(s)://<host>/api/ws?topologyId=<id>&clientId=<uuid>
```

Server messages include `hello`, `presence` (peer count), `event` (mutation), `resync`, `pong`, and `error`.

Client messages: `subscribe`, `unsubscribe`, `ping`.

Event kinds: `node.upserted`, `node.removed`, `nodes.positions`, `edge.upserted`, `edge.removed`, `topology.renamed`, `topology.deleted`, `topology.replaced`.

See `shared/collabProtocol.ts` for the TypeScript contract.

## Presence

The hub tracks how many sockets are subscribed to a topology and broadcasts `presence.peerCount`. The header shows connection status and peer count. Cursors / named avatars are out of scope for this release.

## Security note

HTTP topology routes enforce session + ownership when `NETALIGN_AUTH_MODE=on` (see [`docs/auth.md`](auth.md)). The WebSocket room is keyed only by `topologyId` and does not re-validate ownership on every frame; browsers send cookies on same-origin upgrades, but a client that knows a topology id could still subscribe on an open network.

Treat live collab as best-effort sync for trusted/LAN or private deployments. For public multi-tenant use, keep auth on for REST and prefer reverse-proxy isolation until WS authz is tightened.

## Operations

- Vite dev proxy enables `ws: true` for `/api`.
- Single Bun process only: rooms are in-memory. Horizontal scale needs a shared bus later.
- Swagger/OpenAPI documents HTTP only; this file is the collab contract.
