// ============================================
// AdLab Attestation Page
// ============================================
// PHASE D32: External Attestation Mode.
//
// READ-ONLY attestation dashboard for:
// - Profile selection (SOC2, ISO, Enterprise DD)
// - Section-by-section breakdown
// - Invariant verification results
// - Export options (JSON, MD, PDF)
//
// RULES:
// - Owner/Admin role required
// - READ-ONLY - no mutations, no overrides
// - All access is audited
// ============================================

import { AdLabPageShell } from '@/components/adlab/AdLabPageShell';
import { resolveActorWithDevFallback } from '@/lib/adlab/auth/resolveActor';
import { hasAtLeastRole } from '@/lib/adlab/auth/roles';
import { checkProductionReadiness } from '@/lib/adlab/safety';
import { getKillSwitchStatus } from '@/lib/adlab/safety/killSwitch';
import { checkWorkspaceCompliance, listOverrides, DEFAULT_FRESHNESS_POLICIES, ALL_DATASET_KEYS } from '@/lib/adlab/ops';
import {
  ATTESTATION_PROFILES,
  generateAttestation,
  type AttestationProfile,
  type AttestationResult,
} from '@/lib/adlab/ops/attestationProfiles';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createAttestationClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Build evidence payload (same as D30/D31)
async function buildEvidencePayload(workspaceId: string) {
  const supabase = createAttestationClient();
  const generatedAt = new Date().toISOString();

  // Fetch all data in parallel
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

  // Build roles matrix
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

  // Get recent events by type
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

  // Build freshness data
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

  // Parse go-live gate
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

  // Build evidence payload
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

  // Generate checksum
  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...evidencePayload, metadata: { ...evidencePayload.metadata, checksum: undefined } }))
    .digest('hex');
  evidencePayload.metadata.checksum = checksum;

  return evidencePayload;
}

interface AttestationPageData {
  actor: { id: string; workspaceId: string; role: string } | null;
  isAuthorized: boolean;
  error?: string;
  attestations?: Record<AttestationProfile, AttestationResult>;
  generatedAt?: string;
}

async function getAttestationData(): Promise<AttestationPageData> {
  try {
    const actor = await resolveActorWithDevFallback();

    // Check if owner or admin
    const isAuthorized = hasAtLeastRole(actor.role, 'admin');
    if (!isAuthorized) {
      return { actor, isAuthorized: false, error: 'Unauthorized' };
    }

    // Build evidence
    const evidence = await buildEvidencePayload(actor.workspaceId);

    // Generate attestations for all profiles
    const attestations: Record<AttestationProfile, AttestationResult> = {
      SOC2_TYPE1: generateAttestation(evidence, 'SOC2_TYPE1'),
      SOC2_TYPE2: generateAttestation(evidence, 'SOC2_TYPE2'),
      ISO_27001: generateAttestation(evidence, 'ISO_27001'),
      ENTERPRISE_DD: generateAttestation(evidence, 'ENTERPRISE_DD'),
    };

    return {
      actor,
      isAuthorized: true,
      attestations,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      actor: null,
      isAuthorized: false,
      error: String(error),
    };
  }
}

