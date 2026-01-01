// ============================================
// Tests for Execution Contract Enforcement
// ============================================
// STEP 5: Verify intent → execution binding,
// source resolution priority, and drift detection.
//
// CRITICAL: These tests ensure execution MUST be
// consistent with user intent.
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIntentSnapshot, type IntentSnapshot, type ChatMessage } from '../../types/studio';
import {
  resolveExecutionSource,
  validateExecutionContract,
  warnIfExecutionSourceDrifts,
  warnIfModeMismatch,
  getOriginForChain,
  isInSameChain,
  type ExecutionSourceResult,
} from './executionContract';

// ============================================
// Test Helpers
// ============================================

function createTestMessage(id: string, role: 'user' | 'assistant', meta?: Partial<ChatMessage['meta']>): ChatMessage {
  return {
    id,
    role,
    content: `Test content for ${id}`,
    timestamp: new Date(),
    meta,
  };
}

function createTestSnapshot(params: {
  sourceMessageId?: string | null;
  mode?: 'CREATE' | 'PURE_TRANSFORM' | 'DIRECTED_TRANSFORM';
}): IntentSnapshot {
  return createIntentSnapshot({
    userTypedText: 'test instruction',
    detectedMode: params.mode || 'DIRECTED_TRANSFORM',
    detectedActions: ['REWRITE'],
    sourceMessageId: params.sourceMessageId ?? null,
    turnIndex: 1,
  });
}

// ============================================
// RESOLVE EXECUTION SOURCE TESTS
// ============================================

describe('resolveExecutionSource', () => {
  describe('Priority 1: IntentSnapshot (BINDING)', () => {
    it('should use intent snapshot source when available', () => {
      const messages = [
        createTestMessage('msg-1', 'assistant'),
        createTestMessage('msg-2', 'assistant'),
      ];

      const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-1' });

      const result = resolveExecutionSource({
        intentSnapshot,
        activeSourceId: 'msg-2', // UI selects different source
        lastTransformSourceId: null,
        messages,
        getLastValidAssistantMessage: () => messages[1],
      });

      // Intent source takes priority over UI selection
      expect(result.sourceId).toBe('msg-1');
      expect(result.resolution).toBe('INTENT_SNAPSHOT');
      expect(result.matchesIntent).toBe(true);
    });

    it('should warn when UI selection differs from intent', () => {
      const messages = [
        createTestMessage('msg-1', 'assistant'),
        createTestMessage('msg-2', 'assistant'),
      ];

      const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-1' });

      const result = resolveExecutionSource({
        intentSnapshot,
        activeSourceId: 'msg-2',
        lastTransformSourceId: null,
        messages,
        getLastValidAssistantMessage: () => messages[1],
      });

      expect(result.warning).toContain('UI selection');
      expect(result.warning).toContain('differs from intent');
    });
  });

  describe('Priority 2: UI Selection', () => {
    it('should use UI selection when no intent snapshot', () => {
      const messages = [
        createTestMessage('msg-1', 'assistant'),
        createTestMessage('msg-2', 'assistant'),
      ];

      const result = resolveExecutionSource({
        intentSnapshot: null,
        activeSourceId: 'msg-2',
        lastTransformSourceId: 'msg-1',
        messages,
        getLastValidAssistantMessage: () => messages[1],
      });

      expect(result.sourceId).toBe('msg-2');
      expect(result.resolution).toBe('UI_SELECTION');
    });

    it('should skip invalid UI selection', () => {
      const messages = [
        createTestMessage('msg-1', 'assistant'),
      ];

      const result = resolveExecutionSource({
        intentSnapshot: null,
        activeSourceId: 'non-existent',
        lastTransformSourceId: null,
        messages,
        getLastValidAssistantMessage: () => messages[0],
      });

      // Falls through to last assistant
      expect(result.sourceId).toBe('msg-1');
      expect(result.resolution).toBe('LAST_ASSISTANT');
    });
  });

  describe('Priority 3: Chain Memory', () => {
    it('should use chain memory when no UI selection', () => {
      const messages = [
        createTestMessage('msg-1', 'assistant'),
        createTestMessage('msg-2', 'assistant'),
      ];

      const result = resolveExecutionSource({
        intentSnapshot: null,
        activeSourceId: null,
        lastTransformSourceId: 'msg-1',
        messages,
        getLastValidAssistantMessage: () => messages[1],
      });

      expect(result.sourceId).toBe('msg-1');
      expect(result.resolution).toBe('CHAIN_MEMORY');
    });
  });

  describe('Priority 4: Last Valid Assistant', () => {
    it('should fallback to last valid assistant', () => {
      const messages = [
        createTestMessage('msg-1', 'assistant'),
        createTestMessage('msg-2', 'assistant'),
      ];

      const result = resolveExecutionSource({
        intentSnapshot: null,
        activeSourceId: null,
        lastTransformSourceId: null,
        messages,
        getLastValidAssistantMessage: () => messages[1],
      });

      expect(result.sourceId).toBe('msg-2');
      expect(result.resolution).toBe('LAST_ASSISTANT');
    });
  });

  describe('Priority 5: No Source (CREATE)', () => {
    it('should return null source for CREATE mode', () => {
      const messages: ChatMessage[] = [];

      const result = resolveExecutionSource({
        intentSnapshot: null,
        activeSourceId: null,
        lastTransformSourceId: null,
        messages,
        getLastValidAssistantMessage: () => null,
      });

      expect(result.sourceId).toBeNull();
      expect(result.resolution).toBe('NONE');
    });
  });
});

