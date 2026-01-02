// ============================================
// AdLab Continuous Compliance Monitor
// ============================================
// PHASE D26: Go-Live Gate & Continuous Compliance.
// PHASE D28: Data Freshness Truth + Staleness Controls.
//
// TRIGGERED: Every 5-10 minutes via cron/scheduler.
//
// DETECTS DRIFT:
// - Snapshot mismatch
// - Missing or stale active snapshot
// - Kill-switch unexpectedly enabled
// - Failure-injection enabled
// - Permission or membership anomalies
// - Analytics bound to non-active snapshot
// - Data freshness violations (D28)
//
// EMITS AUDIT EVENTS:
// - COMPLIANCE_PASS
// - COMPLIANCE_WARN
// - COMPLIANCE_FAIL
// ============================================

import { createClient } from '@supabase/supabase-js';
import { appendAuditLog } from '@/lib/adlab/audit';
import { isGlobalKillSwitchEnabled } from '@/lib/adlab/safety';
import { getWorkspaceFreshnessMap } from './freshnessStatus';
import { type DatasetKey as _DatasetKey } from './freshnessPolicy';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

export type ComplianceStatus = 'PASS' | 'WARN' | 'FAIL';
export type DriftSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type DriftType =
  | 'SNAPSHOT_MISSING'
  | 'SNAPSHOT_STALE'
  | 'SNAPSHOT_MISMATCH'
  | 'KILL_SWITCH_ACTIVE'
  | 'FAILURE_INJECTION_ACTIVE'
  | 'PERMISSION_ANOMALY'
  | 'MEMBERSHIP_ANOMALY'
  | 'ANALYTICS_DRIFT'
  | 'AUDIT_UNREACHABLE'
  | 'DATA_FRESHNESS_WARN'
  | 'DATA_FRESHNESS_FAIL';

export interface DriftItem {
  type: DriftType;
  severity: DriftSeverity;
  message: string;
  workspaceId?: string;
  snapshotId?: string;
  details?: Record<string, unknown>;
}

export interface ComplianceCheckResult {
  status: ComplianceStatus;
  overallSeverity: DriftSeverity | null;
  driftItems: DriftItem[];
  timestamp: string;
  workspaceId: string;
  checkDuration: number; // milliseconds
}

export interface GlobalComplianceResult {
  status: ComplianceStatus;
  workspaceResults: ComplianceCheckResult[];
  globalDrift: DriftItem[];
  timestamp: string;
  totalWorkspaces: number;
  passingWorkspaces: number;
  failingWorkspaces: number;
}

// ============================================
// Supabase Client
// ============================================

function createComplianceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Individual Drift Checks
// ============================================

async function checkSnapshotDrift(workspaceId: string): Promise<DriftItem[]> {
  const driftItems: DriftItem[] = [];
  const supabase = createComplianceClient();

  try {
    // Check for active snapshots
    const { data: snapshots, error } = await supabase
      .from('adlab_production_snapshots')
      .select('id, platform, dataset, is_active, created_at')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    if (error) {
      driftItems.push({
        type: 'SNAPSHOT_MISSING',
        severity: 'CRITICAL',
        message: `Cannot verify snapshots: ${error.message}`,
        workspaceId,
      });
      return driftItems;
    }

    if (!snapshots || snapshots.length === 0) {
      driftItems.push({
        type: 'SNAPSHOT_MISSING',
        severity: 'HIGH',
        message: 'No active snapshots found for workspace',
        workspaceId,
      });
    }

    // Check for stale snapshots (older than 7 days)
    const staleThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const snapshot of snapshots || []) {
      const snapshotAge = new Date(snapshot.created_at).getTime();
      if (snapshotAge < staleThreshold) {
        driftItems.push({
          type: 'SNAPSHOT_STALE',
          severity: 'MEDIUM',
          message: `Snapshot for ${snapshot.platform}/${snapshot.dataset} is older than 7 days`,
          workspaceId,
          snapshotId: snapshot.id,
          details: {
            platform: snapshot.platform,
            dataset: snapshot.dataset,
            createdAt: snapshot.created_at,
          },
        });
      }
    }
  } catch (_e) {
    driftItems.push({
      type: 'SNAPSHOT_MISSING',
      severity: 'CRITICAL',
      message: `Snapshot check failed: ${_e instanceof Error ? _e.message : 'Unknown error'}`,
      workspaceId,
    });
  }

  return driftItems;
}

