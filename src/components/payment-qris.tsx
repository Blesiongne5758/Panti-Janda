import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { api } from "@/lib/api";

interface QrisSettings {
  qrisEnabled: boolean;
  qrisImageUrl: string;
  qrisAccountName: string;
}

export function PaymentQris({ amount, compact = false }: { amount?: number; compact?: boolean }) {
  const [settings, setSettings] = useState<QrisSettings | null>(null);
  useEffect(() => {
    let active = true;
    api<QrisSettings>("payment.qrisSettings")
      .then((value) => { if (active) setSettings(value); })
      .catch(() => { if (active) setSettings(null); });
    return () => { active = false; };
  }, []);

  if (!settings?.qrisEnabled || !settings.qrisImageUrl) return null;
  return (
    <section className={`rounded-xl border border-border bg-card ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <QrCode className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">QRIS</h3>
          <p className="text-sm text-muted-foreground">
            {settings.qrisAccountName ? `Pembayaran ke ${settings.qrisAccountName}.` : "Scan QRIS untuk melakukan pembayaran."}
            {amount ? ` Masukkan nominal ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)}.` : ""}
          </p>
          <img src={settings.qrisImageUrl} alt="QRIS pembayaran Panti Janda" className={`mt-3 rounded-lg border bg-white object-contain p-2 ${compact ? "size-36" : "size-48"}`} />
          <p className="mt-2 text-xs text-muted-foreground">Pembayaran QRIS statis perlu diverifikasi admin sebelum pesanan, tiket, atau tier diaktifkan.</p>
        </div>
      </div>
    </section>
  );
}
