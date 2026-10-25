// PROTOTYPE: Three layout variants for the /nutrition/plans detail page.
// Question: which structure best communicates a weekly meal prep plan?
// Remove before merging to main. Run: npm run dev → /prototype/nutrition-plan?variant=A

import { requireUser } from '@/lib/auth';
import { PageHead, Panel } from '@/components/ui';
import { PrototypeSwitcher } from './switcher';

// ─── Mock data ────────────────────────────────────────────────────────────────

type DayMeal = {
  id: number; weekday: number; meal: string; foodName: string;
  servingLabel: string; servings: number; kcal: number; protein: number;
  carbs: number; fat: number; prepSessionId: number | null;
};
type PrepFood = { name: string; servings: number; servingLabel: string; kcal: number; protein: number };
type PrepSession = { id: number; name: string; cookWeekday: number; notes: string; foods: PrepFood[] };
type Plan = { name: string; active: boolean; prepSessions: PrepSession[]; dayMeals: DayMeal[] };

const PLAN: Plan = {
  name: 'Lean Bulk Phase',
  active: true,
  prepSessions: [
    {
      id: 1, name: 'Sunday Batch', cookWeekday: 7, notes: 'Marinate chicken overnight',
      foods: [
        { name: 'Chicken Breast', servings: 4, servingLabel: '100g', kcal: 165, protein: 31 },
        { name: 'Brown Rice', servings: 6, servingLabel: '1 cup', kcal: 215, protein: 5 },
        { name: 'Broccoli', servings: 5, servingLabel: '1 cup', kcal: 55, protein: 3.7 },
      ],
    },
    {
      id: 2, name: 'Wednesday Prep', cookWeekday: 3, notes: '',
      foods: [
        { name: 'Turkey Mince', servings: 5, servingLabel: '150g', kcal: 180, protein: 30 },
        { name: 'Sweet Potato', servings: 4, servingLabel: '1 medium', kcal: 130, protein: 2.5 },
      ],
    },
  ],
  dayMeals: [
    { id: 1,  weekday: 1, meal: 'breakfast', foodName: 'Protein Oats',   servingLabel: '1 bowl',    servings: 1,   kcal: 380, protein: 28, carbs: 52, fat: 7,    prepSessionId: null },
    { id: 2,  weekday: 1, meal: 'lunch',     foodName: 'Chicken Breast', servingLabel: '100g',      servings: 1,   kcal: 165, protein: 31, carbs: 0,  fat: 3.6,  prepSessionId: 1 },
    { id: 3,  weekday: 1, meal: 'lunch',     foodName: 'Brown Rice',     servingLabel: '1 cup',     servings: 1,   kcal: 215, protein: 5,  carbs: 45, fat: 1.8,  prepSessionId: 1 },
    { id: 4,  weekday: 1, meal: 'dinner',    foodName: 'Turkey Mince',   servingLabel: '150g',      servings: 1,   kcal: 180, protein: 30, carbs: 0,  fat: 6,    prepSessionId: 2 },
    { id: 5,  weekday: 1, meal: 'dinner',    foodName: 'Sweet Potato',   servingLabel: '1 medium',  servings: 1,   kcal: 130, protein: 2.5, carbs: 30, fat: 0.1, prepSessionId: 2 },
    { id: 6,  weekday: 2, meal: 'breakfast', foodName: 'Protein Oats',   servingLabel: '1 bowl',    servings: 1,   kcal: 380, protein: 28, carbs: 52, fat: 7,    prepSessionId: null },
    { id: 7,  weekday: 2, meal: 'lunch',     foodName: 'Chicken Breast', servingLabel: '100g',      servings: 1,   kcal: 165, protein: 31, carbs: 0,  fat: 3.6,  prepSessionId: 1 },
    { id: 8,  weekday: 2, meal: 'lunch',     foodName: 'Brown Rice',     servingLabel: '1 cup',     servings: 1,   kcal: 215, protein: 5,  carbs: 45, fat: 1.8,  prepSessionId: 1 },
    { id: 9,  weekday: 2, meal: 'dinner',    foodName: 'Turkey Mince',   servingLabel: '150g',      servings: 1,   kcal: 180, protein: 30, carbs: 0,  fat: 6,    prepSessionId: 2 },
    { id: 10, weekday: 3, meal: 'breakfast', foodName: 'Protein Oats',   servingLabel: '1 bowl',    servings: 1,   kcal: 380, protein: 28, carbs: 52, fat: 7,    prepSessionId: null },
    { id: 11, weekday: 3, meal: 'lunch',     foodName: 'Chicken Breast', servingLabel: '100g',      servings: 1,   kcal: 165, protein: 31, carbs: 0,  fat: 3.6,  prepSessionId: 1 },
    { id: 12, weekday: 3, meal: 'dinner',    foodName: 'Salmon Fillet',  servingLabel: '1 fillet',  servings: 1,   kcal: 280, protein: 25, carbs: 0,  fat: 18,   prepSessionId: null },
    { id: 13, weekday: 4, meal: 'breakfast', foodName: 'Protein Oats',   servingLabel: '1 bowl',    servings: 1,   kcal: 380, protein: 28, carbs: 52, fat: 7,    prepSessionId: null },
    { id: 14, weekday: 4, meal: 'lunch',     foodName: 'Turkey Mince',   servingLabel: '150g',      servings: 1,   kcal: 180, protein: 30, carbs: 0,  fat: 6,    prepSessionId: 2 },
    { id: 15, weekday: 4, meal: 'lunch',     foodName: 'Sweet Potato',   servingLabel: '1 medium',  servings: 1,   kcal: 130, protein: 2.5, carbs: 30, fat: 0.1, prepSessionId: 2 },
    { id: 16, weekday: 4, meal: 'dinner',    foodName: 'Turkey Mince',   servingLabel: '150g',      servings: 1.5, kcal: 270, protein: 45, carbs: 0,  fat: 9,    prepSessionId: 2 },
    { id: 17, weekday: 5, meal: 'breakfast', foodName: 'Greek Yogurt',   servingLabel: '200g',      servings: 1,   kcal: 130, protein: 15, carbs: 9,  fat: 3.5,  prepSessionId: null },
    { id: 18, weekday: 5, meal: 'lunch',     foodName: 'Turkey Mince',   servingLabel: '150g',      servings: 1,   kcal: 180, protein: 30, carbs: 0,  fat: 6,    prepSessionId: 2 },
    { id: 19, weekday: 5, meal: 'dinner',    foodName: 'Salmon Fillet',  servingLabel: '1 fillet',  servings: 1,   kcal: 280, protein: 25, carbs: 0,  fat: 18,   prepSessionId: null },
    { id: 20, weekday: 6, meal: 'breakfast', foodName: 'Protein Oats',   servingLabel: '1 bowl',    servings: 1,   kcal: 380, protein: 28, carbs: 52, fat: 7,    prepSessionId: null },
    { id: 21, weekday: 6, meal: 'lunch',     foodName: 'Chicken Breast', servingLabel: '100g',      servings: 1.5, kcal: 248, protein: 47, carbs: 0,  fat: 5.4,  prepSessionId: 1 },
    { id: 22, weekday: 6, meal: 'dinner',    foodName: 'Beef Steak',     servingLabel: '200g',      servings: 1,   kcal: 420, protein: 54, carbs: 0,  fat: 22,   prepSessionId: null },
    { id: 23, weekday: 7, meal: 'breakfast', foodName: 'Protein Pancakes', servingLabel: '4 pcs',  servings: 1,   kcal: 320, protein: 30, carbs: 35, fat: 8,    prepSessionId: null },
    { id: 24, weekday: 7, meal: 'dinner',    foodName: 'Cheat Meal',     servingLabel: '1 serving', servings: 1,   kcal: 750, protein: 35, carbs: 80, fat: 28,   prepSessionId: null },
  ],
};

