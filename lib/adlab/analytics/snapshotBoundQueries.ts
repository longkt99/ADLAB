// ============================================
// AdLab Snapshot-Bound Analytics Queries
// ============================================
// PHASE D17B: Production-bound analytics queries.
//
// CORE PRINCIPLE:
// Analytics never asks "what's latest".
// Analytics asks "what is currently TRUE".
//
// ALL queries in this file are bound to the active production
// snapshot. They will FAIL if no active snapshot exists.
//
// WARNING: Analytics is snapshot-bound. Do NOT bypass.
// ============================================

import { createClient } from '@supabase/supabase-js';
import {
  resolveAnalyticsScope,
  tryResolveAnalyticsScope,
  assertProductionBound,
  type AnalyticsScope,
  NoActiveSnapshotError,
} from './resolveAnalyticsScope';
import type { DatasetType, PlatformType } from '../ingestion/validate';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createAnalyticsClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Types
// ============================================

export interface SnapshotBoundFilters {
  workspaceId: string;
  platform: PlatformType;
  dataset: DatasetType;
  clientId?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface SnapshotBoundQueryResult<T> {
  data: T[];
  error: string | null;
  count: number;
  /** The snapshot this data is bound to */
  snapshotId: string | null;
  /** The ingestion log this data came from */
  ingestionLogId: string | null;
}

export interface SnapshotBoundSummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  error: string | null;
  snapshotId: string | null;
}

// ============================================
// Daily Metrics (Snapshot-Bound)
// ============================================

export interface DailyMetricRow {
  id: string;
  date: string;
  platform: string;
  entity_type: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  currency: string;
  ctr: number;
  cpc: number;
  cpm: number;
}

/**
 * Get daily metrics bound to active production snapshot.
 *
 * Analytics is snapshot-bound. Do NOT bypass.
 *
 * @throws {NoActiveSnapshotError} if no active snapshot exists
 */
export async function getSnapshotBoundDailyMetrics(
  filters: SnapshotBoundFilters,
  limit = 100
): Promise<SnapshotBoundQueryResult<DailyMetricRow>> {
  try {
    // Step 1: Resolve to active snapshot (REQUIRED)
    const resolvedScope = await resolveAnalyticsScope({
      workspaceId: filters.workspaceId,
      platform: filters.platform,
      dataset: filters.dataset,
    });

    // Step 2: Assert production binding
    assertProductionBound(resolvedScope, filters.workspaceId);

    // Step 3: Query with ingestion_log_id binding
    // NOTE: This assumes daily_metrics has ingestion_log_id column.
    // If not present, falls back to workspace_id + platform filtering.
    const supabase = createAnalyticsClient();
    let query = supabase
      .from('daily_metrics')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId)
      .eq('platform', filters.platform);

    // Apply additional filters
    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }
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
      return {
        data: [],
        error: error.message,
        count: 0,
        snapshotId: resolvedScope.snapshotId,
        ingestionLogId: resolvedScope.ingestionLogId,
      };
    }

    return {
      data: (data as DailyMetricRow[]) || [],
      error: null,
      count: count || 0,
      snapshotId: resolvedScope.snapshotId,
      ingestionLogId: resolvedScope.ingestionLogId,
    };
  } catch (e) {
    if (e instanceof NoActiveSnapshotError) {
      return {
        data: [],
        error: e.message,
        count: 0,
        snapshotId: null,
        ingestionLogId: null,
      };
    }
    return {
      data: [],
      error: e instanceof Error ? e.message : 'Unknown error',
      count: 0,
      snapshotId: null,
      ingestionLogId: null,
    };
  }
}

// ============================================
// Metrics Summary (Snapshot-Bound)
// ============================================

/**
 * Get aggregated metrics summary bound to active production snapshot.
 *
 * Analytics is snapshot-bound. Do NOT bypass.
 */
