// ============================================
// AdLab Snapshot Rollback API
// ============================================
// PHASE D18: Production snapshot rollback endpoint.
// PHASE D19: Audit logging for rollback actions.
// PHASE D20: Permission checks (owner ONLY - most dangerous action).
// PHASE D21: Server-derived actor resolution.
// PHASE D22: Kill-switch enforcement.
// PHASE D23: Failure injection support.
//
// CRITICAL SAFETY RULES:
// - Snapshot must exist
// - Snapshot must be INACTIVE (cannot rollback to current)
// - Snapshot must belong to caller's workspace
// - Actor must have OWNER role ONLY (D20)
// - NO data deletion - only is_active flip
// - NO partial state - atomic operation
// - Audit log is REQUIRED for rollback success (D19)
// - Permission check BEFORE any DB access (D20)
// - Actor is server-derived, NEVER from client (D21)
//
// CORE PRINCIPLE:
// Production is not time-based.
// Production is snapshot-based.
// Rollback is a decision, not an accident.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getSnapshotById,
  rollbackToSnapshot,
  getActiveSnapshot,
} from '@/lib/adlab/ingestion/snapshots';
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

// D21: Simplified request - no role from client
interface RollbackRequest {
  snapshotId: string;
  reason: string;
}

interface RollbackResponse {
  success: boolean;
  newActiveSnapshotId?: string;
  previousSnapshotId?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<RollbackResponse>> {
  try {
    // D21: Resolve actor from server session + membership
    // Role comes from database, NOT from client
    let actor;
    try {
      actor = await resolveActorFromRequest();
    } catch (e) {
      if (e instanceof NotAuthenticatedError) {
        return notAuthenticatedResponse() as NextResponse<RollbackResponse>;
      }
      if (e instanceof MissingMembershipError || e instanceof InactiveMembershipError) {
        return noMembershipResponse() as NextResponse<RollbackResponse>;
      }
      throw e;
    }

    // Parse and validate request body
    const body: RollbackRequest = await request.json();

    if (!body.snapshotId) {
      return NextResponse.json(
        { success: false, error: 'Snapshot ID is required' },
        { status: 400 }
      );
    }

    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Rollback reason is required' },
        { status: 400 }
      );
    }

    // Fetch target snapshot
    const { data: targetSnapshot, error: fetchError } = await getSnapshotById(body.snapshotId);

    if (fetchError || !targetSnapshot) {
      return NextResponse.json(
        { success: false, error: fetchError || 'Snapshot not found' },
        { status: 404 }
      );
    }

    // D21: Verify snapshot belongs to actor's workspace
    if (targetSnapshot.workspace_id !== actor.workspaceId) {
      return NextResponse.json(
        { success: false, error: 'Snapshot does not belong to your workspace' },
        { status: 403 }
      );
    }

    // Verify snapshot is not already active
    if (targetSnapshot.is_active) {
      return NextResponse.json(
        { success: false, error: 'Cannot rollback to an already active snapshot' },
        { status: 400 }
      );
    }

    // D22: Kill-switch check BEFORE permission check
    // If kill-switch is active, block immediately - no exceptions
    try {
      await assertKillSwitchOpen(actor, 'ROLLBACK');
    } catch (e) {
      if (e instanceof KillSwitchActiveError) {
        return NextResponse.json(
          { success: false, error: e.message },
          { status: 503 }
        );
      }
      throw e;
    }

    // D23: Failure injection check (after kill-switch, before permission)
    // Allows controlled chaos testing without corrupting data
    try {
      await assertNoInjectedFailure(actor, 'ROLLBACK');
    } catch (e) {
      if (e instanceof InjectedFailureError) {
        return NextResponse.json(
          { success: false, error: e.message },
          { status: 500 }
        );
      }
      throw e;
    }

    // D20/D21: Permission check with server-derived actor
    // ROLLBACK requires OWNER role ONLY - this is the most dangerous action
    try {
      await requirePermission(actor, 'ROLLBACK', {
        logDenial: true,
        scope: {
          platform: targetSnapshot.platform,
          dataset: targetSnapshot.dataset,
        },
        entity: {
          type: 'snapshot',
          id: body.snapshotId,
        },
      });
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        return permissionDeniedResponse('ROLLBACK', actor.role) as NextResponse<RollbackResponse>;
      }
      throw e;
    }

    // Get current active snapshot for reference
    const { data: currentActive } = await getActiveSnapshot(
      targetSnapshot.workspace_id,
      targetSnapshot.platform,
      targetSnapshot.dataset
    );

    const previousSnapshotId = currentActive?.id;

    // Perform rollback using server-derived actor
    const result = await rollbackToSnapshot(
      {
        snapshotId: body.snapshotId,
        reason: body.reason,
        actor: actor.id, // D21: Server-derived actor ID
        actorRole: actor.role, // D21: Server-derived role
      },
      actor.workspaceId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Rollback failed' },
        { status: 500 }
      );
    }

    // D19: Write audit log for rollback using server-derived actor
    const auditResult = await appendAuditLog({
      context: {
        workspaceId: actor.workspaceId,
        actorId: actor.id, // D21: Server-derived actor ID
        actorRole: actor.role, // D21: Server-derived role
      },
      action: 'ROLLBACK',
      entityType: 'snapshot',
      entityId: body.snapshotId,
      scope: {
        platform: targetSnapshot.platform,
        dataset: targetSnapshot.dataset,
      },
      reason: body.reason,
      metadata: {
        previousSnapshotId,
        newActiveSnapshotId: result.snapshot?.id,
        ingestionLogId: targetSnapshot.ingestion_log_id,
      },
    });

    if (!auditResult.success) {
      console.error('Failed to write rollback audit log:', auditResult.error);
      return NextResponse.json(
        {
          success: false,
          error: `Rollback completed but audit log failed: ${auditResult.error}`,
        },
        { status: 500 }
      );
    }

    // Return success with new active snapshot ID
    return NextResponse.json({
      success: true,
      newActiveSnapshotId: result.snapshot?.id,
      previousSnapshotId,
    });
  } catch (e) {
    console.error('Rollback API error:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Rollback failed' },
      { status: 500 }
    );
  }
}
