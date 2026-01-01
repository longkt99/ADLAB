// ============================================
// STEP 20: Edit Intent Normalizer Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  normalizeEditIntent,
  hasExplicitNotCreateSignal,
  getNormalizerDebugSummary,
  type NormalizedEditIntent,
  type NormalizerContext,
} from './editIntentNormalizer';

// ============================================
// normalizeEditIntent Tests
// ============================================
describe('normalizeEditIntent', () => {
  const baseContext: NormalizerContext = {
    hasActiveDraft: true,
    lang: 'vi',
  };

  describe('Vietnamese patterns', () => {
    it('should detect "thêm thông tin" as EDIT_IN_PLACE + BODY', () => {
      const result = normalizeEditIntent('thêm thông tin', baseContext);

      expect(result).not.toBeNull();
      expect(result?.action).toBe('EDIT_IN_PLACE');
      expect(result?.target).toBe('BODY');
    });

    it('should detect "bổ sung nội dung" as EDIT_IN_PLACE + BODY', () => {
      const result = normalizeEditIntent('bổ sung nội dung', baseContext);

      expect(result).not.toBeNull();
      expect(result?.action).toBe('EDIT_IN_PLACE');
      expect(result?.target).toBe('BODY');
    });

    it('should detect "không phải viết bài mới" with HIGH confidence', () => {
      const result = normalizeEditIntent(
        'Tôi bảo bạn thêm thông tin chứ không phải viết bài mới',
        baseContext
      );

      expect(result).not.toBeNull();
      expect(result?.action).toBe('EDIT_IN_PLACE');
      expect(result?.confidence).toBe('HIGH');
    });

    it('should detect "giữ nguyên hook" as targeting BODY', () => {
      const result = normalizeEditIntent('giữ nguyên hook, sửa thân bài', baseContext);

      expect(result).not.toBeNull();
      expect(result?.action).toBe('EDIT_IN_PLACE');
      // Should target BODY since we're preserving HOOK
      expect(result?.target).toBe('BODY');
    });

    it('should detect "sửa CTA" as targeting CTA', () => {
      const result = normalizeEditIntent('sửa CTA', baseContext);

      expect(result).not.toBeNull();
      expect(result?.target).toBe('CTA');
    });

    it('should detect "chỉnh tone" as targeting TONE', () => {
      const result = normalizeEditIntent('chỉnh tone sang hơn', baseContext);

      expect(result).not.toBeNull();
      expect(result?.target).toBe('TONE');
    });

    it('should detect "sửa hook" as targeting HOOK', () => {
      const result = normalizeEditIntent('sửa hook cho hay hơn', baseContext);

      expect(result).not.toBeNull();
      expect(result?.target).toBe('HOOK');
    });

    it('should detect "chỉ cần thêm phần..." with HIGH confidence', () => {
      const result = normalizeEditIntent('chỉ cần thêm phần chi tiết', baseContext);

      expect(result).not.toBeNull();
      expect(result?.confidence).toBe('HIGH');
    });

    it('should handle "ý tôi là..." as clarification', () => {
      const result = normalizeEditIntent('ý tôi là thêm bullet points', baseContext);

      expect(result).not.toBeNull();
      expect(result?.action).toBe('EDIT_IN_PLACE');
    });
  });

  describe('English patterns', () => {
    const enContext: NormalizerContext = {
      hasActiveDraft: true,
      lang: 'en',
    };

    it('should detect "add more info" as EDIT_IN_PLACE + BODY', () => {
      const result = normalizeEditIntent('add more info', enContext);

      expect(result).not.toBeNull();
      expect(result?.action).toBe('EDIT_IN_PLACE');
      expect(result?.target).toBe('BODY');
    });

    it('should detect "just update" as EDIT_IN_PLACE', () => {
      const result = normalizeEditIntent('just update the content', enContext);

      expect(result).not.toBeNull();
      expect(result?.action).toBe('EDIT_IN_PLACE');
      expect(result?.confidence).toBe('HIGH');
    });

    it('should detect "don\'t rewrite" with HIGH confidence', () => {
      const result = normalizeEditIntent("don't rewrite, just add details", enContext);

      expect(result).not.toBeNull();
      expect(result?.confidence).toBe('HIGH');
    });

    it('should detect "keep the rest" as PRESERVE signal', () => {
      const result = normalizeEditIntent('edit the body, keep the rest', enContext);

      expect(result).not.toBeNull();
      expect(result?.action).toBe('EDIT_IN_PLACE');
    });

    it('should detect "only edit" as NOT_CREATE', () => {
      const result = normalizeEditIntent('only edit the CTA', enContext);

      expect(result).not.toBeNull();
      expect(result?.target).toBe('CTA');
      expect(result?.confidence).toBe('HIGH');
    });

    it('should detect "fix the hook" as targeting HOOK', () => {
      const result = normalizeEditIntent('fix the hook please', enContext);

      expect(result).not.toBeNull();
      expect(result?.target).toBe('HOOK');
    });
  });

  describe('Context requirements', () => {
    it('should return null when no active draft', () => {
      const result = normalizeEditIntent('thêm thông tin', {
        hasActiveDraft: false,
        lang: 'vi',
      });

      expect(result).toBeNull();
    });

    it('should return null for empty instruction', () => {
      const result = normalizeEditIntent('', baseContext);

      expect(result).toBeNull();
    });

    it('should return null for whitespace-only instruction', () => {
      const result = normalizeEditIntent('   ', baseContext);

      expect(result).toBeNull();
    });

    it('should return null when no edit patterns match', () => {
      // A question that doesn't indicate edit intent
      const result = normalizeEditIntent('bài viết này về gì?', baseContext);

      expect(result).toBeNull();
    });
  });

  describe('Confidence levels', () => {
    it('should return HIGH confidence for explicit NOT_CREATE signal', () => {
      const result = normalizeEditIntent(
        'không phải tạo mới, chỉ sửa thôi',
        baseContext
      );

      expect(result?.confidence).toBe('HIGH');
    });

    it('should return MEDIUM confidence for general edit terms', () => {
      const result = normalizeEditIntent('sửa đi', baseContext);

      expect(result).not.toBeNull();
      // General edit term without specific target should be MEDIUM or lower
      expect(['MEDIUM', 'LOW']).toContain(result?.confidence);
    });

    it('should boost confidence with PRESERVE_REST signal', () => {
      const result = normalizeEditIntent('giữ nguyên, chỉ sửa body', baseContext);

      expect(result).not.toBeNull();
      expect(['HIGH', 'MEDIUM']).toContain(result?.confidence);
    });
  });

  describe('Target inference', () => {
    it('should default to BODY when no specific target mentioned', () => {
      const result = normalizeEditIntent('thêm chi tiết', baseContext);

      expect(result).not.toBeNull();
      expect(result?.target).toBe('BODY');
    });

    it('should detect HOOK from Vietnamese patterns', () => {
      const result = normalizeEditIntent('sửa mở bài', baseContext);

      expect(result?.target).toBe('HOOK');
    });

    it('should detect CTA from Vietnamese patterns', () => {
      const result = normalizeEditIntent('đổi kêu gọi', baseContext);

      expect(result?.target).toBe('CTA');
    });

    it('should detect TONE from style-related patterns', () => {
      const result = normalizeEditIntent('chỉnh văn phong', baseContext);

      expect(result?.target).toBe('TONE');
    });
  });
});

