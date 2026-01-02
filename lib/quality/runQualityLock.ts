// ============================================
// Quality Lock Evaluation Engine
// ============================================
// Evaluates AI output against intent-specific rules
// Returns decision (PASS/DRAFT/FAIL) with detailed results

import type { IntentId, RuleResult, QualityLockResult } from './intentQualityRules';
import {
  normalizeSections,
  validateStructure,
  
  hasSection,
  debugSectionDetection,
  
} from './sectionParser';

/**
 * Relax thresholds for testMode
 */
export interface RelaxThresholds {
  maxHookSentences?: number;    // Default: 2 (production)
  maxWordsPerSentence?: number; // Default: 25 (production)
}

/**
 * Quality Lock evaluation context
 */
export interface QualityLockContext {
  intent: IntentId;
  output: string;
  meta?: {
    templateId?: string;
    language?: 'vi' | 'en';
    topicKeyword?: string; // Optional keyword to check for topic relevance
    // ✅ Test Mode support
    testMode?: boolean;           // Skip/relax certain SOFT rules for testing
    skipRuleIds?: string[];       // Explicit list of rule IDs to skip
    relax?: RelaxThresholds;      // Relaxed thresholds for soft rules
  };
}

/**
 * Default rules to skip in testMode for each intent
 */
const TEST_MODE_SKIP_RULES: Partial<Record<IntentId, string[]>> = {
  social_caption_v1: [
    'social_hook_length',
    'social_sentence_length',
  ],
  seo_blog_v1: [
    'seo_meta_description_length',
    'seo_heading_structure',
  ],
  video_script_v1: [
    'video_beat_structure',
  ],
  email_marketing_v1: [
    'email_body_length',
  ],
  landing_page_v1: [
    'landing_headline_length',
  ],
  product_description_v1: [
    'product_cta_action',
  ],
  reel_caption_v1: [
    'reel_hook_length',
  ],
};

/**
 * Check if a rule should be skipped based on context
 */
function shouldSkipRule(ruleId: string, intent: IntentId, meta?: QualityLockContext['meta']): boolean {
  // Explicit skip list takes priority
  if (meta?.skipRuleIds?.includes(ruleId)) {
    return true;
  }

  // testMode enables default skip list for the intent
  if (meta?.testMode) {
    const defaultSkipList = TEST_MODE_SKIP_RULES[intent] || [];
    return defaultSkipList.includes(ruleId);
  }

  return false;
}

/**
 * Run Quality Lock evaluation on AI output
 *
 * @param ctx - Evaluation context with intent and output
 * @returns QualityLockResult with decision and detailed rule results
 */
export function runQualityLock(ctx: QualityLockContext): QualityLockResult {
  const { intent, output, meta } = ctx;

  // Route to intent-specific evaluator
  switch (intent) {
    case 'social_caption_v1':
      return evaluateSocialCaption(output, ctx.meta?.topicKeyword, meta);

    case 'seo_blog_v1':
      return evaluateSeoBlog(output, meta);

    case 'video_script_v1':
      return evaluateVideoScript(output, meta);

    case 'email_marketing_v1':
      return evaluateEmailMarketing(output, meta);

    case 'landing_page_v1':
      return evaluateLandingPage(output, meta);

    case 'product_description_v1':
      return evaluateProductDescription(output, meta);

    case 'reel_caption_v1':
      return evaluateReelCaption(output, meta);

    default:
      // Unknown intent - return PASS to avoid blocking
      console.warn(`[Quality Lock] Unknown intent: ${intent}, returning PASS`);
      return {
        passed: true,
        hardFails: [],
        softFails: [],
        allResults: [],
      };
  }
}

// ============================================
// Social Caption Evaluator (social_caption_v1)
// ============================================