// ============================================
// VALIDATE EXECUTION CONTRACT TESTS
// ============================================

describe('validateExecutionContract', () => {
  it('should pass when source matches intent', () => {
    const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-1' });
    const resolvedSource: ExecutionSourceResult = {
      sourceId: 'msg-1',
      resolution: 'INTENT_SNAPSHOT',
      matchesIntent: true,
    };

    const result = validateExecutionContract(intentSnapshot, resolvedSource);

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should fail when source differs from intent', () => {
    const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-1' });
    const resolvedSource: ExecutionSourceResult = {
      sourceId: 'msg-2', // Different source
      resolution: 'UI_SELECTION',
      matchesIntent: false,
    };

    const result = validateExecutionContract(intentSnapshot, resolvedSource);

    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some(v => v.includes('Intent specified source'))).toBe(true);
  });

  it('should fail when TRANSFORM has no source', () => {
    const intentSnapshot = createTestSnapshot({
      sourceMessageId: 'msg-1',
      mode: 'DIRECTED_TRANSFORM',
    });
    const resolvedSource: ExecutionSourceResult = {
      sourceId: null,
      resolution: 'NONE',
      matchesIntent: false,
    };

    const result = validateExecutionContract(intentSnapshot, resolvedSource);

    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some(v => v.includes('no execution source resolved'))).toBe(true);
  });

  it('should fail when CREATE has source', () => {
    const intentSnapshot = createTestSnapshot({
      sourceMessageId: null,
      mode: 'CREATE',
    });
    const resolvedSource: ExecutionSourceResult = {
      sourceId: 'msg-1',
      resolution: 'LAST_ASSISTANT',
      matchesIntent: false,
    };

    const result = validateExecutionContract(intentSnapshot, resolvedSource);

    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some(v => v.includes('CREATE but execution has source'))).toBe(true);
  });

  it('should pass with no intent snapshot', () => {
    const resolvedSource: ExecutionSourceResult = {
      sourceId: 'msg-1',
      resolution: 'UI_SELECTION',
      matchesIntent: true,
    };

    const result = validateExecutionContract(null, resolvedSource);

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should allow proceeding despite violations', () => {
    const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-1' });
    const resolvedSource: ExecutionSourceResult = {
      sourceId: 'msg-2',
      resolution: 'UI_SELECTION',
      matchesIntent: false,
    };

    const result = validateExecutionContract(intentSnapshot, resolvedSource);

    // Even with violations, canProceed should be true for backward compatibility
    expect(result.canProceed).toBe(true);
  });
});

