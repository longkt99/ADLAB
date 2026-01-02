// ============================================
// AdLab Attestation Profile Engine
// ============================================
// PHASE D32: External Attestation Mode.
//
// PROVIDES:
// - Profile definitions for SOC2, ISO, Enterprise DD
// - Evidence section requirements per profile
// - Time window requirements
// - Redaction rules for external sharing
//
// INVARIANTS:
// - Profiles are configuration-only
// - No static text allowed
// - Everything maps to existing evidence data
// - Profiles filter, never fabricate
// ============================================

import crypto from 'crypto';

// ============================================
// Types
// ============================================

export type AttestationProfile =
  | 'SOC2_TYPE1'
  | 'SOC2_TYPE2'
  | 'ISO_27001'
  | 'ENTERPRISE_DD';

export type EvidenceSection =
  | 'system_identity'
  | 'governance_state'
  | 'readiness_gate'
  | 'compliance_drift'
  | 'audit_coverage'
  | 'rbac_membership'
  | 'data_integrity'
  | 'incident_response';

export type RedactionTarget =
  | 'user_ids'
  | 'workspace_ids'
  | 'internal_ips'
  | 'api_keys'
  | 'email_addresses';

export interface TimeWindowRequirement {
  minDays: number;
  maxDays: number;
  description: string;
}

export interface InvariantRequirement {
  id: string;
  description: string;
  checkPath: string; // JSON path in evidence
  expectedStatus: 'PASS' | 'WARN' | 'ANY';
  critical: boolean;
}

export interface ProfileDefinition {
  id: AttestationProfile;
  name: string;
  description: string;
  requiredSections: EvidenceSection[];
  optionalSections: EvidenceSection[];
  timeWindow: TimeWindowRequirement;
  invariants: InvariantRequirement[];
  redactionTargets: RedactionTarget[];
  minReadinessChecks: number;
  requireGoLiveGatePass: boolean;
  requireZeroCriticalDrift: boolean;
  auditEventMinimum: number;
}

export interface SectionStatus {
  section: EvidenceSection;
  status: 'PASS' | 'WARN' | 'FAIL' | 'UNAVAILABLE';
  message: string;
  dataPoints: number;
  redactedFields: number;
}

export interface AttestationResult {
  profile: AttestationProfile;
  profileName: string;
  timestamp: string;
  environment: string;
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  sections: SectionStatus[];
  invariantResults: Array<{
    id: string;
    description: string;
    status: 'PASS' | 'FAIL';
    critical: boolean;
  }>;
  summary: {
    sectionsTotal: number;
    sectionsPassed: number;
    sectionsFailed: number;
    sectionsUnavailable: number;
    invariantsPassed: number;
    invariantsFailed: number;
    criticalFailures: number;
  };
  evidenceChecksum: string;
  attestationChecksum: string;
  disclaimer: string;
}

// ============================================
// Profile Definitions
// ============================================

