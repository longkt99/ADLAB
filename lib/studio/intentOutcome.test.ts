// ============================================
// STEP 9: Intent Outcome Tests
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateIntentId,
  createOutcome,
  appendSignal,
  deriveOutcome,
  shouldMarkUnreliable,
  encodeOutcome,
  decodeOutcome,
  isOutcomeExpired,
  getOutcomeSummary,
  choiceToRoute,
  OUTCOME_TTL_MS,
  type IntentOutcome,
  type RouteUsed,
} from './intentOutcome';

// ============================================
// generateIntentId
// ============================================
describe('generateIntentId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateIntentId();
    const id2 = generateIntentId();
    expect(id1).not.toBe(id2);
  });

  it('should have the correct format', () => {
    const id = generateIntentId();
    expect(id).toMatch(/^intent-[a-z0-9]+-[a-z0-9]+$/);
  });
});

// ============================================
// createOutcome
// ============================================
describe('createOutcome', () => {
  it('should create an outcome with defaults', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });

    expect(outcome.intentId).toMatch(/^intent-/);
    expect(outcome.routeUsed).toBe('CREATE');
    expect(outcome.signals).toEqual([]);
    expect(outcome.derived).toEqual({
      accepted: false,
      negative: false,
      severity: 'low',
    });
    expect(outcome.createdAt).toBeGreaterThan(0);
    expect(outcome.lastEventAt).toBe(outcome.createdAt);
  });

  it('should use provided intentId', () => {
    const outcome = createOutcome({
      intentId: 'custom-id',
      routeUsed: 'TRANSFORM',
    });

    expect(outcome.intentId).toBe('custom-id');
  });

  it('should store optional fields', () => {
    const outcome = createOutcome({
      routeUsed: 'LOCAL_APPLY',
      patternHash: 'abc123',
      confidence: 0.85,
      decisionPathLabel: 'LEARNED_CHOICE',
    });

    expect(outcome.patternHash).toBe('abc123');
    expect(outcome.confidence).toBe(0.85);
    expect(outcome.decisionPathLabel).toBe('LEARNED_CHOICE');
  });
});

// ============================================
// appendSignal
// ============================================
describe('appendSignal', () => {
  it('should append a signal with auto-timestamp', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    const updated = appendSignal(outcome, { type: 'UNDO_WITHIN_WINDOW' });

    expect(updated.signals).toHaveLength(1);
    expect(updated.signals[0].type).toBe('UNDO_WITHIN_WINDOW');
    expect(updated.signals[0].ts).toBeGreaterThan(0);
    expect(updated.lastEventAt).toBe(updated.signals[0].ts);
  });

  it('should use provided timestamp', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    const ts = 1234567890;
    const updated = appendSignal(outcome, { type: 'ACCEPT_SILENTLY', ts });

    expect(updated.signals[0].ts).toBe(ts);
    expect(updated.lastEventAt).toBe(ts);
  });

  it('should preserve existing signals', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    const step1 = appendSignal(outcome, { type: 'EDIT_AFTER' });
    const step2 = appendSignal(step1, { type: 'ACCEPT_SILENTLY' });

    expect(step2.signals).toHaveLength(2);
    expect(step2.signals[0].type).toBe('EDIT_AFTER');
    expect(step2.signals[1].type).toBe('ACCEPT_SILENTLY');
  });

  it('should store metadata', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    const updated = appendSignal(outcome, {
      type: 'RESEND_IMMEDIATELY',
      meta: { delay: 5000 },
    });

    expect(updated.signals[0].meta).toEqual({ delay: 5000 });
  });

  it('should not mutate original outcome', () => {
    const original = createOutcome({ routeUsed: 'CREATE' });
    const updated = appendSignal(original, { type: 'UNDO_WITHIN_WINDOW' });

    expect(original.signals).toHaveLength(0);
    expect(updated.signals).toHaveLength(1);
    expect(original).not.toBe(updated);
  });
});

