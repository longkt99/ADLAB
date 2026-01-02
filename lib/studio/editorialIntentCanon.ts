// ============================================
// STEP 17: Editorial Intent Canon & Meaning Preservation
// ============================================
// Meta-layer that preserves the editorial INTENT of the active draft:
// - Goal, audience, tone label
// - Non-negotiables (anchors: address, phone, price/promo, USP)
// - Allowed edit types
// - Drift detection (CTA escalation, tone flip, missing anchors)
//
// INVARIANTS:
// - Pure types + helpers (no LLM calls)
// - No persistence (session-only state)
// - Deterministic heuristics (regex + simple rules)
// - Privacy-safe (no raw content logging)
// ============================================

// ============================================
// Types
// ============================================

/**
 * Anchor types that must be preserved across edits
 */
export type AnchorType = 'ADDRESS' | 'PHONE' | 'PRICE' | 'PROMO' | 'USP';

/**
 * Detected anchor in content
 */
export interface DetectedAnchor {
  type: AnchorType;
  value: string;
  /** Whether this anchor is critical (must not be removed) */
  critical: boolean;
}

/**
 * Intent tone label (broader than structural tone)
 */
export type IntentToneLabel =
  | 'premium'      // High-end, sophisticated
  | 'professional' // Business-appropriate
  | 'friendly'     // Warm, approachable
  | 'casual'       // Relaxed, conversational
  | 'genZ'         // Trendy, slang-heavy
  | 'salesy'       // Hard-sell, urgency-driven
  | 'neutral';     // Default

/**
 * CTA intensity level
 */
export type CTAIntensity = 'soft' | 'medium' | 'hard';

/**
 * Editorial Intent Canon - the meaning/intent layer
 */
export interface EditorialIntentCanon {
  /** Primary goal of the content */
  goal: string;

  /** Target audience description */
  audience: string;

  /** Detected tone label */
  toneLabel: IntentToneLabel;

  /** CTA intensity */
  ctaIntensity: CTAIntensity;

  /** Detected anchors that should be preserved */
  anchors: DetectedAnchor[];

  /** Allowed edit types for this content */
  allowedEdits: AllowedEditType[];

  /** Non-negotiables (things that must not change) */
  nonNegotiables: string[];

  /** Metadata */
  meta: {
    draftId: string;
    createdAt: number;
    updatedAt: number;
    language: 'vi' | 'en';
    platform?: string;
  };
}

/**
 * Types of edits allowed
 */
export type AllowedEditType =
  | 'POLISH'        // Word-level polish
  | 'FLOW'          // Sentence flow
  | 'CLARITY'       // Clarification
  | 'TRIM'          // Shortening
  | 'EXPAND'        // Adding detail
  | 'RESTRUCTURE';  // Reorganizing

/**
 * Intent drift types
 */
export type DriftType =
  | 'MISSING_ANCHOR'    // Critical anchor was removed
  | 'CTA_ESCALATION'    // CTA became more aggressive
  | 'TONE_FLIP'         // Tone changed significantly
  | 'HOOK_STYLE_SHIFT'  // Hook became sensationalist
  | 'AUDIENCE_MISMATCH' // Content no longer fits audience
  | 'GOAL_DRIFT';       // Content strayed from goal

/**
 * Drift signal detected in new text
 */
export interface DriftSignal {
  type: DriftType;
  description: string;
  severity: 'low' | 'medium' | 'high';
  /** Original value if applicable */
  originalValue?: string;
  /** New value if applicable */
  newValue?: string;
}

/**
 * Result of intent canon diff
 */
