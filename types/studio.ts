// ============================================
// Studio Types & Interfaces
// ============================================

export type UseCaseCategory = 'strategy' | 'tour' | 'content';

export interface UseCase {
  id: string;
  title: string;
  description: string;
  icon: string; // Emoji or icon identifier
  prompt?: string; // Optional template prompt to auto-fill
  placeholder?: string; // Optional placeholder hint (does not auto-fill)
  color: 'blue' | 'purple' | 'green' | 'orange';
  category: UseCaseCategory;
}

export interface LParticle {
  id: string;
  x: number; // Start X position (0-100%)
  delay: number; // Animation delay (0-1000ms)
  size: number; // Font size (16-48px)
  duration: number; // Fall duration (2000-4000ms)
  opacity: number; // Start opacity (0.6-1)
  rotation: number; // Rotation angle (-15 to 15 degrees)
}

// ============================================
// Prompt Template System
// ============================================

export interface TemplateCategory {
  id: string; // 'seo', 'content-strategy', 'content-creation', 'tour'
  name: string;
  description?: string;
  icon?: string; // string key for now
}

export type TemplateComplexity = 'basic' | 'advanced';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  categoryId: string; // 'seo' | 'content-strategy' | ...
  useCaseId?: string; // link to existing useCase ids (e.g. 'strategic-content', 'tour-discovery')
  tags?: string[];
  complexity?: TemplateComplexity;
  language: 'vi' | 'en' | 'both';

  // AI prompt definition:
  systemMessage: string;
  userTemplate: string; // contains placeholders like {{topic}}, {{audience}}, {{toneHints}}

  // i18n localization (NEW - optional for backward compatibility)
  promptKey?: string; // i18n dictionary key for localized userTemplate (e.g., 'studio.prompts.socialPostGenerator.userTemplate')
}

/**
 * Quality Lock decision status
 */
export type QualityDecision = 'PASS' | 'DRAFT' | 'FAIL';

/**
 * User-facing quality feedback (derived from QualityLockResult)
 */
export interface QualityFeedbackMeta {
  status: 'PASS' | 'WARNING' | 'FAIL';
  score: number;                  // 0-100
  band: 'strong' | 'acceptable' | 'needs_improvement';
  summary: string;                // One-line summary for UI header
  canApprove: boolean;            // Whether "Đặt làm bản cuối" is allowed
  issues: Array<{
    id: string;
    severity: 'critical' | 'minor';
    title: string;
    suggestion: string;
  }>;
}

/**
 * Quality Lock result attached to AI messages
 */
export interface QualityLockMeta {
  decision: QualityDecision;
  softFails?: Array<{
    id: string;
    passed: boolean;
    severity: 'HARD' | 'SOFT';
    message: string;
    details?: unknown;
  }>;
  hardFails?: Array<{
    id: string;
    passed: boolean;
    severity: 'HARD' | 'SOFT';
    message: string;
    details?: unknown;
  }>;
  autoFixAttempts?: number;
  testMode?: boolean;
  /** Previous decision before Auto Fix was applied (for outcome visibility) */
  previousDecision?: QualityDecision;
  /** User-facing quality feedback */
  feedback?: QualityFeedbackMeta;
}

// ============================================
// STEP 3: Intent Snapshot (Observability Layer)
// ============================================
// READ-ONLY record of user intent at SEND time.
// Used for debugging and regression detection ONLY.
// NEVER affects execution logic.
// NEVER sent to LLM.
// ============================================

/**
 * Detected intent mode at send time
 */
export type IntentMode = 'CREATE' | 'PURE_TRANSFORM' | 'DIRECTED_TRANSFORM';

/**
 * IntentSnapshot - Immutable record of user intent
 *
 * Created ONCE at dispatchExecution, attached to user message and
 * propagated to derived assistant messages for traceability.
 *
 * INVARIANTS:
 * 1. Snapshot is created exactly once per user turn
 * 2. Snapshot is immutable after creation
 * 3. Snapshot is NEVER used for execution decisions
 * 4. Snapshot survives across chained transforms
 */
export interface IntentSnapshot {
  /** Exact user input at send time (MUST equal userTypedText) */
  readonly userTypedText: string;

  /** Detected transform mode at classification time */
  readonly detectedMode: IntentMode;

  /** Normalized internal action types detected */
  readonly detectedActions: readonly string[];

  /** Source message ID for transforms (null for CREATE) */
  readonly sourceMessageId: string | null;

  /** Turn index in the conversation (0-indexed) */
  readonly turnIndex: number;

  /** Unix timestamp when snapshot was created */
  readonly createdAt: number;

  /** Unique snapshot ID for traceability */
  readonly snapshotId: string;

  /** Origin snapshot ID for chained transforms (points to first snapshot in chain) */
  readonly originSnapshotId: string | null;

