import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { translations, type Language, type TranslationKey } from "@/lib/i18n";

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Multilanguage dinonaktifkan untuk sementara — hanya bahasa Indonesia.
// Struktur context dipertahankan agar t() di seluruh halaman tetap berfungsi.
export function I18nProvider({ children }: { children: ReactNode }) {
  const language: Language = "id";

  const setLanguage = useCallback(() => {
    // no-op: pemilihan bahasa dimatikan
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
  }, [language]);

  const t = useCallback(
    (key: TranslationKey): string => translations.id[key] ?? key,
    [],
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, dir: "ltr" }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider");
  return ctx;
}
