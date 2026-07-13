import { describe, expect, test } from 'bun:test';
import { createCorsOriginResolver, parseCorsOriginsList } from './corsConfig.ts';

describe('parseCorsOriginsList', () => {
  test('splits and trims origins', () => {
    expect(parseCorsOriginsList(' https://a.com ,https://b.com ')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  test('returns empty for unset', () => {
    expect(parseCorsOriginsList(undefined)).toEqual([]);
    expect(parseCorsOriginsList('')).toEqual([]);
  });
});

describe('createCorsOriginResolver', () => {
  test('allows configured origins and rejects others', () => {
    const resolve = createCorsOriginResolver(
      'https://app.example.com,https://admin.example.com',
      'production',
    );
    expect(resolve('https://app.example.com')).toBe('https://app.example.com');
    expect(resolve('https://evil.example.com')).toBeNull();
  });

  test('production without CORS_ORIGINS denies browser origins', () => {
    const resolve = createCorsOriginResolver(undefined, 'production');
    expect(resolve('https://app.example.com')).toBeNull();
    expect(resolve(undefined)).toBeNull();
  });

  test('development defaults allow local Vite origins', () => {
    const resolve = createCorsOriginResolver(undefined, 'development');
    expect(resolve('http://localhost:3000')).toBe('http://localhost:3000');
    expect(resolve('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
    expect(resolve('https://evil.example.com')).toBeNull();
  });

  test('explicit * allows any origin', () => {
    const resolve = createCorsOriginResolver('*', 'production');
    expect(resolve('https://anywhere.example')).toBe('https://anywhere.example');
  });
});
