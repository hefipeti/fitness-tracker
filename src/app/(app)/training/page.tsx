import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { PageHead, Panel } from '@/components/ui';
import { getActivePlan, getScheduledDays, listSessions } from '@/lib/queries';
import { formatDay, todayStr, WEEKDAYS } from '@/lib/dates';
import { startSessionAction } from '@/lib/actions/training';

export const metadata = { title: 'Training' };

export default async function TrainingPage() {
  const { id: uid } = await requireUser();
  const today = todayStr();
  const [plan, scheduledToday, sessions] = await Promise.all([getActivePlan(uid), getScheduledDays(uid, today), listSessions(uid, 40)]);
  const open = sessions.filter((s) => !s.completedAt);
  const history = sessions.filter((s) => s.completedAt);
  const todayIds = new Set(scheduledToday.map((d) => d.id));

  return (
    <>
      <PageHead kicker="Dungeon" title="Training">
        <Link className="btn" href="/plans">
          Edit plans
        </Link>
      </PageHead>

      {open.length > 0 && (
        <Panel title="In progress" className="glow">
          <div className="list">
            {open.map((s) => (
              <div className="item" key={s.id}>
                <div className="grow">
                  <div className="t">{s.name}</div>
                  <div className="s">
                    {formatDay(s.date)} · {s.setCount} sets logged
                  </div>
                </div>
                <Link className="btn primary sm" href={`/training/${s.id}`}>
                  Resume
                </Link>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid c2 mt">
        <Panel title={plan ? `Plan: ${plan.name}` : 'No active plan'} action={<Link href="/plans">manage</Link>}>
          {!plan || plan.days.length === 0 ? (
            <div className="empty">
              Create or activate a plan on the <Link href="/plans">Plans</Link> page.
            </div>
          ) : (
            <div className="list">
              {plan.days.map((d) => (
                <div className="item" key={d.id}>
                  <div className="grow">
                    <div className="t">
                      {d.weekday ? `${WEEKDAYS[d.weekday - 1]} · ` : ''}
                      {d.name}
                      {todayIds.has(d.id) && (
                        <span className="badge on" style={{ marginLeft: 8 }}>
                          today
                        </span>
                      )}
                    </div>
                    <div className="s">{d.exercises.map((e) => e.name).join(', ') || 'No exercises yet'}</div>
                  </div>
                  <form action={startSessionAction}>
                    <input type="hidden" name="planDayId" value={d.id} />
                    <button className={`btn sm ${todayIds.has(d.id) ? 'primary' : ''}`} disabled={d.exercises.length === 0}>
                      Start
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Free workout">
          <p className="small muted" style={{ marginBottom: 12 }}>
            Not following the plan today? Start an empty session and add exercises as you go.
          </p>
          <form action={startSessionAction} className="form-row">
            <label className="field">
              Name
              <input name="name" placeholder="Free workout" maxLength={80} />
            </label>
            <button className="btn primary">Start</button>
          </form>
        </Panel>
      </div>

      <Panel title="History" className="mt">
        {history.length === 0 ? (
          <div className="empty">No completed workouts yet. Your first one is worth a bonus achievement.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Workout</th>
                <th className="num">Sets</th>
                <th className="num">XP</th>
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
                    <Link href={`/training/${s.id}`}>open</Link>
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
