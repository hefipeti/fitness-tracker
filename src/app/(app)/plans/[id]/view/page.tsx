import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { PageHead, Panel } from '@/components/ui';
import { PlanGuide } from '@/components/plan-guide';
import { PlanDays } from '@/components/plan-days';
import { SharePanel } from '@/components/share-panel';
import {
  getPlan,
  getLastAttemptsForPlan,
  getExerciseTrendsForPlan,
  getUnlockedAchievements,
  listSharesForPlan,
} from '@/lib/queries';
import { addDays, todayStr } from '@/lib/dates';

export const metadata = { title: 'View plan' };

export default async function PlanViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: uid } = await requireUser();
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const since = addDays(todayStr(), -28);
  const [plan, lastAttempts, trends, achievements, shares] = await Promise.all([
    getPlan(uid, id),
    getLastAttemptsForPlan(uid, id),
    getExerciseTrendsForPlan(uid, id, since),
    getUnlockedAchievements(uid),
    listSharesForPlan(uid, id),
  ]);
  if (!plan) notFound();

  return (
    <>
      <PageHead kicker="Skill tree" title={plan.name}>
        <div className="row wrap">
          {plan.active && <span className="badge on">active</span>}
          <Link className="btn sm ghost" href={`/plans/${id}`}>
            Edit plan
          </Link>
          <Link className="btn sm ghost" href="/plans">
            All plans
          </Link>
        </div>
      </PageHead>

      {plan.notes && (
        <p className="muted small" style={{ maxWidth: 720, marginBottom: 12 }}>
          {plan.notes}
        </p>
      )}

      {plan.guide && plan.guide.length > 0 && (
        <Panel title="Plan guide" className="mt">
          <PlanGuide sections={plan.guide} />
        </Panel>
      )}

      <PlanDays plan={plan} performance={lastAttempts} trends={trends} />

      {achievements.length > 0 && (
        <Panel title="Achievements" className="mt">
          <div className="grid c2" style={{ gap: 8 }}>
            {achievements.map((a) => (
              <div key={a.key} className="panel" style={{ padding: '8px 12px' }}>
                <div className="row" style={{ gap: 8 }}>
                  <div className="badge on" style={{ flexShrink: 0 }}>+{a.xp} XP</div>
                  <div>
                    <div className="small" style={{ fontWeight: 600 }}>{a.name}</div>
                    <div className="tiny dim">{a.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Share this plan" className="mt">
        <SharePanel planId={id} shares={shares} />
      </Panel>
    </>
  );
}
