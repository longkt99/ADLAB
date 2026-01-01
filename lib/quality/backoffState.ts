// ============================================
// Auto Fix Backoff State Machine
// ============================================
// Manages Auto Fix availability based on trust signals.
// Implements: Normal → Cautious → Silent transitions.
// Prevents flapping and ensures graceful degradation.

import {
  type TrustState,
  type TrustSignal,
  createTrustState,
  addTrustSignal,
  recordSuccessfulAccept,
  isInCooldown,
  isFrozen,
  logTrustState,
  logTrustSignal,
  TRUST_THRESHOLDS,
} from './trustErosion';

// ============================================
// TYPES
// ============================================

/**
 * Backoff state machine states
 */
export type BackoffState = 'NORMAL' | 'CAUTIOUS' | 'SILENT';

/**
 * Backoff context (session-level state)
 */
export interface BackoffContext {
  state: BackoffState;
  trust: TrustState;
  recentActions: Array<{
    action: 'apply' | 'undo' | 'keep';
    timestamp: number;
    messageId?: string;
  }>;
  lastApplyTimestamp: number | null;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
}

/**
 * Backoff decision result
 */
export interface BackoffDecision {
  allowed: boolean;
  state: BackoffState;
  reason?: string;
  cooldownRemaining?: number;
}

// ============================================
// STATE MACHINE TRANSITIONS
// ============================================

/**
 * Valid state transitions (anti-flapping)
 *
 * NORMAL → CAUTIOUS: Trust score drops below 80
 * NORMAL → SILENT: Trust score drops below 40 (severe event)
 * CAUTIOUS → NORMAL: 3+ consecutive successes AND trust score ≥ 80
 * CAUTIOUS → SILENT: Trust score drops below 40
 * SILENT → CAUTIOUS: Cooldown expires AND trust score ≥ 40
 * SILENT → NORMAL: Not allowed (must go through CAUTIOUS)
 */
const VALID_TRANSITIONS: Record<BackoffState, BackoffState[]> = {
  NORMAL: ['CAUTIOUS', 'SILENT'],
  CAUTIOUS: ['NORMAL', 'SILENT'],
  SILENT: ['CAUTIOUS'], // Cannot go directly to NORMAL
};

