// ============================================
// System Prompt Builder
// ============================================
// Builds normalized system prompts from template manifests
// Separated from schema types for cleaner architecture

import type { TemplateManifest, BuildSystemPromptOptions } from './templateManifest';

// ============================================
// GLOBAL RULES (Shared across all templates)
// ============================================
const GLOBAL_RULES = `# GLOBAL RULES (NON-NEGOTIABLE)

1. STRICT SECTION STRUCTURE: Follow the EXACT section structure specified below. Use the EXACT section labels provided.
2. NO EXTRA SECTIONS: Do NOT add sections beyond what is specified. Do NOT add meta-commentary, explanations, or process notes.
3. MUST/AVOID RULES: Strictly obey all MUST and AVOID constraints listed below.
4. HUMAN-READABLE OUTPUT: Output must be ready-to-publish, natural, and human-readable.
5. NO AI ARTIFACTS: Do not mention prompts, instructions, AI, or system behavior.
6. LANGUAGE: Keep section labels EXACTLY as specified. Only the CONTENT inside sections should match the user's language.`;

// ============================================
// TEMPLATE-SPECIFIC NORMALIZED PROMPTS
// ============================================
const NORMALIZED_STRUCTURE_RULES: Record<string, string> = {
  social_caption_v1: `# REQUIRED OUTPUT STRUCTURE

Output MUST follow this EXACT format with these EXACT labels:

**Hook:**
[1–2 câu dừng lướt, gây tò mò hoặc cảm xúc]

**Body:**
[2–4 đoạn ngắn, xuống dòng dễ đọc]

**Call-to-Action:**
[1 câu kêu gọi hành động cụ thể]

**Hashtags:** (optional)
[3–10 hashtag liên quan]

STRICT RULES:
- Hook MUST stop the scroll in the first line
- Body MUST use line breaks for readability
- CTA MUST be specific and actionable
- Do NOT add any sections beyond these 4
- Do NOT add numbered steps or explanations`,

  seo_blog_v1: `# REQUIRED OUTPUT STRUCTURE

Output MUST follow this EXACT format with these EXACT labels:

**Title:**
[50–60 ký tự, có từ khoá chính]

**Meta Description:**
[150–160 ký tự, có từ khoá + CTA]

**Introduction:**
[Nêu vấn đề + hứa giá trị, 150–200 từ]

**Main Content Sections:**
[H2/H3 phân cấp theo outline, 800–1500 từ tổng]

**Conclusion:**
[Tóm tắt + takeaway + hành động, 100–150 từ]

**FAQ Section:** (optional)
[3–5 Q&A nhắm keyword câu hỏi]

STRICT RULES:
- Title MUST include primary keyword
- Use proper H2/H3 hierarchy in Main Content
- Introduction MUST hook reader AND state value proposition
- Do NOT add any sections beyond these 6
- Do NOT add meta-commentary or process notes`,

  video_script_v1: `# REQUIRED OUTPUT STRUCTURE

Output MUST follow this EXACT format with these EXACT labels:

**Hook (0–3s):**
[1 câu + text trên màn hình, dừng lướt ngay]

**Main Content:**
[3–7 beat, mỗi beat 1 hành động/cảnh]
- Beat 1: [action/scene]
- Beat 2: [action/scene]
- Beat 3: [action/scene]
...

**Call-to-Action:**
[Kêu gọi follow/comment/click rõ ràng]

STRICT RULES:
- Hook MUST stop scroll in 0–3 seconds
- Write as SPOKEN language, NOT written prose
- Each beat = 1 clear action or scene transition
- CTA MUST be specific (e.g., "Comment CAFE", "Follow để xem thêm")
- Do NOT add any sections beyond these 3
- Do NOT add explanations or meta-commentary`,

  email_marketing_v1: `# REQUIRED OUTPUT STRUCTURE

Output MUST follow this EXACT format with these EXACT labels:

**Subject:**
[≤ 50 ký tự, gây tò mò hoặc nêu lợi ích rõ]

**Preview Text:** (optional)
[1 dòng tóm tắt lợi ích, hiển thị dưới subject]

**Email Body:**
[120–250 từ, đoạn ngắn 2–3 dòng, dễ đọc trên mobile]

**Call-to-Action:**
[1 hành động rõ ràng: reply, click, mua, đăng ký]

STRICT RULES:
- Keep 1 goal only per email – no mixing messages
- Email Body MUST be mobile-friendly (short paragraphs, line breaks)
- CTA MUST be one clear action, NOT vague (e.g., "Reply CÁCH", not "Tìm hiểu thêm")
- Keep labels EXACTLY as shown above
- Content in Vietnamese unless user writes in English
- Do NOT add any sections beyond these 4
- Do NOT use markdown beyond the **Label:** format`,

  landing_page_v1: `# REQUIRED OUTPUT STRUCTURE

Output MUST follow this EXACT format with these EXACT labels:

**Hero Headline:**
[Tiêu đề chính, rõ lợi ích lớn nhất, ngắn gọn]

**Sub-headline:**
[1–2 câu bổ sung, làm rõ giá trị hoặc đối tượng]

**Key Benefits:**
[3–5 bullet points, mỗi bullet = 1 lợi ích cụ thể]

**Social Proof:** (optional)
[Testimonial, số liệu, hoặc trust signal]

**Offer / CTA:**
[Đề xuất rõ ràng + nút hành động cụ thể]

STRICT RULES:
- 1 mục tiêu chuyển đổi duy nhất – KHÔNG trộn nhiều CTA
- Viết để người đọc LƯỚT vẫn hiểu được giá trị
- Benefits dạng bullet, KHÔNG viết đoạn văn dài
- CTA PHẢI cụ thể (e.g., "Đăng ký ngay", "Dùng thử miễn phí 14 ngày")
- Do NOT add any sections beyond these 5
- Do NOT write like a blog post`,

  product_description_v1: `# REQUIRED OUTPUT STRUCTURE

Output MUST follow this EXACT format with these EXACT labels:

**Product Title:**
[Tên sản phẩm rõ ràng, có từ khóa chính]

**Key Benefits:**
[3–5 bullet points, lợi ích trước – tính năng sau]

**Features / Specs:** (optional)
[Thông số kỹ thuật nếu cần, dạng bullet]

**Usage / Who is it for:** (optional)
[Ai nên dùng, dùng khi nào, ngắn gọn]

**Call-to-Action:**
[Kêu gọi mua/đặt hàng rõ ràng]

STRICT RULES:
- Lợi ích TRƯỚC, tính năng SAU
- Viết cho người mua, KHÔNG viết cho chuyên gia
- Dễ đọc trên mobile (bullet, đoạn ngắn)
- CTA cuối cùng, rõ ràng
- Do NOT add any sections beyond these 5
- Do NOT use jargon or overly promotional language`,

  reel_caption_v1: `# REQUIRED OUTPUT STRUCTURE

Output MUST follow this EXACT format with these EXACT labels:

**Hook Line:**
[1 dòng gây tò mò, dừng lướt]

**Context Line:** (optional)
[1 dòng bổ sung ngữ cảnh nếu cần]

**Engagement CTA:**
[Kêu gọi comment/save/share cụ thể]

STRICT RULES:
- TỔNG CỘNG tối đa 4 dòng
- Đọc trong 3–5 giây
- Caption BỔ TRỢ video, KHÔNG thay thế
- CTA PHẢI cụ thể (e.g., "Comment ĐỊA CHỈ", "Save lại đi chơi cuối tuần")
- Do NOT tell a story – video does that
- Do NOT repeat what's already in the video
- Do NOT add any sections beyond these 3`,
};

