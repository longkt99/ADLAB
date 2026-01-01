// ============================================
// Intent Snapshot Utilities
// ============================================
// STEP 3: Observability layer for user intent
//
// This module provides:
// 1. Snapshot creation helpers
// 2. DEV-only guardrail warnings
// 3. Snapshot validation utilities
//
// CRITICAL: This code is OBSERVABILITY ONLY.
// It MUST NOT affect execution logic in any way.
// ============================================

import type { IntentSnapshot, IntentMode, ChatMessage } from '@/types/studio';
// Use relative import for vitest compatibility
import { createIntentSnapshot } from '../../types/studio';

// ============================================
// DEV-ONLY FLAG
// ============================================
const IS_DEV = process.env.NODE_ENV === 'development';

// ============================================
// Guardrail Warning Utilities
// ============================================

/**
 * Warn when userTypedText is empty or missing
 * DEV-ONLY: Never throws, never blocks execution
 */
export function warnIfUserTypedTextMissing(
  userTypedText: string | undefined,
  context: string
): void {
  if (!IS_DEV) return;

  if (!userTypedText || !userTypedText.trim()) {
    console.warn(
      `[IntentSnapshot:GUARDRAIL] userTypedText is empty or missing`,
      { context, userTypedText }
    );
  }
}

/**
 * Warn when no actions detected but not in CREATE mode
 * DEV-ONLY: Never throws, never blocks execution
 */
export function warnIfNoActionsDetected(
  detectedActions: string[],
  detectedMode: IntentMode,
  context: string
): void {
  if (!IS_DEV) return;

  if (detectedActions.length === 0 && detectedMode !== 'CREATE') {
    console.warn(
      `[IntentSnapshot:GUARDRAIL] No actions detected but mode is ${detectedMode}`,
      { context, detectedMode, detectedActions }
    );
  }
}

/**
 * Warn when transform mode changes across chained transforms
 * DEV-ONLY: Never throws, never blocks execution
 */
export function warnIfModeChanged(
  previousSnapshot: IntentSnapshot | undefined,
  currentMode: IntentMode,
  context: string
): void {
  if (!IS_DEV) return;

  if (previousSnapshot && previousSnapshot.detectedMode !== currentMode) {
    // Only warn if both are transform modes (CREATE → TRANSFORM is expected)
    const bothAreTransforms =
      previousSnapshot.detectedMode !== 'CREATE' && currentMode !== 'CREATE';

    if (bothAreTransforms) {
      console.warn(
        `[IntentSnapshot:GUARDRAIL] Transform mode changed in chain`,
        {
          context,
          previousMode: previousSnapshot.detectedMode,
          currentMode,
          previousSnapshotId: previousSnapshot.snapshotId,
        }
      );
    }
  }
}

/**
 * Warn when code attempts to mutate userTypedText
 * DEV-ONLY: Never throws, never blocks execution
 *
 * Call this when userTypedText is about to be set if it already exists
 */
export function warnIfMutatingUserTypedText(
  existingText: string | undefined,
  newText: string,
  context: string
): void {
  if (!IS_DEV) return;

  if (existingText && existingText !== newText) {
    console.warn(
      `[IntentSnapshot:GUARDRAIL] Attempted mutation of userTypedText`,
      {
        context,
        existingText: existingText.substring(0, 50),
        newText: newText.substring(0, 50),
        isChange: existingText !== newText,
      }
    );
  }
}

// ============================================
// Snapshot Creation Helpers
// ============================================

/**
 * Create an IntentSnapshot for a TRANSFORM action
 */
export function createTransformSnapshot(params: {
  userTypedText: string;
  transformMode: 'PURE_TRANSFORM' | 'DIRECTED_TRANSFORM';
  actionType: string;
  sourceMessageId: string;
  turnIndex: number;
  previousSnapshot?: IntentSnapshot;
  // ✅ STEP 7: Intent Confidence (observability only)
  intentConfidence?: number;
  confidenceReason?: string;
}): IntentSnapshot {
  // DEV guardrails
  warnIfUserTypedTextMissing(params.userTypedText, 'createTransformSnapshot');
  warnIfModeChanged(params.previousSnapshot, params.transformMode, 'createTransformSnapshot');

  return createIntentSnapshot({
    userTypedText: params.userTypedText,
    detectedMode: params.transformMode,
    detectedActions: [params.actionType],
    sourceMessageId: params.sourceMessageId,
    turnIndex: params.turnIndex,
    originSnapshotId: params.previousSnapshot?.originSnapshotId ?? params.previousSnapshot?.snapshotId ?? null,
    // ✅ STEP 7: Pass through confidence
    intentConfidence: params.intentConfidence,
    confidenceReason: params.confidenceReason,
  });
}

