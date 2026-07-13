import type { NodePosition } from './nodePosition.ts';

export type TopologyNodeType = 'subnet' | 'router' | 'instance';

/** Stored node type values, including legacy `vm` alias for instances. */
export type TopologyNodeTypeValue = TopologyNodeType | 'vm';

export interface TopologyNodeData {
  label?: string;
}

export interface TopologyNode {
  id: string;
  type: TopologyNodeTypeValue;
  data?: TopologyNodeData;
  position?: NodePosition;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  gateway?: string;
}

export interface Topology {
  id: string;
  name: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface TopologySummary {
  id: string;
  name: string;
}

export interface UpdateNodeBody {
  label?: string;
  position?: NodePosition;
}

export interface NodePositionUpdateItem {
  nodeId: string;
  position: NodePosition;
}

export interface BatchNodePositionsBody {
  updates: NodePositionUpdateItem[];
}

export interface CreateNodeBody {
  nodeId: string;
  type: TopologyNodeTypeValue;
  label?: string;
}

export interface CreateEdgeBody {
  source: string;
  target: string;
  gateway?: string;
}

export interface UpdateEdgeBody {
  gateway?: string;
}

const NODE_TYPES = new Set<TopologyNodeTypeValue>(['subnet', 'router', 'instance', 'vm']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isTopologyNodeData(value: unknown): value is TopologyNodeData {
  if (!isRecord(value)) return false;
  return value.label === undefined || typeof value.label === 'string';
}

export function isTopologyNode(value: unknown): value is TopologyNode {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.type !== 'string' || !NODE_TYPES.has(value.type as TopologyNodeTypeValue)) {
    return false;
  }
  if (value.data !== undefined && !isTopologyNodeData(value.data)) return false;
  if (value.position !== undefined) {
    const position = value.position as { x?: unknown; y?: unknown };
    if (typeof position.x !== 'number' || typeof position.y !== 'number') return false;
  }
  return true;
}

export function isTopologyEdge(value: unknown): value is TopologyEdge {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.source !== 'string' || typeof value.target !== 'string') return false;
  if (value.gateway !== undefined && typeof value.gateway !== 'string') return false;
  return true;
}

export function isTopology(value: unknown): value is Topology {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return false;
  if (!Array.isArray(value.nodes) || !value.nodes.every(isTopologyNode)) return false;
  if (!Array.isArray(value.edges) || !value.edges.every(isTopologyEdge)) return false;
  return true;
}