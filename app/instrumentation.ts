// ============================================
// Next.js Instrumentation Hook
// ============================================
// Runs once when the Next.js server starts.
// Used to trigger Supabase URL verification early.

export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import supabase module to trigger verification + one-time host log
    await import('@/lib/supabase');
  }
}
