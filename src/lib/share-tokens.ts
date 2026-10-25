import { createHash, randomBytes } from 'crypto';
import { q, q1 } from './db';

export function createTokenValue(): string {
  return randomBytes(24).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createShare(
  userId: number,
  planId: number,
  includePersonalData: boolean,
  shareType: 'view' | 'review' = 'view',
): Promise<{ token: string; shareId: number }> {
  const token = createTokenValue();
  const row = await q1<{ id: number }>(
    `INSERT INTO plan_shares (user_id, plan_id, token_hash, include_personal, share_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [userId, planId, hashToken(token), includePersonalData, shareType],
  );
  return { token, shareId: row!.id };
}

export async function revokeShare(userId: number, shareId: number): Promise<void> {
  await q(`DELETE FROM plan_shares WHERE id = $1 AND user_id = $2`, [shareId, userId]);
}

export async function addComment(
  shareId: number,
  planExerciseId: number,
  commenterId: number,
  body: string,
): Promise<void> {
  await q1(
    `INSERT INTO share_comments (share_id, plan_exercise_id, commenter_id, body) VALUES ($1, $2, $3, $4)`,
    [shareId, planExerciseId, commenterId, body],
  );
}
