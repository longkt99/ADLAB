// ============================================
// Studio AI API Route
// ============================================
// Single entrypoint for AI Content Studio requests
//
// FUTURE ENHANCEMENTS:
// - Add authentication/authorization checks
// - Implement rate limiting per user/session
// - Add streaming support (Server-Sent Events)
// - Track usage metrics and costs
// - Support batch processing for multiple prompts

import { NextRequest, NextResponse } from 'next/server';
import type { StudioAIRequest, StudioAIResponse } from '@/lib/studio/aiTypes';
import { callStudioAI } from '@/lib/studio/aiClient';

/**
 * Detect if user prompt is config-only (no actual content request)
 * Returns true if the prompt contains ONLY system instructions/config/prompts
 */
function isConfigOnlyInput(userPrompt: string): boolean {
  const prompt = userPrompt.toLowerCase().trim();

  // Config-only indicators
  const configKeywords = [
    'system prompt',
    'guardrail',
    'instruction',
    'rule:',
    'you must',
    'you are',
    'layer 0',
    'layer 1',
    'layer 2',
    'mode:',
    'content machine',
    'absolute role lock',
    'production mode',
  ];

  // Check if prompt is mostly config keywords
  const containsConfigKeywords = configKeywords.some(keyword => prompt.includes(keyword));

  // Check if prompt lacks content indicators
  const contentIndicators = [
    'create',
    'write',
    'generate',
    'make',
    'tạo',
    'viết',
    'topic:',
    'chủ đề:',
    'platform:',
    'nền tảng:',
  ];

  const hasContentRequest = contentIndicators.some(indicator => prompt.includes(indicator));

  // Config-only if it has config keywords but no content request
  return containsConfigKeywords && !hasContentRequest;
}

/**
 * Detect forbidden meta headings in EXECUTE mode output
 * Returns true if output contains meta-structure labels that violate role lock
 * Only detects headings/labels, NOT narrative usage of these words
 */
