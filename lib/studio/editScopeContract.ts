// ============================================
// STEP 19: Edit Scope Contract
// ============================================
// Defines the edit scope contract model for visible edit scope.
// User must clearly see what part will be edited (HOOK/BODY/CTA/TONE/FULL).
// Ambiguous instructions are gated until user picks a scope.
//
// INVARIANTS:
// - Pure functions, no React, no side effects
// - Integrates with STEP 15 canon locks
// - Integrates with STEP 16 editorial ops
// - No new LLM calls
// ============================================

import type { EditorialOpType } from './editorialOpPrompt';

// ============================================
// Types
// ============================================

/** Target section for editing */
export type EditTarget = 'HOOK' | 'BODY' | 'CTA' | 'TONE' | 'FULL';

/** How the scope decision was made */
export type ScopeDecisionSource = 'EXPLICIT_INSTRUCTION' | 'HEURISTIC' | 'USER_PICKED';

/** Confidence level for UI indication */
export type ScopeConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** Canon section type (aligned with STEP 15) */
export type CanonSection = 'HOOK' | 'BODY' | 'CTA';

/**
 * Edit Scope Contract - defines what will be edited and what is locked
 */
export interface EditScopeContract {
  /** Target section to edit */
  target: EditTarget;
  /** Sections that must NOT be changed */
  lockedSections: CanonSection[];
  /** Allowed editorial operations for this scope */
  allowedOps: EditorialOpType[];
  /** How this decision was made */
  source: ScopeDecisionSource;
  /** Human-readable reason (VN/EN) */
  reason: string;
  /** Confidence level for UI */
  confidence: ScopeConfidence;
}

/**
 * Result of detecting edit target from instruction
 */
export interface EditTargetDetection {
  target?: EditTarget;
  confidence: ScopeConfidence;
  reason: string;
  source: ScopeDecisionSource;
}

/**
 * Gate decision for scope picking
 */
export interface ScopeGate {
  /** If true, must show modal for user to pick scope */
  requiresUserPick: boolean;
  /** Suggested contract if user doesn't pick */
  suggested?: EditScopeContract;
}

// ============================================
// Detection Patterns
// ============================================

interface PatternMatch {
  patterns: RegExp[];
  target: EditTarget;
}

/** Vietnamese patterns for explicit section targeting */
const VI_PATTERNS: PatternMatch[] = [
  // HOOK patterns
  {
    target: 'HOOK',
    patterns: [
      /\bhook\b/i,
      /\bmở\s*bài\b/i,
      /\bphần\s*mở\b/i,
      /\bcâu\s*mở\b/i,
      /\btitle\b/i,
      /\btiêu\s*đề\b/i,
      /\bdòng\s*đầu\b/i,
      /\bcâu\s*đầu\b/i,
      /\bđổi\s*hook\b/i,
      /\bviết\s*lại\s*hook\b/i,
      /\bhook\s*khác\b/i,
      /\bhook\s*mới\b/i,
    ],
  },
  // CTA patterns
  {
    target: 'CTA',
    patterns: [
      /\bcta\b/i,
      /\bcall\s*to\s*action\b/i,
      /\bkêu\s*gọi\b/i,
      /\bhành\s*động\b/i,
      /\bchốt\s*đơn\b/i,
      /\bliên\s*hệ\b/i,
      /\bđặt\s*hàng\b/i,
      /\bmua\s*ngay\b/i,
      /\bcta\s*mềm\b/i,
      /\bcta\s*mạnh\b/i,
      /\bthêm\s*cta\b/i,
      /\bđổi\s*cta\b/i,
    ],
  },
  // BODY patterns
  {
    target: 'BODY',
    patterns: [
      /\bbody\b/i,
      /\bthân\s*bài\b/i,
      /\bphần\s*thân\b/i,
      /\bnội\s*dung\s*chính\b/i,
      /\bđoạn\s*giữa\b/i,
      /\bbullet\b/i,
      /\bdanh\s*sách\b/i,
      /\bchi\s*tiết\b/i,
      /\bviết\s*lại\s*thân\b/i,
      /\bbody\s*ngắn\b/i,
      /\bthêm\s*bullet\b/i,
    ],
  },
  // TONE patterns
  {
    target: 'TONE',
    patterns: [
      /\btone\b/i,
      /\bgiọng\b/i,
      /\bphong\s*cách\b/i,
      /\bpremium\b/i,
      /\bsalesy\b/i,
      /\bgen\s*z\b/i,
      /\bchuyên\s*nghiệp\b/i,
      /\bbớt\s*salesy\b/i,
      /\bsang\s*hơn\b/i,
      /\btrẻ\s*trung\b/i,
      /\bchỉnh\s*tone\b/i,
      /\bđổi\s*giọng\b/i,
    ],
  },
  // FULL patterns
  {
    target: 'FULL',
    patterns: [
      /\btoàn\s*bài\b/i,
      /\bcả\s*bài\b/i,
      /\bviết\s*lại\s*toàn\b/i,
      /\blàm\s*lại\s*bài\b/i,
      /\bfull\b/i,
      /\bhoàn\s*toàn\b/i,
      /\btừ\s*đầu\b/i,
    ],
  },
];

