// ============================================
// STEP 14A: Editorial Authority & Single Draft Enforcement
// ============================================
// Transforms Studio from "AI generates multiple versions"
// into "AI assists user in editing ONE authoritative draft"
//
// CORE PRINCIPLE: The user is the Editor-in-Chief.
// AI is a senior editor, not a generator.
//
// NON-NEGOTIABLE RULES:
// 1. Exactly ONE Active Draft at any time
// 2. Edit Mode = IN-PLACE EDITING ONLY
// 3. AI FORBIDDEN from creating new variants while editing
// 4. New drafts ONLY by explicit user action
// 5. SINGLE_LLM_CALL_SITE invariant preserved
//
// INVARIANTS:
// - No new LLM calls added
// - No regression in intent/stability/learning/trust layers
// - All behavior changes are enforcement, not generation
// ============================================

// ============================================
// Types
// ============================================

/**
 * Editorial mode - what operation is currently allowed
 */
export type EditorialMode =
  | 'DRAFT_ACTIVE'      // Editing existing draft (IN-PLACE only)
  | 'EDIT_LOCKED'       // Mid-edit, waiting for LLM response
  | 'CREATE_NEW_DRAFT'  // Explicitly creating new content
  | 'NO_DRAFT';         // Initial state, no content yet

/**
 * Draft status for tracking lifecycle
 */
export type DraftStatus =
  | 'ACTIVE'    // The current working draft
  | 'ARCHIVED'  // Saved but not active
  | 'DISCARDED'; // Explicitly abandoned

/**
 * Editorial state - single source of truth for editing context
 */
export interface EditorialState {
  /** Current editorial mode */
  mode: EditorialMode;
  /** ID of the active draft (single source of truth) */
  activeDraftId: string | null;
  /** Status of the active draft */
  draftStatus: DraftStatus | null;
  /** Timestamp when draft became active */
  activeSince: number | null;
  /** Number of edits applied to this draft */
  editCount: number;
  /** Whether user has been warned about CREATE while editing */
  createWarningShown: boolean;
  /** Last intent that was overridden (for debug) */
  lastOverriddenIntent: OverriddenIntent | null;
}

/**
 * Overridden intent tracking (DEV observability)
 */
export interface OverriddenIntent {
  /** Original detected intent */
  attemptedIntent: 'CREATE' | 'TRANSFORM' | 'EDIT_IN_PLACE';
  /** Enforced intent after override */
  enforcedIntent: 'EDIT_IN_PLACE';
  /** Reason for override */
  reason: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Intent override result from editorial authority check
 */
export interface IntentOverrideResult {
  /** Whether the intent was overridden */
  overridden: boolean;
  /** Original intent */
  originalIntent: 'CREATE' | 'TRANSFORM' | 'EDIT_IN_PLACE';
  /** Final intent to use */
  finalIntent: 'CREATE' | 'TRANSFORM' | 'EDIT_IN_PLACE';
  /** Reason for override (if any) */
  reason: string | null;
  /** Whether to show create warning UI */
  showCreateWarning: boolean;
  /** Whether execution should be blocked */
  blocked: boolean;
}

/**
 * Create intent confirmation - user's explicit choice
 */
export type CreateConfirmation =
  | 'CONTINUE_EDITING'  // User wants to keep editing current draft
  | 'CREATE_NEW'        // User explicitly wants new draft
  | 'CANCEL';           // User cancelled the action

// ============================================
// State Management (Session-only)
// ============================================

/**
 * Initial editorial state
 */
function createInitialState(): EditorialState {
  return {
    mode: 'NO_DRAFT',
    activeDraftId: null,
    draftStatus: null,
    activeSince: null,
    editCount: 0,
    createWarningShown: false,
    lastOverriddenIntent: null,
  };
}

// Session-only state (not persisted)
let _editorialState: EditorialState = createInitialState();

/**
 * Get current editorial state
 */
export function getEditorialState(): EditorialState {
  return { ..._editorialState };
}

/**
 * Check if there's an active draft
 */
export function hasActiveDraft(): boolean {
  return _editorialState.mode === 'DRAFT_ACTIVE' && _editorialState.activeDraftId !== null;
}

/**
 * Check if currently in edit-locked state
 */
export function isEditLocked(): boolean {
  return _editorialState.mode === 'EDIT_LOCKED';
}

/**
 * Get the active draft ID
 */
export function getActiveDraftId(): string | null {
  return _editorialState.activeDraftId;
}

/**
 * Get current editorial mode
 */
export function getEditorialMode(): EditorialMode {
  return _editorialState.mode;
}

// ============================================
// State Transitions
// ============================================

/**
 * Set the active draft (creates DRAFT_ACTIVE mode)
 * Called when user approves or selects a message as the main draft
 */
export function setActiveDraft(draftId: string): void {
  _editorialState = {
    mode: 'DRAFT_ACTIVE',
    activeDraftId: draftId,
    draftStatus: 'ACTIVE',
    activeSince: Date.now(),
    editCount: 0,
    createWarningShown: false,
    lastOverriddenIntent: null,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[EditorialAuthority] Draft activated:', draftId);
  }
}

/**
 * Lock editing while waiting for LLM response
 */
export function lockForEdit(): void {
  if (_editorialState.mode !== 'DRAFT_ACTIVE') {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[EditorialAuthority] Cannot lock - no active draft');
    }
    return;
  }

