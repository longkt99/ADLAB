// ============================================
// STEP 20: Edit Intent Normalizer
// ============================================
// A lightweight semantic bridge between raw user language
// and strict editor actions.
//
// PURPOSE:
// - Translates natural VN/EN edit language → canonical edit intent
// - Runs BEFORE STEP 19 EditScopeContract
// - Requires NO LLM CALL
// - Does NOT change routing
// - Does NOT bypass guards
// - Only clarifies what the user meant to do
//
// INVARIANTS:
// - Pure + testable
// - Heuristic + language-pattern based
// - Only runs for EDIT_IN_PLACE path
// - Outputs normalized intent metadata
// ============================================

import type { CanonSection } from './editorialCanon';

// ============================================
// Types
// ============================================

/**
 * Edit target - which section the user intends to modify
 */
export type EditIntentTarget = 'BODY' | 'HOOK' | 'CTA' | 'TONE' | 'FULL';

/**
 * Confidence level of the normalization
 */
export type NormalizerConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Normalized edit intent - output of the normalizer
 */
export interface NormalizedEditIntent {
  /** Always EDIT_IN_PLACE for this normalizer */
  action: 'EDIT_IN_PLACE';
  /** Target section to edit */
  target: EditIntentTarget;
  /** Confidence in the interpretation */
  confidence: NormalizerConfidence;
  /** Human-readable reason for the interpretation */
  reason: string;
  /** Debug: which pattern(s) matched */
  matchedPatterns?: string[];
}

/**
 * Canon lock state for context
 */
export interface CanonLockState {
  lockedSections: CanonSection[];
  hasActiveCanon: boolean;
}

/**
 * Context for normalization
 */
export interface NormalizerContext {
  /** Whether there's an active draft being edited */
  hasActiveDraft: boolean;
  /** Optional: current canon lock state from STEP 15 */
  canonLockState?: CanonLockState;
  /** Language hint (defaults to 'vi') */
  lang?: 'vi' | 'en';
}

// ============================================
// Pattern Definitions
// ============================================

interface PatternRule {
  /** Pattern to match */
  pattern: RegExp;
  /** Weight for confidence calculation */
  weight: number;
  /** What this pattern indicates */
  indicates: 'EDIT_INTENT' | 'NOT_CREATE' | 'TARGET_BODY' | 'TARGET_HOOK' | 'TARGET_CTA' | 'TARGET_TONE' | 'PRESERVE_REST';
  /** Debug label */
  label: string;
}

/**
 * Vietnamese patterns for edit intent detection
 * Higher weight = stronger signal
 *
 * NOTE: We use (?:^|\s) and (?:\s|$) instead of \b for Vietnamese
 * because \b doesn't work correctly with Vietnamese Unicode characters.
 */
