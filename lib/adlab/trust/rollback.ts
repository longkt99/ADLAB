// ============================================
// Trust Rollback Mechanism
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// PURPOSE:
// Provides fast, logged, customer-visible rollback capability.
// Rollbacks are treated as first-class operations with full audit trail.
//
// INVARIANTS:
// - Rollback must be fast (single operation)
// - Rollback must be fully logged (audit trail)
// - Rollback must be customer-visible (changelog entry)
// - Rollback cannot delete or modify history
// ============================================

import {
  type TrustVersion,
  type TrustAuditEvent,
} from './snapshotTypes';
import {
  rollbackToVersion as storeRollback,
  getActiveVersion,
  getAllVersions,
  getSnapshot,
  getAuditLog,
} from './snapshotStore';
import { addRollbackEntry, hasChangelogEntry } from './changelogStore';
import { validateForActivation } from './deployGate';

// ============================================
// Types
// ============================================

/**
 * Rollback request input.
 */
export interface RollbackRequest {
  /** Version to roll back to */
  targetVersion: TrustVersion;
  /** Actor performing the rollback */
  actor: string;
  /** Actor's role */
  role: string;
  /** Reason for rollback (customer-visible) */
  reason: string;
  /** Internal notes (not customer-visible) */
  internalNotes?: string;
}

/**
 * Rollback result.
 */
export interface RollbackResult {
  /** Whether rollback succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Version that was active before rollback */
  previousVersion?: TrustVersion;
  /** Version that is now active */
  currentVersion?: TrustVersion;
  /** Timestamp of rollback */
  timestamp?: string;
}

/**
 * Rollback eligibility check result.
 */
export interface RollbackEligibility {
  /** Whether rollback is possible */
  eligible: boolean;
  /** Issues preventing rollback */
  issues: string[];
  /** Available versions to roll back to */
  availableVersions: TrustVersion[];
}

// ============================================
// Eligibility Checks
// ============================================

/**
 * Checks if a rollback to a specific version is possible.
 */
export function checkRollbackEligibility(
  targetVersion: TrustVersion
): RollbackEligibility {
  const issues: string[] = [];
  const allVersions = getAllVersions();
  const currentVersion = getActiveVersion();

  // Check target version exists
  const snapshot = getSnapshot(targetVersion);
  if (!snapshot) {
    issues.push(`Version ${targetVersion} does not exist`);
    return {
      eligible: false,
      issues,
      availableVersions: allVersions.filter((v) => v !== currentVersion),
    };
  }

  // Can't roll back to current version
  if (targetVersion === currentVersion) {
    issues.push(`Already on version ${targetVersion}`);
  }

  // Check changelog entry exists (required for customer visibility)
  if (!hasChangelogEntry(targetVersion)) {
    issues.push(`No changelog entry for ${targetVersion}`);
  }

  // Run activation validation
  const activationIssues = validateForActivation(targetVersion);
  issues.push(...activationIssues);

  return {
    eligible: issues.length === 0,
    issues,
    availableVersions: allVersions.filter((v) => v !== currentVersion),
  };
}

/**
 * Gets list of versions that can be rolled back to.
 */
export function getEligibleRollbackVersions(): TrustVersion[] {
  const allVersions = getAllVersions();
  const currentVersion = getActiveVersion();

  return allVersions.filter((version) => {
    if (version === currentVersion) return false;

    const eligibility = checkRollbackEligibility(version);
    return eligibility.eligible;
  });
}

// ============================================
// Rollback Operations
// ============================================

/**
 * Performs a rollback to a previous version.
 * This is an atomic operation that:
 * 1. Validates eligibility
 * 2. Activates the target version
 * 3. Updates changelog with rollback entry
 * 4. Logs audit event
 */
export function performRollback(request: RollbackRequest): RollbackResult {
  const timestamp = new Date().toISOString();

  // Check eligibility
  const eligibility = checkRollbackEligibility(request.targetVersion);
  if (!eligibility.eligible) {
    return {
      success: false,
      error: `Rollback not eligible: ${eligibility.issues.join('; ')}`,
    };
  }

  const previousVersion = getActiveVersion();

  // Perform the rollback in store
  const storeResult = storeRollback(
    request.targetVersion,
    request.actor,
    request.role,
    request.reason
  );

  if (!storeResult.success) {
    return {
      success: false,
      error: storeResult.error,
    };
  }

  // Add rollback entry to changelog
  const changelogResult = addRollbackEntry(request.targetVersion, request.reason);

  if (!changelogResult.success) {
    // Rollback succeeded but changelog failed - log warning but don't fail
    console.warn(
      `[TRUST ROLLBACK] Changelog update failed: ${changelogResult.error}`
    );
  }

  return {
    success: true,
    previousVersion: previousVersion ?? undefined,
    currentVersion: request.targetVersion,
    timestamp,
  };
}

