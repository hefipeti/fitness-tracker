import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { SystemProvider } from '@/components/system';

// Every page reads live, per-user data from Postgres.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Fitness Tracker System', template: '%s · Fitness Tracker System' },
  description: 'Personal training, quest and nutrition tracker',
};

export const viewport: Viewport = {
  themeColor: '#07070c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SystemProvider>{children}</SystemProvider>
      </body>
    </html>
  );
}
