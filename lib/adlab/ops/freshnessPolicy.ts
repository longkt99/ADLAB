// ============================================
// AdLab Freshness Policy
// ============================================
// PHASE D28: Data Freshness Truth + Staleness Controls.
//
// DEFINES:
// - DatasetKey union
// - FreshnessPolicy structure
// - Default policies per dataset
// - Pure computation helpers
//
// INVARIANTS:
// - No timezone bugs: use Date.now() and ISO timestamps
// - No throwing inside pure helpers
// - All comparisons in UTC
// ============================================

// ============================================
// Types
// ============================================

/** Supported dataset keys for freshness tracking */
export type DatasetKey =
  | 'campaigns'
  | 'ad_sets'
  | 'ads'
  | 'daily_metrics'
  | 'alerts';

/** Freshness status result */
export type FreshnessStatusValue = 'fresh' | 'warn' | 'fail';

/** Freshness policy for a dataset */
export interface FreshnessPolicy {
  dataset: DatasetKey;
  warnAfterMinutes: number;
  failAfterMinutes: number;
  critical: boolean;
  description: string;
}

/** Computed freshness status */
export interface FreshnessStatus {
  status: FreshnessStatusValue;
  ageMinutes: number;
  warnAtMinutes: number;
  failAtMinutes: number;
  lastIngestedAt: string | null;
  reason?: string;
}

// ============================================
// Default Policies
// ============================================

const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = 24 * MINUTES_IN_HOUR;

/**
 * Default freshness policies per dataset.
 *
 * - daily_metrics: warn 24h, fail 72h, critical=true
 * - campaigns: warn 72h, fail 168h (7 days), critical=true
 * - ad_sets: warn 72h, fail 168h (7 days), critical=true
 * - ads: warn 72h, fail 168h (7 days), critical=true
 * - alerts: warn 24h, fail 72h, critical=false
 */
export const DEFAULT_FRESHNESS_POLICIES: Record<DatasetKey, FreshnessPolicy> = {
  daily_metrics: {
    dataset: 'daily_metrics',
    warnAfterMinutes: 24 * MINUTES_IN_HOUR, // 24 hours
    failAfterMinutes: 72 * MINUTES_IN_HOUR, // 72 hours (3 days)
    critical: true,
    description: 'Daily performance metrics',
  },
  campaigns: {
    dataset: 'campaigns',
    warnAfterMinutes: 72 * MINUTES_IN_HOUR, // 72 hours (3 days)
    failAfterMinutes: 168 * MINUTES_IN_HOUR, // 168 hours (7 days)
    critical: true,
    description: 'Campaign configuration and status',
  },
  ad_sets: {
    dataset: 'ad_sets',
    warnAfterMinutes: 72 * MINUTES_IN_HOUR, // 72 hours (3 days)
    failAfterMinutes: 168 * MINUTES_IN_HOUR, // 168 hours (7 days)
    critical: true,
    description: 'Ad set configuration and targeting',
  },
  ads: {
    dataset: 'ads',
    warnAfterMinutes: 72 * MINUTES_IN_HOUR, // 72 hours (3 days)
    failAfterMinutes: 168 * MINUTES_IN_HOUR, // 168 hours (7 days)
    critical: true,
    description: 'Individual ad creatives and status',
  },
  alerts: {
    dataset: 'alerts',
    warnAfterMinutes: 24 * MINUTES_IN_HOUR, // 24 hours
    failAfterMinutes: 72 * MINUTES_IN_HOUR, // 72 hours (3 days)
    critical: false,
    description: 'Alert rules and notifications',
  },
};

/** All dataset keys */
export const ALL_DATASET_KEYS: DatasetKey[] = [
  'daily_metrics',
  'campaigns',
  'ad_sets',
  'ads',
  'alerts',
];

/** Critical dataset keys */
export const CRITICAL_DATASET_KEYS: DatasetKey[] = ALL_DATASET_KEYS.filter(
  (key) => DEFAULT_FRESHNESS_POLICIES[key].critical
);

// ============================================
// Environment Overrides
// ============================================

/**
 * Gets the freshness policy for a dataset, with optional env overrides.
 *
 * Environment variables (optional):
 * - ADLAB_FRESHNESS_WARN_MINUTES_<DATASET> (e.g., ADLAB_FRESHNESS_WARN_MINUTES_DAILY_METRICS)
 * - ADLAB_FRESHNESS_FAIL_MINUTES_<DATASET> (e.g., ADLAB_FRESHNESS_FAIL_MINUTES_DAILY_METRICS)
 */
