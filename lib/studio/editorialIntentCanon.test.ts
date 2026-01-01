// ============================================
// STEP 17: Editorial Intent Canon Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  buildIntentCanonFromDraft,
  computeIntentCanonDiff,
  decideIntentCanonAction,
  formatIntentCanonForPrompt,
  getIntentCanonDebugSummary,
  type EditorialIntentCanon,
} from './editorialIntentCanon';

// ============================================
// buildIntentCanonFromDraft
// ============================================
describe('buildIntentCanonFromDraft', () => {
  it('should detect phone numbers', () => {
    const text = `
Sản phẩm tuyệt vời!
Liên hệ: 0912345678
Địa chỉ: 123 Nguyễn Văn Linh
    `;

    const canon = buildIntentCanonFromDraft(text, { language: 'vi' });

    expect(canon.anchors.some(a => a.type === 'PHONE')).toBe(true);
    const phoneAnchor = canon.anchors.find(a => a.type === 'PHONE');
    expect(phoneAnchor?.value).toContain('0912345678');
    expect(phoneAnchor?.critical).toBe(true);
  });

  it('should detect addresses', () => {
    const text = `
Ghé thăm cửa hàng tại:
Địa chỉ: 45 Võ Chí Thắng, Quận 3, TP.HCM
Hotline: 0909123456
    `;

    const canon = buildIntentCanonFromDraft(text, { language: 'vi' });

    expect(canon.anchors.some(a => a.type === 'ADDRESS')).toBe(true);
  });

  it('should detect prices', () => {
    const text = `
Combo siêu tiết kiệm chỉ 299k
Giá gốc: 500.000đ
Tiết kiệm 40%!
    `;

    const canon = buildIntentCanonFromDraft(text, { language: 'vi' });

    expect(canon.anchors.some(a => a.type === 'PRICE')).toBe(true);
    expect(canon.anchors.some(a => a.type === 'PROMO')).toBe(true);
  });

  it('should detect premium tone', () => {
    const text = `
Trải nghiệm đẳng cấp với bộ sưu tập mới.
Thiết kế tinh tế, sang trọng.
Exclusive collection - Limited edition.
    `;

    const canon = buildIntentCanonFromDraft(text, { language: 'vi' });

    expect(canon.toneLabel).toBe('premium');
  });

  it('should detect professional tone', () => {
    const text = `
Với hơn 10 năm kinh nghiệm, chúng tôi cam kết mang đến dịch vụ chuyên nghiệp.
Đảm bảo chất lượng cao nhất cho khách hàng.
    `;

    const canon = buildIntentCanonFromDraft(text, { language: 'vi' });

    expect(canon.toneLabel).toBe('professional');
  });

  it('should detect genZ tone', () => {
    const text = `
Outfit này chill quá trời luôn á!
Vibe aesthetic xịn xò, đu trend ngay thôi nào 🔥
    `;

    const canon = buildIntentCanonFromDraft(text, { language: 'vi' });

    expect(canon.toneLabel).toBe('genZ');
  });

  it('should detect salesy tone', () => {
    const text = `
SIÊU SALE! Rẻ nhất thị trường!
Đỉnh của chóp - Best seller bán chạy nhất!
Không mua là tiếc!
    `;

    const canon = buildIntentCanonFromDraft(text, { language: 'vi' });

    expect(canon.toneLabel).toBe('salesy');
  });

  it('should detect hard CTA intensity', () => {
    const text = `
Sản phẩm hot hit!
Chốt đơn ngay - Số lượng có hạn!
Nhanh tay kẻo hết!
    `;

    const canon = buildIntentCanonFromDraft(text, { language: 'vi' });

    expect(canon.ctaIntensity).toBe('hard');
  });

  it('should detect soft CTA intensity', () => {
    const text = `
Khám phá bộ sưu tập mới.
Tìm hiểu thêm về sản phẩm.
    `;

    const canon = buildIntentCanonFromDraft(text, { language: 'vi' });

    expect(canon.ctaIntensity).toBe('soft');
  });

  it('should infer product promotion goal', () => {
    const text = `
Mua ngay sản phẩm mới với giá ưu đãi!
Đặt hàng ngay hôm nay.
    `;

    const canon = buildIntentCanonFromDraft(text, { language: 'vi' });

    expect(canon.goal).toBe('product_promotion');
  });
});

