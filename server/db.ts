import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LEGACY_OWNER_ID } from '../shared/authConfig.ts';
import { isTopology, type Topology } from '../shared/types.ts';

const DATA_DIR = resolve(import.meta.dir, 'data');
const DEFAULT_DB_PATH = join(DATA_DIR, 'netalign.db');

let database: Database | undefined;

function resolveDbPath(): string {
  return process.env.NETALIGN_DB_PATH || DEFAULT_DB_PATH;
}

export function getDatabase(): Database {
  if (!database) {
    database = new Database(resolveDbPath());
    database.run('PRAGMA journal_mode = WAL');
    database.run('PRAGMA foreign_keys = ON');
    initializeSchema(database);
    if (process.env.NETALIGN_SKIP_JSON_MIGRATE !== '1') {
      migrateFromJsonIfEmpty(database);
    }
  }
  return database;
}

export function closeDatabase(): void {
  database?.close();
  database = undefined;
}

export function resetDatabase(dbPath: string, options?: { migrateFromJson?: boolean }): Database {
  closeDatabase();
  process.env.NETALIGN_DB_PATH = dbPath;
  process.env.NETALIGN_SKIP_JSON_MIGRATE = options?.migrateFromJson === false ? '1' : '';
  return getDatabase();
}

function tableHasColumn(db: Database, table: string, column: string): boolean {
  const cols = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some(c => c.name === column);
}

function initializeSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS topologies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT
    )
  `);

  // Existing DBs created before ownership: add owner_id if missing.
  if (!tableHasColumn(db, 'topologies', 'owner_id')) {
    db.run('ALTER TABLE topologies ADD COLUMN owner_id TEXT');
  }

  // Ensure legacy owner exists, then assign orphan topologies.
  const legacy = db
    .query('SELECT id FROM users WHERE id = ?')
    .get(LEGACY_OWNER_ID) as { id: string } | null;
  if (!legacy) {
    db.run(
      `INSERT INTO users (id, username, password_hash, created_at)
       VALUES (?, ?, ?, ?)`,
      [LEGACY_OWNER_ID, '__legacy__', '!', new Date().toISOString()],
    );
  }
  db.run('UPDATE topologies SET owner_id = ? WHERE owner_id IS NULL', [LEGACY_OWNER_ID]);

  db.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      topology_id TEXT NOT NULL,
      id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      position_x REAL,
      position_y REAL,
      PRIMARY KEY (topology_id, id),
      FOREIGN KEY (topology_id) REFERENCES topologies(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS edges (
      topology_id TEXT NOT NULL,
      id TEXT NOT NULL,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      gateway TEXT,
      PRIMARY KEY (topology_id, id),
      FOREIGN KEY (topology_id) REFERENCES topologies(id) ON DELETE CASCADE
    )
  `);
}

function readJsonTopologies(): Topology[] {
  const topologies: Topology[] = [];

  for (const file of readdirSync(DATA_DIR)) {
    if (!file.endsWith('.json')) continue;
    const content = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as unknown;
    if (isTopology(content)) {
      topologies.push(content);
    }
  }

  return topologies;
}

function insertTopology(db: Database, topology: Topology, ownerId: string = LEGACY_OWNER_ID): void {
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

function migrateFromJsonIfEmpty(db: Database): void {
  const count = db.query('SELECT COUNT(*) AS count FROM topologies').get() as { count: number };
  if (count.count > 0) return;

  const importTopologies = db.transaction((items: Topology[]) => {
    for (const topology of items) {
      insertTopology(db, topology);
    }
  });
  importTopologies(readJsonTopologies());
}

export function seedTopology(topology: Topology): void {
  const db = getDatabase();
  const exists = db
    .query('SELECT 1 AS found FROM topologies WHERE id = ?')
    .get(topology.id) as { found: number } | null;

  if (exists) return;

  db.transaction(() => {
    insertTopology(db, topology);
  })();
}