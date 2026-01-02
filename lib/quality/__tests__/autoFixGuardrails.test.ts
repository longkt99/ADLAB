// ============================================
// Auto Fix Guardrails Test Suite
// ============================================
// Tests for prompt guardrails, trust erosion, and backoff logic.
// Validates that Auto Fix protects writer trust.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkGuardrails,
  META_COMMENTARY_PATTERNS,
  TONE_SHIFT_PATTERNS,
  EMOJI_PATTERN,
  HASHTAG_PATTERN,
} from '../autoFixGuardrails';
import {
  detectExcessiveEdit,
  detectRepeatedFailure,
  detectOscillation,
  detectQuickUndo,
  detectConsecutiveReject,
  createTrustState,
  addTrustSignal,
  recordSuccessfulAccept,
  TRUST_THRESHOLDS,
  type TrustSignal,
} from '../trustErosion';
import {
  createBackoffContext,
  recordAction,
  addSignal,
  recordSuccess,
  checkBackoff,
  shouldUseStrictMode,
  type BackoffContext,
} from '../backoffState';
import type { RuleResult } from '../intentQualityRules';

// ============================================
// GUARDRAIL PATTERN TESTS
// ============================================

describe('Guardrail Patterns', () => {
  describe('META_COMMENTARY_PATTERNS', () => {
    it('should detect "Here is" at start', () => {
      expect(META_COMMENTARY_PATTERNS.some(p => p.test('Here is your content'))).toBe(true);
    });

    it('should detect "Dưới đây là" at start', () => {
      expect(META_COMMENTARY_PATTERNS.some(p => p.test('Dưới đây là nội dung'))).toBe(true);
    });

    it('should detect AI self-reference', () => {
      expect(META_COMMENTARY_PATTERNS.some(p => p.test('As an AI, I will help'))).toBe(true);
    });

    it('should detect "hope this helps"', () => {
      expect(META_COMMENTARY_PATTERNS.some(p => p.test('Some content. Hope this helps!'))).toBe(true);
    });

    it('should NOT flag normal content', () => {
      expect(META_COMMENTARY_PATTERNS.some(p => p.test('Sản phẩm này rất tốt cho bạn'))).toBe(false);
    });
  });

  describe('TONE_SHIFT_PATTERNS', () => {
    it('should detect corporate-speak "leverage"', () => {
      expect(TONE_SHIFT_PATTERNS.some(p => p.test('We leverage AI technology'))).toBe(true);
    });

    it('should detect overly formal "furthermore"', () => {
      expect(TONE_SHIFT_PATTERNS.some(p => p.test('Furthermore, this product'))).toBe(true);
    });

    it('should detect AI filler "in today\'s world"', () => {
      expect(TONE_SHIFT_PATTERNS.some(p => p.test('In today\'s world, we need'))).toBe(true);
    });

    it('should NOT flag normal Vietnamese content', () => {
      expect(TONE_SHIFT_PATTERNS.some(p => p.test('Chúng tôi cung cấp dịch vụ tốt nhất'))).toBe(false);
    });
  });

  describe('EMOJI_PATTERN', () => {
    it('should detect common emojis', () => {
      // Test with emoji characters (surrogate pairs)
      expect(EMOJI_PATTERN.test('Hello \uD83D\uDE00')).toBe(true); // 😀
      expect(EMOJI_PATTERN.test('Great! \uD83C\uDF89')).toBe(true); // 🎉
    });

    it('should detect symbol emojis', () => {
      expect(EMOJI_PATTERN.test('Check \u2705')).toBe(true); // ✅
    });

    it('should NOT match regular text', () => {
      expect(EMOJI_PATTERN.test('Hello world')).toBe(false);
    });
  });

  describe('HASHTAG_PATTERN', () => {
    it('should match hashtags', () => {
      const text = 'Check this out #trending #viral';
      const matches = text.match(HASHTAG_PATTERN);
      expect(matches).toHaveLength(2);
    });

    it('should NOT match # without word', () => {
      expect('Price is $100 # Comment'.match(HASHTAG_PATTERN)).toEqual(['#']);
    });
  });
});

// ============================================
// GUARDRAIL CHECK TESTS
// ============================================

