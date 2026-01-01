// ============================================
// STEP 12: User Preference Tests
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadPreferences,
  savePreferences,
  clearPreferences,
  recordPreference,
  recordPreferences,
  getPreference,
  getActivePreferences,
  getPreferenceBias,
  detectChoiceSignals,
  detectOutputSignals,
  detectInstructionSignals,
  getPreferenceDebugSummary,
  getPreferenceStats,
  getPreferenceColorClasses,
  type PreferenceKey,
  type PreferenceSignal,
} from './userPreference';

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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================
// loadPreferences / savePreferences
// ============================================
describe('loadPreferences', () => {
  it('should return empty state when no data exists', () => {
    const state = loadPreferences();

    expect(state.version).toBe(1);
    expect(state.preferences).toEqual({});
  });

  it('should load existing preferences from localStorage', () => {
    const stored = {
      version: 1,
      preferences: {
        prefersShortOutput: {
          positiveCount: 5,
          negativeCount: 1,
          lastObserved: Date.now(),
          firstObserved: Date.now() - 86400000,
        },
      },
      lastCleanup: Date.now(),
    };
    localStorageMock.setItem('studio_user_preferences_v1', JSON.stringify(stored));

    const state = loadPreferences();

    expect(state.preferences.prefersShortOutput).toBeDefined();
    expect(state.preferences.prefersShortOutput.positiveCount).toBe(5);
  });

  it('should return empty state for invalid version', () => {
    localStorageMock.setItem('studio_user_preferences_v1', JSON.stringify({
      version: 999,
      preferences: { test: {} },
    }));

    const state = loadPreferences();

    expect(state.preferences).toEqual({});
  });
});

describe('savePreferences', () => {
  it('should save preferences to localStorage', () => {
    const state = {
      version: 1,
      preferences: {
        prefersShortOutput: {
          positiveCount: 3,
          negativeCount: 0,
          lastObserved: Date.now(),
          firstObserved: Date.now(),
        },
      },
      lastCleanup: Date.now(),
    };

    savePreferences(state);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'studio_user_preferences_v1',
      expect.any(String)
    );
  });
});

describe('clearPreferences', () => {
  it('should remove preferences from localStorage', () => {
    recordPreference({ key: 'prefersShortOutput' });
    clearPreferences();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('studio_user_preferences_v1');
  });
});

// ============================================
// recordPreference
// ============================================
describe('recordPreference', () => {
  it('should create new preference record', () => {
    recordPreference({ key: 'prefersShortOutput' });

    const state = loadPreferences();
    expect(state.preferences.prefersShortOutput).toBeDefined();
    expect(state.preferences.prefersShortOutput.positiveCount).toBe(1);
  });

  it('should increment positive count for existing preference', () => {
    recordPreference({ key: 'prefersShortOutput' });
    recordPreference({ key: 'prefersShortOutput' });
    recordPreference({ key: 'prefersShortOutput' });

    const state = loadPreferences();
    expect(state.preferences.prefersShortOutput.positiveCount).toBe(3);
  });

  it('should increment negative count when negative=true', () => {
    recordPreference({ key: 'prefersShortOutput' });
    recordPreference({ key: 'prefersShortOutput' }, true);

    const state = loadPreferences();
    expect(state.preferences.prefersShortOutput.positiveCount).toBe(1);
    expect(state.preferences.prefersShortOutput.negativeCount).toBe(1);
  });

  it('should update lastObserved timestamp', () => {
    const before = Date.now();
    recordPreference({ key: 'prefersShortOutput' });

    const state = loadPreferences();
    expect(state.preferences.prefersShortOutput.lastObserved).toBeGreaterThanOrEqual(before);
  });
});

describe('recordPreferences', () => {
  it('should record multiple preferences at once', () => {
    recordPreferences([
      { signal: { key: 'prefersShortOutput' } },
      { signal: { key: 'prefersProfessionalTone' } },
      { signal: { key: 'avoidsEmoji' }, negative: true },
    ]);

    const state = loadPreferences();
    expect(state.preferences.prefersShortOutput.positiveCount).toBe(1);
    expect(state.preferences.prefersProfessionalTone.positiveCount).toBe(1);
    expect(state.preferences.avoidsEmoji.negativeCount).toBe(1);
  });
});

