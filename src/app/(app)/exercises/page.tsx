import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { CategoryBadge, PageHead, Panel } from '@/components/ui';
import { SearchableSelect } from '@/components/searchable-select';
import { listExercises } from '@/lib/queries';
import { CATEGORIES, MODES } from '@/lib/types';
import { archiveExerciseAction, createExerciseAction, updateExerciseAction } from '@/lib/actions/plans';

export const metadata = { title: 'Exercise library' };

const MODE_LABEL: Record<string, string> = {
  reps: 'Bodyweight reps',
  seconds: 'Timed hold (seconds)',
  weighted: 'Weighted (kg × reps)',
  assisted: 'Assisted (assist kg × reps, less is better)',
};

export default async function ExercisesPage() {
  const { id: uid } = await requireUser();
  const all = await listExercises(uid, true);
  const mine = all.filter((e) => e.custom && !e.archived);
  const archived = all.filter((e) => e.custom && e.archived);
  const builtIn = all.filter((e) => !e.custom);

  return (
    <>
      <PageHead kicker="Arsenal" title="Exercise library">
        <Link className="btn ghost" href="/plans">
          Back to plans
        </Link>
      </PageHead>

      <Panel title="New exercise">
        <form action={createExerciseAction} className="form-row">
          <label className="field" style={{ flex: '2 1 220px' }}>
            Name
            <input name="name" required maxLength={80} placeholder="e.g. Archer Push-up" />
          </label>
          <label className="field">
            Category
            <SearchableSelect
              name="category"
              defaultValue="push"
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </label>
          <label className="field">
            Tracked as
            <SearchableSelect
              name="mode"
              defaultValue="reps"
              options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
            />
          </label>
          <button className="btn primary">Add</button>
        </form>
        <p className="tiny dim mt-s">
          How an exercise is tracked cannot be changed later, so your logged history stays correct. Exercises you add are only visible to
          your account.
        </p>
      </Panel>

      {mine.length > 0 && (
        <Panel title={`Your exercises (${mine.length})`} className="mt">
          <div className="list">
            {mine.map((e) => (
              <div className="item pe-row" key={e.id}>
                <form action={updateExerciseAction} className="pe-form grow">
                  <input type="hidden" name="id" value={e.id} />
                  <label className="field pe-note">
                    Name
                    <input name="name" defaultValue={e.name} required maxLength={80} />
                  </label>
                  <label className="field pe-num" style={{ width: 110 }}>
                    Category
                    <SearchableSelect
                      name="category"
                      defaultValue={e.category}
                      options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                    />
                  </label>
                  <span className="tiny muted" style={{ width: 150 }}>
                    {MODE_LABEL[e.mode]}
                  </span>
                  <button className="btn sm">Save</button>
                </form>
                <form action={archiveExerciseAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="btn sm ghost">Archive</button>
                </form>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title={`Built-in exercises (${builtIn.length})`} className="mt">
        <div className="list">
          {builtIn.map((e) => (
            <div className="item" key={e.id} style={{ padding: '7px 0' }}>
              <div className="grow">{e.name}</div>
              <span className="tiny muted">{MODE_LABEL[e.mode]}</span>
              <CategoryBadge category={e.category} />
            </div>
          ))}
        </div>
        <p className="tiny dim mt-s">Built-in exercises are shared by every account and cannot be edited.</p>
      </Panel>

      {archived.length > 0 && (
        <Panel title={`Archived (${archived.length})`} className="mt">
          <div className="list">
            {archived.map((e) => (
              <div className="item" key={e.id}>
                <div className="grow muted">
                  {e.name} <span className="tiny dim">· {e.category}</span>
                </div>
                <form action={archiveExerciseAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="btn sm ghost">Restore</button>
                </form>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