/** English patterns for explicit section targeting */
const EN_PATTERNS: PatternMatch[] = [
  // HOOK patterns
  {
    target: 'HOOK',
    patterns: [
      /\bhook\b/i,
      /\bopening\b/i,
      /\bintro\b/i,
      /\bheadline\b/i,
      /\btitle\b/i,
      /\bfirst\s*line\b/i,
      /\brewrite\s*(the\s*)?hook\b/i,
      /\bchange\s*(the\s*)?hook\b/i,
    ],
  },
  // CTA patterns
  {
    target: 'CTA',
    patterns: [
      /\bcta\b/i,
      /\bcall\s*to\s*action\b/i,
      /\bclosing\b/i,
      /\bending\b/i,
      /\bsofter\s*cta\b/i,
      /\bstronger\s*cta\b/i,
      /\badd\s*(a\s*)?cta\b/i,
    ],
  },
  // BODY patterns
  {
    target: 'BODY',
    patterns: [
      /\bbody\b/i,
      /\bmain\s*content\b/i,
      /\bmiddle\b/i,
      /\bbullet\s*points?\b/i,
      /\bdetails\b/i,
      /\bshorter\s*body\b/i,
      /\bexpand\s*(the\s*)?body\b/i,
    ],
  },
  // TONE patterns
  {
    target: 'TONE',
    patterns: [
      /\btone\b/i,
      /\bstyle\b/i,
      /\bvoice\b/i,
      /\bpremium\b/i,
      /\bprofessional\b/i,
      /\bcasual\b/i,
      /\bless\s*salesy\b/i,
      /\bmore\s*formal\b/i,
    ],
  },
  // FULL patterns
  {
    target: 'FULL',
    patterns: [
      /\bfull\s*(post|content)?\b/i,
      /\bentire\b/i,
      /\bwhole\b/i,
      /\brewrite\s*everything\b/i,
      /\bfrom\s*scratch\b/i,
    ],
  },
];

/** Ambiguous instruction patterns (no specific section) */
const AMBIGUOUS_PATTERNS: RegExp[] = [
  /^viết\s*hay\s*hơn$/i,
  /^chỉnh\s*lại$/i,
  /^tối\s*ưu$/i,
  /^ngắn\s*hơn$/i,
  /^dài\s*hơn$/i,
  /^make\s*it\s*better$/i,
  /^improve$/i,
  /^fix\s*it$/i,
  /^shorter$/i,
  /^longer$/i,
  /^polish$/i,
  /^refine$/i,
];

