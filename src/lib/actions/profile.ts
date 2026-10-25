'use server';

import { q, q1 } from '../db';
import { requireUser, requireUserId, startSession } from '../auth';
import { deleteUserSessions, hashPassword, validatePassword, verifyPassword } from '../auth-core';
import { createAccount } from '../users';
import { UserError, fdInt, fdNum, fdStr, guard, reqInt, reqStr, touch } from '../action-utils';
import type { ActionError, ActionNote } from '../types';

const clampInt = (n: number | null, min: number, max: number, fallback: number) =>
  n == null ? fallback : Math.min(max, Math.max(min, n));

export async function updateSettingsAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const start = fdNum(fd, 'startWeight');
  const goal = fdNum(fd, 'goalWeight');
  const height = fdInt(fd, 'heightCm');
  await q(
    `UPDATE settings SET hunter_name = $2, kcal_target = $3, protein_target = $4, carbs_target = $5, fat_target = $6,
            start_weight = $7, goal_weight = $8, height_cm = $9 WHERE user_id = $1`,
    [
      uid,
      reqStr(fd, 'hunterName', 40),
      clampInt(fdInt(fd, 'kcalTarget'), 500, 10000, 2300),
      clampInt(fdInt(fd, 'proteinTarget'), 0, 600, 160),
      clampInt(fdInt(fd, 'carbsTarget'), 0, 1500, 250),
      clampInt(fdInt(fd, 'fatTarget'), 0, 500, 70),
      start != null && start >= 20 && start <= 400 ? start : null,
      goal != null && goal >= 20 && goal <= 400 ? goal : null,
      height != null && height >= 80 && height <= 260 ? height : null,
    ],
  );
  touch();
}

export async function changePasswordAction(fd: FormData): Promise<ActionNote | ActionError> {
  const user = await requireUser();
  return guard(async () => {
    const current = String(fd.get('current') ?? '');
    const next = String(fd.get('next') ?? '');
    const confirm = String(fd.get('confirm') ?? '');
    if (next !== confirm) throw new UserError('The new passwords do not match');
    const err = validatePassword(next);
    if (err) throw new UserError(err);

    const row = await q1<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    if (!row || !(await verifyPassword(current, row.password_hash))) throw new UserError('Current password is incorrect');

    await q('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, await hashPassword(next)]);
    await deleteUserSessions(user.id); // sign out every other device
    await startSession(user.id);
    return { note: 'Password changed. Other devices were signed out.' };
  });
}

// ----- Account administration (first account is the administrator) -----

export async function createAccountAction(fd: FormData): Promise<ActionNote | ActionError> {
  const admin = await requireUser();
  return guard(async () => {
    if (!admin.isAdmin) throw new UserError('Only the administrator can add accounts');
    const username = fdStr(fd, 'username');
    await createAccount({
      username,
      password: String(fd.get('password') ?? ''),
      hunterName: fdStr(fd, 'hunterName') || username,
      templateKey: fdStr(fd, 'template') || 'starter',
      isAdmin: false,
    });
    touch();
    return { note: `Account "${username}" created. They can sign in now.` };
  });
}

export async function resetPasswordAction(fd: FormData): Promise<ActionNote | ActionError> {
  const admin = await requireUser();
  return guard(async () => {
    if (!admin.isAdmin) throw new UserError('Only the administrator can reset passwords');
    const id = reqInt(fd, 'userId');
    const next = String(fd.get('password') ?? '');
    const err = validatePassword(next);
    if (err) throw new UserError(err);
    const hash = await hashPassword(next);
    const updated = await q('UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING id', [id, hash]);
    if (updated.length === 0) throw new UserError('Account not found');
    await deleteUserSessions(id);
    if (id === admin.id) await startSession(id);
    return { note: 'Password reset. That account was signed out everywhere.' };
  });
}