  // ✅ STEP 7: Intent Confidence (observability only, NEVER affects execution)
  /** Confidence score for the detected route (0-1) */
  readonly intentConfidence?: number;

  /** Human-readable reason for the confidence score (DEV only) */
  readonly confidenceReason?: string;
}

// ============================================
// STEP 4: Intent Summary (UX Display Layer)
// ============================================
// Derived FROM IntentSnapshot for user-facing display.
// Pure presentation - NEVER affects execution.
// Shows user the system understood their intent.
// ============================================

/**
 * IntentSummary - User-facing representation of detected intent
 *
 * INVARIANTS:
 * 1. Derived ONLY from IntentSnapshot (no reprocessing)
 * 2. Deterministic and stable (same snapshot = same summary)
 * 3. NEVER used for execution decisions
 * 4. Pure presentation layer
 */
export interface IntentSummary {
  /** Primary action detected (e.g., "Viết lại", "Rút gọn", "Mở rộng") */
  readonly primaryAction: string;

  /** Modifiers/qualifiers (e.g., ["Giọng chuyên nghiệp", "Dài hơn"]) */
  readonly modifiers: readonly string[];

  /** Additional directives (e.g., ["Thêm hotline", "Giữ CTA"]) */
  readonly extras: readonly string[];

  /** Display mode for UI styling */
  readonly displayMode: IntentMode;

  /** Whether this summary is complete (all fields derived successfully) */
  readonly isComplete: boolean;
}

/**
 * Create an IntentSnapshot (factory function)
 * This is the ONLY way to create a snapshot - ensures immutability
 */
export function createIntentSnapshot(params: {
  userTypedText: string;
  detectedMode: IntentMode;
  detectedActions: string[];
  sourceMessageId: string | null;
  turnIndex: number;
  originSnapshotId?: string | null;
  // ✅ STEP 7: Intent Confidence (observability only)
  intentConfidence?: number;
  confidenceReason?: string;
}): IntentSnapshot {
  const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return Object.freeze({
    userTypedText: params.userTypedText,
    detectedMode: params.detectedMode,
    detectedActions: Object.freeze([...params.detectedActions]),
    sourceMessageId: params.sourceMessageId,
    turnIndex: params.turnIndex,
    createdAt: Date.now(),
    snapshotId,
    originSnapshotId: params.originSnapshotId ?? null,
    // ✅ STEP 7: Include confidence if provided
    intentConfidence: params.intentConfidence,
    confidenceReason: params.confidenceReason,
  });
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  meta?: {
    toneId?: string;
    templateId?: string;
    useCaseId?: string;
    workflowStep?: string;
    // ✅ PHASE 2: Attribution snapshot (frozen at send-time)
    requestId?: string;         // Unique ID linking user+assistant pairs
    templateName?: string;       // Snapshot of template name at send time
    templateVersion?: string;    // Snapshot of template version at send time
    // ✅ Quality Lock: Resolved intent for evaluation
    intent?: string;            // Golden Intent ID used for Quality Lock (e.g., 'social_caption_v1')
    // ✅ Quality Lock: Test mode (relaxes certain soft rules)
    testMode?: boolean;         // True if prompt contained "TEST SETTINGS" or "TEST_MODE"
    // ✅ Quality Lock result
    qualityLock?: QualityLockMeta;
    // ✅ Optimistic Rendering: Message status for instant UX
    status?: 'pending' | 'done' | 'error';  // pending = waiting for AI, done = complete, error = failed
    // ✅ Conversation Orchestrator: Transform tracking
    sourceMessageId?: string;   // ID of source message for transforms
    sourceContentHash?: string; // First 50 chars of source content (for debugging context-binding)
    actionType?: import('@/types/orchestrator').ActionType;  // Classified action type
    lockedContext?: import('@/types/orchestrator').LockedContext;  // Locked context used for this message
    isFallback?: boolean;       // True if this is a rule-based fallback (AI unavailable)
    // ✅ Transform chain tracking (B4)
    originMessageId?: string;   // ID of the FIRST message in a transform chain (stays constant)
    transformDepth?: number;    // How many transforms deep (1 = first transform, 2 = second, etc.)
    // ✅ User message display (INVARIANT: userTypedText === displayed text)
    // CONCEPTUAL REFACTOR: USER MESSAGE ≠ ACTION
    // - userTypedText: ALWAYS what the user expressed (typed OR clicked button)
    // - actionLabel: Internal only (for badges/chips, NEVER for message display)
    // - transformMode: Internal routing only (does NOT affect display)
    userTypedText?: string;     // MANDATORY for user messages: exact text user expressed
    transformMode?: 'PURE_TRANSFORM' | 'DIRECTED_TRANSFORM';  // Internal routing, NOT display
    actionLabel?: string;       // Internal: action type label (NEVER display as message content)
    // ✅ STEP 3: Intent Snapshot (read-only observability layer)
    // Captures user intent at SEND time for debugging and future regression detection
    // NEVER used for execution - purely for visibility
    intentSnapshot?: IntentSnapshot;
    // ✅ Diff & Apply: Transform result metadata (assistant messages only)
    diffApply?: {
      applyTargetMessageId: string;  // ID of message to update when applying
      beforeText: string;            // Snapshot of target content before transform
      afterText: string;             // AI result (same as message.content)
      beforeSections?: {             // Parsed sections from beforeText
        hook?: string;
        body?: string;
        cta?: string;
        hashtags?: string;
      };
      afterSections?: {              // Parsed sections from afterText
        hook?: string;
        body?: string;
        cta?: string;
        hashtags?: string;
      };
      applyState: 'idle' | 'applied' | 'reverted';
      appliedAt?: number;            // Timestamp when applied
      appliedMode?: 'all' | 'hook' | 'body' | 'cta' | 'hashtags';
    };
    // ✅ STEP 6.6: Local Edit tracking for undo support
    localEdit?: {
      previousContent: string;       // Content before local edit (for undo)
      appliedAt: number;             // Timestamp when local edit was applied
    };
  };
}

