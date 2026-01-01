// ============================================
// Reel Caption Template Manifest
// ============================================
// Ultra-short captions for Reels/TikTok
// Version: 1.0.0

import type { TemplateManifest } from '../templateManifest';

export const reelCaptionManifest: TemplateManifest = {
  id: 'reel_caption_v1',
  name: 'Reel Caption',
  version: '1.0.0',
  description: 'Viết caption cực ngắn cho Reels/TikTok, hỗ trợ video, tăng tương tác.',

  objective: `You write ultra-short captions for Reels and TikTok.
This caption does NOT stand alone – it supports the video.
Short – punchy – engagement-driven.
Read time: 3–5 seconds max.`,

  outputSpec: {
    format: 'labeled sections',
    sections: [
      {
        name: 'Hook Line',
        required: true,
        description: '1 dòng gây tò mò, dừng lướt',
      },
      {
        name: 'Context Line',
        required: false,
        description: '1 dòng bổ sung ngữ cảnh',
      },
      {
        name: 'Engagement CTA',
        required: true,
        description: 'Kêu gọi comment/save/share',
      },
    ],
  },

  constraints: {
    must: [
      'Rất ngắn (1–4 dòng tổng)',
      'Đọc trong 3–5 giây',
      'Bổ trợ video, không thay thế',
      'CTA kích tương tác cụ thể',
    ],
    avoid: [
      'Kể chuyện dài',
      'Lặp nội dung video',
      'Caption dài hơn video',
      'CTA mơ hồ',
    ],
  },

  style: {
    description: 'Punchy, casual, kích tương tác. Như đang nói chuyện với bạn.',
    formatting: [
      'Tối đa 4 dòng',
      'Emoji có chọn lọc',
      'CTA rõ ràng (comment X, save nếu Y)',
      'Không hashtag trong caption chính',
    ],
  },

  variables: [
    {
      name: 'videoTopic',
      description: 'Chủ đề video',
      required: true,
    },
    {
      name: 'vibe',
      description: 'Tone/mood (hài, flex, chia sẻ, review)',
      required: false,
    },
    {
      name: 'engagementGoal',
      description: 'Mục tiêu tương tác (comment, save, share)',
      required: false,
    },
  ],

  examples: [
    {
      scenario: 'Preview mini – Reel caption (siêu ngắn)',
      output: `**Hook Line:**
POV: Bạn order "size M" trên Shopee

**Engagement CTA:**
Comment "ĐÚNG" nếu bạn cũng bị 😭`,
    },
    {
      scenario: 'Reel caption cho video review quán cafe mới',
      output: `**Hook Line:**
Quán này mở 1 tuần mà đã viral rồi ☕

**Context Line:**
View đẹp + đồ uống ngon + giá sinh viên

**Engagement CTA:**
Save lại đi chơi cuối tuần nha!

---

**Hook Line:**
Tìm được quán cafe sống ảo cực đỉnh 📸

**Context Line:**
Giá chỉ 35k, ngồi cả ngày không đuổi

**Engagement CTA:**
Comment "Ở ĐÂU" để mình gửi địa chỉ!

---

**Hook Line:**
Cafe này có gì mà ai cũng check-in?

**Engagement CTA:**
Follow để mình review thêm quán hot nhé!`,
    },
  ],

  attribution: {
    showInUI: true,
    customLabel: 'Reel Caption Engine',
  },
};
