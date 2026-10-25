import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { PageHead, Panel } from '@/components/ui';
import { SessionLogger } from '@/components/session-logger';
import { SearchableSelect } from '@/components/searchable-select';
import { getSessionDetail, listExercises } from '@/lib/queries';
import { formatDay } from '@/lib/dates';
import { addSessionExerciseAction, deleteSessionAction } from '@/lib/actions/training';

export const metadata = { title: 'Workout' };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: uid } = await requireUser();
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [detail, library] = await Promise.all([getSessionDetail(uid, id), listExercises(uid)]);
  if (!detail) notFound();
  const { session, exercises } = detail;
  const readOnly = !!session.completedAt;
  const inSession = new Set(exercises.map((e) => e.exerciseId));
  const addable = library.filter((e) => !inSession.has(e.id));

  return (
    <>
      <PageHead kicker={readOnly ? 'Cleared' : 'Dungeon active'} title={session.name}>
        <div className="row">
          <span className="mono muted small">{formatDay(session.date)}</span>
          {readOnly && <span className="badge on">completed · +{session.xp} XP</span>}
          <Link className="btn ghost sm" href="/training">
            Back
          </Link>
        </div>
      </PageHead>

      {exercises.length === 0 ? (
        <Panel>
          <div className="empty">No exercises in this session yet. Add one below.</div>
        </Panel>
      ) : (
        <SessionLogger sessionId={session.id} readOnly={readOnly} exercises={exercises} />
      )}

      {!readOnly && (
        <Panel title="Add exercise" className="mt">
          <form action={addSessionExerciseAction} className="form-row">
            <input type="hidden" name="sessionId" value={session.id} />
            <label className="field" style={{ flex: '2 1 200px' }}>
              Exercise
              <SearchableSelect
                name="exerciseId"
                required
                options={addable.map((e) => ({ value: e.id, label: `${e.name} (${e.category})` }))}
              />
            </label>
            <label className="field">
              Sets
              <input name="sets" type="number" min="1" max="20" defaultValue="3" />
            </label>
            <label className="field">
              Reps / sec
              <input name="reps" type="number" min="1" max="1000" defaultValue="8" />
            </label>
            <button className="btn">Add</button>
          </form>
        </Panel>
      )}

      <div className="row mt" style={{ justifyContent: 'flex-end' }}>
        <form action={deleteSessionAction}>
          <input type="hidden" name="sessionId" value={session.id} />
          <button className="btn danger sm">Delete session</button>
        </form>
      </div>
    </>
  );
}
