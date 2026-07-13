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

describe('topology import API', () => {
  test('imports a valid topology document as a new topology', async () => {
    const source = await server.fetch(new Request('http://localhost/api/topologies/topology-1'));
    const document = await source.json();

    const response = await server.fetch(
      new Request('http://localhost/api/topologies/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Imported From Seed',
          nodes: document.nodes,
          edges: document.edges,
        }),
      }),
    );
    expect(response.status).toBe(201);

    const imported = await response.json();
    createdTopologyIds.push(imported.id);
    expect(imported.id).not.toBe('topology-1');
    expect(imported.name).toBe('Imported From Seed');
    expect(imported.nodes.length).toBe(document.nodes.length);
    expect(imported.edges.length).toBe(document.edges.length);

    const read = await server.fetch(
      new Request(`http://localhost/api/topologies/${imported.id}`),
    );
    expect(read.status).toBe(200);
    const body = await read.json();
    expect(body.nodes.length).toBe(document.nodes.length);
  });

  test('rejects invalid import documents', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bad Import',
          nodes: [
            { id: 'r1', type: 'router' },
            { id: 'r2', type: 'router' },
          ],
          edges: [{ id: 'e1', source: 'r1', target: 'r2' }],
        }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });
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
    expect(body.edges.every((edge: { id: string; source: string; target: string }) =>
      edge.id === `e-${edge.source}-${edge.target}`,
    )).toBe(true);
  });

  test('renames a topology', async () => {
    const createResponse = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Original Name' }),
      }),
    );
    const topology = await createResponse.json();
    createdTopologyIds.push(topology.id);

    const renameResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed Topology' }),
      }),
    );
    expect(renameResponse.status).toBe(200);

    const renamed = await renameResponse.json();
    expect(renamed.name).toBe('Renamed Topology');

    const readResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}`),
    );
    const body = await readResponse.json();
    expect(body.name).toBe('Renamed Topology');
  });

  test('rejects empty topology name on rename', async () => {
    const createResponse = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Rename Validation' }),
      }),
    );
    const topology = await createResponse.json();
    createdTopologyIds.push(topology.id);

    const renameResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '   ' }),
      }),
    );
    expect(renameResponse.status).toBe(400);
  });

  test('refuses delete of protected seed topology', async () => {
    const del = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1', { method: 'DELETE' }),
    );
    expect(del.status).toBe(403);
    const body = await del.json();
    expect(body.error).toBe('This topology is protected and cannot be deleted');

    const legacy = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/delete', { method: 'POST' }),
    );
    expect(legacy.status).toBe(403);

    const stillThere = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1'),
    );
    expect(stillThere.status).toBe(200);
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

  test('updates a node label', async () => {
    const createResponse = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Node Update Topology' }),
      }),
    );
    const topology = await createResponse.json();
    createdTopologyIds.push(topology.id);

    await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'router-ci',
          type: 'router',
          label: 'Original Label',
        }),
      }),
    );

    const updateResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes/router-ci`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Updated Label' }),
      }),
    );
    expect(updateResponse.status).toBe(200);

    const updated = await updateResponse.json();
    expect(updated.data.label).toBe('Updated Label');

    const readResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}`),
    );
    const body = await readResponse.json();
    const node = body.nodes.find((n: { id: string }) => n.id === 'router-ci');
    expect(node.data.label).toBe('Updated Label');
  });

  test('rejects empty label on update', async () => {
    const createResponse = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Node Validation Topology' }),
      }),
    );
    const topology = await createResponse.json();
    createdTopologyIds.push(topology.id);

    await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'subnet-ci-2',
          type: 'subnet',
          label: 'Subnet',
        }),
      }),
    );

    const updateResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes/subnet-ci-2`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '   ' }),
      }),
    );
    expect(updateResponse.status).toBe(400);
  });

  test('updates a node position', async () => {
    const createResponse = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Node Position Topology' }),
      }),
    );
    const topology = await createResponse.json();
    createdTopologyIds.push(topology.id);

    await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'router-pos',
          type: 'router',
          label: 'Router',
        }),
      }),
    );

    const updateResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes/router-pos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: { x: 410, y: 280 } }),
      }),
    );
    expect(updateResponse.status).toBe(200);

    const updated = await updateResponse.json();
    expect(updated.position).toEqual({ x: 410, y: 280 });

    const readResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}`),
    );
    const body = await readResponse.json();
    const node = body.nodes.find((n: { id: string }) => n.id === 'router-pos');
    expect(node.position).toEqual({ x: 410, y: 280 });
  });

  test('rejects invalid node position on update', async () => {
    const createResponse = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Node Position Validation Topology' }),
      }),
    );
    const topology = await createResponse.json();
    createdTopologyIds.push(topology.id);

    await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'subnet-pos',
          type: 'subnet',
          label: 'Subnet',
        }),
      }),
    );

    const updateResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes/subnet-pos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: { x: 'bad', y: 10 } }),
      }),
    );
    expect(updateResponse.status).toBe(400);
  });

  test('batch-updates multiple node positions in one request', async () => {
    const createResponse = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Batch Position Topology' }),
      }),
    );
    const topology = await createResponse.json();
    createdTopologyIds.push(topology.id);

    for (const nodeId of ['subnet-batch', 'router-batch']) {
      await server.fetch(
        new Request(`http://localhost/api/topologies/${topology.id}/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId,
            type: nodeId.startsWith('subnet') ? 'subnet' : 'router',
            label: nodeId,
          }),
        }),
      );
    }

    const batchResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes/positions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [
            { nodeId: 'subnet-batch', position: { x: 100, y: 200 } },
            { nodeId: 'router-batch', position: { x: 300, y: 200 } },
          ],
        }),
      }),
    );
    expect(batchResponse.status).toBe(200);
    const batchBody = await batchResponse.json();
    expect(batchBody.nodes).toHaveLength(2);

    const readResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}`),
    );
    const body = await readResponse.json();
    expect(body.nodes.find((n: { id: string }) => n.id === 'subnet-batch').position).toEqual({
      x: 100,
      y: 200,
    });
    expect(body.nodes.find((n: { id: string }) => n.id === 'router-batch').position).toEqual({
      x: 300,
      y: 200,
    });
  });

  test('batch position update rejects missing node without partial write', async () => {
    const createResponse = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Batch Position Atomic Topology' }),
      }),
    );
    const topology = await createResponse.json();
    createdTopologyIds.push(topology.id);

    await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'subnet-atomic',
          type: 'subnet',
          label: 'Subnet',
        }),
      }),
    );

    await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes/subnet-atomic`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: { x: 1, y: 1 } }),
      }),
    );

    const batchResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}/nodes/positions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [
            { nodeId: 'subnet-atomic', position: { x: 99, y: 99 } },
            { nodeId: 'missing-node', position: { x: 0, y: 0 } },
          ],
        }),
      }),
    );
    expect(batchResponse.status).toBe(404);

    const readResponse = await server.fetch(
      new Request(`http://localhost/api/topologies/${topology.id}`),
    );
    const body = await readResponse.json();
    const node = body.nodes.find((n: { id: string }) => n.id === 'subnet-atomic');
    expect(node.position).toEqual({ x: 1, y: 1 });
  });
});