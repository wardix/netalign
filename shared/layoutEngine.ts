import { buildEdgeId } from './edgeIds.ts';
import type { NodePosition } from './nodePosition.ts';
import { getNodeLabel, type TopologyNode } from './topologyNodes.ts';
import type { TopologyEdge } from './types.ts';

export interface CytoscapeElement {
  data: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface CytoscapeStyle {
  selector: string;
  style: Record<string, unknown>;
}

export interface LayoutResult {
  elements: CytoscapeElement[];
  styles: CytoscapeStyle[];
}

export interface ComputeLayoutOptions {
  /** When true, ignore `node.position` and recompute a fresh auto-layout. */
  ignoreSavedPositions?: boolean;
}

/** Premium dark-mode subnet palette (unique colors; extras use golden-angle HSL). */
export const SUBNET_PALETTE = [
  '#F5A623',
  '#50E3C2',
  '#4A90E2',
  '#7ED321',
  '#E67E22',
  '#1ABC9C',
  '#9B59B6',
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
  '#F39C12',
  '#16A085',
  '#E91E63',
  '#00BCD4',
  '#8BC34A',
  '#FF5722',
] as const;

export const ROUTER_COLOR = '#BD10E0';
export const INSTANCE_COLOR = '#FF6B6B';

/** Minimum subnet bar height (also used when a subnet has few peers). */
export const SUBNET_HEIGHT_MIN = 200;
/** @deprecated Prefer SUBNET_HEIGHT_MIN — kept for existing imports. */
export const SUBNET_HEIGHT = SUBNET_HEIGHT_MIN;
export const SUBNET_HEIGHT_MAX = 720;
/** Vertical budget per peer slot when growing subnet height. */
export const SUBNET_HEIGHT_PER_PEER = 40;
export const SUBNET_Y = 300;

const ROUTER_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%23BD10E0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
            <line x1="12" y1="2" x2="12" y2="22"/>
          </svg>
        `);

const INSTANCE_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="90" height="36" viewBox="0 0 24 24" fill="none" stroke="%23FF6B6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
            <line x1="6" y1="6" x2="6.01" y2="6"/>
            <line x1="6" y1="18" x2="6.01" y2="18"/>
          </svg>
        `);

/**
 * Subnet bar height from max peer count on either side.
 * Grows so horizontal slot spacing stays readable for dense connections.
 */
export function computeSubnetHeight(maxPeersOnOneSide: number): number {
  const peers = Math.max(0, maxPeersOnOneSide);
  if (peers <= 1) return SUBNET_HEIGHT_MIN;
  const needed = (peers + 1) * SUBNET_HEIGHT_PER_PEER;
  return Math.min(SUBNET_HEIGHT_MAX, Math.max(SUBNET_HEIGHT_MIN, needed));
}

/** Stable color for a subnet: palette by index, then golden-angle HSL (unique per index). */
export function colorForSubnet(_subnetId: string, index: number): string {
  if (index >= 0 && index < SUBNET_PALETTE.length) {
    return SUBNET_PALETTE[index]!;
  }
  const extra = index - SUBNET_PALETTE.length;
  const hue = Math.round((extra * 137.508) % 360);
  return `hsl(${hue} 62% 52%)`;
}

function peerSlotY(subnetY: number, subnetHeight: number, index: number, count: number): number {
  if (count <= 1) return subnetY;
  return subnetY - subnetHeight / 2 + (subnetHeight / (count + 1)) * (index + 1);
}

