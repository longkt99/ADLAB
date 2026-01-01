// ============================================
// STEP 16: Editorial Operation Prompt Formatter
// ============================================
// Pure helper that formats editorial constraints into
// a text block for injection into the LLM system prompt.
//
// INVARIANTS:
// - No LLM calls (pure formatting only)
// - No routing changes
// - No persistence
// - No side effects
// ============================================

// ============================================
// Types
// ============================================

/**
 * Editorial operation types - from lightest to heaviest
 */
export type EditorialOpType =
  | 'MICRO_POLISH'      // Word-level fixes (typos, minor wording)
  | 'FLOW_SMOOTHING'    // Sentence transitions, flow improvements
  | 'CLARITY_IMPROVE'   // Clarity without structure changes
  | 'TRIM'              // Shorten content
  | 'SECTION_REWRITE'   // Rewrite specific section(s)
  | 'BODY_REWRITE'      // Rewrite body, preserve hook/CTA
  | 'FULL_REWRITE';     // Complete rewrite

/**
 * Editorial scope - how much can change
 */
export type EditorialScope =
  | 'WORDING_ONLY'      // Only word-level changes
  | 'SENTENCE_LEVEL'    // Up to sentence restructuring
  | 'PARAGRAPH_LEVEL'   // Paragraph can be reworked
  | 'SECTION_LEVEL'     // Sections can be reorganized
  | 'FULL';             // Everything can change

/**
 * Editorial operation payload
 * Describes the permitted editing scope and constraints
 */
export interface EditorialOp {
  /** The type of operation */
  op: EditorialOpType;

  /** How much can be modified */
  scope: EditorialScope;

  /** Constraints that MUST be followed */
  hardConstraints: string[];

  /** Guidance that SHOULD be followed if possible */
  softConstraints: string[];

  /** Human-readable reason for the operation */
  reason?: string;
}

// ============================================
// Operation Labels
// ============================================

const OP_LABELS: Record<EditorialOpType, { vi: string; en: string }> = {
  MICRO_POLISH: { vi: 'Chỉnh sửa nhẹ', en: 'Micro Polish' },
  FLOW_SMOOTHING: { vi: 'Mượt mà hơn', en: 'Flow Smoothing' },
  CLARITY_IMPROVE: { vi: 'Rõ ràng hơn', en: 'Clarity Improvement' },
  TRIM: { vi: 'Rút gọn', en: 'Trim' },
  SECTION_REWRITE: { vi: 'Viết lại đoạn', en: 'Section Rewrite' },
  BODY_REWRITE: { vi: 'Viết lại nội dung', en: 'Body Rewrite' },
  FULL_REWRITE: { vi: 'Viết lại hoàn toàn', en: 'Full Rewrite' },
};

const SCOPE_LABELS: Record<EditorialScope, { vi: string; en: string }> = {
  WORDING_ONLY: { vi: 'Chỉ từ ngữ', en: 'Wording only' },
  SENTENCE_LEVEL: { vi: 'Câu văn', en: 'Sentence level' },
  PARAGRAPH_LEVEL: { vi: 'Đoạn văn', en: 'Paragraph level' },
  SECTION_LEVEL: { vi: 'Phần', en: 'Section level' },
  FULL: { vi: 'Toàn bộ', en: 'Full' },
};

// ============================================
// Operation Weight (for Edit Guard)
// ============================================

/**
 * Get the "heaviness" weight of an operation.
 * Higher = more aggressive change.
 */
export function getOperationWeight(op: EditorialOpType): number {
  const weights: Record<EditorialOpType, number> = {
    MICRO_POLISH: 1,
    FLOW_SMOOTHING: 2,
    CLARITY_IMPROVE: 2,
    TRIM: 3,
    SECTION_REWRITE: 4,
    BODY_REWRITE: 5,
    FULL_REWRITE: 6,
  };
  return weights[op];
}

/**
 * Get the "heaviness" weight of a scope.
 */
export function getScopeWeight(scope: EditorialScope): number {
  const weights: Record<EditorialScope, number> = {
    WORDING_ONLY: 1,
    SENTENCE_LEVEL: 2,
    PARAGRAPH_LEVEL: 3,
    SECTION_LEVEL: 4,
    FULL: 5,
  };
  return weights[scope];
}

// ============================================
// Instruction Detection
// ============================================

/**
 * Detect the intended editorial operation from instruction text.
 * Pure heuristics - no LLM calls.
 */
