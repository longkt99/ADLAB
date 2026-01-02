// ============================================
// STEP 7: Intent Learning Tests
// STEP 9: Outcome Integration Tests
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computePatternHash,
  loadLearnedChoices,
  recordChoice,
  getLearnedChoice,
  getAutoApplyChoice,
  recordNegativeSignal,
  clearLearnedChoices,
  getLearnedChoicesStats,
  // STEP 9: Outcome integration
  recordOutcome,
  getPatternReliability,
  isPatternUnreliable,
  clearOutcomeReliability,
  type IntentChoice,
} from './intentLearning';

// ============================================
// Mock localStorage
// ============================================
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
  };
})();

// Setup mock before each test
beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal('window', { localStorage: localStorageMock });
});

// ============================================
// computePatternHash
// ============================================
describe('computePatternHash', () => {
  it('should return consistent hash for same input', () => {
    const params = {
      normalizedInstruction: 'viết lại ngắn hơn',
      hasActiveSource: true,
      hasLastValidAssistant: true,
      uiSourceMessageId: 'msg-123',
    };

    const hash1 = computePatternHash(params);
    const hash2 = computePatternHash(params);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]+$/); // Should be hex
  });

  it('should return different hash for different input', () => {
    const hash1 = computePatternHash({
      normalizedInstruction: 'viết lại ngắn hơn',
      hasActiveSource: true,
      hasLastValidAssistant: true,
    });

    const hash2 = computePatternHash({
      normalizedInstruction: 'viết lại dài hơn',
      hasActiveSource: true,
      hasLastValidAssistant: true,
    });

    expect(hash1).not.toBe(hash2);
  });

  it('should truncate long instructions', () => {
    const longInstruction = 'a'.repeat(100);
    const shortInstruction = 'a'.repeat(50);

    const hash1 = computePatternHash({
      normalizedInstruction: longInstruction,
      hasActiveSource: false,
      hasLastValidAssistant: false,
    });

    const hash2 = computePatternHash({
      normalizedInstruction: shortInstruction,
      hasActiveSource: false,
      hasLastValidAssistant: false,
    });

    // Both should produce same hash (truncated to 50 chars)
    expect(hash1).toBe(hash2);
  });

  it('should normalize instruction', () => {
    const hash1 = computePatternHash({
      normalizedInstruction: 'VIẾT LẠI',
      hasActiveSource: false,
      hasLastValidAssistant: false,
    });

    const hash2 = computePatternHash({
      normalizedInstruction: 'viết lại',
      hasActiveSource: false,
      hasLastValidAssistant: false,
    });

    expect(hash1).toBe(hash2);
  });
});

// ============================================
// recordChoice & getLearnedChoice
// ============================================
describe('recordChoice', () => {
  it('should record a new choice', () => {
    const hash = 'test-hash-123';
    const choice: IntentChoice = 'TRANSFORM_NEW_VERSION';

    recordChoice(hash, choice);

    const learned = getLearnedChoice(hash);
    expect(learned).not.toBeNull();
    expect(learned?.choice).toBe(choice);
    expect(learned?.count).toBe(1);
    expect(learned?.negativeCount).toBe(0);
  });

  it('should increment count for same choice', () => {
    const hash = 'test-hash-123';
    const choice: IntentChoice = 'CREATE_NEW';

    recordChoice(hash, choice);
    recordChoice(hash, choice);
    recordChoice(hash, choice);

    const learned = getLearnedChoice(hash);
    expect(learned?.count).toBe(3);
  });

  it('should reset count when choice changes', () => {
    const hash = 'test-hash-123';

    recordChoice(hash, 'CREATE_NEW');
    recordChoice(hash, 'CREATE_NEW');
    expect(getLearnedChoice(hash)?.count).toBe(2);

    recordChoice(hash, 'TRANSFORM_NEW_VERSION');
    const learned = getLearnedChoice(hash);
    expect(learned?.choice).toBe('TRANSFORM_NEW_VERSION');
    expect(learned?.count).toBe(1);
  });
});

// ============================================
// getAutoApplyChoice
// ============================================
describe('getAutoApplyChoice', () => {
  it('should return null for unknown hash', () => {
    const result = getAutoApplyChoice('unknown-hash');
    expect(result).toBeNull();
  });

  it('should return null when count < threshold (2)', () => {
    const hash = 'test-hash';
    recordChoice(hash, 'EDIT_IN_PLACE');

    const result = getAutoApplyChoice(hash);
    expect(result).toBeNull();
  });

  it('should return choice when count >= threshold (2)', () => {
    const hash = 'test-hash';
    recordChoice(hash, 'EDIT_IN_PLACE');
    recordChoice(hash, 'EDIT_IN_PLACE');

    const result = getAutoApplyChoice(hash);
    expect(result).toBe('EDIT_IN_PLACE');
  });

  it('should return null when negative count >= threshold (2)', () => {
    const hash = 'test-hash';
    recordChoice(hash, 'EDIT_IN_PLACE');
    recordChoice(hash, 'EDIT_IN_PLACE');

    // Record negative signals
    recordNegativeSignal(hash, 'EDIT_IN_PLACE');
    recordNegativeSignal(hash, 'EDIT_IN_PLACE');

    const result = getAutoApplyChoice(hash);
    expect(result).toBeNull();
  });
});

