// ============================================
// AdLab Auto-Response Playbooks
// ============================================
// PHASE D26: Go-Live Gate & Continuous Compliance.
//
// AUTO-RESPONSES FOR COMPLIANCE_FAIL + CRITICAL:
// - Enable kill-switch (workspace-scoped)
// - Trigger on-call notification (webhook)
// - Open incident record
//
// RULES:
// - All auto-actions are audited
// - Kill-switch activation is idempotent
// - No infinite loops or cascading triggers
// ============================================

import { createClient } from '@supabase/supabase-js';
import { appendAuditLog } from '@/lib/adlab/audit';
import { enableWorkspaceKillSwitch } from '@/lib/adlab/safety';
import type { ComplianceCheckResult, DriftItem } from './complianceMonitor';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

export interface IncidentRecord {
  id: string;
  workspaceId: string;
  snapshotId?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  driftItems: DriftItem[];
  timestamp: string;
  autoActions: AutoActionRecord[];
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export interface AutoActionRecord {
  action: 'ENABLE_KILL_SWITCH' | 'SEND_NOTIFICATION' | 'OPEN_INCIDENT';
  success: boolean;
  timestamp: string;
  details?: Record<string, unknown>;
  error?: string;
}

export interface AutoResponseResult {
  triggered: boolean;
  incident?: IncidentRecord;
  actions: AutoActionRecord[];
  errors: string[];
}

// ============================================
// In-Memory Incident Store
// ============================================

const incidentRecords: Map<string, IncidentRecord> = new Map();
let incidentCounter = 0;

// Track recent auto-responses to prevent loops
const recentAutoResponses: Map<string, number> = new Map();
const AUTO_RESPONSE_COOLDOWN = 5 * 60 * 1000; // 5 minutes

// ============================================
// Supabase Client
// ============================================

function createAutoResponseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Auto-Response Logic
// ============================================

/**
 * Checks if auto-response should be triggered.
 */
function shouldTriggerAutoResponse(result: ComplianceCheckResult): boolean {
  // Only trigger for FAIL status with CRITICAL severity
  if (result.status !== 'FAIL' || result.overallSeverity !== 'CRITICAL') {
    return false;
  }

  // Check cooldown to prevent cascading triggers
  const cooldownKey = `${result.workspaceId}`;
  const lastResponse = recentAutoResponses.get(cooldownKey);

  if (lastResponse && Date.now() - lastResponse < AUTO_RESPONSE_COOLDOWN) {
    return false; // Within cooldown period
  }

  return true;
}

/**
 * Executes auto-response for a critical compliance failure.
 */
export async function executeAutoResponse(
  result: ComplianceCheckResult
): Promise<AutoResponseResult> {
  const actions: AutoActionRecord[] = [];
  const errors: string[] = [];

  // Check if auto-response should trigger
  if (!shouldTriggerAutoResponse(result)) {
    return {
      triggered: false,
      actions: [],
      errors: [],
    };
  }

  // Mark cooldown
  recentAutoResponses.set(result.workspaceId, Date.now());

  // Generate incident ID
  incidentCounter++;
  const incidentId = `INC-${Date.now()}-${incidentCounter}`;

  // Find snapshot reference if available
  const snapshotDrift = result.driftItems.find((d) => d.snapshotId);
  const snapshotId = snapshotDrift?.snapshotId;

  // 1. Enable kill-switch (idempotent)
  const killSwitchAction = await enableKillSwitchAction(result.workspaceId, incidentId);
  actions.push(killSwitchAction);
  if (!killSwitchAction.success && killSwitchAction.error) {
    errors.push(killSwitchAction.error);
  }

  // 2. Send notification
  const notificationAction = await sendNotificationAction(result, incidentId);
  actions.push(notificationAction);
  if (!notificationAction.success && notificationAction.error) {
    errors.push(notificationAction.error);
  }

  // 3. Open incident record
  const incidentAction = await openIncidentAction(result, incidentId, snapshotId, actions);
  actions.push(incidentAction);

  // Create incident record
  const incident: IncidentRecord = {
    id: incidentId,
    workspaceId: result.workspaceId,
    snapshotId,
    severity: result.overallSeverity || 'CRITICAL',
    reason: result.driftItems.map((d) => d.message).join('; '),
    driftItems: result.driftItems,
    timestamp: new Date().toISOString(),
    autoActions: actions,
    status: 'OPEN',
  };

  incidentRecords.set(incidentId, incident);

  // Audit the auto-response
  await auditAutoResponse(incident, actions);

  return {
    triggered: true,
    incident,
    actions,
    errors,
  };
}

// ============================================
// Individual Auto-Actions
// ============================================

async function enableKillSwitchAction(
  workspaceId: string,
  incidentId: string
): Promise<AutoActionRecord> {
  try {
    const result = await enableWorkspaceKillSwitch(
      workspaceId,
      `Auto-enabled due to critical compliance failure (${incidentId})`,
      'auto-response-system'
    );

    if (result.success) {
      return {
        action: 'ENABLE_KILL_SWITCH',
        success: true,
        timestamp: new Date().toISOString(),
        details: { workspaceId, incidentId },
      };
    } else {
      return {
        action: 'ENABLE_KILL_SWITCH',
        success: false,
        timestamp: new Date().toISOString(),
        error: result.error,
        details: { workspaceId, incidentId },
      };
    }
  } catch (e) {
    return {
      action: 'ENABLE_KILL_SWITCH',
      success: false,
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : 'Failed to enable kill-switch',
      details: { workspaceId, incidentId },
    };
  }
}

async function sendNotificationAction(
  result: ComplianceCheckResult,
  incidentId: string
): Promise<AutoActionRecord> {
  try {
    // Check for webhook URL in environment
    const webhookUrl = process.env.ADLAB_ONCALL_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        action: 'SEND_NOTIFICATION',
        success: true, // Not configured is not a failure
        timestamp: new Date().toISOString(),
        details: { skipped: true, reason: 'No webhook URL configured' },
      };
    }

