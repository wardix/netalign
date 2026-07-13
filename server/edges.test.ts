import { describe, expect, test } from 'bun:test';
import server from './index.ts';

describe('POST /api/topologies/:id/edges', () => {
  test('rejects router-to-router connections', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'router-1', target: 'router-2' }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('only connect directly to subnets');
  });

  test('rejects instance-to-instance connections', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'vm-1', target: 'vm-2' }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test('rejects router-to-instance connections', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'router-1', target: 'vm-1' }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test('rejects duplicate edges', async () => {
    const payload = { source: 'subnet-1', target: 'vm-3' };
    const edgeId = 'e-subnet-1-vm-3';

    await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );

    const duplicate = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );

    expect(duplicate.status).toBe(400);
    const body = await duplicate.json();
    expect(body.error).toContain('already exists');

    await server.fetch(
      new Request(`http://localhost/api/topologies/topology-1/edges/${edgeId}`, {
        method: 'DELETE',
      }),
    );
  });

  test('stores optional gateway on new edge', async () => {
    const payload = { source: 'subnet-1', target: 'vm-3', gateway: '10.0.1.50' };
    const edgeId = 'e-subnet-1-vm-3';

    const response = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.gateway).toBe('10.0.1.50');

    await server.fetch(
      new Request(`http://localhost/api/topologies/topology-1/edges/${edgeId}`, {
        method: 'DELETE',
      }),
    );
  });

  test('rejects invalid gateway on create', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'subnet-1', target: 'vm-3', gateway: 'bad gateway' }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('invalid characters');
  });
});

describe('PUT /api/topologies/:id/edges/:edgeId', () => {
  test('updates and clears gateway', async () => {
    const edgeId = 'e-subnet-1-vm-1';

    const update = await server.fetch(
      new Request(`http://localhost/api/topologies/topology-1/edges/${edgeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: 'eth0' }),
      }),
    );

    expect(update.status).toBe(200);
    const updated = await update.json();
    expect(updated.gateway).toBe('eth0');

    const clear = await server.fetch(
      new Request(`http://localhost/api/topologies/topology-1/edges/${edgeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: '' }),
      }),
    );

    expect(clear.status).toBe(200);
    const cleared = await clear.json();
    expect(cleared.gateway).toBeUndefined();
  });

  test('rejects invalid gateway on update', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/edges/e-subnet-1-vm-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: 'a'.repeat(65) }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('64 characters');
  });
});