export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runSchemaMigrations } = await import('./lib/schemaMigrations');
    await runSchemaMigrations();
    const { startBackupScheduler } = await import('./lib/autoBackup');
    startBackupScheduler();
  }
}
