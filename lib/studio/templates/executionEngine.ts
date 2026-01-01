// ============================================
// Ultra Precision Execution Engine v2.3
// ============================================
// Enforces PERFECT execution structure across ALL templates
// Zero ambiguity, 100% production-ready output
// UNIVERSAL: Works for ANY domain, industry, or topic (B2B, B2C, education, entertainment, etc.)
// v2.3: ZERO-HALLUCINATION MODE - Absolute enforcement against fabrication, inference, and assumption
// Features: Format Intent Guard (FIG) + Abstract Mode + Generic Fallback + Hallucination Circuit Breaker

/**
 * ULTRA PRECISION EXECUTION ENGINE — CORE RULES
 *
 * Every template that includes "Execution" guidance MUST follow this structure.
 * This ensures all AI outputs are concrete, actionable, and production-ready.
 */

// ============================================
// 1. THE 3-SENTENCE EXECUTION STRUCTURE
// ============================================

export const EXECUTION_STRUCTURE = `
**v2.3 GOLDEN EXECUTION PATTERN (MANDATORY FOR ALL TEMPLATES):**

Every Execution block MUST follow this EXACT 3-line structure:

**Execution:**     (or **Execution Guidance:** depending on template)

Format & POV: [specific format + POV]
Flow: [clear story beats / visual timeline]
CTA: [platform-native CTA]

**HARD REQUIREMENTS:**

1. Three lines only, no more, no less
2. Labels MUST match exactly: "Format & POV:", "Flow:", "CTA:"
3. Each label must appear at the beginning of its line
4. NO bullets allowed (no -, •, *, or any markdown bullets before labels)
5. Each line must be separate (no merging sentences)
6. CTA must be platform-native and actionable
7. No vague phrases ("write a post about...", "create content showing...")

**Label Specifications:**

Format & POV: Specify exact content type (Instagram carousel 8-12 slides, TikTok POV reel 6-10s, YouTube vlog 45-90s, LinkedIn post, Facebook Story, etc.) + perspective (creator POV, tutorial POV, first-person, documentary style, etc.)

Flow: Describe visual timeline with concrete story beats (Hook → Build → Payoff; Scene 1 → Scene 2 → Scene 3; Problem → Demo → Resolution; Opening → Middle → Closing)

CTA: Platform-native interaction (✅ "Save this for later", "Tag someone", "Comment your answer"; ❌ "Learn more", "Check it out")

**CRITICAL: No bullets allowed in output. Labels must appear exactly as shown above.**
`;

// ============================================
// 2. FORMAT INTENT GUARD (FIG) — v3.0
// ============================================

/**
 * Intent Detection Keywords for Abstract Mode
 * If user request contains ANY of these, activate Abstract Mode
 */
export const ABSTRACT_MODE_KEYWORDS = [
  'trừu tượng',
  'siêu trừu tượng',
  'không mô tả định dạng',
  'không theo bố cục thông thường',
  'không nền tảng',
  'không POV',
  'chỉ insight',
  'phong cách thơ',
  'tự do',
  'không khung chuẩn',
  'abstract',
  'no format',
  'no platform',
  'conceptual only',
  'platform-free',
  'format-free',
];

// ============================================
// 2.5. ZERO-HALLUCINATION ENFORCEMENT LAYERS — v2.3
// ============================================

/**
 * LAYER 1: ZERO-HALLUCINATION CORE
 *
 * Prevents fabrication, inference, and assumption of ANY structural elements
 * If user doesn't explicitly specify format/platform/POV/length/structure → DO NOT INFER
 */
export const ZERO_HALLUCINATION_CORE = `
**v2.3 ZERO-HALLUCINATION CORE (ABSOLUTE LAW):**

IF the user does NOT explicitly specify ANY of the following:
- Platform (Instagram, TikTok, LinkedIn, etc.)
- Format (carousel, reel, vlog, post, etc.)
- POV (creator POV, tutorial POV, first-person, etc.)
- Length (duration, word count, slide count, etc.)
- Structure (hook-build-payoff, problem-solution, etc.)
- Medium (video, image, text, audio, etc.)

THEN you MUST NOT infer, guess, or assume ANY of these elements.

**ENFORCEMENT RULES:**

1. ❌ NEVER fabricate platform if not specified
2. ❌ NEVER assume format if not provided
3. ❌ NEVER invent POV if not mentioned
4. ❌ NEVER guess structure if not described
5. ❌ NEVER add factual details not in user request

**ALLOWED FALLBACKS:**
✅ Use MODE C: GENERIC (see below) when structure not specified
✅ Use MODE A: ABSTRACT when abstract keywords detected
✅ Use MODE B: STRUCTURED only when user provides explicit structure

**DETECTION LOGIC:**
- Abstract keywords present? → MODE A (ABSTRACT)
- Explicit structure provided? → MODE B (STRUCTURED)
- No structure specified? → MODE C (GENERIC)

**If you catch yourself inferring → STOP and use appropriate mode.**
`;

