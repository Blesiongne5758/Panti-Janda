import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Loader2,
  Volume2,
  VolumeX,
  Mic,
  Speaker,
  Settings,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Server,
  Cpu,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { useTranslation } from "@/lib/i18n-context";
import { Link } from "@/lib/router";
import type { AppSettings, SubAgentConfig, SubAgentRole, TradingServerConfig, AiPromptTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AccountGate } from "@/components/common";
import { toast } from "sonner";

interface LogEntry {
  time: string;
  kind: "info" | "ok" | "warn";
  agent: string;
  msg: string;
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
}

const LOG_MESSAGES: Array<["info" | "ok" | "warn", string, string]> = [
  ["info", "Market Scanner", "Memindai perubahan volatilitas aset demo"],
  ["ok", "Risk Manager", "Semua batas risiko simulasi dalam rentang aman"],
  ["info", "News Analyzer", "Memproses sentimen berita contoh"],
  ["ok", "Data Aggregator", "Feed simulasi berhasil disinkronkan"],
  ["info", "Watchdog", "Health check seluruh modul selesai"],
  ["warn", "Sniffer", "Lonjakan volume contoh terdeteksi; ditandai untuk review"],
  ["ok", "Backtester", "Batch pengujian historis demo selesai"],
  ["info", "Portfolio Manager", "Memperbarui alokasi portofolio virtual"],
  ["ok", "Server Monitor", "Endpoint demo merespons normal"],
  ["info", "Trading Executor", "Menunggu persetujuan; tidak ada order nyata"],
  ["info", "Wallet Monitor", "Memindai pergerakan whale wallet"],
  ["ok", "Social Sentinel", "Sentimen Telegram dan X/Twitter terkumpul"],
  ["warn", "Copy Trader", "Sinyal copy trading terdeteksi dari trader top"],
];

const FEATURES = [
  { key: "chat", label: "CHAT", desc: "Perintah dan respons berbasis teks.", defaultOn: true },
  { key: "voice", label: "VOICE", desc: "Input suara dan text-to-speech browser.", defaultOn: false },
  { key: "analysis", label: "ANALYSIS", desc: "Grafik dan indikator demo bergerak.", defaultOn: true },
  { key: "sniffer", label: "SNIFFER", desc: "Memantau event simulasi dan anomali.", defaultOn: true },
  { key: "watchdog", label: "WATCHDOG", desc: "Health check dan peringatan simulasi.", defaultOn: true },
];

function formatTime(): string {
  return new Date().toLocaleTimeString("id-ID", { hour12: false });
}

