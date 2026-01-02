import { NextRequest, NextResponse } from 'next/server';
import { getPostById } from '@/lib/api/posts';
import { createVariants } from '@/lib/api/variants';
import { PLATFORMS, PLATFORM_CHAR_LIMITS } from '@/lib/platforms';
import type {
  Platform,
  Language,
  GenerateVariantsRequest,
  CreateVariantInput,
} from '@/lib/types';

// Unicode-safe character limit enforcement
// Handles Vietnamese diacritics, emojis, and special characters correctly
function enforceCharacterLimit(text: string, maxChars: number): string {
  const chars = Array.from(text); // Unicode-safe counting
  if (chars.length <= maxChars) return text;

  // Truncate with safety margin and add ellipsis
  const truncated = chars.slice(0, maxChars - 1).join('');
  return truncated.trimEnd() + '…';
}

// Stub AI generation function
// Replace this with real OpenAI/Claude API call when ready
async function _generateVariantsWithAI(
  baseContent: string,
  baseTitle: string,
  platforms: Platform[],
  language: Language
): Promise<Array<{ platform: Platform; language: Language; content: string; approx_char_count: number }>> {
  // TODO: Replace with real AI API call
  // Example: const response = await openai.chat.completions.create({ ... });

  console.log('🤖 [AI Stub] Generating variants for:', {
    platforms,
    language,
    contentLength: baseContent.length,
  });

  // Stub implementation - generates fake variants
  return platforms.map((platform) => {
    const charLimit = PLATFORM_CHAR_LIMITS[platform];
    let content = '';

    // Create platform-specific content based on character limits
    if (language === 'both') {
      // Dual language format
      const viContent = `${baseTitle}\n\n${baseContent.substring(0, charLimit ? Math.floor(charLimit / 2.5) : 500)}`;
      const enContent = `${baseTitle}\n\n${baseContent.substring(0, charLimit ? Math.floor(charLimit / 2.5) : 500)}`;
      content = `${viContent}\n\n---\n\n${enContent}`;
    } else {
      // Single language
      content = `${baseTitle}\n\n${baseContent.substring(0, charLimit || 2000)}`;
    }

    // Trim to platform limit if needed
    if (charLimit && content.length > charLimit) {
      content = content.substring(0, charLimit - 3) + '...';
    }

    return {
      platform,
      language,
      content,
      approx_char_count: content.length,
    };
  });
}

