'use client';

import React from 'react';
import Link from 'next/link';

// ============================================
// Quality Lock Rule Spec Page
// ============================================
// Renders the rule specification in a user-friendly format

export default function QualityLockSpecPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại Studio
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Quality Lock Rule Spec
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Tiêu chuẩn kiểm tra chất lượng nội dung AI - Single source of truth cho tất cả Golden Intents.
          </p>
        </div>

        {/* Legend */}
        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Chú thích</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Severity:</span>
              <ul className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                <li><span className="text-red-600 dark:text-red-400">HARD</span> = Bắt buộc (fail → không dùng được)</li>
                <li><span className="text-amber-600 dark:text-amber-400">SOFT</span> = Gợi ý (fail → cần chỉnh nhẹ)</li>
              </ul>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Layer:</span>
              <ul className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                <li><span className="font-mono">STRUCTURE</span> = Cấu trúc output</li>
                <li><span className="font-mono">RED_FLAG</span> = Lỗi nghiêm trọng</li>
                <li><span className="font-mono">QUALITY</span> = Chất lượng nội dung</li>
              </ul>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">testMode:</span>
              <ul className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                <li><span className="font-mono">SAME</span> = Không đổi</li>
                <li><span className="font-mono">SKIP</span> = Bỏ qua trong test</li>
                <li><span className="font-mono">RELAX</span> = Nới lỏng ngưỡng</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Intent Sections */}
        <div className="space-y-8">
          {/* social_caption_v1 */}
          <IntentSection
            intent="social_caption_v1"
            name="Social Caption"
            description="Caption cho bài đăng mạng xã hội (Facebook, Instagram, LinkedIn...)"
            status="implemented"
            rules={[
              { layer: 'STRUCTURE', id: 'social_structure_lock', severity: 'HARD', description: 'Phải có Hook, Body, CTA sections', testMode: 'SAME' },
              { layer: 'STRUCTURE', id: 'social_max_sections', severity: 'HARD', description: 'Tối đa 4 section có label', testMode: 'SAME' },
              { layer: 'RED_FLAG', id: 'social_no_meta_commentary', severity: 'HARD', description: 'Không có meta text (Đây là..., Tôi sẽ...)', testMode: 'SAME' },
              { layer: 'RED_FLAG', id: 'social_cta_not_generic', severity: 'HARD', description: 'CTA không được chung chung', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'social_hook_length', severity: 'SOFT', description: 'Hook ≤ 2 câu', testMode: 'SKIP' },
              { layer: 'QUALITY', id: 'social_body_formatting', severity: 'SOFT', description: 'Body ≥ 2 đoạn', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'social_sentence_length', severity: 'SOFT', description: 'Câu ≤ 25 từ', testMode: 'SKIP' },
              { layer: 'QUALITY', id: 'social_topic_keyword', severity: 'SOFT', description: 'Có từ khóa chủ đề', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'social_cta_action_verb', severity: 'SOFT', description: 'CTA có động từ hành động rõ', testMode: 'SAME' },
            ]}
          />

          {/* seo_blog_v1 */}
          <IntentSection
            intent="seo_blog_v1"
            name="SEO Blog Article"
            description="Bài blog chuẩn SEO với heading hierarchy"
            status="spec-only"
            rules={[
              { layer: 'STRUCTURE', id: 'seo_title_present', severity: 'HARD', description: 'Phải có H1 title', testMode: 'SAME' },
              { layer: 'STRUCTURE', id: 'seo_headings_hierarchy', severity: 'HARD', description: 'Heading đúng thứ tự (H1 → H2 → H3)', testMode: 'SAME' },
              { layer: 'RED_FLAG', id: 'seo_no_meta_commentary', severity: 'HARD', description: 'Không có meta text', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'seo_intro_present', severity: 'SOFT', description: 'Có đoạn mở đầu trước H2', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'seo_keyword_density', severity: 'SOFT', description: 'Keyword xuất hiện 2-5 lần', testMode: 'RELAX (1-8)' },
              { layer: 'QUALITY', id: 'seo_paragraph_length', severity: 'SOFT', description: 'Đoạn văn ≤ 150 từ', testMode: 'SKIP' },
              { layer: 'QUALITY', id: 'seo_has_conclusion', severity: 'SOFT', description: 'Có phần kết luận', testMode: 'SAME' },
            ]}
          />

          {/* video_script_v1 */}
          <IntentSection
            intent="video_script_v1"
            name="Video Script"
            description="Kịch bản video cho TikTok, YouTube, Reels..."
            status="spec-only"
            rules={[
              { layer: 'STRUCTURE', id: 'video_hook_present', severity: 'HARD', description: 'Phải có Hook/Opening', testMode: 'SAME' },
              { layer: 'STRUCTURE', id: 'video_sections_present', severity: 'HARD', description: 'Có ≥2 content sections', testMode: 'SAME' },
              { layer: 'RED_FLAG', id: 'video_no_meta_commentary', severity: 'HARD', description: 'Không có meta text', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'video_hook_duration', severity: 'SOFT', description: 'Hook ≤ 30 từ', testMode: 'SKIP' },
              { layer: 'QUALITY', id: 'video_has_cta', severity: 'SOFT', description: 'Có CTA cuối video', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'video_conversational', severity: 'SOFT', description: 'Giọng văn trò chuyện', testMode: 'SAME' },
            ]}
          />

          {/* email_marketing_v1 */}
          <IntentSection
            intent="email_marketing_v1"
            name="Email Marketing"
            description="Email marketing với subject line và CTA"
            status="spec-only"
            rules={[
              { layer: 'STRUCTURE', id: 'email_subject_present', severity: 'HARD', description: 'Phải có Subject line', testMode: 'SAME' },
              { layer: 'STRUCTURE', id: 'email_body_present', severity: 'HARD', description: 'Body ≥ 100 ký tự', testMode: 'SAME' },
              { layer: 'RED_FLAG', id: 'email_no_meta_commentary', severity: 'HARD', description: 'Không có meta text', testMode: 'SAME' },
              { layer: 'RED_FLAG', id: 'email_no_spam_words', severity: 'HARD', description: 'Không có spam trigger', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'email_subject_length', severity: 'SOFT', description: 'Subject 30-60 ký tự', testMode: 'RELAX (20-80)' },
              { layer: 'QUALITY', id: 'email_has_cta', severity: 'SOFT', description: 'Có CTA rõ ràng', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'email_personalization', severity: 'SOFT', description: 'Có personalization tokens', testMode: 'SKIP' },
            ]}
          />

          {/* landing_page_v1 */}
          <IntentSection
            intent="landing_page_v1"
            name="Landing Page"
            description="Nội dung landing page với headline và benefits"
            status="spec-only"
            rules={[
              { layer: 'STRUCTURE', id: 'landing_headline_present', severity: 'HARD', description: 'Phải có Headline', testMode: 'SAME' },
              { layer: 'STRUCTURE', id: 'landing_cta_present', severity: 'HARD', description: 'Phải có CTA section', testMode: 'SAME' },
              { layer: 'RED_FLAG', id: 'landing_no_meta_commentary', severity: 'HARD', description: 'Không có meta text', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'landing_headline_length', severity: 'SOFT', description: 'Headline ≤ 15 từ', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'landing_benefits_list', severity: 'SOFT', description: 'Có ≥3 bullet benefits', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'landing_social_proof', severity: 'SOFT', description: 'Có social proof', testMode: 'SKIP' },
            ]}
          />

          {/* product_description_v1 */}
          <IntentSection
            intent="product_description_v1"
            name="Product Description"
            description="Mô tả sản phẩm cho e-commerce"
            status="spec-only"
            rules={[
              { layer: 'STRUCTURE', id: 'product_name_present', severity: 'HARD', description: 'Phải có tên sản phẩm', testMode: 'SAME' },
              { layer: 'STRUCTURE', id: 'product_desc_present', severity: 'HARD', description: 'Mô tả ≥ 100 ký tự', testMode: 'SAME' },
              { layer: 'RED_FLAG', id: 'product_no_meta_commentary', severity: 'HARD', description: 'Không có meta text', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'product_features_list', severity: 'SOFT', description: 'Có ≥3 tính năng', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'product_benefits', severity: 'SOFT', description: 'Nêu lợi ích cho khách', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'product_cta', severity: 'SOFT', description: 'Có CTA mua hàng', testMode: 'SAME' },
            ]}
          />

          {/* reel_caption_v1 */}
          <IntentSection
            intent="reel_caption_v1"
            name="Reel Caption"
            description="Caption ngắn cho Instagram Reels, TikTok"
            status="spec-only"
            rules={[
              { layer: 'STRUCTURE', id: 'reel_hook_present', severity: 'HARD', description: 'Dòng đầu phải hook', testMode: 'SAME' },
              { layer: 'STRUCTURE', id: 'reel_length_limit', severity: 'HARD', description: 'Tổng ≤ 300 ký tự', testMode: 'SAME' },
              { layer: 'RED_FLAG', id: 'reel_no_meta_commentary', severity: 'HARD', description: 'Không có meta text', testMode: 'SAME' },
              { layer: 'QUALITY', id: 'reel_has_hashtags', severity: 'SOFT', description: '3-10 hashtags', testMode: 'RELAX (1-15)' },
              { layer: 'QUALITY', id: 'reel_emoji_usage', severity: 'SOFT', description: '1-5 emojis', testMode: 'SKIP' },
              { layer: 'QUALITY', id: 'reel_cta_present', severity: 'SOFT', description: 'Có CTA engagement', testMode: 'SAME' },
            ]}
          />
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: 2024-12-16 · View full spec in{' '}
            <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
              lib/quality/QUALITY_LOCK_RULE_SPEC.md
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface RuleSpec {
  layer: 'STRUCTURE' | 'RED_FLAG' | 'QUALITY';
  id: string;
  severity: 'HARD' | 'SOFT';
  description: string;
  testMode: string;
}

