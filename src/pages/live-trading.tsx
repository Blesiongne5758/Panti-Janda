import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bitcoin,
  Bot,
  Globe,
  Loader2,
  Maximize2,
  Package,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { formatRupiah } from "@/lib/format";
import { ROLE_RANK } from "@/lib/constants";
import type { AppSettings } from "@/lib/types";
import { useRealtimePrices, useTwelveDataPrices, useStableCandles } from "@/lib/price-stream";
import type { Candle } from "@/lib/price-stream";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AccountGate } from "@/components/common";
import { toast } from "sonner";

interface DemoPosition {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  quantity: number;
  openedAt: string;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  status: "open" | "closed";
  closedAt?: string;
  exitPrice?: number;
}

interface DemoTrade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  timestamp: string;
  pnl?: number;
}

const DEMO_SYMBOLS = [
  { symbol: "IDX:IHSG", label: "IHSG", basePrice: 7250 },
  { symbol: "IDX:BBCA", label: "BBCA", basePrice: 9150 },
  { symbol: "IDX:BBRI", label: "BBRI", basePrice: 5425 },
  { symbol: "IDX:TLKM", label: "TLKM", basePrice: 3820 },
  { symbol: "IDX:GOTO", label: "GOTO", basePrice: 74 },
  { symbol: "IDX:BRIS", label: "BRIS", basePrice: 1520 },
  { symbol: "IDX:BMRI", label: "BMRI", basePrice: 6375 },
  { symbol: "IDX:UNVR", label: "UNVR", basePrice: 2910 },
];

const DEMO_CRYPTO = [
  { symbol: "BTC:USDT", label: "Bitcoin", basePrice: 67500 },
  { symbol: "ETH:USDT", label: "Ethereum", basePrice: 3450 },
  { symbol: "BNB:USDT", label: "BNB", basePrice: 580 },
  { symbol: "SOL:USDT", label: "Solana", basePrice: 172 },
  { symbol: "XRP:USDT", label: "XRP", basePrice: 0.58 },
  { symbol: "DOGE:USDT", label: "Dogecoin", basePrice: 0.165 },
  { symbol: "ADA:USDT", label: "Cardano", basePrice: 0.45 },
  { symbol: "AVAX:USDT", label: "Avalanche", basePrice: 35.5 },
];

const DEMO_COMMODITIES = [
  { symbol: "COM:GOLD", label: "Emas", basePrice: 2345 },
  { symbol: "COM:SILVER", label: "Perak", basePrice: 27.5 },
  { symbol: "COM:OIL", label: "Minyak Mentah", basePrice: 78.5 },
  { symbol: "COM:GAS", label: "Gas Alam", basePrice: 2.85 },
  { symbol: "COM:COPPER", label: "Tembaga", basePrice: 4.15 },
  { symbol: "COM:CPO", label: "CPO", basePrice: 850 },
  { symbol: "COM:WHEAT", label: "Gandum", basePrice: 580 },
  { symbol: "COM:CORN", label: "Jagung", basePrice: 425 },
];

const DEMO_FOREX = [
  { symbol: "FX:EURUSD", label: "EUR/USD", basePrice: 1.0865 },
  { symbol: "FX:GBPUSD", label: "GBP/USD", basePrice: 1.2715 },
  { symbol: "FX:USDJPY", label: "USD/JPY", basePrice: 151.45 },
  { symbol: "FX:USDCHF", label: "USD/CHF", basePrice: 0.8825 },
  { symbol: "FX:AUDUSD", label: "AUD/USD", basePrice: 0.6545 },
  { symbol: "FX:USDCAD", label: "USD/CAD", basePrice: 1.3615 },
  { symbol: "FX:NZDUSD", label: "NZD/USD", basePrice: 0.6015 },
  { symbol: "FX:USDIDR", label: "USD/IDR", basePrice: 15875 },
];

type MarketKind = "saham" | "crypto" | "komoditas" | "forex";

