import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: 18 }}>
          <div className="brand-mark">F</div>
          <div>
            <div className="brand-name">Fitness Tracker</div>
            <div className="brand-sub">System</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
