import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_PROTECTED_TOPOLOGY_IDS,
  getProtectedTopologyIdsFromEnv,
  isProtectedTopologyId,
  parseProtectedTopologyIds,
} from './protectedTopologies.ts';

describe('protectedTopologies', () => {
  test('defaults to topology-1 when env is unset or empty', () => {
    expect(parseProtectedTopologyIds(undefined)).toEqual([...DEFAULT_PROTECTED_TOPOLOGY_IDS]);
    expect(parseProtectedTopologyIds('')).toEqual([...DEFAULT_PROTECTED_TOPOLOGY_IDS]);
    expect(parseProtectedTopologyIds('  ')).toEqual([...DEFAULT_PROTECTED_TOPOLOGY_IDS]);
  });

  test('parses custom comma-separated lists', () => {
    expect(parseProtectedTopologyIds('seed-a, seed-b')).toEqual(['seed-a', 'seed-b']);
  });

  test('isProtectedTopologyId checks membership', () => {
    expect(isProtectedTopologyId('topology-1')).toBe(true);
    expect(isProtectedTopologyId('topology-other')).toBe(false);
    expect(isProtectedTopologyId('custom', ['custom'])).toBe(true);
  });

  test('getProtectedTopologyIdsFromEnv reads PROTECTED_TOPOLOGY_IDS', () => {
    expect(getProtectedTopologyIdsFromEnv({ PROTECTED_TOPOLOGY_IDS: undefined })).toEqual([
      'topology-1',
    ]);
    expect(getProtectedTopologyIdsFromEnv({ PROTECTED_TOPOLOGY_IDS: 'a,b' })).toEqual(['a', 'b']);
  });
});