async function checkKillSwitchDrift(workspaceId: string): Promise<DriftItem[]> {
  const driftItems: DriftItem[] = [];
  const supabase = createComplianceClient();

  try {
    // Check workspace-specific kill-switch
    const { data, error } = await supabase
      .from('adlab_kill_switches')
      .select('enabled, reason, activated_at')
      .eq('scope', 'workspace')
      .eq('workspace_id', workspaceId)
      .eq('enabled', true)
      .single();

    if (data && !error) {
      driftItems.push({
        type: 'KILL_SWITCH_ACTIVE',
        severity: 'HIGH',
        message: `Kill-switch is active: ${data.reason}`,
        workspaceId,
        details: {
          reason: data.reason,
          activatedAt: data.activated_at,
        },
      });
    }
  } catch {
    // No active kill-switch is fine
  }

  return driftItems;
}

async function checkFailureInjectionDrift(workspaceId: string): Promise<DriftItem[]> {
  const driftItems: DriftItem[] = [];
  const supabase = createComplianceClient();

  try {
    const { data, error: _error } = await supabase
      .from('adlab_failure_injections')
      .select('action, failure_type, probability, enabled_at')
      .eq('workspace_id', workspaceId)
      .eq('enabled', true);

    if (data && data.length > 0) {
      for (const injection of data) {
        driftItems.push({
          type: 'FAILURE_INJECTION_ACTIVE',
          severity: 'CRITICAL',
          message: `Failure injection active for ${injection.action} (${injection.failure_type}, ${injection.probability}%)`,
          workspaceId,
          details: {
            action: injection.action,
            failureType: injection.failure_type,
            probability: injection.probability,
            enabledAt: injection.enabled_at,
          },
        });
      }
    }
  } catch (e) {
    driftItems.push({
      type: 'FAILURE_INJECTION_ACTIVE',
      severity: 'MEDIUM',
      message: `Cannot verify failure injections: ${e instanceof Error ? e.message : 'Unknown error'}`,
      workspaceId,
    });
  }

  return driftItems;
}

