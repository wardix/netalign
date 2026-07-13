/**
 * Stable API error codes for NetAlign REST responses.
 * Clients should prefer `code` over matching the human-readable `error` string.
 */
export const API_ERROR_CODES = [
  'INVALID_ID',
  'TOPOLOGY_NOT_FOUND',
  'TOPOLOGY_PROTECTED',
  'TOPOLOGY_NAME_REQUIRED',
  'TOPOLOGY_CREATE_FAILED',
  'TOPOLOGY_UPDATE_FAILED',
  'TOPOLOGY_DELETE_FAILED',
  'TOPOLOGY_READ_FAILED',
  'TOPOLOGY_LIST_FAILED',
  'TOPOLOGY_ID_ALLOCATION_FAILED',
  'NODE_NOT_FOUND',
  'NODE_ID_REQUIRED',
  'NODE_ID_EXISTS',
  'NODE_LABEL_REQUIRED',
  'NODE_UPDATE_FIELDS_REQUIRED',
  'NODE_ADD_FAILED',
  'NODE_UPDATE_FAILED',
  'NODE_DELETE_FAILED',
  'NODE_POSITION_INVALID',
  'NODE_POSITIONS_REQUIRED',
  'NODE_POSITIONS_INVALID',
  'NODE_POSITIONS_UPDATE_FAILED',
  'EDGE_NOT_FOUND',
  'EDGE_ENDPOINTS_REQUIRED',
  'EDGE_SAME_NODE',
  'EDGE_NODES_MISSING',
  'EDGE_INVALID_CONNECTION',
  'EDGE_DUPLICATE',
  'EDGE_GATEWAY_INVALID',
  'EDGE_ADD_FAILED',
  'EDGE_UPDATE_FAILED',
  'EDGE_DELETE_FAILED',
  'IMPORT_INVALID',
  'IMPORT_FAILED',
  'AUTH_REQUIRED',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_USERNAME_TAKEN',
  'AUTH_USERNAME_INVALID',
  'AUTH_PASSWORD_INVALID',
  'AUTH_FORBIDDEN',
  'AUTH_REGISTER_FAILED',
  'AUTH_LOGIN_FAILED',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
}

/** Canonical English messages for each code (debugging + backward-compatible mapping). */
export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_ID: 'Invalid ID format',
  TOPOLOGY_NOT_FOUND: 'Topology not found',
  TOPOLOGY_PROTECTED: 'This topology is protected and cannot be deleted',
  TOPOLOGY_NAME_REQUIRED: 'Name is required',
  TOPOLOGY_CREATE_FAILED: 'Failed to create topology',
  TOPOLOGY_UPDATE_FAILED: 'Failed to update topology',
  TOPOLOGY_DELETE_FAILED: 'Failed to delete topology file',
  TOPOLOGY_READ_FAILED: 'Failed to read topology file',
  TOPOLOGY_LIST_FAILED: 'Failed to read topologies',
  TOPOLOGY_ID_ALLOCATION_FAILED: 'Failed to allocate topology id',
  NODE_NOT_FOUND: 'Node not found',
  NODE_ID_REQUIRED: 'Missing nodeId or type',
  NODE_ID_EXISTS: 'Node ID already exists',
  NODE_LABEL_REQUIRED: 'Label is required',
  NODE_UPDATE_FIELDS_REQUIRED: 'Label or position is required',
  NODE_ADD_FAILED: 'Failed to add node',
  NODE_UPDATE_FAILED: 'Failed to update node',
  NODE_DELETE_FAILED: 'Failed to delete node',
  NODE_POSITION_INVALID: 'Position must include finite numeric x and y values',
  NODE_POSITIONS_REQUIRED: 'Body must include an updates array',
  NODE_POSITIONS_INVALID: 'Each update must be an object with nodeId and position',
  NODE_POSITIONS_UPDATE_FAILED: 'Failed to update node positions',
  EDGE_NOT_FOUND: 'Edge not found',
  EDGE_ENDPOINTS_REQUIRED: 'Missing source or target',
  EDGE_SAME_NODE: 'Source and target must be different nodes',
  EDGE_NODES_MISSING: 'Source or Target node does not exist',
  EDGE_INVALID_CONNECTION:
    'Invalid connection: routers and instances can only connect directly to subnets.',
  EDGE_DUPLICATE: 'Edge already exists between these nodes',
  EDGE_GATEWAY_INVALID: 'Gateway contains invalid characters',
  EDGE_ADD_FAILED: 'Failed to add edge',
  EDGE_UPDATE_FAILED: 'Failed to update edge',
  EDGE_DELETE_FAILED: 'Failed to delete edge',
  IMPORT_INVALID: 'Import document must be a topology object with name, nodes, and edges',
  IMPORT_FAILED: 'Failed to import topology',
  AUTH_REQUIRED: 'Authentication required',
  AUTH_INVALID_CREDENTIALS: 'Invalid username or password',
  AUTH_USERNAME_TAKEN: 'Username is already taken',
  AUTH_USERNAME_INVALID:
    'Username must be 3–32 characters and use only letters, numbers, underscores, or dashes',
  AUTH_PASSWORD_INVALID: 'Password must be at least 8 characters',
  AUTH_FORBIDDEN: 'You do not have access to this topology',
  AUTH_REGISTER_FAILED: 'Failed to register user',
  AUTH_LOGIN_FAILED: 'Failed to log in',
  INTERNAL_ERROR: 'Internal server error',
};

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value);
}

export function buildApiError(
  code: ApiErrorCode,
  messageOverride?: string,
): ApiErrorBody {
  return {
    code,
    error: messageOverride ?? API_ERROR_MESSAGES[code],
  };
}

/** Map free-form / shared validation messages onto stable codes when possible. */
export function codeFromErrorMessage(message: string): ApiErrorCode | null {
  for (const code of API_ERROR_CODES) {
    if (API_ERROR_MESSAGES[code] === message) return code;
  }
  if (message === 'Gateway label must be 64 characters or fewer') {
    return 'EDGE_GATEWAY_INVALID';
  }
  if (message.startsWith('Node not found:')) {
    return 'NODE_NOT_FOUND';
  }
  if (message.startsWith('Import ')) {
    return 'IMPORT_INVALID';
  }
  if (message === 'Topology name is required') {
    return 'IMPORT_INVALID';
  }
  if (message === 'Invalid ID format') {
    return 'INVALID_ID';
  }
  return null;
}
