export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { migrateWithRetry } = await import('./lib/migrations');
  await migrateWithRetry();
}
