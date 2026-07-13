import { describe, expect, test } from 'bun:test';
import {
  formatNodeOptionLabel,
  getValidTargetNodes,
  sortNodesByLabel,
} from './topologyNodes.ts';

const nodes = [
  { id: 'router-1', type: 'router', data: { label: 'Router-1' } },
  { id: 'subnet-1', type: 'subnet', data: { label: 'Subnet-1\n10.0.1.0/24' } },
  { id: 'vm-1', type: 'instance', data: { label: 'VM-1' } },
  { id: 'subnet-2', type: 'subnet', data: { label: 'Subnet-2' } },
];

describe('sortNodesByLabel', () => {
  test('sorts nodes alphabetically by label', () => {
    const sorted = sortNodesByLabel(nodes).map(node => node.id);
    expect(sorted).toEqual(['router-1', 'subnet-1', 'subnet-2', 'vm-1']);
  });
});

describe('formatNodeOptionLabel', () => {
  test('includes label and type', () => {
    expect(formatNodeOptionLabel(nodes[0])).toBe('Router-1 (ROUTER)');
    expect(formatNodeOptionLabel(nodes[1])).toBe('Subnet-1 10.0.1.0/24 (SUBNET)');
  });
});

describe('getValidTargetNodes', () => {
  test('returns subnets when source is a router', () => {
    const targets = getValidTargetNodes('router-1', nodes).map(node => node.id);
    expect(targets).toEqual(['subnet-1', 'subnet-2']);
  });

  test('returns routers and instances when source is a subnet', () => {
    const targets = getValidTargetNodes('subnet-1', nodes).map(node => node.id);
    expect(targets).toEqual(['router-1', 'vm-1']);
  });

  test('returns empty list when source is missing', () => {
    expect(getValidTargetNodes(undefined, nodes)).toEqual([]);
  });
});