// ============================================
// hasExplicitNotCreateSignal Tests
// ============================================
describe('hasExplicitNotCreateSignal', () => {
  it('should detect Vietnamese NOT_CREATE patterns', () => {
    expect(hasExplicitNotCreateSignal('không phải viết bài mới', 'vi')).toBe(true);
    expect(hasExplicitNotCreateSignal('không phải tạo mới', 'vi')).toBe(true);
    expect(hasExplicitNotCreateSignal('chỉ cần thêm', 'vi')).toBe(true);
  });

  it('should detect English NOT_CREATE patterns', () => {
    expect(hasExplicitNotCreateSignal("don't rewrite", 'en')).toBe(true);
    expect(hasExplicitNotCreateSignal('just update', 'en')).toBe(true);
    expect(hasExplicitNotCreateSignal('only edit', 'en')).toBe(true);
  });

  it('should return false for general instructions', () => {
    expect(hasExplicitNotCreateSignal('viết hay hơn', 'vi')).toBe(false);
    expect(hasExplicitNotCreateSignal('make it better', 'en')).toBe(false);
  });
});

// ============================================
// getNormalizerDebugSummary Tests
// ============================================
describe('getNormalizerDebugSummary', () => {
  it('should return appropriate message when no result', () => {
    const summary = getNormalizerDebugSummary(null, 'vi');
    expect(summary).toBe('Không phát hiện ý định chỉnh sửa');

    const enSummary = getNormalizerDebugSummary(null, 'en');
    expect(enSummary).toBe('No edit intent detected');
  });

  it('should format result correctly', () => {
    const result: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'BODY',
      confidence: 'HIGH',
      reason: 'Test reason',
    };

    const summary = getNormalizerDebugSummary(result, 'vi');
    expect(summary).toContain('EDIT_IN_PLACE');
    expect(summary).toContain('Thân bài');
    expect(summary).toContain('HIGH');
  });
});

// ============================================
// Real-world scenario tests
// ============================================
describe('Real-world scenarios', () => {
  const ctx: NormalizerContext = { hasActiveDraft: true, lang: 'vi' };

  it('should handle the example from problem statement', () => {
    const result = normalizeEditIntent(
      'Tôi bảo bạn thêm thông tin chứ không phải viết bài mới',
      ctx
    );

    expect(result).not.toBeNull();
    expect(result?.action).toBe('EDIT_IN_PLACE');
    expect(result?.target).toBe('BODY');
    expect(result?.confidence).toBe('HIGH');
  });

  it('should handle user clarification after misunderstanding', () => {
    const result = normalizeEditIntent(
      'ý tôi là bổ sung thêm chi tiết, không phải viết lại',
      ctx
    );

    expect(result).not.toBeNull();
    expect(result?.action).toBe('EDIT_IN_PLACE');
    // Confidence can be MEDIUM or HIGH depending on pattern matching
    expect(['MEDIUM', 'HIGH']).toContain(result?.confidence);
  });

  it('should handle partial edit requests', () => {
    const result = normalizeEditIntent(
      'chỉ sửa phần body thôi, giữ nguyên hook và CTA',
      ctx
    );

    expect(result).not.toBeNull();
    expect(result?.target).toBe('BODY');
  });

  it('should handle tone adjustment requests', () => {
    const result = normalizeEditIntent(
      'chỉnh giọng văn sang hơn một chút',
      ctx
    );

    expect(result).not.toBeNull();
    expect(result?.target).toBe('TONE');
  });

  it('should handle CTA refinement requests', () => {
    const result = normalizeEditIntent(
      'đổi CTA mềm hơn',
      ctx
    );

    expect(result).not.toBeNull();
    expect(result?.target).toBe('CTA');
  });
});
