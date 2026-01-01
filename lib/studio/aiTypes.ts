// ============================================
// AI Service Types for Studio
// ============================================

/**
 * Supported AI providers
 * 'mock' is used for development/testing
 * 'openai' and 'anthropic' will be implemented in future iterations
 */
export type StudioAIProvider = 'openai' | 'anthropic' | 'mock';

/**
 * AI execution mode (Layer 2 runtime parameter)
 * - execute: Content generation only. No meta commentary. Strict output-only mode.
 * - design: Architecture/prompt/UX discussion mode. Can analyze and provide feedback.
 */
export type AIMode = 'execute' | 'design';

/**
 * Metadata about the context of an AI request
 * Used for tracking, analytics, and future tone/platform customization
 */
export interface StudioAIRequestMeta {
  useCaseId?: string; // ID from useCaseTemplates.ts
  templateId?: string; // ID from promptTemplates.ts
  toneId?: string; // Future: tone engine integration
  platform?: string; // Future: platform-specific optimization
  language?: 'vi' | 'en' | 'vi-en'; // Target language for generation
  workflowStep?: string; // Current workflow step in the content pipeline
  mode?: AIMode; // Execution mode (default: 'execute')
}

/**
 * Message format for conversation history
 * Used to send full chat history to the LLM
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Complete AI request payload
 * This is what we send to the AI service
 */
export interface StudioAIRequest {
  systemMessage: string; // System role/instructions for the AI
  userPrompt: string; // The actual user input (with placeholders replaced)
  meta?: StudioAIRequestMeta; // Optional metadata
  conversationHistory?: ConversationMessage[]; // Previous messages for context
}

/**
 * Streaming chunk response
 * For future implementation of real-time streaming
 */
export interface StudioAIChunk {
  id: string;
  content: string;
  isFinal: boolean;
}

/**
 * Complete AI response
 * This is what the AI service returns
 */
export interface StudioAIResponse {
  content: string; // Generated content from AI
  raw?: unknown; // Raw response from provider (for debugging)
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}
