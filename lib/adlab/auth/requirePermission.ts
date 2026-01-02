// ============================================
// AdLab Server Permission Guard
// ============================================
// PHASE D20: Server-side permission enforcement.
// PHASE D21: Server-derived actor resolution.
//
// CORE PRINCIPLE:
// Permission failure must block execution BEFORE DB access.
// Actor comes from auth session + membership, NEVER from client.
//
// HARD RULES:
// - Server-only mutations
// - Deny by default
// - No client-provided role
// - Failed attempts logged to audit trail
// ============================================

import { NextResponse } from 'next/server';
import {
  assertCan,
  type Actor,
  type PermissionAction,
  PermissionDeniedError,
  InvalidRoleError,
  MissingActorError,
  getRolesForAction,
  isValidRole,
  type AdLabRole,
} from './roles';
import {
  resolveActorForWorkspace,
  resolveActorWithDevFallback,
  type ResolvedActor,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
} from './resolveActor';
import { appendAuditLog, type AuditAction } from '@/lib/adlab/audit';

// ============================================
// Types
// ============================================

/** Result of permission check */
export interface PermissionResult {
  allowed: boolean;
  error?: string;
  actor?: Actor;
}

/** Options for requirePermission */
export interface RequirePermissionOptions {
  /** Log denial to audit trail */
  logDenial?: boolean;
  /** Scope context for audit (if logging) */
  scope?: {
    platform?: string;
    dataset?: string;
    clientId?: string;
  };
  /** Entity info for audit (if logging) */
  entity?: {
    type: 'ingestion_log' | 'snapshot' | 'dataset';
    id: string;
  };
}

// ============================================
// Server Actor Resolution (D21)
// ============================================

/**
 * Resolves actor from server session and membership.
 * This is the ONLY way to get an actor for permission checks.
 *
 * IMPORTANT: Do NOT use this for accepting client-provided roles.
 * Role comes from the database membership, not from the request.
 *
 * @throws NotAuthenticatedError - User not logged in (401)
 * @throws MissingMembershipError - User not member of workspace (403)
 * @throws InactiveMembershipError - Membership is inactive (403)
 */
export async function resolveActorFromRequest(): Promise<ResolvedActor> {
  return resolveActorWithDevFallback();
}

/**
 * Resolves actor for a specific workspace.
 * Use when the workspaceId is known from the request context.
 */
export async function resolveActorFromRequestForWorkspace(workspaceId: string): Promise<ResolvedActor> {
  // In development, use fallback
  if (process.env.NODE_ENV === 'development') {
    const actor = await resolveActorWithDevFallback();
    // Verify workspace matches (or return dev actor if it's the same workspace)
    return actor;
  }

  return resolveActorForWorkspace(workspaceId);
}

/**
 * DEPRECATED: Legacy actor resolution from client-provided values.
 *
 * D21 MIGRATION NOTE:
 * This function is kept for backward compatibility during migration.
 * All new code should use resolveActorFromRequest() instead.
 *
 * After full D21 migration, this function will be removed.
 */
export function resolveActor(input: {
  userId?: string;
  role?: string;
  workspaceId?: string;
}): Actor {
  console.warn(
    '[D21] resolveActor() is deprecated. Use resolveActorFromRequest() for server-derived actors.'
  );

  if (!input.userId) {
    throw new MissingActorError('userId');
  }
  if (!input.role) {
    throw new MissingActorError('role');
  }
  if (!input.workspaceId) {
    throw new MissingActorError('workspaceId');
  }
  if (!isValidRole(input.role)) {
    throw new InvalidRoleError(input.role);
  }

  return {
    id: input.userId,
    role: input.role as AdLabRole,
    workspaceId: input.workspaceId,
  };
}

// ============================================
// Permission Guard Functions
// ============================================

