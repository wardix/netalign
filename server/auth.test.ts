import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { SESSION_COOKIE_NAME, setAuthModeOverride } from '../shared/authConfig.ts';
import server from './index.ts';

function cookieFrom(response: Response): string | null {
  const anyHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === 'function') {
    const parts = anyHeaders.getSetCookie();
    const hit = parts.find(p => p.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (hit) return hit.split(';')[0] ?? null;
  }
  const raw = response.headers.get('set-cookie');
  if (!raw) return null;
  const match = raw.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? `${SESSION_COOKIE_NAME}=${match[1]}` : null;
}

async function register(username: string, password: string) {
  const res = await server.fetch(
    new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  );
  const cookie = cookieFrom(res);
  const body = await res.json();
  return { res, cookie, body };
}

describe('authentication and ownership', () => {
  beforeAll(() => {
    setAuthModeOverride('on');
  });

  afterAll(() => {
    setAuthModeOverride(null);
  });

  test('status reports auth enabled', async () => {
    const res = await server.fetch(new Request('http://localhost/api/auth/status'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.authenticated).toBe(false);
  });

  test('unauthenticated list is denied', async () => {
    const res = await server.fetch(new Request('http://localhost/api/topologies'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  test('register + ownership isolation', async () => {
    const suffix = Date.now().toString(36);
    const a = await register(`alice_${suffix}`, 'password1');
    expect(a.res.status).toBe(201);
    expect(a.cookie).toBeTruthy();
    expect(a.body.user.username).toBe(`alice_${suffix}`);

    const createA = await server.fetch(
      new Request('http://localhost/api/topologies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: a.cookie!,
        },
        body: JSON.stringify({ name: 'Alice Net' }),
      }),
    );
    expect(createA.status).toBe(201);
    const topoA = await createA.json();
    expect(topoA.name).toBe('Alice Net');

    const listA = await server.fetch(
      new Request('http://localhost/api/topologies', {
        headers: { Cookie: a.cookie! },
      }),
    );
    expect(listA.status).toBe(200);
    const itemsA = await listA.json();
    expect(itemsA.some((t: { id: string }) => t.id === topoA.id)).toBe(true);

    const b = await register(`bob_${suffix}`, 'password2');
    expect(b.res.status).toBe(201);

    const listB = await server.fetch(
      new Request('http://localhost/api/topologies', {
        headers: { Cookie: b.cookie! },
      }),
    );
    const itemsB = await listB.json();
    expect(itemsB.some((t: { id: string }) => t.id === topoA.id)).toBe(false);

    const getForbidden = await server.fetch(
      new Request(`http://localhost/api/topologies/${topoA.id}`, {
        headers: { Cookie: b.cookie! },
      }),
    );
    expect(getForbidden.status).toBe(403);
    const forbiddenBody = await getForbidden.json();
    expect(forbiddenBody.code).toBe('AUTH_FORBIDDEN');

    const mutateForbidden = await server.fetch(
      new Request(`http://localhost/api/topologies/${topoA.id}/nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: b.cookie!,
        },
        body: JSON.stringify({ nodeId: 'n1', type: 'subnet', label: 'S' }),
      }),
    );
    expect(mutateForbidden.status).toBe(403);
  });

  test('invalid credentials return 401', async () => {
    const res = await server.fetch(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'no-such-user', password: 'wrong-password' }),
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  test('duplicate username is rejected', async () => {
    const username = `dup_${Date.now().toString(36)}`;
    const first = await register(username, 'password1');
    expect(first.res.status).toBe(201);
    const res = await server.fetch(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'password9' }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('AUTH_USERNAME_TAKEN');
  });

  test('Bearer token works as alternative to cookie', async () => {
    const username = `bearer_${Date.now().toString(36)}`;
    const reg = await register(username, 'password1');
    expect(reg.res.status).toBe(201);
    const cookie = reg.cookie;
    expect(cookie).toBeTruthy();
    const token = cookie!.split('=')[1];

    const res = await server.fetch(
      new Request('http://localhost/api/topologies', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
  });
});
