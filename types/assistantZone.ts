// ============================================
// Assistant Zone Types - Frozen Spec v2.1
// ============================================
// Secondary, opt-in, silent-by-default assistant
// No auto actions. Trust-first UX.

/**
 * Assistant Zone State (single source of truth)
 * - PASS: Content passed, static indicator only
 * - DRAFT: Has suggestions, actionable
 * - DRAFT_SILENT: Silent mode, minimal "paused" indicator
 * - LOCKED: Blocking issues, read-only
 */
export type AssistantZoneState = 'PASS' | 'DRAFT' | 'DRAFT_SILENT' | 'LOCKED';

/**
 * Suggestion item for DRAFT state
 */
export interface Suggestion {
  id: string;
  type: 'grammar' | 'style' | 'clarity' | 'tone' | 'structure';
  severity: 'low' | 'medium' | 'high';
  message: string;
  original?: string;
  replacement?: string;
}

/**
 * Locked issue for LOCKED state (read-only)
 */
export interface LockedIssue {
  id: string;
  type: 'policy' | 'format' | 'content' | 'length';
  message: string;
}

/**
 * Data for undo restore
 */
export interface UndoRestoreData {
  suggestionId: string;
  originalContent: string;
}

/**
 * Props for AssistantZone orchestrator
 */
export interface AssistantZoneProps {
  /** Current state */
  state: AssistantZoneState;
  /** Suggestions for DRAFT state */
  suggestions: Suggestion[];
  /** Issues for LOCKED state */
  lockedIssues: LockedIssue[];
  /** Called when user applies a suggestion (user-initiated only) */
  onApplySuggestion?: (suggestionId: string) => void;
  /** Called when user dismisses a suggestion */
  onDismissSuggestion?: (suggestionId: string) => void;
  /** Called when user triggers undo (within 8s window) */
  onUndo?: (restoreData: UndoRestoreData) => void;
  /** Called when user toggles silence mode */
  onToggleSilence?: () => void;
}

/**
 * Props for ToastUndo (8-second undo window)
 */
export interface ToastUndoProps {
  /** Whether toast is visible */
  visible: boolean;
  /** Message to display */
  message: string;
  /** Called when user clicks undo */
  onUndo: () => void;
  /** Called when toast dismisses (timeout or manual) */
  onDismiss: () => void;
}
