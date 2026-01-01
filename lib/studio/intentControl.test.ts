// ============================================
// STEP 13: Intent Control Tests
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  temporarilyDisablePreferences,
  enablePreferences,
  arePreferencesEnabled,
  temporarilyDisableAutoApply,
  enableAutoApply,
  isAutoApplyEnabled,
  getControlState,
  executeRecoveryAction,
  computeTrustLevel,
  getTrustMicrocopy,
  getPreferenceLabel,
  getPreferenceSummary,
  getControlCopy,
  getTrustColorClasses,
  getControlDebugSummary,
  type RecoveryAction,
  type TrustLevel,
} from './intentControl';

// ============================================
// Mock localStorage
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
  // Reset session state
  enablePreferences();
  enableAutoApply();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================
// Session Control Tests
// ============================================
describe('session controls', () => {
  describe('preferences toggle', () => {
    it('should be enabled by default', () => {
      expect(arePreferencesEnabled()).toBe(true);
    });

    it('should disable preferences temporarily', () => {
      temporarilyDisablePreferences();
      expect(arePreferencesEnabled()).toBe(false);
    });

    it('should re-enable preferences', () => {
      temporarilyDisablePreferences();
      enablePreferences();
      expect(arePreferencesEnabled()).toBe(true);
    });
  });

  describe('auto-apply toggle', () => {
    it('should be enabled by default', () => {
      expect(isAutoApplyEnabled()).toBe(true);
    });

    it('should disable auto-apply temporarily', () => {
      temporarilyDisableAutoApply();
      expect(isAutoApplyEnabled()).toBe(false);
    });

    it('should re-enable auto-apply', () => {
      temporarilyDisableAutoApply();
      enableAutoApply();
      expect(isAutoApplyEnabled()).toBe(true);
    });
  });
});

// ============================================
// Control State Tests
// ============================================
describe('getControlState', () => {
  it('should return control state with defaults', () => {
    const state = getControlState();

    expect(state.preferencesEnabled).toBe(true);
    expect(state.autoApplyEnabled).toBe(true);
    expect(state.activePreferences).toEqual([]);
    expect(state.learningStats).toHaveProperty('totalPatterns');
    expect(state.preferenceStats).toHaveProperty('totalPreferences');
  });

  it('should reflect disabled preferences', () => {
    temporarilyDisablePreferences();
    const state = getControlState();

    expect(state.preferencesEnabled).toBe(false);
    expect(state.activePreferences).toEqual([]);
  });
});

// ============================================
// Recovery Action Tests
// ============================================
describe('executeRecoveryAction', () => {
  it('should handle UNDO_LAST_INTENT', () => {
    const action: RecoveryAction = {
      type: 'UNDO_LAST_INTENT',
      intentId: 'test-intent-123',
      patternHash: 'abc123',
    };

    const result = executeRecoveryAction(action, 'vi');
    expect(result).toContain('hoan tac');
  });

  it('should handle DONT_DO_THIS_AGAIN', () => {
    const action: RecoveryAction = {
      type: 'DONT_DO_THIS_AGAIN',
      patternHash: 'abc123',
      choice: 'TRANSFORM_NEW_VERSION',
    };

    const result = executeRecoveryAction(action, 'en');
    expect(result).toContain('auto-apply');
  });

  it('should handle RESET_PATTERN', () => {
    const action: RecoveryAction = {
      type: 'RESET_PATTERN',
      patternHash: 'abc123',
    };

    const result = executeRecoveryAction(action, 'vi');
    expect(result).toContain('xoa');
  });

  it('should handle DISABLE_PREFERENCES_TEMP', () => {
    const action: RecoveryAction = { type: 'DISABLE_PREFERENCES_TEMP' };

    const result = executeRecoveryAction(action, 'vi');
    expect(arePreferencesEnabled()).toBe(false);
    expect(result).toContain('tam tat');
  });

  it('should handle RESET_ALL_LEARNING', () => {
    const action: RecoveryAction = { type: 'RESET_ALL_LEARNING' };

    const result = executeRecoveryAction(action, 'en');
    expect(result).toContain('cleared');
  });

  it('should handle RESET_ALL_PREFERENCES', () => {
    const action: RecoveryAction = { type: 'RESET_ALL_PREFERENCES' };

    const result = executeRecoveryAction(action, 'en');
    expect(result).toContain('cleared');
  });
});

// ============================================
// Trust Level Computation Tests
// ============================================
describe('computeTrustLevel', () => {
  it('should return HIGH for high stability + auto-apply', () => {
    const level = computeTrustLevel({
      stabilityBand: 'HIGH',
      autoApplyEligible: true,
    });
    expect(level).toBe('HIGH');
  });

  it('should return UNCERTAIN for high negatives', () => {
    const level = computeTrustLevel({
      recentNegativeCount: 3,
    });
    expect(level).toBe('UNCERTAIN');
  });

  it('should return BUILDING for medium stability', () => {
    const level = computeTrustLevel({
      stabilityBand: 'MEDIUM',
    });
    expect(level).toBe('BUILDING');
  });

  it('should return BUILDING for active preferences', () => {
    const level = computeTrustLevel({
      hasActivePreferences: true,
    });
    expect(level).toBe('BUILDING');
  });

  it('should return LEARNING for low stability', () => {
    const level = computeTrustLevel({
      stabilityBand: 'LOW',
    });
    expect(level).toBe('LEARNING');
  });

  it('should return LEARNING for no params', () => {
    const level = computeTrustLevel({});
    expect(level).toBe('LEARNING');
  });
});

