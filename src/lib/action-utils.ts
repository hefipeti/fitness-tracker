import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { q1, type Queryable } from './db';
import type { ActionError, ActionResult } from './types';

export function fdStr(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}

export function fdNum(fd: FormData, key: string): number | null {
  const s = fdStr(fd, key).replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function fdInt(fd: FormData, key: string): number | null {
  const n = fdNum(fd, key);
  return n == null ? null : Math.trunc(n);
}

export function reqInt(fd: FormData, key: string): number {
  const n = fdInt(fd, key);
  if (n == null) throw new Error(`Missing field: ${key}`);
  return n;
}

export function reqStr(fd: FormData, key: string, max = 120): string {
  const s = fdStr(fd, key);
  if (!s) throw new Error(`Missing field: ${key}`);
  return s.slice(0, max);
}

/** Refresh every page that may show changed data. */
export function touch(): void {
  revalidatePath('/', 'layout');
}

/**
 * An expected, user-facing failure. Production builds mask the message of thrown errors, so actions
 * called through the client `run()` helper wrap their body in guard(), which turns this into `{ error }`.
 */
export class UserError extends Error {}

export async function guard<T>(fn: () => Promise<T>): Promise<T | ActionError> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    if (e instanceof ZodError) return { error: 'Invalid input' };
    throw e; // redirects and unexpected failures keep propagating
  }
}

export async function uniqueSlug(base: string, c?: Queryable): Promise<string> {
  const root =
    base
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'exercise';
  let slug = root;
  let i = 2;
  while (await q1('SELECT 1 FROM exercises WHERE slug = $1', [slug], c)) {
    slug = `${root}-${i++}`;
  }
  return slug;
}