describe('checkGuardrails', () => {
  const makeRuleResult = (id: string, passed: boolean): RuleResult => ({
    id,
    passed,
    severity: 'SOFT',
    message: `Rule ${id}`,
  });

  it('should pass when output is similar and clean', () => {
    const original = 'Sản phẩm này rất tốt cho bạn.';
    const output = 'Sản phẩm này tốt cho bạn.'; // Minor edit
    const failedRules = [makeRuleResult('social_sentence_length', false)];

    const result = checkGuardrails(original, output, failedRules, 0.9);

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.recommendation).toBe('accept');
  });

  it('should detect meta-commentary and block', () => {
    const original = 'Sản phẩm này rất tốt cho bạn.';
    const output = 'Here is your improved content: Sản phẩm này tốt cho bạn.';
    const failedRules = [makeRuleResult('social_sentence_length', false)];

    const result = checkGuardrails(original, output, failedRules, 0.7);

    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.type === 'META_COMMENTARY')).toBe(true);
    expect(result.recommendation).toBe('fallback');
  });

  it('should detect unauthorized emoji addition', () => {
    const original = 'Sản phẩm này rất tốt cho bạn.';
    const output = 'Sản phẩm này rất tốt cho bạn! 😊';
    const failedRules = [makeRuleResult('social_sentence_length', false)];

    const result = checkGuardrails(original, output, failedRules, 0.85);

    expect(result.violations.some(v => v.type === 'UNAUTHORIZED_EMOJI')).toBe(true);
  });

  it('should allow emoji when rule authorizes it', () => {
    const original = 'Sản phẩm này rất tốt cho bạn.';
    const output = 'Sản phẩm này rất tốt cho bạn! 😊';
    const failedRules = [makeRuleResult('reel_emoji_usage', false)]; // Authorizes emoji

    const result = checkGuardrails(original, output, failedRules, 0.85);

    expect(result.violations.some(v => v.type === 'UNAUTHORIZED_EMOJI')).toBe(false);
  });

  it('should detect unauthorized hashtag addition', () => {
    const original = 'Sản phẩm này rất tốt cho bạn.';
    const output = 'Sản phẩm này rất tốt cho bạn. #trending #viral';
    const failedRules = [makeRuleResult('social_sentence_length', false)];

    const result = checkGuardrails(original, output, failedRules, 0.8);

    expect(result.violations.some(v => v.type === 'UNAUTHORIZED_HASHTAG')).toBe(true);
  });

  it('should detect language change (Vietnamese to English)', () => {
    const original = 'Sản phẩm này được thiết kế dành cho những ai muốn tiết kiệm thời gian mà vẫn đảm bảo chất lượng công việc hàng ngày.';
    const output = 'This product is designed for those who want to save time while ensuring daily work quality.';
    const failedRules = [makeRuleResult('social_structure_lock', false)];

    const result = checkGuardrails(original, output, failedRules, 0.3);

    expect(result.violations.some(v => v.type === 'LANGUAGE_CHANGE')).toBe(true);
    expect(result.recommendation).toBe('fallback');
  });

  it('should detect content expansion beyond 30%', () => {
    const original = 'Ngắn gọn.';
    const output = 'Đây là một đoạn văn rất dài được thêm vào mà không có lý do chính đáng, vi phạm quy tắc về mở rộng nội dung.';
    const failedRules = [makeRuleResult('social_sentence_length', false)];

    const result = checkGuardrails(original, output, failedRules, 0.2);

    expect(result.violations.some(v => v.type === 'CONTENT_EXPANSION')).toBe(true);
  });

  it('should allow more expansion for structure rules', () => {
    const original = 'Ngắn gọn.';
    const output = '**Hook:** Ngắn gọn.\n\n**Body:** Thêm nội dung.\n\n**CTA:** Liên hệ ngay.';
    const failedRules = [makeRuleResult('social_structure_lock', false)]; // Structure rule

    const result = checkGuardrails(original, output, failedRules, 0.4);

    // Should allow up to 50% expansion for structure rules
    expect(result.violations.some(v => v.type === 'CONTENT_EXPANSION')).toBe(true);
    // But it's a warning, not a block
    expect(result.violations.find(v => v.type === 'CONTENT_EXPANSION')?.severity).toBe('warning');
  });

  it('should recommend fallback when similarity < 50%', () => {
    const original = 'Original content here.';
    const output = 'Completely different content.';
    const failedRules = [makeRuleResult('social_sentence_length', false)];

    const result = checkGuardrails(original, output, failedRules, 0.4);

    expect(result.recommendation).toBe('fallback');
  });

  it('should recommend retry when similarity 50-70%', () => {
    const original = 'Original content here that is somewhat long.';
    const output = 'Modified content here that is also long.';
    const failedRules = [makeRuleResult('social_sentence_length', false)];

    const result = checkGuardrails(original, output, failedRules, 0.65);

    expect(result.recommendation).toBe('retry');
  });
});

