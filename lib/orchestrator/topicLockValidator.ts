// ============================================
// Topic Lock Validator
// ============================================
// Post-generation validation for topic lock.
// Checks entity presence, topic drift, and format compliance.
// ============================================

import type {
  LockedContext,
  TopicLockValidation,
  ValidationCheck,
  ContentFormat,
} from '@/types/orchestrator';
import { getCriticalEntities } from './lockedContextExtractor';

// ============================================
// Configuration
// ============================================

const VALIDATION_CONFIG = {
  // Minimum keyword overlap for topic (0-1)
  topicDriftThreshold: 0.5,
  // Entity matching options
  entityMatchCaseSensitive: false,
  // Format detection tolerance
  formatTolerance: 0.3,
};

// ============================================
// Entity Presence Validation
// ============================================

/**
 * Check if entity value appears in output
 * @param value - Entity value to find
 * @param output - Output text
 * @returns True if entity is present
 */
function entityPresent(value: string, output: string): boolean {
  if (VALIDATION_CONFIG.entityMatchCaseSensitive) {
    return output.includes(value);
  }
  return output.toLowerCase().includes(value.toLowerCase());
}

/**
 * Validate entity presence in output
 * @param context - Locked context
 * @param output - Generated output
 * @returns Entity presence validation result
 */
function validateEntityPresence(
  context: LockedContext,
  output: string
): ValidationCheck & { missing_entities: string[]; present_entities: string[] } {
  const criticalEntities = getCriticalEntities(context);

  if (criticalEntities.length === 0) {
    return {
      passed: true,
      score: 1,
      details: 'No critical entities to validate',
      missing_entities: [],
      present_entities: [],
    };
  }

  const missing: string[] = [];
  const present: string[] = [];

  for (const entity of criticalEntities) {
    if (entityPresent(entity.value, output)) {
      present.push(entity.value);
    } else {
      missing.push(entity.value);
    }
  }

  const score = present.length / criticalEntities.length;
  const passed = missing.length === 0;

  return {
    passed,
    score,
    details: passed
      ? `All ${criticalEntities.length} critical entities present`
      : `Missing ${missing.length} of ${criticalEntities.length} critical entities: ${missing.join(', ')}`,
    missing_entities: missing,
    present_entities: present,
  };
}

// ============================================
// Topic Drift Validation
// ============================================

/**
 * Tokenize text into words
 * @param text - Text to tokenize
 * @returns Array of lowercase words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/**
 * Calculate keyword overlap between source and output
 * @param sourceKeywords - Keywords from source
 * @param output - Generated output
 * @returns Overlap score (0-1)
 */
