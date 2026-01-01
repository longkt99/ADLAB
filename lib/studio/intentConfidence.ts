// ============================================
// STEP 7: Intent Confidence Scoring
// ============================================
// Deterministic heuristics for routing confidence.
// NO LLM calls - pure pattern matching.
//
// This affects ONLY:
// 1) Whether StudioEditor shows confirmation UI
// 2) Whether we can auto-reuse a cached user choice
//
// NEVER affects actual execution routing.
// ============================================

/**
 * Route kind for intent classification
 */
export type RouteKind = 'CREATE' | 'TRANSFORM';

/**
 * Input for confidence computation
 */
export interface ConfidenceInput {
  /** Raw input text from user */
  inputText: string;
  /** Whether there's an active source selected in UI */
  hasActiveSource: boolean;
  /** Whether there's a last valid assistant message in conversation */
  hasLastValidAssistant: boolean;
  /** Whether input explicitly signals new content creation */
  isExplicitNewCreate: boolean;
  /** Whether input explicitly references transform target */
  isExplicitTransformRef: boolean;
  /** Whether input is an ambiguous transform-like instruction */
  isAmbiguousTransform: boolean;
  /** Length of input text */
  inputLength: number;
  /** Optional: classifier type used (for observability) */
  classifierType?: string;
  /** Optional: external classifier confidence (0-1) */
  classifierConfidence?: number;
}

/**
 * Result of confidence computation
 */
export interface ConfidenceResult {
  /** Suggested route based on signals */
  routeHint: RouteKind;
  /** Confidence in the route hint (0-1) */
  intentConfidence: number;
  /** Human-readable reason for the confidence score */
  reason: string;
}

// ============================================
// Confidence Thresholds
// ============================================
const THRESHOLDS = {
  EXPLICIT_CREATE_HIGH: 0.92,
  EXPLICIT_TRANSFORM_HIGH: 0.88,
  LONG_INPUT_HIGH: 0.85,
  AMBIGUOUS_WITH_SOURCE: 0.62,
  AMBIGUOUS_WITH_LAST_ASSISTANT: 0.52,
  AMBIGUOUS_NO_CONTEXT: 0.45,
  DEFAULT_CREATE_LOW: 0.40,
} as const;

// ============================================
// Long input threshold (chars)
// ============================================
const LONG_INPUT_THRESHOLD = 120;

/**
 * Compute route confidence based on deterministic heuristics.
 *
 * Rules (in priority order):
 * 1. Explicit new create signals => CREATE with high confidence (>=0.90)
 * 2. Explicit transform references => TRANSFORM with high confidence (>=0.85)
 * 3. Long input (>120 chars) => CREATE with high confidence (>=0.85) unless explicit transform
 * 4. Ambiguous + active source => TRANSFORM with medium confidence (0.50-0.70)
 * 5. Ambiguous + last assistant only => TRANSFORM with lower confidence (0.45-0.60)
 * 6. Default => CREATE with low confidence (0.35-0.55)
 *
 * @param input - Confidence computation input
 * @returns Route hint, confidence score, and reason
 */
export function computeRouteConfidence(input: ConfidenceInput): ConfidenceResult {
  const {
    inputText,
    hasActiveSource,
    hasLastValidAssistant,
    isExplicitNewCreate,
    isExplicitTransformRef,
    isAmbiguousTransform,
    inputLength,
  } = input;

  // ============================================
  // Rule 1: Explicit new create => CREATE high confidence
  // ============================================
  if (isExplicitNewCreate) {
    return {
      routeHint: 'CREATE',
      intentConfidence: THRESHOLDS.EXPLICIT_CREATE_HIGH,
      reason: 'Explicit new create signal detected',
    };
  }

  // ============================================
  // Rule 2: Explicit transform reference => TRANSFORM high confidence
  // ============================================
  if (isExplicitTransformRef) {
    // Boost slightly if we have an active source
    const boost = hasActiveSource ? 0.04 : 0;
    return {
      routeHint: 'TRANSFORM',
      intentConfidence: Math.min(0.98, THRESHOLDS.EXPLICIT_TRANSFORM_HIGH + boost),
      reason: 'Explicit transform reference detected',
    };
  }

  // ============================================
  // Rule 3: Long input => CREATE high confidence
  // ============================================
  if (inputLength > LONG_INPUT_THRESHOLD) {
    // Long inputs without explicit transform refs are likely new content
    // Slightly lower confidence if there's an active source (user might still want transform)
    const penalty = hasActiveSource ? 0.08 : 0;
    return {
      routeHint: 'CREATE',
      intentConfidence: Math.max(0.75, THRESHOLDS.LONG_INPUT_HIGH - penalty),
      reason: `Long input (${inputLength} chars) suggests new content`,
    };
  }

  // ============================================
  // Rule 4: Ambiguous + active source => TRANSFORM medium confidence
  // ============================================
  if (isAmbiguousTransform && hasActiveSource) {
    // Has explicit UI binding, lean toward transform
    // Confidence varies based on input characteristics
    const wordCount = inputText.trim().split(/\s+/).length;
    const hasActionVerb = /\b(viết|sửa|chỉnh|đổi|thêm|bỏ|fix|edit|change|add|remove)\b/i.test(inputText);

    let confidence = THRESHOLDS.AMBIGUOUS_WITH_SOURCE;

    // Boost for action verbs
    if (hasActionVerb) {
      confidence += 0.08;
    }

    // Slight boost for very short commands (likely transform)
    if (wordCount <= 3) {
      confidence += 0.05;
    }

    return {
      routeHint: 'TRANSFORM',
      intentConfidence: Math.min(0.78, confidence),
      reason: 'Ambiguous instruction with active source',
    };
  }

  // ============================================
  // Rule 5: Ambiguous + last assistant only => TRANSFORM lower confidence
  // ============================================
  if (isAmbiguousTransform && hasLastValidAssistant) {
    // No explicit source, but there's previous content
    // User might want to transform it, but less certain
    return {
      routeHint: 'TRANSFORM',
      intentConfidence: THRESHOLDS.AMBIGUOUS_WITH_LAST_ASSISTANT,
      reason: 'Ambiguous instruction with conversation context',
    };
  }

  // ============================================
  // Rule 6: Ambiguous but no context => CREATE low confidence
  // ============================================
  if (isAmbiguousTransform) {
    return {
      routeHint: 'CREATE',
      intentConfidence: THRESHOLDS.AMBIGUOUS_NO_CONTEXT,
      reason: 'Ambiguous instruction without transform context',
    };
  }

  // ============================================
  // Default: CREATE with low confidence
  // ============================================
  // Input doesn't match any strong signals
  const hasAnyContext = hasActiveSource || hasLastValidAssistant;
  const confidence = hasAnyContext
    ? THRESHOLDS.DEFAULT_CREATE_LOW + 0.10
    : THRESHOLDS.DEFAULT_CREATE_LOW;

  return {
    routeHint: 'CREATE',
    intentConfidence: confidence,
    reason: 'Default routing with weak signals',
  };
}

/**
 * Determine if confidence is high enough to skip confirmation
 * @param confidence - The computed confidence (0-1)
 * @returns true if confirmation can be skipped
 */
export function isHighConfidence(confidence: number): boolean {
  return confidence >= 0.80;
}

/**
 * Determine if confidence is low enough to require confirmation
 * @param confidence - The computed confidence (0-1)
 * @returns true if confirmation should be shown
 */
export function isLowConfidence(confidence: number): boolean {
  return confidence < 0.65;
}