// ============================================
// deriveOutcome - Core derivation rules
// ============================================
describe('deriveOutcome', () => {
  let baseOutcome: IntentOutcome;

  beforeEach(() => {
    baseOutcome = createOutcome({ routeUsed: 'CREATE' });
  });

  describe('no signals', () => {
    it('should default to low severity, not accepted, not negative', () => {
      const derived = deriveOutcome(baseOutcome);

      expect(derived.derived).toEqual({
        accepted: false,
        negative: false,
        severity: 'low',
      });
    });
  });

  describe('UNDO_WITHIN_WINDOW', () => {
    it('should be high severity negative, not accepted', () => {
      const outcome = appendSignal(baseOutcome, { type: 'UNDO_WITHIN_WINDOW' });
      const derived = deriveOutcome(outcome);

      expect(derived.derived).toEqual({
        accepted: false,
        negative: true,
        severity: 'high',
      });
    });

    it('should override ACCEPT_SILENTLY', () => {
      let outcome = appendSignal(baseOutcome, { type: 'ACCEPT_SILENTLY' });
      outcome = appendSignal(outcome, { type: 'UNDO_WITHIN_WINDOW' });
      const derived = deriveOutcome(outcome);

      expect(derived.derived.negative).toBe(true);
      expect(derived.derived.severity).toBe('high');
      expect(derived.derived.accepted).toBe(false);
    });
  });

  describe('RESEND_IMMEDIATELY', () => {
    it('should be high severity negative without accept', () => {
      const outcome = appendSignal(baseOutcome, { type: 'RESEND_IMMEDIATELY' });
      const derived = deriveOutcome(outcome);

      expect(derived.derived).toEqual({
        accepted: false,
        negative: true,
        severity: 'high',
      });
    });

    it('should become accepted with ACCEPT_SILENTLY', () => {
      let outcome = appendSignal(baseOutcome, { type: 'RESEND_IMMEDIATELY' });
      outcome = appendSignal(outcome, { type: 'ACCEPT_SILENTLY' });
      const derived = deriveOutcome(outcome);

      expect(derived.derived.accepted).toBe(true);
      expect(derived.derived.negative).toBe(false);
      expect(derived.derived.severity).toBe('low');
    });
  });

  describe('EDIT_AFTER', () => {
    it('should be medium severity negative without accept', () => {
      const outcome = appendSignal(baseOutcome, { type: 'EDIT_AFTER' });
      const derived = deriveOutcome(outcome);

      expect(derived.derived).toEqual({
        accepted: false,
        negative: true,
        severity: 'medium',
      });
    });

    it('should become low severity accepted with ACCEPT_SILENTLY', () => {
      let outcome = appendSignal(baseOutcome, { type: 'EDIT_AFTER' });
      outcome = appendSignal(outcome, { type: 'ACCEPT_SILENTLY' });
      const derived = deriveOutcome(outcome);

      expect(derived.derived).toEqual({
        accepted: true,
        negative: false,
        severity: 'low',
      });
    });
  });

  describe('ACCEPT_SILENTLY alone', () => {
    it('should be low severity accepted', () => {
      const outcome = appendSignal(baseOutcome, { type: 'ACCEPT_SILENTLY' });
      const derived = deriveOutcome(outcome);

      expect(derived.derived).toEqual({
        accepted: true,
        negative: false,
        severity: 'low',
      });
    });
  });

  describe('complex combinations', () => {
    it('EDIT + RESEND + ACCEPT = accepted', () => {
      let outcome = appendSignal(baseOutcome, { type: 'EDIT_AFTER' });
      outcome = appendSignal(outcome, { type: 'RESEND_IMMEDIATELY' });
      outcome = appendSignal(outcome, { type: 'ACCEPT_SILENTLY' });
      const derived = deriveOutcome(outcome);

      // With ACCEPT_SILENTLY, even RESEND becomes accepted
      expect(derived.derived.accepted).toBe(true);
      expect(derived.derived.negative).toBe(false);
    });

    it('UNDO always wins regardless of other signals', () => {
      let outcome = appendSignal(baseOutcome, { type: 'ACCEPT_SILENTLY' });
      outcome = appendSignal(outcome, { type: 'EDIT_AFTER' });
      outcome = appendSignal(outcome, { type: 'UNDO_WITHIN_WINDOW' });
      const derived = deriveOutcome(outcome);

      expect(derived.derived.accepted).toBe(false);
      expect(derived.derived.negative).toBe(true);
      expect(derived.derived.severity).toBe('high');
    });
  });
});