export const ATTESTATION_PROFILES: Record<AttestationProfile, ProfileDefinition> = {
  SOC2_TYPE1: {
    id: 'SOC2_TYPE1',
    name: 'SOC 2 Type I',
    description: 'Point-in-time assessment of security controls design',
    requiredSections: [
      'system_identity',
      'governance_state',
      'rbac_membership',
      'audit_coverage',
    ],
    optionalSections: [
      'readiness_gate',
      'compliance_drift',
    ],
    timeWindow: {
      minDays: 0,
      maxDays: 1,
      description: 'Point-in-time snapshot',
    },
    invariants: [
      {
        id: 'kill_switch_present',
        description: 'Kill-switch mechanism exists',
        checkPath: 'governance.killSwitch',
        expectedStatus: 'ANY',
        critical: true,
      },
      {
        id: 'audit_log_present',
        description: 'Audit logging is operational',
        checkPath: 'audit.totalAuditEvents',
        expectedStatus: 'ANY',
        critical: true,
      },
      {
        id: 'rbac_defined',
        description: 'RBAC roles are defined',
        checkPath: 'rbac.rolesMatrix',
        expectedStatus: 'ANY',
        critical: true,
      },
    ],
    redactionTargets: ['user_ids', 'email_addresses', 'internal_ips'],
    minReadinessChecks: 0,
    requireGoLiveGatePass: false,
    requireZeroCriticalDrift: false,
    auditEventMinimum: 0,
  },

  SOC2_TYPE2: {
    id: 'SOC2_TYPE2',
    name: 'SOC 2 Type II',
    description: 'Operating effectiveness of security controls over time',
    requiredSections: [
      'system_identity',
      'governance_state',
      'readiness_gate',
      'compliance_drift',
      'audit_coverage',
      'rbac_membership',
      'incident_response',
    ],
    optionalSections: [
      'data_integrity',
    ],
    timeWindow: {
      minDays: 90,
      maxDays: 365,
      description: 'Minimum 90-day observation period',
    },
    invariants: [
      {
        id: 'kill_switch_present',
        description: 'Kill-switch mechanism exists',
        checkPath: 'governance.killSwitch',
        expectedStatus: 'ANY',
        critical: true,
      },
      {
        id: 'audit_log_operational',
        description: 'Audit logging has continuous coverage',
        checkPath: 'audit.totalAuditEvents',
        expectedStatus: 'PASS',
        critical: true,
      },
      {
        id: 'rbac_enforced',
        description: 'RBAC is actively enforced',
        checkPath: 'rbac.workspaceMembersCount',
        expectedStatus: 'PASS',
        critical: true,
      },
      {
        id: 'compliance_monitored',
        description: 'Continuous compliance monitoring active',
        checkPath: 'compliance.currentStatus',
        expectedStatus: 'ANY',
        critical: true,
      },
      {
        id: 'go_live_gate_exists',
        description: 'Go-live gate mechanism exists',
        checkPath: 'readiness.latestGoLiveGate',
        expectedStatus: 'ANY',
        critical: false,
      },
    ],
    redactionTargets: ['user_ids', 'email_addresses', 'internal_ips', 'api_keys'],
    minReadinessChecks: 5,
    requireGoLiveGatePass: false,
    requireZeroCriticalDrift: false,
    auditEventMinimum: 100,
  },

  ISO_27001: {
    id: 'ISO_27001',
    name: 'ISO 27001',
    description: 'Information security management system compliance',
    requiredSections: [
      'system_identity',
      'governance_state',
      'rbac_membership',
      'audit_coverage',
      'data_integrity',
      'incident_response',
    ],
    optionalSections: [
      'readiness_gate',
      'compliance_drift',
    ],
    timeWindow: {
      minDays: 30,
      maxDays: 365,
      description: 'Minimum 30-day observation period',
    },
    invariants: [
      {
        id: 'access_control',
        description: 'Access control mechanisms in place',
        checkPath: 'rbac.rolesMatrix',
        expectedStatus: 'ANY',
        critical: true,
      },
      {
        id: 'audit_trail',
        description: 'Audit trail maintained',
        checkPath: 'audit.totalAuditEvents',
        expectedStatus: 'PASS',
        critical: true,
      },
      {
        id: 'change_management',
        description: 'Change management controls exist',
        checkPath: 'governance.activeSnapshots',
        expectedStatus: 'ANY',
        critical: true,
      },
      {
        id: 'incident_capability',
        description: 'Incident response capability exists',
        checkPath: 'governance.killSwitch',
        expectedStatus: 'ANY',
        critical: true,
      },
    ],
    redactionTargets: ['user_ids', 'email_addresses', 'internal_ips', 'workspace_ids'],
    minReadinessChecks: 3,
    requireGoLiveGatePass: false,
    requireZeroCriticalDrift: false,
    auditEventMinimum: 50,
  },

  ENTERPRISE_DD: {
    id: 'ENTERPRISE_DD',
    name: 'Enterprise Due Diligence',
    description: 'Comprehensive security assessment for enterprise customers',
    requiredSections: [
      'system_identity',
      'governance_state',
      'readiness_gate',
      'compliance_drift',
      'audit_coverage',
      'rbac_membership',
      'data_integrity',
      'incident_response',
    ],
    optionalSections: [],
    timeWindow: {
      minDays: 7,
      maxDays: 90,
      description: 'Recent operational data (7-90 days)',
    },
    invariants: [
      {
        id: 'production_ready',
        description: 'System is production ready',
        checkPath: 'readiness.latestGoLiveGate.status',
        expectedStatus: 'PASS',
        critical: true,
      },
      {
        id: 'no_critical_drift',
        description: 'No critical compliance drift',
        checkPath: 'compliance.currentStatus',
        expectedStatus: 'PASS',
        critical: true,
      },
      {
        id: 'kill_switch_inactive',
        description: 'Kill-switch is not active (system operational)',
        checkPath: 'governance.killSwitch.global.enabled',
        expectedStatus: 'PASS',
        critical: true,
      },
      {
        id: 'audit_coverage',
        description: 'Comprehensive audit coverage',
        checkPath: 'audit.totalAuditEvents',
        expectedStatus: 'PASS',
        critical: false,
      },
      {
        id: 'owner_present',
        description: 'At least one owner assigned',
        checkPath: 'rbac.ownerCount',
        expectedStatus: 'PASS',
        critical: true,
      },
    ],
    redactionTargets: ['user_ids', 'email_addresses', 'internal_ips', 'api_keys', 'workspace_ids'],
    minReadinessChecks: 5,
    requireGoLiveGatePass: true,
    requireZeroCriticalDrift: true,
    auditEventMinimum: 10,
  },
};

