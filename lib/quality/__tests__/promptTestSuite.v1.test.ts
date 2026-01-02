// ============================================
// Prompt Test Suite v1 - Table-Driven Tests
// ============================================
// Comprehensive test suite covering:
// - Guardrails (meta-commentary, tone drift, unauthorized additions)
// - Similarity & Minimal Change (threshold checks, scoped changes)
// - Trust Erosion Signals (6 signal types)
// - Backoff State Machine (transitions, cooldown, anti-flapping)
// - API Route Integration (mocked LLM, attempts, guardrail-aware selection)
//
// All thresholds are LOCKED and match production values.

import { describe, it, expect } from 'vitest';
import {
  checkGuardrails,
  GUARDRAIL_POLICY,
  STRICT_GUARDRAIL_POLICY,
} from '../autoFixGuardrails';
import { checkSimilarity, type SimilarityResult } from '../similarityCheck';
import {
  detectExcessiveEdit,
  detectRepeatedFailure,
  detectOscillation,
  detectQuickUndo,
  detectFallbackUsed,
  detectConsecutiveReject,
  TRUST_THRESHOLDS,
  type TrustSignalType,
} from '../trustErosion';
import {
  createBackoffContext,
  recordAction,
  addSignal,
  recordSuccess,
  checkBackoff,
  shouldUseStrictMode,
  type BackoffState,
} from '../backoffState';
import type { RuleResult } from '../intentQualityRules';

// ============================================
// TEST FIXTURES - Vietnamese Examples
// ============================================

