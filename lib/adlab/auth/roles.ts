// ============================================
// AdLab Role-Based Access Control
// ============================================
// PHASE D20: Hard permission boundaries.
//
// CORE PRINCIPLE:
// If you can't name who is allowed to do it, nobody should be.
//
// HARD RULES:
// - Deny by default
// - Role + action explicit allow-list
// - No silent permission fallback
// - No role ambiguity
// ============================================

// ============================================
// Role Definitions
// ============================================

/** AdLab roles with descending privilege levels */
export type AdLabRole = 'owner' | 'admin' | 'operator' | 'viewer';

/** All valid roles */
export const ADLAB_ROLES: readonly AdLabRole[] = ['owner', 'admin', 'operator', 'viewer'] as const;

/** Role hierarchy (higher index = more privilege) */
export const ROLE_HIERARCHY: Record<AdLabRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
} as const;

// ============================================
// Action Definitions
// ============================================

/** Actions that require permission checks */
export type PermissionAction =
  | 'PROMOTE'
  | 'ROLLBACK'
  | 'SNAPSHOT_ACTIVATE'
  | 'SNAPSHOT_DEACTIVATE'
  | 'VALIDATE'
  | 'INGEST'
  | 'READ_ANALYTICS';

/** All valid actions */
export const PERMISSION_ACTIONS: readonly PermissionAction[] = [
  'PROMOTE',
  'ROLLBACK',
  'SNAPSHOT_ACTIVATE',
  'SNAPSHOT_DEACTIVATE',
  'VALIDATE',
  'INGEST',
  'READ_ANALYTICS',
] as const;

// ============================================
// Capabilities Matrix
// ============================================

/**
 * Explicit allow-list for role-action combinations.
 * If not in this matrix, the action is DENIED.
 *
 * PROMOTE → owner | admin
 * ROLLBACK → owner only (most dangerous action)
 * SNAPSHOT_ACTIVATE → owner | admin
 * SNAPSHOT_DEACTIVATE → owner | admin
 * VALIDATE → owner | admin | operator
 * INGEST (dry-run) → owner | admin | operator
 * READ_ANALYTICS → all
 */
export const CAPABILITIES_MATRIX: Record<PermissionAction, readonly AdLabRole[]> = {
  PROMOTE: ['owner', 'admin'],
  ROLLBACK: ['owner'], // Most dangerous - owner only
  SNAPSHOT_ACTIVATE: ['owner', 'admin'],
  SNAPSHOT_DEACTIVATE: ['owner', 'admin'],
  VALIDATE: ['owner', 'admin', 'operator'],
  INGEST: ['owner', 'admin', 'operator'],
  READ_ANALYTICS: ['owner', 'admin', 'operator', 'viewer'],
} as const;

// ============================================
// Actor Context
// ============================================

/** Actor information for permission checks */
export interface Actor {
  id: string;
  role: AdLabRole;
  workspaceId: string;
}

// ============================================
// Permission Check Functions
// ============================================

/**
 * Checks if a role is allowed to perform an action.
 * Pure function - no side effects.
 */
export function isAllowed(role: AdLabRole, action: PermissionAction): boolean {
  const allowedRoles = CAPABILITIES_MATRIX[action];
  return allowedRoles.includes(role);
}

/**
 * Gets all actions a role can perform.
 */
export function getAllowedActions(role: AdLabRole): PermissionAction[] {
  return PERMISSION_ACTIONS.filter((action) => isAllowed(role, action));
}

/**
 * Gets all roles that can perform an action.
 */
export function getRolesForAction(action: PermissionAction): readonly AdLabRole[] {
  return CAPABILITIES_MATRIX[action];
}

// ============================================
// Permission Errors
// ============================================

/** Custom error for permission denials */
export class PermissionDeniedError extends Error {
  constructor(
    public readonly actor: Actor,
    public readonly action: PermissionAction,
    public readonly requiredRoles: readonly AdLabRole[]
  ) {
    super(
      `Permission denied: Role "${actor.role}" cannot perform "${action}". ` +
        `Required roles: ${requiredRoles.join(' | ')}`
    );
    this.name = 'PermissionDeniedError';
  }
}

