// ============================================
// STEP 9: Intent Outcome Validation & Feedback Loop
// ============================================
// Post-execution intelligence: observe what happens AFTER
// a route decision was made (CREATE/TRANSFORM/LOCAL_APPLY).
//
// Key features:
// - Captures outcome signals (undo, edit, resend, accept)
// - Derives severity and negative flags deterministically
// - Integrates with learning loop to improve auto-apply eligibility
//
// INVARIANTS:
// - Local-only: all data in localStorage
// - Privacy-safe: no raw user text stored
// - Non-blocking: never affects routing decisions
// - Observability only: sidecar to main flow
// ============================================

// ============================================
// Types
// ============================================

/**
 * The route that was actually used for this intent
 */
export type RouteUsed = 'CREATE' | 'TRANSFORM' | 'LOCAL_APPLY';

/**
 * Types of outcome signals we track
 */
export type OutcomeSignalType =
  | 'UNDO_WITHIN_WINDOW'    // User pressed undo within 5s toast window
  | 'EDIT_AFTER'            // User edited output shortly after generation
  | 'RESEND_IMMEDIATELY'    // User sent another message within 10s
  | 'ACCEPT_SILENTLY';      // No negative action within 20s = implicit accept

/**
 * A single outcome signal event
 */
export interface OutcomeSignal {
  /** Type of signal */
  type: OutcomeSignalType;
  /** Timestamp when signal occurred */
  ts: number;
  /** Optional metadata */
  meta?: Record<string, string | number | boolean>;
}

/**
 * Derived outcome state (computed deterministically from signals)
 */
export interface DerivedOutcome {
  /** Whether the output was accepted (no high-severity negatives, or explicit accept) */
  accepted: boolean;
  /** Whether there's a negative signal */
  negative: boolean;
  /** Severity of the outcome: low/medium/high */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Complete intent outcome record
 */
export interface IntentOutcome {
  /** Stable ID per send attempt */
  intentId: string;
  /** Pattern hash for learning correlation (privacy-safe, no raw text) */
  patternHash?: string;
  /** Route that was used */
  routeUsed: RouteUsed;
  /** Confidence score from Step 7 (0-1) */
  confidence?: number;
  /** Decision path label from Step 8 (DEV-only passthrough ok) */
  decisionPathLabel?: string;
  /** When this outcome was created */
  createdAt: number;
  /** When last signal was recorded */
  lastEventAt: number;
  /** All signals recorded for this outcome */
  signals: OutcomeSignal[];
  /** Derived state (computed from signals) */
  derived: DerivedOutcome;
}

/**
 * Storage format with version for future migrations
 */
export interface IntentOutcomeStorage {
  version: 1;
  outcome: IntentOutcome;
}

// ============================================
// Constants
// ============================================

/** Time-to-live for outcome records: 30 days */
export const OUTCOME_TTL_DAYS = 30;
export const OUTCOME_TTL_MS = OUTCOME_TTL_DAYS * 24 * 60 * 60 * 1000;

// ============================================
// Factory Functions
// ============================================

/**
 * Generate a stable intent ID for this send attempt
 */
export function generateIntentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `intent-${timestamp}-${random}`;
}

/**
 * Create a new IntentOutcome record
 */
export function createOutcome(params: {
  intentId?: string;
  patternHash?: string;
  routeUsed: RouteUsed;
  confidence?: number;
  decisionPathLabel?: string;
}): IntentOutcome {
  const now = Date.now();
  return {
    intentId: params.intentId || generateIntentId(),
    patternHash: params.patternHash,
    routeUsed: params.routeUsed,
    confidence: params.confidence,
    decisionPathLabel: params.decisionPathLabel,
    createdAt: now,
    lastEventAt: now,
    signals: [],
    derived: {
      accepted: false,
      negative: false,
      severity: 'low',
    },
  };
}

/**
 * Append a signal to an outcome (pure function, returns new outcome)
 */
export function appendSignal(
  outcome: IntentOutcome,
  signal: Omit<OutcomeSignal, 'ts'> & { ts?: number }
): IntentOutcome {
  const signalWithTs: OutcomeSignal = {
    ...signal,
    ts: signal.ts ?? Date.now(),
  };

  return {
    ...outcome,
    lastEventAt: signalWithTs.ts,
    signals: [...outcome.signals, signalWithTs],
  };
}

// ============================================
// Derivation Logic
// ============================================

