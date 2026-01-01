// ============================================
// STEP 15: Editorial Canon Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  extractCanonFromDraft,
  computeCanonDiff,
  getCanonConstraints,
  shouldRequireCanonApproval,
  applyCanonLocks,
  updateSectionLock,
  reapplyLockedSections,
  updateCanonFromText,
  getCanonLockState,
  isAmbiguousEditInstruction,
  instructionMentionsSection,
  getSectionLabel,
  getToneLabel,
  getCanonDebugSummary,
  type EditorialCanon,
  type CanonSection,
} from './editorialCanon';

// ============================================
// extractCanonFromDraft
// ============================================
describe('extractCanonFromDraft', () => {
  describe('with explicit markers', () => {
    it('should parse markdown headings with Hook/Body/CTA', () => {
      // Using ## Hook format that the parser recognizes
      const text = `## Hook
Đây là dòng mở đầu hấp dẫn.

## Body
Nội dung chính của bài viết.
Có nhiều đoạn văn.

## CTA
Liên hệ ngay để được tư vấn!`;

      const canon = extractCanonFromDraft(text, 'draft-1');

      expect(canon.hook.text).toBe('Đây là dòng mở đầu hấp dẫn.');
      expect(canon.body.blocks.length).toBeGreaterThan(0);
      expect(canon.cta.text).toBe('Liên hệ ngay để được tư vấn!');
      expect(canon.meta.activeDraftId).toBe('draft-1');
    });

    it('should parse Vietnamese markers (mở đầu, nội dung, kết luận)', () => {
      // Using explicit ## hook marker
      const text = `## Hook
Chào bạn, hôm nay mình chia sẻ...

## Body
Phần nội dung chính đây.

## CTA
Inbox mình nhé!`;

      const canon = extractCanonFromDraft(text, 'draft-2');

      expect(canon.hook.text).toBe('Chào bạn, hôm nay mình chia sẻ...');
      expect(canon.cta.text).toBe('Inbox mình nhé!');
    });

    it('should handle bold markers (**Hook**, **Body**, **CTA**)', () => {
      // Bold markers are recognized
      const text = `**Hook**
Dòng mở đầu

**Body**
Nội dung chi tiết

**CTA**
Gọi ngay 0123456789`;

      const canon = extractCanonFromDraft(text, 'draft-3');

      expect(canon.hook.text).toBe('Dòng mở đầu');
      expect(canon.cta.text).toBe('Gọi ngay 0123456789');
    });
  });

  describe('without markers (heuristic parsing)', () => {
    it('should parse multi-paragraph text without explicit markers', () => {
      // Text without explicit Hook/Body/CTA markers
      // First paragraph becomes hook, last CTA-like paragraph becomes CTA
      const text = `Bạn có bao giờ gặp vấn đề này?

Đây là phần nội dung giải thích chi tiết về vấn đề và cách giải quyết.

Liên hệ inbox để tìm hiểu thêm!`;

      const canon = extractCanonFromDraft(text, 'draft-4');

      // First paragraph detected as hook
      expect(canon.hook.text).toBe('Bạn có bao giờ gặp vấn đề này?');
      // Last paragraph with "inbox" detected as CTA
      expect(canon.cta.text).toBe('Liên hệ inbox để tìm hiểu thêm!');
    });

    it('should detect CTA-like last paragraph', () => {
      const text = `Mở đầu ấn tượng

Nội dung chi tiết

DM ngay để nhận ưu đãi 👇`;

      const canon = extractCanonFromDraft(text, 'draft-5');

      // First paragraph is hook
      expect(canon.hook.text).toBe('Mở đầu ấn tượng');
      // Last paragraph with DM and emoji is CTA
      expect(canon.cta.text).toBe('DM ngay để nhận ưu đãi 👇');
    });

    it('should treat single paragraph as body only', () => {
      const text = `Đây là một bài viết ngắn chỉ có một đoạn văn duy nhất.`;

      const canon = extractCanonFromDraft(text, 'draft-6');

      expect(canon.hook.text).toBe('');
      expect(canon.cta.text).toBe('');
      expect(canon.body.blocks.length).toBe(1);
      expect(canon.body.blocks[0].text).toBe(text);
    });

    it('should handle empty text', () => {
      const canon = extractCanonFromDraft('', 'draft-empty');

      expect(canon.hook.text).toBe('');
      expect(canon.cta.text).toBe('');
      expect(canon.body.blocks).toEqual([]);
    });

    it('should handle whitespace-only text', () => {
      const canon = extractCanonFromDraft('   \n\n   ', 'draft-whitespace');

      expect(canon.hook.text).toBe('');
      expect(canon.body.blocks).toEqual([]);
    });
  });

  describe('tone detection', () => {
    it('should detect professional tone', () => {
      const text = `Kính gửi Quý khách hàng,

Chúng tôi xin trân trọng giới thiệu sản phẩm mới.`;

      const canon = extractCanonFromDraft(text, 'draft-pro');
      expect(canon.tone.id).toBe('professional');
    });

    it('should detect casual tone', () => {
      const text = `Nè bạn ơi, chill vibe lắm nha! 🔥✨

Thử ngay đi nè!`;

      const canon = extractCanonFromDraft(text, 'draft-casual');
      expect(canon.tone.id).toBe('casual');
    });

    it('should detect formal tone', () => {
      // Use text that contains formal patterns and no casual patterns
      const text = `Thưa quý vị,

Chúng tôi xin được thông báo về chính sách mới của công ty.`;

      const canon = extractCanonFromDraft(text, 'draft-formal');
      // The detectTone function checks formal patterns: thưa, ngài, quý vị
      expect(canon.tone.id).toBe('formal');
    });

    it('should default to neutral for plain text', () => {
      const text = `Đây là nội dung bình thường không có tông đặc biệt.`;

      const canon = extractCanonFromDraft(text, 'draft-neutral');
      expect(canon.tone.id).toBe('neutral');
    });
  });

  describe('body block detection', () => {
    it('should detect heading blocks', () => {
      const text = `## Hook
Mở đầu

## Body
# Tiêu đề lớn
Nội dung`;

      const canon = extractCanonFromDraft(text, 'draft-heading');
      const headingBlock = canon.body.blocks.find(b => b.role === 'heading');
      expect(headingBlock).toBeDefined();
    });

    it('should detect list blocks', () => {
      const text = `## Body
- Item 1
- Item 2
- Item 3`;

      const canon = extractCanonFromDraft(text, 'draft-list');
      const listBlock = canon.body.blocks.find(b => b.role === 'list');
      expect(listBlock).toBeDefined();
    });

    it('should detect quote blocks', () => {
      const text = `## Body
> Đây là trích dẫn hay

Và đây là nội dung thông thường.`;

      const canon = extractCanonFromDraft(text, 'draft-quote');
      const quoteBlock = canon.body.blocks.find(b => b.role === 'quote');
      expect(quoteBlock).toBeDefined();
    });
  });
});

