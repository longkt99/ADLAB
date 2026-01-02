// ============================================
// Tests for Intent Summary
// ============================================
// STEP 4: Verify summary derivation, stability,
// and presentation-only behavior.
//
// CRITICAL: These tests verify UX ONLY.
// No execution logic should be affected.
// ============================================

import { describe, it, expect } from 'vitest';
import { createIntentSnapshot } from '../../types/studio';
import type { IntentSummary } from '../../types/studio';
import {
  deriveIntentSummary,
  formatSummaryForDisplay,
  formatSummaryWithPrefix,
  hasMeaningfulSummary,
  getSummaryPartCount,
} from './intentSummary';

// ============================================
// SUMMARY DERIVATION TESTS
// ============================================

describe('deriveIntentSummary', () => {
  it('should derive summary from CREATE snapshot', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'Viết bài về MIK Ocean City',
      detectedMode: 'CREATE',
      detectedActions: ['CREATE_CONTENT'],
      sourceMessageId: null,
      turnIndex: 0,
    });

    const summary = deriveIntentSummary(snapshot);

    expect(summary.primaryAction).toBe('Tạo nội dung');
    expect(summary.displayMode).toBe('CREATE');
    expect(summary.isComplete).toBe(true);
  });

  it('should derive summary from PURE_TRANSFORM snapshot', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'Viết lại',
      detectedMode: 'PURE_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);

    expect(summary.primaryAction).toBe('Viết lại');
    expect(summary.displayMode).toBe('PURE_TRANSFORM');
    expect(summary.isComplete).toBe(true);
  });

  it('should derive summary from DIRECTED_TRANSFORM with modifiers', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại giọng văn chuyên nghiệp',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);

    expect(summary.primaryAction).toBe('Viết lại');
    expect(summary.modifiers).toContain('Giọng chuyên nghiệp');
    expect(summary.displayMode).toBe('DIRECTED_TRANSFORM');
    expect(summary.isComplete).toBe(true);
  });

  it('should extract multiple modifiers and extras', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại giọng tự nhiên hơn, thêm CTA và giữ hashtag',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);

    expect(summary.primaryAction).toBe('Viết lại');
    expect(summary.modifiers).toContain('Giọng tự nhiên');
    expect(summary.extras).toContain('Thêm CTA');
    expect(summary.extras).toContain('Giữ hashtag');
  });

  it('should handle null snapshot gracefully', () => {
    const summary = deriveIntentSummary(null);

    expect(summary.primaryAction).toBe('Không xác định');
    expect(summary.isComplete).toBe(false);
    expect(summary.modifiers).toHaveLength(0);
    expect(summary.extras).toHaveLength(0);
  });

  it('should handle undefined snapshot gracefully', () => {
    const summary = deriveIntentSummary(undefined);

    expect(summary.primaryAction).toBe('Không xác định');
    expect(summary.isComplete).toBe(false);
  });
});

// ============================================
// SUMMARY STABILITY TESTS
// ============================================

describe('Summary Stability', () => {
  it('should produce identical summary for same snapshot', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại giọng chuyên nghiệp hơn',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary1 = deriveIntentSummary(snapshot);
    const summary2 = deriveIntentSummary(snapshot);

    expect(summary1.primaryAction).toBe(summary2.primaryAction);
    expect(summary1.modifiers).toEqual(summary2.modifiers);
    expect(summary1.extras).toEqual(summary2.extras);
    expect(summary1.displayMode).toBe(summary2.displayMode);
    expect(summary1.isComplete).toBe(summary2.isComplete);
  });

  it('should be deterministic across multiple calls', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'rút gọn còn 50 từ, giữ CTA',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['SHORTEN'],
      sourceMessageId: 'msg-456',
      turnIndex: 2,
    });

    // Call 10 times and verify consistency
    const summaries: IntentSummary[] = [];
    for (let i = 0; i < 10; i++) {
      summaries.push(deriveIntentSummary(snapshot));
    }

    const first = summaries[0];
    summaries.forEach((s) => {
      expect(s.primaryAction).toBe(first.primaryAction);
      expect(s.modifiers).toEqual(first.modifiers);
      expect(s.extras).toEqual(first.extras);
    });
  });
});

// ============================================
// SUMMARY IMMUTABILITY TESTS
// ============================================

describe('Summary Immutability', () => {
  it('should return frozen summary object', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại',
      detectedMode: 'PURE_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);

    expect(Object.isFrozen(summary)).toBe(true);
  });

  it('should have frozen modifiers array', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại giọng tự nhiên',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);

    expect(Object.isFrozen(summary.modifiers)).toBe(true);
  });

  it('should have frozen extras array', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại thêm CTA',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);

    expect(Object.isFrozen(summary.extras)).toBe(true);
  });
});