const LIVE_SYMBOLS: Record<MarketKind, { symbol: string; label: string; apiSymbol: string }[]> = {
  saham: [
    { symbol: "AAPL", label: "Apple", apiSymbol: "AAPL" },
    { symbol: "GOOGL", label: "Google", apiSymbol: "GOOGL" },
    { symbol: "MSFT", label: "Microsoft", apiSymbol: "MSFT" },
    { symbol: "AMZN", label: "Amazon", apiSymbol: "AMZN" },
    { symbol: "TSLA", label: "Tesla", apiSymbol: "TSLA" },
    { symbol: "META", label: "Meta", apiSymbol: "META" },
    { symbol: "NVDA", label: "NVIDIA", apiSymbol: "NVDA" },
    { symbol: "JPM", label: "JPMorgan", apiSymbol: "JPM" },
  ],
  crypto: [
    { symbol: "BTC/USD", label: "Bitcoin", apiSymbol: "BTC/USD" },
    { symbol: "ETH/USD", label: "Ethereum", apiSymbol: "ETH/USD" },
    { symbol: "SOL/USD", label: "Solana", apiSymbol: "SOL/USD" },
    { symbol: "XRP/USD", label: "XRP", apiSymbol: "XRP/USD" },
    { symbol: "DOGE/USD", label: "Dogecoin", apiSymbol: "DOGE/USD" },
    { symbol: "ADA/USD", label: "Cardano", apiSymbol: "ADA/USD" },
    { symbol: "AVAX/USD", label: "Avalanche", apiSymbol: "AVAX/USD" },
    { symbol: "BNB/USD", label: "BNB", apiSymbol: "BNB/USD" },
  ],
  komoditas: [
    { symbol: "XAU/USD", label: "Emas", apiSymbol: "XAU/USD" },
    { symbol: "XAG/USD", label: "Perak", apiSymbol: "XAG/USD" },
    { symbol: "USO", label: "Minyak (USO)", apiSymbol: "USO" },
    { symbol: "UNG", label: "Gas Alam (UNG)", apiSymbol: "UNG" },
    { symbol: "PPLT", label: "Platinum", apiSymbol: "PPLT" },
    { symbol: "XLE", label: "Energi (XLE)", apiSymbol: "XLE" },
    { symbol: "DBA", label: "Pertanian (DBA)", apiSymbol: "DBA" },
  ],
  forex: [
    { symbol: "EUR/USD", label: "EUR/USD", apiSymbol: "EUR/USD" },
    { symbol: "GBP/USD", label: "GBP/USD", apiSymbol: "GBP/USD" },
    { symbol: "USD/JPY", label: "USD/JPY", apiSymbol: "USD/JPY" },
    { symbol: "USD/CHF", label: "USD/CHF", apiSymbol: "USD/CHF" },
    { symbol: "AUD/USD", label: "AUD/USD", apiSymbol: "AUD/USD" },
    { symbol: "USD/CAD", label: "USD/CAD", apiSymbol: "USD/CAD" },
    { symbol: "NZD/USD", label: "NZD/USD", apiSymbol: "NZD/USD" },
  ],
};

function getLiveSymbols(market: MarketKind) {
  return LIVE_SYMBOLS[market];
}

const DEMO_BALANCE = 100_000_000;

const ACADEMY_LABEL: Record<MarketKind, string> = {
  saham: "Akademi Trading Saham",
  crypto: "Akademi Trading Crypto",
  komoditas: "Akademi Trading Komoditas",
  forex: "Akademi Trading Forex",
};

function getDemoSymbols(market: MarketKind) {
  if (market === "crypto") return DEMO_CRYPTO;
  if (market === "komoditas") return DEMO_COMMODITIES;
  if (market === "forex") return DEMO_FOREX;
  return DEMO_SYMBOLS;
}

function formatPrice(price: number, market: MarketKind): string {
  const prefix = market !== "saham" ? "$" : "";
  return `${prefix}${formatNum(price, market)}`;
}

function formatNum(value: number, market: MarketKind): string {
  if (market === "forex") {
    if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 5 });
  }
  if (market !== "saham") {
    if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (value >= 1) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  }
  return value.toLocaleString("id-ID");
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} />
    </svg>
  );
}

