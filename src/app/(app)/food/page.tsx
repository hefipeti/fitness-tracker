import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Bar, PageHead, Panel, fmtNum } from '@/components/ui';
import { RunButton, RunForm } from '@/components/system';
import { SearchableSelect } from '@/components/searchable-select';
import { getFoodDay, listFoods } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { addDays, formatDay, isValidDate, todayStr } from '@/lib/dates';
import { foodGoalMet } from '@/lib/game';
import { deleteFoodLogAction, logFoodAction, quickLogAction } from '@/lib/actions/food';
import { MEALS } from '@/lib/types';
import { getTranslations } from 'next-intl/server';

export const metadata = { title: 'Nutrition' };

export default async function FoodPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { id: uid } = await requireUser();
  const sp = await searchParams;
  const today = todayStr();
  const date = isValidDate(sp.date) ? sp.date : today;
  const [day, foods, settings, t] = await Promise.all([
    getFoodDay(uid, date),
    listFoods(uid),
    getSettings(uid),
    getTranslations(),
  ]);
  const totals = day.totals;
  const met = foodGoalMet(totals, {
    kcal: settings.kcalTarget,
    protein: settings.proteinTarget,
    carbs: settings.carbsTarget,
    fat: settings.fatTarget,
  });
  const remaining = settings.kcalTarget - totals.kcal;

  const macros: [string, number, number][] = [
    [t('food.protein'), totals.protein, settings.proteinTarget],
    [t('food.carbs'), totals.carbs, settings.carbsTarget],
    [t('food.fat'), totals.fat, settings.fatTarget],
  ];

  const mealLabels: Record<string, string> = {
    breakfast: t('food.breakfast'),
    lunch: t('food.lunch'),
    dinner: t('food.dinner'),
    snack: t('food.snack'),
  };

  return (
    <>
      <PageHead kicker={t('food.kicker')} title={t('food.title')}>
        <div className="row wrap">
          <div className="seg">
            <Link href={`/food?date=${addDays(date, -1)}`}>{t('food.prev')}</Link>
            <Link href="/food" className={date === today ? 'on' : ''}>
              {t('food.today')}
            </Link>
            <Link href={`/food?date=${addDays(date, 1)}`}>{t('food.next')}</Link>
          </div>
          <Link className="btn" href="/food/library">
            {t('food.library')}
          </Link>
        </div>
      </PageHead>

      <div className="grid side-main">
        <div className="col" style={{ gap: 16 }}>
          <Panel title={formatDay(date)} className={met ? 'glow' : ''} action={met && <span className="badge on">{t('food.targetsHit')}</span>}>
            <div className="row between wrap" style={{ alignItems: 'flex-end' }}>
              <div>
                <div className="kcal-big">
                  {fmtNum(totals.kcal)} <span className="small muted">/ {settings.kcalTarget} kcal</span>
                </div>
                <div className="small muted mt-s">
                  {remaining >= 0 ? t('food.kcalRemaining', { count: fmtNum(remaining) }) : t('food.kcalOver', { count: fmtNum(-remaining) })}
                </div>
              </div>
              <div className="tiny dim right" style={{ maxWidth: 240 }}>
                {t('food.goalNote')}
              </div>
            </div>
            <div className="mt-s">
              <Bar value={totals.kcal} max={settings.kcalTarget} />
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
              <Panel key={meal} title={mealLabels[meal]} action={<span className="mono">{fmtNum(sum)} kcal</span>}>
                {logs.length === 0 ? (
                  <div className="small dim">{t('food.nothingLogged')}</div>
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
                        <RunButton className="btn sm ghost icon" ariaLabel={t('food.deleteFood', { name: l.name })} action={deleteFoodLogAction.bind(null, l.id)}>
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
          <Panel title={t('food.logFood')}>
            {foods.length === 0 ? (
              <div className="empty">
                {t('food.emptyLibrary')} <Link href="/food/library">{t('food.addFoods')}</Link>
              </div>
            ) : (
              <RunForm action={logFoodAction} className="col">
                <input type="hidden" name="date" value={date} />
                <label className="field">
                  {t('food.meal')}
                  <SearchableSelect
                    name="meal"
                    defaultValue="lunch"
                    options={MEALS.map((m) => ({ value: m, label: mealLabels[m] }))}
                  />
                </label>
                <label className="field">
                  {t('food.foodLabel')}
                  <SearchableSelect
                    name="foodId"
                    required
                    options={foods.map((f) => ({ value: f.id, label: `${f.name} · ${f.servingLabel} · ${fmtNum(f.kcal)} kcal` }))}
                  />
                </label>
                <label className="field">
                  {t('food.servings')}
                  <input name="servings" type="number" step="0.05" min="0.05" max="100" defaultValue="1" required />
                </label>
                <div>
                  <button className="btn primary">{t('food.addToLog')}</button>
                </div>
              </RunForm>
            )}
          </Panel>

          <Panel title={t('food.quickAdd')}>
            <details className="fold">
              <summary>{t('food.quickAddDesc')}</summary>
              <RunForm action={quickLogAction} className="col">
                <input type="hidden" name="date" value={date} />
                <label className="field">
                  {t('food.name')}
                  <input name="name" required maxLength={120} placeholder={t('food.namePlaceholder')} />
                </label>
                <label className="field">
                  {t('food.meal')}
                  <SearchableSelect
                    name="meal"
                    defaultValue="dinner"
                    options={MEALS.map((m) => ({ value: m, label: mealLabels[m] }))}
                  />
                </label>
                <div className="form-row">
                  <label className="field">
                    {t('food.kcalLabel')}
                    <input name="kcal" type="number" min="0" step="1" required />
                  </label>
                  <label className="field">
                    {t('food.proteinG')}
                    <input name="protein" type="number" min="0" step="0.1" />
                  </label>
                </div>
                <div className="form-row">
                  <label className="field">
                    {t('food.carbsG')}
                    <input name="carbs" type="number" min="0" step="0.1" />
                  </label>
                  <label className="field">
                    {t('food.fatG')}
                    <input name="fat" type="number" min="0" step="0.1" />
                  </label>
                </div>
                <div>
                  <button className="btn">{t('food.add')}</button>
                </div>
              </RunForm>
            </details>
          </Panel>
        </div>
      </div>
    </>
  );
}
