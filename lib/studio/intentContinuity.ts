// ============================================
// STEP 11: Intent Memory & Conversational Continuity
// ============================================
// Tracks conversation flow patterns to understand HOW users work
// across multiple turns, enabling smarter confirmation decisions.
//
// INVARIANTS:
// - Read-only for routing: NEVER affects execution decisions
// - Privacy-safe: only uses patternHash and aggregates
// - Local-only: all data from session state (no persistence)
// - Observability: for UX hints and debug only
// ============================================

// IntentOutcome type imported but used only in function signatures that may be called externally

// ============================================
// Configuration (tuneable constants)
// ============================================

/** Window size for detecting conversation patterns */
const PATTERN_WINDOW_SIZE = 5;

/** Minimum consecutive same-type intents for flow detection */
const MIN_CONSECUTIVE_FOR_FLOW = 2;

/** Time window for "immediate" actions (ms) */
const IMMEDIATE_ACTION_WINDOW_MS = 30_000; // 30 seconds

/** Max history items to retain in memory */
const MAX_HISTORY_SIZE = 20;

// ============================================
// Types
// ============================================

export type ConversationMode =
  | 'CREATE_FLOW'      // User is creating new content
  | 'REFINE_FLOW'      // User is iteratively refining existing content
  | 'EXPLORATION_FLOW' // User is exploring/experimenting with mixed intents
  | 'CORRECTION_FLOW'  // User is correcting/undoing recent actions
  | 'UNKNOWN';         // Not enough data to determine

export type IntentType = 'CREATE' | 'TRANSFORM' | 'EDIT_IN_PLACE';

export interface IntentHistoryItem {
  /** Timestamp when this intent was processed */
  timestamp: number;
  /** The intent type */
  intentType: IntentType;
  /** Pattern hash for this intent */
  patternHash: string;
  /** The user's choice (if any) */
  choice?: 'CREATE_NEW' | 'TRANSFORM_NEW_VERSION' | 'EDIT_IN_PLACE';
  /** Whether an undo signal was detected after this */
  hadUndoSignal?: boolean;
  /** Route hint from confidence computation */
  routeHint?: 'CREATE' | 'TRANSFORM';
}

export interface ContinuityState {
  /** Current detected conversation mode */
  mode: ConversationMode;
  /** Confidence in the mode detection (0-1) */
  modeConfidence: number;
  /** Count of consecutive same-type intents */
  consecutiveCount: number;
  /** The dominant intent type in current flow */
  dominantType: IntentType | null;
  /** Recent intent history (most recent first) */
  history: IntentHistoryItem[];
  /** Whether user appears to be in a correction cycle */
  inCorrectionCycle: boolean;
  /** Short human-readable reason */
  reason: string;
}

export interface ContinuityContext {
  /** Current stability band */
  stabilityBand: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Current route hint */
  routeHint: 'CREATE' | 'TRANSFORM';
  /** Whether there was a recent undo */
  recentUndo: boolean;
  /** The continuity state */
  continuity: ContinuityState;
}

// ============================================
// Intent History Management
// ============================================

/**
 * Create an empty continuity state
 */
export function createInitialContinuityState(): ContinuityState {
  return {
    mode: 'UNKNOWN',
    modeConfidence: 0,
    consecutiveCount: 0,
    dominantType: null,
    history: [],
    inCorrectionCycle: false,
    reason: 'No history yet',
  };
}

/**
 * Add an intent to the history
 */
export function addIntentToHistory(
  state: ContinuityState,
  item: Omit<IntentHistoryItem, 'timestamp'>
): ContinuityState {
  const newItem: IntentHistoryItem = {
    ...item,
    timestamp: Date.now(),
  };

  // Add to front, trim to max size
  const newHistory = [newItem, ...state.history].slice(0, MAX_HISTORY_SIZE);

  return {
    ...state,
    history: newHistory,
  };
}

/**
 * Mark the most recent intent as having an undo signal
 */