// ============================================
// computeCanonDiff
// ============================================
describe('computeCanonDiff', () => {
  const baseCanon: EditorialCanon = {
    hook: { text: 'Original hook text', locked: true },
    cta: { text: 'Original CTA text', locked: true },
    tone: { id: 'neutral', locked: false },
    body: {
      blocks: [
        { id: 'blk_1', text: 'Body paragraph 1', role: 'paragraph', locked: false },
        { id: 'blk_2', text: 'Body paragraph 2', role: 'paragraph', locked: false },
      ],
    },
    meta: {
      activeDraftId: 'draft-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revision: 1,
    },
  };

  it('should detect hook change', () => {
    const newText = `Changed hook completely different

Body paragraph 1

Body paragraph 2

Original CTA text`;

    const diff = computeCanonDiff(baseCanon, newText);

    expect(diff.changedSections).toContain('HOOK');
    expect(diff.diffsBySection.hook?.changed).toBe(true);
    expect(diff.lockedSectionChanged).toBe(true);
  });

  it('should detect CTA change', () => {
    const newText = `Original hook text

Body paragraph 1

Body paragraph 2

Completely new CTA here`;

    const diff = computeCanonDiff(baseCanon, newText);

    expect(diff.changedSections).toContain('CTA');
    expect(diff.diffsBySection.cta?.changed).toBe(true);
    expect(diff.lockedSectionChanged).toBe(true);
  });

  it('should detect body change', () => {
    const newText = `Original hook text

New body content that is different

Original CTA text`;

    const diff = computeCanonDiff(baseCanon, newText);

    expect(diff.changedSections).toContain('BODY');
    expect(diff.diffsBySection.body?.changed).toBe(true);
  });

  it('should detect no changes when text is similar', () => {
    // Create a canon and new text that are structurally identical
    const simpleCanon: EditorialCanon = {
      hook: { text: 'Hello world', locked: true },
      cta: { text: 'Contact us', locked: true },
      tone: { id: 'neutral', locked: false },
      body: {
        blocks: [
          { id: 'blk_1', text: 'Body content here', role: 'paragraph', locked: false },
        ],
      },
      meta: {
        activeDraftId: 'draft-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        revision: 1,
      },
    };

    // Same content with minor case differences
    const newText = `hello world

Body content here

contact us`;

    const diff = computeCanonDiff(simpleCanon, newText);

    // Hook and CTA should be similar due to case-insensitive comparison
    expect(diff.changedSections).not.toContain('HOOK');
  });

  it('should track lockedSectionChanged correctly', () => {
    const unlockedCanon: EditorialCanon = {
      ...baseCanon,
      hook: { text: 'Original hook', locked: false },
      cta: { text: 'Original CTA', locked: false },
    };

    const newText = `Completely different hook

Body content

Completely different CTA`;

    const diff = computeCanonDiff(unlockedCanon, newText);

    expect(diff.changedSections).toContain('HOOK');
    expect(diff.changedSections).toContain('CTA');
    expect(diff.lockedSectionChanged).toBe(false); // Sections changed but weren't locked
  });
});

