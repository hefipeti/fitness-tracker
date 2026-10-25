import { redirect } from 'next/navigation';
import { SetupForm } from '@/components/auth-forms';
import { countUsers } from '@/lib/users';
import { PLAN_TEMPLATES } from '@/lib/templates';

export const metadata = { title: 'First-time setup' };

export default async function SetupPage() {
  if ((await countUsers()) > 0) redirect('/login');
  return (
    <>
      <h1 style={{ fontSize: '1.3rem', marginBottom: 4 }}>First-time setup</h1>
      <p className="small muted" style={{ marginBottom: 16 }}>
        Create the first account. It becomes the administrator, adopts the data already in this database, and can add more
        accounts later from Profile.
      </p>
      <SetupForm templates={PLAN_TEMPLATES.filter((t) => t.key !== 'starter').map((t) => ({ key: t.key, name: t.name }))} />
    </>
  );
}