export function detectEditorialOp(instructionText: string): EditorialOp | null {
  const normalized = instructionText.toLowerCase().normalize('NFC').trim();
  const length = normalized.length;

  // Very short instructions (≤15 chars) typically mean light edits
  const isVeryShort = length <= 15;
  // Short instructions (≤40 chars) typically mean moderate edits
  const isShort = length <= 40;

  // MICRO_POLISH patterns
  const microPolishPatterns = [
    /\b(sửa\s*lỗi|fix\s*typo|chính\s*tả)\b/i,
    /\b(nhẹ|nhẹ\s*thôi|chút\s*thôi)\b/i,
    /\b(minor|small\s*fix)\b/i,
  ];

  if (microPolishPatterns.some(p => p.test(normalized))) {
    return createMicroPolishOp();
  }

  // FLOW_SMOOTHING patterns
  const flowPatterns = [
    /\b(mượt|mượt\s*mà|smooth|flow)\b/i,
    /\b(liên\s*kết|transition)\b/i,
  ];

  if (flowPatterns.some(p => p.test(normalized))) {
    return createFlowSmoothingOp();
  }

  // CLARITY patterns
  const clarityPatterns = [
    /\b(rõ\s*ràng|clear|clarity)\b/i,
    /\b(dễ\s*hiểu|easier\s*to\s*understand)\b/i,
  ];

  if (clarityPatterns.some(p => p.test(normalized))) {
    return createClarityOp();
  }

  // TRIM patterns
  const trimPatterns = [
    /\b(ngắn\s*hơn|ngắn\s*lại|rút\s*gọn|shorter|trim|condense)\b/i,
    /\b(bớt|giảm|less)\b/i,
  ];

  if (trimPatterns.some(p => p.test(normalized))) {
    return createTrimOp();
  }

  // FULL_REWRITE patterns
  const fullRewritePatterns = [
    /\b(viết\s*lại\s*hoàn\s*toàn|rewrite\s*completely)\b/i,
    /\b(làm\s*lại\s*từ\s*đầu|start\s*over)\b/i,
    /\b(khác\s*hoàn\s*toàn|completely\s*different)\b/i,
  ];

  if (fullRewritePatterns.some(p => p.test(normalized))) {
    return createFullRewriteOp();
  }

  // BODY_REWRITE patterns
  const bodyRewritePatterns = [
    /\b(viết\s*lại\s*nội\s*dung|rewrite\s*body)\b/i,
    /\b(thay\s*đổi\s*nội\s*dung|change\s*content)\b/i,
  ];

  if (bodyRewritePatterns.some(p => p.test(normalized))) {
    return createBodyRewriteOp();
  }

  // Generic "viết lại" / "hay hơn" / "tốt hơn" → depends on length
  const genericImprovePatterns = [
    /\b(viết\s*lại|rewrite)\b/i,
    /\b(hay\s*hơn|better)\b/i,
    /\b(tốt\s*hơn|improve)\b/i,
    /\b(cải\s*thiện|enhance)\b/i,
  ];

  if (genericImprovePatterns.some(p => p.test(normalized))) {
    if (isVeryShort) {
      // Very short "viết lại" → assume light polish
      return createFlowSmoothingOp();
    } else if (isShort) {
      // Short "viết lại hay hơn" → section level
      return createSectionRewriteOp();
    } else {
      // Longer instruction → let AI decide within body scope
      return createBodyRewriteOp();
    }
  }

  // Default for ambiguous short instructions → assume light edits
  if (isVeryShort) {
    return createMicroPolishOp();
  }

  // No clear pattern detected
  return null;
}

// ============================================
// Op Factories
// ============================================

function createMicroPolishOp(): EditorialOp {
  return {
    op: 'MICRO_POLISH',
    scope: 'WORDING_ONLY',
    hardConstraints: [
      'Do NOT rewrite entire sentences',
      'Do NOT change paragraph structure',
      'Do NOT alter meaning',
      'Preserve all key entities (names, numbers, brands)',
    ],
    softConstraints: [
      'Fix typos and grammatical errors',
      'Improve word choice where awkward',
      'Keep changes minimal and targeted',
    ],
    reason: 'User requested light polish',
  };
}

function createFlowSmoothingOp(): EditorialOp {
  return {
    op: 'FLOW_SMOOTHING',
    scope: 'SENTENCE_LEVEL',
    hardConstraints: [
      'Do NOT rewrite entire paragraphs',
      'Do NOT change the overall structure',
      'Do NOT alter the core message',
      'Preserve hook and CTA exactly',
    ],
    softConstraints: [
      'Improve transitions between sentences',
      'Smooth awkward phrasing',
      'Maintain consistent tone',
    ],
    reason: 'User requested flow improvement',
  };
}

function createClarityOp(): EditorialOp {
  return {
    op: 'CLARITY_IMPROVE',
    scope: 'SENTENCE_LEVEL',
    hardConstraints: [
      'Do NOT change paragraph structure',
      'Do NOT alter the core message',
      'Preserve all factual content',
      'Keep hook and CTA intact',
    ],
    softConstraints: [
      'Simplify complex sentences',
      'Remove ambiguity',
      'Make points more direct',
    ],
    reason: 'User requested clarity improvement',
  };
}