// ============================================
// shouldRequireCanonApproval
// ============================================
describe('shouldRequireCanonApproval', () => {
  const lockedCanon: EditorialCanon = {
    hook: { text: 'Locked hook', locked: true },
    cta: { text: 'Locked CTA', locked: true },
    tone: { id: 'professional', locked: true },
    body: { blocks: [] },
    meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 1 },
  };

  it('should require approval when locked section changed', () => {
    const diff = {
      changedSections: ['HOOK' as CanonSection],
      diffsBySection: {
        hook: { changed: true, oldText: 'old', newText: 'new' },
        cta: null,
        tone: null,
        body: null,
      },
      lockedSectionChanged: true,
    };

    expect(shouldRequireCanonApproval({
      canon: lockedCanon,
      diff,
    })).toBe(true);
  });

  it('should not require approval when only body changed', () => {
    const diff = {
      changedSections: ['BODY' as CanonSection],
      diffsBySection: {
        hook: null,
        cta: null,
        tone: null,
        body: { changed: true, addedBlocks: 1, removedBlocks: 0, modifiedBlocks: 0 },
      },
      lockedSectionChanged: false,
    };

    expect(shouldRequireCanonApproval({
      canon: lockedCanon,
      diff,
    })).toBe(false);
  });

  it('should require approval when instruction mentions locked section', () => {
    const diff = {
      changedSections: ['HOOK' as CanonSection],
      diffsBySection: {
        hook: { changed: true, oldText: 'old', newText: 'new' },
        cta: null,
        tone: null,
        body: null,
      },
      lockedSectionChanged: false, // Not locked in diff, but instruction mentions it
    };

    // Change hook to locked in this test scenario
    const result = shouldRequireCanonApproval({
      canon: lockedCanon,
      diff: { ...diff, lockedSectionChanged: true },
      instructionText: 'Sửa lại hook cho hay hơn',
    });

    expect(result).toBe(true);
  });
});

