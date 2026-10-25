'use server';

import { requireUser, requireUserId } from '../auth';
import { fdInt, fdStr, guard, touch, UserError } from '../action-utils';
import { assertPlan, assertPlanExerciseBelongsToPlan } from '../ownership';
import { createShare, revokeShare, addComment } from '../share-tokens';
import { lookupShare } from '../queries';

export type CreateShareResult = { token: string } | { error: string } | null;
export type CommentState = { error?: string; done?: boolean };

export async function createShareAction(_prev: CreateShareResult, fd: FormData): Promise<CreateShareResult> {
  return guard(async () => {
    const uid = await requireUserId();
    const planId = fdInt(fd, 'planId');
    if (!planId) return { error: 'Missing planId' };
    await assertPlan(uid, planId);
    const includePersonal = fd.get('includePersonal') === 'true';
    const shareType = fd.get('shareType') === 'review' ? 'review' : 'view';
    const { token } = await createShare(uid, planId, includePersonal, shareType);
    touch();
    return { token };
  });
}

export async function revokeShareAction(fd: FormData): Promise<void> {
  const uid = await requireUserId();
  const shareId = fdInt(fd, 'shareId');
  if (!shareId) return;
  await revokeShare(uid, shareId);
  touch();
}

export async function addCommentAction(_prev: CommentState, fd: FormData): Promise<CommentState> {
  return guard(async () => {
    const user = await requireUser();
    if (!user.isCoach) throw new UserError('Only coaches can leave comments');
    const token = fdStr(fd, 'token');
    const planExerciseId = fdInt(fd, 'planExerciseId');
    const body = fdStr(fd, 'body').slice(0, 1000);
    if (!token || !planExerciseId || !body) return { error: 'Missing required fields' };
    const share = await lookupShare(token);
    if (!share || share.shareType !== 'review') return { error: 'Review link not valid' };
    await assertPlanExerciseBelongsToPlan(planExerciseId, share.planId);
    await addComment(share.shareId, planExerciseId, user.id, body);
    touch();
    return { done: true };
  });
}
