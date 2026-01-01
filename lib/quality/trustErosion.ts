// ============================================
// Trust Erosion Signal Detection
// ============================================
// Detects patterns that indicate Auto Fix is losing user trust.
// Used to trigger backoff and cooldown behavior.
// All metrics are internal only - never exposed to users.

import type { SimilarityResult } from './similarityCheck';

// ============================================
// TYPES
// ============================================

/**
 * Trust erosion signal types
 */
export type TrustSignalType =
  | 'EXCESSIVE_EDIT'       // Similarity too low
  | 'REPEATED_FAILURE'     // Multiple attempts failed
  | 'OSCILLATION'          // User undoes, tries again, undoes again
  | 'QUICK_UNDO'           // User undoes within 2 seconds
  | 'FALLBACK_USED'        // System fell back to original
  | 'CONSECUTIVE_REJECT';  // User kept original multiple times in a row

/**
 * Individual trust signal
 */
export interface TrustSignal {
  type: TrustSignalType;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  details?: Record<string, unknown>;
}

/**
 * Trust state for a session
 */
export interface TrustState {
  signals: TrustSignal[];
  score: number;           // 0-100, starts at 100
  level: TrustLevel;
  cooldownUntil: number | null;  // Timestamp when cooldown ends
}

export type TrustLevel = 'healthy' | 'cautious' | 'critical' | 'frozen';

/**
 * Trust thresholds (locked - do not change)
 */
export const TRUST_THRESHOLDS = {
  // Similarity thresholds
  ACCEPT_MIN: 0.70,        // ≥70% to accept on first attempt
  RETRY_MIN: 0.75,         // ≥75% to accept on retry
  FALLBACK_BELOW: 0.50,    // <50% triggers fallback

  // Trust score thresholds
  HEALTHY_MIN: 80,         // Score ≥80 = healthy
  CAUTIOUS_MIN: 60,        // Score 60-79 = cautious
  CRITICAL_MIN: 40,        // Score 40-59 = critical
  // Score <40 = frozen

  // Signal weights (how much each signal reduces trust score)
  EXCESSIVE_EDIT_PENALTY: 10,
  REPEATED_FAILURE_PENALTY: 15,
  OSCILLATION_PENALTY: 20,
  QUICK_UNDO_PENALTY: 8,
  FALLBACK_PENALTY: 12,
  CONSECUTIVE_REJECT_PENALTY: 5,

  // Cooldown durations (milliseconds)
  CAUTIOUS_COOLDOWN: 30_000,    // 30 seconds
  CRITICAL_COOLDOWN: 120_000,   // 2 minutes
  FROZEN_COOLDOWN: 300_000,     // 5 minutes

  // Recovery
  SIGNAL_DECAY_TIME: 600_000,   // Signals older than 10 minutes decay
  RECOVERY_RATE: 5,             // Points recovered per successful accept
} as const;

// ============================================
// SIGNAL DETECTION
// ============================================

/**
 * Detect excessive edit signal from similarity result
 */
export function detectExcessiveEdit(similarity: SimilarityResult): TrustSignal | null {
  if (similarity.score < TRUST_THRESHOLDS.ACCEPT_MIN) {
    return {
      type: 'EXCESSIVE_EDIT',
      timestamp: Date.now(),
      severity: similarity.score < TRUST_THRESHOLDS.FALLBACK_BELOW ? 'high' : 'medium',
      details: {
        score: similarity.score,
        assessment: similarity.assessment,
      },
    };
  }
  return null;
}

/**
 * Detect repeated failure (multiple attempts without success)
 */
export function detectRepeatedFailure(
  attemptCount: number,
  allFailed: boolean
): TrustSignal | null {
  if (attemptCount >= 2 && allFailed) {
    return {
      type: 'REPEATED_FAILURE',
      timestamp: Date.now(),
      severity: 'high',
      details: { attemptCount },
    };
  }
  return null;
}

/**
 * Detect oscillation (undo → retry → undo pattern)
 */
export function detectOscillation(
  recentActions: Array<{ action: 'apply' | 'undo' | 'keep'; timestamp: number }>
): TrustSignal | null {
  // Look for undo → apply → undo pattern within 60 seconds
  if (recentActions.length < 3) return null;

  const recent = recentActions.slice(-3);
  const isOscillation =
    recent[0].action === 'undo' &&
    recent[1].action === 'apply' &&
    recent[2].action === 'undo';

  const timeSpan = recent[2].timestamp - recent[0].timestamp;

  if (isOscillation && timeSpan < 60_000) {
    return {
      type: 'OSCILLATION',
      timestamp: Date.now(),
      severity: 'high',
      details: { pattern: recent.map(a => a.action).join(' → '), timeSpan },
    };
  }

  return null;
}

/**
 * Detect quick undo (user undoes within 2 seconds)
 */
export function detectQuickUndo(
  applyTimestamp: number,
  undoTimestamp: number
): TrustSignal | null {
  const elapsed = undoTimestamp - applyTimestamp;
  if (elapsed < 2000) {
    return {
      type: 'QUICK_UNDO',
      timestamp: undoTimestamp,
      severity: 'medium',
      details: { elapsed },
    };
  }
  return null;
}

/**
 * Detect fallback usage
 */
