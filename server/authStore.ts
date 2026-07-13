import { LEGACY_OWNER_ID, SESSION_TTL_MS } from '../shared/authConfig.ts';
import { getDatabase } from './db.ts';

export interface AuthUser {
  id: string;
  username: string;
}

export interface SessionRow {
  token: string;
  user_id: string;
  expires_at: string;
}

const USERNAME_RE = /^[A-Za-z0-9_-]{3,32}$/;

export function getUsernameValidationError(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return 'Username must be 3–32 characters and use only letters, numbers, underscores, or dashes';
  }
  return null;
}

export function getPasswordValidationError(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  return null;
}

export function ensureLegacyOwner(): void {
  const db = getDatabase();
  const existing = db
    .query('SELECT id FROM users WHERE id = ?')
    .get(LEGACY_OWNER_ID) as { id: string } | null;
  if (existing) return;

  // Unusable password hash placeholder — login as legacy is not intended.
  db.run(
    `INSERT INTO users (id, username, password_hash, created_at)
     VALUES (?, ?, ?, ?)`,
    [LEGACY_OWNER_ID, '__legacy__', '!', new Date().toISOString()],
  );
}

export async function registerUser(username: string, password: string): Promise<AuthUser> {
  const db = getDatabase();
  const id = `user-${crypto.randomUUID()}`;
  const passwordHash = await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 10,
  });
  const createdAt = new Date().toISOString();

  try {
    db.run(
      `INSERT INTO users (id, username, password_hash, created_at)
       VALUES (?, ?, ?, ?)`,
      [id, username, passwordHash, createdAt],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE') || message.includes('unique')) {
      const err = new Error('Username is already taken');
      (err as Error & { code?: string }).code = 'AUTH_USERNAME_TAKEN';
      throw err;
    }
    throw error;
  }

  return { id, username };
}

export async function verifyUserCredentials(
  username: string,
  password: string,
): Promise<AuthUser | null> {
  const db = getDatabase();
  const row = db
    .query('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(username) as { id: string; username: string; password_hash: string } | null;

  if (!row || row.password_hash === '!') return null;

  const ok = await Bun.password.verify(password, row.password_hash);
  if (!ok) return null;
  return { id: row.id, username: row.username };
}

export function createSession(userId: string): { token: string; expiresAt: Date } {
  const db = getDatabase();
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.run(
    `INSERT INTO sessions (token, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
    [token, userId, expiresAt.toISOString(), new Date().toISOString()],
  );
  return { token, expiresAt };
}

export function deleteSession(token: string): void {
  const db = getDatabase();
  db.run('DELETE FROM sessions WHERE token = ?', [token]);
}

export function getUserForSession(token: string | undefined | null): AuthUser | null {
  if (!token) return null;
  const db = getDatabase();
  const row = db
    .query(
      `SELECT u.id AS id, u.username AS username, s.expires_at AS expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as { id: string; username: string; expires_at: string } | null;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    deleteSession(token);
    return null;
  }
  return { id: row.id, username: row.username };
}

export function getUserById(id: string): AuthUser | null {
  const db = getDatabase();
  const row = db
    .query('SELECT id, username FROM users WHERE id = ?')
    .get(id) as AuthUser | null;
  return row;
}
