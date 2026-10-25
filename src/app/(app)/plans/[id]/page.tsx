import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { CategoryBadge, PageHead, Panel } from '@/components/ui';
import { SearchableSelect } from '@/components/searchable-select';
import { PlanGuide } from '@/components/plan-guide';
import { getPlan, listExercises } from '@/lib/queries';
import { WEEKDAYS } from '@/lib/dates';
import {
  addDayAction,
  addPlanExerciseAction,
  deleteDayAction,
  deletePlanAction,
  deletePlanExerciseAction,
  duplicatePlanAction,
  movePlanExerciseAction,
  renamePlanAction,
  setActivePlanAction,
  updateDayAction,
  updatePlanExerciseAction,
} from '@/lib/actions/plans';

export const metadata = { title: 'Edit plan' };

function WeekdaySelect({ value }: { value: number | null }) {
  return (
    <SearchableSelect
      name="weekday"
      defaultValue={value ?? ''}
      placeholder="Unscheduled"
      options={WEEKDAYS.map((w, i) => ({ value: i + 1, label: w }))}
    />
  );
}

export default async function PlanEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id: uid } = await requireUser();
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [plan, library] = await Promise.all([getPlan(uid, id), listExercises(uid)]);
  if (!plan) notFound();

  return (
    <>
      <PageHead kicker="Skill tree" title={plan.name}>
        <div className="row wrap">
          {plan.active ? (
            <span className="badge on">active</span>
          ) : (
            <form action={setActivePlanAction}>
              <input type="hidden" name="id" value={plan.id} />
              <button className="btn primary sm">Activate</button>
            </form>
          )}
          <form action={duplicatePlanAction}>
            <input type="hidden" name="id" value={plan.id} />
            <button className="btn sm ghost">Duplicate</button>
          </form>
          <Link className="btn sm ghost" href="/plans">
            All plans
          </Link>
        </div>
      </PageHead>

      <Panel title="Plan details">
        <form action={renamePlanAction} className="form-row">
          <input type="hidden" name="id" value={plan.id} />
          <label className="field" style={{ flex: '1 1 220px' }}>
            Name
            <input name="name" defaultValue={plan.name} required maxLength={80} />
          </label>
          <label className="field" style={{ flex: '2 1 280px' }}>
            Notes
            <input name="notes" defaultValue={plan.notes} maxLength={500} />
          </label>
          <button className="btn">Save</button>
        </form>
      </Panel>

      {plan.guide && plan.guide.length > 0 && (
        <Panel title="Plan guide" className="mt">
          <PlanGuide sections={plan.guide} />
        </Panel>
      )}

      <div className="col mt" style={{ gap: 16 }}>
        {plan.days.map((day) => (
          <Panel key={day.id} title={day.weekday ? `${WEEKDAYS[day.weekday - 1]} · ${day.name}` : day.name}>
            <div className="row wrap between" style={{ marginBottom: 12 }}>
              <form action={updateDayAction} className="form-row grow">
                <input type="hidden" name="id" value={day.id} />
                <label className="field" style={{ flex: '2 1 160px' }}>
                  Day name
                  <input name="name" defaultValue={day.name} required maxLength={80} />
                </label>
                <label className="field">
                  Scheduled on
                  <WeekdaySelect value={day.weekday} />
                </label>
                <button className="btn sm">Save day</button>
              </form>
              <form action={deleteDayAction}>
                <input type="hidden" name="id" value={day.id} />
                <button className="btn sm danger">Delete day</button>
              </form>
            </div>

            <div className="list">
              {day.exercises.length === 0 && <div className="empty">No exercises. Add one below.</div>}
              {day.exercises.map((e, idx) => (
                <div className="item pe-row" key={e.id}>
                  <div className="pe-name">
                    <div className="t">{e.name}</div>
                    <CategoryBadge category={e.category} />
                  </div>
                  <form action={updatePlanExerciseAction} className="pe-form">
                    <input type="hidden" name="id" value={e.id} />
                    <label className="field pe-num">
                      Sets
                      <input name="sets" type="number" min="1" max="20" defaultValue={e.targetSets} />
                    </label>
                    <label className="field pe-num">
                      {e.mode === 'seconds' ? 'Seconds' : 'Reps'}
                      <input name="reps" type="number" min="1" max="1000" defaultValue={e.targetReps} />
                    </label>
                    {e.mode === 'weighted' || e.mode === 'assisted' ? (
                      <label className="field pe-num">
                        {e.mode === 'assisted' ? 'Assist kg' : 'Kg'}
                        <input name="weight" type="number" step="0.5" min="0" defaultValue={e.targetWeight ?? ''} />
                      </label>
                    ) : (
                      <input type="hidden" name="weight" value="" />
                    )}
                    <label className="field pe-note">
                      Note
                      <input name="note" defaultValue={e.note} maxLength={300} />
                    </label>
                    <button className="btn sm">Save</button>
                  </form>
                  <div className="row" style={{ gap: 4 }}>
                    <form action={movePlanExerciseAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button className="btn sm ghost icon" disabled={idx === 0} aria-label="Move up">
                        ↑
                      </button>
                    </form>
                    <form action={movePlanExerciseAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button className="btn sm ghost icon" disabled={idx === day.exercises.length - 1} aria-label="Move down">
                        ↓
                      </button>
                    </form>
                    <form action={deletePlanExerciseAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className="btn sm danger icon" aria-label={`Remove ${e.name}`}>
                        ✕
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <details className="fold mt">
              <summary>Add exercise</summary>
              <form action={addPlanExerciseAction} className="form-row">
                <input type="hidden" name="dayId" value={day.id} />
                <label className="field" style={{ flex: '2 1 200px' }}>
                  Exercise
                  <SearchableSelect
                    name="exerciseId"
                    required
                    options={library.map((x) => ({ value: x.id, label: `${x.name} (${x.category}, ${x.mode})` }))}
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
                <label className="field">
                  Kg / assist kg
                  <input name="weight" type="number" step="0.5" min="0" />
                </label>
                <label className="field" style={{ flex: '2 1 160px' }}>
                  Note
                  <input name="note" maxLength={300} />
                </label>
                <button className="btn primary">Add</button>
              </form>
              <p className="tiny dim mt-s">
                Missing an exercise? Add it in the <Link href="/exercises">exercise library</Link>.
              </p>
            </details>
          </Panel>
        ))}

        <Panel title="Add training day">
          <form action={addDayAction} className="form-row">
            <input type="hidden" name="planId" value={plan.id} />
            <label className="field" style={{ flex: '2 1 200px' }}>
              Day name
              <input name="name" required maxLength={80} placeholder="e.g. Pull + Handstand" />
            </label>
            <label className="field">
              Scheduled on
              <WeekdaySelect value={null} />
            </label>
            <button className="btn primary">Add day</button>
          </form>
        </Panel>

        {!plan.active && (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <form action={deletePlanAction}>
              <input type="hidden" name="id" value={plan.id} />
              <button className="btn danger sm">Delete this plan</button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
