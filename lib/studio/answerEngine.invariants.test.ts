// ============================================
// Answer Engine Invariants - Regression Tests
// ============================================
// These tests assert EXISTING behavior only.
// They act as tripwires against future regression.
//
// ⚠️ WARNING: Do NOT modify these tests unless
// you are intentionally changing system behavior.
// Any change requires updating docs/system-invariants.md
// ============================================

import { describe, it, expect } from 'vitest';
import {
  detectTaskType,
  formatAnswerEngineContract,
  type TaskDetectionContext,
} from './answerEngine';
import {
  injectAnchors,
  validateAnchors,
  stripAnchors,
} from './rewriteAnchors';
import {
  validateRewriteDiff,
  MAX_LENGTH_RATIO,
  MIN_KEYWORD_PRESERVATION_RATIO,
  MAX_SENTENCE_REPLACEMENT_RATIO,
} from './rewriteDiffGuard';
import {
  FAILURE_TAXONOMY,
  getFailureMetadata,
  formatFailureClassification,
} from './failureTaxonomy';
import type { AiReasonCode } from './errorMessages';

// ============================================
// INVARIANT 1: REWRITE_UPGRADE Detection
// ============================================

describe('INVARIANT: REWRITE_UPGRADE Detection', () => {
  const rewriteContext: TaskDetectionContext = {
    hasActiveDraft: true,
    hasPreviousMessages: true,
    lang: 'vi',
  };

  const noContextContext: TaskDetectionContext = {
    hasActiveDraft: false,
    hasPreviousMessages: false,
    lang: 'vi',
  };

  it('MUST detect REWRITE_UPGRADE when user has draft and requests rewrite', () => {
    const rewritePrompts = [
      'viết lại hay hơn',
      'cải thiện bài này',
      'polish this',
      'make it better',
      'rewrite this',
    ];

    for (const prompt of rewritePrompts) {
      const result = detectTaskType(prompt, rewriteContext);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    }
  });

  it('detection uses context signals from TaskDetectionContext', () => {
    // This test documents that detection is context-aware
    const withDraft = detectTaskType('viết lại hay hơn', rewriteContext);
    const withoutDraft = detectTaskType('viết lại hay hơn', noContextContext);

    // With draft context, should detect REWRITE_UPGRADE
    expect(withDraft.taskType).toBe('REWRITE_UPGRADE');

    // Both results have signals - detection always analyzes
    expect(withDraft.signals).toBeDefined();
    expect(withoutDraft.signals).toBeDefined();
  });
});

// ============================================
// INVARIANT 2: Anchor Guard Behavior
// ============================================

describe('INVARIANT: Anchor Guard Behavior', () => {
  it('MUST inject anchors for multi-paragraph content', () => {
    const content = `First paragraph with enough text.

Second paragraph with enough text.

Third paragraph with enough text.`;

    const result = injectAnchors(content);

    expect(result.paragraphCount).toBe(3);
    expect(result.anchorIds).toEqual(['<<P1>>', '<<P2>>', '<<P3>>']);
  });

  it('MUST NOT anchor short paragraphs (< 10 chars)', () => {
    const content = `Real paragraph with content.

x

Another real paragraph.`;

    const result = injectAnchors(content);

    // Only 2 real paragraphs anchored
    expect(result.paragraphCount).toBe(2);
  });

  it('MUST fail validation when anchor is missing', () => {
    const output = `<<P1>>
First paragraph.

<<P3>>
Third paragraph.`;

    const expected = ['<<P1>>', '<<P2>>', '<<P3>>'];
    const result = validateAnchors(output, expected);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('<<P2>>');
  });

  it('MUST fail validation when extra anchor is added', () => {
    const output = `<<P1>>
First.

<<P2>>
Second.

<<P3>>
Extra section added.`;

    const expected = ['<<P1>>', '<<P2>>'];
    const result = validateAnchors(output, expected);

    expect(result.valid).toBe(false);
    expect(result.extra).toContain('<<P3>>');
  });

  it('MUST fail validation when anchor order changes', () => {
    const output = `<<P2>>
Second first.

<<P1>>
First second.`;

    const expected = ['<<P1>>', '<<P2>>'];
    const result = validateAnchors(output, expected);

    expect(result.valid).toBe(false);
    expect(result.orderPreserved).toBe(false);
  });

  it('MUST strip anchors from final output', () => {
    const output = `<<P1>>
First paragraph.

<<P2>>
Second paragraph.`;

    const stripped = stripAnchors(output);

    expect(stripped).not.toContain('<<P1>>');
    expect(stripped).not.toContain('<<P2>>');
    expect(stripped).toContain('First paragraph.');
    expect(stripped).toContain('Second paragraph.');
  });
});

