// ============================================
// Active Context Server Utility
// ============================================
// Marketing Laboratory v2.0: Multi-Project Switcher
//
// Reads workspace and client context from cookies.
// Provides fallback to first available workspace/client.
// Never throws; always returns a usable context object.
// ============================================

import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  normalizeSupabaseError,
  markSupabaseReachable,
  markSupabaseUnreachable,
  getSupabaseConnectivityError,
} from '@/lib/utils/supabaseError';

// ============================================
// Types
// ============================================

export interface ActiveContext {
  workspaceId: string | null;
  workspaceName: string | null;
  clientId: string | 'all' | null;
  clientName: string | null;
}

export interface ActiveContextResult {
  context: ActiveContext;
  availableWorkspaces: Array<{ id: string; name: string }>;
  availableClients: Array<{ id: string; name: string }>;
  error: string | null;
}

// Cookie names
export const COOKIE_WORKSPACE_ID = 'cm_workspace_id';
export const COOKIE_CLIENT_ID = 'cm_client_id';

// ============================================
// Main Function
// ============================================

/**
 * Gets the active workspace and client context from cookies.
 * Falls back to first available workspace/client if not set.
 * Never throws; returns null values if no data found.
 */
export async function getActiveContext(): Promise<ActiveContextResult> {
  const emptyResult: ActiveContextResult = {
    context: {
      workspaceId: null,
      workspaceName: null,
      clientId: null,
      clientName: null,
    },
    availableWorkspaces: [],
    availableClients: [],
    error: null,
  };

  // Check cached connectivity state - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return {
      ...emptyResult,
      error: `${cachedError.message}. ${cachedError.actionableHint.split('\n')[0]}`,
    };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient();

    // Read cookies (may be undefined)
    const cookieWorkspaceId = cookieStore.get(COOKIE_WORKSPACE_ID)?.value;
    const cookieClientId = cookieStore.get(COOKIE_CLIENT_ID)?.value;

    // Fetch available workspaces
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(20);

    if (workspaceError) {
      const normalized = normalizeSupabaseError(workspaceError);
      // Mark unreachable if connection error
      if (normalized.kind === 'SUPABASE_UNREACHABLE') {
        markSupabaseUnreachable(workspaceError);
      }
      // Graceful degradation for missing table
      if (normalized.kind === 'TABLE_NOT_FOUND') {
        return emptyResult;
      }
      return {
        ...emptyResult,
        error: `${normalized.message}. ${normalized.actionableHint.split('\n')[0]}`,
      };
    }

    // Success - mark as reachable
    markSupabaseReachable();

    const availableWorkspaces = workspaces || [];

    if (availableWorkspaces.length === 0) {
      return emptyResult;
    }

    // Determine active workspace
    let activeWorkspace = availableWorkspaces.find(w => w.id === cookieWorkspaceId);
    if (!activeWorkspace) {
      // Fallback to first workspace
      activeWorkspace = availableWorkspaces[0];
    }

    // Fetch clients for active workspace
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('workspace_id', activeWorkspace.id)
      .order('name', { ascending: true })
      .limit(50);

    if (clientError) {
      // Graceful degradation
      if (clientError.code?.startsWith('PGRST') || clientError.message?.includes('does not exist')) {
        return {
          context: {
            workspaceId: activeWorkspace.id,
            workspaceName: activeWorkspace.name,
            clientId: null,
            clientName: null,
          },
          availableWorkspaces,
          availableClients: [],
          error: null,
        };
      }
    }

    const availableClients = clients || [];

    // Determine active client
    let activeClientId: string | 'all' | null = null;
    let activeClientName: string | null = null;

    if (cookieClientId === 'all') {
      activeClientId = 'all';
      activeClientName = 'All Clients';
    } else if (cookieClientId) {
      const foundClient = availableClients.find(c => c.id === cookieClientId);
      if (foundClient) {
        activeClientId = foundClient.id;
        activeClientName = foundClient.name;
      } else if (availableClients.length > 0) {
        // Cookie client not found in this workspace, default to "all"
        activeClientId = 'all';
        activeClientName = 'All Clients';
      }
    } else if (availableClients.length > 0) {
      // No cookie set, default to "all"
      activeClientId = 'all';
      activeClientName = 'All Clients';
    }

    return {
      context: {
        workspaceId: activeWorkspace.id,
        workspaceName: activeWorkspace.name,
        clientId: activeClientId,
        clientName: activeClientName,
      },
      availableWorkspaces,
      availableClients,
      error: null,
    };
  } catch (e) {
    // Handle network-level errors gracefully
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
    }
    return {
      ...emptyResult,
      error: `${normalized.message}. ${normalized.actionableHint.split('\n')[0]}`,
    };
  }
}

/**
 * Lightweight version that only returns context IDs without fetching lists.
 * Useful for API routes that just need to know the current context.
 */
export async function getActiveContextIds(): Promise<{
  workspaceId: string | null;
  clientId: string | 'all' | null;
}> {
  // Check cached connectivity state - skip query if recently unreachable
  if (getSupabaseConnectivityError()) {
    return { workspaceId: null, clientId: null };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient();

    const cookieWorkspaceId = cookieStore.get(COOKIE_WORKSPACE_ID)?.value;
    const cookieClientId = cookieStore.get(COOKIE_CLIENT_ID)?.value;

    // If we have a workspace cookie, use it
    if (cookieWorkspaceId) {
      return {
        workspaceId: cookieWorkspaceId,
        clientId: cookieClientId || 'all',
      };
    }

    // Otherwise, get first workspace
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      const normalized = normalizeSupabaseError(error);
      if (normalized.kind === 'SUPABASE_UNREACHABLE') {
        markSupabaseUnreachable(error);
      }
      return { workspaceId: null, clientId: null };
    }

    markSupabaseReachable();

    if (!workspaces || workspaces.length === 0) {
      return { workspaceId: null, clientId: null };
    }

    return {
      workspaceId: workspaces[0].id,
      clientId: cookieClientId || 'all',
    };
  } catch (e) {
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
    }
    return { workspaceId: null, clientId: null };
  }
}
