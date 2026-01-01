// ============================================
// STEP 12 + STEP 14: User Preference & Style Memory (Soft Bias)
// ============================================
// Remembers HOW the user prefers to work, providing soft bias
// for default selections and ordering - never forcing decisions.
//
// INVARIANTS:
// - No LLM calls
// - No routing override (soft bias only)
// - No raw text storage (privacy-safe)
// - Session + short-lived localStorage (TTL 14-30 days)
// - SINGLE_LLM_CALL_SITE preserved
//
// STEP 14: USER ISOLATION
// - When governance is active, preference data is scoped per-user
// - Uses user-scoped storage keys to prevent cross-user data sharing
// - No cross-user preference leakage
// ============================================

import {
  isGovernanceActive,
  getUserScopedKey,
} from './intentGovernance';

// ============================================
// Configuration
// ============================================

/** Base storage key for preferences */
const BASE_STORAGE_KEY = 'studio_user_preferences_v1';

/**
 * Get the storage key for preference data.
 * When governance is active, returns a user-scoped key.
 */
function getStorageKey(): string {
  if (isGovernanceActive()) {
    return getUserScopedKey(BASE_STORAGE_KEY);
  }
  return BASE_STORAGE_KEY;
}

/** Default TTL in milliseconds (21 days) */
const DEFAULT_TTL_MS = 21 * 24 * 60 * 60 * 1000;

/** Minimum observations before preference is active */
const MIN_OBSERVATIONS = 3;

/** Decay factor per day (preference strength reduces over time) */
const DECAY_PER_DAY = 0.05;

/** Maximum preference strength (0-1) */
const MAX_STRENGTH = 0.85;

/** Minimum preference strength to consider active */
const MIN_ACTIVE_STRENGTH = 0.3;

// ============================================
// Types
// ============================================

export type PreferenceKey =
  | 'prefersShortOutput'
  | 'prefersLongOutput'
  | 'prefersProfessionalTone'
  | 'prefersCasualTone'
  | 'avoidsEmoji'
  | 'likesEmoji'
  | 'prefersEditInPlace'
  | 'prefersTransformOverCreate'
  | 'prefersCreateOverTransform'
  | 'prefersVietnamese'
  | 'prefersEnglish';

export interface PreferenceSignal {
  /** The preference being signaled */
  key: PreferenceKey;
  /** Strength of the signal (0-1, default 1) */
  strength?: number;
  /** Optional context for the signal */
  context?: string;
}

export interface PreferenceRecord {
  /** Number of positive observations */
  positiveCount: number;
  /** Number of negative observations (contradictions) */
  negativeCount: number;
  /** Last observation timestamp */
  lastObserved: number;
  /** First observation timestamp */
  firstObserved: number;
}

export interface PreferenceState {
  /** Version for migration */
  version: number;
  /** Map of preference key to record */
  preferences: Record<string, PreferenceRecord>;
  /** Last cleanup timestamp */
  lastCleanup: number;
}

export interface PreferenceBias {
  /** The preference key */
  key: PreferenceKey;
  /** Computed strength (0-1) after decay */
  strength: number;
  /** Whether this preference is active (above threshold) */
  active: boolean;
  /** Human-readable reason */
  reason: string;
}

export interface PreferenceContext {
  /** Current route hint from confidence */
  routeHint?: 'CREATE' | 'TRANSFORM';
  /** Whether there's an active source */
  hasActiveSource?: boolean;
  /** Input length */
  inputLength?: number;
  /** Current stability band */
  stabilityBand?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface BiasResult {
  /** Active preferences that apply */
  activePreferences: PreferenceBias[];
  /** Suggested default choice bias (if any) */
  defaultChoiceBias?: 'EDIT_IN_PLACE' | 'TRANSFORM_NEW_VERSION' | 'CREATE_NEW';
  /** Strength of the default choice bias (0-1) */
  defaultChoiceStrength: number;
  /** Order bias for confirmation options */
  optionOrderBias: Array<'EDIT_IN_PLACE' | 'TRANSFORM_NEW_VERSION' | 'CREATE_NEW'>;
  /** Debug summary */
  debugSummary: string;
}

// ============================================
// Storage Helpers
// ============================================

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function createEmptyState(): PreferenceState {
  return {
    version: 1,
    preferences: {},
    lastCleanup: Date.now(),
  };
}

/**
 * Load preferences from localStorage
 * Uses user-scoped key when governance is active (STEP 14)
 */
export function loadPreferences(): PreferenceState {
  const storage = getStorage();
  if (!storage) return createEmptyState();

  try {
    const storageKey = getStorageKey();
    const raw = storage.getItem(storageKey);
    if (!raw) return createEmptyState();

    const parsed = JSON.parse(raw) as PreferenceState;

    // Version check
    if (parsed.version !== 1) {
      return createEmptyState();
    }

    return parsed;
  } catch {
    return createEmptyState();
  }
}

/**
 * Save preferences to localStorage
 * Uses user-scoped key when governance is active (STEP 14)
 */
export function savePreferences(state: PreferenceState): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const storageKey = getStorageKey();
    storage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Fail silently - storage might be full
  }
}

