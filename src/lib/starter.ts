/** Built-in exercise library and starter data. Exercises here are global (user_id NULL). */

export type ExerciseSeed = [slug: string, name: string, category: string, mode: string];

/** Original library (migration 2). */
export const BASE_EXERCISES: ExerciseSeed[] = [
  // push
  ['push-up', 'Push-up', 'push', 'reps'],
  ['incline-push-up', 'Incline Push-up', 'push', 'reps'],
  ['pike-push-up', 'Pike Push-up', 'push', 'reps'],
  ['dip', 'Dip', 'push', 'reps'],
  ['bench-press', 'Bench Press', 'push', 'weighted'],
  ['overhead-press', 'Overhead Press', 'push', 'weighted'],
  // pull
  ['pull-up', 'Pull-up', 'pull', 'reps'],
  ['chin-up', 'Chin-up', 'pull', 'reps'],
  ['negative-pull-up', 'Negative Pull-up', 'pull', 'reps'],
  ['scapular-pull-up', 'Scapular Pull-up', 'pull', 'reps'],
  ['australian-row', 'Australian Row', 'pull', 'reps'],
  ['lat-pulldown', 'Lat Pulldown', 'pull', 'weighted'],
  ['cable-row', 'Cable Row', 'pull', 'weighted'],
  ['biceps-curl', 'Biceps Curl', 'pull', 'weighted'],
  ['dead-hang', 'Dead Hang', 'pull', 'seconds'],
  // legs
  ['squat', 'Bodyweight Squat', 'legs', 'reps'],
  ['goblet-squat', 'Goblet Squat', 'legs', 'weighted'],
  ['romanian-deadlift', 'Romanian Deadlift', 'legs', 'weighted'],
  ['leg-press', 'Leg Press', 'legs', 'weighted'],
  ['split-squat', 'Split Squat', 'legs', 'reps'],
  ['calf-raise', 'Calf Raise', 'legs', 'reps'],
  ['glute-bridge', 'Glute Bridge', 'legs', 'reps'],
  // core
  ['plank', 'Plank', 'core', 'seconds'],
  ['hollow-hold', 'Hollow Body Hold', 'core', 'seconds'],
  ['hanging-knee-raise', 'Hanging Knee Raise', 'core', 'reps'],
  ['leg-raise', 'Leg Raise', 'core', 'reps'],
  ['dead-bug', 'Dead Bug', 'core', 'reps'],
  // skill
  ['wall-plank-hold', 'Wall Plank Hold', 'skill', 'seconds'],
  ['wall-handstand-hold', 'Wall Handstand Hold', 'skill', 'seconds'],
  ['freestanding-handstand', 'Freestanding Handstand', 'skill', 'seconds'],
  ['wall-walk', 'Wall Walk', 'skill', 'reps'],
  ['l-sit-tuck', 'Tuck L-sit', 'skill', 'seconds'],
];

/** Added with the 12-week base-phase plan (migration 4): assisted mode and mobility. */
export const PLAN_EXERCISES: ExerciseSeed[] = [
  ['assisted-pull-up-machine', 'Assisted Pull-up Machine', 'pull', 'assisted'],
  ['assisted-dip', 'Assisted Dip (machine or band)', 'push', 'assisted'],
  ['inverted-row', 'Inverted Row', 'pull', 'reps'],
  ['inverted-row-feet-elevated', 'Inverted Row (feet elevated)', 'pull', 'reps'],
  ['dumbbell-overhead-press', 'Dumbbell Overhead Press', 'push', 'weighted'],
  ['gym-warm-up', 'Warm-up (8 min)', 'mobility', 'seconds'],
  ['wrist-mobility', 'Wrist Mobility', 'mobility', 'seconds'],
  ['deep-squat-hold', 'Deep Squat Hold', 'mobility', 'seconds'],
  ['hip-90-90-stretch', '90/90 Hip Stretch', 'mobility', 'seconds'],
  ['hamstring-stretch', 'Hamstring Stretch', 'mobility', 'seconds'],
];

export interface TemplateExercise {
  slug: string;
  sets: number;
  /** Top of the rep range, or seconds for timed holds. */
  reps: number;
  weight?: number;
  note?: string;
}

export interface TemplateDay {
  name: string;
  /** ISO weekday 1 = Monday ... 7 = Sunday */
  weekday: number | null;
  exercises: TemplateExercise[];
}

export const STARTER_DAYS: TemplateDay[] = [
  {
    name: 'Pull',
    weekday: 1,
    exercises: [
      { slug: 'scapular-pull-up', sets: 3, reps: 8 },
      { slug: 'negative-pull-up', sets: 4, reps: 4 },
      { slug: 'australian-row', sets: 3, reps: 10 },
      { slug: 'lat-pulldown', sets: 3, reps: 10 },
      { slug: 'biceps-curl', sets: 2, reps: 12 },
      { slug: 'dead-hang', sets: 3, reps: 20 },
    ],
  },
  {
    name: 'Push + Handstand',
    weekday: 3,
    exercises: [
      { slug: 'wall-plank-hold', sets: 3, reps: 30 },
      { slug: 'pike-push-up', sets: 3, reps: 6 },
      { slug: 'push-up', sets: 4, reps: 8 },
      { slug: 'dip', sets: 3, reps: 6 },
      { slug: 'wall-handstand-hold', sets: 4, reps: 10 },
      { slug: 'plank', sets: 3, reps: 30 },
    ],
  },
  {
    name: 'Legs + Core',
    weekday: 5,
    exercises: [
      { slug: 'goblet-squat', sets: 3, reps: 10 },
      { slug: 'romanian-deadlift', sets: 3, reps: 10 },
      { slug: 'split-squat', sets: 3, reps: 8 },
      { slug: 'calf-raise', sets: 3, reps: 15 },
      { slug: 'hollow-hold', sets: 3, reps: 15 },
      { slug: 'hanging-knee-raise', sets: 3, reps: 8 },
    ],
  },
  {
    name: 'Skills + Upper',
    weekday: 6,
    exercises: [
      { slug: 'wall-handstand-hold', sets: 5, reps: 10 },
      { slug: 'negative-pull-up', sets: 3, reps: 4 },
      { slug: 'push-up', sets: 3, reps: 8 },
      { slug: 'l-sit-tuck', sets: 4, reps: 10 },
      { slug: 'australian-row', sets: 3, reps: 10 },
      { slug: 'glute-bridge', sets: 3, reps: 12 },
    ],
  },
];

export const STARTER_PLAN_NAME = 'Foundation Block';
export const STARTER_PLAN_NOTES = 'Starter hybrid plan (gym + calisthenics). Edit or duplicate it as you progress.';

/** [name, serving label, kcal, protein, carbs, fat] per serving. Approximate. */
export const STARTER_FOODS: [string, string, number, number, number, number][] = [
  ['Chicken breast, cooked', '100 g', 165, 31, 0, 3.6],
  ['White rice, cooked', '100 g', 130, 2.7, 28, 0.3],
  ['Egg (large)', '1 egg', 72, 6.3, 0.4, 4.8],
  ['Rolled oats, dry', '100 g', 379, 13.2, 67.7, 6.5],
  ['Banana (medium)', '1 piece', 105, 1.3, 27, 0.4],
  ['Greek yogurt, 0% fat', '100 g', 59, 10, 3.6, 0.4],
  ['Whole milk', '100 ml', 61, 3.2, 4.8, 3.3],
  ['Olive oil', '1 tbsp', 119, 0, 0, 13.5],
];
