'use client';

// ============================================
// Toast Undo - Frozen Spec v2.1
// ============================================
// 8-second undo window after user applies suggestion
// ONLY time-based behavior in Assistant Zone
// User-triggered undo reverts last applied suggestion

import React, { useEffect, useState, useCallback } from 'react';
import type { ToastUndoProps } from '@/types/assistantZone';

const UNDO_TIMEOUT_MS = 8000;

export const ToastUndo: React.FC<ToastUndoProps> = ({
  visible,
  message,
  onUndo,
  onDismiss,
}) => {
  const [progress, setProgress] = useState(100);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!visible) {
      setProgress(100);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / UNDO_TIMEOUT_MS) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [visible, onDismiss]);

  const handleUndo = useCallback(() => {
    onUndo();
    onDismiss();
  }, [onUndo, onDismiss]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="relative overflow-hidden bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg shadow-lg min-w-[200px]">
        {/* Progress bar */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-emerald-400 dark:bg-emerald-600 transition-all duration-50"
          style={{ width: `${progress}%` }}
        />

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium">{message}</span>
          <button
            onClick={handleUndo}
            className="text-xs font-semibold text-emerald-400 dark:text-emerald-600 hover:text-emerald-300 dark:hover:text-emerald-500 transition-colors"
          >
            Hoàn tác
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToastUndo;
