'use client';

// ============================================
// StudioEditor - Calm Writing Surface
// ============================================
// DESIGN PHILOSOPHY: A writing surface, not a tool
// - User starts typing immediately
// - AI is a quiet background presence
// - Options feel optional, not required
//
// LAYOUT: ChatGPT-like viewport-based
// - Messages in scrollable container (flex-1)
// - Input fixed at bottom (flex-shrink-0)
// - PromptGrid shows in messages area when empty
//
// 3 STATES ONLY:
// 1. Empty / short input → invitation
// 2. Typing → acknowledgment
// 3. Has results → refinement offer
//
// VISUAL RULES:
// - No icons in hints (too playful)
// - No decorative dividers (too heavy)
// - Send button is the ONLY strong action
// - Everything else is secondary and quiet
//
// ============================================
// STEP 6.5: UX Intent Confirmation
// ============================================
// When ambiguity is high (user editing + short transform instruction),
// show confirmation UI to clarify intent before sending.
// This prevents "AI misunderstood" situations.
// ============================================

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStudio } from '@/lib/studio/studioContext';
import { useTranslation } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';
import { GOLDEN_INTENTS } from '@/lib/studio/golden/intentsRegistry';
import QualityLockPanel from './QualityLockPanel';
import DiffPreviewModal from './DiffPreviewModal';
import MessageActionBar from './MessageActionBar';
import DiffApplyPanel from './DiffApplyPanel';
import SourceIndicator from './SourceIndicator';
import RewriteConfirmationDialog from './RewriteConfirmationDialog';
import { ERROR_BOX } from '@/lib/studio/messageStyles';
import type { ActionType } from '@/types/orchestrator';

// ✅ Validation-display consistency check (SINGLE SOURCE OF TRUTH)
import {
  isValidationStale,
  getDisplayedText,
  computeContentHash,
  traceValidation,
} from '@/lib/quality/validateDisplayedContent';
import { runQualityLock } from '@/lib/quality/runQualityLock';
import { isValidIntentId, type IntentId } from '@/lib/quality/intentQualityRules';
import type { QualityLockMeta } from '@/types/studio';

// ✅ User message display (SINGLE SOURCE OF TRUTH)
import { getDisplayedUserMessageText } from '@/lib/studio/messageDisplay';

// ✅ STEP 6.6: Local Apply (NO LLM call)
import { localApply } from '@/lib/studio/localApply';

// ✅ STEP 7: Intent Confidence & Learning Loop
import { computeRouteConfidence, type ConfidenceInput } from '@/lib/studio/intentConfidence';
import {
  computePatternHash,
  getAutoApplyChoice,
  recordChoice,
  recordNegativeSignal,
  getLearnedChoice,
} from '@/lib/studio/intentLearning';

// ✅ STEP 8: Intent Transparency & Debug Overlay
import {
  isIntentDebugEnabled,
  createDebugDecision,
  logIntentDecision,
  type DebugDecision,
  type DecisionPath,
} from '@/lib/studio/intentDebug';
import { IntentDebugBadge } from './IntentDebugBadge';
import { IntentConfirmExplain } from './IntentConfirmExplain';

// ✅ STEP 9: Intent Outcome Tracking
import {
  createOutcome,
  appendSignal,
  shouldMarkUnreliable,
  choiceToRoute,
  type RouteUsed,
} from '@/lib/studio/intentOutcome';
import * as outcomeStore from '@/lib/studio/intentOutcomeStore';
import { recordOutcome } from '@/lib/studio/intentLearning';

// ✅ STEP 10: Intent Stability & Trust Signals
import {
  computeStability,
  getConfirmationGating,
  type StabilityMetrics,
} from '@/lib/studio/intentStability';

// ✅ STEP 11: Intent Memory & Conversational Continuity
import {
  createInitialContinuityState,
  updateContinuityState,
  shouldSkipConfirmationByContext,
  type ContinuityState,
} from '@/lib/studio/intentContinuity';

// ✅ STEP 12: User Preference & Style Memory (Soft Bias)
import {
  getPreferenceBias,
  recordPreference,
  detectChoiceSignals,
  detectInstructionSignals,
  type BiasResult,
  type PreferenceContext,
} from '@/lib/studio/userPreference';

// ✅ STEP 13: Trust, Control & Recovery Layer
import {
  arePreferencesEnabled,
  isAutoApplyEnabled,
  executeRecoveryAction,
} from '@/lib/studio/intentControl';
import { TrustMicrocopy } from './TrustMicrocopy';

// ✅ STEP 14: Team/Multi-User/Organization Intent Governance
import {
  getGovernanceContext,
  isGovernanceActive,
  isLearningAllowed,
  isAutoApplyAllowed as isAutoApplyAllowedByGovernance,
  isExecutionAllowed,
  isPreferenceBiasAllowed,
  shouldForceConfirmation,
  type GovernanceDecision,
} from '@/lib/studio/intentGovernance';

// ✅ STEP 3: Intent Debug Panel (DEV-ONLY observability)
import { IntentDebugPanel, isIntentDebugAvailable } from './IntentDebugPanel';

// ✅ STEP 4: Intent Summary Badge (UX enhancement)
import { IntentSummaryBadge, isIntentSummaryEnabled } from './IntentSummaryBadge';

// ✅ STEP 14A: Editorial Authority & Single Draft Enforcement
import {
  hasActiveDraft,
  isEditLocked,
  getActiveDraftId,
  getEditorialMode,
  lockForEdit,
  unlockEdit,
  enterCreateMode,
  checkIntentOverride,
  handleCreateConfirmation,
  maybeActivateDraft,
  getCreateWarningCopy,
  getEditorialBadgeCopy,
  getEditorialDebugState,
  type EditorialMode,
  type CreateConfirmation,
} from '@/lib/studio/editorialAuthority';

// ✅ STEP 15: Editorial Canon & Structural Locking
import {
  extractCanonFromDraft,
  applyCanonLocks,
  computeCanonDiff,
  shouldRequireCanonApproval,
  reapplyLockedSections,
  updateCanonFromText,
  getCanonDebugSummary,
  isAmbiguousEditInstruction,
  type EditorialCanon,
  type CanonDiff,
} from '@/lib/studio/editorialCanon';

// ✅ STEP 16: Edit Guard Modal & Evaluation
import {
  EditGuardModal,
  evaluateEditGuard,
  type EditGuardResult,
} from './EditGuardModal';
import {
  detectEditorialOp,
  getOperationWeight,
  type EditorialOp,
} from '@/lib/studio/editorialOpPrompt';

// ✅ STEP 17: Editorial Intent Canon & Meaning Preservation
import {
  buildIntentCanonFromDraft,
  computeIntentCanonDiff,
  decideIntentCanonAction,
  getIntentCanonDebugSummary,
  type EditorialIntentCanon,
  type IntentCanonDiff,
  type IntentGuardDecision,
} from '@/lib/studio/editorialIntentCanon';
import { IntentCanonGuardModal } from './IntentCanonGuardModal';

// ✅ STEP 19: Edit Scope Contract & Visible Edit Scope
import {
  shouldGateForScopePick,
  buildEditScopeContract,
  type EditScopeContract,
  type ScopeGate,
} from '@/lib/studio/editScopeContract';
import { EditScopeBadge } from './EditScopeBadge';
import { EditScopePickModal } from './EditScopePickModal';

// ✅ STEP 20: Edit Intent Normalizer
import {
  normalizeEditIntent,
  type NormalizedEditIntent,
} from '@/lib/studio/editIntentNormalizer';

// ✅ STEP 21: Edit Patch Executor
// ✅ STEP 22: Output Contract Builder
import {
  buildEditPatchMeta,
  shouldSkipStructureValidation,
  allowsPartialOutput,
  getEditPatchDebugSummary,
  buildOutputContractFromMeta,
  getOutputContractDebugSummary,
} from '@/lib/studio/editPatchExecutor';

// ✅ STEP 22: Answer Engine (for REWRITE_UPGRADE context guard)
import {
  detectTaskType,
  type TaskDetectionContext,
} from '@/lib/studio/answerEngine';
import { REWRITE_NO_CONTEXT_ERROR } from '@/lib/orchestrator/llmExecutor';

// ✅ STEP 29: Kill-Switch for production safety
import { isRewriteUpgradeEnabled } from '@/lib/studio/featureFlags';

// ============================================
// STEP 6.5: Intent Choice Types
// ============================================
type IntentChoice = 'EDIT_IN_PLACE' | 'TRANSFORM_NEW_VERSION' | 'CREATE_NEW';

interface PendingIntentChoice {
  inputText: string;
  editedMessageId: string | null;
  uiSourceMessageId: string | null;
}

interface StudioEditorProps {
  promptGrid?: React.ReactNode;
}

// ============================================
// STEP 6.5: Pattern Detection Helpers
// ============================================

/**
 * Detect if input contains explicit "create new" signals.
 * If true, skip confirmation and go straight to CREATE path.
 */
function isExplicitNewCreate(text: string): boolean {
  const normalized = text.toLowerCase().normalize('NFC');
  const patterns = [
    /\b(bài\s*mới|viết\s*mới|tạo\s*mới|nội\s*dung\s*mới)\b/,
    /\b(chủ\s*đề\s*(mới|khác)|topic\s*(mới|khác))\b/,
    /\b(bắt\s*đầu\s*lại|start\s*over|new\s*content)\b/,
    /\b(viết\s*về\s*chủ\s*đề|viết\s*cho)\b/,
    /\b(create\s*new|write\s*new|draft\s*new)\b/i,
  ];
  return patterns.some((p) => p.test(normalized));
}

/**
 * Detect if input explicitly references the selected/current message.
 * If true, assume TRANSFORM intent.
 */
function isExplicitTransformReference(text: string): boolean {
  const normalized = text.toLowerCase().normalize('NFC');
  const patterns = [
    /\b(đoạn\s*(trên|này|vừa\s*rồi|đang\s*chọn))\b/,
    /\b(nội\s*dung\s*(trên|này|vừa\s*rồi))\b/,
    /\b(bài\s*(trên|này|vừa\s*viết))\b/,
    /\b(chỉnh\s*(đoạn|bài)\s*(này|trên))\b/,
    /\b(sửa\s*(đoạn|bài)\s*(này|trên))\b/,
    /\b(this\s*(content|post|message))\b/i,
  ];
  return patterns.some((p) => p.test(normalized));
}

/**
 * Detect if input is an ambiguous transform-like instruction.
 * Short instructions with transform verbs but no clear target.
 */
function isAmbiguousInstruction(text: string): boolean {
  const normalized = text.trim().toLowerCase().normalize('NFC');

  // Long inputs (>120 chars) are considered intentional - no confirmation
  if (text.length > 120) return false;

  // Very short inputs without transform verbs are not ambiguous transform instructions
  if (text.length < 3) return false;

  // Transform verb patterns (Vietnamese + English)
  const transformVerbs = [
    /\b(viết\s*lại|rewrite)\b/i,
    /\b(ngắn\s*(hơn|lại)|rút\s*gọn|shorten|shorter)\b/i,
    /\b(dài\s*hơn|mở\s*rộng|expand|longer)\b/i,
    /\b(tối\s*ưu|optimize|cải\s*thiện|improve)\b/i,
    /\b(đổi\s*giọng|change\s*tone|giọng\s*(khác|mới))\b/i,
    /\b(chuyên\s*nghiệp\s*hơn|professional)\b/i,
    /\b(thân\s*thiện\s*hơn|friendly|casual)\b/i,
    /\b(hay\s*hơn|better|tốt\s*hơn)\b/i,
    /\b(sửa|fix|chỉnh|edit)\b/i,
    /\b(dịch|translate)\b/i,
    /\b(format|định\s*dạng)\b/i,
    /\b(đơn\s*giản\s*hơn|simpler|simplify)\b/i,
    /\b(chi\s*tiết\s*hơn|more\s*detail|elaborate)\b/i,
    /\b(thêm\s*(emoji|icon|hashtag|cta))\b/i,
    /\b(bỏ\s*(emoji|icon|hashtag))\b/i,
  ];

  const hasTransformVerb = transformVerbs.some((p) => p.test(normalized));

  // If it has transform verbs and is short (<=80 chars), it's ambiguous
  if (hasTransformVerb && text.length <= 80) {
    return true;
  }

  // Short single-word or two-word commands are often ambiguous
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 3 && hasTransformVerb) {
    return true;
  }

  return false;
}

