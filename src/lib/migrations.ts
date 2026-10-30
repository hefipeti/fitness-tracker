import type { PoolClient } from 'pg';
import { getPool } from './db';
import {
  BASE_EXERCISES,
  PLAN_EXERCISES,
  STARTER_DAYS,
  STARTER_FOODS,
  STARTER_PLAN_NAME,
  STARTER_PLAN_NOTES,
} from './starter';

interface Migration {
  id: number;
  name: string;
  up: (c: PoolClient) => Promise<void>;
}

const SCHEMA = `
CREATE TABLE settings (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hunter_name    TEXT NOT NULL DEFAULT 'Hunter',
  kcal_target    INT NOT NULL DEFAULT 2300,
  protein_target INT NOT NULL DEFAULT 160,
  carbs_target   INT NOT NULL DEFAULT 250,
  fat_target     INT NOT NULL DEFAULT 70,
  start_weight   NUMERIC(5,1),
  goal_weight    NUMERIC(5,1),
  height_cm      INT
);

CREATE TABLE exercises (
  id       SERIAL PRIMARY KEY,
  slug     TEXT NOT NULL UNIQUE,
  name     TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('push','pull','legs','core','skill','cardio')),
  mode     TEXT NOT NULL CHECK (mode IN ('reps','seconds','weighted')),
  archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE plans (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plans_one_active ON plans (active) WHERE active;

CREATE TABLE plan_days (
  id       SERIAL PRIMARY KEY,
  plan_id  INT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  name     TEXT NOT NULL,
  weekday  SMALLINT CHECK (weekday BETWEEN 1 AND 7)
);
CREATE INDEX plan_days_plan ON plan_days (plan_id);

CREATE TABLE plan_exercises (
  id            SERIAL PRIMARY KEY,
  plan_day_id   INT NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  exercise_id   INT NOT NULL REFERENCES exercises(id),
  position      INT NOT NULL DEFAULT 0,
  target_sets   INT NOT NULL DEFAULT 3,
  target_reps   INT NOT NULL DEFAULT 8,
  target_weight NUMERIC(6,2),
  note          TEXT NOT NULL DEFAULT ''
);
CREATE INDEX plan_exercises_day ON plan_exercises (plan_day_id);

CREATE TABLE sessions (
  id           SERIAL PRIMARY KEY,
  session_date DATE NOT NULL,
  name         TEXT NOT NULL,
  plan_day_id  INT REFERENCES plan_days(id) ON DELETE SET NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  note         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX sessions_date ON sessions (session_date);

CREATE TABLE session_exercises (
  id            SERIAL PRIMARY KEY,
  session_id    INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id   INT NOT NULL REFERENCES exercises(id),
  position      INT NOT NULL DEFAULT 0,
  target_sets   INT NOT NULL DEFAULT 3,
  target_reps   INT NOT NULL DEFAULT 8,
  target_weight NUMERIC(6,2)
);
CREATE INDEX session_exercises_session ON session_exercises (session_id);

CREATE TABLE session_sets (
  id          SERIAL PRIMARY KEY,
  session_id  INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INT NOT NULL REFERENCES exercises(id),
  set_no      INT NOT NULL,
  reps        INT,
  seconds     INT,
  weight_kg   NUMERIC(6,2),
  UNIQUE (session_id, exercise_id, set_no)
);

CREATE TABLE tasks (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  due_date   DATE,
  repeat     TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none','daily','weekly')),
  xp         INT NOT NULL DEFAULT 20,
  done_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE foods (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  serving_label TEXT NOT NULL DEFAULT '100 g',
  kcal          NUMERIC(7,1) NOT NULL DEFAULT 0,
  protein       NUMERIC(6,1) NOT NULL DEFAULT 0,
  carbs         NUMERIC(6,1) NOT NULL DEFAULT 0,
  fat           NUMERIC(6,1) NOT NULL DEFAULT 0,
  archived      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE food_logs (
  id       SERIAL PRIMARY KEY,
  log_date DATE NOT NULL,
  meal     TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snack')),
  food_id  INT REFERENCES foods(id) ON DELETE SET NULL,
  name     TEXT NOT NULL,
  servings NUMERIC(6,2) NOT NULL DEFAULT 1,
  kcal     NUMERIC(8,1) NOT NULL DEFAULT 0,
  protein  NUMERIC(7,1) NOT NULL DEFAULT 0,
  carbs    NUMERIC(7,1) NOT NULL DEFAULT 0,
  fat      NUMERIC(7,1) NOT NULL DEFAULT 0
);
CREATE INDEX food_logs_date ON food_logs (log_date);

CREATE TABLE body_weights (
  log_date DATE PRIMARY KEY,
  kg       NUMERIC(5,1) NOT NULL
);

CREATE TABLE xp_events (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_date DATE NOT NULL,
  source     TEXT NOT NULL,
  ref        TEXT,
  label      TEXT NOT NULL,
  xp         INT NOT NULL,
  UNIQUE (source, ref)
);
CREATE INDEX xp_events_date ON xp_events (event_date);

CREATE TABLE achievements (
  key         TEXT PRIMARY KEY,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function seed(c: PoolClient): Promise<void> {
  await c.query(
    `INSERT INTO settings (id, hunter_name, kcal_target, protein_target, carbs_target, fat_target, start_weight, goal_weight, height_cm)
     VALUES (1, 'Peti', 2300, 160, 250, 70, 94.0, 86.0, 182)
     ON CONFLICT (id) DO NOTHING`,
  );

  for (const [slug, name, category, mode] of BASE_EXERCISES) {
    await c.query(
      'INSERT INTO exercises (slug, name, category, mode) VALUES ($1,$2,$3,$4) ON CONFLICT (slug) DO NOTHING',
      [slug, name, category, mode],
    );
  }

  const plan = await c.query<{ id: number }>(
    `INSERT INTO plans (name, notes, active) VALUES ($1, $2, TRUE) RETURNING id`,
    [STARTER_PLAN_NAME, STARTER_PLAN_NOTES],
  );
  const planId = plan.rows[0].id;
  let dayPos = 0;
  for (const day of STARTER_DAYS) {
    const d = await c.query<{ id: number }>(
      'INSERT INTO plan_days (plan_id, position, name, weekday) VALUES ($1,$2,$3,$4) RETURNING id',
      [planId, dayPos++, day.name, day.weekday],
    );
    let pos = 0;
    for (const ex of day.exercises) {
      await c.query(
        `INSERT INTO plan_exercises (plan_day_id, exercise_id, position, target_sets, target_reps)
         SELECT $1, id, $2, $3, $4 FROM exercises WHERE slug = $5`,
        [d.rows[0].id, pos++, ex.sets, ex.reps, ex.slug],
      );
    }
  }

  for (const [name, serving, kcal, p, cb, f] of STARTER_FOODS) {
    await c.query(
      'INSERT INTO foods (name, serving_label, kcal, protein, carbs, fat) VALUES ($1,$2,$3,$4,$5,$6)',
      [name, serving, kcal, p, cb, f],
    );
  }
}

const ACCOUNTS = `
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL CHECK (char_length(username) BETWEEN 3 AND 32),
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_lower ON users (lower(username));

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX auth_sessions_user ON auth_sessions (user_id);