export interface IntentCanonDiff {
  /** Whether any drift was detected */
  hasDrift: boolean;
  /** All drift signals */
  signals: DriftSignal[];
  /** Missing anchors */
  missingAnchors: DetectedAnchor[];
  /** New anchors added */
  addedAnchors: DetectedAnchor[];
  /** Overall severity */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Guard action decision
 */
export type IntentGuardAction = 'ALLOW' | 'WARN' | 'BLOCK';

/**
 * Result of intent guard decision
 */
export interface IntentGuardDecision {
  action: IntentGuardAction;
  reasons: string[];
  severity: 'low' | 'medium' | 'high';
  /** Suggested user action */
  suggestion?: string;
}

/**
 * Context for building intent canon
 */
export interface IntentCanonContext {
  language: 'vi' | 'en';
  platform?: string;
  existingTone?: IntentToneLabel;
  existingGoal?: string;
  existingAudience?: string;
}

// ============================================
// Detection Patterns
// ============================================

// Address patterns (Vietnamese)
const ADDRESS_PATTERNS = [
  /(?:đ\/c|địa\s*chỉ|địa\s*điểm)\s*[:\-]?\s*(.{10,80})/gi,
  /(?:số\s+)?\d{1,4}\s+(?:đường|phố|ngõ|ngách|hẻm)\s+[^\n,]{5,50}/gi,
  /(?:quận|huyện|tp\.|thành\s*phố)\s+[^\n,]{3,30}/gi,
  /(?:tầng|lầu)\s*\d+[^\n,]{0,30}/gi,
];

// Phone patterns (Vietnamese)
const PHONE_PATTERNS = [
  /(?:0[1-9]\d{8,9})/g,                    // 0xxxxxxxxx or 0xxxxxxxxxx
  /(?:\+84\s*\d{9,10})/g,                  // +84xxxxxxxxx
  /(?:hotline|liên\s*hệ|đt|sđt)\s*[:\-]?\s*(0[1-9][\d\s\-\.]{8,12})/gi,
  /(?:zalo|viber)\s*[:\-]?\s*(0[1-9][\d\s\-\.]{8,12})/gi,
];

// Price/promo patterns
const PRICE_PATTERNS = [
  /\d+\s*(?:k|K|nghìn|ngàn|triệu|tr)\b/g,
  /\d{1,3}(?:\.\d{3})+\s*(?:đ|đồng|vnđ|vnd)/gi,
  /(?:giá|price)\s*[:\-]?\s*[\d\.,]+/gi,
];

const PROMO_PATTERNS = [
  /(?:giảm|sale|off)\s*\d+\s*%/gi,
  /(?:ưu\s*đãi|khuyến\s*mãi|khuyến\s*mại|promotion)/gi,
  /(?:combo|deal|flash\s*sale)/gi,
  /(?:free|miễn\s*phí|tặng\s*kèm)/gi,
  /(?:chỉ\s*còn|chỉ\s*từ|giá\s*sốc)/gi,
];

// CTA intensity patterns
const _SOFT_CTA_PATTERNS = [
  /(?:tìm\s*hiểu\s*thêm|xem\s*thêm|more\s*info)/gi,
  /(?:liên\s*hệ\s*để|contact\s*for)/gi,
  /(?:đừng\s*bỏ\s*lỡ|don't\s*miss)/gi,
];

const MEDIUM_CTA_PATTERNS = [
  /(?:inbox|dm|nhắn\s*tin)\s*(?:ngay|nhanh|liền)?/gi,
  /(?:đăng\s*ký|đặt\s*hàng|order)/gi,
  /(?:click|bấm|nhấn)\s*(?:vào|link|đây)/gi,
];

const HARD_CTA_PATTERNS = [
  /(?:chốt\s*đơn|mua\s*ngay|book\s*ngay)/gi,
  /(?:ưu\s*đãi\s*sốc|giá\s*sốc|deal\s*sốc)/gi,
  /(?:số\s*lượng\s*có\s*hạn|limited|chỉ\s*còn\s*\d+)/gi,
  /(?:hết\s*hàng|cháy\s*hàng|sold\s*out)/gi,
  /(?:mua\s*liền|order\s*liền|đặt\s*liền)/gi,
  /(?:nhanh\s*tay|nhanh\s*lên|gấp)/gi,
];

// Tone detection patterns
const PREMIUM_PATTERNS = [
  /(?:sang\s*trọng|cao\s*cấp|đẳng\s*cấp|luxury|premium)/gi,
  /(?:tinh\s*tế|thanh\s*lịch|elegant)/gi,
  /(?:exclusive|độc\s*quyền|limited\s*edition)/gi,
];

const PROFESSIONAL_PATTERNS = [
  /(?:chuyên\s*nghiệp|professional|uy\s*tín)/gi,
  /(?:kinh\s*nghiệm|experience|chất\s*lượng\s*cao)/gi,
  /(?:cam\s*kết|đảm\s*bảo|guarantee)/gi,
];

const GENZ_PATTERNS = [
  /(?:chill|vibe|aesthetic|slay|flex|real)/gi,
  /(?:gét\s*gô|xịn\s*xò|đỉnh\s*nóc|kịch\s*độc)/gi,
  /(?:sốc\s*xỉu|xỉu\s*up|đu\s*trend)/gi,
  /(?:auto|ét\s*o\s*ét|u\s*là\s*trời)/gi,
];

const SALESY_PATTERNS = [
  /(?:rẻ\s*nhất|rẻ\s*vô\s*địch|giá\s*tốt\s*nhất)/gi,
  /(?:đỉnh\s*của\s*chóp|bá\s*đạo|khủng)/gi,
  /(?:hot\s*hit|best\s*seller|bán\s*chạy)/gi,
  /(?:siêu\s*sale|mega\s*sale|big\s*sale)/gi,
  /(?:không\s*mua\s*là\s*tiếc|tiếc\s*gì\s*không)/gi,
];

// Sensationalist hook patterns
const SENSATIONALIST_HOOK_PATTERNS = [
  /^[🔥⚡💥🚨❗]{2,}/,                      // Multiple fire/alert emojis at start
  /(?:SỐC|SHOCK|NÓNG|HOT)(?:\s*!+|\s*:)/gi,
  /(?:KHÔNG\s*THỂ\s*TIN|KINH\s*HOÀNG|ĐIÊN\s*RỒ)/gi,
  /[A-ZÀÁẢÃẠ]{5,}/g,                       // All caps words
  /!{3,}/g,                                // Multiple exclamation marks
];

// ============================================
// Detection Functions
// ============================================

/**
 * Detect addresses in text
 */
function detectAddresses(text: string): DetectedAnchor[] {
  const anchors: DetectedAnchor[] = [];
  const seen = new Set<string>();

  for (const pattern of ADDRESS_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[1] || match[0];
      const normalized = value.trim().toLowerCase();
      if (!seen.has(normalized) && normalized.length >= 5) {
        seen.add(normalized);
        anchors.push({
          type: 'ADDRESS',
          value: value.trim(),
          critical: true,
        });
      }
    }
  }

  return anchors;
}

/**
 * Detect phone numbers in text
 */
function detectPhones(text: string): DetectedAnchor[] {
  const anchors: DetectedAnchor[] = [];
  const seen = new Set<string>();

  for (const pattern of PHONE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[1] || match[0];
      // Normalize: remove spaces, dots, dashes
      const normalized = value.replace(/[\s\-\.]/g, '');
      if (!seen.has(normalized) && /^(?:\+84|0)\d{9,10}$/.test(normalized)) {
        seen.add(normalized);
        anchors.push({
          type: 'PHONE',
          value: normalized,
          critical: true,
        });
      }
    }
  }