// ============================================
// ORIGIN CHAIN TRACKING TESTS
// ============================================

describe('getOriginForChain', () => {
  it('should return source ID when no origin exists', () => {
    const messages = [
      createTestMessage('msg-1', 'assistant'),
    ];

    const origin = getOriginForChain('msg-1', messages);

    expect(origin).toBe('msg-1');
  });

  it('should return originMessageId when source has one', () => {
    const messages = [
      createTestMessage('msg-1', 'assistant', { originMessageId: 'msg-original' }),
    ];

    const origin = getOriginForChain('msg-1', messages);

    expect(origin).toBe('msg-original');
  });

  it('should return null for null source', () => {
    const messages: ChatMessage[] = [];

    const origin = getOriginForChain(null, messages);

    expect(origin).toBeNull();
  });

  it('should return source ID for non-existent message', () => {
    const messages: ChatMessage[] = [];

    const origin = getOriginForChain('non-existent', messages);

    expect(origin).toBe('non-existent');
  });
});

describe('isInSameChain', () => {
  it('should return true for direct origin match', () => {
    const messages = [
      createTestMessage('msg-origin', 'assistant'),
    ];

    expect(isInSameChain('msg-origin', 'msg-origin', messages)).toBe(true);
  });

  it('should return true when message origin matches', () => {
    const messages = [
      createTestMessage('msg-transform', 'assistant', { originMessageId: 'msg-origin' }),
    ];

    expect(isInSameChain('msg-transform', 'msg-origin', messages)).toBe(true);
  });

  it('should return false for different chains', () => {
    const messages = [
      createTestMessage('msg-1', 'assistant', { originMessageId: 'msg-other-origin' }),
    ];

    expect(isInSameChain('msg-1', 'msg-origin', messages)).toBe(false);
  });

  it('should return false for null origin', () => {
    const messages = [
      createTestMessage('msg-1', 'assistant'),
    ];

    expect(isInSameChain('msg-1', null, messages)).toBe(false);
  });
});

// ============================================
// DRIFT DETECTION TESTS
// ============================================

describe('No Drift Invariant', () => {
  it('should detect drift when intent and execution differ', () => {
    // This test verifies the invariant that execution should match intent
    const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-1' });

    const messages = [
      createTestMessage('msg-1', 'assistant'),
      createTestMessage('msg-2', 'assistant'),
    ];

    // Simulate UI override that differs from intent
    const result = resolveExecutionSource({
      intentSnapshot,
      activeSourceId: null, // No UI override
      lastTransformSourceId: null,
      messages,
      getLastValidAssistantMessage: () => messages[1], // Would return msg-2
    });

    // With intent snapshot, source should be from intent, not fallback
    expect(result.sourceId).toBe('msg-1');
    expect(result.matchesIntent).toBe(true);
  });

  it('should maintain source through transform chain', () => {
    // Create a chain: original → transform1 → transform2
    const messages = [
      createTestMessage('msg-original', 'assistant'),
      createTestMessage('msg-transform1', 'assistant', { originMessageId: 'msg-original' }),
      createTestMessage('msg-transform2', 'assistant', { originMessageId: 'msg-original' }),
    ];

    // All transforms should point to same origin
    expect(getOriginForChain('msg-original', messages)).toBe('msg-original');
    expect(getOriginForChain('msg-transform1', messages)).toBe('msg-original');
    expect(getOriginForChain('msg-transform2', messages)).toBe('msg-original');

    // All should be in same chain
    expect(isInSameChain('msg-transform1', 'msg-original', messages)).toBe(true);
    expect(isInSameChain('msg-transform2', 'msg-original', messages)).toBe(true);
  });
});

// ============================================
// SELECTED MESSAGE ENFORCEMENT TESTS
// ============================================

