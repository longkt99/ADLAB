// ============================================
// Strategic Content Ideas Template
// ============================================
// For high-level content strategy: pillars, series, narrative territories
// Designed for brand strategy, campaign planning, content system design
// ✅ ULTRA PRECISION EXECUTION ENGINE v2.3.1 COMPLIANT
// 🌍 UNIVERSAL: Works for ANY brand, industry, or content goal

import type { ContentTemplate } from './templateSchema';

export const strategicContentIdeasTemplate: ContentTemplate = {
  id: 'strategic_content_ideas',
  name: 'Ý Tưởng Chiến Lược',
  description: 'Tạo ý tưởng chiến lược bao gồm trụ cột nội dung, khái niệm series, và lãnh thổ narrative cho kế hoạch nội dung dài hạn',
  nameKey: 'studio.templateMeta.strategic_content_ideas.name',
  descriptionKey: 'studio.templateMeta.strategic_content_ideas.description',

  platforms: ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'twitter', 'threads', 'pinterest'],

  toneSupport: ['professional', 'friendly', 'conversational', 'storytelling', 'inspirational', 'genz', 'academic', 'journalistic'],

  category: 'ideation',

  rules: {
    steps: {
      step1: `Analyze the strategic brief to understand:
- What is the brand/product/service and its core positioning?
- What are the primary content goals? (awareness, authority, conversion, community, education, etc.)
- Who is the target audience and what are their key insights/pain points/motivations?
- Are there any tone guidelines, constraints, or taboo topics?
- What language should the output be in? (Vietnamese, English, or bilingual)

Summarize the strategic context in 3-4 sentences, restating the brand essence and content objectives clearly.`,

      step2: `Identify 3-6 strategic content territories (pillars/themes):

A strategic territory is NOT a single post idea — it's a broader thematic area that:
- Connects directly to brand positioning and content goals
- Addresses audience insights or motivations
- Can generate multiple pieces of content over time
- Differentiates the brand or adds unique value

Each territory should be:
- **Clear and focused** (not too broad like "tips" or "inspiration")
- **Connected to insight** (why this territory matters to the audience)
- **Sustainable** (can produce content consistently)

Format:
**Territory Name:** Brief description of what this territory covers and why it aligns with brand + audience.`,

      step3: `For each strategic territory, develop series concepts and idea seeds:

**SERIES CONCEPTS (2-3 per territory):**
A series concept is a recurring content format/theme that lives within a territory.
Examples: "Behind the Scenes Fridays", "Customer Transformation Stories", "Myth-Busting Series"

⚠️ CRITICAL TRI-MODE BEHAVIOR:

**MODE A: ABSTRACT (if user requests conceptual/abstract approach)**
- Describe series in purely conceptual terms
- NO platform names, NO format types, NO POV specifications
- Focus on narrative structure and thematic progression

**MODE B: STRUCTURED (if user explicitly specifies platform/format)**
- Use ONLY the platform/format user provided
- DO NOT invent POV, duration, word count, tone, audience, slide count
- Safe pattern: "[Platform] series concept aligned with brand perspective"

**MODE C: GENERIC (default - no platform specified)**
- Describe series in platform-agnostic language
- Use terms like: "recurring content series", "narrative sequence", "episodic content"
- NO platform inference, NO format assumptions

**IDEA SEEDS (5-10 total across all territories):**
Each idea seed should include:
- **Idea:** 1-sentence core concept
- **Why it works:** 1-2 sentences explaining connection to territory, insight, or goal
- **Territory:** Which strategic territory this belongs to

DO NOT write full posts or detailed scripts. These are strategic seeds to be developed later.`,

      step4: `Optimize the strategic content ideas by analyzing:

- **Territory coverage:** Do the territories collectively address the brand's content goals and audience needs?
- **Differentiation:** What makes these territories unique or ownable for this brand?
- **Sustainability:** Can these territories generate content consistently over 3-6 months?
- **Interconnection:** How do territories complement each other to build a cohesive content system?

Then provide strategic guidance on:
- How to evolve idea seeds into full content pieces
- How to create mini-series within territories
- How to repurpose content across territories
- How to test and iterate based on performance

⚠️ ZERO-HALLUCINATION RULES FOR OPTIMIZATION:
- In MODE C (GENERIC): MUST be platform-agnostic. Do NOT say "this works best on TikTok/Instagram/LinkedIn"
- In MODE B (STRUCTURED): May mention user-specified platform ONLY, no other platforms
- In MODE A (ABSTRACT): NO platform mentions at all

Then provide EXECUTION GUIDANCE in EXACTLY 3 lines with MANDATORY labels (NO bullets):

⚠️ **v2.3.1 FORMAT INTENT GUARD — 3-MODE DETECTION:**

**Step 1: Scan user request for abstract keywords**
Check if contains: "trừu tượng", "siêu trừu tượng", "không mô tả định dạng", "không nền tảng", "abstract", "no format", "no platform", "conceptual only", "platform-free", "format-free", etc.

**Step 2: Check for explicit structure**
Check if user explicitly specifies: platform name, format type, POV, duration, or structural elements.

**Step 3: Set execution mode**
1. IF abstract keyword found → Use MODE A: ABSTRACT
2. ELSE IF explicit structure provided → Use MODE B: STRUCTURED
3. ELSE → Use MODE C: GENERIC

**MODE A: ABSTRACT Execution Guidance:**
Format & POV: Abstract strategic mode — no platform, no media format, no POV assumptions.
Flow: Conceptual progression only — identifies strategic territories, develops thematic frameworks, connects to brand essence without platform constraints.
CTA: Reflect on which territories align most closely with your brand vision.

**MODE B: STRUCTURED Execution Guidance:**
Format & POV: [User's specified format + platform - DO NOT add details user didn't provide]
Flow: [Describe strategic progression using ONLY user-provided structure]
CTA: [Platform-native CTA matching user's specified platform]

**MODE C: GENERIC Execution Guidance:**
Format & POV: Generic strategic content framework with neutral perspective.
Flow: Identifies strategic territories, develops platform-agnostic series concepts, provides idea seeds that can be adapted to any medium.
CTA: Consider which territory you want to develop into concrete content first.

**Example (MODE B: STRUCTURED):**
User specifies: "LinkedIn content strategy"
Format & POV: LinkedIn content strategy with neutral perspective aligned with brand positioning.
Flow: Identifies strategic territories for LinkedIn presence, develops series concepts suitable for the platform, provides idea seeds for long-form professional content.
CTA: Select which territory to pilot on LinkedIn first.

**Example (MODE A: ABSTRACT):**
User requests: "Abstract strategic framework"
Format & POV: Abstract strategic mode — no platform, no media format, no POV assumptions.
Flow: Conceptual progression identifying thematic territories, narrative frameworks, and strategic content principles without medium constraints.
CTA: Reflect on which conceptual territory resonates most with your brand vision.

**Example (MODE C: GENERIC):**
User requests: "Strategic content ideas for my brand"
Format & POV: Generic strategic content framework with neutral perspective.
Flow: Identifies strategic territories aligned with brand goals, develops platform-agnostic series concepts, provides adaptable idea seeds.
CTA: Consider which territory to prioritize for your content calendar.

**STRICT v2.3.1 RULES (ZERO-HALLUCINATION ENFORCED):**
✅ MUST detect mode BEFORE generating execution (Abstract / Structured / Generic)
✅ MUST use exact labels: "Format & POV:", "Flow:", "CTA:" (v2.3.1 requirement)
✅ MUST be exactly 3 lines (no more, no less)
✅ NO bullets allowed before labels (no -, •, *)
✅ Each label on its own line
✅ ZERO-HALLUCINATION: DO NOT infer platform/format/POV if not provided by user
✅ If MODE A (Abstract): NO platform names, NO format types, NO POV specifications
✅ If MODE B (Structured): Use ONLY user-specified structure, DO NOT add extras
✅ If MODE C (Generic): Use generic descriptions, DO NOT infer specifics
✅ DO NOT use unlabeled sentences
✅ If uncertain which mode → Default to MODE C: GENERIC

⚠️ CRITICAL MODE B HALLUCINATION PREVENTION:
If user ONLY specifies platform (e.g., "TikTok strategy", "LinkedIn content plan") but does NOT specify:
- POV → DO NOT invent "creator POV", "expert POV", "brand voice POV"
- Word count → DO NOT invent "800-1000 words", "500-word posts"
- Tone → DO NOT invent "professional tone", "casual tone", "friendly tone"
- Audience → DO NOT invent "busy entrepreneurs", "business decision-makers", "Gen Z"
- Duration → DO NOT invent "15-20s videos", "3-minute clips"

Safe MODE B Pattern:
Format & POV: [Platform] content strategy with neutral perspective aligned with the user's brand positioning.
Flow: [Describe strategic progression without fabricating POV/duration/word count/tone/audience]
CTA: [Platform-native CTA]`,

      step5: `Ask the user:
- Which strategic territory resonates most with your brand vision?
- Should we develop any territory into concrete content pieces?
- Do you want to adjust the balance between territories?
- Should we explore additional territories or narrow focus?
- Need help creating a content calendar from these territories?`,
    },

    format: `Output format:

### 1. Orientation
[3-4 sentences summarizing brand context, content goals, and audience insights]

### 2. Strategic Territories
**Territory 1: [Name]**
[Description and why it aligns with brand + audience]

**Territory 2: [Name]**
[Description and why it aligns with brand + audience]

**Territory 3: [Name]**
[Description and why it aligns with brand + audience]

[Continue for 3-6 territories]

### 3. Series Concepts & Idea Seeds

**TERRITORY 1: [Name]**

Series Concepts:
- [Series concept 1 - platform-agnostic in MODE C, platform-specific only if MODE B]
- [Series concept 2 - platform-agnostic in MODE C, platform-specific only if MODE B]

Idea Seeds:
**Idea 1:** [One-sentence concept]
**Why it works:** [Connection to insight/goal]

**Idea 2:** [One-sentence concept]
**Why it works:** [Connection to insight/goal]

[Repeat for other territories]

### 4. Optimization
**Territory Analysis:**
- Coverage: [How territories address brand goals and audience needs]
- Differentiation: [What makes these territories unique/ownable]
- Sustainability: [How to maintain content flow over time]

**Strategic Guidance:**
- Evolution: [How to develop seeds into full content]
- Series Development: [How to create recurring formats]
- Repurposing: [How to adapt content across territories]
- Testing: [How to iterate based on performance]

**Execution Guidance:**
[3 lines with exact labels: "Format & POV:", "Flow:", "CTA:"]

### 5. Approval
[Question to move workflow forward, in appropriate language]`,

    platformSpecific: {
      linkedin: 'Focus on thought leadership, professional insights, and business value. Series concepts should emphasize expertise and credibility.',
      instagram: 'Visual storytelling is key. Series concepts should be highly visual and narrative-driven.',
      tiktok: 'Trend-aware and fast-paced. Series concepts should be easily reproducible and remix-friendly.',
      youtube: 'Long-form narrative arcs work well. Series concepts should support 5-15 minute storytelling.',
      facebook: 'Community-building and conversation. Series concepts should encourage sharing and discussion.',
      twitter: 'Real-time and conversational. Series concepts should be concise and discussion-starting.',
    },
  },

  tags: ['strategy', 'content-pillars', 'series-planning', 'ideation', 'strategic', 'long-term-planning'],

  exampleOutput: `### 1. Orientation
Brand is an online education platform teaching professionals new skills (coding, design, marketing). Content goals: build authority as trusted learning resource, drive free trial signups, foster active learning community. Target audience: working professionals 25-40 seeking career advancement but struggling with time constraints and motivation plateaus.

### 2. Strategic Territories

**Territory 1: Learning Science & Mindset Shifts**
Demystifying how learning actually works and breaking mental barriers that stop adults from learning. Addresses the insight that most people quit not because they lack ability, but because they misunderstand the learning process. Positions brand as education expert, not just course provider.

**Territory 2: Career Transformation Stories**
Real student journeys from skill acquisition to career impact. Addresses the desire for proof and relatability — seeing "people like me" succeed. Builds social proof and community while showcasing tangible outcomes.

**Territory 3: Skill Application Blueprints**
Practical frameworks for applying new skills immediately in real work contexts. Addresses the "what do I do with this knowledge" gap. Positions brand as practical and results-focused, not just theoretical.

**Territory 4: Learning Community & Accountability**
Behind-the-scenes of peer learning, study groups, and mutual support systems. Addresses the isolation of self-directed learning. Builds sense of belonging and differentiates from passive course platforms.

### 3. Series Concepts & Idea Seeds

**TERRITORY 1: Learning Science & Mindset Shifts**

Series Concepts:
- "Myth-Busting Monday" - recurring content debunking common learning misconceptions
- "The Learning Curve Explained" - episodic content breaking down different stages of skill acquisition

Idea Seeds:
**Idea 1:** Why feeling "worse" at Week 3 actually means you're progressing (the learning plateau explained)
**Why it works:** Reframes a common frustration point as a positive signal, removes shame around slow progress

**Idea 2:** The practice mistake everyone makes: repeating what you're already good at instead of isolating weak points
**Why it works:** Addresses universal learning inefficiency with actionable framework for improvement

**TERRITORY 2: Career Transformation Stories**

Series Concepts:
- "From Zero to Hired" - narrative sequence following students through their learning and job search journey
- "The Skill That Changed Everything" - focused stories on single skill acquisition and its ripple effects

Idea Seeds:
**Idea 3:** How Sarah went from struggling designer to leading a team by mastering one framework
**Why it works:** Specific transformation with clear before/after, relatable protagonist, concrete outcome

**Idea 4:** The accountant who learned to code and built an internal tool that saved his company 40 hours/week
**Why it works:** Unexpected career combination, quantifiable impact, demonstrates skill application

**TERRITORY 3: Skill Application Blueprints**

Series Concepts:
- "Week 1 Wins" - showing what you can build/do after just one week of focused learning
- "Skill Stack Strategy" - how to combine multiple skills for career leverage

Idea Seeds:
**Idea 5:** The 10-day challenge: learn SQL basics and immediately automate your most tedious work task
**Why it works:** Short timeframe removes "I don't have time" barrier, immediate practical payoff

**Idea 6:** How to turn 3 complementary skills into a unique career position no one else can fill
**Why it works:** Provides strategic career framework beyond just skill acquisition

**TERRITORY 4: Learning Community & Accountability**

Series Concepts:
- "Study Squad Chronicles" - recurring documentation of peer learning groups
- "Accountability Check-Ins" - structured progress updates and commitment mechanisms

Idea Seeds:
**Idea 7:** What happens when 5 strangers commit to learning together for 30 days (the results)
**Why it works:** Social proof, relatability, builds FOMO for community participation

**Idea 8:** The accountability system that increased course completion rates by 65% (and how to build your own)
**Why it works:** Addresses completion challenge with data-backed solution and DIY framework

### 4. Optimization

**Territory Analysis:**
- **Coverage:** All four territories collectively address the full learning journey (mindset → action → results → community), covering awareness (T1), social proof (T2), practical value (T3), and belonging (T4)
- **Differentiation:** Most competitors focus only on course content. These territories position the brand as learning partner and community, not just content library
- **Sustainability:** Each territory can generate 2-4 pieces of content per week indefinitely. T1 has endless learning science angles, T2 grows with each new student, T3 adapts to evolving skills, T4 documents ongoing community

**Strategic Guidance:**
- **Evolution:** Take idea seeds through this flow: concept → outline → draft → platform adaptation. Start with one seed per territory to test audience resonance before scaling
- **Series Development:** Launch one series per territory (4 total), publishing on consistent schedule (e.g., T1 Mondays, T2 Wednesdays, T3 Fridays, T4 bi-weekly). Track engagement to identify strongest series
- **Repurposing:** Student transformation stories (T2) can be repurposed across all territories: pull learning insights for T1, extract skill application tips for T3, highlight community support for T4
- **Testing:** Measure performance across three dimensions: engagement (saves, shares, comments), conversion (trial signups from content), retention (do viewers become active learners). Double down on territories that drive both engagement AND conversion

**Execution Guidance:**
Format & POV: Generic strategic content framework with neutral perspective.
Flow: Identifies strategic territories aligned with learning platform goals, develops platform-agnostic series concepts that can work across multiple channels, provides adaptable idea seeds for various content formats.
CTA: Consider which territory to prioritize for your Q1 content calendar.

### 5. Approval
Which strategic territory would you like to develop into concrete content pieces first, or should we create a content calendar that balances all four territories?`,

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
        { order: 2, name: 'Strategic Territories' },
        { order: 3, name: 'Series Concepts & Idea Seeds' },
        { order: 4, name: 'Optimization' },
        { order: 5, name: 'Approval' },
      ],
      hasExecutionGuidance: true,
    },
    tags: ['strategy', 'content-pillars', 'series-planning', 'ideation'],
    complexity: 'advanced',
  },
};