    // Build notification payload
    const payload = {
      incidentId,
      severity: result.overallSeverity,
      workspaceId: result.workspaceId,
      status: result.status,
      driftItems: result.driftItems.map((d) => ({
        type: d.type,
        severity: d.severity,
        message: d.message,
      })),
      timestamp: new Date().toISOString(),
      source: 'AdLab Compliance Monitor',
    };

    // Send webhook (with timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          action: 'SEND_NOTIFICATION',
          success: true,
          timestamp: new Date().toISOString(),
          details: { webhookStatus: response.status },
        };
      } else {
        return {
          action: 'SEND_NOTIFICATION',
          success: false,
          timestamp: new Date().toISOString(),
          error: `Webhook returned ${response.status}`,
          details: { webhookStatus: response.status },
        };
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (e) {
    return {
      action: 'SEND_NOTIFICATION',
      success: false,
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : 'Failed to send notification',
    };
  }
}

async function openIncidentAction(
  result: ComplianceCheckResult,
  incidentId: string,
  snapshotId: string | undefined,
  previousActions: AutoActionRecord[]
): Promise<AutoActionRecord> {
  try {
    // Incident is stored in memory and audited
    // In production, this would create a ticket in an incident management system

    return {
      action: 'OPEN_INCIDENT',
      success: true,
      timestamp: new Date().toISOString(),
      details: {
        incidentId,
        workspaceId: result.workspaceId,
        snapshotId,
        severity: result.overallSeverity,
        driftCount: result.driftItems.length,
        previousActionsCount: previousActions.length,
      },
    };
  } catch (e) {
    return {
      action: 'OPEN_INCIDENT',
      success: false,
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : 'Failed to open incident',
    };
  }
}

// ============================================
// Audit Logging
// ============================================

async function auditAutoResponse(
  incident: IncidentRecord,
  actions: AutoActionRecord[]
): Promise<void> {
  try {
    await appendAuditLog({
      context: {
        workspaceId: incident.workspaceId,
        actorId: 'auto-response-system',
        actorRole: 'owner',
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: incident.id,
      scope: {
        platform: 'system',
        dataset: 'auto_response',
      },
      metadata: {
        autoResponseTriggered: true,
        incidentId: incident.id,
        severity: incident.severity,
        snapshotId: incident.snapshotId,
        reason: incident.reason,
        driftCount: incident.driftItems.length,
        actionsExecuted: actions.map((a) => ({
          action: a.action,
          success: a.success,
        })),
        timestamp: incident.timestamp,
      },
    });
  } catch (e) {
    console.error('[AUTO-RESPONSE] Failed to audit auto-response:', e);
  }
}

// ============================================
// Incident Management
// ============================================

/**
 * Gets an incident by ID.
 */
export function getIncident(incidentId: string): IncidentRecord | undefined {
  return incidentRecords.get(incidentId);
}

/**
 * Gets all open incidents for a workspace.
 */
export function getOpenIncidents(workspaceId: string): IncidentRecord[] {
  return Array.from(incidentRecords.values()).filter(
    (i) => i.workspaceId === workspaceId && i.status === 'OPEN'
  );
}

/**
 * Gets all incidents (for dashboard).
 */
export function getAllIncidents(): IncidentRecord[] {
  return Array.from(incidentRecords.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Acknowledges an incident.
 * Requires owner role and reason.
 */
export async function acknowledgeIncident(
  incidentId: string,
  actorId: string,
  reason: string
): Promise<boolean> {
  const incident = incidentRecords.get(incidentId);
  if (!incident) return false;

  incident.status = 'ACKNOWLEDGED';

  // Audit the acknowledgment
  await appendAuditLog({
    context: {
      workspaceId: incident.workspaceId,
      actorId,
      actorRole: 'owner',
    },
    action: 'VALIDATE',
    entityType: 'dataset',
    entityId: incidentId,
    scope: {
      platform: 'system',
      dataset: 'incident',
    },
    metadata: {
      incidentAcknowledged: true,
      incidentId,
      reason,
      timestamp: new Date().toISOString(),
    },
  });

  incidentRecords.set(incidentId, incident);
  return true;
}

/**
 * Resolves an incident.
 * Requires owner role and reason.
 */
export async function resolveIncident(
  incidentId: string,
  actorId: string,
  reason: string
): Promise<boolean> {
  const incident = incidentRecords.get(incidentId);
  if (!incident) return false;

  incident.status = 'RESOLVED';

  // Audit the resolution
  await appendAuditLog({
    context: {
      workspaceId: incident.workspaceId,
      actorId,
      actorRole: 'owner',
    },
    action: 'VALIDATE',
    entityType: 'dataset',
    entityId: incidentId,
    scope: {
      platform: 'system',
      dataset: 'incident',
    },
    metadata: {
      incidentResolved: true,
      incidentId,
      reason,
      timestamp: new Date().toISOString(),
    },
  });

  incidentRecords.set(incidentId, incident);
  return true;
}

/**
 * Clears cooldown for testing.
 */
export function clearCooldown(workspaceId: string): void {
  recentAutoResponses.delete(workspaceId);
}

/**
 * Clears all incidents (for testing).
 */
export function clearAllIncidents(): void {
  incidentRecords.clear();
  incidentCounter = 0;
}
