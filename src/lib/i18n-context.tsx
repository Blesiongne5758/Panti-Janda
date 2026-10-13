import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, LANGUAGES, type Language, type TranslationKey } from "@/lib/i18n";

const STORAGE_KEY = "pj-language";

function detectLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in LANGUAGES) return stored as Language;
  } catch {}
  const nav = navigator.language?.slice(0, 2);
  if (nav === "ar") return "ar";
  if (nav === "en") return "en";
  return "id";
}

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGUAGES[lang].dir;
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = LANGUAGES[language].dir;
  }, [language]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key] ?? translations.id[key] ?? key;
    },
    [language],
  );

  const dir = LANGUAGES[language].dir;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider");
  return ctx;
}
