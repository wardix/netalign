import { describe, expect, test } from 'bun:test';
import { COLLAB_WS_PATH } from '../../shared/collabProtocol.ts';
import { buildCollabWsUrl } from './wsUrl.ts';

describe('buildCollabWsUrl', () => {
  test('includes path, topologyId, and clientId', () => {
    const url = buildCollabWsUrl('topology-1', 'client-abc');
    expect(url).toContain(COLLAB_WS_PATH);
    expect(url).toContain('topologyId=topology-1');
    expect(url).toContain('clientId=client-abc');
    expect(url.startsWith('ws://') || url.startsWith('wss://')).toBe(true);
  });
});
