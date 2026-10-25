import type { PoolClient } from 'pg';
import {
  STARTER_DAYS,
  STARTER_PLAN_NAME,
  STARTER_PLAN_NOTES,
  type TemplateDay,
} from './starter';

export interface GuideSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
  /** Rendered after the table. */
  after?: string[];
}

export interface PlanTemplate {
  key: string;
  name: string;
  description: string;
  notes: string;
  days: TemplateDay[];
  guide?: GuideSection[];
  /** Applied only when an account is created from this template. */
  settings?: { proteinTarget?: number };
}

const WARMUP_NOTE =
  'Wrist circles and palm rocks, band pull-aparts, scapular push-ups, a deep squat hold and cat-cow. Stop every working set with 1-2 reps left in the tank.';

const HOME_DAY = (weekday: number): TemplateDay => ({
  name: 'Home: mobility, push-ups, core',
  weekday,
  exercises: [
    { slug: 'wrist-mobility', sets: 1, reps: 180, note: 'Wrist circles, palm rocks, finger stretches (3 min). Do it before any push-up.' },
    { slug: 'deep-squat-hold', sets: 3, reps: 45, note: 'Hips block (5 min). This fixes your range for squats and L-sits.' },
    { slug: 'hip-90-90-stretch', sets: 1, reps: 60, note: 'Per side. The plan gives no hold time; about 1 min is used here.' },
    { slug: 'hamstring-stretch', sets: 1, reps: 60, note: 'Per side. The plan gives no hold time; about 1 min is used here.' },
    { slug: 'push-up', sets: 5, reps: 6, note: '5-6 reps. Easy sets, 60 s rest, on the holders. After the first pass, repeat the push-ups and core block once.' },
    { slug: 'hollow-hold', sets: 3, reps: 20, note: '15-20 s. Controlled.' },
    { slug: 'glute-bridge', sets: 3, reps: 15, note: 'Controlled.' },
    { slug: 'plank', sets: 2, reps: 60, note: '45-60 s. Straight line from head to heels.' },
  ],
});