/**
 * LAYER 2: ABSTRACT ENFORCEMENT LAYER (AEL)
 *
 * Automatic enforcement of Abstract Mode prohibitions
 * Auto-rewrite if prohibited words appear in Abstract Mode
 */
export const ABSTRACT_ENFORCEMENT_LAYER = `
**v2.3 ABSTRACT ENFORCEMENT LAYER (AEL):**

When executionMode = "ABSTRACT", this layer AUTOMATICALLY:

1. Scans output for prohibited words before finalization
2. Immediately rewrites if ANY prohibited word detected
3. No manual intervention needed — auto-correction active

**ABSOLUTE PROHIBITIONS (AUTO-REWRITE TRIGGERS):**

❌ Platform names: TikTok, Instagram, Facebook, LinkedIn, YouTube, X, Pinterest, Threads, Reddit, Snapchat
❌ Format types: carousel, vlog, shorts, reels, story, post, thread, live, podcast, newsletter
❌ POV specifications: creator POV, expert POV, narrator POV, tutorial POV, first-person POV, third-person POV
❌ Media structures: slides, frames, scenes, shots, episodes, chapters
❌ Platform mechanics: save, share, tag, comment, like, subscribe, follow, swipe

**AUTO-CORRECTION SEQUENCE:**
1. Detect prohibited word → Trigger rewrite
2. Replace with abstract equivalent
3. Validate rewritten output
4. If still contains prohibited words → Repeat until clean

**Example Auto-Correction:**
❌ BEFORE: "Instagram carousel showing transformation"
✅ AFTER: "Visual narrative sequence exploring transformation"

❌ BEFORE: "TikTok POV reel with creator perspective"
✅ AFTER: "Conceptual progression with personal reflection perspective"
`;

/**
 * LAYER 3: INVERSION CHECK
 *
 * Pre-finalization validation asking: "Did I add something user didn't provide?"
 */
export const INVERSION_CHECK = `
**v2.3 INVERSION CHECK (MANDATORY PRE-FINALIZATION):**

Before finalizing ANY execution block, ask internally:

**INVERSION QUESTIONS:**

1. Did I specify a platform the user never mentioned?
2. Did I infer a format the user didn't explicitly request?
3. Did I assume a POV the user didn't describe?
4. Did I add structural details the user didn't provide?
5. Did I invent audience characteristics not in the request?
6. Did I fabricate tone, medium, or length specifications?

**IF YES TO ANY QUESTION:**
→ STOP IMMEDIATELY
→ Remove the inferred/fabricated element
→ Use MODE C: GENERIC fallback OR request clarification

**INVERSION VALIDATION:**
✅ PASS: All structural elements are EXPLICITLY in user request
❌ FAIL: Any element was inferred, assumed, or fabricated

**Example Inversion Catch:**
User: "Give me 3 content ideas about productivity"
❌ BAD (Inference): "Instagram carousel with creator POV..."
✅ GOOD (No Inference): "Generic visual content series with neutral perspective..."

User: "Create TikTok ideas for my fitness brand"
❌ BAD (Inference): "TikTok reel (15-20s) with voiceover..."
✅ GOOD (Specified): "TikTok short-form video with visual demonstration..."

**If inversion detected → REWRITE using only user-provided elements.**
`;

/**
 * LAYER 4: HALLUCINATION CIRCUIT BREAKER (HCB)
 *
 * Automatic regeneration if fabricated content detected
 */
export const HALLUCINATION_CIRCUIT_BREAKER = `
**v2.3 HALLUCINATION CIRCUIT BREAKER (HCB):**

This layer AUTOMATICALLY detects and corrects:

**HALLUCINATION PATTERNS (AUTO-REGENERATE TRIGGERS):**

❌ Invented details: Specific examples user never provided
❌ Fabricated metrics: "50,000 users", "40% increase" when user gave no data
❌ Assumed tone: "professional", "casual", "friendly" when user didn't specify
❌ Inferred audience: "busy entrepreneurs", "Gen Z students" when user didn't mention
❌ Guessed topic details: Adding specifics to generic topics
❌ Phantom requirements: Constraints user never stated

**CIRCUIT BREAKER SEQUENCE:**

Step 1: Scan final output for hallucination patterns
Step 2: If detected → Mark for regeneration
Step 3: Regenerate using ONLY user-provided information
Step 4: Validate regenerated output
Step 5: If still contains hallucinations → Use MODE C: GENERIC or request clarification

**Example Hallucination Detection:**

User request: "Give me content ideas about time management"

❌ HALLUCINATION DETECTED:
"Create a TikTok reel (15-20s) for busy entrepreneurs showing 3 quick time-saving hacks with upbeat music and text overlays."
→ Invented: platform (TikTok), duration (15-20s), audience (busy entrepreneurs), quantity (3), music (upbeat), format (text overlays)

✅ CORRECTED (Zero-Hallucination):
"Generic content exploring time management concepts with practical demonstrations."

**If HCB triggers → Auto-regenerate until hallucination-free.**
`;

