// ============================================
// AdLab Security Whitepaper Page
// ============================================
// PHASE D31: Security Whitepaper (Auto-Generated, Evidence-Backed).
//
// READ-ONLY dashboard for:
// - Security whitepaper sections (1-9)
// - Section navigation
// - Status indicators
// - Export buttons (MD / PDF / HTML)
//
// RULES:
// - Owner/Admin role required
// - READ-ONLY - no mutations
// - All access is audited via API
// ============================================

import { AdLabPageShell } from '@/components/adlab/AdLabPageShell';
import { resolveActorWithDevFallback } from '@/lib/adlab/auth/resolveActor';
import { hasAtLeastRole } from '@/lib/adlab/auth/roles';
import { checkProductionReadiness } from '@/lib/adlab/safety';
import { checkWorkspaceCompliance } from '@/lib/adlab/ops';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getSecurityPageData() {
  try {
    const actor = await resolveActorWithDevFallback();

    // Check if owner or admin
    const isAuthorized = hasAtLeastRole(actor.role, 'admin');
    if (!isAuthorized) {
      return { actor, isAuthorized: false, error: 'Unauthorized' };
    }

    // Fetch readiness and compliance for summary
    const [readiness, compliance] = await Promise.all([
      checkProductionReadiness(),
      checkWorkspaceCompliance(actor.workspaceId),
    ]);

    return {
      actor,
      isAuthorized: true,
      readiness,
      compliance,
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

// Section metadata for navigation
const SECTIONS = [
  { id: 'executive_summary', number: 1, title: 'Executive Summary', description: 'System identity, compliance status, go-live gate' },
  { id: 'system_architecture', number: 2, title: 'System Architecture & Trust Model', description: 'Snapshot truth, audit design, safety controls' },
  { id: 'data_integrity', number: 3, title: 'Data Integrity & Consistency', description: 'Snapshot invariants, promotion binding, no-delete' },
  { id: 'access_control', number: 4, title: 'Access Control & Identity', description: 'RBAC roles, membership, server-derived actor' },
  { id: 'change_management', number: 5, title: 'Change Management & Deploy Safety', description: 'Go-live gate, readiness checks, drift detection' },
  { id: 'monitoring_drift', number: 6, title: 'Monitoring, Drift & Auto-Response', description: 'Compliance monitor, kill-switch, alerting' },
  { id: 'audit_forensics', number: 7, title: 'Audit & Forensics', description: 'Immutable log, event coverage, investigations' },
  { id: 'incident_preparedness', number: 8, title: 'Incident Preparedness', description: 'Operator drills, certification, SLA scoring' },
  { id: 'evidence_integrity', number: 9, title: 'Evidence Integrity', description: 'Checksum, timestamp, disclaimer' },
];

export default async function SecurityPage() {
  const data = await getSecurityPageData();

  // If not authorized, show access denied
  if (!data.isAuthorized) {
    return (
      <AdLabPageShell
        title="Security Whitepaper"
        description="Auto-generated security documentation"
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

  const { readiness, compliance, generatedAt } = data as Exclude<typeof data, { isAuthorized: false }>;

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
      title="Security Whitepaper"
      description="Auto-generated, evidence-backed security documentation for auditors and enterprise review"
      badge={{
        label: 'Auto-Generated',
        variant: 'info',
      }}
    >
      <div className="space-y-6">
        {/* Export Actions */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/adlab/system/security/whitepaper/export?format=md"
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Markdown
          </a>
          <a
            href="/api/adlab/system/security/whitepaper/export?format=html"
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-[12px] font-medium hover:bg-secondary/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export HTML/PDF
          </a>
          <a
            href="/api/adlab/system/security/whitepaper"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-[12px] font-medium hover:bg-secondary/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View JSON API
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
                Auto-Generated Document
              </h3>
              <p className="text-[12px] text-blue-700 dark:text-blue-300 mt-1">
                This whitepaper is generated entirely from the D30 Evidence Pack API.
                No static text. No assumptions. All claims are derived from production truth.
              </p>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-2">
                Generated: {generatedAt}
              </p>
            </div>
          </div>
        </div>

        {/* Overall Status */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-foreground">System Status Overview</h2>
            <div
              className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                overallStatus === 'PASS'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : overallStatus === 'WARN'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {overallStatus}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Readiness</div>
              <div className={`text-[14px] font-bold mt-1 ${
                readiness?.status === 'READY' ? 'text-green-600' :
                readiness?.status === 'DEGRADED' ? 'text-amber-600' : 'text-red-600'
              }`}>
                {readiness?.status || 'UNKNOWN'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Compliance</div>
              <div className={`text-[14px] font-bold mt-1 ${
                compliance?.status === 'PASS' ? 'text-green-600' :
                compliance?.status === 'WARN' ? 'text-amber-600' : 'text-red-600'
              }`}>
                {compliance?.status || 'UNKNOWN'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Readiness Checks</div>
              <div className="text-[14px] font-bold mt-1 text-foreground">
                {readiness?.summary?.passed || 0}/{readiness?.summary?.total || 0}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Drift Items</div>
              <div className={`text-[14px] font-bold mt-1 ${
                (compliance?.driftItems?.length || 0) === 0 ? 'text-green-600' : 'text-amber-600'
              }`}>
                {compliance?.driftItems?.length || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Section Navigation */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">Whitepaper Sections</h2>
          <p className="text-[12px] text-muted-foreground mb-4">
            The security whitepaper contains 9 sections, each derived from production evidence.
            Export the full document to review all sections with complete data.
          </p>

          <div className="space-y-3">
            {SECTIONS.map((section) => (
              <div
                key={section.id}
                className="p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                    {section.number}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[13px] font-medium text-foreground">
                      {section.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {section.description}
                    </p>
                  </div>
                  <div className="px-2 py-1 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    DERIVED
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Principles */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">Key Security Principles</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 className="text-[13px] font-medium text-foreground">Snapshot Truth</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Production data is never queried directly. All analytics operate on immutable, versioned snapshots.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-[13px] font-medium text-foreground">Server-Derived Actor</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Identity and role are resolved server-side. No client-provided role claims are trusted.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-[13px] font-medium text-foreground">Immutable Audit</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                All mutations are logged to an append-only audit trail. No deletions allowed.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <h3 className="text-[13px] font-medium text-foreground">Kill-Switch Safety</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Emergency kill-switch blocks all dangerous operations instantly. Owner-only activation.
              </p>
            </div>
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
            href="/ads/system/compliance"
            className="inline-flex items-center gap-2 text-[12px] text-blue-600 hover:underline"
          >
            Compliance Dashboard
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