/** Calisthenics plan: 12-week base phase (Peti, 2026-10-24). */
export const BASE_12_WEEK: PlanTemplate = {
  key: 'base-12-week',
  name: 'Calisthenics plan: 12-week base phase',
  description:
    '3 gym sessions + 2 short home sessions a week. Builds pulling strength toward a strict pull-up, with a fat-loss target of 94 kg to 85-87 kg.',
  notes:
    'Three gym sessions and two short home sessions a week build the pulling strength you lack. The aim is a strict pull-up in months 4-8 and a drop from 94 kg to 85-87 kg by about month 5-6. Keep one rest day between gym sessions and stop every working set with 1-2 reps left in the tank.',
  settings: { proteinTarget: 150 },
  days: [
    {
      name: 'Gym A: pull focus',
      weekday: 1,
      exercises: [
        { slug: 'gym-warm-up', sets: 1, reps: 480, note: `8 min. ${WARMUP_NOTE}` },
        { slug: 'assisted-pull-up-machine', sets: 4, reps: 8, weight: 60, note: '6-8 reps. Start at the assist where you get 6-8 reps (about 60 kg), 3 s lowering phase.' },
        { slug: 'dead-hang', sets: 3, reps: 20, note: 'Max time. Aim for 20 s, then 30 s. Stop when grip fails.' },
        { slug: 'inverted-row', sets: 3, reps: 12, note: '8-12 reps. Smith bar at hip height. Lower the bar to make it harder.' },
        { slug: 'push-up', sets: 3, reps: 10, note: '8-10 reps. Chest to floor. Use an incline if form breaks.' },
        { slug: 'leg-press', sets: 3, reps: 12, weight: 150, note: '10-12 reps. Keep your current weight, 150 kg.' },
        { slug: 'hollow-hold', sets: 3, reps: 20, note: '15-20 s. Lower back stays on the floor.' },
      ],
    },
    HOME_DAY(2),
    {
      name: 'Gym B: push and legs',
      weekday: 3,
      exercises: [
        { slug: 'gym-warm-up', sets: 1, reps: 480, note: `8 min. ${WARMUP_NOTE}` },
        { slug: 'push-up', sets: 4, reps: 12, note: '8-12 reps. Stop 1-2 reps before failure.' },
        { slug: 'assisted-dip', sets: 3, reps: 8, note: '6-8 reps. Machine or band. Skip it if the left shoulder hurts (see Equipment and safety).' },
        { slug: 'dumbbell-overhead-press', sets: 3, reps: 12, note: '8-12 reps. Light and controlled.' },
        { slug: 'lat-pulldown', sets: 3, reps: 10, weight: 32, note: '8-10 reps. Use the 32 kg you already handle.' },
        { slug: 'split-squat', sets: 3, reps: 8, note: '8 per leg. Bodyweight, hands on a support if needed.' },
        { slug: 'plank', sets: 3, reps: 60, note: '45-60 s. Squeeze glutes, ribs down.' },
      ],
    },
    {
      name: 'Gym C: pull plus handstand prep',
      weekday: 5,
      exercises: [
        { slug: 'gym-warm-up', sets: 1, reps: 480, note: `8 min. ${WARMUP_NOTE}` },
        { slug: 'negative-pull-up', sets: 4, reps: 5, note: '3-5 reps. Jump up, then lower for 4-5 s.' },
        { slug: 'assisted-pull-up-machine', sets: 3, reps: 6, weight: 60, note: '5-6 reps. Same assist as Monday, slower reps.' },
        { slug: 'inverted-row-feet-elevated', sets: 3, reps: 10, note: "6-10 reps. Harder than Monday's version." },
        { slug: 'wall-plank-hold', sets: 3, reps: 30, note: '20-30 s. From week 5 only: hands on floor, feet on wall, hips low. Weeks 1-4: skip it and add 5 minutes of hip stretching. Also skip until the left shoulder is checked.' },
        { slug: 'glute-bridge', sets: 3, reps: 15, note: 'Pause 1 s at the top.' },
        { slug: 'hanging-knee-raise', sets: 3, reps: 10, note: '6-10 reps. Add after the dead hang reaches 20 s.' },
      ],
    },
    HOME_DAY(6),
  ],
  guide: [
    {
      title: 'Weekly schedule',
      paragraphs: [
        'Pull-ups are your bottleneck, so every gym day trains pulling. Rest days are real rest, and walking replaces extra cardio.',
      ],
      table: {
        head: ['Day', 'Session', 'Length'],
        rows: [
          ['Monday', 'Gym A: pull focus', '60 min'],
          ['Tuesday', 'Home: mobility, push-ups, core', '20 min'],
          ['Wednesday', 'Gym B: push and legs', '60 min'],
          ['Thursday', 'Rest, walk 8-10k steps', '-'],
          ['Friday', 'Gym C: pull plus handstand prep', '60 min'],
          ['Saturday', 'Home: mobility, push-ups, core', '20 min'],
          ['Sunday', 'Rest, walk 8-10k steps', '-'],
        ],
      },
      after: ['You can shift days, but keep one rest day between gym sessions.'],
    },
    {
      title: 'Gym sessions',
      paragraphs: [
        'Start each session with 8 minutes of warm-up: wrist circles and palm rocks, band pull-aparts, scapular push-ups, a deep squat hold and cat-cow. Stop every working set with 1-2 reps left in the tank.',
        'Weeks 1-4: skip the wall plank (Gym C) and add 5 minutes of hip stretching.',
      ],
    },
    {
      title: 'Home sessions (Tuesday and Saturday, about 20 minutes)',
      paragraphs: [
        'These need only your mat and push-up holders. Do the circuit once through, then repeat the push-ups and core block.',
        'Once you buy a doorway bar, add dead hangs (3 x max) and scapular pulls (3 x 8) at the end.',
      ],
    },
    {
      title: 'Progression',
      paragraphs: [
        'Write down every set. When you hit the top of the rep range on all sets with clean form, make the exercise harder: cut 2.5-5 kg of assist, lower the inverted row bar, or move push-ups to a lower incline. Your weight drops over the same weeks, so the same assist feels easier without extra effort.',
      ],
      table: {
        head: ['Block', 'Assisted pull-up assist', 'Dead hang', 'Push-ups', 'Dips'],
        rows: [
          ['Weeks 1-4', '60 kg down to 52.5-55 kg', '10-15 s', '3 x 10', 'Machine, 3 x 6'],
          ['Weeks 5-8', '45-50 kg', '20 s', '3 x 12', 'Machine, 3 x 8'],
          ['Weeks 9-12', 'about 40 kg (35 kg if all goes well)', '30 s', '3 x 15', 'Negatives on parallel bars, 3 x 3-5'],
        ],
      },
      after: ['If you miss the target for two weeks in a row, repeat the block. A longer base phase costs you nothing.'],
    },
    {
      title: 'Fat loss: 94 kg to 85-87 kg',
      paragraphs: [
        'Losing 0.3-0.5 kg a week gets you there in roughly 18-24 weeks (month 5-6) and protects your muscle. Faster than 0.5 kg a week costs strength, and strength is the point.',
      ],
      bullets: [
        'Calories: eat about 400 kcal below maintenance. Find maintenance first: eat normally for 2 weeks, weigh yourself every morning, and use the weekly average. Stable weight means that intake is maintenance.',
        'Protein: about 150 g a day, spread over 3-4 meals.',
        'Steps: 8-10k a day, which is most of your cardio.',
        'Sleep: 7-8 hours. Short sleep stalls both fat loss and recovery.',
        'Tracking: morning weight daily (trust the weekly average), waist at the navel every 2 weeks.',
      ],
      table: {
        head: ['Checkpoint', 'Expected weight'],
        rows: [
          ['Week 4', 'about 92.5 kg'],
          ['Week 8', 'about 91 kg'],
          ['Week 12', 'about 89.5 kg'],
          ['Month 5-6', '85-87 kg'],
        ],
      },
      after: [
        'If the weekly average does not move for 2 weeks, cut 150-200 kcal or add 2k steps. If your lifts drop for 2+ weeks, eat 150 kcal more.',
      ],
    },
    {
      title: 'Retests',
      paragraphs: ['Retest at the end of weeks 4, 8 and 12, fresh and in the same order. Record these numbers:'],
      table: {
        head: ['Test', 'Start', 'Week 4', 'Week 8', 'Week 12'],
        rows: [
          ['Assist for 6 pull-up reps (kg)', 'about 60', '', '', ''],
          ['Dead hang (s)', 'unknown', '', '', ''],
          ['Push-ups, chest to floor', '8-10', '', '', ''],
          ['Plank (s)', '30-45', '', '', ''],
          ['Body weight (kg, weekly average)', '94', '', '', ''],
          ['Waist at navel (cm)', '', '', '', ''],
        ],
      },
    },
    {
      title: 'Roadmap after week 12',
      paragraphs: ['After week 12, the plan runs on skill milestones, not on the calendar:'],
      bullets: [
        'Months 4-6: first strict pull-up or 5-second negatives, parallel-bar dips, 30 s wall handstand hold with belly to the wall.',
        'Months 7-9: 3-5 pull-ups, chin-ups, wall handstand with chest to the wall, tuck L-sit on parallettes.',
        'Months 10-12: 5+ pull-ups, freestanding handstand attempts, L-sit.',
      ],
      after: ['Muscle-up progressions come in year 2, after 8-10 strict pull-ups and 10+ parallel-bar dips.'],
    },
    {
      title: 'Equipment and safety',
      table: {
        head: ['Item', 'When', 'Why'],
        rows: [
          ['Mat and push-up holders', 'Now (you have them)', 'Home sessions'],
          ['Resistance bands (light, medium, heavy loops)', 'Week 1', 'Assisted pull-ups at home and warm-ups'],
          ['Doorway or wall pull-up bar', 'Week 2-4', 'Home dead hangs and negatives'],
          ['Parallettes', 'Month 4+', 'L-sits and handstand work'],
          ['Notebook or notes app', 'Day 1', 'Log every set'],
        ],
      },
      after: [
        'Left shoulder: sharp pain is a stop signal, not something to push through. Get a physiotherapist or sports doctor to check it before you add dips, pike push-ups or handstand work. Until then, skip assisted dips and the wall plank, and use pull-ups, rows and push-ups only where they stay pain-free.',
        'Other rules: wrist cracking without pain is fine. Stop on tingling, numbness or joint pain. Keep your hip mobility block in every home session, because stiff hips limit squats and L-sits.',
      ],
    },
  ],
};

