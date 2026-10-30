import { cookies } from 'next/headers';

export async function setLocaleCookie(locale: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale, {
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
}
