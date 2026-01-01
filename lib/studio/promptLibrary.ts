// ============================================
// Prompt Library - 1-Click Prompts System
// ============================================
// Complete library of prompt cards for quick content creation.
// Organized by category with featured cards for initial display.
//
// STRUCTURE:
// - 50+ prompt cards across 7 categories
// - 8 featured cards shown by default
// - Each card maps to a templateId for AI generation
// ============================================

export type PromptCategory =
  | 'social'
  | 'sales'
  | 'email'
  | 'seo'
  | 'video'
  | 'brand'
  | 'strategy';

export interface PromptCardData {
  id: string;
  title: string;
  description: string;
  category: PromptCategory;
  platform?: string;
  templateId: string;
  defaultToneId?: string;
  topicPlaceholder: string;
}

// ============================================
// Category Labels (Vietnamese)
// ============================================
export const CATEGORY_LABELS: Record<PromptCategory, string> = {
  social: 'Mạng xã hội',
  sales: 'Bán hàng',
  email: 'Email',
  seo: 'SEO',
  video: 'Video',
  brand: 'Thương hiệu',
  strategy: 'Chiến lược',
};


// ============================================
// Featured Card IDs (8 cards shown by default)
// ============================================
export const FEATURED_IDS: string[] = [
  'ig_caption',
  'fb_post',
  'product_desc',
  'email_promo',
  'tiktok_script',
  'blog_intro',
  'brand_tagline',
  'content_calendar',
];

