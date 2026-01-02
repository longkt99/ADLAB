// ============================================
// AdLab Data Access Layer
// ============================================
// READ-ONLY queries for AdLab tables.
// PHASE D15: Workspace-scoped, filter-aware queries.
//
// SAFETY RULES:
// - Only SELECT queries
// - Always use try/catch with safe fallbacks
// - Small limits (50 rows max) to prevent performance issues
// - Return empty arrays on error, never throw to UI
// - All queries require workspace_id scoping
//
// NOTE: Uses raw Supabase client because database.types.ts
// has not been regenerated with the new AdLab tables yet.
//
// ============================================
// E2E Verify (One Command)
// ============================================
// In VS Code Terminal:
//   CMD:        npm run dev:e2e
//   PowerShell: npm.cmd run dev:e2e  (avoids npm.ps1 ExecutionPolicy)
//
// The script automatically:
// - Sets DEBUG_ADLAB_E2E=1
// - Finds available port (3000-3099, IPv6-aware)
// - Prints banner with baseUrl, port, supabaseHost
// - Auto-retries on EADDRINUSE
//
// Expected banner:
//   ╔══════════════════════════════════════════╗
//   ║  [E2E] Dev Server Starting               ║
//   ╠══════════════════════════════════════════╣
//   ║  DEBUG_ADLAB_E2E = 1 (CONFIRMED)         ║
//   ╚══════════════════════════════════════════╝
//     baseUrl       = http://localhost:<port>
//     supabaseHost  = 127.0.0.1:54321
//
// Browse to URLs shown in banner, then check terminal for:
//   [E2E] getOverviewCounts { supabaseHost: '127.0.0.1:54321', ... }
//   [E2E] getOverviewSummary { ... }
//
// ============================================

import 'server-only';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isE2ELogEnabled, shouldLogE2ERoute, logE2E, logE2EBanner } from '@/lib/log';

// Re-export types from client-safe types module for backwards compatibility.
// Server components that import from queries.ts will continue to work.
// Client components should import directly from @/lib/adlab/types.
export type {
  AdLabFilters,
  DateRange,



  AlertFilters,
  AdLabClient,
  AdLabCampaign,
  AdLabAdSet,
  AdLabAd,
  AdLabDailyMetric,
  AdLabDemographicMetric,
  AdLabAlert,
  AdLabReport,
  AdLabAlertRule,
  AdLabWorkspace,
  QueryResult,
  SingleResult,
  CountsResult,
  MutationResult,
  BulkMutationResult,
  AlertTrace,
  AlertTraceResult,
  OverviewSummary,
} from './types';

// Import types for internal use in this file
import type {
  AdLabFilters,
  DateRange,



  AlertFilters,
  AdLabClient,
  AdLabCampaign,
  AdLabAdSet,
  AdLabAd,
  AdLabDailyMetric,
  AdLabDemographicMetric,
  AdLabAlert,
  AdLabReport,
  AdLabAlertRule,
  AdLabWorkspace,
  QueryResult,
  SingleResult,
  CountsResult,
  MutationResult,
  BulkMutationResult,
  AlertTrace,
  AlertTraceResult,
  OverviewSummary,
} from './types';
import {
  normalizeSupabaseError,
  markSupabaseReachable,
  markSupabaseUnreachable,
  getSupabaseConnectivityError,
} from '@/lib/utils/supabaseError';

// Create a raw client without typed schema
// This is temporary until database.types.ts is regenerated
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ============================================
// Error Handling Helper
// ============================================
// Uses shared utility for consistent error handling across the app.

function normalizeErrorMessage(error: unknown): string {
  const normalized = normalizeSupabaseError(error);
  // Include actionable hint for connection errors
  if (normalized.kind === 'SUPABASE_UNREACHABLE') {
    return `${normalized.message}. ${normalized.actionableHint.split('\n')[0]}`;
  }
  return normalized.message;
}

// ============================================
// E2E Debug Logging (gated)
// ============================================
// Enable with DEBUG_ADLAB_E2E=1 in non-production only.
// Logs only safe info: host, workspaceId, clientId, date range, counts.
// NEVER logs keys/tokens.
//
// Environment variables:
//   DEBUG_ADLAB_E2E=1           - Enable E2E logging
//   DEBUG_ADLAB_E2E_DEDUPE_MS   - Dedupe window (default 1000ms)
//   DEBUG_ADLAB_E2E_ROUTES      - Comma-separated route filter (default '*')
//   DEBUG_ADLAB_E2E_AGG_MS      - Aggregation window (default 0 = disabled)