// ============================================
// computeIntentCanonDiff
// ============================================
describe('computeIntentCanonDiff', () => {
  const baseCanon: EditorialIntentCanon = {
    goal: 'product_promotion',
    audience: 'general',
    toneLabel: 'premium',
    ctaIntensity: 'soft',
    anchors: [
      { type: 'PHONE', value: '0912345678', critical: true },
      { type: 'ADDRESS', value: '123 Nguyen Van Linh', critical: true },
      { type: 'PRICE', value: '500k', critical: true },
    ],
    allowedEdits: ['POLISH', 'FLOW', 'CLARITY'],
    nonNegotiables: ['Preserve 3 critical anchors'],
    meta: {
      draftId: 'test-draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      language: 'vi',
    },
  };

  it('should detect missing phone number', () => {
    const newText = `
Sản phẩm cao cấp với thiết kế tinh tế.
Địa chỉ: 123 Nguyen Van Linh
Giá: 500k
    `;

    const diff = computeIntentCanonDiff(baseCanon, newText);

    expect(diff.hasDrift).toBe(true);
    expect(diff.missingAnchors.some(a => a.type === 'PHONE')).toBe(true);
    expect(diff.signals.some(s => s.type === 'MISSING_ANCHOR')).toBe(true);
  });

  it('should detect missing address', () => {
    const newText = `
Sản phẩm cao cấp.
Liên hệ: 0912345678
Giá: 500k
    `;

    const diff = computeIntentCanonDiff(baseCanon, newText);

    expect(diff.hasDrift).toBe(true);
    expect(diff.missingAnchors.some(a => a.type === 'ADDRESS')).toBe(true);
  });

  it('should detect CTA escalation', () => {
    const newText = `
Sản phẩm cao cấp!
CHỐT ĐƠN NGAY! Số lượng có hạn!
Liên hệ: 0912345678
Địa chỉ: 123 Nguyen Van Linh
Giá: 500k
    `;

    const diff = computeIntentCanonDiff(baseCanon, newText);

    expect(diff.hasDrift).toBe(true);
    expect(diff.signals.some(s => s.type === 'CTA_ESCALATION')).toBe(true);
  });

  it('should detect premium to salesy tone flip', () => {
    const newText = `
SIÊU SALE! Rẻ nhất thị trường!
Đỉnh của chóp!
Liên hệ: 0912345678
Địa chỉ: 123 Nguyen Van Linh
Giá: 500k
    `;

    const diff = computeIntentCanonDiff(baseCanon, newText);

    expect(diff.hasDrift).toBe(true);
    expect(diff.signals.some(s => s.type === 'TONE_FLIP')).toBe(true);
    const toneFlip = diff.signals.find(s => s.type === 'TONE_FLIP');
    expect(toneFlip?.originalValue).toBe('premium');
    expect(toneFlip?.newValue).toBe('salesy');
  });

  it('should allow simple polish without drift', () => {
    // Create a canon with anchors that will be preserved
    const polishCanon: EditorialIntentCanon = {
      ...baseCanon,
      anchors: [
        { type: 'PHONE', value: '0912345678', critical: true },
        { type: 'PRICE', value: '500k', critical: true },
      ],
    };

    const newText = `
Sản phẩm cao cấp với thiết kế tinh tế và sang trọng.
Liên hệ ngay: 0912345678
Giá ưu đãi: 500k
    `;

    const diff = computeIntentCanonDiff(polishCanon, newText);

    // Should not have missing anchors (phone and price preserved)
    expect(diff.missingAnchors.length).toBe(0);
    // May have some signals but not high severity ones
    const hasHighSeverity = diff.signals.some(s => s.severity === 'high');
    expect(hasHighSeverity).toBe(false);
  });

  it('should detect no drift when content is preserved', () => {
    // Canon with neutral tone and no hard CTA
    const neutralCanon: EditorialIntentCanon = {
      ...baseCanon,
      toneLabel: 'neutral',
      ctaIntensity: 'medium',
    };

    const newText = `
Sản phẩm chất lượng.
Inbox để biết thêm chi tiết.
Liên hệ: 0912345678
Địa chỉ: 123 Nguyen Van Linh
Giá: 500k
    `;

    const diff = computeIntentCanonDiff(neutralCanon, newText);

    // All anchors preserved, no major tone flip
    expect(diff.missingAnchors.length).toBe(0);
  });
});

