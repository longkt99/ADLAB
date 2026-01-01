// ============================================
// STEP 7 + STEP 14: Intent Learning Loop
// ============================================
// Local-only learning from user choices.
// Stores pattern hashes + counters, NEVER raw text.
// Privacy-safe: all data stays in localStorage.
//
// Goal: Reduce unnecessary confirmations over time
// by remembering what the user chose for similar situations.
//
// STEP 14: USER ISOLATION
// - When governance is active, learning data is scoped per-user
// - Uses user-scoped storage keys to prevent cross-user learning
// - No cross-user learning or data leakage
// ============================================

import {
  isGovernanceActive,
  getUserScopedKey,
} from './intentGovernance';

/**
 * Intent choice types (matches StudioEditor)
 */
export type IntentChoice = 'EDIT_IN_PLACE' | 'TRANSFORM_NEW_VERSION' | 'CREATE_NEW';

/**
 * Learned choice record
 */
export interface LearnedChoice {
  /** Hash of the pattern (NOT raw text) */
  patternHash: string;
  /** User's choice for this pattern */
  choice: IntentChoice;
  /** Number of times this choice was made */
  count: number;
  /** Number of negative signals (e.g., undo after choice) */
  negativeCount: number;
  /** Timestamp when last used */
  lastUsedAt: number;
}

/**
 * Storage format
 */
interface LearnedChoicesStorage {
  version: 1;
  choices: Record<string, LearnedChoice>;
}

// ============================================
// Configuration
// ============================================
const BASE_STORAGE_KEY = 'studio_intent_learning_v1';
const AUTO_APPLY_THRESHOLD = 2; // Require 2+ consistent choices
const NEGATIVE_THRESHOLD = 2;   // 2 negative signals = unreliable
const TTL_DAYS = 30;            // Expire after 30 days of no use
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Get the storage key for learning data.
 * When governance is active, returns a user-scoped key.
 * Otherwise, returns the base key.
 */
function getStorageKey(): string {
  if (isGovernanceActive()) {
    return getUserScopedKey(BASE_STORAGE_KEY);
  }
  return BASE_STORAGE_KEY;
}

// ============================================
// Simple Hash Function
// ============================================
// DJB2 hash - fast and stable for our use case
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to positive hex string
  return (hash >>> 0).toString(16);
}

/**
 * Compute a stable pattern hash from context.
 * Does NOT include raw instruction text in storage.
 *
 * @param params - Pattern parameters
 * @returns Stable hash string
 */
export function computePatternHash(params: {
  normalizedInstruction: string;
  hasActiveSource: boolean;
  hasLastValidAssistant: boolean;
  uiSourceMessageId?: string | null;
}): string {
  const {
    normalizedInstruction,
    hasActiveSource,
    hasLastValidAssistant,
    uiSourceMessageId,
  } = params;

  // Normalize instruction: lowercase, trim, first 50 chars only
  const normalizedText = normalizedInstruction
    .toLowerCase()
    .normalize('NFC')
    .trim()
    .substring(0, 50);

  // Build pattern string (not stored, only hashed)
  const pattern = [
    normalizedText,
    hasActiveSource ? 'src:1' : 'src:0',
    hasLastValidAssistant ? 'ctx:1' : 'ctx:0',
    uiSourceMessageId ? 'ui:1' : 'ui:0',
  ].join('|');

  return djb2Hash(pattern);
}

/**
 * Check if localStorage is available
 */
function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load learned choices from localStorage
 * Uses user-scoped key when governance is active (STEP 14)
 * @returns Map of pattern hash to learned choice
 */
export function loadLearnedChoices(): Record<string, LearnedChoice> {
  if (!isStorageAvailable()) return {};

  try {
    const storageKey = getStorageKey();
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};

    const parsed: LearnedChoicesStorage = JSON.parse(raw);

    // Validate version
    if (parsed.version !== 1) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[IntentLearning] Invalid storage version, clearing');
      }
      window.localStorage.removeItem(storageKey);
      return {};
    }

    // Filter expired entries
    const now = Date.now();
    const valid: Record<string, LearnedChoice> = {};

    for (const [hash, choice] of Object.entries(parsed.choices)) {
      if (now - choice.lastUsedAt < TTL_MS) {
        valid[hash] = choice;
      }
    }

    // If we filtered anything, save back
    if (Object.keys(valid).length < Object.keys(parsed.choices).length) {
      saveLearnedChoices(valid);
    }

    return valid;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[IntentLearning] Error loading choices:', error);
    }
    return {};
  }
}

/**
 * Save learned choices to localStorage
 * Uses user-scoped key when governance is active (STEP 14)
 * @param choices - Map of pattern hash to learned choice
 */
