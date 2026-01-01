// ============================================
// AdLab Production Snapshots
// ============================================
// PHASE D17A: Snapshot & Rollback Control
//
// CORE INVARIANTS:
// 1. Exactly ONE active snapshot per (workspace_id, platform, dataset)
// 2. Data is NEVER deleted - rollback switches active snapshot only
// 3. Production truth is defined ONLY by the active snapshot
// 4. All snapshot operations must be transactional
//
// GUARDRAILS:
// - Snapshot creation: log must be pass/warn, promoted, frozen
// - Rollback: snapshot must be inactive, same workspace, authorized role
// ============================================

import { createClient } from '@supabase/supabase-js';
import type { DatasetType, PlatformType } from './validate';
import type { IngestionLog } from './queries';
import { canPerform, type AdLabRole } from '@/lib/adlab/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createSnapshotClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Types
// ============================================

export interface ProductionSnapshot {
  id: string;
  workspace_id: string;
  platform: PlatformType;
  dataset: DatasetType;
  ingestion_log_id: string;
  promoted_at: string;
  promoted_by: string;
  is_active: boolean;
  rolled_back_at: string | null;
  rollback_reason: string | null;
  created_at: string;
}

export interface SnapshotScope {
  workspaceId: string;
  platform: PlatformType;
  dataset: DatasetType;
}

export interface CreateSnapshotInput {
  workspaceId: string;
  platform: PlatformType;
  dataset: DatasetType;
  ingestionLogId: string;
  promotedBy: string;
}

export interface RollbackInput {
  snapshotId: string;
  reason: string;
  actor: string;
  actorRole: AdLabRole; // D20: Use unified role type
}

export interface SnapshotResult<T> {
  data: T | null;
  error: string | null;
}

export interface SnapshotMutationResult {
  success: boolean;
  snapshot?: ProductionSnapshot;
  error: string | null;
}

// ============================================
// Query Helpers
// ============================================

/**
 * Get the currently active snapshot for a given scope.
 * Returns null if no active snapshot exists (no production data yet).
 *
 * INVARIANT: At most ONE active snapshot per scope due to partial unique index.
 */
