// server/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { buildEdgeId } from '../shared/edgeIds.ts';
import { getGatewayValidationError, normalizeGateway } from '../shared/edgeGateway.ts';
import { getPositionValidationError, parseNodePosition } from '../shared/nodePosition.ts';
import { validateEdgeBetweenNodes } from '../shared/edgeValidation.ts';
import type {
  BatchNodePositionsBody,
  CreateEdgeBody,
  CreateNodeBody,
  Topology,
  TopologyEdge,
  TopologyNode,
  TopologySummary,
  UpdateEdgeBody,
  UpdateNodeBody,
} from '../shared/types.ts';
import { parseTopologyImport } from '../shared/topologyImport.ts';
import {
  getProtectedTopologyIdsFromEnv,
  isProtectedTopologyId,
  PROTECTED_TOPOLOGY_DELETE_ERROR,
} from '../shared/protectedTopologies.ts';
import {
  buildApiError,
  codeFromErrorMessage,
  type ApiErrorCode,
} from '../shared/apiErrors.ts';
import { COLLAB_CLIENT_HEADER } from '../shared/collabProtocol.ts';
import { SESSION_COOKIE_NAME } from '../shared/authConfig.ts';
import { openApiDocument } from '../shared/openapi.ts';
import {
  attachAuthContext,
  currentUserId,
  extractSessionToken,
  requireAuth,
} from './authMiddleware.ts';
import {
  createSession,
  deleteSession,
  getPasswordValidationError,
  getUsernameValidationError,
  registerUser,
  verifyUserCredentials,
} from './authStore.ts';
import {
  collabWebsocket,
  isCollabWsPath,
  publishTopologyEvent,
  tryUpgradeCollabSocket,
} from './collabWs.ts';
import { createCorsOriginResolver } from './corsConfig.ts';
import { getLiveness, getReadiness } from './health.ts';
import {
  createRequestId,
  isRequestLoggingEnabled,
  logger,
} from './logger.ts';
import { isOpenApiUiEnabled, renderSwaggerUiHtml } from './openapiUi.ts';
import { validateRouteId } from './paths.ts';
import * as topologyStore from './topologyStore.ts';
import type { Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';

const app = new Hono();

const protectedTopologyIds = getProtectedTopologyIdsFromEnv({
  PROTECTED_TOPOLOGY_IDS: Bun.env.PROTECTED_TOPOLOGY_IDS ?? process.env.PROTECTED_TOPOLOGY_IDS,
});

const resolveCorsOrigin = createCorsOriginResolver(
  Bun.env.CORS_ORIGINS ?? process.env.CORS_ORIGINS,
  Bun.env.NODE_ENV ?? process.env.NODE_ENV,
);

app.use(
  '*',
  cors({
    origin: origin => resolveCorsOrigin(origin) ?? undefined,
    allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Collab-Client-Id'],
    credentials: true,
    maxAge: 86400,
  }),
);

app.use('*', attachAuthContext);

app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') || createRequestId();
  c.header('x-request-id', requestId);
  const started = performance.now();
  await next();
  if (isRequestLoggingEnabled()) {
    const path = new URL(c.req.url).pathname;
    // Skip noisy probes unless debug-level access logging is desired.
    if (path === '/api/health' || path === '/api/ready') return;
    logger.info('http_request', {
      requestId,
      method: c.req.method,
      path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - started),
    });
  }
});

function logRouteError(message: string, error: unknown, c?: Context) {
  logger.error(message, {
    err: error,
    requestId: c?.res.headers.get('x-request-id') ?? undefined,
    path: c ? new URL(c.req.url).pathname : undefined,
  });
}

// Liveness: process is up (for load balancers / k8s livenessProbe).
app.get('/api/health', c => c.json(getLiveness()));

// Readiness: SQLite accepts queries (for k8s readinessProbe).
app.get('/api/ready', c => {
  const body = getReadiness();
  return c.json(body, body.status === 'ready' ? 200 : 503);
});

function jsonError(
  c: Context,
  status: 400 | 401 | 403 | 404 | 500 | 503,
  code: ApiErrorCode,
  message?: string,
) {
  return c.json(buildApiError(code, message), status);
}

