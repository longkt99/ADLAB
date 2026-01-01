// ============================================
// Similarity Check Utility for Auto Fix Guardrails
// ============================================
// Prevents over-editing by comparing original and fixed content
// Uses character-level and token-level similarity metrics

/**
 * Similarity check result
 */
export interface SimilarityResult {
  /** Similarity score from 0 to 1 (1 = identical) */
  score: number;
  /** Whether the edit passes the similarity threshold */
  passed: boolean;
  /** Human-readable assessment */
  assessment: 'minimal' | 'moderate' | 'excessive';
  /** Details for debugging */
  details: {
    charSimilarity: number;
    tokenOverlap: number;
    lengthRatio: number;
  };
}

/**
 * Similarity check options
 */
export interface SimilarityOptions {
  /** Minimum similarity required (default: 0.7 for 70%) */
  minSimilarity?: number;
  /** Weight for character similarity (default: 0.4) */
  charWeight?: number;
  /** Weight for token overlap (default: 0.4) */
  tokenWeight?: number;
  /** Weight for length ratio (default: 0.2) */
  lengthWeight?: number;
}

const DEFAULT_OPTIONS: Required<SimilarityOptions> = {
  minSimilarity: 0.7,
  charWeight: 0.4,
  tokenWeight: 0.4,
  lengthWeight: 0.2,
};

/**
 * Check similarity between original and fixed content
 *
 * @param original - Original content before fix
 * @param fixed - Content after auto-fix
 * @param options - Similarity options
 * @returns Similarity result with score and assessment
 */
export function checkSimilarity(
  original: string,
  fixed: string,
  options: SimilarityOptions = {}
): SimilarityResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Normalize strings for comparison
  const normalizedOriginal = normalizeText(original);
  const normalizedFixed = normalizeText(fixed);

  // Calculate individual metrics
  const charSimilarity = calculateLevenshteinSimilarity(normalizedOriginal, normalizedFixed);
  const tokenOverlap = calculateTokenOverlap(normalizedOriginal, normalizedFixed);
  const lengthRatio = calculateLengthRatio(normalizedOriginal, normalizedFixed);

  // Calculate weighted score
  const score =
    charSimilarity * opts.charWeight +
    tokenOverlap * opts.tokenWeight +
    lengthRatio * opts.lengthWeight;

  // Determine assessment
  let assessment: 'minimal' | 'moderate' | 'excessive';
  if (score >= 0.85) {
    assessment = 'minimal';
  } else if (score >= opts.minSimilarity) {
    assessment = 'moderate';
  } else {
    assessment = 'excessive';
  }

  return {
    score,
    passed: score >= opts.minSimilarity,
    assessment,
    details: {
      charSimilarity,
      tokenOverlap,
      lengthRatio,
    },
  };
}

/**
 * Quick check if fix is acceptable
 *
 * @param original - Original content
 * @param fixed - Fixed content
 * @param minSimilarity - Minimum similarity threshold (default: 0.7)
 * @returns true if fix passes similarity check
 */
export function isFixAcceptable(
  original: string,
  fixed: string,
  minSimilarity: number = 0.7
): boolean {
  return checkSimilarity(original, fixed, { minSimilarity }).passed;
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Normalize text for comparison
 * - Lowercase
 * - Remove extra whitespace
 * - Normalize unicode
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein similarity (1 - normalized distance)
 */
function calculateLevenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // For very long strings, use sampled comparison for performance
  const MAX_LENGTH = 5000;
  if (a.length > MAX_LENGTH || b.length > MAX_LENGTH) {
    // Sample-based similarity for long content
    return calculateSampledSimilarity(a, b, MAX_LENGTH);
  }

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Calculate sampled similarity for long strings
 */
function calculateSampledSimilarity(a: string, b: string, sampleSize: number): number {
  // Take samples from beginning, middle, and end
  const sampleA = a.slice(0, sampleSize / 3) +
                  a.slice(Math.floor(a.length / 2) - sampleSize / 6, Math.floor(a.length / 2) + sampleSize / 6) +
                  a.slice(-sampleSize / 3);
  const sampleB = b.slice(0, sampleSize / 3) +
                  b.slice(Math.floor(b.length / 2) - sampleSize / 6, Math.floor(b.length / 2) + sampleSize / 6) +
                  b.slice(-sampleSize / 3);

  const distance = levenshteinDistance(sampleA, sampleB);
  const maxLength = Math.max(sampleA.length, sampleB.length);
  return 1 - distance / maxLength;
}

/**
 * Calculate token (word) overlap using Jaccard similarity
 */
function calculateTokenOverlap(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  // Calculate intersection count
  let intersectionCount = 0;
  setA.forEach((token) => {
    if (setB.has(token)) {
      intersectionCount++;
    }
  });

  // Calculate union size (|A| + |B| - |A ∩ B|)
  const unionSize = setA.size + setB.size - intersectionCount;

  // Jaccard similarity: |A ∩ B| / |A ∪ B|
  return intersectionCount / unionSize;
}

/**
 * Tokenize text into words
 * Handles Vietnamese and English
 */
function tokenize(text: string): string[] {
  // Split on whitespace and punctuation, filter empty
  return text
    .split(/[\s,.!?;:'"()\[\]{}]+/)
    .filter((token) => token.length > 0);
}

/**
 * Calculate length ratio similarity
 * Penalizes significant length changes
 */
function calculateLengthRatio(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  return ratio;
}

// ============================================
// EXPORTS FOR TESTING
// ============================================

export const _internal = {
  normalizeText,
  calculateLevenshteinSimilarity,
  calculateTokenOverlap,
  calculateLengthRatio,
  tokenize,
};
