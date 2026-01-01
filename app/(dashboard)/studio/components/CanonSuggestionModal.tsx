'use client';

// ============================================
// STEP 15: Canon Suggestion Modal
// ============================================
// Shows when AI proposes changes to locked canon sections.
// User can approve, reject, or selectively accept changes.
//
// INVARIANTS:
// - Pure UI, no LLM calls
// - Uses local revert mechanism (reapplyLockedSections)
// - Non-blocking UX
// ============================================

import React, { useMemo } from 'react';
import {
  type CanonDiff,
  type CanonSection,
  getSectionLabel,
  getToneLabel,
  type ToneId,
} from '@/lib/studio/editorialCanon';

interface CanonSuggestionModalProps {
  /** The computed diff showing what changed */
  diff: CanonDiff;
  /** The new text proposed by AI */
  newText: string;
  /** Accept all changes (including locked sections) */
  onAcceptAll: () => void;
  /** Reject changes to locked sections (revert using reapplyLockedSections) */
  onRevertLocked: () => void;
  /** Cancel and dismiss modal */
  onCancel: () => void;
  /** Language for labels */
  language?: 'vi' | 'en';
}

/**
 * Section diff display component
 */
function SectionDiff({
  section,
  oldText,
  newText,
  language,
}: {
  section: CanonSection;
  oldText: string;
  newText: string;
  language: 'vi' | 'en';
}) {
  const label = getSectionLabel(section, language);

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          🔒 {label}
        </span>
        <span className="text-[10px] text-gray-500">
          {language === 'vi' ? 'đã bị thay đổi' : 'was changed'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="text-[10px] text-red-500 mb-1">
            {language === 'vi' ? 'Trước' : 'Before'}
          </div>
          <div className="text-gray-700 dark:text-gray-300 line-clamp-3">
            {oldText || <span className="italic text-gray-400">(trống)</span>}
          </div>
        </div>
        <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="text-[10px] text-green-600 mb-1">
            {language === 'vi' ? 'Sau' : 'After'}
          </div>
          <div className="text-gray-700 dark:text-gray-300 line-clamp-3">
            {newText || <span className="italic text-gray-400">(trống)</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Tone diff display component
 */
function ToneDiff({
  oldTone,
  newTone,
  language,
}: {
  oldTone: ToneId;
  newTone: ToneId;
  language: 'vi' | 'en';
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          🔒 {getSectionLabel('TONE', language)}
        </span>
        <span className="text-[10px] text-gray-500">
          {language === 'vi' ? 'đã bị thay đổi' : 'was changed'}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
          {getToneLabel(oldTone, language)}
        </span>
        <span className="text-gray-400">→</span>
        <span className="px-2 py-1 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
          {getToneLabel(newTone, language)}
        </span>
      </div>
    </div>
  );
}

/**
 * Modal for approving/rejecting canon changes.
 */
export function CanonSuggestionModal({
  diff,
  newText,
  onAcceptAll,
  onRevertLocked,
  onCancel,
  language = 'vi',
}: CanonSuggestionModalProps) {
  // Collect changed locked sections
  const changedLockedSections = useMemo(() => {
    const sections: Array<{
      section: CanonSection;
      oldText?: string;
      newText?: string;
      oldTone?: ToneId;
      newTone?: ToneId;
    }> = [];

    if (diff.diffsBySection.hook?.changed) {
      sections.push({
        section: 'HOOK',
        oldText: diff.diffsBySection.hook.oldText,
        newText: diff.diffsBySection.hook.newText,
      });
    }

    if (diff.diffsBySection.cta?.changed) {
      sections.push({
        section: 'CTA',
        oldText: diff.diffsBySection.cta.oldText,
        newText: diff.diffsBySection.cta.newText,
      });
    }

    if (diff.diffsBySection.tone?.changed) {
      sections.push({
        section: 'TONE',
        oldTone: diff.diffsBySection.tone.oldTone,
        newTone: diff.diffsBySection.tone.newTone,
      });
    }

    return sections;
  }, [diff]);

  const title = language === 'vi'
    ? 'AI đề xuất thay đổi phần đã khóa'
    : 'AI proposed changes to locked sections';

  const description = language === 'vi'
    ? 'Các phần sau đang được bảo vệ nhưng AI đã thay đổi:'
    : 'The following protected sections were changed:';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <span>⚠️</span>
            {title}
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {description}
          </p>
        </div>

        {/* Content */}
        <div className="px-4 py-3 max-h-[300px] overflow-y-auto">
          {changedLockedSections.map((item, idx) => (
            <div key={idx}>
              {item.section === 'TONE' && item.oldTone && item.newTone ? (
                <ToneDiff
                  oldTone={item.oldTone}
                  newTone={item.newTone}
                  language={language}
                />
              ) : item.oldText !== undefined && item.newText !== undefined ? (
                <SectionDiff
                  section={item.section}
                  oldText={item.oldText}
                  newText={item.newText}
                  language={language}
                />
              ) : null}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {language === 'vi' ? 'Hủy' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onRevertLocked}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded transition-colors"
          >
            {language === 'vi' ? 'Giữ nguyên phần khóa' : 'Keep locked sections'}
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            {language === 'vi' ? 'Chấp nhận tất cả' : 'Accept all'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CanonSuggestionModal;
