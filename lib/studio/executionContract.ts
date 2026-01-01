// ============================================
// Execution Contract Enforcement
// ============================================
// STEP 5: Intent → Execution Binding
//
// This module enforces that execution MUST be
// consistent with user intent as captured in
// IntentSnapshot.
//
// CRITICAL: This module makes IntentSnapshot an
// EXECUTION CONSTRAINT, not just UX metadata.
// ============================================

import type { IntentSnapshot, ChatMessage } from '@/types/studio';

// ============================================
// DEV-ONLY FLAG
// ============================================
const IS_DEV = process.env.NODE_ENV === 'development';

// ============================================
// Types
// ============================================

/**
 * Result of execution source resolution
 */
export interface ExecutionSourceResult {
  /** The resolved source message ID (null for CREATE) */
  sourceId: string | null;

  /** How the source was resolved */
  resolution: ExecutionResolution;

  /** Whether this source matches intent (if intent exists) */
  matchesIntent: boolean;

  /** Warning message if there's a potential issue */
  warning?: string;
}

/**
 * How the execution source was resolved
 *
 * STEP 6 UPDATE: UI_BINDING is now highest priority.
 * When user selects a message and types a follow-up, that selection is BINDING.
 */
export type ExecutionResolution =
  | 'UI_BINDING'           // ✅ STEP 6: User clicked message + typed follow-up (HIGHEST PRIORITY)
  | 'INTENT_SNAPSHOT'      // Source from IntentSnapshot (for replay/validation)
  | 'UI_SELECTION'         // User explicitly selected in UI (legacy, no typed input)
  | 'CHAIN_MEMORY'         // From lastTransformSourceId (intent memory)
  | 'LAST_ASSISTANT'       // Fallback to last valid assistant message
  | 'NONE';                // No source (CREATE mode)

/**
 * Execution contract validation result
 */
export interface ContractValidation {
  /** Whether the contract is satisfied */
  valid: boolean;

  /** List of contract violations */
  violations: string[];

  /** Whether execution should proceed despite violations */
  canProceed: boolean;
}

// ============================================
// Core Resolution Function
// ============================================

/**
 * Resolve the execution source with STRICT priority order.
 *
 * ✅ STEP 6 UPDATE: UI_BINDING is now HIGHEST priority.
 *
 * PRIORITY ORDER (highest to lowest):
 * 1. uiSourceMessageId (UI_BINDING) - user clicked message + typed follow-up
 * 2. IntentSnapshot.sourceMessageId (for replay/validation)
 * 3. activeSourceId (UI-selected source, legacy)
 * 4. lastTransformSourceId (chain memory)
 * 5. Last valid assistant message (fallback)
 * 6. null (CREATE mode)
 *
 * INVARIANTS:
 * 1. If uiSourceMessageId exists, THAT is the source (BINDING)
 * 2. IntentSnapshot validates but doesn't override UI binding
 * 3. Drift between UI binding and intent triggers warning (DEV only)
 *
 * @param params - Resolution parameters
 * @returns ExecutionSourceResult with resolved source and metadata
 */
