// ============================================
// STEP 22: Answer Engine - Interpreter Layer
// ============================================
// Determines QA vs Edit vs Create mode and provides contract
// for the SINGLE_LLM_CALL_SITE injection path.
//
// PURPOSE:
// - Interpret user message naturally (Q&A vs Edit vs Create)
// - Decide target scope when editing
// - Inject compact "task contract" so model responds correctly
// - Enable QA mode (direct answers without Hook/Body/CTA enforcement)
//
// INVARIANTS:
// - No LLM calls (pure deterministic functions)
// - No persistence (session-only)
// - No new endpoints
// - SINGLE_LLM_CALL_SITE preserved
// - Works in Vietnamese and English
//
// ⚠️ SYSTEM INVARIANT (STEP 25)
// This module defines task type detection logic used by all AI operations.
// Changes to detection patterns or thresholds affect REWRITE_UPGRADE behavior.
// Do NOT modify without:
// 1. Updating docs/system-invariants.md
// 2. Updating answerEngine.invariants.test.ts
// 3. Verifying all existing tests still pass
// ============================================

// ============================================
// Types
// ============================================

/**
 * Task type determined by Answer Engine
 */
export type AnswerTaskType = 'QA' | 'EDIT_PATCH' | 'REWRITE_UPGRADE' | 'CREATE';

/**
 * Target section for edits
 */
export type AnswerTarget = 'HOOK' | 'BODY' | 'CTA' | 'TONE' | 'FULL' | 'UNKNOWN';

/**
 * Answer Engine decision result
 */
export interface AnswerEngineDecision {
  taskType: AnswerTaskType;
  target: AnswerTarget;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Optional short plan (user-visible) */
  plan?: string[];
  /** Model output (either direct answer OR full post OR patch text) */
  responseText: string;
  /** For EDIT_PATCH only: patch instructions */
  patch?: {
    target: Exclude<AnswerTarget, 'UNKNOWN'>;
    content: string;
  };
  /** Diagnostics (DEV-only) */
  debug?: {
    signals: string[];
    reasons: string[];
  };
}

/**
 * Context for task type detection
 */
export interface TaskDetectionContext {
  /** Whether there's an active draft */
  hasActiveDraft: boolean;
  /** Whether there are previous messages */
  hasPreviousMessages: boolean;
  /** Language */
  lang: 'vi' | 'en';
  /** Edit patch meta from Step 21 (if present) */
  editPatchTarget?: string;
  /** Edit scope contract target (if present) */
  editScopeTarget?: string;
}

/**
 * Task detection result
 */
export interface TaskDetectionResult {
  taskType: AnswerTaskType;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  signals: string[];
  reasons: string[];
}

/**
 * Target detection result
 */
export interface TargetDetectionResult {
  target: AnswerTarget;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  signals: string[];
}

// ============================================
// Vietnamese Patterns
// ============================================

/** QA signal patterns (Vietnamese) */
const VI_QA_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  // Question markers
  { pattern: /\?/g, weight: 3, label: 'question mark' },
  { pattern: /(?:^|\s)là\s+gì(?:\s|$|\?)/i, weight: 4, label: 'là gì' },
  { pattern: /(?:^|\s)tại\s*sao(?:\s|$|\?)/i, weight: 4, label: 'tại sao' },
  { pattern: /(?:^|\s)bao\s*nhiêu(?:\s|$|\?)/i, weight: 4, label: 'bao nhiêu' },
  { pattern: /(?:^|\s)ở\s*đâu(?:\s|$|\?)/i, weight: 4, label: 'ở đâu' },
  { pattern: /(?:^|\s)khi\s*nào(?:\s|$|\?)/i, weight: 4, label: 'khi nào' },
  { pattern: /(?:^|\s)như\s*thế\s*nào(?:\s|$|\?)/i, weight: 4, label: 'như thế nào' },
  { pattern: /(?:^|\s)ai(?:\s|$|\?)/i, weight: 2, label: 'ai' },
  { pattern: /(?:^|\s)cái\s*gì(?:\s|$|\?)/i, weight: 3, label: 'cái gì' },
  // Request for explanation
  { pattern: /(?:^|\s)giải\s*thích(?:\s|$)/i, weight: 4, label: 'giải thích' },
  { pattern: /(?:^|\s)gợi\s*ý(?:\s|$)/i, weight: 3, label: 'gợi ý' },
  { pattern: /(?:^|\s)có\s*nên(?:\s|$|\?)/i, weight: 3, label: 'có nên' },
  { pattern: /(?:^|\s)so\s*sánh(?:\s|$)/i, weight: 3, label: 'so sánh' },
  { pattern: /(?:^|\s)nên\s+chọn(?:\s|$|\?)/i, weight: 3, label: 'nên chọn' },
  { pattern: /(?:^|\s)nghĩa\s*là(?:\s|$|\?)/i, weight: 3, label: 'nghĩa là' },
  { pattern: /(?:^|\s)ý\s*nghĩa(?:\s|$|\?)/i, weight: 3, label: 'ý nghĩa' },
  { pattern: /(?:^|\s)giúp\s*mình(?:\s|$)/i, weight: 2, label: 'giúp mình' },
  { pattern: /(?:^|\s)cho\s*hỏi(?:\s|$)/i, weight: 3, label: 'cho hỏi' },
  { pattern: /(?:^|\s)cho\s+\S+\s+hỏi(?:\s|$)/i, weight: 3, label: 'cho X hỏi' },
  { pattern: /(?:^|\s)hỏi\s*chút(?:\s|$)/i, weight: 3, label: 'hỏi chút' },
];

