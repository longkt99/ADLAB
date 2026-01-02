// Supabase client configuration for Content Machine
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
// Lazy Environment Variable Access
// ============================================
// IMPORTANT: Do NOT read env vars at module scope.
// This ensures the module can be imported during build without throwing.

function getSupabaseUrl(): string {
  return verifySupabaseUrl(
    requireString('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

function getSupabaseAnonKey(): string {
  return requireString(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// ============================================
// Lazy Client Initialization
// ============================================
// Clients are created on first access, not at import time.

let _supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Get the Supabase client for use in client components and API routes.
 * Lazily initialized on first call.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!_supabaseClient) {
    _supabaseClient = createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _supabaseClient;
}

/**
 * @deprecated Use getSupabase() instead for lazy initialization.
 * This export is kept for backward compatibility but will throw at import time
 * if env vars are missing. Migrate to getSupabase() for CI-safe builds.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});

// Server-side client with service role key (for admin operations)
export function getServiceSupabase(): SupabaseClient<Database> {
  const serviceRoleKey = requireString(
    'SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return createClient<Database>(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Helper to create a Supabase client for server components
export function createServerClient(): SupabaseClient<Database> {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
