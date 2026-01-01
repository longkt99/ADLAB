// ============================================
// Golden Intents Registry
// ============================================
// Central registry for quick-access content creation intents
// Maps user intent → template manifest for 1-click content generation

import { resolveTemplateManifest } from '../templates/resolveManifest';

/**
 * Golden Intent Definition
 * Represents a high-frequency user intent mapped to a template
 */
export interface GoldenIntent {
  id: string; // Unique identifier (e.g., 'social-caption-instant')
  label: string; // Display name (e.g., 'Caption MXH')
  description: string; // Hover tooltip (e.g., 'Viết caption nhanh cho Facebook, Instagram')
  templateId: string; // Target template/manifest ID (must exist in resolveManifest registry)
  badge?: string; // Optional badge text (e.g., 'HOT', 'NEW')
  order: number; // Display order (lower = leftmost)
  enabled?: boolean; // Feature flag (default: true)
}

/**
 * Golden Intents Registry
 * RULE: Only include high-frequency, proven use cases
 * RULE: templateId MUST exist in manifest registry (see lib/studio/templates/resolveManifest.ts)
 */
export const GOLDEN_INTENTS: GoldenIntent[] = [
  // ✅ ACTIVE INTENTS (Have manifests)
  {
    id: 'social-caption-instant',
    label: '✍️ Caption MXH',
    description: 'Viết caption nhanh cho Facebook, Instagram, TikTok',
    templateId: 'social_caption_v1',
    badge: 'HOT',
    order: 1,
    enabled: true,
  },
  {
    id: 'seo-blog-instant',
    label: '📝 Blog SEO',
    description: 'Viết bài blog dài tối ưu công cụ tìm kiếm',
    templateId: 'seo_blog_v1',
    order: 2,
    enabled: true,
  },

  // 🚧 PLANNED INTENTS (Manifests not created yet)
  // TODO: Create manifest + enable when ready
  {
    id: 'video-script-instant',
    label: '🎬 Script Video',
    description: 'Viết kịch bản video TikTok, YouTube Shorts, Reels',
    templateId: 'video_script_v1',
    order: 3,
    enabled: true,
  },
  {
    id: 'ad-copy-instant',
    label: '🎯 Quảng Cáo',
    description: 'Viết nội dung quảng cáo Facebook Ads, Google Ads',
    templateId: 'ad_copy_v1', // TODO: Create manifest
    order: 4,
    enabled: false,
  },
  {
    id: 'email-marketing-instant',
    label: '📧 Email MKT',
    description: 'Viết email marketing rõ ràng, đúng mục tiêu',
    templateId: 'email_marketing_v1',
    order: 4,
    enabled: true,
  },
  {
    id: 'product-description-instant',
    label: '🛍️ Mô Tả SP',
    description: 'Viết mô tả sản phẩm hấp dẫn cho e-commerce',
    templateId: 'product_description_v1',
    order: 6,
    enabled: true,
  },
  {
    id: 'linkedin-post-instant',
    label: '💼 LinkedIn Post',
    description: 'Viết bài đăng LinkedIn chuyên nghiệp, tăng engagement',
    templateId: 'linkedin_post_v1', // TODO: Create manifest
    order: 7,
    enabled: false,
  },
  {
    id: 'press-release-instant',
    label: '📰 Thông Cáo',
    description: 'Viết thông cáo báo chí chuẩn PR',
    templateId: 'press_release_v1', // TODO: Create manifest
    order: 8,
    enabled: false,
  },
  {
    id: 'thread-twitter-instant',
    label: '🧵 Twitter Thread',
    description: 'Viết chuỗi tweet dài, storytelling hấp dẫn',
    templateId: 'twitter_thread_v1', // TODO: Create manifest
    order: 9,
    enabled: false,
  },
  {
    id: 'landing-page-instant',
    label: '🚀 Landing Page',
    description: 'Viết nội dung landing page chuyển đổi cao',
    templateId: 'landing_page_v1',
    order: 5,
    enabled: true,
  },
  {
    id: 'reel-caption-instant',
    label: '🎞️ Reel Caption',
    description: 'Viết caption cực ngắn cho Reels/TikTok',
    templateId: 'reel_caption_v1',
    order: 7,
    enabled: true,
  },
];

/**
 * Get all enabled golden intents, sorted by order
 * @returns Array of enabled intents in display order
 */
export function listGoldenIntents(): GoldenIntent[] {
  return GOLDEN_INTENTS
    .filter((intent) => intent.enabled !== false) // Default to enabled if not specified
    .sort((a, b) => a.order - b.order);
}

/**
 * Validate golden intents against manifest registry
 * Useful for debugging and ensuring data integrity
 *
 * @returns Validation results with manifest metadata
 */
export function validateGoldenIntents(): {
  intent: GoldenIntent;
  isValid: boolean;
  manifestName?: string;
  manifestVersion?: string;
  error?: string;
}[] {
  return GOLDEN_INTENTS.map((intent) => {
    try {
      const manifest = resolveTemplateManifest(intent.templateId);

      if (!manifest) {
        return {
          intent,
          isValid: false,
          error: `Manifest not found for templateId: ${intent.templateId}`,
        };
      }

      return {
        intent,
        isValid: true,
        manifestName: manifest.name,
        manifestVersion: manifest.version,
      };
    } catch (error: any) {
      return {
        intent,
        isValid: false,
        error: error.message || 'Unknown validation error',
      };
    }
  });
}

/**
 * Get a single golden intent by ID
 * @param id - Intent identifier
 * @returns GoldenIntent if found, undefined otherwise
 */
export function getGoldenIntentById(id: string): GoldenIntent | undefined {
  return GOLDEN_INTENTS.find((intent) => intent.id === id);
}

/**
 * Check if a template ID is used by any golden intent
 * Useful for template management and deletion safety
 *
 * @param templateId - Template/manifest ID
 * @returns true if template is referenced by any intent
 */
export function isTemplateUsedByGoldenIntent(templateId: string): boolean {
  return GOLDEN_INTENTS.some((intent) => intent.templateId === templateId);
}
