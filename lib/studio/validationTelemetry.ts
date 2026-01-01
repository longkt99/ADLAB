// ============================================
// STEP 26: Validation Telemetry
// ============================================
// Emits normalized telemetry for each Studio execution.
// Used for shadow validation and diagnosing friction.
//
// INVARIANTS:
// - Does NOT change any runtime behavior
// - Does NOT affect what users see or model outputs
// - Production logs contain NO content/PII
// - DEV logs are rich for debugging
// ============================================

import { getFailureMetadata, type GuardLayer } from './failureTaxonomy';

// ============================================
// Types
// ============================================

/**
 * Validation summary emitted for every Studio run.
 */
export interface ValidationSummary {
  // ============================================
  // Required fields (all executions)
  // ============================================

  /** ISO timestamp */
  timestamp: string;

  /** Detected task type */
  taskType: 'QA' | 'EDIT_PATCH' | 'REWRITE_UPGRADE' | 'CREATE' | null;

  /** Whether user had an active draft */
  hasActiveDraft: boolean;

  /** Whether there were previous messages */
  hasPreviousMessages: boolean;

  /** Actual messages array length sent to LLM */
  messagesCountSentToLLM: number;

  /** LLM provider used */
  provider: 'openai' | 'anthropic' | 'mock' | null;

  /** Whether execution succeeded */
  ok: boolean;

  /** Failure reason code (if any) */
  reasonCode: string | null;

  /** Failure classification from taxonomy */
  failureClass: {
    layer: GuardLayer;
    retryable: boolean;
    userFixable: boolean;
  } | null;

  /** Number of retries used (0-2) */
  retryCountUsed: number;

  /** Approximate latency in ms */
  latencyMs: number;

  // ============================================
  // REWRITE_UPGRADE specific (when anchors applied)
  // ============================================

  /** Whether anchors were applied */
  anchorsApplied?: boolean;

  /** Number of anchors injected */
  anchorCount?: number;

  /** Whether anchor validation passed */
  anchorValidationOk?: boolean;

  /** Whether diff guard passed */
  diffGuardOk?: boolean;

  /** Aggregate diff metrics (no content) */
  diffMetrics?: {
    lengthRatioMax: number;
    sentenceReplacementMax: number;
    keywordPreserveMin: number;
    ctaAddedDetected: boolean;
  };

  // ============================================
  // STEP 27: Intent Confirmation (DEV only, additive)
  // ============================================

  /** Intent confirmation telemetry (DEV only) */
  intentConfirmation?: {
    shown: boolean;
    accepted: boolean;
  };
}

/**
 * Input for building a validation summary.
 */
export interface ValidationSummaryInput {
  taskType: ValidationSummary['taskType'];
  hasActiveDraft: boolean;
  hasPreviousMessages: boolean;
  messagesCountSentToLLM: number;
  provider: ValidationSummary['provider'];
  ok: boolean;
  reasonCode?: string | null;
  retryCountUsed: number;
  latencyMs: number;

  // REWRITE_UPGRADE specific
  anchorsApplied?: boolean;
  anchorCount?: number;
  anchorValidationOk?: boolean;
  diffGuardOk?: boolean;
  diffMetrics?: ValidationSummary['diffMetrics'];

  // STEP 27: Intent Confirmation (DEV only)
  intentConfirmation?: ValidationSummary['intentConfirmation'];
}

// ============================================
// Builder
// ============================================

/**
 * Build a validation summary from execution data.
 */
export function buildValidationSummary(input: ValidationSummaryInput): ValidationSummary {
  const failureClass = input.reasonCode
    ? getFailureMetadata(input.reasonCode)
    : null;

  const summary: ValidationSummary = {
    timestamp: new Date().toISOString(),
    taskType: input.taskType,
    hasActiveDraft: input.hasActiveDraft,
    hasPreviousMessages: input.hasPreviousMessages,
    messagesCountSentToLLM: input.messagesCountSentToLLM,
    provider: input.provider,
    ok: input.ok,
    reasonCode: input.reasonCode || null,
    failureClass: failureClass
      ? {
          layer: failureClass.layer,
          retryable: failureClass.retryable,
          userFixable: failureClass.userFixable,
        }
      : null,
    retryCountUsed: input.retryCountUsed,
    latencyMs: input.latencyMs,
  };

  // Add REWRITE_UPGRADE specific fields if provided
  if (input.anchorsApplied !== undefined) {
    summary.anchorsApplied = input.anchorsApplied;
  }
  if (input.anchorCount !== undefined) {
    summary.anchorCount = input.anchorCount;
  }
  if (input.anchorValidationOk !== undefined) {
    summary.anchorValidationOk = input.anchorValidationOk;
  }
  if (input.diffGuardOk !== undefined) {
    summary.diffGuardOk = input.diffGuardOk;
  }
  if (input.diffMetrics !== undefined) {
    summary.diffMetrics = input.diffMetrics;
  }

  // STEP 27: Add intent confirmation (DEV only - not included in PROD logs)
  if (input.intentConfirmation !== undefined) {
    summary.intentConfirmation = input.intentConfirmation;
  }

  return summary;
}

// ============================================
// Emitter
// ============================================

/**
 * Emit validation telemetry.
 * - DEV: Full rich logging
 * - PROD: Minimal safe subset (no content/PII)
 */
export function emitValidationTelemetry(summary: ValidationSummary): void {
  if (process.env.NODE_ENV === 'development') {
    // DEV: Rich logging for debugging
    console.log('[STUDIO_RUN]', summary);
  } else {
    // PROD: Minimal safe subset - no content, no PII
    const safeSummary = {
      taskType: summary.taskType,
      ok: summary.ok,
      reasonCode: summary.reasonCode,
      retryCountUsed: summary.retryCountUsed,
      latencyMs: summary.latencyMs,
      // REWRITE_UPGRADE metrics (aggregate only)
      anchorsApplied: summary.anchorsApplied,
      anchorValidationOk: summary.anchorValidationOk,
      diffGuardOk: summary.diffGuardOk,
    };
    console.info('[STUDIO_RUN]', safeSummary);
  }
}

/**
 * Build and emit validation telemetry in one call.
 */
export function logValidationSummary(input: ValidationSummaryInput): ValidationSummary {
  const summary = buildValidationSummary(input);
  emitValidationTelemetry(summary);
  return summary;
}