/** Structured markers that indicate explicit scope */
const STRUCTURED_MARKERS: RegExp[] = [
  /\bHook:/i,
  /\bBody:/i,
  /\bCTA:/i,
  /\bTone:/i,
  /\bMở bài:/i,
  /\bThân bài:/i,
  /\bKết:/i,
];

// ============================================
// Core Functions
// ============================================

/**
 * Detect edit target from instruction text
 */
export function detectEditTargetFromInstruction(
  text: string,
  lang: 'vi' | 'en' = 'vi'
): EditTargetDetection {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      target: undefined,
      confidence: 'LOW',
      reason: lang === 'vi' ? 'Không có lệnh' : 'No instruction',
      source: 'HEURISTIC',
    };
  }

  // Check structured markers first (high confidence)
  for (const marker of STRUCTURED_MARKERS) {
    if (marker.test(trimmed)) {
      return {
        target: 'FULL', // User is providing structured input for multiple sections
        confidence: 'HIGH',
        reason: lang === 'vi' ? 'Lệnh có cấu trúc rõ ràng' : 'Structured instruction',
        source: 'EXPLICIT_INSTRUCTION',
      };
    }
  }

  // Check explicit patterns
  const patterns = lang === 'vi' ? VI_PATTERNS : EN_PATTERNS;

  for (const patternMatch of patterns) {
    for (const pattern of patternMatch.patterns) {
      if (pattern.test(trimmed)) {
        const targetLabels: Record<EditTarget, { vi: string; en: string }> = {
          HOOK: { vi: 'Chỉnh hook', en: 'Edit hook' },
          BODY: { vi: 'Chỉnh thân bài', en: 'Edit body' },
          CTA: { vi: 'Chỉnh CTA', en: 'Edit CTA' },
          TONE: { vi: 'Chỉnh tone', en: 'Edit tone' },
          FULL: { vi: 'Chỉnh toàn bài', en: 'Edit full post' },
        };

        return {
          target: patternMatch.target,
          confidence: 'HIGH',
          reason: targetLabels[patternMatch.target][lang],
          source: 'EXPLICIT_INSTRUCTION',
        };
      }
    }
  }

  // Check for ambiguous patterns
  for (const pattern of AMBIGUOUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        target: 'FULL',
        confidence: 'LOW',
        reason: lang === 'vi' ? 'Lệnh chung, cần chọn phạm vi' : 'General instruction, scope needed',
        source: 'HEURISTIC',
      };
    }
  }

  // Default: treat as FULL with MEDIUM confidence
  return {
    target: 'FULL',
    confidence: 'MEDIUM',
    reason: lang === 'vi' ? 'Mặc định chỉnh toàn bài' : 'Default to full edit',
    source: 'HEURISTIC',
  };
}

/**
 * Get locked sections based on edit target
 */
export function getLockedSectionsForTarget(target: EditTarget): CanonSection[] {
  switch (target) {
    case 'HOOK':
      return ['BODY', 'CTA'];
    case 'BODY':
      return ['HOOK', 'CTA'];
    case 'CTA':
      return ['HOOK', 'BODY'];
    case 'TONE':
      // Tone edit: preserve content structure but allow style changes
      // We lock content but allow tone adjustments
      return []; // No hard locks, but prompt will specify to keep content
    case 'FULL':
      return []; // No locks for full edit
    default:
      return [];
  }
}

/**
 * Get allowed editorial ops for target
 * Uses valid EditorialOpType values from editorialOpPrompt.ts:
 * 'MICRO_POLISH' | 'FLOW_SMOOTHING' | 'CLARITY_IMPROVE' | 'TRIM' | 'SECTION_REWRITE' | 'BODY_REWRITE' | 'FULL_REWRITE'
 */
