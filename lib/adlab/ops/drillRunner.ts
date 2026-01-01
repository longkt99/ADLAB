// ============================================
// AdLab Drill Execution Engine
// ============================================
// PHASE D25: Production Drill & Operator Certification.
//
// CORE PRINCIPLE:
// Drills run in DRY-RUN mode ONLY.
// Never mutate production data.
// Simulate all effects safely.
//
// CAPABILITIES:
// - Activate failure injection (simulated)
// - Toggle kill-switch (simulated)
// - Freeze snapshots (simulated)
// - Emit synthetic audit events
// ============================================

import { createClient } from '@supabase/supabase-js';
import { appendAuditLog } from '@/lib/adlab/audit';
import type { Actor } from '@/lib/adlab/auth/roles';
import {
  type DrillDefinition,
  type DrillInstance,
  type DrillStatus,
  type DrillAction,
  type DrillActionRecord,
  getDrillById,
  canParticipate,
} from './drills';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

/** Drill execution mode */
export type DrillMode = 'DRY_RUN' | 'SIMULATION';

/** Drill start result */
export interface DrillStartResult {
  success: boolean;
  instance?: DrillInstance;
  error?: string;
}

/** Drill action result */
export interface DrillActionResult {
  success: boolean;
  instance?: DrillInstance;
  feedback?: string;
  error?: string;
}

/** Simulated effect tracking */
export interface SimulatedEffects {
  killSwitchToggled: boolean;
  killSwitchEnabled: boolean;
  snapshotFrozen: boolean;
  snapshotRolledBack: boolean;
  failureInjected: boolean;
  auditEventsEmitted: number;
}

// ============================================
// In-Memory Drill State
// ============================================

// Active drill instances (in-memory for DRY_RUN mode)
const activeDrills: Map<string, DrillInstance> = new Map();
const drillEffects: Map<string, SimulatedEffects> = new Map();

// ============================================
// Supabase Client
// ============================================

function createDrillClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Drill Instance Management
// ============================================

/**
 * Generates a unique drill instance ID.
 */
