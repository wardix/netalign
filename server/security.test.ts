import { describe, expect, test } from 'bun:test';
import server from './index.ts';

describe('CORS allowlist', () => {
  test('reflects allowed local origin in development defaults', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies', {
        headers: { Origin: 'http://localhost:3000' },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });

  test('does not allow unknown browser origin', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies', {
        headers: { Origin: 'https://evil.example.com' },
      }),
    );
    // Request still handled; CORS middleware omits allow-origin for disallowed origins.
    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe(
      'https://evil.example.com',
    );
  });
});

describe('topology ID path traversal protection', () => {
  test('rejects traversal in GET /api/topologies/:id', async () => {
    const response = await server.fetch(
      new Request('http://localhost/api/topologies/..%2F..%2Fetc%2Fpasswd'),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid ID format');
    expect(body.code).toBe('INVALID_ID');
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