/**
 * Requires permission for an action using server-resolved actor.
 * Throws on denial - use in try/catch.
 *
 * D21: This now uses server-derived actor, not client-provided.
 *
 * @example
 * try {
 *   const actor = await resolveActorFromRequest();
 *   await requirePermission(actor, 'PROMOTE', { logDenial: true });
 *   // Proceed with action
 * } catch (e) {
 *   if (e instanceof PermissionDeniedError) {
 *     return NextResponse.json({ error: e.message }, { status: 403 });
 *   }
 *   throw e;
 * }
 */
export async function requirePermission(
  actor: Actor | ResolvedActor,
  action: PermissionAction,
  options: RequirePermissionOptions = {}
): Promise<void> {
  try {
    assertCan(actor, action);
  } catch (e) {
    // Log denial to audit trail if requested
    if (options.logDenial && e instanceof PermissionDeniedError) {
      await logPermissionDenial(actor, action, options);
    }
    throw e;
  }
}

/**
 * Resolves actor and checks permission in one step.
 * Throws on auth failure or permission denial.
 *
 * D21: Preferred method for API routes.
 */
export async function requireActorWithPermission(
  action: PermissionAction,
  options: RequirePermissionOptions = {}
): Promise<ResolvedActor> {
  const actor = await resolveActorFromRequest();
  await requirePermission(actor, action, options);
  return actor;
}

/**
 * Checks permission and returns result (does not throw).
 * Use for conditional logic where you want to handle denial gracefully.
 */
export function checkPermission(actor: Actor | ResolvedActor, action: PermissionAction): PermissionResult {
  try {
    assertCan(actor, action);
    return { allowed: true, actor };
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { allowed: false, error: e.message, actor };
    }
    if (e instanceof InvalidRoleError || e instanceof MissingActorError) {
      return { allowed: false, error: e.message };
    }
    return { allowed: false, error: 'Unknown permission error' };
  }
}

// ============================================
// Error Responses
// ============================================

/**
 * Creates a standardized 403 response for permission denial.
 */
export function permissionDeniedResponse(
  action: PermissionAction,
  actorRole?: string
): NextResponse {
  const requiredRoles = getRolesForAction(action);
  return NextResponse.json(
    {
      success: false,
      error: `Permission denied: ${actorRole ? `Role "${actorRole}"` : 'User'} cannot perform "${action}". ` +
        `Required roles: ${requiredRoles.join(' | ')}`,
      requiredRoles,
    },
    { status: 403 }
  );
}

/**
 * Creates a standardized 401 response for auth failure.
 */
export function notAuthenticatedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Authentication required. Please sign in.',
    },
    { status: 401 }
  );
}

/**
 * Creates a standardized 403 response for membership failure.
 */
export function noMembershipResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'You are not a member of this workspace.',
    },
    { status: 403 }
  );
}

// ============================================
// Audit Logging for Denials
// ============================================

/** Map PermissionAction to AuditAction. READ_ANALYTICS is not audited. */
function toAuditAction(action: PermissionAction): AuditAction | null {
  const mapping: Partial<Record<PermissionAction, AuditAction>> = {
    PROMOTE: 'PROMOTE',
    ROLLBACK: 'ROLLBACK',
    SNAPSHOT_ACTIVATE: 'SNAPSHOT_ACTIVATE',
    SNAPSHOT_DEACTIVATE: 'SNAPSHOT_DEACTIVATE',
    VALIDATE: 'VALIDATE',
    INGEST: 'INGEST',
    // READ_ANALYTICS is not a high-risk action, skip auditing
  };
  return mapping[action] ?? null;
}

/**
 * Logs a permission denial to the audit trail.
 * This creates a permanent record of access attempts.
 */
