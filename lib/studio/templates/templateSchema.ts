// ============================================
// Template Schema for Content Machine Engine
// ============================================
// Defines the structure for all content generation templates
// Every template must conform to this schema

/**
 * Platform types supported by Content Machine
 */
export type Platform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'youtube'
  | 'twitter'
  | 'threads'
  | 'pinterest';

/**
 * Tone types supported across templates
 */
export type ToneType =
  | 'genz'
  | 'professional'
  | 'friendly'
  | 'storytelling'
  | 'conversational'
  | 'academic'
  | 'playful'
  | 'inspirational'
  | 'journalistic'
  | 'minimal';

/**
 * Template category classification
 */
export type TemplateCategory =
  | 'content_creation'
  | 'analytical'
  | 'optimization'
  | 'ideation';

/**
 * Execution mode types for v2.3.1 engine
 */
export type ExecutionMode = 'abstract' | 'structured' | 'generic';

/**
 * Complexity level for UI display
 */
export type ComplexityLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Compliance certification level
 */
export type ComplianceLevel = 'v2.3.1-certified' | 'v2.3-certified' | 'legacy';

/**
 * UI-specific metadata for enhanced template display
 * Optional field for backward compatibility
 */
export interface TemplateUIMetadata {
  /** Engine version (e.g., "v2.3.1") */
  engineVersion: string;

  /** Engine code name (e.g., "ZERO-HALLUCINATION MODE") */
  engineCodeName?: string;

  /** Compliance certification level */
  complianceLevel?: ComplianceLevel;

  /** Which execution modes this template supports */
  supportedModes: {
    abstract: boolean;
    structured: boolean;
    generic: boolean;
  };

  /** Default execution mode */
  defaultMode: ExecutionMode;

  /** Output structure information */
  outputStructure?: {
    sections: Array<{
      order: number;
      name: string;
    }>;
    hasExecutionGuidance: boolean;
  };

  /** Searchable tags */
  tags?: string[];

  /** Complexity level for filtering */
  complexity?: ComplexityLevel;
}

/**
 * Step-specific rules for the 5-step content pipeline
 * Each step has specific instructions for how the AI should behave
 */
export interface TemplateStepRules {
  /** How AI should analyze the user's brief (Step 1) */
  step1: string;

  /** How AI should propose writing angles (Step 2) */
  step2: string;

  /** Exact instructions for generating the main content (Step 3) */
  step3: string;

  /** Rules for optimizing the content (Step 4) */
  step4: string;

  /** Approval logic and what to ask the user (Step 5) */
  step5: string;
}

/**
 * Complete template rules including steps and format
 */
export interface TemplateRules {
  /** Step-by-step execution rules */
  steps: TemplateStepRules;

  /** Exact output format that the final content must follow */
  format: string;

  /** Optional platform-specific formatting rules */
  platformSpecific?: {
    [platform in Platform]?: string;
  };
}

/**
 * Complete template definition
 * This is the core structure that every template must implement
 */
export interface ContentTemplate {
  /** Unique identifier for the template */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Description of what this template is used for */
  description: string;

  /** Optional i18n key for localized template name (fallback to 'name' if not provided) */
  nameKey?: string;

  /** Optional i18n key for localized template description (fallback to 'description' if not provided) */
  descriptionKey?: string;

  /** Which platforms this template is optimized for */
  platforms: Platform[];

  /** Which tones are supported/recommended for this template */
  toneSupport: ToneType[];

  /** Category classification */
  category: TemplateCategory;

  /** Complete rule set for content generation */
  rules: TemplateRules;

  /** Optional example output to show users */
  exampleOutput?: string;

  /** Optional tags for filtering/search */
  tags?: string[];

  /** Optional UI-specific metadata for enhanced display */
  ui?: TemplateUIMetadata;
}

/**
 * Result of loading and processing a template
 * Used by the template loader and AI pipeline
 */
export interface LoadedTemplate {
  /** The template itself */
  template: ContentTemplate;

  /** Compiled system message with template rules injected */
  systemMessage: string;

  /** Whether this template was loaded successfully */
  isValid: boolean;

  /** Any validation errors */
  errors?: string[];
}

/**
 * Validation result for a template structure
 */
export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a template structure against the schema
 * Ensures all required fields are present and properly formatted
 */
