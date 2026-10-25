'use client';

import { useActionState } from 'react';
import { loginAction, setupAction, type AuthState } from '@/lib/actions/auth';

const INITIAL: AuthState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL);
  return (
    <form action={action} className="col">
      <label className="field">
        Username
        <input name="username" autoComplete="username" autoCapitalize="none" autoFocus required maxLength={64} />
      </label>
      <label className="field">
        Password
        <input name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </label>
      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}
      <button className="btn primary" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export function SetupForm({ templates }: { templates: { key: string; name: string }[] }) {
  const [state, action, pending] = useActionState(setupAction, INITIAL);
  return (
    <form action={action} className="col">
      <label className="field">
        Username
        <input name="username" autoComplete="username" autoCapitalize="none" autoFocus required minLength={3} maxLength={32} />
      </label>
      <label className="field">
        Name shown in the app
        <input name="hunterName" required maxLength={40} />
      </label>
      <label className="field">
        Password (min 8 characters)
        <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
      </label>
      <label className="field">
        Repeat password
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={200} />
      </label>
      <label className="field">
        Starting plan
        <select name="template" defaultValue={templates[0]?.key ?? 'none'}>
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
          <option value="none">Keep the existing starter plan</option>
        </select>
      </label>
      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}
      <button className="btn primary" disabled={pending}>
        {pending ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}
