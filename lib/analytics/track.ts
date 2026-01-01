// ============================================
// Privacy-Safe Analytics Tracker for Longlabs Editor
// ============================================
// PRIVACY BOUNDARY: Never logs raw content.
// Only IDs, counts, booleans, durations, enums, and bucket metrics.

import type {
  AnalyticsBaseProps,
  AnalyticsSurface,
  DraftState,
  AssistMode,
  SimilarityBucket,
  ContentLengthBucket,
  DurationBucket,
} from '@/types/analytics';

// ============================================
// CONSTANTS
// ============================================

const APP_VERSION = '1.0.0'; // TODO: Pull from package.json or env

/**
 * FORBIDDEN KEYS - These patterns are NEVER allowed in analytics payloads
 * Case-insensitive matching
 */
const FORBIDDEN_PATTERNS = /^(content|text|prompt|output|diff|snippet)$/i;

/**
 * Maximum batch size before auto-flush
 */
const MAX_BATCH_SIZE = 10;

/**
 * Flush interval in milliseconds
 */
const FLUSH_INTERVAL_MS = 30_000; // 30 seconds

// ============================================
// SESSION MANAGEMENT
// ============================================

let sessionId: string | null = null;

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get or create session ID
 */
export function getSessionId(): string {
  if (!sessionId) {
    if (typeof window !== 'undefined') {
      sessionId = sessionStorage.getItem('analytics_session_id');
      if (!sessionId) {
        sessionId = generateSessionId();
        sessionStorage.setItem('analytics_session_id', sessionId);
      }
    } else {
      sessionId = generateSessionId();
    }
  }
  return sessionId;
}

/**
 * Reset session (for testing or explicit session end)
 */
export function resetSession(): void {
  sessionId = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('analytics_session_id');
  }
}

// ============================================
// BUCKET HELPER FUNCTIONS
// ============================================

/**
 * Get similarity bucket from score (0-1)
 */
export function bucketSimilarity(score: number): SimilarityBucket {
  if (score >= 0.85) return '>=0.85';
  if (score >= 0.70) return '0.70-0.84';
  if (score >= 0.50) return '0.50-0.69';
  return '<0.50';
}

/**
 * Get content length bucket from character count
 * NEVER returns raw count - only bucket label
 */
export function bucketContentLength(length: number): ContentLengthBucket {
  if (length <= 200) return '0-200';
  if (length <= 600) return '201-600';
  if (length <= 1200) return '601-1200';
  return '>1200';
}

/**
 * Get duration bucket from milliseconds
 */
export function bucketDuration(ms: number): DurationBucket {
  if (ms <= 500) return '0-500';
  if (ms <= 2000) return '501-2000';
  if (ms <= 5000) return '2001-5000';
  return '>5000';
}

// ============================================
// PRIVACY ENFORCEMENT
// ============================================

/**
 * Strip forbidden keys from payload
 * This is the CRITICAL privacy boundary
 */
function stripForbiddenKeys(payload: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    // Check if key matches forbidden pattern
    if (FORBIDDEN_PATTERNS.test(key)) {
      console.warn(`[Analytics] Stripped forbidden key: ${key}`);
      continue;
    }

    // Recursively clean nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      cleaned[key] = stripForbiddenKeys(value as Record<string, unknown>);
    }
    // Clean arrays of objects
    else if (Array.isArray(value)) {
      cleaned[key] = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return stripForbiddenKeys(item as Record<string, unknown>);
        }
        return item;
      });
    }
    // Pass through primitives
    else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

// ============================================
// EVENT BATCHING
// ============================================

interface QueuedEvent {
  event: string;
  props: Record<string, unknown>;
}

let eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Flush queued events to analytics endpoint
 */
async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue = [];

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics', blob);
    } else {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        keepalive: true,
      });
    }
    console.log(`[Analytics] Flushed ${events.length} events`);
  } catch (error) {
    console.error('[Analytics] Failed to flush events:', error);
    if (eventQueue.length < MAX_BATCH_SIZE * 2) {
      eventQueue.unshift(...events);
    }
  }
}

/**
 * Schedule flush with debouncing
 */
function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushEvents();
  }, FLUSH_INTERVAL_MS);
}

