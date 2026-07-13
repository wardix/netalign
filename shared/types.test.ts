import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTopology, isTopologyEdge, isTopologyNode } from './types.ts';

const topology1 = JSON.parse(
  readFileSync(join(import.meta.dir, '../server/data/topology-1.json'), 'utf8'),
);

describe('topology domain types', () => {
  test('default topology JSON matches Topology shape', () => {
    expect(isTopology(topology1)).toBe(true);
  });

  test('validates node and edge records', () => {
    expect(isTopologyNode(topology1.nodes[0])).toBe(true);
    expect(isTopologyEdge(topology1.edges[0])).toBe(true);
  });

  test('rejects malformed topology payloads', () => {
    expect(isTopology(null)).toBe(false);
    expect(isTopology({ id: 'x', name: 'x', nodes: [], edges: [{}] })).toBe(false);
  });
});