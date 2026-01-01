// ============================================
// Trust Rollback API
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// PROVIDES:
// - GET: Check rollback eligibility
// - POST: Perform rollback (Owner only)
//
// INVARIANTS:
// - Rollback is fast
// - Rollback is logged
// - Rollback is customer-visible
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveActorFromRequest,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
} from '@/lib/adlab/auth';
import { auditLog } from '@/lib/adlab/audit';
import {
  getActiveVersion,
  getEligibleRollbackVersions,
  checkRollbackEligibility,
  performRollback,
  simulateRollback,
  type TrustVersion,
  isValidVersion,
} from '@/lib/adlab/trust';

// ============================================
// GET Handler - Check Eligibility
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Only Owner can view rollback options
    if (actor.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetVersion = searchParams.get('version');

    const activeVersion = getActiveVersion();
    const eligibleVersions = getEligibleRollbackVersions();

    // If specific version requested, check its eligibility
    if (targetVersion) {
      if (!isValidVersion(targetVersion)) {
        return NextResponse.json(
          { success: false, error: 'Invalid version format' },
          { status: 400 }
        );
      }

      const eligibility = checkRollbackEligibility(targetVersion as TrustVersion);
      const simulation = simulateRollback(targetVersion as TrustVersion);

      return NextResponse.json({
        success: true,
        data: {
          targetVersion,
          activeVersion,
          eligible: eligibility.eligible,
          issues: eligibility.issues,
          simulation: {
            wouldSucceed: simulation.wouldSucceed,
            effects: simulation.effects,
          },
        },
      });
    }

    // Return all eligible versions
    return NextResponse.json({
      success: true,
      data: {
        activeVersion,
        eligibleVersions,
        canRollback: eligibleVersions.length > 0,
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

    console.error('D50: Rollback eligibility API error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST Handler - Perform Rollback
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Only Owner can perform rollback
    if (actor.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const targetVersion = body.version as string;
    const reason = body.reason as string;

    if (!targetVersion || !isValidVersion(targetVersion)) {
      return NextResponse.json(
        { success: false, error: 'Valid target version is required' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Reason is required (minimum 10 characters)' },
        { status: 400 }
      );
    }

    // Perform the rollback
    const result = performRollback({
      targetVersion: targetVersion as TrustVersion,
      actor: actor.id,
      role: actor.role,
      reason,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Audit log (use 'create' as rollback is a state transition)
    await auditLog({
      workspaceId: actor.workspaceId,
      actorId: actor.id,
      action: 'create',
      entityType: 'trust_bundle',
      entityId: targetVersion,
      metadata: {
        operation: 'rollback',
        targetVersion,
        previousVersion: result.previousVersion,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `Rolled back to ${targetVersion}`,
        previousVersion: result.previousVersion,
        currentVersion: result.currentVersion,
        timestamp: result.timestamp,
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

    console.error('D50: Rollback API error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
