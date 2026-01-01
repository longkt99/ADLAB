// ============================================
// Supabase Error Handling Utilities
// ============================================
// Centralized error normalization and connectivity detection.
// Used by all Supabase-dependent fetchers.
// ============================================

import { log } from '@/lib/log';

// ============================================
// Types
// ============================================

export type SupabaseErrorKind =
  | 'SUPABASE_UNREACHABLE'
  | 'TABLE_NOT_FOUND'
  | 'AUTH_ERROR'
  | 'RLS_ERROR'
  | 'UNKNOWN';

export interface NormalizedError {
  kind: SupabaseErrorKind;
  message: string;
  targetUrl: string | null;
  actionableHint: string;
}

/**
 * Structured API error response for connectivity issues.
 * Use this in API routes to return proper 503 responses.
 */
export interface SupabaseApiError {
  ok: false;
  kind: SupabaseErrorKind;
  message: string;
  targetUrl: string | null;
  mode: 'LOCAL' | 'CLOUD' | 'UNKNOWN';
  hintOptions: string[];
}

// ============================================
// Configuration Detection
// ============================================

/**
 * Get the configured Supabase URL from environment.
 * Returns the URL or null if not set.
 */
export function getSupabaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || null;
}

/**
 * Check if the configured Supabase URL is local (127.0.0.1 / localhost).
 */
export function isLocalSupabase(): boolean {
  const url = getSupabaseUrl();
  if (!url) return false;
  return url.includes('127.0.0.1') || url.includes('localhost');
}

/**
 * Check if the configured Supabase URL is Supabase Cloud.
 */
export function isCloudSupabase(): boolean {
  const url = getSupabaseUrl();
  if (!url) return false;
  return url.includes('.supabase.co');
}

/**
 * Get a safe host string for display (no keys).
 */
export function getSafeHost(url: string | null): string {
  if (!url) return '(not configured)';
  try {
    return new URL(url).host;
  } catch {
    return '(invalid URL)';
  }
}

/**
 * Get detected Supabase mode: 'LOCAL' or 'CLOUD' or 'UNKNOWN'.
 */
export function getSupabaseMode(): 'LOCAL' | 'CLOUD' | 'UNKNOWN' {
  if (isLocalSupabase()) return 'LOCAL';
  if (isCloudSupabase()) return 'CLOUD';
  return 'UNKNOWN';
}

/**
 * Log Supabase configuration once per server process.
 * Logs mode (LOCAL/CLOUD), host (never keys).
 */
export function logSupabaseConfig(): void {
  const url = getSupabaseUrl();
  const host = getSafeHost(url);
  const mode = getSupabaseMode();

  log.once(
    'supabase-config',
    'info',
    `[Supabase] Mode: ${mode} | Target: ${host}`
  );
}

/**
 * Create a structured API error response from a NormalizedError.
 * Use this in API routes to return proper 503 responses.
 */
export function toApiError(normalized: NormalizedError): SupabaseApiError {
  return {
    ok: false,
    kind: normalized.kind,
    message: normalized.message,
    targetUrl: normalized.targetUrl,
    mode: getSupabaseMode(),
    hintOptions: normalized.actionableHint.split('\n').filter(Boolean),
  };
}

// ============================================
// Error Normalization
// ============================================

/**
 * Normalize any error into a user-friendly format with actionable hints.
 * Detects connection errors, missing tables, auth issues, etc.
 */