/**
 * Create an IntentSnapshot for a CREATE action
 */
export function createCreateSnapshot(params: {
  userTypedText: string;
  turnIndex: number;
  // ✅ STEP 7: Intent Confidence (observability only)
  intentConfidence?: number;
  confidenceReason?: string;
}): IntentSnapshot {
  // DEV guardrails
  warnIfUserTypedTextMissing(params.userTypedText, 'createCreateSnapshot');

  return createIntentSnapshot({
    userTypedText: params.userTypedText,
    detectedMode: 'CREATE',
    detectedActions: ['CREATE_CONTENT'],
    sourceMessageId: null,
    turnIndex: params.turnIndex,
    // ✅ STEP 7: Pass through confidence
    intentConfidence: params.intentConfidence,
    confidenceReason: params.confidenceReason,
  });
}

// ============================================
// Snapshot Extraction Helpers
// ============================================

/**
 * Get the IntentSnapshot from a message if it exists
 */
export function getMessageSnapshot(message: ChatMessage): IntentSnapshot | null {
  return message.meta?.intentSnapshot ?? null;
}

/**
 * Check if a message has an IntentSnapshot
 */
export function hasIntentSnapshot(message: ChatMessage): boolean {
  return !!message.meta?.intentSnapshot;
}

/**
 * Get the origin snapshot ID from a message's snapshot chain
 */
export function getOriginSnapshotId(message: ChatMessage): string | null {
  const snapshot = getMessageSnapshot(message);
  if (!snapshot) return null;

  return snapshot.originSnapshotId ?? snapshot.snapshotId;
}

// ============================================
// Snapshot Validation (DEV-ONLY)
// ============================================

/**
 * Validate snapshot integrity
 * DEV-ONLY: Returns validation result, never throws
 */
export function validateSnapshot(snapshot: IntentSnapshot): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!snapshot.userTypedText || !snapshot.userTypedText.trim()) {
    warnings.push('userTypedText is empty');
  }

  if (!snapshot.snapshotId) {
    warnings.push('snapshotId is missing');
  }

  if (snapshot.detectedMode !== 'CREATE' && !snapshot.sourceMessageId) {
    warnings.push('sourceMessageId missing for transform');
  }

  if (snapshot.detectedMode === 'CREATE' && snapshot.sourceMessageId) {
    warnings.push('sourceMessageId should be null for CREATE');
  }

  if (snapshot.turnIndex < 0) {
    warnings.push('turnIndex is negative');
  }

  // ✅ STEP 7: Validate intentConfidence range
  if (snapshot.intentConfidence !== undefined) {
    if (snapshot.intentConfidence < 0 || snapshot.intentConfidence > 1) {
      warnings.push('intentConfidence must be between 0 and 1');
    }
  }

  if (IS_DEV && warnings.length > 0) {
    console.warn('[IntentSnapshot:VALIDATION]', {
      snapshotId: snapshot.snapshotId,
      warnings,
    });
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// ============================================
// Debug Formatting (DEV-ONLY)
// ============================================

/**
 * Format snapshot for debug display
 * Returns null in production to ensure zero overhead
 */
export function formatSnapshotForDebug(snapshot: IntentSnapshot | null): object | null {
  if (!IS_DEV || !snapshot) return null;

  return {
    id: snapshot.snapshotId.substring(0, 20) + '...',
    mode: snapshot.detectedMode,
    actions: snapshot.detectedActions,
    source: snapshot.sourceMessageId?.substring(0, 15) ?? 'none',
    turn: snapshot.turnIndex,
    text: snapshot.userTypedText.length > 50
      ? snapshot.userTypedText.substring(0, 50) + '...'
      : snapshot.userTypedText,
    origin: snapshot.originSnapshotId?.substring(0, 15) ?? 'self',
  };
}
