// ============================================
// Dictionary Exports and Types
// ============================================

import type { Language } from '../languages';
import { viDictionary, type FlexibleDictionary } from './vi';
import { enDictionary } from './en';

// Dictionaries map
export const dictionaries = {
  vi: viDictionary,
  en: enDictionary,
} as const;

// Dictionary type - uses FlexibleDictionary which keeps all sections strict
// except 'prompts' which allows EN/VI to have different template sets
export type Dictionary = FlexibleDictionary;

// Get dictionary for a specific language
export function getDictionary(language: Language): Dictionary {
  return dictionaries[language] as Dictionary;
}

// Re-export individual dictionaries
export { viDictionary, enDictionary };
