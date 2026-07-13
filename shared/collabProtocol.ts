/**
 * WebSocket collaboration protocol for NetAlign.
 *
 * Concurrency model: last-write-wins (LWW).
 * - SQLite + REST remain the source of truth.
 * - Successful mutations are broadcast to subscribers of the same topology.
 * - Clients apply remote events optimistically; on reconnect they full-resync.
 * - Concurrent edits of the same field are not merged (no OT/CRDT yet).
 *
 * Auth is not required for this channel (see #53). Treat the network as trusted
 * LAN/dev until authentication lands.
 */
import type { Topology, TopologyEdge, TopologyNode } from './types.ts';
import type { NodePosition } from './nodePosition.ts';

export const COLLAB_CLIENT_HEADER = 'x-collab-client-id';

export const COLLAB_WS_PATH = '/api/ws';

export type CollabTopologyEvent =
  | { kind: 'topology.renamed'; topologyId: string; name: string }
  | { kind: 'topology.deleted'; topologyId: string }
  | { kind: 'node.upserted'; topologyId: string; node: TopologyNode }
  | { kind: 'node.removed'; topologyId: string; nodeId: string }
  | {
      kind: 'nodes.positions';
      topologyId: string;
      updates: { nodeId: string; position: NodePosition }[];
    }
  | { kind: 'edge.upserted'; topologyId: string; edge: TopologyEdge }
  | { kind: 'edge.removed'; topologyId: string; edgeId: string }
  | { kind: 'topology.replaced'; topologyId: string; topology: Topology };

export type ClientToServerMessage =
  | { type: 'subscribe'; topologyId: string; clientId: string }
  | { type: 'unsubscribe' }
  | { type: 'ping' };

export type ServerToClientMessage =
  | {
      type: 'hello';
      clientId: string;
      topologyId: string | null;
      peerCount: number;
    }
  | { type: 'presence'; topologyId: string; peerCount: number }
  | {
      type: 'event';
      event: CollabTopologyEvent;
      originClientId?: string;
    }
  | { type: 'resync'; topologyId: string; reason?: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };

export function parseClientMessage(raw: string): ClientToServerMessage | null {
  try {
    const value = JSON.parse(raw) as ClientToServerMessage;
    if (!value || typeof value !== 'object' || !('type' in value)) return null;
    if (value.type === 'ping') return { type: 'ping' };
    if (value.type === 'unsubscribe') return { type: 'unsubscribe' };
    if (value.type === 'subscribe') {
      if (typeof value.topologyId !== 'string' || typeof value.clientId !== 'string') {
        return null;
      }
      if (!value.topologyId || !value.clientId) return null;
      return {
        type: 'subscribe',
        topologyId: value.topologyId,
        clientId: value.clientId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeMessage(message: ServerToClientMessage | ClientToServerMessage): string {
  return JSON.stringify(message);
}

export function parseServerMessage(raw: string): ServerToClientMessage | null {
  try {
    const value = JSON.parse(raw) as ServerToClientMessage;
    if (!value || typeof value !== 'object' || typeof value.type !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}