// Visibility change handler
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushEvents();
    }
  });
  window.addEventListener('beforeunload', () => {
    flushEvents();
  });
}

// ============================================
// MAIN TRACKING API
// ============================================

/**
 * Required base props for every event (tightened - no Partial)
 * Uses index signature to allow additional properties
 */
interface TrackBaseProps {
  draft_id: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  message_id?: string;
  intent_id?: string;
  test_mode?: boolean;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Track an analytics event
 * REQUIRED: draft_id, ui_surface, editor_state, assist_mode
 * Auto-adds: event, ts, session_id, app_version
 */
export function track(
  event: string,
  props: TrackBaseProps
): void {
  // Build complete payload with auto-added fields
  const fullPayload: Record<string, unknown> = {
    ...props,
    event,
    ts: new Date().toISOString(),
    session_id: getSessionId(),
    app_version: APP_VERSION,
  };

  // Strip forbidden keys
  const cleanedPayload = stripForbiddenKeys(fullPayload);

  // Queue event
  eventQueue.push({
    event,
    props: cleanedPayload,
  });

  console.log(`[Analytics] Queued: ${event}`, cleanedPayload);

  // Flush if batch is full
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flushEvents();
  } else {
    scheduleFlush();
  }
}

// ============================================
// CONVENIENCE TRACKING FUNCTIONS
// ============================================

/**
 * Create base props for an event (returns TrackBaseProps, not Partial)
 */
export function createBaseProps(params: {
  draft_id: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  message_id?: string;
  intent_id?: string;
  test_mode?: boolean;
}): TrackBaseProps {
  return {
    draft_id: params.draft_id,
    ui_surface: params.ui_surface,
    editor_state: params.editor_state,
    assist_mode: params.assist_mode,
    message_id: params.message_id,
    intent_id: params.intent_id,
    test_mode: params.test_mode,
  };
}

/**
 * Track Quality Lock evaluation requested (before evaluation starts)
 */
export function trackQLEvaluationRequested(params: {
  draft_id: string;
  message_id: string;
  intent_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  test_mode?: boolean;
}): void {
  track('quality_lock.evaluation_requested', createBaseProps(params));
}

/**
 * Track Quality Lock evaluation completed
 */
export function trackQLEvaluationCompleted(params: {
  draft_id: string;
  message_id: string;
  intent_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  test_mode?: boolean;
  decision: 'PASS' | 'DRAFT' | 'FAIL';
  hard_fail_count: number;
  soft_fail_count: number;
  content_length: number;
  failed_rule_ids: string[];
  duration_ms: number;
}): void {
  track('quality_lock.evaluation_completed', {
    ...createBaseProps(params),
    decision: params.decision,
    hard_fail_count: params.hard_fail_count,
    soft_fail_count: params.soft_fail_count,
    content_length_bucket: bucketContentLength(params.content_length),
    failed_rule_ids: params.failed_rule_ids,
    duration_ms_bucket: bucketDuration(params.duration_ms),
  });
}

/**
 * Track Quality Lock panel viewed
 */
export function trackQLPanelViewed(params: {
  draft_id: string;
  message_id: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
}): void {
  track('quality_lock.panel_viewed', createBaseProps(params));
}

/**
 * Track Auto Fix attempt started (at start of each attempt)
 */
export function trackAutoFixAttemptStarted(params: {
  draft_id: string;
  message_id: string;
  intent_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  attempt_number: number;
}): void {
  track('auto_fix.attempt_started', {
    ...createBaseProps(params),
    attempt_number: params.attempt_number,
  });
}

/**
 * Track Auto Fix requested
 */
export function trackAutoFixRequested(params: {
  draft_id: string;
  message_id: string;
  intent_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  previous_decision: 'PASS' | 'DRAFT' | 'FAIL';
  target_rule_ids: string[];
}): void {
  track('auto_fix.requested', {
    ...createBaseProps(params),
    previous_decision: params.previous_decision,
    target_rule_ids: params.target_rule_ids,
  });
}

/**
 * Track Auto Fix attempt completed
 */
export function trackAutoFixAttemptCompleted(params: {
  draft_id: string;
  message_id: string;
  intent_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  attempt_number: number;
  similarity_score: number;
  used_fallback: boolean;
  duration_ms: number;
}): void {
  track('auto_fix.attempt_completed', {
    ...createBaseProps(params),
    attempt_number: params.attempt_number,
    similarity_bucket: bucketSimilarity(params.similarity_score),
    used_fallback: params.used_fallback,
    duration_ms_bucket: bucketDuration(params.duration_ms),
  });
}