/**
 * Auto Fix Preview data for Diff Preview Modal
 */
export interface AutoFixPreviewData {
  messageId: string;
  originalContent: string;
  refinedContent: string;
  similarity: {
    score: number;
    passed: boolean;
    assessment: 'minimal' | 'moderate' | 'excessive';
    details: {
      charSimilarity: number;
      tokenOverlap: number;
      lengthRatio: number;
    };
  };
  attempts: number;
  usedFallback: boolean;
}

/**
 * Auto Fix toast state for undo support
 */
export interface AutoFixToast {
  show: boolean;
  message: string;
  type: 'success' | 'info';
  canUndo?: boolean;
  undoData?: {
    messageId: string;
    originalContent: string;
  };
}

// ============================================
// FEATURE A: Primary Selection + Commit to Posts
// ============================================

/**
 * Studio session metadata for persistence
 */
export interface StudioSessionMeta {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  promptInput: string;
  toneId?: string;
  templateId?: string;
  language?: 'vi' | 'en';
}

/**
 * Studio session snapshot for restore
 */
export interface StudioSessionSnapshot {
  id: string;
  name: string;
  createdAt: number;
  messages: ChatMessage[];
  primaryMessageId: string | null;
  meta: StudioSessionMeta;
}

/**
 * Toast notification state
 */
export interface StudioToast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  duration?: number;
}

export interface StudioContextType {
  // UI State
  useCases: UseCase[];
  selectedUseCase: UseCase | null;
  setSelectedUseCase: (useCase: UseCase | null) => void;

  // Workflow State (system-driven, derived from editor state)
  workflowStep: import('@/lib/studio/workflow').WorkflowStep;
  // setWorkflowStep removed - workflow is now system-driven, not manually controllable

  // Animation State
  showWelcomeAnimation: boolean;
  celebrationTrigger: number;
  triggerCelebration: () => void;

  // Chat State
  chatInput: string;
  setChatInput: (value: string) => void;
  messages: ChatMessage[];
  clearMessages: () => void;

  // Approval State
  approvedMessageId: string | null;
  setApprovedMessage: (messageId: string) => void;
  clearApprovedMessage: () => void;

  // Template Browser State (OLD system - for prompt templates)
  isTemplateBrowserOpen: boolean;
  setTemplateBrowserOpen: (open: boolean) => void;
  templateSearch: string;
  setTemplateSearch: (q: string) => void;
  selectedTemplateCategoryId: string;
  setSelectedTemplateCategoryId: (id: string) => void;

  // Content Machine Engine Template State (NEW system)
  selectedTemplateId: string | null;
  handleTemplateSelect: (templateId: string | null) => void;

  // Tone Engine State
  selectedTone: import('@/lib/studio/tones').BrandTone | null;
  handleToneSelect: (tone: import('@/lib/studio/tones').BrandTone) => void;

  // AI Result State
  aiLoading: boolean;
  aiError: string | null;
  setAiError: (error: string | null) => void; // ✅ STEP 22: Expose for REWRITE_UPGRADE context guard
  retryLastAction: () => void; // ✅ Error recovery: re-execute with same input/state

  // ✅ PHASE 3: Template Gate Feedback
  templateGateToast: { show: boolean; message: string } | null;

  // Actions
  handleUseCaseSelect: (useCase: UseCase) => void;
  handleSend: () => void;
  resetStudio: () => void;
  openTemplateBrowser: () => void;
  applyTemplate: (template: PromptTemplate) => void;
  // sendToAI REMOVED - All execution goes through handleSend → dispatchExecution (invariant-safe)

