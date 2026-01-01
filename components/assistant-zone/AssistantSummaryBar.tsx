'use client';

// ============================================
// Assistant Summary Bar - Frozen Spec v2.1
// ============================================
// DRAFT state ONLY: Shows suggestion count
// Collapsible - click to expand/collapse panel
// Pause button to toggle silence
// PURE RENDERER - no state derivation

import React from 'react';

interface AssistantSummaryBarProps {
  suggestionCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleSilence?: () => void;
}

export const AssistantSummaryBar: React.FC<AssistantSummaryBarProps> = ({
  suggestionCount,
  isExpanded,
  onToggleExpand,
  onToggleSilence,
}) => {
  return (
    <div className="px-3 py-2 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-lg">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
        >
          <span
            className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
          >
            ▸
          </span>
          <span>💡 {suggestionCount} gợi ý</span>
        </button>
        {onToggleSilence && (
          <button
            onClick={onToggleSilence}
            className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            title="Tạm dừng trợ lý"
          >
            ⏸
          </button>
        )}
      </div>
    </div>
  );
};

export default AssistantSummaryBar;
