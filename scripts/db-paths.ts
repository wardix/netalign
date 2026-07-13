import { join, resolve } from 'node:path';

export const DATA_DIR = resolve(import.meta.dir, '../server/data');
export const DEFAULT_DB_PATH = join(DATA_DIR, 'netalign.db');
export const DEFAULT_BACKUP_DIR = join(DATA_DIR, 'backups');

export function resolveDbPath(env: Record<string, string | undefined> = process.env): string {
  return resolve(env.NETALIGN_DB_PATH || DEFAULT_DB_PATH);
}

export function resolveBackupDir(env: Record<string, string | undefined> = process.env): string {
  return resolve(env.NETALIGN_BACKUP_DIR || DEFAULT_BACKUP_DIR);
}

/** Companion files created under WAL / journal modes. */
export function dbCompanionPaths(dbPath: string): string[] {
  return [`${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];
}
