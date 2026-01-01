// ============================================
// STEP 14: Team/Multi-User/Organization Intent Governance
// ============================================
// Introduces USER ROLE, TEAM CONTEXT, and GOVERNANCE LAYERS
// for intent interpretation, confirmation, learning, and auto-apply.
//
// CORE PRINCIPLE:
// Same instruction, different role → different UX + confirmation + learning.
//
// INVARIANTS:
// - No new LLM calls
// - No routing logic override
// - No cross-user learning
// - No privacy regression
// - SINGLE_LLM_CALL_SITE preserved
// - All changes are additive, gated, and reversible
// ============================================

import type { StabilityBand } from './intentStability';
import type { ConversationMode, ContinuityState } from './intentContinuity';

// ============================================
// Types
// ============================================

/**
 * User roles in the organization hierarchy
 */
export type UserRole = 'ADMIN' | 'EDITOR' | 'JUNIOR' | 'CLIENT' | 'VIEWER';

/**
 * Role-based permissions for intent features
 */
export interface RolePermissions {
  /** Can use auto-apply for learned patterns */
  allowAutoApply: boolean;
  /** Can contribute to learning loop */
  allowLearning: boolean;
  /** Can use edit-in-place actions */
  allowEditInPlace: boolean;
  /** Can have preference bias applied */
  allowPreferenceBias: boolean;
  /** Can execute AI requests (send to LLM) */
  allowExecution: boolean;
  /** Minimum stability band required for confirmation skip */
  minStabilityForSkip: StabilityBand | 'NEVER';
}

/**
 * Governance context for a user session
 */
export interface GovernanceContext {
  /** Unique user identifier */
  userId: string;
  /** Optional team identifier */
  teamId?: string;
  /** User's role in the organization */
  role: UserRole;
  /** Computed permissions based on role + overrides */
  permissions: RolePermissions;
  /** Whether governance is active (for gradual rollout) */
  active: boolean;
}

/**
 * Intent snapshot for governance decisions
 */
export interface IntentSnapshot {
  /** Pattern hash for this intent */
  patternHash: string;
  /** Route hint from confidence */
  routeHint: 'CREATE' | 'TRANSFORM';
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether auto-apply was suggested */
  autoApplySuggested: boolean;
}

/**
 * Governance decision result
 */
export interface GovernanceDecision {
  /** Whether confirmation is required */
  confirmationRequired: boolean;
  /** Whether auto-apply is allowed */
  autoApplyAllowed: boolean;
  /** Whether learning should be recorded */
  learningAllowed: boolean;
  /** Whether preference bias should be applied */
  preferenceBiasAllowed: boolean;
  /** Reason for the decision */
  reason: string;
  /** DEV-only: detailed reasoning */
  debugReason?: string;
}

// ============================================
// Default Role Permissions
// ============================================

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  ADMIN: {
    allowAutoApply: true,
    allowLearning: true,
    allowEditInPlace: true,
    allowPreferenceBias: true,
    allowExecution: true,
    minStabilityForSkip: 'HIGH', // Can skip with HIGH stability
  },
  EDITOR: {
    allowAutoApply: true,
    allowLearning: true,
    allowEditInPlace: true,
    allowPreferenceBias: true,
    allowExecution: true,
    minStabilityForSkip: 'HIGH', // Same as ADMIN
  },
  JUNIOR: {
    allowAutoApply: false, // Never auto-apply
    allowLearning: true, // Can contribute to learning
    allowEditInPlace: true,
    allowPreferenceBias: true,
    allowExecution: true,
    minStabilityForSkip: 'NEVER', // Always confirm
  },
  CLIENT: {
    allowAutoApply: false, // Never auto-apply
    allowLearning: false, // No learning
    allowEditInPlace: false, // No direct editing
    allowPreferenceBias: false, // No preference bias
    allowExecution: true,
    minStabilityForSkip: 'NEVER', // Always confirm
  },
  VIEWER: {
    allowAutoApply: false,
    allowLearning: false,
    allowEditInPlace: false,
    allowPreferenceBias: false,
    allowExecution: false, // Cannot execute
    minStabilityForSkip: 'NEVER',
  },
};

// ============================================
// Session-only Team Overrides
// ============================================

interface TeamOverrides {
  autoApplyDisabled: boolean;
  learningDisabled: boolean;
  preferenceBiasDisabled: boolean;
  disabledAt: number;
}

const _teamOverrides: Map<string, TeamOverrides> = new Map();

/**
 * Temporarily disable auto-apply for a team (session-only)
 */
