// ============================================
// LLM Executor - Single Authorized Call Site
// ============================================
// This is the ONLY place in the codebase that calls the LLM API.
// All other code MUST go through this module.
//
// INVARIANT: Every call requires a valid AuthorizationToken from executionGate.
//
// SCHEMA NORMALIZATION:
// Server expects StudioAIRequest: { systemMessage, userPrompt, meta }
// Client builds LLMRequest: { messages, userPrompt?, meta }
// This module normalizes LLMRequest → StudioAIRequest at the single call site.
//
// STEP 18: Single Source of Truth Request Binding
// - userPrompt MUST come from explicit field (input box at SEND time)
// - Fallback to last user message ONLY if meta.fallbackAllowed === true
// - Request binding validated via uiInputHash
// ============================================

import type { AuthorizationToken } from './executionGate';
import { validateToken } from './executionGate';
import type { StudioAIRequest, ConversationMessage } from '@/lib/studio/aiTypes';
import {
  type EditorialOp,
  formatEditorialOpConstraints,
} from '@/lib/studio/editorialOpPrompt';
import {
  type EditorialIntentCanon,
  formatIntentCanonForPrompt,
} from '@/lib/studio/editorialIntentCanon';
import {
  type EditScopeContract,
  formatEditScopeForPrompt,
} from '@/lib/studio/editScopeContract';
import {
  type EditPatchMeta,
  formatEditPatchPrompt,
  formatPatchOnlySystemBlock,
} from '@/lib/studio/editPatchExecutor';
import {
  type AnswerTaskType,
  type AnswerTarget,
  type TaskDetectionContext,
  detectTaskType,
  detectEditTarget,
  formatAnswerEngineContract,
} from '@/lib/studio/answerEngine';
import { safeHash, validateBinding } from '@/lib/studio/safeHash';
// ✅ STEP 24: Failure classification for observability (DEV-only, no runtime impact)
import { formatFailureClassification } from '@/lib/studio/failureTaxonomy';
// ✅ STEP 26: Validation telemetry for shadow validation
import { logValidationSummary } from '@/lib/studio/validationTelemetry';
import type { OutputContract, PatchOnlyContract } from '@/types/studio';

// ============================================
// Types
// ============================================

/**
 * Message format for LLM requests
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * STEP 18: Request binding metadata for single source of truth
 */
export interface RequestBindingMeta {
  /** Unique event ID created at SEND time */
  eventId: string;
  /** Timestamp when Send was clicked */
  uiSendAt: number;
  /** Hash of userPrompt at send time (for validation) - used for CREATE flow */
  uiInputHash: string;
  /** Length of userPrompt (quick validation) - used for CREATE flow */
  uiInputLength: number;
  /** If true, allows fallback to last user message (legacy support) */
  fallbackAllowed?: boolean;
  /** Hash of FINAL enriched userPrompt (for TRANSFORM flow with source reference) */
  uiFinalPromptHash?: string;
  /** Length of FINAL enriched userPrompt (for TRANSFORM flow) */
  uiFinalPromptLength?: number;
}

/**
 * Request configuration for LLM execution
 */
export interface LLMRequest {
  /** Messages to send to LLM */
  messages: LLMMessage[];

  /** Optional metadata for the request (accepts any structure) */
  meta?: Record<string, unknown> & Partial<RequestBindingMeta>;

  /** Optional: User prompt (used for some request types) */
  userPrompt?: string;

  /** Optional: System prompt override */
  templateSystemMessage?: string;

  /** Optional: Tone reinforcement */
  toneReinforcement?: string;

  /**
   * STEP 16: Editorial operation constraints
   * When present, editorial constraints are injected into the system prompt.
   * This guides the LLM on how much it can modify the content.
   */
  editorialOp?: EditorialOp;

  /**
   * STEP 17: Editorial intent canon
   * When present, intent preservation constraints are injected into the system prompt.
   * This guides the LLM on what meaning/intent must be preserved.
   */
  intentCanon?: EditorialIntentCanon;

  /**
   * STEP 19: Edit scope contract
   * When present, edit scope constraints are injected into the system prompt.
   * This guides the LLM on which section to edit and which to lock.
   */
  editScope?: EditScopeContract;