/** EDIT signal patterns (Vietnamese) */
const VI_EDIT_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  // Add/modify signals
  { pattern: /(?:^|\s)thêm(?:\s|$)/i, weight: 3, label: 'thêm' },
  { pattern: /(?:^|\s)bổ\s*sung(?:\s|$)/i, weight: 3, label: 'bổ sung' },
  { pattern: /(?:^|\s)sửa(?:\s|$)/i, weight: 3, label: 'sửa' },
  { pattern: /(?:^|\s)chỉnh(?:\s|$)/i, weight: 3, label: 'chỉnh' },
  { pattern: /(?:^|\s)đổi(?:\s|$)/i, weight: 2, label: 'đổi' },
  { pattern: /(?:^|\s)thay(?:\s|$)/i, weight: 2, label: 'thay' },
  { pattern: /(?:^|\s)cập\s*nhật(?:\s|$)/i, weight: 2, label: 'cập nhật' },
  // Explicit edit signals
  { pattern: /rút\s*gọn/i, weight: 4, label: 'rút gọn' },
  { pattern: /viết\s*ngắn\s*lại/i, weight: 4, label: 'viết ngắn lại' },
  { pattern: /ngắn\s*hơn/i, weight: 3, label: 'ngắn hơn' },
  { pattern: /dài\s*hơn/i, weight: 3, label: 'dài hơn' },
  { pattern: /mở\s*rộng/i, weight: 3, label: 'mở rộng' },
  // Preservation signals (strong EDIT indicator)
  { pattern: /giữ\s*nguyên/i, weight: 4, label: 'giữ nguyên' },
  { pattern: /không\s*đổi/i, weight: 3, label: 'không đổi' },
  { pattern: /đừng\s*viết\s*lại/i, weight: 5, label: 'đừng viết lại' },
  { pattern: /không\s*phải\s*viết\s*(bài\s*)?mới/i, weight: 5, label: 'không phải viết mới' },
  { pattern: /chỉ\s*thêm/i, weight: 4, label: 'chỉ thêm' },
  { pattern: /chỉ\s*sửa/i, weight: 4, label: 'chỉ sửa' },
  // Clarification signals
  { pattern: /(?:^|\s)ý\s*tôi\s*là/i, weight: 4, label: 'ý tôi là' },
  { pattern: /tôi\s*bảo\s*bạn/i, weight: 3, label: 'tôi bảo bạn' },
  { pattern: /tôi\s*muốn\s*thêm/i, weight: 4, label: 'tôi muốn thêm' },
  // Targeted detail additions (not full rewrite)
  { pattern: /thêm\s*chi\s*tiết/i, weight: 4, label: 'thêm chi tiết' },
];

/** REWRITE_UPGRADE signal patterns (Vietnamese) */
const VI_REWRITE_UPGRADE_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  // Length/expansion requests
  { pattern: /viết\s*dài\s*(hơn|ra)/i, weight: 5, label: 'viết dài hơn' },
  { pattern: /viết\s*chi\s*tiết\s*hơn/i, weight: 5, label: 'viết chi tiết hơn' },
  { pattern: /kéo\s*dài\s*(hơn|ra)/i, weight: 4, label: 'kéo dài' },
  // NOTE: "thêm chi tiết" moved to EDIT patterns - it's targeted addition, not full rewrite
  // Quality/upgrade requests
  { pattern: /chuyên\s*nghiệp\s*hơn/i, weight: 5, label: 'chuyên nghiệp hơn' },
  { pattern: /hay\s*hơn/i, weight: 4, label: 'hay hơn' },
  { pattern: /mượt\s*hơn/i, weight: 4, label: 'mượt hơn' },
  { pattern: /cuốn\s*hơn/i, weight: 4, label: 'cuốn hơn' },
  { pattern: /hấp\s*dẫn\s*hơn/i, weight: 4, label: 'hấp dẫn hơn' },
  { pattern: /tốt\s*hơn/i, weight: 3, label: 'tốt hơn' },
  // Explicit rewrite/upgrade signals
  { pattern: /viết\s*lại\s*(cho\s*)?(tốt|hay|đẹp|mượt)\s*hơn/i, weight: 6, label: 'viết lại cho tốt hơn' },
  { pattern: /nâng\s*cấp\s*(bài|nội\s*dung)/i, weight: 5, label: 'nâng cấp bài' },
  { pattern: /tối\s*ưu\s*(bài|nội\s*dung)?/i, weight: 4, label: 'tối ưu' },
  { pattern: /cải\s*thiện/i, weight: 4, label: 'cải thiện' },
  { pattern: /làm\s*(cho\s*)?(hay|tốt|đẹp)\s*hơn/i, weight: 4, label: 'làm hay hơn' },
  // Preserve intent with upgrade
  { pattern: /giữ\s*(ý|nội\s*dung).*viết\s*lại/i, weight: 6, label: 'giữ ý viết lại' },
  { pattern: /giữ\s*(ý|nội\s*dung).*hay\s*hơn/i, weight: 6, label: 'giữ ý hay hơn' },
  // Generic rewrite (without "từ đầu" = from scratch)
  { pattern: /viết\s*lại(?!\s*(từ\s*đầu|hoàn\s*toàn\s*mới))/i, weight: 4, label: 'viết lại' },
  { pattern: /rewrite/i, weight: 4, label: 'rewrite' },
];

/** CREATE signal patterns (Vietnamese) */
const VI_CREATE_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /viết\s*bài\s*(mới)?/i, weight: 4, label: 'viết bài' },
  { pattern: /tạo\s*bài/i, weight: 4, label: 'tạo bài' },
  { pattern: /làm\s*bài\s*mới/i, weight: 5, label: 'làm bài mới' },
  { pattern: /viết\s*lại\s*từ\s*đầu/i, weight: 5, label: 'viết lại từ đầu' },
  { pattern: /bắt\s*đầu\s*lại/i, weight: 4, label: 'bắt đầu lại' },
  { pattern: /chủ\s*đề\s*mới/i, weight: 5, label: 'chủ đề mới' },
  { pattern: /nội\s*dung\s*mới/i, weight: 4, label: 'nội dung mới' },
  { pattern: /bài\s*về\s+/i, weight: 3, label: 'bài về' },
];

