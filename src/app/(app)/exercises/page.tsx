import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { CategoryBadge, PageHead, Panel } from '@/components/ui';
import { SearchableSelect } from '@/components/searchable-select';
import { listExercises } from '@/lib/queries';
import { CATEGORIES, MODES } from '@/lib/types';
import { archiveExerciseAction, createExerciseAction, updateExerciseAction } from '@/lib/actions/plans';
import { getTranslations } from 'next-intl/server';

export const metadata = { title: 'Exercise library' };

export default async function ExercisesPage() {
  const { id: uid } = await requireUser();
  const [all, t] = await Promise.all([listExercises(uid, true), getTranslations()]);
  const mine = all.filter((e) => e.custom && !e.archived);
  const archived = all.filter((e) => e.custom && e.archived);
  const builtIn = all.filter((e) => !e.custom);

  const modeLabel: Record<string, string> = {
    reps: t('exercises.modeReps'),
    seconds: t('exercises.modeSeconds'),
    weighted: t('exercises.modeWeighted'),
    assisted: t('exercises.modeAssisted'),
  };

  return (
    <>
      <PageHead kicker={t('exercises.kicker')} title={t('exercises.title')}>
        <Link className="btn ghost" href="/plans">
          {t('exercises.backToPlans')}
        </Link>
      </PageHead>

      <Panel title={t('exercises.newExercise')}>
        <form action={createExerciseAction} className="form-row">
          <label className="field" style={{ flex: '2 1 220px' }}>
            {t('exercises.name')}
            <input name="name" required maxLength={80} placeholder={t('exercises.namePlaceholder')} />
          </label>
          <label className="field">
            {t('exercises.category')}
            <SearchableSelect
              name="category"
              defaultValue="push"
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </label>
          <label className="field">
            {t('exercises.trackedAs')}
            <SearchableSelect
              name="mode"
              defaultValue="reps"
              options={MODES.map((m) => ({ value: m, label: modeLabel[m] }))}
            />
          </label>
          <button className="btn primary">{t('exercises.add')}</button>
        </form>
        <p className="tiny dim mt-s">{t('exercises.modeNote')}</p>
      </Panel>

      {mine.length > 0 && (
        <Panel title={t('exercises.yourExercises', { count: mine.length })} className="mt">
          <div className="list">
            {mine.map((e) => (
              <div className="item pe-row" key={e.id}>
                <form action={updateExerciseAction} className="pe-form grow">
                  <input type="hidden" name="id" value={e.id} />
                  <label className="field pe-note">
                    {t('exercises.name')}
                    <input name="name" defaultValue={e.name} required maxLength={80} />
                  </label>
                  <label className="field" style={{ flex: '3 1 240px' }}>
                    {t('exercises.description')}
                    <input name="description" defaultValue={e.description} maxLength={300} placeholder={t('exercises.descriptionPlaceholder')} />
                  </label>
                  <label className="field pe-num" style={{ width: 110 }}>
                    {t('exercises.category')}
                    <SearchableSelect
                      name="category"
                      defaultValue={e.category}
                      options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                    />
                  </label>
                  <span className="tiny muted" style={{ width: 150 }}>
                    {modeLabel[e.mode]}
                  </span>
                  <button className="btn sm">{t('exercises.save')}</button>
                </form>
                <form action={archiveExerciseAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="btn sm ghost">{t('exercises.archive')}</button>
                </form>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title={t('exercises.builtIn', { count: builtIn.length })} className="mt">
        <div className="list">
          {builtIn.map((e) => (
            <div className="item" key={e.id} style={{ padding: '7px 0' }}>
              <div className="grow">{e.name}</div>
              <span className="tiny muted">{modeLabel[e.mode]}</span>
              <CategoryBadge category={e.category} />
            </div>
          ))}
        </div>
        <p className="tiny dim mt-s">{t('exercises.builtInNote')}</p>
      </Panel>

      {archived.length > 0 && (
        <Panel title={t('exercises.archived', { count: archived.length })} className="mt">
          <div className="list">
            {archived.map((e) => (
              <div className="item" key={e.id}>
                <div className="grow muted">
                  {e.name} <span className="tiny dim">· {e.category}</span>
                </div>
                <form action={archiveExerciseAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="btn sm ghost">{t('exercises.restore')}</button>
                </form>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
