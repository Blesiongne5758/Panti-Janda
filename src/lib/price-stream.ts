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

export function useStableCandles(prices: Record<string, PriceTick>, symbol: string): Candle[] {
  const [candles, setCandles] = useState<Candle[]>([]);
  const candlesRef = useRef<Candle[]>([]);
  const tickCountRef = useRef(0);
  const prevSymbolRef = useRef(symbol);

  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      candlesRef.current = [];
      tickCountRef.current = 0;
      prevSymbolRef.current = symbol;
      setCandles([]);
    }

    const tick = prices[symbol];
    if (!tick) return;

    const mid = (tick.bid + tick.ask) / 2;

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
