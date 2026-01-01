// ============================================
// AdLab Attestation Export API
// ============================================
// PHASE D32: External Attestation Mode.
//
// PROVIDES:
// - GET: Export attestation in various formats
//   - format=json (raw attestation)
//   - format=markdown (auditor-friendly)
//   - format=pdf (HTML for PDF)
//
// INVARIANTS:
// - READ-ONLY endpoint
// - Owner/Admin only
// - Regenerates on request (no caching)
// - All exports audited
// ============================================

import { NextRequest, NextResponse } from 'next/server';
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
import {
  generateRedactedAttestation,
  isValidProfile,
  getProfile,
  getProfileIds,
  applyRedactions,
  type AttestationProfile,
  type AttestationResult,
} from '@/lib/adlab/ops/attestationProfiles';
import { appendAuditLog } from '@/lib/adlab/audit';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ExportFormat = 'json' | 'markdown' | 'pdf';

// ============================================
// Supabase Client
// ============================================

function createExportClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Evidence Fetchers (same as attestation route)
// ============================================

async function getKillSwitchState() {
  try {
    const supabase = createExportClient();
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
    const supabase = createExportClient();
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
    const supabase = createExportClient();
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
    const supabase = createExportClient();
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
    const supabase = createExportClient();
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
    const supabase = createExportClient();
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
// Format Converters
// ============================================

function formatAsMarkdown(
  attestation: AttestationResult,
  profile: { id: string; name: string; description: string },
  redactionCount: number
): string {
  const lines: string[] = [];

  lines.push(`# ${profile.name} Attestation Report`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Document Information');
  lines.push('');
  lines.push(`- **Profile:** ${profile.name} (${profile.id})`);
  lines.push(`- **Generated:** ${attestation.timestamp}`);
  lines.push(`- **Environment:** ${attestation.environment}`);
  lines.push(`- **Attestation Checksum:** \`${attestation.attestationChecksum}\``);
  lines.push(`- **Evidence Checksum:** \`${attestation.evidenceChecksum}\``);
  lines.push(`- **Redacted Fields:** ${redactionCount}`);
  lines.push('');
  lines.push('> **Legal Disclaimer:** ' + attestation.disclaimer);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Overall Status
  const statusEmoji = attestation.overallStatus === 'PASS' ? '✅' :
                      attestation.overallStatus === 'WARN' ? '⚠️' : '❌';
  lines.push(`## Overall Status: ${statusEmoji} ${attestation.overallStatus}`);
  lines.push('');

  // Summary
  lines.push('### Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Sections Evaluated | ${attestation.summary.sectionsTotal} |`);
  lines.push(`| Sections Passed | ${attestation.summary.sectionsPassed} |`);
  lines.push(`| Sections Failed | ${attestation.summary.sectionsFailed} |`);
  lines.push(`| Sections Unavailable | ${attestation.summary.sectionsUnavailable} |`);
  lines.push(`| Invariants Passed | ${attestation.summary.invariantsPassed} |`);
  lines.push(`| Invariants Failed | ${attestation.summary.invariantsFailed} |`);
  lines.push(`| Critical Failures | ${attestation.summary.criticalFailures} |`);
  lines.push('');

  // Section Results
  lines.push('---');
  lines.push('');
  lines.push('## Section Results');
  lines.push('');
  lines.push('| Section | Status | Data Points | Message |');
  lines.push('|---------|--------|-------------|---------|');

  for (const section of attestation.sections) {
    const emoji = section.status === 'PASS' ? '✅' :
                  section.status === 'WARN' ? '⚠️' :
                  section.status === 'FAIL' ? '❌' : '⬜';
    lines.push(`| ${section.section} | ${emoji} ${section.status} | ${section.dataPoints} | ${section.message} |`);
  }
  lines.push('');

  // Invariant Results
  lines.push('---');
  lines.push('');
  lines.push('## Invariant Results');
  lines.push('');
  lines.push('| Invariant | Status | Critical | Description |');
  lines.push('|-----------|--------|----------|-------------|');

  for (const inv of attestation.invariantResults) {
    const emoji = inv.status === 'PASS' ? '✅' : '❌';
    const criticalBadge = inv.critical ? '🔴' : '⚪';
    lines.push(`| ${inv.id} | ${emoji} ${inv.status} | ${criticalBadge} | ${inv.description} |`);
  }
  lines.push('');

  // Verification
  lines.push('---');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push('This attestation can be independently verified:');
  lines.push('');
  lines.push('```');
  lines.push(`Profile: ${profile.id}`);
  lines.push(`Attestation Checksum: ${attestation.attestationChecksum}`);
  lines.push(`Evidence Checksum: ${attestation.evidenceChecksum}`);
  lines.push(`Generated: ${attestation.timestamp}`);
  lines.push('```');
  lines.push('');
  lines.push('*End of Attestation Report*');

  return lines.join('\n');
}

function formatAsHtml(
  attestation: AttestationResult,
  profile: { id: string; name: string; description: string },
  redactionCount: number
): string {
  const statusColor = attestation.overallStatus === 'PASS' ? '#28a745' :
                      attestation.overallStatus === 'WARN' ? '#ffc107' : '#dc3545';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${profile.name} Attestation Report</title>
  <style>
    :root {
      --primary: #0066cc;
      --success: #28a745;
      --warning: #ffc107;
      --danger: #dc3545;
      --gray-100: #f8f9fa;
      --gray-200: #e9ecef;
      --gray-700: #495057;
      --gray-900: #212529;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--gray-900);
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    header {
      text-align: center;
      padding-bottom: 30px;
      border-bottom: 3px solid ${statusColor};
      margin-bottom: 30px;
    }
    h1 { color: var(--primary); font-size: 2em; margin-bottom: 10px; }
    h2 { color: var(--gray-900); margin: 25px 0 15px; padding-bottom: 8px; border-bottom: 1px solid var(--gray-200); }
    .status-badge {
      display: inline-block;
      padding: 8px 20px;
      border-radius: 4px;
      font-size: 1.2em;
      font-weight: bold;
      color: white;
      background: ${statusColor};
      margin: 15px 0;
    }
    .meta { color: var(--gray-700); font-size: 0.9em; }
    .meta p { margin: 5px 0; }
    .disclaimer {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
      font-size: 0.9em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid var(--gray-200);
      padding: 10px;
      text-align: left;
    }
    th { background: var(--gray-100); font-weight: 600; }
    .status-pass { color: var(--success); font-weight: bold; }
    .status-warn { color: var(--warning); font-weight: bold; }
    .status-fail { color: var(--danger); font-weight: bold; }
    .critical-yes { color: var(--danger); }
    code {
      background: var(--gray-100);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }
    .verification {
      background: var(--gray-100);
      padding: 20px;
      border-radius: 4px;
      margin-top: 30px;
    }
    footer {
      text-align: center;
      padding-top: 30px;
      border-top: 1px solid var(--gray-200);
      margin-top: 30px;
      color: var(--gray-700);
      font-size: 0.85em;
    }
    @media print {
      body { max-width: none; padding: 20px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${profile.name} Attestation Report</h1>
    <div class="status-badge">${attestation.overallStatus}</div>
    <div class="meta">
      <p><strong>Profile:</strong> ${profile.id}</p>
      <p><strong>Generated:</strong> ${attestation.timestamp}</p>
      <p><strong>Environment:</strong> ${attestation.environment}</p>
    </div>
  </header>

  <div class="disclaimer">
    <strong>Legal Disclaimer:</strong> ${attestation.disclaimer}
  </div>

  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Sections Evaluated</td><td>${attestation.summary.sectionsTotal}</td></tr>
    <tr><td>Sections Passed</td><td class="status-pass">${attestation.summary.sectionsPassed}</td></tr>
    <tr><td>Sections Failed</td><td class="${attestation.summary.sectionsFailed > 0 ? 'status-fail' : ''}">${attestation.summary.sectionsFailed}</td></tr>
    <tr><td>Invariants Passed</td><td class="status-pass">${attestation.summary.invariantsPassed}</td></tr>
    <tr><td>Invariants Failed</td><td class="${attestation.summary.invariantsFailed > 0 ? 'status-fail' : ''}">${attestation.summary.invariantsFailed}</td></tr>
    <tr><td>Critical Failures</td><td class="${attestation.summary.criticalFailures > 0 ? 'status-fail' : ''}">${attestation.summary.criticalFailures}</td></tr>
    <tr><td>Redacted Fields</td><td>${redactionCount}</td></tr>
  </table>

  <h2>Section Results</h2>
  <table>
    <tr><th>Section</th><th>Status</th><th>Data Points</th><th>Details</th></tr>
    ${attestation.sections.map(s => `
      <tr>
        <td>${s.section}</td>
        <td class="status-${s.status.toLowerCase()}">${s.status}</td>
        <td>${s.dataPoints}</td>
        <td>${s.message}</td>
      </tr>
    `).join('')}
  </table>

  <h2>Invariant Results</h2>
  <table>
    <tr><th>Invariant</th><th>Status</th><th>Critical</th><th>Description</th></tr>
    ${attestation.invariantResults.map(i => `
      <tr>
        <td>${i.id}</td>
        <td class="status-${i.status.toLowerCase()}">${i.status}</td>
        <td class="${i.critical ? 'critical-yes' : ''}">${i.critical ? 'Yes' : 'No'}</td>
        <td>${i.description}</td>
      </tr>
    `).join('')}
  </table>

  <div class="verification">
    <h2>Verification</h2>
    <p>This attestation can be independently verified:</p>
    <p><strong>Attestation Checksum:</strong> <code>${attestation.attestationChecksum}</code></p>
    <p><strong>Evidence Checksum:</strong> <code>${attestation.evidenceChecksum}</code></p>
    <p><strong>Generated:</strong> ${attestation.timestamp}</p>
  </div>

  <footer>
    <p>End of Attestation Report</p>
    <p>Auto-generated from live system state. No claims are manually authored.</p>
  </footer>
</body>
</html>
  `.trim();
}

// ============================================
// Main Handler
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Get params
    const { searchParams } = new URL(request.url);
    const profileParam = searchParams.get('profile');
    const format = (searchParams.get('format') || 'markdown') as ExportFormat;

    if (!profileParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Profile parameter required',
          availableProfiles: getProfileIds(),
        },
        { status: 400 }
      );
    }

    if (!isValidProfile(profileParam)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid profile: ${profileParam}`,
          availableProfiles: getProfileIds(),
        },
        { status: 400 }
      );
    }

    if (!['json', 'markdown', 'pdf'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Valid: json, markdown, pdf' },
        { status: 400 }
      );
    }

    const profileId = profileParam as AttestationProfile;
    const profile = getProfile(profileId);

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
        disclaimer: 'Read-only evidence snapshot.',
        checksum: '',
      },
    };

    const evidenceChecksum = generateEvidenceChecksum({
      ...evidencePayload,
      metadata: { ...evidencePayload.metadata, checksum: undefined },
    });
    evidencePayload.metadata.checksum = evidenceChecksum;

    // Generate attestation
    const { attestation, redactedEvidence, redactionCount } = generateRedactedAttestation(
      evidencePayload,
      profileId
    );

    // Format output
    let content: string;
    let contentType: string;
    let filename: string;
    const dateStr = generatedAt.split('T')[0];

    const profileMeta = {
      id: profile.id,
      name: profile.name,
      description: profile.description,
    };

    switch (format) {
      case 'json':
        content = JSON.stringify(
          {
            attestation,
            profile: profileMeta,
            redactedEvidence,
            meta: {
              generatedAt,
              redactionCount,
              disclaimer: attestation.disclaimer,
            },
          },
          null,
          2
        );
        contentType = 'application/json; charset=utf-8';
        filename = `attestation-${profileId.toLowerCase()}-${dateStr}.json`;
        break;
      case 'pdf':
        content = formatAsHtml(attestation, profileMeta, redactionCount);
        contentType = 'text/html; charset=utf-8';
        filename = `attestation-${profileId.toLowerCase()}-${dateStr}.html`;
        break;
      default:
        content = formatAsMarkdown(attestation, profileMeta, redactionCount);
        contentType = 'text/markdown; charset=utf-8';
        filename = `attestation-${profileId.toLowerCase()}-${dateStr}.md`;
    }

    // Audit the export
    await appendAuditLog({
      context: {
        workspaceId: actor.workspaceId,
        actorId: actor.id,
        actorRole: actor.role,
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: 'attestation-export',
      scope: {
        platform: 'system',
        dataset: 'attestation',
      },
      metadata: {
        attestationAction: 'ATTESTATION_EXPORTED',
        profile: profileId,
        format,
        overallStatus: attestation.overallStatus,
        attestationChecksum: attestation.attestationChecksum,
        redactionCount,
        timestamp: generatedAt,
      },
    });

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
        'X-Attestation-Profile': profileId,
        'X-Attestation-Status': attestation.overallStatus,
        'X-Attestation-Checksum': attestation.attestationChecksum,
      },
    });
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

    console.error('D32: Attestation export error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
