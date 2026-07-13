import { describe, expect, test } from 'bun:test';
import server from './index.ts';

describe('topology ID path traversal protection', () => {
  test('rejects traversal in GET /api/topologies/:id', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/..%2F..%2Fetc%2Fpasswd'),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid ID format');
  });

  test('rejects traversal in DELETE /api/topologies/:id', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/..%2F..%2Fetc%2Fpasswd', {
        method: 'DELETE',
      }),
    );

    expect(response.status).toBe(400);
  });

  test('rejects invalid characters in node routes', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/nodes/evil%2Fnode', {
        method: 'DELETE',
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid ID format');
  });

  test('rejects invalid characters in edge routes', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1/edges/e%2Fbad', {
        method: 'DELETE',
      }),
    );

    expect(response.status).toBe(400);
  });

  test('still allows valid topology access', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/topology-1'),
    );

    expect(response.status).toBe(200);
  });
});