  return anchors;
}

/**
 * Detect prices in text
 */
function detectPrices(text: string): DetectedAnchor[] {
  const anchors: DetectedAnchor[] = [];
  const seen = new Set<string>();

  for (const pattern of PRICE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[0].trim();
      const normalized = value.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        anchors.push({
          type: 'PRICE',
          value,
          critical: true,
        });
      }
    }
  }

  return anchors;
}

/**
 * Detect promos in text
 */
function detectPromos(text: string): DetectedAnchor[] {
  const anchors: DetectedAnchor[] = [];
  const seen = new Set<string>();

  for (const pattern of PROMO_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[0].trim();
      const normalized = value.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        anchors.push({
          type: 'PROMO',
          value,
          critical: false, // Promos can change
        });
      }
    }
  }

  return anchors;
}

/**
 * Detect all anchors in text
 */
function detectAnchors(text: string): DetectedAnchor[] {
  return [
    ...detectAddresses(text),
    ...detectPhones(text),
    ...detectPrices(text),
    ...detectPromos(text),
  ];
}

/**
 * Detect CTA intensity
 */
function detectCTAIntensity(text: string): CTAIntensity {
  const hasHard = HARD_CTA_PATTERNS.some(p => p.test(text));
  if (hasHard) return 'hard';

  const hasMedium = MEDIUM_CTA_PATTERNS.some(p => p.test(text));
  if (hasMedium) return 'medium';

  return 'soft';
}

