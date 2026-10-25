import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Bar, PageHead, Panel, fmtNum } from '@/components/ui';
import { RunButton, RunForm } from '@/components/system';
import { getFoodDay, listFoods } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { addDays, formatDay, isValidDate, todayStr } from '@/lib/dates';
import { foodGoalMet } from '@/lib/game';
import { deleteFoodLogAction, logFoodAction, quickLogAction } from '@/lib/actions/food';
import { MEALS } from '@/lib/types';

export const metadata = { title: 'Nutrition' };

export default async function FoodPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { id: uid } = await requireUser();
  const sp = await searchParams;
  const today = todayStr();
  const date = isValidDate(sp.date) ? sp.date : today;
  const [day, foods, settings] = await Promise.all([getFoodDay(uid, date), listFoods(uid), getSettings(uid)]);
  const t = day.totals;
  const met = foodGoalMet(t, {
    kcal: settings.kcalTarget,
    protein: settings.proteinTarget,
    carbs: settings.carbsTarget,
    fat: settings.fatTarget,
  });
  const remaining = settings.kcalTarget - t.kcal;

  const macros: [string, number, number][] = [
    ['Protein', t.protein, settings.proteinTarget],
    ['Carbs', t.carbs, settings.carbsTarget],
    ['Fat', t.fat, settings.fatTarget],
  ];

  return (
    <>
      <PageHead kicker="Supplies" title="Nutrition">
        <div className="row wrap">
          <div className="seg">
            <Link href={`/food?date=${addDays(date, -1)}`}>← Prev</Link>
            <Link href="/food" className={date === today ? 'on' : ''}>
              Today
            </Link>
            <Link href={`/food?date=${addDays(date, 1)}`}>Next →</Link>
          </div>
          <Link className="btn" href="/food/library">
            Food library
          </Link>
        </div>
      </PageHead>

      <div className="grid side-main">
        <div className="col" style={{ gap: 16 }}>
          <Panel title={formatDay(date)} className={met ? 'glow' : ''} action={met && <span className="badge on">targets hit</span>}>
            <div className="row between wrap" style={{ alignItems: 'flex-end' }}>
              <div>
                <div className="kcal-big">
                  {fmtNum(t.kcal)} <span className="small muted">/ {settings.kcalTarget} kcal</span>
                </div>
                <div className="small muted mt-s">
                  {remaining >= 0 ? `${fmtNum(remaining)} kcal remaining` : `${fmtNum(-remaining)} kcal over target`}
                </div>
              </div>
              <div className="tiny dim right" style={{ maxWidth: 240 }}>
                +30 XP when calories are within 85–105% of target and protein is at least 90%.
              </div>
            </div>
            <div className="mt-s">
              <Bar value={t.kcal} max={settings.kcalTarget} />
            </div>
            <div className="mt">
              {macros.map(([label, v, target]) => (
                <div className="macro" key={label}>
                  <span className="nm">{label}</span>
                  <Bar value={v} max={target} className="thin" />
                  <span className="val">
                    {fmtNum(v)} / {target} g
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {MEALS.map((meal) => {
            const logs = day.logs.filter((l) => l.meal === meal);
            const sum = logs.reduce((n, l) => n + l.kcal, 0);
            return (
              <Panel key={meal} title={meal} action={<span className="mono">{fmtNum(sum)} kcal</span>}>
                {logs.length === 0 ? (
                  <div className="small dim">Nothing logged.</div>
                ) : (
                  <div className="list">
                    {logs.map((l) => (
                      <div className="item" key={l.id}>
                        <div className="grow">
                          <div className="t">
                            {l.name}
                            {l.servings !== 1 && <span className="muted"> × {l.servings}</span>}
                          </div>
                          <div className="s mono">
                            {fmtNum(l.kcal)} kcal · P {fmtNum(l.protein, 1)} · C {fmtNum(l.carbs, 1)} · F {fmtNum(l.fat, 1)}
                          </div>
                        </div>
                        <RunButton className="btn sm ghost icon" ariaLabel={`Delete ${l.name}`} action={deleteFoodLogAction.bind(null, l.id)}>
                          ✕
                        </RunButton>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>

        <div className="col" style={{ gap: 16 }}>
          <Panel title="Log food">
            {foods.length === 0 ? (
              <div className="empty">
                Your library is empty. <Link href="/food/library">Add foods</Link> first.
              </div>
            ) : (
              <RunForm action={logFoodAction} className="col">
                <input type="hidden" name="date" value={date} />
                <label className="field">
                  Meal
                  <select name="meal" defaultValue="lunch">
                    {MEALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Food
                  <select name="foodId" required defaultValue="">
                    <option value="" disabled>
                      Select…
                    </option>
                    {foods.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} · {f.servingLabel} · {fmtNum(f.kcal)} kcal
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Servings
                  <input name="servings" type="number" step="0.05" min="0.05" max="100" defaultValue="1" required />
                </label>
                <div>
                  <button className="btn primary">Add to log</button>
                </div>
              </RunForm>
            )}
          </Panel>

          <Panel title="Quick add (one-off)">
            <details className="fold">
              <summary>Enter calories and macros directly</summary>
              <RunForm action={quickLogAction} className="col">
                <input type="hidden" name="date" value={date} />
                <label className="field">
                  Name
                  <input name="name" required maxLength={120} placeholder="e.g. Restaurant burger" />
                </label>
                <label className="field">
                  Meal
                  <select name="meal" defaultValue="dinner">
                    {MEALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-row">
                  <label className="field">
                    kcal
                    <input name="kcal" type="number" min="0" step="1" required />
                  </label>
                  <label className="field">
                    Protein g
                    <input name="protein" type="number" min="0" step="0.1" />
                  </label>
                </div>
                <div className="form-row">
                  <label className="field">
                    Carbs g
                    <input name="carbs" type="number" min="0" step="0.1" />
                  </label>
                  <label className="field">
                    Fat g
                    <input name="fat" type="number" min="0" step="0.1" />
                  </label>
                </div>
                <div>
                  <button className="btn">Add</button>
                </div>
              </RunForm>
            </details>
          </Panel>
        </div>
      </div>
    </>
  );
}
