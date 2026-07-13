const GATEWAY_PATTERN = /^[a-zA-Z0-9.\-/:_%]+$/;
const MAX_GATEWAY_LENGTH = 64;

export function normalizeGateway(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function getGatewayValidationError(value: string): string | null {
  if (!value) return null;
  if (value.length > MAX_GATEWAY_LENGTH) {
    return 'Gateway label must be 64 characters or fewer';
  }
  if (!GATEWAY_PATTERN.test(value)) {
    return 'Gateway contains invalid characters';
  }
  return null;
}