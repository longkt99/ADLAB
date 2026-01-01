// ============================================
// STEP 22: Rewrite Anchors Tests
// ============================================
// Tests for paragraph anchoring in REWRITE_UPGRADE mode.
// Verifies anchor injection, validation, and stripping.
// ============================================

import { describe, it, expect } from 'vitest';
import {
  injectAnchors,
  extractAnchors,
  validateAnchors,
  stripAnchors,
  shouldApplyAnchors,
  buildAnchoredSourceReference,
  getAnchorContractRules,
} from './rewriteAnchors';

// ============================================
// Test: injectAnchors
// ============================================

describe('injectAnchors', () => {
  it('should inject anchors for multiple paragraphs', () => {
    const content = `First paragraph with enough text to count.

Second paragraph also with sufficient length.

Third paragraph completing the test content.`;

    const result = injectAnchors(content);

    expect(result.paragraphCount).toBe(3);
    expect(result.anchorIds).toEqual(['<<P1>>', '<<P2>>', '<<P3>>']);
    expect(result.anchoredText).toContain('<<P1>>');
    expect(result.anchoredText).toContain('<<P2>>');
    expect(result.anchoredText).toContain('<<P3>>');
  });

  it('should handle single paragraph', () => {
    const content = 'Single paragraph with enough content to be anchored.';
    const result = injectAnchors(content);

    expect(result.paragraphCount).toBe(1);
    expect(result.anchorIds).toEqual(['<<P1>>']);
  });

  it('should skip short/empty paragraphs', () => {
    const content = `Real paragraph with content here.

short

Another real paragraph with actual content.`;

    const result = injectAnchors(content);

    // Only paragraphs >= 10 chars are anchored
    expect(result.paragraphCount).toBe(2);
    expect(result.anchorIds).toEqual(['<<P1>>', '<<P2>>']);
  });

  it('should handle empty content', () => {
    const result = injectAnchors('');
    expect(result.paragraphCount).toBe(0);
    expect(result.anchorIds).toEqual([]);
    expect(result.anchoredText).toBe('');
  });

  it('should preserve paragraph content', () => {
    const content = `First paragraph content here.

Second paragraph content here.`;

    const result = injectAnchors(content);

    expect(result.anchoredText).toContain('First paragraph content here.');
    expect(result.anchoredText).toContain('Second paragraph content here.');
  });
});

// ============================================
// Test: extractAnchors
// ============================================

describe('extractAnchors', () => {
  it('should extract anchors in order', () => {
    const output = `<<P1>>
First paragraph rewritten.

<<P2>>
Second paragraph rewritten.

<<P3>>
Third paragraph rewritten.`;

    const anchors = extractAnchors(output);
    expect(anchors).toEqual(['<<P1>>', '<<P2>>', '<<P3>>']);
  });

  it('should handle output without anchors', () => {
    const output = 'No anchors here at all.';
    const anchors = extractAnchors(output);
    expect(anchors).toEqual([]);
  });

  it('should handle duplicate anchors', () => {
    const output = `<<P1>>
Content.

<<P1>>
Duplicate anchor.`;

    const anchors = extractAnchors(output);
    expect(anchors).toEqual(['<<P1>>', '<<P1>>']);
  });
});

// ============================================
// Test: validateAnchors
// ============================================