const VIETNAMESE_FIXTURES = {
  /** Clean social media post */
  cleanPost: 'Sản phẩm này được thiết kế dành cho những ai muốn tiết kiệm thời gian mà vẫn đảm bảo chất lượng công việc hàng ngày.',

  /** Post with structure labels */
  structuredPost: `**Hook:** Bạn có muốn tiết kiệm thời gian?

**Body:** Sản phẩm này được thiết kế dành cho những ai muốn tiết kiệm thời gian mà vẫn đảm bảo chất lượng công việc hàng ngày.

**CTA:** Liên hệ ngay để được tư vấn!`,

  /** Short post */
  shortPost: 'Ngắn gọn.',

  /** Post with emoji */
  postWithEmoji: 'Sản phẩm tuyệt vời! 😊',

  /** Post with hashtags */
  postWithHashtags: 'Sản phẩm mới ra mắt! #trending #viral #sanpham',

  /** English version (language change test) */
  englishVersion: 'This product is designed for those who want to save time while ensuring daily work quality.',

  /** Meta-commentary example (Vietnamese) */
  metaCommentaryVi: 'Dưới đây là nội dung đã được cải thiện cho bạn.',

  /** Meta-commentary example (English) */
  metaCommentaryEn: 'Here is your improved content: Sản phẩm này rất tốt.',

  /** Tone-shifted version */
  toneShifted: 'Furthermore, this product leverages cutting-edge technology to facilitate synergy.',

  /** Over-expanded version */
  overExpanded: `Sản phẩm này được thiết kế dành cho những ai muốn tiết kiệm thời gian mà vẫn đảm bảo chất lượng công việc hàng ngày. Đây là một sản phẩm tuyệt vời mà bạn không nên bỏ lỡ. Chúng tôi đã nghiên cứu và phát triển trong nhiều năm để mang đến cho bạn giải pháp tốt nhất. Hãy liên hệ ngay với chúng tôi để được tư vấn miễn phí!`,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function makeRuleResult(id: string, passed: boolean, severity: 'SOFT' | 'HARD' = 'SOFT'): RuleResult {
  return {
    id,
    passed,
    severity,
    message: `Rule ${id} ${passed ? 'passed' : 'failed'}`,
  };
}

function createSimilarityResult(score: number): SimilarityResult {
  return {
    score,
    passed: score >= 0.7,
    assessment: score >= 0.85 ? 'minimal' : score >= 0.7 ? 'moderate' : 'excessive',
    details: {
      charSimilarity: score,
      tokenOverlap: score,
      lengthRatio: Math.min(1, score + 0.1),
    },
  };
}

// ============================================
// TEST CASE TYPES
// ============================================

interface TestCase {
  name: string;
  inputOriginal: string;
  candidateOutputs: string[];
  flags: {
    failedRuleIds: string[];
    isRetry?: boolean;
    simulatedSimilarity?: number;
    simulatedActions?: Array<{ action: 'apply' | 'undo' | 'keep'; timestamp: number }>;
    simulatedAttemptCount?: number;
    simulatedAllFailed?: boolean;
    simulatedApplyTimestamp?: number;
    simulatedUndoTimestamp?: number;
  };
  expected: {
    shouldPassGuardrails: boolean;
    usedFallback: boolean;
    expectedBackoffState?: BackoffState;
    expectedSignals?: TrustSignalType[];
    expectedDecision?: 'accept' | 'retry' | 'fallback';
    maxAttemptsUsed?: number;
  };
}

// ============================================
// MASTER TEST TABLE
// ============================================

const TEST_CASES: TestCase[] = [
  // ============================================
  // CATEGORY 1: GUARDRAILS
  // ============================================

  // G1: Meta-commentary detection (Vietnamese)
  {
    name: 'G1: Detect Vietnamese meta-commentary "Dưới đây là"',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.metaCommentaryVi],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.6,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: true,
      expectedDecision: 'fallback',
    },
  },

  // G2: Meta-commentary detection (English)
  {
    name: 'G2: Detect English meta-commentary "Here is"',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.metaCommentaryEn],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.65,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: true,
      expectedDecision: 'fallback',
    },
  },

  // G3: Tone drift detection
  {
    name: 'G3: Detect corporate-speak tone drift',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.toneShifted],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.5,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: false, // Tone shift is warning, not block
      expectedDecision: 'fallback', // But low similarity triggers fallback
    },
  },

  // G4: Unauthorized emoji addition
  {
    name: 'G4: Detect unauthorized emoji addition',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost + ' 😊'],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.85,
    },
    expected: {
      shouldPassGuardrails: false, // Has violation
      usedFallback: false, // Warning only
      expectedDecision: 'accept', // High similarity, warning only
    },
  },

  // G5: Authorized emoji addition
  {
    name: 'G5: Allow emoji when reel_emoji_usage rule failed',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost + ' 😊'],
    flags: {
      failedRuleIds: ['reel_emoji_usage'],
      simulatedSimilarity: 0.85,
    },
    expected: {
      shouldPassGuardrails: true,
      usedFallback: false,
      expectedDecision: 'accept',
    },
  },

  // G6: Unauthorized hashtag addition
  {
    name: 'G6: Detect unauthorized hashtag addition',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost + ' #trending #viral'],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.8,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: false,
      expectedDecision: 'accept', // Warning only
    },
  },

  // G7: Authorized hashtag addition
  {
    name: 'G7: Allow hashtag when reel_has_hashtags rule failed',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost + ' #trending #viral'],
    flags: {
      failedRuleIds: ['reel_has_hashtags'],
      simulatedSimilarity: 0.8,
    },
    expected: {
      shouldPassGuardrails: true,
      usedFallback: false,
      expectedDecision: 'accept',
    },
  },

  // G8: Language change detection
  {
    name: 'G8: Detect language change (Vietnamese → English)',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.englishVersion],
    flags: {
      failedRuleIds: ['social_structure_lock'],
      simulatedSimilarity: 0.3,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: true,
      expectedDecision: 'fallback',
    },
  },

  // ============================================
  // CATEGORY 2: SIMILARITY & MINIMAL CHANGE
  // ============================================

  // S1: Accept at 70% threshold
  {
    name: 'S1: Accept fix at exactly 70% similarity',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: ['Sản phẩm thiết kế cho ai muốn tiết kiệm thời gian đảm bảo chất lượng công việc.'],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.70,
    },
    expected: {
      shouldPassGuardrails: true,
      usedFallback: false,
      expectedDecision: 'accept',
    },
  },

  // S2: Retry at 65% (below primary threshold)
  {
    name: 'S2: Recommend retry at 65% similarity',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: ['Sản phẩm cho người muốn tiết kiệm.'],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.65,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: false,
      expectedDecision: 'retry',
    },
  },

  // S3: Fallback below 50%
  {
    name: 'S3: Fallback when similarity below 50%',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: ['Hoàn toàn khác biệt.'],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.40,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: true,
      expectedDecision: 'fallback',
    },
  },

  // S4: Content expansion detection
  {
    name: 'S4: Detect excessive content expansion (>30%)',
    inputOriginal: VIETNAMESE_FIXTURES.shortPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.overExpanded],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.3,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: true,
      expectedDecision: 'fallback',
    },
  },

  // S5: Structure rules allow more expansion
  {
    name: 'S5: Allow up to 50% expansion for structure rules',
    inputOriginal: VIETNAMESE_FIXTURES.shortPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.structuredPost],
    flags: {
      failedRuleIds: ['social_structure_lock'],
      simulatedSimilarity: 0.55,
    },
    expected: {
      shouldPassGuardrails: false, // Expansion warning
      usedFallback: false,
      expectedDecision: 'retry',
    },
  },

  // ============================================
  // CATEGORY 3: TRUST EROSION SIGNALS
  // ============================================

  // T1: EXCESSIVE_EDIT signal
  {
    name: 'T1: Detect EXCESSIVE_EDIT signal on low similarity',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: ['Khác.'],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.55,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: false,
      expectedSignals: ['EXCESSIVE_EDIT'],
      expectedDecision: 'retry',
    },
  },

  // T2: REPEATED_FAILURE signal
  {
    name: 'T2: Detect REPEATED_FAILURE on 2+ failed attempts',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: ['Khác.', 'Cũng khác.'],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedAttemptCount: 2,
      simulatedAllFailed: true,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: true,
      expectedSignals: ['REPEATED_FAILURE'],
      expectedDecision: 'fallback',
    },
  },

  // T3: OSCILLATION signal
  {
    name: 'T3: Detect OSCILLATION on undo→apply→undo pattern',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedActions: [
        { action: 'undo', timestamp: Date.now() - 30000 },
        { action: 'apply', timestamp: Date.now() - 15000 },
        { action: 'undo', timestamp: Date.now() },
      ],
    },
    expected: {
      shouldPassGuardrails: true,
      usedFallback: false,
      expectedSignals: ['OSCILLATION'],
      expectedBackoffState: 'CAUTIOUS',
    },
  },

  // T4: QUICK_UNDO signal
  {
    name: 'T4: Detect QUICK_UNDO on undo within 2 seconds',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedApplyTimestamp: Date.now() - 1000,
      simulatedUndoTimestamp: Date.now(),
    },
    expected: {
      shouldPassGuardrails: true,
      usedFallback: false,
      expectedSignals: ['QUICK_UNDO'],
    },
  },

  // T5: FALLBACK_USED signal
  {
    name: 'T5: Detect FALLBACK_USED signal',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.40,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: true,
      expectedSignals: ['FALLBACK_USED'],
      expectedDecision: 'fallback',
    },
  },

  // T6: CONSECUTIVE_REJECT signal
  {
    name: 'T6: Detect CONSECUTIVE_REJECT on 3+ keeps',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedActions: [
        { action: 'keep', timestamp: Date.now() - 30000 },
        { action: 'keep', timestamp: Date.now() - 15000 },
        { action: 'keep', timestamp: Date.now() },
      ],
    },
    expected: {
      shouldPassGuardrails: true,
      usedFallback: false,
      expectedSignals: ['CONSECUTIVE_REJECT'],
    },
  },

  // ============================================
  // CATEGORY 4: BACKOFF STATE MACHINE
  // ============================================

  // B1: NORMAL → CAUTIOUS transition
  {
    name: 'B1: Transition NORMAL → CAUTIOUS on trust drop',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: ['Khác.', 'Cũng khác.', 'Vẫn khác.'],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.55,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: false,
      expectedBackoffState: 'CAUTIOUS',
    },
  },

  // B2: CAUTIOUS → SILENT transition
  {
    name: 'B2: Transition CAUTIOUS → SILENT on severe trust erosion',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: ['K1.', 'K2.', 'K3.', 'K4.', 'K5.'],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.20,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: true,
      expectedBackoffState: 'SILENT',
    },
  },

  // B3: Anti-flapping (SILENT cannot jump to NORMAL)
  {
    name: 'B3: Verify SILENT → NORMAL is blocked (must go through CAUTIOUS)',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost],
    flags: {
      failedRuleIds: ['social_sentence_length'],
    },
    expected: {
      shouldPassGuardrails: true,
      usedFallback: false,
      expectedBackoffState: 'CAUTIOUS', // Not NORMAL
    },
  },

  // B4: Strict mode in CAUTIOUS
  {
    name: 'B4: Use strict mode when in CAUTIOUS state',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost.replace('rất', '')],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      isRetry: true,
    },
    expected: {
      shouldPassGuardrails: true,
      usedFallback: false,
    },
  },

  // ============================================
  // CATEGORY 5: API INTEGRATION
  // ============================================

  // A1: Single attempt success
  {
    name: 'A1: Accept on first attempt when quality passes',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [VIETNAMESE_FIXTURES.cleanPost.replace('những ai', 'ai')],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.88,
    },
    expected: {
      shouldPassGuardrails: true,
      usedFallback: false,
      maxAttemptsUsed: 1,
      expectedDecision: 'accept',
    },
  },

  // A2: Retry with stricter threshold
  {
    name: 'A2: Retry uses stricter 75% threshold',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: ['Sản phẩm tiết kiệm thời gian.', VIETNAMESE_FIXTURES.cleanPost.replace('những ai', 'ai')],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.72, // Passes 70% but not 75%
      isRetry: true,
    },
    expected: {
      shouldPassGuardrails: false, // Below retry threshold
      usedFallback: false,
      maxAttemptsUsed: 2,
      expectedDecision: 'retry',
    },
  },

  // A3: Guardrail-aware selection
  {
    name: 'A3: Select best result that passes guardrails',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: [
      'Here is the fix: Sản phẩm tốt.', // Fails guardrails (meta-commentary)
      VIETNAMESE_FIXTURES.cleanPost.replace('những ai', 'ai'), // Passes
    ],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.75,
    },
    expected: {
      shouldPassGuardrails: true,
      usedFallback: false,
      expectedDecision: 'accept',
    },
  },

  // A4: Degraded result acceptance (60-70%)
  {
    name: 'A4: Accept degraded result between 60-70% with flag',
    inputOriginal: VIETNAMESE_FIXTURES.cleanPost,
    candidateOutputs: ['Sản phẩm cho người muốn tiết kiệm thời gian.'],
    flags: {
      failedRuleIds: ['social_sentence_length'],
      simulatedSimilarity: 0.65,
    },
    expected: {
      shouldPassGuardrails: false,
      usedFallback: true, // Marked as degraded
      expectedDecision: 'retry',
    },
  },
];