/** Custom error for invalid role */
export class InvalidRoleError extends Error {
  constructor(public readonly providedRole: string) {
    super(`Invalid role: "${providedRole}". Valid roles: ${ADLAB_ROLES.join(', ')}`);
    this.name = 'InvalidRoleError';
  }
}

/** Custom error for missing actor context */
export class MissingActorError extends Error {
  constructor(public readonly missingField: string) {
    super(`Missing actor context: ${missingField} is required`);
    this.name = 'MissingActorError';
  }
}

// ============================================
// Assertion Functions
// ============================================

/**
 * Validates that a string is a valid AdLab role.
 */
export function isValidRole(role: string): role is AdLabRole {
  return ADLAB_ROLES.includes(role as AdLabRole);
}

/**
 * Validates actor context.
 * Throws if any required field is missing or invalid.
 */
export function assertValidActor(actor: Partial<Actor>): asserts actor is Actor {
  if (!actor.id) {
    throw new MissingActorError('id');
  }
  if (!actor.role) {
    throw new MissingActorError('role');
  }
  if (!actor.workspaceId) {
    throw new MissingActorError('workspaceId');
  }
  if (!isValidRole(actor.role)) {
    throw new InvalidRoleError(actor.role);
  }
}

/**
 * Asserts that an actor can perform an action.
 * Throws PermissionDeniedError if not allowed.
 *
 * This is the main guard function used throughout the codebase.
 *
 * @example
 * assertCan(actor, 'PROMOTE');
 * // If role is 'viewer' or 'operator', throws PermissionDeniedError
 * // If role is 'admin' or 'owner', returns void (success)
 */
export function assertCan(actor: Actor, action: PermissionAction): void {
  // Validate actor first
  assertValidActor(actor);

  // Check permission
  if (!isAllowed(actor.role, action)) {
    throw new PermissionDeniedError(actor, action, getRolesForAction(action));
  }
}

// ============================================
// Helper Functions for UI
// ============================================

/**
 * Checks if a role can perform an action (for UI visibility).
 * Does not throw - returns boolean.
 */
export function canPerform(role: AdLabRole | string, action: PermissionAction): boolean {
  if (!isValidRole(role)) {
    return false;
  }
  return isAllowed(role, action);
}

/**
 * Gets human-readable label for a role.
 */
export function getRoleLabel(role: AdLabRole): string {
  const labels: Record<AdLabRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    operator: 'Operator',
    viewer: 'Viewer',
  };
  return labels[role] || role;
}

/**
 * Gets human-readable description for a role.
 */
export function getRoleDescription(role: AdLabRole): string {
  const descriptions: Record<AdLabRole, string> = {
    owner: 'Full access including rollback. Can perform all actions.',
    admin: 'Can promote, activate snapshots, validate, and ingest data.',
    operator: 'Can validate and ingest data (dry-run). Cannot promote or modify production.',
    viewer: 'Read-only access to analytics and data.',
  };
  return descriptions[role] || '';
}

/**
 * Gets human-readable label for an action.
 */
export function getActionLabel(action: PermissionAction): string {
  const labels: Record<PermissionAction, string> = {
    PROMOTE: 'Promote to Production',
    ROLLBACK: 'Rollback Snapshot',
    SNAPSHOT_ACTIVATE: 'Activate Snapshot',
    SNAPSHOT_DEACTIVATE: 'Deactivate Snapshot',
    VALIDATE: 'Validate Data',
    INGEST: 'Ingest Data',
    READ_ANALYTICS: 'Read Analytics',
  };
  return labels[action] || action;
}

/**
 * Compares two roles for privilege level.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export function compareRoles(a: AdLabRole, b: AdLabRole): number {
  return ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b];
}

/**
 * Checks if role A has at least the same privilege as role B.
 */
export function hasAtLeastRole(actualRole: AdLabRole, requiredRole: AdLabRole): boolean {
  return ROLE_HIERARCHY[actualRole] >= ROLE_HIERARCHY[requiredRole];
}
