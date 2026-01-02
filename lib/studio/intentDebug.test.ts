// ============================================
// STEP 8: Intent Debug Tests
// ============================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isIntentDebugEnabled,
  detectWarnings,
  createDebugDecision,
  getDecisionPathLabel,
  getConfidenceColor,
  getDecisionEmoji,
  type DecisionPath,
} from './intentDebug';
import type { ConfidenceInput } from './intentConfidence';

// ============================================
// Mock environment and window
// ============================================
const originalEnv = process.env.NODE_ENV;

describe('isIntentDebugEnabled', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        search: '',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error - resetting env
    process.env.NODE_ENV = originalEnv;
  });

  it('should return false in production mode', () => {
    // @ts-expect-error - testing env
    process.env.NODE_ENV = 'production';
    vi.stubGlobal('window', {
      location: { search: '?debugIntent=1' },
    });

    expect(isIntentDebugEnabled()).toBe(false);
  });

  it('should return false without URL param in dev mode', () => {
    // @ts-expect-error - testing env
    process.env.NODE_ENV = 'development';
    vi.stubGlobal('window', {
      location: { search: '' },
    });

    expect(isIntentDebugEnabled()).toBe(false);
  });

  it('should return true with debugIntent=1 in dev mode', () => {
    // @ts-expect-error - testing env
    process.env.NODE_ENV = 'development';
    vi.stubGlobal('window', {
      location: { search: '?debugIntent=1' },
    });

    expect(isIntentDebugEnabled()).toBe(true);
  });

  it('should return true with debugIntent=true in dev mode', () => {
    // @ts-expect-error - testing env
    process.env.NODE_ENV = 'development';
    vi.stubGlobal('window', {
      location: { search: '?debugIntent=true' },
    });

    expect(isIntentDebugEnabled()).toBe(true);
  });

  it('should return false with debugIntent=0', () => {
    // @ts-expect-error - testing env
    process.env.NODE_ENV = 'development';
    vi.stubGlobal('window', {
      location: { search: '?debugIntent=0' },
    });

    expect(isIntentDebugEnabled()).toBe(false);
  });

  it('should return false when window is undefined (SSR)', () => {
    // @ts-expect-error - testing env
    process.env.NODE_ENV = 'development';
    vi.stubGlobal('window', undefined);

    expect(isIntentDebugEnabled()).toBe(false);
  });
});