  // ✅ Quality Lock Auto Fix
  autoFixMessage: (messageId: string) => Promise<void>;
  autoFixLoading: string | null; // messageId being auto-fixed, or null

  // ✅ Auto Fix Preview Modal (Diff Preview UX)
  autoFixPreview: AutoFixPreviewData | null;
  applyAutoFix: () => void;
  cancelAutoFix: () => void;

  // ✅ Auto Fix Toast (with undo support)
  autoFixToast: AutoFixToast | null;
  undoAutoFix: () => void;
  dismissAutoFixToast: () => void;

  // ✅ Orchestrator: Transform actions
  activeSourceId: string | null;
  setActiveSource: (sourceId: string | null) => void;
  handleTransformAction: (action: import('@/types/orchestrator').ActionType, sourceMessageId?: string) => Promise<void>;
  transformLoading: string | null;

  // ✅ Diff & Apply: Apply transform results to source content
  applyTransformResult: (messageId: string, mode: 'all' | 'hook' | 'body' | 'cta' | 'hashtags') => void;
  undoApplyTransformResult: (messageId: string) => void;

  // ✅ STEP 6.6: Local Edit - Update message content in-place (NO LLM call)
  updateMessageContent: (messageId: string, newContent: string) => void;

  // ✅ STEP 21: Edit Patch Meta - Set before handleSend for partial edit support
  setEditPatchMeta: (meta: import('@/lib/studio/editPatchExecutor').EditPatchMeta | null) => void;

  // ✅ STEP 22: Output Contract - Set before handleSend for patch-only enforcement
  setOutputContract: (contract: OutputContract | null) => void;

  // ============================================
  // FEATURE A: Primary Selection + Commit to Posts
  // ============================================

  /** ID of the message marked as Primary (best output) */
  primaryMessageId: string | null;
  /** Set a message as Primary */
  setPrimaryMessage: (messageId: string) => void;
  /** Clear Primary selection */
  clearPrimaryMessage: () => void;
  /** Create a draft post from Primary message */
  createPostFromPrimary: () => Promise<{ success: boolean; postId?: string; error?: string }>;
  /** Loading state for commit action */
  commitLoading: boolean;

  // ============================================
  // FEATURE B: Studio Session Persistence
  // ============================================

  /** Current session ID */
  sessionId: string;
  /** Toast notifications */
  studioToast: StudioToast | null;
  /** Dismiss toast */
  dismissStudioToast: () => void;
  /** Show toast */
  showStudioToast: (toast: Omit<StudioToast, 'id'>) => void;
  /** Save current session as snapshot */
  saveSessionSnapshot: (name?: string) => Promise<void>;
  /** Explicit user-initiated session save (for psychological safety) */
  saveSession: () => Promise<void>;
  /** Is session save in progress */
  saveSessionLoading: boolean;
  /** Get recent session snapshots */
  getRecentSnapshots: () => StudioSessionSnapshot[];
  /** Restore a session from snapshot */
  restoreSnapshot: (snapshotId: string) => void;

  // ============================================
  // AI Library: Persistent saved sessions
  // ============================================

  /** List of saved sessions in AI Library */
  aiLibraryEntries: import('@/lib/studio/aiLibrary').AILibraryEntry[];
  /** Restore a session from AI Library */
  restoreFromAILibrary: (entryId: string) => void;
}

// ============================================
// STEP 22: Output Contract Types
// ============================================
// Defines the expected output format from LLM.
// PATCH_ONLY mode enforces targeted edits only.

/**
 * Patch target sections
 */
export type PatchTarget = 'HOOK' | 'BODY' | 'CTA' | 'TONE';

/**
 * Patch action type
 */
export type PatchAction = 'REPLACE' | 'APPEND' | 'PREPEND';

/**
 * Full article output contract - no restrictions
 */
export interface FullArticleContract {
  mode: 'FULL_ARTICLE';
}

/**
 * Patch-only output contract - strict enforcement
 */
export interface PatchOnlyContract {
  mode: 'PATCH_ONLY';
  /** Target sections to patch */
  targets: PatchTarget[];
  /** All other sections must remain unchanged */
  preserveOtherSections: true;
  /** Default action for patches */
  defaultAction: PatchAction;
}

/**
 * Union type for output contract
 */
export type OutputContract = FullArticleContract | PatchOnlyContract;

/**
 * Extracted patch from LLM output
 */
export interface ExtractedPatch {
  target: PatchTarget;
  action: PatchAction;
  content: string;
}

/**
 * Patch validation result
 */
export interface PatchValidationResult {
  valid: boolean;
  patches: ExtractedPatch[];
  errors: string[];
  /** If true, output was a full rewrite instead of patch */
  wasFullRewrite: boolean;
  /** Raw output for fallback */
  rawOutput: string;
}