describe('validateAnchors', () => {
  it('should pass when all anchors present in correct order', () => {
    const output = `<<P1>>
First paragraph.

<<P2>>
Second paragraph.

<<P3>>
Third paragraph.`;

    const expected = ['<<P1>>', '<<P2>>', '<<P3>>'];
    const result = validateAnchors(output, expected);

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
    expect(result.orderPreserved).toBe(true);
  });

  it('should fail when anchor is missing', () => {
    const output = `<<P1>>
First paragraph.

<<P3>>
Third paragraph.`;

    const expected = ['<<P1>>', '<<P2>>', '<<P3>>'];
    const result = validateAnchors(output, expected);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('<<P2>>');
    expect(result.error).toContain('Missing anchors');
  });

  it('should fail when extra anchor is added', () => {
    const output = `<<P1>>
First paragraph.

<<P2>>
Second paragraph.

<<P3>>
Third paragraph.

<<P4>>
Extra paragraph.`;

    const expected = ['<<P1>>', '<<P2>>', '<<P3>>'];
    const result = validateAnchors(output, expected);

    expect(result.valid).toBe(false);
    expect(result.extra).toContain('<<P4>>');
    expect(result.error).toContain('Extra anchors');
  });

  it('should fail when anchor order changes', () => {
    const output = `<<P2>>
Second first.

<<P1>>
First second.

<<P3>>
Third unchanged.`;

    const expected = ['<<P1>>', '<<P2>>', '<<P3>>'];
    const result = validateAnchors(output, expected);

    expect(result.valid).toBe(false);
    expect(result.orderPreserved).toBe(false);
    expect(result.error).toContain('Anchor order changed');
  });

  it('should fail when anchors are merged (missing)', () => {
    const output = `<<P1>>
First and second merged.

<<P3>>
Third unchanged.`;

    const expected = ['<<P1>>', '<<P2>>', '<<P3>>'];
    const result = validateAnchors(output, expected);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('<<P2>>');
  });

  it('should fail when paragraphs are split (extra anchors)', () => {
    // LLM split a paragraph into two, adding <<P99>> as extra
    const output = `<<P1>>
First part.

<<P99>>
First part continued (split).

<<P2>>
Second unchanged.`;

    const expected = ['<<P1>>', '<<P2>>'];
    const result = validateAnchors(output, expected);

    expect(result.valid).toBe(false);
    expect(result.extra).toContain('<<P99>>');
  });

  it('should pass with empty expected (no anchors needed)', () => {
    const output = 'Content without anchors.';
    const expected: string[] = [];
    const result = validateAnchors(output, expected);

    expect(result.valid).toBe(true);
  });
});

// ============================================
// Test: stripAnchors
// ============================================