/**
 * Derive outcome state from signals.
 * Rules:
 * - UNDO_WITHIN_WINDOW => negative=true, severity='high', accepted=false
 * - RESEND_IMMEDIATELY => negative=true, severity='high' (unless also ACCEPT_SILENTLY)
 * - EDIT_AFTER => negative=true, severity='medium' (unless later ACCEPT_SILENTLY)
 * - ACCEPT_SILENTLY => accepted=true, negative=false if no high negatives
 * - If both ACCEPT_SILENTLY and EDIT_AFTER: accepted=true, negative=false, severity='low'
 */
export function deriveOutcome(outcome: IntentOutcome): IntentOutcome {
  const { signals } = outcome;

  // Check for each signal type
  const hasUndo = signals.some(s => s.type === 'UNDO_WITHIN_WINDOW');
  const hasResend = signals.some(s => s.type === 'RESEND_IMMEDIATELY');
  const hasEdit = signals.some(s => s.type === 'EDIT_AFTER');
  const hasAccept = signals.some(s => s.type === 'ACCEPT_SILENTLY');

  let accepted = false;
  let negative = false;
  let severity: 'low' | 'medium' | 'high' = 'low';

  // High severity negatives (always negative, never accepted)
  if (hasUndo) {
    negative = true;
    severity = 'high';
    accepted = false;
  } else if (hasResend && !hasAccept) {
    // Resend is high severity unless user also accepted
    negative = true;
    severity = 'high';
    accepted = false;
  } else if (hasEdit && !hasAccept) {
    // Edit alone is medium severity
    negative = true;
    severity = 'medium';
    accepted = false;
  } else if (hasEdit && hasAccept) {
    // Edit + Accept = user made adjustments but was satisfied overall
    negative = false;
    severity = 'low';
    accepted = true;
  } else if (hasAccept) {
    // Pure accept (including resend + accept case)
    negative = false;
    severity = 'low';
    accepted = true;
  }
  // Default: no signals yet = low severity, not accepted, not negative

  return {
    ...outcome,
    derived: { accepted, negative, severity },
  };
}

/**
 * Check if this outcome indicates the pattern should be marked unreliable
 * Returns true if severity is 'high' and negative is true
 */
export function shouldMarkUnreliable(outcome: IntentOutcome): boolean {
  return outcome.derived.negative && outcome.derived.severity === 'high';
}

// ============================================
// Serialization (for localStorage)
// ============================================

/**
 * Encode an outcome for localStorage storage
 */
export function encodeOutcome(outcome: IntentOutcome): string {
  const storage: IntentOutcomeStorage = {
    version: 1,
    outcome,
  };
  return JSON.stringify(storage);
}

/**
 * Decode an outcome from localStorage string
 * Returns null if invalid or expired
 */
export function decodeOutcome(raw: string): IntentOutcome | null {
  try {
    const parsed: IntentOutcomeStorage = JSON.parse(raw);

    // Validate version
    if (parsed.version !== 1) {
      return null;
    }

    const outcome = parsed.outcome;

    // Check TTL
    if (Date.now() - outcome.createdAt > OUTCOME_TTL_MS) {
      return null;
    }

    return outcome;
  } catch {
    return null;
  }
}

/**
 * Check if an outcome has expired
 */
export function isOutcomeExpired(outcome: IntentOutcome): boolean {
  return Date.now() - outcome.createdAt > OUTCOME_TTL_MS;
}

// ============================================
// Utility Helpers
// ============================================

/**
 * Get a human-readable summary of the outcome (for debugging)
 */
export function getOutcomeSummary(outcome: IntentOutcome): string {
  const { derived, signals, routeUsed } = outcome;
  const signalTypes = signals.map(s => s.type).join(', ') || 'none';

  return `${routeUsed} → ${derived.accepted ? 'ACCEPTED' : 'PENDING'}` +
    ` [${derived.severity}${derived.negative ? '/NEG' : ''}]` +
    ` signals: ${signalTypes}`;
}

/**
 * Convert IntentChoice to RouteUsed
 */
export function choiceToRoute(choice: 'EDIT_IN_PLACE' | 'TRANSFORM_NEW_VERSION' | 'CREATE_NEW'): RouteUsed {
  switch (choice) {
    case 'EDIT_IN_PLACE':
      return 'LOCAL_APPLY';
    case 'TRANSFORM_NEW_VERSION':
      return 'TRANSFORM';
    case 'CREATE_NEW':
      return 'CREATE';
  }
}
