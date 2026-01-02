// ============================================
// Prompt Template Localization Helper
// ============================================
// Handles i18n localization for PromptTemplate userTemplate field
// with proper fallback chain and missing-translation detection

import type { PromptTemplate } from '@/types/studio';
import type { Language } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * Get localized prompt template with proper fallback chain
 *
 * Fallback order:
 * 1. Try current language dictionary (if promptKey exists)
 * 2. Fallback to English dictionary (if current language !== 'en')
 * 3. Fallback to legacy userTemplate field
 *
 * @param template - The PromptTemplate to localize
 * @param language - Current UI language
 * @returns Localized prompt content
 */
export function getLocalizedPrompt(
  template: PromptTemplate,
  language: Language
): string {
  // If no promptKey, use legacy userTemplate
  if (!template.promptKey) {
    return template.userTemplate;
  }

  // Try current language dictionary
  const currentDict = getDictionary(language);
  const localizedPrompt = getNestedValue(currentDict, template.promptKey);

  if (typeof localizedPrompt === 'string') {
    return localizedPrompt;
  }

  // Fallback to English if current language is not English
  if (language !== 'en') {
    const enDict = getDictionary('en');
    const enPrompt = getNestedValue(enDict, template.promptKey);

    if (typeof enPrompt === 'string') {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[Prompt Localization] Missing translation for key "${template.promptKey}" in language "${language}", using English fallback`
        );
      }
      return enPrompt;
    }
  }

  // Final fallback to legacy userTemplate
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[Prompt Localization] Missing translation for key "${template.promptKey}" in all languages, using legacy userTemplate`
    );
  }
  return template.userTemplate;
}

/**
 * Get nested value from dictionary using dotted key notation
 * Example: getNestedValue(dict, 'studio.prompts.socialPostGenerator.userTemplate')
 *
 * @param obj - The dictionary object
 * @param key - Dotted key path (e.g., 'studio.prompts.socialPostGenerator.userTemplate')
 * @returns The value at the key path, or undefined if not found
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function getNestedValue(obj: Record<string, any>, key: string): unknown {
  const keys = key.split('.');
  let value: any = obj;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }

  return value;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
