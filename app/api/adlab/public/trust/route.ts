// ============================================
// AdLab Public Trust API (Zero-Auth)
// ============================================
// PHASE D33: Public Trust Portal.
//
// PROVIDES:
// - GET: Public trust verification via signed token
//
// INVARIANTS:
// - ZERO authentication required
// - Token-based access control
// - All content from D30/D32 evidence
// - PII redaction enforced
// - Invalid/expired tokens return 404 (no info leak)
// - All access audited
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyTrustToken } from '@/lib/adlab/ops/trustTokens';
import {
  generateAttestation,
  applyRedactions,
  getProfile,
} from '@/lib/adlab/ops/attestationProfiles';
import { checkProductionReadiness } from '@/lib/adlab/safety';
import { checkWorkspaceCompliance, listOverrides, DEFAULT_FRESHNESS_POLICIES, ALL_DATASET_KEYS } from '@/lib/adlab/ops';
import { getKillSwitchStatus } from '@/lib/adlab/safety/killSwitch';
import { appendAuditLog } from '@/lib/adlab/audit';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Supabase Client
// ============================================

function createTrustClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Evidence Builder (Same as D32)
// ============================================

async function buildEvidencePayload(workspaceId: string) {
  const supabase = createTrustClient();
  const generatedAt = new Date().toISOString();

  const [
    readiness,
    killSwitchResult,
    complianceResult,
    overridesResult,
    snapshotsResult,
    auditCountResult,
    recentAuditResult,
    membershipsResult,
    goLiveResult,
    failureInjectionResult,
  ] = await Promise.all([
    checkProductionReadiness(),
    getKillSwitchStatus(workspaceId),
    checkWorkspaceCompliance(workspaceId),
    listOverrides(workspaceId),
    supabase
      .from('adlab_production_snapshots')
      .select('id, dataset, platform, created_at, ingestion_log_id, workspace_id')
      .eq('is_active', true),
    supabase.from('adlab_audit_logs').select('id', { count: 'exact', head: true }),
    supabase
      .from('adlab_audit_logs')
      .select('id, action, created_at, actor_id, entity_type')
      .in('action', ['PROMOTE', 'ROLLBACK', 'SNAPSHOT_ACTIVATE', 'SNAPSHOT_DEACTIVATE'])
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('adlab_workspace_memberships')
      .select('user_id, role', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('is_active', true),
    supabase
      .from('adlab_audit_logs')
      .select('created_at, metadata')
      .eq('scope_dataset', 'go_live_gate')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('adlab_failure_injections')
      .select('action, failure_type, probability, workspace_id')
      .eq('enabled', true),
  ]);

  const rolesMatrix: { owner: string[]; admin: string[]; editor: string[]; viewer: string[] } = {
    owner: [],
    admin: [],
    editor: [],
    viewer: [],
  };

  for (const m of membershipsResult.data || []) {
    const role = m.role as keyof typeof rolesMatrix;
    if (rolesMatrix[role]) {
      rolesMatrix[role].push(m.user_id);
    }
  }

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

  const freshnessOverrides = (overridesResult.data || []).filter((o) =>
    o.key.startsWith('freshness.')
  );

  const freshnessDefaults: Record<string, { warnAfterMinutes: number; failAfterMinutes: number; critical: boolean }> = {};
  for (const key of ALL_DATASET_KEYS) {
    const policy = DEFAULT_FRESHNESS_POLICIES[key];
    freshnessDefaults[key] = {
      warnAfterMinutes: policy.warnAfterMinutes,
      failAfterMinutes: policy.failAfterMinutes,
      critical: policy.critical,
    };
  }

  const goLiveGate = {
    status: 'UNKNOWN' as 'PASS' | 'FAIL' | 'UNKNOWN',
    timestamp: null as string | null,
    failedChecks: [] as string[],
  };

  if (goLiveResult.data) {
    const metadata = goLiveResult.data.metadata as Record<string, unknown> | null;
    goLiveGate.status = (metadata?.gateResult as 'PASS' | 'FAIL') || 'UNKNOWN';
    goLiveGate.timestamp = goLiveResult.data.created_at;
    goLiveGate.failedChecks = (metadata?.failedChecks as string[]) || [];
  }

  const evidencePayload = {
    system: {
      name: 'AdLab Production Governance System',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || null,
      commitHash: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null,
      generatedAt,
    },
    governance: {
      killSwitch: {
        global: {
          enabled: killSwitchResult?.blocked || false,
          reason: killSwitchResult?.reason || null,
          activatedAt: null,
        },
        workspace: [],
      },
      failureInjection: {
        activeConfigs: (failureInjectionResult.data || []).map((c) => ({
          action: c.action,
          failureType: c.failure_type,
          probability: c.probability,
          workspaceId: c.workspace_id,
        })),
      },
      freshnessPolicies: {
        defaults: freshnessDefaults,
        workspaceOverrides: freshnessOverrides.map((o) => ({
          workspaceId: o.workspaceId,
          key: o.key,
          value: o.valueJson,
          reason: o.reason,
          expiresAt: o.expiresAt,
        })),
      },
      activeSnapshots: (snapshotsResult.data || []).map((s) => ({
        dataset: s.dataset,
        snapshotId: s.id,
        ingestionLogId: s.ingestion_log_id,
        promotedAt: s.created_at,
        workspaceId: s.workspace_id,
        platform: s.platform,
      })),
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
    compliance: {
      currentStatus: complianceResult.status,
      driftTypes: complianceResult.driftItems.map((d) => d.type),
      lastCheckedAt: complianceResult.timestamp,
      slaThresholds: {
        warnMinutes: 30,
        failMinutes: 60,
        criticalMinutes: 120,
      },
    },
    audit: {
      totalAuditEvents: auditCountResult.count || 0,
      eventsByType,
      mostRecentCriticalEvents: (recentAuditResult.data || []).map((e) => ({
        id: e.id,
        action: e.action,
        timestamp: e.created_at,
        actorId: e.actor_id,
        entityType: e.entity_type,
      })),
    },
    rbac: {
      rolesMatrix,
      workspaceMembersCount: membershipsResult.count || 0,
      ownerCount: rolesMatrix.owner.length,
      invariantsSummary: `RBAC Invariants: Owner-only: kill-switch, failure-injection, config-overrides, compliance triggers. Admin+: promote, rollback, snapshot management. Editor+: validate, ingest. Viewer: read-only analytics. All mutations require human reason. All changes logged to immutable audit trail.`,
    },
    metadata: {
      evidenceVersion: '1.0.0',
      disclaimer: 'Read-only evidence snapshot. This document reflects production state at generation time.',
      checksum: '',
    },
  };

  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...evidencePayload, metadata: { ...evidencePayload.metadata, checksum: undefined } }))
    .digest('hex');
  evidencePayload.metadata.checksum = checksum;

  return evidencePayload;
}