/**
 * Clear all preferences
 * Clears user-scoped data when governance is active (STEP 14)
 */
export function clearPreferences(): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const storageKey = getStorageKey();
    storage.removeItem(storageKey);
  } catch {
    // Fail silently
  }
}

// ============================================
// Preference Recording
// ============================================

/**
 * Record a preference signal.
 * Positive signal strengthens the preference, negative weakens it.
 *
 * @param signal - The preference signal to record
 * @param negative - If true, this is a contradicting observation
 */
export function recordPreference(
  signal: PreferenceSignal,
  negative: boolean = false
): void {
  const state = loadPreferences();
  const now = Date.now();

  // Get or create record
  const existing = state.preferences[signal.key];
  const record: PreferenceRecord = existing ?? {
    positiveCount: 0,
    negativeCount: 0,
    lastObserved: now,
    firstObserved: now,
  };

  // Update counts
  if (negative) {
    record.negativeCount++;
  } else {
    record.positiveCount++;
  }
  record.lastObserved = now;

  state.preferences[signal.key] = record;

  // Periodic cleanup (once per day)
  if (now - state.lastCleanup > 24 * 60 * 60 * 1000) {
    cleanupExpiredPreferences(state);
    state.lastCleanup = now;
  }

  savePreferences(state);
}

/**
 * Record multiple preference signals at once
 */
export function recordPreferences(
  signals: Array<{ signal: PreferenceSignal; negative?: boolean }>
): void {
  const state = loadPreferences();
  const now = Date.now();

  for (const { signal, negative } of signals) {
    const existing = state.preferences[signal.key];
    const record: PreferenceRecord = existing ?? {
      positiveCount: 0,
      negativeCount: 0,
      lastObserved: now,
      firstObserved: now,
    };

    if (negative) {
      record.negativeCount++;
    } else {
      record.positiveCount++;
    }
    record.lastObserved = now;

    state.preferences[signal.key] = record;
  }

  // Periodic cleanup
  if (now - state.lastCleanup > 24 * 60 * 60 * 1000) {
    cleanupExpiredPreferences(state);
    state.lastCleanup = now;
  }

  savePreferences(state);
}

// ============================================
// Preference Decay & Cleanup
// ============================================

/**
 * Calculate decay factor based on time since last observation
 */
function calculateDecay(lastObserved: number): number {
  const now = Date.now();
  const daysSince = (now - lastObserved) / (24 * 60 * 60 * 1000);
  const decay = Math.max(0, 1 - daysSince * DECAY_PER_DAY);
  return decay;
}

/**
 * Remove expired preferences from state
 */
function cleanupExpiredPreferences(state: PreferenceState): void {
  const now = Date.now();
  const keysToRemove: string[] = [];

  for (const [key, record] of Object.entries(state.preferences)) {
    // Remove if older than TTL
    if (now - record.lastObserved > DEFAULT_TTL_MS) {
      keysToRemove.push(key);
      continue;
    }

    // Remove if decay makes it effectively zero
    const decay = calculateDecay(record.lastObserved);
    if (decay < 0.1) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    delete state.preferences[key];
  }
}

// ============================================
// Preference Strength Calculation
// ============================================

/**
 * Calculate the effective strength of a preference
 */
function calculateStrength(record: PreferenceRecord): number {
  const total = record.positiveCount + record.negativeCount;

  // Not enough observations
  if (total < MIN_OBSERVATIONS) {
    return 0;
  }

  // Calculate base strength from ratio
  const ratio = record.positiveCount / total;

  // Only count as preference if clearly positive (>60% positive)
  if (ratio < 0.6) {
    return 0;
  }

  // Scale to 0-1 (60% → 0, 100% → 1)
  const baseStrength = (ratio - 0.6) / 0.4;

  // Apply decay
  const decay = calculateDecay(record.lastObserved);
  const decayedStrength = baseStrength * decay;

  // Apply observation bonus (more observations = more confidence)
  const observationBonus = Math.min(1, total / 10); // Max bonus at 10 observations
  const boostedStrength = decayedStrength * (0.7 + 0.3 * observationBonus);

  // Clamp to max
  return Math.min(MAX_STRENGTH, boostedStrength);
}

/**
 * Get a single preference bias
 */
