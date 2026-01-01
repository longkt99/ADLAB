// ============================================
// Boundary Sheet Generator
// ============================================
// PHASE D44: Procurement & Security Response Layer.
//
// PURPOSE:
// Generates clear, honest boundary documentation that
// explains system capabilities and limitations. Designed
// to satisfy procurement teams who need explicit scope
// documentation.
//
// BOUNDARY CATEGORIES:
// - IN_SCOPE: System provides this capability
// - OUT_OF_SCOPE: System does not provide this
// - PARTIAL: Limited or conditional capability
// - ROADMAP: Planned but not yet available
//
// INVARIANTS:
// - Honesty over salesmanship
// - Clear capability boundaries
// - No misleading implications
// - Explicit limitation acknowledgment
// ============================================

// ============================================
// Types
// ============================================

/**
 * Boundary status for a capability.
 */
export type BoundaryStatus =
  | 'IN_SCOPE'
  | 'OUT_OF_SCOPE'
  | 'PARTIAL'
  | 'ROADMAP';

/**
 * Boundary categories for organization.
 */
export type BoundaryCategory =
  | 'DATA_COLLECTION'
  | 'TRACKING_BEHAVIOR'
  | 'AUTOMATION'
  | 'INTEGRATIONS'
  | 'COMPLIANCE'
  | 'ACCESS_CONTROL'
  | 'DATA_RETENTION'
  | 'EXPORT_CAPABILITIES';

/**
 * Individual boundary item.
 */
export interface BoundaryItem {
  /** Unique identifier */
  id: string;
  /** Category */
  category: BoundaryCategory;
  /** Capability or feature name */
  capability: string;
  /** Current status */
  status: BoundaryStatus;
  /** Human-readable explanation */
  explanation: string;
  /** What we DO provide (if partial/in-scope) */
  whatWeProvide: string | null;
  /** What we DO NOT provide (if partial/out-of-scope) */
  whatWeDoNotProvide: string | null;
  /** Technical reason for limitation (if applicable) */
  technicalReason: string | null;
  /** Verification method */
  verificationMethod: string | null;
}

/**
 * Category summary in boundary sheet.
 */
export interface BoundaryCategorySummary {
  category: BoundaryCategory;
  categoryLabel: string;
  description: string;
  inScope: number;
  outOfScope: number;
  partial: number;
  roadmap: number;
}

/**
 * Complete boundary sheet.
 */
export interface BoundarySheet {
  /** Sheet metadata */
  metadata: {
    sheetId: string;
    workspaceId: string;
    generatedAt: string;
    version: string;
  };
  /** Executive summary */
  executiveSummary: string;
  /** Core trust statement */
  trustStatement: string;
  /** Category summaries */
  categorySummaries: BoundaryCategorySummary[];
  /** All boundary items */
  items: BoundaryItem[];
  /** Verification instructions */
  verificationInstructions: string;
}

// ============================================
// Constants
// ============================================

/**
 * Category labels and descriptions.
 */
const CATEGORY_INFO: Record<
  BoundaryCategory,
  { label: string; description: string }
> = {
  DATA_COLLECTION: {
    label: 'Data Collection',
    description: 'What data the system collects and does not collect',
  },
  TRACKING_BEHAVIOR: {
    label: 'Tracking & Behavioral Analysis',
    description: 'How the system handles user activity and behavioral data',
  },
  AUTOMATION: {
    label: 'Automation & Triggers',
    description: 'What the system can and cannot automate',
  },
  INTEGRATIONS: {
    label: 'Integrations & External Systems',
    description: 'How the system connects with external services',
  },
  COMPLIANCE: {
    label: 'Compliance & Certifications',
    description: 'Regulatory and certification status',
  },
  ACCESS_CONTROL: {
    label: 'Access Control & Permissions',
    description: 'How access and permissions are managed',
  },
  DATA_RETENTION: {
    label: 'Data Retention & Deletion',
    description: 'How data is stored and removed',
  },
  EXPORT_CAPABILITIES: {
    label: 'Export & Portability',
    description: 'Data export and portability features',
  },
};

/**
 * Status labels.
 */
const STATUS_LABELS: Record<BoundaryStatus, string> = {
  IN_SCOPE: 'Supported',
  OUT_OF_SCOPE: 'Not Supported',
  PARTIAL: 'Partially Supported',
  ROADMAP: 'Planned',
};

