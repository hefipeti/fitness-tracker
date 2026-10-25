/**
 * Framework-free auth primitives (no next/headers) so they can be tested directly.
 * Passwords: scrypt with a per-password random salt.
 * Sessions: a random token in an httpOnly cookie; only its SHA-256 hash is stored in the database.
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { q, q1, type Queryable } from './db';

export interface AuthUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

export const SESSION_DAYS = 30;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEYLEN, { N: n, r, p }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  if (expected.length !== KEYLEN) return false;
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), Number(n), Number(r), Number(p));
  return timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | null = null;
/** Burns the same CPU as a real check so unknown usernames are not distinguishable by timing. */
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password');
  await verifyPassword(password, await dummyHash);
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (password.length > PASSWORD_MAX) return 'Password is too long';
  return null;
}

export const USERNAME_RE = /^[A-Za-z0-9._-]{3,32}$/;

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) return 'Username: 3-32 characters, letters, digits, dot, dash or underscore';
  return null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createSessionRecord(userId: number, c?: Queryable): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await q('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [sha256(token), userId, expiresAt], c);
  await q('DELETE FROM auth_sessions WHERE expires_at < now()', [], c);
  return { token, expiresAt };
}

export async function findSessionUser(token: string): Promise<AuthUser | null> {
  if (!token || token.length > 200) return null;
  return q1<AuthUser>(
    `SELECT u.id, u.username, u.is_admin AS "isAdmin"
     FROM auth_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
}

export async function deleteSessionRecord(token: string): Promise<void> {
  await q('DELETE FROM auth_sessions WHERE token_hash = $1', [sha256(token)]);
}

export async function deleteUserSessions(userId: number, c?: Queryable): Promise<void> {
  await q('DELETE FROM auth_sessions WHERE user_id = $1', [userId], c);
}

// ----- Login throttling (in memory; resets on restart) -----

const WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 8;
const failures = new Map<string, { count: number; first: number }>();

export function isThrottled(key: string, now = Date.now()): boolean {
  const f = failures.get(key);
  if (!f) return false;
  if (now - f.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return f.count >= MAX_FAILURES;
}

export function recordFailure(key: string, now = Date.now()): void {
  const f = failures.get(key);
  if (!f || now - f.first > WINDOW_MS) failures.set(key, { count: 1, first: now });
  else f.count++;
}

export function clearFailures(key: string): void {
  failures.delete(key);
}
