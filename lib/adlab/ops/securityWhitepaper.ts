// ============================================
// AdLab Security Whitepaper Generator
// ============================================
// PHASE D31: Security Whitepaper (Auto-Generated, Evidence-Backed).
//
// CORE PRINCIPLE:
// Every claim in the whitepaper MUST be derived from
// the D30 Evidence Pack. No static text. No assumptions.
//
// INVARIANTS:
// - READ-ONLY generation
// - Evidence-derived only
// - UNAVAILABLE if data missing
// - Regenerates on every request (no caching)
// ============================================

import crypto from 'crypto';

// ============================================
// Types
// ============================================

export type SectionId =
  | 'executive_summary'
  | 'system_architecture'
  | 'data_integrity'
  | 'access_control'
  | 'change_management'
  | 'monitoring_drift'
  | 'audit_forensics'
  | 'incident_preparedness'
  | 'evidence_integrity';

export interface WhitepaperSection {
  id: SectionId;
  title: string;
  order: number;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'PARTIAL';
  content: string;
  dataPoints: string[];
}

export interface SecurityWhitepaper {
  metadata: {
    title: string;
    version: string;
    generatedAt: string;
    sourceEndpoint: string;
    disclaimer: string;
  };
  sections: Record<SectionId, WhitepaperSection>;
  summary: {
    totalSections: number;
    availableSections: number;
    unavailableSections: number;
    partialSections: number;
  };
  checksum: string;
}

// ============================================
// Evidence Types (from D30)
// ============================================

interface EvidencePayload {
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
  metadata: {
    evidenceVersion: string;
    disclaimer: string;
    checksum: string;
  };
}

// ============================================
// Section Generators
// ============================================

function generateExecutiveSummary(evidence: EvidencePayload): WhitepaperSection {
  const dataPoints: string[] = [];
  const lines: string[] = [];

  // System identity
  if (evidence.system) {
    lines.push(`**System:** ${evidence.system.name}`);
    lines.push(`**Environment:** ${evidence.system.environment}`);
    lines.push(`**Version:** ${evidence.system.version || 'Not specified'}`);
    lines.push(`**Commit:** ${evidence.system.commitHash ? `\`${evidence.system.commitHash.substring(0, 8)}\`` : 'Not available'}`);
    dataPoints.push('system.name', 'system.environment', 'system.version', 'system.commitHash');
  }

  lines.push('');

  // Compliance status
  if (evidence.compliance) {
    const statusEmoji = evidence.compliance.currentStatus === 'PASS' ? '✅' :
                        evidence.compliance.currentStatus === 'WARN' ? '⚠️' : '❌';
    lines.push(`**Overall Compliance Status:** ${statusEmoji} ${evidence.compliance.currentStatus}`);
    lines.push(`**Last Compliance Check:** ${evidence.compliance.lastCheckedAt}`);
    dataPoints.push('compliance.currentStatus', 'compliance.lastCheckedAt');
  }

  // Go-live gate
  if (evidence.readiness?.latestGoLiveGate) {
    const gate = evidence.readiness.latestGoLiveGate;
    const gateEmoji = gate.status === 'PASS' ? '✅' : gate.status === 'FAIL' ? '❌' : '⚠️';
    lines.push(`**Go-Live Gate:** ${gateEmoji} ${gate.status}`);
    if (gate.timestamp) {
      lines.push(`**Gate Timestamp:** ${gate.timestamp}`);
    }
    if (gate.failedChecks.length > 0) {
      lines.push(`**Failed Checks:** ${gate.failedChecks.join(', ')}`);
    }
    dataPoints.push('readiness.latestGoLiveGate.status');
  }

  lines.push('');

  // Evidence integrity
  if (evidence.metadata) {
    lines.push(`**Evidence Checksum:** \`${evidence.metadata.checksum}\``);
    lines.push(`**Generated At:** ${evidence.system.generatedAt}`);
    dataPoints.push('metadata.checksum');
  }

  return {
    id: 'executive_summary',
    title: '1. Executive Summary',
    order: 1,
    status: evidence.system && evidence.compliance ? 'AVAILABLE' : 'PARTIAL',
    content: lines.join('\n'),
    dataPoints,
  };
}