// ============================================
// recordNegativeSignal
// ============================================
describe('recordNegativeSignal', () => {
  it('should increment negative count', () => {
    const hash = 'test-hash';
    recordChoice(hash, 'EDIT_IN_PLACE');

    recordNegativeSignal(hash, 'EDIT_IN_PLACE');

    const learned = getLearnedChoice(hash);
    expect(learned?.negativeCount).toBe(1);
  });

  it('should not record for different choice', () => {
    const hash = 'test-hash';
    recordChoice(hash, 'EDIT_IN_PLACE');

    recordNegativeSignal(hash, 'CREATE_NEW'); // Different choice

    const learned = getLearnedChoice(hash);
    expect(learned?.negativeCount).toBe(0);
  });

  it('should not record for unknown hash', () => {
    recordNegativeSignal('unknown-hash', 'EDIT_IN_PLACE');
    // Should not throw
    expect(getLearnedChoice('unknown-hash')).toBeNull();
  });

  it('should disable auto-apply after threshold negative signals', () => {
    const hash = 'test-hash';

    // Build up enough positive signals
    recordChoice(hash, 'EDIT_IN_PLACE');
    recordChoice(hash, 'EDIT_IN_PLACE');
    recordChoice(hash, 'EDIT_IN_PLACE');

    expect(getAutoApplyChoice(hash)).toBe('EDIT_IN_PLACE');

    // Add negative signals
    recordNegativeSignal(hash, 'EDIT_IN_PLACE');
    recordNegativeSignal(hash, 'EDIT_IN_PLACE');

    // Should no longer auto-apply
    expect(getAutoApplyChoice(hash)).toBeNull();
  });
});

// ============================================
// clearLearnedChoices
// ============================================
describe('clearLearnedChoices', () => {
  it('should clear all learned choices', () => {
    recordChoice('hash-1', 'CREATE_NEW');
    recordChoice('hash-2', 'TRANSFORM_NEW_VERSION');

    clearLearnedChoices();

    expect(getLearnedChoice('hash-1')).toBeNull();
    expect(getLearnedChoice('hash-2')).toBeNull();
  });
});

// ============================================
// getLearnedChoicesStats
// ============================================
describe('getLearnedChoicesStats', () => {
  it('should return correct stats', () => {
    // Add some patterns
    recordChoice('hash-1', 'CREATE_NEW');
    recordChoice('hash-1', 'CREATE_NEW'); // count=2, auto-applyable

    recordChoice('hash-2', 'EDIT_IN_PLACE'); // count=1, not auto-applyable

    recordChoice('hash-3', 'TRANSFORM_NEW_VERSION');
    recordChoice('hash-3', 'TRANSFORM_NEW_VERSION');
    recordNegativeSignal('hash-3', 'TRANSFORM_NEW_VERSION');
    recordNegativeSignal('hash-3', 'TRANSFORM_NEW_VERSION'); // unreliable

    const stats = getLearnedChoicesStats();

    expect(stats.totalPatterns).toBe(3);
    expect(stats.autoApplyableCount).toBe(1); // Only hash-1
    expect(stats.unreliableCount).toBe(1); // Only hash-3
  });

  it('should return zeros for empty storage', () => {
    clearLearnedChoices();

    const stats = getLearnedChoicesStats();

    expect(stats.totalPatterns).toBe(0);
    expect(stats.autoApplyableCount).toBe(0);
    expect(stats.unreliableCount).toBe(0);
  });
});

// ============================================
// Storage persistence
// ============================================
describe('storage persistence', () => {
  it('should persist choices across load/save cycles', () => {
    const hash = 'persistent-hash';

    recordChoice(hash, 'CREATE_NEW');
    recordChoice(hash, 'CREATE_NEW');

    // Simulate reload by clearing cache and loading again
    const loaded = loadLearnedChoices();

    expect(loaded[hash]).toBeDefined();
    expect(loaded[hash].count).toBe(2);
    expect(loaded[hash].choice).toBe('CREATE_NEW');
  });

  it('should handle corrupted storage gracefully', () => {
    // Set invalid JSON
    localStorageMock.setItem('studio_intent_learning_v1', 'not valid json');

    const loaded = loadLearnedChoices();
    expect(loaded).toEqual({});
  });

  it('should handle invalid version', () => {
    localStorageMock.setItem('studio_intent_learning_v1', JSON.stringify({
      version: 999, // Invalid version
      choices: { 'test': {} },
    }));

    const loaded = loadLearnedChoices();
    expect(loaded).toEqual({});
  });
});

// ============================================
// STEP 9: Outcome Integration Tests
// ============================================

