// ============================================
// AdLab Trust Bundle Management API
// ============================================
// PHASE D36: Sales-Ready Trust Bundle Engine.
//
// PROVIDES:
// - GET: List all trust bundles for workspace
// - POST: Create new trust bundle
//
// INVARIANTS:
// - Owner/Admin only
// - Workspace scoped
// - Requires passing go-live gate
// - Requires no active kill-switch
// - All operations audited
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
  createTrustBundle,
  listTrustBundles,
  checkBundlePrerequisites,
} from '@/lib/adlab/ops/trustBundleEngine';
import { isValidProfile, type AttestationProfile } from '@/lib/adlab/ops/attestationProfiles';

// ============================================
// GET: List Trust Bundles
// ============================================

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Owner/Admin only
    if (!hasAtLeastRole(actor.role, 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Owner or Admin access required' },
        { status: 403 }
      );
    }

    const result = await listTrustBundles(actor.workspaceId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Map bundles for response (hide hash)
    const bundles = (result.bundles || []).map((b) => ({
      id: b.id,
      profile: b.profile,
      label: b.label,
      expiresAt: b.expiresAt,
      createdAt: b.createdAt,
      createdBy: b.createdBy,
      revokedAt: b.revokedAt,
      revokedBy: b.revokedBy,
      usageCount: b.usageCount,
      lastAccessedAt: b.lastAccessedAt,
      bundleChecksum: b.bundleChecksum,
      isExpired: new Date(b.expiresAt) <= new Date(),
      isRevoked: !!b.revokedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        bundles,
        total: bundles.length,
        active: bundles.filter((b) => !b.isExpired && !b.isRevoked).length,
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

    console.error('D36: List trust bundles error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: Create Trust Bundle
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Owner only for bundle creation
    if (actor.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { profile, expiresAt, label } = body;

    // Validate profile
    if (!profile || !isValidProfile(profile)) {
      return NextResponse.json(
        { success: false, error: 'Invalid profile. Must be one of: SOC2_TYPE1, SOC2_TYPE2, ISO_27001, ENTERPRISE_DD' },
        { status: 400 }
      );
    }

    // Validate expiry
    if (!expiresAt) {
      return NextResponse.json(
        { success: false, error: 'expiresAt is required' },
        { status: 400 }
      );
    }

    const expiresAtDate = new Date(expiresAt);
    if (isNaN(expiresAtDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid expiresAt date' },
        { status: 400 }
      );
    }

    // Check prerequisites before attempting creation
    const preflight = await checkBundlePrerequisites(actor.workspaceId);
    if (!preflight.canCreate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bundle creation prerequisites not met',
          prerequisites: {
            errors: preflight.errors,
            warnings: preflight.warnings,
          },
        },
        { status: 412 } // Precondition Failed
      );
    }

    // Create bundle
    const result = await createTrustBundle({
      workspaceId: actor.workspaceId,
      profile: profile as AttestationProfile,
      expiresAt,
      createdBy: actor.id,
      label,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        bundleId: result.bundleId,
        publicAccessToken: result.publicAccessToken,
        publicUrl: result.publicUrl,
        expiresAt: result.expiresAt,
        profile,
        label,
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

    console.error('D36: Create trust bundle error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