export const STARTER_TEMPLATE: PlanTemplate = {
  key: 'starter',
  name: STARTER_PLAN_NAME,
  description: 'Generic hybrid gym + calisthenics starter: pull, push + handstand, legs + core, skills.',
  notes: STARTER_PLAN_NOTES,
  days: STARTER_DAYS,
};

export const PLAN_TEMPLATES: PlanTemplate[] = [BASE_12_WEEK, STARTER_TEMPLATE];

export function getTemplate(key: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES.find((t) => t.key === key);
}

/** Creates a plan (days and exercises) for a user from a template. Runs inside the caller's transaction. */
export async function importTemplate(c: PoolClient, userId: number, tpl: PlanTemplate, makeActive: boolean): Promise<number> {
  if (makeActive) await c.query('UPDATE plans SET active = FALSE WHERE user_id = $1 AND active', [userId]);
  const plan = await c.query<{ id: number }>(
    'INSERT INTO plans (user_id, name, notes, active, guide) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [userId, tpl.name, tpl.notes, makeActive, tpl.guide ? JSON.stringify(tpl.guide) : null],
  );
  const planId = plan.rows[0].id;

  let dayPos = 0;
  for (const day of tpl.days) {
    const d = await c.query<{ id: number }>(
      'INSERT INTO plan_days (plan_id, position, name, weekday) VALUES ($1,$2,$3,$4) RETURNING id',
      [planId, dayPos++, day.name, day.weekday],
    );
    let pos = 0;
    for (const ex of day.exercises) {
      const found = await c.query<{ id: number }>('SELECT id FROM exercises WHERE slug = $1 AND user_id IS NULL', [ex.slug]);
      if (found.rowCount === 0) throw new Error(`Template "${tpl.key}" references unknown exercise "${ex.slug}"`);
      await c.query(
        `INSERT INTO plan_exercises (plan_day_id, exercise_id, position, target_sets, target_reps, target_weight, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [d.rows[0].id, found.rows[0].id, pos++, ex.sets, ex.reps, ex.weight ?? null, ex.note ?? ''],
      );
    }
  }
  return planId;
}
