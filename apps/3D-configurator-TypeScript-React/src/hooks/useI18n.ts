// src/hooks/useI18n.ts
import { useCallback } from 'react';
import { useLanguage } from '@/stores';
import { en, mn, type TranslationKeys } from '@/i18n';

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}.${NestedKeyOf<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

type TranslationKey = NestedKeyOf<TranslationKeys>;

const translations = { en, mn };

function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split('.');
  let result: unknown = obj;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }

  return typeof result === 'string' ? result : path;
}

export function useI18n() {
  const language = useLanguage();

  const t = useCallback(
    (key: TranslationKey): string => {
      const translation = translations[language];
      return getNestedValue(translation, key);
    },
    [language]
  );

  return { t, language };
}

/** Standalone translation function (for non-React contexts) */
export function translate(key: string, lang: 'en' | 'mn' = 'en'): string {
  return getNestedValue(translations[lang], key);
}