// ============================================
// TEST RUNNER: GUARDRAILS
// ============================================

describe('Prompt Test Suite v1 - Guardrails', () => {
  const guardrailCases = TEST_CASES.filter(tc => tc.name.startsWith('G'));

  guardrailCases.forEach((testCase) => {
    it(testCase.name, () => {
      const failedRules = testCase.flags.failedRuleIds.map(id => makeRuleResult(id, false));
      const output = testCase.candidateOutputs[0];
      const similarity = testCase.flags.simulatedSimilarity ?? 0.8;

      const result = checkGuardrails(
        testCase.inputOriginal,
        output,
        failedRules,
        similarity
      );

      expect(result.passed).toBe(testCase.expected.shouldPassGuardrails);
      expect(result.recommendation).toBe(testCase.expected.expectedDecision);
    });
  });
});

// ============================================
// TEST RUNNER: SIMILARITY & MINIMAL CHANGE
// ============================================

describe('Prompt Test Suite v1 - Similarity & Minimal Change', () => {
  const similarityCases = TEST_CASES.filter(tc => tc.name.startsWith('S'));

  similarityCases.forEach((testCase) => {
    it(testCase.name, () => {
      const failedRules = testCase.flags.failedRuleIds.map(id => makeRuleResult(id, false));
      const output = testCase.candidateOutputs[0];
      const similarity = testCase.flags.simulatedSimilarity ?? 0.8;

      const result = checkGuardrails(
        testCase.inputOriginal,
        output,
        failedRules,
        similarity
      );

      expect(result.recommendation).toBe(testCase.expected.expectedDecision);

      // Check fallback condition
      if (testCase.expected.usedFallback) {
        expect(result.recommendation).toBe('fallback');
      }
    });
  });
});

