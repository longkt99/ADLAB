// ============================================
// Quality Messages
// ============================================
// User-friendly messages for each quality rule
// All messages in Vietnamese, outcome-based language

/**
 * Message structure for each rule
 */
export interface RuleMessage {
  title: string;      // Short, user-friendly title
  suggestion: string; // Actionable fix suggestion
}

/**
 * User-friendly messages for each quality rule ID
 */
export const RULE_MESSAGES: Record<string, RuleMessage> = {
  // ============================================
  // Social Caption
  // ============================================
  social_structure_lock: {
    title: 'Thiếu phần bắt buộc',
    suggestion: 'Nội dung cần có đủ: Hook, Body, và CTA.',
  },
  social_max_sections: {
    title: 'Quá nhiều phần',
    suggestion: 'Caption chỉ nên có tối đa 4 phần. Hãy yêu cầu AI viết gọn hơn.',
  },
  social_no_meta_commentary: {
    title: 'Có lời giải thích thừa',
    suggestion: 'Nội dung không nên có câu như "Đây là bài viết..." Hãy thử lại.',
  },
  social_cta_not_generic: {
    title: 'CTA chưa cụ thể',
    suggestion: 'Thay "Tìm hiểu thêm" bằng hành động rõ ràng như "Comment địa chỉ bạn muốn".',
  },
  social_hook_length: {
    title: 'Hook hơi dài',
    suggestion: 'Hook nên ngắn gọn 1-2 câu để giữ chân người đọc.',
  },
  social_body_formatting: {
    title: 'Body khó đọc',
    suggestion: 'Chia thành nhiều đoạn ngắn, mỗi đoạn 2-3 dòng.',
  },
  social_sentence_length: {
    title: 'Câu quá dài',
    suggestion: 'Rút gọn câu dài để dễ đọc trên điện thoại.',
  },
  social_cta_action_verb: {
    title: 'CTA thiếu hành động',
    suggestion: 'CTA nên bắt đầu bằng động từ như "Comment", "Save", "Inbox".',
  },
  social_topic_keyword: {
    title: 'Thiếu từ khóa chủ đề',
    suggestion: 'Nội dung nên đề cập đến chủ đề chính trong Hook hoặc Body.',
  },

  // ============================================
  // SEO Blog
  // ============================================
  seo_structure_lock: {
    title: 'Thiếu phần bắt buộc',
    suggestion: 'Bài blog cần có: Title, Meta Description, Introduction, Main Content, và Conclusion.',
  },
  seo_no_meta_commentary: {
    title: 'Có lời giải thích thừa',
    suggestion: 'Bài viết không nên có câu mở đầu kiểu AI. Hãy thử lại.',
  },
  seo_title_length: {
    title: 'Tiêu đề chưa phù hợp',
    suggestion: 'Title nên dài 20-80 ký tự để hiển thị tốt trên Google.',
  },
  seo_meta_description_length: {
    title: 'Meta description chưa tối ưu',
    suggestion: 'Meta description nên dài 100-170 ký tự.',
  },
  seo_heading_structure: {
    title: 'Thiếu heading H2',
    suggestion: 'Bài viết nên có ít nhất 2 heading H2 để phân chia nội dung.',
  },

  // ============================================
  // Video Script
  // ============================================
  video_structure_lock: {
    title: 'Thiếu phần bắt buộc',
    suggestion: 'Script cần có: Hook (0-3s), Main Content (các beat/scene), và CTA.',
  },
  video_no_meta_commentary: {
    title: 'Có lời giải thích thừa',
    suggestion: 'Script không nên có câu mở đầu kiểu AI. Hãy thử lại.',
  },
  video_cta_not_generic: {
    title: 'CTA chưa cụ thể',
    suggestion: 'Thay "Xem thêm" bằng "Comment CAFE" hoặc "Follow để xem tiếp".',
  },
  video_beat_structure: {
    title: 'Thiếu cấu trúc beat',
    suggestion: 'Script nên có ít nhất 2 beat/scene để dễ quay.',
  },

  // ============================================
  // Email Marketing
  // ============================================
  email_structure_lock: {
    title: 'Thiếu phần bắt buộc',
    suggestion: 'Email cần có: Subject, Email Body, và CTA.',
  },
  email_no_meta_commentary: {
    title: 'Có lời giải thích thừa',
    suggestion: 'Email không nên có câu mở đầu kiểu AI. Hãy thử lại.',
  },
  email_subject_length: {
    title: 'Subject quá dài',
    suggestion: 'Subject nên dưới 60 ký tự để hiển thị đầy đủ trên inbox.',
  },
  email_cta_not_generic: {
    title: 'CTA chưa cụ thể',
    suggestion: 'Thay "Tìm hiểu thêm" bằng "Reply ĐĂNG KÝ" hoặc hành động cụ thể.',
  },
  email_body_length: {
    title: 'Email hơi dài/ngắn',
    suggestion: 'Email nên dài 50-350 từ để đọc nhanh trên điện thoại.',
  },

  // ============================================
  // Landing Page
  // ============================================
  landing_structure_lock: {
    title: 'Thiếu phần bắt buộc',
    suggestion: 'Landing page cần có: Hero Headline, Sub-headline, Key Benefits, và Offer/CTA.',
  },
  landing_no_meta_commentary: {
    title: 'Có lời giải thích thừa',
    suggestion: 'Nội dung không nên có câu mở đầu kiểu AI. Hãy thử lại.',
  },
  landing_benefits_format: {
    title: 'Thiếu bullet points',
    suggestion: 'Key Benefits cần có ít nhất 3 bullet points.',
  },
  landing_headline_length: {
    title: 'Headline chưa tối ưu',
    suggestion: 'Hero headline nên dài 10-80 ký tự để có impact cao.',
  },

  // ============================================
  // Product Description
  // ============================================
  product_structure_lock: {
    title: 'Thiếu phần bắt buộc',
    suggestion: 'Mô tả sản phẩm cần có: Product Title, Key Benefits, và CTA.',
  },
  product_no_meta_commentary: {
    title: 'Có lời giải thích thừa',
    suggestion: 'Mô tả không nên có câu mở đầu kiểu AI. Hãy thử lại.',
  },
  product_benefits_format: {
    title: 'Thiếu bullet points',
    suggestion: 'Key Benefits cần có ít nhất 2 bullet points.',
  },
  product_cta_action: {
    title: 'CTA thiếu hành động',
    suggestion: 'CTA nên có từ như "Mua ngay", "Đặt hàng", "Inbox".',
  },

  // ============================================
  // Reel Caption
  // ============================================
  reel_structure_lock: {
    title: 'Thiếu phần bắt buộc',
    suggestion: 'Caption cần có: Hook Line và Engagement CTA.',
  },
  reel_no_meta_commentary: {
    title: 'Có lời giải thích thừa',
    suggestion: 'Caption không nên có câu mở đầu kiểu AI. Hãy thử lại.',
  },
  reel_max_length: {
    title: 'Caption quá dài',
    suggestion: 'Reel caption nên đọc trong 3-5 giây. Hãy rút gọn.',
  },
  reel_cta_engagement: {
    title: 'CTA chưa kích tương tác',
    suggestion: 'CTA nên là "Comment X", "Save lại", "Tag bạn bè".',
  },
  reel_hook_length: {
    title: 'Hook chưa tối ưu',
    suggestion: 'Hook nên dài 10-100 ký tự để gây ấn tượng nhanh.',
  },
};

/**
 * Fallback message for unknown rules
 */
export const FALLBACK_MESSAGE: RuleMessage = {
  title: 'Có vấn đề với nội dung',
  suggestion: 'Hãy thử tạo lại với yêu cầu rõ ràng hơn.',
};

/**
 * Get message for a rule ID
 */
export function getRuleMessage(ruleId: string): RuleMessage {
  return RULE_MESSAGES[ruleId] || FALLBACK_MESSAGE;
}
