// ============================================
// Tests for Action Classifier
// ============================================
// STEP 2 HARDENING: Tests for detectTransformMode
// to ensure Vietnamese instructions are properly classified.
// ============================================

import { describe, it, expect } from 'vitest';
import { detectTransformMode, classifyAction } from './actionClassifier';

// ============================================
// DETECT TRANSFORM MODE TESTS
// ============================================

describe('detectTransformMode', () => {
  describe('PURE_TRANSFORM (verb only, no directives)', () => {
    it('should return PURE_TRANSFORM for simple verb "Viết lại"', () => {
      expect(detectTransformMode('Viết lại')).toBe('PURE_TRANSFORM');
    });

    it('should return PURE_TRANSFORM for "Rút gọn"', () => {
      expect(detectTransformMode('Rút gọn')).toBe('PURE_TRANSFORM');
    });

    it('should return PURE_TRANSFORM for "Mở rộng"', () => {
      expect(detectTransformMode('Mở rộng')).toBe('PURE_TRANSFORM');
    });
  });

  describe('DIRECTED_TRANSFORM (verb + directives)', () => {
    // ============================================
    // REGRESSION TESTS: These are the cases that caused bugs
    // ============================================

    it('should return DIRECTED_TRANSFORM for "viết lại giọng tự nhiên hơn"', () => {
      // This was the exact bug: "viết lại giọng tự nhiên hơn" was classified as PURE_TRANSFORM
      // causing the display to show only "Viết lại" instead of the full instruction
      expect(detectTransformMode('viết lại giọng tự nhiên hơn')).toBe('DIRECTED_TRANSFORM');
    });

    it('should return DIRECTED_TRANSFORM for "viết lại chuyên nghiệp hơn"', () => {
      expect(detectTransformMode('viết lại chuyên nghiệp hơn')).toBe('DIRECTED_TRANSFORM');
    });

    it('should return DIRECTED_TRANSFORM for "viết lại ngắn gọn hơn"', () => {
      expect(detectTransformMode('viết lại ngắn gọn hơn')).toBe('DIRECTED_TRANSFORM');
    });

    // ============================================
    // STRONG SIGNAL TESTS
    // ============================================

    it('should return DIRECTED_TRANSFORM for "viết lại theo phong cách Gen Z"', () => {
      expect(detectTransformMode('viết lại theo phong cách Gen Z')).toBe('DIRECTED_TRANSFORM');
    });

    it('should return DIRECTED_TRANSFORM for "viết lại giọng văn chuyên nghiệp"', () => {
      expect(detectTransformMode('viết lại giọng văn chuyên nghiệp')).toBe('DIRECTED_TRANSFORM');
    });

    it('should return DIRECTED_TRANSFORM for "thêm phần chi tiết về sản phẩm"', () => {
      expect(detectTransformMode('thêm phần chi tiết về sản phẩm')).toBe('DIRECTED_TRANSFORM');
    });

    it('should return DIRECTED_TRANSFORM for "giữ nguyên ý, đổi cách diễn đạt"', () => {
      expect(detectTransformMode('giữ nguyên ý, đổi cách diễn đạt')).toBe('DIRECTED_TRANSFORM');
    });

    it('should return DIRECTED_TRANSFORM for "nhấn mạnh vào lợi ích"', () => {
      expect(detectTransformMode('nhấn mạnh vào lợi ích')).toBe('DIRECTED_TRANSFORM');
    });

    // ============================================
    // WEAK SIGNAL TESTS (2+ signals = DIRECTED)
    // ============================================

    it('should return DIRECTED_TRANSFORM for "viết chuyên nghiệp hơn"', () => {
      // "chuyên nghiệp" (weak) + "hơn" (weak) = 2 weak signals
      expect(detectTransformMode('viết chuyên nghiệp hơn')).toBe('DIRECTED_TRANSFORM');
    });

    it('should return DIRECTED_TRANSFORM for "ngắn gọn súc tích"', () => {
      // "ngắn gọn" (weak) + "súc tích" (weak) = 2 weak signals
      expect(detectTransformMode('ngắn gọn súc tích')).toBe('DIRECTED_TRANSFORM');
    });

    // ============================================
    // EDGE CASES
    // ============================================

    it('should return DIRECTED_TRANSFORM for multi-intent with strong signals', () => {
      // Multi-intent with "thêm phần" (strong signal)
      const instruction = 'viết lại + thêm phần chi tiết về giá + rút gọn';
      expect(detectTransformMode(instruction)).toBe('DIRECTED_TRANSFORM');
    });

    it('should return DIRECTED_TRANSFORM for Vietnamese pattern "giọng X hơn"', () => {
      expect(detectTransformMode('giọng tự nhiên hơn')).toBe('DIRECTED_TRANSFORM');
    });

    it('should return DIRECTED_TRANSFORM for "viết ngắn hơn" with 2 weak signals', () => {
      // "ngắn gọn" + "hơn" = 2 weak signals
      expect(detectTransformMode('viết ngắn gọn hơn')).toBe('DIRECTED_TRANSFORM');
    });

    // Note: "viết ngắn hơn" only has 1 weak signal ("hơn") so it's PURE_TRANSFORM
    // This is acceptable because it's borderline - could go either way
    it('should return PURE_TRANSFORM for "viết ngắn hơn" (only 1 weak signal)', () => {
      expect(detectTransformMode('viết ngắn hơn')).toBe('PURE_TRANSFORM');
    });
  });
});

