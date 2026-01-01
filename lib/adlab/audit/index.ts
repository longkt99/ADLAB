// ============================================
// AdLab Audit Logging System
// ============================================
// PHASE D19: Immutable audit logging for high-risk actions.
//
// CORE PRINCIPLE:
// If it can change production, it must leave a trail.
//
// HARD CONSTRAINTS:
// - NO edits/deletes to audit records
// - NO client-side writes
// - NO missing actor/context
// - Append-only logs
// - Server-side only
// ============================================

import { createServerSupabaseClient } from '@/lib/supabase/server';

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
// Validation
// ============================================

/**
 * Validates that all required audit context is present.
 * Throws if any required field is missing.
 */
export function assertAuditContext(ctx: Partial<AuditContext>): asserts ctx is AuditContext {
  if (!ctx.workspaceId) {
    throw new Error('Audit context missing: workspaceId is required');
  }
  if (!ctx.actorId) {
    throw new Error('Audit context missing: actorId is required');
  }
  if (!ctx.actorRole) {
    throw new Error('Audit context missing: actorRole is required');
  }
}

/**
 * Validates that rollback actions include a reason.
 */
function validateRollbackReason(action: AuditAction, reason?: string): void {
  if (action === 'ROLLBACK' && (!reason || reason.trim().length === 0)) {
    throw new Error('Audit validation failed: reason is required for ROLLBACK actions');
  }
}

// ============================================
// Core Audit Functions
// ============================================

/**
 * Appends an immutable audit log entry.
 *
 * This is the ONLY way to create audit records.
 * - Server-side only
 * - Validates all required context
 * - Enforces reason for rollback
 * - Returns error if write fails (caller should block primary action)
 */
export async function appendAuditLog(input: AuditLogInput): Promise<AuditResult> {
  try {
    // Validate context
    assertAuditContext(input.context);

    // Validate rollback reason
    validateRollbackReason(input.action, input.reason);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('adlab_audit_logs')
      .insert({
        workspace_id: input.context.workspaceId,
        actor_id: input.context.actorId,
        actor_role: input.context.actorRole,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        scope: input.scope,
        reason: input.reason || null,
        metadata: input.metadata || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[AUDIT] Failed to write audit log:', error);
      return { success: false, error: error.message };
    }

    return { success: true, auditId: data.id };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown audit error';
    console.error('[AUDIT] Exception during audit write:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Query Functions
// ============================================

/**
 * Fetches audit logs for a workspace with optional filters.
 */
export async function getAuditLogs(filter: AuditQueryFilter): Promise<{
  data: AuditLogEntry[];
  error: string | null;
}> {
  try {
    const supabase = createServerSupabaseClient();

    let query = supabase
      .from('adlab_audit_logs')
      .select('*')
      .eq('workspace_id', filter.workspaceId)
      .order('created_at', { ascending: false });

    if (filter.action) {
      query = query.eq('action', filter.action);
    }

    if (filter.entityType) {
      query = query.eq('entity_type', filter.entityType);
    }

    if (filter.entityId) {
      query = query.eq('entity_id', filter.entityId);
    }

    if (filter.startDate) {
      query = query.gte('created_at', filter.startDate);
    }

    if (filter.endDate) {
      query = query.lte('created_at', filter.endDate);
    }

    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    if (filter.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : 'Failed to fetch audit logs',
    };
  }
}

/**
 * Fetches audit logs for a specific entity.
 */
export async function getEntityAuditLogs(
  workspaceId: string,
  entityType: AuditEntityType,
  entityId: string,
  limit: number = 50
): Promise<{
  data: AuditLogEntry[];
  error: string | null;
}> {
  return getAuditLogs({
    workspaceId,
    entityType,
    entityId,
    limit,
  });
}

/**
 * Gets audit logs related to a snapshot (includes both snapshot and ingestion_log entries)
 */
export async function getSnapshotAuditTrail(
  workspaceId: string,
  snapshotId: string,
  ingestionLogId?: string,
  limit: number = 50
): Promise<{
  data: AuditLogEntry[];
  error: string | null;
}> {
  try {
    const supabase = createServerSupabaseClient();

    // Build OR filter for snapshot and related ingestion log
    let query = supabase
      .from('adlab_audit_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ingestionLogId) {
      // Get logs for both the snapshot and its source ingestion log
      query = query.or(
        `and(entity_type.eq.snapshot,entity_id.eq.${snapshotId}),and(entity_type.eq.ingestion_log,entity_id.eq.${ingestionLogId})`
      );
    } else {
      query = query.eq('entity_type', 'snapshot').eq('entity_id', snapshotId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : 'Failed to fetch snapshot audit trail',
    };
  }
}

// ============================================
// Helper Functions
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
    trust_engagement: 'Trust Engagement',  // D37
    procurement_response: 'Procurement Response',  // D44
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
// Simplified Audit Helper
// ============================================

/**
 * Simplified audit log helper for read-only operations.
 * Uses a default scope and simplified interface.
 *
 * Note: For high-risk write operations, use appendAuditLog directly
 * with full context and scope.
 */
export async function auditLog(input: {
  workspaceId: string;
  actorId: string;
  action: 'read' | 'create' | 'delete' | 'export';
  entityType: AuditEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Map simplified action to AuditAction
  const actionMap: Record<string, AuditAction> = {
    read: 'VALIDATE', // Use VALIDATE for read operations (lowest severity)
    create: 'CREATE',
    delete: 'DELETE',
    export: 'EXPORT',
  };

  try {
    await appendAuditLog({
      context: {
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        actorRole: 'user', // Simplified - full audit uses proper role
      },
      action: actionMap[input.action] || 'VALIDATE',
      entityType: input.entityType,
      entityId: input.entityId,
      scope: {
        platform: 'adlab',
        dataset: 'trust',
      },
      metadata: input.metadata,
    });
  } catch (e) {
    // Log but don't fail for read-only audit
    console.warn('[AUDIT] Failed to log read operation:', e);
  }
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
