import { afterEach, describe, expect, test } from 'bun:test';
import { isAuthEnabled, resolveAuthMode, setAuthModeOverride } from './authConfig.ts';

describe('authConfig', () => {
  afterEach(() => {
    setAuthModeOverride(null);
  });

  test('resolveAuthMode respects explicit on/off', () => {
    expect(resolveAuthMode('on', 'development')).toBe('on');
    expect(resolveAuthMode('off', 'production')).toBe('off');
    expect(resolveAuthMode('required', undefined)).toBe('on');
  });

  test('defaults to on in production and off otherwise', () => {
    expect(resolveAuthMode(undefined, 'production')).toBe('on');
    expect(resolveAuthMode(undefined, 'development')).toBe('off');
    expect(resolveAuthMode(undefined, undefined)).toBe('off');
  });

  test('isAuthEnabled reads env bag', () => {
    expect(isAuthEnabled({ NETALIGN_AUTH_MODE: 'on', NODE_ENV: 'development' })).toBe(true);
    expect(isAuthEnabled({ NETALIGN_AUTH_MODE: 'off', NODE_ENV: 'production' })).toBe(false);
  });

  test('setAuthModeOverride wins over env', () => {
    setAuthModeOverride('on');
    expect(resolveAuthMode('off', 'development')).toBe('on');
    setAuthModeOverride('off');
    expect(resolveAuthMode(undefined, 'production')).toBe('off');
  });
});