// ============================================
// decideIntentCanonAction
// ============================================
describe('decideIntentCanonAction', () => {
  it('should ALLOW when no drift', () => {
    const diff = {
      hasDrift: false,
      signals: [],
      missingAnchors: [],
      addedAnchors: [],
      severity: 'low' as const,
    };

    const decision = decideIntentCanonAction(diff, 1);

    expect(decision.action).toBe('ALLOW');
  });

  it('should BLOCK for light edits with high severity drift', () => {
    const diff = {
      hasDrift: true,
      signals: [
        { type: 'MISSING_ANCHOR' as const, description: 'Missing phone', severity: 'high' as const },
      ],
      missingAnchors: [{ type: 'PHONE' as const, value: '0912345678', critical: true }],
      addedAnchors: [],
      severity: 'high' as const,
    };

    // Light edit (weight 1 = MICRO_POLISH)
    const decision = decideIntentCanonAction(diff, 1);

    expect(decision.action).toBe('BLOCK');
    expect(decision.severity).toBe('high');
  });

  it('should BLOCK when critical anchors missing even for heavy edits', () => {
    const diff = {
      hasDrift: true,
      signals: [
        { type: 'MISSING_ANCHOR' as const, description: 'Missing phone', severity: 'high' as const },
      ],
      missingAnchors: [{ type: 'PHONE' as const, value: '0912345678', critical: true }],
      addedAnchors: [],
      severity: 'high' as const,
    };

    // Heavy edit (weight 5 = BODY_REWRITE)
    const decision = decideIntentCanonAction(diff, 5);

    expect(decision.action).toBe('BLOCK');
  });

  it('should WARN for medium severity with moderate edits', () => {
    const diff = {
      hasDrift: true,
      signals: [
        { type: 'CTA_ESCALATION' as const, description: 'CTA escalated', severity: 'medium' as const },
      ],
      missingAnchors: [],
      addedAnchors: [],
      severity: 'medium' as const,
    };

    // Medium edit (weight 3 = TRIM)
    const decision = decideIntentCanonAction(diff, 3);

    expect(decision.action).toBe('WARN');
  });

  it('should ALLOW for low severity drift', () => {
    const diff = {
      hasDrift: true,
      signals: [
        { type: 'GOAL_DRIFT' as const, description: 'Minor goal change', severity: 'low' as const },
      ],
      missingAnchors: [],
      addedAnchors: [],
      severity: 'low' as const,
    };

    const decision = decideIntentCanonAction(diff, 2);

    expect(decision.action).toBe('ALLOW');
  });
});

// ============================================
// formatIntentCanonForPrompt
// ============================================
describe('formatIntentCanonForPrompt', () => {
  it('should format short prompt block in Vietnamese', () => {
    const canon: EditorialIntentCanon = {
      goal: 'product_promotion',
      audience: 'general',
      toneLabel: 'premium',
      ctaIntensity: 'soft',
      anchors: [
        { type: 'PHONE', value: '0912345678', critical: true },
      ],
      allowedEdits: ['POLISH', 'FLOW'],
      nonNegotiables: ['Maintain premium tone'],
      meta: {
        draftId: 'test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        language: 'vi',
      },
    };

    const block = formatIntentCanonForPrompt(canon, 'vi');

    expect(block).toContain('ĐỊNH HƯỚNG NỘI DUNG');
    expect(block).toContain('Mục tiêu');
    expect(block).toContain('Phong cách');
    expect(block).toContain('GIỮ NGUYÊN');
    expect(block).toContain('PHONE');

    // Should be concise (roughly 10 lines)
    const lines = block.split('\n').filter(l => l.trim());
    expect(lines.length).toBeLessThanOrEqual(12);
  });

  it('should format short prompt block in English', () => {
    const canon: EditorialIntentCanon = {
      goal: 'educational',
      audience: 'business',
      toneLabel: 'professional',
      ctaIntensity: 'medium',
      anchors: [],
      allowedEdits: ['POLISH', 'CLARITY'],
      nonNegotiables: [],
      meta: {
        draftId: 'test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        language: 'en',
      },
    };

    const block = formatIntentCanonForPrompt(canon, 'en');

    expect(block).toContain('CONTENT DIRECTION');
    expect(block).toContain('Goal');
    expect(block).toContain('Style');
    expect(block).toContain('Professional');
  });
});

// ============================================
// getIntentCanonDebugSummary
// ============================================
describe('getIntentCanonDebugSummary', () => {
  it('should return concise summary', () => {
    const canon: EditorialIntentCanon = {
      goal: 'product_promotion',
      audience: 'general',
      toneLabel: 'premium',
      ctaIntensity: 'soft',
      anchors: [
        { type: 'PHONE', value: '0912345678', critical: true },
        { type: 'PROMO', value: 'giảm 20%', critical: false },
      ],
      allowedEdits: ['POLISH'],
      nonNegotiables: [],
      meta: {
        draftId: 'test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        language: 'vi',
      },
    };

    const summary = getIntentCanonDebugSummary(canon);

    expect(summary).toContain('premium');
    expect(summary).toContain('soft');
    expect(summary).toContain('Anchors:1/2'); // 1 critical out of 2
    expect(summary).toContain('product_promotion');
  });
});
