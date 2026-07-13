import { describe, expect, test } from 'bun:test';
import {
  colorForSubnet,
  computeLayout,
  computeSubnetHeight,
  layoutResultToPositionUpdates,
  SUBNET_HEIGHT_MIN,
  SUBNET_PALETTE,
  SUBNET_Y,
} from './layoutEngine.ts';

const sampleNodes = [
  { id: 'subnet-1', type: 'subnet', data: { label: 'Subnet 1' } },
  { id: 'subnet-2', type: 'subnet', data: { label: 'Subnet 2' } },
  { id: 'router-1', type: 'router', data: { label: 'Router 1' } },
  { id: 'vm-1', type: 'instance', data: { label: 'VM 1' } },
];

const sampleEdges = [
  { id: 'e-router-1-subnet-1', source: 'router-1', target: 'subnet-1', gateway: '10.0.1.1' },
  { id: 'e-router-1-subnet-2', source: 'router-1', target: 'subnet-2' },
  { id: 'e-subnet-1-vm-1', source: 'subnet-1', target: 'vm-1' },
];

describe('computeSubnetHeight', () => {
  test('keeps minimum height for sparse subnets', () => {
    expect(computeSubnetHeight(0)).toBe(SUBNET_HEIGHT_MIN);
    expect(computeSubnetHeight(1)).toBe(SUBNET_HEIGHT_MIN);
  });

  test('grows with peer count', () => {
    const sparse = computeSubnetHeight(1);
    const dense = computeSubnetHeight(8);
    expect(dense).toBeGreaterThan(sparse);
  });
});

describe('colorForSubnet', () => {
  test('uses palette for early indices', () => {
    expect(colorForSubnet('subnet-1', 0)).toBe(SUBNET_PALETTE[0]);
    expect(colorForSubnet('subnet-2', 1)).toBe(SUBNET_PALETTE[1]);
  });

  test('returns stable HSL beyond palette length by index', () => {
    const idx = SUBNET_PALETTE.length;
    const a = colorForSubnet('extra-subnet-a', idx);
    const b = colorForSubnet('extra-subnet-a', idx);
    const c = colorForSubnet('extra-subnet-a', idx + 1);
    expect(a).toMatch(/^hsl\(/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('computeLayout', () => {
  test('builds positioned node elements for each topology node type', () => {
    const { elements } = computeLayout(sampleNodes, sampleEdges);

    const subnet = elements.find(el => el.data.id === 'subnet-1');
    const router = elements.find(el => el.data.id === 'router-1');
    const instance = elements.find(el => el.data.id === 'vm-1');

    expect(subnet?.position).toEqual({ x: 320, y: SUBNET_Y });
    expect(subnet?.data.color).toBe(SUBNET_PALETTE[0]);
    expect(router?.position?.y).toBeDefined();
    expect(instance?.position?.y).toBe(SUBNET_Y);
  });

  test('places multi-subnet router between connected subnets', () => {
    const { elements } = computeLayout(sampleNodes, sampleEdges);
    const router = elements.find(el => el.data.id === 'router-1');

    expect(router?.position?.x).toBe(495);
  });

  test('adds edge elements and per-edge styles with subnet color', () => {
    const { elements, styles } = computeLayout(sampleNodes, sampleEdges);

    const edge = elements.find(el => el.data.id === 'e-router-1-subnet-1');
    expect(edge?.data.source).toBe('router-1');
    expect(edge?.data.target).toBe('subnet-1');
    expect(edge?.data.label).toBe('10.0.1.1');

    const edgeStyle = styles.find(s => s.selector === '#e-router-1-subnet-1');
    expect(edgeStyle?.style['line-color']).toBe(SUBNET_PALETTE[0]);
    expect(edgeStyle?.style['curve-style']).toBe('straight');
    expect(edgeStyle?.style['source-endpoint']).toBeDefined();
    expect(edgeStyle?.style['target-endpoint']).toBeDefined();
  });

  test('includes base cytoscape styles without react dependencies', () => {
    const { styles } = computeLayout(sampleNodes, sampleEdges);

    expect(styles.some(s => s.selector === 'node')).toBe(true);
    expect(styles.some(s => s.selector === 'node[type="router"]')).toBe(true);
    expect(styles.some(s => s.selector === 'edge[label]')).toBe(true);
  });

  test('uses saved node positions when provided', () => {
    const nodesWithPositions = [
      ...sampleNodes.slice(0, 3),
      { ...sampleNodes[3], position: { x: 180, y: 260 } },
    ];

    const { elements } = computeLayout(nodesWithPositions, sampleEdges);
    const instance = elements.find(el => el.data.id === 'vm-1');

    expect(instance?.position).toEqual({ x: 180, y: 260 });
  });

  test('ignoreSavedPositions recomputes auto-layout', () => {
    const nodesWithPositions = sampleNodes.map(n => ({
      ...n,
      position: { x: 1, y: 1 },
    }));

    const { elements } = computeLayout(nodesWithPositions, sampleEdges, undefined, {
      ignoreSavedPositions: true,
    });
    const subnet = elements.find(el => el.data.id === 'subnet-1');
    expect(subnet?.position).toEqual({ x: 320, y: SUBNET_Y });
  });

  test('tall subnet height when many peers on one side', () => {
    const routers = Array.from({ length: 6 }, (_, i) => ({
      id: `router-${i}`,
      type: 'router' as const,
      data: { label: `R${i}` },
    }));
    const nodes = [
      { id: 'subnet-dense', type: 'subnet' as const, data: { label: 'Dense' } },
      ...routers,
    ];
    const edges = routers.map(r => ({
      id: `e-${r.id}-subnet-dense`,
      source: r.id,
      target: 'subnet-dense',
    }));

    const { elements } = computeLayout(nodes, edges);
    const subnet = elements.find(el => el.data.id === 'subnet-dense');
    expect(Number(subnet?.data.height)).toBeGreaterThan(SUBNET_HEIGHT_MIN);

    const ys = routers.map(r => elements.find(el => el.data.id === r.id)?.position?.y ?? 0);
    const uniqueYs = new Set(ys.map(y => Math.round(y * 10) / 10));
    expect(uniqueYs.size).toBe(routers.length);
  });

  test('assigns distinct colors for more than palette length subnets', () => {
    const nodes = Array.from({ length: SUBNET_PALETTE.length + 3 }, (_, i) => ({
      id: `subnet-x-${i}`,
      type: 'subnet' as const,
      data: { label: `S${i}` },
    }));
    const { elements } = computeLayout(nodes, []);
    const colors = nodes.map(n => elements.find(el => el.data.id === n.id)?.data.color as string);
    expect(new Set(colors).size).toBe(nodes.length);
  });

  test('layoutResultToPositionUpdates extracts node positions only', () => {
    const result = computeLayout(sampleNodes, sampleEdges);
    const updates = layoutResultToPositionUpdates(result);
    expect(updates.some(u => u.nodeId === 'subnet-1')).toBe(true);
    expect(updates.some(u => u.nodeId.startsWith('e-'))).toBe(false);
  });
});