function evaluateSocialCaption(
  output: string,
  topicKeyword?: string,
  meta?: QualityLockContext['meta']
): QualityLockResult {
  const allResults: RuleResult[] = [];
  const hardFails: RuleResult[] = [];
  const softFails: RuleResult[] = [];

  // Relax thresholds (use defaults if not in testMode or not specified)
  const maxHookSentences = meta?.relax?.maxHookSentences ?? 2;
  const maxWordsPerSentence = meta?.relax?.maxWordsPerSentence ?? 25;

  // Helper to check if rule should be skipped
  const skipRule = (ruleId: string) => shouldSkipRule(ruleId, 'social_caption_v1', meta);

  // ----------------------------------------
  // STRUCTURE LOCK (HARD rules) - Never skipped
  // ----------------------------------------

  // Rule: Must contain Hook:, Body:, CTA: sections
  // Use robust section parser that handles various markdown/Vietnamese formats
  const sections = normalizeSections(output);
  const structureValidation = validateStructure(sections, ['HOOK', 'BODY', 'CTA']);

  // Debug logging in development
  if (process.env.NODE_ENV === 'development' && !structureValidation.ok) {
    console.log('[Quality Lock] Structure validation failed:');
    debugSectionDetection(output);
  }

  // Build accurate failure message listing exactly which sections are missing
  const structureMessage = structureValidation.ok
    ? 'All required sections present (Hook, Body, CTA)'
    : `Thiếu section: ${structureValidation.missing.map(s => {
        switch (s) {
          case 'HOOK': return 'Hook (Mở bài)';
          case 'BODY': return 'Body (Nội dung)';
          case 'CTA': return 'CTA (Kêu gọi hành động)';
          default: return s;
        }
      }).join(', ')}. Detected: ${structureValidation.detected.length > 0
        ? structureValidation.detected.join(', ')
        : 'none'}`;

  const structureResult: RuleResult = {
    id: 'social_structure_lock',
    passed: structureValidation.ok,
    severity: 'HARD',
    message: structureMessage,
    details: {
      hasHook: hasSection(output, 'HOOK'),
      hasBody: hasSection(output, 'BODY'),
      hasCTA: hasSection(output, 'CTA'),
      missing: structureValidation.missing,
      detected: structureValidation.detected,
      // Include raw parsed sections for debugging
      rawSections: sections.raw.map(s => ({ type: s.type, label: s.label })),
    },
  };
  allResults.push(structureResult);
  if (!structureResult.passed) hardFails.push(structureResult);

  // Rule: No more than 4 sections
  // Use parsed sections count for more accurate detection
  const sectionCount = sections.raw.length;
  const maxSectionsResult: RuleResult = {
    id: 'social_max_sections',
    passed: sectionCount <= 4,
    severity: 'HARD',
    message: 'Output must not exceed 4 sections',
    details: { sectionCount, sections: sections.raw.map(s => s.label) },
  };
  allResults.push(maxSectionsResult);
  if (!maxSectionsResult.passed) hardFails.push(maxSectionsResult);

  // Rule: No meta commentary (AI self-reference)
  const metaPatterns = [
    /here is/i,
    /below is/i,
    /as an ai/i,
    /as a language model/i,
    /i('ve|'ll| will| have| can)/i,
    /dưới đây là/i,
    /đây là/i,
    /tôi sẽ/i,
  ];
  const hasMetaCommentary = metaPatterns.some(p => p.test(output));
  const metaResult: RuleResult = {
    id: 'social_no_meta_commentary',
    passed: !hasMetaCommentary,
    severity: 'HARD',
    message: 'Output must not contain meta commentary (e.g., "Here is", "As an AI")',
  };
  allResults.push(metaResult);
  if (!metaResult.passed) hardFails.push(metaResult);

  // Rule: CTA must not be generic
  // Use normalized section content
  const ctaSection = sections.cta;
  const genericCTAPatterns = [
    /tìm hiểu thêm/i,
    /xem thêm/i,
    /click here/i,
    /learn more/i,
    /read more/i,
  ];
  const hasGenericCTA = ctaSection ? genericCTAPatterns.some(p => p.test(ctaSection)) : false;
  const ctaMissingOrGeneric = !ctaSection || ctaSection.trim().length < 5 || hasGenericCTA;
  const ctaQualityResult: RuleResult = {
    id: 'social_cta_not_generic',
    passed: !ctaMissingOrGeneric,
    severity: 'HARD',
    message: 'CTA must be specific, not generic (avoid "Tìm hiểu thêm", "Xem thêm")',
    details: { ctaSection, hasGenericCTA },
  };
  allResults.push(ctaQualityResult);
  if (!ctaQualityResult.passed) hardFails.push(ctaQualityResult);

  // ----------------------------------------
  // SOFT RULES (Quality Score Indicators)
  // Can be skipped or relaxed in testMode
  // ----------------------------------------

  // Rule: Hook should be ≤ maxHookSentences (default 2)
  // Use normalized hook section
  const hookSection = sections.hook;
  const hookSentences = countSentences(hookSection || '');
  if (!skipRule('social_hook_length')) {
    const hookLengthResult: RuleResult = {
      id: 'social_hook_length',
      passed: hookSentences <= maxHookSentences,
      severity: 'SOFT',
      message: `Hook should be 1-${maxHookSentences} sentences for maximum impact`,
      details: { hookSentences, threshold: maxHookSentences },
    };
    allResults.push(hookLengthResult);
    if (!hookLengthResult.passed) softFails.push(hookLengthResult);
  }

  // Rule: Body should have multiple paragraphs for readability
  // Use normalized body section
  const bodySection = sections.body;
  // Semantic paragraph detection: split on any newline sequence, trim, filter empty
  const bodyParagraphs = bodySection
    ? bodySection.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0)
    : [];
  const paragraphCount = bodyParagraphs.length;
  if (!skipRule('social_body_formatting')) {
    const bodyFormattingResult: RuleResult = {
      id: 'social_body_formatting',
      passed: paragraphCount >= 2 || !bodySection || bodySection.length < 100,
      severity: 'SOFT',
      message: 'Body should have at least 2 paragraphs for readability',
      details: { paragraphCount },
    };
    allResults.push(bodyFormattingResult);
    if (!bodyFormattingResult.passed) softFails.push(bodyFormattingResult);
  }

  // Rule: No sentence should exceed maxWordsPerSentence (default 25)
  if (!skipRule('social_sentence_length')) {
    const allSentences = extractAllSentences(output);
    const longSentences = allSentences.filter(s => countWords(s) > maxWordsPerSentence);
    const sentenceLengthResult: RuleResult = {
      id: 'social_sentence_length',
      passed: longSentences.length === 0,
      severity: 'SOFT',
      message: `Sentences should not exceed ${maxWordsPerSentence} words for mobile readability`,
      details: { longSentenceCount: longSentences.length, examples: longSentences.slice(0, 2), threshold: maxWordsPerSentence },
    };
    allResults.push(sentenceLengthResult);
    if (!sentenceLengthResult.passed) softFails.push(sentenceLengthResult);
  }

  // Rule: Topic keyword should appear in Hook or Body (if provided)
  if (topicKeyword && topicKeyword.trim() && !skipRule('social_topic_keyword')) {
    const keyword = topicKeyword.toLowerCase().trim();
    const hookAndBody = ((hookSection || '') + ' ' + (bodySection || '')).toLowerCase();
    const hasKeyword = hookAndBody.includes(keyword);
    const topicResult: RuleResult = {
      id: 'social_topic_keyword',
      passed: hasKeyword,
      severity: 'SOFT',
      message: `Topic keyword "${topicKeyword}" should appear in Hook or Body`,
      details: { topicKeyword, found: hasKeyword },
    };
    allResults.push(topicResult);
    if (!topicResult.passed) softFails.push(topicResult);
  }

  // Rule: CTA should be exactly 1 sentence with clear action intent
  if (!skipRule('social_cta_action_verb')) {
    const ctaSentences = countSentences(ctaSection || '');
    // Action intent patterns: Vietnamese imperatives/invitations + English equivalents
    const actionIntentPatterns = [
      // Vietnamese action intent
      /bình luận/i,
      /chia sẻ/i,
      /lưu/i,
      /hãy/i,
      /để lại/i,
      /kể/i,
      /nói/i,
      /theo dõi/i,
      /đăng ký/i,
      /cùng/i,
      /inbox/i,
      /dm/i,
      /liên hệ/i,
      /gọi/i,
      /đặt/i,
      /mua/i,
      /nhấn/i,
      /thích/i,
      /tag/i,
      // English action intent
      /comment/i,
      /share/i,
      /save/i,
      /follow/i,
      /subscribe/i,
      /click/i,
      /like/i,
    ];
    const hasActionIntent = actionIntentPatterns.some(p => p.test(ctaSection || ''));
    const ctaActionResult: RuleResult = {
      id: 'social_cta_action_verb',
      passed: ctaSentences === 1 && hasActionIntent,
      severity: 'SOFT',
      message: 'CTA should be exactly 1 sentence with clear action intent',
      details: { ctaSentences, hasActionIntent },
    };
    allResults.push(ctaActionResult);
    if (!ctaActionResult.passed) softFails.push(ctaActionResult);
  }

  // ----------------------------------------
  // Decision Logic
  // ----------------------------------------
  let decision: 'PASS' | 'DRAFT' | 'FAIL';
  if (hardFails.length > 0) {
    decision = 'FAIL';
  } else if (softFails.length > 0) {
    decision = 'DRAFT';
  } else {
    decision = 'PASS';
  }

  return {
    passed: decision === 'PASS',
    hardFails,
    softFails,
    allResults,
  };
}

