// ============================================
// Editor Focus State Hook
// ============================================
// Maps workflow phase to visual focus state
// Used to communicate editor context via subtle styling
// States: focus (writing), co-focus (review), defocus (approved)
// NOTE: This is PURELY VISUAL - no behavior changes

import { useMemo } from 'react';
import { useStudio } from './studioContext';

export type EditorFocusState = 'focus' | 'co-focus' | 'defocus';

/**
 * Maps the current workflow phase to a visual focus state.
 *
 * - 'focus': Brief or Draft phase (active writing)
 * - 'co-focus': Review phase (content being reviewed)
 * - 'defocus': Content approved (stable state)
 *
 * This is purely visual — no logic or behavior changes occur.
 */
export function useEditorFocusState(): {
  focusState: EditorFocusState;
} {
  const { workflowStep, approvedMessageId } = useStudio();

  return useMemo(() => {
    // Simple mapping from workflow step to focus state
    // approved always maps to defocus for visual stability
    if (approvedMessageId !== null) {
      return { focusState: 'defocus' as const };
    }

    // Map workflow step directly to focus state
    switch (workflowStep) {
      case 'review':
        return { focusState: 'co-focus' as const };
      case 'draft':
      case 'brief':
      default:
        return { focusState: 'focus' as const };
    }
  }, [workflowStep, approvedMessageId]);
}