function isE2EDebugEnabled(): boolean {
  return isE2ELogEnabled();
}

function getSupabaseHost(): string {
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return 'invalid-url';
  }
}

// ============================================
// E2E Log Deduplication
// ============================================
// Prevents duplicate logs when page re-renders or parallel queries fire.
// Uses globalThis to survive HMR. Errors are never deduped.

interface E2EDedupeEntry {
  timestamp: number;
}

type E2EDedupeMap = Map<string, E2EDedupeEntry>;

function getDedupeMap(): E2EDedupeMap {
  const g = globalThis as unknown as { __cmE2EDedupeMap?: E2EDedupeMap };
  if (!g.__cmE2EDedupeMap) {
    g.__cmE2EDedupeMap = new Map();
  }
  return g.__cmE2EDedupeMap;
}

function getDedupeMs(): number {
  const envVal = process.env.DEBUG_ADLAB_E2E_DEDUPE_MS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return 1000; // Default 1 second
}

function cleanupDedupeMap(): void {
  const map = getDedupeMap();
  const now = Date.now();
  const maxAge = getDedupeMs() * 3; // Keep entries for 3x TTL before cleanup

  for (const [key, entry] of map) {
    if (now - entry.timestamp > maxAge) {
      map.delete(key);
    }
  }
}

function shouldLogE2E(route: string, filters: AdLabFilters, hasError: boolean): boolean {
  // Always log errors immediately
  if (hasError) return true;

  // Check route filter
  if (!shouldLogE2ERoute(route)) return false;

  const dedupeMs = getDedupeMs();
  if (dedupeMs === 0) return true; // Dedupe disabled

  const map = getDedupeMap();
  const key = `${route}|${filters.workspaceId}|${filters.clientId || ''}|${filters.from || ''}|${filters.to || ''}`;
  const now = Date.now();
  const existing = map.get(key);

  if (existing && (now - existing.timestamp) < dedupeMs) {
    // Duplicate within TTL, skip
    return false;
  }

  // Update timestamp
  map.set(key, { timestamp: now });

  // Periodic cleanup (every ~10 logs)
  if (map.size > 20) {
    cleanupDedupeMap();
  }

  return true;
}

function e2eLog(route: string, filters: AdLabFilters, result: { count: number; error?: string | null }) {
  if (!isE2EDebugEnabled()) return;

  const hasError = result.error != null;
  if (!shouldLogE2E(route, filters, hasError)) return;

  const pageKey = `${filters.workspaceId}|${filters.clientId || ''}|${filters.from || ''}|${filters.to || ''}`;
  const data = {
    supabaseHost: getSupabaseHost(),
    workspaceId: filters.workspaceId,
    clientId: filters.clientId || null,
    dateFrom: filters.from || null,
    dateTo: filters.to || null,
    rowsReturned: result.count,
    error: result.error || null,
  };

  // Use central logger with optional aggregation
  logE2E(route, data, pageKey);
}

// One-time E2E debug confirmation (survives HMR via globalThis flag)
// Prints exactly once when E2E debug is enabled, on first request.
// Shows confirmation with safe info only: NODE_ENV, supabaseHost, pid, baseUrl from headers.
// Never logs keys/tokens.
async function logE2EDebugOnce(): Promise<void> {
  if (!isE2EDebugEnabled()) return;
  const g = globalThis as unknown as { __cmE2EDebugLogged?: boolean };
  if (g.__cmE2EDebugLogged) return;
  g.__cmE2EDebugLogged = true;

  const nodeEnv = process.env.NODE_ENV || 'unknown';

  // Get real baseUrl from request headers (works in dev with auto-picked port)
  let baseUrl = '(unavailable)';
  try {
    const headersList = await headers();
    const host = headersList.get('host');
    if (host) {
      baseUrl = `http://${host}`;
    }
  } catch {
    // headers() not available outside request context - that's OK
  }

  logE2EBanner([
    '',
    '┌─────────────────────────────────────────────────────────┐',
    '│ [E2E] DEBUG_ADLAB_E2E confirmed in server process       │',
    '└─────────────────────────────────────────────────────────┘',
    `  supabaseHost = ${getSupabaseHost()}`,
    `  NODE_ENV     = ${nodeEnv}`,
    `  pid          = ${process.pid}`,
    `  baseUrl      = ${baseUrl}`,
    '',
  ]);
}

function createAdLabClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Helper Functions
// ============================================

// Helper to calculate date range from preset
export function getDateRangeFromPreset(range: '7d' | '14d' | '30d' | 'custom', customFrom?: string, customTo?: string): DateRange {
  if (range === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  const today = new Date();
  const to = today.toISOString().split('T')[0];

  let daysBack = 7;
  if (range === '14d') daysBack = 14;
  if (range === '30d') daysBack = 30;

  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - daysBack);
  const from = fromDate.toISOString().split('T')[0];

  return { from, to };
}

// ============================================
// Clients Queries
// ============================================

export async function getClients(
  filters: AdLabFilters,
  limit = 50
): Promise<QueryResult<AdLabClient>> {
  // Check connectivity cache - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return { data: [], error: cachedError.message, count: 0 };
  }

  try {
    const supabase = createAdLabClient();
    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId);

    // Client filter doesn't apply to clients list (it IS the clients)
    // But we can filter by specific client if provided
    if (filters.clientId) {
      query = query.eq('id', filters.clientId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message, count: 0 };
    }

    return { data: (data as AdLabClient[]) || [], error: null, count: count || 0 };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error', count: 0 };
  }
}

// ============================================
// Campaigns Queries
// ============================================

export async function getCampaigns(
  filters: AdLabFilters,
  limit = 50
): Promise<QueryResult<AdLabCampaign>> {
  try {
    const supabase = createAdLabClient();
    let query = supabase
      .from('campaigns')
      .select('*, clients(name)', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId);

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message, count: 0 };
    }

    // Map joined client name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join returns dynamic shape
    const mapped = (data || []).map((c: Record<string, any>) => ({
      ...c,
      client_name: c.clients?.name || null,
      clients: undefined,
    })) as unknown as AdLabCampaign[];

    return { data: mapped, error: null, count: count || 0 };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error', count: 0 };
  }
}

// ============================================
// Ad Sets Queries
// ============================================

export async function getAdSets(
  filters: AdLabFilters,
  limit = 50
): Promise<QueryResult<AdLabAdSet>> {
  try {
    const supabase = createAdLabClient();
    let query = supabase
      .from('ad_sets')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId);

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    const { data, error, count } = await query
      .order('first_seen_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message, count: 0 };
    }

    return { data: (data as AdLabAdSet[]) || [], error: null, count: count || 0 };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error', count: 0 };
  }
}

// ============================================
// Ads Queries
// ============================================

export async function getAds(
  filters: AdLabFilters,
  limit = 50
): Promise<QueryResult<AdLabAd>> {
  try {
    const supabase = createAdLabClient();
    let query = supabase
      .from('ads')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId);

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    const { data, error, count } = await query
      .order('first_seen_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message, count: 0 };
    }

    return { data: (data as AdLabAd[]) || [], error: null, count: count || 0 };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error', count: 0 };
  }
}

// ============================================
// Metrics Queries
// ============================================

export async function getDailyMetrics(
  filters: AdLabFilters,
  limit = 50
): Promise<QueryResult<AdLabDailyMetric>> {
  // Check connectivity cache - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return { data: [], error: cachedError.message, count: 0 };
  }

  try {
    const supabase = createAdLabClient();
    let query = supabase
      .from('daily_metrics')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId);

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    // Date range filter
    if (filters.from) {
      query = query.gte('date', filters.from);
    }
    if (filters.to) {
      query = query.lte('date', filters.to);
    }

    const { data, error, count } = await query
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      e2eLog('getDailyMetrics', filters, { count: 0, error: error.message });
      return { data: [], error: error.message, count: 0 };
    }

    const result = { data: (data as AdLabDailyMetric[]) || [], error: null, count: count || 0 };
    e2eLog('getDailyMetrics', filters, { count: result.count });
    return result;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    e2eLog('getDailyMetrics', filters, { count: 0, error: errorMsg });
    return { data: [], error: errorMsg, count: 0 };
  }
}

