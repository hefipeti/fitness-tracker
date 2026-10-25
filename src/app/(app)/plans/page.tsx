import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { PageHead, Panel } from '@/components/ui';
import { listPlans } from '@/lib/queries';
import { formatShort } from '@/lib/dates';
import { PLAN_TEMPLATES } from '@/lib/templates';
import {
  createPlanAction,
  deletePlanAction,
  duplicatePlanAction,
  importTemplateAction,
  setActivePlanAction,
} from '@/lib/actions/plans';

export const metadata = { title: 'Plans' };

export default async function PlansPage() {
  const { id: uid } = await requireUser();
  const plans = await listPlans(uid);
  return (
    <>
      <PageHead kicker="Skill tree" title="Training plans">
        <Link className="btn" href="/exercises">
          Exercise library
        </Link>
      </PageHead>

      <p className="muted small" style={{ maxWidth: 720, marginBottom: 18 }}>
        A plan is a set of training days with exercises. Only one plan is active at a time and it drives your weekly schedule. Past workouts are
        never changed when you edit a plan, so you can restructure freely. For a new block, duplicate the current plan, adjust it, then activate it.
      </p>

      <div className="grid c2">
        {plans.map((p) => (
          <Panel key={p.id} title={p.active ? 'Active plan' : 'Plan'} className={p.active ? 'glow' : ''}>
            <div className="row between wrap">
              <h2 style={{ fontSize: '1.15rem' }}>{p.name}</h2>
              {p.active && <span className="badge on">active</span>}
            </div>
            <div className="small muted mt-s">
              {p.dayCount} training day{p.dayCount === 1 ? '' : 's'} · created {formatShort(p.createdAt.slice(0, 10))}
            </div>
            {p.notes && <p className="small dim mt-s">{p.notes}</p>}
            <div className="row wrap mt">
              <Link className="btn primary sm" href={`/plans/${p.id}`}>
                Edit
              </Link>
              {!p.active && (
                <form action={setActivePlanAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn sm">Activate</button>
                </form>
              )}
              <form action={duplicatePlanAction}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn sm ghost">Duplicate</button>
              </form>
              {!p.active && (
                <form action={deletePlanAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn sm danger">Delete</button>
                </form>
              )}
            </div>
          </Panel>
        ))}

        <Panel title="Ready-made plans">
          <div className="list">
            {PLAN_TEMPLATES.map((t) => (
              <div className="item" key={t.key} style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="t">{t.name}</div>
                  <div className="s">{t.description}</div>
                </div>
                <form action={importTemplateAction}>
                  <input type="hidden" name="template" value={t.key} />
                  <button className="btn sm">Add</button>
                </form>
              </div>
            ))}
          </div>
          <p className="tiny dim mt-s">Adds a copy to your plans. Your active plan stays as it is until you activate the new one.</p>
        </Panel>

        <Panel title="New plan">
          <form action={createPlanAction} className="col">
            <label className="field">
              Name
              <input name="name" required maxLength={80} placeholder="e.g. Block 2: Pull-up focus" />
            </label>
            <label className="field">
              Notes (optional)
              <input name="notes" maxLength={500} placeholder="Goals for this block" />
            </label>
            <div>
              <button className="btn primary">Create plan</button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