const TARGETS = { kcal: 2400, protein: 160, carbs: 200, fat: 65 };

// ─── Shared helpers ────────────────────────────────────────────────────────────

const DAY_NAMES: Record<number, string> = { 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat', 7:'Sun' };
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_EMOJI: Record<string, string> = { breakfast: '☀', lunch: '☀☀', dinner: '🌙', snack: '◆' };

function totals(meals: DayMeal[]) {
  return meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein }), { kcal: 0, protein: 0 });
}

function mealsForDay(plan: Plan, weekday: number) {
  return plan.dayMeals.filter((m) => m.weekday === weekday);
}

function prepSessionForDay(plan: Plan, weekday: number) {
  return plan.prepSessions.find((s) => s.cookWeekday === weekday);
}

function groupByMeal(meals: DayMeal[]): Record<string, DayMeal[]> {
  const g: Record<string, DayMeal[]> = {};
  for (const m of meals) {
    if (!g[m.meal]) g[m.meal] = [];
    g[m.meal].push(m);
  }
  return g;
}

const n = (v: number) => Math.round(v);
const bar = (val: number, max: number) => `${Math.min(100, Math.round((val / max) * 100))}%`;

// ─── Variant A: Weekly Calendar Grid ──────────────────────────────────────────
// Primary affordance: see the full week at a glance, column per day.
// Prep sessions anchored to their cook day column.

