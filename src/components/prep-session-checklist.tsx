'use client';

import { useState, useEffect } from 'react';
import type { PrepSession } from '@/lib/queries';

const storageKey = (sessionId: number, foodId: number) => `prep-check-${sessionId}-${foodId}`;

function loadChecked(sessionId: number, foodIds: number[]): Set<number> {
  if (typeof window === 'undefined') return new Set();
  const result = new Set<number>();
  for (const id of foodIds) {
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
  const foodIds = session.foods.map((f) => f.id);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setChecked(loadChecked(session.id, foodIds));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const toggle = (foodId: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(foodId)) {
        next.delete(foodId);
        localStorage.removeItem(storageKey(session.id, foodId));
      } else {
        next.add(foodId);
        localStorage.setItem(storageKey(session.id, foodId), '1');
      }
      return next;
    });
  };

  const allChecked = foodIds.length > 0 && foodIds.every((id) => checked.has(id));
  const checkedCount = foodIds.filter((id) => checked.has(id)).length;

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
            <span className="badge">{checkedCount}/{foodIds.length}</span>
          )}
          <span className="small muted">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {session.notes && (
            <div className="small muted" style={{ marginBottom: 10, fontStyle: 'italic' }}>
              {session.notes}
            </div>
          )}
          {session.foods.length === 0 ? (
            <div className="small dim">No ingredients added.</div>
          ) : (
            <div className="list">
              {session.foods.map((f) => {
                const isChecked = checked.has(f.id);
                return (
                  <button
                    key={f.id}
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
                    onClick={() => toggle(f.id)}
                    aria-pressed={isChecked}
                  >
                    <div
                      className="check"
                      style={{ flexShrink: 0 }}
                      aria-hidden
                    >
                      {isChecked && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </div>
                    <div className="grow">
                      <div className="t" style={{ textDecoration: isChecked ? 'line-through' : undefined }}>
                        {f.name}
                      </div>
                      <div className="s mono">
                        ×{f.servings} {f.servingLabel}
                        <span className="dim"> · {Math.round(f.kcal * f.servings)} kcal · P {Math.round(f.protein * f.servings)}g</span>
                      </div>
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