/** Target BODY patterns (Vietnamese) */
const VI_BODY_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\bbody\b/i, weight: 4, label: 'body' },
  { pattern: /thân\s*bài/i, weight: 4, label: 'thân bài' },
  { pattern: /phần\s*thân/i, weight: 3, label: 'phần thân' },
  // Contact info signals -> BODY
  { pattern: /thông\s*tin\s*liên\s*hệ/i, weight: 5, label: 'thông tin liên hệ' },
  { pattern: /hotline/i, weight: 4, label: 'hotline' },
  { pattern: /địa\s*chỉ/i, weight: 4, label: 'địa chỉ' },
  { pattern: /số\s*điện\s*thoại/i, weight: 4, label: 'số điện thoại' },
  { pattern: /email/i, weight: 3, label: 'email' },
  { pattern: /liên\s*hệ/i, weight: 3, label: 'liên hệ' },
  // Content signals
  { pattern: /nội\s*dung/i, weight: 2, label: 'nội dung' },
  { pattern: /thông\s*tin/i, weight: 2, label: 'thông tin' },
  { pattern: /chi\s*tiết/i, weight: 2, label: 'chi tiết' },
  { pattern: /bullet/i, weight: 3, label: 'bullet' },
];

/** Target HOOK patterns (Vietnamese) */
const VI_HOOK_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\bhook\b/i, weight: 4, label: 'hook' },
  { pattern: /mở\s*bài/i, weight: 4, label: 'mở bài' },
  { pattern: /phần\s*mở/i, weight: 3, label: 'phần mở' },
  { pattern: /câu\s*mở/i, weight: 3, label: 'câu mở' },
  { pattern: /tiêu\s*đề/i, weight: 3, label: 'tiêu đề' },
  { pattern: /dòng\s*đầu/i, weight: 3, label: 'dòng đầu' },
];

/** Target CTA patterns (Vietnamese) */
const VI_CTA_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\bcta\b/i, weight: 4, label: 'cta' },
  { pattern: /kết\s*bài/i, weight: 4, label: 'kết bài' },
  { pattern: /phần\s*kết/i, weight: 3, label: 'phần kết' },
  { pattern: /kêu\s*gọi/i, weight: 3, label: 'kêu gọi' },
  { pattern: /call\s*to\s*action/i, weight: 4, label: 'call to action' },
  { pattern: /chốt\s*đơn/i, weight: 3, label: 'chốt đơn' },
];

/** Target TONE patterns (Vietnamese) */
const VI_TONE_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\btone\b/i, weight: 4, label: 'tone' },
  { pattern: /giọng\s*văn/i, weight: 4, label: 'giọng văn' },
  { pattern: /văn\s*phong/i, weight: 3, label: 'văn phong' },
  { pattern: /phong\s*cách/i, weight: 3, label: 'phong cách' },
  { pattern: /sang\s*hơn/i, weight: 3, label: 'sang hơn' },
  { pattern: /trẻ\s*trung/i, weight: 2, label: 'trẻ trung' },
  { pattern: /chuyên\s*nghiệp/i, weight: 2, label: 'chuyên nghiệp' },
  { pattern: /salesy/i, weight: 2, label: 'salesy' },
  { pattern: /mềm\s*hơn/i, weight: 2, label: 'mềm hơn' },
];

// ============================================
// English Patterns
// ============================================

/** QA signal patterns (English) */
const EN_QA_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\?/g, weight: 3, label: 'question mark' },
  { pattern: /\bwhat\s+is\b/i, weight: 4, label: 'what is' },
  { pattern: /\bwhy\b/i, weight: 3, label: 'why' },
  { pattern: /\bhow\s+many\b/i, weight: 4, label: 'how many' },
  { pattern: /\bwhere\b/i, weight: 3, label: 'where' },
  { pattern: /\bwhen\b/i, weight: 3, label: 'when' },
  { pattern: /\bhow\s+to\b/i, weight: 3, label: 'how to' },
  { pattern: /\bwho\b/i, weight: 2, label: 'who' },
  { pattern: /\bexplain\b/i, weight: 4, label: 'explain' },
  { pattern: /\bsuggest\b/i, weight: 3, label: 'suggest' },
  { pattern: /\bshould\s+i\b/i, weight: 3, label: 'should i' },
  { pattern: /\bcompare\b/i, weight: 3, label: 'compare' },
  { pattern: /\bwhat\s+does\b/i, weight: 3, label: 'what does' },
  { pattern: /\bcan\s+you\s+tell\b/i, weight: 3, label: 'can you tell' },
];

/** EDIT signal patterns (English) */
const EN_EDIT_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\badd\b/i, weight: 3, label: 'add' },
  { pattern: /\bappend\b/i, weight: 3, label: 'append' },
  { pattern: /\bedit\b/i, weight: 3, label: 'edit' },
  { pattern: /\bfix\b/i, weight: 3, label: 'fix' },
  { pattern: /\bmodify\b/i, weight: 3, label: 'modify' },
  { pattern: /\bchange\b/i, weight: 2, label: 'change' },
  { pattern: /\bupdate\b/i, weight: 2, label: 'update' },
  { pattern: /\bshorten\b/i, weight: 4, label: 'shorten' },
  { pattern: /\bexpand\b/i, weight: 3, label: 'expand' },
  { pattern: /\bmake\s+shorter\b/i, weight: 4, label: 'make shorter' },
  { pattern: /\bmake\s+longer\b/i, weight: 3, label: 'make longer' },
  { pattern: /\bkeep\s+the\s+rest\b/i, weight: 4, label: 'keep the rest' },
  { pattern: /\bdon'?t\s+rewrite\b/i, weight: 5, label: "don't rewrite" },
  { pattern: /\bonly\s+add\b/i, weight: 4, label: 'only add' },
  { pattern: /\bjust\s+add\b/i, weight: 4, label: 'just add' },
  { pattern: /\bonly\s+edit\b/i, weight: 4, label: 'only edit' },
];

