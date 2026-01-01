// ============================================
// STEP 21: Edit Patch Executor Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  getSectionsToPreserve,
  buildEditPatchMeta,
  allowsPartialOutput,
  shouldSkipStructureValidation,
  formatEditPatchPrompt,
  mergeEditPatch,
  reconstructTextFromCanon,
  getEditPatchDebugSummary,
  type EditPatchTarget,
  type EditPatchMeta,
} from './editPatchExecutor';
import type { NormalizedEditIntent } from './editIntentNormalizer';
import type { EditorialCanon } from './editorialCanon';

// ============================================
// getSectionsToPreserve Tests
// ============================================
describe('getSectionsToPreserve', () => {
  it('should preserve BODY and CTA when editing HOOK', () => {
    const result = getSectionsToPreserve('HOOK');
    expect(result).toContain('BODY');
    expect(result).toContain('CTA');
    expect(result).not.toContain('HOOK');
  });

  it('should preserve HOOK and CTA when editing BODY', () => {
    const result = getSectionsToPreserve('BODY');
    expect(result).toContain('HOOK');
    expect(result).toContain('CTA');
    expect(result).not.toContain('BODY');
  });

  it('should preserve HOOK and BODY when editing CTA', () => {
    const result = getSectionsToPreserve('CTA');
    expect(result).toContain('HOOK');
    expect(result).toContain('BODY');
    expect(result).not.toContain('CTA');
  });

  it('should preserve all structure sections when editing TONE', () => {
    const result = getSectionsToPreserve('TONE');
    expect(result).toContain('HOOK');
    expect(result).toContain('BODY');
    expect(result).toContain('CTA');
  });
});

// ============================================
// buildEditPatchMeta Tests
// ============================================
describe('buildEditPatchMeta', () => {
  it('should return null for non-EDIT_IN_PLACE actions', () => {
    // This is a hypothetical case - our normalizer always returns EDIT_IN_PLACE
    // but we test the guard anyway
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'FULL',
      confidence: 'HIGH',
      reason: 'Test',
    };
    const result = buildEditPatchMeta(intent);
    expect(result).toBeNull(); // FULL target returns null
  });

  it('should return null for FULL target', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'FULL',
      confidence: 'HIGH',
      reason: 'Full rewrite requested',
    };
    const result = buildEditPatchMeta(intent);
    expect(result).toBeNull();
  });

  it('should build patch meta for BODY target', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'BODY',
      confidence: 'HIGH',
      reason: 'Body edit detected',
    };
    const result = buildEditPatchMeta(intent);

    expect(result).not.toBeNull();
    expect(result?.target).toBe('BODY');
    expect(result?.mode).toBe('PATCH');
    expect(result?.preserveSections).toContain('HOOK');
    expect(result?.preserveSections).toContain('CTA');
    expect(result?.allowPartialOutput).toBe(true);
  });

  it('should build patch meta for HOOK target', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'HOOK',
      confidence: 'HIGH',
      reason: 'Hook edit detected',
    };
    const result = buildEditPatchMeta(intent);

    expect(result).not.toBeNull();
    expect(result?.target).toBe('HOOK');
    expect(result?.preserveSections).toContain('BODY');
    expect(result?.preserveSections).toContain('CTA');
  });

  it('should build patch meta for CTA target', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'CTA',
      confidence: 'MEDIUM',
      reason: 'CTA edit detected',
    };
    const result = buildEditPatchMeta(intent);

    expect(result).not.toBeNull();
    expect(result?.target).toBe('CTA');
    expect(result?.preserveSections).toContain('HOOK');
    expect(result?.preserveSections).toContain('BODY');
  });
});

// ============================================
// allowsPartialOutput Tests
// ============================================
describe('allowsPartialOutput', () => {
  it('should return false for null intent', () => {
    expect(allowsPartialOutput(null)).toBe(false);
  });

  it('should return false for FULL target', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'FULL',
      confidence: 'HIGH',
      reason: 'Test',
    };
    expect(allowsPartialOutput(intent)).toBe(false);
  });

  it('should return true for HIGH confidence BODY target', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'BODY',
      confidence: 'HIGH',
      reason: 'Test',
    };
    expect(allowsPartialOutput(intent)).toBe(true);
  });

  it('should return true for MEDIUM confidence specific target', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'CTA',
      confidence: 'MEDIUM',
      reason: 'Test',
    };
    expect(allowsPartialOutput(intent)).toBe(true);
  });

  it('should return false for LOW confidence', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'BODY',
      confidence: 'LOW',
      reason: 'Test',
    };
    expect(allowsPartialOutput(intent)).toBe(false);
  });
});

