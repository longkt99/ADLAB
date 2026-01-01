'use client';

// ============================================
// Assistant Zone - Frozen Spec v2.1
// ============================================
// Secondary, opt-in, silent by default - NO auto actions
// Trust-first UX: does NOTHING without user action
//
// States:
// - PASS: Static success indicator
// - DRAFT: Summary bar + collapsible suggestions
// - DRAFT_SILENT: Minimal "paused" indicator
// - LOCKED: Read-only issues list

import React, { useState, useCallback } from 'react';
import type { AssistantZoneProps, UndoRestoreData } from '@/types/assistantZone';
import { PassIndicator } from './PassIndicator';
import { SilenceBanner } from './SilenceBanner';
import { LockedIssuesPanel } from './LockedIssuesPanel';
import { AssistantSummaryBar } from './AssistantSummaryBar';
import { DraftSuggestionPanel } from './DraftSuggestionPanel';
import { ToastUndo } from './ToastUndo';

export const AssistantZone: React.FC<AssistantZoneProps> = ({
  state,
  suggestions,
  lockedIssues,
  onApplySuggestion,
  onDismissSuggestion,
  onUndo,
  onToggleSilence,
}) => {
  // Collapsible state for DRAFT suggestions panel
  const [isExpanded, setIsExpanded] = useState(false);

  // Undo toast state (8-second window)
  const [undoToast, setUndoToast] = useState<{
    visible: boolean;
    message: string;
    restoreData: UndoRestoreData | null;
  }>({
    visible: false,
    message: '',
    restoreData: null,
  });

  // Handle suggestion apply with undo tracking
  const handleApply = useCallback(
    (suggestionId: string) => {
      const suggestion = suggestions.find((s) => s.id === suggestionId);
      if (!suggestion) return;

      // Store restore data for undo
      const restoreData: UndoRestoreData = {
        suggestionId,
        originalContent: suggestion.original || '',
      };

      // Show undo toast
      setUndoToast({
        visible: true,
        message: 'Đã áp dụng gợi ý',
        restoreData,
      });

      // Call parent handler
      onApplySuggestion?.(suggestionId);
    },
    [suggestions, onApplySuggestion]
  );

  // Handle undo action
  const handleUndo = useCallback(() => {
    if (undoToast.restoreData && onUndo) {
      onUndo(undoToast.restoreData);
    }
  }, [undoToast.restoreData, onUndo]);

  // Dismiss undo toast
  const dismissUndoToast = useCallback(() => {
    setUndoToast((prev) => ({ ...prev, visible: false, restoreData: null }));
  }, []);

  // Toggle expand/collapse
  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // ============================================
  // STATE: PASS - Static success indicator
  // ============================================
  if (state === 'PASS') {
    return <PassIndicator />;
  }

  // ============================================
  // STATE: DRAFT_SILENT - Minimal paused indicator
  // ============================================
  if (state === 'DRAFT_SILENT') {
    return <SilenceBanner onResume={onToggleSilence} />;
  }

  // ============================================
  // STATE: LOCKED - Read-only issues list
  // ============================================
  if (state === 'LOCKED') {
    return <LockedIssuesPanel issues={lockedIssues} />;
  }

  // ============================================
  // STATE: DRAFT - Summary bar + collapsible suggestions
  // ============================================
  return (
    <>
      <div>
        <AssistantSummaryBar
          suggestionCount={suggestions.length}
          isExpanded={isExpanded}
          onToggleExpand={toggleExpand}
          onToggleSilence={onToggleSilence}
        />
        {isExpanded && suggestions.length > 0 && (
          <DraftSuggestionPanel
            suggestions={suggestions}
            onApply={handleApply}
            onDismiss={onDismissSuggestion}
          />
        )}
      </div>

      {/* Undo Toast (8-second window) */}
      <ToastUndo
        visible={undoToast.visible}
        message={undoToast.message}
        onUndo={handleUndo}
        onDismiss={dismissUndoToast}
      />
    </>
  );
};

export default AssistantZone;
