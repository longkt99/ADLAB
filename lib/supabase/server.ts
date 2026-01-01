// ============================================
// Server-side Supabase utilities for AdLab
// ============================================
// Provides workspace resolution and authenticated queries.
// Uses cookies for auth context in server components.

import { createClient } from '@supabase/supabase-js';
import { log } from '@/lib/log';
import {
  normalizeSupabaseError,
  markSupabaseReachable,
  markSupabaseUnreachable,
  getSupabaseConnectivityError,
  logSupabaseConfig,
} from '@/lib/utils/supabaseError';

// ============================================
// Supabase URL Verification (Dev Safety Guard)
// ============================================

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

/**
 * Verifies and logs Supabase URL (host only, never keys).
 * In non-production, throws if accidentally pointing to remote Supabase.
 */
function verifySupabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error(
      '[Supabase/Server] NEXT_PUBLIC_SUPABASE_URL is not set. Check your .env.local file.'
    );
  }

  const host = safeHost(url);
  if (!host) {
    throw new Error(
      `[Supabase/Server] Invalid NEXT_PUBLIC_SUPABASE_URL: "${url}". Check your .env.local file.`
    );
  }

  // One-time log at debug level (muted in dev:e2e)
  log.once('supabase-server-host', 'debug', `[Supabase/Server] Connecting to: ${host}`);

  // DEV SAFETY GUARD: Prevent accidental remote usage in development
  const isProduction = process.env.NODE_ENV === 'production';
  const isRemoteSupabase = url.includes('.supabase.co');

  if (!isProduction && isRemoteSupabase) {
    // Check for explicit opt-in to allow remote Supabase in dev
    const allowRemoteInDev = process.env.SUPABASE_ALLOW_REMOTE_IN_DEV === 'true';

    if (!allowRemoteInDev) {
      throw new Error(
        `[Supabase/Server] SAFETY GUARD: You are in ${process.env.NODE_ENV} mode but pointing to REMOTE Supabase (${host}).\n` +
        `This is likely a mistake. For local development, use:\n` +
        `  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n` +
        `Or if you intentionally want to use Cloud in dev, add to .env.local:\n` +
        `  SUPABASE_ALLOW_REMOTE_IN_DEV=true`
      );
    }

    // Allowed: log warning once
    log.once(
      'supabase-server-remote-dev',
      'warn',
      `[Supabase/Server] DEV using CLOUD enabled by SUPABASE_ALLOW_REMOTE_IN_DEV=true. Target: ${host}`
    );
  }

  return url;
}

// ============================================
// Environment Variables
// ============================================

const supabaseUrl = verifySupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseAnonKey) {
  throw new Error(
    '[Supabase/Server] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Check your .env.local file.'
  );
}

// ============================================
// Types
// ============================================

export interface WorkspaceInfo {
  id: string;
  name: string;
}

export interface WorkspaceResult {
  workspace: WorkspaceInfo | null;
  error: string | null;
}

// ============================================
// Server Supabase Client
// ============================================

/**
 * Creates a Supabase client for server components.
 * Attempts to extract auth from cookies for workspace resolution.
 */
export function createServerSupabaseClient() {
  // Log config once per server process (mode + host, never keys)
  logSupabaseConfig();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Workspace Resolution
// ============================================

/**
 * Resolves the current workspace for the logged-in user.
 *
 * Strategy:
 * 1. Try to get authenticated user from Supabase auth
 * 2. Query workspace_members to find user's workspaces
 * 3. Return the most recently created workspace (or first available)
 * 4. Return null if no workspace found (UI shows empty state)
 *
 * NOTE: This is a simplified approach. In production, you may want to:
 * - Store selected workspace in session/cookie
 * - Allow workspace switching in UI
 * - Handle multiple workspaces more explicitly
 */
export async function resolveWorkspace(): Promise<WorkspaceResult> {
  // Check cached connectivity state - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    log.once('workspace-skip', 'debug', '[Workspace] Skipping query - Supabase recently unreachable');
    return {
      workspace: null,
      error: `${cachedError.message}. ${cachedError.actionableHint.split('\n')[0]}`,
    };
  }

  try {
    const supabase = createServerSupabaseClient();

    // First, try to get any workspace (for demo/development without auth)
    // In production, you would enforce auth here
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (workspaceError) {
      const normalized = normalizeSupabaseError(workspaceError);
      if (normalized.kind === 'SUPABASE_UNREACHABLE') {
        markSupabaseUnreachable(workspaceError);
      }
      return {
        workspace: null,
        error: `${normalized.message}. ${normalized.actionableHint.split('\n')[0]}`,
      };
    }

    // Success - mark as reachable
    markSupabaseReachable();

    if (!workspaces || workspaces.length === 0) {
      return { workspace: null, error: null };
    }

    return {
      workspace: {
        id: workspaces[0].id,
        name: workspaces[0].name,
      },
      error: null,
    };
  } catch (e) {
    // Handle network-level errors gracefully
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
    }
    return {
      workspace: null,
      error: `${normalized.message}. ${normalized.actionableHint.split('\n')[0]}`,
    };
  }
}

/**
 * Gets list of clients for the workspace (for dropdown)
 */
export async function getWorkspaceClients(workspaceId: string): Promise<{
  clients: Array<{ id: string; name: string }>;
  error: string | null;
}> {
  // Check cached connectivity state - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return { clients: [], error: null }; // Silently skip, main error shown elsewhere
  }

  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true })
      .limit(50);

    if (error) {
      const normalized = normalizeSupabaseError(error);
      if (normalized.kind === 'SUPABASE_UNREACHABLE') {
        markSupabaseUnreachable(error);
      }
      return { clients: [], error: normalized.message };
    }

    markSupabaseReachable();
    return { clients: data || [], error: null };
  } catch (e) {
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
    }
    return { clients: [], error: normalized.message };
  }
}
