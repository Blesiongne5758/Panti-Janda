import { useEffect, useRef, useState } from "react";
export interface PriceTick { bid: number; ask: number; change: number; history: number[]; }
export interface Candle { open: number; high: number; low: number; close: number; }
export type ConnectionStatus = "connecting" | "connected" | "disconnected";
interface TwelveDataQuote { symbol: string; close: string; open: string; high: string; low: string; change: string; percent_change: string; previous_close: string; }
interface TwelveDataSeriesValue { datetime: string; open: string; high: string; low: string; close: string; }
const TWELVEDATA_BASE = "https://api.twelvedata.com";
const BINANCE_REST = "https://api.binance.com/api/v3";
const BINANCE_WS = "wss://stream.binance.com:9443/ws";
const MAX_HISTORY = 60;
const MAX_CANDLES = 30;
const TICKS_PER_CANDLE = 6;
function toPriceTick(price: number, change: number, history: number[]): PriceTick {
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  const spread = safePrice * 0.0002;
  return { bid: safePrice - spread / 2, ask: safePrice + spread / 2, change: Number.isFinite(change) ? change : 0, history: history.filter((value) => Number.isFinite(value) && value > 0).slice(-MAX_HISTORY) };
}
function parseSeries(values: TwelveDataSeriesValue[] | undefined): number[] {
  return (values ?? []).map((item) => Number(item.close)).filter((value) => Number.isFinite(value) && value > 0).reverse().slice(-MAX_HISTORY);
}
/** Real market quotes for stocks, forex and commodities via Twelve Data REST. */
export function useTwelveDataPrices(symbols: string[], apiKey: string, activeSymbol?: string, refreshSeconds = 15) {
  const [prices, setPrices] = useState<Record<string, PriceTick>>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const symbolKey = symbols.join(",");
  const activeRef = useRef(activeSymbol);
  activeRef.current = activeSymbol;
  useEffect(() => {
    if (!apiKey || symbols.length === 0) { setPrices({}); setStatus("disconnected"); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const histories: Record<string, number[]> = {};
    const historyLoaded = new Set<string>();
    const delay = Math.max(10, Math.floor(refreshSeconds || 15)) * 1000;
    const fetchJson = async <T,>(url: string): Promise<T | null> => {
      try { const response = await fetch(url); if (!response.ok) return null; const data = await response.json(); if (data?.code || data?.status === "error") return null; return data as T; } catch { return null; }
    };
    const refresh = async () => {
      if (cancelled) return;
      const symbol = activeRef.current && symbols.includes(activeRef.current) ? activeRef.current : symbols[0];
      setStatus("connecting");
      const encoded = encodeURIComponent(symbol);
      const quote = await fetchJson<TwelveDataQuote>(`${TWELVEDATA_BASE}/quote?symbol=${encoded}&apikey=${encodeURIComponent(apiKey)}`);
      if (quote?.close) {
        const price = Number(quote.close);
        if (!historyLoaded.has(symbol)) {
          const series = await fetchJson<{ values?: TwelveDataSeriesValue[] }>(`${TWELVEDATA_BASE}/time_series?symbol=${encoded}&interval=1min&outputsize=${MAX_HISTORY}&apikey=${encodeURIComponent(apiKey)}`);
          histories[symbol] = parseSeries(series?.values);
          historyLoaded.add(symbol);
        }
        histories[symbol] = [...(histories[symbol] ?? []), price].slice(-MAX_HISTORY);
        if (!cancelled) { setPrices((previous) => ({ ...previous, [symbol]: toPriceTick(price, Number(quote.change) || 0, histories[symbol]) })); setStatus("connected"); }
      } else if (!cancelled) setStatus("disconnected");
      if (!cancelled) timer = setTimeout(() => void refresh(), delay);
    };
    void refresh();
    return () => { cancelled = true; if (timer) clearTimeout(timer); setStatus("disconnected"); };
  }, [symbolKey, apiKey, refreshSeconds]);
  return { prices, status };
}
function binanceSymbol(symbol: string): string { return symbol.replace(/[^A-Za-z0-9]/g, "").replace(/USD$/i, "USDT").toLowerCase(); }
/** Free Binance public market-data stream; no account or API key is required. */
export function useBinancePrices(symbols: string[], activeSymbol?: string) {
  const [prices, setPrices] = useState<Record<string, PriceTick>>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const symbolKey = symbols.join(",");
  const activeRef = useRef(activeSymbol);
  activeRef.current = activeSymbol;
  useEffect(() => {
    if (symbols.length === 0) { setPrices({}); setStatus("disconnected"); return; }
    let cancelled = false; let socket: WebSocket | null = null;
    const symbol = activeRef.current && symbols.includes(activeRef.current) ? activeRef.current : symbols[0];
    const stream = binanceSymbol(symbol); const restSymbol = stream.toUpperCase();
    const connect = async () => {
      setStatus("connecting");
      try {
        const response = await fetch(`${BINANCE_REST}/klines?symbol=${restSymbol}&interval=1m&limit=${MAX_HISTORY}`);
        if (!response.ok) throw new Error("Binance klines unavailable");
        const rows = await response.json() as unknown[][];
        const history = rows.map((row) => Number(row[4])).filter((value) => Number.isFinite(value) && value > 0);
        const last = history.at(-1) ?? 0; if (!last || cancelled) throw new Error("No Binance price");
        setPrices({ [symbol]: toPriceTick(last, last - (history.at(-2) ?? last), history) });
        socket = new WebSocket(`${BINANCE_WS}/${stream}@trade`);
        socket.onopen = () => { if (!cancelled) setStatus("connected"); };
        socket.onmessage = (event) => { if (cancelled) return; try { const payload = JSON.parse(event.data) as { p?: string }; const price = Number(payload.p); if (!Number.isFinite(price) || price <= 0) return; setPrices((previous) => { const historyNow = [...(previous[symbol]?.history ?? history), price].slice(-MAX_HISTORY); return { [symbol]: toPriceTick(price, price - (historyNow.at(-2) ?? price), historyNow) }; }); } catch { /* Ignore malformed stream messages. */ } };
        socket.onerror = () => { if (!cancelled) setStatus("disconnected"); };
        socket.onclose = () => { if (!cancelled) setStatus("disconnected"); };
      } catch { if (!cancelled) setStatus("disconnected"); }
    };
    void connect();
    return () => { cancelled = true; socket?.close(); setStatus("disconnected"); };
  }, [symbolKey]);
  return { prices, status };
}
export function useStableCandles(prices: Record<string, PriceTick>, symbol: string): Candle[] {
  const [candles, setCandles] = useState<Candle[]>([]); const candlesRef = useRef<Candle[]>([]); const tickCountRef = useRef(0); const prevSymbolRef = useRef(symbol); const seededRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) { candlesRef.current = []; tickCountRef.current = 0; prevSymbolRef.current = symbol; seededRef.current = {}; setCandles([]); }
    const tick = prices[symbol]; if (!tick || tick.history.length === 0) return;
    const mid = (tick.bid + tick.ask) / 2;
    if (candlesRef.current.length === 0 && !seededRef.current[symbol] && tick.history.length >= TICKS_PER_CANDLE * 2) {
      const built: Candle[] = []; for (let i = 0; i + TICKS_PER_CANDLE <= tick.history.length; i += TICKS_PER_CANDLE) { const slice = tick.history.slice(i, i + TICKS_PER_CANDLE); built.push({ open: slice[0], high: Math.max(...slice), low: Math.min(...slice), close: slice.at(-1) ?? slice[0] }); }
      candlesRef.current = built; tickCountRef.current = tick.history.length - built.length * TICKS_PER_CANDLE; seededRef.current[symbol] = true;
    }
    if (candlesRef.current.length === 0) { candlesRef.current = [{ open: mid, high: mid, low: mid, close: mid }]; tickCountRef.current = 1; } else { const index = candlesRef.current.length - 1; const last = candlesRef.current[index]; if (tickCountRef.current >= TICKS_PER_CANDLE) { candlesRef.current = [...candlesRef.current, { open: mid, high: mid, low: mid, close: mid }]; tickCountRef.current = 1; } else { candlesRef.current[index] = { open: last.open, high: Math.max(last.high, mid), low: Math.min(last.low, mid), close: mid }; tickCountRef.current++; } }
    if (candlesRef.current.length > MAX_CANDLES) candlesRef.current = candlesRef.current.slice(-MAX_CANDLES); setCandles([...candlesRef.current]);
  }, [prices, symbol]);
  return candles;
}
