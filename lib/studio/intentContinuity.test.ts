// ============================================
// STEP 11: Intent Continuity Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInitialContinuityState,
  addIntentToHistory,
  markRecentUndo,
  detectConversationMode,
  updateContinuityState,
  shouldSkipConfirmationByContext,
  getContinuityDebugSummary,
  getModeLabel,
  getModeEmoji,
  getModeColorClasses,
  type ContinuityState,
  type IntentHistoryItem,
  type ConversationMode,
} from './intentContinuity';

// ============================================
// Helper functions
// ============================================

function makeHistoryItem(
  intentType: 'CREATE' | 'TRANSFORM' | 'EDIT_IN_PLACE',
  overrides: Partial<IntentHistoryItem> = {}
): IntentHistoryItem {
  return {
    timestamp: Date.now(),
    intentType,
    patternHash: 'test-hash',
    ...overrides,
  };
}

function makeHistory(types: Array<'CREATE' | 'TRANSFORM' | 'EDIT_IN_PLACE'>): IntentHistoryItem[] {
  const now = Date.now();
  return types.map((intentType, i) => ({
    timestamp: now - i * 1000, // Each 1 second apart
    intentType,
    patternHash: `hash-${i}`,
  }));
}

// ============================================
// createInitialContinuityState
// ============================================
describe('createInitialContinuityState', () => {
  it('should create empty state with UNKNOWN mode', () => {
    const state = createInitialContinuityState();

    expect(state.mode).toBe('UNKNOWN');
    expect(state.modeConfidence).toBe(0);
    expect(state.consecutiveCount).toBe(0);
    expect(state.dominantType).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.inCorrectionCycle).toBe(false);
    expect(state.reason).toBe('No history yet');
  });
});

// ============================================
// addIntentToHistory
// ============================================
describe('addIntentToHistory', () => {
  it('should add item to front of history', () => {
    const state = createInitialContinuityState();
    const newState = addIntentToHistory(state, {
      intentType: 'CREATE',
      patternHash: 'test',
    });

    expect(newState.history).toHaveLength(1);
    expect(newState.history[0].intentType).toBe('CREATE');
    expect(newState.history[0].timestamp).toBeDefined();
  });

  it('should maintain max history size', () => {
    let state = createInitialContinuityState();

    // Add 25 items (max is 20)
    for (let i = 0; i < 25; i++) {
      state = addIntentToHistory(state, {
        intentType: 'CREATE',
        patternHash: `hash-${i}`,
      });
    }

    expect(state.history).toHaveLength(20);
    // Most recent should be at front
    expect(state.history[0].patternHash).toBe('hash-24');
  });
});

// ============================================
// markRecentUndo
// ============================================
describe('markRecentUndo', () => {
  it('should mark most recent item with undo signal', () => {
    let state = createInitialContinuityState();
    state = addIntentToHistory(state, {
      intentType: 'CREATE',
      patternHash: 'test',
    });

    const newState = markRecentUndo(state);

    expect(newState.history[0].hadUndoSignal).toBe(true);
    expect(newState.inCorrectionCycle).toBe(true);
  });

  it('should return unchanged state if history is empty', () => {
    const state = createInitialContinuityState();
    const newState = markRecentUndo(state);

    expect(newState).toBe(state);
  });
});

