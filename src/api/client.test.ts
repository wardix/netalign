import { afterEach, describe, expect, mock, test } from 'bun:test';
import { ApiError, apiGet, apiPost, getApiErrorMessage } from './client.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('getApiErrorMessage', () => {
  test('returns ApiError message', () => {
    expect(getApiErrorMessage(new ApiError('Node not found', 404), 'fallback')).toBe(
      'Node not found',
    );
  });

  test('returns Error message', () => {
    expect(getApiErrorMessage(new Error('network down'), 'fallback')).toBe('network down');
  });

  test('returns fallback for unknown values', () => {
    expect(getApiErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getApiErrorMessage({}, 'fallback')).toBe('fallback');
  });
});

describe('apiGet / apiPost', () => {
  test('apiGet returns JSON on success', async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ id: 'topology-1', name: 'Default' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const data = await apiGet<{ id: string; name: string }>('/api/topologies/topology-1');
    expect(data.id).toBe('topology-1');
    expect(data.name).toBe('Default');
  });

  test('apiGet throws ApiError with server error body', async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ error: 'Topology not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    try {
      await apiGet('/api/topologies/missing');
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(404);
      expect((err as ApiError).message).toBe('Topology not found');
    }
  });

  test('apiPost sends JSON body', async () => {
    let requestBody: string | undefined;
    globalThis.fetch = mock(async (_url, init) => {
      requestBody = typeof init?.body === 'string' ? init.body : undefined;
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    await apiPost('/api/topologies', { name: 'New' });
    expect(requestBody).toBe(JSON.stringify({ name: 'New' }));
  });
});
