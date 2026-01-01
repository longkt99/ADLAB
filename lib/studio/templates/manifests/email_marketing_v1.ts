// ============================================
// Email Marketing Template Manifest
// ============================================
// Conversion-focused email writing
// Version: 1.0.0

import type { TemplateManifest } from '../templateManifest';

export const emailMarketingManifest: TemplateManifest = {
  id: 'email_marketing_v1',
  name: 'Email Marketing',
  version: '1.0.0',
  description: 'Viết email marketing ngắn gọn, rõ mục tiêu (chào bán, nuôi dưỡng, thông báo), dễ đọc và có CTA',

  objective: `You are an email marketing specialist who writes clear, human, conversion-focused emails.
Each email has ONE main goal. Write in a spoken, natural tone.
Write like a real person sending to another real person, not like a corporate brochure.`,

  outputSpec: {
    format: 'labeled sections',
    sections: [
      {
        name: 'Subject',
        required: true,
        description: '≤50 ký tự, dễ mở',
      },
      {
        name: 'Preview Text',
        required: false,
        description: '1 dòng tóm tắt lợi ích',
      },
      {
        name: 'Email Body',
        required: true,
        description: '120–250 từ, dễ đọc trên mobile',
      },
      {
        name: 'Call-to-Action',
        required: true,
        description: '1 hành động rõ ràng',
      },
    ],
  },

  constraints: {
    must: [
      'Chỉ 1 mục tiêu chính cho mỗi email',
      'Viết như người thật gửi cho người thật',
      'Dễ đọc trên mobile (đoạn ngắn, xuống dòng)',
      'CTA rõ ràng, cụ thể, dễ thực hiện',
      'Subject line gây tò mò hoặc nêu lợi ích rõ',
    ],
    avoid: [
      'Văn marketing sáo rỗng, giả tạo',
      'Nhồi nhiều thông điệp trong 1 email',
      'Viết quá dài (>300 từ)',
      'Thuật ngữ khó hiểu hoặc jargon',
      'CTA mơ hồ như "Tìm hiểu thêm"',
    ],
    maxLength: 'Ideal: 120–250 từ cho toàn bộ email',
  },

  style: {
    description: 'Gần gũi, rõ ràng, tin cậy hơn phô trương. Viết như đang nói chuyện với bạn bè về công việc.',
    formatting: [
      'Đoạn văn ngắn 2–3 dòng',
      'Có khoảng trắng giữa các đoạn',
      'CTA đặt cuối email, nổi bật',
      'Có thể dùng bullet points cho lợi ích',
      'Subject line ≤ 50 ký tự',
    ],
  },

  variables: [
    {
      name: 'emailType',
      description: 'Loại email (chào bán, nuôi dưỡng, thông báo)',
      required: false,
    },
    {
      name: 'topic',
      description: 'Chủ đề hoặc sản phẩm chính',
      required: true,
    },
    {
      name: 'audience',
      description: 'Người nhận email',
      required: false,
    },
    {
      name: 'goal',
      description: 'Mục tiêu (mở mail, click, mua, phản hồi)',
      required: false,
    },
  ],

  examples: [
    {
      scenario: 'Preview mini – Email marketing (siêu ngắn)',
      output: `**Subject:**
Còn 24h – bạn quyết định chưa?

**Email Body:**
Ưu đãi 40% kết thúc tối nay. Chỉ còn 12 slot.

**Call-to-Action:**
Reply "GIỮ CHỖ" ngay!`,
    },
    {
      scenario: 'Preview mini – Email marketing tiêu chuẩn',
      output: `**Subject:**
Bạn đã thử cách này chưa?

**Preview Text:**
3 phút đọc, tiết kiệm 3 giờ mỗi tuần

**Email Body:**
Chào bạn,

Tuần trước mình phát hiện 1 cách đơn giản giúp tiết kiệm 3 giờ/tuần.
Không cần tool phức tạp. Chỉ cần thay đổi 1 thói quen nhỏ.

**Call-to-Action:**
Reply "CÁCH" để mình gửi chi tiết nhé!`,
    },
    {
      scenario: 'Email chào bán khóa học online về content marketing',
      output: `**Subject:**
Viết content mà không ai đọc? Đây là lý do

**Preview Text:**
1 sai lầm 90% người viết content mắc phải

**Email Body:**
Chào bạn,

Mình từng viết 50 bài blog mà chẳng ai đọc.

Không phải vì nội dung dở. Mà vì mình viết những gì MÌNH muốn nói, thay vì những gì NGƯỜI ĐỌC cần nghe.

Sau khi học được framework "Reader-First", traffic blog mình tăng 300% trong 3 tháng.

Mình đã đúc kết tất cả vào khóa học "Content That Converts" - mở đăng ký từ thứ 2 tuần sau.

Trong khóa học, bạn sẽ học:
- Cách tìm chủ đề người đọc thực sự quan tâm
- Framework viết bài chuẩn SEO trong 2 giờ
- Công thức headline tăng click rate 2x

Early bird giảm 40% cho 50 người đầu tiên.

**Call-to-Action:**
👉 Đăng ký nhận thông báo sớm tại đây: [link]

P.S. Reply email này nếu bạn có câu hỏi gì, mình sẽ trả lời trực tiếp.`,
    },
  ],

  attribution: {
    showInUI: true,
    customLabel: 'Email Marketing Engine',
  },
};