export function saveLearnedChoices(choices: Record<string, LearnedChoice>): void {
  if (!isStorageAvailable()) return;

  try {
    const storageKey = getStorageKey();
    const storage: LearnedChoicesStorage = {
      version: 1,
      choices,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(storage));
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[IntentLearning] Error saving choices:', error);
    }
  }
}

/**
 * Record a user's choice for a pattern
 * @param hash - Pattern hash
 * @param choice - User's intent choice
 */
export function recordChoice(hash: string, choice: IntentChoice): void {
  const choices = loadLearnedChoices();

  const existing = choices[hash];

  if (existing) {
    if (existing.choice === choice) {
      // Same choice - increment count
      choices[hash] = {
        ...existing,
        count: existing.count + 1,
        lastUsedAt: Date.now(),
      };
    } else {
      // Different choice - reset to new choice
      choices[hash] = {
        patternHash: hash,
        choice,
        count: 1,
        negativeCount: 0,
        lastUsedAt: Date.now(),
      };
    }
  } else {
    // New pattern
    choices[hash] = {
      patternHash: hash,
      choice,
      count: 1,
      negativeCount: 0,
      lastUsedAt: Date.now(),
    };
  }

  saveLearnedChoices(choices);

  if (process.env.NODE_ENV === 'development') {
    console.log('[IntentLearning] Recorded choice:', {
      hash,
      choice,
      count: choices[hash].count,
    });
  }
}

/**
 * Get learned choice for a pattern
 * @param hash - Pattern hash
 * @returns Learned choice or null if not found/unreliable
 */
export function getLearnedChoice(hash: string): LearnedChoice | null {
  const choices = loadLearnedChoices();
  const choice = choices[hash];

  if (!choice) return null;

  // Check if expired
  if (Date.now() - choice.lastUsedAt >= TTL_MS) {
    return null;
  }

  return choice;
}

/**
 * Check if a learned choice should be auto-applied
 * @param hash - Pattern hash
 * @returns The choice to auto-apply, or null if confirmation needed
 */
export function getAutoApplyChoice(hash: string): IntentChoice | null {
  const learned = getLearnedChoice(hash);

  if (!learned) return null;

  // Don't auto-apply if too many negative signals (Step 7)
  if (learned.negativeCount >= NEGATIVE_THRESHOLD) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[IntentLearning] Skipping auto-apply due to negative signals:', {
        hash,
        negativeCount: learned.negativeCount,
      });
    }
    return null;
  }

  // ✅ STEP 9: Also check outcome-based reliability
  // Don't auto-apply if pattern has too many high-severity negative outcomes
  if (isPatternUnreliable(hash)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[IntentLearning] Skipping auto-apply due to outcome unreliability:', {
        hash,
      });
    }
    return null;
  }

  // Only auto-apply if count meets threshold
  if (learned.count >= AUTO_APPLY_THRESHOLD) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[IntentLearning] Auto-applying learned choice:', {
        hash,
        choice: learned.choice,
        count: learned.count,
      });
    }
    return learned.choice;
  }

  return null;
}

/**
 * Record a negative signal (e.g., user undid an auto-applied choice)
 * @param hash - Pattern hash
 * @param choice - The choice that was undone
 */
export function recordNegativeSignal(hash: string, choice: IntentChoice): void {
  const choices = loadLearnedChoices();
  const existing = choices[hash];

  if (!existing) return;

  // Only record negative if it matches the stored choice
  if (existing.choice !== choice) return;

  choices[hash] = {
    ...existing,
    negativeCount: existing.negativeCount + 1,
    lastUsedAt: Date.now(),
  };

  saveLearnedChoices(choices);

  if (process.env.NODE_ENV === 'development') {
    console.log('[IntentLearning] Recorded negative signal:', {
      hash,
      choice,
      negativeCount: choices[hash].negativeCount,
    });
  }
}

/**
 * Clear all learned choices (for testing or user request)
 * Clears user-scoped data when governance is active (STEP 14)
 */
export function clearLearnedChoices(): void {
  if (!isStorageAvailable()) return;

  try {
    const storageKey = getStorageKey();
    window.localStorage.removeItem(storageKey);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[IntentLearning] Error clearing choices:', error);
    }
  }
}

/**
 * Get statistics about learned choices (for debugging)
 */
export function getLearnedChoicesStats(): {
  totalPatterns: number;
  autoApplyableCount: number;
  unreliableCount: number;
} {
  const choices = loadLearnedChoices();
  const entries = Object.values(choices);

  return {
    totalPatterns: entries.length,
    autoApplyableCount: entries.filter(
      c => c.count >= AUTO_APPLY_THRESHOLD && c.negativeCount < NEGATIVE_THRESHOLD
    ).length,
    unreliableCount: entries.filter(
      c => c.negativeCount >= NEGATIVE_THRESHOLD
    ).length,
  };
}

// ============================================
// STEP 9: Outcome Integration
// ============================================
// Records outcome-based negative signals to improve
// auto-apply eligibility over time.
// ============================================

