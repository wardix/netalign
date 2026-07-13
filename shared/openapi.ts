/**
 * OpenAPI 3.0 description of the NetAlign REST API.
 * Schemas mirror `shared/types.ts` and error codes from `shared/apiErrors.ts`.
 */
import { API_ERROR_CODES } from './apiErrors.ts';

export const OPENAPI_SPEC_VERSION = '0.1.0';

/** Paths that must appear in the document (kept in sync with server/index.ts). */
export const OPENAPI_REQUIRED_PATHS = [
  '/api/health',
  '/api/ready',
  '/api/topologies',
  '/api/topologies/{id}',
  '/api/topologies/import',
  '/api/topologies/{id}/delete',
  '/api/topologies/{id}/nodes',
  '/api/topologies/{id}/nodes/positions',
  '/api/topologies/{id}/nodes/{nodeId}',
  '/api/topologies/{id}/edges',
  '/api/topologies/{id}/edges/{edgeId}',
  '/api/openapi.json',
] as const;

const nodeTypeSchema = {
  type: 'string',
  enum: ['subnet', 'router', 'instance', 'vm'],
  description: 'Node role. `vm` is a legacy alias for instance.',
} as const;

const resourceIdSchema = {
  type: 'string',
  minLength: 1,
  pattern: '^[A-Za-z0-9_-]+$',
  description: 'Alphanumeric id with dashes/underscores (no path segments).',
} as const;

const positionSchema = {
  type: 'object',
  required: ['x', 'y'],
  additionalProperties: false,
  properties: {
    x: { type: 'number', description: 'Canvas X coordinate' },
    y: { type: 'number', description: 'Canvas Y coordinate' },
  },
} as const;

const apiErrorSchema = {
  type: 'object',
  required: ['error', 'code'],
  additionalProperties: false,
  properties: {
    error: {
      type: 'string',
      description: 'Human-readable English message (for logs/debug).',
    },
    code: {
      type: 'string',
      enum: [...API_ERROR_CODES],
      description: 'Stable machine-readable error code.',
    },
  },
} as const;

/**
 * Full OpenAPI 3.0.3 document as a plain JSON-serializable object.
 */
