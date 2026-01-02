// ============================================
// STEP 13: Trust, Control & Recovery Layer
// ============================================
// Provides transparency, controllability, and recoverability
// without increasing AI autonomy.
//
// Features:
// 1. User Control: Expose active preferences, allow reset/disable
// 2. Trust Microcopy: Human-readable explanations (prod-safe)
// 3. Recovery Actions: Undo intent decisions, "don't do this again"
// 4. Observability: DEV-only deep view, PROD-only soft reassurance
//
// INVARIANTS:
// - No new LLM calls
// - No autonomous routing changes
// - No privacy regression
// - SINGLE_LLM_CALL_SITE preserved
// ============================================

import {
  clearPreferences,
  getActivePreferences,
  getPreferenceStats,
  type PreferenceKey,
  type PreferenceBias,
} from './userPreference';
import {
  recordNegativeSignal,
  clearLearnedChoices,
  getLearnedChoicesStats,
  loadLearnedChoices,
  saveLearnedChoices,
  type IntentChoice,
} from './intentLearning';
import { recordOutcome } from './intentLearning';
import type { StabilityMetrics, StabilityBand } from './intentStability';
import type { ConversationMode } from './intentContinuity';

// ============================================
// Types
// ============================================

export type Language = 'vi' | 'en';

/**
 * Trust level for microcopy generation
 */
export type TrustLevel = 'HIGH' | 'BUILDING' | 'LEARNING' | 'UNCERTAIN';

/**
 * User control state (what the user can see/control)
 */
export interface ControlState {
  /** Whether preferences are currently enabled */
  preferencesEnabled: boolean;
  /** Whether auto-apply is currently enabled */
  autoApplyEnabled: boolean;
  /** List of active preferences */
  activePreferences: PreferenceBias[];
  /** Statistics about learned patterns */
  learningStats: {
    totalPatterns: number;
    autoApplyableCount: number;
    unreliableCount: number;
  };
  /** Statistics about preferences */
  preferenceStats: {
    totalPreferences: number;
    activePreferences: number;
    strongestPreference: PreferenceBias | null;
    oldestObservation: number | null;
  };
}

/**
 * Recovery action types
 */
export type RecoveryAction =
  | { type: 'UNDO_LAST_INTENT'; intentId: string; patternHash?: string }
  | { type: 'DONT_DO_THIS_AGAIN'; patternHash: string; choice: IntentChoice }
  | { type: 'RESET_PATTERN'; patternHash: string }
  | { type: 'DISABLE_PREFERENCES_TEMP' }
  | { type: 'RESET_ALL_LEARNING' }
  | { type: 'RESET_ALL_PREFERENCES' };

/**
 * Trust microcopy result
 */
export interface TrustMicrocopy {
  /** Short label for UI display */
  label: string;
  /** Emoji for visual cue */
  emoji: string;
  /** Extended explanation (hover/tooltip) */
  explanation: string;
  /** Trust level for styling */
  level: TrustLevel;
}

// ============================================
// Session-only Control State
// ============================================

let _preferencesTemporarilyDisabled = false;
let _autoApplyTemporarilyDisabled = false;

/**
 * Temporarily disable preferences for this session
 */
export function temporarilyDisablePreferences(): void {
  _preferencesTemporarilyDisabled = true;
}

/**
 * Re-enable preferences
 */
export function enablePreferences(): void {
  _preferencesTemporarilyDisabled = false;
}

/**
 * Check if preferences are currently enabled
 */
export function arePreferencesEnabled(): boolean {
  return !_preferencesTemporarilyDisabled;
}

/**
 * Temporarily disable auto-apply for this session
 */
export function temporarilyDisableAutoApply(): void {
  _autoApplyTemporarilyDisabled = true;
}

/**
 * Re-enable auto-apply
 */
export function enableAutoApply(): void {
  _autoApplyTemporarilyDisabled = false;
}

/**
 * Check if auto-apply is currently enabled
 */
export function isAutoApplyEnabled(): boolean {
  return !_autoApplyTemporarilyDisabled;
}

// ============================================
// Control State
// ============================================

/**
 * Get the current control state (what the user can see/control)
 */
export function getControlState(): ControlState {
  return {
    preferencesEnabled: arePreferencesEnabled(),
    autoApplyEnabled: isAutoApplyEnabled(),
    activePreferences: arePreferencesEnabled() ? getActivePreferences() : [],
    learningStats: getLearnedChoicesStats(),
    preferenceStats: getPreferenceStats(),
  };
}

// ============================================
// Recovery Actions
// ============================================

/**
 * Execute a recovery action
 * Returns a human-readable result message
 */
