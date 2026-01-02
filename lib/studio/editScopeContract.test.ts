// ============================================
// STEP 19: Edit Scope Contract Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  detectEditTargetFromInstruction,
  shouldGateForScopePick,
  buildEditScopeContract,
  formatEditScopeForPrompt,
  getLockedSectionsForTarget,
  getAllowedOpsForTarget,
  getEditTargetLabel,
  type EditTarget,
} from './editScopeContract';

// ============================================
// detectEditTargetFromInstruction Tests
// ============================================
describe('detectEditTargetFromInstruction', () => {
  describe('Vietnamese patterns', () => {
    it('should detect HOOK target from Vietnamese patterns', () => {
      // Test patterns that match the regex in VI_PATTERNS for HOOK
      // Use simple patterns that definitely match
      const patterns = [
        'sửa hook',        // matches /\bhook\b/i
        'đổi hook',        // matches /\bhook\b/i
        'viết lại hook',   // matches /\bhook\b/i
      ];

      for (const pattern of patterns) {
        const result = detectEditTargetFromInstruction(pattern, 'vi');
        expect(result.target).toBe('HOOK');
        expect(result.confidence).not.toBe('LOW');
      }
    });

    it('should detect BODY target from Vietnamese patterns', () => {
      const patterns = [
        'sửa body',        // matches /\bbody\b/i
        'chỉnh thân bài',  // matches /\bthân\s*bài\b/i
        'viết lại thân',   // matches /\bviết\s*lại\s*thân\b/i
        'thêm bullet',     // matches /\bbullet\b/i
        'phần thân',       // matches /\bphần\s*thân\b/i
      ];

      for (const pattern of patterns) {
        const result = detectEditTargetFromInstruction(pattern, 'vi');
        expect(result.target).toBe('BODY');
        expect(result.confidence).not.toBe('LOW');
      }
    });

    it('should detect CTA target from Vietnamese patterns', () => {
      const patterns = [
        'sửa CTA',         // matches /\bcta\b/i
        'đổi cta',         // matches /\bđổi\s*cta\b/i
        'thêm cta',        // matches /\bthêm\s*cta\b/i
        'chỉnh kêu gọi',   // matches /\bkêu\s*gọi\b/i
        'cta mềm hơn',     // matches /\bcta\s*mềm\b/i
      ];

      for (const pattern of patterns) {
        const result = detectEditTargetFromInstruction(pattern, 'vi');
        expect(result.target).toBe('CTA');
        expect(result.confidence).not.toBe('LOW');
      }
    });

    it('should detect TONE target from Vietnamese patterns', () => {
      const patterns = [
        'chỉnh tone',      // matches /\bchỉnh\s*tone\b/i
        'đổi giọng',       // matches /\bđổi\s*giọng\b/i
        'sang hơn',        // matches /\bsang\s*hơn\b/i
        'trẻ trung hơn',   // matches /\btrẻ\s*trung\b/i
        'bớt salesy',      // matches /\bbớt\s*salesy\b/i
      ];

      for (const pattern of patterns) {
        const result = detectEditTargetFromInstruction(pattern, 'vi');
        expect(result.target).toBe('TONE');
        expect(result.confidence).not.toBe('LOW');
      }
    });

    it('should detect FULL target from Vietnamese patterns', () => {
      const patterns = [
        'viết lại toàn bộ',  // matches /\btoàn\s*bài\b/i or similar
        'làm lại bài',       // matches /\blàm\s*lại\s*bài\b/i
        'toàn bài',          // matches /\btoàn\s*bài\b/i
        'cả bài',            // matches /\bcả\s*bài\b/i
      ];

      for (const pattern of patterns) {
        const result = detectEditTargetFromInstruction(pattern, 'vi');
        expect(result.target).toBe('FULL');
      }
    });

    it('should return FULL with LOW confidence for ambiguous instructions', () => {
      const ambiguous = [
        'viết hay hơn',   // matches AMBIGUOUS_PATTERNS
        'chỉnh lại',      // matches AMBIGUOUS_PATTERNS
      ];

      for (const pattern of ambiguous) {
        const result = detectEditTargetFromInstruction(pattern, 'vi');
        expect(result.target).toBe('FULL');
        expect(result.confidence).toBe('LOW');
      }
    });
  });

  describe('English patterns', () => {
    it('should detect HOOK target from English patterns', () => {
      const patterns = [
        'fix the hook',     // matches /\bhook\b/i
        'edit intro',       // matches /\bintro\b/i
        'opening line',     // matches /\bopening\b/i
      ];

      for (const pattern of patterns) {
        const result = detectEditTargetFromInstruction(pattern, 'en');
        expect(result.target).toBe('HOOK');
      }
    });

    it('should detect BODY target from English patterns', () => {
      const patterns = [
        'edit body',           // matches /\bbody\b/i
        'fix the middle',      // matches /\bmiddle\b/i
        'add bullet points',   // matches /\bbullet\s*points?\b/i
      ];

      for (const pattern of patterns) {
        const result = detectEditTargetFromInstruction(pattern, 'en');
        expect(result.target).toBe('BODY');
      }
    });

    it('should detect CTA target from English patterns', () => {
      const patterns = [
        'edit CTA',           // matches /\bcta\b/i
        'call to action',     // matches /\bcall\s*to\s*action\b/i
        'closing statement',  // matches /\bclosing\b/i
      ];

      for (const pattern of patterns) {
        const result = detectEditTargetFromInstruction(pattern, 'en');
        expect(result.target).toBe('CTA');
      }
    });
  });
});

