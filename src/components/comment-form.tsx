'use client';

import { useActionState } from 'react';
import { addCommentAction, type CommentState } from '@/lib/actions/shares';

export function CommentForm({ token, planExerciseId }: { token: string; planExerciseId: number }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(addCommentAction, {});

  if (state.done) {
    return <p className="tiny dim" style={{ marginTop: 4 }}>Comment added.</p>;
  }

  return (
    <form action={action} className="row" style={{ gap: 6, marginTop: 4 }}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="planExerciseId" value={planExerciseId} />
      <input
        name="body"
        className="field"
        placeholder="Leave a comment…"
        maxLength={1000}
        style={{ flex: 1, fontSize: '0.8rem' }}
        required
      />
      {state.error && <span className="small danger">{state.error}</span>}
      <button className="btn sm ghost" disabled={pending} style={{ flexShrink: 0 }}>
        {pending ? '…' : 'Comment'}
      </button>
    </form>
  );
}
