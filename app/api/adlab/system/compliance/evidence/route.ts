// ============================================
// AdLab Compliance Evidence API
// ============================================
// PHASE D30: Production Evidence Pack & External Audit Export.
//
// PROVIDES:
// - System identity
// - Governance state (kill-switch, failure-injection, freshness)
// - Readiness & gate status
// - Compliance drift status
// - Audit coverage proof
// - RBAC & membership model
//
// INVARIANTS:
// - READ-ONLY endpoint
// - Owner/Admin only
// - All access is audited
// - Never throws unless system broken
// - Evidence reflects current production truth only
// ============================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  resolveActorFromRequest,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
  hasAtLeastRole,
} from '@/lib/adlab/auth';
import { checkProductionReadiness } from '@/lib/adlab/safety';
import {
  checkWorkspaceCompliance,
  getWorkspaceFreshnessMap,
  listOverrides,
  DEFAULT_FRESHNESS_POLICIES,
  ALL_DATASET_KEYS,
} from '@/lib/adlab/ops';
import { appendAuditLog } from '@/lib/adlab/audit';
import { verifyCoverage, getAllRegisteredRoutes } from '@/lib/adlab/safety/guardRegistry';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

interface EvidencePayload {
  // A. System Identity
  system: {
    name: string;
    environment: string;
    version: string | null;
    commitHash: string | null;
    generatedAt: string;
  };

  // B. Governance State
  governance: {
    killSwitch: {
      global: { enabled: boolean; reason: string | null; activatedAt: string | null };
      workspace: Array<{
        workspaceId: string;
        enabled: boolean;
        reason: string | null;
        activatedAt: string | null;
      }>;
    };
    failureInjection: {
      activeConfigs: Array<{
        action: string;
        failureType: string;
        probability: number;
        workspaceId: string;
      }>;
    };
    freshnessPolicies: {
      defaults: Record<string, {
        warnAfterMinutes: number;
        failAfterMinutes: number;
        critical: boolean;
      }>;
      workspaceOverrides: Array<{
        workspaceId: string;
        key: string;
        value: unknown;
        reason: string;
        expiresAt: string | null;
      }>;
    };
    activeSnapshots: Array<{
      dataset: string;
      snapshotId: string;
      ingestionLogId: string | null;
      promotedAt: string;
      workspaceId: string;
      platform: string;
    }>;
  };

  // C. Readiness & Gate
  readiness: {
    latestGoLiveGate: {
      status: 'PASS' | 'FAIL' | 'UNKNOWN';
      timestamp: string | null;
      failedChecks: string[];
    };
    readinessChecks: Array<{
      checkId: string;
      status: string;
      message: string;
      category: string;
    }>;
  };

  // D. Compliance Drift Status
  compliance: {
    currentStatus: 'PASS' | 'WARN' | 'FAIL';
    driftTypes: string[];
    lastCheckedAt: string;
    slaThresholds: {
      warnMinutes: number;
      failMinutes: number;
      criticalMinutes: number;
    };
  };

  // E. Audit Coverage Proof
  audit: {
    totalAuditEvents: number;
    eventsByType: Record<string, number>;
    mostRecentCriticalEvents: Array<{
      id: string;
      action: string;
      timestamp: string;
      actorId: string;
      entityType: string;
    }>;
  };

  // F. RBAC & Membership Model
  rbac: {
    rolesMatrix: {
      owner: string[];
      admin: string[];
      editor: string[];
      viewer: string[];
    };
    workspaceMembersCount: number;
    ownerCount: number;
    invariantsSummary: string;
  };

  // Metadata
  metadata: {
    evidenceVersion: string;
    disclaimer: string;
    checksum: string;
  };
}

// ============================================
// Supabase Client
// ============================================

function createEvidenceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Data Fetchers
// ============================================

async function getKillSwitchState() {
  try {
    const supabase = createEvidenceClient();

    // Get global kill-switch
    const { data: globalData } = await supabase
      .from('adlab_kill_switches')
      .select('enabled, reason, activated_at')
      .eq('scope', 'global')
      .maybeSingle();

    // Get workspace kill-switches
    const { data: workspaceData } = await supabase
      .from('adlab_kill_switches')
      .select('workspace_id, enabled, reason, activated_at')
      .neq('scope', 'global')
      .eq('enabled', true);

    return {
      global: {
        enabled: globalData?.enabled || false,
        reason: globalData?.reason || null,
        activatedAt: globalData?.activated_at || null,
      },
      workspace: (workspaceData || []).map((w) => ({
        workspaceId: w.workspace_id,
        enabled: w.enabled,
        reason: w.reason,
        activatedAt: w.activated_at,
      })),
    };
  } catch {
    return {
      global: { enabled: false, reason: null, activatedAt: null },
      workspace: [],
    };
  }
}

