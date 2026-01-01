// ============================================
// Full Context API Route
// ============================================
// GET: Returns full context including workspaces and clients list
// Used by ProjectSwitcherClient component
// ============================================

import { NextResponse } from 'next/server';
import { getActiveContext } from '@/lib/context/getActiveContext';
import {
  getSupabaseConnectivityError,
  toApiError,
  logSupabaseConfig,
} from '@/lib/utils/supabaseError';
import { log } from '@/lib/log';

/**
 * GET /api/context/full
 * Returns the full context data for client-side rendering
 */
export async function GET() {
  // Log Supabase config once per server process
  logSupabaseConfig();

  // Check connectivity state first - return 503 if unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    log.once('context-full-503', 'warn', '[api/context/full] Returning 503 - Supabase unreachable');
    return NextResponse.json(toApiError(cachedError), { status: 503 });
  }

  try {
    const result = await getActiveContext();

    // If getActiveContext returned an error indicating unreachable, return 503
    if (result.error && result.error.includes('Cannot connect to Supabase')) {
      return NextResponse.json(
        {
          ok: false,
          kind: 'SUPABASE_UNREACHABLE',
          message: result.error,
          context: result.context,
          availableWorkspaces: result.availableWorkspaces,
          availableClients: result.availableClients,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    log.error('[api/context/full] Unexpected error:', e);

    // Return safe fallback on error
    return NextResponse.json(
      {
        context: {
          workspaceId: null,
          workspaceName: null,
          clientId: null,
          clientName: null,
        },
        availableWorkspaces: [],
        availableClients: [],
        error: e instanceof Error ? e.message : 'Failed to get context',
      },
      { status: 500 }
    );
  }
}
