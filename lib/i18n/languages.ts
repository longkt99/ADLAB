// ============================================
// Language Types and Constants
// ============================================

export type Language = 'vi' | 'en';

export const DEFAULT_LANGUAGE: Language = 'vi';

export const LANGUAGES = ['vi', 'en'] as const;

export const STORAGE_KEY = 'content-machine-language';

export const LANGUAGE_NAMES: Record<Language, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};
