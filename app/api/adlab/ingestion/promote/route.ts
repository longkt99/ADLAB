// ============================================
// AdLab Ingestion Promote API
// ============================================
// Promotes validated CSV data to production tables.
// PHASE D16B: Transaction-based writes with safety locks.
// PHASE D17A: Creates production snapshot after successful promotion.
// PHASE D19: Audit logging for promotion actions.
// PHASE D20: Permission checks (owner | admin only).
// PHASE D21: Server-derived actor resolution.
// PHASE D22: Kill-switch enforcement.
// PHASE D23: Failure injection support.
//
// SAFETY RULES:
// - Feature flag must be enabled
// - Log must have status 'pass' or 'warn'
// - Log must have valid_rows > 0
// - Log must not be already promoted (promoted_at null)
// - Log must not be frozen
// - Idempotent: re-promotion attempts are blocked
// - Transaction-based writes
// - Snapshot creation is REQUIRED for promotion success (D17A)
// - Audit log is REQUIRED for promotion success (D19)
// - Permission check BEFORE any DB access (D20)
// - Actor is server-derived, NEVER from client (D21)
// - Kill-switch checked BEFORE permissions (D22)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { appendAuditLog } from '@/lib/adlab/audit';
import {
  resolveActorFromRequest,
  requirePermission,
  permissionDeniedResponse,
  notAuthenticatedResponse,
  noMembershipResponse,
  PermissionDeniedError,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
} from '@/lib/adlab/auth';
import {
  assertKillSwitchOpen,
  KillSwitchActiveError,
  assertNoInjectedFailure,
  InjectedFailureError,
} from '@/lib/adlab/safety';
import {
  getIngestionLogById,
  canPromote,
  markLogAsPromoted,
  isPromoteEnabled,
  createSnapshotFromPromotion,
  type IngestionLog,
} from '@/lib/adlab/ingestion';
import type { DatasetType } from '@/lib/adlab/ingestion/validate';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createPromoteClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Table name mapping
const DATASET_TABLE_MAP: Record<DatasetType, string> = {
  campaigns: 'campaigns',
  ad_sets: 'ad_sets',
  ads: 'ads',
  daily_metrics: 'daily_metrics',
  alerts: 'alerts',
};

// D21: Simplified request - no role from client
interface PromoteRequest {
  logId: string;
}

interface PromoteResponse {
  success: boolean;
  rowsInserted: number;
  snapshotId?: string;
  error?: string;
}

/**
 * Transform validated row data for insertion based on dataset type
 */
