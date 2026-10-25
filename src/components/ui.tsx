import type { ReactNode } from 'react';
import type { HunterLite } from '@/lib/queries';

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-title">
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <div className="kicker">[ {kicker} ]</div>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function Bar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className={`bar ${className} ${over ? 'over' : ''}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={Math.round(max)}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function RankBadge({ letter, size = '' }: { letter: string; size?: '' | 'sm' | 'lg' }) {
  return <div className={`rank ${size}`}>{letter}</div>;
}

export function HunterMini({ h }: { h: HunterLite }) {
  return (
    <div className="hunter-mini">
      <div className="row">
        <RankBadge letter={h.rank.letter} size="sm" />
        <div className="grow">
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</div>
          <div className="tiny muted mono">
            LV {h.level} · {h.rank.title}
          </div>
        </div>
      </div>
      <div>
        <Bar value={h.xpIntoLevel} max={h.xpForNext} className="thin" />
        <div className="tiny dim mono mt-s" style={{ marginTop: 4 }}>
          {h.xpIntoLevel} / {h.xpForNext} XP
        </div>
      </div>
    </div>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return <span className={`badge cat-${category}`}>{category}</span>;
}

export function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function fmtTarget(mode: string, reps: number, weight: number | null): string {
  if (mode === 'seconds') return `${reps}s`;
  if (mode === 'weighted') return `${reps}${weight ? ` @ ${weight} kg` : ''}`;
  if (mode === 'assisted') return `${reps}${weight ? ` @ −${weight} kg assist` : ''}`;
  return `${reps}`;
}

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
