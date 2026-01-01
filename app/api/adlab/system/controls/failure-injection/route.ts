// ============================================
// AdLab Failure Injection Control API
// ============================================
// PHASE D29: Compliance Control Panel.
//
// ENDPOINTS:
// - GET: List all injection configs for workspace
// - POST: Create/update/toggle injection config
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
  listInjectionConfigs,
  upsertInjectionConfig,
  enableInjection,
  disableInjection,
  type InjectableAction,
  type FailureType,
  INJECTABLE_ACTIONS,
  FAILURE_TYPES,
} from '@/lib/adlab/safety';
import { appendAuditLog } from '@/lib/adlab/audit';

// ============================================
// GET: List All Injection Configs
// ============================================

export async function GET() {
  try {
    const actor = await resolveActorFromRequest();
    const result = await listInjectionConfigs(actor.workspaceId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        configs: result.configs || [],
        availableActions: INJECTABLE_ACTIONS,
        availableFailureTypes: FAILURE_TYPES,
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
    console.error('D29: Failure injection GET error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: Upsert/Toggle Injection Config
// ============================================

interface UpsertRequest {
  action: InjectableAction;
  failureType: FailureType;
  probability: number;
  reason: string;
  enabled: boolean;
}

interface ToggleRequest {
  action: InjectableAction;
  enabled: boolean;
  reason?: string;
}

type RequestBody = UpsertRequest | ToggleRequest;

function isUpsertRequest(body: RequestBody): body is UpsertRequest {
  return 'failureType' in body && 'probability' in body;
}

export async function POST(request: NextRequest) {
  try {
    // Resolve actor
    const actor = await resolveActorFromRequest();

    // Owner-only for failure injection
    if (!hasAtLeastRole(actor.role, 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = (await request.json()) as RequestBody;

    // Validate action
    if (!body.action || !INJECTABLE_ACTIONS.includes(body.action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Valid: ${INJECTABLE_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    let result;
    let auditAction: string;

    if (isUpsertRequest(body)) {
      // Full upsert with config
      if (!FAILURE_TYPES.includes(body.failureType)) {
        return NextResponse.json(
          { success: false, error: `Invalid failureType. Valid: ${FAILURE_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      if (typeof body.probability !== 'number' || body.probability < 0 || body.probability > 100) {
        return NextResponse.json(
          { success: false, error: 'Probability must be 0-100' },
          { status: 400 }
        );
      }

      if (!body.reason || body.reason.trim().length < 3) {
        return NextResponse.json(
          { success: false, error: 'Reason required (minimum 3 characters)' },
          { status: 400 }
        );
      }

      result = await upsertInjectionConfig({
        workspaceId: actor.workspaceId,
        action: body.action,
        failureType: body.failureType,
        probability: body.probability,
        reason: body.reason.trim(),
        createdBy: actor.id,
        enabled: body.enabled,
      });

      auditAction = body.enabled ? 'failure_injection_enabled' : 'failure_injection_configured';
    } else {
      // Simple toggle
      if (body.enabled) {
        result = await enableInjection(actor.workspaceId, body.action, actor.id);
        auditAction = 'failure_injection_enabled';
      } else {
        result = await disableInjection(actor.workspaceId, body.action, actor.id);
        auditAction = 'failure_injection_disabled';
      }
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update injection config' },
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
      entityId: body.action,
      scope: {
        platform: 'system',
        dataset: 'failure_injection',
      },
      reason: isUpsertRequest(body) ? body.reason : body.reason || 'Toggle injection',
      metadata: isUpsertRequest(body)
        ? {
            controlAction: auditAction,
            action: body.action,
            failureType: body.failureType,
            probability: body.probability,
            enabled: body.enabled,
          }
        : {
            controlAction: auditAction,
            action: body.action,
            enabled: body.enabled,
          },
    });

    return NextResponse.json({
      success: true,
      data: {
        action: body.action,
        enabled: body.enabled,
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
    console.error('D29: Failure injection POST error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
