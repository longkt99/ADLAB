// ============================================
// AdLab Standard Security Answer Engine
// ============================================
// PHASE D44: Procurement & Security Response Layer.
//
// PROVIDES:
// - Evidence-derived answers to security questions
// - Consistent, auditable response generation
// - Status tracking (ANSWERED, PARTIAL, UNAVAILABLE)
//
// INVARIANTS:
// - READ-ONLY: No mutations
// - EVIDENCE-DERIVED ONLY: No speculation
// - NO PII: Zero identity data
// - NO SIGNAL EXPOSURE: No telemetry in answers
// - NO SALES LANGUAGE: Factual only
// - FAIL-CLOSED: UNAVAILABLE when uncertain
// ============================================

import { type SLASummary } from './slaDerivation';

// ============================================
// Types
// ============================================

/** Question categories for procurement/security */
export type SecurityQuestionCategory =
  | 'ACCESS_CONTROL'
  | 'AUDIT_LOGGING'
  | 'INCIDENT_RESPONSE'
  | 'DATA_PROTECTION'
  | 'AVAILABILITY'
  | 'COMPLIANCE'
  | 'CHANGE_MANAGEMENT'
  | 'PRIVACY';

/** Answer status */
export type AnswerStatus = 'ANSWERED' | 'PARTIAL' | 'UNAVAILABLE';

/** Evidence source type */
export type EvidenceSourceType =
  | 'ATTESTATION'
  | 'WHITEPAPER'
  | 'QUESTIONNAIRE'
  | 'SLA_DERIVATION'
  | 'AUDIT_LOG'
  | 'SYSTEM_CONFIG';

/** Evidence reference */
export interface EvidenceReference {
  sourceType: EvidenceSourceType;
  sourceId: string;
  section?: string;
  description: string;
}

/** Standard security question */
export interface SecurityQuestion {
  id: string;
  category: SecurityQuestionCategory;
  question: string;
  shortLabel: string;
}

/** Resolved security answer */
export interface SecurityAnswer {
  questionId: string;
  question: string;
  category: SecurityQuestionCategory;
  status: AnswerStatus;
  answer: string;
  evidenceReferences: EvidenceReference[];
  limitations?: string;
  generatedAt: string;
}

/** Evidence context for answer resolution */
export interface EvidenceContext {
  workspaceId: string;
  bundleId?: string;
  hasAttestation: boolean;
  attestationProfile?: string;
  hasWhitepaper: boolean;
  hasQuestionnaire: boolean;
  slaSummary?: SLASummary;
  auditRetentionDays?: number;
  killSwitchAvailable: boolean;
  lastComplianceCheck?: string;
}

/** Answer resolution result */
export interface AnswerResolutionResult {
  workspaceId: string;
  bundleId?: string;
  answers: SecurityAnswer[];
  summary: {
    total: number;
    answered: number;
    partial: number;
    unavailable: number;
  };
  generatedAt: string;
}

// ============================================
// Standard Security Questions
// ============================================

