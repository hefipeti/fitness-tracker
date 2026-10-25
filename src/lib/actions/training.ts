'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { q, q1, tx } from '../db';
import { requireUserId } from '../auth';
import { addXp, removeXp, settle, totalXp } from '../engine';
import { isValidDate, todayStr } from '../dates';
import { PR_MAX, setScore, sessionXp } from '../game';
import { UserError, fdInt, fdStr, guard, reqInt, touch } from '../action-utils';
import { assertExerciseVisible } from '../ownership';
import type { ActionError, GameResult } from '../types';

export async function startSessionAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const rawDate = fdStr(fd, 'date');
  const date = isValidDate(rawDate) ? rawDate : todayStr();
  const planDayId = fdInt(fd, 'planDayId');
  const freeName = fdStr(fd, 'name').slice(0, 80) || 'Free workout';

  const id = await tx(async (c) => {
    if (planDayId != null) {
      const day = await q1<{ id: number; name: string }>(
        'SELECT d.id, d.name FROM plan_days d JOIN plans p ON p.id = d.plan_id WHERE d.id = $1 AND p.user_id = $2',
        [planDayId, uid],
        c,
      );
      if (!day) throw new Error('Plan day not found');
      const existing = await q1<{ id: number }>(
        `SELECT id FROM sessions WHERE user_id = $1 AND plan_day_id = $2 AND session_date = $3 AND completed_at IS NULL
         ORDER BY id LIMIT 1`,
        [uid, planDayId, date],
        c,
      );
      if (existing) return existing.id;
      const s = await q1<{ id: number }>(
        'INSERT INTO sessions (user_id, session_date, name, plan_day_id) VALUES ($1,$2,$3,$4) RETURNING id',
        [uid, date, day.name, planDayId],
        c,
      );
      await q(
        `INSERT INTO session_exercises (session_id, exercise_id, position, target_sets, target_reps, target_weight)
         SELECT $1, exercise_id, position, target_sets, target_reps, target_weight
         FROM plan_exercises WHERE plan_day_id = $2 ORDER BY position, id`,
        [s!.id, planDayId],
        c,
      );
      return s!.id;
    }
    const s = await q1<{ id: number }>(
      'INSERT INTO sessions (user_id, session_date, name) VALUES ($1,$2,$3) RETURNING id',
      [uid, date, freeName],
      c,
    );
    return s!.id;
  });

  touch();
  redirect(`/training/${id}`);
}

const logSetSchema = z.object({
  sessionId: z.number().int().positive(),
  exerciseId: z.number().int().positive(),
  setNo: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(1000).nullable(),
  seconds: z.number().int().min(0).max(36000).nullable(),
  weightKg: z.number().min(0).max(1000).nullable(),
});

export async function logSetAction(input: z.input<typeof logSetSchema>): Promise<void | ActionError> {
  const uid = await requireUserId();
  return guard(async () => {
    const v = logSetSchema.parse(input);
    await tx(async (c) => {
      const s = await q1<{ completed_at: string | null }>(
        'SELECT completed_at FROM sessions WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [v.sessionId, uid],
        c,
      );
      if (!s) throw new UserError('Session not found');
      if (s.completed_at) throw new UserError('This session is already completed');
      await assertExerciseVisible(uid, v.exerciseId, c);
      await q(
        `INSERT INTO session_sets (session_id, exercise_id, set_no, reps, seconds, weight_kg)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (session_id, exercise_id, set_no)
         DO UPDATE SET reps = EXCLUDED.reps, seconds = EXCLUDED.seconds, weight_kg = EXCLUDED.weight_kg`,
        [v.sessionId, v.exerciseId, v.setNo, v.reps, v.seconds, v.weightKg],
        c,
      );
    });
  });
}

export async function removeSetAction(input: { sessionId: number; exerciseId: number; setNo: number }): Promise<void | ActionError> {
  const uid = await requireUserId();
  return guard(async () => {
    const v = z.object({ sessionId: z.number().int(), exerciseId: z.number().int(), setNo: z.number().int() }).parse(input);
    await q(
      `DELETE FROM session_sets WHERE session_id = $1 AND exercise_id = $2 AND set_no = $3
         AND EXISTS (SELECT 1 FROM sessions WHERE id = $1 AND user_id = $4 AND completed_at IS NULL)`,
      [v.sessionId, v.exerciseId, v.setNo, uid],
    );
  });
}

