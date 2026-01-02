// ============================================
// AdLab Page Helpers
// ============================================
// Shared utilities for AdLab pages.
// Handles workspace resolution and filter parsing.
// SERVER-ONLY: This file uses server-side Supabase client.

import 'server-only';
import { resolveWorkspace, getWorkspaceClients } from '@/lib/supabase/server';
import { getDateRangeFromPreset, type AdLabFilters } from './queries';

// ============================================
// Types
// ============================================

export interface PageContext {
  workspace: { id: string; name: string };
  clients: Array<{ id: string; name: string }>;
  filters: AdLabFilters;
  error: string | null;
}

export interface PageContextResult {
  context: PageContext | null;
  noWorkspace: boolean;
  error: string | null;
}

// ============================================
// Filter Parsing
// ============================================

export type DateRangePreset = '7d' | '14d' | '30d' | 'custom';

export interface ParsedParams {
  clientId: string | null;
  range: DateRangePreset;
  from: string | null;
  to: string | null;
}

export function parseAdLabParams(
  params: Record<string, string | string[] | undefined>
): ParsedParams {
  const clientId = params.client as string | undefined;
  const range = (params.range as DateRangePreset) || '7d';
  const customFrom = params.from as string | undefined;
  const customTo = params.to as string | undefined;

  return {
    clientId: clientId && clientId !== 'all' ? clientId : null,
    range,
    from: customFrom || null,
    to: customTo || null,
  };
}

// ============================================
// Page Context Resolution
// ============================================

/**
 * Resolves full page context including workspace, clients, and filters.
 * Use this at the top of each AdLab page.
 */
export async function getAdLabPageContext(
  params: Record<string, string | string[] | undefined>
): Promise<PageContextResult> {
  // Resolve workspace
  const { workspace, error: workspaceError } = await resolveWorkspace();

  if (!workspace) {
    return {
      context: null,
      noWorkspace: true,
      error: workspaceError,
    };
  }

  // Parse URL params
  const parsed = parseAdLabParams(params);

  // Calculate date range
  const dateRange = getDateRangeFromPreset(
    parsed.range,
    parsed.from || undefined,
    parsed.to || undefined
  );

  // Fetch clients for the workspace
  const { clients } = await getWorkspaceClients(workspace.id);

  // Build filters
  const filters: AdLabFilters = {
    workspaceId: workspace.id,
    clientId: parsed.clientId,
    from: dateRange.from,
    to: dateRange.to,
  };

  return {
    context: {
      workspace,
      clients,
      filters,
      error: null,
    },
    noWorkspace: false,
    error: null,
  };
}
