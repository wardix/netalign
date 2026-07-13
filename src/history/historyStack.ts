import type { NodePosition } from '../../shared/nodePosition.ts';
import type { TopologyEdge, TopologyNode, TopologyNodeTypeValue } from '../../shared/types.ts';

export interface NodePositionSnapshot {
  nodeId: string;
  position: NodePosition;
}

/** Commands that can be undone/redone against the topology API. */
export type HistoryCommand =
  | {
      type: 'addNode';
      topologyId: string;
      node: {
        id: string;
        type: TopologyNodeTypeValue;
        label: string;
        position?: NodePosition;
      };
    }
  | {
      type: 'deleteNode';
      topologyId: string;
      node: TopologyNode;
      connectedEdges: TopologyEdge[];
    }
  | {
      type: 'addEdge';
      topologyId: string;
      edge: TopologyEdge;
    }
  | {
      type: 'deleteEdge';
      topologyId: string;
      edge: TopologyEdge;
    }
  | {
      type: 'updateNodeLabel';
      topologyId: string;
      nodeId: string;
      previousLabel: string;
      nextLabel: string;
    }
  | {
      type: 'updateEdgeGateway';
      topologyId: string;
      edgeId: string;
      previousGateway: string;
      nextGateway: string;
    }
  | {
      type: 'moveNodes';
      topologyId: string;
      previous: NodePositionSnapshot[];
      next: NodePositionSnapshot[];
    };

export interface HistoryState {
  past: HistoryCommand[];
  future: HistoryCommand[];
}

export const MAX_HISTORY = 100;

export function createEmptyHistory(): HistoryState {
  return { past: [], future: [] };
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}

export function pushHistory(state: HistoryState, command: HistoryCommand): HistoryState {
  const past = [...state.past, command];
  if (past.length > MAX_HISTORY) {
    past.splice(0, past.length - MAX_HISTORY);
  }
  return { past, future: [] };
}

export function popUndo(state: HistoryState): {
  state: HistoryState;
  command: HistoryCommand;
} | null {
  if (state.past.length === 0) return null;
  const past = state.past.slice(0, -1);
  const command = state.past[state.past.length - 1]!;
  return {
    command,
    state: {
      past,
      future: [command, ...state.future],
    },
  };
}

export function popRedo(state: HistoryState): {
  state: HistoryState;
  command: HistoryCommand;
} | null {
  if (state.future.length === 0) return null;
  const [command, ...rest] = state.future;
  return {
    command: command!,
    state: {
      past: [...state.past, command!],
      future: rest,
    },
  };
}

export function clearHistory(): HistoryState {
  return createEmptyHistory();
}
