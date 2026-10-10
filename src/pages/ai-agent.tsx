import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Bitcoin,
  Bot,
  Globe,
  Info,
  Loader2,
  Package,
  Play,
  Settings,
  Square,
  TrendingUp,
  Zap,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { formatRupiah } from "@/lib/format";
import { ROLE_RANK } from "@/lib/constants";
import type { AppSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AccountGate, Chip } from "@/components/common";

interface AgentSignal {
  id: string;
  symbol: string;
  action: "buy" | "sell" | "hold";
  confidence: number;
  reason: string;
  timestamp: string;
  executed: boolean;
}

const MOCK_SIGNALS: AgentSignal[] = [
  { id: "s1", symbol: "IDX:IHSG", action: "buy", confidence: 0.82, reason: "Momentum bullish terdeteksi, volume meningkat 40%", timestamp: new Date(Date.now() - 300000).toISOString(), executed: true },
  { id: "s2", symbol: "IDX:BBCA", action: "hold", confidence: 0.65, reason: "Konsolidasi di area support, tunggu breakout", timestamp: new Date(Date.now() - 600000).toISOString(), executed: false },
  { id: "s3", symbol: "IDX:BBRI", action: "sell", confidence: 0.74, reason: "RSI overbought, potensi koreksi jangka pendek", timestamp: new Date(Date.now() - 900000).toISOString(), executed: true },
  { id: "s4", symbol: "IDX:TLKM", action: "buy", confidence: 0.71, reason: "Pola double bottom terkonfirmasi", timestamp: new Date(Date.now() - 1200000).toISOString(), executed: false },
  { id: "s5", symbol: "IDX:BMRI", action: "buy", confidence: 0.88, reason: "Breakout resistance dengan volume tinggi", timestamp: new Date(Date.now() - 1500000).toISOString(), executed: true },
  { id: "s6", symbol: "IDX:GOTO", action: "sell", confidence: 0.69, reason: "Trend bearish, MA crossover terdeteksi", timestamp: new Date(Date.now() - 1800000).toISOString(), executed: false },
];

const MOCK_CRYPTO_SIGNALS: AgentSignal[] = [
  { id: "c1", symbol: "BTC:USDT", action: "buy", confidence: 0.85, reason: "Breakout di atas resistance $68K, volume meningkat", timestamp: new Date(Date.now() - 250000).toISOString(), executed: true },
  { id: "c2", symbol: "ETH:USDT", action: "buy", confidence: 0.78, reason: "Pola bull flag terkonfirmasi di timeframe 4H", timestamp: new Date(Date.now() - 500000).toISOString(), executed: true },
  { id: "c3", symbol: "SOL:USDT", action: "sell", confidence: 0.72, reason: "RSI overbought di H4, potensi koreksi jangka pendek", timestamp: new Date(Date.now() - 750000).toISOString(), executed: false },
  { id: "c4", symbol: "BNB:USDT", action: "hold", confidence: 0.61, reason: "Konsolidasi di area $575-$585, tunggu breakout", timestamp: new Date(Date.now() - 1000000).toISOString(), executed: false },
  { id: "c5", symbol: "XRP:USDT", action: "buy", confidence: 0.67, reason: "Pola ascending triangle, target $0.65", timestamp: new Date(Date.now() - 1300000).toISOString(), executed: true },
  { id: "c6", symbol: "DOGE:USDT", action: "sell", confidence: 0.70, reason: "Death cross pada MA20/MA50, momentum bearish", timestamp: new Date(Date.now() - 1600000).toISOString(), executed: false },
];