  _editorialState = {
    ..._editorialState,
    mode: 'EDIT_LOCKED',
  };
}

/**
 * Unlock editing after LLM response
 */
export function unlockEdit(): void {
  if (_editorialState.mode !== 'EDIT_LOCKED') return;

  _editorialState = {
    ..._editorialState,
    mode: 'DRAFT_ACTIVE',
    editCount: _editorialState.editCount + 1,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[EditorialAuthority] Edit completed, count:', _editorialState.editCount);
  }
}

/**
 * Enter CREATE_NEW_DRAFT mode (explicit user action)
 */
export function enterCreateMode(): void {
  // Archive current draft if exists
  if (_editorialState.activeDraftId) {
    _editorialState = {
      ..._editorialState,
      draftStatus: 'ARCHIVED',
    };
  }

  _editorialState = {
    mode: 'CREATE_NEW_DRAFT',
    activeDraftId: null,
    draftStatus: null,
    activeSince: null,
    editCount: 0,
    createWarningShown: false,
    lastOverriddenIntent: null,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[EditorialAuthority] Entering CREATE mode');
  }
}

/**
 * Archive the current draft and clear state
 */
export function archiveActiveDraft(): void {
  if (!_editorialState.activeDraftId) return;

  _editorialState = {
    ...createInitialState(),
    lastOverriddenIntent: _editorialState.lastOverriddenIntent,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[EditorialAuthority] Draft archived');
  }
}

/**
 * Discard the current draft (explicit user action)
 */
export function discardActiveDraft(): void {
  _editorialState = createInitialState();

  if (process.env.NODE_ENV === 'development') {
    console.log('[EditorialAuthority] Draft discarded');
  }
}

/**
 * Reset editorial state (for new session or clear)
 */
export function resetEditorialState(): void {
  _editorialState = createInitialState();

  if (process.env.NODE_ENV === 'development') {
    console.log('[EditorialAuthority] State reset');
  }
}

/**
 * Mark that create warning was shown
 */
export function markCreateWarningShown(): void {
  _editorialState = {
    ..._editorialState,
    createWarningShown: true,
  };
}

// ============================================
// Intent Override Logic (CRITICAL)
// ============================================

/**
 * Check if an intent should be overridden by editorial authority.
 * This is the CRITICAL function that enforces single-draft editing.
 *
 * @param detectedIntent - The intent detected by the system
 * @returns Override result with final intent and any UI actions needed
 */
export function checkIntentOverride(
  detectedIntent: 'CREATE' | 'TRANSFORM' | 'EDIT_IN_PLACE'
): IntentOverrideResult {
  const state = _editorialState;

  // ============================================
  // Case 1: No active draft - allow anything
  // ============================================
  if (state.mode === 'NO_DRAFT' || state.mode === 'CREATE_NEW_DRAFT') {
    return {
      overridden: false,
      originalIntent: detectedIntent,
      finalIntent: detectedIntent,
      reason: null,
      showCreateWarning: false,
      blocked: false,
    };
  }

  // ============================================
  // Case 2: Edit locked - block all actions
  // ============================================
  if (state.mode === 'EDIT_LOCKED') {
    return {
      overridden: true,
      originalIntent: detectedIntent,
      finalIntent: 'EDIT_IN_PLACE',
      reason: 'Editing in progress',
      showCreateWarning: false,
      blocked: true,
    };
  }

  // ============================================
  // Case 3: DRAFT_ACTIVE - enforce EDIT_IN_PLACE
  // ============================================
  if (state.mode === 'DRAFT_ACTIVE') {
    // EDIT_IN_PLACE is always allowed
    if (detectedIntent === 'EDIT_IN_PLACE') {
      return {
        overridden: false,
        originalIntent: detectedIntent,
        finalIntent: 'EDIT_IN_PLACE',
        reason: null,
        showCreateWarning: false,
        blocked: false,
      };
    }

    // CREATE or TRANSFORM while editing - BLOCK and warn
    if (detectedIntent === 'CREATE' || detectedIntent === 'TRANSFORM') {
      const override: OverriddenIntent = {
        attemptedIntent: detectedIntent,
        enforcedIntent: 'EDIT_IN_PLACE',
        reason: 'Draft active - CREATE/TRANSFORM blocked',
        timestamp: Date.now(),
      };

      _editorialState = {
        ..._editorialState,
        lastOverriddenIntent: override,
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('[EditorialAuthority] Intent overridden:', {
          attempted: detectedIntent,
          enforced: 'EDIT_IN_PLACE',
        });
      }

      return {
        overridden: true,
        originalIntent: detectedIntent,
        finalIntent: 'EDIT_IN_PLACE',
        reason: `Đang chỉnh sửa bài chính. ${detectedIntent === 'CREATE' ? 'Tạo bài mới?' : 'Tạo phiên bản mới?'}`,
        showCreateWarning: true,
        blocked: true, // Block until user confirms
      };
    }
  }

  // Default: no override
  return {
    overridden: false,
    originalIntent: detectedIntent,
    finalIntent: detectedIntent,
    reason: null,
    showCreateWarning: false,
    blocked: false,
  };
}

