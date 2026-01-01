// ============================================
// AdLab Operator Runbook
// ============================================
// PHASE D24: Production Readiness Proof.
//
// CORE PRINCIPLE:
// Human operators need deterministic guidance.
// This runbook is machine-readable AND human-readable.
//
// USAGE:
// - Import and use programmatically
// - Export to JSON for external tools
// - Reference in incident response
// ============================================

// ============================================
// Types
// ============================================

/** Severity levels for incidents */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Decision node in a decision tree */
export interface DecisionNode {
  question: string;
  options: {
    answer: string;
    action?: string;
    next?: DecisionNode;
  }[];
}

/** Runbook procedure */
export interface Procedure {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  trigger: string;
  steps: string[];
  warnings: string[];
  rollback?: string[];
}

/** Audit event interpretation guide */
export interface AuditInterpretation {
  action: string;
  meaning: string;
  expectedFrequency: string;
  alertThreshold: string;
  response: string;
}

/** Complete runbook structure */
export interface OperatorRunbook {
  version: string;
  lastUpdated: string;
  procedures: {
    killSwitch: Procedure[];
    failureInjection: Procedure[];
    rollback: Procedure[];
    incident: Procedure[];
  };
  decisionTrees: {
    rollback: DecisionNode;
    killSwitch: DecisionNode;
  };
  auditGuide: AuditInterpretation[];
  contacts: {
    role: string;
    responsibility: string;
  }[];
}

// ============================================
// Kill-Switch Procedures
// ============================================

const KILL_SWITCH_PROCEDURES: Procedure[] = [
  {
    id: 'ks-enable-global',
    name: 'Enable Global Kill-Switch',
    description: 'Stops ALL dangerous operations across ALL workspaces',
    severity: 'CRITICAL',
    trigger: 'Data corruption detected, security breach, major schema migration',
    steps: [
      '1. Assess the situation - confirm this is necessary',
      '2. Notify team via incident channel',
      '3. Run: enableGlobalKillSwitch(reason, actorId)',
      '4. Verify via /api/adlab/system/readiness',
      '5. Document in incident log',
    ],
    warnings: [
      'This stops ALL promotion and rollback operations',
      'Users will see "Operations Paused" banner',
      'Only owner role can re-enable',
    ],
    rollback: [
      '1. Confirm root cause is resolved',
      '2. Run: disableGlobalKillSwitch(actorId)',
      '3. Verify operations resume',
      '4. Document resolution in incident log',
    ],
  },
  {
    id: 'ks-enable-workspace',
    name: 'Enable Workspace Kill-Switch',
    description: 'Stops dangerous operations for ONE workspace only',
    severity: 'HIGH',
    trigger: 'Workspace-specific issue, customer request, investigation',
    steps: [
      '1. Identify affected workspace ID',
      '2. Run: enableWorkspaceKillSwitch(workspaceId, reason, actorId)',
      '3. Verify via /api/adlab/system/readiness',
      '4. Notify workspace owner if appropriate',
    ],
    warnings: [
      'Only affects single workspace',
      'Other workspaces continue normal operation',
    ],
    rollback: [
      '1. Confirm issue resolved for workspace',
      '2. Run: disableWorkspaceKillSwitch(workspaceId, actorId)',
      '3. Verify operations resume',
    ],
  },
];

// ============================================
// Failure Injection Procedures
// ============================================

const FAILURE_INJECTION_PROCEDURES: Procedure[] = [
  {
    id: 'fi-enable-chaos',
    name: 'Enable Chaos Testing',
    description: 'Injects controlled failures to test system resilience',
    severity: 'MEDIUM',
    trigger: 'Scheduled chaos testing, pre-release validation',
    steps: [
      '1. Ensure test workspace is isolated',
      '2. Run: upsertInjectionConfig({ workspaceId, action, failureType, probability, reason })',
      '3. Run: enableInjection(workspaceId, action, actorId)',
      '4. Execute test scenarios',
      '5. Observe audit logs for injected failures',
    ],
    warnings: [
      'NEVER enable on production workspaces',
      'Always use low probability (<50%) first',
      'Monitor audit logs during testing',
    ],
    rollback: [
      '1. Run: disableInjection(workspaceId, action, actorId)',
      '2. Verify normal operation resumes',
    ],
  },
  {
    id: 'fi-timeout-test',
    name: 'Test Timeout Handling',
    description: 'Verifies UI handles slow/timeout responses correctly',
    severity: 'LOW',
    trigger: 'Pre-release testing, timeout handling verification',
    steps: [
      '1. Set failureType to TIMEOUT',
      '2. Set probability to 100% for guaranteed trigger',
      '3. Execute target action',
      '4. Verify UI shows appropriate error',
      '5. Verify audit log captures timeout',
    ],
    warnings: [
      'TIMEOUT adds 5-10 second delay',
      'May trigger client-side timeouts',
    ],
  },
];

