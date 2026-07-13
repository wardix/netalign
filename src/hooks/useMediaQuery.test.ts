import { describe, expect, test } from 'bun:test';
import { NARROW_LAYOUT_QUERY } from './useMediaQuery.ts';

describe('useMediaQuery constants', () => {
  test('narrow layout query targets ~768px', () => {
    expect(NARROW_LAYOUT_QUERY).toContain('768px');
    expect(NARROW_LAYOUT_QUERY).toContain('max-width');
  });
});
