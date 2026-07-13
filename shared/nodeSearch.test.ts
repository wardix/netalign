import { describe, expect, test } from 'bun:test';
import { searchTopologyNodes } from './nodeSearch.ts';

const nodes = [
  { id: 'subnet-1', type: 'subnet' as const, data: { label: 'Subnet-1\n10.0.1.0/24' } },
  { id: 'router-1', type: 'router' as const, data: { label: 'Core Router' } },
  { id: 'vm-1', type: 'instance' as const, data: { label: 'App VM' } },
];

describe('searchTopologyNodes', () => {
  test('returns empty for blank query', () => {
    expect(searchTopologyNodes(nodes, '  ')).toEqual([]);
  });

  test('matches id substring', () => {
    const hits = searchTopologyNodes(nodes, 'router');
    expect(hits.map(h => h.id)).toEqual(['router-1']);
  });

  test('matches label substring case-insensitively', () => {
    const hits = searchTopologyNodes(nodes, 'core');
    expect(hits[0]?.id).toBe('router-1');
  });

  test('matches multi-line labels', () => {
    const hits = searchTopologyNodes(nodes, '10.0.1');
    expect(hits[0]?.id).toBe('subnet-1');
  });
});
