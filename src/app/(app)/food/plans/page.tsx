import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { PageHead, Panel } from '@/components/ui';
import { listNutritionPlans } from '@/lib/queries';
import { activateNutritionPlanAction, createNutritionPlanAction, deleteNutritionPlanAction, updateNutritionPlanAction } from '@/lib/actions/nutrition-plans';
import { getTranslations } from 'next-intl/server';
import type { ActionError } from '@/lib/types';

export const metadata = { title: 'Nutrition plans' };

type NutritionAction = (fd: FormData) => Promise<ActionError | void>;
// Next.js <form action> accepts (fd: FormData) => void | Promise<void>.
// Guard-wrapped actions return ActionError | void; the cast is safe because
// the form ignores the return value — errors surface server-side or via logs.
const asFormAction = (fn: NutritionAction) => fn as unknown as (fd: FormData) => Promise<void>;

export default async function NutritionPlansPage() {
  const { id: uid } = await requireUser();
  const [plans, t] = await Promise.all([listNutritionPlans(uid), getTranslations()]);

  return (
    <>
      <PageHead kicker={t('nutritionPlans.kicker')} title={t('nutritionPlans.title')}>
        <Link className="btn ghost" href="/food">
          ← {t('food.title')}
        </Link>
      </PageHead>

      <div className="grid side-main">
        <div className="col" style={{ gap: 16 }}>
          {plans.length === 0 ? (
            <div className="small dim">{t('nutritionPlans.noPlans')}</div>
          ) : (
            plans.map((plan) => (
              <Panel
                key={plan.id}
                title={plan.name}
                action={plan.active ? <span className="badge on">{t('nutritionPlans.active')}</span> : undefined}
              >
                <form action={asFormAction(updateNutritionPlanAction)} className="form-row" style={{ marginTop: 8 }}>
                  <input type="hidden" name="id" value={plan.id} />
                  <label className="field grow">
                    {t('nutritionPlans.name')}
                    <input name="name" defaultValue={plan.name} required maxLength={120} />
                  </label>
                  <button className="btn sm" style={{ alignSelf: 'flex-end' }}>{t('nutritionPlans.saveName')}</button>
                </form>
                <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
                  <Link className="btn sm primary" href={`/food/plans/${plan.id}`}>
                    {t('nutritionPlans.viewPlan')}
                  </Link>
                  {!plan.active && (
                    <form action={asFormAction(activateNutritionPlanAction)}>
                      <input type="hidden" name="id" value={plan.id} />
                      <button className="btn sm">{t('nutritionPlans.activate')}</button>
                    </form>
                  )}
                  {!plan.active && (
                    <form action={asFormAction(deleteNutritionPlanAction)}>
                      <input type="hidden" name="id" value={plan.id} />
                      <button className="btn sm danger">{t('nutritionPlans.delete')}</button>
                    </form>
                  )}
                </div>
              </Panel>
            ))
          )}
        </div>

        <div className="col" style={{ gap: 16 }}>
          <Panel title={t('nutritionPlans.newPlan')}>
            <form action={asFormAction(createNutritionPlanAction)} className="col">
              <label className="field">
                {t('nutritionPlans.name')}
                <input name="name" required maxLength={120} placeholder={t('nutritionPlans.namePlaceholder')} />
              </label>
              <div>
                <button className="btn primary">{t('nutritionPlans.create')}</button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
