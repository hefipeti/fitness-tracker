import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { PageHead, Panel } from '@/components/ui';
import { getPlan } from '@/lib/queries';
import { q1 } from '@/lib/db';
import { startSessionAction } from '@/lib/actions/training';
import { getTranslations } from 'next-intl/server';

async function getPlanDayWithOwnership(uid: number, planDayId: number) {
  const row = await q1<{ planId: number }>(
    `SELECT d.plan_id AS "planId" FROM plan_days d
     JOIN plans p ON p.id = d.plan_id AND p.user_id = $1
     WHERE d.id = $2`,
    [uid, planDayId],
  );
  if (!row) return null;
  const plan = await getPlan(uid, row.planId);
  if (!plan) return null;
  const day = plan.days.find((d) => d.id === planDayId);
  return day ? { plan, day } : null;
}

export default async function PreviewPage({ params }: { params: Promise<{ planDayId: string }> }) {
  const { id: uid } = await requireUser();
  const { planDayId: planDayIdStr } = await params;
  const planDayId = parseInt(planDayIdStr, 10);
  if (isNaN(planDayId)) notFound();

  const [result, t] = await Promise.all([
    getPlanDayWithOwnership(uid, planDayId),
    getTranslations(),
  ]);

  if (!result) notFound();
  const { plan, day } = result;

  return (
    <>
      <PageHead kicker={t('preview.kicker')} title={day.name}>
        <Link className="btn" href="/training">
          {t('preview.back')}
        </Link>
      </PageHead>

      <Panel title={plan.name}>
        {day.exercises.length === 0 ? (
          <div className="empty">{t('preview.noExercises')}</div>
        ) : (
          <div className="list">
            {day.exercises.map((ex) => (
              <div className="item" key={ex.id} style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
                <div className="t">{ex.name}</div>
                <div className="s">
                  {ex.mode === 'seconds'
                    ? `${ex.targetSets}×${ex.targetReps}s`
                    : ex.mode === 'weighted'
                      ? `${ex.targetSets}×${ex.targetReps} @ ${ex.targetWeight ?? '?'} kg`
                      : ex.mode === 'assisted'
                        ? `${ex.targetSets}×${ex.targetReps} (assist: ${ex.targetWeight ?? '?'} kg)`
                        : `${ex.targetSets}×${ex.targetReps}`}
                </div>
                {ex.note && (
                  <div className="tiny dim">{t('preview.note')}: {ex.note}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="mt" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <form action={startSessionAction}>
          <input type="hidden" name="planDayId" value={planDayId} />
          <button className="btn primary">{t('preview.startSession')}</button>
        </form>
      </div>
    </>
  );
}
