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

export const metadata = { title: 'Progress' };

const BY_LABEL: Record<GroupBy, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
const METRIC_LABEL: Record<string, string> = {
  reps: 'Best set (reps)',
  seconds: 'Best hold (seconds)',
  weighted: 'Estimated 1RM (kg)',
  assisted: 'Lowest assist with 5+ reps (kg, lower is better)',
};

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

  const [settings, volume, weights, nutrition, xp, logged] = await Promise.all([
    getSettings(uid),
    getVolumeSeries(uid, since, by),
    getWeightSeries(uid, since, by),
    getNutritionSeries(uid, since, by),
    getXpSeries(uid, since, by),
    listLoggedExercises(uid),
  ]);

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
      <PageHead kicker="Records" title="Progress">
        <div className="row wrap">
          <div className="seg" aria-label="Range">
            {RANGES.map((r) => (
              <Link key={r.key} href={`${q(r.key, by)}${selected ? `&ex=${selected.slug}` : ''}`} className={r.key === range ? 'on' : ''}>
                {r.label}
              </Link>
            ))}
          </div>
          <div className="seg" aria-label="Group by">
            {GROUPS.map((g) => (
              <Link key={g} href={`${q(range, g)}${selected ? `&ex=${selected.slug}` : ''}`} className={g === by ? 'on' : ''}>
                {BY_LABEL[g]}
              </Link>
            ))}
          </div>
        </div>
      </PageHead>

      <div className="grid tiles4">
        <Tile label="Workouts" value={totalSessions} sub="in range" />
        <Tile label="Sets" value={fmtNum(totalSets)} sub="completed" />
        <Tile
          label="Weight change"
          value={weightDelta == null ? '–' : `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg`}
          sub={settings.goalWeight ? `goal ${settings.goalWeight} kg` : undefined}
        />
        <Tile label="XP earned" value={fmtNum(totalXp)} sub={avgKcal ? `avg ${fmtNum(avgKcal)} kcal/day` : undefined} />
      </div>

      <div className="grid c2 mt">
        <Panel title={`Training volume · sets per ${by}`}>
          <VolumeChart data={volume} by={by} />
        </Panel>

        <Panel
          title={selected ? `Progression · ${METRIC_LABEL[selected.mode]}` : 'Progression'}
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
            <div className="empty">Complete a workout to see exercise progression here.</div>
          )}
        </Panel>

        <Panel title="Body weight (kg)">
          <TrendChart
            data={weights.map((w) => ({ period: w.period, kg: w.kg }))}
            by={by}
            lines={[{ key: 'kg', name: 'Weight', color: '#c4b5fd' }]}
            refLine={settings.goalWeight ? { value: settings.goalWeight, label: `goal ${settings.goalWeight}` } : undefined}
            unit=""
          />
        </Panel>

        <Panel title="Nutrition · daily average">
          <TrendChart
            data={nutrition.map((n) => ({ period: n.period, kcal: n.kcal }))}
            by={by}
            lines={[{ key: 'kcal', name: 'kcal', color: '#8b5cf6' }]}
            refLine={{ value: settings.kcalTarget, label: `target ${settings.kcalTarget}` }}
          />
        </Panel>

        <Panel title="Protein · daily average (g)">
          <TrendChart
            data={nutrition.map((n) => ({ period: n.period, protein: n.protein }))}
            by={by}
            lines={[{ key: 'protein', name: 'protein', color: '#e879f9' }]}
            refLine={{ value: settings.proteinTarget, label: `target ${settings.proteinTarget}` }}
          />
        </Panel>

        <Panel title={`XP per ${by}`}>
          <XpChart data={xp} by={by} />
        </Panel>
      </div>
    </>
  );
}
