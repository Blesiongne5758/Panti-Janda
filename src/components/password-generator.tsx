import { useState, useEffect, useId } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export interface PasswordCriteria {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  symbol: boolean;
}

export interface PasswordStrength {
  score: number; // 0 - 4
  label: string;
  color: string;
  textColor: string;
  criteria: PasswordCriteria;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const criteria: PasswordCriteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  if (!password) {
    return {
      score: 0,
      label: "Belum diisi",
      color: "bg-muted",
      textColor: "text-muted-foreground",
      criteria,
    };
  }

  let metCount = 0;
  if (criteria.length) metCount++;
  if (criteria.uppercase) metCount++;
  if (criteria.lowercase) metCount++;
  if (criteria.number) metCount++;
  if (criteria.symbol) metCount++;

  // Score calculation
  let score = 0;
  if (password.length >= 8 && metCount >= 2) score = 1;
  if (password.length >= 10 && metCount >= 3) score = 2;
  if (password.length >= 12 && metCount >= 4) score = 3;
  if (password.length >= 14 && metCount === 5) score = 4;

  const meta: Record<number, { label: string; color: string; textColor: string }> = {
    0: { label: "Sangat Lemah", color: "bg-destructive", textColor: "text-destructive" },
    1: { label: "Lemah", color: "bg-orange-500", textColor: "text-orange-500" },
    2: { label: "Cukup", color: "bg-amber-500", textColor: "text-amber-500" },
    3: { label: "Kuat", color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
    4: { label: "Sangat Kuat", color: "bg-green-600", textColor: "text-green-600 dark:text-green-400" },
  };

  return {
    score,
    label: meta[score].label,
    color: meta[score].color,
    textColor: meta[score].textColor,
    criteria,
  };
}

export interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const UPPERCASE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const UPPERCASE_ALL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijkmnopqrstuvwxyz";
const LOWERCASE_ALL = "abcdefghijklmnopqrstuvwxyz";
const NUMBER_CHARS = "23456789";
const NUMBER_ALL = "0123456789";
const SYMBOL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

export function generatePassword(options: GeneratorOptions): string {
  const { length, uppercase, lowercase, numbers, symbols, excludeAmbiguous } = options;

  let u = excludeAmbiguous ? UPPERCASE_CHARS : UPPERCASE_ALL;
  let l = excludeAmbiguous ? LOWERCASE_CHARS : LOWERCASE_ALL;
  let n = excludeAmbiguous ? NUMBER_CHARS : NUMBER_ALL;
  let s = SYMBOL_CHARS;

  let pool = "";
  const guaranteed: string[] = [];

  if (uppercase) {
    pool += u;
    guaranteed.push(u[Math.floor(Math.random() * u.length)]);
  }
  if (lowercase) {
    pool += l;
    guaranteed.push(l[Math.floor(Math.random() * l.length)]);
  }
  if (numbers) {
    pool += n;
    guaranteed.push(n[Math.floor(Math.random() * n.length)]);
  }
  if (symbols) {
    pool += s;
    guaranteed.push(s[Math.floor(Math.random() * s.length)]);
  }

  if (!pool) {
    pool = LOWERCASE_ALL + NUMBER_ALL;
  }

  const remainingLength = Math.max(0, length - guaranteed.length);
  const result: string[] = [...guaranteed];

  // Cryptographically stronger random values
  const randomBytes = new Uint32Array(remainingLength);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < remainingLength; i++) {
    result.push(pool[randomBytes[i] % pool.length]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join("");
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = evaluatePasswordStrength(password);

  if (!password) return null;

  return (
    <div className="space-y-2 pt-1 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Kekuatan password:</span>
        <span className={`font-semibold ${strength.textColor}`}>{strength.label}</span>
      </div>

      {/* 4-segment progress bar */}
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((step) => (
          <div
            key={step}
            className={`h-1.5 rounded-full transition-colors ${
              step <= strength.score ? strength.color : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Criteria checklist */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[11px] text-muted-foreground">
        <span className={`flex items-center gap-1.5 ${strength.criteria.length ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
          <Check className={`size-3 ${strength.criteria.length ? "opacity-100" : "opacity-30"}`} />
          Min. 8 karakter
        </span>
        <span className={`flex items-center gap-1.5 ${strength.criteria.uppercase && strength.criteria.lowercase ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
          <Check className={`size-3 ${strength.criteria.uppercase && strength.criteria.lowercase ? "opacity-100" : "opacity-30"}`} />
          Huruf besar & kecil
        </span>
        <span className={`flex items-center gap-1.5 ${strength.criteria.number ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
          <Check className={`size-3 ${strength.criteria.number ? "opacity-100" : "opacity-30"}`} />
          Mengandung angka
        </span>
        <span className={`flex items-center gap-1.5 ${strength.criteria.symbol ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
          <Check className={`size-3 ${strength.criteria.symbol ? "opacity-100" : "opacity-30"}`} />
          Simbol unik (!@#$%)
        </span>
      </div>
    </div>
  );
}

export function StrongPasswordGenerator({
  onApply,
  defaultOpen = false,
}: {
  onApply: (password: string) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [options, setOptions] = useState<GeneratorOptions>({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: true,
  });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const handleRegenerate = () => {
    const pw = generatePassword(options);
    setGeneratedPassword(pw);
  };

  useEffect(() => {
    handleRegenerate();
  }, [options.length, options.uppercase, options.lowercase, options.numbers, options.symbols, options.excludeAmbiguous]);

  const handleCopy = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      toast.success("Password kuat berhasil disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin password");
    }
  };

  const handleApply = () => {
    if (!generatedPassword) return;
    onApply(generatedPassword);
    handleCopy();
    toast.success("Password kuat diterapkan dan disalin!");
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 p-3 shadow-xs">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
        >
          <Sparkles className="size-3.5 text-primary" />
          {isOpen ? "Sembunyikan Pengaturan Pembuat Password" : "Buka Pengaturan Pembuat Password Kuat"}
        </button>
        <span className="text-[11px] text-muted-foreground">Rekomendasi Keamanan Tinggi</span>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-3.5 border-t border-border/50 pt-3">
          {/* Password Display Box */}
          <div className="flex items-center gap-2 rounded-lg bg-secondary/70 p-2 font-mono text-sm">
            <span className="flex-1 truncate tracking-wider font-semibold text-foreground select-all">
              {generatedPassword}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleRegenerate}
              title="Buat password baru"
            >
              <RefreshCw className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              title="Salin ke clipboard"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleApply}
          >
            <KeyRound className="size-4" />
            Gunakan Password Kuat Ini
          </Button>

          {/* Generator Controls */}
          <div className="space-y-3 rounded-lg border border-border/40 bg-background/50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Panjang Password:</span>
              <span className="rounded-md bg-secondary px-2 py-0.5 font-mono font-bold text-primary">
                {options.length} karakter
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={32}
              value={options.length}
              onChange={(e) => setOptions({ ...options, length: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer accent-primary"
            />

            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.uppercase}
                  onChange={(e) => setOptions({ ...options, uppercase: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Huruf Besar (A-Z)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.lowercase}
                  onChange={(e) => setOptions({ ...options, lowercase: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Huruf Kecil (a-z)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.numbers}
                  onChange={(e) => setOptions({ ...options, numbers: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Angka (0-9)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.symbols}
                  onChange={(e) => setOptions({ ...options, symbols: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Simbol (!@#$%)</span>
              </label>
              <label className="col-span-2 flex items-center gap-2 cursor-pointer select-none text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={options.excludeAmbiguous}
                  onChange={(e) => setOptions({ ...options, excludeAmbiguous: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Hindari karakter ambigu (0, O, 1, l, I)</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
