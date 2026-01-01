// ============================================
// Analytics Types for Longlabs Editor
// ============================================
// Privacy-safe analytics with no raw content logging.
// Only IDs, counts, booleans, durations, enums, and bucket metrics.

// ============================================
// DRAFT LIFECYCLE STATE
// ============================================

/**
 * Draft lifecycle state (D0-D4)
 */
export enum DraftState {
  D0_ACTIVE = 'D0_ACTIVE',
  D1_PAUSED = 'D1_PAUSED',
  D2_RETURNING = 'D2_RETURNING',
  D3_COMPLETE = 'D3_COMPLETE',
  D4_DORMANT = 'D4_DORMANT',
}

// ============================================
// ASSIST MODE (BACKOFF STATE)
// ============================================

/**
 * Assist mode based on trust/backoff state
 */
export enum AssistMode {
  A0_ASSIST_NORMAL = 'A0_ASSIST_NORMAL',
  A1_ASSIST_CAUTIOUS = 'A1_ASSIST_CAUTIOUS',
  A2_ASSIST_SILENT = 'A2_ASSIST_SILENT',
}

// ============================================
// ANALYTICS SURFACE
// ============================================

/**
 * Surface where analytics event originated
 */
export type AnalyticsSurface = 'studio' | 'panel' | 'inline_menu' | 'shortcut';

// ============================================
// QUALITY LOCK DECISION
// ============================================

/**
 * Quality Lock decision for analytics
 */
export type QLDecision = 'PASS' | 'DRAFT' | 'FAIL';

// ============================================
// BUCKET TYPES
// ============================================

/**
 * Similarity bucket
 */
export type SimilarityBucket = '>=0.85' | '0.70-0.84' | '0.50-0.69' | '<0.50';

/**
 * Content length bucket
 */
export type ContentLengthBucket = '0-200' | '201-600' | '601-1200' | '>1200';

/**
 * Duration bucket (milliseconds)
 */
export type DurationBucket = '0-500' | '501-2000' | '2001-5000' | '>5000';

// ============================================
// BASE PROPS (Required on every event)
// ============================================

/**
 * Base properties required on every analytics event
 */
export interface AnalyticsBaseProps {
  // Required core fields
  event: string;
  ts: string; // ISO timestamp
  session_id: string;
  app_version: string;

  // Draft/message context
  draft_id: string;
  message_id?: string;
  intent_id?: string;
  platform?: string;
  language?: string;
  ui_surface: AnalyticsSurface;
  editor_state: DraftState;
  assist_mode: AssistMode;
  test_mode?: boolean;

  // Optional user context
  user_id?: string;
  workspace_id?: string;
}

// ============================================
// EVENT NAMES
// ============================================

/**
 * All analytics event names
 */
export type AnalyticsEventName =
  // Quality Lock events
  | 'quality_lock.evaluation_requested'
  | 'quality_lock.evaluation_completed'
  | 'quality_lock.panel_viewed'
  | 'quality_lock.blocked_action'
  // Auto Fix events
  | 'auto_fix.requested'
  | 'auto_fix.attempt_started'
  | 'auto_fix.attempt_completed'
  | 'auto_fix.candidate_shown'
  | 'auto_fix.applied'
  | 'auto_fix.dismissed'
  | 'auto_fix.undo_used'
  | 'auto_fix.post_apply_re_evaluated'
  // Write Next events
  | 'assist.write_next_requested'
  | 'assist.write_next_completed'
  | 'assist.write_next.applied'
  | 'assist.write_next.dismissed'
  // Clarify events
  | 'assist.clarify_requested'
  | 'assist.clarify_completed'
  | 'assist.clarify.action_taken';

// ============================================
// EVENT-SPECIFIC PAYLOADS
// ============================================

/**
 * Quality Lock evaluation completed payload
 */
export interface QLEvaluationCompletedPayload {
  decision: QLDecision;
  hard_fail_count: number;
  soft_fail_count: number;
  content_length_bucket: ContentLengthBucket;
  failed_rule_ids: string[];
  duration_ms_bucket: DurationBucket;
}

/**
 * Auto Fix attempt completed payload
 */
export interface AFAttemptCompletedPayload {
  attempt_number: number;
  similarity_bucket: SimilarityBucket;
  used_fallback: boolean;
  duration_ms_bucket: DurationBucket;
}

/**
 * Auto Fix applied payload
 */
export interface AFAppliedPayload {
  review_duration_bucket: DurationBucket;
  similarity_bucket: SimilarityBucket;
  was_fallback: boolean;
}

/**
 * Auto Fix undo used payload
 */
export interface AFUndoUsedPayload {
  time_since_apply_bucket: DurationBucket;
}
