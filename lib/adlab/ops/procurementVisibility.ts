// ============================================
// Procurement Visibility Model
// ============================================
// PHASE D44: Procurement & Security Response Layer.
//
// PURPOSE:
// Defines what procurement teams can see and verify,
// ensuring transparency about our data practices while
// maintaining privacy commitments.
//
// CORE PRINCIPLE:
// Show procurement teams everything they need to verify
// our privacy claims without exposing any data that would
// contradict those claims.
//
// INVARIANTS:
// - No PII exposure
// - No individual tracking data
// - Full audit trail visibility
// - Clear evidence chains
// ============================================

// ============================================
// Types
// ============================================

/**
 * Visibility levels for different data categories.
 */
export type VisibilityLevel =
  | 'FULL'        // Complete visibility
  | 'SUMMARY'     // Aggregated/summarized view
  | 'METADATA'    // Metadata only, no content
  | 'AUDIT_ONLY'  // Visible only in audit logs
  | 'NONE';       // Not visible (does not exist)

/**
 * Data categories in the system.
 */
export type DataCategory =
  | 'BUNDLE_CONTENT'
  | 'BUNDLE_METADATA'
  | 'ENGAGEMENT_METRICS'
  | 'VIEWER_IDENTITY'
  | 'VIEWER_BEHAVIOR'
  | 'SALES_SIGNALS'
  | 'AUDIT_LOGS'
  | 'WORKSPACE_CONFIG'
  | 'USER_ACCOUNTS'
  | 'ACCESS_TOKENS';

/**
 * Stakeholder types who may view data.
 */
export type Stakeholder =
  | 'BUYER_PROCUREMENT'
  | 'BUYER_SECURITY'
  | 'BUYER_LEGAL'
  | 'SELLER_SALES'
  | 'SELLER_ADMIN'
  | 'SELLER_COMPLIANCE'
  | 'EXTERNAL_AUDITOR';

/**
 * Visibility rule for a data category.
 */
export interface VisibilityRule {
  /** Data category */
  category: DataCategory;
  /** Category label */
  categoryLabel: string;
  /** Description of what this category contains */
  description: string;
  /** Visibility by stakeholder */
  visibilityByStakeholder: Record<Stakeholder, VisibilityLevel>;
  /** What can be seen at each visibility level */
  levelDescriptions: Partial<Record<VisibilityLevel, string>>;
  /** Evidence that supports this visibility claim */
  evidenceReference: string;
}

/**
 * Visibility matrix for procurement review.
 */
export interface VisibilityMatrix {
  /** Matrix metadata */
  metadata: {
    matrixId: string;
    generatedAt: string;
    version: string;
  };
  /** Visibility rules */
  rules: VisibilityRule[];
  /** Summary statement */
  summaryStatement: string;
  /** Verification process */
  verificationProcess: string;
}

/**
 * Stakeholder visibility summary.
 */
export interface StakeholderVisibilitySummary {
  stakeholder: Stakeholder;
  stakeholderLabel: string;
  description: string;
  fullAccess: DataCategory[];
  summaryAccess: DataCategory[];
  metadataAccess: DataCategory[];
  auditOnlyAccess: DataCategory[];
  noAccess: DataCategory[];
}

/**
 * Evidence package for procurement verification.
 */
export interface ProcurementEvidencePackage {
  /** Package metadata */
  metadata: {
    packageId: string;
    workspaceId: string;
    generatedAt: string;
    requestedBy: string;
  };
  /** Visibility matrix */
  visibilityMatrix: VisibilityMatrix;
  /** What data exists */
  dataInventory: DataInventoryItem[];
  /** What data does NOT exist */
  nonExistentData: NonExistentDataItem[];
  /** Verification instructions */
  verificationInstructions: VerificationInstruction[];
}

/**
 * Item in data inventory.
 */
export interface DataInventoryItem {
  category: DataCategory;
  dataType: string;
  description: string;
  retentionPeriod: string;
  deletionProcess: string;
  accessControls: string;
}

/**
 * Documentation of data that does not exist.
 */
export interface NonExistentDataItem {
  dataType: string;
  description: string;
  whyItDoesNotExist: string;
  verificationMethod: string;
}

/**
 * Verification instruction for procurement.
 */
export interface VerificationInstruction {
  claim: string;
  verificationMethod: string;
  expectedResult: string;
  contactForAssistance: string;
}