// ============================================
// INVARIANT 3: Diff Guard Thresholds (LOCKED)
// ============================================

describe('INVARIANT: Diff Guard Thresholds', () => {
  it('MAX_LENGTH_RATIO MUST be 1.5', () => {
    expect(MAX_LENGTH_RATIO).toBe(1.5);
  });

  it('MIN_KEYWORD_PRESERVATION_RATIO MUST be 0.6', () => {
    expect(MIN_KEYWORD_PRESERVATION_RATIO).toBe(0.6);
  });

  it('MAX_SENTENCE_REPLACEMENT_RATIO MUST be 0.4', () => {
    expect(MAX_SENTENCE_REPLACEMENT_RATIO).toBe(0.4);
  });
});

// ============================================
// INVARIANT 4: Diff Guard Failure Conditions
// ============================================

describe('INVARIANT: Diff Guard Failure Conditions', () => {
  it('MUST fail when output exceeds length ratio', () => {
    const source = `<<P1>>
Short original text.`;

    const output = `<<P1>>
This is a much much much much much much much much much much much much much much longer text that exceeds the allowed ratio significantly.`;

    const result = validateRewriteDiff(source, output);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('LENGTH_EXCEEDED');
  });

  it('MUST fail when CTA is added to content without CTA', () => {
    const source = `<<P1>>
Our product is designed with quality materials for excellent durability.`;

    const output = `<<P1>>
Our product is designed with quality materials. Mua ngay hôm nay!`;

    const result = validateRewriteDiff(source, output);

    expect(result.ok).toBe(false);
    // CTA_ADDED or SENTENCE_REPLACEMENT_EXCEEDED are both valid failures
    expect(['CTA_ADDED', 'SENTENCE_REPLACEMENT_EXCEEDED']).toContain(result.reason);
  });

  it('MUST pass for conservative polish', () => {
    const source = `<<P1>>
The product have many feature that customer love.`;

    const output = `<<P1>>
The product has many features that customers love.`;

    const result = validateRewriteDiff(source, output);

    expect(result.ok).toBe(true);
  });
});

// ============================================
// INVARIANT 5: Failure Classification
// ============================================

