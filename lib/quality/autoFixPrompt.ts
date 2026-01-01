// ============================================
// Auto Fix Prompt Builder
// ============================================
// Builds refinement prompts for Quality Lock Auto Fix
// Single source of truth for Auto Fix prompt construction
// Aligned with QUALITY_LOCK_RULE_SPEC.md

import type { IntentId, RuleResult } from './intentQualityRules';

/**
 * Auto Fix Prompt Builder Arguments
 */
export interface BuildAutoFixPromptArgs {
  intent: IntentId;
  output: string;
  softFails: RuleResult[];
  hardFails?: RuleResult[];
  meta?: {
    templateId?: string;
    language?: 'vi' | 'en';
    testMode?: boolean;
  };
}

/**
 * Auto Fix Prompt Output (system/user separation for LLM)
 */
export interface AutoFixPromptOutput {
  system: string;
  user: string;
}

/**
 * Auto Fix Prompt Options
 */
export interface AutoFixPromptOptions {
  /** Second attempt uses stricter constraints */
  strict?: boolean;
  /** Attempt number (1 = first, 2 = retry) */
  attempt?: number;
}

// ============================================
// RULE-ID → FIX INSTRUCTION MAPPING
// ============================================
// Maps Quality Lock rule IDs to specific fix instructions
// These are concise, actionable directives for the LLM

