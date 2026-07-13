import { afterAll, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dbCompanionPaths, resolveBackupDir, resolveDbPath } from './db-paths.ts';

describe('db-paths', () => {
  test('resolveDbPath uses NETALIGN_DB_PATH when set', () => {
    expect(resolveDbPath({ NETALIGN_DB_PATH: '/tmp/custom.db' })).toBe('/tmp/custom.db');
  });

  test('resolveBackupDir uses NETALIGN_BACKUP_DIR when set', () => {
    expect(resolveBackupDir({ NETALIGN_BACKUP_DIR: '/tmp/baks' })).toBe('/tmp/baks');
  });

  test('dbCompanionPaths lists wal/shm/journal', () => {
    expect(dbCompanionPaths('/data/netalign.db')).toEqual([
      '/data/netalign.db-wal',
      '/data/netalign.db-shm',
      '/data/netalign.db-journal',
    ]);
  });
});

describe('VACUUM INTO backup round-trip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'netalign-backup-test-'));
  const source = join(dir, 'source.db');
  const backup = join(dir, 'backup.db');

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('backup contains committed data under WAL mode', () => {
    const db = new Database(source);
    db.run('PRAGMA journal_mode = WAL');
    db.run('CREATE TABLE topologies (id TEXT PRIMARY KEY, name TEXT NOT NULL)');
    db.run("INSERT INTO topologies (id, name) VALUES ('topology-1', 'Default Topology')");
    db.close();

    // Leave a WAL companion around to mimic a live server.
    writeFileSync(`${source}-wal`, '');

    const readonly = new Database(source, { readonly: true });
    readonly.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
    readonly.close();

    expect(existsSync(backup)).toBe(true);

    const restored = new Database(backup, { readonly: true });
    const row = restored.query('SELECT name FROM topologies WHERE id = ?').get('topology-1') as {
      name: string;
    };
    restored.close();
    expect(row.name).toBe('Default Topology');
  });
});
