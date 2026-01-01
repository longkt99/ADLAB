'use client';

// ============================================
// Studio Context Provider
// ============================================
// STATE SEPARATION RULES (MANDATORY):
//
// 1. KỊCH BẢN STATE (Strategic Layer):
//    - Variable: selectedTemplateId
//    - Handler: handleTemplateSelect
//    - Scope: Session-specific (ephemeral, no persistence)
//    - Persistence: NONE - user must explicitly select each session
//    - MUST NOT be modified by: Prompt Kit actions, content edits, message deletion
//
// 2. PROMPT KIT STATE (Tactical Layer):
//    - Tracked in: chatInput modifications only
//    - Scope: Ephemeral to current action
//    - MUST NOT affect: selectedTemplateId, tone, use case
//
// 3. CONTENT STATE (Output Layer):
//    - Variables: messages, chatInput, approvedMessageId
//    - Affected by: Kịch bản (via AI behavior), Prompt Kit (via text insertion)
//
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { UseCase, StudioContextType, PromptTemplate, ChatMessage, QualityLockMeta, AutoFixPreviewData, AutoFixToast, StudioToast, StudioSessionSnapshot, StudioSessionMeta } from '@/types/studio';
import { TEMPLATE_CATEGORIES, getTemplateById as getOldTemplateById } from './promptTemplates';
import { buildStudioAIRequest } from './aiClient';
import type { StudioAIRequest, StudioAIResponse } from './aiTypes';
import { BRAND_TONES, type BrandTone } from './tones';
import { STUDIO_USE_CASES } from './useCases';
import { getDefaultWorkflowStep, type WorkflowStep } from './workflow';
// NEW: Import Content Machine Engine template system
import { listAllTemplates, getTemplateById as getNewTemplateById } from './templateLoader';
// NEW: Import prompt localization helper
import { getLocalizedPrompt } from './promptLocalization';
import { useTranslation } from '@/lib/i18n';
// AI Library: Persistent storage for saved thinking sessions
import { saveToAILibrary, loadAILibrary, type AILibraryEntry } from './aiLibrary';
// ✅ PHASE 4: Import manifest resolver + system prompt builder
import { resolveTemplateManifest } from './templates/resolveManifest';
import { buildSystemPrompt } from './templates/buildSystemPrompt';
// ✅ Quality Lock: Import evaluation engine
import { runQualityLock } from '@/lib/quality/runQualityLock';
import { isValidIntentId } from '@/lib/quality/intentQualityRules';
// ✅ Quality Feedback: Import user-facing feedback transformer
import { transformToFeedback } from '@/lib/quality/qualityFeedback';
import type { IntentId } from '@/lib/quality/intentQualityRules';
// ✅ Analytics: Import privacy-safe tracker
import {
  trackQLEvaluationRequested,
  trackQLEvaluationCompleted,
  trackAutoFixRequested,
  trackAutoFixAttemptCompleted,
  trackAutoFixCandidateShown,
  trackAutoFixApplied,
  trackAutoFixDismissed,
  trackAutoFixUndoUsed,
  trackAutoFixPostApplyReEvaluated,
} from '@/lib/analytics/track';
import { DraftState, AssistMode } from '@/types/analytics';
// ✅ Orchestrator: Import transform orchestrator
import type { ActionType, TransformMode } from '@/types/orchestrator';
import { shouldValidate, getActionLabel, isRefusal, applyFallbackTransform, classifyAction, detectTransformMode, getDirectiveSignals, detectNewCreate, detectTopicDrift, extractOutputContract, validateOutputContract, buildEnforcementInstruction, buildContractInstruction } from '@/lib/orchestrator';
import { getMessageContent } from '@/lib/orchestrator/sourceResolver';
import { extractLockedContext } from '@/lib/orchestrator/lockedContextExtractor';
import { injectConstraints, buildSourceReference } from '@/lib/orchestrator/constraintInjector';
import type { TransformOutputContract, ContractValidationResult } from '@/types/orchestrator';
// ✅ INVARIANT-SAFE: Import execution gate and LLM executor
import {
  generateEventId,
  createAuthorizationToken,
  type UserActionType,
} from '@/lib/orchestrator/executionGate';
import {
  executeLLM,
  type LLMRequest,
} from '@/lib/orchestrator/llmExecutor';
import { safeHash } from '@/lib/studio/safeHash';
// ✅ Diff & Apply: Import section extraction and apply helpers
import { extractSections, applySection, type ApplyMode } from '@/lib/studio/applySections';
// ✅ STEP 3: Intent Snapshot (observability layer)
import {
  createTransformSnapshot,
  createCreateSnapshot,
  getMessageSnapshot,
  validateSnapshot,
} from '@/lib/studio/intentSnapshot';
// ✅ STEP 5: Execution Contract Enforcement
import {
  resolveExecutionSource,
  validateExecutionContract,
  warnIfExecutionSourceDrifts,
  warnIfModeMismatch,
  getOriginForChain,
} from '@/lib/studio/executionContract';
// ✅ STEP 21: Edit Patch Executor
import { type EditPatchMeta } from '@/lib/studio/editPatchExecutor';
// ✅ STEP 5 (UX): Soft Preference Memory - Output Length Bias & Workflow Pattern
import { recordLongerRequest, recordShorterRequest, recordSessionAction } from '@/lib/studio/preferenceMemory';
// ✅ STEP 22: Rewrite Anchors for structural output guard
import {
  injectAnchors,
  validateAnchors,
  stripAnchors,
  shouldApplyAnchors,
  type AnchoredContent,
} from '@/lib/studio/rewriteAnchors';
// ✅ STEP 22: Rewrite Diff Guard for conservative rewrite limits
import {
  validateRewriteDiff,
  getDiffGuardErrorMessage,
} from '@/lib/studio/rewriteDiffGuard';
import { detectTaskType, type TaskDetectionContext } from '@/lib/studio/answerEngine';
// ✅ STEP 23: User-facing error messages
import { getUserFacingAiError } from '@/lib/studio/errorMessages';

// ✅ PHASE 2: Simple requestId generator (no external dependencies)
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// AUTOMATIC TEMPLATE RESOLUTION
// ============================================
// Maps detected intent signals to appropriate template
// Enables chat-first UX without requiring manual template selection
//
// Priority:
// 1. User-selected template (explicit choice)
// 2. Inferred from input signals (platform + content type)
// 3. Fallback to general-purpose template

// Template mapping by detected category
const TEMPLATE_INFERENCE_MAP: Record<string, string> = {
  // Social media captions
  'caption': 'social_caption_v1',
  'instagram': 'social_caption_v1',
  'facebook_post': 'social_caption_v1',
  'tiktok': 'reel_caption_v1',
  'reel': 'reel_caption_v1',
  'reels': 'reel_caption_v1',

  // Long-form content
  'blog': 'seo_blog_v1',
  'seo': 'seo_blog_v1',
  'article': 'seo_blog_v1',

  // Video content
  'video': 'video_script_v1',
  'script': 'video_script_v1',
  'youtube': 'video_script_v1',

  // E-commerce
  'product': 'product_description_v1',
  'ecommerce': 'product_description_v1',
  'shop': 'product_description_v1',

  // Marketing
  'email': 'email_marketing_v1',
  'newsletter': 'email_marketing_v1',
  'landing': 'landing_page_v1',
  'ads': 'social_caption_v1', // Use caption as fallback until ad_copy_v1 is ready
  'quảng cáo': 'social_caption_v1',
};

// Default template when no specific match (general-purpose)
const DEFAULT_TEMPLATE_ID = 'social_caption_v1';

/**
 * Infer template ID from user input text
 * Uses keyword detection, not exhaustive phrase matching
 */
function inferTemplateFromInput(input: string): string {
  const normalized = input.toLowerCase().normalize('NFC');

  // Priority 1: Check for specific content types
  if (/\b(reel|reels|tiktok|tik tok|shorts)\b/i.test(normalized)) {
    return TEMPLATE_INFERENCE_MAP['reel'];
  }
  if (/\b(caption|bài đăng)\b/i.test(normalized)) {
    return TEMPLATE_INFERENCE_MAP['caption'];
  }
  if (/\b(blog|bài viết dài|seo)\b/i.test(normalized)) {
    return TEMPLATE_INFERENCE_MAP['blog'];
  }
  if (/\b(video|kịch bản|kich ban|script|youtube)\b/i.test(normalized)) {
    return TEMPLATE_INFERENCE_MAP['video'];
  }
  if (/\b(sản phẩm|san pham|product|mô tả sp|mo ta sp|description)\b/i.test(normalized)) {
    return TEMPLATE_INFERENCE_MAP['product'];
  }
  if (/\b(email|thư|newsletter|bản tin)\b/i.test(normalized)) {
    return TEMPLATE_INFERENCE_MAP['email'];
  }
  if (/\b(landing|trang đích|landing page)\b/i.test(normalized)) {
    return TEMPLATE_INFERENCE_MAP['landing'];
  }

  // Priority 2: Check for platform hints
  if (/\b(instagram|ig|insta)\b/i.test(normalized)) {
    return TEMPLATE_INFERENCE_MAP['instagram'];
  }
  if (/\b(facebook|fb|fanpage)\b/i.test(normalized)) {
    return TEMPLATE_INFERENCE_MAP['facebook_post'];
  }

  // Priority 3: Default to social caption (most versatile)
  return DEFAULT_TEMPLATE_ID;
}

/**
 * Resolve effective template ID for sending
 * @param userSelectedTemplateId - Template manually selected by user (if any)
 * @param userInput - Current chat input text
 * @returns Template ID to use for this request
 */
function resolveEffectiveTemplateId(
  userSelectedTemplateId: string | null,
  userInput: string
): string {
  // Priority 1: User explicitly selected a template
  if (userSelectedTemplateId) {
    return userSelectedTemplateId;
  }

  // Priority 2: Infer from input
  return inferTemplateFromInput(userInput);
}

// ✅ Auto Fix Trust Metric (silent, console-only)
// Logs whether user kept the suggestion after undo window closes
function logAutoFixMetric(data: { kept: boolean; messageId: string; intent?: string }) {
  console.log('[AutoFix:Metric]', JSON.stringify(data));
}

