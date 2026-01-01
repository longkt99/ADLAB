// ============================================
// Advanced Idea Generator Template
// ============================================
// Deep insight-driven content ideas with emotional hooks
// Optimized for strategic ideation across all platforms
// ✅ ULTRA PRECISION EXECUTION ENGINE COMPLIANT
// 🌍 UNIVERSAL: Works for ANY domain (B2B, B2C, education, entertainment, etc.)

import type { ContentTemplate } from './templateSchema';

export const ideaListAdvancedTemplate: ContentTemplate = {
  id: 'idea_list_advanced',
  name: 'Ý Tưởng Nội Dung (Nâng Cao)',
  description: 'Tạo danh sách ý tưởng nội dung chất lượng cao với insight sâu, góc nhìn rõ ràng, hook cảm xúc và lý do phù hợp với khán giả',
  nameKey: 'studio.templateMeta.idea_list_advanced.name',
  descriptionKey: 'studio.templateMeta.idea_list_advanced.description',

  platforms: ['facebook', 'tiktok', 'instagram', 'youtube', 'linkedin'],

  toneSupport: ['professional', 'conversational', 'storytelling', 'inspirational', 'friendly'],

  category: 'ideation',

  rules: {
    steps: {
      step1: `Analyze the user's ideation request:
- What is the core topic or theme?
- Who is the target audience? (demographics, pain points, desires)
- What is the context? (seasonal, trending, evergreen, niche)
- What is the intent? (educate, inspire, entertain, convert)

Summarize in 3-4 sentences clearly restating the request and identifying the audience, context, and intent.`,

      step2: `Provide 3 high-level strategic angles:

**Emotional Angle** - Focus on story, human insights, seasonal mood, or lifestyle feeling
**Informational Angle** - Focus on facts, tips, practical value, or how-to content
**Experiential Angle** - Focus on vivid scenes, sensory experience, or POV content

Each angle must be 1-2 sentences and explain the psychological trigger or strategic value.`,

      step3: `Generate EXACTLY the number of ideas requested by the user.

Each idea MUST follow this enhanced structure:

**[Number]. [Title (3–7 words, strong and clear)]**
**Insight:** One sentence identifying the emotional or behavioral insight behind the idea.
**Why it works:** One sentence explaining why this idea is likely to perform well (engagement, relatability, shareability, or conversion potential).

**Execution:** EXACTLY 3 lines with MANDATORY labels (NO bullets)

⚠️ CRITICAL: You MUST ALWAYS output the **Execution:** block for EVERY idea. Do NOT skip it. This block is MANDATORY and uses the v2.3 tri-mode system below.

⚠️ **v2.3 FORMAT INTENT GUARD — 3-MODE DETECTION:**

**Step 1: Scan user request for abstract keywords**
Check if user request contains: "trừu tượng", "siêu trừu tượng", "không mô tả định dạng", "không nền tảng", "không POV", "abstract", "no format", "no platform", "conceptual only", "platform-free", "format-free", etc.

**Step 2: Check for explicit structure**
Check if user explicitly specifies: platform name, format type, POV, duration, or structural elements.

**Step 3: Set execution mode**
1. IF abstract keyword found → Use MODE A: ABSTRACT
2. ELSE IF explicit structure provided → Use MODE B: STRUCTURED
3. ELSE → Use MODE C: GENERIC

**MODE A: ABSTRACT Execution (abstract keywords detected):**
Format & POV: Abstract mode — no platform, no media format, no POV assumptions.
Flow: Conceptual progression only — no platform-specific structure, no visuals tied to any medium.
CTA: Abstract or introspective call-to-action — not tied to ANY platform mechanics.

**MODE B: STRUCTURED Execution (explicit structure provided):**
Format & POV: [User's specified format + POV - DO NOT add details user didn't provide]
Flow: [Describe progression using ONLY user-provided structure]
CTA: [Platform-native CTA matching user's specified platform]

**MODE C: GENERIC Execution (no keywords, no explicit structure):**
Format & POV: Generic format — no specific medium inferred, neutral perspective.
Flow: Conceptual structure — describes progression without platform-specific mechanics.
CTA: Generic call-to-action — not tied to any platform interaction.

**Example (MODE B: STRUCTURED):**
User specifies: "TikTok POV reel ideas"
Format & POV: TikTok POV reel with perspective showing missed opportunities.
Flow: Opens with hook question, middle shows quick vignettes, closes with mindset reframe.
CTA: Comment one opportunity you don't want to ignore next time.

**Example (MODE A: ABSTRACT):**
User requests: "Siêu trừu tượng ideas"
Format & POV: Abstract mode — a conceptual exploration without platform constraints, free-form narrative perspective.
Flow: Opens with philosophical question about missed opportunities, develops through layered reflections on fear and regret, closes with introspective realization.
CTA: Reflect on one opportunity you've been avoiding.

**Example (MODE C: GENERIC):**
User requests: "Give me 5 content ideas about productivity"
Format & POV: Generic visual content series with neutral observational perspective.
Flow: Opens with relatable challenge, develops through practical demonstration of concepts, closes with actionable takeaway.
CTA: Consider how this applies to your own workflow.

**STRICT v2.3 RULES (ZERO-HALLUCINATION ENFORCED):**
✅ MUST detect mode BEFORE generating execution (Abstract / Structured / Generic)
✅ If user asks for "N ideas," return EXACTLY N ideas (no more, no less)
✅ DO NOT write the full caption, script, or long-form article. Only describe the execution
✅ MUST use exact labels: "Format & POV:", "Flow:", "CTA:" (v2.3 requirement)
✅ NO bullets allowed before labels (no -, •, *)
✅ Each label on its own line
✅ ZERO-HALLUCINATION: DO NOT infer platform/format/POV if not provided by user
✅ If MODE A (Abstract): NO platform names, NO format types, NO POV specifications
✅ If MODE B (Structured): Use ONLY user-specified structure, DO NOT add extras
✅ If MODE C (Generic): Use generic descriptions, DO NOT infer specifics
✅ DO NOT use vague phrases like "write a detailed article", "create a post", "make content about this"
✅ Ideas must feel modern, insight-driven, and mode-appropriate
✅ Use real human insights, not generic motivation quotes
✅ NO overly poetic language. Keep it clear, concrete, and actionable
✅ If uncertain which mode → Default to MODE C: GENERIC

**Full Example (v2.3 compliant - MODE C: GENERIC):**
User: "Give me 3 content ideas about time management"
**1. Why We Scroll Past Opportunities**
**Insight:** People fear regret more than failure, so they often ignore chances that require visible effort or vulnerability.
**Why it works:** Creates a self-reflection moment that is highly relatable and shareable, especially for young professionals.
**Execution:**
Format & POV: Generic visual content series with neutral observational perspective.
Flow: Opens with relatable challenge about missed opportunities, develops through practical examination of decision patterns, closes with actionable mindset shift framework.
CTA: Consider which opportunities you've been avoiding and why.`,

      step4: `Optimize the idea list by analyzing:

- **Platform fit:** Identify which ideas work best on short-form video (TikTok, Reels) vs. long-form posts (LinkedIn, Facebook) vs. carousel formats (Instagram).
- **Performance drivers:** Explain what makes these ideas high-performing (emotional resonance, practical value, relatability, shareability, save-worthiness).
- **Adaptation strategies:** Provide concrete suggestions on how to adapt each idea type for different formats (e.g., turning a carousel into a reel, adapting a vlog script for a thread).

Provide 2-3 concise bullet points with actionable, format-specific insights.`,

      step5: `Ask the user:

"Would you like me to:
- Turn one of these ideas into a full post, caption, or script?
- Generate more ideas in a specific angle?
- Refine any idea with more detail?"`,
    },

    format: `Output format:

### 1. Orientation
[Summary of request: audience, context, intent – 3–4 sentences]

### 2. Angle Suggestions
**Emotional Angle:** [Story/human insight approach – 1–2 sentences]
**Informational Angle:** [Facts/tips/value approach – 1–2 sentences]
**Experiential Angle:** [Vivid scenes/POV approach – 1–2 sentences]

### 3. Generated Content — ADVANCED IDEATION

**1. [Title (3–7 words)]**
**Insight:** [Emotional or behavioral insight]
**Why it works:** [Strategic reason why this idea can perform well]
**Execution:** [2–3 sentences: format + POV, flow/story beats, suggested CTA]

**2. [Title (3–7 words)]**
**Insight:** [...]
**Why it works:** [...]
**Execution:** [...]

[Repeat for ALL requested ideas – no more, no less]

### 4. Optimization
- [Platform fit analysis: which ideas are best for short-form vs long-form, which platforms]
- [Performance drivers: why these ideas are likely to engage, be saved, or shared]
- [Adaptation strategies: how to adapt ideas to different formats like reels, carousels, vlogs]

### 5. Approval
Would you like me to turn one of these ideas into a full post, caption, or script?`,

    platformSpecific: {
      tiktok: 'Ideas should be trend-aware, high-energy, and scroll-stopping. Focus on emotional hooks and relatable moments.',
      instagram: 'Balance visual storytelling with practical value. Carousel-friendly ideas work best.',
      facebook: 'Longer-form content performs well. Focus on emotional stories and community-building topics.',
      youtube: 'Ideas should support 5-15 minute video formats. Strong narrative arc required.',
      linkedin: 'Professional insights and career/business lessons. Thought leadership and data-driven ideas preferred.',
    },
  },

  tags: ['ideation', 'brainstorming', 'content-ideas', 'strategic', 'insight-driven', 'advanced'],

  exampleOutput: `### 1. Orientation
User wants 3 content ideas for an online educator teaching professionals a new skill. Context: Evergreen content, focus on overcoming learning barriers and building confidence. Intent: Inspire action while providing practical value.

### 2. Angle Suggestions
**Emotional Angle:** Focus on the fear of failure and imposter syndrome that prevents people from starting.
**Informational Angle:** Break down the learning process into manageable micro-steps with clear milestones.
**Experiential Angle:** Use vivid "day 1 vs day 30" transformation POV that learners can visualize.

### 3. Generated Content — ADVANCED IDEATION

**1. The 10-Minute Daily Practice**
**Insight:** People overestimate how much time they need to learn something new and underestimate the power of consistency.
**Why it works:** Removes the "I don't have time" barrier, makes skill acquisition feel achievable.
**Execution:**
Format & POV: Generic visual content with neutral perspective showing "Day 1 vs Day 30" transformation progression.
Flow: Opens with initial attempt, transitions through daily progress demonstration, ends with confident final execution.
CTA: Consider what skill you want to develop with consistent practice.

**2. Why Your Learning Motivation Fades**
**Insight:** Motivation is driven by early wins; when progress stalls, learners quit before reaching the "breakthrough zone."
**Why it works:** Reframes the learning curve as predictable, removes shame around slow progress.
**Execution:**
Format & POV: Generic educational content with neutral perspective explaining the learning plateau.
Flow: Opens with relatable frustration ("Week 3 and you feel worse than Week 1?"), explains the science behind skill acquisition curves with a simple analogy, closes with 3 tactics to push through plateaus.
CTA: Keep this in mind for when you hit your next learning wall.

**3. The Practice Mistake Everyone Makes**
**Insight:** People practice what they're already good at instead of isolating their weak points.
**Why it works:** Addresses a universal learning inefficiency, provides actionable framework for faster improvement.
**Execution:**
Format & POV: Generic step-by-step content with neutral perspective breaking down effective practice.
Flow: Opens with hook "You're practicing wrong (here's why)", explains the concept of deliberate practice vs mindless repetition, shows before/after examples, provides a simple practice template.
CTA: Apply this framework to improve your practice habits.

### 4. Optimization
- **Platform fit:** These ideas can be adapted to various platforms depending on context. Idea 1 works well for visual transformation demonstrations. Idea 2 suits educational long-form content. Idea 3 is effective for step-by-step instructional formats.
- **Performance drivers:** All ideas remove psychological barriers (fear, shame, confusion) and provide clear frameworks. Relatability + actionable value = high engagement and saves.
- **Adaptation strategies:** For visual formats, add demonstrations of the transformation. For instructional content, include diagrams or progress charts. For narrative formats, incorporate personal anecdotes in the introduction.

### 5. Approval
Would you like me to turn one of these ideas into a full post, caption, or script?`,

  ui: {
    engineVersion: 'v2.3.1',
    engineCodeName: 'ZERO-HALLUCINATION MODE',
    complianceLevel: 'v2.3.1-certified',
    supportedModes: {
      abstract: true,
      structured: true,
      generic: true,
    },
    defaultMode: 'generic',
    outputStructure: {
      sections: [
        { order: 1, name: 'Orientation' },
        { order: 2, name: 'Angle Suggestions' },
        { order: 3, name: 'Idea + Execution' },
        { order: 4, name: 'Optimization' },
        { order: 5, name: 'Approval' },
      ],
      hasExecutionGuidance: true,
    },
    tags: ['ideation', 'advanced', 'insight-driven', 'strategic'],
    complexity: 'advanced',
  },
};