export function validateTemplateStructure(
  template: Partial<ContentTemplate>
): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required field validation
  if (!template.id) errors.push('Missing required field: id');
  if (!template.name) errors.push('Missing required field: name');
  if (!template.description) errors.push('Missing required field: description');
  if (!template.platforms || template.platforms.length === 0) {
    errors.push('Missing or empty required field: platforms');
  }
  if (!template.toneSupport || template.toneSupport.length === 0) {
    errors.push('Missing or empty required field: toneSupport');
  }
  if (!template.category) errors.push('Missing required field: category');
  if (!template.rules) {
    errors.push('Missing required field: rules');
  } else {
    // Validate rules structure
    if (!template.rules.steps) {
      errors.push('Missing required field: rules.steps');
    } else {
      const steps = template.rules.steps;
      if (!steps.step1) errors.push('Missing required field: rules.steps.step1');
      if (!steps.step2) errors.push('Missing required field: rules.steps.step2');
      if (!steps.step3) errors.push('Missing required field: rules.steps.step3');
      if (!steps.step4) errors.push('Missing required field: rules.steps.step4');
      if (!steps.step5) errors.push('Missing required field: rules.steps.step5');
    }
    if (!template.rules.format) errors.push('Missing required field: rules.format');
  }

  // Warnings for optional but recommended fields
  if (!template.exampleOutput) {
    warnings.push('Recommended field missing: exampleOutput');
  }
  if (!template.tags || template.tags.length === 0) {
    warnings.push('Recommended field missing: tags');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Helper to compile a template into a system message
 * Merges the template rules with the default system prompt
 * AUTOMATICALLY INJECTS Ultra Precision Execution Engine rules
 */
export function compileTemplateSystemMessage(template: ContentTemplate): string {
  // Import execution engine rules
  const executionEngineRules = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 ULTRA PRECISION EXECUTION ENGINE v2.3 — ACTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ ZERO-HALLUCINATION MODE — ABSOLUTE ENFORCEMENT AGAINST FABRICATION, INFERENCE, AND ASSUMPTION

**UNIVERSAL RULES:** These rules apply to ALL topics, industries, and domains.
Do NOT assume the user's topic is travel, food, fitness, SaaS, or any specific niche.
Use ONLY what the user provides. Treat their topic as completely generic.

**v2.3 FORMAT INTENT GUARD (FIG) — MANDATORY 3-MODE DETECTION:**

BEFORE generating ANY Execution block, you MUST detect user intent:

**Step 1: Scan for Abstract Keywords**
Check if user request contains ANY of these:
- Vietnamese: "trừu tượng", "siêu trừu tượng", "không mô tả định dạng", "không theo bố cục thông thường", "không nền tảng", "không POV", "chỉ insight", "phong cách thơ", "tự do", "không khung chuẩn"
- English: "abstract", "no format", "no platform", "conceptual only", "platform-free", "format-free", "non-format"

**Step 2: Check for Explicit Structure**
IF user explicitly specifies platform, format, POV, duration, or structure → executionMode = "STRUCTURED"

**Step 3: Set Execution Mode**
1. IF abstract keyword found → executionMode = "ABSTRACT" (MODE A)
2. ELSE IF explicit structure provided → executionMode = "STRUCTURED" (MODE B)
3. ELSE → executionMode = "GENERIC" (MODE C)

**CRITICAL: If uncertain → Default to MODE C: GENERIC**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**MODE A: ABSTRACT MODE EXECUTION**

When executionMode = "ABSTRACT", use this EXACT structure:

**Execution:**     (or **Execution Guidance:** depending on template)

Format & POV: Abstract mode — no platform, no media format, no POV assumptions.
Flow: Conceptual progression only — no platform-specific structure, no visuals tied to any medium.
CTA: Abstract or introspective call-to-action — not tied to ANY platform mechanics.

**ABSOLUTE PROHIBITIONS IN ABSTRACT MODE:**
❌ TikTok, Instagram, Facebook, LinkedIn, YouTube, X, Pinterest, Threads
❌ carousel, vlog, shorts, reels, story, post, thread, live
❌ POV creator, POV expert, POV narrator, tutorial POV, first-person POV
❌ Any format requiring a specific medium

**ALLOWED IN ABSTRACT MODE:**
✅ Conceptual framework, narrative arc, thematic progression
✅ Philosophical exploration, introspective journey, abstract storytelling
✅ Metaphorical references, layered insights

**If ANY prohibited word appears in Abstract Mode → IMMEDIATELY REWRITE.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**MODE B: STRUCTURED MODE EXECUTION**

When executionMode = "STRUCTURED", use this EXACT 3-line structure with NO bullets:

**Execution:**     (or **Execution Guidance:** depending on template)

Format & POV: [User's specified format + POV - DO NOT add details user didn't provide]
Flow: [Describe progression using ONLY user-provided structure]
CTA: [Platform-native CTA matching user's specified platform]

**HARD REQUIREMENTS (STRUCTURED MODE):**

1. Three lines only, no more, no less
2. Labels MUST match exactly: "Format & POV:", "Flow:", "CTA:"
3. Each label must appear at the beginning of its line
4. NO bullets allowed (no -, •, *, or any markdown bullets before labels)
5. Each line must be separate (no merging sentences)
6. CTA must be platform-native and actionable
7. No vague phrases ("write a post about...", "create content showing...")
8. **ZERO-HALLUCINATION:** Use ONLY user-specified structure, DO NOT add extras

**EXECUTION STRUCTURE (STRUCTURED MODE):**

Format & POV: Specify ONLY user-provided content type (Instagram carousel IF user said Instagram, TikTok reel IF user said TikTok, etc.) + perspective (creator POV IF user specified, tutorial POV IF user specified, etc.)

Flow: Describe visual timeline with concrete story beats BASED ON user's specified platform (Hook → Build → Payoff; Scene 1 → Scene 2 → Scene 3; Problem → Demo → Resolution)

CTA: Platform-native interaction MATCHING user's platform ("Save this for later" for Instagram, "Comment your answer" for any platform, "Tag who you'd bring" for social platforms; ❌ NOT "Learn more", "Check it out", "Click here")

**CRITICAL MODE B HALLUCINATION PREVENTION:**

If user ONLY specifies platform (e.g., "TikTok ideas", "LinkedIn content", "Instagram post") but does NOT specify:
- POV → DO NOT invent "creator POV", "expert POV", "tutorial POV", "first-person POV", etc.
- Word count → DO NOT invent "800-1000 words", "400-500 words", "1500+ words", etc.
- Tone → DO NOT invent "professional tone", "casual tone", "friendly tone", "conversational tone", etc.
- Audience → DO NOT invent "busy entrepreneurs", "business decision-makers", "Gen Z", "young professionals", etc.
- Duration → DO NOT invent "15-20s", "8-10 slides", "30-60s", "5-7 minute video", etc.

**Safe MODE B Pattern (when user only specifies platform):**
Format & POV: [Platform] content with neutral perspective aligned with the user's topic.
Flow: [Describe conceptual progression without fabricating POV/duration/word count]
CTA: [Platform-native CTA]

**Example (user only specified platform):**
User request: "Give me 3 Instagram carousel ideas for my fitness brand"

Format & POV: Instagram carousel with neutral perspective aligned with fitness brand content.
Flow: Opens with hook, develops through step-by-step progression, closes with key takeaway.
CTA: Save this for later and tag someone who needs this.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**MODE C: GENERIC MODE EXECUTION**

When executionMode = "GENERIC", use this EXACT 3-line structure:

**Execution:**     (or **Execution Guidance:** depending on template)

Format & POV: Generic format — no specific medium inferred, neutral perspective.
Flow: Conceptual structure — describes progression without platform-specific mechanics.
CTA: Generic call-to-action — not tied to any platform interaction.

**HARD REQUIREMENTS (GENERIC MODE):**

1. Three lines only, no more, no less
2. Labels MUST match exactly: "Format & POV:", "Flow:", "CTA:"
3. NO bullets allowed
4. **ZERO-HALLUCINATION:** DO NOT infer platform, format, POV, or duration
5. Use platform-agnostic language only
6. If uncertain → Use MODE C: GENERIC

**EXECUTION STRUCTURE (GENERIC MODE):**

Format & POV: "Generic visual content series", "Generic narrative structure", "Neutral observational perspective", "Exploratory approach" (NO specific platforms or formats)

Flow: Describe conceptual progression without platform mechanics ("Opens with relatable challenge", "Develops through practical demonstration", "Closes with actionable takeaway")

CTA: Generic actionable ("Consider how this applies to your workflow", "Reflect on your own experience", "Think about implementing this")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CRITICAL v2.3 RULES (ZERO-HALLUCINATION ENFORCEMENT):**
- NO bullets allowed in output (any mode)
- Labels must appear exactly as shown above (any mode)
- No template may output unlabeled Execution sentences
- v2.3 labels are ALWAYS required
- 3-mode detection is MANDATORY before execution
- ZERO-HALLUCINATION: DO NOT infer, fabricate, or assume ANY structural elements
- MODE A (Abstract): NO prohibited words
- MODE B (Structured): Use ONLY user-specified structure
- MODE C (Generic): DO NOT infer platform/format
- If uncertain which mode → Default to MODE C: GENERIC

**v2.3 ZERO-HALLUCINATION ENFORCEMENT LAYERS:**

1. **INVERSION CHECK:** Did you add platform/format/POV user never mentioned? If YES → REWRITE
2. **ABSTRACT ENFORCEMENT LAYER:** If MODE A, scan for prohibited words → Auto-rewrite if found
3. **HALLUCINATION CIRCUIT BREAKER:** Invented details/metrics/tone/audience? If YES → REGENERATE
4. **NO INFERENCE RULE:** User didn't specify? Don't guess. Use MODE C: GENERIC

**BANNED PHRASES (Never use these):**
❌ "Write a post about..."
❌ "Create content showing..."
❌ "Make a video about..."
❌ "Include photos of..."
❌ "A detailed article about..."
❌ "A general description..."

**v2.3 SELF-CHECK BEFORE OUTPUT (15-POINT VALIDATION):**

**PHASE 1: MODE DETECTION (Points 1-3)**
1. ✅ Intent detection completed (scanned for abstract keywords AND checked for explicit structure)?
2. ✅ Execution mode set correctly (ABSTRACT / STRUCTURED / GENERIC)?
3. ✅ Mode choice justified (abstract keywords? explicit structure? neither?)?

**PHASE 2: STRUCTURE VALIDATION (Points 4-6)**
4. ✅ All 3 labels present exactly: "Format & POV:", "Flow:", "CTA:"?
5. ✅ Labels written EXACTLY as specified (no variation)?
6. ✅ NO bullets (-, •, *) before any label?

**PHASE 3: ZERO-HALLUCINATION CHECK (Points 7-11)**
7. ✅ INVERSION CHECK PASSED (didn't add platform/format/POV user never mentioned)?
8. ✅ If MODE A: NO prohibited words (platforms, formats, POV, mechanics)?
9. ✅ If MODE B: Used ONLY user-provided structure (no extras added)? If user only specified platform, did you avoid inventing POV/word count/tone/audience/duration?
10. ✅ If MODE C: Generic descriptions used (no platform/format inference)? No assumptions about "professional audience" or "professional tone"?
11. ✅ HALLUCINATION CIRCUIT BREAKER CHECK (no invented details/metrics/tone/audience)?

**PHASE 4: QUALITY VALIDATION (Points 12-15)**
12. ✅ Each label on its own separate line?
13. ✅ Content matches detected mode (Abstract = conceptual; Structured = specific; Generic = neutral)?
14. ✅ No banned phrases used?
15. ✅ Output production-ready, mode-appropriate, and v2.3 compliant?

If ANY check fails → REWRITE until 100% v2.3 compliant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return `${executionEngineRules}

TEMPLATE LOADED: ${template.name}
ID: ${template.id}
Description: ${template.description}

SUPPORTED PLATFORMS: ${template.platforms.join(', ')}
TONE SUPPORT: ${template.toneSupport.join(', ')}

--- TEMPLATE-SPECIFIC RULES ---

STEP 1 INSTRUCTIONS:
${template.rules.steps.step1}

STEP 2 INSTRUCTIONS:
${template.rules.steps.step2}

STEP 3 INSTRUCTIONS:
${template.rules.steps.step3}

STEP 4 INSTRUCTIONS:
${template.rules.steps.step4}

STEP 5 INSTRUCTIONS:
${template.rules.steps.step5}

--- OUTPUT FORMAT ---
${template.rules.format}

${template.rules.platformSpecific ? `
--- PLATFORM-SPECIFIC RULES ---
${Object.entries(template.rules.platformSpecific)
  .map(([platform, rules]) => `${platform.toUpperCase()}: ${rules}`)
  .join('\n')}
` : ''}

IMPORTANT: You MUST follow these template rules exactly while maintaining the 5-step Content Machine Engine pipeline AND the Ultra Precision Execution Engine rules above.`;
}
