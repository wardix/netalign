export interface NodePosition {
  x: number;
  y: number;
}

export function parseNodePosition(value: unknown): NodePosition | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { x?: unknown; y?: unknown };
  if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') return null;
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return null;
  return { x: candidate.x, y: candidate.y };
}

export function getPositionValidationError(value: unknown): string | null {
  const position = parseNodePosition(value);
  if (!position) return 'Position must include finite numeric x and y values';
  return null;
}