-- New exercise category and tracking mode.
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_category_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_category_check
  CHECK (category IN ('push','pull','legs','core','skill','cardio','mobility'));
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_mode_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_mode_check
  CHECK (mode IN ('reps','seconds','weighted','assisted'));

-- Ownership. NULL user_id on exercises = built-in (shared). On every other table NULL only
-- exists for data created before accounts; the first account adopts it (see users.ts).
ALTER TABLE exercises ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX exercises_user ON exercises (user_id);

ALTER TABLE plans ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE plans ADD COLUMN guide JSONB;
DROP INDEX IF EXISTS plans_one_active;
CREATE UNIQUE INDEX plans_one_active ON plans (user_id) WHERE active;
CREATE INDEX plans_user ON plans (user_id);

ALTER TABLE sessions ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS sessions_date;
CREATE INDEX sessions_user_date ON sessions (user_id, session_date);

ALTER TABLE tasks ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX tasks_user ON tasks (user_id);

ALTER TABLE foods ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX foods_user ON foods (user_id);

ALTER TABLE food_logs ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS food_logs_date;
CREATE INDEX food_logs_user_date ON food_logs (user_id, log_date);

ALTER TABLE body_weights ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE body_weights DROP CONSTRAINT IF EXISTS body_weights_pkey;
CREATE UNIQUE INDEX body_weights_user_date ON body_weights (user_id, log_date);

ALTER TABLE xp_events ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE xp_events DROP CONSTRAINT IF EXISTS xp_events_source_ref_key;
CREATE UNIQUE INDEX xp_events_user_source_ref ON xp_events (user_id, source, ref);
DROP INDEX IF EXISTS xp_events_date;
CREATE INDEX xp_events_user_date ON xp_events (user_id, event_date);

ALTER TABLE achievements ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_pkey;
CREATE UNIQUE INDEX achievements_user_key ON achievements (user_id, key);

