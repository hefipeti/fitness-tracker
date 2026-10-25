'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import type { ActionResult, GameResult } from '@/lib/types';

interface Toast {
  id: number;
  kind: 'xp' | 'level' | 'ach' | 'error' | 'info';
  text: string;
  sub?: string;
}

type Runner = (fn: () => Promise<ActionResult>) => Promise<boolean>;

interface Ctx {
  run: Runner;
  notify: (t: Omit<Toast, 'id'>) => void;
}

const SystemCtx = createContext<Ctx | null>(null);

export function useSystem(): Ctx {
  const c = useContext(SystemCtx);
  if (!c) throw new Error('useSystem must be used inside <SystemProvider>');
  return c;
}

export function SystemProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const notify = useCallback((t: Omit<Toast, 'id'>) => {
    const id = nextId.current++;
    setToasts((x) => [...x.slice(-5), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.kind === 'level' ? 7000 : 5000);
  }, []);

  const showResult = useCallback(
    (r: GameResult) => {
      if (r.gained > 0) notify({ kind: 'xp', text: `+${r.gained} XP` });
      else if (r.gained < 0) notify({ kind: 'info', text: `${r.gained} XP` });
      if (r.leveledUp) notify({ kind: 'level', text: `LEVEL UP  →  ${r.level}` });
      if (r.rankedUp) notify({ kind: 'level', text: `RANK UP  →  ${r.rank}-Rank` });
      for (const a of r.achievements) {
        notify({ kind: 'ach', text: `Achievement unlocked: ${a.name}`, sub: `+${a.xp} XP` });
      }
    },
    [notify],
  );

  const run = useCallback<Runner>(
    async (fn) => {
      try {
        const r = await fn();
        if (r && 'error' in r) {
          notify({ kind: 'error', text: 'Action failed', sub: r.error });
          return false;
        }
        if (r && 'note' in r) notify({ kind: 'info', text: r.note });
        else if (r) showResult(r);
        return true;
      } catch (e) {
        notify({
          kind: 'error',
          text: 'Action failed',
          sub: e instanceof Error && e.message ? e.message : 'Unknown error',
        });
        return false;
      }
    },
    [notify, showResult],
  );

  return (
    <SystemCtx.Provider value={{ run, notify }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'level' ? 'level' : t.kind === 'error' ? 'error' : ''}`}>
            <div className="tag">[SYSTEM]</div>
            <div className="tx">{t.text}</div>
            {t.sub && <div className="sb">{t.sub}</div>}
          </div>
        ))}
      </div>
    </SystemCtx.Provider>
  );
}

/** Form that runs a server action, shows XP/level/achievement toasts, then resets itself. */
export function RunForm({
  action,
  children,
  className,
  keepValues = false,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  keepValues?: boolean;
}) {
  const { run } = useSystem();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const ok = await run(() => action(fd));
          if (ok && !keepValues) ref.current?.reset();
        });
      }}
    >
      <fieldset className="plain" disabled={pending}>
        {children}
      </fieldset>
    </form>
  );
}

/** Button that runs a (bound) server action and shows the resulting toasts. */
export function RunButton({
  action,
  children,
  className = 'btn',
  title,
  ariaLabel,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const { run } = useSystem();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={ariaLabel}
      disabled={pending}
      onClick={() => start(async () => void (await run(action)))}
    >
      {children}
    </button>
  );
}

export function TaskCheck({
  done,
  action,
  label,
}: {
  done: boolean;
  action: () => Promise<ActionResult>;
  label: string;
}) {
  const { run } = useSystem();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={`check ${done ? 'on' : ''}`}
      aria-pressed={done}
      aria-label={label}
      disabled={pending}
      onClick={() => start(async () => void (await run(action)))}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5L20 7" />
      </svg>
    </button>
  );
}
