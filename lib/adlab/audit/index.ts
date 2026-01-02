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

import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Re-export types and pure helpers from client-safe types module.
// Server components importing from here will still work.
// Client components should import directly from @/lib/adlab/audit/types.
export type {
  AuditAction,
  AuditEntityType,
  AuditScope,
  AuditContext,
  AuditLogInput,
  AuditLogEntry,
  AuditResult,
  AuditQueryFilter,
  TrustEngagementEvent,
  SalesActivationEvent,
  ProcurementResponseEvent,
} from './types';

export {
  getActionLabel,
  getActionSeverity,
  getEntityTypeLabel,
  getTrustEngagementLabel,
  getSalesActivationLabel,
  getProcurementResponseLabel,
} from './types';

// Import types for internal use
import type {
  AuditAction,
  AuditContext,
  AuditLogInput,
  AuditLogEntry,
  AuditResult,
  AuditQueryFilter,
  AuditEntityType,
} from './types';

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
