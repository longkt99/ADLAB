// ============================================
// Ad Copy Template
// ============================================
// For conversion-focused advertising copy
// Optimized for Facebook Ads, Google Ads, TikTok Ads
// ✅ ULTRA PRECISION EXECUTION ENGINE COMPLIANT
// 🌍 UNIVERSAL: Works for ANY offer (product, service, course, event, subscription, etc.)

import type { ContentTemplate } from './templateSchema';

export const adCopyTemplate: ContentTemplate = {
  id: 'ad_copy',
  name: 'Quảng Cáo Chuyển Đổi',
  description: 'Tạo nội dung quảng cáo chuyển đổi cao với giá trị rõ ràng, tính cấp bách, và CTA mạnh mẽ',
  nameKey: 'studio.templateMeta.ad_copy.name',
  descriptionKey: 'studio.templateMeta.ad_copy.description',

  platforms: ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube'],

  toneSupport: ['professional', 'friendly', 'genz', 'conversational', 'inspirational'],

  category: 'content_creation',

  rules: {
    steps: {
      step1: `Analyze the ad brief to identify:
- What is the product/service?
- Who is the target audience? (demographics, pain points, desires)
- What is the main benefit or unique selling proposition (USP)?
- What action do we want users to take?
- What is the offer (discount, free trial, limited time)?
Summarize in 3-4 sentences focusing on audience pain points and solution.`,

      step2: `Suggest 2-4 ad copy angles:
- Pain → Solution (identify problem, present product as answer)
- Benefit-Driven (focus on transformation/results)
- Social Proof (leverage testimonials/numbers)
- FOMO/Urgency (limited time, scarcity, exclusive access)
Each angle should target different psychological triggers.`,

      step3: `Write ad copy following the AIDA framework:

1. ATTENTION (Headline)
   - Stop the scroll with bold claim or question
   - Speak directly to target audience
   - Use numbers, questions, or provocative statements

2. INTEREST (Opening lines)
   - Agitate the pain point OR amplify the desire
   - Make it relatable and specific
   - Use "you" language

3. DESIRE (Body)
   - Present the solution clearly
   - List 3-5 key benefits (not features!)
   - Include social proof if available (numbers, testimonials)
   - Create urgency or scarcity

4. ACTION (CTA)
   - Clear, specific action (not "Learn More")
   - Remove friction ("Free trial", "No credit card needed")
   - Create urgency ("Limited spots", "Sale ends X")

Format:
[HEADLINE]
[1-2 lines - attention grabber]

[OPENING]
[2-3 lines - agitate or amplify]

[BENEFITS]
✓ Benefit 1
✓ Benefit 2
✓ Benefit 3

[SOCIAL PROOF / URGENCY]
[1-2 lines with numbers or testimonials]

[CTA]
[Action-oriented, clear next step]

Rules:
- Focus on benefits, not features
- Use active voice
- Include specific numbers when possible
- Make the value proposition crystal clear
- NO hype without substance
- Test different urgency levels

⚠️ CRITICAL: After generating the ad copy, you MUST ALWAYS output the **Execution Guidance:** block in step4. Do NOT skip it. This block is MANDATORY and uses the v2.3 tri-mode system.`,

      step4: `Optimize the ad copy by:
- Testing headline variations (question vs. statement vs. number)
- Ensuring each benefit answers "What's in it for me?"
- Strengthening the CTA (more specific = better)
- Checking for clarity (can a 12-year-old understand?)
- Removing any fluff or weak modifiers ("very", "really", "quite")
- Verifying urgency feels genuine, not manipulative

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
User specifies: "Facebook ad for my productivity app"
Format & POV: Facebook ad with neutral perspective aligned with productivity app marketing.
Flow: Opens with scroll-stopping pain point question, demonstrates solution with 3 clear benefits, closes with friction-free offer and urgency.
CTA: Sign up now - free 7-day trial, no credit card needed.

**Example (MODE A: ABSTRACT):**
User requests: "Abstract ad concept"
Format & POV: Abstract mode — a conceptual appeal to transformation, neutral perspective without medium constraints.
Flow: Opens with universal pain point, develops through philosophical benefits of change, closes with introspective call to action.
CTA: Consider if this resonates with your current needs.

**Example (MODE C: GENERIC):**
User requests: "Ad copy for my new product"
Format & POV: Generic promotional message with value-driven perspective.
Flow: Opens with attention-grabbing benefit statement, develops through key product advantages, closes with clear call to action.
CTA: Learn more about how this can help you.

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
- Want to try a different angle (pain vs. benefit vs. social proof)?
- Should we increase or decrease urgency?
- Need variations for A/B testing?
- Want to adjust tone (more professional? more casual?)?
- Should we add/remove elements (testimonial, guarantee, bonus)?`,
    },

    format: `Output format:

### 1. Orientation
[Summary of product, audience, and conversion goal]

### 2. Angle Suggestions
**Option A:** [Angle name] - [Psychological trigger it targets]
**Option B:** [Angle name] - [Psychological trigger it targets]
**Option C:** [Angle name] - [Psychological trigger it targets]

### 3. Generated Content

**[HEADLINE]**
[Attention-grabbing headline]

[OPENING - 2-3 lines]
[Agitate pain point or amplify desire]

[BENEFITS]
✓ [Benefit 1 - specific transformation]
✓ [Benefit 2 - specific transformation]
✓ [Benefit 3 - specific transformation]

[SOCIAL PROOF / URGENCY]
[Numbers, testimonials, or scarcity element]

[CTA]
👉 [Clear, action-oriented call-to-action]

### 4. Optimization
[Explanation of conversion-focused improvements]

**Execution Guidance:**
[2-3 sentences: format + POV, ad flow/story beats, platform-native CTA]

### 5. Approval
What would you like to modify or refine?`,

    platformSpecific: {
      facebook: 'First 2 lines visible before "See More". Put hook there. Use emojis sparingly for professionalism.',
      instagram: 'Visual-first. Keep copy punchy. Use line breaks liberally. Emojis work well.',
      tiktok: 'Ultra-casual, speak like a friend. Short sentences. Heavy emoji use acceptable. Focus on relatability.',
      linkedin: 'Professional tone. B2B focus. Emphasize ROI and business outcomes. Minimal emojis.',
      youtube: 'Structure as pre-roll or mid-roll script. Conversational delivery. Include [PAUSE] markers.',
    },
  },

  tags: ['advertising', 'conversion', 'marketing', 'sales', 'facebook-ads', 'cta'],

  exampleOutput: `### 1. Orientation
Advertising a time management app for busy entrepreneurs who struggle with overwhelm and productivity. Goal: Drive free trial signups with 7-day trial offer.

### 2. Angle Suggestions
**Option A:** Pain-Agitation - Start with the chaos of disorganization, offer calm solution
**Option B:** Transformation - Before (overwhelmed) vs. After (in control)
**Option C:** Social Proof - Leverage testimonials and user numbers

### 3. Generated Content

**Đang quản lý 10 dự án nhưng cảm giác như chẳng hoàn thành được cái nào?**

Bạn không thiếu năng lực. Bạn thiếu hệ thống.

Mỗi ngày lãng phí 2 giờ chỉ để tìm file, nhớ deadline, và lo lắng xem mình đã quên gì. TaskFlow giúp bạn lấy lại quyền kiểm soát.

✓ Tự động nhắc deadline - không bao giờ lỡ hạn quan trọng
✓ Tổ chức dự án trực quan - nhìn 1 cái biết ngay phải làm gì
✓ Sync đa thiết bị - cập nhật mọi lúc, mọi nơi

Hơn 50,000 entrepreneurs đã giảm 40% thời gian lên kế hoạch với TaskFlow.

🎁 Dùng thử FREE 7 ngày - Không cần thẻ tín dụng
⏰ Ưu đãi kết thúc 31/12

👉 Đăng ký ngay - 2 phút setup, trọn đời yên tâm

### 4. Optimization
- Headline addresses specific pain (managing 10 projects but completing none)
- Reframed problem (not lack of ability, lack of system) - removes shame
- Benefits focus on transformation (save time, gain control, reduce stress)
- Social proof adds credibility (50,000 users, 40% time saved)
- CTA removes friction (free trial, no credit card) and creates urgency (ends 31/12)
- Used Vietnamese naturally without awkward translations

**Execution Guidance:**
Format & POV: Facebook ad with neutral perspective aligned with time management app marketing.
Flow: Opens with scroll-stopping pain point question (managing 10 projects), agitates with time waste reality, presents solution with 3 clear benefits, adds social proof credibility, closes with friction-free offer and urgency.
CTA: Đăng ký ngay (Sign up now) - emphasizes 2-minute setup and free 7-day trial with deadline urgency (ends 31/12).

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
    tags: ['advertising', 'conversion', 'marketing', 'cta'],
    complexity: 'intermediate',
  },
};
