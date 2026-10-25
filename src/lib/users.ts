import type { PoolClient } from 'pg';
import { q, q1, tx } from './db';
import { UserError } from './action-utils';
import { hashPassword, validatePassword, validateUsername } from './auth-core';
import { STARTER_FOODS } from './starter';
import { getTemplate, importTemplate, STARTER_TEMPLATE } from './templates';

export interface NewAccount {
  username: string;
  password: string;
  hunterName: string;
  /** Template key, or 'none'. */
  templateKey: string;
  isAdmin: boolean;
}

export async function countUsers(): Promise<number> {
  return (await q1<{ c: number }>('SELECT count(*)::int AS c FROM users'))?.c ?? 0;
}

export interface UserRow {
  id: number;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  hunterName: string | null;
}

export function listUsers(): Promise<UserRow[]> {
  return q<UserRow>(
    `SELECT u.id, u.username, u.is_admin AS "isAdmin", u.created_at AS "createdAt", s.hunter_name AS "hunterName"
     FROM users u LEFT JOIN settings s ON s.user_id = u.id ORDER BY u.id`,
  );
}

const OWNED_TABLES = ['plans', 'sessions', 'tasks', 'foods', 'food_logs', 'body_weights', 'xp_events', 'achievements'] as const;

/** Data created before accounts existed (user_id NULL) becomes the first account's. */
async function adoptLegacyData(c: PoolClient, userId: number, hunterName: string): Promise<void> {
  for (const t of OWNED_TABLES) await c.query(`UPDATE ${t} SET user_id = $1 WHERE user_id IS NULL`, [userId]);
  await c.query('UPDATE settings SET user_id = $1, hunter_name = $2 WHERE user_id IS NULL', [userId, hunterName]);
  await c.query('INSERT INTO settings (user_id, hunter_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING', [userId, hunterName]);
}

async function seedFreshAccount(c: PoolClient, userId: number, hunterName: string): Promise<void> {
  await c.query('INSERT INTO settings (user_id, hunter_name) VALUES ($1, $2)', [userId, hunterName]);
  for (const [name, serving, kcal, p, cb, f] of STARTER_FOODS) {
    await c.query(
      'INSERT INTO foods (user_id, name, serving_label, kcal, protein, carbs, fat) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [userId, name, serving, kcal, p, cb, f],
    );
  }
}

/**
 * Creates an account and its starting data in one transaction.
 * The very first account adopts the pre-existing data; later accounts get a clean slate.
 */
export async function createAccount(input: NewAccount): Promise<{ userId: number; firstAccount: boolean }> {
  const username = input.username.trim();
  const hunterName = input.hunterName.trim().slice(0, 40) || username;
  const nameErr = validateUsername(username);
  if (nameErr) throw new UserError(nameErr);
  const pwErr = validatePassword(input.password);
  if (pwErr) throw new UserError(pwErr);
  const template = input.templateKey === 'none' ? null : getTemplate(input.templateKey);
  if (input.templateKey !== 'none' && !template) throw new UserError('Unknown plan template');

  const passwordHash = await hashPassword(input.password);

  try {
    return await tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(727002)'); // serialise account creation
      const existing = (await q1<{ c: number }>('SELECT count(*)::int AS c FROM users', [], c))?.c ?? 0;
      const firstAccount = existing === 0;

      const u = await q1<{ id: number }>(
        'INSERT INTO users (username, password_hash, is_admin) VALUES ($1,$2,$3) RETURNING id',
        [username, passwordHash, firstAccount || input.isAdmin],
        c,
      );
      const userId = u!.id;

      if (firstAccount) await adoptLegacyData(c, userId, hunterName);
      else await seedFreshAccount(c, userId, hunterName);

      // The first account already owns the legacy starter plan; do not duplicate it.
      if (template && !(firstAccount && template.key === STARTER_TEMPLATE.key)) {
        await importTemplate(c, userId, template, true);
      }
      if (template?.settings?.proteinTarget) {
        await c.query('UPDATE settings SET protein_target = $2 WHERE user_id = $1', [userId, template.settings.proteinTarget]);
      }
      return { userId, firstAccount };
    });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new UserError('That username is already taken');
    throw e;
  }
}
