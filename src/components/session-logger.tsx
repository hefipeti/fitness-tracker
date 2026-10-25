'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSystem } from '@/components/system';
import { completeSessionAction, logSetAction, removeSessionExerciseAction, removeSetAction } from '@/lib/actions/training';
import type { SessionExerciseDetail } from '@/lib/queries';
import type { SetLike } from '@/lib/game';

interface Row {
  value: string; // reps or seconds depending on mode
  reps: string; // only used for weighted mode
  weight: string;
  done: boolean;
}

const usesWeight = (mode: string) => mode === 'weighted' || mode === 'assisted';

function toInt(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function toNum(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function fmtLast(mode: string, s: SetLike): string {
  if (mode === 'seconds') return `${s.seconds ?? 0}s`;
  if (mode === 'weighted') return `${s.weightKg ?? 0}×${s.reps ?? 0}`;
  if (mode === 'assisted') return `−${s.weightKg ?? 0}×${s.reps ?? 0}`;
  return `${s.reps ?? 0}`;
}

function initRows(ex: SessionExerciseDetail): Row[] {
  const count = Math.max(ex.targetSets, ...ex.sets.map((s) => s.setNo));
  return Array.from({ length: count }, (_, i) => {
    const logged = ex.sets.find((s) => s.setNo === i + 1);
    const prev = ex.last[i] ?? ex.last[ex.last.length - 1];
    if (logged) {
      return {
        value: String(ex.mode === 'seconds' ? (logged.seconds ?? '') : (logged.reps ?? '')),
        reps: String(logged.reps ?? ''),
        weight: logged.weightKg != null ? String(logged.weightKg) : '',
        done: true,
      };
    }
    const w = prev?.weightKg ?? ex.targetWeight;
    return {
      value: String(ex.targetReps),
      reps: String(ex.targetReps),
      weight: w != null ? String(w) : '',
      done: false,
    };
  });
}

export function SessionLogger({
  sessionId,
  readOnly,
  exercises,
}: {
  sessionId: number;
  readOnly: boolean;
  exercises: SessionExerciseDetail[];
}) {
  const { run, notify } = useSystem();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Record<number, Row[]>>(() =>
    Object.fromEntries(exercises.map((e) => [e.exerciseId, initRows(e)])),
  );
  const [restFrom, setRestFrom] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const known = useRef(new Set(exercises.map((e) => e.exerciseId)));

  // Exercises added after mount (server re-render) need their rows initialised.
  useEffect(() => {
    const fresh = exercises.filter((e) => !known.current.has(e.exerciseId));
    if (fresh.length === 0) return;
    for (const e of fresh) known.current.add(e.exerciseId);
    setRows((r) => ({ ...r, ...Object.fromEntries(fresh.map((e) => [e.exerciseId, initRows(e)])) }));
  }, [exercises]);

  useEffect(() => {
    if (restFrom == null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [restFrom]);

  const patch = (exId: number, idx: number, p: Partial<Row>) =>
    setRows((r) => ({ ...r, [exId]: r[exId].map((row, i) => (i === idx ? { ...row, ...p } : row)) }));

  function payload(ex: SessionExerciseDetail, idx: number, row: Row) {
    const v = toInt(usesWeight(ex.mode) ? row.reps : row.value);
    if (v == null) return null;
    return {
      sessionId,
      exerciseId: ex.exerciseId,
      setNo: idx + 1,
      reps: ex.mode === 'seconds' ? null : v,
      seconds: ex.mode === 'seconds' ? v : null,
      weightKg: usesWeight(ex.mode) ? toNum(row.weight) : null,
    };
  }

  function toggle(ex: SessionExerciseDetail, idx: number) {
    const row = rows[ex.exerciseId][idx];
    if (row.done) {
      patch(ex.exerciseId, idx, { done: false });
      start(async () => {
        const ok = await run(() => removeSetAction({ sessionId, exerciseId: ex.exerciseId, setNo: idx + 1 }));
        if (!ok) patch(ex.exerciseId, idx, { done: true });
      });
      return;
    }
    const p = payload(ex, idx, row);
    if (!p) {
      notify({ kind: 'error', text: 'Enter a number first' });
      return;
    }
    if (usesWeight(ex.mode) && p.weightKg == null) {
      notify({ kind: 'error', text: ex.mode === 'assisted' ? 'Enter the assist (kg) for this set, 0 if none' : 'Enter the weight (kg) for this set' });
      return;
    }
    patch(ex.exerciseId, idx, { done: true });
    setRestFrom(Date.now());
    setNow(Date.now());
    start(async () => {
      const ok = await run(() => logSetAction(p));
      if (!ok) patch(ex.exerciseId, idx, { done: false });
    });
  }

  function resave(ex: SessionExerciseDetail, idx: number) {
    const row = rows[ex.exerciseId][idx];
    if (!row.done) return;
    const p = payload(ex, idx, row);
    if (p) start(async () => void (await run(() => logSetAction(p))));
  }

  function addSet(ex: SessionExerciseDetail) {
    setRows((r) => {
      const list = r[ex.exerciseId];
      const last = list[list.length - 1];
      return { ...r, [ex.exerciseId]: [...list, { ...last, done: false }] };
    });
  }

  function dropLast(ex: SessionExerciseDetail) {
    setRows((r) => {
      const list = r[ex.exerciseId];
      if (list.length <= 1 || list[list.length - 1].done) return r;
      return { ...r, [ex.exerciseId]: list.slice(0, -1) };
    });
  }

  const totalDone = Object.values(rows).reduce((n, list) => n + list.filter((x) => x.done).length, 0);
  const restSecs = restFrom == null ? 0 : Math.floor((now - restFrom) / 1000);

  function complete() {
    start(async () => {
      const ok = await run(() => completeSessionAction(sessionId));
      if (ok) router.push('/training');
    });
  }

  return (
    <>
      <div className="col" style={{ gap: 14 }}>
        {exercises.map((ex) => {
          const list = rows[ex.exerciseId] ?? [];
          const weighted = usesWeight(ex.mode);
          const unit = ex.mode === 'seconds' ? 'SEC' : 'REPS';
          return (
            <section key={ex.exerciseId} className="panel ex-card">
              <div className="ex-head">
                <h3 className="grow">{ex.name}</h3>
                <span className={`badge cat-${ex.category}`}>{ex.category}</span>
                <span className="mono small muted">
                  {ex.targetSets} × {ex.targetReps}
                  {ex.mode === 'seconds' ? 's' : ''}
                  {weighted && ex.targetWeight ? ` @ ${ex.mode === 'assisted' ? '−' : ''}${ex.targetWeight} kg` : ''}
                </span>
                {!readOnly && (
                  <form action={removeSessionExerciseAction}>
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <input type="hidden" name="exerciseId" value={ex.exerciseId} />
                    <button className="btn sm ghost" title="Remove from this session" aria-label={`Remove ${ex.name}`}>
                      ✕
                    </button>
                  </form>
                )}
              </div>
              {ex.last.length > 0 && (
                <div className="tiny dim mono" style={{ marginBottom: 8 }}>
                  LAST: {ex.last.map((s) => fmtLast(ex.mode, s)).join(' · ')}
                </div>
              )}
              <div className="set-grid">
                <div className={`set-head ${weighted ? '' : 'no-weight'}`}>
                  <span>SET</span>
                  {weighted && <span>{ex.mode === 'assisted' ? 'ASSIST KG' : 'KG'}</span>}
                  <span>{unit}</span>
                  <span />
                </div>
                {list.map((row, i) => (
                  <div key={i} className={`set-row ${weighted ? '' : 'no-weight'} ${row.done ? 'done' : ''}`}>
                    <span className="n">{i + 1}</span>
                    {weighted && (
                      <input
                        inputMode="decimal"
                        aria-label={`Set ${i + 1} weight`}
                        value={row.weight}
                        disabled={readOnly}
                        onChange={(e) => patch(ex.exerciseId, i, { weight: e.target.value })}
                        onBlur={() => resave(ex, i)}
                      />
                    )}
                    <input
                      inputMode="numeric"
                      aria-label={`Set ${i + 1} ${unit.toLowerCase()}`}
                      value={weighted ? row.reps : row.value}
                      disabled={readOnly}
                      onChange={(e) => patch(ex.exerciseId, i, weighted ? { reps: e.target.value } : { value: e.target.value })}
                      onBlur={() => resave(ex, i)}
                    />
                    <button
                      type="button"
                      className={`check ${row.done ? 'on' : ''}`}
                      aria-pressed={row.done}
                      aria-label={`Set ${i + 1} done`}
                      disabled={readOnly || pending}
                      onClick={() => toggle(ex, i)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              {!readOnly && (
                <div className="row mt-s">
                  <button type="button" className="btn sm ghost" onClick={() => addSet(ex)}>
                    + Set
                  </button>
                  <button type="button" className="btn sm ghost" onClick={() => dropLast(ex)} disabled={list.length <= 1 || list[list.length - 1]?.done}>
                    − Set
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {!readOnly && (
        <div className="row between mt" style={{ flexWrap: 'wrap' }}>
          <span className="mono muted small">{totalDone} sets logged</span>
          <button type="button" className="btn primary" disabled={pending || totalDone === 0} onClick={complete}>
            Complete workout
          </button>
        </div>
      )}

      {restFrom != null && !readOnly && (
        <div className="rest" role="timer">
          <span className="tiny muted">REST</span>
          <span className="time">
            {Math.floor(restSecs / 60)}:{String(restSecs % 60).padStart(2, '0')}
          </span>
          <button type="button" className="btn sm ghost" onClick={() => setRestFrom(null)}>
            Hide
          </button>
        </div>
      )}
    </>
  );
}
