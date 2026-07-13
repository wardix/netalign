import type { ServerToClientMessage } from '../shared/collabProtocol.ts';
import { serializeMessage } from '../shared/collabProtocol.ts';

/** Minimal socket surface used by the hub (Bun ServerWebSocket compatible). */
export interface CollabSocket {
  send(data: string): void;
  data: CollabSocketData;
}

export interface CollabSocketData {
  clientId: string;
  /** Room currently joined (null if not subscribed). */
  topologyId: string | null;
  /** Optional topology from upgrade query; applied on open. */
  pendingTopologyId?: string | null;
}

/**
 * In-memory pub/sub rooms keyed by topology id.
 * Safe under single-process Bun; multi-instance would need Redis/bus later.
 */
export class CollabHub {
  private rooms = new Map<string, Set<CollabSocket>>();

  join(ws: CollabSocket, topologyId: string): void {
    this.leave(ws);
    ws.data.topologyId = topologyId;
    let room = this.rooms.get(topologyId);
    if (!room) {
      room = new Set();
      this.rooms.set(topologyId, room);
    }
    room.add(ws);
  }

  leave(ws: CollabSocket): void {
    const topologyId = ws.data.topologyId;
    if (!topologyId) return;
    const room = this.rooms.get(topologyId);
    if (!room) {
      ws.data.topologyId = null;
      return;
    }
    room.delete(ws);
    if (room.size === 0) {
      this.rooms.delete(topologyId);
    }
    ws.data.topologyId = null;
  }

  peerCount(topologyId: string): number {
    return this.rooms.get(topologyId)?.size ?? 0;
  }

  /**
   * Send a message to every socket in the topology room.
   * Optionally skip the originating client (they already applied via REST optimism).
   */
  broadcast(
    topologyId: string,
    message: ServerToClientMessage,
    options?: { excludeClientId?: string },
  ): number {
    const room = this.rooms.get(topologyId);
    if (!room || room.size === 0) return 0;

    const payload = serializeMessage(message);
    let sent = 0;
    for (const socket of room) {
      if (options?.excludeClientId && socket.data.clientId === options.excludeClientId) {
        continue;
      }
      try {
        socket.send(payload);
        sent += 1;
      } catch {
        // Drop dead sockets on next leave/open cycle.
      }
    }
    return sent;
  }

  /** Notify remaining peers of updated occupancy. */
  broadcastPresence(topologyId: string): void {
    this.broadcast(topologyId, {
      type: 'presence',
      topologyId,
      peerCount: this.peerCount(topologyId),
    });
  }

  /** Test/debug: active room ids. */
  roomIds(): string[] {
    return [...this.rooms.keys()];
  }

  clear(): void {
    this.rooms.clear();
  }
}

/** Process-wide hub used by HTTP mutation handlers and WS lifecycle. */
export const collabHub = new CollabHub();
