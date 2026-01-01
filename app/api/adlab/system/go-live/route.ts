// ============================================
// AdLab Go-Live Gate API
// ============================================
// PHASE D26: Go-Live Gate & Continuous Compliance.
//
// HARD GATE: Deploy MUST NOT proceed if this endpoint fails.
//
// INVARIANTS CHECKED:
// - Production readiness (D24)
// - Active snapshot exists for critical datasets
// - Kill-switch is OFF
// - Failure-injection is OFF
// - Audit logging is writable
// - RBAC + workspace membership is valid
//
// RESPONSE:
// - 200 OK: All checks pass, deploy may proceed
// - 412 Precondition Failed: One or more checks failed
// ============================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkProductionReadiness,
  isGlobalKillSwitchEnabled,
} from '@/lib/adlab/safety';
import { appendAuditLog } from '@/lib/adlab/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

interface GoLiveCheck {
  name: string;
  passed: boolean;
  message: string;
  critical: boolean;
}

interface GoLiveResponse {
  canDeploy: boolean;
  status: 'READY' | 'BLOCKED';
  checks: GoLiveCheck[];
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    criticalFailed: number;
  };
}

// ============================================
// Supabase Client
// ============================================

function createGoLiveClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Individual Checks
// ============================================

async function checkActiveSnapshotsExist(): Promise<GoLiveCheck> {
  try {
    const supabase = createGoLiveClient();

    // Check for active snapshots per critical dataset
    const { data, error } = await supabase
      .from('adlab_production_snapshots')
      .select('platform, dataset')
      .eq('is_active', true);

    if (error) {
      return {
        name: 'active_snapshots',
        passed: false,
        message: `Cannot verify snapshots: ${error.message}`,
        critical: true,
      };
    }

    if (!data || data.length === 0) {
      return {
        name: 'active_snapshots',
        passed: false,
        message: 'No active snapshots found. At least one active snapshot required.',
        critical: true,
      };
    }

    return {
      name: 'active_snapshots',
      passed: true,
      message: `${data.length} active snapshot(s) found`,
      critical: true,
    };
  } catch (e) {
    return {
      name: 'active_snapshots',
      passed: false,
      message: `Snapshot check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      critical: true,
    };
  }
}

async function checkKillSwitchOff(): Promise<GoLiveCheck> {
  try {
    const status = await isGlobalKillSwitchEnabled();

    if (status.blocked) {
      return {
        name: 'kill_switch_off',
        passed: false,
        message: `Global kill-switch is ACTIVE: ${status.reason}`,
        critical: true,
      };
    }

    return {
      name: 'kill_switch_off',
      passed: true,
      message: 'Global kill-switch is OFF',
      critical: true,
    };
  } catch (e) {
    return {
      name: 'kill_switch_off',
      passed: false,
      message: `Kill-switch check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      critical: true,
    };
  }
}

async function checkFailureInjectionOff(): Promise<GoLiveCheck> {
  try {
    const supabase = createGoLiveClient();

    const { data, error } = await supabase
      .from('adlab_failure_injections')
      .select('action, failure_type')
      .eq('enabled', true);

    if (error) {
      return {
        name: 'failure_injection_off',
        passed: false,
        message: `Cannot verify failure injections: ${error.message}`,
        critical: true,
      };
    }

    if (data && data.length > 0) {
      const activeActions = data.map((d) => d.action).join(', ');
      return {
        name: 'failure_injection_off',
        passed: false,
        message: `Failure injection is ACTIVE for: ${activeActions}`,
        critical: true,
      };
    }

    return {
      name: 'failure_injection_off',
      passed: true,
      message: 'No failure injections active',
      critical: true,
    };
  } catch (e) {
    return {
      name: 'failure_injection_off',
      passed: false,
      message: `Failure injection check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      critical: true,
    };
  }
}

async function checkAuditLoggingWritable(): Promise<GoLiveCheck> {
  try {
    // Attempt to write a test audit log entry
    const result = await appendAuditLog({
      context: {
        workspaceId: 'system',
        actorId: 'go-live-gate',
        actorRole: 'owner',
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: 'go-live-check',
      scope: {
        platform: 'system',
        dataset: 'go_live_gate',
      },
      metadata: {
        checkType: 'GO_LIVE_GATE',
        timestamp: new Date().toISOString(),
      },
    });

    if (!result.success) {
      return {
        name: 'audit_logging_writable',
        passed: false,
        message: `Audit logging failed: ${result.error}`,
        critical: true,
      };
    }

    return {
      name: 'audit_logging_writable',
      passed: true,
      message: 'Audit logging is operational',
      critical: true,
    };
  } catch (e) {
    return {
      name: 'audit_logging_writable',
      passed: false,
      message: `Audit check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      critical: true,
    };
  }
}

