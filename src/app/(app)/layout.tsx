import type { ReactNode } from 'react';
import { NavLinks } from '@/components/nav';
import { HunterMini } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { getHunterLite } from '@/lib/queries';
import { logoutAction } from '@/lib/actions/auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const hunter = await getHunterLite(user.id);
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <div className="brand-name">Fitness Tracker</div>
            <div className="brand-sub">System</div>
          </div>
        </div>
        <HunterMini h={hunter} />
        <NavLinks />
        <div className="side-foot">
          <div className="tiny dim mono" style={{ marginBottom: 6 }}>
            signed in as {user.username}
          </div>
          <form action={logoutAction}>
            <button className="btn sm ghost" style={{ width: '100%' }}>
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div>
        <div className="topbar">
          <HunterMini h={hunter} />
        </div>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
