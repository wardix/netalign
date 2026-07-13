import { describe, expect, test } from 'bun:test';
import {
  reconcileEdgeSelection,
  reconcileNodeSelection,
  toSelectedNodeData,
} from './selectionUtils.ts';

const nodes = [
  { id: 'subnet-1', type: 'subnet' as const, data: { label: 'Subnet One' } },
  { id: 'router-1', type: 'router' as const },
];

const edges = [
  { id: 'e-router-1-subnet-1', source: 'router-1', target: 'subnet-1', gateway: '10.0.0.1' },
];

describe('toSelectedNodeData', () => {
  test('uses data.label when present', () => {
    expect(toSelectedNodeData(nodes[0]!)).toEqual({
      id: 'subnet-1',
      label: 'Subnet One',
      type: 'subnet',
    });
  });

  test('falls back to id when label missing', () => {
    expect(toSelectedNodeData(nodes[1]!)).toEqual({
      id: 'router-1',
      label: 'router-1',
      type: 'router',
    });
  });
});

describe('reconcileNodeSelection', () => {
  test('keeps selection when node still exists', () => {
    const result = reconcileNodeSelection('subnet-1', nodes);
    expect(result.selectedNodeId).toBe('subnet-1');
    expect(result.selectedNodeData?.label).toBe('Subnet One');
  });

  test('clears selection when node was removed', () => {
    const result = reconcileNodeSelection('gone', nodes);
    expect(result.selectedNodeId).toBeNull();
    expect(result.selectedNodeData).toBeNull();
  });
});

describe('reconcileEdgeSelection', () => {
  test('keeps selection when edge still exists', () => {
    const result = reconcileEdgeSelection('e-router-1-subnet-1', edges);
    expect(result.selectedEdgeData?.gateway).toBe('10.0.0.1');
  });

  test('clears selection when edge was removed', () => {
    const result = reconcileEdgeSelection('e-missing', edges);
    expect(result.selectedEdgeId).toBeNull();
    expect(result.selectedEdgeData).toBeNull();
  });
});