export async function addSessionExerciseAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const sessionId = reqInt(fd, 'sessionId');
  const exerciseId = reqInt(fd, 'exerciseId');
  const sets = Math.min(20, Math.max(1, fdInt(fd, 'sets') ?? 3));
  const reps = Math.min(1000, Math.max(1, fdInt(fd, 'reps') ?? 8));
  await tx(async (c) => {
    const s = await q1<{ completed_at: string | null }>(
      'SELECT completed_at FROM sessions WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [sessionId, uid],
      c,
    );
    if (!s || s.completed_at) throw new Error('Session not editable');
    await assertExerciseVisible(uid, exerciseId, c);
    const dup = await q1('SELECT 1 FROM session_exercises WHERE session_id = $1 AND exercise_id = $2', [sessionId, exerciseId], c);
    if (dup) return;
    await q(
      `INSERT INTO session_exercises (session_id, exercise_id, position, target_sets, target_reps)
       VALUES ($1, $2, COALESCE((SELECT max(position) + 1 FROM session_exercises WHERE session_id = $1), 0), $3, $4)`,
      [sessionId, exerciseId, sets, reps],
      c,
    );
  });
  touch();
}

export async function removeSessionExerciseAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const sessionId = reqInt(fd, 'sessionId');
  const exerciseId = reqInt(fd, 'exerciseId');
  await tx(async (c) => {
    const s = await q1<{ completed_at: string | null }>(
      'SELECT completed_at FROM sessions WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [sessionId, uid],
      c,
    );
    if (!s || s.completed_at) throw new Error('Session not editable');
    await q('DELETE FROM session_sets WHERE session_id = $1 AND exercise_id = $2', [sessionId, exerciseId], c);
    await q('DELETE FROM session_exercises WHERE session_id = $1 AND exercise_id = $2', [sessionId, exerciseId], c);
  });
  touch();
}

interface SetRow {
  exerciseId: number;
  mode: string;
  reps: number | null;
  seconds: number | null;
  weightKg: number | null;
}

export async function completeSessionAction(sessionId: number): Promise<GameResult | ActionError> {
  const uid = await requireUserId();
  return guard(async () => {
    const id = z.number().int().positive().parse(sessionId);
    const before = await totalXp(uid);

    await tx(async (c) => {
      const s = await q1<{ name: string; date: string; completed_at: string | null }>(
        'SELECT name, session_date AS date, completed_at FROM sessions WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, uid],
        c,
      );
      if (!s) throw new UserError('Session not found');
      if (s.completed_at) return;

      const sets = await q<SetRow>(
        `SELECT s.exercise_id AS "exerciseId", ex.mode, s.reps, s.seconds, s.weight_kg AS "weightKg"
         FROM session_sets s JOIN exercises ex ON ex.id = s.exercise_id WHERE s.session_id = $1`,
        [id],
        c,
      );
      if (sets.length === 0) throw new UserError('Log at least one set before completing the session');

      const exIds = [...new Set(sets.map((x) => x.exerciseId))];
      const prior = await q<SetRow>(
        `SELECT s.exercise_id AS "exerciseId", ex.mode, s.reps, s.seconds, s.weight_kg AS "weightKg"
         FROM session_sets s
         JOIN sessions se ON se.id = s.session_id AND se.user_id = $3 AND se.completed_at IS NOT NULL AND se.id <> $1
         JOIN exercises ex ON ex.id = s.exercise_id
         WHERE s.exercise_id = ANY($2::int[])`,
        [id, exIds, uid],
        c,
      );

      const best = (rows: SetRow[]) => {
        const m = new Map<number, number>();
        for (const r of rows) m.set(r.exerciseId, Math.max(m.get(r.exerciseId) ?? 0, setScore(r.mode, r)));
        return m;
      };
      const now = best(sets);
      const was = best(prior);
      let prs = 0;
      for (const [exId, score] of now) {
        const prev = was.get(exId) ?? 0;
        if (prev > 0 && score > prev) prs++;
      }

      const xp = sessionXp(sets.length, Math.min(prs, PR_MAX));
      await q('UPDATE sessions SET completed_at = now() WHERE id = $1', [id], c);
      await addXp(uid, 'workout', `session:${id}`, `Workout: ${s.name}${prs ? ` (${prs} PR${prs > 1 ? 's' : ''})` : ''}`, xp, s.date, c);
    });

    touch();
    return settle(uid, before);
  });
}

export async function deleteSessionAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const id = reqInt(fd, 'sessionId');
  await tx(async (c) => {
    const del = await q('DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id', [id, uid], c);
    if (del.length > 0) await removeXp(uid, 'workout', `session:${id}`, c);
  });
  touch();
  redirect('/training');
}
