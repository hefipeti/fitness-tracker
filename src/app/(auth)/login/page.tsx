import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth-forms';
import { getCurrentUser } from '@/lib/auth';
import { countUsers } from '@/lib/users';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/');
  if ((await countUsers()) === 0) redirect('/setup');
  return (
    <>
      <h1 style={{ fontSize: '1.3rem', marginBottom: 4 }}>Sign in</h1>
      <p className="small muted" style={{ marginBottom: 16 }}>
        Each person has their own profile, plan, history and goals.
      </p>
      <LoginForm />
    </>
  );
}
