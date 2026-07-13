import { describe, expect, test } from 'bun:test';
import { buildEdgeId } from './edgeIds.ts';

describe('buildEdgeId', () => {
  test('builds id from source and target node ids', () => {
    expect(buildEdgeId('router-1', 'subnet-1')).toBe('e-router-1-subnet-1');
    expect(buildEdgeId('subnet-1', 'vm-1')).toBe('e-subnet-1-vm-1');
  });
});