function ProfessionalChart({
  candles,
  labels,
  market,
  viewMode,
}: {
  candles: Candle[];
  labels: string[];
  market: MarketKind;
  viewMode: "line" | "candle";
}) {
  if (candles.length < 2) return null;

  const yLabelCount = 6;
  const xLabelStep = Math.max(1, Math.floor(labels.length / 8));
  const padL = 8;
  const padR = 64;
  const padT = 12;
  const padB = 28;
  const w = 800;
  const h = 400;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const padding = (rawMax - rawMin) * 0.05 || rawMax * 0.01;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const range = max - min || 1;

  const yScale = (v: number) => padT + chartH * (1 - (v - min) / range);
  const candleW = chartW / candles.length;
  const bodyW = Math.max(2, candleW * 0.6);

  const yLabels: number[] = [];
  for (let i = 0; i <= yLabelCount; i++) {
    yLabels.push(min + (range * i) / yLabelCount);
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="grid" width={chartW / 8} height={chartH / yLabelCount} patternUnits="userSpaceOnUse" x={padL} y={padT}>
          <path d={`M ${chartW / 8} 0 L 0 0 0 ${chartH / yLabelCount}`} fill="none" stroke="currentColor" strokeWidth={0.3} opacity={0.15} />
        </pattern>
      </defs>

      <rect x={padL} y={padT} width={chartW} height={chartH} fill="url(#grid)" />

      {yLabels.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={padL + chartW} y1={yScale(v)} y2={yScale(v)} stroke="currentColor" strokeWidth={0.3} opacity={0.1} />
          <text x={padL + chartW + 6} y={yScale(v) + 3} className="fill-muted-foreground" fontSize={9} fontFamily="monospace">
            {formatNum(v, market)}
          </text>
        </g>
      ))}

      {labels.map((label, i) => {
        if (i % xLabelStep !== 0) return null;
        const x = padL + i * candleW + candleW / 2;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={padT} y2={padT + chartH} stroke="currentColor" strokeWidth={0.3} opacity={0.08} />
            <text x={x} y={h - 6} className="fill-muted-foreground" fontSize={8} textAnchor="middle" fontFamily="monospace">
              {label}
            </text>
          </g>
        );
      })}

      {viewMode === "line" ? (
        <polyline
          fill="none"
          stroke={candles[candles.length - 1].close >= candles[0].open ? "#16a34a" : "#e11d48"}
          strokeWidth={1.5}
          points={candles.map((c, i) => {
            const x = padL + i * candleW + candleW / 2;
            const y = yScale(c.close);
            return `${x},${y}`;
          }).join(" ")}
        />
      ) : (
        candles.map((c, i) => {
          const x = padL + i * candleW + candleW / 2;
          const bullish = c.close >= c.open;
          const color = bullish ? "#16a34a" : "#e11d48";
          const bodyTop = yScale(Math.max(c.open, c.close));
          const bodyBot = yScale(Math.min(c.open, c.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={yScale(c.high)} y2={yScale(c.low)} stroke={color} strokeWidth={1} />
              <rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} rx={0.5} />
            </g>
          );
        })
      )}

      <line x1={padL} x2={padL + chartW} y1={padT + chartH} y2={padT + chartH} stroke="currentColor" strokeWidth={0.5} opacity={0.2} />
      <line x1={padL} x2={padL} y1={padT} y2={padT + chartH} stroke="currentColor" strokeWidth={0.5} opacity={0.2} />
    </svg>
  );
}