// ============================================
// Rollback Procedures
// ============================================

const ROLLBACK_PROCEDURES: Procedure[] = [
  {
    id: 'rb-standard',
    name: 'Standard Rollback',
    description: 'Rolls back to a previous production snapshot',
    severity: 'HIGH',
    trigger: 'Bad data promoted, customer request, data correction',
    steps: [
      '1. Identify target snapshot ID from /ads/snapshots',
      '2. Verify snapshot is INACTIVE',
      '3. Document reason for rollback',
      '4. Execute rollback via API or UI',
      '5. Verify new active snapshot in /ads/snapshots',
      '6. Verify audit log entry created',
    ],
    warnings: [
      'Only OWNER role can perform rollback',
      'Previous active snapshot becomes inactive',
      'All analytics will now read from rolled-back snapshot',
    ],
  },
  {
    id: 'rb-emergency',
    name: 'Emergency Rollback',
    description: 'Immediate rollback during active incident',
    severity: 'CRITICAL',
    trigger: 'Active incident, data corruption, compliance issue',
    steps: [
      '1. If kill-switch is active, disable it first',
      '2. Identify most recent known-good snapshot',
      '3. Execute rollback immediately',
      '4. Re-enable kill-switch if needed',
      '5. Document in incident timeline',
    ],
    warnings: [
      'Skip normal approval process in emergencies',
      'Document everything immediately after',
    ],
  },
];

// ============================================
// Incident Procedures
// ============================================

const INCIDENT_PROCEDURES: Procedure[] = [
  {
    id: 'inc-data-corruption',
    name: 'Data Corruption Response',
    description: 'Immediate response to suspected data corruption',
    severity: 'CRITICAL',
    trigger: 'Data inconsistency detected, user reports wrong data',
    steps: [
      '1. IMMEDIATELY enable global kill-switch',
      '2. Assess scope: single workspace or global?',
      '3. Identify last known-good snapshot',
      '4. Notify stakeholders',
      '5. Plan rollback strategy',
      '6. Execute rollback',
      '7. Verify data integrity',
      '8. Disable kill-switch',
      '9. Post-incident review',
    ],
    warnings: [
      'Do not attempt fixes while data is actively corrupting',
      'Stopping the bleeding is priority #1',
    ],
  },
  {
    id: 'inc-performance',
    name: 'Performance Degradation Response',
    description: 'Response to slow or failing operations',
    severity: 'HIGH',
    trigger: 'Timeout errors, slow queries, user complaints',
    steps: [
      '1. Check /api/adlab/system/readiness',
      '2. Check for active failure injections',
      '3. Check database connection health',
      '4. If chaos testing: disable injections',
      '5. If database: scale or optimize',
      '6. Monitor for recovery',
    ],
    warnings: [
      'Failure injections can cause fake performance issues',
      'Always check chaos testing status first',
    ],
  },
];

// ============================================
// Decision Trees
// ============================================

const ROLLBACK_DECISION_TREE: DecisionNode = {
  question: 'Is data in production incorrect?',
  options: [
    {
      answer: 'Yes, data is wrong',
      next: {
        question: 'How severe is the impact?',
        options: [
          {
            answer: 'Critical - affecting customer operations',
            action: 'Execute Emergency Rollback (rb-emergency)',
          },
          {
            answer: 'High - noticeable but not blocking',
            action: 'Execute Standard Rollback (rb-standard)',
          },
          {
            answer: 'Low - minor discrepancy',
            next: {
              question: 'Can it wait for next ingestion?',
              options: [
                { answer: 'Yes', action: 'Schedule fix in next ingestion cycle' },
                { answer: 'No', action: 'Execute Standard Rollback (rb-standard)' },
              ],
            },
          },
        ],
      },
    },
    {
      answer: 'No, data is correct',
      action: 'No rollback needed. Investigate reported issue.',
    },
    {
      answer: 'Unsure',
      action: 'Compare current snapshot with previous. Check audit logs.',
    },
  ],
};

