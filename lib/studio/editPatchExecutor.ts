// ============================================
// STEP 21: Edit Patch Executor
// STEP 22: Patch-Only Output Contract Enforcement
// ============================================
// A pure utility for applying targeted edits to specific sections
// while preserving all other sections unchanged.
//
// PURPOSE:
// - Separate Edit Intent (what user wants to change) from
//   Output Shape Requirement (full post vs partial patch)
// - Allow partial edits safely (BODY-only, CTA-only, HOOK-only)
// - Gracefully degrade when structure is missing
// - STEP 22: Enforce patch-only output format from LLM
//
// INVARIANTS:
// - No LLM calls
// - No persistence
// - No new endpoints
// - Pure, deterministic functions
// - SINGLE_LLM_CALL_SITE preserved
// ============================================

import type { EditorialCanon, CanonSection } from './editorialCanon';
import type { EditIntentTarget, NormalizedEditIntent } from './editIntentNormalizer';
import type {
  PatchOnlyContract,
  PatchTarget,
  PatchAction,
  ExtractedPatch,
  PatchValidationResult,
} from '@/types/studio';

// ============================================
// Types
// ============================================

/**
 * Edit patch target - which section to modify
 */
export type EditPatchTarget = 'HOOK' | 'BODY' | 'CTA' | 'TONE';

/**
 * Edit patch mode
 */
export type EditPatchMode = 'PATCH' | 'FULL';

/**
 * Edit patch request - input to the patch executor
 */
export interface EditPatchRequest {
  /** Target section to edit */
  target: EditPatchTarget;
  /** User instruction for the edit */
  instruction: string;
  /** Current canon (draft structure) */
  canon: EditorialCanon;
  /** Language */
  lang: 'vi' | 'en';
}

/**
 * Edit patch result - output of the patch executor
 */
export interface EditPatchResult {
  /** Whether the patch was applied successfully */
  success: boolean;
  /** Updated canon (only target section modified) */
  updatedCanon?: EditorialCanon;
  /** Sections that were preserved (not modified) */
  preservedSections: CanonSection[];
  /** Error message if failed */
  error?: string;
}

/**
 * Edit patch metadata - injected into LLM request
 */
export interface EditPatchMeta {
  /** Target section to edit */
  target: EditPatchTarget;
  /** Edit mode */
  mode: EditPatchMode;
  /** Sections to preserve (lock) */
  preserveSections: CanonSection[];
  /** Whether partial output is allowed */
  allowPartialOutput: boolean;
}

// ============================================
// Core Functions
// ============================================

/**
 * Determine sections to preserve based on target.
 * When editing BODY, preserve HOOK and CTA.
 * When editing HOOK, preserve BODY and CTA.
 * etc.
 */
export function getSectionsToPreserve(target: EditPatchTarget): CanonSection[] {
  switch (target) {
    case 'HOOK':
      return ['BODY', 'CTA'];
    case 'BODY':
      return ['HOOK', 'CTA'];
    case 'CTA':
      return ['HOOK', 'BODY'];
    case 'TONE':
      // Tone affects all sections, but structure is preserved
      return ['HOOK', 'BODY', 'CTA'];
    default:
      return [];
  }
}

/**
 * Build edit patch metadata from normalized intent.
 * Used to inject into LLM request.
 */
export function buildEditPatchMeta(
  normalizedIntent: NormalizedEditIntent
): EditPatchMeta | null {
  // Only apply for EDIT_IN_PLACE action with HIGH confidence
  if (normalizedIntent.action !== 'EDIT_IN_PLACE') {
    return null;
  }

  // Map EditIntentTarget to EditPatchTarget
  const target = normalizedIntent.target;

  // FULL target means no specific patch - allow full rewrite
  if (target === 'FULL') {
    return null;
  }

  const patchTarget = target as EditPatchTarget;
  const preserveSections = getSectionsToPreserve(patchTarget);

  return {
    target: patchTarget,
    mode: 'PATCH',
    preserveSections,
    allowPartialOutput: true,
  };
}

