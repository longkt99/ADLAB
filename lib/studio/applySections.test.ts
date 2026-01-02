// ============================================
// Tests for Apply Sections - Section Merge Utilities
// ============================================

import { describe, it, expect } from 'vitest';
import {
  extractSections,
  hasSections,
  getAvailableSections,
  applySection,
  getSectionCharCounts,
  compareSections,
  
  
} from './applySections';

// ============================================
// Test data fixtures
// ============================================

const CONTENT_WITH_ALL_SECTIONS = `**Hook:**
Bạn đã bao giờ tự hỏi tại sao content của mình không viral?

**Body:**
Đây là lý do và cách khắc phục:
1. Không có hook mạnh
2. Body dài dòng
3. CTA yếu

**CTA:**
Lưu ngay để không quên!

**Hashtags:**
#contentmarketing #viralcontent #marketingtips`;

const CONTENT_WITH_PARTIAL_SECTIONS = `**Hook:**
Content viral là như thế nào?

**Body:**
Hãy tìm hiểu bí quyết tạo nội dung thu hút triệu view.`;

const CONTENT_NO_SECTIONS = `Đây là một đoạn văn bình thường không có format section.
Nó chỉ là text thuần túy, không có Hook, Body, CTA hay Hashtags.`;

const MODIFIED_HOOK = `**Hook:**
NEW: Bí mật tạo content triệu view!

**Body:**
Đây là lý do và cách khắc phục:
1. Không có hook mạnh
2. Body dài dòng
3. CTA yếu

**CTA:**
Lưu ngay để không quên!

**Hashtags:**
#contentmarketing #viralcontent #marketingtips`;

// ============================================
// extractSections tests
// ============================================

describe('extractSections', () => {
  it('should extract all sections from well-formatted content', () => {
    const result = extractSections(CONTENT_WITH_ALL_SECTIONS);

    expect(result.hook).toContain('Bạn đã bao giờ tự hỏi');
    expect(result.body).toContain('Đây là lý do');
    expect(result.cta).toContain('Lưu ngay');
    expect(result.hashtags).toContain('#contentmarketing');
  });

  it('should return null for missing sections', () => {
    const result = extractSections(CONTENT_WITH_PARTIAL_SECTIONS);

    expect(result.hook).toBeTruthy();
    expect(result.body).toBeTruthy();
    expect(result.cta).toBeNull();
    expect(result.hashtags).toBeNull();
  });

  it('should return all nulls for content without sections', () => {
    const result = extractSections(CONTENT_NO_SECTIONS);

    expect(result.hook).toBeNull();
    expect(result.body).toBeNull();
    expect(result.cta).toBeNull();
    expect(result.hashtags).toBeNull();
  });

  it('should handle empty string', () => {
    const result = extractSections('');

    expect(result.hook).toBeNull();
    expect(result.body).toBeNull();
    expect(result.cta).toBeNull();
    expect(result.hashtags).toBeNull();
  });
});

// ============================================
// hasSections tests
// ============================================

