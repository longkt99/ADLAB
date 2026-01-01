// ============================================
// AdLab Kill-Switch Guard
// ============================================
// PHASE D22: Operational Safety Net.
//
// CORE PRINCIPLE:
// When the kill-switch is ON, nothing dangerous happens.
// No exceptions. No overrides. No "but I'm the owner."
//
// HARD RULES:
// - Kill-switch overrides ALL permissions
// - Owner cannot bypass
// - Works without redeploy
// - Logged, auditable, reversible
// - No destructive actions while active
//
// EXECUTION ORDER (MANDATORY):
// 1. Resolve actor
// 2. assertKillSwitchOpen() ← THIS RUNS FIRST
// 3. requirePermission()
// 4. Business logic
// ============================================

import { createClient } from '@supabase/supabase-js';
import { appendAuditLog } from '@/lib/adlab/audit';
import type { Actor, PermissionAction } from '@/lib/adlab/auth/roles';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

/** Kill-switch scope */
export type KillSwitchScope = 'global' | 'workspace';

/** Kill-switch record from database */
export interface KillSwitchRecord {
  id: string;
  scope: KillSwitchScope;
  workspace_id: string | null;
  reason: string;
  enabled: boolean;
  activated_by: string | null;
  activated_at: string | null;
}

/** Result of kill-switch check */
export interface KillSwitchStatus {
  blocked: boolean;
  scope?: KillSwitchScope;
  reason?: string;
  activatedAt?: string;
  activatedBy?: string;
}

/** Actions that can be blocked by kill-switch */
export type BlockableAction =
  | 'INGEST'
  | 'VALIDATE'
  | 'PROMOTE'
  | 'SNAPSHOT_ACTIVATE'
  | 'SNAPSHOT_DEACTIVATE'
  | 'ROLLBACK';

/** All blockable actions */
export const BLOCKABLE_ACTIONS: readonly BlockableAction[] = [
  'INGEST',
  'VALIDATE',
  'PROMOTE',
  'SNAPSHOT_ACTIVATE',
  'SNAPSHOT_DEACTIVATE',
  'ROLLBACK',
] as const;

// ============================================
// Error Class
// ============================================

/**
 * Error thrown when kill-switch blocks an action.
 *
 * This error is NON-NEGOTIABLE.
 * No retry, no override, no workaround.
 */
export class KillSwitchActiveError extends Error {
  constructor(
    public readonly scope: KillSwitchScope,
    public readonly reason: string,
    public readonly attemptedAction: BlockableAction,
    public readonly workspaceId?: string
  ) {
    super(
      `Operations temporarily disabled: ${reason}. ` +
        `Scope: ${scope}${scope === 'workspace' ? ` (${workspaceId})` : ''}. ` +
        `Attempted action: ${attemptedAction}`
    );
    this.name = 'KillSwitchActiveError';
  }
}

// ============================================
// Supabase Client
// ============================================

function createKillSwitchClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Kill-Switch Check Functions
// ============================================

/**
 * Checks if the GLOBAL kill-switch is enabled.
 * When enabled, ALL workspaces are blocked.
 */
export async function isGlobalKillSwitchEnabled(): Promise<KillSwitchStatus> {
  try {
    const supabase = createKillSwitchClient();

    const { data, error } = await supabase
      .from('adlab_kill_switches')
      .select('*')
      .eq('scope', 'global')
      .eq('enabled', true)
      .single();

    if (error || !data) {
      return { blocked: false };
    }

    return {
      blocked: true,
      scope: 'global',
      reason: data.reason,
      activatedAt: data.activated_at,
      activatedBy: data.activated_by,
    };
  } catch (e) {
    // On error, fail OPEN (don't block legitimate operations)
    // But log the error
    console.error('[KILL-SWITCH] Error checking global kill-switch:', e);
    return { blocked: false };
  }
}

/**
 * Checks if a WORKSPACE-specific kill-switch is enabled.
 */
export async function isWorkspaceKillSwitchEnabled(
  workspaceId: string
): Promise<KillSwitchStatus> {
  try {
    const supabase = createKillSwitchClient();

    const { data, error } = await supabase
      .from('adlab_kill_switches')
      .select('*')
      .eq('scope', 'workspace')
      .eq('workspace_id', workspaceId)
      .eq('enabled', true)
      .single();

    if (error || !data) {
      return { blocked: false };
    }

    return {
      blocked: true,
      scope: 'workspace',
      reason: data.reason,
      activatedAt: data.activated_at,
      activatedBy: data.activated_by,
    };
  } catch (e) {
    console.error('[KILL-SWITCH] Error checking workspace kill-switch:', e);
    return { blocked: false };
  }
}

/**
 * Checks both global AND workspace kill-switches.
 * Global takes precedence.
 */
export async function getKillSwitchStatus(
  workspaceId: string
): Promise<KillSwitchStatus> {
  // Check global first (takes precedence)
  const globalStatus = await isGlobalKillSwitchEnabled();
  if (globalStatus.blocked) {
    return globalStatus;
  }

  // Then check workspace-specific
  return isWorkspaceKillSwitchEnabled(workspaceId);
}

// ============================================
// Kill-Switch Guard
// ============================================