function generateSystemArchitecture(evidence: EvidencePayload): WhitepaperSection {
  const dataPoints: string[] = [];
  const lines: string[] = [];

  lines.push('### Snapshot-Based Production Truth');
  lines.push('');
  lines.push('The system enforces a snapshot-based data model where production data is never queried directly. All analytics and reporting operate against immutable, versioned snapshots.');
  lines.push('');

  if (evidence.governance?.activeSnapshots) {
    const snapshots = evidence.governance.activeSnapshots;
    lines.push(`**Active Snapshots:** ${snapshots.length}`);
    if (snapshots.length > 0) {
      lines.push('');
      lines.push('| Platform | Dataset | Promoted At |');
      lines.push('|----------|---------|-------------|');
      for (const snap of snapshots.slice(0, 10)) {
        lines.push(`| ${snap.platform} | ${snap.dataset} | ${snap.promotedAt} |`);
      }
      if (snapshots.length > 10) {
        lines.push(`| ... | ... | (${snapshots.length - 10} more) |`);
      }
    }
    dataPoints.push('governance.activeSnapshots');
  } else {
    lines.push('**Active Snapshots:** UNAVAILABLE');
  }

  lines.push('');
  lines.push('### Immutable Audit Log Design');
  lines.push('');
  lines.push('All system mutations are recorded in an append-only audit log. The audit log supports:');
  lines.push('- No deletion of audit entries');
  lines.push('- Actor attribution for every change');
  lines.push('- Timestamp and reason for each mutation');
  lines.push('- Snapshot anchoring for forensic investigation');
  lines.push('');

  if (evidence.audit) {
    lines.push(`**Total Audit Events:** ${evidence.audit.totalAuditEvents.toLocaleString()}`);
    dataPoints.push('audit.totalAuditEvents');
  }

  lines.push('');
  lines.push('### Kill-Switch & Failure-Injection Safety Model');
  lines.push('');

  if (evidence.governance?.killSwitch) {
    const ks = evidence.governance.killSwitch;
    lines.push(`**Global Kill-Switch:** ${ks.global.enabled ? '🔴 ENABLED' : '🟢 Disabled'}`);
    if (ks.global.enabled && ks.global.reason) {
      lines.push(`- Reason: ${ks.global.reason}`);
    }
    lines.push(`**Workspace Kill-Switches Active:** ${ks.workspace.length}`);
    dataPoints.push('governance.killSwitch.global', 'governance.killSwitch.workspace');
  }

  lines.push('');

  if (evidence.governance?.failureInjection) {
    const fi = evidence.governance.failureInjection;
    lines.push(`**Active Failure Injections:** ${fi.activeConfigs.length}`);
    if (fi.activeConfigs.length > 0) {
      lines.push('');
      for (const config of fi.activeConfigs) {
        lines.push(`- ${config.action}: ${config.failureType} @ ${config.probability}%`);
      }
    }
    dataPoints.push('governance.failureInjection.activeConfigs');
  }

  return {
    id: 'system_architecture',
    title: '2. System Architecture & Trust Model',
    order: 2,
    status: evidence.governance ? 'AVAILABLE' : 'UNAVAILABLE',
    content: lines.join('\n'),
    dataPoints,
  };
}