export function normalizeSupabaseError(error: unknown): NormalizedError {
  const msg = error instanceof Error ? error.message : String(error);
  const supabaseUrl = getSupabaseUrl();
  const host = getSafeHost(supabaseUrl);
  const isLocal = isLocalSupabase();

  // Connection errors (ECONNREFUSED, fetch failed, TypeError)
  if (
    msg.includes('fetch failed') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('TypeError') ||
    msg.includes('network') ||
    msg.includes('Failed to fetch')
  ) {
    return {
      kind: 'SUPABASE_UNREACHABLE',
      message: `Cannot connect to Supabase at ${host}`,
      targetUrl: supabaseUrl,
      actionableHint: isLocal
        ? 'Option A (Local): Start Docker Desktop, then run: npx supabase start\n' +
          'Option B (Cloud): Update .env.local with your Supabase Cloud URL and restart the dev server.'
        : 'Check your internet connection and verify NEXT_PUBLIC_SUPABASE_URL in .env.local is correct.',
    };
  }

  // Table/relation doesn't exist
  if (
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    (msg.includes('PGRST') && msg.includes('does not exist'))
  ) {
    return {
      kind: 'TABLE_NOT_FOUND',
      message: 'Database table not found',
      targetUrl: supabaseUrl,
      actionableHint: isLocal
        ? 'Run migrations: npx supabase db reset'
        : 'Check that your database schema is up to date.',
    };
  }

  // Auth errors
  if (msg.includes('JWT') || msg.includes('token') || msg.includes('auth')) {
    return {
      kind: 'AUTH_ERROR',
      message: 'Authentication error',
      targetUrl: supabaseUrl,
      actionableHint: 'Check your NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
    };
  }

  // RLS errors
  if (msg.includes('permission') || msg.includes('RLS') || msg.includes('policy')) {
    return {
      kind: 'RLS_ERROR',
      message: 'Row-level security prevented access',
      targetUrl: supabaseUrl,
      actionableHint: 'This may be expected. Check RLS policies if data should be visible.',
    };
  }

  // Unknown error
  return {
    kind: 'UNKNOWN',
    message: msg || 'Unknown error',
    targetUrl: supabaseUrl,
    actionableHint: 'Check the browser console and server logs for more details.',
  };
}

/**
 * Simple string normalization for backward compatibility.
 * Returns just the message with hint embedded.
 */
export function normalizeErrorMessage(error: unknown): string {
  const normalized = normalizeSupabaseError(error);
  if (normalized.kind === 'SUPABASE_UNREACHABLE') {
    // Include actionable hint for connection errors
    return `${normalized.message}. ${normalized.actionableHint.split('\n')[0]}`;
  }
  return normalized.message;
}

// ============================================
// Connectivity State
// ============================================

// Global state to track Supabase connectivity (survives HMR)
interface ConnectivityState {
  lastCheck: number;
  isReachable: boolean;
  error: NormalizedError | null;
}

const CONNECTIVITY_CACHE_MS = 5000; // Cache result for 5 seconds

function getConnectivityState(): ConnectivityState {
  const g = globalThis as unknown as { __supabaseConnectivity?: ConnectivityState };
  if (!g.__supabaseConnectivity) {
    g.__supabaseConnectivity = {
      lastCheck: 0,
      isReachable: true, // Optimistic default
      error: null,
    };
  }
  return g.__supabaseConnectivity;
}

/**
 * Mark Supabase as unreachable (call this when a connection error occurs).
 */
export function markSupabaseUnreachable(error: unknown): void {
  const state = getConnectivityState();
  state.lastCheck = Date.now();
  state.isReachable = false;
  state.error = normalizeSupabaseError(error);
}

/**
 * Mark Supabase as reachable (call this when a query succeeds).
 */
export function markSupabaseReachable(): void {
  const state = getConnectivityState();
  state.lastCheck = Date.now();
  state.isReachable = true;
  state.error = null;
}

/**
 * Check if we should skip Supabase queries based on recent connectivity state.
 * Returns the cached error if unreachable, or null if should proceed.
 */
export function getSupabaseConnectivityError(): NormalizedError | null {
  const state = getConnectivityState();
  const now = Date.now();

  // If cache is stale, allow retry
  if (now - state.lastCheck > CONNECTIVITY_CACHE_MS) {
    return null;
  }

  // Return cached error if unreachable
  return state.isReachable ? null : state.error;
}

/**
 * Check if Supabase queries should be skipped.
 */
export function shouldSkipSupabaseQuery(): boolean {
  return getSupabaseConnectivityError() !== null;
}
