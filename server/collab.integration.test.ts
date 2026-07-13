import { afterAll, describe, expect, test } from 'bun:test';
import { COLLAB_CLIENT_HEADER, parseServerMessage } from '../shared/collabProtocol.ts';
import { collabHub } from './collabHub.ts';
import { collabWebsocket, tryUpgradeCollabSocket } from './collabWs.ts';

/**
 * End-to-end-ish: real Bun.serve WebSocket + REST mutation broadcast.
 * Uses an ephemeral port so it does not clash with a local dev server.
 */
describe('collab WebSocket integration', () => {
  const server = Bun.serve({
    port: 0,
    fetch(req, srv) {
      const url = new URL(req.url);
      if (url.pathname === '/api/ws') {
        return tryUpgradeCollabSocket(req, srv) ?? undefined;
      }
      if (url.pathname === '/api/topologies/topo-demo/nodes' && req.method === 'POST') {
        // Minimal stand-in: publish like the real API after a "successful" write.
        const origin = req.headers.get(COLLAB_CLIENT_HEADER) ?? undefined;
        const body = { id: 'n-new', type: 'subnet', data: { label: 'New' } };
        collabHub.broadcast(
          'topo-demo',
          {
            type: 'event',
            originClientId: origin,
            event: {
              kind: 'node.upserted',
              topologyId: 'topo-demo',
              node: body as { id: string; type: 'subnet'; data: { label: string } },
            },
          },
          origin ? { excludeClientId: origin } : undefined,
        );
        return Response.json(body, { status: 201 });
      }
      return new Response('not found', { status: 404 });
    },
    websocket: collabWebsocket,
  });

  afterAll(() => {
    collabHub.clear();
    server.stop(true);
  });

  test('second client receives node.upserted from first client REST-shaped publish', async () => {
    const port = server.port;
    const messages: unknown[] = [];

    const wsB = new WebSocket(
      `ws://127.0.0.1:${port}/api/ws?topologyId=topo-demo&clientId=client-b`,
    );

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ws open timeout')), 5000);
      wsB.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      wsB.onerror = () => {
        clearTimeout(timer);
        reject(new Error('ws error'));
      };
    });

    wsB.onmessage = event => {
      if (typeof event.data === 'string') {
        messages.push(parseServerMessage(event.data));
      }
    };

    // Wait until B has joined (hello with peerCount >= 1).
    await Bun.sleep(50);

    const res = await fetch(`http://127.0.0.1:${port}/api/topologies/topo-demo/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [COLLAB_CLIENT_HEADER]: 'client-a',
      },
      body: JSON.stringify({ nodeId: 'n-new', type: 'subnet' }),
    });
    expect(res.status).toBe(201);

    await Bun.sleep(80);

    const events = messages.filter(
      (m): m is { type: 'event'; event: { kind: string } } =>
        !!m && typeof m === 'object' && (m as { type?: string }).type === 'event',
    );
    expect(events.some(e => e.event.kind === 'node.upserted')).toBe(true);

    wsB.close();
  });
});