describe('stripAnchors', () => {
  it('should remove all anchors from output', () => {
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

  it('should preserve content between anchors', () => {
    const output = `<<P1>>
Content with **bold** and _italic_.

<<P2>>
More content here.`;

    const stripped = stripAnchors(output);

    expect(stripped).toContain('Content with **bold** and _italic_.');
    expect(stripped).toContain('More content here.');
  });

  it('should handle output without anchors', () => {
    const output = 'No anchors here.';
    const stripped = stripAnchors(output);
    expect(stripped).toBe('No anchors here.');
  });

  it('should clean up extra newlines after anchor removal', () => {
    const output = `<<P1>>
Content.`;

    const stripped = stripAnchors(output);
    // Should not have leading newline
    expect(stripped).toBe('Content.');
  });
});

// ============================================
// Test: shouldApplyAnchors
// ============================================

describe('shouldApplyAnchors', () => {
  it('should return true for 2+ paragraphs', () => {
    const content = `First paragraph here.

Second paragraph here.`;

    expect(shouldApplyAnchors(content)).toBe(true);
  });

  it('should return false for single paragraph', () => {
    const content = 'Single paragraph only.';
    expect(shouldApplyAnchors(content)).toBe(false);
  });

  it('should return false for empty content', () => {
    expect(shouldApplyAnchors('')).toBe(false);
  });

  it('should count only substantial paragraphs', () => {
    const content = `Real paragraph here.

x

Another real paragraph.`;

    // "x" is too short, so only 2 real paragraphs
    expect(shouldApplyAnchors(content)).toBe(true);
  });
});

// ============================================
// Test: buildAnchoredSourceReference
// ============================================

describe('buildAnchoredSourceReference', () => {
  it('should build formatted reference with anchors', () => {
    const content = `First paragraph for rewriting.

Second paragraph for rewriting.`;

    const { reference, anchors } = buildAnchoredSourceReference(content);

    expect(anchors.paragraphCount).toBe(2);
    expect(reference).toContain('SOURCE CONTENT TO REWRITE');
    expect(reference).toContain('<<P1>>');
    expect(reference).toContain('<<P2>>');
    // Check for anchor count (with markdown bold)
    expect(reference).toContain('ANCHOR COUNT:**');
    expect(reference).toContain('2 paragraphs');
  });
});

// ============================================
// Test: getAnchorContractRules
// ============================================

describe('getAnchorContractRules', () => {
  it('should return Vietnamese rules', () => {
    const rules = getAnchorContractRules('vi');

    expect(rules).toContain('QUY TẮC ANCHOR');
    expect(rules).toContain('<<P1>>');
    expect(rules).toContain('Vi phạm anchor = output bị từ chối');
  });

  it('should return English rules', () => {
    const rules = getAnchorContractRules('en');

    expect(rules).toContain('ANCHOR RULES');
    expect(rules).toContain('<<P1>>');
    expect(rules).toContain('Anchor violation = output rejected');
  });
});

// ============================================
// Integration Test: Full Pipeline
// ============================================

describe('Anchor Pipeline Integration', () => {
  it('should handle full inject -> validate -> strip pipeline', () => {
    // 1. Original content
    const original = `First paragraph with substantial content here.

Second paragraph with more substantial content.

Third paragraph completing the article.`;

    // 2. Inject anchors
    const injected = injectAnchors(original);
    expect(injected.paragraphCount).toBe(3);

    // 3. Simulate LLM output with preserved anchors
    const llmOutput = `<<P1>>
First paragraph rewritten with better style.

<<P2>>
Second paragraph enhanced for clarity.

<<P3>>
Third paragraph polished and refined.`;

    // 4. Validate anchors
    const validation = validateAnchors(llmOutput, injected.anchorIds);
    expect(validation.valid).toBe(true);

    // 5. Strip anchors for display
    const finalOutput = stripAnchors(llmOutput);
    expect(finalOutput).not.toContain('<<P');
    expect(finalOutput).toContain('First paragraph rewritten');
    expect(finalOutput).toContain('Second paragraph enhanced');
    expect(finalOutput).toContain('Third paragraph polished');
  });

  it('should reject LLM output that adds new sections', () => {
    const original = `First paragraph here.

Second paragraph here.`;

    const injected = injectAnchors(original);

    // LLM tried to add a new section
    const badOutput = `<<P1>>
First paragraph.

<<P2>>
Second paragraph.

<<P3>>
New section added by LLM.`;

    const validation = validateAnchors(badOutput, injected.anchorIds);
    expect(validation.valid).toBe(false);
    expect(validation.extra).toContain('<<P3>>');
  });

  it('should reject LLM output that removes sections', () => {
    const original = `First paragraph here.

Second paragraph here.

Third paragraph here.`;

    const injected = injectAnchors(original);
    expect(injected.paragraphCount).toBe(3);

    // LLM removed a section
    const badOutput = `<<P1>>
First and second merged.

<<P3>>
Third unchanged.`;

    const validation = validateAnchors(badOutput, injected.anchorIds);
    expect(validation.valid).toBe(false);
    expect(validation.missing).toContain('<<P2>>');
  });

  it('should reject LLM output that reorders sections', () => {
    const original = `Introduction paragraph here.

Body paragraph here.

Conclusion paragraph here.`;

    const injected = injectAnchors(original);

    // LLM reordered sections
    const badOutput = `<<P3>>
Conclusion moved to top.

<<P1>>
Introduction in middle.

<<P2>>
Body at end.`;

    const validation = validateAnchors(badOutput, injected.anchorIds);
    expect(validation.valid).toBe(false);
    expect(validation.orderPreserved).toBe(false);
  });
});
