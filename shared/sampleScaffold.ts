import type { CreateEdgeBody, CreateNodeBody } from './types.ts';

export interface SampleScaffoldPlan {
  nodes: CreateNodeBody[];
  edges: CreateEdgeBody[];
}

/**
 * Build a minimal valid topology: subnet ← router, subnet ← instance.
 * Uses a unique suffix so repeated scaffolds on the same topology do not collide.
 */
export function buildSampleScaffold(suffix: string = Date.now().toString(36)): SampleScaffoldPlan {
  const safe = suffix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'demo';
  const subnetId = `subnet-demo-${safe}`;
  const routerId = `router-demo-${safe}`;
  const instanceId = `instance-demo-${safe}`;

  return {
    nodes: [
      { nodeId: subnetId, type: 'subnet', label: 'Demo Subnet' },
      { nodeId: routerId, type: 'router', label: 'Demo Router' },
      { nodeId: instanceId, type: 'instance', label: 'Demo Instance' },
    ],
    edges: [
      { source: routerId, target: subnetId, gateway: '10.0.0.1' },
      { source: instanceId, target: subnetId },
    ],
  };
}