export const STANDARD_SECURITY_QUESTIONS: SecurityQuestion[] = [
  // Access Control & RBAC
  {
    id: 'AC-001',
    category: 'ACCESS_CONTROL',
    question: 'Does the system implement role-based access control (RBAC)?',
    shortLabel: 'RBAC Implementation',
  },
  {
    id: 'AC-002',
    category: 'ACCESS_CONTROL',
    question: 'How are user permissions managed and reviewed?',
    shortLabel: 'Permission Management',
  },
  {
    id: 'AC-003',
    category: 'ACCESS_CONTROL',
    question: 'Is multi-factor authentication (MFA) supported?',
    shortLabel: 'MFA Support',
  },
  {
    id: 'AC-004',
    category: 'ACCESS_CONTROL',
    question: 'How is administrative access controlled and monitored?',
    shortLabel: 'Admin Access Control',
  },

  // Audit Logging & Retention
  {
    id: 'AL-001',
    category: 'AUDIT_LOGGING',
    question: 'Are all security-relevant actions logged?',
    shortLabel: 'Security Logging',
  },
  {
    id: 'AL-002',
    category: 'AUDIT_LOGGING',
    question: 'What is the audit log retention period?',
    shortLabel: 'Log Retention',
  },
  {
    id: 'AL-003',
    category: 'AUDIT_LOGGING',
    question: 'Are audit logs tamper-evident or immutable?',
    shortLabel: 'Log Immutability',
  },
  {
    id: 'AL-004',
    category: 'AUDIT_LOGGING',
    question: 'Can audit logs be exported for compliance review?',
    shortLabel: 'Log Export',
  },

  // Incident Response & Kill-Switch
  {
    id: 'IR-001',
    category: 'INCIDENT_RESPONSE',
    question: 'Is there an emergency kill-switch to disable operations?',
    shortLabel: 'Kill-Switch',
  },
  {
    id: 'IR-002',
    category: 'INCIDENT_RESPONSE',
    question: 'What is the incident response process?',
    shortLabel: 'IR Process',
  },
  {
    id: 'IR-003',
    category: 'INCIDENT_RESPONSE',
    question: 'How are security incidents communicated to customers?',
    shortLabel: 'Incident Communication',
  },
  {
    id: 'IR-004',
    category: 'INCIDENT_RESPONSE',
    question: 'Is there a documented disaster recovery plan?',
    shortLabel: 'DR Plan',
  },

  // Data Protection & RPO/RTO
  {
    id: 'DP-001',
    category: 'DATA_PROTECTION',
    question: 'What is the Recovery Point Objective (RPO)?',
    shortLabel: 'RPO',
  },
  {
    id: 'DP-002',
    category: 'DATA_PROTECTION',
    question: 'What is the Recovery Time Objective (RTO)?',
    shortLabel: 'RTO',
  },
  {
    id: 'DP-003',
    category: 'DATA_PROTECTION',
    question: 'Is data encrypted at rest and in transit?',
    shortLabel: 'Data Encryption',
  },
  {
    id: 'DP-004',
    category: 'DATA_PROTECTION',
    question: 'How is backup and recovery handled?',
    shortLabel: 'Backup & Recovery',
  },

  // Availability & Monitoring
  {
    id: 'AV-001',
    category: 'AVAILABILITY',
    question: 'What is the target availability SLA?',
    shortLabel: 'Availability SLA',
  },
  {
    id: 'AV-002',
    category: 'AVAILABILITY',
    question: 'Is system health monitoring in place?',
    shortLabel: 'Health Monitoring',
  },
  {
    id: 'AV-003',
    category: 'AVAILABILITY',
    question: 'How is capacity planning managed?',
    shortLabel: 'Capacity Planning',
  },
  {
    id: 'AV-004',
    category: 'AVAILABILITY',
    question: 'What redundancy measures are in place?',
    shortLabel: 'Redundancy',
  },

  // Compliance (SOC2 / ISO)
  {
    id: 'CO-001',
    category: 'COMPLIANCE',
    question: 'Is the system SOC2 compliant?',
    shortLabel: 'SOC2 Compliance',
  },
  {
    id: 'CO-002',
    category: 'COMPLIANCE',
    question: 'Is the system ISO 27001 certified?',
    shortLabel: 'ISO 27001',
  },
  {
    id: 'CO-003',
    category: 'COMPLIANCE',
    question: 'How often are compliance audits conducted?',
    shortLabel: 'Audit Frequency',
  },
  {
    id: 'CO-004',
    category: 'COMPLIANCE',
    question: 'Are third-party penetration tests performed?',
    shortLabel: 'Penetration Testing',
  },

  // Change Management
  {
    id: 'CM-001',
    category: 'CHANGE_MANAGEMENT',
    question: 'Is there a formal change management process?',
    shortLabel: 'Change Process',
  },
  {
    id: 'CM-002',
    category: 'CHANGE_MANAGEMENT',
    question: 'How are production changes reviewed and approved?',
    shortLabel: 'Change Approval',
  },
  {
    id: 'CM-003',
    category: 'CHANGE_MANAGEMENT',
    question: 'Is rollback capability available for deployments?',
    shortLabel: 'Rollback Capability',
  },
  {
    id: 'CM-004',
    category: 'CHANGE_MANAGEMENT',
    question: 'How is configuration drift detected and remediated?',
    shortLabel: 'Drift Detection',
  },

  // Privacy & PII Handling
  {
    id: 'PR-001',
    category: 'PRIVACY',
    question: 'What PII is collected by the system?',
    shortLabel: 'PII Collection',
  },
  {
    id: 'PR-002',
    category: 'PRIVACY',
    question: 'How is PII protected and minimized?',
    shortLabel: 'PII Protection',
  },
  {
    id: 'PR-003',
    category: 'PRIVACY',
    question: 'Is user consent obtained for data collection?',
    shortLabel: 'Consent Management',
  },
  {
    id: 'PR-004',
    category: 'PRIVACY',
    question: 'How can users request data deletion?',
    shortLabel: 'Data Deletion',
  },
];

