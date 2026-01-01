// ============================================
// Failure Taxonomy - Diagnostic Classification
// ============================================
// Pure data mapping from reasonCode → diagnostic metadata.
// This file is for OBSERVABILITY ONLY and does NOT affect runtime behavior.
// Do NOT import this into any core decision logic.
// ============================================

import type { AiReasonCode } from './errorMessages';

/**
 * Guard layer where the failure originated.
 */
export type GuardLayer =
  | 'Context Guard'
  | 'Structural Anchor Guard'
  | 'Rewrite Diff Guard'
  | 'Request Binding'
  | 'Input Validation'
  | 'Execution Gate'
  | 'Unknown';

/**
 * Diagnostic metadata for each failure type.
 */
export interface FailureMetadata {
  /** Which guard/layer detected the failure */
  layer: GuardLayer;
  /** Whether retrying the same request might succeed */
  retryable: boolean;
  /** Whether user action can fix the issue */
  userFixable: boolean;
  /** Brief description for debugging */
  debugHint: string;
}

/**
 * Static mapping from reasonCode → diagnostic metadata.
 *
 * IMPORTANT: This is observability data only.
 * Do NOT use this to make runtime decisions.
 */
export const FAILURE_TAXONOMY: Record<AiReasonCode, FailureMetadata> = {
  // ============================================
  // Context Guard Failures
  // ============================================
  REWRITE_NO_CONTEXT: {
    layer: 'Context Guard',
    retryable: false,
    userFixable: true,
    debugHint: 'User requested rewrite but no draft/content is selected. User must select a draft first.',
  },

  // ============================================
  // Structural Anchor Guard Failures
  // ============================================
  REWRITE_ANCHOR_MISMATCH: {
    layer: 'Structural Anchor Guard',
    retryable: true,
    userFixable: false,
    debugHint: 'LLM output has missing/extra/reordered paragraph anchors. Retry may succeed with stricter prompt.',
  },

  // ============================================
  // Rewrite Diff Guard Failures
  // ============================================
  REWRITE_DIFF_EXCEEDED: {
    layer: 'Rewrite Diff Guard',
    retryable: true,
    userFixable: true,
    debugHint: 'LLM changed too much (length, keywords, or added CTA). User can try lighter edit request.',
  },

  // ============================================
  // Request Binding Failures
  // ============================================
  BINDING_MISMATCH: {
    layer: 'Request Binding',
    retryable: false,
    userFixable: false,
    debugHint: 'Hash mismatch between UI request and executor. Possible race condition or stale request.',
  },

  // ============================================
  // Input Validation Failures
  // ============================================
  EMPTY_USER_PROMPT: {
    layer: 'Input Validation',
    retryable: false,
    userFixable: true,
    debugHint: 'User submitted empty prompt. User must enter content before sending.',
  },

  MISSING_SYSTEM: {
    layer: 'Input Validation',
    retryable: false,
    userFixable: false,
    debugHint: 'System message missing from request. Check template configuration.',
  },

  INVALID_META: {
    layer: 'Input Validation',
    retryable: false,
    userFixable: false,
    debugHint: 'Request metadata is malformed. Check request construction logic.',
  },

  // ============================================
  // Execution Gate Failures
  // ============================================
  EDIT_SCOPE_REQUIRED: {
    layer: 'Execution Gate',
    retryable: false,
    userFixable: true,
    debugHint: 'Edit request lacks scope (Hook/Body/CTA). User must specify which section to edit.',
  },

  EXECUTION_BLOCKED: {
    layer: 'Execution Gate',
    retryable: false,
    userFixable: false,
    debugHint: 'Execution blocked by permission check. Verify authorization token and user permissions.',
  },

  // ============================================
  // Unknown/Fallback
  // ============================================
  UNKNOWN: {
    layer: 'Unknown',
    retryable: true,
    userFixable: false,
    debugHint: 'Unclassified failure. Check logs for detailed error information.',
  },
};

/**
 * Get failure metadata for a reason code.
 * Returns UNKNOWN metadata if code is not recognized.
 *
 * @param reasonCode - The failure reason code
 * @returns Diagnostic metadata for the failure
 */
export function getFailureMetadata(reasonCode: string | null | undefined): FailureMetadata {
  if (!reasonCode || !(reasonCode in FAILURE_TAXONOMY)) {
    return FAILURE_TAXONOMY.UNKNOWN;
  }
  return FAILURE_TAXONOMY[reasonCode as AiReasonCode];
}

/**
 * Check if a failure is potentially recoverable via retry.
 *
 * @param reasonCode - The failure reason code
 * @returns true if retry might help
 */
export function isRetryable(reasonCode: string | null | undefined): boolean {
  return getFailureMetadata(reasonCode).retryable;
}

/**
 * Check if user action can resolve the failure.
 *
 * @param reasonCode - The failure reason code
 * @returns true if user can fix the issue
 */
export function isUserFixable(reasonCode: string | null | undefined): boolean {
  return getFailureMetadata(reasonCode).userFixable;
}

/**
 * Format failure classification for DEV logging.
 *
 * @param reasonCode - The failure reason code
 * @returns Formatted object for console logging
 */
export function formatFailureClassification(reasonCode: string | null | undefined): {
  reasonCode: string;
  layer: GuardLayer;
  retryable: boolean;
  userFixable: boolean;
  debugHint: string;
} {
  const metadata = getFailureMetadata(reasonCode);
  return {
    reasonCode: reasonCode || 'UNKNOWN',
    layer: metadata.layer,
    retryable: metadata.retryable,
    userFixable: metadata.userFixable,
    debugHint: metadata.debugHint,
  };
}