  /**
   * STEP 21: Edit patch metadata
   * When present, patch-mode constraints are injected into the system prompt.
   * This allows partial edits (BODY-only, CTA-only, etc.) without requiring
   * full Hook/Body/CTA structure.
   */
  editPatch?: EditPatchMeta;

  /**
   * STEP 22: Output contract
   * When present with mode='PATCH_ONLY', strict patch format is enforced.
   * The LLM must return only [PATCH] blocks, not full article rewrites.
   */
  outputContract?: OutputContract;

  /**
   * STEP 22: Answer Engine context
   * When present, Answer Engine determines QA vs EDIT_PATCH vs CREATE mode
   * and injects the appropriate contract into the system prompt.
   */
  answerEngineContext?: {
    /** Whether there's an active draft */
    hasActiveDraft: boolean;
    /** Whether there are previous messages */
    hasPreviousMessages: boolean;
    /** Language */
    lang: 'vi' | 'en';
  };
}

// ============================================
// STEP 18: Normalization Result Types (Discriminated Union)
// ============================================

/** Reason codes for normalization failures */
export type NormalizeReasonCode =
  | 'EMPTY_USER_PROMPT'
  | 'MISSING_SYSTEM'
  | 'INVALID_META'
  | 'BINDING_MISMATCH'
  | 'REWRITE_NO_CONTEXT'
  | 'UNKNOWN';

/**
 * STEP 22 Context Guard: Error messages for REWRITE_UPGRADE without context
 */
export const REWRITE_NO_CONTEXT_ERROR = {
  vi: 'Bạn muốn viết lại bài nào? Hãy chọn bài trước.',
  en: 'Which post do you want to rewrite? Please select a draft first.',
} as const;

/** Successful normalization result */
export interface NormalizeOk {
  ok: true;
  normalized: StudioAIRequest;
  /** STEP 22: Answer Engine detected task type (QA/EDIT_PATCH/REWRITE_UPGRADE/CREATE) */
  answerEngineTaskType?: AnswerTaskType | null;
}

/** Failed normalization result */
export interface NormalizeErr {
  ok: false;
  error: string;
  reasonCode: NormalizeReasonCode;
}

/** Discriminated union for normalization results */
export type NormalizeResult = NormalizeOk | NormalizeErr;

/**
 * Response from LLM execution
 */