/**
 * Detect intent tone label
 */
function detectIntentTone(text: string): IntentToneLabel {
  const normalized = text.toLowerCase();

  // Check patterns in order of specificity
  if (PREMIUM_PATTERNS.some(p => p.test(normalized))) return 'premium';
  if (GENZ_PATTERNS.some(p => p.test(normalized))) return 'genZ';
  if (SALESY_PATTERNS.some(p => p.test(normalized))) return 'salesy';
  if (PROFESSIONAL_PATTERNS.some(p => p.test(normalized))) return 'professional';

  // Check for casual markers
  if (/\b(?:nè|nha|hen|nhé|ơi)\b/i.test(normalized)) return 'casual';
  if (/(?:bạn\s*thân|chào\s*bạn)/i.test(normalized)) return 'friendly';

  return 'neutral';
}

/**
 * Detect sensationalist hook style
 */
function hasSensationalistHook(text: string): boolean {
  // Check first 100 chars (hook area)
  const hookArea = text.substring(0, 100);
  return SENSATIONALIST_HOOK_PATTERNS.some(p => p.test(hookArea));
}

/**
 * Infer goal from content
 */
function inferGoal(text: string): string {
  const normalized = text.toLowerCase();

  if (/(?:bán|mua|order|đặt\s*hàng|giá)/i.test(normalized)) {
    return 'product_promotion';
  }
  if (/(?:tuyển|hiring|job|việc\s*làm)/i.test(normalized)) {
    return 'recruitment';
  }
  if (/(?:event|sự\s*kiện|workshop|hội\s*thảo)/i.test(normalized)) {
    return 'event_promotion';
  }
  if (/(?:tip|mẹo|hướng\s*dẫn|cách|how\s*to)/i.test(normalized)) {
    return 'educational';
  }
  if (/(?:chia\s*sẻ|story|câu\s*chuyện)/i.test(normalized)) {
    return 'storytelling';
  }

  return 'general_engagement';
}

/**
 * Infer audience from content
 */
function inferAudience(text: string): string {
  const normalized = text.toLowerCase();

  if (/(?:mẹ|bỉm\s*sữa|con\s*nhỏ|baby|trẻ\s*em)/i.test(normalized)) {
    return 'parents';
  }
  if (/(?:gen\s*z|tuổi\s*teen|học\s*sinh|sinh\s*viên)/i.test(normalized)) {
    return 'young_adults';
  }
  if (/(?:doanh\s*nghiệp|business|b2b|ceo|manager)/i.test(normalized)) {
    return 'business';
  }
  if (/(?:chị\s*em|phụ\s*nữ|beauty|làm\s*đẹp)/i.test(normalized)) {
    return 'women';
  }

  return 'general';
}

// ============================================
// Core Functions
// ============================================

/**
 * Build intent canon from draft text
 */
