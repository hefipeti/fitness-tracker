import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  computeStats,
  computeStreak,
  foodGoalMet,
  levelInfo,
  newlyUnlocked,
  rankFor,
  sessionXp,
  setScore,
  xpForLevel,
  type Aggregate,
} from '@/lib/game';
import { addDays, isoWeekday, isValidDate, mondayOf } from '@/lib/dates';

const baseAgg = (over: Partial<Aggregate> = {}): Aggregate => ({
  sessions: 0,
  bestWeekSessions: 0,
  exercises: [],
  foodGoalDays: 0,
  tasksDone: 0,
  activeStreak: 0,
  startWeight: 94,
  goalWeight: 86,
  minWeight: 94,
  level: 1,
  ...over,
});

describe('levels', () => {
  it('starts at level 1 with 0 xp', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, xpIntoLevel: 0 });
  });
  it('level thresholds are strictly increasing', () => {
    for (let l = 1; l < 100; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
  });
  it('levels up exactly at the threshold', () => {
    const need = xpForLevel(2);
    expect(levelInfo(need - 1).level).toBe(1);
    expect(levelInfo(need).level).toBe(2);
  });
  it('progress stays within 0..1', () => {
    for (const xp of [0, 1, 99, 100, 5000, 123456]) {
      const p = levelInfo(xp).progress;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });
  it('clamps negative xp', () => {
    expect(levelInfo(-50).level).toBe(1);
  });
});

describe('ranks', () => {
  it('maps levels to ranks', () => {
    expect(rankFor(1).letter).toBe('E');
    expect(rankFor(9).letter).toBe('E');
    expect(rankFor(10).letter).toBe('D');
    expect(rankFor(35).letter).toBe('B');
    expect(rankFor(75).letter).toBe('S');
    expect(rankFor(500).letter).toBe('S');
  });
});

describe('food goal', () => {
  const target = { kcal: 2300, protein: 160, carbs: 250, fat: 70 };
  it('requires calories in range and enough protein', () => {
    expect(foodGoalMet({ kcal: 2250, protein: 155, carbs: 0, fat: 0 }, target)).toBe(true);
    expect(foodGoalMet({ kcal: 1500, protein: 160, carbs: 0, fat: 0 }, target)).toBe(false);
    expect(foodGoalMet({ kcal: 2900, protein: 160, carbs: 0, fat: 0 }, target)).toBe(false);
    expect(foodGoalMet({ kcal: 2300, protein: 100, carbs: 0, fat: 0 }, target)).toBe(false);
  });
  it('never counts an empty day', () => {
    expect(foodGoalMet({ kcal: 0, protein: 0, carbs: 0, fat: 0 }, target)).toBe(false);
  });
});

describe('set score / PR comparison', () => {
  it('uses reps, seconds or estimated 1RM by mode', () => {
    expect(setScore('reps', { reps: 8, seconds: null, weightKg: null })).toBe(8);
    expect(setScore('seconds', { reps: null, seconds: 25, weightKg: null })).toBe(25);
    expect(setScore('weighted', { reps: 10, seconds: null, weightKg: 60 })).toBeCloseTo(80);
  });
  it('treats incomplete weighted sets as zero', () => {
    expect(setScore('weighted', { reps: 10, seconds: null, weightKg: null })).toBe(0);
  });
});

describe('xp', () => {
  it('caps set and PR bonuses', () => {
    expect(sessionXp(0, 0)).toBe(50);
    expect(sessionXp(10, 0)).toBe(80);
    expect(sessionXp(100, 0)).toBe(110);
    expect(sessionXp(10, 10)).toBe(80 + 60);
  });
});

