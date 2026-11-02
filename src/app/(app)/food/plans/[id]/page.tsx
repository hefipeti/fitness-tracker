import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { PageHead, fmtNum } from '@/components/ui';
import { getNutritionPlan, listFoods } from '@/lib/queries';
import { PrepSessionChecklist } from '@/components/prep-session-checklist';
import {
  updateNutritionPlanAction,
  updatePrepSessionAction,
  createPrepSessionAction,
  addPlannedMealAction,
  removePlannedMealAction,
  addPrepIngredientAction,
  removePrepIngredientAction,
  deletePrepSessionAction,
} from '@/lib/actions/nutrition-plans';
import { getTranslations } from 'next-intl/server';
import { SearchableSelect } from '@/components/searchable-select';
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

  const [plan, foods, t] = await Promise.all([
    getNutritionPlan(uid, planId),
    listFoods(uid),
    getTranslations(),
  ]);
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

  const foodOptions = foods.map((f) => ({
    value: f.id,
    label: `${f.name} · ${f.servingLabel} · ${f.kcal} kcal`,
  }));

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
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', paddingLeft: 6, borderLeft: `2px solid ${m.prepSessionId ? 'var(--violet)' : 'var(--line-strong)'}`, marginBottom: 2 }}>
                              <span style={{ flex: 1, color: m.prepSessionId ? 'var(--violet-3)' : 'var(--text)' }}>
                                {m.foodName}
                              </span>
                              {m.servings !== 1 && <span className="dim">×{m.servings}</span>}
                              <form action={asFormAction(removePlannedMealAction)} style={{ display: 'inline', lineHeight: 1 }}>
                                <input type="hidden" name="id" value={m.id} />
                                <button
                                  className="btn ghost xs"
                                  title={t('nutritionPlans.remove')}
                                  style={{ padding: '0 4px', fontSize: '0.75rem', lineHeight: 1.2 }}
                                >
                                  ×
                                </button>
                              </form>
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

                {/* Add meal form */}
                <details style={{ marginTop: 8 }}>
                  <summary className="tiny" style={{ cursor: 'pointer', color: 'var(--accent)' }}>
                    {t('nutritionPlans.addMeal')}
                  </summary>
                  <form action={asFormAction(addPlannedMealAction)} className="col" style={{ marginTop: 8, gap: 6 }}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="weekday" value={wd} />
                    <label className="field">
                      <select name="meal">
                        {MEAL_ORDER.map((meal) => (
                          <option key={meal} value={meal}>{mealLabels[meal]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <SearchableSelect
                        name="foodId"
                        required
                        options={foodOptions}
                        placeholder="Search food…"
                      />
                    </label>
                    <label className="field">
                      Servings
                      <input name="servings" type="number" min="0.05" max="100" step="0.05" defaultValue="1" />
                    </label>
                    <button className="btn sm primary">Add</button>
                  </form>
                </details>
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
        {plan.prepSessions.length === 0 && (
          <div className="small dim" style={{ marginBottom: 16 }}>{t('nutritionPlans.noPrepSessions')}</div>
        )}
        {plan.prepSessions.length > 0 && (
          <div className="col" style={{ gap: 24, maxWidth: 600, marginBottom: 24 }}>
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
                  <form action={asFormAction(deletePrepSessionAction)} style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={session.id} />
                    <button className="btn sm ghost" style={{ color: 'var(--danger, #e55)' }}>{t('nutritionPlans.deleteSession')}</button>
                  </form>

                  {/* Ingredients */}
                  <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                    <div className="tiny dim" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t('nutritionPlans.ingredients')}
                    </div>
                    {session.ingredients.length === 0 ? (
                      <div className="small dim" style={{ marginBottom: 10 }}>{t('nutritionPlans.noIngredients')}</div>
                    ) : (
                      <div className="col" style={{ gap: 4, marginBottom: 12 }}>
                        {session.ingredients.map((ing) => (
                          <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                            <span style={{ flex: 1 }}>{ing.name}</span>
                            {ing.unit && <span className="dim small">{ing.unit}</span>}
                            <form action={asFormAction(removePrepIngredientAction)} style={{ display: 'inline', lineHeight: 1 }}>
                              <input type="hidden" name="id" value={ing.id} />
                              <button className="btn ghost xs" title={t('nutritionPlans.remove')} style={{ padding: '0 4px', fontSize: '0.75rem' }}>×</button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}
                    <form action={asFormAction(addPrepIngredientAction)} className="form-row" style={{ gap: 6 }}>
                      <input type="hidden" name="prepSessionId" value={session.id} />
                      <label className="field" style={{ flex: '2 1 140px' }}>
                        <input name="name" required maxLength={200} placeholder={t('nutritionPlans.ingredientNamePlaceholder')} />
                      </label>
                      <label className="field" style={{ flex: '1 1 80px' }}>
                        <input name="unit" maxLength={50} placeholder={t('nutritionPlans.ingredientUnitPlaceholder')} />
                      </label>
                      <button className="btn sm primary" style={{ alignSelf: 'flex-end' }}>{t('nutritionPlans.addItem')}</button>
                    </form>
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}

        {/* New prep session form */}
        <details className="panel" style={{ padding: '10px 14px', maxWidth: 600 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', fontSize: '0.86rem' }}>
            {t('nutritionPlans.newPrepSession')}
          </summary>
          <form action={asFormAction(createPrepSessionAction)} className="col" style={{ marginTop: 12, gap: 10 }}>
            <input type="hidden" name="planId" value={plan.id} />
            <label className="field">
              {t('nutritionPlans.name')}
              <input name="name" required maxLength={120} placeholder={t('nutritionPlans.prepSessionNamePlaceholder')} />
            </label>
            <label className="field">
              {t('nutritionPlans.cookOn')}
              <select name="cookWeekday">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>{dayNames[d]}</option>
                ))}
              </select>
            </label>
            <label className="field">
              {t('nutritionPlans.notesMarkdown')}
              <textarea name="notes" maxLength={2000} rows={4} style={{ resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.86rem' }} />
            </label>
            <div>
              <button className="btn sm primary">{t('nutritionPlans.createPrepSession')}</button>
            </div>
          </form>
        </details>
      </section>
    </>
  );
}