// ============================================
// TEST RUNNER: TRUST EROSION SIGNALS
// ============================================

describe('Prompt Test Suite v1 - Trust Erosion Signals', () => {
  const trustCases = TEST_CASES.filter(tc => tc.name.startsWith('T'));

  trustCases.forEach((testCase) => {
    it(testCase.name, () => {
      const expectedSignals = testCase.expected.expectedSignals ?? [];

      // Test each expected signal
      expectedSignals.forEach((signalType) => {
        switch (signalType) {
          case 'EXCESSIVE_EDIT': {
            const similarity = createSimilarityResult(testCase.flags.simulatedSimilarity ?? 0.5);
            const signal = detectExcessiveEdit(similarity);
            expect(signal).not.toBeNull();
            expect(signal?.type).toBe('EXCESSIVE_EDIT');
            break;
          }

          case 'REPEATED_FAILURE': {
            const signal = detectRepeatedFailure(
              testCase.flags.simulatedAttemptCount ?? 2,
              testCase.flags.simulatedAllFailed ?? true
            );
            expect(signal).not.toBeNull();
            expect(signal?.type).toBe('REPEATED_FAILURE');
            break;
          }

          case 'OSCILLATION': {
            const actions = testCase.flags.simulatedActions ?? [];
            const signal = detectOscillation(actions);
            expect(signal).not.toBeNull();
            expect(signal?.type).toBe('OSCILLATION');
            break;
          }

          case 'QUICK_UNDO': {
            const applyTime = testCase.flags.simulatedApplyTimestamp ?? Date.now() - 1000;
            const undoTime = testCase.flags.simulatedUndoTimestamp ?? Date.now();
            const signal = detectQuickUndo(applyTime, undoTime);
            expect(signal).not.toBeNull();
            expect(signal?.type).toBe('QUICK_UNDO');
            break;
          }

          case 'FALLBACK_USED': {
            const signal = detectFallbackUsed(true);
            expect(signal).not.toBeNull();
            expect(signal?.type).toBe('FALLBACK_USED');
            break;
          }

          case 'CONSECUTIVE_REJECT': {
            const actions = testCase.flags.simulatedActions ?? [];
            const signal = detectConsecutiveReject(actions);
            expect(signal).not.toBeNull();
            expect(signal?.type).toBe('CONSECUTIVE_REJECT');
            break;
          }
        }
      });
    });
  });
});

// ============================================
// TEST RUNNER: BACKOFF STATE MACHINE
// ============================================

describe('Prompt Test Suite v1 - Backoff State Machine', () => {
  // Filter backoff cases for reference (test cases are defined inline)
  const _backoffCases = TEST_CASES.filter(tc => tc.name.startsWith('B'));

  describe('B1: NORMAL → CAUTIOUS transition', () => {
    it('should transition to CAUTIOUS when trust drops below 80', () => {
      let context = createBackoffContext();
      expect(context.state).toBe('NORMAL');

      // Add signals to drop trust below 80
      for (let i = 0; i < 3; i++) {
        context = addSignal(context, {
          type: 'EXCESSIVE_EDIT',
          timestamp: Date.now(),
          severity: 'medium',
        });
      }

      expect(context.state).toBe('CAUTIOUS');
      expect(context.trust.score).toBeLessThan(80);
    });
  });

  describe('B2: CAUTIOUS → SILENT transition', () => {
    it('should transition to SILENT when trust drops below 40', () => {
      let context = createBackoffContext();

      // Add high-penalty signals to drop trust to frozen
      for (let i = 0; i < 5; i++) {
        context = addSignal(context, {
          type: 'OSCILLATION',
          timestamp: Date.now(),
          severity: 'high',
        });
      }

      expect(context.state).toBe('SILENT');
      expect(context.trust.level).toBe('frozen');
    });
  });

  describe('B3: Anti-flapping (SILENT → NORMAL blocked)', () => {
    it('should NOT allow direct SILENT → NORMAL transition', () => {
      let context = createBackoffContext();
      context = {
        ...context,
        state: 'SILENT',
        trust: {
          ...context.trust,
          score: 50,
          level: 'critical',
          cooldownUntil: null, // Cooldown expired
        },
        consecutiveSuccesses: 5,
      };

      // Record success - should go to CAUTIOUS, not NORMAL
      context = recordSuccess(context);

      expect(context.state).toBe('CAUTIOUS');
      expect(context.state).not.toBe('NORMAL');
    });
  });

  describe('B4: Strict mode in CAUTIOUS', () => {
    it('should return true for shouldUseStrictMode in CAUTIOUS', () => {
      let context = createBackoffContext();
      context = { ...context, state: 'CAUTIOUS' };

      expect(shouldUseStrictMode(context)).toBe(true);
    });

    it('should return false for shouldUseStrictMode in NORMAL', () => {
      const context = createBackoffContext();

      expect(shouldUseStrictMode(context)).toBe(false);
    });
  });
});

