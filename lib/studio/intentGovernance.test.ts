// ============================================
// STEP 14: Intent Governance Tests
// ============================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  // Types
  type UserRole,
  type GovernanceContext,
  type IntentSnapshot,
  type GovernanceDecision,
  // Context management
  setGovernanceContext,
  getGovernanceContext,
  clearGovernanceContext,
  isGovernanceActive,
  createGovernanceContext,
  // Permission helpers
  getDefaultPermissionsByRole,
  getEffectivePermissions,
  isLearningAllowed,
  isAutoApplyAllowed,
  isExecutionAllowed,
  isPreferenceBiasAllowed,
  // Confirmation governance
  shouldForceConfirmation,
  // Team overrides
  temporarilyDisableTeamAutoApply,
  temporarilyDisableTeamLearning,
  enableTeamAutoApply,
  enableTeamLearning,
  getTeamOverrides,
  clearAllTeamOverrides,
  // User isolation
  getUserScopedKey,
  validateUserAccess,
  // Display helpers
  getRoleLabel,
  getRoleDescription,
  getRoleColorClasses,
  getGovernanceDebugSummary,
  getGovernanceDebugState,
} from './intentGovernance';
import type { ContinuityState } from './intentContinuity';

// ============================================
// Setup / Teardown
// ============================================
beforeEach(() => {
  clearGovernanceContext();
  clearAllTeamOverrides();
});

afterEach(() => {
  clearGovernanceContext();
  clearAllTeamOverrides();
});

// ============================================
// Role Permissions Tests
// ============================================
describe('getDefaultPermissionsByRole', () => {
  it('should return full permissions for ADMIN', () => {
    const perms = getDefaultPermissionsByRole('ADMIN');

    expect(perms.allowAutoApply).toBe(true);
    expect(perms.allowLearning).toBe(true);
    expect(perms.allowEditInPlace).toBe(true);
    expect(perms.allowPreferenceBias).toBe(true);
    expect(perms.allowExecution).toBe(true);
    expect(perms.minStabilityForSkip).toBe('HIGH');
  });

  it('should return full permissions for EDITOR', () => {
    const perms = getDefaultPermissionsByRole('EDITOR');

    expect(perms.allowAutoApply).toBe(true);
    expect(perms.allowLearning).toBe(true);
    expect(perms.allowExecution).toBe(true);
  });

  it('should return restricted permissions for JUNIOR', () => {
    const perms = getDefaultPermissionsByRole('JUNIOR');

    expect(perms.allowAutoApply).toBe(false); // Never auto-apply
    expect(perms.allowLearning).toBe(true); // Can contribute
    expect(perms.allowExecution).toBe(true);
    expect(perms.minStabilityForSkip).toBe('NEVER'); // Always confirm
  });

  it('should return minimal permissions for CLIENT', () => {
    const perms = getDefaultPermissionsByRole('CLIENT');

    expect(perms.allowAutoApply).toBe(false);
    expect(perms.allowLearning).toBe(false); // No learning
    expect(perms.allowEditInPlace).toBe(false);
    expect(perms.allowPreferenceBias).toBe(false);
    expect(perms.allowExecution).toBe(true);
    expect(perms.minStabilityForSkip).toBe('NEVER');
  });

  it('should return view-only permissions for VIEWER', () => {
    const perms = getDefaultPermissionsByRole('VIEWER');

    expect(perms.allowAutoApply).toBe(false);
    expect(perms.allowLearning).toBe(false);
    expect(perms.allowExecution).toBe(false); // Cannot execute
  });
});

// ============================================
// Context Management Tests
// ============================================
describe('context management', () => {
  it('should set and get governance context', () => {
    const ctx = createGovernanceContext({
      userId: 'user-123',
      teamId: 'team-456',
      role: 'EDITOR',
    });

    setGovernanceContext(ctx);
    const retrieved = getGovernanceContext();

    expect(retrieved).not.toBeNull();
    expect(retrieved?.userId).toBe('user-123');
    expect(retrieved?.teamId).toBe('team-456');
    expect(retrieved?.role).toBe('EDITOR');
  });

  it('should clear governance context', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-123',
      role: 'ADMIN',
    }));

    clearGovernanceContext();

    expect(getGovernanceContext()).toBeNull();
  });

  it('should report governance active state', () => {
    expect(isGovernanceActive()).toBe(false);

    setGovernanceContext(createGovernanceContext({
      userId: 'user-123',
      role: 'EDITOR',
      active: true,
    }));

    expect(isGovernanceActive()).toBe(true);

    setGovernanceContext(createGovernanceContext({
      userId: 'user-123',
      role: 'EDITOR',
      active: false,
    }));

    expect(isGovernanceActive()).toBe(false);
  });
});

