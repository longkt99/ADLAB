// Supabase client configuration for Content Machine
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { log } from './log';

// ============================================
// Helpers
// ============================================

function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Require env value (typed as string after validation).
 * NOTE: pass the env value directly (do NOT use process.env[name]) so Next can inline NEXT_PUBLIC_ vars.
 */
function requireString(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`[Supabase] ${name} is not set. Check your .env.local file.`);
  }
  return value;
}

/**
 * Extracts host from URL safely, returns null on error.
 */
function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

// ============================================
// Supabase URL Verification (Dev Safety Guard)
// ============================================

function verifySupabaseUrl(url: string): string {
  const host = safeHost(url);
  if (!host) {
    throw new Error(
      `[Supabase] Invalid NEXT_PUBLIC_SUPABASE_URL: "${url}". Check your .env.local file.`
    );
  }

  // DEV SAFETY GUARD: Prevent accidental remote usage in non-production
  const isProduction = process.env.NODE_ENV === 'production';
  const isRemoteSupabase = url.includes('.supabase.co');

  if (!isProduction && isRemoteSupabase) {
    // Check for explicit opt-in to allow remote Supabase in dev
    const allowRemoteInDev = process.env.SUPABASE_ALLOW_REMOTE_IN_DEV === 'true';

    if (!allowRemoteInDev) {
      throw new Error(
        `[Supabase] SAFETY GUARD: You are in ${process.env.NODE_ENV} mode but pointing to REMOTE Supabase (${host}).\n` +
          `This is likely a mistake. For local development, use:\n` +
          `  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n` +
          `Or if you intentionally want to use Cloud in dev, add to .env.local:\n` +
          `  SUPABASE_ALLOW_REMOTE_IN_DEV=true`
      );
    }

    // Allowed: log warning once
    if (isServer()) {
      log.once(
        'supabase-remote-dev',
        'warn',
        `[Supabase] DEV using CLOUD enabled by SUPABASE_ALLOW_REMOTE_IN_DEV=true. Target: ${host}`
      );
    }
  }

  // One-time host log on server only (survives HMR via globalThis flag)
  // Uses debug level to avoid noise in dev:e2e output
  if (isServer()) {
    log.once('supabase-host', 'debug', `[Supabase] Connecting to: ${host}`);
  }

  return url;
}

// ============================================
// Environment Variables (typed as string)
// ============================================

const supabaseUrl = verifySupabaseUrl(
  requireString('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
);

const supabaseAnonKey = requireString(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Client for use in client components and API routes
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Server-side client with service role key (for admin operations)
export function getServiceSupabase() {
  const serviceRoleKey = requireString(
    'SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Helper to create a Supabase client for server components
export function createServerClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
