// ============================================
// Integration Test: Validation-Display Consistency
// ============================================
// Tests that validation matches displayed content.
// Run with: npx tsx lib/quality/__tests__/validateDisplayedContent.test.ts
//
// These tests verify the fix for the "Thiếu section" bug:
// - UI shows "Thiếu section cấu trúc" even when content has sections
// - Root cause: stale validation not detected, or displayed text != validated text
// ============================================

import {
  getDisplayedText,
  isValidationStale,
  computeContentHash,
  traceValidation,
} from '../validateDisplayedContent';
import { runQualityLock } from '../runQualityLock';
import { normalizeSections, validateStructure } from '../sectionParser';
import type { IntentId } from '../intentQualityRules';

// ============================================
// Test Runner
// ============================================

interface TestCase {
  name: string;
  fn: () => void;
}

const tests: TestCase[] = [];

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: () => void) {
  tests.push({ name, fn });
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${JSON.stringify(actual)}`);
      }
    },
  };
}

// ============================================
// Test Cases
// ============================================

describe('getDisplayedText', () => {
  it('returns content unchanged (no transformation)', () => {
    const content = '**Hook:** Test content\n\n**Body:** More content\n\n**CTA:** Action';
    const displayed = getDisplayedText(content);
    expect(displayed).toBe(content);
  });

  it('preserves whitespace exactly', () => {
    const content = '  **Hook:**  \n  Content with spaces  \n\n**Body:**\nMore';
    const displayed = getDisplayedText(content);
    expect(displayed).toBe(content);
  });

  it('preserves special characters and emojis', () => {
    const content = '🔥 **Hook:** Emoji test\n\n**Body:** Content 🎯\n\n**CTA:** Action 👉';
    const displayed = getDisplayedText(content);
    expect(displayed).toBe(content);
  });
});

describe('computeContentHash', () => {
  it('same content produces same hash (deterministic)', () => {
    const content = '**Hook:** Test content\n\n**Body:** More content\n\n**CTA:** Action';
    const hash1 = computeContentHash(content);
    const hash2 = computeContentHash(content);
    expect(hash1).toBe(hash2);
  });

  it('different content produces different hash', () => {
    const content1 = '**Hook:** Content A';
    const content2 = '**Hook:** Content B';
    const hash1 = computeContentHash(content1);
    const hash2 = computeContentHash(content2);
    if (hash1 === hash2) {
      throw new Error(`Expected different hashes, got same: ${hash1}`);
    }
  });

  it('hash includes length for collision resistance', () => {
    const content = 'Test content';
    const hash = computeContentHash(content);
    if (!hash.startsWith(`${content.length}-`)) {
      throw new Error(`Hash should start with length prefix, got: ${hash}`);
    }
  });

  it('empty string has consistent hash', () => {
    const hash1 = computeContentHash('');
    const hash2 = computeContentHash('');
    expect(hash1).toBe(hash2);
    expect(hash1).toBe('0-0'); // length 0, hash 0
  });
});

describe('isValidationStale', () => {
  it('returns false when no stored validation', () => {
    const stale = isValidationStale('content', null);
    expect(stale).toBe(false);
  });

  it('returns false when no structure fail', () => {
    const storedValidation = {
      hardFails: [{ id: 'some_other_rule' }],
      detected: ['HOOK', 'BODY', 'CTA'],
    };
    const stale = isValidationStale('content', storedValidation);
    expect(stale).toBe(false);
  });

  it('returns true when stored says missing but content has sections', () => {
    const content = `**Hook:**
Hook content here.

**Body:**
Body content here.

**CTA:**
CTA content here.`;

    const storedValidation = {
      hardFails: [{ id: 'social_structure_lock' }],
      detected: [],
    };

    const stale = isValidationStale(content, storedValidation);
    expect(stale).toBe(true);
  });

  it('returns false when stored says missing and content actually missing', () => {
    const content = `Just some plain text without any sections.`;

    const storedValidation = {
      hardFails: [{ id: 'social_structure_lock' }],
      detected: [],
    };

    const stale = isValidationStale(content, storedValidation);
    expect(stale).toBe(false);
  });
});

describe('End-to-end validation pipeline', () => {
  it('validation result matches what sectionParser detects', () => {
    const content = `**Hook:** Bạn có biết rằng...

**Body:** Đây là nội dung chính của bài viết.

**CTA:** Bình luận ngay bên dưới!`;

    // Run full quality lock
    const qlResult = runQualityLock({
      intent: 'social_caption_v1' as IntentId,
      output: content,
      meta: { templateId: 'social_caption_v1', language: 'vi' },
    });

    // Check structure rule specifically
    const structureRule = qlResult.allResults.find(r => r.id === 'social_structure_lock');
    expect(structureRule?.passed).toBe(true);

    // Verify sectionParser also detects all sections
    const sections = normalizeSections(content);
    const validation = validateStructure(sections, ['HOOK', 'BODY', 'CTA']);
    expect(validation.ok).toBe(true);
  });

  it('colon outside bold detected correctly', () => {
    const content = `**Hook**: Inline hook.

**Body**: Inline body.

**CTA**: Inline CTA.`;

    const qlResult = runQualityLock({
      intent: 'social_caption_v1' as IntentId,
      output: content,
      meta: { templateId: 'social_caption_v1', language: 'vi' },
    });

    const structureRule = qlResult.allResults.find(r => r.id === 'social_structure_lock');
    expect(structureRule?.passed).toBe(true);
  });

  it('Vietnamese labels detected correctly', () => {
    const content = `**Mở bài:**
Câu hook thu hút.

**Nội dung:**
Thân bài đầy đủ.

**Kêu gọi hành động:**
Follow ngay!`;

    const qlResult = runQualityLock({
      intent: 'social_caption_v1' as IntentId,
      output: content,
      meta: { templateId: 'social_caption_v1', language: 'vi' },
    });

    const structureRule = qlResult.allResults.find(r => r.id === 'social_structure_lock');
    expect(structureRule?.passed).toBe(true);
  });

  it('emoji prefixes detected correctly', () => {
    const content = `🔥 **Hook:**
Fire emoji hook.

💡 **Body:**
Bulb emoji body.

👉 **CTA:**
Point emoji CTA.`;

    const qlResult = runQualityLock({
      intent: 'social_caption_v1' as IntentId,
      output: content,
      meta: { templateId: 'social_caption_v1', language: 'vi' },
    });

    const structureRule = qlResult.allResults.find(r => r.id === 'social_structure_lock');
    expect(structureRule?.passed).toBe(true);
  });

  it('missing CTA correctly detected as failure', () => {
    const content = `**Hook:**
Hook only.

**Body:**
Body only.`;

    const qlResult = runQualityLock({
      intent: 'social_caption_v1' as IntentId,
      output: content,
      meta: { templateId: 'social_caption_v1', language: 'vi' },
    });

    const structureRule = qlResult.allResults.find(r => r.id === 'social_structure_lock');
    expect(structureRule?.passed).toBe(false);

    // Verify details show what's missing
    const details = structureRule?.details as { missing?: string[] } | undefined;
    expect(details?.missing).toBeTruthy();
  });
});

describe('Stale validation detection integration', () => {
  it('detects stale validation when content was fixed externally', () => {
    // Simulate: original content had missing sections, stored validation says FAIL
    // Then content was externally updated to have all sections
    // isValidationStale should detect this

    const originalContent = 'Just plain text';
    const originalValidation = runQualityLock({
      intent: 'social_caption_v1' as IntentId,
      output: originalContent,
      meta: {},
    });

    // Confirm original fails
    const originalStructureRule = originalValidation.allResults.find(r => r.id === 'social_structure_lock');
    expect(originalStructureRule?.passed).toBe(false);

    // Now pretend content was updated
    const updatedContent = `**Hook:** Fixed hook.

**Body:** Fixed body.

**CTA:** Fixed CTA.`;

    // Check if stored validation is stale for new content
    const stale = isValidationStale(updatedContent, {
      hardFails: originalValidation.hardFails,
      detected: [],
    });

    expect(stale).toBe(true);
  });

  it('detects stale when PASS stored but content now FAILS', () => {
    // Stored validation says PASS (all sections present)
    // But content was edited to remove sections
    const storedValidation = {
      decision: 'PASS',
      hardFails: [],
      softFails: [],
    };

    // Content now missing sections
    const currentContent = 'Just plain text without sections';

    const stale = isValidationStale(currentContent, storedValidation);
    expect(stale).toBe(true);
  });

  it('detects stale when missing sections changed', () => {
    // Stored validation says missing CTA only
    const storedValidation = {
      decision: 'FAIL',
      hardFails: [{ id: 'social_structure_lock', details: { missing: ['CTA'] } }],
    };

    // But current content is missing HOOK instead
    const currentContent = `**Body:** Body content.

**CTA:** CTA content.`;

    const stale = isValidationStale(currentContent, storedValidation);
    expect(stale).toBe(true);
  });
});

// ============================================
// BUG REPRODUCTION: "Thiếu section" when content has sections
// ============================================
// This test suite reproduces the exact bug that was reported:
// UI shows "Thiếu section cấu trúc (Hook/Body/CTA)" even when
// the visible AI output clearly contains Hook/Body/CTA.

describe('BUG REPRODUCTION: Thiếu section when content has sections', () => {
  it('CRITICAL: effectiveQualityLock returns PASS for valid content with stale FAIL stored', () => {
    // This is the exact scenario that causes the bug:
    // 1. AI generates content WITHOUT sections → stored qualityLock = FAIL
    // 2. Auto-fix updates content to HAVE sections
    // 3. UI still shows "Thiếu section" because it reads stale qualityLock

    // Step 1: Simulate original content without sections
    const originalContent = 'Original content without any sections';
    const originalValidation = runQualityLock({
      intent: 'social_caption_v1' as IntentId,
      output: originalContent,
      meta: {},
    });

    // Verify original fails structure validation
    const originalDecision = originalValidation.hardFails.length > 0 ? 'FAIL' : 'PASS';
    expect(originalDecision).toBe('FAIL');

    // Step 2: Simulate auto-fix updated content with all sections
    const fixedContent = `**Hook:**
Câu hook thu hút người đọc.

**Body:**
Nội dung chính của bài viết với thông tin chi tiết.

**CTA:**
Bình luận ngay để chia sẻ ý kiến của bạn!`;

    // Step 3: This is what the UI should do - detect stale and re-evaluate
    const displayedText = getDisplayedText(fixedContent);
    const stale = isValidationStale(displayedText, {
      hardFails: originalValidation.hardFails,
      decision: 'FAIL',
    });

    // The stale detection MUST return true
    expect(stale).toBe(true);

    // Step 4: Re-run validation on displayed content
    const reEvalResult = runQualityLock({
      intent: 'social_caption_v1' as IntentId,
      output: displayedText,
      meta: { language: 'vi' },
    });

    // The re-evaluation MUST pass structure validation
    const structureRule = reEvalResult.allResults.find(r => r.id === 'social_structure_lock');
    expect(structureRule?.passed).toBe(true);
  });

  it('displayed text equals validated text (invariant)', () => {
    // This test ensures the displayedText === validatedText invariant holds
    const content = `**Hook:** Test hook.

**Body:** Test body.

**CTA:** Test CTA.`;

    const displayedText = getDisplayedText(content);
    const displayedHash = computeContentHash(displayedText);
    const contentHash = computeContentHash(content);

    // displayedText must equal content exactly
    expect(displayedText).toBe(content);

    // Hashes must match
    expect(displayedHash).toBe(contentHash);
  });

  it('inline heading format detected correctly', () => {
    // Test the format that was failing: **Hook**: content (colon outside bold)
    const content = `**Hook**: Inline hook content.

**Body**: Inline body content.

**CTA**: Inline CTA content.`;

    const sections = normalizeSections(content);
    const validation = validateStructure(sections, ['HOOK', 'BODY', 'CTA']);

    expect(validation.ok).toBe(true);
    if (validation.missing.length > 0) {
      throw new Error(`Expected no missing sections, got: ${validation.missing.join(', ')}`);
    }
  });
});

// ============================================
// Run Tests
// ============================================

async function runTests() {
  console.log('='.repeat(60));
  console.log('Validation-Display Consistency Integration Tests');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test.fn();
      console.log(`  ✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${test.name}`);
      console.log(`     Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed, ${tests.length} total`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
