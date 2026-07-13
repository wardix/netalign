import { describe, expect, test, beforeEach } from 'bun:test';
import { CollabHub, type CollabSocket } from './collabHub.ts';

function mockSocket(clientId: string): CollabSocket & { sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    data: { clientId, topologyId: null },
    send(data: string) {
      sent.push(data);
    },
  };
}

describe('CollabHub', () => {
  let hub: CollabHub;

  beforeEach(() => {
    hub = new CollabHub();
  });

  test('join tracks peer count and leave removes room when empty', () => {
    const a = mockSocket('a');
    const b = mockSocket('b');
    hub.join(a, 'topo-1');
    hub.join(b, 'topo-1');
    expect(hub.peerCount('topo-1')).toBe(2);
    hub.leave(a);
    expect(hub.peerCount('topo-1')).toBe(1);
    hub.leave(b);
    expect(hub.peerCount('topo-1')).toBe(0);
    expect(hub.roomIds()).toEqual([]);
  });

  test('broadcast delivers to peers and can exclude origin', () => {
    const a = mockSocket('a');
    const b = mockSocket('b');
    hub.join(a, 'topo-1');
    hub.join(b, 'topo-1');

    const n = hub.broadcast(
      'topo-1',
      { type: 'resync', topologyId: 'topo-1', reason: 'test' },
      { excludeClientId: 'a' },
    );
    expect(n).toBe(1);
    expect(a.sent).toHaveLength(0);
    expect(b.sent).toHaveLength(1);
    expect(JSON.parse(b.sent[0]!).type).toBe('resync');
  });

  test('re-join moves socket to a new room', () => {
    const a = mockSocket('a');
    hub.join(a, 'topo-1');
    hub.join(a, 'topo-2');
    expect(hub.peerCount('topo-1')).toBe(0);
    expect(hub.peerCount('topo-2')).toBe(1);
    expect(a.data.topologyId).toBe('topo-2');
  });

  test('broadcastPresence shares occupancy', () => {
    const a = mockSocket('a');
    const b = mockSocket('b');
    hub.join(a, 't');
    hub.join(b, 't');
    hub.broadcastPresence('t');
    expect(a.sent.length).toBe(1);
    const msg = JSON.parse(a.sent[0]!);
    expect(msg).toMatchObject({ type: 'presence', peerCount: 2, topologyId: 't' });
  });
});