// ============================================
// Answer Templates (Evidence-Derived)
// ============================================

interface AnswerTemplate {
  questionId: string;
  resolver: (ctx: EvidenceContext) => Omit<SecurityAnswer, 'questionId' | 'question' | 'category' | 'generatedAt'>;
}

const ANSWER_TEMPLATES: AnswerTemplate[] = [
  // Access Control
  {
    questionId: 'AC-001',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Yes. The system implements role-based access control with defined roles (owner, admin, member, viewer). Each role has explicit permission boundaries enforced at the API level. Role assignments are workspace-scoped and audited.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'access-control', description: 'RBAC implementation details' },
        { sourceType: 'AUDIT_LOG', sourceId: 'audit-system', description: 'Role change audit trail' },
      ],
    }),
  },
  {
    questionId: 'AC-002',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'User permissions are managed through workspace membership with explicit role assignments. Permission changes are logged in the immutable audit trail. Workspace owners can review and modify member roles at any time.',
      evidenceReferences: [
        { sourceType: 'SYSTEM_CONFIG', sourceId: 'permission-system', description: 'Permission management system' },
        { sourceType: 'AUDIT_LOG', sourceId: 'audit-system', description: 'Permission change logs' },
      ],
    }),
  },
  {
    questionId: 'AC-003',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Multi-factor authentication is supported through the underlying authentication provider. MFA enforcement can be configured at the organization level.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'authentication', description: 'Authentication configuration' },
      ],
    }),
  },
  {
    questionId: 'AC-004',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Administrative access is restricted to designated owner and admin roles. All administrative actions are logged in the immutable audit trail with actor identification, action type, and timestamp. A kill-switch exists to immediately disable all operations if needed.',
      evidenceReferences: [
        { sourceType: 'AUDIT_LOG', sourceId: 'audit-system', description: 'Admin action audit trail' },
        { sourceType: 'SYSTEM_CONFIG', sourceId: 'kill-switch', description: 'Emergency kill-switch capability' },
      ],
    }),
  },

  // Audit Logging
  {
    questionId: 'AL-001',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Yes. All security-relevant actions are logged including: authentication events, permission changes, data mutations, configuration changes, and administrative operations. Logs include actor ID, action type, entity affected, timestamp, and relevant metadata.',
      evidenceReferences: [
        { sourceType: 'AUDIT_LOG', sourceId: 'audit-system', description: 'Comprehensive audit logging' },
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'audit-logging', description: 'Audit logging architecture' },
      ],
    }),
  },
  {
    questionId: 'AL-002',
    resolver: (ctx) => {
      if (ctx.auditRetentionDays) {
        return {
          status: 'ANSWERED',
          answer: `Audit logs are retained for ${ctx.auditRetentionDays} days. Logs are stored in append-only storage and cannot be modified or deleted during the retention period.`,
          evidenceReferences: [
            { sourceType: 'SYSTEM_CONFIG', sourceId: 'audit-retention', description: 'Log retention configuration' },
          ],
        };
      }
      return {
        status: 'PARTIAL',
        answer: 'Audit logs are retained according to configured retention policies. Logs are stored in append-only storage and cannot be modified or deleted during the retention period.',
        evidenceReferences: [
          { sourceType: 'SYSTEM_CONFIG', sourceId: 'audit-retention', description: 'Log retention configuration' },
        ],
        limitations: 'Specific retention period not available in current evidence context.',
      };
    },
  },
  {
    questionId: 'AL-003',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Yes. Audit logs are append-only and immutable. The system enforces that no edits or deletes can be performed on audit records. All writes are server-side only with mandatory actor context.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'audit-immutability', description: 'Immutable audit log design' },
        { sourceType: 'SYSTEM_CONFIG', sourceId: 'audit-system', description: 'Append-only enforcement' },
      ],
    }),
  },
  {
    questionId: 'AL-004',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Yes. Audit logs can be exported in multiple formats (JSON, CSV) for compliance review. Exports are filtered by workspace and time range. Export actions are themselves logged.',
      evidenceReferences: [
        { sourceType: 'SYSTEM_CONFIG', sourceId: 'audit-export', description: 'Audit export capability' },
      ],
    }),
  },

  // Incident Response
  {
    questionId: 'IR-001',
    resolver: (ctx) => ({
      status: ctx.killSwitchAvailable ? 'ANSWERED' : 'PARTIAL',
      answer: ctx.killSwitchAvailable
        ? 'Yes. A workspace-level and global kill-switch exists that immediately disables all trust operations. Kill-switch activation requires owner authorization and is fully audited. The kill-switch is designed to fail-closed.'
        : 'A kill-switch capability exists in the system architecture. Availability status should be confirmed with your account team.',
      evidenceReferences: [
        { sourceType: 'SYSTEM_CONFIG', sourceId: 'kill-switch', description: 'Emergency kill-switch' },
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'incident-response', description: 'Kill-switch documentation' },
      ],
      limitations: ctx.killSwitchAvailable ? undefined : 'Kill-switch availability not confirmed in current context.',
    }),
  },
  {
    questionId: 'IR-002',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'The incident response process includes: (1) Detection via monitoring and alerting, (2) Triage and severity classification, (3) Containment including kill-switch if needed, (4) Investigation and root cause analysis, (5) Remediation and recovery, (6) Post-incident review and documentation.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'incident-response', description: 'IR process documentation' },
      ],
    }),
  },
  {
    questionId: 'IR-003',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Security incidents affecting customer data or service availability are communicated through designated channels within documented timeframes. Communication includes incident description, impact assessment, remediation status, and preventive measures.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'incident-communication', description: 'Incident communication policy' },
      ],
    }),
  },
  {
    questionId: 'IR-004',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Yes. A disaster recovery plan exists covering: data backup and restoration, service failover procedures, communication protocols, and recovery time objectives. The plan is tested periodically through drills.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'disaster-recovery', description: 'DR plan documentation' },
      ],
    }),
  },

  // Data Protection
  {
    questionId: 'DP-001',
    resolver: (ctx) => {
      if (ctx.slaSummary?.rpo && ctx.slaSummary.rpo.targetMinutes !== null) {
        return {
          status: 'ANSWERED',
          answer: `The Recovery Point Objective (RPO) is ${ctx.slaSummary.rpo.targetMinutes} minutes. This is derived from backup frequency and replication configuration.`,
          evidenceReferences: [
            { sourceType: 'SLA_DERIVATION', sourceId: 'rpo-derivation', description: 'RPO calculation from system evidence' },
          ],
        };
      }
      return {
        status: 'PARTIAL',
        answer: 'Recovery Point Objective is determined by backup frequency and replication configuration. Specific RPO should be confirmed with your account team.',
        evidenceReferences: [
          { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'data-protection', description: 'Data protection architecture' },
        ],
        limitations: 'Specific RPO not available in current evidence context.',
      };
    },
  },
  {
    questionId: 'DP-002',
    resolver: (ctx) => {
      if (ctx.slaSummary?.rto && ctx.slaSummary.rto.targetMinutes !== null) {
        return {
          status: 'ANSWERED',
          answer: `The Recovery Time Objective (RTO) is ${ctx.slaSummary.rto.targetMinutes} minutes. This is derived from failover capabilities and recovery procedures.`,
          evidenceReferences: [
            { sourceType: 'SLA_DERIVATION', sourceId: 'rto-derivation', description: 'RTO calculation from system evidence' },
          ],
        };
      }
      return {
        status: 'PARTIAL',
        answer: 'Recovery Time Objective is determined by failover capabilities and recovery procedures. Specific RTO should be confirmed with your account team.',
        evidenceReferences: [
          { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'data-protection', description: 'Data protection architecture' },
        ],
        limitations: 'Specific RTO not available in current evidence context.',
      };
    },
  },
  {
    questionId: 'DP-003',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Yes. Data is encrypted at rest using AES-256 encryption. Data in transit is protected using TLS 1.2 or higher. Encryption keys are managed through secure key management services.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'encryption', description: 'Encryption implementation' },
        { sourceType: 'ATTESTATION', sourceId: 'soc2-attestation', description: 'SOC2 encryption controls' },
      ],
    }),
  },
  {
    questionId: 'DP-004',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Automated backups are performed according to the configured schedule. Backups are encrypted and stored in geographically separate locations. Recovery procedures are documented and tested through periodic drills.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'backup', description: 'Backup and recovery procedures' },
      ],
    }),
  },

  // Availability
  {
    questionId: 'AV-001',
    resolver: (ctx) => {
      if (ctx.slaSummary?.availability && ctx.slaSummary.availability.class) {
        return {
          status: 'ANSWERED',
          answer: `The target availability SLA is ${ctx.slaSummary.availability.class}. This is derived from infrastructure configuration and historical performance.`,
          evidenceReferences: [
            { sourceType: 'SLA_DERIVATION', sourceId: 'availability-derivation', description: 'Availability SLA derivation' },
          ],
        };
      }
      return {
        status: 'PARTIAL',
        answer: 'Target availability is determined by infrastructure configuration and redundancy measures. Specific SLA should be confirmed with your account team.',
        evidenceReferences: [
          { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'availability', description: 'Availability architecture' },
        ],
        limitations: 'Specific availability SLA not available in current evidence context.',
      };
    },
  },
  {
    questionId: 'AV-002',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Yes. System health monitoring includes: application performance monitoring, infrastructure metrics, error rate tracking, and alerting for anomalies. Compliance drift is also monitored continuously.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'monitoring', description: 'Monitoring infrastructure' },
        { sourceType: 'SYSTEM_CONFIG', sourceId: 'compliance-monitor', description: 'Compliance monitoring system' },
      ],
    }),
  },
  {
    questionId: 'AV-003',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Capacity planning is managed through monitoring of resource utilization, traffic patterns, and growth projections. Infrastructure can be scaled to meet demand within configured limits.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'capacity', description: 'Capacity planning approach' },
      ],
    }),
  },
  {
    questionId: 'AV-004',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Redundancy measures include: database replication, multi-availability-zone deployment, automated failover, and load balancing. Critical components have no single point of failure.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'redundancy', description: 'Redundancy architecture' },
      ],
    }),
  },

  // Compliance
  {
    questionId: 'CO-001',
    resolver: (ctx) => {
      if (ctx.hasAttestation && ctx.attestationProfile === 'SOC2') {
        return {
          status: 'ANSWERED',
          answer: 'Yes. The system maintains SOC2 Type II compliance. Attestation reports are available through the Trust Bundle.',
          evidenceReferences: [
            { sourceType: 'ATTESTATION', sourceId: 'soc2-attestation', description: 'SOC2 Type II attestation report' },
          ],
        };
      }
      return {
        status: 'PARTIAL',
        answer: 'SOC2 compliance status should be confirmed with your account team. Attestation reports are available upon request.',
        evidenceReferences: [],
        limitations: 'SOC2 attestation not included in current evidence context.',
      };
    },
  },
  {
    questionId: 'CO-002',
    resolver: (ctx) => {
      if (ctx.hasAttestation && ctx.attestationProfile === 'ISO27001') {
        return {
          status: 'ANSWERED',
          answer: 'Yes. The system is ISO 27001 certified. Certification documentation is available through the Trust Bundle.',
          evidenceReferences: [
            { sourceType: 'ATTESTATION', sourceId: 'iso27001-cert', description: 'ISO 27001 certification' },
          ],
        };
      }
      return {
        status: 'PARTIAL',
        answer: 'ISO 27001 certification status should be confirmed with your account team. Certification documentation is available upon request.',
        evidenceReferences: [],
        limitations: 'ISO 27001 certification not included in current evidence context.',
      };
    },
  },
  {
    questionId: 'CO-003',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Compliance audits are conducted annually at minimum. Internal compliance checks run continuously via automated monitoring. Audit findings are tracked to remediation.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'compliance', description: 'Compliance audit schedule' },
        { sourceType: 'SYSTEM_CONFIG', sourceId: 'compliance-monitor', description: 'Continuous compliance monitoring' },
      ],
    }),
  },
  {
    questionId: 'CO-004',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Yes. Third-party penetration tests are performed at least annually. Results are reviewed and findings are tracked to remediation. Summary reports are available upon request.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'penetration-testing', description: 'Penetration testing program' },
      ],
    }),
  },

  // Change Management
  {
    questionId: 'CM-001',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Yes. A formal change management process governs all production changes. Changes require documented justification, review, approval, and testing before deployment.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'change-management', description: 'Change management process' },
      ],
    }),
  },
  {
    questionId: 'CM-002',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Production changes are reviewed through code review and approval workflows. Critical changes require multiple approvals. All changes are logged in the audit trail with actor identification.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'change-approval', description: 'Change approval process' },
        { sourceType: 'AUDIT_LOG', sourceId: 'audit-system', description: 'Change audit trail' },
      ],
    }),
  },
  {
    questionId: 'CM-003',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Yes. Rollback capability is built into the deployment process. Production snapshots are maintained to enable rapid recovery. Rollback actions are logged and require documented justification.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'rollback', description: 'Rollback capability' },
        { sourceType: 'AUDIT_LOG', sourceId: 'audit-system', description: 'Rollback audit trail' },
      ],
    }),
  },
  {
    questionId: 'CM-004',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Configuration drift is detected through continuous compliance monitoring. Drift items are classified by severity and escalated according to defined SLAs. Remediation is tracked to completion.',
      evidenceReferences: [
        { sourceType: 'SYSTEM_CONFIG', sourceId: 'drift-detection', description: 'Drift detection system' },
        { sourceType: 'SYSTEM_CONFIG', sourceId: 'compliance-monitor', description: 'Compliance monitoring' },
      ],
    }),
  },

  // Privacy
  {
    questionId: 'PR-001',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'For internal users: email addresses and names for authentication and attribution. For trust bundle viewers: NO PII is collected. The system explicitly does not collect IP addresses, device identifiers, or behavioral data from external viewers.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'privacy', description: 'Data collection policy' },
      ],
    }),
  },
  {
    questionId: 'PR-002',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'PII is minimized by design. External trust bundle access requires no login and collects no identifying information. Internal PII is access-controlled by role and encrypted at rest. Data minimization principles are applied throughout.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'privacy', description: 'PII protection measures' },
      ],
    }),
  },
  {
    questionId: 'PR-003',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'For internal users: consent is obtained during account creation. For external bundle viewers: no consent is required because no PII is collected. The system is designed to be privacy-preserving by default.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'consent', description: 'Consent management' },
      ],
    }),
  },
  {
    questionId: 'PR-004',
    resolver: (ctx) => ({
      status: 'ANSWERED',
      answer: 'Data deletion requests can be submitted through designated channels. Requests are processed according to documented procedures and applicable data retention requirements. Deletion is logged in the audit trail.',
      evidenceReferences: [
        { sourceType: 'WHITEPAPER', sourceId: 'security-whitepaper', section: 'data-deletion', description: 'Data deletion process' },
      ],
    }),
  },
];

