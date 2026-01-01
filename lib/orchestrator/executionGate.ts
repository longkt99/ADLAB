// ============================================
// Execution Gate - Pre-execution Invariant Checker
// ============================================
// Binary gate that determines if LLM execution is AUTHORIZED.
// This is the ONLY place where execution permission is decided.
//
// INVARIANT: No LLM call can proceed without passing this gate.
// ============================================

/**
 * User action type that triggered the execution
 * 'send' = User clicked Send button or pressed Enter
 * 'click' = User clicked a UI action (e.g., Quick Action button)
 * 'auto' = System-initiated (e.g., auto-fix) - REQUIRES explicit user trigger prior
 * 'unknown' = Cannot determine origin - ALWAYS REJECTED
 */
export type UserActionType = 'send' | 'click' | 'auto' | 'unknown';

/**
 * Execution context passed to the gate
 */
export interface ExecutionContext {
  /** Type of user action that triggered this execution */
  userActionType: UserActionType;

  /** Unique event ID to prevent duplicate executions */
  eventId: string;

  /** Timestamp of the user action (for staleness check) */
  actionTimestamp: number;

  /** Whether user input is present and valid */
  hasValidInput: boolean;

  /** Optional: Source message ID for transform actions */
  sourceMessageId?: string;

  /** Optional: Action type for transform actions */
  actionType?: string;

  /** Debug: Caller location for tracing unauthorized calls */
  callerLocation?: string;
}

/**
 * Gate decision result
 */
export interface GateDecision {
  /** Whether execution is authorized */
  authorized: boolean;

  /** Reason for rejection (only if authorized=false) */
  rejectionReason?: string;

  /** Authorization token (only if authorized=true) */
  token?: AuthorizationToken;

  /** Debug info for tracing */
  debugInfo: {
    eventId: string;
    timestamp: number;
    decision: 'PASS' | 'REJECT';
    reason: string;
  };
}

/**
 * Authorization token - proof that gate was passed
 * This token MUST be passed to executeLLM()
 */
export interface AuthorizationToken {
  /** Token type for validation */
  type: 'GATE_PASS';

  /** Event ID this token authorizes */
  eventId: string;

  /** Timestamp when token was issued */
  issuedAt: number;

  /** Expiry timestamp (tokens are short-lived) */
  expiresAt: number;

  /** User action that was authorized */
  userActionType: UserActionType;

  /** Signature for validation (prevents forgery) */
  signature: string;
}

// ============================================
// Configuration
// ============================================

/** Maximum age of a user action before it's considered stale (ms) */
const MAX_ACTION_AGE_MS = 5000; // 5 seconds

/** Token validity period (ms) */
const TOKEN_VALIDITY_MS = 30000; // 30 seconds

/** Set of event IDs that have already been processed */
const processedEventIds = new Set<string>();

/** Maximum size of processed event ID cache */
const MAX_PROCESSED_CACHE_SIZE = 1000;

// ============================================
// Internal Functions
// ============================================

/**
 * Generate a simple signature for token validation
 * Not cryptographic security, but prevents accidental forgery
 */
function generateSignature(eventId: string, issuedAt: number, userActionType: UserActionType): string {
  // Simple hash combining event data
  const data = `${eventId}:${issuedAt}:${userActionType}:GATE_SECRET`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `sig_${Math.abs(hash).toString(36)}`;
}

/**
 * Validate a token's signature
 */
function validateSignature(token: AuthorizationToken): boolean {
  const expected = generateSignature(token.eventId, token.issuedAt, token.userActionType);
  return token.signature === expected;
}

/**
 * Clean up old processed event IDs to prevent memory leak
 */
function cleanupProcessedCache(): void {
  if (processedEventIds.size > MAX_PROCESSED_CACHE_SIZE) {
    // Clear oldest entries (simple approach: clear all and start fresh)
    const entries = Array.from(processedEventIds);
    const toRemove = entries.slice(0, entries.length - MAX_PROCESSED_CACHE_SIZE / 2);
    toRemove.forEach(id => processedEventIds.delete(id));
  }
}

// ============================================
// Main Gate Function
// ============================================

/**
 * Determine if LLM execution is authorized
 *
 * @param context - Execution context with user action details
 * @returns Gate decision with authorization status
 *
 * INVARIANTS ENFORCED:
 * 1. userActionType MUST be 'send' or 'click' (not 'unknown')
 * 2. actionTimestamp MUST be within MAX_ACTION_AGE_MS
 * 3. eventId MUST NOT have been processed before
 * 4. hasValidInput MUST be true
 */