// ✅ System-driven workflow step derivation
// Workflow is NEVER manually set - always derived from editor state
function deriveWorkflowStep(state: {
  messages: ChatMessage[];
  approvedMessageId: string | null;
}): WorkflowStep {
  const { messages, approvedMessageId } = state;

  const hasAIGeneration = messages.some(m => m.role === 'assistant');
  const isApproved = approvedMessageId !== null;

  // Find the latest assistant message with quality data
  const latestAssistantWithQL = [...messages].reverse().find(
    m => m.role === 'assistant' && m.meta?.qualityLock
  );
  const qualityFeedback = latestAssistantWithQL?.meta?.qualityLock?.feedback;
  const qualityDecision = latestAssistantWithQL?.meta?.qualityLock?.decision;

  // Has issues/suggestions = FAIL or WARNING status, or legacy FAIL/DRAFT decision
  const hasIssuesOrSuggestions = qualityFeedback
    ? (qualityFeedback.status === 'FAIL' || qualityFeedback.status === 'WARNING')
    : (qualityDecision === 'FAIL' || qualityDecision === 'DRAFT');

  // Priority 1: Approved OR has issues/suggestions → 'review'
  if (isApproved || (hasIssuesOrSuggestions && hasAIGeneration)) {
    return 'review';
  }

  // Priority 2: AI has generated output with no issues → 'draft'
  if (hasAIGeneration) {
    return 'draft';
  }

  // Priority 3: Default → 'brief'
  return 'brief';
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export const useStudio = () => {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within StudioProvider');
  }
  return context;
};

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // i18n hook for prompt localization
  const { language } = useTranslation();

  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);
  // workflowStep is now DERIVED, not manually set - see deriveWorkflowStep() below
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);

  // Tone Engine State with localStorage persistence
  const [selectedTone, setSelectedTone] = useState<BrandTone | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('studio_selected_tone');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed as BrandTone;
      }
    } catch (error) {
      console.error('Failed to load saved tone:', error);
    }
    return null;
  });

  // Template Browser State (OLD system - for prompt templates)
  const [isTemplateBrowserOpen, setTemplateBrowserOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplateCategoryId, setSelectedTemplateCategoryId] = useState(
    TEMPLATE_CATEGORIES[0]?.id || 'seo'
  );

  // NEW: Content Machine Engine Template State (NO PERSISTENCE)
  // TERMINOLOGY: This manages 🎬 KỊCH BẢN (Script) selection
  // selectedTemplateId = ID of the active Kịch bản (complete content-generation structure)
  // Note: Variable name kept as "selectedTemplateId" for backward compatibility
  // but conceptually represents the active Script/Kịch bản
  //
  // UX RULE: User must EXPLICITLY select a script. No auto-selection, no persistence.
  // Default state is NULL - user sees empty state until they actively choose.
  const [selectedTemplateId, setSelectedTemplateIdState] = useState<string | null>(() => {
    // ✅ FIXED: No auto-selection on SSR or client
    if (typeof window === 'undefined') return null;

    // ✅ REMOVED: localStorage persistence
    // Script selection is session-specific and ephemeral
    // User must explicitly choose script for each session

    return null; // ✅ Default: no script selected
  });

  // Message History State with localStorage persistence
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('studio_chat_messages_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check schema version for forward compatibility
        if (parsed.schemaVersion === 1 && Array.isArray(parsed.messages)) {
          // Rehydrate Date objects from ISO strings
          return parsed.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load saved messages:', error);
    }
    return [];
  });

  // Approved Message State with localStorage persistence
  const [approvedMessageId, setApprovedMessageIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('studio_chat_messages_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.schemaVersion === 1 && parsed.approvedMessageId) {
          return parsed.approvedMessageId;
        }
      }
    } catch (error) {
      console.error('Failed to load approved message:', error);
    }
    return null;
  });

  // AI Result State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ✅ Quality Lock Auto Fix State
  const [autoFixLoading, setAutoFixLoading] = useState<string | null>(null);

  // ✅ Auto Fix Preview Modal State (Diff Preview UX)
  const [autoFixPreview, setAutoFixPreview] = useState<AutoFixPreviewData | null>(null);
  const [autoFixPreviewShownAt, setAutoFixPreviewShownAt] = useState<number | null>(null);

  // ✅ Auto Fix Toast State (with undo support)
  const [autoFixToast, setAutoFixToast] = useState<AutoFixToast | null>(null);
  const [autoFixAppliedAt, setAutoFixAppliedAt] = useState<number | null>(null);

  // ✅ PHASE 3: Template gate feedback state
  const [templateGateToast, setTemplateGateToast] = useState<{
    show: boolean;
    message: string;
  } | null>(null);

  // ✅ Orchestrator: Active source and transform state
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [transformLoading, setTransformLoading] = useState<string | null>(null);

  // ✅ STEP 21: Edit Patch Meta - set by StudioEditor before handleSend
  // Enables partial edits (BODY-only, CTA-only, etc.) without full structure
  const [pendingEditPatchMeta, setPendingEditPatchMeta] = useState<EditPatchMeta | null>(null);

  // ✅ STEP 22: Output Contract - set by StudioEditor before handleSend
  // Enforces PATCH_ONLY output format with [PATCH] blocks
  const [pendingOutputContract, setPendingOutputContract] = useState<import('@/types/studio').OutputContract | null>(null);

  // ✅ Transform Intent Memory: Remembers last intent type to handle uncertain classifications
  // When user is in a refinement loop, defaults to TRANSFORM even if classifier is uncertain
  // Explicit NEW-CREATE signals ("viết bài mới", "chủ đề khác") override memory
  const [lastIntentType, setLastIntentType] = useState<'CREATE' | 'TRANSFORM' | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('studio_intent_memory_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.lastIntentType || null;
      }
    } catch (error) {
      console.error('Failed to load intent memory:', error);
    }
    return null;
  });

  const [lastTransformSourceId, setLastTransformSourceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('studio_intent_memory_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.lastTransformSourceId || null;
      }
    } catch (error) {
      console.error('Failed to load intent memory:', error);
    }
    return null;
  });

  // ============================================
  // FEATURE A: Primary Selection State
  // ============================================
  // Primary = the "best" output the user wants to commit to Posts
  // Separate from approvedMessageId (which is for workflow approval)

  const [primaryMessageId, setPrimaryMessageIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('studio_primary_message_v1');
      if (saved) {
        return JSON.parse(saved).primaryMessageId || null;
      }
    } catch (error) {
      console.error('Failed to load primary message:', error);
    }
    return null;
  });

  const [commitLoading, setCommitLoading] = useState(false);
  const [saveSessionLoading, setSaveSessionLoading] = useState(false);

  // ============================================
  // FEATURE B: Studio Session Persistence
  // ============================================

  // Generate session ID on first load
  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return `session-${Date.now()}`;
    try {
      const saved = localStorage.getItem('studio_session_id_v1');
      if (saved) {
        return saved;
      }
      const newId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('studio_session_id_v1', newId);
      return newId;
    } catch {
      return `session-${Date.now()}`;
    }
  });

  // Toast notifications
  const [studioToast, setStudioToast] = useState<StudioToast | null>(null);

  // Session snapshots (stored in localStorage)
  const [snapshots, setSnapshots] = useState<StudioSessionSnapshot[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('studio_snapshots_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Rehydrate dates and limit to 5 most recent
          return parsed.slice(0, 5).map((s: StudioSessionSnapshot) => ({
            ...s,
            messages: s.messages.map((m: ChatMessage) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })),
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    }
    return [];
  });

  // ============================================
  // AI Library: Persistent saved sessions (survives Studio reset)
  // ============================================
  const [aiLibraryEntries, setAiLibraryEntries] = useState<AILibraryEntry[]>(() => {
    return loadAILibrary();
  });

  // Track if we've already restored from URL to prevent duplicate restores
  const hasRestoredFromUrl = useRef(false);

  // Handle ?restore= query parameter from AI Library sidebar clicks
  const searchParams = useSearchParams();
  useEffect(() => {
    const restoreId = searchParams.get('restore');
    if (restoreId && !hasRestoredFromUrl.current) {
      hasRestoredFromUrl.current = true;

      // Find the entry in AI Library
      const entry = aiLibraryEntries.find(e => e.id === restoreId);
      if (entry) {
        // Restore all state from library entry
        setMessages(entry.messages.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })));
        setPrimaryMessageIdState(entry.primaryMessageId);
        setChatInput(entry.meta.promptInput || '');

        // Restore tone if available
        if (entry.meta.toneId) {
          const tone = BRAND_TONES.find((t: BrandTone) => t.id === entry.meta.toneId);
          if (tone) setSelectedTone(tone);
        }

        // Restore template if available
        if (entry.meta.templateId) {
          setSelectedTemplateIdState(entry.meta.templateId);
        }

        // STEP 6: Neutral restore - implies continuity
        setStudioToast({
          id: `restore-${Date.now()}`,
          type: 'success',
          message: 'Đã khôi phục. Tiếp tục từ đây.',
          duration: 2500,
        });

        // Clear the URL param without navigation
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('restore');
          window.history.replaceState({}, '', url.toString());
        }
      }
    }
  }, [searchParams, aiLibraryEntries]);

  // Auto-hide welcome animation after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcomeAnimation(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Edge case: Clear approvedMessageId if the message no longer exists
  useEffect(() => {
    if (approvedMessageId && !messages.find(m => m.id === approvedMessageId)) {
      setApprovedMessageIdState(null);
    }
  }, [messages, approvedMessageId]);

  // Persist messages and approved message to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        schemaVersion: 1,
        messages: messages,
        approvedMessageId: approvedMessageId,
      };
      localStorage.setItem('studio_chat_messages_v1', JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }, [messages, approvedMessageId]);

  // ✅ Persist intent memory to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        lastIntentType,
        lastTransformSourceId,
      };
      localStorage.setItem('studio_intent_memory_v1', JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to save intent memory:', error);
    }
  }, [lastIntentType, lastTransformSourceId]);

  // ============================================
  // FEATURE A: Primary Selection Persistence
  // ============================================

  // Persist primary message ID
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('studio_primary_message_v1', JSON.stringify({
        primaryMessageId,
      }));
    } catch (error) {
      console.error('Failed to save primary message:', error);
    }
  }, [primaryMessageId]);

  // Clear primary if message no longer exists
  useEffect(() => {
    if (primaryMessageId && !messages.find(m => m.id === primaryMessageId)) {
      setPrimaryMessageIdState(null);
    }
  }, [messages, primaryMessageId]);

  // ============================================
  // FEATURE B: Session Autosave
  // ============================================

  // Autosave session on key state changes (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (messages.length === 0) return; // Don't save empty sessions

    const timer = setTimeout(() => {
      try {
        const sessionData = {
          sessionId,
          messages,
          primaryMessageId,
          chatInput,
          toneId: selectedTone?.id,
          templateId: selectedTemplateId,
          updatedAt: Date.now(),
        };
        localStorage.setItem('studio_autosave_v1', JSON.stringify(sessionData));
      } catch (error) {
        console.error('Failed to autosave session:', error);
      }
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [messages, primaryMessageId, chatInput, selectedTone?.id, selectedTemplateId, sessionId]);

  // Persist snapshots to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('studio_snapshots_v1', JSON.stringify(snapshots));
    } catch (error) {
      console.error('Failed to save snapshots:', error);
    }
  }, [snapshots]);

  // ============================================
  // FEATURE A: Primary Selection Handlers
  // ============================================

  const setPrimaryMessage = useCallback((messageId: string) => {
    // Only allow setting assistant messages as primary
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.role === 'assistant') {
      setPrimaryMessageIdState(messageId);
    }
  }, [messages]);

  const clearPrimaryMessage = useCallback(() => {
    setPrimaryMessageIdState(null);
  }, []);

  // Create post draft from primary message
  const createPostFromPrimary = useCallback(async (): Promise<{ success: boolean; postId?: string; error?: string }> => {
    if (!primaryMessageId) {
      return { success: false, error: 'Chưa chọn bản chính' };
    }

    const primaryMsg = messages.find(m => m.id === primaryMessageId);
    if (!primaryMsg || primaryMsg.role !== 'assistant') {
      return { success: false, error: 'Bản chính không hợp lệ' };
    }

    setCommitLoading(true);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: primaryMsg.content.substring(0, 60).replace(/\n+/g, ' ').trim() + (primaryMsg.content.length > 60 ? '...' : ''),
          content: primaryMsg.content,
          status: 'draft',
          // Include metadata for traceability
          meta: {
            source: 'studio',
            sessionId,
            toneId: selectedTone?.id,
            templateId: selectedTemplateId,
            createdFromMessageId: primaryMessageId,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create draft');
      }

      // STEP 6: Neutral completion tone - no celebration
      setStudioToast({
        id: `toast-${Date.now()}`,
        type: 'success',
        message: 'Bài viết đã có trong danh sách.',
        action: {
          label: 'Xem',
          href: '/posts',
        },
        duration: 4000,
      });

      return { success: true, postId: result.post?.id };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Lỗi không xác định';
      // STEP 6: Softer error language - implies continuity
      setStudioToast({
        id: `toast-${Date.now()}`,
        type: 'error',
        message: 'Chưa tạo được. Bạn có thể thử lại.',
        duration: 4000,
      });
      return { success: false, error: errorMsg };
    } finally {
      setCommitLoading(false);
    }
  }, [primaryMessageId, messages, sessionId, selectedTone?.id, selectedTemplateId]);

  // ============================================
  // FEATURE B: Session Management Handlers
  // ============================================

  const showStudioToast = useCallback((toast: Omit<StudioToast, 'id'>) => {
    const id = `toast-${Date.now()}`;
    setStudioToast({ ...toast, id });

    // Auto-dismiss after duration
    if (toast.duration) {
      setTimeout(() => {
        setStudioToast(prev => prev?.id === id ? null : prev);
      }, toast.duration);
    }
  }, []);

  const dismissStudioToast = useCallback(() => {
    setStudioToast(null);
  }, []);

  const saveSessionSnapshot = useCallback(async (name?: string) => {
    const snapshotName = name || `Session – ${new Date().toLocaleDateString('vi-VN')}`;
    const snapshot: StudioSessionSnapshot = {
      id: `snapshot-${Date.now()}`,
      name: snapshotName,
      createdAt: Date.now(),
      messages: messages,
      primaryMessageId,
      meta: {
        sessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        promptInput: chatInput,
        toneId: selectedTone?.id,
        templateId: selectedTemplateId || undefined,
      },
    };

    setSnapshots(prev => {
      // Keep only 5 most recent, add new one at front
      const updated = [snapshot, ...prev.slice(0, 4)];
      return updated;
    });

    // STEP 6: Neutral confirmation - no celebration
    showStudioToast({
      type: 'success',
      message: 'Đã lưu.',
      duration: 2500,
    });
  }, [messages, primaryMessageId, chatInput, selectedTone?.id, selectedTemplateId, sessionId, showStudioToast]);

  // Explicit user-initiated save (for psychological safety)
  // Shows friendly toast, does NOT create a Post or change Primary
  // ALSO saves to AI Library for persistence across Studio reset/refresh
  const saveSession = useCallback(async () => {
    if (saveSessionLoading) return;

    // Check if session is empty (no messages and no input)
    const hasContent = messages.length > 0 || chatInput.trim().length > 0;
    if (!hasContent) {
      showStudioToast({
        type: 'info',
        message: 'Chưa có nội dung để lưu',
        duration: 2500,
      });
      return;
    }

    setSaveSessionLoading(true);
    try {
      // Save as a snapshot with user-friendly name
      const snapshotName = `Phiên làm việc – ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      const snapshot: StudioSessionSnapshot = {
        id: `session-save-${Date.now()}`,
        name: snapshotName,
        createdAt: Date.now(),
        messages: messages,
        primaryMessageId,
        meta: {
          sessionId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          promptInput: chatInput,
          toneId: selectedTone?.id,
          templateId: selectedTemplateId || undefined,
        },
      };

      setSnapshots(prev => {
        // Keep only 5 most recent, add new one at front
        const updated = [snapshot, ...prev.slice(0, 4)];
        return updated;
      });

      // ============================================
      // AI Library: Persist to localStorage for cross-session access
      // ============================================
      const libraryMeta: StudioSessionMeta = {
        sessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        promptInput: chatInput,
        toneId: selectedTone?.id,
        templateId: selectedTemplateId || undefined,
      };

      saveToAILibrary({
        sessionId,
        messages,
        primaryMessageId,
        meta: libraryMeta,
      });

      // Refresh AI Library state
      setAiLibraryEntries(loadAILibrary());

      // STEP 6: Neutral confirmation - implies continuity
      showStudioToast({
        type: 'success',
        message: 'Đã lưu. Bạn có thể quay lại sau.',
        duration: 3000,
      });
    } catch (error) {
      console.error('[Studio] Error saving session:', error);
      // STEP 6: Softer error - implies safety
      showStudioToast({
        type: 'error',
        message: 'Chưa lưu được. Nội dung vẫn còn ở đây.',
        duration: 3000,
      });
    } finally {
      setSaveSessionLoading(false);
    }
  }, [messages, chatInput, primaryMessageId, sessionId, selectedTone?.id, selectedTemplateId, saveSessionLoading, showStudioToast]);

  const getRecentSnapshots = useCallback((): StudioSessionSnapshot[] => {
    return snapshots;
  }, [snapshots]);

  const restoreSnapshot = useCallback((snapshotId: string) => {
    const snapshot = snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      showStudioToast({
        type: 'error',
        message: 'Không tìm thấy bản lưu.',
        duration: 2500,
      });
      return;
    }

    // Restore all state from snapshot
    setMessages(snapshot.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })));
    setPrimaryMessageIdState(snapshot.primaryMessageId);
    setChatInput(snapshot.meta.promptInput || '');

    // STEP 6: Neutral restore - no celebration
    showStudioToast({
      type: 'success',
      message: 'Đã khôi phục.',
      duration: 2500,
    });
  }, [snapshots, showStudioToast]);

  // ============================================
  // AI Library: Restore session from library entry
  // ============================================
  const restoreFromAILibrary = useCallback((entryId: string) => {
    const entry = aiLibraryEntries.find(e => e.id === entryId);
    if (!entry) {
      showStudioToast({
        type: 'error',
        message: 'Không tìm thấy bản lưu.',
        duration: 2500,
      });
      return;
    }

    // Restore all state from library entry
    setMessages(entry.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })));
    setPrimaryMessageIdState(entry.primaryMessageId);
    setChatInput(entry.meta.promptInput || '');

    // Restore tone if available
    if (entry.meta.toneId) {
      const tone = BRAND_TONES.find((t: BrandTone) => t.id === entry.meta.toneId);
      if (tone) setSelectedTone(tone);
    }

    // Restore template if available
    if (entry.meta.templateId) {
      setSelectedTemplateIdState(entry.meta.templateId);
    }

    // STEP 6: Neutral restore - implies continuity
    showStudioToast({
      type: 'success',
      message: 'Đã khôi phục. Tiếp tục từ đây.',
      duration: 2500,
    });
  }, [aiLibraryEntries, showStudioToast]);

  // Handle use case selection
  const handleUseCaseSelect = (useCase: UseCase) => {
    setSelectedUseCase(useCase);

    // Only auto-fill if use case has a prompt (legacy behavior)
    // If it only has a placeholder, just set the context without filling input
    if (useCase.prompt) {
      setTimeout(() => {
        setChatInput(useCase.prompt!); // Safe because we checked for prompt above
      }, 150);
    }
  };

  // Handle tone selection with persistence
  const handleToneSelect = (tone: BrandTone) => {
    setSelectedTone(tone);
    // Persist to localStorage
    try {
      localStorage.setItem('studio_selected_tone', JSON.stringify(tone));
    } catch (error) {
      console.error('Failed to save tone:', error);
    }
  };

  // NEW: Handle Content Machine Engine template selection (NO PERSISTENCE)
  // TERMINOLOGY: This selects a 🎬 KỊCH BẢN (Script), NOT a prompt or template in the old sense
  // A Kịch bản defines: objective, flow, constraints, mode (A/B/C), platform compatibility
  const handleTemplateSelect = (templateId: string | null) => {
    setSelectedTemplateIdState(templateId);
    // ✅ NO PERSISTENCE: Script selection is ephemeral per session
    // User must explicitly choose script each time they use Studio
  };

  // Trigger celebration effect
  const triggerCelebration = () => {
    setCelebrationTrigger((prev) => prev + 1);
  };

  // ============================================
  // OLD sendToAI REMOVED - Now uses dispatchExecution → executeCreateWithToken
  // All AI execution MUST go through dispatchExecution (gate-first architecture)
  // ============================================

  // Clear message history
  const clearMessages = () => {
    setMessages([]);
    setAiError(null);
    setApprovedMessageIdState(null); // Also clear approved message
    // ✅ Clear intent memory when clearing messages
    setLastIntentType(null);
    setLastTransformSourceId(null);
    // Clear from localStorage
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('studio_chat_messages_v1');
        localStorage.removeItem('studio_intent_memory_v1');
      }
    } catch (error) {
      console.error('Failed to clear messages from storage:', error);
    }
  };

  // Set approved message (only allow assistant messages)
  const setApprovedMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.role === 'assistant') {
      setApprovedMessageIdState(messageId);
    }
  };

  // Clear approved message
  const clearApprovedMessage = () => {
    setApprovedMessageIdState(null);
  };

  // ✅ Quality Lock Auto Fix
  // Calls /api/quality/auto-fix to refine content based on failed rules (both HARD and SOFT)
  // Opens Diff Preview Modal instead of immediately applying
  const autoFixMessage = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || message.role !== 'assistant') {
      console.warn('[Auto-Fix] Invalid message:', messageId);
      return;
    }

    const qualityLock = message.meta?.qualityLock;
    // Auto Fix is available for DRAFT (soft fails only) or FAIL (has hard fails)
    // Not available for PASS (nothing to fix)
    const hasFailsToFix =
      (qualityLock?.softFails?.length ?? 0) > 0 ||
      (qualityLock?.hardFails?.length ?? 0) > 0;

    if (!qualityLock || qualityLock.decision === 'PASS' || !hasFailsToFix) {
      console.warn('[Auto-Fix] Message not eligible for auto-fix:', messageId, {
        decision: qualityLock?.decision,
        softFails: qualityLock?.softFails?.length ?? 0,
        hardFails: qualityLock?.hardFails?.length ?? 0,
      });
      return;
    }

    // Determine intent: prefer meta.intent (resolved at generation time), fallback to templateId
    const candidateIntent = message.meta?.intent || message.meta?.templateId;
    if (!isValidIntentId(candidateIntent)) {
      console.warn('[Auto-Fix] No valid intent found for auto-fix');
      return;
    }

    const intent = candidateIntent;
    setAutoFixLoading(messageId);
    const requestStartTime = Date.now();

    // ✅ Track Auto Fix requested
    trackAutoFixRequested({
      draft_id: messageId,
      message_id: messageId,
      intent_id: intent,
      ui_surface: 'studio',
      editor_state: DraftState.D0_ACTIVE,
      assist_mode: AssistMode.A0_ASSIST_NORMAL,
      previous_decision: qualityLock.decision,
      target_rule_ids: [
        ...(qualityLock.hardFails || []).map(r => r.id),
        ...(qualityLock.softFails || []).map(r => r.id),
      ],
    });

    try {
      const response = await fetch('/api/quality/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent,
          output: message.content,
          softFails: qualityLock.softFails || [],
          hardFails: qualityLock.hardFails || [],
          meta: {
            templateId: message.meta?.templateId,
            language: 'vi', // Default to Vietnamese
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.refinedOutput) {
        throw new Error(data.error || 'Auto-fix failed');
      }

      const requestDuration = Date.now() - requestStartTime;

      console.log('[Auto-Fix] API response:', {
        similarity: data.similarity?.score,
        attempts: data.attempts,
        usedFallback: data.usedFallback,
      });

      // ✅ Track Auto Fix attempt completed
      trackAutoFixAttemptCompleted({
        draft_id: messageId,
        message_id: messageId,
        intent_id: intent,
        ui_surface: 'studio',
        editor_state: DraftState.D0_ACTIVE,
        assist_mode: AssistMode.A0_ASSIST_NORMAL,
        attempt_number: data.attempts || 1,
        similarity_score: data.similarity?.score || 1,
        used_fallback: data.usedFallback || false,
        duration_ms: requestDuration,
      });

      // ✅ Open Diff Preview Modal instead of immediately applying
      setAutoFixPreview({
        messageId,
        originalContent: message.content,
        refinedContent: data.refinedOutput,
        similarity: data.similarity,
        attempts: data.attempts,
        usedFallback: data.usedFallback,
      });

      // ✅ Track Auto Fix candidate shown
      trackAutoFixCandidateShown({
        draft_id: messageId,
        message_id: messageId,
        intent_id: intent,
        ui_surface: 'studio',
        editor_state: DraftState.D0_ACTIVE,
        assist_mode: AssistMode.A0_ASSIST_NORMAL,
        similarity_score: data.similarity?.score || 1,
        used_fallback: data.usedFallback || false,
      });

      // Track when preview was shown for review duration calculation
      setAutoFixPreviewShownAt(Date.now());

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Auto-fix failed';
      console.error('[Auto-Fix] Failed:', errorMessage);
      setAiError(`Auto-fix failed: ${errorMessage}`);
    } finally {
      setAutoFixLoading(null);
    }
  };

  // ✅ Apply Auto Fix from Preview Modal
  const applyAutoFix = useCallback(() => {
    if (!autoFixPreview) return;

    const { messageId, originalContent, refinedContent } = autoFixPreview;
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const qualityLock = message.meta?.qualityLock;
    const intent = message.meta?.intent || message.meta?.templateId;

    if (!isValidIntentId(intent)) {
      console.warn('[Auto-Fix Apply] No valid intent found');
      return;
    }

    // Re-run Quality Lock on refined output
    const reEvalResult = runQualityLock({
      intent,
      output: refinedContent,
      meta: {
        templateId: message.meta?.templateId,
        language: 'vi',
        testMode: message.meta?.testMode,
      },
    });

    // Map re-evaluation result to decision
    const newDecision = reEvalResult.hardFails.length > 0
      ? 'FAIL' as const
      : reEvalResult.softFails.length > 0
      ? 'DRAFT' as const
      : 'PASS' as const;

    const newAttempts = (qualityLock?.autoFixAttempts || 0) + 1;

    console.log(`[Auto-Fix Apply] Re-evaluation: ${newDecision}`, {
      attempts: newAttempts,
      hardFails: reEvalResult.hardFails.length,
      softFails: reEvalResult.softFails.length,
    });

    // ✅ Track Auto Fix post-apply re-evaluation
    trackAutoFixPostApplyReEvaluated({
      draft_id: messageId,
      message_id: messageId,
      intent_id: intent,
      ui_surface: 'studio',
      editor_state: DraftState.D0_ACTIVE,
      assist_mode: AssistMode.A0_ASSIST_NORMAL,
      new_decision: newDecision,
    });

    // ✅ Track Auto Fix applied
    const reviewDuration = autoFixPreviewShownAt ? Date.now() - autoFixPreviewShownAt : 0;
    trackAutoFixApplied({
      draft_id: messageId,
      message_id: messageId,
      intent_id: intent,
      ui_surface: 'studio',
      editor_state: DraftState.D0_ACTIVE,
      assist_mode: AssistMode.A0_ASSIST_NORMAL,
      review_duration_ms: reviewDuration,
      similarity_score: autoFixPreview.similarity?.score || 1,
      was_fallback: autoFixPreview.usedFallback || false,
    });
    setAutoFixPreviewShownAt(null);

    // Update message with refined content and new quality lock result
    // Store previousDecision for outcome visibility UX
    const previousDecision = qualityLock?.decision;

    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return {
          ...m,
          content: refinedContent,
          meta: {
            ...m.meta,
            qualityLock: {
              decision: newDecision,
              softFails: reEvalResult.softFails,
              hardFails: reEvalResult.hardFails,
              autoFixAttempts: newAttempts,
              previousDecision, // For outcome visibility indicator
            },
          },
        };
      }
      return m;
    }));

    // Close preview modal
    setAutoFixPreview(null);

    // Track when fix was applied for undo timing
    setAutoFixAppliedAt(Date.now());

    // Show toast with undo option
    setAutoFixToast({
      show: true,
      message: 'Đã thay bằng bản điều chỉnh.',
      type: 'success',
      canUndo: true,
      undoData: {
        messageId,
        originalContent,
      },
    });

    // Auto-dismiss toast after 5 seconds
    // Log trust metric when undo window closes without undo
    setTimeout(() => {
      setAutoFixToast(prev => {
        // If toast still exists for this message, user did NOT undo → kept: true
        if (prev?.undoData?.messageId === messageId) {
          logAutoFixMetric({ kept: true, messageId, intent });
          return null;
        }
        return prev;
      });
    }, 5000);

    console.log('[Auto-Fix Apply] Successfully applied refinement:', messageId);
  }, [autoFixPreview, messages, autoFixPreviewShownAt]);

  // ✅ Cancel Auto Fix (keep original)
  const cancelAutoFix = useCallback(() => {
    // ✅ Track Auto Fix dismissed
    if (autoFixPreview) {
      const reviewDuration = autoFixPreviewShownAt ? Date.now() - autoFixPreviewShownAt : 0;
      const message = messages.find(m => m.id === autoFixPreview.messageId);
      const intent = message?.meta?.intent || message?.meta?.templateId;
      trackAutoFixDismissed({
        draft_id: autoFixPreview.messageId,
        message_id: autoFixPreview.messageId,
        intent_id: intent,
        ui_surface: 'studio',
        editor_state: DraftState.D0_ACTIVE,
        assist_mode: AssistMode.A0_ASSIST_NORMAL,
        review_duration_ms: reviewDuration,
        similarity_score: autoFixPreview.similarity?.score || 1,
        was_fallback: autoFixPreview.usedFallback || false,
      });
    }
    setAutoFixPreviewShownAt(null);

    setAutoFixPreview(null);
    setAutoFixToast({
      show: true,
      message: 'Giữ nguyên bản gốc.',
      type: 'info',
    });

    // Auto-dismiss toast after 3 seconds
    setTimeout(() => {
      setAutoFixToast(null);
    }, 3000);
  }, [autoFixPreview, autoFixPreviewShownAt, messages]);

  // ✅ Undo Auto Fix
  const undoAutoFix = useCallback(() => {
    if (!autoFixToast?.undoData) return;

    const { messageId, originalContent } = autoFixToast.undoData;
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const intent = message.meta?.intent || message.meta?.templateId;

    // ✅ Track Auto Fix undo used
    const timeSinceApply = autoFixAppliedAt ? Date.now() - autoFixAppliedAt : 0;
    trackAutoFixUndoUsed({
      draft_id: messageId,
      message_id: messageId,
      intent_id: intent,
      ui_surface: 'studio',
      editor_state: DraftState.D0_ACTIVE,
      assist_mode: AssistMode.A0_ASSIST_NORMAL,
      time_since_apply_ms: timeSinceApply,
    });
    setAutoFixAppliedAt(null);

    // Log trust metric: user rejected the suggestion
    logAutoFixMetric({ kept: false, messageId, intent });

    if (!isValidIntentId(intent)) {
      console.warn('[Auto-Fix Undo] No valid intent found');
      return;
    }

    // Re-run Quality Lock on original content to restore original state
    const reEvalResult = runQualityLock({
      intent,
      output: originalContent,
      meta: {
        templateId: message.meta?.templateId,
        language: 'vi',
        testMode: message.meta?.testMode,
      },
    });

    const newDecision = reEvalResult.hardFails.length > 0
      ? 'FAIL' as const
      : reEvalResult.softFails.length > 0
      ? 'DRAFT' as const
      : 'PASS' as const;

    // Decrement attempts (but never below 0)
    const currentAttempts = message.meta?.qualityLock?.autoFixAttempts || 0;
    const newAttempts = Math.max(0, currentAttempts - 1);

    // Restore original content
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return {
          ...m,
          content: originalContent,
          meta: {
            ...m.meta,
            qualityLock: {
              decision: newDecision,
              softFails: reEvalResult.softFails,
              hardFails: reEvalResult.hardFails,
              autoFixAttempts: newAttempts,
            },
          },
        };
      }
      return m;
    }));

    // Dismiss toast
    setAutoFixToast(null);

    console.log('[Auto-Fix Undo] Restored original content:', messageId);
  }, [autoFixToast, messages, autoFixAppliedAt]);

  // ✅ Dismiss Auto Fix Toast
  const dismissAutoFixToast = useCallback(() => {
    setAutoFixToast(null);
  }, []);

  // ✅ Orchestrator: Set active source for transforms
  const setActiveSource = useCallback((sourceId: string | null) => {
    setActiveSourceId(sourceId);
  }, []);

  // ✅ Orchestrator: Get last assistant message (for default source selection)
  const getLastAssistantMessage = useCallback((): ChatMessage | null => {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1] : null;
  }, [messages]);

  // ✅ Orchestrator: Get last VALID assistant message (non-empty, non-fallback refusal)
  // Used for transform source selection - skips empty or refusal messages
  const getLastValidAssistantMessage = useCallback((): ChatMessage | null => {
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    // Search from newest to oldest
    for (let i = assistantMessages.length - 1; i >= 0; i--) {
      const msg = assistantMessages[i];
      const content = msg.content?.trim() || '';

      // Skip empty messages
      if (!content) continue;

      // Skip refusal messages
      if (isRefusal(content)) continue;

      // Skip very short messages (likely errors or system messages)
      if (content.length < 20) continue;

      return msg;
    }

    return null;
  }, [messages]);

  // ✅ Orchestrator: Handle transform action from MessageActionBar
  // Includes refusal detection, retry logic, and fallback transforms
  // transformMode: PURE_TRANSFORM (verb only) vs DIRECTED_TRANSFORM (verb + directives)
  // userInstruction: Original user text (for DIRECTED_TRANSFORM prompt building)
  // userActionType: Type of user action (for invariant gate)
  // eventId: Unique event ID (for duplicate prevention)
  const handleTransformAction = useCallback(async (
    action: ActionType,
    sourceMessageId?: string,
    transformMode: TransformMode = 'PURE_TRANSFORM',
    userInstruction?: string,
    userActionType: UserActionType = 'send',
    eventId?: string
  ) => {
    // ✅ INVARIANT-SAFE: Generate event ID if not provided
    const actionEventId = eventId || generateEventId();
    const actionTimestamp = Date.now();

    // ✅ INVARIANT-SAFE: Create authorization token through gate
    const authToken = createAuthorizationToken({
      userActionType,
      eventId: actionEventId,
      actionTimestamp,
      hasValidInput: true, // Transform always has source content as input
      sourceMessageId,
      actionType: action,
      callerLocation: 'handleTransformAction',
    });

    if (!authToken) {
      console.error('[Transform] Execution blocked by gate - no valid authorization');
      setAiError('Không thể thực hiện yêu cầu. Vui lòng thử lại.');
      throw new Error('Execution blocked by gate');
    }
    // Auto-select last VALID assistant message if no source specified
    let effectiveSourceId = sourceMessageId;
    if (!effectiveSourceId) {
      const lastValid = getLastValidAssistantMessage();
      if (!lastValid) {
        console.warn('[Transform] No valid source available - no assistant messages');
        setAiError('Không có nội dung để chỉnh sửa. Hãy tạo nội dung trước.');
        // ✅ B6: Throw to trigger draft restoration in caller
        throw new Error('No valid source available');
      }
      effectiveSourceId = lastValid.id;
      console.log('[Transform] Auto-selected last valid assistant message as source:', effectiveSourceId);
    }

    // Get source message content
    const sourceContent = getMessageContent(effectiveSourceId, messages);
    if (!sourceContent || !sourceContent.trim()) {
      console.warn('[Transform] Source content is empty:', effectiveSourceId);
      setAiError('Nội dung nguồn trống. Vui lòng chọn một tin nhắn khác.');
      // ✅ B6: Throw to trigger draft restoration in caller
      throw new Error('Source content is empty');
    }

    // Set active source for UI indicator
    setActiveSourceId(effectiveSourceId);
    setTransformLoading(effectiveSourceId);

    // ✅ STEP 5 (UX): Record length preference for soft memory
    // Track when user explicitly requests length changes
    if (action === 'EXPAND') {
      recordLongerRequest();
    } else if (action === 'SHORTEN') {
      recordShorterRequest();
    }

    try {
      // Get action label for user message
      const actionLabel = getActionLabel(action);

      // ✅ MODE-AWARE INSTRUCTION BUILDING
      // PURE_TRANSFORM: Generic instruction based on action type
      // DIRECTED_TRANSFORM: Use user's original instruction with directives preserved
      let instruction: string;

      if (transformMode === 'DIRECTED_TRANSFORM' && userInstruction) {
        // User provided specific directives - use their exact instruction
        // Example: "viết lại chuyên nghiệp hơn, dành cho GenZ" → keep full instruction
        instruction = userInstruction;
        console.log('[Transform] DIRECTED mode - using user instruction:', userInstruction.substring(0, 50));
      } else {
        // Pure transform - build generic instruction from action type
        instruction = `${actionLabel} nội dung này.`;
        console.log('[Transform] PURE mode - using generic instruction:', instruction);
      }

      // Resolve template system prompt if available
      const sourceMessage = messages.find(m => m.id === effectiveSourceId);
      const templateId = sourceMessage?.meta?.templateId || selectedTemplateId;
      let templateSystemPrompt: string | undefined;

      if (templateId) {
        try {
          const manifest = resolveTemplateManifest(templateId);
          if (manifest) {
            templateSystemPrompt = buildSystemPrompt(manifest, {
              toneReinforcement: selectedTone?.systemReinforcement,
            });
          }
        } catch {
          // Use default prompt if manifest not found
        }
      }

      // Extract locked context from source
      const lockedContext = extractLockedContext(sourceContent, effectiveSourceId);

      // Determine lock mode based on whether validation is needed
      const useValidation = shouldValidate(action);

      // ✅ IMMUTABLE OUTPUT CONTRACT: Extract quantitative requirements from user instruction
      const outputContract: TransformOutputContract = userInstruction
        ? extractOutputContract(userInstruction, sourceContent)
        : { requiredMinWords: null, requiredMaxWords: null, requiredStructure: [], requiredTone: null, derivedFrom: '', isStrict: false };

      if (outputContract.isStrict) {
        console.log('[Transform] Output contract extracted:', {
          minWords: outputContract.requiredMinWords,
          maxWords: outputContract.requiredMaxWords,
          tone: outputContract.requiredTone,
        });
      }

      // ✅ MODE-AWARE SYSTEM PROMPT
      // PURE_TRANSFORM: Strong topic lock constraints
      // DIRECTED_TRANSFORM: Lighter constraints, trust user's directive
      const basePrompt = templateSystemPrompt || 'Bạn là trợ lý viết nội dung chuyên nghiệp. Hãy hoàn thành yêu cầu của người dùng.';

      let constrainedPrompt: string;
      if (transformMode === 'DIRECTED_TRANSFORM') {
        // Lighter constraints for directed transforms
        // User explicitly asked for changes, so allow more flexibility
        constrainedPrompt = useValidation
          ? injectConstraints(basePrompt, lockedContext, 'RELAXED') // Relaxed constraints
          : basePrompt;
      } else {
        // Strong constraints for pure transforms
        constrainedPrompt = useValidation
          ? injectConstraints(basePrompt, lockedContext, 'NORMAL')
          : basePrompt;
      }

      // ✅ Add contract instruction to system prompt if strict requirements exist
      const contractInstruction = buildContractInstruction(outputContract);
      if (contractInstruction) {
        constrainedPrompt = constrainedPrompt + '\n\n' + contractInstruction;
      }

      // ============================================
      // STEP 22: Detect REWRITE_UPGRADE for anchor injection
      // ============================================
      const taskDetectionCtx: TaskDetectionContext = {
        hasActiveDraft: messages.some(m => m.role === 'assistant' && m.content.length > 100),
        hasPreviousMessages: messages.length > 0,
        lang: 'vi',
      };
      const taskDetection = detectTaskType(userInstruction || instruction, taskDetectionCtx);
      const isRewriteUpgrade = taskDetection.taskType === 'REWRITE_UPGRADE';

      // ✅ STEP 22: Inject anchors for REWRITE_UPGRADE mode
      let anchorMeta: AnchoredContent | null = null;
      let effectiveSourceReference: string;

      if (isRewriteUpgrade && shouldApplyAnchors(sourceContent)) {
        // Use anchored source reference for REWRITE_UPGRADE
        anchorMeta = injectAnchors(sourceContent);
        effectiveSourceReference = `\n\n---\n**SOURCE CONTENT TO REWRITE (with paragraph anchors):**\n\`\`\`\n${anchorMeta.anchoredText}\n\`\`\`\n\n**ANCHOR COUNT:** ${anchorMeta.paragraphCount} paragraphs (${anchorMeta.anchorIds.join(', ')})\n---\n`;
        console.log('[Transform] REWRITE_UPGRADE with anchors:', {
          paragraphCount: anchorMeta.paragraphCount,
          anchors: anchorMeta.anchorIds,
        });
      } else {
        // Standard source reference for other modes
        effectiveSourceReference = buildSourceReference(sourceContent);
      }

      // Retry logic: NORMAL → STRICT (with contract enforcement)
      // Max 2 attempts for strict contracts
      const maxAttempts = outputContract.isStrict ? 2 : 3;
      let attemptCount = 0;
      let success = false;
      let lastContractValidation: ContractValidationResult | null = null;
      let lastExecutionError: string | null = null; // Track last error for surfacing
      let lastReasonCode: string | null = null; // Track reasonCode for user-facing messages
      let lastAnchorError: string | null = null; // Track anchor validation errors
      let lastDiffGuardError: string | null = null; // Track diff guard errors

      while (attemptCount < maxAttempts && !success) {
        attemptCount++;
        const isRetry = attemptCount > 1;

        // Build instruction with enforcement if retry
        let modeInstruction = instruction;

        if (isRetry && lastContractValidation && !lastContractValidation.passed) {
          // ✅ Add enforcement instruction for retry
          const enforcement = buildEnforcementInstruction(lastContractValidation.violations);
          modeInstruction = enforcement + '\n\n' + instruction;
          console.log('[Transform] Retry with enforcement:', lastContractValidation.violations.map(v => v.type));
        } else if (isRetry) {
          // Generic retry instruction (refusal or API error)
          modeInstruction += '\n\n⚠️ QUAN TRỌNG: Phải giữ nguyên tất cả số liệu, tên riêng, và thông tin quan trọng.';
        }

        try {
          // ✅ INVARIANT-SAFE: Build LLM request
          // ✅ CRITICAL: Include full conversation history for context
          const transformMessages: LLMRequest['messages'] = [
            { role: 'system', content: constrainedPrompt },
          ];

          // Add all previous messages for context
          for (const msg of messages) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              transformMessages.push({
                role: msg.role,
                content: msg.content,
              });
            }
          }

          // Add current transform instruction as final user message
          // ✅ STEP 22: Use effectiveSourceReference (anchored for REWRITE_UPGRADE)
          transformMessages.push({
            role: 'user',
            content: modeInstruction + effectiveSourceReference,
          });

          // Compute final userPrompt for binding validation
          const finalUserPrompt = modeInstruction + effectiveSourceReference;
          // ✅ CRITICAL FIX: Trim to match executor normalization (llmExecutor.ts:281)
          const trimmedUserPrompt = finalUserPrompt.trim();

          const transformRequest: LLMRequest = {
            messages: transformMessages,
            userPrompt: trimmedUserPrompt, // Explicit userPrompt (trimmed for consistency)
            meta: {
              templateId,
              mode: 'execute',
              // ✅ STEP 18: Use uiFinalPromptHash for enriched transform prompts (TRIMMED)
              uiFinalPromptHash: safeHash(trimmedUserPrompt),
              uiFinalPromptLength: trimmedUserPrompt.length,
            },
            // ✅ STEP 21: Inject edit patch metadata if set
            // This enables partial edits without requiring full structure
            editPatch: pendingEditPatchMeta || undefined,
            // ✅ STEP 22: Inject output contract if set
            // This enforces [PATCH] block format for patch-only edits
            outputContract: pendingOutputContract || undefined,
            // ✅ STEP 22: Answer Engine context
            // Enables QA vs EDIT_PATCH vs CREATE mode detection
            answerEngineContext: {
              hasActiveDraft: messages.some(m => m.role === 'assistant' && m.content.length > 100),
              hasPreviousMessages: messages.length > 0,
              lang: 'vi',
            },
          };

          // ✅ INVARIANT-SAFE: Execute through authorized LLM executor
          const executionResult = await executeLLM(authToken, transformRequest);

          if (!executionResult.success || !executionResult.response) {
            // Capture error for surfacing
            lastExecutionError = executionResult.error || 'Unknown execution error';
            lastReasonCode = executionResult.debugInfo?.reasonCode || null;
            console.error('[Transform] API error on attempt', attemptCount, ':', {
              error: executionResult.error,
              reasonCode: executionResult.debugInfo?.reasonCode,
              eventId: executionResult.debugInfo?.eventId,
            });
            continue; // Try next attempt
          }

          const output = executionResult.response.content;

          // Check for refusal
          if (isRefusal(output)) {
            console.log(`[Transform] Refusal detected on attempt ${attemptCount}, retrying...`);
            continue; // Try next attempt
          }

          // ✅ IMMUTABLE CONTRACT VALIDATION
          if (outputContract.isStrict) {
            const contractValidation = validateOutputContract(output, outputContract);
            lastContractValidation = contractValidation;

            if (!contractValidation.passed) {
              console.log(`[Transform] Contract validation FAILED on attempt ${attemptCount}:`, {
                wordCount: contractValidation.wordCount,
                violations: contractValidation.violations,
              });
              continue; // Try next attempt with enforcement
            }

            console.log(`[Transform] Contract validation PASSED:`, {
              wordCount: contractValidation.wordCount,
              required: { min: outputContract.requiredMinWords, max: outputContract.requiredMaxWords },
            });
          }

          // ✅ STEP 22: ANCHOR VALIDATION for REWRITE_UPGRADE
          // Reject output if anchor structure is violated
          if (anchorMeta) {
            const anchorValidation = validateAnchors(output, anchorMeta.anchorIds);

            if (!anchorValidation.valid) {
              lastAnchorError = anchorValidation.error || 'Anchor structure violation';
              console.log(`[Transform] Anchor validation FAILED on attempt ${attemptCount}:`, {
                expected: anchorValidation.expected,
                found: anchorValidation.found,
                missing: anchorValidation.missing,
                extra: anchorValidation.extra,
                orderPreserved: anchorValidation.orderPreserved,
                error: anchorValidation.error,
              });
              continue; // Try next attempt - NO silent fallback
            }

            console.log(`[Transform] Anchor validation PASSED:`, {
              anchorCount: anchorMeta.paragraphCount,
              orderPreserved: anchorValidation.orderPreserved,
            });

            // ✅ STEP 22: DIFF GUARD for conservative rewrite limits
            // Applied AFTER anchor validation, ONLY for REWRITE_UPGRADE
            const diffResult = validateRewriteDiff(anchorMeta.anchoredText, output);

            if (!diffResult.ok) {
              lastDiffGuardError = getDiffGuardErrorMessage(diffResult, 'vi');
              console.log(`[Transform] Diff guard FAILED on attempt ${attemptCount}:`, {
                reason: diffResult.reason,
                details: diffResult.details,
                paragraphAnalysis: diffResult.paragraphAnalysis.map(p => ({
                  anchor: p.anchorId,
                  passed: p.passed,
                  failReason: p.failReason,
                })),
              });
              continue; // Try next attempt - NO silent fallback
            }

            console.log(`[Transform] Diff guard PASSED:`, {
              paragraphCount: diffResult.paragraphAnalysis.length,
              allPassed: diffResult.paragraphAnalysis.every(p => p.passed),
            });
          }

          // Success!
          success = true;

          // ✅ STEP 22: Strip anchors from output for display
          // Anchors are for validation only, not for user-facing content
          const cleanOutput = anchorMeta ? stripAnchors(output) : output;

          // Generate requestId for this transform
          const requestId = generateRequestId();

          // ✅ B4: Compute transform chain tracking
          // If source has originMessageId, use it; otherwise, source IS the origin
          const originMessageId = sourceMessage?.meta?.originMessageId || effectiveSourceId;
          // If source has transformDepth, increment; otherwise this is depth 1
          const transformDepth = (sourceMessage?.meta?.transformDepth || 0) + 1;

          // ============================================
          // CONCEPTUAL INVARIANT: userTypedText === displayed text
          // ============================================
          // USER MESSAGE ≠ ACTION
          // - If user typed instruction → userTypedText = instruction
          // - If user clicked button → userTypedText = actionLabel (what they chose)
          // Both are valid "user expressions" - one via keyboard, one via button.
          const userTypedText = userInstruction?.trim() || actionLabel;

          const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userTypedText, // Content = what user expressed
            timestamp: new Date(),
            meta: {
              requestId,
              templateId: templateId ?? undefined,
              actionType: action,
              sourceMessageId: effectiveSourceId,
              // ✅ MANDATORY: userTypedText is ALWAYS populated
              userTypedText, // This is THE source of truth for display
              // Internal fields (NOT for display):
              transformMode,
              actionLabel,
            },
          };

          // ✅ Diff & Apply: Extract sections for apply functionality
          // Use cleanOutput (anchors stripped) for display and diff
          const beforeSectionsRaw = extractSections(sourceContent);
          const afterSectionsRaw = extractSections(cleanOutput);

          // Add AI response with chain tracking and diff/apply metadata
          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: cleanOutput, // ✅ STEP 22: Use anchor-stripped output
            timestamp: new Date(),
            meta: {
              requestId,
              templateId: templateId ?? undefined,
              actionType: action,
              sourceMessageId: effectiveSourceId,
              lockedContext: useValidation ? lockedContext : undefined,
              originMessageId,      // ✅ B4: Track chain origin
              transformDepth,       // ✅ B4: Track depth in chain
              // ✅ Diff & Apply: Store before/after for section-level apply
              diffApply: {
                applyTargetMessageId: effectiveSourceId,
                beforeText: sourceContent,
                afterText: cleanOutput, // ✅ STEP 22: Use anchor-stripped output
                beforeSections: {
                  hook: beforeSectionsRaw.hook ?? undefined,
                  body: beforeSectionsRaw.body ?? undefined,
                  cta: beforeSectionsRaw.cta ?? undefined,
                  hashtags: beforeSectionsRaw.hashtags ?? undefined,
                },
                afterSections: {
                  hook: afterSectionsRaw.hook ?? undefined,
                  body: afterSectionsRaw.body ?? undefined,
                  cta: afterSectionsRaw.cta ?? undefined,
                  hashtags: afterSectionsRaw.hashtags ?? undefined,
                },
                applyState: 'idle',
              },
            },
          };

          setMessages(prev => [...prev, userMsg, assistantMsg]);

          console.log('[Transform] Success:', {
            action,
            sourceMessageId: effectiveSourceId,
            outputLength: cleanOutput.length,
            attemptCount,
            contractPassed: lastContractValidation?.passed ?? 'N/A',
            anchorsStripped: anchorMeta ? true : false,
          });

          break; // Exit retry loop

        } catch (error) {
          console.error(`[Transform] API error on attempt ${attemptCount}:`, error);
          // Continue to next attempt
        }
      }

      // All retries failed
      if (!success) {
        // ✅ STRICT CONTRACT FAILURE: Do NOT fallback, show system error
        if (outputContract.isStrict && lastContractValidation && !lastContractValidation.passed) {
          const violation = lastContractValidation.violations[0];
          const errorMsg = violation
            ? `Không thể tạo nội dung đúng yêu cầu (${violation.expected}, thực tế: ${violation.actual}). Vui lòng thử lại.`
            : 'Không thể tạo nội dung đúng yêu cầu. Vui lòng thử lại.';
          setAiError(errorMsg);
          console.log('[Transform] Contract validation failed after all retries - NO FALLBACK');
          throw new Error('Contract validation failed');
        }

        // ✅ STEP 22: ANCHOR VALIDATION FAILURE: Do NOT fallback, show system error
        if (lastAnchorError) {
          const errorMsg = `Không thể viết lại nội dung đúng cấu trúc (${lastAnchorError}). Vui lòng thử lại.`;
          setAiError(errorMsg);
          console.log('[Transform] Anchor validation failed after all retries - NO FALLBACK');
          throw new Error('Anchor validation failed');
        }

        // ✅ STEP 22: DIFF GUARD FAILURE: Do NOT fallback, show system error
        if (lastDiffGuardError) {
          const errorMsg = `Không thể viết lại nội dung (${lastDiffGuardError}). Vui lòng thử lại.`;
          setAiError(errorMsg);
          console.log('[Transform] Diff guard failed after all retries - NO FALLBACK');
          throw new Error('Diff guard failed');
        }

        console.log('[Transform] All retries failed, using fallback transform');

        // Special case: TRANSLATE cannot be done without AI - show system warning
        if (action === 'TRANSLATE') {
          const errorMsg = getUserFacingAiError({
            lang: 'vi',
            reasonCode: lastReasonCode,
            fallback: `Không thể dịch tự động. Vui lòng thử lại sau hoặc dịch thủ công.`,
          });
          setAiError(errorMsg);
          console.log('[Transform] TRANSLATE failed - showing system warning instead of fallback');
          // ✅ B6: Throw to trigger draft restoration
          throw new Error(lastExecutionError || 'Translation requires AI');
        }

        // Special case: DIRECTED_TRANSFORM cannot be done with rule-based fallback
        // User's directives require AI understanding
        if (transformMode === 'DIRECTED_TRANSFORM') {
          const errorMsg = getUserFacingAiError({
            lang: 'vi',
            reasonCode: lastReasonCode,
            fallback: `Không thể áp dụng chỉ dẫn của bạn. Vui lòng thử lại hoặc đơn giản hóa yêu cầu.`,
          });
          setAiError(errorMsg);
          console.log('[Transform] DIRECTED_TRANSFORM failed - directives require AI');
          // ✅ B6: Throw to trigger draft restoration
          throw new Error(lastExecutionError || 'Directed transform requires AI');
        }

        const fallbackOutput = applyFallbackTransform(action, sourceContent);

        // Safety check: ensure fallback is not a refusal either
        if (isRefusal(fallbackOutput)) {
          setAiError(`${actionLabel} thất bại. Vui lòng thử lại.`);
          console.log('[Transform] Fallback also produced refusal - showing error');
          // ✅ B6: Throw to trigger draft restoration
          throw new Error('Fallback produced refusal');
        }

        // Generate requestId for fallback
        const requestId = generateRequestId();

        // ✅ B4: Compute transform chain tracking for fallback
        const originMessageId = sourceMessage?.meta?.originMessageId || effectiveSourceId;
        const transformDepth = (sourceMessage?.meta?.transformDepth || 0) + 1;

        // ============================================
        // CONCEPTUAL INVARIANT: userTypedText === displayed text
        // ============================================
        // This fallback path only runs for PURE_TRANSFORM (button clicks)
        // User clicked a button → userTypedText = actionLabel (what they chose)
        const userTypedText = userInstruction?.trim() || actionLabel;

        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: userTypedText, // Content = what user expressed
          timestamp: new Date(),
          meta: {
            requestId,
            templateId: templateId ?? undefined,
            actionType: action,
            sourceMessageId: effectiveSourceId,
            // ✅ MANDATORY: userTypedText is ALWAYS populated
            userTypedText, // This is THE source of truth for display
            // Internal fields (NOT for display):
            transformMode: 'PURE_TRANSFORM',
            actionLabel,
          },
        };

        // ✅ Diff & Apply: Extract sections for fallback apply functionality
        const beforeSectionsFallback = extractSections(sourceContent);
        const afterSectionsFallback = extractSections(fallbackOutput);

        // Add fallback response with chain tracking and diff/apply metadata
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: fallbackOutput,
          timestamp: new Date(),
          meta: {
            requestId,
            templateId: templateId ?? undefined,
            actionType: action,
            sourceMessageId: effectiveSourceId,
            isFallback: true, // Mark as fallback for potential UI indicator
            originMessageId,      // ✅ B4: Track chain origin
            transformDepth,       // ✅ B4: Track depth in chain
            // ✅ Diff & Apply: Store before/after for section-level apply
            diffApply: {
              applyTargetMessageId: effectiveSourceId,
              beforeText: sourceContent,
              afterText: fallbackOutput,
              beforeSections: {
                hook: beforeSectionsFallback.hook ?? undefined,
                body: beforeSectionsFallback.body ?? undefined,
                cta: beforeSectionsFallback.cta ?? undefined,
                hashtags: beforeSectionsFallback.hashtags ?? undefined,
              },
              afterSections: {
                hook: afterSectionsFallback.hook ?? undefined,
                body: afterSectionsFallback.body ?? undefined,
                cta: afterSectionsFallback.cta ?? undefined,
                hashtags: afterSectionsFallback.hashtags ?? undefined,
              },
              applyState: 'idle',
            },
          },
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);

        console.log('[Transform] Used fallback transform:', {
          action,
          sourceMessageId: effectiveSourceId,
          outputLength: fallbackOutput.length,
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transform failed';
      console.error('[Transform] Failed:', errorMessage);
      setAiError(`${getActionLabel(action)} thất bại: ${errorMessage}`);
      // ✅ B6: Re-throw so caller can restore draft
      throw error;
    } finally {
      setTransformLoading(null);
      // Keep source selected for potential follow-up transforms
    }
  }, [messages, selectedTemplateId, selectedTone, getLastValidAssistantMessage]);

  // ============================================
  // INVARIANT-SAFE EXECUTION DISPATCHER
  // ============================================
  // This is the ONLY function that can trigger AI logic.
  // ExecutionGate is checked FIRST, before ANY intent detection,
  // routing, state mutation, or execution.
  //
  // HARD INVARIANT: If gate blocks, NOTHING happens.
  // ============================================

  /**
   * dispatchExecution - Single entry point to ALL AI logic
   *
   * INVARIANTS ENFORCED:
   * 1. Gate check happens FIRST (before any intent detection)
   * 2. If gate blocks → immediate return, zero side effects
   * 3. Intent detection only runs AFTER gate approval
   * 4. State mutations only happen AFTER successful execution
   */
  const dispatchExecution = useCallback(async (params: {
    userActionType: UserActionType;
    inputText: string;
    eventId: string;
    timestamp: number;
    uiSourceMessageId?: string | null;  // ✅ STEP 6: UI BINDING - user clicked message + typed follow-up
    // ✅ STEP 18: Request binding metadata for single source of truth
    uiInputHash?: string;
    uiInputLength?: number;
    uiSendAt?: number;
  }) => {
    const { userActionType, inputText, eventId, timestamp, uiSourceMessageId, uiInputHash, uiInputLength, uiSendAt } = params;

    // ============================================
    // GATE CHECK - MUST BE FIRST
    // ============================================
    // NO intent detection, NO state mutation, NO routing before this point
    const authToken = createAuthorizationToken({
      userActionType,
      eventId,
      actionTimestamp: timestamp,
      hasValidInput: !!inputText.trim(),
      callerLocation: 'dispatchExecution',
    });

    if (!authToken) {
      // GATE BLOCKED - Return immediately, do NOTHING
      console.warn('[dispatchExecution] BLOCKED by ExecutionGate - no execution');
      return { success: false, reason: 'GATE_BLOCKED' };
    }

    // ============================================
    // GATE PASSED - Now we can do intent detection and routing
    // ============================================
    console.log('[dispatchExecution] GATE PASSED - proceeding with execution', { eventId });

    // Save input for error recovery
    const savedInput = inputText;

    try {
      // ✅ STEP 1: Check for explicit NEW-CREATE signals (after gate!)
      const isExplicitNewCreate = detectNewCreate(inputText);

      if (isExplicitNewCreate) {
        console.log('[dispatchExecution] Explicit NEW-CREATE signal detected');
      }

      // ✅ STEP 2: Classify user intent (after gate!)
      const classification = classifyAction(inputText);

      console.log('[dispatchExecution] Action classification:', {
        type: classification.type,
        category: classification.category,
        confidence: classification.confidence,
        signals: classification.signals,
        lastIntentType,
        isExplicitNewCreate,
      });

      // ✅ STEP 3: Determine routing
      const STRONG_TRANSFORM_VERBS = [
        /^(viết\s+lại|rewrite)/i,
        /^(rút\s*gọn|shorten|ngắn\s+lại)/i,
        /^(tối\s*ưu|optimize|cải\s*thiện)/i,
        /^(đổi\s*giọng|change\s*tone)/i,
        /^(mở\s*rộng|expand)/i,
        /^(dịch|translate)/i,
        /^(đổi\s*format|convert)/i,
      ];

      const hasStrongVerb = STRONG_TRANSFORM_VERBS.some(p => p.test(inputText.trim()));
      const hasValidSource = getLastValidAssistantMessage() !== null;
      const isClassifierConfident = classification.confidence >= 0.7;
      const isClassifierUncertain = classification.confidence < 0.7 && classification.confidence >= 0.45;

      // ============================================
      // ✅ STEP 5: EXECUTION CONTRACT ENFORCEMENT
      // ============================================
      // Use resolveExecutionSource for strict priority-based resolution.
      // This ensures intent → execution consistency.
      //
      // PRIORITY ORDER (highest to lowest):
      // 1. IntentSnapshot.sourceMessageId (if exists) - BINDING
      // 2. activeSourceId (UI-selected source) - user explicitly chose
      // 3. lastTransformSourceId (intent memory) - chain lock
      // 4. getLastValidAssistantMessage() - fallback
      // ============================================

      // ============================================
      // ✅ STEP 6: UI BINDING takes HIGHEST priority
      // ============================================
      // Resolve source using execution contract (before we have intent snapshot)
      // We'll validate contract AFTER creating the snapshot
      const preliminarySourceResult = resolveExecutionSource({
        intentSnapshot: null, // Will validate after snapshot creation
        uiSourceMessageId,    // ✅ STEP 6: UI BINDING (highest priority)
        activeSourceId,
        lastTransformSourceId: lastIntentType === 'TRANSFORM' ? lastTransformSourceId : null,
        messages,
        getLastValidAssistantMessage,
      });

      // ✅ STEP 6: Log UI binding resolution
      if (uiSourceMessageId && preliminarySourceResult.resolution === 'UI_BINDING') {
        console.log('[dispatchExecution] UI BINDING active:', {
          uiSourceMessageId,
          resolvedSourceId: preliminarySourceResult.sourceId,
        });
      }

      let forcedSourceId = preliminarySourceResult.sourceId;

      console.log('[dispatchExecution] Source resolution:', {
        sourceId: forcedSourceId,
        resolution: preliminarySourceResult.resolution,
        matchesIntent: preliminarySourceResult.matchesIntent,
      });

      // ✅ GAP B: TOPIC DRIFT AUTO BREAK
      let isTopicDrift = false;
      if (lastIntentType === 'TRANSFORM' && forcedSourceId && !isExplicitNewCreate) {
        const sourceContent = getMessageContent(forcedSourceId, messages);
        if (sourceContent) {
          isTopicDrift = detectTopicDrift(inputText, sourceContent);
          if (isTopicDrift) {
            console.log('[dispatchExecution] GAP B: Topic drift detected');
            forcedSourceId = null;
          }
        }
      }

      // Determine routing
      let shouldRouteToTransform = false;

      if (isExplicitNewCreate || isTopicDrift) {
        shouldRouteToTransform = false;
      } else if (classification.category === 'transform' && isClassifierConfident && hasValidSource) {
        shouldRouteToTransform = true;
      } else if (hasStrongVerb && classification.confidence >= 0.45 && hasValidSource) {
        shouldRouteToTransform = true;
      } else if (isClassifierUncertain && lastIntentType === 'TRANSFORM' && hasValidSource) {
        console.log('[dispatchExecution] Using intent memory: defaulting to TRANSFORM');
        shouldRouteToTransform = true;
      }

      // ============================================
      // EXECUTE (after gate approval)
      // ============================================

      if (shouldRouteToTransform) {
        // TRANSFORM PATH
        const transformMode = classification.transformMode || detectTransformMode(inputText);
        const actionLabel = getActionLabel(classification.type as ActionType);

        console.log('[dispatchExecution] Executing TRANSFORM:', {
          type: classification.type,
          transformMode,
          forcedSourceId,
        });

        // ✅ STEP 5: Use execution contract for source resolution
        // This ensures consistent source resolution across the pipeline
        let effectiveSourceForMemory = forcedSourceId;
        if (!effectiveSourceForMemory) {
          const lastValid = getLastValidAssistantMessage();
          effectiveSourceForMemory = lastValid?.id || null;
        }

        // ✅ STEP 5: Use getOriginForChain for consistent origin tracking
        // This replaces manual origin lookup with contract-enforced resolution
        const originToTrack = getOriginForChain(effectiveSourceForMemory, messages);

        if (originToTrack !== effectiveSourceForMemory) {
          console.log('[dispatchExecution] Using origin from chain:', originToTrack);
        }

        // ============================================
        // ✅ OPTIMISTIC RENDERING: Show user message IMMEDIATELY
        // ============================================
        const optimisticUserMsgId = `user-${Date.now()}`;
        const requestId = generateRequestId();

        // ============================================
        // CONCEPTUAL INVARIANT: userTypedText === displayed text
        // ============================================
        // USER MESSAGE ≠ ACTION
        // - userTypedText: ALWAYS what the user expressed (MANDATORY)
        // - actionLabel: Internal only (for routing, badges, NOT display)
        //
        // What user expressed:
        // - If they typed "viết lại giọng tự nhiên" → that's their userTypedText
        // - If they typed just "viết lại" → that's their userTypedText
        // - The inputText IS what the user typed. Period.
        // ============================================
        const userTypedText = inputText.trim();

        // ============================================
        // ✅ STEP 3: Create Intent Snapshot (OBSERVABILITY ONLY)
        // ============================================
        // Snapshot is READ-ONLY and NEVER affects execution.
        // Used for debugging and regression detection.
        const turnIndex = messages.filter(m => m.role === 'user').length;
        const sourceMsg = effectiveSourceForMemory
          ? messages.find(m => m.id === effectiveSourceForMemory)
          : null;
        const previousSnapshot = sourceMsg ? getMessageSnapshot(sourceMsg) : null;

        const intentSnapshot = createTransformSnapshot({
          userTypedText,
          transformMode,
          actionType: classification.type,
          sourceMessageId: effectiveSourceForMemory || '',
          turnIndex,
          previousSnapshot: previousSnapshot ?? undefined,
        });

        // DEV-ONLY: Validate snapshot and execution contract
        if (process.env.NODE_ENV === 'development') {
          const snapshotValidation = validateSnapshot(intentSnapshot);
          console.log('[dispatchExecution] Intent Snapshot (TRANSFORM):', {
            snapshotId: intentSnapshot.snapshotId,
            mode: intentSnapshot.detectedMode,
            actions: intentSnapshot.detectedActions,
            valid: snapshotValidation.valid,
          });

          // ✅ STEP 5: Validate execution contract
          const contractValidation = validateExecutionContract(intentSnapshot, {
            sourceId: effectiveSourceForMemory,
            resolution: preliminarySourceResult.resolution,
            matchesIntent: intentSnapshot.sourceMessageId === effectiveSourceForMemory,
          });

          if (!contractValidation.valid) {
            console.warn('[dispatchExecution] Execution contract violations:', {
              violations: contractValidation.violations,
              snapshotSource: intentSnapshot.sourceMessageId,
              effectiveSource: effectiveSourceForMemory,
            });
          }

          // ✅ STEP 5: Check for source drift
          warnIfExecutionSourceDrifts(intentSnapshot, effectiveSourceForMemory, 'dispatchExecution:TRANSFORM');
          warnIfModeMismatch(intentSnapshot, true, 'dispatchExecution:TRANSFORM');
        }

        console.log('[dispatchExecution] User message (TRANSFORM):', {
          userTypedText: userTypedText.substring(0, 50),
          actionLabel, // Internal only
          transformMode, // Internal routing only
        });

        const optimisticUserMsg: ChatMessage = {
          id: optimisticUserMsgId,
          role: 'user',
          content: userTypedText, // Content = what user typed
          timestamp: new Date(),
          meta: {
            requestId,
            status: 'pending', // Will be updated to 'done' when assistant responds
            // ✅ MANDATORY: userTypedText is ALWAYS populated
            userTypedText, // This is THE source of truth for display
            // Internal fields (NOT for display):
            transformMode,
            actionLabel,
            sourceMessageId: effectiveSourceForMemory || undefined,
            actionType: classification.type as ActionType,
            // ✅ STEP 3: Attach intent snapshot (OBSERVABILITY ONLY)
            intentSnapshot,
          },
        };

        // Append user message IMMEDIATELY (before LLM call)
        setMessages(prev => [...prev, optimisticUserMsg]);

        // Clear input IMMEDIATELY for responsive UX
        setChatInput('');

        try {
          // Execute transform (gate already passed, token already obtained)
          // Pass the optimistic user message ID so it doesn't create a duplicate
          // userTypedText is ALWAYS passed - it's what the user expressed
          await executeTransformWithToken(
            authToken,
            classification.type as ActionType,
            forcedSourceId || undefined,
            transformMode,
            userTypedText, // ALWAYS pass user's full text
            optimisticUserMsgId, // ✅ Pass existing user message ID
            requestId, // ✅ Pass request ID for linking
            // ✅ STEP 18: Pass request binding metadata
            { uiInputHash, uiInputLength, uiSendAt, eventId }
          );

          // ✅ Update user message status to 'done' on success
          setMessages(prev => prev.map(m =>
            m.id === optimisticUserMsgId
              ? { ...m, meta: { ...m.meta, status: 'done' as const } }
              : m
          ));

        } catch (error) {
          // ✅ Update user message status to 'error' on failure
          setMessages(prev => prev.map(m =>
            m.id === optimisticUserMsgId
              ? { ...m, meta: { ...m.meta, status: 'error' as const } }
              : m
          ));
          throw error; // Re-throw to be caught by outer catch
        }

        // ✅ CRITICAL FIX: Update intent memory to track ORIGIN, not the new result
        // This prevents subsequent transforms from using wrong context
        setLastIntentType('TRANSFORM');
        setLastTransformSourceId(originToTrack);

        console.log('[dispatchExecution] Intent memory updated:', {
          lastIntentType: 'TRANSFORM',
          lastTransformSourceId: originToTrack,
          wasChainedFromOrigin: originToTrack !== effectiveSourceForMemory,
        });

        // Reset topic drift state if needed
        if (isExplicitNewCreate || isTopicDrift) {
          setLastIntentType('CREATE');
          setLastTransformSourceId(null);
        }

        return { success: true };

      } else {
        // CREATE PATH
        const effectiveTemplateId = resolveEffectiveTemplateId(selectedTemplateId, inputText);

        console.log('[dispatchExecution] Executing CREATE:', {
          templateId: effectiveTemplateId,
        });

        // ============================================
        // ✅ OPTIMISTIC RENDERING: Show user message IMMEDIATELY
        // ============================================
        const optimisticUserMsgId = `user-${Date.now()}`;
        const requestId = generateRequestId();

        // ============================================
        // CONCEPTUAL INVARIANT: userTypedText === displayed text
        // ============================================
        const userTypedText = inputText.trim();

        // ============================================
        // ✅ STEP 3: Create Intent Snapshot (OBSERVABILITY ONLY)
        // ============================================
        // Snapshot is READ-ONLY and NEVER affects execution.
        // Used for debugging and regression detection.
        const turnIndex = messages.filter(m => m.role === 'user').length;

        const intentSnapshot = createCreateSnapshot({
          userTypedText,
          turnIndex,
        });

        // DEV-ONLY: Validate snapshot and execution contract
        if (process.env.NODE_ENV === 'development') {
          const snapshotValidation = validateSnapshot(intentSnapshot);
          console.log('[dispatchExecution] Intent Snapshot (CREATE):', {
            snapshotId: intentSnapshot.snapshotId,
            mode: intentSnapshot.detectedMode,
            valid: snapshotValidation.valid,
          });

          // ✅ STEP 5: Validate execution contract for CREATE
          const contractValidation = validateExecutionContract(intentSnapshot, {
            sourceId: null, // CREATE has no source
            resolution: 'NONE',
            matchesIntent: true,
          });

          if (!contractValidation.valid) {
            console.warn('[dispatchExecution] Execution contract violations (CREATE):', {
              violations: contractValidation.violations,
            });
          }

          // ✅ STEP 5: Check for mode mismatch
          warnIfModeMismatch(intentSnapshot, false, 'dispatchExecution:CREATE');
        }

        const optimisticUserMsg: ChatMessage = {
          id: optimisticUserMsgId,
          role: 'user',
          content: userTypedText, // Content = what user typed
          timestamp: new Date(),
          meta: {
            requestId,
            status: 'pending',
            templateId: effectiveTemplateId,
            // ✅ MANDATORY: userTypedText is ALWAYS populated
            userTypedText, // This is THE source of truth for display
            // ✅ STEP 3: Attach intent snapshot (OBSERVABILITY ONLY)
            intentSnapshot,
          },
        };

        // Append user message IMMEDIATELY (before LLM call)
        setMessages(prev => [...prev, optimisticUserMsg]);

        // Clear input IMMEDIATELY for responsive UX
        setChatInput('');

        // Trigger celebration
        triggerCelebration();

        try {
          // Execute create (gate already passed, token already obtained)
          // Pass the optimistic user message ID so it doesn't create a duplicate
          await executeCreateWithToken(
            authToken,
            effectiveTemplateId,
            inputText,
            optimisticUserMsgId, // ✅ Pass existing user message ID
            requestId, // ✅ Pass request ID for linking
            // ✅ STEP 18: Pass request binding metadata
            { uiInputHash, uiInputLength, uiSendAt, eventId }
          );

          // ✅ Update user message status to 'done' on success
          setMessages(prev => prev.map(m =>
            m.id === optimisticUserMsgId
              ? { ...m, meta: { ...m.meta, status: 'done' as const } }
              : m
          ));

        } catch (error) {
          // ✅ Update user message status to 'error' on failure
          setMessages(prev => prev.map(m =>
            m.id === optimisticUserMsgId
              ? { ...m, meta: { ...m.meta, status: 'error' as const } }
              : m
          ));
          throw error;
        }

        // Update intent memory AFTER successful execution
        setLastIntentType('CREATE');
        setLastTransformSourceId(null);

        return { success: true };
      }

    } catch (error) {
      console.error('[dispatchExecution] Execution failed:', error);
      setChatInput(savedInput); // Restore input on error
      return { success: false, reason: 'EXECUTION_ERROR', error };
    }
  }, [
    messages,
    selectedTemplateId,
    selectedTone,
    lastIntentType,
    lastTransformSourceId,
    activeSourceId, // ✅ Added: UI-selected source takes priority
    getLastValidAssistantMessage,
  ]);

  /**
   * Execute CREATE action with pre-authorized token
   * Called ONLY by dispatchExecution after gate approval
   *
   * @param authToken - Authorization token from gate
   * @param effectiveTemplateId - Resolved template ID
   * @param userInput - The EXACT user input text (passed explicitly, NOT from closure)
   * @param existingUserMsgId - Optional: ID of already-appended optimistic user message (skip creation if provided)
   * @param existingRequestId - Optional: Request ID from optimistic message (for linking)
   * @param bindingMeta - STEP 18: Request binding metadata for single source of truth
   */
  const executeCreateWithToken = useCallback(async (
    authToken: ReturnType<typeof createAuthorizationToken>,
    effectiveTemplateId: string,
    userInput: string,
    existingUserMsgId?: string,
    existingRequestId?: string,
    bindingMeta?: { uiInputHash?: string; uiInputLength?: number; uiSendAt?: number; eventId?: string }
  ) => {
    if (!authToken) throw new Error('No auth token');

    // Derive workflowStep inline (since it's computed from messages/approvedMessageId)
    const currentWorkflowStep = deriveWorkflowStep({ messages, approvedMessageId });

    // Use existing request ID if provided (from optimistic message), else generate new
    const requestId = existingRequestId || generateRequestId();
    // CRITICAL: Use the passed userInput, NOT chatInput from closure!
    // This fixes the bug where chatInput could be stale/empty due to closure capture.
    const userMessageContent = userInput;

    // Snapshot template metadata
    let templateSnapshot: { templateName?: string; templateVersion?: string } = {};
    if (effectiveTemplateId) {
      try {
        const loadedTemplate = getNewTemplateById(effectiveTemplateId);
        templateSnapshot = {
          templateName: loadedTemplate.template.name,
          templateVersion: loadedTemplate.template.ui?.engineVersion || 'unknown',
        };
      } catch (error) {
        console.warn('Failed to snapshot template metadata:', error);
      }
    }

    // ✅ OPTIMISTIC RENDERING: Skip user message creation if already appended
    if (!existingUserMsgId) {
      // Legacy path: Create user message here (for direct calls without optimistic rendering)
      // NOTE: This path should rarely run since dispatchExecution always creates optimistic messages
      console.warn('[executeCreateWithToken] Legacy path triggered - no existingUserMsgId');
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessageContent,
        timestamp: new Date(),
        meta: {
          toneId: selectedTone?.id,
          templateId: effectiveTemplateId ?? undefined,
          useCaseId: selectedUseCase?.id,
          workflowStep: currentWorkflowStep,
          requestId,
          // ✅ MANDATORY: userTypedText for display (STEP 2 hardening)
          userTypedText: userMessageContent,
        },
      };

      setMessages((prev) => [...prev, userMessage]);
      setChatInput('');
    }
    // User message already appended by dispatchExecution, just set loading state
    setAiError(null);
    setAiLoading(true);

    try {
      // Build system prompt
      let manifestSystemPrompt: string | undefined;
      if (effectiveTemplateId) {
        try {
          const manifest = resolveTemplateManifest(effectiveTemplateId);
          if (manifest) {
            manifestSystemPrompt = buildSystemPrompt(manifest, {
              toneReinforcement: selectedTone?.systemReinforcement,
              workflowGuidance: currentWorkflowStep ? `Current workflow step: ${currentWorkflowStep}` : undefined,
            });
          }
        } catch (error) {
          console.error('[executeCreateWithToken] Error resolving manifest:', error);
        }
      }

      // Build request
      const aiRequest: StudioAIRequest = buildStudioAIRequest({
        userPrompt: userMessageContent,
        templateSystemMessage: manifestSystemPrompt,
        toneReinforcement: manifestSystemPrompt ? undefined : selectedTone?.systemReinforcement,
        meta: {
          useCaseId: selectedUseCase?.id,
          templateId: effectiveTemplateId ?? undefined,
          toneId: selectedTone?.id,
          workflowStep: currentWorkflowStep,
          mode: 'execute',
        },
      });

      // Execute through LLM executor
      // ✅ STEP 18: Include userPrompt explicitly + binding metadata
      // ✅ CRITICAL: Include full conversation history for context
      // Build messages array with: system + all previous user/assistant messages + current user prompt
      const llmMessages: LLMRequest['messages'] = [
        { role: 'system', content: aiRequest.systemMessage },
      ];

      // Add all previous messages (excluding the current user message we're about to send)
      for (const msg of messages) {
        // Skip system messages (we already added our own)
        // Include all user and assistant messages for conversation history
        if (msg.role === 'user' || msg.role === 'assistant') {
          llmMessages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }

      // Add current user prompt as the final message
      llmMessages.push({
        role: 'user',
        content: aiRequest.userPrompt,
      });

      const llmRequest: LLMRequest = {
        messages: llmMessages,
        userPrompt: aiRequest.userPrompt, // ✅ STEP 18: Explicit userPrompt (source of truth)
        meta: {
          ...(aiRequest.meta as Record<string, unknown>),
          // ✅ STEP 18: Request binding for validation
          ...(bindingMeta?.uiInputHash && {
            eventId: bindingMeta.eventId,
            uiInputHash: bindingMeta.uiInputHash,
            uiInputLength: bindingMeta.uiInputLength,
            uiSendAt: bindingMeta.uiSendAt,
          }),
        },
      };

      const executionResult = await executeLLM(authToken, llmRequest);

      if (!executionResult.success || !executionResult.response) {
        throw new Error(executionResult.error || 'Failed to generate AI response');
      }

      const aiResponse = executionResult.response;

      // Quality Lock evaluation
      let qualityLockMeta: QualityLockMeta | undefined;
      let resolvedIntent: string | undefined;
      const testMode = /TEST SETTINGS/i.test(userMessageContent) || /TEST_MODE/i.test(userMessageContent);

      if (isValidIntentId(effectiveTemplateId)) {
        resolvedIntent = effectiveTemplateId;
        const messageId = `assistant-${Date.now()}`;

        trackQLEvaluationRequested({
          draft_id: messageId,
          message_id: messageId,
          intent_id: resolvedIntent,
          ui_surface: 'studio',
          editor_state: DraftState.D0_ACTIVE,
          assist_mode: AssistMode.A0_ASSIST_NORMAL,
          test_mode: testMode,
        });

        const evalStartTime = Date.now();
        try {
          const qualityResult = runQualityLock({
            intent: effectiveTemplateId as IntentId,
            output: aiResponse.content,
            meta: { templateId: effectiveTemplateId, language: 'vi', testMode },
          });

          const decision = qualityResult.hardFails.length > 0
            ? 'FAIL' as const
            : qualityResult.softFails.length > 0
            ? 'DRAFT' as const
            : 'PASS' as const;

          const feedback = transformToFeedback(qualityResult);

          qualityLockMeta = {
            decision,
            softFails: qualityResult.softFails,
            hardFails: qualityResult.hardFails,
            autoFixAttempts: 0,
            feedback: {
              status: feedback.status,
              score: feedback.score,
              band: feedback.band,
              summary: feedback.summary,
              canApprove: feedback.canApprove,
              issues: feedback.issues,
            },
          };

          trackQLEvaluationCompleted({
            draft_id: messageId,
            message_id: messageId,
            intent_id: resolvedIntent,
            ui_surface: 'studio',
            editor_state: DraftState.D0_ACTIVE,
            assist_mode: AssistMode.A0_ASSIST_NORMAL,
            test_mode: testMode,
            decision,
            hard_fail_count: qualityResult.hardFails.length,
            soft_fail_count: qualityResult.softFails.length,
            content_length: aiResponse.content.length,
            failed_rule_ids: [
              ...qualityResult.hardFails.map(r => r.id),
              ...qualityResult.softFails.map(r => r.id),
            ],
            duration_ms: Date.now() - evalStartTime,
          });
        } catch (error) {
          console.warn('[executeCreateWithToken] Quality Lock evaluation failed:', error);
        }
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: aiResponse.content,
        timestamp: new Date(),
        meta: {
          toneId: selectedTone?.id,
          templateId: effectiveTemplateId ?? undefined,
          useCaseId: selectedUseCase?.id,
          workflowStep: currentWorkflowStep,
          requestId,
          templateName: templateSnapshot.templateName,
          templateVersion: templateSnapshot.templateVersion,
          intent: resolvedIntent,
          testMode: testMode || undefined,
          qualityLock: qualityLockMeta,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setAiLoading(false);

      // ✅ STEP 5 (UX): Record 'generate' action for workflow pattern inference
      recordSessionAction('generate');

    } catch (error: unknown) {
      console.error('[executeCreateWithToken] Failed:', error);
      setAiError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setAiLoading(false);
      throw error;
    }
  }, [selectedTone, selectedUseCase, messages, approvedMessageId]); // Note: chatInput removed - now passed as parameter

  /**
   * Execute TRANSFORM action with pre-authorized token
   * Called ONLY by dispatchExecution after gate approval
   *
   * @param existingUserMsgId - Optional: ID of already-appended optimistic user message (skip creation if provided)
   * @param existingRequestId - Optional: Request ID from optimistic message (for linking)
   * @param bindingMeta - STEP 18: Request binding metadata for single source of truth
   */
  const executeTransformWithToken = useCallback(async (
    authToken: ReturnType<typeof createAuthorizationToken>,
    action: ActionType,
    sourceMessageId: string | undefined,
    transformMode: TransformMode,
    userInstruction: string | undefined,
    existingUserMsgId?: string,
    existingRequestId?: string,
    bindingMeta?: { uiInputHash?: string; uiInputLength?: number; uiSendAt?: number; eventId?: string }
  ) => {
    if (!authToken) throw new Error('No auth token');

    // Auto-select source if not provided
    let effectiveSourceId = sourceMessageId;
    if (!effectiveSourceId) {
      const lastValid = getLastValidAssistantMessage();
      if (!lastValid) {
        setAiError('Không có nội dung để chỉnh sửa. Hãy tạo nội dung trước.');
        throw new Error('No valid source available');
      }
      effectiveSourceId = lastValid.id;
    }

    const sourceContent = getMessageContent(effectiveSourceId, messages);
    if (!sourceContent?.trim()) {
      setAiError('Nội dung nguồn trống. Vui lòng chọn một tin nhắn khác.');
      throw new Error('Source content is empty');
    }

    // ✅ SAFETY CHECK: Compute content hash for tracing
    // This helps debug context-binding issues
    const sourceContentHash = sourceContent.substring(0, 50).replace(/\s+/g, ' ');
    console.log('[executeTransformWithToken] Source binding check:', {
      effectiveSourceId,
      sourceContentHash,
      contentLength: sourceContent.length,
    });

    // ✅ SAFETY ASSERTION: Verify source message exists and matches
    const sourceMessage = messages.find(m => m.id === effectiveSourceId);
    if (!sourceMessage) {
      console.error('[executeTransformWithToken] CRITICAL: Source message not found:', effectiveSourceId);
      setAiError('Lỗi hệ thống: Không tìm thấy tin nhắn nguồn.');
      throw new Error('Transform source mismatch: message not found');
    }

    if (sourceMessage.content !== sourceContent) {
      console.error('[executeTransformWithToken] CRITICAL: Content mismatch detected:', {
        messageContent: sourceMessage.content?.substring(0, 50),
        resolvedContent: sourceContent.substring(0, 50),
      });
      // Don't abort - this could be due to apply/diff changes, just warn
      console.warn('[executeTransformWithToken] Content may have been modified');
    }

    setActiveSourceId(effectiveSourceId);
    setTransformLoading(effectiveSourceId);

    try {
      const actionLabel = getActionLabel(action);
      let instruction = transformMode === 'DIRECTED_TRANSFORM' && userInstruction
        ? userInstruction
        : `${actionLabel} nội dung này.`;

      // Resolve template
      const sourceMessage = messages.find(m => m.id === effectiveSourceId);
      const templateId = sourceMessage?.meta?.templateId || selectedTemplateId;
      let templateSystemPrompt: string | undefined;

      if (templateId) {
        try {
          const manifest = resolveTemplateManifest(templateId);
          if (manifest) {
            templateSystemPrompt = buildSystemPrompt(manifest, {
              toneReinforcement: selectedTone?.systemReinforcement,
            });
          }
        } catch { /* Use default */ }
      }

      // Extract locked context
      const lockedContext = extractLockedContext(sourceContent, effectiveSourceId);
      const useValidation = shouldValidate(action);

      // Output contract
      const outputContract: TransformOutputContract = userInstruction
        ? extractOutputContract(userInstruction, sourceContent)
        : { requiredMinWords: null, requiredMaxWords: null, requiredStructure: [], requiredTone: null, derivedFrom: '', isStrict: false };

      // Build constrained prompt
      const basePrompt = templateSystemPrompt || 'Bạn là trợ lý viết nội dung chuyên nghiệp. Hãy hoàn thành yêu cầu của người dùng.';
      let constrainedPrompt = transformMode === 'DIRECTED_TRANSFORM'
        ? (useValidation ? injectConstraints(basePrompt, lockedContext, 'RELAXED') : basePrompt)
        : (useValidation ? injectConstraints(basePrompt, lockedContext, 'NORMAL') : basePrompt);

      const contractInstruction = buildContractInstruction(outputContract);
      if (contractInstruction) {
        constrainedPrompt += '\n\n' + contractInstruction;
      }

      // Retry logic
      const maxAttempts = outputContract.isStrict ? 2 : 3;
      let attemptCount = 0;
      let success = false;
      let lastContractValidation: ContractValidationResult | null = null;
      let lastExecutionError: string | null = null; // Track last error for surfacing
      let lastReasonCode: string | null = null; // Track reasonCode for user-facing messages

      while (attemptCount < maxAttempts && !success) {
        attemptCount++;
        const isRetry = attemptCount > 1;

        let modeInstruction = instruction;
        if (isRetry && lastContractValidation && !lastContractValidation.passed) {
          const enforcement = buildEnforcementInstruction(lastContractValidation.violations);
          modeInstruction = enforcement + '\n\n' + instruction;
        } else if (isRetry) {
          modeInstruction += '\n\n⚠️ QUAN TRỌNG: Phải giữ nguyên tất cả số liệu, tên riêng, và thông tin quan trọng.';
        }

        try {
          // ✅ STEP 18: Build transform request with binding metadata
          // ✅ CRITICAL: Include full conversation history for context
          // Compute finalUserPrompt = instruction + sourceReference (exact string sent to LLM)
          const finalUserPrompt = modeInstruction + buildSourceReference(sourceContent);

          const transformMessages: LLMRequest['messages'] = [
            { role: 'system', content: constrainedPrompt },
          ];

          // Add all previous messages for context
          for (const msg of messages) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              transformMessages.push({
                role: msg.role,
                content: msg.content,
              });
            }
          }

          // Add current transform instruction as final user message
          transformMessages.push({
            role: 'user',
            content: finalUserPrompt,
          });

          // ✅ CRITICAL FIX: Trim userPrompt to match executor normalization
          // The executor trims userPrompt before validation (llmExecutor.ts:281)
          // Hash and length MUST be computed from the SAME trimmed string
          const trimmedUserPrompt = finalUserPrompt.trim();

          const transformRequest: LLMRequest = {
            messages: transformMessages,
            userPrompt: trimmedUserPrompt, // ✅ STEP 18: Explicit userPrompt (trimmed for consistency)
            meta: {
              templateId,
              mode: 'execute',
              // ✅ STEP 18: uiFinalPromptHash computed from TRIMMED prompt
              // Guarantees hash/length/meta match the actual validated userPrompt
              eventId: bindingMeta?.eventId,
              uiFinalPromptHash: safeHash(trimmedUserPrompt),
              uiFinalPromptLength: trimmedUserPrompt.length,
              uiSendAt: bindingMeta?.uiSendAt,
            },
            // ✅ STEP 21: Inject edit patch metadata if set
            editPatch: pendingEditPatchMeta || undefined,
            // ✅ STEP 22: Inject output contract if set
            outputContract: pendingOutputContract || undefined,
            // ✅ STEP 22: Answer Engine context
            // Enables QA vs EDIT_PATCH vs CREATE mode detection
            answerEngineContext: {
              hasActiveDraft: messages.some(m => m.role === 'assistant' && m.content.length > 100),
              hasPreviousMessages: messages.length > 0,
              lang: 'vi',
            },
          };

          const executionResult = await executeLLM(authToken, transformRequest);

          if (!executionResult.success || !executionResult.response) {
            // Capture error for surfacing
            lastExecutionError = executionResult.error || 'Unknown execution error';
            lastReasonCode = executionResult.debugInfo?.reasonCode || null;
            console.error('[executeTransformWithToken] LLM execution failed:', {
              attempt: attemptCount,
              error: executionResult.error,
              reasonCode: executionResult.debugInfo?.reasonCode,
              eventId: executionResult.debugInfo?.eventId,
            });
            continue;
          }

          const output = executionResult.response.content;

          if (isRefusal(output)) {
            continue;
          }

          // Contract validation
          if (outputContract.isStrict) {
            const contractValidation = validateOutputContract(output, outputContract);
            lastContractValidation = contractValidation;
            if (!contractValidation.passed) {
              continue;
            }
          }

          // Success!
          success = true;
          // Use existing request ID if provided (from optimistic message), else generate new
          const requestId = existingRequestId || generateRequestId();
          const originMessageId = sourceMessage?.meta?.originMessageId || effectiveSourceId;
          const transformDepth = (sourceMessage?.meta?.transformDepth || 0) + 1;

          // ✅ Diff & Apply: Extract sections for apply functionality
          const beforeSectionsExec = extractSections(sourceContent);
          const afterSectionsExec = extractSections(output);

          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: output,
            timestamp: new Date(),
            meta: {
              requestId,
              templateId: templateId ?? undefined,
              actionType: action,
              // ✅ CRITICAL: Explicit source binding for tracing
              sourceMessageId: effectiveSourceId,
              sourceContentHash, // For debugging context-binding issues
              lockedContext: useValidation ? lockedContext : undefined,
              originMessageId,
              transformDepth,
              // ✅ Diff & Apply: Store before/after for section-level apply
              diffApply: {
                applyTargetMessageId: effectiveSourceId,
                beforeText: sourceContent,
                afterText: output,
                beforeSections: {
                  hook: beforeSectionsExec.hook ?? undefined,
                  body: beforeSectionsExec.body ?? undefined,
                  cta: beforeSectionsExec.cta ?? undefined,
                  hashtags: beforeSectionsExec.hashtags ?? undefined,
                },
                afterSections: {
                  hook: afterSectionsExec.hook ?? undefined,
                  body: afterSectionsExec.body ?? undefined,
                  cta: afterSectionsExec.cta ?? undefined,
                  hashtags: afterSectionsExec.hashtags ?? undefined,
                },
                applyState: 'idle',
              },
            },
          };

          // ✅ OPTIMISTIC RENDERING: Only append assistant message
          // User message was already appended by dispatchExecution
          setMessages(prev => [...prev, assistantMsg]);

          // ✅ STEP 5 (UX): Record 'generate' action for workflow pattern inference
          recordSessionAction('generate');
          break;

        } catch (error) {
          console.error(`[executeTransformWithToken] Attempt ${attemptCount} failed:`, error);
        }
      }

      // Handle failure
      if (!success) {
        if (outputContract.isStrict && lastContractValidation && !lastContractValidation.passed) {
          const violation = lastContractValidation.violations[0];
          const errorMsg = violation
            ? `Không thể tạo nội dung đúng yêu cầu (${violation.expected}, thực tế: ${violation.actual}).`
            : 'Không thể tạo nội dung đúng yêu cầu.';
          setAiError(errorMsg);
          throw new Error('Contract validation failed');
        }

        if (action === 'TRANSLATE' || transformMode === 'DIRECTED_TRANSFORM') {
          // Surface user-facing error based on reasonCode
          const errorMsg = getUserFacingAiError({
            lang: 'vi',
            reasonCode: lastReasonCode,
            fallback: 'Không thể thực hiện yêu cầu. Vui lòng thử lại.',
          });
          setAiError(errorMsg);
          throw new Error(lastExecutionError || 'Transform requires AI');
        }

        // Fallback - only runs for PURE_TRANSFORM (DIRECTED_TRANSFORM throws at line 1896)
        const fallbackOutput = applyFallbackTransform(action, sourceContent);
        if (!isRefusal(fallbackOutput)) {
          // Use existing request ID if provided (from optimistic message), else generate new
          const requestId = existingRequestId || generateRequestId();
          const originMessageId = sourceMessage?.meta?.originMessageId || effectiveSourceId;
          const transformDepth = (sourceMessage?.meta?.transformDepth || 0) + 1;

          // ✅ Diff & Apply: Extract sections for fallback apply functionality
          const beforeSecExecFb = extractSections(sourceContent);
          const afterSecExecFb = extractSections(fallbackOutput);

          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: fallbackOutput,
            timestamp: new Date(),
            meta: {
              requestId,
              templateId: templateId ?? undefined,
              actionType: action,
              sourceMessageId: effectiveSourceId,
              isFallback: true,
              originMessageId,
              transformDepth,
              // ✅ Diff & Apply: Store before/after for section-level apply
              diffApply: {
                applyTargetMessageId: effectiveSourceId,
                beforeText: sourceContent,
                afterText: fallbackOutput,
                beforeSections: {
                  hook: beforeSecExecFb.hook ?? undefined,
                  body: beforeSecExecFb.body ?? undefined,
                  cta: beforeSecExecFb.cta ?? undefined,
                  hashtags: beforeSecExecFb.hashtags ?? undefined,
                },
                afterSections: {
                  hook: afterSecExecFb.hook ?? undefined,
                  body: afterSecExecFb.body ?? undefined,
                  cta: afterSecExecFb.cta ?? undefined,
                  hashtags: afterSecExecFb.hashtags ?? undefined,
                },
                applyState: 'idle',
              },
            },
          };

          // ✅ OPTIMISTIC RENDERING: Only append assistant message
          // User message was already appended by dispatchExecution
          setMessages(prev => [...prev, assistantMsg]);

          // ✅ STEP 5 (UX): Record 'generate' action for workflow pattern inference
          recordSessionAction('generate');
        } else {
          setAiError(`${actionLabel} thất bại. Vui lòng thử lại.`);
          throw new Error('Fallback produced refusal');
        }
      }

    } finally {
      setTransformLoading(null);
    }
  }, [messages, selectedTemplateId, selectedTone, getLastValidAssistantMessage]);

  // ============================================
  // handleSend - THIN DISPATCHER ONLY
  // ============================================
  // This function ONLY creates the execution event and dispatches.
  // NO intent detection, NO routing, NO state mutation here.
  // ============================================
  const handleSend = async () => {
    if (!chatInput.trim()) return;

    // ✅ STEP 18: Capture the EXACT input text at SEND time
    // This is the SINGLE SOURCE OF TRUTH for what the user intended to send
    const finalUserPrompt = chatInput.trim();

    // Create execution event
    const eventId = generateEventId();
    const timestamp = Date.now();

    // ✅ STEP 18: Create request binding for single source of truth
    // This hash validates that userPrompt wasn't modified between UI and API
    const uiInputHash = safeHash(finalUserPrompt);
    const uiInputLength = finalUserPrompt.length;

    // ✅ STEP 6: Capture UI binding at SEND time
    // If user has selected a message (activeSourceId), that becomes the BINDING source
    // This is the user's explicit intent: "transform THIS message with my instruction"
    const uiBindingSource = activeSourceId;

    console.log('[handleSend] Dispatching execution event:', {
      eventId,
      timestamp,
      uiSourceMessageId: uiBindingSource, // ✅ STEP 6: Log UI binding
      uiInputHash, // ✅ STEP 18: Log input hash
      uiInputLength, // ✅ STEP 18: Log input length
    });

    // Dispatch to execution pipeline (gate check happens INSIDE)
    await dispatchExecution({
      userActionType: 'send',
      inputText: finalUserPrompt, // ✅ STEP 18: Use captured text (not chatInput)
      eventId,
      timestamp,
      uiSourceMessageId: uiBindingSource, // ✅ STEP 6: Pass UI BINDING
      // ✅ STEP 18: Request binding metadata
      uiInputHash,
      uiInputLength,
      uiSendAt: timestamp,
    });
  };

  // ============================================
  // Retry Last Action - Error Recovery
  // ============================================
  // Re-executes handleSend with current state.
  // INVARIANTS:
  // - Does NOT reset editor content
  // - Does NOT create new drafts
  // - Does NOT affect Primary logic
  // - Uses existing execution path (handleSend)
  // - Only clears error state before retry
  // ============================================
  const retryLastAction = () => {
    // Clear error before retry attempt
    setAiError(null);
    // Re-execute with same input (restored on error)
    handleSend();
  };

  // Reset studio to initial state
  const resetStudio = () => {
    setSelectedUseCase(null);
    setChatInput('');
    setSelectedTemplateIdState(null);
    setMessages([]);
    setAiError(null);
    // ✅ Clear intent memory on reset
    setLastIntentType(null);
    setLastTransformSourceId(null);
    // Clear messages from localStorage
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('studio_chat_messages_v1');
        localStorage.removeItem('studio_intent_memory_v1');
      }
    } catch (error) {
      console.error('Failed to clear messages from storage:', error);
    }
  };

  // Open template browser
  const openTemplateBrowser = () => {
    setTemplateBrowserOpen(true);
  };

  // Apply a template (OLD system - for prompt templates)
  const applyTemplate = (template: PromptTemplate) => {
    // Note: This is for the OLD template browser system
    // Use localized prompt based on current UI language
    const localizedPrompt = getLocalizedPrompt(template, language);
    setChatInput(localizedPrompt);
    setTemplateBrowserOpen(false);
  };

  // ✅ Derive workflow step from current state (system-driven, no manual control)
  const workflowStep = deriveWorkflowStep({ messages, approvedMessageId });

  // ============================================
  // Diff & Apply: Apply transform results to source content
  // ============================================
  // Client-side only - NO LLM calls, NO database writes
  // Updates message content and tracks apply state
  // ============================================

  /**
   * Apply transform result to the source message content
   * @param messageId - The assistant message ID containing the transform result
   * @param mode - Which section(s) to apply: 'all' | 'hook' | 'body' | 'cta' | 'hashtags'
   */
  const applyTransformResult = useCallback((messageId: string, mode: ApplyMode) => {
    setMessages((prevMessages) => {
      // Find the transform result message
      const transformMsg = prevMessages.find((m) => m.id === messageId);
      if (!transformMsg || transformMsg.role !== 'assistant' || !transformMsg.meta?.diffApply) {
        console.warn('[applyTransformResult] Invalid message or missing diffApply:', messageId);
        return prevMessages;
      }

      const { diffApply } = transformMsg.meta;
      const targetId = diffApply.applyTargetMessageId;

      // Find the target message to update
      const targetMsgIndex = prevMessages.findIndex((m) => m.id === targetId);
      if (targetMsgIndex === -1) {
        console.warn('[applyTransformResult] Target message not found:', targetId);
        return prevMessages;
      }

      // Apply the section(s)
      const result = applySection(diffApply.beforeText, diffApply.afterText, mode);
      if (!result.success) {
        console.warn('[applyTransformResult] Apply failed:', result.errors);
        return prevMessages;
      }

      // Update both messages atomically
      const newMessages = [...prevMessages];

      // Update target message content
      const targetMsg = newMessages[targetMsgIndex];
      newMessages[targetMsgIndex] = {
        ...targetMsg,
        content: result.content,
      };

      // Update transform message diffApply state
      const transformMsgIndex = newMessages.findIndex((m) => m.id === messageId);
      newMessages[transformMsgIndex] = {
        ...newMessages[transformMsgIndex],
        meta: {
          ...newMessages[transformMsgIndex].meta,
          diffApply: {
            ...diffApply,
            applyState: 'applied',
            appliedAt: Date.now(),
            appliedMode: mode,
          },
        },
      };

      return newMessages;
    });
  }, []);

  /**
   * Undo a previously applied transform result
   * Restores the source message to its original content (beforeText)
   * @param messageId - The assistant message ID containing the transform result
   */
  const undoApplyTransformResult = useCallback((messageId: string) => {
    setMessages((prevMessages) => {
      // Find the transform result message
      const transformMsg = prevMessages.find((m) => m.id === messageId);
      if (!transformMsg || transformMsg.role !== 'assistant' || !transformMsg.meta?.diffApply) {
        console.warn('[undoApplyTransformResult] Invalid message or missing diffApply:', messageId);
        return prevMessages;
      }

      const { diffApply } = transformMsg.meta;
      if (diffApply.applyState !== 'applied') {
        console.warn('[undoApplyTransformResult] Nothing to undo - not in applied state');
        return prevMessages;
      }

      const targetId = diffApply.applyTargetMessageId;

      // Find the target message to restore
      const targetMsgIndex = prevMessages.findIndex((m) => m.id === targetId);
      if (targetMsgIndex === -1) {
        console.warn('[undoApplyTransformResult] Target message not found:', targetId);
        return prevMessages;
      }

      // Update both messages atomically
      const newMessages = [...prevMessages];

      // Restore target message content to original
      const targetMsg = newMessages[targetMsgIndex];
      newMessages[targetMsgIndex] = {
        ...targetMsg,
        content: diffApply.beforeText,
      };

      // Update transform message diffApply state to reverted
      const transformMsgIndex = newMessages.findIndex((m) => m.id === messageId);
      newMessages[transformMsgIndex] = {
        ...newMessages[transformMsgIndex],
        meta: {
          ...newMessages[transformMsgIndex].meta,
          diffApply: {
            ...diffApply,
            applyState: 'reverted',
            appliedAt: undefined,
            appliedMode: undefined,
          },
        },
      };

      return newMessages;
    });
  }, []);

  // ============================================
  // STEP 6.6: Update Message Content In-Place
  // ============================================
  // NO LLM call - direct local content update
  // Used by EDIT_IN_PLACE pathway for deterministic transforms
  const updateMessageContent = useCallback((messageId: string, newContent: string) => {
    if (!messageId || !newContent) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[updateMessageContent] Missing messageId or newContent');
      }
      return;
    }

    setMessages((prevMessages) => {
      const messageIndex = prevMessages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[updateMessageContent] Message not found:', messageId);
        }
        return prevMessages;
      }

      const message = prevMessages[messageIndex];

      // Only allow updating assistant messages
      if (message.role !== 'assistant') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[updateMessageContent] Cannot update non-assistant message');
        }
        return prevMessages;
      }

      // Store previous content for undo
      const previousContent = message.content;

      if (process.env.NODE_ENV === 'development') {
        console.log('[updateMessageContent] Updating message:', {
          messageId,
          previousLength: previousContent.length,
          newLength: newContent.length,
        });
      }

      const newMessages = [...prevMessages];
      newMessages[messageIndex] = {
        ...message,
        content: newContent,
        meta: {
          ...message.meta,
          // Track local edit for undo
          localEdit: {
            previousContent,
            appliedAt: Date.now(),
          },
        },
      };

      return newMessages;
    });
  }, []);

  const value: StudioContextType = {
    useCases: STUDIO_USE_CASES,
    selectedUseCase,
    setSelectedUseCase,
    workflowStep, // Now derived, not manually set
    // setWorkflowStep removed - workflow is system-driven
    showWelcomeAnimation,
    celebrationTrigger,
    triggerCelebration,
    chatInput,
    setChatInput,
    messages,
    clearMessages,
    approvedMessageId,
    setApprovedMessage,
    clearApprovedMessage,
    isTemplateBrowserOpen,
    setTemplateBrowserOpen,
    selectedTemplateId,
    handleTemplateSelect, // NEW: Handler for Content Machine Engine templates
    templateSearch,
    setTemplateSearch,
    selectedTemplateCategoryId,
    setSelectedTemplateCategoryId,
    selectedTone,
    handleToneSelect,
    aiLoading,
    aiError,
    setAiError, // ✅ STEP 22: Expose for REWRITE_UPGRADE context guard error display
    retryLastAction, // ✅ Error recovery: re-execute with same input/state
    templateGateToast, // ✅ PHASE 3: Template gate feedback
    handleUseCaseSelect,
    handleSend,
    resetStudio,
    openTemplateBrowser,
    applyTemplate,
    // sendToAI REMOVED - All execution goes through handleSend → dispatchExecution
    // ✅ Quality Lock Auto Fix
    autoFixMessage,
    autoFixLoading,

    // ✅ Auto Fix Preview Modal (Diff Preview UX)
    autoFixPreview,
    applyAutoFix,
    cancelAutoFix,

    // ✅ Auto Fix Toast (with undo support)
    autoFixToast,
    undoAutoFix,
    dismissAutoFixToast,

    // ✅ Orchestrator: Transform actions
    activeSourceId,
    setActiveSource,
    handleTransformAction,
    transformLoading,

    // ✅ Diff & Apply: Apply transform results to source content
    applyTransformResult,
    undoApplyTransformResult,

    // ✅ STEP 6.6: Local Edit (NO LLM call)
    updateMessageContent,

    // ✅ STEP 21: Edit Patch Meta setter
    setEditPatchMeta: setPendingEditPatchMeta,

    // ✅ STEP 22: Output Contract setter
    setOutputContract: setPendingOutputContract,

    // ============================================
    // FEATURE A: Primary Selection + Commit to Posts
    // ============================================
    primaryMessageId,
    setPrimaryMessage,
    clearPrimaryMessage,
    createPostFromPrimary,
    commitLoading,

    // ============================================
    // FEATURE B: Studio Session Persistence
    // ============================================
    sessionId,
    studioToast,
    dismissStudioToast,
    showStudioToast,
    saveSessionSnapshot,
    saveSession,
    saveSessionLoading,
    getRecentSnapshots,
    restoreSnapshot,

    // ============================================
    // AI Library: Persistent saved sessions
    // ============================================
    aiLibraryEntries,
    restoreFromAILibrary,
  };

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
};
