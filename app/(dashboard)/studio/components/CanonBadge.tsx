'use client';

// ============================================
// STEP 15: Canon Badge (Lock Status Indicator)
// ============================================
// Displays the current canon lock state as a small badge.
// Shows which sections are protected (HOOK, CTA, TONE).
// User can toggle locks directly from the badge.
//
// INVARIANTS:
// - Pure UI, no LLM calls
// - Session-only state (no localStorage text storage)
// - Non-intrusive placement
// ============================================

import React, { useState, useCallback } from 'react';
import {
  type EditorialCanon,
  type CanonSection,
  updateSectionLock,
  getSectionLabel,
  getToneLabel,
  getCanonDebugSummary,
} from '@/lib/studio/editorialCanon';

interface CanonBadgeProps {
  /** Current editorial canon state */
  canon: EditorialCanon | null;
  /** Callback when canon is updated */
  onCanonUpdate: (updated: EditorialCanon) => void;
  /** Optional CSS class */
  className?: string;
  /** Language for labels (default: 'vi') */
  language?: 'vi' | 'en';
}

/**
 * Small lock indicator badge for each section
 */
function LockIndicator({
  section: _section,
  locked,
  label,
  onToggle,
}: {
  section: CanonSection;
  locked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium
        transition-colors duration-150
        ${locked
          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-200'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
        }
      `}
      title={`${locked ? 'Đã khóa' : 'Chưa khóa'}: ${label}. Click để ${locked ? 'mở khóa' : 'khóa'}.`}
    >
      <span>{locked ? '🔒' : '🔓'}</span>
      <span>{label}</span>
    </button>
  );
}

/**
 * Canon Badge showing lock state and allowing toggling.
 */
export function CanonBadge({
  canon,
  onCanonUpdate,
  className = '',
  language = 'vi',
}: CanonBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Toggle section lock
  const handleToggleLock = useCallback(
    (section: CanonSection) => {
      if (!canon) return;

      const currentlyLocked =
        section === 'HOOK'
          ? canon.hook.locked
          : section === 'CTA'
          ? canon.cta.locked
          : section === 'TONE'
          ? canon.tone.locked
          : false;

      const updated = updateSectionLock(canon, section, !currentlyLocked);
      onCanonUpdate(updated);

      if (process.env.NODE_ENV === 'development') {
        console.log('[CanonBadge] Toggled lock:', {
          section,
          newState: !currentlyLocked,
          summary: getCanonDebugSummary(updated),
        });
      }
    },
    [canon, onCanonUpdate]
  );

  // Don't render if no canon
  if (!canon) {
    return null;
  }

  // Count locked sections
  const lockedCount = [canon.hook.locked, canon.cta.locked, canon.tone.locked].filter(
    Boolean
  ).length;

  // Collapsed view: just show lock count
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className={`
          inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium
          bg-gray-100 text-gray-600 hover:bg-gray-200
          dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700
          transition-colors duration-150
          ${className}
        `}
        title="Canon: Structural locks. Click to expand."
      >
        <span>🔐</span>
        <span>{lockedCount}/3</span>
      </button>
    );
  }

  // Expanded view: show all locks
  return (
    <div
      className={`
        inline-flex items-center gap-1 p-1 rounded-lg
        bg-white/90 backdrop-blur-sm shadow-sm border border-gray-200
        dark:bg-gray-900/90 dark:border-gray-700
        ${className}
      `}
    >
      <LockIndicator
        section="HOOK"
        locked={canon.hook.locked}
        label={getSectionLabel('HOOK', language)}
        onToggle={() => handleToggleLock('HOOK')}
      />
      <LockIndicator
        section="CTA"
        locked={canon.cta.locked}
        label={getSectionLabel('CTA', language)}
        onToggle={() => handleToggleLock('CTA')}
      />
      <LockIndicator
        section="TONE"
        locked={canon.tone.locked}
        label={getToneLabel(canon.tone.id, language)}
        onToggle={() => handleToggleLock('TONE')}
      />
      <button
        type="button"
        onClick={() => setIsExpanded(false)}
        className="ml-1 px-1 py-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        title="Collapse"
      >
        ✕
      </button>
    </div>
  );
}

export default CanonBadge;
