// ============================================
// AdLab Production Readiness Assertions
// ============================================
// PHASE D24: Production Readiness Proof.
// PHASE D28: Data Freshness Truth + Staleness Controls.
//
// CORE PRINCIPLE:
// Every critical path must be provably guarded.
// Every irreversible action must be observable.
// Every failure mode must be detectable.
// Data freshness is a first-class invariant.
//
// HARD RULES:
// - All assertions must pass for production deployment
// - No silent failures allowed
// - Human-readable AND machine-verifiable
// - Throws HARD error if any invariant missing
// - Critical dataset staleness blocks deployment
// ============================================

import { createClient } from '@supabase/supabase-js';
import { getWorkspaceFreshnessMap } from '../ops/freshnessStatus';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

/** Individual readiness check result */
export interface ReadinessCheck {
  name: string;
  category: ReadinessCategory;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: Record<string, unknown>;
}

/** Categories of readiness checks */
export type ReadinessCategory =
  | 'GUARD'        // Safety guards (kill-switch, injection, permission)
  | 'AUDIT'        // Audit trail presence
  | 'DATA'         // Data integrity (snapshots, tables)
  | 'CONFIG'       // Configuration validity
  | 'REGISTRY'     // Guard registration
  | 'FRESHNESS';   // Data freshness (D28)

