import { LEGACY_OWNER_ID } from '../shared/authConfig.ts';
import type { NodePosition } from '../shared/nodePosition.ts';
import type {
  Topology,
  TopologyEdge,
  TopologyNode,
  TopologySummary,
} from '../shared/types.ts';
import { getDatabase } from './db.ts';

interface NodeRow {
  id: string;
  type: string;
  label: string;
  position_x: number | null;
  position_y: number | null;
}

interface EdgeRow {
  id: string;
  source: string;
  target: string;
  gateway: string | null;
}

function rowToNode(row: NodeRow): TopologyNode {
  const node: TopologyNode = {
    id: row.id,
    type: row.type as TopologyNode['type'],
    data: { label: row.label },
  };

  if (row.position_x != null && row.position_y != null) {
    node.position = { x: row.position_x, y: row.position_y };
  }

  return node;
}

function rowToEdge(row: EdgeRow): TopologyEdge {
  const edge: TopologyEdge = {
    id: row.id,
    source: row.source,
    target: row.target,
  };
  if (row.gateway) edge.gateway = row.gateway;
  return edge;
}

/**
 * List topologies. When `ownerId` is set, only that owner's rows are returned.
 * When omitted, list all (auth disabled / admin-style internal use).
 */
export function listTopologies(ownerId?: string | null): TopologySummary[] {
  const db = getDatabase();
  if (ownerId) {
    return db
      .query('SELECT id, name FROM topologies WHERE owner_id = ? ORDER BY id')
      .all(ownerId) as TopologySummary[];
  }
  return db
    .query('SELECT id, name FROM topologies ORDER BY id')
    .all() as TopologySummary[];
}

export function topologyExists(id: string): boolean {
  const db = getDatabase();
  const row = db.query('SELECT 1 AS found FROM topologies WHERE id = ?').get(id) as
    | { found: number }
    | null;
  return row != null;
}

export function getTopologyOwnerId(id: string): string | null {
  const db = getDatabase();
  const row = db
    .query('SELECT owner_id FROM topologies WHERE id = ?')
    .get(id) as { owner_id: string | null } | null;
  return row?.owner_id ?? null;
}

/** True if topology exists and is owned by userId (or auth scoping is not applied). */
export function userOwnsTopology(id: string, userId: string | null | undefined): boolean {
  if (!userId) return false;
  const owner = getTopologyOwnerId(id);
  return owner === userId;
}

export function getTopology(id: string): Topology | null {
  const db = getDatabase();
  const topology = db
    .query('SELECT id, name FROM topologies WHERE id = ?')
    .get(id) as { id: string; name: string } | null;

  if (!topology) return null;

  const nodes = db
    .query(
      'SELECT id, type, label, position_x, position_y FROM nodes WHERE topology_id = ? ORDER BY id',
    )
    .all(id) as NodeRow[];

  const edges = db
    .query('SELECT id, source, target, gateway FROM edges WHERE topology_id = ? ORDER BY id')
    .all(id) as EdgeRow[];

  return {
    id: topology.id,
    name: topology.name,
    nodes: nodes.map(rowToNode),
    edges: edges.map(rowToEdge),
  };
}

export function createTopology(topology: Topology, ownerId: string = LEGACY_OWNER_ID): void {
  const db = getDatabase();
  db.transaction(() => {
    insertTopologyRecord(db, topology, ownerId);
  })();
}

export function renameTopology(id: string, name: string): TopologySummary | null {
  const db = getDatabase();
  return db.transaction(() => {
    const result = db
      .query('UPDATE topologies SET name = ? WHERE id = ? RETURNING id, name')
      .get(name, id) as TopologySummary | null;
    return result;
  })();
}

export function deleteTopology(id: string): boolean {
  const db = getDatabase();
  return db.transaction(() => {
    const result = db.run('DELETE FROM topologies WHERE id = ?', [id]);
    return result.changes > 0;
  })();
}

