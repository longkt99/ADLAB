// ============================================
// AdLab Public Trust Export API (Zero-Auth)
// ============================================
// PHASE D33: Public Trust Portal.
//
// PROVIDES:
// - GET: Export public trust attestation in various formats
//
// FORMATS:
// - json: Machine-verifiable JSON
// - markdown: Security review friendly
// - pdf: HTML for PDF conversion
//
// INVARIANTS:
// - ZERO authentication required
// - Token-based access control
// - All content from D30/D32 evidence
// - PII redaction enforced
// - Invalid/expired tokens return 404
// - All exports audited
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
// Evidence Builder (Same as D32/D33)
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
// Format Generators
// ============================================

function generateMarkdown(attestation: ReturnType<typeof generateAttestation>, profile: ReturnType<typeof getProfile>): string {
  const lines: string[] = [];

  lines.push(`# Public Trust Attestation: ${attestation.profileName}`);
  lines.push('');
  lines.push(`**Generated:** ${attestation.timestamp}`);
  lines.push(`**Environment:** ${attestation.environment}`);
  lines.push(`**Overall Status:** ${attestation.overallStatus}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## Profile Information');
  lines.push('');
  lines.push(`- **Profile:** ${profile.name}`);
  lines.push(`- **Description:** ${profile.description}`);
  lines.push(`- **Time Window:** ${profile.timeWindow.description}`);
  lines.push('');

  lines.push('## Evidence Sections');
  lines.push('');
  lines.push('| Section | Status | Message |');
  lines.push('|---------|--------|---------|');
  for (const section of attestation.sections) {
    const sectionName = section.section.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    lines.push(`| ${sectionName} | ${section.status} | ${section.message} |`);
  }
  lines.push('');

  lines.push('## Invariant Checks');
  lines.push('');
  lines.push(`**Passed:** ${attestation.summary.invariantsPassed} / ${attestation.invariantResults.length}`);
  lines.push('');
  for (const inv of attestation.invariantResults) {
    const icon = inv.status === 'PASS' ? '[PASS]' : '[FAIL]';
    const critical = inv.critical ? ' (Critical)' : '';
    lines.push(`- ${icon} ${inv.description}${critical}`);
  }
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Sections Passed:** ${attestation.summary.sectionsPassed}`);
  lines.push(`- **Sections Failed:** ${attestation.summary.sectionsFailed}`);
  lines.push(`- **Sections Unavailable:** ${attestation.summary.sectionsUnavailable}`);
  lines.push(`- **Critical Failures:** ${attestation.summary.criticalFailures}`);
  lines.push('');

  lines.push('## Integrity Verification');
  lines.push('');
  lines.push(`- **Evidence Checksum:** \`${attestation.evidenceChecksum}\``);
  lines.push(`- **Attestation Checksum:** \`${attestation.attestationChecksum}\``);
  lines.push('');
  lines.push('To verify integrity, compare these checksums with the original evidence pack.');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## Legal Disclaimer');
  lines.push('');
  lines.push(attestation.disclaimer);
  lines.push('');
  lines.push('This document is provided for informational purposes only. PII has been redacted per profile requirements.');
  lines.push('');

  return lines.join('\n');
}

