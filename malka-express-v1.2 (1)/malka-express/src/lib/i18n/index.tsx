import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toAppError } from '../errors';
import { en, type Dictionary, type TranslationKey } from './en';
import { am } from './am';
import { om } from './om';

export type Language = 'en' | 'am' | 'om';

export const LANGUAGES: { code: Language; label: string; locale: string }[] = [
  { code: 'en', label: 'English', locale: 'en-GB' },
  { code: 'am', label: 'አማርኛ', locale: 'am-ET' },
  { code: 'om', label: 'Afaan Oromoo', locale: 'om-ET' },
];

const DICTIONARIES: Record<Language, Dictionary> = { en, am, om };
const STORAGE_KEY = 'malka-express:lang';

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'am' || stored === 'om') return stored;
  } catch {
    /* storage unavailable (private mode) — fall through */
  }
  return 'en';
}

interface I18nValue {
  lang: Language;
  locale: string;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  /** Translates any thrown error into a user-facing message. */
  tError: (error: unknown) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTIONARIES[lang];
    const t = (key: TranslationKey) => dict[key] ?? en[key];
    const tError = (error: unknown) => {
      const key = `err.${toAppError(error).code}` as TranslationKey;
      return key in en ? t(key) : t('err.generic');
    };
    const locale = LANGUAGES.find((l) => l.code === lang)?.locale ?? 'en-GB';
    return { lang, locale, setLang, t, tError };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export type { TranslationKey };