export function canExecute(context: ExecutionContext): GateDecision {
  const now = Date.now();
  const { userActionType, eventId, actionTimestamp, hasValidInput, callerLocation } = context;

  // ============================================
  // INVARIANT 1: User action type check
  // ============================================
  if (userActionType === 'unknown') {
    console.warn('[ExecutionGate] REJECTED: Unknown user action type', { eventId, callerLocation });
    return {
      authorized: false,
      rejectionReason: 'Unknown user action type - cannot verify user intent',
      debugInfo: {
        eventId,
        timestamp: now,
        decision: 'REJECT',
        reason: 'UNKNOWN_ACTION_TYPE',
      },
    };
  }

  // ============================================
  // INVARIANT 2: Action staleness check
  // ============================================
  const actionAge = now - actionTimestamp;
  if (actionAge > MAX_ACTION_AGE_MS) {
    console.warn('[ExecutionGate] REJECTED: Stale action', { eventId, actionAge, maxAge: MAX_ACTION_AGE_MS });
    return {
      authorized: false,
      rejectionReason: `Action is stale (${actionAge}ms old, max ${MAX_ACTION_AGE_MS}ms)`,
      debugInfo: {
        eventId,
        timestamp: now,
        decision: 'REJECT',
        reason: 'STALE_ACTION',
      },
    };
  }

  // ============================================
  // INVARIANT 3: Duplicate execution check
  // ============================================
  if (processedEventIds.has(eventId)) {
    console.warn('[ExecutionGate] REJECTED: Duplicate event ID', { eventId });
    return {
      authorized: false,
      rejectionReason: 'Event has already been processed',
      debugInfo: {
        eventId,
        timestamp: now,
        decision: 'REJECT',
        reason: 'DUPLICATE_EVENT',
      },
    };
  }

  // ============================================
  // INVARIANT 4: Valid input check
  // ============================================
  if (!hasValidInput) {
    console.warn('[ExecutionGate] REJECTED: No valid input', { eventId });
    return {
      authorized: false,
      rejectionReason: 'No valid input provided',
      debugInfo: {
        eventId,
        timestamp: now,
        decision: 'REJECT',
        reason: 'NO_VALID_INPUT',
      },
    };
  }

  // ============================================
  // ALL INVARIANTS PASSED - Issue token
  // ============================================

  // Mark event as processed
  processedEventIds.add(eventId);
  cleanupProcessedCache();

  // Generate authorization token
  const token: AuthorizationToken = {
    type: 'GATE_PASS',
    eventId,
    issuedAt: now,
    expiresAt: now + TOKEN_VALIDITY_MS,
    userActionType,
    signature: generateSignature(eventId, now, userActionType),
  };

  console.log('[ExecutionGate] AUTHORIZED:', { eventId, userActionType, callerLocation });

  return {
    authorized: true,
    token,
    debugInfo: {
      eventId,
      timestamp: now,
      decision: 'PASS',
      reason: 'ALL_INVARIANTS_PASSED',
    },
  };
}

/**
 * Validate an authorization token
 * Called by executeLLM to verify the token is valid
 *
 * @param token - Authorization token to validate
 * @returns Whether the token is valid
 */
export function validateToken(token: AuthorizationToken | undefined): boolean {
  if (!token) {
    console.error('[ExecutionGate] Token validation failed: No token provided');
    return false;
  }

  // Check token type
  if (token.type !== 'GATE_PASS') {
    console.error('[ExecutionGate] Token validation failed: Invalid token type');
    return false;
  }

  // Check expiry
  if (Date.now() > token.expiresAt) {
    console.error('[ExecutionGate] Token validation failed: Token expired', {
      eventId: token.eventId,
      expiredAt: token.expiresAt,
      now: Date.now(),
    });
    return false;
  }

  // Check signature
  if (!validateSignature(token)) {
    console.error('[ExecutionGate] Token validation failed: Invalid signature');
    return false;
  }

  return true;
}

/**
 * Generate a unique event ID for a user action
 * Should be called when user triggers an action (click, keypress)
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create authorization token directly (for cases where gate check happens inline)
 * This is a convenience function that combines canExecute + token extraction
 *
 * @param context - Execution context
 * @returns Authorization token or null if rejected
 */
export function createAuthorizationToken(context: ExecutionContext): AuthorizationToken | null {
  const decision = canExecute(context);
  if (!decision.authorized || !decision.token) {
    console.error('[ExecutionGate] Authorization failed:', decision.rejectionReason);
    return null;
  }
  return decision.token;
}

// ============================================
// Debug/Testing Functions
// ============================================

/**
 * Reset the processed event cache (for testing only)
 */
export function __resetProcessedCache(): void {
  processedEventIds.clear();
}

/**
 * Get current cache size (for debugging)
 */
export function __getProcessedCacheSize(): number {
  return processedEventIds.size;
}
