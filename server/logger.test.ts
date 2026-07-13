import { describe, expect, test } from 'bun:test';
import { createRequestId, sanitizeLogFields } from './logger.ts';

describe('sanitizeLogFields', () => {
  test('redacts sensitive keys', () => {
    const result = sanitizeLogFields({
      password: 'hunter2',
      apiKey: 'abc',
      route: '/api/topologies',
    });
    expect(result.password).toBe('[redacted]');
    expect(result.apiKey).toBe('[redacted]');
    expect(result.route).toBe('/api/topologies');
  });

  test('serializes Error values to message', () => {
    const result = sanitizeLogFields({ err: new Error('boom') });
    expect(result.err).toBe('boom');
    expect(result.errName).toBe('Error');
  });
});

describe('createRequestId', () => {
  test('returns unique-looking ids', () => {
    const a = createRequestId();
    const b = createRequestId();
    expect(a.startsWith('req_')).toBe(true);
    expect(a).not.toBe(b);
  });
});