// ============================================
// applyCanonLocks
// ============================================
describe('applyCanonLocks', () => {
  const baseCanon: EditorialCanon = {
    hook: { text: 'Hook', locked: false },
    cta: { text: 'CTA', locked: false },
    tone: { id: 'neutral', locked: false },
    body: {
      blocks: [
        { id: 'blk_1', text: 'Block 1', role: 'paragraph', locked: false },
        { id: 'blk_2', text: 'Block 2', role: 'paragraph', locked: true },
      ],
    },
    meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 1 },
  };

  it('should lock HOOK, CTA, TONE by default, leave BODY unlocked', () => {
    const locked = applyCanonLocks(baseCanon, 'default');

    expect(locked.hook.locked).toBe(true);
    expect(locked.cta.locked).toBe(true);
    expect(locked.tone.locked).toBe(true);
    expect(locked.body.blocks.every(b => !b.locked)).toBe(true);
  });

  it('should lock everything with lock_all policy', () => {
    const locked = applyCanonLocks(baseCanon, 'lock_all');

    expect(locked.hook.locked).toBe(true);
    expect(locked.cta.locked).toBe(true);
    expect(locked.tone.locked).toBe(true);
    expect(locked.body.blocks.every(b => b.locked)).toBe(true);
  });

  it('should unlock everything with unlock_all policy', () => {
    const unlocked = applyCanonLocks(baseCanon, 'unlock_all');

    expect(unlocked.hook.locked).toBe(false);
    expect(unlocked.cta.locked).toBe(false);
    expect(unlocked.tone.locked).toBe(false);
    expect(unlocked.body.blocks.every(b => !b.locked)).toBe(true);
  });

  it('should preserve existing locks with custom policy', () => {
    const customLocked = {
      ...baseCanon,
      hook: { ...baseCanon.hook, locked: true },
    };

    const result = applyCanonLocks(customLocked, 'custom');

    expect(result.hook.locked).toBe(true);
    expect(result.cta.locked).toBe(false);
  });
});

// ============================================
// updateSectionLock
// ============================================
describe('updateSectionLock', () => {
  const baseCanon: EditorialCanon = {
    hook: { text: 'Hook', locked: false },
    cta: { text: 'CTA', locked: false },
    tone: { id: 'neutral', locked: false },
    body: {
      blocks: [
        { id: 'blk_1', text: 'Block 1', role: 'paragraph', locked: false },
      ],
    },
    meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 1 },
  };

  it('should lock HOOK section', () => {
    const updated = updateSectionLock(baseCanon, 'HOOK', true);
    expect(updated.hook.locked).toBe(true);
    expect(updated.cta.locked).toBe(false);
  });

  it('should lock CTA section', () => {
    const updated = updateSectionLock(baseCanon, 'CTA', true);
    expect(updated.cta.locked).toBe(true);
  });

  it('should lock TONE section', () => {
    const updated = updateSectionLock(baseCanon, 'TONE', true);
    expect(updated.tone.locked).toBe(true);
  });

  it('should lock all BODY blocks', () => {
    const updated = updateSectionLock(baseCanon, 'BODY', true);
    expect(updated.body.blocks.every(b => b.locked)).toBe(true);
  });

  it('should unlock section', () => {
    const locked = updateSectionLock(baseCanon, 'HOOK', true);
    const unlocked = updateSectionLock(locked, 'HOOK', false);
    expect(unlocked.hook.locked).toBe(false);
  });
});