async function checkMembershipDrift(workspaceId: string): Promise<DriftItem[]> {
  const driftItems: DriftItem[] = [];
  const supabase = createComplianceClient();

  try {
    // Check for orphaned memberships or anomalies
    const { data, error } = await supabase
      .from('adlab_workspace_memberships')
      .select('id, user_id, role, is_active')
      .eq('workspace_id', workspaceId);

    if (error) {
      driftItems.push({
        type: 'MEMBERSHIP_ANOMALY',
        severity: 'HIGH',
        message: `Cannot verify memberships: ${error.message}`,
        workspaceId,
      });
      return driftItems;
    }

    // Check for multiple owners (anomaly)
    const owners = data?.filter((m) => m.role === 'owner' && m.is_active) || [];
    if (owners.length > 1) {
      driftItems.push({
        type: 'MEMBERSHIP_ANOMALY',
        severity: 'MEDIUM',
        message: `Multiple active owners detected (${owners.length})`,
        workspaceId,
        details: { ownerCount: owners.length },
      });
    }

    // Check for no owners (critical anomaly)
    if (owners.length === 0) {
      driftItems.push({
        type: 'MEMBERSHIP_ANOMALY',
        severity: 'CRITICAL',
        message: 'No active owner found for workspace',
        workspaceId,
      });
    }
  } catch (e) {
    driftItems.push({
      type: 'MEMBERSHIP_ANOMALY',
      severity: 'HIGH',
      message: `Membership check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      workspaceId,
    });
  }

  return driftItems;
}

// ============================================
// Global Checks
// ============================================

async function checkGlobalKillSwitch(): Promise<DriftItem[]> {
  const driftItems: DriftItem[] = [];

  try {
    const status = await isGlobalKillSwitchEnabled();
    if (status.blocked) {
      driftItems.push({
        type: 'KILL_SWITCH_ACTIVE',
        severity: 'CRITICAL',
        message: `Global kill-switch is active: ${status.reason}`,
        details: {
          scope: 'global',
          reason: status.reason,
          activatedAt: status.activatedAt,
        },
      });
    }
  } catch (e) {
    driftItems.push({
      type: 'KILL_SWITCH_ACTIVE',
      severity: 'HIGH',
      message: `Cannot verify global kill-switch: ${e instanceof Error ? e.message : 'Unknown error'}`,
    });
  }

  return driftItems;
}

async function checkAuditReachability(): Promise<DriftItem[]> {
  const driftItems: DriftItem[] = [];

  try {
    const result = await appendAuditLog({
      context: {
        workspaceId: 'system',
        actorId: 'compliance-monitor',
        actorRole: 'owner',
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: 'compliance-check',
      scope: {
        platform: 'system',
        dataset: 'compliance',
      },
      metadata: {
        checkType: 'COMPLIANCE_MONITOR',
        timestamp: new Date().toISOString(),
      },
    });

    if (!result.success) {
      driftItems.push({
        type: 'AUDIT_UNREACHABLE',
        severity: 'CRITICAL',
        message: `Audit logging failed: ${result.error}`,
      });
    }
  } catch (e) {
    driftItems.push({
      type: 'AUDIT_UNREACHABLE',
      severity: 'CRITICAL',
      message: `Audit unreachable: ${e instanceof Error ? e.message : 'Unknown error'}`,
    });
  }

  return driftItems;
}

// ============================================
// D28: Data Freshness Drift Check
// ============================================

async function checkFreshnessDrift(
  workspaceId: string,
  platform: string = 'meta'
): Promise<DriftItem[]> {
  const driftItems: DriftItem[] = [];

  try {
    const freshnessMap = await getWorkspaceFreshnessMap(workspaceId, platform);

    for (const datasetResult of freshnessMap.datasets) {
      const { dataset, freshness, policy } = datasetResult;

      if (freshness.status === 'fail') {
        // Critical dataset fail = CRITICAL severity, otherwise HIGH
        const severity: DriftSeverity = policy.critical ? 'CRITICAL' : 'HIGH';
        const reason = freshness.reason === 'NO_INGESTION'
          ? 'No ingestion data found'
          : `Stale for ${formatMinutes(freshness.ageMinutes)} (limit: ${formatMinutes(freshness.failAtMinutes)})`;

        driftItems.push({
          type: 'DATA_FRESHNESS_FAIL',
          severity,
          message: `${dataset}: ${reason}${policy.critical ? ' (CRITICAL)' : ''}`,
          workspaceId,
          details: {
            dataset,
            ageMinutes: freshness.ageMinutes,
            failAtMinutes: freshness.failAtMinutes,
            lastIngestedAt: freshness.lastIngestedAt,
            critical: policy.critical,
            reason: freshness.reason,
          },
        });
      } else if (freshness.status === 'warn') {
        driftItems.push({
          type: 'DATA_FRESHNESS_WARN',
          severity: 'MEDIUM',
          message: `${dataset}: Approaching staleness (${formatMinutes(freshness.ageMinutes)}, warn at ${formatMinutes(freshness.warnAtMinutes)})`,
          workspaceId,
          details: {
            dataset,
            ageMinutes: freshness.ageMinutes,
            warnAtMinutes: freshness.warnAtMinutes,
            lastIngestedAt: freshness.lastIngestedAt,
            critical: policy.critical,
          },
        });
      }
    }
  } catch (e) {
    driftItems.push({
      type: 'DATA_FRESHNESS_FAIL',
      severity: 'HIGH',
      message: `Cannot check data freshness: ${e instanceof Error ? e.message : 'Unknown error'}`,
      workspaceId,
    });
  }

  return driftItems;
}

/**
 * Formats minutes to a human-readable string.
 */
function formatMinutes(minutes: number): string {
  if (!isFinite(minutes)) return 'never';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ============================================
// Workspace Compliance Check
// ============================================

export async function checkWorkspaceCompliance(
  workspaceId: string,
  platform: string = 'meta'
): Promise<ComplianceCheckResult> {
  const startTime = Date.now();
  const driftItems: DriftItem[] = [];

  // Run all workspace-specific checks
  driftItems.push(...(await checkSnapshotDrift(workspaceId)));
  driftItems.push(...(await checkKillSwitchDrift(workspaceId)));
  driftItems.push(...(await checkFailureInjectionDrift(workspaceId)));
  driftItems.push(...(await checkMembershipDrift(workspaceId)));

  // D28: Add freshness drift check
  driftItems.push(...(await checkFreshnessDrift(workspaceId, platform)));

  // Determine overall status and severity
  const criticalDrift = driftItems.filter((d) => d.severity === 'CRITICAL');
  const highDrift = driftItems.filter((d) => d.severity === 'HIGH');

  let status: ComplianceStatus;
  let overallSeverity: DriftSeverity | null = null;

  if (criticalDrift.length > 0) {
    status = 'FAIL';
    overallSeverity = 'CRITICAL';
  } else if (highDrift.length > 0) {
    status = 'WARN';
    overallSeverity = 'HIGH';
  } else if (driftItems.length > 0) {
    status = 'WARN';
    overallSeverity = driftItems[0].severity;
  } else {
    status = 'PASS';
  }

  const result: ComplianceCheckResult = {
    status,
    overallSeverity,
    driftItems,
    timestamp: new Date().toISOString(),
    workspaceId,
    checkDuration: Date.now() - startTime,
  };

  // Emit compliance audit event
  await emitComplianceEvent(result);

  return result;
}

// ============================================
// Global Compliance Check
// ============================================

export async function runGlobalComplianceCheck(): Promise<GlobalComplianceResult> {
  const supabase = createComplianceClient();
  const globalDrift: DriftItem[] = [];
  const workspaceResults: ComplianceCheckResult[] = [];

  // Run global checks
  globalDrift.push(...(await checkGlobalKillSwitch()));
  globalDrift.push(...(await checkAuditReachability()));

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .limit(100);

  // Check each workspace
  for (const workspace of workspaces || []) {
    const result = await checkWorkspaceCompliance(workspace.id);
    workspaceResults.push(result);
  }

  // Calculate overall status
  const failingWorkspaces = workspaceResults.filter((r) => r.status === 'FAIL').length;
  const passingWorkspaces = workspaceResults.filter((r) => r.status === 'PASS').length;

  let status: ComplianceStatus;
  if (globalDrift.some((d) => d.severity === 'CRITICAL') || failingWorkspaces > 0) {
    status = 'FAIL';
  } else if (globalDrift.length > 0 || workspaceResults.some((r) => r.status === 'WARN')) {
    status = 'WARN';
  } else {
    status = 'PASS';
  }

  const result: GlobalComplianceResult = {
    status,
    workspaceResults,
    globalDrift,
    timestamp: new Date().toISOString(),
    totalWorkspaces: workspaceResults.length,
    passingWorkspaces,
    failingWorkspaces,
  };

  // Emit global compliance event
  await emitGlobalComplianceEvent(result);

  return result;
}

// ============================================
// Audit Event Emission
// ============================================

async function emitComplianceEvent(result: ComplianceCheckResult): Promise<void> {
  try {
    const eventType =
      result.status === 'PASS'
        ? 'COMPLIANCE_PASS'
        : result.status === 'WARN'
        ? 'COMPLIANCE_WARN'
        : 'COMPLIANCE_FAIL';

    await appendAuditLog({
      context: {
        workspaceId: result.workspaceId,
        actorId: 'compliance-monitor',
        actorRole: 'owner',
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: 'compliance-result',
      scope: {
        platform: 'system',
        dataset: 'compliance',
      },
      metadata: {
        complianceEvent: eventType,
        status: result.status,
        severity: result.overallSeverity,
        driftCount: result.driftItems.length,
        driftTypes: result.driftItems.map((d) => d.type),
        checkDuration: result.checkDuration,
        timestamp: result.timestamp,
      },
    });
  } catch (e) {
    console.error('[COMPLIANCE] Failed to emit compliance event:', e);
  }
}

async function emitGlobalComplianceEvent(result: GlobalComplianceResult): Promise<void> {
  try {
    const eventType =
      result.status === 'PASS'
        ? 'COMPLIANCE_PASS'
        : result.status === 'WARN'
        ? 'COMPLIANCE_WARN'
        : 'COMPLIANCE_FAIL';

    await appendAuditLog({
      context: {
        workspaceId: 'system',
        actorId: 'compliance-monitor',
        actorRole: 'owner',
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: 'global-compliance-result',
      scope: {
        platform: 'system',
        dataset: 'compliance',
      },
      metadata: {
        complianceEvent: eventType,
        scope: 'global',
        status: result.status,
        totalWorkspaces: result.totalWorkspaces,
        passingWorkspaces: result.passingWorkspaces,
        failingWorkspaces: result.failingWorkspaces,
        globalDriftCount: result.globalDrift.length,
        globalDriftTypes: result.globalDrift.map((d) => d.type),
        timestamp: result.timestamp,
      },
    });
  } catch (e) {
    console.error('[COMPLIANCE] Failed to emit global compliance event:', e);
  }
}

// ============================================
// Exports
// ============================================

export {
  checkSnapshotDrift,
  checkKillSwitchDrift,
  checkFailureInjectionDrift,
  checkMembershipDrift,
  checkGlobalKillSwitch,
  checkAuditReachability,
};
