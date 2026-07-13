import { describe, expect, test } from 'bun:test';
import { getPositionValidationError, parseNodePosition } from './nodePosition.ts';

describe('parseNodePosition', () => {
  test('accepts finite numeric coordinates', () => {
    expect(parseNodePosition({ x: 120, y: 300 })).toEqual({ x: 120, y: 300 });
  });

  test('rejects invalid coordinates', () => {
    expect(parseNodePosition({ x: '120', y: 300 })).toBeNull();
    expect(parseNodePosition({ x: Number.NaN, y: 1 })).toBeNull();
    expect(parseNodePosition(null)).toBeNull();
  });
});

describe('getPositionValidationError', () => {
  test('returns null for valid positions', () => {
    expect(getPositionValidationError({ x: 0, y: 0 })).toBeNull();
  });

  test('returns error for invalid positions', () => {
    expect(getPositionValidationError({ x: 1 })).not.toBeNull();
  });
});