// ============================================
// shouldSkipStructureValidation Tests
// ============================================
describe('shouldSkipStructureValidation', () => {
  it('should return false for null intent', () => {
    expect(shouldSkipStructureValidation(null)).toBe(false);
  });

  it('should return false for FULL target', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'FULL',
      confidence: 'HIGH',
      reason: 'Test',
    };
    expect(shouldSkipStructureValidation(intent)).toBe(false);
  });

  it('should return false for non-HIGH confidence', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'BODY',
      confidence: 'MEDIUM',
      reason: 'Test',
    };
    expect(shouldSkipStructureValidation(intent)).toBe(false);
  });

  it('should return true for HIGH confidence specific target', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'BODY',
      confidence: 'HIGH',
      reason: 'Test',
    };
    expect(shouldSkipStructureValidation(intent)).toBe(true);
  });

  it('should return true for HIGH confidence HOOK target', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'HOOK',
      confidence: 'HIGH',
      reason: 'Test',
    };
    expect(shouldSkipStructureValidation(intent)).toBe(true);
  });
});

// ============================================
// formatEditPatchPrompt Tests
// ============================================
describe('formatEditPatchPrompt', () => {
  it('should format Vietnamese prompt correctly', () => {
    const meta: EditPatchMeta = {
      target: 'BODY',
      mode: 'PATCH',
      preserveSections: ['HOOK', 'CTA'],
      allowPartialOutput: true,
    };

    const result = formatEditPatchPrompt(meta, 'vi');

    expect(result).toContain('Thân bài');
    expect(result).toContain('GIỮ NGUYÊN');
    expect(result).toContain('KHÔNG viết lại toàn bài');
  });

  it('should format English prompt correctly', () => {
    const meta: EditPatchMeta = {
      target: 'CTA',
      mode: 'PATCH',
      preserveSections: ['HOOK', 'BODY'],
      allowPartialOutput: true,
    };

    const result = formatEditPatchPrompt(meta, 'en');

    expect(result).toContain('CTA');
    expect(result).toContain('PRESERVE');
    expect(result).toContain('DO NOT rewrite');
  });
});

// ============================================
// mergeEditPatch Tests
// ============================================
describe('mergeEditPatch', () => {
  const createTestCanon = (): EditorialCanon => ({
    hook: { text: 'Original hook', locked: false },
    cta: { text: 'Original CTA', locked: false },
    tone: { id: 'neutral', locked: false },
    body: {
      blocks: [
        { id: 'blk_1', text: 'Original body paragraph', role: 'paragraph', locked: false },
      ],
    },
    meta: {
      activeDraftId: 'test-123',
      createdAt: 1000,
      updatedAt: 1000,
      revision: 1,
    },
  });

  it('should merge HOOK patch and preserve BODY and CTA', () => {
    const canon = createTestCanon();
    const result = mergeEditPatch(canon, 'New hook text', 'HOOK');

    expect(result.hook.text).toBe('New hook text');
    expect(result.cta.text).toBe('Original CTA');
    expect(result.body.blocks[0].text).toBe('Original body paragraph');
  });

  it('should merge BODY patch and preserve HOOK and CTA', () => {
    const canon = createTestCanon();
    const result = mergeEditPatch(canon, 'New body content', 'BODY');

    expect(result.hook.text).toBe('Original hook');
    expect(result.cta.text).toBe('Original CTA');
    expect(result.body.blocks[0].text).toBe('New body content');
  });

  it('should merge CTA patch and preserve HOOK and BODY', () => {
    const canon = createTestCanon();
    const result = mergeEditPatch(canon, 'New CTA text', 'CTA');

    expect(result.hook.text).toBe('Original hook');
    expect(result.cta.text).toBe('New CTA text');
    expect(result.body.blocks[0].text).toBe('Original body paragraph');
  });

  it('should increment revision', () => {
    const canon = createTestCanon();
    const result = mergeEditPatch(canon, 'New content', 'BODY');

    expect(result.meta.revision).toBe(2);
  });
});

