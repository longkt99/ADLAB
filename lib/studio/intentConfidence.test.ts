// ============================================
// STEP 7: Intent Confidence Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  computeRouteConfidence,
  isHighConfidence,
  isLowConfidence,
  type ConfidenceInput,
} from './intentConfidence';

// ============================================
// Helper to create test input
// ============================================
function createInput(overrides: Partial<ConfidenceInput> = {}): ConfidenceInput {
  return {
    inputText: 'test input',
    hasActiveSource: false,
    hasLastValidAssistant: false,
    isExplicitNewCreate: false,
    isExplicitTransformRef: false,
    isAmbiguousTransform: false,
    inputLength: 10,
    ...overrides,
  };
}

describe('computeRouteConfidence', () => {
  // ============================================
  // Rule 1: Explicit New Create
  // ============================================
  describe('explicit new create', () => {
    it('should return CREATE with high confidence for explicit create signals', () => {
      const input = createInput({
        isExplicitNewCreate: true,
        inputText: 'viết bài mới về marketing',
      });

      const result = computeRouteConfidence(input);

      expect(result.routeHint).toBe('CREATE');
      expect(result.intentConfidence).toBeGreaterThanOrEqual(0.90);
      expect(result.reason).toContain('Explicit new create');
    });

    it('should prioritize explicit create over other signals', () => {
      const input = createInput({
        isExplicitNewCreate: true,
        hasActiveSource: true,
        isAmbiguousTransform: true,
      });

      const result = computeRouteConfidence(input);

      expect(result.routeHint).toBe('CREATE');
      expect(result.intentConfidence).toBeGreaterThanOrEqual(0.90);
    });
  });

  // ============================================
  // Rule 2: Explicit Transform Reference
  // ============================================
  describe('explicit transform reference', () => {
    it('should return TRANSFORM with high confidence for explicit transform refs', () => {
      const input = createInput({
        isExplicitTransformRef: true,
        inputText: 'sửa đoạn trên ngắn hơn',
      });

      const result = computeRouteConfidence(input);

      expect(result.routeHint).toBe('TRANSFORM');
      expect(result.intentConfidence).toBeGreaterThanOrEqual(0.85);
      expect(result.reason).toContain('Explicit transform reference');
    });

    it('should boost confidence when active source exists', () => {
      const withSource = createInput({
        isExplicitTransformRef: true,
        hasActiveSource: true,
      });

      const withoutSource = createInput({
        isExplicitTransformRef: true,
        hasActiveSource: false,
      });

      const resultWith = computeRouteConfidence(withSource);
      const resultWithout = computeRouteConfidence(withoutSource);

      expect(resultWith.intentConfidence).toBeGreaterThan(resultWithout.intentConfidence);
    });
  });

  // ============================================
  // Rule 3: Long Input
  // ============================================
  describe('long input', () => {
    it('should return CREATE with high confidence for long inputs (>120 chars)', () => {
      const longText = 'a'.repeat(150);
      const input = createInput({
        inputText: longText,
        inputLength: 150,
      });

      const result = computeRouteConfidence(input);

      expect(result.routeHint).toBe('CREATE');
      expect(result.intentConfidence).toBeGreaterThanOrEqual(0.75);
      expect(result.reason).toContain('Long input');
    });

    it('should have slightly lower confidence when active source exists', () => {
      const longText = 'a'.repeat(150);

      const withSource = createInput({
        inputText: longText,
        inputLength: 150,
        hasActiveSource: true,
      });

      const withoutSource = createInput({
        inputText: longText,
        inputLength: 150,
        hasActiveSource: false,
      });

      const resultWith = computeRouteConfidence(withSource);
      const resultWithout = computeRouteConfidence(withoutSource);

      expect(resultWith.intentConfidence).toBeLessThan(resultWithout.intentConfidence);
    });
  });

  // ============================================
  // Rule 4: Ambiguous + Active Source
  // ============================================
  describe('ambiguous with active source', () => {
    it('should return TRANSFORM with medium confidence', () => {
      const input = createInput({
        isAmbiguousTransform: true,
        hasActiveSource: true,
        inputText: 'ngắn hơn',
      });

      const result = computeRouteConfidence(input);

      expect(result.routeHint).toBe('TRANSFORM');
      expect(result.intentConfidence).toBeGreaterThanOrEqual(0.50);
      expect(result.intentConfidence).toBeLessThanOrEqual(0.78);
      expect(result.reason).toContain('Ambiguous instruction with active source');
    });

    it('should boost confidence for action verbs', () => {
      const withVerb = createInput({
        isAmbiguousTransform: true,
        hasActiveSource: true,
        inputText: 'sửa lại hay hơn',
      });

      const withoutVerb = createInput({
        isAmbiguousTransform: true,
        hasActiveSource: true,
        inputText: 'hay hơn',
      });

      const resultWith = computeRouteConfidence(withVerb);
      const resultWithout = computeRouteConfidence(withoutVerb);

      expect(resultWith.intentConfidence).toBeGreaterThan(resultWithout.intentConfidence);
    });
  });

  // ============================================
  // Rule 5: Ambiguous + Last Assistant Only
  // ============================================
  describe('ambiguous with last assistant only', () => {
    it('should return TRANSFORM with lower confidence', () => {
      const input = createInput({
        isAmbiguousTransform: true,
        hasActiveSource: false,
        hasLastValidAssistant: true,
        inputText: 'viết lại',
      });

      const result = computeRouteConfidence(input);

      expect(result.routeHint).toBe('TRANSFORM');
      expect(result.intentConfidence).toBeGreaterThanOrEqual(0.45);
      expect(result.intentConfidence).toBeLessThanOrEqual(0.60);
      expect(result.reason).toContain('conversation context');
    });

    it('should have lower confidence than with active source', () => {
      const withActive = createInput({
        isAmbiguousTransform: true,
        hasActiveSource: true,
        hasLastValidAssistant: true,
      });

      const withoutActive = createInput({
        isAmbiguousTransform: true,
        hasActiveSource: false,
        hasLastValidAssistant: true,
      });

      const resultWith = computeRouteConfidence(withActive);
      const resultWithout = computeRouteConfidence(withoutActive);

      expect(resultWith.intentConfidence).toBeGreaterThan(resultWithout.intentConfidence);
    });
  });

  // ============================================
  // Rule 6: Ambiguous No Context
  // ============================================
  describe('ambiguous without context', () => {
    it('should return CREATE with low confidence', () => {
      const input = createInput({
        isAmbiguousTransform: true,
        hasActiveSource: false,
        hasLastValidAssistant: false,
      });

      const result = computeRouteConfidence(input);

      expect(result.routeHint).toBe('CREATE');
      expect(result.intentConfidence).toBeLessThanOrEqual(0.50);
      expect(result.reason).toContain('without transform context');
    });
  });

  // ============================================
  // Default Case
  // ============================================
  describe('default case', () => {
    it('should return CREATE with low confidence for weak signals', () => {
      const input = createInput({
        inputText: 'hello',
        inputLength: 5,
      });

      const result = computeRouteConfidence(input);

      expect(result.routeHint).toBe('CREATE');
      expect(result.intentConfidence).toBeLessThan(0.60);
      expect(result.reason).toContain('weak signals');
    });

    it('should boost slightly when context exists', () => {
      const withContext = createInput({
        hasLastValidAssistant: true,
      });

      const withoutContext = createInput({
        hasLastValidAssistant: false,
      });

      const resultWith = computeRouteConfidence(withContext);
      const resultWithout = computeRouteConfidence(withoutContext);

      expect(resultWith.intentConfidence).toBeGreaterThan(resultWithout.intentConfidence);
    });
  });
});

// ============================================
// Threshold Helpers
// ============================================
describe('confidence thresholds', () => {
  describe('isHighConfidence', () => {
    it('should return true for confidence >= 0.80', () => {
      expect(isHighConfidence(0.80)).toBe(true);
      expect(isHighConfidence(0.90)).toBe(true);
      expect(isHighConfidence(1.0)).toBe(true);
    });

    it('should return false for confidence < 0.80', () => {
      expect(isHighConfidence(0.79)).toBe(false);
      expect(isHighConfidence(0.50)).toBe(false);
      expect(isHighConfidence(0.0)).toBe(false);
    });
  });

  describe('isLowConfidence', () => {
    it('should return true for confidence < 0.65', () => {
      expect(isLowConfidence(0.64)).toBe(true);
      expect(isLowConfidence(0.50)).toBe(true);
      expect(isLowConfidence(0.0)).toBe(true);
    });

    it('should return false for confidence >= 0.65', () => {
      expect(isLowConfidence(0.65)).toBe(false);
      expect(isLowConfidence(0.80)).toBe(false);
      expect(isLowConfidence(1.0)).toBe(false);
    });
  });
});
