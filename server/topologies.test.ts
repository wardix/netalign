import { afterAll, describe, expect, test } from 'bun:test';
import server from './index.ts';

const createdTopologyIds: string[] = [];

afterAll(async () => {
  for (const id of createdTopologyIds) {
    await server.fetch(
      new Request(`http://localhost/api/topologies/${id}`, { method: 'DELETE' }),
    );
  }
});

describe('topology CRUD API', () => {
  test('lists topologies', async () => {
    const response = await server.fetch(new Request('http://localhost/api/topologies'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((item: { id: string }) => item.id === 'topology-1')).toBe(true);
  });

  test('reads a topology by id', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1'),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.id).toBe('topology-1');
    expect(Array.isArray(body.nodes)).toBe(true);
    expect(Array.isArray(body.edges)).toBe(true);
  });

  test('creates and deletes a topology', async () => {
    const createResponse = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'CI Test Topology' }),
      }),
    );

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    createdTopologyIds.push(created.id);
    expect(created.name).toBe('CI Test Topology');
    expect(created.nodes).toEqual([]);
    expect(created.edges).toEqual([]);

    const deleteResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${created.id}`, { method: 'DELETE' }),
    );
    expect(deleteResponse.status).toBe(200);
    createdTopologyIds.pop();
  });
});

describe('node CRUD API', () => {
  test('adds and deletes a node in a temporary topology', async () => {
    const createResponse = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Node CRUD Topology' }),
      }),
    );
    const topology = await createResponse.json();
    createdTopologyIds.push(topology.id);

    const addNodeResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'subnet-ci',
          type: 'subnet',
          label: 'CI Subnet',
        }),
      }),
    );
    expect(addNodeResponse.status).toBe(201);

    const deleteNodeResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes/subnet-ci`, {
        method: 'DELETE',
      }),
    );
    expect(deleteNodeResponse.status).toBe(200);
  });
});