export async function getDemographicMetrics(
  filters: AdLabFilters,
  limit = 50
): Promise<QueryResult<AdLabDemographicMetric>> {
  try {
    const supabase = createAdLabClient();
    let query = supabase
      .from('demographic_metrics')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId);

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    // Date range filter
    if (filters.from) {
      query = query.gte('date', filters.from);
    }
    if (filters.to) {
      query = query.lte('date', filters.to);
    }

    const { data, error, count } = await query
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      e2eLog('getDemographicMetrics', filters, { count: 0, error: error.message });
      return { data: [], error: error.message, count: 0 };
    }

    const result = { data: (data as AdLabDemographicMetric[]) || [], error: null, count: count || 0 };
    e2eLog('getDemographicMetrics', filters, { count: result.count });
    return result;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    e2eLog('getDemographicMetrics', filters, { count: 0, error: errorMsg });
    return { data: [], error: errorMsg, count: 0 };
  }
}

// ============================================
// Alerts Queries
// ============================================

export async function getAlerts(
  filters: AdLabFilters,
  limit = 50
): Promise<QueryResult<AdLabAlert>> {
  // Check connectivity cache - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return { data: [], error: cachedError.message, count: 0 };
  }

  try {
    const supabase = createAdLabClient();
    let query = supabase
      .from('alerts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId);

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message, count: 0 };
    }

    return { data: (data as AdLabAlert[]) || [], error: null, count: count || 0 };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error', count: 0 };
  }
}

/**
 * Get alerts with filters (Phase D3.1 + D15)
 * Status filter logic:
 * - unread: is_read = false (regardless of resolved status)
 * - read: is_read = true AND resolved_at IS NULL (read but not resolved)
 * - resolved: resolved_at IS NOT NULL (resolved, regardless of read)
 * - all: no status constraint
 */
export async function getAlertsFiltered(
  workspaceFilters: AdLabFilters,
  alertFilters: AlertFilters,
  limit = 50
): Promise<QueryResult<AdLabAlert>> {
  // Check connectivity cache - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return { data: [], error: cachedError.message, count: 0 };
  }

  try {
    const supabase = createAdLabClient();
    let query = supabase
      .from('alerts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceFilters.workspaceId);

    // Apply client filter
    if (workspaceFilters.clientId) {
      query = query.eq('client_id', workspaceFilters.clientId);
    }

    // Apply status filter
    if (alertFilters.status && alertFilters.status !== 'all') {
      switch (alertFilters.status) {
        case 'unread':
          query = query.eq('is_read', false);
          break;
        case 'read':
          // Read but NOT resolved
          query = query.eq('is_read', true).is('resolved_at', null);
          break;
        case 'resolved':
          query = query.not('resolved_at', 'is', null);
          break;
      }
    }

    // Apply severity filter
    if (alertFilters.severity && alertFilters.severity !== 'all') {
      query = query.ilike('severity', alertFilters.severity);
    }

    // Apply platform filter
    if (alertFilters.platform && alertFilters.platform !== 'all') {
      query = query.ilike('platform', alertFilters.platform);
    }

    // Apply ordering and limit
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message, count: 0 };
    }

    return { data: (data as AdLabAlert[]) || [], error: null, count: count || 0 };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error', count: 0 };
  }
}

// ============================================
// Reports Queries
// ============================================

export async function getReports(
  filters: AdLabFilters,
  limit = 50
): Promise<QueryResult<AdLabReport>> {
  try {
    const supabase = createAdLabClient();
    let query = supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId);

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message, count: 0 };
    }

    return { data: (data as AdLabReport[]) || [], error: null, count: count || 0 };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error', count: 0 };
  }
}

// ============================================
// Alert Rules Queries
// ============================================

export async function getAlertRules(
  filters: AdLabFilters,
  limit = 50
): Promise<QueryResult<AdLabAlertRule>> {
  try {
    const supabase = createAdLabClient();
    let query = supabase
      .from('alert_rules')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId);

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message, count: 0 };
    }

    return { data: (data as AdLabAlertRule[]) || [], error: null, count: count || 0 };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error', count: 0 };
  }
}

