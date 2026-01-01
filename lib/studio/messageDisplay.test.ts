// ============================================
// Tests for Message Display Utilities
// ============================================
// CONCEPTUAL INVARIANT: displayedUserMessage === userTypedText
//
// USER MESSAGE ≠ ACTION
// - userTypedText: ALWAYS what the user expressed (typed OR clicked)
// - actionLabel: Internal only (for badges/chips, NEVER for message display)
// ============================================

import { describe, it, expect } from 'vitest';
import {
  getDisplayedUserMessageText,
  getUserMessageDisplayMode,
  isTransformMessage,
  getTransformActionLabel,
} from './messageDisplay';
import type { ChatMessage } from '@/types/studio';

// Helper to create test messages
function createUserMessage(
  content: string,
  meta?: ChatMessage['meta']
): ChatMessage {
  return {
    id: `user-${Date.now()}`,
    role: 'user',
    content,
    timestamp: new Date(),
    meta,
  };
}

function createAssistantMessage(content: string): ChatMessage {
  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content,
    timestamp: new Date(),
  };
}

// ============================================
// CORE INVARIANT TESTS
// ============================================
// These tests verify the fundamental invariant:
// displayedUserMessage === userTypedText
// ============================================

describe('INVARIANT: displayedUserMessage === userTypedText', () => {
  describe('userTypedText is the ONLY source of truth', () => {
    it('should return userTypedText when present', () => {
      const msg = createUserMessage('internal content', {
        userTypedText: 'viết lại giọng tự nhiên hơn',
        actionLabel: 'Viết lại', // Should be IGNORED
        transformMode: 'PURE_TRANSFORM', // Should be IGNORED
        sourceMessageId: 'msg-123',
      });
      expect(getDisplayedUserMessageText(msg)).toBe('viết lại giọng tự nhiên hơn');
    });

    it('should NEVER display actionLabel even if userTypedText matches', () => {
      // Even if userTypedText equals actionLabel, we use userTypedText
      const msg = createUserMessage('Viết lại', {
        userTypedText: 'Viết lại',
        actionLabel: 'Viết lại',
        transformMode: 'PURE_TRANSFORM',
        sourceMessageId: 'msg-123',
      });
      expect(getDisplayedUserMessageText(msg)).toBe('Viết lại');
    });

    it('should preserve full instruction regardless of transformMode', () => {
      // PURE_TRANSFORM should NOT truncate userTypedText
      const msg = createUserMessage('internal', {
        userTypedText: 'rút gọn còn 50 từ, giữ nguyên CTA',
        actionLabel: 'Rút gọn',
        transformMode: 'PURE_TRANSFORM', // Even with PURE mode
        sourceMessageId: 'msg-123',
      });
      expect(getDisplayedUserMessageText(msg)).toBe('rút gọn còn 50 từ, giữ nguyên CTA');
    });
  });

  describe('Button click scenario (user clicked action button)', () => {
    it('should display what user expressed via button', () => {
      // When user clicks "Viết lại" button, userTypedText = "Viết lại"
      const msg = createUserMessage('Viết lại', {
        userTypedText: 'Viết lại', // What they expressed
        actionLabel: 'Viết lại', // Internal
        transformMode: 'PURE_TRANSFORM',
        sourceMessageId: 'msg-123',
      });
      expect(getDisplayedUserMessageText(msg)).toBe('Viết lại');
    });

    it('should display "Rút gọn" when user clicked shorten button', () => {
      const msg = createUserMessage('Rút gọn', {
        userTypedText: 'Rút gọn',
        actionLabel: 'Rút gọn',
        transformMode: 'PURE_TRANSFORM',
        sourceMessageId: 'msg-123',
      });
      expect(getDisplayedUserMessageText(msg)).toBe('Rút gọn');
    });
  });

  describe('Typed instruction scenario', () => {
    it('should preserve full typed instruction', () => {
      const instruction = 'viết lại theo phong cách Gen Z, thêm emoji, giữ nguyên thông tin chính';
      const msg = createUserMessage('internal', {
        userTypedText: instruction,
        actionLabel: 'Viết lại',
        transformMode: 'DIRECTED_TRANSFORM',
        sourceMessageId: 'msg-123',
      });
      expect(getDisplayedUserMessageText(msg)).toBe(instruction);
    });

    it('should preserve multi-intent instruction verbatim', () => {
      const instruction = 'viết lại + đổi giọng + thêm hotline 0878123456 + rút gọn';
      const msg = createUserMessage('internal', {
        userTypedText: instruction,
        actionLabel: 'Viết lại', // Only captures primary action
        transformMode: 'DIRECTED_TRANSFORM',
        sourceMessageId: 'msg-123',
      });
      expect(getDisplayedUserMessageText(msg)).toBe(instruction);
    });

    it('should never truncate to action label', () => {
      const msg = createUserMessage('internal', {
        userTypedText: 'viết lại bài này dài hơn, giọng chuyên nghiệp',
        actionLabel: 'Viết lại',
        sourceMessageId: 'msg-123',
      });
      const displayed = getDisplayedUserMessageText(msg);
      expect(displayed).toBe('viết lại bài này dài hơn, giọng chuyên nghiệp');
      expect(displayed).not.toBe('Viết lại'); // NEVER just the action
    });
  });
});