// ============================================
// TRUST EROSION SIGNAL TESTS
// ============================================

describe('Trust Erosion Signals', () => {
  describe('detectExcessiveEdit', () => {
    it('should detect low similarity as excessive edit', () => {
      const similarity = {
        score: 0.5,
        passed: false,
        assessment: 'excessive' as const,
        details: { charSimilarity: 0.5, tokenOverlap: 0.5, lengthRatio: 0.5 },
      };

      const signal = detectExcessiveEdit(similarity);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('EXCESSIVE_EDIT');
      expect(signal?.severity).toBe('medium');
    });

    it('should mark as high severity when below fallback threshold', () => {
      const similarity = {
        score: 0.4,
        passed: false,
        assessment: 'excessive' as const,
        details: { charSimilarity: 0.4, tokenOverlap: 0.4, lengthRatio: 0.4 },
      };

      const signal = detectExcessiveEdit(similarity);

      expect(signal?.severity).toBe('high');
    });

    it('should NOT signal when similarity is good', () => {
      const similarity = {
        score: 0.85,
        passed: true,
        assessment: 'minimal' as const,
        details: { charSimilarity: 0.85, tokenOverlap: 0.85, lengthRatio: 0.9 },
      };

      const signal = detectExcessiveEdit(similarity);

      expect(signal).toBeNull();
    });
  });

  describe('detectRepeatedFailure', () => {
    it('should detect 2+ failed attempts', () => {
      const signal = detectRepeatedFailure(2, true);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('REPEATED_FAILURE');
      expect(signal?.severity).toBe('high');
    });

    it('should NOT signal on first attempt', () => {
      const signal = detectRepeatedFailure(1, true);

      expect(signal).toBeNull();
    });

    it('should NOT signal if not all failed', () => {
      const signal = detectRepeatedFailure(2, false);

      expect(signal).toBeNull();
    });
  });

  describe('detectOscillation', () => {
    it('should detect undo → apply → undo pattern', () => {
      const now = Date.now();
      const recentActions = [
        { action: 'undo' as const, timestamp: now - 30000 },
        { action: 'apply' as const, timestamp: now - 15000 },
        { action: 'undo' as const, timestamp: now },
      ];

      const signal = detectOscillation(recentActions);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('OSCILLATION');
      expect(signal?.severity).toBe('high');
    });

    it('should NOT signal for apply → keep → apply', () => {
      const now = Date.now();
      const recentActions = [
        { action: 'apply' as const, timestamp: now - 30000 },
        { action: 'keep' as const, timestamp: now - 15000 },
        { action: 'apply' as const, timestamp: now },
      ];

      const signal = detectOscillation(recentActions);

      expect(signal).toBeNull();
    });

    it('should NOT signal if pattern spans more than 60 seconds', () => {
      const now = Date.now();
      const recentActions = [
        { action: 'undo' as const, timestamp: now - 120000 }, // 2 minutes ago
        { action: 'apply' as const, timestamp: now - 60000 },
        { action: 'undo' as const, timestamp: now },
      ];

      const signal = detectOscillation(recentActions);

      expect(signal).toBeNull();
    });
  });

  describe('detectQuickUndo', () => {
    it('should detect undo within 2 seconds', () => {
      const applyTime = Date.now() - 1000;
      const undoTime = Date.now();

      const signal = detectQuickUndo(applyTime, undoTime);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('QUICK_UNDO');
    });

    it('should NOT signal undo after 2 seconds', () => {
      const applyTime = Date.now() - 3000;
      const undoTime = Date.now();

      const signal = detectQuickUndo(applyTime, undoTime);

      expect(signal).toBeNull();
    });
  });

  describe('detectConsecutiveReject', () => {
    it('should detect 3+ consecutive keeps', () => {
      const now = Date.now();
      const recentActions = [
        { action: 'keep' as const, timestamp: now - 30000 },
        { action: 'keep' as const, timestamp: now - 15000 },
        { action: 'keep' as const, timestamp: now },
      ];

      const signal = detectConsecutiveReject(recentActions);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('CONSECUTIVE_REJECT');
    });

    it('should NOT signal if interrupted by apply', () => {
      const now = Date.now();
      const recentActions = [
        { action: 'keep' as const, timestamp: now - 30000 },
        { action: 'apply' as const, timestamp: now - 15000 },
        { action: 'keep' as const, timestamp: now },
      ];

      const signal = detectConsecutiveReject(recentActions);

      expect(signal).toBeNull();
    });
  });
});