/**
 * Determine if we should show intent confirmation UI.
 * Only show when ambiguity is high.
 */
function shouldConfirmIntent(params: {
  isEditing: boolean;
  editedMessageId: string | null;
  uiSourceMessageId: string | null;
  inputText: string;
}): boolean {
  const { isEditing, editedMessageId, uiSourceMessageId, inputText } = params;

  // Escape hatch: explicit new create → never show confirmation
  if (isExplicitNewCreate(inputText)) {
    return false;
  }

  // Escape hatch: explicit transform reference → no confirmation needed
  if (isExplicitTransformReference(inputText)) {
    return false;
  }

  // Long inputs (>120 chars) → user knows what they mean
  if (inputText.length > 120) {
    return false;
  }

  // Check if input is ambiguous
  const isAmbiguous = isAmbiguousInstruction(inputText);
  if (!isAmbiguous) {
    return false;
  }

  // Case 1: Editing AND has UI source selected that's different from edited message
  if (isEditing && editedMessageId && uiSourceMessageId && editedMessageId !== uiSourceMessageId) {
    return true;
  }

  // Case 2: Editing with ambiguous transform instruction
  if (isEditing && editedMessageId && isAmbiguous) {
    return true;
  }

  // Case 3: UI source selected with ambiguous instruction (might mean create new)
  if (uiSourceMessageId && isAmbiguous) {
    return true;
  }

  return false;
}

