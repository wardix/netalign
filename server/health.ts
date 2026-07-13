import { getDatabase } from './db.ts';

export interface HealthStatus {
  status: 'ok';
  service: 'netalign-api';
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadyStatus {
  status: 'ready' | 'not_ready';
  service: 'netalign-api';
  database: 'ok' | 'error';
  timestamp: string;
  error?: string;
}

const startedAt = Date.now();

export function getLiveness(): HealthStatus {
  return {
    status: 'ok',
    service: 'netalign-api',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
}

/** Verifies SQLite is open and accepts a trivial query. */
export function getReadiness(): ReadyStatus {
  const timestamp = new Date().toISOString();
  try {
    const db = getDatabase();
    db.query('SELECT 1 AS ok').get();
    return {
      status: 'ready',
      service: 'netalign-api',
      database: 'ok',
      timestamp,
    };
  } catch (error) {
    return {
      status: 'not_ready',
      service: 'netalign-api',
      database: 'error',
      timestamp,
      error: error instanceof Error ? error.message : 'Database check failed',
    };
  }
}
