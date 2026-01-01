// ============================================
// AdLab Ingestion Log Queries
// ============================================
// PHASE D16A: Ingestion logs data access layer.
//
// SAFETY RULES:
// - Only SELECT and INSERT for logs table
// - No writes to production data tables
// - Workspace-scoped queries
// ============================================

import { createClient } from '@supabase/supabase-js';
import type { DatasetType, PlatformType, ValidationStatus, ValidationError } from './validate';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createIngestionClient() {
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

export interface IngestionLog {
  id: string;
  workspace_id: string;
  client_id: string | null;
  platform: PlatformType;
  dataset: DatasetType;
  file_name: string;
  file_size: number;
  rows_parsed: number;
  valid_rows: number;
  status: ValidationStatus;
  message: string;
  preview_json: Record<string, unknown>[] | null;
  errors_json: ValidationError[] | null;
  /** All validated rows payload for promotion (D16B) */
  validated_rows_json: Record<string, unknown>[] | null;
  /** Timestamp when promoted to production (D16B) */
  promoted_at: string | null;
  /** User ID who promoted (D16B) */
  promoted_by: string | null;
  /** Frozen flag - prevents re-promotion (D16B) */
  frozen: boolean;
  created_at: string;
}

export interface IngestionLogInput {
  workspace_id: string;
  client_id?: string | null;
  platform: PlatformType;
  dataset: DatasetType;
  file_name: string;
  file_size: number;
  rows_parsed: number;
  valid_rows: number;
  status: ValidationStatus;
  message: string;
  preview_json?: Record<string, unknown>[] | null;
  errors_json?: ValidationError[] | null;
  /** All validated rows for promotion (D16B) */
  validated_rows_json?: Record<string, unknown>[] | null;
}

export interface QueryResult<T> {
  data: T[];
  error: string | null;
  count: number;
}

export interface SingleResult<T> {
  data: T | null;
  error: string | null;
}

export interface MutationResult {
  success: boolean;
  data?: IngestionLog;
  error: string | null;
}

// ============================================
// Feature Flag
// ============================================

export function isIngestionEnabled(): boolean {
  // Check env var for feature flag
  const flag = process.env.NEXT_PUBLIC_INGESTION_UI_ENABLED;
  return flag === 'true' || flag === '1';
}

/**
 * Check if promotion to production is enabled (D16B)
 */
export function isPromoteEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_INGESTION_PROMOTE_ENABLED;
  return flag === 'true' || flag === '1';
}

// ============================================
// Queries
// ============================================

/**
 * Get ingestion logs for a workspace
 */
export async function getIngestionLogs(
  workspaceId: string,
  clientId?: string | null,
  limit = 50
): Promise<QueryResult<IngestionLog>> {
  try {
    const supabase = createIngestionClient();
    let query = supabase
      .from('adlab_ingestion_logs')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message, count: 0 };
    }

    return { data: (data as IngestionLog[]) || [], error: null, count: count || 0 };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error', count: 0 };
  }
}

/**
 * Get a single ingestion log by ID
 */
export async function getIngestionLogById(id: string): Promise<SingleResult<IngestionLog>> {
  try {
    const supabase = createIngestionClient();
    const { data, error } = await supabase
      .from('adlab_ingestion_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as IngestionLog, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Get the most recent successful ingestion for a workspace
 * Used for data freshness indicator
 */
export async function getLatestSuccessfulIngestion(
  workspaceId: string,
  clientId?: string | null
): Promise<SingleResult<IngestionLog>> {
  try {
    const supabase = createIngestionClient();
    let query = supabase
      .from('adlab_ingestion_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('status', ['pass', 'warn']);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No data is not an error for this case
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      return { data: null, error: error.message };
    }

    return { data: data as IngestionLog, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Insert a new ingestion log
 */
export async function createIngestionLog(input: IngestionLogInput): Promise<MutationResult> {
  try {
    const supabase = createIngestionClient();
    const { data, error } = await supabase
      .from('adlab_ingestion_logs')
      .insert({
        workspace_id: input.workspace_id,
        client_id: input.client_id || null,
        platform: input.platform,
        dataset: input.dataset,
        file_name: input.file_name,
        file_size: input.file_size,
        rows_parsed: input.rows_parsed,
        valid_rows: input.valid_rows,
        status: input.status,
        message: input.message,
        preview_json: input.preview_json || null,
        errors_json: input.errors_json || null,
        validated_rows_json: input.validated_rows_json || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as IngestionLog, error: null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ============================================
// Promotion Functions (D16B)
// ============================================

export interface PromoteResult {
  success: boolean;
  rowsInserted: number;
  error: string | null;
}

/**
 * Check if a log can be promoted
 */
export function canPromote(log: IngestionLog): { canPromote: boolean; reason?: string } {
  // Must have valid status
  if (log.status === 'fail') {
    return { canPromote: false, reason: 'Validation status must be "pass" or "warn"' };
  }

  // Must have valid rows
  if (log.valid_rows <= 0) {
    return { canPromote: false, reason: 'No valid rows to promote' };
  }

  // Must not be already promoted
  if (log.promoted_at) {
    return { canPromote: false, reason: 'Already promoted' };
  }

  // Must not be frozen
  if (log.frozen) {
    return { canPromote: false, reason: 'Log is frozen' };
  }

  // Must have validated rows data
  if (!log.validated_rows_json || log.validated_rows_json.length === 0) {
    return { canPromote: false, reason: 'No validated rows data available' };
  }

  return { canPromote: true };
}

/**
 * Mark a log as promoted (update promoted_at, promoted_by, frozen)
 */
export async function markLogAsPromoted(
  logId: string,
  userId: string
): Promise<MutationResult> {
  try {
    const supabase = createIngestionClient();
    const { data, error } = await supabase
      .from('adlab_ingestion_logs')
      .update({
        promoted_at: new Date().toISOString(),
        promoted_by: userId,
        frozen: true,
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as IngestionLog, error: null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ============================================
// Data Freshness Helper
// ============================================

export interface DataFreshness {
  lastIngestion: Date | null;
  isStale: boolean;
  message: string;
}

/**
 * Calculate data freshness status
 * Data is considered stale if last successful ingestion > 24 hours ago
 */
export function calculateDataFreshness(log: IngestionLog | null): DataFreshness {
  if (!log) {
    return {
      lastIngestion: null,
      isStale: true,
      message: 'No ingestion data',
    };
  }

  const lastIngestion = new Date(log.created_at);
  const now = new Date();
  const hoursSince = (now.getTime() - lastIngestion.getTime()) / (1000 * 60 * 60);

  const isStale = hoursSince > 24;

  let message: string;
  if (hoursSince < 1) {
    message = 'Data updated recently';
  } else if (hoursSince < 24) {
    message = `Data updated ${Math.floor(hoursSince)}h ago`;
  } else if (hoursSince < 48) {
    message = 'Data may be stale (>24h)';
  } else {
    message = `Data stale (${Math.floor(hoursSince / 24)}d ago)`;
  }

  return {
    lastIngestion,
    isStale,
    message,
  };
}