function buildBaseStyles(): CytoscapeStyle[] {
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'background-color': 'data(color)',
        shape: 'data(shape)',
        width: 'data(width)',
        height: 'data(height)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'font-size': 10,
        'font-weight': 'bold',
        color: '#cfd8dc',
        'text-margin-y': 8,
        'text-wrap': 'wrap',
        'text-max-width': 120,
        'border-width': 2.5,
        'border-color': 'rgba(255,255,255,0.1)',
        'border-style': 'solid',
        'transition-property': 'background-color border-color text-color',
        'transition-duration': '0.2s',
        'background-fit': 'contain',
        'background-clip': 'node',
      },
    },
    {
      selector: 'node[type="router"]',
      style: {
        'background-image': ROUTER_SVG,
        'background-color': '#1a1d24',
        'border-color': ROUTER_COLOR,
      },
    },
    {
      selector: 'node[type="instance"]',
      style: {
        'background-image': INSTANCE_SVG,
        'background-color': '#1a1d24',
        'border-color': INSTANCE_COLOR,
      },
    },
    {
      selector: 'node[type="subnet"]',
      style: { 'border-color': 'rgba(255,255,255,0.2)', 'background-opacity': 0.85 },
    },
    { selector: 'node:selected', style: { 'border-color': '#fff', 'border-width': 3, color: '#ffffff' } },
    {
      selector: 'edge[label]',
      style: {
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': 9,
        'font-weight': '600',
        'text-outline-width': 3,
        'text-outline-opacity': 0.85,
        'text-background-opacity': 0,
        'text-margin-y': 0,
      },
    },
    { selector: 'edge:selected', style: { width: 4.5, 'line-color': '#fff' } },
  ];
}

