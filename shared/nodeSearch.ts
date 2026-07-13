import { getNodeLabel, type TopologyNode } from './topologyNodes.ts';

export interface NodeSearchHit {
  id: string;
  label: string;
  type: string;
}

/**
 * Case-insensitive match of query against node id or label.
 * Empty query returns no hits (caller may treat as “show none”).
 */
export function searchTopologyNodes(nodes: TopologyNode[], query: string): NodeSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return nodes
    .filter(node => {
      const label = getNodeLabel(node).toLowerCase();
      return node.id.toLowerCase().includes(q) || label.includes(q);
    })
    .map(node => ({
      id: node.id,
      label: getNodeLabel(node).replace(/\n/g, ' '),
      type: node.type,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}
