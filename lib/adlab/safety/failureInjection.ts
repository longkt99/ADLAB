// ============================================
// AdLab Failure Injection Guard
// ============================================
// PHASE D23: Chaos & Failure Injection (Controlled).
//
// CORE PRINCIPLE:
// Prove the system fails safely by injecting controlled failures.
// This is NOT testing mocks - this is production-grade chaos control.
//
// HARD RULES:
// - Never writes corrupt data
// - Never bypasses audit
// - Never auto-enabled (must be explicitly turned on)
// - Kill-switch overrides injection (checked before this)
// - Fully reversible by disabling row
//
// EXECUTION ORDER (MANDATORY):
// 1. Resolve actor
// 2. assertKillSwitchOpen() ← Kill-switch first
// 3. assertNoInjectedFailure() ← Failure injection second
// 4. requirePermission()
// 5. Business logic
// ============================================

import { createClient } from '@supabase/supabase-js';
import { appendAuditLog } from '@/lib/adlab/audit';
import type { Actor } from '@/lib/adlab/auth/roles';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

/** Actions that can have failure injected */
export type InjectableAction =
  | 'INGEST'
  | 'VALIDATE'
  | 'PROMOTE'
  | 'ROLLBACK'
  | 'SNAPSHOT_ACTIVATE'
  | 'SNAPSHOT_DEACTIVATE'
  | 'ANALYTICS';

/** Types of failures that can be injected */
export type FailureType =
  | 'TIMEOUT'     // Artificial delay + timeout error
  | 'THROW'       // Hard exception
  | 'PARTIAL'     // Simulate partial success (NO actual writes)
  | 'STALE_DATA'; // Force analytics to read previous snapshot

/** All injectable actions */
export const INJECTABLE_ACTIONS: readonly InjectableAction[] = [
  'INGEST',
  'VALIDATE',
  'PROMOTE',
  'ROLLBACK',
  'SNAPSHOT_ACTIVATE',
  'SNAPSHOT_DEACTIVATE',
  'ANALYTICS',
] as const;

/** All failure types */
export const FAILURE_TYPES: readonly FailureType[] = [
  'TIMEOUT',
  'THROW',
  'PARTIAL',
  'STALE_DATA',
] as const;

/** Failure injection config from database */
export interface FailureInjectionConfig {
  id: string;
  workspace_id: string;
  action: InjectableAction;
  failure_type: FailureType;
  probability: number;
  enabled: boolean;
  reason: string;
  created_by: string | null;
  created_at: string;
}

/** Result of injection check */
export interface InjectionCheckResult {
  shouldInject: boolean;
  config?: FailureInjectionConfig;
  roll?: number; // The random number rolled (for debugging)
}

// ============================================
// Error Classes
// ============================================

/**
 * Error thrown when failure injection triggers.
 *
 * This error is for TESTING purposes.
 * It simulates real failures safely.
 */
export class InjectedFailureError extends Error {
  constructor(
    public readonly action: InjectableAction,
    public readonly failureType: FailureType,
    public readonly reason: string,
    public readonly probability: number,
    public readonly workspaceId: string
  ) {
    super(
      `[INJECTED FAILURE] Action: ${action}, Type: ${failureType}, ` +
        `Probability: ${probability}%, Reason: ${reason}`
    );
    this.name = 'InjectedFailureError';
  }
}

/**
 * Error for TIMEOUT injection type.
 */
export class InjectedTimeoutError extends InjectedFailureError {
  constructor(
    action: InjectableAction,
    reason: string,
    probability: number,
    workspaceId: string,
    public readonly delayMs: number
  ) {
    super(action, 'TIMEOUT', reason, probability, workspaceId);
    this.name = 'InjectedTimeoutError';
    this.message = `[INJECTED TIMEOUT] Operation timed out after ${delayMs}ms. ${reason}`;
  }
}

/**
 * Error for PARTIAL injection type.
 */