describe('INVARIANT: Every Failure Has Classification', () => {
  const allReasonCodes: AiReasonCode[] = [
    'EMPTY_USER_PROMPT',
    'MISSING_SYSTEM',
    'INVALID_META',
    'BINDING_MISMATCH',
    'REWRITE_NO_CONTEXT',
    'REWRITE_ANCHOR_MISMATCH',
    'REWRITE_DIFF_EXCEEDED',
    'EDIT_SCOPE_REQUIRED',
    'EXECUTION_BLOCKED',
    'UNKNOWN',
  ];

  it('MUST have taxonomy entry for every reason code', () => {
    for (const code of allReasonCodes) {
      expect(FAILURE_TAXONOMY[code]).toBeDefined();
    }
  });

  it('MUST have layer classification for every failure', () => {
    for (const code of allReasonCodes) {
      const meta = getFailureMetadata(code);
      expect(meta.layer).toBeTruthy();
    }
  });

  it('MUST have retryable flag for every failure', () => {
    for (const code of allReasonCodes) {
      const meta = getFailureMetadata(code);
      expect(typeof meta.retryable).toBe('boolean');
    }
  });

  it('MUST have userFixable flag for every failure', () => {
    for (const code of allReasonCodes) {
      const meta = getFailureMetadata(code);
      expect(typeof meta.userFixable).toBe('boolean');
    }
  });

  it('MUST have debugHint for every failure', () => {
    for (const code of allReasonCodes) {
      const meta = getFailureMetadata(code);
      expect(meta.debugHint).toBeTruthy();
    }
  });

  it('formatFailureClassification MUST return valid structure', () => {
    const result = formatFailureClassification('REWRITE_DIFF_EXCEEDED');

    expect(result).toHaveProperty('reasonCode');
    expect(result).toHaveProperty('layer');
    expect(result).toHaveProperty('retryable');
    expect(result).toHaveProperty('userFixable');
    expect(result).toHaveProperty('debugHint');
  });
});

// ============================================
// INVARIANT 6: REWRITE_UPGRADE Contract Content
// ============================================

describe('INVARIANT: REWRITE_UPGRADE Contract', () => {
  it('MUST forbid topic change', () => {
    const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
    expect(contract).toContain('KHÔNG thay đổi chủ đề');
  });

  it('MUST forbid adding new sections', () => {
    const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
    expect(contract).toContain('KHÔNG thêm section mới');
  });

  it('MUST forbid adding CTA if source has none', () => {
    const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
    expect(contract).toContain('KHÔNG thêm CTA nếu bài gốc KHÔNG có CTA');
  });

  it('MUST forbid brand switching', () => {
    const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
    expect(contract).toContain('KHÔNG đổi brand/sản phẩm/dịch vụ');
  });

  it('MUST require preserving paragraph structure', () => {
    const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
    expect(contract).toContain('CẤU TRÚC đoạn văn gốc');
  });

  it('MUST state output is same post written better', () => {
    const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
    expect(contract).toContain('cùng bài viết');
    expect(contract).toContain('KHÔNG phải bài mới');
  });
});

// ============================================
// INVARIANT 7: No Silent Fallback
// ============================================

describe('INVARIANT: No Silent Fallback on Failure', () => {
  it('REWRITE_NO_CONTEXT MUST NOT be retryable', () => {
    const meta = getFailureMetadata('REWRITE_NO_CONTEXT');
    expect(meta.retryable).toBe(false);
  });

  it('BINDING_MISMATCH MUST NOT be retryable', () => {
    const meta = getFailureMetadata('BINDING_MISMATCH');
    expect(meta.retryable).toBe(false);
  });

  it('EXECUTION_BLOCKED MUST NOT be retryable', () => {
    const meta = getFailureMetadata('EXECUTION_BLOCKED');
    expect(meta.retryable).toBe(false);
  });
});

// ============================================
// INVARIANT 8: Anchor/Diff Guard Separation
// ============================================

describe('INVARIANT: Guard Layer Separation', () => {
  it('REWRITE_ANCHOR_MISMATCH MUST be in Structural Anchor Guard layer', () => {
    const meta = getFailureMetadata('REWRITE_ANCHOR_MISMATCH');
    expect(meta.layer).toBe('Structural Anchor Guard');
  });

  it('REWRITE_DIFF_EXCEEDED MUST be in Rewrite Diff Guard layer', () => {
    const meta = getFailureMetadata('REWRITE_DIFF_EXCEEDED');
    expect(meta.layer).toBe('Rewrite Diff Guard');
  });

  it('REWRITE_NO_CONTEXT MUST be in Context Guard layer', () => {
    const meta = getFailureMetadata('REWRITE_NO_CONTEXT');
    expect(meta.layer).toBe('Context Guard');
  });
});
