// ============================================
// AdLab Incident Drill Definitions
// ============================================
// PHASE D25: Production Drill & Operator Certification.
//
// CORE PRINCIPLE:
// Operators must prove they can handle real incidents.
// Schema-enforced drills ensure consistency.
// No free-form drills allowed.
//
// INCIDENT TYPES:
// - DATA_CORRUPTION: Bad data detected in production
// - BAD_PROMOTION: Wrong data promoted
// - SNAPSHOT_REGRESSION: Analytics showing old data
// - PERMISSION_ESCALATION: Unauthorized access attempt
// - SYSTEM_OUTAGE: Complete system unavailable
// ============================================

import type { AdLabRole } from '@/lib/adlab/auth';

// ============================================
// Types
// ============================================

/** Incident severity levels */
export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Types of incidents that can be drilled */
export type IncidentType =
  | 'DATA_CORRUPTION'
  | 'BAD_PROMOTION'
  | 'SNAPSHOT_REGRESSION'
  | 'PERMISSION_ESCALATION'
  | 'SYSTEM_OUTAGE';

/** Actions an operator can take during a drill */
export type DrillAction =
  | 'ACKNOWLEDGE'
  | 'ENABLE_KILL_SWITCH'
  | 'DISABLE_KILL_SWITCH'
  | 'ROLLBACK'
  | 'FREEZE_SNAPSHOT'
  | 'ESCALATE'
  | 'INVESTIGATE'
  | 'RESOLVE'
  | 'IGNORE';

/** Guard types that should trigger during incident */
export type ExpectedGuard =
  | 'KILL_SWITCH'
  | 'PERMISSION_CHECK'
  | 'AUDIT_LOG'
  | 'FAILURE_INJECTION';

/** Drill status */
export type DrillStatus =
  | 'PENDING'      // Not started
  | 'ACTIVE'       // In progress
  | 'AWAITING_ACTION' // Waiting for operator
  | 'EVALUATING'   // Checking results
  | 'PASSED'       // Successfully completed
  | 'FAILED'       // Failed evaluation
  | 'EXPIRED';     // Time limit exceeded

/** Single required action in a drill */
export interface RequiredAction {
  action: DrillAction;
  order: number; // 1-based order
  timeLimit: number; // seconds
  description: string;
  correctChoices: DrillAction[]; // Valid actions for this step
  failureMessage: string;
}

/** Success criteria for a drill */
export interface SuccessCriteria {
  allActionsCompleted: boolean;
  withinTimeLimit: boolean;
  correctOrder: boolean;
  correctActions: boolean;
  reasonProvided: boolean;
}

/** Drill definition schema */
export interface DrillDefinition {
  id: string;
  name: string;
  description: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;

  // Scenario setup
  scenario: {
    description: string;
    symptoms: string[];
    affectedData: string;
    urgency: string;
  };

  // Expected behavior
  expectedGuards: ExpectedGuard[];
  requiredActions: RequiredAction[];

  // Time constraints
  totalTimeLimit: number; // seconds
  slaTarget: number; // seconds for SLA compliance

  // Success evaluation
  successCriteria: SuccessCriteria;

  // Certification
  requiredForRoles: AdLabRole[];
  certificationLevel: 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
}

/** Active drill instance */
export interface DrillInstance {
  id: string;
  drillId: string;
  workspaceId: string;
  operatorId: string;
  operatorRole: AdLabRole;
  status: DrillStatus;
  startedAt: string;
  expiresAt: string;
  currentStep: number;
  actionsTaken: DrillActionRecord[];
  evaluationResult?: DrillEvaluationResult;
}

/** Record of an action taken during drill */
export interface DrillActionRecord {
  action: DrillAction;
  timestamp: string;
  reason: string;
  stepNumber: number;
  correct: boolean;
}

/** Drill evaluation result */
export interface DrillEvaluationResult {
  passed: boolean;
  score: number; // 0-100
  timeElapsed: number; // seconds
  withinSLA: boolean;
  actionsCorrect: number;
  actionsTotal: number;
  orderCorrect: boolean;
  feedback: string[];
  certificationGranted: boolean;
}

// ============================================
// Drill Definitions
// ============================================