// ============================================
// Profile Helpers
// ============================================

export function getProfile(profileId: AttestationProfile): ProfileDefinition {
  return ATTESTATION_PROFILES[profileId];
}

export function getAllProfiles(): ProfileDefinition[] {
  return Object.values(ATTESTATION_PROFILES);
}

export function getProfileIds(): AttestationProfile[] {
  return Object.keys(ATTESTATION_PROFILES) as AttestationProfile[];
}

export function isValidProfile(profileId: string): profileId is AttestationProfile {
  return profileId in ATTESTATION_PROFILES;
}

// ============================================
// Redaction Engine
// ============================================

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const API_KEY_REGEX = /(?:sk|pk|api|key|token)[_-]?[a-zA-Z0-9]{20,}/gi;

function redactValue(value: unknown, targets: RedactionTarget[]): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    let redacted = value;

    if (targets.includes('user_ids') || targets.includes('workspace_ids')) {
      redacted = redacted.replace(UUID_REGEX, '[REDACTED-ID]');
    }
    if (targets.includes('email_addresses')) {
      redacted = redacted.replace(EMAIL_REGEX, '[REDACTED-EMAIL]');
    }
    if (targets.includes('internal_ips')) {
      redacted = redacted.replace(IP_REGEX, '[REDACTED-IP]');
    }
    if (targets.includes('api_keys')) {
      redacted = redacted.replace(API_KEY_REGEX, '[REDACTED-KEY]');
    }

    return redacted;
  }

  if (Array.isArray(value)) {
    return value.map(item => redactValue(item, targets));
  }

  if (typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Redact specific field names
      if (
        (targets.includes('user_ids') && (k === 'user_id' || k === 'actorId' || k === 'actor_id' || k === 'activatedBy')) ||
        (targets.includes('workspace_ids') && (k === 'workspace_id' || k === 'workspaceId'))
      ) {
        if (typeof v === 'string') {
          redacted[k] = '[REDACTED-ID]';
        } else if (Array.isArray(v)) {
          redacted[k] = v.map(() => '[REDACTED-ID]');
        } else {
          redacted[k] = redactValue(v, targets);
        }
      } else {
        redacted[k] = redactValue(v, targets);
      }
    }
    return redacted;
  }

  return value;
}

export function applyRedactions<T>(data: T, targets: RedactionTarget[]): T {
  return redactValue(data, targets) as T;
}

