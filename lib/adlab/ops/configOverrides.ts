// ============================================
// AdLab Config Overrides
// ============================================
// PHASE D29: Compliance Control Panel + Safe Overrides.
//
// PROVIDES:
// - getOverride: retrieves a single config override
// - setOverride: upserts an override with reason (owner-only via API)
// - listOverrides: lists all active overrides for a workspace
// - deleteOverride: soft-deletes an override (sets enabled=false)
//
// INVARIANTS:
// - All mutations go through service role
// - API layer validates ownership before calling mutations
// - All writes require human reason
// - Soft-delete pattern (no hard deletes)
// ============================================

import { createClient } from '@supabase/supabase-js';
import { appendAuditLog } from '../audit';

// ============================================
// Types
// ============================================

/** Config override record */
export interface ConfigOverride {
  id: string;
  workspaceId: string;
  key: string;
  valueJson: unknown;
  reason: string;
  setBy: string;
  enabled: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Input for setting an override */
export interface SetOverrideInput {
  workspaceId: string;
  key: string;
  value: unknown;
  reason: string;
  setBy: string;
  expiresAt?: string | null;
}

/** Well-known config keys */
export type ConfigKey =
  | 'freshness.daily_metrics.warn_minutes'
  | 'freshness.daily_metrics.fail_minutes'
  | 'freshness.campaigns.warn_minutes'
  | 'freshness.campaigns.fail_minutes'
  | 'freshness.ad_sets.warn_minutes'
  | 'freshness.ad_sets.fail_minutes'
  | 'freshness.ads.warn_minutes'
  | 'freshness.ads.fail_minutes'
  | 'freshness.alerts.warn_minutes'
  | 'freshness.alerts.fail_minutes'
  | 'compliance.sla_multiplier'
  | 'compliance.warn_threshold'
  | 'compliance.fail_threshold';

// ============================================
// Database Client (Service Role)
// ============================================

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('D29: Missing Supabase configuration for config overrides');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// ============================================
// Transform Helpers
// ============================================

function transformRow(row: Record<string, unknown>): ConfigOverride {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    key: row.key as string,
    valueJson: row.value_json,
    reason: row.reason as string,
    setBy: row.set_by as string,
    enabled: row.enabled as boolean,
    expiresAt: row.expires_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ============================================
// Read Operations
// ============================================

/**
 * Gets a single config override by workspace and key.
 *
 * @param workspaceId - Workspace UUID
 * @param key - Config key
 * @param includeDisabled - Whether to include disabled overrides (default false)
 */
export async function getOverride(
  workspaceId: string,
  key: string,
  includeDisabled = false
): Promise<{ data: ConfigOverride | null; error: string | null }> {
  try {
    const supabase = getServiceClient();

    let query = supabase
      .from('adlab_config_overrides')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('key', key);

    if (!includeDisabled) {
      query = query.eq('enabled', true);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      // D29: Gracefully handle missing table/schema errors in demo mode
      // PostgREST error codes: PGRST200-series are table/schema issues
      const isSchemaError = error.code?.startsWith('PGRST') || error.message?.includes('schema cache');
      if (!isSchemaError) {
        console.warn('D29: Error fetching override:', error.message);
      }
      return { data: null, error: null }; // Fail-open: return null, not error
    }

    // Check expiration
    if (data && data.expires_at) {
      const expiresAt = new Date(data.expires_at as string).getTime();
      if (expiresAt < Date.now()) {
        // Expired - treat as not found
        return { data: null, error: null };
      }
    }

    return {
      data: data ? transformRow(data as Record<string, unknown>) : null,
      error: null,
    };
  } catch (err) {
    // D29: Silent fail in demo mode - config overrides are optional
    return { data: null, error: null };
  }
}

/**
 * Gets a numeric override value, falling back to default if not found.
 *
 * @param workspaceId - Workspace UUID
 * @param key - Config key
 * @param defaultValue - Default value if override not found
 */
export async function getNumericOverride(
  workspaceId: string,
  key: string,
  defaultValue: number
): Promise<number> {
  const { data } = await getOverride(workspaceId, key);
  if (data && typeof data.valueJson === 'number') {
    return data.valueJson;
  }
  return defaultValue;
}

/**
 * Lists all active overrides for a workspace.
 *
 * @param workspaceId - Workspace UUID
 * @param includeDisabled - Whether to include disabled overrides (default false)
 */
export async function listOverrides(
  workspaceId: string,
  includeDisabled = false
): Promise<{ data: ConfigOverride[]; error: string | null }> {
  try {
    const supabase = getServiceClient();

    let query = supabase
      .from('adlab_config_overrides')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('key', { ascending: true });

    if (!includeDisabled) {
      query = query.eq('enabled', true);
    }

    const { data, error } = await query;

    if (error) {
      // D29: Gracefully handle missing table/schema errors in demo mode
      const isSchemaError = error.code?.startsWith('PGRST') || error.message?.includes('schema cache');
      if (!isSchemaError) {
        console.warn('D29: Error listing overrides:', error.message);
      }
      return { data: [], error: null }; // Fail-open: return empty array
    }

    // Filter out expired ones
    const now = Date.now();
    const activeOverrides = (data || [])
      .filter((row) => {
        if (row.expires_at) {
          const expiresAt = new Date(row.expires_at as string).getTime();
          return expiresAt > now;
        }
        return true;
      })
      .map((row) => transformRow(row as Record<string, unknown>));

    return { data: activeOverrides, error: null };
  } catch (err) {
    // D29: Silent fail in demo mode - config overrides are optional
    return { data: [], error: null };
  }
}

// ============================================
// Write Operations
// ============================================

/**
 * Sets (upserts) a config override.
 *
 * INVARIANT: Caller must validate ownership before calling.
 *
 * @param input - Override input
 */
export async function setOverride(
  input: SetOverrideInput
): Promise<{ data: ConfigOverride | null; error: string | null }> {
  try {
    const supabase = getServiceClient();

    // Check if override already exists
    const { data: existing } = await supabase
      .from('adlab_config_overrides')
      .select('id')
      .eq('workspace_id', input.workspaceId)
      .eq('key', input.key)
      .maybeSingle();

    let result;
    const isUpdate = !!existing;

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('adlab_config_overrides')
        .update({
          value_json: input.value,
          reason: input.reason,
          set_by: input.setBy,
          enabled: true,
          expires_at: input.expiresAt || null,
        })
        .eq('id', existing.id)
        .select()
        .single();

      result = { data, error };
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('adlab_config_overrides')
        .insert({
          workspace_id: input.workspaceId,
          key: input.key,
          value_json: input.value,
          reason: input.reason,
          set_by: input.setBy,
          enabled: true,
          expires_at: input.expiresAt || null,
        })
        .select()
        .single();

      result = { data, error };
    }

    if (result.error) {
      console.error('D29: Error setting override:', result.error);
      return { data: null, error: result.error.message };
    }

    // Audit log - use VALIDATE action type with control-specific metadata
    await appendAuditLog({
      context: {
        workspaceId: input.workspaceId,
        actorId: input.setBy,
        actorRole: 'owner', // D29: Only owners can set overrides
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: result.data.id,
      scope: {
        platform: 'system',
        dataset: 'config_override',
      },
      reason: input.reason,
      metadata: {
        configOverrideAction: isUpdate ? 'updated' : 'created',
        key: input.key,
        value: input.value,
        expiresAt: input.expiresAt || null,
      },
    });

    return {
      data: transformRow(result.data as Record<string, unknown>),
      error: null,
    };
  } catch (err) {
    console.error('D29: Exception setting override:', err);
    return { data: null, error: String(err) };
  }
}

/**
 * Deletes (soft-delete) a config override.
 *
 * INVARIANT: Caller must validate ownership before calling.
 *
 * @param workspaceId - Workspace UUID
 * @param key - Config key
 * @param actorId - User performing the deletion
 * @param reason - Human-readable reason
 */
export async function deleteOverride(
  workspaceId: string,
  key: string,
  actorId: string,
  reason: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = getServiceClient();

    // Find the override
    const { data: existing } = await supabase
      .from('adlab_config_overrides')
      .select('id, value_json')
      .eq('workspace_id', workspaceId)
      .eq('key', key)
      .eq('enabled', true)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: 'Override not found' };
    }

