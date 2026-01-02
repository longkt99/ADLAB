// ============================================
// Section Parser Unit Tests
// ============================================
// Comprehensive tests for sectionParser.ts
// Can be run with: npx tsx lib/quality/__tests__/sectionParser.test.ts
// Or with vitest when configured.
//
// Test coverage:
// - Basic markdown formats (bold, italic, headings)
// - Colon placement variations (inside/outside bold)
// - Vietnamese labels (with and without diacritics)
// - Emoji prefixes
// - Numbered/bulleted lists
// - Whitespace handling
// - Edge cases (missing sections, empty content)

import {
  parseSections,
  normalizeSections,
  validateStructure,
  hasSection,
  getSectionContent,
  
  
} from '../sectionParser';

// ============================================
// Test Runner (for tsx execution)
// ============================================

interface TestCase {
  name: string;
  fn: () => void;
}

const tests: TestCase[] = [];
let currentSuite = '';

function describe(name: string, fn: () => void) {
  currentSuite = name;
  fn();
  currentSuite = '';
}

function it(name: string, fn: () => void) {
  tests.push({ name: `${currentSuite} > ${name}`, fn });
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
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
      }
    },
    toContain(item: unknown) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) {
          throw new Error(`Expected array to contain ${JSON.stringify(item)}`);
        }
      } else if (typeof actual === 'string') {
        if (!actual.includes(item as string)) {
          throw new Error(`Expected string to contain ${JSON.stringify(item)}`);
        }
      }
    },
    toHaveLength(length: number) {
      if (Array.isArray(actual)) {
        if (actual.length !== length) {
          throw new Error(`Expected length ${length}, got ${actual.length}`);
        }
      }
    },
    toEqual(expected: T) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr}, got ${actualStr}`);
      }
    },
  };
}

// ============================================
// Test Suites
// ============================================

describe('parseSections', () => {
  it('parses basic **Label:** format', () => {
    const content = `**Hook:**
Hook content here.

**Body:**
Body content here.

**CTA:**
CTA content here.`;

    const sections = parseSections(content);
    expect(sections).toHaveLength(3);
    expect(sections[0].type).toBe('HOOK');
    expect(sections[1].type).toBe('BODY');
    expect(sections[2].type).toBe('CTA');
  });

  it('parses **Label**: format (colon outside bold)', () => {
    const content = `**Hook**: Inline hook content.

**Body**: Inline body content.

**CTA**: Inline CTA content.`;

    const sections = parseSections(content);
    expect(sections).toHaveLength(3);
    expect(sections[0].type).toBe('HOOK');
    expect(sections[0].content).toContain('Inline hook content');
  });

  it('captures inline content correctly', () => {
    const content = `**Hook:** This is inline hook content.`;
    const sections = parseSections(content);
    expect(sections[0].content).toBe('This is inline hook content.');
  });

  it('captures multi-line content', () => {
    const content = `**Hook:**
Line 1
Line 2
Line 3`;
    const sections = parseSections(content);
    expect(sections[0].content).toContain('Line 1');
    expect(sections[0].content).toContain('Line 2');
    expect(sections[0].content).toContain('Line 3');
  });
});

describe('normalizeSections', () => {
  it('normalizes hook, body, cta correctly', () => {
    const content = `**Hook:**
Hook text.

**Body:**
Body text.

**CTA:**
CTA text.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles Call-to-Action label', () => {
    const content = `**Hook:**
Hook.

**Body:**
Body.

**Call-to-Action:**
Action!`;

    const sections = normalizeSections(content);
    expect(sections.cta).toBeTruthy();
    expect(sections.cta).toContain('Action!');
  });

  it('handles hashtags section', () => {
    const content = `**Hook:**
Hook.

**Body:**
Body.

**CTA:**
Action.

**Hashtags:**
#tag1 #tag2 #tag3`;

    const sections = normalizeSections(content);
    expect(sections.hashtags).toBeTruthy();
    expect(sections.hashtags).toContain('#tag1');
  });

  it('stores unknown sections in extras', () => {
    const content = `**Hook:**
Hook.

**Custom Section:**
Custom content here.

**Body:**
Body.

**CTA:**
Action.`;

    const sections = normalizeSections(content);
    expect(Object.keys(sections.extras)).toContain('Custom Section');
  });
});

