import { describe, expect, test } from 'bun:test';
import { getInvalidIdError, isValidResourceId } from './idValidation.ts';

describe('isValidResourceId', () => {
  test('accepts alphanumeric ids with dashes and underscores', () => {
    expect(isValidResourceId('topology-1')).toBe(true);
    expect(isValidResourceId('e-router-1-subnet-1')).toBe(true);
    expect(isValidResourceId('node_2')).toBe(true);
  });

  test('rejects path traversal and illegal characters', () => {
    expect(isValidResourceId('../../etc/passwd')).toBe(false);
    expect(isValidResourceId('..')).toBe(false);
    expect(isValidResourceId('topology/1')).toBe(false);
    expect(isValidResourceId('topology 1')).toBe(false);
    expect(isValidResourceId('')).toBe(false);
    expect(isValidResourceId('id.json')).toBe(false);
  });
});

describe('getInvalidIdError', () => {
  test('returns error message for invalid ids', () => {
    expect(getInvalidIdError('../secret')).toBe('Invalid ID format');
  });

  test('returns null for valid ids', () => {
    expect(getInvalidIdError('topology-1')).toBeNull();
  });
});