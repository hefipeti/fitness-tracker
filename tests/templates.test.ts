import { describe, expect, it } from 'vitest';
import { BASE_EXERCISES, PLAN_EXERCISES } from '@/lib/starter';
import { BASE_12_WEEK, PLAN_TEMPLATES } from '@/lib/templates';
import { CATEGORIES, MODES } from '@/lib/types';

const all = new Map([...BASE_EXERCISES, ...PLAN_EXERCISES].map(([slug, name, category, mode]) => [slug, { name, category, mode }]));

describe('exercise seeds', () => {
  it('have unique slugs and valid categories and modes', () => {
    const slugs = [...BASE_EXERCISES, ...PLAN_EXERCISES].map((e) => e[0]);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const [, , category, mode] of [...BASE_EXERCISES, ...PLAN_EXERCISES]) {
      expect(CATEGORIES as readonly string[]).toContain(category);
      expect(MODES as readonly string[]).toContain(mode);
    }
  });
});

describe('plan templates', () => {
  for (const t of PLAN_TEMPLATES) {
    describe(t.key, () => {
      it('only reference known exercises, with sane targets', () => {
        for (const day of t.days) {
          const seen = new Set<string>();
          for (const e of day.exercises) {
            expect(all.has(e.slug), `${t.key}/${day.name}: ${e.slug}`).toBe(true);
            expect(e.sets).toBeGreaterThan(0);
            expect(e.reps).toBeGreaterThan(0);
            expect(seen.has(e.slug), `duplicate ${e.slug} in ${day.name}`).toBe(false);
            seen.add(e.slug);
            if (e.weight != null) expect(['weighted', 'assisted']).toContain(all.get(e.slug)!.mode);
            expect((e.note ?? '').length).toBeLessThanOrEqual(300);
          }
          if (day.weekday != null) expect(day.weekday).toBeGreaterThanOrEqual(1);
          if (day.weekday != null) expect(day.weekday).toBeLessThanOrEqual(7);
        }
      });
      it('keeps notes within the editable limit', () => {
        expect(t.notes.length).toBeLessThanOrEqual(500);
      });
    });
  }
});

describe('12-week base phase plan', () => {
  it('matches the schedule: gym Mon/Wed/Fri, home Tue/Sat, rest Thu/Sun', () => {
    expect(BASE_12_WEEK.days.map((d) => d.weekday)).toEqual([1, 2, 3, 5, 6]);
    expect(BASE_12_WEEK.days.map((d) => d.name)).toEqual([
      'Gym A: pull focus',
      'Home: mobility, push-ups, core',
      'Gym B: push and legs',
      'Gym C: pull plus handstand prep',
      'Home: mobility, push-ups, core',
    ]);
  });
  it('has the starting loads from the plan', () => {
    const gymA = BASE_12_WEEK.days[0].exercises;
    expect(gymA.find((e) => e.slug === 'assisted-pull-up-machine')).toMatchObject({ sets: 4, reps: 8, weight: 60 });
    expect(gymA.find((e) => e.slug === 'leg-press')).toMatchObject({ sets: 3, reps: 12, weight: 150 });
    const gymB = BASE_12_WEEK.days[2].exercises;
    expect(gymB.find((e) => e.slug === 'lat-pulldown')).toMatchObject({ sets: 3, reps: 10, weight: 32 });
    const gymC = BASE_12_WEEK.days[3].exercises;
    expect(gymC.find((e) => e.slug === 'negative-pull-up')).toMatchObject({ sets: 4, reps: 5 });
    expect(gymC.find((e) => e.slug === 'wall-plank-hold')!.note).toMatch(/week 5/i);
  });
  it('keeps the guide tables rectangular', () => {
    for (const s of BASE_12_WEEK.guide ?? []) {
      if (!s.table) continue;
      for (const row of s.table.rows) expect(row.length, `${s.title}: ${row.join('|')}`).toBe(s.table.head.length);
    }
    expect(BASE_12_WEEK.guide?.map((s) => s.title)).toContain('Equipment and safety');
  });
});
