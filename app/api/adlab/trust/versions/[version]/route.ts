// ============================================
// Trust Version Detail API
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// PROVIDES:
// - GET: View specific version with diff (public)
// - POST: Activate version (authenticated, Owner only)
//
// INVARIANTS:
// - Read operations are public
// - Activation requires Owner role
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
  getSnapshot,
  getActiveVersion,
  activateSnapshot,
  getDiffFromPrevious,
  formatChangeList,
  getDiffSummary,
  getChangelogEntry,
  type TrustVersion,
  isValidVersion,
} from '@/lib/adlab/trust';

// ============================================
// GET Handler - View Version (Public)
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> }
): Promise<NextResponse> {
  try {
    const { version } = await params;

    if (!isValidVersion(version)) {
      return NextResponse.json(
        { success: false, error: 'Invalid version format' },
        { status: 400 }
      );
    }

    const snapshot = getSnapshot(version as TrustVersion);

    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: 'Version not found' },
        { status: 404 }
      );
    }

    // Get diff from previous version
    const diff = getDiffFromPrevious(version as TrustVersion);
    const changelogEntry = getChangelogEntry(version as TrustVersion);
    const activeVersion = getActiveVersion();

    return NextResponse.json({
      success: true,
      data: {
        version: snapshot.version,
        releasedAt: snapshot.released_at,
        status: snapshot.status,
        isActive: snapshot.version === activeVersion,
        summary: snapshot.summary,
        author: {
          role: snapshot.author.role, // Don't expose name publicly
        },
        sections: snapshot.sections.map((s) => ({
          id: s.id,
          title: s.title,
          lineCount: s.lines.length,
          content: s.lines, // Full content for public viewing
        })),
        changelog: changelogEntry
          ? {
              date: changelogEntry.date,
              type: changelogEntry.type,
              summary: changelogEntry.summary,
              customerImpact: changelogEntry.customer_impact,
            }
          : null,
        diff: diff
          ? {
              fromVersion: diff.fromVersion,
              summary: getDiffSummary(diff),
              changeList: formatChangeList(diff),
              stats: diff.stats,
            }
          : null,
      },
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (e) {
    console.error('D50: Version detail API error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve version' },
      { status: 500 }
    );
  }
}

// ============================================
// POST Handler - Activate Version (Owner Only)
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> }
): Promise<NextResponse> {
  try {
    const actor = await resolveActorFromRequest();
    const { version } = await params;

    // Only Owner can activate snapshots
    if (actor.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Only Owner role can activate snapshots' },
        { status: 403 }
      );
    }

    if (!isValidVersion(version)) {
      return NextResponse.json(
        { success: false, error: 'Invalid version format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const reason = body.reason as string;

    if (!reason || typeof reason !== 'string' || reason.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Reason is required (minimum 10 characters)' },
        { status: 400 }
      );
    }

    const previousVersion = getActiveVersion();

    // Activate the snapshot
    const result = activateSnapshot(
      version as TrustVersion,
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

    // Audit log (use 'create' as activation is a state transition)
    await auditLog({
      workspaceId: actor.workspaceId,
      actorId: actor.id,
      action: 'create',
      entityType: 'trust_bundle',
      entityId: version,
      metadata: {
        operation: 'activate',
        version,
        previousVersion,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        version,
        previousVersion: result.previousVersion,
        message: `Version ${version} is now active`,
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

    console.error('D50: Version activation API error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
