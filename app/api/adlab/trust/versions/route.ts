// ============================================
// Trust Versions API
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// PROVIDES:
// - GET: List all versions (public, read-only)
// - POST: Create new snapshot (authenticated, Product/Legal only)
//
// INVARIANTS:
// - Read operations are public
// - Write operations require authentication
// - No silent changes
// - Full audit logging
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
  getAllVersions,
  getActiveVersion,
  getSnapshot,
  createSnapshot,
  type TrustSnapshot,
  validateSnapshot,
} from '@/lib/adlab/trust';

// ============================================
// GET Handler - List Versions (Public)
// ============================================

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const versions = getAllVersions();
    const activeVersion = getActiveVersion();

    // Get basic info for each version
    const versionList = versions.map((version) => {
      const snapshot = getSnapshot(version);
      return {
        version,
        isActive: version === activeVersion,
        releasedAt: snapshot?.released_at ?? null,
        summary: snapshot?.summary ?? null,
        sectionCount: snapshot?.sections.length ?? 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        versions: versionList,
        activeVersion,
        totalVersions: versions.length,
      },
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (e) {
    console.error('D50: Versions list API error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve versions' },
      { status: 500 }
    );
  }
}

// ============================================
// POST Handler - Create Snapshot (Authenticated)
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();

    // Only Product and Legal roles can create snapshots
    // In practice, this would check against TRUST_PERMISSIONS
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only Product or Legal roles can create snapshots' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate snapshot format
    if (!validateSnapshot(body.snapshot)) {
      return NextResponse.json(
        { success: false, error: 'Invalid snapshot format' },
        { status: 400 }
      );
    }

    const snapshot = body.snapshot as TrustSnapshot;
    const reason = body.reason as string;

    if (!reason || typeof reason !== 'string' || reason.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Reason is required (minimum 10 characters)' },
        { status: 400 }
      );
    }

    // Create the snapshot
    const result = createSnapshot(
      snapshot,
      actor.id,
      actor.role,
      reason
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Audit log
    await auditLog({
      workspaceId: actor.workspaceId,
      actorId: actor.id,
      action: 'create',
      entityType: 'trust_bundle', // Reusing existing entity type
      entityId: snapshot.version,
      metadata: {
        version: snapshot.version,
        summary: snapshot.summary,
        sectionCount: snapshot.sections.length,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        version: snapshot.version,
        message: 'Snapshot created. Use activate endpoint to make it live.',
      },
    }, { status: 201 });
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

    console.error('D50: Snapshot creation API error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