/** REWRITE_UPGRADE signal patterns (English) */
const EN_REWRITE_UPGRADE_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  // Length/expansion requests
  { pattern: /\bmake\s+(it\s+)?longer\b/i, weight: 5, label: 'make longer' },
  { pattern: /\bexpand\s+(it|this)\b/i, weight: 5, label: 'expand it' },
  { pattern: /\bmore\s+detail(ed|s)?\b/i, weight: 5, label: 'more detailed' },
  { pattern: /\badd\s+more\s+detail/i, weight: 4, label: 'add more detail' },
  // Quality/upgrade requests
  { pattern: /\bmore\s+professional\b/i, weight: 5, label: 'more professional' },
  { pattern: /\bmake\s+(it\s+)?better\b/i, weight: 4, label: 'make better' },
  { pattern: /\bimprove\s+(it|this)?\b/i, weight: 5, label: 'improve' },
  { pattern: /\bmore\s+engaging\b/i, weight: 4, label: 'more engaging' },
  { pattern: /\bmore\s+compelling\b/i, weight: 4, label: 'more compelling' },
  { pattern: /\bmore\s+polished\b/i, weight: 4, label: 'more polished' },
  // Explicit rewrite/upgrade signals
  { pattern: /\brewrite\s+(to\s+be\s+)?(better|longer|more)/i, weight: 6, label: 'rewrite to be better' },
  { pattern: /\bupgrade\s+(the\s+)?(post|content)\b/i, weight: 5, label: 'upgrade post' },
  { pattern: /\benhance\b/i, weight: 4, label: 'enhance' },
  { pattern: /\boptimize\b/i, weight: 4, label: 'optimize' },
  { pattern: /\bpolish\b/i, weight: 4, label: 'polish' },
  // Preserve intent with upgrade
  { pattern: /\bkeep\s+(the\s+)?(idea|content).*rewrite\b/i, weight: 6, label: 'keep idea rewrite' },
  { pattern: /\bsame\s+(idea|topic).*better\b/i, weight: 5, label: 'same idea better' },
  // Generic rewrite (without "from scratch")
  { pattern: /\brewrite(?!\s+(from\s+scratch|completely|entirely))\b/i, weight: 4, label: 'rewrite' },
];

/** CREATE signal patterns (English) */
const EN_CREATE_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\bwrite\s+a\s+(new\s+)?post\b/i, weight: 4, label: 'write a post' },
  { pattern: /\bcreate\s+a?\s*(new\s+)?post\b/i, weight: 4, label: 'create a post' },
  { pattern: /\bstart\s+over\b/i, weight: 5, label: 'start over' },
  { pattern: /\bfrom\s+scratch\b/i, weight: 5, label: 'from scratch' },
  { pattern: /\bnew\s+topic\b/i, weight: 5, label: 'new topic' },
  { pattern: /\bnew\s+content\b/i, weight: 4, label: 'new content' },
  { pattern: /\bwrite\s+about\b/i, weight: 3, label: 'write about' },
];

/** Target BODY patterns (English) */
const EN_BODY_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\bbody\b/i, weight: 4, label: 'body' },
  { pattern: /\bmain\s+content\b/i, weight: 4, label: 'main content' },
  { pattern: /\bmiddle\b/i, weight: 3, label: 'middle' },
  { pattern: /\bcontact\s+info(rmation)?\b/i, weight: 5, label: 'contact info' },
  { pattern: /\bhotline\b/i, weight: 4, label: 'hotline' },
  { pattern: /\baddress\b/i, weight: 4, label: 'address' },
  { pattern: /\bphone\s+number\b/i, weight: 4, label: 'phone number' },
  { pattern: /\bemail\b/i, weight: 3, label: 'email' },
  { pattern: /\bbullet\s*points?\b/i, weight: 3, label: 'bullet points' },
];

/** Target HOOK patterns (English) */
const EN_HOOK_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\bhook\b/i, weight: 4, label: 'hook' },
  { pattern: /\bopening\b/i, weight: 4, label: 'opening' },
  { pattern: /\bintro(duction)?\b/i, weight: 3, label: 'intro' },
  { pattern: /\bfirst\s+line\b/i, weight: 3, label: 'first line' },
  { pattern: /\bheadline\b/i, weight: 3, label: 'headline' },
];

/** Target CTA patterns (English) */
const EN_CTA_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\bcta\b/i, weight: 4, label: 'cta' },
  { pattern: /\bcall\s*to\s*action\b/i, weight: 4, label: 'call to action' },
  { pattern: /\bclosing\b/i, weight: 3, label: 'closing' },
  { pattern: /\bending\b/i, weight: 2, label: 'ending' },
  { pattern: /\bconclusion\b/i, weight: 3, label: 'conclusion' },
];

/** Target TONE patterns (English) */
const EN_TONE_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\btone\b/i, weight: 4, label: 'tone' },
  { pattern: /\bstyle\b/i, weight: 3, label: 'style' },
  { pattern: /\bvoice\b/i, weight: 3, label: 'voice' },
  { pattern: /\bmore\s+professional\b/i, weight: 3, label: 'more professional' },
  { pattern: /\bmore\s+casual\b/i, weight: 3, label: 'more casual' },
  { pattern: /\bless\s+salesy\b/i, weight: 3, label: 'less salesy' },
  { pattern: /\bsofter\b/i, weight: 2, label: 'softer' },
];

// ============================================
// Core Detection Functions
// ============================================

/**
 * Calculate pattern score from text
 */
