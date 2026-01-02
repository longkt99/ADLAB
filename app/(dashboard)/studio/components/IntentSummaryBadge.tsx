'use client';

// ============================================
// Intent Summary Badge
// ============================================
// STEP 4: UX Enhancement Component
//
// Displays a subtle, non-intrusive summary of
// the detected user intent to boost confidence.
//
// CRITICAL: This is PRESENTATION ONLY.
// Does NOT affect execution logic.
// ============================================

import React, { useState, useMemo } from 'react';
import type { IntentSnapshot } from '@/types/studio';
import {
  deriveIntentSummary,
  formatSummaryForDisplay,
  hasMeaningfulSummary,
  getSummaryPartCount,
  warnIfSummaryIncomplete,
  warnIfConflictingActions,
} from '@/lib/studio/intentSummary';

// ============================================
// Environment Detection
// ============================================
const IS_DEV = process.env.NODE_ENV === 'development';

interface IntentSummaryBadgeProps {
  snapshot: IntentSnapshot | null | undefined;
  state?: 'understanding' | 'processing' | 'completed';
  className?: string;
}

/**
 * IntentSummaryBadge - Shows user intent understanding
 *
 * Displays a subtle badge like:
 * "Đã hiểu: Viết lại · Giọng chuyên nghiệp · Thêm hotline"
 *
 * INVARIANTS:
 * 1. Pure presentation - no side effects
 * 2. Derived from snapshot only
 * 3. DEV mode allows expansion to full snapshot
 * 4. PROD mode shows summary only
 */
export function IntentSummaryBadge({
  snapshot,
  state = 'completed',
  className = '',
}: IntentSummaryBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Derive summary from snapshot (memoized for stability)
  const summary = useMemo(() => {
    const derived = deriveIntentSummary(snapshot);

    // DEV-only guardrail warnings
    if (IS_DEV && snapshot) {
      warnIfSummaryIncomplete(derived, snapshot, 'IntentSummaryBadge');
      warnIfConflictingActions(snapshot, 'IntentSummaryBadge');
    }

    return derived;
  }, [snapshot]);

  // Don't render if no snapshot or no meaningful summary
  if (!snapshot || !hasMeaningfulSummary(summary)) {
    return null;
  }

  // Get prefix based on state
  const prefix = getStatePrefix(state);
  const displayText = formatSummaryForDisplay(summary);
  const partCount = getSummaryPartCount(summary);

  return (
    <div
      className={`intent-summary-badge ${className}`}
      data-testid="intent-summary-badge"
    >
      {/* Main summary display */}
      <div
        className={`
          inline-flex items-center gap-1.5 px-2 py-1
          text-[11px] leading-tight
          text-zinc-500 dark:text-zinc-400
          bg-zinc-50 dark:bg-zinc-800/50
          rounded-md
          transition-all duration-200
          ${IS_DEV ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''}
        `}
        onClick={IS_DEV ? () => setIsExpanded(!isExpanded) : undefined}
        role={IS_DEV ? 'button' : undefined}
        aria-expanded={IS_DEV ? isExpanded : undefined}
      >
        {/* State indicator */}
        <span className="text-zinc-400 dark:text-zinc-500 font-medium">
          {prefix}
        </span>

        {/* Summary parts */}
        <span className="text-zinc-600 dark:text-zinc-300">
          {displayText}
        </span>

        {/* Part count indicator (subtle) */}
        {partCount > 3 && (
          <span className="text-zinc-400 dark:text-zinc-500 text-[10px]">
            +{partCount - 3}
          </span>
        )}

        {/* DEV expand indicator */}
        {IS_DEV && (
          <span className="text-zinc-400 dark:text-zinc-500 text-[10px] ml-1">
            {isExpanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* DEV-only: Expanded snapshot details */}
      {IS_DEV && isExpanded && snapshot && (
        <div className="mt-2 p-2 text-[10px] bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
          <div className="font-mono space-y-1 text-zinc-600 dark:text-zinc-400">
            <div>
              <span className="text-zinc-400">snapshotId:</span>{' '}
              {snapshot.snapshotId.substring(0, 25)}...
            </div>
            <div>
              <span className="text-zinc-400">mode:</span>{' '}
              <span className={getModeColor(snapshot.detectedMode)}>
                {snapshot.detectedMode}
              </span>
            </div>
            <div>
              <span className="text-zinc-400">actions:</span>{' '}
              [{snapshot.detectedActions.join(', ')}]
            </div>
            <div>
              <span className="text-zinc-400">turnIndex:</span>{' '}
              {snapshot.turnIndex}
            </div>
            <div>
              <span className="text-zinc-400">userTypedText:</span>{' '}
              &quot;{snapshot.userTypedText.length > 40
                ? snapshot.userTypedText.substring(0, 40) + '...'
                : snapshot.userTypedText}&quot;
            </div>
            {snapshot.originSnapshotId && (
              <div>
                <span className="text-zinc-400">originSnapshotId:</span>{' '}
                {snapshot.originSnapshotId.substring(0, 20)}...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function getStatePrefix(state: 'understanding' | 'processing' | 'completed'): string {
  switch (state) {
    case 'understanding':
      return 'Đã hiểu:';
    case 'processing':
      return 'Đang xử lý:';
    case 'completed':
      return 'Hoàn thành:';
    default:
      return '';
  }
}

function getModeColor(mode: string): string {
  switch (mode) {
    case 'CREATE':
      return 'text-blue-500';
    case 'PURE_TRANSFORM':
      return 'text-green-500';
    case 'DIRECTED_TRANSFORM':
      return 'text-purple-500';
    default:
      return 'text-zinc-500';
  }
}

// ============================================
// Utility: Check if badge should be visible
// ============================================

/**
 * Check if the IntentSummaryBadge should be shown
 * Returns false in production when disabled
 */
export function isIntentSummaryEnabled(): boolean {
  // Always enabled for now
  // Can be controlled via feature flag in future
  return true;
}

export default IntentSummaryBadge;