export function markRecentUndo(state: ContinuityState): ContinuityState {
  if (state.history.length === 0) return state;

  const [first, ...rest] = state.history;
  return {
    ...state,
    history: [{ ...first, hadUndoSignal: true }, ...rest],
    inCorrectionCycle: true,
  };
}

// ============================================
// Conversation Mode Detection
// ============================================

/**
 * Count consecutive intents of the same type from the start of history
 */
function countConsecutive(history: IntentHistoryItem[]): {
  count: number;
  type: IntentType | null;
} {
  if (history.length === 0) {
    return { count: 0, type: null };
  }

  const firstType = history[0].intentType;
  let count = 1;

  for (let i = 1; i < history.length; i++) {
    if (history[i].intentType === firstType) {
      count++;
    } else {
      break;
    }
  }

  return { count, type: firstType };
}

/**
 * Check if recent history suggests a correction cycle
 */
function detectCorrectionCycle(history: IntentHistoryItem[]): boolean {
  if (history.length < 2) return false;

  // Check for recent undo signals
  const recentItems = history.slice(0, 3);
  const hasRecentUndo = recentItems.some(item => item.hadUndoSignal);

  if (hasRecentUndo) return true;

  // Check for rapid back-and-forth (CREATE → TRANSFORM → CREATE within short window)
  if (history.length >= 3) {
    const [a, b, c] = history.slice(0, 3);
    const timeSpan = a.timestamp - c.timestamp;

    if (timeSpan < IMMEDIATE_ACTION_WINDOW_MS * 2) {
      // Quick alternation suggests correction
      if (a.intentType !== b.intentType && b.intentType !== c.intentType) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Analyze intent distribution in recent history
 */
function analyzeIntentDistribution(history: IntentHistoryItem[]): {
  createCount: number;
  transformCount: number;
  editInPlaceCount: number;
  total: number;
} {
  const window = history.slice(0, PATTERN_WINDOW_SIZE);

  let createCount = 0;
  let transformCount = 0;
  let editInPlaceCount = 0;

  for (const item of window) {
    switch (item.intentType) {
      case 'CREATE':
        createCount++;
        break;
      case 'TRANSFORM':
        transformCount++;
        break;
      case 'EDIT_IN_PLACE':
        editInPlaceCount++;
        break;
    }
  }

  return {
    createCount,
    transformCount,
    editInPlaceCount,
    total: window.length,
  };
}

/**
 * Detect the current conversation mode from intent history.
 *
 * Rules:
 * - Undo signals → CORRECTION_FLOW
 * - 2+ consecutive TRANSFORM intents → REFINE_FLOW
 * - EDIT_IN_PLACE + TRANSFORM → REFINE_FLOW
 * - 2+ consecutive CREATE intents → CREATE_FLOW
 * - Mixed CREATE + TRANSFORM → EXPLORATION_FLOW
 * - Not enough data → UNKNOWN
 */
export function detectConversationMode(history: IntentHistoryItem[]): {
  mode: ConversationMode;
  confidence: number;
  reason: string;
} {
  if (history.length === 0) {
    return {
      mode: 'UNKNOWN',
      confidence: 0,
      reason: 'No history yet',
    };
  }

  // Check for correction cycle first (highest priority)
  if (detectCorrectionCycle(history)) {
    return {
      mode: 'CORRECTION_FLOW',
      confidence: 0.9,
      reason: 'Recent undo or rapid alternation detected',
    };
  }

  // Analyze consecutive pattern
  const { count: consecutiveCount, type: dominantType } = countConsecutive(history);
  const distribution = analyzeIntentDistribution(history);

  // Check for REFINE_FLOW
  if (dominantType === 'TRANSFORM' && consecutiveCount >= MIN_CONSECUTIVE_FOR_FLOW) {
    return {
      mode: 'REFINE_FLOW',
      confidence: Math.min(0.5 + consecutiveCount * 0.15, 0.95),
      reason: `${consecutiveCount} consecutive TRANSFORM intents`,
    };
  }

  // EDIT_IN_PLACE followed by TRANSFORM suggests refinement
  if (dominantType === 'EDIT_IN_PLACE' && history.length >= 2) {
    const hasTransformAfter = history.slice(0, 2).some(h => h.intentType === 'TRANSFORM');
    if (hasTransformAfter) {
      return {
        mode: 'REFINE_FLOW',
        confidence: 0.7,
        reason: 'EDIT_IN_PLACE + TRANSFORM pattern',
      };
    }
  }

  // Check for CREATE_FLOW
  if (dominantType === 'CREATE' && consecutiveCount >= MIN_CONSECUTIVE_FOR_FLOW) {
    return {
      mode: 'CREATE_FLOW',
      confidence: Math.min(0.5 + consecutiveCount * 0.15, 0.95),
      reason: `${consecutiveCount} consecutive CREATE intents`,
    };
  }

  // Check for EXPLORATION_FLOW (mixed patterns)
  if (distribution.total >= 3) {
    const hasCreate = distribution.createCount > 0;
    const hasTransform = distribution.transformCount > 0 || distribution.editInPlaceCount > 0;

    if (hasCreate && hasTransform) {
      return {
        mode: 'EXPLORATION_FLOW',
        confidence: 0.6,
        reason: 'Mixed CREATE and TRANSFORM intents',
      };
    }
  }

  // Not enough data to determine
  if (history.length < MIN_CONSECUTIVE_FOR_FLOW) {
    return {
      mode: 'UNKNOWN',
      confidence: 0.3,
      reason: 'Insufficient history',
    };
  }

  // Default to exploration if we have data but no clear pattern
  return {
    mode: 'EXPLORATION_FLOW',
    confidence: 0.4,
    reason: 'No clear pattern detected',
  };
}

// ============================================
// Continuity State Updates
// ============================================

/**
 * Update continuity state with a new intent
 */
export function updateContinuityState(
  previous: ContinuityState,
  newIntent: Omit<IntentHistoryItem, 'timestamp'>
): ContinuityState {
  // Add the new intent to history
  const withNewHistory = addIntentToHistory(previous, newIntent);

  // Detect the new mode
  const { mode, confidence, reason } = detectConversationMode(withNewHistory.history);

  // Count consecutive
  const { count: consecutiveCount, type: dominantType } = countConsecutive(withNewHistory.history);

  // Check correction cycle
  const inCorrectionCycle = mode === 'CORRECTION_FLOW' || detectCorrectionCycle(withNewHistory.history);

  return {
    ...withNewHistory,
    mode,
    modeConfidence: confidence,
    consecutiveCount,
    dominantType,
    inCorrectionCycle,
    reason,
  };
}

// ============================================
// Confirmation Skip Logic
// ============================================

export interface SkipConfirmationParams {
  /** Current continuity state */
  continuity: ContinuityState;
  /** Current stability band */
  stabilityBand: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Current route hint from confidence */
  routeHint: 'CREATE' | 'TRANSFORM';
  /** Whether auto-apply is eligible (from stability) */
  autoApplyEligible: boolean;
}

/**
 * Determine if confirmation can be skipped based on conversational context.
 * This is UI-only gating - routing remains unchanged.
 *
 * Rules:
 * - CORRECTION_FLOW: NEVER skip (user is correcting, needs control)
 * - REFINE_FLOW + TRANSFORM hint + stability HIGH/MEDIUM: can skip
 * - CREATE_FLOW + CREATE hint + stability HIGH: can skip
 * - EXPLORATION_FLOW: NEVER skip (user is experimenting)
 * - UNKNOWN: NEVER skip (not enough data)
 *
 * @returns 'SKIP' | 'SHOW' | 'DEFAULT'
 */
export function shouldSkipConfirmationByContext(
  params: SkipConfirmationParams
): 'SKIP' | 'SHOW' | 'DEFAULT' {
  const { continuity, stabilityBand, routeHint, autoApplyEligible } = params;

  // CORRECTION_FLOW: Always show confirmation
  if (continuity.mode === 'CORRECTION_FLOW' || continuity.inCorrectionCycle) {
    return 'SHOW';
  }

  // EXPLORATION_FLOW or UNKNOWN: Use default behavior
  if (continuity.mode === 'EXPLORATION_FLOW' || continuity.mode === 'UNKNOWN') {
    return 'DEFAULT';
  }

  // REFINE_FLOW: Can skip if conditions met
  if (continuity.mode === 'REFINE_FLOW') {
    // Must be TRANSFORM hint to match the flow
    if (routeHint !== 'TRANSFORM') {
      return 'DEFAULT';
    }

    // Need at least MEDIUM stability
    if (stabilityBand === 'LOW') {
      return 'DEFAULT';
    }

    // HIGH stability + high confidence in mode = skip
    if (stabilityBand === 'HIGH' && continuity.modeConfidence >= 0.7) {
      return 'SKIP';
    }

    // MEDIUM stability + very high confidence + auto-apply eligible = skip
    if (stabilityBand === 'MEDIUM' && continuity.modeConfidence >= 0.8 && autoApplyEligible) {
      return 'SKIP';
    }

    return 'DEFAULT';
  }

  // CREATE_FLOW: Can skip if conditions met
  if (continuity.mode === 'CREATE_FLOW') {
    // Must be CREATE hint to match the flow
    if (routeHint !== 'CREATE') {
      return 'DEFAULT';
    }

    // Need HIGH stability for create (more conservative)
    if (stabilityBand !== 'HIGH') {
      return 'DEFAULT';
    }

    // HIGH stability + high confidence = skip
    if (continuity.modeConfidence >= 0.7) {
      return 'SKIP';
    }

    return 'DEFAULT';
  }

  return 'DEFAULT';
}

// ============================================
// Debug Helpers
// ============================================

/**
 * Get a compact debug summary of continuity state
 */
export function getContinuityDebugSummary(state: ContinuityState): string {
  const modeShort = state.mode.replace('_FLOW', '').slice(0, 6);
  const confPct = Math.round(state.modeConfidence * 100);
  const correction = state.inCorrectionCycle ? ' ⚠️CORR' : '';

  return `${modeShort} ${confPct}% | ${state.consecutiveCount}x ${state.dominantType ?? '?'} | h=${state.history.length}${correction}`;
}

/**
 * Get mode display label
 */
export function getModeLabel(mode: ConversationMode): string {
  switch (mode) {
    case 'CREATE_FLOW':
      return 'Creating';
    case 'REFINE_FLOW':
      return 'Refining';
    case 'EXPLORATION_FLOW':
      return 'Exploring';
    case 'CORRECTION_FLOW':
      return 'Correcting';
    case 'UNKNOWN':
      return 'Learning';
  }
}

/**
 * Get mode emoji
 */
export function getModeEmoji(mode: ConversationMode): string {
  switch (mode) {
    case 'CREATE_FLOW':
      return '✨';
    case 'REFINE_FLOW':
      return '🔄';
    case 'EXPLORATION_FLOW':
      return '🔍';
    case 'CORRECTION_FLOW':
      return '⏪';
    case 'UNKNOWN':
      return '❓';
  }
}

/**
 * Get color classes for mode (for debug display)
 */
export function getModeColorClasses(mode: ConversationMode): {
  bg: string;
  text: string;
  border: string;
} {
  switch (mode) {
    case 'CREATE_FLOW':
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-300 dark:border-blue-700',
      };
    case 'REFINE_FLOW':
      return {
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-300 dark:border-purple-700',
      };
    case 'EXPLORATION_FLOW':
      return {
        bg: 'bg-cyan-100 dark:bg-cyan-900/30',
        text: 'text-cyan-700 dark:text-cyan-300',
        border: 'border-cyan-300 dark:border-cyan-700',
      };
    case 'CORRECTION_FLOW':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-300 dark:border-amber-700',
      };
    case 'UNKNOWN':
      return {
        bg: 'bg-slate-100 dark:bg-slate-900/30',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-300 dark:border-slate-700',
      };
  }
}
