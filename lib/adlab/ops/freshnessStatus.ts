// ============================================
// AdLab Freshness Status Resolver
// ============================================
// PHASE D28: Data Freshness Truth + Staleness Controls.
// PHASE D29: Workspace-level config overrides integration.
//
// RESOLVES:
// - Last successful ingestion per dataset
// - Computed freshness status
// - Workspace-wide freshness map
//
// INVARIANTS:
// - Workspace-scoped queries only
// - NO_INGESTION = FAIL status
// - Uses existing ingestion log queries (SELECT only)
// - D29: Workspace overrides take precedence over defaults
// ============================================

import { createClient } from '@supabase/supabase-js';
import {
  type DatasetKey,
  type FreshnessStatus,
  type FreshnessPolicy,
  ALL_DATASET_KEYS,
  getFreshnessPolicy,
  computeFreshnessStatus,
} from './freshnessPolicy';
import { getFreshnessOverrides } from './configOverrides';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

export interface LastIngestionRecord {
  dataset: DatasetKey;
  platform: string;
  lastIngestedAt: string | null;
  logId: string | null;
  status: string | null;
}

export interface DatasetFreshnessResult {
  dataset: DatasetKey;
  platform: string;
  freshness: FreshnessStatus;
  policy: {
    warnAfterMinutes: number;
    failAfterMinutes: number;
    critical: boolean;
  };
}

export interface WorkspaceFreshnessMap {
  workspaceId: string;
  platform: string;
  clientId: string | null;
  timestamp: string;
  datasets: DatasetFreshnessResult[];
  summary: {
    total: number;
    fresh: number;
    warn: number;
    fail: number;
    criticalFail: number;
  };
}

// ============================================
// Supabase Client
// ============================================

function createFreshnessClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Ingestion Lookup
// ============================================

/**
 * Gets the last successful ingestion for a specific dataset.
 *
 * "Successful" means status is 'pass' or 'warn' (validated/promoted).
 * Optionally filters by promoted_at to only count promoted data.
 */
export async function getLastSuccessfulIngestion(
  workspaceId: string,
  platform: string,
  dataset: DatasetKey,
  clientId?: string | null
): Promise<LastIngestionRecord> {
  try {
    const supabase = createFreshnessClient();

    let query = supabase
      .from('adlab_ingestion_logs')
      .select('id, dataset, platform, created_at, status, promoted_at')
      .eq('workspace_id', workspaceId)
      .eq('platform', platform)
      .eq('dataset', dataset)
      .in('status', ['pass', 'warn']);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    // Prefer promoted data, fall back to validated
    const { data, error } = await query
      .order('promoted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return {
        dataset,
        platform,
        lastIngestedAt: null,
        logId: null,
        status: null,
      };
    }

    // Use promoted_at if available, otherwise created_at
    const lastIngestedAt = data.promoted_at || data.created_at;

    return {
      dataset,
      platform,
      lastIngestedAt,
      logId: data.id,
      status: data.status,
    };
  } catch {
    return {
      dataset,
      platform,
      lastIngestedAt: null,
      logId: null,
      status: null,
    };
  }
}

/**
 * Gets the freshness status for a specific dataset.
 *
 * D29: Applies workspace-level overrides if present.
 * Priority: workspace override > env override > default
 */
