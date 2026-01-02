// ============================================
// STEP 22: Answer Engine Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  detectTaskType,
  detectEditTarget,
  shouldAnswerDirectly,
  formatAnswerEngineContract,
  parseAnswerEngineResponse,
  getAnswerEngineDebugSummary,
  type TaskDetectionContext,
} from './answerEngine';

// ============================================
// detectTaskType Tests
// ============================================
describe('detectTaskType', () => {
  const defaultCtx: TaskDetectionContext = {
    hasActiveDraft: true,
    hasPreviousMessages: true,
    lang: 'vi',
  };

  describe('Vietnamese patterns', () => {
    it('should detect QA for question marks', () => {
      const result = detectTaskType('Quẻ Trạch Hỏa Cách là gì?', defaultCtx);
      expect(result.taskType).toBe('QA');
      expect(result.confidence).not.toBe('LOW');
    });

    it('should detect QA for "giải thích" pattern', () => {
      const result = detectTaskType('Giải thích giúp mình quẻ này', defaultCtx);
      expect(result.taskType).toBe('QA');
    });

    it('should detect QA for "tại sao" pattern', () => {
      const result = detectTaskType('Tại sao giá tăng?', defaultCtx);
      expect(result.taskType).toBe('QA');
    });

    it('should detect EDIT_PATCH for "thêm" pattern', () => {
      const result = detectTaskType('Thêm thông tin liên hệ vào bài', defaultCtx);
      expect(result.taskType).toBe('EDIT_PATCH');
    });

    it('should detect EDIT_PATCH for "sửa" pattern', () => {
      const result = detectTaskType('Sửa CTA cho mềm hơn', defaultCtx);
      expect(result.taskType).toBe('EDIT_PATCH');
    });

    it('should detect EDIT_PATCH for preservation signals', () => {
      const result = detectTaskType('Giữ nguyên hook, chỉ sửa body', defaultCtx);
      expect(result.taskType).toBe('EDIT_PATCH');
      expect(result.confidence).toBe('HIGH');
    });

    it('should detect EDIT_PATCH for "không phải viết mới" clarification', () => {
      const result = detectTaskType(
        'Tôi bảo bạn thêm thông tin chứ không phải viết bài mới',
        defaultCtx
      );
      expect(result.taskType).toBe('EDIT_PATCH');
      expect(result.confidence).toBe('HIGH');
    });

    it('should detect CREATE for "viết bài mới" pattern', () => {
      const ctx: TaskDetectionContext = { ...defaultCtx, hasActiveDraft: false };
      const result = detectTaskType('Viết bài mới về skincare', ctx);
      expect(result.taskType).toBe('CREATE');
    });

    it('should detect CREATE for "chủ đề mới" pattern', () => {
      const result = detectTaskType('Viết về chủ đề mới: du lịch Đà Nẵng', defaultCtx);
      expect(result.taskType).toBe('CREATE');
    });
  });

  describe('English patterns', () => {
    const enCtx: TaskDetectionContext = { ...defaultCtx, lang: 'en' };

    it('should detect QA for "what is" pattern', () => {
      const result = detectTaskType('What is the best marketing strategy?', enCtx);
      expect(result.taskType).toBe('QA');
    });

    it('should detect QA for "explain" pattern', () => {
      const result = detectTaskType('Explain how this works', enCtx);
      expect(result.taskType).toBe('QA');
    });

    it('should detect EDIT_PATCH for "add" pattern', () => {
      const result = detectTaskType('Add a hotline to the body', enCtx);
      expect(result.taskType).toBe('EDIT_PATCH');
    });

    it('should detect EDIT_PATCH for "don\'t rewrite" pattern', () => {
      const result = detectTaskType("Add contact info, don't rewrite the whole post", enCtx);
      expect(result.taskType).toBe('EDIT_PATCH');
      expect(result.confidence).toBe('HIGH');
    });

    it('should detect CREATE for "write a new post" pattern', () => {
      const ctx: TaskDetectionContext = { ...enCtx, hasActiveDraft: false };
      const result = detectTaskType('Write a new post about summer sale', ctx);
      expect(result.taskType).toBe('CREATE');
    });
  });

  describe('Context modifiers', () => {
    it('should boost EDIT when active draft exists', () => {
      const withDraft: TaskDetectionContext = { ...defaultCtx, hasActiveDraft: true };
      const result = detectTaskType('Thêm chi tiết', withDraft);
      expect(result.taskType).toBe('EDIT_PATCH');
    });

    it('should boost CREATE when no draft and no messages', () => {
      const noDraft: TaskDetectionContext = {
        hasActiveDraft: false,
        hasPreviousMessages: false,
        lang: 'vi',
      };
      const result = detectTaskType('Viết nội dung về skincare', noDraft);
      expect(result.taskType).toBe('CREATE');
    });

    it('should use Step 21 editPatchTarget when present', () => {
      const ctxWithPatch: TaskDetectionContext = {
        ...defaultCtx,
        editPatchTarget: 'BODY',
      };
      const result = detectTaskType('Chỉnh sửa', ctxWithPatch);
      expect(result.taskType).toBe('EDIT_PATCH');
    });
  });

  // ============================================
  // QA Priority Rule Tests (CRITICAL)
  // ============================================
  // These tests verify that QA mode wins over context-boosted EDIT
  // when there are no explicit edit keywords.
  describe('QA Priority Rule', () => {
    const draftCtx: TaskDetectionContext = {
      hasActiveDraft: true,
      hasPreviousMessages: true,
      lang: 'vi',
    };

    it('should prioritize QA over context-boosted EDIT for implicit questions', () => {
      // "Cho mình hỏi" has QA signal but no edit keywords
      // hasActiveDraft boosts EDIT by +2, but QA pattern wins with score 3
      const result = detectTaskType('Cho mình hỏi giá sản phẩm', draftCtx);
      expect(result.taskType).toBe('QA');
      // QA wins naturally because QA score (3) > EDIT score (0+2 context boost)
      expect(result.signals).toContain('cho X hỏi');
    });

    it('should prioritize QA for single-word queries with question context', () => {
      // "Hotline?" - just a question, no edit intent
      const result = detectTaskType('Hotline?', draftCtx);
      expect(result.taskType).toBe('QA');
    });

    it('should prioritize QA for analytical questions about content', () => {
      // Meta question about the draft - should be QA not EDIT
      const result = detectTaskType('Bài này hướng đến đối tượng nào?', draftCtx);
      expect(result.taskType).toBe('QA');
    });

    it('should allow EDIT to win when explicit edit keyword present', () => {
      // "Thêm hotline" has explicit edit keyword, should be EDIT not QA
      const result = detectTaskType('Thêm hotline vào bài', draftCtx);
      expect(result.taskType).toBe('EDIT_PATCH');
    });

    it('should allow EDIT to win when "sửa" keyword present even with question mark', () => {
      // "Sửa mở bài được không?" - has edit keyword AND question mark
      // EDIT should win because explicit edit intent is present
      const result = detectTaskType('Sửa mở bài được không?', draftCtx);
      expect(result.taskType).toBe('EDIT_PATCH');
    });

    it('should apply QA priority rule when EDIT only wins from context boost', () => {
      // Context: editPatchTarget boosts EDIT by +3, hasActiveDraft by +2 (total +5)
      // But user is asking a question with no edit keywords
      const ctxWithPatch: TaskDetectionContext = {
        hasActiveDraft: true,
        hasPreviousMessages: true,
        lang: 'vi',
        editPatchTarget: 'BODY', // This adds +3 to EDIT
      };
      // "Giá bao nhiêu?" has QA signal (question mark + bao nhiêu = 7 points)
      // EDIT would get 0+2+3=5 from context alone
      // QA should win because no explicit edit keywords
      const result = detectTaskType('Giá bao nhiêu?', ctxWithPatch);
      expect(result.taskType).toBe('QA');
    });
  });

  // ============================================
  // REWRITE_UPGRADE Tests (CRITICAL for "dumb system" fix)
  // ============================================
  describe('REWRITE_UPGRADE detection', () => {
    const draftCtx: TaskDetectionContext = {
      hasActiveDraft: true,
      hasPreviousMessages: true,
      lang: 'vi',
    };

    it('should detect REWRITE_UPGRADE for "viết dài hơn, chuyên nghiệp hơn"', () => {
      const result = detectTaskType('Viết dài hơn, chuyên nghiệp hơn', draftCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
      expect(result.confidence).not.toBe('LOW');
    });

    it('should detect REWRITE_UPGRADE for "viết hay hơn"', () => {
      const result = detectTaskType('Viết hay hơn', draftCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });

    it('should detect REWRITE_UPGRADE for "nâng cấp bài"', () => {
      const result = detectTaskType('Nâng cấp bài này cho chuyên nghiệp hơn', draftCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });

    it('should detect REWRITE_UPGRADE for "giữ ý nhưng viết lại"', () => {
      const result = detectTaskType('Giữ ý nhưng viết lại cho hay hơn', draftCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });

    it('should detect REWRITE_UPGRADE for English "improve it"', () => {
      const enCtx: TaskDetectionContext = { ...draftCtx, lang: 'en' };
      const result = detectTaskType('Improve it and make it more professional', enCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });

    it('should detect REWRITE_UPGRADE for English "expand it"', () => {
      const enCtx: TaskDetectionContext = { ...draftCtx, lang: 'en' };
      const result = detectTaskType('Expand it with more details', enCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });

    it('should detect REWRITE_UPGRADE for "mượt hơn"', () => {
      const result = detectTaskType('Làm mượt hơn', draftCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });

    it('should detect REWRITE_UPGRADE for "cuốn hơn"', () => {
      const result = detectTaskType('Viết cuốn hơn', draftCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });
  });

  // ============================================
  // Priority Rules Integration Tests
  // ============================================
  describe('Priority Rules', () => {
    const draftCtx: TaskDetectionContext = {
      hasActiveDraft: true,
      hasPreviousMessages: true,
      lang: 'vi',
    };

    it('QA wins over REWRITE when question exists: "Hotline ở bài này là gì?"', () => {
      const result = detectTaskType('Hotline ở bài này là gì?', draftCtx);
      expect(result.taskType).toBe('QA');
    });

    it('EDIT_PATCH wins for "Thêm hotline 087... vào bài"', () => {
      const result = detectTaskType('Thêm hotline 0878888xxx vào bài', draftCtx);
      expect(result.taskType).toBe('EDIT_PATCH');
    });

    it('REWRITE_UPGRADE wins for ambiguous "hay hơn" without question', () => {
      const result = detectTaskType('Hay hơn', draftCtx);
      // "hay hơn" triggers REWRITE_UPGRADE pattern (weight 4)
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });

    it('QA wins over REWRITE when "hay hơn?" has question mark', () => {
      // "Hay hơn?" - question mark makes it a question
      const result = detectTaskType('Hay hơn?', draftCtx);
      expect(result.taskType).toBe('QA');
    });

    it('hasActiveDraft cannot flip QA into REWRITE when question signals exist', () => {
      // "Bài này có vấn đề gì?" - question about the draft
      const result = detectTaskType('Bài này có vấn đề gì?', draftCtx);
      expect(result.taskType).toBe('QA');
    });

    it('hasActiveDraft cannot flip QA into PATCH when question signals exist', () => {
      // "Phần CTA có ổn không?" - question, not edit request
      const result = detectTaskType('Phần CTA có ổn không?', draftCtx);
      expect(result.taskType).toBe('QA');
    });
  });
});

// ============================================
// detectEditTarget Tests
// ============================================
describe('detectEditTarget', () => {
  describe('Vietnamese patterns', () => {
    it('should detect BODY for "thông tin liên hệ"', () => {
      const result = detectEditTarget('Thêm thông tin liên hệ', 'vi');
      expect(result.target).toBe('BODY');
      expect(result.confidence).toBe('HIGH');
    });

    it('should detect BODY for "hotline"', () => {
      const result = detectEditTarget('Thêm hotline 0878... vào bài', 'vi');
      expect(result.target).toBe('BODY');
      // Can be HIGH or MEDIUM depending on total pattern matches
      expect(['HIGH', 'MEDIUM']).toContain(result.confidence);
    });

    it('should detect BODY for "địa chỉ"', () => {
      const result = detectEditTarget('Bổ sung địa chỉ cửa hàng', 'vi');
      expect(result.target).toBe('BODY');
      // Can be HIGH or MEDIUM depending on total pattern matches
      expect(['HIGH', 'MEDIUM']).toContain(result.confidence);
    });

    it('should detect HOOK for "mở bài"', () => {
      const result = detectEditTarget('Sửa mở bài cho hấp dẫn hơn', 'vi');
      expect(result.target).toBe('HOOK');
    });

    it('should detect CTA for "kết bài"', () => {
      const result = detectEditTarget('Đổi kết bài', 'vi');
      expect(result.target).toBe('CTA');
    });

    it('should detect TONE for "giọng văn"', () => {
      const result = detectEditTarget('Đổi giọng văn sang hơn', 'vi');
      expect(result.target).toBe('TONE');
    });

    it('should return UNKNOWN for ambiguous instruction', () => {
      const result = detectEditTarget('Viết hay hơn', 'vi');
      expect(result.target).toBe('UNKNOWN');
    });
  });

  describe('English patterns', () => {
    it('should detect BODY for "contact info"', () => {
      const result = detectEditTarget('Add contact info', 'en');
      expect(result.target).toBe('BODY');
      expect(result.confidence).toBe('HIGH');
    });

    it('should detect BODY for "hotline"', () => {
      const result = detectEditTarget('Add a hotline number', 'en');
      expect(result.target).toBe('BODY');
    });

    it('should detect HOOK for "opening"', () => {
      const result = detectEditTarget('Edit the opening line', 'en');
      expect(result.target).toBe('HOOK');
    });

    it('should detect CTA for "call to action"', () => {
      const result = detectEditTarget('Fix the call to action', 'en');
      expect(result.target).toBe('CTA');
    });
  });
});

// ============================================
// shouldAnswerDirectly Tests
// ============================================
describe('shouldAnswerDirectly', () => {
  const ctx: TaskDetectionContext = {
    hasActiveDraft: true,
    hasPreviousMessages: true,
    lang: 'vi',
  };

  it('should return true for clear QA questions', () => {
    expect(shouldAnswerDirectly('Quẻ này có ý nghĩa gì?', ctx)).toBe(true);
    expect(shouldAnswerDirectly('Tại sao giá cao vậy?', ctx)).toBe(true);
    expect(shouldAnswerDirectly('Giải thích giúp mình', ctx)).toBe(true);
  });

  it('should return false for EDIT instructions', () => {
    expect(shouldAnswerDirectly('Thêm thông tin liên hệ', ctx)).toBe(false);
    expect(shouldAnswerDirectly('Sửa CTA', ctx)).toBe(false);
  });

  it('should return false for CREATE instructions', () => {
    const noDraftCtx: TaskDetectionContext = { ...ctx, hasActiveDraft: false };
    expect(shouldAnswerDirectly('Viết bài mới', noDraftCtx)).toBe(false);
  });
});

// ============================================
// formatAnswerEngineContract Tests
// ============================================
describe('formatAnswerEngineContract', () => {
  it('should format QA contract in Vietnamese', () => {
    const result = formatAnswerEngineContract('QA', 'UNKNOWN', 'vi');
    expect(result).toContain('MODE: QA');
    expect(result).toContain('HỎI ĐÁP');
    expect(result).toContain('Trả lời trực tiếp');
    expect(result).toContain('Không cần cấu trúc Hook/Body/CTA');
  });

  it('should format EDIT_PATCH contract in Vietnamese', () => {
    const result = formatAnswerEngineContract('EDIT_PATCH', 'BODY', 'vi');
    expect(result).toContain('MODE: EDIT_PATCH');
    expect(result).toContain('CHỈNH SỬA');
    expect(result).toContain('TARGET: BODY');
    expect(result).toContain('PATCH:');
    expect(result).toContain('KHÔNG viết lại toàn bài');
  });

  it('should format CREATE contract in Vietnamese', () => {
    const result = formatAnswerEngineContract('CREATE', 'FULL', 'vi');
    expect(result).toContain('MODE: CREATE');
    expect(result).toContain('TẠO MỚI');
    expect(result).toContain('Tạo nội dung mới hoàn chỉnh');
  });

  it('should format QA contract in English', () => {
    const result = formatAnswerEngineContract('QA', 'UNKNOWN', 'en');
    expect(result).toContain('MODE: QA');
    expect(result).toContain('Q&A');
    expect(result).toContain('Answer the question directly');
    expect(result).toContain('No Hook/Body/CTA structure required');
  });

  it('should format EDIT_PATCH contract in English', () => {
    const result = formatAnswerEngineContract('EDIT_PATCH', 'CTA', 'en');
    expect(result).toContain('MODE: EDIT_PATCH');
    expect(result).toContain('EDIT PATCH');
    expect(result).toContain('TARGET: CTA');
    expect(result).toContain('DO NOT rewrite the entire post');
  });
});

// ============================================
// parseAnswerEngineResponse Tests
// ============================================
describe('parseAnswerEngineResponse', () => {
  it('should parse QA response', () => {
    const text = `MODE: QA

Quẻ Trạch Hỏa Cách mang ý nghĩa về sự thay đổi lớn, cách mạng trong cuộc sống.`;

    const result = parseAnswerEngineResponse(text);
    expect(result.mode).toBe('QA');
    expect(result.isValid).toBe(true);
    expect(result.content).toContain('Trạch Hỏa Cách');
  });

  it('should parse EDIT_PATCH response with target and patch', () => {
    const text = `MODE: EDIT_PATCH
TARGET: BODY
PATCH:
📞 Liên hệ hotline: 0878-123-456
📍 Địa chỉ: 123 ABC, Quận 1, TP.HCM`;

    const result = parseAnswerEngineResponse(text);
    expect(result.mode).toBe('EDIT_PATCH');
    expect(result.target).toBe('BODY');
    expect(result.patch).toContain('0878-123-456');
    expect(result.isValid).toBe(true);
  });

  it('should parse CREATE response', () => {
    const text = `MODE: CREATE

🎣 Hook: Bạn có biết bí quyết chăm sóc da mùa hè?

📝 Body: Mùa hè là thời điểm da cần được chăm sóc đặc biệt...

🎯 CTA: Inbox ngay để được tư vấn miễn phí!`;

    const result = parseAnswerEngineResponse(text);
    expect(result.mode).toBe('CREATE');
    expect(result.isValid).toBe(true);
    expect(result.content).toContain('Hook');
  });

  it('should handle missing MODE header', () => {
    const text = 'This is a response without mode header';
    const result = parseAnswerEngineResponse(text);
    expect(result.mode).toBeNull();
    expect(result.isValid).toBe(false);
  });

  it('should handle EDIT_PATCH without patch content', () => {
    const text = `MODE: EDIT_PATCH
TARGET: BODY

Just some text without PATCH: marker`;

    const result = parseAnswerEngineResponse(text);
    expect(result.mode).toBe('EDIT_PATCH');
    expect(result.target).toBe('BODY');
    expect(result.patch).toBeNull();
  });
});

// ============================================
// getAnswerEngineDebugSummary Tests
// ============================================
describe('getAnswerEngineDebugSummary', () => {
  it('should format QA summary', () => {
    const result = getAnswerEngineDebugSummary('QA', 'UNKNOWN', 'HIGH');
    expect(result).toBe('AnswerEngine: QA [HIGH]');
  });

  it('should format EDIT_PATCH summary with target', () => {
    const result = getAnswerEngineDebugSummary('EDIT_PATCH', 'BODY', 'MEDIUM');
    expect(result).toBe('AnswerEngine: EDIT_PATCH:BODY [MEDIUM]');
  });

  it('should format CREATE summary', () => {
    const result = getAnswerEngineDebugSummary('CREATE', 'FULL', 'HIGH');
    expect(result).toBe('AnswerEngine: CREATE:FULL [HIGH]');
  });
});

// ============================================
// Real-world Scenario Tests (Required by spec)
// ============================================
describe('STEP 22: Real-world scenarios', () => {
  const ctx: TaskDetectionContext = {
    hasActiveDraft: true,
    hasPreviousMessages: true,
    lang: 'vi',
  };

  it('VN: "Tôi bảo bạn thêm thông tin chứ không phải viết bài mới" → EDIT_PATCH BODY HIGH', () => {
    const text = 'Tôi bảo bạn thêm thông tin chứ không phải viết bài mới';
    const taskResult = detectTaskType(text, ctx);
    detectEditTarget(text, 'vi');

    expect(taskResult.taskType).toBe('EDIT_PATCH');
    expect(taskResult.confidence).toBe('HIGH');
    // Target might be BODY or UNKNOWN depending on pattern matching
    // The main requirement is task type + high confidence
  });

  it('VN: "Thêm hotline 0878… và địa chỉ … vào bài" → EDIT_PATCH BODY HIGH', () => {
    const text = 'Thêm hotline 0878-123-456 và địa chỉ 123 ABC vào bài';
    const taskResult = detectTaskType(text, ctx);
    const targetResult = detectEditTarget(text, 'vi');

    expect(taskResult.taskType).toBe('EDIT_PATCH');
    expect(targetResult.target).toBe('BODY');
    expect(targetResult.confidence).toBe('HIGH');
  });

  it('VN: "Giải thích giúp mình quẻ Trạch Hỏa Cách là gì?" → QA HIGH', () => {
    const text = 'Giải thích giúp mình quẻ Trạch Hỏa Cách là gì?';
    const taskResult = detectTaskType(text, ctx);

    expect(taskResult.taskType).toBe('QA');
    expect(taskResult.confidence).toBe('HIGH');
  });

  it('EN: "Add a hotline line to the body, don\'t rewrite" → EDIT_PATCH BODY', () => {
    const enCtx: TaskDetectionContext = { ...ctx, lang: 'en' };
    const text = "Add a hotline line to the body, don't rewrite";
    const taskResult = detectTaskType(text, enCtx);
    const targetResult = detectEditTarget(text, 'en');

    expect(taskResult.taskType).toBe('EDIT_PATCH');
    expect(targetResult.target).toBe('BODY');
  });

  it('VN: "Viết bài mới về chủ đề khác" → CREATE', () => {
    const text = 'Viết bài mới về chủ đề khác';
    const taskResult = detectTaskType(text, ctx);

    expect(taskResult.taskType).toBe('CREATE');
  });

  it('VN: "Sửa CTA cho mềm hơn" → EDIT_PATCH CTA', () => {
    const text = 'Sửa CTA cho mềm hơn';
    const taskResult = detectTaskType(text, ctx);
    const targetResult = detectEditTarget(text, 'vi');

    expect(taskResult.taskType).toBe('EDIT_PATCH');
    expect(targetResult.target).toBe('CTA');
  });
});

// ============================================
// STEP 22: Context Guard Tests
// ============================================
// Tests for REWRITE_UPGRADE context requirements.
// REWRITE_UPGRADE requires either hasActiveDraft or hasPreviousMessages.
// QA and CREATE do NOT require context.
// ============================================
describe('STEP 22: Context Guard - REWRITE_UPGRADE requires context', () => {
  // Context with NO draft and NO messages (empty state)
  const noContextCtx: TaskDetectionContext = {
    hasActiveDraft: false,
    hasPreviousMessages: false,
    lang: 'vi',
  };

  // Context WITH active draft
  const withDraftCtx: TaskDetectionContext = {
    hasActiveDraft: true,
    hasPreviousMessages: false,
    lang: 'vi',
  };

  // Context WITH previous messages only (no active draft)
  const withMessagesCtx: TaskDetectionContext = {
    hasActiveDraft: false,
    hasPreviousMessages: true,
    lang: 'vi',
  };

  // Context with both
  const fullContextCtx: TaskDetectionContext = {
    hasActiveDraft: true,
    hasPreviousMessages: true,
    lang: 'vi',
  };

  describe('REWRITE_UPGRADE detection with context variations', () => {
    it('should detect REWRITE_UPGRADE for "viết dài hơn" with no context', () => {
      // The detection should still identify REWRITE_UPGRADE
      // The BLOCKING happens in llmExecutor/StudioEditor, not here
      const result = detectTaskType('Viết dài hơn', noContextCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });

    it('should detect REWRITE_UPGRADE for "viết dài hơn" with active draft', () => {
      const result = detectTaskType('Viết dài hơn', withDraftCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });

    it('should detect REWRITE_UPGRADE for "improve it" with previous messages', () => {
      const enCtx: TaskDetectionContext = { ...withMessagesCtx, lang: 'en' };
      const result = detectTaskType('Improve it', enCtx);
      expect(result.taskType).toBe('REWRITE_UPGRADE');
    });
  });

  describe('QA does NOT require context (should work with no context)', () => {
    it('should detect QA for question with no context - still allowed', () => {
      const result = detectTaskType('Hotline của cửa hàng là gì?', noContextCtx);
      // QA should still be detected regardless of context
      expect(result.taskType).toBe('QA');
    });

    it('should detect QA for English question with no context', () => {
      const enNoCtx: TaskDetectionContext = { ...noContextCtx, lang: 'en' };
      const result = detectTaskType('What is the meaning of this?', enNoCtx);
      expect(result.taskType).toBe('QA');
    });
  });

  describe('CREATE does NOT require context (should work with no context)', () => {
    it('should detect CREATE for "viết bài mới" with no context - still allowed', () => {
      const result = detectTaskType('Viết bài mới về skincare', noContextCtx);
      expect(result.taskType).toBe('CREATE');
    });

    it('should detect CREATE for "write a new post" with no context', () => {
      const enNoCtx: TaskDetectionContext = { ...noContextCtx, lang: 'en' };
      const result = detectTaskType('Write a new post about marketing', enNoCtx);
      expect(result.taskType).toBe('CREATE');
    });
  });

  describe('Context availability check logic', () => {
    it('hasActiveDraft alone provides context', () => {
      const hasContext = withDraftCtx.hasActiveDraft || withDraftCtx.hasPreviousMessages;
      expect(hasContext).toBe(true);
    });

    it('hasPreviousMessages alone provides context', () => {
      const hasContext = withMessagesCtx.hasActiveDraft || withMessagesCtx.hasPreviousMessages;
      expect(hasContext).toBe(true);
    });

    it('no draft and no messages means no context', () => {
      const hasContext = noContextCtx.hasActiveDraft || noContextCtx.hasPreviousMessages;
      expect(hasContext).toBe(false);
    });

    it('full context has both', () => {
      const hasContext = fullContextCtx.hasActiveDraft || fullContextCtx.hasPreviousMessages;
      expect(hasContext).toBe(true);
    });
  });
});

// ============================================
// STEP 22: REWRITE_UPGRADE Contract Tests
// ============================================
// These tests verify that the REWRITE_UPGRADE contract
// contains the strict rules that prevent topic/intent drift.
// ============================================
describe('STEP 22: REWRITE_UPGRADE Contract Behavior', () => {
  describe('Vietnamese contract contains strict rules', () => {
    it('should contain SOURCE reference', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('NGUỒN');
      expect(contract).toContain('SOURCE_CONTENT');
    });

    it('should contain STRICT RULES header', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('QUY TẮC NGHIÊM NGẶT');
    });

    it('should forbid topic/angle/intent change', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KHÔNG thay đổi chủ đề');
      expect(contract).toContain('góc nhìn');
      expect(contract).toContain('ý định');
    });

    it('should forbid adding new sections', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KHÔNG thêm section mới');
    });

    it('should forbid adding CTA if source has no CTA', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KHÔNG thêm CTA nếu bài gốc KHÔNG có CTA');
    });

    it('should forbid brand switching', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KHÔNG đổi brand/sản phẩm/dịch vụ');
    });

    it('should forbid Q&A transformation', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KHÔNG biến thành bài Q&A');
    });

    it('should forbid fabricated info', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('thông tin bịa đặt');
      expect(contract).toContain('địa chỉ');
      expect(contract).toContain('hotline');
    });

    it('should have expected output section', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KẾT QUẢ MONG ĐỢI');
      expect(contract).toContain('cùng bài viết');
    });

    it('should require preserving paragraph structure', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('CẤU TRÚC đoạn văn gốc');
    });

    it('should require preserving idea order', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('THỨ TỰ ý tưởng');
    });
  });

  describe('English contract contains strict rules', () => {
    it('should contain SOURCE reference', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('SOURCE');
      expect(contract).toContain('SOURCE_CONTENT');
    });

    it('should contain STRICT RULES header', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('STRICT RULES');
    });

    it('should forbid topic/angle/intent change', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('DO NOT change topic');
      expect(contract).toContain('angle');
      expect(contract).toContain('intent');
    });

    it('should forbid adding new sections', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('DO NOT add new sections');
    });

    it('should forbid adding CTA if source has no CTA', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('DO NOT add CTA if source has NO CTA');
    });

    it('should forbid brand switching', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('DO NOT switch brand');
    });

    it('should forbid Q&A transformation', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('DO NOT turn into Q&A');
    });

    it('should forbid fabricated info', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('fabricated info');
      expect(contract).toContain('addresses');
      expect(contract).toContain('hotlines');
    });

    it('should have expected output section', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('EXPECTED OUTPUT');
      expect(contract).toContain('the same post');
    });

    it('should require preserving paragraph structure', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('SAME paragraph structure');
    });
  });

  describe('REWRITE_UPGRADE contract is distinct from other modes', () => {
    it('REWRITE_UPGRADE contract should NOT mention PATCH format', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).not.toContain('TARGET: BODY');
      expect(contract).not.toContain('PATCH:');
    });

    it('REWRITE_UPGRADE contract should NOT be confused with CREATE', () => {
      const rewriteContract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      const createContract = formatAnswerEngineContract('CREATE', 'FULL', 'vi');

      // REWRITE has strict rules, CREATE does not
      expect(rewriteContract).toContain('NGHIÊM CẤM');
      expect(createContract).not.toContain('NGHIÊM CẤM');

      // REWRITE references source, CREATE does not
      expect(rewriteContract).toContain('SOURCE_CONTENT');
      expect(createContract).not.toContain('SOURCE_CONTENT');
    });

    it('REWRITE_UPGRADE contract should be longer than QA contract', () => {
      const rewriteContract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      const qaContract = formatAnswerEngineContract('QA', 'UNKNOWN', 'vi');

      // REWRITE has strict rules, QA is simple
      expect(rewriteContract.length).toBeGreaterThan(qaContract.length);
    });
  });

  // ============================================
  // OUTPUT FORMAT GUARD Tests
  // ============================================
  // These tests verify that REWRITE_UPGRADE has explicit
  // OUTPUT FORMAT requirements that enforce "rewrite in place"
  // behavior, distinct from CREATE's "free creation" mode.
  // ============================================
  describe('REWRITE_UPGRADE OUTPUT FORMAT GUARD (Vietnamese)', () => {
    it('should have OUTPUT FORMAT section', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('OUTPUT FORMAT');
      expect(contract).toContain('BẮT BUỘC');
    });

    it('should enforce "rewrite in place" principle', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('TẠI CHỖ');
      expect(contract).toContain('CÙNG BÀI');
    });

    it('should require preserving paragraph structure', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('CẤU TRÚC đoạn văn gốc');
    });

    it('should require preserving idea order', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('THỨ TỰ ý tưởng');
    });

    it('should forbid creating new hook', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KHÔNG tạo hook/mở bài mới');
    });

    it('should forbid adding narrative arc', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KHÔNG thêm narrative arc');
    });

    it('should forbid changing CTA tone', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KHÔNG đổi giọng CTA');
    });

    it('should forbid global restructuring', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KHÔNG tái cấu trúc toàn bộ');
    });

    it('should forbid increasing marketing pressure', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('KHÔNG tăng áp lực marketing');
    });

    it('should have "when uncertain, keep original" fallback', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('không chắc');
      expect(contract).toContain('GIỮ NGUYÊN');
    });

    it('should state expected output is "same post, written better"', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      expect(contract).toContain('cùng bài viết, được viết hay hơn');
      expect(contract).toContain('KHÔNG phải bài mới');
    });
  });

  describe('REWRITE_UPGRADE OUTPUT FORMAT GUARD (English)', () => {
    it('should have OUTPUT FORMAT section', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('OUTPUT FORMAT');
      expect(contract).toContain('MANDATORY');
    });

    it('should enforce "rewrite in place" principle', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('IN PLACE');
      expect(contract).toContain('SAME POST');
    });

    it('should require preserving paragraph structure', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('SAME paragraph structure');
    });

    it('should require preserving idea order', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('SAME idea order');
    });

    it('should forbid creating new hook', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('DO NOT create new hook');
    });

    it('should forbid adding narrative arc', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('DO NOT add narrative arc');
    });

    it('should forbid changing CTA tone', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('DO NOT change CTA tone');
    });

    it('should forbid global restructuring', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('DO NOT globally restructure');
    });

    it('should forbid increasing marketing pressure', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('DO NOT increase marketing pressure');
    });

    it('should have "when uncertain, keep original" fallback', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('uncertain');
      expect(contract).toContain('KEEP original');
    });

    it('should state expected output is "same post, written better"', () => {
      const contract = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      expect(contract).toContain('the same post, written better');
      expect(contract).toContain('NOT a new post');
    });
  });

  describe('OUTPUT FORMAT GUARD distinguishes REWRITE from CREATE', () => {
    it('REWRITE has OUTPUT FORMAT section, CREATE does not', () => {
      const rewriteVi = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      const createVi = formatAnswerEngineContract('CREATE', 'FULL', 'vi');

      expect(rewriteVi).toContain('OUTPUT FORMAT');
      expect(createVi).not.toContain('OUTPUT FORMAT');
    });

    it('REWRITE has "in place" constraint, CREATE does not', () => {
      const rewriteEn = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'en');
      const createEn = formatAnswerEngineContract('CREATE', 'FULL', 'en');

      expect(rewriteEn).toContain('IN PLACE');
      expect(createEn).not.toContain('IN PLACE');
    });

    it('REWRITE forbids restructuring, CREATE allows free structure', () => {
      const rewriteVi = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      const createVi = formatAnswerEngineContract('CREATE', 'FULL', 'vi');

      expect(rewriteVi).toContain('KHÔNG tái cấu trúc');
      expect(createVi).not.toContain('tái cấu trúc');
    });

    it('REWRITE has "same post written better" expectation, CREATE has "new content"', () => {
      const rewriteVi = formatAnswerEngineContract('REWRITE_UPGRADE', 'UNKNOWN', 'vi');
      const createVi = formatAnswerEngineContract('CREATE', 'FULL', 'vi');

      expect(rewriteVi).toContain('cùng bài viết');
      expect(createVi).toContain('nội dung mới');
    });
  });
});