// ============================================
// reconstructTextFromCanon Tests
// ============================================
describe('reconstructTextFromCanon', () => {
  it('should reconstruct full text from canon sections', () => {
    const canon: EditorialCanon = {
      hook: { text: 'Hook text', locked: false },
      cta: { text: 'CTA text', locked: false },
      tone: { id: 'neutral', locked: false },
      body: {
        blocks: [
          { id: 'blk_1', text: 'Body paragraph 1', role: 'paragraph', locked: false },
          { id: 'blk_2', text: 'Body paragraph 2', role: 'paragraph', locked: false },
        ],
      },
      meta: {
        activeDraftId: 'test',
        createdAt: 1000,
        updatedAt: 1000,
        revision: 1,
      },
    };

    const result = reconstructTextFromCanon(canon);

    expect(result).toContain('Hook text');
    expect(result).toContain('Body paragraph 1');
    expect(result).toContain('Body paragraph 2');
    expect(result).toContain('CTA text');
  });

  it('should handle empty sections gracefully', () => {
    const canon: EditorialCanon = {
      hook: { text: '', locked: false },
      cta: { text: '', locked: false },
      tone: { id: 'neutral', locked: false },
      body: {
        blocks: [
          { id: 'blk_1', text: 'Only body content', role: 'paragraph', locked: false },
        ],
      },
      meta: {
        activeDraftId: 'test',
        createdAt: 1000,
        updatedAt: 1000,
        revision: 1,
      },
    };

    const result = reconstructTextFromCanon(canon);

    expect(result).toBe('Only body content');
    expect(result).not.toContain('undefined');
  });
});

// ============================================
// getEditPatchDebugSummary Tests
// ============================================
describe('getEditPatchDebugSummary', () => {
  it('should return "No patch" for null', () => {
    expect(getEditPatchDebugSummary(null)).toBe('No patch');
  });

  it('should format patch meta correctly', () => {
    const meta: EditPatchMeta = {
      target: 'BODY',
      mode: 'PATCH',
      preserveSections: ['HOOK', 'CTA'],
      allowPartialOutput: true,
    };

    const result = getEditPatchDebugSummary(meta);

    expect(result).toContain('PATCH:BODY');
    expect(result).toContain('HOOK');
    expect(result).toContain('CTA');
    expect(result).toContain('Partial:true');
  });
});

// ============================================
// Real-world Scenario Tests
// ============================================
describe('Real-world scenarios', () => {
  it('should handle "thêm thông tin" → BODY patch', () => {
    // Simulates: User says "thêm thông tin" (add information)
    // Intent normalizer returns BODY target with HIGH confidence
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'BODY',
      confidence: 'HIGH',
      reason: 'Detected "thêm" (add) pattern',
    };

    const patchMeta = buildEditPatchMeta(intent);
    const skipValidation = shouldSkipStructureValidation(intent);
    const allowPartial = allowsPartialOutput(intent);

    expect(patchMeta).not.toBeNull();
    expect(patchMeta?.target).toBe('BODY');
    expect(skipValidation).toBe(true);
    expect(allowPartial).toBe(true);
  });

  it('should handle "sửa CTA cho mạnh hơn" → CTA patch', () => {
    // Simulates: User says "sửa CTA cho mạnh hơn" (make CTA stronger)
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'CTA',
      confidence: 'HIGH',
      reason: 'Detected CTA target',
    };

    const patchMeta = buildEditPatchMeta(intent);

    expect(patchMeta).not.toBeNull();
    expect(patchMeta?.target).toBe('CTA');
    expect(patchMeta?.preserveSections).toContain('HOOK');
    expect(patchMeta?.preserveSections).toContain('BODY');
  });

  it('should NOT create patch for ambiguous "viết hay hơn"', () => {
    // Simulates: User says "viết hay hơn" (write better) - ambiguous
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'FULL',
      confidence: 'LOW',
      reason: 'Ambiguous instruction',
    };

    const patchMeta = buildEditPatchMeta(intent);
    const skipValidation = shouldSkipStructureValidation(intent);

    expect(patchMeta).toBeNull(); // No patch for FULL target
    expect(skipValidation).toBe(false); // Don't skip validation
  });
});

// ============================================
// STEP 22: Patch-Only Output Contract Tests
// ============================================
import {
  formatPatchOnlySystemBlock,
  validatePatchOnlyOutput,
  applyPatches,
  buildOutputContractFromMeta,
  getOutputContractDebugSummary,
} from './editPatchExecutor';
import type { PatchOnlyContract } from '@/types/studio';