function calculateKeywordOverlap(
  sourceKeywords: string[],
  output: string
): number {
  if (sourceKeywords.length === 0) return 1;

  const outputWords = new Set(tokenize(output));
  let matchCount = 0;

  for (const keyword of sourceKeywords) {
    if (outputWords.has(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  return matchCount / sourceKeywords.length;
}

/**
 * Find keywords that drifted (in source but not in output)
 * @param sourceKeywords - Keywords from source
 * @param output - Generated output
 * @returns Array of missing keywords
 */
function findDriftKeywords(
  sourceKeywords: string[],
  output: string
): string[] {
  const outputWords = new Set(tokenize(output));
  return sourceKeywords.filter((k) => !outputWords.has(k.toLowerCase()));
}

/**
 * Validate topic drift
 * @param context - Locked context
 * @param output - Generated output
 * @returns Topic drift validation result
 */
function validateTopicDrift(
  context: LockedContext,
  output: string
): ValidationCheck & { keyword_overlap: number; drift_keywords: string[] } {
  const overlap = calculateKeywordOverlap(context.topic_keywords, output);
  const driftKeywords = findDriftKeywords(context.topic_keywords.slice(0, 15), output);
  const passed = overlap >= VALIDATION_CONFIG.topicDriftThreshold;

  return {
    passed,
    score: overlap,
    details: passed
      ? `Topic maintained with ${Math.round(overlap * 100)}% keyword overlap`
      : `Topic drift detected: ${Math.round(overlap * 100)}% overlap (threshold: ${Math.round(VALIDATION_CONFIG.topicDriftThreshold * 100)}%)`,
    keyword_overlap: overlap,
    drift_keywords: driftKeywords,
  };
}

// ============================================
// Format Compliance Validation
// ============================================

/**
 * Detect content format
 * @param content - Content to analyze
 * @returns Detected format
 */
function detectFormat(content: string): ContentFormat {
  const lines = content.split('\n').filter((l) => l.trim());

  const bulletLines = lines.filter((l) => /^\s*[-•*]\s+/.test(l));
  if (bulletLines.length >= 3 && bulletLines.length / lines.length > 0.5) {
    return 'bullet_list';
  }

  const numberedLines = lines.filter((l) => /^\s*\d+[.)]\s+/.test(l));
  if (numberedLines.length >= 3 && numberedLines.length / lines.length > 0.5) {
    return 'numbered_list';
  }

  const headingLines = lines.filter(
    (l) => /^#{1,6}\s+/.test(l) || /^[A-Z][^.!?]*:$/.test(l.trim())
  );
  if (headingLines.length >= 2) {
    return 'heading_sections';
  }

  if (bulletLines.length > 0 || numberedLines.length > 0 || headingLines.length > 0) {
    return 'mixed';
  }

  return 'paragraph';
}

/**
 * Check if formats are compatible
 * @param expected - Expected format
 * @param actual - Actual format
 * @returns True if compatible
 */
function formatsCompatible(
  expected: ContentFormat,
  actual: ContentFormat
): boolean {
  // Same format is always compatible
  if (expected === actual) return true;

  // Mixed is compatible with anything
  if (expected === 'mixed' || actual === 'mixed') return true;

  // Bullet and numbered lists are somewhat compatible
  if (
    (expected === 'bullet_list' && actual === 'numbered_list') ||
    (expected === 'numbered_list' && actual === 'bullet_list')
  ) {
    return true;
  }

  return false;
}

/**
 * Validate format compliance
 * @param context - Locked context
 * @param output - Generated output
 * @returns Format compliance validation result
 */
function validateFormatCompliance(
  context: LockedContext,
  output: string
): ValidationCheck & {
  expected_format?: ContentFormat;
  detected_format?: ContentFormat;
} {
  if (!context.required_format) {
    return {
      passed: true,
      score: 1,
      details: 'No format requirement',
      expected_format: undefined,
      detected_format: undefined,
    };
  }

  const detectedFormat = detectFormat(output);
  const compatible = formatsCompatible(context.required_format, detectedFormat);

  return {
    passed: compatible,
    score: compatible ? 1 : 0,
    details: compatible
      ? `Format maintained: ${detectedFormat}`
      : `Format mismatch: expected ${context.required_format}, got ${detectedFormat}`,
    expected_format: context.required_format,
    detected_format: detectedFormat,
  };
}

// ============================================
// Main Validator
// ============================================

/**
 * Validate output against topic lock
 * @param context - Locked context
 * @param output - Generated output
 * @returns Full validation result
 */
export function validateTopicLock(
  context: LockedContext,
  output: string
): TopicLockValidation {
  const entityPresence = validateEntityPresence(context, output);
  const topicDrift = validateTopicDrift(context, output);
  const formatCompliance = validateFormatCompliance(context, output);

  // Overall pass requires all checks to pass
  const overallPassed =
    entityPresence.passed && topicDrift.passed && formatCompliance.passed;

  return {
    overall_passed: overallPassed,
    entity_presence: entityPresence,
    topic_drift: topicDrift,
    format_compliance: formatCompliance,
  };
}

/**
 * Get validation summary for UI display
 * @param validation - Validation result
 * @returns Human-readable summary
 */
export function getValidationSummary(validation: TopicLockValidation): string {
  if (validation.overall_passed) {
    return 'All checks passed';
  }

  const failures: string[] = [];

  if (!validation.entity_presence.passed) {
    failures.push(`Missing: ${validation.entity_presence.missing_entities.join(', ')}`);
  }

  if (!validation.topic_drift.passed) {
    failures.push(`Topic drift: ${Math.round(validation.topic_drift.keyword_overlap * 100)}% overlap`);
  }

  if (!validation.format_compliance.passed) {
    failures.push(`Format: expected ${validation.format_compliance.expected_format}`);
  }

  return failures.join('; ');
}

/**
 * Check if validation failure is recoverable
 * @param validation - Validation result
 * @returns True if retry in STRICT mode might help
 */
export function isRecoverable(validation: TopicLockValidation): boolean {
  // Entity presence failures are often recoverable with STRICT mode
  if (!validation.entity_presence.passed) return true;

  // Minor topic drift might be recoverable
  if (!validation.topic_drift.passed && validation.topic_drift.score >= 0.3) {
    return true;
  }

  // Format failures are usually recoverable
  if (!validation.format_compliance.passed) return true;

  return false;
}