ALTER TABLE settings DROP COLUMN id;
ALTER TABLE settings ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX settings_user ON settings (user_id);
`;

async function addPlanExercises(c: PoolClient): Promise<void> {
  for (const [slug, name, category, mode] of PLAN_EXERCISES) {
    await c.query(
      'INSERT INTO exercises (slug, name, category, mode) VALUES ($1,$2,$3,$4) ON CONFLICT (slug) DO NOTHING',
      [slug, name, category, mode],
    );
  }
}

const PLAN_SHARES = `
CREATE TABLE plan_shares (
  id                SERIAL PRIMARY KEY,
  user_id           INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id           INT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  token_hash        TEXT NOT NULL UNIQUE,
  include_personal  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX plan_shares_user_plan ON plan_shares (user_id, plan_id);
`;

const SHARE_V2 = `
ALTER TABLE plan_shares ADD COLUMN share_type TEXT NOT NULL DEFAULT 'view'
  CHECK (share_type IN ('view','review'));
ALTER TABLE users ADD COLUMN is_coach BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE share_comments (
  id               SERIAL PRIMARY KEY,
  share_id         INT NOT NULL REFERENCES plan_shares(id) ON DELETE CASCADE,
  plan_exercise_id INT NOT NULL REFERENCES plan_exercises(id) ON DELETE CASCADE,
  commenter_id     INT REFERENCES users(id) ON DELETE SET NULL,
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX share_comments_share ON share_comments (share_id);
`;

const NUTRITION_PLANS = `
CREATE TABLE nutrition_plans (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX nutrition_plans_one_active ON nutrition_plans (user_id) WHERE active;
CREATE INDEX nutrition_plans_user ON nutrition_plans (user_id);

CREATE TABLE nutrition_plan_prep_sessions (
  id           SERIAL PRIMARY KEY,
  plan_id      INT NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  cook_weekday SMALLINT NOT NULL CHECK (cook_weekday BETWEEN 1 AND 7),
  notes        TEXT NOT NULL DEFAULT '',
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX nutrition_plan_prep_sessions_plan ON nutrition_plan_prep_sessions (plan_id);

CREATE TABLE nutrition_plan_prep_foods (
  id              SERIAL PRIMARY KEY,
  prep_session_id INT NOT NULL REFERENCES nutrition_plan_prep_sessions(id) ON DELETE CASCADE,
  food_id         INT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  servings        NUMERIC(6,2) NOT NULL DEFAULT 1
);
CREATE INDEX nutrition_plan_prep_foods_session ON nutrition_plan_prep_foods (prep_session_id);

CREATE TABLE nutrition_plan_day_meals (
  id              SERIAL PRIMARY KEY,
  plan_id         INT NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  weekday         SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  meal            TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snack')),
  food_id         INT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  servings        NUMERIC(6,2) NOT NULL DEFAULT 1,
  prep_session_id INT REFERENCES nutrition_plan_prep_sessions(id) ON DELETE SET NULL,
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX nutrition_plan_day_meals_plan ON nutrition_plan_day_meals (plan_id, weekday);
`;

const MIGRATIONS: Migration[] = [
  { id: 1, name: 'initial schema', up: async (c) => void (await c.query(SCHEMA)) },
  { id: 2, name: 'seed exercises, starter plan, foods', up: seed },
  { id: 3, name: 'accounts and per-user data', up: async (c) => void (await c.query(ACCOUNTS)) },
  { id: 4, name: 'assisted/mobility exercises for the 12-week plan', up: addPlanExercises },
  { id: 5, name: 'plan share tokens', up: async (c) => void (await c.query(PLAN_SHARES)) },
  { id: 6, name: 'review links, coach flag, exercise comments', up: async (c) => void (await c.query(SHARE_V2)) },
  { id: 7, name: 'weekly nutrition plans with prep sessions', up: async (c) => void (await c.query(NUTRITION_PLANS)) },
  { id: 8, name: 'locale preference', up: async (c) => void (await c.query(`ALTER TABLE settings ADD COLUMN locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'hu'))`)) },
];

export async function runMigrations(): Promise<void> {
  const client = await getPool().connect();
  try {
    // Serialise concurrent starts (e.g. dev server hot reload).
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (id INT PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const done = await client.query<{ id: number }>('SELECT id FROM schema_migrations');
    const applied = new Set(done.rows.map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) continue;
      await client.query('BEGIN');
      try {
        await m.up(client);
        await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1,$2)', [m.id, m.name]);
        await client.query('COMMIT');
        console.log(JSON.stringify({ level: 'info', msg: 'migration applied', id: m.id, name: m.name }));
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
    client.release();
  }
}

/** Retry until Postgres accepts connections (compose healthcheck normally covers this). */
export async function migrateWithRetry(attempts = 20, delayMs = 1500): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await runMigrations();
      return;
    } catch (e) {
      if (i === attempts) throw e;
      console.warn(JSON.stringify({ level: 'warn', msg: 'database not ready, retrying', attempt: i, err: String(e) }));
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