export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: '3.0.3',
    info: {
      title: 'NetAlign API',
      version: OPENAPI_SPEC_VERSION,
      description:
        'REST API for network topology management. Failed responses use `{ error, code }` ' +
        'where `code` is a stable value from `shared/apiErrors.ts`. Prefer branching on `code`.',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local API server (default PORT)',
      },
      {
        url: '/',
        description: 'Same-origin / reverse-proxy',
      },
    ],
    tags: [
      { name: 'Health', description: 'Liveness and readiness probes' },
      { name: 'Topologies', description: 'Topology CRUD and import/export shapes' },
      { name: 'Nodes', description: 'Node create/update/delete and positions' },
      { name: 'Edges', description: 'Edge create/update/delete with topology rules' },
      { name: 'Meta', description: 'Machine-readable API description' },
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['Health'],
          operationId: 'getHealth',
          summary: 'Liveness probe',
          responses: {
            '200': {
              description: 'Process is up',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthStatus' },
                },
              },
            },
          },
        },
      },
      '/api/ready': {
        get: {
          tags: ['Health'],
          operationId: 'getReady',
          summary: 'Readiness probe (SQLite)',
          responses: {
            '200': {
              description: 'Database accepts queries',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ReadyStatus' },
                },
              },
            },
            '503': {
              description: 'Database unavailable',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ReadyStatus' },
                },
              },
            },
          },
        },
      },
      '/api/topologies': {
        get: {
          tags: ['Topologies'],
          operationId: 'listTopologies',
          summary: 'List topology summaries',
          responses: {
            '200': {
              description: 'Array of `{ id, name }`',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/TopologySummary' },
                  },
                },
              },
            },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
        post: {
          tags: ['Topologies'],
          operationId: 'createTopology',
          summary: 'Create empty topology',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateTopologyBody' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Created topology',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Topology' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
      },
      '/api/topologies/import': {
        post: {
          tags: ['Topologies'],
          operationId: 'importTopology',
          summary: 'Import topology document as a new topology',
          description:
            'Accepts a topology-shaped JSON document. Always allocates a new id; never overwrites.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TopologyImportDocument' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Imported topology with new id',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Topology' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
      },
      '/api/topologies/{id}': {
        parameters: [{ $ref: '#/components/parameters/TopologyId' }],
        get: {
          tags: ['Topologies'],
          operationId: 'getTopology',
          summary: 'Fetch full topology',
          responses: {
            '200': {
              description: 'Topology with nodes and edges',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Topology' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
        patch: {
          tags: ['Topologies'],
          operationId: 'renameTopology',
          summary: 'Rename topology',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RenameTopologyBody' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated summary',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TopologySummary' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
        delete: {
          tags: ['Topologies'],
          operationId: 'deleteTopology',
          summary: 'Delete topology',
          responses: {
            '200': {
              description: 'Deleted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessMessage' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '403': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
      },
      '/api/topologies/{id}/delete': {
        parameters: [{ $ref: '#/components/parameters/TopologyId' }],
        post: {
          tags: ['Topologies'],
          operationId: 'deleteTopologyLegacy',
          summary: 'Delete topology (deprecated alias)',
          deprecated: true,
          description: 'Prefer `DELETE /api/topologies/{id}`. Returns Deprecation/Sunset headers.',
          responses: {
            '200': {
              description: 'Deleted (includes deprecation metadata)',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DeprecatedDeleteResult' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '403': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
      },
      '/api/topologies/{id}/nodes': {
        parameters: [{ $ref: '#/components/parameters/TopologyId' }],
        post: {
          tags: ['Nodes'],
          operationId: 'createNode',
          summary: 'Add a node',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateNodeBody' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Created node',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TopologyNode' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
      },
      '/api/topologies/{id}/nodes/positions': {
        parameters: [{ $ref: '#/components/parameters/TopologyId' }],
        put: {
          tags: ['Nodes'],
          operationId: 'batchUpdateNodePositions',
          summary: 'Batch-update node positions',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BatchNodePositionsBody' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated nodes',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['nodes'],
                    properties: {
                      nodes: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/TopologyNode' },
                      },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
      },
      '/api/topologies/{id}/nodes/{nodeId}': {
        parameters: [
          { $ref: '#/components/parameters/TopologyId' },
          { $ref: '#/components/parameters/NodeId' },
        ],
        put: {
          tags: ['Nodes'],
          operationId: 'updateNode',
          summary: 'Update node label and/or position',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateNodeBody' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated node',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TopologyNode' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
        delete: {
          tags: ['Nodes'],
          operationId: 'deleteNode',
          summary: 'Delete node and connected edges',
          responses: {
            '200': {
              description: 'Deleted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessMessage' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
      },
      '/api/topologies/{id}/edges': {
        parameters: [{ $ref: '#/components/parameters/TopologyId' }],
        post: {
          tags: ['Edges'],
          operationId: 'createEdge',
          summary: 'Add an edge',
          description:
            'Routers and instances may only connect directly to subnets. ' +
            'Edge id is derived from endpoints.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateEdgeBody' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Created edge',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TopologyEdge' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
      },
      '/api/topologies/{id}/edges/{edgeId}': {
        parameters: [
          { $ref: '#/components/parameters/TopologyId' },
          { $ref: '#/components/parameters/EdgeId' },
        ],
        put: {
          tags: ['Edges'],
          operationId: 'updateEdge',
          summary: 'Update edge gateway',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateEdgeBody' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated edge',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TopologyEdge' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
        delete: {
          tags: ['Edges'],
          operationId: 'deleteEdge',
          summary: 'Delete edge',
          responses: {
            '200': {
              description: 'Deleted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessMessage' },
                },
              },
            },
            '400': { $ref: '#/components/responses/ApiError' },
            '404': { $ref: '#/components/responses/ApiError' },
            '500': { $ref: '#/components/responses/ApiError' },
          },
        },
      },
      '/api/openapi.json': {
        get: {
          tags: ['Meta'],
          operationId: 'getOpenApiDocument',
          summary: 'OpenAPI 3 document (this schema)',
          responses: {
            '200': {
              description: 'OpenAPI 3.0 JSON',
              content: {
                'application/json': {
                  schema: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      parameters: {
        TopologyId: {
          name: 'id',
          in: 'path',
          required: true,
          schema: resourceIdSchema,
          description: 'Topology id',
        },
        NodeId: {
          name: 'nodeId',
          in: 'path',
          required: true,
          schema: resourceIdSchema,
          description: 'Node id',
        },
        EdgeId: {
          name: 'edgeId',
          in: 'path',
          required: true,
          schema: resourceIdSchema,
          description: 'Edge id (typically `{source}-{target}`)',
        },
      },
      responses: {
        ApiError: {
          description: 'Error with stable code',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
            },
          },
        },
      },
      schemas: {
        ApiError: apiErrorSchema,
        NodePosition: positionSchema,
        TopologyNodeType: nodeTypeSchema,
        TopologyNodeData: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string' },
          },
        },
        TopologyNode: {
          type: 'object',
          required: ['id', 'type'],
          additionalProperties: false,
          properties: {
            id: resourceIdSchema,
            type: { $ref: '#/components/schemas/TopologyNodeType' },
            data: { $ref: '#/components/schemas/TopologyNodeData' },
            position: { $ref: '#/components/schemas/NodePosition' },
          },
        },
        TopologyEdge: {
          type: 'object',
          required: ['id', 'source', 'target'],
          additionalProperties: false,
          properties: {
            id: resourceIdSchema,
            source: resourceIdSchema,
            target: resourceIdSchema,
            gateway: {
              type: 'string',
              description: 'Optional gateway / interface label on the edge',
            },
          },
        },
        Topology: {
          type: 'object',
          required: ['id', 'name', 'nodes', 'edges'],
          additionalProperties: false,
          properties: {
            id: resourceIdSchema,
            name: { type: 'string' },
            nodes: {
              type: 'array',
              items: { $ref: '#/components/schemas/TopologyNode' },
            },
            edges: {
              type: 'array',
              items: { $ref: '#/components/schemas/TopologyEdge' },
            },
          },
        },
        TopologySummary: {
          type: 'object',
          required: ['id', 'name'],
          additionalProperties: false,
          properties: {
            id: resourceIdSchema,
            name: { type: 'string' },
          },
        },
        TopologyImportDocument: {
          type: 'object',
          required: ['name', 'nodes', 'edges'],
          description: 'Import payload; `id` is optional and ignored for overwrite (new id allocated).',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            nodes: {
              type: 'array',
              items: { $ref: '#/components/schemas/TopologyNode' },
            },
            edges: {
              type: 'array',
              items: { $ref: '#/components/schemas/TopologyEdge' },
            },
          },
        },
        CreateTopologyBody: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              description: 'Defaults to "New Topology" when omitted or empty-handled by server',
            },
          },
        },
        RenameTopologyBody: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1 },
          },
        },
        CreateNodeBody: {
          type: 'object',
          required: ['nodeId', 'type'],
          additionalProperties: false,
          properties: {
            nodeId: resourceIdSchema,
            type: { $ref: '#/components/schemas/TopologyNodeType' },
            label: { type: 'string' },
          },
        },
        UpdateNodeBody: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string', minLength: 1 },
            position: { $ref: '#/components/schemas/NodePosition' },
          },
          description: 'At least one of `label` or `position` is required.',
        },
        BatchNodePositionsBody: {
          type: 'object',
          required: ['updates'],
          additionalProperties: false,
          properties: {
            updates: {
              type: 'array',
              items: {
                type: 'object',
                required: ['nodeId', 'position'],
                additionalProperties: false,
                properties: {
                  nodeId: resourceIdSchema,
                  position: { $ref: '#/components/schemas/NodePosition' },
                },
              },
            },
          },
        },
        CreateEdgeBody: {
          type: 'object',
          required: ['source', 'target'],
          additionalProperties: false,
          properties: {
            source: resourceIdSchema,
            target: resourceIdSchema,
            gateway: { type: 'string' },
          },
        },
        UpdateEdgeBody: {
          type: 'object',
          additionalProperties: false,
          properties: {
            gateway: {
              type: 'string',
              description: 'Empty/omitted clears gateway after normalize',
            },
          },
        },
        SuccessMessage: {
          type: 'object',
          required: ['success', 'message'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            message: { type: 'string' },
          },
        },
        DeprecatedDeleteResult: {
          allOf: [
            { $ref: '#/components/schemas/SuccessMessage' },
            {
              type: 'object',
              properties: {
                deprecated: { type: 'boolean' },
                prefer: { type: 'string' },
              },
            },
          ],
        },
        HealthStatus: {
          type: 'object',
          required: ['status', 'service', 'uptimeSeconds', 'timestamp'],
          properties: {
            status: { type: 'string', enum: ['ok'] },
            service: { type: 'string', enum: ['netalign-api'] },
            uptimeSeconds: { type: 'integer', minimum: 0 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ReadyStatus: {
          type: 'object',
          required: ['status', 'service', 'database', 'timestamp'],
          properties: {
            status: { type: 'string', enum: ['ready', 'not_ready'] },
            service: { type: 'string', enum: ['netalign-api'] },
            database: { type: 'string', enum: ['ok', 'error'] },
            timestamp: { type: 'string', format: 'date-time' },
            error: { type: 'string' },
          },
        },
      },
    },
  };
}

/** Cached document for handlers and tests. */
export const openApiDocument = buildOpenApiDocument();

/**
 * Lightweight structural checks (no external OpenAPI parser dependency).
 * Returns a list of human-readable problems; empty means OK.
 */
export function validateOpenApiDocument(
  doc: Record<string, unknown> = openApiDocument,
): string[] {
  const problems: string[] = [];

  if (doc.openapi !== '3.0.3' && doc.openapi !== '3.0.0' && doc.openapi !== '3.1.0') {
    problems.push(`unexpected openapi version: ${String(doc.openapi)}`);
  }

  const info = doc.info as { title?: string; version?: string } | undefined;
  if (!info?.title || !info?.version) {
    problems.push('info.title and info.version are required');
  }

  const paths = doc.paths as Record<string, unknown> | undefined;
  if (!paths || typeof paths !== 'object') {
    problems.push('paths object missing');
    return problems;
  }

  for (const p of OPENAPI_REQUIRED_PATHS) {
    if (!(p in paths)) {
      problems.push(`missing path: ${p}`);
    }
  }

  const components = doc.components as
    | { schemas?: Record<string, unknown> }
    | undefined;
  const requiredSchemas = [
    'Topology',
    'TopologyNode',
    'TopologyEdge',
    'TopologySummary',
    'CreateNodeBody',
    'CreateEdgeBody',
    'BatchNodePositionsBody',
    'ApiError',
  ];
  for (const name of requiredSchemas) {
    if (!components?.schemas?.[name]) {
      problems.push(`missing schema: ${name}`);
    }
  }

  const apiError = components?.schemas?.ApiError as
    | { properties?: { code?: { enum?: string[] } } }
    | undefined;
  const codeEnum = apiError?.properties?.code?.enum;
  if (!codeEnum || !Array.isArray(codeEnum)) {
    problems.push('ApiError.code enum missing');
  } else {
    for (const code of API_ERROR_CODES) {
      if (!codeEnum.includes(code)) {
        problems.push(`ApiError.code enum missing ${code}`);
      }
    }
  }

  return problems;
}