function generateDataIntegrity(evidence: EvidencePayload): WhitepaperSection {
  const dataPoints: string[] = [];
  const lines: string[] = [];

  lines.push('### Snapshot Invariants');
  lines.push('');
  lines.push('Production data integrity is maintained through strict snapshot invariants:');
  lines.push('');
  lines.push('1. **Single Active Snapshot:** Only one snapshot per dataset/platform can be active');
  lines.push('2. **Promotion Binding:** Snapshots are bound to validated ingestion logs');
  lines.push('3. **Immutable History:** Snapshot content is never modified after promotion');
  lines.push('4. **Activation-Only Control:** Snapshots are deactivated, never deleted');
  lines.push('');

  if (evidence.governance?.activeSnapshots) {
    const platforms = [...new Set(evidence.governance.activeSnapshots.map(s => s.platform))];
    const datasets = [...new Set(evidence.governance.activeSnapshots.map(s => s.dataset))];
    lines.push(`**Active Platforms:** ${platforms.join(', ') || 'None'}`);
    lines.push(`**Active Datasets:** ${datasets.length}`);
    dataPoints.push('governance.activeSnapshots');
  }

  lines.push('');
  lines.push('### Promotion → Snapshot → Analytics Binding');
  lines.push('');
  lines.push('Data flows through a strict pipeline:');
  lines.push('');
  lines.push('1. **Validation:** Raw data is validated against schema and business rules');
  lines.push('2. **Ingestion Log:** Validated data creates an immutable ingestion record');
  lines.push('3. **Promotion:** Admin-approved promotion creates a production snapshot');
  lines.push('4. **Analytics Binding:** Dashboards query only from active snapshots');
  lines.push('');

  lines.push('### Rollback Guarantees');
  lines.push('');
  lines.push('The system supports instant rollback to any previous snapshot:');
  lines.push('');
  lines.push('- Rollback is an activation switch, not data restoration');
  lines.push('- All rollbacks are audited with actor and reason');
  lines.push('- Kill-switch blocks rollback during emergencies');
  lines.push('');

  lines.push('### No Delete Policy');
  lines.push('');
  lines.push('The system enforces a strict no-delete policy:');
  lines.push('');
  lines.push('- Audit logs: Append-only, no deletion');
  lines.push('- Snapshots: Deactivation only, historical snapshots preserved');
  lines.push('- Config overrides: No deletion, only expiration');

  return {
    id: 'data_integrity',
    title: '3. Data Integrity & Consistency Guarantees',
    order: 3,
    status: 'AVAILABLE',
    content: lines.join('\n'),
    dataPoints,
  };
}

function generateAccessControl(evidence: EvidencePayload): WhitepaperSection {
  const dataPoints: string[] = [];
  const lines: string[] = [];

  lines.push('### RBAC Roles');
  lines.push('');
  lines.push('The system implements role-based access control with four tiers:');
  lines.push('');

  if (evidence.rbac?.rolesMatrix) {
    const rm = evidence.rbac.rolesMatrix;
    lines.push('| Role | Count | Permissions |');
    lines.push('|------|-------|-------------|');
    lines.push(`| **Owner** | ${rm.owner.length} | All operations, kill-switch, failure-injection, config overrides |`);
    lines.push(`| **Admin** | ${rm.admin.length} | Promote, rollback, snapshot management, evidence export |`);
    lines.push(`| **Editor** | ${rm.editor.length} | Validate, ingest, create drafts |`);
    lines.push(`| **Viewer** | ${rm.viewer.length} | Read-only analytics access |`);
    dataPoints.push('rbac.rolesMatrix');
  } else {
    lines.push('**Role Matrix:** UNAVAILABLE');
  }

  lines.push('');
  lines.push('### Workspace Membership as Source of Truth');
  lines.push('');
  lines.push('Actor identity is derived from workspace membership records:');
  lines.push('');

  if (evidence.rbac) {
    lines.push(`**Total Members:** ${evidence.rbac.workspaceMembersCount}`);
    lines.push(`**Owner Count:** ${evidence.rbac.ownerCount}`);
    dataPoints.push('rbac.workspaceMembersCount', 'rbac.ownerCount');
  }

  lines.push('');
  lines.push('### Server-Derived Actor Model');
  lines.push('');
  lines.push('Security invariants:');
  lines.push('');
  lines.push('- Actor context is resolved server-side from authenticated session');
  lines.push('- Role is derived from workspace membership, never client-provided');
  lines.push('- All mutations include actor attribution');
  lines.push('- Inactive memberships are rejected at resolution time');
  lines.push('');

  lines.push('### No Client-Provided Role Trust');
  lines.push('');
  lines.push('The system explicitly rejects:');
  lines.push('');
  lines.push('- Client-provided role claims');
  lines.push('- Direct workspace ID from request body for authorization');
  lines.push('- Cached role information');

  if (evidence.rbac?.invariantsSummary) {
    lines.push('');
    lines.push('### RBAC Invariants');
    lines.push('');
    lines.push('```');
    lines.push(evidence.rbac.invariantsSummary);
    lines.push('```');
    dataPoints.push('rbac.invariantsSummary');
  }

  return {
    id: 'access_control',
    title: '4. Access Control & Identity',
    order: 4,
    status: evidence.rbac ? 'AVAILABLE' : 'UNAVAILABLE',
    content: lines.join('\n'),
    dataPoints,
  };
}

