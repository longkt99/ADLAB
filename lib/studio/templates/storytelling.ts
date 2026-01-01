// ============================================
// Storytelling Template
// ============================================
// For long-form narrative content with emotional arc
// Optimized for blogs, LinkedIn posts, Facebook stories
// ✅ ULTRA PRECISION EXECUTION ENGINE COMPLIANT
// 🌍 UNIVERSAL: Works for ANY narrative (personal, business, customer, educational, etc.)

import type { ContentTemplate } from './templateSchema';

export const storytellingTemplate: ContentTemplate = {
  id: 'storytelling',
  name: 'Nội Dung Kể Chuyện',
  description: 'Tạo nội dung kể chuyện hấp dẫn với cốt truyện rõ ràng, cộng hưởng cảm xúc, và bài học ý nghĩa',
  nameKey: 'studio.templateMeta.storytelling.name',
  descriptionKey: 'studio.templateMeta.storytelling.description',

  platforms: ['linkedin', 'facebook', 'instagram', 'youtube'],

  toneSupport: ['storytelling', 'inspirational', 'conversational', 'professional', 'journalistic'],

  category: 'content_creation',

  rules: {
    steps: {
      step1: `Analyze the storytelling brief:
- What is the core story or experience?
- Who is the protagonist (person, brand, customer)?
- What is the central conflict or challenge?
- What is the transformation or lesson?
- What emotion should readers feel?
Summarize the story arc in 3-4 sentences.`,

      step2: `Suggest 2-4 storytelling angles:
- Hero's Journey (struggle → breakthrough → transformation)
- Before & After (contrast-driven narrative)
- Behind the Scenes (revealing the hidden process)
- Universal Truth (personal story → broader lesson)
Each angle should emphasize different story elements.`,

      step3: `Write the story following this narrative structure:

1. OPENING (Set the scene)
   - Hook the reader with a vivid moment or question
   - Establish context and stakes
   - Make it relatable

2. RISING ACTION (Build tension)
   - Introduce the challenge or conflict
   - Show the struggle authentically
   - Use sensory details and emotions

3. CLIMAX (The turning point)
   - The moment of realization or decision
   - Peak emotional intensity
   - Show, don't just tell

4. RESOLUTION (The transformation)
   - How things changed
   - What was learned
   - The new perspective

5. TAKEAWAY (Universal lesson)
   - Connect the story to the reader
   - Make it actionable or inspirational
   - End with resonance

Rules:
- NO generic corporate speak
- Use specific details, not vague generalizations
- Include dialogue or inner thoughts when relevant
- Vary sentence length for rhythm
- Let emotions be genuine, not manufactured
- NO character limits - let the story breathe

⚠️ CRITICAL: After generating the story, you MUST ALWAYS output the **Execution Guidance:** block in step4. Do NOT skip it. This block is MANDATORY and uses the v2.3 tri-mode system.`,

      step4: `Optimize the story by:
- Strengthening the opening hook (first 2 sentences must grip)
- Adding more sensory details (what did it look, sound, feel like?)
- Removing any filler or repetitive phrases
- Ensuring smooth transitions between story beats
- Checking that the takeaway feels earned, not forced
- Verifying emotional authenticity (does it feel real?)

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
User specifies: "LinkedIn long-form post with personal story"
Format & POV: LinkedIn long-form post with personal narrative perspective documenting a journey.
Flow: Opens with visceral hook moment, builds through 3 personal anecdotes showing struggle, transitions to breakthrough moment, closes with universal lesson.
CTA: Save this if you needed to hear it, or comment your own experience.

**Example (MODE A: ABSTRACT):**
User requests: "Abstract storytelling piece"
Format & POV: Abstract mode — a narrative exploration of personal transformation without medium constraints.
Flow: Opens with vulnerable moment of realization, develops through philosophical reflections on the journey, closes with universal truth about growth.
CTA: Consider your own journey and what it has taught you.

**Example (MODE C: GENERIC):**
User requests: "Tell my entrepreneurship story"
Format & POV: Generic narrative piece with personal perspective documenting business journey.
Flow: Opens with defining challenge moment, builds through key decision points and lessons learned, closes with transformational insight.
CTA: Reflect on your own entrepreneurial journey and the lessons you've learned.

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
- Want to emphasize a different emotion?
- Should we expand or condense any section?
- Need to adjust the tone (more vulnerable? more professional?)?
- Want to try a different storytelling angle?
- Should we add more specific details or dialogue?`,
    },

    format: `Output format:

### 1. Orientation
[Summary of the story core and intended emotional impact]

### 2. Angle Suggestions
**Option A:** [Storytelling approach] - [Why this works]
**Option B:** [Storytelling approach] - [Why this works]
**Option C:** [Storytelling approach] - [Why this works]

### 3. Generated Content

[OPENING - Set the scene with a hook]
[2-3 paragraphs establishing context and stakes]

[RISING ACTION - The challenge]
[2-4 paragraphs building tension and showing the struggle]

[CLIMAX - The turning point]
[1-2 paragraphs capturing the pivotal moment]

[RESOLUTION - The transformation]
[2-3 paragraphs showing the change]

[TAKEAWAY - Universal lesson]
[1-2 paragraphs connecting to the reader]

### 4. Optimization
[Specific improvements made to enhance narrative flow and emotional impact]

**Execution Guidance:**
[2-3 sentences: format + POV, content flow/story beats, platform-native CTA]

### 5. Approval
What would you like to modify or refine?`,

    platformSpecific: {
      linkedin: 'Professional but personal. Focus on career/business lessons. Can be 1000+ words. Use paragraph breaks liberally.',
      facebook: 'More casual and emotional. Can include personal anecdotes freely. Use shorter paragraphs for mobile reading.',
      instagram: 'If carousel, break into 8-10 slides. Each slide = one story beat. Very visual language.',
      youtube: 'Structure as video script. Include [PAUSE] markers. More conversational delivery.',
    },
  },

  tags: ['storytelling', 'narrative', 'long-form', 'emotional', 'inspirational', 'linkedin'],

  exampleOutput: `### 1. Orientation
A personal transformation story about overcoming fear of failure through a startup journey, evoking inspiration and resilience.

### 2. Angle Suggestions
**Option A:** Hero's Journey - Focus on the struggle, breakthrough moment, and transformation
**Option B:** Before & After - Contrast the old fearful self with the new resilient self
**Option C:** Behind the Scenes - Reveal the messy, real process that people don't usually see

### 3. Generated Content

Năm 2019, tôi ngồi trước laptop với tay run rẩy.

Đây là lần thứ 12 tôi nhấn nút "Publish" rồi lại "Unpublish". Không phải website có lỗi. Không phải thiếu tiền marketing. Mà là tôi sợ. Sợ không ai quan tâm. Sợ bị chê cười. Sợ thất bại.

Startup đầu tiên của tôi chết yểu sau 3 tháng không phải vì ý tưởng tồi. Mà vì tôi không dám cho nó sống.

Chuyển sang tháng 6/2020, giữa lúc cả thế giới đóng băng vì COVID, tôi lại bắt đầu. Lần này khác. Tôi không hỏi "Nếu thất bại thì sao?" mà hỏi "Nếu không thử thì sao?"

Launch ngày đầu: 3 khách hàng. Không phải 300. Không phải 30. Chỉ 3.

Nhưng 3 người ấy tin tôi khi chính tôi chưa tin mình.

Một năm sau, chúng tôi có 1,000+ users. Không phải vì sản phẩm hoàn hảo. Mà vì mỗi lần vấp ngã, tôi đứng dậy nhanh hơn lần trước một chút.

Bây giờ khi nhìn lại, tôi nhận ra: Thất bại không phải là kết thúc. Mà là dữ liệu. Mỗi lần "không được" là một lần học. Mỗi lần bị từ chối là một lần lọc ra đúng hướng.

Nếu bạn đang giữ một ý tưởng trong đầu mà chưa dám thực hiện, đây là dấu hiệu của bạn. Không phải để làm liều. Mà để bắt đầu nhỏ, thất bại nhanh, và học thật nhiều.

Bạn không cần phải hoàn hảo. Bạn chỉ cần bắt đầu.

### 4. Optimization
- Opened with a visceral, specific moment (tay run rẩy, lần thứ 12)
- Used contrast between 2019 fear and 2020 action
- Included specific numbers (3 khách hàng, 1,000+ users) for credibility
- Structured around question shift ("Nếu thất bại?" → "Nếu không thử?")
- Ended with actionable mindset shift, not generic motivation
- Removed any corporate jargon - kept it raw and authentic

**Execution Guidance:**
Format & POV: LinkedIn long-form post with personal narrative perspective, documenting a startup journey from fear to resilience.
Flow: Opens with visceral hook moment (trembling hands, 12th unpublish), builds through contrast between 2019 paralysis and 2020 action, shows turning point with question shift, reveals growth through specific numbers, closes with universal lesson about starting imperfectly.
CTA: Save this if you needed to hear it, or comment your own experience with fear of starting.

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
    defaultMode: 'generic',
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
    tags: ['storytelling', 'narrative', 'long-form', 'emotional'],
    complexity: 'intermediate',
  },
};