describe('Selected Message Enforcement', () => {
  it('should always use UI selection when explicitly set', () => {
    const messages = [
      createTestMessage('msg-1', 'assistant'),
      createTestMessage('msg-2', 'assistant'),
      createTestMessage('msg-3', 'assistant'),
    ];

    // User explicitly selects msg-2, but chain memory points to msg-1
    const result = resolveExecutionSource({
      intentSnapshot: null, // No intent yet
      activeSourceId: 'msg-2', // Explicit UI selection
      lastTransformSourceId: 'msg-1', // Chain memory says different
      messages,
      getLastValidAssistantMessage: () => messages[2],
    });

    expect(result.sourceId).toBe('msg-2');
    expect(result.resolution).toBe('UI_SELECTION');
  });

  it('should prefer intent over UI selection (intent is binding)', () => {
    const messages = [
      createTestMessage('msg-intent', 'assistant'),
      createTestMessage('msg-ui', 'assistant'),
    ];

    const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-intent' });

    const result = resolveExecutionSource({
      intentSnapshot,
      activeSourceId: 'msg-ui', // User selects different
      lastTransformSourceId: null,
      messages,
      getLastValidAssistantMessage: () => messages[1],
    });

    // Intent takes priority - this is the BINDING behavior
    expect(result.sourceId).toBe('msg-intent');
    expect(result.resolution).toBe('INTENT_SNAPSHOT');
  });
});

// ============================================
// EXECUTION NEVER DRIFTS FROM INTENT TESTS
// ============================================

describe('Execution Never Drifts From Intent', () => {
  it('should never use fallback when intent specifies source', () => {
    const messages = [
      createTestMessage('msg-intent-source', 'assistant'),
      createTestMessage('msg-fallback', 'assistant'),
    ];

    const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-intent-source' });

    // Even with no UI selection and no chain memory,
    // should use intent source, not fallback
    const result = resolveExecutionSource({
      intentSnapshot,
      activeSourceId: null,
      lastTransformSourceId: null,
      messages,
      getLastValidAssistantMessage: () => messages[1], // Would return msg-fallback
    });

    expect(result.sourceId).toBe('msg-intent-source');
    expect(result.sourceId).not.toBe('msg-fallback');
  });

  it('should validate contract catches any drift', () => {
    const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-1' });

    // Simulating a bug where execution uses wrong source
    const buggyResult: ExecutionSourceResult = {
      sourceId: 'msg-2', // Wrong source!
      resolution: 'LAST_ASSISTANT',
      matchesIntent: false,
    };

    const validation = validateExecutionContract(intentSnapshot, buggyResult);

    // Contract should catch this violation
    expect(validation.valid).toBe(false);
    expect(validation.violations.length).toBeGreaterThan(0);
  });
});

// ============================================
// STEP 6: UI BINDING TESTS
// ============================================
// UI_BINDING is now the HIGHEST priority.
// When user selects a message and types a follow-up,
// that selection is BINDING for execution.