export function getPreference(key: PreferenceKey): PreferenceBias | null {
  const state = loadPreferences();
  const record = state.preferences[key];

  if (!record) {
    return null;
  }

  const strength = calculateStrength(record);
  const active = strength >= MIN_ACTIVE_STRENGTH;

  const total = record.positiveCount + record.negativeCount;
  const reason = active
    ? `${record.positiveCount}/${total} observations, ${Math.round(strength * 100)}% strength`
    : total < MIN_OBSERVATIONS
      ? `Insufficient data (${total}/${MIN_OBSERVATIONS})`
      : `Weak signal (${Math.round(strength * 100)}%)`;

  return {
    key,
    strength,
    active,
    reason,
  };
}

/**
 * Get all active preferences
 */
export function getActivePreferences(): PreferenceBias[] {
  const state = loadPreferences();
  const active: PreferenceBias[] = [];

  for (const key of Object.keys(state.preferences) as PreferenceKey[]) {
    const pref = getPreference(key);
    if (pref?.active) {
      active.push(pref);
    }
  }

  // Sort by strength descending
  return active.sort((a, b) => b.strength - a.strength);
}

// ============================================
// Bias Calculation
// ============================================

/**
 * Get preference bias for the current context.
 * Returns soft suggestions for default selection and ordering.
 *
 * @param context - Current context for bias calculation
 * @returns BiasResult with suggestions (never forces)
 */
export function getPreferenceBias(context: PreferenceContext = {}): BiasResult {
  const activePreferences = getActivePreferences();

  // Default option order
  const defaultOrder: Array<'EDIT_IN_PLACE' | 'TRANSFORM_NEW_VERSION' | 'CREATE_NEW'> = [
    'TRANSFORM_NEW_VERSION',
    'CREATE_NEW',
    'EDIT_IN_PLACE',
  ];

  // No active preferences
  if (activePreferences.length === 0) {
    return {
      activePreferences: [],
      defaultChoiceBias: undefined,
      defaultChoiceStrength: 0,
      optionOrderBias: defaultOrder,
      debugSummary: 'No active preferences',
    };
  }

  // Calculate choice bias
  let defaultChoiceBias: BiasResult['defaultChoiceBias'] = undefined;
  let defaultChoiceStrength = 0;
  const orderScores = {
    EDIT_IN_PLACE: 0,
    TRANSFORM_NEW_VERSION: 0,
    CREATE_NEW: 0,
  };

  for (const pref of activePreferences) {
    switch (pref.key) {
      case 'prefersEditInPlace':
        orderScores.EDIT_IN_PLACE += pref.strength;
        if (pref.strength > defaultChoiceStrength && context.hasActiveSource) {
          defaultChoiceBias = 'EDIT_IN_PLACE';
          defaultChoiceStrength = pref.strength;
        }
        break;

      case 'prefersTransformOverCreate':
        orderScores.TRANSFORM_NEW_VERSION += pref.strength;
        if (pref.strength > defaultChoiceStrength && context.routeHint !== 'CREATE') {
          defaultChoiceBias = 'TRANSFORM_NEW_VERSION';
          defaultChoiceStrength = pref.strength;
        }
        break;

      case 'prefersCreateOverTransform':
        orderScores.CREATE_NEW += pref.strength;
        if (pref.strength > defaultChoiceStrength && context.routeHint !== 'TRANSFORM') {
          defaultChoiceBias = 'CREATE_NEW';
          defaultChoiceStrength = pref.strength;
        }
        break;

      // Other preferences don't affect choice ordering directly
      default:
        break;
    }
  }

  // Sort options by score
  const optionOrderBias = Object.entries(orderScores)
    .sort(([, a], [, b]) => b - a)
    .map(([key]) => key as 'EDIT_IN_PLACE' | 'TRANSFORM_NEW_VERSION' | 'CREATE_NEW');

  // Generate debug summary
  const activeKeys = activePreferences.map(p => `${p.key}(${Math.round(p.strength * 100)}%)`);
  const debugSummary = activeKeys.length > 0
    ? `Active: ${activeKeys.join(', ')}`
    : 'No active preferences';

  return {
    activePreferences,
    defaultChoiceBias,
    defaultChoiceStrength,
    optionOrderBias,
    debugSummary,
  };
}

// ============================================
// Signal Detection Helpers
// ============================================

/**
 * Detect preference signals from user choice
 */