/**
 * Track Auto Fix candidate shown
 */
export function trackAutoFixCandidateShown(params: {
  draft_id: string;
  message_id: string;
  intent_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  similarity_score: number;
  used_fallback: boolean;
}): void {
  track('auto_fix.candidate_shown', {
    ...createBaseProps(params),
    similarity_bucket: bucketSimilarity(params.similarity_score),
    used_fallback: params.used_fallback,
  });
}

/**
 * Track Auto Fix applied
 */
export function trackAutoFixApplied(params: {
  draft_id: string;
  message_id: string;
  intent_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  review_duration_ms: number;
  similarity_score: number;
  was_fallback: boolean;
}): void {
  track('auto_fix.applied', {
    ...createBaseProps(params),
    review_duration_bucket: bucketDuration(params.review_duration_ms),
    similarity_bucket: bucketSimilarity(params.similarity_score),
    was_fallback: params.was_fallback,
  });
}

/**
 * Track Auto Fix dismissed
 */
export function trackAutoFixDismissed(params: {
  draft_id: string;
  message_id: string;
  intent_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  review_duration_ms: number;
  similarity_score: number;
  was_fallback: boolean;
}): void {
  track('auto_fix.dismissed', {
    ...createBaseProps(params),
    review_duration_bucket: bucketDuration(params.review_duration_ms),
    similarity_bucket: bucketSimilarity(params.similarity_score),
    was_fallback: params.was_fallback,
  });
}

/**
 * Track Auto Fix undo used
 */
export function trackAutoFixUndoUsed(params: {
  draft_id: string;
  message_id: string;
  intent_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  time_since_apply_ms: number;
}): void {
  track('auto_fix.undo_used', {
    ...createBaseProps(params),
    time_since_apply_bucket: bucketDuration(params.time_since_apply_ms),
  });
}

/**
 * Track Auto Fix post-apply re-evaluation
 */
export function trackAutoFixPostApplyReEvaluated(params: {
  draft_id: string;
  message_id: string;
  intent_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  new_decision: 'PASS' | 'DRAFT' | 'FAIL';
}): void {
  track('auto_fix.post_apply_re_evaluated', {
    ...createBaseProps(params),
    new_decision: params.new_decision,
  });
}

/**
 * Track Write Next requested
 */
export function trackWriteNextRequested(params: {
  draft_id: string;
  message_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
}): void {
  track('assist.write_next_requested', createBaseProps(params));
}

/**
 * Track Write Next completed
 */
export function trackWriteNextCompleted(params: {
  draft_id: string;
  message_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  duration_ms: number;
}): void {
  track('assist.write_next_completed', {
    ...createBaseProps(params),
    duration_ms_bucket: bucketDuration(params.duration_ms),
  });
}

/**
 * Track Write Next applied
 */
export function trackWriteNextApplied(params: {
  draft_id: string;
  message_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
}): void {
  track('assist.write_next.applied', createBaseProps(params));
}

/**
 * Track Write Next dismissed
 */
export function trackWriteNextDismissed(params: {
  draft_id: string;
  message_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
}): void {
  track('assist.write_next.dismissed', createBaseProps(params));
}

/**
 * Track Clarify requested
 */
export function trackClarifyRequested(params: {
  draft_id: string;
  message_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
}): void {
  track('assist.clarify_requested', createBaseProps(params));
}

/**
 * Track Clarify completed
 */
export function trackClarifyCompleted(params: {
  draft_id: string;
  message_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  duration_ms: number;
}): void {
  track('assist.clarify_completed', {
    ...createBaseProps(params),
    duration_ms_bucket: bucketDuration(params.duration_ms),
  });
}

/**
 * Track Clarify action taken
 */
export function trackClarifyActionTaken(params: {
  draft_id: string;
  message_id?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  action: string;
}): void {
  track('assist.clarify.action_taken', {
    ...createBaseProps(params),
    action: params.action,
  });
}

// ============================================
// EXPORTS
// ============================================

export { flushEvents, stripForbiddenKeys };
