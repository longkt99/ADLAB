// ============================================
// AdLab Drift SLA & Escalation Rules
// ============================================
// PHASE D27: Release Hardening & External Integration.
//
// SLA DEFINITIONS:
// - WARN: Escalate after X minutes
// - FAIL: Auto-page after Y minutes + incident update
//
// ESCALATION TRIGGERS:
// - DRIFT_ESCALATION_TRIGGERED (audit)
// - Automatic page on-call
// - Incident status update
//
// INVARIANTS:
// - All escalations audited
// - Time-based thresholds configurable
// - Idempotent escalation (no duplicates)
// ============================================

import { appendAuditLog } from '@/lib/adlab/audit';
import { sendAlert } from './alertIntegrations';
import type { ComplianceStatus, DriftItem, DriftSeverity } from './complianceMonitor';

// ============================================
// Types
// ============================================

export interface EscalationSLA {
  warnThresholdMinutes: number;
  failThresholdMinutes: number;
  criticalThresholdMinutes: number;
}

export interface DriftRecord {
  id: string;
  workspaceId: string;
  status: ComplianceStatus;
  severity: DriftSeverity | null;
  driftItems: DriftItem[];
  detectedAt: string;
  lastCheckedAt: string;
  escalationLevel: EscalationLevel;
  escalatedAt?: string;
  incidentId?: string;
}

export type EscalationLevel = 'NONE' | 'NOTIFIED' | 'PAGED' | 'CRITICAL';

export interface EscalationResult {
  driftId: string;
  workspaceId: string;
  previousLevel: EscalationLevel;
  newLevel: EscalationLevel;
  escalated: boolean;
  reason?: string;
  alertSent?: boolean;
}