export function getFreshnessPolicy(dataset: DatasetKey): FreshnessPolicy {
  const defaultPolicy = DEFAULT_FRESHNESS_POLICIES[dataset];

  if (!defaultPolicy) {
    // Return a safe fallback for unknown datasets
    return {
      dataset,
      warnAfterMinutes: 72 * MINUTES_IN_HOUR,
      failAfterMinutes: 168 * MINUTES_IN_HOUR,
      critical: false,
      description: 'Unknown dataset',
    };
  }

  // Check for env overrides
  const envKey = dataset.toUpperCase().replace(/-/g, '_');
  const warnOverride = process.env[`ADLAB_FRESHNESS_WARN_MINUTES_${envKey}`];
  const failOverride = process.env[`ADLAB_FRESHNESS_FAIL_MINUTES_${envKey}`];

  return {
    ...defaultPolicy,
    warnAfterMinutes: warnOverride
      ? parseInt(warnOverride, 10)
      : defaultPolicy.warnAfterMinutes,
    failAfterMinutes: failOverride
      ? parseInt(failOverride, 10)
      : defaultPolicy.failAfterMinutes,
  };
}

// ============================================
// Pure Computation Helpers
// ============================================

/**
 * Computes the freshness status for a dataset.
 *
 * @param lastIngestedAt - ISO timestamp of last successful ingestion (null if never ingested)
 * @param policy - Freshness policy for the dataset
 * @param now - Current time in milliseconds (defaults to Date.now())
 * @returns Computed freshness status
 */
export function computeFreshnessStatus(
  lastIngestedAt: string | null,
  policy: FreshnessPolicy,
  now: number = Date.now()
): FreshnessStatus {
  // No ingestion ever: always FAIL
  if (!lastIngestedAt) {
    return {
      status: 'fail',
      ageMinutes: Infinity,
      warnAtMinutes: policy.warnAfterMinutes,
      failAtMinutes: policy.failAfterMinutes,
      lastIngestedAt: null,
      reason: 'NO_INGESTION',
    };
  }

  // Parse timestamp (handle both ISO and numeric)
  let ingestedTime: number;
  try {
    ingestedTime = new Date(lastIngestedAt).getTime();
    if (isNaN(ingestedTime)) {
      return {
        status: 'fail',
        ageMinutes: Infinity,
        warnAtMinutes: policy.warnAfterMinutes,
        failAtMinutes: policy.failAfterMinutes,
        lastIngestedAt,
        reason: 'INVALID_TIMESTAMP',
      };
    }
  } catch {
    return {
      status: 'fail',
      ageMinutes: Infinity,
      warnAtMinutes: policy.warnAfterMinutes,
      failAtMinutes: policy.failAfterMinutes,
      lastIngestedAt,
      reason: 'INVALID_TIMESTAMP',
    };
  }

  // Calculate age in minutes
  const ageMs = now - ingestedTime;
  const ageMinutes = Math.floor(ageMs / (1000 * 60));

  // Determine status
  let status: FreshnessStatusValue;
  if (ageMinutes >= policy.failAfterMinutes) {
    status = 'fail';
  } else if (ageMinutes >= policy.warnAfterMinutes) {
    status = 'warn';
  } else {
    status = 'fresh';
  }

  return {
    status,
    ageMinutes: Math.max(0, ageMinutes),
    warnAtMinutes: policy.warnAfterMinutes,
    failAtMinutes: policy.failAfterMinutes,
    lastIngestedAt,
  };
}

/**
 * Formats age in minutes to a human-readable string.
 */
export function formatAge(ageMinutes: number): string {
  if (!isFinite(ageMinutes)) {
    return 'Never';
  }

  if (ageMinutes < 60) {
    return `${ageMinutes}m`;
  }

  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) {
    const mins = ageMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Checks if a dataset is critical for deployment.
 */
export function isDatasetCritical(dataset: DatasetKey): boolean {
  const policy = getFreshnessPolicy(dataset);
  return policy.critical;
}

/**
 * Gets all policies.
 */
export function getAllFreshnessPolicies(): FreshnessPolicy[] {
  return ALL_DATASET_KEYS.map(getFreshnessPolicy);
}
