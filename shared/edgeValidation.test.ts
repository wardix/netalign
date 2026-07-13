import { describe, expect, test } from 'bun:test';
import {
  EDGE_VALIDATION_ERROR,
  isValidEdgeConnection,
  validateEdgeBetweenNodes,
} from './edgeValidation.ts';

describe('isValidEdgeConnection', () => {
  test('allows router to subnet', () => {
    expect(isValidEdgeConnection('router', 'subnet')).toBe(true);
    expect(isValidEdgeConnection('subnet', 'router')).toBe(true);
  });

  test('allows instance to subnet', () => {
    expect(isValidEdgeConnection('instance', 'subnet')).toBe(true);
    expect(isValidEdgeConnection('subnet', 'instance')).toBe(true);
    expect(isValidEdgeConnection('vm', 'subnet')).toBe(true);
  });

  test('rejects subnet to subnet', () => {
    expect(isValidEdgeConnection('subnet', 'subnet')).toBe(false);
  });

  test('rejects router to router', () => {
    expect(isValidEdgeConnection('router', 'router')).toBe(false);
  });

  test('rejects instance to instance', () => {
    expect(isValidEdgeConnection('instance', 'instance')).toBe(false);
  });

  test('rejects router to instance', () => {
    expect(isValidEdgeConnection('router', 'instance')).toBe(false);
    expect(isValidEdgeConnection('instance', 'router')).toBe(false);
  });

  test('rejects unknown node types', () => {
    expect(isValidEdgeConnection('firewall', 'subnet')).toBe(false);
  });
});

describe('validateEdgeBetweenNodes', () => {
  test('returns null for valid connections', () => {
    expect(validateEdgeBetweenNodes({ type: 'router' }, { type: 'subnet' })).toBeNull();
  });

  test('returns error message for invalid connections', () => {
    expect(validateEdgeBetweenNodes({ type: 'router' }, { type: 'router' })).toBe(
      EDGE_VALIDATION_ERROR,
    );
  });
});