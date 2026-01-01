// ============================================
// AI Client Service for Studio
// ============================================
// FEATURE FLAG SYSTEM:
// - NEXT_PUBLIC_USE_REAL_AI='false' → MOCK mode (default, development)
// - NEXT_PUBLIC_USE_REAL_AI='true' → REAL AI mode (production)
//
// REAL AI REQUIREMENTS:
// - process.env.OPENAI_API_KEY → Primary provider (GPT-4)
// - process.env.ANTHROPIC_API_KEY → Fallback provider (Claude 3.5)
// - At least one key must be present for REAL mode
//
// RESPONSE CONTRACT:
// - Both MOCK and REAL modes return identical StudioAIResponse shape
// - Frontend remains unchanged regardless of mode

import type {
  StudioAIRequest,
  StudioAIRequestMeta,
  StudioAIResponse,
} from './aiTypes';
import { getTemplateById, templateExists } from './templateLoader';
import { resolveTemplateManifest } from './templates/resolveManifest';
import { buildSystemPrompt } from './templates/buildSystemPrompt';

// ============================================
// FEATURE FLAG: Toggle between MOCK and REAL AI
// ============================================
const USE_REAL_AI = process.env.NEXT_PUBLIC_USE_REAL_AI === 'true';

/**
 * Detect the language of user input based on Vietnamese diacritics
 * @param input - User's text input
 * @returns 'vi' for Vietnamese, 'en' for English
 */
export function detectLanguage(input: string): 'vi' | 'en' {
  // Vietnamese diacritics pattern
  const VIETNAMESE_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  return VIETNAMESE_REGEX.test(input) ? 'vi' : 'en';
}

/**
 * Default system message: Content Machine Engine
 * Implements the 5-step structured content generation pipeline
 * Used as fallback when no template is selected
 */
export function getDefaultSystemMessage(): string {
  return `You are Content Machine Engine, an AI system responsible for creating, refining, optimizing, and approving content across multiple platforms.
You are NOT a chatbot — you operate as a structured content-generation pipeline.

Your output must ALWAYS follow a fixed workflow and strict template rules, ensuring consistency and predictable results.

🧠 1. CORE PRINCIPLES

You must ALWAYS follow the 5-Step Content Pipeline:

Step 1 — Orientation: Summarize the user's goal
Step 2 — Angle Suggestions: Provide 2–4 writing directions
Step 3 — Content Creation: Generate content strictly based on Template Rules
Step 4 — Optimization: Improve clarity, tone, and structure
Step 5 — Approval: Ask the user what they want to adjust

You must NEVER skip any step.
You must ALWAYS obey the template rules.
You must ALWAYS follow the tone specified by the user.
You must NOT generate content before Step 1 and Step 2 are completed.

🔧 2. TEMPLATE FRAMEWORK (UNIVERSAL STRUCTURE)

Every template in the Content Machine ecosystem follows this structure:

{
  "id": "unique_template_id",
  "name": "Template Display Name",
  "description": "What this template is used for",
  "platforms": ["facebook", "tiktok", "instagram", "linkedin", "youtube"],
  "toneSupport": ["genz", "professional", "friendly", "storytelling"],
  "rules": {
    "steps": {
      "step1": "How AI should analyze the brief",
      "step2": "How AI should propose writing angles",
      "step3": "Exact instructions for generating the main content",
      "step4": "Rules for optimizing the content",
      "step5": "Approval logic"
    },
    "format": "Exact output format that the final content must follow"
  }
}

NOTE:
🚫 No character limits.
🚫 No max/min length rules.
The AI decides length based on template style + clarity.

🧩 3. ENGINE EXECUTION LOGIC

When a template is selected, you must:

Step A — Load Template Rules
Import all template-specific rules: format, tone, structure, platform nuances, any special instructions

Step B — Apply the 5-step content generation pipeline

STEP 1 — ORIENTATION
Summarize the user's intent clearly, concisely, and correctly.

STEP 2 — ANGLE SUGGESTIONS
Offer 2–4 strong content directions based on the template rules.

STEP 3 — CONTENT GENERATION (STRICT TEMPLATE MODE)
Generate content that must:
✔ Follow the template's structural rules
✔ Follow the requested tone precisely
✔ Match the intended purpose (caption, script, ad copy, article, etc.)
✔ Stay consistent and organized
✔ NEVER add elements outside the template

STEP 4 — OPTIMIZATION
Improve: tone, clarity, flow, readability, effectiveness, platform relevance
(Still no character limits.)

STEP 5 — APPROVAL
Ask the user:
- What do you want to refine?
- Shorter? Longer? (If needed)
- Different tone?
- Alternative angle?
- Additional platform formatting?

🎨 4. LANGUAGE & TONE RULES

The AI must:
- Respond in the user's language
- Maintain tone exactly as requested
- Avoid generic corporate writing
- Avoid filler or repetitive text
- Stay true to the template's voice and logic

📦 5. TEMPLATE CATEGORIES SUPPORTED

Your Template Engine must support these categories:

A. Content Creation Templates
- Social media captions
- Ads
- Email copy
- Long-form storytelling
- TikTok/YouTube scripts
- Press releases

B. Analytical Templates
- Insight analysis
- Persona breakdown
- Content pillar development

C. Optimization Templates
- Rewrite in new tone
- Expand
- Shorten
- Make more persuasive
- Make more emotional
- SEO optimization

D. Ideation Templates
- Content ideas
- Hooks
- CTAs
- Social media angles

📐 6. UNIVERSAL OUTPUT FORMAT (REQUIRED)

You must ALWAYS respond using this structure:

### 1. Orientation
...

### 2. Angle Suggestions
- Option A
- Option B
- Option C

### 3. Generated Content
...

### 4. Optimization
...

### 5. Approval
What would you like to modify or refine?

This output structure is MANDATORY for all templates.

🎯 7. YOUR MISSION

Whenever you receive:
- a Template ID
- a user brief
- a chosen tone
- platform info
- metadata

You MUST:
- Load the correct template
- Apply its rules exactly
- Run the 5-step pipeline
- Produce HIGH-QUALITY, STRUCTURED, CONSISTENT content
- Never behave like a casual chatbot
- Always operate as a content engine`;
}