describe('hasSections', () => {
  it('should return true for content with all sections', () => {
    expect(hasSections(CONTENT_WITH_ALL_SECTIONS)).toBe(true);
  });

  it('should return true for content with partial sections', () => {
    expect(hasSections(CONTENT_WITH_PARTIAL_SECTIONS)).toBe(true);
  });

  it('should return false for content without sections', () => {
    expect(hasSections(CONTENT_NO_SECTIONS)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(hasSections('')).toBe(false);
  });
});

// ============================================
// getAvailableSections tests
// ============================================

describe('getAvailableSections', () => {
  it('should return all section types for complete content', () => {
    const result = getAvailableSections(CONTENT_WITH_ALL_SECTIONS);

    expect(result).toContain('HOOK');
    expect(result).toContain('BODY');
    expect(result).toContain('CTA');
    expect(result).toContain('HASHTAGS');
    expect(result).toHaveLength(4);
  });

  it('should return only present section types', () => {
    const result = getAvailableSections(CONTENT_WITH_PARTIAL_SECTIONS);

    expect(result).toContain('HOOK');
    expect(result).toContain('BODY');
    expect(result).not.toContain('CTA');
    expect(result).not.toContain('HASHTAGS');
    expect(result).toHaveLength(2);
  });

  it('should return empty array for content without sections', () => {
    const result = getAvailableSections(CONTENT_NO_SECTIONS);

    expect(result).toHaveLength(0);
  });
});

// ============================================
// applySection tests
// ============================================

describe('applySection', () => {
  describe('mode: all', () => {
    it('should return afterText as-is', () => {
      const result = applySection(
        CONTENT_WITH_ALL_SECTIONS,
        MODIFIED_HOOK,
        'all'
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe(MODIFIED_HOOK);
      expect(result.errors).toHaveLength(0);
    });

    it('should work even if before has no sections', () => {
      const result = applySection(
        CONTENT_NO_SECTIONS,
        MODIFIED_HOOK,
        'all'
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe(MODIFIED_HOOK);
    });
  });

  describe('mode: hook', () => {
    it('should replace only the hook section', () => {
      const newHook = `**Hook:**
This is the new hook!

**Body:**
Original body stays.`;

      const original = `**Hook:**
Old hook.

**Body:**
Original body stays.`;

      const result = applySection(original, newHook, 'hook');

      expect(result.success).toBe(true);
      expect(result.content).toContain('This is the new hook!');
      expect(result.content).toContain('Original body stays');
      expect(result.appliedSections).toEqual(['HOOK']);
    });

    it('should fail if after has no hook section', () => {
      const noHook = `**Body:**
Just body, no hook.`;

      const result = applySection(CONTENT_WITH_ALL_SECTIONS, noHook, 'hook');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('HOOK');
    });
  });

  describe('mode: body', () => {
    it('should replace only the body section', () => {
      const newBody = `**Hook:**
Same hook

**Body:**
This is the new body content!`;

      const original = `**Hook:**
Same hook

**Body:**
Old body.`;

      const result = applySection(original, newBody, 'body');

      expect(result.success).toBe(true);
      expect(result.content).toContain('This is the new body content!');
      expect(result.content).toContain('Same hook');
      expect(result.appliedSections).toEqual(['BODY']);
    });
  });

  describe('source without sections', () => {
    it('should fail for partial apply when source has no sections', () => {
      const result = applySection(
        CONTENT_NO_SECTIONS,
        CONTENT_WITH_ALL_SECTIONS,
        'hook'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('no sections');
    });
  });
});

// ============================================
// getSectionCharCounts tests
// ============================================

describe('getSectionCharCounts', () => {
  it('should return char counts for each section', () => {
    const result = getSectionCharCounts(CONTENT_WITH_ALL_SECTIONS);

    expect(result.hook).toBeGreaterThan(0);
    expect(result.body).toBeGreaterThan(0);
    expect(result.cta).toBeGreaterThan(0);
    expect(result.hashtags).toBeGreaterThan(0);
  });

  it('should return 0 for missing sections', () => {
    const result = getSectionCharCounts(CONTENT_WITH_PARTIAL_SECTIONS);

    expect(result.hook).toBeGreaterThan(0);
    expect(result.body).toBeGreaterThan(0);
    expect(result.cta).toBe(0);
    expect(result.hashtags).toBe(0);
  });

  it('should return all 0s for content without sections', () => {
    const result = getSectionCharCounts(CONTENT_NO_SECTIONS);

    expect(result.hook).toBe(0);
    expect(result.body).toBe(0);
    expect(result.cta).toBe(0);
    expect(result.hashtags).toBe(0);
  });
});

// ============================================
// compareSections tests
// ============================================

describe('compareSections', () => {
  it('should detect unchanged sections', () => {
    const result = compareSections(
      CONTENT_WITH_ALL_SECTIONS,
      CONTENT_WITH_ALL_SECTIONS
    );

    expect(result.hook).toBe('unchanged');
    expect(result.body).toBe('unchanged');
    expect(result.cta).toBe('unchanged');
    expect(result.hashtags).toBe('unchanged');
  });

  it('should detect modified hook', () => {
    const result = compareSections(
      CONTENT_WITH_ALL_SECTIONS,
      MODIFIED_HOOK
    );

    expect(result.hook).toBe('modified');
    expect(result.body).toBe('unchanged');
  });

  it('should detect removed sections', () => {
    const result = compareSections(
      CONTENT_WITH_ALL_SECTIONS,
      CONTENT_WITH_PARTIAL_SECTIONS
    );

    expect(result.cta).toBe('removed');
    expect(result.hashtags).toBe('removed');
  });

  it('should detect added sections', () => {
    const result = compareSections(
      CONTENT_WITH_PARTIAL_SECTIONS,
      CONTENT_WITH_ALL_SECTIONS
    );

    expect(result.cta).toBe('added');
    expect(result.hashtags).toBe('added');
  });
});

// ============================================
// Integration tests
// ============================================

describe('Integration: Apply workflow', () => {
  it('should support full apply → undo cycle', () => {
    const original = CONTENT_WITH_ALL_SECTIONS;
    const transformed = MODIFIED_HOOK;

    // Apply all
    const applyResult = applySection(original, transformed, 'all');
    expect(applyResult.success).toBe(true);
    expect(applyResult.content).toBe(transformed);

    // The "undo" would restore original - simulated by storing beforeText
    // This is handled by the context, not this module
  });

  it('should correctly merge partial section into existing content', () => {
    const original = `**Hook:**
Original hook text.

**Body:**
Original body content here.

**CTA:**
Original CTA.`;

    const aiResult = `**Hook:**
AI-generated better hook!

**Body:**
AI-generated new body.

**CTA:**
AI-generated CTA.`;

    // Apply only hook
    const result = applySection(original, aiResult, 'hook');

    expect(result.success).toBe(true);
    expect(result.content).toContain('AI-generated better hook!');
    expect(result.content).toContain('Original body content here');
    expect(result.content).toContain('Original CTA');
  });
});
