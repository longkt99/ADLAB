export async function register() {
  // Skip Edge runtime - Supabase client not needed there
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }

  // Import logger first, then log at debug level (muted in dev:e2e)
  const { log } = await import('./lib/log');
  log.once('instrumentation', 'debug', '[instrumentation] register()', process.env.NEXT_RUNTIME);

  // Dynamically import to trigger verification + one-time host log
  await import('./lib/supabase');
}