export function getAllowedOpsForTarget(target: EditTarget): EditorialOpType[] {
  switch (target) {
    case 'HOOK':
      return ['MICRO_POLISH', 'TRIM', 'SECTION_REWRITE'];
    case 'BODY':
      return ['MICRO_POLISH', 'TRIM', 'FLOW_SMOOTHING', 'CLARITY_IMPROVE', 'BODY_REWRITE'];
    case 'CTA':
      return ['MICRO_POLISH', 'TRIM', 'SECTION_REWRITE'];
    case 'TONE':
      return ['MICRO_POLISH', 'FLOW_SMOOTHING', 'CLARITY_IMPROVE'];
    case 'FULL':
      return ['MICRO_POLISH', 'TRIM', 'FLOW_SMOOTHING', 'CLARITY_IMPROVE', 'BODY_REWRITE', 'FULL_REWRITE'];
    default:
      return ['MICRO_POLISH'];
  }
}

/**
 * Build edit scope contract from parameters
 */
export function buildEditScopeContract(params: {
  instructionText: string;
  lang: 'vi' | 'en';
  activeCanonLocks?: CanonSection[]; // From STEP 15
  detectedEditorialOp?: EditorialOpType; // From STEP 16
  hasActiveCanon?: boolean;
  userPickedTarget?: EditTarget; // If user already picked
}): EditScopeContract {
  const {
    instructionText,
    lang,
    activeCanonLocks = [],
    hasActiveCanon = false,
    userPickedTarget,
  } = params;

  // If user already picked, use that
  if (userPickedTarget) {
    const targetLocks = getLockedSectionsForTarget(userPickedTarget);
    const allLocks = [...new Set([...targetLocks, ...activeCanonLocks])];

    return {
      target: userPickedTarget,
      lockedSections: allLocks as CanonSection[],
      allowedOps: getAllowedOpsForTarget(userPickedTarget),
      source: 'USER_PICKED',
      reason: lang === 'vi' ? 'Người dùng đã chọn' : 'User selected',
      confidence: 'HIGH',
    };
  }

  // Detect from instruction
  const detection = detectEditTargetFromInstruction(instructionText, lang);

  // If no active canon, default to FULL with LOW confidence
  if (!hasActiveCanon) {
    return {
      target: 'FULL',
      lockedSections: [],
      allowedOps: getAllowedOpsForTarget('FULL'),
      source: 'HEURISTIC',
      reason: lang === 'vi' ? 'Chưa có nội dung gốc' : 'No existing content',
      confidence: 'LOW',
    };
  }

  const target = detection.target || 'FULL';
  const targetLocks = getLockedSectionsForTarget(target);

  // Union with canon locks from STEP 15
  const allLocks = [...new Set([...targetLocks, ...activeCanonLocks])];

  return {
    target,
    lockedSections: allLocks as CanonSection[],
    allowedOps: getAllowedOpsForTarget(target),
    source: detection.source,
    reason: detection.reason,
    confidence: detection.confidence,
  };
}

/**
 * Determine if scope picking is required before LLM call
 */
export function shouldGateForScopePick(
  instructionText: string,
  hasActiveCanon: boolean,
  lang: 'vi' | 'en' = 'vi'
): ScopeGate {
  const trimmed = instructionText.trim();

  // No gating if no instruction
  if (!trimmed) {
    return { requiresUserPick: false };
  }

  // No gating if instruction is long (> 140 chars) - treat as explicit enough
  if (trimmed.length > 140) {
    return { requiresUserPick: false };
  }

  // No gating if structured markers present
  for (const marker of STRUCTURED_MARKERS) {
    if (marker.test(trimmed)) {
      return { requiresUserPick: false };
    }
  }

  // No gating if no active canon (nothing to protect)
  if (!hasActiveCanon) {
    return { requiresUserPick: false };
  }

  // Detect target
  const detection = detectEditTargetFromInstruction(trimmed, lang);

  // If explicit target found with HIGH confidence, no gating
  if (detection.confidence === 'HIGH' && detection.source === 'EXPLICIT_INSTRUCTION') {
    return { requiresUserPick: false };
  }

  // If ambiguous (LOW confidence) and we have active canon, gate
  if (detection.confidence === 'LOW') {
    return {
      requiresUserPick: true,
      suggested: buildEditScopeContract({
        instructionText: trimmed,
        lang,
        hasActiveCanon: true,
      }),
    };
  }

  // MEDIUM confidence with active canon - also gate for safety
  if (detection.confidence === 'MEDIUM' && hasActiveCanon) {
    // Check if it's a known ambiguous pattern
    for (const pattern of AMBIGUOUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          requiresUserPick: true,
          suggested: buildEditScopeContract({
            instructionText: trimmed,
            lang,
            hasActiveCanon: true,
          }),
        };
      }
    }
  }

  // Default: no gating
  return { requiresUserPick: false };
}