export function detectFallbackUsed(usedFallback: boolean): TrustSignal | null {
  if (usedFallback) {
    return {
      type: 'FALLBACK_USED',
      timestamp: Date.now(),
      severity: 'medium',
    };
  }
  return null;
}

/**
 * Detect consecutive rejections (user keeps original multiple times)
 */
export function detectConsecutiveReject(
  recentActions: Array<{ action: 'apply' | 'undo' | 'keep'; timestamp: number }>
): TrustSignal | null {
  // Look for 3+ consecutive "keep" actions
  const recentKeeps = recentActions.slice(-3);
  if (recentKeeps.length >= 3 && recentKeeps.every(a => a.action === 'keep')) {
    return {
      type: 'CONSECUTIVE_REJECT',
      timestamp: Date.now(),
      severity: 'medium',
      details: { count: recentKeeps.length },
    };
  }
  return null;
}

// ============================================
// TRUST STATE MANAGEMENT
// ============================================

/**
 * Create initial trust state
 */
export function createTrustState(): TrustState {
  return {
    signals: [],
    score: 100,
    level: 'healthy',
    cooldownUntil: null,
  };
}

/**
 * Add a signal and recalculate trust state
 */
export function addTrustSignal(state: TrustState, signal: TrustSignal): TrustState {
  const now = Date.now();

  // Add new signal
  const newSignals = [...state.signals, signal];

  // Remove decayed signals (older than 10 minutes)
  const activeSignals = newSignals.filter(
    s => now - s.timestamp < TRUST_THRESHOLDS.SIGNAL_DECAY_TIME
  );

  // Calculate new score
  let newScore = 100;
  for (const s of activeSignals) {
    const penalty = getSignalPenalty(s.type);
    newScore -= penalty;
  }
  newScore = Math.max(0, Math.min(100, newScore));

  // Determine trust level
  const level = getTrustLevel(newScore);

  // Set cooldown if entering cautious/critical/frozen
  let cooldownUntil = state.cooldownUntil;
  if (level !== state.level && level !== 'healthy') {
    cooldownUntil = now + getCooldownDuration(level);
  }

  return {
    signals: activeSignals,
    score: newScore,
    level,
    cooldownUntil,
  };
}

/**
 * Record a successful accept (user kept the suggestion)
 */
export function recordSuccessfulAccept(state: TrustState): TrustState {
  const newScore = Math.min(100, state.score + TRUST_THRESHOLDS.RECOVERY_RATE);
  const level = getTrustLevel(newScore);

  return {
    ...state,
    score: newScore,
    level,
    // Clear cooldown if recovered to healthy
    cooldownUntil: level === 'healthy' ? null : state.cooldownUntil,
  };
}

/**
 * Check if Auto Fix is currently in cooldown
 */
export function isInCooldown(state: TrustState): boolean {
  if (!state.cooldownUntil) return false;
  return Date.now() < state.cooldownUntil;
}

/**
 * Check if Auto Fix should be completely disabled
 */
export function isFrozen(state: TrustState): boolean {
  return state.level === 'frozen';
}

// ============================================
// HELPERS
// ============================================

function getSignalPenalty(type: TrustSignalType): number {
  const penalties: Record<TrustSignalType, number> = {
    EXCESSIVE_EDIT: TRUST_THRESHOLDS.EXCESSIVE_EDIT_PENALTY,
    REPEATED_FAILURE: TRUST_THRESHOLDS.REPEATED_FAILURE_PENALTY,
    OSCILLATION: TRUST_THRESHOLDS.OSCILLATION_PENALTY,
    QUICK_UNDO: TRUST_THRESHOLDS.QUICK_UNDO_PENALTY,
    FALLBACK_USED: TRUST_THRESHOLDS.FALLBACK_PENALTY,
    CONSECUTIVE_REJECT: TRUST_THRESHOLDS.CONSECUTIVE_REJECT_PENALTY,
  };
  return penalties[type];
}

function getTrustLevel(score: number): TrustLevel {
  if (score >= TRUST_THRESHOLDS.HEALTHY_MIN) return 'healthy';
  if (score >= TRUST_THRESHOLDS.CAUTIOUS_MIN) return 'cautious';
  if (score >= TRUST_THRESHOLDS.CRITICAL_MIN) return 'critical';
  return 'frozen';
}

function getCooldownDuration(level: TrustLevel): number {
  switch (level) {
    case 'cautious': return TRUST_THRESHOLDS.CAUTIOUS_COOLDOWN;
    case 'critical': return TRUST_THRESHOLDS.CRITICAL_COOLDOWN;
    case 'frozen': return TRUST_THRESHOLDS.FROZEN_COOLDOWN;
    default: return 0;
  }
}

// ============================================
// CONSOLE LOGGING (INTERNAL ONLY)
// ============================================

/**
 * Log trust state for debugging (console only, never UI)
 */
export function logTrustState(state: TrustState): void {
  console.log('[AutoFix:Trust]', {
    score: state.score,
    level: state.level,
    activeSignals: state.signals.length,
    cooldownRemaining: state.cooldownUntil
      ? Math.max(0, state.cooldownUntil - Date.now())
      : null,
  });
}

/**
 * Log trust signal for debugging (console only, never UI)
 */
export function logTrustSignal(signal: TrustSignal): void {
  console.log('[AutoFix:Trust:Signal]', {
    type: signal.type,
    severity: signal.severity,
    details: signal.details,
  });
}
