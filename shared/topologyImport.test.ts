import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  IMPORT_ERRORS,
  parseTopologyImport,
  sanitizeExportFilename,
  toExportDocument,
} from './topologyImport.ts';
import { isTopology } from './types.ts';

const topology1 = JSON.parse(
  readFileSync(join(import.meta.dir, '../server/data/topology-1.json'), 'utf8'),
);

describe('parseTopologyImport', () => {
  test('accepts seed topology and assigns a new id', () => {
    const result = parseTopologyImport(topology1, { topologyId: 'topology-import-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.topology.id).toBe('topology-import-1');
    expect(result.topology.name).toBe(topology1.name);
    expect(result.topology.nodes.length).toBe(topology1.nodes.length);
    expect(result.topology.edges.length).toBe(topology1.edges.length);
    expect(isTopology(result.topology)).toBe(true);
  });

  test('accepts document without id field', () => {
    const result = parseTopologyImport({
      name: 'Imported',
      nodes: [{ id: 'subnet-a', type: 'subnet', data: { label: 'A' } }],
      edges: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.topology.id.startsWith('topology-')).toBe(true);
    expect(result.topology.name).toBe('Imported');
  });

  test('rejects invalid shape and empty name', () => {
    expect(parseTopologyImport(null).ok).toBe(false);
    expect(parseTopologyImport({ name: '  ', nodes: [], edges: [] }).error).toBe(
      IMPORT_ERRORS.nameRequired,
    );
    expect(parseTopologyImport({ name: 'x', nodes: 'nope', edges: [] }).error).toBe(
      IMPORT_ERRORS.invalidJsonShape,
    );
  });

  test('rejects duplicate node ids and invalid node ids', () => {
    expect(
      parseTopologyImport({
        name: 'Bad',
        nodes: [
          { id: 'subnet-1', type: 'subnet' },
          { id: 'subnet-1', type: 'router' },
        ],
        edges: [],
      }).error,
    ).toBe(IMPORT_ERRORS.duplicateNodeId);

    expect(
      parseTopologyImport({
        name: 'Bad',
        nodes: [{ id: '../evil', type: 'subnet' }],
        edges: [],
      }).error,
    ).toBe(IMPORT_ERRORS.invalidNodeId);
  });

  test('rejects edges with missing endpoints or invalid topology rules', () => {
    expect(
      parseTopologyImport({
        name: 'Bad',
        nodes: [{ id: 'subnet-1', type: 'subnet' }],
        edges: [{ id: 'e1', source: 'subnet-1', target: 'missing' }],
      }).error,
    ).toBe(IMPORT_ERRORS.missingEndpoints);

    expect(
      parseTopologyImport({
        name: 'Bad',
        nodes: [
          { id: 'r1', type: 'router' },
          { id: 'r2', type: 'router' },
        ],
        edges: [{ id: 'e1', source: 'r1', target: 'r2' }],
      }).error,
    ).toBe(IMPORT_ERRORS.invalidConnection);
  });

  test('rejects invalid gateway values', () => {
    expect(
      parseTopologyImport({
        name: 'Bad',
        nodes: [
          { id: 'subnet-1', type: 'subnet' },
          { id: 'router-1', type: 'router' },
        ],
        edges: [{ id: 'e1', source: 'router-1', target: 'subnet-1', gateway: 'bad gateway!!' }],
      }).error,
    ).toBe('Gateway contains invalid characters');
  });

  test('round-trips export document through import', () => {
    const parsed = parseTopologyImport(topology1, { topologyId: 'topology-export-roundtrip' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const exported = toExportDocument(parsed.topology);
    const reimported = parseTopologyImport(exported, { topologyId: 'topology-reimport' });
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) return;
    expect(reimported.topology.nodes).toEqual(exported.nodes);
    expect(reimported.topology.edges).toEqual(exported.edges);
    expect(reimported.topology.name).toBe(exported.name);
  });
});

describe('sanitizeExportFilename', () => {
  test('slugifies topology names', () => {
    expect(sanitizeExportFilename('Default Topology')).toBe('default-topology.json');
    expect(sanitizeExportFilename('  ')).toBe('topology.json');
  });
});