// ============================================
// Prompt Formatting
// ============================================

/**
 * Format edit scope for injection into system prompt
 */
export function formatEditScopeForPrompt(
  contract: EditScopeContract,
  lang: 'vi' | 'en' = 'vi'
): string {
  const targetLabels: Record<EditTarget, { vi: string; en: string }> = {
    HOOK: { vi: 'Hook (mở bài)', en: 'Hook (opening)' },
    BODY: { vi: 'Body (thân bài)', en: 'Body (main content)' },
    CTA: { vi: 'CTA (kết)', en: 'CTA (closing)' },
    TONE: { vi: 'Tone (giọng văn)', en: 'Tone (voice/style)' },
    FULL: { vi: 'Toàn bài', en: 'Full post' },
  };

  const sectionLabels: Record<CanonSection, { vi: string; en: string }> = {
    HOOK: { vi: 'Hook', en: 'Hook' },
    BODY: { vi: 'Body', en: 'Body' },
    CTA: { vi: 'CTA', en: 'CTA' },
  };

  if (lang === 'vi') {
    let block = `PHẠM VI CHỈNH SỬA:
- Mục tiêu: ${targetLabels[contract.target].vi}`;

    if (contract.lockedSections.length > 0) {
      const lockedNames = contract.lockedSections.map(s => sectionLabels[s].vi).join(', ');
      block += `\n- KHÔNG ĐƯỢC thay đổi: ${lockedNames}`;
      block += '\n- Nếu có xung đột: giữ nguyên phần bị khóa';
    }

    if (contract.target === 'TONE') {
      block += '\n- Giữ nguyên nội dung, chỉ điều chỉnh giọng văn';
    }

    if (contract.reason) {
      block += `\n- Lý do: ${contract.reason}`;
    }

    return block;
  } else {
    let block = `EDIT SCOPE:
- Target: ${targetLabels[contract.target].en}`;

    if (contract.lockedSections.length > 0) {
      const lockedNames = contract.lockedSections.map(s => sectionLabels[s].en).join(', ');
      block += `\n- Do NOT change: ${lockedNames}`;
      block += '\n- If conflict: keep locked sections exactly unchanged';
    }

    if (contract.target === 'TONE') {
      block += '\n- Preserve content, only adjust voice/style';
    }

    if (contract.reason) {
      block += `\n- Reason: ${contract.reason}`;
    }

    return block;
  }
}

/**
 * Get UI label for edit target
 */
export function getEditTargetLabel(target: EditTarget, lang: 'vi' | 'en' = 'vi'): string {
  const labels: Record<EditTarget, { vi: string; en: string }> = {
    HOOK: { vi: 'Hook', en: 'Hook' },
    BODY: { vi: 'Thân bài', en: 'Body' },
    CTA: { vi: 'CTA', en: 'CTA' },
    TONE: { vi: 'Tone', en: 'Tone' },
    FULL: { vi: 'Toàn bài', en: 'Full' },
  };
  return labels[target][lang];
}

/**
 * Get debug summary for contract
 */
export function getEditScopeDebugSummary(contract: EditScopeContract): string {
  return `Scope:${contract.target}|Locked:${contract.lockedSections.join(',')||'none'}|Conf:${contract.confidence}|Src:${contract.source}`;
}
