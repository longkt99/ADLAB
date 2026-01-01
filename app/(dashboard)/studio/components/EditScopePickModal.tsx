'use client';

// ============================================
// STEP 19: Edit Scope Pick Modal
// ============================================
// Modal that appears when requiresUserPick = true.
// User must choose which section to edit before LLM call proceeds.
//
// INVARIANTS:
// - Pure UI, no LLM calls
// - Blocks execution until user picks
// - Uses existing Tailwind styling patterns
// - Respects STEP 18 request binding
// ============================================

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import type {
  EditTarget,
  EditScopeContract,
  ScopeGate,
} from '@/lib/studio/editScopeContract';
import { getEditTargetLabel } from '@/lib/studio/editScopeContract';

// ============================================
// Types
// ============================================

interface EditScopePickModalProps {
  /** Whether modal is open */
  open: boolean;
  /** The scope gate that triggered this modal */
  gate: ScopeGate | null;
  /** The instruction text being processed */
  instructionPreview?: string;
  /** Called when user picks a target */
  onPick: (target: EditTarget) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

// ============================================
// Target Button Component
// ============================================

interface TargetButtonProps {
  target: EditTarget;
  icon: string;
  description: { vi: string; en: string };
  lang: 'vi' | 'en';
  onClick: () => void;
}

function TargetButton({ target, icon, description, lang, onClick }: TargetButtonProps) {
  const label = getEditTargetLabel(target, lang);

  const colors: Record<EditTarget, string> = {
    HOOK: 'hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20 dark:hover:border-blue-700',
    BODY: 'hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-900/20 dark:hover:border-green-700',
    CTA: 'hover:bg-orange-50 hover:border-orange-300 dark:hover:bg-orange-900/20 dark:hover:border-orange-700',
    TONE: 'hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-900/20 dark:hover:border-purple-700',
    FULL: 'hover:bg-gray-100 hover:border-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-500',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-3 w-full p-3 rounded-lg
        border border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-800
        transition-colors
        ${colors[target]}
      `}
    >
      <span className="text-2xl">{icon}</span>
      <div className="text-left">
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {label}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {description[lang]}
        </div>
      </div>
    </button>
  );
}

// ============================================
// Main Component
// ============================================

export function EditScopePickModal({
  open,
  gate,
  instructionPreview,
  onPick,
  onCancel,
}: EditScopePickModalProps) {
  const { language } = useTranslation();
  const lang = language as 'vi' | 'en';

  if (!open || !gate) {
    return null;
  }

  const title = lang === 'vi'
    ? 'Bạn muốn chỉnh phần nào?'
    : 'Which section do you want to edit?';

  const subtitle = lang === 'vi'
    ? 'Chọn phạm vi để AI chỉnh sửa chính xác hơn'
    : 'Choose scope for more precise AI editing';

  const cancelLabel = lang === 'vi' ? 'Hủy' : 'Cancel';

  const targets: Array<{
    target: EditTarget;
    icon: string;
    description: { vi: string; en: string };
  }> = [
    {
      target: 'HOOK',
      icon: '🎣',
      description: {
        vi: 'Chỉ chỉnh phần mở bài, giữ nguyên body và CTA',
        en: 'Edit only the opening, keep body and CTA',
      },
    },
    {
      target: 'BODY',
      icon: '📝',
      description: {
        vi: 'Chỉ chỉnh thân bài, giữ nguyên hook và CTA',
        en: 'Edit only the body, keep hook and CTA',
      },
    },
    {
      target: 'CTA',
      icon: '📢',
      description: {
        vi: 'Chỉ chỉnh lời kêu gọi, giữ nguyên hook và body',
        en: 'Edit only the call-to-action, keep hook and body',
      },
    },
    {
      target: 'TONE',
      icon: '🎭',
      description: {
        vi: 'Chỉ điều chỉnh giọng văn, giữ nguyên nội dung',
        en: 'Adjust tone/style only, keep content unchanged',
      },
    },
    {
      target: 'FULL',
      icon: '📄',
      description: {
        vi: 'Chỉnh toàn bộ bài viết',
        en: 'Edit the entire post',
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <span>🎯</span>
            {title}
          </h3>
          <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Instruction preview */}
        {instructionPreview && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
              {lang === 'vi' ? 'Lệnh của bạn:' : 'Your instruction:'}
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
              "{instructionPreview}"
            </div>
          </div>
        )}

        {/* Target options */}
        <div className="px-4 py-3 space-y-2 max-h-[400px] overflow-y-auto">
          {targets.map(({ target, icon, description }) => (
            <TargetButton
              key={target}
              target={target}
              icon={icon}
              description={description}
              lang={lang}
              onClick={() => onPick(target)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {cancelLabel}
            </button>
            <div className="text-[10px] text-gray-400">
              {lang === 'vi'
                ? 'Tip: Lệnh cụ thể như "đổi hook" sẽ không cần chọn'
                : 'Tip: Specific commands like "edit hook" won\'t require picking'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditScopePickModal;