export function computeLayout(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  positionOverrides?: Record<string, NodePosition>,
  options?: ComputeLayoutOptions,
): LayoutResult {
  const ignoreSavedPositions = options?.ignoreSavedPositions === true;

  const subnets = nodes.filter(n => n.type === 'subnet');
  const routers = nodes.filter(n => n.type === 'router');
  const instances = nodes.filter(n => n.type === 'instance' || n.type === 'vm');

  const subnetColors: Record<string, string> = {};
  subnets.forEach((s, i) => {
    subnetColors[s.id] = colorForSubnet(s.id, i);
  });

  const subnetLeftNodes: Record<string, string[]> = {};
  const subnetRightNodes: Record<string, string[]> = {};
  subnets.forEach(s => {
    subnetLeftNodes[s.id] = [];
    subnetRightNodes[s.id] = [];
  });
  const routerConnectedSubnets: Record<string, string[]> = {};
  routers.forEach(r => {
    routerConnectedSubnets[r.id] = [];
  });
  const instanceConnectedSubnets: Record<string, string[]> = {};
  instances.forEach(i => {
    instanceConnectedSubnets[i.id] = [];
  });

  edges.forEach(e => {
    const src = nodes.find(n => n.id === e.source);
    const tgt = nodes.find(n => n.id === e.target);
    if (!src || !tgt) return;
    if (src.type === 'router' && tgt.type === 'subnet') routerConnectedSubnets[src.id].push(tgt.id);
    else if (src.type === 'subnet' && tgt.type === 'router') routerConnectedSubnets[tgt.id].push(src.id);
    else if ((src.type === 'instance' || src.type === 'vm') && tgt.type === 'subnet') {
      instanceConnectedSubnets[src.id].push(tgt.id);
    } else if (src.type === 'subnet' && (tgt.type === 'instance' || tgt.type === 'vm')) {
      instanceConnectedSubnets[tgt.id].push(src.id);
    }
  });

  const multiSubnetRouters: string[] = [];
  routers.forEach(r => {
    const con = routerConnectedSubnets[r.id];
    if (con.length === 1) {
      const subnetId = con[0];
      if (subnetLeftNodes[subnetId]) subnetLeftNodes[subnetId].push(r.id);
    } else if (con.length > 1) {
      multiSubnetRouters.push(r.id);
    }
  });

  instances.forEach(inst => {
    const con = instanceConnectedSubnets[inst.id];
    if (con.length >= 1) {
      const subnetId = con[0];
      if (subnetRightNodes[subnetId]) subnetRightNodes[subnetId].push(inst.id);
    }
  });

  const subnetHeights: Record<string, number> = {};
  subnets.forEach(s => {
    const maxPeers = Math.max(subnetLeftNodes[s.id].length, subnetRightNodes[s.id].length);
    subnetHeights[s.id] = computeSubnetHeight(maxPeers);
  });

  const pos: Record<string, { x: number; y: number }> = {};
  subnets.forEach((s, idx) => {
    const x = 320 + idx * 350;
    pos[s.id] = { x, y: SUBNET_Y };
  });

  const subnetEndpoints: Record<string, Record<string, { side: string; offset: number }>> = {};
  subnets.forEach(s => {
    subnetEndpoints[s.id] = {};
  });

  subnets.forEach(s => {
    const left = subnetLeftNodes[s.id];
    const n = left.length;
    const height = subnetHeights[s.id];
    const baseX = pos[s.id].x - 200;
    left.forEach((id, i) => {
      const y = peerSlotY(SUBNET_Y, height, i, n);
      pos[id] = { x: baseX, y };
      subnetEndpoints[s.id][id] = { side: 'left', offset: y - SUBNET_Y };
    });
  });

  subnets.forEach((s, idx) => {
    const right = subnetRightNodes[s.id];
    const n = right.length;
    const height = subnetHeights[s.id];
    const baseX = idx === subnets.length - 1 ? pos[s.id].x + 200 : pos[s.id].x + 150;
    right.forEach((id, i) => {
      const y = peerSlotY(SUBNET_Y, height, i, n);
      pos[id] = { x: baseX, y };
      subnetEndpoints[s.id][id] = { side: 'right', offset: y - SUBNET_Y };
    });
  });

  const multiSlots = [360, 240, 300, 200, 400];
  multiSubnetRouters.forEach((id, i) => {
    const con = routerConnectedSubnets[id];
    const avgX = con.reduce((sum, sid) => sum + (pos[sid]?.x || 0), 0) / con.length || 450;
    const y = multiSlots[i % multiSlots.length];
    pos[id] = { x: avgX, y };
    con.forEach(sid => {
      const side = pos[id].x < pos[sid].x ? 'left' : 'right';
      subnetEndpoints[sid][id] = { side, offset: y - SUBNET_Y };
    });
  });

  if (!ignoreSavedPositions) {
    applySavedPositions(nodes, pos);
  }
  if (positionOverrides) {
    Object.assign(pos, positionOverrides);
  }
  const resolvedEndpoints = buildSubnetEndpoints(nodes, edges, pos);

  const cyElements: CytoscapeElement[] = [];
  subnets.forEach(s => {
    cyElements.push({
      data: {
        id: s.id,
        label: getNodeLabel(s),
        type: 'subnet',
        color: subnetColors[s.id],
        shape: 'round-rectangle',
        width: 20,
        height: subnetHeights[s.id],
      },
      position: pos[s.id],
    });
  });
  routers.forEach(r => {
    cyElements.push({
      data: {
        id: r.id,
        label: getNodeLabel(r),
        type: 'router',
        color: ROUTER_COLOR,
        shape: 'diamond',
        width: 60,
        height: 60,
      },
      position: pos[r.id],
    });
  });
  instances.forEach(i => {
    cyElements.push({
      data: {
        id: i.id,
        label: getNodeLabel(i),
        type: 'instance',
        color: INSTANCE_COLOR,
        shape: 'round-rectangle',
        width: 90,
        height: 36,
      },
      position: pos[i.id],
    });
  });

  const edgeStyles: CytoscapeStyle[] = [];
  edges.forEach(e => {
    const edgeId = e.id || buildEdgeId(e.source, e.target);
    cyElements.push({
      data: {
        id: edgeId,
        source: e.source,
        target: e.target,
        ...(e.gateway ? { label: e.gateway } : {}),
      },
    });
    const srcNode = nodes.find(n => n.id === e.source);
    const tgtNode = nodes.find(n => n.id === e.target);
    if (!srcNode || !tgtNode) return;
    let subnetNode;
    let peerNode;
    let subnetIsSource;
    if (srcNode.type === 'subnet') {
      subnetNode = srcNode;
      peerNode = tgtNode;
      subnetIsSource = true;
    } else if (tgtNode.type === 'subnet') {
      subnetNode = tgtNode;
      peerNode = srcNode;
      subnetIsSource = false;
    } else return;
    const subnetId = subnetNode.id;
    const peerId = peerNode.id;
    const subnetColor = subnetColors[subnetId];
    const endpointInfo = resolvedEndpoints[subnetId][peerId];
    if (!endpointInfo) return;
    const subnetYOffset = endpointInfo.offset;
    const side = endpointInfo.side;
    const subnetXOffsetVal = side === 'left' ? -10 : 10;
    const subnetEndpointStr = `${subnetXOffsetVal}px ${subnetYOffset}px`;
    const peerEndpointStr =
      peerNode.type === 'router'
        ? side === 'left'
          ? '30px 0px'
          : '-30px 0px'
        : side === 'left'
          ? '45px 0px'
          : '-45px 0px';
    const sourceEndpoint = subnetIsSource ? subnetEndpointStr : peerEndpointStr;
    const targetEndpoint = subnetIsSource ? peerEndpointStr : subnetEndpointStr;
    edgeStyles.push({
      selector: `#${edgeId}`,
      style: {
        width: 2.5,
        'line-color': subnetColor,
        'curve-style': 'straight',
        'source-endpoint': sourceEndpoint,
        'target-endpoint': targetEndpoint,
        ...(e.gateway
          ? {
              color: subnetColor,
              'text-outline-color': subnetColor,
            }
          : {}),
      },
    });
  });

  return {
    elements: cyElements,
    styles: [...buildBaseStyles(), ...edgeStyles],
  };
}