// ============================================
// Complete Prompt Library (50+ cards)
// ============================================
export const PROMPT_CARDS: PromptCardData[] = [
  // ──────────────────────────────────────────
  // SOCIAL MEDIA (12 cards)
  // ──────────────────────────────────────────
  {
    id: 'ig_caption',
    title: 'Caption Instagram',
    description: 'Bài đăng hấp dẫn, tối ưu hashtag',
    category: 'social',
    platform: 'Instagram',
    templateId: 'social_caption_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Quán cà phê mới mở, phong cách vintage, nhắm khách 20-30 tuổi...',
  },
  {
    id: 'fb_post',
    title: 'Bài Facebook',
    description: 'Thu hút tương tác và bình luận',
    category: 'social',
    platform: 'Facebook',
    templateId: 'social_caption_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Ra mắt sản phẩm mới, muốn khách comment hỏi giá...',
  },
  {
    id: 'linkedin_post',
    title: 'Bài LinkedIn',
    description: 'Chuyên nghiệp, xây dựng uy tín',
    category: 'social',
    platform: 'LinkedIn',
    templateId: 'social_caption_v1',
    defaultToneId: 'professional',
    topicPlaceholder: 'VD: Chia sẻ kinh nghiệm khởi nghiệp, bài học thất bại...',
  },
  {
    id: 'twitter_thread',
    title: 'Thread Twitter/X',
    description: 'Chuỗi tweet hấp dẫn, viral',
    category: 'social',
    platform: 'Twitter/X',
    templateId: 'social_caption_v1',
    defaultToneId: 'minimal',
    topicPlaceholder: 'VD: 10 bài học từ việc xây dựng startup trong 5 năm...',
  },
  {
    id: 'ig_story_ideas',
    title: 'Ý tưởng Story',
    description: 'Gợi ý nội dung Stories hàng ngày',
    category: 'social',
    platform: 'Instagram',
    templateId: 'social_caption_v1',
    defaultToneId: 'playful',
    topicPlaceholder: 'VD: Quán cafe, muốn có 7 ý tưởng story cho tuần...',
  },
  {
    id: 'ig_carousel',
    title: 'Caption Carousel',
    description: 'Mô tả cho bài đăng nhiều hình',
    category: 'social',
    platform: 'Instagram',
    templateId: 'social_caption_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Carousel 5 slide về tips skincare, nhắm đến phụ nữ 25-35...',
  },
  {
    id: 'tiktok_caption',
    title: 'Caption TikTok',
    description: 'Ngắn gọn, bắt trend',
    category: 'social',
    platform: 'TikTok',
    templateId: 'social_caption_v1',
    defaultToneId: 'playful',
    topicPlaceholder: 'VD: Video review đồ ăn, muốn caption viral...',
  },
  {
    id: 'social_cta',
    title: 'CTA Mạng xã hội',
    description: 'Kêu gọi hành động hiệu quả',
    category: 'social',
    templateId: 'social_caption_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Muốn khách đăng ký workshop, giới hạn 20 slot...',
  },
  {
    id: 'hashtag_strategy',
    title: 'Chiến lược Hashtag',
    description: 'Bộ hashtag tối ưu theo niche',
    category: 'social',
    platform: 'Instagram',
    templateId: 'social_caption_v1',
    topicPlaceholder: 'VD: Niche thời trang sustainable, target Gen Z...',
  },
  {
    id: 'engagement_questions',
    title: 'Câu hỏi tương tác',
    description: 'Câu hỏi tạo comment và thảo luận',
    category: 'social',
    templateId: 'social_caption_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Page về du lịch, muốn hỏi về trải nghiệm của followers...',
  },
  {
    id: 'social_bio',
    title: 'Bio Profile',
    description: 'Bio hấp dẫn cho mạng xã hội',
    category: 'social',
    templateId: 'social_caption_v1',
    defaultToneId: 'minimal',
    topicPlaceholder: 'VD: Freelance designer, chuyên branding, có 5 năm kinh nghiệm...',
  },
  {
    id: 'community_post',
    title: 'Bài Community',
    description: 'Nội dung cho group/community',
    category: 'social',
    platform: 'Facebook',
    templateId: 'social_caption_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Group về marketing, chia sẻ case study thành công...',
  },

  // ──────────────────────────────────────────
  // BÁN HÀNG (10 cards)
  // ──────────────────────────────────────────
  {
    id: 'product_desc',
    title: 'Mô tả sản phẩm',
    description: 'Giới thiệu sản phẩm chuyển đổi cao',
    category: 'sales',
    platform: 'Website',
    templateId: 'product_description_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Túi xách da thật, phân khúc cao cấp, giá 2-3 triệu...',
  },
  {
    id: 'sales_cta',
    title: 'CTA Bán hàng',
    description: 'Kêu gọi mua hàng hiệu quả',
    category: 'sales',
    templateId: 'product_description_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Flash sale 50%, chỉ 24h, sản phẩm skincare...',
  },
  {
    id: 'landing_headline',
    title: 'Headline Landing Page',
    description: 'Tiêu đề thu hút trên landing page',
    category: 'sales',
    platform: 'Website',
    templateId: 'product_description_v1',
    defaultToneId: 'inspirational',
    topicPlaceholder: 'VD: Khóa học digital marketing, cam kết việc làm...',
  },
  {
    id: 'benefit_bullets',
    title: 'Lợi ích sản phẩm',
    description: 'Bullet points lợi ích rõ ràng',
    category: 'sales',
    templateId: 'product_description_v1',
    defaultToneId: 'minimal',
    topicPlaceholder: 'VD: App quản lý tài chính cá nhân, target nhân viên văn phòng...',
  },
  {
    id: 'testimonial_request',
    title: 'Xin đánh giá',
    description: 'Tin nhắn xin review từ khách hàng',
    category: 'sales',
    templateId: 'freeform_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Khách vừa mua khóa học online, muốn xin feedback...',
  },
  {
    id: 'upsell_message',
    title: 'Tin nhắn Upsell',
    description: 'Gợi ý sản phẩm bổ sung',
    category: 'sales',
    templateId: 'freeform_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Khách mua điện thoại, muốn upsell ốp lưng và cường lực...',
  },
  {
    id: 'scarcity_copy',
    title: 'Copy Khan hiếm',
    description: 'Tạo urgency cho khuyến mãi',
    category: 'sales',
    templateId: 'product_description_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Workshop offline, chỉ còn 5 slot cuối cùng...',
  },
  {
    id: 'comparison_copy',
    title: 'So sánh sản phẩm',
    description: 'So sánh với đối thủ/phiên bản cũ',
    category: 'sales',
    templateId: 'product_description_v1',
    defaultToneId: 'professional',
    topicPlaceholder: 'VD: Phiên bản Pro vs Basic của SaaS, highlight sự khác biệt...',
  },
  {
    id: 'guarantee_copy',
    title: 'Cam kết & Bảo hành',
    description: 'Copy về chính sách bảo đảm',
    category: 'sales',
    templateId: 'product_description_v1',
    defaultToneId: 'professional',
    topicPlaceholder: 'VD: Bảo hành 2 năm, đổi trả 30 ngày, hoàn tiền 100%...',
  },
  {
    id: 'bundle_offer',
    title: 'Combo/Bundle',
    description: 'Mô tả gói sản phẩm combo',
    category: 'sales',
    templateId: 'product_description_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Combo skincare 4 bước, tiết kiệm 30% so với mua lẻ...',
  },

  // ──────────────────────────────────────────
  // EMAIL (8 cards)
  // ──────────────────────────────────────────
  {
    id: 'email_promo',
    title: 'Email khuyến mãi',
    description: 'Email marketing ngắn gọn',
    category: 'email',
    platform: 'Email',
    templateId: 'email_promo_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Flash sale 50%, chỉ 24h, cho khách hàng cũ...',
  },
  {
    id: 'newsletter',
    title: 'Newsletter',
    description: 'Bản tin định kỳ giá trị',
    category: 'email',
    platform: 'Email',
    templateId: 'email_promo_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Newsletter tuần về marketing trends, 500 subscribers...',
  },
  {
    id: 'cold_outreach',
    title: 'Cold Email',
    description: 'Email tiếp cận khách hàng mới',
    category: 'email',
    platform: 'Email',
    templateId: 'email_promo_v1',
    defaultToneId: 'professional',
    topicPlaceholder: 'VD: Giới thiệu dịch vụ SEO cho các SME, B2B...',
  },
  {
    id: 'follow_up',
    title: 'Follow-up Email',
    description: 'Email nhắc nhở sau liên hệ',
    category: 'email',
    platform: 'Email',
    templateId: 'email_promo_v1',
    defaultToneId: 'professional',
    topicPlaceholder: 'VD: Follow-up sau meeting, gửi proposal...',
  },
  {
    id: 'welcome_email',
    title: 'Email Chào mừng',
    description: 'Email onboarding khách mới',
    category: 'email',
    platform: 'Email',
    templateId: 'email_promo_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Chào mừng thành viên mới join community...',
  },
  {
    id: 'cart_abandon',
    title: 'Email Giỏ hàng bỏ dở',
    description: 'Nhắc khách hoàn tất đơn hàng',
    category: 'email',
    platform: 'Email',
    templateId: 'email_promo_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Khách bỏ giỏ hàng với sản phẩm skincare...',
  },
  {
    id: 'reengagement',
    title: 'Email Kích hoạt lại',
    description: 'Thu hút khách lâu không tương tác',
    category: 'email',
    platform: 'Email',
    templateId: 'email_promo_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Khách 90 ngày không mở email, muốn win back...',
  },
  {
    id: 'thank_you_email',
    title: 'Email Cảm ơn',
    description: 'Cảm ơn sau mua hàng/sự kiện',
    category: 'email',
    platform: 'Email',
    templateId: 'email_promo_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Cảm ơn sau workshop, gửi tài liệu bổ sung...',
  },

  // ──────────────────────────────────────────
  // SEO (8 cards)
  // ──────────────────────────────────────────
  {
    id: 'blog_intro',
    title: 'Mở bài blog',
    description: 'Đoạn mở đầu bài viết SEO',
    category: 'seo',
    platform: 'Website',
    templateId: 'blog_intro_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Bài về cách chọn laptop cho sinh viên, từ khóa chính...',
  },
  {
    id: 'blog_outline',
    title: 'Dàn ý bài viết',
    description: 'Cấu trúc H2/H3 cho bài SEO',
    category: 'seo',
    platform: 'Website',
    templateId: 'blog_intro_v1',
    topicPlaceholder: 'VD: Bài 2000 từ về "cách đầu tư chứng khoán cho người mới"...',
  },
  {
    id: 'meta_description',
    title: 'Meta Description',
    description: 'Mô tả SEO cho trang web',
    category: 'seo',
    platform: 'Website',
    templateId: 'blog_intro_v1',
    defaultToneId: 'minimal',
    topicPlaceholder: 'VD: Trang sản phẩm máy pha cà phê, từ khóa "máy pha cafe"...',
  },
  {
    id: 'faq_section',
    title: 'Mục FAQ',
    description: 'Câu hỏi thường gặp cho SEO',
    category: 'seo',
    platform: 'Website',
    templateId: 'blog_intro_v1',
    topicPlaceholder: 'VD: FAQ cho trang dịch vụ thiết kế website...',
  },
  {
    id: 'pillar_content',
    title: 'Pillar Content',
    description: 'Nội dung trụ cột toàn diện',
    category: 'seo',
    platform: 'Website',
    templateId: 'blog_intro_v1',
    defaultToneId: 'academic',
    topicPlaceholder: 'VD: Hướng dẫn hoàn chỉnh về "content marketing" 3000+ từ...',
  },
  {
    id: 'local_seo',
    title: 'Nội dung Local SEO',
    description: 'Bài viết tối ưu địa phương',
    category: 'seo',
    platform: 'Website',
    templateId: 'blog_intro_v1',
    topicPlaceholder: 'VD: "Quán cà phê đẹp Quận 1" hoặc "Spa tốt nhất Đà Nẵng"...',
  },
  {
    id: 'product_seo',
    title: 'Mô tả sản phẩm SEO',
    description: 'Mô tả sản phẩm tối ưu SEO',
    category: 'seo',
    platform: 'Website',
    templateId: 'product_description_v1',
    topicPlaceholder: 'VD: Áo thun nam, từ khóa "áo thun nam cao cấp"...',
  },
  {
    id: 'category_desc',
    title: 'Mô tả danh mục',
    description: 'Giới thiệu danh mục sản phẩm',
    category: 'seo',
    platform: 'Website',
    templateId: 'blog_intro_v1',
    topicPlaceholder: 'VD: Danh mục "Đồng hồ nam" trên e-commerce...',
  },

  // ──────────────────────────────────────────
  // VIDEO (6 cards)
  // ──────────────────────────────────────────
  {
    id: 'tiktok_script',
    title: 'Script TikTok/Reels',
    description: 'Kịch bản video ngắn hook-story-CTA',
    category: 'video',
    platform: 'TikTok',
    templateId: 'video_script_v1',
    defaultToneId: 'playful',
    topicPlaceholder: 'VD: Review son mới, 30 giây, hook mạnh đầu video...',
  },
  {
    id: 'youtube_script',
    title: 'Script YouTube',
    description: 'Kịch bản video dài đầy đủ',
    category: 'video',
    platform: 'YouTube',
    templateId: 'video_script_v1',
    defaultToneId: 'storytelling',
    topicPlaceholder: 'VD: Video 10 phút về "Một ngày của freelancer"...',
  },
  {
    id: 'video_hook',
    title: 'Hook video',
    description: '3 giây đầu giữ chân người xem',
    category: 'video',
    platform: 'TikTok',
    templateId: 'video_script_v1',
    defaultToneId: 'playful',
    topicPlaceholder: 'VD: Video về tips tiết kiệm tiền, cần hook gây tò mò...',
  },
  {
    id: 'video_cta',
    title: 'CTA cuối video',
    description: 'Kêu gọi like/follow/mua hàng',
    category: 'video',
    templateId: 'video_script_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Muốn viewer subscribe kênh YouTube về nấu ăn...',
  },
  {
    id: 'yt_thumbnail_text',
    title: 'Text Thumbnail',
    description: 'Dòng chữ trên thumbnail YouTube',
    category: 'video',
    platform: 'YouTube',
    templateId: 'freeform_v1',
    defaultToneId: 'minimal',
    topicPlaceholder: 'VD: Video về "Sai lầm khi đầu tư crypto", cần text gây chú ý...',
  },
  {
    id: 'podcast_intro',
    title: 'Intro Podcast',
    description: 'Mở đầu episode podcast',
    category: 'video',
    platform: 'Podcast',
    templateId: 'video_script_v1',
    defaultToneId: 'conversational',
    topicPlaceholder: 'VD: Podcast về startup, episode về fundraising...',
  },

  // ──────────────────────────────────────────
  // THƯƠNG HIỆU (6 cards)
  // ──────────────────────────────────────────
  {
    id: 'brand_tagline',
    title: 'Tagline thương hiệu',
    description: 'Slogan ngắn gọn, đáng nhớ',
    category: 'brand',
    templateId: 'freeform_v1',
    defaultToneId: 'minimal',
    topicPlaceholder: 'VD: Startup edtech, giúp trẻ em học tiếng Anh qua game...',
  },
  {
    id: 'about_page',
    title: 'Trang About Us',
    description: 'Giới thiệu công ty/dự án',
    category: 'brand',
    platform: 'Website',
    templateId: 'freeform_v1',
    defaultToneId: 'storytelling',
    topicPlaceholder: 'VD: Agency thiết kế, 10 năm kinh nghiệm, 50+ nhân viên...',
  },
  {
    id: 'brand_story',
    title: 'Brand Story',
    description: 'Câu chuyện thương hiệu',
    category: 'brand',
    templateId: 'freeform_v1',
    defaultToneId: 'storytelling',
    topicPlaceholder: 'VD: Startup bắt đầu từ garage, giải quyết pain point cá nhân...',
  },
  {
    id: 'mission_vision',
    title: 'Sứ mệnh & Tầm nhìn',
    description: 'Mission/Vision statement',
    category: 'brand',
    templateId: 'freeform_v1',
    defaultToneId: 'inspirational',
    topicPlaceholder: 'VD: Công ty fintech, muốn democratize đầu tư...',
  },
  {
    id: 'brand_values',
    title: 'Giá trị cốt lõi',
    description: 'Core values của thương hiệu',
    category: 'brand',
    templateId: 'freeform_v1',
    defaultToneId: 'professional',
    topicPlaceholder: 'VD: Công ty công nghệ, đề cao innovation và transparency...',
  },
  {
    id: 'founder_bio',
    title: 'Bio Founder',
    description: 'Giới thiệu người sáng lập',
    category: 'brand',
    templateId: 'freeform_v1',
    defaultToneId: 'professional',
    topicPlaceholder: 'VD: CEO startup, background finance, 15 năm kinh nghiệm...',
  },

  // ──────────────────────────────────────────
  // CHIẾN LƯỢC (6 cards)
  // ──────────────────────────────────────────
  {
    id: 'content_calendar',
    title: 'Content Calendar',
    description: 'Lịch nội dung theo tuần/tháng',
    category: 'strategy',
    templateId: 'freeform_v1',
    topicPlaceholder: 'VD: Kế hoạch content Instagram 1 tháng cho thương hiệu thời trang...',
  },
  {
    id: 'content_pillars',
    title: 'Content Pillars',
    description: 'Các trụ nội dung chính',
    category: 'strategy',
    templateId: 'freeform_v1',
    topicPlaceholder: 'VD: Thương hiệu coffee, cần 4-5 pillars cho social media...',
  },
  {
    id: 'competitor_analysis',
    title: 'Phân tích đối thủ',
    description: 'So sánh content với competitor',
    category: 'strategy',
    templateId: 'freeform_v1',
    defaultToneId: 'professional',
    topicPlaceholder: 'VD: 3 đối thủ chính trong ngành F&B, phân tích social media...',
  },
  {
    id: 'positioning',
    title: 'Định vị thương hiệu',
    description: 'Brand positioning statement',
    category: 'strategy',
    templateId: 'freeform_v1',
    defaultToneId: 'professional',
    topicPlaceholder: 'VD: Thương hiệu mỹ phẩm organic, target phụ nữ 25-40...',
  },
  {
    id: 'campaign_brief',
    title: 'Campaign Brief',
    description: 'Brief chiến dịch marketing',
    category: 'strategy',
    templateId: 'freeform_v1',
    defaultToneId: 'professional',
    topicPlaceholder: 'VD: Chiến dịch Tết cho thương hiệu bánh kẹo...',
  },
  {
    id: 'audience_persona',
    title: 'Customer Persona',
    description: 'Chân dung khách hàng mục tiêu',
    category: 'strategy',
    templateId: 'freeform_v1',
    topicPlaceholder: 'VD: Khách hàng cho app học tiếng Anh, target người đi làm...',
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get featured cards (8 cards shown by default)
 */
export function getFeaturedCards(): PromptCardData[] {
  return PROMPT_CARDS.filter(card => FEATURED_IDS.includes(card.id));
}

/**
 * Get all cards by category
 */
export function getCardsByCategory(category: PromptCategory): PromptCardData[] {
  return PROMPT_CARDS.filter(card => card.category === category);
}

/**
 * Get card by ID
 */
export function getCardById(id: string): PromptCardData | undefined {
  return PROMPT_CARDS.find(card => card.id === id);
}

/**
 * Get all unique categories
 */
export function getCategories(): PromptCategory[] {
  return Object.keys(CATEGORY_LABELS) as PromptCategory[];
}