export default function AiAgentPage() {
  const { ready, account } = useAuth();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings["aiTradingAgent"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      text: "Sistem visual aktif. Coba perintah status, analisis, risiko, atau bantuan.",
      isUser: false,
      timestamp: Date.now(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [features, setFeatures] = useState<Record<string, boolean>>(
    Object.fromEntries(FEATURES.map((f) => [f.key, f.defaultOn]))
  );
  const [signals, setSignals] = useState(1284);
  const [signalDelta, setSignalDelta] = useState(8.4);
  const [marketValue, setMarketValue] = useState(68420.8);
  const [riskLevel, setRiskLevel] = useState<"LOW" | "ELEVATED">("LOW");
  const [uptime, setUptime] = useState(99.98);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartDataRef = useRef<number[]>([]);
  const signalDataRef = useRef<number[]>([]);
  const tickRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [subAgents, setSubAgents] = useState<SubAgentConfig[]>([]);
  const [tradingServers, setTradingServers] = useState<TradingServerConfig[]>([]);
  const [promptLibrary, setPromptLibrary] = useState<AiPromptTemplate[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AiPromptTemplate | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const [settingsRes, agentsRes, serversRes, promptsRes] = await Promise.all([
        api<{ aiTradingAgent: AppSettings["aiTradingAgent"] }>("aiTradingAgent.settings"),
        api<{ subAgents: SubAgentConfig[] }>("aiTradingAgent.subAgents.list"),
        api<{ tradingServers: TradingServerConfig[] }>("aiTradingAgent.servers.list"),
        api<{ prompts: AiPromptTemplate[] }>("aiTradingAgent.prompts.list"),
      ]);
      setSettings(settingsRes.aiTradingAgent);
      setSubAgents(agentsRes.subAgents);
      setTradingServers(serversRes.tradingServers);
      setPromptLibrary(promptsRes.prompts);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const addLog = useCallback((kind: "info" | "ok" | "warn", agent: string, msg: string) => {
    setLogs((prev) => {
      const newLog: LogEntry = { time: formatTime(), kind, agent, msg };
      return [newLog, ...prev].slice(0, 70);
    });
    if (soundOn) {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = kind === "warn" ? 660 : 440;
        osc.type = "sine";
        gain.gain.value = 0.025;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
        osc.stop(ctx.currentTime + 0.045);
      } catch (e) {
        // Audio not supported
      }
    }
  }, [soundOn]);

  const handleCommand = useCallback((query: string) => {
    const q = query.toLowerCase();
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      text: query,
      isUser: true,
      timestamp: Date.now(),
    };
    let reply: string;

    if (/bantuan|help|perintah/.test(q)) {
      reply = 'Perintah tersedia: status, analisis, risiko, server, sniffer, watchdog, pause, resume. Ini antarmuka demo, bukan sistem eksekusi order.';
    } else if (/risiko|risk/.test(q)) {
      reply = 'Risk Manager demo aktif. Gunakan batas posisi, stop-loss, dan validasi sebelum menghubungkan sistem nyata; angka risiko di sini bukan hasil analisis pasar live.';
    } else if (/analisis|analysis|market|btc|eth/.test(q)) {
      reply = 'Analisis demo: grafik bergerak dari data sintetis. Belum ada harga live, sinyal investasi, atau rekomendasi transaksi.';
    } else if (/server|exchange|binance|bybit|okx|bitget/.test(q)) {
      reply = 'Lima kartu server adalah placeholder visual. Untuk koneksi sungguhan, siapkan backend aman, API resmi, penyimpanan secret, serta monitoring koneksi.';
    } else if (/sniffer|watchdog|monitor/.test(q)) {
      reply = 'Sniffer dan Watchdog sedang menghasilkan event simulasi lokal. Tidak membaca jaringan, akun, atau proses eksternal.';
    } else if (/pause|berhenti|stop/.test(q)) {
      setPaused(true);
      reply = 'Animasi data dihentikan sementara. Klik Resume simulation untuk melanjutkan.';
    } else if (/resume|lanjut|mulai/.test(q)) {
      setPaused(false);
      reply = 'Simulasi visual dilanjutkan.';
    } else if (/status/.test(q)) {
      const activeFeatures = Object.values(features).filter(Boolean).length;
      reply = `Status demo: 7 sub-agent visual aktif, 5 server placeholder, fitur inti ${activeFeatures}/5 aktif. Tidak ada broker yang terhubung.`;
    } else {
      reply = 'Perintah diterima dalam mode demo. Ketik "bantuan" untuk melihat daftar perintah yang tersedia.';
    }

    const botMsg: ChatMessage = {
      id: `bot_${Date.now()}`,
      text: reply,
      isUser: false,
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, userMsg, botMsg]);
    addLog("info", "Chat", `Perintah diterima: ${query.slice(0, 70)}`);
  }, [features, addLog]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      handleCommand(chatInput.trim());
      setChatInput("");
    }
  };

  const handleVoiceInput = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input tidak didukung. Coba Chrome dan izinkan mikrofon.");
      return;
    }
    const recognition = new SR();
    recognition.lang = "id-ID";
    recognition.onstart = () => toast.info("Mendengarkan...");
    recognition.onerror = () => toast.error("Voice input gagal atau izin mikrofon ditolak");
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setChatInput(transcript);
      handleCommand(transcript);
    };
    recognition.start();
  };

  const handleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      toast.error("Text-to-speech tidak didukung browser ini");
      return;
    }
    const lastBotMsg = [...chatMessages].reverse().find((m) => !m.isUser);
    if (lastBotMsg) {
      const utterance = new SpeechSynthesisUtterance(lastBotMsg.text);
      utterance.lang = "id-ID";
      speechSynthesis.speak(utterance);
    }
  };

  const toggleFeature = (key: string) => {
    setFeatures((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const enabled = next[key];
      addLog(enabled ? "ok" : "warn", key.toUpperCase(), enabled ? "Modul visual diaktifkan" : "Modul visual dinonaktifkan");
      toast.success(`${key.toUpperCase()}: ${enabled ? "enabled" : "disabled"}`);
      return next;
    });
  };

  const toggleSubAgent = async (agentId: string) => {
    const agent = subAgents.find((a) => a.id === agentId);
    if (!agent) return;
    try {
      await api("aiTradingAgent.subAgents.update", { id: agentId, enabled: !agent.enabled });
      setSubAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, enabled: !a.enabled } : a));
      toast.success(`${agent.name}: ${!agent.enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const toggleServer = async (serverId: string) => {
    const server = tradingServers.find((s) => s.id === serverId);
    if (!server) return;
    try {
      await api("aiTradingAgent.servers.update", { id: serverId, enabled: !server.enabled });
      setTradingServers((prev) => prev.map((s) => s.id === serverId ? { ...s, enabled: !s.enabled } : s));
      toast.success(`${server.name}: ${!server.enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const deletePrompt = async (promptId: string) => {
    try {
      await api("aiTradingAgent.prompts.delete", { id: promptId });
      setPromptLibrary((prev) => prev.filter((p) => p.id !== promptId));
      toast.success("Prompt dihapus");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const savePrompt = async (prompt: Partial<AiPromptTemplate>) => {
    try {
      if (prompt.id) {
        const res = await api<{ prompt: AiPromptTemplate }>("aiTradingAgent.prompts.update", prompt);
        setPromptLibrary((prev) => prev.map((p) => p.id === res.prompt.id ? res.prompt : p));
        toast.success("Prompt diperbarui");
      } else {
        const res = await api<{ prompt: AiPromptTemplate }>("aiTradingAgent.prompts.create", prompt);
        setPromptLibrary((prev) => [...prev, res.prompt]);
        toast.success("Prompt dibuat");
      }
      setEditingPrompt(null);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  // Chart animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (chartDataRef.current.length === 0) {
      chartDataRef.current = Array.from({ length: 70 }, (_, i) => 50 + Math.sin(i * 0.25) * 9 + Math.random() * 8);
      signalDataRef.current = Array.from({ length: 70 }, (_, i) => 35 + Math.cos(i * 0.2) * 10 + Math.random() * 9);
    }

    const drawChart = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(96,153,207,.13)";
      ctx.lineWidth = 1;
      for (let y = 15; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = 0; x < w; x += 45) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      const drawLine = (arr: number[], color: string, fill: boolean) => {
        ctx.beginPath();
        arr.forEach((v, i) => {
          const x = (i / (arr.length - 1)) * w;
          const y = h - 10 - (v / 100) * (h - 22);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        if (fill) {
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, "rgba(60,225,255,.22)");
          g.addColorStop(1, "rgba(60,225,255,0)");
          ctx.fillStyle = g;
          ctx.fill();
        } else {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.7;
          ctx.shadowBlur = 8;
          ctx.shadowColor = color;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      };

      drawLine(chartDataRef.current, "#56e7ff", true);
      drawLine(chartDataRef.current, "#56e7ff", false);
      drawLine(signalDataRef.current, "#b36cff", false);

      const x = w - 5;
      const y = h - 10 - (chartDataRef.current[chartDataRef.current.length - 1] / 100) * (h - 22);
      ctx.fillStyle = "#bafaff";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    };

    let animationId: number;
    const animate = () => {
      if (!paused) {
        tickRef.current++;
        const lastData = chartDataRef.current[chartDataRef.current.length - 1];
        const lastSignal = signalDataRef.current[signalDataRef.current.length - 1];
        chartDataRef.current.push(Math.max(12, Math.min(90, lastData + (Math.random() - 0.48) * 8)));
        chartDataRef.current.shift();
        signalDataRef.current.push(Math.max(10, Math.min(85, lastSignal + (Math.random() - 0.5) * 12)));
        signalDataRef.current.shift();
        drawChart();

        if (tickRef.current % 8 === 0) {
          setSignals(1284 + Math.floor(tickRef.current * 1.7));
          setSignalDelta(8.4 + Math.sin(tickRef.current / 5) * 1.3);
          setMarketValue(68420.8 + Math.sin(tickRef.current / 4) * 125 + tickRef.current * 0.7);

          if (Math.random() > 0.35) {
            const item = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
            addLog(item[0], item[1], item[2]);
          }
        }
      }
      animationId = requestAnimationFrame(animate);
    };

    drawChart();
    animationId = requestAnimationFrame(animate);

    const handleResize = () => drawChart();
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [paused, addLog]);

  // Initial logs
  useEffect(() => {
    for (let i = 0; i < 7; i++) {
      const item = LOG_MESSAGES[i];
      addLog(item[0], item[1], item[2]);
    }
  }, [addLog]);

  // Clock and uptime
  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(99.96 + Math.abs(Math.sin(Date.now() / 18000)) * 0.03);
      if (!paused && Math.random() > 0.85) {
        setRiskLevel("ELEVATED");
        addLog("warn", "Risk Manager", "Volatilitas demo meningkat; monitoring diperketat");
      } else {
        setRiskLevel("LOW");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, addLog]);

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
        title={t("ai.title")}
        description={t("ai.description")}
        actionLabel={t("auth.login")}
      />
    );
  }

  const filteredLogs = logs.filter((l) =>
    (l.agent + " " + l.msg + " " + l.kind).toLowerCase().includes(logFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-cyan-500/30 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <div className="text-sm font-black tracking-widest">
              SHIBAI <span className="text-cyan-400">AI</span>
            </div>
            <div className="text-[10px] tracking-widest text-slate-400">SUPREME AGENT COMMAND CENTER</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-md border border-cyan-500/40 bg-slate-900 px-3 py-1.5 text-xs">
              <span className="size-2 animate-pulse rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
              {paused ? t("ai.simulationPaused") : t("ai.systemOnline")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSoundOn(!soundOn);
                toast.success(soundOn ? "Efek suara UI nonaktif" : "Efek suara UI aktif");
              }}
            >
              {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/dasbor">{t("common.back")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Hero Section */}
        <section className="relative min-h-[420px] overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-blue-900/40 via-slate-900/80 to-slate-950/90 p-6 shadow-2xl sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_58%,#143c6b_0,rgba(12,24,57,.8)_34%,rgba(4,8,20,.92)_70%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#060a18_0%,transparent_36%,transparent_68%,#060a18_100%)]" />
          
          {/* Animated stars */}
          <div className="absolute inset-0 opacity-50 pointer-events-none" style={{
            backgroundImage: `radial-gradient(2px 2px at 12% 24%, #a6f6ff 45%, transparent 55%),
                             radial-gradient(1px 1px at 73% 17%, #fff 45%, transparent 55%),
                             radial-gradient(2px 2px at 88% 66%, #8e8cff 45%, transparent 55%)`,
            backgroundSize: "280px 220px",
            animation: "starDrift 28s linear infinite",
          }} />

          {/* Grid */}
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
            backgroundImage: `linear-gradient(#34baff33 1px, transparent 1px), linear-gradient(90deg, #34baff33 1px, transparent 1px)`,
            backgroundSize: "48px 32px",
            transform: "perspective(240px) rotateX(55deg)",
            transformOrigin: "50% 50%",
            top: "50%",
            height: "75%",
            maskImage: "linear-gradient(transparent, #000)",
            animation: "gridMove 5s linear infinite",
          }} />

          {/* Orbit */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden md:block size-80 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-400/60 shadow-lg shadow-cyan-400/30" style={{ animation: "orbitSpin 15s linear infinite" }} />

          {/* Planet */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden md:block size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-cyan-400 via-blue-600 to-slate-900 shadow-2xl shadow-cyan-400/50" style={{ animation: "planetFloat 5s ease-in-out infinite" }} />

          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-start">
            {/* Hero Copy */}
            <div className="max-w-md">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400">
                Beyond time · Beyond markets
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-wide text-white drop-shadow-lg sm:text-4xl">
                SHIBAI<br />
                <span className="text-cyan-400">ŌTSUTSUKI</span>
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                {t("ai.description")}
              </p>
              <blockquote className="mt-4 border-l-2 border-violet-400 pl-3 text-xs italic text-slate-200 sm:text-sm">
                "Semua pergerakan pasar adalah data. Semua data adalah energi."
              </blockquote>
            </div>

            {/* Master Control */}
            <aside className="w-full shrink-0 sm:w-60">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
                {t("ai.masterControl")}
              </div>
              <div className="rounded-xl border border-cyan-500/40 bg-slate-900/90 p-3.5 text-xs shadow-lg backdrop-blur-md">
                <div className="flex justify-between border-b border-white/5 py-1.5">
                  <span className="text-slate-300">{t("ai.monitoring")}</span>
                  <span className="font-semibold text-emerald-400">{t("ai.active")}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-1.5">
                  <span className="text-slate-300">{t("ai.analysis")}</span>
                  <span className="font-semibold text-emerald-400">{t("ai.active")}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-1.5">
                  <span className="text-slate-300">{t("ai.execution")}</span>
                  <span className="font-semibold text-emerald-400">{paused ? t("ai.paused") : t("ai.simulation")}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-1.5">
                  <span className="text-slate-300">{t("ai.riskManagement")}</span>
                  <span className="font-semibold text-emerald-400">{t("ai.armed")}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-300">Sub-agent network</span>
                  <span className="font-semibold text-emerald-400">7 / 7</span>
                </div>
              </div>
            </aside>
          </div>

          {/* Bottom bar */}
          <div className="relative z-10 mt-8 flex flex-wrap justify-between gap-2 border-t border-cyan-500/20 pt-3 text-[10px] tracking-widest text-slate-400">
            <span>NEURAL NETWORK: CONNECTED</span>
            <span>MODE: LOCAL SIMULATION</span>
            <span>{formatTime()}</span>
          </div>
        </section>

        {/* Metrics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950">
            <div className="absolute left-0 top-0 h-px w-20 bg-cyan-400 shadow-lg shadow-cyan-400/50" />
            <CardContent className="p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {t("ai.marketSignals")}
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-white">
                {signals.toLocaleString("en-US")}
              </div>
              <div className="mt-1 text-xs text-emerald-400">
                ↗ +{signalDelta.toFixed(1)}% <span className="text-slate-500">simulated</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950">
            <div className="absolute left-0 top-0 h-px w-20 bg-cyan-400 shadow-lg shadow-cyan-400/50" />
            <CardContent className="p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {t("ai.activeAgents")}
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-white">
                {String(subAgents.filter((a) => a.enabled).length).padStart(2, "0")} <span className="text-xs text-emerald-400">/ {String(subAgents.length).padStart(2, "0")}</span>
              </div>
              <div className="mt-1 text-xs text-emerald-400">● All systems responsive</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950">
            <div className="absolute left-0 top-0 h-px w-20 bg-cyan-400 shadow-lg shadow-cyan-400/50" />
            <CardContent className="p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {t("ai.riskIndex")}
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-white">
                {riskLevel}{" "}
                <span className={`text-xs ${riskLevel === "LOW" ? "text-emerald-400" : "text-amber-400"}`}>
                  ●
                </span>
              </div>
              <div className="mt-1 text-xs text-emerald-400">Guardrails enabled</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950">
            <div className="absolute left-0 top-0 h-px w-20 bg-cyan-400 shadow-lg shadow-cyan-400/50" />
            <CardContent className="p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {t("ai.uptime")}
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-white">{uptime.toFixed(2)}%</div>
              <div className="mt-1 text-xs text-emerald-400">5 endpoints · demo status</div>
            </CardContent>
          </Card>
        </section>

        {/* Sub-agent Network */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest">{t("ai.subAgentNetwork")}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{subAgents.filter((a) => a.enabled).length} / {subAgents.length} active</span>
              <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
                <Settings className="size-3.5" />
                {t("ai.configAgents")}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {subAgents.map((agent) => (
              <Card
                key={agent.id}
                className={`group border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950 transition-all hover:-translate-y-1 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-400/20 ${!agent.enabled ? "opacity-50" : ""}`}
              >
                <CardContent className="p-4 text-center">
                  <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl border border-cyan-400/50 bg-gradient-to-br from-blue-900 to-slate-900 text-xl text-cyan-400 shadow-inner shadow-cyan-400/20">
                    {agent.icon}
                  </div>
                  <h3 className="text-[11px] font-bold">{agent.name}</h3>
                  <p className="mt-1 text-[10px] text-slate-400">{agent.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-emerald-400">
                      <span className="mr-1 inline-block size-1.5 rounded-full bg-current shadow-lg shadow-current" />
                      {agent.enabled ? agent.status : "OFF"}
                    </span>
                    <Switch checked={agent.enabled} onCheckedChange={() => toggleSubAgent(agent.id)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Main Grid */}
        <section className="grid gap-4 lg:grid-cols-3">
          {/* Live Market Stream */}
          <Card className="border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest">
                <span className="text-cyan-400">◈</span> {t("ai.liveStream")}{" "}
                <span className="text-[10px] font-normal text-slate-400">· simulated</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative h-44">
                <canvas ref={canvasRef} className="size-full" aria-label="Simulated market chart" />
              </div>
              <div className="mt-2 flex gap-4 text-[10px] text-slate-400">
                <span>
                  <span className="mr-1 inline-block size-2 rounded-sm bg-cyan-400" />
                  Market index
                </span>
                <span>
                  <span className="mr-1 inline-block size-2 rounded-sm bg-violet-400" />
                  Signal strength
                </span>
                <span className="ml-auto">INDEX {marketValue.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Event Sniffer */}
          <Card className="border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest">
                <span className="text-cyan-400">⌘</span> {t("ai.eventSniffer")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-44 overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                {filteredLogs.slice(0, 25).map((log, i) => (
                  <div key={i} className="border-b border-white/5 pb-1">
                    <span className="text-slate-500">[{log.time}]</span>{" "}
                    <span className={log.kind === "ok" ? "text-emerald-400" : log.kind === "warn" ? "text-amber-400" : "text-cyan-400"}>
                      {log.kind.toUpperCase()}
                    </span>{" "}
                    {log.agent}: {log.msg}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Filter log (mis. risk, server)..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLogs([]);
                    toast.success("Event log dibersihkan");
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Command Chat */}
          <Card className="border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest">
                <span className="text-cyan-400">◉</span> {t("ai.commandChat")}{" "}
                <span className="text-[10px] font-normal text-slate-400">· local demo</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 overflow-auto space-y-2">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg border-l-2 px-3 py-2 text-[11px] ${
                      msg.isUser
                        ? "border-violet-400 bg-violet-950/50"
                        : "border-cyan-400 bg-slate-800/50"
                    }`}
                  >
                    <span className="font-semibold">
                      {msg.isUser ? "Anda" : "Shibai Core"}:
                    </span>{" "}
                    {msg.text}
                  </div>
                ))}
              </div>
              <form onSubmit={handleChatSubmit} className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik perintah..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                />
                <Button type="submit" size="sm" variant="default">
                  Kirim
                </Button>
              </form>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" onClick={handleVoiceInput}>
                  <Mic className="size-3" /> Voice input
                </Button>
                <Button variant="outline" size="sm" onClick={handleSpeak}>
                  <Speaker className="size-3" /> Read reply
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Core Capabilities */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest">{t("ai.capabilities")}</h2>
            <span className="text-xs text-slate-400">Toggle to simulate module state</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((feature) => (
              <Card
                key={feature.key}
                className="border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xl text-cyan-400">
                      {feature.key === "chat" && "◉"}
                      {feature.key === "voice" && "♫"}
                      {feature.key === "analysis" && "⌁"}
                      {feature.key === "sniffer" && "⌕"}
                      {feature.key === "watchdog" && "⬡"}
                    </span>
                    <Switch
                      checked={features[feature.key]}
                      onCheckedChange={() => toggleFeature(feature.key)}
                    />
                  </div>
                  <div className="mt-2 text-xs font-bold">{feature.label}</div>
                  <p className="mt-1 text-[11px] text-slate-400">{feature.desc}</p>
                  <div className="mt-2 text-[9px] font-semibold uppercase tracking-widest text-emerald-400">
                    {features[feature.key] ? "ENABLED" : "DISABLED"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Multi Trading Server */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest">{t("ai.servers")}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{tradingServers.filter((s) => s.enabled).length} / {tradingServers.length} connected</span>
              <Button variant="outline" size="sm" onClick={() => setShowPrompts(true)}>
                <BookOpen className="size-3.5" />
                {t("ai.promptLibrary")}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {tradingServers.map((server) => (
              <Card
                key={server.id}
                className={`border-slate-700 bg-slate-950 ${!server.enabled ? "opacity-50" : ""}`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <div className="h-1.5 w-7 rounded bg-cyan-400 shadow-lg shadow-cyan-400/50" style={{ animation: "serverBlink 1.6s infinite" }} />
                    <div className="h-1.5 w-7 rounded bg-cyan-400 shadow-lg shadow-cyan-400/50" style={{ animation: "serverBlink 1.6s infinite", animationDelay: "0.4s" }} />
                    <div className="h-1.5 w-7 rounded bg-cyan-400 shadow-lg shadow-cyan-400/50" style={{ animation: "serverBlink 1.6s infinite", animationDelay: "0.8s" }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] font-bold">{server.name}</div>
                    <div className="text-[10px] text-slate-400">{server.provider} — {server.description}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-[9px] font-semibold text-emerald-400">{server.testnet ? "TESTNET" : "LIVE"}</div>
                    <Switch checked={server.enabled} onCheckedChange={() => toggleServer(server.id)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Settings Panel */}
        {showSettings && (
          <section className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">
                <Cpu className="mr-2 inline size-4" />
                {t("ai.agentSettings")}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>✕</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {subAgents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950 p-3">
                  <div>
                    <div className="text-xs font-bold">{agent.icon} {agent.name}</div>
                    <div className="text-[10px] text-slate-400">{agent.description}</div>
                    <div className="mt-1 text-[9px] text-slate-500">
                      Interval: {agent.intervalSeconds}s · Priority: {agent.priority}
                    </div>
                  </div>
                  <Switch checked={agent.enabled} onCheckedChange={() => toggleSubAgent(agent.id)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Prompt Library Modal */}
        {showPrompts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-cyan-500/30 bg-slate-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-cyan-400">
                  <BookOpen className="mr-2 inline size-5" />
                  {t("ai.promptLibrary")} ({promptLibrary.length})
                </h2>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setEditingPrompt({ id: "", name: "", category: "market_analysis", description: "", prompt: "", variables: [], enabled: true, priority: 5, subAgentRoles: [], createdAt: "", updatedAt: "" })}>
                    <Plus className="mr-1 size-3.5" /> New Prompt
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowPrompts(false); setEditingPrompt(null); }}>✕</Button>
                </div>
              </div>

              {editingPrompt ? (
                <PromptEditor prompt={editingPrompt} onSave={savePrompt} onCancel={() => setEditingPrompt(null)} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {promptLibrary.map((prompt) => (
                    <Card key={prompt.id} className="border-slate-700 bg-slate-950">
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-bold">{prompt.name}</h3>
                            <span className="mt-1 inline-block rounded bg-cyan-900/50 px-2 py-0.5 text-[9px] font-semibold uppercase text-cyan-400">
                              {prompt.category.replace("_", " ")}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditingPrompt(prompt)}>
                              <Edit2 className="size-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deletePrompt(prompt.id)}>
                              <Trash2 className="size-3 text-red-400" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400">{prompt.description}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[9px] text-slate-500">
                            Agents: {prompt.subAgentRoles.join(", ")}
                          </span>
                          <Switch checked={prompt.enabled} onCheckedChange={() => savePrompt({ ...prompt, enabled: !prompt.enabled })} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-4 text-[10px] text-slate-500">
          <span>SHIBAI AI TRADING AGENT · COMMAND CENTER UI</span>
          <span>Semua angka, log, grafik, dan status server pada demo ini bersifat simulasi.</span>
          <span>Trading sungguhan memerlukan backend, data feed, autentikasi, dan kontrol risiko.</span>
        </footer>
      </main>

      <style>{`
        @keyframes starDrift {
          to { background-position: 280px 220px; }
        }
        @keyframes gridMove {
          to { background-position: 0 32px; }
        }
        @keyframes orbitSpin {
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes planetFloat {
          50% { transform: translate(-50%, -53%); }
        }
        @keyframes serverBlink {
          50% { background: #55f3ff; box-shadow: 0 0 12px #55f3ff; }
        }
      `}</style>
    </div>
  );
}

const PROMPT_CATEGORIES = [
  { value: "wallet_monitor", label: "Wallet Monitor" },
  { value: "news_analysis", label: "News Analysis" },
  { value: "news_surveillance", label: "News Surveillance" },
  { value: "telegram_forum", label: "Telegram Forum" },
  { value: "twitter_x", label: "Twitter/X" },
  { value: "copy_trading", label: "Copy Trading" },
  { value: "market_analysis", label: "Market Analysis" },
  { value: "risk_assessment", label: "Risk Assessment" },
  { value: "sentiment", label: "Sentiment" },
  { value: "execution", label: "Execution" },
];

const SUB_AGENT_ROLES: SubAgentRole[] = [
  "market_scanner", "trading_executor", "risk_manager", "news_analyzer",
  "portfolio_manager", "backtester", "data_aggregator", "wallet_monitor",
  "social_sentinel", "copy_trader",
];

function PromptEditor({ prompt, onSave, onCancel }: {
  prompt: Partial<AiPromptTemplate>;
  onSave: (p: Partial<AiPromptTemplate>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(prompt);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400">Name</label>
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400">Category</label>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={form.category || "market_analysis"}
            onChange={(e) => setForm({ ...form, category: e.target.value as AiPromptTemplate["category"] })}
          >
            {PROMPT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase text-slate-400">Description</label>
        <input
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase text-slate-400">Prompt Template</label>
        <textarea
          className="mt-1 h-48 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
          value={form.prompt || ""}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          placeholder="Masukkan prompt template. Gunakan {{variable}} untuk variabel dinamis."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400">Variables (comma separated)</label>
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={(form.variables || []).join(", ")}
            onChange={(e) => setForm({ ...form, variables: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400">Priority (1-10)</label>
          <input
            type="number"
            min={1}
            max={10}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={form.priority || 5}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase text-slate-400">Sub-Agent Roles</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {SUB_AGENT_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px]">
              <input
                type="checkbox"
                checked={(form.subAgentRoles || []).includes(role)}
                onChange={(e) => {
                  const roles = e.target.checked
                    ? [...(form.subAgentRoles || []), role]
                    : (form.subAgentRoles || []).filter((r) => r !== role);
                  setForm({ ...form, subAgentRoles: roles });
                }}
              />
              {role.replace("_", " ")}
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)}>
          {form.id ? "Update" : "Create"} Prompt
        </Button>
      </div>
    </div>
  );
}
