import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { en } from '../locales/en';
import { mr } from '../locales/mr';
import { hi } from '../locales/hi';
import type { TranslationKey } from '../locales/keys';

/**
 * Translation for English, Marathi and Hindi.
 *
 * Previously there were two languages, roughly fifty keys, and almost no use
 * of the lookup: text lived inline as `language === 'mr' ? '…' : '…'` in 179
 * places across 17 files, with another 379 lines of Marathi hard-coded in
 * JSX. Adding a third language meant editing every one of them by hand.
 *
 * Both sides of those ternaries have been extracted into locales/{en,mr,hi},
 * keyed and typed, so `t()` is checked at build time and a missing string is
 * a compile error rather than a silent fall back to the wrong language.
 *
 * One language is shown at a time. The interface used to print both at once
 * ("गोदाम धान्य साठा (Live Grain Stock Balance)"), which doubled the length
 * of every label and was worst on a phone.
 */

export type Language = 'en' | 'mr' | 'hi';

export const LANGUAGES: { id: Language; label: string; englishLabel: string }[] = [
  { id: 'mr', label: 'मराठी', englishLabel: 'Marathi' },
  { id: 'hi', label: 'हिंदी', englishLabel: 'Hindi' },
  { id: 'en', label: 'English', englishLabel: 'English' },
];

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, mr, hi };

const STORAGE_KEY = 'adatya_lang';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Cycles through the available languages, for the compact header control. */
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
  /** Same as t(), with {placeholders} replaced from the supplied values. */
  tf: (key: TranslationKey, values: Record<string, string | number>) => string;
  /** Picks the right string when a value is supplied per language. */
  pick: (values: Partial<Record<Language, string>>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function readStored(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'mr' || saved === 'hi') {
      return saved;
    }
  } catch {
    /* storage unavailable */
  }
  // Marathi by default: this is a Maharashtra mandi product.
  return 'mr';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStored);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable; the choice simply will not persist */
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState(current => {
      const order: Language[] = ['mr', 'hi', 'en'];
      const next = order[(order.indexOf(current) + 1) % order.length];
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<LanguageContextType>(() => {
    const dictionary = DICTIONARIES[language];
    return {
      language,
      setLanguage,
      toggleLanguage,
      // en is the fallback, so an untranslated string is readable rather than
      // showing a raw key to a trader.
      t: (key: TranslationKey) => dictionary[key] ?? en[key] ?? key,
      tf: (key: TranslationKey, values: Record<string, string | number>) => {
        const template = dictionary[key] ?? en[key] ?? key;
        return template.replace(/\{(\w+)\}/g, (match, name) =>
          name in values ? String(values[name]) : match);
      },
      pick: (values: Partial<Record<Language, string>>) =>
        values[language] ?? values.en ?? values.mr ?? '',
    };
  }, [language, setLanguage, toggleLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
