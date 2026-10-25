'use server';

import { q, q1 } from '../db';
import { requireUserId } from '../auth';
import { addXp, evaluateFoodDay, settle, totalXp } from '../engine';
import { isValidDate, todayStr } from '../dates';
import { WEIGHT_LOG_XP } from '../game';
import { UserError, fdNum, fdStr, guard, reqInt, reqStr, touch } from '../action-utils';
import { MEALS, type ActionError, type GameResult, type Meal } from '../types';

const r1 = (n: number) => Math.round(n * 10) / 10;
const nonNeg = (n: number | null, max = 100000) => Math.min(max, Math.max(0, n ?? 0));

function dateOf(fd: FormData): string {
  const d = fdStr(fd, 'date');
  return isValidDate(d) ? d : todayStr();
}

function mealOf(fd: FormData): Meal {
  const m = fdStr(fd, 'meal');
  if (!(MEALS as readonly string[]).includes(m)) throw new UserError('Invalid meal');
  return m as Meal;
}

// ----- Food library (no XP involved) -----

export async function createFoodAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  await q('INSERT INTO foods (user_id, name, serving_label, kcal, protein, carbs, fat) VALUES ($1,$2,$3,$4,$5,$6,$7)', [
    uid,
    reqStr(fd, 'name', 120),
    fdStr(fd, 'servingLabel').slice(0, 40) || '100 g',
    nonNeg(fdNum(fd, 'kcal'), 5000),
    nonNeg(fdNum(fd, 'protein'), 500),
    nonNeg(fdNum(fd, 'carbs'), 1000),
    nonNeg(fdNum(fd, 'fat'), 500),
  ]);
  touch();
}

export async function updateFoodAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  await q(
    `UPDATE foods SET name = $3, serving_label = $4, kcal = $5, protein = $6, carbs = $7, fat = $8
     WHERE id = $1 AND user_id = $2`,
    [
      reqInt(fd, 'id'),
      uid,
      reqStr(fd, 'name', 120),
      fdStr(fd, 'servingLabel').slice(0, 40) || '100 g',
      nonNeg(fdNum(fd, 'kcal'), 5000),
      nonNeg(fdNum(fd, 'protein'), 500),
      nonNeg(fdNum(fd, 'carbs'), 1000),
      nonNeg(fdNum(fd, 'fat'), 500),
    ],
  );
  touch();
}

export async function archiveFoodAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  await q('UPDATE foods SET archived = NOT archived WHERE id = $1 AND user_id = $2', [reqInt(fd, 'id'), uid]);
  touch();
}

// ----- Logging (can award daily nutrition XP) -----

export async function logFoodAction(fd: FormData): Promise<GameResult | ActionError> {
  const uid = await requireUserId();
  return guard(async () => {
    const date = dateOf(fd);
    const meal = mealOf(fd);
    const foodId = reqInt(fd, 'foodId');
    const servings = Math.min(100, Math.max(0.05, fdNum(fd, 'servings') ?? 1));
    const food = await q1<{ name: string; kcal: number; protein: number; carbs: number; fat: number }>(
      'SELECT name, kcal, protein, carbs, fat FROM foods WHERE id = $1 AND user_id = $2',
      [foodId, uid],
    );
    if (!food) throw new UserError('Food not found');

    const before = await totalXp(uid);
    await q(
      `INSERT INTO food_logs (user_id, log_date, meal, food_id, name, servings, kcal, protein, carbs, fat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [uid, date, meal, foodId, food.name, servings, r1(food.kcal * servings), r1(food.protein * servings), r1(food.carbs * servings), r1(food.fat * servings)],
    );
    await evaluateFoodDay(uid, date);
    touch();
    return settle(uid, before);
  });
}

export async function quickLogAction(fd: FormData): Promise<GameResult | ActionError> {
  const uid = await requireUserId();
  return guard(async () => {
    const date = dateOf(fd);
    const before = await totalXp(uid);
    await q(
      `INSERT INTO food_logs (user_id, log_date, meal, food_id, name, servings, kcal, protein, carbs, fat)
       VALUES ($1,$2,$3,NULL,$4,1,$5,$6,$7,$8)`,
      [
        uid,
        date,
        mealOf(fd),
        reqStr(fd, 'name', 120),
        nonNeg(fdNum(fd, 'kcal'), 10000),
        nonNeg(fdNum(fd, 'protein'), 1000),
        nonNeg(fdNum(fd, 'carbs'), 2000),
        nonNeg(fdNum(fd, 'fat'), 1000),
      ],
    );
    await evaluateFoodDay(uid, date);
    touch();
    return settle(uid, before);
  });
}

export async function deleteFoodLogAction(logId: number): Promise<GameResult | ActionError> {
  const uid = await requireUserId();
  return guard(async () => {
    const before = await totalXp(uid);
    const row = await q1<{ log_date: string }>('DELETE FROM food_logs WHERE id = $1 AND user_id = $2 RETURNING log_date', [logId, uid]);
    if (row) await evaluateFoodDay(uid, row.log_date);
    touch();
    return settle(uid, before);
  });
}

// ----- Body weight -----

export async function logWeightAction(fd: FormData): Promise<GameResult | ActionError> {
  const uid = await requireUserId();
  return guard(async () => {
    const date = dateOf(fd);
    const kg = fdNum(fd, 'kg');
    if (kg == null || kg < 20 || kg > 400) throw new UserError('Enter a weight between 20 and 400 kg');
    const before = await totalXp(uid);
    await q(
      `INSERT INTO body_weights (user_id, log_date, kg) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, log_date) DO UPDATE SET kg = EXCLUDED.kg`,
      [uid, date, Math.round(kg * 10) / 10],
    );
    await addXp(uid, 'weight', date, `Weigh-in: ${kg} kg`, WEIGHT_LOG_XP, date);
    touch();
    return settle(uid, before);
  });
}

export async function deleteWeightAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const date = fdStr(fd, 'date');
  if (isValidDate(date)) await q('DELETE FROM body_weights WHERE user_id = $1 AND log_date = $2', [uid, date]);
  touch();
}