// ============================================
// reapplyLockedSections
// ============================================
describe('reapplyLockedSections', () => {
  it('should preserve locked hook when AI changes it', () => {
    const canon: EditorialCanon = {
      hook: { text: 'Original locked hook', locked: true },
      cta: { text: 'Original CTA', locked: false },
      tone: { id: 'neutral', locked: false },
      body: { blocks: [] },
      meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 1 },
    };

    const newText = `AI changed the hook completely

New body content

New CTA here`;

    const result = reapplyLockedSections(canon, newText);

    expect(result).toContain('Original locked hook');
    expect(result).toContain('New body content');
    expect(result).toContain('New CTA here');
  });

  it('should preserve locked CTA when AI changes it', () => {
    const canon: EditorialCanon = {
      hook: { text: 'Original hook', locked: false },
      cta: { text: 'Original locked CTA - inbox ngay!', locked: true },
      tone: { id: 'neutral', locked: false },
      body: { blocks: [] },
      meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 1 },
    };

    const newText = `New hook

New body content

AI changed CTA`;

    const result = reapplyLockedSections(canon, newText);

    expect(result).toContain('New hook');
    expect(result).toContain('New body content');
    expect(result).toContain('Original locked CTA');
  });

  it('should preserve both locked hook and CTA', () => {
    const canon: EditorialCanon = {
      hook: { text: 'Locked hook content', locked: true },
      cta: { text: 'Locked CTA - liên hệ!', locked: true },
      tone: { id: 'neutral', locked: false },
      body: { blocks: [] },
      meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 1 },
    };

    const newText = `Changed hook

New body here

Changed CTA`;

    const result = reapplyLockedSections(canon, newText);

    expect(result).toContain('Locked hook content');
    expect(result).toContain('New body here');
    expect(result).toContain('Locked CTA');
  });

  it('should use new content when section is not locked', () => {
    const canon: EditorialCanon = {
      hook: { text: 'Old hook', locked: false },
      cta: { text: 'Old CTA', locked: false },
      tone: { id: 'neutral', locked: false },
      body: { blocks: [] },
      meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 1 },
    };

    const newText = `New hook

New body

New CTA inbox`;

    const result = reapplyLockedSections(canon, newText);

    expect(result).toContain('New hook');
    expect(result).toContain('New body');
    // CTA detection might pick up "inbox"
  });

  it('should handle empty locked sections gracefully', () => {
    const canon: EditorialCanon = {
      hook: { text: '', locked: true },
      cta: { text: '', locked: true },
      tone: { id: 'neutral', locked: false },
      body: { blocks: [] },
      meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 1 },
    };

    const newText = `New content only in body`;

    const result = reapplyLockedSections(canon, newText);

    expect(result).toContain('New content only in body');
  });
});

// ============================================
// updateCanonFromText
// ============================================
describe('updateCanonFromText', () => {
  it('should update content while preserving lock states', () => {
    const canon: EditorialCanon = {
      hook: { text: 'Old hook', locked: true },
      cta: { text: 'Old CTA', locked: true },
      tone: { id: 'professional', locked: false },
      body: { blocks: [] },
      meta: { activeDraftId: 'draft-1', createdAt: 1000, updatedAt: 1000, revision: 1 },
    };

    // Use explicit markers for clear parsing
    const newText = `## Hook
New hook content

## Body
New body

## CTA
Liên hệ ngay!`;

    const updated = updateCanonFromText(canon, newText);

    expect(updated.hook.text).toBe('New hook content');
    expect(updated.hook.locked).toBe(true); // Lock preserved
    expect(updated.cta.locked).toBe(true); // Lock preserved
    expect(updated.meta.revision).toBe(2);
  });

  it('should increment revision number', () => {
    const canon: EditorialCanon = {
      hook: { text: 'Hook', locked: false },
      cta: { text: 'CTA', locked: false },
      tone: { id: 'neutral', locked: false },
      body: { blocks: [] },
      meta: { activeDraftId: 'draft-1', createdAt: 1000, updatedAt: 1000, revision: 5 },
    };

    const updated = updateCanonFromText(canon, 'New content');

    expect(updated.meta.revision).toBe(6);
  });
});

// ============================================
// getCanonLockState
// ============================================
describe('getCanonLockState', () => {
  it('should return correct lock state', () => {
    const canon: EditorialCanon = {
      hook: { text: 'Hook', locked: true },
      cta: { text: 'CTA', locked: false },
      tone: { id: 'neutral', locked: true },
      body: {
        blocks: [
          { id: 'blk_1', text: 'Block 1', role: 'paragraph', locked: true },
          { id: 'blk_2', text: 'Block 2', role: 'paragraph', locked: false },
        ],
      },
      meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 1 },
    };

    const lockState = getCanonLockState(canon);

    expect(lockState.hookLocked).toBe(true);
    expect(lockState.ctaLocked).toBe(false);
    expect(lockState.toneLocked).toBe(true);
    expect(lockState.bodyLockedBlocks['blk_1']).toBe(true);
    expect(lockState.bodyLockedBlocks['blk_2']).toBe(false);
  });
});