// ============================================
// getPreference
// ============================================
describe('getPreference', () => {
  it('should return null for unknown preference', () => {
    const pref = getPreference('prefersShortOutput');
    expect(pref).toBeNull();
  });

  it('should return inactive for insufficient observations', () => {
    recordPreference({ key: 'prefersShortOutput' });
    recordPreference({ key: 'prefersShortOutput' });
    // Only 2 observations, need 3 minimum

    const pref = getPreference('prefersShortOutput');
    expect(pref).not.toBeNull();
    expect(pref?.active).toBe(false);
    expect(pref?.reason).toContain('Insufficient');
  });

  it('should return active for sufficient positive observations', () => {
    // Record 5 positive observations
    for (let i = 0; i < 5; i++) {
      recordPreference({ key: 'prefersShortOutput' });
    }

    const pref = getPreference('prefersShortOutput');
    expect(pref).not.toBeNull();
    expect(pref?.active).toBe(true);
    expect(pref?.strength).toBeGreaterThan(0.3);
  });

  it('should return inactive for mixed observations (<60% positive)', () => {
    // 3 positive, 3 negative = 50% positive
    for (let i = 0; i < 3; i++) {
      recordPreference({ key: 'prefersShortOutput' });
      recordPreference({ key: 'prefersShortOutput' }, true);
    }

    const pref = getPreference('prefersShortOutput');
    expect(pref?.active).toBe(false);
  });
});

// ============================================
// getActivePreferences
// ============================================
describe('getActivePreferences', () => {
  it('should return empty array when no preferences', () => {
    const active = getActivePreferences();
    expect(active).toEqual([]);
  });

  it('should return only active preferences', () => {
    // Build up strong preference
    for (let i = 0; i < 6; i++) {
      recordPreference({ key: 'prefersShortOutput' });
    }

    // Build up weak preference (will be inactive)
    recordPreference({ key: 'prefersLongOutput' });

    const active = getActivePreferences();
    expect(active.length).toBe(1);
    expect(active[0].key).toBe('prefersShortOutput');
  });

  it('should sort by strength descending', () => {
    // Strong preference
    for (let i = 0; i < 10; i++) {
      recordPreference({ key: 'prefersShortOutput' });
    }

    // Medium preference
    for (let i = 0; i < 5; i++) {
      recordPreference({ key: 'prefersProfessionalTone' });
    }

    const active = getActivePreferences();
    if (active.length >= 2) {
      expect(active[0].strength).toBeGreaterThanOrEqual(active[1].strength);
    }
  });
});

// ============================================
// getPreferenceBias
// ============================================
describe('getPreferenceBias', () => {
  it('should return default order when no preferences', () => {
    const bias = getPreferenceBias({});

    expect(bias.activePreferences).toEqual([]);
    expect(bias.defaultChoiceBias).toBeUndefined();
    expect(bias.defaultChoiceStrength).toBe(0);
    expect(bias.optionOrderBias).toContain('TRANSFORM_NEW_VERSION');
  });

  it('should bias toward EDIT_IN_PLACE when preference is active', () => {
    // Build strong edit preference
    for (let i = 0; i < 8; i++) {
      recordPreference({ key: 'prefersEditInPlace' });
    }

    const bias = getPreferenceBias({ hasActiveSource: true });

    expect(bias.defaultChoiceBias).toBe('EDIT_IN_PLACE');
    expect(bias.defaultChoiceStrength).toBeGreaterThan(0);
  });

  it('should not bias EDIT_IN_PLACE without active source', () => {
    for (let i = 0; i < 8; i++) {
      recordPreference({ key: 'prefersEditInPlace' });
    }

    const bias = getPreferenceBias({ hasActiveSource: false });

    // Should not suggest edit without source
    expect(bias.defaultChoiceBias).not.toBe('EDIT_IN_PLACE');
  });

  it('should bias toward TRANSFORM when prefersTransformOverCreate', () => {
    for (let i = 0; i < 8; i++) {
      recordPreference({ key: 'prefersTransformOverCreate' });
    }

    const bias = getPreferenceBias({ routeHint: 'TRANSFORM' });

    expect(bias.defaultChoiceBias).toBe('TRANSFORM_NEW_VERSION');
  });

  it('should reorder options based on preferences', () => {
    for (let i = 0; i < 10; i++) {
      recordPreference({ key: 'prefersEditInPlace' });
    }

    const bias = getPreferenceBias({});

    expect(bias.optionOrderBias[0]).toBe('EDIT_IN_PLACE');
  });
});