export async function getDatasetFreshness(
  workspaceId: string,
  platform: string,
  dataset: DatasetKey,
  clientId?: string | null,
  now: number = Date.now()
): Promise<DatasetFreshnessResult> {
  const ingestion = await getLastSuccessfulIngestion(
    workspaceId,
    platform,
    dataset,
    clientId
  );

  // Get base policy (with env overrides)
  const basePolicy = getFreshnessPolicy(dataset);

  // D29: Apply workspace-level overrides
  const effectivePolicy: FreshnessPolicy = { ...basePolicy };
  try {
    const overrides = await getFreshnessOverrides(workspaceId, dataset);
    if (overrides.warnMinutes !== null) {
      effectivePolicy.warnAfterMinutes = overrides.warnMinutes;
    }
    if (overrides.failMinutes !== null) {
      effectivePolicy.failAfterMinutes = overrides.failMinutes;
    }
  } catch {
    // Fail open: use base policy if override lookup fails
    console.warn(`D29: Failed to fetch freshness overrides for ${dataset}, using defaults`);
  }

  const freshness = computeFreshnessStatus(ingestion.lastIngestedAt, effectivePolicy, now);

  return {
    dataset,
    platform,
    freshness,
    policy: {
      warnAfterMinutes: effectivePolicy.warnAfterMinutes,
      failAfterMinutes: effectivePolicy.failAfterMinutes,
      critical: effectivePolicy.critical,
    },
  };
}

/**
 * Gets freshness status for all datasets in a workspace.
 */
export async function getWorkspaceFreshnessMap(
  workspaceId: string,
  platform: string,
  clientId?: string | null,
  now: number = Date.now()
): Promise<WorkspaceFreshnessMap> {
  const datasets: DatasetFreshnessResult[] = [];

  // Check all datasets in parallel
  const results = await Promise.all(
    ALL_DATASET_KEYS.map((dataset) =>
      getDatasetFreshness(workspaceId, platform, dataset, clientId, now)
    )
  );

  datasets.push(...results);

  // Calculate summary
  const summary = {
    total: datasets.length,
    fresh: 0,
    warn: 0,
    fail: 0,
    criticalFail: 0,
  };

  for (const result of datasets) {
    switch (result.freshness.status) {
      case 'fresh':
        summary.fresh++;
        break;
      case 'warn':
        summary.warn++;
        break;
      case 'fail':
        summary.fail++;
        if (result.policy.critical) {
          summary.criticalFail++;
        }
        break;
    }
  }

  return {
    workspaceId,
    platform,
    clientId: clientId || null,
    timestamp: new Date().toISOString(),
    datasets,
    summary,
  };
}

/**
 * Quick check: Are there any critical freshness failures?
 */
export async function hasCriticalFreshnessFailure(
  workspaceId: string,
  platform: string,
  clientId?: string | null
): Promise<{ hasFail: boolean; failedDatasets: DatasetKey[] }> {
  const map = await getWorkspaceFreshnessMap(workspaceId, platform, clientId);

  const failedDatasets = map.datasets
    .filter((d) => d.freshness.status === 'fail' && d.policy.critical)
    .map((d) => d.dataset);

  return {
    hasFail: failedDatasets.length > 0,
    failedDatasets,
  };
}

/**
 * Gets freshness status for display purposes (simplified).
 */
export async function getFreshnessDisplayStatus(
  workspaceId: string,
  platform: string,
  clientId?: string | null
): Promise<{
  overallStatus: 'fresh' | 'warn' | 'fail';
  message: string;
  datasets: Array<{
    dataset: DatasetKey;
    status: 'fresh' | 'warn' | 'fail';
    ageMinutes: number;
    critical: boolean;
  }>;
}> {
  const map = await getWorkspaceFreshnessMap(workspaceId, platform, clientId);

  let overallStatus: 'fresh' | 'warn' | 'fail' = 'fresh';
  let message = 'All datasets are fresh';

  if (map.summary.criticalFail > 0) {
    overallStatus = 'fail';
    message = `${map.summary.criticalFail} critical dataset(s) stale beyond safe limit`;
  } else if (map.summary.fail > 0) {
    overallStatus = 'warn';
    message = `${map.summary.fail} dataset(s) stale beyond safe limit`;
  } else if (map.summary.warn > 0) {
    overallStatus = 'warn';
    message = `${map.summary.warn} dataset(s) approaching staleness`;
  }

  return {
    overallStatus,
    message,
    datasets: map.datasets.map((d) => ({
      dataset: d.dataset,
      status: d.freshness.status,
      ageMinutes: d.freshness.ageMinutes,
      critical: d.policy.critical,
    })),
  };
}
