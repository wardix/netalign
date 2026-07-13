import type { TopologyEdge, TopologyNode } from '../../shared/types.ts';
import type { SelectedNodeData } from './useSelection.ts';

export function toSelectedNodeData(node: TopologyNode): SelectedNodeData {
  return {
    id: node.id,
    label: node.data?.label || node.id,
    type: node.type,
  };
}

/**
 * Resolve selection after topology data reloads.
 * Returns null fields when the selected id no longer exists.
 */
export function reconcileNodeSelection(
  selectedNodeId: string | null,
  nodes: TopologyNode[],
): { selectedNodeId: string | null; selectedNodeData: SelectedNodeData | null } {
  if (!selectedNodeId) {
    return { selectedNodeId: null, selectedNodeData: null };
  }
  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) {
    return { selectedNodeId: null, selectedNodeData: null };
  }
  return { selectedNodeId, selectedNodeData: toSelectedNodeData(node) };
}

export function reconcileEdgeSelection(
  selectedEdgeId: string | null,
  edges: TopologyEdge[],
): { selectedEdgeId: string | null; selectedEdgeData: TopologyEdge | null } {
  if (!selectedEdgeId) {
    return { selectedEdgeId: null, selectedEdgeData: null };
  }
  const edge = edges.find(e => e.id === selectedEdgeId);
  if (!edge) {
    return { selectedEdgeId: null, selectedEdgeData: null };
  }
  return { selectedEdgeId, selectedEdgeData: edge };
}
