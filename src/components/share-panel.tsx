'use client';

import { useActionState } from 'react';
import { createShareAction, revokeShareAction, type CreateShareResult } from '@/lib/actions/shares';
import type { ShareRow } from '@/lib/queries';

function ShareForm({ planId }: { planId: number }) {
  const [state, action, pending] = useActionState<CreateShareResult, FormData>(createShareAction, null);

  return (
    <>
      {state && 'token' in state && (
        <div className="panel" style={{ marginBottom: 12, background: 'var(--surface-2, #1a1a1a)' }}>
          <p className="small" style={{ marginBottom: 6 }}>Share link generated. Copy it now — it won&apos;t be shown again.</p>
          <code
            style={{
              display: 'block',
              wordBreak: 'break-all',
              padding: '8px',
              background: 'var(--surface-3, #222)',
              borderRadius: 4,
              fontSize: '0.8rem',
            }}
          >
            {typeof window !== 'undefined' ? `${window.location.origin}/shared/${state.token}` : `/shared/${state.token}`}
          </code>
        </div>
      )}
      {state && 'error' in state && <p className="small danger">{state.error}</p>}
      <form action={action} className="col" style={{ gap: 8 }}>
        <input type="hidden" name="planId" value={planId} />
        <div className="row wrap" style={{ gap: 12 }}>
          <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: '0.875rem' }}>
            <input type="checkbox" name="includePersonal" value="true" />
            Include my progress data
          </label>
          <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: '0.875rem' }}>
            <input type="checkbox" name="shareType" value="review" />
            Review link (requires sign-in, allows comments)
          </label>
        </div>
        <div>
          <button className="btn sm primary" disabled={pending}>
            {pending ? 'Generating…' : 'Generate share link'}
          </button>
        </div>
      </form>
      <p className="tiny dim mt-s">Anyone with the link can view this plan. You can revoke it anytime.</p>
    </>
  );
}

export function SharePanel({ planId, shares }: { planId: number; shares: ShareRow[] }) {
  return (
    <>
      {shares.length > 0 && (
        <div className="list" style={{ marginBottom: 16 }}>
          {shares.map((s) => (
            <div className="item" key={s.id} style={{ alignItems: 'center' }}>
              <div className="grow small">
                {s.shareType === 'review' ? <span className="badge">review</span> : 'View'}{' '}
                link · {new Date(s.createdAt).toLocaleDateString()}{' '}
                {s.includePersonalData && <span className="badge">with progress</span>}
              </div>
              <form action={revokeShareAction}>
                <input type="hidden" name="shareId" value={s.id} />
                <input type="hidden" name="planId" value={planId} />
                <button className="btn sm danger">Revoke</button>
              </form>
            </div>
          ))}
        </div>
      )}
      {shares.length === 0 && <p className="small dim" style={{ marginBottom: 12 }}>No active share links.</p>}
      <ShareForm planId={planId} />
    </>
  );
}