// ============================================
// shouldGateForScopePick Tests
// ============================================
describe('shouldGateForScopePick', () => {
  it('should not gate when instruction has clear target', () => {
    const result = shouldGateForScopePick('đổi hook', true, 'vi');
    expect(result.requiresUserPick).toBe(false);
  });

  it('should gate when instruction is ambiguous with active canon', () => {
    // Using a pattern that matches AMBIGUOUS_PATTERNS
    const result = shouldGateForScopePick('viết hay hơn', true, 'vi');
    expect(result.requiresUserPick).toBe(true);
    expect(result.suggested).toBeDefined();
  });

  it('should not gate when no active canon (new content)', () => {
    const result = shouldGateForScopePick('viết hay hơn', false, 'vi');
    expect(result.requiresUserPick).toBe(false);
  });

  it('should include suggested contract in gate', () => {
    const result = shouldGateForScopePick('chỉnh lại', true, 'vi');
    if (result.requiresUserPick) {
      expect(result.suggested).toBeDefined();
      expect(result.suggested?.target).toBe('FULL'); // Default suggestion for ambiguous
    }
  });
});

// ============================================
// buildEditScopeContract Tests
// ============================================
describe('buildEditScopeContract', () => {
  it('should build contract from explicit instruction', () => {
    const contract = buildEditScopeContract({
      instructionText: 'đổi hook',  // matches /\bđổi\s*hook\b/i
      lang: 'vi',
      hasActiveCanon: true,
    });

    expect(contract.target).toBe('HOOK');
    expect(contract.source).toBe('EXPLICIT_INSTRUCTION');
    expect(contract.confidence).toBe('HIGH');
  });

  it('should use user-picked target when provided', () => {
    const contract = buildEditScopeContract({
      instructionText: 'viết hay hơn', // ambiguous
      lang: 'vi',
      hasActiveCanon: true,
      userPickedTarget: 'BODY',
    });

    expect(contract.target).toBe('BODY');
    expect(contract.source).toBe('USER_PICKED');
    expect(contract.confidence).toBe('HIGH');
  });

  it('should include canon locks in locked sections', () => {
    const contract = buildEditScopeContract({
      instructionText: 'sửa body',
      lang: 'vi',
      hasActiveCanon: true,
      activeCanonLocks: ['HOOK', 'CTA'],
    });

    expect(contract.lockedSections).toContain('HOOK');
    expect(contract.lockedSections).toContain('CTA');
  });

  it('should add target-specific locks', () => {
    const contract = buildEditScopeContract({
      instructionText: 'đổi hook',
      lang: 'vi',
      hasActiveCanon: true,
    });

    // HOOK target should lock BODY and CTA
    expect(contract.lockedSections).toContain('BODY');
    expect(contract.lockedSections).toContain('CTA');
  });

  it('should default to FULL for no active canon', () => {
    const contract = buildEditScopeContract({
      instructionText: 'viết hay hơn',
      lang: 'vi',
      hasActiveCanon: false,
    });

    expect(contract.target).toBe('FULL');
    expect(contract.confidence).toBe('LOW');
  });
});

