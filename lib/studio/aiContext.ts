// ============================================
// AI Context Builder - Scaffolding for AI Behavior Coordination
// ============================================
// This module prepares context payload for AI requests based on:
// - Active 🎬 KỊCH BẢN (Script) selection
// - Recent 🧩 PROMPT KIT actions (if any)
// - Tone, use case, and conversation state
//
// IMPORTANT: This is scaffolding only. Integration into API routes
// should happen when the AI system is ready to consume this context.
//
// ============================================

import { getTemplateById } from './templateLoader';
import type { ContentTemplate } from './templates/templateSchema';
import type { BrandTone } from './tones';
import type { ChatMessage } from '@/types/studio';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * AI Context Payload
 *
 * Represents the complete context needed for AI to generate
 * content that respects both Kịch bản constraints and Prompt Kit actions
 */
export interface AIContextPayload {
  // Strategic context (Kịch bản layer)
  active_script: {
    id: string;
    name: string;
    mode: 'A' | 'B' | 'C' | null;
    category: string;
    constraints: string[];
    system_prompt?: string;
    user_prompt_template?: string;
  } | null;

  // Tactical context (Prompt Kit layer)
  prompt_kit_action: {
    id: string;
    content: string;
    category: string;
    is_additive: boolean;
    applied_at: number; // timestamp
  } | null;

  // Session context
  tone_id: string | null;
  use_case_id: string | null;
  conversation_history: ChatMessage[];

  // Behavior flags
  should_preserve_structure: boolean;
  should_apply_script_flow: boolean;
  should_use_local_transformation: boolean;
}

/**
 * Prompt Kit Action Log Entry
 *
 * Tracks a single Prompt Kit action for context awareness
 */
export interface PromptKitActionLogEntry {
  prompt_id: string;
  category: string;
  content: string;
  is_additive: boolean;
  applied_at: number;
  input_snapshot?: string;
  output_snapshot?: string;
}

// ============================================
// CONTEXT BUILDER FUNCTION
// ============================================

/**
 * Build AI Context Payload
 *
 * Constructs the complete context payload that AI should use to:
 * 1. Apply Kịch bản constraints (if active)
 * 2. Respect Prompt Kit micro-transformations (if triggered)
 * 3. Maintain tone and use case preferences
 *
 * @param params - Context builder parameters
 * @returns AIContextPayload ready for AI consumption
 *
 * @example
 * ```typescript
 * const context = buildAIContext({
 *   scriptId: 'social_caption',
 *   promptKitAction: null,
 *   toneId: 'conversational',
 *   useCaseId: 'social_caption_optimize',
 *   conversationHistory: messages
 * });
 *
 * // Send context to AI API
 * const aiResponse = await fetch('/api/studio/ai', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     userPrompt: input,
 *     context: context
 *   })
 * });
 * ```
 */
export function buildAIContext(params: {
  scriptId: string | null;
  promptKitAction: PromptKitActionLogEntry | null;
  toneId: string | null;
  useCaseId: string | null;
  conversationHistory: ChatMessage[];
}): AIContextPayload {
  const {
    scriptId,
    promptKitAction,
    toneId,
    useCaseId,
    conversationHistory,
  } = params;

  // Layer 1: Load active Kịch bản (if selected)
  let activeScript: AIContextPayload['active_script'] = null;

  if (scriptId) {
    try {
      const loaded = getTemplateById(scriptId);
      if (loaded.isValid && loaded.template) {
        const template: ContentTemplate = loaded.template;

        // Map ExecutionMode to ABC notation
        const executionModeToABC = (mode: 'abstract' | 'structured' | 'generic'): 'A' | 'B' | 'C' => {
          if (mode === 'abstract') return 'A';
          if (mode === 'structured') return 'B';
          return 'C'; // generic
        };

        activeScript = {
          id: template.id,
          name: template.name,
          mode: template.ui?.defaultMode ? executionModeToABC(template.ui.defaultMode) : null,
          category: template.category,
          constraints: [], // TODO: Extract from template.rules if needed
          system_prompt: loaded.systemMessage, // Use compiled system message
          user_prompt_template: undefined, // Not currently part of template schema
        };
      }
    } catch (error) {
      console.warn('[AI Context] Failed to load Kịch bản:', scriptId, error);
    }
  }

  // Layer 2: Include Prompt Kit action (if triggered)
  const promptKitContext: AIContextPayload['prompt_kit_action'] = promptKitAction
    ? {
        id: promptKitAction.prompt_id,
        content: promptKitAction.content,
        category: promptKitAction.category,
        is_additive: promptKitAction.is_additive,
        applied_at: promptKitAction.applied_at,
      }
    : null;

  // Layer 3: Determine behavior flags
  const should_preserve_structure = !!promptKitContext; // Preserve if Prompt Kit is active
  const should_apply_script_flow = !!activeScript; // Apply if Kịch bản is active
  const should_use_local_transformation = !!promptKitContext && !promptKitContext.is_additive;

  // Construct final payload
  return {
    active_script: activeScript,
    prompt_kit_action: promptKitContext,
    tone_id: toneId,
    use_case_id: useCaseId,
    conversation_history: conversationHistory,
    should_preserve_structure,
    should_apply_script_flow,
    should_use_local_transformation,
  };
}

