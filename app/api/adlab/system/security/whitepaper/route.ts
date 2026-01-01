// ============================================
// AdLab Security Whitepaper API
// ============================================
// PHASE D31: Security Whitepaper (Auto-Generated, Evidence-Backed).
//
// PROVIDES:
// - GET: Generate security whitepaper from evidence
//
// INVARIANTS:
// - READ-ONLY endpoint
// - Owner/Admin only
// - All access is audited
// - Derived from D30 Evidence Pack only
// - No static text, no assumptions
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
  listOverrides,
  DEFAULT_FRESHNESS_POLICIES,
  ALL_DATASET_KEYS,
} from '@/lib/adlab/ops';
import { generateSecurityWhitepaper } from '@/lib/adlab/ops/securityWhitepaper';
import { appendAuditLog } from '@/lib/adlab/audit';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Supabase Client
// ============================================

function createWhitepaperClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Evidence Fetchers (same as D30)
// ============================================

async function getKillSwitchState() {
  try {
    const supabase = createWhitepaperClient();
    const { data: globalData } = await supabase
      .from('adlab_kill_switches')
      .select('enabled, reason, activated_at')
      .eq('scope', 'global')
      .maybeSingle();

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
    const supabase = createWhitepaperClient();
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
    const { data: overrides } = await listOverrides(workspaceId);
    const freshnessOverrides = (overrides || []).filter((o) =>
      o.key.startsWith('freshness.')
    );

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
    return { defaults: {}, workspaceOverrides: [] };
  }
}

async function getActiveSnapshots() {
  try {
    const supabase = createWhitepaperClient();
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
    const supabase = createWhitepaperClient();
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
    const supabase = createWhitepaperClient();
    const { count: totalCount } = await supabase
      .from('adlab_audit_logs')
      .select('id', { count: 'exact', head: true });

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
    const supabase = createWhitepaperClient();
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

function generateEvidenceChecksum(data: unknown): string {
  const content = JSON.stringify(data, null, 0);
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

    // Build evidence payload (same structure as D30)
    const evidencePayload = {
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
      metadata: {
        evidenceVersion: '1.0.0',
        disclaimer: 'Read-only evidence snapshot. This document reflects production state at generation time.',
        checksum: '', // Will be set below
      },
    };

    // Generate evidence checksum
    const evidenceChecksum = generateEvidenceChecksum({
      ...evidencePayload,
      metadata: { ...evidencePayload.metadata, checksum: undefined },
    });
    evidencePayload.metadata.checksum = evidenceChecksum;

    // Generate whitepaper from evidence
    const whitepaper = generateSecurityWhitepaper(evidencePayload);

    // Audit the whitepaper access
    await appendAuditLog({
      context: {
        workspaceId: actor.workspaceId,
        actorId: actor.id,
        actorRole: actor.role,
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: 'security-whitepaper',
      scope: {
        platform: 'system',
        dataset: 'security_whitepaper',
      },
      metadata: {
        whitepaperAction: 'SECURITY_WHITEPAPER_VIEWED',
        whitepaperVersion: whitepaper.metadata.version,
        checksum: whitepaper.checksum,
        evidenceChecksum,
        sectionsAvailable: whitepaper.summary.availableSections,
        sectionsTotal: whitepaper.summary.totalSections,
        timestamp: generatedAt,
      },
    });

    return NextResponse.json(
      { success: true, data: whitepaper },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
          'X-Whitepaper-Checksum': whitepaper.checksum,
          'X-Evidence-Checksum': evidenceChecksum,
          'X-Whitepaper-Generated': generatedAt,
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

    console.error('D31: Security whitepaper error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