function detectMetaHeadings(content: string): boolean {
  const lines = content.split('\n');

  // Forbidden meta terms
  const enTerms = 'orientation|angle suggestions?|optimization|approval|execution guidance|process|analysis|framework|structure';
  const viTerms = 'định hướng|gợi ý góc nhìn|gợi ý|tối ưu hóa|phê duyệt|hướng dẫn thực hiện|quy trình|phân tích|khung|cấu trúc';
  const allTerms = `${enTerms}|${viTerms}`;

  for (const line of lines) {
    const trimmed = line.trim();

    // Pattern 1: Markdown headings (## Heading, ### Heading:, etc.)
    const markdownHeading = new RegExp(`^#{2,6}\\s+(${allTerms})\\s*:?\\s*$`, 'i');
    if (markdownHeading.test(trimmed)) {
      return true;
    }

    // Pattern 2: Bold-only lines (** Heading ** or **Heading**)
    const boldHeading = new RegExp(`^\\*\\*\\s*(${allTerms})\\s*\\*\\*\\s*$`, 'i');
    if (boldHeading.test(trimmed)) {
      return true;
    }

    // Pattern 3: Label with colon (Heading: or Heading: content)
    const colonLabel = new RegExp(`^(${allTerms})\\s*:\\s*`, 'i');
    if (colonLabel.test(trimmed)) {
      return true;
    }

    // Pattern 4: Step labels (Step 1:, Bước 1:)
    const stepLabel = /^(step|bước)\s*\d+\s*:/i;
    if (stepLabel.test(trimmed)) {
      return true;
    }

    // Pattern 5a: Numbered heading standing alone (optional colon)
    const numberedMetaStandalone = new RegExp(`^\\d+\\.\\s+(${allTerms})\\s*:?\\s*$`, 'i');
    if (numberedMetaStandalone.test(trimmed)) {
      return true;
    }

    // Pattern 5b: Numbered label with colon (colon + content)
    const numberedMetaColon = new RegExp(`^\\d+\\.\\s+(${allTerms})\\s*:\\s+`, 'i');
    if (numberedMetaColon.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter acknowledgement phrases from EXECUTE mode responses
 * Handles both pure acknowledgement responses and mixed content
 * Returns empty string if response is ONLY acknowledgements
 * Strips acknowledgement prefix if followed by actual content
 */
function filterAcknowledgements(content: string): string {
  const trimmed = content.trim();

  // Patterns for pure acknowledgement responses (entire response is just acknowledgement)
  const pureAcknowledgementPatterns = [
    // English
    /^(understood|ok|okay|ready|noted|acknowledged|sure|got it|will do|proceeding)\.?\s*$/i,
    /^ready for tasks\.?\s*$/i,
    /^understood\.?\s+ready for tasks\.?\s*$/i,
    /^i understand\.?\s*$/i,
    /^noted\.?\s*$/i,
    /^ok\.?\s*$/i,
    /^okay\.?\s*$/i,
    // Vietnamese
    /^(đã hiểu|ok rồi|ok|rõ rồi|sẵn sàng|đã nắm|hiểu rồi)\.?\s*$/i,
    /^đã hiểu\.?\s+sẵn sàng\.?\s*$/i,
    /^tôi hiểu rồi\.?\s*$/i,
  ];

  // Check if entire response is just acknowledgement
  for (const pattern of pureAcknowledgementPatterns) {
    if (pattern.test(trimmed)) {
      return '';
    }
  }

  // Patterns for acknowledgement prefixes (to strip from mixed content)
  const acknowledgementPrefixPatterns = [
    // English
    /^(understood|ok|okay|ready|noted|acknowledged|sure|got it)\.?\s+/i,
    /^ready for tasks\.?\s+/i,
    /^understood\.?\s+ready for tasks\.?\s+/i,
    /^i understand\.?\s+/i,
    // Vietnamese
    /^(đã hiểu|ok rồi|ok|rõ rồi|sẵn sàng|đã nắm|hiểu rồi)\.?\s+/i,
    /^đã hiểu\.?\s+sẵn sàng\.?\s+/i,
    /^tôi hiểu rồi\.?\s+/i,
  ];

  // Strip acknowledgement prefix if present
  let result = trimmed;
  for (const pattern of acknowledgementPrefixPatterns) {
    result = result.replace(pattern, '');
  }

  // If after stripping prefix we have content, return it
  // If result is empty or just whitespace, return empty string
  return result.trim();
}

/**
 * POST /api/studio/ai
 * Process AI content generation requests from Studio
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: StudioAIRequest = await request.json();

    // Validate required fields
    if (!body.userPrompt || typeof body.userPrompt !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid userPrompt field',
        },
        { status: 400 }
      );
    }

    // Trim and validate non-empty prompt
    if (!body.userPrompt.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'userPrompt cannot be empty',
        },
        { status: 400 }
      );
    }

    // Validate systemMessage if provided
    if (body.systemMessage && typeof body.systemMessage !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid systemMessage field',
        },
        { status: 400 }
      );
    }

    // Call AI service
    const aiResponse: StudioAIResponse = await callStudioAI(body);

    // EXECUTE MODE: Silence policy enforcement
    const mode = body.meta?.mode || 'execute';
    if (mode === 'execute') {
      // Policy 1: Config-only input → empty output
      if (isConfigOnlyInput(body.userPrompt)) {
        return NextResponse.json(
          {
            success: true,
            data: {
              content: '',
              usage: aiResponse.usage,
            },
          },
          { status: 200 }
        );
      }

      // Policy 2: Filter acknowledgement-only responses
      const filteredContent = filterAcknowledgements(aiResponse.content);
      aiResponse.content = filteredContent;

      // Policy 3: Meta heading detection (ABSOLUTE ROLE LOCK)
      // If output contains forbidden meta structure, hard-fail to empty
      if (aiResponse.content && detectMetaHeadings(aiResponse.content)) {
        console.warn('[ROLE LOCK VIOLATION] Meta headings detected in EXECUTE mode output. Blocking content.');
        return NextResponse.json(
          {
            success: true,
            data: {
              content: '',
              usage: aiResponse.usage,
            },
          },
          { status: 200 }
        );
      }
    }

    // Return successful response
    return NextResponse.json(
      {
        success: true,
        data: aiResponse,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Studio AI API Error:', error);

    // Return error response
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/studio/ai
 * CORS preflight handler (if needed for external clients)
 */
export async function OPTIONS(_request: NextRequest) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
