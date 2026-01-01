// ============================================
// STEP 22: Rewrite Diff Guard
// ============================================
// Enforces conservative rewrite limits for REWRITE_UPGRADE mode.
// Prevents "over-rewriting" while allowing light improvements.
//
// INVARIANTS:
// - Called AFTER anchor validation
// - Applied ONLY for REWRITE_UPGRADE
// - No fallback, no silent correction
// - Deterministic, no LLM calls
//
// ⚠️ SYSTEM INVARIANT (STEP 25)
// This module enforces edit intensity limits in REWRITE_UPGRADE.
// The thresholds below are LOCKED and prevent:
// - Excessive length expansion (MAX_LENGTH_RATIO)
// - Topic drift (MIN_KEYWORD_PRESERVATION_RATIO)
// - Full rewrites (MAX_SENTENCE_REPLACEMENT_RATIO)
// - CTA injection (CTA detection patterns)
// Do NOT modify thresholds or detection logic without:
// 1. Updating docs/system-invariants.md
// 2. Updating answerEngine.invariants.test.ts
// 3. Verifying all existing tests still pass
// ============================================

// ============================================
// Types
// ============================================

export interface RewriteDiffResult {
  /** Whether all paragraphs pass the diff guard */
  ok: boolean;
  /** Reason for failure if not ok */
  reason?: 'REWRITE_DIFF_EXCEEDED' | 'LENGTH_EXCEEDED' | 'SENTENCE_REPLACEMENT_EXCEEDED' | 'CTA_ADDED' | 'KEYWORDS_LOST';
  /** Details about the violation */
  details?: string;
  /** Per-paragraph analysis */
  paragraphAnalysis: ParagraphDiffAnalysis[];
}

export interface ParagraphDiffAnalysis {
  /** Anchor ID (e.g., "<<P1>>") */
  anchorId: string;
  /** Original paragraph text */
  original: string;
  /** Rewritten paragraph text */
  rewritten: string;
  /** Length ratio (rewritten / original) */
  lengthRatio: number;
  /** Sentence replacement ratio (0-1) */
  sentenceReplacementRatio: number;
  /** Whether CTA was added (not in original) */
  ctaAdded: boolean;
  /** Keywords preserved ratio (0-1) */
  keywordsPreservedRatio: number;
  /** Whether this paragraph passed all checks */
  passed: boolean;
  /** Reason for failure if not passed */
  failReason?: string;
}

// ============================================
// Constants (EXPORTED FOR INVARIANT TESTS)
// ============================================

/**
 * Maximum length increase ratio (1.5x = 50% longer max)
 * ⚠️ LOCKED THRESHOLD - Do not modify without updating system-invariants.md
 */
export const MAX_LENGTH_RATIO = 1.5;

/**
 * Maximum sentence replacement ratio (40% can be new sentences)
 * ⚠️ LOCKED THRESHOLD - Do not modify without updating system-invariants.md
 */
export const MAX_SENTENCE_REPLACEMENT_RATIO = 0.4;

/**
 * Minimum keyword preservation ratio (60% of core keywords must remain)
 * ⚠️ LOCKED THRESHOLD - Do not modify without updating system-invariants.md
 */
export const MIN_KEYWORD_PRESERVATION_RATIO = 0.6;

/** CTA / urgency patterns (Vietnamese + English) */
const CTA_PATTERNS = [
  // Vietnamese
  /liên hệ ngay/i,
  /đăng ký ngay/i,
  /mua ngay/i,
  /gọi ngay/i,
  /nhắn tin ngay/i,
  /đặt hàng ngay/i,
  /inbox ngay/i,
  /hotline/i,
  /số điện thoại/i,
  /zalo/i,
  /hành động ngay/i,
  /chỉ còn/i,
  /số lượng có hạn/i,
  /ưu đãi.*hết hạn/i,
  /giảm giá.*%/i,
  /khuyến mãi/i,
  /miễn phí/i,
  /tặng ngay/i,
  // English
  /call now/i,
  /buy now/i,
  /order now/i,
  /register now/i,
  /sign up now/i,
  /contact us/i,
  /limited time/i,
  /limited offer/i,
  /act now/i,
  /don't miss/i,
  /hurry/i,
  /only \d+ left/i,
  /\d+% off/i,
  /free shipping/i,
  /click here/i,
];

/** Anchor pattern for extraction */
const ANCHOR_REGEX = /<<P(\d+)>>/g;

// ============================================
// Helper Functions
// ============================================

/**
 * Extract paragraphs with their anchors from anchored content.
 */
