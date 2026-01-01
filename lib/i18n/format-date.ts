// ============================================
// Date/Time Formatting Utility
// ============================================
// Provides locale-aware date/time formatting for Vietnamese and English

import type { Language } from './languages';

export type DateFormatStyle =
  | 'dateFull'        // full date with year (vi: dd/MM/yyyy, en: MMM d, yyyy)
  | 'dateShort'       // date without year (vi: dd/MM, en: MMM d)
  | 'monthYear'       // month + year (vi: MM/yyyy, en: December 2025)
  | 'dateTimeShort'   // date + time (vi: 24h, en: 12h with AM/PM)
  | 'timeOnly';       // time only (vi: 24h, en: 12h with AM/PM)

const LOCALE_MAP: Record<Language, string> = {
  vi: 'vi-VN',
  en: 'en-US',
};

/**
 * Format a date according to the specified style and language
 * @param value - Date string, Date object, or null/undefined
 * @param style - The formatting style to use
 * @param language - The target language (vi or en)
 * @returns Formatted date string, or empty string if value is falsy
 */
export function formatDate(
  value: string | Date | null | undefined,
  style: DateFormatStyle,
  language: Language
): string {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);

  // Check for invalid date
  if (isNaN(date.getTime())) return '';

  const locale = LOCALE_MAP[language];

  let options: Intl.DateTimeFormatOptions;

  switch (style) {
    case 'dateFull':
      // vi: dd/MM/yyyy (e.g. 10/12/2025)
      // en: MMM d, yyyy (e.g. Dec 10, 2025)
      options =
        language === 'vi'
          ? { day: '2-digit', month: '2-digit', year: 'numeric' }
          : { day: 'numeric', month: 'short', year: 'numeric' };
      break;

    case 'dateShort':
      // vi: dd/MM (e.g. 10/12)
      // en: MMM d (e.g. Dec 10)
      options =
        language === 'vi'
          ? { day: '2-digit', month: '2-digit' }
          : { day: 'numeric', month: 'short' };
      break;

    case 'monthYear':
      // vi: MM/yyyy (e.g. 12/2025)
      // en: December 2025
      options =
        language === 'vi'
          ? { month: '2-digit', year: 'numeric' }
          : { month: 'long', year: 'numeric' };
      break;

    case 'dateTimeShort':
      // vi: dd/MM/yyyy HH:mm (24-hour)
      // en: MMM d, yyyy h:mm AM/PM (12-hour)
      options =
        language === 'vi'
          ? {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }
          : {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            };
      break;

    case 'timeOnly':
      // vi: HH:mm (24-hour)
      // en: h:mm AM/PM (12-hour)
      options =
        language === 'vi'
          ? { hour: '2-digit', minute: '2-digit', hour12: false }
          : { hour: 'numeric', minute: '2-digit', hour12: true };
      break;

    default:
      options = {};
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}