/**
 * Check if a normalized intent allows partial output.
 * Partial output is allowed when:
 * - Intent is EDIT_IN_PLACE
 * - Confidence is HIGH or MEDIUM
 * - Target is specific (not FULL)
 */
export function allowsPartialOutput(
  normalizedIntent: NormalizedEditIntent | null
): boolean {
  if (!normalizedIntent) return false;
  if (normalizedIntent.action !== 'EDIT_IN_PLACE') return false;
  if (normalizedIntent.target === 'FULL') return false;

  // HIGH confidence always allows partial output
  if (normalizedIntent.confidence === 'HIGH') return true;

  // MEDIUM confidence allows for specific targets
  if (normalizedIntent.confidence === 'MEDIUM') {
    return ['BODY', 'HOOK', 'CTA', 'TONE'].includes(normalizedIntent.target);
  }

  return false;
}

/**
 * Check if structure validation should be skipped.
 * Skip when:
 * - Intent is EDIT_IN_PLACE with HIGH confidence
 * - Target is specific (not FULL)
 */
export function shouldSkipStructureValidation(
  normalizedIntent: NormalizedEditIntent | null
): boolean {
  if (!normalizedIntent) return false;
  if (normalizedIntent.action !== 'EDIT_IN_PLACE') return false;
  if (normalizedIntent.confidence !== 'HIGH') return false;
  if (normalizedIntent.target === 'FULL') return false;

  return true;
}

/**
 * Format edit patch instruction for LLM prompt.
 * Instructs the model to only modify the target section.
 */
export function formatEditPatchPrompt(
  meta: EditPatchMeta,
  lang: 'vi' | 'en'
): string {
  const targetLabel = getTargetLabel(meta.target, lang);
  const preserveLabels = meta.preserveSections
    .map(s => getSectionLabel(s, lang))
    .join(', ');

  if (lang === 'vi') {
    return `
📝 CHỈ THỊ CHỈNH SỬA:
- Chỉ sửa phần: ${targetLabel}
- GIỮ NGUYÊN các phần: ${preserveLabels}
- KHÔNG viết lại toàn bài
- KHÔNG thay đổi cấu trúc các phần khác
- Output có thể chỉ chứa phần được sửa
`.trim();
  }

  return `
📝 EDIT INSTRUCTION:
- Only modify: ${targetLabel}
- PRESERVE unchanged: ${preserveLabels}
- DO NOT rewrite the entire post
- DO NOT change structure of other sections
- Output may contain only the edited section
`.trim();
}

/**
 * Get localized target label
 */
function getTargetLabel(target: EditPatchTarget, lang: 'vi' | 'en'): string {
  const labels: Record<EditPatchTarget, { vi: string; en: string }> = {
    HOOK: { vi: 'Mở bài / Hook', en: 'Hook / Opening' },
    BODY: { vi: 'Thân bài / Body', en: 'Body / Content' },
    CTA: { vi: 'Kêu gọi / CTA', en: 'CTA / Closing' },
    TONE: { vi: 'Tone / Giọng văn', en: 'Tone / Style' },
  };
  return labels[target][lang];
}

/**
 * Get localized section label
 */
function getSectionLabel(section: CanonSection, lang: 'vi' | 'en'): string {
  const labels: Record<CanonSection, { vi: string; en: string }> = {
    HOOK: { vi: 'Mở bài', en: 'Hook' },
    BODY: { vi: 'Thân bài', en: 'Body' },
    CTA: { vi: 'Kêu gọi', en: 'CTA' },
    TONE: { vi: 'Tone', en: 'Tone' },
  };
  return labels[section][lang];
}

/**
 * Merge patched content with original canon.
 * Replaces only the target section, preserves all others.
 *
 * @param originalCanon - The original canon before edit
 * @param patchedContent - The new content for the target section
 * @param target - Which section was patched
 * @returns Merged canon with only target section updated
 */