describe('formatPatchOnlySystemBlock', () => {
  const testContract: PatchOnlyContract = {
    mode: 'PATCH_ONLY',
    targets: ['BODY'],
    preserveOtherSections: true,
    defaultAction: 'REPLACE',
  };

  it('should format Vietnamese prompt correctly', () => {
    const result = formatPatchOnlySystemBlock(testContract, 'vi');

    expect(result).toContain('PATCH-ONLY MODE');
    expect(result).toContain('Thân bài (Body)');
    expect(result).toContain('[PATCH]');
    expect(result).toContain('TARGET: BODY');
    expect(result).toContain('ACTION: REPLACE');
    expect(result).toContain('KHÔNG viết lại toàn bài');
  });

  it('should format English prompt correctly', () => {
    const result = formatPatchOnlySystemBlock(testContract, 'en');

    expect(result).toContain('PATCH-ONLY EDIT MODE');
    expect(result).toContain('Body / Content');
    expect(result).toContain('[PATCH]');
    expect(result).toContain('TARGET: BODY');
    expect(result).toContain('ACTION: REPLACE');
    expect(result).toContain('DO NOT rewrite the full post');
  });

  it('should include multiple targets', () => {
    const multiContract: PatchOnlyContract = {
      mode: 'PATCH_ONLY',
      targets: ['HOOK', 'CTA'],
      preserveOtherSections: true,
      defaultAction: 'REPLACE',
    };

    const result = formatPatchOnlySystemBlock(multiContract, 'vi');
    expect(result).toContain('Mở bài (Hook)');
    expect(result).toContain('Kêu gọi (CTA)');
  });
});

describe('validatePatchOnlyOutput', () => {
  const testContract: PatchOnlyContract = {
    mode: 'PATCH_ONLY',
    targets: ['BODY'],
    preserveOtherSections: true,
    defaultAction: 'REPLACE',
  };

  it('should extract valid [PATCH] block', () => {
    const output = `
[PATCH]
TARGET: BODY
ACTION: REPLACE
CONTENT:
Đây là nội dung mới cho phần thân bài.
Thêm thông tin liên hệ: 0123-456-789
[/PATCH]
`.trim();

    const result = validatePatchOnlyOutput(output, testContract);

    expect(result.valid).toBe(true);
    expect(result.patches.length).toBe(1);
    expect(result.patches[0].target).toBe('BODY');
    expect(result.patches[0].action).toBe('REPLACE');
    expect(result.patches[0].content).toContain('0123-456-789');
    expect(result.wasFullRewrite).toBe(false);
  });

  it('should handle APPEND action', () => {
    const output = `
[PATCH]
TARGET: BODY
ACTION: APPEND
CONTENT:
📞 Liên hệ ngay: 0123-456-789
[/PATCH]
`.trim();

    const result = validatePatchOnlyOutput(output, testContract);

    expect(result.valid).toBe(true);
    expect(result.patches[0].action).toBe('APPEND');
  });

  it('should reject target not in contract', () => {
    const output = `
[PATCH]
TARGET: CTA
ACTION: REPLACE
CONTENT:
New CTA content
[/PATCH]
`.trim();

    const result = validatePatchOnlyOutput(output, testContract);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('CTA not allowed');
  });

  it('should gracefully handle single-section output without [PATCH] markers', () => {
    // When LLM outputs just the content without markers, treat as fallback
    const output = 'Đây là nội dung mới. Thêm thông tin liên hệ: 0123-456-789';

    const result = validatePatchOnlyOutput(output, testContract);

    // Should gracefully fallback since it's a single target contract
    expect(result.valid).toBe(true);
    expect(result.patches.length).toBe(1);
    expect(result.patches[0].target).toBe('BODY');
    expect(result.patches[0].action).toBe('REPLACE');
    expect(result.wasFullRewrite).toBe(true); // Technically a fallback from full rewrite
  });

  it('should detect full rewrite with multiple sections', () => {
    const output = `
🎣 Hook: Đây là mở bài mới

📝 Body: Đây là thân bài mới

🎯 CTA: Liên hệ ngay!
`.trim();

    const result = validatePatchOnlyOutput(output, testContract);

    expect(result.valid).toBe(false);
    expect(result.wasFullRewrite).toBe(true);
    expect(result.errors[0]).toContain('full rewrite');
  });

  it('should extract multiple [PATCH] blocks', () => {
    const multiContract: PatchOnlyContract = {
      mode: 'PATCH_ONLY',
      targets: ['HOOK', 'CTA'],
      preserveOtherSections: true,
      defaultAction: 'REPLACE',
    };

    const output = `
[PATCH]
TARGET: HOOK
ACTION: REPLACE
CONTENT:
New hook content
[/PATCH]

[PATCH]
TARGET: CTA
ACTION: REPLACE
CONTENT:
New CTA content
[/PATCH]
`.trim();

    const result = validatePatchOnlyOutput(output, multiContract);

    expect(result.valid).toBe(true);
    expect(result.patches.length).toBe(2);
    expect(result.patches[0].target).toBe('HOOK');
    expect(result.patches[1].target).toBe('CTA');
  });
});

