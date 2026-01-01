// ============================================
// AdLab Drill Evaluator
// ============================================
// PHASE D25: Production Drill & Operator Certification.
//
// CORE PRINCIPLE:
// Evaluation is deterministic and auditable.
// No subjective scoring.
// Clear pass/fail criteria.
//
// EVALUATES:
// - Correctness of actions
// - Order of actions
// - Time to respond
// - Guards triggered vs expected
// ============================================

import type { AdLabRole } from '@/lib/adlab/auth';
import {
  type DrillDefinition,
  type DrillInstance,
  type DrillEvaluationResult,
  type DrillActionRecord,
  getDrillById,
} from './drills';
import {
  markDrillPassed,
  markDrillFailed,
  getActiveDrill,
} from './drillRunner';

// ============================================
// Types
// ============================================

/** Certification record */
export interface CertificationRecord {
  operatorId: string;
  operatorRole: AdLabRole;
  workspaceId: string;
  drillId: string;
  drillName: string;
  incidentType: string;
  passed: boolean;
  score: number;
  completedAt: string;
  expiresAt: string; // Certifications expire
}

/** Operator certification status */
export interface OperatorCertificationStatus {
  operatorId: string;
  role: AdLabRole;
  certifications: CertificationRecord[];
  requiredDrillsPassed: number;
  requiredDrillsTotal: number;
  fullyOperational: boolean;
  nextRequiredDrill?: string;
}

// ============================================
// In-Memory Certification Store
// ============================================

// Certification records (in-memory for now)
const certifications: Map<string, CertificationRecord[]> = new Map();

// ============================================
// Evaluation Functions
// ============================================

/**
 * Evaluates a completed drill instance.
 */
export async function evaluateDrill(instanceId: string): Promise<DrillEvaluationResult> {
  const instance = getActiveDrill(instanceId);
  if (!instance) {
    return createFailedResult('Drill instance not found', []);
  }

  const drill = getDrillById(instance.drillId);
  if (!drill) {
    return createFailedResult('Drill definition not found', []);
  }

  // Calculate time elapsed
  const startTime = new Date(instance.startedAt).getTime();
  const endTime = Date.now();
  const timeElapsed = Math.floor((endTime - startTime) / 1000);

  // Check time limit
  const withinTimeLimit = timeElapsed <= drill.totalTimeLimit;
  const withinSLA = timeElapsed <= drill.slaTarget;

  // Evaluate actions
  const actionEvaluation = evaluateActions(instance.actionsTaken, drill);

  // Calculate score
  const score = calculateScore({
    withinTimeLimit,
    withinSLA,
    actionsCorrect: actionEvaluation.correctCount,
    actionsTotal: drill.requiredActions.length,
    orderCorrect: actionEvaluation.orderCorrect,
    allCompleted: actionEvaluation.allCompleted,
  });

  // Determine pass/fail
  const passed = evaluatePassFail(drill, {
    withinTimeLimit,
    actionsCorrect: actionEvaluation.correctCount === drill.requiredActions.length,
    orderCorrect: actionEvaluation.orderCorrect,
    allCompleted: actionEvaluation.allCompleted,
    reasonsProvided: instance.actionsTaken.every((a) => a.reason.length > 0),
  });

  // Generate feedback
  const feedback = generateFeedback({
    passed,
    withinTimeLimit,
    withinSLA,
    timeElapsed,
    drill,
    actionEvaluation,
  });

  // Determine if certification is granted
  const certificationGranted = passed && drill.certificationLevel === 'REQUIRED';

  const result: DrillEvaluationResult = {
    passed,
    score,
    timeElapsed,
    withinSLA,
    actionsCorrect: actionEvaluation.correctCount,
    actionsTotal: drill.requiredActions.length,
    orderCorrect: actionEvaluation.orderCorrect,
    feedback,
    certificationGranted,
  };

  // Update drill instance
  if (passed) {
    await markDrillPassed(instanceId, result);

    // Record certification if granted
    if (certificationGranted) {
      await recordCertification(instance, drill, result);
    }
  } else {
    await markDrillFailed(instanceId, result);
  }

  return result;
}

/**
 * Evaluates the actions taken in a drill.
 */