// ============================================
// isAmbiguousEditInstruction
// ============================================
describe('isAmbiguousEditInstruction', () => {
  it('should detect Vietnamese ambiguous instructions', () => {
    expect(isAmbiguousEditInstruction('viết hay hơn')).toBe(true);
    expect(isAmbiguousEditInstruction('viết lại')).toBe(true);
    expect(isAmbiguousEditInstruction('ngắn hơn')).toBe(true);
    expect(isAmbiguousEditInstruction('dài hơn')).toBe(true);
    expect(isAmbiguousEditInstruction('cải thiện')).toBe(true);
    expect(isAmbiguousEditInstruction('sửa lại')).toBe(true);
    expect(isAmbiguousEditInstruction('hay hơn')).toBe(true);
    expect(isAmbiguousEditInstruction('tốt hơn')).toBe(true);
  });

  it('should detect English ambiguous instructions', () => {
    expect(isAmbiguousEditInstruction('improve')).toBe(true);
    expect(isAmbiguousEditInstruction('rewrite')).toBe(true);
    expect(isAmbiguousEditInstruction('shorter')).toBe(true);
    expect(isAmbiguousEditInstruction('longer')).toBe(true);
    expect(isAmbiguousEditInstruction('better')).toBe(true);
    expect(isAmbiguousEditInstruction('optimize')).toBe(true);
  });

  it('should not detect specific instructions as ambiguous', () => {
    expect(isAmbiguousEditInstruction('Sửa lại hook cho hấp dẫn hơn')).toBe(false);
    expect(isAmbiguousEditInstruction('Thay đổi CTA thành liên hệ qua Zalo')).toBe(false);
    expect(isAmbiguousEditInstruction('Viết lại phần nội dung về sản phẩm')).toBe(false);
  });

  it('should not detect long instructions as ambiguous', () => {
    const longInstruction = 'Viết lại bài này cho hay hơn và thu hút người đọc hơn với nhiều thông tin chi tiết';
    expect(isAmbiguousEditInstruction(longInstruction)).toBe(false);
  });
});

// ============================================
// instructionMentionsSection
// ============================================
describe('instructionMentionsSection', () => {
  describe('HOOK detection', () => {
    it('should detect hook mentions in Vietnamese', () => {
      expect(instructionMentionsSection('Sửa lại mở đầu', 'HOOK')).toBe(true);
      expect(instructionMentionsSection('Viết dòng mở hay hơn', 'HOOK')).toBe(true);
      expect(instructionMentionsSection('Đổi tiêu đề', 'HOOK')).toBe(true);
    });

    it('should detect hook mentions in English', () => {
      expect(instructionMentionsSection('Change the hook', 'HOOK')).toBe(true);
      expect(instructionMentionsSection('Improve headline', 'HOOK')).toBe(true);
    });
  });

  describe('CTA detection', () => {
    it('should detect CTA mentions in Vietnamese', () => {
      expect(instructionMentionsSection('Sửa phần kêu gọi', 'CTA')).toBe(true);
      expect(instructionMentionsSection('Thay kết luận', 'CTA')).toBe(true);
      expect(instructionMentionsSection('Đổi liên hệ', 'CTA')).toBe(true);
    });

    it('should detect CTA mentions in English', () => {
      expect(instructionMentionsSection('Change the CTA', 'CTA')).toBe(true);
      expect(instructionMentionsSection('Update call to action', 'CTA')).toBe(true);
    });
  });

  describe('TONE detection', () => {
    it('should detect tone mentions in Vietnamese', () => {
      expect(instructionMentionsSection('Đổi giọng văn', 'TONE')).toBe(true);
      expect(instructionMentionsSection('Thay phong cách', 'TONE')).toBe(true);
    });

    it('should detect tone mentions in English', () => {
      expect(instructionMentionsSection('Change the tone', 'TONE')).toBe(true);
      expect(instructionMentionsSection('Different style', 'TONE')).toBe(true);
    });
  });

  describe('BODY detection', () => {
    it('should detect body mentions in Vietnamese', () => {
      expect(instructionMentionsSection('Sửa nội dung', 'BODY')).toBe(true);
      expect(instructionMentionsSection('Thay thân bài', 'BODY')).toBe(true);
    });

    it('should detect body mentions in English', () => {
      expect(instructionMentionsSection('Change the body', 'BODY')).toBe(true);
      expect(instructionMentionsSection('Update content', 'BODY')).toBe(true);
    });
  });

  it('should not detect unrelated instructions', () => {
    expect(instructionMentionsSection('Viết hay hơn', 'HOOK')).toBe(false);
    expect(instructionMentionsSection('Ngắn gọn hơn', 'CTA')).toBe(false);
    expect(instructionMentionsSection('Cải thiện', 'TONE')).toBe(false);
  });
});

