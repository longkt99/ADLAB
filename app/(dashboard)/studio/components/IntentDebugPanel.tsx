'use client';

// ============================================
// Intent Debug Panel (DEV-ONLY)
// ============================================
// STEP 3: Observability layer for user intent
//
// This component displays IntentSnapshot data for debugging.
// It is ONLY visible in development mode.
// In production, this component renders NOTHING.
//
// CRITICAL: This is pure observability - no execution logic.
// ============================================

import React, { useState } from 'react';
import type { IntentSnapshot } from '@/types/studio';

interface IntentDebugPanelProps {
  snapshot: IntentSnapshot | null | undefined;
  messageId: string;
}

/**
 * DEV-ONLY component to display IntentSnapshot for debugging
 * Renders nothing in production
 */
export function IntentDebugPanel({ snapshot, messageId: _messageId }: IntentDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // ============================================
  // PRODUCTION GUARD: Render nothing in production
  // ============================================
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // No snapshot available
  if (!snapshot) {
    return null;
  }

  // Collapsed state - just show a subtle indicator
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="mt-1 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400 dark:text-zinc-600
                   bg-zinc-100 dark:bg-zinc-800/50 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/50
                   transition-colors opacity-50 hover:opacity-100"
        title="Show Intent Debug Info"
      >
        🔍 intent
      </button>
    );
  }

  // Expanded state - show full debug info
  return (
    <div className="mt-2 p-2 text-[10px] font-mono bg-zinc-50 dark:bg-zinc-900/80
                    border border-zinc-200 dark:border-zinc-700 rounded-md
                    text-zinc-600 dark:text-zinc-400">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          Intent Snapshot
        </span>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      {/* Snapshot data */}
      <div className="space-y-1">
        <div className="flex gap-2">
          <span className="text-zinc-500">mode:</span>
          <span className={getModeColor(snapshot.detectedMode)}>
            {snapshot.detectedMode}
          </span>
        </div>

        <div className="flex gap-2">
          <span className="text-zinc-500">actions:</span>
          <span>{snapshot.detectedActions.join(', ') || 'none'}</span>
        </div>

        <div className="flex gap-2">
          <span className="text-zinc-500">text:</span>
          <span className="truncate max-w-[200px]" title={snapshot.userTypedText}>
            {snapshot.userTypedText.length > 40
              ? snapshot.userTypedText.substring(0, 40) + '...'
              : snapshot.userTypedText}
          </span>
        </div>

        <div className="flex gap-2">
          <span className="text-zinc-500">source:</span>
          <span>{snapshot.sourceMessageId?.substring(0, 15) || 'none'}</span>
        </div>

        <div className="flex gap-2">
          <span className="text-zinc-500">turn:</span>
          <span>{snapshot.turnIndex}</span>
        </div>

        <div className="flex gap-2">
          <span className="text-zinc-500">id:</span>
          <span className="truncate max-w-[150px]" title={snapshot.snapshotId}>
            {snapshot.snapshotId.substring(0, 20)}...
          </span>
        </div>

        {snapshot.originSnapshotId && (
          <div className="flex gap-2">
            <span className="text-zinc-500">origin:</span>
            <span className="truncate max-w-[150px]" title={snapshot.originSnapshotId}>
              {snapshot.originSnapshotId.substring(0, 20)}...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get color class for mode indicator
 */
function getModeColor(mode: string): string {
  switch (mode) {
    case 'CREATE':
      return 'text-green-600 dark:text-green-400';
    case 'PURE_TRANSFORM':
      return 'text-blue-600 dark:text-blue-400';
    case 'DIRECTED_TRANSFORM':
      return 'text-purple-600 dark:text-purple-400';
    default:
      return 'text-zinc-600 dark:text-zinc-400';
  }
}

/**
 * Utility to check if debug panel should be available
 * Returns false in production
 */
export function isIntentDebugAvailable(): boolean {
  return process.env.NODE_ENV === 'development';
}
