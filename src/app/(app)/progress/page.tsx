import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { PageHead, Panel, Tile, fmtNum } from '@/components/ui';
import { ExercisePicker, TrendChart, VolumeChart, XpChart } from '@/components/charts';
import {
  GROUPS,
  RANGES,
  getExerciseProgress,
  getNutritionSeries,
  getVolumeSeries,
  getWeightSeries,
  getXpSeries,
  listLoggedExercises,
  sinceFor,
  type GroupBy,
} from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { getTranslations } from 'next-intl/server';

export const metadata = { title: 'Progress' };

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; by?: string; ex?: string }>;
}) {
  const { id: uid } = await requireUser();
  const sp = await searchParams;
  const range = RANGES.some((r) => r.key === sp.range) ? (sp.range as string) : '90';
  const by: GroupBy = (GROUPS as string[]).includes(sp.by ?? '') ? (sp.by as GroupBy) : 'week';
  const since = sinceFor(range);

  const [settings, volume, weights, nutrition, xp, logged, t] = await Promise.all([
    getSettings(uid),
    getVolumeSeries(uid, since, by),
    getWeightSeries(uid, since, by),
    getNutritionSeries(uid, since, by),
    getXpSeries(uid, since, by),
    listLoggedExercises(uid),
    getTranslations(),
  ]);

  const BY_LABEL: Record<GroupBy, string> = {
    day: t('progress.groupDay'),
    week: t('progress.groupWeek'),
    month: t('progress.groupMonth'),
  };

  const METRIC_LABEL: Record<string, string> = {
    reps: t('progress.metricBestReps'),
    seconds: t('progress.metricBestHold'),
    weighted: t('progress.metric1rm'),
    assisted: t('progress.metricAssisted'),
  };

  const RANGE_LABEL: Record<string, string> = {
    '30': t('progress.range30'),
    '90': t('progress.range90'),
    '180': t('progress.range180'),
    '365': t('progress.range365'),
    all: t('progress.rangeAll'),
  };

  const selected = logged.find((e) => e.slug === sp.ex) ?? logged[0] ?? null;
  const progress = selected ? await getExerciseProgress(uid, selected.id, selected.mode, since, by) : [];

  const totalSessions = volume.reduce((n, v) => n + v.sessions, 0);
  const totalSets = volume.reduce((n, v) => n + v.push + v.pull + v.legs + v.core + v.skill + v.cardio + v.mobility, 0);
  const weightDelta = weights.length >= 2 ? weights[weights.length - 1].kg - weights[0].kg : null;
  const avgKcal = nutrition.length ? Math.round(nutrition.reduce((n, r) => n + r.kcal, 0) / nutrition.length) : null;
  const totalXp = xp.reduce((n, r) => n + r.xp, 0);

  const q = (r: string, b: string) => `/progress?range=${r}&by=${b}`;
  const base = q(range, by);

  return (
    <>
      <PageHead kicker={t('progress.kicker')} title={t('progress.title')}>
        <div className="row wrap">
          <div className="seg" aria-label={t('progress.range')}>
            {RANGES.map((r) => (
              <Link key={r.key} href={`${q(r.key, by)}${selected ? `&ex=${selected.slug}` : ''}`} className={r.key === range ? 'on' : ''}>
                {RANGE_LABEL[r.key] ?? r.label}
              </Link>
            ))}
          </div>
          <div className="seg" aria-label={t('progress.groupBy')}>
            {GROUPS.map((g) => (
              <Link key={g} href={`${q(range, g)}${selected ? `&ex=${selected.slug}` : ''}`} className={g === by ? 'on' : ''}>
                {BY_LABEL[g]}
              </Link>
            ))}
          </div>
        </div>
      </PageHead>

      <div className="grid tiles4">
        <Tile label={t('progress.workouts')} value={totalSessions} sub={t('progress.workoutsIn')} />
        <Tile label={t('progress.sets')} value={fmtNum(totalSets)} sub={t('progress.setsCompleted')} />
        <Tile
          label={t('progress.weightChange')}
          value={weightDelta == null ? t('progress.noData') : `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg`}
          sub={settings.goalWeight ? t('progress.weightGoal', { weight: settings.goalWeight }) : undefined}
        />
        <Tile label={t('progress.xpEarned')} value={fmtNum(totalXp)} sub={avgKcal ? t('progress.avgKcal', { kcal: fmtNum(avgKcal) }) : undefined} />
      </div>

      <div className="grid c2 mt">
        <Panel title={t('progress.volumeTitle', { by: BY_LABEL[by] })}>
          <VolumeChart data={volume} by={by} />
        </Panel>

        <Panel
          title={selected ? t('progress.progressionTitle', { metric: METRIC_LABEL[selected.mode] }) : t('progress.progressionEmpty')}
          action={
            selected && (
              <ExercisePicker base={base} value={selected.slug} options={logged.map((e) => ({ slug: e.slug, name: e.name }))} />
            )
          }
        >
          {selected ? (
            <TrendChart
              data={progress.map((p) => ({ period: p.period, value: p.value }))}
              by={by}
              lines={[{ key: 'value', name: selected.name, color: '#a78bfa' }]}
              unit={selected.mode === 'seconds' ? 's' : ''}
              domainPad={false}
            />
          ) : (
            <div className="empty">{t('progress.noProgression')}</div>
          )}
        </Panel>

        <Panel title={t('progress.bodyWeight')}>
          <TrendChart
            data={weights.map((w) => ({ period: w.period, kg: w.kg }))}
            by={by}
            lines={[{ key: 'kg', name: t('progress.weightLabel'), color: '#c4b5fd' }]}
            refLine={settings.goalWeight ? { value: settings.goalWeight, label: t('progress.goalLabel', { val: settings.goalWeight }) } : undefined}
            unit=""
          />
        </Panel>

        <Panel title={t('progress.nutritionAvg')}>
          <TrendChart
            data={nutrition.map((n) => ({ period: n.period, kcal: n.kcal }))}
            by={by}
            lines={[{ key: 'kcal', name: t('progress.kcalLabel'), color: '#8b5cf6' }]}
            refLine={{ value: settings.kcalTarget, label: t('progress.targetLabel', { val: settings.kcalTarget }) }}
          />
        </Panel>

        <Panel title={t('progress.proteinAvg')}>
          <TrendChart
            data={nutrition.map((n) => ({ period: n.period, protein: n.protein }))}
            by={by}
            lines={[{ key: 'protein', name: t('progress.proteinLabel'), color: '#e879f9' }]}
            refLine={{ value: settings.proteinTarget, label: t('progress.targetLabel', { val: settings.proteinTarget }) }}
          />
        </Panel>

        <Panel title={t('progress.xpPer', { by: BY_LABEL[by] })}>
          <XpChart data={xp} by={by} />
        </Panel>
      </div>
    </>
  );
}
