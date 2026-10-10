import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, CreditCard, Calendar, Download } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageBanner, Stat } from "@/components/common";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FinancialSummary {
  totalDonations: number;
  totalSubscriptions: number;
  totalCampaigns: number;
  totalRevenue: number;
  recentTransactions: Transaction[];
}

interface Transaction {
  id: string;
  type: "donation" | "subscription" | "campaign" | "ticket";
  amount: number;
  status: string;
  createdAt: string;
  userDisplayName: string;
  description: string;
}

export default function FinancePage() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    (async () => {
      try {
        const data = await api<FinancialSummary>("finance.summary", { period });
        setSummary(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [period]);

  const exportReport = () => {
    const csv = [
      ["Tanggal", "Jenis", "Jumlah", "Status", "Deskripsi", "Pengguna"].join(","),
      ...(summary?.recentTransactions ?? []).map((t) =>
        [
          formatDate(t.createdAt),
          t.type,
          t.amount,
          t.status,
          t.description,
          t.userDisplayName,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-keuangan-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
            Laporan Keuangan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan pendapatan dan transaksi platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Minggu ini</SelectItem>
              <SelectItem value="month">Bulan ini</SelectItem>
              <SelectItem value="year">Tahun ini</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportReport} disabled={!summary}>
            <Download className="mr-2 size-4" aria-hidden />
            Ekspor CSV
          </Button>
        </div>
      </div>

      {loading || !summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Total Donasi"
              value={formatRupiah(summary.totalDonations)}
              hint="Dari semua pengguna"
            />
            <Stat
              label="Total Langganan"
              value={formatRupiah(summary.totalSubscriptions)}
              hint="Pendapatan bulanan"
            />
            <Stat
              label="Total Galang Dana"
              value={formatRupiah(summary.totalCampaigns)}
              hint="Dari semua campaign"
            />
            <Stat
              label="Total Pendapatan"
              value={formatRupiah(summary.totalRevenue)}
              hint="Semua sumber"
            />
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Calendar className="size-5 text-primary" aria-hidden />
                Transaksi Terbaru
              </CardTitle>
              <CardDescription>Daftar transaksi yang baru saja terjadi</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.recentTransactions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <DollarSign className="size-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Belum ada transaksi</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Transaksi akan muncul di sini setelah ada pembayaran.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {summary.recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-secondary/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                          {tx.type === "donation" && <DollarSign className="size-4 text-primary" aria-hidden />}
                          {tx.type === "subscription" && <CreditCard className="size-4 text-primary" aria-hidden />}
                          {tx.type === "campaign" && <TrendingUp className="size-4 text-primary" aria-hidden />}
                          {tx.type === "ticket" && <Calendar className="size-4 text-primary" aria-hidden />}
                        </div>
                        <div>
                          <p className="font-medium">{tx.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {tx.userDisplayName} · {formatDate(tx.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatRupiah(tx.amount)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{tx.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
