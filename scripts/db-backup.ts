/**
 * Create a consistent SQLite backup using VACUUM INTO (safe with WAL).
 *
 * Usage:
 *   bun run db:backup
 *   bun run db:backup -- ./path/to/out.db
 *
 * Env:
 *   NETALIGN_DB_PATH      source database (default server/data/netalign.db)
 *   NETALIGN_BACKUP_DIR   directory for timestamped backups (default server/data/backups)
 */
import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { resolveBackupDir, resolveDbPath } from './db-paths.ts';

function sqlStringLiteral(path: string): string {
  return `'${path.replace(/'/g, "''")}'`;
}

function timestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function parseArgs(argv: string[]): { dest?: string } {
  // bun run scripts/db-backup.ts [--] [dest]
  const args = argv.slice(2).filter(a => a !== '--');
  return { dest: args[0] };
}

const { dest: destArg } = parseArgs(process.argv);
const sourcePath = resolveDbPath();

if (!existsSync(sourcePath)) {
  console.error(`Source database not found: ${sourcePath}`);
  console.error('Start the server once to create it, or set NETALIGN_DB_PATH.');
  process.exit(1);
}

let destPath: string;
if (destArg) {
  destPath = resolve(destArg);
} else {
  const dir = resolveBackupDir();
  mkdirSync(dir, { recursive: true });
  destPath = resolve(dir, `netalign-${timestampSlug()}.db`);
}

mkdirSync(dirname(destPath), { recursive: true });

if (existsSync(destPath)) {
  console.error(`Refusing to overwrite existing file: ${destPath}`);
  process.exit(1);
}

// Online consistent snapshot; works while the API is running (WAL).
const db = new Database(sourcePath, { readonly: true });
try {
  db.exec(`VACUUM INTO ${sqlStringLiteral(destPath)}`);
} finally {
  db.close();
}

console.log(`Backup written: ${destPath}`);
console.log(
  'Note: This is a full SQLite snapshot. Per-topology JSON export/import is separate (UI Export/Import).',
);