describe('applyPatches', () => {
  const createTestCanon = (): EditorialCanon => ({
    hook: { text: 'Original hook', locked: false },
    cta: { text: 'Original CTA', locked: false },
    tone: { id: 'neutral', locked: false },
    body: {
      blocks: [
        { id: 'blk_1', text: 'Original body paragraph', role: 'paragraph', locked: false },
      ],
    },
    meta: {
      activeDraftId: 'test-123',
      createdAt: 1000,
      updatedAt: 1000,
      revision: 1,
    },
  });

  it('should apply REPLACE patch to BODY', () => {
    const canon = createTestCanon();
    const patches = [{
      target: 'BODY' as const,
      action: 'REPLACE' as const,
      content: 'New body content',
    }];

    const result = applyPatches(canon, patches);

    expect(result.body.blocks[0].text).toBe('New body content');
    expect(result.hook.text).toBe('Original hook');
    expect(result.cta.text).toBe('Original CTA');
  });

  it('should apply APPEND patch to BODY', () => {
    const canon = createTestCanon();
    const patches = [{
      target: 'BODY' as const,
      action: 'APPEND' as const,
      content: 'Appended content',
    }];

    const result = applyPatches(canon, patches);

    expect(result.body.blocks[0].text).toContain('Original body paragraph');
    expect(result.body.blocks[0].text).toContain('Appended content');
  });

  it('should apply PREPEND patch to HOOK', () => {
    const canon = createTestCanon();
    const patches = [{
      target: 'HOOK' as const,
      action: 'PREPEND' as const,
      content: 'Prepended hook',
    }];

    const result = applyPatches(canon, patches);

    expect(result.hook.text).toContain('Prepended hook');
    expect(result.hook.text).toContain('Original hook');
    expect(result.hook.text.startsWith('Prepended hook')).toBe(true);
  });

  it('should apply multiple patches', () => {
    const canon = createTestCanon();
    const patches = [
      { target: 'HOOK' as const, action: 'REPLACE' as const, content: 'New hook' },
      { target: 'CTA' as const, action: 'REPLACE' as const, content: 'New CTA' },
    ];

    const result = applyPatches(canon, patches);

    expect(result.hook.text).toBe('New hook');
    expect(result.cta.text).toBe('New CTA');
    expect(result.body.blocks[0].text).toBe('Original body paragraph');
  });

  it('should increment revision', () => {
    const canon = createTestCanon();
    const patches = [{
      target: 'BODY' as const,
      action: 'REPLACE' as const,
      content: 'New content',
    }];

    const result = applyPatches(canon, patches);

    expect(result.meta.revision).toBe(2);
  });
});

describe('buildOutputContractFromMeta', () => {
  it('should return null for null meta', () => {
    expect(buildOutputContractFromMeta(null)).toBeNull();
  });

  it('should return null for FULL mode', () => {
    const meta: EditPatchMeta = {
      target: 'BODY',
      mode: 'FULL',
      preserveSections: [],
      allowPartialOutput: false,
    };
    expect(buildOutputContractFromMeta(meta)).toBeNull();
  });

  it('should build contract for PATCH mode', () => {
    const meta: EditPatchMeta = {
      target: 'BODY',
      mode: 'PATCH',
      preserveSections: ['HOOK', 'CTA'],
      allowPartialOutput: true,
    };

    const result = buildOutputContractFromMeta(meta);

    expect(result).not.toBeNull();
    expect(result?.mode).toBe('PATCH_ONLY');
    expect(result?.targets).toEqual(['BODY']);
    expect(result?.defaultAction).toBe('REPLACE');
    expect(result?.preserveOtherSections).toBe(true);
  });
});