    // Soft-delete by setting enabled=false
    const { error } = await supabase
      .from('adlab_config_overrides')
      .update({ enabled: false })
      .eq('id', existing.id);

    if (error) {
      console.error('D29: Error deleting override:', error);
      return { success: false, error: error.message };
    }

    // Audit log - use VALIDATE action type with control-specific metadata
    await appendAuditLog({
      context: {
        workspaceId,
        actorId,
        actorRole: 'owner', // D29: Only owners can delete overrides
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: existing.id,
      scope: {
        platform: 'system',
        dataset: 'config_override',
      },
      reason,
      metadata: {
        configOverrideAction: 'deleted',
        key,
        previousValue: existing.value_json,
      },
    });

    return { success: true, error: null };
  } catch (err) {
    console.error('D29: Exception deleting override:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// Freshness Override Helpers
// ============================================

/**
 * Gets freshness warn/fail overrides for a dataset.
 *
 * @param workspaceId - Workspace UUID
 * @param dataset - Dataset key
 */
export async function getFreshnessOverrides(
  workspaceId: string,
  dataset: string
): Promise<{
  warnMinutes: number | null;
  failMinutes: number | null;
}> {
  const warnKey = `freshness.${dataset}.warn_minutes`;
  const failKey = `freshness.${dataset}.fail_minutes`;

  const [warnResult, failResult] = await Promise.all([
    getOverride(workspaceId, warnKey),
    getOverride(workspaceId, failKey),
  ]);

  return {
    warnMinutes:
      warnResult.data && typeof warnResult.data.valueJson === 'number'
        ? warnResult.data.valueJson
        : null,
    failMinutes:
      failResult.data && typeof failResult.data.valueJson === 'number'
        ? failResult.data.valueJson
        : null,
  };
}

/**
 * Sets freshness overrides for a dataset.
 *
 * @param workspaceId - Workspace UUID
 * @param dataset - Dataset key
 * @param warnMinutes - Warn threshold in minutes (null to skip)
 * @param failMinutes - Fail threshold in minutes (null to skip)
 * @param actorId - User performing the action
 * @param reason - Human-readable reason
 * @param expiresAt - Optional expiration timestamp
 */
export async function setFreshnessOverrides(
  workspaceId: string,
  dataset: string,
  warnMinutes: number | null,
  failMinutes: number | null,
  actorId: string,
  reason: string,
  expiresAt?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const results: { success: boolean; error: string | null }[] = [];

    if (warnMinutes !== null) {
      const warnKey = `freshness.${dataset}.warn_minutes`;
      const result = await setOverride({
        workspaceId,
        key: warnKey,
        value: warnMinutes,
        reason,
        setBy: actorId,
        expiresAt,
      });
      results.push({ success: !!result.data, error: result.error });
    }

    if (failMinutes !== null) {
      const failKey = `freshness.${dataset}.fail_minutes`;
      const result = await setOverride({
        workspaceId,
        key: failKey,
        value: failMinutes,
        reason,
        setBy: actorId,
        expiresAt,
      });
      results.push({ success: !!result.data, error: result.error });
    }

    const firstError = results.find((r) => r.error);
    if (firstError) {
      return { success: false, error: firstError.error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('D29: Exception setting freshness overrides:', err);
    return { success: false, error: String(err) };
  }
}