/**
 * Asserts that kill-switch is NOT blocking operations.
 *
 * MUST be called BEFORE requirePermission().
 *
 * @throws KillSwitchActiveError if blocked
 *
 * @example
 * const actor = await resolveActorFromRequest();
 * await assertKillSwitchOpen(actor, 'PROMOTE'); // Throws if blocked
 * await requirePermission(actor, 'PROMOTE');    // Only runs if not blocked
 */
export async function assertKillSwitchOpen(
  actor: Actor,
  action: BlockableAction
): Promise<void> {
  // Only check for blockable actions
  if (!BLOCKABLE_ACTIONS.includes(action)) {
    return;
  }

  const status = await getKillSwitchStatus(actor.workspaceId);

  if (status.blocked) {
    // Log the blocked attempt to audit trail
    await logKillSwitchBlock(actor, action, status);

    throw new KillSwitchActiveError(
      status.scope!,
      status.reason!,
      action,
      status.scope === 'workspace' ? actor.workspaceId : undefined
    );
  }
}

/**
 * Non-throwing version for UI checks.
 * Returns status without throwing.
 */
export async function checkKillSwitch(
  workspaceId: string
): Promise<KillSwitchStatus> {
  return getKillSwitchStatus(workspaceId);
}

// ============================================
// Audit Logging
// ============================================

/**
 * Logs a kill-switch block to the audit trail.
 *
 * This creates a permanent record of blocked attempts.
 * Useful for:
 * - Security investigation
 * - Compliance reporting
 * - Understanding what was blocked during an incident
 */
async function logKillSwitchBlock(
  actor: Actor,
  attemptedAction: BlockableAction,
  status: KillSwitchStatus
): Promise<void> {
  try {
    await appendAuditLog({
      context: {
        workspaceId: actor.workspaceId,
        actorId: actor.id,
        actorRole: actor.role,
      },
      action: 'VALIDATE', // Using VALIDATE as closest audit action type
      entityType: 'dataset',
      entityId: status.scope === 'global' ? 'global' : actor.workspaceId,
      scope: {
        platform: 'system',
        dataset: 'kill_switch',
      },
      metadata: {
        killSwitchBlock: true,
        severity: 'CRITICAL',
        attemptedAction,
        killSwitchScope: status.scope,
        killSwitchReason: status.reason,
        killSwitchActivatedAt: status.activatedAt,
        killSwitchActivatedBy: status.activatedBy,
        actorRole: actor.role,
        actorId: actor.id,
      },
    });
  } catch (e) {
    // Log failure but don't block the kill-switch error
    console.error('[KILL-SWITCH] Failed to log block to audit:', e);
  }
}

// ============================================
// Admin Functions (for future admin API)
// ============================================

/**
 * Enables the global kill-switch.
 * USE WITH EXTREME CAUTION.
 */
export async function enableGlobalKillSwitch(
  reason: string,
  activatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createKillSwitchClient();

    const { error } = await supabase
      .from('adlab_kill_switches')
      .update({
        enabled: true,
        reason,
        activated_by: activatedBy,
        activated_at: new Date().toISOString(),
      })
      .eq('scope', 'global');

    if (error) {
      return { success: false, error: error.message };
    }

    console.warn(`[KILL-SWITCH] GLOBAL KILL-SWITCH ENABLED by ${activatedBy}: ${reason}`);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to enable global kill-switch',
    };
  }
}

/**
 * Disables the global kill-switch.
 */
export async function disableGlobalKillSwitch(
  deactivatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createKillSwitchClient();

    const { error } = await supabase
      .from('adlab_kill_switches')
      .update({
        enabled: false,
        deactivated_by: deactivatedBy,
        deactivated_at: new Date().toISOString(),
      })
      .eq('scope', 'global');

    if (error) {
      return { success: false, error: error.message };
    }

    console.warn(`[KILL-SWITCH] GLOBAL KILL-SWITCH DISABLED by ${deactivatedBy}`);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to disable global kill-switch',
    };
  }
}

/**
 * Enables a workspace-specific kill-switch.
 */
export async function enableWorkspaceKillSwitch(
  workspaceId: string,
  reason: string,
  activatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createKillSwitchClient();

    // Upsert - create if not exists
    const { error } = await supabase
      .from('adlab_kill_switches')
      .upsert(
        {
          scope: 'workspace',
          workspace_id: workspaceId,
          reason,
          enabled: true,
          activated_by: activatedBy,
          activated_at: new Date().toISOString(),
        },
        {
          onConflict: 'workspace_id',
        }
      );

    if (error) {
      return { success: false, error: error.message };
    }

    console.warn(`[KILL-SWITCH] Workspace ${workspaceId} KILL-SWITCH ENABLED by ${activatedBy}: ${reason}`);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to enable workspace kill-switch',
    };
  }
}

/**
 * Disables a workspace-specific kill-switch.
 */
export async function disableWorkspaceKillSwitch(
  workspaceId: string,
  deactivatedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createKillSwitchClient();

    const { error } = await supabase
      .from('adlab_kill_switches')
      .update({
        enabled: false,
        deactivated_by: deactivatedBy,
        deactivated_at: new Date().toISOString(),
      })
      .eq('scope', 'workspace')
      .eq('workspace_id', workspaceId);

    if (error) {
      return { success: false, error: error.message };
    }

    console.warn(`[KILL-SWITCH] Workspace ${workspaceId} KILL-SWITCH DISABLED by ${deactivatedBy}`);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to disable workspace kill-switch',
    };
  }
}
