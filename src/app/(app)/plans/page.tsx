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
import { getTranslations } from 'next-intl/server';

export const metadata = { title: 'Plans' };

export default async function PlansPage() {
  const { id: uid } = await requireUser();
  const [plans, t] = await Promise.all([listPlans(uid), getTranslations()]);
  return (
    <>
      <PageHead kicker={t('plans.kicker')} title={t('plans.title')}>
        <Link className="btn" href="/exercises">
          {t('plans.exerciseLibrary')}
        </Link>
      </PageHead>

      <p className="muted small" style={{ maxWidth: 720, marginBottom: 18 }}>
        {t('plans.planDesc')}
      </p>

      <div className="grid c2">
        {plans.map((p) => (
          <Panel key={p.id} title={p.active ? t('plans.activeLabel') : t('plans.planLabel')} className={p.active ? 'glow' : ''}>
            <div className="row between wrap">
              <h2 style={{ fontSize: '1.15rem' }}>{p.name}</h2>
              {p.active && <span className="badge on">{t('plans.active')}</span>}
            </div>
            <div className="small muted mt-s">
              {p.dayCount === 1 ? t('plans.days', { count: p.dayCount }) : t('plans.days_plural', { count: p.dayCount })} · {t('plans.created', { date: formatShort(p.createdAt.slice(0, 10)) })}
            </div>
            {p.notes && <p className="small dim mt-s">{p.notes}</p>}
            <div className="row wrap mt">
              <Link className="btn primary sm" href={`/plans/${p.id}/view`}>
                {t('plans.view')}
              </Link>
              <Link className="btn sm ghost" href={`/plans/${p.id}`}>
                {t('plans.edit')}
              </Link>
              {!p.active && (
                <form action={setActivePlanAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn sm">{t('plans.activate')}</button>
                </form>
              )}
              <form action={duplicatePlanAction}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn sm ghost">{t('plans.duplicate')}</button>
              </form>
              {!p.active && (
                <form action={deletePlanAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn sm danger">{t('plans.delete')}</button>
                </form>
              )}
            </div>
          </Panel>
        ))}

        <Panel title={t('plans.readyMade')}>
          <div className="list">
            {PLAN_TEMPLATES.map((tmpl) => (
              <div className="item" key={tmpl.key} style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="t">{tmpl.name}</div>
                  <div className="s">{tmpl.description}</div>
                </div>
                <form action={importTemplateAction}>
                  <input type="hidden" name="template" value={tmpl.key} />
                  <button className="btn sm">{t('plans.add')}</button>
                </form>
              </div>
            ))}
          </div>
          <p className="tiny dim mt-s">{t('plans.readyMadeDesc')}</p>
        </Panel>

        <Panel title={t('plans.newPlan')}>
          <form action={createPlanAction} className="col">
            <label className="field">
              {t('plans.name')}
              <input name="name" required maxLength={80} placeholder={t('plans.namePlaceholder')} />
            </label>
            <label className="field">
              {t('plans.notes')}
              <input name="notes" maxLength={500} placeholder={t('plans.notesPlaceholder')} />
            </label>
            <div>
              <button className="btn primary">{t('plans.create')}</button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