describe('stats', () => {
  it('starts every stat at 10', () => {
    expect(computeStats(baseAgg())).toEqual({ STR: 10, AGI: 10, END: 10, VIT: 10, DIS: 10 });
  });
  it('grows from relevant activity', () => {
    const s = computeStats(
      baseAgg({
        sessions: 4,
        foodGoalDays: 3,
        tasksDone: 2,
        activeStreak: 5,
        exercises: [
          { slug: 'push-up', category: 'push', mode: 'reps', sets: 10, reps: 80, seconds: 0, volumeKg: 0, maxReps: 10, maxSeconds: 0 },
          { slug: 'wall-handstand-hold', category: 'skill', mode: 'seconds', sets: 5, reps: 0, seconds: 120, volumeKg: 0, maxReps: 0, maxSeconds: 30 },
        ],
      }),
    );
    expect(s.STR).toBe(12);
    expect(s.AGI).toBe(12);
    expect(s.END).toBe(16);
    expect(s.VIT).toBe(13);
    expect(s.DIS).toBe(17);
  });
});

describe('achievements', () => {
  it('keys are unique', () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('unlocks first workout once', () => {
    const agg = baseAgg({ sessions: 1 });
    expect(newlyUnlocked(agg, new Set()).map((a) => a.key)).toContain('first-blood');
    expect(newlyUnlocked(agg, new Set(['first-blood'])).map((a) => a.key)).not.toContain('first-blood');
  });
  it('detects the first pull-up from set data', () => {
    const agg = baseAgg({
      exercises: [{ slug: 'pull-up', category: 'pull', mode: 'reps', sets: 1, reps: 1, seconds: 0, volumeKg: 0, maxReps: 1, maxSeconds: 0 }],
    });
    expect(newlyUnlocked(agg, new Set()).map((a) => a.key)).toContain('pullup-1');
  });
  it('weight goal only triggers when losing toward the goal', () => {
    expect(newlyUnlocked(baseAgg({ minWeight: 86 }), new Set()).map((a) => a.key)).toContain('weight-goal');
    expect(newlyUnlocked(baseAgg({ startWeight: 80, goalWeight: 90, minWeight: 79 }), new Set()).map((a) => a.key)).not.toContain('weight-goal');
  });
});

describe('streak + dates', () => {
  const prev = (d: string) => addDays(d, -1);
  it('counts back from today', () => {
    expect(computeStreak(['2026-10-24', '2026-10-23', '2026-10-22'], '2026-10-24', prev)).toBe(3);
  });
  it('does not break the streak if today is still empty', () => {
    expect(computeStreak(['2026-10-23', '2026-10-22'], '2026-10-24', prev)).toBe(2);
  });
  it('breaks on a gap', () => {
    expect(computeStreak(['2026-10-24', '2026-10-22'], '2026-10-24', prev)).toBe(1);
    expect(computeStreak([], '2026-10-24', prev)).toBe(0);
  });
  it('handles weekdays and month boundaries', () => {
    expect(isoWeekday('2026-10-24')).toBe(6); // Saturday
    expect(isoWeekday('2026-10-25')).toBe(7); // Sunday
    expect(mondayOf('2026-10-24')).toBe('2026-10-19');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('validates dates strictly', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-10-24')).toBe(true);
    expect(isValidDate('nope')).toBe(false);
  });
});

describe('assisted mode scoring (less assist is better)', () => {
  const s = (assist: number | null, reps: number | null) => ({ reps, seconds: null, weightKg: assist });
  it('ranks lower assist above higher assist regardless of reps', () => {
    expect(setScore('assisted', s(55, 5))).toBeGreaterThan(setScore('assisted', s(60, 12)));
  });
  it('ranks more reps higher at the same assist', () => {
    expect(setScore('assisted', s(60, 8))).toBeGreaterThan(setScore('assisted', s(60, 6)));
  });
  it('treats zero reps as no score and 0 kg assist as the best', () => {
    expect(setScore('assisted', s(60, 0))).toBe(0);
    expect(setScore('assisted', s(0, 1))).toBeGreaterThan(setScore('assisted', s(5, 20)));
  });
  it('does not count assist weight as lifting volume', () => {
    const agg = baseAgg({
      exercises: [{ slug: 'assisted-pull-up-machine', category: 'pull', mode: 'assisted', sets: 4, reps: 32, seconds: 0, volumeKg: 0, maxReps: 8, maxSeconds: 0 }],
    });
    expect(computeStats(agg).STR).toBe(10); // 32 pull reps / 40 = 0 whole points, no volume
  });
});