// ============================================
// Signal Detection
// ============================================
describe('detectChoiceSignals', () => {
  it('should detect EDIT_IN_PLACE preference', () => {
    const signals = detectChoiceSignals('EDIT_IN_PLACE', {});

    expect(signals.some(s => s.key === 'prefersEditInPlace')).toBe(true);
  });

  it('should detect transform over create when hint was CREATE', () => {
    const signals = detectChoiceSignals('TRANSFORM_NEW_VERSION', { routeHint: 'CREATE' });

    expect(signals.some(s => s.key === 'prefersTransformOverCreate')).toBe(true);
  });

  it('should detect create over transform when hint was TRANSFORM', () => {
    const signals = detectChoiceSignals('CREATE_NEW', { routeHint: 'TRANSFORM' });

    expect(signals.some(s => s.key === 'prefersCreateOverTransform')).toBe(true);
  });

  it('should not signal preference when choice matches hint', () => {
    const signals = detectChoiceSignals('CREATE_NEW', { routeHint: 'CREATE' });

    // Should not have any signals since choice matches hint
    expect(signals.length).toBe(0);
  });
});

describe('detectOutputSignals', () => {
  it('should detect short output preference', () => {
    const shortOutput = 'This is a short output with only a few words.';
    const signals = detectOutputSignals(shortOutput);

    expect(signals.some(s => s.key === 'prefersShortOutput')).toBe(true);
  });

  it('should detect emoji preference', () => {
    const emojiOutput = 'Great post! 🎉 Love it! 👍';
    const signals = detectOutputSignals(emojiOutput);

    expect(signals.some(s => s.key === 'likesEmoji')).toBe(true);
  });
});

describe('detectInstructionSignals', () => {
  it('should detect short preference from instruction', () => {
    const signals = detectInstructionSignals('viết ngắn gọn hơn');

    expect(signals.some(s => s.key === 'prefersShortOutput')).toBe(true);
  });

  it('should detect professional tone preference', () => {
    const signals = detectInstructionSignals('make it more professional');

    expect(signals.some(s => s.key === 'prefersProfessionalTone')).toBe(true);
  });

  it('should detect emoji avoidance', () => {
    const signals = detectInstructionSignals('bỏ emoji đi');

    expect(signals.some(s => s.key === 'avoidsEmoji')).toBe(true);
  });

  it('should detect emoji preference', () => {
    const signals = detectInstructionSignals('thêm emoji vào');

    expect(signals.some(s => s.key === 'likesEmoji')).toBe(true);
  });
});

// ============================================
// Debug Helpers
// ============================================
describe('getPreferenceDebugSummary', () => {
  it('should return "No prefs" when no preferences', () => {
    const summary = getPreferenceDebugSummary();
    expect(summary).toBe('No prefs');
  });

  it('should show active preferences', () => {
    for (let i = 0; i < 8; i++) {
      recordPreference({ key: 'prefersShortOutput' });
    }

    const summary = getPreferenceDebugSummary();
    expect(summary).toContain('Short');
  });
});

describe('getPreferenceStats', () => {
  it('should return zero counts when no preferences', () => {
    const stats = getPreferenceStats();

    expect(stats.totalPreferences).toBe(0);
    expect(stats.activePreferences).toBe(0);
    expect(stats.strongestPreference).toBeNull();
  });

  it('should return correct counts', () => {
    for (let i = 0; i < 5; i++) {
      recordPreference({ key: 'prefersShortOutput' });
    }
    recordPreference({ key: 'prefersLongOutput' });

    const stats = getPreferenceStats();

    expect(stats.totalPreferences).toBe(2);
    expect(stats.activePreferences).toBe(1);
    expect(stats.strongestPreference?.key).toBe('prefersShortOutput');
  });
});

describe('getPreferenceColorClasses', () => {
  it('should return indigo for strong preferences', () => {
    const colors = getPreferenceColorClasses(0.8);
    expect(colors.bg).toContain('indigo');
  });

  it('should return violet for medium preferences', () => {
    const colors = getPreferenceColorClasses(0.6);
    expect(colors.bg).toContain('violet');
  });

  it('should return slate for weak preferences', () => {
    const colors = getPreferenceColorClasses(0.3);
    expect(colors.bg).toContain('slate');
  });
});

// ============================================
// Edge Cases
// ============================================
describe('edge cases', () => {
  it('should handle rapid consecutive recordings', () => {
    for (let i = 0; i < 20; i++) {
      recordPreference({ key: 'prefersShortOutput' });
    }

    const state = loadPreferences();
    expect(state.preferences.prefersShortOutput.positiveCount).toBe(20);
  });

  it('should handle all preference keys', () => {
    const keys: PreferenceKey[] = [
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
    ];

    for (const key of keys) {
      recordPreference({ key });
    }

    const state = loadPreferences();
    expect(Object.keys(state.preferences).length).toBe(keys.length);
  });
});
