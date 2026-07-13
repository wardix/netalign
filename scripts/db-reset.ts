/**
 * Delete the SQLite database files so the next server start recreates an empty DB
 * and re-imports JSON seeds from server/data/ (when the DB is empty).
 *
 * Usage: bun run db:reset
 *
 * Prefer `bun run db:backup` before reset if you need to keep data.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { dbCompanionPaths, resolveDbPath } from './db-paths.ts';

const dbPath = resolveDbPath();

const candidates = [dbPath, ...dbCompanionPaths(dbPath)];

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
