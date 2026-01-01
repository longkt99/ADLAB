// ============================================
// AdLab Trust Token Management API
// ============================================
// PHASE D33: Public Trust Portal.
//
// PROVIDES:
// - GET: List all trust tokens for workspace
// - POST: Create new trust token
// - DELETE: Revoke trust token
//
// INVARIANTS:
// - Owner/Admin only
// - Workspace scoped
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
  createTrustToken,
  listTrustTokens,
  revokeTrustToken,
  getTrustToken,
} from '@/lib/adlab/ops/trustTokens';
import { isValidProfile, type AttestationProfile } from '@/lib/adlab/ops/attestationProfiles';
import { appendAuditLog } from '@/lib/adlab/audit';

// ============================================
// GET: List Trust Tokens
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

    const result = await listTrustTokens(actor.workspaceId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Map tokens for response (hide hash)
    const tokens = (result.tokens || []).map((t) => ({
      id: t.id,
      profile: t.profile,
      allowedSections: t.allowedSections,
      expiresAt: t.expiresAt,
      issuedAt: t.issuedAt,
      issuedBy: t.issuedBy,
      revokedAt: t.revokedAt,
      revokedBy: t.revokedBy,
      usageCount: t.usageCount,
      lastAccessedAt: t.lastAccessedAt,
      label: t.label,
      isExpired: new Date(t.expiresAt) <= new Date(),
      isRevoked: !!t.revokedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        tokens,
        total: tokens.length,
        active: tokens.filter((t) => !t.isExpired && !t.isRevoked).length,
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

    console.error('D33: List trust tokens error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: Create Trust Token
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Owner only for token creation
    if (actor.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { profile, sections, expiresAt, label } = body;

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

    // Create token
    const result = await createTrustToken({
      workspaceId: actor.workspaceId,
      profile: profile as AttestationProfile,
      sections,
      expiresAt,
      issuedBy: actor.id,
      label,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Build public link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const publicLink = `${baseUrl}/trust?token=${encodeURIComponent(result.token!)}`;

    return NextResponse.json({
      success: true,
      data: {
        tokenId: result.tokenId,
        token: result.token,
        publicLink,
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

    console.error('D33: Create trust token error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: Revoke Trust Token
// ============================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Owner only for token revocation
    if (actor.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tokenId } = body;

    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: 'tokenId is required' },
        { status: 400 }
      );
    }

    // Verify token exists in workspace
    const tokenResult = await getTrustToken(tokenId, actor.workspaceId);
    if (!tokenResult.success) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    // Revoke
    const result = await revokeTrustToken(tokenId, actor.id, actor.workspaceId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tokenId,
        revokedAt: new Date().toISOString(),
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

    console.error('D33: Revoke trust token error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