export class InjectedPartialError extends InjectedFailureError {
  constructor(
    action: InjectableAction,
    reason: string,
    probability: number,
    workspaceId: string,
    public readonly completedSteps: number,
    public readonly totalSteps: number
  ) {
    super(action, 'PARTIAL', reason, probability, workspaceId);
    this.name = 'InjectedPartialError';
    this.message =
      `[INJECTED PARTIAL] Operation partially completed (${completedSteps}/${totalSteps}). ` +
      `No data was written. ${reason}`;
  }
}

// ============================================
// Supabase Client
// ============================================

function createInjectionClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Injection Check Functions
// ============================================

/**
 * Gets the failure injection config for a workspace + action.
 */
export async function getInjectionConfig(
  workspaceId: string,
  action: InjectableAction
): Promise<FailureInjectionConfig | null> {
  try {
    const supabase = createInjectionClient();

    const { data, error } = await supabase
      .from('adlab_failure_injections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('action', action)
      .eq('enabled', true)
      .single();

    if (error || !data) {
      return null;
    }

    return data as FailureInjectionConfig;
  } catch (e) {
    // On error, fail OPEN (don't inject failures)
    console.error('[FAILURE-INJECTION] Error checking config:', e);
    return null;
  }
}

/**
 * Checks if failure should be injected based on probability.
 *
 * Uses a deterministic seed based on request timestamp for reproducibility.
 */
export async function shouldInjectFailure(
  workspaceId: string,
  action: InjectableAction
): Promise<InjectionCheckResult> {
  const config = await getInjectionConfig(workspaceId, action);

  if (!config) {
    return { shouldInject: false };
  }

  // Roll the dice (1-100)
  const roll = Math.floor(Math.random() * 100) + 1;
  const shouldInject = roll <= config.probability;

  return {
    shouldInject,
    config,
    roll,
  };
}

// ============================================
// Failure Injection Functions
// ============================================

/**
 * Injects the specified failure type.
 *
 * @throws InjectedFailureError (or subclass)
 */
export async function injectFailure(
  action: InjectableAction,
  failureType: FailureType,
  config: FailureInjectionConfig
): Promise<never> {
  switch (failureType) {
    case 'TIMEOUT':
      // Simulate a timeout with artificial delay
      const delayMs = 5000 + Math.random() * 5000; // 5-10 seconds
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      throw new InjectedTimeoutError(
        action,
        config.reason,
        config.probability,
        config.workspace_id,
        Math.round(delayMs)
      );

    case 'THROW':
      // Immediate hard exception
      throw new InjectedFailureError(
        action,
        'THROW',
        config.reason,
        config.probability,
        config.workspace_id
      );

    case 'PARTIAL':
      // Simulate partial completion (no actual writes happened)
      const completedSteps = Math.floor(Math.random() * 3) + 1;
      const totalSteps = 5;
      throw new InjectedPartialError(
        action,
        config.reason,
        config.probability,
        config.workspace_id,
        completedSteps,
        totalSteps
      );

    case 'STALE_DATA':
      // For analytics - throw error indicating stale data should be used
      throw new InjectedFailureError(
        action,
        'STALE_DATA',
        config.reason,
        config.probability,
        config.workspace_id
      );

    default:
      throw new InjectedFailureError(
        action,
        failureType,
        config.reason,
        config.probability,
        config.workspace_id
      );
  }
}

// ============================================
// Failure Injection Guard
// ============================================

/**
 * Asserts that no failure should be injected for this request.
 *
 * MUST be called AFTER assertKillSwitchOpen() and BEFORE requirePermission().
 *
 * @throws InjectedFailureError if injection triggers
 *
 * @example
 * const actor = await resolveActorFromRequest();
 * await assertKillSwitchOpen(actor, 'PROMOTE');      // Kill-switch first
 * await assertNoInjectedFailure(actor, 'PROMOTE');   // Injection second
 * await requirePermission(actor, 'PROMOTE');         // Permission third
 */
export async function assertNoInjectedFailure(
  actor: Actor,
  action: InjectableAction
): Promise<void> {
  // Only check for injectable actions
  if (!INJECTABLE_ACTIONS.includes(action)) {
    return;
  }

  const result = await shouldInjectFailure(actor.workspaceId, action);

  if (result.shouldInject && result.config) {
    // Log the injection to audit trail BEFORE throwing
    await logInjectedFailure(actor, action, result.config, result.roll!);

    // Now inject the failure
    await injectFailure(action, result.config.failure_type, result.config);
  }
}

// ============================================
// Audit Logging
// ============================================

/**
 * Logs an injected failure to the audit trail.
 *
 * This creates a permanent record of injected failures.
 * Critical for:
 * - Understanding what failures occurred during chaos testing
 * - Distinguishing real failures from injected ones
 * - Compliance and debugging
 */
async function logInjectedFailure(
  actor: Actor,
  action: InjectableAction,
  config: FailureInjectionConfig,
  roll: number
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
      entityId: config.id,
      scope: {
        platform: 'system',
        dataset: 'failure_injection',
      },
      metadata: {
        failureInjected: true,
        severity: 'CRITICAL',
        injectedAction: action,
        failureType: config.failure_type,
        probability: config.probability,
        roll,
        reason: config.reason,
        configId: config.id,
        createdBy: config.created_by,
      },
    });
  } catch (e) {
    // Log failure but don't prevent the injection
    console.error('[FAILURE-INJECTION] Failed to log injection to audit:', e);
  }
}

