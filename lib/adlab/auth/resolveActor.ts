// ============================================
// AdLab Server Actor Resolution
// ============================================
// PHASE D21: Server-derived actor + role resolution.
//
// CORE PRINCIPLE:
// Actor comes from auth session + DB membership.
// Role is NEVER from client payload.
//
// HARD RULES:
// - Resolve user from Supabase auth session
// - Resolve workspace via resolveWorkspace()
// - Query membership table for role
// - Throw on any missing/invalid context
// - No fallback to client-provided role
// ============================================

import { createClient } from '@supabase/supabase-js';
import { type AdLabRole, isValidRole } from './roles';
import {
  getSupabaseConnectivityError,
  normalizeSupabaseError,
  markSupabaseUnreachable,
  markSupabaseReachable,
  logSupabaseConfig,
} from '@/lib/utils/supabaseError';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================
// Types
// ============================================

/** Extended actor with optional user metadata */
export interface ResolvedActor {
  id: string;
  role: AdLabRole;
  workspaceId: string;
  email?: string;
  name?: string;
  membershipId: string;
}

/** Result of actor resolution */
export interface ActorResolutionResult {
  actor: ResolvedActor | null;
  error: string | null;
  errorCode?: 'NOT_AUTHENTICATED' | 'NO_WORKSPACE' | 'NO_MEMBERSHIP' | 'INACTIVE_MEMBERSHIP' | 'INVALID_ROLE' | 'SUPABASE_UNREACHABLE';
}

// ============================================
// Error Classes
// ============================================

/** User is not authenticated */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('Authentication required. Please sign in.');
    this.name = 'NotAuthenticatedError';
  }
}

/** User is not a member of any workspace */
export class NoWorkspaceError extends Error {
  constructor() {
    super('No workspace found. Please create or join a workspace.');
    this.name = 'NoWorkspaceError';
  }
}

/** User has no membership in the workspace */
export class MissingMembershipError extends Error {
  constructor(public readonly workspaceId: string) {
    super('You are not a member of this workspace.');
    this.name = 'MissingMembershipError';
  }
}

/** User's membership is inactive */
export class InactiveMembershipError extends Error {
  constructor(public readonly workspaceId: string) {
    super('Your membership in this workspace has been deactivated.');
    this.name = 'InactiveMembershipError';
  }
}

/** Workspace resolution failed */
export class WorkspaceResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceResolutionError';
  }
}

/** Supabase is unreachable */
export class SupabaseUnreachableError extends Error {
  constructor(public readonly hint: string) {
    super('Database connection failed');
    this.name = 'SupabaseUnreachableError';
  }
}

// ============================================
// Supabase Clients
// ============================================