// Real AI generation function using GPT-5.1 with custom Tà Xùa Tour prompt
async function generateVariantsWithAIReal(
  baseContent: string,
  baseTitle: string,
  platforms: Platform[],
  _language: Language
): Promise<Array<{ platform: Platform; language: Language; content: string; approx_char_count: number }>> {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const systemPrompt = `You are "Content Machine – Bilingual Variant Engine", a professional content transformation system specialized in rewriting a single source text into platform-optimized bilingual content (Vietnamese → English), following strict format, tone, and character limits.

-------------------------
💠 CORE OBJECTIVE
Transform the user's source content into a platform-specific post that is:
1. Natural, readable, and emotionally grounded.
2. Follows the Tà Xùa Tour brand voice:
   - Calm, sincere, grounded
   - Observational, đời, gần gũi
   - Emotional without exaggeration
   - Never dramatic, never poeticized
   - Never overly commercial
3. Outputs *bilingual content* (VN → EN) in a fixed format.
4. Respects each platform's character limit (VN + EN combined).

-------------------------
💠 OUTPUT FORMAT (STRICT)
Your output must follow **exactly** this structure:

[VIETNAMESE VERSION]
(keep natural line breaks)

---
[ENGLISH VERSION]
(natural translation, not literal, not robotic)

Rules:
- No markdown
- No code blocks
- No extra spaces above or below
- No emojis unless the platform allows it (Instagram & Threads OK; X optional; LinkedIn minimal)
- VN version always comes first

-------------------------
💠 CHARACTER LIMIT RULES (CRITICAL - OBSESS OVER THIS)
- You will be told the EXACT character limit for each platform.
- The **combined** bilingual output (VN + "---" separator + EN) must NOT exceed that limit.
- **TREAT THIS AS A HARD CONSTRAINT** - staying under the limit is MORE IMPORTANT than completeness.
- **Target 80-90% of the max character limit** as a safety buffer to avoid truncation.
- The character budget is SHARED by both languages - if VN is long, EN must be shorter.

PLATFORM-SPECIFIC CHARACTER GUIDANCE:
- **Very Short Platforms** (X: 280, Bluesky: 300, Threads: 500, Pinterest: 500):
  * Use EXTREME brevity
  * One core idea only
  * Very short sentences
  * Minimal descriptive elements
  * Target 70-80% of limit (e.g., X should be ~200-220 chars total)

- **Medium Platforms** (Google: 1500, Instagram: 2200):
  * Moderate detail allowed
  * Can include storytelling but stay concise
  * Target 80-90% of limit

- **Long Platforms** (LinkedIn: 3000, YouTube: 5000):
  * More detailed content allowed
  * Still compress where possible
  * Target 85-90% of limit

If needed to stay under limit:
- Reduce duplication
- Compress ideas aggressively
- Prioritize clarity over length
- Remove unnecessary details while preserving meaning
- Use shorter sentence structures

Never simply "cut off" text. Always rewrite gracefully to fit within the limit.

-------------------------
💠 PLATFORM-SPECIFIC RULES
You must adapt tone + structure to each platform:

1. **Twitter/X (280 chars)**
   - Very short
   - One core idea
   - Minimal descriptive elements
   - No long storytelling
   - Hashtags optional and limited

2. **Instagram Post (2200 chars)**
   - Strong storytelling
   - Natural flow
   - Line breaks encouraged
   - Hashtags allowed

3. **Threads (500 chars)**
   - Conversational
   - Shorter than Instagram
   - Casual

4. **LinkedIn (3000 chars)**
   - Professional but warm
   - Clear narrative
   - No emojis (or minimal)

5. **Pinterest (500 chars)**
   - Clean, simple
   - Focused on visual imagination

6. **YouTube Community (5000 chars)**
   - Longer format allowed
   - Can include more description & context

7. **Bluesky (300 chars)**
   - Shorter, similar to X but less formal

8. **Google Post (1500 chars)**
   - Clear, concise, informational tone

-------------------------
💠 VIETNAMESE STYLE RULES
- Viết tự nhiên, đời, mộc
- Tránh văn phong hoa mỹ hoặc quảng cáo
- Câu ngắn, gọn nhưng vẫn giàu hình ảnh đời thường
- Không dùng từ ngữ giáo huấn

-------------------------
💠 ENGLISH STYLE RULES
- Natural, fluent, human
- Not literal translation
- Preserve mood and meaning
- Avoid exaggeration

-------------------------
💠 WHAT YOU SHOULD NEVER DO
- Do NOT duplicate the Vietnamese block
- Do NOT output English identical to VN structure
- Do NOT translate link or hashtags
- Do NOT exceed character limits
- Do NOT add new ideas not in the source
- Do NOT use markdown

-------------------------
💠 FINAL OUTPUT
Always return ONLY the final bilingual text in the required format, nothing else.`;

  // Generate variants for each platform
  const variantPromises = platforms.map(async (platform) => {
    const charLimit = PLATFORM_CHAR_LIMITS[platform];

    const userPrompt = `Platform: ${platform}
Character Limit: ${charLimit} characters (VN + separator + EN combined)

Source Title: ${baseTitle}

Source Content:
${baseContent}

Generate a bilingual variant optimized for ${platform}.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error for ${platform}: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error(`No content returned from OpenAI for ${platform}`);
    }

    // Apply hard character limit enforcement
    const trimmedContent = content.trim();
    const enforcedContent = enforceCharacterLimit(trimmedContent, charLimit!);

    return {
      platform,
      language: 'both' as Language,
      content: enforcedContent,
      approx_char_count: Array.from(enforcedContent).length, // Unicode-safe count
    };
  });

  return await Promise.all(variantPromises);
}

// POST /api/posts/[id]/generate-variants
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const post = await getPostById(resolvedParams.id);

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const body: GenerateVariantsRequest = await request.json();

    // Determine platforms - use request, post platforms, or all platforms
    const platforms: Platform[] =
      body.platforms ||
      (post.platforms as Platform[]) ||
      PLATFORMS;

    const language: Language = body.languages?.[0] || 'both';

    // Generate variants using real AI (GPT-5.1 with Tà Xùa Tour prompt)
    const generatedVariants = await generateVariantsWithAIReal(
      post.content,
      post.title,
      platforms,
      language
    );

    // Prepare variant inputs for database
    const variantInputs: CreateVariantInput[] = generatedVariants.map((v) => ({
      base_post_id: post.id,
      platform: v.platform,
      language: v.language,
      content: v.content,
      character_count: v.approx_char_count,
      status: 'draft',
      scheduled_at: null,
      published_at: null,
      platform_post_url: null,
    }));

    // Save to database
    const savedVariants = await createVariants(variantInputs);

    return NextResponse.json({
      success: true,
      variants: savedVariants,
      count: savedVariants.length,
    });
  } catch (error: unknown) {
    console.error('Generate variants error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate variants',
      },
      { status: 500 }
    );
  }
}