// ============================================
// Permission Helper Tests
// ============================================
describe('permission helpers', () => {
  it('should allow learning for ADMIN', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'admin-1',
      role: 'ADMIN',
    }));

    expect(isLearningAllowed()).toBe(true);
  });

  it('should NOT allow learning for CLIENT', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'client-1',
      role: 'CLIENT',
    }));

    expect(isLearningAllowed()).toBe(false);
  });

  it('should allow auto-apply for EDITOR', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'editor-1',
      role: 'EDITOR',
    }));

    expect(isAutoApplyAllowed()).toBe(true);
  });

  it('should NOT allow auto-apply for JUNIOR', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'junior-1',
      role: 'JUNIOR',
    }));

    expect(isAutoApplyAllowed()).toBe(false);
  });

  it('should NOT allow execution for VIEWER', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'viewer-1',
      role: 'VIEWER',
    }));

    expect(isExecutionAllowed()).toBe(false);
  });

  it('should NOT allow preference bias for CLIENT', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'client-1',
      role: 'CLIENT',
    }));

    expect(isPreferenceBiasAllowed()).toBe(false);
  });

  it('should return true when governance is inactive', () => {
    // No context set = governance inactive
    expect(isLearningAllowed()).toBe(true);
    expect(isAutoApplyAllowed()).toBe(true);
    expect(isExecutionAllowed()).toBe(true);
  });
});