export function applySavedPositions(
  nodes: TopologyNode[],
  pos: Record<string, NodePosition>,
): void {
  nodes.forEach(node => {
    if (node.position) {
      pos[node.id] = { x: node.position.x, y: node.position.y };
    }
  });
}

export function buildSubnetEndpoints(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  pos: Record<string, NodePosition>,
): Record<string, Record<string, { side: string; offset: number }>> {
  const subnets = nodes.filter(n => n.type === 'subnet');
  const subnetEndpoints: Record<string, Record<string, { side: string; offset: number }>> = {};
  subnets.forEach(s => {
    subnetEndpoints[s.id] = {};
  });

  edges.forEach(e => {
    const src = nodes.find(n => n.id === e.source);
    const tgt = nodes.find(n => n.id === e.target);
    if (!src || !tgt) return;

    let subnetNode: TopologyNode | undefined;
    let peerNode: TopologyNode | undefined;
    if (src.type === 'subnet' && (tgt.type === 'router' || tgt.type === 'instance' || tgt.type === 'vm')) {
      subnetNode = src;
      peerNode = tgt;
    } else if (tgt.type === 'subnet' && (src.type === 'router' || src.type === 'instance' || src.type === 'vm')) {
      subnetNode = tgt;
      peerNode = src;
    } else {
      return;
    }

    const subnetPos = pos[subnetNode.id];
    const peerPos = pos[peerNode.id];
    if (!subnetPos || !peerPos) return;

    const side = peerPos.x < subnetPos.x ? 'left' : 'right';
    subnetEndpoints[subnetNode.id][peerNode.id] = {
      side,
      offset: peerPos.y - subnetPos.y,
    };
  });

  return subnetEndpoints;
}

export function getConnectedPeerIds(
  nodeId: string,
  nodeType: string,
  edges: TopologyEdge[],
  nodes: TopologyNode[],
): string[] {
  if (nodeType !== 'subnet') return [];

  const peerIds = new Set<string>();
  edges.forEach(edge => {
    if (edge.source !== nodeId && edge.target !== nodeId) return;
    const peerId = edge.source === nodeId ? edge.target : edge.source;
    const peer = nodes.find(n => n.id === peerId);
    if (peer && peer.type !== 'subnet') peerIds.add(peerId);
  });

  return [...peerIds];
}

/** Collect node position snapshots from a layout result (nodes only). */
export function layoutResultToPositionUpdates(
  result: LayoutResult,
): { nodeId: string; position: NodePosition }[] {
  const updates: { nodeId: string; position: NodePosition }[] = [];
  for (const el of result.elements) {
    const id = el.data.id;
    if (typeof id !== 'string' || !el.position) continue;
    if (el.data.source !== undefined) continue; // edge
    updates.push({ nodeId: id, position: { x: el.position.x, y: el.position.y } });
  }
  return updates;
}
