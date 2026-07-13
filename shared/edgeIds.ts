/**
 * Canonical edge ID format: `e-{sourceNodeId}-{targetNodeId}`
 * using the topology's actual node IDs (e.g. `e-router-1-subnet-1`).
 */
export function buildEdgeId(source: string, target: string): string {
  return `e-${source}-${target}`;
}