export function countRedactions(original: unknown, redacted: unknown): number {
  const _originalStr = JSON.stringify(original);
  const redactedStr = JSON.stringify(redacted);

  const redactedCount = (redactedStr.match(/\[REDACTED-/g) || []).length;
  return redactedCount;
}

// ============================================
// Evidence Evaluation
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
      workspace: Array<unknown>;
    };
    failureInjection: {
      activeConfigs: Array<unknown>;
    };
    freshnessPolicies: {
      defaults: Record<string, unknown>;
      workspaceOverrides: Array<unknown>;
    };
    activeSnapshots: Array<unknown>;
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
    mostRecentCriticalEvents: Array<unknown>;
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

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function evaluateInvariant(
  evidence: EvidencePayload,
  invariant: InvariantRequirement
): { status: 'PASS' | 'FAIL'; message: string } {
  const value = getNestedValue(evidence, invariant.checkPath);

  // Check if value exists
  if (value === undefined || value === null) {
    return {
      status: 'FAIL',
      message: `Required data missing at ${invariant.checkPath}`,
    };
  }

  // For expectedStatus 'ANY', just check existence
  if (invariant.expectedStatus === 'ANY') {
    return {
      status: 'PASS',
      message: `Data present at ${invariant.checkPath}`,
    };
  }

  // Special handling for specific paths
  if (invariant.checkPath === 'governance.killSwitch.global.enabled') {
    // For enterprise DD, we want kill switch to be INACTIVE (enabled = false)
    if (value === false) {
      return { status: 'PASS', message: 'Kill-switch is inactive (system operational)' };
    }
    return { status: 'FAIL', message: 'Kill-switch is active' };
  }

  if (invariant.checkPath === 'readiness.latestGoLiveGate.status') {
    if (value === 'PASS') {
      return { status: 'PASS', message: 'Go-live gate passed' };
    }
    return { status: 'FAIL', message: `Go-live gate status: ${value}` };
  }

  if (invariant.checkPath === 'compliance.currentStatus') {
    if (value === 'PASS') {
      return { status: 'PASS', message: 'Compliance status is PASS' };
    }
    if (value === 'WARN' && invariant.expectedStatus === 'WARN') {
      return { status: 'PASS', message: 'Compliance status is WARN (acceptable)' };
    }
    return { status: 'FAIL', message: `Compliance status: ${value}` };
  }

  if (invariant.checkPath === 'rbac.ownerCount') {
    if (typeof value === 'number' && value > 0) {
      return { status: 'PASS', message: `${value} owner(s) assigned` };
    }
    return { status: 'FAIL', message: 'No owners assigned' };
  }

  if (invariant.checkPath === 'audit.totalAuditEvents') {
    if (typeof value === 'number' && value > 0) {
      return { status: 'PASS', message: `${value} audit events recorded` };
    }
    return { status: 'FAIL', message: 'No audit events recorded' };
  }

  if (invariant.checkPath === 'rbac.workspaceMembersCount') {
    if (typeof value === 'number' && value > 0) {
      return { status: 'PASS', message: `${value} workspace members` };
    }
    return { status: 'FAIL', message: 'No workspace members' };
  }

  // Default: check if value is truthy
  if (value) {
    return { status: 'PASS', message: 'Check passed' };
  }
  return { status: 'FAIL', message: 'Check failed' };
}