async function checkRBACValid(): Promise<GoLiveCheck> {
  try {
    const supabase = createGoLiveClient();

    // Check workspace memberships table is accessible
    const { error } = await supabase
      .from('adlab_workspace_memberships')
      .select('id')
      .limit(1);

    if (error) {
      return {
        name: 'rbac_valid',
        passed: false,
        message: `RBAC check failed: ${error.message}`,
        critical: true,
      };
    }

    return {
      name: 'rbac_valid',
      passed: true,
      message: 'RBAC and workspace membership is accessible',
      critical: true,
    };
  } catch (e) {
    return {
      name: 'rbac_valid',
      passed: false,
      message: `RBAC check failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      critical: true,
    };
  }
}

// ============================================
// Main Handler
// ============================================

export async function GET(): Promise<NextResponse<GoLiveResponse>> {
  const checks: GoLiveCheck[] = [];

  try {
    // Run production readiness first
    const readiness = await checkProductionReadiness();

    // Add readiness checks
    for (const check of readiness.checks) {
      checks.push({
        name: `readiness_${check.name}`,
        passed: check.status === 'PASS',
        message: check.message,
        critical: check.category === 'GUARD' || check.category === 'DATA',
      });
    }

    // Run go-live specific checks
    checks.push(await checkActiveSnapshotsExist());
    checks.push(await checkKillSwitchOff());
    checks.push(await checkFailureInjectionOff());
    checks.push(await checkAuditLoggingWritable());
    checks.push(await checkRBACValid());

    // Calculate summary
    const passed = checks.filter((c) => c.passed).length;
    const failed = checks.filter((c) => !c.passed).length;
    const criticalFailed = checks.filter((c) => !c.passed && c.critical).length;

    const canDeploy = criticalFailed === 0;

    const response: GoLiveResponse = {
      canDeploy,
      status: canDeploy ? 'READY' : 'BLOCKED',
      checks,
      timestamp: new Date().toISOString(),
      summary: {
        total: checks.length,
        passed,
        failed,
        criticalFailed,
      },
    };

    // Audit the gate result
    await appendAuditLog({
      context: {
        workspaceId: 'system',
        actorId: 'go-live-gate',
        actorRole: 'owner',
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: 'go-live-result',
      scope: {
        platform: 'system',
        dataset: 'go_live_gate',
      },
      metadata: {
        gateResult: canDeploy ? 'PASS' : 'FAIL',
        checksPassed: passed,
        checksFailed: failed,
        criticalFailed,
        timestamp: response.timestamp,
      },
    });

    // Return appropriate status code
    if (canDeploy) {
      return NextResponse.json(response, { status: 200 });
    } else {
      return NextResponse.json(response, { status: 412 });
    }
  } catch (e) {
    console.error('Go-live gate error:', e);

    const errorResponse: GoLiveResponse = {
      canDeploy: false,
      status: 'BLOCKED',
      checks: [
        {
          name: 'gate_execution',
          passed: false,
          message: e instanceof Error ? e.message : 'Go-live gate execution failed',
          critical: true,
        },
      ],
      timestamp: new Date().toISOString(),
      summary: {
        total: 1,
        passed: 0,
        failed: 1,
        criticalFailed: 1,
      },
    };

    return NextResponse.json(errorResponse, { status: 412 });
  }
}