function calculatePatternScore(
  text: string,
  patterns: Array<{ pattern: RegExp; weight: number; label: string }>
): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  for (const { pattern, weight, label } of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      score += weight * matches.length;
      signals.push(label);
    }
  }

  return { score, signals };
}

/**
 * Detect task type from user text
 *
 * @param userText - User input text
 * @param ctx - Detection context
 * @returns Task detection result with type, confidence, and signals
 */
export function detectTaskType(
  userText: string,
  ctx: TaskDetectionContext
): TaskDetectionResult {
  const text = userText.trim().toLowerCase();
  const lang = ctx.lang;

  // Select patterns based on language
  const qaPatterns = lang === 'vi' ? VI_QA_PATTERNS : EN_QA_PATTERNS;
  const editPatterns = lang === 'vi' ? VI_EDIT_PATTERNS : EN_EDIT_PATTERNS;
  const rewriteUpgradePatterns = lang === 'vi' ? VI_REWRITE_UPGRADE_PATTERNS : EN_REWRITE_UPGRADE_PATTERNS;
  const createPatterns = lang === 'vi' ? VI_CREATE_PATTERNS : EN_CREATE_PATTERNS;

  // Calculate scores
  const qaResult = calculatePatternScore(text, qaPatterns);
  const editResult = calculatePatternScore(text, editPatterns);
  const rewriteUpgradeResult = calculatePatternScore(text, rewriteUpgradePatterns);
  const createResult = calculatePatternScore(text, createPatterns);

  const allSignals = [
    ...qaResult.signals,
    ...editResult.signals,
    ...rewriteUpgradeResult.signals,
    ...createResult.signals,
  ];
  const reasons: string[] = [];

  // Store RAW pattern scores before context modifiers
  const rawEditScore = editResult.score;
  const rawQaScore = qaResult.score;
  const rawRewriteUpgradeScore = rewriteUpgradeResult.score;
  const _rawCreateScore = createResult.score;

  const scores = {
    QA: qaResult.score,
    EDIT_PATCH: editResult.score,
    REWRITE_UPGRADE: rewriteUpgradeResult.score,
    CREATE: createResult.score,
  };

  // ============================================
  // PRIORITY RULES (CRITICAL - NON-NEGOTIABLE)
  // ============================================
  // 1. QA wins if question signals exist (HIGHEST PRIORITY)
  //    - "là gì", "tại sao", "bao nhiêu", "how/what/why", "?", "cho mình hỏi…"
  //    - QA must NOT be hijacked by activeDraft boosts
  //
  // 2. EDIT_PATCH if explicit patch keywords exist AND target is inferable
  //    - "thêm", "sửa", "đổi", "chèn", "update", "fix", "remove", "bỏ", "chỉnh"
  //    - Must have target: hotline/address/CTA/Hook/Body
  //
  // 3. REWRITE_UPGRADE if rewrite/upgrade triggers exist
  //    - "viết dài hơn", "chuyên nghiệp hơn", "hay hơn", "improve", "expand"
  //    - ONLY when user is not asking a question
  //
  // 4. CREATE as fallback
  // ============================================

  // Check for inferable edit target (for EDIT_PATCH eligibility)
  const targetResult = detectEditTarget(userText, lang);
  const hasInferableTarget = targetResult.target !== 'UNKNOWN' && targetResult.confidence !== 'LOW';

  // ============================================
  // RULE 1: QA wins if question signals exist (HIGHEST PRIORITY)
  // ============================================
  // QA wins if:
  // - rawQaScore >= 3 (question signals present)
  // - AND no explicit edit/patch keywords (rawEditScore === 0)
  // Note: We DON'T check rawRewriteUpgradeScore because REWRITE patterns like "hay hơn"
  // are often adjectives that can be questions ("Hay hơn?" = "Is it better?")
  // This allows "Sửa mở bài được không?" to be EDIT (has "sửa"), not QA
  // But "Hay hơn?" to be QA (no edit keyword, just question + adjective)
  if (rawQaScore >= 3 && rawEditScore === 0) {
    // Strong QA signals + no edit keywords -> QA mode, cannot be overridden by REWRITE
    reasons.push('QA priority: strong question signals, no edit keywords');
    return {
      taskType: 'QA',
      confidence: rawQaScore >= 6 ? 'HIGH' : 'MEDIUM',
      signals: allSignals,
      reasons: [...reasons, `Scores: QA=${scores.QA}, EDIT=${scores.EDIT_PATCH}, REWRITE=${scores.REWRITE_UPGRADE}, CREATE=${scores.CREATE}`],
    };
  }

  // ============================================
  // RULE 2: EDIT_PATCH if explicit patch keywords + inferable target
  // ============================================
  if (rawEditScore >= 3 && hasInferableTarget) {
    reasons.push(`EDIT_PATCH: explicit edit keywords + inferable target (${targetResult.target})`);
    return {
      taskType: 'EDIT_PATCH',
      confidence: rawEditScore >= 6 ? 'HIGH' : 'MEDIUM',
      signals: allSignals,
      reasons: [...reasons, `Scores: QA=${scores.QA}, EDIT=${scores.EDIT_PATCH}, REWRITE=${scores.REWRITE_UPGRADE}, CREATE=${scores.CREATE}`],
    };
  }

  // ============================================
  // RULE 3: REWRITE_UPGRADE if rewrite/upgrade triggers exist
  // (and user is not asking a question)
  // ============================================
  if (rawRewriteUpgradeScore >= 3 && rawQaScore === 0) {
    reasons.push('REWRITE_UPGRADE: upgrade/rewrite signals without question markers');
    return {
      taskType: 'REWRITE_UPGRADE',
      confidence: rawRewriteUpgradeScore >= 6 ? 'HIGH' : 'MEDIUM',
      signals: allSignals,
      reasons: [...reasons, `Scores: QA=${scores.QA}, EDIT=${scores.EDIT_PATCH}, REWRITE=${scores.REWRITE_UPGRADE}, CREATE=${scores.CREATE}`],
    };
  }

  // ============================================
  // RULE 4: Fallback with context-aware scoring
  // ============================================
  // Apply context modifiers only for fallback path
  if (ctx.hasActiveDraft) {
    // With active draft: prefer REWRITE_UPGRADE over CREATE
    scores.REWRITE_UPGRADE += 2;
    reasons.push('Active draft boosts REWRITE_UPGRADE');
  }

  if (!ctx.hasActiveDraft && !ctx.hasPreviousMessages) {
    // No draft and no messages -> boost CREATE
    scores.CREATE += 2;
    reasons.push('No draft/messages boosts CREATE');
  }

  // Use Step 21 edit patch target if present
  if (ctx.editPatchTarget && ctx.editPatchTarget !== 'FULL') {
    scores.EDIT_PATCH += 3;
    reasons.push(`Step 21 patch target: ${ctx.editPatchTarget}`);
  }

  // Find winner among remaining modes
  let taskType: AnswerTaskType = 'CREATE';
  let maxScore = scores.CREATE;

  if (scores.QA > maxScore) {
    taskType = 'QA';
    maxScore = scores.QA;
  }
  if (scores.EDIT_PATCH > maxScore) {
    taskType = 'EDIT_PATCH';
    maxScore = scores.EDIT_PATCH;
  }
  if (scores.REWRITE_UPGRADE > maxScore) {
    taskType = 'REWRITE_UPGRADE';
    maxScore = scores.REWRITE_UPGRADE;
  }

  // ============================================
  // FINAL QA SAFETY CHECK
  // ============================================
  // Even in fallback path, QA beats EDIT/REWRITE if:
  // - User had any QA signals (rawQaScore > 0)
  // - AND no explicit edit/rewrite keywords
  // ============================================
  if (taskType !== 'QA' && rawQaScore > 0 && rawEditScore === 0 && rawRewriteUpgradeScore === 0) {
    taskType = 'QA';
    maxScore = scores.QA;
    reasons.push('QA priority: no explicit edit/rewrite keywords, forcing QA mode');
  }

  // Determine confidence
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const gap = sortedScores[0] - sortedScores[1];
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

  if (gap >= 5 || maxScore >= 8) {
    confidence = 'HIGH';
  } else if (gap >= 2 || maxScore >= 4) {
    confidence = 'MEDIUM';
  }

  reasons.push(`Scores: QA=${scores.QA}, EDIT=${scores.EDIT_PATCH}, REWRITE=${scores.REWRITE_UPGRADE}, CREATE=${scores.CREATE}`);

  return {
    taskType,
    confidence,
    signals: allSignals,
    reasons,
  };
}