// ============================================
// CLASSIFY ACTION TESTS
// ============================================

describe('classifyAction', () => {
  describe('REWRITE action detection', () => {
    it('should classify "viết lại" as REWRITE', () => {
      const result = classifyAction('viết lại');
      expect(result.type).toBe('REWRITE');
      expect(result.category).toBe('transform');
    });

    it('should classify "viết lại giọng tự nhiên hơn" as REWRITE', () => {
      const result = classifyAction('viết lại giọng tự nhiên hơn');
      expect(result.type).toBe('REWRITE');
      expect(result.category).toBe('transform');
    });
  });

  describe('SHORTEN action detection', () => {
    it('should classify "rút gọn" as SHORTEN', () => {
      const result = classifyAction('rút gọn');
      expect(result.type).toBe('SHORTEN');
      expect(result.category).toBe('transform');
    });

    it('should classify "rút gọn còn 50 từ" as SHORTEN', () => {
      const result = classifyAction('rút gọn còn 50 từ');
      expect(result.type).toBe('SHORTEN');
      expect(result.category).toBe('transform');
    });
  });

  describe('EXPAND action detection', () => {
    it('should classify "mở rộng" as EXPAND', () => {
      const result = classifyAction('mở rộng');
      expect(result.type).toBe('EXPAND');
      expect(result.category).toBe('transform');
    });
  });

  describe('CREATE action detection', () => {
    it('should classify "Viết bài về du lịch Đà Nẵng" as CREATE_CONTENT (generation)', () => {
      const result = classifyAction('Viết bài về du lịch Đà Nẵng');
      expect(result.type).toBe('CREATE_CONTENT');
      expect(result.category).toBe('generation');
    });
  });
});

// ============================================
// REGRESSION TESTS: Prompt 3+ Truncation
// ============================================
// These tests ensure the bug where prompt 3+ showed
// truncated text (e.g., "Viết lại" instead of "viết lại giọng tự nhiên hơn")
// is prevented.

describe('Regression: Prompt 3+ classification stability', () => {
  it('should consistently classify DIRECTED_TRANSFORM for rewrite instructions', () => {
    // These REWRITE instructions have clear directive signals and should be DIRECTED_TRANSFORM
    const directedInstructions = [
      'viết lại giọng tự nhiên hơn',  // "tự nhiên" (weak) + "hơn" (weak) = DIRECTED
      'viết lại chuyên nghiệp hơn',   // "chuyên nghiệp" (weak) + "hơn" (weak) = DIRECTED
      'viết lại theo phong cách Gen Z', // "theo phong cách" (strong) = DIRECTED
    ];

    // Simulate 3 consecutive transforms
    directedInstructions.forEach((instruction) => {
      const result = classifyAction(instruction);
      const mode = detectTransformMode(instruction);

      // All should be DIRECTED_TRANSFORM because they have clear directive signals
      expect(mode).toBe('DIRECTED_TRANSFORM');
      expect(result.category).toBe('transform');
      expect(result.type).toBe('REWRITE');
    });
  });

  it('should preserve transformMode detection regardless of call order', () => {
    // Call in different orders to ensure no state leakage
    expect(detectTransformMode('Viết lại')).toBe('PURE_TRANSFORM');
    expect(detectTransformMode('viết lại giọng tự nhiên hơn')).toBe('DIRECTED_TRANSFORM');
    expect(detectTransformMode('Viết lại')).toBe('PURE_TRANSFORM'); // Should still be PURE
    expect(detectTransformMode('viết lại giọng tự nhiên hơn')).toBe('DIRECTED_TRANSFORM'); // Should still be DIRECTED
  });

  it('should correctly handle the exact bug case: "viết lại giọng tự nhiên hơn"', () => {
    // This is the EXACT instruction that caused the bug
    // It should be DIRECTED_TRANSFORM so the full instruction is passed to LLM
    const instruction = 'viết lại giọng tự nhiên hơn';
    expect(detectTransformMode(instruction)).toBe('DIRECTED_TRANSFORM');

    // Verify classifyAction also returns correct category
    const result = classifyAction(instruction);
    expect(result.type).toBe('REWRITE');
    expect(result.category).toBe('transform');
  });
});
