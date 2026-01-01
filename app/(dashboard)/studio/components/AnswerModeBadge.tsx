'use client';

// ============================================
// STEP 22: Answer Mode Badge
// ============================================
// Lightweight badge near the composer/input showing:
// - Current Answer Engine task type (QA/PATCH/REWRITE/CREATE)
// - Visual indicator for detected mode
//
// INVARIANTS:
// - Pure UI, no LLM calls
// - Uses existing i18n helper
// - Minimal, calm styling
// ============================================

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import type { AnswerTaskType } from '@/lib/studio/answerEngine';

// ============================================
// Types
// ============================================

interface AnswerModeBadgeProps {
  /** The detected task type */
  taskType: AnswerTaskType | null;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

// ============================================
// Helper Functions
// ============================================

function getTaskTypeIcon(taskType: AnswerTaskType): string {
  const icons: Record<AnswerTaskType, string> = {
    QA: '❓',
    EDIT_PATCH: '✏️',
    REWRITE_UPGRADE: '🔄',
    CREATE: '✨',
  };
  return icons[taskType];
}

function getTaskTypeColor(taskType: AnswerTaskType): string {
  const colors: Record<AnswerTaskType, string> = {
    QA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    EDIT_PATCH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    REWRITE_UPGRADE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  };
  return colors[taskType];
}

function getTaskTypeLabel(taskType: AnswerTaskType, lang: 'vi' | 'en'): string {
  const labels: Record<AnswerTaskType, { vi: string; en: string }> = {
    QA: { vi: 'QA', en: 'QA' },
    EDIT_PATCH: { vi: 'Chỉnh nhỏ', en: 'Patch' },
    REWRITE_UPGRADE: { vi: 'Viết lại', en: 'Rewrite' },
    CREATE: { vi: 'Tạo mới', en: 'Create' },
  };
  return labels[taskType][lang];
}

function getTaskTypeDescription(taskType: AnswerTaskType, lang: 'vi' | 'en'): string {
  const descriptions: Record<AnswerTaskType, { vi: string; en: string }> = {
    QA: { vi: 'Trả lời câu hỏi', en: 'Answer question' },
    EDIT_PATCH: { vi: 'Chỉnh sửa phần cụ thể', en: 'Edit specific section' },
    REWRITE_UPGRADE: { vi: 'Viết lại, nâng cấp toàn bài', en: 'Rewrite and upgrade content' },
    CREATE: { vi: 'Tạo nội dung mới', en: 'Create new content' },
  };
  return descriptions[taskType][lang];
}

// ============================================
// Component
// ============================================

export function AnswerModeBadge({
  taskType,
  compact = false,
  className = '',
}: AnswerModeBadgeProps) {
  const { language } = useTranslation();
  const lang = language as 'vi' | 'en';

  // Don't render if no task type
  if (!taskType) {
    return null;
  }

  const icon = getTaskTypeIcon(taskType);
  const color = getTaskTypeColor(taskType);
  const label = getTaskTypeLabel(taskType, lang);
  const description = getTaskTypeDescription(taskType, lang);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${color} ${className}`}
        title={description}
      >
        {icon} {label}
      </span>
    );
  }

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-2 py-1 rounded-lg
        bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700
        ${className}
      `}
    >
      <span
        className={`px-1.5 py-0.5 rounded text-xs font-medium ${color}`}
      >
        {icon} {label}
      </span>
      <span className="text-[10px] text-gray-500 dark:text-gray-400">
        {description}
      </span>
    </div>
  );
}

export default AnswerModeBadge;