export function executeRecoveryAction(action: RecoveryAction, language: Language = 'vi'): string {
  switch (action.type) {
    case 'UNDO_LAST_INTENT': {
      // Record negative signal for outcome tracking
      if (action.patternHash) {
        recordOutcome(action.intentId, action.patternHash, 'high', true);
      }
      return language === 'vi'
        ? 'Da hoan tac hanh dong truoc'
        : 'Undid previous action';
    }

    case 'DONT_DO_THIS_AGAIN': {
      // Record a strong negative signal for this pattern
      recordNegativeSignal(action.patternHash, action.choice);
      recordNegativeSignal(action.patternHash, action.choice); // Record twice for high severity
      return language === 'vi'
        ? 'Da ghi nho, se khong tu dong ap dung cho truong hop nay'
        : 'Noted, will not auto-apply for this case';
    }

    case 'RESET_PATTERN': {
      // Clear a specific pattern from learned choices
      const choices = loadLearnedChoices();
      delete choices[action.patternHash];
      saveLearnedChoices(choices);
      return language === 'vi'
        ? 'Da xoa du lieu hoc cho mau nay'
        : 'Cleared learning data for this pattern';
    }

    case 'DISABLE_PREFERENCES_TEMP': {
      temporarilyDisablePreferences();
      return language === 'vi'
        ? 'Da tam tat so thich ca nhan cho phien nay'
        : 'Preferences temporarily disabled for this session';
    }

    case 'RESET_ALL_LEARNING': {
      clearLearnedChoices();
      return language === 'vi'
        ? 'Da xoa toan bo du lieu hoc'
        : 'All learning data cleared';
    }

    case 'RESET_ALL_PREFERENCES': {
      clearPreferences();
      return language === 'vi'
        ? 'Da xoa toan bo so thich ca nhan'
        : 'All preferences cleared';
    }
  }
}

// ============================================
// Trust Microcopy Generation
// ============================================

/**
 * Compute trust level from stability and context
 */
export function computeTrustLevel(params: {
  stabilityBand?: StabilityBand;
  hasActivePreferences?: boolean;
  autoApplyEligible?: boolean;
  recentNegativeCount?: number;
}): TrustLevel {
  const { stabilityBand, hasActivePreferences, autoApplyEligible, recentNegativeCount = 0 } = params;

  // High negatives = uncertain
  if (recentNegativeCount >= 2) {
    return 'UNCERTAIN';
  }

  // High stability + auto-apply = high trust
  if (stabilityBand === 'HIGH' && autoApplyEligible) {
    return 'HIGH';
  }

  // Medium stability or active preferences = building
  if (stabilityBand === 'MEDIUM' || hasActivePreferences) {
    return 'BUILDING';
  }

  // Low stability or new = learning
  return 'LEARNING';
}

/**
 * Get production-safe trust microcopy
 * Human-readable, non-technical, reassuring
 */
export function getTrustMicrocopy(params: {
  stabilityMetrics?: StabilityMetrics;
  hasActivePreferences?: boolean;
  continuityMode?: ConversationMode;
  language?: Language;
}): TrustMicrocopy {
  const {
    stabilityMetrics,
    hasActivePreferences = false,
    continuityMode: _continuityMode,
    language = 'vi',
  } = params;

  const trustLevel = computeTrustLevel({
    stabilityBand: stabilityMetrics?.band,
    hasActivePreferences,
    autoApplyEligible: stabilityMetrics?.autoApplyEligible,
    recentNegativeCount: stabilityMetrics?.negativeHighCount,
  });

  // Vietnamese microcopy
  if (language === 'vi') {
    switch (trustLevel) {
      case 'HIGH':
        return {
          label: 'Hieu ban',
          emoji: '✨',
          explanation: 'Toi da hoc duoc so thich cua ban qua nhieu lan su dung',
          level: 'HIGH',
        };
      case 'BUILDING':
        return {
          label: 'Dang hoc',
          emoji: '📚',
          explanation: 'Toi dang tim hieu cach ban thich lam viec',
          level: 'BUILDING',
        };
      case 'UNCERTAIN':
        return {
          label: 'Can xac nhan',
          emoji: '🤔',
          explanation: 'Toi can ban xac nhan de dam bao lam dung y ban',
          level: 'UNCERTAIN',
        };
      case 'LEARNING':
      default:
        return {
          label: 'Moi bat dau',
          emoji: '👋',
          explanation: 'Chao ban! Hay cho toi biet ban muon gi',
          level: 'LEARNING',
        };
    }
  }

  // English microcopy
  switch (trustLevel) {
    case 'HIGH':
      return {
        label: 'Got it',
        emoji: '✨',
        explanation: "I've learned your preferences over time",
        level: 'HIGH',
      };
    case 'BUILDING':
      return {
        label: 'Learning',
        emoji: '📚',
        explanation: "I'm learning how you like to work",
        level: 'BUILDING',
      };
    case 'UNCERTAIN':
      return {
        label: 'Please confirm',
        emoji: '🤔',
        explanation: 'I want to make sure I understand correctly',
        level: 'UNCERTAIN',
      };
    case 'LEARNING':
    default:
      return {
        label: 'New here',
        emoji: '👋',
        explanation: 'Hello! Let me know what you need',
        level: 'LEARNING',
      };
  }
}

