// ============================================
// STEP 8: Intent Transparency & Debug Overlay
// ============================================
// DEV-only observability for intent routing decisions.
// This file contains:
// 1. Debug flag logic (DEV + URL param)
// 2. DebugDecision type for capturing decision context
// 3. Console logging utilities
// 4. DEV warning detection
//
// INVARIANTS:
// - NEVER affects production behavior
// - All debug code should be tree-shaken in prod builds
// - Debug state is purely observability, NEVER used for routing
// ============================================

import type { IntentChoice } from './intentLearning';
import type { ConfidenceResult, ConfidenceInput } from './intentConfidence';

// ============================================
// A. DEBUG FLAG
// ============================================

/**
 * Check if intent debug mode is enabled.
 * Requires:
 * 1. Development mode (NODE_ENV === 'development')
 * 2. URL param ?debugIntent=1 OR ?debugIntent=true
 *
 * This function is safe to call in any environment.
 */
export function isIntentDebugEnabled(): boolean {
  // Must be in development mode
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  // Check for browser environment
  if (typeof window === 'undefined') {
    return false;
  }

  // Check URL param
  try {
    const params = new URLSearchParams(window.location.search);
    const debugParam = params.get('debugIntent');
    return debugParam === '1' || debugParam === 'true';
  } catch {
    return false;
  }
}

// ============================================
// B. DEBUG DECISION TYPE
// ============================================

/**
 * Reason why a particular decision was made
 */
export type DecisionPath =
  | 'EXPLICIT_NEW_CREATE'      // User explicitly requested new content
  | 'EXPLICIT_TRANSFORM_REF'   // User explicitly referenced transform target
  | 'LONG_INPUT'               // Long input (>120 chars) → CREATE
  | 'LEARNED_CHOICE'           // Auto-applied from learning loop
  | 'SESSION_CACHE'            // Reused from session-level cache
  | 'HIGH_CONFIDENCE_AUTO'     // High confidence route (≥0.80)
  | 'USER_CONFIRMED'           // User explicitly confirmed via UI
  | 'DEFAULT_NO_CONFIRM'       // Default path, no confirmation needed
  | 'CONFIRMATION_SHOWN';      // Confirmation UI was shown

/**
 * Debug decision record - captures all context for a routing decision
 */
export interface DebugDecision {
  /** Timestamp when decision was made */
  timestamp: number;

  /** Pattern hash (privacy-safe identifier) */
  patternHash: string;

  /** Input length for observability */
  inputLength: number;

  /** Whether there was an active source selected */
  hasActiveSource: boolean;

  /** Whether there was a previous assistant message */
  hasLastValidAssistant: boolean;

  /** Computed confidence result */
  confidence: {
    routeHint: 'CREATE' | 'TRANSFORM';
    intentConfidence: number;
    reason: string;
  };

  /** Which path led to the decision */
  decisionPath: DecisionPath;

  /** Final choice made (if available) */
  finalChoice?: IntentChoice;

  /** Was auto-apply used from learning loop */
  autoApplied: boolean;

  /** Learned choice count (if available) */
  learnedCount?: number;

  /** Was confirmation UI shown */
  confirmationShown: boolean;

  /** UI source message ID (if any) */
  uiSourceMessageId: string | null;

  /** Warning flags (for suspicious situations) */
  warnings: string[];
}

// ============================================
// C. WARNING DETECTION
// ============================================

/**
 * Detect suspicious situations that warrant DEV warnings
 */
export function detectWarnings(params: {
  inputText: string;
  hasActiveSource: boolean;
  hasLastValidAssistant: boolean;
  confidenceResult: ConfidenceResult;
  autoApplyChoice: IntentChoice | null;
  finalChoice?: IntentChoice;
}): string[] {
  const warnings: string[] = [];
  const {
    inputText,
    hasActiveSource,
    hasLastValidAssistant,
    confidenceResult,
    autoApplyChoice,
    finalChoice,
  } = params;

  // Warning 1: Low confidence with auto-apply
  if (autoApplyChoice && confidenceResult.intentConfidence < 0.65) {
    warnings.push(
      `LOW_CONFIDENCE_AUTO_APPLY: Auto-applied "${autoApplyChoice}" with confidence ${(confidenceResult.intentConfidence * 100).toFixed(0)}%`
    );
  }

  // Warning 2: Route mismatch between confidence hint and final choice
  if (finalChoice) {
    const choiceRoute = finalChoice === 'CREATE_NEW' ? 'CREATE' : 'TRANSFORM';
    if (choiceRoute !== confidenceResult.routeHint && confidenceResult.intentConfidence >= 0.65) {
      warnings.push(
        `ROUTE_MISMATCH: Confidence suggested ${confidenceResult.routeHint} but chose ${choiceRoute}`
      );
    }
  }

  // Warning 3: Transform choice without any source context
  if (finalChoice && finalChoice !== 'CREATE_NEW' && !hasActiveSource && !hasLastValidAssistant) {
    warnings.push(
      `TRANSFORM_NO_CONTEXT: Chose "${finalChoice}" but no source or conversation context`
    );
  }

  // Warning 4: Very short ambiguous input
  if (inputText.length <= 5 && hasActiveSource) {
    warnings.push(
      `SHORT_AMBIGUOUS: Very short input (${inputText.length} chars) with active source`
    );
  }

  // Warning 5: CREATE choice when source is explicitly selected
  if (finalChoice === 'CREATE_NEW' && hasActiveSource) {
    warnings.push(
      `CREATE_WITH_SOURCE: Chose CREATE_NEW but had active source selected`
    );
  }

  return warnings;
}

