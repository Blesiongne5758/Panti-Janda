import { useEffect, useRef, useState } from "react";

export interface PriceTick {
  bid: number;
  ask: number;
  change: number;
  history: number[];
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface StreamSymbol {
  symbol: string;
  base: number;
}

const TICKS_PER_CANDLE = 6;
const MAX_CANDLES = 30;

function generatePrice(base: number, volatility = 0.005): number {
  const isDecimal = base % 1 !== 0;
  if (isDecimal) {
    const decimals = base < 1 ? 6 : base < 10 ? 5 : base < 200 ? 2 : 4;
    const change = +(Math.random() - 0.5) * 2 * volatility * base;
    return Math.max(base < 1 ? 0.001 : base * 0.9, +(base + change).toFixed(decimals));
  }
  const change = Math.round((Math.random() - 0.5) * 2 * volatility * base);
  return Math.max(1, Math.round(base + change));
}

export function useRealtimePrices(symbols: StreamSymbol[]) {
  const [prices, setPrices] = useState<Record<string, PriceTick>>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (symbols.length === 0) {
      setPrices({});
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");

    const initial: Record<string, PriceTick> = {};
    for (const s of symbols) {
      const price = generatePrice(s.base);
      const spread = price * 0.0002;
      const seed: number[] = [];
      let p = s.base;
      for (let j = 0; j < 30; j++) {
        p = generatePrice(p, 0.003);
        seed.push(p);
      }
      initial[s.symbol] = { bid: price - spread / 2, ask: price + spread / 2, change: 0, history: seed };
    }
    setPrices(initial);

    const connectTimer = setTimeout(() => setStatus("connected"), 300);

    intervalRef.current = setInterval(() => {
      setPrices((prev) => {
        const next = { ...prev };
        for (const s of symbols) {
          const cur = next[s.symbol];
          if (!cur) continue;
          const mid = (cur.bid + cur.ask) / 2;
          const newPrice = generatePrice(mid, 0.001);
          const spread = newPrice * 0.0002;
          const history = [...cur.history.slice(-59), newPrice];
          next[s.symbol] = {
            bid: newPrice - spread / 2,
            ask: newPrice + spread / 2,
            change: newPrice - cur.history[0],
            history,
          };
        }
        return next;
      });
    }, 500);

    return () => {
      clearTimeout(connectTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setStatus("disconnected");
    };
  }, [symbols.map((s) => s.symbol).join(",")]);

  return { prices, status };
}

interface TwelveDataQuote {
  symbol: string;
  close: string;
  open: string;
  high: string;
  low: string;
  change: string;
  percent_change: string;
  previous_close: string;
}

const TWELVEDATA_BASE = "https://api.twelvedata.com";
const POLL_ROUND_INTERVAL = 15_000;

export function useTwelveDataPrices(symbols: string[], apiKey: string, activeSymbol?: string) {
  const [prices, setPrices] = useState<Record<string, PriceTick>>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(activeSymbol);
  const symbolKey = symbols.join(",");
  activeRef.current = activeSymbol;

  useEffect(() => {
    if (!apiKey || symbols.length === 0) {
      setPrices({});
      setStatus("disconnected");
      return;
    }

    let cancelled = false;
    const history: Record<string, number[]> = {};
    for (const sym of symbols) {
      history[sym] = [];
    }

    const fetchQuote = async (sym: string): Promise<{ quote: TwelveDataQuote | null; rateLimited: boolean }> => {
      try {
        const res = await fetch(
          `${TWELVEDATA_BASE}/quote?symbol=${encodeURIComponent(sym)}&apikey=${apiKey}`,
        );
        if (res.status === 429) return { quote: null, rateLimited: true };
        if (!res.ok) return { quote: null, rateLimited: false };
        const data = await res.json();
        if (data.code || !data.close) return { quote: null, rateLimited: false };
        return { quote: data as TwelveDataQuote, rateLimited: false };
      } catch {
        return { quote: null, rateLimited: false };
      }
    };

    const fetchSingleQuote = async (sym: string): Promise<{ quote: TwelveDataQuote | null; rateLimited: boolean }> => {
      if (cancelled) return { quote: null, rateLimited: false };
      const result = await fetchQuote(sym);
      if (!result.quote) return result;
      const q = result.quote;
      const price = parseFloat(q.close);
      if (price <= 0) return { quote: null, rateLimited: false };
      const spread = price * 0.0002;
      const prev = history[sym] || [];
      const hist = prev.length === 0
        ? (() => {
            const seed: number[] = [];
            let p = parseFloat(q.open) || parseFloat(q.previous_close) || price;
            for (let j = 0; j < 30; j++) {
              p = p + (price - p) * 0.1 + (Math.random() - 0.5) * spread * 2;
              seed.push(+p.toFixed(6));
            }
            seed.push(price);
            return seed;
          })()
        : [...prev, price].slice(-60);
      history[sym] = hist;
      return { quote: q, rateLimited: false };
    };

    const applyQuote = (sym: string, q: TwelveDataQuote) => {
      const price = parseFloat(q.close);
      const change = parseFloat(q.change) || 0;
      const spread = price * 0.0002;
      const hist = history[sym] || [];
      setPrices((prev) => ({
        ...prev,
        [sym]: {
          bid: price - spread / 2,
          ask: price + spread / 2,
          change,
          history: hist,
        },
      }));
    };

    const simulateTick = (sym: string) => {
      const prev = history[sym];
      if (!prev || prev.length === 0) return;
      const last = prev[prev.length - 1];
      const volatility = 0.001;
      const change = (Math.random() - 0.5) * 2 * volatility * last;
      const price = +(last + change).toFixed(6);
      const spread = price * 0.0002;
      const hist = [...prev, price].slice(-60);
      history[sym] = hist;
      setPrices((p) => ({
        ...p,
        [sym]: {
          bid: price - spread / 2,
          ask: price + spread / 2,
          change: price - hist[0],
          history: hist,
        },
      }));
    };

    const init = async () => {
      setStatus("connecting");
      const target = activeRef.current || symbols[0];
      const result = await fetchSingleQuote(target);
      if (result.quote && !cancelled) {
        applyQuote(target, result.quote);
        setStatus("connected");
        startSimulation();
        schedulePoll(POLL_ROUND_INTERVAL);
      } else if (!cancelled) {
        schedulePoll(result.rateLimited ? 60_000 : 30_000);
      }
    };

    const startSimulation = () => {
      if (tickRef.current) return;
      tickRef.current = setInterval(() => {
        if (cancelled) return;
        const target = activeRef.current || symbols[0];
        simulateTick(target);
      }, 2000);
    };

    const schedulePoll = (delay: number) => {
      if (cancelled) return;
      pollRef.current = setTimeout(async () => {
        if (cancelled) return;
        const target = activeRef.current || symbols[0];
        const result = await fetchSingleQuote(target);
        if (result.quote) {
          applyQuote(target, result.quote);
          setStatus("connected");
          if (!tickRef.current) startSimulation();
          schedulePoll(POLL_ROUND_INTERVAL);
        } else {
          const next = result.rateLimited ? 60_000 : 30_000;
          schedulePoll(next);
        }
      }, delay);
    };

    void init();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      setStatus("disconnected");
    };
  }, [symbolKey, apiKey]);

