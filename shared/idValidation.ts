export const RESOURCE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const INVALID_ID_ERROR = 'Invalid ID format';

export function isValidResourceId(id: string): boolean {
  return RESOURCE_ID_PATTERN.test(id);
}

export function getInvalidIdError(id: string): string | null {
  if (!isValidResourceId(id)) {
    return INVALID_ID_ERROR;
  }
  return null;
}