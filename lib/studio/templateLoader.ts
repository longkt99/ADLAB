// ============================================
// Template Loader
// ============================================
// Central registry and loader for all content templates
// Automatically imports and validates templates

import type {
  ContentTemplate,
  LoadedTemplate,
  TemplateValidationResult,
} from './templates/templateSchema';
import {
  validateTemplateStructure,
  compileTemplateSystemMessage,
} from './templates/templateSchema';

// Import all available templates
import { socialCaptionTemplate } from './templates/social_caption';
import { storytellingTemplate } from './templates/storytelling';
import { adCopyTemplate } from './templates/ad_copy';
import { ideaListAdvancedTemplate } from './templates/idea_list_advanced';
import { strategicContentIdeasTemplate } from './templates/strategic_content_ideas';

/**
 * Template Registry
 * All templates must be registered here to be available in the system
 */
const TEMPLATE_REGISTRY: ContentTemplate[] = [
  socialCaptionTemplate,
  storytellingTemplate,
  adCopyTemplate,
  ideaListAdvancedTemplate,
  strategicContentIdeasTemplate,
];

/**
 * Get a template by its unique ID
 *
 * @param id - The template ID (e.g., 'social_caption')
 * @returns LoadedTemplate with validation results and compiled system message
 * @throws Error if template ID is not found
 */
export function getTemplateById(id: string): LoadedTemplate {
  const template = TEMPLATE_REGISTRY.find((t) => t.id === id);

  if (!template) {
    throw new Error(
      `Template not found: ${id}. Available templates: ${TEMPLATE_REGISTRY.map((t) => t.id).join(', ')}`
    );
  }

  // Validate template structure
  const validation = validateTemplateStructure(template);

  if (!validation.isValid) {
    return {
      template,
      systemMessage: '',
      isValid: false,
      errors: validation.errors,
    };
  }

  // Compile template into system message
  const systemMessage = compileTemplateSystemMessage(template);

  return {
    template,
    systemMessage,
    isValid: true,
    errors: [],
  };
}

/**
 * Get all available templates
 *
 * @returns Array of all registered templates with basic info
 */
export function listAllTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  nameKey?: string;
  descriptionKey?: string;
  category: string;
  platforms: string[];
  isValid: boolean;
}> {
  return TEMPLATE_REGISTRY.map((template) => {
    const validation = validateTemplateStructure(template);

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      nameKey: template.nameKey,
      descriptionKey: template.descriptionKey,
      category: template.category,
      platforms: template.platforms,
      isValid: validation.isValid,
    };
  });
}

/**
 * Get templates filtered by category
 *
 * @param category - Template category to filter by
 * @returns Array of templates in that category
 */
export function getTemplatesByCategory(
  category: 'content_creation' | 'analytical' | 'optimization' | 'ideation'
): ContentTemplate[] {
  return TEMPLATE_REGISTRY.filter((t) => t.category === category);
}

/**
 * Get templates filtered by platform
 *
 * @param platform - Platform to filter by (e.g., 'instagram')
 * @returns Array of templates supporting that platform
 */
export function getTemplatesByPlatform(platform: string): ContentTemplate[] {
  return TEMPLATE_REGISTRY.filter((t) => t.platforms.includes(platform as any));
}

/**
 * Get templates filtered by supported tone
 *
 * @param tone - Tone to filter by (e.g., 'friendly')
 * @returns Array of templates supporting that tone
 */
export function getTemplatesByTone(tone: string): ContentTemplate[] {
  return TEMPLATE_REGISTRY.filter((t) => t.toneSupport.includes(tone as any));
}

/**
 * Search templates by keyword in name, description, or tags
 *
 * @param keyword - Search term
 * @returns Array of matching templates
 */
export function searchTemplates(keyword: string): ContentTemplate[] {
  const lowerKeyword = keyword.toLowerCase();

  return TEMPLATE_REGISTRY.filter((template) => {
    const searchableText = [
      template.name,
      template.description,
      ...(template.tags || []),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(lowerKeyword);
  });
}

/**
 * Validate all registered templates
 * Useful for system health checks and debugging
 *
 * @returns Object with validation results for each template
 */
export function validateAllTemplates(): Record<
  string,
  TemplateValidationResult
> {
  const results: Record<string, TemplateValidationResult> = {};

  for (const template of TEMPLATE_REGISTRY) {
    results[template.id] = validateTemplateStructure(template);
  }

  return results;
}

/**
 * Get template statistics
 * Useful for admin dashboards
 *
 * @returns Object with template count by category, platform, etc.
 */
export function getTemplateStats() {
  const stats = {
    total: TEMPLATE_REGISTRY.length,
    byCategory: {} as Record<string, number>,
    byPlatform: {} as Record<string, number>,
    byTone: {} as Record<string, number>,
    valid: 0,
    invalid: 0,
  };

  for (const template of TEMPLATE_REGISTRY) {
    const validation = validateTemplateStructure(template);

    if (validation.isValid) {
      stats.valid++;
    } else {
      stats.invalid++;
    }

    // Count by category
    stats.byCategory[template.category] =
      (stats.byCategory[template.category] || 0) + 1;

    // Count by platform
    for (const platform of template.platforms) {
      stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
    }

    // Count by tone
    for (const tone of template.toneSupport) {
      stats.byTone[tone] = (stats.byTone[tone] || 0) + 1;
    }
  }

  return stats;
}

/**
 * Check if a template ID exists
 *
 * @param id - Template ID to check
 * @returns True if template exists, false otherwise
 */
export function templateExists(id: string): boolean {
  return TEMPLATE_REGISTRY.some((t) => t.id === id);
}

/**
 * Get recommended templates based on user's tone preference
 *
 * @param tone - User's selected tone
 * @param limit - Maximum number of recommendations (default: 3)
 * @returns Array of recommended templates
 */
export function getRecommendedTemplates(
  tone: string,
  limit: number = 3
): ContentTemplate[] {
  // First, get templates that support this tone
  const matching = getTemplatesByTone(tone);

  // If we have matches, return them
  if (matching.length > 0) {
    return matching.slice(0, limit);
  }

  // Otherwise, return most popular templates
  return TEMPLATE_REGISTRY.slice(0, limit);
}
