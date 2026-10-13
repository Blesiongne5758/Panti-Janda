import { Globe } from "lucide-react";
import { LANGUAGES, type Language } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n-context";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage } = useTranslation();

  return (
    <div className={cn("flex items-center gap-1 rounded-lg border border-border p-0.5", className)}>
      <Globe className="size-3.5 text-muted-foreground ml-1.5" aria-hidden />
      {(Object.keys(LANGUAGES) as Language[]).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
            language === lang
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={LANGUAGES[lang].nativeName}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
