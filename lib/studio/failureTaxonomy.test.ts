// ============================================
// Failure Taxonomy Tests
// ============================================
// Tests for failure classification diagnostic layer.
// Verifies taxonomy completeness and helper functions.
// ============================================

import { describe, it, expect } from 'vitest';
import {
  FAILURE_TAXONOMY,
  getFailureMetadata,
  isRetryable,
  isUserFixable,
  formatFailureClassification,
  type GuardLayer,
} from './failureTaxonomy';
import type { AiReasonCode } from './errorMessages';

// ============================================
// Test: FAILURE_TAXONOMY completeness
// ============================================

describe('FAILURE_TAXONOMY', () => {
  const allReasonCodes: AiReasonCode[] = [
    'EMPTY_USER_PROMPT',
    'MISSING_SYSTEM',
    'INVALID_META',
    'BINDING_MISMATCH',
    'REWRITE_NO_CONTEXT',
    'REWRITE_ANCHOR_MISMATCH',
    'REWRITE_DIFF_EXCEEDED',
    'EDIT_SCOPE_REQUIRED',
    'EXECUTION_BLOCKED',
    'UNKNOWN',
  ];

  it('should have metadata for all reason codes', () => {
    for (const code of allReasonCodes) {
      expect(FAILURE_TAXONOMY[code]).toBeDefined();
      expect(FAILURE_TAXONOMY[code].layer).toBeTruthy();
      expect(typeof FAILURE_TAXONOMY[code].retryable).toBe('boolean');
      expect(typeof FAILURE_TAXONOMY[code].userFixable).toBe('boolean');
      expect(FAILURE_TAXONOMY[code].debugHint).toBeTruthy();
    }
  });

  it('should have valid guard layers', () => {
    const validLayers: GuardLayer[] = [
      'Context Guard',
      'Structural Anchor Guard',
      'Rewrite Diff Guard',
      'Request Binding',
      'Input Validation',
      'Execution Gate',
      'Unknown',
    ];

    for (const code of allReasonCodes) {
      expect(validLayers).toContain(FAILURE_TAXONOMY[code].layer);
    }
  });
});

// ============================================
// Test: getFailureMetadata
// ============================================

describe('getFailureMetadata', () => {
  it('should return correct metadata for known codes', () => {
    const meta = getFailureMetadata('REWRITE_NO_CONTEXT');
    expect(meta.layer).toBe('Context Guard');
    expect(meta.retryable).toBe(false);
    expect(meta.userFixable).toBe(true);
  });

  it('should return UNKNOWN metadata for null', () => {
    const meta = getFailureMetadata(null);
    expect(meta.layer).toBe('Unknown');
  });

  it('should return UNKNOWN metadata for undefined', () => {
    const meta = getFailureMetadata(undefined);
    expect(meta.layer).toBe('Unknown');
  });

  it('should return UNKNOWN metadata for unknown code', () => {
    const meta = getFailureMetadata('SOME_RANDOM_CODE');
    expect(meta.layer).toBe('Unknown');
  });
});

// ============================================
// Test: isRetryable
// ============================================

describe('isRetryable', () => {
  it('should return true for retryable failures', () => {
    expect(isRetryable('REWRITE_ANCHOR_MISMATCH')).toBe(true);
    expect(isRetryable('REWRITE_DIFF_EXCEEDED')).toBe(true);
    expect(isRetryable('UNKNOWN')).toBe(true);
  });

  it('should return false for non-retryable failures', () => {
    expect(isRetryable('REWRITE_NO_CONTEXT')).toBe(false);
    expect(isRetryable('BINDING_MISMATCH')).toBe(false);
    expect(isRetryable('EMPTY_USER_PROMPT')).toBe(false);
  });
});

// ============================================
// Test: isUserFixable
// ============================================

describe('isUserFixable', () => {
  it('should return true for user-fixable failures', () => {
    expect(isUserFixable('REWRITE_NO_CONTEXT')).toBe(true);
    expect(isUserFixable('EMPTY_USER_PROMPT')).toBe(true);
    expect(isUserFixable('EDIT_SCOPE_REQUIRED')).toBe(true);
    expect(isUserFixable('REWRITE_DIFF_EXCEEDED')).toBe(true);
  });

  it('should return false for non-user-fixable failures', () => {
    expect(isUserFixable('BINDING_MISMATCH')).toBe(false);
    expect(isUserFixable('MISSING_SYSTEM')).toBe(false);
    expect(isUserFixable('EXECUTION_BLOCKED')).toBe(false);
  });
});

// ============================================
// Test: formatFailureClassification
// ============================================

describe('formatFailureClassification', () => {
  it('should format known code correctly', () => {
    const result = formatFailureClassification('REWRITE_DIFF_EXCEEDED');

    expect(result.reasonCode).toBe('REWRITE_DIFF_EXCEEDED');
    expect(result.layer).toBe('Rewrite Diff Guard');
    expect(result.retryable).toBe(true);
    expect(result.userFixable).toBe(true);
    expect(result.debugHint).toContain('LLM changed too much');
  });

  it('should handle null reasonCode', () => {
    const result = formatFailureClassification(null);

    expect(result.reasonCode).toBe('UNKNOWN');
    expect(result.layer).toBe('Unknown');
  });

  it('should handle undefined reasonCode', () => {
    const result = formatFailureClassification(undefined);

    expect(result.reasonCode).toBe('UNKNOWN');
    expect(result.layer).toBe('Unknown');
  });
});

// ============================================
// Test: Layer categorization correctness
// ============================================

describe('Layer Categorization', () => {
  it('Context Guard should contain context-related failures', () => {
    expect(FAILURE_TAXONOMY.REWRITE_NO_CONTEXT.layer).toBe('Context Guard');
  });

  it('Structural Anchor Guard should contain anchor failures', () => {
    expect(FAILURE_TAXONOMY.REWRITE_ANCHOR_MISMATCH.layer).toBe('Structural Anchor Guard');
  });

  it('Rewrite Diff Guard should contain diff failures', () => {
    expect(FAILURE_TAXONOMY.REWRITE_DIFF_EXCEEDED.layer).toBe('Rewrite Diff Guard');
  });

  it('Request Binding should contain binding failures', () => {
    expect(FAILURE_TAXONOMY.BINDING_MISMATCH.layer).toBe('Request Binding');
  });

  it('Input Validation should contain input failures', () => {
    expect(FAILURE_TAXONOMY.EMPTY_USER_PROMPT.layer).toBe('Input Validation');
    expect(FAILURE_TAXONOMY.MISSING_SYSTEM.layer).toBe('Input Validation');
    expect(FAILURE_TAXONOMY.INVALID_META.layer).toBe('Input Validation');
  });

  it('Execution Gate should contain permission failures', () => {
    expect(FAILURE_TAXONOMY.EDIT_SCOPE_REQUIRED.layer).toBe('Execution Gate');
    expect(FAILURE_TAXONOMY.EXECUTION_BLOCKED.layer).toBe('Execution Gate');
  });
});
