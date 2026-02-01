import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';
type Language = 'mn' | 'en';
type TranslationMap = Record<string, string>;

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  language: Language;
  toggleLanguage: () => void;
  t: (key: string, obj?: TranslationMap) => string;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getInitialTheme = (): Theme => {
  return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
};

const getInitialLanguage = (): Language => {
  return localStorage.getItem('language') === 'en' ? 'en' : 'mn';
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Theme State
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Language State
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  // Theme Change Effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Language Change Effect
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'mn' ? 'en' : 'mn'));
  };

  // Translation Helper
  const t = (key: string, obj?: TranslationMap) => {
    if (!obj) return key;
    return obj[language] || obj['mn'] || key; // Fallback to Mongolian
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, language, toggleLanguage, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
