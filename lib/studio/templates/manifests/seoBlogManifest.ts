// ============================================
// SEO Blog Article Template Manifest
// ============================================
// Long-form SEO-optimized blog posts
// Version: 1.0.0

import type { TemplateManifest } from '../templateManifest';

export const seoBlogManifest: TemplateManifest = {
  id: 'seo_blog_v1',
  name: 'SEO Blog Article',
  version: '1.0.0',
  description: 'Viết bài blog dài tối ưu SEO với cấu trúc rõ ràng, từ khóa tự nhiên, và giá trị thực cho người đọc',

  objective: `You are an SEO content writer and strategist.
Your task is to create comprehensive, well-structured blog articles that rank well in search engines while providing genuine value to readers.
Balance keyword optimization with natural, engaging writing.`,

  outputSpec: {
    format: 'markdown with hierarchical headings',
    sections: [
      {
        name: 'Title',
        required: true,
        description: '50–60 ký tự, có từ khóa chính',
      },
      {
        name: 'Meta Description',
        required: true,
        description: '150–160 ký tự, có từ khóa + CTA',
      },
      {
        name: 'Introduction',
        required: true,
        description: 'Nêu vấn đề + hứa giá trị (150–200 từ)',
      },
      {
        name: 'Main Content Sections',
        required: true,
        description: 'H2/H3 phân cấp theo chủ đề (800–1500 từ)',
      },
      {
        name: 'Conclusion',
        required: true,
        description: 'Tóm tắt + takeaway + kêu gọi hành động',
      },
      {
        name: 'FAQ Section',
        required: false,
        description: '3–5 câu hỏi thường gặp',
      },
    ],
  },

  constraints: {
    must: [
      'Include primary keyword in title, first paragraph, and at least 2 H2 headings',
      'Use H2 for main sections, H3 for subsections (proper hierarchy)',
      'Write in a natural, conversational tone (avoid keyword stuffing)',
      'Include internal linking opportunities (mention "link to X" where relevant)',
      'Provide actionable insights, not just generic information',
      'Use short paragraphs (2-4 sentences max) for readability',
    ],
    avoid: [
      'Keyword density above 2% (focus on semantic relevance, not repetition)',
      'Generic fluff like "In today\'s digital world..." or "As we all know..."',
      'Overly technical jargon without explanation',
      'Bullet points for every section (vary structure)',
      'Clickbait titles that don\'t match content',
      'Writing for search engines instead of humans',
    ],
    maxLength: 'Optimal: 1200-2000 words (adjust based on topic complexity)',
  },

  style: {
    description: 'Professional yet accessible. Write like an expert friend explaining to a curious beginner.',
    formatting: [
      'Use markdown formatting: **bold** for emphasis, *italic* for terms',
      'Include bullet points for lists, but also use numbered steps for processes',
      'Add blank lines between paragraphs for visual breathing room',
      'Use > blockquotes for key insights or important callouts',
      'Suggest image/infographic placements with [Image: description]',
    ],
  },

  variables: [
    {
      name: 'primaryKeyword',
      description: 'Main target keyword for SEO',
      required: true,
    },
    {
      name: 'secondaryKeywords',
      description: 'Supporting keywords (comma-separated)',
      required: false,
    },
    {
      name: 'audience',
      description: 'Target reader persona',
      required: false,
    },
    {
      name: 'contentGoal',
      description: 'Article goal (educate, compare, guide, etc.)',
      required: false,
    },
  ],

  examples: [
    {
      scenario: 'Preview mini – SEO blog tiêu chuẩn',
      output: `**Title:**
5 Mẹo Làm Việc Tại Nhà Hiệu Quả Không Cần Văn Phòng Đắt Đỏ

**Meta Description:**
Làm việc tại nhà không còn là thử thách. Áp dụng 5 mẹo đơn giản này để tăng năng suất gấp đôi, dù không có không gian làm việc chuyên nghiệp.

**Introduction:**
Bạn có từng cảm thấy làm việc tại nhà dễ mất tập trung hơn văn phòng?
Sau 3 năm remote, mình đã tìm ra quy trình giúp hoàn thành công việc nhanh hơn, hiệu quả hơn mà không cần góc làm việc "Instagram-able".

**Main Content Sections:**
- H2: Tạo Không Gian Làm Việc Riêng Biệt
- H2: Áp Dụng Kỹ Thuật Pomodoro
- H2: Lên Lịch Trình Cụ Thể Theo Giờ
- H2: Giới Hạn Thông Báo và Mạng Xã Hội
- H2: Nghỉ Giải Lao Đúng Cách

**Conclusion:**
5 mẹo trên đã giúp mình và hàng trăm bạn đồng nghiệp cải thiện năng suất rõ rệt. Thử áp dụng trong 1 tuần và cảm nhận sự khác biệt.`,
    },
    {
      scenario: 'SEO blog about "cách chọn cafe ngon Sài Gòn"',
      output: `**Title:**
7 Cách Chọn Quán Cafe Ngon Sài Gòn Như Thợ Rang (2024)

**Meta Description:**
Không phải quán nào đông là ngon. Học 7 cách chọn cafe ngon Sài Gòn từ barista 10 năm kinh nghiệm. Bỏ túi ngay!

**Introduction:**
Bạn đã bao giờ vào quán cafe đông nghịt, gọi ly Bạc Xỉu "nổi tiếng" mà uống xong... thất vọng không?

Mình cũng vậy. Sau 10 năm làm barista tại Sài Gòn, mình nhận ra: **đám đông không bao giờ đảm bảo chất lượng**.

Bài viết này sẽ chia sẻ 7 cách chọn quán cafe ngon mà mình áp dụng mỗi khi khám phá địa điểm mới. Không cần review, chỉ cần quan sát.

## 1. Quan Sát Máy Pha - Bí Quyết Số 1

Quán nào dùng máy pha espresso thật (không phải máy pha tự động giá rẻ) thường chăm chút chất lượng hơn.

**Dấu hiệu nhận biết:**
- Máy pha espresso có cần gạt (portafilter) bằng kim loại
- Barista xay hạt tươi ngay trước mắt bạn
- Có thể điều chỉnh độ mịn của bột

> Nếu thấy barista bấm nút và đứng chờ, 80% khả năng đó là máy tự động. Không phải máy tự động là xấu, nhưng thường thiếu "tâm hồn" của người pha.

## 2. Ngửi Mùi Hạt - Điều Mà Ít Ai Để Ý

[Image: Close-up của hạt cafe tươi vs hạt ôi]

Bước vào quán, hít thở sâu. Bạn ngửi thấy gì?
- ✅ Mùi cafe tươi rang (hơi chua nhẹ, thơm)
- ❌ Mùi cafe cháy hoặc ôi (dấu hiệu hạt để lâu)

Mẹo: Hỏi barista "Hạt rang bao lâu rồi ạ?". Nếu họ trả lời được cụ thể (VD: "3 ngày"), đó là quán tốt.

[... tiếp tục với 5 cách còn lại ...]

## Kết Luận: Đừng Tin Review, Hãy Tin Mắt Mình

7 cách trên là kinh nghiệm thực chiến, không phải lý thuyết từ sách vở.

**Điểm cộng thêm:**
- Quán có không gian yên tĩnh, nhạc nhẹ
- Nhân viên không gắt khi bạn hỏi về nguồn gốc hạt
- Có option sữa thay thế (hạnh nhân, yến mạch)

Lần sau ghé quán mới, thử áp dụng nhé. Inbox mình nếu phát hiện thêm "trick" nào hay!

---

**FAQ**

**Q: Quán đắt có đảm bảo ngon không?**
A: Không hẳn. Giá cao thường do vị trí mặt bằng, không phải chất lượng cafe. Mình từng uống ly 70k tệ hơn ly 35k ở quán vỉa hè.

**Q: Nên chọn hạt Arabica hay Robusta?**
A: Tùy khẩu vị. Arabica nhẹ hơn, chua thanh. Robusta đắng mạnh, hậu ngọt. Quán ngon thường có cả 2 để bạn chọn.

[... thêm 2-3 FAQ nữa ...]`,
    },
  ],

  attribution: {
    showInUI: true,
    customLabel: 'SEO Blog Engine',
  },
};