export async function getActiveSnapshot(
  workspaceId: string,
  platform: PlatformType,
  dataset: DatasetType
): Promise<SnapshotResult<ProductionSnapshot>> {
  try {
    const supabase = createSnapshotClient();
    const { data, error } = await supabase
      .from('adlab_production_snapshots')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('platform', platform)
      .eq('dataset', dataset)
      .eq('is_active', true)
      .single();

    if (error) {
      // PGRST116 = no rows found (not an error for this use case)
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      return { data: null, error: error.message };
    }

    return { data: data as ProductionSnapshot, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Get all snapshots for a scope (active + inactive history).
 * Useful for rollback UI and audit trail.
 */
export async function getSnapshotHistory(
  workspaceId: string,
  platform?: PlatformType,
  dataset?: DatasetType,
  limit = 50
): Promise<{ data: ProductionSnapshot[]; error: string | null }> {
  try {
    const supabase = createSnapshotClient();
    let query = supabase
      .from('adlab_production_snapshots')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (platform) {
      query = query.eq('platform', platform);
    }
    if (dataset) {
      query = query.eq('dataset', dataset);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data as ProductionSnapshot[]) || [], error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Get a single snapshot by ID.
 */
export async function getSnapshotById(
  snapshotId: string
): Promise<SnapshotResult<ProductionSnapshot>> {
  try {
    const supabase = createSnapshotClient();
    const { data, error } = await supabase
      .from('adlab_production_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as ProductionSnapshot, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ============================================
// Snapshot Creation
// ============================================

/**
 * Validate that an ingestion log is eligible for snapshot creation.
 *
 * GUARDRAILS:
 * - status must be 'pass' or 'warn'
 * - promoted_at must be set
 * - frozen must be true
 */
export function validateLogForSnapshot(log: IngestionLog): { valid: boolean; reason?: string } {
  if (log.status === 'fail') {
    return { valid: false, reason: 'Ingestion log status must be "pass" or "warn"' };
  }

  if (!log.promoted_at) {
    return { valid: false, reason: 'Ingestion log must be promoted first' };
  }

  if (!log.frozen) {
    return { valid: false, reason: 'Ingestion log must be frozen' };
  }

  return { valid: true };
}

/**
 * Create a new production snapshot from a promoted ingestion log.
 *
 * BEHAVIOR (Transactional):
 * 1. Validate the ingestion log is eligible
 * 2. Deactivate any existing active snapshot for the same scope
 * 3. Insert new snapshot as is_active = true
 *
 * INVARIANT: After success, exactly ONE active snapshot exists for the scope.
 */
export async function createSnapshotFromPromotion(
  input: CreateSnapshotInput,
  log: IngestionLog
): Promise<SnapshotMutationResult> {
  // Validate log eligibility
  const validation = validateLogForSnapshot(log);
  if (!validation.valid) {
    return { success: false, error: validation.reason || 'Invalid log for snapshot' };
  }

  try {
    const supabase = createSnapshotClient();

    // Step 1: Deactivate any existing active snapshot for this scope
    // This is safe because partial unique index prevents race conditions
    const { error: deactivateError } = await supabase
      .from('adlab_production_snapshots')
      .update({ is_active: false })
      .eq('workspace_id', input.workspaceId)
      .eq('platform', input.platform)
      .eq('dataset', input.dataset)
      .eq('is_active', true);

    if (deactivateError) {
      console.error('Failed to deactivate existing snapshot:', deactivateError);
      return { success: false, error: `Failed to deactivate existing snapshot: ${deactivateError.message}` };
    }

    // Step 2: Insert new snapshot as active
    const { data, error: insertError } = await supabase
      .from('adlab_production_snapshots')
      .insert({
        workspace_id: input.workspaceId,
        platform: input.platform,
        dataset: input.dataset,
        ingestion_log_id: input.ingestionLogId,
        promoted_at: new Date().toISOString(),
        promoted_by: input.promotedBy,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create snapshot:', insertError);
      return { success: false, error: `Failed to create snapshot: ${insertError.message}` };
    }

    return { success: true, snapshot: data as ProductionSnapshot, error: null };
  } catch (e) {
    console.error('Snapshot creation error:', e);
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ============================================
// Rollback
// ============================================

/**
 * Validate that a rollback operation is allowed.
 *
 * GUARDRAILS:
 * - Target snapshot must be inactive (can't rollback to current)
 * - Target snapshot must belong to same workspace
 * - Actor must have owner or admin role
 */
export function validateRollback(
  targetSnapshot: ProductionSnapshot,
  currentWorkspaceId: string,
  actorRole: AdLabRole
): { valid: boolean; reason?: string } {
  // Must be inactive (can't "rollback" to the current active)
  if (targetSnapshot.is_active) {
    return { valid: false, reason: 'Cannot rollback to an already active snapshot' };
  }

  // Must be same workspace
  if (targetSnapshot.workspace_id !== currentWorkspaceId) {
    return { valid: false, reason: 'Snapshot does not belong to this workspace' };
  }

  // D20: Must have sufficient role - ROLLBACK is owner-only
  if (!canPerform(actorRole, 'ROLLBACK')) {
    return { valid: false, reason: 'Only workspace owners can perform rollback' };
  }

  return { valid: true };
}

/**
 * Rollback to a previous snapshot.
 *
 * BEHAVIOR (Transactional):
 * 1. Validate rollback is allowed
 * 2. Mark current active snapshot with rollback metadata
 * 3. Deactivate current active snapshot
 * 4. Activate target snapshot
 *
 * INVARIANT: Data is NEVER deleted. Only is_active flags change.
 * INVARIANT: After success, exactly ONE active snapshot exists for the scope.
 */
export async function rollbackToSnapshot(
  input: RollbackInput,
  currentWorkspaceId: string
): Promise<SnapshotMutationResult> {
  try {
    const supabase = createSnapshotClient();

    // Fetch target snapshot
    const { data: targetSnapshot, error: fetchError } = await getSnapshotById(input.snapshotId);

    if (fetchError || !targetSnapshot) {
      return { success: false, error: fetchError || 'Target snapshot not found' };
    }

    // Validate rollback
    const validation = validateRollback(targetSnapshot, currentWorkspaceId, input.actorRole);
    if (!validation.valid) {
      return { success: false, error: validation.reason || 'Rollback not allowed' };
    }

    // Find current active snapshot for this scope
    const { data: currentActive } = await getActiveSnapshot(
      targetSnapshot.workspace_id,
      targetSnapshot.platform,
      targetSnapshot.dataset
    );

    // Step 1: If there's a current active, mark it with rollback metadata and deactivate
    if (currentActive) {
      const { error: deactivateError } = await supabase
        .from('adlab_production_snapshots')
        .update({
          is_active: false,
          rolled_back_at: new Date().toISOString(),
          rollback_reason: input.reason,
        })
        .eq('id', currentActive.id);

      if (deactivateError) {
        console.error('Failed to deactivate current snapshot:', deactivateError);
        return { success: false, error: `Failed to deactivate current snapshot: ${deactivateError.message}` };
      }
    }

    // Step 2: Activate target snapshot
    const { data: activated, error: activateError } = await supabase
      .from('adlab_production_snapshots')
      .update({ is_active: true })
      .eq('id', input.snapshotId)
      .select()
      .single();

    if (activateError) {
      console.error('Failed to activate target snapshot:', activateError);
      return { success: false, error: `Failed to activate target snapshot: ${activateError.message}` };
    }

    return { success: true, snapshot: activated as ProductionSnapshot, error: null };
  } catch (e) {
    console.error('Rollback error:', e);
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ============================================
// Analytics Query Anchor
// ============================================

/**
 * Resolve the active ingestion_log_id for a given scope.
 *
 * USE CASE: Analytics queries should anchor to this log ID
 * to ensure they're reading from the correct production snapshot.
 *
 * Returns null if no active snapshot exists (no production data).
 */
export async function resolveActiveIngestionLogId(
  scope: SnapshotScope
): Promise<string | null> {
  const { data: snapshot } = await getActiveSnapshot(
    scope.workspaceId,
    scope.platform,
    scope.dataset
  );

  if (!snapshot) {
    return null;
  }

  return snapshot.ingestion_log_id;
}

/**
 * Check if a specific ingestion log is the current production truth.
 *
 * USE CASE: Validation before certain operations to ensure
 * we're working with the active production data.
 */
export async function isActiveProductionLog(
  ingestionLogId: string,
  scope: SnapshotScope
): Promise<boolean> {
  const activeLogId = await resolveActiveIngestionLogId(scope);
  return activeLogId === ingestionLogId;
}