export function detectChoiceSignals(
  choice: 'EDIT_IN_PLACE' | 'TRANSFORM_NEW_VERSION' | 'CREATE_NEW',
  context: PreferenceContext
): PreferenceSignal[] {
  const signals: PreferenceSignal[] = [];

  switch (choice) {
    case 'EDIT_IN_PLACE':
      signals.push({ key: 'prefersEditInPlace' });
      // Choosing edit over transform when transform was hinted
      if (context.routeHint === 'TRANSFORM') {
        signals.push({ key: 'prefersEditInPlace', strength: 0.5 });
      }
      break;

    case 'TRANSFORM_NEW_VERSION':
      // Only signal if create was hinted but user chose transform
      if (context.routeHint === 'CREATE') {
        signals.push({ key: 'prefersTransformOverCreate' });
      }
      break;

    case 'CREATE_NEW':
      // Only signal if transform was hinted but user chose create
      if (context.routeHint === 'TRANSFORM') {
        signals.push({ key: 'prefersCreateOverTransform' });
      }
      break;
  }

  return signals;
}

/**
 * Detect preference signals from output characteristics
 */
export function detectOutputSignals(output: string): PreferenceSignal[] {
  const signals: PreferenceSignal[] = [];

  // Length preference
  const wordCount = output.split(/\s+/).filter(Boolean).length;
  if (wordCount < 100) {
    signals.push({ key: 'prefersShortOutput', strength: 0.3 });
  } else if (wordCount > 300) {
    signals.push({ key: 'prefersLongOutput', strength: 0.3 });
  }

  // Emoji preference
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const hasEmoji = emojiRegex.test(output);
  if (hasEmoji) {
    signals.push({ key: 'likesEmoji', strength: 0.2 });
  }

  return signals;
}

/**
 * Detect preference signals from instruction patterns
 */
export function detectInstructionSignals(instruction: string): PreferenceSignal[] {
  const signals: PreferenceSignal[] = [];
  const normalized = instruction.toLowerCase().normalize('NFC');

  // Short output preference
  if (/\b(ngắn|gọn|súc tích|brief|short|concise)\b/i.test(normalized)) {
    signals.push({ key: 'prefersShortOutput' });
  }

  // Long output preference
  if (/\b(dài|chi tiết|detailed|elaborate|expand)\b/i.test(normalized)) {
    signals.push({ key: 'prefersLongOutput' });
  }

  // Professional tone
  if (/\b(chuyên nghiệp|professional|formal|trang trọng)\b/i.test(normalized)) {
    signals.push({ key: 'prefersProfessionalTone' });
  }

  // Casual tone
  if (/\b(thân thiện|casual|friendly|thoải mái)\b/i.test(normalized)) {
    signals.push({ key: 'prefersCasualTone' });
  }

  // Emoji preference
  if (/\b(thêm emoji|add emoji|emoji)\b/i.test(normalized)) {
    signals.push({ key: 'likesEmoji' });
  }

  // No emoji preference
  if (/\b(bỏ emoji|no emoji|không emoji|remove emoji)\b/i.test(normalized)) {
    signals.push({ key: 'avoidsEmoji' });
  }

  return signals;
}

// ============================================
// Debug Helpers
// ============================================

/**
 * Get a compact debug summary of preferences
 */
export function getPreferenceDebugSummary(): string {
  const active = getActivePreferences();

  if (active.length === 0) {
    return 'No prefs';
  }

  const parts = active.slice(0, 3).map(p => {
    const shortKey = p.key.replace('prefers', '').replace('avoids', '!').slice(0, 8);
    return `${shortKey}:${Math.round(p.strength * 100)}%`;
  });

  if (active.length > 3) {
    parts.push(`+${active.length - 3}`);
  }

  return parts.join(' | ');
}

/**
 * Get preference statistics
 */
export function getPreferenceStats(): {
  totalPreferences: number;
  activePreferences: number;
  strongestPreference: PreferenceBias | null;
  oldestObservation: number | null;
} {
  const state = loadPreferences();
  const active = getActivePreferences();

  let oldestObservation: number | null = null;
  for (const record of Object.values(state.preferences)) {
    if (oldestObservation === null || record.firstObserved < oldestObservation) {
      oldestObservation = record.firstObserved;
    }
  }

  return {
    totalPreferences: Object.keys(state.preferences).length,
    activePreferences: active.length,
    strongestPreference: active[0] ?? null,
    oldestObservation,
  };
}

/**
 * Get color classes for preference strength (for debug display)
 */
export function getPreferenceColorClasses(strength: number): {
  bg: string;
  text: string;
  border: string;
} {
  if (strength >= 0.7) {
    return {
      bg: 'bg-indigo-100 dark:bg-indigo-900/30',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-300 dark:border-indigo-700',
    };
  }
  if (strength >= 0.5) {
    return {
      bg: 'bg-violet-100 dark:bg-violet-900/30',
      text: 'text-violet-700 dark:text-violet-300',
      border: 'border-violet-300 dark:border-violet-700',
    };
  }
  return {
    bg: 'bg-slate-100 dark:bg-slate-900/30',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
  };
}