/**
 * Build System Prompt from Template Manifest
 *
 * Deterministic system prompt builder that constructs a complete
 * system message from a template manifest with NORMALIZED structure rules.
 *
 * @param manifest - Template manifest
 * @param options - Optional customization
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(
  manifest: TemplateManifest,
  options: BuildSystemPromptOptions = {}
): string {
  const sections: string[] = [];

  // ============================================
  // Section 0: Global Rules (ALWAYS FIRST)
  // ============================================
  sections.push(GLOBAL_RULES);
  sections.push('');

  // ============================================
  // Section 1: Role & Objective
  // ============================================
  sections.push(`# ROLE & OBJECTIVE`);
  sections.push(manifest.objective);
  sections.push('');

  // ============================================
  // Section 2: Normalized Structure Rules (Template-Specific)
  // ============================================
  const normalizedRules = NORMALIZED_STRUCTURE_RULES[manifest.id];
  if (normalizedRules) {
    sections.push(normalizedRules);
  } else {
    // Fallback for templates without normalized rules
    sections.push(`# OUTPUT STRUCTURE (${manifest.outputSpec.format})`);
    sections.push('Your output MUST include these sections:\n');
    manifest.outputSpec.sections.forEach((section, index) => {
      const requiredLabel = section.required ? '[REQUIRED]' : '[OPTIONAL]';
      sections.push(`${index + 1}. **${section.name}** ${requiredLabel}`);
      sections.push(`   ${section.description}`);
    });
  }
  sections.push('');

  // ============================================
  // Section 3: Hard Constraints
  // ============================================
  sections.push(`# CONSTRAINTS`);

  if (manifest.constraints.must.length > 0) {
    sections.push('\n## You MUST:');
    manifest.constraints.must.forEach((rule) => {
      sections.push(`- ${rule}`);
    });
  }

  if (manifest.constraints.avoid.length > 0) {
    sections.push('\n## You MUST AVOID:');
    manifest.constraints.avoid.forEach((rule) => {
      sections.push(`- ${rule}`);
    });
  }

  if (manifest.constraints.maxLength) {
    sections.push(`\n## Length Constraint:`);
    sections.push(`- ${manifest.constraints.maxLength}`);
  }
  sections.push('');

  // ============================================
  // Section 4: Style Guidance
  // ============================================
  sections.push(`# STYLE GUIDANCE`);
  sections.push(manifest.style.description);

  if (manifest.style.formatting.length > 0) {
    sections.push('\nFormatting Rules:');
    manifest.style.formatting.forEach((rule) => {
      sections.push(`- ${rule}`);
    });
  }
  sections.push('');

  // ============================================
  // Section 5: Optional Tone Reinforcement
  // ============================================
  if (options.toneReinforcement) {
    sections.push(`# TONE REINFORCEMENT`);
    sections.push(options.toneReinforcement);
    sections.push('');
  }

  // ============================================
  // Section 6: Optional Platform Hint
  // ============================================
  if (options.platformHint) {
    sections.push(`# PLATFORM-SPECIFIC GUIDANCE`);
    sections.push(options.platformHint);
    sections.push('');
  }

  // ============================================
  // Section 7: First Non-Mini Example (for AI execution)
  // ============================================
  if (manifest.examples && manifest.examples.length > 0) {
    // Skip MINI preview examples (they're for UI, not AI execution)
    const nonMiniExample = manifest.examples.find(
      (ex) => !ex.scenario.toLowerCase().includes('preview mini')
    );
    // Fallback to last example if all are mini
    const selectedExample = nonMiniExample || manifest.examples[manifest.examples.length - 1];

    sections.push(`# EXAMPLE OUTPUT`);
    sections.push(`Scenario: ${selectedExample.scenario}`);
    sections.push('```');
    sections.push(selectedExample.output);
    sections.push('```');
    sections.push('');
  }

  // ============================================
  // Final Assembly
  // ============================================
  return sections.join('\n').trim();
}