// ============================================
// TRUST STATE TESTS
// ============================================

describe('Trust State Management', () => {
  it('should start with healthy state and score 100', () => {
    const state = createTrustState();

    expect(state.score).toBe(100);
    expect(state.level).toBe('healthy');
    expect(state.signals).toHaveLength(0);
  });

  it('should reduce score when signal is added', () => {
    let state = createTrustState();

    const signal: TrustSignal = {
      type: 'EXCESSIVE_EDIT',
      timestamp: Date.now(),
      severity: 'medium',
    };

    state = addTrustSignal(state, signal);

    expect(state.score).toBe(100 - TRUST_THRESHOLDS.EXCESSIVE_EDIT_PENALTY);
    expect(state.signals).toHaveLength(1);
  });

  it('should transition to cautious when score drops below 80', () => {
    let state = createTrustState();

    // Add signals to drop below 80
    for (let i = 0; i < 3; i++) {
      state = addTrustSignal(state, {
        type: 'EXCESSIVE_EDIT',
        timestamp: Date.now(),
        severity: 'medium',
      });
    }

    expect(state.score).toBeLessThan(80);
    expect(state.level).toBe('cautious');
  });

  it('should transition to frozen when score drops below 40', () => {
    let state = createTrustState();

    // Add high-penalty signals
    for (let i = 0; i < 4; i++) {
      state = addTrustSignal(state, {
        type: 'OSCILLATION',
        timestamp: Date.now(),
        severity: 'high',
      });
    }

    expect(state.score).toBeLessThan(40);
    expect(state.level).toBe('frozen');
  });

  it('should recover score on successful accept', () => {
    let state = createTrustState();
    state.score = 70; // Manually set lower score
    state.level = 'cautious';

    state = recordSuccessfulAccept(state);

    expect(state.score).toBe(70 + TRUST_THRESHOLDS.RECOVERY_RATE);
  });

  it('should not exceed 100 on recovery', () => {
    let state = createTrustState();
    state.score = 98;

    state = recordSuccessfulAccept(state);

    expect(state.score).toBe(100);
  });
});

// ============================================
// BACKOFF STATE MACHINE TESTS
// ============================================

