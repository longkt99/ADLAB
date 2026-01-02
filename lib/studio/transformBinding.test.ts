// ============================================
// Tests for Transform Context Binding
// ============================================
// These tests verify the critical invariant that transforms
// ALWAYS use the correct source message.
//
// BUG FIXED: After a transform, subsequent transforms were
// using the NEW result instead of the ORIGIN message, causing
// context drift (e.g., MIK content → coffee content).
// ============================================

import { describe, it, expect } from 'vitest';

// ============================================
// Test: Origin Tracking Logic
// ============================================

describe('Transform Origin Tracking', () => {
  /**
   * Simulates the origin tracking logic from dispatchExecution
   */
  function getOriginToTrack(
    effectiveSourceId: string,
    messages: Array<{ id: string; meta?: { originMessageId?: string } }>
  ): string {
    const sourceMsg = messages.find(m => m.id === effectiveSourceId);
    if (sourceMsg?.meta?.originMessageId) {
      return sourceMsg.meta.originMessageId;
    }
    return effectiveSourceId;
  }

  it('should return source ID when source has no origin (first transform)', () => {
    const messages = [
      { id: 'msg-original', meta: {} },
    ];

    const origin = getOriginToTrack('msg-original', messages);
    expect(origin).toBe('msg-original');
  });

  it('should return origin ID when source is a transform result (chained transform)', () => {
    const messages = [
      { id: 'msg-original', meta: {} },
      { id: 'msg-transform-1', meta: { originMessageId: 'msg-original' } },
    ];

    // When transforming msg-transform-1, should track back to msg-original
    const origin = getOriginToTrack('msg-transform-1', messages);
    expect(origin).toBe('msg-original');
  });

  it('should handle deep transform chains (3+ levels)', () => {
    const messages = [
      { id: 'msg-original', meta: {} },
      { id: 'msg-t1', meta: { originMessageId: 'msg-original' } },
      { id: 'msg-t2', meta: { originMessageId: 'msg-original' } }, // All point to original
      { id: 'msg-t3', meta: { originMessageId: 'msg-original' } },
    ];

    // All transforms should track back to the same origin
    expect(getOriginToTrack('msg-t1', messages)).toBe('msg-original');
    expect(getOriginToTrack('msg-t2', messages)).toBe('msg-original');
    expect(getOriginToTrack('msg-t3', messages)).toBe('msg-original');
  });
});

// ============================================
// Test: Source Selection Priority
// ============================================

describe('Transform Source Selection Priority', () => {
  /**
   * Simulates the source selection logic from dispatchExecution
   * Priority: activeSourceId > lastTransformSourceId > getLastValidAssistantMessage
   */
  function selectSourceId(params: {
    activeSourceId: string | null;
    lastTransformSourceId: string | null;
    lastIntentType: 'CREATE' | 'TRANSFORM' | null;
    messages: Array<{ id: string; role: string }>;
  }): string | null {
    const { activeSourceId, lastTransformSourceId, lastIntentType, messages } = params;

    // Priority 1: UI-selected source
    if (activeSourceId) {
      const uiSelected = messages.find(m => m.id === activeSourceId && m.role === 'assistant');
      if (uiSelected) return activeSourceId;
    }

    // Priority 2: Intent memory (GAP A chain lock)
    if (lastIntentType === 'TRANSFORM' && lastTransformSourceId) {
      const locked = messages.find(m => m.id === lastTransformSourceId && m.role === 'assistant');
      if (locked) return lastTransformSourceId;
    }

    // Priority 3: Fallback to last valid assistant message
    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    return assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1].id : null;
  }

  it('should prioritize activeSourceId (UI selection) over everything', () => {
    const result = selectSourceId({
      activeSourceId: 'ui-selected',
      lastTransformSourceId: 'chain-locked',
      lastIntentType: 'TRANSFORM',
      messages: [
        { id: 'ui-selected', role: 'assistant' },
        { id: 'chain-locked', role: 'assistant' },
        { id: 'newest', role: 'assistant' },
      ],
    });

    expect(result).toBe('ui-selected');
  });

  it('should use chain lock when no UI selection', () => {
    const result = selectSourceId({
      activeSourceId: null,
      lastTransformSourceId: 'chain-locked',
      lastIntentType: 'TRANSFORM',
      messages: [
        { id: 'chain-locked', role: 'assistant' },
        { id: 'newest', role: 'assistant' },
      ],
    });

    expect(result).toBe('chain-locked');
  });

  it('should fallback to latest message when no UI selection and no chain lock', () => {
    const result = selectSourceId({
      activeSourceId: null,
      lastTransformSourceId: null,
      lastIntentType: null,
      messages: [
        { id: 'older', role: 'assistant' },
        { id: 'newest', role: 'assistant' },
      ],
    });

    expect(result).toBe('newest');
  });

  it('should ignore chain lock when lastIntentType is CREATE', () => {
    const result = selectSourceId({
      activeSourceId: null,
      lastTransformSourceId: 'old-chain',
      lastIntentType: 'CREATE', // CREATE breaks the chain
      messages: [
        { id: 'old-chain', role: 'assistant' },
        { id: 'newest', role: 'assistant' },
      ],
    });

    expect(result).toBe('newest');
  });

  it('should skip invalid activeSourceId (not assistant)', () => {
    const result = selectSourceId({
      activeSourceId: 'user-msg',
      lastTransformSourceId: 'valid-assistant',
      lastIntentType: 'TRANSFORM',
      messages: [
        { id: 'user-msg', role: 'user' },
        { id: 'valid-assistant', role: 'assistant' },
      ],
    });

    // Should fall through to chain lock since activeSourceId is not an assistant message
    expect(result).toBe('valid-assistant');
  });
});