// ============================================
// CREATE MODE TESTS
// ============================================

describe('CREATE mode (no transform)', () => {
  it('should return content for simple messages without meta', () => {
    const msg = createUserMessage('Viết bài về du lịch Đà Nẵng');
    expect(getDisplayedUserMessageText(msg)).toBe('Viết bài về du lịch Đà Nẵng');
  });

  it('should return userTypedText when present in CREATE mode', () => {
    const msg = createUserMessage('internal', {
      userTypedText: 'Viết bài về MIK Ocean City',
      templateId: 'social_caption_v1',
    });
    expect(getDisplayedUserMessageText(msg)).toBe('Viết bài về MIK Ocean City');
  });

  it('should fall back to content for legacy messages', () => {
    const msg = createUserMessage('Legacy content without userTypedText', {
      templateId: 'social_caption_v1',
      requestId: 'req-123',
    });
    expect(getDisplayedUserMessageText(msg)).toBe('Legacy content without userTypedText');
  });
});

// ============================================
// LEGACY COMPATIBILITY TESTS
// ============================================

describe('Legacy compatibility (deprecated userInstruction field)', () => {
  it('should read from legacy userInstruction if userTypedText missing', () => {
    // Old messages may have userInstruction instead of userTypedText
    const msg = createUserMessage('internal', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userInstruction: 'legacy instruction text',
      sourceMessageId: 'msg-123',
    } as any);
    expect(getDisplayedUserMessageText(msg)).toBe('legacy instruction text');
  });

  it('should prefer userTypedText over userInstruction', () => {
    const msg = createUserMessage('internal', {
      userTypedText: 'new field',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userInstruction: 'legacy field',
      sourceMessageId: 'msg-123',
    } as any);
    expect(getDisplayedUserMessageText(msg)).toBe('new field');
  });
});

// ============================================
// ASSISTANT MESSAGE TESTS
// ============================================

describe('Assistant messages', () => {
  it('should return content for assistant messages', () => {
    const msg = createAssistantMessage('AI-generated content here');
    expect(getDisplayedUserMessageText(msg)).toBe('AI-generated content here');
  });
});

// ============================================
// DISPLAY MODE TESTS (for styling only)
// ============================================

describe('getUserMessageDisplayMode (styling only)', () => {
  it('should return CREATE for messages without source', () => {
    const msg = createUserMessage('Create something', {
      userTypedText: 'Create something',
    });
    expect(getUserMessageDisplayMode(msg)).toBe('CREATE');
  });

  it('should return DIRECTED_TRANSFORM when mode is set', () => {
    const msg = createUserMessage('instruction', {
      userTypedText: 'viết lại giọng tự nhiên',
      transformMode: 'DIRECTED_TRANSFORM',
      sourceMessageId: 'msg-123',
    });
    expect(getUserMessageDisplayMode(msg)).toBe('DIRECTED_TRANSFORM');
  });

  it('should return PURE_TRANSFORM for button clicks', () => {
    const msg = createUserMessage('Viết lại', {
      userTypedText: 'Viết lại',
      transformMode: 'PURE_TRANSFORM',
      sourceMessageId: 'msg-123',
    });
    expect(getUserMessageDisplayMode(msg)).toBe('PURE_TRANSFORM');
  });
});

// ============================================
// UTILITY FUNCTION TESTS
// ============================================