export function addNode(topologyId: string, node: TopologyNode): void {
  const db = getDatabase();
  db.transaction(() => {
    db.run(
      `INSERT INTO nodes (topology_id, id, type, label, position_x, position_y)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        topologyId,
        node.id,
        node.type,
        node.data?.label || node.id,
        node.position?.x ?? null,
        node.position?.y ?? null,
      ],
    );
  })();
}

export function nodeExists(topologyId: string, nodeId: string): boolean {
  const db = getDatabase();
  const row = db
    .query('SELECT 1 AS found FROM nodes WHERE topology_id = ? AND id = ?')
    .get(topologyId, nodeId) as { found: number } | null;
  return row != null;
}

export function getNode(topologyId: string, nodeId: string): TopologyNode | null {
  const db = getDatabase();
  const row = db
    .query(
      'SELECT id, type, label, position_x, position_y FROM nodes WHERE topology_id = ? AND id = ?',
    )
    .get(topologyId, nodeId) as NodeRow | null;
  return row ? rowToNode(row) : null;
}

export function updateNodeLabel(topologyId: string, nodeId: string, label: string): TopologyNode | null {
  const db = getDatabase();
  return db.transaction(() => {
    const result = db
      .query(
        `UPDATE nodes SET label = ?
         WHERE topology_id = ? AND id = ?
         RETURNING id, type, label, position_x, position_y`,
      )
      .get(label, topologyId, nodeId) as NodeRow | null;
    return result ? rowToNode(result) : null;
  })();
}

export function updateNodePosition(
  topologyId: string,
  nodeId: string,
  position: NodePosition,
): TopologyNode | null {
  const db = getDatabase();
  return db.transaction(() => {
    const result = db
      .query(
        `UPDATE nodes SET position_x = ?, position_y = ?
         WHERE topology_id = ? AND id = ?
         RETURNING id, type, label, position_x, position_y`,
      )
      .get(position.x, position.y, topologyId, nodeId) as NodeRow | null;
    return result ? rowToNode(result) : null;
  })();
}

export type BatchPositionResult =
  | { ok: true; nodes: TopologyNode[] }
  | { ok: false; error: string };

/**
 * Apply multiple node position updates in a single transaction.
 * Validates all node ids exist before writing; on any failure nothing is committed.
 */
export function updateNodePositions(
  topologyId: string,
  updates: { nodeId: string; position: NodePosition }[],
): BatchPositionResult {
  if (updates.length === 0) {
    return { ok: false, error: 'At least one position update is required' };
  }

  const seen = new Set<string>();
  for (const update of updates) {
    if (!update.nodeId || seen.has(update.nodeId)) {
      return { ok: false, error: 'Duplicate or empty nodeId in position updates' };
    }
    seen.add(update.nodeId);
    if (!nodeExists(topologyId, update.nodeId)) {
      return { ok: false, error: `Node not found: ${update.nodeId}` };
    }
  }

  const db = getDatabase();
  try {
    const nodes = db.transaction(() => {
      const updated: TopologyNode[] = [];
      for (const { nodeId, position } of updates) {
        const result = db
          .query(
            `UPDATE nodes SET position_x = ?, position_y = ?
             WHERE topology_id = ? AND id = ?
             RETURNING id, type, label, position_x, position_y`,
          )
          .get(position.x, position.y, topologyId, nodeId) as NodeRow | null;
        if (!result) {
          throw new Error(`Node not found: ${nodeId}`);
        }
        updated.push(rowToNode(result));
      }
      return updated;
    })();
    return { ok: true, nodes };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update positions';
    return { ok: false, error: message };
  }
}

export function deleteNode(topologyId: string, nodeId: string): boolean {
  const db = getDatabase();
  return db.transaction(() => {
    db.run(
      'DELETE FROM edges WHERE topology_id = ? AND (source = ? OR target = ?)',
      [topologyId, nodeId, nodeId],
    );
    const result = db.run('DELETE FROM nodes WHERE topology_id = ? AND id = ?', [
      topologyId,
      nodeId,
    ]);
    return result.changes > 0;
  })();
}

export function addEdge(topologyId: string, edge: TopologyEdge): void {
  const db = getDatabase();
  db.transaction(() => {
    db.run(
      `INSERT INTO edges (topology_id, id, source, target, gateway)
       VALUES (?, ?, ?, ?, ?)`,
      [topologyId, edge.id, edge.source, edge.target, edge.gateway ?? null],
    );
  })();
}

export function edgeExists(topologyId: string, edgeId: string): boolean {
  const db = getDatabase();
  const row = db
    .query('SELECT 1 AS found FROM edges WHERE topology_id = ? AND id = ?')
    .get(topologyId, edgeId) as { found: number } | null;
  return row != null;
}

export function getEdge(topologyId: string, edgeId: string): TopologyEdge | null {
  const db = getDatabase();
  const row = db
    .query('SELECT id, source, target, gateway FROM edges WHERE topology_id = ? AND id = ?')
    .get(topologyId, edgeId) as EdgeRow | null;
  return row ? rowToEdge(row) : null;
}

export function updateEdgeGateway(
  topologyId: string,
  edgeId: string,
  gateway: string | null,
): TopologyEdge | null {
  const db = getDatabase();
  return db.transaction(() => {
    const result = db
      .query(
        `UPDATE edges SET gateway = ?
         WHERE topology_id = ? AND id = ?
         RETURNING id, source, target, gateway`,
      )
      .get(gateway, topologyId, edgeId) as EdgeRow | null;
    return result ? rowToEdge(result) : null;
  })();
}

export function deleteEdge(topologyId: string, edgeId: string): boolean {
  const db = getDatabase();
  return db.transaction(() => {
    const result = db.run('DELETE FROM edges WHERE topology_id = ? AND id = ?', [
      topologyId,
      edgeId,
    ]);
    return result.changes > 0;
  })();
}

function insertTopologyRecord(
  db: ReturnType<typeof getDatabase>,
  topology: Topology,
  ownerId: string = LEGACY_OWNER_ID,
): void {
  db.run('INSERT INTO topologies (id, name, owner_id) VALUES (?, ?, ?)', [
    topology.id,
    topology.name,
    ownerId,
  ]);

  const insertNode = db.prepare(`
    INSERT INTO nodes (topology_id, id, type, label, position_x, position_y)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const node of topology.nodes) {
    insertNode.run(
      topology.id,
      node.id,
      node.type,
      node.data?.label || node.id,
      node.position?.x ?? null,
      node.position?.y ?? null,
    );
  }

  const insertEdge = db.prepare(`
    INSERT INTO edges (topology_id, id, source, target, gateway)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const edge of topology.edges) {
    insertEdge.run(
      topology.id,
      edge.id,
      edge.source,
      edge.target,
      edge.gateway ?? null,
    );
  }
}