function canTransition(from: BackoffState, to: BackoffState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ============================================
// BACKOFF CONTEXT MANAGEMENT
// ============================================

/**
 * Create initial backoff context
 */
export function createBackoffContext(): BackoffContext {
  return {
    state: 'NORMAL',
    trust: createTrustState(),
    recentActions: [],
    lastApplyTimestamp: null,
    consecutiveSuccesses: 0,
    consecutiveFailures: 0,
  };
}

/**
 * Record an action and update backoff state
 */
export function recordAction(
  context: BackoffContext,
  action: 'apply' | 'undo' | 'keep',
  messageId?: string
): BackoffContext {
  const now = Date.now();

  // Add to recent actions (keep last 10)
  const recentActions = [
    ...context.recentActions.slice(-9),
    { action, timestamp: now, messageId },
  ];

  // Update consecutive counters
  let consecutiveSuccesses = context.consecutiveSuccesses;
  let consecutiveFailures = context.consecutiveFailures;

  if (action === 'apply') {
    consecutiveSuccesses++;
    consecutiveFailures = 0;
  } else if (action === 'undo' || action === 'keep') {
    consecutiveSuccesses = 0;
    consecutiveFailures++;
  }

  // Update last apply timestamp
  const lastApplyTimestamp = action === 'apply' ? now : context.lastApplyTimestamp;

  return {
    ...context,
    recentActions,
    lastApplyTimestamp,
    consecutiveSuccesses,
    consecutiveFailures,
  };
}

/**
 * Add a trust signal and recalculate backoff state
 */
export function addSignal(
  context: BackoffContext,
  signal: TrustSignal
): BackoffContext {
  // Log signal
  logTrustSignal(signal);

  // Update trust state
  const newTrust = addTrustSignal(context.trust, signal);

  // Determine new backoff state based on trust level
  let newState = context.state;

  if (newTrust.level === 'frozen') {
    if (canTransition(context.state, 'SILENT')) {
      newState = 'SILENT';
    }
  } else if (newTrust.level === 'critical' || newTrust.level === 'cautious') {
    if (context.state === 'NORMAL' && canTransition('NORMAL', 'CAUTIOUS')) {
      newState = 'CAUTIOUS';
    }
  }

  // Log state change
  if (newState !== context.state) {
    console.log(`[AutoFix:Backoff] State change: ${context.state} → ${newState}`);
  }

  logTrustState(newTrust);

  return {
    ...context,
    state: newState,
    trust: newTrust,
  };
}

/**
 * Record successful accept and potentially recover
 */
export function recordSuccess(context: BackoffContext): BackoffContext {
  const newTrust = recordSuccessfulAccept(context.trust);

  // Check for recovery conditions
  let newState = context.state;
  const newConsecutiveSuccesses = context.consecutiveSuccesses + 1;

  // CAUTIOUS → NORMAL: 3+ successes AND trust ≥ 80
  if (
    context.state === 'CAUTIOUS' &&
    newConsecutiveSuccesses >= 3 &&
    newTrust.score >= TRUST_THRESHOLDS.HEALTHY_MIN
  ) {
    if (canTransition('CAUTIOUS', 'NORMAL')) {
      newState = 'NORMAL';
      console.log('[AutoFix:Backoff] Recovered to NORMAL after 3 consecutive successes');
    }
  }

  // SILENT → CAUTIOUS: Cooldown expired AND trust ≥ 40
  if (
    context.state === 'SILENT' &&
    !isInCooldown(newTrust) &&
    newTrust.score >= TRUST_THRESHOLDS.CRITICAL_MIN
  ) {
    if (canTransition('SILENT', 'CAUTIOUS')) {
      newState = 'CAUTIOUS';
      console.log('[AutoFix:Backoff] Recovered to CAUTIOUS after cooldown');
    }
  }

  return {
    ...context,
    state: newState,
    trust: newTrust,
    consecutiveSuccesses: newConsecutiveSuccesses,
    consecutiveFailures: 0,
  };
}

// ============================================
// BACKOFF DECISION
// ============================================

/**
 * Check if Auto Fix is allowed to run
 */
export function checkBackoff(context: BackoffContext): BackoffDecision {
  const now = Date.now();

  // SILENT state: Auto Fix is disabled
  if (context.state === 'SILENT') {
    const cooldownRemaining = context.trust.cooldownUntil
      ? Math.max(0, context.trust.cooldownUntil - now)
      : 0;

    return {
      allowed: false,
      state: 'SILENT',
      reason: 'Auto Fix is temporarily unavailable',
      cooldownRemaining,
    };
  }

  // Check cooldown in CAUTIOUS state
  if (context.state === 'CAUTIOUS' && isInCooldown(context.trust)) {
    const cooldownRemaining = context.trust.cooldownUntil
      ? Math.max(0, context.trust.cooldownUntil - now)
      : 0;

    return {
      allowed: false,
      state: 'CAUTIOUS',
      reason: 'Please wait before trying again',
      cooldownRemaining,
    };
  }

  // Check if frozen (trust too low)
  if (isFrozen(context.trust)) {
    return {
      allowed: false,
      state: 'SILENT',
      reason: 'Auto Fix is temporarily unavailable',
    };
  }

  // NORMAL or CAUTIOUS without cooldown: allowed
  return {
    allowed: true,
    state: context.state,
  };
}

/**
 * Get stricter mode for CAUTIOUS state
 * Returns true if prompt should use stricter guardrails
 */
export function shouldUseStrictMode(context: BackoffContext): boolean {
  return context.state === 'CAUTIOUS';
}

// ============================================
// STORAGE HELPERS (Session-level persistence)
// ============================================

const STORAGE_KEY = 'autoFixBackoff';

/**
 * Save backoff context to sessionStorage
 */
export function saveBackoffContext(context: BackoffContext): void {
  if (typeof window === 'undefined') return;

  try {
    // Don't persist signals (they have timestamps that won't make sense later)
    // Only persist the essential state
    const toSave = {
      state: context.state,
      trustScore: context.trust.score,
      trustLevel: context.trust.level,
      cooldownUntil: context.trust.cooldownUntil,
      consecutiveSuccesses: context.consecutiveSuccesses,
      consecutiveFailures: context.consecutiveFailures,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load backoff context from sessionStorage
 */
export function loadBackoffContext(): BackoffContext {
  if (typeof window === 'undefined') return createBackoffContext();

  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return createBackoffContext();

    const parsed = JSON.parse(saved);

    // Reconstruct context from saved state
    return {
      state: parsed.state || 'NORMAL',
      trust: {
        signals: [], // Don't restore old signals
        score: parsed.trustScore || 100,
        level: parsed.trustLevel || 'healthy',
        cooldownUntil: parsed.cooldownUntil || null,
      },
      recentActions: [], // Don't restore old actions
      lastApplyTimestamp: null,
      consecutiveSuccesses: parsed.consecutiveSuccesses || 0,
      consecutiveFailures: parsed.consecutiveFailures || 0,
    };
  } catch {
    return createBackoffContext();
  }
}

/**
 * Clear backoff context (for testing)
 */
export function clearBackoffContext(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// ============================================
// ANTI-FLAPPING LOGIC
// ============================================

/**
 * Minimum time between state transitions (prevents rapid flapping)
 */
const MIN_TRANSITION_INTERVAL = 10_000; // 10 seconds

let lastTransitionTimestamp = 0;

/**
 * Check if a state transition is allowed (anti-flapping)
 */
export function canMakeTransition(): boolean {
  const now = Date.now();
  if (now - lastTransitionTimestamp < MIN_TRANSITION_INTERVAL) {
    return false;
  }
  return true;
}

/**
 * Record a state transition
 */
export function recordTransition(): void {
  lastTransitionTimestamp = Date.now();
}
