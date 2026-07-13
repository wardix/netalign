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
});