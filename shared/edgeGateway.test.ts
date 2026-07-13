import { describe, expect, test } from 'bun:test';
import { getGatewayValidationError, normalizeGateway } from './edgeGateway.ts';

describe('normalizeGateway', () => {
  test('trims and returns undefined for empty values', () => {
    expect(normalizeGateway('  10.0.0.1  ')).toBe('10.0.0.1');
    expect(normalizeGateway('   ')).toBeUndefined();
    expect(normalizeGateway(undefined)).toBeUndefined();
  });
});

describe('getGatewayValidationError', () => {
  test('accepts common gateway and interface values', () => {
    expect(getGatewayValidationError('10.0.1.1')).toBeNull();
    expect(getGatewayValidationError('eth0')).toBeNull();
    expect(getGatewayValidationError('fe80::1')).toBeNull();
  });

  test('rejects invalid characters', () => {
    expect(getGatewayValidationError('bad gateway')).not.toBeNull();
  });
});