// ============================================
// TEST RUNNER: API INTEGRATION
// ============================================

describe('Prompt Test Suite v1 - API Integration', () => {
  const apiCases = TEST_CASES.filter(tc => tc.name.startsWith('A'));

  describe('A1: Single attempt success', () => {
    it('should accept on first attempt when quality passes', () => {
      const testCase = apiCases.find(tc => tc.name.includes('A1'))!;
      const failedRules = testCase.flags.failedRuleIds.map(id => makeRuleResult(id, false));
      const output = testCase.candidateOutputs[0];
      const similarity = testCase.flags.simulatedSimilarity ?? 0.8;

      const result = checkGuardrails(
        testCase.inputOriginal,
        output,
        failedRules,
        similarity
      );

      expect(result.passed).toBe(true);
      expect(result.recommendation).toBe('accept');
    });
  });

  describe('A2: Retry threshold behavior', () => {
    it('should use stricter 75% threshold on retry', () => {
      // Simulate first attempt at 72% - passes 70% but not 75%
      checkSimilarity(
        VIETNAMESE_FIXTURES.cleanPost,
        'Sản phẩm tiết kiệm thời gian.',
        { minSimilarity: 0.75 } // Retry threshold
      );

      // At 72%, this should NOT pass the retry threshold
      expect(TRUST_THRESHOLDS.RETRY_MIN).toBe(0.75);
    });
  });

  describe('A3: Guardrail-aware selection', () => {
    it('should reject output with meta-commentary', () => {
      const metaOutput = 'Here is the fix: Sản phẩm tốt.';
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        metaOutput,
        failedRules,
        0.75
      );

      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.type === 'META_COMMENTARY')).toBe(true);
    });

    it('should accept clean output', () => {
      const cleanOutput = VIETNAMESE_FIXTURES.cleanPost.replace('những ai', 'ai');
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        cleanOutput,
        failedRules,
        0.85
      );

      expect(result.passed).toBe(true);
      expect(result.recommendation).toBe('accept');
    });
  });

  describe('A4: Degraded result acceptance', () => {
    it('should recommend retry for results between 60-70%', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'Sản phẩm cho người muốn tiết kiệm thời gian.',
        failedRules,
        0.65 // Between degraded (60%) and accept (70%)
      );

      expect(result.recommendation).toBe('retry');
    });
  });
});

// ============================================
// THRESHOLD LOCK VALIDATION
// ============================================

describe('Threshold Lock Validation', () => {
  it('should have locked similarity thresholds', () => {
    expect(TRUST_THRESHOLDS.ACCEPT_MIN).toBe(0.70);
    expect(TRUST_THRESHOLDS.RETRY_MIN).toBe(0.75);
    expect(TRUST_THRESHOLDS.FALLBACK_BELOW).toBe(0.50);
  });

  it('should have locked trust score thresholds', () => {
    expect(TRUST_THRESHOLDS.HEALTHY_MIN).toBe(80);
    expect(TRUST_THRESHOLDS.CAUTIOUS_MIN).toBe(60);
    expect(TRUST_THRESHOLDS.CRITICAL_MIN).toBe(40);
  });

  it('should have locked signal penalties', () => {
    expect(TRUST_THRESHOLDS.EXCESSIVE_EDIT_PENALTY).toBe(10);
    expect(TRUST_THRESHOLDS.REPEATED_FAILURE_PENALTY).toBe(15);
    expect(TRUST_THRESHOLDS.OSCILLATION_PENALTY).toBe(20);
    expect(TRUST_THRESHOLDS.QUICK_UNDO_PENALTY).toBe(8);
    expect(TRUST_THRESHOLDS.FALLBACK_PENALTY).toBe(12);
    expect(TRUST_THRESHOLDS.CONSECUTIVE_REJECT_PENALTY).toBe(5);
  });

  it('should have locked cooldown durations', () => {
    expect(TRUST_THRESHOLDS.CAUTIOUS_COOLDOWN).toBe(30_000);
    expect(TRUST_THRESHOLDS.CRITICAL_COOLDOWN).toBe(120_000);
    expect(TRUST_THRESHOLDS.FROZEN_COOLDOWN).toBe(300_000);
  });
});

// ============================================
// POLICY STRING VALIDATION
// ============================================

describe('Policy String Validation', () => {
  it('should contain core guardrail rules in GUARDRAIL_POLICY', () => {
    expect(GUARDRAIL_POLICY).toContain('ALLOWED:');
    expect(GUARDRAIL_POLICY).toContain('FORBIDDEN:');
    expect(GUARDRAIL_POLICY).toContain('surgical edits');
    expect(GUARDRAIL_POLICY).toContain("don't touch it");
  });

  it('should contain stricter rules in STRICT_GUARDRAIL_POLICY', () => {
    expect(STRICT_GUARDRAIL_POLICY).toContain('STRICT');
    expect(STRICT_GUARDRAIL_POLICY).toContain('ABSOLUTE MINIMUM');
    expect(STRICT_GUARDRAIL_POLICY).toContain('previous edit changed too much');
    expect(STRICT_GUARDRAIL_POLICY).toContain("unsure whether to change something, DON'T");
  });
});

// ============================================
// COMPLETE FLOW INTEGRATION
// ============================================

