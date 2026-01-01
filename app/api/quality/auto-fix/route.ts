// ============================================
// Auto-Fix API Route for Quality Lock
// ============================================
// Refines AI-generated content based on Quality Lock feedback
// Uses the same LLM pipeline as Studio generation
// Includes similarity guardrails, prompt guardrails, and retry logic

import { NextRequest, NextResponse } from 'next/server';
import { callStudioAI } from '@/lib/studio/aiClient';
import { buildAutoFixPrompt, type AutoFixPromptOutput } from '@/lib/quality/autoFixPrompt';
import { checkSimilarity, type SimilarityResult } from '@/lib/quality/similarityCheck';
import { checkGuardrails, type GuardrailCheckResult } from '@/lib/quality/autoFixGuardrails';
import type { IntentId, RuleResult, QualityContext } from '@/lib/quality/intentQualityRules';
import { trackAutoFixAPI, trackAutoFixAttemptStartedServer } from '@/lib/analytics/serverTrack';

// ============================================
// CONSTANTS (LOCKED - Do not change without approval)
// ============================================

/** Maximum number of fix attempts */
const MAX_ATTEMPTS = 2;

/** Minimum similarity score to accept fix (0.7 = 70%) */
const MIN_SIMILARITY = 0.7;

/** Stricter similarity for retry attempts (0.75 = 75%) */
const RETRY_MIN_SIMILARITY = 0.75;

/** Minimum similarity to use degraded result (0.6 = 60%) - raised from 0.5 for better voice preservation */
const DEGRADED_MIN_SIMILARITY = 0.6;

/**
 * Strip code fences from LLM output if present
 * Handles ```markdown, ```text, ``` or plain text
 */
function stripCodeFences(text: string): string {
  let result = text.trim();

  // Remove opening fence with optional language
  result = result.replace(/^```(?:markdown|text|md)?\s*\n?/i, '');

  // Remove closing fence
  result = result.replace(/\n?```\s*$/i, '');

  return result.trim();
}

/**
 * Auto-fix request body
 */
interface AutoFixRequest {
  intent: IntentId;
  output: string;
  softFails?: RuleResult[];
  hardFails?: RuleResult[];
  meta?: Omit<QualityContext, 'intent' | 'output'>;
}

/**
 * Auto-fix response
 */
interface AutoFixResponse {
  refinedOutput: string;
  similarity: SimilarityResult;
  attempts: number;
  usedFallback: boolean;
  /** Guardrail check result (for debugging, not exposed to UI) */
  guardrails?: GuardrailCheckResult;
}

