// ============================================
// STEP 27 + STEP 28: Rewrite Confirmation Dialog Tests
// ============================================
// Tests for dialog module exports and copy snapshots.
// STEP 28: Snapshot tests lock the copy wording.
// ============================================

import { describe, it, expect } from 'vitest';
import { DIALOG_COPY } from './RewriteConfirmationDialog';

describe('RewriteConfirmationDialog', () => {
  describe('Module exports', () => {
    it('should export RewriteConfirmationDialog component', async () => {
      const module = await import('./RewriteConfirmationDialog');
      expect(module.RewriteConfirmationDialog).toBeDefined();
      expect(typeof module.RewriteConfirmationDialog).toBe('function');
    });

    it('should have default export', async () => {
      const module = await import('./RewriteConfirmationDialog');
      expect(module.default).toBeDefined();
      expect(typeof module.default).toBe('function');
    });

    it('should export DIALOG_COPY', async () => {
      const module = await import('./RewriteConfirmationDialog');
      expect(module.DIALOG_COPY).toBeDefined();
      expect(module.DIALOG_COPY.vi).toBeDefined();
      expect(module.DIALOG_COPY.en).toBeDefined();
    });
  });

  // ============================================
  // STEP 28: Copy Snapshot Tests (Expectation Lock)
  // ============================================
  // These tests FAIL if copy wording changes unintentionally.
  // To update: change expected values here AND in component.

  describe('Vietnamese copy snapshot', () => {
    it('title should match locked wording', () => {
      expect(DIALOG_COPY.vi.title).toBe('Viết lại bài đang mở');
    });

    it('subtitle should match locked wording', () => {
      expect(DIALOG_COPY.vi.subtitle).toBe('Chỉ để hay hơn, không tạo bài mới');
    });

    it('description should match locked wording', () => {
      expect(DIALOG_COPY.vi.description).toBe('Bạn đang yêu cầu CẢI THIỆN bài viết hiện tại.');
    });

    it('notExpect label should match locked wording', () => {
      expect(DIALOG_COPY.vi.notExpect).toBe('Hệ thống sẽ KHÔNG:');
    });

    it('bullet1 should match locked wording', () => {
      expect(DIALOG_COPY.vi.bullet1).toBe('Tạo bài mới hoàn toàn');
    });

    it('bullet2 should match locked wording', () => {
      expect(DIALOG_COPY.vi.bullet2).toBe('Thay đổi chủ đề hoặc góc nhìn');
    });

    it('bullet3 should match locked wording', () => {
      expect(DIALOG_COPY.vi.bullet3).toBe('Thêm hook mới, CTA mới, hoặc mở rộng nội dung');
    });

    it('hint should match locked wording', () => {
      expect(DIALOG_COPY.vi.hint).toBe('Nếu bạn muốn bài hoàn toàn mới, hãy chọn "Tạo bài mới" bên dưới.');
    });

    it('confirmRewrite button should match locked wording', () => {
      expect(DIALOG_COPY.vi.confirmRewrite).toBe('Đồng ý, chỉ viết hay hơn');
    });

    it('createNew button should match locked wording', () => {
      expect(DIALOG_COPY.vi.createNew).toBe('Tạo bài mới thay vì viết lại');
    });

    it('cancel button should match locked wording', () => {
      expect(DIALOG_COPY.vi.cancel).toBe('Hủy');
    });
  });

  describe('English copy snapshot', () => {
    it('title should match locked wording', () => {
      expect(DIALOG_COPY.en.title).toBe('Rewrite current post');
    });

    it('subtitle should match locked wording', () => {
      expect(DIALOG_COPY.en.subtitle).toBe('Improve wording only, not create new');
    });

    it('description should match locked wording', () => {
      expect(DIALOG_COPY.en.description).toBe('You are requesting to IMPROVE the current post.');
    });

    it('notExpect label should match locked wording', () => {
      expect(DIALOG_COPY.en.notExpect).toBe('The system will NOT:');
    });

    it('bullet1 should match locked wording', () => {
      expect(DIALOG_COPY.en.bullet1).toBe('Create a completely new post');
    });

    it('bullet2 should match locked wording', () => {
      expect(DIALOG_COPY.en.bullet2).toBe('Change the topic or angle');
    });

    it('bullet3 should match locked wording', () => {
      expect(DIALOG_COPY.en.bullet3).toBe('Add new hook, new CTA, or expand content');
    });

    it('hint should match locked wording', () => {
      expect(DIALOG_COPY.en.hint).toBe('If you want a brand new post, choose "Create new post" below.');
    });

    it('confirmRewrite button should match locked wording', () => {
      expect(DIALOG_COPY.en.confirmRewrite).toBe('Yes, just improve wording');
    });

    it('createNew button should match locked wording', () => {
      expect(DIALOG_COPY.en.createNew).toBe('Create new post instead');
    });

    it('cancel button should match locked wording', () => {
      expect(DIALOG_COPY.en.cancel).toBe('Cancel');
    });
  });

  describe('Copy structure completeness', () => {
    it('Vietnamese copy should have all required keys', () => {
      const requiredKeys = [
        'title', 'subtitle', 'description', 'notExpect',
        'bullet1', 'bullet2', 'bullet3', 'hint',
        'confirmRewrite', 'createNew', 'cancel'
      ];
      for (const key of requiredKeys) {
        expect(DIALOG_COPY.vi).toHaveProperty(key);
        expect(typeof DIALOG_COPY.vi[key as keyof typeof DIALOG_COPY.vi]).toBe('string');
      }
    });

    it('English copy should have all required keys', () => {
      const requiredKeys = [
        'title', 'subtitle', 'description', 'notExpect',
        'bullet1', 'bullet2', 'bullet3', 'hint',
        'confirmRewrite', 'createNew', 'cancel'
      ];
      for (const key of requiredKeys) {
        expect(DIALOG_COPY.en).toHaveProperty(key);
        expect(typeof DIALOG_COPY.en[key as keyof typeof DIALOG_COPY.en]).toBe('string');
      }
    });
  });
});
