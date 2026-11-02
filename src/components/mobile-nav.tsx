'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, type ReactNode } from 'react';

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ITEMS: { href: string; key: string; icon: ReactNode }[] = [
  { href: '/', key: 'status', icon: <svg viewBox="0 0 24 24" {...S}><path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" /><path d="M12 8v5l3 2" /></svg> },
  { href: '/training', key: 'training', icon: <svg viewBox="0 0 24 24" {...S}><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" /></svg> },
  { href: '/plans', key: 'plans', icon: <svg viewBox="0 0 24 24" {...S}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg> },
  { href: '/tasks', key: 'quests', icon: <svg viewBox="0 0 24 24" {...S}><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg> },
  { href: '/food', key: 'nutrition', icon: <svg viewBox="0 0 24 24" {...S}><path d="M7 3v7a3 3 0 0 0 3 3v8M7 3v5M10 3v5M17 21V3c-2.5 1.5-3.5 4-3.5 8h3.5" /></svg> },
  { href: '/progress', key: 'progress', icon: <svg viewBox="0 0 24 24" {...S}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg> },
  { href: '/profile', key: 'profile', icon: <svg viewBox="0 0 24 24" {...S}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" /></svg> },
];

export function MobileFabNav() {
  const path = usePathname();
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);

  const activeItem = ITEMS.find((i) =>
    i.href === '/' ? path === '/' : path === i.href || path.startsWith(`${i.href}/`)
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Close sheet on navigation
  useEffect(() => { setOpen(false); }, [path]);

  return (
    <>
      {/* Scrim */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="mob-scrim"
        />
      )}

      {/* Slide-up sheet */}
      <div className={`mob-sheet${open ? ' open' : ''}`}>
        <div className="mob-sheet-handle" />
        <div className="mob-sheet-grid">
          {ITEMS.map((item) => {
            const active = item.href === '/' ? path === '/' : path === item.href || path.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mob-nav-item${active ? ' active' : ''}`}
              >
                <span className="mob-nav-icon">{item.icon}</span>
                <span className="mob-nav-label">{t(item.key as Parameters<typeof t>[0])}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`mob-fab${open ? ' open' : ''}`}
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          {open ? (
            <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>
          ) : (
            <><path d="M4 7h16M4 12h16M4 17h16" /></>
          )}
        </svg>
      </button>

      {/* Current-page pill */}
      {!open && (
        <div className="mob-page-pill" aria-hidden>
          <span className="mob-page-pill-icon">{activeItem?.icon}</span>
          <span>{activeItem ? t(activeItem.key as Parameters<typeof t>[0]) : '—'}</span>
        </div>
      )}
    </>
  );
}