function evaluateSection(
  evidence: EvidencePayload,
  section: EvidenceSection,
  profile: ProfileDefinition
): SectionStatus {
  let dataPoints = 0;

  switch (section) {
    case 'system_identity':
      dataPoints = evidence.system ? 5 : 0;
      return {
        section,
        status: evidence.system ? 'PASS' : 'UNAVAILABLE',
        message: evidence.system
          ? `System: ${evidence.system.name}, Env: ${evidence.system.environment}`
          : 'System identity data unavailable',
        dataPoints,
        redactedFields: 0,
      };

    case 'governance_state':
      if (!evidence.governance) {
        return { section, status: 'UNAVAILABLE', message: 'Governance data unavailable', dataPoints: 0, redactedFields: 0 };
      }
      dataPoints = 4;
      const ksActive = evidence.governance.killSwitch?.global?.enabled;
      const fiActive = evidence.governance.failureInjection?.activeConfigs?.length || 0;
      return {
        section,
        status: 'PASS',
        message: `Kill-switch: ${ksActive ? 'ACTIVE' : 'Inactive'}, Failure injections: ${fiActive}`,
        dataPoints,
        redactedFields: 0,
      };

    case 'readiness_gate':
      if (!evidence.readiness) {
        return { section, status: 'UNAVAILABLE', message: 'Readiness data unavailable', dataPoints: 0, redactedFields: 0 };
      }
      const checksCount = evidence.readiness.readinessChecks?.length || 0;
      const gateStatus = evidence.readiness.latestGoLiveGate?.status || 'UNKNOWN';
      dataPoints = checksCount + 1;

      if (profile.requireGoLiveGatePass && gateStatus !== 'PASS') {
        return {
          section,
          status: 'FAIL',
          message: `Go-live gate: ${gateStatus} (PASS required)`,
          dataPoints,
          redactedFields: 0,
        };
      }

      if (checksCount < profile.minReadinessChecks) {
        return {
          section,
          status: 'WARN',
          message: `${checksCount} readiness checks (minimum ${profile.minReadinessChecks} recommended)`,
          dataPoints,
          redactedFields: 0,
        };
      }

      return {
        section,
        status: gateStatus === 'PASS' ? 'PASS' : gateStatus === 'FAIL' ? 'FAIL' : 'WARN',
        message: `Go-live gate: ${gateStatus}, ${checksCount} readiness checks`,
        dataPoints,
        redactedFields: 0,
      };

    case 'compliance_drift':
      if (!evidence.compliance) {
        return { section, status: 'UNAVAILABLE', message: 'Compliance data unavailable', dataPoints: 0, redactedFields: 0 };
      }
      const driftCount = evidence.compliance.driftTypes?.length || 0;
      const compStatus = evidence.compliance.currentStatus;
      dataPoints = 4;

      if (profile.requireZeroCriticalDrift && compStatus === 'FAIL') {
        return {
          section,
          status: 'FAIL',
          message: `Compliance: ${compStatus} with ${driftCount} drift types (zero critical drift required)`,
          dataPoints,
          redactedFields: 0,
        };
      }

      return {
        section,
        status: compStatus === 'PASS' ? 'PASS' : compStatus === 'WARN' ? 'WARN' : 'FAIL',
        message: `Compliance: ${compStatus}, ${driftCount} drift types`,
        dataPoints,
        redactedFields: 0,
      };

    case 'audit_coverage':
      if (!evidence.audit) {
        return { section, status: 'UNAVAILABLE', message: 'Audit data unavailable', dataPoints: 0, redactedFields: 0 };
      }
      const totalEvents = evidence.audit.totalAuditEvents || 0;
      const eventTypes = Object.keys(evidence.audit.eventsByType || {}).length;
      dataPoints = totalEvents;

      if (totalEvents < profile.auditEventMinimum) {
        return {
          section,
          status: 'WARN',
          message: `${totalEvents} audit events (minimum ${profile.auditEventMinimum} recommended)`,
          dataPoints,
          redactedFields: 0,
        };
      }

      return {
        section,
        status: 'PASS',
        message: `${totalEvents} audit events across ${eventTypes} event types`,
        dataPoints,
        redactedFields: 0,
      };

    case 'rbac_membership':
      if (!evidence.rbac) {
        return { section, status: 'UNAVAILABLE', message: 'RBAC data unavailable', dataPoints: 0, redactedFields: 0 };
      }
      const memberCount = evidence.rbac.workspaceMembersCount || 0;
      const ownerCount = evidence.rbac.ownerCount || 0;
      dataPoints = memberCount;

      if (ownerCount === 0) {
        return {
          section,
          status: 'FAIL',
          message: 'No owners assigned',
          dataPoints,
          redactedFields: profile.redactionTargets.includes('user_ids') ? memberCount : 0,
        };
      }

      return {
        section,
        status: 'PASS',
        message: `${memberCount} members, ${ownerCount} owners`,
        dataPoints,
        redactedFields: profile.redactionTargets.includes('user_ids') ? memberCount : 0,
      };

    case 'data_integrity':
      const snapshotCount = evidence.governance?.activeSnapshots?.length || 0;
      dataPoints = snapshotCount;

      if (snapshotCount === 0) {
        return {
          section,
          status: 'WARN',
          message: 'No active snapshots',
          dataPoints,
          redactedFields: 0,
        };
      }

      return {
        section,
        status: 'PASS',
        message: `${snapshotCount} active snapshots`,
        dataPoints,
        redactedFields: 0,
      };

    case 'incident_response':
      const hasKillSwitch = !!evidence.governance?.killSwitch;
      const hasFailureInjection = !!evidence.governance?.failureInjection;
      dataPoints = (hasKillSwitch ? 1 : 0) + (hasFailureInjection ? 1 : 0);

      if (!hasKillSwitch) {
        return {
          section,
          status: 'FAIL',
          message: 'Kill-switch mechanism not present',
          dataPoints,
          redactedFields: 0,
        };
      }

      return {
        section,
        status: 'PASS',
        message: `Kill-switch: present, Failure injection: ${hasFailureInjection ? 'available' : 'not configured'}`,
        dataPoints,
        redactedFields: 0,
      };

    default:
      return {
        section,
        status: 'UNAVAILABLE',
        message: `Unknown section: ${section}`,
        dataPoints: 0,
        redactedFields: 0,
      };
  }
}