export function resolveExecutionSource(params: {
  intentSnapshot?: IntentSnapshot | null;
  uiSourceMessageId?: string | null;   // ✅ STEP 6: UI BINDING (highest priority)
  activeSourceId?: string | null;       // Legacy: UI selection without typed input
  lastTransformSourceId?: string | null;
  messages: ChatMessage[];
  getLastValidAssistantMessage: () => ChatMessage | null;
}): ExecutionSourceResult {
  const {
    intentSnapshot,
    uiSourceMessageId,
    activeSourceId,
    lastTransformSourceId,
    messages,
    getLastValidAssistantMessage,
  } = params;

  // ============================================
  // Priority 1: UI BINDING (STEP 6 - HIGHEST PRIORITY)
  // ============================================
  // When user selects a message and types a follow-up,
  // that selection is BINDING for execution.
  // This takes precedence over everything except CREATE detection.
  if (uiSourceMessageId) {
    const uiBindingSource = messages.find(
      m => m.id === uiSourceMessageId && m.role === 'assistant'
    );

    if (uiBindingSource) {
      // Check if intent differs (for observability)
      const intentDiffers = intentSnapshot?.sourceMessageId &&
        intentSnapshot.sourceMessageId !== uiSourceMessageId;

      if (IS_DEV && intentDiffers) {
        console.log(
          '[ExecutionContract:INFO] UI binding differs from intent snapshot',
          {
            uiBinding: uiSourceMessageId,
            intentSource: intentSnapshot?.sourceMessageId,
          }
        );
      }

      return {
        sourceId: uiSourceMessageId,
        resolution: 'UI_BINDING',
        matchesIntent: !intentSnapshot || intentSnapshot.sourceMessageId === uiSourceMessageId,
        warning: intentDiffers
          ? `UI binding takes precedence over intent source`
          : undefined,
      };
    }

    // UI binding source doesn't exist - warn and fall through
    if (IS_DEV) {
      console.warn(
        '[ExecutionContract:WARNING] UI binding source not found in messages',
        { uiSourceMessageId }
      );
    }
  }

  // ============================================
  // Priority 2: IntentSnapshot (for validation/replay)
  // ============================================
  // If we have an IntentSnapshot with a sourceMessageId,
  // use it (unless UI binding overrode it above).
  if (intentSnapshot && intentSnapshot.sourceMessageId) {
    const sourceExists = messages.some(
      m => m.id === intentSnapshot.sourceMessageId && m.role === 'assistant'
    );

    if (sourceExists) {
      // Check if activeSourceId differs (legacy behavior)
      const uiDiffers = activeSourceId && activeSourceId !== intentSnapshot.sourceMessageId;

      return {
        sourceId: intentSnapshot.sourceMessageId,
        resolution: 'INTENT_SNAPSHOT',
        matchesIntent: true,
        warning: uiDiffers
          ? `UI selection (${activeSourceId}) differs from intent source (${intentSnapshot.sourceMessageId})`
          : undefined,
      };
    }

    // Source in intent doesn't exist anymore - this is a violation
    if (IS_DEV) {
      console.warn(
        '[ExecutionContract:VIOLATION] IntentSnapshot source not found in messages',
        {
          intentSourceId: intentSnapshot.sourceMessageId,
          snapshotId: intentSnapshot.snapshotId,
        }
      );
    }
    // Fall through to next priority, but mark as not matching intent
  }

  // ============================================
  // Priority 3: UI Selection (Legacy - no typed input)
  // ============================================
  if (activeSourceId) {
    const uiSource = messages.find(
      m => m.id === activeSourceId && m.role === 'assistant'
    );

    if (uiSource) {
      const matchesIntent = !intentSnapshot || intentSnapshot.sourceMessageId === activeSourceId;

      return {
        sourceId: activeSourceId,
        resolution: 'UI_SELECTION',
        matchesIntent,
        warning: !matchesIntent && intentSnapshot
          ? `UI selection overrides intent source`
          : undefined,
      };
    }
  }

  // ============================================
  // Priority 3: Chain Memory (GAP A lock)
  // ============================================
  if (lastTransformSourceId) {
    const chainSource = messages.find(
      m => m.id === lastTransformSourceId && m.role === 'assistant'
    );

    if (chainSource) {
      const matchesIntent = !intentSnapshot || intentSnapshot.sourceMessageId === lastTransformSourceId;

      return {
        sourceId: lastTransformSourceId,
        resolution: 'CHAIN_MEMORY',
        matchesIntent,
        warning: !matchesIntent && intentSnapshot
          ? `Chain memory differs from intent source`
          : undefined,
      };
    }
  }

  // ============================================
  // Priority 4: Last Valid Assistant (Fallback)
  // ============================================
  const lastValid = getLastValidAssistantMessage();
  if (lastValid) {
    const matchesIntent = !intentSnapshot || intentSnapshot.sourceMessageId === lastValid.id;

    return {
      sourceId: lastValid.id,
      resolution: 'LAST_ASSISTANT',
      matchesIntent,
      warning: intentSnapshot?.sourceMessageId
        ? `Falling back to last assistant, intent specified ${intentSnapshot.sourceMessageId}`
        : undefined,
    };
  }

  // ============================================
  // Priority 5: No Source (CREATE mode)
  // ============================================
  return {
    sourceId: null,
    resolution: 'NONE',
    matchesIntent: !intentSnapshot || intentSnapshot.detectedMode === 'CREATE',
    warning: intentSnapshot?.sourceMessageId
      ? `No valid source found, but intent specified ${intentSnapshot.sourceMessageId}`
      : undefined,
  };
}

