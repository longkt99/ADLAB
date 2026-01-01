// ============================================
// Social Media Caption Template
// ============================================
// Optimized for Instagram, Facebook, TikTok captions
// Focuses on hooks, engagement, and platform-specific formatting
// ✅ ULTRA PRECISION EXECUTION ENGINE COMPLIANT
// 🌍 UNIVERSAL: Works for ANY domain (personal brand, product, service, education, entertainment, etc.)

import type { ContentTemplate } from './templateSchema';

export const socialCaptionTemplate: ContentTemplate = {
  id: 'social_caption',
  name: 'Caption Mạng Xã Hội',
  description: 'Tạo caption hấp dẫn cho Instagram, Facebook, TikTok với hook thu hút, storytelling, và CTA rõ ràng',
  nameKey: 'studio.templateMeta.social_caption.name',
  descriptionKey: 'studio.templateMeta.social_caption.description',

  platforms: ['instagram', 'facebook', 'tiktok', 'threads'],

  toneSupport: ['genz', 'friendly', 'conversational', 'playful', 'storytelling', 'inspirational'],

  category: 'content_creation',

  rules: {
    steps: {
      step1: `Analyze the user's brief to understand:
- What is the main topic or product?
- What emotion should the caption evoke?
- What is the desired action (like, comment, share, buy)?
- Which platform is this primarily for?
Summarize in 2-3 sentences.`,

      step2: `Suggest 2-4 caption angles:
- Hook-driven (start with a question or bold statement)
- Story-driven (mini narrative arc)
- Value-driven (educational or informational)
- Emotional-driven (focus on feelings and connection)
Each angle should have a distinct approach.`,

      step3: `Generate the caption following this structure:
1. HOOK (1-2 lines) - Grab attention immediately
2. BODY (3-5 lines) - Develop the idea, story, or value
3. CTA (1 line) - Clear call-to-action
4. HASHTAGS (5-10 relevant hashtags)

Rules:
- Use line breaks for readability
- Include emojis naturally (not forced)
- Keep the tone consistent throughout
- Make the CTA specific and actionable
- Choose hashtags that balance popularity and niche relevance

⚠️ CRITICAL: After generating the caption, you MUST ALWAYS output the **Execution Guidance:** block. Do NOT skip it. This block is MANDATORY and uses the v2.3 tri-mode system in step4.`,

      step4: `Optimize the caption by:
- Strengthening the hook (make it impossible to scroll past)
- Tightening the body (remove filler words)
- Ensuring the CTA is clear and compelling
- Checking emoji placement (enhance, don't distract)
- Verifying hashtag relevance and diversity

Then provide EXECUTION GUIDANCE in EXACTLY 3 lines with MANDATORY labels (NO bullets):

⚠️ **v2.3 FORMAT INTENT GUARD — 3-MODE DETECTION:**

**Step 1: Scan user request for abstract keywords**
Check if contains: "trừu tượng", "siêu trừu tượng", "không mô tả định dạng", "không nền tảng", "abstract", "no format", "no platform", "conceptual only", "platform-free", "format-free", etc.

**Step 2: Check for explicit structure**
Check if user explicitly specifies: platform name, format type, POV, duration, or structural elements.

**Step 3: Set execution mode**
1. IF abstract keyword found → Use MODE A: ABSTRACT
2. ELSE IF explicit structure provided → Use MODE B: STRUCTURED
3. ELSE → Use MODE C: GENERIC

**MODE A: ABSTRACT Execution Guidance:**
Format & POV: Abstract mode — no platform, no media format, no POV assumptions.
Flow: Conceptual progression only — no platform-specific structure, no visuals tied to any medium.
CTA: Abstract or introspective call-to-action — not tied to ANY platform mechanics.

**MODE B: STRUCTURED Execution Guidance:**
Format & POV: [User's specified format + POV - DO NOT add details user didn't provide]
Flow: [Describe progression using ONLY user-provided structure]
CTA: [Platform-native CTA matching user's specified platform]

**MODE C: GENERIC Execution Guidance:**
Format & POV: Generic format — no specific medium inferred, neutral perspective.
Flow: Conceptual structure — describes progression without platform-specific mechanics.
CTA: Generic call-to-action — not tied to any platform interaction.

**Example (MODE B: STRUCTURED):**
User specifies: "Instagram single image post"
Format & POV: Instagram single image post with neutral perspective aligned with the user's content.
Flow: Opens with hook question, builds through transformation narrative, closes with motivational reframe.
CTA: Dual action—comment engagement (🔥) + save for future motivation.

**Example (MODE A: ABSTRACT):**
User requests: "Conceptual caption ideas"
Format & POV: Abstract mode — a conceptual reflection on transformation, free-form narrative perspective.
Flow: Opens with introspective question, develops through personal reflections on change and growth, closes with philosophical realization.
CTA: Pause and reflect on your own transformation journey.

**Example (MODE C: GENERIC):**
User requests: "Caption for my transformation post"
Format & POV: Generic social media post with neutral perspective showing personal journey.
Flow: Opens with relatable challenge, builds through documented progress, closes with motivational insight.
CTA: Consider your own journey and share your experience.

**STRICT v2.3 RULES (ZERO-HALLUCINATION ENFORCED):**
✅ MUST detect mode BEFORE generating execution (Abstract / Structured / Generic)
✅ MUST use exact labels: "Format & POV:", "Flow:", "CTA:" (v2.3 requirement)
✅ MUST be exactly 3 lines (no more, no less)
✅ NO bullets allowed before labels (no -, •, *)
✅ Each label on its own line
✅ ZERO-HALLUCINATION: DO NOT infer platform/format/POV if not provided by user
✅ If MODE A (Abstract): NO platform names, NO format types, NO POV specifications
✅ If MODE B (Structured): Use ONLY user-specified structure, DO NOT add extras
✅ If MODE C (Generic): Use generic descriptions, DO NOT infer specifics
✅ DO NOT use unlabeled sentences
✅ If uncertain which mode → Default to MODE C: GENERIC`,

      step5: `Ask the user:
- Do you want a shorter or longer caption?
- Should we try a different angle?
- Any specific hashtags you want included/excluded?
- Want to adjust the tone (more playful? more professional?)?
- Need variations for different platforms?`,
    },

    format: `Output format:

### 1. Orientation
[Brief summary of the caption goal]

### 2. Angle Suggestions
**Option A:** [Angle name] - [Brief description]
**Option B:** [Angle name] - [Brief description]
**Option C:** [Angle name] - [Brief description]

### 3. Generated Content

[HOOK LINE]
[Attention-grabbing opening]

[BODY]
[3-5 lines developing the message]
[Use line breaks for readability]

[CTA]
[Clear call-to-action]

[HASHTAGS]
#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5

### 4. Optimization
[Explanation of caption improvements]

**Execution Guidance:**
[2-3 sentences: format + POV, visual flow/story beats, platform-native CTA]

### 5. Approval
What would you like to modify or refine?`,

    platformSpecific: {
      instagram: 'First line is critical (before "more" cut-off). Use 5-10 hashtags. Include 2-3 relevant emojis.',
      facebook: 'Can be longer. Focus on conversation-starting questions. Use 3-5 hashtags maximum.',
      tiktok: 'Keep it punchy and relatable. Max 2-3 hashtags. Heavy emoji use is acceptable.',
      threads: 'Conversational tone. No hashtags needed. Keep it short and engaging.',
    },
  },

  tags: ['social', 'caption', 'instagram', 'facebook', 'tiktok', 'engagement'],

  exampleOutput: `### 1. Orientation
Creating an Instagram caption for a before/after transformation post, evoking inspiration and encouraging engagement with the creator's journey.

### 2. Angle Suggestions
**Option A:** Question Hook - Start with "What changes when you commit for 30 days?"
**Option B:** Story Hook - Mini narrative about the transformation journey
**Option C:** Value Hook - "3 lessons I learned from this challenge"

### 3. Generated Content

What actually happens when you show up for yourself every single day?

30 days ago, I started with doubt. Today, I'm standing here with proof that consistency > perfection.

The hardest part wasn't the work. It was showing up on days when nothing felt right. But those days? Those are the ones that count.

If you're waiting for the perfect moment to start—this is your sign. You don't need to be ready. You just need to begin.

💬 Drop a 🔥 if you're committing to something new this month
👉 Save this for when you need the reminder

#TransformationJourney #ConsistencyOverPerfection #PersonalGrowth #30DayChallenge #ShowUpForYourself #ProgressNotPerfection #MindsetShift #CommitToYou

### 4. Optimization
- Strengthened hook with relatable question
- Used authentic, conversational tone (not polished/corporate)
- Added vulnerability (doubt → proof narrative arc)
- CTA is specific and creates engagement (emoji drop + save)
- Mixed aspirational and relatable hashtags

**Execution Guidance:**
Format & POV: Instagram single image post with neutral perspective aligned with transformation content.
Flow: Opens with hook question, builds through the transformation narrative showing vulnerability, closes with motivational reframe and specific CTAs.
CTA: Dual action—comment engagement (🔥) + save for future motivation.

### 5. Approval
What would you like to modify or refine?`,

  ui: {
    engineVersion: 'v2.3.1',
    engineCodeName: 'ZERO-HALLUCINATION MODE',
    complianceLevel: 'v2.3.1-certified',
    supportedModes: {
      abstract: true,
      structured: true,
      generic: true,
    },
    defaultMode: 'structured',
    outputStructure: {
      sections: [
        { order: 1, name: 'Orientation' },
        { order: 2, name: 'Angle Suggestions' },
        { order: 3, name: 'Generated Content' },
        { order: 4, name: 'Optimization' },
        { order: 5, name: 'Approval' },
      ],
      hasExecutionGuidance: true,
    },
    tags: ['social', 'caption', 'engagement', 'hook'],
    complexity: 'beginner',
  },
};
