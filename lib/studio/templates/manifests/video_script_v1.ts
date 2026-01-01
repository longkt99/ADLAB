// ============================================
// Video Script Template Manifest
// ============================================
// TikTok/Reels/Shorts video script generation
// Version: 1.0.0

import type { TemplateManifest } from '../templateManifest';

export const videoScriptManifest: TemplateManifest = {
  id: 'video_script_v1',
  name: 'Short-form Video Script',
  version: '1.0.0',
  description: 'Viết kịch bản video ngắn cho TikTok / Reels / Shorts với hook mạnh, nhịp nhanh, CTA rõ',

  objective: `You are a short-form video content creator specializing in TikTok, Instagram Reels, and YouTube Shorts.
Your task is to write engaging vertical video scripts optimized for retention, with strong hooks in the first 3 seconds.
Focus on spoken language, quick cuts, and platform-native storytelling.`,

  outputSpec: {
    format: 'labeled sections',
    sections: [
      {
        name: 'Hook (0–3s)',
        required: true,
        description: '1 câu + text trên màn hình (dừng lướt ngay)',
      },
      {
        name: 'Main Content',
        required: true,
        description: '3–7 beat, mỗi beat 1 hành động/cảnh',
      },
      {
        name: 'Call-to-Action',
        required: true,
        description: 'Kêu gọi follow/comment/click rõ ràng',
      },
    ],
  },

  constraints: {
    must: [
      'Viết như lời nói tự nhiên (spoken language), không phải văn viết',
      'Hook trong 3 giây đầu phải gây shock/curiosity/emotion',
      'Nhịp nhanh, câu ngắn, dễ nghe và dễ nhớ',
      'Chia rõ từng beat/cảnh với hành động hoặc chuyển cảnh cụ thể',
      'CTA rõ ràng và dễ thực hiện ngay',
    ],
    avoid: [
      'Văn viết dài dòng, câu phức tạp khó đọc',
      'Giải thích lan man, mất nhịp video',
      'Thuật ngữ học thuật hoặc từ ngữ cứng nhắc',
      'Hook yếu như "Hôm nay mình sẽ..." hoặc "Bạn có biết..."',
      'Quá nhiều thông tin trong một cảnh (information overload)',
    ],
    maxLength: 'Optimal: 30-60 seconds (TikTok/Reels), 15-30 seconds (Shorts)',
  },

  style: {
    description: 'Creator-style, energetic, platform-native. Viết như đang nói chuyện trực tiếp với người xem.',
    formatting: [
      'Mỗi dòng = một câu nói hoặc một hành động (short lines)',
      'Chia theo beat/cảnh rõ ràng (Scene 1, Beat 1, etc.)',
      'Có thể thêm chỉ dẫn: [Pause], [Cut to], [On-screen text: ...]',
      'Sử dụng emoji tiết kiệm để đánh dấu cảm xúc/hành động',
      'Viết hướng dẫn hành động cho creator: [Zoom in], [Show product], etc.',
    ],
  },

  variables: [
    {
      name: 'platform',
      description: 'Platform đích (tiktok, reels, shorts)',
      required: false,
    },
    {
      name: 'topic',
      description: 'Chủ đề hoặc sản phẩm cần quảng bá',
      required: true,
    },
    {
      name: 'audience',
      description: 'Đối tượng người xem',
      required: false,
    },
    {
      name: 'goal',
      description: 'Mục tiêu video (hook, follow, click, sell)',
      required: false,
    },
  ],

  examples: [
    {
      scenario: 'Preview mini – Video script tiêu chuẩn',
      output: `**Hook (0-3s):**
Bạn đang uống sai cafe! ☕

**Main Content:**
- Beat 1: Hầu hết người Việt cho sữa trước, cafe sau
- Beat 2: Nhưng barista chuyên nghiệp làm ngược lại
- Beat 3: Cafe trước → Sữa sau → Vị ngon gấp đôi

**Call-to-Action:**
Thử ngay hôm nay và tag mình kết quả nhé! 👇`,
    },
    {
      scenario: 'TikTok video promoting a new coffee shop in Saigon',
      output: `**Hook (0-3s):**
[Cầm ly cafe] Quán cafe này MIỄN PHÍ refill? 😱

**Main Content:**

**Scene 1 (0-3s):**
[Show storefront]
Mới phát hiện quán cafe ở Q1...

**Scene 2 (3-8s):**
[Show menu board]
Gọi 1 ly Bạc Xỉu size M chỉ 35k.
Uống hết? Refill FREE.

**Scene 3 (8-15s):**
[Taste test reaction]
Mình thử rồi. Vị cafe phin truyền thống, sữa đặc ngọt vừa.
[Cut to: refill scene]
Refill lần 2 vẫn ngon như lần đầu.

**Scene 4 (15-20s):**
[Show cozy interior]
Không gian vintage, góc sống ảo xịn.
Wifi nhanh, có ổ cắm.

**Scene 5 (20-25s):**
[Final shot with cafe cup]
Địa chỉ: 123 Nguyễn Huệ, Q1.
Mở cửa từ 7h sáng đến 11h đêm.

**Call-to-Action (25-30s):**
Save video này để đi cuối tuần nhé! ❤️
Comment "CAFE" nếu bạn thích uống refill! 👇

[On-screen text: "Q1 • Refill FREE • 35k"]`,
    },
  ],

  attribution: {
    showInUI: true,
    customLabel: 'Video Script Engine',
  },
};