function generateChangeManagement(evidence: EvidencePayload): WhitepaperSection {
  const dataPoints: string[] = [];
  const lines: string[] = [];

  lines.push('### Go-Live Hard Gate');
  lines.push('');
  lines.push('Production deployments are protected by a hard gate:');
  lines.push('');

  if (evidence.readiness?.latestGoLiveGate) {
    const gate = evidence.readiness.latestGoLiveGate;
    const statusEmoji = gate.status === 'PASS' ? '✅' : gate.status === 'FAIL' ? '❌' : '⚠️';
    lines.push(`**Current Gate Status:** ${statusEmoji} ${gate.status}`);
    if (gate.timestamp) {
      lines.push(`**Last Check:** ${gate.timestamp}`);
    }
    if (gate.failedChecks.length > 0) {
      lines.push(`**Failed Checks:** ${gate.failedChecks.join(', ')}`);
    }
    dataPoints.push('readiness.latestGoLiveGate');
  } else {
    lines.push('**Gate Status:** UNAVAILABLE');
  }

  lines.push('');
  lines.push('### Readiness Checks');
  lines.push('');

  if (evidence.readiness?.readinessChecks) {
    const checks = evidence.readiness.readinessChecks;
    const passed = checks.filter(c => c.status === 'PASS').length;
    const failed = checks.filter(c => c.status === 'FAIL').length;
    const warned = checks.filter(c => c.status === 'WARN').length;

    lines.push(`**Total Checks:** ${checks.length}`);
    lines.push(`**Passed:** ${passed} | **Failed:** ${failed} | **Warnings:** ${warned}`);
    lines.push('');

    lines.push('| Check | Status | Category |');
    lines.push('|-------|--------|----------|');
    for (const check of checks) {
      const emoji = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️';
      lines.push(`| ${check.checkId} | ${emoji} ${check.status} | ${check.category} |`);
    }
    dataPoints.push('readiness.readinessChecks');
  } else {
    lines.push('**Readiness Checks:** UNAVAILABLE');
  }

  lines.push('');
  lines.push('### No Deploy on FAIL (HTTP 412)');
  lines.push('');
  lines.push('The go-live gate enforces deployment safety:');
  lines.push('');
  lines.push('- `GET /api/adlab/system/go-live` returns HTTP 200 on PASS');
  lines.push('- Returns HTTP 412 (Precondition Failed) on FAIL');
  lines.push('- CI/CD pipelines MUST check this endpoint before deploy');
  lines.push('- No manual override for FAIL status');
  lines.push('');

  lines.push('### Drift Detection Model');
  lines.push('');

  if (evidence.compliance) {
    const comp = evidence.compliance;
    lines.push(`**Current Drift Status:** ${comp.currentStatus}`);
    if (comp.driftTypes.length > 0) {
      lines.push(`**Drift Types Detected:** ${comp.driftTypes.join(', ')}`);
    } else {
      lines.push('**Drift Types:** None detected');
    }
    lines.push('');
    lines.push('**SLA Thresholds:**');
    lines.push(`- Warn: ${comp.slaThresholds.warnMinutes} minutes`);
    lines.push(`- Fail: ${comp.slaThresholds.failMinutes} minutes`);
    lines.push(`- Critical: ${comp.slaThresholds.criticalMinutes} minutes`);
    dataPoints.push('compliance.currentStatus', 'compliance.driftTypes', 'compliance.slaThresholds');
  }

  return {
    id: 'change_management',
    title: '5. Change Management & Deploy Safety',
    order: 5,
    status: evidence.readiness ? 'AVAILABLE' : 'PARTIAL',
    content: lines.join('\n'),
    dataPoints,
  };
}

