import { CategoryBadge, Panel } from '@/components/ui';
import { SparkChart } from '@/components/charts';
import { WEEKDAYS } from '@/lib/dates';
import type { PlanFull } from '@/lib/queries';
import type { ExerciseLastAttempt, ExerciseTrendPoint, ShareComment } from '@/lib/queries';
import type { Mode } from '@/lib/types';
import type { ReactNode } from 'react';

function formatLastAttempt(mode: Mode, a: ExerciseLastAttempt): string {
  const sets = a.lastSets;
  if (mode === 'weighted' || mode === 'assisted') {
    const kg = a.lastWeightKg != null ? ` @ ${a.lastWeightKg}kg` : '';
    return `${sets}×${a.lastReps ?? '?'}${kg}`;
  }
  if (mode === 'seconds') return `${sets}×${a.lastSeconds ?? '?'}s`;
  return `${sets}×${a.lastReps ?? '?'}`;
}

function estimateDurationMin(exercises: { targetSets: number }[]): number {
  return exercises.reduce((n, e) => n + e.targetSets * 3, 0);
}

export function PlanDays({
  plan,
  performance,
  trends,
  comments,
  commentForm,
}: {
  plan: PlanFull;
  performance?: ExerciseLastAttempt[];
  trends?: ExerciseTrendPoint[];
  comments?: ShareComment[];
  commentForm?: (planExerciseId: number) => ReactNode;
}) {
  const perfMap = new Map(performance?.map((p) => [p.exerciseId, p]) ?? []);
  const trendMap = new Map<number, { period: string; value: number }[]>();
  for (const t of trends ?? []) {
    const list = trendMap.get(t.exerciseId) ?? [];
    list.push({ period: t.period, value: t.value });
    trendMap.set(t.exerciseId, list);
  }
  const commentsByPE = new Map<number, ShareComment[]>();
  for (const c of comments ?? []) {
    const list = commentsByPE.get(c.planExerciseId) ?? [];
    list.push(c);
    commentsByPE.set(c.planExerciseId, list);
  }

  return (
    <div className="col mt" style={{ gap: 16 }}>
      {plan.days.map((day) => {
        const duration = estimateDurationMin(day.exercises);
        return (
          <Panel
            key={day.id}
            title={day.weekday ? `${WEEKDAYS[day.weekday - 1]} · ${day.name}` : day.name}
            action={
              day.exercises.length > 0 ? (
                <span className="small dim">~{duration} min</span>
              ) : undefined
            }
          >
            <div className="list">
              {day.exercises.length === 0 && <div className="empty">No exercises.</div>}
              {day.exercises.map((e) => {
                const last = perfMap.get(e.exerciseId);
                const spark = trendMap.get(e.exerciseId) ?? [];
                const exComments = commentsByPE.get(e.id) ?? [];
                return (
                  <div className="item" key={e.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                    <div className="pe-row">
                      <div className="pe-name">
                        <div className="t">{e.name}</div>
                        <CategoryBadge category={e.category} />
                      </div>
                      <div className="pe-form" style={{ gap: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="small">
                          <strong>{e.targetSets}</strong> sets ×{' '}
                          <strong>{e.targetReps}</strong>{' '}
                          {e.mode === 'seconds' ? 'sec' : 'reps'}
                          {e.targetWeight != null && (
                            <> @ <strong>{e.targetWeight} kg</strong></>
                          )}
                        </span>
                        {e.note && <span className="small dim">{e.note}</span>}
                      </div>
                    </div>
                    {(last || spark.length >= 2) && (
                      <div className="row" style={{ gap: 16, paddingLeft: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {last ? (
                          <span className="small dim">
                            Last: <strong>{formatLastAttempt(e.mode, last)}</strong>{' '}
                            <span style={{ opacity: 0.6 }}>({last.lastDate})</span>
                          </span>
                        ) : (
                          <span className="small dim">No history yet</span>
                        )}
                        {spark.length >= 2 && (
                          <div style={{ flex: '1 1 120px', minWidth: 80, maxWidth: 200 }}>
                            <SparkChart data={spark} />
                          </div>
                        )}
                      </div>
                    )}
                    {!last && !spark.length && performance !== undefined && (
                      <span className="small dim" style={{ paddingLeft: 4 }}>No history yet</span>
                    )}
                    {exComments.length > 0 && (
                      <div className="col" style={{ gap: 4, paddingLeft: 4 }}>
                        {exComments.map((c) => (
                          <div key={c.id} className="small" style={{ background: 'var(--surface-2,#1a1a1a)', borderRadius: 4, padding: '6px 8px' }}>
                            <strong>{c.commenterName ?? 'Coach'}</strong>: {c.body}
                          </div>
                        ))}
                      </div>
                    )}
                    {commentForm && commentForm(e.id)}
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
