import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Bar, PageHead, Panel, RankBadge, Tile, fmtNum } from '@/components/ui';
import { RunForm, TaskCheck } from '@/components/system';
import {
  getFoodDay,
  getHunterFull,
  getScheduledDays,
  getWeek,
  listSessionsOn,
  listTasksDueBy,
  listWeights,
  listXpEvents,
} from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { formatDay, todayStr, WEEKDAYS } from '@/lib/dates';
import { STAT_INFO, type Stats } from '@/lib/game';
import { startSessionAction } from '@/lib/actions/training';
import { toggleTaskAction } from '@/lib/actions/tasks';
import { logWeightAction } from '@/lib/actions/food';

export default async function StatusPage() {
  const { id: uid } = await requireUser();
  const today = todayStr();
  const [hunter, settings, scheduled, sessions, week, dueTasks, food, events, weights] = await Promise.all([
    getHunterFull(uid),
    getSettings(uid),
    getScheduledDays(uid, today),
    listSessionsOn(uid, today),
    getWeek(uid, today),
    listTasksDueBy(uid, today),
    getFoodDay(uid, today),
    listXpEvents(uid, 8),
    listWeights(uid, 1),
  ]);

  const statKeys = Object.keys(STAT_INFO) as (keyof Stats)[];
  const statMax = Math.max(20, ...statKeys.map((k) => hunter.stats[k])) * 1.15;
  const plannedThisWeek = week.reduce((n, d) => n + d.scheduled.length, 0);
  const doneThisWeek = week.reduce((n, d) => n + d.done, 0);
  const freeSessions = sessions.filter((s) => s.planDayId == null || !scheduled.some((d) => d.id === s.planDayId));
  const lastWeight = weights[0];

  return (
    <>
      <PageHead kicker="Status window" title={`Welcome back, ${hunter.name}`}>
        <span className="mono muted small">{formatDay(today)}</span>
      </PageHead>

      <div className="grid side-main">
        <div className="col" style={{ gap: 16 }}>
          <Panel title="Hunter status" className="glow">
            <div className="status-top">
              <RankBadge letter={hunter.rank.letter} size="lg" />
              <div className="grow" style={{ minWidth: 220 }}>
                <div className="small muted" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                  {hunter.rank.letter}-Rank · {hunter.rank.title}
                </div>
                <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
                  <span className="muted mono small">LEVEL</span>
                  <span className="big-level">{hunter.level}</span>
                </div>
                <div className="mt-s">
                  <Bar value={hunter.xpIntoLevel} max={hunter.xpForNext} />
                  <div className="row between tiny mono muted" style={{ marginTop: 4 }}>
                    <span>
                      {fmtNum(hunter.xpIntoLevel)} / {fmtNum(hunter.xpForNext)} XP
                    </span>
                    <span>{fmtNum(hunter.totalXp)} total</span>
                  </div>
                  {hunter.next && (
                    <div className="tiny dim" style={{ marginTop: 2 }}>
                      Next rank: {hunter.next.letter} at level {hunter.next.minLevel}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col mt" style={{ gap: 8 }}>
              {statKeys.map((k) => (
                <div className="stat-row" key={k} title={`${STAT_INFO[k].name}: ${STAT_INFO[k].formula}`}>
                  <span className="k">{k}</span>
                  <Bar value={hunter.stats[k]} max={statMax} className="thin" />
                  <span className="v">{hunter.stats[k]}</span>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid tiles3">
            <Tile label="Active streak" value={`${hunter.streak}d`} sub="training or food logged" />
            <Tile label="This week" value={`${doneThisWeek}/${plannedThisWeek || '–'}`} sub="workouts done / planned" />
            <Tile label="Total workouts" value={hunter.sessions} sub={`${hunter.foodGoalDays} nutrition days hit`} />
          </div>

          <Panel title="This week">
            <div className="week">
              {week.map((d) => (
                <div key={d.date} className={`day ${d.isToday ? 'today' : ''} ${d.done > 0 ? 'done' : ''}`}>
                  <span className="dn">{WEEKDAYS[d.weekday - 1]}</span>
                  <span className="dd">{d.date.slice(8)}</span>
                  {d.scheduled.map((n) => (
                    <span key={n} className="ds">
                      {n}
                    </span>
                  ))}
                  {d.inProgress > 0 && <span className="ds">in progress</span>}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <Panel title="Daily quests">
            <div className="list">
              {scheduled.length === 0 && freeSessions.length === 0 && (
                <div className="item">
                  <div className="grow">
                    <div className="t">Rest day</div>
                    <div className="s">Nothing scheduled. Recover, or start a free workout.</div>
                  </div>
                  <Link className="btn sm" href="/training">
                    Training
                  </Link>
                </div>
              )}
              {scheduled.map((d) => {
                const s = sessions.find((x) => x.planDayId === d.id);
                return (
                  <div className="item" key={d.id}>
                    <div className="grow">
                      <div className="t">Training: {d.name}</div>
                      <div className="s">
                        {s?.completedAt ? `Completed · +${s.xp} XP` : s ? 'In progress' : `${d.exerciseCount} exercises`}
                      </div>
                    </div>
                    {s ? (
                      <Link className={`btn sm ${s.completedAt ? 'ghost' : 'primary'}`} href={`/training/${s.id}`}>
                        {s.completedAt ? 'View' : 'Resume'}
                      </Link>
                    ) : (
                      <form action={startSessionAction}>
                        <input type="hidden" name="planDayId" value={d.id} />
                        <button className="btn sm primary">Start</button>
                      </form>
                    )}
                  </div>
                );
              })}
              {freeSessions.map((s) => (
                <div className="item" key={s.id}>
                  <div className="grow">
                    <div className="t">Training: {s.name}</div>
                    <div className="s">{s.completedAt ? `Completed · +${s.xp} XP` : 'In progress'}</div>
                  </div>
                  <Link className="btn sm ghost" href={`/training/${s.id}`}>
                    {s.completedAt ? 'View' : 'Resume'}
                  </Link>
                </div>
              ))}
              <div className="item">
                <div className="grow">
                  <div className="t">Nutrition targets</div>
                  <div className="s mono">
                    {fmtNum(food.totals.kcal)} / {settings.kcalTarget} kcal · {fmtNum(food.totals.protein)} / {settings.proteinTarget} g protein
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Bar value={food.totals.kcal} max={settings.kcalTarget} className="thin" />
                  </div>
                </div>
                <Link className="btn sm" href="/food">
                  Log
                </Link>
              </div>
              {dueTasks.map((t) => (
                <div className="item" key={t.id}>
                  <TaskCheck done={false} label={`Complete ${t.title}`} action={toggleTaskAction.bind(null, t.id)} />
                  <div className="grow">
                    <div className="t">{t.title}</div>
                    <div className="s">
                      {t.dueDate && t.dueDate < today ? `Overdue (${formatDay(t.dueDate)})` : 'Due today'} · +{t.xp} XP
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Weigh-in" action={lastWeight && <span className="mono">{lastWeight.kg} kg</span>}>
            <RunForm action={logWeightAction} className="form-row">
              <label className="field">
                Body weight (kg)
                <input name="kg" type="number" step="0.1" min="20" max="400" required placeholder={lastWeight ? String(lastWeight.kg) : '90.0'} />
              </label>
              <button className="btn primary">Log (+5 XP)</button>
            </RunForm>
            {settings.goalWeight && <div className="tiny dim mt-s">Goal: {settings.goalWeight} kg</div>}
          </Panel>

          <Panel title="System log">
            {events.length === 0 ? (
              <div className="empty">No XP earned yet. Complete a quest to begin.</div>
            ) : (
              <div className="list">
                {events.map((e) => (
                  <div className="item" key={e.id} style={{ padding: '7px 0' }}>
                    <div className="grow small">{e.label}</div>
                    <span className="mono" style={{ color: e.xp >= 0 ? 'var(--violet-3)' : 'var(--danger)' }}>
                      {e.xp >= 0 ? '+' : ''}
                      {e.xp}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
