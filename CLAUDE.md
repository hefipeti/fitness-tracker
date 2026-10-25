# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (needs a running Postgres)
docker compose up -d db
export DATABASE_URL=postgres://fitness:fitness_local_pw@localhost:5432/fitness
npm run dev

# Full stack
docker compose up -d --build

# Type-check
npm run typecheck

# Tests (unit only — no DB required)
npm test

# Integration tests (WIPES the public schema of the target DB)
TEST_DATABASE_URL=postgres://fitness:fitness_local_pw@localhost:5432/fitness_test npm test

# Run a single test file
npx vitest run tests/game.test.ts
```

Schema changes go in `src/lib/migrations.ts` as a new entry in the migrations array. They run automatically on start and are tracked in `schema_migrations`.

## Architecture

**Next.js 16 App Router, TypeScript, PostgreSQL 17 (via `pg`), Recharts. No ORM.**

### Data access layer (`src/lib/`)

- `db.ts` — raw `pg` pool with three helpers: `q` (returns rows), `q1` (returns first row or null), `tx` (transaction wrapper). pg type parsers are overridden: DATE → string, NUMERIC → float, BIGINT → int, TIMESTAMPTZ → ISO string.
- `queries.ts` — all read models and progress series. Always pass `userId` to scope rows.
- `actions/*` — all writes as Next.js server actions. Each action calls `requireUserId()` first, then an ownership assert from `ownership.ts`, then writes.
- `action-utils.ts` — `guard()` wraps action bodies and converts `UserError`/`ZodError` into `{ error }` results. `touch()` revalidates all pages. `UserError` is the only throw that reaches the client; all other thrown errors propagate as 500s.
- `ownership.ts` — `assertPlan`, `assertPlanDay`, `assertPlanExercise`, `assertExerciseVisible`. Every action receiving a row id from the client **must** call one of these or filter by `user_id` in SQL.

### Auth (`src/lib/auth.ts`, `auth-core.ts`)

- `requireUser()` / `requireUserId()` / `requireAdmin()` — call at the top of every page and server action (layouts don't protect pages).
- Sessions: 30-day httpOnly cookie `fts_session`. Scrypt password hashing. Rate limiting: 8 failures in 10 min lock the username.
- Each account is fully isolated. Only built-in exercises are shared; user-created exercises are private.

### Game logic (`src/lib/game.ts`, `engine.ts`)

- `game.ts` — pure functions: XP thresholds, rank brackets, stat calculations. Constants here control game pace.
- `engine.ts` — XP ledger writes, achievement evaluation, nutrition-day scoring.

### Schema bootstrap

`src/instrumentation.ts` calls `migrateWithRetry()` on server start (Node.js runtime only). First-run creates the schema and seeds base exercises/foods. The `/setup` page registers the first (admin) account.

### Route groups

- `(app)/` — all authenticated pages. Layout enforces auth via `requireUser()`.
- `(auth)/` — `/login` and `/setup` (unauthenticated).

### Key patterns

- FormData is parsed with `fdStr`, `fdNum`, `fdInt`, `reqStr`, `reqInt` from `action-utils.ts`.
- Zod is used for input validation in actions.
- All DB dates are stored/returned as `YYYY-MM-DD` strings (no timezone shifts) — `src/lib/dates.ts` has helpers.
- Multi-user: every table with user-owned data has a `user_id` column. Queries **always** filter by it.

## Agent skills

### Issue tracker

Issues live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `GLOSSARY.md` at root + `docs/adr/`. See `docs/agents/domain.md`.