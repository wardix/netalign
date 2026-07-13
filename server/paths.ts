import { resolve } from 'node:path';
import { getInvalidIdError } from '../shared/idValidation.ts';

const DATA_DIR = resolve(import.meta.dir, 'data');

export function resolveTopologyFilePath(
  id: string,
): { ok: true; filePath: string } | { ok: false; error: string } {
  const validationError = getInvalidIdError(id);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const filePath = resolve(DATA_DIR, `${id}.json`);
  if (!filePath.startsWith(`${DATA_DIR}/`)) {
    return { ok: false, error: validationError };
  }

  return { ok: true, filePath };
}

export function validateRouteId(
  id: string,
): { ok: true } | { ok: false; error: string } {
  const validationError = getInvalidIdError(id);
  if (validationError) {
    return { ok: false, error: validationError };
  }
  return { ok: true };
}