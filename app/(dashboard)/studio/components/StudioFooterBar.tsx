'use client';

// ============================================
// StudioFooterBar - Primary Selection Footer
// ============================================
// Shows current Primary selection status and commit action.
// Sticky footer bar with minimal height.
//
// FEATURE A REQUIREMENTS:
// - Show "Đang chọn: Bản #N" when Primary is selected
// - Show "Tạo bài viết từ bản này" CTA button
// - Disabled state when no Primary selected
// - Clear feedback on success/error via toast
// ============================================

import { useStudio } from '@/lib/studio/studioContext';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';
// STEP 5: Soft Preference Memory - Workflow Pattern Recognition
import { recordSessionAction } from '@/lib/studio/preferenceMemory';

export default function StudioFooterBar() {
  const {
    messages,
    chatInput,
    primaryMessageId,
    commitLoading,
    createPostFromPrimary,
    saveSession,
    saveSessionLoading,
    studioToast,
    dismissStudioToast,
  } = useStudio();

  // Get assistant messages only (outputs)
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  // Find Primary index (1-indexed for display)
  const primaryIndex = primaryMessageId
    ? assistantMessages.findIndex(m => m.id === primaryMessageId) + 1
    : 0;

  const hasPrimary = primaryMessageId !== null && primaryIndex > 0;

  // STEP 5: Record workflow pattern when user commits to post
  const handleCommit = async () => {
    if (!hasPrimary || commitLoading) return;
    await createPostFromPrimary();
    // Record 'create' action for workflow pattern inference
    recordSessionAction('create');
  };

  // STEP 5: Record workflow pattern when user saves session
  const handleSaveSession = async () => {
    if (saveSessionLoading) return;
    await saveSession();
    // Record 'save' action for workflow pattern inference
    recordSessionAction('save');
  };

  // Check if session has any content worth saving
  const hasContent = messages.length > 0 || chatInput.trim().length > 0;

  // STEP 4.5: Track user confidence - after any successful action, reduce guidance
  const hasMultipleResults = assistantMessages.length > 1;
  const isUserTyping = chatInput.trim().length > 0;

  // Don't show footer if no content at all
  if (!hasContent) {
    return null;
  }

  return (
    <>
      {/* STEP 4.5: Toast - minimal, confirms then fades */}
      {studioToast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4"
          style={{ animation: 'fadeIn var(--motion-base) var(--ease-out-premium)' }}
        >
          <div
            className={`
              flex items-center gap-2.5 px-3.5 py-3 rounded-xl shadow-sm border
              ${studioToast.type === 'success'
                ? 'bg-card border-zinc-200/60 dark:border-zinc-700/50'
                : studioToast.type === 'error'
                ? 'bg-card border-zinc-200/60 dark:border-destructive/40'
                : 'bg-card border-zinc-200/60 dark:border-border'
              }
            `}
          >
            <Icon
              name={studioToast.type === 'success' ? 'check' : studioToast.type === 'error' ? 'info' : 'info'}
              size={14}
              className={
                studioToast.type === 'success'
                  ? 'text-zinc-400 dark:text-zinc-500'
                  : studioToast.type === 'error'
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-zinc-400 dark:text-zinc-500'
              }
            />
            <div className="flex-1 min-w-0">
              {/* STEP 6: Neutral toast - no follow-up, silence after confirmation */}
              <span className="text-[13px] text-zinc-600 dark:text-zinc-300">
                {studioToast.message}
              </span>
            </div>
            {studioToast.action && (
              studioToast.action.href ? (
                <Link
                  href={studioToast.action.href}
                  className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 hover:underline underline-offset-2"
                >
                  {studioToast.action.label}
                </Link>
              ) : (
                <button
                  onClick={studioToast.action.onClick}
                  className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 hover:underline underline-offset-2"
                >
                  {studioToast.action.label}
                </button>
              )
            )}
            <button
              onClick={dismissStudioToast}
              className="p-1 -mr-0.5 text-zinc-300 dark:text-zinc-600 hover:text-zinc-400 dark:hover:text-zinc-400 transition-colors"
              aria-label="Đóng"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4.5: Footer bar - toolbelt feel, not narrator */}
      <div className="sticky bottom-0 left-0 right-0 z-40 bg-card border-t border-border/80">
        <div className="mx-auto max-w-4xl px-3 sm:px-6 py-2 sm:py-2.5">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* STEP 4.5: Left - Minimal status, hide guidance after confidence */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              {hasPrimary ? (
                <>
                  {/* Compact badge only */}
                  <span className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-foreground">
                    <Icon name="check" size={12} className="text-zinc-400 dark:text-zinc-500 sm:w-3.5 sm:h-3.5" />
                    <span className="px-1.5 py-0.5 bg-secondary/80 rounded text-[11px] sm:text-xs font-medium">
                      Bản #{primaryIndex}
                    </span>
                  </span>
                  {/* STEP 4.5: Hide helper text after multiple results or typing */}
                  {!hasMultipleResults && !isUserTyping && (
                    <span className="hidden sm:inline text-[10px] text-zinc-400 dark:text-zinc-500">
                      — sẵn sàng
                    </span>
                  )}
                </>
              ) : (
                /* STEP 4.5: Reduced contrast guidance */
                <span className="text-[10px] sm:text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-1">
                  {hasMultipleResults ? '' : 'Chọn một bản'}
                </span>
              )}
            </div>

            {/* STEP 4: Right - Actions with refined hierarchy */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Secondary: Save session - quieter visual weight */}
              <button
                onClick={handleSaveSession}
                disabled={saveSessionLoading}
                title="Lưu lại để dùng sau"
                className={`
                  flex items-center justify-center gap-1.5 sm:gap-2 p-2 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm
                  transition-colors duration-150
                  ${saveSessionLoading
                    ? 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                  }
                `}
              >
                {saveSessionLoading ? (
                  <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="bookmark" size={14} />
                )}
                <span className="hidden sm:inline font-medium">Lưu</span>
              </button>

              {/* STEP 6: Primary action - present but not dominant, feels safe */}
              <button
                onClick={handleCommit}
                disabled={!hasPrimary || commitLoading}
                className={`
                  flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm
                  transition-colors duration-150
                  ${hasPrimary && !commitLoading
                    ? 'bg-zinc-700 dark:bg-zinc-200 text-white dark:text-zinc-800 hover:bg-zinc-600 dark:hover:bg-zinc-300'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                  }
                `}
              >
                {commitLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="hidden sm:inline">Đang tạo…</span>
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={14} />
                    <span className="sm:hidden">Tạo bài</span>
                    <span className="hidden sm:inline">Tạo bài viết</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
