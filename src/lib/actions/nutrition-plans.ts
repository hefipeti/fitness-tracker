'use server';

import { q, q1, tx } from '../db';
import { requireUserId } from '../auth';
import { UserError, fdInt, fdNum, fdStr, guard, reqInt, reqStr, touch } from '../action-utils';
import { assertFoodVisible, assertNutritionPlan, assertPrepSession } from '../ownership';
import { isValidDate, isoWeekday } from '../dates';
import { MEALS } from '../types';
import type { ActionError } from '../types';

const round1dp = (n: number) => Math.round(n * 10) / 10;

function requireWeekday(fd: FormData, key: string): number {
  const weekday = reqInt(fd, key);
  if (weekday < 1 || weekday > 7) throw new UserError('Invalid weekday');
  return weekday;
}

function clampServings(fd: FormData): number {
  return Math.min(100, Math.max(0.05, fdNum(fd, 'servings') ?? 1));
}

export async function createNutritionPlanAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    await q('INSERT INTO nutrition_plans (user_id, name) VALUES ($1,$2)', [uid, reqStr(fd, 'name', 120)]);
    touch();
  });
}

export async function updateNutritionPlanAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const planId = reqInt(fd, 'id');
    await assertNutritionPlan(uid, planId);
    await q('UPDATE nutrition_plans SET name = $3 WHERE id = $1 AND user_id = $2', [planId, uid, reqStr(fd, 'name', 120)]);
    touch();
  });
}

export async function deleteNutritionPlanAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const planId = reqInt(fd, 'id');
    await assertNutritionPlan(uid, planId);
    await tx(async (c) => {
      await q(
        `UPDATE nutrition_plan_prep_foods SET deleted_at = now()
         WHERE deleted_at IS NULL AND prep_session_id IN (SELECT id FROM nutrition_plan_prep_sessions WHERE plan_id = $1)`,
        [planId], c,
      );
      await q('UPDATE nutrition_plan_prep_sessions SET deleted_at = now() WHERE plan_id = $1 AND deleted_at IS NULL', [planId], c);
      await q('UPDATE nutrition_plan_day_meals SET deleted_at = now() WHERE plan_id = $1 AND deleted_at IS NULL', [planId], c);
      await q('UPDATE nutrition_plans SET deleted_at = now(), active = FALSE WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [planId, uid], c);
    });
    touch();
  });
}

export async function activateNutritionPlanAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const planId = reqInt(fd, 'id');
    await assertNutritionPlan(uid, planId);
    await q('UPDATE nutrition_plans SET active = FALSE WHERE user_id = $1', [uid]);
    await q('UPDATE nutrition_plans SET active = TRUE WHERE id = $1 AND user_id = $2', [planId, uid]);
    touch();
  });
}

export async function createPrepSessionAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const planId = reqInt(fd, 'planId');
    await assertNutritionPlan(uid, planId);
    const weekday = requireWeekday(fd, 'cookWeekday');
    await q(
      'INSERT INTO nutrition_plan_prep_sessions (plan_id, user_id, name, cook_weekday, notes) VALUES ($1,$2,$3,$4,$5)',
      [planId, uid, reqStr(fd, 'name', 120), weekday, fdStr(fd, 'notes').slice(0, 2000)],
    );
    touch();
  });
}

export async function updatePrepSessionAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const sessionId = reqInt(fd, 'id');
    await assertPrepSession(uid, sessionId);
    const weekday = requireWeekday(fd, 'cookWeekday');
    await q(
      'UPDATE nutrition_plan_prep_sessions SET name = $3, cook_weekday = $4, notes = $5 WHERE id = $1 AND user_id = $2',
      [sessionId, uid, reqStr(fd, 'name', 120), weekday, fdStr(fd, 'notes').slice(0, 2000)],
    );
    touch();
  });
}

export async function deletePrepSessionAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const sessionId = reqInt(fd, 'id');
    await assertPrepSession(uid, sessionId);
    await tx(async (c) => {
      await q('UPDATE nutrition_plan_prep_foods SET deleted_at = now() WHERE prep_session_id = $1 AND deleted_at IS NULL', [sessionId], c);
      await q('UPDATE nutrition_plan_prep_sessions SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', [sessionId], c);
    });
    touch();
  });
}

export async function addPrepFoodAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const sessionId = reqInt(fd, 'prepSessionId');
    await assertPrepSession(uid, sessionId);
    const foodId = reqInt(fd, 'foodId');
    await assertFoodVisible(uid, foodId);
    const servings = clampServings(fd);
    await q(
      'INSERT INTO nutrition_plan_prep_foods (prep_session_id, food_id, servings) VALUES ($1,$2,$3)',
      [sessionId, foodId, servings],
    );
    touch();
  });
}

