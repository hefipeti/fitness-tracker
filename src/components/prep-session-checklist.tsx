'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { PrepSession } from '@/lib/queries';

const storageKey = (sessionId: number, ingredientId: number) => `prep-check-${sessionId}-${ingredientId}`;

function loadChecked(sessionId: number, ids: number[]): Set<number> {
  if (typeof window === 'undefined') return new Set();
  const result = new Set<number>();
  for (const id of ids) {
    if (localStorage.getItem(storageKey(sessionId, id)) === '1') result.add(id);
  }
  return result;
}

export function PrepSessionChecklist({
  session,
  dayNames,
}: {
  session: PrepSession;
  dayNames: Record<number, string>;
}) {
  const ids = session.ingredients.map((i) => i.id);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setChecked(loadChecked(session.id, ids));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const toggle = (id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        localStorage.removeItem(storageKey(session.id, id));
      } else {
        next.add(id);
        localStorage.setItem(storageKey(session.id, id), '1');
      }
      return next;
    });
  };

  const allChecked = ids.length > 0 && ids.every((id) => checked.has(id));
  const checkedCount = ids.filter((id) => checked.has(id)).length;

  return (
    <div className="panel">
      <button
        type="button"
        className="panel-title"
        style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          🍳 {session.name}
          <span className="small muted" style={{ marginLeft: 8 }}>
            {dayNames[session.cookWeekday]}
          </span>
        </span>
        <span className="row" style={{ gap: 8 }}>
          {allChecked && <span className="badge on">ready</span>}
          {!allChecked && checkedCount > 0 && (
            <span className="badge">{checkedCount}/{ids.length}</span>
          )}
          <span className="small muted">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {session.notes && (
            <div className="prep-notes small" style={{ marginBottom: 10 }}>
              <ReactMarkdown>{session.notes}</ReactMarkdown>
            </div>
          )}
          {session.ingredients.length === 0 ? (
            <div className="small dim">No ingredients added.</div>
          ) : (
            <div className="list">
              {session.ingredients.map((ing) => {
                const isChecked = checked.has(ing.id);
                return (
                  <button
                    key={ing.id}
                    type="button"
                    className="item"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      opacity: isChecked ? 0.5 : 1,
                    }}
                    onClick={() => toggle(ing.id)}
                    aria-pressed={isChecked}
                  >
                    <div className="check" style={{ flexShrink: 0 }} aria-hidden>
                      {isChecked && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </div>
                    <div className="grow">
                      <div className="t" style={{ textDecoration: isChecked ? 'line-through' : undefined }}>
                        {ing.name}
                      </div>
                      {ing.unit && <div className="s mono">{ing.unit}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