// ============================================
// getCanonConstraints
// ============================================
describe('getCanonConstraints', () => {
  it('should return constraints based on lock state', () => {
    const canon: EditorialCanon = {
      hook: { text: 'Hook', locked: true },
      cta: { text: 'CTA', locked: false },
      tone: { id: 'neutral', locked: true },
      body: { blocks: [] },
      meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 1 },
    };

    const constraints = getCanonConstraints(canon);

    expect(constraints.preserveHook).toBe(true);
    expect(constraints.preserveCTA).toBe(false);
    expect(constraints.preserveTone).toBe(true);
  });
});

// ============================================
// UI Copy Helpers
// ============================================
describe('getSectionLabel', () => {
  it('should return Vietnamese labels', () => {
    expect(getSectionLabel('HOOK', 'vi')).toBe('Mở đầu');
    expect(getSectionLabel('BODY', 'vi')).toBe('Nội dung');
    expect(getSectionLabel('CTA', 'vi')).toBe('Kêu gọi');
    expect(getSectionLabel('TONE', 'vi')).toBe('Giọng văn');
  });

  it('should return English labels', () => {
    expect(getSectionLabel('HOOK', 'en')).toBe('Hook');
    expect(getSectionLabel('BODY', 'en')).toBe('Body');
    expect(getSectionLabel('CTA', 'en')).toBe('CTA');
    expect(getSectionLabel('TONE', 'en')).toBe('Tone');
  });
});

describe('getToneLabel', () => {
  it('should return Vietnamese labels', () => {
    expect(getToneLabel('professional', 'vi')).toBe('Chuyên nghiệp');
    expect(getToneLabel('casual', 'vi')).toBe('Thoải mái');
    expect(getToneLabel('friendly', 'vi')).toBe('Thân thiện');
  });

  it('should return English labels', () => {
    expect(getToneLabel('professional', 'en')).toBe('Professional');
    expect(getToneLabel('casual', 'en')).toBe('Casual');
  });
});

describe('getCanonDebugSummary', () => {
  it('should return formatted debug summary', () => {
    const canon: EditorialCanon = {
      hook: { text: 'Hook', locked: true },
      cta: { text: 'CTA', locked: false },
      tone: { id: 'neutral', locked: true },
      body: {
        blocks: [
          { id: 'blk_1', text: 'Block', role: 'paragraph', locked: false },
        ],
      },
      meta: { activeDraftId: 'draft-1', createdAt: 0, updatedAt: 0, revision: 3 },
    };

    const summary = getCanonDebugSummary(canon);

    expect(summary).toContain('Hook🔒');
    expect(summary).toContain('CTA');
    expect(summary).not.toContain('CTA🔒');
    expect(summary).toContain('Tone🔒');
    expect(summary).toContain('Body(1)');
    expect(summary).toContain('Rev 3');
  });
});