const KILL_SWITCH_DECISION_TREE: DecisionNode = {
  question: 'What is the nature of the issue?',
  options: [
    {
      answer: 'Active data corruption',
      action: 'Enable Global Kill-Switch IMMEDIATELY (ks-enable-global)',
    },
    {
      answer: 'Security breach suspected',
      action: 'Enable Global Kill-Switch IMMEDIATELY (ks-enable-global)',
    },
    {
      answer: 'Single workspace issue',
      next: {
        question: 'Is the issue spreading?',
        options: [
          { answer: 'Yes', action: 'Enable Global Kill-Switch (ks-enable-global)' },
          { answer: 'No', action: 'Enable Workspace Kill-Switch (ks-enable-workspace)' },
        ],
      },
    },
    {
      answer: 'Planned maintenance',
      action: 'Enable Global Kill-Switch with scheduled reason (ks-enable-global)',
    },
    {
      answer: 'Performance issue only',
      action: 'Do NOT use kill-switch. Investigate performance.',
    },
  ],
};

// ============================================
// Audit Interpretation Guide
// ============================================

const AUDIT_GUIDE: AuditInterpretation[] = [
  {
    action: 'VALIDATE',
    meaning: 'CSV file was validated (not promoted)',
    expectedFrequency: 'Multiple times daily',
    alertThreshold: 'None - routine operation',
    response: 'No action needed',
  },
  {
    action: 'PROMOTE',
    meaning: 'Data was written to production tables',
    expectedFrequency: 'Once per ingestion cycle',
    alertThreshold: 'More than 3x per hour per workspace',
    response: 'Investigate if unexpected. May indicate automation issue.',
  },
  {
    action: 'ROLLBACK',
    meaning: 'Production snapshot was changed',
    expectedFrequency: 'Rare - only when correcting issues',
    alertThreshold: 'Any occurrence should be investigated',
    response: 'Review reason. Verify data integrity post-rollback.',
  },
  {
    action: 'FAILURE_INJECTED',
    meaning: 'Chaos testing triggered a simulated failure',
    expectedFrequency: 'Only during scheduled testing',
    alertThreshold: 'Any occurrence outside testing window',
    response: 'If unexpected, disable failure injections immediately.',
  },
  {
    action: 'PERMISSION_DENIED',
    meaning: 'User attempted action without proper role',
    expectedFrequency: 'Occasional - user errors',
    alertThreshold: 'More than 5x per hour per user',
    response: 'May indicate misconfigured permissions or attack attempt.',
  },
];

// ============================================
// Contacts
// ============================================

const CONTACTS = [
  {
    role: 'Workspace Owner',
    responsibility: 'All operations including rollback',
  },
  {
    role: 'Workspace Admin',
    responsibility: 'Promotion, validation, configuration',
  },
  {
    role: 'Workspace Operator',
    responsibility: 'Validation and ingestion only',
  },
  {
    role: 'System Admin',
    responsibility: 'Kill-switch, failure injection, system health',
  },
];

// ============================================
// Complete Runbook Export
// ============================================

/**
 * The complete operator runbook.
 * Machine-readable JSON structure.
 */
export const OPERATOR_RUNBOOK: OperatorRunbook = {
  version: 'D24',
  lastUpdated: new Date().toISOString(),
  procedures: {
    killSwitch: KILL_SWITCH_PROCEDURES,
    failureInjection: FAILURE_INJECTION_PROCEDURES,
    rollback: ROLLBACK_PROCEDURES,
    incident: INCIDENT_PROCEDURES,
  },
  decisionTrees: {
    rollback: ROLLBACK_DECISION_TREE,
    killSwitch: KILL_SWITCH_DECISION_TREE,
  },
  auditGuide: AUDIT_GUIDE,
  contacts: CONTACTS,
};

/**
 * Gets a procedure by ID.
 */
export function getProcedure(id: string): Procedure | undefined {
  const allProcedures = [
    ...KILL_SWITCH_PROCEDURES,
    ...FAILURE_INJECTION_PROCEDURES,
    ...ROLLBACK_PROCEDURES,
    ...INCIDENT_PROCEDURES,
  ];
  return allProcedures.find((p) => p.id === id);
}

/**
 * Gets all procedures by severity.
 */
export function getProceduresBySeverity(severity: Severity): Procedure[] {
  const allProcedures = [
    ...KILL_SWITCH_PROCEDURES,
    ...FAILURE_INJECTION_PROCEDURES,
    ...ROLLBACK_PROCEDURES,
    ...INCIDENT_PROCEDURES,
  ];
  return allProcedures.filter((p) => p.severity === severity);
}

/**
 * Exports runbook as JSON string.
 */
export function exportRunbookAsJSON(): string {
  return JSON.stringify(OPERATOR_RUNBOOK, null, 2);
}