export function mergeEditPatch(
  originalCanon: EditorialCanon,
  patchedContent: string,
  target: EditPatchTarget
): EditorialCanon {
  const updatedCanon = { ...originalCanon };

  switch (target) {
    case 'HOOK':
      updatedCanon.hook = {
        ...originalCanon.hook,
        text: patchedContent.trim(),
      };
      break;

    case 'BODY':
      // For BODY, we need to update the blocks
      updatedCanon.body = {
        blocks: [{
          id: `blk_patched_${Date.now()}`,
          text: patchedContent.trim(),
          role: 'paragraph',
          locked: false,
        }],
      };
      break;

    case 'CTA':
      updatedCanon.cta = {
        ...originalCanon.cta,
        text: patchedContent.trim(),
      };
      break;

    case 'TONE':
      // Tone is metadata, not content - no merge needed
      break;
  }

  // Update metadata
  updatedCanon.meta = {
    ...originalCanon.meta,
    updatedAt: Date.now(),
    revision: originalCanon.meta.revision + 1,
  };

  return updatedCanon;
}

/**
 * Reconstruct full text from canon sections.
 * Used when we need to display the merged result.
 */
export function reconstructTextFromCanon(canon: EditorialCanon): string {
  const parts: string[] = [];

  // Add hook if present
  if (canon.hook.text.trim()) {
    parts.push(canon.hook.text.trim());
  }

  // Add body blocks
  const bodyText = canon.body.blocks
    .map(b => b.text.trim())
    .filter(t => t)
    .join('\n\n');
  if (bodyText) {
    parts.push(bodyText);
  }

  // Add CTA if present
  if (canon.cta.text.trim()) {
    parts.push(canon.cta.text.trim());
  }

  return parts.join('\n\n');
}

// ============================================
// Debug Helpers
// ============================================

/**
 * Get debug summary of edit patch meta
 */
export function getEditPatchDebugSummary(meta: EditPatchMeta | null): string {
  if (!meta) return 'No patch';
  return `PATCH:${meta.target} | Preserve:${meta.preserveSections.join(',')} | Partial:${meta.allowPartialOutput}`;
}

// ============================================
// STEP 22: Patch-Only Output Contract
// ============================================

/**
 * Format the patch-only system block for LLM prompt injection.
 * This instructs the model to output ONLY [PATCH] blocks, not full rewrites.
 *
 * @param contract - The PatchOnlyContract defining target sections
 * @param lang - Language for localized instructions
 * @returns System block string to inject into LLM prompt
 */
export function formatPatchOnlySystemBlock(
  contract: PatchOnlyContract,
  lang: 'vi' | 'en'
): string {
  const targetLabels = contract.targets
    .map(t => getPatchTargetLabel(t, lang))
    .join(', ');

  if (lang === 'vi') {
    return `
🔒 CHẾ ĐỘ CHỈNH SỬA CỤC BỘ (PATCH-ONLY MODE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ BẮT BUỘC: Bạn đang chỉnh sửa bản nháp đã có. KHÔNG viết lại toàn bài.

📋 QUY TẮC:
1. CHỈ output phần được yêu cầu sửa: ${targetLabels}
2. GIỮ NGUYÊN tất cả phần khác (không lặp lại, không thay đổi)
3. Nếu yêu cầu không rõ, hỏi lại thay vì viết lại toàn bài

📝 ĐỊNH DẠNG OUTPUT BẮT BUỘC:
\`\`\`
[PATCH]
TARGET: ${contract.targets[0]}
ACTION: ${contract.defaultAction}
CONTENT:
<nội dung mới cho phần này>
[/PATCH]
\`\`\`

❌ KHÔNG LÀM:
- Không viết lại Hook nếu không được yêu cầu
- Không viết lại Body nếu không được yêu cầu
- Không viết lại CTA nếu không được yêu cầu
- Không output toàn bộ bài viết

✅ CHỈ OUTPUT [PATCH] BLOCK CHO PHẦN ĐƯỢC YÊU CẦU.
`.trim();
  }

  return `
🔒 PATCH-ONLY EDIT MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ REQUIRED: You are editing an existing draft. DO NOT rewrite the full post.

📋 RULES:
1. ONLY output the section(s) being edited: ${targetLabels}
2. PRESERVE all other sections unchanged (do not repeat, do not modify)
3. If the instruction is ambiguous, ask a clarification question instead of rewriting

📝 REQUIRED OUTPUT FORMAT:
\`\`\`
[PATCH]
TARGET: ${contract.targets[0]}
ACTION: ${contract.defaultAction}
CONTENT:
<new content for this section only>
[/PATCH]
\`\`\`

❌ DO NOT:
- Do not rewrite Hook unless specifically requested
- Do not rewrite Body unless specifically requested
- Do not rewrite CTA unless specifically requested
- Do not output the entire post

✅ ONLY OUTPUT [PATCH] BLOCK FOR THE REQUESTED SECTION.
`.trim();
}

