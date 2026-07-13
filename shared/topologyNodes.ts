import { isValidEdgeConnection } from './edgeValidation.ts';

export interface TopologyNode {
  id: string;
  type: string;
  data?: { label?: string };
}

export function getNodeLabel(node: TopologyNode): string {
  return node.data?.label || node.id;
}

export function formatNodeOptionLabel(node: TopologyNode): string {
  const label = getNodeLabel(node).replace(/\n/g, ' ');
  return `${label} (${node.type.toUpperCase()})`;
}

export function sortNodesByLabel(nodes: TopologyNode[]): TopologyNode[] {
  return [...nodes].sort((a, b) =>
    getNodeLabel(a).localeCompare(getNodeLabel(b), undefined, { sensitivity: 'base' }),
  );
}

export function getValidTargetNodes(
  sourceId: string | undefined,
  nodes: TopologyNode[],
): TopologyNode[] {
  if (!sourceId) return [];

  const sourceNode = nodes.find(node => node.id === sourceId);
  if (!sourceNode) return [];

  return sortNodesByLabel(
    nodes.filter(
      node =>
        node.id !== sourceId &&
        isValidEdgeConnection(sourceNode.type, node.type),
    ),
  );
}