const MOCK_COMMODITY_SIGNALS: AgentSignal[] = [
  { id: "k1", symbol: "COM:GOLD", action: "buy", confidence: 0.84, reason: "Emas menembus resistance $2.350, permintaan safe-haven meningkat", timestamp: new Date(Date.now() - 280000).toISOString(), executed: true },
  { id: "k2", symbol: "COM:OIL", action: "sell", confidence: 0.73, reason: "Stok minyak naik, tekanan bearish pada harga", timestamp: new Date(Date.now() - 520000).toISOString(), executed: true },
  { id: "k3", symbol: "COM:SILVER", action: "buy", confidence: 0.76, reason: "Pola double bottom di timeframe daily, potensi rally", timestamp: new Date(Date.now() - 780000).toISOString(), executed: false },
  { id: "k4", symbol: "COM:CPO", action: "hold", confidence: 0.62, reason: "Konsolidasi di area support, tunggu data ekspor", timestamp: new Date(Date.now() - 1050000).toISOString(), executed: false },
  { id: "k5", symbol: "COM:COPPER", action: "buy", confidence: 0.79, reason: "Permintaan industri meningkat, stok menipis", timestamp: new Date(Date.now() - 1350000).toISOString(), executed: true },
  { id: "k6", symbol: "COM:GAS", action: "sell", confidence: 0.68, reason: "Musim hangat mengurangi permintaan, tren bearish", timestamp: new Date(Date.now() - 1650000).toISOString(), executed: false },
];

const MOCK_FOREX_SIGNALS: AgentSignal[] = [
  { id: "f1", symbol: "FX:EURUSD", action: "buy", confidence: 0.83, reason: "EUR menguat setelah data inflasi zona euro di atas ekspektasi", timestamp: new Date(Date.now() - 260000).toISOString(), executed: true },
  { id: "f2", symbol: "FX:GBPUSD", action: "buy", confidence: 0.77, reason: "Pola head and shoulders terkonfirmasi, target 1.2800", timestamp: new Date(Date.now() - 510000).toISOString(), executed: true },
  { id: "f3", symbol: "FX:USDJPY", action: "sell", confidence: 0.75, reason: "BOJ sinyal hawkish, yen berpotensi menguat", timestamp: new Date(Date.now() - 770000).toISOString(), executed: false },
  { id: "f4", symbol: "FX:AUDUSD", action: "hold", confidence: 0.60, reason: "Konsolidasi di area 0.6500-0.6600, tunggu data RBA", timestamp: new Date(Date.now() - 1020000).toISOString(), executed: false },
  { id: "f5", symbol: "FX:USDIDR", action: "sell", confidence: 0.71, reason: "BI intervensi memperkuat Rupiah, tren bearish USD/IDR", timestamp: new Date(Date.now() - 1320000).toISOString(), executed: true },
  { id: "f6", symbol: "FX:USDCAD", action: "buy", confidence: 0.69, reason: "Minyak turun melemahkan CAD, USD/CAD berpotensi naik", timestamp: new Date(Date.now() - 1620000).toISOString(), executed: false },
];

type MarketKind = "saham" | "crypto" | "komoditas" | "forex";