/**
 * Detect edit target from user text
 *
 * @param userText - User input text
 * @param lang - Language
 * @returns Target detection result
 */
export function detectEditTarget(
  userText: string,
  lang: 'vi' | 'en'
): TargetDetectionResult {
  const text = userText.trim().toLowerCase();

  // Select patterns based on language
  const bodyPatterns = lang === 'vi' ? VI_BODY_PATTERNS : EN_BODY_PATTERNS;
  const hookPatterns = lang === 'vi' ? VI_HOOK_PATTERNS : EN_HOOK_PATTERNS;
  const ctaPatterns = lang === 'vi' ? VI_CTA_PATTERNS : EN_CTA_PATTERNS;
  const tonePatterns = lang === 'vi' ? VI_TONE_PATTERNS : EN_TONE_PATTERNS;

  // Calculate scores
  const bodyResult = calculatePatternScore(text, bodyPatterns);
  const hookResult = calculatePatternScore(text, hookPatterns);
  const ctaResult = calculatePatternScore(text, ctaPatterns);
  const toneResult = calculatePatternScore(text, tonePatterns);

  const scores = {
    BODY: bodyResult.score,
    HOOK: hookResult.score,
    CTA: ctaResult.score,
    TONE: toneResult.score,
  };

  const allSignals = [
    ...bodyResult.signals,
    ...hookResult.signals,
    ...ctaResult.signals,
    ...toneResult.signals,
  ];

  // Find winner
  let target: AnswerTarget = 'UNKNOWN';
  let maxScore = 0;

  for (const [t, score] of Object.entries(scores)) {
    if (score > maxScore) {
      target = t as AnswerTarget;
      maxScore = score;
    }
  }

  // If no clear target, return UNKNOWN
  if (maxScore < 2) {
    target = 'UNKNOWN';
  }

  // Determine confidence
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (maxScore >= 5) {
    confidence = 'HIGH';
  } else if (maxScore >= 3) {
    confidence = 'MEDIUM';
  }

  return {
    target,
    confidence,
    signals: allSignals,
  };
}

/**
 * Check if user message should be answered directly (QA mode)
 *
 * @param userText - User input text
 * @param ctx - Detection context
 * @returns True if should answer directly without Hook/Body/CTA enforcement
 */
export function shouldAnswerDirectly(
  userText: string,
  ctx: TaskDetectionContext
): boolean {
  const detection = detectTaskType(userText, ctx);
  return detection.taskType === 'QA' && detection.confidence !== 'LOW';
}

// ============================================
// Contract Formatting
// ============================================

/**
 * Format Answer Engine contract block for system prompt injection
 *
 * @param taskType - Detected task type
 * @param target - Detected target (for EDIT_PATCH)
 * @param lang - Language
 * @returns Contract block string for system prompt
 */