// ============================================
// DISPLAY FORMATTING TESTS
// ============================================

describe('formatSummaryForDisplay', () => {
  it('should format simple action', () => {
    const summary: IntentSummary = {
      primaryAction: 'Viết lại',
      modifiers: [],
      extras: [],
      displayMode: 'PURE_TRANSFORM',
      isComplete: true,
    };

    expect(formatSummaryForDisplay(summary)).toBe('Viết lại');
  });

  it('should format action with modifiers', () => {
    const summary: IntentSummary = {
      primaryAction: 'Viết lại',
      modifiers: ['Giọng chuyên nghiệp'],
      extras: [],
      displayMode: 'DIRECTED_TRANSFORM',
      isComplete: true,
    };

    expect(formatSummaryForDisplay(summary)).toBe('Viết lại · Giọng chuyên nghiệp');
  });

  it('should format action with modifiers and extras', () => {
    const summary: IntentSummary = {
      primaryAction: 'Viết lại',
      modifiers: ['Giọng chuyên nghiệp'],
      extras: ['Thêm CTA'],
      displayMode: 'DIRECTED_TRANSFORM',
      isComplete: true,
    };

    expect(formatSummaryForDisplay(summary)).toBe('Viết lại · Giọng chuyên nghiệp · Thêm CTA');
  });

  it('should handle multiple modifiers and extras', () => {
    const summary: IntentSummary = {
      primaryAction: 'Rút gọn',
      modifiers: ['Ngắn hơn', 'Súc tích'],
      extras: ['Giữ CTA', 'Giữ hashtag'],
      displayMode: 'DIRECTED_TRANSFORM',
      isComplete: true,
    };

    expect(formatSummaryForDisplay(summary)).toBe('Rút gọn · Ngắn hơn · Súc tích · Giữ CTA · Giữ hashtag');
  });
});

describe('formatSummaryWithPrefix', () => {
  const testSummary: IntentSummary = {
    primaryAction: 'Viết lại',
    modifiers: ['Giọng chuyên nghiệp'],
    extras: [],
    displayMode: 'DIRECTED_TRANSFORM',
    isComplete: true,
  };

  it('should format with understanding prefix', () => {
    const result = formatSummaryWithPrefix(testSummary, 'understanding');
    expect(result).toBe('Đã hiểu: Viết lại · Giọng chuyên nghiệp');
  });

  it('should format with processing prefix', () => {
    const result = formatSummaryWithPrefix(testSummary, 'processing');
    expect(result).toBe('Đang xử lý: Viết lại · Giọng chuyên nghiệp');
  });

  it('should format with completed prefix', () => {
    const result = formatSummaryWithPrefix(testSummary, 'completed');
    expect(result).toBe('Hoàn thành: Viết lại · Giọng chuyên nghiệp');
  });
});

// ============================================
// UTILITY FUNCTION TESTS
// ============================================

describe('hasMeaningfulSummary', () => {
  it('should return true for complete summary', () => {
    const summary: IntentSummary = {
      primaryAction: 'Viết lại',
      modifiers: [],
      extras: [],
      displayMode: 'PURE_TRANSFORM',
      isComplete: true,
    };

    expect(hasMeaningfulSummary(summary)).toBe(true);
  });

  it('should return true for incomplete summary with modifiers', () => {
    const summary: IntentSummary = {
      primaryAction: 'Không xác định',
      modifiers: ['Giọng chuyên nghiệp'],
      extras: [],
      displayMode: 'DIRECTED_TRANSFORM',
      isComplete: false,
    };

    expect(hasMeaningfulSummary(summary)).toBe(true);
  });

  it('should return true for incomplete summary with extras', () => {
    const summary: IntentSummary = {
      primaryAction: 'Không xác định',
      modifiers: [],
      extras: ['Thêm CTA'],
      displayMode: 'DIRECTED_TRANSFORM',
      isComplete: false,
    };

    expect(hasMeaningfulSummary(summary)).toBe(true);
  });

  it('should return false for empty incomplete summary', () => {
    const summary: IntentSummary = {
      primaryAction: 'Không xác định',
      modifiers: [],
      extras: [],
      displayMode: 'CREATE',
      isComplete: false,
    };

    expect(hasMeaningfulSummary(summary)).toBe(false);
  });
});

