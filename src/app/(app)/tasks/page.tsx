import { requireUser } from '@/lib/auth';
import { PageHead, Panel } from '@/components/ui';
import { RunForm, TaskCheck } from '@/components/system';
import { SearchableSelect } from '@/components/searchable-select';
import { listDoneTasks, listOpenTasks, type Task } from '@/lib/queries';
import { formatDay, todayStr } from '@/lib/dates';
import { createTaskAction, deleteTaskAction, toggleTaskAction } from '@/lib/actions/tasks';
import { getTranslations } from 'next-intl/server';

export const metadata = { title: 'Quests' };

export default async function TasksPage() {
  const { id: uid } = await requireUser();
  const today = todayStr();
  const [open, done, t] = await Promise.all([listOpenTasks(uid), listDoneTasks(uid, 15), getTranslations()]);
  const overdue = open.filter((task) => task.dueDate && task.dueDate < today);
  const dueToday = open.filter((task) => task.dueDate === today);
  const upcoming = open.filter((task) => task.dueDate && task.dueDate > today);
  const undated = open.filter((task) => !task.dueDate);

  const groups: [string, Task[]][] = [
    [t('tasks.overdue'), overdue],
    [t('tasks.today'), dueToday],
    [t('tasks.upcoming'), upcoming],
    [t('tasks.anytime'), undated],
  ];

  function renderTask(task: Task) {
    const isDone = !!task.doneAt;
    const isOverdue = !isDone && task.dueDate != null && task.dueDate < today;
    return (
      <div className={`item ${isDone ? 'done' : ''}`} key={task.id}>
        <TaskCheck
          done={isDone}
          label={isDone ? t('tasks.undo', { title: task.title }) : t('tasks.complete', { title: task.title })}
          action={toggleTaskAction.bind(null, task.id)}
        />
        <div className="grow">
          <div className="t">{task.title}</div>
          <div className="s">
            {task.dueDate
              ? isOverdue
                ? `${t('tasks.overdue')} · ${formatDay(task.dueDate)}`
                : formatDay(task.dueDate)
              : t('tasks.noDate')}
            {task.repeat !== 'none' && ` · ${t('tasks.repeats', { repeat: task.repeat })}`} · +{task.xp} XP
          </div>
        </div>
        <form action={deleteTaskAction}>
          <input type="hidden" name="id" value={task.id} />
          <button className="btn sm ghost icon" aria-label={t('tasks.delete', { title: task.title })}>
            ✕
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <PageHead kicker={t('tasks.kicker')} title={t('tasks.title')} />

      <div className="grid side-main">
        <div className="col" style={{ gap: 16 }}>
          {open.length === 0 && (
            <Panel>
              <div className="empty">{t('tasks.allCleared')}</div>
            </Panel>
          )}
          {groups.map(
            ([label, list]) =>
              list.length > 0 && (
                <Panel key={label} title={`${label} (${list.length})`}>
                  <div className="list">{list.map(renderTask)}</div>
                </Panel>
              ),
          )}
          {done.length > 0 && (
            <Panel title={t('tasks.recentlyCompleted')}>
              <div className="list">{done.map(renderTask)}</div>
            </Panel>
          )}
        </div>

        <Panel title={t('tasks.newQuest')}>
          <RunForm action={createTaskAction} className="col">
            <label className="field">
              {t('tasks.questTitle')}
              <input name="title" required maxLength={160} placeholder={t('tasks.questTitlePlaceholder')} />
            </label>
            <div className="form-row">
              <label className="field">
                {t('tasks.dueDate')}
                <input name="dueDate" type="date" defaultValue={today} />
              </label>
              <label className="field">
                {t('tasks.repeat')}
                <SearchableSelect
                  name="repeat"
                  defaultValue="none"
                  options={[
                    { value: 'none', label: t('tasks.repeatOnce') },
                    { value: 'daily', label: t('tasks.repeatDaily') },
                    { value: 'weekly', label: t('tasks.repeatWeekly') },
                  ]}
                />
              </label>
              <label className="field">
                {t('tasks.reward')}
                <SearchableSelect
                  name="xp"
                  defaultValue="20"
                  options={[
                    { value: '10', label: t('tasks.reward10') },
                    { value: '20', label: t('tasks.reward20') },
                    { value: '40', label: t('tasks.reward40') },
                    { value: '80', label: t('tasks.reward80') },
                  ]}
                />
              </label>
            </div>
            <div>
              <button className="btn primary">{t('tasks.addQuest')}</button>
            </div>
          </RunForm>
        </Panel>
      </div>
    </>
  );
}
