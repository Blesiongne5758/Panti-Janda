import { useEffect, useState } from "react";
import {
  XCircle,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
  Headphones,
  Home,
  Copy,
  Check,
  Gamepad2,
  Users,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Link, useRoute } from "@/lib/router";
import { formatRupiah } from "@/lib/format";
import { toast } from "sonner";
import { SEO } from "@/components/seo";

export default function PaymentFailedPage() {
  const { path } = useRoute();
  const query = new URLSearchParams(window.location.hash.split("?")[1] || window.location.search);
  const orderId = query.get("order_id") || "PJ-" + Date.now().toString().slice(-6);
  const transactionStatus = query.get("transaction_status") || "cancel";
  const typeParam = query.get("type") || "";
  const rawAmount = query.get("amount");

  const [copied, setCopied] = useState(false);

  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      toast.success("ID Pesanan disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin ID Pesanan");
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "cancel":
        return "Transaksi Dibatalkan";
      case "expire":
      case "expired":
        return "Waktu Pembayaran Habis (Expired)";
      case "deny":
      case "denied":
        return "Pembayaran Ditolak oleh Bank / Merchant";
      default:
        return "Gagal Diproses";
    }
  };

  const getReturnLink = () => {
    if (typeParam === "esport_registration") return "/kompetisi-esport";
    if (typeParam === "esport_transfer") return "/bursa-transfer";
    if (typeParam === "event_ticket") return "/event";
    if (typeParam === "campaign_donation") return "/galang-dana";
    return "/dasbor";
  };

  const getReturnLabel = () => {
    if (typeParam === "esport_registration") return "Kembali ke Turnamen E-Sport";
    if (typeParam === "esport_transfer") return "Kembali ke Bursa Transfer";
    if (typeParam === "event_ticket") return "Kembali ke Event";
    if (typeParam === "campaign_donation") return "Kembali ke Galang Dana";
    return "Kembali ke Dasbor";
  };

  const displayAmount = rawAmount ? Number(rawAmount) : 0;

  return (
    <div className="container mx-auto max-w-xl px-4 py-12">
      <SEO
        title="Pembayaran Gagal atau Dibatalkan — Panti Janda"
        description="Informasi transaksi pembayaran belum berhasil diselesaikan di platform Panti Janda."
      />

      <Card className="overflow-hidden border-rose-500/30 shadow-lg">
        {/* Banner Status Merah/Rose */}
        <div className="bg-gradient-to-r from-rose-600 to-red-600 p-6 text-center text-white">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-xs">
            <XCircle className="size-10 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Pembayaran Belum Berhasil</h1>
          <p className="mt-1 text-sm text-rose-100">
            Transaksi Anda belum selesai atau telah dibatalkan oleh sistem/pengguna.
          </p>
        </div>

        <CardContent className="space-y-6 p-6">
          {/* Order ID & Status Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Nomor Order / Referensi</p>
              <div className="mt-0.5 flex items-center gap-2">
                <code className="font-mono text-sm font-bold text-foreground">{orderId}</code>
                <button
                  type="button"
                  onClick={handleCopyOrderId}
                  className="text-muted-foreground hover:text-foreground"
                  title="Salin nomor order"
                >
                  {copied ? <Check className="size-3.5 text-rose-600" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <ShieldAlert className="size-3.5" />
                {getStatusLabel(transactionStatus)}
              </span>
            </div>
          </div>

          {/* Rincian Transaksi */}
          <div className="space-y-3 rounded-xl border border-border/70 p-4 text-sm">
            <h3 className="font-semibold text-foreground">Rincian Transaksi</h3>

            <div className="flex justify-between border-b border-border/50 pb-2 text-muted-foreground">
              <span>Keperluan:</span>
              <span className="font-medium text-foreground text-right">
                {typeParam === "esport_registration"
                  ? "Pendaftaran Kompetisi E-Sport"
                  : typeParam === "esport_transfer"
                  ? "Escrow Bursa Transfer Pemain"
                  : typeParam === "event_ticket"
                  ? "Tiket Event & Seminar"
                  : typeParam === "campaign_donation"
                  ? "Donasi Galang Dana"
                  : "Pembayaran Layanan Platform"}
              </span>
            </div>

            {displayAmount > 0 && (
              <div className="flex justify-between border-b border-border/50 pb-2 text-muted-foreground">
                <span>Jumlah yang Ditagihkan:</span>
                <span className="font-display font-bold text-foreground">
                  {formatRupiah(displayAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-muted-foreground">
              <span>Waktu:</span>
              <span className="font-medium text-foreground">
                {new Date().toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
          </div>

          {/* Kemungkinan Penyebab */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4" />
              <span>Kemungkinan Penyebab Pembayaran Gagal:</span>
            </div>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              <li>Jendela pembayaran ditutup sebelum transaksi diselesaikan di bank / e-wallet.</li>
              <li>Batas waktu pembayaran (countdown timer) pada QRIS atau Virtual Account telah habis.</li>
              <li>Saldo e-wallet atau rekening tidak mencukupi, atau limit transaksi harian tercapai.</li>
              <li>Kegagalan koneksi perbankan saat verifikasi OTP atau 3D Secure.</li>
            </ul>
          </div>

          {/* Tips / Solusi */}
          <div className="rounded-xl bg-secondary/40 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Apa yang dapat Anda lakukan?</p>
            <p className="mt-1">
              Jangan khawatir, saldo Anda tidak akan terpotong jika status transaksi gagal. Anda dapat mencoba melakukan pembayaran kembali melalui tautan di bawah atau menghubungi tim dukungan jika saldo Anda terlanjur terdebit.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2.5 bg-secondary/30 p-6 sm:flex-row">
          <Button asChild className="w-full gap-2 sm:w-auto">
            <Link to={getReturnLink()}>
              <RotateCcw className="size-4" />
              {getReturnLabel()}
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
            <a
              href="https://wa.me/6281234567890?text=Halo%20Admin%20Panti%20Janda,%20saya%20mengalami%20kendala%20pembayaran%20dengan%20Order%20ID:%20"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Headphones className="size-4" />
              Bantuan CS (WhatsApp)
            </a>
          </Button>

          <Button asChild variant="ghost" className="w-full gap-2 sm:w-auto">
            <Link to="/">
              <Home className="size-4" />
              Beranda
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
