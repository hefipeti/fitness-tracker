/**
 * Pure game rules: levels, ranks, stats, achievements.
 * No I/O here so everything is unit-testable (see tests/game.test.ts).
 */

// ---------- Levels & ranks ----------

/** Cumulative XP required to *reach* a level. Level 1 = 0 XP. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.5));
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  progress: number; // 0..1
}

export function levelInfo(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    xpIntoLevel: xp - base,
    xpForNext: next - base,
    progress: (xp - base) / (next - base),
  };
}

export interface Rank {
  letter: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  title: string;
  minLevel: number;
}

export const RANKS: Rank[] = [
  { letter: 'E', title: 'Novice', minLevel: 1 },
  { letter: 'D', title: 'Awakened', minLevel: 10 },
  { letter: 'C', title: 'Seasoned', minLevel: 20 },
  { letter: 'B', title: 'Elite', minLevel: 35 },
  { letter: 'A', title: 'Master', minLevel: 50 },
  { letter: 'S', title: 'Monarch', minLevel: 75 },
];

export function rankFor(level: number): Rank {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.minLevel) r = x;
  return r;
}

export function nextRank(level: number): Rank | null {
  return RANKS.find((r) => r.minLevel > level) ?? null;
}

// ---------- Food goal ----------

export interface DayTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** A food day "counts" when calories are on target (85-105%) and protein >= 90%. */
export function foodGoalMet(t: DayTotals, target: Targets): boolean {
  if (target.kcal <= 0) return false;
  const kcalOk = t.kcal >= target.kcal * 0.85 && t.kcal <= target.kcal * 1.05;
  const proteinOk = target.protein <= 0 || t.protein >= target.protein * 0.9;
  return kcalOk && proteinOk;
}

// ---------- Aggregates ----------

export interface ExerciseAgg {
  slug: string;
  category: string;
  mode: string;
  sets: number;
  reps: number;
  seconds: number;
  volumeKg: number; // sum(weight * reps)
  maxReps: number;
  maxSeconds: number;
}

export interface Aggregate {
  sessions: number;
  bestWeekSessions: number;
  exercises: ExerciseAgg[];
  foodGoalDays: number;
  tasksDone: number;
  activeStreak: number;
  startWeight: number | null;
  goalWeight: number | null;
  minWeight: number | null;
  level: number;
  nutritionPlanWeeksDone: number;
}

// ---------- Stats ----------

export interface Stats {
  STR: number;
  AGI: number;
  END: number;
  VIT: number;
  DIS: number;
}

export const STAT_INFO: Record<keyof Stats, { name: string; formula: string }> = {
  STR: { name: 'Strength', formula: 'Push + pull reps and weighted volume' },
  AGI: { name: 'Agility', formula: 'Skill work: handstand / L-sit time and skill reps' },
  END: { name: 'Endurance', formula: 'Completed sessions plus leg / core / cardio sets' },
  VIT: { name: 'Vitality', formula: 'Days you hit your nutrition targets' },
  DIS: { name: 'Discipline', formula: 'Tasks completed plus your active streak' },
};

export function computeStats(a: Aggregate): Stats {
  let pushPullReps = 0;
  let weightedVolume = 0;
  let skillSeconds = 0;
  let skillReps = 0;
  let legCoreSets = 0;
  for (const e of a.exercises) {
    if (e.category === 'push' || e.category === 'pull') pushPullReps += e.reps;
    weightedVolume += e.volumeKg;
    if (e.category === 'skill') {
      skillSeconds += e.seconds;
      skillReps += e.reps;
    }
    if (e.category === 'legs' || e.category === 'core' || e.category === 'cardio') legCoreSets += e.sets;
  }
  return {
    STR: 10 + Math.floor(pushPullReps / 40 + weightedVolume / 1500),
    AGI: 10 + Math.floor(skillSeconds / 60 + skillReps / 25),
    END: 10 + Math.floor(a.sessions * 1.5 + legCoreSets / 8),
    VIT: 10 + a.foodGoalDays,
    DIS: 10 + a.tasksDone + a.activeStreak,
  };
}

