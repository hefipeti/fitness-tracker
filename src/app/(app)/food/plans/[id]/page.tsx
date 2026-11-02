import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { PageHead,  fmtNum } from '@/components/ui';
import { getNutritionPlan } from '@/lib/queries';
import { PrepSessionChecklist } from '@/components/prep-session-checklist';
import { updateNutritionPlanAction, updatePrepSessionAction } from '@/lib/actions/nutrition-plans';
import { getTranslations } from 'next-intl/server';
import type { DayMeal } from '@/lib/queries';
import type { ActionError } from '@/lib/types';

type NutritionAction = (fd: FormData) => Promise<ActionError | void>;
const asFormAction = (fn: NutritionAction) => fn as unknown as (fd: FormData) => Promise<void>;

export const metadata = { title: 'Nutrition plan' };

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

function groupByMeal(meals: DayMeal[]): Record<string, DayMeal[]> {
  const g: Record<string, DayMeal[]> = {};
  for (const m of meals) {
    if (!g[m.meal]) g[m.meal] = [];
    g[m.meal].push(m);
  }
  return g;
}

export default async function NutritionPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: uid } = await requireUser();
  const { id } = await params;
  const planId = parseInt(id, 10);
  if (isNaN(planId)) notFound();

  const [plan, t] = await Promise.all([getNutritionPlan(uid, planId), getTranslations()]);
  if (!plan) notFound();

  const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  const dayNames: Record<number, string> = {};
  for (let i = 0; i < 7; i++) {
    dayNames[i + 1] = t(`weekdays.${WEEKDAY_KEYS[i]}`);
  }

  const mealLabels: Record<string, string> = {
    breakfast: t('food.breakfast'),
    lunch: t('food.lunch'),
    dinner: t('food.dinner'),
    snack: t('food.snack'),
  };

  return (
    <>
      <PageHead kicker={t('nutritionPlans.kicker')} title={plan.name}>
        <div className="row">
          {plan.active && <span className="badge on">{t('nutritionPlans.active')}</span>}
          <Link className="btn ghost" href="/food/plans">
            {t('nutritionPlans.backToPlans')}
          </Link>
        </div>
      </PageHead>

      {/* Weekly meal grid */}
      <section style={{ marginBottom: 32 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>[ {t('nutritionPlans.weeklyPlan')} ]</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
            const dayMeals = plan.dayMeals.filter((m) => m.weekday === wd);
            const prep = plan.prepSessions.find((s) => s.cookWeekday === wd);
            const grouped = groupByMeal(dayMeals);
            const totalKcal = dayMeals.reduce((a, m) => a + m.kcal, 0);
            const totalProtein = dayMeals.reduce((a, m) => a + m.protein, 0);

            return (
              <div
                key={wd}
                className="panel"
                style={{
                  borderColor: prep ? 'var(--violet)' : undefined,
                  background: prep ? 'rgba(139,92,246,0.05)' : undefined,
                }}
              >
                <div className="panel-title">
                  <span style={{ fontWeight: 700 }}>{dayNames[wd]}</span>
                  {prep && <span className="small" style={{ color: 'var(--violet-2)' }}>🍳</span>}
                </div>

                {dayMeals.length === 0 ? (
                  <div className="small dim">{t('nutritionPlans.restDay')}</div>
                ) : (
                  <>
                    {MEAL_ORDER.map((meal) => {
                      const items = grouped[meal];
                      if (!items) return null;
                      return (
                        <div key={meal} style={{ marginBottom: 8 }}>
                          <div className="tiny dim" style={{ textTransform: 'capitalize', marginBottom: 3 }}>
                            {mealLabels[meal]}
                          </div>
                          {items.map((m) => (
                            <div key={m.id} style={{ fontSize: '0.82rem', paddingLeft: 6, borderLeft: `2px solid ${m.prepSessionId ? 'var(--violet)' : 'var(--line-strong)'}`, marginBottom: 2 }}>
                              <span style={{ color: m.prepSessionId ? 'var(--violet-3)' : 'var(--text)' }}>
                                {m.foodName}
                              </span>
                              {m.servings !== 1 && <span className="dim"> ×{m.servings}</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <div className="tiny muted" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)' }}>
                      {fmtNum(totalKcal)} kcal · {fmtNum(totalProtein, 1)}g P
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Plan rename */}
      <section style={{ marginBottom: 32 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>[ {t('nutritionPlans.name')} ]</div>
        <form action={asFormAction(updateNutritionPlanAction)} className="form-row" style={{ maxWidth: 500 }}>
          <input type="hidden" name="id" value={plan.id} />
          <label className="field grow">
            <input name="name" defaultValue={plan.name} required maxLength={120} />
          </label>
          <button className="btn sm" style={{ alignSelf: 'flex-end' }}>{t('nutritionPlans.saveName')}</button>
        </form>
      </section>

      {/* Prep sessions */}
      <section>
        <div className="kicker" style={{ marginBottom: 12 }}>[ {t('nutritionPlans.prepSessions')} ]</div>
        {plan.prepSessions.length === 0 ? (
          <div className="small dim">{t('nutritionPlans.noPrepSessions')}</div>
        ) : (
          <div className="col" style={{ gap: 24, maxWidth: 600 }}>
            {plan.prepSessions.map((session) => (
              <div key={session.id} className="col" style={{ gap: 10 }}>
                <PrepSessionChecklist session={session} dayNames={dayNames} />
                <details className="panel" style={{ padding: '10px 14px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--violet-3)', fontSize: '0.86rem' }}>
                    {t('nutritionPlans.editPrepSession')}
                  </summary>
                  <form action={asFormAction(updatePrepSessionAction)} className="col" style={{ marginTop: 12, gap: 10 }}>
                    <input type="hidden" name="id" value={session.id} />
                    <label className="field">
                      {t('nutritionPlans.name')}
                      <input name="name" defaultValue={session.name} required maxLength={120} />
                    </label>
                    <label className="field">
                      {t('nutritionPlans.cookOn')}
                      <select name="cookWeekday" defaultValue={session.cookWeekday}>
                        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                          <option key={d} value={d}>{dayNames[d]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      {t('nutritionPlans.notesMarkdown')}
                      <textarea name="notes" defaultValue={session.notes} maxLength={2000} rows={6} style={{ resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.86rem' }} />
                    </label>
                    <div>
                      <button className="btn sm primary">{t('nutritionPlans.saveSession')}</button>
                    </div>
                  </form>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