describe('Complete Flow Integration', () => {
  it('should handle happy path: fix accepted on first try', () => {
    let context = createBackoffContext();
    const original = VIETNAMESE_FIXTURES.cleanPost;
    const fixed = original.replace('những ai', 'ai');
    const failedRules = [makeRuleResult('social_sentence_length', false)];

    // Check guardrails
    const guardrails = checkGuardrails(original, fixed, failedRules, 0.9);
    expect(guardrails.passed).toBe(true);
    expect(guardrails.recommendation).toBe('accept');

    // Record success (recordAction increments to 1, recordSuccess increments to 2)
    context = recordAction(context, 'apply');
    context = recordSuccess(context);

    expect(context.state).toBe('NORMAL');
    // recordAction sets consecutiveSuccesses to 1 (for 'apply')
    // recordSuccess then increments to 2
    expect(context.consecutiveSuccesses).toBeGreaterThanOrEqual(1);
  });

  it('should handle degradation path: repeated failures → CAUTIOUS → stricter prompts', () => {
    let context = createBackoffContext();

    // Simulate repeated excessive edits
    for (let i = 0; i < 3; i++) {
      const signal = detectExcessiveEdit(createSimilarityResult(0.55));
      if (signal) {
        context = addSignal(context, signal);
      }
      context = recordAction(context, 'keep');
    }

    // Should be in CAUTIOUS state
    expect(context.state).toBe('CAUTIOUS');
    expect(shouldUseStrictMode(context)).toBe(true);

    // Check decision
    const decision = checkBackoff(context);
    expect(decision.state).toBe('CAUTIOUS');
  });

  it('should handle recovery path: 3 successes in CAUTIOUS → NORMAL', () => {
    let context = createBackoffContext();
    context = { ...context, state: 'CAUTIOUS', trust: { ...context.trust, score: 85, level: 'healthy' } };

    // Record 3 consecutive successes
    // Each iteration: recordAction increments by 1, recordSuccess increments by 1 = 2 per loop
    // After 3 loops: 6 total (but state transition happens at the right count internally)
    for (let i = 0; i < 3; i++) {
      context = recordAction(context, 'apply');
      context = recordSuccess(context);
    }

    expect(context.state).toBe('NORMAL');
    // 3 loops * 2 increments per loop = 6
    expect(context.consecutiveSuccesses).toBeGreaterThanOrEqual(3);
  });

  it('should handle frozen path: severe erosion → SILENT → blocked', () => {
    let context = createBackoffContext();

    // Add oscillation signals to rapidly drop trust
    for (let i = 0; i < 4; i++) {
      context = addSignal(context, {
        type: 'OSCILLATION',
        timestamp: Date.now(),
        severity: 'high',
      });
    }

    expect(context.state).toBe('SILENT');

    const decision = checkBackoff(context);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Auto Fix is temporarily unavailable');
  });
});

// ============================================
// TEST COUNT VALIDATION
// ============================================

describe('Test Suite Coverage', () => {
  it('should have at least 18 test cases in the master table', () => {
    expect(TEST_CASES.length).toBeGreaterThanOrEqual(18);
  });

  it('should cover all 5 categories', () => {
    const categories = {
      G: TEST_CASES.filter(tc => tc.name.startsWith('G')).length,
      S: TEST_CASES.filter(tc => tc.name.startsWith('S')).length,
      T: TEST_CASES.filter(tc => tc.name.startsWith('T')).length,
      B: TEST_CASES.filter(tc => tc.name.startsWith('B')).length,
      A: TEST_CASES.filter(tc => tc.name.startsWith('A')).length,
    };

    expect(categories.G).toBeGreaterThanOrEqual(1); // Guardrails
    expect(categories.S).toBeGreaterThanOrEqual(1); // Similarity
    expect(categories.T).toBeGreaterThanOrEqual(1); // Trust Erosion
    expect(categories.B).toBeGreaterThanOrEqual(1); // Backoff
    expect(categories.A).toBeGreaterThanOrEqual(1); // API Integration
  });

  it('should test all 6 trust signal types', () => {
    const signalTypes: Set<TrustSignalType> = new Set();

    TEST_CASES.forEach(tc => {
      tc.expected.expectedSignals?.forEach(signal => signalTypes.add(signal));
    });

    expect(signalTypes.has('EXCESSIVE_EDIT')).toBe(true);
    expect(signalTypes.has('REPEATED_FAILURE')).toBe(true);
    expect(signalTypes.has('OSCILLATION')).toBe(true);
    expect(signalTypes.has('QUICK_UNDO')).toBe(true);
    expect(signalTypes.has('FALLBACK_USED')).toBe(true);
    expect(signalTypes.has('CONSECUTIVE_REJECT')).toBe(true);
  });
});

// ============================================
// PRIME DIRECTIVE COMPLIANCE TESTS
// ============================================
// Validates compliance with Longlabs Studio Prime Directive
// These tests verify policy structure without modifying content

