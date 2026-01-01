// ============================================
// AdLab Security Whitepaper Export API
// ============================================
// PHASE D31: Security Whitepaper (Auto-Generated, Evidence-Backed).
//
// PROVIDES:
// - GET: Export whitepaper in various formats
//   - format=md (Markdown - auditor-friendly)
//   - format=pdf (HTML for PDF conversion)
//   - format=html (HTML - printable)
//
// INVARIANTS:
// - READ-ONLY endpoint
// - Owner/Admin only
// - All exports audited
// - Include checksum, timestamp, disclaimer
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
  generateSecurityWhitepaper,
  SECTION_ORDER,
  type SecurityWhitepaper,
} from '@/lib/adlab/ops/securityWhitepaper';
import { appendAuditLog } from '@/lib/adlab/audit';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ExportFormat = 'md' | 'pdf' | 'html';

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
// Evidence Fetchers (same as whitepaper route)
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

function formatAsMarkdown(whitepaper: SecurityWhitepaper): string {
  const lines: string[] = [];

  lines.push(`# ${whitepaper.metadata.title}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Document Information');
  lines.push('');
  lines.push(`- **Version:** ${whitepaper.metadata.version}`);
  lines.push(`- **Generated:** ${whitepaper.metadata.generatedAt}`);
  lines.push(`- **Checksum:** \`${whitepaper.checksum}\``);
  lines.push(`- **Source:** ${whitepaper.metadata.sourceEndpoint}`);
  lines.push('');
  lines.push('> **Disclaimer:** ' + whitepaper.metadata.disclaimer);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Table of contents
  lines.push('## Table of Contents');
  lines.push('');
  for (const sectionId of SECTION_ORDER) {
    const section = whitepaper.sections[sectionId];
    const statusBadge = section.status === 'AVAILABLE' ? '' :
                        section.status === 'PARTIAL' ? ' *(partial)*' : ' *(unavailable)*';
    lines.push(`${section.order}. [${section.title.replace(/^\d+\.\s*/, '')}](#${sectionId.replace(/_/g, '-')})${statusBadge}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Sections
  for (const sectionId of SECTION_ORDER) {
    const section = whitepaper.sections[sectionId];
    lines.push(`## ${section.title}`);
    lines.push('');
    if (section.status !== 'AVAILABLE') {
      lines.push(`> **Status:** ${section.status}`);
      lines.push('');
    }
    lines.push(section.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Footer
  lines.push('## Verification');
  lines.push('');
  lines.push('This document can be verified against the source evidence:');
  lines.push('');
  lines.push('```');
  lines.push(`Whitepaper Checksum: ${whitepaper.checksum}`);
  lines.push(`Generated At: ${whitepaper.metadata.generatedAt}`);
  lines.push(`Source: GET ${whitepaper.metadata.sourceEndpoint}`);
  lines.push('```');
  lines.push('');
  lines.push('*End of Security Whitepaper*');

  return lines.join('\n');
}

function formatAsHtml(whitepaper: SecurityWhitepaper): string {
  const sectionsHtml = SECTION_ORDER.map(sectionId => {
    const section = whitepaper.sections[sectionId];
    const statusBadge = section.status === 'AVAILABLE' ? '' :
      `<span class="status-badge status-${section.status.toLowerCase()}">${section.status}</span>`;

    // Convert markdown to basic HTML
    let contentHtml = section.content
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\| (.+) \|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
      });

    // Wrap lists
    contentHtml = contentHtml.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    return `
      <section id="${sectionId}" class="whitepaper-section">
        <h2>${section.title} ${statusBadge}</h2>
        <div class="section-content">
          <p>${contentHtml}</p>
        </div>
      </section>
    `;
  }).join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${whitepaper.metadata.title}</title>
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
      padding-bottom: 40px;
      border-bottom: 2px solid var(--primary);
      margin-bottom: 40px;
    }
    h1 { color: var(--primary); font-size: 2.5em; margin-bottom: 20px; }
    h2 { color: var(--gray-900); margin: 30px 0 15px; padding-bottom: 10px; border-bottom: 1px solid var(--gray-200); }
    h3 { color: var(--gray-700); margin: 20px 0 10px; }
    .meta { color: var(--gray-700); font-size: 0.9em; }
    .meta p { margin: 5px 0; }
    .disclaimer {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: bold;
      margin-left: 10px;
    }
    .status-unavailable { background: var(--danger); color: white; }
    .status-partial { background: var(--warning); color: var(--gray-900); }
    .whitepaper-section { margin: 40px 0; }
    .section-content { padding: 15px 0; }
    code {
      background: var(--gray-100);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }
    pre {
      background: var(--gray-100);
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 15px 0;
    }
    pre code { background: none; padding: 0; }
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
    ul, ol { margin: 15px 0; padding-left: 30px; }
    li { margin: 5px 0; }
    .verification {
      background: var(--gray-100);
      padding: 20px;
      border-radius: 4px;
      margin-top: 40px;
    }
    .verification code { display: block; margin: 5px 0; }
    footer {
      text-align: center;
      padding-top: 40px;
      border-top: 1px solid var(--gray-200);
      margin-top: 40px;
      color: var(--gray-700);
      font-size: 0.9em;
    }
    @media print {
      body { max-width: none; padding: 20px; }
      .whitepaper-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${whitepaper.metadata.title}</h1>
    <div class="meta">
      <p><strong>Version:</strong> ${whitepaper.metadata.version}</p>
      <p><strong>Generated:</strong> ${whitepaper.metadata.generatedAt}</p>
      <p><strong>Checksum:</strong> <code>${whitepaper.checksum}</code></p>
    </div>
    <div class="disclaimer">
      <strong>Disclaimer:</strong> ${whitepaper.metadata.disclaimer}
    </div>
  </header>

  <nav>
    <h2>Table of Contents</h2>
    <ol>
      ${SECTION_ORDER.map(id => {
        const s = whitepaper.sections[id];
        return `<li><a href="#${id}">${s.title.replace(/^\d+\.\s*/, '')}</a></li>`;
      }).join('\n')}
    </ol>
  </nav>

  ${sectionsHtml}

  <div class="verification">
    <h2>Verification</h2>
    <p>This document can be verified against the source evidence:</p>
    <code>Whitepaper Checksum: ${whitepaper.checksum}</code>
    <code>Generated At: ${whitepaper.metadata.generatedAt}</code>
    <code>Source: GET ${whitepaper.metadata.sourceEndpoint}</code>
  </div>

  <footer>
    <p>End of Security Whitepaper</p>
    <p>Auto-generated from D30 Evidence Pack. No manual content.</p>
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

    // Get format from query params
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'md') as ExportFormat;

    if (!['md', 'pdf', 'html'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Valid: md, pdf, html' },
        { status: 400 }
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
        disclaimer: 'Read-only evidence snapshot. This document reflects production state at generation time.',
        checksum: '',
      },
    };

    const evidenceChecksum = generateEvidenceChecksum({
      ...evidencePayload,
      metadata: { ...evidencePayload.metadata, checksum: undefined },
    });
    evidencePayload.metadata.checksum = evidenceChecksum;

    // Generate whitepaper
    const whitepaper = generateSecurityWhitepaper(evidencePayload);

    // Format output
    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'html':
      case 'pdf':
        content = formatAsHtml(whitepaper);
        contentType = 'text/html; charset=utf-8';
        filename = `security-whitepaper-${generatedAt.split('T')[0]}.html`;
        break;
      default:
        content = formatAsMarkdown(whitepaper);
        contentType = 'text/markdown; charset=utf-8';
        filename = `security-whitepaper-${generatedAt.split('T')[0]}.md`;
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
      entityId: 'security-whitepaper-export',
      scope: {
        platform: 'system',
        dataset: 'security_whitepaper',
      },
      metadata: {
        whitepaperAction: 'SECURITY_WHITEPAPER_EXPORTED',
        format,
        checksum: whitepaper.checksum,
        evidenceChecksum,
        timestamp: generatedAt,
      },
    });

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
        'X-Whitepaper-Checksum': whitepaper.checksum,
        'X-Evidence-Checksum': evidenceChecksum,
        'X-Whitepaper-Generated': generatedAt,
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

    console.error('D31: Security whitepaper export error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
