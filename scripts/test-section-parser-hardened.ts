// Quick test for hardened sectionParser patterns
// Run with: npx tsx scripts/test-section-parser-hardened.ts

import { normalizeSections, validateStructure, parseSections } from '../lib/quality/sectionParser';

interface TestCase {
  name: string;
  content: string;
  expectHook: boolean;
  expectBody: boolean;
  expectCTA: boolean;
}

const testCases: TestCase[] = [
  // Original test cases
  {
    name: '1. Colon inside bold: **Hook:**',
    content: `**Hook:**
Bạn có biết rằng...

**Body:**
Đây là nội dung chính.

**CTA:**
Bình luận ngay!`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '2. Call-to-Action variant',
    content: `**Hook:**
Attention grabber here.

**Body:**
Main content goes here.

**Call-to-Action:**
Subscribe now!`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '3. Colon outside bold: **Hook**:',
    content: `**Hook**: Bạn có biết rằng...

**Body**: Đây là nội dung chính với nhiều thông tin hữu ích.

**CTA**: Bình luận ngay bên dưới!`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '4. Vietnamese labels (diacritics)',
    content: `**Mở bài:**
Câu hook thu hút.

**Nội dung:**
Thân bài đầy đủ.

**Kêu gọi hành động:**
Follow ngay!`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },

  // NEW hardened test cases
  {
    name: '5. Emoji prefix: 🔥 **Hook:**',
    content: `🔥 **Hook:**
Bạn có biết rằng AI đang thay đổi thế giới?

💡 **Body:**
Đây là nội dung chính về AI và tương lai.

👉 **CTA:**
Theo dõi để cập nhật thêm!`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '6. Emoji prefix with inline: 🎯 Hook: content',
    content: `🎯 Hook: Bạn có đang tìm kiếm giải pháp?

✨ Body: Sản phẩm của chúng tôi giúp bạn tiết kiệm thời gian.

🚀 CTA: Liên hệ ngay hôm nay!`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '7. Numbered sections: 1. Hook:',
    content: `1. **Hook:**
Câu mở đầu thu hút người đọc.

2. **Body:**
Nội dung chính của bài viết.

3. **CTA:**
Hành động kêu gọi cuối cùng.`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '8. Mixed case: **hook:** (lowercase)',
    content: `**hook:**
lowercase hook content here.

**body:**
lowercase body content.

**cta:**
lowercase CTA action.`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '9. Extra whitespace',
    content: `  **Hook:**
Content with leading/trailing spaces.

    **Body:**
More content with spaces.

  **CTA:**
Action with spaces.`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '10. Vietnamese no diacritics: Mo bai, Noi dung, Hanh dong',
    content: `**Mo bai:**
Hook without diacritics.

**Noi dung:**
Body without diacritics.

**Hanh dong:**
CTA without diacritics.`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '11. Markdown heading style: ## Hook',
    content: `## Hook
Markdown heading hook.

## Body
Markdown heading body.

## CTA
Markdown heading CTA.`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '12. Bracket style: [Hook]',
    content: `[Hook]
Bracket style hook.

[Body]
Bracket style body.

[CTA]
Bracket style CTA.`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '13. Missing CTA (should fail)',
    content: `**Hook:**
Only hook here.

**Body:**
Only body here.`,
    expectHook: true,
    expectBody: true,
    expectCTA: false,
  },
  {
    name: '14. Emoji + Bold combined: 🔥**Hook:**',
    content: `🔥**Hook:**
Fire emoji directly before bold.

💪**Body:**
Muscle emoji body.

🎯**CTA:**
Target emoji CTA.`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
  {
    name: '15. Real-world complex: multiple emojis + Vietnamese',
    content: `🔥✨ **Mở bài:**
Bạn có biết rằng thành công bắt đầu từ thói quen nhỏ?

📝💡 **Nội dung chính:**
Mỗi ngày, hãy dành 10 phút để học điều mới.
Kiến thức sẽ tích lũy theo thời gian.

🚀👉 **Lời kêu gọi:**
Comment số "1" nếu bạn sẵn sàng bắt đầu!

#motivation #success #mindset`,
    expectHook: true,
    expectBody: true,
    expectCTA: true,
  },
];

console.log('='.repeat(60));
console.log('Section Parser Hardened Tests');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const sections = normalizeSections(tc.content);
  const validation = validateStructure(sections);

  const hasHook = !!sections.hook && sections.hook.trim().length > 0;
  const hasBody = !!sections.body && sections.body.trim().length > 0;
  const hasCTA = !!sections.cta && sections.cta.trim().length > 0;

  const hookOk = hasHook === tc.expectHook;
  const bodyOk = hasBody === tc.expectBody;
  const ctaOk = hasCTA === tc.expectCTA;
  const allOk = hookOk && bodyOk && ctaOk;

  if (allOk) {
    console.log(`✅ ${tc.name}`);
    passed++;
  } else {
    console.log(`❌ ${tc.name}`);
    console.log(`   Hook: expected=${tc.expectHook}, got=${hasHook} ${hookOk ? '✓' : '✗'}`);
    console.log(`   Body: expected=${tc.expectBody}, got=${hasBody} ${bodyOk ? '✓' : '✗'}`);
    console.log(`   CTA: expected=${tc.expectCTA}, got=${hasCTA} ${ctaOk ? '✓' : '✗'}`);
    console.log(`   Raw sections: ${sections.raw.map(s => `${s.type}:"${s.label}"`).join(', ')}`);
    failed++;
  }
}

console.log('='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