export default function StudioEditor({ promptGrid }: StudioEditorProps) {
  const { t, language } = useTranslation();
  const {
    chatInput,
    setChatInput,
    handleSend,
    aiLoading,
    aiError,
    setAiError, // ✅ STEP 22: For REWRITE_UPGRADE context guard
    retryLastAction, // ✅ Error recovery
    messages,
    clearMessages,
    approvedMessageId,
    setApprovedMessage,
    // Auto Fix
    autoFixMessage,
    autoFixLoading,
    autoFixPreview,
    applyAutoFix,
    cancelAutoFix,
    autoFixToast,
    undoAutoFix,
    dismissAutoFixToast,
    // Orchestrator
    activeSourceId,
    setActiveSource,
    handleTransformAction,
    transformLoading,
    // Diff & Apply
    applyTransformResult,
    undoApplyTransformResult,
    // STEP 6.6: Local Edit
    updateMessageContent,
    // STEP 21: Edit Patch Meta
    setEditPatchMeta,
    // STEP 22: Output Contract
    setOutputContract,
    // FEATURE A: Primary Selection
    primaryMessageId,
    setPrimaryMessage,
    // FEATURE B: Session Management
    saveSessionSnapshot,
    getRecentSnapshots,
    restoreSnapshot,
  } = useStudio();

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [isSourcePickerMode, setIsSourcePickerMode] = useState(false);
  // FEATURE B: Session snapshots dropdown
  const [showSnapshotsDropdown, setShowSnapshotsDropdown] = useState(false);

  // ============================================
  // STEP 6.5: Intent Confirmation State
  // ============================================
  // pendingIntentChoice: When set, shows confirmation UI instead of sending
  // lastIntentChoice: Remembers last choice to avoid re-asking for same situation
  const [pendingIntentChoice, setPendingIntentChoice] = useState<PendingIntentChoice | null>(null);
  const [lastIntentChoice, setLastIntentChoice] = useState<IntentChoice | null>(null);
  // Track the last input/context hash to detect if situation changed
  const [lastConfirmationHash, setLastConfirmationHash] = useState<string | null>(null);

  // ============================================
  // STEP 6.6 + STEP 7: Local Edit Undo State
  // ============================================
  const [localEditToast, setLocalEditToast] = useState<{
    show: boolean;
    message: string;
    messageId: string;
    previousContent: string;
    expiresAt: number;
    // ✅ STEP 7: Track pattern hash for negative signal recording
    patternHash?: string;
    // ✅ STEP 13: Track intent ID for recovery action
    intentId?: string;
  } | null>(null);

  // ============================================
  // STEP 8: Debug Decision State
  // ============================================
  const [lastDebugDecision, setLastDebugDecision] = useState<DebugDecision | null>(null);
  // Track pending debug context for confirmation flow
  const pendingDebugContextRef = useRef<{
    patternHash: string;
    confidenceInput: ConfidenceInput;
    confidenceResult: { routeHint: 'CREATE' | 'TRANSFORM'; intentConfidence: number; reason: string };
    uiSourceMessageId: string | null;
    // ✅ STEP 10: Include stability metrics
    stability?: StabilityMetrics;
    // ✅ STEP 11: Include continuity state
    continuity?: ContinuityState;
    // ✅ STEP 12: Include preference bias
    preferenceBias?: BiasResult;
    // ✅ STEP 14: Include governance decision
    governanceDecision?: GovernanceDecision;
  } | null>(null);

  // ============================================
  // STEP 11: Intent Memory & Conversational Continuity State
  // ============================================
  // Track conversation flow patterns across turns (session-only, not persisted)
  const [continuityState, setContinuityState] = useState<ContinuityState>(() =>
    createInitialContinuityState()
  );

  // ============================================
  // STEP 14A: Editorial Authority State
  // ============================================
  // Track editorial mode for single-draft enforcement
  const [editorialMode, setEditorialModeState] = useState<EditorialMode>(() => getEditorialMode());
  const [showCreateWarning, setShowCreateWarning] = useState(false);
  const [pendingCreateIntent, setPendingCreateIntent] = useState<{
    originalIntent: 'CREATE' | 'TRANSFORM';
    inputText: string;
  } | null>(null);

  // ============================================
  // STEP 27: Rewrite Intent Confirmation State
  // ============================================
  // Track which draft ID has been confirmed for rewrite (UI state only)
  // Reset when: draft changes, editor cleared, or user switches to CREATE
  const [rewriteConfirmedForDraftId, setRewriteConfirmedForDraftId] = useState<string | null>(null);
  // Show the confirmation dialog
  const [showRewriteConfirmation, setShowRewriteConfirmation] = useState(false);
  // Store pending input for after confirmation
  const pendingRewriteInputRef = useRef<string | null>(null);

  // Sync editorial mode state with module state
  const refreshEditorialMode = useCallback(() => {
    setEditorialModeState(getEditorialMode());
  }, []);

  // ✅ STEP 14A: Auto-activate draft when AI produces first output
  useEffect(() => {
    // Find the last assistant message
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

    if (lastAssistantMsg && !hasActiveDraft()) {
      // Activate this message as the draft
      const activated = maybeActivateDraft(lastAssistantMsg.id, true);
      if (activated) {
        refreshEditorialMode();
        if (process.env.NODE_ENV === 'development') {
          console.log('[StudioEditor:STEP14A] Auto-activated draft:', lastAssistantMsg.id);
        }
      }
    }
  }, [messages, refreshEditorialMode]);

  // ✅ STEP 14A: Unlock edit when AI loading finishes
  useEffect(() => {
    if (!aiLoading && isEditLocked()) {
      unlockEdit();
      refreshEditorialMode();
      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP14A] Edit unlocked after AI response');
      }
    }
  }, [aiLoading, refreshEditorialMode]);

  // ✅ STEP 27: Reset rewrite confirmation when draft changes
  useEffect(() => {
    const currentDraftId = getActiveDraftId();
    // Reset if draft changed or no longer active
    if (rewriteConfirmedForDraftId && rewriteConfirmedForDraftId !== currentDraftId) {
      setRewriteConfirmedForDraftId(null);
      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP27] Reset rewrite confirmation - draft changed', {
          was: rewriteConfirmedForDraftId,
          now: currentDraftId,
        });
      }
    }
  }, [rewriteConfirmedForDraftId, editorialMode]);

  // ✅ STEP 27: Reset rewrite confirmation when messages cleared
  useEffect(() => {
    if (messages.length === 0 && rewriteConfirmedForDraftId) {
      setRewriteConfirmedForDraftId(null);
      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP27] Reset rewrite confirmation - messages cleared');
      }
    }
  }, [messages.length, rewriteConfirmedForDraftId]);

  // ============================================
  // STEP 15: Editorial Canon State
  // ============================================
  // Canon tracks structural integrity of the active draft.
  // Session-only state (not persisted to localStorage per privacy invariant).
  const [activeCanon, setActiveCanon] = useState<EditorialCanon | null>(null);
  // Pending canon approval state - when AI proposes changes to locked sections
  const [pendingCanonApproval, setPendingCanonApproval] = useState<{
    diff: CanonDiff;
    newText: string;
    messageId: string;
  } | null>(null);

  // ============================================
  // STEP 16: Edit Guard State
  // ============================================
  // Tracks pending edit guard approval when AI output violates expected scope.
  // Session-only state (not persisted).
  const [pendingEditGuard, setPendingEditGuard] = useState<{
    guardResult: EditGuardResult;
    requestedOp: EditorialOp;
    originalText: string;
    newText: string;
    messageId: string;
    applyMode: 'all' | 'hook' | 'body' | 'cta' | 'hashtags';
  } | null>(null);
  // Track the detected editorial op for the current instruction
  const detectedEditorialOpRef = useRef<EditorialOp | null>(null);

  // ============================================
  // STEP 17: Editorial Intent Canon State
  // ============================================
  // Tracks the editorial intent (meaning/purpose) of the active draft.
  // Session-only state (not persisted per privacy invariant).
  const [activeIntentCanon, setActiveIntentCanon] = useState<EditorialIntentCanon | null>(null);
  // Pending intent canon guard state - when AI output drifts from intent
  const [pendingIntentCanonGuard, setPendingIntentCanonGuard] = useState<{
    diff: IntentCanonDiff;
    decision: IntentGuardDecision;
    newText: string;
    messageId: string;
    applyMode: 'all' | 'hook' | 'body' | 'cta' | 'hashtags';
  } | null>(null);

  // ============================================
  // STEP 19: Edit Scope Contract State
  // ============================================
  // Tracks the active edit scope (which section is being edited, which are locked).
  // Session-only state (not persisted per privacy invariant).
  const [activeScopeContract, setActiveScopeContract] = useState<EditScopeContract | null>(null);
  // Pending scope gate state - when edit scope is ambiguous and requires user pick
  const [pendingScopeGate, setPendingScopeGate] = useState<{
    gate: ScopeGate;
    inputText: string;
  } | null>(null);
  // Ref to store the selected scope contract for passing through handleSend
  const selectedScopeContractRef = useRef<EditScopeContract | null>(null);

  // ✅ STEP 15: Initialize canon when draft is activated
  useEffect(() => {
    if (!hasActiveDraft()) {
      setActiveCanon(null);
      return;
    }

    const activeDraftId = getActiveDraftId();
    if (!activeDraftId) return;

    // Find the active draft message
    const draftMessage = messages.find(m => m.id === activeDraftId);
    if (!draftMessage || draftMessage.role !== 'assistant') return;

    // Extract canon from the draft if we don't have one yet
    if (!activeCanon || activeCanon.meta.activeDraftId !== activeDraftId) {
      const extractedCanon = extractCanonFromDraft(draftMessage.content, activeDraftId);
      // Apply default lock policy: HOOK + CTA + TONE locked, BODY unlocked
      const lockedCanon = applyCanonLocks(extractedCanon, 'default');
      setActiveCanon(lockedCanon);

      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP15] Canon initialized:', getCanonDebugSummary(lockedCanon));
      }
    }
  }, [messages, activeCanon]);

  // ✅ STEP 15: Update canon when draft content changes (after AI edit)
  const updateCanonAfterEdit = useCallback((newContent: string) => {
    if (!activeCanon) return;

    const updatedCanon = updateCanonFromText(activeCanon, newContent);
    setActiveCanon(updatedCanon);

    if (process.env.NODE_ENV === 'development') {
      console.log('[StudioEditor:STEP15] Canon updated after edit:', getCanonDebugSummary(updatedCanon));
    }
  }, [activeCanon]);

  // ✅ STEP 17: Initialize intent canon when draft is activated
  useEffect(() => {
    if (!hasActiveDraft()) {
      setActiveIntentCanon(null);
      return;
    }

    const activeDraftId = getActiveDraftId();
    if (!activeDraftId) return;

    // Find the active draft message
    const draftMessage = messages.find(m => m.id === activeDraftId);
    if (!draftMessage || draftMessage.role !== 'assistant') return;

    // Build intent canon from the draft if we don't have one yet
    if (!activeIntentCanon || activeIntentCanon.meta.draftId !== activeDraftId) {
      const intentCanon = buildIntentCanonFromDraft(draftMessage.content, {
        language: 'vi',
        platform: undefined,
        existingTone: undefined,
      });
      // Update draftId to match
      intentCanon.meta.draftId = activeDraftId;
      setActiveIntentCanon(intentCanon);

      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP17] Intent canon initialized:', getIntentCanonDebugSummary(intentCanon));
      }
    }
  }, [messages, activeIntentCanon]);

  // ✅ STEP 17: Update intent canon after accepting drift
  const updateIntentCanonAfterDrift = useCallback((newContent: string) => {
    if (!activeIntentCanon) return;

    const updatedCanon = buildIntentCanonFromDraft(newContent, {
      language: activeIntentCanon.meta.language,
      platform: activeIntentCanon.meta.platform,
    });
    // Preserve the original draftId
    updatedCanon.meta.draftId = activeIntentCanon.meta.draftId;
    setActiveIntentCanon(updatedCanon);

    if (process.env.NODE_ENV === 'development') {
      console.log('[StudioEditor:STEP17] Intent canon updated after drift:', getIntentCanonDebugSummary(updatedCanon));
    }
  }, [activeIntentCanon]);

  // ============================================
  // STEP 9: Intent Outcome Tracking State
  // ============================================
  // Track the current intent for outcome observation
  const currentIntentRef = useRef<{
    intentId: string;
    patternHash?: string;
    routeUsed: RouteUsed;
    confidence?: number;
    createdAt: number;
  } | null>(null);
  // Timer for ACCEPT_SILENTLY detection (20s after output)
  const acceptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track last output timestamp for RESEND_IMMEDIATELY detection
  const lastOutputAtRef = useRef<number>(0);
  // Track last active source for RESEND detection
  const lastActiveSourceRef = useRef<string | null>(null);

  // Cleanup outcome timers on unmount
  useEffect(() => {
    return () => {
      if (acceptTimerRef.current) {
        clearTimeout(acceptTimerRef.current);
      }
    };
  }, []);

  // ============================================
  // STEP 9: Outcome Signal Recording Helpers
  // ============================================

  /**
   * Record an outcome signal and update derived state
   */
  const recordOutcomeSignal = useCallback((
    signalType: 'UNDO_WITHIN_WINDOW' | 'EDIT_AFTER' | 'RESEND_IMMEDIATELY' | 'ACCEPT_SILENTLY',
    meta?: Record<string, string | number | boolean>
  ) => {
    const intent = currentIntentRef.current;
    if (!intent) return;

    try {
      // Update outcome in store
      const updated = outcomeStore.updateAndDerive(intent.intentId, (outcome) =>
        appendSignal(outcome, { type: signalType, meta })
      );

      if (updated && updated.patternHash) {
        // If this outcome indicates unreliability, record for learning
        if (shouldMarkUnreliable(updated)) {
          recordOutcome(
            updated.intentId,
            updated.patternHash,
            updated.derived.severity,
            updated.derived.negative
          );
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP9] Recorded outcome signal:', {
          intentId: intent.intentId,
          signalType,
          meta,
        });
      }
    } catch {
      // Fail silently - outcome tracking is non-blocking
    }
  }, []);

  /**
   * Cancel the accept timer (called when negative signal occurs)
   */
  const cancelAcceptTimer = useCallback(() => {
    if (acceptTimerRef.current) {
      clearTimeout(acceptTimerRef.current);
      acceptTimerRef.current = null;
    }
  }, []);

  /**
   * Start the accept timer (called after output is produced)
   */
  const startAcceptTimer = useCallback(() => {
    cancelAcceptTimer();

    // Set timer for 20 seconds
    acceptTimerRef.current = setTimeout(() => {
      recordOutcomeSignal('ACCEPT_SILENTLY');
      acceptTimerRef.current = null;
    }, 20000);
  }, [cancelAcceptTimer, recordOutcomeSignal]);

  /**
   * Create a new intent outcome record
   */
  const createIntentOutcome = useCallback((
    routeUsed: RouteUsed,
    patternHash?: string,
    confidence?: number
  ) => {
    const outcome = createOutcome({
      routeUsed,
      patternHash,
      confidence,
    });

    // Store in ref for signal recording
    currentIntentRef.current = {
      intentId: outcome.intentId,
      patternHash,
      routeUsed,
      confidence,
      createdAt: outcome.createdAt,
    };

    // Persist to store
    outcomeStore.put(outcome);

    if (process.env.NODE_ENV === 'development') {
      console.log('[StudioEditor:STEP9] Created outcome:', {
        intentId: outcome.intentId,
        routeUsed,
        patternHash,
      });
    }

    return outcome.intentId;
  }, []);

  // Auto-dismiss local edit toast after 5 seconds
  useEffect(() => {
    if (!localEditToast?.show) return;

    const timeRemaining = localEditToast.expiresAt - Date.now();
    if (timeRemaining <= 0) {
      setLocalEditToast(null);
      return;
    }

    const timer = setTimeout(() => {
      setLocalEditToast(null);
    }, timeRemaining);

    return () => clearTimeout(timer);
  }, [localEditToast]);

  // Undo local edit
  const undoLocalEdit = useCallback(() => {
    if (!localEditToast) return;

    const { messageId, previousContent, patternHash, intentId } = localEditToast;
    updateMessageContent(messageId, previousContent);

    // ✅ STEP 7: Record negative signal for learning loop
    if (patternHash) {
      recordNegativeSignal(patternHash, 'EDIT_IN_PLACE');
    }

    // ✅ STEP 9: Record UNDO_WITHIN_WINDOW outcome signal
    cancelAcceptTimer(); // Cancel accept timer since user undid
    recordOutcomeSignal('UNDO_WITHIN_WINDOW', { windowMs: 5000 });

    // ✅ STEP 13: Execute recovery action for tracking
    if (intentId && patternHash) {
      executeRecoveryAction({
        type: 'UNDO_LAST_INTENT',
        intentId,
        patternHash,
      }, 'vi');
    }

    setLocalEditToast(null);

    if (process.env.NODE_ENV === 'development') {
      console.log('[StudioEditor:STEP6.6] Undid local edit:', messageId, patternHash ? '(negative signal recorded)' : '');
    }
  }, [localEditToast, updateMessageContent, cancelAcceptTimer, recordOutcomeSignal]);

  // Currently, StudioEditor doesn't have explicit "edit mode" for inline editing.
  // For STEP 6.5, we consider "editing" as when there's a UI source selected.
  // In future, if inline editing is added, this can be expanded.
  const isEditing = false; // No inline edit mode currently
  const editedMessageId: string | null = null; // No edited message currently

  // ============================================
  // VALIDATION-DISPLAY CONSISTENCY
  // ============================================

  const effectiveQualityLockMap = useMemo(() => {
    const map = new Map<string, QualityLockMeta | undefined>();

    for (const message of messages) {
      if (message.role !== 'assistant' || !message.meta?.qualityLock) continue;

      const stored = message.meta.qualityLock;
      const displayedText = getDisplayedText(message.content);
      const contentHash = computeContentHash(displayedText);
      const cacheKey = `${message.id}-${contentHash}`;

      const stale = isValidationStale(displayedText, stored);

      if (stale) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[StudioEditor] Stale validation detected - re-evaluating:', {
            messageId: message.id,
            contentHash,
            storedDecision: stored.decision,
          });
          traceValidation(message.id, displayedText, displayedText, stored);
        }

        const intent = message.meta?.intent || message.meta?.templateId;
        if (isValidIntentId(intent)) {
          const reEvalResult = runQualityLock({
            intent: intent as IntentId,
            output: displayedText,
            meta: {
              templateId: message.meta?.templateId,
              language: 'vi',
              testMode: message.meta?.testMode,
            },
          });

          const newDecision =
            reEvalResult.hardFails.length > 0
              ? ('FAIL' as const)
              : reEvalResult.softFails.length > 0
              ? ('DRAFT' as const)
              : ('PASS' as const);

          if (process.env.NODE_ENV === 'development') {
            console.log('[StudioEditor] Re-evaluation result:', {
              messageId: message.id,
              oldDecision: stored.decision,
              newDecision,
              hardFails: reEvalResult.hardFails.map((f) => f.id),
            });
          }

          map.set(cacheKey, {
            decision: newDecision,
            softFails: reEvalResult.softFails,
            hardFails: reEvalResult.hardFails,
            autoFixAttempts: stored.autoFixAttempts || 0,
          });
        } else {
          map.set(cacheKey, stored);
        }
      } else {
        map.set(cacheKey, stored);
      }
    }

    return map;
  }, [messages]);

  const getEffectiveQualityLock = useCallback(
    (message: {
      id: string;
      content: string;
      meta?: {
        qualityLock?: QualityLockMeta;
        templateId?: string;
        intent?: string;
        testMode?: boolean;
      };
    }): QualityLockMeta | undefined => {
      if (!message.meta?.qualityLock) return undefined;

      const displayedText = getDisplayedText(message.content);
      const contentHash = computeContentHash(displayedText);
      const cacheKey = `${message.id}-${contentHash}`;

      return effectiveQualityLockMap.get(cacheKey) || message.meta.qualityLock;
    },
    [effectiveQualityLockMap]
  );

  // ============================================
  // AUTO-SCROLL BEHAVIOR (ChatGPT-like)
  // ============================================

  const [isNearBottom, setIsNearBottom] = useState(true);
  const isUserScrollingRef = useRef(false);
  const prevMessagesLengthRef = useRef(messages.length);
  const SCROLL_THRESHOLD = 100;

  // Get enabled intents for content type chips
  const enabledIntents = GOLDEN_INTENTS.filter((intent) => intent.enabled !== false).sort(
    (a, b) => a.order - b.order
  );

  // ============================================
  // INTENT DETECTION - Signal-based approach
  // (Used ONLY for hinting now; NOT for gating submit)
  // ============================================

  type InputState = 'empty' | 'noise' | 'short' | 'intent_weak' | 'intent_clear';

  const normalizeInput = (raw: string): string => {
    return raw
      .normalize('NFC')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const NOISE_PATTERNS = [
    /^(alo|hello|hi|hey|test|abc|123|asdf|xxx|yyy|zzz)$/i,
    /^(.)\1{2,}$/,
    /^[a-z]{1,3}$/i,
  ];

  const ACTION_VERBS = /\b(viết|tạo|làm|soạn|đặt|nghĩ|lên|draft|giúp|hỗ trợ)\b/i;

  const SPECIFIC_CONTENT_TYPES =
    /caption|bài đăng|bài viết|bài quảng cáo|bài quang cao|bài blog|bài pr|quảng cáo|quang cao|ads?|post|story|reel|reels|video|kịch bản|kich ban|script|banner|tiêu đề|tieu de|headline|mô tả sản phẩm|mo ta san pham|description|email marketing|email|thư|tin nhắn|tin nhan|message|slogan|tagline|hook|content calendar|lịch nội dung/i;

  const GENERIC_CONTENT_TYPES = /\b(bài|nội dung|noi dung|content)\b/i;

  const PLATFORMS =
    /\b(facebook|fb|instagram|ig|insta|tiktok|tik tok|youtube|yt|linkedin|twitter|x\.com|website|web|blog|fanpage|fan page|zalo|threads)\b/i;

  const TOPIC_INDICATORS =
    /\b(cho|về|ve|của|cua|bán|ban|giới thiệu|gioi thieu|quảng bá|quang ba|pr|marketing)\s+\S+/i;

  const BUSINESS_TERMS =
    /\b(quán|quan|shop|cửa hàng|cua hang|thương hiệu|thuong hieu|brand|sản phẩm|san pham|dịch vụ|dich vu|khóa học|khoa hoc|event|sự kiện|su kien|dự án|du an|project|công ty|cong ty|company|startup|spa|salon|gym|nhà hàng|nha hang|cafe|cà phê|ca phe)\b/i;

  const META_INTENT_PATTERNS = [
    /^(tôi )?(muốn |cần )?(viết|tạo|làm)( bài| nội dung| content)?$/i,
    /^viết (bài|nội dung|content)$/i,
    /^(viết|tạo|làm) (gì đó|cái gì|gì|gi do|cai gi|gi)$/i,
    /^(giúp|hỗ trợ|ho tro)( tôi| mình)?( viết| tạo| làm)?$/i,
  ];

  interface IntentSignals {
    normalized: string;
    wordCount: number;
    hasActionVerb: boolean;
    hasSpecificContentType: boolean;
    hasGenericContentType: boolean;
    hasPlatform: boolean;
    hasTopic: boolean;
    isNoise: boolean;
    isMetaIntent: boolean;
  }

  const computeSignals = (normalized: string): IntentSignals => {
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;

    const hasActionVerb = ACTION_VERBS.test(normalized);
    const hasSpecificContentType = SPECIFIC_CONTENT_TYPES.test(normalized);
    const hasGenericContentType = GENERIC_CONTENT_TYPES.test(normalized) && !hasSpecificContentType;
    const hasPlatform = PLATFORMS.test(normalized);
    const hasTopic = TOPIC_INDICATORS.test(normalized) || BUSINESS_TERMS.test(normalized);
    const isNoise = NOISE_PATTERNS.some((p) => p.test(normalized));
    const isMetaIntent = META_INTENT_PATTERNS.some((p) => p.test(normalized));

    return {
      normalized,
      wordCount,
      hasActionVerb,
      hasSpecificContentType,
      hasGenericContentType,
      hasPlatform,
      hasTopic,
      isNoise,
      isMetaIntent,
    };
  };

  const detectStateFromSignals = (signals: IntentSignals): InputState => {
    const {
      normalized,
      wordCount,
      hasActionVerb,
      hasSpecificContentType,
      hasGenericContentType,
      hasPlatform,
      hasTopic,
      isNoise,
      isMetaIntent,
    } = signals;

    if (normalized.length === 0) return 'empty';
    if (isNoise) return 'noise';

    if (isMetaIntent && !hasSpecificContentType && !hasPlatform && !hasTopic) {
      return 'intent_weak';
    }

    if (wordCount === 1) {
      if (hasSpecificContentType) return 'intent_clear';
      if (hasPlatform) return 'short';
      return 'short';
    }

    if (hasActionVerb && hasSpecificContentType) return 'intent_clear';
    if (hasActionVerb && hasGenericContentType && (hasPlatform || hasTopic)) return 'intent_clear';
    if (hasPlatform && (hasSpecificContentType || hasGenericContentType)) return 'intent_clear';
    if ((hasSpecificContentType || hasGenericContentType) && hasTopic) return 'intent_clear';
    if (hasPlatform && hasTopic) return 'intent_clear';
    if (wordCount >= 4 && (hasActionVerb || hasPlatform || hasTopic)) return 'intent_clear';

    if (wordCount >= 2) {
      if (hasSpecificContentType || hasPlatform || hasTopic) return 'intent_clear';
    }

    return 'short';
  };

  /**
   * getIntentModel:
   * - Hints are derived from signal state
   * - Submit gating is now CALM: any non-empty input can send (like ChatGPT).
   *   AI can ask follow-up instead of UI blocking.
   *
   * STEP 4.5: Progressive Hint Silence
   * - After first AI result, reduce hint verbosity
   * - When intent is clear or user is typing, minimize guidance
   * - System speaks once, then steps back
   */
  const getIntentModel = (rawInput: string, loading: boolean, hasAIResult: boolean) => {
    const normalized = normalizeInput(rawInput);
    const signals = computeSignals(normalized);
    const inputState = detectStateFromSignals(signals);

    const canSubmit = !loading && normalized.length > 0;
    const isTyping = normalized.length > 0;

    // STEP 4.5: Progressive silence - reduce hints after first result or when typing
    let hint: string;
    if (loading) {
      hint = 'AI đang xử lý…';
    } else if (hasAIResult) {
      // STEP 4.5: After AI result, stay silent unless empty
      hint = isTyping ? '' : '';
    } else if (inputState === 'intent_clear' || isTyping) {
      // STEP 4.5: When intent is clear or user is typing, stay quiet
      hint = '';
    } else {
      // First-time users only - provide minimal guidance
      switch (inputState) {
        case 'empty':
          hint = 'Mô tả ý tưởng của bạn.';
          break;
        case 'noise':
        case 'short':
        case 'intent_weak':
          // STEP 4.5: Reduce secondary hints - let user proceed
          hint = '';
          break;
        default:
          hint = '';
      }
    }

    return { normalized, signals, inputState, canSubmit, hint };
  };

  const hasResult = messages.some((m) => m.role === 'assistant');
  const { canSubmit, hint, inputState } = getIntentModel(chatInput, aiLoading, hasResult);

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  // Auto-resize textarea
  const MIN_HEIGHT = 80;
  const MAX_HEIGHT = 200;

  const handleTextareaResize = () => {
    const textarea = editorRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  };

  useEffect(() => {
    handleTextareaResize();
  }, [chatInput]);

  useEffect(() => {
    handleTextareaResize();
  }, []);

  // ============================================
  // SCROLL DETECTION & AUTO-SCROLL LOGIC
  // ============================================

  const checkIfNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    return distanceFromBottom <= SCROLL_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    }
    setIsNearBottom(true);
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      isUserScrollingRef.current = true;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const nearBottom = checkIfNearBottom();
        setIsNearBottom(nearBottom);
        isUserScrollingRef.current = false;
      }, 100);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [checkIfNearBottom]);

  useEffect(() => {
    const messageCountChanged = messages.length !== prevMessagesLengthRef.current;
    const isNewMessage = messages.length > prevMessagesLengthRef.current;

    if (messageCountChanged) {
      prevMessagesLengthRef.current = messages.length;

      if (isNewMessage && (isNearBottom || messages.length === 1)) {
        requestAnimationFrame(() => {
          const container = messagesContainerRef.current;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }
    }
  }, [messages, isNearBottom]);

  useEffect(() => {
    if (aiLoading && isNearBottom) {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  }, [aiLoading, isNearBottom]);

  // ============================================
  // STEP 6.5: Generate hash for confirmation context
  // ============================================
  const generateConfirmationHash = useCallback(
    (inputText: string, editedId: string | null, sourceId: string | null): string => {
      return `${inputText.trim().substring(0, 50)}|${editedId || 'none'}|${sourceId || 'none'}`;
    },
    []
  );

  // ============================================
  // STEP 6.5 + STEP 7: Resolve Intent Choice
  // ============================================
  const resolveIntentChoice = useCallback(
    (choice: IntentChoice) => {
      if (!pendingIntentChoice) return;

      const { inputText, editedMessageId: pendingEditedId, uiSourceMessageId } = pendingIntentChoice;

      // Save choice for "don't ask twice" behavior (session-level)
      setLastIntentChoice(choice);
      setLastConfirmationHash(generateConfirmationHash(inputText, pendingEditedId, uiSourceMessageId));

      // ✅ STEP 7 + STEP 14: Record choice for learning loop (persistent)
      // Respects governance: only record if learning is allowed for this user/role
      const hasLastValid = messages.some(m => m.role === 'assistant');
      const normalizedInstruction = inputText.toLowerCase().normalize('NFC').trim();
      const patternHash = computePatternHash({
        normalizedInstruction,
        hasActiveSource: !!uiSourceMessageId,
        hasLastValidAssistant: hasLastValid,
        uiSourceMessageId,
      });

      // Only record choice if governance allows learning (or governance is inactive)
      if (!isGovernanceActive() || isLearningAllowed()) {
        recordChoice(patternHash, choice);
      } else if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP14] Learning blocked by governance');
      }

      // ✅ STEP 9 + STEP 11: Get debug context for outcome and continuity tracking
      const debugContext = pendingDebugContextRef.current;

      // ✅ STEP 11: Update continuity state with user's choice
      const newContinuity = updateContinuityState(continuityState, {
        intentType: choice === 'CREATE_NEW' ? 'CREATE' : choice === 'EDIT_IN_PLACE' ? 'EDIT_IN_PLACE' : 'TRANSFORM',
        patternHash,
        choice,
        routeHint: debugContext?.confidenceResult.routeHint,
      });
      setContinuityState(newContinuity);

      // ✅ STEP 12 + STEP 14: Record preference signals from user choice
      // Respects governance: only record if learning is allowed
      if (!isGovernanceActive() || isLearningAllowed()) {
        const prefContext: PreferenceContext = {
          routeHint: debugContext?.confidenceResult.routeHint,
          hasActiveSource: !!uiSourceMessageId,
          inputLength: inputText.length,
          stabilityBand: debugContext?.stability?.band,
        };
        const choiceSignals = detectChoiceSignals(choice, prefContext);
        for (const signal of choiceSignals) {
          recordPreference(signal);
        }
        // Also detect signals from the instruction itself
        const instructionSignals = detectInstructionSignals(inputText);
        for (const signal of instructionSignals) {
          recordPreference(signal);
        }
      }

      // ✅ STEP 9: Create outcome record for tracking
      createIntentOutcome(
        choiceToRoute(choice),
        patternHash,
        debugContext?.confidenceResult.intentConfidence
      );

      // Clear pending state before action
      setPendingIntentChoice(null);

      switch (choice) {
        case 'EDIT_IN_PLACE': {
          // ============================================
          // STEP 6.6: EDIT_IN_PLACE - Local Apply Pathway
          // ============================================
          // NO LLM call - apply deterministic local transforms
          const sourceId = pendingEditedId || uiSourceMessageId;
          if (!sourceId) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[StudioEditor:STEP6.6] EDIT_IN_PLACE but no source');
            }
            // Fallback to TRANSFORM if no source
            handleSend();
            break;
          }

          // Find source message content
          const sourceMessage = messages.find(m => m.id === sourceId);
          if (!sourceMessage || sourceMessage.role !== 'assistant') {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[StudioEditor:STEP6.6] Source message not found or not assistant');
            }
            handleSend();
            break;
          }

          // Try local apply
          const result = localApply(sourceMessage.content, inputText);

          if (result.ok && result.nextContent) {
            // Success! Apply locally without LLM
            if (process.env.NODE_ENV === 'development') {
              console.log('[StudioEditor:STEP6.6] Local apply success:', {
                messageId: sourceId,
                appliedOps: result.appliedOps,
              });
            }

            // Store previous content for undo
            const previousContent = sourceMessage.content;

            // Update message content in-place
            updateMessageContent(sourceId, result.nextContent);

            // Clear input
            setChatInput('');

            // Show undo toast (5 second window)
            // ✅ STEP 7: Include patternHash for negative signal tracking
            setLocalEditToast({
              show: true,
              message: result.reason,
              messageId: sourceId,
              previousContent,
              expiresAt: Date.now() + 5000,
              patternHash, // From STEP 7 learning loop
            });

            // ✅ STEP 9: Start accept timer for silent acceptance detection
            lastOutputAtRef.current = Date.now();
            lastActiveSourceRef.current = sourceId;
            startAcceptTimer();
          } else {
            // Local apply failed - fallback to LLM transform
            if (process.env.NODE_ENV === 'development') {
              console.log('[StudioEditor:STEP6.6] Local apply failed, falling back to LLM:', result.reason);
            }
            if (setActiveSource) {
              setActiveSource(sourceId);
            }
            handleSend();
          }
          break;
        }

        case 'TRANSFORM_NEW_VERSION':
          // TRANSFORM_NEW_VERSION: Ensure correct source is bound
          // Priority: editedMessageId > uiSourceMessageId
          const sourceToUse = pendingEditedId || uiSourceMessageId;
          if (sourceToUse && setActiveSource) {
            setActiveSource(sourceToUse);
          }
          if (process.env.NODE_ENV === 'development') {
            console.log('[StudioEditor:STEP6.5] TRANSFORM_NEW_VERSION, source:', sourceToUse);
          }
          handleSend();
          break;

        case 'CREATE_NEW':
          // CREATE_NEW: Clear any active source and send
          if (setActiveSource) {
            setActiveSource(null);
          }
          if (process.env.NODE_ENV === 'development') {
            console.log('[StudioEditor:STEP6.5] CREATE_NEW, clearing source');
          }
          handleSend();
          break;
      }
    },
    [pendingIntentChoice, handleSend, setActiveSource, generateConfirmationHash, messages, updateMessageContent, setChatInput, createIntentOutcome, startAcceptTimer, continuityState]
  );

  // ============================================
  // STEP 6.5: Cancel Confirmation
  // ============================================
  const cancelIntentConfirmation = useCallback(() => {
    setPendingIntentChoice(null);
  }, []);

  // ============================================
  // STEP 14A: Handle Create Warning Response
  // ============================================
  const handleCreateWarningResponse = useCallback((confirmation: CreateConfirmation) => {
    handleCreateConfirmation(confirmation);
    setShowCreateWarning(false);

    if (confirmation === 'CREATE_NEW' && pendingCreateIntent) {
      // User explicitly wants new draft - enter create mode and send
      enterCreateMode();
      refreshEditorialMode();
      if (setActiveSource) {
        setActiveSource(null);
      }
      handleSend();
    } else if (confirmation === 'CONTINUE_EDITING') {
      // User wants to continue editing - re-attempt with EDIT_IN_PLACE forced
      // The override is already applied, just proceed
      handleSend();
    }

    setPendingCreateIntent(null);
  }, [pendingCreateIntent, handleSend, setActiveSource, refreshEditorialMode]);

  // ============================================
  // STEP 27: Handle Rewrite Confirmation Response
  // ============================================
  const handleRewriteConfirmation = useCallback(() => {
    const currentDraftId = getActiveDraftId();
    if (!currentDraftId) {
      // Edge case: draft disappeared while dialog was shown
      setShowRewriteConfirmation(false);
      pendingRewriteInputRef.current = null;
      return;
    }

    // Mark as confirmed for this draft (UI state only)
    setRewriteConfirmedForDraftId(currentDraftId);
    setShowRewriteConfirmation(false);

    if (process.env.NODE_ENV === 'development') {
      console.log('[StudioEditor:STEP27] Rewrite confirmed for draft', currentDraftId);
    }

    // Proceed with original send
    pendingRewriteInputRef.current = null;
    handleSend();
  }, [handleSend]);

  const handleRewriteCreateNew = useCallback(() => {
    // User wants to create new instead - switch to CREATE mode
    setShowRewriteConfirmation(false);
    pendingRewriteInputRef.current = null;
    setRewriteConfirmedForDraftId(null);

    // Enter create mode and clear source
    enterCreateMode();
    refreshEditorialMode();
    if (setActiveSource) {
      setActiveSource(null);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[StudioEditor:STEP27] User chose CREATE instead of REWRITE');
    }

    // User needs to re-send with different intent
    // Don't auto-send - let them adjust their prompt if needed
  }, [setActiveSource, refreshEditorialMode]);

  const handleRewriteCancel = useCallback(() => {
    setShowRewriteConfirmation(false);
    pendingRewriteInputRef.current = null;

    if (process.env.NODE_ENV === 'development') {
      console.log('[StudioEditor:STEP27] Rewrite confirmation cancelled');
    }
  }, []);

  // ============================================
  // STEP 19: Handle Scope Pick Response
  // ============================================
  const handleScopePickResponse = useCallback((pickedTarget: 'HOOK' | 'BODY' | 'CTA' | 'TONE' | 'FULL') => {
    if (!pendingScopeGate) return;

    const { inputText } = pendingScopeGate;
    const lang = (language as 'vi' | 'en') || 'vi';

    // Extract locked sections from activeCanon (STEP 15)
    const canonLockedSections: ('HOOK' | 'BODY' | 'CTA')[] = [];
    if (activeCanon?.hook.locked) canonLockedSections.push('HOOK');
    if (activeCanon?.cta.locked) canonLockedSections.push('CTA');

    // Build contract with user-picked target
    const contract = buildEditScopeContract({
      instructionText: inputText,
      lang,
      activeCanonLocks: canonLockedSections,
      hasActiveCanon: !!activeCanon,
      userPickedTarget: pickedTarget,
    });

    // Store for badge display
    setActiveScopeContract(contract);
    // Store in ref for passing through handleSend
    selectedScopeContractRef.current = contract;

    if (process.env.NODE_ENV === 'development') {
      console.log('[StudioEditor:STEP19] User picked scope:', {
        target: contract.target,
        lockedSections: contract.lockedSections,
        source: contract.source,
      });
    }

    // Clear pending gate
    setPendingScopeGate(null);

    // Now proceed with send
    handleSend();
  }, [pendingScopeGate, language, activeCanon, handleSend]);

  // ============================================
  // STEP 19: Cancel Scope Pick
  // ============================================
  const cancelScopePick = useCallback(() => {
    setPendingScopeGate(null);
  }, []);

  // ============================================
  // STEP 6.5 + STEP 7 + STEP 8 + STEP 9 + STEP 14 + STEP 14A: Attempt Send with Confirmation, Learning, Debug, Outcome, Governance & Editorial Authority
  // ============================================
  const attemptSend = useCallback(() => {
    if (!canSubmit) return;

    // ✅ STEP 14A: Check if edit is locked (waiting for LLM response)
    if (isEditLocked()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP14A] Edit locked, ignoring send');
      }
      return;
    }

    // ✅ STEP 14: Get governance context and check execution permission
    const governanceContext = getGovernanceContext();
    if (isGovernanceActive() && !isExecutionAllowed()) {
      // VIEWER role cannot execute - show message and return
      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP14] Execution blocked by governance:', {
          role: governanceContext?.role,
          userId: governanceContext?.userId,
        });
      }
      // TODO: Could show a toast message here
      return;
    }

    // ✅ STEP 9: Check for RESEND_IMMEDIATELY (within 10s of last output, same source)
    const timeSinceOutput = Date.now() - lastOutputAtRef.current;
    if (timeSinceOutput < 10000 && lastOutputAtRef.current > 0) {
      // User resent quickly - record as potential negative signal
      cancelAcceptTimer();
      recordOutcomeSignal('RESEND_IMMEDIATELY', {
        withinMs: timeSinceOutput,
        sameSource: activeSourceId === lastActiveSourceRef.current,
      });
    }

    const inputText = chatInput.trim();
    const currentSourceId = activeSourceId;
    const hasLastValid = messages.some(m => m.role === 'assistant');

    // ============================================
    // STEP 22: REWRITE_UPGRADE Context Guard (UI pre-flight)
    // ============================================
    // Detect task type EARLY to check if REWRITE_UPGRADE is attempted without context.
    // This provides immediate user feedback without waiting for server response.
    const taskDetectionCtx: TaskDetectionContext = {
      hasActiveDraft: hasActiveDraft(),
      hasPreviousMessages: hasLastValid,
      lang: (language as 'vi' | 'en') || 'vi',
    };
    const taskDetection = detectTaskType(inputText, taskDetectionCtx);

    // ============================================
    // STEP 29: Kill-Switch Gate
    // ============================================
    // When kill-switch is active, route REWRITE_UPGRADE to CREATE.
    // Detection still runs for telemetry, but flow is redirected.
    const rewriteEnabled = isRewriteUpgradeEnabled();
    if (taskDetection.taskType === 'REWRITE_UPGRADE' && !rewriteEnabled) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP29] Kill-switch active, routing to CREATE', {
          detectedTaskType: taskDetection.taskType,
          killSwitchActive: true,
        });
      }
      // Fall through to CREATE path - no special REWRITE_UPGRADE handling
      // The rest of attemptSend will treat this as a normal CREATE
    }

    if (taskDetection.taskType === 'REWRITE_UPGRADE' && rewriteEnabled) {
      const hasContext = taskDetectionCtx.hasActiveDraft || taskDetectionCtx.hasPreviousMessages;
      if (!hasContext) {
        // BLOCK: Show error message to user, do NOT call LLM
        const errorMessage = REWRITE_NO_CONTEXT_ERROR[taskDetectionCtx.lang];

        if (process.env.NODE_ENV === 'development') {
          console.warn('[StudioEditor:STEP22] BLOCKED: REWRITE_UPGRADE without context', {
            inputText: inputText.substring(0, 50),
            taskType: taskDetection.taskType,
            hasActiveDraft: taskDetectionCtx.hasActiveDraft,
            hasPreviousMessages: taskDetectionCtx.hasPreviousMessages,
          });
        }

        // Display error using existing aiError mechanism (rendered in UI)
        setAiError(errorMessage);

        return; // DO NOT proceed to handleSend - no LLM call
      }

      // ============================================
      // STEP 27: Rewrite Intent Confirmation Gate
      // ============================================
      // Show confirmation dialog ONCE per draft before first REWRITE_UPGRADE
      const currentDraftId = getActiveDraftId();
      if (taskDetectionCtx.hasActiveDraft && currentDraftId) {
        // Check if user has already confirmed for this draft
        if (rewriteConfirmedForDraftId !== currentDraftId) {
          // Need confirmation - store input and show dialog
          pendingRewriteInputRef.current = inputText;
          setShowRewriteConfirmation(true);

          if (process.env.NODE_ENV === 'development') {
            console.log('[StudioEditor:STEP27] Showing rewrite confirmation', {
              draftId: currentDraftId,
              inputPreview: inputText.substring(0, 50),
            });
          }

          return; // DO NOT proceed - wait for user confirmation
        }
        // Already confirmed for this draft - proceed normally
        if (process.env.NODE_ENV === 'development') {
          console.log('[StudioEditor:STEP27] Rewrite already confirmed for draft', currentDraftId);
        }
      }
    }

    // ============================================
    // STEP 7: Compute confidence for observability
    // ============================================
    const explicitNewCreate = isExplicitNewCreate(inputText);
    const explicitTransformRef = isExplicitTransformReference(inputText);
    const ambiguousTransform = isAmbiguousInstruction(inputText);

    const confidenceInput: ConfidenceInput = {
      inputText,
      hasActiveSource: !!currentSourceId,
      hasLastValidAssistant: hasLastValid,
      isExplicitNewCreate: explicitNewCreate,
      isExplicitTransformRef: explicitTransformRef,
      isAmbiguousTransform: ambiguousTransform,
      inputLength: inputText.length,
    };

    const confidenceResult = computeRouteConfidence(confidenceInput);

    // ============================================
    // STEP 7: Compute pattern hash for learning
    // ============================================
    const normalizedInstruction = inputText.toLowerCase().normalize('NFC').trim();
    const patternHash = computePatternHash({
      normalizedInstruction,
      hasActiveSource: !!currentSourceId,
      hasLastValidAssistant: hasLastValid,
      uiSourceMessageId: currentSourceId,
    });

    // ============================================
    // STEP 8: Helper to log and set debug decision
    // ============================================
    const logDebugDecision = (path: DecisionPath, choice?: IntentChoice, autoApply?: IntentChoice) => {
      if (!isIntentDebugEnabled()) return;

      const learned = getLearnedChoice(patternHash);
      const decision = createDebugDecision({
        patternHash,
        confidenceInput,
        confidenceResult,
        decisionPath: path,
        autoApplyChoice: autoApply || null,
        learnedCount: learned?.count,
        confirmationShown: path === 'CONFIRMATION_SHOWN' || path === 'USER_CONFIRMED',
        uiSourceMessageId: currentSourceId,
        finalChoice: choice,
      });

      setLastDebugDecision(decision);
      logIntentDecision(decision);
    };

    // ============================================
    // STEP 14A: Editorial Authority Override (CRITICAL)
    // When a draft is active, FORCE route to EDIT_IN_PLACE
    // ============================================
    const detectedIntent: 'CREATE' | 'TRANSFORM' | 'EDIT_IN_PLACE' =
      explicitNewCreate ? 'CREATE' :
      confidenceResult.routeHint === 'CREATE' ? 'CREATE' : 'TRANSFORM';

    const editorialOverride = checkIntentOverride(detectedIntent);

    if (editorialOverride.blocked && editorialOverride.showCreateWarning) {
      // Draft is active - show warning before allowing CREATE/TRANSFORM
      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP14A] Editorial override - showing create warning:', {
          attempted: editorialOverride.originalIntent,
          enforced: editorialOverride.finalIntent,
          reason: editorialOverride.reason,
        });
      }

      // Store the pending intent for when user confirms
      setPendingCreateIntent({
        originalIntent: detectedIntent,
        inputText,
      });
      setShowCreateWarning(true);
      return;
    }

    if (editorialOverride.overridden) {
      // Editorial authority overrode the intent - use EDIT_IN_PLACE
      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP14A] Intent overridden to EDIT_IN_PLACE:', {
          original: editorialOverride.originalIntent,
          reason: editorialOverride.reason,
        });
      }

      // Force EDIT_IN_PLACE path - lock for edit and proceed
      lockForEdit();
      refreshEditorialMode();

      const lang = (language as 'vi' | 'en') || 'vi';

      // ============================================
      // STEP 20: Edit Intent Normalization (BEFORE STEP 19)
      // Translates natural VN/EN edit language → canonical edit intent
      // This helps understand "thêm thông tin" as EDIT_IN_PLACE + BODY
      // ============================================
      const normalizedIntent = normalizeEditIntent(inputText, {
        hasActiveDraft: hasActiveDraft(),
        canonLockState: activeCanon ? {
          lockedSections: [
            ...(activeCanon.hook.locked ? ['HOOK' as const] : []),
            ...(activeCanon.cta.locked ? ['CTA' as const] : []),
          ],
          hasActiveCanon: true,
        } : undefined,
        lang,
      });

      if (process.env.NODE_ENV === 'development' && normalizedIntent) {
        console.log('[StudioEditor:STEP20] Edit intent normalized:', {
          target: normalizedIntent.target,
          confidence: normalizedIntent.confidence,
          reason: normalizedIntent.reason,
          matchedPatterns: normalizedIntent.matchedPatterns,
        });
      }

      // ============================================
      // STEP 19: Edit Scope Gating (CRITICAL)
      // BEFORE sending, check if scope is ambiguous.
      // If so, gate execution until user picks scope.
      // STEP 20 normalization helps reduce false ambiguity.
      // ============================================

      // ============================================
      // STEP 21: Edit Patch Execution Layer
      // When EDIT intent + target are HIGH confidence → NEVER block execution.
      // Skip scope gating for ANY specific target (not just BODY).
      // ============================================
      const skipScopeGating = !!normalizedIntent &&
        normalizedIntent.confidence === 'HIGH' &&
        normalizedIntent.target !== 'FULL';

      const scopeGate = skipScopeGating
        ? { requiresUserPick: false, suggested: undefined }
        : shouldGateForScopePick(inputText, !!activeCanon, lang);

      if (scopeGate.requiresUserPick) {
        // Scope is ambiguous - gate execution
        if (process.env.NODE_ENV === 'development') {
          console.log('[StudioEditor:STEP19] Scope gating - requires user pick:', {
            suggested: scopeGate.suggested,
            inputText: inputText.substring(0, 50),
          });
        }

        // Store the pending scope gate
        setPendingScopeGate({
          gate: scopeGate,
          inputText,
        });

        // DO NOT call handleSend - return and wait for user pick
        return;
      }

      // Scope is clear - build contract and proceed
      // Extract locked sections from activeCanon (STEP 15)
      const canonLockedSections: ('HOOK' | 'BODY' | 'CTA')[] = [];
      if (activeCanon?.hook.locked) canonLockedSections.push('HOOK');
      if (activeCanon?.cta.locked) canonLockedSections.push('CTA');

      // Use STEP 20 normalized target if available with HIGH confidence,
      // otherwise let STEP 19 buildEditScopeContract detect it
      const userPickedTarget = normalizedIntent?.confidence === 'HIGH'
        ? normalizedIntent.target
        : undefined;

      const contract = buildEditScopeContract({
        instructionText: inputText,
        lang,
        activeCanonLocks: canonLockedSections,
        hasActiveCanon: !!activeCanon,
        userPickedTarget, // Use STEP 20 result if HIGH confidence
      });

      // Store for badge display
      setActiveScopeContract(contract);
      // Store in ref for passing through handleSend
      selectedScopeContractRef.current = contract;

      // ============================================
      // STEP 21: Build edit patch metadata
      // This enables partial edits (BODY-only, CTA-only, etc.)
      // without requiring full Hook/Body/CTA structure.
      // ============================================
      const editPatchMeta = normalizedIntent ? buildEditPatchMeta(normalizedIntent) : null;
      const skipStructureValidation = shouldSkipStructureValidation(normalizedIntent);
      const partialOutputAllowed = allowsPartialOutput(normalizedIntent);

      // ✅ STEP 21: Set edit patch meta in context before handleSend
      setEditPatchMeta(editPatchMeta);

      // ============================================
      // STEP 22: Build output contract from patch meta
      // When we have a patch target, enforce PATCH_ONLY output format.
      // This instructs LLM to return [PATCH] blocks only, not full rewrites.
      // ============================================
      const outputContract = buildOutputContractFromMeta(editPatchMeta);
      setOutputContract(outputContract);

      if (process.env.NODE_ENV === 'development') {
        console.log('[StudioEditor:STEP19] Scope contract built:', {
          target: contract.target,
          lockedSections: contract.lockedSections,
          source: contract.source,
          confidence: contract.confidence,
        });
        console.log('[StudioEditor:STEP21] Edit patch config:', {
          patchMeta: editPatchMeta ? getEditPatchDebugSummary(editPatchMeta) : 'none',
          skipStructureValidation,
          partialOutputAllowed,
        });
        console.log('[StudioEditor:STEP22] Output contract:', {
          contract: getOutputContractDebugSummary(outputContract),
        });
      }

      // Log debug decision for editorial override
      logDebugDecision('EXPLICIT_TRANSFORM_REF', 'EDIT_IN_PLACE'); // Reuse path for now
      createIntentOutcome('TRANSFORM', patternHash, confidenceResult.intentConfidence); // EDIT_IN_PLACE uses TRANSFORM route

      // Ensure source is set to the active draft
      const activeDraft = getActiveDraftId();
      if (activeDraft && setActiveSource) {
        setActiveSource(activeDraft);
      }

      handleSend();
      return;
    }

    // ============================================
    // Check for escape hatches first (high confidence paths)
    // ============================================
    if (explicitNewCreate) {
      // Explicit CREATE: clear source and send directly
      logDebugDecision('EXPLICIT_NEW_CREATE', 'CREATE_NEW');
      // ✅ STEP 9: Create outcome for explicit create
      createIntentOutcome('CREATE', patternHash, confidenceResult.intentConfidence);
      if (setActiveSource) {
        setActiveSource(null);
      }
      handleSend();
      return;
    }

    if (explicitTransformRef) {
      // Explicit TRANSFORM reference: send directly with current binding
      logDebugDecision('EXPLICIT_TRANSFORM_REF', 'TRANSFORM_NEW_VERSION');
      // ✅ STEP 9: Create outcome for explicit transform
      createIntentOutcome('TRANSFORM', patternHash, confidenceResult.intentConfidence);
      handleSend();
      return;
    }

    // ============================================
    // Check if we should confirm
    // ============================================
    const needsConfirmation = shouldConfirmIntent({
      isEditing,
      editedMessageId,
      uiSourceMessageId: currentSourceId,
      inputText,
    });

    if (!needsConfirmation) {
      // No confirmation needed, send directly
      const defaultChoice = confidenceResult.routeHint === 'CREATE' ? 'CREATE_NEW' : 'TRANSFORM_NEW_VERSION';
      logDebugDecision('DEFAULT_NO_CONFIRM', defaultChoice);
      // ✅ STEP 9: Create outcome for default path
      createIntentOutcome(
        confidenceResult.routeHint === 'CREATE' ? 'CREATE' : 'TRANSFORM',
        patternHash,
        confidenceResult.intentConfidence
      );
      handleSend();
      return;
    }

    // ============================================
    // STEP 7 + STEP 13 + STEP 14: Check learned choices (learning loop)
    // Respects user control AND governance: only auto-apply if both allow
    // ============================================
    const canAutoApply = isAutoApplyEnabled() && (!isGovernanceActive() || isAutoApplyAllowedByGovernance());
    const autoApplyChoice = canAutoApply ? getAutoApplyChoice(patternHash) : null;
    if (autoApplyChoice) {
      // Log debug decision for auto-apply
      logDebugDecision('LEARNED_CHOICE', autoApplyChoice, autoApplyChoice);
      // ✅ STEP 9: Create outcome for auto-applied choice
      createIntentOutcome(choiceToRoute(autoApplyChoice), patternHash, confidenceResult.intentConfidence);

      // Apply the learned choice directly (same as resolveIntentChoice but without UI)
      switch (autoApplyChoice) {
        case 'EDIT_IN_PLACE':
        case 'TRANSFORM_NEW_VERSION':
          handleSend();
          break;
        case 'CREATE_NEW':
          if (setActiveSource) {
            setActiveSource(null);
          }
          handleSend();
          break;
      }
      return;
    }

    // ============================================
    // Check "don't ask twice" - session-level cache (existing behavior)
    // ============================================
    const currentHash = generateConfirmationHash(inputText, editedMessageId, currentSourceId);
    if (lastConfirmationHash === currentHash && lastIntentChoice) {
      // Log debug decision for cached choice
      logDebugDecision('SESSION_CACHE', lastIntentChoice);
      // ✅ STEP 9: Create outcome for cached choice
      createIntentOutcome(choiceToRoute(lastIntentChoice), patternHash, confidenceResult.intentConfidence);

      // Apply the cached choice directly
      switch (lastIntentChoice) {
        case 'EDIT_IN_PLACE':
        case 'TRANSFORM_NEW_VERSION':
          handleSend();
          break;
        case 'CREATE_NEW':
          if (setActiveSource) {
            setActiveSource(null);
          }
          handleSend();
          break;
      }
      return;
    }

    // ============================================
    // STEP 10: Compute stability and check confirmation gating
    // ============================================
    const stability = computeStability(patternHash);
    const confirmGating = getConfirmationGating(stability);

    // ============================================
    // STEP 11: Helper to update continuity state after a decision
    // ============================================
    const updateContinuity = (choice: IntentChoice) => {
      const newContinuity = updateContinuityState(continuityState, {
        intentType: choice === 'CREATE_NEW' ? 'CREATE' : choice === 'EDIT_IN_PLACE' ? 'EDIT_IN_PLACE' : 'TRANSFORM',
        patternHash,
        choice,
        routeHint: confidenceResult.routeHint,
      });
      setContinuityState(newContinuity);
    };

    if (confirmGating === 'SKIP') {
      // HIGH stability + auto-apply eligible: skip confirmation
      const defaultChoice = confidenceResult.routeHint === 'CREATE' ? 'CREATE_NEW' : 'TRANSFORM_NEW_VERSION';
      logDebugDecision('HIGH_CONFIDENCE_AUTO', defaultChoice);
      // ✅ STEP 9: Create outcome for stability-skipped confirmation
      createIntentOutcome(
        confidenceResult.routeHint === 'CREATE' ? 'CREATE' : 'TRANSFORM',
        patternHash,
        confidenceResult.intentConfidence
      );
      // ✅ STEP 11: Update continuity state
      updateContinuity(defaultChoice);
      handleSend();
      return;
    }

    // ============================================
    // STEP 11: Check continuity-based confirmation skip
    // ============================================
    const continuitySkip = shouldSkipConfirmationByContext({
      continuity: continuityState,
      stabilityBand: stability.band,
      routeHint: confidenceResult.routeHint,
      autoApplyEligible: stability.autoApplyEligible,
    });

    if (continuitySkip === 'SKIP') {
      // Continuity suggests we can skip (e.g., REFINE_FLOW + matching hint)
      const defaultChoice = confidenceResult.routeHint === 'CREATE' ? 'CREATE_NEW' : 'TRANSFORM_NEW_VERSION';
      logDebugDecision('HIGH_CONFIDENCE_AUTO', defaultChoice);
      createIntentOutcome(
        confidenceResult.routeHint === 'CREATE' ? 'CREATE' : 'TRANSFORM',
        patternHash,
        confidenceResult.intentConfidence
      );
      updateContinuity(defaultChoice);
      handleSend();
      return;
    }

    // ============================================
    // STEP 12 + STEP 13 + STEP 14: Compute preference bias for debug display and ordering
    // Respects user control AND governance: only compute if both allow
    // ============================================
    const canUsePreferenceBias = arePreferencesEnabled() && (!isGovernanceActive() || isPreferenceBiasAllowed());
    const preferenceBias = canUsePreferenceBias
      ? getPreferenceBias({
          routeHint: confidenceResult.routeHint,
          hasActiveSource: !!currentSourceId,
          inputLength: inputText.length,
          stabilityBand: stability.band,
        })
      : { activePreferences: [], defaultChoiceBias: undefined, defaultChoiceStrength: 0, optionOrderBias: [], debugSummary: isGovernanceActive() ? 'Preferences disabled by governance' : 'Preferences disabled' };

    // ✅ STEP 14: Compute governance decision for confirmation flow
    const governanceDecision = governanceContext
      ? shouldForceConfirmation(
          governanceContext,
          {
            patternHash,
            routeHint: confidenceResult.routeHint,
            confidence: confidenceResult.intentConfidence,
            autoApplySuggested: !!autoApplyChoice,
          },
          continuityState,
          stability.band
        )
      : null;

    // ============================================
    // STEP 8 + STEP 14: Store pending debug context for confirmation resolution
    // ============================================
    pendingDebugContextRef.current = {
      patternHash,
      confidenceInput,
      confidenceResult,
      uiSourceMessageId: currentSourceId,
      // ✅ STEP 10: Include stability metrics for debug display
      stability,
      // ✅ STEP 11: Include continuity state for debug display
      continuity: continuityState,
      // ✅ STEP 12: Include preference bias for debug display
      preferenceBias,
      // ✅ STEP 14: Include governance decision for debug display
      governanceDecision: governanceDecision ?? undefined,
    };

    // Log that confirmation is being shown
    logDebugDecision('CONFIRMATION_SHOWN');

    // ============================================
    // Show confirmation UI
    // ============================================
    if (process.env.NODE_ENV === 'development') {
      console.log('[StudioEditor:STEP6.5] Showing intent confirmation:', {
        inputText: inputText.substring(0, 50),
        editedMessageId,
        uiSourceMessageId: currentSourceId,
        patternHash,
        intentConfidence: confidenceResult.intentConfidence.toFixed(2),
        stabilityBand: stability.band,
        confirmGating,
      });
    }

    setPendingIntentChoice({
      inputText,
      editedMessageId,
      uiSourceMessageId: currentSourceId,
    });
  }, [
    canSubmit,
    chatInput,
    activeSourceId,
    messages,
    isEditing,
    editedMessageId,
    handleSend,
    setActiveSource,
    lastIntentChoice,
    lastConfirmationHash,
    generateConfirmationHash,
    createIntentOutcome,
    cancelAcceptTimer,
    recordOutcomeSignal,
    // ✅ STEP 11: Include continuity state for flow detection
    continuityState,
  ]);

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    attemptSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) {
        attemptSend();
      }
    }
    // ESC to cancel confirmation
    if (e.key === 'Escape' && pendingIntentChoice) {
      e.preventDefault();
      cancelIntentConfirmation();
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const onTransformAction = useCallback(
    (action: ActionType, messageId: string) => {
      if (handleTransformAction) {
        handleTransformAction(action, messageId);
      }
    },
    [handleTransformAction]
  );

  const activeSourceContent = activeSourceId ? messages.find((m) => m.id === activeSourceId)?.content || '' : '';

  const handleChangeSource = useCallback(() => {
    setIsSourcePickerMode(true);
    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectSource = useCallback(
    (messageId: string) => {
      if (isSourcePickerMode && setActiveSource) {
        setActiveSource(messageId);
        setIsSourcePickerMode(false);
      }
    },
    [isSourcePickerMode, setActiveSource]
  );

  // Entry state
  const isEntryState = messages.length === 0;

  // Check if actions should be disabled (loading states)
  const isActionDisabled = aiLoading || !!transformLoading;

  // ============================================
  // STEP 6.5 + STEP 8: Intent Confirmation Panel with Debug
  // ============================================
  const renderIntentConfirmation = () => {
    if (!pendingIntentChoice) return null;

    // Get pending debug context for explainability
    const debugContext = pendingDebugContextRef.current;

    // ✅ STEP 10 + STEP 13: Get trust microcopy for display
    const hasActivePrefs = arePreferencesEnabled() && (debugContext?.preferenceBias?.activePreferences?.length ?? 0) > 0;

    return (
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 mb-2 animate-fade-in">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Bạn muốn áp dụng yêu cầu này cho đâu?
            </p>
            {/* ✅ STEP 13: Trust microcopy (production-safe) */}
            <TrustMicrocopy
              stabilityMetrics={debugContext?.stability}
              hasActivePreferences={hasActivePrefs}
              language="vi"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Option 1: Edit in place (only show if editing) */}
            {isEditing && editedMessageId && (
              <button
                type="button"
                onClick={() => resolveIntentChoice('EDIT_IN_PLACE')}
                disabled={isActionDisabled}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-card border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>✏️</span>
                <span>Sửa trực tiếp nội dung đang mở</span>
              </button>
            )}

            {/* Option 2: Transform (create new version) */}
            <button
              type="button"
              onClick={() => resolveIntentChoice('TRANSFORM_NEW_VERSION')}
              disabled={isActionDisabled}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-card border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>🔁</span>
              <span>Tạo phiên bản mới từ nội dung này</span>
            </button>

            {/* Option 3: Create new */}
            <button
              type="button"
              onClick={() => resolveIntentChoice('CREATE_NEW')}
              disabled={isActionDisabled}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-card border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>🆕</span>
              <span>Viết nội dung mới</span>
            </button>
          </div>

          {/* Cancel link */}
          <button
            type="button"
            onClick={cancelIntentConfirmation}
            className="mt-3 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
          >
            Hủy
          </button>

          {/* STEP 8: Debug explainability (DEV only) */}
          {debugContext && (
            <IntentConfirmExplain
              confidence={debugContext.confidenceResult.intentConfidence}
              routeHint={debugContext.confidenceResult.routeHint}
              reason={debugContext.confidenceResult.reason}
              hasActiveSource={debugContext.confidenceInput.hasActiveSource}
              hasLastValidAssistant={debugContext.confidenceInput.hasLastValidAssistant}
              patternHash={debugContext.patternHash}
              stability={debugContext.stability}
              continuity={debugContext.continuity}
            />
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // STEP 14A: Editorial Authority Create Warning Modal
  // ============================================
  const renderCreateWarning = () => {
    if (!showCreateWarning) return null;

    const copy = getCreateWarningCopy('vi');

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
        <div className="bg-card rounded-xl shadow-xl max-w-md w-full mx-4 p-6 border border-border">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">✏️</span>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {copy.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {copy.message}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleCreateWarningResponse('CONTINUE_EDITING')}
              className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all"
            >
              <span>✏️</span>
              <span>{copy.continueEditing}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateWarningResponse('CREATE_NEW')}
              className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              <span>🆕</span>
              <span>{copy.createNew}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleCreateWarningResponse('CANCEL');
              }}
              className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              {copy.cancel}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // STEP 14A: Editorial Badge (shows when editing draft)
  // ============================================
  const renderEditorialBadge = () => {
    if (editorialMode !== 'DRAFT_ACTIVE' && editorialMode !== 'EDIT_LOCKED') {
      return null;
    }

    const copy = getEditorialBadgeCopy('vi');
    const debugState = getEditorialDebugState();
    const isLocked = editorialMode === 'EDIT_LOCKED';

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
        <span className={`text-sm ${isLocked ? 'animate-pulse' : ''}`}>
          {isLocked ? '⏳' : '🔒'}
        </span>
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {isLocked ? 'Đang xử lý...' : copy.editing}
        </span>
        {debugState.editCount > 0 && !isLocked && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            ({copy.editCount(debugState.editCount)})
          </span>
        )}
        {/* DEV-only: Show draft ID */}
        {process.env.NODE_ENV === 'development' && debugState.activeDraftId && (
          <span className="text-[10px] text-emerald-500 dark:text-emerald-500 font-mono">
            #{debugState.activeDraftId.slice(0, 6)}
          </span>
        )}
      </div>
    );
  };

  // ============================================
  // STEP 14A: Explicit Create New Button
  // ============================================
  const handleExplicitCreateNew = useCallback(() => {
    // Explicitly enter create mode
    enterCreateMode();
    refreshEditorialMode();
    if (setActiveSource) {
      setActiveSource(null);
    }
    // Focus the input
    editorRef.current?.focus();
  }, [setActiveSource, refreshEditorialMode]);

  const renderComposer = () => (
    <div
      className="flex-shrink-0 border-t border-border/70 bg-card"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      {/* STEP 6.5: Intent Confirmation Panel */}
      {renderIntentConfirmation()}

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-3">
        <div
          className={`bg-card border border-border/60 shadow-sm rounded-lg ${
            isEntryState
              ? ''
              : ''
          } focus-within:ring-1 focus-within:ring-ring/15`}
        >
          <form onSubmit={handleSubmit}>
            <textarea
              ref={editorRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={'Mô tả ý tưởng của bạn…'}
              className="w-full px-4 py-3 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground bg-transparent border-0 resize-none outline-none ring-0"
              style={{ minHeight: `${MIN_HEIGHT}px`, maxHeight: `${MAX_HEIGHT}px` }}
            />
            <div className="border-t border-border/70">
              <div className="px-4 py-2 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {/* STEP 19: Edit Scope Badge (compact, near input) */}
                  {activeScopeContract && hasActiveDraft() && (
                    <EditScopeBadge
                      contract={activeScopeContract}
                      compact
                      className="flex-shrink-0"
                    />
                  )}
                  <p
                    className={`flex-1 min-w-0 text-[11px] text-muted-foreground truncate transition-opacity ${
                      aiLoading ? 'opacity-90' : chatInput.trim() ? 'opacity-70' : 'opacity-100'
                    }`}
                  >
                    {hint}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {messages.length > 0 && (
                    <>
                      {/* FEATURE B: Session management buttons */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowSnapshotsDropdown(!showSnapshotsDropdown)}
                          className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          title="Phiên làm việc"
                        >
                          <Icon name="bookmark" size={12} />
                        </button>
                        {showSnapshotsDropdown && (
                          <div
                            className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-md z-50"
                            style={{ animation: 'fadeIn var(--motion-base) var(--ease-out-premium)' }}
                          >
                            <div className="p-2 border-b border-border">
                              <button
                                type="button"
                                onClick={() => {
                                  saveSessionSnapshot();
                                  setShowSnapshotsDropdown(false);
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-secondary rounded transition-colors"
                              >
                                <Icon name="plus" size={12} />
                                <span>Lưu snapshot</span>
                              </button>
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                              {getRecentSnapshots().length === 0 ? (
                                <div className="px-3 py-2 text-[11px] text-muted-foreground">
                                  Chưa có snapshot nào
                                </div>
                              ) : (
                                getRecentSnapshots().map((snapshot) => (
                                  <button
                                    key={snapshot.id}
                                    type="button"
                                    onClick={() => {
                                      restoreSnapshot(snapshot.id);
                                      setShowSnapshotsDropdown(false);
                                    }}
                                    className="w-full flex flex-col items-start px-3 py-2 text-left hover:bg-secondary transition-colors"
                                  >
                                    <span className="text-xs text-foreground truncate w-full">
                                      {snapshot.name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(snapshot.createdAt).toLocaleDateString('vi-VN')}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={clearMessages}
                        className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Xóa
                      </button>
                    </>
                  )}
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={`min-w-[52px] px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                      canSubmit
                        ? 'bg-foreground text-primary-foreground hover:bg-foreground/90'
                        : 'bg-secondary/70 text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {aiLoading ? '…' : 'Gửi'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col h-full min-h-0">
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="px-4 sm:px-6 py-3">
            <div className="mx-auto w-full max-w-4xl">{promptGrid}</div>
            {aiError && (
              <div className={`${ERROR_BOX.container} mt-4 max-w-4xl mx-auto`}>
                <p className={ERROR_BOX.text}>{aiError}</p>
                {chatInput.trim() && (
                  <button
                    type="button"
                    onClick={retryLastAction}
                    disabled={aiLoading}
                    className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Icon name="refresh" size={12} />
                    <span>Thử lại</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl space-y-4 px-4 sm:px-6 py-4">
            {messages.map((message) => {
              const isApproved = approvedMessageId === message.id;
              const isPrimary = primaryMessageId === message.id;
              const isHovered = hoveredMessageId === message.id;

              return (
                <div
                  key={message.id}
                  className="animate-fade-in"
                  onMouseEnter={() => setHoveredMessageId(message.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                >
                  {message.role === 'user' ? (
                    <div className="flex justify-end">
                      <div
                        className={`max-w-[70%] px-4 py-3 rounded-lg bg-secondary/60 ${
                          message.meta?.status === 'pending' ? 'opacity-80' : ''
                        } ${message.meta?.status === 'error' ? 'border border-destructive/30' : ''}`}
                      >
                        <div className="flex items-center justify-end gap-2 mb-1">
                          {/* STEP 3: Calmer pending state */}
                          {message.meta?.status === 'pending' && (
                            <span className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                              <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-pulse" />
                              Đang xử lý…
                            </span>
                          )}
                          {message.meta?.status === 'error' && (
                            <span className="text-[10px] text-destructive">Lỗi</span>
                          )}
                          <span className="text-[10px] tracking-wide uppercase text-muted-foreground">
                            {t('studio.workspace.you')}
                          </span>
                        </div>

                        <div className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                          {getDisplayedUserMessageText(message)}
                        </div>

                        {isIntentSummaryEnabled() && message.meta?.intentSnapshot && (
                          <div className="mt-2">
                            <IntentSummaryBadge snapshot={message.meta.intentSnapshot} state="completed" />
                          </div>
                        )}

                        {isIntentDebugAvailable() && (
                          <IntentDebugPanel snapshot={message.meta?.intentSnapshot} messageId={message.id} />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex justify-start"
                      onClick={() => isSourcePickerMode && handleSelectSource(message.id)}
                    >
                      <div
                        className={`max-w-[85%] bg-card border border-border/60 shadow-sm rounded-xl ${
                          isApproved ? '' : ''
                        } ${isSourcePickerMode ? 'cursor-pointer ring-1 ring-ring/20 hover:ring-ring/40' : ''} ${
                          activeSourceId === message.id ? 'ring-1 ring-ring/40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/70">
                          {/* Left: AI label + badges - always inline, no wrap */}
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap min-w-0">
                            <span className="text-[10px] tracking-wide uppercase text-muted-foreground flex-shrink-0">
                              AI
                            </span>
                            {message.meta?.templateName && (
                              <>
                                <span className="text-muted-foreground/50 hidden sm:inline">·</span>
                                <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate max-w-[80px] sm:max-w-none">
                                  {message.meta.templateName}
                                </span>
                              </>
                            )}
                            {isApproved && (
                              <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium tracking-wide uppercase rounded-full bg-secondary text-muted-foreground flex-shrink-0 whitespace-nowrap">
                                ✓ Đã duyệt
                              </span>
                            )}
                            {isPrimary && (
                              <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium tracking-wide uppercase rounded-full bg-foreground text-primary-foreground flex-shrink-0 whitespace-nowrap">
                                Bản chính
                              </span>
                            )}
                          </div>

                          <div
                            className={`flex items-center gap-2 transition-opacity duration-150 ${
                              isHovered ? 'opacity-100' : 'opacity-0'
                            }`}
                          >
                            <MessageActionBar
                              messageId={message.id}
                              onAction={onTransformAction}
                              isLoading={transformLoading === message.id}
                            />
                            <div className="w-px h-4 bg-border" />
                            <button
                              type="button"
                              onClick={() => handleCopy(message.content)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150"
                              title="Sao chép"
                            >
                              <Icon name="copy" size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setApprovedMessage(message.id)}
                              className={`p-1.5 rounded-[8px] transition-colors duration-150 ${
                                isApproved
                                  ? 'text-zinc-500 dark:text-zinc-400'
                                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                              }`}
                              title={isApproved ? 'Đã duyệt' : 'Duyệt nội dung'}
                              disabled={isApproved}
                            >
                              <Icon name="check" size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrimaryMessage(message.id)}
                              className={`p-1.5 rounded-[8px] transition-colors duration-150 ${
                                isPrimary
                                  ? 'bg-foreground text-primary-foreground'
                                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                              }`}
                              title={isPrimary ? 'Bản chính' : 'Đặt làm bản chính'}
                            >
                              <Icon name="bookmark" size={14} />
                            </button>
                          </div>
                        </div>

                        <article className="px-4 sm:px-5 py-4 sm:py-5">
                          <div className="max-w-[68ch]">
                            <div
                              className="text-[15px] leading-7 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap"
                              style={{ wordSpacing: '0.02em', textRendering: 'optimizeLegibility' }}
                            >
                              {message.content}
                            </div>
                          </div>
                        </article>

                        {(() => {
                          const effectiveQL = getEffectiveQualityLock(message);
                          return effectiveQL ? (
                            <QualityLockPanel
                              decision={effectiveQL.decision}
                              hardFails={effectiveQL.hardFails || []}
                              softFails={effectiveQL.softFails || []}
                              testMode={effectiveQL.testMode}
                              intent={message.meta?.templateId}
                              autoFixAttempts={effectiveQL.autoFixAttempts || 0}
                              onAutoFix={() => autoFixMessage(message.id)}
                              autoFixLoading={autoFixLoading === message.id}
                              previousDecision={effectiveQL.previousDecision}
                              messageId={message.id}
                            />
                          ) : null;
                        })()}

                        {message.meta?.diffApply && (
                          <DiffApplyPanel
                            message={message}
                            onApply={(mode) => applyTransformResult(message.id, mode)}
                            onUndo={() => undoApplyTransformResult(message.id)}
                          />
                        )}

                        {/* STEP 4 + 4.5: Transition micro-copy - only show once, then fade */}
                        {/* STEP 4.5: Hide if user is typing or has interacted */}
                        {(() => {
                          const assistantMessages = messages.filter(m => m.role === 'assistant');
                          const isLatestAssistant = assistantMessages.length > 0 &&
                            assistantMessages[assistantMessages.length - 1].id === message.id;
                          const hasDiffPending = message.meta?.diffApply && message.meta?.diffApply?.applyState === 'idle';
                          const isUserTyping = chatInput.trim().length > 0;
                          // STEP 4.5: Only show on first result, hide if typing or multiple results
                          const isFirstResult = assistantMessages.length === 1;

                          if (isLatestAssistant && !aiLoading && !hasDiffPending && isFirstResult && !isUserTyping) {
                            return (
                              <div className="px-4 sm:px-5 pb-3 pt-0.5">
                                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                  Nội dung sẵn sàng.
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* STEP 3: AI thinking state - calm, intentional presence */}
            {aiLoading && (
              <div className="py-5 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div
                      className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-pulse"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-pulse"
                      style={{ animationDelay: '200ms' }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-pulse"
                      style={{ animationDelay: '400ms' }}
                    />
                  </div>
                  <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
                    Đang chuẩn bị nội dung phù hợp…
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />

            {aiError && (
              <div className={ERROR_BOX.container}>
                <p className={ERROR_BOX.text}>{aiError}</p>
                {chatInput.trim() && (
                  <button
                    type="button"
                    onClick={retryLastAction}
                    disabled={aiLoading}
                    className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Icon name="refresh" size={12} />
                    <span>Thử lại</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {activeSourceId && activeSourceContent && (
        <div className="flex-shrink-0 px-4 sm:px-6 pt-2">
          <div className="mx-auto w-full max-w-4xl">
            <SourceIndicator
              sourcePreview={activeSourceContent}
              onClear={() => {
                setActiveSource?.(null);
                setIsSourcePickerMode(false);
              }}
              onChangeSource={handleChangeSource}
            />
          </div>
        </div>
      )}

      {isSourcePickerMode && (
        <div className="flex-shrink-0 px-4 sm:px-6 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800/50">
          <div className="mx-auto w-full max-w-4xl flex items-center justify-between">
            <span className="text-sm text-amber-700 dark:text-amber-300">Nhấn vào tin nhắn để chọn làm nguồn chỉnh sửa</span>
            <button
              type="button"
              onClick={() => setIsSourcePickerMode(false)}
              className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {renderComposer()}

      {/* Passive status indicator - styled as system hint, not action */}
      {messages.length > 0 && !isNearBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          title="Nhấn để cuộn xuống nội dung mới nhất"
          className="absolute z-40 bottom-36 right-6 flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary/60 border border-dashed border-muted-foreground/30 rounded-full shadow-sm hover:bg-secondary hover:border-muted-foreground/50 transition-colors duration-150 animate-fade-in"
          aria-label="Cuộn xuống tin nhắn mới nhất"
        >
          <Icon name="chevronDown" size={14} className="text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Tin mới nhất</span>
        </button>
      )}

      {autoFixPreview && (
        <DiffPreviewModal
          isOpen={!!autoFixPreview}
          onClose={cancelAutoFix}
          originalContent={autoFixPreview.originalContent}
          refinedContent={autoFixPreview.refinedContent}
          similarity={autoFixPreview.similarity}
          attempts={autoFixPreview.attempts}
          usedFallback={autoFixPreview.usedFallback}
          onApply={applyAutoFix}
          onKeepOriginal={cancelAutoFix}
        />
      )}

      {/* STEP 6: AutoFix Toast - neutral, no micro-confirmation (silence = trust) */}
      {autoFixToast?.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-sm border bg-card border-zinc-200/80 dark:border-zinc-700/60">
            <Icon
              name={autoFixToast.type === 'success' ? 'check' : 'info'}
              size={16}
              className="text-zinc-400 dark:text-zinc-500"
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              {autoFixToast.message}
            </span>
            {autoFixToast.canUndo && (
              <button
                onClick={undoAutoFix}
                className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-md transition-colors"
              >
                Hoàn tác
              </button>
            )}
            <button
              onClick={dismissAutoFixToast}
              className="p-1 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Local Edit Toast - no micro-confirmation (undo availability = trust) */}
      {localEditToast?.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-sm border bg-card border-zinc-200/80 dark:border-zinc-700/60">
            <Icon name="check" size={16} className="text-zinc-400 dark:text-zinc-500" />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              {localEditToast.message}
            </span>
            <button
              onClick={undoLocalEdit}
              className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-md transition-colors"
            >
              Hoàn tác
            </button>
            <button
              onClick={() => setLocalEditToast(null)}
              className="p-1 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 8 + STEP 14: Intent Debug Badge (DEV only, requires ?debugIntent=1) */}
      <IntentDebugBadge
        decision={lastDebugDecision}
        continuity={continuityState}
        preferenceBias={pendingDebugContextRef.current?.preferenceBias}
        governanceDecision={pendingDebugContextRef.current?.governanceDecision}
        onDismiss={() => setLastDebugDecision(null)}
      />

      {/* STEP 14A: Editorial Authority Create Warning Modal */}
      {renderCreateWarning()}

      {/* STEP 27: Rewrite Intent Confirmation Dialog */}
      {showRewriteConfirmation && (
        <RewriteConfirmationDialog
          language={(language as 'vi' | 'en') || 'vi'}
          onConfirmRewrite={handleRewriteConfirmation}
          onCreateNew={handleRewriteCreateNew}
          onCancel={handleRewriteCancel}
        />
      )}

      {/* STEP 14A: Editorial Badge - HIDDEN (UI cleanup, logic preserved) */}
      {/* Badge and "Tạo bài mới" button removed from display per UI simplification */}

      {/* STEP 16: Edit Guard Modal */}
      {pendingEditGuard && (
        <EditGuardModal
          requestedOp={pendingEditGuard.requestedOp}
          guardResult={pendingEditGuard.guardResult}
          originalText={pendingEditGuard.originalText}
          newText={pendingEditGuard.newText}
          onAccept={() => {
            // User accepts despite violation - apply the changes
            applyTransformResult(pendingEditGuard.messageId, pendingEditGuard.applyMode);
            setPendingEditGuard(null);
            if (process.env.NODE_ENV === 'development') {
              console.log('[StudioEditor:STEP16] Edit Guard - user accepted violation');
            }
          }}
          onReject={() => {
            // User rejects - do not apply, dismiss modal
            setPendingEditGuard(null);
            if (process.env.NODE_ENV === 'development') {
              console.log('[StudioEditor:STEP16] Edit Guard - user rejected');
            }
          }}
          onCancel={() => {
            // User cancelled - dismiss modal
            setPendingEditGuard(null);
          }}
          language="vi"
        />
      )}

      {/* STEP 17: Intent Canon Guard Modal */}
      {pendingIntentCanonGuard && activeIntentCanon && (
        <IntentCanonGuardModal
          canon={activeIntentCanon}
          diff={pendingIntentCanonGuard.diff}
          decision={pendingIntentCanonGuard.decision}
          onKeepIntent={() => {
            // User keeps original intent - do not apply AI output
            setPendingIntentCanonGuard(null);
            if (process.env.NODE_ENV === 'development') {
              console.log('[StudioEditor:STEP17] Intent Canon Guard - user kept original');
            }
          }}
          onAcceptDrift={() => {
            // User accepts drift - apply AI output AND update intent canon
            applyTransformResult(pendingIntentCanonGuard.messageId, pendingIntentCanonGuard.applyMode);
            updateIntentCanonAfterDrift(pendingIntentCanonGuard.newText);
            setPendingIntentCanonGuard(null);
            if (process.env.NODE_ENV === 'development') {
              console.log('[StudioEditor:STEP17] Intent Canon Guard - user accepted drift');
            }
          }}
          onCancel={() => {
            // User cancelled - dismiss modal, do not apply
            setPendingIntentCanonGuard(null);
          }}
          language="vi"
        />
      )}

      {/* STEP 19: Edit Scope Pick Modal */}
      <EditScopePickModal
        open={!!pendingScopeGate}
        gate={pendingScopeGate?.gate ?? null}
        instructionPreview={pendingScopeGate?.inputText?.substring(0, 100)}
        onPick={handleScopePickResponse}
        onCancel={cancelScopePick}
      />

      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
