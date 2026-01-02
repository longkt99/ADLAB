// ============================================
// useTranslation Hook
// ============================================

import { useContext } from 'react';
import { LanguageContext } from '@/components/i18n/language-provider';
import { getDictionary } from './dictionaries';
import { DEFAULT_LANGUAGE } from './languages';
import type { Language } from './languages';

export interface TranslationResult {
  t: (key: string) => string;
  language: Language;
  setLanguage: (language: Language) => void;
}

export function useTranslation(): TranslationResult {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }

  const { language, setLanguage } = context;
  const dictionary = getDictionary(language);
  const fallbackDictionary = getDictionary(DEFAULT_LANGUAGE);

  /**
   * Translation function with dotted key access
   * Examples: t('common.loading'), t('navigation.posts')
   *
   * Falls back to Vietnamese if key not found in current language
   * Returns the key itself as last resort
   */
  const t = (key: string): string => {
    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dictionary traversal requires any
    let value: any = dictionary;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dictionary traversal requires any
    let fallbackValue: any = fallbackDictionary;

    // Navigate nested object structure
    for (const k of keys) {
      value = value?.[k];
      fallbackValue = fallbackValue?.[k];
    }

    // If value exists and is a string, return it
    if (typeof value === 'string') {
      return value;
    }

    // Fallback to Vietnamese
    if (typeof fallbackValue === 'string') {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `Translation missing for key "${key}" in language "${language}", falling back to Vietnamese`
        );
      }
      return fallbackValue;
    }

    // Last resort: return user-friendly fallback instead of raw key
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Translation missing for key "${key}" in all languages`);
    }
    // Return localized "missing translation" message instead of raw key
    return language === 'vi' ? 'Chưa có bản dịch' : 'Missing translation';
  };

  return {
    t,
    language,
    setLanguage,
  };
}
