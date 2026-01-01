// ============================================
// AdLab Safety Module - Barrel Export
// ============================================
// PHASE D22: Operational Safety Net.
// PHASE D23: Chaos & Failure Injection.
// PHASE D24: Production Readiness Proof.
// ============================================

// D22: Kill-Switch
export {
  // Types
  type KillSwitchScope,
  type KillSwitchRecord,
  type KillSwitchStatus,
  type BlockableAction,
  BLOCKABLE_ACTIONS,
  // Error
  KillSwitchActiveError,
  // Check functions
  isGlobalKillSwitchEnabled,
  isWorkspaceKillSwitchEnabled,
  getKillSwitchStatus,
  checkKillSwitch,
  // Guard (MUST run before requirePermission)
  assertKillSwitchOpen,
  // Admin functions
  enableGlobalKillSwitch,
  disableGlobalKillSwitch,
  enableWorkspaceKillSwitch,
  disableWorkspaceKillSwitch,
} from './killSwitch';

// D23: Failure Injection
export {
  // Types
  type InjectableAction,
  type FailureType,
  type FailureInjectionConfig,
  type InjectionCheckResult,
  INJECTABLE_ACTIONS,
  FAILURE_TYPES,
  // Errors
  InjectedFailureError,
  InjectedTimeoutError,
  InjectedPartialError,
  // Check functions
  getInjectionConfig,
  shouldInjectFailure,
  // Guard (MUST run after assertKillSwitchOpen)
  assertNoInjectedFailure,
  // Injection function (for direct use)
  injectFailure,
  // Admin functions
  upsertInjectionConfig,
  enableInjection,
  disableInjection,
  listInjectionConfigs,
} from './failureInjection';

// D24: Production Readiness
export {
  // Types
  type ReadinessCheck,
  type ReadinessCategory,
  type ReadinessStatus,
  // Error
  ProductionNotReadyError,
  // Check functions
  checkProductionReadiness,
  isProductionReady,
  // Assert (throws if not ready)
  assertProductionReady,
} from './readiness';

// D24: Guard Registry
export {
  // Types
  type GuardType,
  type CriticalityLevel,
  type RegisteredRoute,
  type RouteCoverageReport,
  type CoverageSummary,
  // Constants
  GUARD_ORDER,
  REQUIRED_GUARDS_BY_CRITICALITY,
  // Registry functions
  registerRoute,
  getRegisteredRoute,
  getAllRegisteredRoutes,
  clearRegistry,
  // Verification functions
  verifyRouteCoverage,
  verifyCoverage,
  assertFullCoverage,
  verifyAtBuildTime,
} from './guardRegistry';
