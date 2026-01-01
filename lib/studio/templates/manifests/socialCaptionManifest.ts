// ============================================
// Social Caption Template Manifest
// ============================================
// Instagram/Facebook/TikTok caption generation
// Version: 1.0.0

import type { TemplateManifest } from '../templateManifest';

export const socialCaptionManifest: TemplateManifest = {
  id: 'social_caption_v1',
  name: 'Social Media Caption',
  version: '1.0.0',
  description: 'Tạo caption hấp dẫn cho mạng xã hội (Instagram, Facebook, TikTok) với hook mạnh và CTA rõ ràng',

  objective: `You are a social media content specialist.
Your task is to create engaging, scroll-stopping captions optimized for social platforms.
Focus on hook strength, emotional resonance, and clear calls-to-action.`,

  outputSpec: {
    format: 'labeled sections',
    sections: [
      {
        name: 'Hook',
        required: true,
        description: '1–2 câu dừng lướt',
      },
      {
        name: 'Body',
        required: true,
        description: '2–4 đoạn ngắn, xuống dòng để dễ đọc',
      },
      {
        name: 'Call-to-Action',
        required: true,
        description: '1 câu kêu gọi hành động cụ thể',
      },
      {
        name: 'Hashtags',
        required: false,
        description: '3–10 hashtag liên quan',
      },
    ],
  },

  constraints: {
    must: [
      'Start with a strong hook that creates curiosity or emotion',
      'Use line breaks for readability (no walls of text)',
      'Include emoji strategically (not excessively)',
      'Make the CTA specific and actionable',
      'Match the platform\'s typical content style',
    ],
    avoid: [
      'Generic opening lines like "Hey guys!" or "Check this out"',
      'Overly salesy language that triggers spam filters',
      'Using more than 3 emojis in a single line',
      'Hashtag stuffing (keep it relevant and targeted)',
      'Copying exact phrases from the user\'s input without transformation',
    ],
    maxLength: 'Ideal: 150-300 words for Instagram, 100-200 for Facebook/TikTok',
  },

  style: {
    description: 'Conversational, authentic, and platform-native. Write like a human, not a brand.',
    formatting: [
      'Use single line breaks between sentences for mobile readability',
      'Place emojis at the START of paragraphs or END of sentences (not mid-sentence)',
      'Keep paragraphs to 2-3 lines max',
      'Use ALL CAPS sparingly (only for 1-2 words for emphasis)',
      'Hashtags go at the END, separated by line breaks',
    ],
  },

  variables: [
    {
      name: 'platform',
      description: 'Target platform (instagram, facebook, tiktok)',
      required: false,
    },
    {
      name: 'topic',
      description: 'Main topic or theme of the post',
      required: true,
    },
    {
      name: 'audience',
      description: 'Target audience description',
      required: false,
    },
    {
      name: 'goal',
      description: 'Post goal (engagement, awareness, conversion)',
      required: false,
    },
  ],

  examples: [
    {
      scenario: 'Preview mini – Social caption tiêu chuẩn',
      output: `**Hook:**
Sáng nay bạn đã uống cafe chưa? ☕

**Body:**
Một ly cafe đúng điệu có thể thay đổi cả ngày của bạn.
Không phải vì caffeine, mà vì khoảnh khắc yên tĩnh trước khi bắt đầu công việc.

**Call-to-Action:**
Tag người bạn luôn hẹn cafe cùng bạn! 👇

**Hashtags:**
#MorningCoffee #CafeVietNam #CoffeeLover #SaigonCafe`,
    },
    {
      scenario: 'Instagram post about a coffee shop opening',
      output: `**Hook:**
Cà phê phin sữa đá lúc 3h chiều. Bạn nghĩ gì? ☕️

**Body:**
Mình từng nghĩ uống cà phê buổi chiều = mất ngủ đêm.

Cho đến khi phát hiện Nhà Hàng Xưa dùng hạt Arabica rang vừa, vị đắng nhẹ, ngọt hậu tự nhiên. Uống xong vẫn ngon giấc như thường.

Không phải cà phê nào cũng gây mất ngủ. Chỉ là bạn chưa gặp đúng hạt thôi.

**Call-to-Action:**
📍 Ghé thử 1 lần, inbox mình nếu không ngon nhé!

**Hashtags:**
#CaPhePhin #CaPheSaiGon #QuanCaPheVintage #CoffeeLovers #SaigonCafe`,
    },
  ],

  attribution: {
    showInUI: true,
    customLabel: 'Social Caption Engine',
  },
};
