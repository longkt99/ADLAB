// ============================================
// Product Description Template Manifest
// ============================================
// E-commerce product copy
// Version: 1.0.0

import type { TemplateManifest } from '../templateManifest';

export const productDescriptionManifest: TemplateManifest = {
  id: 'product_description_v1',
  name: 'Product Description',
  version: '1.0.0',
  description: 'Viết mô tả sản phẩm rõ lợi ích, dễ bán, phù hợp web hoặc sàn TMĐT.',

  objective: `You write product descriptions that sell.
Help users understand:
- Sản phẩm là gì
- Giải quyết vấn đề gì
- Vì sao nên mua
Benefits first, features second.`,

  outputSpec: {
    format: 'labeled sections',
    sections: [
      {
        name: 'Product Title',
        required: true,
        description: 'Tên sản phẩm rõ ràng, có từ khóa',
      },
      {
        name: 'Key Benefits',
        required: true,
        description: '3–5 lợi ích chính, bullet ngắn',
      },
      {
        name: 'Features / Specs',
        required: false,
        description: 'Thông số kỹ thuật nếu cần',
      },
      {
        name: 'Usage / Who is it for',
        required: false,
        description: 'Ai nên dùng, dùng khi nào',
      },
      {
        name: 'Call-to-Action',
        required: true,
        description: 'Kêu gọi mua/đặt hàng',
      },
    ],
  },

  constraints: {
    must: [
      'Lợi ích trước, tính năng sau',
      'Ngắn gọn, dễ quét',
      'Viết cho người mua, không phải chuyên gia',
      'CTA rõ ràng',
    ],
    avoid: [
      'Văn quảng cáo sáo rỗng',
      'Thuật ngữ khó hiểu',
      'Liệt kê specs không có context',
      'Văn quá dài, khó đọc trên mobile',
    ],
  },

  style: {
    description: 'Thân thiện, dễ hiểu, hướng lợi ích. Như đang tư vấn cho bạn bè.',
    formatting: [
      'Bullet points cho benefits',
      'Đoạn ngắn, dễ quét',
      'Highlight từ khóa quan trọng',
      'CTA cuối cùng, rõ ràng',
    ],
  },

  variables: [
    {
      name: 'productName',
      description: 'Tên sản phẩm',
      required: true,
    },
    {
      name: 'category',
      description: 'Danh mục sản phẩm',
      required: false,
    },
    {
      name: 'targetCustomer',
      description: 'Khách hàng mục tiêu',
      required: false,
    },
    {
      name: 'keyFeatures',
      description: 'Tính năng/thông số chính',
      required: false,
    },
  ],

  examples: [
    {
      scenario: 'Preview mini – Product description (siêu ngắn)',
      output: `**Product Title:**
Bình Giữ Nhiệt Inox 500ml

**Key Benefits:**
• Giữ nóng 12h, giữ lạnh 24h
• Không BPA, an toàn cho sức khỏe
• Nhẹ chỉ 280g, bỏ túi dễ dàng

**Call-to-Action:**
🛒 Mua ngay – Freeship đơn từ 99k`,
    },
    {
      scenario: 'Mô tả sản phẩm tai nghe không dây cho Shopee',
      output: `**Product Title:**
Tai Nghe Bluetooth TWS Pro – Chống Ồn Chủ Động, Pin 30 Giờ

**Key Benefits:**
• Chống ồn ANC: Tập trung 100% khi làm việc hoặc nghe nhạc
• Pin 30 giờ (6h tai nghe + 24h case): Dùng cả tuần không lo hết pin
• Kết nối nhanh 2 giây: Mở nắp là tự động kết nối
• Chống nước IPX5: Thoải mái đeo khi tập gym hoặc chạy bộ
• Mic HD: Đàm thoại rõ ràng, không bị ồn

**Features / Specs:**
- Driver 10mm, âm bass sâu
- Bluetooth 5.3, kết nối ổn định 15m
- Trọng lượng: 4.5g/tai
- Sạc nhanh: 10 phút = 2 giờ nghe

**Usage / Who is it for:**
✓ Dân văn phòng cần tập trung
✓ Người hay di chuyển, đi công tác
✓ Gym-er, runner cần tai nghe chống nước
✓ Ai muốn nâng cấp từ tai nghe dây

**Call-to-Action:**
🎧 Đặt hàng ngay – Bảo hành 12 tháng 1 đổi 1
💬 Inbox để được tư vấn size phù hợp`,
    },
  ],

  attribution: {
    showInUI: true,
    customLabel: 'Product Description Engine',
  },
};
