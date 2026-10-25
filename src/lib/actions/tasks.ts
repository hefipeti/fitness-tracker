'use server';

import { z } from 'zod';
import { q, q1, tx } from '../db';
import { requireUserId } from '../auth';
import { addXp, removeXp, settle, totalXp } from '../engine';
import { addDays, isValidDate, todayStr } from '../dates';
import { UserError, fdInt, fdStr, guard, reqInt, reqStr, touch } from '../action-utils';
import type { ActionError, GameResult } from '../types';

const repeatSchema = z.enum(['none', 'daily', 'weekly']);

export async function createTaskAction(fd: FormData): Promise<void | ActionError> {
  const uid = await requireUserId();
  return guard(async () => {
    const title = reqStr(fd, 'title', 160);
    const due = fdStr(fd, 'dueDate');
    const repeat = repeatSchema.parse(fdStr(fd, 'repeat') || 'none');
    const xp = Math.min(200, Math.max(0, fdInt(fd, 'xp') ?? 20));
    await q('INSERT INTO tasks (user_id, title, due_date, repeat, xp) VALUES ($1,$2,$3,$4,$5)', [
      uid,
      title,
      isValidDate(due) ? due : null,
      repeat,
      xp,
    ]);
    touch();
  });
}

export async function toggleTaskAction(taskId: number): Promise<GameResult | ActionError> {
  const uid = await requireUserId();
  return guard(async () => {
    const id = z.number().int().positive().parse(taskId);
    const before = await totalXp(uid);
    const today = todayStr();

    await tx(async (c) => {
      const t = await q1<{ title: string; dueDate: string | null; repeat: 'none' | 'daily' | 'weekly'; xp: number; doneAt: string | null }>(
        `SELECT title, due_date AS "dueDate", repeat, xp, done_at AS "doneAt" FROM tasks WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, uid],
        c,
      );
      if (!t) throw new UserError('Task not found');

      if (t.doneAt) {
        await q('UPDATE tasks SET done_at = NULL WHERE id = $1', [id], c);
        await removeXp(uid, 'task', `task:${id}`, c);
        return;
      }

      await q('UPDATE tasks SET done_at = now() WHERE id = $1', [id], c);
      await addXp(uid, 'task', `task:${id}`, `Quest: ${t.title}`, t.xp, today, c);

      if (t.repeat !== 'none') {
        const step = t.repeat === 'daily' ? 1 : 7;
        let next = addDays(t.dueDate ?? today, step);
        while (next <= today) next = addDays(next, step);
        const dup = await q1(
          'SELECT 1 FROM tasks WHERE user_id = $1 AND title = $2 AND due_date = $3 AND done_at IS NULL',
          [uid, t.title, next],
          c,
        );
        if (!dup) {
          await q('INSERT INTO tasks (user_id, title, due_date, repeat, xp) VALUES ($1,$2,$3,$4,$5)', [uid, t.title, next, t.repeat, t.xp], c);
        }
      }
    });

    touch();
    return settle(uid, before);
  });
}

export async function deleteTaskAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  await q('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [reqInt(fd, 'id'), uid]);
  touch();
}