export function formatAnswerEngineContract(
  taskType: AnswerTaskType,
  target: AnswerTarget,
  lang: 'vi' | 'en'
): string {
  if (lang === 'vi') {
    return `
[ANSWER_ENGINE_CONTRACT]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CHẾ ĐỘ: ${getTaskTypeLabel(taskType, 'vi')}${target !== 'UNKNOWN' ? ` → ${getTargetLabel(target, 'vi')}` : ''}

📋 QUY TẮC OUTPUT:
Bắt đầu phản hồi với dòng đầu tiên:
MODE: ${taskType}

${taskType === 'QA' ? `
✅ Trả lời trực tiếp câu hỏi
✅ Không cần cấu trúc Hook/Body/CTA
✅ Ngắn gọn, súc tích
` : ''}
${taskType === 'EDIT_PATCH' ? `
✅ CHỈ sửa phần: ${getTargetLabel(target, 'vi')}
✅ GIỮ NGUYÊN các phần khác (không lặp lại)
✅ Dùng format:
   TARGET: ${target !== 'UNKNOWN' ? target : 'BODY'}
   PATCH:
   <nội dung patch>
❌ KHÔNG viết lại toàn bài
` : ''}
${taskType === 'REWRITE_UPGRADE' ? `
📎 NGUỒN: Viết lại bài trong SOURCE_CONTENT bên dưới

🔗 QUY TẮC ANCHOR (BẮT BUỘC):
Mỗi đoạn văn được đánh dấu bằng anchor: <<P1>>, <<P2>>, <<P3>>...

OUTPUT PHẢI:
• Giữ nguyên TẤT CẢ anchors (<<P1>>, <<P2>>, ...)
• Giữ nguyên THỨ TỰ anchors (P1 trước P2, P2 trước P3...)
• Viết lại nội dung CHỈ BÊN TRONG mỗi anchor

OUTPUT KHÔNG ĐƯỢC:
• Thêm anchor mới
• Xóa anchor có sẵn
• Gộp hoặc tách các đoạn đã được anchor
• Đổi thứ tự anchor

⚠️ Vi phạm anchor = output bị từ chối.

⚠️ OUTPUT FORMAT (BẮT BUỘC):
Viết lại TẠI CHỖ — CÙNG BÀI, VIẾT HAY HƠN.
• Giữ nguyên CẤU TRÚC đoạn văn gốc (đoạn 1 → đoạn 1, đoạn 2 → đoạn 2...)
• Giữ nguyên THỨ TỰ ý tưởng (ý A trước ý B → vẫn A trước B)
• KHÔNG tạo hook/mở bài mới nếu gốc không có hook rõ ràng
• KHÔNG thêm narrative arc hoặc kịch tính hóa
• KHÔNG đổi giọng CTA (nếu gốc nhẹ nhàng → giữ nhẹ nhàng)
• Nếu không chắc → GIỮ NGUYÊN câu gốc, chỉ polish ngữ pháp

🔒 QUY TẮC NGHIÊM NGẶT:

✅ ĐƯỢC PHÉP:
• Cải thiện độ rõ ràng, mạch lạc, chuyên nghiệp
• Mở rộng nội dung TRONG CÙNG Ý NGHĨA với bài gốc
• Dùng từ ngữ hay hơn, câu văn mượt hơn
• Thêm chi tiết BỔ SUNG cho ý đã có trong bài gốc

❌ NGHIÊM CẤM:
• KHÔNG thay đổi chủ đề/góc nhìn/ý định của bài gốc
• KHÔNG tái cấu trúc toàn bộ bài viết
• KHÔNG thêm section mới nếu bài gốc không có
• KHÔNG thêm CTA nếu bài gốc KHÔNG có CTA
• KHÔNG tăng áp lực marketing nếu gốc không salesy
• KHÔNG đổi brand/sản phẩm/dịch vụ sang brand khác
• KHÔNG biến thành bài Q&A/hỏi đáp
• KHÔNG thêm thông tin bịa đặt (địa chỉ, hotline, giá cả)

📌 KẾT QUẢ MONG ĐỢI:
Output phải giống "cùng bài viết, được viết hay hơn" — KHÔNG phải bài mới.
` : ''}
${taskType === 'CREATE' ? `
✅ Tạo nội dung mới hoàn chỉnh
✅ Có thể dùng cấu trúc Hook/Body/CTA
` : ''}

[/ANSWER_ENGINE_CONTRACT]
`.trim();
  }

  return `
[ANSWER_ENGINE_CONTRACT]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 MODE: ${getTaskTypeLabel(taskType, 'en')}${target !== 'UNKNOWN' ? ` → ${getTargetLabel(target, 'en')}` : ''}

📋 OUTPUT RULES:
Start your response with the first line:
MODE: ${taskType}

${taskType === 'QA' ? `
✅ Answer the question directly
✅ No Hook/Body/CTA structure required
✅ Keep it concise
` : ''}
${taskType === 'EDIT_PATCH' ? `
✅ ONLY edit section: ${getTargetLabel(target, 'en')}
✅ PRESERVE other sections unchanged (do not repeat them)
✅ Use format:
   TARGET: ${target !== 'UNKNOWN' ? target : 'BODY'}
   PATCH:
   <patch content>
❌ DO NOT rewrite the entire post
` : ''}
${taskType === 'REWRITE_UPGRADE' ? `
📎 SOURCE: Rewrite the post in SOURCE_CONTENT below

🔗 ANCHOR RULES (MANDATORY):
Each paragraph is marked with an anchor: <<P1>>, <<P2>>, <<P3>>...

OUTPUT MUST:
• Preserve ALL anchors (<<P1>>, <<P2>>, ...)
• Preserve anchor ORDER (P1 before P2, P2 before P3...)
• Rewrite content ONLY INSIDE each anchor

OUTPUT MUST NOT:
• Add new anchors
• Remove existing anchors
• Merge or split anchored sections
• Reorder anchors

⚠️ Anchor violation = output rejected.

⚠️ OUTPUT FORMAT (MANDATORY):
Rewrite IN PLACE — SAME POST, WRITTEN BETTER.
• Keep SAME paragraph structure (para 1 → para 1, para 2 → para 2...)
• Keep SAME idea order (idea A before B → still A before B)
• DO NOT create new hook/opening if source has no clear hook
• DO NOT add narrative arc or dramatization
• DO NOT change CTA tone (if source is soft → keep soft)
• When uncertain → KEEP original wording, only polish grammar

🔒 STRICT RULES:

✅ ALLOWED:
• Improve clarity, flow, professionalism
• Expand content WITHIN THE SAME MEANING as source
• Use better wording, smoother sentences
• Add supplementary details to EXISTING ideas in source

❌ FORBIDDEN:
• DO NOT change topic/angle/intent of source
• DO NOT globally restructure the post
• DO NOT add new sections if source doesn't have them
• DO NOT add CTA if source has NO CTA
• DO NOT increase marketing pressure if source is not salesy
• DO NOT switch brand/product/service to different brand
• DO NOT turn into Q&A/FAQ format
• DO NOT add fabricated info (addresses, hotlines, prices)

📌 EXPECTED OUTPUT:
Result must feel like "the same post, written better" — NOT a new post.
` : ''}
${taskType === 'CREATE' ? `
✅ Create new complete content
✅ May use Hook/Body/CTA structure
` : ''}

[/ANSWER_ENGINE_CONTRACT]
`.trim();
}