// ============================================
// HELPER: GENERATE AI SYSTEM PROMPT
// ============================================

/**
 * Generate AI System Prompt with Context
 *
 * Constructs a system prompt that combines:
 * - Base Content Machine instructions
 * - Active Kịch bản constraints (if any)
 * - Prompt Kit transformation rules (if triggered)
 *
 * This ensures AI behavior adapts based on context.
 *
 * @param context - AI context payload
 * @returns Complete system prompt string
 *
 * @example
 * ```typescript
 * const context = buildAIContext({...});
 * const systemPrompt = generateSystemPromptWithContext(context);
 *
 * // Use in AI API call
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [
 *     { role: 'system', content: systemPrompt },
 *     { role: 'user', content: userInput }
 *   ]
 * });
 * ```
 */
export function generateSystemPromptWithContext(
  context: AIContextPayload,
  basePrompt: string = 'You are an AI content generation assistant for Content Machine.'
): string {
  let systemPrompt = basePrompt;

  // Layer 1: Apply Kịch bản constraints
  if (context.active_script) {
    systemPrompt += `\n\n🎬 ACTIVE KỊCH BẢN: ${context.active_script.name}`;
    systemPrompt += `\nMODE: ${context.active_script.mode || 'Default'}`;
    systemPrompt += `\nCATEGORY: ${context.active_script.category}`;

    if (context.active_script.constraints.length > 0) {
      systemPrompt += `\nCONSTRAINTS: ${context.active_script.constraints.join(', ')}`;
    }

    if (context.active_script.system_prompt) {
      systemPrompt += `\n\n${context.active_script.system_prompt}`;
    }
  }

  // Layer 2: Apply Prompt Kit transformation rules
  if (context.prompt_kit_action) {
    systemPrompt += `\n\n🧩 TACTICAL ACTION TRIGGERED: ${context.prompt_kit_action.category}`;
    systemPrompt += `\nPROMPT: ${context.prompt_kit_action.content}`;
    systemPrompt += `\n\nIMPORTANT: This is a micro-transformation. `;

    if (context.should_preserve_structure) {
      systemPrompt += `Preserve the overall strategy and structure defined by the active Kịch bản. `;
    }

    systemPrompt += `Do NOT regenerate entire content. Apply change locally.`;
  }

  return systemPrompt;
}

// ============================================
// EXAMPLE USAGE (Documentation)
// ============================================

/**
 * Example: Integrating AI Context into API Route
 *
 * ```typescript
 * // In app/api/studio/ai/route.ts
 *
 * import { buildAIContext, generateSystemPromptWithContext } from '@/lib/studio/aiContext';
 *
 * export async function POST(request: Request) {
 *   const { userPrompt, meta, promptKitAction } = await request.json();
 *
 *   // Build context
 *   const context = buildAIContext({
 *     scriptId: meta.templateId,
 *     promptKitAction: promptKitAction || null,
 *     toneId: meta.toneId,
 *     useCaseId: meta.useCaseId,
 *     conversationHistory: []
 *   });
 *
 *   // Generate system prompt with context
 *   const systemPrompt = generateSystemPromptWithContext(context);
 *
 *   // Call OpenAI with context-aware prompt
 *   const response = await openai.chat.completions.create({
 *     model: 'gpt-4',
 *     messages: [
 *       { role: 'system', content: systemPrompt },
 *       { role: 'user', content: userPrompt }
 *     ]
 *   });
 *
 *   return Response.json({ success: true, data: response });
 * }
 * ```
 */