// ============================================
// Constants
// ============================================

/**
 * Stakeholder labels.
 */
const STAKEHOLDER_LABELS: Record<Stakeholder, string> = {
  BUYER_PROCUREMENT: 'Buyer Procurement Team',
  BUYER_SECURITY: 'Buyer Security Team',
  BUYER_LEGAL: 'Buyer Legal/Privacy Team',
  SELLER_SALES: 'Seller Sales Team',
  SELLER_ADMIN: 'Seller Workspace Admin',
  SELLER_COMPLIANCE: 'Seller Compliance Team',
  EXTERNAL_AUDITOR: 'External Auditor',
};

/**
 * Stakeholder descriptions.
 */
const STAKEHOLDER_DESCRIPTIONS: Record<Stakeholder, string> = {
  BUYER_PROCUREMENT:
    'Evaluating vendor for purchase decision; needs to verify security posture',
  BUYER_SECURITY:
    'Conducting security review; needs to verify data handling and controls',
  BUYER_LEGAL:
    'Reviewing privacy and compliance; needs to verify data practices',
  SELLER_SALES:
    'Managing sales process; receives advisory signals only',
  SELLER_ADMIN:
    'Managing workspace configuration and user access',
  SELLER_COMPLIANCE:
    'Ensuring internal compliance; needs full audit visibility',
  EXTERNAL_AUDITOR:
    'Conducting independent audit; needs verifiable evidence',
};

/**
 * Category labels.
 */
const CATEGORY_LABELS: Record<DataCategory, string> = {
  BUNDLE_CONTENT: 'Bundle Content',
  BUNDLE_METADATA: 'Bundle Metadata',
  ENGAGEMENT_METRICS: 'Engagement Metrics',
  VIEWER_IDENTITY: 'Viewer Identity',
  VIEWER_BEHAVIOR: 'Viewer Behavior',
  SALES_SIGNALS: 'Sales Signals',
  AUDIT_LOGS: 'Audit Logs',
  WORKSPACE_CONFIG: 'Workspace Configuration',
  USER_ACCOUNTS: 'User Accounts',
  ACCESS_TOKENS: 'Access Tokens',
};

/**
 * Visibility level labels.
 */
const VISIBILITY_LABELS: Record<VisibilityLevel, string> = {
  FULL: 'Full Access',
  SUMMARY: 'Summary Only',
  METADATA: 'Metadata Only',
  AUDIT_ONLY: 'Audit Trail Only',
  NONE: 'Not Available',
};

// ============================================
// Standard Visibility Rules
// ============================================

/**
 * Standard visibility rules for the Trust Bundles system.
 */