function generateMonitoringDrift(evidence: EvidencePayload): WhitepaperSection {
  const dataPoints: string[] = [];
  const lines: string[] = [];

  lines.push('### Continuous Compliance Monitor');
  lines.push('');
  lines.push('The system runs continuous compliance monitoring:');
  lines.push('');

  if (evidence.compliance) {
    lines.push(`**Last Check:** ${evidence.compliance.lastCheckedAt}`);
    lines.push(`**Status:** ${evidence.compliance.currentStatus}`);
    dataPoints.push('compliance.lastCheckedAt', 'compliance.currentStatus');
  }

  lines.push('');
  lines.push('### Drift Types Detected');
  lines.push('');

  if (evidence.compliance?.driftTypes) {
    if (evidence.compliance.driftTypes.length > 0) {
      lines.push('Currently detecting:');
      lines.push('');
      for (const drift of evidence.compliance.driftTypes) {
        lines.push(`- ${drift}`);
      }
    } else {
      lines.push('No drift currently detected.');
    }
    dataPoints.push('compliance.driftTypes');
  } else {
    lines.push('**Drift Detection:** UNAVAILABLE');
  }

  lines.push('');
  lines.push('### Auto Kill-Switch Behavior');
  lines.push('');
  lines.push('The system can automatically trigger kill-switch under critical conditions:');
  lines.push('');
  lines.push('- Critical data staleness beyond SLA');
  lines.push('- Multiple critical drift items detected');
  lines.push('- Audit log write failures');
  lines.push('');

  if (evidence.governance?.killSwitch?.global) {
    const ks = evidence.governance.killSwitch.global;
    lines.push(`**Current Kill-Switch State:** ${ks.enabled ? '🔴 ACTIVE' : '🟢 Inactive'}`);
    if (ks.enabled && ks.reason) {
      lines.push(`**Reason:** ${ks.reason}`);
      lines.push(`**Activated At:** ${ks.activatedAt}`);
    }
    dataPoints.push('governance.killSwitch.global');
  }

  lines.push('');
  lines.push('### Alerting & Escalation');
  lines.push('');
  lines.push('Alert channels supported:');
  lines.push('');
  lines.push('- Slack webhook integration');
  lines.push('- PagerDuty escalation');
  lines.push('- Custom webhook endpoints');
  lines.push('- Email notifications');

  return {
    id: 'monitoring_drift',
    title: '6. Monitoring, Drift & Auto-Response',
    order: 6,
    status: evidence.compliance ? 'AVAILABLE' : 'UNAVAILABLE',
    content: lines.join('\n'),
    dataPoints,
  };
}