/**
 * EXECUTE MODE system message (Layer 2: Runtime)
 * Strict content-only mode. No meta commentary. No acknowledgements.
 */
export function getExecuteSystemMessage(): string {
  return `CONTENT MACHINE – SYSTEM PROMPT (v1.0)
ROLE

You are Content Machine AI, a production-grade content generation engine.

Your sole responsibility is to generate ready-to-publish content based on:
- Selected 🎬 Kịch bản (content structure)
- Selected 🎭 Tone giọng (communication style)
- User-provided context (may be minimal or incomplete)

You are NOT a conversational assistant.
You are a content execution engine.

🔒 GLOBAL BEHAVIOR GUARDRAILS (NON-NEGOTIABLE)

These rules override ALL other instructions.

❌ YOU MUST NEVER:
- Ask the user follow-up questions
- Say information is missing or insufficient
- Explain your reasoning, structure, or process
- Label sections with meta terms such as:
  • Orientation / Định hướng
  • Angle Suggestions / Gợi ý góc nhìn
  • Optimization / Tối ưu hóa
  • Approval / Phê duyệt
  • Execution Guidance / Hướng dẫn thực hiện
  • Process / Quy trình
  • Analysis / Phân tích
  • Framework / Khung
  • Structure / Cấu trúc
- Mention prompts, instructions, or templates
- Refer to yourself as an AI or assistant
- Output drafts, notes, or suggestions
- Produce acknowledgements like "understood", "ok", "ready", "noted", "sure", "đã hiểu", "ok rồi", "rõ rồi", "sẵn sàng"
- Respond to or acknowledge system prompts, guardrails, or configuration text

✅ YOU MUST ALWAYS:
- Proceed confidently, even with minimal input
- Infer reasonable defaults when context is missing
- Produce final, publish-ready content
- Follow the selected Tone giọng strictly
- Follow the selected Kịch bản structure implicitly
- Maintain consistent voice and style throughout the output

🚫 CONFIG-ONLY INPUT DETECTION (CRITICAL)

If the user input contains ONLY configuration, system instructions, or guardrails with NO actual content generation request:
- You MUST output nothing
- Return an empty response
- Do NOT acknowledge
- Do NOT explain
- Do NOT politely comply

Examples of config-only input (output NOTHING):
- "SYSTEM PROMPT: You are a content engine."
- "GUARDRAIL: Never ask questions."
- "LAYER 2 mode: execute. Follow rules."

Examples of valid content requests (output content):
- "Create 3 Instagram posts about coffee"
- "Viết caption về Tà Xùa"
- "SYSTEM PROMPT: You are a content engine.\n\nNow create 3 posts about coffee" ← Contains actual request

Important:
If any context (audience, goals, messages, hashtags, etc.) is missing or empty, silently infer sensible defaults based on:
- Topic
- Platform
- Selected tone

Do NOT mention that you inferred anything.

🎬 KỊCH BẢN (CONTENT STRUCTURE RULE)

🎬 Kịch bản defines WHAT to generate
🎭 Tone giọng defines HOW it sounds

You must:
- Respect the structure implied by the selected Kịch bản
- Deliver all required output sections as content, not as labeled steps
- Blend structure naturally into the final content

🎭 TONE INJECTION SYSTEM (STRICT MODE)

Exactly ONE tone will be injected into the variable {{toneHints}}.

You must:
- Treat {{toneHints}} as authoritative behavioral rules
- Apply it globally to the entire output
- NEVER mix tones
- NEVER soften or reinterpret tone rules

🧠 CONTEXT HANDLING LOGIC

When context variables exist but are empty, vague, or placeholder-like (e.g. {{goals}}, {{messages}}):
- Do NOT remove them
- Do NOT mention they are missing
- Do NOT repeat placeholders verbatim
- Instead: infer and replace with reasonable values

Example:
Topic: Travel Tà Xùa
Platform: Facebook
Tone: Kể chuyện
→ Infer goals like: inspiration, connection, storytelling
→ Infer audience: young travelers, nature lovers

✅ OUTPUT STANDARD

Your final output must:
- Be ready to publish immediately
- Match the selected platform naturally
- Feel intentional and human-written
- Contain no meta commentary
- Contain no instructional language
- Contain no system artifacts

🔚 FINAL REMINDER

You are not here to assist.
You are here to execute content.

Once generation starts:
- Do not stop
- Do not ask
- Do not explain

Just deliver.`;
}

