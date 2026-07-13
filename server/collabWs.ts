import type { ServerWebSocket } from 'bun';
import {
  COLLAB_WS_PATH,
  parseClientMessage,
  serializeMessage,
  type ServerToClientMessage,
} from '../shared/collabProtocol.ts';
import { isValidResourceId } from '../shared/idValidation.ts';
import { collabHub, type CollabSocketData } from './collabHub.ts';
import { logger } from './logger.ts';

export type CollabServerWebSocket = ServerWebSocket<CollabSocketData>;

function send(ws: CollabServerWebSocket, message: ServerToClientMessage): void {
  try {
    ws.send(serializeMessage(message));
  } catch (error) {
    logger.error('collab_ws_send_failed', { err: error });
  }
}

export function isCollabWsPath(pathname: string): boolean {
  return pathname === COLLAB_WS_PATH;
}

/**
 * Attempt WebSocket upgrade. Returns a Response when upgrade is not possible
 * (e.g. unit tests calling fetch without a Bun server).
 */
export function tryUpgradeCollabSocket(
  req: Request,
  server: { upgrade: (req: Request, options: { data: CollabSocketData }) => boolean } | undefined,
): Response | undefined {
  if (!server) {
    return new Response('WebSocket upgrade requires Bun.serve', {
      status: 426,
      headers: { Upgrade: 'websocket' },
    });
  }

  const url = new URL(req.url);
  const topologyIdParam = url.searchParams.get('topologyId') ?? '';
  const clientIdParam = url.searchParams.get('clientId')?.trim() || crypto.randomUUID();

  if (topologyIdParam && !isValidResourceId(topologyIdParam)) {
    return new Response(JSON.stringify({ error: 'Invalid topology id', code: 'INVALID_ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data: CollabSocketData = {
    clientId: clientIdParam,
    topologyId: null,
    pendingTopologyId: topologyIdParam || null,
  };

  const upgraded = server.upgrade(req, { data });
  if (!upgraded) {
    return new Response('WebSocket upgrade failed', { status: 500 });
  }

  // Bun expects undefined/null body after successful upgrade.
  return undefined;
}

export const collabWebsocket = {
  open(ws: CollabServerWebSocket) {
    const pending = ws.data.pendingTopologyId;
    ws.data.pendingTopologyId = null;
    if (pending && isValidResourceId(pending)) {
      collabHub.join(ws, pending);
      collabHub.broadcastPresence(pending);
      send(ws, {
        type: 'hello',
        clientId: ws.data.clientId,
        topologyId: pending,
        peerCount: collabHub.peerCount(pending),
      });
      return;
    }

    send(ws, {
      type: 'hello',
      clientId: ws.data.clientId,
      topologyId: null,
      peerCount: 0,
    });
  },

  message(ws: CollabServerWebSocket, message: string | Buffer) {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const parsed = parseClientMessage(raw);
    if (!parsed) {
      send(ws, { type: 'error', message: 'Invalid message' });
      return;
    }

    if (parsed.type === 'ping') {
      send(ws, { type: 'pong' });
      return;
    }

    if (parsed.type === 'unsubscribe') {
      const previous = ws.data.topologyId;
      collabHub.leave(ws);
      if (previous) collabHub.broadcastPresence(previous);
      send(ws, {
        type: 'hello',
        clientId: ws.data.clientId,
        topologyId: null,
        peerCount: 0,
      });
      return;
    }

    if (parsed.type === 'subscribe') {
      if (!isValidResourceId(parsed.topologyId)) {
        send(ws, { type: 'error', message: 'Invalid topology id' });
        return;
      }

      // Allow client to set/replace its id (also used for REST echo filtering).
      if (parsed.clientId) {
        ws.data.clientId = parsed.clientId;
      }

      const previous = ws.data.topologyId;
      collabHub.join(ws, parsed.topologyId);
      if (previous && previous !== parsed.topologyId) {
        collabHub.broadcastPresence(previous);
      }
      collabHub.broadcastPresence(parsed.topologyId);

      send(ws, {
        type: 'hello',
        clientId: ws.data.clientId,
        topologyId: parsed.topologyId,
        peerCount: collabHub.peerCount(parsed.topologyId),
      });
    }
  },

  close(ws: CollabServerWebSocket) {
    const topologyId = ws.data.topologyId;
    collabHub.leave(ws);
    if (topologyId) {
      collabHub.broadcastPresence(topologyId);
    }
  },
};

/**
 * Publish a topology event to room peers (used after successful REST mutations).
 */
export function publishTopologyEvent(
  topologyId: string,
  event: import('../shared/collabProtocol.ts').CollabTopologyEvent,
  originClientId?: string,
): void {
  collabHub.broadcast(
    topologyId,
    {
      type: 'event',
      event,
      originClientId,
    },
    originClientId ? { excludeClientId: originClientId } : undefined,
  );
}