export function temporarilyDisableTeamAutoApply(teamId: string): void {
  const existing = _teamOverrides.get(teamId) || createDefaultOverrides();
  existing.autoApplyDisabled = true;
  existing.disabledAt = Date.now();
  _teamOverrides.set(teamId, existing);

  if (process.env.NODE_ENV === 'development') {
    console.log('[IntentGovernance] Team auto-apply disabled:', teamId);
  }
}

/**
 * Temporarily disable learning for a team (session-only)
 */
export function temporarilyDisableTeamLearning(teamId: string): void {
  const existing = _teamOverrides.get(teamId) || createDefaultOverrides();
  existing.learningDisabled = true;
  existing.disabledAt = Date.now();
  _teamOverrides.set(teamId, existing);

  if (process.env.NODE_ENV === 'development') {
    console.log('[IntentGovernance] Team learning disabled:', teamId);
  }
}

/**
 * Re-enable team auto-apply
 */
export function enableTeamAutoApply(teamId: string): void {
  const existing = _teamOverrides.get(teamId);
  if (existing) {
    existing.autoApplyDisabled = false;
    _teamOverrides.set(teamId, existing);
  }
}

/**
 * Re-enable team learning
 */
export function enableTeamLearning(teamId: string): void {
  const existing = _teamOverrides.get(teamId);
  if (existing) {
    existing.learningDisabled = false;
    _teamOverrides.set(teamId, existing);
  }
}

/**
 * Get team overrides (if any)
 */
export function getTeamOverrides(teamId: string): TeamOverrides | null {
  return _teamOverrides.get(teamId) || null;
}

/**
 * Clear all team overrides (for testing)
 */
export function clearAllTeamOverrides(): void {
  _teamOverrides.clear();
}

function createDefaultOverrides(): TeamOverrides {
  return {
    autoApplyDisabled: false,
    learningDisabled: false,
    preferenceBiasDisabled: false,
    disabledAt: 0,
  };
}

// ============================================
// Context Management
// ============================================

let _currentContext: GovernanceContext | null = null;

/**
 * Set the current governance context (called on login/session start)
 */
export function setGovernanceContext(context: GovernanceContext): void {
  _currentContext = context;

  if (process.env.NODE_ENV === 'development') {
    console.log('[IntentGovernance] Context set:', {
      userId: context.userId,
      role: context.role,
      teamId: context.teamId,
      active: context.active,
    });
  }
}

/**
 * Get the current governance context
 */
export function getGovernanceContext(): GovernanceContext | null {
  return _currentContext;
}

/**
 * Clear the governance context (called on logout)
 */
export function clearGovernanceContext(): void {
  _currentContext = null;
}

/**
 * Check if governance is currently active
 */
export function isGovernanceActive(): boolean {
  return _currentContext?.active ?? false;
}

// ============================================
// Permission Helpers
// ============================================

/**
 * Get default permissions for a role
 */
export function getDefaultPermissionsByRole(role: UserRole): RolePermissions {
  return { ...ROLE_PERMISSIONS[role] };
}

/**
 * Get effective permissions (role + team overrides)
 */
export function getEffectivePermissions(context: GovernanceContext): RolePermissions {
  const base = { ...ROLE_PERMISSIONS[context.role] };

  // Apply team overrides if team exists
  if (context.teamId) {
    const overrides = getTeamOverrides(context.teamId);
    if (overrides) {
      if (overrides.autoApplyDisabled) {
        base.allowAutoApply = false;
      }
      if (overrides.learningDisabled) {
        base.allowLearning = false;
      }
      if (overrides.preferenceBiasDisabled) {
        base.allowPreferenceBias = false;
      }
    }
  }

  return base;
}

/**
 * Check if learning is allowed for the current context
 */
export function isLearningAllowed(context?: GovernanceContext | null): boolean {
  const ctx = context ?? _currentContext;
  if (!ctx || !ctx.active) return true; // No governance = default behavior

  const permissions = getEffectivePermissions(ctx);
  return permissions.allowLearning;
}

/**
 * Check if auto-apply is allowed for the current context
 */
export function isAutoApplyAllowed(context?: GovernanceContext | null): boolean {
  const ctx = context ?? _currentContext;
  if (!ctx || !ctx.active) return true; // No governance = default behavior

  const permissions = getEffectivePermissions(ctx);
  return permissions.allowAutoApply;
}

/**
 * Check if execution is allowed for the current context
 */
export function isExecutionAllowed(context?: GovernanceContext | null): boolean {
  const ctx = context ?? _currentContext;
  if (!ctx || !ctx.active) return true; // No governance = default behavior

  const permissions = getEffectivePermissions(ctx);
  return permissions.allowExecution;
}

/**
 * Check if preference bias is allowed for the current context
 */
