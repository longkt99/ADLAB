// ============================================
// Studio Use Cases Configuration
// ============================================

import type { UseCase } from '@/types/studio';

/**
 * Available use cases for Studio chat
 * These help users start conversations with purpose and context
 */
export const STUDIO_USE_CASES: UseCase[] = [
  {
    id: 'content_ideas',
    title: 'Ý tưởng nội dung',
    description: 'Gợi ý danh sách ý tưởng nội dung cho thương hiệu hoặc chủ đề.',
    icon: '💡',
    placeholder: 'VD: Gợi ý 10 ý tưởng bài viết về Tà Xùa cho Gen Z…',
    color: 'purple',
    category: 'content',
  },
  {
    id: 'brand_tone_rewrite',
    title: 'Viết lại theo tone thương hiệu',
    description: 'Dán đoạn văn bản và AI sẽ viết lại theo tone thương hiệu bạn chọn.',
    icon: '✍️',
    placeholder: 'VD: Dán đoạn text cần viết lại theo tone thương hiệu…',
    color: 'blue',
    category: 'content',
  },
  {
    id: 'social_caption_optimize',
    title: 'Tối ưu caption mạng xã hội',
    description: 'Tối ưu caption cho Facebook / Instagram / TikTok với hook & CTA phù hợp.',
    icon: '📱',
    placeholder: 'VD: Tối ưu caption này cho TikTok, giữ vibe gần gũi…',
    color: 'green',
    category: 'content',
  },
  {
    id: 'hashtag_strategy',
    title: 'Chiến lược hashtag',
    description: 'Gợi ý hashtag phù hợp cho từng nền tảng mạng xã hội.',
    icon: '#️⃣',
    placeholder: 'VD: Gợi ý hashtag cho bài viết về du lịch Đà Lạt trên Instagram…',
    color: 'orange',
    category: 'strategy',
  },
];

/**
 * Get a use case by its ID
 */
export function getUseCaseById(id: string): UseCase | undefined {
  return STUDIO_USE_CASES.find((useCase) => useCase.id === id);
}

/**
 * Get the default placeholder when no use case is selected
 */
export function getDefaultPlaceholder(): string {
  return 'Mô tả nội dung bạn muốn tạo, hoặc chọn một trường hợp sử dụng bên trên…';
}