export interface EscalationConfig {
  sla: EscalationSLA;
  enabled: boolean;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_SLA: EscalationSLA = {
  warnThresholdMinutes: parseInt(process.env.ADLAB_WARN_ESCALATION_MINUTES || '30', 10),
  failThresholdMinutes: parseInt(process.env.ADLAB_FAIL_ESCALATION_MINUTES || '10', 10),
  criticalThresholdMinutes: parseInt(process.env.ADLAB_CRITICAL_ESCALATION_MINUTES || '5', 10),
};

let escalationConfig: EscalationConfig = {
  sla: DEFAULT_SLA,
  enabled: process.env.ADLAB_ESCALATION_ENABLED !== 'false',
};

// ============================================
// Drift Tracking
// ============================================

const activeDrifts: Map<string, DriftRecord> = new Map();
let driftCounter = 0;

/**
 * Generates a unique drift ID.
 */
function generateDriftId(): string {
  driftCounter++;
  return `DRIFT-${Date.now()}-${driftCounter}`;
}

/**
 * Gets the drift key for deduplication.
 */
function getDriftKey(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

/**
 * Records a new drift or updates an existing one.
 */
export function recordDrift(
  workspaceId: string,
  status: ComplianceStatus,
  severity: DriftSeverity | null,
  driftItems: DriftItem[]
): DriftRecord {
  const key = getDriftKey(workspaceId);
  const now = new Date().toISOString();

  const existing = activeDrifts.get(key);

  if (existing) {
    // Update existing drift
    existing.status = status;
    existing.severity = severity;
    existing.driftItems = driftItems;
    existing.lastCheckedAt = now;
    return existing;
  }

  // Create new drift record
  const record: DriftRecord = {
    id: generateDriftId(),
    workspaceId,
    status,
    severity,
    driftItems,
    detectedAt: now,
    lastCheckedAt: now,
    escalationLevel: 'NONE',
  };

  activeDrifts.set(key, record);
  return record;
}

/**
 * Resolves a drift (removes from tracking).
 */
export function resolveDrift(workspaceId: string): boolean {
  const key = getDriftKey(workspaceId);
  return activeDrifts.delete(key);
}

/**
 * Gets the current drift for a workspace.
 */
export function getDrift(workspaceId: string): DriftRecord | undefined {
  return activeDrifts.get(getDriftKey(workspaceId));
}

/**
 * Gets all active drifts.
 */
export function getAllActiveDrifts(): DriftRecord[] {
  return Array.from(activeDrifts.values());
}

// ============================================
// Escalation Logic
// ============================================

/**
 * Calculates the age of a drift in minutes.
 */
function getDriftAgeMinutes(drift: DriftRecord): number {
  const detectedAt = new Date(drift.detectedAt).getTime();
  const now = Date.now();
  return (now - detectedAt) / (1000 * 60);
}

/**
 * Determines the required escalation level based on SLA.
 */
function calculateRequiredLevel(
  drift: DriftRecord,
  sla: EscalationSLA
): EscalationLevel {
  const ageMinutes = getDriftAgeMinutes(drift);

  // FAIL status
  if (drift.status === 'FAIL') {
    if (drift.severity === 'CRITICAL' && ageMinutes >= sla.criticalThresholdMinutes) {
      return 'CRITICAL';
    }
    if (ageMinutes >= sla.failThresholdMinutes) {
      return 'PAGED';
    }
    return 'NOTIFIED';
  }

  // WARN status
  if (drift.status === 'WARN') {
    if (ageMinutes >= sla.warnThresholdMinutes) {
      return 'NOTIFIED';
    }
    return 'NONE';
  }

  return 'NONE';
}

/**
 * Compares escalation levels.
 */
function isHigherLevel(newLevel: EscalationLevel, currentLevel: EscalationLevel): boolean {
  const levelOrder: EscalationLevel[] = ['NONE', 'NOTIFIED', 'PAGED', 'CRITICAL'];
  return levelOrder.indexOf(newLevel) > levelOrder.indexOf(currentLevel);
}

/**
 * Checks and escalates a single drift if needed.
 */
export async function checkAndEscalate(drift: DriftRecord): Promise<EscalationResult> {
  if (!escalationConfig.enabled) {
    return {
      driftId: drift.id,
      workspaceId: drift.workspaceId,
      previousLevel: drift.escalationLevel,
      newLevel: drift.escalationLevel,
      escalated: false,
      reason: 'Escalation disabled',
    };
  }

  const requiredLevel = calculateRequiredLevel(drift, escalationConfig.sla);
  const previousLevel = drift.escalationLevel;

  if (!isHigherLevel(requiredLevel, previousLevel)) {
    return {
      driftId: drift.id,
      workspaceId: drift.workspaceId,
      previousLevel,
      newLevel: previousLevel,
      escalated: false,
    };
  }

  // Escalate
  drift.escalationLevel = requiredLevel;
  drift.escalatedAt = new Date().toISOString();

  // Send alert based on new level
  let alertSent = false;
  if (requiredLevel === 'PAGED' || requiredLevel === 'CRITICAL') {
    try {
      await sendAlert({
        id: `ESC-${drift.id}`,
        severity: requiredLevel === 'CRITICAL' ? 'CRITICAL' : 'WARN',
        title: `ESCALATION: Drift SLA Breached (${requiredLevel})`,
        message: `Drift has been unresolved for ${Math.round(getDriftAgeMinutes(drift))} minutes. Level: ${requiredLevel}`,
        source: 'AdLab Drift Escalation',
        timestamp: new Date().toISOString(),
        workspaceId: drift.workspaceId,
        incidentId: drift.incidentId,
        driftItems: drift.driftItems,
      });
      alertSent = true;
    } catch (e) {
      console.error('[DRIFT ESCALATION] Failed to send alert:', e);
    }
  }

  // Audit the escalation
  await auditEscalation(drift, previousLevel, requiredLevel);

  return {
    driftId: drift.id,
    workspaceId: drift.workspaceId,
    previousLevel,
    newLevel: requiredLevel,
    escalated: true,
    reason: `SLA breach: ${Math.round(getDriftAgeMinutes(drift))} minutes`,
    alertSent,
  };
}

/**
 * Checks all active drifts for escalation.
 */
export async function checkAllEscalations(): Promise<EscalationResult[]> {
  const results: EscalationResult[] = [];

  for (const drift of activeDrifts.values()) {
    const result = await checkAndEscalate(drift);
    if (result.escalated) {
      results.push(result);
    }
  }

  return results;
}

// ============================================
// Audit Logging
// ============================================

async function auditEscalation(
  drift: DriftRecord,
  previousLevel: EscalationLevel,
  newLevel: EscalationLevel
): Promise<void> {
  try {
    await appendAuditLog({
      context: {
        workspaceId: drift.workspaceId,
        actorId: 'drift-escalation',
        actorRole: 'owner',
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: drift.id,
      scope: {
        platform: 'system',
        dataset: 'drift_escalation',
      },
      metadata: {
        escalationTriggered: true,
        driftId: drift.id,
        previousLevel,
        newLevel,
        driftAgeMinutes: Math.round(getDriftAgeMinutes(drift)),
        status: drift.status,
        severity: drift.severity,
        driftCount: drift.driftItems.length,
        incidentId: drift.incidentId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[DRIFT ESCALATION] Failed to audit escalation:', e);
  }
}

// ============================================
// Configuration
// ============================================

/**
 * Updates the escalation configuration.
 */
export function setEscalationConfig(config: Partial<EscalationConfig>): void {
  escalationConfig = {
    ...escalationConfig,
    ...config,
    sla: config.sla ? { ...escalationConfig.sla, ...config.sla } : escalationConfig.sla,
  };
}

/**
 * Gets the current escalation configuration.
 */
export function getEscalationConfig(): EscalationConfig {
  return { ...escalationConfig };
}

/**
 * Resets configuration to defaults.
 */
export function resetEscalationConfig(): void {
  escalationConfig = {
    sla: DEFAULT_SLA,
    enabled: true,
  };
}

// ============================================
// Testing Helpers
// ============================================

/**
 * Clears all active drifts (for testing).
 */
export function clearAllDrifts(): void {
  activeDrifts.clear();
  driftCounter = 0;
}

/**
 * Gets drift statistics.
 */
export function getDriftStats(): {
  total: number;
  byLevel: Record<EscalationLevel, number>;
  byStatus: Record<ComplianceStatus, number>;
} {
  const drifts = Array.from(activeDrifts.values());

  const byLevel: Record<EscalationLevel, number> = {
    NONE: 0,
    NOTIFIED: 0,
    PAGED: 0,
    CRITICAL: 0,
  };

  const byStatus: Record<ComplianceStatus, number> = {
    PASS: 0,
    WARN: 0,
    FAIL: 0,
  };

  for (const drift of drifts) {
    byLevel[drift.escalationLevel]++;
    byStatus[drift.status]++;
  }

  return {
    total: drifts.length,
    byLevel,
    byStatus,
  };
}

/**
 * Links a drift to an incident.
 */
export function linkDriftToIncident(workspaceId: string, incidentId: string): boolean {
  const drift = getDrift(workspaceId);
  if (!drift) return false;

  drift.incidentId = incidentId;
  return true;
}
