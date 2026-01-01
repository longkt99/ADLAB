// ============================================
// STEP 29: Feature Flags & Kill-Switch Tests
// ============================================
// Regression tests for production safety configuration.
// These tests FAIL if behavior silently changes.
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isRewriteUpgradeEnabled,
  getRewriteDisabledReason,
  getFeatureFlagStatus,
  ENABLE_REWRITE_UPGRADE_KEY,
} from './featureFlags';

// ============================================
// Test: Kill-Switch Behavior
// ============================================

describe('STEP 29: Kill-Switch Behavior', () => {
  const originalEnv = process.env[ENABLE_REWRITE_UPGRADE_KEY];

  afterEach(() => {
    // Restore original env
    if (originalEnv === undefined) {
      delete process.env[ENABLE_REWRITE_UPGRADE_KEY];
    } else {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = originalEnv;
    }
  });

  describe('isRewriteUpgradeEnabled', () => {
    it('should return true by default (no env var set)', () => {
      delete process.env[ENABLE_REWRITE_UPGRADE_KEY];
      expect(isRewriteUpgradeEnabled()).toBe(true);
    });

    it('should return true when env is "true"', () => {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = 'true';
      expect(isRewriteUpgradeEnabled()).toBe(true);
    });

    it('should return true when env is "1"', () => {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = '1';
      expect(isRewriteUpgradeEnabled()).toBe(true);
    });

    it('should return false when env is "false"', () => {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = 'false';
      expect(isRewriteUpgradeEnabled()).toBe(false);
    });

    it('should return false when env is "0"', () => {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = '0';
      expect(isRewriteUpgradeEnabled()).toBe(false);
    });

    it('should return true for any other value (fail-safe)', () => {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = 'random';
      expect(isRewriteUpgradeEnabled()).toBe(true);
    });
  });

  describe('getRewriteDisabledReason', () => {
    it('should return null when enabled', () => {
      delete process.env[ENABLE_REWRITE_UPGRADE_KEY];
      expect(getRewriteDisabledReason()).toBeNull();
    });

    it('should return KILL_SWITCH_ACTIVE when disabled', () => {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = 'false';
      expect(getRewriteDisabledReason()).toBe('KILL_SWITCH_ACTIVE');
    });
  });

  describe('getFeatureFlagStatus', () => {
    it('should return correct status when enabled', () => {
      delete process.env[ENABLE_REWRITE_UPGRADE_KEY];
      const status = getFeatureFlagStatus();

      expect(status.rewriteUpgrade.enabled).toBe(true);
      expect(status.rewriteUpgrade.disabledReason).toBeNull();
    });

    it('should return correct status when disabled', () => {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = 'false';
      const status = getFeatureFlagStatus();

      expect(status.rewriteUpgrade.enabled).toBe(false);
      expect(status.rewriteUpgrade.disabledReason).toBe('KILL_SWITCH_ACTIVE');
    });
  });
});

// ============================================
// INVARIANT: Default Behavior
// ============================================

describe('INVARIANT: Kill-Switch Default Behavior', () => {
  const originalEnv = process.env[ENABLE_REWRITE_UPGRADE_KEY];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENABLE_REWRITE_UPGRADE_KEY];
    } else {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = originalEnv;
    }
  });

  it('MUST default to enabled (true) when env not set', () => {
    delete process.env[ENABLE_REWRITE_UPGRADE_KEY];
    // This is a critical invariant - default MUST be enabled
    expect(isRewriteUpgradeEnabled()).toBe(true);
  });

  it('MUST only disable when explicitly set to "false" or "0"', () => {
    // These should NOT disable
    const enabledValues = ['true', '1', 'yes', 'enabled', 'random', ''];
    for (const val of enabledValues) {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = val;
      expect(isRewriteUpgradeEnabled()).toBe(true);
    }

    // Only these should disable
    const disabledValues = ['false', '0'];
    for (const val of disabledValues) {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = val;
      expect(isRewriteUpgradeEnabled()).toBe(false);
    }
  });
});

// ============================================
// INVARIANT: Environment Variable Key
// ============================================

describe('INVARIANT: Environment Variable Key', () => {
  it('MUST use NEXT_PUBLIC prefix for client-side access', () => {
    expect(ENABLE_REWRITE_UPGRADE_KEY).toMatch(/^NEXT_PUBLIC_/);
  });

  it('MUST be named NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE', () => {
    expect(ENABLE_REWRITE_UPGRADE_KEY).toBe('NEXT_PUBLIC_ENABLE_REWRITE_UPGRADE');
  });
});

// ============================================
// INVARIANT: No Silent Behavior Changes
// ============================================

describe('INVARIANT: No Silent Behavior Changes', () => {
  const originalEnv = process.env[ENABLE_REWRITE_UPGRADE_KEY];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENABLE_REWRITE_UPGRADE_KEY];
    } else {
      process.env[ENABLE_REWRITE_UPGRADE_KEY] = originalEnv;
    }
  });

  it('enabled state MUST be deterministic based on env', () => {
    // Same env value should always produce same result
    delete process.env[ENABLE_REWRITE_UPGRADE_KEY];
    const result1 = isRewriteUpgradeEnabled();
    const result2 = isRewriteUpgradeEnabled();
    expect(result1).toBe(result2);

    process.env[ENABLE_REWRITE_UPGRADE_KEY] = 'false';
    const result3 = isRewriteUpgradeEnabled();
    const result4 = isRewriteUpgradeEnabled();
    expect(result3).toBe(result4);
  });

  it('getRewriteDisabledReason MUST be consistent with isRewriteUpgradeEnabled', () => {
    delete process.env[ENABLE_REWRITE_UPGRADE_KEY];
    expect(isRewriteUpgradeEnabled()).toBe(true);
    expect(getRewriteDisabledReason()).toBeNull();

    process.env[ENABLE_REWRITE_UPGRADE_KEY] = 'false';
    expect(isRewriteUpgradeEnabled()).toBe(false);
    expect(getRewriteDisabledReason()).not.toBeNull();
  });
});

// ============================================
// Test: Feature Flag Status Shape
// ============================================

describe('Feature Flag Status Shape', () => {
  it('should have rewriteUpgrade property', () => {
    const status = getFeatureFlagStatus();
    expect(status).toHaveProperty('rewriteUpgrade');
  });

  it('rewriteUpgrade should have enabled and disabledReason', () => {
    const status = getFeatureFlagStatus();
    expect(status.rewriteUpgrade).toHaveProperty('enabled');
    expect(status.rewriteUpgrade).toHaveProperty('disabledReason');
  });

  it('enabled should be boolean', () => {
    const status = getFeatureFlagStatus();
    expect(typeof status.rewriteUpgrade.enabled).toBe('boolean');
  });

  it('disabledReason should be string or null', () => {
    const status = getFeatureFlagStatus();
    const reason = status.rewriteUpgrade.disabledReason;
    expect(reason === null || typeof reason === 'string').toBe(true);
  });
});