function generateDrillInstanceId(): string {
  return `drill-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates a new drill instance.
 */
function createDrillInstance(
  drill: DrillDefinition,
  actor: Actor
): DrillInstance {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + drill.totalTimeLimit * 1000);

  return {
    id: generateDrillInstanceId(),
    drillId: drill.id,
    workspaceId: actor.workspaceId,
    operatorId: actor.id,
    operatorRole: actor.role,
    status: 'PENDING',
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    currentStep: 0,
    actionsTaken: [],
  };
}

/**
 * Initializes simulated effects for a drill.
 */
function initializeEffects(): SimulatedEffects {
  return {
    killSwitchToggled: false,
    killSwitchEnabled: false,
    snapshotFrozen: false,
    snapshotRolledBack: false,
    failureInjected: false,
    auditEventsEmitted: 0,
  };
}

// ============================================
// Drill Execution
// ============================================

/**
 * Starts a drill for an operator.
 *
 * DRY-RUN mode: No production effects.
 */
export async function startDrill(
  drillId: string,
  actor: Actor,
  mode: DrillMode = 'DRY_RUN'
): Promise<DrillStartResult> {
  // Get drill definition
  const drill = getDrillById(drillId);
  if (!drill) {
    return { success: false, error: `Drill not found: ${drillId}` };
  }

  // Check if operator can participate
  if (!canParticipate(actor.role, drill)) {
    return {
      success: false,
      error: `Role "${actor.role}" cannot participate in this drill`,
    };
  }

  // Check for existing active drill
  const existingDrill = Array.from(activeDrills.values()).find(
    (d) => d.operatorId === actor.id && d.status === 'ACTIVE'
  );
  if (existingDrill) {
    return {
      success: false,
      error: 'Operator already has an active drill',
    };
  }

  // Create drill instance
  const instance = createDrillInstance(drill, actor);
  instance.status = 'ACTIVE';
  instance.currentStep = 1;

  // Store in memory
  activeDrills.set(instance.id, instance);
  drillEffects.set(instance.id, initializeEffects());

  // Emit DRILL_STARTED audit event
  await emitDrillAuditEvent(instance, 'DRILL_STARTED', {
    drillId: drill.id,
    drillName: drill.name,
    incidentType: drill.incidentType,
    severity: drill.severity,
    mode,
  });

  return { success: true, instance };
}

/**
 * Gets an active drill instance.
 */
export function getActiveDrill(instanceId: string): DrillInstance | undefined {
  return activeDrills.get(instanceId);
}

/**
 * Gets active drill for an operator.
 */
export function getOperatorActiveDrill(operatorId: string): DrillInstance | undefined {
  return Array.from(activeDrills.values()).find(
    (d) => d.operatorId === operatorId && (d.status === 'ACTIVE' || d.status === 'AWAITING_ACTION')
  );
}

/**
 * Records an action in the drill.
 */
export async function recordDrillAction(
  instanceId: string,
  action: DrillAction,
  reason: string
): Promise<DrillActionResult> {
  const instance = activeDrills.get(instanceId);
  if (!instance) {
    return { success: false, error: 'Drill instance not found' };
  }

  // Check drill status
  if (instance.status !== 'ACTIVE' && instance.status !== 'AWAITING_ACTION') {
    return { success: false, error: `Cannot take action on drill with status: ${instance.status}` };
  }

  // Check if expired
  if (new Date() > new Date(instance.expiresAt)) {
    instance.status = 'EXPIRED';
    await emitDrillAuditEvent(instance, 'DRILL_FAILED', {
      reason: 'Time limit exceeded',
    });
    return { success: false, error: 'Drill time limit exceeded' };
  }

  // Get drill definition
  const drill = getDrillById(instance.drillId);
  if (!drill) {
    return { success: false, error: 'Drill definition not found' };
  }

  // Get current required action
  const currentStep = instance.currentStep;
  const requiredAction = drill.requiredActions[currentStep - 1];

  if (!requiredAction) {
    return { success: false, error: 'No more actions required' };
  }

  // Check if action is correct
  const isCorrect = requiredAction.correctChoices.includes(action);

  // Record action
  const actionRecord: DrillActionRecord = {
    action,
    timestamp: new Date().toISOString(),
    reason,
    stepNumber: currentStep,
    correct: isCorrect,
  };
  instance.actionsTaken.push(actionRecord);

  // Simulate effects
  await simulateActionEffects(instanceId, action);

  // Emit audit event
  await emitDrillAuditEvent(instance, 'DRILL_ACTION_TAKEN', {
    action,
    stepNumber: currentStep,
    correct: isCorrect,
    reason,
  });

  // Update step
  if (isCorrect) {
    instance.currentStep++;
    instance.status = 'AWAITING_ACTION';

    // Check if drill is complete
    if (instance.currentStep > drill.requiredActions.length) {
      instance.status = 'EVALUATING';
    }
  }

  // Generate feedback
  const feedback = isCorrect
    ? `Correct! ${requiredAction.description} completed.`
    : `Incorrect. ${requiredAction.failureMessage}`;

  activeDrills.set(instanceId, instance);

  return { success: true, instance, feedback };
}

/**
 * Simulates the effects of an action (DRY-RUN mode).
 */
async function simulateActionEffects(
  instanceId: string,
  action: DrillAction
): Promise<void> {
  const effects = drillEffects.get(instanceId);
  if (!effects) return;

  switch (action) {
    case 'ENABLE_KILL_SWITCH':
      effects.killSwitchToggled = true;
      effects.killSwitchEnabled = true;
      break;

    case 'DISABLE_KILL_SWITCH':
      effects.killSwitchToggled = true;
      effects.killSwitchEnabled = false;
      break;

    case 'ROLLBACK':
      effects.snapshotRolledBack = true;
      break;

    case 'FREEZE_SNAPSHOT':
      effects.snapshotFrozen = true;
      break;
  }

  effects.auditEventsEmitted++;
  drillEffects.set(instanceId, effects);
}

/**
 * Gets simulated effects for a drill.
 */
export function getDrillEffects(instanceId: string): SimulatedEffects | undefined {
  return drillEffects.get(instanceId);
}

/**
 * Cancels an active drill.
 */
export async function cancelDrill(instanceId: string): Promise<boolean> {
  const instance = activeDrills.get(instanceId);
  if (!instance) return false;

  if (instance.status === 'PASSED' || instance.status === 'FAILED') {
    return false; // Cannot cancel completed drills
  }

  instance.status = 'FAILED';

  await emitDrillAuditEvent(instance, 'DRILL_FAILED', {
    reason: 'Drill cancelled by operator',
  });

  activeDrills.delete(instanceId);
  drillEffects.delete(instanceId);

  return true;
}

/**
 * Checks for expired drills and marks them.
 */
export function checkExpiredDrills(): void {
  const now = new Date();

  for (const [id, instance] of activeDrills.entries()) {
    if (
      (instance.status === 'ACTIVE' || instance.status === 'AWAITING_ACTION') &&
      new Date(instance.expiresAt) < now
    ) {
      instance.status = 'EXPIRED';
      activeDrills.set(id, instance);
    }
  }
}

/**
 * Gets all drills for a workspace.
 */
export function getWorkspaceDrills(workspaceId: string): DrillInstance[] {
  return Array.from(activeDrills.values()).filter(
    (d) => d.workspaceId === workspaceId
  );
}

// ============================================
// Audit Event Emission
// ============================================

/**
 * Emits a drill-related audit event.
 */
async function emitDrillAuditEvent(
  instance: DrillInstance,
  eventType: 'DRILL_STARTED' | 'DRILL_ACTION_TAKEN' | 'DRILL_PASSED' | 'DRILL_FAILED',
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await appendAuditLog({
      context: {
        workspaceId: instance.workspaceId,
        actorId: instance.operatorId,
        actorRole: instance.operatorRole,
      },
      action: 'VALIDATE', // Using VALIDATE as base action type
      entityType: 'dataset',
      entityId: instance.id,
      scope: {
        platform: 'system',
        dataset: 'drill',
      },
      metadata: {
        drillEvent: eventType,
        drillInstanceId: instance.id,
        drillId: instance.drillId,
        ...metadata,
      },
    });
  } catch (e) {
    console.error('[DRILL RUNNER] Failed to emit audit event:', e);
  }
}

/**
 * Marks a drill as passed and emits certification event.
 */
export async function markDrillPassed(
  instanceId: string,
  evaluationResult: DrillInstance['evaluationResult']
): Promise<void> {
  const instance = activeDrills.get(instanceId);
  if (!instance) return;

  instance.status = 'PASSED';
  instance.evaluationResult = evaluationResult;

  await emitDrillAuditEvent(instance, 'DRILL_PASSED', {
    score: evaluationResult?.score,
    withinSLA: evaluationResult?.withinSLA,
    certificationGranted: evaluationResult?.certificationGranted,
  });

  activeDrills.set(instanceId, instance);
}

/**
 * Marks a drill as failed and emits event.
 */
export async function markDrillFailed(
  instanceId: string,
  evaluationResult: DrillInstance['evaluationResult']
): Promise<void> {
  const instance = activeDrills.get(instanceId);
  if (!instance) return;

  instance.status = 'FAILED';
  instance.evaluationResult = evaluationResult;

  await emitDrillAuditEvent(instance, 'DRILL_FAILED', {
    score: evaluationResult?.score,
    feedback: evaluationResult?.feedback,
  });

  activeDrills.set(instanceId, instance);
}

// ============================================
// Cleanup
// ============================================

/**
 * Cleans up old drill instances.
 */
export function cleanupOldDrills(maxAge: number = 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAge;

  for (const [id, instance] of activeDrills.entries()) {
    if (new Date(instance.startedAt).getTime() < cutoff) {
      activeDrills.delete(id);
      drillEffects.delete(id);
    }
  }
}