const VI_EDIT_PATTERNS: PatternRule[] = [
  // Strong EDIT signals
  { pattern: /(?:^|\s)thêm(?:\s|$)/i, weight: 3, indicates: 'EDIT_INTENT', label: 'thêm' },
  { pattern: /(?:^|\s)bổ\s*sung(?:\s|$)/i, weight: 3, indicates: 'EDIT_INTENT', label: 'bổ sung' },
  { pattern: /(?:^|\s)ghi\s*thêm(?:\s|$)/i, weight: 3, indicates: 'EDIT_INTENT', label: 'ghi thêm' },
  { pattern: /(?:^|\s)chỉnh\s*(lại|sửa)?(?:\s|$)/i, weight: 2, indicates: 'EDIT_INTENT', label: 'chỉnh (lại)' },
  { pattern: /(?:^|\s)sửa\s*(giúp|lại|đi)?(?:\s|$)/i, weight: 2, indicates: 'EDIT_INTENT', label: 'sửa' },
  { pattern: /viết\s*lại\s*(đoạn|phần)/i, weight: 2, indicates: 'EDIT_INTENT', label: 'viết lại đoạn/phần' },
  { pattern: /(?:^|\s)cập\s*nhật(?:\s|$)/i, weight: 2, indicates: 'EDIT_INTENT', label: 'cập nhật' },
  { pattern: /(?:^|\s)thay\s*đổi(?:\s|$)/i, weight: 2, indicates: 'EDIT_INTENT', label: 'thay đổi' },
  { pattern: /(?:^|\s)đổi(?:\s|$)/i, weight: 2, indicates: 'EDIT_INTENT', label: 'đổi' },

  // NOT_CREATE signals (explicit user clarification)
  { pattern: /không\s*phải\s*viết\s*bài\s*mới/i, weight: 5, indicates: 'NOT_CREATE', label: 'không phải viết bài mới' },
  { pattern: /không\s*phải\s*tạo\s*mới/i, weight: 5, indicates: 'NOT_CREATE', label: 'không phải tạo mới' },
  { pattern: /(?:^|\s)ý\s*tôi\s*là/i, weight: 3, indicates: 'NOT_CREATE', label: 'ý tôi là' },
  { pattern: /(?:^|\s)tôi\s*bảo\s*bạn/i, weight: 2, indicates: 'NOT_CREATE', label: 'tôi bảo bạn' },
  { pattern: /chỉ\s*cần\s*(thêm|sửa|chỉnh)/i, weight: 4, indicates: 'NOT_CREATE', label: 'chỉ cần thêm/sửa' },

  // PRESERVE_REST signals
  { pattern: /giữ\s*nguyên/i, weight: 3, indicates: 'PRESERVE_REST', label: 'giữ nguyên' },
  { pattern: /không\s*đổi\s*(phần\s*)?(còn\s*lại|khác)/i, weight: 3, indicates: 'PRESERVE_REST', label: 'không đổi phần khác' },
  { pattern: /chỉ\s*sửa/i, weight: 3, indicates: 'PRESERVE_REST', label: 'chỉ sửa' },
  { pattern: /đừng\s*đổi/i, weight: 2, indicates: 'PRESERVE_REST', label: 'đừng đổi' },

  // Target: HOOK
  { pattern: /\bhook\b/i, weight: 4, indicates: 'TARGET_HOOK', label: 'hook' },
  { pattern: /mở\s*bài/i, weight: 4, indicates: 'TARGET_HOOK', label: 'mở bài' },
  { pattern: /phần\s*mở/i, weight: 3, indicates: 'TARGET_HOOK', label: 'phần mở' },
  { pattern: /câu\s*mở/i, weight: 3, indicates: 'TARGET_HOOK', label: 'câu mở' },
  { pattern: /tiêu\s*đề/i, weight: 3, indicates: 'TARGET_HOOK', label: 'tiêu đề' },
  { pattern: /dòng\s*đầu/i, weight: 3, indicates: 'TARGET_HOOK', label: 'dòng đầu' },

  // Target: CTA
  { pattern: /\bcta\b/i, weight: 4, indicates: 'TARGET_CTA', label: 'cta' },
  { pattern: /kết\s*bài/i, weight: 4, indicates: 'TARGET_CTA', label: 'kết bài' },
  { pattern: /phần\s*kết/i, weight: 3, indicates: 'TARGET_CTA', label: 'phần kết' },
  { pattern: /kêu\s*gọi/i, weight: 3, indicates: 'TARGET_CTA', label: 'kêu gọi' },
  { pattern: /\bcall\s*to\s*action\b/i, weight: 4, indicates: 'TARGET_CTA', label: 'call to action' },
  { pattern: /chốt\s*đơn/i, weight: 3, indicates: 'TARGET_CTA', label: 'chốt đơn' },

  // Target: TONE
  { pattern: /\btone\b/i, weight: 4, indicates: 'TARGET_TONE', label: 'tone' },
  { pattern: /(?:^|\s)giọng(?:\s|$)/i, weight: 3, indicates: 'TARGET_TONE', label: 'giọng' },
  { pattern: /văn\s*phong/i, weight: 3, indicates: 'TARGET_TONE', label: 'văn phong' },
  { pattern: /phong\s*cách/i, weight: 3, indicates: 'TARGET_TONE', label: 'phong cách' },
  { pattern: /sang\s*hơn/i, weight: 2, indicates: 'TARGET_TONE', label: 'sang hơn' },
  { pattern: /trẻ\s*trung/i, weight: 2, indicates: 'TARGET_TONE', label: 'trẻ trung' },
  { pattern: /\bsalesy\b/i, weight: 2, indicates: 'TARGET_TONE', label: 'salesy' },

  // Target: BODY (general content mentions)
  { pattern: /thân\s*bài/i, weight: 4, indicates: 'TARGET_BODY', label: 'thân bài' },
  { pattern: /\bbody\b/i, weight: 4, indicates: 'TARGET_BODY', label: 'body' },
  { pattern: /nội\s*dung/i, weight: 2, indicates: 'TARGET_BODY', label: 'nội dung' },
  { pattern: /thông\s*tin/i, weight: 2, indicates: 'TARGET_BODY', label: 'thông tin' },
  { pattern: /chi\s*tiết/i, weight: 2, indicates: 'TARGET_BODY', label: 'chi tiết' },
  { pattern: /phần\s*thân/i, weight: 3, indicates: 'TARGET_BODY', label: 'phần thân' },
  { pattern: /\bbullet\b/i, weight: 2, indicates: 'TARGET_BODY', label: 'bullet' },
];

