// ============================================
// Trust Snapshot Versioning Module - Barrel Export
// ============================================
// PHASE D50: Trust Snapshot Versioning & Public Change Log.
//
// This module provides:
// - Immutable trust snapshot versioning
// - Public changelog with customer-safe language
// - Text-only diff engine
// - Deploy gate verification
// - Fast, logged rollback capability
// - Complete audit trail
//
// INVARIANTS:
// - One snapshot = one immutable version
// - Exactly one snapshot active at a time
// - No silent changes
// - Every change requires version bump
// - Full audit logging
// ============================================

// Types
export {
  // Version types
  type TrustVersion,
  type SnapshotStatus,
  type AuthorRole,
  type ChangeType,
  type VersionBumpType,

  // Snapshot types
  type SnapshotAuthor,
  type TrustSection,
  type TrustSnapshot,

  // Changelog types
  type ChangelogEntry,
  type TrustChangelog,

  // Diff types
  type DiffLineType,
  type DiffLine,
  type SectionDiff,
  type SnapshotDiff,

  // Audit types
  type TrustAuditEventType,
  type TrustAuditEvent,

  // Deploy gate types
  type DeployGateCheck,
  type DeployGateResult,

  // Permission types
  type TrustAction,
  TRUST_PERMISSIONS,

  // Validation helpers
  isValidVersion,
  parseVersion,
  compareVersions,
  bumpVersion,
  getBumpTypeForChange,
  validateSnapshot,
  validateChangelogEntry,
} from './snapshotTypes';

// Snapshot Store
export {
  // Read operations
  getAllSnapshots,
  getSnapshot,
  getActiveSnapshot,
  getActiveVersion,
  getAllVersions,
  versionExists,
  getPreviousVersion,

  // Write operations
  createSnapshot,
  activateSnapshot,
  rollbackToVersion,

  // Audit log
  getAuditLog,
  getAuditEventsForVersion,

  // Cache management
  invalidateCache as invalidateSnapshotCache,
} from './snapshotStore';

// Changelog Store
export {
  // Read operations
  getChangelog,
  getChangelogEntries,
  getChangelogEntry,
  hasChangelogEntry,
  getLatestChangelogEntry,
  getEntriesByType,

  // Write operations
  addChangelogEntry,
  createChangelogEntry,
  addRollbackEntry,

  // Validation
  validateMarketingSafe,
  getChangeTypeLabel,
  getChangeTypeDescription,

  // Cache management
  invalidateCache as invalidateChangelogCache,
} from './changelogStore';

// Diff Engine
export {
  // Core diff functions
  diffLines,
  diffSection,
  diffSnapshots,
  getDiffFromPrevious,

  // Formatting
  formatUnifiedDiff,
  formatChangeList,
  formatDiffHTML,

  // Statistics
  hasChanges,
  getDiffSummary,
} from './diffEngine';

// Deploy Gate
export {
  // Version detection
  getUIVersion,
  setUIVersion,
  getEffectiveUIVersion,

  // Gate checks
  runDeployGateChecks,
  assertDeployGate,
  getDeployGateResponse,

  // Validation
  validateForActivation,
  validateNewSnapshot,

  // Build integration
  verifyTrustGateAtBuild,
} from './deployGate';

// Rollback
export {
  // Types
  type RollbackRequest,
  type RollbackResult,
  type RollbackEligibility,

  // Eligibility
  checkRollbackEligibility,
  getEligibleRollbackVersions,

  // Operations
  performRollback,
  performEmergencyRollback,
  rollbackOnce,

  // History
  getRollbackHistory,
  getLastRollback,
  hasRecentRollback,

  // Simulation
  simulateRollback,
} from './rollback';

// ============================================
// D51: Trust Transparency Badge
// ============================================

export {
  // Types
  type TrustBadgeData,
  type TrustBadgeConfig,
  type BadgePlacement,
  type BadgeRenderData,

  // Data resolution
  resolveTrustBadgeData,
  formatLastUpdated,
  getBadgeRenderData,
  getDefaultConfig,

  // Placement validation
  isPlacementAllowed,
  MANDATORY_PLACEMENTS,
  OPTIONAL_PLACEMENTS,
  FORBIDDEN_PLACEMENTS,

  // Copy validation
  validateBadgeCopy,
  isCopySafe,
  FORBIDDEN_LANGUAGE,
  ALLOWED_LANGUAGE,

  // Canonical copy
  BADGE_HEADING,
  BADGE_LABELS,
  TRUST_CENTER_INTRO,
  TRUST_TOOLTIP,

  // Non-features (documentation)
  D51_NON_FEATURES,
  D51_FAILURE_INDICATORS,
  D51_SUCCESS_INDICATORS,
} from './transparencyBadge';