const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
  buy: { label: "BUY", color: "text-emerald-700", bg: "bg-emerald-100" },
  sell: { label: "SELL", color: "text-rose-700", bg: "bg-rose-100" },
  hold: { label: "HOLD", color: "text-amber-700", bg: "bg-amber-100" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export default function AiAgentPage() {
  const { ready, account } = useAuth();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const [settings, setSettings] = useState<AppSettings["aiTradingAgent"] | null>(null);
  const [market, setMarket] = useState<MarketKind>("saham");
  const [signals, setSignals] = useState<AgentSignal[]>(MOCK_SIGNALS);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api<{ aiTradingAgent: AppSettings["aiTradingAgent"] }>("aiTradingAgent.settings");
      setSettings(res.aiTradingAgent);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSignals((prev) => {
        const symbols = market === "crypto"
          ? ["BTC:USDT", "ETH:USDT", "BNB:USDT", "SOL:USDT", "XRP:USDT", "DOGE:USDT"]
          : market === "komoditas"
            ? ["COM:GOLD", "COM:SILVER", "COM:OIL", "COM:GAS", "COM:COPPER", "COM:CPO"]
            : market === "forex"
              ? ["FX:EURUSD", "FX:GBPUSD", "FX:USDJPY", "FX:AUDUSD", "FX:USDIDR", "FX:USDCAD"]
              : ["IDX:IHSG", "IDX:BBCA", "IDX:BBRI", "IDX:TLKM", "IDX:BMRI"];
        const actions: ("buy" | "sell" | "hold")[] = ["buy", "sell", "hold"];
        const reasons = market === "crypto"
          ? [
              "Breakout di atas resistance, volume meningkat",
              "Pola bull flag terkonfirmasi di timeframe 4H",
              "RSI overbought, potensi koreksi jangka pendek",
              "Support kuat teruji, potensi rebound",
              "MACD crossover bullish di H4",
              "Divergence bearish pada RSI daily",
              "Pola ascending triangle terkonfirmasi",
              "Death cross pada MA20/MA50",
            ]
          : market === "komoditas"
            ? [
                "Permintaan global meningkat, stok menipis",
                "Pola double bottom terkonfirmasi di daily",
                "Data inventaris mingguan menunjukkan penarikan stok",
                "Konsolidasi di area support kunci",
                "Musim permintaan tinggi, potensi rally",
                "Divergence bearish pada RSI weekly",
                "Breakout resistance dengan volume tinggi",
                "Tren bearish, MA crossover terdeteksi",
              ]
            : market === "forex"
              ? [
                  "Data inflasi di atas ekspektasi, mata uang menguat",
                  "Bank sentral sinyal hawkish, potensi apresiasi",
                  "Pola head and shoulders terkonfirmasi",
                  "NFP lebih kuat dari perkiraan, USD menguat",
                  "Konsolidasi di area support kunci, tunggu breakout",
                  "Divergence bearish pada RSI daily",
                  "Cross MA20/MA50 mengkonfirmasi tren baru",
                  "Intervensi bank sentral melemahkan mata uang",
                ]
              : [
                  "Pola candlestick bullish terdeteksi",
                  "Volume di atas rata-rata 20 hari",
                  "Support kuat teruji, potensi rebound",
                  "Indikator MACD menunjukkan momentum positif",
                  "Resistance kuat, tunggu konfirmasi",
                  "Divergence bearish pada RSI",
                  "Trend following signal, MA20 > MA50",
                  "Breakout dari pola segitiga",
                ];
        const newSignal: AgentSignal = {
          id: `s_${Date.now()}`,
          symbol: symbols[Math.floor(Math.random() * symbols.length)],
          action: actions[Math.floor(Math.random() * actions.length)],
          confidence: 0.55 + Math.random() * 0.4,
          reason: reasons[Math.floor(Math.random() * reasons.length)],
          timestamp: new Date().toISOString(),
          executed: Math.random() > 0.5,
        };
        return [newSignal, ...prev].slice(0, 20);
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [market]);

  useEffect(() => {
    if (market === "crypto") setSignals(MOCK_CRYPTO_SIGNALS);
    else if (market === "komoditas") setSignals(MOCK_COMMODITY_SIGNALS);
    else if (market === "forex") setSignals(MOCK_FOREX_SIGNALS);
    else setSignals(MOCK_SIGNALS);
  }, [market]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!account) {
    return (
      <AccountGate
        title="Masuk untuk mengakses AI Trading Agent"
        description="Fitur ini tersedia untuk member Sosialita ke atas."
        actionLabel="Masuk"
      />
    );
  }

  if (rank < 3) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-20 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50">
          <Info className="size-6 text-amber-600" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold">Fitur premium</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AI Trading Agent tersedia untuk tier Sosialita ke atas.
        </p>
        <Button asChild className="mt-4">
          <Link to="/langganan">Lihat Langganan</Link>
        </Button>
      </div>
    );
  }

  const activeSignals = signals.filter((s) => s.action !== "hold");
  const buySignals = signals.filter((s) => s.action === "buy");
  const sellSignals = signals.filter((s) => s.action === "sell");
  const avgConfidence = signals.length > 0
    ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bot className="size-6 text-violet-600" aria-hidden />
          <h1 className="font-display text-3xl font-semibold">AI Trading Agent</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none rounded-lg border border-border p-1">
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${market === "saham" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setMarket("saham")}
            >
              <TrendingUp className="size-3.5" aria-hidden />
              Saham
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${market === "crypto" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setMarket("crypto")}
            >
              <Bitcoin className="size-3.5" aria-hidden />
              Crypto
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${market === "komoditas" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setMarket("komoditas")}
            >
              <Package className="size-3.5" aria-hidden />
              Komoditas
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors ${market === "forex" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setMarket("forex")}
            >
              <Globe className="size-3.5" aria-hidden />
              Forex
            </button>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/dasbor">Kembali</Link>
          </Button>
        </div>
      </div>

      {settings ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
          <div className="flex items-start gap-2">
            <Bot className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden />
            <div>
              <p className="text-sm font-medium text-violet-800">{settings.name}</p>
              <p className="text-xs text-violet-700">{settings.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip>Model: {settings.model}</Chip>
                <Chip>Strategi: {settings.strategy}</Chip>
                <Chip>Risiko: {settings.riskLevel}</Chip>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-violet-50">
              <Zap className="size-5 text-violet-600" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Sinyal</p>
              <p className="font-display text-lg font-semibold">{signals.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-emerald-50">
              <ArrowUpRight className="size-5 text-emerald-600" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sinyal Buy</p>
              <p className="font-display text-lg font-semibold">{buySignals.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-rose-50">
              <ArrowDownRight className="size-5 text-rose-600" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sinyal Sell</p>
              <p className="font-display text-lg font-semibold">{sellSignals.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-blue-50">
              <TrendingUp className="size-5 text-blue-600" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Confidence Rata-rata</p>
              <p className="font-display text-lg font-semibold">{(avgConfidence * 100).toFixed(0)}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Sinyal Trading</CardTitle>
              <CardDescription>Analisis real-time dari AI agent. Sinyal baru muncul setiap beberapa detik.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {signals.map((signal) => {
                  const meta = ACTION_META[signal.action];
                  return (
                    <div key={signal.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 rounded px-2 py-0.5 text-xs font-semibold ${meta.bg} ${meta.color}`}>
                          {meta.label}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{signal.symbol}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{signal.reason}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{timeAgo(signal.timestamp)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <p className="text-sm font-semibold">{(signal.confidence * 100).toFixed(0)}%</p>
                        </div>
                        {signal.executed ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Dieksekusi
                          </span>
                        ) : (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {settings ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Settings className="size-4" aria-hidden />
                  Konfigurasi Agent
                </CardTitle>
                <CardDescription>Parameter yang dikonfigurasi admin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Auto eksekusi</span>
                  <span className="text-sm font-medium">{settings.autoExecute ? "Aktif" : "Nonaktif"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Notifikasi trade</span>
                  <span className="text-sm font-medium">{settings.notifyOnTrade ? "Aktif" : "Nonaktif"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Max trade/hari</span>
                  <span className="text-sm font-medium">{settings.maxDailyTrades}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Min confidence</span>
                  <span className="text-sm font-medium">{(settings.minConfidence * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Position size</span>
                  <span className="text-sm font-medium">{settings.parameters.positionSizePercent}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Jadwal</span>
                  <span className="text-sm font-medium">
                    {settings.schedule.enabled
                      ? `${settings.schedule.startHour}:00 - ${settings.schedule.endHour}:00`
                      : "24 jam"}
                  </span>
                </div>
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground">Market yang diizinkan</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {settings.allowedMarkets.map((m) => (
                      <Chip key={m}>{m}</Chip>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Performa Agent</CardTitle>
              <CardDescription>Statistik 7 hari terakhir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Win rate</span>
                <span className="text-sm font-semibold text-emerald-600">
                  {market === "crypto" ? "72%" : market === "forex" ? "74%" : market === "komoditas" ? "70%" : "68%"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total trade</span>
                <span className="text-sm font-semibold">
                  {market === "crypto" ? "53" : market === "forex" ? "62" : market === "komoditas" ? "41" : "47"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Profit</span>
                <span className="text-sm font-semibold text-emerald-600">
                  +{market === "crypto" ? "$1,245.80" : market === "forex" ? "$1,520.30" : market === "komoditas" ? "$980.50" : formatRupiah(2450000)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Loss</span>
                <span className="text-sm font-semibold text-rose-600">
                  -{market === "crypto" ? "$389.20" : market === "forex" ? "$412.60" : market === "komoditas" ? "$275.40" : formatRupiah(890000)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Net P&L</span>
                <span className="text-sm font-semibold text-emerald-600">
                  +{market === "crypto" ? "$856.60" : market === "forex" ? "$1,107.70" : market === "komoditas" ? "$705.10" : formatRupiah(1560000)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
