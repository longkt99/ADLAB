// ============================================
// i18n Main Exports
// ============================================

// Language types and constants
export type { Language } from './languages';
export { DEFAULT_LANGUAGE, LANGUAGES, STORAGE_KEY, LANGUAGE_NAMES } from './languages';

// Translation hook
export { useTranslation } from './use-translation';
export type { TranslationResult } from './use-translation';

// Dictionaries
export { getDictionary, dictionaries } from './dictionaries';
export type { Dictionary } from './dictionaries';

// Date/Time formatting
export { formatDate } from './format-date';
export type { DateFormatStyle } from './format-date';
