// ============================================
// AdLab Compliance Run Control API
// ============================================
// PHASE D29: Compliance Control Panel.
//
// ENDPOINTS:
// - GET: Get current compliance status
// - POST: Trigger manual compliance check
//
// INVARIANTS:
// - Owner-only for triggering checks
// - Uses existing compliance monitor
// ============================================

import { NextResponse } from 'next/server';
import {
  resolveActorFromRequest,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
  hasAtLeastRole,
} from '@/lib/adlab/auth';
import {
  checkWorkspaceCompliance,
  runGlobalComplianceCheck,
} from '@/lib/adlab/ops';
import { appendAuditLog } from '@/lib/adlab/audit';

// ============================================
// GET: Get Current Compliance Status
// ============================================

export async function GET() {
  try {
    const actor = await resolveActorFromRequest();

    // Run compliance check
    const result = await checkWorkspaceCompliance(actor.workspaceId);

    return NextResponse.json({
      success: true,
      data: {
        status: result.status,
        timestamp: result.timestamp,
        driftCount: result.driftItems.length,
        driftItems: result.driftItems,
        summary: {
          total: result.driftItems.length,
          critical: result.driftItems.filter((d) => d.severity === 'CRITICAL').length,
          high: result.driftItems.filter((d) => d.severity === 'HIGH').length,
          medium: result.driftItems.filter((d) => d.severity === 'MEDIUM').length,
          low: result.driftItems.filter((d) => d.severity === 'LOW').length,
        },
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
    console.error('D29: Compliance GET error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: Trigger Manual Compliance Check
// ============================================

interface RunRequest {
  scope: 'workspace' | 'global';
  reason: string;
}

export async function POST(request: Request) {
  try {
    // Resolve actor
    const actor = await resolveActorFromRequest();

    // Owner-only for triggering compliance checks
    if (!hasAtLeastRole(actor.role, 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = (await request.json()) as RunRequest;

    // Validate scope
    if (!body.scope || !['workspace', 'global'].includes(body.scope)) {
      return NextResponse.json(
        { success: false, error: 'Invalid scope. Valid: workspace, global' },
        { status: 400 }
      );
    }

    // Validate reason
    if (!body.reason || body.reason.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Reason required (minimum 3 characters)' },
        { status: 400 }
      );
    }

    // Run compliance check
    let globalStatus: string;
    let timestamp: string;
    let totalDrift: number;
    let criticalDrift: number;
    let workspaces: Array<{ workspaceId: string; status: string; driftCount: number }>;

    if (body.scope === 'global') {
      const globalResult = await runGlobalComplianceCheck();
      globalStatus = globalResult.status;
      timestamp = globalResult.timestamp;
      totalDrift = globalResult.globalDrift.length + globalResult.workspaceResults.reduce(
        (sum, w) => sum + w.driftItems.length,
        0
      );
      criticalDrift = globalResult.globalDrift.filter((d) => d.severity === 'CRITICAL').length +
        globalResult.workspaceResults.reduce(
          (sum, w) => sum + w.driftItems.filter((d) => d.severity === 'CRITICAL').length,
          0
        );
      workspaces = globalResult.workspaceResults.map((w) => ({
        workspaceId: w.workspaceId,
        status: w.status,
        driftCount: w.driftItems.length,
      }));
    } else {
      const workspaceResult = await checkWorkspaceCompliance(actor.workspaceId);
      globalStatus = workspaceResult.status;
      timestamp = workspaceResult.timestamp;
      totalDrift = workspaceResult.driftItems.length;
      criticalDrift = workspaceResult.driftItems.filter(
        (d) => d.severity === 'CRITICAL'
      ).length;
      workspaces = [
        {
          workspaceId: actor.workspaceId,
          status: workspaceResult.status,
          driftCount: workspaceResult.driftItems.length,
        },
      ];
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
      entityId: body.scope === 'global' ? 'global' : actor.workspaceId,
      scope: {
        platform: 'system',
        dataset: 'compliance',
      },
      reason: body.reason.trim(),
      metadata: {
        controlAction: 'compliance_check_triggered',
        scope: body.scope,
        status: globalStatus,
        totalDrift,
        criticalDrift,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        scope: body.scope,
        status: globalStatus,
        timestamp,
        totalDrift,
        criticalDrift,
        workspaces,
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
    console.error('D29: Compliance POST error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