/**
 * Get localized task type label
 */
function getTaskTypeLabel(taskType: AnswerTaskType, lang: 'vi' | 'en'): string {
  const labels: Record<AnswerTaskType, { vi: string; en: string }> = {
    QA: { vi: 'HỎI ĐÁP', en: 'Q&A' },
    EDIT_PATCH: { vi: 'CHỈNH SỬA', en: 'EDIT PATCH' },
    REWRITE_UPGRADE: { vi: 'VIẾT LẠI NÂNG CẤP', en: 'REWRITE UPGRADE' },
    CREATE: { vi: 'TẠO MỚI', en: 'CREATE' },
  };
  return labels[taskType][lang];
}

/**
 * Get UI badge label for task type (shorter, for display)
 */
export function getTaskTypeBadgeLabel(taskType: AnswerTaskType, lang: 'vi' | 'en'): string {
  const labels: Record<AnswerTaskType, { vi: string; en: string }> = {
    QA: { vi: 'QA', en: 'QA' },
    EDIT_PATCH: { vi: 'Chỉnh nhỏ (PATCH)', en: 'Patch' },
    REWRITE_UPGRADE: { vi: 'Viết lại nâng cấp (REWRITE)', en: 'Rewrite' },
    CREATE: { vi: 'Tạo mới', en: 'Create' },
  };
  return labels[taskType][lang];
}

/**
 * Get localized target label
 */
function getTargetLabel(target: AnswerTarget, lang: 'vi' | 'en'): string {
  const labels: Record<AnswerTarget, { vi: string; en: string }> = {
    HOOK: { vi: 'Mở bài (Hook)', en: 'Hook / Opening' },
    BODY: { vi: 'Thân bài (Body)', en: 'Body / Content' },
    CTA: { vi: 'Kêu gọi (CTA)', en: 'CTA' },
    TONE: { vi: 'Giọng văn (Tone)', en: 'Tone / Style' },
    FULL: { vi: 'Toàn bài', en: 'Full Post' },
    UNKNOWN: { vi: 'Chưa xác định', en: 'Unknown' },
  };
  return labels[target][lang];
}

// ============================================
// Response Parsing
// ============================================

/**
 * Parsed response from LLM
 */
export interface ParsedAnswerResponse {
  mode: AnswerTaskType | null;
  target: AnswerTarget | null;
  patch: string | null;
  content: string;
  isValid: boolean;
}

/**
 * Parse Answer Engine response from LLM output
 *
 * @param text - Raw LLM output
 * @returns Parsed response with mode, target, patch, and content
 */
export function parseAnswerEngineResponse(text: string): ParsedAnswerResponse {
  const result: ParsedAnswerResponse = {
    mode: null,
    target: null,
    patch: null,
    content: text,
    isValid: false,
  };

  // Try to extract MODE line
  const modeMatch = text.match(/^MODE:\s*(QA|EDIT_PATCH|REWRITE_UPGRADE|CREATE)\s*$/im);
  if (modeMatch) {
    result.mode = modeMatch[1] as AnswerTaskType;
    result.isValid = true;
  }

  // For EDIT_PATCH, extract TARGET and PATCH
  if (result.mode === 'EDIT_PATCH') {
    const targetMatch = text.match(/^TARGET:\s*(HOOK|BODY|CTA|TONE|FULL)\s*$/im);
    if (targetMatch) {
      result.target = targetMatch[1] as AnswerTarget;
    }

    // Extract PATCH content (everything after PATCH: until end or next marker)
    const patchMatch = text.match(/^PATCH:\s*\n?([\s\S]*?)(?=\n\[|$)/im);
    if (patchMatch) {
      result.patch = patchMatch[1].trim();
    }
  }

  // Extract main content (remove mode/target/patch markers)
  let content = text;
  content = content.replace(/^MODE:\s*(QA|EDIT_PATCH|REWRITE_UPGRADE|CREATE)\s*\n?/im, '');
  content = content.replace(/^TARGET:\s*(HOOK|BODY|CTA|TONE|FULL)\s*\n?/im, '');
  content = content.replace(/^PATCH:\s*\n?/im, '');
  result.content = content.trim();

  return result;
}

// ============================================
// Debug Helpers
// ============================================

/**
 * Get debug summary of Answer Engine decision
 */
export function getAnswerEngineDebugSummary(
  taskType: AnswerTaskType,
  target: AnswerTarget,
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
): string {
  return `AnswerEngine: ${taskType}${target !== 'UNKNOWN' ? `:${target}` : ''} [${confidence}]`;
}
