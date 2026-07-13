/**
 * Restore SQLite from a backup file created by `bun run db:backup`.
 *
 * IMPORTANT: Stop the API server first so no process holds the DB open.
 *
 * Usage:
 *   bun run db:restore -- ./server/data/backups/netalign-....db
 *
 * Env:
 *   NETALIGN_DB_PATH  target database path (default server/data/netalign.db)
 */
import { Database } from 'bun:sqlite';
import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { dbCompanionPaths, resolveDbPath } from './db-paths.ts';

function parseArgs(argv: string[]): { source?: string; force: boolean } {
  const args = argv.slice(2).filter(a => a !== '--');
  const force = args.includes('--force');
  const source = args.find(a => a !== '--force');
  return { source, force };
}

const { source: sourceArg, force } = parseArgs(process.argv);

if (!sourceArg) {
  console.error('Usage: bun run db:restore -- <backup.db> [--force]');
  process.exit(1);
}

const sourcePath = resolve(sourceArg);
const targetPath = resolveDbPath();

if (!existsSync(sourcePath)) {
  console.error(`Backup file not found: ${sourcePath}`);
  process.exit(1);
}

// Validate backup is a readable SQLite database with expected tables (or empty valid db).
try {
  const probe = new Database(sourcePath, { readonly: true });
  try {
    probe.query('SELECT 1').get();
  } finally {
    probe.close();
  }
} catch (error) {
  console.error('Backup file is not a valid SQLite database:', error);
  process.exit(1);
}

if (existsSync(targetPath) && !force) {
  console.error(`Target already exists: ${targetPath}`);
  console.error('Stop the server, then re-run with --force to overwrite (WAL/SHM companions are removed).');
  process.exit(1);
}

mkdirSync(dirname(targetPath), { recursive: true });

for (const companion of dbCompanionPaths(targetPath)) {
  if (existsSync(companion)) {
    unlinkSync(companion);
    console.log(`Removed ${companion}`);
  }
}

if (existsSync(targetPath)) {
  unlinkSync(targetPath);
  console.log(`Removed ${targetPath}`);
}

copyFileSync(sourcePath, targetPath);
console.log(`Restored ${sourcePath} → ${targetPath}`);
console.log('Start the server with `bun run server` or `docker compose up`. Do not leave -wal/-shm from a previous run.');