// ============================================
// Main Attestation Generator
// ============================================

export function generateAttestation(
  evidence: EvidencePayload,
  profileId: AttestationProfile
): AttestationResult {
  const profile = getProfile(profileId);
  const timestamp = new Date().toISOString();

  // Evaluate all required sections
  const sectionResults: SectionStatus[] = [];

  for (const section of profile.requiredSections) {
    sectionResults.push(evaluateSection(evidence, section, profile));
  }

  for (const section of profile.optionalSections) {
    const result = evaluateSection(evidence, section, profile);
    // Optional sections don't cause overall failure
    if (result.status === 'FAIL') {
      result.status = 'WARN';
    }
    sectionResults.push(result);
  }

  // Evaluate invariants
  const invariantResults = profile.invariants.map(inv => {
    const result = evaluateInvariant(evidence, inv);
    return {
      id: inv.id,
      description: inv.description,
      status: result.status,
      critical: inv.critical,
    };
  });

  // Calculate summary
  const sectionsPassed = sectionResults.filter(s => s.status === 'PASS').length;
  const sectionsFailed = sectionResults.filter(s => s.status === 'FAIL').length;
  const sectionsUnavailable = sectionResults.filter(s => s.status === 'UNAVAILABLE').length;
  const invariantsPassed = invariantResults.filter(i => i.status === 'PASS').length;
  const invariantsFailed = invariantResults.filter(i => i.status === 'FAIL').length;
  const criticalFailures = invariantResults.filter(i => i.status === 'FAIL' && i.critical).length;

  // Determine overall status
  let overallStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  if (criticalFailures > 0 || sectionsFailed > 0) {
    overallStatus = 'FAIL';
  } else if (
    sectionsUnavailable > 0 ||
    invariantsFailed > 0 ||
    sectionResults.some(s => s.status === 'WARN')
  ) {
    overallStatus = 'WARN';
  }

  // Generate checksums
  const attestationData = {
    profile: profileId,
    timestamp,
    sections: sectionResults,
    invariantResults,
  };

  const attestationChecksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(attestationData))
    .digest('hex');

  return {
    profile: profileId,
    profileName: profile.name,
    timestamp,
    environment: evidence.system?.environment || 'unknown',
    overallStatus,
    sections: sectionResults,
    invariantResults,
    summary: {
      sectionsTotal: sectionResults.length,
      sectionsPassed,
      sectionsFailed,
      sectionsUnavailable,
      invariantsPassed,
      invariantsFailed,
      criticalFailures,
    },
    evidenceChecksum: evidence.metadata?.checksum || 'unavailable',
    attestationChecksum,
    disclaimer: `This attestation was generated from live system state at ${timestamp}. All data points are derived from production evidence. No claims are manually authored.`,
  };
}

// ============================================
// Attestation with Redactions
// ============================================

export function generateRedactedAttestation(
  evidence: EvidencePayload,
  profileId: AttestationProfile
): {
  attestation: AttestationResult;
  redactedEvidence: EvidencePayload;
  redactionCount: number;
} {
  const profile = getProfile(profileId);

  // Apply redactions to evidence
  const redactedEvidence = applyRedactions(evidence, profile.redactionTargets);
  const redactionCount = countRedactions(evidence, redactedEvidence);

  // Generate attestation from original evidence (for accuracy)
  const attestation = generateAttestation(evidence, profileId);

  return {
    attestation,
    redactedEvidence,
    redactionCount,
  };
}
