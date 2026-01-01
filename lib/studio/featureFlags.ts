// ============================================
// STEP 29: Feature Flags & Kill-Switches
// ============================================
// Production safety configuration for Studio features.
// These flags enable instant rollback without code deployment.
//
// INVARIANTS:
// - Default values MUST be production-safe
// - Kill-switch OFF = feature disabled, routes to safe default
// - Kill-switch ON = current behavior preserved exactly
// - NO guard, threshold, or detection logic changes
// - Changes are CONFIG-ONLY, not behavioral
// ============================================

// ============================================
// REWRITE_UPGRADE Kill-Switch
// ============================================
// When disabled:
// - REWRITE_UPGRADE detection still occurs (for telemetry)
// - User is gracefully routed to CREATE behavior
// - No error shown, just silent fallback to safe path
// - Telemetry logs the override for monitoring
//
// When enabled (default):
// - Full REWRITE_UPGRADE flow with all guards
// - Confirmation dialog, anchor guards, diff guards
// - All invariants enforced

/**
 * Environment variable key for REWRITE_UPGRADE kill-switch.
 * Set to 'false' to disable REWRITE_UPGRADE and route to CREATE.
 */
export const ENABLE_REWRITE_UPGRADE_KEY = 'NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE';

/**
 * Check if REWRITE_UPGRADE feature is enabled.
 *
 * @returns true if enabled (default), false if kill-switch is active
 *
 * Kill-switch activation:
 * - Set NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE=false in environment
 * - Instant rollback without code deployment
 *
 * When disabled:
 * - detectTaskType() still returns REWRITE_UPGRADE for telemetry
 * - isRewriteUpgradeEnabled() returns false
 * - Orchestration layer routes to CREATE path
 */
export function isRewriteUpgradeEnabled(): boolean {
  // Check environment variable
  const envValue = process.env[ENABLE_REWRITE_UPGRADE_KEY];

  // Default: enabled (true)
  // Only disable if explicitly set to 'false'
  if (envValue === 'false' || envValue === '0') {
    return false;
  }

  return true;
}

/**
 * Get the reason why REWRITE_UPGRADE is disabled (for telemetry).
 * Returns null if enabled.
 */
export function getRewriteDisabledReason(): string | null {
  if (isRewriteUpgradeEnabled()) {
    return null;
  }
  return 'KILL_SWITCH_ACTIVE';
}

// ============================================
// Future Kill-Switches (placeholder)
// ============================================
// Add additional feature flags here as needed.
// Pattern: NEXT_PUBLIC_ENABLE_<FEATURE_NAME>

// ============================================
// Type Exports
// ============================================

export interface FeatureFlagStatus {
  rewriteUpgrade: {
    enabled: boolean;
    disabledReason: string | null;
  };
}

/**
 * Get status of all feature flags (for telemetry/debugging).
 */
export function getFeatureFlagStatus(): FeatureFlagStatus {
  return {
    rewriteUpgrade: {
      enabled: isRewriteUpgradeEnabled(),
      disabledReason: getRewriteDisabledReason(),
    },
  };
}
