import { q, q1 } from './db';
import { getAggregate, totalXp } from './engine';
import {
  ACHIEVEMENTS,
  computeStats,
  levelInfo,
  nextRank,
  rankFor,
  type LevelInfo,
  type Rank,
  type SetLike,
  type Stats,
} from './game';
import { addDays, isoWeekday, mondayOf, todayStr } from './dates';
import { getSettings } from './settings';
import type { GuideSection } from './templates';
import type { Category, Meal, Mode } from './types';

// Every function takes the signed-in user's id and filters on it. Never query user data without it.

// ---------- Hunter ----------

export interface HunterLite extends LevelInfo {
  name: string;
  totalXp: number;
  rank: Rank;
}

export async function getHunterLite(uid: number): Promise<HunterLite> {
  const [xp, s] = await Promise.all([totalXp(uid), getSettings(uid)]);
  const li = levelInfo(xp);
  return { ...li, name: s.hunterName, totalXp: xp, rank: rankFor(li.level) };
}

export interface HunterFull extends HunterLite {
  next: Rank | null;
  stats: Stats;
  streak: number;
  sessions: number;
  foodGoalDays: number;
}

export async function getHunterFull(uid: number): Promise<HunterFull> {
  const [lite, agg] = await Promise.all([getHunterLite(uid), getAggregate(uid)]);
  return {
    ...lite,
    next: nextRank(lite.level),
    stats: computeStats(agg),
    streak: agg.activeStreak,
    sessions: agg.sessions,
    foodGoalDays: agg.foodGoalDays,
  };
}

export interface XpEvent {
  id: number;
  createdAt: string;
  eventDate: string;
  source: string;
  label: string;
  xp: number;
}

