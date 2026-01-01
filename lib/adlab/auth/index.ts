// ============================================
// AdLab Auth - Barrel Export
// ============================================
// PHASE D20: Role-based access control.
// PHASE D21: Server-derived actor resolution.
// ============================================

// Roles and permissions
export {
  type AdLabRole,
  type PermissionAction,
  type Actor,
  ADLAB_ROLES,
  PERMISSION_ACTIONS,
  CAPABILITIES_MATRIX,
  ROLE_HIERARCHY,
  isAllowed,
  getAllowedActions,
  getRolesForAction,
  isValidRole,
  assertValidActor,
  assertCan,
  canPerform,
  getRoleLabel,
  getRoleDescription,
  getActionLabel,
  compareRoles,
  hasAtLeastRole,
  PermissionDeniedError,
  InvalidRoleError,
  MissingActorError,
} from './roles';

// Server guards and actor resolution
export {
  // D21: Server-derived actor resolution (preferred)
  resolveActorFromRequest,
  resolveActorFromRequestForWorkspace,
  requireActorWithPermission,
  withActorPermission,
  notAuthenticatedResponse,
  noMembershipResponse,
  // D21: Error types
  type ResolvedActor,
  NotAuthenticatedError,
  MissingMembershipError,
  InactiveMembershipError,
  NoWorkspaceError,
  WorkspaceResolutionError,
  // D20: Permission checks
  requirePermission,
  checkPermission,
  permissionDeniedResponse,
  type PermissionResult,
  type RequirePermissionOptions,
  // DEPRECATED: Legacy (use resolveActorFromRequest instead)
  resolveActor,
  withPermission,
} from './requirePermission';

// Actor resolution utilities
export {
  resolveActorFromSession,
  resolveActorForWorkspace,
  resolveActorWithDevFallback,
  tryResolveActor,
  tryResolveActorForWorkspace,
  type ActorResolutionResult,
  isResolvedActor,
} from './resolveActor';