function jsonErrorFromMessage(
  c: Context,
  status: 400 | 401 | 403 | 404 | 500,
  message: string,
) {
  const code = codeFromErrorMessage(message) ?? 'INTERNAL_ERROR';
  return jsonError(c, status, code, message);
}

function invalidIdResponse(c: Context, id: string) {
  const validation = validateRouteId(id);
  if (!validation.ok) {
    return jsonError(c, 400, 'INVALID_ID', validation.error);
  }
  return null;
}

function topologyIdOrResponse(c: Context, id: string) {
  const validation = validateRouteId(id);
  if (!validation.ok) {
    return { response: jsonError(c, 400, 'INVALID_ID', validation.error) };
  }
  return { topologyId: id };
}

function topologyNotFound(c: Context) {
  return jsonError(c, 404, 'TOPOLOGY_NOT_FOUND');
}

/** Optional client id used to suppress echo of the caller's own collab events. */
function originClientId(c: Context): string | undefined {
  const value = c.req.header(COLLAB_CLIENT_HEADER)?.trim();
  return value || undefined;
}

/**
 * When auth is on, ensure the caller owns the topology.
 * Missing topology → 404; wrong owner → 403.
 */
function denyIfNotOwner(c: Context, topologyId: string): Response | null {
  if (!c.get('authEnabled')) return null;
  const user = c.get('user');
  if (!user) return jsonError(c, 401, 'AUTH_REQUIRED');
  if (!topologyStore.topologyExists(topologyId)) return topologyNotFound(c);
  if (!topologyStore.userOwnsTopology(topologyId, user.id)) {
    return jsonError(c, 403, 'AUTH_FORBIDDEN');
  }
  return null;
}

function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  const isProd = (Bun.env.NODE_ENV ?? process.env.NODE_ENV) === 'production';
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure: isProd,
    expires: expiresAt,
  });
}

function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
}

// --- Auth routes (public) -------------------------------------------------

app.get('/api/auth/status', c =>
  c.json({
    enabled: c.get('authEnabled'),
    authenticated: !!c.get('user'),
    user: c.get('user') ? { id: c.get('user')!.id, username: c.get('user')!.username } : null,
  }),
);

app.get('/api/auth/me', c => {
  const user = c.get('user');
  if (!user) {
    if (c.get('authEnabled')) return jsonError(c, 401, 'AUTH_REQUIRED');
    return c.json({ user: null, authEnabled: false });
  }
  return c.json({ user: { id: user.id, username: user.username }, authEnabled: c.get('authEnabled') });
});

app.post('/api/auth/register', async c => {
  try {
    const body = await c.req.json();
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const usernameError = getUsernameValidationError(username);
    if (usernameError) return jsonError(c, 400, 'AUTH_USERNAME_INVALID', usernameError);
    const passwordError = getPasswordValidationError(password);
    if (passwordError) return jsonError(c, 400, 'AUTH_PASSWORD_INVALID', passwordError);

    const user = await registerUser(username, password);
    const session = createSession(user.id);
    setSessionCookie(c, session.token, session.expiresAt);
    return c.json({ user: { id: user.id, username: user.username } }, 201);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'AUTH_USERNAME_TAKEN') {
      return jsonError(c, 400, 'AUTH_USERNAME_TAKEN');
    }
    logRouteError('Error registering user', error, c);
    return jsonError(c, 500, 'AUTH_REGISTER_FAILED');
  }
});

app.post('/api/auth/login', async c => {
  try {
    const body = await c.req.json();
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const user = await verifyUserCredentials(username, password);
    if (!user) return jsonError(c, 401, 'AUTH_INVALID_CREDENTIALS');

    const session = createSession(user.id);
    setSessionCookie(c, session.token, session.expiresAt);
    return c.json({ user: { id: user.id, username: user.username } });
  } catch (error) {
    logRouteError('Error logging in', error, c);
    return jsonError(c, 500, 'AUTH_LOGIN_FAILED');
  }
});

app.post('/api/auth/logout', c => {
  const token = extractSessionToken(c);
  if (token) deleteSession(token);
  clearSessionCookie(c);
  return c.json({ success: true });
});

// Machine-readable OpenAPI 3 document (always available).
app.get('/api/openapi.json', c => c.json(openApiDocument));