/**
 * English patterns for edit intent detection
 */
const EN_EDIT_PATTERNS: PatternRule[] = [
  // Strong EDIT signals
  { pattern: /\badd\s*(more)?\b/i, weight: 3, indicates: 'EDIT_INTENT', label: 'add (more)' },
  { pattern: /\bupdate\b/i, weight: 3, indicates: 'EDIT_INTENT', label: 'update' },
  { pattern: /\bedit\b/i, weight: 2, indicates: 'EDIT_INTENT', label: 'edit' },
  { pattern: /\bmodify\b/i, weight: 2, indicates: 'EDIT_INTENT', label: 'modify' },
  { pattern: /\bchange\b/i, weight: 2, indicates: 'EDIT_INTENT', label: 'change' },
  { pattern: /\btweak\b/i, weight: 2, indicates: 'EDIT_INTENT', label: 'tweak' },
  { pattern: /\bfix\b/i, weight: 2, indicates: 'EDIT_INTENT', label: 'fix' },
  { pattern: /\binsert\b/i, weight: 2, indicates: 'EDIT_INTENT', label: 'insert' },
  { pattern: /\bappend\b/i, weight: 2, indicates: 'EDIT_INTENT', label: 'append' },

  // NOT_CREATE signals
  { pattern: /\bdon'?t\s*rewrite\b/i, weight: 5, indicates: 'NOT_CREATE', label: "don't rewrite" },
  { pattern: /\bdon'?t\s*create\s*new\b/i, weight: 5, indicates: 'NOT_CREATE', label: "don't create new" },
  { pattern: /\bnot\s*a\s*new\s*(post|content)\b/i, weight: 5, indicates: 'NOT_CREATE', label: 'not a new post' },
  { pattern: /\bjust\s*(update|edit|add)\b/i, weight: 4, indicates: 'NOT_CREATE', label: 'just update/edit/add' },
  { pattern: /\bonly\s*(edit|update|change)\b/i, weight: 4, indicates: 'NOT_CREATE', label: 'only edit' },
  { pattern: /\bi\s*(meant|said|want)\b/i, weight: 2, indicates: 'NOT_CREATE', label: 'i meant/said/want' },

  // PRESERVE_REST signals
  { pattern: /\bkeep\s*(the\s*)?rest\b/i, weight: 3, indicates: 'PRESERVE_REST', label: 'keep the rest' },
  { pattern: /\bleave\s*(the\s*)?(rest|others?)\b/i, weight: 3, indicates: 'PRESERVE_REST', label: 'leave the rest' },
  { pattern: /\bdon'?t\s*touch\b/i, weight: 3, indicates: 'PRESERVE_REST', label: "don't touch" },
  { pattern: /\bpreserve\b/i, weight: 2, indicates: 'PRESERVE_REST', label: 'preserve' },

  // Target: HOOK
  { pattern: /\bhook\b/i, weight: 4, indicates: 'TARGET_HOOK', label: 'hook' },
  { pattern: /\bopening\b/i, weight: 3, indicates: 'TARGET_HOOK', label: 'opening' },
  { pattern: /\bintro\b/i, weight: 3, indicates: 'TARGET_HOOK', label: 'intro' },
  { pattern: /\bheadline\b/i, weight: 3, indicates: 'TARGET_HOOK', label: 'headline' },
  { pattern: /\btitle\b/i, weight: 2, indicates: 'TARGET_HOOK', label: 'title' },
  { pattern: /\bfirst\s*line\b/i, weight: 3, indicates: 'TARGET_HOOK', label: 'first line' },

  // Target: CTA
  { pattern: /\bcta\b/i, weight: 4, indicates: 'TARGET_CTA', label: 'cta' },
  { pattern: /\bcall\s*to\s*action\b/i, weight: 4, indicates: 'TARGET_CTA', label: 'call to action' },
  { pattern: /\bclosing\b/i, weight: 3, indicates: 'TARGET_CTA', label: 'closing' },
  { pattern: /\bending\b/i, weight: 2, indicates: 'TARGET_CTA', label: 'ending' },
  { pattern: /\bconclusion\b/i, weight: 2, indicates: 'TARGET_CTA', label: 'conclusion' },

  // Target: TONE
  { pattern: /\btone\b/i, weight: 4, indicates: 'TARGET_TONE', label: 'tone' },
  { pattern: /\bstyle\b/i, weight: 2, indicates: 'TARGET_TONE', label: 'style' },
  { pattern: /\bvoice\b/i, weight: 2, indicates: 'TARGET_TONE', label: 'voice' },
  { pattern: /\bmore\s*(professional|casual|formal)\b/i, weight: 3, indicates: 'TARGET_TONE', label: 'more professional/casual' },

  // Target: BODY
  { pattern: /\bbody\b/i, weight: 4, indicates: 'TARGET_BODY', label: 'body' },
  { pattern: /\bmain\s*content\b/i, weight: 3, indicates: 'TARGET_BODY', label: 'main content' },
  { pattern: /\bmiddle\b/i, weight: 2, indicates: 'TARGET_BODY', label: 'middle' },
  { pattern: /\bdetails?\b/i, weight: 2, indicates: 'TARGET_BODY', label: 'details' },
  { pattern: /\binformation\b/i, weight: 2, indicates: 'TARGET_BODY', label: 'information' },
  { pattern: /\bcontent\b/i, weight: 1, indicates: 'TARGET_BODY', label: 'content' },
  { pattern: /\bbullet\s*points?\b/i, weight: 2, indicates: 'TARGET_BODY', label: 'bullet points' },
];

// ============================================
// Core Functions
// ============================================

/**
 * Match patterns against input text
 */
function matchPatterns(
  text: string,
  patterns: PatternRule[]
): { matches: PatternRule[]; totalWeight: number } {
  const matches: PatternRule[] = [];
  let totalWeight = 0;

  for (const rule of patterns) {
    if (rule.pattern.test(text)) {
      matches.push(rule);
      totalWeight += rule.weight;
    }
  }

  return { matches, totalWeight };
}

/**
 * Infer target from matched patterns
 */
function inferTarget(matches: PatternRule[]): { target: EditIntentTarget; confidence: NormalizerConfidence } {
  const targetScores: Record<EditIntentTarget, number> = {
    BODY: 0,
    HOOK: 0,
    CTA: 0,
    TONE: 0,
    FULL: 0,
  };

  for (const match of matches) {
    switch (match.indicates) {
      case 'TARGET_BODY':
        targetScores.BODY += match.weight;
        break;
      case 'TARGET_HOOK':
        targetScores.HOOK += match.weight;
        break;
      case 'TARGET_CTA':
        targetScores.CTA += match.weight;
        break;
      case 'TARGET_TONE':
        targetScores.TONE += match.weight;
        break;
    }
  }

  // Find highest scoring target
  let maxScore = 0;
  let bestTarget: EditIntentTarget = 'BODY'; // Default to BODY for general edits

  for (const [target, score] of Object.entries(targetScores) as [EditIntentTarget, number][]) {
    if (score > maxScore) {
      maxScore = score;
      bestTarget = target;
    }
  }

  // Determine confidence based on score
  let confidence: NormalizerConfidence;
  if (maxScore >= 4) {
    confidence = 'HIGH';
  } else if (maxScore >= 2) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  return { target: bestTarget, confidence };
}

/**
 * Normalize user's edit intent from natural language
 *
 * @param userInstruction - The raw user instruction text
 * @param ctx - Context including active draft state
 * @returns NormalizedEditIntent if edit intent detected, null otherwise
 */
export function normalizeEditIntent(
  userInstruction: string,
  ctx: NormalizerContext
): NormalizedEditIntent | null {
  // Require active draft for edit normalization
  if (!ctx.hasActiveDraft) {
    return null;
  }

  const text = userInstruction.trim();
  if (!text) {
    return null;
  }

  const lang = ctx.lang || 'vi';
  const patterns = lang === 'vi' ? VI_EDIT_PATTERNS : EN_EDIT_PATTERNS;

  // Match all patterns
  const { matches, totalWeight: _totalWeight } = matchPatterns(text, patterns);

  // No patterns matched - no edit intent detected
  if (matches.length === 0) {
    return null;
  }

  // Check for edit intent signals
  const hasEditIntent = matches.some(m =>
    m.indicates === 'EDIT_INTENT' ||
    m.indicates === 'NOT_CREATE' ||
    m.indicates === 'PRESERVE_REST'
  );

  // If no edit intent signals, only target mentions aren't enough
  // (e.g., user might be asking about hook, not editing it)
  if (!hasEditIntent) {
    return null;
  }

  // Check for explicit NOT_CREATE signals - these boost confidence
  const hasNotCreateSignal = matches.some(m => m.indicates === 'NOT_CREATE');
  const hasPreserveSignal = matches.some(m => m.indicates === 'PRESERVE_REST');

  // Infer target from matches
  const { target, confidence: baseConfidence } = inferTarget(matches);

  // Boost confidence for explicit clarification
  let finalConfidence = baseConfidence;
  if (hasNotCreateSignal) {
    finalConfidence = 'HIGH';
  } else if (hasPreserveSignal && baseConfidence === 'LOW') {
    finalConfidence = 'MEDIUM';
  }

  // Build reason string
  const matchedLabels = matches.map(m => m.label);
  let reason: string;

  if (lang === 'vi') {
    if (hasNotCreateSignal) {
      reason = 'Người dùng xác nhận muốn chỉnh sửa, không tạo mới';
    } else if (hasPreserveSignal) {
      reason = 'Người dùng muốn giữ nguyên phần khác';
    } else {
      reason = 'Phát hiện ý định chỉnh sửa từ ngữ cảnh';
    }
  } else {
    if (hasNotCreateSignal) {
      reason = 'User confirmed edit intent, not create';
    } else if (hasPreserveSignal) {
      reason = 'User wants to preserve other sections';
    } else {
      reason = 'Edit intent detected from context';
    }
  }

  return {
    action: 'EDIT_IN_PLACE',
    target,
    confidence: finalConfidence,
    reason,
    matchedPatterns: matchedLabels,
  };
}

/**
 * Check if instruction explicitly indicates NOT wanting to create new content
 * This is a quick check for the routing layer
 */
export function hasExplicitNotCreateSignal(
  userInstruction: string,
  lang: 'vi' | 'en' = 'vi'
): boolean {
  const patterns = lang === 'vi' ? VI_EDIT_PATTERNS : EN_EDIT_PATTERNS;
  const notCreatePatterns = patterns.filter(p => p.indicates === 'NOT_CREATE');

  return notCreatePatterns.some(p => p.pattern.test(userInstruction));
}

/**
 * Get debug summary of normalization for dev tools
 */
export function getNormalizerDebugSummary(
  result: NormalizedEditIntent | null,
  lang: 'vi' | 'en' = 'vi'
): string {
  if (!result) {
    return lang === 'vi'
      ? 'Không phát hiện ý định chỉnh sửa'
      : 'No edit intent detected';
  }

  const targetLabels: Record<EditIntentTarget, { vi: string; en: string }> = {
    BODY: { vi: 'Thân bài', en: 'Body' },
    HOOK: { vi: 'Mở bài', en: 'Hook' },
    CTA: { vi: 'CTA', en: 'CTA' },
    TONE: { vi: 'Tone', en: 'Tone' },
    FULL: { vi: 'Toàn bài', en: 'Full' },
  };

  const targetLabel = targetLabels[result.target][lang];

  if (lang === 'vi') {
    return `EDIT_IN_PLACE → ${targetLabel} (${result.confidence})`;
  } else {
    return `EDIT_IN_PLACE → ${targetLabel} (${result.confidence})`;
  }
}
