import type { ReactNode } from 'react';
import Link from 'next/link';

export default function SharedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app" style={{ gridTemplateColumns: '1fr' }}>
      <header style={{ padding: '12px 24px', borderBottom: '1px solid var(--border, #222)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="brand-mark">F</div>
        <div>
          <div className="brand-name" style={{ fontSize: '0.9rem' }}>Fitness Tracker System</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Link className="btn sm ghost" href="/login">Sign in</Link>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