describe('UI Binding (STEP 6)', () => {
  describe('Priority 0: UI Binding (HIGHEST)', () => {
    it('should use uiSourceMessageId when provided', () => {
      const messages = [
        createTestMessage('msg-1', 'assistant'),
        createTestMessage('msg-2', 'assistant'),
        createTestMessage('msg-3', 'assistant'),
      ];

      const result = resolveExecutionSource({
        intentSnapshot: null,
        uiSourceMessageId: 'msg-2', // User clicked msg-2 then typed
        activeSourceId: 'msg-3',    // Legacy UI selection
        lastTransformSourceId: 'msg-1',
        messages,
        getLastValidAssistantMessage: () => messages[2],
      });

      expect(result.sourceId).toBe('msg-2');
      expect(result.resolution).toBe('UI_BINDING');
      expect(result.matchesIntent).toBe(true); // No intent to conflict
    });

    it('should override intent snapshot when UI binding is set', () => {
      const messages = [
        createTestMessage('msg-intent', 'assistant'),
        createTestMessage('msg-ui-binding', 'assistant'),
      ];

      const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-intent' });

      const result = resolveExecutionSource({
        intentSnapshot,
        uiSourceMessageId: 'msg-ui-binding', // User explicitly clicked this
        activeSourceId: null,
        lastTransformSourceId: null,
        messages,
        getLastValidAssistantMessage: () => messages[1],
      });

      // UI binding takes priority over intent snapshot
      expect(result.sourceId).toBe('msg-ui-binding');
      expect(result.resolution).toBe('UI_BINDING');
      expect(result.matchesIntent).toBe(false); // Differs from intent
    });

    it('should have warning when UI binding differs from intent', () => {
      const messages = [
        createTestMessage('msg-intent', 'assistant'),
        createTestMessage('msg-ui-binding', 'assistant'),
      ];

      const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-intent' });

      const result = resolveExecutionSource({
        intentSnapshot,
        uiSourceMessageId: 'msg-ui-binding',
        activeSourceId: null,
        lastTransformSourceId: null,
        messages,
        getLastValidAssistantMessage: () => messages[1],
      });

      expect(result.warning).toContain('UI binding takes precedence');
    });

    it('should override all other sources when UI binding is set', () => {
      const messages = [
        createTestMessage('msg-chain', 'assistant'),
        createTestMessage('msg-active', 'assistant'),
        createTestMessage('msg-binding', 'assistant'),
        createTestMessage('msg-last', 'assistant'),
      ];

      const result = resolveExecutionSource({
        intentSnapshot: null,
        uiSourceMessageId: 'msg-binding',      // UI BINDING - should win
        activeSourceId: 'msg-active',          // Legacy UI selection
        lastTransformSourceId: 'msg-chain',    // Chain memory
        messages,
        getLastValidAssistantMessage: () => messages[3], // Last assistant
      });

      expect(result.sourceId).toBe('msg-binding');
      expect(result.resolution).toBe('UI_BINDING');
    });
  });

  describe('Fallback when UI binding source missing', () => {
    it('should fall through to intent when UI binding source not found', () => {
      const messages = [
        createTestMessage('msg-intent', 'assistant'),
      ];

      const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-intent' });

      const result = resolveExecutionSource({
        intentSnapshot,
        uiSourceMessageId: 'msg-deleted', // Source was deleted
        activeSourceId: null,
        lastTransformSourceId: null,
        messages,
        getLastValidAssistantMessage: () => messages[0],
      });

      // Should fall through to intent snapshot
      expect(result.sourceId).toBe('msg-intent');
      expect(result.resolution).toBe('INTENT_SNAPSHOT');
    });

    it('should fall through to activeSourceId when UI binding not found and no intent', () => {
      const messages = [
        createTestMessage('msg-active', 'assistant'),
      ];

      const result = resolveExecutionSource({
        intentSnapshot: null,
        uiSourceMessageId: 'msg-deleted', // Source was deleted
        activeSourceId: 'msg-active',
        lastTransformSourceId: null,
        messages,
        getLastValidAssistantMessage: () => messages[0],
      });

      expect(result.sourceId).toBe('msg-active');
      expect(result.resolution).toBe('UI_SELECTION');
    });
  });

  describe('UI Binding with matchesIntent', () => {
    it('should set matchesIntent true when UI binding matches intent', () => {
      const messages = [
        createTestMessage('msg-same', 'assistant'),
      ];

      const intentSnapshot = createTestSnapshot({ sourceMessageId: 'msg-same' });

      const result = resolveExecutionSource({
        intentSnapshot,
        uiSourceMessageId: 'msg-same', // Same as intent
        activeSourceId: null,
        lastTransformSourceId: null,
        messages,
        getLastValidAssistantMessage: () => messages[0],
      });

      expect(result.sourceId).toBe('msg-same');
      expect(result.resolution).toBe('UI_BINDING');
      expect(result.matchesIntent).toBe(true);
      expect(result.warning).toBeUndefined(); // No warning when they match
    });
  });
});