/**
 * Get localized label for patch target
 */
function getPatchTargetLabel(target: PatchTarget, lang: 'vi' | 'en'): string {
  const labels: Record<PatchTarget, { vi: string; en: string }> = {
    HOOK: { vi: 'Mở bài (Hook)', en: 'Hook / Opening' },
    BODY: { vi: 'Thân bài (Body)', en: 'Body / Content' },
    CTA: { vi: 'Kêu gọi (CTA)', en: 'CTA / Call-to-Action' },
    TONE: { vi: 'Giọng văn (Tone)', en: 'Tone / Style' },
  };
  return labels[target][lang];
}

/**
 * Validate LLM output against PatchOnlyContract.
 * Extracts [PATCH] blocks and validates they match the contract.
 *
 * @param output - Raw LLM output string
 * @param contract - The PatchOnlyContract to validate against
 * @returns PatchValidationResult with extracted patches or errors
 */
export function validatePatchOnlyOutput(
  output: string,
  contract: PatchOnlyContract
): PatchValidationResult {
  const patches: ExtractedPatch[] = [];
  const errors: string[] = [];

  // Regex to extract [PATCH] blocks
  const patchBlockRegex = /\[PATCH\]\s*\n?TARGET:\s*(HOOK|BODY|CTA|TONE)\s*\n?ACTION:\s*(REPLACE|APPEND|PREPEND)\s*\n?CONTENT:\s*\n?([\s\S]*?)\[\/PATCH\]/gi;

  let match;
  let foundPatches = false;

  while ((match = patchBlockRegex.exec(output)) !== null) {
    foundPatches = true;
    const target = match[1].toUpperCase() as PatchTarget;
    const action = match[2].toUpperCase() as PatchAction;
    const content = match[3].trim();

    // Validate target is in contract
    if (!contract.targets.includes(target)) {
      errors.push(`Patch target ${target} not allowed by contract. Allowed: ${contract.targets.join(', ')}`);
      continue;
    }

    patches.push({
      target,
      action,
      content,
    });
  }

  // Check if output was a full rewrite (no [PATCH] blocks found)
  const wasFullRewrite = !foundPatches && output.trim().length > 0;

  // If no patches found but we have content, try to detect if it's a valid section
  if (wasFullRewrite) {
    // Heuristic: if output doesn't contain typical full-post markers, treat as single-section
    const hasMultipleSections = detectMultipleSections(output);

    if (!hasMultipleSections && contract.targets.length === 1) {
      // Graceful fallback: treat entire output as the target section
      patches.push({
        target: contract.targets[0],
        action: contract.defaultAction,
        content: output.trim(),
      });
      // Don't add error - this is acceptable fallback behavior
    } else {
      errors.push('Output appears to be a full rewrite instead of [PATCH] blocks. Expected patch-only format.');
    }
  }

  // Validate all required targets have patches (optional - depends on use case)
  // For now, we allow partial patches (not all targets need to be patched)

  return {
    valid: errors.length === 0 && patches.length > 0,
    patches,
    errors,
    wasFullRewrite,
    rawOutput: output,
  };
}