// ============================================
// detectConversationMode
// ============================================
describe('detectConversationMode', () => {
  describe('UNKNOWN mode', () => {
    it('should return UNKNOWN for empty history', () => {
      const result = detectConversationMode([]);

      expect(result.mode).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });

    it('should return UNKNOWN for insufficient history', () => {
      const history = makeHistory(['CREATE']);
      const result = detectConversationMode(history);

      expect(result.mode).toBe('UNKNOWN');
      expect(result.confidence).toBe(0.3);
    });
  });

  describe('CORRECTION_FLOW', () => {
    it('should detect CORRECTION_FLOW when recent undo signal', () => {
      const history: IntentHistoryItem[] = [
        { ...makeHistoryItem('CREATE'), hadUndoSignal: true },
        makeHistoryItem('TRANSFORM'),
      ];

      const result = detectConversationMode(history);

      expect(result.mode).toBe('CORRECTION_FLOW');
      expect(result.confidence).toBe(0.9);
    });

    it('should detect CORRECTION_FLOW on rapid alternation', () => {
      const now = Date.now();
      const history: IntentHistoryItem[] = [
        { ...makeHistoryItem('CREATE'), timestamp: now },
        { ...makeHistoryItem('TRANSFORM'), timestamp: now - 5000 },
        { ...makeHistoryItem('CREATE'), timestamp: now - 10000 },
      ];

      const result = detectConversationMode(history);

      expect(result.mode).toBe('CORRECTION_FLOW');
    });
  });

  describe('REFINE_FLOW', () => {
    it('should detect REFINE_FLOW with 2+ consecutive TRANSFORM', () => {
      const history = makeHistory(['TRANSFORM', 'TRANSFORM']);
      const result = detectConversationMode(history);

      expect(result.mode).toBe('REFINE_FLOW');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should increase confidence with more consecutive TRANSFORM', () => {
      const history2 = makeHistory(['TRANSFORM', 'TRANSFORM']);
      const history4 = makeHistory(['TRANSFORM', 'TRANSFORM', 'TRANSFORM', 'TRANSFORM']);

      const result2 = detectConversationMode(history2);
      const result4 = detectConversationMode(history4);

      expect(result4.confidence).toBeGreaterThan(result2.confidence);
    });

    it('should detect REFINE_FLOW with EDIT_IN_PLACE + TRANSFORM', () => {
      const history: IntentHistoryItem[] = [
        makeHistoryItem('EDIT_IN_PLACE'),
        makeHistoryItem('TRANSFORM'),
      ];

      const result = detectConversationMode(history);

      expect(result.mode).toBe('REFINE_FLOW');
      expect(result.confidence).toBe(0.7);
    });
  });

  describe('CREATE_FLOW', () => {
    it('should detect CREATE_FLOW with 2+ consecutive CREATE', () => {
      const history = makeHistory(['CREATE', 'CREATE']);
      const result = detectConversationMode(history);

      expect(result.mode).toBe('CREATE_FLOW');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should increase confidence with more consecutive CREATE', () => {
      const history2 = makeHistory(['CREATE', 'CREATE']);
      const history4 = makeHistory(['CREATE', 'CREATE', 'CREATE', 'CREATE']);

      const result2 = detectConversationMode(history2);
      const result4 = detectConversationMode(history4);

      expect(result4.confidence).toBeGreaterThan(result2.confidence);
    });
  });

  describe('EXPLORATION_FLOW', () => {
    it('should detect EXPLORATION_FLOW with mixed intents (slow pace)', () => {
      // Use wider time gaps to avoid CORRECTION_FLOW detection
      const now = Date.now();
      const history: IntentHistoryItem[] = [
        { ...makeHistoryItem('CREATE'), timestamp: now },
        { ...makeHistoryItem('TRANSFORM'), timestamp: now - 120000 }, // 2 min apart
        { ...makeHistoryItem('CREATE'), timestamp: now - 240000 }, // 4 min apart
      ];

      const result = detectConversationMode(history);

      expect(result.mode).toBe('EXPLORATION_FLOW');
      expect(result.confidence).toBe(0.6);
    });
  });
});

// ============================================
// updateContinuityState
// ============================================
describe('updateContinuityState', () => {
  it('should add intent and update mode', () => {
    const initial = createInitialContinuityState();

    const updated = updateContinuityState(initial, {
      intentType: 'CREATE',
      patternHash: 'test',
    });

    expect(updated.history).toHaveLength(1);
    expect(updated.mode).toBe('UNKNOWN'); // Only 1 item, not enough
  });

  it('should detect REFINE_FLOW after consecutive TRANSFORM', () => {
    let state = createInitialContinuityState();

    state = updateContinuityState(state, {
      intentType: 'TRANSFORM',
      patternHash: 'hash-1',
    });

    state = updateContinuityState(state, {
      intentType: 'TRANSFORM',
      patternHash: 'hash-2',
    });

    expect(state.mode).toBe('REFINE_FLOW');
    expect(state.consecutiveCount).toBe(2);
    expect(state.dominantType).toBe('TRANSFORM');
  });

  it('should track correction cycle', () => {
    let state = createInitialContinuityState();

    state = updateContinuityState(state, {
      intentType: 'CREATE',
      patternHash: 'hash-1',
    });

    state = markRecentUndo(state);

    state = updateContinuityState(state, {
      intentType: 'CREATE',
      patternHash: 'hash-2',
    });

    expect(state.mode).toBe('CORRECTION_FLOW');
    expect(state.inCorrectionCycle).toBe(true);
  });
});