/**
 * Format Intent Guard - Detects user intent BEFORE generating execution
 *
 * MANDATORY DETECTION LOGIC:
 * Before ANY template generates Execution, check user request:
 * - If contains ANY abstract mode keyword → executionMode = "ABSTRACT"
 * - Else if user provides explicit structure → executionMode = "STRUCTURED"
 * - Else → executionMode = "GENERIC"
 */
export const FORMAT_INTENT_GUARD = `
**v2.3 FORMAT INTENT GUARD (MANDATORY — 3-MODE DETECTION):**

BEFORE generating ANY Execution block, you MUST detect user intent using this 3-step process:

**Step 1: Scan for Abstract Mode Keywords**
Check if user request contains ANY of these:
- Vietnamese: "trừu tượng", "siêu trừu tượng", "không mô tả định dạng", "không theo bố cục thông thường", "không nền tảng", "không POV", "chỉ insight", "phong cách thơ", "tự do", "không khung chuẩn"
- English: "abstract", "no format", "no platform", "conceptual only", "platform-free", "format-free", "non-format"

IF abstract keyword found → executionMode = "ABSTRACT" (MODE A)

**Step 2: Check for Explicit Structure Specification**
IF user explicitly specifies ANY of these:
- Platform name (Instagram, TikTok, LinkedIn, YouTube, etc.)
- Format type (carousel, reel, vlog, post, story, etc.)
- POV (creator POV, tutorial POV, first-person, etc.)
- Duration/length (15-20s, 800-1000 words, 8-10 slides, etc.)
- Structural elements (hook-build-payoff, problem-solution, etc.)

THEN → executionMode = "STRUCTURED" (MODE B)

**Step 3: Default to Generic Fallback**
IF no abstract keywords AND no explicit structure provided:
→ executionMode = "GENERIC" (MODE C)

**3-MODE DECISION TREE:**

1. Abstract keywords present? → MODE A: ABSTRACT
2. Explicit structure specified? → MODE B: STRUCTURED
3. Neither present? → MODE C: GENERIC

**CRITICAL v2.3 RULE: ZERO-HALLUCINATION ENFORCEMENT**
- MODE A (ABSTRACT): NO platform names, NO format types, NO POV specifications
- MODE B (STRUCTURED): Use ONLY user-provided structure, DO NOT add extra details
- MODE C (GENERIC): Use generic, platform-agnostic descriptions, DO NOT infer specifics

**If uncertain which mode → Default to MODE C: GENERIC**
`;

// ============================================
// 3. ABSTRACT MODE SPECIFICATION — v3.0
// ============================================

/**
 * Abstract Mode - Used when user wants conceptual/platform-free execution
 * NO platform names, NO format types, NO POV assumptions allowed
 */
export const ABSTRACT_MODE_PATTERN = `
**ABSTRACT MODE EXECUTION PATTERN:**

When executionMode = "ABSTRACT", you MUST use this EXACT structure:

**Execution:**
Format & POV: Abstract mode — no platform, no media format, no POV assumptions.
Flow: Conceptual progression only — no platform-specific structure, no visuals tied to any medium.
CTA: Abstract or introspective call-to-action — not tied to ANY platform mechanics.

**ABSOLUTE PROHIBITIONS IN ABSTRACT MODE:**

These words are BANNED and MUST NEVER appear:
❌ TikTok, Instagram, Facebook, LinkedIn, YouTube, X, Pinterest, Threads
❌ carousel, vlog, shorts, reels, story, post, thread, live
❌ POV creator, POV expert, POV narrator, tutorial POV, first-person POV
❌ any format requiring a specific medium

**ALLOWED IN ABSTRACT MODE:**
✅ "Conceptual framework"
✅ "Narrative arc"
✅ "Thematic progression"
✅ "Philosophical exploration"
✅ "Introspective journey"
✅ "Abstract storytelling"

**EXAMPLE ABSTRACT MODE EXECUTION:**

**Execution:**
Format & POV: Abstract mode — a conceptual exploration without platform constraints, free-form narrative perspective.
Flow: Opens with philosophical question, develops through layered insights and metaphorical references, closes with introspective realization.
CTA: Reflect on your own experience with this concept.

**If ANY prohibited word appears in Abstract Mode → IMMEDIATELY REWRITE without waiting.**
`;

// ============================================
// 3.5. GENERIC MODE SPECIFICATION — v2.3 (MODE C)
// ============================================

/**
 * Generic Mode - Used when user provides NO explicit structure
 * Fallback mode to prevent hallucination and inference
 * Platform-agnostic, format-neutral execution
 */
