'use client';

// ============================================
// Diff & Apply Panel
// ============================================
// Shows before/after comparison and allows selective
// section-level application of transform results.
//
// INVARIANTS PRESERVED:
// - No LLM calls (apply is pure client-side state update)
// - No new fetch sites
// - Works with existing message state
// ============================================

import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import type { ChatMessage } from '@/types/studio';
import type { ApplyMode } from '@/lib/studio/applySections';

interface DiffApplyPanelProps {
  message: ChatMessage;
  onApply: (mode: ApplyMode) => void;
  onUndo: () => void;
}

type TabType = 'compare' | 'apply';

/**
 * Diff & Apply Panel - Shows under transform result messages
 * Allows viewing before/after and applying sections selectively
 */
export default function DiffApplyPanel({
  message,
  onApply,
  onUndo,
}: DiffApplyPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('apply');
  const [isExpanded, setIsExpanded] = useState(false);

  // Get diffApply metadata
  const diffApply = message.meta?.diffApply;

  // Don't render if no diffApply metadata
  if (!diffApply) {
    return null;
  }

  const {
    beforeText,
    afterText,
    beforeSections,
    afterSections,
    applyState,
    appliedMode,
  } = diffApply;

  // Calculate available sections from afterSections
  const availableSections = useMemo(() => {
    const sections: { key: ApplyMode; label: string; charCount: number }[] = [];

    if (afterSections?.hook?.trim()) {
      sections.push({
        key: 'hook',
        label: 'Hook',
        charCount: afterSections.hook.trim().length,
      });
    }
    if (afterSections?.body?.trim()) {
      sections.push({
        key: 'body',
        label: 'Body',
        charCount: afterSections.body.trim().length,
      });
    }
    if (afterSections?.cta?.trim()) {
      sections.push({
        key: 'cta',
        label: 'CTA',
        charCount: afterSections.cta.trim().length,
      });
    }
    if (afterSections?.hashtags?.trim()) {
      sections.push({
        key: 'hashtags',
        label: 'Hashtags',
        charCount: afterSections.hashtags.trim().length,
      });
    }

    return sections;
  }, [afterSections]);

  // Check if source has sections (for partial apply eligibility)
  const sourceHasSections = useMemo(() => {
    return !!(
      beforeSections?.hook?.trim() ||
      beforeSections?.body?.trim() ||
      beforeSections?.cta?.trim() ||
      beforeSections?.hashtags?.trim()
    );
  }, [beforeSections]);

  // Handle apply action
  const handleApply = useCallback(
    (mode: ApplyMode) => {
      onApply(mode);
    },
    [onApply]
  );

  // Handle undo action
  const handleUndo = useCallback(() => {
    onUndo();
  }, [onUndo]);

  // Status indicator
  const getStatusBadge = () => {
    if (applyState === 'applied') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {appliedMode === 'all' ? 'Đã áp dụng tất cả' : `Đã áp dụng ${appliedMode}`}
        </span>
      );
    }
    if (applyState === 'reverted') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Đã hoàn tác
        </span>
      );
    }
    return null;
  };

  return (
    <div className="mt-3 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Diff & Apply
          </span>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-2">
          {availableSections.length > 0 && (
            <span className="text-[10px] text-zinc-400">
              {availableSections.length} section{availableSections.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-700">
          {/* Tabs */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setActiveTab('compare')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'compare'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              So sánh
            </button>
            <button
              onClick={() => setActiveTab('apply')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'apply'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Áp dụng
            </button>
          </div>

          {/* Tab content */}
          <div className="p-3">
            {activeTab === 'compare' && (
              <CompareTab beforeText={beforeText} afterText={afterText} />
            )}

            {activeTab === 'apply' && (
              <ApplyTab
                availableSections={availableSections}
                sourceHasSections={sourceHasSections}
                applyState={applyState}
                onApply={handleApply}
                onUndo={handleUndo}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Compare Tab - Side-by-side before/after
// ============================================

interface CompareTabProps {
  beforeText: string;
  afterText: string;
}

function CompareTab({ beforeText, afterText }: CompareTabProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Before */}
      <div className="space-y-1">
        <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
          Trước
        </div>
        <div className="max-h-48 overflow-auto p-2 rounded bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
          <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
            {beforeText || '(Trống)'}
          </pre>
        </div>
      </div>

      {/* After */}
      <div className="space-y-1">
        <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
          Sau
        </div>
        <div className="max-h-48 overflow-auto p-2 rounded bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30">
          <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
            {afterText || '(Trống)'}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Apply Tab - Section-level apply buttons
// ============================================

interface ApplyTabProps {
  availableSections: { key: ApplyMode; label: string; charCount: number }[];
  sourceHasSections: boolean;
  applyState: 'idle' | 'applied' | 'reverted';
  onApply: (mode: ApplyMode) => void;
  onUndo: () => void;
}

function ApplyTab({
  availableSections,
  sourceHasSections,
  applyState,
  onApply,
  onUndo,
}: ApplyTabProps) {
  const isApplied = applyState === 'applied';

  return (
    <div className="space-y-3">
      {/* Apply All button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onApply('all')}
          disabled={isApplied}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
            isApplied
              ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
          }`}
        >
          Áp dụng tất cả
        </button>

        {isApplied && (
          <button
            onClick={onUndo}
            className="px-3 py-2 text-xs font-medium rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors"
          >
            Hoàn tác
          </button>
        )}
      </div>

      {/* Section-level buttons (only if source has sections) */}
      {sourceHasSections && availableSections.length > 0 && (
        <>
          <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            Áp dụng từng phần
          </div>
          <div className="grid grid-cols-2 gap-2">
            {availableSections.map((section) => (
              <button
                key={section.key}
                onClick={() => onApply(section.key)}
                disabled={isApplied}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-md border transition-colors ${
                  isApplied
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                <span className="font-medium">{section.label}</span>
                <span className="text-[10px] text-zinc-400">
                  {section.charCount} ký tự
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Info message if source has no sections */}
      {!sourceHasSections && availableSections.length > 0 && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-md p-2">
          Nội dung gốc không có section (Hook/Body/CTA). Chỉ có thể áp dụng tất cả.
        </div>
      )}

      {/* Info message if AI result has no sections */}
      {availableSections.length === 0 && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-md p-2">
          Kết quả AI không có section rõ ràng. Sử dụng "Áp dụng tất cả" để thay thế toàn bộ.
        </div>
      )}
    </div>
  );
}