describe('getSummaryPartCount', () => {
  it('should count action only', () => {
    const summary: IntentSummary = {
      primaryAction: 'Viết lại',
      modifiers: [],
      extras: [],
      displayMode: 'PURE_TRANSFORM',
      isComplete: true,
    };

    expect(getSummaryPartCount(summary)).toBe(1);
  });

  it('should count action and modifiers', () => {
    const summary: IntentSummary = {
      primaryAction: 'Viết lại',
      modifiers: ['Giọng chuyên nghiệp', 'Ngắn hơn'],
      extras: [],
      displayMode: 'DIRECTED_TRANSFORM',
      isComplete: true,
    };

    expect(getSummaryPartCount(summary)).toBe(3);
  });

  it('should count all parts', () => {
    const summary: IntentSummary = {
      primaryAction: 'Viết lại',
      modifiers: ['Giọng chuyên nghiệp'],
      extras: ['Thêm CTA', 'Giữ hashtag'],
      displayMode: 'DIRECTED_TRANSFORM',
      isComplete: true,
    };

    expect(getSummaryPartCount(summary)).toBe(4);
  });
});

// ============================================
// CHAIN STABILITY TESTS
// ============================================

describe('Summary Chain Stability', () => {
  it('should derive consistent summaries across transform chain', () => {
    // CREATE
    const createSnapshot = createIntentSnapshot({
      userTypedText: 'Viết bài về MIK',
      detectedMode: 'CREATE',
      detectedActions: ['CREATE_CONTENT'],
      sourceMessageId: null,
      turnIndex: 0,
    });

    // TRANSFORM 1
    const transform1Snapshot = createIntentSnapshot({
      userTypedText: 'viết lại giọng chuyên nghiệp',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-1',
      turnIndex: 1,
      originSnapshotId: createSnapshot.snapshotId,
    });

    // TRANSFORM 2
    const transform2Snapshot = createIntentSnapshot({
      userTypedText: 'rút gọn còn 50 từ',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['SHORTEN'],
      sourceMessageId: 'msg-2',
      turnIndex: 2,
      originSnapshotId: createSnapshot.snapshotId,
    });

    const createSummary = deriveIntentSummary(createSnapshot);
    const transform1Summary = deriveIntentSummary(transform1Snapshot);
    const transform2Summary = deriveIntentSummary(transform2Snapshot);

    // Each should have correct primary action
    expect(createSummary.primaryAction).toBe('Tạo nội dung');
    expect(transform1Summary.primaryAction).toBe('Viết lại');
    expect(transform2Summary.primaryAction).toBe('Rút gọn');

    // Each should be complete
    expect(createSummary.isComplete).toBe(true);
    expect(transform1Summary.isComplete).toBe(true);
    expect(transform2Summary.isComplete).toBe(true);
  });
});

// ============================================
// NO EXECUTION LOGIC TESTS
// ============================================

describe('Summary does NOT affect execution', () => {
  it('summary should be pure data with no methods', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại',
      detectedMode: 'PURE_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);

    // Summary should have no methods
    const keys = Object.keys(summary) as Array<keyof IntentSummary>;
    keys.forEach((key) => {
      expect(typeof summary[key]).not.toBe('function');
    });
  });

  it('deriveIntentSummary should be a pure function with no side effects', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại giọng tự nhiên',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    // Store original values
    const originalUserTypedText = snapshot.userTypedText;
    const originalDetectedMode = snapshot.detectedMode;
    const originalDetectedActions = [...snapshot.detectedActions];

    // Derive summary multiple times
    deriveIntentSummary(snapshot);
    deriveIntentSummary(snapshot);
    deriveIntentSummary(snapshot);

    // Snapshot should be unchanged
    expect(snapshot.userTypedText).toBe(originalUserTypedText);
    expect(snapshot.detectedMode).toBe(originalDetectedMode);
    expect([...snapshot.detectedActions]).toEqual(originalDetectedActions);
  });
});

// ============================================
// VIETNAMESE PATTERN TESTS
// ============================================

describe('Vietnamese Pattern Recognition', () => {
  it('should recognize "giọng tự nhiên" modifier', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại giọng tự nhiên hơn',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);
    expect(summary.modifiers).toContain('Giọng tự nhiên');
  });

  it('should recognize "thêm hotline" extra', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại thêm hotline 0909123456',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);
    expect(summary.extras).toContain('Thêm hotline');
  });

  it('should recognize "giữ CTA" directive', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'rút gọn nhưng giữ nguyên CTA',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['SHORTEN'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);
    expect(summary.extras).toContain('Giữ CTA');
  });

  it('should recognize "theo phong cách" modifier', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại theo phong cách Gen Z',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);
    expect(summary.modifiers).toContain('Theo phong cách');
  });

  it('should recognize "nhấn mạnh lợi ích" extra', () => {
    const snapshot = createIntentSnapshot({
      userTypedText: 'viết lại và nhấn mạnh vào lợi ích cho khách hàng',
      detectedMode: 'DIRECTED_TRANSFORM',
      detectedActions: ['REWRITE'],
      sourceMessageId: 'msg-123',
      turnIndex: 1,
    });

    const summary = deriveIntentSummary(snapshot);
    expect(summary.extras).toContain('Nhấn mạnh lợi ích');
  });
});
