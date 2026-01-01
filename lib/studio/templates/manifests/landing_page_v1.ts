// ============================================
// Landing Page Template Manifest
// ============================================
// High-conversion landing page copy
// Version: 1.0.0

import type { TemplateManifest } from '../templateManifest';

export const landingPageManifest: TemplateManifest = {
  id: 'landing_page_v1',
  name: 'Landing Page',
  version: '1.0.0',
  description: 'Viết landing page chuyển đổi cao, rõ lợi ích, dẫn dắt hành động.',

  objective: `You are a conversion copywriter who writes high-converting landing pages.
One page = one goal. Focus on conversion.
Clear value proposition, social proof, and strong CTA.
Write for scanning readers, not long reading.`,

  outputSpec: {
    format: 'labeled sections',
    sections: [
      {
        name: 'Hero Headline',
        required: true,
        description: 'Tiêu đề chính, rõ lợi ích lớn nhất',
      },
      {
        name: 'Sub-headline',
        required: true,
        description: 'Bổ sung ngắn gọn, làm rõ giá trị',
      },
      {
        name: 'Key Benefits',
        required: true,
        description: '3–5 lợi ích chính, dạng bullet',
      },
      {
        name: 'Social Proof',
        required: false,
        description: 'Testimonial hoặc số liệu tin cậy',
      },
      {
        name: 'Offer / CTA',
        required: true,
        description: 'Đề xuất + nút hành động rõ ràng',
      },
    ],
  },

  constraints: {
    must: [
      '1 mục tiêu chuyển đổi duy nhất',
      'Viết để người đọc lướt vẫn hiểu',
      'CTA rõ ràng, cụ thể',
      'Lợi ích trước, tính năng sau',
    ],
    avoid: [
      'Văn dài như blog',
      'Giải thích lan man',
      'Nhiều CTA khác nhau',
      'Thuật ngữ chuyên môn khó hiểu',
    ],
  },

  style: {
    description: 'Rõ ràng, trực diện, hướng hành động. Ngắn, mạnh, dễ quét.',
    formatting: [
      'Headline ngắn, impact cao',
      'Bullet points cho benefits',
      'CTA nổi bật, action-oriented',
      'Khoảng trắng nhiều, dễ đọc',
    ],
  },

  variables: [
    {
      name: 'product',
      description: 'Sản phẩm/dịch vụ cần landing page',
      required: true,
    },
    {
      name: 'targetAudience',
      description: 'Đối tượng mục tiêu',
      required: false,
    },
    {
      name: 'mainBenefit',
      description: 'Lợi ích chính muốn nhấn mạnh',
      required: false,
    },
    {
      name: 'offer',
      description: 'Ưu đãi hoặc đề xuất giá trị',
      required: false,
    },
  ],

  examples: [
    {
      scenario: 'Preview mini – Landing page (siêu ngắn)',
      output: `**Hero Headline:**
Tăng doanh số 3x trong 30 ngày

**Sub-headline:**
Không cần thuê thêm người. Không cần chạy ads.

**Key Benefits:**
• Tự động hóa 80% công việc lặp
• Tiết kiệm 15 giờ/tuần
• ROI dương từ tháng đầu

**Offer / CTA:**
👉 Dùng thử miễn phí 14 ngày`,
    },
    {
      scenario: 'Landing page cho khóa học viết content',
      output: `**Hero Headline:**
Viết Content Bán Hàng Trong 2 Giờ/Ngày

**Sub-headline:**
Framework đã giúp 500+ học viên tăng 200% engagement mà không cần "năng khiếu viết"

**Key Benefits:**
• Hệ thống template sẵn cho 7 loại content phổ biến
• Từ 0 ý tưởng → bài viết hoàn chỉnh trong 45 phút
• Áp dụng ngay cho Facebook, TikTok, Blog, Email
• Không cần kinh nghiệm viết lách trước đó
• Hỗ trợ 1-1 trong 30 ngày đầu

**Social Proof:**
"Trước khi học, mình mất 4 tiếng để viết 1 bài. Giờ chỉ cần 1 tiếng, engagement còn cao hơn gấp 3." – Minh Anh, chủ shop thời trang

Đã có 523 học viên hoàn thành khóa học với rating 4.8/5

**Offer / CTA:**
🎁 Ưu đãi Early Bird: Giảm 40% cho 50 người đầu tiên
👉 Đăng ký ngay – Chỉ còn 12 slot

Bắt đầu viết content bán được hàng từ tuần sau.`,
    },
  ],

  attribution: {
    showInUI: true,
    customLabel: 'Landing Page Engine',
  },
};