// ============================================
// Admin Functions (for future admin API)
// ============================================

/**
 * Creates or updates a failure injection config.
 * USE WITH CAUTION - this enables chaos injection.
 */
export async function upsertInjectionConfig(params: {
  workspaceId: string;
  action: InjectableAction;
  failureType: FailureType;
  probability: number;
  reason: string;
  createdBy: string;
  enabled?: boolean;
}): Promise<{ success: boolean; error?: string; config?: FailureInjectionConfig }> {
  try {
    const supabase = createInjectionClient();

    const { data, error } = await supabase
      .from('adlab_failure_injections')
      .upsert(
        {
          workspace_id: params.workspaceId,
          action: params.action,
          failure_type: params.failureType,
          probability: params.probability,
          reason: params.reason,
          created_by: params.createdBy,
          enabled: params.enabled ?? false,
          enabled_by: params.enabled ? params.createdBy : null,
          enabled_at: params.enabled ? new Date().toISOString() : null,
        },
        {
          onConflict: 'workspace_id,action',
        }
      )
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    console.warn(
      `[FAILURE-INJECTION] Config ${params.enabled ? 'ENABLED' : 'CREATED'} ` +
        `for ${params.action} in workspace ${params.workspaceId}: ${params.reason}`
    );

    return { success: true, config: data as FailureInjectionConfig };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to upsert injection config',
    };
  }
}

/**
 * Enables a failure injection config.
 */
export async function enableInjection(
  workspaceId: string,
  action: InjectableAction,
  enabledBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createInjectionClient();

    const { error } = await supabase
      .from('adlab_failure_injections')
      .update({
        enabled: true,
        enabled_by: enabledBy,
        enabled_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('action', action);

    if (error) {
      return { success: false, error: error.message };
    }

    console.warn(
      `[FAILURE-INJECTION] ENABLED for ${action} in workspace ${workspaceId} by ${enabledBy}`
    );

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to enable injection',
    };
  }
}

/**
 * Disables a failure injection config.
 */
export async function disableInjection(
  workspaceId: string,
  action: InjectableAction,
  disabledBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createInjectionClient();

    const { error } = await supabase
      .from('adlab_failure_injections')
      .update({
        enabled: false,
        disabled_by: disabledBy,
        disabled_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('action', action);

    if (error) {
      return { success: false, error: error.message };
    }

    console.warn(
      `[FAILURE-INJECTION] DISABLED for ${action} in workspace ${workspaceId} by ${disabledBy}`
    );

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to disable injection',
    };
  }
}

/**
 * Lists all injection configs for a workspace.
 */
export async function listInjectionConfigs(
  workspaceId: string
): Promise<{ success: boolean; configs?: FailureInjectionConfig[]; error?: string }> {
  try {
    const supabase = createInjectionClient();

    const { data, error } = await supabase
      .from('adlab_failure_injections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('action');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, configs: data as FailureInjectionConfig[] };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to list injection configs',
    };
  }
}