export const GENERIC_MODE_PATTERN = `
**GENERIC MODE EXECUTION PATTERN (MODE C):**

When executionMode = "GENERIC", you MUST use this EXACT structure:

**Execution:**
Format & POV: Generic format — no specific medium inferred, neutral perspective.
Flow: Conceptual structure — describes progression without platform-specific mechanics.
CTA: Generic call-to-action — not tied to any platform interaction.

**WHEN TO USE GENERIC MODE:**

Use MODE C when:
- User provides topic but NO platform specification
- User provides idea but NO format details
- User provides concept but NO structural requirements
- User's request is open-ended without constraints

**GENERIC MODE RULES:**

1. ✅ Use "generic format", "visual content sequence", "narrative structure"
2. ✅ Use "neutral perspective", "observational viewpoint", "exploratory approach"
3. ✅ Describe conceptual flow without platform mechanics
4. ✅ Use platform-agnostic language
5. ❌ DO NOT infer platform (no Instagram, TikTok, etc.)
6. ❌ DO NOT guess format (no carousel, reel, etc.)
7. ❌ DO NOT assume POV (no creator POV, etc.)
8. ❌ DO NOT add duration/length specifications

**EXAMPLE GENERIC MODE EXECUTION:**

User request: "Give me content ideas about productivity"

**Execution:**
Format & POV: Generic visual content series with neutral observational perspective.
Flow: Opens with relatable challenge, develops through practical demonstration of concepts, closes with actionable takeaway.
CTA: Consider how this applies to your own workflow.

**WHY IT'S GENERIC (v2.3 Compliant):**
- ✅ No platform specified (not "Instagram", "TikTok", etc.)
- ✅ No format inferred (not "carousel", "reel", etc.)
- ✅ No POV assumed (not "creator POV", "tutorial", etc.)
- ✅ No duration fabricated (not "15-20s", "8-10 slides", etc.)
- ✅ Describes conceptual flow without platform mechanics
- ✅ Generic CTA not tied to platform interactions

**GENERIC MODE vs ABSTRACT MODE:**

GENERIC MODE (MODE C):
- Used when user provides NO structure
- Describes execution neutrally
- Avoids platform/format specifics
- Still provides actionable guidance
- Example: "Generic visual sequence with neutral perspective"

ABSTRACT MODE (MODE A):
- Used when user REQUESTS abstract/conceptual approach
- Emphasizes philosophical/conceptual language
- Completely platform-free
- Introspective and exploratory
- Example: "Conceptual exploration without medium constraints"

**If no structure provided → Use MODE C: GENERIC (not MODE A: ABSTRACT)**
`;

// ============================================
// 4. BANNED PHRASES
// ============================================

export const BANNED_EXECUTION_PHRASES = [
  "Write a post about",
  "Create content showing",
  "Make a video about",
  "You can include photos",
  "A detailed article about",
  "A general description",
  "Create a detailed post",
  "Write content that",
  "Make something about",
  "Develop a piece on",
  "Craft a message about",
  "Build content around",
  "write a post",
  "create content",
  "make a video",
  "include photos",
  "detailed article",
  "general description",
];

/**
 * Check if text contains any banned phrases
 */
export function containsBannedPhrases(text: string): {
  hasBanned: boolean;
  foundPhrases: string[];
} {
  const lowerText = text.toLowerCase();
  const foundPhrases = BANNED_EXECUTION_PHRASES.filter(phrase =>
    lowerText.includes(phrase.toLowerCase())
  );

  return {
    hasBanned: foundPhrases.length > 0,
    foundPhrases,
  };
}

// ============================================
// 3. EXECUTION VALIDATION RULES
// ============================================

export interface ExecutionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that execution text follows Ultra Precision rules
 *
 * Checks:
 * - Has FORMAT + POV in first sentence
 * - Has FLOW with story beats in second sentence
 * - Has platform-native CTA in third sentence
 * - No banned phrases present
 * - Language is concrete and production-ready
 */
