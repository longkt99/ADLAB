'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { computeWordDiff, mergeConsecutiveTokens, getChangedTokensWithContext, type DiffToken } from '@/lib/quality/diffUtils';
import type { SimilarityResult } from '@/lib/quality/similarityCheck';
import { useAutoFixOnboarding } from '@/lib/studio/useAutoFixOnboarding';

// ============================================
// Types
// ============================================

export interface DiffPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalContent: string;
  refinedContent: string;
  similarity: SimilarityResult;
  attempts: number;
  usedFallback: boolean;
  onApply: () => void;
  onKeepOriginal: () => void;
}

type TabId = 'compare' | 'new' | 'original';

// ============================================
// Similarity Badge Component
// ============================================

function SimilarityBadge({ score }: { score: number }) {
  const percentage = Math.round(score * 100);

  let label: string;
  let colorClass: string;

  if (percentage >= 85) {
    label = 'Rất gần bản gốc';
    colorClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  } else if (percentage >= 70) {
    label = 'Gần bản gốc';
    colorClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  } else {
    label = 'Khá khác (nên xem kỹ)';
    colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {label} ({percentage}%)
    </span>
  );
}

// ============================================
// Diff View Component
// ============================================

function DiffView({
  tokens,
  showOnlyChanges,
}: {
  tokens: DiffToken[];
  showOnlyChanges: boolean;
}) {
  const displayTokens = useMemo(() => {
    const merged = mergeConsecutiveTokens(tokens);
    return showOnlyChanges ? getChangedTokensWithContext(merged, 3) : merged;
  }, [tokens, showOnlyChanges]);

  if (displayTokens.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-sm italic">
        Không có thay đổi nào.
      </p>
    );
  }

  return (
    <div className="font-sans text-sm leading-relaxed whitespace-pre-wrap">
      {displayTokens.map((token, i) => {
        if (token.type === 'unchanged') {
          return <span key={i}>{token.text}</span>;
        }
        if (token.type === 'added') {
          return (
            <span
              key={i}
              className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 rounded-sm px-0.5"
            >
              {token.text}
            </span>
          );
        }
        if (token.type === 'removed') {
          return (
            <span
              key={i}
              className="bg-red-100/60 dark:bg-red-900/30 text-red-600 dark:text-red-300 line-through opacity-70 rounded-sm px-0.5"
            >
              {token.text}
            </span>
          );
        }
        return <span key={i}>{token.text}</span>;
      })}
    </div>
  );
}

// ============================================
// Main Modal Component
// ============================================

export default function DiffPreviewModal({
  isOpen,
  onClose,
  originalContent,
  refinedContent,
  similarity,
  attempts,
  usedFallback,
  onApply,
  onKeepOriginal,
}: DiffPreviewModalProps) {
  // Tab state - default to 'original' if fallback was used
  const [activeTab, setActiveTab] = useState<TabId>(usedFallback ? 'original' : 'compare');
  // Toggle for showing only changes
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  // Copy success state
  const [copySuccess, setCopySuccess] = useState(false);
  // Onboarding state
  const { showPreviewIntro, markPreviewIntroSeen } = useAutoFixOnboarding();

  // Compute diff
  const diffResult = useMemo(() => {
    return computeWordDiff(originalContent, refinedContent);
  }, [originalContent, refinedContent]);

  // Handle copy refined content
  const handleCopyRefined = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(refinedContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [refinedContent]);

  // Handle apply
  const handleApply = useCallback(() => {
    onApply();
    onClose();
  }, [onApply, onClose]);

  // Handle keep original
  const handleKeepOriginal = useCallback(() => {
    onKeepOriginal();
    onClose();
  }, [onKeepOriginal, onClose]);

  if (!isOpen) return null;

  // Check if there are actual changes
  const hasChanges = originalContent !== refinedContent;
  const canApply = hasChanges && !usedFallback;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Xem trước điều chỉnh
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Chỉ chỉnh những điểm cần thiết — bạn luôn có thể giữ bản gốc.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          {/* Summary badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SimilarityBadge score={similarity.score} />
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {attempts} lần thử
            </span>
            {usedFallback && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Giữ bản gốc (an toàn)
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'compare'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              So sánh
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'new'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Bản mới
            </button>
            <button
              onClick={() => setActiveTab('original')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'original'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Bản gốc
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* First-time intro banner - whisper style */}
          {showPreviewIntro && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg flex items-start gap-3">
              <span className="text-gray-400 dark:text-gray-500 mt-0.5">
                <Icon name="info" size={16} />
              </span>
              <div className="flex-1">
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Bản gợi ý chỉ điều chỉnh những điểm được đánh dấu. Giọng văn và ý tưởng gốc được giữ nguyên.
                </p>
                <button
                  onClick={markPreviewIntroSeen}
                  className="mt-1.5 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
                >
                  Đã hiểu, không hiện lại
                </button>
              </div>
            </div>
          )}

          {/* Compare tab - Diff view */}
          {activeTab === 'compare' && (
            <div>
              {/* Toggle for showing only changes */}
              <div className="mb-4 flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyChanges}
                    onChange={(e) => setShowOnlyChanges(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Chỉ xem phần thay đổi
                </label>
              </div>

              {/* Diff stats */}
              <div className="mb-4 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Thêm: {diffResult.stats.added}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  Bỏ: {diffResult.stats.removed}
                </span>
              </div>

              {/* Diff content */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <DiffView tokens={diffResult.tokens} showOnlyChanges={showOnlyChanges} />
              </div>
            </div>
          )}

          {/* New tab - Full refined content */}
          {activeTab === 'new' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                {refinedContent}
              </pre>
            </div>
          )}

          {/* Original tab - Full original content */}
          {activeTab === 'original' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                {originalContent}
              </pre>
            </div>
          )}

          {/* Fallback message */}
          {usedFallback && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Hệ thống ưu tiên an toàn nên giữ bản gốc.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            {/* Tertiary action - Copy */}
            <button
              onClick={handleCopyRefined}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors flex items-center gap-1.5"
            >
              <Icon name="copy" size={16} />
              {copySuccess ? 'Đã sao chép!' : 'Sao chép bản mới'}
            </button>

            {/* Primary/Secondary actions */}
            <div className="flex items-center gap-3">
              {/* Secondary - Keep original */}
              <button
                onClick={handleKeepOriginal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Giữ bản gốc
              </button>

              {/* Primary - Apply */}
              <button
                onClick={handleApply}
                disabled={!canApply}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  canApply
                    ? 'text-white bg-blue-600 hover:bg-blue-700'
                    : 'text-gray-400 bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                }`}
              >
                Dùng bản này
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