export function buildIntentCanonFromDraft(
  draftText: string,
  ctx: IntentCanonContext
): EditorialIntentCanon {
  const text = draftText.trim();

  // Detect anchors
  const anchors = detectAnchors(text);

  // Detect tone and CTA intensity
  const toneLabel = ctx.existingTone || detectIntentTone(text);
  const ctaIntensity = detectCTAIntensity(text);

  // Infer goal and audience
  const goal = ctx.existingGoal || inferGoal(text);
  const audience = ctx.existingAudience || inferAudience(text);

  // Determine allowed edits based on detected intent
  const allowedEdits: AllowedEditType[] = ['POLISH', 'FLOW', 'CLARITY'];
  if (ctaIntensity !== 'hard') {
    allowedEdits.push('TRIM');
  }

  // Build non-negotiables
  const nonNegotiables: string[] = [];
  const criticalAnchors = anchors.filter(a => a.critical);
  if (criticalAnchors.length > 0) {
    nonNegotiables.push(`Preserve ${criticalAnchors.length} critical anchors (phone/address/price)`);
  }
  if (toneLabel === 'premium') {
    nonNegotiables.push('Maintain premium/sophisticated tone');
  }
  if (toneLabel === 'professional') {
    nonNegotiables.push('Maintain professional tone');
  }

  return {
    goal,
    audience,
    toneLabel,
    ctaIntensity,
    anchors,
    allowedEdits,
    nonNegotiables,
    meta: {
      draftId: `intent_${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      language: ctx.language,
      platform: ctx.platform,
    },
  };
}

/**
 * Format intent canon for LLM prompt injection
 * Returns a short block (~10 lines max)
 */
export function formatIntentCanonForPrompt(
  canon: EditorialIntentCanon,
  lang: 'vi' | 'en' = 'vi'
): string {
  const lines: string[] = [];

  if (lang === 'vi') {
    lines.push('# ĐỊNH HƯỚNG NỘI DUNG (KHÔNG ĐƯỢC THAY ĐỔI)');
    lines.push(`- Mục tiêu: ${getGoalLabel(canon.goal, 'vi')}`);
    lines.push(`- Đối tượng: ${getAudienceLabel(canon.audience, 'vi')}`);
    lines.push(`- Phong cách: ${getToneLabelVi(canon.toneLabel)}`);

    if (canon.anchors.length > 0) {
      const critical = canon.anchors.filter(a => a.critical);
      if (critical.length > 0) {
        lines.push(`- GIỮ NGUYÊN: ${critical.map(a => `${a.type}:${a.value.substring(0, 20)}`).join(', ')}`);
      }
    }

    if (canon.nonNegotiables.length > 0) {
      lines.push(`- Yêu cầu bắt buộc: ${canon.nonNegotiables.join('; ')}`);
    }

    lines.push('---');
  } else {
    lines.push('# CONTENT DIRECTION (DO NOT CHANGE)');
    lines.push(`- Goal: ${getGoalLabel(canon.goal, 'en')}`);
    lines.push(`- Audience: ${getAudienceLabel(canon.audience, 'en')}`);
    lines.push(`- Style: ${getToneLabelEn(canon.toneLabel)}`);

    if (canon.anchors.length > 0) {
      const critical = canon.anchors.filter(a => a.critical);
      if (critical.length > 0) {
        lines.push(`- PRESERVE: ${critical.map(a => `${a.type}:${a.value.substring(0, 20)}`).join(', ')}`);
      }
    }

    if (canon.nonNegotiables.length > 0) {
      lines.push(`- Requirements: ${canon.nonNegotiables.join('; ')}`);
    }

    lines.push('---');
  }

  return lines.join('\n');
}

/**
 * Compute intent canon diff between canon and new text
 */
export function computeIntentCanonDiff(
  canon: EditorialIntentCanon,
  newText: string
): IntentCanonDiff {
  const signals: DriftSignal[] = [];
  const text = newText.trim();

  // Detect anchors in new text
  const newAnchors = detectAnchors(text);

  // Check for missing critical anchors
  const missingAnchors: DetectedAnchor[] = [];
  for (const anchor of canon.anchors) {
    if (!anchor.critical) continue;

    const found = newAnchors.some(na =>
      na.type === anchor.type &&
      normalizeAnchorValue(na.value) === normalizeAnchorValue(anchor.value)
    );

    if (!found) {
      missingAnchors.push(anchor);
      signals.push({
        type: 'MISSING_ANCHOR',
        description: `Missing ${anchor.type}: ${anchor.value}`,
        severity: 'high',
        originalValue: anchor.value,
      });
    }
  }

  // Check for added anchors
  const addedAnchors: DetectedAnchor[] = [];
  for (const newAnchor of newAnchors) {
    const existed = canon.anchors.some(a =>
      a.type === newAnchor.type &&
      normalizeAnchorValue(a.value) === normalizeAnchorValue(newAnchor.value)
    );
    if (!existed) {
      addedAnchors.push(newAnchor);
    }
  }

  // Check CTA escalation
  const newCTAIntensity = detectCTAIntensity(text);
  if (isCTAEscalation(canon.ctaIntensity, newCTAIntensity)) {
    signals.push({
      type: 'CTA_ESCALATION',
      description: `CTA escalated from ${canon.ctaIntensity} to ${newCTAIntensity}`,
      severity: 'medium',
      originalValue: canon.ctaIntensity,
      newValue: newCTAIntensity,
    });
  }

  // Check tone flip
  const newTone = detectIntentTone(text);
  if (isToneFlip(canon.toneLabel, newTone)) {
    signals.push({
      type: 'TONE_FLIP',
      description: `Tone shifted from ${canon.toneLabel} to ${newTone}`,
      severity: isSevereToneFlip(canon.toneLabel, newTone) ? 'high' : 'medium',
      originalValue: canon.toneLabel,
      newValue: newTone,
    });
  }

  // Check hook style shift
  // We infer original wasn't sensationalist if tone was premium/professional
  const originalLikelyNotSensationalist =
    canon.toneLabel === 'premium' || canon.toneLabel === 'professional';
  const newHasSensationalist = hasSensationalistHook(text);
  if (originalLikelyNotSensationalist && newHasSensationalist) {
    signals.push({
      type: 'HOOK_STYLE_SHIFT',
      description: 'Hook became sensationalist (emojis, caps, urgency)',
      severity: canon.toneLabel === 'premium' ? 'high' : 'medium',
    });
  }

  // Calculate overall severity
  let severity: 'low' | 'medium' | 'high' = 'low';
  if (signals.some(s => s.severity === 'high')) {
    severity = 'high';
  } else if (signals.some(s => s.severity === 'medium')) {
    severity = 'medium';
  }

  return {
    hasDrift: signals.length > 0,
    signals,
    missingAnchors,
    addedAnchors,
    severity,
  };
}

/**
 * Decide what action to take based on diff
 */
export function decideIntentCanonAction(
  diff: IntentCanonDiff,
  opWeight: number // From editorialOpPrompt.getOperationWeight()
): IntentGuardDecision {
  const reasons: string[] = [];

  // No drift = allow
  if (!diff.hasDrift) {
    return {
      action: 'ALLOW',
      reasons: ['No intent drift detected'],
      severity: 'low',
    };
  }

  // Collect reasons
  for (const signal of diff.signals) {
    reasons.push(signal.description);
  }

  // Decide based on severity and operation weight
  // Light ops (weight <= 2) are stricter
  // Heavy ops (weight >= 5) are more permissive

  if (diff.severity === 'high') {
    // High severity always blocks for light edits
    if (opWeight <= 2) {
      return {
        action: 'BLOCK',
        reasons,
        severity: 'high',
        suggestion: 'This is a significant drift from the original intent. Review before applying.',
      };
    }
    // For heavier edits, still block if critical anchors missing
    if (diff.missingAnchors.length > 0) {
      return {
        action: 'BLOCK',
        reasons,
        severity: 'high',
        suggestion: 'Critical information (phone/address/price) would be lost.',
      };
    }
    return {
      action: 'WARN',
      reasons,
      severity: 'high',
    };
  }

  if (diff.severity === 'medium') {
    // Medium severity: block for very light edits, warn otherwise
    if (opWeight <= 1) {
      return {
        action: 'BLOCK',
        reasons,
        severity: 'medium',
        suggestion: 'The edit scope was meant to be minimal but significant changes were made.',
      };
    }
    return {
      action: 'WARN',
      reasons,
      severity: 'medium',
    };
  }

  // Low severity: always allow
  return {
    action: 'ALLOW',
    reasons,
    severity: 'low',
  };
}

// ============================================
// Helper Functions
// ============================================

function normalizeAnchorValue(value: string): string {
  return value.toLowerCase().replace(/[\s\-\.]/g, '');
}

function isCTAEscalation(original: CTAIntensity, newIntensity: CTAIntensity): boolean {
  const order: CTAIntensity[] = ['soft', 'medium', 'hard'];
  return order.indexOf(newIntensity) > order.indexOf(original);
}

function isToneFlip(original: IntentToneLabel, newTone: IntentToneLabel): boolean {
  // Premium/professional flipping to salesy/genZ is a flip
  const premium = ['premium', 'professional'];
  const casual = ['salesy', 'genZ'];

  if (premium.includes(original) && casual.includes(newTone)) return true;
  if (casual.includes(original) && premium.includes(newTone)) return true;

  return false;
}

function isSevereToneFlip(original: IntentToneLabel, newTone: IntentToneLabel): boolean {
  // Premium to salesy is severe
  if (original === 'premium' && newTone === 'salesy') return true;
  // Professional to genZ is severe
  if (original === 'professional' && newTone === 'genZ') return true;

  return false;
}

function getGoalLabel(goal: string, lang: 'vi' | 'en'): string {
  const labels: Record<string, { vi: string; en: string }> = {
    product_promotion: { vi: 'Quảng bá sản phẩm', en: 'Product promotion' },
    recruitment: { vi: 'Tuyển dụng', en: 'Recruitment' },
    event_promotion: { vi: 'Quảng bá sự kiện', en: 'Event promotion' },
    educational: { vi: 'Giáo dục/Chia sẻ kiến thức', en: 'Educational' },
    storytelling: { vi: 'Kể chuyện', en: 'Storytelling' },
    general_engagement: { vi: 'Tương tác chung', en: 'General engagement' },
  };
  return labels[goal]?.[lang] || goal;
}

function getAudienceLabel(audience: string, lang: 'vi' | 'en'): string {
  const labels: Record<string, { vi: string; en: string }> = {
    parents: { vi: 'Phụ huynh', en: 'Parents' },
    young_adults: { vi: 'Giới trẻ', en: 'Young adults' },
    business: { vi: 'Doanh nghiệp', en: 'Business' },
    women: { vi: 'Phụ nữ', en: 'Women' },
    general: { vi: 'Đại chúng', en: 'General' },
  };
  return labels[audience]?.[lang] || audience;
}

function getToneLabelVi(tone: IntentToneLabel): string {
  const labels: Record<IntentToneLabel, string> = {
    premium: 'Cao cấp/Sang trọng',
    professional: 'Chuyên nghiệp',
    friendly: 'Thân thiện',
    casual: 'Thoải mái',
    genZ: 'Trẻ trung/GenZ',
    salesy: 'Bán hàng mạnh',
    neutral: 'Trung tính',
  };
  return labels[tone];
}

function getToneLabelEn(tone: IntentToneLabel): string {
  const labels: Record<IntentToneLabel, string> = {
    premium: 'Premium/Sophisticated',
    professional: 'Professional',
    friendly: 'Friendly',
    casual: 'Casual',
    genZ: 'GenZ/Trendy',
    salesy: 'Hard-sell',
    neutral: 'Neutral',
  };
  return labels[tone];
}

// ============================================
// Debug Helpers
// ============================================

/**
 * Get debug summary of intent canon
 */
export function getIntentCanonDebugSummary(canon: EditorialIntentCanon): string {
  const anchorCount = canon.anchors.length;
  const criticalCount = canon.anchors.filter(a => a.critical).length;
  return `Intent[${canon.toneLabel}/${canon.ctaIntensity}] Anchors:${criticalCount}/${anchorCount} Goal:${canon.goal}`;
}

/**
 * Get debug summary of diff
 */
export function getIntentDiffDebugSummary(diff: IntentCanonDiff): string {
  if (!diff.hasDrift) return 'No drift';
  return `Drift[${diff.severity}] ${diff.signals.map(s => s.type).join(',')} Missing:${diff.missingAnchors.length}`;
}