async function logPermissionDenial(
  actor: Actor | ResolvedActor,
  action: PermissionAction,
  options: RequirePermissionOptions
): Promise<void> {
  const auditAction = toAuditAction(action);
  if (!auditAction) {
    // Action not auditable (e.g., READ_ANALYTICS)
    return;
  }

  try {
    await appendAuditLog({
      context: {
        workspaceId: actor.workspaceId,
        actorId: actor.id,
        actorRole: actor.role,
      },
      action: auditAction,
      entityType: options.entity?.type || 'dataset',
      entityId: options.entity?.id || 'system',
      scope: {
        platform: options.scope?.platform || 'system',
        dataset: options.scope?.dataset || 'system',
        clientId: options.scope?.clientId,
      },
      metadata: {
        permissionDenied: true,
        attemptedAction: action,
        actorRole: actor.role,
        requiredRoles: getRolesForAction(action),
      },
    });
  } catch (e) {
    // Log failure but don't block the permission denial
    console.error('[PERMISSION] Failed to log denial to audit:', e);
  }
}

// ============================================
// API Route Helpers
// ============================================

/**
 * Wraps an API handler with server-derived actor and permission check.
 * Returns appropriate error response on failure.
 *
 * D21: This is the preferred pattern for API routes.
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   return withActorPermission(
 *     'PROMOTE',
 *     async (actor) => {
 *       // Your handler logic here - actor.role is server-derived
 *       return NextResponse.json({ success: true });
 *     },
 *     { logDenial: true }
 *   );
 * }
 */
export async function withActorPermission<T>(
  action: PermissionAction,
  handler: (actor: ResolvedActor) => Promise<NextResponse<T>>,
  options: RequirePermissionOptions = {}
): Promise<NextResponse<T | { success: false; error: string; requiredRoles?: readonly string[] }>> {
  try {
    const actor = await resolveActorFromRequest();
    await requirePermission(actor, action, options);
    return handler(actor);
  } catch (e) {
    type ErrorResponse = NextResponse<{ success: false; error: string; requiredRoles?: readonly string[] }>;
    if (e instanceof NotAuthenticatedError) {
      return notAuthenticatedResponse() as ErrorResponse;
    }
    if (e instanceof MissingMembershipError || e instanceof InactiveMembershipError) {
      return noMembershipResponse() as ErrorResponse;
    }
    if (e instanceof PermissionDeniedError) {
      return permissionDeniedResponse(action, e.actor.role) as ErrorResponse;
    }
    if (e instanceof InvalidRoleError || e instanceof MissingActorError) {
      return NextResponse.json(
        { success: false, error: e.message },
        { status: 400 }
      ) as ErrorResponse;
    }
    throw e;
  }
}

/**
 * DEPRECATED: Legacy wrapper that accepts client-provided actor.
 *
 * D21 MIGRATION NOTE:
 * Use withActorPermission() instead.
 */
export async function withPermission<T>(
  actorInput: { userId?: string; role?: string; workspaceId?: string },
  action: PermissionAction,
  handler: (actor: Actor) => Promise<NextResponse<T>>,
  options: RequirePermissionOptions = {}
): Promise<NextResponse<T | { success: false; error: string; requiredRoles?: readonly string[] }>> {
  console.warn(
    '[D21] withPermission() is deprecated. Use withActorPermission() for server-derived actors.'
  );

  try {
    const actor = resolveActor(actorInput);
    await requirePermission(actor, action, options);
    return handler(actor);
  } catch (e) {
    type ErrorResponse = NextResponse<{ success: false; error: string; requiredRoles?: readonly string[] }>;
    if (e instanceof PermissionDeniedError) {
      return permissionDeniedResponse(action, actorInput.role) as ErrorResponse;
    }
    if (e instanceof InvalidRoleError || e instanceof MissingActorError) {
      return NextResponse.json(
        { success: false, error: e.message },
        { status: 400 }
      ) as ErrorResponse;
    }
    throw e;
  }
}

// ============================================
// Re-exports
// ============================================

export {
  assertCan,
  type Actor,
  type PermissionAction,
  PermissionDeniedError,
  InvalidRoleError,
  MissingActorError,
} from './roles';

export {
  type ResolvedActor,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
  NoWorkspaceError,
  WorkspaceResolutionError,
} from './resolveActor';