const STANDARD_VISIBILITY_RULES: VisibilityRule[] = [
  {
    category: 'BUNDLE_CONTENT',
    categoryLabel: 'Bundle Content',
    description:
      'The actual security documentation, attestations, and questionnaire responses in a bundle',
    visibilityByStakeholder: {
      BUYER_PROCUREMENT: 'FULL',
      BUYER_SECURITY: 'FULL',
      BUYER_LEGAL: 'FULL',
      SELLER_SALES: 'FULL',
      SELLER_ADMIN: 'FULL',
      SELLER_COMPLIANCE: 'FULL',
      EXTERNAL_AUDITOR: 'FULL',
    },
    levelDescriptions: {
      FULL: 'All bundle content is visible to authorized parties',
    },
    evidenceReference: 'Bundle access tokens grant full content visibility',
  },
  {
    category: 'BUNDLE_METADATA',
    categoryLabel: 'Bundle Metadata',
    description:
      'Bundle creation date, expiration date, label, and status',
    visibilityByStakeholder: {
      BUYER_PROCUREMENT: 'METADATA',
      BUYER_SECURITY: 'METADATA',
      BUYER_LEGAL: 'METADATA',
      SELLER_SALES: 'FULL',
      SELLER_ADMIN: 'FULL',
      SELLER_COMPLIANCE: 'FULL',
      EXTERNAL_AUDITOR: 'FULL',
    },
    levelDescriptions: {
      FULL: 'All metadata including internal labels and configuration',
      METADATA: 'Expiration date and bundle structure only',
    },
    evidenceReference: 'API documentation shows metadata endpoints',
  },
  {
    category: 'ENGAGEMENT_METRICS',
    categoryLabel: 'Engagement Metrics',
    description:
      'Aggregate view counts, section distribution, export counts',
    visibilityByStakeholder: {
      BUYER_PROCUREMENT: 'NONE',
      BUYER_SECURITY: 'NONE',
      BUYER_LEGAL: 'NONE',
      SELLER_SALES: 'SUMMARY',
      SELLER_ADMIN: 'SUMMARY',
      SELLER_COMPLIANCE: 'FULL',
      EXTERNAL_AUDITOR: 'FULL',
    },
    levelDescriptions: {
      FULL: 'Complete aggregate metrics with timestamps',
      SUMMARY: 'High-level engagement indicators only',
      NONE: 'Buyers cannot see engagement data about their own viewing',
    },
    evidenceReference: 'Engagement API returns aggregates only; no PII',
  },
  {
    category: 'VIEWER_IDENTITY',
    categoryLabel: 'Viewer Identity',
    description:
      'Names, emails, IP addresses, or other identifying information about who viewed bundles',
    visibilityByStakeholder: {
      BUYER_PROCUREMENT: 'NONE',
      BUYER_SECURITY: 'NONE',
      BUYER_LEGAL: 'NONE',
      SELLER_SALES: 'NONE',
      SELLER_ADMIN: 'NONE',
      SELLER_COMPLIANCE: 'NONE',
      EXTERNAL_AUDITOR: 'NONE',
    },
    levelDescriptions: {
      NONE: 'This data does not exist in the system. No viewer identity is collected.',
    },
    evidenceReference:
      'Database schema audit shows no viewer identity tables; network inspection shows no identity transmission',
  },
  {
    category: 'VIEWER_BEHAVIOR',
    categoryLabel: 'Viewer Behavior',
    description:
      'Individual click patterns, time on page, scroll depth, navigation paths',
    visibilityByStakeholder: {
      BUYER_PROCUREMENT: 'NONE',
      BUYER_SECURITY: 'NONE',
      BUYER_LEGAL: 'NONE',
      SELLER_SALES: 'NONE',
      SELLER_ADMIN: 'NONE',
      SELLER_COMPLIANCE: 'NONE',
      EXTERNAL_AUDITOR: 'NONE',
    },
    levelDescriptions: {
      NONE: 'This data does not exist in the system. No individual behavioral tracking is performed.',
    },
    evidenceReference:
      'No client-side tracking code deployed; no behavioral data tables in schema',
  },
  {
    category: 'SALES_SIGNALS',
    categoryLabel: 'Sales Signals',
    description:
      'Advisory signals derived from aggregate patterns (e.g., "Active Evaluation")',
    visibilityByStakeholder: {
      BUYER_PROCUREMENT: 'NONE',
      BUYER_SECURITY: 'NONE',
      BUYER_LEGAL: 'NONE',
      SELLER_SALES: 'SUMMARY',
      SELLER_ADMIN: 'FULL',
      SELLER_COMPLIANCE: 'FULL',
      EXTERNAL_AUDITOR: 'FULL',
    },
    levelDescriptions: {
      FULL: 'All signal data with derivation methodology',
      SUMMARY: 'Signal names and recommended actions only',
      NONE: 'Buyers do not see internal sales signals',
    },
    evidenceReference: 'Signal API documentation shows advisory-only outputs',
  },
  {
    category: 'AUDIT_LOGS',
    categoryLabel: 'Audit Logs',
    description:
      'Complete audit trail of all administrative actions',
    visibilityByStakeholder: {
      BUYER_PROCUREMENT: 'NONE',
      BUYER_SECURITY: 'AUDIT_ONLY',
      BUYER_LEGAL: 'AUDIT_ONLY',
      SELLER_SALES: 'NONE',
      SELLER_ADMIN: 'FULL',
      SELLER_COMPLIANCE: 'FULL',
      EXTERNAL_AUDITOR: 'FULL',
    },
    levelDescriptions: {
      FULL: 'Complete audit logs with all administrative actions',
      AUDIT_ONLY: 'Summary of audit capabilities and sample logs upon request',
      NONE: 'No access to seller audit logs',
    },
    evidenceReference: 'Audit export endpoint available to admin/compliance roles',
  },
  {
    category: 'WORKSPACE_CONFIG',
    categoryLabel: 'Workspace Configuration',
    description:
      'Workspace settings, retention policies, feature flags',
    visibilityByStakeholder: {
      BUYER_PROCUREMENT: 'NONE',
      BUYER_SECURITY: 'METADATA',
      BUYER_LEGAL: 'METADATA',
      SELLER_SALES: 'NONE',
      SELLER_ADMIN: 'FULL',
      SELLER_COMPLIANCE: 'FULL',
      EXTERNAL_AUDITOR: 'FULL',
    },
    levelDescriptions: {
      FULL: 'Complete workspace configuration',
      METADATA: 'Relevant security settings only (e.g., retention periods)',
      NONE: 'No access to seller workspace configuration',
    },
    evidenceReference: 'Configuration API restricted to admin roles',
  },
  {
    category: 'USER_ACCOUNTS',
    categoryLabel: 'User Accounts',
    description:
      'Internal workspace user accounts and roles',
    visibilityByStakeholder: {
      BUYER_PROCUREMENT: 'NONE',
      BUYER_SECURITY: 'NONE',
      BUYER_LEGAL: 'NONE',
      SELLER_SALES: 'METADATA',
      SELLER_ADMIN: 'FULL',
      SELLER_COMPLIANCE: 'FULL',
      EXTERNAL_AUDITOR: 'METADATA',
    },
    levelDescriptions: {
      FULL: 'Complete user account management',
      METADATA: 'Role counts and access patterns only',
      NONE: 'No access to seller internal accounts',
    },
    evidenceReference: 'User management API restricted to owner/admin roles',
  },
  {
    category: 'ACCESS_TOKENS',
    categoryLabel: 'Access Tokens',
    description:
      'Bundle access tokens and their status',
    visibilityByStakeholder: {
      BUYER_PROCUREMENT: 'NONE',
      BUYER_SECURITY: 'NONE',
      BUYER_LEGAL: 'NONE',
      SELLER_SALES: 'METADATA',
      SELLER_ADMIN: 'FULL',
      SELLER_COMPLIANCE: 'FULL',
      EXTERNAL_AUDITOR: 'METADATA',
    },
    levelDescriptions: {
      FULL: 'Token management including creation and revocation',
      METADATA: 'Token existence and expiration status only',
      NONE: 'No access to raw token values',
    },
    evidenceReference: 'Token values never exposed via API; only metadata available',
  },
];