// Interactive docs (Swagger UI) — disabled in production unless NETALIGN_OPENAPI_UI=1.
app.get('/api/docs', c => {
  if (!isOpenApiUiEnabled()) {
    return jsonError(c, 404, 'INTERNAL_ERROR', 'API docs UI is disabled');
  }
  return c.html(renderSwaggerUiHtml('/api/openapi.json'));
});

// Topology routes require auth when NETALIGN_AUTH_MODE is on (or production default).
app.use('/api/topologies/*', requireAuth);
app.use('/api/topologies', requireAuth);

// 1. Get all topologies
app.get('/api/topologies', async (c) => {
  try {
    const ownerFilter = c.get('authEnabled') ? currentUserId(c) : null;
    return c.json(topologyStore.listTopologies(ownerFilter));
  } catch (error) {
    logRouteError('Error reading topologies', error, c);
    return jsonError(c, 500, 'TOPOLOGY_LIST_FAILED');
  }
});

// 2. Get specific topology detail
app.get('/api/topologies/:id', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;

  try {
    const data = topologyStore.getTopology(idResult.topologyId);
    if (!data) return topologyNotFound(c);
    return c.json(data);
  } catch (error) {
    logRouteError('Error fetching topology', error, c);
    return jsonError(c, 500, 'TOPOLOGY_READ_FAILED');
  }
});

// 3. Update a topology (rename)
app.patch('/api/topologies/:id', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;

  try {
    const body = await c.req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return jsonError(c, 400, 'TOPOLOGY_NAME_REQUIRED');
    }

    const updated = topologyStore.renameTopology(idResult.topologyId, name);
    if (!updated) return topologyNotFound(c);
    publishTopologyEvent(
      idResult.topologyId,
      { kind: 'topology.renamed', topologyId: idResult.topologyId, name: updated.name },
      originClientId(c),
    );
    return c.json(updated satisfies TopologySummary);
  } catch (error) {
    logRouteError('Error updating topology', error, c);
    return jsonError(c, 500, 'TOPOLOGY_UPDATE_FAILED');
  }
});