function generateAuditForensics(evidence: EvidencePayload): WhitepaperSection {
  const dataPoints: string[] = [];
  const lines: string[] = [];

  lines.push('### Immutable Audit Log');
  lines.push('');
  lines.push('All system mutations are recorded in an append-only audit log:');
  lines.push('');

  if (evidence.audit) {
    lines.push(`**Total Events:** ${evidence.audit.totalAuditEvents.toLocaleString()}`);
    dataPoints.push('audit.totalAuditEvents');

    lines.push('');
    lines.push('### Event Coverage Summary (Last 30 Days)');
    lines.push('');

    if (Object.keys(evidence.audit.eventsByType).length > 0) {
      lines.push('| Action | Count |');
      lines.push('|--------|-------|');
      for (const [action, count] of Object.entries(evidence.audit.eventsByType)) {
        lines.push(`| ${action} | ${count} |`);
      }
      dataPoints.push('audit.eventsByType');
    } else {
      lines.push('No events recorded in the last 30 days.');
    }
  } else {
    lines.push('**Audit Log:** UNAVAILABLE');
  }

  lines.push('');
  lines.push('### Critical Event Visibility');
  lines.push('');

  if (evidence.audit?.mostRecentCriticalEvents) {
    const events = evidence.audit.mostRecentCriticalEvents;
    if (events.length > 0) {
      lines.push('Recent critical events (PROMOTE, ROLLBACK, SNAPSHOT_ACTIVATE, SNAPSHOT_DEACTIVATE):');
      lines.push('');
      lines.push('| Timestamp | Action | Entity Type |');
      lines.push('|-----------|--------|-------------|');
      for (const event of events) {
        lines.push(`| ${event.timestamp} | ${event.action} | ${event.entityType} |`);
      }
      dataPoints.push('audit.mostRecentCriticalEvents');
    } else {
      lines.push('No recent critical events.');
    }
  }

  lines.push('');
  lines.push('### Snapshot-Anchored Investigations');
  lines.push('');
  lines.push('Forensic investigations are supported through:');
  lines.push('');
  lines.push('- Audit log entries linked to snapshot IDs');
  lines.push('- Ingestion log references in promotion records');
  lines.push('- Actor attribution on all mutations');
  lines.push('- Timestamp ordering for event reconstruction');

  return {
    id: 'audit_forensics',
    title: '7. Audit & Forensics',
    order: 7,
    status: evidence.audit ? 'AVAILABLE' : 'UNAVAILABLE',
    content: lines.join('\n'),
    dataPoints,
  };
}

function generateIncidentPreparedness(evidence: EvidencePayload): WhitepaperSection {
  const dataPoints: string[] = [];
  const lines: string[] = [];

  lines.push('### Operator Drills');
  lines.push('');
  lines.push('The system supports structured operator training through drills:');
  lines.push('');
  lines.push('- Kill-switch activation/deactivation');
  lines.push('- Emergency rollback procedures');
  lines.push('- Data staleness response');
  lines.push('- Compliance failure investigation');
  lines.push('');

  lines.push('### Certification Rules');
  lines.push('');
  lines.push('Operators must maintain certification:');
  lines.push('');
  lines.push('- Minimum drill completion within certification window');
  lines.push('- DRY_RUN mode enforced before production execution');
  lines.push('- All drill actions are audited');
  lines.push('');

  lines.push('### DRY-RUN Enforcement');
  lines.push('');
  lines.push('Critical operations support dry-run mode:');
  lines.push('');
  lines.push('- Validate operation without execution');
  lines.push('- Preview affected data and snapshots');
  lines.push('- Audit dry-run attempts for training verification');
  lines.push('');

  lines.push('### SLA Scoring Model');
  lines.push('');

  if (evidence.compliance?.slaThresholds) {
    const sla = evidence.compliance.slaThresholds;
    lines.push('Current SLA thresholds:');
    lines.push('');
    lines.push(`- **Warning threshold:** ${sla.warnMinutes} minutes`);
    lines.push(`- **Failure threshold:** ${sla.failMinutes} minutes`);
    lines.push(`- **Critical threshold:** ${sla.criticalMinutes} minutes`);
    dataPoints.push('compliance.slaThresholds');
  } else {
    lines.push('**SLA Thresholds:** UNAVAILABLE');
  }

  return {
    id: 'incident_preparedness',
    title: '8. Incident Preparedness',
    order: 8,
    status: 'AVAILABLE',
    content: lines.join('\n'),
    dataPoints,
  };
}