export interface LLMResponse {
  success: boolean;
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

/**
 * Execution result with debug info
 */
export interface ExecutionResult {
  success: boolean;
  response?: LLMResponse;
  error?: string;
  /** STEP 22: Answer Engine detected task type for UI display */
  answerEngineTaskType?: AnswerTaskType | null;
  debugInfo: {
    eventId: string;
    requestTime: number;
    responseTime: number;
    duration: number;
    tokenValid: boolean;
    apiCalled: boolean;
    reasonCode?: NormalizeReasonCode; // Added for diagnostic surfacing
  };
}

// ============================================
// Configuration
// ============================================

/** API endpoint for LLM calls */
const LLM_API_ENDPOINT = '/api/studio/ai';

/** Request timeout (ms) */
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds

// ============================================
// Internal State
// ============================================

/** Track in-flight requests to prevent concurrent calls with same eventId */
const inFlightRequests = new Set<string>();

// ============================================
// Schema Normalization
// ============================================

/**
 * Normalize LLMRequest → StudioAIRequest
 *
 * This is the SINGLE SOURCE OF TRUTH for request normalization.
 * Server expects: { systemMessage, userPrompt, meta }
 * Client sends:   { messages, userPrompt?, meta }
 *
 * STEP 18 NORMALIZATION RULES:
 * 1. userPrompt: Use explicit field ONLY (source of truth = input box at SEND time)
 * 2. Fallback to last user message ONLY if meta.fallbackAllowed === true
 * 3. systemMessage: Use templateSystemMessage, OR extract from 'system' message
 * 4. If userPrompt is empty after normalization → return error with EMPTY_USER_PROMPT
 * 5. Validate binding if uiInputHash is present
 * 6. STEP 16: If editorialOp present, append constraints to systemMessage
 * 7. STEP 17: If intentCanon present, append constraints to systemMessage
 *
 * @param request - LLMRequest from client
 * @returns Discriminated union: NormalizeOk | NormalizeErr
 */
export function normalizeToStudioRequest(request: LLMRequest): NormalizeResult {
  const meta = request.meta;

  // ============================================
  // STEP 18: Extract userPrompt with strict source of truth
  // ============================================
  let userPrompt = '';
  let usedFallback = false;

  if (request.userPrompt && typeof request.userPrompt === 'string') {
    // Primary source: explicit userPrompt field (input box at SEND time)
    userPrompt = request.userPrompt.trim();
  } else if (meta?.fallbackAllowed === true) {
    // Legacy fallback: only if explicitly allowed
    const userMessage = [...request.messages].reverse().find(m => m.role === 'user');
    if (userMessage && userMessage.content) {
      userPrompt = userMessage.content.trim();
      usedFallback = true;
    }
  }
  // If no explicit userPrompt and fallback not allowed, userPrompt stays empty

  // ============================================
  // STEP 18: Validate userPrompt is not empty
  // ============================================
  if (!userPrompt) {
    return {
      ok: false,
      error: 'Vui lòng nhập nội dung trước khi gửi. / Please enter content before sending.',
      reasonCode: 'EMPTY_USER_PROMPT',
    };
  }

  // ============================================
  // STEP 18: Validate binding if hash is present
  // ============================================
  // Priority: uiFinalPromptHash (for enriched TRANSFORM prompts) > uiInputHash (for raw CREATE prompts)
  const hashToValidate = meta?.uiFinalPromptHash || meta?.uiInputHash;
  const lengthToValidate = meta?.uiFinalPromptLength ?? meta?.uiInputLength;

  if (hashToValidate && lengthToValidate !== undefined && !usedFallback) {
    const bindingValid = validateBinding(userPrompt, {
      uiInputHash: hashToValidate,
      uiInputLength: lengthToValidate,
    });

    if (!bindingValid) {
      console.error('[LLMExecutor] BLOCKED: Binding mismatch', {
        expectedHash: hashToValidate,
        actualHash: safeHash(userPrompt),
        expectedLength: lengthToValidate,
        actualLength: userPrompt.length,
        hashSource: meta?.uiFinalPromptHash ? 'uiFinalPromptHash' : 'uiInputHash',
      });
      return {
        ok: false,
        error: 'Request binding mismatch. Content may have been modified after Send.',
        reasonCode: 'BINDING_MISMATCH',
      };
    }
  }

  // ============================================
  // Extract systemMessage
  // ============================================
  let systemMessage = '';

  if (request.templateSystemMessage && typeof request.templateSystemMessage === 'string') {
    systemMessage = request.templateSystemMessage.trim();
  } else {
    // Extract from messages array (first system message)
    const sysMessage = request.messages.find(m => m.role === 'system');
    if (sysMessage && sysMessage.content) {
      systemMessage = sysMessage.content.trim();
    }
  }

  // If no system message, use a default
  if (!systemMessage) {
    systemMessage = 'You are a helpful content creation assistant.';
  }

  // ============================================
  // STEP 16: Inject editorial constraints
  // ============================================
  let editorialConstraintsInjected = false;
  if (request.editorialOp) {
    const constraintBlock = formatEditorialOpConstraints(request.editorialOp);
    if (constraintBlock) {
      systemMessage = `${systemMessage}\n\n${constraintBlock}`;
      editorialConstraintsInjected = true;
    }
  }

  // ============================================
  // STEP 17: Inject intent canon constraints
  // ============================================
  let intentCanonInjected = false;
  if (request.intentCanon) {
    const intentBlock = formatIntentCanonForPrompt(
      request.intentCanon,
      request.intentCanon.meta.language
    );
    if (intentBlock) {
      systemMessage = `${systemMessage}\n\n${intentBlock}`;
      intentCanonInjected = true;
    }
  }

  // ============================================
  // STEP 19: Inject edit scope constraints
  // ============================================
  // Order: editorial op -> intent canon -> edit scope -> edit patch
  // Edit scope is injected before edit patch
  let editScopeInjected = false;
  if (request.editScope) {
    // Determine language from intent canon or default to 'vi'
    const scopeLang = request.intentCanon?.meta.language || 'vi';
    const scopeBlock = formatEditScopeForPrompt(request.editScope, scopeLang);
    if (scopeBlock) {
      systemMessage = `${systemMessage}\n\n${scopeBlock}`;
      editScopeInjected = true;
    }
  }

  // ============================================
  // STEP 21: Inject edit patch constraints
  // ============================================
  // Edit patch is injected LAST - this is the critical instruction
  // that tells the LLM to ONLY modify the target section.
  // This enables partial edits (BODY-only, CTA-only, etc.)
  let editPatchInjected = false;
  if (request.editPatch) {
    const patchLang = request.intentCanon?.meta.language || 'vi';
    const patchBlock = formatEditPatchPrompt(request.editPatch, patchLang);
    if (patchBlock) {
      systemMessage = `${systemMessage}\n\n${patchBlock}`;
      editPatchInjected = true;
    }
  }

  // ============================================
  // STEP 22: Inject patch-only output contract
  // ============================================
  // When outputContract.mode === 'PATCH_ONLY', inject strict format instructions.
  // This is the FINAL constraint - enforces [PATCH] block format.
  let outputContractInjected = false;
  if (request.outputContract?.mode === 'PATCH_ONLY') {
    const contractLang = request.intentCanon?.meta.language || 'vi';
    const contractBlock = formatPatchOnlySystemBlock(
      request.outputContract as PatchOnlyContract,
      contractLang
    );
    if (contractBlock) {
      systemMessage = `${systemMessage}\n\n${contractBlock}`;
      outputContractInjected = true;
    }
  }

  // ============================================
  // STEP 22: Answer Engine Contract Injection
  // ============================================
  // Determines QA vs EDIT_PATCH vs CREATE mode and injects appropriate contract.
  // This is injected LAST to provide final behavioral guidance.
  let answerEngineTaskType: AnswerTaskType | null = null;
  let answerEngineTarget: AnswerTarget = 'UNKNOWN';
  let answerEngineInjected = false;

  if (request.answerEngineContext && userPrompt) {
    const ctx: TaskDetectionContext = {
      hasActiveDraft: request.answerEngineContext.hasActiveDraft,
      hasPreviousMessages: request.answerEngineContext.hasPreviousMessages,
      lang: request.answerEngineContext.lang,
      editPatchTarget: request.editPatch?.target,
      editScopeTarget: request.editScope?.target,
    };

    // Detect task type
    const taskDetection = detectTaskType(userPrompt, ctx);
    answerEngineTaskType = taskDetection.taskType;

    // ============================================
    // STEP 22: Context Guard for REWRITE_UPGRADE
    // ============================================
    // REWRITE_UPGRADE requires an active draft/source to rewrite.
    // If there's no context (no active draft, no previous messages), block the request.
    // This prevents the LLM from being called without proper context.
    if (answerEngineTaskType === 'REWRITE_UPGRADE') {
      const hasContext = ctx.hasActiveDraft || ctx.hasPreviousMessages;
      if (!hasContext) {
        console.warn('[LLMExecutor] BLOCKED: REWRITE_UPGRADE without context', {
          hasActiveDraft: ctx.hasActiveDraft,
          hasPreviousMessages: ctx.hasPreviousMessages,
          userPrompt: userPrompt.substring(0, 50),
        });
        return {
          ok: false,
          error: REWRITE_NO_CONTEXT_ERROR[ctx.lang],
          reasonCode: 'REWRITE_NO_CONTEXT',
        };
      }
    }

    // Detect target for EDIT_PATCH mode
    if (answerEngineTaskType === 'EDIT_PATCH') {
      const targetDetection = detectEditTarget(userPrompt, ctx.lang);
      answerEngineTarget = targetDetection.target;

      // Use Step 21 editPatch target if available and Answer Engine is UNKNOWN
      if (answerEngineTarget === 'UNKNOWN' && request.editPatch?.target) {
        answerEngineTarget = request.editPatch.target as AnswerTarget;
      }

      // Default to BODY if still unknown
      if (answerEngineTarget === 'UNKNOWN') {
        answerEngineTarget = 'BODY';
      }
    }

    // Inject Answer Engine contract
    const answerContract = formatAnswerEngineContract(
      answerEngineTaskType,
      answerEngineTarget,
      ctx.lang
    );
    if (answerContract) {
      systemMessage = `${systemMessage}\n\n${answerContract}`;
      answerEngineInjected = true;
    }
  }

  // ============================================
  // Extract conversation history (user + assistant messages only)
  // ============================================
  // Exclude system messages and the current user prompt (which will be separate)
  // Order: chronological (oldest first)
  const conversationHistory: ConversationMessage[] = [];
  for (const msg of request.messages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      conversationHistory.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Remove the last user message if it matches userPrompt (avoid duplication)
  // The userPrompt will be added separately in callOpenAI/callAnthropic
  if (conversationHistory.length > 0) {
    const lastMsg = conversationHistory[conversationHistory.length - 1];
    if (lastMsg.role === 'user' && lastMsg.content.trim() === userPrompt) {
      conversationHistory.pop();
    }
  }

  // Build normalized StudioAIRequest
  const normalized: StudioAIRequest = {
    systemMessage,
    userPrompt,
    meta: request.meta as StudioAIRequest['meta'],
    conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
  };

  // DEV: Log normalization for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('[LLMExecutor] Normalized request:', {
      userPromptLength: userPrompt.length,
      userPromptPreview: userPrompt.substring(0, 50) + (userPrompt.length > 50 ? '...' : ''),
      systemMessageLength: systemMessage.length,
      hasExplicitUserPrompt: !!request.userPrompt,
      usedFallback,
      messageCount: request.messages.length,
      // STEP 18: Binding info
      hasBinding: !!(meta?.uiInputHash),
      bindingEventId: meta?.eventId || null,
      // STEP 16: Log editorial op injection
      editorialOp: request.editorialOp?.op || null,
      editorialOpScope: request.editorialOp?.scope || null,
      editorialConstraintsInjected,
      // STEP 17: Log intent canon injection
      intentCanonTone: request.intentCanon?.toneLabel || null,
      intentCanonAnchors: request.intentCanon?.anchors.length || 0,
      intentCanonInjected,
      // STEP 19: Log edit scope injection
      editScopeTarget: request.editScope?.target || null,
      editScopeLocked: request.editScope?.lockedSections || [],
      editScopeInjected,
      // STEP 21: Log edit patch injection
      editPatchTarget: request.editPatch?.target || null,
      editPatchMode: request.editPatch?.mode || null,
      editPatchPreserve: request.editPatch?.preserveSections || [],
      editPatchInjected,
      // STEP 22: Log output contract injection
      outputContractMode: request.outputContract?.mode || null,
      outputContractTargets: request.outputContract?.mode === 'PATCH_ONLY'
        ? (request.outputContract as PatchOnlyContract).targets
        : [],
      outputContractInjected,
      // STEP 22: Log Answer Engine injection
      answerEngineTaskType,
      answerEngineTarget,
      answerEngineInjected,
      answerEngineContext: request.answerEngineContext ? {
        hasActiveDraft: request.answerEngineContext.hasActiveDraft,
        hasPreviousMessages: request.answerEngineContext.hasPreviousMessages,
        lang: request.answerEngineContext.lang,
      } : null,
      // Conversation history stats
      conversationHistoryLength: conversationHistory.length,
      hasConversationHistory: conversationHistory.length > 0,
    });
  }

  return { ok: true, normalized, answerEngineTaskType };
}