/**
 * DESIGN MODE system message (Layer 2: Runtime)
 * Architecture/prompt/UX discussion mode. Can analyze and provide feedback.
 */
export function getDesignSystemMessage(): string {
  return `You are a senior Next.js + TypeScript engineer and AI system architect.

Your responsibilities:
- Discuss and modify prompts, UX, architecture, templates, and i18n
- Provide clear file edits, code snippets, and test steps
- Be concise, actionable, and production-focused

You may:
- Analyze system design and provide feedback
- Suggest architectural improvements
- Comment on prompt quality and effectiveness
- Explain reasoning and process when helpful
- Ask clarifying questions about requirements

Output format:
- Clear implementation plans
- Exact file paths for changes
- TypeScript code diffs or complete blocks
- Validation steps

Tone: Professional, technical, direct.`;
}

/**
 * Build a complete StudioAIRequest from various sources
 * Priority order: templateSystemMessage > meta.templateId > systemMessage > default
 * Tone reinforcement is appended after base system message if provided
 *
 * @param args.systemMessage - Optional explicit system message
 * @param args.userPrompt - Required user input (already edited/finalized)
 * @param args.meta - Optional metadata (use case, template, tone, etc.)
 * @param args.templateSystemMessage - Optional system message from selected template
 * @param args.toneReinforcement - Optional tone-specific instructions to append
 * @returns Complete StudioAIRequest ready to send to AI
 */