const RULE_FIX_INSTRUCTIONS: Record<string, string> = {
  // ----------------------------------------
  // social_caption_v1 RULES
  // ----------------------------------------

  // STRUCTURE (HARD)
  social_structure_lock:
    'Add missing section labels. Required format: **Hook:** (attention grabber), **Body:** (main content), **CTA:** (call-to-action). Use exactly these labels.',
  social_max_sections:
    'Remove extra sections. Keep ONLY: **Hook:**, **Body:**, **CTA:**. Maximum 4 labeled sections allowed.',

  // RED_FLAG (HARD)
  social_no_meta_commentary:
    'Remove ALL meta-commentary and AI self-references. Delete phrases like: "Here is", "Below is", "As an AI", "I will", "Dưới đây là", "Tôi sẽ", "Đây là". Start directly with content.',
  social_cta_not_generic:
    'Replace generic CTA with a specific, actionable one. Avoid: "Tìm hiểu thêm", "Xem thêm", "Click here", "Learn more". Use specific action verbs relevant to the topic.',

  // QUALITY (SOFT)
  social_hook_length:
    'Shorten the Hook to 1-2 punchy sentences maximum. Keep it attention-grabbing but concise.',
  social_body_formatting:
    'Split Body into at least 2 separate paragraphs using line breaks. Each paragraph should cover one key point.',
  social_sentence_length:
    'Break long sentences (>25 words) into shorter ones. Aim for mobile-friendly readability.',
  social_topic_keyword:
    'Naturally incorporate the topic keyword into the Hook or Body text.',
  social_cta_action_verb:
    'Rewrite CTA as exactly 1 sentence with clear action intent. Use verbs like: Bình luận, Chia sẻ, Lưu, Tag, Theo dõi, Đăng ký, Để lại, Hãy, Comment, Share, Save, Follow.',

  // ----------------------------------------
  // seo_blog_v1 RULES
  // ----------------------------------------
  seo_title_present:
    'Add an H1 title at the start using "# Title" markdown format.',
  seo_headings_hierarchy:
    'Fix heading hierarchy: use exactly one H1, then H2s, then H3s in order.',
  seo_no_meta_commentary:
    'Remove ALL meta-commentary and AI self-references.',
  seo_intro_present:
    'Add an introduction paragraph (50+ chars) before the first H2.',
  seo_keyword_density:
    'Adjust keyword frequency to appear 2-5 times naturally throughout the content.',
  seo_meta_description:
    'Add or adjust meta description to 120-160 characters.',
  seo_paragraph_length:
    'Break long paragraphs (>150 words) into shorter ones.',
  seo_has_conclusion:
    'Add a conclusion section with H2 heading (e.g., "## Kết luận" or "## Conclusion").',

  // ----------------------------------------
  // video_script_v1 RULES
  // ----------------------------------------
  video_hook_present:
    'Add a Hook/Opening section using **Hook:** or **Opening:** label.',
  video_sections_present:
    'Add content sections using **Main:**, **Body:**, or [SCENE] markers.',
  video_no_meta_commentary:
    'Remove ALL meta-commentary and AI self-references.',
  video_hook_duration:
    'Shorten Hook to 30 words or less.',
  video_has_cta:
    'Add a clear call-to-action in the final section.',
  video_conversational:
    'Make tone more conversational. Add questions or direct address (bạn/you).',
  video_timing_hints:
    'Add timing/pacing hints like [0:00], timestamps, or duration markers.',

  // ----------------------------------------
  // email_marketing_v1 RULES
  // ----------------------------------------
  email_subject_present:
    'Add subject line using **Subject:** label at the start.',
  email_body_present:
    'Expand email body to at least 100 characters.',
  email_no_meta_commentary:
    'Remove ALL meta-commentary and AI self-references.',
  email_no_spam_words:
    'Remove spam trigger words: "FREE!!!", "ACT NOW", "100% FREE", etc.',
  email_subject_length:
    'Adjust subject line to 30-60 characters.',
  email_has_cta:
    'Add a clear CTA button or action section.',
  email_personalization:
    'Add personalization tokens like {{name}} or {{firstName}}.',
  email_preview_text:
    'Add preview/preheader text using **Preview:** label.',

  // ----------------------------------------
  // landing_page_v1 RULES
  // ----------------------------------------
  // NOTE: landing_social_proof and landing_urgency add new content by design.
  // This is allowed because the landing_page_v1 intent REQUIRES these elements.
  // Auto Fix is not inventing features — it is enforcing intent requirements.
  // If this feels like "adding ideas", the rule should be removed from the intent,
  // not worked around in Auto Fix.
  landing_headline_present:
    'Add main headline using **Headline:** label or H1 tag.',
  landing_cta_present:
    'Add CTA section using **CTA:** or [Button:] format.',
  landing_no_meta_commentary:
    'Remove ALL meta-commentary and AI self-references.',
  landing_headline_length:
    'Shorten headline to 15 words or less.',
  landing_benefits_list:
    'Add a benefits list with at least 3 bullet points.',
  landing_social_proof:
    'Add social proof element (testimonial, review, đánh giá).',
  landing_urgency:
    'Add urgency/scarcity element (time-limited offer, limited availability).',
  landing_subheadline:
    'Add supporting subheadline after the main headline.',

  // ----------------------------------------
  // product_description_v1 RULES
  // ----------------------------------------
  product_name_present:
    'Add product name using **Product:** or **Name:** label.',
  product_desc_present:
    'Expand product description to at least 100 characters.',
  product_no_meta_commentary:
    'Remove ALL meta-commentary and AI self-references.',
  product_features_list:
    'Add features list with at least 3 bullet points.',
  product_benefits:
    'Add benefit statements explaining how the product helps customers.',
  product_specs_format:
    'Format specifications as bullet points or table.',
  product_cta:
    'Add purchase CTA: "Mua ngay", "Đặt hàng", "Order", "Add to cart".',

  // ----------------------------------------
  // reel_caption_v1 RULES
  // ----------------------------------------
  reel_hook_present:
    'Start with a punchy hook (first line under 10 words).',
  reel_length_limit:
    'Shorten caption to 300 characters or less.',
  reel_no_meta_commentary:
    'Remove ALL meta-commentary and AI self-references.',
  reel_has_hashtags:
    'Add 3-10 relevant hashtags.',
  reel_emoji_usage:
    'Add 1-5 emojis to enhance visual appeal.',
  reel_cta_present:
    'Add engagement CTA (comment, share, save, follow).',
  reel_line_breaks:
    'Add line breaks for mobile readability.',
};

// ============================================
// INTENT STRUCTURE DEFINITIONS
// ============================================
// Defines required output structure per intent

const INTENT_STRUCTURE: Record<IntentId, string> = {
  social_caption_v1: `**Hook:** (1-2 sentences, attention-grabbing)

**Body:** (2+ paragraphs, main content with line breaks)

**CTA:** (exactly 1 sentence with action verb)`,

  seo_blog_v1: `# H1 Title

Introduction paragraph (50+ chars)

## H2 Section Headings
Content...

## Kết luận / Conclusion`,

  video_script_v1: `**Hook:** / **Opening:**
(Opening hook, <30 words)

**Main:** / **Body:** / [SCENE]
(Main content sections)

**CTA:**
(Call to action)`,

  email_marketing_v1: `**Subject:** (30-60 chars)

**Preview:** (optional preheader)

Email body content (100+ chars)

**CTA:** or [Button: text]`,

  landing_page_v1: `**Headline:** (≤15 words)

**Subheadline:** (supporting text)

Benefits list (3+ bullets)

**CTA:** or [Button: text]`,

  product_description_v1: `**Product:** / **Name:**

Description (100+ chars)

Features list (3+ bullets)

Benefits section

**CTA:** (purchase action)`,

  reel_caption_v1: `Hook line (<10 words)

Body content

CTA (engagement action)

#hashtags (3-10)`,
};