export function listXpEvents(uid: number, limit = 30): Promise<XpEvent[]> {
  return q<XpEvent>(
    `SELECT id, created_at AS "createdAt", event_date AS "eventDate", source, label, xp
     FROM xp_events WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [uid, limit],
  );
}

export interface AchievementState {
  key: string;
  name: string;
  desc: string;
  xp: number;
  unlockedAt: string | null;
}

export async function listAchievements(uid: number): Promise<AchievementState[]> {
  const rows = await q<{ key: string; unlockedAt: string }>(
    'SELECT key, unlocked_at AS "unlockedAt" FROM achievements WHERE user_id = $1',
    [uid],
  );
  const map = new Map(rows.map((r) => [r.key, r.unlockedAt]));
  return ACHIEVEMENTS.map((d) => ({
    key: d.key,
    name: d.name,
    desc: d.desc,
    xp: d.xp,
    unlockedAt: map.get(d.key) ?? null,
  }));
}

// ---------- Exercises & plans ----------

export interface Exercise {
  id: number;
  slug: string;
  name: string;
  category: Category;
  mode: Mode;
  archived: boolean;
  /** true = created by this user (editable); false = built-in */
  custom: boolean;
}

export function listExercises(uid: number, includeArchived = false): Promise<Exercise[]> {
  return q<Exercise>(
    `SELECT id, slug, name, category, mode, archived, (user_id IS NOT NULL) AS custom FROM exercises
     WHERE (user_id IS NULL OR user_id = $1) ${includeArchived ? '' : 'AND NOT archived'}
     ORDER BY category, name`,
    [uid],
  );
}

export interface PlanExerciseRow {
  id: number;
  exerciseId: number;
  slug: string;
  name: string;
  category: Category;
  mode: Mode;
  position: number;
  targetSets: number;
  targetReps: number;
  targetWeight: number | null;
  note: string;
}

export interface PlanDayRow {
  id: number;
  planId: number;
  position: number;
  name: string;
  weekday: number | null;
  exercises: PlanExerciseRow[];
}

export interface PlanFull {
  id: number;
  name: string;
  notes: string;
  active: boolean;
  guide: GuideSection[] | null;
  days: PlanDayRow[];
}

export interface PlanSummary {
  id: number;
  name: string;
  notes: string;
  active: boolean;
  dayCount: number;
  createdAt: string;
}

export function listPlans(uid: number): Promise<PlanSummary[]> {
  return q<PlanSummary>(
    `SELECT p.id, p.name, p.notes, p.active, p.created_at AS "createdAt",
            (SELECT count(*) FROM plan_days d WHERE d.plan_id = p.id)::int AS "dayCount"
     FROM plans p WHERE p.user_id = $1 ORDER BY p.active DESC, p.created_at DESC, p.id DESC`,
    [uid],
  );
}

type PlanHead = Omit<PlanFull, 'days'>;

async function loadPlan(plan: PlanHead): Promise<PlanFull> {
  const days = await q<Omit<PlanDayRow, 'exercises'>>(
    `SELECT id, plan_id AS "planId", position, name, weekday FROM plan_days
     WHERE plan_id = $1 ORDER BY weekday NULLS LAST, position, id`,
    [plan.id],
  );
  const exs = await q<PlanExerciseRow & { planDayId: number }>(
    `SELECT pe.id, pe.plan_day_id AS "planDayId", pe.exercise_id AS "exerciseId", ex.slug, ex.name, ex.category, ex.mode,
            pe.position, pe.target_sets AS "targetSets", pe.target_reps AS "targetReps",
            pe.target_weight AS "targetWeight", pe.note
     FROM plan_exercises pe
     JOIN exercises ex ON ex.id = pe.exercise_id
     JOIN plan_days d ON d.id = pe.plan_day_id
     WHERE d.plan_id = $1 ORDER BY pe.position, pe.id`,
    [plan.id],
  );
  return {
    ...plan,
    days: days.map((d) => ({ ...d, exercises: exs.filter((e) => e.planDayId === d.id) })),
  };
}

export async function getPlan(uid: number, id: number): Promise<PlanFull | null> {
  const p = await q1<PlanHead>('SELECT id, name, notes, active, guide FROM plans WHERE id = $1 AND user_id = $2', [id, uid]);
  return p ? loadPlan(p) : null;
}

export async function getActivePlan(uid: number): Promise<PlanFull | null> {
  const p = await q1<PlanHead>('SELECT id, name, notes, active, guide FROM plans WHERE user_id = $1 AND active', [uid]);
  return p ? loadPlan(p) : null;
}

// ---------- Sessions ----------

export interface SessionRow {
  id: number;
  date: string;
  name: string;
  planDayId: number | null;
  startedAt: string;
  completedAt: string | null;
  note: string;
  setCount: number;
  xp: number;
}

const SESSION_SELECT = `
  SELECT se.id, se.session_date AS date, se.name, se.plan_day_id AS "planDayId",
         se.started_at AS "startedAt", se.completed_at AS "completedAt", se.note,
         (SELECT count(*) FROM session_sets s WHERE s.session_id = se.id)::int AS "setCount",
         COALESCE((SELECT sum(xp) FROM xp_events WHERE user_id = se.user_id AND source = 'workout' AND ref = 'session:' || se.id), 0)::int AS xp
  FROM sessions se`;

export function listSessions(uid: number, limit = 30): Promise<SessionRow[]> {
  return q<SessionRow>(`${SESSION_SELECT} WHERE se.user_id = $1 ORDER BY se.session_date DESC, se.id DESC LIMIT $2`, [uid, limit]);
}

export function listSessionsOn(uid: number, date: string): Promise<SessionRow[]> {
  return q<SessionRow>(`${SESSION_SELECT} WHERE se.user_id = $1 AND se.session_date = $2 ORDER BY se.id`, [uid, date]);
}

export interface LoggedSet {
  setNo: number;
  reps: number | null;
  seconds: number | null;
  weightKg: number | null;
}

export interface SessionExerciseDetail {
  id: number;
  exerciseId: number;
  slug: string;
  name: string;
  category: Category;
  mode: Mode;
  position: number;
  targetSets: number;
  targetReps: number;
  targetWeight: number | null;
  sets: LoggedSet[];
  last: SetLike[];
}

export interface SessionDetail {
  session: SessionRow;
  exercises: SessionExerciseDetail[];
}

export async function getSessionDetail(uid: number, id: number): Promise<SessionDetail | null> {
  const session = await q1<SessionRow>(`${SESSION_SELECT} WHERE se.id = $1 AND se.user_id = $2`, [id, uid]);
  if (!session) return null;

  const exs = await q<Omit<SessionExerciseDetail, 'sets' | 'last'>>(
    `SELECT sx.id, sx.exercise_id AS "exerciseId", ex.slug, ex.name, ex.category, ex.mode, sx.position,
            sx.target_sets AS "targetSets", sx.target_reps AS "targetReps", sx.target_weight AS "targetWeight"
     FROM session_exercises sx JOIN exercises ex ON ex.id = sx.exercise_id
     WHERE sx.session_id = $1 ORDER BY sx.position, sx.id`,
    [id],
  );
  const sets = await q<LoggedSet & { exerciseId: number }>(
    `SELECT exercise_id AS "exerciseId", set_no AS "setNo", reps, seconds, weight_kg AS "weightKg"
     FROM session_sets WHERE session_id = $1 ORDER BY set_no`,
    [id],
  );
  const ids = exs.map((e) => e.exerciseId);
  const prev = ids.length
    ? await q<{ exerciseId: number; setNo: number; reps: number | null; seconds: number | null; weightKg: number | null }>(
        `WITH prev AS (
           SELECT DISTINCT ON (s.exercise_id) s.exercise_id, s.session_id
           FROM session_sets s JOIN sessions se ON se.id = s.session_id
           WHERE se.user_id = $3 AND se.completed_at IS NOT NULL AND se.id <> $2 AND s.exercise_id = ANY($1::int[])
           ORDER BY s.exercise_id, se.session_date DESC, se.id DESC
         )
         SELECT s.exercise_id AS "exerciseId", s.set_no AS "setNo", s.reps, s.seconds, s.weight_kg AS "weightKg"
         FROM session_sets s JOIN prev p ON p.exercise_id = s.exercise_id AND p.session_id = s.session_id
         ORDER BY s.exercise_id, s.set_no`,
        [ids, id, uid],
      )
    : [];

  return {
    session,
    exercises: exs.map((e) => ({
      ...e,
      sets: sets.filter((s) => s.exerciseId === e.exerciseId).map(({ exerciseId: _x, ...s }) => s),
      last: prev.filter((s) => s.exerciseId === e.exerciseId).map(({ reps, seconds, weightKg }) => ({ reps, seconds, weightKg })),
    })),
  };
}

// ---------- Weekly schedule ----------

export interface ScheduledDay {
  id: number;
  name: string;
  weekday: number;
  exerciseCount: number;
}

export function getScheduledDays(uid: number, date: string): Promise<ScheduledDay[]> {
  return q<ScheduledDay>(
    `SELECT d.id, d.name, d.weekday, (SELECT count(*) FROM plan_exercises e WHERE e.plan_day_id = d.id)::int AS "exerciseCount"
     FROM plan_days d JOIN plans p ON p.id = d.plan_id AND p.active AND p.user_id = $1
     WHERE d.weekday = $2 ORDER BY d.position, d.id`,
    [uid, isoWeekday(date)],
  );
}

export async function listActiveDays(uid: number): Promise<ScheduledDay[]> {
  return q<ScheduledDay>(
    `SELECT d.id, d.name, COALESCE(d.weekday, 0) AS weekday,
            (SELECT count(*) FROM plan_exercises e WHERE e.plan_day_id = d.id)::int AS "exerciseCount"
     FROM plan_days d JOIN plans p ON p.id = d.plan_id AND p.active AND p.user_id = $1
     ORDER BY d.weekday NULLS LAST, d.position, d.id`,
    [uid],
  );
}

export interface WeekCell {
  date: string;
  weekday: number;
  isToday: boolean;
  scheduled: string[];
  done: number;
  inProgress: number;
}

export async function getWeek(uid: number, today: string): Promise<WeekCell[]> {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const [days, sessions] = await Promise.all([
    listActiveDays(uid),
    q<{ date: string; completed: boolean }>(
      `SELECT session_date AS date, completed_at IS NOT NULL AS completed FROM sessions
       WHERE user_id = $1 AND session_date BETWEEN $2 AND $3`,
      [uid, monday, sunday],
    ),
  ]);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const wd = i + 1;
    return {
      date,
      weekday: wd,
      isToday: date === today,
      scheduled: days.filter((d) => d.weekday === wd).map((d) => d.name),
      done: sessions.filter((s) => s.date === date && s.completed).length,
      inProgress: sessions.filter((s) => s.date === date && !s.completed).length,
    };
  });
}

// ---------- Tasks ----------

export interface Task {
  id: number;
  title: string;
  dueDate: string | null;
  repeat: 'none' | 'daily' | 'weekly';
  xp: number;
  doneAt: string | null;
}

const TASK_SELECT = `SELECT id, title, due_date AS "dueDate", repeat, xp, done_at AS "doneAt" FROM tasks`;

export function listOpenTasks(uid: number): Promise<Task[]> {
  return q<Task>(`${TASK_SELECT} WHERE user_id = $1 AND done_at IS NULL ORDER BY due_date NULLS LAST, id`, [uid]);
}

export function listDoneTasks(uid: number, limit = 20): Promise<Task[]> {
  return q<Task>(`${TASK_SELECT} WHERE user_id = $1 AND done_at IS NOT NULL ORDER BY done_at DESC LIMIT $2`, [uid, limit]);
}

export function listTasksDueBy(uid: number, date: string): Promise<Task[]> {
  return q<Task>(`${TASK_SELECT} WHERE user_id = $1 AND done_at IS NULL AND due_date <= $2 ORDER BY due_date, id`, [uid, date]);
}

// ---------- Food ----------

export interface Food {
  id: number;
  name: string;
  servingLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  archived: boolean;
}

export function listFoods(uid: number, includeArchived = false): Promise<Food[]> {
  return q<Food>(
    `SELECT id, name, serving_label AS "servingLabel", kcal, protein, carbs, fat, archived FROM foods
     WHERE user_id = $1 ${includeArchived ? '' : 'AND NOT archived'} ORDER BY name`,
    [uid],
  );
}

export interface FoodLog {
  id: number;
  meal: Meal;
  foodId: number | null;
  name: string;
  servings: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodDay {
  date: string;
  logs: FoodLog[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
}

export async function getFoodDay(uid: number, date: string): Promise<FoodDay> {
  const logs = await q<FoodLog>(
    `SELECT id, meal, food_id AS "foodId", name, servings, kcal, protein, carbs, fat
     FROM food_logs WHERE user_id = $1 AND log_date = $2 ORDER BY id`,
    [uid, date],
  );
  const totals = logs.reduce(
    (a, l) => ({ kcal: a.kcal + l.kcal, protein: a.protein + l.protein, carbs: a.carbs + l.carbs, fat: a.fat + l.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { date, logs, totals };
}

// ---------- Body weight ----------

export interface WeightRow {
  date: string;
  kg: number;
}

export function listWeights(uid: number, limit = 30): Promise<WeightRow[]> {
  return q<WeightRow>(`SELECT log_date AS date, kg FROM body_weights WHERE user_id = $1 ORDER BY log_date DESC LIMIT $2`, [uid, limit]);
}

// ---------- Progress series ----------

export type GroupBy = 'day' | 'week' | 'month';
export const GROUPS: GroupBy[] = ['day', 'week', 'month'];
export const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '3 months', days: 90 },
  { key: '180', label: '6 months', days: 180 },
  { key: '365', label: '1 year', days: 365 },
  { key: 'all', label: 'All time', days: null },
];

const TRUNC: Record<GroupBy, string> = { day: 'day', week: 'week', month: 'month' };

export function sinceFor(rangeKey: string): string {
  const r = RANGES.find((x) => x.key === rangeKey) ?? RANGES[1];
  return r.days == null ? '1970-01-01' : addDays(todayStr(), -r.days);
}

export interface VolumeRow {
  period: string;
  sessions: number;
  push: number;
  pull: number;
  legs: number;
  core: number;
  skill: number;
  cardio: number;
  mobility: number;
}

export async function getVolumeSeries(uid: number, since: string, by: GroupBy): Promise<VolumeRow[]> {
  const trunc = TRUNC[by];
  const [sets, sess] = await Promise.all([
    q<{ period: string; category: Category; sets: number }>(
      `SELECT date_trunc('${trunc}', se.session_date)::date AS period, ex.category, count(*)::int AS sets
       FROM session_sets s
       JOIN sessions se ON se.id = s.session_id AND se.completed_at IS NOT NULL
       JOIN exercises ex ON ex.id = s.exercise_id
       WHERE se.user_id = $1 AND se.session_date >= $2 GROUP BY 1, 2 ORDER BY 1`,
      [uid, since],
    ),
    q<{ period: string; sessions: number }>(
      `SELECT date_trunc('${trunc}', session_date)::date AS period, count(*)::int AS sessions
       FROM sessions WHERE user_id = $1 AND completed_at IS NOT NULL AND session_date >= $2 GROUP BY 1 ORDER BY 1`,
      [uid, since],
    ),
  ]);
  const map = new Map<string, VolumeRow>();
  const row = (period: string): VolumeRow => {
    let r = map.get(period);
    if (!r) {
      r = { period, sessions: 0, push: 0, pull: 0, legs: 0, core: 0, skill: 0, cardio: 0, mobility: 0 };
      map.set(period, r);
    }
    return r;
  };
  for (const s of sets) row(s.period)[s.category] += s.sets;
  for (const s of sess) row(s.period).sessions = s.sessions;
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export interface ExerciseProgressRow {
  period: string;
  value: number;
}

/** Best value per period. Assisted: lowest assist kg achieved with at least 5 reps (lower is better). */
export async function getExerciseProgress(
  uid: number,
  exerciseId: number,
  mode: Mode,
  since: string,
  by: GroupBy,
): Promise<ExerciseProgressRow[]> {
  const metric =
    mode === 'seconds'
      ? 'max(s.seconds)'
      : mode === 'weighted'
        ? 'max(s.weight_kg * (1 + s.reps / 30.0))'
        : mode === 'assisted'
          ? 'min(s.weight_kg) FILTER (WHERE s.reps >= 5)'
          : 'max(s.reps)';
  return q<ExerciseProgressRow>(
    `SELECT date_trunc('${TRUNC[by]}', se.session_date)::date AS period, round(${metric}::numeric, 1) AS value
     FROM session_sets s JOIN sessions se ON se.id = s.session_id AND se.completed_at IS NOT NULL
     WHERE se.user_id = $1 AND s.exercise_id = $2 AND se.session_date >= $3
     GROUP BY 1 HAVING ${metric} IS NOT NULL ORDER BY 1`,
    [uid, exerciseId, since],
  );
}

export function listLoggedExercises(uid: number): Promise<(Exercise & { sets: number })[]> {
  return q(
    `SELECT ex.id, ex.slug, ex.name, ex.category, ex.mode, ex.archived, (ex.user_id IS NOT NULL) AS custom, count(s.id)::int AS sets
     FROM exercises ex
     JOIN session_sets s ON s.exercise_id = ex.id
     JOIN sessions se ON se.id = s.session_id AND se.completed_at IS NOT NULL AND se.user_id = $1
     GROUP BY ex.id ORDER BY sets DESC, ex.name`,
    [uid],
  );
}

export function getWeightSeries(uid: number, since: string, by: GroupBy): Promise<{ period: string; kg: number }[]> {
  return q(
    `SELECT date_trunc('${TRUNC[by]}', log_date)::date AS period, round(avg(kg), 1) AS kg
     FROM body_weights WHERE user_id = $1 AND log_date >= $2 GROUP BY 1 ORDER BY 1`,
    [uid, since],
  );
}

export function getNutritionSeries(
  uid: number,
  since: string,
  by: GroupBy,
): Promise<{ period: string; kcal: number; protein: number }[]> {
  return q(
    `SELECT date_trunc('${TRUNC[by]}', d)::date AS period, round(avg(kcal)) AS kcal, round(avg(protein)) AS protein
     FROM (SELECT log_date AS d, sum(kcal) AS kcal, sum(protein) AS protein FROM food_logs
           WHERE user_id = $1 AND log_date >= $2 GROUP BY log_date) t
     GROUP BY 1 ORDER BY 1`,
    [uid, since],
  );
}

export function getXpSeries(uid: number, since: string, by: GroupBy): Promise<{ period: string; xp: number }[]> {
  return q(
    `SELECT date_trunc('${TRUNC[by]}', event_date)::date AS period, sum(xp)::int AS xp
     FROM xp_events WHERE user_id = $1 AND event_date >= $2 GROUP BY 1 ORDER BY 1`,
    [uid, since],
  );
}