// ============================================
// Main Executor Function
// ============================================

/**
 * Execute LLM request with authorization token
 *
 * INVARIANTS ENFORCED:
 * 1. Token MUST be valid (from executionGate.canExecute)
 * 2. Token MUST NOT be expired
 * 3. No duplicate in-flight requests with same eventId
 *
 * @param token - Authorization token from canExecute()
 * @param request - LLM request configuration
 * @returns Execution result with response or error
 */
export async function executeLLM(
  token: AuthorizationToken,
  request: LLMRequest
): Promise<ExecutionResult> {
  const requestTime = Date.now();

  // ============================================
  // INVARIANT: Token validation
  // ============================================
  if (!validateToken(token)) {
    console.error('[LLMExecutor] BLOCKED: Invalid or expired token', {
      eventId: token?.eventId,
      type: token?.type,
    });
    return {
      success: false,
      error: 'Invalid or expired authorization token',
      debugInfo: {
        eventId: token?.eventId || 'unknown',
        requestTime,
        responseTime: Date.now(),
        duration: Date.now() - requestTime,
        tokenValid: false,
        apiCalled: false,
      },
    };
  }

  const eventId = token.eventId;

  // ============================================
  // INVARIANT: Prevent concurrent duplicate requests
  // ============================================
  if (inFlightRequests.has(eventId)) {
    console.warn('[LLMExecutor] BLOCKED: Request already in flight', { eventId });
    return {
      success: false,
      error: 'Request with this eventId is already in progress',
      debugInfo: {
        eventId,
        requestTime,
        responseTime: Date.now(),
        duration: Date.now() - requestTime,
        tokenValid: true,
        apiCalled: false,
      },
    };
  }

  // Mark request as in-flight
  inFlightRequests.add(eventId);

  // ============================================
  // SCHEMA NORMALIZATION: LLMRequest → StudioAIRequest
  // ============================================
  // Server expects: { systemMessage, userPrompt, meta }
  // We normalize here at the SINGLE CALL SITE to ensure consistency.
  // STEP 18: Uses strict discriminated union for type safety.
  const normalization = normalizeToStudioRequest(request);

  // ============================================
  // DEV-ONLY: Normalization result diagnostic
  // ============================================
  const bindingMeta = request.meta ? {
    hasUiInputHash: !!request.meta.uiInputHash,
    hasUiFinalPromptHash: !!request.meta.uiFinalPromptHash,
    uiInputLength: request.meta.uiInputLength,
    uiFinalPromptLength: request.meta.uiFinalPromptLength,
  } : null;

  if (!normalization.ok) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[LLMExecutor] Decision:', {
        ok: false,
        answerEngineTaskType: null,
        errorCode: normalization.reasonCode,
        reasonCode: normalization.reasonCode,
        messagesCount: request.messages?.length,
        hasConversationHistory: false,
        bindingMeta,
      });
      // ✅ STEP 24: Failure classification for debugging
      console.error('[FAILURE_CLASS]', formatFailureClassification(normalization.reasonCode));
    }

    // ✅ STEP 26: Emit validation telemetry for normalization failure
    logValidationSummary({
      taskType: null,
      hasActiveDraft: request.answerEngineContext?.hasActiveDraft ?? false,
      hasPreviousMessages: request.answerEngineContext?.hasPreviousMessages ?? false,
      messagesCountSentToLLM: request.messages?.length ?? 0,
      provider: null,
      ok: false,
      reasonCode: normalization.reasonCode,
      retryCountUsed: 0,
      latencyMs: Date.now() - requestTime,
    });

    inFlightRequests.delete(eventId);
    return {
      success: false,
      error: normalization.error,
      debugInfo: {
        eventId,
        requestTime,
        responseTime: Date.now(),
        duration: Date.now() - requestTime,
        tokenValid: true,
        apiCalled: false,
        reasonCode: normalization.reasonCode,
      },
    };
  }

  const normalizedRequest = normalization.normalized;
  const detectedTaskType = normalization.answerEngineTaskType;

  // ============================================
  // DEV-ONLY: Normalization success diagnostic
  // ============================================
  if (process.env.NODE_ENV === 'development') {
    console.log('[LLMExecutor] Decision:', {
      ok: true,
      answerEngineTaskType: detectedTaskType,
      errorCode: null,
      reasonCode: null,
      messagesCount: request.messages?.length,
      hasConversationHistory: (normalizedRequest.conversationHistory?.length || 0) > 0,
      bindingMeta,
    });
  }

  console.log('[LLMExecutor] Executing authorized request:', {
    eventId,
    userActionType: token.userActionType,
    userPromptLength: normalizedRequest.userPrompt.length,
  });

  try {
    // ============================================
    // Execute API call
    // ============================================
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(LLM_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include event ID in header for server-side tracing
        'X-Event-Id': eventId,
      },
      body: JSON.stringify(normalizedRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    const responseTime = Date.now();

    if (!response.ok || !data.success) {
      const errorMessage = data.error || `API error: ${response.status}`;
      console.error('[LLMExecutor] API error:', { eventId, error: errorMessage });

      // ✅ STEP 26: Emit validation telemetry for API error
      logValidationSummary({
        taskType: detectedTaskType ?? null,
        hasActiveDraft: request.answerEngineContext?.hasActiveDraft ?? false,
        hasPreviousMessages: request.answerEngineContext?.hasPreviousMessages ?? false,
        messagesCountSentToLLM: request.messages?.length ?? 0,
        provider: 'openai',
        ok: false,
        reasonCode: data.reasonCode || null,
        retryCountUsed: 0,
        latencyMs: responseTime - requestTime,
      });

      return {
        success: false,
        error: errorMessage,
        debugInfo: {
          eventId,
          requestTime,
          responseTime,
          duration: responseTime - requestTime,
          tokenValid: true,
          apiCalled: true,
        },
      };
    }

    // Success!
    console.log('[LLMExecutor] Request successful:', {
      eventId,
      duration: responseTime - requestTime,
      contentLength: data.data?.content?.length || 0,
      answerEngineTaskType: detectedTaskType,
    });

    // ✅ STEP 26: Emit validation telemetry for success
    logValidationSummary({
      taskType: detectedTaskType ?? null,
      hasActiveDraft: request.answerEngineContext?.hasActiveDraft ?? false,
      hasPreviousMessages: request.answerEngineContext?.hasPreviousMessages ?? false,
      messagesCountSentToLLM: request.messages?.length ?? 0,
      provider: 'openai',
      ok: true,
      reasonCode: null,
      retryCountUsed: 0,
      latencyMs: responseTime - requestTime,
    });

    return {
      success: true,
      response: {
        success: true,
        content: data.data.content,
        usage: data.data.usage,
      },
      answerEngineTaskType: detectedTaskType,
      debugInfo: {
        eventId,
        requestTime,
        responseTime,
        duration: responseTime - requestTime,
        tokenValid: true,
        apiCalled: true,
      },
    };

  } catch (error) {
    const responseTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[LLMExecutor] Request timeout:', { eventId });

      // ✅ STEP 26: Emit validation telemetry for timeout
      logValidationSummary({
        taskType: detectedTaskType ?? null,
        hasActiveDraft: request.answerEngineContext?.hasActiveDraft ?? false,
        hasPreviousMessages: request.answerEngineContext?.hasPreviousMessages ?? false,
        messagesCountSentToLLM: request.messages?.length ?? 0,
        provider: 'openai',
        ok: false,
        reasonCode: 'TIMEOUT',
        retryCountUsed: 0,
        latencyMs: responseTime - requestTime,
      });

      return {
        success: false,
        error: 'Request timed out',
        debugInfo: {
          eventId,
          requestTime,
          responseTime,
          duration: responseTime - requestTime,
          tokenValid: true,
          apiCalled: true,
        },
      };
    }

    console.error('[LLMExecutor] Request failed:', { eventId, error: errorMessage });

    // ✅ STEP 26: Emit validation telemetry for other errors
    logValidationSummary({
      taskType: detectedTaskType ?? null,
      hasActiveDraft: request.answerEngineContext?.hasActiveDraft ?? false,
      hasPreviousMessages: request.answerEngineContext?.hasPreviousMessages ?? false,
      messagesCountSentToLLM: request.messages?.length ?? 0,
      provider: 'openai',
      ok: false,
      reasonCode: 'NETWORK_ERROR',
      retryCountUsed: 0,
      latencyMs: responseTime - requestTime,
    });

    return {
      success: false,
      error: errorMessage,
      debugInfo: {
        eventId,
        requestTime,
        responseTime,
        duration: responseTime - requestTime,
        tokenValid: true,
        apiCalled: true,
      },
    };

  } finally {
    // Remove from in-flight set
    inFlightRequests.delete(eventId);
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build a standard LLM request from common inputs
 * Convenience function for typical use cases
 */
export function buildLLMRequest(options: {
  systemPrompt: string;
  userMessage: string;
  meta?: LLMRequest['meta'];
}): LLMRequest {
  return {
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userMessage },
    ],
    meta: options.meta,
  };
}

/**
 * Build a transform request with source content
 */
export function buildTransformRequest(options: {
  systemPrompt: string;
  instruction: string;
  sourceContent: string;
  meta?: LLMRequest['meta'];
}): LLMRequest {
  return {
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: `${options.instruction}\n\n---\nNỘI DUNG GỐC:\n${options.sourceContent}` },
    ],
    meta: options.meta,
  };
}

// ============================================
// Debug/Testing Functions
// ============================================

/**
 * Get count of in-flight requests (for debugging)
 */
export function __getInFlightCount(): number {
  return inFlightRequests.size;
}

/**
 * Clear in-flight requests (for testing only)
 */
export function __clearInFlightRequests(): void {
  inFlightRequests.clear();
}
