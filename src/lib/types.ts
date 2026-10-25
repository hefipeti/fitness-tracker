export const CATEGORIES = ['push', 'pull', 'legs', 'core', 'skill', 'cardio', 'mobility'] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * reps     = bodyweight reps
 * seconds  = timed hold
 * weighted = kg x reps (heavier is better)
 * assisted = assist kg x reps on an assisted machine or band (LESS assist is better)
 */
export const MODES = ['reps', 'seconds', 'weighted', 'assisted'] as const;
export type Mode = (typeof MODES)[number];

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

export interface GameResult {
  gained: number;
  level: number;
  leveledUp: boolean;
  rank: string;
  rankedUp: boolean;
  achievements: { key: string; name: string; xp: number }[];
}

/** Expected failure that should be shown to the user (production builds mask thrown messages). */
export interface ActionError {
  error: string;
}

/** Plain confirmation toast. */
export interface ActionNote {
  note: string;
}

export type ActionResult = GameResult | ActionError | ActionNote | void;

export const CATEGORY_COLORS: Record<Category, string> = {
  push: '#a78bfa',
  pull: '#7c3aed',
  legs: '#c084fc',
  core: '#6366f1',
  skill: '#e879f9',
  cardio: '#64748b',
  mobility: '#a1a1aa',
};