/**
 * Status colors for UI.
 */
const STATUS_COLORS: Record<BoundaryStatus, string> = {
  IN_SCOPE: 'green',
  OUT_OF_SCOPE: 'gray',
  PARTIAL: 'yellow',
  ROADMAP: 'blue',
};

// ============================================
// Standard Boundary Items
// ============================================

/**
 * Standard boundary items for Trust Bundles product.
 * These represent the honest, documented capabilities and limitations.
 */
const STANDARD_BOUNDARY_ITEMS: Omit<BoundaryItem, 'id'>[] = [
  // DATA_COLLECTION
  {
    category: 'DATA_COLLECTION',
    capability: 'Individual Viewer Identity Collection',
    status: 'OUT_OF_SCOPE',
    explanation:
      'The system does not collect names, emails, or any personally identifiable information from bundle viewers.',
    whatWeProvide: null,
    whatWeDoNotProvide:
      'Names, email addresses, IP addresses, user agents, device fingerprints, or any other PII',
    technicalReason:
      'Bundle access uses bearer tokens with no identity binding. No login or account creation required.',
    verificationMethod: 'Review network traffic during bundle access; no identity data transmitted',
  },
  {
    category: 'DATA_COLLECTION',
    capability: 'Aggregate View Counts',
    status: 'IN_SCOPE',
    explanation:
      'The system tracks total view counts at the bundle level without individual attribution.',
    whatWeProvide: 'Total number of times a bundle has been accessed',
    whatWeDoNotProvide: 'Who viewed, when specifically, or from where',
    technicalReason: 'Counter increments without storing viewer context',
    verificationMethod: 'Audit log review shows only aggregate counts',
  },
  {
    category: 'DATA_COLLECTION',
    capability: 'Section Engagement Distribution',
    status: 'IN_SCOPE',
    explanation:
      'The system tracks which sections of bundles are accessed in aggregate.',
    whatWeProvide: 'Distribution of access across bundle sections',
    whatWeDoNotProvide: 'Individual viewer section navigation or time spent',
    technicalReason: 'Section counters increment without viewer attribution',
    verificationMethod: 'API response shows only section-level aggregates',
  },
  {
    category: 'DATA_COLLECTION',
    capability: 'Cookie or Tracking Pixel Deployment',
    status: 'OUT_OF_SCOPE',
    explanation: 'No cookies, tracking pixels, or third-party analytics are used.',
    whatWeProvide: null,
    whatWeDoNotProvide: 'Cookies, pixels, localStorage tracking, or browser fingerprinting',
    technicalReason: 'Architectural decision: no client-side tracking code deployed',
    verificationMethod: 'Browser developer tools inspection during bundle access',
  },

  // TRACKING_BEHAVIOR
  {
    category: 'TRACKING_BEHAVIOR',
    capability: 'Individual Behavior Profiling',
    status: 'OUT_OF_SCOPE',
    explanation:
      'The system cannot and does not build behavioral profiles of individual viewers.',
    whatWeProvide: null,
    whatWeDoNotProvide:
      'Click patterns, scroll depth, time on page, navigation paths, or any individual behavioral data',
    technicalReason: 'No viewer session tracking; all metrics are aggregate-only',
    verificationMethod: 'Database schema review shows no individual viewer records',
  },
  {
    category: 'TRACKING_BEHAVIOR',
    capability: 'Deal Stage Signal Generation',
    status: 'IN_SCOPE',
    explanation:
      'The system generates advisory signals about deal stages based on aggregate patterns.',
    whatWeProvide:
      'Probabilistic signals like "Active Evaluation" or "Procurement Likely" based on aggregate engagement',
    whatWeDoNotProvide: 'Predictions about specific individuals or guaranteed outcomes',
    technicalReason: 'Signals derived from aggregate metrics, not individual tracking',
    verificationMethod: 'Signal documentation shows aggregate-only derivation',
  },
  {
    category: 'TRACKING_BEHAVIOR',
    capability: 'Real-time Viewing Notifications',
    status: 'OUT_OF_SCOPE',
    explanation:
      'The system does not notify sales when someone is currently viewing a bundle.',
    whatWeProvide: null,
    whatWeDoNotProvide: 'Live viewing alerts, "someone is on your page" notifications',
    technicalReason: 'No real-time tracking infrastructure exists',
    verificationMethod: 'No webhook or notification endpoints for viewing events',
  },

  // AUTOMATION
  {
    category: 'AUTOMATION',
    capability: 'Automated Outreach Based on Signals',
    status: 'OUT_OF_SCOPE',
    explanation:
      'The system cannot trigger automated emails, calls, or any buyer-facing communication.',
    whatWeProvide: null,
    whatWeDoNotProvide:
      'Auto-emails, triggered workflows, automated follow-ups, or any automated buyer contact',
    technicalReason:
      'Architectural invariant: doNotAutomate=true on all signal outputs; no integration points for automation',
    verificationMethod: 'Code audit shows no automation triggers; all signals are advisory-only',
  },
  {
    category: 'AUTOMATION',
    capability: 'CRM Integration for Deal Updates',
    status: 'OUT_OF_SCOPE',
    explanation: 'The system does not integrate with CRM systems to update deal stages.',
    whatWeProvide: null,
    whatWeDoNotProvide: 'Salesforce, HubSpot, or other CRM integrations',
    technicalReason: 'Not a CRM product; designed for trust documentation only',
    verificationMethod: 'No CRM integration endpoints in API documentation',
  },
  {
    category: 'AUTOMATION',
    capability: 'Bundle Expiration Enforcement',
    status: 'IN_SCOPE',
    explanation: 'Bundles automatically expire and become inaccessible after their expiration date.',
    whatWeProvide: 'Automatic access revocation at expiration time',
    whatWeDoNotProvide: null,
    technicalReason: 'Token validation checks expiration timestamp on every access',
    verificationMethod: 'Attempt access after expiration returns 401/403',
  },

  // INTEGRATIONS
  {
    category: 'INTEGRATIONS',
    capability: 'Third-party Analytics Integration',
    status: 'OUT_OF_SCOPE',
    explanation:
      'The system does not integrate with Google Analytics, Mixpanel, or similar services.',
    whatWeProvide: null,
    whatWeDoNotProvide: 'Third-party analytics, tracking, or data sharing',
    technicalReason: 'Privacy-by-design: no third-party data transmission',
    verificationMethod: 'Network inspection shows no third-party requests',
  },
  {
    category: 'INTEGRATIONS',
    capability: 'SSO/SAML for Internal Users',
    status: 'PARTIAL',
    explanation:
      'SSO integration is available for internal workspace users, not for bundle viewers.',
    whatWeProvide: 'SSO integration for workspace members managing bundles',
    whatWeDoNotProvide: 'SSO for bundle viewers (they require no authentication)',
    technicalReason: 'Bundle viewers use bearer tokens; internal users use workspace auth',
    verificationMethod: 'SSO configuration available in workspace settings',
  },
  {
    category: 'INTEGRATIONS',
    capability: 'Webhook Notifications for Internal Events',
    status: 'PARTIAL',
    explanation:
      'Webhooks available for internal administrative events, not for viewer activity.',
    whatWeProvide: 'Webhooks for bundle creation, expiration, revocation',
    whatWeDoNotProvide: 'Webhooks for viewer access or engagement events',
    technicalReason: 'Internal events only; no viewer activity triggers',
    verificationMethod: 'Webhook documentation shows internal events only',
  },

  // COMPLIANCE
  {
    category: 'COMPLIANCE',
    capability: 'SOC 2 Type II Attestation',
    status: 'IN_SCOPE',
    explanation: 'SOC 2 Type II attestation is available and included in bundles.',
    whatWeProvide: 'Current SOC 2 Type II report with annual renewal',
    whatWeDoNotProvide: null,
    technicalReason: null,
    verificationMethod: 'Request attestation report via account representative',
  },
  {
    category: 'COMPLIANCE',
    capability: 'GDPR Compliance',
    status: 'IN_SCOPE',
    explanation:
      'The system is designed for GDPR compliance with privacy-by-design architecture.',
    whatWeProvide: 'Data minimization, no PII collection, deletion capabilities',
    whatWeDoNotProvide: null,
    technicalReason:
      'No personal data collected from viewers means minimal GDPR obligations for viewer data',
    verificationMethod: 'DPA and privacy documentation available',
  },
  {
    category: 'COMPLIANCE',
    capability: 'HIPAA Compliance',
    status: 'OUT_OF_SCOPE',
    explanation:
      'The system is not designed for healthcare data and is not HIPAA compliant.',
    whatWeProvide: null,
    whatWeDoNotProvide: 'HIPAA compliance, BAA agreements, PHI handling',
    technicalReason: 'Not designed for healthcare use cases',
    verificationMethod: 'Documentation explicitly states non-HIPAA status',
  },
  {
    category: 'COMPLIANCE',
    capability: 'FedRAMP Authorization',
    status: 'ROADMAP',
    explanation: 'FedRAMP authorization is on the product roadmap but not yet achieved.',
    whatWeProvide: null,
    whatWeDoNotProvide: 'Current FedRAMP authorization',
    technicalReason: 'Authorization process in progress',
    verificationMethod: 'Contact account representative for timeline',
  },

  // ACCESS_CONTROL
  {
    category: 'ACCESS_CONTROL',
    capability: 'Role-Based Access Control (RBAC)',
    status: 'IN_SCOPE',
    explanation:
      'Workspace access is controlled via owner/admin/member roles.',
    whatWeProvide: 'Granular role-based permissions for workspace management',
    whatWeDoNotProvide: null,
    technicalReason: 'RBAC enforced at API and UI layers',
    verificationMethod: 'Permission matrix available in documentation',
  },
  {
    category: 'ACCESS_CONTROL',
    capability: 'Bundle-level Access Control',
    status: 'IN_SCOPE',
    explanation:
      'Each bundle has unique, time-limited access tokens.',
    whatWeProvide: 'Per-bundle tokens with configurable expiration',
    whatWeDoNotProvide: null,
    technicalReason: 'Bearer token architecture with embedded expiration',
    verificationMethod: 'Token structure documented; expiration enforced',
  },
  {
    category: 'ACCESS_CONTROL',
    capability: 'Viewer Authentication Requirement',
    status: 'OUT_OF_SCOPE',
    explanation:
      'Bundle viewers are not required to authenticate or create accounts.',
    whatWeProvide: null,
    whatWeDoNotProvide:
      'Mandatory viewer login, account creation, or identity verification',
    technicalReason:
      'Design decision: frictionless access with privacy preservation',
    verificationMethod: 'Access bundle without login',
  },

  // DATA_RETENTION
  {
    category: 'DATA_RETENTION',
    capability: 'Configurable Retention Periods',
    status: 'IN_SCOPE',
    explanation:
      'Workspace owners can configure data retention periods for audit logs.',
    whatWeProvide: 'Retention configuration from 30 days to indefinite',
    whatWeDoNotProvide: null,
    technicalReason: 'Retention policies applied to audit log tables',
    verificationMethod: 'Retention settings in workspace configuration',
  },
  {
    category: 'DATA_RETENTION',
    capability: 'Immediate Bundle Revocation',
    status: 'IN_SCOPE',
    explanation: 'Bundles can be revoked immediately, blocking all future access.',
    whatWeProvide: 'Instant revocation with audit trail',
    whatWeDoNotProvide: null,
    technicalReason: 'Revocation flag checked on every access attempt',
    verificationMethod: 'Revoke bundle, attempt access, verify 403 response',
  },
  {
    category: 'DATA_RETENTION',
    capability: 'Full Data Deletion on Workspace Close',
    status: 'IN_SCOPE',
    explanation:
      'When a workspace is closed, all associated data is permanently deleted.',
    whatWeProvide: 'Complete data deletion with certification available',
    whatWeDoNotProvide: null,
    technicalReason: 'Cascading delete on workspace closure',
    verificationMethod: 'Deletion certificate available upon request',
  },

  // EXPORT_CAPABILITIES
  {
    category: 'EXPORT_CAPABILITIES',
    capability: 'Bundle Content Export',
    status: 'IN_SCOPE',
    explanation:
      'Bundle viewers can export security documentation in multiple formats.',
    whatWeProvide: 'JSON, Markdown, and CSV export options',
    whatWeDoNotProvide: null,
    technicalReason: 'Export endpoints available on bundle access',
    verificationMethod: 'Export buttons visible in bundle viewer',
  },
  {
    category: 'EXPORT_CAPABILITIES',
    capability: 'Audit Log Export',
    status: 'IN_SCOPE',
    explanation: 'Workspace administrators can export complete audit logs.',
    whatWeProvide: 'Full audit log export in JSON and CSV formats',
    whatWeDoNotProvide: null,
    technicalReason: 'Export API available to owner/admin roles',
    verificationMethod: 'Audit export endpoint documented',
  },
  {
    category: 'EXPORT_CAPABILITIES',
    capability: 'Viewer Data Export',
    status: 'OUT_OF_SCOPE',
    explanation:
      'There is no viewer data to export because no viewer data is collected.',
    whatWeProvide: null,
    whatWeDoNotProvide:
      'Viewer identity export, behavioral data export, or contact list export',
    technicalReason: 'No viewer data exists in the system to export',
    verificationMethod: 'Database schema shows no viewer identity tables',
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Generates a unique sheet ID.
 */
function generateSheetId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `BND-${timestamp}-${random}`.toUpperCase();
}

/**
 * Adds IDs to boundary items.
 */
function addItemIds(items: Omit<BoundaryItem, 'id'>[]): BoundaryItem[] {
  return items.map((item, index) => ({
    ...item,
    id: `BND-ITEM-${(index + 1).toString().padStart(3, '0')}`,
  }));
}

/**
 * Generates category summaries from items.
 */
function generateCategorySummaries(
  items: BoundaryItem[]
): BoundaryCategorySummary[] {
  const summaries: BoundaryCategorySummary[] = [];

  for (const [category, info] of Object.entries(CATEGORY_INFO)) {
    const categoryItems = items.filter((i) => i.category === category);
    summaries.push({
      category: category as BoundaryCategory,
      categoryLabel: info.label,
      description: info.description,
      inScope: categoryItems.filter((i) => i.status === 'IN_SCOPE').length,
      outOfScope: categoryItems.filter((i) => i.status === 'OUT_OF_SCOPE').length,
      partial: categoryItems.filter((i) => i.status === 'PARTIAL').length,
      roadmap: categoryItems.filter((i) => i.status === 'ROADMAP').length,
    });
  }

  return summaries.filter(
    (s) => s.inScope + s.outOfScope + s.partial + s.roadmap > 0
  );
}

// ============================================
// Public API
// ============================================

/**
 * Generates a complete boundary sheet for a workspace.
 *
 * @param workspaceId - Workspace generating the sheet
 * @returns Complete boundary sheet
 */
export function generateBoundarySheet(workspaceId: string): BoundarySheet {
  const items = addItemIds(STANDARD_BOUNDARY_ITEMS);
  const categorySummaries = generateCategorySummaries(items);

  const inScopeCount = items.filter((i) => i.status === 'IN_SCOPE').length;
  const outOfScopeCount = items.filter((i) => i.status === 'OUT_OF_SCOPE').length;
  const partialCount = items.filter((i) => i.status === 'PARTIAL').length;

  return {
    metadata: {
      sheetId: generateSheetId(),
      workspaceId,
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
    executiveSummary: `This boundary sheet documents ${items.length} capabilities across ${categorySummaries.length} categories. Of these, ${inScopeCount} are fully supported, ${partialCount} are partially supported, and ${outOfScopeCount} are explicitly out of scope. This document provides honest, verifiable information about what the system can and cannot do.`,
    trustStatement: `Trust Bundles is designed with privacy-by-architecture. We collect no personal information from bundle viewers, perform no individual behavioral tracking, and cannot automate buyer-facing communications. All engagement signals are advisory only, derived from aggregate patterns, and require human judgment before action. This boundary sheet documents these commitments with verification methods for independent audit.`,
    categorySummaries,
    items,
    verificationInstructions: `To verify any boundary claim in this document:

1. TECHNICAL VERIFICATION: Use the verification method listed for each item. Most can be verified through API inspection, network traffic analysis, or database schema review.

2. DOCUMENTATION VERIFICATION: Request our technical architecture documentation, which details the implementation of each boundary.

3. AUDIT VERIFICATION: Request our SOC 2 Type II report, which provides third-party attestation of our security controls.

4. LIVE VERIFICATION: For items marked "Attempt access..." or similar, you may perform the verification yourself using test bundles.

Contact your account representative to arrange any verification activity.`,
  };
}

/**
 * Exports boundary sheet to Markdown format.
 *
 * @param sheet - Boundary sheet to export
 * @returns Markdown string
 */
export function exportBoundarySheetMarkdown(sheet: BoundarySheet): string {
  const lines: string[] = [];

  // Header
  lines.push('# System Capability Boundary Sheet');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Metadata
  lines.push('## Document Information');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Sheet ID | ${sheet.metadata.sheetId} |`);
  lines.push(`| Generated | ${sheet.metadata.generatedAt} |`);
  lines.push(`| Version | ${sheet.metadata.version} |`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(sheet.executiveSummary);
  lines.push('');

  // Trust Statement
  lines.push('## Trust Statement');
  lines.push('');
  lines.push('> ' + sheet.trustStatement);
  lines.push('');

  // Category Summary Table
  lines.push('## Category Overview');
  lines.push('');
  lines.push('| Category | Supported | Partial | Not Supported | Planned |');
  lines.push('|----------|-----------|---------|---------------|---------|');
  for (const summary of sheet.categorySummaries) {
    lines.push(
      `| ${summary.categoryLabel} | ${summary.inScope} | ${summary.partial} | ${summary.outOfScope} | ${summary.roadmap} |`
    );
  }
  lines.push('');

  // Detailed Items by Category
  lines.push('## Detailed Boundaries');
  lines.push('');

  for (const summary of sheet.categorySummaries) {
    lines.push(`### ${summary.categoryLabel}`);
    lines.push('');
    lines.push(`*${summary.description}*`);
    lines.push('');

    const categoryItems = sheet.items.filter(
      (i) => i.category === summary.category
    );

    for (const item of categoryItems) {
      const statusIcon =
        item.status === 'IN_SCOPE'
          ? '✅'
          : item.status === 'OUT_OF_SCOPE'
          ? '❌'
          : item.status === 'PARTIAL'
          ? '⚠️'
          : '🔮';

      lines.push(`#### ${statusIcon} ${item.capability}`);
      lines.push('');
      lines.push(`**Status:** ${STATUS_LABELS[item.status]}`);
      lines.push('');
      lines.push(item.explanation);
      lines.push('');

      if (item.whatWeProvide) {
        lines.push(`**What we provide:** ${item.whatWeProvide}`);
        lines.push('');
      }

      if (item.whatWeDoNotProvide) {
        lines.push(`**What we do NOT provide:** ${item.whatWeDoNotProvide}`);
        lines.push('');
      }

      if (item.technicalReason) {
        lines.push(`**Technical reason:** ${item.technicalReason}`);
        lines.push('');
      }

      if (item.verificationMethod) {
        lines.push(`**Verification:** ${item.verificationMethod}`);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  // Verification Instructions
  lines.push('## Verification Instructions');
  lines.push('');
  lines.push(sheet.verificationInstructions);
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Generated: ${sheet.metadata.generatedAt}*`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Exports boundary sheet to JSON format.
 *
 * @param sheet - Boundary sheet to export
 * @returns JSON string
 */
export function exportBoundarySheetJSON(sheet: BoundarySheet): string {
  return JSON.stringify(sheet, null, 2);
}

/**
 * Gets items by status.
 *
 * @param sheet - Boundary sheet
 * @param status - Status to filter by
 * @returns Filtered items
 */
export function getItemsByStatus(
  sheet: BoundarySheet,
  status: BoundaryStatus
): BoundaryItem[] {
  return sheet.items.filter((i) => i.status === status);
}

/**
 * Gets items by category.
 *
 * @param sheet - Boundary sheet
 * @param category - Category to filter by
 * @returns Filtered items
 */
export function getItemsByCategory(
  sheet: BoundarySheet,
  category: BoundaryCategory
): BoundaryItem[] {
  return sheet.items.filter((i) => i.category === category);
}

/**
 * Gets status label.
 */
export function getStatusLabel(status: BoundaryStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Gets status color.
 */
export function getStatusColor(status: BoundaryStatus): string {
  return STATUS_COLORS[status];
}

/**
 * Gets category label.
 */
export function getCategoryLabel(category: BoundaryCategory): string {
  return CATEGORY_INFO[category].label;
}

// ============================================
// Re-exports
// ============================================

export { CATEGORY_INFO, STATUS_LABELS, STATUS_COLORS };