// ============================================
// Confirmation Governance Tests
// ============================================
describe('shouldForceConfirmation', () => {
  const baseIntent: IntentSnapshot = {
    patternHash: 'test-hash',
    routeHint: 'TRANSFORM',
    confidence: 0.85,
    autoApplySuggested: true,
  };

  const baseContinuity: ContinuityState = {
    mode: 'EXPLORATION_FLOW',
    modeConfidence: 0.6,
    history: [],
    consecutiveCount: 0,
    dominantType: null,
    inCorrectionCycle: false,
    reason: 'test',
  };

  it('should return default behavior when governance inactive', () => {
    const decision = shouldForceConfirmation(null, baseIntent, baseContinuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(false);
    expect(decision.autoApplyAllowed).toBe(true);
    expect(decision.learningAllowed).toBe(true);
    expect(decision.reason).toContain('inactive');
  });

  it('should allow confirmation skip for ADMIN with HIGH stability', () => {
    const ctx = createGovernanceContext({
      userId: 'admin-1',
      role: 'ADMIN',
    });

    const decision = shouldForceConfirmation(ctx, baseIntent, baseContinuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(false);
    expect(decision.autoApplyAllowed).toBe(true);
  });

  it('should require confirmation for ADMIN with MEDIUM stability', () => {
    const ctx = createGovernanceContext({
      userId: 'admin-1',
      role: 'ADMIN',
    });

    const intentNoAutoApply = { ...baseIntent, autoApplySuggested: false };
    const decision = shouldForceConfirmation(ctx, intentNoAutoApply, baseContinuity, 'MEDIUM');

    expect(decision.confirmationRequired).toBe(true);
  });

  it('should ALWAYS require confirmation for JUNIOR', () => {
    const ctx = createGovernanceContext({
      userId: 'junior-1',
      role: 'JUNIOR',
    });

    // Even with HIGH stability
    const decision = shouldForceConfirmation(ctx, baseIntent, baseContinuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(true);
    expect(decision.autoApplyAllowed).toBe(false);
    expect(decision.reason).toContain('Role requires confirmation');
  });

  it('should ALWAYS require confirmation for CLIENT', () => {
    const ctx = createGovernanceContext({
      userId: 'client-1',
      role: 'CLIENT',
    });

    const decision = shouldForceConfirmation(ctx, baseIntent, baseContinuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(true);
    expect(decision.learningAllowed).toBe(false);
    expect(decision.preferenceBiasAllowed).toBe(false);
  });

  it('should block execution for VIEWER', () => {
    const ctx = createGovernanceContext({
      userId: 'viewer-1',
      role: 'VIEWER',
    });

    const decision = shouldForceConfirmation(ctx, baseIntent, baseContinuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(true);
    expect(decision.autoApplyAllowed).toBe(false);
    expect(decision.learningAllowed).toBe(false);
    expect(decision.reason).toContain('not allowed');
  });

  it('should allow skip in REFINE_FLOW with HIGH stability for EDITOR', () => {
    const ctx = createGovernanceContext({
      userId: 'editor-1',
      role: 'EDITOR',
    });

    const refineContinuity: ContinuityState = {
      ...baseContinuity,
      mode: 'REFINE_FLOW',
      modeConfidence: 0.8,
    };

    const decision = shouldForceConfirmation(ctx, baseIntent, refineContinuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(false);
  });
});

// ============================================
// Team Override Tests
// ============================================
describe('team overrides', () => {
  it('should disable auto-apply for a team', () => {
    const ctx = createGovernanceContext({
      userId: 'editor-1',
      teamId: 'team-123',
      role: 'EDITOR',
    });

    // Initially allowed
    expect(getEffectivePermissions(ctx).allowAutoApply).toBe(true);

    // Disable for team
    temporarilyDisableTeamAutoApply('team-123');

    // Now blocked
    expect(getEffectivePermissions(ctx).allowAutoApply).toBe(false);
  });

  it('should disable learning for a team', () => {
    const ctx = createGovernanceContext({
      userId: 'editor-1',
      teamId: 'team-123',
      role: 'EDITOR',
    });

    temporarilyDisableTeamLearning('team-123');

    expect(getEffectivePermissions(ctx).allowLearning).toBe(false);
  });

  it('should re-enable team auto-apply', () => {
    const ctx = createGovernanceContext({
      userId: 'editor-1',
      teamId: 'team-123',
      role: 'EDITOR',
    });

    temporarilyDisableTeamAutoApply('team-123');
    enableTeamAutoApply('team-123');

    expect(getEffectivePermissions(ctx).allowAutoApply).toBe(true);
  });

  it('should not affect users without team', () => {
    const ctx = createGovernanceContext({
      userId: 'editor-1',
      // No teamId
      role: 'EDITOR',
    });

    temporarilyDisableTeamAutoApply('team-123');

    // Should still be allowed (no team)
    expect(getEffectivePermissions(ctx).allowAutoApply).toBe(true);
  });

  it('should track team overrides', () => {
    temporarilyDisableTeamAutoApply('team-123');

    const overrides = getTeamOverrides('team-123');

    expect(overrides).not.toBeNull();
    expect(overrides?.autoApplyDisabled).toBe(true);
    expect(overrides?.disabledAt).toBeGreaterThan(0);
  });

  it('should clear all team overrides', () => {
    temporarilyDisableTeamAutoApply('team-1');
    temporarilyDisableTeamLearning('team-2');

    clearAllTeamOverrides();

    expect(getTeamOverrides('team-1')).toBeNull();
    expect(getTeamOverrides('team-2')).toBeNull();
  });
});

// ============================================
// User Isolation Tests
// ============================================
describe('user isolation', () => {
  it('should create user-scoped storage keys', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-abc',
      role: 'EDITOR',
    }));

    const key = getUserScopedKey('studio_learning');

    expect(key).toBe('studio_learning_user_user-abc');
  });

  it('should return base key when no user context', () => {
    // No context set
    const key = getUserScopedKey('studio_learning');

    expect(key).toBe('studio_learning');
  });

  it('should validate user access for own keys', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-123',
      role: 'EDITOR',
    }));

    expect(validateUserAccess('studio_learning_user_user-123')).toBe(true);
  });

  it('should block access to other users keys', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-123',
      role: 'EDITOR',
    }));

    expect(validateUserAccess('studio_learning_user_user-456')).toBe(false);
  });

  it('should allow legacy keys without user scope', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-123',
      role: 'EDITOR',
    }));

    // Legacy key without _user_ suffix
    expect(validateUserAccess('studio_learning')).toBe(true);
  });

  it('should allow all access when governance inactive', () => {
    // No context = governance inactive
    expect(validateUserAccess('studio_learning_user_any-user')).toBe(true);
  });
});

// ============================================
// Display Helper Tests
// ============================================
describe('display helpers', () => {
  it('should return role labels in Vietnamese', () => {
    expect(getRoleLabel('ADMIN', 'vi')).toBe('Quan tri vien');
    expect(getRoleLabel('JUNIOR', 'vi')).toBe('Nhan vien moi');
  });

  it('should return role labels in English', () => {
    expect(getRoleLabel('ADMIN', 'en')).toBe('Administrator');
    expect(getRoleLabel('CLIENT', 'en')).toBe('Client');
  });

  it('should return role descriptions', () => {
    const desc = getRoleDescription('JUNIOR', 'en');
    expect(desc).toContain('confirmation');
  });

  it('should return role color classes', () => {
    const colors = getRoleColorClasses('ADMIN');
    expect(colors.bg).toContain('purple');

    const editorColors = getRoleColorClasses('EDITOR');
    expect(editorColors.bg).toContain('blue');
  });
});