export function validateExecution(executionText: string): ExecutionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for banned phrases
  const { hasBanned, foundPhrases } = containsBannedPhrases(executionText);
  if (hasBanned) {
    errors.push(
      `Contains banned vague phrases: ${foundPhrases.join(', ')}. Use concrete format/POV/flow instead.`
    );
  }

  // Check for format indicators
  const formatKeywords = [
    'carousel',
    'reel',
    'vlog',
    'thread',
    'post',
    'story',
    'live',
    'tutorial',
    'video',
    'slides',
  ];
  const hasFormat = formatKeywords.some(keyword =>
    executionText.toLowerCase().includes(keyword)
  );
  if (!hasFormat) {
    warnings.push(
      'Execution should explicitly mention content format (carousel, reel, vlog, etc.)'
    );
  }

  // Check for POV indicators
  const povKeywords = [
    'pov',
    'first-person',
    'behind-the-scenes',
    'tutorial',
    'guide',
    'creator',
    'documentary',
    'drone',
  ];
  const hasPOV = povKeywords.some(keyword =>
    executionText.toLowerCase().includes(keyword)
  );
  if (!hasPOV) {
    warnings.push(
      'Execution should specify POV (first-person, tutorial POV, creator POV, etc.)'
    );
  }

  // Check for flow/story beat indicators
  const flowKeywords = [
    'hook',
    'flow',
    'opening',
    'start',
    'begin',
    'scene',
    'shot',
    'sequence',
    'beat',
    'moment',
  ];
  const hasFlow = flowKeywords.some(keyword =>
    executionText.toLowerCase().includes(keyword)
  );
  if (!hasFlow) {
    warnings.push(
      'Execution should describe content flow or story beats (opening → middle → closing)'
    );
  }

  // Check for CTA indicators
  const ctaKeywords = [
    'cta',
    'save',
    'tag',
    'comment',
    'share',
    'follow',
    'dm',
    'tap',
    'swipe',
    'click',
    'book',
  ];
  const hasCTA = ctaKeywords.some(keyword =>
    executionText.toLowerCase().includes(keyword)
  );
  if (!hasCTA) {
    warnings.push(
      'Execution should include specific CTA suggestion (save, tag, comment, etc.)'
    );
  }

  // Check sentence count (should be 2-3 sentences)
  const sentenceCount = executionText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  if (sentenceCount < 2) {
    errors.push('Execution must be at least 2 sentences (format+POV, flow, CTA)');
  }
  if (sentenceCount > 4) {
    warnings.push('Execution should be concise (2-3 sentences max)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// 4. PRODUCTION-READY REQUIREMENTS
// ============================================

export const PRODUCTION_READY_REQUIREMENTS = `
All execution guidance must be:

✅ **Concrete** - Specific formats, not "create content"
✅ **Modern** - Platform-native, trend-aware
✅ **Visual** - Describes what viewers will see
✅ **Actionable** - A content team can execute immediately
✅ **Format-specific** - Different execution for reel vs carousel vs vlog
✅ **CTA-driven** - Every execution ends with interaction mechanic

❌ **Never generic** - No "write about X" or "create content showing Y"
❌ **Never vague** - No "include photos" or "add details"
❌ **Never abstract** - No conceptual descriptions without visual specifics
❌ **Never incomplete** - Must include format, POV, flow, AND CTA
`;

// ============================================
// 5. TEMPLATE INTEGRATION HELPER
// ============================================

/**
 * Standard execution instruction block for step3 across all templates
 *
 * Use this in any template that generates ideas, captions, scripts, or content plans
 */
export const STANDARD_EXECUTION_INSTRUCTION = `
**v2.3 TRI-MODE EXECUTION SYSTEM (ZERO-HALLUCINATION ENFORCED):**

⚠️ MANDATORY INTENT DETECTION BEFORE EXECUTION:

**Step 1: Detect Execution Mode (3-Mode System)**

Scan user request and determine mode:

1. **MODE A: ABSTRACT** - User requests conceptual/platform-free approach
   - Keywords: "trừu tượng", "siêu trừu tượng", "abstract", "no format", "no platform", "conceptual only", "platform-free", "format-free"
   - IF any abstract keyword found → executionMode = "ABSTRACT"

2. **MODE B: STRUCTURED** - User provides explicit structure/platform
   - User specifies: platform name, format type, POV, duration, or structural elements
   - IF explicit structure provided → executionMode = "STRUCTURED"

3. **MODE C: GENERIC** - User provides topic but NO structure
   - No abstract keywords AND no explicit structure
   - IF neither abstract nor structured → executionMode = "GENERIC"

**Step 2A: ABSTRACT MODE Execution (MODE A)**
If executionMode = "ABSTRACT", use this EXACT structure:

**Execution:**
Format & POV: Abstract mode — no platform, no media format, no POV assumptions.
Flow: Conceptual progression only — no platform-specific structure, no visuals tied to any medium.
CTA: Abstract or introspective call-to-action — not tied to ANY platform mechanics.

**ABSOLUTE PROHIBITIONS in Abstract Mode:**
❌ NO platform names (TikTok, Instagram, Facebook, LinkedIn, YouTube, etc.)
❌ NO format types (carousel, vlog, reel, shorts, story, post, thread, live)
❌ NO POV specifications (creator POV, tutorial POV, first-person POV, etc.)
❌ NO platform mechanics (save, share, tag, comment, etc.)

**Step 2B: STRUCTURED MODE Execution (MODE B)**
If executionMode = "STRUCTURED", use this EXACT 3-line structure with NO bullets:

**Execution:**
Format & POV: [User's specified format + POV - DO NOT add details user didn't provide]
Flow: [Describe progression using ONLY user-provided structure]
CTA: [Platform-native CTA matching user's specified platform]

**CRITICAL MODE B HALLUCINATION PREVENTION:**
If user ONLY specifies platform (e.g., "TikTok ideas", "LinkedIn content") but does NOT specify:
- POV → DO NOT invent "creator POV", "expert POV", "tutorial POV", etc.
- Word count → DO NOT invent "800-1000 words", "400-500 words", etc.
- Tone → DO NOT invent "professional tone", "casual tone", "friendly tone", etc.
- Audience → DO NOT invent "busy entrepreneurs", "business decision-makers", "Gen Z", etc.
- Duration → DO NOT invent "15-20s", "8-10 slides" unless user specified

**Safe MODE B Pattern (platform-only specification):**
Format & POV: [Platform] content with neutral perspective aligned with the user's topic.
Flow: [Describe conceptual progression without fabricating details]
CTA: [Platform-native CTA]

**Example (STRUCTURED MODE):**
User specifies: "Instagram carousel ideas"

**Execution:**
Format & POV: Instagram carousel with neutral perspective aligned with the user's topic.
Flow: Opens with hook, develops through step-by-step progression, closes with key takeaway.
CTA: Save this for later and tag someone who needs this.

**Step 2C: GENERIC MODE Execution (MODE C)**
If executionMode = "GENERIC", use this EXACT 3-line structure:

**Execution:**
Format & POV: Generic format — no specific medium inferred, neutral perspective.
Flow: Conceptual structure — describes progression without platform-specific mechanics.
CTA: Generic call-to-action — not tied to any platform interaction.

**Example (GENERIC MODE):**
User request: "Give me content ideas about productivity"

**Execution:**
Format & POV: Generic visual content series with neutral observational perspective.
Flow: Opens with relatable challenge, develops through practical demonstration of concepts, closes with actionable takeaway.
CTA: Consider how this applies to your own workflow.

**STRICT v2.3 RULES (ZERO-HALLUCINATION ENFORCEMENT):**

✅ MUST detect mode BEFORE generating execution (Abstract / Structured / Generic)
✅ MUST use exact labels: "Format & POV:", "Flow:", "CTA:"
✅ MUST be exactly 3 lines (no more, no less)
✅ NO bullets allowed before labels (no -, •, *)
✅ Each label on its own line
✅ ZERO-HALLUCINATION: DO NOT infer platform/format/POV if not provided by user
✅ MODE A (Abstract): NO prohibited words (platforms, formats, POV)
✅ MODE B (Structured): Use ONLY user-specified structure, DO NOT add extras
✅ MODE C (Generic): Use generic descriptions, DO NOT infer specifics
✅ If uncertain which mode → Default to MODE C: GENERIC

**v2.3 SELF-VALIDATION BEFORE OUTPUT (10-Point Quick Check):**

Before producing final execution, verify:
1. Mode detection completed (Abstract / Structured / Generic identified)
2. All 3 labels present exactly: "Format & POV:", "Flow:", "CTA:"
3. Each label is on its own line
4. No bullets used (-, •, *)
5. Mode-appropriate content matches detected mode
6. If MODE A: NO prohibited words (platform names, format types, POV)
7. If MODE B: ONLY user-provided structure, no extras added; if user did NOT specify POV/word count/tone/audience → verify none introduced
8. If MODE C: Generic descriptions, no platform inference, no assumptions about professional audience/tone
9. No vague instructions or banned phrases
10. Production-ready language

If ANY check fails → REWRITE until 100% v2.3 compliant.
`;

// ============================================
// 6. SELF-CHECK VALIDATION PROMPT
// ============================================

export const SELF_CHECK_VALIDATION = `
**v2.3 SELF-CHECK BEFORE GENERATING FINAL OUTPUT (15-POINT VALIDATION):**

**PHASE 1: MODE DETECTION (Points 1-3)**

1. ✅ Intent detection completed? (Did you scan for abstract keywords AND check for explicit structure?) (If no → STOP and detect)
2. ✅ Execution mode set correctly? (ABSTRACT / STRUCTURED / GENERIC?) (If unclear → REWRITE)
3. ✅ Mode choice justified? (Abstract keywords present? Explicit structure provided? Neither?) (If uncertain → Default to GENERIC)

**PHASE 2: STRUCTURE VALIDATION (Points 4-6)**

4. ✅ All 3 labels present exactly: "Format & POV:", "Flow:", "CTA:"? (If no → REWRITE)
5. ✅ Are labels written EXACTLY as specified (no variation)? (If no → REWRITE)
6. ✅ Are there NO bullets (-, •, *) before any label? (If bullets present → REWRITE)

**PHASE 3: ZERO-HALLUCINATION CHECK (Points 7-11)**

7. ✅ INVERSION CHECK PASSED? (Did you add platform/format/POV/structure user never mentioned?) (If yes → REWRITE)
8. ✅ If MODE A (ABSTRACT): NO prohibited words (platform names, format types, POV, mechanics)? (If found → AUTO-REWRITE via AEL)
9. ✅ If MODE B (STRUCTURED): Used ONLY user-provided structure without adding extras? If user only specified platform, did you avoid inventing POV/word count/tone/audience/duration? (If extras added → REWRITE)
10. ✅ If MODE C (GENERIC): Generic descriptions used, no platform/format inference? No assumptions about "professional audience" or "professional tone"? (If inference detected → REWRITE)
11. ✅ HALLUCINATION CIRCUIT BREAKER CHECK: No invented details, metrics, tone, audience, or constraints? (If HCB triggered → REGENERATE)

**PHASE 4: QUALITY VALIDATION (Points 12-15)**

12. ✅ Each label on its own separate line? (If merged → REWRITE)
13. ✅ Content matches detected mode? (Abstract = conceptual; Structured = specific; Generic = neutral) (If mismatch → REWRITE)
14. ✅ Did any banned phrases appear ("write a post about", "create content showing", etc.)? (If yes → REWRITE)
15. ✅ Is output production-ready, mode-appropriate, and v2.3 compliant? (If no → REWRITE)

**If ANY check fails → regenerate until 100% v2.3 compliant.**

**v2.3 compliance means:**
- 3-mode detection completed (Abstract / Structured / Generic)
- Exact labels: "Format & POV:", "Flow:", "CTA:"
- No bullets before labels
- 3 lines only, each line separate
- ZERO-HALLUCINATION enforced (no inference, no fabrication)
- MODE A: NO prohibited words (platforms, formats, POV, mechanics)
- MODE B: ONLY user-specified structure, no extras
- MODE C: Generic descriptions, no platform/format guessing
- Inversion Check passed (no added elements)
- Hallucination Circuit Breaker passed (no invented details)
- Mode-appropriate content
- Production-ready language
`;

// ============================================
// 7. EXAMPLE: PERFECT EXECUTION
// ============================================

export const PERFECT_EXECUTION_EXAMPLE = `
**v2.3 EXECUTION EXAMPLES — 3-MODE SYSTEM**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ COMMON FAILURES (What NOT to do)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ FAILURE 1: Vague, No Labels
"Write a post about [topic]. Include photos and details. Add a CTA at the end."
→ WRONG: No labels, vague instructions, banned phrases

❌ FAILURE 2: Has Bullets (v2.1 style, NOT v2.3)
**Execution:**
- Format & POV: Instagram carousel (8-10 slides) with creator POV...
- Flow: Slide 1 opens with hook, slides 2-7 show progression...
- CTA: Save this for later.
→ WRONG: Bullets present (must have NO bullets in v2.3)

❌ FAILURE 3: Hallucination (Inference when not specified)
User: "Give me content ideas about productivity"
**Execution:**
Format & POV: Instagram carousel (8-10 slides) with creator POV...
Flow: Slide 1 hooks with question, slides 2-7 show examples...
CTA: Save for later.
→ WRONG: User never mentioned Instagram, carousel, or creator POV — HALLUCINATION DETECTED

❌ FAILURE 4: Wrong Mode Selection
User: "Hãy tạo ý tưởng siêu trừu tượng"
**Execution:**
Format & POV: Instagram carousel with abstract storytelling approach...
Flow: Conceptual progression through carousel format...
CTA: Reflect on this concept.
→ WRONG: User requested abstract mode, but system used Instagram/carousel — MODE MISMATCH

❌ FAILURE 5: Abstract Mode with Prohibited Words
**Execution:**
Format & POV: Abstract mode using TikTok-style storytelling...
Flow: Conceptual progression through Instagram carousel format...
CTA: Save for later.
→ WRONG: Contains "TikTok", "Instagram carousel", "Save" — PROHIBITED in Abstract Mode

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MODE A: ABSTRACT — PERFECT EXECUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User request: "Hãy tạo ý tưởng siêu trừu tượng, không theo format thông thường"

**Execution:**
Format & POV: Abstract mode — no platform, no media format, no POV assumptions.
Flow: Conceptual progression only — opens with philosophical question, develops through layered metaphors, closes with introspective realization.
CTA: Reflect on your own relationship with this concept.

**WHY IT'S PERFECT (v2.3 Abstract Mode Compliant):**
- ✅ Intent detected: "siêu trừu tượng" → MODE A: ABSTRACT
- ✅ Uses exact labels: "Format & POV:", "Flow:", "CTA:"
- ✅ NO bullets before labels
- ✅ Each label on its own line
- ✅ Exactly 3 lines
- ✅ NO platform names (no TikTok, Instagram, Facebook, etc.)
- ✅ NO format types (no carousel, vlog, reel, post, etc.)
- ✅ NO POV specifications (no creator POV, tutorial POV, etc.)
- ✅ NO platform mechanics (no save, share, tag, comment, etc.)
- ✅ Uses abstract/conceptual language only
- ✅ Introspective CTA (not platform-specific)
- ✅ ZERO-HALLUCINATION compliant (no inferred elements)
- ✅ Abstract Enforcement Layer passed
- ✅ v2.3 MODE A compliant

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MODE B: STRUCTURED — PERFECT EXECUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User request: "Give me 3 Instagram carousel ideas for my fitness brand"

**Execution:**
Format & POV: Instagram carousel with neutral perspective aligned with fitness brand content.
Flow: Opens with hook, develops through step-by-step progression, closes with key takeaway.
CTA: Save this for later and tag someone who needs to see this.

**WHY IT'S PERFECT (v2.3 Structured Mode Compliant):**
- ✅ Intent detected: "Instagram carousel" → MODE B: STRUCTURED
- ✅ Uses exact labels: "Format & POV:", "Flow:", "CTA:"
- ✅ NO bullets before labels
- ✅ Each label on its own line
- ✅ Exactly 3 lines
- ✅ User specified "Instagram carousel" → System used it (not inferred)
- ✅ User did NOT specify POV → System did NOT invent "creator POV" (used "neutral perspective")
- ✅ User did NOT specify slide count → System did NOT fabricate "8-10 slides"
- ✅ User did NOT specify tone/audience → System did NOT assume
- ✅ Describes conceptual flow without fabricating specific details
- ✅ Platform-native CTA (save + tag) matching Instagram platform
- ✅ ZERO-HALLUCINATION compliant (only used user-provided structure)
- ✅ Inversion Check passed (no POV/word count/tone/audience added)
- ✅ v2.3 MODE B compliant

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MODE C: GENERIC — PERFECT EXECUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User request: "Give me 5 content ideas about time management"

**Execution:**
Format & POV: Generic visual content series with neutral observational perspective.
Flow: Opens with relatable challenge, develops through practical demonstration of concepts, closes with actionable takeaway.
CTA: Consider how this applies to your own workflow.

**WHY IT'S PERFECT (v2.3 Generic Mode Compliant):**
- ✅ Intent detected: No abstract keywords, no explicit structure → MODE C: GENERIC
- ✅ Uses exact labels: "Format & POV:", "Flow:", "CTA:"
- ✅ NO bullets before labels
- ✅ Each label on its own line
- ✅ Exactly 3 lines
- ✅ User provided topic ("time management") but NO platform/format
- ✅ System did NOT infer platform (not Instagram, TikTok, etc.)
- ✅ System did NOT guess format (not carousel, reel, etc.)
- ✅ System did NOT assume POV (not creator POV, tutorial, etc.)
- ✅ Uses generic, platform-agnostic language ("visual content series", "neutral perspective")
- ✅ Describes conceptual flow without platform mechanics
- ✅ Generic CTA not tied to platform interactions
- ✅ ZERO-HALLUCINATION compliant (no inference, no fabrication)
- ✅ Inversion Check passed (no added elements)
- ✅ Hallucination Circuit Breaker passed (no invented details)
- ✅ v2.3 MODE C compliant

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 MODE COMPARISON TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Aspect | MODE A: ABSTRACT | MODE B: STRUCTURED | MODE C: GENERIC |
|--------|------------------|--------------------| ----------------|
| **Trigger** | Abstract keywords present | Explicit structure provided | No keywords, no structure |
| **Platform** | NEVER allowed | User-specified only | NEVER inferred |
| **Format** | NEVER allowed | User-specified only | NEVER inferred |
| **POV** | NEVER allowed | User-specified only | Generic/neutral only |
| **Language** | Conceptual/philosophical | Specific/concrete | Neutral/platform-agnostic |
| **CTA** | Introspective | Platform-native | Generic/actionable |
| **Example Format** | "Abstract mode — no platform" | "Instagram carousel (8-10 slides)" | "Generic visual series" |
| **Example CTA** | "Reflect on this concept" | "Save and tag someone" | "Consider how this applies" |
| **Use Case** | User wants conceptual output | User specifies platform/format | User provides topic only |
| **Hallucination Risk** | Zero (prohibited words banned) | Low (only user-provided used) | Zero (no inference allowed) |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 v2.3 QUICK REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**When to use each mode:**

✅ MODE A (ABSTRACT): User says "trừu tượng", "abstract", "no platform", "conceptual only"
✅ MODE B (STRUCTURED): User says "Instagram carousel", "TikTok reel", "LinkedIn post", etc.
✅ MODE C (GENERIC): User says "content ideas about X" with NO platform/format specified

**Golden Rule:** If uncertain → Default to MODE C: GENERIC
`;

// ============================================
// 8. EXPORT ALL RULES FOR SYSTEM INTEGRATION
// ============================================

export const ULTRA_PRECISION_ENGINE = {
  structure: EXECUTION_STRUCTURE,
  formatIntentGuard: FORMAT_INTENT_GUARD,
  abstractMode: ABSTRACT_MODE_PATTERN,
  genericMode: GENERIC_MODE_PATTERN,
  abstractKeywords: ABSTRACT_MODE_KEYWORDS,
  zeroHallucinationCore: ZERO_HALLUCINATION_CORE,
  abstractEnforcementLayer: ABSTRACT_ENFORCEMENT_LAYER,
  inversionCheck: INVERSION_CHECK,
  hallucinationCircuitBreaker: HALLUCINATION_CIRCUIT_BREAKER,
  bannedPhrases: BANNED_EXECUTION_PHRASES,
  requirements: PRODUCTION_READY_REQUIREMENTS,
  instruction: STANDARD_EXECUTION_INSTRUCTION,
  validation: SELF_CHECK_VALIDATION,
  example: PERFECT_EXECUTION_EXAMPLE,
};

/**
 * Get full Ultra Precision Execution Engine prompt
 * Use this in system messages for any template that includes execution
 */
export function getExecutionEnginePrompt(): string {
  return `
${EXECUTION_STRUCTURE}

${PRODUCTION_READY_REQUIREMENTS}

${STANDARD_EXECUTION_INSTRUCTION}

${SELF_CHECK_VALIDATION}

${PERFECT_EXECUTION_EXAMPLE}
`;
}
