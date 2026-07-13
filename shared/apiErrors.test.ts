import { describe, expect, test } from 'bun:test';
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  buildApiError,
  codeFromErrorMessage,
  isApiErrorCode,
} from './apiErrors.ts';

describe('apiErrors', () => {
  test('every code has a non-empty message', () => {
    for (const code of API_ERROR_CODES) {
      expect(API_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  test('buildApiError includes code and default message', () => {
    expect(buildApiError('NODE_NOT_FOUND')).toEqual({
      code: 'NODE_NOT_FOUND',
      error: 'Node not found',
    });
    expect(buildApiError('NODE_NOT_FOUND', 'Custom')).toEqual({
      code: 'NODE_NOT_FOUND',
      error: 'Custom',
    });
  });

  test('isApiErrorCode validates membership', () => {
    expect(isApiErrorCode('EDGE_DUPLICATE')).toBe(true);
    expect(isApiErrorCode('NOT_A_CODE')).toBe(false);
  });

  test('codeFromErrorMessage maps known strings', () => {
    expect(codeFromErrorMessage('Topology not found')).toBe('TOPOLOGY_NOT_FOUND');
    expect(
      codeFromErrorMessage(
        'Invalid connection: routers and instances can only connect directly to subnets.',
      ),
    ).toBe('EDGE_INVALID_CONNECTION');
    expect(codeFromErrorMessage('Node not found: missing')).toBe('NODE_NOT_FOUND');
    expect(codeFromErrorMessage('totally unknown')).toBeNull();
  });
});