// ============================================
// shouldMarkUnreliable
// ============================================
describe('shouldMarkUnreliable', () => {
  it('should return true for high severity negative', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    const withUndo = appendSignal(outcome, { type: 'UNDO_WITHIN_WINDOW' });
    const derived = deriveOutcome(withUndo);

    expect(shouldMarkUnreliable(derived)).toBe(true);
  });

  it('should return false for medium severity negative', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    const withEdit = appendSignal(outcome, { type: 'EDIT_AFTER' });
    const derived = deriveOutcome(withEdit);

    expect(shouldMarkUnreliable(derived)).toBe(false);
  });

  it('should return false for accepted', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    const withAccept = appendSignal(outcome, { type: 'ACCEPT_SILENTLY' });
    const derived = deriveOutcome(withAccept);

    expect(shouldMarkUnreliable(derived)).toBe(false);
  });

  it('should return false for pending (no signals)', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    expect(shouldMarkUnreliable(outcome)).toBe(false);
  });
});

// ============================================
// encodeOutcome / decodeOutcome
// ============================================
describe('encodeOutcome / decodeOutcome', () => {
  it('should round-trip an outcome', () => {
    const outcome = createOutcome({
      routeUsed: 'TRANSFORM',
      patternHash: 'abc123',
      confidence: 0.75,
    });
    const withSignal = appendSignal(outcome, { type: 'ACCEPT_SILENTLY' });
    const derived = deriveOutcome(withSignal);

    const encoded = encodeOutcome(derived);
    const decoded = decodeOutcome(encoded);

    expect(decoded).toEqual(derived);
  });

  it('should return null for invalid JSON', () => {
    expect(decodeOutcome('not-json')).toBeNull();
  });

  it('should return null for wrong version', () => {
    const data = { version: 2, outcome: {} };
    expect(decodeOutcome(JSON.stringify(data))).toBeNull();
  });

  it('should return null for expired outcome', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    // Set createdAt to past TTL
    const expired: IntentOutcome = {
      ...outcome,
      createdAt: Date.now() - OUTCOME_TTL_MS - 1000,
    };

    const encoded = encodeOutcome(expired);
    expect(decodeOutcome(encoded)).toBeNull();
  });
});

// ============================================
// isOutcomeExpired
// ============================================
describe('isOutcomeExpired', () => {
  it('should return false for fresh outcome', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    expect(isOutcomeExpired(outcome)).toBe(false);
  });

  it('should return true for expired outcome', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    const expired: IntentOutcome = {
      ...outcome,
      createdAt: Date.now() - OUTCOME_TTL_MS - 1000,
    };
    expect(isOutcomeExpired(expired)).toBe(true);
  });
});

// ============================================
// getOutcomeSummary
// ============================================
describe('getOutcomeSummary', () => {
  it('should return readable summary for pending', () => {
    const outcome = createOutcome({ routeUsed: 'CREATE' });
    const summary = getOutcomeSummary(outcome);

    expect(summary).toContain('CREATE');
    expect(summary).toContain('PENDING');
    expect(summary).toContain('low');
    expect(summary).toContain('none');
  });

  it('should include signals in summary', () => {
    let outcome = createOutcome({ routeUsed: 'TRANSFORM' });
    outcome = appendSignal(outcome, { type: 'EDIT_AFTER' });
    outcome = appendSignal(outcome, { type: 'ACCEPT_SILENTLY' });
    outcome = deriveOutcome(outcome);

    const summary = getOutcomeSummary(outcome);

    expect(summary).toContain('TRANSFORM');
    expect(summary).toContain('ACCEPTED');
    expect(summary).toContain('EDIT_AFTER');
    expect(summary).toContain('ACCEPT_SILENTLY');
  });

  it('should show negative marker', () => {
    let outcome = createOutcome({ routeUsed: 'LOCAL_APPLY' });
    outcome = appendSignal(outcome, { type: 'UNDO_WITHIN_WINDOW' });
    outcome = deriveOutcome(outcome);

    const summary = getOutcomeSummary(outcome);

    expect(summary).toContain('LOCAL_APPLY');
    expect(summary).toContain('PENDING'); // Not accepted
    expect(summary).toContain('high');
    expect(summary).toContain('NEG');
  });
});

// ============================================
// choiceToRoute
// ============================================
describe('choiceToRoute', () => {
  it('should map EDIT_IN_PLACE to LOCAL_APPLY', () => {
    expect(choiceToRoute('EDIT_IN_PLACE')).toBe('LOCAL_APPLY');
  });

  it('should map TRANSFORM_NEW_VERSION to TRANSFORM', () => {
    expect(choiceToRoute('TRANSFORM_NEW_VERSION')).toBe('TRANSFORM');
  });

  it('should map CREATE_NEW to CREATE', () => {
    expect(choiceToRoute('CREATE_NEW')).toBe('CREATE');
  });
});