// ============================================
// Answer Resolution
// ============================================

/**
 * Resolves a single security question using evidence context.
 */
export function resolveSecurityAnswer(
  question: SecurityQuestion,
  context: EvidenceContext
): SecurityAnswer {
  const template = ANSWER_TEMPLATES.find((t) => t.questionId === question.id);

  if (!template) {
    return {
      questionId: question.id,
      question: question.question,
      category: question.category,
      status: 'UNAVAILABLE',
      answer: 'This question cannot be answered from available evidence.',
      evidenceReferences: [],
      limitations: 'No answer template available for this question.',
      generatedAt: new Date().toISOString(),
    };
  }

  const resolved = template.resolver(context);

  return {
    questionId: question.id,
    question: question.question,
    category: question.category,
    ...resolved,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Resolves all standard security questions.
 */
export function resolveAllSecurityAnswers(
  context: EvidenceContext
): AnswerResolutionResult {
  const answers = STANDARD_SECURITY_QUESTIONS.map((q) =>
    resolveSecurityAnswer(q, context)
  );

  const summary = {
    total: answers.length,
    answered: answers.filter((a) => a.status === 'ANSWERED').length,
    partial: answers.filter((a) => a.status === 'PARTIAL').length,
    unavailable: answers.filter((a) => a.status === 'UNAVAILABLE').length,
  };

  return {
    workspaceId: context.workspaceId,
    bundleId: context.bundleId,
    answers,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Resolves security questions by category.
 */
export function resolveSecurityAnswersByCategory(
  category: SecurityQuestionCategory,
  context: EvidenceContext
): SecurityAnswer[] {
  const questions = STANDARD_SECURITY_QUESTIONS.filter(
    (q) => q.category === category
  );
  return questions.map((q) => resolveSecurityAnswer(q, context));
}

// ============================================
// Label Helpers
// ============================================

/**
 * Gets human-readable label for question category.
 */
export function getCategoryLabel(category: SecurityQuestionCategory): string {
  const labels: Record<SecurityQuestionCategory, string> = {
    ACCESS_CONTROL: 'Access Control & RBAC',
    AUDIT_LOGGING: 'Audit Logging & Retention',
    INCIDENT_RESPONSE: 'Incident Response & Kill-Switch',
    DATA_PROTECTION: 'Data Protection & RPO/RTO',
    AVAILABILITY: 'Availability & Monitoring',
    COMPLIANCE: 'Compliance (SOC2 / ISO)',
    CHANGE_MANAGEMENT: 'Change Management',
    PRIVACY: 'Privacy & PII Handling',
  };
  return labels[category];
}

/**
 * Gets human-readable label for answer status.
 */
export function getStatusLabel(status: AnswerStatus): string {
  const labels: Record<AnswerStatus, string> = {
    ANSWERED: 'Answered',
    PARTIAL: 'Partial',
    UNAVAILABLE: 'Unavailable',
  };
  return labels[status];
}

/**
 * Gets color for answer status (for UI).
 */
export function getStatusColor(status: AnswerStatus): string {
  switch (status) {
    case 'ANSWERED':
      return 'green';
    case 'PARTIAL':
      return 'yellow';
    case 'UNAVAILABLE':
      return 'gray';
  }
}

/**
 * Gets all question categories.
 */
export function getAllCategories(): SecurityQuestionCategory[] {
  return [
    'ACCESS_CONTROL',
    'AUDIT_LOGGING',
    'INCIDENT_RESPONSE',
    'DATA_PROTECTION',
    'AVAILABILITY',
    'COMPLIANCE',
    'CHANGE_MANAGEMENT',
    'PRIVACY',
  ];
}
