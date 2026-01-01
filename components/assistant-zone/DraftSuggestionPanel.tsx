'use client';

// ============================================
// Draft Suggestion Panel - Frozen Spec v2.1
// ============================================
// DRAFT state: Actionable suggestions list
// User may Apply or Dismiss - NO auto actions

import React from 'react';
import type { Suggestion } from '@/types/assistantZone';

interface DraftSuggestionPanelProps {
  suggestions: Suggestion[];
  onApply?: (suggestionId: string) => void;
  onDismiss?: (suggestionId: string) => void;
}

export const DraftSuggestionPanel: React.FC<DraftSuggestionPanelProps> = ({
  suggestions,
  onApply,
  onDismiss,
}) => {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="px-3 py-2 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/30 dark:border-amber-800/20 border-t-0 rounded-b-lg -mt-1">
      <ul className="space-y-1.5">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.id}
            className="flex items-start justify-between gap-2 text-[11px] text-amber-700 dark:text-amber-300/80"
          >
            <span className="flex-1 leading-relaxed">• {suggestion.message}</span>
            <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
              {onApply && suggestion.replacement && (
                <button
                  onClick={() => onApply(suggestion.id)}
                  className="px-1.5 py-0.5 text-[9px] font-medium bg-amber-200/80 dark:bg-amber-800/50 text-amber-700 dark:text-amber-200 rounded hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
                >
                  Áp dụng
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={() => onDismiss(suggestion.id)}
                  className="px-1 py-0.5 text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DraftSuggestionPanel;