function extractAnchoredParagraphs(content: string): Map<string, string> {
  const result = new Map<string, string>();

  // Split by anchor pattern
  const parts = content.split(/(<<P\d+>>)/);

  let currentAnchor: string | null = null;

  for (const part of parts) {
    if (/<<P\d+>>/.test(part)) {
      currentAnchor = part;
    } else if (currentAnchor) {
      result.set(currentAnchor, part.trim());
      currentAnchor = null;
    }
  }

  return result;
}

/**
 * Split text into sentences.
 * Handles Vietnamese and English sentence boundaries.
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or end
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Extract core keywords (nouns/important words) from text.
 * Simple heuristic: words with 4+ chars, excluding common stop words.
 */
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    // Vietnamese
    'được', 'những', 'không', 'trong', 'người', 'nhưng', 'cũng', 'như',
    'này', 'khi', 'đang', 'sẽ', 'để', 'với', 'các', 'một', 'có', 'là',
    'và', 'của', 'cho', 'từ', 'đến', 'về', 'trên', 'dưới', 'theo',
    'qua', 'lại', 'nên', 'vì', 'nếu', 'thì', 'mà', 'hoặc', 'hay',
    // English
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
    'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been',
    'would', 'could', 'should', 'their', 'what', 'there', 'when',
    'which', 'will', 'with', 'this', 'that', 'from', 'they', 'were',
    'your', 'more', 'some', 'than', 'them', 'into', 'other', 'then',
  ]);

  // Extract words with 4+ chars
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));

  return new Set(words);
}

/**
 * Check if text contains CTA/urgency patterns.
 */
