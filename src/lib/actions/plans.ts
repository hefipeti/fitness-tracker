'use server';

import { redirect } from 'next/navigation';
import { q, q1, tx } from '../db';
import { requireUserId } from '../auth';
import { fdInt, fdNum, fdStr, reqInt, reqStr, touch, uniqueSlug } from '../action-utils';
import { assertExerciseVisible, assertPlan, assertPlanDay, assertPlanExercise } from '../ownership';
import { getTemplate, importTemplate } from '../templates';
import { CATEGORIES, MODES } from '../types';

function weekdayOf(fd: FormData): number | null {
  const w = fdInt(fd, 'weekday');
  return w != null && w >= 1 && w <= 7 ? w : null;
}

// ----- Plans -----

export async function createPlanAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const name = reqStr(fd, 'name', 80);
  const row = await q1<{ id: number }>(
    `INSERT INTO plans (user_id, name, notes, active)
     VALUES ($1, $2, $3, NOT EXISTS (SELECT 1 FROM plans WHERE user_id = $1 AND active)) RETURNING id`,
    [uid, name, fdStr(fd, 'notes').slice(0, 500)],
  );
  touch();
  redirect(`/plans/${row!.id}`);
}

/** Adds a ready-made plan to the signed-in user's plans. It does not change the active plan. */
export async function importTemplateAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const tpl = getTemplate(fdStr(fd, 'template'));
  if (!tpl) throw new Error('Unknown plan template');
  const id = await tx(async (c) => {
    const hasActive = !!(await q1('SELECT 1 FROM plans WHERE user_id = $1 AND active', [uid], c));
    return importTemplate(c, uid, tpl, !hasActive);
  });
  touch();
  redirect(`/plans/${id}`);
}

export async function renamePlanAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  await q('UPDATE plans SET name = $3, notes = $4 WHERE id = $1 AND user_id = $2', [
    reqInt(fd, 'id'),
    uid,
    reqStr(fd, 'name', 80),
    fdStr(fd, 'notes').slice(0, 500),
  ]);
  touch();
}

/** Copy a plan (days + exercises) so a new training block can start from the old one. */
export async function duplicatePlanAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const id = reqInt(fd, 'id');
  const newId = await tx(async (c) => {
    const src = await q1<{ name: string; notes: string; guide: unknown }>(
      'SELECT name, notes, guide FROM plans WHERE id = $1 AND user_id = $2',
      [id, uid],
      c,
    );
    if (!src) throw new Error('Plan not found');
    const copy = await q1<{ id: number }>(
      'INSERT INTO plans (user_id, name, notes, active, guide) VALUES ($1,$2,$3,FALSE,$4) RETURNING id',
      [uid, `${src.name} (copy)`.slice(0, 80), src.notes, src.guide ? JSON.stringify(src.guide) : null],
      c,
    );
    const days = await q<{ id: number; position: number; name: string; weekday: number | null }>(
      'SELECT id, position, name, weekday FROM plan_days WHERE plan_id = $1 ORDER BY position, id',
      [id],
      c,
    );
    for (const d of days) {
      const nd = await q1<{ id: number }>(
        'INSERT INTO plan_days (plan_id, position, name, weekday) VALUES ($1,$2,$3,$4) RETURNING id',
        [copy!.id, d.position, d.name, d.weekday],
        c,
      );
      await q(
        `INSERT INTO plan_exercises (plan_day_id, exercise_id, position, target_sets, target_reps, target_weight, note)
         SELECT $1, exercise_id, position, target_sets, target_reps, target_weight, note
         FROM plan_exercises WHERE plan_day_id = $2`,
        [nd!.id, d.id],
        c,
      );
    }
    return copy!.id;
  });
  touch();
  redirect(`/plans/${newId}`);
}

export async function setActivePlanAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const id = reqInt(fd, 'id');
  await tx(async (c) => {
    await assertPlan(uid, id, c);
    await q('UPDATE plans SET active = FALSE WHERE user_id = $1 AND active', [uid], c);
    await q('UPDATE plans SET active = TRUE WHERE id = $1 AND user_id = $2', [id, uid], c);
  });
  touch();
}

export async function deletePlanAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  await q('DELETE FROM plans WHERE id = $1 AND user_id = $2', [reqInt(fd, 'id'), uid]);
  touch();
  redirect('/plans');
}

// ----- Days -----

export async function addDayAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const planId = reqInt(fd, 'planId');
  await assertPlan(uid, planId);
  await q(
    `INSERT INTO plan_days (plan_id, position, name, weekday)
     VALUES ($1, COALESCE((SELECT max(position) + 1 FROM plan_days WHERE plan_id = $1), 0), $2, $3)`,
    [planId, reqStr(fd, 'name', 80), weekdayOf(fd)],
  );
  touch();
}

