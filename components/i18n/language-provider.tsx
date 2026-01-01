'use client';

// ============================================
// Language Provider Component
// ============================================
// Manages language state and persistence (similar to ThemeProvider)

import { createContext, useState, useEffect, ReactNode } from 'react';
import type { Language } from '@/lib/i18n/languages';
import { DEFAULT_LANGUAGE, STORAGE_KEY } from '@/lib/i18n/languages';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  // Initialize language from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    const initialLanguage = stored === 'vi' || stored === 'en' ? stored : DEFAULT_LANGUAGE;
    setLanguageState(initialLanguage);
    setMounted(true);
  }, []);

  // Update localStorage when language changes
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, language);
  }, [language, mounted]);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
  };

  // Prevent flash of incorrect language by not rendering until mounted
  // This avoids SSR hydration mismatches (same pattern as ThemeProvider)
  if (!mounted) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