// ============================================
// Preference Display Helpers
// ============================================

/**
 * Get human-readable label for a preference key
 */
export function getPreferenceLabel(key: PreferenceKey, language: Language = 'vi'): string {
  const labels: Record<PreferenceKey, { vi: string; en: string }> = {
    prefersShortOutput: { vi: 'Thich van ban ngan', en: 'Prefers short text' },
    prefersLongOutput: { vi: 'Thich van ban dai', en: 'Prefers long text' },
    prefersProfessionalTone: { vi: 'Giong dieu chuyen nghiep', en: 'Professional tone' },
    prefersCasualTone: { vi: 'Giong dieu than thien', en: 'Casual tone' },
    avoidsEmoji: { vi: 'Tranh emoji', en: 'Avoids emoji' },
    likesEmoji: { vi: 'Thich emoji', en: 'Likes emoji' },
    prefersEditInPlace: { vi: 'Thich sua truc tiep', en: 'Prefers editing in place' },
    prefersTransformOverCreate: { vi: 'Thich chuyen doi', en: 'Prefers transform' },
    prefersCreateOverTransform: { vi: 'Thich tao moi', en: 'Prefers create new' },
    prefersVietnamese: { vi: 'Thich tieng Viet', en: 'Prefers Vietnamese' },
    prefersEnglish: { vi: 'Thich tieng Anh', en: 'Prefers English' },
  };

  return labels[key]?.[language] ?? key;
}

/**
 * Get a summary of active preferences for display
 */
export function getPreferenceSummary(language: Language = 'vi'): string {
  const active = getActivePreferences();

  if (active.length === 0) {
    return language === 'vi'
      ? 'Chua co so thich nao duoc hoc'
      : 'No preferences learned yet';
  }

  const labels = active.slice(0, 3).map(p => getPreferenceLabel(p.key, language));

  if (active.length > 3) {
    const more = language === 'vi' ? `va ${active.length - 3} khac` : `and ${active.length - 3} more`;
    return `${labels.join(', ')} ${more}`;
  }

  return labels.join(', ');
}

// ============================================
// Control Copy (for UI buttons/links)
// ============================================

export interface ControlCopy {
  resetPreferences: string;
  resetLearning: string;
  disableTemporarily: string;
  dontDoThisAgain: string;
  undoAction: string;
  viewPreferences: string;
}

/**
 * Get control copy for UI
 */
export function getControlCopy(language: Language = 'vi'): ControlCopy {
  if (language === 'vi') {
    return {
      resetPreferences: 'Xoa so thich',
      resetLearning: 'Xoa du lieu hoc',
      disableTemporarily: 'Tam tat',
      dontDoThisAgain: 'Dung lam lai',
      undoAction: 'Hoan tac',
      viewPreferences: 'Xem so thich',
    };
  }

  return {
    resetPreferences: 'Reset preferences',
    resetLearning: 'Reset learning',
    disableTemporarily: 'Disable temporarily',
    dontDoThisAgain: "Don't do this again",
    undoAction: 'Undo',
    viewPreferences: 'View preferences',
  };
}

// ============================================
// Color Classes for Trust Levels
// ============================================

/**
 * Get color classes for a trust level (for UI styling)
 */
export function getTrustColorClasses(level: TrustLevel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (level) {
    case 'HIGH':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
      };
    case 'BUILDING':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
      };
    case 'UNCERTAIN':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
      };
    case 'LEARNING':
    default:
      return {
        bg: 'bg-slate-50 dark:bg-slate-900/20',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-800',
      };
  }
}

// ============================================
// Debug Helpers
// ============================================

/**
 * Get a comprehensive debug summary (DEV-only)
 */
export function getControlDebugSummary(): string {
  const state = getControlState();

  const parts = [
    `Prefs: ${state.preferencesEnabled ? 'on' : 'OFF'}`,
    `Auto: ${state.autoApplyEnabled ? 'on' : 'OFF'}`,
    `Active: ${state.activePreferences.length}`,
    `Patterns: ${state.learningStats.totalPatterns}`,
    `AutoApply: ${state.learningStats.autoApplyableCount}`,
    `Unreliable: ${state.learningStats.unreliableCount}`,
  ];

  return parts.join(' | ');
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
