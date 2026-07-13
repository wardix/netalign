import { describe, expect, test } from 'bun:test';
import { API_ERROR_CODES } from './apiErrors.ts';
import {
  OPENAPI_REQUIRED_PATHS,
  buildOpenApiDocument,
  openApiDocument,
  validateOpenApiDocument,
} from './openapi.ts';
import {
  isTopology,
  type Topology,
  type TopologyEdge,
  type TopologyNode,
} from './types.ts';

describe('OpenAPI document', () => {
  test('passes structural validation', () => {
    const problems = validateOpenApiDocument();
    expect(problems).toEqual([]);
  });

  test('buildOpenApiDocument is stable and complete', () => {
    const doc = buildOpenApiDocument();
    expect(validateOpenApiDocument(doc)).toEqual([]);
    expect(doc.info).toMatchObject({ title: 'NetAlign API' });
  });

  test('covers every required REST path', () => {
    const paths = openApiDocument.paths as Record<string, unknown>;
    for (const path of OPENAPI_REQUIRED_PATHS) {
      expect(paths[path]).toBeDefined();
    }
  });

  test('ApiError enum matches API_ERROR_CODES', () => {
    const schemas = (openApiDocument.components as { schemas: Record<string, unknown> })
      .schemas;
    const apiError = schemas.ApiError as {
      properties: { code: { enum: string[] } };
    };
    expect(new Set(apiError.properties.code.enum)).toEqual(new Set(API_ERROR_CODES));
  });

  test('Topology schema fields align with shared Topology type', () => {
    const sample: Topology = {
      id: 'topology-1',
      name: 'Sample',
      nodes: [
        {
          id: 'subnet-a',
          type: 'subnet',
          data: { label: 'Subnet A' },
          position: { x: 0, y: 0 },
        } satisfies TopologyNode,
      ],
      edges: [
        {
          id: 'router-1-subnet-a',
          source: 'router-1',
          target: 'subnet-a',
          gateway: '10.0.0.1',
        } satisfies TopologyEdge,
      ],
    };
    expect(isTopology(sample)).toBe(true);

    const schemas = (openApiDocument.components as { schemas: Record<string, unknown> })
      .schemas;
    const topology = schemas.Topology as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(topology.required).toEqual(
      expect.arrayContaining(['id', 'name', 'nodes', 'edges']),
    );
    expect(Object.keys(topology.properties).sort()).toEqual(
      ['edges', 'id', 'name', 'nodes'].sort(),
    );
  });

  test('serializes to JSON without loss of path count', () => {
    const json = JSON.stringify(openApiDocument);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(validateOpenApiDocument(parsed)).toEqual([]);
  });
});