function evaluateActions(
  actions: DrillActionRecord[],
  drill: DrillDefinition
): {
  correctCount: number;
  incorrectCount: number;
  orderCorrect: boolean;
  allCompleted: boolean;
  details: { step: number; expected: string[]; actual: string; correct: boolean }[];
} {
  const details: { step: number; expected: string[]; actual: string; correct: boolean }[] = [];
  let correctCount = 0;
  let orderCorrect = true;
  let lastCorrectStep = 0;

  for (let i = 0; i < drill.requiredActions.length; i++) {
    const required = drill.requiredActions[i];
    const action = actions.find((a) => a.stepNumber === i + 1);

    if (action) {
      const isCorrect = required.correctChoices.includes(action.action);
      details.push({
        step: i + 1,
        expected: required.correctChoices,
        actual: action.action,
        correct: isCorrect,
      });

      if (isCorrect) {
        correctCount++;
        // Check order
        if (action.stepNumber !== lastCorrectStep + 1) {
          orderCorrect = false;
        }
        lastCorrectStep = action.stepNumber;
      }
    } else {
      details.push({
        step: i + 1,
        expected: required.correctChoices,
        actual: 'MISSING',
        correct: false,
      });
    }
  }

  return {
    correctCount,
    incorrectCount: drill.requiredActions.length - correctCount,
    orderCorrect,
    allCompleted: actions.length >= drill.requiredActions.length,
    details,
  };
}

/**
 * Calculates the drill score (0-100).
 */
function calculateScore(params: {
  withinTimeLimit: boolean;
  withinSLA: boolean;
  actionsCorrect: number;
  actionsTotal: number;
  orderCorrect: boolean;
  allCompleted: boolean;
}): number {
  let score = 0;

  // Action correctness (50 points)
  const actionScore = (params.actionsCorrect / params.actionsTotal) * 50;
  score += actionScore;

  // All actions completed (15 points)
  if (params.allCompleted) score += 15;

  // Correct order (15 points)
  if (params.orderCorrect) score += 15;

  // Within time limit (10 points)
  if (params.withinTimeLimit) score += 10;

  // Within SLA (10 points bonus)
  if (params.withinSLA) score += 10;

  return Math.round(score);
}

/**
 * Determines if drill passed based on success criteria.
 */
function evaluatePassFail(
  drill: DrillDefinition,
  results: {
    withinTimeLimit: boolean;
    actionsCorrect: boolean;
    orderCorrect: boolean;
    allCompleted: boolean;
    reasonsProvided: boolean;
  }
): boolean {
  const criteria = drill.successCriteria;

  if (criteria.withinTimeLimit && !results.withinTimeLimit) return false;
  if (criteria.correctActions && !results.actionsCorrect) return false;
  if (criteria.correctOrder && !results.orderCorrect) return false;
  if (criteria.allActionsCompleted && !results.allCompleted) return false;
  if (criteria.reasonProvided && !results.reasonsProvided) return false;

  return true;
}

/**
 * Generates human-readable feedback.
 */
function generateFeedback(params: {
  passed: boolean;
  withinTimeLimit: boolean;
  withinSLA: boolean;
  timeElapsed: number;
  drill: DrillDefinition;
  actionEvaluation: ReturnType<typeof evaluateActions>;
}): string[] {
  const feedback: string[] = [];

  // Overall result
  feedback.push(
    params.passed
      ? `PASSED: ${params.drill.name} completed successfully.`
      : `FAILED: ${params.drill.name} did not meet success criteria.`
  );

  // Time feedback
  if (params.withinSLA) {
    feedback.push(`Excellent! Completed within SLA (${params.timeElapsed}s / ${params.drill.slaTarget}s target).`);
  } else if (params.withinTimeLimit) {
    feedback.push(`Completed in ${params.timeElapsed}s (SLA target was ${params.drill.slaTarget}s).`);
  } else {
    feedback.push(`Time limit exceeded: ${params.timeElapsed}s (limit was ${params.drill.totalTimeLimit}s).`);
  }

  // Action feedback
  feedback.push(
    `Actions correct: ${params.actionEvaluation.correctCount}/${params.actionEvaluation.details.length}`
  );

  if (!params.actionEvaluation.orderCorrect) {
    feedback.push('Warning: Actions were not performed in the optimal order.');
  }

  // Specific action feedback
  for (const detail of params.actionEvaluation.details) {
    if (!detail.correct) {
      if (detail.actual === 'MISSING') {
        feedback.push(`Step ${detail.step}: Action was not taken. Expected: ${detail.expected.join(' or ')}`);
      } else {
        feedback.push(
          `Step ${detail.step}: Incorrect action "${detail.actual}". Expected: ${detail.expected.join(' or ')}`
        );
      }
    }
  }

  return feedback;
}

