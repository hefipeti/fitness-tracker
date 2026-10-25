'use client';
// PROTOTYPE switcher — not for production.

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: { key: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const idx = variants.findIndex((v) => v.key === current);
  const go = (key: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set('variant', key);
    router.replace(`?${params.toString()}`);
  };
  const prev = () => go(variants[(idx - 1 + variants.length) % variants.length].key);
  const next = () => go(variants[(idx + 1) % variants.length].key);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA'].includes(tag) || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const v = variants[idx];
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(16,16,26,0.96)',
        border: '1px solid var(--violet)',
        borderRadius: 999,
        padding: '8px 18px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.3)',
        backdropFilter: 'blur(8px)',
        userSelect: 'none',
      }}
    >
      <button onClick={prev} style={arrowStyle}>←</button>
      <span style={{ fontSize: '0.82rem', letterSpacing: '0.05em', color: 'var(--violet-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {v.key} · {v.name}
      </span>
      <button onClick={next} style={arrowStyle}>→</button>
      <span style={{ fontSize: '0.68rem', color: 'var(--dim)', borderLeft: '1px solid var(--line)', paddingLeft: 10, marginLeft: 2 }}>
        PROTOTYPE
      </span>
    </div>
  );
}

const arrowStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--violet-2)',
  cursor: 'pointer',
  fontSize: '1rem',
  padding: '0 4px',
  lineHeight: 1,
};