function VariantA({ plan }: { plan: Plan }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="row between">
        <div className="row">
          <h2 style={{ fontSize: '1.2rem' }}>{plan.name}</h2>
          {plan.active && <span className="badge on">active</span>}
        </div>
        <div className="row">
          <button className="btn sm ghost">+ Add plan</button>
          <button className="btn sm">Edit</button>
        </div>
      </div>

      {/* 7-column calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
          const dayMeals = mealsForDay(plan, wd);
          const prep = prepSessionForDay(plan, wd);
          const { kcal, protein } = totals(dayMeals);
          const grouped = groupByMeal(dayMeals);

          return (
            <div
              key={wd}
              style={{
                background: prep ? 'rgba(139,92,246,0.07)' : 'var(--panel)',
                border: `1px solid ${prep ? 'rgba(139,92,246,0.4)' : 'var(--line)'}`,
                borderRadius: 8,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: 180,
              }}
            >
              {/* Day header */}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 2 }}>{DAY_NAMES[wd]}</div>
                {prep && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--violet-2)', fontWeight: 600, letterSpacing: '0.05em' }}>
                    🍳 PREP
                  </div>
                )}
                {dayMeals.length === 0 && <div style={{ fontSize: '0.72rem', color: 'var(--dim)', marginTop: 4 }}>Rest day</div>}
              </div>

              {/* Meals */}
              {MEAL_ORDER.map((meal) => {
                const items = grouped[meal];
                if (!items) return null;
                return (
                  <div key={meal}>
                    <div style={{ fontSize: '0.66rem', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                      {meal}
                    </div>
                    {items.map((m) => (
                      <div key={m.id} style={{ fontSize: '0.78rem', paddingLeft: 6, borderLeft: `2px solid ${m.prepSessionId ? 'var(--violet)' : 'var(--line-strong)'}`, marginBottom: 3, color: m.prepSessionId ? 'var(--violet-3)' : 'var(--text)' }}>
                        {m.foodName}
                        <span style={{ color: 'var(--dim)', fontSize: '0.7rem' }}> ×{m.servings}</span>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Day totals */}
              {dayMeals.length > 0 && (
                <div style={{ marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--line)', fontSize: '0.72rem', color: 'var(--muted)' }}>
                  <span style={{ color: kcal >= TARGETS.kcal * 0.85 && kcal <= TARGETS.kcal * 1.05 ? 'var(--violet-2)' : 'var(--muted)' }}>
                    {n(kcal)} kcal
                  </span>
                  {' · '}
                  <span>{n(protein)}g P</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Prep sessions row */}
      <div>
        <div className="small muted" style={{ marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem' }}>Prep sessions</div>
        <div className="row wrap" style={{ alignItems: 'stretch' }}>
          {plan.prepSessions.map((s) => (
            <div key={s.id} style={{ flex: '0 0 260px', background: 'var(--panel-2)', border: '1px solid var(--violet)', borderRadius: 8, padding: '12px 14px' }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</div>
                <span className="badge" style={{ fontSize: '0.68rem' }}>{DAY_NAMES[s.cookWeekday]}</span>
              </div>
              {s.notes && <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginBottom: 8, fontStyle: 'italic' }}>{s.notes}</div>}
              {s.foods.map((f, i) => (
                <div key={i} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', paddingBottom: 3 }}>
                  <span>{f.name}</span>
                  <span className="muted">×{f.servings} {f.servingLabel}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Variant B: Day-by-Day Accordion ──────────────────────────────────────────
// Primary affordance: scroll through each day in detail.
// Every meal is visible; cook days are highlighted inline.

function VariantB({ plan }: { plan: Plan }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="row between">
        <div className="row">
          <h2 style={{ fontSize: '1.2rem' }}>{plan.name}</h2>
          {plan.active && <span className="badge on">active</span>}
        </div>
        <div className="row">
          <button className="btn sm ghost">Switch plan</button>
          <button className="btn sm">+ New plan</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
          const dayMeals = mealsForDay(plan, wd);
          const prep = prepSessionForDay(plan, wd);
          const { kcal, protein } = totals(dayMeals);
          const grouped = groupByMeal(dayMeals);
          const isRest = dayMeals.length === 0;

          return (
            <div
              key={wd}
              style={{
                background: 'var(--panel)',
                border: `1px solid ${prep ? 'var(--violet)' : 'var(--line)'}`,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {/* Day header */}
              <div
                style={{
                  background: prep ? 'rgba(139,92,246,0.15)' : 'var(--panel-2)',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700 }}>{DAY_NAMES[wd]}</span>
                  {isRest && <span className="muted small" style={{ marginLeft: 8 }}>Rest day</span>}
                  {prep && (
                    <span style={{ marginLeft: 10, fontSize: '0.75rem', color: 'var(--violet-2)', fontWeight: 600 }}>
                      🍳 Cook: {prep.name}
                    </span>
                  )}
                </div>
                {!isRest && (
                  <div style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--violet-2)', fontWeight: 600 }}>{n(kcal)}</span>
                    <span className="muted"> kcal · </span>
                    <span>{n(protein)}g P</span>
                  </div>
                )}
              </div>

              {/* Meals */}
              {!isRest && (
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {MEAL_ORDER.map((meal) => {
                    const items = grouped[meal];
                    if (!items) return null;
                    const mealKcal = items.reduce((a, m) => a + m.kcal, 0);
                    return (
                      <div key={meal}>
                        <div className="row between" style={{ marginBottom: 4 }}>
                          <div style={{ fontSize: '0.76rem', color: 'var(--muted)', textTransform: 'capitalize', fontWeight: 600 }}>
                            {MEAL_EMOJI[meal]} {meal}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--dim)' }}>{n(mealKcal)} kcal</div>
                        </div>
                        {items.map((m) => (
                          <div key={m.id} className="row between" style={{ paddingLeft: 12, paddingBottom: 3 }}>
                            <div style={{ fontSize: '0.84rem' }}>
                              {m.foodName}
                              {m.prepSessionId && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--violet-2)', marginLeft: 6 }}>
                                  from {plan.prepSessions.find((s) => s.id === m.prepSessionId)?.name}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                              {m.servings !== 1 ? `×${m.servings} ` : ''}{m.servingLabel}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* Macro bars */}
                  <div style={{ paddingTop: 8, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      { label: 'Kcal', val: kcal, max: TARGETS.kcal, color: 'var(--violet)' },
                      { label: 'Protein', val: protein, max: TARGETS.protein, color: 'var(--magenta)' },
                    ].map(({ label, val, max, color }) => (
                      <div key={label} className="row" style={{ gap: 8 }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--dim)', width: 42 }}>{label}</div>
                        <div style={{ flex: 1, height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: bar(val, max), height: '100%', background: color, borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', width: 32, textAlign: 'right' }}>
                          {n(val)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="btn sm ghost" style={{ alignSelf: 'flex-end', fontSize: '0.76rem' }}>
                    Import to log →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Variant C: Prep Board ────────────────────────────────────────────────────
// Primary affordance: understand what to batch-cook and when.
// Prep sessions are the main unit; days are a secondary summary.

function VariantC({ plan }: { plan: Plan }) {
  const standalone = plan.dayMeals.filter((m) => !m.prepSessionId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="row between">
        <div className="row">
          <h2 style={{ fontSize: '1.2rem' }}>{plan.name}</h2>
          {plan.active && <span className="badge on">active</span>}
        </div>
        <button className="btn sm">Manage plans</button>
      </div>

      {/* Prep sessions as primary cards */}
      <section>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dim)', marginBottom: 12, fontWeight: 600 }}>
          Prep Sessions — what to batch cook
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {plan.prepSessions.map((session) => {
            const consumedBy = plan.dayMeals.filter((m) => m.prepSessionId === session.id);
            const consumeDays = [...new Set(consumedBy.map((m) => m.weekday))].sort();
            const totalKcal = session.foods.reduce((a, f) => a + f.kcal * f.servings, 0);
            const totalProtein = session.foods.reduce((a, f) => a + f.protein * f.servings, 0);

            return (
              <div
                key={session.id}
                style={{ background: 'var(--panel)', border: '1px solid var(--violet)', borderRadius: 10, overflow: 'hidden' }}
              >
                {/* Session header */}
                <div style={{ background: 'rgba(139,92,246,0.15)', padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                  <div className="row between">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>{session.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--violet-2)' }}>
                        Cook on {DAY_NAMES[session.cookWeekday]} · feeds {consumeDays.map((d) => DAY_NAMES[d]).join(', ')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--violet-2)', fontSize: '1.05rem' }}>{n(totalKcal)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--dim)' }}>total kcal batch</div>
                    </div>
                  </div>
                  {session.notes && (
                    <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--muted)', fontStyle: 'italic' }}>{session.notes}</div>
                  )}
                </div>

                {/* Foods to cook */}
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Batch cook</div>
                  {session.foods.map((f, i) => (
                    <div key={i} className="row between" style={{ paddingBottom: 5 }}>
                      <span style={{ fontSize: '0.88rem' }}>{f.name}</span>
                      <span className="muted small">×{f.servings} {f.servingLabel} · {n(f.kcal * f.servings)} kcal · {n(f.protein * f.servings)}g P</span>
                    </div>
                  ))}
                </div>

                {/* Consume schedule */}
                <div style={{ padding: '12px 18px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Consumed across</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {consumeDays.map((wd) => {
                      const dayItems = consumedBy.filter((m) => m.weekday === wd);
                      const meals = [...new Set(dayItems.map((m) => m.meal))].map((m) => m[0].toUpperCase() + m.slice(1, 3)).join(', ');
                      return (
                        <div key={wd} style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem' }}>
                          <span style={{ fontWeight: 600 }}>{DAY_NAMES[wd]}</span>
                          <span className="muted"> · {meals}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Standalone meals summary */}
      <section>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dim)', marginBottom: 12, fontWeight: 600 }}>
          Standalone meals — not batch cooked
        </div>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
              const dayStandalone = standalone.filter((m) => m.weekday === wd);
              return (
                <div key={wd} style={{ padding: '10px 12px', borderRight: wd < 7 ? '1px solid var(--line)' : undefined }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 6, color: 'var(--muted)' }}>{DAY_NAMES[wd]}</div>
                  {dayStandalone.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--dim)' }}>—</div>
                  ) : (
                    dayStandalone.map((m) => (
                      <div key={m.id} style={{ fontSize: '0.76rem', marginBottom: 4 }}>
                        <div style={{ color: 'var(--muted)', fontSize: '0.66rem', textTransform: 'capitalize' }}>{m.meal}</div>
                        <div>{m.foodName}</div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Weekly macro overview */}
      <section>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dim)', marginBottom: 12, fontWeight: 600 }}>
          Weekly macro snapshot vs targets
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
            const { kcal, protein } = totals(mealsForDay(plan, wd));
            const hit = kcal >= TARGETS.kcal * 0.85 && kcal <= TARGETS.kcal * 1.05 && protein >= TARGETS.protein * 0.9;
            return (
              <div key={wd} style={{ background: 'var(--panel)', border: `1px solid ${hit ? 'rgba(139,92,246,0.5)' : 'var(--line)'}`, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 600, marginBottom: 4 }}>{DAY_NAMES[wd]}</div>
                {kcal > 0 ? (
                  <>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: hit ? 'var(--violet-2)' : 'var(--text)' }}>{n(kcal)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{n(protein)}g P</div>
                    {hit && <div style={{ fontSize: '0.62rem', color: 'var(--violet-2)', marginTop: 3 }}>✓ on target</div>}
                  </>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: 'var(--dim)' }}>rest</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const VARIANTS = [
  { key: 'A', name: 'Weekly Calendar' },
  { key: 'B', name: 'Day List' },
  { key: 'C', name: 'Prep Board' },
];

export default async function ProtoNutritionPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const variant = VARIANTS.some((v) => v.key === sp.variant) ? sp.variant! : 'A';

  return (
    <>
      <PageHead kicker="Prototype" title="Nutrition Plan" />
      {variant === 'A' && <VariantA plan={PLAN} />}
      {variant === 'B' && <VariantB plan={PLAN} />}
      {variant === 'C' && <VariantC plan={PLAN} />}
      {process.env.NODE_ENV !== 'production' && (
        <PrototypeSwitcher variants={VARIANTS} current={variant} />
      )}
    </>
  );
}
