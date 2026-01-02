// ============================================
// Apply Sections - Section Merge Utilities
// ============================================
// Single source of truth for extracting and merging sections
// when applying transform results to source content.
//
// USES: lib/quality/sectionParser.ts for parsing (DO NOT duplicate)
// ============================================

import {
  normalizeSections,
  type SectionType,
} from '@/lib/quality/sectionParser';

/**
 * Section map with optional sections
 */
export interface SectionMap {
  hook: string | null;
  body: string | null;
  cta: string | null;
  hashtags: string | null;
}

/**
 * Apply mode for section merging
 */
export type ApplyMode = 'all' | 'hook' | 'body' | 'cta' | 'hashtags';

/**
 * Result of applying sections
 */
export interface ApplyResult {
  success: boolean;
  content: string;
  appliedSections: SectionType[];
  errors: string[];
}

/**
 * Extract sections from text using sectionParser
 * Returns null values for missing sections
 *
 * @param text - Content to parse
 * @returns SectionMap with extracted sections
 */
export function extractSections(text: string): SectionMap {
  const normalized = normalizeSections(text);
  return {
    hook: normalized.hook,
    body: normalized.body,
    cta: normalized.cta,
    hashtags: normalized.hashtags,
  };
}

/**
 * Check if content has any parseable sections
 *
 * @param text - Content to check
 * @returns true if at least one section is detected
 */
export function hasSections(text: string): boolean {
  const sections = extractSections(text);
  return !!(sections.hook || sections.body || sections.cta || sections.hashtags);
}

/**
 * Get available sections that can be applied from afterText
 *
 * @param afterText - AI result content
 * @returns Array of section types that have content
 */
export function getAvailableSections(afterText: string): SectionType[] {
  const sections = extractSections(afterText);
  const available: SectionType[] = [];

  if (sections.hook && sections.hook.trim()) available.push('HOOK');
  if (sections.body && sections.body.trim()) available.push('BODY');
  if (sections.cta && sections.cta.trim()) available.push('CTA');
  if (sections.hashtags && sections.hashtags.trim()) available.push('HASHTAGS');

  return available;
}

/**
 * Rebuild content from sections with standard formatting
 *
 * @param sections - Section map to rebuild
 * @returns Formatted content string
 */
function rebuildFromSections(sections: SectionMap): string {
  const parts: string[] = [];

  if (sections.hook && sections.hook.trim()) {
    parts.push(`**Hook:**\n${sections.hook.trim()}`);
  }

  if (sections.body && sections.body.trim()) {
    parts.push(`**Body:**\n${sections.body.trim()}`);
  }

  if (sections.cta && sections.cta.trim()) {
    parts.push(`**CTA:**\n${sections.cta.trim()}`);
  }

  if (sections.hashtags && sections.hashtags.trim()) {
    parts.push(`**Hashtags:**\n${sections.hashtags.trim()}`);
  }

  return parts.join('\n\n');
}

/**
 * Apply selected sections from afterText to beforeText
 *
 * MERGE RULES:
 * 1. If mode is 'all': Return afterText as-is (no merge needed)
 * 2. If mode is specific section:
 *    - If before has sections: Replace only that section, keep others
 *    - If before has no sections: Can only apply 'all'
 * 3. Preserve sections not being applied
 *
 * @param beforeText - Original content (source)
 * @param afterText - AI result content
 * @param mode - Which section(s) to apply
 * @returns ApplyResult with merged content
 */
export function applySection(
  beforeText: string,
  afterText: string,
  mode: ApplyMode
): ApplyResult {
  // Apply All: Just return afterText
  if (mode === 'all') {
    return {
      success: true,
      content: afterText,
      appliedSections: getAvailableSections(afterText),
      errors: [],
    };
  }

  // Parse both texts
  const beforeSections = extractSections(beforeText);
  const afterSections = extractSections(afterText);

  // Check if before has any sections
  const beforeHasSections = hasSections(beforeText);

  if (!beforeHasSections) {
    // Cannot do partial apply if source has no sections
    return {
      success: false,
      content: beforeText,
      appliedSections: [],
      errors: ['Source content has no sections. Use "Apply All" instead.'],
    };
  }

  // Map mode to section type
  const sectionTypeMap: Record<Exclude<ApplyMode, 'all'>, keyof SectionMap> = {
    hook: 'hook',
    body: 'body',
    cta: 'cta',
    hashtags: 'hashtags',
  };

  const sectionKey = sectionTypeMap[mode];
  const afterValue = afterSections[sectionKey];

  if (!afterValue || !afterValue.trim()) {
    return {
      success: false,
      content: beforeText,
      appliedSections: [],
      errors: [`AI result does not contain a ${mode.toUpperCase()} section.`],
    };
  }

  // Merge: Replace only the target section, keep others from before
  const mergedSections: SectionMap = {
    hook: mode === 'hook' ? afterValue : beforeSections.hook,
    body: mode === 'body' ? afterValue : beforeSections.body,
    cta: mode === 'cta' ? afterValue : beforeSections.cta,
    hashtags: mode === 'hashtags' ? afterValue : beforeSections.hashtags,
  };

  const rebuilt = rebuildFromSections(mergedSections);

  return {
    success: true,
    content: rebuilt,
    appliedSections: [mode.toUpperCase() as SectionType],
    errors: [],
  };
}

/**
 * Get character count for each section (for UI preview)
 *
 * @param text - Content to analyze
 * @returns Object with char counts per section
 */
export function getSectionCharCounts(text: string): Record<keyof SectionMap, number> {
  const sections = extractSections(text);
  return {
    hook: sections.hook?.trim().length || 0,
    body: sections.body?.trim().length || 0,
    cta: sections.cta?.trim().length || 0,
    hashtags: sections.hashtags?.trim().length || 0,
  };
}

/**
 * Compare two contents and determine what changed
 *
 * @param before - Original content
 * @param after - New content
 * @returns Object describing changes per section
 */
export function compareSections(
  before: string,
  after: string
): Record<keyof SectionMap, 'unchanged' | 'modified' | 'added' | 'removed'> {
  const beforeSections = extractSections(before);
  const afterSections = extractSections(after);

  const result: Record<keyof SectionMap, 'unchanged' | 'modified' | 'added' | 'removed'> = {
    hook: 'unchanged',
    body: 'unchanged',
    cta: 'unchanged',
    hashtags: 'unchanged',
  };

  const keys: (keyof SectionMap)[] = ['hook', 'body', 'cta', 'hashtags'];

  for (const key of keys) {
    const beforeVal = beforeSections[key]?.trim() || '';
    const afterVal = afterSections[key]?.trim() || '';

    if (!beforeVal && afterVal) {
      result[key] = 'added';
    } else if (beforeVal && !afterVal) {
      result[key] = 'removed';
    } else if (beforeVal !== afterVal) {
      result[key] = 'modified';
    }
    // else: unchanged (default)
  }

  return result;
}