export default function LiveTradingPage() {
  const { ready, account } = useAuth();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const [settings, setSettings] = useState<AppSettings["liveTrading"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [market, setMarket] = useState<MarketKind>("saham");
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [demoBalance, setDemoBalance] = useState(DEMO_BALANCE);
  const [demoPositions, setDemoPositions] = useState<DemoPosition[]>([]);
  const [demoTrades, setDemoTrades] = useState<DemoTrade[]>([]);
  const [orderQty, setOrderQty] = useState(100);
  const [showAcademyGate, setShowAcademyGate] = useState(false);
  const [chartView, setChartView] = useState<"line" | "candle">("candle");
  const [expandedChart, setExpandedChart] = useState(false);
  const [tradeTab, setTradeTab] = useState<"market" | "risk" | "sl" | "tp">("market");
  const [positionTab, setPositionTab] = useState<"positions" | "pending" | "history">("positions");
  const [slPrice, setSlPrice] = useState("");
  const [tpPrice, setTpPrice] = useState("");

  const demoStreamSymbols = getDemoSymbols(market).map((s) => ({ symbol: s.symbol, base: s.basePrice }));
  const liveStreamSymbols = getLiveSymbols(market).map((s) => s.apiSymbol);
  const apiKey = settings?.apiKey ?? "";

  const demoData = useRealtimePrices(isDemo ? demoStreamSymbols : []);
  const LiveData = useTwelveDataPrices(!isDemo ? liveStreamSymbols : [], apiKey, selectedSymbol);
  const activeData = isDemo ? demoData : LiveData;
  const prices = activeData.prices;
  const priceStatus = activeData.status;
  const stableCandles = useStableCandles(prices, selectedSymbol);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api<{ liveTrading: AppSettings["liveTrading"] }>("liveTrading.settings");
      setSettings(res.liveTrading);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    if (urlParams.get("mode") === "demo") setIsDemo(true);
  }, []);

  useEffect(() => {
    if (isDemo) {
      setSelectedSymbol(getDemoSymbols(market)[0].symbol);
    } else {
      setSelectedSymbol(getLiveSymbols(market)[0].apiSymbol);
    }
  }, [market, isDemo]);

  useEffect(() => {
    if (!isDemo) return;
    setDemoPositions((prev) =>
      prev.map((pos) => {
        if (pos.status !== "open") return pos;
        const cur = prices[pos.symbol];
        if (!cur) return pos;
        const midPrice = (cur.bid + cur.ask) / 2;
        const pnl = pos.side === "buy"
          ? (midPrice - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - midPrice) * pos.quantity;
        const pnlPercent = ((pos.side === "buy" ? midPrice - pos.entryPrice : pos.entryPrice - midPrice) / pos.entryPrice) * 100;
        return { ...pos, currentPrice: midPrice, pnl, pnlPercent };
      }),
    );
  }, [prices, isDemo]);

  const openDemoPosition = (side: "buy" | "sell") => {
    const allDemo = getDemoSymbols(market);
    const sym = allDemo.find((s) => s.symbol === selectedSymbol);
    if (!sym) return;
    const cur = prices[selectedSymbol];
    if (!cur) return;
    const execPrice = side === "buy" ? cur.ask : cur.bid;
    const cost = execPrice * orderQty;
    if (side === "buy" && cost > demoBalance) {
      toast.error("Saldo demo tidak mencukupi.");
      return;
    }
    const pos: DemoPosition = {
      id: `pos_${Date.now()}`,
      symbol: selectedSymbol,
      side,
      entryPrice: execPrice,
      quantity: orderQty,
      openedAt: new Date().toISOString(),
      currentPrice: execPrice,
      pnl: 0,
      pnlPercent: 0,
      status: "open",
    };
    setDemoPositions((prev) => [pos, ...prev]);
    if (side === "buy") setDemoBalance((b) => b - cost);
    else setDemoBalance((b) => b + cost);
    const trade: DemoTrade = {
      id: `t_${Date.now()}`,
      symbol: selectedSymbol,
      side,
      price: execPrice,
      quantity: orderQty,
      timestamp: new Date().toISOString(),
    };
    setDemoTrades((prev) => [trade, ...prev]);
    toast.success(`Posisi ${side === "buy" ? "BUY" : "SELL"} ${sym.label} dibuka.`);
  };

  const closeDemoPosition = (posId: string) => {
    setDemoPositions((prev) =>
      prev.map((pos) => {
        if (pos.id !== posId || pos.status !== "open") return pos;
        const cur = prices[pos.symbol];
        if (!cur) return pos;
        const exitPrice = pos.side === "buy" ? cur.bid : cur.ask;
        const pnl = pos.side === "buy"
          ? (exitPrice - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - exitPrice) * pos.quantity;
        if (pos.side === "sell") setDemoBalance((b) => b - (exitPrice * pos.quantity - pnl));
        else setDemoBalance((b) => b + exitPrice * pos.quantity + pnl - (pos.entryPrice * pos.quantity));
        setDemoBalance((b) => b + pnl);
        const trade: DemoTrade = {
          id: `t_${Date.now()}`,
          symbol: pos.symbol,
          side: pos.side === "buy" ? "sell" : "buy",
          price: exitPrice,
          quantity: pos.quantity,
          timestamp: new Date().toISOString(),
          pnl,
        };
        setDemoTrades((prev2) => [trade, ...prev2]);
        return { ...pos, status: "closed" as const, closedAt: new Date().toISOString(), exitPrice, pnl, pnlPercent: ((pos.side === "buy" ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice) / pos.entryPrice) * 100 };
      }),
    );
    toast.success("Posisi ditutup.");
  };

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
        title="Masuk untuk mengakses Live Trading"
        description="Pantau pergerakan pasar real-time dengan TradingView dan mode Demo untuk belajar trading."
        actionLabel="Masuk"
      />
    );
  }

  const currentPrice = prices[selectedSymbol];
  const allDemoSym = getDemoSymbols(market);
  const allLiveSym = getLiveSymbols(market);
  const symInfo = isDemo
    ? (allDemoSym.find((s) => s.symbol === selectedSymbol) ?? { label: selectedSymbol, basePrice: 0 })
    : (allLiveSym.find((s) => s.apiSymbol === selectedSymbol) ?? { label: selectedSymbol, basePrice: 0 });
  const openPositions = demoPositions.filter((p) => p.status === "open");
  const closedPositions = demoPositions.filter((p) => p.status === "closed");
  const totalPnl = openPositions.reduce((sum, p) => sum + p.pnl, 0) + closedPositions.reduce((sum, p) => sum + p.pnl, 0);
  const midPrice = currentPrice ? (currentPrice.bid + currentPrice.ask) / 2 : 0;
  const equity = demoBalance + openPositions.reduce((sum, p) => sum + p.pnl, 0);

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-gray-100">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-700 bg-gray-800 px-3 py-2 sm:items-center sm:justify-between sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <Activity className="size-5 shrink-0 text-emerald-400" aria-hidden />
          <span className="font-display text-sm font-semibold text-white sm:text-lg">Live Trading</span>
          <div className="flex items-center gap-1 rounded-md bg-gray-700/50 p-0.5">
            {([["saham", TrendingUp, "Saham"], ["crypto", Bitcoin, "Crypto"], ["komoditas", Package, "Komoditas"], ["forex", Globe, "Forex"]] as const).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors sm:px-3 sm:text-xs ${market === key ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"}`}
                onClick={() => setMarket(key)}
              >
                <Icon className="size-3" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${priceStatus === "connected" ? "bg-emerald-500/20 text-emerald-400" : priceStatus === "connecting" ? "bg-amber-500/20 text-amber-400" : "bg-gray-600/30 text-gray-500"}`}>
            {priceStatus === "connected" ? <Wifi className="size-3" aria-hidden /> : <WifiOff className="size-3" aria-hidden />}
            {priceStatus === "connected" ? "LIVE" : priceStatus === "connecting" ? "Connecting..." : "Offline"}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1 rounded-md border border-gray-600 px-2 py-1 sm:gap-2 sm:px-3">
            <span className="text-[10px] text-gray-400 sm:text-xs">Demo</span>
            <Switch checked={isDemo} onCheckedChange={setIsDemo} />
          </div>
          <Button variant="outline" size="sm" className="hidden border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white sm:inline-flex" onClick={() => setShowAcademyGate(true)}>
            <Bot className="mr-1.5 size-3.5" aria-hidden />
            AI Agent
          </Button>
          <Button asChild variant="outline" size="sm" className="border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white">
            <Link to="/dasbor">Kembali</Link>
          </Button>
        </div>
      </div>

      {/* Account Info Bar */}
      {isDemo ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-700 bg-gray-800/50 px-3 py-1.5 text-xs sm:gap-6 sm:px-4">
          <div>
            <span className="text-gray-500">Saldo: </span>
            <span className="font-mono font-semibold text-white">{formatRupiah(demoBalance)}</span>
          </div>
          <div>
            <span className="text-gray-500">Ekuitas: </span>
            <span className="font-mono font-semibold text-white">{formatRupiah(equity)}</span>
          </div>
          <div>
            <span className="text-gray-500">Open P&L: </span>
            <span className={`font-mono font-semibold ${totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {totalPnl >= 0 ? "+" : ""}{formatRupiah(totalPnl)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Posisi: </span>
            <span className="font-mono font-semibold text-white">{openPositions.length}</span>
          </div>
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex flex-1 flex-row overflow-hidden">
        {/* Chart Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden sm:flex-[2]">
          {/* Chart Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-700 bg-gray-800/30 px-3 py-2 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger className="w-28 border-gray-600 bg-gray-700 text-xs text-white [&>svg]:text-gray-400 sm:w-32 sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gray-600 bg-gray-700">
                  {(isDemo ? allDemoSym.map((s) => ({ symbol: s.symbol, label: s.label })) : allLiveSym.map((s) => ({ symbol: s.apiSymbol, label: s.label }))).map((s) => (
                    <SelectItem key={s.symbol} value={s.symbol} className="text-white focus:bg-gray-600 focus:text-white">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentPrice ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="font-mono text-sm font-bold text-white sm:text-lg">{formatPrice(midPrice, market)}</span>
                  <span className={`text-[10px] font-medium sm:text-xs ${currentPrice.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {currentPrice.change >= 0 ? "+" : ""}{formatNum(currentPrice.change, market)}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded bg-gray-700/50 p-0.5">
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${chartView === "line" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-white"}`}
                  onClick={() => setChartView("line")}
                >
                  Line
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${chartView === "candle" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-white"}`}
                  onClick={() => setChartView("candle")}
                >
                  Candle
                </button>
              </div>
              <button
                type="button"
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
                onClick={() => setExpandedChart(true)}
                aria-label="Perbesar chart"
              >
                <Maximize2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="min-h-[200px] flex-1 overflow-hidden p-2 sm:min-h-[300px]">
            {currentPrice ? (
              <div className="flex h-full items-center justify-center rounded-lg bg-gray-800/30 p-2">
                <div className="h-full w-full max-w-5xl">
                  {chartView === "line" ? (
                    <div className="flex flex-col items-center justify-center">
                      <Sparkline data={currentPrice.history} color={currentPrice.change >= 0 ? "#34d399" : "#fb7185"} />
                      <p className="mt-2 font-mono text-2xl font-bold text-white">{formatPrice(midPrice, market)}</p>
                    </div>
                  ) : (
                    (() => {
                      const candles = stableCandles;
                      const labels = candles.map((_, i) => {
                        const secsAgo = (candles.length - 1 - i) * 3;
                        if (secsAgo === 0) return "now";
                        return `-${secsAgo}s`;
                      });
                      return <ProfessionalChart candles={candles} labels={labels} market={market} viewMode={chartView} />;
                    })()
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-6 animate-spin text-gray-500" aria-hidden />
              </div>
            )}
          </div>

          {/* Position Tabs */}
          {isDemo ? (
            <div className="border-t border-gray-700 bg-gray-800/20">
              <div className="flex flex-wrap border-b border-gray-700">
                {([["positions", "Posisi"], ["pending", "Pending"], ["history", "Riwayat"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`px-4 py-2 text-xs font-medium transition-colors ${positionTab === key ? "border-b-2 border-emerald-400 text-white" : "text-gray-400 hover:text-white"}`}
                    onClick={() => setPositionTab(key)}
                  >
                    {label} {key === "positions" ? `(${openPositions.length})` : ""}
                  </button>
                ))}
              </div>
              <div className="max-h-40 overflow-y-auto">
                {positionTab === "positions" ? (
                  openPositions.length === 0 ? (
                    <p className="py-4 text-center text-xs text-gray-500">Belum ada posisi terbuka.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-xs">
                      <thead className="sticky top-0 bg-gray-800 text-gray-400">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
                          <th className="px-3 py-1.5 text-left font-medium">Side</th>
                          <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                          <th className="px-3 py-1.5 text-right font-medium">Entry</th>
                          <th className="px-3 py-1.5 text-right font-medium">Current</th>
                          <th className="px-3 py-1.5 text-right font-medium">P&L</th>
                          <th className="px-3 py-1.5 text-center font-medium">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openPositions.map((pos) => {
                          const sym = allDemoSym.find((s) => s.symbol === pos.symbol);
                          return (
                            <tr key={pos.id} className="border-t border-gray-700/50 hover:bg-gray-700/20">
                              <td className="px-3 py-1.5 font-medium text-white">{sym?.label ?? pos.symbol}</td>
                              <td className="px-3 py-1.5">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${pos.side === "buy" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                                  {pos.side.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-gray-300">{pos.quantity}</td>
                              <td className="px-3 py-1.5 text-right font-mono text-gray-300">{formatPrice(pos.entryPrice, market)}</td>
                              <td className="px-3 py-1.5 text-right font-mono text-gray-300">{formatPrice(pos.currentPrice, market)}</td>
                              <td className={`px-3 py-1.5 text-right font-mono font-semibold ${pos.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {pos.pnl >= 0 ? "+" : ""}{formatRupiah(pos.pnl)}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <button
                                  type="button"
                                  className="rounded bg-gray-600 px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-gray-500"
                                  onClick={() => closeDemoPosition(pos.id)}
                                >
                                  Tutup
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  )
                ) : positionTab === "pending" ? (
                  <p className="py-4 text-center text-xs text-gray-500">Belum ada pending order.</p>
                ) : (
                  closedPositions.length === 0 ? (
                    <p className="py-4 text-center text-xs text-gray-500">Belum ada riwayat trade.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-xs">
                        <thead className="sticky top-0 bg-gray-800 text-gray-400">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
                            <th className="px-3 py-1.5 text-left font-medium">Side</th>
                            <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                            <th className="px-3 py-1.5 text-right font-medium">Entry</th>
                            <th className="px-3 py-1.5 text-right font-medium">Exit</th>
                            <th className="px-3 py-1.5 text-right font-medium">P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {closedPositions.map((pos) => {
                            const sym = allDemoSym.find((s) => s.symbol === pos.symbol);
                            return (
                              <tr key={pos.id} className="border-t border-gray-700/50">
                                <td className="px-3 py-1.5 font-medium text-white">{sym?.label ?? pos.symbol}</td>
                                <td className="px-3 py-1.5">
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${pos.side === "buy" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                                    {pos.side.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-gray-300">{pos.quantity}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-gray-300">{formatPrice(pos.entryPrice, market)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-gray-300">{formatPrice(pos.exitPrice ?? 0, market)}</td>
                                <td className={`px-3 py-1.5 text-right font-mono font-semibold ${pos.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  {pos.pnl >= 0 ? "+" : ""}{formatRupiah(pos.pnl)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Panel: Watchlist + Trading */}
        <div className="flex w-1/3 flex-col border-l border-gray-700 bg-gray-800/50 sm:w-80">
          {/* Watchlist */}
          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-gray-700 px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Watchlist</h3>
            </div>
            <div className="divide-y divide-gray-700/50">
              {(isDemo ? allDemoSym.map((s) => ({ symbol: s.symbol, label: s.label })) : allLiveSym.map((s) => ({ symbol: s.apiSymbol, label: s.label }))).map((s) => {
                const p = prices[s.symbol];
                if (!p) return null;
                const isSelected = selectedSymbol === s.symbol;
                return (
                  <button
                    key={s.symbol}
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-gray-700/30 ${isSelected ? "bg-gray-700/50" : ""}`}
                    onClick={() => setSelectedSymbol(s.symbol)}
                  >
                    <div>
                      <p className={`text-xs font-semibold ${isSelected ? "text-emerald-400" : "text-white"}`}>{s.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-semibold text-emerald-400">{formatPrice(p.bid, market)}</p>
                      <p className="font-mono text-xs font-semibold text-rose-400">{formatPrice(p.ask, market)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trading Panel */}
          {isDemo ? (
            <div className="border-t border-gray-700 bg-gray-800 p-3">
              {/* Trade Tabs */}
              <div className="mb-3 flex gap-1 rounded bg-gray-700/50 p-0.5">
                {([["market", "MARKET"], ["risk", "RISK"], ["sl", "SL"], ["tp", "TP"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`flex-1 rounded py-1 text-[10px] font-semibold transition-colors ${tradeTab === key ? "bg-gray-600 text-white" : "text-gray-400 hover:text-white"}`}
                    onClick={() => setTradeTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tradeTab === "market" ? (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-gray-400">Jumlah (lot)</label>
                    <input
                      type="number"
                      min={1}
                      value={orderQty}
                      onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))}
                      className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Estimasi: {currentPrice ? (market !== "saham" ? formatPrice(midPrice * orderQty, market) : formatRupiah(midPrice * orderQty)) : "—"}
                  </div>
                </div>
              ) : tradeTab === "risk" ? (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-gray-400">Risk per trade (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={2}
                      className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              ) : tradeTab === "sl" ? (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-gray-400">Stop Loss Price</label>
                    <input
                      type="number"
                      value={slPrice}
                      onChange={(e) => setSlPrice(e.target.value)}
                      placeholder={currentPrice ? String(+(midPrice * 0.98).toFixed(2)) : ""}
                      className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-gray-400">Take Profit Price</label>
                    <input
                      type="number"
                      value={tpPrice}
                      onChange={(e) => setTpPrice(e.target.value)}
                      placeholder={currentPrice ? String(+(midPrice * 1.02).toFixed(2)) : ""}
                      className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* BUY / SELL Buttons */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded bg-rose-600 py-2 text-xs font-bold text-white transition-colors hover:bg-rose-700"
                  onClick={() => openDemoPosition("buy")}
                >
                  <div className="text-[10px] font-normal opacity-80">BUY</div>
                  <div className="font-mono text-sm">{currentPrice ? formatPrice(currentPrice.ask, market) : "—"}</div>
                </button>
                <button
                  type="button"
                  className="rounded bg-emerald-600 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                  onClick={() => openDemoPosition("sell")}
                >
                  <div className="text-[10px] font-normal opacity-80">SELL</div>
                  <div className="font-mono text-sm">{currentPrice ? formatPrice(currentPrice.bid, market) : "—"}</div>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Academy Gate Modal */}
      {showAcademyGate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
            <div className="flex flex-col items-center text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-amber-500/20">
                <AlertTriangle className="size-7 text-amber-400" aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-xl font-semibold text-white">Peringatan</h2>
              <p className="mt-3 text-sm text-gray-300">
                Untuk menggunakan <strong className="text-white">AI Trading Agent</strong> pada akun Demo, Anda harus menyelesaikan{" "}
                <strong className="text-white">{ACADEMY_LABEL[market]}</strong> terlebih dahulu.
              </p>
              <p className="mt-2 text-sm text-gray-400">
                Akademi ini akan memberikan pemahaman dasar tentang {market === "saham" ? "perdagangan saham di Bursa Efek Indonesia" : market === "crypto" ? "perdagangan aset kripto dan blockchain" : market === "komoditas" ? "perdagangan komoditas seperti emas, minyak, dan CPO" : "perdagangan mata uang asing (forex)"} sebelum Anda menggunakan agen AI.
              </p>
              <Button className="mt-6 w-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setShowAcademyGate(false)}>
                Mengerti
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Expanded Chart Modal */}
      {expandedChart && currentPrice ? (() => {
        const candles = stableCandles;
        const labels = candles.map((_, i) => {
          const secsAgo = (candles.length - 1 - i) * 3;
          if (secsAgo === 0) return "now";
          return `-${secsAgo}s`;
        });
        return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-900 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-lg border border-gray-600 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                onClick={() => setExpandedChart(false)}
                aria-label="Tutup chart"
              >
                <X className="size-4" aria-hidden />
              </button>
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  {isDemo ? symInfo.label : (allLiveSym.find((s) => s.apiSymbol === selectedSymbol)?.label ?? selectedSymbol)}
                </h2>
                <p className="text-sm text-gray-400">
                  {formatPrice(midPrice, market)}
                  {currentPrice.change !== 0 ? (
                    <span className={currentPrice.change >= 0 ? "ml-2 text-emerald-400" : "ml-2 text-rose-400"}>
                      {currentPrice.change >= 0 ? "+" : ""}{formatNum(currentPrice.change, market)} ({((currentPrice.change / (currentPrice.history[0] || 1)) * 100).toFixed(2)}%)
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded bg-gray-700/50 p-0.5">
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${chartView === "line" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-white"}`}
                  onClick={() => setChartView("line")}
                >
                  Line
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${chartView === "candle" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-white"}`}
                  onClick={() => setChartView("candle")}
                >
                  Candle
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-gray-700 bg-gray-800/30 p-4">
            <div className="h-full w-full max-w-5xl">
              <ProfessionalChart
                candles={candles}
                labels={labels}
                market={market}
                viewMode={chartView}
              />
            </div>
          </div>
        </div>
        );
      })() : null}
    </div>
  );
}
