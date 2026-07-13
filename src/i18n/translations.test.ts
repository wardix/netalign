import { describe, expect, test } from 'bun:test';
import { ApiError } from '../api/client.ts';
import { formatMessage, translateApiError, translations } from './translations.ts';

describe('formatMessage', () => {
  test('interpolates named params', () => {
    expect(formatMessage('Hello {name}', { name: 'NetAlign' })).toBe('Hello NetAlign');
    expect(formatMessage('Node "{id}" deleted', { id: 'r1' })).toBe('Node "r1" deleted');
  });

  test('returns template when no params', () => {
    expect(formatMessage('plain')).toBe('plain');
  });
});

describe('translateApiError', () => {
  const t = (key: keyof typeof translations.en) => translations.en[key];

  test('maps known API error strings', () => {
    expect(
      translateApiError(
        'Invalid connection: routers and instances can only connect directly to subnets.',
        t,
      ),
    ).toBe(translations.en['error.edge.invalidConnection']);

    expect(translateApiError('This topology is protected and cannot be deleted', t)).toBe(
      translations.en['topologies.protectedDeleteError'],
    );
  });

  test('prefers stable error codes on ApiError', () => {
    const err = new ApiError('whatever English text', 403, 'TOPOLOGY_PROTECTED');
    expect(translateApiError(err, t)).toBe(translations.en['topologies.protectedDeleteError']);
  });

  test('returns original message when unmapped', () => {
    expect(translateApiError('Some unknown server error', t)).toBe('Some unknown server error');
  });
});

describe('translations parity', () => {
  test('id and en expose the same keys', () => {
    const idKeys = Object.keys(translations.id).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(idKeys).toEqual(enKeys);
  });
});