/**
 * Handle user's response to create warning
 */
export function handleCreateConfirmation(confirmation: CreateConfirmation): void {
  switch (confirmation) {
    case 'CREATE_NEW':
      enterCreateMode();
      break;
    case 'CONTINUE_EDITING':
      markCreateWarningShown();
      break;
    case 'CANCEL':
      // Do nothing, just dismiss
      break;
  }
}

// ============================================
// Auto-activation Logic
// ============================================

/**
 * Check if a message should become the active draft.
 * Called when AI produces output and there's no active draft.
 *
 * @param messageId - The message ID to potentially activate
 * @param isAssistantMessage - Whether this is an assistant message
 * @returns true if the message was activated as draft
 */
export function maybeActivateDraft(messageId: string, isAssistantMessage: boolean): boolean {
  // Only activate assistant messages
  if (!isAssistantMessage) return false;

  // Only activate if no current draft
  if (hasActiveDraft()) return false;

  // Only activate if in CREATE mode or NO_DRAFT
  if (_editorialState.mode !== 'NO_DRAFT' && _editorialState.mode !== 'CREATE_NEW_DRAFT') {
    return false;
  }

  setActiveDraft(messageId);
  return true;
}

// ============================================
// UI Copy
// ============================================

export type Language = 'vi' | 'en';

/**
 * Get editorial mode label for UI
 */
export function getEditorialModeLabel(mode: EditorialMode, language: Language = 'vi'): string {
  const labels: Record<EditorialMode, { vi: string; en: string }> = {
    'DRAFT_ACTIVE': { vi: 'Đang chỉnh sửa bài chính', en: 'Editing main draft' },
    'EDIT_LOCKED': { vi: 'Đang xử lý...', en: 'Processing...' },
    'CREATE_NEW_DRAFT': { vi: 'Tạo bài mới', en: 'Creating new draft' },
    'NO_DRAFT': { vi: 'Chưa có bài', en: 'No draft yet' },
  };

  return labels[mode][language];
}

/**
 * Get create warning copy for UI
 */
export function getCreateWarningCopy(language: Language = 'vi'): {
  title: string;
  message: string;
  continueEditing: string;
  createNew: string;
  cancel: string;
} {
  if (language === 'vi') {
    return {
      title: 'Bạn đang chỉnh bài hiện tại',
      message: 'Bạn muốn tiếp tục chỉnh sửa bài này, hay tạo bài hoàn toàn mới?',
      continueEditing: 'Tiếp tục chỉnh sửa',
      createNew: 'Tạo bài mới',
      cancel: 'Hủy',
    };
  }

  return {
    title: 'You are editing the current draft',
    message: 'Do you want to continue editing this draft, or create a completely new one?',
    continueEditing: 'Continue editing',
    createNew: 'Create new',
    cancel: 'Cancel',
  };
}

/**
 * Get editorial badge text
 */
export function getEditorialBadgeCopy(language: Language = 'vi'): {
  editing: string;
  editCount: (count: number) => string;
} {
  if (language === 'vi') {
    return {
      editing: 'Đang chỉnh bài',
      editCount: (count) => `${count} lần chỉnh sửa`,
    };
  }

  return {
    editing: 'Editing draft',
    editCount: (count) => `${count} edits`,
  };
}

// ============================================
// Debug Helpers (DEV-only)
// ============================================

/**
 * Get editorial debug state for overlay
 */
export function getEditorialDebugState(): {
  mode: EditorialMode;
  activeDraftId: string | null;
  editCount: number;
  lastOverride: OverriddenIntent | null;
  activeDuration: number | null;
} {
  const state = _editorialState;

  return {
    mode: state.mode,
    activeDraftId: state.activeDraftId,
    editCount: state.editCount,
    lastOverride: state.lastOverriddenIntent,
    activeDuration: state.activeSince ? Date.now() - state.activeSince : null,
  };
}

/**
 * Get compact debug summary
 */
export function getEditorialDebugSummary(): string {
  const state = _editorialState;

  if (state.mode === 'NO_DRAFT') {
    return 'No draft';
  }

  const parts = [
    `Mode: ${state.mode}`,
    state.activeDraftId ? `Draft: ${state.activeDraftId.slice(0, 8)}` : '',
    `Edits: ${state.editCount}`,
  ].filter(Boolean);

  if (state.lastOverriddenIntent) {
    parts.push(`Override: ${state.lastOverriddenIntent.attemptedIntent}→EDIT`);
  }

  return parts.join(' | ');
}