/**
 * Outcome reliability storage format
 */
interface OutcomeReliabilityStorage {
  version: 1;
  patterns: Record<string, PatternReliability>;
}

/**
 * Per-pattern reliability tracking from outcomes
 */
interface PatternReliability {
  /** Pattern hash */
  patternHash: string;
  /** Count of high-severity negative outcomes */
  highNegativeCount: number;
  /** Count of accepted outcomes */
  acceptedCount: number;
  /** Last updated timestamp */
  lastUpdatedAt: number;
}

const BASE_OUTCOME_RELIABILITY_KEY = 'studio_intent_outcome_reliability_v1';

/**
 * Get the storage key for outcome reliability data.
 * When governance is active, returns a user-scoped key.
 */
function getOutcomeReliabilityKey(): string {
  if (isGovernanceActive()) {
    return getUserScopedKey(BASE_OUTCOME_RELIABILITY_KEY);
  }
  return BASE_OUTCOME_RELIABILITY_KEY;
}

/**
 * Load outcome reliability data from localStorage
 * Uses user-scoped key when governance is active (STEP 14)
 */
function loadOutcomeReliability(): Record<string, PatternReliability> {
  if (!isStorageAvailable()) return {};

  try {
    const storageKey = getOutcomeReliabilityKey();
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};

    const parsed: OutcomeReliabilityStorage = JSON.parse(raw);
    if (parsed.version !== 1) return {};

    // Filter expired entries (same TTL as learning)
    const now = Date.now();
    const valid: Record<string, PatternReliability> = {};

    for (const [hash, reliability] of Object.entries(parsed.patterns)) {
      if (now - reliability.lastUpdatedAt < TTL_MS) {
        valid[hash] = reliability;
      }
    }

    return valid;
  } catch {
    return {};
  }
}

/**
 * Save outcome reliability data to localStorage
 * Uses user-scoped key when governance is active (STEP 14)
 */
function saveOutcomeReliability(patterns: Record<string, PatternReliability>): void {
  if (!isStorageAvailable()) return;

  try {
    const storageKey = getOutcomeReliabilityKey();
    const storage: OutcomeReliabilityStorage = {
      version: 1,
      patterns,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(storage));
  } catch {
    // Silently fail
  }
}

/**
 * Record an outcome for learning purposes.
 * Updates reliability tracking based on outcome severity.
 *
 * @param intentId - The intent ID (for debugging, not stored)
 * @param patternHash - Pattern hash to update
 * @param severity - Outcome severity ('low' | 'medium' | 'high')
 * @param negative - Whether the outcome was negative
 */
export function recordOutcome(
  intentId: string,
  patternHash: string,
  severity: 'low' | 'medium' | 'high',
  negative: boolean
): void {
  if (!patternHash) return;

  const patterns = loadOutcomeReliability();
  const existing = patterns[patternHash];

  if (existing) {
    patterns[patternHash] = {
      ...existing,
      highNegativeCount: severity === 'high' && negative
        ? existing.highNegativeCount + 1
        : existing.highNegativeCount,
      acceptedCount: !negative
        ? existing.acceptedCount + 1
        : existing.acceptedCount,
      lastUpdatedAt: Date.now(),
    };
  } else {
    patterns[patternHash] = {
      patternHash,
      highNegativeCount: severity === 'high' && negative ? 1 : 0,
      acceptedCount: !negative ? 1 : 0,
      lastUpdatedAt: Date.now(),
    };
  }

  saveOutcomeReliability(patterns);

  if (process.env.NODE_ENV === 'development') {
    console.log('[IntentLearning] Recorded outcome:', {
      intentId,
      patternHash,
      severity,
      negative,
      highNegativeCount: patterns[patternHash].highNegativeCount,
    });
  }
}

/**
 * Get outcome reliability for a pattern
 */
export function getPatternReliability(patternHash: string): PatternReliability | null {
  const patterns = loadOutcomeReliability();
  return patterns[patternHash] || null;
}

/**
 * Check if a pattern has too many high-severity negative outcomes
 * to be eligible for auto-apply.
 *
 * @param patternHash - Pattern hash to check
 * @returns true if pattern is unreliable (should not auto-apply)
 */
export function isPatternUnreliable(patternHash: string): boolean {
  const reliability = getPatternReliability(patternHash);
  if (!reliability) return false;

  // Threshold: 2+ high-severity negative outcomes = unreliable
  return reliability.highNegativeCount >= NEGATIVE_THRESHOLD;
}

/**
 * Clear outcome reliability data (for testing)
 * Clears user-scoped data when governance is active (STEP 14)
 */
export function clearOutcomeReliability(): void {
  if (!isStorageAvailable()) return;

  try {
    const storageKey = getOutcomeReliabilityKey();
    window.localStorage.removeItem(storageKey);
  } catch {
    // Silently fail
  }
}