export async function removePrepFoodAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const id = reqInt(fd, 'id');
    const row = await q1(
      `SELECT 1 FROM nutrition_plan_prep_foods pf
       JOIN nutrition_plan_prep_sessions s ON s.id = pf.prep_session_id
       JOIN nutrition_plans p ON p.id = s.plan_id
       WHERE pf.id = $1 AND p.user_id = $2 AND pf.deleted_at IS NULL AND s.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id, uid],
    );
    if (!row) throw new UserError('Prep food not found');
    await q('UPDATE nutrition_plan_prep_foods SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', [id]);
    touch();
  });
}

export async function addPlannedMealAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const planId = reqInt(fd, 'planId');
    await assertNutritionPlan(uid, planId);
    const weekday = requireWeekday(fd, 'weekday');
    const meal = fdStr(fd, 'meal');
    if (!(MEALS as readonly string[]).includes(meal)) throw new UserError('Invalid meal');
    const foodId = reqInt(fd, 'foodId');
    await assertFoodVisible(uid, foodId);
    const servings = clampServings(fd);
    const prepSessionIdRaw = fdInt(fd, 'prepSessionId');
    if (prepSessionIdRaw != null) await assertPrepSession(uid, prepSessionIdRaw);
    await q(
      `INSERT INTO nutrition_plan_day_meals (plan_id, user_id, weekday, meal, food_id, servings, prep_session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [planId, uid, weekday, meal, foodId, servings, prepSessionIdRaw],
    );
    touch();
  });
}

export async function removePlannedMealAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const id = reqInt(fd, 'id');
    const row = await q1('UPDATE nutrition_plan_day_meals SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id', [id, uid]);
    if (!row) throw new UserError('Planned meal not found');
    touch();
  });
}

export async function addPrepIngredientAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const sessionId = reqInt(fd, 'prepSessionId');
    await assertPrepSession(uid, sessionId);
    const name = reqStr(fd, 'name', 200);
    const unit = fdStr(fd, 'unit').slice(0, 50);
    await q(
      'INSERT INTO nutrition_plan_prep_ingredients (prep_session_id, user_id, name, unit) VALUES ($1,$2,$3,$4)',
      [sessionId, uid, name, unit],
    );
    touch();
  });
}

export async function removePrepIngredientAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const id = reqInt(fd, 'id');
    const row = await q1(
      `SELECT 1 FROM nutrition_plan_prep_ingredients pi
       JOIN nutrition_plan_prep_sessions s ON s.id = pi.prep_session_id
       WHERE pi.id = $1 AND pi.user_id = $2 AND pi.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [id, uid],
    );
    if (!row) throw new UserError('Ingredient not found');
    await q('UPDATE nutrition_plan_prep_ingredients SET deleted_at = now() WHERE id = $1', [id]);
    touch();
  });
}

export async function addShoppingItemAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const planId = reqInt(fd, 'planId');
    await assertNutritionPlan(uid, planId);
    const name = reqStr(fd, 'name', 200);
    const quantity = fdStr(fd, 'quantity').slice(0, 100);
    await q(
      'INSERT INTO nutrition_plan_shopping_items (plan_id, user_id, name, quantity) VALUES ($1,$2,$3,$4)',
      [planId, uid, name, quantity],
    );
    touch();
  });
}

export async function removeShoppingItemAction(fd: FormData): Promise<ActionError | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const id = reqInt(fd, 'id');
    const row = await q1(
      'UPDATE nutrition_plan_shopping_items SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
      [id, uid],
    );
    if (!row) throw new UserError('Shopping item not found');
    touch();
  });
}

// Returns {conflict: true} when the day already has food logs and no mode is given.
// mode 'append' adds on top of existing logs; mode 'replace' clears the day first.
export async function importPlanDayAction(fd: FormData): Promise<ActionError | { conflict: true } | void> {
  const uid = await requireUserId();
  return guard(async () => {
    const dateRaw = fdStr(fd, 'date');
    if (!isValidDate(dateRaw)) throw new UserError('Invalid date');
    const date = dateRaw;
    const mode = fdStr(fd, 'mode');
    const weekday = isoWeekday(date);

    const plan = await q1<{ id: number }>('SELECT id FROM nutrition_plans WHERE user_id = $1 AND active = TRUE AND deleted_at IS NULL', [uid]);
    if (!plan) throw new UserError('No active nutrition plan');

    const existing = await q1<{ c: number }>(
      'SELECT count(*)::int AS c FROM food_logs WHERE user_id = $1 AND log_date = $2 AND deleted_at IS NULL',
      [uid, date],
    );
    if ((existing?.c ?? 0) > 0 && !mode) return { conflict: true } as { conflict: true };

    const meals = await q<{ meal: string; foodId: number; name: string; servings: number; kcal: number; protein: number; carbs: number; fat: number }>(
      `SELECT dm.meal, dm.food_id AS "foodId", f.name, dm.servings::float AS servings,
              f.kcal::float AS kcal, f.protein::float AS protein,
              f.carbs::float AS carbs, f.fat::float AS fat
       FROM nutrition_plan_day_meals dm
       JOIN foods f ON f.id = dm.food_id
       WHERE dm.plan_id = $1 AND dm.weekday = $2 AND dm.deleted_at IS NULL`,
      [plan.id, weekday],
    );

    if (mode === 'replace') {
      await q('UPDATE food_logs SET deleted_at = now() WHERE user_id = $1 AND log_date = $2 AND deleted_at IS NULL', [uid, date]);
    }

    for (const m of meals) {
      await q(
        `INSERT INTO food_logs (user_id, log_date, meal, food_id, name, servings, kcal, protein, carbs, fat)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [uid, date, m.meal, m.foodId, m.name, m.servings, round1dp(m.kcal * m.servings), round1dp(m.protein * m.servings), round1dp(m.carbs * m.servings), round1dp(m.fat * m.servings)],
      );
    }
    touch();
  });
}
