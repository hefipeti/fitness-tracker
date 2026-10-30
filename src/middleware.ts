import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'hu'],
  defaultLocale: 'en',
  localePrefix: 'never',
  localeDetection: false,
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