// ============================================
// Single Alert Query
// ============================================

export async function getAlertById(id: string): Promise<SingleResult<AdLabAlert>> {
  try {
    const supabase = createAdLabClient();
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as AdLabAlert, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ============================================
// Alert Trace (full context for detail page)
// ============================================

export async function getAlertTrace(id: string): Promise<AlertTraceResult> {
  try {
    const supabase = createAdLabClient();

    // First, get the alert
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', id)
      .single();

    if (alertError || !alert) {
      return { data: null, error: alertError?.message || 'Alert not found' };
    }

    const typedAlert = alert as AdLabAlert;

    // Build trace object with defaults
    const trace: AlertTrace = {
      alert: typedAlert,
      rule: null,
      workspace: null,
      client: null,
      campaign: null,
      adSet: null,
      ad: null,
    };

    // Fetch related entities in parallel (only if IDs exist)
    const [ruleRes, workspaceRes, clientRes, campaignRes, adSetRes, adRes] = await Promise.all([
      // Rule
      typedAlert.rule_id
        ? supabase.from('alert_rules').select('*').eq('id', typedAlert.rule_id).single()
        : Promise.resolve({ data: null, error: null }),
      // Workspace
      typedAlert.workspace_id
        ? supabase.from('workspaces').select('id, name, created_at').eq('id', typedAlert.workspace_id).single()
        : Promise.resolve({ data: null, error: null }),
      // Client
      typedAlert.client_id
        ? supabase.from('clients').select('*').eq('id', typedAlert.client_id).single()
        : Promise.resolve({ data: null, error: null }),
      // Campaign
      typedAlert.campaign_id
        ? supabase.from('campaigns').select('*').eq('id', typedAlert.campaign_id).single()
        : Promise.resolve({ data: null, error: null }),
      // Ad Set
      typedAlert.ad_set_id
        ? supabase.from('ad_sets').select('*').eq('id', typedAlert.ad_set_id).single()
        : Promise.resolve({ data: null, error: null }),
      // Ad
      typedAlert.ad_id
        ? supabase.from('ads').select('*').eq('id', typedAlert.ad_id).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // Assign results (ignore individual errors, just leave null)
    if (ruleRes.data) trace.rule = ruleRes.data as AdLabAlertRule;
    if (workspaceRes.data) trace.workspace = workspaceRes.data as AdLabWorkspace;
    if (clientRes.data) trace.client = clientRes.data as AdLabClient;
    if (campaignRes.data) trace.campaign = campaignRes.data as AdLabCampaign;
    if (adSetRes.data) trace.adSet = adSetRes.data as AdLabAdSet;
    if (adRes.data) trace.ad = adRes.data as AdLabAd;

    return { data: trace, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ============================================
// Overview Counts (Aggregates)
// ============================================

export async function getOverviewCounts(filters: AdLabFilters): Promise<CountsResult> {
  // Log E2E debug confirmation once per server process (on first request)
  await logE2EDebugOnce();

  // Check cached connectivity state - skip query if recently unreachable
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    return {
      clients: 0,
      campaigns: 0,
      adSets: 0,
      ads: 0,
      unreadAlerts: 0,
      error: `${cachedError.message}. ${cachedError.actionableHint.split('\n')[0]}`,
    };
  }

  try {
    const supabase = createAdLabClient();

    // Build base queries with workspace scope
    const clientsQuery = supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', filters.workspaceId);

    const campaignsQuery = supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', filters.workspaceId);

    const adSetsQuery = supabase
      .from('ad_sets')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', filters.workspaceId);

    const adsQuery = supabase
      .from('ads')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', filters.workspaceId);

    const alertsQuery = supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', filters.workspaceId)
      .eq('is_read', false);

    // Apply client filter if provided
    if (filters.clientId) {
      // Note: clients query filters by id, others by client_id
      clientsQuery.eq('id', filters.clientId);
      campaignsQuery.eq('client_id', filters.clientId);
      adSetsQuery.eq('client_id', filters.clientId);
      adsQuery.eq('client_id', filters.clientId);
      alertsQuery.eq('client_id', filters.clientId);
    }

    // Run all count queries in parallel
    const [clientsRes, campaignsRes, adSetsRes, adsRes, alertsRes] = await Promise.all([
      clientsQuery,
      campaignsQuery,
      adSetsQuery,
      adsQuery,
      alertsQuery,
    ]);

    // Check for any errors
    const errors = [clientsRes.error, campaignsRes.error, adSetsRes.error, adsRes.error, alertsRes.error]
      .filter(Boolean)
      .map(e => e?.message);

    if (errors.length > 0) {
      e2eLog('getOverviewCounts', filters, { count: 0, error: errors.join('; ') });
      return {
        clients: 0,
        campaigns: 0,
        adSets: 0,
        ads: 0,
        unreadAlerts: 0,
        error: errors.join('; '),
      };
    }

    // Success - mark Supabase as reachable
    markSupabaseReachable();

    const result = {
      clients: clientsRes.count || 0,
      campaigns: campaignsRes.count || 0,
      adSets: adSetsRes.count || 0,
      ads: adsRes.count || 0,
      unreadAlerts: alertsRes.count || 0,
      error: null,
    };

    // E2E log with total entity count (uses central logger with aggregation support)
    if (isE2EDebugEnabled()) {
      const pageKey = `${filters.workspaceId}|${filters.clientId || ''}|${filters.from || ''}|${filters.to || ''}`;
      logE2E('getOverviewCounts', {
        supabaseHost: getSupabaseHost(),
        workspaceId: filters.workspaceId,
        clientId: filters.clientId || null,
        counts: result,
      }, pageKey);
    }

    return result;
  } catch (e) {
    // Mark unreachable if connection error
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
    }
    const errorMsg = normalizeErrorMessage(e);
    e2eLog('getOverviewCounts', filters, { count: 0, error: errorMsg });
    return {
      clients: 0,
      campaigns: 0,
      adSets: 0,
      ads: 0,
      unreadAlerts: 0,
      error: errorMsg,
    };
  }
}

// ============================================
// Overview Summary (Metrics Aggregates)
// ============================================

export async function getOverviewSummary(filters: AdLabFilters): Promise<OverviewSummary> {
  const emptyResult: OverviewSummary = {
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    avgCtr: 0,
    avgCpc: 0,
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
    const supabase = createAdLabClient();
    let query = supabase
      .from('daily_metrics')
      .select('spend, impressions, clicks, conversions')
      .eq('workspace_id', filters.workspaceId);

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    if (filters.from) {
      query = query.gte('date', filters.from);
    }
    if (filters.to) {
      query = query.lte('date', filters.to);
    }

    const { data, error } = await query.limit(1000);

    if (error) {
      e2eLog('getOverviewSummary', filters, { count: 0, error: error.message });
      return { ...emptyResult, error: error.message };
    }

    if (!data || data.length === 0) {
      e2eLog('getOverviewSummary', filters, { count: 0 });
      return emptyResult;
    }

    // Calculate totals
    const totalSpend = data.reduce((sum, row) => sum + (row.spend || 0), 0);
    const totalImpressions = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
    const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
    const totalConversions = data.reduce((sum, row) => sum + (row.conversions || 0), 0);

    // Calculate averages
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    // E2E log with summary (uses central logger with aggregation support)
    if (isE2EDebugEnabled()) {
      const pageKey = `${filters.workspaceId}|${filters.clientId || ''}|${filters.from || ''}|${filters.to || ''}`;
      logE2E('getOverviewSummary', {
        supabaseHost: getSupabaseHost(),
        workspaceId: filters.workspaceId,
        clientId: filters.clientId || null,
        dateFrom: filters.from || null,
        dateTo: filters.to || null,
        rowsAggregated: data.length,
        summary: { totalSpend, totalImpressions, totalClicks, totalConversions },
      }, pageKey);
    }

    // Success - mark Supabase as reachable
    markSupabaseReachable();

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      avgCtr,
      avgCpc,
      error: null,
    };
  } catch (e) {
    // Mark unreachable if connection error
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
    }
    const errorMsg = normalizeErrorMessage(e);
    e2eLog('getOverviewSummary', filters, { count: 0, error: errorMsg });
    return {
      ...emptyResult,
      error: errorMsg,
    };
  }
}

// ============================================
// Alert Mutations (Phase D1)
// ============================================

/**
 * Mark an alert as read or unread
 */
export async function markAlertRead(id: string, isRead: boolean): Promise<MutationResult> {
  try {
    const supabase = createAdLabClient();
    const { error } = await supabase
      .from('alerts')
      .update({
        is_read: isRead,
        read_at: isRead ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Toggle alert resolved status
 * When resolving: auto-marks as read if not already read
 * When un-resolving: does NOT modify read status
 */
export async function toggleAlertResolved(id: string, resolved: boolean): Promise<MutationResult> {
  try {
    const supabase = createAdLabClient();
    const now = new Date().toISOString();

    if (resolved) {
      // When resolving: check if alert is unread, auto-mark as read
      const { data: alert } = await supabase
        .from('alerts')
        .select('read_at')
        .eq('id', id)
        .single();

      const updatePayload: Record<string, unknown> = {
        resolved_at: now,
        updated_at: now,
      };

      // Auto-mark as read if not already read
      if (!alert?.read_at) {
        updatePayload.is_read = true;
        updatePayload.read_at = now;
      }

      const { error } = await supabase
        .from('alerts')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }
    } else {
      // When un-resolving: only clear resolved_at, do NOT touch read status
      const { error } = await supabase
        .from('alerts')
        .update({
          resolved_at: null,
          updated_at: now,
        })
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Update alert internal note
 */
export async function updateAlertNote(id: string, note: string): Promise<MutationResult> {
  try {
    const supabase = createAdLabClient();
    const { error } = await supabase
      .from('alerts')
      .update({
        note: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ============================================
// Bulk Alert Mutations (Phase D2)
// ============================================

/**
 * Bulk mark alerts as read
 */
export async function bulkMarkRead(ids: string[]): Promise<BulkMutationResult> {
  if (ids.length === 0) return { success: true, affected: 0, error: null };

  try {
    const supabase = createAdLabClient();
    const now = new Date().toISOString();

    const { error, count } = await supabase
      .from('alerts')
      .update({
        is_read: true,
        read_at: now,
        updated_at: now,
      })
      .in('id', ids);

    if (error) {
      return { success: false, affected: 0, error: error.message };
    }

    return { success: true, affected: count || ids.length, error: null };
  } catch (e) {
    return { success: false, affected: 0, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Bulk mark alerts as unread
 */
export async function bulkMarkUnread(ids: string[]): Promise<BulkMutationResult> {
  if (ids.length === 0) return { success: true, affected: 0, error: null };

  try {
    const supabase = createAdLabClient();
    const now = new Date().toISOString();

    const { error, count } = await supabase
      .from('alerts')
      .update({
        is_read: false,
        read_at: null,
        updated_at: now,
      })
      .in('id', ids);

    if (error) {
      return { success: false, affected: 0, error: error.message };
    }

    return { success: true, affected: count || ids.length, error: null };
  } catch (e) {
    return { success: false, affected: 0, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Bulk resolve alerts (also marks unread alerts as read)
 */
export async function bulkResolve(ids: string[]): Promise<BulkMutationResult> {
  if (ids.length === 0) return { success: true, affected: 0, error: null };

  try {
    const supabase = createAdLabClient();
    const now = new Date().toISOString();

    // Resolve all and mark as read (consistent with single-alert behavior)
    const { error, count } = await supabase
      .from('alerts')
      .update({
        resolved_at: now,
        is_read: true,
        read_at: now,
        updated_at: now,
      })
      .in('id', ids);

    if (error) {
      return { success: false, affected: 0, error: error.message };
    }

    return { success: true, affected: count || ids.length, error: null };
  } catch (e) {
    return { success: false, affected: 0, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Bulk reopen alerts (does NOT modify read status, consistent with single-alert behavior)
 */
export async function bulkReopen(ids: string[]): Promise<BulkMutationResult> {
  if (ids.length === 0) return { success: true, affected: 0, error: null };

  try {
    const supabase = createAdLabClient();
    const now = new Date().toISOString();

    const { error, count } = await supabase
      .from('alerts')
      .update({
        resolved_at: null,
        updated_at: now,
      })
      .in('id', ids);

    if (error) {
      return { success: false, affected: 0, error: error.message };
    }

    return { success: true, affected: count || ids.length, error: null };
  } catch (e) {
    return { success: false, affected: 0, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
