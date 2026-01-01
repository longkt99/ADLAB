// ============================================
// Rule Display Map
// ============================================
// Human-friendly, calm Vietnamese microcopy for Quality Lock rules
// This is a PRESENTATION layer only — does NOT affect rule evaluation
// Aligned with QUALITY_LOCK_RULE_SPEC.md

/**
 * Display metadata for a single rule
 */
export interface RuleDisplay {
  title: string;           // Short, human-friendly label
  description?: string;    // Gentle 1-sentence explanation
  suggestion?: string;     // Optional "how to improve" hint
  severityLabel?: 'Bắt buộc' | 'Gợi ý';
}

/**
 * Rule display map for all Quality Lock rules
 *
 * Guidelines followed:
 * - Vietnamese, calm, neutral product tone
 * - No blame words ("sai", "lỗi", "vi phạm")
 * - Prefer: "nên", "cần", "giúp", "để dễ đọc hơn"
 * - Feel like lint warning, not exam failure
 */
export const RULE_DISPLAY: Record<string, RuleDisplay> = {
  // ============================================
  // social_caption_v1 — STRUCTURE (HARD)
  // ============================================

  social_structure_lock: {
    title: 'Thiếu section cấu trúc',
    description: 'Nội dung cần có đủ 3 phần: Hook, Body, và CTA để đảm bảo cấu trúc chuẩn.',
    suggestion: 'Thêm **Hook:** (câu mở đầu), **Body:** (nội dung chính), **CTA:** (kêu gọi hành động).',
    severityLabel: 'Bắt buộc',
  },

  social_max_sections: {
    title: 'Có quá nhiều section',
    description: 'Nội dung nên gọn trong 4 section để không bị rối.',
    suggestion: 'Giữ lại: Hook, Body, CTA. Gộp hoặc xóa các section thừa.',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // social_caption_v1 — RED_FLAG (HARD)
  // ============================================

  social_no_meta_commentary: {
    title: 'Có câu meta không cần thiết',
    description: 'Nội dung không nên có các câu như "Đây là...", "Tôi sẽ..." vì nghe không tự nhiên.',
    suggestion: 'Xóa các câu giới thiệu kiểu AI. Bắt đầu thẳng vào nội dung.',
    severityLabel: 'Bắt buộc',
  },

  social_cta_not_generic: {
    title: 'CTA chưa cụ thể',
    description: 'Câu kêu gọi hành động cần rõ ràng để người đọc biết nên làm gì.',
    suggestion: 'Tránh "Tìm hiểu thêm", "Xem thêm". Thay bằng hành động cụ thể như "Bình luận ý kiến của bạn".',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // social_caption_v1 — QUALITY (SOFT)
  // ============================================

  social_hook_length: {
    title: 'Hook hơi dài',
    description: 'Câu mở đầu ngắn gọn sẽ thu hút chú ý tốt hơn.',
    suggestion: 'Rút gọn Hook còn 1-2 câu. Tập trung vào điểm gây tò mò nhất.',
    severityLabel: 'Gợi ý',
  },

  social_body_formatting: {
    title: 'Body nên chia đoạn',
    description: 'Chia thành nhiều đoạn ngắn giúp dễ đọc trên điện thoại.',
    suggestion: 'Thêm dấu xuống dòng để tách thành ít nhất 2 đoạn.',
    severityLabel: 'Gợi ý',
  },

  social_sentence_length: {
    title: 'Có câu khá dài',
    description: 'Câu ngắn hơn 25 từ sẽ dễ đọc hơn, đặc biệt trên mobile.',
    suggestion: 'Tách câu dài thành 2-3 câu ngắn. Mỗi câu một ý.',
    severityLabel: 'Gợi ý',
  },

  social_topic_keyword: {
    title: 'Chưa thấy từ khóa chủ đề',
    description: 'Nhắc lại từ khóa chính giúp nội dung rõ ràng và dễ tìm kiếm.',
    suggestion: 'Thêm từ khóa chủ đề vào Hook hoặc Body một cách tự nhiên.',
    severityLabel: 'Gợi ý',
  },

  social_cta_action_verb: {
    title: 'CTA cần rõ hành động hơn',
    description: 'CTA tốt nhất là 1 câu với động từ hành động rõ ràng.',
    suggestion: 'Ví dụ: "Bình luận...", "Chia sẻ nếu...", "Lưu lại để...", "Tag bạn bè..."',
    severityLabel: 'Gợi ý',
  },

  // ============================================
  // seo_blog_v1 — STRUCTURE (HARD)
  // ============================================

  seo_title_present: {
    title: 'Thiếu tiêu đề H1',
    description: 'Bài viết cần có 1 tiêu đề chính (H1) ở đầu.',
    suggestion: 'Thêm tiêu đề bằng cú pháp "# Tiêu đề" ở dòng đầu tiên.',
    severityLabel: 'Bắt buộc',
  },

  seo_headings_hierarchy: {
    title: 'Cấu trúc heading chưa đúng',
    description: 'Bài viết cần có đúng 1 H1, sau đó là H2, rồi H3 theo thứ tự.',
    suggestion: 'Kiểm tra: chỉ dùng 1 dấu # cho tiêu đề chính, ## cho mục lớn, ### cho mục con.',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // seo_blog_v1 — RED_FLAG (HARD)
  // ============================================

  seo_no_meta_commentary: {
    title: 'Có câu meta không cần thiết',
    description: 'Nội dung không nên có các câu như "Đây là...", "Tôi sẽ..."',
    suggestion: 'Xóa các câu giới thiệu kiểu AI. Viết tự nhiên như người thật.',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // seo_blog_v1 — QUALITY (SOFT)
  // ============================================

  seo_intro_present: {
    title: 'Nên có đoạn giới thiệu',
    description: 'Một đoạn mở đầu ngắn giúp người đọc hiểu bài viết nói về gì.',
    suggestion: 'Thêm 2-3 câu giới thiệu trước heading H2 đầu tiên.',
    severityLabel: 'Gợi ý',
  },

  seo_keyword_density: {
    title: 'Mật độ từ khóa chưa tối ưu',
    description: 'Từ khóa chính nên xuất hiện 2-5 lần trong bài.',
    suggestion: 'Kiểm tra và thêm/bớt từ khóa một cách tự nhiên.',
    severityLabel: 'Gợi ý',
  },

  seo_meta_description: {
    title: 'Meta description chưa chuẩn',
    description: 'Meta description tốt nhất là 120-160 ký tự.',
    suggestion: 'Viết lại mô tả ngắn gọn, hấp dẫn trong khoảng 120-160 ký tự.',
    severityLabel: 'Gợi ý',
  },

  seo_paragraph_length: {
    title: 'Có đoạn văn khá dài',
    description: 'Đoạn văn ngắn hơn 150 từ sẽ dễ đọc hơn.',
    suggestion: 'Tách đoạn dài thành 2-3 đoạn ngắn hơn.',
    severityLabel: 'Gợi ý',
  },

  seo_has_conclusion: {
    title: 'Nên có phần kết luận',
    description: 'Phần kết giúp tổng hợp nội dung và tạo ấn tượng cuối.',
    suggestion: 'Thêm heading "## Kết luận" hoặc "## Tổng kết" ở cuối bài.',
    severityLabel: 'Gợi ý',
  },

  // ============================================
  // video_script_v1 — STRUCTURE (HARD)
  // ============================================

  video_hook_present: {
    title: 'Thiếu phần mở đầu (Hook)',
    description: 'Video script cần có phần Hook để thu hút người xem ngay từ đầu.',
    suggestion: 'Thêm **Hook:** hoặc **Opening:** ở đầu script.',
    severityLabel: 'Bắt buộc',
  },

  video_sections_present: {
    title: 'Thiếu các section nội dung',
    description: 'Script cần có các phần nội dung được đánh dấu rõ ràng.',
    suggestion: 'Thêm **Main:**, **Body:**, hoặc [SCENE] để chia nội dung.',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // video_script_v1 — RED_FLAG (HARD)
  // ============================================

  video_no_meta_commentary: {
    title: 'Có câu meta không cần thiết',
    description: 'Script không nên có các câu như "Đây là...", "Tôi sẽ..."',
    suggestion: 'Xóa các câu giới thiệu kiểu AI. Viết tự nhiên.',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // video_script_v1 — QUALITY (SOFT)
  // ============================================

  video_hook_duration: {
    title: 'Hook hơi dài',
    description: 'Hook nên ngắn gọn (dưới 30 từ) để giữ chân người xem.',
    suggestion: 'Rút gọn Hook còn 1-2 câu ngắn, đi thẳng vào điểm hấp dẫn.',
    severityLabel: 'Gợi ý',
  },

  video_has_cta: {
    title: 'Nên có CTA',
    description: 'Video nên có lời kêu gọi hành động ở cuối.',
    suggestion: 'Thêm CTA như "Follow để xem thêm", "Like nếu thấy hay".',
    severityLabel: 'Gợi ý',
  },

  video_conversational: {
    title: 'Nên tự nhiên hơn',
    description: 'Script dạng hội thoại sẽ thu hút hơn.',
    suggestion: 'Thêm câu hỏi hoặc xưng hô trực tiếp (bạn/you).',
    severityLabel: 'Gợi ý',
  },

  video_timing_hints: {
    title: 'Nên có gợi ý thời gian',
    description: 'Đánh dấu thời gian giúp dễ edit video hơn.',
    suggestion: 'Thêm [0:00], timestamp, hoặc ghi chú thời lượng.',
    severityLabel: 'Gợi ý',
  },

  // ============================================
  // email_marketing_v1 — STRUCTURE (HARD)
  // ============================================

  email_subject_present: {
    title: 'Thiếu dòng Subject',
    description: 'Email cần có tiêu đề subject rõ ràng.',
    suggestion: 'Thêm **Subject:** ở đầu email.',
    severityLabel: 'Bắt buộc',
  },

  email_body_present: {
    title: 'Nội dung email quá ngắn',
    description: 'Email cần có nội dung đủ dài để truyền đạt thông điệp.',
    suggestion: 'Viết thêm nội dung (ít nhất 100 ký tự).',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // email_marketing_v1 — RED_FLAG (HARD)
  // ============================================

  email_no_meta_commentary: {
    title: 'Có câu meta không cần thiết',
    description: 'Email không nên có các câu như "Đây là...", "Tôi sẽ..."',
    suggestion: 'Xóa các câu giới thiệu kiểu AI.',
    severityLabel: 'Bắt buộc',
  },

  email_no_spam_words: {
    title: 'Có từ dễ bị đánh spam',
    description: 'Một số từ có thể khiến email vào thư mục spam.',
    suggestion: 'Tránh: "FREE!!!", "ACT NOW", "100% FREE".',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // email_marketing_v1 — QUALITY (SOFT)
  // ============================================

  email_subject_length: {
    title: 'Độ dài subject chưa tối ưu',
    description: 'Subject tốt nhất là 30-60 ký tự.',
    suggestion: 'Điều chỉnh subject trong khoảng 30-60 ký tự.',
    severityLabel: 'Gợi ý',
  },

  email_has_cta: {
    title: 'Nên có CTA rõ ràng',
    description: 'Email cần có nút hoặc link kêu gọi hành động.',
    suggestion: 'Thêm **CTA:** hoặc [Button: text] cho hành động chính.',
    severityLabel: 'Gợi ý',
  },

  email_personalization: {
    title: 'Nên có cá nhân hóa',
    description: 'Email có tên người nhận sẽ thân thiện hơn.',
    suggestion: 'Thêm {{name}} hoặc {{firstName}} vào lời chào.',
    severityLabel: 'Gợi ý',
  },

  email_preview_text: {
    title: 'Nên có preview text',
    description: 'Preview text hiển thị bên cạnh subject trong inbox.',
    suggestion: 'Thêm **Preview:** với 1 câu tóm tắt hấp dẫn.',
    severityLabel: 'Gợi ý',
  },

  // ============================================
  // landing_page_v1 — STRUCTURE (HARD)
  // ============================================

  landing_headline_present: {
    title: 'Thiếu headline chính',
    description: 'Landing page cần có 1 tiêu đề lớn thu hút.',
    suggestion: 'Thêm **Headline:** hoặc dùng # cho tiêu đề chính.',
    severityLabel: 'Bắt buộc',
  },

  landing_cta_present: {
    title: 'Thiếu nút CTA',
    description: 'Landing page cần có nút kêu gọi hành động rõ ràng.',
    suggestion: 'Thêm **CTA:** hoặc [Button: text].',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // landing_page_v1 — RED_FLAG (HARD)
  // ============================================

  landing_no_meta_commentary: {
    title: 'Có câu meta không cần thiết',
    description: 'Nội dung không nên có các câu như "Đây là...", "Tôi sẽ..."',
    suggestion: 'Xóa các câu giới thiệu kiểu AI.',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // landing_page_v1 — QUALITY (SOFT)
  // ============================================

  landing_headline_length: {
    title: 'Headline hơi dài',
    description: 'Headline ngắn gọn (dưới 15 từ) sẽ ấn tượng hơn.',
    suggestion: 'Rút gọn headline, giữ lại điểm nhấn chính.',
    severityLabel: 'Gợi ý',
  },

  landing_benefits_list: {
    title: 'Nên có danh sách lợi ích',
    description: 'Liệt kê lợi ích giúp người đọc hiểu giá trị nhanh hơn.',
    suggestion: 'Thêm ít nhất 3 bullet points về lợi ích.',
    severityLabel: 'Gợi ý',
  },

  landing_social_proof: {
    title: 'Nên có social proof',
    description: 'Testimonial hoặc đánh giá giúp tăng độ tin cậy.',
    suggestion: 'Thêm review, testimonial, hoặc số liệu thực tế.',
    severityLabel: 'Gợi ý',
  },

  landing_urgency: {
    title: 'Nên có yếu tố khẩn cấp',
    description: 'Urgency giúp thúc đẩy quyết định nhanh hơn.',
    suggestion: 'Thêm thời hạn, số lượng có hạn, hoặc ưu đãi sớm.',
    severityLabel: 'Gợi ý',
  },

  landing_subheadline: {
    title: 'Nên có subheadline',
    description: 'Subheadline bổ sung giải thích cho headline chính.',
    suggestion: 'Thêm **Subheadline:** hoặc 1 câu mô tả dưới headline.',
    severityLabel: 'Gợi ý',
  },

  // ============================================
  // product_description_v1 — STRUCTURE (HARD)
  // ============================================

  product_name_present: {
    title: 'Thiếu tên sản phẩm',
    description: 'Mô tả cần có tên sản phẩm rõ ràng.',
    suggestion: 'Thêm **Product:** hoặc **Name:** ở đầu.',
    severityLabel: 'Bắt buộc',
  },

  product_desc_present: {
    title: 'Mô tả quá ngắn',
    description: 'Mô tả sản phẩm cần đủ chi tiết để thuyết phục.',
    suggestion: 'Viết thêm mô tả (ít nhất 100 ký tự).',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // product_description_v1 — RED_FLAG (HARD)
  // ============================================

  product_no_meta_commentary: {
    title: 'Có câu meta không cần thiết',
    description: 'Mô tả không nên có các câu như "Đây là...", "Tôi sẽ..."',
    suggestion: 'Xóa các câu giới thiệu kiểu AI.',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // product_description_v1 — QUALITY (SOFT)
  // ============================================

  product_features_list: {
    title: 'Nên có danh sách tính năng',
    description: 'Liệt kê tính năng giúp khách hàng so sánh dễ hơn.',
    suggestion: 'Thêm ít nhất 3 bullet points về tính năng.',
    severityLabel: 'Gợi ý',
  },

  product_benefits: {
    title: 'Nên nêu lợi ích',
    description: 'Lợi ích cho khách hàng quan trọng hơn tính năng.',
    suggestion: 'Thêm câu giải thích sản phẩm giúp gì cho khách hàng.',
    severityLabel: 'Gợi ý',
  },

  product_specs_format: {
    title: 'Thông số nên định dạng rõ',
    description: 'Thông số kỹ thuật dễ đọc hơn khi ở dạng list hoặc bảng.',
    suggestion: 'Chuyển thông số thành bullet points hoặc bảng.',
    severityLabel: 'Gợi ý',
  },

  product_cta: {
    title: 'Nên có CTA mua hàng',
    description: 'CTA rõ ràng giúp khách hàng biết bước tiếp theo.',
    suggestion: 'Thêm "Mua ngay", "Đặt hàng", hoặc "Add to cart".',
    severityLabel: 'Gợi ý',
  },

  // ============================================
  // reel_caption_v1 — STRUCTURE (HARD)
  // ============================================

  reel_hook_present: {
    title: 'Thiếu hook mở đầu',
    description: 'Dòng đầu tiên cần thu hút ngay (dưới 10 từ).',
    suggestion: 'Viết câu mở đầu ngắn, gây tò mò.',
    severityLabel: 'Bắt buộc',
  },

  reel_length_limit: {
    title: 'Caption quá dài',
    description: 'Caption Reel nên ngắn gọn (dưới 300 ký tự).',
    suggestion: 'Rút gọn nội dung, giữ lại điểm chính nhất.',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // reel_caption_v1 — RED_FLAG (HARD)
  // ============================================

  reel_no_meta_commentary: {
    title: 'Có câu meta không cần thiết',
    description: 'Caption không nên có các câu như "Đây là...", "Tôi sẽ..."',
    suggestion: 'Xóa các câu giới thiệu kiểu AI.',
    severityLabel: 'Bắt buộc',
  },

  // ============================================
  // reel_caption_v1 — QUALITY (SOFT)
  // ============================================

  reel_has_hashtags: {
    title: 'Nên có hashtag',
    description: 'Hashtag giúp Reel tiếp cận nhiều người hơn.',
    suggestion: 'Thêm 3-10 hashtag liên quan ở cuối caption.',
    severityLabel: 'Gợi ý',
  },

  reel_emoji_usage: {
    title: 'Nên có emoji',
    description: 'Emoji giúp caption sinh động và dễ đọc hơn.',
    suggestion: 'Thêm 1-5 emoji phù hợp với nội dung.',
    severityLabel: 'Gợi ý',
  },

  reel_cta_present: {
    title: 'Nên có CTA',
    description: 'CTA khuyến khích người xem tương tác.',
    suggestion: 'Thêm lời kêu gọi: bình luận, chia sẻ, follow...',
    severityLabel: 'Gợi ý',
  },

  reel_line_breaks: {
    title: 'Nên có xuống dòng',
    description: 'Xuống dòng giúp dễ đọc trên điện thoại.',
    suggestion: 'Thêm dấu xuống dòng giữa các ý.',
    severityLabel: 'Gợi ý',
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get display metadata for a rule
 * Returns friendly copy if available, falls back to raw rule data
 */
export function getRuleDisplay(ruleId: string): RuleDisplay | null {
  return RULE_DISPLAY[ruleId] || null;
}

/**
 * Get display title for a rule (with fallback)
 */
export function getRuleTitle(ruleId: string, fallbackMessage: string): string {
  return RULE_DISPLAY[ruleId]?.title || fallbackMessage;
}

/**
 * Get severity label for a rule (with fallback)
 */
export function getRuleSeverityLabel(ruleId: string, severity: 'HARD' | 'SOFT'): string {
  return RULE_DISPLAY[ruleId]?.severityLabel || (severity === 'HARD' ? 'Bắt buộc' : 'Gợi ý');
}
