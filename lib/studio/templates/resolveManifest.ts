// ============================================
// Template Manifest Resolver
// ============================================
// Single source of truth for resolving template ID → manifest
// Used by AI request builder to get manifest for buildSystemPrompt()

import type { TemplateManifest } from './templateManifest';
import { socialCaptionManifest } from './manifests/socialCaptionManifest';
import { seoBlogManifest } from './manifests/seoBlogManifest';
import { videoScriptManifest } from './manifests/video_script_v1';
import { emailMarketingManifest } from './manifests/email_marketing_v1';
import { landingPageManifest } from './manifests/landing_page_v1';
import { productDescriptionManifest } from './manifests/product_description_v1';
import { reelCaptionManifest } from './manifests/reel_caption_v1';

/**
 * Manifest Registry
 * All manifests must be registered here to be resolvable
 *
 * IMPORTANT: Keep manifest IDs in sync with ContentTemplate IDs
 * from lib/studio/templateLoader.ts when both systems are active
 */
const MANIFEST_REGISTRY: Record<string, TemplateManifest> = {
  // ✅ NEW MANIFEST SYSTEM (Phase 1-4)
  'social_caption_v1': socialCaptionManifest,
  'seo_blog_v1': seoBlogManifest,
  'video_script_v1': videoScriptManifest,
  'email_marketing_v1': emailMarketingManifest,
  'landing_page_v1': landingPageManifest,
  'product_description_v1': productDescriptionManifest,
  'reel_caption_v1': reelCaptionManifest,

  // ✅ BACKWARD COMPATIBILITY: Map old template IDs to new manifests
  // This allows existing selectedTemplateId values to continue working
  'social_caption': socialCaptionManifest,  // Alias for backward compat
  'seo_blog': seoBlogManifest,              // Alias for backward compat
};

/**
 * Resolve template ID to manifest
 *
 * @param templateId - Template identifier from selectedTemplateId
 * @returns TemplateManifest if found, null otherwise
 */
export function resolveTemplateManifest(templateId: string): TemplateManifest | null {
  const manifest = MANIFEST_REGISTRY[templateId];

  if (!manifest) {
    console.warn(`[Manifest Resolver] Template ID "${templateId}" not found in registry`);
    return null;
  }

  return manifest;
}

/**
 * Check if a template ID has a corresponding manifest
 *
 * @param templateId - Template identifier
 * @returns true if manifest exists
 */
export function hasManifest(templateId: string): boolean {
  return templateId in MANIFEST_REGISTRY;
}

/**
 * Get all registered manifest IDs
 * Useful for debugging and validation
 *
 * @returns Array of template IDs that have manifests
 */
export function getRegisteredManifestIds(): string[] {
  return Object.keys(MANIFEST_REGISTRY);
}
