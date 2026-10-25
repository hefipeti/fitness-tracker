import { q, q1, type Queryable } from './db';
import {
  FOOD_DAY_XP,
  computeStreak,
  foodGoalMet,
  levelInfo,
  newlyUnlocked,
  rankFor,
  type Aggregate,
  type DayTotals,
  type ExerciseAgg,
} from './game';
import { addDays, todayStr } from './dates';
import { getSettings } from './settings';
import type { GameResult } from './types';

export async function totalXp(uid: number, c?: Queryable): Promise<number> {
  const r = await q1<{ t: number }>('SELECT COALESCE(SUM(xp), 0)::int AS t FROM xp_events WHERE user_id = $1', [uid], c);
  return r?.t ?? 0;
}

/** Idempotent: (user, source, ref) is unique, so re-awarding the same event is a no-op. */
export async function addXp(
  uid: number,
  source: string,
  ref: string | null,
  label: string,
  xp: number,
  date: string,
  c?: Queryable,
): Promise<boolean> {
  const rows = await q(
    `INSERT INTO xp_events (user_id, event_date, source, ref, label, xp) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, source, ref) DO NOTHING RETURNING id`,
    [uid, date, source, ref, label, xp],
    c,
  );
  return rows.length > 0;
}

export async function removeXp(uid: number, source: string, ref: string, c?: Queryable): Promise<void> {
  await q('DELETE FROM xp_events WHERE user_id = $1 AND source = $2 AND ref = $3', [uid, source, ref], c);
}

export async function getAggregate(uid: number): Promise<Aggregate> {
  const today = todayStr();
  const [sess, weekBest, ex, food, tasks, active, settings, wt, xp] = await Promise.all([
    q1<{ c: number }>('SELECT count(*)::int AS c FROM sessions WHERE user_id = $1 AND completed_at IS NOT NULL', [uid]),
    q1<{ m: number }>(
      `SELECT COALESCE(max(c), 0)::int AS m FROM
         (SELECT count(*) AS c FROM sessions WHERE user_id = $1 AND completed_at IS NOT NULL
          GROUP BY date_trunc('week', session_date)) t`,
      [uid],
    ),
    q<ExerciseAgg>(
      `SELECT ex.slug, ex.category, ex.mode,
              count(*)::int AS sets,
              COALESCE(sum(s.reps), 0)::int AS reps,
              COALESCE(sum(s.seconds), 0)::int AS seconds,
              COALESCE(sum(s.weight_kg * s.reps) FILTER (WHERE ex.mode = 'weighted'), 0)::numeric AS "volumeKg",
              COALESCE(max(s.reps), 0)::int AS "maxReps",
              COALESCE(max(s.seconds), 0)::int AS "maxSeconds"
       FROM session_sets s
       JOIN sessions se ON se.id = s.session_id AND se.completed_at IS NOT NULL AND se.user_id = $1
       JOIN exercises ex ON ex.id = s.exercise_id
       GROUP BY ex.slug, ex.category, ex.mode`,
      [uid],
    ),
    q1<{ c: number }>("SELECT count(*)::int AS c FROM xp_events WHERE user_id = $1 AND source = 'food'", [uid]),
    q1<{ c: number }>('SELECT count(*)::int AS c FROM tasks WHERE user_id = $1 AND done_at IS NOT NULL', [uid]),
    q<{ d: string }>(
      `SELECT d FROM (
         SELECT session_date AS d FROM sessions WHERE user_id = $1 AND completed_at IS NOT NULL
         UNION SELECT log_date FROM food_logs WHERE user_id = $1
       ) t ORDER BY d DESC LIMIT 400`,
      [uid],
    ),
    getSettings(uid),
    q1<{ mn: number | null; first: number | null }>(
      `SELECT min(kg) AS mn,
              (SELECT kg FROM body_weights WHERE user_id = $1 ORDER BY log_date LIMIT 1) AS first
       FROM body_weights WHERE user_id = $1`,
      [uid],
    ),
    totalXp(uid),
  ]);

  return {
    sessions: sess?.c ?? 0,
    bestWeekSessions: weekBest?.m ?? 0,
    exercises: ex,
    foodGoalDays: food?.c ?? 0,
    tasksDone: tasks?.c ?? 0,
    activeStreak: computeStreak(
      active.map((r) => r.d),
      today,
      (d) => addDays(d, -1),
    ),
    startWeight: settings.startWeight ?? wt?.first ?? null,
    goalWeight: settings.goalWeight,
    minWeight: wt?.mn ?? null,
    level: levelInfo(xp).level,
    nutritionPlanWeeksDone: 0,
  };
}

/**
 * Evaluate achievements (awarding their XP) and report what changed since `before`.
 * Loops because achievement XP can itself unlock level achievements.
 */
export async function settle(uid: number, before: number): Promise<GameResult> {
  const unlockedNow: GameResult['achievements'] = [];
  for (let i = 0; i < 4; i++) {
    const agg = await getAggregate(uid);
    const have = new Set((await q<{ key: string }>('SELECT key FROM achievements WHERE user_id = $1', [uid])).map((r) => r.key));
    const fresh = newlyUnlocked(agg, have);
    if (fresh.length === 0) break;
    for (const d of fresh) {
      const ins = await q(
        'INSERT INTO achievements (user_id, key) VALUES ($1,$2) ON CONFLICT (user_id, key) DO NOTHING RETURNING key',
        [uid, d.key],
      );
      if (ins.length > 0) {
        await addXp(uid, 'achievement', d.key, `Achievement: ${d.name}`, d.xp, todayStr());
        unlockedNow.push({ key: d.key, name: d.name, xp: d.xp });
      }
    }
  }
  const after = await totalXp(uid);
  const lb = levelInfo(before).level;
  const la = levelInfo(after).level;
  const rb = rankFor(lb).letter;
  const ra = rankFor(la).letter;
  return {
    gained: after - before,
    level: la,
    leveledUp: la > lb,
    rank: ra,
    rankedUp: la > lb && ra !== rb,
    achievements: unlockedNow,
  };
}

/** Award or revoke the daily nutrition XP for `date` based on current logs. */
export async function evaluateFoodDay(uid: number, date: string): Promise<void> {
  const [t, s] = await Promise.all([
    q1<DayTotals>(
      `SELECT COALESCE(sum(kcal),0)::numeric AS kcal, COALESCE(sum(protein),0)::numeric AS protein,
              COALESCE(sum(carbs),0)::numeric AS carbs, COALESCE(sum(fat),0)::numeric AS fat
       FROM food_logs WHERE user_id = $1 AND log_date = $2`,
      [uid, date],
    ),
    getSettings(uid),
  ]);
  const totals = t ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const met = foodGoalMet(totals, {
    kcal: s.kcalTarget,
    protein: s.proteinTarget,
    carbs: s.carbsTarget,
    fat: s.fatTarget,
  });
  if (met) await addXp(uid, 'food', date, `Nutrition targets met (${date})`, FOOD_DAY_XP, date);
  else await removeXp(uid, 'food', date);
}
