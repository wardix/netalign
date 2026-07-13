import { describe, expect, test } from 'bun:test';
import { computeLayout, SUBNET_PALETTE, SUBNET_Y } from './layoutEngine.ts';

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
});