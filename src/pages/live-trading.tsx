import { useCallback, useEffect, useState } from "react";
import { getAccountRank } from "@/lib/constants";
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
import { useBinancePrices, useTwelveDataPrices, useStableCandles } from "@/lib/price-stream";
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
  stopLoss?: number;
  takeProfit?: number;
  closeReason?: "manual" | "stop_loss" | "take_profit";
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

interface RiskAlert {
  id: string;
  symbol: string;
  reason: "stop_loss" | "take_profit";
  price: number;
  createdAt: string;
}

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
  return getLiveSymbols(market).map((item) => ({
    symbol: item.apiSymbol,
    label: item.label,
    basePrice: 0,
  }));
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
  indicator,
  indicatorPeriod,
}: {
  candles: Candle[];
  labels: string[];
  market: MarketKind;
  viewMode: "line" | "candle";
  indicator: "none" | "sma" | "ema" | "rsi" | "macd";
  indicatorPeriod: number;
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

  const closes = candles.map((c) => c.close);
  const isOscillator = indicator === "rsi" || indicator === "macd";
  const priceChartH = isOscillator ? chartH - 92 : chartH;
  const indicatorValues: (number | null)[] = indicator === "sma" || indicator === "ema"
    ? closes.map((_, index) => {
      if (index + 1 < indicatorPeriod) return null;
      if (indicator === "sma") {
        const window = closes.slice(index + 1 - indicatorPeriod, index + 1);
        return window.reduce((sum, value) => sum + value, 0) / indicatorPeriod;
      }
      const smoothing = 2 / (indicatorPeriod + 1);
      let ema = closes[0];
      for (let i = 1; i <= index; i++) ema = closes[i] * smoothing + ema * (1 - smoothing);
      return ema;
    })
    : candles.map(() => null);
  const allPrices = candles.flatMap((c, index) => [
    c.high,
    c.low,
    ...(!isOscillator && indicatorValues[index] !== null ? [indicatorValues[index] as number] : []),
  ]);
  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const padding = (rawMax - rawMin) * 0.05 || rawMax * 0.01;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const range = max - min || 1;

  const yScale = (v: number) => padT + priceChartH * (1 - (v - min) / range);
  const candleW = chartW / candles.length;
  const bodyW = Math.max(2, candleW * 0.6);

  const yLabels: number[] = [];
  for (let i = 0; i <= yLabelCount; i++) {
    yLabels.push(min + (range * i) / yLabelCount);
  }

  const rsiValues: (number | null)[] = closes.map((_, index) => {
    if (index < indicatorPeriod) return null;
    let gains = 0;
    let losses = 0;
    for (let i = index - indicatorPeriod + 1; i <= index; i++) {
      const change = closes[i] - closes[i - 1];
      if (change >= 0) gains += change;
      else losses -= change;
    }
    if (losses === 0) return 100;
    const relativeStrength = (gains / indicatorPeriod) / (losses / indicatorPeriod);
    return 100 - (100 / (1 + relativeStrength));
  });
  const emaSeries = (period: number): number[] => {
    const smoothing = 2 / (period + 1);
    const values = [closes[0]];
    for (let i = 1; i < closes.length; i++) values.push(closes[i] * smoothing + values[i - 1] * (1 - smoothing));
    return values;
  };
  const fastEma = emaSeries(12);
  const slowEma = emaSeries(26);
  const macdValues = fastEma.map((value, index) => value - slowEma[index]);
  const signalValues: number[] = [];
  const signalSmoothing = 2 / 10;
  for (let index = 0; index < macdValues.length; index++) {
    signalValues.push(index === 0
      ? macdValues[0]
      : macdValues[index] * signalSmoothing + signalValues[index - 1] * (1 - signalSmoothing));
  }
  const oscillatorSeries = indicator === "rsi" ? rsiValues : macdValues.map((value, index) => index < 25 ? null : value);
  const signalSeries = indicator === "macd" ? signalValues.map((value, index) => index < 25 ? null : value) : [];
  const oscillatorValues = [...oscillatorSeries.filter((value): value is number => value !== null), ...signalSeries.filter((value): value is number => value !== null)];
  const oscillatorMin = indicator === "rsi" ? 0 : Math.min(0, ...(oscillatorValues.length ? oscillatorValues : [0]));
  const oscillatorMax = indicator === "rsi" ? 100 : Math.max(0, ...(oscillatorValues.length ? oscillatorValues : [0]));
  const oscillatorRange = oscillatorMax - oscillatorMin || 1;
  const oscillatorTop = padT + priceChartH + 16;
  const oscillatorHeight = h - padB - oscillatorTop;
  const oscillatorScale = (value: number) => oscillatorTop + oscillatorHeight * (1 - (value - oscillatorMin) / oscillatorRange);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="grid" width={chartW / 8} height={priceChartH / yLabelCount} patternUnits="userSpaceOnUse" x={padL} y={padT}>
          <path d={`M ${chartW / 8} 0 L 0 0 0 ${priceChartH / yLabelCount}`} fill="none" stroke="currentColor" strokeWidth={0.3} opacity={0.15} />
        </pattern>
      </defs>

      <rect x={padL} y={padT} width={chartW} height={priceChartH} fill="url(#grid)" />

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
            <line x1={x} x2={x} y1={padT} y2={padT + priceChartH} stroke="currentColor" strokeWidth={0.3} opacity={0.08} />
            <text x={x} y={h - 6} className="fill-muted-foreground" fontSize={8} textAnchor="middle" fontFamily="monospace">
              {label}
            </text>
          </g>
        );
      })}

      {viewMode === "line" ? (
        <polyline
          fill="none"
          stroke={candles[candles.length - 1].close >= candles[0].open ? "#22c55e" : "#f43f5e"}
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
          const color = bullish ? "#22c55e" : "#f43f5e";
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

      {indicator === "sma" || indicator === "ema" ? (
        <>
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth={2}
            points={indicatorValues
              .map((value, i) => value === null ? null : `${padL + i * candleW + candleW / 2},${yScale(value)}`)
              .filter((point): point is string => point !== null)
              .join(" ")}
          />
          <text x={padL + 6} y={padT + 14} fill="#f59e0b" fontSize={10} fontFamily="monospace">
            {indicator.toUpperCase()}({indicatorPeriod})
          </text>
        </>
      ) : null}

      {isOscillator ? (
        <>
          <rect x={padL} y={oscillatorTop} width={chartW} height={oscillatorHeight} fill="currentColor" opacity={0.025} />
          <line x1={padL} x2={padL + chartW} y1={oscillatorScale(0)} y2={oscillatorScale(0)} stroke="currentColor" strokeWidth={0.6} opacity={0.35} />
          {indicator === "rsi" ? (
            <>
              <line x1={padL} x2={padL + chartW} y1={oscillatorScale(30)} y2={oscillatorScale(30)} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={0.7} opacity={0.7} />
              <line x1={padL} x2={padL + chartW} y1={oscillatorScale(70)} y2={oscillatorScale(70)} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={0.7} opacity={0.7} />
              <polyline fill="none" stroke="#a78bfa" strokeWidth={1.8} points={rsiValues.map((value, i) => value === null ? null : `${padL + i * candleW + candleW / 2},${oscillatorScale(value)}`).filter((point): point is string => point !== null).join(" ")} />
              <text x={padL + 6} y={oscillatorTop + 13} fill="#a78bfa" fontSize={10} fontFamily="monospace">RSI({indicatorPeriod})</text>
              <text x={padL + chartW + 6} y={oscillatorScale(70) + 3} fill="#f59e0b" fontSize={9} fontFamily="monospace">70</text>
              <text x={padL + chartW + 6} y={oscillatorScale(30) + 3} fill="#f59e0b" fontSize={9} fontFamily="monospace">30</text>
            </>
          ) : (
            <>
              {macdValues.map((value, i) => i < 25 ? null : <rect key={`hist-${i}`} x={padL + i * candleW + candleW * 0.25} y={Math.min(oscillatorScale(0), oscillatorScale(value - signalValues[i]))} width={Math.max(1, candleW * 0.5)} height={Math.max(1, Math.abs(oscillatorScale(value - signalValues[i]) - oscillatorScale(0)))} fill={value >= signalValues[i] ? "#22c55e" : "#f43f5e"} opacity={0.45} />)}
              <polyline fill="none" stroke="#38bdf8" strokeWidth={1.8} points={oscillatorSeries.map((value, i) => value === null ? null : `${padL + i * candleW + candleW / 2},${oscillatorScale(value)}`).filter((point): point is string => point !== null).join(" ")} />
              <polyline fill="none" stroke="#f59e0b" strokeWidth={1.4} points={signalSeries.map((value, i) => value === null ? null : `${padL + i * candleW + candleW / 2},${oscillatorScale(value)}`).filter((point): point is string => point !== null).join(" ")} />
              <text x={padL + 6} y={oscillatorTop + 13} fill="#38bdf8" fontSize={10} fontFamily="monospace">MACD(12,26,9)</text>
            </>
          )}
        </>
      ) : null}

      <line x1={padL} x2={padL + chartW} y1={padT + priceChartH} y2={padT + priceChartH} stroke="currentColor" strokeWidth={0.5} opacity={0.2} />
      <line x1={padL} x2={padL} y1={padT} y2={padT + priceChartH} stroke="currentColor" strokeWidth={0.5} opacity={0.2} />
    </svg>
  );
}