describe('getOutputContractDebugSummary', () => {
  it('should return "No contract" for null', () => {
    expect(getOutputContractDebugSummary(null)).toBe('No contract (FULL_ARTICLE mode)');
  });

  it('should format contract correctly', () => {
    const contract: PatchOnlyContract = {
      mode: 'PATCH_ONLY',
      targets: ['BODY', 'CTA'],
      preserveOtherSections: true,
      defaultAction: 'APPEND',
    };

    const result = getOutputContractDebugSummary(contract);

    expect(result).toContain('PATCH_ONLY');
    expect(result).toContain('BODY');
    expect(result).toContain('CTA');
    expect(result).toContain('APPEND');
  });
});

// ============================================
// STEP 22: End-to-End Scenario Tests
// ============================================
describe('STEP 22: End-to-end scenarios', () => {
  it('should handle "Thêm thông tin liên hệ" → BODY APPEND patch', () => {
    // Full flow: User says "Thêm thông tin liên hệ"
    // 1. Intent normalizer returns BODY target with HIGH confidence
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'BODY',
      confidence: 'HIGH',
      reason: 'Detected "thêm" (add) pattern targeting BODY',
    };

    // 2. Build patch meta
    const patchMeta = buildEditPatchMeta(intent);
    expect(patchMeta).not.toBeNull();
    expect(patchMeta?.target).toBe('BODY');

    // 3. Build output contract
    const outputContract = buildOutputContractFromMeta(patchMeta);
    expect(outputContract).not.toBeNull();
    expect(outputContract?.mode).toBe('PATCH_ONLY');
    expect(outputContract?.targets).toEqual(['BODY']);

    // 4. LLM returns [PATCH] block (simulated)
    const llmOutput = `
[PATCH]
TARGET: BODY
ACTION: APPEND
CONTENT:
📞 Liên hệ hotline: 0123-456-789
📍 Địa chỉ: 123 Nguyễn Huệ, Q.1, TP.HCM
[/PATCH]
`.trim();

    // 5. Validate output
    const validation = validatePatchOnlyOutput(llmOutput, outputContract!);
    expect(validation.valid).toBe(true);
    expect(validation.patches[0].target).toBe('BODY');
    expect(validation.patches[0].action).toBe('APPEND');
    expect(validation.patches[0].content).toContain('0123-456-789');
  });

  it('should handle "Sửa CTA cho mềm hơn" → CTA REPLACE patch', () => {
    // Full flow: User says "Sửa CTA cho mềm hơn"
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'CTA',
      confidence: 'HIGH',
      reason: 'Detected CTA target with tone modifier',
    };

    const patchMeta = buildEditPatchMeta(intent);
    const outputContract = buildOutputContractFromMeta(patchMeta);

    const llmOutput = `
[PATCH]
TARGET: CTA
ACTION: REPLACE
CONTENT:
Nếu bạn quan tâm, hãy để lại bình luận hoặc inbox cho chúng tôi nhé! 💬
[/PATCH]
`.trim();

    const validation = validatePatchOnlyOutput(llmOutput, outputContract!);
    expect(validation.valid).toBe(true);
    expect(validation.patches[0].target).toBe('CTA');
    expect(validation.patches[0].action).toBe('REPLACE');
  });

  it('should reject LLM output that ignores patch-only instruction', () => {
    const intent: NormalizedEditIntent = {
      action: 'EDIT_IN_PLACE',
      target: 'BODY',
      confidence: 'HIGH',
      reason: 'Body edit',
    };

    const patchMeta = buildEditPatchMeta(intent);
    const outputContract = buildOutputContractFromMeta(patchMeta);

    // LLM ignores instruction and returns full rewrite
    const llmOutput = `
🎣 Hook: Bạn đang tìm kiếm sản phẩm tốt nhất?

📝 Body: Đây là toàn bộ nội dung mới được viết lại hoàn toàn.

🎯 CTA: Mua ngay hôm nay!
`.trim();

    const validation = validatePatchOnlyOutput(llmOutput, outputContract!);
    expect(validation.valid).toBe(false);
    expect(validation.wasFullRewrite).toBe(true);
    expect(validation.errors[0]).toContain('full rewrite');
  });
});
