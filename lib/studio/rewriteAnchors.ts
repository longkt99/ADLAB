// ============================================
// STEP 22: Rewrite Anchors - Structural Output Guard
// ============================================
// Provides paragraph anchoring for REWRITE_UPGRADE mode.
// Anchors ensure the LLM preserves paragraph structure and order.
//
// INVARIANTS:
// - Anchors are ONLY applied to REWRITE_UPGRADE mode
// - Anchor format: <<P1>>, <<P2>>, etc.
// - Output MUST preserve all anchors in same order
// - Validation rejects output with missing/extra/reordered anchors
//
// ⚠️ SYSTEM INVARIANT (STEP 25)
// This module enforces structural preservation in REWRITE_UPGRADE.
// The anchor validation logic is critical for preventing paragraph
// merging, splitting, or reordering by the LLM.
// Do NOT modify anchor format, validation logic, or thresholds without:
// 1. Updating docs/system-invariants.md
// 2. Updating answerEngine.invariants.test.ts
// 3. Verifying all existing tests still pass
// ============================================

// ============================================
// Types
// ============================================

export interface AnchoredContent {
  /** Original content with anchors injected */
  anchoredText: string;
  /** List of anchor IDs in order */
  anchorIds: string[];
  /** Number of paragraphs */
  paragraphCount: number;
}

export interface AnchorValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Expected anchors */
  expected: string[];
  /** Found anchors */
  found: string[];
  /** Missing anchors */
  missing: string[];
  /** Extra anchors (not in source) */
  extra: string[];
  /** Whether order is preserved */
  orderPreserved: boolean;
}

// ============================================
// Constants
// ============================================

/** Anchor pattern: <<P1>>, <<P2>>, etc. */
const ANCHOR_PREFIX = '<<P';
const ANCHOR_SUFFIX = '>>';
const ANCHOR_REGEX = /<<P(\d+)>>/g;

/** Minimum paragraph length to be anchored (skip empty/whitespace) */
const MIN_PARAGRAPH_LENGTH = 10;

// ============================================
// Anchor Injection
// ============================================

/**
 * Split content into paragraphs for anchoring.
 * Paragraphs are separated by double newlines or significant breaks.
 */
function splitIntoParagraphs(content: string): string[] {
  // Split on double newlines (paragraph breaks)
  const rawParagraphs = content.split(/\n\s*\n/);

  // Filter out empty/whitespace-only paragraphs
  return rawParagraphs
    .map(p => p.trim())
    .filter(p => p.length >= MIN_PARAGRAPH_LENGTH);
}

/**
 * Generate anchor ID for a paragraph index (1-based).
 */
function generateAnchorId(index: number): string {
  return `${ANCHOR_PREFIX}${index}${ANCHOR_SUFFIX}`;
}

/**
 * Inject anchors into content for REWRITE_UPGRADE mode.
 * Each paragraph gets a unique anchor: <<P1>>, <<P2>>, etc.
 *
 * @param content - Original content to anchor
 * @returns Anchored content with metadata
 */
export function injectAnchors(content: string): AnchoredContent {
  const paragraphs = splitIntoParagraphs(content);
  const anchorIds: string[] = [];
  const anchoredParagraphs: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const anchorId = generateAnchorId(i + 1);
    anchorIds.push(anchorId);
    anchoredParagraphs.push(`${anchorId}\n${paragraphs[i]}`);
  }

  return {
    anchoredText: anchoredParagraphs.join('\n\n'),
    anchorIds,
    paragraphCount: paragraphs.length,
  };
}

/**
 * Build anchored source reference for REWRITE_UPGRADE mode.
 * This replaces the standard buildSourceReference for REWRITE mode.
 *
 * @param sourceContent - Original source content
 * @returns Formatted source reference with anchors and metadata
 */
export function buildAnchoredSourceReference(sourceContent: string): {
  reference: string;
  anchors: AnchoredContent;
} {
  const anchors = injectAnchors(sourceContent);

  const reference = `
---
**SOURCE CONTENT TO REWRITE (with paragraph anchors):**
\`\`\`
${anchors.anchoredText}
\`\`\`

**ANCHOR COUNT:** ${anchors.paragraphCount} paragraphs (${anchors.anchorIds.join(', ')})
---
`;

  return { reference, anchors };
}

// ============================================
// Anchor Validation
// ============================================

/**
 * Extract anchors from LLM output.
 * Returns anchors in the order they appear.
 */
export function extractAnchors(output: string): string[] {
  const matches = output.matchAll(ANCHOR_REGEX);
  const anchors: string[] = [];

  for (const match of matches) {
    anchors.push(match[0]);
  }

  return anchors;
}

/**
 * Validate that LLM output preserves anchor structure.
 *
 * Rules:
 * 1. All source anchors must be present in output
 * 2. No extra anchors may be added
 * 3. Anchor order must be preserved
 *
 * @param output - LLM output to validate
 * @param expectedAnchors - Anchors from source (in order)
 * @returns Validation result
 */
export function validateAnchors(
  output: string,
  expectedAnchors: string[]
): AnchorValidationResult {
  const foundAnchors = extractAnchors(output);

  // Check for missing anchors
  const missing = expectedAnchors.filter(a => !foundAnchors.includes(a));

  // Check for extra anchors
  const extra = foundAnchors.filter(a => !expectedAnchors.includes(a));

  // Check order preservation (only for anchors that exist in both)
  const expectedInOrder = expectedAnchors.filter(a => foundAnchors.includes(a));
  const foundInOrder = foundAnchors.filter(a => expectedAnchors.includes(a));
  const orderPreserved = expectedInOrder.join(',') === foundInOrder.join(',');

  // Validation passes if:
  // - No missing anchors
  // - No extra anchors
  // - Order is preserved
  const valid = missing.length === 0 && extra.length === 0 && orderPreserved;

  let error: string | undefined;
  if (!valid) {
    const errors: string[] = [];
    if (missing.length > 0) {
      errors.push(`Missing anchors: ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      errors.push(`Extra anchors: ${extra.join(', ')}`);
    }
    if (!orderPreserved) {
      errors.push('Anchor order changed');
    }
    error = errors.join('. ');
  }

  return {
    valid,
    error,
    expected: expectedAnchors,
    found: foundAnchors,
    missing,
    extra,
    orderPreserved,
  };
}

/**
 * Strip anchors from output for final display.
 * The anchors are only for validation, not for user display.
 *
 * @param output - LLM output with anchors
 * @returns Clean output without anchors
 */
export function stripAnchors(output: string): string {
  return output.replace(ANCHOR_REGEX, '').replace(/^\s*\n/gm, '\n').trim();
}

// ============================================
// Anchor Contract for System Prompt
// ============================================

/**
 * Get anchor preservation rules for system prompt injection.
 * This is added to the REWRITE_UPGRADE contract.
 */
export function getAnchorContractRules(lang: 'vi' | 'en'): string {
  if (lang === 'vi') {
    return `
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
`;
  }

  return `
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
`;
}

// ============================================
// Utility: Check if anchoring should be applied
// ============================================

/**
 * Check if content has enough paragraphs to benefit from anchoring.
 * Very short content (1 paragraph) doesn't need anchors.
 */
export function shouldApplyAnchors(content: string): boolean {
  const paragraphs = splitIntoParagraphs(content);
  // Apply anchors if 2+ paragraphs
  return paragraphs.length >= 2;
}