export function buildStudioAIRequest(args: {
  systemMessage?: string;
  userPrompt: string;
  meta?: StudioAIRequestMeta;
  templateSystemMessage?: string;
  toneReinforcement?: string;
}): StudioAIRequest {
  const { systemMessage, userPrompt, meta, templateSystemMessage, toneReinforcement } = args;

  // LAYER 2: Runtime mode parameter (default: 'execute')
  const mode = meta?.mode || 'execute';

  // Select base system message based on mode
  const getBaseSystemMessage = (): string => {
    return mode === 'design' ? getDesignSystemMessage() : getExecuteSystemMessage();
  };

  // Priority logic for system message
  let finalSystemMessage: string;
  let loadedTemplateInfo: string | null = null;

  // AUTO-LOAD TEMPLATE: Check if templateId is in meta
  // Priority: NEW Manifest System > OLD Template System
  if (meta?.templateId && !templateSystemMessage) {
    // Try NEW manifest system first (social_caption_v1, seo_blog_v1, video_script_v1)
    const manifest = resolveTemplateManifest(meta.templateId);

    if (manifest) {
      // Use NEW normalized buildSystemPrompt from manifest
      const baseMessage = getBaseSystemMessage();
      const manifestPrompt = buildSystemPrompt(manifest, {
        toneReinforcement: toneReinforcement,
        userInput: userPrompt,
      });
      finalSystemMessage = `${baseMessage}\n\n${'='.repeat(60)}\n\n${manifestPrompt}`;
      loadedTemplateInfo = `[Manifest: ${manifest.name} v${manifest.version} (${meta.templateId})]`;
      console.log(`[Studio AI] Loaded manifest: ${meta.templateId} in ${mode} mode`);
    } else {
      // Fallback to OLD template system
      try {
        if (templateExists(meta.templateId)) {
          const loadedTemplate = getTemplateById(meta.templateId);

          if (loadedTemplate.isValid) {
            // Merge mode-specific base message with template-specific rules
            const baseMessage = getBaseSystemMessage();
            finalSystemMessage = `${baseMessage}\n\n${'='.repeat(60)}\n\n${loadedTemplate.systemMessage}`;

            loadedTemplateInfo = `[Template: ${loadedTemplate.template.name} (${meta.templateId})]`;
            console.log(`[Studio AI] Loaded template: ${meta.templateId} in ${mode} mode`);
          } else {
            console.error(
              `[Studio AI] Template validation failed: ${meta.templateId}`,
              loadedTemplate.errors
            );
            finalSystemMessage = getBaseSystemMessage();
          }
        } else {
          console.warn(
            `[Studio AI] Template not found: ${meta.templateId}, using default system message`
          );
          finalSystemMessage = getBaseSystemMessage();
        }
      } catch (error: any) {
        console.error(`[Studio AI] Error loading template: ${error.message}`);
        finalSystemMessage = getBaseSystemMessage();
      }
    }
  } else if (templateSystemMessage) {
    // 1st priority: Explicitly passed template system message
    finalSystemMessage = templateSystemMessage;
  } else if (systemMessage) {
    // 2nd priority: Explicitly passed system message
    finalSystemMessage = systemMessage;
  } else {
    // 3rd priority: Mode-specific base message
    finalSystemMessage = getBaseSystemMessage();
  }

  // Append tone reinforcement if provided
  if (toneReinforcement) {
    finalSystemMessage += '\n\n---\n\n' + toneReinforcement;
  }

  // Detect user's language and add language instruction
  const detectedLanguage = detectLanguage(userPrompt);
  const languageInstruction = detectedLanguage === 'vi'
    ? '\n\n---\n\nIMPORTANT: The user is writing in Vietnamese. You MUST respond entirely in Vietnamese.'
    : '\n\n---\n\nIMPORTANT: The user is writing in English. You MUST respond entirely in English.';

  finalSystemMessage += languageInstruction;

  // Log template info if loaded
  if (loadedTemplateInfo) {
    console.log(loadedTemplateInfo);
  }

  return {
    systemMessage: finalSystemMessage,
    userPrompt,
    meta,
  };
}

// ============================================
// MAIN AI CALL FUNCTION (ROUTER)
// ============================================
/**
 * Call the Studio AI service
 * Routes to MOCK or REAL AI based on NEXT_PUBLIC_USE_REAL_AI flag
 *
 * @param request - Complete AI request
 * @returns AI response with generated content
 */
