// ============================================
// STEP 18: Safe Hash Utility
// ============================================
// Provides deterministic, privacy-safe hashing for request binding.
// Used to create short fingerprints of input text without storing raw content.
//
// INVARIANTS:
// - Same input always produces same output (deterministic)
// - Short output (base36, ~8 chars)
// - No cryptographic guarantees (not for security, just for binding)
// - Works in both browser and Node.js environments
// ============================================

/**
 * Create a deterministic short hash from input string.
 * Uses djb2 algorithm for speed and simplicity.
 *
 * @param input - String to hash
 * @returns Short base36 hash string (8-10 chars)
 *
 * @example
 * safeHash("Hello world") // => "1a2b3c4d"
 * safeHash("") // => "0"
 */
export function safeHash(input: string): string {
  if (!input) return '0';

  // djb2 hash algorithm - fast, simple, good distribution
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // hash * 33 + char
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    // Keep within 32-bit integer range
    hash = hash >>> 0;
  }

  // Convert to base36 for compact representation
  return hash.toString(36);
}

/**
 * Create a composite hash from multiple inputs.
 * Useful for creating a single fingerprint from multiple fields.
 *
 * @param inputs - Array of strings to hash together
 * @returns Short base36 hash string
 *
 * @example
 * safeHashMultiple(["prompt", "system", "meta"]) // => "x7y8z9"
 */
export function safeHashMultiple(inputs: string[]): string {
  // Join with a delimiter that's unlikely to appear in content
  const combined = inputs.join('\x00');
  return safeHash(combined);
}

/**
 * Generate a unique event ID for request binding.
 * Combines timestamp with a random component for uniqueness.
 *
 * @returns Unique event ID string
 *
 * @example
 * generateEventId() // => "evt_1703123456789_x7y8z"
 */
export function generateEventId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);
  return `evt_${timestamp}_${random}`;
}

/**
 * Request binding metadata created at SEND time.
 * This captures the exact state of the input when user clicked Send.
 */
export interface RequestBinding {
  /** Unique event ID for this request */
  eventId: string;
  /** Timestamp when Send was clicked */
  uiSendAt: number;
  /** Hash of the userPrompt at send time */
  uiInputHash: string;
  /** Length of userPrompt for quick validation */
  uiInputLength: number;
}

/**
 * Create request binding from user input at SEND time.
 * This is the single source of truth for what was sent.
 *
 * @param userPrompt - The exact text from input box at send time
 * @returns RequestBinding metadata
 */
export function createRequestBinding(userPrompt: string): RequestBinding {
  return {
    eventId: generateEventId(),
    uiSendAt: Date.now(),
    uiInputHash: safeHash(userPrompt),
    uiInputLength: userPrompt.length,
  };
}

/**
 * Validate that a userPrompt matches the original binding.
 * Used by executor to verify request hasn't been tampered with.
 *
 * @param userPrompt - The userPrompt to validate
 * @param binding - The original binding from SEND time
 * @returns True if userPrompt matches binding
 */
export function validateBinding(
  userPrompt: string,
  binding: Pick<RequestBinding, 'uiInputHash' | 'uiInputLength'>
): boolean {
  // Quick length check first
  if (userPrompt.length !== binding.uiInputLength) {
    return false;
  }
  // Hash check
  return safeHash(userPrompt) === binding.uiInputHash;
}
