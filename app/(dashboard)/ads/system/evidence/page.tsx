// ============================================
// AdLab Evidence Page
// ============================================
// PHASE D30: Production Evidence Pack & External Audit Export.
//
// READ-ONLY evidence dashboard for:
// - System identity
// - Governance state
// - Readiness & gate status
// - Compliance drift status
// - Audit coverage proof
// - RBAC & membership model
//
// RULES:
// - Owner/Admin role required
// - READ-ONLY - no mutations
// - All access is audited
// ============================================

import { AdLabPageShell } from '@/components/adlab/AdLabPageShell';
import { resolveActorWithDevFallback } from '@/lib/adlab/auth/resolveActor';
import { hasAtLeastRole } from '@/lib/adlab/auth/roles';
import { checkProductionReadiness } from '@/lib/adlab/safety';
import { getKillSwitchStatus } from '@/lib/adlab/safety/killSwitch';
import { listInjectionConfigs } from '@/lib/adlab/safety/failureInjection';
import { checkWorkspaceCompliance, listOverrides, DEFAULT_FRESHNESS_POLICIES, ALL_DATASET_KEYS } from '@/lib/adlab/ops';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createEvidenceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getEvidenceData() {
  try {
    const actor = await resolveActorWithDevFallback();

    // Check if owner or admin
    const isAuthorized = hasAtLeastRole(actor.role, 'admin');
    if (!isAuthorized) {
      return { actor, isAuthorized: false, error: 'Unauthorized' };
    }

    const supabase = createEvidenceClient();

    // Fetch all data in parallel
    const [
      readiness,
      killSwitchStatus,
      injectionResult,
      complianceResult,
      overridesResult,
      snapshotsResult,
      auditCountResult,
      recentAuditResult,
      membershipsResult,
    ] = await Promise.all([
      checkProductionReadiness(),
      getKillSwitchStatus(actor.workspaceId),
      listInjectionConfigs(actor.workspaceId),
      checkWorkspaceCompliance(actor.workspaceId),
      listOverrides(actor.workspaceId),
      supabase
        .from('adlab_production_snapshots')
        .select('id, dataset, platform, created_at')
        .eq('is_active', true)
        .eq('workspace_id', actor.workspaceId),
      supabase.from('adlab_audit_logs').select('id', { count: 'exact', head: true }),
      supabase
        .from('adlab_audit_logs')
        .select('id, action, created_at, entity_type')
        .in('action', ['PROMOTE', 'ROLLBACK', 'SNAPSHOT_ACTIVATE', 'SNAPSHOT_DEACTIVATE'])
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('adlab_workspace_memberships')
        .select('user_id, role', { count: 'exact' })
        .eq('workspace_id', actor.workspaceId)
        .eq('is_active', true),
    ]);

    // Count by role
    const roleCounts = { owner: 0, admin: 0, editor: 0, viewer: 0 };
    for (const m of membershipsResult.data || []) {
      const role = m.role as keyof typeof roleCounts;
      if (roleCounts[role] !== undefined) {
        roleCounts[role]++;
      }
    }

    return {
      actor,
      isAuthorized: true,
      system: {
        name: 'AdLab Production Governance System',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || null,
        commitHash: process.env.VERCEL_GIT_COMMIT_SHA || null,
        generatedAt: new Date().toISOString(),
      },
      readiness,
      killSwitch: killSwitchStatus,
      injectionConfigs: injectionResult.configs || [],
      compliance: complianceResult,
      freshnessOverrides: (overridesResult.data || []).filter((o) =>
        o.key.startsWith('freshness.')
      ),
      activeSnapshots: snapshotsResult.data || [],
      auditCount: auditCountResult.count || 0,
      recentCriticalEvents: recentAuditResult.data || [],
      roleCounts,
      memberCount: membershipsResult.count || 0,
    };
  } catch (error) {
    return {
      actor: null,
      isAuthorized: false,
      error: String(error),
    };
  }
}