export function isPreferenceBiasAllowed(context?: GovernanceContext | null): boolean {
  const ctx = context ?? _currentContext;
  if (!ctx || !ctx.active) return true; // No governance = default behavior

  const permissions = getEffectivePermissions(ctx);
  return permissions.allowPreferenceBias;
}

// ============================================
// Confirmation Governance
// ============================================

/**
 * Determine if confirmation should be forced based on governance rules
 */
export function shouldForceConfirmation(
  context: GovernanceContext | null,
  intentSnapshot: IntentSnapshot,
  continuity: ContinuityState | null,
  stabilityBand: StabilityBand
): GovernanceDecision {
  // No governance active = use default behavior
  if (!context || !context.active) {
    return {
      confirmationRequired: false, // Let default logic decide
      autoApplyAllowed: true,
      learningAllowed: true,
      preferenceBiasAllowed: true,
      reason: 'Governance inactive',
      debugReason: 'No governance context or inactive',
    };
  }

  const permissions = getEffectivePermissions(context);

  // VIEWER cannot execute at all
  if (!permissions.allowExecution) {
    return {
      confirmationRequired: true,
      autoApplyAllowed: false,
      learningAllowed: false,
      preferenceBiasAllowed: false,
      reason: 'Execution not allowed',
      debugReason: `Role ${context.role} cannot execute AI requests`,
    };
  }

  // Check if stability allows confirmation skip
  const canSkipByStability = checkStabilityThreshold(
    stabilityBand,
    permissions.minStabilityForSkip
  );

  // Check continuity mode for skip eligibility
  const isInRefinementFlow = continuity?.mode === 'REFINE_FLOW' && continuity.modeConfidence > 0.7;

  // Determine confirmation requirement
  let confirmationRequired = true;
  let reason = 'Default: confirmation required';
  let debugReason = '';

  if (permissions.minStabilityForSkip === 'NEVER') {
    // Role always requires confirmation
    confirmationRequired = true;
    reason = 'Role requires confirmation';
    debugReason = `Role ${context.role} always requires confirmation`;
  } else if (canSkipByStability && intentSnapshot.autoApplySuggested) {
    // High stability + auto-apply eligible
    confirmationRequired = false;
    reason = 'Stable pattern';
    debugReason = `Stability ${stabilityBand} >= ${permissions.minStabilityForSkip}, auto-apply allowed`;
  } else if (canSkipByStability && isInRefinementFlow) {
    // High stability + refinement flow
    confirmationRequired = false;
    reason = 'Refinement flow';
    debugReason = `Stability ${stabilityBand} + REFINE_FLOW allows skip`;
  } else {
    debugReason = `Stability ${stabilityBand} < ${permissions.minStabilityForSkip} or no auto-apply`;
  }

  return {
    confirmationRequired,
    autoApplyAllowed: permissions.allowAutoApply,
    learningAllowed: permissions.allowLearning,
    preferenceBiasAllowed: permissions.allowPreferenceBias,
    reason,
    debugReason,
  };
}

/**
 * Check if stability band meets the threshold
 */
function checkStabilityThreshold(
  current: StabilityBand,
  required: StabilityBand | 'NEVER'
): boolean {
  if (required === 'NEVER') return false;

  const bandOrder: Record<StabilityBand, number> = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  return bandOrder[current] >= bandOrder[required];
}

// ============================================
// User Isolation Helpers
// ============================================

/**
 * Get a user-scoped storage key
 * CRITICAL: All learning/preference storage MUST use this
 */
export function getUserScopedKey(baseKey: string, userId?: string): string {
  const ctx = _currentContext;
  const effectiveUserId = userId ?? ctx?.userId;

  if (!effectiveUserId) {
    // No user context = use default key (backwards compatible)
    return baseKey;
  }

  return `${baseKey}_user_${effectiveUserId}`;
}

/**
 * Validate that a storage key belongs to the current user
 * Returns false if the key belongs to a different user
 */
export function validateUserAccess(storageKey: string): boolean {
  const ctx = _currentContext;

  // No governance = allow all access (backwards compatible)
  if (!ctx || !ctx.active) return true;

  // Check if key contains a user scope
  const userScopeMatch = storageKey.match(/_user_([a-zA-Z0-9_-]+)$/);

  if (!userScopeMatch) {
    // Legacy key without user scope - allow for migration
    return true;
  }

  const keyUserId = userScopeMatch[1];

  if (keyUserId !== ctx.userId) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[IntentGovernance] Cross-user access attempt blocked:', {
        currentUser: ctx.userId,
        keyUser: keyUserId,
        storageKey,
      });
    }
    return false;
  }

  return true;
}

// ============================================
// Factory Helpers
// ============================================

/**
 * Create a governance context for a user
 */
