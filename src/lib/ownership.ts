import { q1, type Queryable } from './db';
import { UserError } from './action-utils';

/**
 * Ownership checks. Every action that receives an id from the client must call one of these
 * (or filter by user_id in SQL) so one account can never touch another account's rows.
 */

export async function assertPlan(uid: number, planId: number, c?: Queryable): Promise<void> {
  if (!(await q1('SELECT 1 FROM plans WHERE id = $1 AND user_id = $2', [planId, uid], c))) throw new UserError('Plan not found');
}

export async function assertPlanDay(uid: number, dayId: number, c?: Queryable): Promise<void> {
  const row = await q1(
    'SELECT 1 FROM plan_days d JOIN plans p ON p.id = d.plan_id WHERE d.id = $1 AND p.user_id = $2',
    [dayId, uid],
    c,
  );
  if (!row) throw new UserError('Training day not found');
}

export async function assertPlanExercise(uid: number, id: number, c?: Queryable): Promise<void> {
  const row = await q1(
    `SELECT 1 FROM plan_exercises e JOIN plan_days d ON d.id = e.plan_day_id JOIN plans p ON p.id = d.plan_id
     WHERE e.id = $1 AND p.user_id = $2`,
    [id, uid],
    c,
  );
  if (!row) throw new UserError('Plan exercise not found');
}

export async function assertExerciseVisible(uid: number, exerciseId: number, c?: Queryable): Promise<void> {
  const row = await q1(
    'SELECT 1 FROM exercises WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
    [exerciseId, uid],
    c,
  );
  if (!row) throw new UserError('Exercise not found');
}
