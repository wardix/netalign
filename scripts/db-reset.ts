/**
 * Delete the SQLite database files so the next server start recreates an empty DB
 * and re-imports JSON seeds from server/data/ (when the DB is empty).
 *
 * Usage: bun run db:reset
 */
import { existsSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dataDir = resolve(import.meta.dir, '../server/data');
const defaultDb = join(dataDir, 'netalign.db');
const dbPath = resolve(process.env.NETALIGN_DB_PATH || defaultDb);

const candidates = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];

let removed = 0;
for (const file of candidates) {
  if (existsSync(file)) {
    unlinkSync(file);
    console.log(`Removed ${file}`);
    removed += 1;
  }
}

if (removed === 0) {
  console.log(`No database files found at ${dbPath}`);
} else {
  console.log(
    'Database reset complete. On next `bun run server` (or Docker start), an empty DB is created and *.json seeds under server/data/ are imported if present.',
  );
}
