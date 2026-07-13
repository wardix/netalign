import { describe, expect, test } from 'bun:test';
import {
  parseClientMessage,
  parseServerMessage,
  serializeMessage,
} from './collabProtocol.ts';

describe('collabProtocol', () => {
  test('parseClientMessage accepts subscribe and ping', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'ping' }))).toEqual({ type: 'ping' });
    expect(
      parseClientMessage(
        JSON.stringify({ type: 'subscribe', topologyId: 't1', clientId: 'c1' }),
      ),
    ).toEqual({ type: 'subscribe', topologyId: 't1', clientId: 'c1' });
  });

  test('parseClientMessage rejects invalid payloads', () => {
    expect(parseClientMessage('not-json')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'subscribe' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'unknown' }))).toBeNull();
  });

  test('round-trips server event messages', () => {
    const msg = {
      type: 'event' as const,
      originClientId: 'c1',
      event: {
        kind: 'node.removed' as const,
        topologyId: 't1',
        nodeId: 'n1',
      },
    };
    const raw = serializeMessage(msg);
    expect(parseServerMessage(raw)).toEqual(msg);
  });
});