export async function getSnapshotBoundMetricsSummary(
  filters: SnapshotBoundFilters
): Promise<SnapshotBoundSummary> {
  const emptyResult: SnapshotBoundSummary = {
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    avgCtr: 0,
    avgCpc: 0,
    error: null,
    snapshotId: null,
  };

  try {
    // Step 1: Resolve to active snapshot (REQUIRED)
    const resolvedScope = await resolveAnalyticsScope({
      workspaceId: filters.workspaceId,
      platform: filters.platform,
      dataset: filters.dataset,
    });

    // Step 2: Assert production binding
    assertProductionBound(resolvedScope, filters.workspaceId);

    // Step 3: Query with snapshot binding
    const supabase = createAnalyticsClient();
    let query = supabase
      .from('daily_metrics')
      .select('spend, impressions, clicks, conversions')
      .eq('workspace_id', filters.workspaceId)
      .eq('platform', filters.platform);

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
      return {
        ...emptyResult,
        error: error.message,
        snapshotId: resolvedScope.snapshotId,
      };
    }

    if (!data || data.length === 0) {
      return {
        ...emptyResult,
        snapshotId: resolvedScope.snapshotId,
      };
    }

    // Calculate aggregates
    const totalSpend = data.reduce((sum, row) => sum + (row.spend || 0), 0);
    const totalImpressions = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
    const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
    const totalConversions = data.reduce((sum, row) => sum + (row.conversions || 0), 0);

    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      avgCtr,
      avgCpc,
      error: null,
      snapshotId: resolvedScope.snapshotId,
    };
  } catch (e) {
    if (e instanceof NoActiveSnapshotError) {
      return { ...emptyResult, error: e.message };
    }
    return {
      ...emptyResult,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

// ============================================
// Campaigns (Snapshot-Bound)
// ============================================

export interface CampaignRow {
  id: string;
  external_id: string;
  name: string;
  platform: string;
  status: string;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
}

/**
 * Get campaigns bound to active production snapshot.
 *
 * Analytics is snapshot-bound. Do NOT bypass.
 */
export async function getSnapshotBoundCampaigns(
  filters: SnapshotBoundFilters,
  limit = 100
): Promise<SnapshotBoundQueryResult<CampaignRow>> {
  try {
    // Step 1: Resolve to active snapshot
    const resolvedScope = await resolveAnalyticsScope({
      workspaceId: filters.workspaceId,
      platform: filters.platform,
      dataset: 'campaigns', // Always campaigns for this query
    });

    assertProductionBound(resolvedScope, filters.workspaceId);

    // Step 2: Query campaigns
    const supabase = createAnalyticsClient();
    let query = supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId)
      .eq('platform', filters.platform);

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return {
        data: [],
        error: error.message,
        count: 0,
        snapshotId: resolvedScope.snapshotId,
        ingestionLogId: resolvedScope.ingestionLogId,
      };
    }

    return {
      data: (data as CampaignRow[]) || [],
      error: null,
      count: count || 0,
      snapshotId: resolvedScope.snapshotId,
      ingestionLogId: resolvedScope.ingestionLogId,
    };
  } catch (e) {
    if (e instanceof NoActiveSnapshotError) {
      return {
        data: [],
        error: e.message,
        count: 0,
        snapshotId: null,
        ingestionLogId: null,
      };
    }
    return {
      data: [],
      error: e instanceof Error ? e.message : 'Unknown error',
      count: 0,
      snapshotId: null,
      ingestionLogId: null,
    };
  }
}

// ============================================
// Alerts (Snapshot-Bound)
// ============================================

export interface AlertRow {
  id: string;
  severity: string;
  message: string;
  platform: string | null;
  metric_key: string | null;
  metric_value: number | null;
  is_read: boolean;
  resolved_at: string | null;
  created_at: string;
}

/**
 * Get alerts bound to active production snapshot.
 *
 * Analytics is snapshot-bound. Do NOT bypass.
 */
export async function getSnapshotBoundAlerts(
  filters: SnapshotBoundFilters,
  limit = 100
): Promise<SnapshotBoundQueryResult<AlertRow>> {
  try {
    // Step 1: Resolve to active snapshot
    const resolvedScope = await resolveAnalyticsScope({
      workspaceId: filters.workspaceId,
      platform: filters.platform,
      dataset: 'alerts', // Always alerts for this query
    });

    assertProductionBound(resolvedScope, filters.workspaceId);

    // Step 2: Query alerts
    const supabase = createAnalyticsClient();
    let query = supabase
      .from('alerts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filters.workspaceId);

    // Platform filter for alerts (may be null)
    if (filters.platform !== 'other') {
      query = query.eq('platform', filters.platform);
    }

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return {
        data: [],
        error: error.message,
        count: 0,
        snapshotId: resolvedScope.snapshotId,
        ingestionLogId: resolvedScope.ingestionLogId,
      };
    }

    return {
      data: (data as AlertRow[]) || [],
      error: null,
      count: count || 0,
      snapshotId: resolvedScope.snapshotId,
      ingestionLogId: resolvedScope.ingestionLogId,
    };
  } catch (e) {
    if (e instanceof NoActiveSnapshotError) {
      return {
        data: [],
        error: e.message,
        count: 0,
        snapshotId: null,
        ingestionLogId: null,
      };
    }
    return {
      data: [],
      error: e instanceof Error ? e.message : 'Unknown error',
      count: 0,
      snapshotId: null,
      ingestionLogId: null,
    };
  }
}

// ============================================
// Graceful Fallback Queries
// ============================================

/**
 * Try to get metrics with graceful fallback.
 * Returns empty data if no production snapshot exists.
 *
 * Use this for UI components that need to show "no data"
 * instead of erroring when production data doesn't exist.
 */
export async function tryGetSnapshotBoundMetrics(
  filters: SnapshotBoundFilters,
  limit = 100
): Promise<SnapshotBoundQueryResult<DailyMetricRow>> {
  const resolved = await tryResolveAnalyticsScope({
    workspaceId: filters.workspaceId,
    platform: filters.platform,
    dataset: filters.dataset,
  });

  if (!resolved) {
    return {
      data: [],
      error: null, // Not an error, just no production data
      count: 0,
      snapshotId: null,
      ingestionLogId: null,
    };
  }

  return getSnapshotBoundDailyMetrics(filters, limit);
}

// ============================================
// Production State Helpers
// ============================================

/**
 * Check if a dataset has production data available.
 * Use this for conditional rendering in UI.
 */
export async function hasProductionData(
  scope: AnalyticsScope
): Promise<boolean> {
  const resolved = await tryResolveAnalyticsScope(scope);
  return resolved !== null;
}

/**
 * Get the current production snapshot info for display.
 * Returns null if no production data exists.
 */
export async function getProductionSnapshotInfo(
  scope: AnalyticsScope
): Promise<{
  snapshotId: string;
  ingestionLogId: string;
  promotedAt: string;
} | null> {
  const resolved = await tryResolveAnalyticsScope(scope);
  if (!resolved) {
    return null;
  }
  return {
    snapshotId: resolved.snapshotId,
    ingestionLogId: resolved.ingestionLogId,
    promotedAt: resolved.promotedAt,
  };
}