// ============================================
// SEO Blog Evaluator (seo_blog_v1)
// ============================================

function evaluateSeoBlog(
  output: string,
  meta?: QualityLockContext['meta']
): QualityLockResult {
  const allResults: RuleResult[] = [];
  const hardFails: RuleResult[] = [];
  const softFails: RuleResult[] = [];

  const skipRule = (ruleId: string) => shouldSkipRule(ruleId, 'seo_blog_v1', meta);

  // ----------------------------------------
  // STRUCTURE LOCK (HARD rules)
  // ----------------------------------------

  // Required sections: Title, Meta Description, Introduction, Main Content, Conclusion
  const hasTitle = extractSection(output, 'Title') !== null;
  const hasMetaDescription = extractSection(output, 'Meta Description') !== null;
  const hasIntroduction = extractSection(output, 'Introduction') !== null;
  const hasMainContent = extractSection(output, 'Main Content Sections') !== null
    || /##\s+.+/m.test(output); // Also accept H2 headings as main content
  const hasConclusion = extractSection(output, 'Conclusion') !== null
    || extractSection(output, 'Kết Luận') !== null;

  const structureResult: RuleResult = {
    id: 'seo_structure_lock',
    passed: hasTitle && hasMetaDescription && hasIntroduction && hasMainContent && hasConclusion,
    severity: 'HARD',
    message: 'Output must contain Title, Meta Description, Introduction, Main Content Sections, and Conclusion',
    details: { hasTitle, hasMetaDescription, hasIntroduction, hasMainContent, hasConclusion },
  };
  allResults.push(structureResult);
  if (!structureResult.passed) hardFails.push(structureResult);

  // Rule: No meta commentary
  const metaCommentaryResult = checkMetaCommentary(output, 'seo_no_meta_commentary');
  allResults.push(metaCommentaryResult);
  if (!metaCommentaryResult.passed) hardFails.push(metaCommentaryResult);

  // Rule: Title must not be empty and should be reasonable length (50-70 chars ideal)
  const titleSection = extractSection(output, 'Title');
  const titleLength = titleSection?.trim().length || 0;
  const titleLengthResult: RuleResult = {
    id: 'seo_title_length',
    passed: titleLength >= 20 && titleLength <= 80,
    severity: 'HARD',
    message: 'Title should be 20-80 characters for optimal SEO',
    details: { titleLength, titleSection },
  };
  allResults.push(titleLengthResult);
  if (!titleLengthResult.passed) hardFails.push(titleLengthResult);

  // ----------------------------------------
  // SOFT RULES
  // ----------------------------------------

  // Rule: Meta description should be 120-160 characters
  if (!skipRule('seo_meta_description_length')) {
    const metaDescSection = extractSection(output, 'Meta Description');
    const metaDescLength = metaDescSection?.trim().length || 0;
    const metaDescResult: RuleResult = {
      id: 'seo_meta_description_length',
      passed: metaDescLength >= 100 && metaDescLength <= 170,
      severity: 'SOFT',
      message: 'Meta description should be 100-170 characters for optimal display',
      details: { metaDescLength },
    };
    allResults.push(metaDescResult);
    if (!metaDescResult.passed) softFails.push(metaDescResult);
  }

  // Rule: Should have H2 headings for structure
  if (!skipRule('seo_heading_structure')) {
    const h2Count = (output.match(/^##\s+.+$/gm) || []).length;
    const headingResult: RuleResult = {
      id: 'seo_heading_structure',
      passed: h2Count >= 2,
      severity: 'SOFT',
      message: 'Blog should have at least 2 H2 headings for proper structure',
      details: { h2Count },
    };
    allResults.push(headingResult);
    if (!headingResult.passed) softFails.push(headingResult);
  }

  // Decision logic
  let decision: 'PASS' | 'DRAFT' | 'FAIL';
  if (hardFails.length > 0) {
    decision = 'FAIL';
  } else if (softFails.length > 0) {
    decision = 'DRAFT';
  } else {
    decision = 'PASS';
  }

  return { passed: decision === 'PASS', hardFails, softFails, allResults };
}

// ============================================
// Video Script Evaluator (video_script_v1)
// ============================================

function evaluateVideoScript(
  output: string,
  meta?: QualityLockContext['meta']
): QualityLockResult {
  const allResults: RuleResult[] = [];
  const hardFails: RuleResult[] = [];
  const softFails: RuleResult[] = [];

  const skipRule = (ruleId: string) => shouldSkipRule(ruleId, 'video_script_v1', meta);

  // ----------------------------------------
  // STRUCTURE LOCK (HARD rules)
  // ----------------------------------------

  // Required sections: Hook, Main Content, CTA
  const hasHook = extractSection(output, 'Hook') !== null
    || extractSection(output, 'Hook (0-3s)') !== null
    || extractSection(output, 'Hook (0–3s)') !== null;
  const hasMainContent = extractSection(output, 'Main Content') !== null
    || /\*\*Scene\s+\d+/i.test(output)
    || /Beat\s+\d+/i.test(output);
  const hasCTA = extractSection(output, 'CTA') !== null
    || extractSection(output, 'Call-to-Action') !== null;

  const structureResult: RuleResult = {
    id: 'video_structure_lock',
    passed: hasHook && hasMainContent && hasCTA,
    severity: 'HARD',
    message: 'Output must contain Hook (0-3s), Main Content (beats/scenes), and Call-to-Action',
    details: { hasHook, hasMainContent, hasCTA },
  };
  allResults.push(structureResult);
  if (!structureResult.passed) hardFails.push(structureResult);

  // Rule: No meta commentary
  const metaCommentaryResult = checkMetaCommentary(output, 'video_no_meta_commentary');
  allResults.push(metaCommentaryResult);
  if (!metaCommentaryResult.passed) hardFails.push(metaCommentaryResult);

  // Rule: CTA must not be generic
  const ctaSection = extractSection(output, 'CTA') || extractSection(output, 'Call-to-Action');
  const genericCTAPatterns = [/tìm hiểu thêm/i, /xem thêm/i, /click here/i, /learn more/i];
  const hasGenericCTA = ctaSection ? genericCTAPatterns.some(p => p.test(ctaSection)) : false;
  const ctaMissingOrGeneric = !ctaSection || ctaSection.trim().length < 5 || hasGenericCTA;
  const ctaQualityResult: RuleResult = {
    id: 'video_cta_not_generic',
    passed: !ctaMissingOrGeneric,
    severity: 'HARD',
    message: 'CTA must be specific (e.g., "Comment CAFE", "Follow để xem thêm")',
    details: { ctaSection, hasGenericCTA },
  };
  allResults.push(ctaQualityResult);
  if (!ctaQualityResult.passed) hardFails.push(ctaQualityResult);

  // ----------------------------------------
  // SOFT RULES
  // ----------------------------------------

  // Rule: Should have beat/scene structure
  if (!skipRule('video_beat_structure')) {
    const beatCount = (output.match(/Beat\s+\d+|Scene\s+\d+/gi) || []).length;
    const beatResult: RuleResult = {
      id: 'video_beat_structure',
      passed: beatCount >= 2,
      severity: 'SOFT',
      message: 'Video script should have at least 2 beats/scenes',
      details: { beatCount },
    };
    allResults.push(beatResult);
    if (!beatResult.passed) softFails.push(beatResult);
  }

  // Decision logic
  let decision: 'PASS' | 'DRAFT' | 'FAIL';
  if (hardFails.length > 0) {
    decision = 'FAIL';
  } else if (softFails.length > 0) {
    decision = 'DRAFT';
  } else {
    decision = 'PASS';
  }

  return { passed: decision === 'PASS', hardFails, softFails, allResults };
}

// ============================================
// Email Marketing Evaluator (email_marketing_v1)
// ============================================

function evaluateEmailMarketing(
  output: string,
  meta?: QualityLockContext['meta']
): QualityLockResult {
  const allResults: RuleResult[] = [];
  const hardFails: RuleResult[] = [];
  const softFails: RuleResult[] = [];

  const skipRule = (ruleId: string) => shouldSkipRule(ruleId, 'email_marketing_v1', meta);

  // ----------------------------------------
  // STRUCTURE LOCK (HARD rules)
  // ----------------------------------------

  // Required sections: Subject, Email Body, CTA
  const hasSubject = extractSection(output, 'Subject') !== null;
  const hasEmailBody = extractSection(output, 'Email Body') !== null;
  const hasCTA = extractSection(output, 'CTA') !== null
    || extractSection(output, 'Call-to-Action') !== null;

  const structureResult: RuleResult = {
    id: 'email_structure_lock',
    passed: hasSubject && hasEmailBody && hasCTA,
    severity: 'HARD',
    message: 'Output must contain Subject, Email Body, and Call-to-Action',
    details: { hasSubject, hasEmailBody, hasCTA },
  };
  allResults.push(structureResult);
  if (!structureResult.passed) hardFails.push(structureResult);

  // Rule: No meta commentary
  const metaCommentaryResult = checkMetaCommentary(output, 'email_no_meta_commentary');
  allResults.push(metaCommentaryResult);
  if (!metaCommentaryResult.passed) hardFails.push(metaCommentaryResult);

  // Rule: Subject line should be ≤50 characters
  const subjectSection = extractSection(output, 'Subject');
  const subjectLength = subjectSection?.trim().length || 0;
  const subjectLengthResult: RuleResult = {
    id: 'email_subject_length',
    passed: subjectLength > 0 && subjectLength <= 60,
    severity: 'HARD',
    message: 'Subject line should be ≤60 characters for optimal open rates',
    details: { subjectLength, subjectSection },
  };
  allResults.push(subjectLengthResult);
  if (!subjectLengthResult.passed) hardFails.push(subjectLengthResult);

  // Rule: CTA must not be generic
  const ctaSection = extractSection(output, 'CTA') || extractSection(output, 'Call-to-Action');
  const genericCTAPatterns = [/tìm hiểu thêm/i, /xem thêm/i, /click here/i, /learn more/i, /read more/i];
  const hasGenericCTA = ctaSection ? genericCTAPatterns.some(p => p.test(ctaSection)) : false;
  const ctaMissingOrGeneric = !ctaSection || ctaSection.trim().length < 5 || hasGenericCTA;
  const ctaQualityResult: RuleResult = {
    id: 'email_cta_not_generic',
    passed: !ctaMissingOrGeneric,
    severity: 'HARD',
    message: 'CTA must be specific (e.g., "Reply CÁCH", "Đăng ký ngay")',
    details: { ctaSection, hasGenericCTA },
  };
  allResults.push(ctaQualityResult);
  if (!ctaQualityResult.passed) hardFails.push(ctaQualityResult);

  // ----------------------------------------
  // SOFT RULES
  // ----------------------------------------

  // Rule: Email body should be mobile-friendly (120-300 words)
  if (!skipRule('email_body_length')) {
    const emailBody = extractSection(output, 'Email Body') || '';
    const wordCount = countWords(emailBody);
    const bodyLengthResult: RuleResult = {
      id: 'email_body_length',
      passed: wordCount >= 50 && wordCount <= 350,
      severity: 'SOFT',
      message: 'Email body should be 50-350 words for optimal engagement',
      details: { wordCount },
    };
    allResults.push(bodyLengthResult);
    if (!bodyLengthResult.passed) softFails.push(bodyLengthResult);
  }

  // Decision logic
  let decision: 'PASS' | 'DRAFT' | 'FAIL';
  if (hardFails.length > 0) {
    decision = 'FAIL';
  } else if (softFails.length > 0) {
    decision = 'DRAFT';
  } else {
    decision = 'PASS';
  }

  return { passed: decision === 'PASS', hardFails, softFails, allResults };
}

// ============================================
// Landing Page Evaluator (landing_page_v1)
// ============================================

function evaluateLandingPage(
  output: string,
  meta?: QualityLockContext['meta']
): QualityLockResult {
  const allResults: RuleResult[] = [];
  const hardFails: RuleResult[] = [];
  const softFails: RuleResult[] = [];

  const skipRule = (ruleId: string) => shouldSkipRule(ruleId, 'landing_page_v1', meta);

  // ----------------------------------------
  // STRUCTURE LOCK (HARD rules)
  // ----------------------------------------

  // Required sections: Hero Headline, Sub-headline, Key Benefits, Offer/CTA
  const hasHeroHeadline = extractSection(output, 'Hero Headline') !== null;
  const hasSubHeadline = extractSection(output, 'Sub-headline') !== null
    || extractSection(output, 'Subheadline') !== null;
  const hasKeyBenefits = extractSection(output, 'Key Benefits') !== null;
  const hasOfferCTA = extractSection(output, 'Offer / CTA') !== null
    || extractSection(output, 'Offer/CTA') !== null
    || extractSection(output, 'CTA') !== null;

  const structureResult: RuleResult = {
    id: 'landing_structure_lock',
    passed: hasHeroHeadline && hasSubHeadline && hasKeyBenefits && hasOfferCTA,
    severity: 'HARD',
    message: 'Output must contain Hero Headline, Sub-headline, Key Benefits, and Offer/CTA',
    details: { hasHeroHeadline, hasSubHeadline, hasKeyBenefits, hasOfferCTA },
  };
  allResults.push(structureResult);
  if (!structureResult.passed) hardFails.push(structureResult);

  // Rule: No meta commentary
  const metaCommentaryResult = checkMetaCommentary(output, 'landing_no_meta_commentary');
  allResults.push(metaCommentaryResult);
  if (!metaCommentaryResult.passed) hardFails.push(metaCommentaryResult);

  // Rule: Key Benefits should be in bullet format (3-5 items)
  const keyBenefits = extractSection(output, 'Key Benefits') || '';
  const bulletCount = (keyBenefits.match(/^[\s]*[•\-\*✓✔]/gm) || []).length;
  const benefitsBulletResult: RuleResult = {
    id: 'landing_benefits_format',
    passed: bulletCount >= 3,
    severity: 'HARD',
    message: 'Key Benefits should have at least 3 bullet points',
    details: { bulletCount },
  };
  allResults.push(benefitsBulletResult);
  if (!benefitsBulletResult.passed) hardFails.push(benefitsBulletResult);

  // ----------------------------------------
  // SOFT RULES
  // ----------------------------------------

  // Rule: Hero headline should be short and impactful
  if (!skipRule('landing_headline_length')) {
    const heroHeadline = extractSection(output, 'Hero Headline') || '';
    const headlineLength = heroHeadline.trim().length;
    const headlineLengthResult: RuleResult = {
      id: 'landing_headline_length',
      passed: headlineLength >= 10 && headlineLength <= 80,
      severity: 'SOFT',
      message: 'Hero headline should be 10-80 characters for maximum impact',
      details: { headlineLength },
    };
    allResults.push(headlineLengthResult);
    if (!headlineLengthResult.passed) softFails.push(headlineLengthResult);
  }

  // Decision logic
  let decision: 'PASS' | 'DRAFT' | 'FAIL';
  if (hardFails.length > 0) {
    decision = 'FAIL';
  } else if (softFails.length > 0) {
    decision = 'DRAFT';
  } else {
    decision = 'PASS';
  }

  return { passed: decision === 'PASS', hardFails, softFails, allResults };
}

// ============================================
// Product Description Evaluator (product_description_v1)
// ============================================

function evaluateProductDescription(
  output: string,
  meta?: QualityLockContext['meta']
): QualityLockResult {
  const allResults: RuleResult[] = [];
  const hardFails: RuleResult[] = [];
  const softFails: RuleResult[] = [];

  const skipRule = (ruleId: string) => shouldSkipRule(ruleId, 'product_description_v1', meta);

  // ----------------------------------------
  // STRUCTURE LOCK (HARD rules)
  // ----------------------------------------

  // Required sections: Product Title, Key Benefits, CTA
  const hasProductTitle = extractSection(output, 'Product Title') !== null;
  const hasKeyBenefits = extractSection(output, 'Key Benefits') !== null;
  const hasCTA = extractSection(output, 'CTA') !== null
    || extractSection(output, 'Call-to-Action') !== null;

  const structureResult: RuleResult = {
    id: 'product_structure_lock',
    passed: hasProductTitle && hasKeyBenefits && hasCTA,
    severity: 'HARD',
    message: 'Output must contain Product Title, Key Benefits, and Call-to-Action',
    details: { hasProductTitle, hasKeyBenefits, hasCTA },
  };
  allResults.push(structureResult);
  if (!structureResult.passed) hardFails.push(structureResult);

  // Rule: No meta commentary
  const metaCommentaryResult = checkMetaCommentary(output, 'product_no_meta_commentary');
  allResults.push(metaCommentaryResult);
  if (!metaCommentaryResult.passed) hardFails.push(metaCommentaryResult);

  // Rule: Key Benefits should have bullet points
  const keyBenefits = extractSection(output, 'Key Benefits') || '';
  const bulletCount = (keyBenefits.match(/^[\s]*[•\-\*✓✔]/gm) || []).length;
  const benefitsBulletResult: RuleResult = {
    id: 'product_benefits_format',
    passed: bulletCount >= 2,
    severity: 'HARD',
    message: 'Key Benefits should have at least 2 bullet points',
    details: { bulletCount },
  };
  allResults.push(benefitsBulletResult);
  if (!benefitsBulletResult.passed) hardFails.push(benefitsBulletResult);

  // ----------------------------------------
  // SOFT RULES
  // ----------------------------------------

  // Rule: CTA should have action intent
  if (!skipRule('product_cta_action')) {
    const ctaSection = extractSection(output, 'CTA') || extractSection(output, 'Call-to-Action') || '';
    const actionPatterns = [/mua/i, /đặt/i, /order/i, /inbox/i, /liên hệ/i, /gọi/i, /click/i, /add/i, /cart/i, /giỏ/i];
    const hasActionIntent = actionPatterns.some(p => p.test(ctaSection));
    const ctaActionResult: RuleResult = {
      id: 'product_cta_action',
      passed: hasActionIntent,
      severity: 'SOFT',
      message: 'CTA should have clear action intent (mua, đặt hàng, inbox, etc.)',
      details: { ctaSection, hasActionIntent },
    };
    allResults.push(ctaActionResult);
    if (!ctaActionResult.passed) softFails.push(ctaActionResult);
  }

  // Decision logic
  let decision: 'PASS' | 'DRAFT' | 'FAIL';
  if (hardFails.length > 0) {
    decision = 'FAIL';
  } else if (softFails.length > 0) {
    decision = 'DRAFT';
  } else {
    decision = 'PASS';
  }

  return { passed: decision === 'PASS', hardFails, softFails, allResults };
}

// ============================================
// Reel Caption Evaluator (reel_caption_v1)
// ============================================

function evaluateReelCaption(
  output: string,
  meta?: QualityLockContext['meta']
): QualityLockResult {
  const allResults: RuleResult[] = [];
  const hardFails: RuleResult[] = [];
  const softFails: RuleResult[] = [];

  const skipRule = (ruleId: string) => shouldSkipRule(ruleId, 'reel_caption_v1', meta);

  // ----------------------------------------
  // STRUCTURE LOCK (HARD rules)
  // ----------------------------------------

  // Required sections: Hook Line, Engagement CTA
  const hasHookLine = extractSection(output, 'Hook Line') !== null;
  const hasEngagementCTA = extractSection(output, 'Engagement CTA') !== null
    || extractSection(output, 'CTA') !== null;

  const structureResult: RuleResult = {
    id: 'reel_structure_lock',
    passed: hasHookLine && hasEngagementCTA,
    severity: 'HARD',
    message: 'Output must contain Hook Line and Engagement CTA',
    details: { hasHookLine, hasEngagementCTA },
  };
  allResults.push(structureResult);
  if (!structureResult.passed) hardFails.push(structureResult);

  // Rule: No meta commentary
  const metaCommentaryResult = checkMetaCommentary(output, 'reel_no_meta_commentary');
  allResults.push(metaCommentaryResult);
  if (!metaCommentaryResult.passed) hardFails.push(metaCommentaryResult);

  // Rule: Total caption should be very short (max 4 lines)
  const lineCount = output.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('**') && !trimmed.startsWith('---');
  }).length;
  const lengthResult: RuleResult = {
    id: 'reel_max_length',
    passed: lineCount <= 8, // Allow some flexibility for formatting
    severity: 'HARD',
    message: 'Reel caption should be ultra-short (read in 3-5 seconds)',
    details: { lineCount },
  };
  allResults.push(lengthResult);
  if (!lengthResult.passed) hardFails.push(lengthResult);

  // Rule: CTA should drive specific engagement
  const ctaSection = extractSection(output, 'Engagement CTA') || extractSection(output, 'CTA') || '';
  const engagementPatterns = [/comment/i, /save/i, /share/i, /follow/i, /tag/i, /dm/i, /inbox/i, /lưu/i, /chia sẻ/i, /bình luận/i, /theo dõi/i];
  const hasEngagementIntent = engagementPatterns.some(p => p.test(ctaSection));
  const genericCTAPatterns = [/tìm hiểu thêm/i, /xem thêm/i, /click here/i];
  const isGeneric = genericCTAPatterns.some(p => p.test(ctaSection));
  const ctaQualityResult: RuleResult = {
    id: 'reel_cta_engagement',
    passed: hasEngagementIntent && !isGeneric,
    severity: 'HARD',
    message: 'CTA must drive specific engagement (comment X, save nếu Y, etc.)',
    details: { ctaSection, hasEngagementIntent, isGeneric },
  };
  allResults.push(ctaQualityResult);
  if (!ctaQualityResult.passed) hardFails.push(ctaQualityResult);

  // ----------------------------------------
  // SOFT RULES
  // ----------------------------------------

  // Rule: Hook line should be punchy and short
  if (!skipRule('reel_hook_length')) {
    const hookLine = extractSection(output, 'Hook Line') || '';
    const hookLength = hookLine.trim().length;
    const hookLengthResult: RuleResult = {
      id: 'reel_hook_length',
      passed: hookLength >= 10 && hookLength <= 100,
      severity: 'SOFT',
      message: 'Hook line should be 10-100 characters for maximum punch',
      details: { hookLength },
    };
    allResults.push(hookLengthResult);
    if (!hookLengthResult.passed) softFails.push(hookLengthResult);
  }

  // Decision logic
  let decision: 'PASS' | 'DRAFT' | 'FAIL';
  if (hardFails.length > 0) {
    decision = 'FAIL';
  } else if (softFails.length > 0) {
    decision = 'DRAFT';
  } else {
    decision = 'PASS';
  }

  return { passed: decision === 'PASS', hardFails, softFails, allResults };
}