/**
 * Data that does not exist in the system.
 */
const NON_EXISTENT_DATA: NonExistentDataItem[] = [
  {
    dataType: 'Viewer Email Addresses',
    description: 'Email addresses of people who view bundles',
    whyItDoesNotExist:
      'Bundle access uses bearer tokens with no identity requirement. No login or account needed.',
    verificationMethod:
      'Access a bundle and inspect network traffic; no email transmitted',
  },
  {
    dataType: 'Viewer IP Addresses',
    description: 'IP addresses of bundle viewers',
    whyItDoesNotExist:
      'IP addresses are not logged for bundle access events. Only aggregate counters increment.',
    verificationMethod: 'Review database schema; no IP address columns in engagement tables',
  },
  {
    dataType: 'Viewer Browser Fingerprints',
    description: 'Browser fingerprints or device identifiers',
    whyItDoesNotExist:
      'No fingerprinting code is deployed. No localStorage, cookies, or canvas fingerprinting.',
    verificationMethod:
      'Inspect bundle page source; no fingerprinting libraries present',
  },
  {
    dataType: 'Individual Session Recordings',
    description: 'Recordings of individual viewer sessions',
    whyItDoesNotExist:
      'No session recording tools are deployed. No third-party analytics.',
    verificationMethod: 'Network inspection shows no calls to recording services',
  },
  {
    dataType: 'Click Stream Data',
    description: 'Individual click patterns and navigation paths',
    whyItDoesNotExist:
      'No click tracking code deployed. Only section-level aggregate counters exist.',
    verificationMethod: 'Code audit shows no click event listeners for tracking',
  },
  {
    dataType: 'Time-on-Page Data (Individual)',
    description: 'How long specific individuals spent viewing',
    whyItDoesNotExist:
      'No timing instrumentation for individuals. Cannot distinguish viewers.',
    verificationMethod: 'Database has no individual timing records',
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Generates a unique package ID.
 */
function generatePackageId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `PVM-${timestamp}-${random}`.toUpperCase();
}

/**
 * Generates a unique matrix ID.
 */
function generateMatrixId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `VMX-${timestamp}-${random}`.toUpperCase();
}

// ============================================
// Public API
// ============================================

/**
 * Generates the visibility matrix.
 *
 * @returns Complete visibility matrix
 */
