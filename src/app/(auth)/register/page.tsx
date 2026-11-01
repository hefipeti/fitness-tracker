import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth-forms';
import { getCurrentUser } from '@/lib/auth';
import { countUsers } from '@/lib/users';

export const metadata = { title: 'Create account' };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/');
  if ((await countUsers()) === 0) redirect('/setup');
  return (
    <>
      <h1 style={{ fontSize: '1.3rem', marginBottom: 4 }}>Create account</h1>
      <p className="small muted" style={{ marginBottom: 16 }}>
        Choose a unique username and a password of at least 8 characters.
      </p>
      <RegisterForm />
      <p className="small muted" style={{ marginTop: 16, textAlign: 'center' }}>
        Already have an account?{' '}
        <a href="/login">Sign in</a>
      </p>
    </>
  );
}
