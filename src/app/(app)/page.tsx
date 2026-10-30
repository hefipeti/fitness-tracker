import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Bar, PageHead, Panel, RankBadge, Tile, fmtNum } from '@/components/ui';
import { RunForm, TaskCheck } from '@/components/system';
import { WeekScrollInit } from '@/components/week-scroll';
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
import { formatDay, todayStr } from '@/lib/dates';
import { STAT_INFO, type Stats } from '@/lib/game';
import { startSessionAction } from '@/lib/actions/training';
import { toggleTaskAction } from '@/lib/actions/tasks';
import { logWeightAction } from '@/lib/actions/food';
import { getTranslations } from 'next-intl/server';

export default async function StatusPage() {
  const { id: uid } = await requireUser();
  const today = todayStr();
  const [hunter, settings, scheduled, sessions, week, dueTasks, food, events, weights, t] = await Promise.all([
    getHunterFull(uid),
    getSettings(uid),
    getScheduledDays(uid, today),
    listSessionsOn(uid, today),
    getWeek(uid, today),
    listTasksDueBy(uid, today),
    getFoodDay(uid, today),
    listXpEvents(uid, 8),
    listWeights(uid, 1),
    getTranslations(),
  ]);

  const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

  const statKeys = Object.keys(STAT_INFO) as (keyof Stats)[];
  const statMax = Math.max(20, ...statKeys.map((k) => hunter.stats[k])) * 1.15;
  const plannedThisWeek = week.reduce((n, d) => n + d.scheduled.length, 0);
  const doneThisWeek = week.reduce((n, d) => n + d.done, 0);
  const freeSessions = sessions.filter((s) => s.planDayId == null || !scheduled.some((d) => d.id === s.planDayId));
  const lastWeight = weights[0];

  return (
    <>
      <PageHead kicker={t('status.kicker')} title={t('status.welcome', { name: hunter.name })}>
        <span className="mono muted small">{formatDay(today)}</span>
      </PageHead>

      <div className="grid side-main">
        <div className="col" style={{ gap: 16 }}>
          <Panel title={t('status.hunterStatus')} className="glow">
            <div className="status-top">
              <RankBadge letter={hunter.rank.letter} size="lg" />
              <div className="grow" style={{ minWidth: 220 }}>
                <div className="small muted" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                  {t('status.rank', { letter: hunter.rank.letter, title: hunter.rank.title })}
                </div>
                <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
                  <span className="muted mono small">{t('status.level')}</span>
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
                      {t('status.nextRank', { letter: hunter.next.letter, minLevel: hunter.next.minLevel })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="stats-grid mt">
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
            <Tile label={t('status.activeStreak')} value={`${hunter.streak}d`} sub={t('status.streakSub')} />
            <Tile label={t('status.thisWeek')} value={`${doneThisWeek}/${plannedThisWeek || '–'}`} sub={t('status.thisWeekSub')} />
            <Tile label={t('status.totalWorkouts')} value={hunter.sessions} sub={t('status.totalWorkoutsSub', { count: hunter.foodGoalDays })} />
          </div>

          <Panel title={t('status.thisWeekPanel')}>
            <WeekScrollInit />
            <div className="week-scroll">
              <div className="week" id="week-grid">
                {week.map((d) => (
                  <div key={d.date} className={`day ${d.isToday ? 'today' : ''} ${d.done > 0 ? 'done' : ''}`}>
                    <span className="dn">{t(`weekdays.${WEEKDAY_KEYS[d.weekday - 1]}`)}</span>
                    <span className="dd">{d.date.slice(8)}</span>
                    {d.scheduled.map((n) => (
                      <span key={n} className="ds">
                        {n}
                      </span>
                    ))}
                    {d.inProgress > 0 && <span className="ds">{t('status.inProgress')}</span>}
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <Panel title={t('status.dailyQuests')}>
            <div className="list">
              {scheduled.length === 0 && freeSessions.length === 0 && (
                <div className="item">
                  <div className="grow">
                    <div className="t">{t('status.restDay')}</div>
                    <div className="s">{t('status.restDaySub')}</div>
                  </div>
                  <Link className="btn sm" href="/training">
                    {t('nav.training')}
                  </Link>
                </div>
              )}
              {scheduled.map((d) => {
                const s = sessions.find((x) => x.planDayId === d.id);
                return (
                  <div className="item" key={d.id}>
                    <div className="grow">
                      <div className="t">{t('status.training')}: {d.name}</div>
                      <div className="s">
                        {s?.completedAt ? t('status.completed', { xp: s.xp }) : s ? t('status.inProgress') : t('status.exercises', { count: d.exerciseCount })}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      {!s && (
                        <Link className="btn sm ghost" href={`/training/preview/${d.id}`}>
                          {t('status.preview')}
                        </Link>
                      )}
                      {s ? (
                        <Link className={`btn sm ${s.completedAt ? 'ghost' : 'primary'}`} href={`/training/${s.id}`}>
                          {s.completedAt ? t('status.view') : t('status.resume')}
                        </Link>
                      ) : (
                        <form action={startSessionAction}>
                          <input type="hidden" name="planDayId" value={d.id} />
                          <button className="btn sm primary">{t('status.start')}</button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
              {freeSessions.map((s) => (
                <div className="item" key={s.id}>
                  <div className="grow">
                    <div className="t">{t('status.training')}: {s.name}</div>
                    <div className="s">{s.completedAt ? t('status.completed', { xp: s.xp }) : t('status.inProgress')}</div>
                  </div>
                  <Link className="btn sm ghost" href={`/training/${s.id}`}>
                    {s.completedAt ? t('status.view') : t('status.resume')}
                  </Link>
                </div>
              ))}
              <div className="item">
                <div className="grow">
                  <div className="t">{t('status.nutritionTargets')}</div>
                  <div className="s mono">
                    {fmtNum(food.totals.kcal)} / {settings.kcalTarget} kcal · {fmtNum(food.totals.protein)} / {settings.proteinTarget} g protein
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Bar value={food.totals.kcal} max={settings.kcalTarget} className="thin" />
                  </div>
                </div>
                <Link className="btn sm" href="/food">
                  {t('status.log')}
                </Link>
              </div>
              {dueTasks.map((task) => (
                <div className="item" key={task.id}>
                  <TaskCheck done={false} label={t('status.complete', { title: task.title })} action={toggleTaskAction.bind(null, task.id)} />
                  <div className="grow">
                    <div className="t">{task.title}</div>
                    <div className="s">
                      {task.dueDate && task.dueDate < today ? t('status.overdue', { date: formatDay(task.dueDate) }) : t('status.dueToday')} · +{task.xp} XP
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={t('status.weighIn')} action={lastWeight && <span className="mono">{lastWeight.kg} kg</span>}>
            <RunForm action={logWeightAction} className="form-row">
              <label className="field">
                {t('status.bodyWeight')}
                <input name="kg" type="number" step="0.1" min="20" max="400" required placeholder={lastWeight ? String(lastWeight.kg) : '90.0'} />
              </label>
              <button className="btn primary">{t('status.logWeight')}</button>
            </RunForm>
            {settings.goalWeight && <div className="tiny dim mt-s">{t('status.goal', { weight: settings.goalWeight })}</div>}
          </Panel>

          <Panel title={t('status.systemLog')}>
            {events.length === 0 ? (
              <div className="empty">{t('status.noXp')}</div>
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
