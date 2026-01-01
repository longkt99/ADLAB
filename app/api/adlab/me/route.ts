// ============================================
// AdLab Actor Endpoint
// ============================================
// PHASE D21: Returns server-derived actor for UI.
//
// CORE PRINCIPLE:
// UI uses this to know the user's role for visibility.
// But all actual permission enforcement is server-side.
//
// IMPORTANT:
// This endpoint is READ-ONLY.
// It does NOT grant permissions - just reports them.
// ============================================

import { NextResponse } from 'next/server';
import {
  tryResolveActor,
  getAllowedActions,
  getRoleLabel,
  getRoleDescription,
} from '@/lib/adlab/auth';

interface MeResponse {
  success: boolean;
  actor?: {
    id: string;
    role: string;
    roleLabel: string;
    roleDescription: string;
    workspaceId: string;
    email?: string;
    name?: string;
    allowedActions: string[];
  };
  error?: string;
  errorCode?: string;
}

/**
 * GET /api/adlab/me
 *
 * Returns the current user's actor context for UI purposes.
 * Role-based visibility in UI should use this data.
 *
 * IMPORTANT: This is for display only.
 * All actual permission enforcement happens server-side in mutation APIs.
 */
export async function GET(): Promise<NextResponse<MeResponse>> {
  const { actor, error, errorCode } = await tryResolveActor();

  if (!actor) {
    // Determine appropriate HTTP status
    let status = 403;
    if (errorCode === 'NOT_AUTHENTICATED') status = 401;
    if (errorCode === 'SUPABASE_UNREACHABLE') status = 503;

    return NextResponse.json(
      {
        success: false,
        error: error || 'Not authenticated',
        errorCode,
      },
      { status }
    );
  }

  return NextResponse.json({
    success: true,
    actor: {
      id: actor.id,
      role: actor.role,
      roleLabel: getRoleLabel(actor.role),
      roleDescription: getRoleDescription(actor.role),
      workspaceId: actor.workspaceId,
      email: actor.email,
      name: actor.name,
      allowedActions: getAllowedActions(actor.role),
    },
  });
}