// ============================================
// SAFE-EDIT POLICY
// ============================================

const SAFE_EDIT_POLICY = `SAFE-EDIT POLICY (MUST FOLLOW):
- Preserve the original topic, message, and emotional tone
- Keep the same language (Vietnamese or English) as the original
- Do NOT add hashtags unless the rule specifically requires them
- Do NOT add extra sections beyond the required structure
- Do NOT add emojis unless the rule specifically requires them
- Fix ONLY the listed issues - leave everything else unchanged
- Do NOT add explanations, notes, or meta-commentary
- Do NOT wrap output in code fences or markdown blocks
- Output ONLY the corrected content, nothing else`;

const STRICT_SAFE_EDIT_POLICY = `⚠️ STRICT SAFE-EDIT POLICY (RETRY ATTEMPT - MUST FOLLOW EXACTLY):
- CRITICAL: Preserve the original creator's voice and tone
- CRITICAL: Keep the same language (Vietnamese or English) as the original
- CRITICAL: Make MINIMAL changes - only fix what is explicitly broken
- Do NOT add hashtags unless the rule specifically requires them
- Do NOT add extra sections beyond the required structure
- Do NOT add emojis unless the rule specifically requires them
- Do NOT rewrite or paraphrase content that wasn't flagged
- Do NOT change word choices unless necessary for the fix
- Fix ONLY the listed issues - leave EVERYTHING else unchanged
- Do NOT add explanations, notes, or meta-commentary
- Do NOT wrap output in code fences or markdown blocks
- Output ONLY the corrected content, nothing else
- If a sentence wasn't flagged, do NOT change it at all`;

// ============================================
// SYSTEM PROMPT TEMPLATES
// ============================================

const SYSTEM_PROMPT_NORMAL = `You are a focused content editor for Vietnamese social media and marketing content.

Your ONLY job is to fix specific Quality Lock issues in the content provided. You are NOT a rewriter.

Core principles:
1. MINIMAL EDITS: Change only what the rules require. Leave everything else untouched.
2. PRESERVE VOICE: Keep the creator's original tone, style, and word choices.
3. RESPECT LANGUAGE: Vietnamese content stays Vietnamese. English stays English.
4. NO EXTRAS: Do not add emojis, hashtags, or sections unless specifically required by a rule.

You will receive content with specific issues to fix. Fix ONLY those issues.`;

const SYSTEM_PROMPT_STRICT = `You are an ULTRA-CONSERVATIVE content editor. This is a RETRY attempt because the previous edit changed too much.

⚠️ CRITICAL: Your previous edit was TOO AGGRESSIVE. This time:
1. Make the ABSOLUTE MINIMUM changes needed
2. Do NOT rephrase, rewrite, or "improve" anything not explicitly flagged
3. If a rule says "split into 2 paragraphs", just add ONE line break - don't rewrite
4. If a rule says "add action verb to CTA", change ONLY the CTA verb - not the whole sentence
5. Preserve EVERY word that wasn't specifically flagged

You are fixing specific Quality Lock issues. You are NOT a creative rewriter.
The original content's voice and style must be preserved exactly.`;

// ============================================
// MAIN BUILDER FUNCTION
// ============================================

/**
 * Build the Auto Fix prompt from Quality Lock feedback
 *
 * This is the SINGLE SOURCE OF TRUTH for Auto Fix prompt construction.
 * Aligned with QUALITY_LOCK_RULE_SPEC.md
 *
 * @param args - The auto fix arguments
 * @param options - Prompt options (strict mode for retry, attempt number)
 * @returns System and user prompts for LLM
 */
