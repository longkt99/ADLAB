// ============================================
// Message Display Utilities
// ============================================
// Single source of truth for determining what text to display
// in user message bubbles.
//
// ============================================
// CONCEPTUAL INVARIANT (NON-NEGOTIABLE):
// ============================================
// displayedUserMessage === userTypedText
//
// ALWAYS.
// No exception.
// No fallback to actionLabel.
// No shortening.
// No summarizing.
//
// USER MESSAGE = what the user typed/clicked
// ACTION = internal intent only (never displayed as user content)
// ============================================

import type { ChatMessage } from '@/types/studio';

/**
 * Display mode for user messages
 * NOTE: This is for STYLING only, NOT for content selection
 */
export type UserMessageDisplayMode =
  | 'CREATE'           // Initial content creation
  | 'PURE_TRANSFORM'   // Button-only transform (user clicked, not typed)
  | 'DIRECTED_TRANSFORM'; // Transform with typed instruction

/**
 * Determine what text should be displayed in the user message bubble.
 *
 * ============================================
 * INVARIANT: displayedUserMessage === userTypedText
 * ============================================
 *
 * This function has ONE job: return what the user expressed.
 * - If they typed "viết lại giọng tự nhiên" → return that
 * - If they clicked "Viết lại" button → return "Viết lại"
 * - If they typed a CREATE prompt → return that
 *
 * NO FALLBACK TO actionLabel.
 * NO CONDITIONAL LOGIC BASED ON transformMode.
 * The userTypedText field must ALWAYS be populated at message creation time.
 *
 * @param message - The ChatMessage to get display text for
 * @returns The text to display in the user bubble (EXACTLY what user expressed)
 */
export function getDisplayedUserMessageText(message: ChatMessage): string {
  // Only applies to user messages
  if (message.role !== 'user') {
    return message.content;
  }

  const meta = message.meta;

  // ============================================
  // SINGLE SOURCE OF TRUTH: userTypedText
  // ============================================
  // If userTypedText exists, use it. Period.
  // This should ALWAYS be populated for user messages.
  if (meta?.userTypedText && meta.userTypedText.trim()) {
    return meta.userTypedText;
  }

  // ============================================
  // LEGACY COMPATIBILITY: userInstruction (deprecated name)
  // ============================================
  // TODO: Remove after migration complete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyInstruction = (meta as any)?.userInstruction;
  if (legacyInstruction && legacyInstruction.trim()) {
    return legacyInstruction;
  }

  // ============================================
  // FALLBACK: message.content (for legacy messages only)
  // ============================================
  // New messages should ALWAYS have userTypedText populated.
  // This fallback exists only for messages created before refactor.
  //
  // ✅ STEP 2 HARDENING: Log when fallback is triggered for debugging
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.warn('[getDisplayedUserMessageText] Missing userTypedText, falling back to content:', {
      messageId: message.id,
      hasActionLabel: !!meta?.actionLabel,
      actionLabel: meta?.actionLabel,
      contentPreview: message.content?.substring(0, 50),
    });
  }
  return message.content;
}

/**
 * Determine the display mode for a user message.
 * NOTE: This is for UI STYLING only, NOT for content selection.
 * The displayed text is ALWAYS userTypedText (via getDisplayedUserMessageText).
 *
 * @param message - The ChatMessage to analyze
 * @returns The display mode (for styling purposes only)
 */
export function getUserMessageDisplayMode(message: ChatMessage): UserMessageDisplayMode {
  const meta = message.meta;

  if (!meta || !meta.sourceMessageId) {
    return 'CREATE';
  }

  if (meta.transformMode === 'DIRECTED_TRANSFORM') {
    return 'DIRECTED_TRANSFORM';
  }

  if (meta.transformMode === 'PURE_TRANSFORM') {
    return 'PURE_TRANSFORM';
  }

  // Legacy: has sourceMessageId but no transformMode
  // Check userTypedText to determine mode
  if (meta.userTypedText && meta.actionLabel && meta.userTypedText !== meta.actionLabel) {
    return 'DIRECTED_TRANSFORM';
  }

  return 'PURE_TRANSFORM';
}

/**
 * Check if a message is a transform (has a source message)
 */
export function isTransformMessage(message: ChatMessage): boolean {
  return message.role === 'user' && !!message.meta?.sourceMessageId;
}

/**
 * Get the action label for a transform message
 */
export function getTransformActionLabel(message: ChatMessage): string | null {
  if (!isTransformMessage(message)) {
    return null;
  }
  return message.meta?.actionLabel || null;
}