export const DRILL_DEFINITIONS: DrillDefinition[] = [
  // ==========================================
  // CRITICAL DRILLS
  // ==========================================
  {
    id: 'drill-data-corruption-001',
    name: 'Data Corruption Response',
    description: 'Respond to detected data corruption in production tables',
    incidentType: 'DATA_CORRUPTION',
    severity: 'CRITICAL',
    scenario: {
      description: 'Anomaly detection has identified inconsistent data in the campaigns table. Multiple campaigns show negative spend values.',
      symptoms: [
        'Negative spend values detected',
        'Campaign totals do not match expected sums',
        'Last promotion was 2 hours ago',
      ],
      affectedData: 'campaigns table - 47 rows affected',
      urgency: 'IMMEDIATE - Customer-facing analytics are incorrect',
    },
    expectedGuards: ['KILL_SWITCH', 'AUDIT_LOG'],
    requiredActions: [
      {
        action: 'ACKNOWLEDGE',
        order: 1,
        timeLimit: 60,
        description: 'Acknowledge the incident',
        correctChoices: ['ACKNOWLEDGE'],
        failureMessage: 'Must acknowledge incident within 60 seconds',
      },
      {
        action: 'ENABLE_KILL_SWITCH',
        order: 2,
        timeLimit: 120,
        description: 'Enable kill-switch to stop further damage',
        correctChoices: ['ENABLE_KILL_SWITCH'],
        failureMessage: 'Kill-switch must be enabled immediately for data corruption',
      },
      {
        action: 'ROLLBACK',
        order: 3,
        timeLimit: 300,
        description: 'Rollback to last known good snapshot',
        correctChoices: ['ROLLBACK'],
        failureMessage: 'Data must be restored via rollback',
      },
      {
        action: 'DISABLE_KILL_SWITCH',
        order: 4,
        timeLimit: 60,
        description: 'Disable kill-switch after recovery',
        correctChoices: ['DISABLE_KILL_SWITCH'],
        failureMessage: 'Kill-switch should be disabled after successful rollback',
      },
      {
        action: 'RESOLVE',
        order: 5,
        timeLimit: 60,
        description: 'Mark incident as resolved',
        correctChoices: ['RESOLVE'],
        failureMessage: 'Incident must be formally resolved',
      },
    ],
    totalTimeLimit: 600, // 10 minutes
    slaTarget: 300, // 5 minutes
    successCriteria: {
      allActionsCompleted: true,
      withinTimeLimit: true,
      correctOrder: true,
      correctActions: true,
      reasonProvided: true,
    },
    requiredForRoles: ['owner'],
    certificationLevel: 'REQUIRED',
  },

  {
    id: 'drill-bad-promotion-001',
    name: 'Bad Promotion Recovery',
    description: 'Recover from a promotion that contained bad data',
    incidentType: 'BAD_PROMOTION',
    severity: 'CRITICAL',
    scenario: {
      description: 'A CSV with malformed dates was promoted to production. All date fields show "1970-01-01".',
      symptoms: [
        'All date fields showing epoch date',
        'Promotion completed 15 minutes ago',
        'CSV validation passed but data was semantically wrong',
      ],
      affectedData: 'daily_metrics table - 1,247 rows affected',
      urgency: 'HIGH - Reports are generating incorrect data',
    },
    expectedGuards: ['KILL_SWITCH', 'AUDIT_LOG'],
    requiredActions: [
      {
        action: 'ACKNOWLEDGE',
        order: 1,
        timeLimit: 60,
        description: 'Acknowledge the incident',
        correctChoices: ['ACKNOWLEDGE'],
        failureMessage: 'Must acknowledge incident',
      },
      {
        action: 'ENABLE_KILL_SWITCH',
        order: 2,
        timeLimit: 120,
        description: 'Enable workspace kill-switch',
        correctChoices: ['ENABLE_KILL_SWITCH'],
        failureMessage: 'Kill-switch prevents further promotions',
      },
      {
        action: 'ROLLBACK',
        order: 3,
        timeLimit: 300,
        description: 'Rollback to snapshot before bad promotion',
        correctChoices: ['ROLLBACK'],
        failureMessage: 'Must rollback to restore correct data',
      },
      {
        action: 'DISABLE_KILL_SWITCH',
        order: 4,
        timeLimit: 60,
        description: 'Re-enable operations',
        correctChoices: ['DISABLE_KILL_SWITCH'],
        failureMessage: 'Operations should resume after fix',
      },
      {
        action: 'RESOLVE',
        order: 5,
        timeLimit: 60,
        description: 'Resolve incident',
        correctChoices: ['RESOLVE'],
        failureMessage: 'Incident must be resolved',
      },
    ],
    totalTimeLimit: 600,
    slaTarget: 300,
    successCriteria: {
      allActionsCompleted: true,
      withinTimeLimit: true,
      correctOrder: true,
      correctActions: true,
      reasonProvided: true,
    },
    requiredForRoles: ['owner', 'admin'],
    certificationLevel: 'REQUIRED',
  },

  // ==========================================
  // HIGH SEVERITY DRILLS
  // ==========================================
  {
    id: 'drill-snapshot-regression-001',
    name: 'Snapshot Regression Investigation',
    description: 'Investigate when analytics show outdated data',
    incidentType: 'SNAPSHOT_REGRESSION',
    severity: 'HIGH',
    scenario: {
      description: 'Users report that dashboard shows data from 3 days ago instead of current data.',
      symptoms: [
        'Dashboard metrics are stale',
        'Last active snapshot is from 3 days ago',
        'Recent promotions appear successful',
      ],
      affectedData: 'Production snapshots - active snapshot mismatch',
      urgency: 'MEDIUM - Data is stale but not corrupt',
    },
    expectedGuards: ['AUDIT_LOG'],
    requiredActions: [
      {
        action: 'ACKNOWLEDGE',
        order: 1,
        timeLimit: 120,
        description: 'Acknowledge the investigation',
        correctChoices: ['ACKNOWLEDGE'],
        failureMessage: 'Must acknowledge',
      },
      {
        action: 'INVESTIGATE',
        order: 2,
        timeLimit: 300,
        description: 'Check audit logs for snapshot changes',
        correctChoices: ['INVESTIGATE'],
        failureMessage: 'Investigation is required before action',
      },
      {
        action: 'ROLLBACK',
        order: 3,
        timeLimit: 180,
        description: 'Activate the correct snapshot',
        correctChoices: ['ROLLBACK', 'RESOLVE'],
        failureMessage: 'Correct snapshot must be activated',
      },
      {
        action: 'RESOLVE',
        order: 4,
        timeLimit: 60,
        description: 'Resolve with root cause',
        correctChoices: ['RESOLVE'],
        failureMessage: 'Must document resolution',
      },
    ],
    totalTimeLimit: 900, // 15 minutes
    slaTarget: 600, // 10 minutes
    successCriteria: {
      allActionsCompleted: true,
      withinTimeLimit: true,
      correctOrder: true,
      correctActions: true,
      reasonProvided: true,
    },
    requiredForRoles: ['owner', 'admin'],
    certificationLevel: 'REQUIRED',
  },

  // ==========================================
  // MEDIUM SEVERITY DRILLS
  // ==========================================
  {
    id: 'drill-permission-escalation-001',
    name: 'Permission Escalation Attempt',
    description: 'Respond to detected unauthorized access attempt',
    incidentType: 'PERMISSION_ESCALATION',
    severity: 'MEDIUM',
    scenario: {
      description: 'Audit logs show repeated PERMISSION_DENIED events for a user attempting ROLLBACK action.',
      symptoms: [
        '15 PERMISSION_DENIED events in last 10 minutes',
        'All from same user ID',
        'User role is "operator"',
      ],
      affectedData: 'No data affected - all attempts blocked',
      urgency: 'LOW - System is working correctly',
    },
    expectedGuards: ['PERMISSION_CHECK', 'AUDIT_LOG'],
    requiredActions: [
      {
        action: 'ACKNOWLEDGE',
        order: 1,
        timeLimit: 180,
        description: 'Acknowledge the security event',
        correctChoices: ['ACKNOWLEDGE'],
        failureMessage: 'Security events must be acknowledged',
      },
      {
        action: 'INVESTIGATE',
        order: 2,
        timeLimit: 300,
        description: 'Review user activity and intent',
        correctChoices: ['INVESTIGATE'],
        failureMessage: 'Must investigate before action',
      },
      {
        action: 'ESCALATE',
        order: 3,
        timeLimit: 180,
        description: 'Escalate to security team or resolve',
        correctChoices: ['ESCALATE', 'RESOLVE'],
        failureMessage: 'Must escalate or resolve based on investigation',
      },
    ],
    totalTimeLimit: 900,
    slaTarget: 600,
    successCriteria: {
      allActionsCompleted: true,
      withinTimeLimit: true,
      correctOrder: true,
      correctActions: true,
      reasonProvided: true,
    },
    requiredForRoles: ['owner', 'admin', 'operator'],
    certificationLevel: 'RECOMMENDED',
  },

  {
    id: 'drill-system-outage-001',
    name: 'System Outage Response',
    description: 'Respond to complete system unavailability',
    incidentType: 'SYSTEM_OUTAGE',
    severity: 'CRITICAL',
    scenario: {
      description: 'All AdLab operations are failing with 503 errors.',
      symptoms: [
        'All API calls returning 503',
        'Database connections timing out',
        'Last successful operation 5 minutes ago',
      ],
      affectedData: 'All operations blocked',
      urgency: 'CRITICAL - Complete outage',
    },
    expectedGuards: ['KILL_SWITCH'],
    requiredActions: [
      {
        action: 'ACKNOWLEDGE',
        order: 1,
        timeLimit: 30,
        description: 'Immediately acknowledge',
        correctChoices: ['ACKNOWLEDGE'],
        failureMessage: 'Critical outages need immediate acknowledgment',
      },
      {
        action: 'ESCALATE',
        order: 2,
        timeLimit: 60,
        description: 'Escalate to infrastructure team',
        correctChoices: ['ESCALATE'],
        failureMessage: 'System outages require immediate escalation',
      },
      {
        action: 'INVESTIGATE',
        order: 3,
        timeLimit: 300,
        description: 'Check if kill-switch is active',
        correctChoices: ['INVESTIGATE'],
        failureMessage: 'Must verify kill-switch status',
      },
      {
        action: 'RESOLVE',
        order: 4,
        timeLimit: 60,
        description: 'Resolve or handoff',
        correctChoices: ['RESOLVE', 'ESCALATE'],
        failureMessage: 'Must resolve or escalate',
      },
    ],
    totalTimeLimit: 600,
    slaTarget: 180,
    successCriteria: {
      allActionsCompleted: true,
      withinTimeLimit: true,
      correctOrder: true,
      correctActions: true,
      reasonProvided: true,
    },
    requiredForRoles: ['owner'],
    certificationLevel: 'REQUIRED',
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Gets a drill definition by ID.
 */
export function getDrillById(id: string): DrillDefinition | undefined {
  return DRILL_DEFINITIONS.find((d) => d.id === id);
}

/**
 * Gets drills by incident type.
 */
export function getDrillsByType(type: IncidentType): DrillDefinition[] {
  return DRILL_DEFINITIONS.filter((d) => d.incidentType === type);
}

/**
 * Gets drills required for a role.
 */
export function getDrillsForRole(role: AdLabRole): DrillDefinition[] {
  return DRILL_DEFINITIONS.filter((d) => d.requiredForRoles.includes(role));
}

/**
 * Gets required drills for certification.
 */
export function getRequiredDrills(): DrillDefinition[] {
  return DRILL_DEFINITIONS.filter((d) => d.certificationLevel === 'REQUIRED');
}

/**
 * Gets drills by severity.
 */
export function getDrillsBySeverity(severity: IncidentSeverity): DrillDefinition[] {
  return DRILL_DEFINITIONS.filter((d) => d.severity === severity);
}

/**
 * Validates if a role can participate in a drill.
 */
export function canParticipate(role: AdLabRole, drill: DrillDefinition): boolean {
  // Viewer cannot participate in any drills
  if (role === 'viewer') return false;

  // Check if role is in required list
  return drill.requiredForRoles.includes(role);
}

/**
 * Gets all incident types.
 */
export const INCIDENT_TYPES: IncidentType[] = [
  'DATA_CORRUPTION',
  'BAD_PROMOTION',
  'SNAPSHOT_REGRESSION',
  'PERMISSION_ESCALATION',
  'SYSTEM_OUTAGE',
];

/**
 * Gets all drill actions.
 */
export const DRILL_ACTIONS: DrillAction[] = [
  'ACKNOWLEDGE',
  'ENABLE_KILL_SWITCH',
  'DISABLE_KILL_SWITCH',
  'ROLLBACK',
  'FREEZE_SNAPSHOT',
  'ESCALATE',
  'INVESTIGATE',
  'RESOLVE',
  'IGNORE',
];
