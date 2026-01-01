'use client';

// ============================================
// Silence Banner - Frozen Spec v2.1
// ============================================
// DRAFT_SILENT state: Minimal "paused" indicator
// User can toggle silence off via Resume button

import React from 'react';

interface SilenceBannerProps {
  onResume?: () => void;
}

export const SilenceBanner: React.FC<SilenceBannerProps> = ({ onResume }) => {
  return (
    <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/50 dark:border-zinc-700/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          <span>⏸</span>
          <span>Trợ lý tạm dừng</span>
        </div>
        {onResume && (
          <button
            onClick={onResume}
            className="text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Bật lại
          </button>
        )}
      </div>
    </div>
  );
};

export default SilenceBanner;
