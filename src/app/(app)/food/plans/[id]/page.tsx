import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { PageHead,  fmtNum } from '@/components/ui';
import { getNutritionPlan } from '@/lib/queries';
import { PrepSessionChecklist } from '@/components/prep-session-checklist';
import { getTranslations } from 'next-intl/server';
import type { DayMeal } from '@/lib/queries';

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

      {/* Prep sessions */}
      <section>
        <div className="kicker" style={{ marginBottom: 12 }}>[ {t('nutritionPlans.prepSessions')} ]</div>
        {plan.prepSessions.length === 0 ? (
          <div className="small dim">{t('nutritionPlans.noPrepSessions')}</div>
        ) : (
          <div className="col" style={{ gap: 10, maxWidth: 600 }}>
            {plan.prepSessions.map((session) => (
              <PrepSessionChecklist key={session.id} session={session} dayNames={dayNames} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