// ============================================
// shouldSkipConfirmationByContext
// ============================================
describe('shouldSkipConfirmationByContext', () => {
  const makeContinuity = (
    mode: ConversationMode,
    modeConfidence: number = 0.8
  ): ContinuityState => ({
    mode,
    modeConfidence,
    consecutiveCount: 3,
    dominantType: mode === 'CREATE_FLOW' ? 'CREATE' : 'TRANSFORM',
    history: [],
    inCorrectionCycle: mode === 'CORRECTION_FLOW',
    reason: 'test',
  });

  describe('CORRECTION_FLOW', () => {
    it('should always SHOW for CORRECTION_FLOW', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('CORRECTION_FLOW'),
        stabilityBand: 'HIGH',
        routeHint: 'TRANSFORM',
        autoApplyEligible: true,
      });

      expect(result).toBe('SHOW');
    });

    it('should SHOW when inCorrectionCycle even if mode is different', () => {
      const continuity = makeContinuity('REFINE_FLOW');
      continuity.inCorrectionCycle = true;

      const result = shouldSkipConfirmationByContext({
        continuity,
        stabilityBand: 'HIGH',
        routeHint: 'TRANSFORM',
        autoApplyEligible: true,
      });

      expect(result).toBe('SHOW');
    });
  });

  describe('EXPLORATION_FLOW', () => {
    it('should return DEFAULT for EXPLORATION_FLOW', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('EXPLORATION_FLOW'),
        stabilityBand: 'HIGH',
        routeHint: 'TRANSFORM',
        autoApplyEligible: true,
      });

      expect(result).toBe('DEFAULT');
    });
  });

  describe('UNKNOWN', () => {
    it('should return DEFAULT for UNKNOWN', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('UNKNOWN'),
        stabilityBand: 'HIGH',
        routeHint: 'TRANSFORM',
        autoApplyEligible: true,
      });

      expect(result).toBe('DEFAULT');
    });
  });

  describe('REFINE_FLOW', () => {
    it('should SKIP when HIGH stability + matching hint + high confidence', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('REFINE_FLOW', 0.8),
        stabilityBand: 'HIGH',
        routeHint: 'TRANSFORM',
        autoApplyEligible: true,
      });

      expect(result).toBe('SKIP');
    });

    it('should DEFAULT when hint does not match', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('REFINE_FLOW', 0.8),
        stabilityBand: 'HIGH',
        routeHint: 'CREATE', // Mismatch!
        autoApplyEligible: true,
      });

      expect(result).toBe('DEFAULT');
    });

    it('should DEFAULT when LOW stability', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('REFINE_FLOW', 0.8),
        stabilityBand: 'LOW',
        routeHint: 'TRANSFORM',
        autoApplyEligible: true,
      });

      expect(result).toBe('DEFAULT');
    });

    it('should SKIP with MEDIUM stability + very high confidence + autoApply', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('REFINE_FLOW', 0.85),
        stabilityBand: 'MEDIUM',
        routeHint: 'TRANSFORM',
        autoApplyEligible: true,
      });

      expect(result).toBe('SKIP');
    });

    it('should DEFAULT with MEDIUM stability but not autoApply eligible', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('REFINE_FLOW', 0.85),
        stabilityBand: 'MEDIUM',
        routeHint: 'TRANSFORM',
        autoApplyEligible: false,
      });

      expect(result).toBe('DEFAULT');
    });
  });

  describe('CREATE_FLOW', () => {
    it('should SKIP when HIGH stability + matching hint + high confidence', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('CREATE_FLOW', 0.8),
        stabilityBand: 'HIGH',
        routeHint: 'CREATE',
        autoApplyEligible: true,
      });

      expect(result).toBe('SKIP');
    });

    it('should DEFAULT when hint does not match', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('CREATE_FLOW', 0.8),
        stabilityBand: 'HIGH',
        routeHint: 'TRANSFORM', // Mismatch!
        autoApplyEligible: true,
      });

      expect(result).toBe('DEFAULT');
    });

    it('should DEFAULT when not HIGH stability (more conservative)', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('CREATE_FLOW', 0.8),
        stabilityBand: 'MEDIUM',
        routeHint: 'CREATE',
        autoApplyEligible: true,
      });

      expect(result).toBe('DEFAULT');
    });

    it('should DEFAULT when confidence too low', () => {
      const result = shouldSkipConfirmationByContext({
        continuity: makeContinuity('CREATE_FLOW', 0.5),
        stabilityBand: 'HIGH',
        routeHint: 'CREATE',
        autoApplyEligible: true,
      });

      expect(result).toBe('DEFAULT');
    });
  });
});