  return { prices, status };
}

export function useStableCandles(prices: Record<string, PriceTick>, symbol: string): Candle[] {
  const [candles, setCandles] = useState<Candle[]>([]);
  const candlesRef = useRef<Candle[]>([]);
  const tickCountRef = useRef(0);
  const prevSymbolRef = useRef(symbol);
  const seededRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      candlesRef.current = [];
      tickCountRef.current = 0;
      prevSymbolRef.current = symbol;
      seededRef.current = {};
      setCandles([]);
    }

    const tick = prices[symbol];
    if (!tick) return;

    const mid = (tick.bid + tick.ask) / 2;

    if (candlesRef.current.length === 0 && !seededRef.current[symbol] && tick.history.length >= TICKS_PER_CANDLE * 2) {
      const hist = tick.history;
      const built: Candle[] = [];
      for (let i = 0; i + TICKS_PER_CANDLE <= hist.length; i += TICKS_PER_CANDLE) {
        const slice = hist.slice(i, i + TICKS_PER_CANDLE);
        built.push({
          open: slice[0],
          high: Math.max(...slice),
          low: Math.min(...slice),
          close: slice[slice.length - 1],
        });
      }
      if (built.length > 0) {
        candlesRef.current = built;
        tickCountRef.current = hist.length - built.length * TICKS_PER_CANDLE;
        seededRef.current[symbol] = true;
      }
    }

    if (candlesRef.current.length === 0) {
      candlesRef.current = [{ open: mid, high: mid, low: mid, close: mid }];
      tickCountRef.current = 1;
    } else {
      const idx = candlesRef.current.length - 1;
      const last = candlesRef.current[idx];

      if (tickCountRef.current >= TICKS_PER_CANDLE) {
        candlesRef.current = [
          ...candlesRef.current,
          { open: mid, high: mid, low: mid, close: mid },
        ];
        tickCountRef.current = 1;
      } else {
        candlesRef.current[idx] = {
          open: last.open,
          high: Math.max(last.high, mid),
          low: Math.min(last.low, mid),
          close: mid,
        };
        tickCountRef.current++;
      }
    }

    if (candlesRef.current.length > MAX_CANDLES) {
      candlesRef.current = candlesRef.current.slice(-MAX_CANDLES);
    }

    setCandles([...candlesRef.current]);
  }, [prices, symbol]);

  return candles;
}