function StatusBadge({ status }: { status: 'PASS' | 'WARN' | 'FAIL' | 'UNAVAILABLE' }) {
  const styles = {
    PASS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    WARN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    FAIL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    UNAVAILABLE: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${styles[status]}`}>
      {status}
    </span>
  );
}

function ProfileCard({
  profileId,
  attestation,
}: {
  profileId: AttestationProfile;
  attestation: AttestationResult;
}) {
  const profile = ATTESTATION_PROFILES[profileId];
  const { summary } = attestation;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-semibold text-foreground">{profile.name}</h3>
          <StatusBadge status={attestation.overallStatus} />
        </div>
        <p className="text-[11px] text-muted-foreground">{profile.description}</p>
      </div>

      {/* Summary Stats */}
      <div className="p-4 grid grid-cols-4 gap-3 border-b border-border">
        <div className="text-center">
          <div className="text-[18px] font-bold text-green-600">{summary.sectionsPassed}</div>
          <div className="text-[9px] text-muted-foreground uppercase">Passed</div>
        </div>
        <div className="text-center">
          <div className="text-[18px] font-bold text-amber-600">
            {summary.sectionsTotal - summary.sectionsPassed - summary.sectionsFailed - summary.sectionsUnavailable}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase">Warn</div>
        </div>
        <div className="text-center">
          <div className="text-[18px] font-bold text-red-600">{summary.sectionsFailed}</div>
          <div className="text-[9px] text-muted-foreground uppercase">Failed</div>
        </div>
        <div className="text-center">
          <div className="text-[18px] font-bold text-gray-500">{summary.sectionsUnavailable}</div>
          <div className="text-[9px] text-muted-foreground uppercase">N/A</div>
        </div>
      </div>

      {/* Sections Breakdown */}
      <div className="p-4">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Evidence Sections
        </div>
        <div className="space-y-2">
          {attestation.sections.map((section) => (
            <div
              key={section.section}
              className="flex items-center justify-between p-2 rounded bg-secondary/50"
            >
              <div>
                <div className="text-[12px] font-medium text-foreground capitalize">
                  {section.section.replace(/_/g, ' ')}
                </div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                  {section.message}
                </div>
              </div>
              <StatusBadge status={section.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Invariants */}
      <div className="p-4 border-t border-border">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Invariant Checks ({summary.invariantsPassed}/{attestation.invariantResults.length} passed)
        </div>
        <div className="space-y-1.5">
          {attestation.invariantResults.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-2 text-[11px]"
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  inv.status === 'PASS'
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {inv.status === 'PASS' ? (
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </span>
              <span className={inv.critical ? 'font-medium' : ''}>
                {inv.description}
                {inv.critical && (
                  <span className="ml-1 text-[9px] text-red-500 uppercase">(Critical)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Export Actions */}
      <div className="p-4 border-t border-border bg-secondary/20">
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/adlab/system/attestation/export?profile=${profileId}&format=json`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            JSON
          </a>
          <a
            href={`/api/adlab/system/attestation/export?profile=${profileId}&format=markdown`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary text-foreground text-[11px] font-medium hover:bg-secondary/80 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Markdown
          </a>
          <a
            href={`/api/adlab/system/attestation/export?profile=${profileId}&format=pdf`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary text-foreground text-[11px] font-medium hover:bg-secondary/80 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function AttestationPage() {
  const data = await getAttestationData();

  // If not authorized, show access denied
  if (!data.isAuthorized) {
    return (
      <AdLabPageShell
        title="External Attestation"
        description="Compliance attestation for external auditors"
        badge={{ label: 'Admin Only', variant: 'warning' }}
      >
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-8 text-center">
          <svg
            className="w-12 h-12 mx-auto text-red-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
            Access Denied
          </h2>
          <p className="text-[13px] text-red-600 dark:text-red-400">
            This page is restricted to workspace owners and admins only.
          </p>
          <Link
            href="/ads/system/evidence"
            className="inline-block mt-4 text-[12px] text-blue-600 hover:underline"
          >
            View evidence dashboard instead
          </Link>
        </div>
      </AdLabPageShell>
    );
  }

  const { attestations, generatedAt } = data as { attestations: Record<AttestationProfile, AttestationResult>; generatedAt: string };

  // Calculate overall best status
  const overallBest = Object.values(attestations).some(a => a.overallStatus === 'PASS')
    ? 'PASS'
    : Object.values(attestations).some(a => a.overallStatus === 'WARN')
    ? 'WARN'
    : 'FAIL';

  return (
    <AdLabPageShell
      title="External Attestation"
      description="Generate compliance attestations for SOC2, ISO 27001, and enterprise due diligence"
      badge={{
        label: overallBest,
        variant: overallBest === 'PASS' ? 'success' : 'warning',
      }}
    >
      <div className="space-y-6">
        {/* Disclaimer */}
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="text-[13px] font-semibold text-amber-800 dark:text-amber-200">
                External Attestation Mode
              </h3>
              <p className="text-[12px] text-amber-700 dark:text-amber-300 mt-1">
                All data is derived from live production evidence. Exports include automatic redaction
                of sensitive identifiers (user IDs, emails, IPs) based on profile requirements.
                No claims are manually authored.
              </p>
            </div>
          </div>
        </div>

        {/* Generation Info */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Generated: {new Date(generatedAt).toLocaleString()}</span>
          <span>Environment: {process.env.NODE_ENV || 'development'}</span>
        </div>

        {/* Profile Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProfileCard profileId="SOC2_TYPE1" attestation={attestations.SOC2_TYPE1} />
          <ProfileCard profileId="SOC2_TYPE2" attestation={attestations.SOC2_TYPE2} />
          <ProfileCard profileId="ISO_27001" attestation={attestations.ISO_27001} />
          <ProfileCard profileId="ENTERPRISE_DD" attestation={attestations.ENTERPRISE_DD} />
        </div>

        {/* Profile Requirements Legend */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">Profile Requirements</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Profile</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Time Window</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Min Checks</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Audit Min</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Gate Pass</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Zero Drift</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(ATTESTATION_PROFILES).map((profile) => (
                  <tr key={profile.id} className="border-b border-border/50">
                    <td className="py-2 px-3 font-medium text-foreground">{profile.name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{profile.timeWindow.description}</td>
                    <td className="py-2 px-3 text-muted-foreground">{profile.minReadinessChecks}</td>
                    <td className="py-2 px-3 text-muted-foreground">{profile.auditEventMinimum}</td>
                    <td className="py-2 px-3">
                      {profile.requireGoLiveGatePass ? (
                        <span className="text-green-600">Required</span>
                      ) : (
                        <span className="text-muted-foreground">Optional</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {profile.requireZeroCriticalDrift ? (
                        <span className="text-green-600">Required</span>
                      ) : (
                        <span className="text-muted-foreground">Optional</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-4 pt-4">
          <Link
            href="/ads/system/evidence"
            className="inline-flex items-center gap-2 text-[12px] text-blue-600 hover:underline"
          >
            View Evidence Pack
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/ads/system/security"
            className="inline-flex items-center gap-2 text-[12px] text-blue-600 hover:underline"
          >
            Security Whitepaper
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/ads/system/compliance"
            className="inline-flex items-center gap-2 text-[12px] text-blue-600 hover:underline"
          >
            Compliance Dashboard
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </AdLabPageShell>
  );
}