/**
 * Heuristic to detect if output contains multiple sections.
 * Used to determine if LLM ignored patch-only instruction.
 */
function detectMultipleSections(output: string): boolean {
  // Count section markers
  const hookMarkers = /(?:🎣|hook|mở bài|opening)/gi;
  const bodyMarkers = /(?:📝|body|thân bài|content)/gi;
  const ctaMarkers = /(?:🎯|cta|kêu gọi|call.to.action)/gi;

  const hookCount = (output.match(hookMarkers) || []).length;
  const bodyCount = (output.match(bodyMarkers) || []).length;
  const ctaCount = (output.match(ctaMarkers) || []).length;

  // If we find 2+ different section types, it's likely a full rewrite
  const sectionTypes = [hookCount > 0, bodyCount > 0, ctaCount > 0].filter(Boolean).length;
  return sectionTypes >= 2;
}

/**
 * Apply extracted patches to the original canon.
 * Merges patches with preserved sections.
 *
 * @param originalCanon - The original canon before edit
 * @param patches - Extracted patches from LLM output
 * @returns Updated canon with patches applied
 */
export function applyPatches(
  originalCanon: EditorialCanon,
  patches: ExtractedPatch[]
): EditorialCanon {
  let updatedCanon = { ...originalCanon };

  for (const patch of patches) {
    switch (patch.target) {
      case 'HOOK':
        updatedCanon.hook = {
          ...originalCanon.hook,
          text: applyPatchAction(originalCanon.hook.text, patch.content, patch.action),
        };
        break;

      case 'BODY':
        const originalBodyText = originalCanon.body.blocks.map(b => b.text).join('\n\n');
        const newBodyText = applyPatchAction(originalBodyText, patch.content, patch.action);
        updatedCanon.body = {
          blocks: [{
            id: `blk_patched_${Date.now()}`,
            text: newBodyText,
            role: 'paragraph',
            locked: false,
          }],
        };
        break;

      case 'CTA':
        updatedCanon.cta = {
          ...originalCanon.cta,
          text: applyPatchAction(originalCanon.cta.text, patch.content, patch.action),
        };
        break;

      case 'TONE':
        // Tone patches affect styling, not text content
        // For now, no-op - could update tone.id if needed
        break;
    }
  }

  // Update metadata
  updatedCanon.meta = {
    ...originalCanon.meta,
    updatedAt: Date.now(),
    revision: originalCanon.meta.revision + 1,
  };

  return updatedCanon;
}

/**
 * Apply patch action to content
 */
function applyPatchAction(original: string, patchContent: string, action: PatchAction): string {
  switch (action) {
    case 'REPLACE':
      return patchContent;
    case 'APPEND':
      return original ? `${original}\n\n${patchContent}` : patchContent;
    case 'PREPEND':
      return original ? `${patchContent}\n\n${original}` : patchContent;
    default:
      return patchContent;
  }
}

/**
 * Build OutputContract from EditPatchMeta.
 * Converts STEP 21 patch meta to STEP 22 output contract.
 */
export function buildOutputContractFromMeta(
  meta: EditPatchMeta | null
): PatchOnlyContract | null {
  if (!meta || meta.mode !== 'PATCH') {
    return null;
  }

  return {
    mode: 'PATCH_ONLY',
    targets: [meta.target as PatchTarget],
    preserveOtherSections: true,
    defaultAction: 'REPLACE',
  };
}

/**
 * Debug summary for STEP 22 output contract
 */
export function getOutputContractDebugSummary(
  contract: PatchOnlyContract | null
): string {
  if (!contract) return 'No contract (FULL_ARTICLE mode)';
  return `PATCH_ONLY: targets=[${contract.targets.join(',')}] action=${contract.defaultAction}`;
}