interface IntentSectionProps {
  intent: string;
  name: string;
  description: string;
  status: 'implemented' | 'spec-only';
  rules: RuleSpec[];
}

function IntentSection({ intent, name, description, status, rules }: IntentSectionProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      {/* Intent Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {name}
          </h3>
          <code className="px-1.5 py-0.5 text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 rounded">
            {intent}
          </code>
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
            status === 'implemented'
              ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
              : 'text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-800'
          }`}>
            {status === 'implemented' ? '✓ Implemented' : 'Spec only'}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>

      {/* Rules Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50">
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Layer</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Rule ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Severity</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Description</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">testMode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                <td className="px-3 py-2">
                  <span className={`font-mono text-[10px] ${
                    rule.layer === 'STRUCTURE' ? 'text-blue-600 dark:text-blue-400' :
                    rule.layer === 'RED_FLAG' ? 'text-red-600 dark:text-red-400' :
                    'text-amber-600 dark:text-amber-400'
                  }`}>
                    {rule.layer}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <code className="font-mono text-[10px] text-gray-600 dark:text-gray-400">
                    {rule.id}
                  </code>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                    rule.severity === 'HARD'
                      ? 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                      : 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
                  }`}>
                    {rule.severity}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {rule.description}
                </td>
                <td className="px-3 py-2">
                  <span className={`font-mono text-[10px] ${
                    rule.testMode === 'SKIP' ? 'text-blue-600 dark:text-blue-400' :
                    rule.testMode.startsWith('RELAX') ? 'text-purple-600 dark:text-purple-400' :
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {rule.testMode}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
