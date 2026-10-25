import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { PageHead, Panel, fmtNum } from '@/components/ui';
import { listFoods } from '@/lib/queries';
import { archiveFoodAction, createFoodAction, updateFoodAction } from '@/lib/actions/food';

export const metadata = { title: 'Food library' };

function FoodFields({ f }: { f?: { name: string; servingLabel: string; kcal: number; protein: number; carbs: number; fat: number } }) {
  return (
    <>
      <label className="field" style={{ flex: '2 1 180px' }}>
        Name
        <input name="name" required maxLength={120} defaultValue={f?.name} placeholder="e.g. Cottage cheese" />
      </label>
      <label className="field">
        Serving
        <input name="servingLabel" maxLength={40} defaultValue={f?.servingLabel ?? '100 g'} placeholder="100 g" />
      </label>
      <label className="field">
        kcal
        <input name="kcal" type="number" min="0" step="0.1" required defaultValue={f?.kcal} />
      </label>
      <label className="field">
        Protein g
        <input name="protein" type="number" min="0" step="0.1" required defaultValue={f?.protein} />
      </label>
      <label className="field">
        Carbs g
        <input name="carbs" type="number" min="0" step="0.1" required defaultValue={f?.carbs} />
      </label>
      <label className="field">
        Fat g
        <input name="fat" type="number" min="0" step="0.1" required defaultValue={f?.fat} />
      </label>
    </>
  );
}

export default async function FoodLibraryPage() {
  const { id: uid } = await requireUser();
  const foods = await listFoods(uid, true);
  const active = foods.filter((f) => !f.archived);
  const archived = foods.filter((f) => f.archived);

  return (
    <>
      <PageHead kicker="Supplies" title="Food library">
        <Link className="btn ghost" href="/food">
          Back to log
        </Link>
      </PageHead>

      <Panel title="New food">
        <form action={createFoodAction} className="form-row">
          <FoodFields />
          <button className="btn primary">Add</button>
        </form>
        <p className="tiny dim mt-s">
          Values are per serving. The starter foods are approximate; edit them to match your labels. Changing a food never alters meals you already
          logged.
        </p>
      </Panel>

      <Panel title={`Foods (${active.length})`} className="mt">
        <div className="list">
          {active.map((f) => (
            <div className="item" key={f.id} style={{ alignItems: 'flex-start' }}>
              <details className="fold grow">
                <summary style={{ display: 'inline' }}>
                  <span className="t">{f.name}</span>
                  <span className="s mono muted">
                    {' '}
                    · {f.servingLabel} · {fmtNum(f.kcal)} kcal · P {fmtNum(f.protein, 1)} · C {fmtNum(f.carbs, 1)} · F {fmtNum(f.fat, 1)}
                  </span>
                </summary>
                <form action={updateFoodAction} className="form-row">
                  <input type="hidden" name="id" value={f.id} />
                  <FoodFields f={f} />
                  <button className="btn">Save</button>
                </form>
              </details>
              <form action={archiveFoodAction}>
                <input type="hidden" name="id" value={f.id} />
                <button className="btn sm ghost">Archive</button>
              </form>
            </div>
          ))}
        </div>
      </Panel>

      {archived.length > 0 && (
        <Panel title={`Archived (${archived.length})`} className="mt">
          <div className="list">
            {archived.map((f) => (
              <div className="item" key={f.id}>
                <div className="grow muted">{f.name}</div>
                <form action={archiveFoodAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button className="btn sm ghost">Restore</button>
                </form>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