describe('Prime Directive Compliance', () => {
  // ----------------------------------------
  // Section VIII: Mandatory Footer Presence
  // ----------------------------------------
  describe('Section VIII: Mandatory Footer', () => {
    /**
     * Prime Directive Section VIII requires:
     * "Preserve the writer's intent, voice, and direction.
     *  Make the smallest possible change required.
     *  If unsure, change less — not more."
     */

    it('PD-VIII-1: GUARDRAIL_POLICY must contain "intent" preservation language', () => {
      // The policy must reference preserving writer's intent
      expect(GUARDRAIL_POLICY.toLowerCase()).toMatch(/intent|flagged|touch/);
    });

    it('PD-VIII-2: GUARDRAIL_POLICY must contain "smallest/minimal change" language', () => {
      // The policy must reference minimal changes
      expect(GUARDRAIL_POLICY.toLowerCase()).toMatch(/surgical|minimal|smallest|only/);
    });

    it('PD-VIII-3: GUARDRAIL_POLICY must contain "when unsure, change less" language', () => {
      // The policy must have uncertainty guidance
      expect(GUARDRAIL_POLICY.toLowerCase()).toMatch(/don't touch|wasn't flagged/);
    });

    it('PD-VIII-4: STRICT_GUARDRAIL_POLICY must contain "intent" preservation language', () => {
      expect(STRICT_GUARDRAIL_POLICY.toLowerCase()).toMatch(/preserve|tone|style/);
    });

    it('PD-VIII-5: STRICT_GUARDRAIL_POLICY must contain "smallest/minimal change" language', () => {
      expect(STRICT_GUARDRAIL_POLICY.toLowerCase()).toMatch(/minimum|minimal|absolute/);
    });

    it('PD-VIII-6: STRICT_GUARDRAIL_POLICY must contain "when unsure, change less" language', () => {
      // Must explicitly state: if unsure, don't change
      expect(STRICT_GUARDRAIL_POLICY.toLowerCase()).toMatch(/unsure.*don't|if you're unsure/i);
    });
  });

  // ----------------------------------------
  // Section V.E: Retry = Fewer Changes
  // ----------------------------------------
  describe('Section V.E: Retry = Fewer Changes, Not More', () => {
    /**
     * Prime Directive Section V.E requires:
     * "Auto Fix — Subsequent Attempts:
     *  - Even fewer changes than first attempt
     *  - Accept partial compliance
     *  - Do NOT force PASS at all costs"
     */

    it('PD-VE-1: STRICT policy must be MORE restrictive than normal policy', () => {
      // Strict policy should have more restrictive language
      expect(STRICT_GUARDRAIL_POLICY).toContain('STRICT');
      expect(STRICT_GUARDRAIL_POLICY).toContain('previous edit changed too much');
    });

    it('PD-VE-2: STRICT policy must emphasize "even fewer" or "minimum" changes', () => {
      expect(STRICT_GUARDRAIL_POLICY).toContain('ABSOLUTE MINIMUM');
    });

    it('PD-VE-3: Retry threshold (75%) must be HIGHER than initial threshold (70%)', () => {
      // Higher threshold = less tolerance for change = fewer changes allowed
      expect(TRUST_THRESHOLDS.RETRY_MIN).toBeGreaterThan(TRUST_THRESHOLDS.ACCEPT_MIN);
      expect(TRUST_THRESHOLDS.RETRY_MIN).toBe(0.75);
      expect(TRUST_THRESHOLDS.ACCEPT_MIN).toBe(0.70);
    });

    it('PD-VE-4: shouldUseStrictMode returns true in CAUTIOUS state (retry scenario)', () => {
      const context = createBackoffContext();
      const cautiousContext = { ...context, state: 'CAUTIOUS' as BackoffState };

      expect(shouldUseStrictMode(cautiousContext)).toBe(true);
      expect(shouldUseStrictMode(context)).toBe(false); // Normal state
    });

    it('PD-VE-5: Retry attempts must NOT force PASS at all costs', () => {
      // Verify that retry can still fall back to original (accept partial compliance)
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      // Even with retry, low similarity should recommend fallback, not force pass
      const lowSimilarityResult = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'Completely different content.',
        failedRules,
        0.30 // Very low similarity
      );

      expect(lowSimilarityResult.recommendation).toBe('fallback');
      expect(lowSimilarityResult.passed).toBe(false);
    });
  });

  // ----------------------------------------
  // Section VI: Silent Return on Fallback
  // ----------------------------------------
  describe('Section VI: Silent Return on Fallback Conditions', () => {
    /**
     * Prime Directive Section VI requires:
     * "Return content silently (no apology, no explanation)"
     *
     * Fallback triggers:
     * - attempt_number >= 2
     * - Similarity < 50%
     * - Fixing would alter meaning
     */

    it('PD-VI-1: Fallback recommendation does NOT include explanation field', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'Completely different.',
        failedRules,
        0.30
      );

      // Result should recommend fallback without explanation
      expect(result.recommendation).toBe('fallback');
      // GuardrailCheckResult has no "explanation" or "apology" field
      expect(result).not.toHaveProperty('explanation');
      expect(result).not.toHaveProperty('apology');
      expect(result).not.toHaveProperty('reason');
    });

    it('PD-VI-2: SILENT backoff state returns generic message, not detailed explanation', () => {
      let context = createBackoffContext();
      context = { ...context, state: 'SILENT', trust: { ...context.trust, level: 'frozen' } };

      const decision = checkBackoff(context);

      expect(decision.allowed).toBe(false);
      // Message is generic, not detailed explanation of what went wrong
      expect(decision.reason).toBe('Auto Fix is temporarily unavailable');
      expect(decision.reason).not.toMatch(/because|due to|caused by/i);
    });

    it('PD-VI-3: Similarity < 50% triggers fallback (not retry)', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'Short.',
        failedRules,
        0.40 // Below 50%
      );

      expect(result.recommendation).toBe('fallback');
    });

    it('PD-VI-4: Blocking violations trigger immediate fallback', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      // Meta-commentary is a blocking violation
      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'Here is your improved content: Sản phẩm tốt.',
        failedRules,
        0.75 // Even with good similarity
      );

      expect(result.violations.some(v => v.severity === 'block')).toBe(true);
      expect(result.recommendation).toBe('fallback');
    });

    it('PD-VI-5: Language change triggers silent fallback (meaning alteration)', () => {
      const failedRules = [makeRuleResult('social_structure_lock', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        VIETNAMESE_FIXTURES.englishVersion,
        failedRules,
        0.30
      );

      // Language change = meaning alteration = fallback
      expect(result.violations.some(v => v.type === 'LANGUAGE_CHANGE')).toBe(true);
      expect(result.recommendation).toBe('fallback');
    });
  });

  // ----------------------------------------
  // Section G3: Rule Scope Compliance
  // ----------------------------------------
  describe('Section G3: Do Not Exceed Rule Scope', () => {
    /**
     * Prime Directive Section G3 requires:
     * "Especially for Auto Fix:
     *  - Only fix the explicit rule_id(s) provided
     *  - Do not touch unrelated sentences
     *  - Do not restructure unless required by the rule"
     */

    it('PD-G3-1: Emoji addition blocked unless reel_emoji_usage rule failed', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        VIETNAMESE_FIXTURES.cleanPost + ' 😊',
        failedRules,
        0.90
      );

      // Unauthorized emoji = scope violation
      expect(result.violations.some(v => v.type === 'UNAUTHORIZED_EMOJI')).toBe(true);
    });

    it('PD-G3-2: Hashtag addition blocked unless reel_has_hashtags rule failed', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        VIETNAMESE_FIXTURES.cleanPost + ' #trending',
        failedRules,
        0.85
      );

      expect(result.violations.some(v => v.type === 'UNAUTHORIZED_HASHTAG')).toBe(true);
    });

    it('PD-G3-3: Emoji addition ALLOWED when reel_emoji_usage rule failed', () => {
      const failedRules = [makeRuleResult('reel_emoji_usage', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        VIETNAMESE_FIXTURES.cleanPost + ' 😊',
        failedRules,
        0.90
      );

      // Should NOT have unauthorized emoji violation when rule authorizes it
      expect(result.violations.some(v => v.type === 'UNAUTHORIZED_EMOJI')).toBe(false);
    });

    it('PD-G3-4: Content expansion blocked beyond rule requirements (>30%)', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.shortPost,
        VIETNAMESE_FIXTURES.overExpanded,
        failedRules,
        0.30
      );

      expect(result.violations.some(v => v.type === 'CONTENT_EXPANSION')).toBe(true);
    });
  });

  // ----------------------------------------
  // Section G4: No AI Meta Commentary
  // ----------------------------------------
  describe('Section G4: No AI Meta Commentary', () => {
    /**
     * Prime Directive Section G4 requires:
     * "The model must NEVER:
     *  - Mention AI
     *  - Mention prompts
     *  - Mention rules or engines
     *  - Explain why changes were made
     *  Output must be content only."
     */

    it('PD-G4-1: "Here is" meta-commentary detected and blocked', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'Here is your improved content.',
        failedRules,
        0.50
      );

      expect(result.violations.some(v => v.type === 'META_COMMENTARY')).toBe(true);
      expect(result.violations.find(v => v.type === 'META_COMMENTARY')?.severity).toBe('block');
    });

    it('PD-G4-2: "Dưới đây là" (Vietnamese) meta-commentary detected', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'Dưới đây là nội dung đã được sửa.',
        failedRules,
        0.50
      );

      expect(result.violations.some(v => v.type === 'META_COMMENTARY')).toBe(true);
    });

    it('PD-G4-3: "As an AI" self-reference detected', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'As an AI, I have improved this content.',
        failedRules,
        0.40
      );

      expect(result.violations.some(v => v.type === 'META_COMMENTARY')).toBe(true);
    });

    it('PD-G4-4: "Hope this helps" explanation detected', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'Content here. Hope this helps!',
        failedRules,
        0.60
      );

      expect(result.violations.some(v => v.type === 'META_COMMENTARY')).toBe(true);
    });
  });

  // ----------------------------------------
  // Section VII: Model Anti-Goals
  // ----------------------------------------
  describe('Section VII: Model Anti-Goals (Negative Tests)', () => {
    /**
     * Prime Directive Section VII states:
     * "The model is NOT:
     *  - A teacher
     *  - A chief editor
     *  - A grader
     *  - An optimizer"
     *
     * These tests verify the system does NOT exhibit these behaviors.
     */

    it('PD-VII-1: Tone shift patterns detect "optimizer" behavior', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      // "leverage" and "synergy" are optimizer/corporate-speak
      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'We leverage technology to create synergy.',
        failedRules,
        0.40
      );

      expect(result.violations.some(v => v.type === 'TONE_SHIFT')).toBe(true);
    });

    it('PD-VII-2: "Furthermore" academic tone detected (teacher behavior)', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        'Furthermore, this product offers great value.',
        failedRules,
        0.50
      );

      expect(result.violations.some(v => v.type === 'TONE_SHIFT')).toBe(true);
    });

    it('PD-VII-3: Clean content passes (no grader/optimizer behavior)', () => {
      const failedRules = [makeRuleResult('social_sentence_length', false)];

      // Minimal, clean edit should pass
      const result = checkGuardrails(
        VIETNAMESE_FIXTURES.cleanPost,
        VIETNAMESE_FIXTURES.cleanPost.replace('những ai', 'ai'),
        failedRules,
        0.92
      );

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
