export type TopologyNodeType = 'subnet' | 'router' | 'instance';

export const EDGE_VALIDATION_ERROR =
  'Invalid connection: routers and instances can only connect directly to subnets.';

export function normalizeNodeType(type: string): TopologyNodeType | null {
  if (type === 'subnet' || type === 'router') return type;
  if (type === 'instance' || type === 'vm') return 'instance';
  return null;
}

export function isValidEdgeConnection(sourceType: string, targetType: string): boolean {
  const source = normalizeNodeType(sourceType);
  const target = normalizeNodeType(targetType);
  if (!source || !target) return false;

  const hasSubnet = source === 'subnet' || target === 'subnet';
  const hasRouterOrInstance =
    source === 'router' || source === 'instance' ||
    target === 'router' || target === 'instance';

  return hasSubnet && hasRouterOrInstance && source !== target;
}

export function validateEdgeBetweenNodes(
  sourceNode: { type: string },
  targetNode: { type: string },
): string | null {
  if (sourceNode.type === targetNode.type && sourceNode.type !== 'subnet') {
    return EDGE_VALIDATION_ERROR;
  }
  if (!isValidEdgeConnection(sourceNode.type, targetNode.type)) {
    return EDGE_VALIDATION_ERROR;
  }
  return null;
}