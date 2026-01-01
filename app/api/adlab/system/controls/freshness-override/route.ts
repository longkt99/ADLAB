// ============================================
// AdLab Freshness Override Control API
// ============================================
// PHASE D29: Compliance Control Panel.
//
// ENDPOINTS:
// - GET: List all freshness overrides for workspace
// - POST: Set freshness override for a dataset
// - DELETE: Remove freshness override
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
  listOverrides,
  setFreshnessOverrides,
  deleteOverride,
  ALL_DATASET_KEYS,
  DEFAULT_FRESHNESS_POLICIES,
  type DatasetKey,
} from '@/lib/adlab/ops';

// ============================================
// GET: List All Freshness Overrides
// ============================================

export async function GET() {
  try {
    const actor = await resolveActorFromRequest();
    const result = await listOverrides(actor.workspaceId);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Filter to only freshness-related overrides
    const freshnessOverrides = result.data.filter((o) =>
      o.key.startsWith('freshness.')
    );

    // Build response with defaults for comparison
    const defaults = Object.entries(DEFAULT_FRESHNESS_POLICIES).map(
      ([key, policy]) => ({
        dataset: key as DatasetKey,
        defaultWarnMinutes: policy.warnAfterMinutes,
        defaultFailMinutes: policy.failAfterMinutes,
        critical: policy.critical,
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        overrides: freshnessOverrides,
        defaults,
        availableDatasets: ALL_DATASET_KEYS,
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
    console.error('D29: Freshness override GET error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: Set Freshness Override
// ============================================

interface SetOverrideRequest {
  dataset: DatasetKey;
  warnMinutes?: number | null;
  failMinutes?: number | null;
  reason: string;
  expiresAt?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Resolve actor
    const actor = await resolveActorFromRequest();

    // Owner-only for freshness overrides
    if (!hasAtLeastRole(actor.role, 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = (await request.json()) as SetOverrideRequest;

    // Validate dataset
    if (!body.dataset || !ALL_DATASET_KEYS.includes(body.dataset)) {
      return NextResponse.json(
        { success: false, error: `Invalid dataset. Valid: ${ALL_DATASET_KEYS.join(', ')}` },
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

    // Validate at least one threshold is provided
    if (body.warnMinutes === undefined && body.failMinutes === undefined) {
      return NextResponse.json(
        { success: false, error: 'At least one of warnMinutes or failMinutes required' },
        { status: 400 }
      );
    }

    // Validate thresholds are positive
    if (body.warnMinutes !== null && body.warnMinutes !== undefined && body.warnMinutes <= 0) {
      return NextResponse.json(
        { success: false, error: 'warnMinutes must be positive' },
        { status: 400 }
      );
    }

    if (body.failMinutes !== null && body.failMinutes !== undefined && body.failMinutes <= 0) {
      return NextResponse.json(
        { success: false, error: 'failMinutes must be positive' },
        { status: 400 }
      );
    }

    // Validate warn < fail
    if (
      body.warnMinutes !== null &&
      body.warnMinutes !== undefined &&
      body.failMinutes !== null &&
      body.failMinutes !== undefined &&
      body.warnMinutes >= body.failMinutes
    ) {
      return NextResponse.json(
        { success: false, error: 'warnMinutes must be less than failMinutes' },
        { status: 400 }
      );
    }

    // Validate expiresAt if provided
    if (body.expiresAt) {
      const expiresDate = new Date(body.expiresAt);
      if (isNaN(expiresDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid expiresAt date format' },
          { status: 400 }
        );
      }
      if (expiresDate.getTime() < Date.now()) {
        return NextResponse.json(
          { success: false, error: 'expiresAt must be in the future' },
          { status: 400 }
        );
      }
    }

    // Set the overrides
    const result = await setFreshnessOverrides(
      actor.workspaceId,
      body.dataset,
      body.warnMinutes ?? null,
      body.failMinutes ?? null,
      actor.id,
      body.reason.trim(),
      body.expiresAt
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to set freshness override' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        dataset: body.dataset,
        warnMinutes: body.warnMinutes,
        failMinutes: body.failMinutes,
        expiresAt: body.expiresAt || null,
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
    console.error('D29: Freshness override POST error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: Remove Freshness Override
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    // Resolve actor
    const actor = await resolveActorFromRequest();

    // Owner-only
    if (!hasAtLeastRole(actor.role, 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Owner access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { dataset, reason } = body as { dataset: DatasetKey; reason: string };

    // Validate dataset
    if (!dataset || !ALL_DATASET_KEYS.includes(dataset)) {
      return NextResponse.json(
        { success: false, error: `Invalid dataset. Valid: ${ALL_DATASET_KEYS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate reason
    if (!reason || reason.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Reason required (minimum 3 characters)' },
        { status: 400 }
      );
    }

    // Delete both warn and fail overrides
    const warnKey = `freshness.${dataset}.warn_minutes`;
    const failKey = `freshness.${dataset}.fail_minutes`;

    const [warnResult, failResult] = await Promise.all([
      deleteOverride(actor.workspaceId, warnKey, actor.id, reason.trim()),
      deleteOverride(actor.workspaceId, failKey, actor.id, reason.trim()),
    ]);

    // At least one should succeed (or not exist)
    const anyError = warnResult.error || failResult.error;
    const anySuccess = warnResult.success || failResult.success;

    if (!anySuccess && anyError) {
      return NextResponse.json(
        { success: false, error: anyError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        dataset,
        removed: true,
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
    console.error('D29: Freshness override DELETE error:', e);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