// ============================================
// detectWarnings
// ============================================
describe('detectWarnings', () => {
  const baseParams = {
    inputText: 'test input',
    hasActiveSource: false,
    hasLastValidAssistant: false,
    confidenceResult: {
      routeHint: 'CREATE' as const,
      intentConfidence: 0.80,
      reason: 'Test reason',
    },
    autoApplyChoice: null,
    finalChoice: undefined,
  };

  it('should return empty array when no warnings', () => {
    const warnings = detectWarnings(baseParams);
    expect(warnings).toEqual([]);
  });

  it('should warn on low confidence auto-apply', () => {
    const warnings = detectWarnings({
      ...baseParams,
      confidenceResult: { ...baseParams.confidenceResult, intentConfidence: 0.50 },
      autoApplyChoice: 'CREATE_NEW',
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('LOW_CONFIDENCE_AUTO_APPLY');
  });

  it('should warn on route mismatch', () => {
    const warnings = detectWarnings({
      ...baseParams,
      confidenceResult: {
        routeHint: 'CREATE',
        intentConfidence: 0.75,
        reason: 'Test',
      },
      finalChoice: 'TRANSFORM_NEW_VERSION',
    });

    expect(warnings.some(w => w.includes('ROUTE_MISMATCH'))).toBe(true);
  });

  it('should warn on transform without context', () => {
    const warnings = detectWarnings({
      ...baseParams,
      hasActiveSource: false,
      hasLastValidAssistant: false,
      finalChoice: 'TRANSFORM_NEW_VERSION',
    });

    expect(warnings.some(w => w.includes('TRANSFORM_NO_CONTEXT'))).toBe(true);
  });

  it('should warn on short ambiguous input with source', () => {
    const warnings = detectWarnings({
      ...baseParams,
      inputText: 'abc',
      hasActiveSource: true,
    });

    expect(warnings.some(w => w.includes('SHORT_AMBIGUOUS'))).toBe(true);
  });

  it('should warn on CREATE choice with active source', () => {
    const warnings = detectWarnings({
      ...baseParams,
      hasActiveSource: true,
      finalChoice: 'CREATE_NEW',
    });

    expect(warnings.some(w => w.includes('CREATE_WITH_SOURCE'))).toBe(true);
  });
});

// ============================================
// createDebugDecision
// ============================================
describe('createDebugDecision', () => {
  const baseConfidenceInput: ConfidenceInput = {
    inputText: 'test input',
    hasActiveSource: true,
    hasLastValidAssistant: true,
    isExplicitNewCreate: false,
    isExplicitTransformRef: false,
    isAmbiguousTransform: false,
    inputLength: 10,
  };

  const baseConfidenceResult = {
    routeHint: 'TRANSFORM' as const,
    intentConfidence: 0.75,
    reason: 'Test reason',
  };

  it('should create a valid debug decision', () => {
    const decision = createDebugDecision({
      patternHash: 'abc123',
      confidenceInput: baseConfidenceInput,
      confidenceResult: baseConfidenceResult,
      decisionPath: 'USER_CONFIRMED',
      autoApplyChoice: null,
      confirmationShown: true,
      uiSourceMessageId: 'msg-1',
      finalChoice: 'TRANSFORM_NEW_VERSION',
    });

    expect(decision.patternHash).toBe('abc123');
    expect(decision.inputLength).toBe(10);
    expect(decision.hasActiveSource).toBe(true);
    expect(decision.hasLastValidAssistant).toBe(true);
    expect(decision.confidence.routeHint).toBe('TRANSFORM');
    expect(decision.confidence.intentConfidence).toBe(0.75);
    expect(decision.decisionPath).toBe('USER_CONFIRMED');
    expect(decision.finalChoice).toBe('TRANSFORM_NEW_VERSION');
    expect(decision.autoApplied).toBe(false);
    expect(decision.confirmationShown).toBe(true);
    expect(decision.uiSourceMessageId).toBe('msg-1');
    expect(decision.timestamp).toBeGreaterThan(0);
  });

  it('should set autoApplied true when auto-apply choice is provided', () => {
    const decision = createDebugDecision({
      patternHash: 'abc123',
      confidenceInput: baseConfidenceInput,
      confidenceResult: baseConfidenceResult,
      decisionPath: 'LEARNED_CHOICE',
      autoApplyChoice: 'EDIT_IN_PLACE',
      learnedCount: 3,
      confirmationShown: false,
      uiSourceMessageId: null,
    });

    expect(decision.autoApplied).toBe(true);
    expect(decision.learnedCount).toBe(3);
  });

  it('should include warnings when applicable', () => {
    const decision = createDebugDecision({
      patternHash: 'abc123',
      confidenceInput: { ...baseConfidenceInput, inputText: 'ab', inputLength: 2 },
      confidenceResult: baseConfidenceResult,
      decisionPath: 'USER_CONFIRMED',
      autoApplyChoice: null,
      confirmationShown: true,
      uiSourceMessageId: 'msg-1',
      finalChoice: 'CREATE_NEW', // CREATE with active source
    });

    expect(decision.warnings.length).toBeGreaterThan(0);
  });
});

// ============================================
// Helper functions
// ============================================
describe('getDecisionPathLabel', () => {
  const cases: Array<[DecisionPath, string]> = [
    ['EXPLICIT_NEW_CREATE', 'Explicit Create'],
    ['EXPLICIT_TRANSFORM_REF', 'Explicit Transform'],
    ['LONG_INPUT', 'Long Input'],
    ['LEARNED_CHOICE', 'Learned'],
    ['SESSION_CACHE', 'Cached'],
    ['HIGH_CONFIDENCE_AUTO', 'High Conf.'],
    ['USER_CONFIRMED', 'Confirmed'],
    ['DEFAULT_NO_CONFIRM', 'Default'],
    ['CONFIRMATION_SHOWN', 'Confirming...'],
  ];

  it.each(cases)('should return "%s" for %s', (path: DecisionPath, expected: string) => {
    expect(getDecisionPathLabel(path)).toBe(expected);
  });
});

describe('getConfidenceColor', () => {
  it('should return green for high confidence (>=0.80)', () => {
    const colors = getConfidenceColor(0.85);
    expect(colors.bg).toContain('green');
    expect(colors.text).toContain('green');
  });

  it('should return yellow for medium confidence (0.65-0.79)', () => {
    const colors = getConfidenceColor(0.70);
    expect(colors.bg).toContain('yellow');
    expect(colors.text).toContain('yellow');
  });

  it('should return red for low confidence (<0.65)', () => {
    const colors = getConfidenceColor(0.50);
    expect(colors.bg).toContain('red');
    expect(colors.text).toContain('red');
  });

  it('should return green at exactly 0.80', () => {
    const colors = getConfidenceColor(0.80);
    expect(colors.bg).toContain('green');
  });

  it('should return yellow at exactly 0.65', () => {
    const colors = getConfidenceColor(0.65);
    expect(colors.bg).toContain('yellow');
  });
});

describe('getDecisionEmoji', () => {
  it('should return appropriate emojis for each path', () => {
    expect(getDecisionEmoji('EXPLICIT_NEW_CREATE')).toBe('✨');
    expect(getDecisionEmoji('EXPLICIT_TRANSFORM_REF')).toBe('🔄');
    expect(getDecisionEmoji('LEARNED_CHOICE')).toBe('🧠');
    expect(getDecisionEmoji('SESSION_CACHE')).toBe('💾');
    expect(getDecisionEmoji('USER_CONFIRMED')).toBe('✅');
    expect(getDecisionEmoji('CONFIRMATION_SHOWN')).toBe('❓');
  });
});