/**
 * Performs an emergency rollback with minimal validation.
 * Use only when normal rollback is blocked by non-critical issues.
 */
export function performEmergencyRollback(
  request: RollbackRequest
): RollbackResult {
  const timestamp = new Date().toISOString();
  const previousVersion = getActiveVersion();

  // Validate version exists (minimum requirement)
  const snapshot = getSnapshot(request.targetVersion);
  if (!snapshot) {
    return {
      success: false,
      error: `Version ${request.targetVersion} does not exist`,
    };
  }

  // Can't roll back to current version
  if (request.targetVersion === previousVersion) {
    return {
      success: false,
      error: `Already on version ${request.targetVersion}`,
    };
  }

  // Perform the rollback in store
  const storeResult = storeRollback(
    request.targetVersion,
    request.actor,
    request.role,
    `[EMERGENCY] ${request.reason}`
  );

  if (!storeResult.success) {
    return {
      success: false,
      error: storeResult.error,
    };
  }

  // Try to add changelog entry, but don't fail if it doesn't work
  try {
    addRollbackEntry(request.targetVersion, `[Emergency rollback] ${request.reason}`);
  } catch (e) {
    console.error('[TRUST ROLLBACK] Emergency changelog update failed:', e);
  }

  return {
    success: true,
    previousVersion: previousVersion ?? undefined,
    currentVersion: request.targetVersion,
    timestamp,
  };
}

// ============================================
// Rollback History
// ============================================

/**
 * Gets rollback events from audit log.
 */
export function getRollbackHistory(): TrustAuditEvent[] {
  return getAuditLog().filter((event) => event.event === 'TRUST_ROLLBACK');
}

/**
 * Gets the most recent rollback event.
 */
export function getLastRollback(): TrustAuditEvent | null {
  const rollbacks = getRollbackHistory();
  return rollbacks[0] ?? null;
}

/**
 * Checks if there has been a recent rollback.
 * "Recent" is defined as within the specified hours.
 */
export function hasRecentRollback(withinHours: number = 24): boolean {
  const lastRollback = getLastRollback();
  if (!lastRollback) return false;

  const rollbackTime = new Date(lastRollback.timestamp).getTime();
  const cutoffTime = Date.now() - withinHours * 60 * 60 * 1000;

  return rollbackTime > cutoffTime;
}

// ============================================
// Rollback Simulation (Dry Run)
// ============================================

/**
 * Simulates a rollback without making changes.
 * Useful for validation and previewing effects.
 */
export function simulateRollback(targetVersion: TrustVersion): {
  wouldSucceed: boolean;
  issues: string[];
  effects: {
    currentVersion: TrustVersion | null;
    targetVersion: TrustVersion;
    sectionsAffected: number;
    changelogEntryRequired: boolean;
  };
} {
  const currentVersion = getActiveVersion();
  const eligibility = checkRollbackEligibility(targetVersion);

  const targetSnapshot = getSnapshot(targetVersion);
  const _currentSnapshot = currentVersion ? getSnapshot(currentVersion) : null;

  return {
    wouldSucceed: eligibility.eligible,
    issues: eligibility.issues,
    effects: {
      currentVersion,
      targetVersion,
      sectionsAffected: targetSnapshot?.sections.length ?? 0,
      changelogEntryRequired: !hasChangelogEntry(targetVersion),
    },
  };
}

// ============================================
// Quick Rollback (One Step Back)
// ============================================

/**
 * Rolls back to the immediately previous version.
 * Convenience method for common "undo last change" scenario.
 */
export function rollbackOnce(
  actor: string,
  role: string,
  reason: string
): RollbackResult {
  const currentVersion = getActiveVersion();
  if (!currentVersion) {
    return {
      success: false,
      error: 'No active version to roll back from',
    };
  }

  const allVersions = getAllVersions();
  const currentIndex = allVersions.indexOf(currentVersion);

  if (currentIndex === -1 || currentIndex === allVersions.length - 1) {
    return {
      success: false,
      error: 'No previous version to roll back to',
    };
  }

  const previousVersion = allVersions[currentIndex + 1];

  return performRollback({
    targetVersion: previousVersion,
    actor,
    role,
    reason,
  });
}
