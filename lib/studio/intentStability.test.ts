// ============================================
// STEP 10: Intent Stability Tests
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeStability,
  getStabilityBand,
  getTrustCopy,
  getTrustCopyParts,
  getConfirmationGating,
  getStabilityColorClasses,
  getStabilityDebugSummary,
  type StabilityMetrics,
  type StabilityBand,
} from './intentStability';

// ============================================
// Mock localStorage and dependencies
// ============================================
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    _reset() {
      store = {};
      this.getItem.mockClear();
      this.setItem.mockClear();
      this.removeItem.mockClear();
    },
  };
})();

beforeEach(() => {
  vi.stubGlobal('window', {
    localStorage: localStorageMock,
  });
  localStorageMock._reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================
// getStabilityBand
// ============================================
describe('getStabilityBand', () => {
  it('should return HIGH for scores >= 80', () => {
    expect(getStabilityBand(80)).toBe('HIGH');
    expect(getStabilityBand(100)).toBe('HIGH');
    expect(getStabilityBand(95)).toBe('HIGH');
  });

  it('should return MEDIUM for scores 50-79', () => {
    expect(getStabilityBand(50)).toBe('MEDIUM');
    expect(getStabilityBand(79)).toBe('MEDIUM');
    expect(getStabilityBand(65)).toBe('MEDIUM');
  });

  it('should return LOW for scores < 50', () => {
    expect(getStabilityBand(49)).toBe('LOW');
    expect(getStabilityBand(0)).toBe('LOW');
    expect(getStabilityBand(25)).toBe('LOW');
  });
});

// ============================================
// computeStability - Core scoring tests
// ============================================
describe('computeStability', () => {
  it('should return base score (50) for unknown pattern', () => {
    const metrics = computeStability('unknown-pattern-hash');

    expect(metrics.patternHash).toBe('unknown-pattern-hash');
    expect(metrics.stabilityScore).toBe(50);
    expect(metrics.band).toBe('MEDIUM');
    expect(metrics.acceptedCount).toBe(0);
    expect(metrics.negativeHighCount).toBe(0);
    expect(metrics.recentCount).toBe(0);
    expect(metrics.autoApplyEligible).toBe(false);
  });

  it('should clamp score to 0-100', () => {
    // Even with extreme negatives, score should not go below 0
    const metrics = computeStability('test-pattern');
    expect(metrics.stabilityScore).toBeGreaterThanOrEqual(0);
    expect(metrics.stabilityScore).toBeLessThanOrEqual(100);
  });

  it('should cap score at 60 when recentCount < 3', () => {
    // With no outcomes, recentCount = 0 < 3
    const metrics = computeStability('new-pattern');
    expect(metrics.recentCount).toBeLessThan(3);
    expect(metrics.stabilityScore).toBeLessThanOrEqual(60);
  });

  it('should have reason for low evidence', () => {
    const metrics = computeStability('new-pattern');
    expect(metrics.reason).toContain('limited evidence');
  });
});

// ============================================
// Score calculation rules
// ============================================
describe('score calculation', () => {
  // These tests verify the scoring math works correctly
  // Note: Since we're mocking localStorage, outcomes won't persist
  // but we can verify the structure and default behavior

  it('should have correct structure', () => {
    const metrics = computeStability('test');

    expect(metrics).toHaveProperty('patternHash');
    expect(metrics).toHaveProperty('stabilityScore');
    expect(metrics).toHaveProperty('band');
    expect(metrics).toHaveProperty('acceptedCount');
    expect(metrics).toHaveProperty('negativeHighCount');
    expect(metrics).toHaveProperty('negativeMediumCount');
    expect(metrics).toHaveProperty('recentCount');
    expect(metrics).toHaveProperty('autoApplyEligible');
    expect(metrics).toHaveProperty('reason');
  });

  it('should return number for stabilityScore', () => {
    const metrics = computeStability('test');
    expect(typeof metrics.stabilityScore).toBe('number');
    expect(Number.isInteger(metrics.stabilityScore)).toBe(true);
  });
});

// ============================================
// getTrustCopy
// ============================================
describe('getTrustCopy', () => {
  const makeMetrics = (band: StabilityBand): StabilityMetrics => ({
    patternHash: 'test',
    stabilityScore: band === 'HIGH' ? 85 : band === 'MEDIUM' ? 60 : 30,
    band,
    acceptedCount: 0,
    negativeHighCount: 0,
    negativeMediumCount: 0,
    recentCount: 0,
    autoApplyEligible: false,
    reason: 'test',
  });

  describe('Vietnamese', () => {
    it('should return correct copy for HIGH', () => {
      const copy = getTrustCopy(makeMetrics('HIGH'), 'vi');
      expect(copy).toContain('✅');
      expect(copy).toContain('On dinh');
    });

    it('should return correct copy for MEDIUM', () => {
      const copy = getTrustCopy(makeMetrics('MEDIUM'), 'vi');
      expect(copy).toContain('🟡');
      expect(copy).toContain('Dang hoc');
    });

    it('should return correct copy for LOW', () => {
      const copy = getTrustCopy(makeMetrics('LOW'), 'vi');
      expect(copy).toContain('⚠️');
      expect(copy).toContain('Can xac nhan');
    });
  });

  describe('English', () => {
    it('should return correct copy for HIGH', () => {
      const copy = getTrustCopy(makeMetrics('HIGH'), 'en');
      expect(copy).toContain('✅');
      expect(copy).toContain('Stable');
    });

    it('should return correct copy for MEDIUM', () => {
      const copy = getTrustCopy(makeMetrics('MEDIUM'), 'en');
      expect(copy).toContain('🟡');
      expect(copy).toContain('Learning');
    });

    it('should return correct copy for LOW', () => {
      const copy = getTrustCopy(makeMetrics('LOW'), 'en');
      expect(copy).toContain('⚠️');
      expect(copy).toContain('Confirm');
    });
  });

  it('should default to Vietnamese', () => {
    const copyVi = getTrustCopy(makeMetrics('HIGH'), 'vi');
    const copyDefault = getTrustCopy(makeMetrics('HIGH'));
    expect(copyDefault).toBe(copyVi);
  });
});

// ============================================
// getTrustCopyParts
// ============================================
describe('getTrustCopyParts', () => {
  const makeMetrics = (band: StabilityBand): StabilityMetrics => ({
    patternHash: 'test',
    stabilityScore: 50,
    band,
    acceptedCount: 0,
    negativeHighCount: 0,
    negativeMediumCount: 0,
    recentCount: 0,
    autoApplyEligible: false,
    reason: 'test',
  });

  it('should return object with label and emoji', () => {
    const parts = getTrustCopyParts(makeMetrics('HIGH'), 'en');
    expect(parts).toHaveProperty('label');
    expect(parts).toHaveProperty('emoji');
    expect(parts.label).toBe('Stable');
    expect(parts.emoji).toBe('✅');
  });
});

// ============================================
// getConfirmationGating
// ============================================
describe('getConfirmationGating', () => {
  const makeMetrics = (overrides: Partial<StabilityMetrics>): StabilityMetrics => ({
    patternHash: 'test',
    stabilityScore: 50,
    band: 'MEDIUM',
    acceptedCount: 0,
    negativeHighCount: 0,
    negativeMediumCount: 0,
    recentCount: 5,
    autoApplyEligible: false,
    reason: 'test',
    ...overrides,
  });

  describe('SKIP', () => {
    it('should SKIP when HIGH band and autoApplyEligible', () => {
      const result = getConfirmationGating(makeMetrics({
        band: 'HIGH',
        stabilityScore: 85,
        autoApplyEligible: true,
      }));
      expect(result).toBe('SKIP');
    });

    it('should NOT SKIP when HIGH but not autoApplyEligible', () => {
      const result = getConfirmationGating(makeMetrics({
        band: 'HIGH',
        stabilityScore: 85,
        autoApplyEligible: false,
      }));
      expect(result).toBe('DEFAULT');
    });
  });

  describe('FORCE', () => {
    it('should FORCE when band is LOW', () => {
      const result = getConfirmationGating(makeMetrics({
        band: 'LOW',
        stabilityScore: 30,
      }));
      expect(result).toBe('FORCE');
    });

    it('should FORCE when negativeHighCount >= 1', () => {
      const result = getConfirmationGating(makeMetrics({
        band: 'MEDIUM',
        negativeHighCount: 1,
      }));
      expect(result).toBe('FORCE');
    });

    it('should FORCE when negativeHighCount >= 1 even if HIGH band', () => {
      const result = getConfirmationGating(makeMetrics({
        band: 'HIGH',
        stabilityScore: 85,
        negativeHighCount: 2,
        autoApplyEligible: true,
      }));
      expect(result).toBe('FORCE');
    });
  });

  describe('DEFAULT', () => {
    it('should DEFAULT for MEDIUM band without negatives', () => {
      const result = getConfirmationGating(makeMetrics({
        band: 'MEDIUM',
        negativeHighCount: 0,
      }));
      expect(result).toBe('DEFAULT');
    });

    it('should DEFAULT for HIGH band without autoApplyEligible', () => {
      const result = getConfirmationGating(makeMetrics({
        band: 'HIGH',
        autoApplyEligible: false,
      }));
      expect(result).toBe('DEFAULT');
    });
  });
});

// ============================================
// getStabilityColorClasses
// ============================================
describe('getStabilityColorClasses', () => {
  it('should return green classes for HIGH', () => {
    const colors = getStabilityColorClasses('HIGH');
    expect(colors.bg).toContain('green');
    expect(colors.text).toContain('green');
    expect(colors.border).toContain('green');
  });

  it('should return yellow classes for MEDIUM', () => {
    const colors = getStabilityColorClasses('MEDIUM');
    expect(colors.bg).toContain('yellow');
    expect(colors.text).toContain('yellow');
    expect(colors.border).toContain('yellow');
  });

  it('should return red classes for LOW', () => {
    const colors = getStabilityColorClasses('LOW');
    expect(colors.bg).toContain('red');
    expect(colors.text).toContain('red');
    expect(colors.border).toContain('red');
  });
});

// ============================================
// getStabilityDebugSummary
// ============================================
describe('getStabilityDebugSummary', () => {
  it('should return formatted debug string', () => {
    const metrics: StabilityMetrics = {
      patternHash: 'test',
      stabilityScore: 75,
      band: 'MEDIUM',
      acceptedCount: 3,
      negativeHighCount: 1,
      negativeMediumCount: 2,
      recentCount: 6,
      autoApplyEligible: true,
      reason: 'Test reason',
    };

    const summary = getStabilityDebugSummary(metrics);

    expect(summary).toContain('75%');
    expect(summary).toContain('MEDIUM');
    expect(summary).toContain('+3');
    expect(summary).toContain('-1H');
    expect(summary).toContain('-2M');
    expect(summary).toContain('n=6');
    expect(summary).toContain('auto✓');
  });

  it('should show auto✗ when not eligible', () => {
    const metrics: StabilityMetrics = {
      patternHash: 'test',
      stabilityScore: 50,
      band: 'MEDIUM',
      acceptedCount: 0,
      negativeHighCount: 0,
      negativeMediumCount: 0,
      recentCount: 0,
      autoApplyEligible: false,
      reason: 'Test',
    };

    const summary = getStabilityDebugSummary(metrics);
    expect(summary).toContain('auto✗');
  });
});

// ============================================
// Edge cases
// ============================================
describe('edge cases', () => {
  it('should handle empty pattern hash', () => {
    const metrics = computeStability('');
    expect(metrics.patternHash).toBe('');
    expect(metrics.stabilityScore).toBe(50);
  });

  it('should handle special characters in pattern hash', () => {
    const metrics = computeStability('test-#$%^&*()');
    expect(metrics.patternHash).toBe('test-#$%^&*()');
  });
});
