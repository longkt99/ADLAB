// ============================================
// AdLab Kill-Switch Control API
// ============================================
// PHASE D29: Compliance Control Panel.
//
// ENDPOINTS:
// - GET: Get current kill-switch status
// - POST: Toggle kill-switch (enable/disable)
//
// INVARIANTS:
// - Owner-only for mutations
// - Requires human reason
// - Logged to audit trail
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveActorFromRequest,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
  hasAtLeastRole,
} from '@/lib/adlab/auth';
import {
  getKillSwitchStatus,
  enableWorkspaceKillSwitch,
  disableWorkspaceKillSwitch,
} from '@/lib/adlab/safety';
import { appendAuditLog } from '@/lib/adlab/audit';

// ============================================
// GET: Current Kill-Switch Status
// ============================================

export async function GET() {
  try {
    const actor = await resolveActorFromRequest();
    const status = await getKillSwitchStatus(actor.workspaceId);

    return NextResponse.json({
      success: true,
      data: {
        enabled: status.blocked,
        scope: status.scope,
        reason: status.reason,
        activatedAt: status.activatedAt,
        activatedBy: status.activatedBy,
      },
    });
  } catch (e) {
    if (
      e instanceof NotAuthenticatedError ||
      e instanceof MissingMembershipError ||
      e instanceof InactiveMembershipError
    ) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.error('D29: Kill-switch GET error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: Toggle Kill-Switch
// ============================================

interface ToggleRequest {
  enabled: boolean;
  reason: string;
}

export async function POST(request: NextRequest) {
  try {
    // Resolve actor
    const actor = await resolveActorFromRequest();

    // Owner-only for kill-switch toggle
    if (!hasAtLeastRole(actor.role, 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = (await request.json()) as ToggleRequest;

    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing enabled field' },
        { status: 400 }
      );
    }

    if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Reason required (minimum 3 characters)' },
        { status: 400 }
      );
    }

    // Toggle kill-switch
    let result;
    if (body.enabled) {
      result = await enableWorkspaceKillSwitch(
        actor.workspaceId,
        body.reason.trim(),
        actor.id
      );
    } else {
      result = await disableWorkspaceKillSwitch(actor.workspaceId, actor.id);
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to toggle kill-switch' },
        { status: 500 }
      );
    }

    // Audit log - use VALIDATE action with control-specific metadata
    await appendAuditLog({
      context: {
        workspaceId: actor.workspaceId,
        actorId: actor.id,
        actorRole: actor.role,
      },
      action: 'VALIDATE',
      entityType: 'dataset',
      entityId: actor.workspaceId,
      scope: {
        platform: 'system',
        dataset: 'kill_switch',
      },
      reason: body.reason.trim(),
      metadata: {
        controlAction: body.enabled ? 'kill_switch_enabled' : 'kill_switch_disabled',
        enabled: body.enabled,
        scope: 'workspace',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        enabled: body.enabled,
        reason: body.reason.trim(),
      },
    });
  } catch (e) {
    if (
      e instanceof NotAuthenticatedError ||
      e instanceof MissingMembershipError ||
      e instanceof InactiveMembershipError
    ) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.error('D29: Kill-switch POST error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
