import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHead, Panel } from '@/components/ui';
import { PlanGuide } from '@/components/plan-guide';
import { PlanDays } from '@/components/plan-days';
import { CommentForm } from '@/components/comment-form';
import {
  getPlanForViewer,
  getLastAttemptsForPlan,
  getExerciseTrendsForPlan,
  listCommentsForShare,
} from '@/lib/queries';
import { addDays, todayStr } from '@/lib/dates';
import { getCurrentUser } from '@/lib/auth';

export const metadata = { title: 'Shared plan' };

export default async function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getPlanForViewer(token);
  if (!result) notFound();
  const { shareId, planOwnerId, plan, includePersonalData, shareType } = result;

  const currentUser = await getCurrentUser();

  if (shareType === 'review' && !currentUser) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1 style={{ fontSize: '1.1rem', marginBottom: 8 }}>Sign in to review this plan</h1>
          <p className="small dim" style={{ marginBottom: 16 }}>
            This is a review link. Sign in to view the plan and leave comments.
          </p>
          <Link className="btn primary" href={`/login?next=/shared/${token}`}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const since = addDays(todayStr(), -28);
  const [lastAttempts, trends, comments] = await Promise.all([
    includePersonalData ? getLastAttemptsForPlan(planOwnerId, plan.id) : Promise.resolve([]),
    includePersonalData ? getExerciseTrendsForPlan(planOwnerId, plan.id, since) : Promise.resolve([]),
    listCommentsForShare(shareId),
  ]);

  const canComment = shareType === 'review' && !!currentUser;

  return (
    <>
      <PageHead kicker="Shared plan" title={plan.name}>
        {plan.active && <span className="badge on">active</span>}
      </PageHead>

      {shareType === 'review' && currentUser && (
        <div className="panel" style={{ marginBottom: 12, background: 'var(--surface-2,#1a1a1a)', padding: '8px 16px' }}>
          <p className="small">
            You are reviewing as <strong>{currentUser.username}</strong>. Add comments on individual exercises below.
          </p>
        </div>
      )}

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

      <PlanDays
        plan={plan}
        performance={includePersonalData ? lastAttempts : undefined}
        trends={includePersonalData ? trends : undefined}
        comments={comments}
        commentForm={canComment ? (peId) => <CommentForm token={token} planExerciseId={peId} /> : undefined}
      />

      <div className="mt" style={{ textAlign: 'center' }}>
        {currentUser ? (
          <p className="tiny dim">Signed in as {currentUser.username}</p>
        ) : (
          <div className="panel" style={{ display: 'inline-block', padding: '12px 24px' }}>
            <p className="small" style={{ marginBottom: 8 }}>Want to track your own training?</p>
            <Link className="btn primary sm" href="/login">Sign in</Link>
          </div>
        )}
      </div>
    </>
  );
}