export async function updateDayAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const id = reqInt(fd, 'id');
  await assertPlanDay(uid, id);
  await q('UPDATE plan_days SET name = $2, weekday = $3 WHERE id = $1', [id, reqStr(fd, 'name', 80), weekdayOf(fd)]);
  touch();
}

export async function deleteDayAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const id = reqInt(fd, 'id');
  await assertPlanDay(uid, id);
  await q('DELETE FROM plan_days WHERE id = $1', [id]);
  touch();
}

// ----- Plan exercises -----

export async function addPlanExerciseAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const dayId = reqInt(fd, 'dayId');
  const exerciseId = reqInt(fd, 'exerciseId');
  await assertPlanDay(uid, dayId);
  await assertExerciseVisible(uid, exerciseId);
  await q(
    `INSERT INTO plan_exercises (plan_day_id, exercise_id, position, target_sets, target_reps, target_weight, note)
     VALUES ($1, $2, COALESCE((SELECT max(position) + 1 FROM plan_exercises WHERE plan_day_id = $1), 0), $3, $4, $5, $6)`,
    [
      dayId,
      exerciseId,
      Math.min(20, Math.max(1, fdInt(fd, 'sets') ?? 3)),
      Math.min(1000, Math.max(1, fdInt(fd, 'reps') ?? 8)),
      fdNum(fd, 'weight'),
      fdStr(fd, 'note').slice(0, 300),
    ],
  );
  touch();
}

export async function updatePlanExerciseAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const id = reqInt(fd, 'id');
  await assertPlanExercise(uid, id);
  await q(`UPDATE plan_exercises SET target_sets = $2, target_reps = $3, target_weight = $4, note = $5 WHERE id = $1`, [
    id,
    Math.min(20, Math.max(1, fdInt(fd, 'sets') ?? 3)),
    Math.min(1000, Math.max(1, fdInt(fd, 'reps') ?? 8)),
    fdNum(fd, 'weight'),
    fdStr(fd, 'note').slice(0, 300),
  ]);
  touch();
}

export async function deletePlanExerciseAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const id = reqInt(fd, 'id');
  await assertPlanExercise(uid, id);
  await q('DELETE FROM plan_exercises WHERE id = $1', [id]);
  touch();
}

export async function movePlanExerciseAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const id = reqInt(fd, 'id');
  const dir = fdStr(fd, 'dir') === 'up' ? -1 : 1;
  await tx(async (c) => {
    await assertPlanExercise(uid, id, c);
    const cur = await q1<{ plan_day_id: number }>('SELECT plan_day_id FROM plan_exercises WHERE id = $1', [id], c);
    if (!cur) return;
    const rows = await q<{ id: number }>(
      'SELECT id FROM plan_exercises WHERE plan_day_id = $1 ORDER BY position, id FOR UPDATE',
      [cur.plan_day_id],
      c,
    );
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (let p = 0; p < ids.length; p++) {
      await q('UPDATE plan_exercises SET position = $2 WHERE id = $1', [ids[p], p], c);
    }
  });
  touch();
}

// ----- Exercise library (built-ins are shared and read-only; custom ones belong to one account) -----

export async function createExerciseAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const name = reqStr(fd, 'name', 80);
  const category = fdStr(fd, 'category');
  const mode = fdStr(fd, 'mode');
  if (!(CATEGORIES as readonly string[]).includes(category)) throw new Error('Invalid category');
  if (!(MODES as readonly string[]).includes(mode)) throw new Error('Invalid mode');
  const slug = await uniqueSlug(name);
  await q('INSERT INTO exercises (user_id, slug, name, category, mode) VALUES ($1,$2,$3,$4,$5)', [uid, slug, name, category, mode]);
  touch();
}

export async function updateExerciseAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const category = fdStr(fd, 'category');
  if (!(CATEGORIES as readonly string[]).includes(category)) throw new Error('Invalid category');
  // Mode is intentionally immutable: changing it would reinterpret logged history.
  await q('UPDATE exercises SET name = $3, category = $4 WHERE id = $1 AND user_id = $2', [
    reqInt(fd, 'id'),
    uid,
    reqStr(fd, 'name', 80),
    category,
  ]);
  touch();
}

export async function archiveExerciseAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  await q('UPDATE exercises SET archived = NOT archived WHERE id = $1 AND user_id = $2', [reqInt(fd, 'id'), uid]);
  touch();
}
