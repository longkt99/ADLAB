// ============================================
// Source Resolver
// ============================================
// Resolves which message should be used as source
// for transform actions. Priority order:
// 1. Explicit UI source_message_id
// 2. Quoted text in input
// 3. Implicit reference → last assistant output
// 4. Multiple recent outputs → ambiguous (show picker)
// ============================================

import type {
  SourceResolution,
  OutputReference,
} from '@/types/orchestrator';
import type { ChatMessage } from '@/types/studio';
import { hasImplicitReference } from './actionClassifier';
import { isRefusal } from './transformOrchestrator';

// ============================================
// Valid Source Filtering
// ============================================

/**
 * Minimum content length for valid source
 */
const MIN_VALID_SOURCE_LENGTH = 30;

/**
 * Check if a message is a valid source for transforms
 * Excludes: refusals, empty, too short, system messages
 * @param message - Chat message to check
 * @returns True if message is valid for use as source
 */
export function isValidSource(message: ChatMessage): boolean {
  if (message.role !== 'assistant') return false;

  const content = message.content?.trim() || '';

  // Empty or too short
  if (content.length < MIN_VALID_SOURCE_LENGTH) {
    return false;
  }

  // Refusal messages
  if (isRefusal(content)) {
    return false;
  }

  // Fallback warning messages (check for known system patterns)
  if (message.meta?.isFallback && content.length < 50) {
    return false;
  }

  return true;
}

/**
 * Filter messages to only valid sources
 * @param messages - All messages
 * @returns Only assistant messages valid for transform source
 */
function filterValidSources(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(isValidSource);
}

// ============================================
// Quote Detection
// ============================================

/**
 * Patterns for detecting quoted text in input
 */
const QUOTE_PATTERNS: RegExp[] = [
  /"([^"]+)"/g,         // Double quotes
  /'([^']+)'/g,         // Single quotes
  /「([^」]+)」/g,       // CJK quotes
  /『([^』]+)』/g,       // CJK double quotes
  /«([^»]+)»/g,         // Guillemets
];

/**
 * Extract quoted text from input
 * @param input - User input text
 * @returns Array of quoted strings found
 */
function extractQuotedText(input: string): string[] {
  const quotes: string[] = [];

  for (const pattern of QUOTE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(input)) !== null) {
      if (match[1] && match[1].length >= 10) {
        // Only meaningful quotes (10+ chars)
        quotes.push(match[1]);
      }
    }
  }

  return quotes;
}

/**
 * Find message containing quoted text
 * @param quote - Quoted text to find
 * @param messages - Messages to search
 * @returns Message ID if found, null otherwise
 */
function findMessageByQuote(
  quote: string,
  messages: ChatMessage[]
): string | null {
  const normalizedQuote = quote.toLowerCase().trim();

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      const normalizedContent = msg.content.toLowerCase();
      if (normalizedContent.includes(normalizedQuote)) {
        return msg.id;
      }
    }
  }

  return null;
}

// ============================================
// Output Reference Helpers
// ============================================

/**
 * Create output reference from message
 * @param message - Chat message
 * @returns Output reference
 */
export function createOutputReference(message: ChatMessage): OutputReference {
  return {
    message_id: message.id,
    content_preview: message.content.slice(0, 100),
    timestamp: new Date(message.timestamp).getTime(),
    template_id: message.meta?.templateId,
  };
}

/**
 * Get last N assistant messages as output references
 * @param messages - All messages
 * @param limit - Max number to return (default 5)
 * @returns Array of output references
 */
export function getRecentOutputs(
  messages: ChatMessage[],
  limit: number = 5
): OutputReference[] {
  return messages
    .filter((m) => m.role === 'assistant')
    .slice(-limit)
    .reverse() // Most recent first
    .map(createOutputReference);
}

// ============================================
// Main Resolver
// ============================================

/**
 * Resolve source for transform action
 * @param input - User input text
 * @param messages - All messages in conversation
 * @param explicitSourceId - Explicit source from UI (if any)
 * @returns Source resolution result
 */
export function resolveSource(
  input: string,
  messages: ChatMessage[],
  explicitSourceId?: string | null
): SourceResolution {
  // ✅ B5: Filter to valid sources only (excludes refusals, empty, too short)
  const validSources = filterValidSources(messages);
  const assistantMessages = messages.filter((m) => m.role === 'assistant');

  // Priority 1: Explicit UI source (trust user even if technically invalid)
  if (explicitSourceId) {
    const sourceMessage = assistantMessages.find(
      (m) => m.id === explicitSourceId
    );
    if (sourceMessage) {
      return {
        status: 'explicit',
        source_message_id: explicitSourceId,
        source_content: sourceMessage.content,
        confidence: 1.0,
      };
    }
  }

  // Priority 2: Quoted text in input
  const quotes = extractQuotedText(input);
  if (quotes.length > 0) {
    // Try to find message containing the quote
    for (const quote of quotes) {
      const messageId = findMessageByQuote(quote, messages);
      if (messageId) {
        const sourceMessage = assistantMessages.find(
          (m) => m.id === messageId
        );
        return {
          status: 'quoted',
          source_message_id: messageId,
          source_content: sourceMessage?.content || null,
          confidence: 0.9,
        };
      }
    }
  }

  // Priority 3: Implicit reference → last VALID assistant output
  // ✅ B5: Use validSources instead of all assistant messages
  if (hasImplicitReference(input) && validSources.length > 0) {
    const lastValid = validSources[validSources.length - 1];
    return {
      status: 'implicit',
      source_message_id: lastValid.id,
      source_content: lastValid.content,
      confidence: 0.8,
    };
  }

  // Priority 4: Multiple valid outputs → ambiguous
  // ✅ B5: Only show valid sources as candidates
  if (validSources.length > 1) {
    // Return ambiguous with candidates
    return {
      status: 'ambiguous',
      source_message_id: null,
      source_content: null,
      candidates: getRecentOutputs(messages, 5),
      confidence: 0.5,
    };
  }

  // Single valid source - use it by default
  // ✅ B5: Only use if it's a valid source
  if (validSources.length === 1) {
    const onlyValid = validSources[0];
    return {
      status: 'implicit',
      source_message_id: onlyValid.id,
      source_content: onlyValid.content,
      confidence: 0.7,
    };
  }

  // No valid source available
  return {
    status: 'none',
    source_message_id: null,
    source_content: null,
    confidence: 0,
  };
}

/**
 * Get message content by ID
 * @param messageId - Message ID
 * @param messages - All messages
 * @returns Message content or null
 */
export function getMessageContent(
  messageId: string,
  messages: ChatMessage[]
): string | null {
  const message = messages.find((m) => m.id === messageId);
  return message?.content || null;
}

/**
 * Check if resolution is usable (has source content)
 * @param resolution - Source resolution
 * @returns True if source is available
 */
export function isResolutionUsable(resolution: SourceResolution): boolean {
  return (
    resolution.source_message_id !== null &&
    resolution.source_content !== null &&
    resolution.status !== 'ambiguous'
  );
}

/**
 * Check if resolution needs user selection
 * @param resolution - Source resolution
 * @returns True if user needs to pick source
 */
export function needsUserSelection(resolution: SourceResolution): boolean {
  return resolution.status === 'ambiguous';
}