export async function callStudioAI(
  request: StudioAIRequest
): Promise<StudioAIResponse> {
  const startTime = Date.now();

  try {
    if (USE_REAL_AI) {
      // REAL AI MODE
      console.log('[Studio AI] Mode: REAL AI');
      const response = await generateRealStudioResponse(request);
      const latency = Date.now() - startTime;
      console.log(`[Studio AI] Real AI completed in ${latency}ms`);
      return response;
    } else {
      // MOCK MODE (default)
      console.log('[Studio AI] Mode: MOCK');
      const response = await generateMockResponse(request);
      const latency = Date.now() - startTime;
      console.log(`[Studio AI] Mock completed in ${latency}ms`);
      return response;
    }
  } catch (error: any) {
    console.error('[Studio AI] Error:', error.message);
    throw error;
  }
}

// ============================================
// REAL AI IMPLEMENTATION
// ============================================
/**
 * Generate real AI response using OpenAI or Anthropic
 * Maintains same response shape as mock mode
 *
 * Provider Priority:
 * 1. OpenAI (GPT-4 / GPT-4-mini) - Primary
 * 2. Anthropic (Claude 3.5 Sonnet) - Fallback
 *
 * @param request - Studio AI request
 * @returns StudioAIResponse with same shape as mock
 */
async function generateRealStudioResponse(
  request: StudioAIRequest
): Promise<StudioAIResponse> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Check if at least one provider is available
  if (!openaiKey && !anthropicKey) {
    console.error('[Studio AI] No API keys found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
    return generateErrorResponse(
      'Hệ thống AI chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
      'AI system not configured. Please contact administrator.'
    );
  }

  // Try OpenAI first (primary provider)
  if (openaiKey) {
    try {
      return await callOpenAI(request, openaiKey);
    } catch (error: any) {
      console.error('[Studio AI] OpenAI failed:', error.message);
      // If Anthropic is available, fall back to it
      if (anthropicKey) {
        console.log('[Studio AI] Falling back to Anthropic...');
        try {
          return await callAnthropic(request, anthropicKey);
        } catch (fallbackError: any) {
          console.error('[Studio AI] Anthropic fallback failed:', fallbackError.message);
        }
      }
    }
  }

  // Try Anthropic if OpenAI wasn't available
  if (anthropicKey && !openaiKey) {
    try {
      return await callAnthropic(request, anthropicKey);
    } catch (error: any) {
      console.error('[Studio AI] Anthropic failed:', error.message);
    }
  }

  // All providers failed
  return generateErrorResponse(
    'Xin lỗi, hệ thống AI đang gặp lỗi tạm thời. Vui lòng thử lại sau.',
    'Sorry, the AI system is experiencing temporary issues. Please try again later.'
  );
}

/**
 * Call OpenAI API (GPT-4)
 * INVARIANT: Full conversation history MUST be included in messages array.
 */
