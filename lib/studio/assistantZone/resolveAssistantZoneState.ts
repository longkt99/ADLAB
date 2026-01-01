// ============================================
// Assistant Zone State Resolver - Pure Function
// ============================================
// Derives AssistantZoneState from approved message qualityLock
// No React, no hooks, no side effects

import type { AssistantZoneState, LockedIssue } from '@/types/assistantZone';

export interface ResolveAssistantZoneStateParams {
  approvedMessageId: string | null;
  messages: Array<{ id: string; meta?: { qualityLock?: {
    decision?: string;
    hardFails?: Array<string | { message?: string }>;
  } } }>;
  isAssistantSilenced: boolean;
}

export interface ResolveAssistantZoneStateResult {
  state: AssistantZoneState;
  lockedIssues: LockedIssue[];
}

/**
 * Pure resolver for AssistantZone state
 * @param params - Input parameters
 * @returns Derived state and locked issues
 */
export function resolveAssistantZoneState(
  params: ResolveAssistantZoneStateParams
): ResolveAssistantZoneStateResult {
  const { approvedMessageId, messages, isAssistantSilenced } = params;

  // 1) No approved message => silent
  if (!approvedMessageId) {
    return { state: 'DRAFT_SILENT', lockedIssues: [] };
  }

  // 2) Find approved message
  const approvedMessage = messages.find((m) => m.id === approvedMessageId);
  if (!approvedMessage) {
    return { state: 'DRAFT_SILENT', lockedIssues: [] };
  }

  // 3) Read qualityLock
  const ql = approvedMessage.meta?.qualityLock;
  if (!ql) {
    return { state: 'DRAFT_SILENT', lockedIssues: [] };
  }

  // 4) Determine hardFails
  const hardFails = ql.hardFails ?? [];

  // 5) LOCKED if FAIL or hardFails exist
  if (ql.decision === 'FAIL' || hardFails.length > 0) {
    const lockedIssues: LockedIssue[] = hardFails.map((fail, idx) => ({
      id: `locked-${idx}`,
      type: 'policy' as const,
      message: typeof fail === 'string' ? fail : (fail.message ?? JSON.stringify(fail)),
    }));
    return { state: 'LOCKED', lockedIssues };
  }

  // 6) PASS
  if (ql.decision === 'PASS') {
    return { state: 'PASS', lockedIssues: [] };
  }

  // 7) DRAFT (apply silence if needed)
  if (ql.decision === 'DRAFT') {
    const state = isAssistantSilenced ? 'DRAFT_SILENT' : 'DRAFT';
    return { state, lockedIssues: [] };
  }

  // Default fallback
  return { state: 'DRAFT_SILENT', lockedIssues: [] };
}