describe('Backoff State Machine', () => {
  let context: BackoffContext;

  beforeEach(() => {
    context = createBackoffContext();
  });

  it('should start in NORMAL state', () => {
    expect(context.state).toBe('NORMAL');
  });

  it('should allow Auto Fix in NORMAL state', () => {
    const decision = checkBackoff(context);

    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe('NORMAL');
  });

  it('should record actions correctly', () => {
    context = recordAction(context, 'apply', 'msg-1');
    context = recordAction(context, 'undo', 'msg-1');
    context = recordAction(context, 'keep', 'msg-2');

    expect(context.recentActions).toHaveLength(3);
    expect(context.consecutiveSuccesses).toBe(0);
    expect(context.consecutiveFailures).toBe(2); // undo + keep
  });

  it('should transition to CAUTIOUS on trust drop', () => {
    // Add signals to drop trust
    for (let i = 0; i < 3; i++) {
      context = addSignal(context, {
        type: 'EXCESSIVE_EDIT',
        timestamp: Date.now(),
        severity: 'medium',
      });
    }

    expect(context.state).toBe('CAUTIOUS');
  });

  it('should transition to SILENT when frozen', () => {
    // Add high-penalty signals to freeze
    for (let i = 0; i < 5; i++) {
      context = addSignal(context, {
        type: 'OSCILLATION',
        timestamp: Date.now(),
        severity: 'high',
      });
    }

    expect(context.state).toBe('SILENT');
  });

  it('should block Auto Fix in SILENT state', () => {
    context.state = 'SILENT';
    context.trust.level = 'frozen';

    const decision = checkBackoff(context);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Auto Fix is temporarily unavailable');
  });

  it('should use strict mode in CAUTIOUS state', () => {
    context.state = 'CAUTIOUS';

    expect(shouldUseStrictMode(context)).toBe(true);
  });

  it('should NOT use strict mode in NORMAL state', () => {
    expect(shouldUseStrictMode(context)).toBe(false);
  });

  it('should recover to NORMAL after 3 consecutive successes', () => {
    context.state = 'CAUTIOUS';
    context.trust.score = 85;
    context.trust.level = 'healthy'; // Score is healthy but state is cautious
    context.consecutiveSuccesses = 2;

    context = recordSuccess(context);

    expect(context.consecutiveSuccesses).toBe(3);
    expect(context.state).toBe('NORMAL');
  });

  it('should NOT recover directly from SILENT to NORMAL', () => {
    context.state = 'SILENT';
    context.trust.score = 50;
    context.trust.level = 'critical';
    context.trust.cooldownUntil = null; // Cooldown expired
    context.consecutiveSuccesses = 5;

    context = recordSuccess(context);

    // Should go to CAUTIOUS, not NORMAL
    expect(context.state).toBe('CAUTIOUS');
  });
});

// ============================================
// THRESHOLD VALIDATION TESTS
// ============================================

describe('Threshold Validation', () => {
  it('should have correct locked thresholds', () => {
    // These are locked thresholds - test fails if someone changes them
    expect(TRUST_THRESHOLDS.ACCEPT_MIN).toBe(0.70);
    expect(TRUST_THRESHOLDS.RETRY_MIN).toBe(0.75);
    expect(TRUST_THRESHOLDS.FALLBACK_BELOW).toBe(0.50);
  });

  it('should have correct trust level thresholds', () => {
    expect(TRUST_THRESHOLDS.HEALTHY_MIN).toBe(80);
    expect(TRUST_THRESHOLDS.CAUTIOUS_MIN).toBe(60);
    expect(TRUST_THRESHOLDS.CRITICAL_MIN).toBe(40);
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe('Integration: Full Flow', () => {
  it('should handle successful apply flow', () => {
    let context = createBackoffContext();

    // Simulate successful apply
    context = recordAction(context, 'apply', 'msg-1');
    context = recordSuccess(context);

    expect(context.state).toBe('NORMAL');
    expect(context.consecutiveSuccesses).toBe(1);
    expect(context.trust.score).toBeGreaterThanOrEqual(100);
  });

  it('should handle repeated failure flow', () => {
    let context = createBackoffContext();

    // Simulate repeated failures with excessive edits
    for (let i = 0; i < 3; i++) {
      context = addSignal(context, {
        type: 'EXCESSIVE_EDIT',
        timestamp: Date.now(),
        severity: 'medium',
      });
      context = recordAction(context, 'keep', `msg-${i}`);
    }

    // Check consecutive reject signal
    const rejectSignal = detectConsecutiveReject(context.recentActions);
    if (rejectSignal) {
      context = addSignal(context, rejectSignal);
    }

    expect(context.state).not.toBe('NORMAL');
  });

  it('should handle oscillation pattern', () => {
    let context = createBackoffContext();
    const now = Date.now();

    // Simulate oscillation: undo → apply → undo
    context = recordAction(context, 'undo', 'msg-1');
    context.recentActions[0].timestamp = now - 30000;

    context = recordAction(context, 'apply', 'msg-1');
    context.recentActions[1].timestamp = now - 15000;

    context = recordAction(context, 'undo', 'msg-1');
    context.recentActions[2].timestamp = now;

    // Detect and add oscillation signal
    const oscillationSignal = detectOscillation(context.recentActions);
    expect(oscillationSignal).not.toBeNull();

    if (oscillationSignal) {
      context = addSignal(context, oscillationSignal);
    }

    // Should be in at least CAUTIOUS state
    expect(['CAUTIOUS', 'SILENT']).toContain(context.state);
  });
});