describe('Vietnamese labels', () => {
  it('handles Mở bài (with diacritics)', () => {
    const content = `**Mở bài:**
Vietnamese hook.

**Nội dung:**
Vietnamese body.

**Kêu gọi hành động:**
Vietnamese CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles Mo bai (without diacritics)', () => {
    const content = `**Mo bai:**
Hook without diacritics.

**Noi dung:**
Body without diacritics.

**Hanh dong:**
CTA without diacritics.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles mixed Vietnamese variants', () => {
    const content = `**Điểm chạm:**
Hook variant.

**Thân bài:**
Body variant.

**Lời kêu gọi:**
CTA variant.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });
});

describe('Emoji prefixes', () => {
  it('handles emoji before **Label:**', () => {
    const content = `🔥 **Hook:**
Fire emoji hook.

💡 **Body:**
Bulb emoji body.

👉 **CTA:**
Point emoji CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles emoji directly attached to bold', () => {
    const content = `🔥**Hook:**
Direct attach hook.

💡**Body:**
Direct attach body.

👉**CTA:**
Direct attach CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles multiple emojis', () => {
    const content = `🔥✨ **Hook:**
Multi emoji hook.

📝💡 **Body:**
Multi emoji body.

🚀👉 **CTA:**
Multi emoji CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles emoji with plain label (no bold)', () => {
    const content = `🎯 Hook: Emoji plain hook.

✨ Body: Emoji plain body.

🚀 CTA: Emoji plain CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });
});

describe('Numbered and bulleted sections', () => {
  it('handles 1. **Hook:** format', () => {
    const content = `1. **Hook:**
Numbered hook.

2. **Body:**
Numbered body.

3. **CTA:**
Numbered CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles (1) **Hook:** format', () => {
    const content = `(1) **Hook:**
Paren numbered hook.

(2) **Body:**
Paren numbered body.

(3) **CTA:**
Paren numbered CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });
});

describe('Markdown heading styles', () => {
  it('handles ## Hook format', () => {
    const content = `## Hook
Heading hook.

## Body
Heading body.

## CTA
Heading CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles ### Label with inline content', () => {
    const content = `### Hook: Inline heading content.

### Body: More inline content.

### CTA: Final inline content.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });
});

describe('Bracket style', () => {
  it('handles [Hook] format', () => {
    const content = `[Hook]
Bracket hook.

[Body]
Bracket body.

[CTA]
Bracket CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });
});

describe('Whitespace handling', () => {
  it('handles leading whitespace', () => {
    const content = `  **Hook:**
Indented hook.

    **Body:**
More indented body.

  **CTA:**
Indented CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles tabs', () => {
    const content = `\t**Hook:**
Tab hook.

\t**Body:**
Tab body.

\t**CTA:**
Tab CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });
});