export default function LiveTradingPage() {
  const { ready, account } = useAuth();
  const rank = getAccountRank(account);
  const [settings, setSettings] = useState<AppSettings["liveTrading"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [market, setMarket] = useState<MarketKind>("saham");
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [demoBalance, setDemoBalance] = useState(DEMO_BALANCE);
  const [demoPositions, setDemoPositions] = useState<DemoPosition[]>([]);
  const [demoTrades, setDemoTrades] = useState<DemoTrade[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(false);
  const [orderQty, setOrderQty] = useState(100);
  const [showAcademyGate, setShowAcademyGate] = useState(false);
  const [chartView, setChartView] = useState<"line" | "candle">("candle");
  const [indicator, setIndicator] = useState<"none" | "sma" | "ema" | "rsi" | "macd">("sma");
  const [indicatorPeriod, setIndicatorPeriod] = useState(5);
  const [expandedChart, setExpandedChart] = useState(false);
  const [tradeTab, setTradeTab] = useState<"market" | "risk" | "sl" | "tp">("market");
  const [positionTab, setPositionTab] = useState<"portfolio" | "positions" | "pending" | "history">("portfolio");
  const [slPrice, setSlPrice] = useState("");
  const [tpPrice, setTpPrice] = useState("");

  const enableBrowserAlerts = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Browser ini tidak mendukung notifikasi desktop.");
      return;
    }
    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission === "granted") {
      setBrowserAlertsEnabled(true);
      toast.success("Notifikasi Stop Loss/Take Profit diaktifkan.");
    } else {
      toast.error("Izin notifikasi ditolak. Alert tetap tampil di dalam aplikasi.");
    }
  };

  const notifyRiskAlert = useCallback((position: DemoPosition, reason: "stop_loss" | "take_profit", price: number) => {
    const createdAt = new Date().toISOString();
    const alert: RiskAlert = { id: `alert_${Date.now()}_${position.id}`, symbol: position.symbol, reason, price, createdAt };
    setRiskAlerts((previous) => [alert, ...previous].slice(0, 20));
    const label = reason === "stop_loss" ? "Stop Loss" : "Take Profit";
    toast.info(`${label} tercapai: ${position.symbol} @ ${formatPrice(price, market)}`);
    if (browserAlertsEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(`${label} tercapai — ${position.symbol}`, {
        body: `${position.side.toUpperCase()} ditutup pada ${formatPrice(price, market)}.`,
        tag: alert.id,
      });
    }
  }, [browserAlertsEnabled, market]);

  const liveStreamSymbols = getLiveSymbols(market).map((s) => s.apiSymbol);
  const apiKey = settings?.apiKey ?? "";

  const twelveData = useTwelveDataPrices(market !== "crypto" ? liveStreamSymbols : [], apiKey, selectedSymbol, settings?.refreshInterval ?? 15);
  const binanceData = useBinancePrices(market === "crypto" ? liveStreamSymbols : [], selectedSymbol);
  const activeData = market === "crypto" ? binanceData : twelveData;
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
        const exitPrice = pos.side === "buy" ? cur.bid : cur.ask;
        const hitStopLoss = pos.stopLoss !== undefined && (pos.side === "buy" ? exitPrice <= pos.stopLoss : exitPrice >= pos.stopLoss);
        const hitTakeProfit = pos.takeProfit !== undefined && (pos.side === "buy" ? exitPrice >= pos.takeProfit : exitPrice <= pos.takeProfit);
        const closeReason = hitStopLoss ? "stop_loss" : hitTakeProfit ? "take_profit" : null;
        const pnl = pos.side === "buy"
          ? (midPrice - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - midPrice) * pos.quantity;
        const pnlPercent = ((pos.side === "buy" ? midPrice - pos.entryPrice : pos.entryPrice - midPrice) / pos.entryPrice) * 100;
        if (closeReason) {
          const realizedPnl = pos.side === "buy"
            ? (exitPrice - pos.entryPrice) * pos.quantity
            : (pos.entryPrice - exitPrice) * pos.quantity;
          setDemoBalance((balance) => balance + (pos.side === "buy" ? exitPrice : -exitPrice) * pos.quantity);
          setDemoTrades((trades) => [...trades, {
            id: `t_${Date.now()}_${pos.id}`,
            symbol: pos.symbol,
            side: pos.side === "buy" ? "sell" : "buy",
            price: exitPrice,
            quantity: pos.quantity,
            timestamp: new Date().toISOString(),
            pnl: realizedPnl,
          }]);
          notifyRiskAlert(pos, closeReason, exitPrice);
          return { ...pos, status: "closed" as const, closedAt: new Date().toISOString(), exitPrice, pnl: realizedPnl, pnlPercent: (realizedPnl / (pos.entryPrice * pos.quantity)) * 100, closeReason };
        }
        return { ...pos, currentPrice: midPrice, pnl, pnlPercent };
      }),
    );
  }, [prices, isDemo, notifyRiskAlert]);

  const openDemoPosition = (side: "buy" | "sell") => {
    const allDemo = getDemoSymbols(market);
    const sym = allDemo.find((s) => s.symbol === selectedSymbol);
    if (!sym) return;
    const cur = prices[selectedSymbol];
    if (!cur) return;
    const execPrice = side === "buy" ? cur.ask : cur.bid;
    const stopLoss = slPrice.trim() ? Number(slPrice) : undefined;
    const takeProfit = tpPrice.trim() ? Number(tpPrice) : undefined;
    if (stopLoss !== undefined && (!Number.isFinite(stopLoss) || stopLoss <= 0)) {
      toast.error("Harga Stop Loss tidak valid.");
      return;
    }
    if (takeProfit !== undefined && (!Number.isFinite(takeProfit) || takeProfit <= 0)) {
      toast.error("Harga Take Profit tidak valid.");
      return;
    }
    if (side === "buy" && stopLoss !== undefined && stopLoss >= execPrice) {
      toast.error("Stop Loss BUY harus di bawah harga masuk.");
      return;
    }
    if (side === "buy" && takeProfit !== undefined && takeProfit <= execPrice) {
      toast.error("Take Profit BUY harus di atas harga masuk.");
      return;
    }
    if (side === "sell" && stopLoss !== undefined && stopLoss <= execPrice) {
      toast.error("Stop Loss SELL harus di atas harga masuk.");
      return;
    }
    if (side === "sell" && takeProfit !== undefined && takeProfit >= execPrice) {
      toast.error("Take Profit SELL harus di bawah harga masuk.");
      return;
    }
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
      stopLoss,
      takeProfit,
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
        setDemoBalance((b) => b + (pos.side === "buy" ? exitPrice : -exitPrice) * pos.quantity);
        const trade: DemoTrade = {
          id: `t_${Date.now()}_${pos.id}`,
          symbol: pos.symbol,
          side: pos.side === "buy" ? "sell" : "buy",
          price: exitPrice,
          quantity: pos.quantity,
          timestamp: new Date().toISOString(),
          pnl,
        };
        setDemoTrades((prev2) => [trade, ...prev2]);
        return { ...pos, status: "closed" as const, closedAt: new Date().toISOString(), exitPrice, pnl, pnlPercent: (pnl / (pos.entryPrice * pos.quantity)) * 100, closeReason: "manual" as const };
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
  const realizedPnl = closedPositions.reduce((sum, p) => sum + p.pnl, 0);
  const unrealizedPnl = openPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalPnl = realizedPnl + unrealizedPnl;
  const exposure = openPositions.reduce((sum, p) => sum + p.entryPrice * p.quantity, 0);
  const winningPositions = closedPositions.filter((p) => p.pnl > 0);
  const losingPositions = closedPositions.filter((p) => p.pnl < 0);
  const winRate = closedPositions.length > 0 ? (winningPositions.length / closedPositions.length) * 100 : 0;
  const bestTrade = closedPositions.length > 0 ? Math.max(...closedPositions.map((p) => p.pnl)) : 0;
  const worstTrade = closedPositions.length > 0 ? Math.min(...closedPositions.map((p) => p.pnl)) : 0;
  const midPrice = currentPrice ? (currentPrice.bid + currentPrice.ask) / 2 : 0;
  const equity = demoBalance + openPositions.reduce((sum, p) => sum + p.pnl, 0);

  return (
    <div className="flex h-screen flex-col bg-[#0B1220] text-[#F4F7FB]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#263754] bg-[#111B2E] px-3 py-2 sm:items-center sm:justify-between sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <Activity className="size-5 shrink-0 text-[#5EEAD4]" aria-hidden />
          <div className="min-w-0">
            <span className="block truncate font-display text-sm font-semibold text-white sm:text-lg">AI Trading Command Center</span>
            <span className="hidden text-[10px] tracking-wide text-[#7183A1] sm:block">Live market intelligence desk</span>
          </div>
          <div className="flex items-center gap-1 rounded-md bg-[#17243A]/75 p-0.5">
            {([["saham", TrendingUp, "Saham"], ["crypto", Bitcoin, "Crypto"], ["komoditas", Package, "Komoditas"], ["forex", Globe, "Forex"]] as const).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors sm:px-3 sm:text-xs ${market === key ? "bg-[#0F9F8F] text-white" : "text-[#9AAAC2] hover:text-white"}`}
                onClick={() => setMarket(key)}
              >
                <Icon className="size-3" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${priceStatus === "connected" ? "bg-[#22C55E]/15 text-[#5EEAD4]" : priceStatus === "connecting" ? "bg-[#F59E0B]/15 text-[#FBBF24]" : "bg-[#2A3C5A]/30 text-[#7183A1]"}`}>
            {priceStatus === "connected" ? <Wifi className="size-3" aria-hidden /> : <WifiOff className="size-3" aria-hidden />}
            {priceStatus === "connected" ? "LIVE" : priceStatus === "connecting" ? "Connecting..." : "Offline"}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1 rounded-md border border-[#38506F] px-2 py-1 sm:gap-2 sm:px-3">
            <span className="text-[10px] text-[#9AAAC2] sm:text-xs">Demo</span>
            <Switch checked={isDemo} onCheckedChange={setIsDemo} />
          </div>
          <Button variant="outline" size="sm" className="hidden border-[#14B8A6]/60 bg-[#14B8A6]/10 text-[#99F6E4] shadow-[0_0_0_1px_rgba(20,184,166,0.08)] hover:bg-[#14B8A6]/20 hover:text-white sm:inline-flex" onClick={() => setShowAcademyGate(true)}>
            <Bot className="mr-1.5 size-3.5" aria-hidden />
            AI Agent
          </Button>
          <Button asChild variant="outline" size="sm" className="border-[#38506F] bg-transparent text-[#D3DCEB] hover:bg-[#17243A] hover:text-white">
            <Link to="/dasbor">Kembali</Link>
          </Button>
        </div>
      </div>

      {/* Account Info Bar */}
      {isDemo ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#263754] bg-[#111B2E]/85 px-3 py-1.5 text-xs sm:gap-6 sm:px-4">
          <div>
            <span className="text-[#7183A1]">Saldo: </span>
            <span className="font-mono font-semibold text-white">{formatRupiah(demoBalance)}</span>
          </div>
          <div>
            <span className="text-[#7183A1]">Ekuitas: </span>
            <span className="font-mono font-semibold text-white">{formatRupiah(equity)}</span>
          </div>
          <div>
            <span className="text-[#7183A1]">Open P&L: </span>
            <span className={`font-mono font-semibold ${totalPnl >= 0 ? "text-[#5EEAD4]" : "text-[#FB7185]"}`}>
              {totalPnl >= 0 ? "+" : ""}{formatRupiah(totalPnl)}
            </span>
          </div>
          <div>
            <span className="text-[#7183A1]">Posisi: </span>
            <span className="font-mono font-semibold text-white">{openPositions.length}</span>
          </div>
          <button
            type="button"
            onClick={() => void enableBrowserAlerts()}
            className={`rounded border px-2 py-1 text-[10px] font-semibold transition-colors ${browserAlertsEnabled ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#5EEAD4]" : "border-[#38506F] text-[#D3DCEB] hover:bg-[#17243A]"}`}
          >
            {browserAlertsEnabled ? "Alert desktop aktif" : "Aktifkan alert"}
          </button>
        </div>
      ) : null}

      {isDemo && riskAlerts.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-[#263754] bg-[#17243A]/70 px-3 py-1.5 text-[10px] sm:px-4">
          <span className="shrink-0 font-semibold uppercase tracking-wider text-[#9AAAC2]">Alert terbaru</span>
          {riskAlerts.slice(0, 3).map((alert) => (
            <span key={alert.id} className={`shrink-0 rounded px-2 py-1 font-medium ${alert.reason === "stop_loss" ? "bg-[#F43F5E]/15 text-[#FB7185]" : "bg-[#22C55E]/15 text-[#5EEAD4]"}`}>
              {alert.reason === "stop_loss" ? "SL" : "TP"} {alert.symbol} @ {formatPrice(alert.price, market)} · {new Date(alert.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ))}
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex flex-1 flex-row overflow-hidden">
        {/* Chart Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden sm:flex-[2]">
          {/* Chart Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#263754] bg-[#111B2E]/55 px-3 py-2 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger className="w-28 border-[#38506F] bg-[#17243A] text-xs text-white [&>svg]:text-[#9AAAC2] sm:w-32 sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#38506F] bg-[#17243A]">
                  {(isDemo ? allDemoSym.map((s) => ({ symbol: s.symbol, label: s.label })) : allLiveSym.map((s) => ({ symbol: s.apiSymbol, label: s.label }))).map((s) => (
                    <SelectItem key={s.symbol} value={s.symbol} className="text-white focus:bg-[#2A3C5A] focus:text-white">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentPrice ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="font-mono text-sm font-bold text-white sm:text-lg">{formatPrice(midPrice, market)}</span>
                  <span className={`text-[10px] font-medium sm:text-xs ${currentPrice.change >= 0 ? "text-[#5EEAD4]" : "text-[#FB7185]"}`}>
                    {currentPrice.change >= 0 ? "+" : ""}{formatNum(currentPrice.change, market)}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded bg-[#17243A]/75 p-0.5">
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${chartView === "line" ? "bg-[#2A3C5A] text-white" : "text-[#9AAAC2] hover:text-white"}`}
                  onClick={() => setChartView("line")}
                >
                  Line
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${chartView === "candle" ? "bg-[#2A3C5A] text-white" : "text-[#9AAAC2] hover:text-white"}`}
                  onClick={() => setChartView("candle")}
                >
                  Candle
                </button>
              </div>
              <Select value={indicator} onValueChange={(value) => setIndicator(value as "none" | "sma" | "ema" | "rsi" | "macd")}>
                <SelectTrigger className="h-7 w-24 border-[#38506F] bg-[#17243A] text-[10px] text-white">
                  <SelectValue placeholder="Indikator" />
                </SelectTrigger>
                <SelectContent className="border-[#38506F] bg-[#17243A]">
                  <SelectItem value="none" className="text-white focus:bg-[#2A3C5A] focus:text-white">Tanpa MA</SelectItem>
                  <SelectItem value="sma" className="text-white focus:bg-[#2A3C5A] focus:text-white">SMA</SelectItem>
                  <SelectItem value="ema" className="text-white focus:bg-[#2A3C5A] focus:text-white">EMA</SelectItem>
                  <SelectItem value="rsi" className="text-white focus:bg-[#2A3C5A] focus:text-white">RSI</SelectItem>
                  <SelectItem value="macd" className="text-white focus:bg-[#2A3C5A] focus:text-white">MACD</SelectItem>
                </SelectContent>
              </Select>
              {indicator !== "none" && indicator !== "macd" ? (
                <input
                  aria-label="Periode indikator moving average"
                  className="h-7 w-12 rounded border border-[#38506F] bg-[#17243A] px-1.5 text-center font-mono text-[10px] text-white outline-none focus:border-[#5EEAD4]"
                  type="number"
                  min={2}
                  max={30}
                  value={indicatorPeriod}
                  onChange={(event) => setIndicatorPeriod(Math.min(30, Math.max(2, Number(event.target.value) || 2)))}
                />
              ) : null}
              <button
                type="button"
                className="rounded p-1.5 text-[#9AAAC2] transition-colors hover:bg-[#17243A] hover:text-white"
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
              <div className="flex h-full items-center justify-center rounded-lg bg-[#111B2E]/55 p-2">
                <div className="h-full w-full max-w-5xl">
                  {chartView === "line" ? (
                    <div className="flex flex-col items-center justify-center">
                      <Sparkline data={currentPrice.history} color={currentPrice.change >= 0 ? "#5eead4" : "#fb7185"} />
                      <p className="mt-2 font-mono text-2xl font-bold text-white">{formatPrice(midPrice, market)}</p>
                    </div>
                  ) : (
                    (() => {
                      const candles = stableCandles;
                      const labels = candles.map((_, i) => {
                        const minutesAgo = (candles.length - 1 - i) * 6;
                        if (minutesAgo === 0) return "now";
                        return `-${minutesAgo}m`;
                      });
                      return <ProfessionalChart candles={candles} labels={labels} market={market} viewMode={chartView} indicator={indicator} indicatorPeriod={indicatorPeriod} />;
                    })()
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-6 animate-spin text-[#7183A1]" aria-hidden />
              </div>
            )}
          </div>

          {/* Position Tabs */}
          {isDemo ? (
            <div className="border-t border-[#263754] bg-[#111B2E]/65">
              <div className="flex flex-wrap border-b border-[#263754]">
                {([["portfolio", "Portofolio"], ["positions", "Posisi"], ["pending", "Pending"], ["history", "Riwayat"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`px-4 py-2 text-xs font-medium transition-colors ${positionTab === key ? "border-b-2 border-[#5EEAD4] text-white" : "text-[#9AAAC2] hover:text-white"}`}
                    onClick={() => setPositionTab(key)}
                  >
                    {label} {key === "positions" ? `(${openPositions.length})` : ""}
                  </button>
                ))}
              </div>
              <div className="max-h-40 overflow-y-auto">
                {positionTab === "portfolio" ? (
                  <div className="space-y-3 p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        ["Ekuitas", formatRupiah(equity), "text-white"],
                        ["Exposure", market === "saham" ? formatRupiah(exposure) : formatPrice(exposure, market), "text-[#D3DCEB]"],
                        ["Unrealized P&L", `${unrealizedPnl >= 0 ? "+" : ""}${formatRupiah(unrealizedPnl)}`, unrealizedPnl >= 0 ? "text-[#5EEAD4]" : "text-[#FB7185]"],
                        ["Realized P&L", `${realizedPnl >= 0 ? "+" : ""}${formatRupiah(realizedPnl)}`, realizedPnl >= 0 ? "text-[#5EEAD4]" : "text-[#FB7185]"],
                      ].map(([label, value, color]) => (
                        <div key={label} className="rounded border border-[#263754] bg-[#17243A]/60 p-2">
                          <p className="text-[10px] text-[#7183A1]">{label}</p>
                          <p className={`mt-1 truncate font-mono text-xs font-semibold ${color}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-[#9AAAC2]">
                      <span>Posisi aktif: <strong className="text-white">{openPositions.length}</strong></span>
                      <span>Total P&L: <strong className={totalPnl >= 0 ? "text-[#5EEAD4]" : "text-[#FB7185]"}>{totalPnl >= 0 ? "+" : ""}{formatRupiah(totalPnl)}</strong></span>
                      <span>Trade selesai: <strong className="text-white">{closedPositions.length}</strong></span>
                    </div>
                    {openPositions.length === 0 ? (
                      <p className="py-2 text-center text-xs text-[#7183A1]">Belum ada posisi aktif di portofolio.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {openPositions.map((pos) => {
                          const sym = allDemoSym.find((s) => s.symbol === pos.symbol);
                          const allocation = exposure > 0 ? (pos.entryPrice * pos.quantity / exposure) * 100 : 0;
                          return (
                            <div key={pos.id} className="flex items-center justify-between rounded border border-[#263754]/70 bg-[#17243A]/35 px-2.5 py-2 text-xs">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-white">{sym?.label ?? pos.symbol} <span className="ml-1 text-[10px] text-[#9AAAC2]">{pos.side.toUpperCase()}</span></p>
                                <p className="text-[10px] text-[#7183A1]">{pos.quantity} unit · {allocation.toFixed(1)}% exposure</p>
                              </div>
                              <p className={`font-mono font-semibold ${pos.pnl >= 0 ? "text-[#5EEAD4]" : "text-[#FB7185]"}`}>{pos.pnl >= 0 ? "+" : ""}{formatRupiah(pos.pnl)}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : positionTab === "positions" ? (
                  openPositions.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[#7183A1]">Belum ada posisi terbuka.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[650px] text-xs">
                      <thead className="sticky top-0 bg-[#111B2E] text-[#9AAAC2]">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
                          <th className="px-3 py-1.5 text-left font-medium">Side</th>
                          <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                          <th className="px-3 py-1.5 text-right font-medium">Entry</th>
                          <th className="px-3 py-1.5 text-right font-medium">Current</th>
                          <th className="px-3 py-1.5 text-right font-medium">SL</th>
                          <th className="px-3 py-1.5 text-right font-medium">TP</th>
                          <th className="px-3 py-1.5 text-right font-medium">P&L</th>
                          <th className="px-3 py-1.5 text-center font-medium">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openPositions.map((pos) => {
                          const sym = allDemoSym.find((s) => s.symbol === pos.symbol);
                          return (
                            <tr key={pos.id} className="border-t border-[#263754]/50 hover:bg-[#17243A]/20">
                              <td className="px-3 py-1.5 font-medium text-white">{sym?.label ?? pos.symbol}</td>
                              <td className="px-3 py-1.5">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${pos.side === "buy" ? "bg-[#22C55E]/15 text-[#5EEAD4]" : "bg-[#F43F5E]/15 text-[#FB7185]"}`}>
                                  {pos.side.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-[#D3DCEB]">{pos.quantity}</td>
                              <td className="px-3 py-1.5 text-right font-mono text-[#D3DCEB]">{formatPrice(pos.entryPrice, market)}</td>
                              <td className="px-3 py-1.5 text-right font-mono text-[#D3DCEB]">{formatPrice(pos.currentPrice, market)}</td>
                              <td className="px-3 py-1.5 text-right font-mono text-[#FB7185]">{pos.stopLoss !== undefined ? formatPrice(pos.stopLoss, market) : "—"}</td>
                              <td className="px-3 py-1.5 text-right font-mono text-[#5EEAD4]">{pos.takeProfit !== undefined ? formatPrice(pos.takeProfit, market) : "—"}</td>
                              <td className={`px-3 py-1.5 text-right font-mono font-semibold ${pos.pnl >= 0 ? "text-[#5EEAD4]" : "text-[#FB7185]"}`}>
                                {pos.pnl >= 0 ? "+" : ""}{formatRupiah(pos.pnl)}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <button
                                  type="button"
                                  className="rounded bg-[#2A3C5A] px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-[#3A5070]"
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
                  <p className="py-4 text-center text-xs text-[#7183A1]">Belum ada pending order.</p>
                ) : (
                  closedPositions.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[#7183A1]">Belum ada riwayat trade.</p>
                  ) : (
                    <div className="space-y-3 p-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {[
                          ["Total P&L", `${realizedPnl >= 0 ? "+" : ""}${formatRupiah(realizedPnl)}`, realizedPnl >= 0 ? "text-[#5EEAD4]" : "text-[#FB7185]"],
                          ["Win rate", `${winRate.toFixed(1)}%`, "text-white"],
                          ["Menang", String(winningPositions.length), "text-[#5EEAD4]"],
                          ["Kalah", String(losingPositions.length), "text-[#FB7185]"],
                          ["Best / Worst", `${formatRupiah(bestTrade)} / ${formatRupiah(worstTrade)}`, "text-[#D3DCEB]"],
                        ].map(([label, value, color]) => (
                          <div key={label} className="rounded border border-[#263754] bg-[#17243A]/60 p-2">
                            <p className="text-[10px] text-[#7183A1]">{label}</p>
                            <p className={`mt-1 truncate font-mono text-xs font-semibold ${color}`}>{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-xs">
                        <thead className="sticky top-0 bg-[#111B2E] text-[#9AAAC2]">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
                            <th className="px-3 py-1.5 text-left font-medium">Side</th>
                            <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                            <th className="px-3 py-1.5 text-right font-medium">Entry</th>
                            <th className="px-3 py-1.5 text-right font-medium">Exit</th>
                            <th className="px-3 py-1.5 text-right font-medium">P&L</th>
                            <th className="px-3 py-1.5 text-left font-medium">Alasan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {closedPositions.map((pos) => {
                            const sym = allDemoSym.find((s) => s.symbol === pos.symbol);
                            return (
                              <tr key={pos.id} className="border-t border-[#263754]/50">
                                <td className="px-3 py-1.5 font-medium text-white">{sym?.label ?? pos.symbol}</td>
                                <td className="px-3 py-1.5">
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${pos.side === "buy" ? "bg-[#22C55E]/15 text-[#5EEAD4]" : "bg-[#F43F5E]/15 text-[#FB7185]"}`}>
                                    {pos.side.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-[#D3DCEB]">{pos.quantity}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-[#D3DCEB]">{formatPrice(pos.entryPrice, market)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-[#D3DCEB]">{formatPrice(pos.exitPrice ?? 0, market)}</td>
                                <td className={`px-3 py-1.5 text-right font-mono font-semibold ${pos.pnl >= 0 ? "text-[#5EEAD4]" : "text-[#FB7185]"}`}>
                                  {pos.pnl >= 0 ? "+" : ""}{formatRupiah(pos.pnl)}
                                </td>
                                <td className="px-3 py-1.5 text-left text-[#9AAAC2]">
                                  {pos.closeReason === "stop_loss" ? "Stop Loss" : pos.closeReason === "take_profit" ? "Take Profit" : "Manual"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Panel: Watchlist + Trading */}
        <div className="flex w-1/3 flex-col border-l border-[#263754] bg-[#111B2E]/85 sm:w-80">
          {/* Watchlist */}
          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-[#263754] px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9AAAC2]">Watchlist</h3>
            </div>
            <div className="divide-y divide-[#263754]/70">
              {(isDemo ? allDemoSym.map((s) => ({ symbol: s.symbol, label: s.label })) : allLiveSym.map((s) => ({ symbol: s.apiSymbol, label: s.label }))).map((s) => {
                const p = prices[s.symbol];
                if (!p) return null;
                const isSelected = selectedSymbol === s.symbol;
                return (
                  <button
                    key={s.symbol}
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[#17243A]/45 ${isSelected ? "bg-[#17243A]/75" : ""}`}
                    onClick={() => setSelectedSymbol(s.symbol)}
                  >
                    <div>
                      <p className={`text-xs font-semibold ${isSelected ? "text-[#5EEAD4]" : "text-white"}`}>{s.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-semibold text-[#5EEAD4]">{formatPrice(p.bid, market)}</p>
                      <p className="font-mono text-xs font-semibold text-[#FB7185]">{formatPrice(p.ask, market)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trading Panel */}
          {isDemo ? (
            <div className="border-t border-[#263754] bg-[#111B2E] p-3">
              {/* Trade Tabs */}
              <div className="mb-3 flex gap-1 rounded bg-[#17243A]/75 p-0.5">
                {([["market", "MARKET"], ["risk", "RISK"], ["sl", "SL"], ["tp", "TP"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`flex-1 rounded py-1 text-[10px] font-semibold transition-colors ${tradeTab === key ? "bg-[#2A3C5A] text-white" : "text-[#9AAAC2] hover:text-white"}`}
                    onClick={() => setTradeTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tradeTab === "market" ? (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-[#9AAAC2]">Jumlah (lot)</label>
                    <input
                      type="number"
                      min={1}
                      value={orderQty}
                      onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))}
                      className="w-full rounded border border-[#38506F] bg-[#17243A] px-2 py-1.5 text-xs text-white placeholder-[#7183A1] focus:border-[#14B8A6] focus:outline-none"
                    />
                  </div>
                  <div className="text-[10px] text-[#9AAAC2]">
                    Estimasi: {currentPrice ? (market !== "saham" ? formatPrice(midPrice * orderQty, market) : formatRupiah(midPrice * orderQty)) : "—"}
                  </div>
                </div>
              ) : tradeTab === "risk" ? (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-[#9AAAC2]">Risk per trade (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={2}
                      className="w-full rounded border border-[#38506F] bg-[#17243A] px-2 py-1.5 text-xs text-white placeholder-[#7183A1] focus:border-[#14B8A6] focus:outline-none"
                    />
                  </div>
                </div>
              ) : tradeTab === "sl" ? (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-[#9AAAC2]">Stop Loss Price</label>
                    <input
                      type="number"
                      value={slPrice}
                      onChange={(e) => setSlPrice(e.target.value)}
                      placeholder={currentPrice ? String(+(midPrice * 0.98).toFixed(2)) : ""}
                      className="w-full rounded border border-[#38506F] bg-[#17243A] px-2 py-1.5 text-xs text-white placeholder-[#7183A1] focus:border-[#14B8A6] focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-[#9AAAC2]">Take Profit Price</label>
                    <input
                      type="number"
                      value={tpPrice}
                      onChange={(e) => setTpPrice(e.target.value)}
                      placeholder={currentPrice ? String(+(midPrice * 1.02).toFixed(2)) : ""}
                      className="w-full rounded border border-[#38506F] bg-[#17243A] px-2 py-1.5 text-xs text-white placeholder-[#7183A1] focus:border-[#14B8A6] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* BUY / SELL Buttons */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded bg-[#16A34A] py-2 text-xs font-bold text-white transition-colors hover:bg-[#15803D]"
                  onClick={() => openDemoPosition("buy")}
                >
                  <div className="text-[10px] font-normal opacity-80">BUY</div>
                  <div className="font-mono text-sm">{currentPrice ? formatPrice(currentPrice.ask, market) : "—"}</div>
                </button>
                <button
                  type="button"
                  className="rounded bg-[#0F9F8F] py-2 text-xs font-bold text-white transition-colors hover:bg-[#0B8176]"
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
          <div className="w-full max-w-md rounded-xl border border-[#263754] bg-[#111B2E] p-6 shadow-xl">
            <div className="flex flex-col items-center text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-[#F59E0B]/15">
                <AlertTriangle className="size-7 text-[#FBBF24]" aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-xl font-semibold text-white">Peringatan</h2>
              <p className="mt-3 text-sm text-[#D3DCEB]">
                Untuk menggunakan <strong className="text-white">AI Trading Agent</strong> pada akun Demo, Anda harus menyelesaikan{" "}
                <strong className="text-white">{ACADEMY_LABEL[market]}</strong> terlebih dahulu.
              </p>
              <p className="mt-2 text-sm text-[#9AAAC2]">
                Akademi ini akan memberikan pemahaman dasar tentang {market === "saham" ? "perdagangan saham di Bursa Efek Indonesia" : market === "crypto" ? "perdagangan aset kripto dan blockchain" : market === "komoditas" ? "perdagangan komoditas seperti emas, minyak, dan CPO" : "perdagangan mata uang asing (forex)"} sebelum Anda menggunakan agen AI.
              </p>
              <Button className="mt-6 w-full bg-[#0F9F8F] text-white hover:bg-[#0B8176]" onClick={() => setShowAcademyGate(false)}>
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
          const minutesAgo = (candles.length - 1 - i) * 6;
          if (minutesAgo === 0) return "now";
          return `-${minutesAgo}m`;
        });
        return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0B1220] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-lg border border-[#38506F] text-[#D3DCEB] transition-colors hover:bg-[#17243A] hover:text-white"
                onClick={() => setExpandedChart(false)}
                aria-label="Tutup chart"
              >
                <X className="size-4" aria-hidden />
              </button>
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  {isDemo ? symInfo.label : (allLiveSym.find((s) => s.apiSymbol === selectedSymbol)?.label ?? selectedSymbol)}
                </h2>
                <p className="text-sm text-[#9AAAC2]">
                  {formatPrice(midPrice, market)}
                  {currentPrice.change !== 0 ? (
                    <span className={currentPrice.change >= 0 ? "ml-2 text-[#5EEAD4]" : "ml-2 text-[#FB7185]"}>
                      {currentPrice.change >= 0 ? "+" : ""}{formatNum(currentPrice.change, market)} ({((currentPrice.change / (currentPrice.history[0] || 1)) * 100).toFixed(2)}%)
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded bg-[#17243A]/75 p-0.5">
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${chartView === "line" ? "bg-[#2A3C5A] text-white" : "text-[#9AAAC2] hover:text-white"}`}
                  onClick={() => setChartView("line")}
                >
                  Line
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${chartView === "candle" ? "bg-[#2A3C5A] text-white" : "text-[#9AAAC2] hover:text-white"}`}
                  onClick={() => setChartView("candle")}
                >
                  Candle
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-[#263754] bg-[#111B2E]/55 p-4">
            <div className="h-full w-full max-w-5xl">
              <ProfessionalChart
                candles={candles}
                labels={labels}
                market={market}
                viewMode={chartView}
                indicator={indicator}
                indicatorPeriod={indicatorPeriod}
              />
            </div>
          </div>
        </div>
        );
      })() : null}
    </div>
  );
}