/**
 * Creates a failed result with error message.
 */
function createFailedResult(error: string, feedback: string[]): DrillEvaluationResult {
  return {
    passed: false,
    score: 0,
    timeElapsed: 0,
    withinSLA: false,
    actionsCorrect: 0,
    actionsTotal: 0,
    orderCorrect: false,
    feedback: [error, ...feedback],
    certificationGranted: false,
  };
}

// ============================================
// Certification Management
// ============================================

/**
 * Records a certification for an operator.
 */
async function recordCertification(
  instance: DrillInstance,
  drill: DrillDefinition,
  result: DrillEvaluationResult
): Promise<void> {
  const operatorCerts = certifications.get(instance.operatorId) || [];

  // Remove expired certifications
  const now = Date.now();
  const validCerts = operatorCerts.filter(
    (c) => new Date(c.expiresAt).getTime() > now
  );

  // Add new certification (expires in 90 days)
  const expiresAt = new Date(now + 90 * 24 * 60 * 60 * 1000);

  validCerts.push({
    operatorId: instance.operatorId,
    operatorRole: instance.operatorRole,
    workspaceId: instance.workspaceId,
    drillId: drill.id,
    drillName: drill.name,
    incidentType: drill.incidentType,
    passed: result.passed,
    score: result.score,
    completedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  certifications.set(instance.operatorId, validCerts);
}

/**
 * Gets certification status for an operator.
 */
export function getOperatorCertificationStatus(
  operatorId: string,
  role: AdLabRole,
  requiredDrills: string[]
): OperatorCertificationStatus {
  const operatorCerts = certifications.get(operatorId) || [];

  // Filter to valid (non-expired) certifications
  const now = Date.now();
  const validCerts = operatorCerts.filter(
    (c) => new Date(c.expiresAt).getTime() > now && c.passed
  );

  // Check which required drills have been passed
  const passedDrillIds = new Set(validCerts.map((c) => c.drillId));
  const requiredPassed = requiredDrills.filter((d) => passedDrillIds.has(d));

  // Find next required drill
  const nextRequired = requiredDrills.find((d) => !passedDrillIds.has(d));

  return {
    operatorId,
    role,
    certifications: validCerts,
    requiredDrillsPassed: requiredPassed.length,
    requiredDrillsTotal: requiredDrills.length,
    fullyOperational: requiredPassed.length === requiredDrills.length,
    nextRequiredDrill: nextRequired,
  };
}

/**
 * Checks if an operator is certified for a specific incident type.
 */
export function isOperatorCertified(
  operatorId: string,
  incidentType: string
): boolean {
  const operatorCerts = certifications.get(operatorId) || [];
  const now = Date.now();

  return operatorCerts.some(
    (c) =>
      c.incidentType === incidentType &&
      c.passed &&
      new Date(c.expiresAt).getTime() > now
  );
}

/**
 * Gets all certifications for an operator.
 */
export function getOperatorCertifications(operatorId: string): CertificationRecord[] {
  return certifications.get(operatorId) || [];
}

/**
 * Clears all certifications (for testing).
 */
export function clearAllCertifications(): void {
  certifications.clear();
}

// ============================================
// Role-Based Certification Rules
// ============================================

/** Required drills by role */
export const REQUIRED_DRILLS_BY_ROLE: Record<AdLabRole, string[]> = {
  owner: [
    'drill-data-corruption-001',
    'drill-bad-promotion-001',
    'drill-snapshot-regression-001',
    'drill-system-outage-001',
  ],
  admin: [
    'drill-bad-promotion-001',
    'drill-snapshot-regression-001',
  ],
  operator: [
    'drill-permission-escalation-001',
  ],
  viewer: [], // Viewers cannot participate
};

/**
 * Gets required drills for a role.
 */
export function getRequiredDrillsForRole(role: AdLabRole): string[] {
  return REQUIRED_DRILLS_BY_ROLE[role] || [];
}

/**
 * Checks if a role can participate in drills.
 */
export function canRoleParticipate(role: AdLabRole): boolean {
  return role !== 'viewer';
}
