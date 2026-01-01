// ============================================
// Auto Fix Prompt Guardrails
// ============================================
// Strict rules for what Auto Fix is allowed to change.
// Enforces rule-scoped micro-edits only.
// Protects writer voice and intent.

import type { IntentId, RuleResult } from './intentQualityRules';

// ============================================
// GUARDRAIL TYPES
// ============================================

/**
 * Guardrail violation detected in Auto Fix output
 */
export interface GuardrailViolation {
  type: GuardrailViolationType;
  description: string;
  severity: 'warning' | 'block';
}

export type GuardrailViolationType =
  | 'EXCESSIVE_REWRITE'
  | 'TONE_SHIFT'
  | 'CONTENT_EXPANSION'
  | 'UNAUTHORIZED_EMOJI'
  | 'UNAUTHORIZED_HASHTAG'
  | 'META_COMMENTARY'
  | 'LANGUAGE_CHANGE'
  | 'MEANING_DRIFT'
  | 'STRUCTURE_OVERHAUL';

/**
 * Guardrail check result
 */
export interface GuardrailCheckResult {
  passed: boolean;
  violations: GuardrailViolation[];
  recommendation: 'accept' | 'retry' | 'fallback';
}

// ============================================
// FORBIDDEN PATTERNS
// ============================================

/**
 * Meta-commentary patterns that indicate AI self-reference
 * Auto Fix must NEVER add these
 */
const META_COMMENTARY_PATTERNS = [
  /^(here is|here's|below is|dưới đây là|đây là bản|tôi đã|i have|i've)/i,
  /^(as (an ai|a language model|requested))/i,
  /(hope this helps|let me know|feel free)/i,
  /^(certainly|of course|sure|absolutely)[!,.:]/i,
  /\[note:.*\]/i,
  /\(note:.*\)/i,
];

/**
 * Patterns indicating tone shift (overly formal, casual, or AI-like)
 */
