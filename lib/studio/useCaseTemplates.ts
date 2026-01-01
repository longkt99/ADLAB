// ============================================
// Use Case Templates
// ============================================

import type { UseCase } from '@/types/studio';

export const USE_CASES: UseCase[] = [
  {
    id: 'strategic-content',
    title: 'Ý tưởng Nội dung Chiến lược',
    description: 'Tạo chiến lược nội dung tối ưu cho nền tảng và đối tượng của bạn',
    icon: '💡',
    prompt: `Help me create a 30-day content strategy for [platform]. My audience is [describe your target audience], and my goals are [describe your content goals].

Please suggest:
- Content themes and topics
- Posting frequency and timing
- Content formats (video, carousel, stories, etc.)
- Engagement strategies`,
    color: 'blue',
    category: 'strategy',
  },
  {
    id: 'tour-discovery',
    title: 'Trợ lý Khám phá Tour',
    description: 'Lên kế hoạch trải nghiệm tour hấp dẫn cho khách hàng của bạn',
    icon: '🗺️',
    prompt: `I want to create a tour experience for [location/theme]. My target audience is [describe your audience], and the tour should highlight [key features or attractions].

Please help me with:
- Itinerary structure and timeline
- Key stops and experiences
- Storytelling elements
- Audience engagement ideas`,
    color: 'purple',
    category: 'tour',
  },
];

// Helper to get use case by ID
export const getUseCaseById = (id: string): UseCase | undefined => {
  return USE_CASES.find((uc) => uc.id === id);
};

// Helper to get use cases by category
export const getUseCasesByCategory = (
  category: 'strategy' | 'tour' | 'content'
): UseCase[] => {
  return USE_CASES.filter((uc) => uc.category === category);
};