describe('isTransformMessage', () => {
  it('should return true for user messages with sourceMessageId', () => {
    const msg = createUserMessage('Transform', {
      userTypedText: 'Viết lại',
      sourceMessageId: 'msg-123',
    });
    expect(isTransformMessage(msg)).toBe(true);
  });

  it('should return false for CREATE messages', () => {
    const msg = createUserMessage('Create content', {
      userTypedText: 'Create content',
    });
    expect(isTransformMessage(msg)).toBe(false);
  });

  it('should return false for assistant messages', () => {
    const msg = createAssistantMessage('AI response');
    expect(isTransformMessage(msg)).toBe(false);
  });
});

describe('getTransformActionLabel', () => {
  it('should return actionLabel for transform messages', () => {
    const msg = createUserMessage('instruction', {
      userTypedText: 'viết lại giọng tự nhiên',
      actionLabel: 'Viết lại',
      sourceMessageId: 'msg-123',
    });
    expect(getTransformActionLabel(msg)).toBe('Viết lại');
  });

  it('should return null for non-transform messages', () => {
    const msg = createUserMessage('Create content', {
      userTypedText: 'Create content',
    });
    expect(getTransformActionLabel(msg)).toBe(null);
  });
});

// ============================================
// REGRESSION TESTS
// ============================================
// These tests prevent the previous bugs from recurring

describe('Regression: User instruction truncation bug', () => {
  it('should preserve "viết lại giọng tự nhiên hơn" not just "Viết lại"', () => {
    const msg = createUserMessage('internal', {
      userTypedText: 'viết lại giọng tự nhiên hơn',
      actionLabel: 'Viết lại',
      transformMode: 'PURE_TRANSFORM', // Bug: classifier returned PURE
      sourceMessageId: 'msg-123',
    });
    expect(getDisplayedUserMessageText(msg)).toBe('viết lại giọng tự nhiên hơn');
    expect(getDisplayedUserMessageText(msg)).not.toBe('Viết lại');
  });

  it('should preserve instruction on 3rd, 4th, 5th transform', () => {
    // The original bug manifested on prompt #3 and beyond
    const instructions = [
      'mở rộng phần giới thiệu thêm chi tiết',
      'rút gọn phần cuối còn 2 câu',
      'thêm CTA kêu gọi liên hệ',
    ];

    instructions.forEach((instruction, i) => {
      const msg = createUserMessage('internal', {
        userTypedText: instruction,
        actionLabel: ['Mở rộng', 'Rút gọn', 'Viết lại'][i],
        transformMode: 'PURE_TRANSFORM',
        sourceMessageId: `msg-transform-${i + 1}`,
      });
      expect(getDisplayedUserMessageText(msg)).toBe(instruction);
    });
  });
});

describe('Regression: actionLabel should NEVER be displayed as user content', () => {
  it('should not use actionLabel even when userTypedText is missing (legacy)', () => {
    // For legacy messages without userTypedText, fall back to content NOT actionLabel
    const msg = createUserMessage('Legacy content', {
      actionLabel: 'Viết lại',
      sourceMessageId: 'msg-123',
    });
    // Should NOT return 'Viết lại' - actionLabel is internal only
    expect(getDisplayedUserMessageText(msg)).toBe('Legacy content');
  });
});

// ============================================
// CONCEPTUAL TESTS
// ============================================
// These tests enforce the architectural principle:
// USER MESSAGE ≠ ACTION

describe('Conceptual: USER MESSAGE ≠ ACTION', () => {
  it('user message represents what user said, not system classification', () => {
    // User typed: "viết lại bài này cho chuyên nghiệp hơn"
    // System classified as: REWRITE action
    // Display should show: what user SAID, not what system classified
    const msg = createUserMessage('internal', {
      userTypedText: 'viết lại bài này cho chuyên nghiệp hơn',
      actionLabel: 'Viết lại', // System classification
      actionType: 'REWRITE', // System classification
      sourceMessageId: 'msg-123',
    });

    const displayed = getDisplayedUserMessageText(msg);

    // Must show USER'S words
    expect(displayed).toBe('viết lại bài này cho chuyên nghiệp hơn');
    // Must NOT show system classification
    expect(displayed).not.toBe('Viết lại');
    expect(displayed).not.toBe('REWRITE');
  });

  it('actionLabel is for UI badges only, not message content', () => {
    const msg = createUserMessage('internal', {
      userTypedText: 'rút gọn còn 100 từ',
      actionLabel: 'Rút gọn',
      sourceMessageId: 'msg-123',
    });

    // Message display: user's words
    expect(getDisplayedUserMessageText(msg)).toBe('rút gọn còn 100 từ');

    // Action label: available for badges/chips (via separate function)
    expect(getTransformActionLabel(msg)).toBe('Rút gọn');
  });
});
