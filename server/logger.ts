export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

const SENSITIVE_KEY = /password|secret|token|authorization|cookie|api[_-]?key/i;

/** Drop or redact fields that might contain secrets. */
export function sanitizeLogFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[redacted]';
      continue;
    }
    if (value instanceof Error) {
      out[key] = value.message;
      out[`${key}Name`] = value.name;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function shouldLogDebug(): boolean {
  const level = (Bun.env.LOG_LEVEL ?? process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return level === 'debug';
}

function write(level: LogLevel, message: string, fields?: LogFields): void {
  if (level === 'debug' && !shouldLogDebug()) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(fields ? sanitizeLogFields(fields) : {}),
  };

  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};

export function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Whether HTTP access logging is enabled. */
export function isRequestLoggingEnabled(): boolean {
  const flag = Bun.env.LOG_REQUESTS ?? process.env.LOG_REQUESTS;
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  // Default: on in production, off in development/test to keep noise down.
  return (Bun.env.NODE_ENV ?? process.env.NODE_ENV) === 'production';
}