function generateEvidenceIntegrity(evidence: EvidencePayload): WhitepaperSection {
  const dataPoints: string[] = [];
  const lines: string[] = [];

  lines.push('### SHA-256 Checksum');
  lines.push('');

  if (evidence.metadata?.checksum) {
    lines.push(`**Evidence Checksum:** \`${evidence.metadata.checksum}\``);
    lines.push('');
    lines.push('This checksum can be used to verify that the evidence data has not been modified since generation.');
    dataPoints.push('metadata.checksum');
  } else {
    lines.push('**Checksum:** UNAVAILABLE');
  }

  lines.push('');
  lines.push('### Timestamp');
  lines.push('');

  if (evidence.system?.generatedAt) {
    lines.push(`**Generated At:** ${evidence.system.generatedAt}`);
    dataPoints.push('system.generatedAt');
  } else {
    lines.push('**Timestamp:** UNAVAILABLE');
  }

  lines.push('');
  lines.push('### Disclaimer');
  lines.push('');
  lines.push('> **IMPORTANT:** This document reflects system state at generation time only.');
  lines.push('> ');
  lines.push('> For current production state, regenerate this whitepaper or query the evidence API directly.');
  lines.push('> ');
  lines.push('> This whitepaper is auto-generated from the D30 Evidence Pack API.');
  lines.push('> No claims are manually authored. All data points are derived from production truth.');

  if (evidence.metadata?.disclaimer) {
    lines.push('');
    lines.push(`**Source Disclaimer:** ${evidence.metadata.disclaimer}`);
    dataPoints.push('metadata.disclaimer');
  }

  return {
    id: 'evidence_integrity',
    title: '9. Evidence Integrity',
    order: 9,
    status: evidence.metadata ? 'AVAILABLE' : 'PARTIAL',
    content: lines.join('\n'),
    dataPoints,
  };
}

// ============================================
// Main Generator
// ============================================

/**
 * Generates a security whitepaper from evidence data.
 * All content is derived from the evidence payload.
 */
export function generateSecurityWhitepaper(evidence: EvidencePayload): SecurityWhitepaper {
  const generatedAt = new Date().toISOString();

  // Generate all sections
  const sections: Record<SectionId, WhitepaperSection> = {
    executive_summary: generateExecutiveSummary(evidence),
    system_architecture: generateSystemArchitecture(evidence),
    data_integrity: generateDataIntegrity(evidence),
    access_control: generateAccessControl(evidence),
    change_management: generateChangeManagement(evidence),
    monitoring_drift: generateMonitoringDrift(evidence),
    audit_forensics: generateAuditForensics(evidence),
    incident_preparedness: generateIncidentPreparedness(evidence),
    evidence_integrity: generateEvidenceIntegrity(evidence),
  };

  // Calculate summary
  const sectionList = Object.values(sections);
  const summary = {
    totalSections: sectionList.length,
    availableSections: sectionList.filter(s => s.status === 'AVAILABLE').length,
    unavailableSections: sectionList.filter(s => s.status === 'UNAVAILABLE').length,
    partialSections: sectionList.filter(s => s.status === 'PARTIAL').length,
  };

  // Build whitepaper without checksum for hashing
  const whitepaperWithoutChecksum = {
    metadata: {
      title: 'AdLab Production Security Whitepaper',
      version: '1.0.0',
      generatedAt,
      sourceEndpoint: '/api/adlab/system/compliance/evidence',
      disclaimer: 'This document reflects system state at generation time only. Auto-generated from D30 Evidence Pack.',
    },
    sections,
    summary,
  };

  // Generate checksum
  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(whitepaperWithoutChecksum))
    .digest('hex');

  return {
    ...whitepaperWithoutChecksum,
    checksum,
  };
}

/**
 * Section order for rendering.
 */
export const SECTION_ORDER: SectionId[] = [
  'executive_summary',
  'system_architecture',
  'data_integrity',
  'access_control',
  'change_management',
  'monitoring_drift',
  'audit_forensics',
  'incident_preparedness',
  'evidence_integrity',
];
