// ============================================
// AdLab Kill-Switch Status API
// ============================================
// PHASE D22: Read-only endpoint for UI banner.
//
// RULES:
// - No authentication required (status is public)
// - Returns only blocked/reason/scope
// - No ability to toggle - read only
// ============================================

import { NextResponse } from 'next/server';
import {
  getKillSwitchStatus,
  isGlobalKillSwitchEnabled,
  type KillSwitchStatus,
} from '@/lib/adlab/safety';
import {
  resolveActorFromRequest,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
} from '@/lib/adlab/auth';

interface StatusResponse {
  blocked: boolean;
  scope?: 'global' | 'workspace';
  reason?: string;
}

export async function GET(): Promise<NextResponse<StatusResponse>> {
  try {
    // Try to resolve actor for workspace-scoped check
    let status: KillSwitchStatus;

    try {
      const actor = await resolveActorFromRequest();
      // Authenticated user - check both global and workspace
      status = await getKillSwitchStatus(actor.workspaceId);
    } catch (e) {
      // If not authenticated, only check global status
      if (
        e instanceof NotAuthenticatedError ||
        e instanceof MissingMembershipError ||
        e instanceof InactiveMembershipError
      ) {
        status = await isGlobalKillSwitchEnabled();
      } else {
        throw e;
      }
    }

    return NextResponse.json({
      blocked: status.blocked,
      scope: status.scope,
      reason: status.reason,
    });
  } catch (e) {
    console.error('Kill-switch status error:', e);
    // On error, assume not blocked (fail-open for read)
    return NextResponse.json({ blocked: false });
  }
}
