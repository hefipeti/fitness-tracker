import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSessionRecord, deleteSessionRecord, findSessionUser, type AuthUser } from './auth-core';

export const SESSION_COOKIE = 'fts_session';

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? findSessionUser(token) : null;
});

/** Use at the top of every page and server action: layouts alone do not protect pages. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireUserId(): Promise<number> {
  return (await requireUser()).id;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Administrator only');
  return user;
}

export async function startSession(userId: number): Promise<void> {
  const { token, expiresAt } = await createSessionRecord(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Plain HTTP on a home network: set COOKIE_SECURE=true only when serving over HTTPS.
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSessionRecord(token);
  jar.delete(SESSION_COOKIE);
}