// ============================================
// Contract Validation
// ============================================

/**
 * Validate that execution contract is satisfied.
 *
 * Contract Rules:
 * 1. If intent has sourceMessageId, execution MUST use that source
 * 2. If intent mode is TRANSFORM, a source MUST exist
 * 3. If intent mode is CREATE, source MUST be null
 *
 * @param intentSnapshot - The intent snapshot (if exists)
 * @param resolvedSource - The resolved execution source
 * @returns ContractValidation result
 */
export function validateExecutionContract(
  intentSnapshot: IntentSnapshot | null | undefined,
  resolvedSource: ExecutionSourceResult
): ContractValidation {
  const violations: string[] = [];

  // No intent = no contract to validate
  if (!intentSnapshot) {
    return {
      valid: true,
      violations: [],
      canProceed: true,
    };
  }

  // Rule 1: Source consistency
  if (intentSnapshot.sourceMessageId && intentSnapshot.sourceMessageId !== resolvedSource.sourceId) {
    violations.push(
      `Intent specified source "${intentSnapshot.sourceMessageId}" but execution uses "${resolvedSource.sourceId}"`
    );
  }

  // Rule 2: TRANSFORM requires source
  if (intentSnapshot.detectedMode !== 'CREATE' && !resolvedSource.sourceId) {
    violations.push(
      `Intent mode is ${intentSnapshot.detectedMode} but no execution source resolved`
    );
  }

  // Rule 3: CREATE should not have source
  if (intentSnapshot.detectedMode === 'CREATE' && resolvedSource.sourceId) {
    violations.push(
      `Intent mode is CREATE but execution has source "${resolvedSource.sourceId}"`
    );
  }

  // Log violations in DEV
  if (IS_DEV && violations.length > 0) {
    console.warn('[ExecutionContract:VALIDATION_FAILED]', {
      snapshotId: intentSnapshot.snapshotId,
      violations,
      resolvedSource,
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    // Allow proceeding even with violations (with warning)
    // This maintains backward compatibility while adding visibility
    canProceed: true,
  };
}

// ============================================
// Guardrail Warnings
// ============================================

/**
 * Warn if execution source drifts from intent
 * DEV-ONLY: Never throws, never blocks execution
 *
 * @param intentSnapshot - The intent snapshot
 * @param resolvedSourceId - The resolved execution source ID
 * @param context - Context for debugging
 */
export function warnIfExecutionSourceDrifts(
  intentSnapshot: IntentSnapshot | null | undefined,
  resolvedSourceId: string | null,
  context: string
): void {
  if (!IS_DEV) return;
  if (!intentSnapshot) return;

  // For CREATE, source should be null
  if (intentSnapshot.detectedMode === 'CREATE') {
    if (resolvedSourceId) {
      console.warn(
        `[ExecutionContract:DRIFT] CREATE intent but source resolved`,
        {
          context,
          snapshotId: intentSnapshot.snapshotId,
          resolvedSourceId,
        }
      );
    }
    return;
  }

  // For TRANSFORM, check source match
  if (intentSnapshot.sourceMessageId !== resolvedSourceId) {
    console.warn(
      `[ExecutionContract:DRIFT] Execution source differs from intent`,
      {
        context,
        snapshotId: intentSnapshot.snapshotId,
        intentSource: intentSnapshot.sourceMessageId,
        resolvedSource: resolvedSourceId,
      }
    );
  }
}

/**
 * Warn if intent and execution mode mismatch
 * DEV-ONLY: Never throws, never blocks execution
 */
export function warnIfModeMismatch(
  intentSnapshot: IntentSnapshot | null | undefined,
  isTransformExecution: boolean,
  context: string
): void {
  if (!IS_DEV) return;
  if (!intentSnapshot) return;

  const intentIsTransform = intentSnapshot.detectedMode !== 'CREATE';

  if (intentIsTransform !== isTransformExecution) {
    console.warn(
      `[ExecutionContract:MODE_MISMATCH] Intent and execution mode differ`,
      {
        context,
        intentMode: intentSnapshot.detectedMode,
        executingAsTransform: isTransformExecution,
        snapshotId: intentSnapshot.snapshotId,
      }
    );
  }
}

// ============================================
// Origin Tracking Helpers
// ============================================

/**
 * Get the origin message ID for transform chain tracking.
 *
 * If the source message is itself a transform result,
 * returns its originMessageId to maintain chain to original content.
 *
 * @param sourceId - The direct source message ID
 * @param messages - All messages in conversation
 * @returns The origin message ID (may be same as sourceId)
 */
export function getOriginForChain(
  sourceId: string | null,
  messages: ChatMessage[]
): string | null {
  if (!sourceId) return null;

  const sourceMsg = messages.find(m => m.id === sourceId);
  if (!sourceMsg) return sourceId;

  // If source has an origin, use that
  if (sourceMsg.meta?.originMessageId) {
    return sourceMsg.meta.originMessageId;
  }

  // Otherwise, source IS the origin
  return sourceId;
}

/**
 * Check if a message is part of the same transform chain.
 *
 * @param messageId - The message to check
 * @param originId - The origin of the current chain
 * @param messages - All messages in conversation
 * @returns true if message is in same chain
 */
export function isInSameChain(
  messageId: string,
  originId: string | null,
  messages: ChatMessage[]
): boolean {
  if (!originId) return false;

  const message = messages.find(m => m.id === messageId);
  if (!message) return false;

  // Direct origin match
  if (message.id === originId) return true;

  // Check if message's origin matches
  const msgOrigin = message.meta?.originMessageId;
  if (msgOrigin === originId) return true;

  return false;
}

// ============================================
// Execution Context Builder
// ============================================

/**
 * Build execution context with all resolved values.
 * Use this to ensure consistent resolution across the execution pipeline.
 */
export function buildExecutionContext(params: {
  intentSnapshot?: IntentSnapshot | null;
  activeSourceId?: string | null;
  lastTransformSourceId?: string | null;
  messages: ChatMessage[];
  getLastValidAssistantMessage: () => ChatMessage | null;
}): {
  resolvedSource: ExecutionSourceResult;
  contract: ContractValidation;
  originId: string | null;
} {
  const resolvedSource = resolveExecutionSource(params);
  const contract = validateExecutionContract(params.intentSnapshot, resolvedSource);
  const originId = getOriginForChain(resolvedSource.sourceId, params.messages);

  // DEV logging
  if (IS_DEV) {
    console.log('[ExecutionContract:CONTEXT]', {
      resolution: resolvedSource.resolution,
      sourceId: resolvedSource.sourceId,
      matchesIntent: resolvedSource.matchesIntent,
      contractValid: contract.valid,
      originId,
    });
  }

  return {
    resolvedSource,
    contract,
    originId,
  };
}