// ---------- Achievements ----------

export interface AchievementDef {
  key: string;
  name: string;
  desc: string;
  xp: number;
  test: (a: Aggregate) => boolean;
}

function bestOf(a: Aggregate, slug: string, field: 'maxReps' | 'maxSeconds'): number {
  return a.exercises.find((e) => e.slug === slug)?.[field] ?? 0;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'first-blood', name: 'First Blood', desc: 'Complete your first workout', xp: 50, test: (a) => a.sessions >= 1 },
  { key: 'sessions-10', name: 'Getting Started', desc: 'Complete 10 workouts', xp: 100, test: (a) => a.sessions >= 10 },
  { key: 'sessions-50', name: 'Dedicated', desc: 'Complete 50 workouts', xp: 300, test: (a) => a.sessions >= 50 },
  { key: 'sessions-100', name: 'Unbroken', desc: 'Complete 100 workouts', xp: 600, test: (a) => a.sessions >= 100 },
  { key: 'week-3', name: 'Full Week', desc: '3 workouts in one calendar week', xp: 100, test: (a) => a.bestWeekSessions >= 3 },
  { key: 'week-4', name: 'Double Dungeon', desc: '4 workouts in one calendar week', xp: 150, test: (a) => a.bestWeekSessions >= 4 },
  { key: 'streak-7', name: '7-Day Streak', desc: 'Log training or food 7 days in a row', xp: 100, test: (a) => a.activeStreak >= 7 },
  { key: 'streak-30', name: '30-Day Streak', desc: 'Log training or food 30 days in a row', xp: 300, test: (a) => a.activeStreak >= 30 },
  { key: 'pullup-1', name: 'First Pull-up', desc: 'Do 1 strict pull-up', xp: 200, test: (a) => bestOf(a, 'pull-up', 'maxReps') >= 1 },
  { key: 'pullup-5', name: 'Pull-up x5', desc: '5 pull-ups in one set', xp: 300, test: (a) => bestOf(a, 'pull-up', 'maxReps') >= 5 },
  { key: 'pullup-10', name: 'Pull-up x10', desc: '10 pull-ups in one set', xp: 500, test: (a) => bestOf(a, 'pull-up', 'maxReps') >= 10 },
  { key: 'pushup-10', name: 'Push-up x10', desc: '10 push-ups in one set', xp: 100, test: (a) => bestOf(a, 'push-up', 'maxReps') >= 10 },
  { key: 'pushup-25', name: 'Push-up x25', desc: '25 push-ups in one set', xp: 200, test: (a) => bestOf(a, 'push-up', 'maxReps') >= 25 },
  { key: 'wall-hs-20', name: 'Wall Handstand 20s', desc: 'Hold a wall handstand for 20 seconds', xp: 150, test: (a) => bestOf(a, 'wall-handstand-hold', 'maxSeconds') >= 20 },
  { key: 'wall-hs-60', name: 'Wall Handstand 60s', desc: 'Hold a wall handstand for 60 seconds', xp: 300, test: (a) => bestOf(a, 'wall-handstand-hold', 'maxSeconds') >= 60 },
  { key: 'free-hs-5', name: 'Free Handstand 5s', desc: 'Hold a freestanding handstand for 5 seconds', xp: 400, test: (a) => bestOf(a, 'freestanding-handstand', 'maxSeconds') >= 5 },
  { key: 'free-hs-30', name: 'Free Handstand 30s', desc: 'Hold a freestanding handstand for 30 seconds', xp: 800, test: (a) => bestOf(a, 'freestanding-handstand', 'maxSeconds') >= 30 },
  { key: 'food-7', name: 'Disciplined Diet', desc: 'Hit nutrition targets on 7 days', xp: 100, test: (a) => a.foodGoalDays >= 7 },
  { key: 'food-30', name: 'Iron Diet', desc: 'Hit nutrition targets on 30 days', xp: 300, test: (a) => a.foodGoalDays >= 30 },
  { key: 'tasks-10', name: 'Errand Runner', desc: 'Complete 10 tasks', xp: 50, test: (a) => a.tasksDone >= 10 },
  { key: 'tasks-50', name: 'Quest Master', desc: 'Complete 50 tasks', xp: 150, test: (a) => a.tasksDone >= 50 },
  {
    key: 'weight-5',
    name: 'Shedding Weight',
    desc: 'Lose 5 kg from your starting weight',
    xp: 200,
    test: (a) => a.startWeight != null && a.minWeight != null && a.startWeight - a.minWeight >= 5,
  },
  {
    key: 'weight-goal',
    name: 'Target Reached',
    desc: 'Reach your goal weight',
    xp: 500,
    test: (a) => a.goalWeight != null && a.minWeight != null && a.startWeight != null && a.goalWeight < a.startWeight && a.minWeight <= a.goalWeight,
  },
  { key: 'level-10', name: 'Awakened', desc: 'Reach level 10 (D-Rank)', xp: 100, test: (a) => a.level >= 10 },
  { key: 'level-20', name: 'Seasoned Hunter', desc: 'Reach level 20 (C-Rank)', xp: 200, test: (a) => a.level >= 20 },
  { key: 'level-35', name: 'Elite Hunter', desc: 'Reach level 35 (B-Rank)', xp: 400, test: (a) => a.level >= 35 },
  { key: 'nutrition-plan-week', name: 'Meal Planner', desc: 'Complete a full week following your nutrition plan', xp: 150, test: (a) => a.nutritionPlanWeeksDone >= 1 },
];

