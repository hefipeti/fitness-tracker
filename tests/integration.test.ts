/**
 * Integration tests against a real PostgreSQL database.
 * Run with:  TEST_DATABASE_URL=postgres://user:pass@host:5432/fitness_test npm test
 * WARNING: the target database's public schema is wiped before the run.
 * Skipped automatically when TEST_DATABASE_URL is not set.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The signed-in user is switched per test through this shared object.
const as = vi.hoisted(() => ({ uid: 0, admin: true }));

vi.mock('@/lib/auth', () => ({
  requireUserId: async () => as.uid,
  requireUser: async () => ({ id: as.uid, username: `user${as.uid}`, isAdmin: as.admin }),
  getCurrentUser: async () => ({ id: as.uid, username: `user${as.uid}`, isAdmin: as.admin }),
  startSession: async () => undefined,
  endSession: async () => undefined,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const fd = (o: Record<string, string | number>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, String(v));
  return f;
};

async function redirectTarget(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const m = /^REDIRECT:(.*)$/.exec((e as Error).message);
    if (m) return m[1];
    throw e;
  }
  throw new Error('expected a redirect');
}

describe.skipIf(!url)('database integration', () => {
  // Lazy imports so DATABASE_URL is set before the pool is created.
  let db: typeof import('@/lib/db');
  let training: typeof import('@/lib/actions/training');
  let tasks: typeof import('@/lib/actions/tasks');
  let food: typeof import('@/lib/actions/food');
  let plans: typeof import('@/lib/actions/plans');
  let nutritionPlans: typeof import('@/lib/actions/nutrition-plans');
  let profile: typeof import('@/lib/actions/profile');
  let queries: typeof import('@/lib/queries');
  let users: typeof import('@/lib/users');
  let core: typeof import('@/lib/auth-core');
  let dates: typeof import('@/lib/dates');

  let peti = 0;
  let partner = 0;
  let legacySessionId = 0;

  const exId = async (slug: string) => (await db.q1<{ id: number }>('SELECT id FROM exercises WHERE slug = $1', [slug]))!.id;
  const xp = async (uid: number) => (await db.q1<{ t: number }>('SELECT COALESCE(sum(xp),0)::int AS t FROM xp_events WHERE user_id = $1', [uid]))!.t;
  const achXp = (r: { achievements: { xp: number }[] }) => r.achievements.reduce((n, a) => n + a.xp, 0);
  const asUser = (uid: number, admin = false) => {
    as.uid = uid;
    as.admin = admin;
  };

  beforeAll(async () => {
    db = await import('@/lib/db');
    await db.q('DROP SCHEMA public CASCADE');
    await db.q('CREATE SCHEMA public');
    const { runMigrations } = await import('@/lib/migrations');
    await runMigrations();
    training = await import('@/lib/actions/training');
    tasks = await import('@/lib/actions/tasks');
    food = await import('@/lib/actions/food');
    plans = await import('@/lib/actions/plans');
    nutritionPlans = await import('@/lib/actions/nutrition-plans');
    profile = await import('@/lib/actions/profile');
    queries = await import('@/lib/queries');
    users = await import('@/lib/users');
    core = await import('@/lib/auth-core');
    dates = await import('@/lib/dates');
  });

  afterAll(async () => {
    await db?.getPool().end();
  });

  // ---------------------------------------------------------------- upgrade path

  it('migrations are idempotent and leave pre-account data unowned', async () => {
    const { runMigrations } = await import('@/lib/migrations');
    await runMigrations();
    expect((await db.q('SELECT 1 FROM schema_migrations')).length).toBe(7);
    expect((await db.q('SELECT 1 FROM plans WHERE user_id IS NULL')).length).toBe(1); // starter plan from migration 2
    expect((await db.q('SELECT 1 FROM foods WHERE user_id IS NULL')).length).toBe(8);
    expect((await db.q('SELECT 1 FROM exercises WHERE slug = $1', ['assisted-pull-up-machine'])).length).toBe(1);

    // Simulate history recorded by the single-user version.
    const s = await db.q1<{ id: number }>(
      `INSERT INTO sessions (session_date, name, completed_at) VALUES (current_date - 3, 'Legacy workout', now()) RETURNING id`,
    );
    legacySessionId = s!.id;
    await db.q(`INSERT INTO session_sets (session_id, exercise_id, set_no, reps) VALUES ($1, $2, 1, 12)`, [legacySessionId, await exId('push-up')]);
    await db.q(`INSERT INTO xp_events (event_date, source, ref, label, xp) VALUES (current_date - 3, 'workout', $1, 'Workout: Legacy workout', 70)`, [`session:${legacySessionId}`]);
    await db.q(`INSERT INTO body_weights (log_date, kg) VALUES (current_date - 3, 94.0)`);
    await db.q(`INSERT INTO tasks (title, due_date) VALUES ('Legacy task', current_date)`);
  });

  it('the first account becomes admin, adopts existing data and gets the 12-week plan as its main plan', async () => {
    expect(await users.countUsers()).toBe(0);
    const r = await users.createAccount({
      username: 'Peti',
      password: 'correct horse battery',
      hunterName: 'Peti',
      templateKey: 'base-12-week',
      isAdmin: false,
    });
    peti = r.userId;
    expect(r.firstAccount).toBe(true);
    expect((await db.q1<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [peti]))!.is_admin).toBe(true);

    // adopted
    expect((await queries.getSessionDetail(peti, legacySessionId))?.session.name).toBe('Legacy workout');
    expect(await xp(peti)).toBe(70);
    expect((await queries.listFoods(peti)).length).toBe(8);
    expect((await queries.listWeights(peti)).length).toBe(1);
    expect((await queries.listOpenTasks(peti)).map((t) => t.title)).toEqual(['Legacy task']);
    for (const t of ['plans', 'sessions', 'foods', 'tasks', 'xp_events', 'body_weights', 'settings']) {
      expect((await db.q(`SELECT 1 FROM ${t} WHERE user_id IS NULL`)).length, t).toBe(0);
    }

    // settings: name from the form, protein from the plan, personal data kept
    const s = await db.q1<{ hunter_name: string; protein_target: number; goal_weight: number }>(
      'SELECT hunter_name, protein_target, goal_weight FROM settings WHERE user_id = $1',
      [peti],
    );
    expect(s).toMatchObject({ hunter_name: 'Peti', protein_target: 150 });
    expect(s!.goal_weight).toBe(86);

    // the 12-week plan is the active one; the old starter plan is kept but inactive
    const active = (await queries.getActivePlan(peti))!;
    expect(active.name).toBe('Calisthenics plan: 12-week base phase');
    expect(active.days.map((d) => d.weekday)).toEqual([1, 2, 3, 5, 6]);
    expect(active.days.map((d) => d.exercises.length)).toEqual([7, 8, 7, 7, 8]);
    expect(active.guide?.length).toBeGreaterThanOrEqual(8);
    const pull = active.days[0].exercises.find((e) => e.slug === 'assisted-pull-up-machine')!;
    expect(pull).toMatchObject({ mode: 'assisted', targetSets: 4, targetReps: 8, targetWeight: 60 });
    const all = await queries.listPlans(peti);
    expect(all.map((p) => p.name)).toEqual(['Calisthenics plan: 12-week base phase', 'Foundation Block']);
    expect(all.filter((p) => p.active)).toHaveLength(1);
  });

  it('rejects bad credentials and duplicate usernames (case-insensitive)', async () => {
    const base = { password: 'long enough pw', hunterName: 'X', templateKey: 'none', isAdmin: false };
    await expect(users.createAccount({ ...base, username: 'peti' })).rejects.toThrow(/already taken/);
    await expect(users.createAccount({ ...base, username: 'PETI' })).rejects.toThrow(/already taken/);
    await expect(users.createAccount({ ...base, username: 'x' })).rejects.toThrow(/Username/);
    await expect(users.createAccount({ ...base, username: 'newuser', password: 'short' })).rejects.toThrow(/at least 8/);
    await expect(users.createAccount({ ...base, username: 'newuser', templateKey: 'nope' })).rejects.toThrow(/template/);
    expect(await users.countUsers()).toBe(1);
  });

  it('only the admin can add the partner account; it starts clean with its own starter data', async () => {
    asUser(peti, false);
    const denied = await profile.createAccountAction(fd({ username: 'partner', hunterName: 'Partner', password: 'another-long-pass', template: 'starter' }));
    expect(denied).toMatchObject({ error: expect.stringMatching(/administrator/i) });

    asUser(peti, true);
    const ok = await profile.createAccountAction(fd({ username: 'partner', hunterName: 'Partner', password: 'another-long-pass', template: 'starter' }));
    expect(ok).toMatchObject({ note: expect.stringContaining('partner') });
    partner = (await db.q1<{ id: number }>("SELECT id FROM users WHERE username = 'partner'"))!.id;

    expect((await db.q1<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [partner]))!.is_admin).toBe(false);
    expect((await queries.getActivePlan(partner))?.name).toBe('Foundation Block');
    expect((await queries.listPlans(partner)).length).toBe(1);
    expect((await queries.listFoods(partner)).length).toBe(8);
    expect((await queries.getHunterLite(partner)).name).toBe('Partner');
    expect(await xp(partner)).toBe(0);
    expect(await queries.listSessions(partner)).toHaveLength(0);
    expect(await queries.listWeights(partner)).toHaveLength(0);
    expect(await queries.listOpenTasks(partner)).toHaveLength(0);
    const ps = await db.q1<{ protein_target: number; goal_weight: number | null }>('SELECT protein_target, goal_weight FROM settings WHERE user_id = $1', [partner]);
    expect(ps).toEqual({ protein_target: 160, goal_weight: null });
    // and Peti is untouched
    expect(await xp(peti)).toBe(70);
  });

  it('password change checks the current password and signs out other sessions', async () => {
    asUser(partner);
    const { token } = await core.createSessionRecord(partner);
    expect((await core.findSessionUser(token))?.id).toBe(partner);

    expect(await profile.changePasswordAction(fd({ current: 'wrong', next: 'brand new password', confirm: 'brand new password' }))).toMatchObject({ error: expect.stringMatching(/incorrect/) });
    expect(await profile.changePasswordAction(fd({ current: 'another-long-pass', next: 'brand new password', confirm: 'different' }))).toMatchObject({ error: expect.stringMatching(/match/) });
    expect(await profile.changePasswordAction(fd({ current: 'another-long-pass', next: 'short', confirm: 'short' }))).toMatchObject({ error: expect.stringMatching(/8/) });
    expect(await profile.changePasswordAction(fd({ current: 'another-long-pass', next: 'brand new password', confirm: 'brand new password' }))).toMatchObject({ note: expect.any(String) });

    const row = (await db.q1<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [partner]))!;
    expect(await core.verifyPassword('brand new password', row.password_hash)).toBe(true);
    expect(await core.verifyPassword('another-long-pass', row.password_hash)).toBe(false);
    expect(await core.findSessionUser(token)).toBeNull(); // old session revoked
  });

  it('session tokens expire, are stored hashed, and cannot be guessed', async () => {
    const { token } = await core.createSessionRecord(peti);
    const stored = await db.q<{ token_hash: string }>('SELECT token_hash FROM auth_sessions WHERE user_id = $1', [peti]);
    expect(stored.some((r) => r.token_hash === token)).toBe(false);
    expect((await core.findSessionUser(token))?.username).toBe('Peti');
    expect(await core.findSessionUser(token + 'x')).toBeNull();
    expect(await core.findSessionUser('')).toBeNull();
    await db.q("UPDATE auth_sessions SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [peti]);
    expect(await core.findSessionUser(token)).toBeNull();
  });

  // ---------------------------------------------------------------- Peti's training

  let gymA = 0;
  let petiSession = 0;

  it('starts Gym A from the plan and snapshots its exercises, notes and loads', async () => {
    asUser(peti, true);
    const plan = (await queries.getActivePlan(peti))!;
    gymA = plan.days[0].id;
    const target = await redirectTarget(training.startSessionAction(fd({ planDayId: gymA })));
    petiSession = Number(target.split('/').pop());
    const detail = (await queries.getSessionDetail(peti, petiSession))!;
    expect(detail.session.name).toBe('Gym A: pull focus');
    expect(detail.exercises).toHaveLength(7);
    const assisted = detail.exercises.find((e) => e.slug === 'assisted-pull-up-machine')!;
    expect(assisted).toMatchObject({ mode: 'assisted', targetSets: 4, targetReps: 8, targetWeight: 60 });
    // starting the same day again resumes instead of duplicating
    expect(await redirectTarget(training.startSessionAction(fd({ planDayId: gymA })))).toBe(`/training/${petiSession}`);
  });

  it('refuses to complete an empty session (as a readable error, not a thrown one)', async () => {
    expect(await training.completeSessionAction(petiSession)).toEqual({ error: 'Log at least one set before completing the session' });
  });

  it('completing a workout awards XP once and unlocks achievements for legacy history too', async () => {
    const pull = await exId('assisted-pull-up-machine');
    const hang = await exId('dead-hang');
    for (const n of [1, 2, 3, 4]) await training.logSetAction({ sessionId: petiSession, exerciseId: pull, setNo: n, reps: 8, seconds: null, weightKg: 60 });
    await training.logSetAction({ sessionId: petiSession, exerciseId: hang, setNo: 1, reps: null, seconds: 12, weightKg: null });

    const before = await xp(peti);
    const r = await training.completeSessionAction(petiSession);
    if ('error' in r) throw new Error(r.error);
    expect(r.gained - achXp(r)).toBe(50 + 5 * 3); // base + 3 per set, no PR (no earlier assisted history)
    expect(r.achievements.map((a) => a.key)).toContain('first-blood');
    expect(await xp(peti)).toBe(before + r.gained);

    const again = await training.completeSessionAction(petiSession);
    expect(again).toMatchObject({ gained: 0, achievements: [] });
    expect(await training.logSetAction({ sessionId: petiSession, exerciseId: pull, setNo: 5, reps: 8, seconds: null, weightKg: 60 })).toEqual({
      error: 'This session is already completed',
    });
  });

  it('less assist counts as a personal record; fewer reps at the same assist does not', async () => {
    const plan = (await queries.getActivePlan(peti))!;
    const gymC = plan.days.find((d) => d.name.startsWith('Gym C'))!;
    const pull = await exId('assisted-pull-up-machine');

    const s2 = Number((await redirectTarget(training.startSessionAction(fd({ planDayId: gymC.id })))).split('/').pop());
    await training.logSetAction({ sessionId: s2, exerciseId: pull, setNo: 1, reps: 6, seconds: null, weightKg: 55 });
    const r2 = await training.completeSessionAction(s2);
    if ('error' in r2) throw new Error(r2.error);
    expect(r2.gained - achXp(r2)).toBe(50 + 3 + 20); // base + set + one PR

    const s3 = Number((await redirectTarget(training.startSessionAction(fd({ name: 'Extra' })))).split('/').pop());
    await training.addSessionExerciseAction(fd({ sessionId: s3, exerciseId: pull, sets: 1, reps: 5 }));
    await training.logSetAction({ sessionId: s3, exerciseId: pull, setNo: 1, reps: 5, seconds: null, weightKg: 55 });
    const r3 = await training.completeSessionAction(s3);
    if ('error' in r3) throw new Error(r3.error);
    expect(r3.gained - achXp(r3)).toBe(50 + 3); // lower reps at same assist: no PR

    const series = await queries.getExerciseProgress(peti, pull, 'assisted', '2000-01-01', 'week');
    expect(series).toHaveLength(1);
    expect(series[0].value).toBe(55); // lowest assist with 5+ reps this week

    const prev = (await queries.getSessionDetail(peti, s3))!.exercises[0];
    expect(prev.last.map((l) => l.weightKg)).toEqual([55]); // "last time" hint comes from the previous session
  });

  it('assist weight is not counted as lifted volume', async () => {
    const agg = await (await import('@/lib/engine')).getAggregate(peti);
    const a = agg.exercises.find((e) => e.slug === 'assisted-pull-up-machine')!;
    expect(a.mode).toBe('assisted');
    expect(a.volumeKg).toBe(0);
  });

  it('records timed holds and weighted sets with the right metrics', async () => {
    const s = Number((await redirectTarget(training.startSessionAction(fd({ name: 'Free test' })))).split('/').pop());
    await training.addSessionExerciseAction(fd({ sessionId: s, exerciseId: await exId('wall-handstand-hold'), sets: 2, reps: 10 }));
    await training.addSessionExerciseAction(fd({ sessionId: s, exerciseId: await exId('lat-pulldown'), sets: 2, reps: 10 }));
    await training.logSetAction({ sessionId: s, exerciseId: await exId('wall-handstand-hold'), setNo: 1, reps: null, seconds: 22, weightKg: null });
    await training.logSetAction({ sessionId: s, exerciseId: await exId('lat-pulldown'), setNo: 1, reps: 10, seconds: null, weightKg: 60 });
    const r = await training.completeSessionAction(s);
    if ('error' in r) throw new Error(r.error);
    expect(r.achievements.map((a) => a.key)).toContain('wall-hs-20');

    const hs = await queries.getExerciseProgress(peti, await exId('wall-handstand-hold'), 'seconds', '2000-01-01', 'week');
    expect(hs[0].value).toBe(22);
    const lat = await queries.getExerciseProgress(peti, await exId('lat-pulldown'), 'weighted', '2000-01-01', 'week');
    expect(lat[0].value).toBeCloseTo(80, 1); // Epley: 60 * (1 + 10/30)
  });

  // ---------------------------------------------------------------- isolation

  it('a second account cannot read or change the first account\'s workouts', async () => {
    asUser(partner);
    expect(await queries.getSessionDetail(partner, petiSession)).toBeNull();
    expect(await queries.getSessionDetail(partner, legacySessionId)).toBeNull();
    expect(await queries.listSessions(partner)).toHaveLength(0);

    const pull = await exId('assisted-pull-up-machine');
    expect(await training.logSetAction({ sessionId: petiSession, exerciseId: pull, setNo: 9, reps: 1, seconds: null, weightKg: 1 })).toEqual({ error: 'Session not found' });
    expect(await training.completeSessionAction(petiSession)).toEqual({ error: 'Session not found' });
    await expect(training.addSessionExerciseAction(fd({ sessionId: petiSession, exerciseId: pull, sets: 1, reps: 1 }))).rejects.toThrow();

    // starting a session from somebody else's plan day is refused
    await expect(training.startSessionAction(fd({ planDayId: gymA }))).rejects.toThrow(/Plan day not found/);

    // delete is a silent no-op for foreign ids and must not remove the XP
    const xpBefore = await xp(peti);
    await redirectTarget(training.deleteSessionAction(fd({ sessionId: petiSession })));
    expect(await xp(peti)).toBe(xpBefore);
    asUser(peti, true);
    expect(await queries.getSessionDetail(peti, petiSession)).not.toBeNull();
  });

  it('plans, days and plan exercises are private', async () => {
    asUser(peti, true);
    const petiPlan = (await queries.getActivePlan(peti))!;
    const day = petiPlan.days[0];
    const ex = day.exercises[1];

    asUser(partner);
    await expect(plans.setActivePlanAction(fd({ id: petiPlan.id }))).rejects.toThrow(/Plan not found/);
    await expect(plans.updatePlanExerciseAction(fd({ id: ex.id, sets: 1, reps: 1, weight: '', note: 'hacked' }))).rejects.toThrow(/not found/i);
    await expect(plans.deletePlanExerciseAction(fd({ id: ex.id }))).rejects.toThrow(/not found/i);
    await expect(plans.updateDayAction(fd({ id: day.id, name: 'hacked', weekday: 1 }))).rejects.toThrow(/not found/i);
    await expect(plans.deleteDayAction(fd({ id: day.id }))).rejects.toThrow(/not found/i);
    await expect(plans.addDayAction(fd({ planId: petiPlan.id, name: 'sneaky', weekday: 2 }))).rejects.toThrow(/Plan not found/);
    await expect(plans.addPlanExerciseAction(fd({ dayId: day.id, exerciseId: await exId('push-up'), sets: 1, reps: 1 }))).rejects.toThrow(/not found/i);
    await expect(plans.movePlanExerciseAction(fd({ id: ex.id, dir: 'down' }))).rejects.toThrow(/not found/i);
    await expect(plans.duplicatePlanAction(fd({ id: petiPlan.id }))).rejects.toThrow(/Plan not found/);
    await plans.deletePlanAction(fd({ id: petiPlan.id })).catch(() => undefined); // redirects; must not delete

    expect(await queries.getPlan(partner, petiPlan.id)).toBeNull();
    asUser(peti, true);
    const after = (await queries.getActivePlan(peti))!;
    expect(after.id).toBe(petiPlan.id);
    expect(after.days[0].exercises[1]).toMatchObject({ id: ex.id, note: ex.note });
    expect(after.days).toHaveLength(5);
  });

  it('tasks, food, weight and settings are private', async () => {
    asUser(peti, true);
    const t = (await queries.listOpenTasks(peti))[0];
    await food.logWeightAction(fd({ kg: 93.4 }));
    const chicken = (await queries.listFoods(peti)).find((f) => f.name.startsWith('Chicken'))!;
    await food.logFoodAction(fd({ meal: 'dinner', foodId: chicken.id, servings: 1 }));
    const petiLog = (await queries.getFoodDay(peti, dates.todayStr())).logs[0];

    asUser(partner);
    expect(await tasks.toggleTaskAction(t.id)).toEqual({ error: 'Task not found' });
    await tasks.deleteTaskAction(fd({ id: t.id }));
    expect(await food.logFoodAction(fd({ meal: 'lunch', foodId: chicken.id, servings: 1 }))).toEqual({ error: 'Food not found' });
    await food.deleteFoodLogAction(petiLog.id);
    await food.updateFoodAction(fd({ id: chicken.id, name: 'Hacked', servingLabel: '1', kcal: 1, protein: 1, carbs: 1, fat: 1 }));
    await food.archiveFoodAction(fd({ id: chicken.id }));
    await food.deleteWeightAction(fd({ date: dates.todayStr() }));
    expect(await queries.listWeights(partner)).toHaveLength(0);
    expect((await queries.getFoodDay(partner, dates.todayStr())).logs).toHaveLength(0);

    asUser(peti, true);
    expect((await queries.listOpenTasks(peti)).map((x) => x.id)).toContain(t.id);
    expect((await queries.getFoodDay(peti, dates.todayStr())).logs).toHaveLength(1);
    const still = (await queries.listFoods(peti)).find((f) => f.id === chicken.id)!;
    expect(still).toMatchObject({ name: chicken.name, archived: false });
    expect((await queries.listWeights(peti, 5))[0].kg).toBe(93.4);

    // settings are per account
    await profile.updateSettingsAction(fd({ hunterName: 'Peti', kcalTarget: 2100, proteinTarget: 150, carbsTarget: 200, fatTarget: 60, startWeight: 94, goalWeight: 86, heightCm: 182 }));
    asUser(partner);
    await profile.updateSettingsAction(fd({ hunterName: 'Partner', kcalTarget: 1800, proteinTarget: 110, carbsTarget: 180, fatTarget: 55, startWeight: 65, goalWeight: 60, heightCm: 168 }));
    const { getSettings } = await import('@/lib/settings');
    expect(await getSettings(peti)).toMatchObject({ kcalTarget: 2100, goalWeight: 86, hunterName: 'Peti' });
    expect(await getSettings(partner)).toMatchObject({ kcalTarget: 1800, goalWeight: 60, hunterName: 'Partner' });
  });

  it('each account gets its own XP, level and achievements', async () => {
    asUser(partner);
    const r = await training.startSessionAction(fd({ name: 'Partner workout' })).catch((e: Error) => e.message);
    const sid = Number(String(r).split('/').pop());
    await training.addSessionExerciseAction(fd({ sessionId: sid, exerciseId: await exId('squat'), sets: 1, reps: 10 }));
    await training.logSetAction({ sessionId: sid, exerciseId: await exId('squat'), setNo: 1, reps: 10, seconds: null, weightKg: null });
    const done = await training.completeSessionAction(sid);
    if ('error' in done) throw new Error(done.error);
    expect(done.achievements.map((a) => a.key)).toContain('first-blood');

    const partnerXp = await xp(partner);
    expect(partnerXp).toBe(done.gained);
    expect((await queries.listAchievements(partner)).filter((a) => a.unlockedAt).length).toBeGreaterThanOrEqual(1);
    expect((await queries.getHunterFull(partner)).sessions).toBe(1);
    asUser(peti, true);
    expect((await queries.getHunterFull(peti)).sessions).toBe(5); // legacy + Gym A + Gym C + Extra + Free test
    expect(await xp(peti)).not.toBe(partnerXp);
    // Peti's weekly volume/progress series never include the partner's squats
    const vol = await queries.getVolumeSeries(peti, '2000-01-01', 'month');
    expect(vol.reduce((n, v) => n + v.legs, 0)).toBe(0);
    expect(vol.reduce((n, v) => n + v.mobility, 0)).toBe(0);
  });

  it('custom exercises belong to one account; built-ins are shared and read-only', async () => {
    asUser(peti, true);
    await plans.createExerciseAction(fd({ name: 'Archer Push-up', category: 'push', mode: 'reps' }));
    asUser(partner);
    await plans.createExerciseAction(fd({ name: 'Archer Push-up', category: 'push', mode: 'reps' })); // same name is fine, slug stays unique
    await plans.createExerciseAction(fd({ name: 'Partner Move', category: 'core', mode: 'seconds' }));
    const names = (await queries.listExercises(partner)).map((e) => e.name);
    expect(names).toContain('Partner Move');
    expect(names).toContain('Push-up'); // built-in visible
    const petiNames = (await queries.listExercises(peti)).map((e) => e.name);
    expect(petiNames).not.toContain('Partner Move');
    expect((await db.q('SELECT DISTINCT slug FROM exercises WHERE name = $1', ['Archer Push-up'])).length).toBe(2);

    // built-ins cannot be edited or archived through the actions
    const builtin = await exId('push-up');
    await plans.updateExerciseAction(fd({ id: builtin, name: 'Hacked', category: 'core' }));
    await plans.archiveExerciseAction(fd({ id: builtin }));
    expect(await db.q1('SELECT 1 FROM exercises WHERE id = $1 AND name = $2 AND NOT archived', [builtin, 'Push-up'])).not.toBeNull();

    // partner cannot use Peti's custom exercise in a plan or session
    const petiCustom = (await queries.listExercises(peti)).find((e) => e.custom)!;
    asUser(partner);
    const mine = (await queries.getActivePlan(partner))!;
    await expect(plans.addPlanExerciseAction(fd({ dayId: mine.days[0].id, exerciseId: petiCustom.id, sets: 1, reps: 1 }))).rejects.toThrow(/Exercise not found/);
    await expect(plans.createExerciseAction(fd({ name: 'x', category: 'nope', mode: 'reps' }))).rejects.toThrow();
  });

  // ---------------------------------------------------------------- unchanged behaviour, now per account

  it('tasks award XP, are reversible, and repeating tasks spawn the next occurrence', async () => {
    asUser(peti, true);
    const today = dates.todayStr();
    await tasks.createTaskAction(fd({ title: 'Mobility 15 min', dueDate: today, repeat: 'daily', xp: 20 }));
    const t = (await queries.listOpenTasks(peti)).find((x) => x.title === 'Mobility 15 min')!;
    const done = await tasks.toggleTaskAction(t.id);
    if ('error' in done) throw new Error(done.error);
    expect(done.gained - achXp(done)).toBe(20);
    const next = (await queries.listOpenTasks(peti)).filter((x) => x.title === 'Mobility 15 min');
    expect(next).toHaveLength(1);
    expect(next[0].dueDate).toBe(dates.addDays(today, 1));
    const undone = await tasks.toggleTaskAction(t.id);
    if ('error' in undone) throw new Error(undone.error);
    expect(undone.gained).toBe(-20);
    await expect(tasks.createTaskAction(fd({ title: '', repeat: 'none' }))).rejects.toThrow(/title/); // blank titles are rejected
  });

  it('nutrition: daily goal XP is granted and revoked as the log changes; history survives library edits', async () => {
    asUser(partner);
    const date = dates.addDays(dates.todayStr(), -1);
    const logged = await food.quickLogAction(fd({ date, meal: 'lunch', name: 'Test meal', kcal: 1750, protein: 105, carbs: 150, fat: 50 }));
    if ('error' in logged) throw new Error(logged.error);
    expect(logged.gained - achXp(logged)).toBe(30); // within 85-105% of 1800 kcal and >= 90% of 110 g protein
    const log = (await queries.getFoodDay(partner, date)).logs[0];
    const removed = await food.deleteFoodLogAction(log.id);
    if ('error' in removed) throw new Error(removed.error);
    expect(removed.gained).toBeLessThanOrEqual(-30 + achXp(removed));

    const rice = (await queries.listFoods(partner)).find((f) => f.name.startsWith('White rice'))!;
    await food.logFoodAction(fd({ date, meal: 'dinner', foodId: rice.id, servings: 2 }));
    expect((await queries.getFoodDay(partner, date)).totals.kcal).toBeCloseTo(260, 1);
    await food.updateFoodAction(fd({ id: rice.id, name: rice.name, servingLabel: '100 g', kcal: 999, protein: 1, carbs: 0, fat: 0 }));
    expect((await queries.getFoodDay(partner, date)).totals.kcal).toBeCloseTo(260, 1);
  });

  it('weigh-ins upsert per day per account and award XP once per day', async () => {
    asUser(partner);
    const today = dates.todayStr();
    const a = await food.logWeightAction(fd({ date: today, kg: 66.5 }));
    if ('error' in a) throw new Error(a.error);
    expect(a.gained - achXp(a)).toBe(5);
    const b = await food.logWeightAction(fd({ date: today, kg: 66.2 }));
    if ('error' in b) throw new Error(b.error);
    expect(b.gained - achXp(b)).toBe(0);
    expect((await queries.listWeights(partner, 5))[0].kg).toBe(66.2);
    expect(await food.logWeightAction(fd({ date: today, kg: 5 }))).toEqual({ error: 'Enter a weight between 20 and 400 kg' });
    asUser(peti, true);
    expect((await queries.listWeights(peti, 5))[0].kg).toBe(93.4); // same day, other account, separate row
  });

  it('plans: duplicate, edit, reorder, import a template and activate without touching history', async () => {
    asUser(peti, true);
    const active = (await queries.getActivePlan(peti))!;
    const historyBefore = (await queries.listSessions(peti, 50)).length;

    const copyId = Number((await redirectTarget(plans.duplicatePlanAction(fd({ id: active.id })))).split('/').pop());
    const copy = (await queries.getPlan(peti, copyId))!;
    expect(copy.active).toBe(false);
    expect(copy.days).toHaveLength(active.days.length);
    expect(copy.guide?.length).toBe(active.guide?.length); // the guide travels with the copy
    expect(copy.days[0].exercises).toHaveLength(active.days[0].exercises.length);

    const second = copy.days[0].exercises[1];
    await plans.updatePlanExerciseAction(fd({ id: second.id, sets: 5, reps: 12, weight: 57.5, note: 'tempo 3-1-1' }));
    await plans.movePlanExerciseAction(fd({ id: second.id, dir: 'down' }));
    const moved = (await queries.getPlan(peti, copyId))!.days[0].exercises;
    expect(moved[2].id).toBe(second.id);
    expect(moved[2]).toMatchObject({ targetSets: 5, targetWeight: 57.5, note: 'tempo 3-1-1' });

    await plans.addDayAction(fd({ planId: copyId, name: 'Extra day', weekday: 7 }));
    await plans.setActivePlanAction(fd({ id: copyId }));
    const now = await queries.listPlans(peti);
    expect(now.filter((p) => p.active)).toHaveLength(1);
    expect(now.find((p) => p.active)!.id).toBe(copyId);

    // adding a template while a plan is active keeps the current one active
    const tplId = Number((await redirectTarget(plans.importTemplateAction(fd({ template: 'base-12-week' })))).split('/').pop());
    expect((await queries.getActivePlan(peti))!.id).toBe(copyId);
    expect((await queries.getPlan(peti, tplId))!.active).toBe(false);
    await expect(plans.importTemplateAction(fd({ template: 'nope' }))).rejects.toThrow(/template/i);

    // the original plan is untouched, and deleting it keeps the sessions made from it
    expect((await queries.getPlan(peti, active.id))!.days[0].exercises[1].targetSets).toBe(active.days[0].exercises[1].targetSets);
    await redirectTarget(plans.deletePlanAction(fd({ id: active.id })));
    expect((await queries.listSessions(peti, 50)).length).toBe(historyBefore);
  });

  it('progress queries return grouped series for the signed-in account only', async () => {
    const since = '2000-01-01';
    const vol = await queries.getVolumeSeries(peti, since, 'week');
    expect(vol.reduce((n, r) => n + r.sessions, 0)).toBe(5);
    expect(vol.reduce((n, r) => n + r.pull, 0)).toBeGreaterThanOrEqual(7);
    expect((await queries.getXpSeries(peti, since, 'day')).length).toBeGreaterThan(0);
    expect((await queries.getWeightSeries(peti, since, 'day')).length).toBe(2); // legacy weigh-in + today
    const h = await queries.getHunterFull(peti);
    expect(h.totalXp).toBe(await xp(peti));
    expect(h.level).toBeGreaterThanOrEqual(2);
    const hp = await queries.getHunterFull(partner);
    expect(hp.totalXp).toBe(await xp(partner));
    expect(hp.sessions).toBe(1);
    expect((await queries.getVolumeSeries(partner, since, 'week')).reduce((n, r) => n + r.pull, 0)).toBe(0);
  });

  it('admin can reset a password, which signs that account out everywhere', async () => {
    asUser(peti, true);
    const { token } = await core.createSessionRecord(partner);
    expect(await profile.resetPasswordAction(fd({ userId: partner, password: 'short' }))).toMatchObject({ error: expect.stringMatching(/8/) });
    expect(await profile.resetPasswordAction(fd({ userId: partner, password: 'reset by admin 1' }))).toMatchObject({ note: expect.any(String) });
    expect(await core.findSessionUser(token)).toBeNull();
    const row = (await db.q1<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [partner]))!;
    expect(await core.verifyPassword('reset by admin 1', row.password_hash)).toBe(true);
    asUser(partner, false);
    expect(await profile.resetPasswordAction(fd({ userId: peti, password: 'takeover attempt' }))).toMatchObject({ error: expect.stringMatching(/administrator/i) });
    expect(await profile.resetPasswordAction(fd({ userId: 99999, password: 'does not matter 1' }))).toMatchObject({ error: expect.any(String) });
  });

  // ---------------------------------------------------------------- share tokens

  it('plan share: createShare returns a token, lookupShare resolves it', async () => {
    asUser(peti);
    const shareTokens = await import('@/lib/share-tokens');
    const shareQueries = await import('@/lib/queries');
    const allPlans = await queries.listPlans(peti);
    const planId = allPlans[0].id;
    const { token, shareId } = await shareTokens.createShare(peti, planId, false);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    const result = await shareQueries.lookupShare(token);
    expect(result).not.toBeNull();
    expect(result!.planId).toBe(planId);
    expect(result!.userId).toBe(peti);
    expect(result!.includePersonalData).toBe(false);
    const shares = await shareQueries.listSharesForPlan(peti, planId);
    expect(shares.some((s) => s.id === shareId)).toBe(true);
  });

  it('plan share: revokeShare removes access; other owners cannot revoke', async () => {
    asUser(peti);
    const shareTokens = await import('@/lib/share-tokens');
    const shareQueries = await import('@/lib/queries');
    const allPlans = await queries.listPlans(peti);
    const planId = allPlans[0].id;
    const { token, shareId } = await shareTokens.createShare(peti, planId, false);
    await shareTokens.revokeShare(partner, shareId);
    expect(await shareQueries.lookupShare(token)).not.toBeNull();
    await shareTokens.revokeShare(peti, shareId);
    expect(await shareQueries.lookupShare(token)).toBeNull();
  });

  it('plan share: getPlanForViewer returns plan for valid token, null for invalid', async () => {
    asUser(peti);
    const shareTokens = await import('@/lib/share-tokens');
    const shareQueries = await import('@/lib/queries');
    const allPlans = await queries.listPlans(peti);
    const planId = allPlans[0].id;
    const { token } = await shareTokens.createShare(peti, planId, true);
    const result = await shareQueries.getPlanForViewer(token);
    expect(result).not.toBeNull();
    expect(result!.plan.id).toBe(planId);
    expect(result!.includePersonalData).toBe(true);
    expect(await shareQueries.getPlanForViewer('bogus-token-xyz')).toBeNull();
  });

  // ---------------------------------------------------------------- nutrition plans

  it('nutrition plans: create and list', async () => {
    asUser(peti);
    await nutritionPlans.createNutritionPlanAction(fd({ name: 'Bulk Phase Meals' }));
    const list = await queries.listNutritionPlans(peti);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'Bulk Phase Meals', active: false });
  });

  it('nutrition plans: activating a plan deactivates the others', async () => {
    asUser(peti);
    await nutritionPlans.createNutritionPlanAction(fd({ name: 'Cut Phase Meals' }));
    const [plan1, plan2] = await queries.listNutritionPlans(peti);
    await nutritionPlans.activateNutritionPlanAction(fd({ id: String(plan1.id) }));
    const after = await queries.listNutritionPlans(peti);
    expect(after.find((p) => p.id === plan1.id)!.active).toBe(true);
    expect(after.find((p) => p.id === plan2.id)!.active).toBe(false);
  });

  it('nutrition plans: add prep session with foods', async () => {
    asUser(peti);
    const [plan] = await queries.listNutritionPlans(peti);
    const chickenId = (await db.q1<{ id: number }>('SELECT id FROM foods WHERE user_id = $1 LIMIT 1', [peti]))!.id;
    await nutritionPlans.createPrepSessionAction(fd({ planId: String(plan.id), name: 'Sunday Batch', cookWeekday: '7', notes: 'Prep for the week' }));
    const full = await queries.getNutritionPlan(peti, plan.id);
    expect(full!.prepSessions).toHaveLength(1);
    expect(full!.prepSessions[0]).toMatchObject({ name: 'Sunday Batch', cookWeekday: 7 });

    await nutritionPlans.addPrepFoodAction(fd({ prepSessionId: String(full!.prepSessions[0].id), foodId: String(chickenId), servings: '3' }));
    const updated = await queries.getNutritionPlan(peti, plan.id);
    expect(updated!.prepSessions[0].foods).toHaveLength(1);
    expect(updated!.prepSessions[0].foods[0].servings).toBe(3);
  });

  it('nutrition plans: add prep-linked and standalone planned meals', async () => {
    asUser(peti);
    const [plan] = await queries.listNutritionPlans(peti);
    const full = await queries.getNutritionPlan(peti, plan.id);
    const sessionId = full!.prepSessions[0].id;
    const foodId = full!.prepSessions[0].foods[0].foodId;

    // prep-linked meal: Monday lunch from Sunday's batch
    await nutritionPlans.addPlannedMealAction(fd({ planId: String(plan.id), weekday: '1', meal: 'lunch', foodId: String(foodId), servings: '1', prepSessionId: String(sessionId) }));
    // standalone meal: Wednesday breakfast
    await nutritionPlans.addPlannedMealAction(fd({ planId: String(plan.id), weekday: '3', meal: 'breakfast', foodId: String(foodId), servings: '2' }));

    const updated = await queries.getNutritionPlan(peti, plan.id);
    const mondayLunch = updated!.dayMeals.find((m) => m.weekday === 1 && m.meal === 'lunch')!;
    expect(mondayLunch).toMatchObject({ servings: 1, prepSessionId: sessionId });
    const wedBreakfast = updated!.dayMeals.find((m) => m.weekday === 3 && m.meal === 'breakfast')!;
    expect(wedBreakfast).toMatchObject({ servings: 2, prepSessionId: null });
  });

  it('nutrition plans: owner cannot be spoofed — partner cannot mutate petiʼs plan', async () => {
    asUser(partner);
    const [petiPlan] = await queries.listNutritionPlans(peti);
    const result = await nutritionPlans.activateNutritionPlanAction(fd({ id: String(petiPlan.id) }));
    expect(result).toMatchObject({ error: expect.any(String) });
    // plan stays inactive for peti
    asUser(peti);
    const list = await queries.listNutritionPlans(peti);
    expect(list.find((p) => p.id === petiPlan.id)!.active).toBe(true); // was activated in prev test
  });

  it('nutrition plans: import plan day appends meals to food log', async () => {
    asUser(peti);
    const [plan] = await queries.listNutritionPlans(peti);
    await nutritionPlans.activateNutritionPlanAction(fd({ id: String(plan.id) }));
    const testDate = '2026-11-02'; // a Monday (weekday 1)
    const result = await nutritionPlans.importPlanDayAction(fd({ date: testDate, mode: 'append' }));
    expect(result).not.toMatchObject({ error: expect.any(String) });
    const logs = await db.q('SELECT meal, servings FROM food_logs WHERE user_id = $1 AND log_date = $2', [peti, testDate]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ meal: 'lunch' });
  });

  it('nutrition plans: import plan day with existing logs returns conflict when mode is missing', async () => {
    asUser(peti);
    const testDate = '2026-11-02'; // already has logs from previous test
    const result = await nutritionPlans.importPlanDayAction(fd({ date: testDate }));
    expect(result).toMatchObject({ conflict: true });
  });
});