function generateHTML(attestation: ReturnType<typeof generateAttestation>, profile: ReturnType<typeof getProfile>): string {
  const statusColor = attestation.overallStatus === 'PASS' ? '#22c55e' : attestation.overallStatus === 'WARN' ? '#f59e0b' : '#ef4444';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Public Trust Attestation: ${attestation.profileName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 20px; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 14px; color: white; background: ${statusColor}; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .pass { color: #22c55e; }
    .warn { color: #f59e0b; }
    .fail { color: #ef4444; }
    .unavailable { color: #9ca3af; }
    .invariant { padding: 8px 0; display: flex; align-items: center; gap: 8px; }
    .invariant-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; }
    .invariant-icon.pass { background: #22c55e; }
    .invariant-icon.fail { background: #ef4444; }
    .critical { font-size: 10px; color: #ef4444; text-transform: uppercase; font-weight: 600; }
    .checksum { font-family: monospace; font-size: 12px; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; word-break: break-all; }
    .disclaimer { margin-top: 32px; padding: 16px; background: #fef3c7; border-radius: 8px; font-size: 13px; color: #92400e; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>Public Trust Attestation</h1>
  <div class="meta">
    <strong>${attestation.profileName}</strong> &bull; Generated: ${new Date(attestation.timestamp).toLocaleString()} &bull; Environment: ${attestation.environment}
  </div>
  <p><span class="status-badge">${attestation.overallStatus}</span></p>

  <h2>Profile Information</h2>
  <table>
    <tr><th>Profile</th><td>${profile.name}</td></tr>
    <tr><th>Description</th><td>${profile.description}</td></tr>
    <tr><th>Time Window</th><td>${profile.timeWindow.description}</td></tr>
  </table>

  <h2>Evidence Sections</h2>
  <table>
    <thead>
      <tr><th>Section</th><th>Status</th><th>Message</th></tr>
    </thead>
    <tbody>
      ${attestation.sections.map((s) => `
        <tr>
          <td>${s.section.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</td>
          <td class="${s.status.toLowerCase()}">${s.status}</td>
          <td>${s.message}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Invariant Checks (${attestation.summary.invariantsPassed}/${attestation.invariantResults.length} Passed)</h2>
  ${attestation.invariantResults.map((inv) => `
    <div class="invariant">
      <div class="invariant-icon ${inv.status.toLowerCase()}">${inv.status === 'PASS' ? '&#10003;' : '&#10007;'}</div>
      <span>${inv.description}</span>
      ${inv.critical ? '<span class="critical">(Critical)</span>' : ''}
    </div>
  `).join('')}

  <h2>Summary</h2>
  <table>
    <tr><th>Sections Passed</th><td>${attestation.summary.sectionsPassed}</td></tr>
    <tr><th>Sections Failed</th><td>${attestation.summary.sectionsFailed}</td></tr>
    <tr><th>Sections Unavailable</th><td>${attestation.summary.sectionsUnavailable}</td></tr>
    <tr><th>Critical Failures</th><td>${attestation.summary.criticalFailures}</td></tr>
  </table>

  <h2>Integrity Verification</h2>
  <p style="margin-bottom: 8px;"><strong>Evidence Checksum:</strong></p>
  <div class="checksum">${attestation.evidenceChecksum}</div>
  <p style="margin: 16px 0 8px;"><strong>Attestation Checksum:</strong></p>
  <div class="checksum">${attestation.attestationChecksum}</div>
  <p style="margin-top: 12px; font-size: 13px; color: #6b7280;">To verify integrity, compare these checksums with the original evidence pack.</p>

  <div class="disclaimer">
    <strong>Legal Disclaimer:</strong> ${attestation.disclaimer} This document is provided for informational purposes only. PII has been redacted per profile requirements.
  </div>

  <div class="footer">
    AdLab Production Governance System &bull; Public Trust Attestation
  </div>
</body>
</html>`;
}

// ============================================
// Main Handler
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const format = searchParams.get('format') || 'json';

  // No token = 404
  if (!token) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Validate format
  if (!['json', 'markdown', 'md', 'pdf', 'html'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  // Verify token
  const verifyResult = await verifyTrustToken(token);

  if (!verifyResult.valid || !verifyResult.payload || !verifyResult.tokenRecord) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { payload, tokenRecord } = verifyResult;
  const profile = payload.scope.profile;

  try {
    // Build evidence
    const evidence = await buildEvidencePayload(payload.workspaceId);

    // Generate attestation
    const attestation = generateAttestation(evidence, profile);

    // Check for critical failures
    if (attestation.summary.criticalFailures > 0) {
      return NextResponse.json(
        {
          error: 'Attestation requirements not met',
          profile: attestation.profileName,
          status: attestation.overallStatus,
        },
        { status: 412 }
      );
    }

    // Apply redactions
    const profileDef = getProfile(profile);
    const redactedAttestation = applyRedactions(attestation, profileDef.redactionTargets);

    // Audit export
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
        trustAction: 'PUBLIC_TRUST_EXPORTED',
        profile,
        format,
        checksum: attestation.attestationChecksum,
      },
    });

    // Generate output based on format
    if (format === 'json') {
      const jsonOutput = {
        profile: {
          id: profile,
          name: attestation.profileName,
          description: profileDef.description,
        },
        status: attestation.overallStatus,
        timestamp: attestation.timestamp,
        environment: attestation.environment,
        sections: redactedAttestation.sections,
        invariants: redactedAttestation.invariantResults,
        summary: attestation.summary,
        integrity: {
          evidenceChecksum: attestation.evidenceChecksum,
          attestationChecksum: attestation.attestationChecksum,
        },
        token: {
          expiresAt: tokenRecord.expiresAt,
          issuedAt: tokenRecord.issuedAt,
        },
        disclaimer: attestation.disclaimer + ' PII has been redacted per profile requirements.',
      };

      return new NextResponse(JSON.stringify(jsonOutput, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="trust-attestation-${profile.toLowerCase()}-${new Date().toISOString().split('T')[0]}.json"`,
          'X-Trust-Checksum': attestation.attestationChecksum,
        },
      });
    }

    if (format === 'markdown' || format === 'md') {
      const markdown = generateMarkdown(redactedAttestation, profileDef);

      return new NextResponse(markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="trust-attestation-${profile.toLowerCase()}-${new Date().toISOString().split('T')[0]}.md"`,
          'X-Trust-Checksum': attestation.attestationChecksum,
        },
      });
    }

    if (format === 'pdf' || format === 'html') {
      const html = generateHTML(redactedAttestation, profileDef);

      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="trust-attestation-${profile.toLowerCase()}-${new Date().toISOString().split('T')[0]}.html"`,
          'X-Trust-Checksum': attestation.attestationChecksum,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('D33: Public trust export error:', error);
    return NextResponse.json({ error: 'Evidence temporarily unavailable' }, { status: 503 });
  }
}
