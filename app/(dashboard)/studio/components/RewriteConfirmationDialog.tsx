'use client';

// ============================================
// STEP 27: Rewrite Intent Confirmation Dialog
// ============================================
// User intent confirmation for REWRITE_UPGRADE mode.
// Shows BEFORE any LLM call to clarify user expectation.
//
// INVARIANTS:
// - Pure UI, no LLM calls
// - No persistence beyond session
// - No changes to detection logic
// - No changes to guards or thresholds
// ============================================

import React from 'react';
import { Icon } from '@/components/ui/Icon';

// ============================================
// Types
// ============================================

export interface RewriteConfirmationDialogProps {
  /** Language for UI copy */
  language: 'vi' | 'en';
  /** Handler when user confirms rewrite */
  onConfirmRewrite: () => void;
  /** Handler when user wants to create new instead */
  onCreateNew: () => void;
  /** Handler to cancel/dismiss */
  onCancel: () => void;
}

// ============================================
// Copy Constants (STEP 28: UX Expectation Locking)
// ============================================
// These copy strings are locked. Changes require snapshot test update.
// Goal: User clearly understands REWRITE = improve current post only.

// STEP 6: Language implies safety and reversibility
export const DIALOG_COPY = {
  vi: {
    title: 'Đang chỉnh bài này',
    subtitle: 'Cải thiện câu chữ, giữ nguyên ý',
    description: 'Ý chính và cấu trúc vẫn được giữ.',
    notExpect: 'Giữ nguyên:',
    bullet1: 'Chủ đề và góc nhìn',
    bullet2: 'Hook và CTA',
    bullet3: 'Độ dài và cấu trúc',
    hint: 'Bạn cũng có thể tạo bài mới nếu muốn.',
    confirmRewrite: 'Cải thiện câu chữ',
    createNew: 'Tạo bài mới',
    cancel: 'Quay lại',
  },
  en: {
    title: 'Editing this post',
    subtitle: 'Improving wording, keeping the idea',
    description: 'Main idea and structure will be kept.',
    notExpect: 'Keeping:',
    bullet1: 'Topic and angle',
    bullet2: 'Hook and CTA',
    bullet3: 'Length and structure',
    hint: 'You can also create a new post if you prefer.',
    confirmRewrite: 'Improve wording',
    createNew: 'Create new',
    cancel: 'Go back',
  },
} as const;

// ============================================
// Component
// ============================================

export function RewriteConfirmationDialog({
  language,
  onConfirmRewrite,
  onCreateNew,
  onCancel,
}: RewriteConfirmationDialogProps) {
  const copy = DIALOG_COPY[language];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-card rounded-2xl shadow-lg border border-zinc-200/80 dark:border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* STEP 2.5: Header - tighter, scannable in <0.3s */}
        <div className="px-5 pt-5 pb-2">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-secondary flex items-center justify-center flex-shrink-0">
              <Icon name="edit" size={16} className="text-zinc-500 dark:text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              {/* Title: decisive, scannable */}
              <h3 className="text-[15px] font-semibold text-zinc-800 dark:text-foreground leading-tight">
                {copy.title}
              </h3>
              {/* Subtitle: calm secondary */}
              <p className="text-[13px] text-zinc-500 dark:text-muted-foreground mt-1">
                {copy.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* STEP 2.5: Content - tighter vertical rhythm */}
        <div className="px-5 py-4 space-y-3">
          {/* Main description - calm, informative */}
          <p className="text-[13px] text-zinc-600 dark:text-foreground/80 leading-relaxed">
            {copy.description}
          </p>

          {/* What system will NOT do - calm visual */}
          <div className="bg-zinc-50 dark:bg-secondary/50 rounded-xl px-3.5 py-3">
            <p className="text-[11px] text-zinc-500 dark:text-muted-foreground font-medium mb-2">
              {copy.notExpect}
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2.5 text-[12px] text-zinc-500 dark:text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-muted-foreground/50" />
                {copy.bullet1}
              </li>
              <li className="flex items-center gap-2.5 text-[12px] text-zinc-500 dark:text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-muted-foreground/50" />
                {copy.bullet2}
              </li>
              <li className="flex items-center gap-2.5 text-[12px] text-zinc-500 dark:text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-muted-foreground/50" />
                {copy.bullet3}
              </li>
            </ul>
          </div>

          {/* Hint - subtle guidance */}
          <p className="text-[11px] text-zinc-400 dark:text-muted-foreground">
            {copy.hint}
          </p>
        </div>

        {/* STEP 6: Actions - calm, nothing feels final */}
        <div className="px-5 py-4 border-t border-zinc-100 dark:border-border space-y-2.5">
          {/* Primary: Go back - safe default, softer visual weight */}
          <button
            type="button"
            onClick={onCancel}
            className="w-full px-4 py-2.5 text-[13px] text-white bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-800 hover:bg-zinc-600 dark:hover:bg-zinc-300 rounded-xl transition-colors"
          >
            {copy.cancel}
          </button>

          {/* Secondary options row - reduced visual weight */}
          <div className="flex gap-2">
            {/* Confirm Rewrite - secondary */}
            <button
              type="button"
              onClick={onConfirmRewrite}
              className="flex-1 px-3 py-2.5 text-[12px] font-medium text-zinc-600 dark:text-foreground bg-zinc-100 dark:bg-secondary hover:bg-zinc-200 dark:hover:bg-secondary/80 rounded-xl transition-colors"
            >
              {copy.confirmRewrite}
            </button>

            {/* Create New - tertiary (quietest) */}
            <button
              type="button"
              onClick={onCreateNew}
              className="flex-1 px-3 py-2.5 text-[12px] font-medium text-zinc-400 dark:text-muted-foreground hover:text-zinc-600 dark:hover:text-foreground hover:bg-zinc-50 dark:hover:bg-secondary/60 rounded-xl transition-colors"
            >
              {copy.createNew}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RewriteConfirmationDialog;
