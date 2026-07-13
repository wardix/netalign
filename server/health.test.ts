import { describe, expect, test } from 'bun:test';
import server from './index.ts';
import { getLiveness, getReadiness } from './health.ts';

describe('health helpers', () => {
  test('getLiveness reports ok', () => {
    const live = getLiveness();
    expect(live.status).toBe('ok');
    expect(live.service).toBe('netalign-api');
    expect(live.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  test('getReadiness reports database ok under test DB', () => {
    const ready = getReadiness();
    expect(ready.status).toBe('ready');
    expect(ready.database).toBe('ok');
  });
});

describe('health HTTP routes', () => {
  test('GET /api/health returns 200', async () => {
    const response = await server.fetch(new Request('http://localhost/api/health'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('netalign-api');
  });

  test('GET /api/ready returns 200 when SQLite is available', async () => {
    const response = await server.fetch(new Request('http://localhost/api/ready'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ready');
    expect(body.database).toBe('ok');
  });
});
