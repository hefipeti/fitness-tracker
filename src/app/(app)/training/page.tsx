import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { PageHead, Panel } from '@/components/ui';
import { getActivePlan, getScheduledDays, listSessions } from '@/lib/queries';
import { formatDay, todayStr } from '@/lib/dates';
import { startSessionAction } from '@/lib/actions/training';
import { getTranslations } from 'next-intl/server';

export const metadata = { title: 'Training' };

export default async function TrainingPage() {
  const { id: uid } = await requireUser();
  const today = todayStr();
  const [plan, scheduledToday, sessions, t] = await Promise.all([
    getActivePlan(uid),
    getScheduledDays(uid, today),
    listSessions(uid, 40),
    getTranslations(),
  ]);
  const open = sessions.filter((s) => !s.completedAt);
  const history = sessions.filter((s) => s.completedAt);
  const todayIds = new Set(scheduledToday.map((d) => d.id));

  const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

  return (
    <>
      <PageHead kicker={t('training.kicker')} title={t('training.title')}>
        <Link className="btn" href="/plans">
          {t('training.editPlans')}
        </Link>
      </PageHead>

      {open.length > 0 && (
        <Panel title={t('training.inProgress')} className="glow">
          <div className="list">
            {open.map((s) => (
              <div className="item" key={s.id}>
                <div className="grow">
                  <div className="t">{s.name}</div>
                  <div className="s">
                    {formatDay(s.date)} · {t('training.setsLogged', { count: s.setCount })}
                  </div>
                </div>
                <Link className="btn primary sm" href={`/training/${s.id}`}>
                  {t('training.resume')}
                </Link>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid c2 mt">
        <Panel title={plan ? `${t('training.title')}: ${plan.name}` : t('training.noActivePlan')} action={<Link href="/plans">{t('training.manage')}</Link>}>
          {!plan || plan.days.length === 0 ? (
            <div className="empty">
              {t('training.noPlanYet')}
            </div>
          ) : (
            <div className="list">
              {plan.days.map((d) => (
                <div className="item" key={d.id}>
                  <div className="grow">
                    <div className="t">
                      {d.weekday ? `${t(`weekdays.${WEEKDAY_KEYS[d.weekday - 1]}`)} · ` : ''}
                      {d.name}
                      {todayIds.has(d.id) && (
                        <span className="badge on" style={{ marginLeft: 8 }}>
                          {t('training.today')}
                        </span>
                      )}
                    </div>
                    <div className="s">{d.exercises.map((e) => e.name).join(', ') || t('training.noExercises')}</div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Link className="btn sm ghost" href={`/training/preview/${d.id}`}>
                      {t('training.preview')}
                    </Link>
                    <form action={startSessionAction}>
                      <input type="hidden" name="planDayId" value={d.id} />
                      <button className={`btn sm ${todayIds.has(d.id) ? 'primary' : ''}`} disabled={d.exercises.length === 0}>
                        {t('training.start')}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('training.freeWorkout')}>
          <p className="small muted" style={{ marginBottom: 12 }}>
            {t('training.freeWorkoutDesc')}
          </p>
          <form action={startSessionAction} className="form-row">
            <label className="field">
              <input name="name" placeholder={t('training.freeWorkoutPlaceholder')} maxLength={80} />
            </label>
            <button className="btn primary">{t('training.start')}</button>
          </form>
        </Panel>
      </div>

      <Panel title={t('training.history')} className="mt">
        {history.length === 0 ? (
          <div className="empty">{t('training.noHistory')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('training.date')}</th>
                <th>{t('training.workout')}</th>
                <th className="num">{t('training.sets')}</th>
                <th className="num">{t('training.xp')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{formatDay(s.date)}</td>
                  <td>{s.name}</td>
                  <td className="num">{s.setCount}</td>
                  <td className="num">+{s.xp}</td>
                  <td className="right">
                    <Link href={`/training/${s.id}`}>{t('training.open')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