export function createGovernanceContext(params: {
  userId: string;
  teamId?: string;
  role: UserRole;
  active?: boolean;
  permissionOverrides?: Partial<RolePermissions>;
}): GovernanceContext {
  const basePermissions = getDefaultPermissionsByRole(params.role);

  return {
    userId: params.userId,
    teamId: params.teamId,
    role: params.role,
    active: params.active ?? true,
    permissions: {
      ...basePermissions,
      ...params.permissionOverrides,
    },
  };
}

// ============================================
// Debug Helpers
// ============================================

/**
 * Get a debug summary of the current governance state
 */
export function getGovernanceDebugSummary(): string {
  const ctx = _currentContext;

  if (!ctx) {
    return 'No governance';
  }

  if (!ctx.active) {
    return 'Governance inactive';
  }

  const permissions = getEffectivePermissions(ctx);
  const teamOverrides = ctx.teamId ? getTeamOverrides(ctx.teamId) : null;

  const parts = [
    `Role: ${ctx.role}`,
    `Auto: ${permissions.allowAutoApply ? '✓' : '✗'}`,
    `Learn: ${permissions.allowLearning ? '✓' : '✗'}`,
    `Exec: ${permissions.allowExecution ? '✓' : '✗'}`,
  ];

  if (teamOverrides) {
    if (teamOverrides.autoApplyDisabled) parts.push('Team:NoAuto');
    if (teamOverrides.learningDisabled) parts.push('Team:NoLearn');
  }

  return parts.join(' | ');
}

/**
 * Get detailed governance state for debug display
 */
export function getGovernanceDebugState(): {
  active: boolean;
  userId?: string;
  teamId?: string;
  role?: UserRole;
  permissions?: RolePermissions;
  teamOverrides?: TeamOverrides | null;
} {
  const ctx = _currentContext;

  if (!ctx) {
    return { active: false };
  }

  return {
    active: ctx.active,
    userId: ctx.userId,
    teamId: ctx.teamId,
    role: ctx.role,
    permissions: getEffectivePermissions(ctx),
    teamOverrides: ctx.teamId ? getTeamOverrides(ctx.teamId) : null,
  };
}

// ============================================
// Role Display Helpers
// ============================================

type Language = 'vi' | 'en';

const ROLE_LABELS: Record<UserRole, Record<Language, string>> = {
  ADMIN: { vi: 'Quan tri vien', en: 'Administrator' },
  EDITOR: { vi: 'Bien tap vien', en: 'Editor' },
  JUNIOR: { vi: 'Nhan vien moi', en: 'Junior' },
  CLIENT: { vi: 'Khach hang', en: 'Client' },
  VIEWER: { vi: 'Nguoi xem', en: 'Viewer' },
};

const ROLE_DESCRIPTIONS: Record<UserRole, Record<Language, string>> = {
  ADMIN: {
    vi: 'Quyen toi da, co the bo qua xac nhan khi do on dinh cao',
    en: 'Full permissions, can skip confirmation with high stability',
  },
  EDITOR: {
    vi: 'Quyen chinh sua day du, co the tu dong ap dung',
    en: 'Full editing permissions, can auto-apply',
  },
  JUNIOR: {
    vi: 'Can xac nhan moi hanh dong, dang hoc tap',
    en: 'Requires confirmation for all actions, learning mode',
  },
  CLIENT: {
    vi: 'Chi xem va yeu cau, khong luu so thich',
    en: 'View and request only, no preference learning',
  },
  VIEWER: {
    vi: 'Chi xem, khong thuc thi',
    en: 'View only, no execution',
  },
};

/**
 * Get human-readable label for a role
 */
export function getRoleLabel(role: UserRole, language: Language = 'vi'): string {
  return ROLE_LABELS[role][language];
}

/**
 * Get description for a role
 */
export function getRoleDescription(role: UserRole, language: Language = 'vi'): string {
  return ROLE_DESCRIPTIONS[role][language];
}

/**
 * Get color classes for a role
 */
export function getRoleColorClasses(role: UserRole): {
  bg: string;
  text: string;
  border: string;
} {
  switch (role) {
    case 'ADMIN':
      return {
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-300 dark:border-purple-700',
      };
    case 'EDITOR':
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-300 dark:border-blue-700',
      };
    case 'JUNIOR':
      return {
        bg: 'bg-teal-100 dark:bg-teal-900/30',
        text: 'text-teal-700 dark:text-teal-300',
        border: 'border-teal-300 dark:border-teal-700',
      };
    case 'CLIENT':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-300 dark:border-amber-700',
      };
    case 'VIEWER':
      return {
        bg: 'bg-slate-100 dark:bg-slate-900/30',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-300 dark:border-slate-700',
      };
  }
}