// ============================================
// getLockedSectionsForTarget Tests
// ============================================
describe('getLockedSectionsForTarget', () => {
  it('should return correct locks for HOOK', () => {
    const locks = getLockedSectionsForTarget('HOOK');
    expect(locks).toContain('BODY');
    expect(locks).toContain('CTA');
    expect(locks).not.toContain('HOOK');
  });

  it('should return correct locks for BODY', () => {
    const locks = getLockedSectionsForTarget('BODY');
    expect(locks).toContain('HOOK');
    expect(locks).toContain('CTA');
    expect(locks).not.toContain('BODY');
  });

  it('should return correct locks for CTA', () => {
    const locks = getLockedSectionsForTarget('CTA');
    expect(locks).toContain('HOOK');
    expect(locks).toContain('BODY');
    expect(locks).not.toContain('CTA');
  });

  it('should return empty locks for TONE', () => {
    const locks = getLockedSectionsForTarget('TONE');
    expect(locks).toEqual([]);
  });

  it('should return empty locks for FULL', () => {
    const locks = getLockedSectionsForTarget('FULL');
    expect(locks).toEqual([]);
  });
});

// ============================================
// getAllowedOpsForTarget Tests
// ============================================
describe('getAllowedOpsForTarget', () => {
  it('should return MICRO_POLISH for all targets', () => {
    const targets: EditTarget[] = ['HOOK', 'BODY', 'CTA', 'TONE', 'FULL'];

    for (const target of targets) {
      const ops = getAllowedOpsForTarget(target);
      expect(ops).toContain('MICRO_POLISH');
    }
  });

  it('should allow BODY_REWRITE for BODY target', () => {
    const ops = getAllowedOpsForTarget('BODY');
    expect(ops).toContain('BODY_REWRITE');
  });

  it('should allow FULL_REWRITE for FULL target', () => {
    const ops = getAllowedOpsForTarget('FULL');
    expect(ops).toContain('FULL_REWRITE');
  });

  it('should allow SECTION_REWRITE for HOOK and CTA', () => {
    expect(getAllowedOpsForTarget('HOOK')).toContain('SECTION_REWRITE');
    expect(getAllowedOpsForTarget('CTA')).toContain('SECTION_REWRITE');
  });
});

// ============================================
// formatEditScopeForPrompt Tests
// ============================================
describe('formatEditScopeForPrompt', () => {
  it('should format contract for Vietnamese', () => {
    const contract = buildEditScopeContract({
      instructionText: 'đổi hook',
      lang: 'vi',
      hasActiveCanon: true,
    });

    const formatted = formatEditScopeForPrompt(contract, 'vi');

    // Check for section mentions (can be lowercase)
    expect(formatted.toLowerCase()).toContain('hook');
    expect(formatted.toLowerCase()).toContain('body');
    expect(formatted.toLowerCase()).toContain('cta');
  });

  it('should format contract for English', () => {
    const contract = buildEditScopeContract({
      instructionText: 'fix the hook',
      lang: 'en',
      hasActiveCanon: true,
    });

    const formatted = formatEditScopeForPrompt(contract, 'en');

    expect(formatted.toLowerCase()).toContain('hook');
    expect(formatted.toLowerCase()).toContain('target');
  });

  it('should include locked sections in prompt', () => {
    const contract = buildEditScopeContract({
      instructionText: 'sửa body',
      lang: 'vi',
      hasActiveCanon: true,
      activeCanonLocks: ['HOOK'],
    });

    const formatted = formatEditScopeForPrompt(contract, 'vi');

    // Hook should be in locked sections
    expect(formatted.toLowerCase()).toContain('hook');
  });
});

// ============================================
// getEditTargetLabel Tests
// ============================================
describe('getEditTargetLabel', () => {
  it('should return Vietnamese labels', () => {
    expect(getEditTargetLabel('HOOK', 'vi')).toBe('Hook');
    expect(getEditTargetLabel('BODY', 'vi')).toBe('Thân bài');
    expect(getEditTargetLabel('CTA', 'vi')).toBe('CTA');
    expect(getEditTargetLabel('TONE', 'vi')).toBe('Tone');
    expect(getEditTargetLabel('FULL', 'vi')).toBe('Toàn bài');
  });

  it('should return English labels', () => {
    expect(getEditTargetLabel('HOOK', 'en')).toBe('Hook');
    expect(getEditTargetLabel('BODY', 'en')).toBe('Body');
    expect(getEditTargetLabel('CTA', 'en')).toBe('CTA');
    expect(getEditTargetLabel('TONE', 'en')).toBe('Tone');
    expect(getEditTargetLabel('FULL', 'en')).toBe('Full');
  });
});
