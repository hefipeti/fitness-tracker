'use server';

import { redirect } from 'next/navigation';
import { q1 } from '../db';
import { endSession, startSession } from '../auth';
import {
  clearFailures,
  isThrottled,
  recordFailure,
  validatePassword,
  verifyDummy,
  verifyPassword,
} from '../auth-core';
import { UserError, fdStr } from '../action-utils';
import { countUsers, createAccount } from '../users';

export interface AuthState {
  error?: string;
}

export async function loginAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const username = fdStr(fd, 'username').slice(0, 64);
  const password = String(fd.get('password') ?? '').slice(0, 200);
  if (!username || !password) return { error: 'Enter your username and password' };

  const key = username.toLowerCase();
  if (isThrottled(key)) return { error: 'Too many failed attempts. Wait a few minutes and try again.' };

  const user = await q1<{ id: number; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE lower(username) = lower($1)',
    [username],
  );
  const ok = user ? await verifyPassword(password, user.password_hash) : (await verifyDummy(password), false);
  if (!user || !ok) {
    recordFailure(key);
    return { error: 'Wrong username or password' };
  }
  clearFailures(key);
  await startSession(user.id);
  redirect('/');
}

/** First-run only: creates the administrator account, which adopts any existing data. */
export async function setupAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  if ((await countUsers()) > 0) redirect('/login');
  const password = String(fd.get('password') ?? '');
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'The passwords do not match' };
  const err = validatePassword(password);
  if (err) return { error: err };

  let userId: number;
  try {
    const username = fdStr(fd, 'username');
    ({ userId } = await createAccount({
      username,
      password,
      hunterName: fdStr(fd, 'hunterName') || username,
      templateKey: fdStr(fd, 'template') || 'none',
      isAdmin: true,
    }));
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  await startSession(userId);
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect('/login');
}