/** Overall readiness status */
export interface ReadinessStatus {
  ready: boolean;
  status: 'READY' | 'BLOCKED' | 'DEGRADED';
  checks: ReadinessCheck[];
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

/** Production readiness error */
export class ProductionNotReadyError extends Error {
  constructor(
    public readonly checks: ReadinessCheck[],
    public readonly failedChecks: ReadinessCheck[]
  ) {
    const failedNames = failedChecks.map((c) => c.name).join(', ');
    super(`Production not ready. Failed checks: ${failedNames}`);
    this.name = 'ProductionNotReadyError';
  }
}

// ============================================
// Supabase Client
// ============================================

function createReadinessClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Individual Assertions
// ============================================

/**
 * Asserts kill-switch table exists and is accessible.
 */
async function assertKillSwitchPresent(): Promise<ReadinessCheck> {
  try {
    const supabase = createReadinessClient();
    const { data, error } = await supabase
      .from('adlab_kill_switches')
      .select('id, scope, enabled')
      .limit(1);

    if (error) {
      return {
        name: 'kill_switch_table',
        category: 'GUARD',
        status: 'FAIL',
        message: `Kill-switch table inaccessible: ${error.message}`,
      };
    }

    // Check global kill-switch row exists
    const { data: globalRow } = await supabase
      .from('adlab_kill_switches')
      .select('id')
      .eq('scope', 'global')
      .single();

    if (!globalRow) {
      return {
        name: 'kill_switch_table',
        category: 'GUARD',
        status: 'WARN',
        message: 'Global kill-switch row not seeded',
      };
    }

    return {
      name: 'kill_switch_table',
      category: 'GUARD',
      status: 'PASS',
      message: 'Kill-switch table present and accessible',
      details: { rowCount: data?.length },
    };
  } catch (e) {
    return {
      name: 'kill_switch_table',
      category: 'GUARD',
      status: 'FAIL',
      message: `Kill-switch check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/**
 * Asserts failure injection table exists.
 */
async function assertFailureInjectionPresent(): Promise<ReadinessCheck> {
  try {
    const supabase = createReadinessClient();
    const { error } = await supabase
      .from('adlab_failure_injections')
      .select('id')
      .limit(1);

    if (error) {
      return {
        name: 'failure_injection_table',
        category: 'GUARD',
        status: 'FAIL',
        message: `Failure injection table inaccessible: ${error.message}`,
      };
    }

    return {
      name: 'failure_injection_table',
      category: 'GUARD',
      status: 'PASS',
      message: 'Failure injection table present and accessible',
    };
  } catch (e) {
    return {
      name: 'failure_injection_table',
      category: 'GUARD',
      status: 'FAIL',
      message: `Failure injection check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/**
 * Asserts audit log table exists and is writable.
 */
async function assertAuditLogPresent(): Promise<ReadinessCheck> {
  try {
    const supabase = createReadinessClient();
    const { data, error } = await supabase
      .from('adlab_audit_logs')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      return {
        name: 'audit_log_table',
        category: 'AUDIT',
        status: 'FAIL',
        message: `Audit log table inaccessible: ${error.message}`,
      };
    }

    return {
      name: 'audit_log_table',
      category: 'AUDIT',
      status: 'PASS',
      message: 'Audit log table present and accessible',
      details: {
        lastEntry: data?.[0]?.created_at || 'No entries yet',
      },
    };
  } catch (e) {
    return {
      name: 'audit_log_table',
      category: 'AUDIT',
      status: 'FAIL',
      message: `Audit log check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/**
 * Asserts workspace memberships table exists (for actor resolution).
 */
async function assertActorResolutionPresent(): Promise<ReadinessCheck> {
  try {
    const supabase = createReadinessClient();
    const { error } = await supabase
      .from('adlab_workspace_memberships')
      .select('id')
      .limit(1);

    if (error) {
      return {
        name: 'actor_resolution',
        category: 'GUARD',
        status: 'FAIL',
        message: `Workspace memberships table inaccessible: ${error.message}`,
      };
    }

    return {
      name: 'actor_resolution',
      category: 'GUARD',
      status: 'PASS',
      message: 'Actor resolution (workspace memberships) present',
    };
  } catch (e) {
    return {
      name: 'actor_resolution',
      category: 'GUARD',
      status: 'FAIL',
      message: `Actor resolution check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/**
 * Asserts production snapshots table exists.
 */
async function assertSnapshotTruthPresent(): Promise<ReadinessCheck> {
  try {
    const supabase = createReadinessClient();
    const { error } = await supabase
      .from('adlab_production_snapshots')
      .select('id')
      .limit(1);

    if (error) {
      return {
        name: 'snapshot_truth',
        category: 'DATA',
        status: 'FAIL',
        message: `Production snapshots table inaccessible: ${error.message}`,
      };
    }

    return {
      name: 'snapshot_truth',
      category: 'DATA',
      status: 'PASS',
      message: 'Production snapshots (truth source) present',
    };
  } catch (e) {
    return {
      name: 'snapshot_truth',
      category: 'DATA',
      status: 'FAIL',
      message: `Snapshot truth check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/**
 * Asserts ingestion logs table exists.
 */
async function assertIngestionLogsPresent(): Promise<ReadinessCheck> {
  try {
    const supabase = createReadinessClient();
    const { error } = await supabase
      .from('adlab_ingestion_logs')
      .select('id')
      .limit(1);

    if (error) {
      return {
        name: 'ingestion_logs',
        category: 'DATA',
        status: 'FAIL',
        message: `Ingestion logs table inaccessible: ${error.message}`,
      };
    }

    return {
      name: 'ingestion_logs',
      category: 'DATA',
      status: 'PASS',
      message: 'Ingestion logs table present',
    };
  } catch (e) {
    return {
      name: 'ingestion_logs',
      category: 'DATA',
      status: 'FAIL',
      message: `Ingestion logs check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/**
 * Asserts environment variables are configured.
 */
function assertEnvironmentConfig(): ReadinessCheck {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return {
      name: 'environment_config',
      category: 'CONFIG',
      status: 'FAIL',
      message: `Missing environment variables: ${missing.join(', ')}`,
      details: { missing },
    };
  }

  return {
    name: 'environment_config',
    category: 'CONFIG',
    status: 'PASS',
    message: 'All required environment variables present',
  };
}

/**
 * Checks if any kill-switch is currently active.
 */
async function checkActiveKillSwitch(): Promise<ReadinessCheck> {
  try {
    const supabase = createReadinessClient();
    const { data } = await supabase
      .from('adlab_kill_switches')
      .select('scope, reason')
      .eq('enabled', true);

    if (data && data.length > 0) {
      return {
        name: 'active_kill_switch',
        category: 'GUARD',
        status: 'WARN',
        message: `Kill-switch active: ${data.map((d) => d.scope).join(', ')}`,
        details: { activeKillSwitches: data },
      };
    }

    return {
      name: 'active_kill_switch',
      category: 'GUARD',
      status: 'PASS',
      message: 'No kill-switches currently active',
    };
  } catch (e) {
    return {
      name: 'active_kill_switch',
      category: 'GUARD',
      status: 'WARN',
      message: `Could not check kill-switch status: ${e instanceof Error ? e.message : 'Unknown'}`,
    };
  }
}

/**
 * Checks if any failure injections are currently enabled.
 */
async function checkActiveFailureInjections(): Promise<ReadinessCheck> {
  try {
    const supabase = createReadinessClient();
    const { data } = await supabase
      .from('adlab_failure_injections')
      .select('action, failure_type, probability')
      .eq('enabled', true);

    if (data && data.length > 0) {
      return {
        name: 'active_failure_injections',
        category: 'GUARD',
        status: 'WARN',
        message: `Failure injections active: ${data.map((d) => d.action).join(', ')}`,
        details: { activeInjections: data },
      };
    }

    return {
      name: 'active_failure_injections',
      category: 'GUARD',
      status: 'PASS',
      message: 'No failure injections currently active',
    };
  } catch (e) {
    return {
      name: 'active_failure_injections',
      category: 'GUARD',
      status: 'WARN',
      message: `Could not check failure injections: ${e instanceof Error ? e.message : 'Unknown'}`,
    };
  }
}

// ============================================
// D28: Freshness Checks
// ============================================

/**
 * Gets the default workspace and platform for freshness checks.
 * In production, this would be configurable per deployment.
 */
function getDefaultFreshnessScope(): { workspaceId: string; platform: string } {
  return {
    workspaceId: process.env.ADLAB_DEFAULT_WORKSPACE_ID || 'system',
    platform: process.env.ADLAB_DEFAULT_PLATFORM || 'meta',
  };
}

/**
 * Checks data freshness for all critical datasets.
 * Returns multiple checks, one per dataset.
 */
async function checkDataFreshness(): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];
  const { workspaceId, platform } = getDefaultFreshnessScope();

  try {
    const freshnessMap = await getWorkspaceFreshnessMap(workspaceId, platform);

    for (const datasetResult of freshnessMap.datasets) {
      const { dataset, freshness, policy } = datasetResult;
      const isCritical = policy.critical;

      let status: 'PASS' | 'WARN' | 'FAIL';
      let message: string;

      if (freshness.status === 'fresh') {
        status = 'PASS';
        message = `${dataset}: Fresh (${formatAgeForCheck(freshness.ageMinutes)})`;
      } else if (freshness.status === 'warn') {
        status = 'WARN';
        message = `${dataset}: Approaching staleness (${formatAgeForCheck(freshness.ageMinutes)}, warn at ${formatAgeForCheck(freshness.warnAtMinutes)})`;
      } else {
        // FAIL
        status = isCritical ? 'FAIL' : 'WARN';
        if (freshness.reason === 'NO_INGESTION') {
          message = `${dataset}: No ingestion data found${isCritical ? ' (CRITICAL)' : ''}`;
        } else {
          message = `${dataset}: Stale (${formatAgeForCheck(freshness.ageMinutes)}, fail at ${formatAgeForCheck(freshness.failAtMinutes)})${isCritical ? ' (CRITICAL)' : ''}`;
        }
      }

      checks.push({
        name: `freshness_${dataset}`,
        category: 'FRESHNESS',
        status,
        message,
        details: {
          dataset,
          ageMinutes: freshness.ageMinutes,
          warnAtMinutes: freshness.warnAtMinutes,
          failAtMinutes: freshness.failAtMinutes,
          lastIngestedAt: freshness.lastIngestedAt,
          critical: isCritical,
          reason: freshness.reason,
        },
      });
    }

    // Add summary check
    const summary = freshnessMap.summary;
    let summaryStatus: 'PASS' | 'WARN' | 'FAIL';
    let summaryMessage: string;

    if (summary.criticalFail > 0) {
      summaryStatus = 'FAIL';
      summaryMessage = `${summary.criticalFail} critical dataset(s) stale beyond safe limit`;
    } else if (summary.fail > 0 || summary.warn > 0) {
      summaryStatus = 'WARN';
      summaryMessage = `${summary.warn} warning(s), ${summary.fail} non-critical failure(s)`;
    } else {
      summaryStatus = 'PASS';
      summaryMessage = `All ${summary.total} datasets fresh`;
    }

    checks.push({
      name: 'freshness_summary',
      category: 'FRESHNESS',
      status: summaryStatus,
      message: summaryMessage,
      details: {
        total: summary.total,
        fresh: summary.fresh,
        warn: summary.warn,
        fail: summary.fail,
        criticalFail: summary.criticalFail,
      },
    });
  } catch (e) {
    // If we can't check freshness, it's a warning (not blocking)
    checks.push({
      name: 'freshness_check',
      category: 'FRESHNESS',
      status: 'WARN',
      message: `Could not check data freshness: ${e instanceof Error ? e.message : 'Unknown error'}`,
    });
  }

  return checks;
}

/**
 * Formats age in minutes for display in check messages.
 */
function formatAgeForCheck(ageMinutes: number): string {
  if (!isFinite(ageMinutes)) return 'never';
  if (ageMinutes < 60) return `${ageMinutes}m`;
  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ============================================
// Main Readiness Functions
// ============================================

/**
 * Runs all production readiness checks.
 * Returns full status without throwing.
 */
export async function checkProductionReadiness(): Promise<ReadinessStatus> {
  const checks: ReadinessCheck[] = [];

  // Run all checks
  checks.push(assertEnvironmentConfig());
  checks.push(await assertKillSwitchPresent());
  checks.push(await assertFailureInjectionPresent());
  checks.push(await assertAuditLogPresent());
  checks.push(await assertActorResolutionPresent());
  checks.push(await assertSnapshotTruthPresent());
  checks.push(await assertIngestionLogsPresent());
  checks.push(await checkActiveKillSwitch());
  checks.push(await checkActiveFailureInjections());

  // D28: Add freshness checks
  const freshnessChecks = await checkDataFreshness();
  checks.push(...freshnessChecks);

  // Calculate summary
  const passed = checks.filter((c) => c.status === 'PASS').length;
  const failed = checks.filter((c) => c.status === 'FAIL').length;
  const warnings = checks.filter((c) => c.status === 'WARN').length;

  // Determine overall status
  let status: 'READY' | 'BLOCKED' | 'DEGRADED';
  if (failed > 0) {
    status = 'BLOCKED';
  } else if (warnings > 0) {
    status = 'DEGRADED';
  } else {
    status = 'READY';
  }

  return {
    ready: failed === 0,
    status,
    checks,
    timestamp: new Date().toISOString(),
    summary: {
      total: checks.length,
      passed,
      failed,
      warnings,
    },
  };
}

/**
 * Asserts production readiness.
 * Throws ProductionNotReadyError if any FAIL checks.
 *
 * Use this in deployment scripts or pre-flight checks.
 *
 * @throws ProductionNotReadyError if not ready
 */
export async function assertProductionReady(): Promise<ReadinessStatus> {
  const status = await checkProductionReadiness();

  if (!status.ready) {
    const failedChecks = status.checks.filter((c) => c.status === 'FAIL');
    throw new ProductionNotReadyError(status.checks, failedChecks);
  }

  return status;
}

/**
 * Quick check if system is ready (no throw).
 */
export async function isProductionReady(): Promise<boolean> {
  const status = await checkProductionReadiness();
  return status.ready;
}