const TONE_SHIFT_PATTERNS = [
  // Overly formal AI patterns
  /\b(furthermore|moreover|additionally|consequently)\b/i,
  /\b(it is worth noting|it should be noted)\b/i,
  // Overly casual shifts
  /\b(gonna|wanna|gotta|ya'll|y'all)\b/i,
  // AI filler phrases
  /\b(in today's world|in this day and age)\b/i,
  /\b(leverage|utilize|facilitate|synergy)\b/i,
];

/**
 * Emoji pattern (for detection when not authorized)
 * Uses surrogate pair ranges for ES5 compatibility
 */
const EMOJI_PATTERN = /[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u26FF]|[\u2700-\u27BF]/;

/**
 * Hashtag pattern
 */
const HASHTAG_PATTERN = /#\w+/g;

// ============================================
// RULES THAT AUTHORIZE SPECIAL CONTENT
// ============================================

/**
 * Rules that explicitly authorize emoji addition
 */
const EMOJI_AUTHORIZED_RULES = [
  'reel_emoji_usage',
];

/**
 * Rules that explicitly authorize hashtag addition
 */
const HASHTAG_AUTHORIZED_RULES = [
  'reel_has_hashtags',
];

/**
 * Rules that allow structural changes (not just micro-edits)
 */
const STRUCTURE_CHANGE_RULES = [
  'social_structure_lock',
  'social_max_sections',
  'seo_title_present',
  'seo_headings_hierarchy',
  'video_hook_present',
  'video_sections_present',
  'email_subject_present',
  'landing_headline_present',
  'landing_cta_present',
  'product_name_present',
];

// ============================================
// GUARDRAIL CHECK FUNCTIONS
// ============================================

/**
 * Check for meta-commentary in output
 */
function checkMetaCommentary(output: string): GuardrailViolation | null {
  for (const pattern of META_COMMENTARY_PATTERNS) {
    if (pattern.test(output)) {
      return {
        type: 'META_COMMENTARY',
        description: `Output contains meta-commentary matching: ${pattern.source}`,
        severity: 'block',
      };
    }
  }
  return null;
}

/**
 * Check for unauthorized emoji addition
 */
function checkUnauthorizedEmoji(
  original: string,
  output: string,
  failedRuleIds: string[]
): GuardrailViolation | null {
  const originalHasEmoji = EMOJI_PATTERN.test(original);
  const outputHasEmoji = EMOJI_PATTERN.test(output);

  // If original had emoji, output can have emoji
  if (originalHasEmoji) return null;

  // If output has emoji but original didn't
  if (outputHasEmoji && !originalHasEmoji) {
    // Check if any failed rule authorizes emoji
    const authorized = failedRuleIds.some(id => EMOJI_AUTHORIZED_RULES.includes(id));
    if (!authorized) {
      return {
        type: 'UNAUTHORIZED_EMOJI',
        description: 'Added emoji without rule authorization',
        severity: 'warning',
      };
    }
  }

  return null;
}

/**
 * Check for unauthorized hashtag addition
 */
function checkUnauthorizedHashtag(
  original: string,
  output: string,
  failedRuleIds: string[]
): GuardrailViolation | null {
  const originalHashtags = (original.match(HASHTAG_PATTERN) || []).length;
  const outputHashtags = (output.match(HASHTAG_PATTERN) || []).length;

  // If output has more hashtags than original
  if (outputHashtags > originalHashtags) {
    // Check if any failed rule authorizes hashtags
    const authorized = failedRuleIds.some(id => HASHTAG_AUTHORIZED_RULES.includes(id));
    if (!authorized) {
      return {
        type: 'UNAUTHORIZED_HASHTAG',
        description: `Added ${outputHashtags - originalHashtags} hashtag(s) without rule authorization`,
        severity: 'warning',
      };
    }
  }

  return null;
}

/**
 * Check for tone shift patterns
 */
function checkToneShift(original: string, output: string): GuardrailViolation | null {
  // Only flag if pattern appears in output but not in original
  for (const pattern of TONE_SHIFT_PATTERNS) {
    const inOriginal = pattern.test(original);
    const inOutput = pattern.test(output);

    if (inOutput && !inOriginal) {
      return {
        type: 'TONE_SHIFT',
        description: `Introduced tone-shifting phrase matching: ${pattern.source}`,
        severity: 'warning',
      };
    }
  }

  return null;
}

/**
 * Check for language change (Vietnamese ↔ English)
 */
function checkLanguageChange(original: string, output: string): GuardrailViolation | null {
  // Simple heuristic: check for Vietnamese diacritics
  const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

  const originalIsVietnamese = vietnamesePattern.test(original);
  const outputIsVietnamese = vietnamesePattern.test(output);

  // If there's a mismatch and both have substantial content
  if (original.length > 50 && output.length > 50) {
    if (originalIsVietnamese !== outputIsVietnamese) {
      return {
        type: 'LANGUAGE_CHANGE',
        description: `Language appears to have changed: ${originalIsVietnamese ? 'Vietnamese → English' : 'English → Vietnamese'}`,
        severity: 'block',
      };
    }
  }

  return null;
}

/**
 * Check for excessive content expansion
 * (Adding substantial new content not in original)
 */
function checkContentExpansion(
  original: string,
  output: string,
  failedRuleIds: string[]
): GuardrailViolation | null {
  const originalLength = original.length;
  const outputLength = output.length;

  // Allow up to 30% expansion for structure rules
  const hasStructureRule = failedRuleIds.some(id => STRUCTURE_CHANGE_RULES.includes(id));
  const maxExpansion = hasStructureRule ? 1.5 : 1.3; // 50% for structure, 30% otherwise

  if (outputLength > originalLength * maxExpansion) {
    return {
      type: 'CONTENT_EXPANSION',
      description: `Content expanded by ${Math.round((outputLength / originalLength - 1) * 100)}% (max allowed: ${Math.round((maxExpansion - 1) * 100)}%)`,
      severity: 'warning',
    };
  }

  return null;
}

// ============================================
// MAIN GUARDRAIL CHECK
// ============================================

/**
 * Run all guardrail checks on Auto Fix output
 *
 * @param original - Original content before fix
 * @param output - Content after Auto Fix
 * @param failedRules - Array of failed rules that triggered Auto Fix
 * @param similarityScore - Similarity score from checkSimilarity()
 * @returns Guardrail check result with violations and recommendation
 */
export function checkGuardrails(
  original: string,
  output: string,
  failedRules: RuleResult[],
  similarityScore: number
): GuardrailCheckResult {
  const violations: GuardrailViolation[] = [];
  const failedRuleIds = failedRules.filter(r => !r.passed).map(r => r.id);

  // Run all checks
  const metaCheck = checkMetaCommentary(output);
  if (metaCheck) violations.push(metaCheck);

  const emojiCheck = checkUnauthorizedEmoji(original, output, failedRuleIds);
  if (emojiCheck) violations.push(emojiCheck);

  const hashtagCheck = checkUnauthorizedHashtag(original, output, failedRuleIds);
  if (hashtagCheck) violations.push(hashtagCheck);

  const toneCheck = checkToneShift(original, output);
  if (toneCheck) violations.push(toneCheck);

  const languageCheck = checkLanguageChange(original, output);
  if (languageCheck) violations.push(languageCheck);

  const expansionCheck = checkContentExpansion(original, output, failedRuleIds);
  if (expansionCheck) violations.push(expansionCheck);

  // Determine recommendation based on violations and similarity
  let recommendation: 'accept' | 'retry' | 'fallback' = 'accept';

  // Any blocking violation → fallback
  const hasBlockingViolation = violations.some(v => v.severity === 'block');
  if (hasBlockingViolation) {
    recommendation = 'fallback';
  }
  // Low similarity → fallback
  else if (similarityScore < 0.5) {
    recommendation = 'fallback';
  }
  // Multiple warnings or borderline similarity → retry
  else if (violations.length >= 2 || similarityScore < 0.7) {
    recommendation = 'retry';
  }

  return {
    passed: violations.length === 0 && similarityScore >= 0.7,
    violations,
    recommendation,
  };
}

// ============================================
// PROMPT POLICY STRINGS
// ============================================

/**
 * Core guardrail policy to embed in prompts
 * This is the SOURCE OF TRUTH for what Auto Fix can/cannot do
 */
export const GUARDRAIL_POLICY = `
AUTO FIX GUARDRAILS (MUST FOLLOW):

ALLOWED:
- Fix structure issues (add missing labels, split paragraphs)
- Fix clarity issues (simplify sentences, remove redundancy)
- Remove meta-commentary and AI self-references
- Adjust CTA to have clear action verb
- Add required elements ONLY if a rule explicitly requires them

FORBIDDEN:
- Rewriting content that wasn't flagged
- Changing the writer's tone, voice, or style
- Adding emojis (unless reel_emoji_usage rule failed)
- Adding hashtags (unless reel_has_hashtags rule failed)
- Adding new ideas, examples, or arguments
- Explaining what you did or why
- Adding filler phrases or corporate-speak
- Changing the language (Vietnamese ↔ English)
- Expanding content beyond 30% of original length

PRINCIPLE:
You are making surgical edits, not improving content.
If something wasn't flagged, don't touch it.
`.trim();

/**
 * Stricter policy for retry attempts
 */
export const STRICT_GUARDRAIL_POLICY = `
⚠️ STRICT AUTO FIX GUARDRAILS (RETRY - PREVIOUS EDIT WAS TOO AGGRESSIVE):

YOU MUST:
- Make the ABSOLUTE MINIMUM changes
- Preserve EVERY word that wasn't flagged
- Keep the exact same tone and style
- Only fix what the rules explicitly require

YOU MUST NOT:
- Rephrase anything that works
- "Improve" the writing
- Add any new content
- Change word choices unless required
- Touch sentences that weren't flagged

PRINCIPLE:
Your previous edit changed too much.
This time: surgical precision only.
If you're unsure whether to change something, DON'T.
`.trim();

// ============================================
// EXPORTS
// ============================================

export {
  META_COMMENTARY_PATTERNS,
  TONE_SHIFT_PATTERNS,
  EMOJI_PATTERN,
  HASHTAG_PATTERN,
  EMOJI_AUTHORIZED_RULES,
  HASHTAG_AUTHORIZED_RULES,
  STRUCTURE_CHANGE_RULES,
};