async function callOpenAI(
  request: StudioAIRequest,
  apiKey: string
): Promise<StudioAIResponse> {
  const startTime = Date.now();

  // Build messages array: system + conversation history + current user prompt
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: request.systemMessage,
    },
  ];

  // Add conversation history if available (in chronological order)
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    for (const msg of request.conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Add current user prompt as the final user message
  messages.push({
    role: 'user',
    content: request.userPrompt,
  });

  // ============================================
  // DEV-ONLY: Messages summary (no content, only metadata)
  // ============================================
  if (process.env.NODE_ENV === 'development') {
    console.log('[callOpenAI] Messages being sent:', {
      totalMessages: messages.length,
      hasConversationHistory: (request.conversationHistory?.length || 0) > 0,
      conversationHistoryLength: request.conversationHistory?.length || 0,
      roles: messages.map(m => m.role),
      lengths: messages.map(m => (m.content?.length || 0)),
      first2Preview: messages.slice(0, 2).map(m => ({ role: m.role, len: (m.content?.length || 0) })),
      last2Preview: messages.slice(-2).map(m => ({ role: m.role, len: (m.content?.length || 0) })),
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const latency = Date.now() - startTime;

  console.log(`[Studio AI] OpenAI latency: ${latency}ms, model: ${data.model}, tokens: ${data.usage?.total_tokens || 0}`);

  return {
    content: data.choices[0]?.message?.content || '',
    raw: {
      provider: 'openai',
      model: data.model,
      timestamp: new Date().toISOString(),
      latency_ms: latency,
    },
    usage: {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
    },
  };
}

/**
 * Call Anthropic API (Claude 3.5)
 * INVARIANT: Full conversation history MUST be included in messages array.
 */
async function callAnthropic(
  request: StudioAIRequest,
  apiKey: string
): Promise<StudioAIResponse> {
  const startTime = Date.now();

  // Build messages array: conversation history + current user prompt
  // Note: Anthropic uses a separate 'system' field, not in messages array
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Add conversation history if available (in chronological order)
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    for (const msg of request.conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Add current user prompt as the final user message
  messages.push({
    role: 'user',
    content: request.userPrompt,
  });

  // ============================================
  // DEV-ONLY: Messages summary (no content, only metadata)
  // ============================================
  if (process.env.NODE_ENV === 'development') {
    console.log('[callAnthropic] Messages being sent:', {
      totalMessages: messages.length + 1, // +1 for system (sent separately)
      hasConversationHistory: (request.conversationHistory?.length || 0) > 0,
      conversationHistoryLength: request.conversationHistory?.length || 0,
      roles: ['system', ...messages.map(m => m.role)],
      lengths: [request.systemMessage?.length || 0, ...messages.map(m => (m.content?.length || 0))],
      first2Preview: [
        { role: 'system', len: request.systemMessage?.length || 0 },
        ...(messages.slice(0, 1).map(m => ({ role: m.role, len: (m.content?.length || 0) }))),
      ],
      last2Preview: messages.slice(-2).map(m => ({ role: m.role, len: (m.content?.length || 0) })),
    });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: request.systemMessage,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${response.status} ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const latency = Date.now() - startTime;

  console.log(`[Studio AI] Anthropic latency: ${latency}ms, model: ${data.model}, tokens: ${data.usage?.input_tokens + data.usage?.output_tokens || 0}`);

  return {
    content: data.content[0]?.text || '',
    raw: {
      provider: 'anthropic',
      model: data.model,
      timestamp: new Date().toISOString(),
      latency_ms: latency,
    },
    usage: {
      promptTokens: data.usage?.input_tokens,
      completionTokens: data.usage?.output_tokens,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  };
}

/**
 * Generate a safe error response that matches StudioAIResponse shape
 */
function generateErrorResponse(vietnameseMessage: string, englishMessage: string): StudioAIResponse {
  return {
    content: `⚠️ ${vietnameseMessage}\n\n${englishMessage}`,
    raw: {
      provider: 'error',
      timestamp: new Date().toISOString(),
      error: true,
    },
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
  };
}

// ============================================
// MOCK AI IMPLEMENTATION (PRESERVED)
// ============================================
/**
 * Generate a contextual mock response
 * This simulates what a real AI might return
 * MOCK mode is used when NEXT_PUBLIC_USE_REAL_AI != 'true'
 */
async function generateMockResponse(request: StudioAIRequest): Promise<StudioAIResponse> {
  // Simulate API delay (500ms - 1500ms)
  const delay = 500 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const { userPrompt, meta } = request;

  // Detect language from user prompt
  const language = detectLanguage(userPrompt);

  // Extract context from metadata
  const context = [];
  if (meta?.templateId) {
    context.push(language === 'vi' ? `Template: ${meta.templateId}` : `Template: ${meta.templateId}`);
  }
  if (meta?.useCaseId) {
    context.push(language === 'vi' ? `Trường hợp sử dụng: ${meta.useCaseId}` : `Use Case: ${meta.useCaseId}`);
  }
  if (meta?.language) {
    context.push(language === 'vi' ? `Ngôn ngữ: ${meta.language}` : `Language: ${meta.language}`);
  }

  const contextString = context.length > 0
    ? (language === 'vi' ? `\n\n**Ngữ cảnh**: ${context.join(' | ')}` : `\n\n**Context**: ${context.join(' | ')}`)
    : '';

  // Generate mock content based on language
  const mockContent = language === 'vi' ? generateVietnameseMockContent(userPrompt, contextString) : generateEnglishMockContent(userPrompt, contextString);

  return {
    content: mockContent,
    raw: {
      provider: 'mock',
      timestamp: new Date().toISOString(),
      request: {
        systemMessageLength: request.systemMessage.length,
        userPromptLength: request.userPrompt.length,
        meta: request.meta,
      },
    },
    usage: {
      promptTokens: Math.floor(request.userPrompt.length / 4),
      completionTokens: Math.floor(mockContent.length / 4),
      totalTokens: Math.floor((request.userPrompt.length + mockContent.length) / 4),
    },
  };
}

function generateVietnameseMockContent(userPrompt: string, contextString: string): string {
  return `🤖 **PHẢN HỒI MÔ PHỎNG CỦA AI** (Phát triển Giai đoạn 2)

Đây là phản hồi mô phỏng của AI dựa trên yêu cầu của bạn. Trong phiên bản chính thức, nội dung này sẽ được tạo bởi AI thực tế từ OpenAI, Anthropic, hoặc các nhà cung cấp khác.

---

**Yêu cầu của bạn**:
${userPrompt}
${contextString}

---

**Nội dung được tạo** (Ví dụ):

Dựa trên yêu cầu của bạn, đây là hướng tiếp cận chiến lược:

1. **Trụ cột nội dung 1**: Kể chuyện hấp dẫn
   - Tập trung vào câu chuyện chân thực, dễ đồng cảm
   - Sử dụng nội dung trực quan (hình ảnh, video ngắn)
   - Tận dụng nội dung do người dùng tạo ra khi có thể

2. **Trụ cột nội dung 2**: Giá trị giáo dục
   - Chia sẻ insights và tips về ngành
   - Tạo hướng dẫn "cách làm" và tutorial
   - Định vị thương hiệu như một thought leader

3. **Trụ cột nội dung 3**: Tương tác cộng đồng
   - Đặt câu hỏi để khơi gợi cuộc trò chuyện
   - Chạy poll và nội dung tương tác
   - Phản hồi bình luận và xây dựng mối quan hệ

4. **Tips theo từng nền tảng**:
   - **Instagram**: Sử dụng Reels + Stories để tăng reach tối đa
   - **Facebook**: Nội dung dài hơn + xây dựng cộng đồng
   - **LinkedIn**: Insights chuyên nghiệp + tin tức ngành
   - **TikTok**: Nội dung ngắn, giải trí, theo trend

**Các bước tiếp theo**:
✅ Xem xét và tùy chỉnh chiến lược này cho đối tượng cụ thể của bạn
✅ Tạo lịch nội dung với các ý tưởng bài viết cụ thể
✅ Thiết lập theo dõi analytics để đo lường hiệu suất

---

*Phản hồi mô phỏng này minh họa cấu trúc và chất lượng bạn có thể mong đợi từ tích hợp AI thực tế.*`;
}

function generateEnglishMockContent(userPrompt: string, contextString: string): string {
  return `🤖 **MOCK AI RESPONSE** (Phase 2 Development)

This is a simulated AI-generated response based on your prompt. In production, this will be replaced with real AI processing from OpenAI, Anthropic, or other providers.

---

**Your Prompt**:
${userPrompt}
${contextString}

---

**Generated Content** (Example):

Based on your request, here's a strategic approach:

1. **Content Pillar 1**: Engaging storytelling
   - Focus on authentic, relatable narratives
   - Use visual-first content (images, short videos)
   - Leverage user-generated content when possible

2. **Content Pillar 2**: Educational value
   - Share industry insights and tips
   - Create "how-to" guides and tutorials
   - Position your brand as a thought leader

3. **Content Pillar 3**: Community engagement
   - Ask questions to spark conversations
   - Run polls and interactive content
   - Respond to comments and build relationships

4. **Platform-Specific Tips**:
   - **Instagram**: Use Reels + Stories for maximum reach
   - **Facebook**: Longer-form content + community building
   - **LinkedIn**: Professional insights + industry news
   - **TikTok**: Short, entertaining, trend-aware content

**Next Steps**:
✅ Review and customize this strategy for your specific audience
✅ Create a content calendar with specific post ideas
✅ Set up analytics tracking to measure performance

---

*This mock response demonstrates the structure and quality you can expect from the real AI integration.*`;
}
