// ============================================
// AdLab Trust Bundle Revocation API
// ============================================
// PHASE D36: Sales-Ready Trust Bundle Engine.
//
// PROVIDES:
// - POST: Revoke a trust bundle immediately
//
// INVARIANTS:
// - Owner only
// - Immediate revocation
// - Token becomes invalid instantly
// - All operations audited
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveActorFromRequest,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
} from '@/lib/adlab/auth';
import {
  revokeTrustBundle,
  getTrustBundle,
} from '@/lib/adlab/ops/trustBundleEngine';

// ============================================
// POST: Revoke Trust Bundle
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Owner only for bundle revocation
    if (actor.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { bundleId } = body;

    if (!bundleId) {
      return NextResponse.json(
        { success: false, error: 'bundleId is required' },
        { status: 400 }
      );
    }

    // Verify bundle exists in workspace
    const bundleResult = await getTrustBundle(bundleId, actor.workspaceId);
    if (!bundleResult.success) {
      return NextResponse.json(
        { success: false, error: 'Bundle not found' },
        { status: 404 }
      );
    }

    // Check if already revoked
    if (bundleResult.bundle?.revokedAt) {
      return NextResponse.json(
        { success: false, error: 'Bundle already revoked' },
        { status: 400 }
      );
    }

    // Revoke
    const result = await revokeTrustBundle(bundleId, actor.id, actor.workspaceId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        bundleId,
        revokedAt: new Date().toISOString(),
        message: 'Bundle has been revoked. All access tokens are now invalid.',
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

    console.error('D36: Revoke trust bundle error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