export function buildAutoFixPrompt(
  args: BuildAutoFixPromptArgs,
  options: AutoFixPromptOptions = {}
): AutoFixPromptOutput {
  const { intent, output, softFails, hardFails = [], meta } = args;
  const { strict = false, attempt = 1 } = options;

  // Combine all fails (HARD fails take priority in messaging)
  const allFails = [...hardFails, ...softFails].filter((r) => !r.passed);

  // Filter out rules that should be SKIPPED in testMode
  const relevantFails = meta?.testMode
    ? allFails.filter((r) => !shouldSkipInTestMode(r.id, intent))
    : allFails;

  // If no relevant fails after testMode filtering, return minimal prompt
  if (relevantFails.length === 0) {
    return {
      system: 'Output the content exactly as provided.',
      user: output,
    };
  }

  // Build fix instructions from rule IDs
  const fixInstructions = relevantFails
    .map((r) => {
      const instruction = RULE_FIX_INSTRUCTIONS[r.id];
      const severity = r.severity === 'HARD' ? '[CRITICAL]' : '[QUALITY]';
      return instruction
        ? `${severity} ${instruction}`
        : `${severity} Fix: ${r.message}`;
    })
    .join('\n');

  // Language instruction
  const langHint =
    meta?.language === 'en'
      ? 'Output MUST be in English.'
      : 'Output MUST be in Vietnamese.';

  // Get expected structure for intent
  const expectedStructure = INTENT_STRUCTURE[intent] || 'Preserve original structure.';

  // Select system prompt and safe-edit policy based on strict mode
  const systemPrompt = strict ? SYSTEM_PROMPT_STRICT : SYSTEM_PROMPT_NORMAL;
  const safeEditPolicy = strict ? STRICT_SAFE_EDIT_POLICY : SAFE_EDIT_POLICY;

  // Build attempt indicator for user prompt
  const attemptIndicator = attempt > 1 ? `\n⚠️ RETRY ATTEMPT ${attempt}: Be MORE CONSERVATIVE this time.\n` : '';

  // Build the user prompt
  const userPrompt = `INTENT: ${intent}
LANGUAGE: ${meta?.language === 'en' ? 'English' : 'Vietnamese'}
${meta?.testMode ? 'MODE: testMode (relaxed thresholds apply)\n' : ''}${attemptIndicator}
EXPECTED OUTPUT STRUCTURE:
---
${expectedStructure}
---

ORIGINAL CONTENT TO FIX:
---
${output}
---

ISSUES TO FIX (${relevantFails.length}):
${fixInstructions}

${safeEditPolicy}

${langHint}

OUTPUT THE FIXED CONTENT ONLY:`;

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use buildAutoFixPrompt with options instead
 */
export function buildAutoFixPromptLegacy(args: BuildAutoFixPromptArgs): string {
  const { system, user } = buildAutoFixPrompt(args);
  return `${system}\n\n${user}`;
}

// ============================================
// TESTMODE HELPERS
// ============================================

/**
 * Rules that should be SKIPPED entirely in testMode
 * (from QUALITY_LOCK_RULE_SPEC.md testMode column = "SKIP")
 */
const TEST_MODE_SKIP_RULES: Partial<Record<IntentId, string[]>> = {
  social_caption_v1: ['social_hook_length', 'social_sentence_length'],
  seo_blog_v1: ['seo_paragraph_length'],
  video_script_v1: ['video_hook_duration'],
  email_marketing_v1: ['email_personalization'],
  landing_page_v1: ['landing_social_proof', 'landing_urgency'],
  product_description_v1: ['product_specs_format'],
  reel_caption_v1: ['reel_emoji_usage'],
};

/**
 * Check if a rule should be skipped in testMode
 */
function shouldSkipInTestMode(ruleId: string, intent: IntentId): boolean {
  const skipList = TEST_MODE_SKIP_RULES[intent] || [];
  return skipList.includes(ruleId);
}

/**
 * Get relaxed threshold info for testMode
 * (from QUALITY_LOCK_RULE_SPEC.md testMode column = "RELAX")
 */
export function getRelaxedThresholds(intent: IntentId): Record<string, { normal: string; relaxed: string }> {
  const relaxMap: Partial<Record<IntentId, Record<string, { normal: string; relaxed: string }>>> = {
    seo_blog_v1: {
      seo_keyword_density: { normal: '2-5', relaxed: '1-8' },
    },
    email_marketing_v1: {
      email_subject_length: { normal: '30-60', relaxed: '20-80' },
    },
    reel_caption_v1: {
      reel_has_hashtags: { normal: '3-10', relaxed: '1-15' },
    },
  };
  return relaxMap[intent] || {};
}

// ============================================
// UTILITY: Generate Fix Summary
// ============================================

/**
 * Generate a human-readable summary of what was fixed
 */
export function generateFixSummary(
  softFails: RuleResult[],
  hardFails: RuleResult[] = []
): string {
  const allFails = [...hardFails, ...softFails].filter((r) => !r.passed);
  if (allFails.length === 0) return 'No issues to fix.';

  const hardCount = hardFails.filter((r) => !r.passed).length;
  const softCount = softFails.filter((r) => !r.passed).length;

  const parts: string[] = [];
  if (hardCount > 0) parts.push(`${hardCount} critical issue(s)`);
  if (softCount > 0) parts.push(`${softCount} quality issue(s)`);

  return `Fixing ${parts.join(' and ')}: ${allFails.map((r) => r.id).join(', ')}`;
}
