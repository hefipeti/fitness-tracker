import { requireUser } from '@/lib/auth';
import { PageHead, Panel } from '@/components/ui';
import { RunForm, TaskCheck } from '@/components/system';
import { SearchableSelect } from '@/components/searchable-select';
import { listDoneTasks, listOpenTasks, type Task } from '@/lib/queries';
import { formatDay, todayStr } from '@/lib/dates';
import { createTaskAction, deleteTaskAction, toggleTaskAction } from '@/lib/actions/tasks';

export const metadata = { title: 'Quests' };

function TaskRow({ t, today }: { t: Task; today: string }) {
  const done = !!t.doneAt;
  const overdue = !done && t.dueDate != null && t.dueDate < today;
  return (
    <div className={`item ${done ? 'done' : ''}`}>
      <TaskCheck done={done} label={done ? `Undo ${t.title}` : `Complete ${t.title}`} action={toggleTaskAction.bind(null, t.id)} />
      <div className="grow">
        <div className="t">{t.title}</div>
        <div className="s">
          {t.dueDate ? (overdue ? `Overdue · ${formatDay(t.dueDate)}` : formatDay(t.dueDate)) : 'No date'}
          {t.repeat !== 'none' && ` · repeats ${t.repeat}`} · +{t.xp} XP
        </div>
      </div>
      <form action={deleteTaskAction}>
        <input type="hidden" name="id" value={t.id} />
        <button className="btn sm ghost icon" aria-label={`Delete ${t.title}`}>
          ✕
        </button>
      </form>
    </div>
  );
}

export default async function TasksPage() {
  const { id: uid } = await requireUser();
  const today = todayStr();
  const [open, done] = await Promise.all([listOpenTasks(uid), listDoneTasks(uid, 15)]);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = open.filter((t) => t.dueDate === today);
  const upcoming = open.filter((t) => t.dueDate && t.dueDate > today);
  const undated = open.filter((t) => !t.dueDate);

  const groups: [string, Task[]][] = [
    ['Overdue', overdue],
    ['Today', dueToday],
    ['Upcoming', upcoming],
    ['Anytime', undated],
  ];

  return (
    <>
      <PageHead kicker="Quest board" title="Quests & tasks" />

      <div className="grid side-main">
        <div className="col" style={{ gap: 16 }}>
          {open.length === 0 && (
            <Panel>
              <div className="empty">All quests cleared. Add a new one.</div>
            </Panel>
          )}
          {groups.map(
            ([label, list]) =>
              list.length > 0 && (
                <Panel key={label} title={`${label} (${list.length})`}>
                  <div className="list">
                    {list.map((t) => (
                      <TaskRow key={t.id} t={t} today={today} />
                    ))}
                  </div>
                </Panel>
              ),
          )}
          {done.length > 0 && (
            <Panel title="Recently completed">
              <div className="list">
                {done.map((t) => (
                  <TaskRow key={t.id} t={t} today={today} />
                ))}
              </div>
            </Panel>
          )}
        </div>

        <Panel title="New quest">
          <RunForm action={createTaskAction} className="col">
            <label className="field">
              Title
              <input name="title" required maxLength={160} placeholder="e.g. Mobility routine 15 min" />
            </label>
            <div className="form-row">
              <label className="field">
                Due date
                <input name="dueDate" type="date" defaultValue={today} />
              </label>
              <label className="field">
                Repeat
                <SearchableSelect
                  name="repeat"
                  defaultValue="none"
                  options={[
                    { value: 'none', label: 'Once' },
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                  ]}
                />
              </label>
              <label className="field">
                Reward
                <SearchableSelect
                  name="xp"
                  defaultValue="20"
                  options={[
                    { value: '10', label: '10 XP · small' },
                    { value: '20', label: '20 XP · normal' },
                    { value: '40', label: '40 XP · hard' },
                    { value: '80', label: '80 XP · boss' },
                  ]}
                />
              </label>
            </div>
            <div>
              <button className="btn primary">Add quest</button>
            </div>
          </RunForm>
        </Panel>
      </div>
    </>
  );
}