async function getFailureInjectionState() {
  try {
    const supabase = createEvidenceClient();

    const { data } = await supabase
      .from('adlab_failure_injections')
      .select('action, failure_type, probability, workspace_id')
      .eq('enabled', true);

    return {
      activeConfigs: (data || []).map((c) => ({
        action: c.action,
        failureType: c.failure_type,
        probability: c.probability,
        workspaceId: c.workspace_id,
      })),
    };
  } catch {
    return { activeConfigs: [] };
  }
}

async function getFreshnessState(workspaceId: string) {
  try {
    // Get workspace overrides
    const { data: overrides } = await listOverrides(workspaceId);
    const freshnessOverrides = (overrides || []).filter((o) =>
      o.key.startsWith('freshness.')
    );

    // Build defaults
    const defaults: Record<string, {
      warnAfterMinutes: number;
      failAfterMinutes: number;
      critical: boolean;
    }> = {};

    for (const key of ALL_DATASET_KEYS) {
      const policy = DEFAULT_FRESHNESS_POLICIES[key];
      defaults[key] = {
        warnAfterMinutes: policy.warnAfterMinutes,
        failAfterMinutes: policy.failAfterMinutes,
        critical: policy.critical,
      };
    }

    return {
      defaults,
      workspaceOverrides: freshnessOverrides.map((o) => ({
        workspaceId: o.workspaceId,
        key: o.key,
        value: o.valueJson,
        reason: o.reason,
        expiresAt: o.expiresAt,
      })),
    };
  } catch {
    return {
      defaults: {},
      workspaceOverrides: [],
    };
  }
}

async function getActiveSnapshots() {
  try {
    const supabase = createEvidenceClient();

    const { data } = await supabase
      .from('adlab_production_snapshots')
      .select('id, dataset, ingestion_log_id, created_at, workspace_id, platform')
      .eq('is_active', true)
      .order('platform')
      .order('dataset');

    return (data || []).map((s) => ({
      dataset: s.dataset,
      snapshotId: s.id,
      ingestionLogId: s.ingestion_log_id,
      promotedAt: s.created_at,
      workspaceId: s.workspace_id,
      platform: s.platform,
    }));
  } catch {
    return [];
  }
}

async function getGoLiveGateStatus() {
  try {
    const supabase = createEvidenceClient();

    // Get last go-live gate result from audit logs
    const { data } = await supabase
      .from('adlab_audit_logs')
      .select('created_at, metadata')
      .eq('scope_dataset', 'go_live_gate')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const metadata = data.metadata as Record<string, unknown> | null;
      return {
        status: (metadata?.gateResult as 'PASS' | 'FAIL') || 'UNKNOWN',
        timestamp: data.created_at,
        failedChecks: (metadata?.failedChecks as string[]) || [],
      };
    }

    return { status: 'UNKNOWN' as const, timestamp: null, failedChecks: [] };
  } catch {
    return { status: 'UNKNOWN' as const, timestamp: null, failedChecks: [] };
  }
}

async function getComplianceState(workspaceId: string) {
  try {
    const result = await checkWorkspaceCompliance(workspaceId);

    return {
      currentStatus: result.status,
      driftTypes: result.driftItems.map((d) => d.type),
      lastCheckedAt: result.timestamp,
      slaThresholds: {
        warnMinutes: 30,
        failMinutes: 60,
        criticalMinutes: 120,
      },
    };
  } catch {
    return {
      currentStatus: 'FAIL' as const,
      driftTypes: ['CHECK_ERROR'],
      lastCheckedAt: new Date().toISOString(),
      slaThresholds: {
        warnMinutes: 30,
        failMinutes: 60,
        criticalMinutes: 120,
      },
    };
  }
}

async function getAuditCoverage() {
  try {
    const supabase = createEvidenceClient();

    // Get total count
    const { count: totalCount } = await supabase
      .from('adlab_audit_logs')
      .select('id', { count: 'exact', head: true });

    // Get events by action type (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentEvents } = await supabase
      .from('adlab_audit_logs')
      .select('action')
      .gte('created_at', thirtyDaysAgo);

    const eventsByType: Record<string, number> = {};
    for (const event of recentEvents || []) {
      const action = event.action || 'UNKNOWN';
      eventsByType[action] = (eventsByType[action] || 0) + 1;
    }

    // Get most recent critical events (PROMOTE, ROLLBACK, SNAPSHOT_ACTIVATE, etc.)
    const { data: criticalEvents } = await supabase
      .from('adlab_audit_logs')
      .select('id, action, created_at, actor_id, entity_type')
      .in('action', ['PROMOTE', 'ROLLBACK', 'SNAPSHOT_ACTIVATE', 'SNAPSHOT_DEACTIVATE'])
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      totalAuditEvents: totalCount || 0,
      eventsByType,
      mostRecentCriticalEvents: (criticalEvents || []).map((e) => ({
        id: e.id,
        action: e.action,
        timestamp: e.created_at,
        actorId: e.actor_id,
        entityType: e.entity_type,
      })),
    };
  } catch {
    return {
      totalAuditEvents: 0,
      eventsByType: {},
      mostRecentCriticalEvents: [],
    };
  }
}

