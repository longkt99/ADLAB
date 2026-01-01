// ============================================
// STEP 9: Intent Outcome Store
// ============================================
// localStorage-backed store for intent outcomes.
// Provides TTL-based expiration and resilient error handling.
//
// INVARIANTS:
// - Fails silently if localStorage unavailable
// - Never throws (catch all errors)
// - Privacy-safe: stores only hashes and metadata
// - Non-blocking: fire-and-forget operations
// ============================================

import {
  type IntentOutcome,
  encodeOutcome,
  decodeOutcome,
  isOutcomeExpired,
  deriveOutcome,
  OUTCOME_TTL_MS,
} from './intentOutcome';

// ============================================
// Constants
// ============================================

/** Key prefix for outcome storage */
const STORAGE_PREFIX = 'studio:intentOutcome:v1:';

/** Index key for tracking all outcome IDs */
const INDEX_KEY = 'studio:intentOutcome:index:v1';

/** Maximum outcomes to keep (LRU cleanup) */
const MAX_OUTCOMES = 100;

// ============================================
// Storage Availability
// ============================================

/**
 * Check if localStorage is available
 */
function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__outcome_storage_test__';
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Index Management
// ============================================

interface OutcomeIndex {
  version: 1;
  ids: string[]; // Ordered by createdAt (newest first)
}

/**
 * Load the outcome index
 */
function loadIndex(): string[] {
  if (!isStorageAvailable()) return [];

  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];

    const parsed: OutcomeIndex = JSON.parse(raw);
    if (parsed.version !== 1) return [];

    return parsed.ids;
  } catch {
    return [];
  }
}

/**
 * Save the outcome index
 */
function saveIndex(ids: string[]): void {
  if (!isStorageAvailable()) return;

  try {
    const index: OutcomeIndex = { version: 1, ids };
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Silently fail
  }
}

/**
 * Add ID to index (at front)
 */
function addToIndex(intentId: string): void {
  const ids = loadIndex();
  // Remove if exists (to move to front)
  const filtered = ids.filter(id => id !== intentId);
  // Add to front
  filtered.unshift(intentId);
  // Trim to max
  saveIndex(filtered.slice(0, MAX_OUTCOMES));
}

/**
 * Remove ID from index
 */
function removeFromIndex(intentId: string): void {
  const ids = loadIndex();
  saveIndex(ids.filter(id => id !== intentId));
}

// ============================================
// Core Store Operations
// ============================================

/**
 * Get storage key for an intent ID
 */
function getKey(intentId: string): string {
  return `${STORAGE_PREFIX}${intentId}`;
}

/**
 * Store an outcome
 */
export function put(outcome: IntentOutcome): void {
  if (!isStorageAvailable()) return;

  try {
    const key = getKey(outcome.intentId);
    window.localStorage.setItem(key, encodeOutcome(outcome));
    addToIndex(outcome.intentId);

    if (process.env.NODE_ENV === 'development') {
      console.log('[IntentOutcomeStore] Stored outcome:', outcome.intentId);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[IntentOutcomeStore] Error storing outcome:', error);
    }
  }
}

/**
 * Get an outcome by ID
 * Returns null if not found or expired
 */
export function get(intentId: string): IntentOutcome | null {
  if (!isStorageAvailable()) return null;

  try {
    const key = getKey(intentId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const outcome = decodeOutcome(raw);

    // If expired, clean up
    if (!outcome) {
      window.localStorage.removeItem(key);
      removeFromIndex(intentId);
      return null;
    }

    return outcome;
  } catch {
    return null;
  }
}

/**
 * Update an outcome using an updater function
 * Returns the updated outcome or null if not found
 */
export function update(
  intentId: string,
  updaterFn: (outcome: IntentOutcome) => IntentOutcome
): IntentOutcome | null {
  const existing = get(intentId);
  if (!existing) return null;

  try {
    const updated = updaterFn(existing);
    put(updated);
    return updated;
  } catch {
    return null;
  }
}

/**
 * Update an outcome and re-derive its state
 */
export function updateAndDerive(
  intentId: string,
  updaterFn: (outcome: IntentOutcome) => IntentOutcome
): IntentOutcome | null {
  return update(intentId, outcome => deriveOutcome(updaterFn(outcome)));
}

/**
 * List recent outcomes (newest first)
 * @param limit - Maximum number to return
 */
export function listRecent(limit: number = 10): IntentOutcome[] {
  if (!isStorageAvailable()) return [];

  const ids = loadIndex();
  const results: IntentOutcome[] = [];

  for (const id of ids) {
    if (results.length >= limit) break;

    const outcome = get(id);
    if (outcome) {
      results.push(outcome);
    }
  }

  return results;
}

/**
 * Remove an outcome
 */
export function remove(intentId: string): void {
  if (!isStorageAvailable()) return;

  try {
    const key = getKey(intentId);
    window.localStorage.removeItem(key);
    removeFromIndex(intentId);
  } catch {
    // Silently fail
  }
}

/**
 * Clean up expired outcomes
 * @returns Number of outcomes removed
 */
export function cleanupExpired(): number {
  if (!isStorageAvailable()) return 0;

  const ids = loadIndex();
  let removed = 0;

  for (const id of ids) {
    try {
      const key = getKey(id);
      const raw = window.localStorage.getItem(key);

      if (!raw) {
        removeFromIndex(id);
        removed++;
        continue;
      }

      const outcome = decodeOutcome(raw);
      if (!outcome || isOutcomeExpired(outcome)) {
        window.localStorage.removeItem(key);
        removeFromIndex(id);
        removed++;
      }
    } catch {
      // Continue with next
    }
  }

  if (process.env.NODE_ENV === 'development' && removed > 0) {
    console.log('[IntentOutcomeStore] Cleaned up expired outcomes:', removed);
  }

  return removed;
}

/**
 * Clear all outcomes (for testing)
 */
export function clearAll(): void {
  if (!isStorageAvailable()) return;

  try {
    const ids = loadIndex();
    for (const id of ids) {
      window.localStorage.removeItem(getKey(id));
    }
    window.localStorage.removeItem(INDEX_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Get statistics about stored outcomes
 */
export function getStats(): {
  total: number;
  accepted: number;
  negative: number;
  highSeverity: number;
} {
  const outcomes = listRecent(MAX_OUTCOMES);

  return {
    total: outcomes.length,
    accepted: outcomes.filter(o => o.derived.accepted).length,
    negative: outcomes.filter(o => o.derived.negative).length,
    highSeverity: outcomes.filter(o => o.derived.severity === 'high').length,
  };
}
