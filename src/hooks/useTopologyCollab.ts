import { useEffect, useRef, useState } from 'react';
import {
  parseServerMessage,
  serializeMessage,
  type CollabTopologyEvent,
  type ServerToClientMessage,
} from '../../shared/collabProtocol.ts';
import type { TopologyEdge, TopologyNode } from '../../shared/types.ts';
import { getCollabClientId } from '../collab/clientId.ts';
import { buildCollabWsUrl } from '../collab/wsUrl.ts';

export type CollabConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

export interface TopologyCollabHandlers {
  upsertNode: (node: TopologyNode) => void;
  removeNode: (nodeId: string) => void;
  upsertEdge: (edge: TopologyEdge) => void;
  removeEdge: (edgeId: string) => void;
  patchNodePositions: (updates: { nodeId: string; position: { x: number; y: number } }[]) => void;
  /** Full topology replaced (import into an id peers might already watch). */
  replaceTopology?: (nodes: TopologyNode[], edges: TopologyEdge[]) => void;
  /** Silent full refetch — used on reconnect and resync messages. */
  silentRefresh: () => Promise<void>;
  /** Topology list may have changed (rename/delete). */
  onTopologyMetaChange?: () => void;
  onTopologyDeleted?: (topologyId: string) => void;
}

export interface UseTopologyCollabResult {
  status: CollabConnectionStatus;
  peerCount: number;
  clientId: string;
}

const RECONNECT_BASE_MS = 800;
const RECONNECT_MAX_MS = 12_000;

export function useTopologyCollab(
  topologyId: string | null,
  handlers: TopologyCollabHandlers,
): UseTopologyCollabResult {
  const clientIdRef = useRef(getCollabClientId());
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const [status, setStatus] = useState<CollabConnectionStatus>('idle');
  const [peerCount, setPeerCount] = useState(0);

  useEffect(() => {
    if (!topologyId) {
      setStatus('idle');
      setPeerCount(0);
      return;
    }

    let closedByEffect = false;
    let socket: WebSocket | null = null;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const clearTimers = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
    };

    const applyEvent = (event: CollabTopologyEvent, originClientId?: string) => {
      if (originClientId && originClientId === clientIdRef.current) {
        return;
      }
      if (event.topologyId !== topologyId) return;

      const h = handlersRef.current;
      switch (event.kind) {
        case 'node.upserted':
          h.upsertNode(event.node);
          break;
        case 'node.removed':
          h.removeNode(event.nodeId);
          break;
        case 'nodes.positions':
          h.patchNodePositions(event.updates);
          break;
        case 'edge.upserted':
          h.upsertEdge(event.edge);
          break;
        case 'edge.removed':
          h.removeEdge(event.edgeId);
          break;
        case 'topology.replaced':
          if (h.replaceTopology) {
            h.replaceTopology(event.topology.nodes ?? [], event.topology.edges ?? []);
          } else {
            void h.silentRefresh();
          }
          h.onTopologyMetaChange?.();
          break;
        case 'topology.renamed':
          h.onTopologyMetaChange?.();
          break;
        case 'topology.deleted':
          h.onTopologyDeleted?.(event.topologyId);
          h.onTopologyMetaChange?.();
          break;
        default:
          void h.silentRefresh();
      }
    };

    const handleMessage = (data: string) => {
      const msg = parseServerMessage(data) as ServerToClientMessage | null;
      if (!msg) return;

      switch (msg.type) {
        case 'hello':
          setPeerCount(msg.peerCount);
          break;
        case 'presence':
          if (msg.topologyId === topologyId) {
            setPeerCount(msg.peerCount);
          }
          break;
        case 'event':
          applyEvent(msg.event, msg.originClientId);
          break;
        case 'resync':
          if (msg.topologyId === topologyId) {
            void handlersRef.current.silentRefresh();
          }
          break;
        case 'error':
          console.warn('Collab WS error:', msg.message);
          break;
        default:
          break;
      }
    };

    const connect = () => {
      clearTimers();
      setStatus(reconnectAttempt === 0 ? 'connecting' : 'reconnecting');

      const url = buildCollabWsUrl(topologyId, clientIdRef.current);
      socket = new WebSocket(url);

      socket.onopen = () => {
        if (closedByEffect) {
          socket?.close();
          return;
        }
        reconnectAttempt = 0;
        setStatus('connected');
        // Ensure room membership even if query auto-join failed.
        socket?.send(
          serializeMessage({
            type: 'subscribe',
            topologyId,
            clientId: clientIdRef.current,
          }),
        );
        // Keepalive for proxies.
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(serializeMessage({ type: 'ping' }));
          }
        }, 25_000);
        // Resync after (re)connect so a drop never leaves a corrupt local graph.
        void handlersRef.current.silentRefresh();
      };

      socket.onmessage = event => {
        if (typeof event.data === 'string') {
          handleMessage(event.data);
        }
      };

      socket.onclose = () => {
        clearTimers();
        if (closedByEffect) return;
        setStatus('reconnecting');
        const delay = Math.min(
          RECONNECT_MAX_MS,
          RECONNECT_BASE_MS * 2 ** Math.min(reconnectAttempt, 4),
        );
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        // onclose will schedule reconnect
        socket?.close();
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      clearTimers();
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(serializeMessage({ type: 'unsubscribe' }));
        } catch {
          // ignore
        }
      }
      socket?.close();
      setStatus('idle');
      setPeerCount(0);
    };
  }, [topologyId]);

  return {
    status,
    peerCount,
    clientId: clientIdRef.current,
  };
}