describe('recordOutcome', () => {
  beforeEach(() => {
    clearOutcomeReliability();
  });

  it('should record a high severity negative outcome', () => {
    recordOutcome('intent-1', 'pattern-abc', 'high', true);

    const reliability = getPatternReliability('pattern-abc');
    expect(reliability).not.toBeNull();
    expect(reliability?.highNegativeCount).toBe(1);
    expect(reliability?.acceptedCount).toBe(0);
  });

  it('should record an accepted outcome', () => {
    recordOutcome('intent-1', 'pattern-abc', 'low', false);

    const reliability = getPatternReliability('pattern-abc');
    expect(reliability).not.toBeNull();
    expect(reliability?.highNegativeCount).toBe(0);
    expect(reliability?.acceptedCount).toBe(1);
  });

  it('should accumulate counts for same pattern', () => {
    recordOutcome('intent-1', 'pattern-abc', 'high', true);
    recordOutcome('intent-2', 'pattern-abc', 'high', true);
    recordOutcome('intent-3', 'pattern-abc', 'low', false);

    const reliability = getPatternReliability('pattern-abc');
    expect(reliability?.highNegativeCount).toBe(2);
    expect(reliability?.acceptedCount).toBe(1);
  });

  it('should not count medium/low severity as high negative', () => {
    recordOutcome('intent-1', 'pattern-abc', 'medium', true);
    recordOutcome('intent-2', 'pattern-abc', 'low', true);

    const reliability = getPatternReliability('pattern-abc');
    expect(reliability?.highNegativeCount).toBe(0);
  });

  it('should skip if patternHash is empty', () => {
    recordOutcome('intent-1', '', 'high', true);
    expect(getPatternReliability('')).toBeNull();
  });
});

describe('isPatternUnreliable', () => {
  beforeEach(() => {
    clearOutcomeReliability();
  });

  it('should return false for unknown pattern', () => {
    expect(isPatternUnreliable('unknown')).toBe(false);
  });

  it('should return false for pattern with < 2 high negatives', () => {
    recordOutcome('intent-1', 'pattern-abc', 'high', true);
    expect(isPatternUnreliable('pattern-abc')).toBe(false);
  });

  it('should return true for pattern with >= 2 high negatives', () => {
    recordOutcome('intent-1', 'pattern-abc', 'high', true);
    recordOutcome('intent-2', 'pattern-abc', 'high', true);
    expect(isPatternUnreliable('pattern-abc')).toBe(true);
  });

  it('should ignore medium/low severity in unreliable check', () => {
    recordOutcome('intent-1', 'pattern-abc', 'medium', true);
    recordOutcome('intent-2', 'pattern-abc', 'medium', true);
    recordOutcome('intent-3', 'pattern-abc', 'low', true);
    expect(isPatternUnreliable('pattern-abc')).toBe(false);
  });
});

describe('getAutoApplyChoice with outcome integration', () => {
  beforeEach(() => {
    clearOutcomeReliability();
    clearLearnedChoices();
  });

  it('should not auto-apply if pattern is unreliable due to outcomes', () => {
    const hash = 'outcome-test-hash';

    // Build up learned choice
    recordChoice(hash, 'EDIT_IN_PLACE');
    recordChoice(hash, 'EDIT_IN_PLACE');
    recordChoice(hash, 'EDIT_IN_PLACE');

    // Verify it would auto-apply normally
    expect(getAutoApplyChoice(hash)).toBe('EDIT_IN_PLACE');

    // Record high severity negative outcomes
    recordOutcome('intent-1', hash, 'high', true);
    recordOutcome('intent-2', hash, 'high', true);

    // Should no longer auto-apply
    expect(getAutoApplyChoice(hash)).toBeNull();
  });

  it('should still auto-apply if outcomes are not high severity', () => {
    const hash = 'outcome-test-hash-2';

    // Build up learned choice
    recordChoice(hash, 'CREATE_NEW');
    recordChoice(hash, 'CREATE_NEW');

    // Record medium severity outcomes
    recordOutcome('intent-1', hash, 'medium', true);
    recordOutcome('intent-2', hash, 'medium', true);

    // Should still auto-apply (only high severity counts)
    expect(getAutoApplyChoice(hash)).toBe('CREATE_NEW');
  });

  it('should still auto-apply if outcomes are accepted', () => {
    const hash = 'outcome-test-hash-3';

    // Build up learned choice
    recordChoice(hash, 'TRANSFORM_NEW_VERSION');
    recordChoice(hash, 'TRANSFORM_NEW_VERSION');

    // Record accepted outcomes
    recordOutcome('intent-1', hash, 'low', false);
    recordOutcome('intent-2', hash, 'low', false);

    // Should still auto-apply
    expect(getAutoApplyChoice(hash)).toBe('TRANSFORM_NEW_VERSION');
  });
});

describe('clearOutcomeReliability', () => {
  it('should clear all outcome reliability data', () => {
    recordOutcome('intent-1', 'pattern-1', 'high', true);
    recordOutcome('intent-2', 'pattern-2', 'high', true);

    clearOutcomeReliability();

    expect(getPatternReliability('pattern-1')).toBeNull();
    expect(getPatternReliability('pattern-2')).toBeNull();
  });
});