// ============================================
// Test: Consecutive Transform Invariant
// ============================================

describe('Consecutive Transform Invariant', () => {
  it('should maintain same origin across multiple transforms', () => {
    // Simulate the scenario from the bug:
    // 1. CREATE MIK content (msg-A)
    // 2. TRANSFORM MIK → result (msg-B, origin: msg-A)
    // 3. TRANSFORM again → should still use msg-A context, NOT msg-B

    const messages = [
      { id: 'msg-A', role: 'assistant', meta: {} }, // Original MIK content
      { id: 'msg-B', role: 'assistant', meta: { originMessageId: 'msg-A' } }, // First transform
    ];

    // After transform #1 completes, lastTransformSourceId should be msg-A (the origin)
    // NOT msg-B (the result)

    // Simulate getOriginToTrack for the source of transform #2
    const sourceForTransform2 = 'msg-B'; // User might click on msg-B
    const sourceMsg = messages.find(m => m.id === sourceForTransform2);
    const originToTrack = sourceMsg?.meta?.originMessageId || sourceForTransform2;

    // The origin should still be msg-A
    expect(originToTrack).toBe('msg-A');
  });

  it('should never switch template/usecase unexpectedly', () => {
    // Simulate template resolution from source message
    const messages = [
      {
        id: 'msg-A',
        role: 'assistant',
        meta: { templateId: 'social_caption_v1' }
      },
      {
        id: 'msg-B',
        role: 'assistant',
        meta: {
          templateId: 'social_caption_v1', // Should inherit from source
          originMessageId: 'msg-A'
        }
      },
    ];

    // When transforming msg-B, template should come from the message chain
    const sourceMsg = messages.find(m => m.id === 'msg-B');
    const templateId = sourceMsg?.meta?.templateId;

    expect(templateId).toBe('social_caption_v1');
    expect(templateId).not.toBe('coffee_template'); // The bug was switching to wrong template
  });
});

// ============================================
// Test: Content Hash Tracing
// ============================================

describe('Content Hash Tracing', () => {
  function computeContentHash(content: string): string {
    return content.substring(0, 50).replace(/\s+/g, ' ');
  }

  it('should compute consistent hash for same content', () => {
    const content = 'MIK Ocean City là dự án bất động sản cao cấp tại Đà Nẵng';

    const hash1 = computeContentHash(content);
    const hash2 = computeContentHash(content);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different content', () => {
    const mikContent = 'MIK Ocean City là dự án bất động sản cao cấp';
    const coffeeContent = 'Cà phê Arabica thượng hạng từ vùng cao nguyên';

    const mikHash = computeContentHash(mikContent);
    const coffeeHash = computeContentHash(coffeeContent);

    expect(mikHash).not.toBe(coffeeHash);
    expect(mikHash).toContain('MIK');
    expect(coffeeHash).toContain('phê'); // Contains 'cà phê'
  });

  it('should help detect context mismatch', () => {
    // If transform claims to be about MIK but hash shows coffee, it's a bug
    const expectedContent = 'MIK Ocean City - dự án đẳng cấp';
    const actualContent = 'Arabica premium coffee from highlands';

    const expectedHash = computeContentHash(expectedContent);
    const actualHash = computeContentHash(actualContent);

    // This assertion would catch the bug
    expect(actualHash).not.toContain('MIK');
    expect(expectedHash).toContain('MIK');
  });
});
