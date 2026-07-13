import { getGatewayValidationError, normalizeGateway } from './edgeGateway.ts';
import { buildEdgeId } from './edgeIds.ts';
import { validateEdgeBetweenNodes } from './edgeValidation.ts';
import { getInvalidIdError } from './idValidation.ts';
import {
  isTopologyEdge,
  isTopologyNode,
  type Topology,
  type TopologyEdge,
  type TopologyNode,
} from './types.ts';

export const IMPORT_ERRORS = {
  invalidJsonShape: 'Import document must be a topology object with name, nodes, and edges',
  nameRequired: 'Topology name is required',
  invalidNode: 'Import contains an invalid node',
  invalidEdge: 'Import contains an invalid edge',
  duplicateNodeId: 'Import contains duplicate node ids',
  duplicateEdgeId: 'Import contains duplicate edge ids',
  invalidNodeId: 'Import contains a node with an invalid id',
  invalidEdgeId: 'Import contains an edge with an invalid id',
  missingEndpoints: 'Import edge references a missing source or target node',
  sameNode: 'Import edge source and target must be different nodes',
  invalidConnection:
    'Invalid connection: routers and instances can only connect directly to subnets.',
} as const;

export type TopologyImportError = (typeof IMPORT_ERRORS)[keyof typeof IMPORT_ERRORS] | string;

export type TopologyImportResult =
  | { ok: true; topology: Topology }
  | { ok: false; error: TopologyImportError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function generateTopologyId(): string {
  return `topology-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse and validate a topology import document.
 * Always assigns a fresh topology id so imports never collide with existing records.
 * Node/edge ids from the document are preserved when valid.
 */
export function parseTopologyImport(
  raw: unknown,
  options?: { topologyId?: string },
): TopologyImportResult {
  if (!isRecord(raw)) {
    return { ok: false, error: IMPORT_ERRORS.invalidJsonShape };
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    return { ok: false, error: IMPORT_ERRORS.nameRequired };
  }

  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    return { ok: false, error: IMPORT_ERRORS.invalidJsonShape };
  }

  const nodes: TopologyNode[] = [];
  const nodeIds = new Set<string>();

  for (const entry of raw.nodes) {
    if (!isTopologyNode(entry)) {
      return { ok: false, error: IMPORT_ERRORS.invalidNode };
    }
    const idError = getInvalidIdError(entry.id);
    if (idError) {
      return { ok: false, error: IMPORT_ERRORS.invalidNodeId };
    }
    if (nodeIds.has(entry.id)) {
      return { ok: false, error: IMPORT_ERRORS.duplicateNodeId };
    }
    nodeIds.add(entry.id);
    nodes.push(entry);
  }

  const edges: TopologyEdge[] = [];
  const edgeIds = new Set<string>();
  const nodesById = new Map(nodes.map(node => [node.id, node]));

  for (const entry of raw.edges) {
    if (!isTopologyEdge(entry)) {
      return { ok: false, error: IMPORT_ERRORS.invalidEdge };
    }

    const source = entry.source;
    const target = entry.target;
    if (source === target) {
      return { ok: false, error: IMPORT_ERRORS.sameNode };
    }

    const sourceNode = nodesById.get(source);
    const targetNode = nodesById.get(target);
    if (!sourceNode || !targetNode) {
      return { ok: false, error: IMPORT_ERRORS.missingEndpoints };
    }

    const connectionError = validateEdgeBetweenNodes(sourceNode, targetNode);
    if (connectionError) {
      return { ok: false, error: connectionError };
    }

    const gateway = normalizeGateway(entry.gateway);
    if (gateway) {
      const gatewayError = getGatewayValidationError(gateway);
      if (gatewayError) {
        return { ok: false, error: gatewayError };
      }
    }

    const edgeId = entry.id?.trim() || buildEdgeId(source, target);
    const edgeIdError = getInvalidIdError(edgeId);
    if (edgeIdError) {
      return { ok: false, error: IMPORT_ERRORS.invalidEdgeId };
    }
    if (edgeIds.has(edgeId)) {
      return { ok: false, error: IMPORT_ERRORS.duplicateEdgeId };
    }
    edgeIds.add(edgeId);

    const edge: TopologyEdge = { id: edgeId, source, target };
    if (gateway) edge.gateway = gateway;
    edges.push(edge);
  }

  const topologyId = options?.topologyId ?? generateTopologyId();
  const topologyIdError = getInvalidIdError(topologyId);
  if (topologyIdError) {
    return { ok: false, error: topologyIdError };
  }

  return {
    ok: true,
    topology: {
      id: topologyId,
      name,
      nodes,
      edges,
    },
  };
}

/** Build a portable export document (stable schema for download / re-import). */
export function toExportDocument(topology: Topology): Topology {
  return {
    id: topology.id,
    name: topology.name,
    nodes: topology.nodes.map(node => {
      const exported: TopologyNode = {
        id: node.id,
        type: node.type,
      };
      if (node.data) exported.data = { ...node.data };
      if (node.position) exported.position = { ...node.position };
      return exported;
    }),
    edges: topology.edges.map(edge => {
      const exported: TopologyEdge = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
      };
      if (edge.gateway) exported.gateway = edge.gateway;
      return exported;
    }),
  };
}

export function sanitizeExportFilename(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${base || 'topology'}.json`;
}