// ============================================
// Debug Summary Tests
// ============================================
describe('debug helpers', () => {
  it('should return "No governance" when no context', () => {
    expect(getGovernanceDebugSummary()).toBe('No governance');
  });

  it('should return "Governance inactive" when inactive', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-1',
      role: 'EDITOR',
      active: false,
    }));

    expect(getGovernanceDebugSummary()).toBe('Governance inactive');
  });

  it('should return detailed summary when active', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-1',
      role: 'EDITOR',
    }));

    const summary = getGovernanceDebugSummary();

    expect(summary).toContain('Role: EDITOR');
    expect(summary).toContain('Auto: ✓');
    expect(summary).toContain('Learn: ✓');
  });

  it('should show team overrides in summary', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-1',
      teamId: 'team-1',
      role: 'EDITOR',
    }));

    temporarilyDisableTeamAutoApply('team-1');

    const summary = getGovernanceDebugSummary();

    expect(summary).toContain('Team:NoAuto');
  });

  it('should return debug state object', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-1',
      teamId: 'team-1',
      role: 'ADMIN',
    }));

    const state = getGovernanceDebugState();

    expect(state.active).toBe(true);
    expect(state.userId).toBe('user-1');
    expect(state.role).toBe('ADMIN');
    expect(state.permissions).toBeDefined();
  });
});

// ============================================
// Same Instruction, Different Role Tests
// ============================================
describe('same instruction, different role behavior', () => {
  const intent: IntentSnapshot = {
    patternHash: 'instruction-hash',
    routeHint: 'TRANSFORM',
    confidence: 0.9,
    autoApplySuggested: true,
  };

  const continuity: ContinuityState = {
    mode: 'REFINE_FLOW',
    modeConfidence: 0.8,
    history: [],
    consecutiveCount: 2,
    dominantType: 'TRANSFORM',
    inCorrectionCycle: false,
    reason: 'test',
  };

  it('ADMIN can skip confirmation with HIGH stability', () => {
    const ctx = createGovernanceContext({ userId: 'admin', role: 'ADMIN' });
    const decision = shouldForceConfirmation(ctx, intent, continuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(false);
    expect(decision.autoApplyAllowed).toBe(true);
    expect(decision.learningAllowed).toBe(true);
  });

  it('EDITOR can skip confirmation with HIGH stability', () => {
    const ctx = createGovernanceContext({ userId: 'editor', role: 'EDITOR' });
    const decision = shouldForceConfirmation(ctx, intent, continuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(false);
  });

  it('JUNIOR cannot skip confirmation even with HIGH stability', () => {
    const ctx = createGovernanceContext({ userId: 'junior', role: 'JUNIOR' });
    const decision = shouldForceConfirmation(ctx, intent, continuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(true);
    expect(decision.autoApplyAllowed).toBe(false);
    expect(decision.learningAllowed).toBe(true); // Can still learn
  });

  it('CLIENT cannot skip, learn, or have preference bias', () => {
    const ctx = createGovernanceContext({ userId: 'client', role: 'CLIENT' });
    const decision = shouldForceConfirmation(ctx, intent, continuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(true);
    expect(decision.autoApplyAllowed).toBe(false);
    expect(decision.learningAllowed).toBe(false);
    expect(decision.preferenceBiasAllowed).toBe(false);
  });

  it('VIEWER cannot execute at all', () => {
    const ctx = createGovernanceContext({ userId: 'viewer', role: 'VIEWER' });
    const decision = shouldForceConfirmation(ctx, intent, continuity, 'HIGH');

    expect(decision.confirmationRequired).toBe(true);
    expect(decision.autoApplyAllowed).toBe(false);
    expect(decision.learningAllowed).toBe(false);
    expect(decision.reason).toContain('not allowed');
  });
});

// ============================================
// No Cross-User Data Leakage Tests
// ============================================
describe('cross-user isolation', () => {
  it('should generate different storage keys for different users', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-A',
      role: 'EDITOR',
    }));
    const keyA = getUserScopedKey('studio_learning');

    setGovernanceContext(createGovernanceContext({
      userId: 'user-B',
      role: 'EDITOR',
    }));
    const keyB = getUserScopedKey('studio_learning');

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain('user-A');
    expect(keyB).toContain('user-B');
  });

  it('should prevent user B from accessing user A data', () => {
    // User A creates data
    setGovernanceContext(createGovernanceContext({
      userId: 'user-A',
      role: 'EDITOR',
    }));
    const keyA = getUserScopedKey('studio_preferences');

    // User B tries to access
    setGovernanceContext(createGovernanceContext({
      userId: 'user-B',
      role: 'EDITOR',
    }));

    expect(validateUserAccess(keyA)).toBe(false);
  });

  it('should allow user to access own data', () => {
    setGovernanceContext(createGovernanceContext({
      userId: 'user-A',
      role: 'EDITOR',
    }));

    const key = getUserScopedKey('studio_preferences');
    expect(validateUserAccess(key)).toBe(true);
  });
});
