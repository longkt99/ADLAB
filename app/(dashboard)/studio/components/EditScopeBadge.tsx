'use client';

// ============================================
// STEP 19: Edit Scope Badge
// ============================================
// Lightweight badge near the composer/input showing:
// - Current edit target (HOOK/BODY/CTA/TONE/FULL)
// - Locked sections summary
// - Confidence indicator if LOW
//
// INVARIANTS:
// - Pure UI, no LLM calls
// - Uses existing i18n helper
// - Minimal, calm styling
// ============================================

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import type { EditScopeContract, EditTarget, CanonSection } from '@/lib/studio/editScopeContract';

// ============================================
// Types
// ============================================

interface EditScopeBadgeProps {
  /** The active edit scope contract */
  contract: EditScopeContract | null;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

// ============================================
// Helper Functions
// ============================================

function getTargetIcon(target: EditTarget): string {
  const icons: Record<EditTarget, string> = {
    HOOK: '🎣',
    BODY: '📝',
    CTA: '📢',
    TONE: '🎭',
    FULL: '📄',
  };
  return icons[target];
}

function getTargetColor(target: EditTarget): string {
  const colors: Record<EditTarget, string> = {
    HOOK: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    BODY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    CTA: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    TONE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    FULL: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };
  return colors[target];
}

// ============================================
// Component
// ============================================

export function EditScopeBadge({
  contract,
  compact = false,
  className = '',
}: EditScopeBadgeProps) {
  const { language } = useTranslation();
  const lang = language as 'vi' | 'en';

  // Don't render if no contract
  if (!contract) {
    return null;
  }

  const targetLabels: Record<EditTarget, { vi: string; en: string }> = {
    HOOK: { vi: 'Hook', en: 'Hook' },
    BODY: { vi: 'Thân bài', en: 'Body' },
    CTA: { vi: 'CTA', en: 'CTA' },
    TONE: { vi: 'Tone', en: 'Tone' },
    FULL: { vi: 'Toàn bài', en: 'Full' },
  };

  const sectionLabels: Record<CanonSection, { vi: string; en: string }> = {
    HOOK: { vi: 'Hook', en: 'Hook' },
    BODY: { vi: 'Body', en: 'Body' },
    CTA: { vi: 'CTA', en: 'CTA' },
  };

  const editingLabel = lang === 'vi' ? 'Đang chỉnh:' : 'Editing:';
  const lockedLabel = lang === 'vi' ? 'Khóa:' : 'Locked:';
  const needsPickLabel = lang === 'vi' ? '(cần chọn)' : '(pick scope)';

  const targetColor = getTargetColor(contract.target);
  const targetIcon = getTargetIcon(contract.target);
  const targetText = targetLabels[contract.target][lang];

  const lockedNames = contract.lockedSections
    .map(s => sectionLabels[s][lang])
    .join(', ');

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${targetColor}`}
          title={`${editingLabel} ${targetText}`}
        >
          {targetIcon} {targetText}
        </span>
        {contract.lockedSections.length > 0 && (
          <span
            className="text-[10px] text-gray-400 dark:text-gray-500"
            title={`${lockedLabel} ${lockedNames}`}
          >
            🔒{contract.lockedSections.length}
          </span>
        )}
        {contract.confidence === 'LOW' && (
          <span className="text-[10px] text-amber-500">⚠</span>
        )}
      </div>
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
      {/* Target badge */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          {editingLabel}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-xs font-medium ${targetColor}`}
        >
          {targetIcon} {targetText}
        </span>
      </div>

      {/* Locked sections */}
      {contract.lockedSections.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          <span>🔒</span>
          <span>{lockedNames}</span>
        </div>
      )}

      {/* Confidence indicator */}
      {contract.confidence === 'LOW' && (
        <span className="text-[10px] text-amber-500 font-medium">
          {needsPickLabel}
        </span>
      )}
    </div>
  );
}

export default EditScopeBadge;
