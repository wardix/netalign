import { describe, expect, test } from 'bun:test';
import { resolveApiBase } from './api.ts';

describe('resolveApiBase', () => {
  test('uses VITE_API_BASE when provided (trimmed, no trailing slash)', () => {
    expect(resolveApiBase('https://api.example.com/', 'app.example.com')).toBe(
      'https://api.example.com',
    );
  });

  test('allows empty VITE_API_BASE for same-origin / proxy', () => {
    expect(resolveApiBase('', 'app.example.com')).toBe('');
  });

  test('defaults to empty proxy path on localhost without env', () => {
    expect(resolveApiBase(undefined, 'localhost')).toBe('');
    expect(resolveApiBase(undefined, '127.0.0.1')).toBe('');
  });

  test('does not hardcode a production API domain', () => {
    expect(resolveApiBase(undefined, 'app.netalign.com')).toBe('');
    expect(resolveApiBase(undefined, 'app.netalign.com')).not.toContain('api.netalign.com');
  });
});