function hasCTA(text: string): boolean {
  return CTA_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Calculate sentence similarity using simple word overlap.
 * Returns ratio of common words.
 */
function sentenceSimilarity(s1: string, s2: string): number {
  const words1 = new Set(s1.toLowerCase().split(/\s+/));
  const words2 = new Set(s2.toLowerCase().split(/\s+/));

  if (words1.size === 0 || words2.size === 0) return 0;

  let common = 0;
  for (const w of words1) {
    if (words2.has(w)) common++;
  }

  return common / Math.max(words1.size, words2.size);
}

/**
 * Calculate sentence replacement ratio.
 * A sentence is "replaced" if no original sentence has >50% similarity.
 */
function calculateSentenceReplacementRatio(
  originalSentences: string[],
  rewrittenSentences: string[]
): number {
  if (rewrittenSentences.length === 0) return 0;

  let replacedCount = 0;

  for (const rewritten of rewrittenSentences) {
    // Check if any original sentence is similar enough
    const hasSimilar = originalSentences.some(
      original => sentenceSimilarity(original, rewritten) > 0.5
    );

    if (!hasSimilar) {
      replacedCount++;
    }
  }

  return replacedCount / rewrittenSentences.length;
}

/**
 * Calculate keyword preservation ratio.
 */
function calculateKeywordPreservation(
  originalKeywords: Set<string>,
  rewrittenKeywords: Set<string>
): number {
  if (originalKeywords.size === 0) return 1;

  let preserved = 0;
  for (const keyword of originalKeywords) {
    if (rewrittenKeywords.has(keyword)) {
      preserved++;
    }
  }

  return preserved / originalKeywords.size;
}

// ============================================
// Main Guard Function
// ============================================

/**
 * Analyze a single paragraph pair.
 */
function analyzeParagraph(
  anchorId: string,
  original: string,
  rewritten: string
): ParagraphDiffAnalysis {
  // Length ratio
  const lengthRatio = original.length > 0
    ? rewritten.length / original.length
    : 1;

  // Sentence analysis
  const originalSentences = splitIntoSentences(original);
  const rewrittenSentences = splitIntoSentences(rewritten);
  const sentenceReplacementRatio = calculateSentenceReplacementRatio(
    originalSentences,
    rewrittenSentences
  );

  // CTA check
  const originalHasCTA = hasCTA(original);
  const rewrittenHasCTA = hasCTA(rewritten);
  const ctaAdded = !originalHasCTA && rewrittenHasCTA;

  // Keyword preservation
  const originalKeywords = extractKeywords(original);
  const rewrittenKeywords = extractKeywords(rewritten);
  const keywordsPreservedRatio = calculateKeywordPreservation(
    originalKeywords,
    rewrittenKeywords
  );

  // Determine pass/fail
  let passed = true;
  let failReason: string | undefined;

  if (lengthRatio > MAX_LENGTH_RATIO) {
    passed = false;
    failReason = `Length increased ${(lengthRatio * 100).toFixed(0)}% (max ${MAX_LENGTH_RATIO * 100}%)`;
  } else if (sentenceReplacementRatio > MAX_SENTENCE_REPLACEMENT_RATIO) {
    passed = false;
    failReason = `${(sentenceReplacementRatio * 100).toFixed(0)}% sentences replaced (max ${MAX_SENTENCE_REPLACEMENT_RATIO * 100}%)`;
  } else if (ctaAdded) {
    passed = false;
    failReason = 'CTA/urgency added where source had none';
  } else if (keywordsPreservedRatio < MIN_KEYWORD_PRESERVATION_RATIO) {
    passed = false;
    failReason = `Only ${(keywordsPreservedRatio * 100).toFixed(0)}% keywords preserved (min ${MIN_KEYWORD_PRESERVATION_RATIO * 100}%)`;
  }

  return {
    anchorId,
    original,
    rewritten,
    lengthRatio,
    sentenceReplacementRatio,
    ctaAdded,
    keywordsPreservedRatio,
    passed,
    failReason,
  };
}

/**
 * Validate rewrite diff for REWRITE_UPGRADE output.
 *
 * @param anchoredSource - Source content with anchors (<<P1>>, <<P2>>, etc.)
 * @param anchoredOutput - LLM output with anchors
 * @returns RewriteDiffResult indicating pass/fail
 */
export function validateRewriteDiff(
  anchoredSource: string,
  anchoredOutput: string
): RewriteDiffResult {
  // Extract paragraphs from both
  const sourceParagraphs = extractAnchoredParagraphs(anchoredSource);
  const outputParagraphs = extractAnchoredParagraphs(anchoredOutput);

  const paragraphAnalysis: ParagraphDiffAnalysis[] = [];

  // Analyze each source paragraph
  for (const [anchorId, sourceText] of sourceParagraphs) {
    const outputText = outputParagraphs.get(anchorId) || '';

    const analysis = analyzeParagraph(anchorId, sourceText, outputText);
    paragraphAnalysis.push(analysis);
  }

  // Check for any failures
  const failedParagraph = paragraphAnalysis.find(p => !p.passed);

  if (failedParagraph) {
    // Determine specific failure reason
    let reason: RewriteDiffResult['reason'] = 'REWRITE_DIFF_EXCEEDED';

    if (failedParagraph.lengthRatio > MAX_LENGTH_RATIO) {
      reason = 'LENGTH_EXCEEDED';
    } else if (failedParagraph.sentenceReplacementRatio > MAX_SENTENCE_REPLACEMENT_RATIO) {
      reason = 'SENTENCE_REPLACEMENT_EXCEEDED';
    } else if (failedParagraph.ctaAdded) {
      reason = 'CTA_ADDED';
    } else if (failedParagraph.keywordsPreservedRatio < MIN_KEYWORD_PRESERVATION_RATIO) {
      reason = 'KEYWORDS_LOST';
    }

    return {
      ok: false,
      reason,
      details: `${failedParagraph.anchorId}: ${failedParagraph.failReason}`,
      paragraphAnalysis,
    };
  }

  return {
    ok: true,
    paragraphAnalysis,
  };
}

/**
 * Get human-readable error message for diff guard failure.
 */
export function getDiffGuardErrorMessage(
  result: RewriteDiffResult,
  lang: 'vi' | 'en'
): string {
  if (result.ok) return '';

  const messages: Record<NonNullable<RewriteDiffResult['reason']>, { vi: string; en: string }> = {
    REWRITE_DIFF_EXCEEDED: {
      vi: 'Bài viết lại khác quá nhiều so với bản gốc',
      en: 'Rewritten content differs too much from original',
    },
    LENGTH_EXCEEDED: {
      vi: 'Độ dài tăng quá 50% so với bản gốc',
      en: 'Length increased more than 50% from original',
    },
    SENTENCE_REPLACEMENT_EXCEEDED: {
      vi: 'Quá nhiều câu mới (>40%) so với bản gốc',
      en: 'Too many new sentences (>40%) compared to original',
    },
    CTA_ADDED: {
      vi: 'Thêm CTA/lời kêu gọi mà bản gốc không có',
      en: 'Added CTA/call-to-action that original did not have',
    },
    KEYWORDS_LOST: {
      vi: 'Mất quá nhiều từ khóa chính của bản gốc',
      en: 'Lost too many core keywords from original',
    },
  };

  const reason = result.reason || 'REWRITE_DIFF_EXCEEDED';
  return messages[reason][lang];
}

// ============================================
// Exports for testing
// ============================================

export const _testExports = {
  extractAnchoredParagraphs,
  splitIntoSentences,
  extractKeywords,
  hasCTA,
  sentenceSimilarity,
  calculateSentenceReplacementRatio,
  calculateKeywordPreservation,
  analyzeParagraph,
  MAX_LENGTH_RATIO,
  MAX_SENTENCE_REPLACEMENT_RATIO,
  MIN_KEYWORD_PRESERVATION_RATIO,
};