// 4. Create a new topology
app.post('/api/topologies', async (c) => {
  try {
    const body = await c.req.json();
    const name = body.name || 'New Topology';
    const id = `topology-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const idValidation = validateRouteId(id);
    if (!idValidation.ok) {
      return jsonError(c, 400, 'INVALID_ID', idValidation.error);
    }

    const newTopology: Topology = {
      id,
      name,
      nodes: [],
      edges: [],
    };

    const ownerId = currentUserId(c);
    topologyStore.createTopology(newTopology, ownerId ?? undefined);
    return c.json(newTopology, 201);
  } catch (error) {
    logRouteError('Error creating topology', error, c);
    return jsonError(c, 500, 'TOPOLOGY_CREATE_FAILED');
  }
});

// 4b. Import a topology document as a new topology (never overwrites existing)
app.post('/api/topologies/import', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = parseTopologyImport(body);
    if (!parsed.ok) {
      return jsonErrorFromMessage(c, 400, parsed.error);
    }

    // Retry once if generated id collides (extremely unlikely).
    let topology = parsed.topology;
    if (topologyStore.topologyExists(topology.id)) {
      const retry = parseTopologyImport(body);
      if (!retry.ok) {
        return jsonErrorFromMessage(c, 400, retry.error);
      }
      topology = retry.topology;
      if (topologyStore.topologyExists(topology.id)) {
        return jsonError(c, 500, 'TOPOLOGY_ID_ALLOCATION_FAILED');
      }
    }

    const ownerId = currentUserId(c);
    topologyStore.createTopology(topology, ownerId ?? undefined);
    publishTopologyEvent(
      topology.id,
      { kind: 'topology.replaced', topologyId: topology.id, topology },
      originClientId(c),
    );
    return c.json(topology, 201);
  } catch (error) {
    logRouteError('Error importing topology', error, c);
    return jsonError(c, 500, 'IMPORT_FAILED');
  }
});

function refuseProtectedTopologyDelete(c: Context, topologyId: string) {
  if (isProtectedTopologyId(topologyId, protectedTopologyIds)) {
    return jsonError(c, 403, 'TOPOLOGY_PROTECTED', PROTECTED_TOPOLOGY_DELETE_ERROR);
  }
  return null;
}

// 5. Delete a topology (legacy alias — prefer DELETE /api/topologies/:id)
app.post('/api/topologies/:id/delete', async (c) => {
  c.header('Deprecation', 'true');
  c.header('Sunset', 'Sat, 01 Aug 2026 00:00:00 GMT');
  c.header('Link', '</api/topologies/{id}>; rel="successor-version"');
  logger.warn('deprecated_delete_alias', {
    path: new URL(c.req.url).pathname,
    requestId: c.res.headers.get('x-request-id') ?? undefined,
  });

  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;

  const protectedResponse = refuseProtectedTopologyDelete(c, idResult.topologyId);
  if (protectedResponse) return protectedResponse;

  try {
    topologyStore.deleteTopology(idResult.topologyId);
    publishTopologyEvent(
      idResult.topologyId,
      { kind: 'topology.deleted', topologyId: idResult.topologyId },
      originClientId(c),
    );
    return c.json({
      success: true,
      message: `Deleted topology ${id}`,
      deprecated: true,
      prefer: 'DELETE /api/topologies/:id',
    });
  } catch (error) {
    logRouteError('Error deleting topology', error, c);
    return jsonError(c, 500, 'TOPOLOGY_DELETE_FAILED');
  }
});

app.delete('/api/topologies/:id', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;

  const protectedResponse = refuseProtectedTopologyDelete(c, idResult.topologyId);
  if (protectedResponse) return protectedResponse;

  try {
    topologyStore.deleteTopology(idResult.topologyId);
    publishTopologyEvent(
      idResult.topologyId,
      { kind: 'topology.deleted', topologyId: idResult.topologyId },
      originClientId(c),
    );
    return c.json({ success: true, message: `Deleted topology ${id}` });
  } catch (error) {
    logRouteError('Error deleting topology', error, c);
    return jsonError(c, 500, 'TOPOLOGY_DELETE_FAILED');
  }
});

// 6. Add a node to a topology
app.post('/api/topologies/:id/nodes', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;

  try {
    const body = (await c.req.json()) as CreateNodeBody;
    const { nodeId, type, label } = body;

    if (!nodeId || !type) {
      return jsonError(c, 400, 'NODE_ID_REQUIRED');
    }

    const invalidNodeId = invalidIdResponse(c, nodeId);
    if (invalidNodeId) return invalidNodeId;

    if (topologyStore.nodeExists(idResult.topologyId, nodeId)) {
      return jsonError(c, 400, 'NODE_ID_EXISTS');
    }

    const newNode: TopologyNode = {
      id: nodeId,
      type,
      data: { label: label || nodeId },
    };

    topologyStore.addNode(idResult.topologyId, newNode);
    publishTopologyEvent(
      idResult.topologyId,
      { kind: 'node.upserted', topologyId: idResult.topologyId, node: newNode },
      originClientId(c),
    );
    return c.json(newNode, 201);
  } catch (error) {
    logRouteError('Error adding node', error, c);
    return jsonError(c, 500, 'NODE_ADD_FAILED');
  }
});

// 7a. Batch-update node positions (single transaction)
app.put('/api/topologies/:id/nodes/positions', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;


  try {
    const body = (await c.req.json()) as BatchNodePositionsBody;
    if (!body || !Array.isArray(body.updates)) {
      return jsonError(c, 400, 'NODE_POSITIONS_REQUIRED');
    }

    const parsed: { nodeId: string; position: { x: number; y: number } }[] = [];
    for (const item of body.updates) {
      if (!item || typeof item !== 'object') {
        return jsonError(c, 400, 'NODE_POSITIONS_INVALID');
      }
      const nodeId = typeof item.nodeId === 'string' ? item.nodeId : '';
      const invalidNode = invalidIdResponse(c, nodeId);
      if (invalidNode) return invalidNode;

      const positionError = getPositionValidationError(item.position);
      if (positionError) {
        return jsonErrorFromMessage(c, 400, positionError);
      }
      parsed.push({ nodeId, position: parseNodePosition(item.position)! });
    }

    const result = topologyStore.updateNodePositions(idResult.topologyId, parsed);
    if (!result.ok) {
      const status = result.error.startsWith('Node not found') ? 404 : 400;
      return jsonErrorFromMessage(c, status === 404 ? 404 : 400, result.error);
    }
    publishTopologyEvent(
      idResult.topologyId,
      {
        kind: 'nodes.positions',
        topologyId: idResult.topologyId,
        updates: parsed,
      },
      originClientId(c),
    );
    return c.json({ nodes: result.nodes });
  } catch (error) {
    logRouteError('Error batch-updating node positions', error, c);
    return jsonError(c, 500, 'NODE_POSITIONS_UPDATE_FAILED');
  }
});

// 7. Update a node in a topology
app.put('/api/topologies/:id/nodes/:nodeId', async (c) => {
  const id = c.req.param('id');
  const nodeId = c.req.param('nodeId');
  const invalidNode = invalidIdResponse(c, nodeId);
  if (invalidNode) return invalidNode;

  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;


  try {
    const body = (await c.req.json()) as UpdateNodeBody;
    const labelProvided = Object.prototype.hasOwnProperty.call(body, 'label');
    const positionProvided = Object.prototype.hasOwnProperty.call(body, 'position');

    if (!labelProvided && !positionProvided) {
      return jsonError(c, 400, 'NODE_UPDATE_FIELDS_REQUIRED');
    }

    if (!topologyStore.nodeExists(idResult.topologyId, nodeId)) {
      return jsonError(c, 404, 'NODE_NOT_FOUND');
    }

    let node: TopologyNode | null = topologyStore.getNode(idResult.topologyId, nodeId);

    if (labelProvided) {
      const label = typeof body.label === 'string' ? body.label.trim() : '';
      if (!label) {
        return jsonError(c, 400, 'NODE_LABEL_REQUIRED');
      }
      node = topologyStore.updateNodeLabel(idResult.topologyId, nodeId, label);
    }

    if (positionProvided) {
      const positionError = getPositionValidationError(body.position);
      if (positionError) {
        return jsonErrorFromMessage(c, 400, positionError);
      }
      const position = parseNodePosition(body.position)!;
      node = topologyStore.updateNodePosition(idResult.topologyId, nodeId, position);
    }

    if (!node) return jsonError(c, 404, 'NODE_NOT_FOUND');
    publishTopologyEvent(
      idResult.topologyId,
      { kind: 'node.upserted', topologyId: idResult.topologyId, node },
      originClientId(c),
    );
    return c.json(node);
  } catch (error) {
    logRouteError('Error updating node', error, c);
    return jsonError(c, 500, 'NODE_UPDATE_FAILED');
  }
});

// 8. Delete a node from a topology (and all connected edges)
app.delete('/api/topologies/:id/nodes/:nodeId', async (c) => {
  const id = c.req.param('id');
  const nodeId = c.req.param('nodeId');
  const invalidNode = invalidIdResponse(c, nodeId);
  if (invalidNode) return invalidNode;

  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;


  try {
    const deleted = topologyStore.deleteNode(idResult.topologyId, nodeId);
    if (!deleted) {
      return jsonError(c, 404, 'NODE_NOT_FOUND');
    }

    publishTopologyEvent(
      idResult.topologyId,
      { kind: 'node.removed', topologyId: idResult.topologyId, nodeId },
      originClientId(c),
    );
    return c.json({ success: true, message: `Node ${nodeId} deleted with connections` });
  } catch (error) {
    logRouteError('Error deleting node', error, c);
    return jsonError(c, 500, 'NODE_DELETE_FAILED');
  }
});

// 9. Add an edge to a topology
app.post('/api/topologies/:id/edges', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;


  try {
    const body = (await c.req.json()) as CreateEdgeBody;
    const { source, target } = body;

    if (!source || !target) {
      return jsonError(c, 400, 'EDGE_ENDPOINTS_REQUIRED');
    }

    if (source === target) {
      return jsonError(c, 400, 'EDGE_SAME_NODE');
    }

    const sourceNode = topologyStore.getNode(idResult.topologyId, source);
    const targetNode = topologyStore.getNode(idResult.topologyId, target);

    if (!sourceNode || !targetNode) {
      return jsonError(c, 400, 'EDGE_NODES_MISSING');
    }

    const topologyError = validateEdgeBetweenNodes(sourceNode, targetNode);
    if (topologyError) {
      return jsonErrorFromMessage(c, 400, topologyError);
    }

    const edgeId = buildEdgeId(source, target);

    if (topologyStore.edgeExists(idResult.topologyId, edgeId)) {
      return jsonError(c, 400, 'EDGE_DUPLICATE');
    }

    const gateway = normalizeGateway(body.gateway);
    if (gateway) {
      const gatewayError = getGatewayValidationError(gateway);
      if (gatewayError) {
        return jsonErrorFromMessage(c, 400, gatewayError);
      }
    }

    const newEdge: TopologyEdge = {
      id: edgeId,
      source,
      target,
    };
    if (gateway) newEdge.gateway = gateway;

    topologyStore.addEdge(idResult.topologyId, newEdge);
    publishTopologyEvent(
      idResult.topologyId,
      { kind: 'edge.upserted', topologyId: idResult.topologyId, edge: newEdge },
      originClientId(c),
    );
    return c.json(newEdge, 201);
  } catch (error) {
    logRouteError('Error adding edge', error, c);
    return jsonError(c, 500, 'EDGE_ADD_FAILED');
  }
});

// 10. Update an edge in a topology
app.put('/api/topologies/:id/edges/:edgeId', async (c) => {
  const id = c.req.param('id');
  const edgeId = c.req.param('edgeId');
  const invalidEdge = invalidIdResponse(c, edgeId);
  if (invalidEdge) return invalidEdge;

  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;


  try {
    const body = (await c.req.json()) as UpdateEdgeBody;
    const gateway = normalizeGateway(body.gateway);
    if (gateway) {
      const gatewayError = getGatewayValidationError(gateway);
      if (gatewayError) {
        return jsonErrorFromMessage(c, 400, gatewayError);
      }
    }

    const edge = topologyStore.updateEdgeGateway(
      idResult.topologyId,
      edgeId,
      gateway ?? null,
    );

    if (!edge) {
      return jsonError(c, 404, 'EDGE_NOT_FOUND');
    }

    publishTopologyEvent(
      idResult.topologyId,
      { kind: 'edge.upserted', topologyId: idResult.topologyId, edge },
      originClientId(c),
    );
    return c.json(edge);
  } catch (error) {
    logRouteError('Error updating edge', error, c);
    return jsonError(c, 500, 'EDGE_UPDATE_FAILED');
  }
});

// 11. Delete an edge from a topology
app.delete('/api/topologies/:id/edges/:edgeId', async (c) => {
  const id = c.req.param('id');
  const edgeId = c.req.param('edgeId');
  const invalidEdge = invalidIdResponse(c, edgeId);
  if (invalidEdge) return invalidEdge;

  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  const denied = denyIfNotOwner(c, idResult.topologyId);
  if (denied) return denied;


  try {
    const deleted = topologyStore.deleteEdge(idResult.topologyId, edgeId);
    if (!deleted) {
      return jsonError(c, 404, 'EDGE_NOT_FOUND');
    }

    publishTopologyEvent(
      idResult.topologyId,
      { kind: 'edge.removed', topologyId: idResult.topologyId, edgeId },
      originClientId(c),
    );
    return c.json({ success: true, message: `Edge ${edgeId} deleted` });
  } catch (error) {
    logRouteError('Error deleting edge', error, c);
    return jsonError(c, 500, 'EDGE_DELETE_FAILED');
  }
});

const port = parseInt(Bun.env.PORT || process.env.PORT || '5000', 10);
logger.info('server_listen', { port, url: `http://localhost:${port}` });

type BunServerLike = {
  upgrade: (req: Request, options: { data: import('./collabHub.ts').CollabSocketData }) => boolean;
};

async function handleFetch(req: Request, server?: BunServerLike): Promise<Response | undefined> {
  const pathname = new URL(req.url).pathname;
  if (isCollabWsPath(pathname)) {
    return tryUpgradeCollabSocket(req, server);
  }
  return app.fetch(req);
}

export default {
  port,
  fetch: handleFetch,
  websocket: collabWebsocket,
};