// ============================================
// Main Handler
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  // No token = 404 (no info leak)
  if (!token) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  // Verify token
  const verifyResult = await verifyTrustToken(token);

  // Invalid/expired/revoked = 404 (no info leak)
  if (!verifyResult.valid || !verifyResult.payload || !verifyResult.tokenRecord) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  const { payload, tokenRecord } = verifyResult;
  const profile = payload.scope.profile;

  try {
    // Build evidence
    const evidence = await buildEvidencePayload(payload.workspaceId);

    // Generate attestation
    const attestation = generateAttestation(evidence, profile);

    // Check for critical failures - return 412 if attestation fails
    if (attestation.summary.criticalFailures > 0) {
      await appendAuditLog({
        context: {
          workspaceId: payload.workspaceId,
          actorId: 'public',
          actorRole: 'viewer',
        },
        action: 'VALIDATE',
        entityType: 'public_trust',
        entityId: payload.tokenId,
        scope: {
          platform: 'system',
          dataset: 'public_trust',
        },
        metadata: {
          trustAction: 'PUBLIC_TRUST_FAILED',
          profile,
          criticalFailures: attestation.summary.criticalFailures,
          overallStatus: attestation.overallStatus,
        },
      });

      return NextResponse.json(
        {
          error: 'Attestation requirements not met',
          profile: attestation.profileName,
          status: attestation.overallStatus,
        },
        { status: 412 }
      );
    }

    // Apply redactions based on profile
    const profileDef = getProfile(profile);
    const redactedAttestation = applyRedactions(attestation, profileDef.redactionTargets);

    // Build public response
    const publicResponse = {
      profile: {
        id: profile,
        name: attestation.profileName,
        description: profileDef.description,
      },
      status: attestation.overallStatus,
      timestamp: attestation.timestamp,
      environment: attestation.environment,
      sections: redactedAttestation.sections.map((s) => ({
        section: s.section,
        status: s.status,
        message: s.message,
        dataPoints: s.dataPoints,
      })),
      invariants: {
        passed: attestation.summary.invariantsPassed,
        total: attestation.invariantResults.length,
        results: redactedAttestation.invariantResults.map((i) => ({
          id: i.id,
          description: i.description,
          status: i.status,
          critical: i.critical,
        })),
      },
      summary: {
        sectionsTotal: attestation.summary.sectionsTotal,
        sectionsPassed: attestation.summary.sectionsPassed,
        sectionsWarning: attestation.summary.sectionsTotal - attestation.summary.sectionsPassed - attestation.summary.sectionsFailed - attestation.summary.sectionsUnavailable,
        sectionsFailed: attestation.summary.sectionsFailed,
        sectionsUnavailable: attestation.summary.sectionsUnavailable,
      },
      integrity: {
        evidenceChecksum: attestation.evidenceChecksum,
        attestationChecksum: attestation.attestationChecksum,
      },
      token: {
        expiresAt: tokenRecord.expiresAt,
        issuedAt: tokenRecord.issuedAt,
      },
      disclaimer: 'This attestation was generated from live production evidence. All data points are derived from system state. No claims are manually authored. PII has been redacted per profile requirements.',
    };

    // Audit successful access
    await appendAuditLog({
      context: {
        workspaceId: payload.workspaceId,
        actorId: 'public',
        actorRole: 'viewer',
      },
      action: 'VALIDATE',
      entityType: 'public_trust',
      entityId: payload.tokenId,
      scope: {
        platform: 'system',
        dataset: 'public_trust',
      },
      metadata: {
        trustAction: 'PUBLIC_TRUST_VIEWED',
        profile,
        overallStatus: attestation.overallStatus,
        checksum: attestation.attestationChecksum,
      },
    });

    return NextResponse.json(publicResponse, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
        'X-Trust-Profile': profile,
        'X-Trust-Checksum': attestation.attestationChecksum,
        'X-Trust-Generated': attestation.timestamp,
      },
    });
  } catch (error) {
    console.error('D33: Public trust error:', error);

    // Evidence unavailable = 503
    return NextResponse.json(
      { error: 'Evidence temporarily unavailable' },
      { status: 503 }
    );
  }
}