/** Creates an authenticated client for user context */
function createAuthClient() {
  logSupabaseConfig();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** Creates a service role client for membership queries */
function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// Actor Resolution
// ============================================

/**
 * Resolves actor from auth session and workspace membership.
 *
 * RESOLUTION ORDER:
 * 1. Get authenticated user from Supabase auth
 * 2. Resolve workspace (from session/default)
 * 3. Query membership for user + workspace
 * 4. Return actor with server-derived role
 *
 * @throws NotAuthenticatedError - User not logged in
 * @throws NoWorkspaceError - No workspace found
 * @throws MissingMembershipError - User not member of workspace
 * @throws InactiveMembershipError - Membership is inactive
 */
export async function resolveActorFromSession(): Promise<ResolvedActor> {
  // Check connectivity state first
  const cachedError = getSupabaseConnectivityError();
  if (cachedError) {
    throw new SupabaseUnreachableError(cachedError.actionableHint);
  }

  const supabase = createAuthClient();

  // Step 1: Get authenticated user
  let user;
  let authError;
  try {
    const result = await supabase.auth.getUser();
    user = result.data?.user;
    authError = result.error;
    if (!authError) markSupabaseReachable();
  } catch (e) {
    const normalized = normalizeSupabaseError(e);
    if (normalized.kind === 'SUPABASE_UNREACHABLE') {
      markSupabaseUnreachable(e);
      throw new SupabaseUnreachableError(normalized.actionableHint);
    }
    throw e;
  }

  if (authError || !user) {
    throw new NotAuthenticatedError();
  }

  // Step 2: Resolve workspace
  // For now, get the first workspace the user has membership in
  const serviceClient = createServiceClient();

  const { data: memberships, error: membershipError } = await serviceClient
    .from('adlab_workspace_memberships')
    .select(`
      id,
      workspace_id,
      role,
      is_active,
      workspaces:workspace_id (
        id,
        name
      )
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (membershipError) {
    throw new WorkspaceResolutionError(membershipError.message);
  }

  if (!memberships || memberships.length === 0) {
    throw new MissingMembershipError('unknown');
  }

  const membership = memberships[0];

  // Validate role
  if (!isValidRole(membership.role)) {
    throw new WorkspaceResolutionError(`Invalid role in membership: ${membership.role}`);
  }

  return {
    id: user.id,
    role: membership.role as AdLabRole,
    workspaceId: membership.workspace_id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name,
    membershipId: membership.id,
  };
}

/**
 * Resolves actor for a specific workspace.
 * Use when workspaceId is known (e.g., from URL params).
 *
 * @throws NotAuthenticatedError - User not logged in
 * @throws MissingMembershipError - User not member of workspace
 * @throws InactiveMembershipError - Membership is inactive
 */
export async function resolveActorForWorkspace(workspaceId: string): Promise<ResolvedActor> {
  const supabase = createAuthClient();

  // Step 1: Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new NotAuthenticatedError();
  }

  // Step 2: Query membership for specific workspace
  const serviceClient = createServiceClient();

  const { data: membership, error: membershipError } = await serviceClient
    .from('adlab_workspace_memberships')
    .select('id, role, is_active')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (membershipError || !membership) {
    throw new MissingMembershipError(workspaceId);
  }

  if (!membership.is_active) {
    throw new InactiveMembershipError(workspaceId);
  }

  // Validate role
  if (!isValidRole(membership.role)) {
    throw new WorkspaceResolutionError(`Invalid role in membership: ${membership.role}`);
  }

  return {
    id: user.id,
    role: membership.role as AdLabRole,
    workspaceId,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name,
    membershipId: membership.id,
  };
}

/**
 * Safe version that returns null instead of throwing.
 * Use for read-only UI where missing actor shows empty state.
 */
export async function tryResolveActor(): Promise<ActorResolutionResult> {
  try {
    const actor = await resolveActorFromSession();
    return { actor, error: null };
  } catch (e) {
    if (e instanceof SupabaseUnreachableError) {
      return { actor: null, error: `${e.message}. ${e.hint.split('\n')[0]}`, errorCode: 'SUPABASE_UNREACHABLE' };
    }
    if (e instanceof NotAuthenticatedError) {
      return { actor: null, error: e.message, errorCode: 'NOT_AUTHENTICATED' };
    }
    if (e instanceof NoWorkspaceError) {
      return { actor: null, error: e.message, errorCode: 'NO_WORKSPACE' };
    }
    if (e instanceof MissingMembershipError) {
      return { actor: null, error: e.message, errorCode: 'NO_MEMBERSHIP' };
    }
    if (e instanceof InactiveMembershipError) {
      return { actor: null, error: e.message, errorCode: 'INACTIVE_MEMBERSHIP' };
    }
    return {
      actor: null,
      error: e instanceof Error ? e.message : 'Actor resolution failed'
    };
  }
}

/**
 * Safe version for specific workspace.
 */
export async function tryResolveActorForWorkspace(workspaceId: string): Promise<ActorResolutionResult> {
  try {
    const actor = await resolveActorForWorkspace(workspaceId);
    return { actor, error: null };
  } catch (e) {
    if (e instanceof NotAuthenticatedError) {
      return { actor: null, error: e.message, errorCode: 'NOT_AUTHENTICATED' };
    }
    if (e instanceof MissingMembershipError) {
      return { actor: null, error: e.message, errorCode: 'NO_MEMBERSHIP' };
    }
    if (e instanceof InactiveMembershipError) {
      return { actor: null, error: e.message, errorCode: 'INACTIVE_MEMBERSHIP' };
    }
    return {
      actor: null,
      error: e instanceof Error ? e.message : 'Actor resolution failed'
    };
  }
}

// ============================================
// Development/Fallback Resolution
// ============================================

/**
 * Resolves actor with fallback for development.
 *
 * In development (no auth):
 * - Uses first workspace found
 * - Assigns 'owner' role for full access
 *
 * In production:
 * - Falls through to real resolution
 * - Throws on any failure
 *
 * IMPORTANT: This is for development ONLY.
 * Production must use resolveActorFromSession().
 */
export async function resolveActorWithDevFallback(): Promise<ResolvedActor> {
  // Try real resolution first
  try {
    return await resolveActorFromSession();
  } catch (e) {
    // In development, provide fallback
    if (process.env.NODE_ENV === 'development') {
      console.warn('[D21] Using development fallback actor - NOT FOR PRODUCTION');

      const serviceClient = createServiceClient();

      // Get first workspace
      const { data: workspaces } = await serviceClient
        .from('workspaces')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!workspaces || workspaces.length === 0) {
        throw new NoWorkspaceError();
      }

      // Return dev actor with owner role
      return {
        id: 'dev-user-00000000-0000-0000-0000-000000000000',
        role: 'owner',
        workspaceId: workspaces[0].id,
        email: 'dev@localhost',
        name: 'Development User',
        membershipId: 'dev-membership',
      };
    }

    // In production, rethrow
    throw e;
  }
}

// ============================================
// Actor Type Guard
// ============================================

/** Type guard for ResolvedActor */
export function isResolvedActor(obj: unknown): obj is ResolvedActor {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as ResolvedActor).id === 'string' &&
    typeof (obj as ResolvedActor).role === 'string' &&
    typeof (obj as ResolvedActor).workspaceId === 'string' &&
    isValidRole((obj as ResolvedActor).role)
  );
}