async function getRBACState(workspaceId: string) {
  try {
    const supabase = createEvidenceClient();

    // Get workspace memberships
    const { data: memberships, count } = await supabase
      .from('adlab_workspace_memberships')
      .select('user_id, role', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    const rolesMatrix: {
      owner: string[];
      admin: string[];
      editor: string[];
      viewer: string[];
    } = {
      owner: [],
      admin: [],
      editor: [],
      viewer: [],
    };

    for (const m of memberships || []) {
      const role = m.role as keyof typeof rolesMatrix;
      if (rolesMatrix[role]) {
        rolesMatrix[role].push(m.user_id);
      }
    }

    return {
      rolesMatrix,
      workspaceMembersCount: count || 0,
      ownerCount: rolesMatrix.owner.length,
      invariantsSummary: `
RBAC Invariants:
- Owner-only: kill-switch, failure-injection, config-overrides, compliance triggers
- Admin+: promote, rollback, snapshot management
- Editor+: validate, ingest
- Viewer: read-only analytics
- All mutations require human reason
- All changes logged to immutable audit trail
- No deletions allowed on audit or config overrides
      `.trim(),
    };
  } catch {
    return {
      rolesMatrix: { owner: [], admin: [], editor: [], viewer: [] },
      workspaceMembersCount: 0,
      ownerCount: 0,
      invariantsSummary: 'RBAC state unavailable',
    };
  }
}

// ============================================
// Checksum Generator
// ============================================

function generateChecksum(payload: Omit<EvidencePayload, 'metadata'>): string {
  const content = JSON.stringify(payload, null, 0);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ============================================
// Main Handler
// ============================================

export async function GET(): Promise<NextResponse> {
  const generatedAt = new Date().toISOString();

  try {
    // Resolve actor
    const actor = await resolveActorFromRequest();

    // Owner or Admin only
    if (!hasAtLeastRole(actor.role, 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Owner or Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all evidence data in parallel
    const [
      readiness,
      killSwitch,
      failureInjection,
      freshness,
      activeSnapshots,
      goLiveGate,
      compliance,
      auditCoverage,
      rbac,
    ] = await Promise.all([
      checkProductionReadiness(),
      getKillSwitchState(),
      getFailureInjectionState(),
      getFreshnessState(actor.workspaceId),
      getActiveSnapshots(),
      getGoLiveGateStatus(),
      getComplianceState(actor.workspaceId),
      getAuditCoverage(),
      getRBACState(actor.workspaceId),
    ]);

    // Get guard coverage
    const guardCoverage = verifyCoverage();

    // Build evidence payload (without metadata for checksum)
    const payloadWithoutChecksum: Omit<EvidencePayload, 'metadata'> = {
      system: {
        name: 'AdLab Production Governance System',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || null,
        commitHash: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null,
        generatedAt,
      },
      governance: {
        killSwitch,
        failureInjection,
        freshnessPolicies: freshness,
        activeSnapshots,
      },
      readiness: {
        latestGoLiveGate: goLiveGate,
        readinessChecks: readiness.checks.map((c) => ({
          checkId: c.name,
          status: c.status,
          message: c.message,
          category: c.category,
        })),
      },
      compliance,
      audit: auditCoverage,
      rbac,
    };

    // Generate checksum
    const checksum = generateChecksum(payloadWithoutChecksum);

    // Full payload with metadata
    const payload: EvidencePayload = {
      ...payloadWithoutChecksum,
      metadata: {
        evidenceVersion: '1.0.0',
        disclaimer: 'Read-only evidence snapshot. This document reflects production state at generation time.',
        checksum,
      },
    };

    // Audit the evidence access
    await appendAuditLog({
      context: {
        workspaceId: actor.workspaceId,
        actorId: actor.id,
        actorRole: actor.role,
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: 'compliance-evidence',
      scope: {
        platform: 'system',
        dataset: 'compliance_evidence',
      },
      metadata: {
        evidenceAction: 'COMPLIANCE_EVIDENCE_VIEWED',
        evidenceVersion: payload.metadata.evidenceVersion,
        checksum,
        snapshotCount: activeSnapshots.length,
        auditEventCount: auditCoverage.totalAuditEvents,
        complianceStatus: compliance.currentStatus,
        timestamp: generatedAt,
      },
    });

    return NextResponse.json(
      { success: true, data: payload },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
          'X-Evidence-Checksum': checksum,
          'X-Evidence-Generated': generatedAt,
        },
      }
    );
  } catch (e) {
    if (
      e instanceof NotAuthenticatedError ||
      e instanceof MissingMembershipError ||
      e instanceof InactiveMembershipError
    ) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('D30: Evidence API error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