// ============================================
// Shared Helper: Meta Commentary Check
// ============================================

/**
 * Check for meta commentary (AI self-reference, explanations, etc.)
 */
function checkMetaCommentary(output: string, ruleId: string): RuleResult {
  const metaPatterns = [
    /here is/i,
    /below is/i,
    /as an ai/i,
    /as a language model/i,
    /i('ve|'ll| will| have| can)/i,
    /dưới đây là/i,
    /đây là (bài|nội dung|caption|email|script)/i,
    /tôi sẽ/i,
    /tôi đã/i,
    /mình sẽ viết/i,
    /let me/i,
    /i hope this/i,
  ];
  const hasMetaCommentary = metaPatterns.some(p => p.test(output));
  return {
    id: ruleId,
    passed: !hasMetaCommentary,
    severity: 'HARD',
    message: 'Output must not contain meta commentary (e.g., "Here is", "As an AI", "Đây là bài")',
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract content of a labeled section (e.g., "Hook:", "Body:", "CTA:")
 * Supports multiple label variations (e.g., "CTA" and "Call-to-Action")
 */
function extractSection(output: string, label: string): string | null {
  // Build label variations for common aliases
  const labelVariations = [label];

  // Add common aliases
  if (label.toLowerCase() === 'cta') {
    labelVariations.push('Call-to-Action');
  } else if (label.toLowerCase() === 'call-to-action') {
    labelVariations.push('CTA');
  }

  // Add variations with spaces/hyphens for multi-word labels
  if (label.includes(' ')) {
    labelVariations.push(label.replace(/ /g, '-'));
  }
  if (label.includes('-')) {
    labelVariations.push(label.replace(/-/g, ' '));
  }

  for (const variation of labelVariations) {
    // Escape special regex characters in label
    const escapedLabel = variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Try markdown format first: **Label:**
    const mdPattern = new RegExp(`\\*\\*${escapedLabel}:\\*\\*\\s*([\\s\\S]*?)(?=\\*\\*[A-Za-z][A-Za-z\\s\\-/()]*:\\*\\*|$)`, 'i');
    const mdMatch = output.match(mdPattern);
    if (mdMatch) {
      return mdMatch[1].trim();
    }

    // Try plain format: Label:
    const plainPattern = new RegExp(`^${escapedLabel}:\\s*([\\s\\S]*?)(?=^[A-Za-z][A-Za-z\\s\\-/()]*:|$)`, 'im');
    const plainMatch = output.match(plainPattern);
    if (plainMatch) {
      return plainMatch[1].trim();
    }
  }

  return null;
}

/**
 * Count sentences in text (approximation)
 */
function countSentences(text: string): number {
  if (!text.trim()) return 0;
  // Split on sentence-ending punctuation
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.length;
}

/**
 * Extract all sentences from output
 */
function extractAllSentences(output: string): string[] {
  // Remove section labels for cleaner sentence extraction
  const cleaned = output.replace(/\*\*[A-Za-z\s]+:\*\*/g, '');
  const sentences = cleaned.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  return sentences;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}