describe('Case insensitivity', () => {
  it('handles lowercase labels', () => {
    const content = `**hook:**
Lowercase hook.

**body:**
Lowercase body.

**cta:**
Lowercase CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles UPPERCASE labels', () => {
    const content = `**HOOK:**
Uppercase hook.

**BODY:**
Uppercase body.

**CTA:**
Uppercase CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('handles Mixed Case labels', () => {
    const content = `**Hook:**
Mixed hook.

**Body:**
Mixed body.

**Cta:**
Mixed CTA.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });
});

describe('validateStructure', () => {
  it('passes when all required sections present', () => {
    const content = `**Hook:**
Hook.

**Body:**
Body.

**CTA:**
CTA.`;

    const sections = normalizeSections(content);
    const validation = validateStructure(sections);
    expect(validation.ok).toBe(true);
    expect(validation.missing).toHaveLength(0);
  });

  it('fails when Hook is missing', () => {
    const content = `**Body:**
Body only.

**CTA:**
CTA only.`;

    const sections = normalizeSections(content);
    const validation = validateStructure(sections);
    expect(validation.ok).toBe(false);
    expect(validation.missing).toContain('HOOK');
  });

  it('fails when Body is missing', () => {
    const content = `**Hook:**
Hook only.

**CTA:**
CTA only.`;

    const sections = normalizeSections(content);
    const validation = validateStructure(sections);
    expect(validation.ok).toBe(false);
    expect(validation.missing).toContain('BODY');
  });

  it('fails when CTA is missing', () => {
    const content = `**Hook:**
Hook only.

**Body:**
Body only.`;

    const sections = normalizeSections(content);
    const validation = validateStructure(sections);
    expect(validation.ok).toBe(false);
    expect(validation.missing).toContain('CTA');
  });

  it('reports detected sections', () => {
    const content = `**Hook:**
Hook.

**Body:**
Body.

**CTA:**
CTA.`;

    const sections = normalizeSections(content);
    const validation = validateStructure(sections);
    expect(validation.detected).toContain('HOOK');
    expect(validation.detected).toContain('BODY');
    expect(validation.detected).toContain('CTA');
  });

  it('warns on very short sections', () => {
    const content = `**Hook:**
Hi

**Body:**
OK

**CTA:**
Go`;

    const sections = normalizeSections(content);
    const validation = validateStructure(sections);
    expect(validation.warnings.length).toBe(3);
  });

  it('supports custom required sections', () => {
    const content = `**Hook:**
Hook only.`;

    const sections = normalizeSections(content);
    const validation = validateStructure(sections, ['HOOK']);
    expect(validation.ok).toBe(true);
  });
});

describe('hasSection', () => {
  it('returns true when section exists', () => {
    const content = `**Hook:**
Hook content.

**Body:**
Body content.

**CTA:**
CTA content.`;

    expect(hasSection(content, 'HOOK')).toBe(true);
    expect(hasSection(content, 'BODY')).toBe(true);
    expect(hasSection(content, 'CTA')).toBe(true);
  });

  it('returns false when section missing', () => {
    const content = `**Hook:**
Hook only.`;

    expect(hasSection(content, 'HOOK')).toBe(true);
    expect(hasSection(content, 'BODY')).toBe(false);
    expect(hasSection(content, 'CTA')).toBe(false);
  });
});

describe('getSectionContent', () => {
  it('returns section content when exists', () => {
    const content = `**Hook:**
This is the hook content.

**Body:**
This is the body content.

**CTA:**
This is the CTA content.`;

    const hookContent = getSectionContent(content, 'HOOK');
    expect(hookContent).toContain('This is the hook content');

    const bodyContent = getSectionContent(content, 'BODY');
    expect(bodyContent).toContain('This is the body content');

    const ctaContent = getSectionContent(content, 'CTA');
    expect(ctaContent).toContain('This is the CTA content');
  });

  it('returns null when section missing', () => {
    const content = `**Hook:**
Hook only.`;

    expect(getSectionContent(content, 'BODY')).toBeNull();
    expect(getSectionContent(content, 'CTA')).toBeNull();
  });
});

describe('Edge cases', () => {
  it('handles empty content', () => {
    const sections = normalizeSections('');
    expect(sections.hook).toBeNull();
    expect(sections.body).toBeNull();
    expect(sections.cta).toBeNull();
    expect(sections.raw).toHaveLength(0);
  });

  it('handles content with no sections', () => {
    const content = `Just some plain text
without any section markers.`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeNull();
    expect(sections.body).toBeNull();
    expect(sections.cta).toBeNull();
  });

  it('handles content with empty section', () => {
    const content = `**Hook:**

**Body:**
Body content.

**CTA:**
CTA content.`;

    const sections = normalizeSections(content);
    // Empty hook should still be detected but validation should warn
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });

  it('preserves line numbers', () => {
    const content = `**Hook:**
Line 2

**Body:**
Line 5`;

    const sections = parseSections(content);
    expect(sections[0].lineNumber).toBe(1);
    expect(sections[1].lineNumber).toBe(4);
  });
});

describe('Real-world complex cases', () => {
  it('handles Vietnamese with emojis and formatting', () => {
    const content = `🔥✨ **Mở bài:**
Bạn có biết rằng thành công bắt đầu từ thói quen nhỏ?

📝💡 **Nội dung chính:**
Mỗi ngày, hãy dành 10 phút để học điều mới.
Kiến thức sẽ tích lũy theo thời gian.

🚀👉 **Lời kêu gọi:**
Comment số "1" nếu bạn sẵn sàng bắt đầu!

#motivation #success #mindset`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();

    const validation = validateStructure(sections);
    expect(validation.ok).toBe(true);
  });

  it('handles mixed English and Vietnamese', () => {
    const content = `**Hook:** Bạn ready chưa?

**Body:** Let me share with you một câu chuyện thú vị about success.

**CTA:** Follow ngay để không miss những tips hay!`;

    const sections = normalizeSections(content);
    expect(sections.hook).toBeTruthy();
    expect(sections.body).toBeTruthy();
    expect(sections.cta).toBeTruthy();
  });
});

// ============================================
// Run Tests
// ============================================

async function runTests() {
  console.log('='.repeat(60));
  console.log('Section Parser Unit Tests');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test.fn();
      console.log(`✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed, ${tests.length} total`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
runTests();