/**
 * POST /api/quality/auto-fix
 *
 * Request body:
 * {
 *   intent: IntentId,                               // The intent/template name
 *   output: string,                                 // The content to fix
 *   softFails?: RuleResult[],                       // Array of soft-failed rules from Quality Lock
 *   hardFails?: RuleResult[],                       // Array of hard-failed rules from Quality Lock
 *   meta?: Omit<QualityContext, 'intent' | 'output'> // Optional metadata (templateId, language)
 * }
 *
 * Response:
 * {
 *   refinedOutput: string,     // The fixed content
 *   similarity: SimilarityResult, // Similarity check result
 *   attempts: number,          // Number of attempts made
 *   usedFallback: boolean      // Whether fallback to original was used
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AutoFixRequest;

    const { intent, output, softFails = [], hardFails = [], meta } = body;

    // Validate required fields
    if (!intent || typeof intent !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid intent' },
        { status: 400 }
      );
    }

    if (!output || typeof output !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid output' },
        { status: 400 }
      );
    }

    // Validate at least one fail exists
    const allFails = [...(hardFails || []), ...(softFails || [])].filter(r => !r.passed);
    if (allFails.length === 0) {
      return NextResponse.json(
        { error: 'No fails to fix - softFails and hardFails are both empty' },
        { status: 400 }
      );
    }

    const requestStartTime = Date.now();
    const hardFailCount = hardFails.filter(r => !r.passed).length;
    const softFailCount = softFails.filter(r => !r.passed).length;

    console.log('[Auto-Fix] Intent:', intent);
    console.log('[Auto-Fix] Template:', meta?.templateId || 'none');
    console.log('[Auto-Fix] HardFails count:', hardFailCount);
    console.log('[Auto-Fix] SoftFails count:', softFailCount);

    // Track attempts
    let attempt = 1;
    let bestResult: { output: string; similarity: SimilarityResult; guardrails?: GuardrailCheckResult } | null = null;

    while (attempt <= MAX_ATTEMPTS) {
      const isRetry = attempt > 1;
      const minSimilarity = isRetry ? RETRY_MIN_SIMILARITY : MIN_SIMILARITY;

      console.log(`[Auto-Fix] Attempt ${attempt}/${MAX_ATTEMPTS} (strict: ${isRetry})`);

      // ✅ Track attempt started
      trackAutoFixAttemptStartedServer({
        intent,
        templateId: meta?.templateId,
        attempt_number: attempt,
      });

      // Build prompt with system/user separation
      const prompts: AutoFixPromptOutput = buildAutoFixPrompt(
        {
          intent,
          output,
          softFails,
          hardFails,
          meta,
        },
        {
          strict: isRetry,
          attempt,
        }
      );

      console.log('[Auto-Fix] System prompt length:', prompts.system.length);
      console.log('[Auto-Fix] User prompt length:', prompts.user.length);

      // Call LLM with proper system/user separation
      const response = await callStudioAI({
        systemMessage: prompts.system,
        userPrompt: prompts.user,
        meta: {
          mode: 'execute',
        },
      });

      if (!response.content) {
        console.error(`[Auto-Fix] Attempt ${attempt}: Empty response from LLM`);
        attempt++;
        continue;
      }

      // Strip code fences if present
      const refinedOutput = stripCodeFences(response.content);

      console.log('[Auto-Fix] LLM response length:', refinedOutput.length);

      // Check similarity
      const similarity = checkSimilarity(output, refinedOutput, { minSimilarity });

      console.log(`[Auto-Fix] Attempt ${attempt} similarity: ${(similarity.score * 100).toFixed(1)}% (${similarity.assessment})`);
      console.log(`[Auto-Fix] Details: char=${(similarity.details.charSimilarity * 100).toFixed(1)}%, token=${(similarity.details.tokenOverlap * 100).toFixed(1)}%, length=${(similarity.details.lengthRatio * 100).toFixed(1)}%`);

      // Run guardrail checks
      const guardrails = checkGuardrails(output, refinedOutput, allFails, similarity.score);

      if (guardrails.violations.length > 0) {
        console.log(`[Auto-Fix] Guardrail violations:`, guardrails.violations.map(v => v.type));
      }

      // Track best result (highest similarity that still makes changes AND passes guardrails)
      const passesGuardrails = guardrails.recommendation !== 'fallback';
      if (passesGuardrails && (!bestResult || similarity.score > bestResult.similarity.score)) {
        bestResult = { output: refinedOutput, similarity, guardrails };
      }

      // If similarity passes AND guardrails pass, accept this result
      if (similarity.passed && guardrails.passed) {
        console.log(`[Auto-Fix] Attempt ${attempt} passed similarity and guardrail checks`);

        // ✅ Track successful API call
        trackAutoFixAPI({
          intent,
          templateId: meta?.templateId,
          hardFailCount,
          softFailCount,
          attempt,
          similarityScore: similarity.score,
          usedFallback: false,
          success: true,
          durationMs: Date.now() - requestStartTime,
        });

        return NextResponse.json(
          {
            refinedOutput,
            similarity,
            attempts: attempt,
            usedFallback: false,
            guardrails,
          } as AutoFixResponse,
          { status: 200 }
        );
      }

      // Determine next action based on guardrail recommendation
      if (guardrails.recommendation === 'fallback') {
        console.log(`[Auto-Fix] Attempt ${attempt} blocked by guardrails, falling back`);
        break; // Exit loop, use fallback
      }

      console.log(`[Auto-Fix] Attempt ${attempt} failed (similarity: ${similarity.assessment}, guardrails: ${guardrails.recommendation}), ${isRetry ? 'falling back' : 'retrying with stricter prompt'}`);
      attempt++;
    }

    // All attempts exhausted - use best result or fall back to original
    if (bestResult && bestResult.similarity.score >= DEGRADED_MIN_SIMILARITY) {
      // Best result has at least 60% similarity - use it but mark as degraded
      // usedFallback = true signals to UI that this is below primary threshold
      const isDegraded = bestResult.similarity.score < MIN_SIMILARITY;
      console.log(`[Auto-Fix] Using ${isDegraded ? 'degraded' : 'best'} result with ${(bestResult.similarity.score * 100).toFixed(1)}% similarity`);

      // ✅ Track degraded/best result API call
      trackAutoFixAPI({
        intent,
        templateId: meta?.templateId,
        hardFailCount,
        softFailCount,
        attempt: MAX_ATTEMPTS,
        similarityScore: bestResult.similarity.score,
        usedFallback: isDegraded,
        success: true,
        durationMs: Date.now() - requestStartTime,
      });

      return NextResponse.json(
        {
          refinedOutput: bestResult.output,
          similarity: bestResult.similarity,
          attempts: MAX_ATTEMPTS,
          usedFallback: isDegraded, // Honest reporting: below primary threshold = degraded
          guardrails: bestResult.guardrails,
        } as AutoFixResponse,
        { status: 200 }
      );
    }

    // Fall back to original content
    console.log('[Auto-Fix] Falling back to original content');
    const fallbackSimilarity = checkSimilarity(output, output);

    // ✅ Track fallback API call
    trackAutoFixAPI({
      intent,
      templateId: meta?.templateId,
      hardFailCount,
      softFailCount,
      attempt: MAX_ATTEMPTS,
      similarityScore: 1.0, // Fallback = identical to original
      usedFallback: true,
      success: false,
      durationMs: Date.now() - requestStartTime,
    });

    return NextResponse.json(
      {
        refinedOutput: output,
        similarity: fallbackSimilarity,
        attempts: MAX_ATTEMPTS,
        usedFallback: true,
      } as AutoFixResponse,
      { status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Auto-fix failed';
    console.error('[Auto-Fix] Error:', errorMessage);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
