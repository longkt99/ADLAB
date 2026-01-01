// ============================================
// Assistant Zone - Barrel Exports
// ============================================
// Frozen Spec v2.1 compliant module

export { AssistantZone, default } from './AssistantZone';
export { PassIndicator } from './PassIndicator';
export { SilenceBanner } from './SilenceBanner';
export { LockedIssuesPanel } from './LockedIssuesPanel';
export { AssistantSummaryBar } from './AssistantSummaryBar';
export { DraftSuggestionPanel } from './DraftSuggestionPanel';
export { ToastUndo } from './ToastUndo';

// Re-export types
export type {
  AssistantZoneState,
  Suggestion,
  LockedIssue,
  UndoRestoreData,
  AssistantZoneProps,
  ToastUndoProps,
} from '@/types/assistantZone';