// ============================================
// Debug helpers
// ============================================
describe('getContinuityDebugSummary', () => {
  it('should return formatted debug string', () => {
    const state: ContinuityState = {
      mode: 'REFINE_FLOW',
      modeConfidence: 0.75,
      consecutiveCount: 3,
      dominantType: 'TRANSFORM',
      history: makeHistory(['TRANSFORM', 'TRANSFORM', 'TRANSFORM']),
      inCorrectionCycle: false,
      reason: 'test',
    };

    const summary = getContinuityDebugSummary(state);

    expect(summary).toContain('REFINE');
    expect(summary).toContain('75%');
    expect(summary).toContain('3x');
    expect(summary).toContain('TRANSFORM');
    expect(summary).toContain('h=3');
  });

  it('should show correction indicator when in cycle', () => {
    const state: ContinuityState = {
      mode: 'CORRECTION_FLOW',
      modeConfidence: 0.9,
      consecutiveCount: 1,
      dominantType: 'CREATE',
      history: [],
      inCorrectionCycle: true,
      reason: 'test',
    };

    const summary = getContinuityDebugSummary(state);

    expect(summary).toContain('CORR');
  });
});

describe('getModeLabel', () => {
  it('should return correct labels', () => {
    expect(getModeLabel('CREATE_FLOW')).toBe('Creating');
    expect(getModeLabel('REFINE_FLOW')).toBe('Refining');
    expect(getModeLabel('EXPLORATION_FLOW')).toBe('Exploring');
    expect(getModeLabel('CORRECTION_FLOW')).toBe('Correcting');
    expect(getModeLabel('UNKNOWN')).toBe('Learning');
  });
});

describe('getModeEmoji', () => {
  it('should return correct emojis', () => {
    expect(getModeEmoji('CREATE_FLOW')).toBe('✨');
    expect(getModeEmoji('REFINE_FLOW')).toBe('🔄');
    expect(getModeEmoji('EXPLORATION_FLOW')).toBe('🔍');
    expect(getModeEmoji('CORRECTION_FLOW')).toBe('⏪');
    expect(getModeEmoji('UNKNOWN')).toBe('❓');
  });
});

describe('getModeColorClasses', () => {
  it('should return color classes for each mode', () => {
    const modes: ConversationMode[] = [
      'CREATE_FLOW',
      'REFINE_FLOW',
      'EXPLORATION_FLOW',
      'CORRECTION_FLOW',
      'UNKNOWN',
    ];

    for (const mode of modes) {
      const colors = getModeColorClasses(mode);
      expect(colors).toHaveProperty('bg');
      expect(colors).toHaveProperty('text');
      expect(colors).toHaveProperty('border');
      expect(colors.bg).toContain('bg-');
      expect(colors.text).toContain('text-');
      expect(colors.border).toContain('border-');
    }
  });
});