export default async function EvidencePage() {
  const data = await getEvidenceData();

  // If not authorized, show access denied
  if (!data.isAuthorized) {
    return (
      <AdLabPageShell
        title="Production Evidence"
        description="Compliance evidence pack for auditors"
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
            href="/ads/system/compliance"
            className="inline-block mt-4 text-[12px] text-blue-600 hover:underline"
          >
            View compliance dashboard instead
          </Link>
        </div>
      </AdLabPageShell>
    );
  }

  const {
    system,
    readiness,
    killSwitch,
    injectionConfigs,
    compliance,
    activeSnapshots,
    auditCount,
    recentCriticalEvents,
    roleCounts,
    memberCount,
  } = data as Exclude<typeof data, { isAuthorized: false }>;

  // Calculate overall status
  const readinessOk = readiness?.status === 'READY';
  const complianceOk = compliance?.status === 'PASS';
  const overallStatus =
    complianceOk && readinessOk
      ? 'PASS'
      : compliance?.status === 'FAIL' || readiness?.status === 'BLOCKED'
      ? 'FAIL'
      : 'WARN';

  return (
    <AdLabPageShell
      title="Production Evidence"
      description="Compliance evidence pack for external auditors, security reviews, and enterprise procurement"
      badge={{
        label: overallStatus,
        variant: overallStatus === 'PASS' ? 'success' : 'warning',
      }}
    >
      <div className="space-y-6">
        {/* Export Actions */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/adlab/system/compliance/evidence/export?format=json"
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export JSON
          </a>
          <a
            href="/api/adlab/system/compliance/evidence/export?format=markdown"
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-[12px] font-medium hover:bg-secondary/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Markdown
          </a>
          <a
            href="/api/adlab/system/compliance/evidence/export?format=pdf"
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-[12px] font-medium hover:bg-secondary/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export HTML/PDF
          </a>
        </div>

        {/* Disclaimer */}
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-[13px] font-semibold text-blue-800 dark:text-blue-200">
                Evidence Disclaimer
              </h3>
              <p className="text-[12px] text-blue-700 dark:text-blue-300 mt-1">
                This is a read-only evidence snapshot reflecting production state at generation time.
                For external audits, please export the full evidence pack using the buttons above.
              </p>
            </div>
          </div>
        </div>

        {/* A. System Identity */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[11px] font-bold">
              A
            </span>
            System Identity
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Name</div>
              <div className="text-[13px] font-medium text-foreground mt-1">{system?.name}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Environment</div>
              <div className="text-[13px] font-medium text-foreground mt-1">{system?.environment}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Version</div>
              <div className="text-[13px] font-medium text-foreground mt-1">{system?.version || 'N/A'}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Commit</div>
              <div className="text-[13px] font-mono text-foreground mt-1">
                {system?.commitHash ? system.commitHash.substring(0, 8) : 'N/A'}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-[11px] text-muted-foreground">
              Generated: {system?.generatedAt}
            </div>
          </div>
        </div>

        {/* B. Governance State */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[11px] font-bold">
              B
            </span>
            Governance State
          </h2>

          <div className="space-y-4">
            {/* Kill Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
              <div>
                <div className="text-[13px] font-medium text-foreground">Kill Switch</div>
                <div className="text-[11px] text-muted-foreground">Emergency stop status</div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-[12px] font-medium ${
                  killSwitch?.blocked
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}
              >
                {killSwitch?.blocked ? 'ACTIVE' : 'INACTIVE'}
              </div>
            </div>

            {/* Failure Injection */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
              <div>
                <div className="text-[13px] font-medium text-foreground">Failure Injection</div>
                <div className="text-[11px] text-muted-foreground">Active chaos tests</div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-[12px] font-medium ${
                  injectionConfigs?.some((c) => c.enabled)
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-secondary text-muted-foreground border border-border'
                }`}
              >
                {injectionConfigs?.filter((c) => c.enabled).length || 0} ACTIVE
              </div>
            </div>

            {/* Active Snapshots */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
              <div>
                <div className="text-[13px] font-medium text-foreground">Active Snapshots</div>
                <div className="text-[11px] text-muted-foreground">Production data versions</div>
              </div>
              <div className="px-3 py-1 rounded-full text-[12px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {activeSnapshots?.length || 0} ACTIVE
              </div>
            </div>
          </div>
        </div>

        {/* C. Readiness & Gate */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[11px] font-bold">
              C
            </span>
            Readiness & Gate Status
          </h2>

          <div className="flex items-center gap-4 mb-4">
            <div className="text-[13px] text-muted-foreground">Overall Status:</div>
            <div
              className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                readiness?.status === 'READY'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : readiness?.status === 'DEGRADED'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {readiness?.status || 'UNKNOWN'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Check</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Category</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {readiness?.checks?.map((check, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 px-3 font-medium text-foreground">{check.name}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          check.status === 'PASS'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : check.status === 'WARN'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {check.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{check.category}</td>
                    <td className="py-2 px-3 text-muted-foreground truncate max-w-[300px]">
                      {check.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* D. Compliance Drift Status */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center text-[11px] font-bold">
              D
            </span>
            Compliance Drift Status
          </h2>

          <div className="flex items-center gap-4 mb-4">
            <div className="text-[13px] text-muted-foreground">Current Status:</div>
            <div
              className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                compliance?.status === 'PASS'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : compliance?.status === 'WARN'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {compliance?.status || 'UNKNOWN'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {compliance?.driftItems?.length || 0} drift items
            </div>
          </div>

          {compliance?.driftItems && compliance.driftItems.length > 0 && (
            <div className="mt-4">
              <div className="text-[12px] font-medium text-muted-foreground mb-2">Drift Items:</div>
              <div className="space-y-2">
                {compliance.driftItems.slice(0, 5).map((drift, i) => (
                  <div key={i} className="p-2 rounded bg-secondary text-[12px]">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-2 ${
                        drift.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-700'
                          : drift.severity === 'HIGH'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {drift.severity}
                    </span>
                    <span className="text-foreground">{drift.type}</span>
                    {drift.message && (
                      <span className="text-muted-foreground ml-2">- {drift.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border text-[11px] text-muted-foreground">
            Last checked: {compliance?.timestamp}
          </div>
        </div>

        {/* E. Audit Coverage Proof */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[11px] font-bold">
              E
            </span>
            Audit Coverage Proof
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 rounded-lg bg-secondary">
              <div className="text-[24px] font-bold text-foreground">
                {auditCount?.toLocaleString() || 0}
              </div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Total Audit Events
              </div>
            </div>
            <div className="p-4 rounded-lg bg-secondary">
              <div className="text-[24px] font-bold text-foreground">
                {recentCriticalEvents?.length || 0}
              </div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Recent Critical Events
              </div>
            </div>
          </div>

          {recentCriticalEvents && recentCriticalEvents.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Timestamp</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Action</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Entity Type</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCriticalEvents.map((event) => (
                    <tr key={event.id} className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">
                        {new Date(event.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-medium text-foreground">{event.action}</td>
                      <td className="py-2 px-3 text-muted-foreground">{event.entity_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* F. RBAC & Membership Model */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center text-[11px] font-bold">
              F
            </span>
            RBAC & Membership Model
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-secondary text-center">
              <div className="text-[20px] font-bold text-foreground">{memberCount || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary text-center">
              <div className="text-[20px] font-bold text-red-600">{roleCounts?.owner || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Owners</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary text-center">
              <div className="text-[20px] font-bold text-amber-600">{roleCounts?.admin || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Admins</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary text-center">
              <div className="text-[20px] font-bold text-blue-600">{roleCounts?.editor || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Editors</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary text-center">
              <div className="text-[20px] font-bold text-foreground">{roleCounts?.viewer || 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Viewers</div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary">
            <div className="text-[12px] font-medium text-foreground mb-2">RBAC Invariants</div>
            <ul className="text-[11px] text-muted-foreground space-y-1">
              <li>• Owner-only: kill-switch, failure-injection, config-overrides, compliance triggers</li>
              <li>• Admin+: promote, rollback, snapshot management</li>
              <li>• Editor+: validate, ingest</li>
              <li>• Viewer: read-only analytics</li>
              <li>• All mutations require human reason</li>
              <li>• All changes logged to immutable audit trail</li>
              <li>• No deletions allowed on audit or config overrides</li>
            </ul>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-4 pt-4">
          <Link
            href="/ads/system/compliance"
            className="inline-flex items-center gap-2 text-[12px] text-blue-600 hover:underline"
          >
            View Compliance Dashboard
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/ads/system/controls"
            className="inline-flex items-center gap-2 text-[12px] text-blue-600 hover:underline"
          >
            System Controls
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </AdLabPageShell>
  );
}
