# Fitness Tracker System

A local, gamified training, task and nutrition tracker with separate accounts (one per person). Dark black/grey/purple "system window" UI inspired by Solo Leveling: XP, levels, E→S ranks, stats and achievements.

**Stack:** Next.js 16 (App Router, TypeScript) · PostgreSQL 17 · Docker Compose · Recharts

## Run it

Requires Docker Desktop.

```bash
docker compose up -d --build
```

Open <http://localhost:3000>. On first start the app creates the schema and shows the **/setup** page.

### Accounts

- **The first account is the administrator.** Create it first (Peti): choose the plan template **Calisthenics plan: 12-week base phase** and it becomes that account's active main plan, with the protein target set to 150 g. If the database already holds data from the single-user version (Hunter's Log), the first account adopts all of it.
- **Add your partner** under Profile → Accounts (admin only). Each account has its own plans, workouts, tasks, food library and logs, weight, XP, level, achievements and settings. Nothing is shared except the built-in exercise list; exercises you create are private.
- Passwords are stored as scrypt hashes, sessions last 30 days (httpOnly cookie), 8 failed logins in 10 minutes lock that username out for a while. Anyone can change their own password in Profile; the admin can reset another account's password (this signs that account out everywhere). There is no email reset, so if the admin forgets their password, reset it in the database.
- The connection is plain HTTP on your LAN, so a password can be read by someone sniffing your Wi-Fi. Fine at home; do not expose it to the internet. If you add HTTPS in front, set `COOKIE_SECURE=true`.

| Task | Command |
| --- | --- |
| Stop | `docker compose stop` |
| Start again | `docker compose start` |
| Update after code changes | `docker compose up -d --build` |
| Logs | `docker compose logs -f app` |
| Delete containers, **keep data** | `docker compose down` |
| Delete containers **and all data** | `docker compose down -v` |

Containers use `restart: unless-stopped`, so the site comes back after a reboot once Docker Desktop is running.

### Phone on your home Wi-Fi

1. Find the PC's IP (`ipconfig`, e.g. `192.168.1.23`) and open `http://192.168.1.23:3000` on the phone.
2. If it doesn't load, allow the port in Windows Firewall (PowerShell as admin):
   `New-NetFirewallRule -DisplayName "Fitness Tracker" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private`
3. The layout is mobile-friendly (bottom navigation, big tap targets for logging sets).

Every page needs a login, but do not port-forward it to the internet. To make it PC-only, change the app port mapping in `docker-compose.yml` to `"127.0.0.1:3000:3000"`.

## Your data

Everything lives in the Postgres named volume `fitness_pgdata`, so it survives restarts, rebuilds and `docker compose down`.

Backup (PowerShell: `.\scripts\backup.ps1`, bash: `./scripts/backup.sh`) writes `backups/fitness-<timestamp>.dump`.

Restore into a running stack:

```bash
docker compose cp backups/fitness-2026-10-24-2100.dump db:/tmp/restore.dump
docker compose exec db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/restore.dump'
```

### Upgrading from Hunter's Log

Compose project, volume and DB credentials were renamed, so the new stack starts with an empty database. To keep your history:

```bash
# 1. in the OLD folder, with the old stack running
./scripts/backup.sh            # or .\scripts\backup.ps1
docker compose down            # keep the volume as a fallback
# 2. in the new folder
docker compose up -d --build db
docker compose cp ../old-folder/backups/hunter-<timestamp>.dump db:/tmp/restore.dump
docker compose exec db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists /tmp/restore.dump'
docker compose up -d --build
```

`--no-owner` matters because the old dump is owned by the `hunter` role. Open `/setup`: the first account you create adopts the restored data.

Back up before upgrades and now and then to another drive. A single Docker volume is not a backup.

## What's inside

- **Status**: hunter card (rank, level, XP, 5 stats), today's quests (scheduled workout, nutrition progress, due tasks), weekly strip, weigh-in, XP log.
- **Training**: start today's scheduled day or any day, or a free workout. Set-by-set logger with last-time hints, rest timer, personal-record detection. Reps, timed holds (handstand, plank, L-sit), weighted sets (kg × reps) and assisted-machine sets (assist kg × reps, where less assistance is progress) are supported.
- **Plans**: multiple plans, one active. Days are scheduled by weekday; reorder, edit targets, add or remove exercises any time. **Duplicate** a plan to start a new block 4-6 months from now, tweak it, then activate it. Editing a plan never alters past workouts. Custom exercises live in the **Exercise library**.
- **Quests**: tasks with due dates, daily/weekly repeat and XP rewards.
- **Nutrition**: kcal and macros against daily targets, meals, your own food library (per-serving values, edits don't rewrite history) and one-off quick entries.
- **Progress**: weekly/monthly/daily grouping over 30 days to all time. Volume by muscle category, per-exercise progression, body weight vs goal, kcal and protein averages vs targets, XP.
- **Profile**: stats breakdown, achievements, settings (targets, start/goal weight, name), password, and account management for the admin.
- **Plan guide**: plans can carry a reference guide (weekly schedule, progression rules, retests, safety), shown on the plan page.

### Game rules

| Event | XP |
| --- | --- |
| Complete a workout | 50 + 3 per set (max 60) + 20 per personal record (max 3) |
| Complete a task | its reward (10 / 20 / 40 / 80) |
| Hit nutrition targets for a day (85–105 % kcal, ≥ 90 % protein) | 30 |
| Log body weight (once per day) | 5 |
| Achievement | 50-800 |

Level *n* needs `100 × (n−1)^1.5` total XP. Ranks: E (1), D (10), C (20), B (35), A (50), S (75). Stats start at 10 and grow from your logged data (STR from push/pull reps and weighted volume, AGI from skill work, END from sessions plus leg/core sets, VIT from nutrition days hit, DIS from tasks and streak). The constants live in `src/lib/game.ts` if you want to tune the pace.

Plan templates (`src/lib/templates.ts`): "Calisthenics plan: 12-week base phase" (Gym A/B/C + two home sessions, with the full guide) and a generic "Foundation Block". Default targets (2300 kcal, 160 g protein) are placeholders; change them in **Profile**.

## Development

```bash
npm install
# needs a Postgres, e.g.:  docker compose up -d db
export DATABASE_URL=postgres://fitness:fitness_local_pw@localhost:5432/fitness
npm run dev
```

Tests:

```bash
npm test                      # unit tests (game rules, dates, auth, templates)
# integration tests run against a real database and WIPE its public schema:
TEST_DATABASE_URL=postgres://fitness:fitness_local_pw@localhost:5432/fitness_test npm test
```

Schema changes: append a migration to `src/lib/migrations.ts` (applied automatically on start, tracked in `schema_migrations`).

```
src/lib/game.ts          pure game rules (levels, ranks, stats, achievements)
src/lib/engine.ts        XP ledger, achievements, nutrition-day evaluation
src/lib/queries.ts       read models and progress series
src/lib/actions/*        server actions (all writes)
src/lib/migrations.ts    schema + seed
src/lib/auth*.ts         accounts, password hashing, sessions
src/lib/templates.ts     importable plan templates
src/app/*                pages
```
