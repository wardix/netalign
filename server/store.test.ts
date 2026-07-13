import { describe, expect, test } from 'bun:test';
import {
  addEdge,
  addNode,
  createTopology,
  edgeExists,
  getTopology,
  nodeExists,
  updateNodeLabel,
} from './topologyStore.ts';

describe('topologyStore', () => {
  test('creates and reads a topology', () => {
    const id = `topology-store-${Date.now()}`;
    createTopology({ id, name: 'Store Test', nodes: [], edges: [] });

    const topology = getTopology(id);
    expect(topology?.name).toBe('Store Test');
  });

  test('handles concurrent node label updates without losing data', async () => {
    const id = `topology-concurrent-${Date.now()}`;
    createTopology({ id, name: 'Concurrent', nodes: [], edges: [] });
    addNode(id, { id: 'node-a', type: 'router', data: { label: 'A' } });
    addNode(id, { id: 'node-b', type: 'router', data: { label: 'B' } });

    await Promise.all([
      Promise.resolve(updateNodeLabel(id, 'node-a', 'Alpha')),
      Promise.resolve(updateNodeLabel(id, 'node-b', 'Beta')),
      Promise.resolve(updateNodeLabel(id, 'node-a', 'Alpha-2')),
    ]);

    const topology = getTopology(id);
    expect(topology?.nodes.find(n => n.id === 'node-a')?.data?.label).toBe('Alpha-2');
    expect(topology?.nodes.find(n => n.id === 'node-b')?.data?.label).toBe('Beta');
    expect(nodeExists(id, 'node-a')).toBe(true);
    expect(nodeExists(id, 'node-b')).toBe(true);
  });

  test('stores edges with gateway metadata', () => {
    const id = `topology-edge-${Date.now()}`;
    createTopology({ id, name: 'Edge Store', nodes: [], edges: [] });
    addNode(id, { id: 'subnet-1', type: 'subnet', data: { label: 'Subnet' } });
    addNode(id, { id: 'router-1', type: 'router', data: { label: 'Router' } });
    addEdge(id, {
      id: 'e-router-1-subnet-1',
      source: 'router-1',
      target: 'subnet-1',
      gateway: '10.0.0.1',
    });

    expect(edgeExists(id, 'e-router-1-subnet-1')).toBe(true);
    const topology = getTopology(id);
    expect(topology?.edges[0]?.gateway).toBe('10.0.0.1');
  });
});