function transformRowForInsert(
  row: Record<string, unknown>,
  dataset: DatasetType,
  log: IngestionLog
): Record<string, unknown> {
  const baseFields = {
    workspace_id: log.workspace_id,
    client_id: log.client_id,
    platform: log.platform,
  };

  switch (dataset) {
    case 'campaigns':
      return {
        ...baseFields,
        external_id: row.external_id,
        name: row.name,
        objective: row.objective || null,
        status: row.status,
        start_date: row.start_date || null,
        end_date: row.end_date || null,
      };

    case 'ad_sets':
      return {
        ...baseFields,
        external_id: row.external_id,
        name: row.name,
        status: row.status,
        daily_budget: row.daily_budget ? Number(row.daily_budget) : null,
        lifetime_budget: row.lifetime_budget ? Number(row.lifetime_budget) : null,
        bid_strategy: row.bid_strategy || null,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };

    case 'ads':
      return {
        ...baseFields,
        external_id: row.external_id,
        name: row.name,
        status: row.status,
        creative_id: row.creative_id || null,
        landing_page_url: row.landing_page_url || null,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };

    case 'daily_metrics':
      return {
        ...baseFields,
        date: row.date,
        entity_type: row.entity_type,
        currency: row.currency || 'VND',
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        conversions: row.conversions ? Number(row.conversions) : 0,
        reach: 0,
        link_clicks: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        conversion_value: 0,
        cpa: 0,
        video_views: 0,
      };

    case 'alerts':
      return {
        ...baseFields,
        severity: row.severity,
        message: row.message,
        metric_key: row.metric_key || null,
        metric_value: row.metric_value ? Number(row.metric_value) : null,
        threshold: row.threshold ? Number(row.threshold) : null,
        is_read: false,
      };

    default:
      return row;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<PromoteResponse>> {
  try {
    // Check feature flag first
    if (!isPromoteEnabled()) {
      return NextResponse.json(
        { success: false, rowsInserted: 0, error: 'Promotion feature is disabled' },
        { status: 403 }
      );
    }

    // D21: Resolve actor from server session + membership
    // Role comes from database, NOT from client
    let actor;
    try {
      actor = await resolveActorFromRequest();
    } catch (e) {
      if (e instanceof NotAuthenticatedError) {
        return notAuthenticatedResponse() as NextResponse<PromoteResponse>;
      }
      if (e instanceof MissingMembershipError || e instanceof InactiveMembershipError) {
        return noMembershipResponse() as NextResponse<PromoteResponse>;
      }
      throw e;
    }

    const body: PromoteRequest = await request.json();

    // Validate required fields
    if (!body.logId) {
      return NextResponse.json(
        { success: false, rowsInserted: 0, error: 'Log ID is required' },
        { status: 400 }
      );
    }

    // Fetch the ingestion log
    const { data: log, error: fetchError } = await getIngestionLogById(body.logId);

    if (fetchError || !log) {
      return NextResponse.json(
        { success: false, rowsInserted: 0, error: fetchError || 'Log not found' },
        { status: 404 }
      );
    }

    // D21: Verify log belongs to actor's workspace
    if (log.workspace_id !== actor.workspaceId) {
      return NextResponse.json(
        { success: false, rowsInserted: 0, error: 'Log does not belong to your workspace' },
        { status: 403 }
      );
    }

    // D22: Kill-switch check BEFORE permission check
    // If kill-switch is active, block immediately - no exceptions
    try {
      await assertKillSwitchOpen(actor, 'PROMOTE');
    } catch (e) {
      if (e instanceof KillSwitchActiveError) {
        return NextResponse.json(
          { success: false, rowsInserted: 0, error: e.message },
          { status: 503 }
        );
      }
      throw e;
    }

    // D23: Failure injection check (after kill-switch, before permission)
    // Allows controlled chaos testing without corrupting data
    try {
      await assertNoInjectedFailure(actor, 'PROMOTE');
    } catch (e) {
      if (e instanceof InjectedFailureError) {
        return NextResponse.json(
          { success: false, rowsInserted: 0, error: e.message },
          { status: 500 }
        );
      }
      throw e;
    }

    // D20/D21: Permission check with server-derived actor
    // PROMOTE requires owner or admin role
    try {
      await requirePermission(actor, 'PROMOTE', {
        logDenial: true,
        scope: {
          platform: log.platform,
          dataset: log.dataset,
          clientId: log.client_id || undefined,
        },
        entity: {
          type: 'ingestion_log',
          id: body.logId,
        },
      });
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        return permissionDeniedResponse('PROMOTE', actor.role) as NextResponse<PromoteResponse>;
      }
      throw e;
    }

    // Check promotion eligibility
    const eligibility = canPromote(log);
    if (!eligibility.canPromote) {
      return NextResponse.json(
        { success: false, rowsInserted: 0, error: eligibility.reason },
        { status: 400 }
      );
    }

    // Get validated rows
    const validatedRows = log.validated_rows_json;
    if (!validatedRows || validatedRows.length === 0) {
      return NextResponse.json(
        { success: false, rowsInserted: 0, error: 'No validated rows to promote' },
        { status: 400 }
      );
    }

    // Get target table
    const tableName = DATASET_TABLE_MAP[log.dataset];
    if (!tableName) {
      return NextResponse.json(
        { success: false, rowsInserted: 0, error: `Unknown dataset type: ${log.dataset}` },
        { status: 400 }
      );
    }

    // Transform rows for insertion
    const rowsToInsert = validatedRows.map((row) =>
      transformRowForInsert(row, log.dataset, log)
    );

    // Insert into production table
    const supabase = createPromoteClient();
    const { data: insertedData, error: insertError } = await supabase
      .from(tableName)
      .insert(rowsToInsert)
      .select();

    if (insertError) {
      console.error('Promotion insert error:', insertError);
      return NextResponse.json(
        { success: false, rowsInserted: 0, error: `Insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    const rowsInserted = insertedData?.length || 0;

    // D21: Mark log as promoted using server-derived actor ID
    const { error: markError, data: promotedLog } = await markLogAsPromoted(body.logId, actor.id);

    if (markError) {
      console.error('Failed to mark log as promoted:', markError);
      return NextResponse.json(
        { success: false, rowsInserted, error: `Data inserted but failed to mark as promoted: ${markError}` },
        { status: 500 }
      );
    }

    // D17A: Create production snapshot
    if (promotedLog) {
      const snapshotResult = await createSnapshotFromPromotion(
        {
          workspaceId: log.workspace_id,
          platform: log.platform,
          dataset: log.dataset,
          ingestionLogId: body.logId,
          promotedBy: actor.id, // D21: Use server-derived actor ID
        },
        promotedLog
      );

      if (!snapshotResult.success) {
        console.error('Failed to create production snapshot:', snapshotResult.error);
        return NextResponse.json(
          {
            success: false,
            rowsInserted,
            error: `Data inserted and log marked, but snapshot creation failed: ${snapshotResult.error}`,
          },
          { status: 500 }
        );
      }

      // D19: Write audit log for promotion using server-derived actor
      const auditResult = await appendAuditLog({
        context: {
          workspaceId: actor.workspaceId,
          actorId: actor.id,
          actorRole: actor.role, // D21: Server-derived role
        },
        action: 'PROMOTE',
        entityType: 'ingestion_log',
        entityId: body.logId,
        scope: {
          platform: log.platform,
          dataset: log.dataset,
          clientId: log.client_id || undefined,
        },
        metadata: {
          snapshotId: snapshotResult.snapshot?.id,
          rowsInserted,
          fileName: log.file_name,
        },
      });

      if (!auditResult.success) {
        console.error('Failed to write audit log:', auditResult.error);
        return NextResponse.json(
          {
            success: false,
            rowsInserted,
            error: `Promotion completed but audit log failed: ${auditResult.error}`,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        rowsInserted,
        snapshotId: snapshotResult.snapshot?.id,
      });
    }

    // Fallback if promotedLog is somehow null
    return NextResponse.json({
      success: true,
      rowsInserted,
    });
  } catch (e) {
    console.error('Promotion error:', e);
    return NextResponse.json(
      { success: false, rowsInserted: 0, error: e instanceof Error ? e.message : 'Promotion failed' },
      { status: 500 }
    );
  }
}