export function generateVisibilityMatrix(): VisibilityMatrix {
  return {
    metadata: {
      matrixId: generateMatrixId(),
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
    rules: STANDARD_VISIBILITY_RULES,
    summaryStatement: `This visibility matrix documents what each stakeholder type can see in the Trust Bundles system. Key points: (1) Viewer identity data does not exist—no one can see it because it is never collected. (2) Viewer behavior data does not exist—no individual tracking is performed. (3) Sales teams see advisory signals only, never raw engagement data. (4) Buyers cannot see engagement data about their own viewing. (5) Full audit trails are available for compliance verification.`,
    verificationProcess: `To verify this visibility matrix:

1. REQUEST ACCESS DEMONSTRATION: Ask for a live demonstration showing what each role can access.

2. REVIEW API DOCUMENTATION: Our API documentation specifies exactly what data each endpoint returns.

3. CONDUCT DATABASE AUDIT: Request a database schema review to verify what data structures exist.

4. PERFORM NETWORK INSPECTION: Use browser developer tools during bundle access to verify no tracking calls.

5. REQUEST SOC 2 REPORT: Our SOC 2 Type II report provides third-party attestation of these controls.`,
  };
}

/**
 * Gets visibility summary for a specific stakeholder.
 *
 * @param stakeholder - Stakeholder type
 * @returns Visibility summary
 */
export function getStakeholderVisibility(
  stakeholder: Stakeholder
): StakeholderVisibilitySummary {
  const rules = STANDARD_VISIBILITY_RULES;

  return {
    stakeholder,
    stakeholderLabel: STAKEHOLDER_LABELS[stakeholder],
    description: STAKEHOLDER_DESCRIPTIONS[stakeholder],
    fullAccess: rules
      .filter((r) => r.visibilityByStakeholder[stakeholder] === 'FULL')
      .map((r) => r.category),
    summaryAccess: rules
      .filter((r) => r.visibilityByStakeholder[stakeholder] === 'SUMMARY')
      .map((r) => r.category),
    metadataAccess: rules
      .filter((r) => r.visibilityByStakeholder[stakeholder] === 'METADATA')
      .map((r) => r.category),
    auditOnlyAccess: rules
      .filter((r) => r.visibilityByStakeholder[stakeholder] === 'AUDIT_ONLY')
      .map((r) => r.category),
    noAccess: rules
      .filter((r) => r.visibilityByStakeholder[stakeholder] === 'NONE')
      .map((r) => r.category),
  };
}

/**
 * Generates complete procurement evidence package.
 *
 * @param workspaceId - Workspace generating the package
 * @param requestedBy - Who requested the package
 * @returns Complete evidence package
 */
export function generateProcurementEvidencePackage(
  workspaceId: string,
  requestedBy: string
): ProcurementEvidencePackage {
  const visibilityMatrix = generateVisibilityMatrix();

  const dataInventory: DataInventoryItem[] = [
    {
      category: 'BUNDLE_CONTENT',
      dataType: 'Security Documentation',
      description: 'Attestations, questionnaires, whitepapers, and summaries',
      retentionPeriod: 'Until bundle expiration or deletion',
      deletionProcess: 'Automatic on expiration; manual via revocation',
      accessControls: 'Bearer token with expiration',
    },
    {
      category: 'BUNDLE_METADATA',
      dataType: 'Bundle Configuration',
      description: 'Creation date, expiration, labels, status',
      retentionPeriod: 'Configurable retention period (30 days to indefinite)',
      deletionProcess: 'Cascading delete with workspace closure',
      accessControls: 'Workspace role-based access',
    },
    {
      category: 'ENGAGEMENT_METRICS',
      dataType: 'Aggregate Counters',
      description: 'Total views, section distribution, export counts',
      retentionPeriod: 'Same as bundle metadata',
      deletionProcess: 'Cascading delete with bundle deletion',
      accessControls: 'Workspace admin/compliance roles only',
    },
    {
      category: 'AUDIT_LOGS',
      dataType: 'Administrative Actions',
      description: 'All admin actions with actor, timestamp, and details',
      retentionPeriod: 'Configurable (default 1 year)',
      deletionProcess: 'Automatic aging based on retention policy',
      accessControls: 'Workspace owner/compliance roles; immutable append-only',
    },
  ];

  const verificationInstructions: VerificationInstruction[] = [
    {
      claim: 'No viewer identity is collected',
      verificationMethod:
        'Access a bundle while monitoring network traffic with browser dev tools',
      expectedResult:
        'No requests containing email, name, or other PII; no cookies set',
      contactForAssistance: 'security@[company].com',
    },
    {
      claim: 'No individual behavioral tracking',
      verificationMethod:
        'Review page source and network requests during bundle navigation',
      expectedResult:
        'No tracking pixels, no analytics calls, no click stream transmission',
      contactForAssistance: 'security@[company].com',
    },
    {
      claim: 'Sales signals are aggregate-derived only',
      verificationMethod:
        'Request API documentation for signal generation endpoints',
      expectedResult:
        'Documentation shows signals derived from aggregate counts, not individual data',
      contactForAssistance: 'security@[company].com',
    },
    {
      claim: 'Full audit trail maintained',
      verificationMethod: 'Request sample audit log export',
      expectedResult:
        'Logs show all administrative actions with timestamps and actors',
      contactForAssistance: 'compliance@[company].com',
    },
    {
      claim: 'Data deletion on workspace closure',
      verificationMethod: 'Request deletion certification documentation',
      expectedResult:
        'Documentation shows cascading delete process with verification',
      contactForAssistance: 'compliance@[company].com',
    },
  ];

  return {
    metadata: {
      packageId: generatePackageId(),
      workspaceId,
      generatedAt: new Date().toISOString(),
      requestedBy,
    },
    visibilityMatrix,
    dataInventory,
    nonExistentData: NON_EXISTENT_DATA,
    verificationInstructions,
  };
}

/**
 * Exports visibility matrix to Markdown.
 *
 * @param matrix - Visibility matrix
 * @returns Markdown string
 */
export function exportVisibilityMatrixMarkdown(matrix: VisibilityMatrix): string {
  const lines: string[] = [];

  // Header
  lines.push('# Data Visibility Matrix');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(matrix.summaryStatement);
  lines.push('');

  // Main Matrix Table
  lines.push('## Visibility by Stakeholder');
  lines.push('');

  // Build header row
  const stakeholders = Object.keys(STAKEHOLDER_LABELS) as Stakeholder[];
  const headerRow = ['Data Category', ...stakeholders.map((s) => STAKEHOLDER_LABELS[s])];
  lines.push('| ' + headerRow.join(' | ') + ' |');
  lines.push('|' + headerRow.map(() => '---').join('|') + '|');

  // Data rows
  for (const rule of matrix.rules) {
    const row = [
      rule.categoryLabel,
      ...stakeholders.map((s) => {
        const level = rule.visibilityByStakeholder[s];
        return VISIBILITY_LABELS[level];
      }),
    ];
    lines.push('| ' + row.join(' | ') + ' |');
  }

  lines.push('');

  // Detailed Rules
  lines.push('## Detailed Visibility Rules');
  lines.push('');

  for (const rule of matrix.rules) {
    lines.push(`### ${rule.categoryLabel}`);
    lines.push('');
    lines.push(rule.description);
    lines.push('');

    if (Object.keys(rule.levelDescriptions).length > 0) {
      lines.push('**Visibility Levels:**');
      for (const [level, desc] of Object.entries(rule.levelDescriptions)) {
        lines.push(`- **${VISIBILITY_LABELS[level as VisibilityLevel]}:** ${desc}`);
      }
      lines.push('');
    }

    lines.push(`**Evidence:** ${rule.evidenceReference}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Verification
  lines.push('## Verification Process');
  lines.push('');
  lines.push(matrix.verificationProcess);
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Generated: ${matrix.metadata.generatedAt}*`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Gets label for visibility level.
 */
export function getVisibilityLabel(level: VisibilityLevel): string {
  return VISIBILITY_LABELS[level];
}

/**
 * Gets label for stakeholder.
 */
export function getStakeholderLabel(stakeholder: Stakeholder): string {
  return STAKEHOLDER_LABELS[stakeholder];
}

/**
 * Gets label for data category.
 */
export function getCategoryLabel(category: DataCategory): string {
  return CATEGORY_LABELS[category];
}

// ============================================
// Re-exports
// ============================================

export {
  STAKEHOLDER_LABELS,
  STAKEHOLDER_DESCRIPTIONS,
  CATEGORY_LABELS,
  VISIBILITY_LABELS,
  NON_EXISTENT_DATA,
};
