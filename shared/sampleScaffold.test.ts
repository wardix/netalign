import { describe, expect, test } from 'bun:test';
import { isValidEdgeConnection } from './edgeValidation.ts';
import { buildSampleScaffold } from './sampleScaffold.ts';

describe('buildSampleScaffold', () => {
  test('creates three nodes and two valid edges', () => {
    const plan = buildSampleScaffold('abc123');
    expect(plan.nodes).toHaveLength(3);
    expect(plan.edges).toHaveLength(2);

    const byId = Object.fromEntries(plan.nodes.map(n => [n.nodeId, n]));
    for (const edge of plan.edges) {
      const source = byId[edge.source];
      const target = byId[edge.target];
      expect(source).toBeDefined();
      expect(target).toBeDefined();
      expect(isValidEdgeConnection(source!.type, target!.type)).toBe(true);
    }
  });

  test('uses suffix in ids', () => {
    const plan = buildSampleScaffold('xyz');
    expect(plan.nodes.every(n => n.nodeId.includes('xyz'))).toBe(true);
  });
});