// ============================================
// D. STRUCTURED CONSOLE LOGGING
// ============================================

/**
 * Log a single structured decision to console (DEV only).
 * Called once per send, summarizes all routing context.
 */
export function logIntentDecision(decision: DebugDecision): void {
  if (!isIntentDebugEnabled()) return;

  const {
    patternHash,
    inputLength,
    hasActiveSource,
    hasLastValidAssistant,
    confidence,
    decisionPath,
    finalChoice,
    autoApplied,
    learnedCount,
    confirmationShown,
    warnings,
  } = decision;

  // Build structured log
  const logData = {
    '🎯 Decision': decisionPath,
    '📊 Confidence': `${(confidence.intentConfidence * 100).toFixed(0)}% → ${confidence.routeHint}`,
    '📝 Reason': confidence.reason,
    '✅ Final': finalChoice || '(pending)',
    '🔄 Auto-applied': autoApplied ? `Yes (${learnedCount}x)` : 'No',
    '❓ Confirmed': confirmationShown ? 'Yes' : 'No',
    '📎 Context': {
      hash: patternHash,
      inputLen: inputLength,
      hasSource: hasActiveSource,
      hasConvo: hasLastValidAssistant,
    },
  };

  // Log with styling
  console.group(
    '%c[Intent Debug]',
    'color: #6366f1; font-weight: bold;',
    decisionPath
  );
  console.table(logData);

  // Log warnings with appropriate styling
  if (warnings.length > 0) {
    console.warn('%c⚠️ Warnings:', 'color: #f59e0b; font-weight: bold;');
    warnings.forEach(w => console.warn(`  • ${w}`));
  }

  console.groupEnd();
}

/**
 * Create a DebugDecision object from routing context
 */
export function createDebugDecision(params: {
  patternHash: string;
  confidenceInput: ConfidenceInput;
  confidenceResult: ConfidenceResult;
  decisionPath: DecisionPath;
  autoApplyChoice: IntentChoice | null;
  learnedCount?: number;
  confirmationShown: boolean;
  uiSourceMessageId: string | null;
  finalChoice?: IntentChoice;
}): DebugDecision {
  const {
    patternHash,
    confidenceInput,
    confidenceResult,
    decisionPath,
    autoApplyChoice,
    learnedCount,
    confirmationShown,
    uiSourceMessageId,
    finalChoice,
  } = params;

  const warnings = detectWarnings({
    inputText: confidenceInput.inputText,
    hasActiveSource: confidenceInput.hasActiveSource,
    hasLastValidAssistant: confidenceInput.hasLastValidAssistant,
    confidenceResult,
    autoApplyChoice,
    finalChoice,
  });

  return {
    timestamp: Date.now(),
    patternHash,
    inputLength: confidenceInput.inputLength,
    hasActiveSource: confidenceInput.hasActiveSource,
    hasLastValidAssistant: confidenceInput.hasLastValidAssistant,
    confidence: {
      routeHint: confidenceResult.routeHint,
      intentConfidence: confidenceResult.intentConfidence,
      reason: confidenceResult.reason,
    },
    decisionPath,
    finalChoice,
    autoApplied: !!autoApplyChoice,
    learnedCount,
    confirmationShown,
    uiSourceMessageId,
    warnings,
  };
}

// ============================================
// E. DEBUG BADGE HELPERS
// ============================================

/**
 * Get a short label for the decision path (for badge display)
 */
export function getDecisionPathLabel(path: DecisionPath): string {
  switch (path) {
    case 'EXPLICIT_NEW_CREATE':
      return 'Explicit Create';
    case 'EXPLICIT_TRANSFORM_REF':
      return 'Explicit Transform';
    case 'LONG_INPUT':
      return 'Long Input';
    case 'LEARNED_CHOICE':
      return 'Learned';
    case 'SESSION_CACHE':
      return 'Cached';
    case 'HIGH_CONFIDENCE_AUTO':
      return 'High Conf.';
    case 'USER_CONFIRMED':
      return 'Confirmed';
    case 'DEFAULT_NO_CONFIRM':
      return 'Default';
    case 'CONFIRMATION_SHOWN':
      return 'Confirming...';
    default:
      return path;
  }
}

/**
 * Get color class for confidence level (for badge styling)
 */
export function getConfidenceColor(confidence: number): {
  bg: string;
  text: string;
  border: string;
} {
  if (confidence >= 0.80) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
    };
  }
  if (confidence >= 0.65) {
    return {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-300',
    };
  }
  return {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
  };
}

/**
 * Get emoji for decision path (for badge display)
 */
export function getDecisionEmoji(path: DecisionPath): string {
  switch (path) {
    case 'EXPLICIT_NEW_CREATE':
      return '✨';
    case 'EXPLICIT_TRANSFORM_REF':
      return '🔄';
    case 'LONG_INPUT':
      return '📝';
    case 'LEARNED_CHOICE':
      return '🧠';
    case 'SESSION_CACHE':
      return '💾';
    case 'HIGH_CONFIDENCE_AUTO':
      return '⚡';
    case 'USER_CONFIRMED':
      return '✅';
    case 'DEFAULT_NO_CONFIRM':
      return '➡️';
    case 'CONFIRMATION_SHOWN':
      return '❓';
    default:
      return '📊';
  }
}
