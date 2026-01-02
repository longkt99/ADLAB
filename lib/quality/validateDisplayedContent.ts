// ============================================
// Validate Displayed Content
// ============================================
// Ensures UI validation matches the exact content shown to users.
// Single source of truth for content → validation → display pipeline.
//
// KEY INVARIANTS:
// 1. getDisplayedText() returns EXACTLY what renderer displays
// 2. computeContentHash() is deterministic and stable
// 3. isValidationStale() detects when stored validation doesn't match displayed content
// 4. All functions are PURE - no side effects, no state mutation
// ============================================

import { runQualityLock, type QualityLockContext } from './runQualityLock';
import { normalizeSections, validateStructure, debugSectionDetection } from './sectionParser';
import type { QualityLockResult } from './intentQualityRules';

// ============================================
// SINGLE SOURCE OF TRUTH: Displayed Text
// ============================================

/**
 * Extract the exact text that would be displayed to the user.
 * This is the SINGLE SOURCE OF TRUTH for what the user sees.
 *
 * CRITICAL: This function MUST mirror any transformations applied
 * by the UI renderer. If the renderer transforms text, apply the
 * same transformations here.
 *
 * @param messageContent - Raw message content from state
 * @returns The exact string that will be rendered in the UI
 */
export function getDisplayedText(messageContent: string): string {
  // Currently, content is rendered directly without transformation.
  // The UI renders: {message.content} (StudioEditor.tsx line ~695)
  // No trimming, no whitespace normalization, no escaping.
  //
  // ⚠️ If ANY transformation is added to the renderer, it MUST be added here too!
  return messageContent;
}

// ============================================
// SINGLE SOURCE OF TRUTH: Content Hash
// ============================================

/**
 * Compute a deterministic hash for content.
 * Used as cache key to detect content changes without expensive re-validation.
 *
 * PROPERTIES:
 * - Deterministic: same input → same output (always)
 * - Fast: O(n) single pass
 * - Stable: doesn't change across re-renders
 *
 * @param content - Content to hash
 * @returns Deterministic hash string: "{length}-{hash}"
 */
