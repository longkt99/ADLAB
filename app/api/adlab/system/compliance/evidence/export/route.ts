// ============================================
// AdLab Compliance Evidence Export API
// ============================================
// PHASE D30: Production Evidence Pack & External Audit Export.
//
// PROVIDES:
// - JSON export (raw evidence payload)
// - Markdown export (human-readable audit report)
// - PDF export (structured printable report)
//
// INVARIANTS:
// - READ-ONLY endpoint
// - Owner/Admin only
// - All exports audited
// - All exports include checksum & timestamp
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
import { appendAuditLog } from '@/lib/adlab/audit';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

type ExportFormat = 'json' | 'markdown' | 'pdf';

interface EvidenceData {
  system: {
    name: string;
    environment: string;
    version: string | null;
    commitHash: string | null;
    generatedAt: string;
  };
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
// Data Fetchers (same as evidence/route.ts)
// ============================================

async function getKillSwitchState() {
  try {
    const supabase = createEvidenceClient();
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
    const supabase = createEvidenceClient();
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

function generateChecksum(data: EvidenceData): string {
  const content = JSON.stringify(data, null, 0);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ============================================
// Export Formatters
// ============================================

function formatAsJson(data: EvidenceData, checksum: string): string {
  return JSON.stringify(
    {
      evidence: data,
      metadata: {
        evidenceVersion: '1.0.0',
        checksum,
        disclaimer: 'Read-only evidence snapshot. This document reflects production state at generation time.',
      },
    },
    null,
    2
  );
}

function formatAsMarkdown(data: EvidenceData, checksum: string): string {
  const lines: string[] = [];

  lines.push('# AdLab Production Evidence Report');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Disclaimer');
  lines.push('');
  lines.push('> Read-only evidence snapshot. This document reflects production state at generation time.');
  lines.push('');
  lines.push(`**Generated:** ${data.system.generatedAt}`);
  lines.push(`**Checksum (SHA-256):** \`${checksum}\``);
  lines.push('');
  lines.push('---');
  lines.push('');

  // A. System Identity
  lines.push('## A. System Identity');
  lines.push('');
  lines.push(`| Property | Value |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Name | ${data.system.name} |`);
  lines.push(`| Environment | ${data.system.environment} |`);
  lines.push(`| Version | ${data.system.version || 'N/A'} |`);
  lines.push(`| Commit | ${data.system.commitHash ? `\`${data.system.commitHash.substring(0, 8)}\`` : 'N/A'} |`);
  lines.push('');

  // B. Governance State
  lines.push('## B. Governance State');
  lines.push('');

  // Kill Switch
  lines.push('### Kill Switch');
  lines.push('');
  const globalKs = data.governance.killSwitch.global;
  lines.push(`**Global Kill Switch:** ${globalKs.enabled ? '🔴 ENABLED' : '🟢 Disabled'}`);
  if (globalKs.enabled) {
    lines.push(`- Reason: ${globalKs.reason}`);
    lines.push(`- Activated: ${globalKs.activatedAt}`);
  }
  lines.push('');

  if (data.governance.killSwitch.workspace.length > 0) {
    lines.push('**Workspace Kill Switches:**');
    lines.push('');
    for (const ws of data.governance.killSwitch.workspace) {
      lines.push(`- \`${ws.workspaceId}\`: ${ws.enabled ? 'ENABLED' : 'Disabled'} (${ws.reason})`);
    }
    lines.push('');
  }

  // Failure Injection
  lines.push('### Failure Injection');
  lines.push('');
  if (data.governance.failureInjection.activeConfigs.length === 0) {
    lines.push('No active failure injections.');
  } else {
    lines.push('| Action | Failure Type | Probability | Workspace |');
    lines.push('|--------|--------------|-------------|-----------|');
    for (const fi of data.governance.failureInjection.activeConfigs) {
      lines.push(`| ${fi.action} | ${fi.failureType} | ${fi.probability}% | \`${fi.workspaceId}\` |`);
    }
  }
  lines.push('');

  // Active Snapshots
  lines.push('### Active Snapshots');
  lines.push('');
  if (data.governance.activeSnapshots.length === 0) {
    lines.push('No active snapshots.');
  } else {
    lines.push('| Platform | Dataset | Promoted At |');
    lines.push('|----------|---------|-------------|');
    for (const snap of data.governance.activeSnapshots) {
      lines.push(`| ${snap.platform} | ${snap.dataset} | ${snap.promotedAt} |`);
    }
  }
  lines.push('');

  // C. Readiness & Gate
  lines.push('## C. Readiness & Gate Status');
  lines.push('');
  const gate = data.readiness.latestGoLiveGate;
  const gateIcon = gate.status === 'PASS' ? '✅' : gate.status === 'FAIL' ? '❌' : '⚠️';
  lines.push(`**Go-Live Gate:** ${gateIcon} ${gate.status}`);
  if (gate.timestamp) {
    lines.push(`- Last checked: ${gate.timestamp}`);
  }
  if (gate.failedChecks.length > 0) {
    lines.push(`- Failed checks: ${gate.failedChecks.join(', ')}`);
  }
  lines.push('');

  lines.push('### Readiness Checks');
  lines.push('');
  lines.push('| Check | Status | Category | Message |');
  lines.push('|-------|--------|----------|---------|');
  for (const check of data.readiness.readinessChecks) {
    const statusIcon = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️';
    lines.push(`| ${check.checkId} | ${statusIcon} ${check.status} | ${check.category} | ${check.message} |`);
  }
  lines.push('');

  // D. Compliance
  lines.push('## D. Compliance Drift Status');
  lines.push('');
  const compIcon = data.compliance.currentStatus === 'PASS' ? '✅' :
                   data.compliance.currentStatus === 'WARN' ? '⚠️' : '❌';
  lines.push(`**Current Status:** ${compIcon} ${data.compliance.currentStatus}`);
  lines.push(`**Last Checked:** ${data.compliance.lastCheckedAt}`);
  lines.push('');
  if (data.compliance.driftTypes.length > 0) {
    lines.push('**Drift Types:**');
    for (const drift of data.compliance.driftTypes) {
      lines.push(`- ${drift}`);
    }
  } else {
    lines.push('No drift detected.');
  }
  lines.push('');

  lines.push('### SLA Thresholds');
  lines.push('');
  lines.push(`- Warn: ${data.compliance.slaThresholds.warnMinutes} minutes`);
  lines.push(`- Fail: ${data.compliance.slaThresholds.failMinutes} minutes`);
  lines.push(`- Critical: ${data.compliance.slaThresholds.criticalMinutes} minutes`);
  lines.push('');

  // E. Audit Coverage
  lines.push('## E. Audit Coverage Proof');
  lines.push('');
  lines.push(`**Total Audit Events:** ${data.audit.totalAuditEvents.toLocaleString()}`);
  lines.push('');

  lines.push('### Events by Type (Last 30 Days)');
  lines.push('');
  lines.push('| Action | Count |');
  lines.push('|--------|-------|');
  for (const [action, count] of Object.entries(data.audit.eventsByType)) {
    lines.push(`| ${action} | ${count} |`);
  }
  lines.push('');

  if (data.audit.mostRecentCriticalEvents.length > 0) {
    lines.push('### Recent Critical Events');
    lines.push('');
    lines.push('| Timestamp | Action | Entity Type | Actor |');
    lines.push('|-----------|--------|-------------|-------|');
    for (const event of data.audit.mostRecentCriticalEvents) {
      lines.push(`| ${event.timestamp} | ${event.action} | ${event.entityType} | \`${event.actorId.substring(0, 8)}...\` |`);
    }
    lines.push('');
  }

  // F. RBAC
  lines.push('## F. RBAC & Membership Model');
  lines.push('');
  lines.push(`**Total Members:** ${data.rbac.workspaceMembersCount}`);
  lines.push(`**Owners:** ${data.rbac.ownerCount}`);
  lines.push('');

  lines.push('### Roles Matrix');
  lines.push('');
  lines.push('| Role | Count |');
  lines.push('|------|-------|');
  lines.push(`| Owner | ${data.rbac.rolesMatrix.owner.length} |`);
  lines.push(`| Admin | ${data.rbac.rolesMatrix.admin.length} |`);
  lines.push(`| Editor | ${data.rbac.rolesMatrix.editor.length} |`);
  lines.push(`| Viewer | ${data.rbac.rolesMatrix.viewer.length} |`);
  lines.push('');

  lines.push('### Invariants');
  lines.push('');
  lines.push('```');
  lines.push(data.rbac.invariantsSummary);
  lines.push('```');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('*End of Evidence Report*');

  return lines.join('\n');
}

function formatAsPdf(data: EvidenceData, checksum: string): string {
  // For PDF, we return HTML that can be converted to PDF client-side
  // or by a PDF generation service
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AdLab Production Evidence Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #1a1a1a; }
    h1 { color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    h3 { color: #555; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    .disclaimer { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .checksum { font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
    .status-pass { color: #28a745; font-weight: bold; }
    .status-warn { color: #ffc107; font-weight: bold; }
    .status-fail { color: #dc3545; font-weight: bold; }
    .metadata { color: #666; font-size: 0.9em; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; }
    .badge-enabled { background: #dc3545; color: white; }
    .badge-disabled { background: #28a745; color: white; }
  </style>
</head>
<body>
  <div class="header">
    <h1>AdLab Production Evidence Report</h1>
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> Read-only evidence snapshot. This document reflects production state at generation time.
  </div>

  <p class="metadata">
    <strong>Generated:</strong> ${data.system.generatedAt}<br>
    <strong>Checksum (SHA-256):</strong> <span class="checksum">${checksum}</span>
  </p>

  <h2>A. System Identity</h2>
  <table>
    <tr><th>Property</th><th>Value</th></tr>
    <tr><td>Name</td><td>${data.system.name}</td></tr>
    <tr><td>Environment</td><td>${data.system.environment}</td></tr>
    <tr><td>Version</td><td>${data.system.version || 'N/A'}</td></tr>
    <tr><td>Commit</td><td>${data.system.commitHash ? `<code>${data.system.commitHash.substring(0, 8)}</code>` : 'N/A'}</td></tr>
  </table>

  <h2>B. Governance State</h2>

  <h3>Kill Switch</h3>
  <p><strong>Global Kill Switch:</strong>
    <span class="badge ${data.governance.killSwitch.global.enabled ? 'badge-enabled' : 'badge-disabled'}">
      ${data.governance.killSwitch.global.enabled ? 'ENABLED' : 'Disabled'}
    </span>
  </p>
  ${data.governance.killSwitch.global.enabled ? `
    <ul>
      <li>Reason: ${data.governance.killSwitch.global.reason}</li>
      <li>Activated: ${data.governance.killSwitch.global.activatedAt}</li>
    </ul>
  ` : ''}

  <h3>Failure Injection</h3>
  ${data.governance.failureInjection.activeConfigs.length === 0
    ? '<p>No active failure injections.</p>'
    : `<table>
        <tr><th>Action</th><th>Failure Type</th><th>Probability</th><th>Workspace</th></tr>
        ${data.governance.failureInjection.activeConfigs.map(fi =>
          `<tr><td>${fi.action}</td><td>${fi.failureType}</td><td>${fi.probability}%</td><td><code>${fi.workspaceId}</code></td></tr>`
        ).join('')}
      </table>`
  }

  <h3>Active Snapshots</h3>
  ${data.governance.activeSnapshots.length === 0
    ? '<p>No active snapshots.</p>'
    : `<table>
        <tr><th>Platform</th><th>Dataset</th><th>Promoted At</th></tr>
        ${data.governance.activeSnapshots.map(snap =>
          `<tr><td>${snap.platform}</td><td>${snap.dataset}</td><td>${snap.promotedAt}</td></tr>`
        ).join('')}
      </table>`
  }

  <h2>C. Readiness & Gate Status</h2>
  <p><strong>Go-Live Gate:</strong>
    <span class="status-${data.readiness.latestGoLiveGate.status.toLowerCase()}">${data.readiness.latestGoLiveGate.status}</span>
  </p>
  ${data.readiness.latestGoLiveGate.timestamp
    ? `<p class="metadata">Last checked: ${data.readiness.latestGoLiveGate.timestamp}</p>`
    : ''}
  ${data.readiness.latestGoLiveGate.failedChecks.length > 0
    ? `<p>Failed checks: ${data.readiness.latestGoLiveGate.failedChecks.join(', ')}</p>`
    : ''}

  <h3>Readiness Checks</h3>
  <table>
    <tr><th>Check</th><th>Status</th><th>Category</th><th>Message</th></tr>
    ${data.readiness.readinessChecks.map(check =>
      `<tr>
        <td>${check.checkId}</td>
        <td class="status-${check.status.toLowerCase()}">${check.status}</td>
        <td>${check.category}</td>
        <td>${check.message}</td>
      </tr>`
    ).join('')}
  </table>

  <h2>D. Compliance Drift Status</h2>
  <p><strong>Current Status:</strong>
    <span class="status-${data.compliance.currentStatus.toLowerCase()}">${data.compliance.currentStatus}</span>
  </p>
  <p class="metadata">Last Checked: ${data.compliance.lastCheckedAt}</p>
  ${data.compliance.driftTypes.length > 0
    ? `<p><strong>Drift Types:</strong></p><ul>${data.compliance.driftTypes.map(d => `<li>${d}</li>`).join('')}</ul>`
    : '<p>No drift detected.</p>'
  }

  <h3>SLA Thresholds</h3>
  <ul>
    <li>Warn: ${data.compliance.slaThresholds.warnMinutes} minutes</li>
    <li>Fail: ${data.compliance.slaThresholds.failMinutes} minutes</li>
    <li>Critical: ${data.compliance.slaThresholds.criticalMinutes} minutes</li>
  </ul>

  <h2>E. Audit Coverage Proof</h2>
  <p><strong>Total Audit Events:</strong> ${data.audit.totalAuditEvents.toLocaleString()}</p>

  <h3>Events by Type (Last 30 Days)</h3>
  <table>
    <tr><th>Action</th><th>Count</th></tr>
    ${Object.entries(data.audit.eventsByType).map(([action, count]) =>
      `<tr><td>${action}</td><td>${count}</td></tr>`
    ).join('')}
  </table>

  ${data.audit.mostRecentCriticalEvents.length > 0 ? `
    <h3>Recent Critical Events</h3>
    <table>
      <tr><th>Timestamp</th><th>Action</th><th>Entity Type</th><th>Actor</th></tr>
      ${data.audit.mostRecentCriticalEvents.map(event =>
        `<tr>
          <td>${event.timestamp}</td>
          <td>${event.action}</td>
          <td>${event.entityType}</td>
          <td><code>${event.actorId.substring(0, 8)}...</code></td>
        </tr>`
      ).join('')}
    </table>
  ` : ''}

  <h2>F. RBAC & Membership Model</h2>
  <p><strong>Total Members:</strong> ${data.rbac.workspaceMembersCount}</p>
  <p><strong>Owners:</strong> ${data.rbac.ownerCount}</p>

  <h3>Roles Matrix</h3>
  <table>
    <tr><th>Role</th><th>Count</th></tr>
    <tr><td>Owner</td><td>${data.rbac.rolesMatrix.owner.length}</td></tr>
    <tr><td>Admin</td><td>${data.rbac.rolesMatrix.admin.length}</td></tr>
    <tr><td>Editor</td><td>${data.rbac.rolesMatrix.editor.length}</td></tr>
    <tr><td>Viewer</td><td>${data.rbac.rolesMatrix.viewer.length}</td></tr>
  </table>

  <h3>Invariants</h3>
  <pre>${data.rbac.invariantsSummary}</pre>

  <hr>
  <p class="metadata" style="text-align: center;"><em>End of Evidence Report</em></p>
</body>
</html>
  `.trim();

  return html;
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
    const format = (searchParams.get('format') || 'json') as ExportFormat;

    if (!['json', 'markdown', 'pdf'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Valid: json, markdown, pdf' },
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

    // Build evidence data
    const evidenceData: EvidenceData = {
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
    const checksum = generateChecksum(evidenceData);

    // Format output
    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'markdown':
        content = formatAsMarkdown(evidenceData, checksum);
        contentType = 'text/markdown; charset=utf-8';
        filename = `evidence-report-${generatedAt.split('T')[0]}.md`;
        break;
      case 'pdf':
        content = formatAsPdf(evidenceData, checksum);
        contentType = 'text/html; charset=utf-8';
        filename = `evidence-report-${generatedAt.split('T')[0]}.html`;
        break;
      default:
        content = formatAsJson(evidenceData, checksum);
        contentType = 'application/json; charset=utf-8';
        filename = `evidence-report-${generatedAt.split('T')[0]}.json`;
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
      entityId: 'compliance-evidence-export',
      scope: {
        platform: 'system',
        dataset: 'compliance_evidence',
      },
      metadata: {
        evidenceAction: 'COMPLIANCE_EVIDENCE_EXPORTED',
        format,
        checksum,
        timestamp: generatedAt,
      },
    });

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
        'X-Evidence-Checksum': checksum,
        'X-Evidence-Generated': generatedAt,
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

    console.error('D30: Evidence export error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
