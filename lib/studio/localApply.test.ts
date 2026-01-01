// ============================================
// STEP 6.6: Local Apply Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  localApply,
  detectOperations,
  canHandleLocally,
  getOperationLabel
} from './localApply';

describe('localApply', () => {
  // ============================================
  // Operation Detection
  // ============================================

  describe('detectOperations', () => {
    it('should detect FIX_WHITESPACE from Vietnamese instruction', () => {
      const ops = detectOperations('sửa khoảng trắng');
      expect(ops).toContain('FIX_WHITESPACE');
    });

    it('should detect ADD_BULLETS from Vietnamese instruction', () => {
      const ops = detectOperations('thêm bullet');
      expect(ops).toContain('ADD_BULLETS');
    });

    it('should detect REMOVE_EMOJI from Vietnamese instruction', () => {
      const ops = detectOperations('bỏ emoji');
      expect(ops).toContain('REMOVE_EMOJI');
    });

    it('should detect UPPERCASE from Vietnamese instruction', () => {
      const ops = detectOperations('viết hoa');
      expect(ops).toContain('UPPERCASE');
    });

    it('should detect LOWERCASE from Vietnamese instruction', () => {
      const ops = detectOperations('viết thường');
      expect(ops).toContain('LOWERCASE');
    });

    it('should detect multiple operations', () => {
      const ops = detectOperations('bỏ emoji và thêm bullet');
      expect(ops).toContain('REMOVE_EMOJI');
      expect(ops).toContain('ADD_BULLETS');
    });

    it('should return empty array for unrecognized instruction', () => {
      const ops = detectOperations('viết lại hay hơn');
      expect(ops).toHaveLength(0);
    });
  });

  describe('canHandleLocally', () => {
    it('should return true for recognized local operations', () => {
      expect(canHandleLocally('thêm bullet')).toBe(true);
      expect(canHandleLocally('bỏ emoji')).toBe(true);
      expect(canHandleLocally('viết hoa')).toBe(true);
    });

    it('should return false for LLM-requiring instructions', () => {
      expect(canHandleLocally('viết lại hay hơn')).toBe(false);
      expect(canHandleLocally('ngắn hơn')).toBe(false);
      expect(canHandleLocally('chuyên nghiệp hơn')).toBe(false);
    });
  });

  // ============================================
  // Transform Operations
  // ============================================

  describe('FIX_WHITESPACE', () => {
    it('should normalize whitespace', () => {
      const result = localApply('Hello   world', 'sửa khoảng trắng');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('Hello world');
    });

    it('should trim lines', () => {
      const result = localApply('  Hello world  ', 'clean up');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('Hello world');
    });

    it('should collapse multiple newlines', () => {
      const result = localApply('Line 1\n\n\n\nLine 2', 'dọn dẹp');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('Line 1\n\nLine 2');
    });
  });

  describe('ADD_BULLETS', () => {
    it('should add bullets to lines', () => {
      const result = localApply('Item 1\nItem 2\nItem 3', 'thêm bullet');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('• Item 1\n• Item 2\n• Item 3');
    });

    it('should skip lines that already have bullets', () => {
      const result = localApply('• Item 1\nItem 2', 'thêm bullet');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('• Item 1\n• Item 2');
    });

    it('should skip numbered lines', () => {
      const result = localApply('1. Item 1\nItem 2', 'thêm bullet');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('1. Item 1\n• Item 2');
    });
  });

  describe('REMOVE_BULLETS', () => {
    it('should remove bullet points', () => {
      const result = localApply('• Item 1\n• Item 2', 'bỏ bullet');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('Item 1\nItem 2');
    });

    it('should remove numbered list markers', () => {
      const result = localApply('1. Item 1\n2. Item 2', 'xóa bullet');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('Item 1\nItem 2');
    });
  });

  describe('REMOVE_EMOJI', () => {
    it('should remove emoji from content', () => {
      const result = localApply('Hello 🔥 World 🎉', 'bỏ emoji');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('Hello World');
    });
  });

  describe('UPPERCASE', () => {
    it('should convert to uppercase', () => {
      const result = localApply('Hello World', 'viết hoa');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('HELLO WORLD');
    });
  });

  describe('LOWERCASE', () => {
    it('should convert to lowercase', () => {
      const result = localApply('HELLO WORLD', 'viết thường');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('hello world');
    });
  });

  describe('TITLE_CASE', () => {
    it('should convert to title case', () => {
      const result = localApply('hello world', 'viết hoa đầu');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('Hello World');
    });
  });

  describe('REMOVE_HASHTAGS', () => {
    it('should remove hashtags', () => {
      const result = localApply('Content here #marketing #social', 'bỏ hashtag');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('Content here');
    });
  });

  describe('TRIM_LINES', () => {
    it('should remove empty lines', () => {
      const result = localApply('Line 1\n\n\nLine 2\n\nLine 3', 'xóa dòng trống');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('NUMBER_LINES', () => {
    it('should number lines', () => {
      const result = localApply('Item A\nItem B\nItem C', 'đánh số dòng');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('1. Item A\n2. Item B\n3. Item C');
    });

    it('should skip already numbered lines', () => {
      const result = localApply('1. Item A\nItem B', 'đánh số');
      expect(result.ok).toBe(true);
      expect(result.nextContent).toBe('1. Item A\n2. Item B');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('edge cases', () => {
    it('should return error for empty content', () => {
      const result = localApply('', 'thêm bullet');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('Nội dung trống');
    });

    it('should return error for empty instruction', () => {
      const result = localApply('Content here', '');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('Chưa có hướng dẫn');
    });

    it('should return error for unrecognized operation', () => {
      const result = localApply('Content', 'làm hay hơn');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('Không nhận diện được thao tác cục bộ');
    });

    it('should return error if content unchanged', () => {
      // Content already has bullets
      const result = localApply('• Item 1\n• Item 2', 'thêm bullet');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('Không có thay đổi (nội dung đã đúng định dạng)');
    });
  });

  // ============================================
  // Utility Functions
  // ============================================

  describe('getOperationLabel', () => {
    it('should return Vietnamese labels', () => {
      expect(getOperationLabel('ADD_BULLETS')).toBe('Thêm bullet');
      expect(getOperationLabel('REMOVE_EMOJI')).toBe('Bỏ emoji');
      expect(getOperationLabel('UPPERCASE')).toBe('Viết hoa');
    });
  });
});