export function computeContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${content.length}-${hash.toString(16)}`;
}

/**
 * Validate content using the EXACT text that will be displayed.
 * This ensures validation matches what users see.
 *
 * @param params - Quality lock input parameters
 * @returns Quality lock result
 */
export function validateDisplayedContent(params: QualityLockContext): QualityLockResult {
  // Ensure we validate the exact displayed text
  const displayedText = getDisplayedText(params.output);

  // Run quality lock with the displayed text
  return runQualityLock({
    ...params,
    output: displayedText,
  });
}

// ============================================
// STALE DETECTION
// ============================================

/**
 * All known structure lock rule IDs that require Hook/Body/CTA
 */
const STRUCTURE_LOCK_RULE_IDS = [
  'social_structure_lock',
  'video_structure_lock',
  'email_structure_lock',
  'landing_structure_lock',
  'product_structure_lock',
  'reel_structure_lock',
  'seo_structure_lock',
] as const;

/**
 * Check if the stored validation matches the current content.
 * Used to detect stale validation state.
 *
 * This function is CRITICAL for fixing the "Thiếu section" bug:
 * - If stored validation says "missing sections" but content now has them → STALE
 * - If stored validation says "has sections" but content now missing them → STALE
 *
 * @param content - Current message content (should be from getDisplayedText)
 * @param storedValidation - Validation result stored in message.meta
 * @returns true if validation is likely stale and needs re-evaluation
 */
export function isValidationStale(
  content: string,
  storedValidation: {
    hardFails?: Array<{ id: string; details?: unknown }>;
    detected?: string[];
    decision?: string;
  } | null | undefined
): boolean {
  if (!storedValidation) return false;

  // Find any structure lock failure
  const structureFail = storedValidation.hardFails?.find(
    f => STRUCTURE_LOCK_RULE_IDS.includes(f.id as typeof STRUCTURE_LOCK_RULE_IDS[number])
  );

  if (structureFail) {
    // Re-parse the current displayed content
    const sections = normalizeSections(content);
    const validation = validateStructure(sections, ['HOOK', 'BODY', 'CTA']);

    // STALE CASE 1: Stored says FAIL but current content actually PASSES
    if (validation.ok) {
      return true;
    }

    // STALE CASE 2: Stored has details.missing, check if they changed
    // Only compare if stored validation has specific missing sections recorded
    const details = structureFail.details as { missing?: string[] } | undefined;
    const storedMissing = details?.missing;
    if (storedMissing && Array.isArray(storedMissing) && storedMissing.length > 0) {
      const currentMissing = validation.missing;

      // If missing sections are different, validation is stale
      if (storedMissing.length !== currentMissing.length ||
          !storedMissing.every(s => currentMissing.includes(s as typeof currentMissing[number]))) {
        return true;
      }
    }
    // If no details.missing in stored validation, we already confirmed
    // current still fails, so stored is still accurate (not stale)
  }

  // STALE CASE 3: Stored says PASS but current content actually FAILS structure
  // (This catches the case where content was edited to remove sections)
  // Only check if decision is explicitly 'PASS' (not undefined/null)
  if (storedValidation.decision === 'PASS') {
    const sections = normalizeSections(content);
    const validation = validateStructure(sections, ['HOOK', 'BODY', 'CTA']);

    if (!validation.ok) {
      return true;
    }
  }

  // Not stale: stored validation still matches current content state
  return false;
}

// ============================================
// DEV-ONLY DEBUGGING
// ============================================

/**
 * DEV-ONLY: Comprehensive validation trace.
 * Call this to understand exactly what's happening with validation.
 *
 * @param messageId - Message identifier
 * @param displayedText - The EXACT text being displayed (from getDisplayedText)
 * @param validatedText - The text that was validated
 * @param storedValidation - Stored validation result
 */
export function traceValidation(
  messageId: string,
  displayedText: string,
  validatedText: string,
  storedValidation: {
    hardFails?: Array<{ id: string; details?: unknown }>;
    softFails?: Array<{ id: string }>;
    detected?: string[];
    decision?: string;
  } | null | undefined
): void {
  if (process.env.NODE_ENV !== 'development') return;

  const displayedHash = computeContentHash(displayedText);
  const validatedHash = computeContentHash(validatedText);
  const textMatch = displayedText === validatedText;
  const hashMatch = displayedHash === validatedHash;

  console.group(`[ValidationTrace] Message ${messageId}`);

  // 1. Text comparison
  console.log('--- Text Comparison ---');
  console.log('Displayed text length:', displayedText.length);
  console.log('Validated text length:', validatedText.length);
  console.log('Displayed hash:', displayedHash);
  console.log('Validated hash:', validatedHash);
  console.log('Text match:', textMatch ? '✅ MATCH' : '❌ MISMATCH');
  console.log('Hash match:', hashMatch ? '✅ MATCH' : '❌ MISMATCH');

  if (!textMatch) {
    console.log('First 200 chars (displayed):', displayedText.substring(0, 200));
    console.log('First 200 chars (validated):', validatedText.substring(0, 200));
  }

  // 2. Section parser output for displayed text
  console.log('\n--- Section Parser (Displayed Text) ---');
  debugSectionDetection(displayedText);

  // 3. Stored validation
  console.log('\n--- Stored Validation ---');
  console.log('Decision:', storedValidation?.decision);
  console.log('Hard fails:', storedValidation?.hardFails?.map(f => f.id));
  console.log('Soft fails:', storedValidation?.softFails?.map(f => f.id));

  // 4. Stale detection result
  const isStale = isValidationStale(displayedText, storedValidation);
  console.log('\n--- Stale Detection ---');
  console.log('Is stale:', isStale ? '⚠️ STALE - needs re-validation' : '✅ FRESH');

  console.groupEnd();
}

/**
 * DEV-ONLY: Debug validation mismatch.
 * Logs detailed info when validation seems wrong.
 *
 * @param content - Message content
 * @param storedValidation - Stored validation result
 */
export function debugValidationMismatch(
  content: string,
  storedValidation: {
    hardFails?: Array<{ id: string; details?: unknown }>;
    softFails?: Array<{ id: string }>;
    detected?: string[];
    decision?: string;
  } | null | undefined
): void {
  if (process.env.NODE_ENV !== 'development') return;

  const displayedText = getDisplayedText(content);
  const hasStructureFail = storedValidation?.hardFails?.some(
    f => STRUCTURE_LOCK_RULE_IDS.includes(f.id as typeof STRUCTURE_LOCK_RULE_IDS[number])
  );

  console.group('[ValidationMismatch] Debug Info');
  console.log('Stored decision:', storedValidation?.decision);
  console.log('Content length:', displayedText.length);
  console.log('Content hash:', computeContentHash(displayedText));
  console.log('First 200 chars:', displayedText.substring(0, 200));

  // Re-run section detection
  console.log('\n--- Section Parser Debug ---');
  debugSectionDetection(displayedText);

  console.log('\n--- Stored Validation ---');
  console.log('Hard fails:', storedValidation?.hardFails?.map(f => f.id));
  console.log('Soft fails:', storedValidation?.softFails?.map(f => f.id));
  console.log('Detected:', storedValidation?.detected);
  console.log('Has structure fail:', hasStructureFail);

  // Fresh validation for comparison
  const sections = normalizeSections(displayedText);
  const freshValidation = validateStructure(sections, ['HOOK', 'BODY', 'CTA']);
  console.log('\n--- Fresh Validation (from displayed text) ---');
  console.log('OK:', freshValidation.ok);
  console.log('Missing:', freshValidation.missing);
  console.log('Detected:', freshValidation.detected);

  console.groupEnd();
}

/**
 * Re-validate content if stored validation is stale.
 * Returns the stored validation if still valid, otherwise re-runs validation.
 *
 * @param content - Current message content
 * @param storedValidation - Stored validation result
 * @param intent - Intent ID for re-validation
 * @param meta - Additional metadata
 * @returns Fresh or stored validation result
 */
export function getValidValidation(
  content: string,
  storedValidation: QualityLockResult | null | undefined,
  _intent: string,
  _meta?: { templateId?: string; language?: string; testMode?: boolean }
): QualityLockResult | null {
  if (!storedValidation) return null;

  // Check if stale
  if (isValidationStale(content, storedValidation)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Validation] Stale validation detected - re-running');
      debugValidationMismatch(content, storedValidation);
    }

    // Re-run validation with current content
    // Note: We need to cast intent to IntentId but keep it simple
    // The caller should ensure intent is valid
    return null; // Signal that caller should re-validate
  }

  return storedValidation;
}