export function newlyUnlocked(a: Aggregate, unlocked: Set<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((d) => !unlocked.has(d.key) && d.test(a));
}

// ---------- Personal records & streaks ----------

export interface SetLike {
  reps: number | null;
  seconds: number | null;
  weightKg: number | null;
}

/** Comparable "strength score" for one set depending on exercise mode (higher = better). */
export function setScore(mode: string, s: SetLike): number {
  if (mode === 'seconds') return s.seconds ?? 0;
  if (mode === 'assisted') {
    // Less assistance is better, then more reps. Monotonic: (1000 - assist) dominates reps (< 1000).
    const r = s.reps ?? 0;
    if (r <= 0) return 0;
    const assist = Math.min(Math.max(s.weightKg ?? 0, 0), 999);
    return (1000 - assist) * 1000 + Math.min(r, 999);
  }
  if (mode === 'weighted') {
    const w = s.weightKg ?? 0;
    const r = s.reps ?? 0;
    return w > 0 && r > 0 ? w * (1 + r / 30) : 0; // Epley estimate of 1RM
  }
  return s.reps ?? 0;
}

/** Consecutive active days ending today (or yesterday if today has no activity yet). */
export function computeStreak(activeDates: string[], today: string, prev: (d: string) => string): number {
  const set = new Set(activeDates);
  let cursor = set.has(today) ? today : prev(today);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = prev(cursor);
  }
  return n;
}

export const SESSION_BASE_XP = 50;
export const SESSION_XP_PER_SET = 3;
export const SESSION_MAX_SET_XP = 60;
export const PR_XP = 20;
export const PR_MAX = 3;
export const FOOD_DAY_XP = 30;
export const PLAN_DAY_BONUS_XP = 15;
export const WEIGHT_LOG_XP = 5;

export function sessionXp(setsDone: number, prs: number): number {
  return (
    SESSION_BASE_XP +
    Math.min(SESSION_MAX_SET_XP, setsDone * SESSION_XP_PER_SET) +
    Math.min(PR_MAX, prs) * PR_XP
  );
}
