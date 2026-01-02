// ============================================
// AdLab Audit Types (Client-Safe)
// ============================================
// CLIENT-SAFE: This file contains only type definitions and
// pure helper functions. It can be safely imported by both
// server and client components.
//
// IMPORTANT: Do NOT add any server-side imports here.
// ============================================

// ============================================
// Types
// ============================================

/** Audit actions - high-risk operations that must be logged */
export type AuditAction =
  | 'PROMOTE'
  | 'ROLLBACK'
  | 'SNAPSHOT_ACTIVATE'
  | 'SNAPSHOT_DEACTIVATE'
  | 'VALIDATE'
  | 'INGEST'
  | 'CREATE'
  | 'DELETE'
  | 'EXPORT';

/** Entity types that can be audited */
export type AuditEntityType =
  | 'ingestion_log'
  | 'snapshot'
  | 'dataset'
  | 'trust_token'
  | 'public_trust'
  | 'trust_bundle'
  | 'trust_engagement'    // D37: Trust engagement telemetry
  | 'procurement_response';  // D44: Procurement & security responses

/** Scope context for audit entries */
export interface AuditScope {
  platform: string;
  dataset: string;
  clientId?: string;
}

/** Audit context - required actor information */
export interface AuditContext {
  workspaceId: string;
  actorId: string;
  actorRole: string;
}

/** Input for creating an audit log entry */
export interface AuditLogInput {
  context: AuditContext;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  scope: AuditScope;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/** Audit log entry as stored in database */
export interface AuditLogEntry {
  id: string;
  workspace_id: string;
  actor_id: string;
  actor_role: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  scope: AuditScope;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Result type for audit operations */
export interface AuditResult {
  success: boolean;
  auditId?: string;
  error?: string;
}

/** Query filter for fetching audit logs */
export interface AuditQueryFilter {
  workspaceId: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// Helper Functions (Pure, Client-Safe)
// ============================================

/**
 * Gets human-readable label for audit action.
 */
export function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    PROMOTE: 'Promoted to Production',
    ROLLBACK: 'Rollback',
    SNAPSHOT_ACTIVATE: 'Snapshot Activated',
    SNAPSHOT_DEACTIVATE: 'Snapshot Deactivated',
    VALIDATE: 'Validation Completed',
    INGEST: 'Data Ingested',
    CREATE: 'Created',
    DELETE: 'Deleted',
    EXPORT: 'Exported',
  };
  return labels[action] || action;
}

/**
 * Gets severity level for audit action (for UI badge styling).
 */
export function getActionSeverity(action: AuditAction): 'critical' | 'warning' | 'info' {
  switch (action) {
    case 'ROLLBACK':
    case 'DELETE':
      return 'critical';
    case 'PROMOTE':
    case 'SNAPSHOT_ACTIVATE':
    case 'SNAPSHOT_DEACTIVATE':
    case 'CREATE':
      return 'warning';
    case 'VALIDATE':
    case 'INGEST':
    default:
      return 'info';
  }
}

/**
 * Gets entity type label for display.
 */
export function getEntityTypeLabel(entityType: AuditEntityType): string {
  const labels: Record<AuditEntityType, string> = {
    ingestion_log: 'Ingestion Log',
    snapshot: 'Production Snapshot',
    dataset: 'Dataset',
    trust_token: 'Trust Token',
    public_trust: 'Public Trust',
    trust_bundle: 'Trust Bundle',
    trust_engagement: 'Trust Engagement',
    procurement_response: 'Procurement Response',
  };
  return labels[entityType] || entityType;
}

// ============================================
// D37: Trust Engagement Event Types
// ============================================

/** D37: Trust engagement event types for telemetry */
export type TrustEngagementEvent =
  | 'TRUST_BUNDLE_VIEWED'
  | 'TRUST_SECTION_VIEWED'
  | 'TRUST_BUNDLE_EXPORTED'
  | 'TRUST_BUNDLE_REVISITED'
  | 'TRUST_BUNDLE_EXPIRED_ACCESSED';

/**
 * Gets human-readable label for trust engagement event.
 */
export function getTrustEngagementLabel(event: TrustEngagementEvent): string {
  const labels: Record<TrustEngagementEvent, string> = {
    TRUST_BUNDLE_VIEWED: 'Bundle Viewed',
    TRUST_SECTION_VIEWED: 'Section Viewed',
    TRUST_BUNDLE_EXPORTED: 'Bundle Exported',
    TRUST_BUNDLE_REVISITED: 'Bundle Revisited',
    TRUST_BUNDLE_EXPIRED_ACCESSED: 'Expired Access Attempted',
  };
  return labels[event] || event;
}

// ============================================
// D38: Sales Activation Event Types
// ============================================

/** D38: Sales activation event types for analytics views */
export type SalesActivationEvent =
  | 'SALES_ACTIVATION_VIEWED'
  | 'SALES_PLAYBOOK_RENDERED'
  | 'TRUST_TIMELINE_VIEWED'
  | 'TRUST_ROI_VIEWED';

/**
 * Gets human-readable label for sales activation event.
 */
export function getSalesActivationLabel(event: SalesActivationEvent): string {
  const labels: Record<SalesActivationEvent, string> = {
    SALES_ACTIVATION_VIEWED: 'Activation Dashboard Viewed',
    SALES_PLAYBOOK_RENDERED: 'Playbook Rendered',
    TRUST_TIMELINE_VIEWED: 'Timeline Viewed',
    TRUST_ROI_VIEWED: 'ROI Analytics Viewed',
  };
  return labels[event] || event;
}

// ============================================
// D44: Procurement Response Event Types
// ============================================

/** D44: Procurement response event types */
export type ProcurementResponseEvent =
  | 'SECURITY_ANSWERS_VIEWED'
  | 'RFP_PACK_GENERATED'
  | 'BOUNDARY_SHEET_VIEWED'
  | 'VISIBILITY_MATRIX_VIEWED'
  | 'EVIDENCE_PACKAGE_GENERATED';

/**
 * Gets human-readable label for procurement response event.
 */
export function getProcurementResponseLabel(event: ProcurementResponseEvent): string {
  const labels: Record<ProcurementResponseEvent, string> = {
    SECURITY_ANSWERS_VIEWED: 'Security Answers Viewed',
    RFP_PACK_GENERATED: 'RFP Pack Generated',
    BOUNDARY_SHEET_VIEWED: 'Boundary Sheet Viewed',
    VISIBILITY_MATRIX_VIEWED: 'Visibility Matrix Viewed',
    EVIDENCE_PACKAGE_GENERATED: 'Evidence Package Generated',
  };
  return labels[event] || event;
}