function createTrimOp(): EditorialOp {
  return {
    op: 'TRIM',
    scope: 'PARAGRAPH_LEVEL',
    hardConstraints: [
      'Do NOT remove key information',
      'Do NOT change the core message',
      'Preserve all critical entities',
      'Keep hook and CTA intact',
    ],
    softConstraints: [
      'Remove redundant words and phrases',
      'Condense verbose sections',
      'Maintain readability',
    ],
    reason: 'User requested shorter content',
  };
}

function createSectionRewriteOp(): EditorialOp {
  return {
    op: 'SECTION_REWRITE',
    scope: 'SECTION_LEVEL',
    hardConstraints: [
      'Preserve the overall topic',
      'Keep critical entities',
      'Maintain the same tone',
    ],
    softConstraints: [
      'Improve specific sections as needed',
      'Enhance clarity and flow',
      'Hook and CTA can be improved but not replaced',
    ],
    reason: 'User requested section improvement',
  };
}

function createBodyRewriteOp(): EditorialOp {
  return {
    op: 'BODY_REWRITE',
    scope: 'SECTION_LEVEL',
    hardConstraints: [
      'Preserve the hook (opening)',
      'Preserve the CTA (call-to-action)',
      'Keep the same core topic',
      'Maintain critical entities',
    ],
    softConstraints: [
      'Body content can be substantially rewritten',
      'Improve structure and flow',
      'Enhance clarity',
    ],
    reason: 'User requested body rewrite',
  };
}

function createFullRewriteOp(): EditorialOp {
  return {
    op: 'FULL_REWRITE',
    scope: 'FULL',
    hardConstraints: [
      'Keep the same core topic',
      'Preserve critical entities (names, brands, numbers)',
    ],
    softConstraints: [
      'May completely restructure content',
      'May change tone if appropriate',
      'Should still address the same subject matter',
    ],
    reason: 'User requested full rewrite',
  };
}

// ============================================
// Prompt Formatter (Main Export)
// ============================================

/**
 * Format editorial operation constraints into a text block
 * for injection into the LLM system prompt.
 *
 * @param editorialOp - The editorial operation (optional)
 * @returns Formatted constraint block, or empty string if no op
 */
export function formatEditorialOpConstraints(editorialOp?: EditorialOp | null): string {
  if (!editorialOp) {
    return '';
  }

  const opLabel = OP_LABELS[editorialOp.op]?.en || editorialOp.op;
  const scopeLabel = SCOPE_LABELS[editorialOp.scope]?.en || editorialOp.scope;

  let block = '';

  block += '# EDITORIAL OPERATION MODE\n\n';
  block += `**Operation:** ${opLabel} (${scopeLabel})\n\n`;

  // Hard constraints
  if (editorialOp.hardConstraints.length > 0) {
    block += '## HARD CONSTRAINTS (MUST FOLLOW)\n';
    for (const constraint of editorialOp.hardConstraints) {
      block += `- ❌ ${constraint}\n`;
    }
    block += '\n';
  }

  // Soft constraints
  if (editorialOp.softConstraints.length > 0) {
    block += '## SOFT GUIDANCE (SHOULD FOLLOW)\n';
    for (const constraint of editorialOp.softConstraints) {
      block += `- ✅ ${constraint}\n`;
    }
    block += '\n';
  }

  // Conflict resolution
  block += '## CONFLICT RESOLUTION\n';
  block += 'If user request conflicts with HARD CONSTRAINTS, briefly ask for clarification.\n';
  block += 'Prioritize HARD CONSTRAINTS over user convenience.\n\n';

  block += '---\n';

  return block;
}

/**
 * Get a human-readable label for the operation.
 */
export function getEditorialOpLabel(op: EditorialOpType, language: 'vi' | 'en' = 'vi'): string {
  return OP_LABELS[op]?.[language] || op;
}

/**
 * Get a human-readable label for the scope.
 */
export function getScopeLabel(scope: EditorialScope, language: 'vi' | 'en' = 'vi'): string {
  return SCOPE_LABELS[scope]?.[language] || scope;
}

// ============================================
// Debug Helper
// ============================================

/**
 * Get debug summary of editorial op
 */
export function getEditorialOpDebugSummary(editorialOp?: EditorialOp | null): string {
  if (!editorialOp) return 'No editorial op';

  return `${editorialOp.op}:${editorialOp.scope} [${editorialOp.hardConstraints.length}H/${editorialOp.softConstraints.length}S]`;
}