// ============================================
// Trust Microcopy Tests
// ============================================
describe('getTrustMicrocopy', () => {
  it('should return Vietnamese microcopy by default', () => {
    const copy = getTrustMicrocopy({});
    expect(copy.label).toBe('Moi bat dau');
    expect(copy.emoji).toBe('👋');
    expect(copy.level).toBe('LEARNING');
  });

  it('should return English microcopy when specified', () => {
    const copy = getTrustMicrocopy({ language: 'en' });
    expect(copy.label).toBe('New here');
  });

  it('should return HIGH trust microcopy for stable patterns', () => {
    const copy = getTrustMicrocopy({
      stabilityMetrics: {
        patternHash: 'test',
        stabilityScore: 85,
        band: 'HIGH',
        acceptedCount: 5,
        negativeHighCount: 0,
        negativeMediumCount: 0,
        recentCount: 5,
        autoApplyEligible: true,
        reason: 'Stable',
      },
      language: 'vi',
    });
    expect(copy.level).toBe('HIGH');
    expect(copy.label).toBe('Hieu ban');
  });

  it('should return UNCERTAIN microcopy for high negatives', () => {
    const copy = getTrustMicrocopy({
      stabilityMetrics: {
        patternHash: 'test',
        stabilityScore: 30,
        band: 'LOW',
        acceptedCount: 0,
        negativeHighCount: 3,
        negativeMediumCount: 0,
        recentCount: 3,
        autoApplyEligible: false,
        reason: 'Unstable',
      },
      language: 'en',
    });
    expect(copy.level).toBe('UNCERTAIN');
    expect(copy.label).toBe('Please confirm');
  });
});

// ============================================
// Preference Label Tests
// ============================================
describe('getPreferenceLabel', () => {
  it('should return Vietnamese labels', () => {
    expect(getPreferenceLabel('prefersShortOutput', 'vi')).toBe('Thich van ban ngan');
    expect(getPreferenceLabel('avoidsEmoji', 'vi')).toBe('Tranh emoji');
  });

  it('should return English labels', () => {
    expect(getPreferenceLabel('prefersShortOutput', 'en')).toBe('Prefers short text');
    expect(getPreferenceLabel('avoidsEmoji', 'en')).toBe('Avoids emoji');
  });

  it('should return all preference labels', () => {
    const keys = [
      'prefersShortOutput',
      'prefersLongOutput',
      'prefersProfessionalTone',
      'prefersCasualTone',
      'avoidsEmoji',
      'likesEmoji',
      'prefersEditInPlace',
      'prefersTransformOverCreate',
      'prefersCreateOverTransform',
      'prefersVietnamese',
      'prefersEnglish',
    ] as const;

    for (const key of keys) {
      const label = getPreferenceLabel(key, 'vi');
      expect(label).not.toBe(key); // Should have a human-readable label
    }
  });
});

// ============================================
// Preference Summary Tests
// ============================================
describe('getPreferenceSummary', () => {
  it('should return empty message when no preferences', () => {
    const summary = getPreferenceSummary('vi');
    expect(summary).toContain('Chua co');
  });

  it('should return English empty message', () => {
    const summary = getPreferenceSummary('en');
    expect(summary).toContain('No preferences');
  });
});

// ============================================
// Control Copy Tests
// ============================================
describe('getControlCopy', () => {
  it('should return Vietnamese control copy', () => {
    const copy = getControlCopy('vi');
    expect(copy.resetPreferences).toBe('Xoa so thich');
    expect(copy.undoAction).toBe('Hoan tac');
  });

  it('should return English control copy', () => {
    const copy = getControlCopy('en');
    expect(copy.resetPreferences).toBe('Reset preferences');
    expect(copy.undoAction).toBe('Undo');
  });
});

// ============================================
// Trust Color Classes Tests
// ============================================
describe('getTrustColorClasses', () => {
  it('should return emerald for HIGH trust', () => {
    const colors = getTrustColorClasses('HIGH');
    expect(colors.bg).toContain('emerald');
    expect(colors.text).toContain('emerald');
  });

  it('should return blue for BUILDING trust', () => {
    const colors = getTrustColorClasses('BUILDING');
    expect(colors.bg).toContain('blue');
  });

  it('should return amber for UNCERTAIN trust', () => {
    const colors = getTrustColorClasses('UNCERTAIN');
    expect(colors.bg).toContain('amber');
  });

  it('should return slate for LEARNING trust', () => {
    const colors = getTrustColorClasses('LEARNING');
    expect(colors.bg).toContain('slate');
  });
});

// ============================================
// Debug Summary Tests
// ============================================
describe('getControlDebugSummary', () => {
  it('should return a summary string', () => {
    const summary = getControlDebugSummary();

    expect(summary).toContain('Prefs:');
    expect(summary).toContain('Auto:');
    expect(summary).toContain('Active:');
    expect(summary).toContain('Patterns:');
  });

  it('should reflect disabled state', () => {
    temporarilyDisablePreferences();
    const summary = getControlDebugSummary();

    expect(summary).toContain('Prefs: OFF');
  });
});
