import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Crosshair,
  Gamepad2,
  GitBranch,
  ImagePlus,
  Layers,
  ListOrdered,
  Loader2,
  Medal,
  Monitor,
  Plus,
  Rocket,
  Save,
  Smartphone,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";
import { ApiError, api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link, useQueryParam, useRoute } from "@/lib/router";
import {
  ESPORT_BEST_OF_OPTIONS,
  ESPORT_CATEGORY_META,
  ESPORT_FORMAT_META,
  ESPORT_PLATFORM_META,
  ESPORT_PRIZE_APPROVAL_THRESHOLD,
  ESPORT_PRIZE_DISTRIBUTION,
  ESPORT_STATUS_META,
  ESPORT_STREAM_PLATFORM_PRESETS,
  ESPORT_TIMEZONES,
  ROLE_RANK,
} from "@/lib/constants";
import { formatRupiah, toLocalInputValue } from "@/lib/format";
import { docErrorText, prepareBannerImage } from "@/lib/verify-doc";
import type {
  EsportCategory,
  EsportFormat,
  EsportGame,
  EsportPlatform,
  EsportPrize,
  EsportTournamentDetail,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AccountGate, EmptyState, ErrorNote, LoadingGrid, PageBanner, SectionHeading } from "@/components/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FORMAT_ICON: Record<EsportFormat, typeof GitBranch> = {
  single_elim: GitBranch,
  double_elim: Swords,
  round_robin: ListOrdered,
  group_playoff: Trophy,
  swiss: Layers,
  battle_royale: Crosshair,
  league: Medal,
};

const PLATFORM_ICON: Record<string, typeof Monitor> = {
  pc: Monitor,
  mobile: Smartphone,
  console: Gamepad2,
};

const FORMATS = Object.keys(ESPORT_FORMAT_META) as EsportFormat[];
const PLATFORMS = Object.keys(ESPORT_PLATFORM_META) as EsportPlatform[];
const CATEGORIES: EsportCategory[] = ["amateur", "semi_pro", "professional"];

const STEPS = [
  { id: "game", label: "Game & Format" },
  { id: "info", label: "Info Dasar" },
  { id: "schedule", label: "Jadwal" },
  { id: "teams", label: "Tim & Peserta" },
  { id: "prize", label: "Prize Pool" },
  { id: "rules", label: "Peraturan" },
  { id: "streaming", label: "Streaming" },
  { id: "review", label: "Tinjau & Publish" },
];

interface BasicDraft {
  title: string;
  description: string;
  bannerData: string;
  tags: string;
  category: EsportCategory;
}

interface ScheduleDraft {
  registrationOpenAt: string;
  registrationCloseAt: string;
  technicalMeetingAt: string;
  qualifierStartAt: string;
  mainEventStartAt: string;
  grandFinalAt: string;
  timezone: string;
}

interface TeamsDraft {
  maxTeams: string;
  rosterMin: string;
  rosterMax: string;
  gameMode: string;
  minPlayers: string;
  substituteMax: string;
  entryFee: string;
  minLevel: string;
  minAge: string;
  regionLock: string;
  requireVerified: boolean;
  extra: string;
}

interface PrizeRow {
  placement: number;
  amount: string;
  label: string;
}

interface SponsorRow {
  key: string;
  name: string;
  amount: string;
}

interface PrizeDraft {
  rows: PrizeRow[];
  bulkTotal: string;
  fundingSource: string;
  operationalBudget: string;
  sponsors: SponsorRow[];
}

interface RulesDraft {
  bestOf: string;
  checkinWindow: string;
  rules: string;
  banPick: string;
  gameRules: string;
  latePenalty: string;
  disconnectPolicy: string;
  substitutePolicy: string;
  anticheatPolicy: string;
  disputePolicy: string;
}

interface StreamingDraft {
  streamUrl: string;
  platforms: string[];
  concurrentStreams: string;
  casterSlots: string;
  overlayEnabled: boolean;
  overlayNotes: string;
  observerEnabled: boolean;
  recordingEnabled: boolean;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyBasic = (): BasicDraft => ({
  title: "",
  description: "",
  bannerData: "",
  tags: "",
  category: "amateur",
});

const emptySchedule = (): ScheduleDraft => ({
  registrationOpenAt: "",
  registrationCloseAt: "",
  technicalMeetingAt: "",
  qualifierStartAt: "",
  mainEventStartAt: "",
  grandFinalAt: "",
  timezone: "Asia/Jakarta",
});

const emptyTeams = (): TeamsDraft => ({
  maxTeams: "8",
  rosterMin: "",
  rosterMax: "",
  gameMode: "",
  minPlayers: "",
  substituteMax: "0",
  entryFee: "0",
  minLevel: "",
  minAge: "",
  regionLock: "",
  requireVerified: false,
  extra: "",
});

const prizeRowsFrom = (prizes: EsportPrize[]): PrizeRow[] =>
  [1, 2, 3, 4].map((placement) => {
    const found = prizes.find((p) => p.placement === placement);
    return { placement, amount: found ? String(found.amount) : "", label: found?.label ?? `Juara ${placement}` };
  });

const defaultPrizeRows = (): PrizeRow[] =>
  [1, 2, 3, 4].map((placement) => ({ placement, amount: "", label: `Juara ${placement}` }));

const emptyPrizePool = (): PrizeDraft => ({
  rows: defaultPrizeRows(),
  bulkTotal: "",
  fundingSource: "",
  operationalBudget: "0",
  sponsors: [],
});

const emptyRules = (): RulesDraft => ({
  bestOf: "1",
  checkinWindow: "30",
  rules: "",
  banPick: "",
  gameRules: "",
  latePenalty: "",
  disconnectPolicy: "",
  substitutePolicy: "",
  anticheatPolicy: "",
  disputePolicy: "",
});

const emptyStreaming = (): StreamingDraft => ({
  streamUrl: "",
  platforms: [],
  concurrentStreams: "1",
  casterSlots: "0",
  overlayEnabled: false,
  overlayNotes: "",
  observerEnabled: false,
  recordingEnabled: false,
});

const toIsoOrNull = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function StepBadge({ index, current }: { index: number; current: number }) {
  if (index < current) return <CheckCircle2 className="size-3.5" aria-hidden />;
  return <span className="text-[11px] font-bold">{index + 1}</span>;
}

export default function EsportCreatePage() {
  const { account } = useAuth();
  const { navigate } = useRoute();
  const resumeId = useQueryParam("id");
  const rank = account ? (ROLE_RANK[account.role] ?? 0) : 0;

  const [step, setStep] = useState(0);
  const [games, setGames] = useState<EsportGame[]>([]);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [gameId, setGameId] = useState("");
  const [format, setFormat] = useState<EsportFormat>("single_elim");
  const [platform, setPlatform] = useState<EsportPlatform>("mobile");
  const [basic, setBasic] = useState<BasicDraft>(emptyBasic);
  const [schedule, setSchedule] = useState<ScheduleDraft>(emptySchedule);
  const [teams, setTeams] = useState<TeamsDraft>(emptyTeams);
  const [prizePool, setPrizePool] = useState<PrizeDraft>(emptyPrizePool);
  const [rules, setRules] = useState<RulesDraft>(emptyRules);
  const [streaming, setStreaming] = useState<StreamingDraft>(emptyStreaming);
  const [initialStatus, setInitialStatus] = useState<"registration" | "draft">("registration");
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<string>("draft");
  const [hydrating, setHydrating] = useState(Boolean(resumeId));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const tournamentIdRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const buildPayloadRef = useRef<() => Record<string, unknown>>(() => ({}));
  const snapshotRef = useRef("");
  const stateRef = useRef({ dirty: false, ready: false });
  const markCleanRef = useRef(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ items: EsportGame[] }>("esport.games.list");
        setGames(res.items);
        setGameId((prev) => prev || res.items[0]?.id || "");
      } catch (err) {
        setGamesError(errorText(err));
      }
    })();
  }, []);

  const selectedGame = useMemo(() => games.find((g) => g.id === gameId) ?? null, [games, gameId]);

  const applyResume = useCallback((data: EsportTournamentDetail) => {
    const t = data.tournament;
    markCleanRef.current = true;
    tournamentIdRef.current = t.id;
    setTournamentId(t.id);
    setDraftStatus(t.status);
    setGameId(data.game?.id ?? "");
    setFormat(t.format);
    setPlatform(t.platform);
    setBasic({
      title: t.title,
      description: t.description ?? "",
      bannerData: t.bannerData ?? "",
      tags: t.tags ?? "",
      category: t.category,
    });
    setSchedule({
      registrationOpenAt: toLocalInputValue(t.registrationOpenAt),
      registrationCloseAt: toLocalInputValue(t.registrationCloseAt),
      technicalMeetingAt: toLocalInputValue(t.technicalMeetingAt),
      qualifierStartAt: toLocalInputValue(t.qualifierStartAt),
      mainEventStartAt: toLocalInputValue(t.mainEventStartAt),
      grandFinalAt: toLocalInputValue(t.grandFinalAt),
      timezone: t.timezone ?? "Asia/Jakarta",
    });
    const req = t.requirements;
    setTeams({
      maxTeams: String(t.maxTeams),
      rosterMin: t.rosterMin ? String(t.rosterMin) : "",
      rosterMax: t.rosterMax ? String(t.rosterMax) : "",
      gameMode: t.gameMode ?? "",
      minPlayers: t.minPlayers ? String(t.minPlayers) : "",
      substituteMax: String(t.substituteMax ?? 0),
      entryFee: String(t.entryFee ?? 0),
      minLevel: req && req.minLevel ? String(req.minLevel) : "",
      minAge: req && req.minAge ? String(req.minAge) : "",
      regionLock: req?.regionLock ?? "",
      requireVerified: Boolean(req?.requireVerified),
      extra: req?.extra ?? "",
    });
    setPrizePool({
      rows: prizeRowsFrom(data.prizes),
      bulkTotal: "",
      fundingSource: t.fundingSource ?? "",
      operationalBudget: String(t.operationalBudget ?? 0),
      sponsors: (t.sponsorshipSlots ?? []).map((slot) => ({ key: uid(), name: slot.name, amount: String(slot.amount) })),
    });
    const rd = t.rulesDetail;
    setRules({
      bestOf: String(t.bestOf ?? 1),
      checkinWindow: String(t.checkinWindowMinutes ?? 30),
      rules: t.rules ?? "",
      banPick: rd?.banPick ?? "",
      gameRules: rd?.gameRules ?? "",
      latePenalty: rd?.latePenalty ?? "",
      disconnectPolicy: rd?.disconnectPolicy ?? "",
      substitutePolicy: rd?.substitutePolicy ?? "",
      anticheatPolicy: rd?.anticheatPolicy ?? "",
      disputePolicy: rd?.disputePolicy ?? "",
    });
    const sc = t.streamingConfig;
    setStreaming({
      streamUrl: t.streamUrl ?? "",
      platforms: sc?.platforms ?? [],
      concurrentStreams: String(sc?.concurrentStreams ?? 1),
      casterSlots: String(sc?.casterSlots ?? 0),
      overlayEnabled: Boolean(sc?.overlayEnabled),
      overlayNotes: sc?.overlayNotes ?? "",
      observerEnabled: Boolean(sc?.observerEnabled),
      recordingEnabled: Boolean(sc?.recordingEnabled),
    });
  }, []);

  useEffect(() => {
    if (!resumeId || !account || hydratedRef.current) return;
    hydratedRef.current = true;
    void (async () => {
      try {
        const data = await api<EsportTournamentDetail>("esport.tournaments.get", { id: resumeId });
        if (!["draft", "registration"].includes(data.tournament.status)) {
          toast.info("Turnamen sudah berjalan — pengaturan lanjutan tersedia di halaman kelola.");
          navigate(`/kompetisi-esport/kelola/${data.tournament.id}`);
          return;
        }
        applyResume(data);
      } catch (error) {
        toast.error(errorText(error));
      } finally {
        setHydrating(false);
      }
    })();
  }, [resumeId, account, applyResume, navigate]);

  const snapshot = useMemo(
    () => JSON.stringify({ gameId, format, platform, basic, schedule, teams, prizePool, rules, streaming }),
    [gameId, format, platform, basic, schedule, teams, prizePool, rules, streaming],
  );
  const lastSnapshotRef = useRef(snapshot);
  useEffect(() => {
    if (markCleanRef.current) {
      markCleanRef.current = false;
      lastSnapshotRef.current = snapshot;
      return;
    }
    if (lastSnapshotRef.current === snapshot) return;
    lastSnapshotRef.current = snapshot;
    setDirty(true);
  }, [snapshot]);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    stateRef.current = { dirty, ready: Boolean(gameId) && basic.title.trim().length >= 4 };
  }, [dirty, gameId, basic.title]);

  const prizeTotal = useMemo(
    () => prizePool.rows.reduce((sum, row) => sum + Math.round(Number(row.amount) || 0), 0),
    [prizePool.rows],
  );
  const sponsorTotal = useMemo(
    () => prizePool.sponsors.reduce((sum, row) => sum + Math.round(Number(row.amount) || 0), 0),
    [prizePool.sponsors],
  );
  const needsApproval = prizeTotal > ESPORT_PRIZE_APPROVAL_THRESHOLD;

  const buildPayload = useCallback((): Record<string, unknown> => {
    const startAt = schedule.mainEventStartAt || schedule.qualifierStartAt;
    return {
      gameId: gameId || undefined,
      title: basic.title.trim(),
      description: basic.description.trim(),
      format,
      platform,
      category: basic.category,
      bannerData: basic.bannerData,
      tags: basic.tags.trim(),
      maxTeams: Number(teams.maxTeams) || 8,
      rosterMin: teams.rosterMin ? Number(teams.rosterMin) : undefined,
      rosterMax: teams.rosterMax ? Number(teams.rosterMax) : undefined,
      gameMode: teams.gameMode.trim() || undefined,
      minPlayers: teams.minPlayers ? Number(teams.minPlayers) : undefined,
      substituteMax: Number(teams.substituteMax) || 0,
      entryFee: Math.round(Number(teams.entryFee) || 0),
      bestOf: Number(rules.bestOf) || 1,
      checkinWindowMinutes: Number(rules.checkinWindow) || 0,
      registrationOpenAt: toIsoOrNull(schedule.registrationOpenAt),
      registrationCloseAt: toIsoOrNull(schedule.registrationCloseAt),
      technicalMeetingAt: toIsoOrNull(schedule.technicalMeetingAt),
      qualifierStartAt: toIsoOrNull(schedule.qualifierStartAt),
      mainEventStartAt: toIsoOrNull(schedule.mainEventStartAt),
      grandFinalAt: toIsoOrNull(schedule.grandFinalAt),
      startAt: toIsoOrNull(startAt),
      timezone: schedule.timezone,
      requirements: {
        minLevel: Number(teams.minLevel) || 0,
        minAge: Number(teams.minAge) || 0,
        regionLock: teams.regionLock.trim(),
        requireVerified: teams.requireVerified,
        extra: teams.extra.trim(),
      },
      prizes: prizePool.rows
        .map((row) => ({
          placement: row.placement,
          label: row.label.trim() || `Juara ${row.placement}`,
          amount: Math.round(Number(row.amount) || 0),
        }))
        .filter((row) => row.amount > 0),
      fundingSource: prizePool.fundingSource.trim(),
      operationalBudget: Math.round(Number(prizePool.operationalBudget) || 0),
      sponsorshipSlots: prizePool.sponsors
        .filter((row) => row.name.trim())
        .map((row) => ({ name: row.name.trim(), amount: Math.round(Number(row.amount) || 0) })),
      rules: rules.rules.trim(),
      rulesDetail: {
        banPick: rules.banPick.trim(),
        gameRules: rules.gameRules.trim(),
        latePenalty: rules.latePenalty.trim(),
        disconnectPolicy: rules.disconnectPolicy.trim(),
        substitutePolicy: rules.substitutePolicy.trim(),
        anticheatPolicy: rules.anticheatPolicy.trim(),
        disputePolicy: rules.disputePolicy.trim(),
      },
      streamUrl: streaming.streamUrl.trim(),
      streamingConfig: {
        platforms: streaming.platforms,
        concurrentStreams: Number(streaming.concurrentStreams) || 1,
        casterSlots: Number(streaming.casterSlots) || 0,
        overlayEnabled: streaming.overlayEnabled,
        overlayNotes: streaming.overlayNotes.trim(),
        observerEnabled: streaming.observerEnabled,
        recordingEnabled: streaming.recordingEnabled,
      },
    };
  }, [gameId, format, platform, basic, schedule, teams, prizePool, rules, streaming]);

  useEffect(() => {
    buildPayloadRef.current = buildPayload;
  }, [buildPayload]);

  const saveDraft = useCallback((options?: { silent?: boolean }): Promise<string | null> => {
    const task = saveChainRef.current.then(async () => {
      const payload = buildPayloadRef.current();
      const title = String(payload.title ?? "");
      if (!payload.gameId || title.length < 4) return null;
      const snapshotAtSave = snapshotRef.current;
      setSaveState("saving");
      try {
        let id = tournamentIdRef.current;
        if (id) {
          await api("esport.tournaments.update", { id, ...payload });
        } else {
          const res = await api<{ id: string }>("esport.tournaments.create", { ...payload, status: "draft" });
          id = res.id;
          tournamentIdRef.current = id;
          setTournamentId(id);
          setDraftStatus("draft");
        }
        setSaveState("saved");
        setLastSavedAt(new Date());
        if (snapshotRef.current === snapshotAtSave) setDirty(false);
        return id;
      } catch (error) {
        setSaveState("error");
        if (!options?.silent) toast.error(errorText(error));
        return null;
      }
    });
    saveChainRef.current = task.catch(() => undefined);
    return task;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = stateRef.current;
      if (!current.dirty || !current.ready) return;
      void saveDraft({ silent: true });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [saveDraft]);

  const stepError = useCallback(
    (index: number): string | null => {
      if (index === 0) {
        if (!gameId) return "Pilih game yang akan dipertandingkan.";
      }
      if (index === 1) {
        if (basic.title.trim().length < 4) return "Judul turnamen minimal 4 karakter.";
      }
      if (index === 2) {
        const chain: Array<[string, string, string]> = [
          [schedule.registrationOpenAt, schedule.registrationCloseAt, "Pendaftaran ditutup harus setelah pendaftaran dibuka."],
          [schedule.registrationCloseAt, schedule.technicalMeetingAt, "Technical meeting harus setelah pendaftaran ditutup."],
          [schedule.technicalMeetingAt, schedule.qualifierStartAt, "Kualifikasi harus setelah technical meeting."],
          [schedule.qualifierStartAt, schedule.mainEventStartAt, "Babak utama harus setelah kualifikasi."],
          [schedule.mainEventStartAt, schedule.grandFinalAt, "Grand final harus setelah babak utama."],
        ];
        for (const [earlier, later, message] of chain) {
          if (earlier && later && new Date(later).getTime() <= new Date(earlier).getTime()) return message;
        }
      }
      if (index === 3) {
        const maxTeamsNum = Number(teams.maxTeams);
        if (!Number.isInteger(maxTeamsNum) || maxTeamsNum < 8 || maxTeamsNum > 128) {
          return "Kuota tim harus antara 8 sampai 128.";
        }
        const rosterMinNum = teams.rosterMin ? Number(teams.rosterMin) : null;
        const rosterMaxNum = teams.rosterMax ? Number(teams.rosterMax) : null;
        if (rosterMinNum !== null && (rosterMinNum < 1 || rosterMinNum > 15)) {
          return "Roster minimum harus antara 1 sampai 15 pemain.";
        }
        if (rosterMaxNum !== null && (rosterMaxNum < 1 || rosterMaxNum > 15)) {
          return "Roster maksimum harus antara 1 sampai 15 pemain.";
        }
        if (rosterMinNum !== null && rosterMaxNum !== null && rosterMinNum > rosterMaxNum) {
          return "Jumlah pemain minimum tidak boleh melebihi maksimum.";
        }
        const minPlayersNum = teams.minPlayers ? Number(teams.minPlayers) : null;
        if (minPlayersNum !== null && (!Number.isInteger(minPlayersNum) || minPlayersNum < 1 || minPlayersNum > 15)) {
          return "Pemain inti minimal harus antara 1 sampai 15 pemain.";
        }
        if (teams.gameMode.trim().length > 40) return "Mode permainan maksimal 40 karakter.";
        const substituteMaxNum = Number(teams.substituteMax) || 0;
        if (substituteMaxNum < 0 || substituteMaxNum > 10) return "Pemain cadangan maksimal 10 orang.";
        const minLevelNum = Number(teams.minLevel) || 0;
        if (minLevelNum < 0 || minLevelNum > 50) return "Syarat level harus antara 1 sampai 50.";
        const minAgeNum = Number(teams.minAge) || 0;
        if (minAgeNum < 0 || minAgeNum > 99) return "Syarat usia harus antara 1 sampai 99 tahun.";
      }
      if (index === 4) {
        if (prizePool.rows.some((row) => Number(row.amount) < 0)) return "Nominal hadiah tidak boleh negatif.";
        if (prizePool.sponsors.some((row) => !row.name.trim() && Number(row.amount) > 0)) {
          return "Nama sponsor wajib diisi jika nominalnya diisi.";
        }
      }
      if (index === 6) {
        const concurrent = Number(streaming.concurrentStreams) || 1;
        if (concurrent < 1 || concurrent > 20) return "Jumlah siaran paralel harus antara 1 sampai 20.";
        const casterSlots = Number(streaming.casterSlots) || 0;
        if (casterSlots < 0 || casterSlots > 20) return "Slot caster harus antara 0 sampai 20.";
      }
      return null;
    },
    [gameId, basic.title, schedule, teams, prizePool.rows, prizePool.sponsors, streaming],
  );

  const goNext = () => {
    const error = stepError(step);
    if (error) {
      setSectionError(error);
      toast.error(error);
      return;
    }
    setSectionError(null);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      void saveDraft({ silent: true });
    }
  };

  const goBack = () => {
    setSectionError(null);
    if (step > 0) setStep(step - 1);
  };

  const applyPrizeDistribution = () => {
    const total = Math.round(Number(prizePool.bulkTotal) || 0);
    if (total <= 0) {
      toast.error("Isi total hadiah terlebih dahulu.");
      return;
    }
    setPrizePool((current) => ({
      ...current,
      rows: current.rows.map((row, index) => {
        const percent = ESPORT_PRIZE_DISTRIBUTION[index] ?? 0;
        return percent ? { ...row, amount: String(Math.round((total * percent) / 100)) } : row;
      }),
    }));
  };

  const toggleStreamPlatform = (preset: string) => {
    setStreaming((current) => ({
      ...current,
      platforms: current.platforms.includes(preset)
        ? current.platforms.filter((item) => item !== preset)
        : [...current.platforms, preset],
    }));
  };

  const requirementSummary = useMemo(() => {
    const parts: string[] = [];
    if (Number(teams.minLevel) > 0) parts.push(`Level ≥ ${Number(teams.minLevel)}`);
    if (Number(teams.minAge) > 0) parts.push(`Usia ≥ ${Number(teams.minAge)} th`);
    if (teams.regionLock.trim()) parts.push(`Region: ${teams.regionLock.trim()}`);
    if (teams.requireVerified) parts.push("Akun terverifikasi");
    return parts.length ? parts.join(" · ") : "Tanpa syarat khusus";
  }, [teams.minLevel, teams.minAge, teams.regionLock, teams.requireVerified]);

  const rosterSummary = useMemo(() => {
    const min = teams.rosterMin ? Number(teams.rosterMin) : selectedGame?.teamSizeMin ?? null;
    const max = teams.rosterMax ? Number(teams.rosterMax) : selectedGame?.rosterMax ?? null;
    const parts: string[] = [];
    if (min && max) parts.push(`${min}–${max} pemain`);
    else if (max) parts.push(`maks. ${max} pemain`);
    else if (min) parts.push(`min. ${min} pemain`);
    const subs = Number(teams.substituteMax) || 0;
    if (subs > 0) parts.push(`${subs} cadangan`);
    return parts.length ? parts.join(" · ") : "Bawaan game";
  }, [teams.rosterMin, teams.rosterMax, teams.substituteMax, selectedGame]);

  const publish = async () => {
    for (let index = 0; index <= 6; index += 1) {
      const error = stepError(index);
      if (error) {
        setStep(index);
        setSectionError(error);
        toast.error(error);
        return;
      }
    }
    setPublishing(true);
    try {
      const id = await saveDraft({ silent: false });
      if (!id) return;
      if (initialStatus === "registration" && draftStatus !== "registration") {
        try {
          await api("esport.tournaments.update", { id, status: "registration" });
          setDraftStatus("registration");
          toast.success("Turnamen dibuat — pendaftaran tim sudah dibuka!");
        } catch (error) {
          if (error instanceof ApiError && error.code === "approval_required") {
            toast.info("Turnamen tersimpan sebagai draf menunggu persetujuan admin (hadiah > Rp10 juta).");
          } else {
            throw error;
          }
        }
      } else if (initialStatus === "draft") {
        toast.success("Draf turnamen tersimpan. Buka pendaftaran kapan saja dari halaman kelola.");
      }
      navigate(`/kompetisi-esport/kelola/${id}`);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPublishing(false);
    }
  };

  if (!account) {
    return (
      <AccountGate
        title="Masuk untuk membuat turnamen"
        description="Penyelenggaraan Kompetisi E-Sport tersedia untuk anggota terverifikasi Panti Janda."
      />
    );
  }

  if (rank < 2) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <EmptyState
          icon={<Rocket className="size-5" aria-hidden />}
          title="Akun belum memenuhi syarat"
          description="Hanya anggota aktif terverifikasi yang dapat menyelenggarakan turnamen."
        />
      </div>
    );
  }

  if (hydrating) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <LoadingGrid count={4} />
      </div>
    );
  }

  const statusMeta = ESPORT_STATUS_META[draftStatus] ?? ESPORT_STATUS_META.draft;
  const scheduleError = stepError(2);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/kompetisi-esport">
            <ArrowLeft className="size-4" aria-hidden />
            Kembali ke Kompetisi E-Sport
          </Link>
        </Button>
        {tournamentId ? (
          <Button asChild variant="outline" size="sm">
            <Link to={`/kompetisi-esport/kelola/${tournamentId}`}>Buka Halaman Kelola</Link>
          </Button>
        ) : null}
      </div>

      <PageBanner>
        <SectionHeading
          eyebrow="Wizard Turnamen"
          title={tournamentId ? "Lanjutkan draf turnamen" : "Buat turnamen baru"}
          description="Delapan langkah terstruktur: game & format, info dasar, jadwal, tim & peserta, prize pool, peraturan, streaming, lalu publikasi. Draf tersimpan otomatis setiap 30 detik."
        />
      </PageBanner>

      {gamesError ? <ErrorNote message={gamesError} /> : null}

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ol className="flex flex-wrap items-center gap-2">
            {STEPS.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (index < step) {
                      setSectionError(null);
                      setStep(index);
                    }
                  }}
                  disabled={index > step}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    index === step && "border-primary bg-primary text-primary-foreground",
                    index < step && "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
                    index > step && "border-border bg-secondary/40 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full",
                      index === step ? "bg-primary-foreground/20" : index < step ? "bg-emerald-200/70" : "bg-secondary",
                    )}
                  >
                    <StepBadge index={index} current={step} />
                  </span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium", statusMeta.tone)}>
              {statusMeta.label}
            </span>
            <span className="inline-flex items-center gap-1">
              {saveState === "saving" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Menyimpan…
                </>
              ) : saveState === "error" ? (
                <>
                  <XCircle className="size-3.5 text-destructive" aria-hidden /> Gagal menyimpan draf
                </>
              ) : lastSavedAt ? (
                <>
                  <Save className="size-3.5" aria-hidden />
                  Tersimpan {lastSavedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </>
              ) : (
                "Draf tersimpan otomatis"
              )}
            </span>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {sectionError ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <CircleAlert className="size-4 text-destructive" aria-hidden />
          {sectionError}
        </div>
      ) : null}

      {step === 0 ? (
        <div className="space-y-6">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">Pilih game yang dipertandingkan *</h3>
              <p className="text-sm text-muted-foreground">
                Roster bawaan dan mode pertandingan mengikuti game yang dipilih.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {games.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGameId(g.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-colors",
                    gameId === g.id
                      ? "border-orange-300 bg-orange-100 text-orange-900"
                      : "border-border bg-background text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <span className="text-lg" aria-hidden>
                    {g.icon ?? "🎮"}
                  </span>
                  <span className="text-left">
                    <span className="block font-medium">{g.name}</span>
                    <span className="block text-xs opacity-80">{g.mode}</span>
                  </span>
                </button>
              ))}
            </div>
            {selectedGame ? (
              <p className="text-xs text-muted-foreground">
                Roster bawaan: {selectedGame.teamSizeMin} pemain inti (maks. {selectedGame.rosterMax} termasuk cadangan).
                Mode pertandingan: {selectedGame.mode}.
              </p>
            ) : null}
          </div>

          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">Format turnamen *</h3>
              <p className="text-sm text-muted-foreground">
                Format menentukan cara bagan pertandingan disusun otomatis.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {FORMATS.map((f) => {
                const Icon = FORMAT_ICON[f];
                const meta = ESPORT_FORMAT_META[f];
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={cn(
                      "rounded-2xl border p-3 text-left transition-colors",
                      format === f ? "border-orange-300 bg-orange-50" : "border-border bg-background hover:bg-secondary/60",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Icon className="size-4 text-orange-600" aria-hidden />
                      {meta.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{meta.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">Platform pertandingan *</h3>
              <p className="text-sm text-muted-foreground">
                Tampil sebagai label di halaman turnamen agar tim tahu perangkat yang dipakai.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((key) => {
                const Icon = PLATFORM_ICON[key] ?? Monitor;
                const meta = ESPORT_PLATFORM_META[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPlatform(key)}
                    className={cn(
                      "rounded-2xl border px-3 py-2 text-left transition-colors",
                      platform === key ? "border-sky-300 bg-sky-50" : "border-border bg-background hover:bg-secondary/60",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Icon className="size-4 text-sky-600" aria-hidden />
                      {meta.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{meta.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h3 className="font-display text-lg font-semibold">Info dasar turnamen</h3>
          <div className="space-y-2">
            <Label htmlFor="wz-title">Judul turnamen *</Label>
            <Input
              id="wz-title"
              value={basic.title}
              maxLength={120}
              placeholder="cth. Piala Srikandi Mobile Legends"
              onChange={(event) => setBasic((current) => ({ ...current, title: event.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Minimal 4 karakter. {basic.title.trim().length}/120
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wz-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="wz-desc"
              rows={4}
              maxLength={2000}
              value={basic.description}
              placeholder="Jelaskan tema turnamen, siapa yang boleh ikut, dan hal penting lainnya."
              onChange={(event) => setBasic((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Kategori turnamen *</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBasic((current) => ({ ...current, category: key }))}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-left transition-colors",
                    basic.category === key
                      ? "border-violet-300 bg-violet-50"
                      : "border-border bg-background hover:bg-secondary/60",
                  )}
                >
                  <span className="block text-sm font-semibold text-foreground">{ESPORT_CATEGORY_META[key].label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{ESPORT_CATEGORY_META[key].hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wz-tags">Tag pencarian (opsional)</Label>
            <Input
              id="wz-tags"
              value={basic.tags}
              maxLength={200}
              placeholder="mlbb, komunitas, gratis"
              onChange={(event) => setBasic((current) => ({ ...current, tags: event.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Pisahkan dengan koma.</p>
          </div>
          <BannerUpload
            value={basic.bannerData}
            onChange={(value) => setBasic((current) => ({ ...current, bannerData: value }))}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div>
            <h3 className="font-display text-lg font-semibold">Jadwal turnamen</h3>
            <p className="text-sm text-muted-foreground">
              Semua waktu opsional, tetapi urutannya divalidasi: pendaftaran ditutup sebelum technical meeting, kualifikasi,
              babak utama, lalu grand final.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wz-reg-open">Pendaftaran dibuka</Label>
              <Input
                id="wz-reg-open"
                type="datetime-local"
                value={schedule.registrationOpenAt}
                onChange={(event) => setSchedule((current) => ({ ...current, registrationOpenAt: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-reg-close">Pendaftaran ditutup</Label>
              <Input
                id="wz-reg-close"
                type="datetime-local"
                value={schedule.registrationCloseAt}
                onChange={(event) => setSchedule((current) => ({ ...current, registrationCloseAt: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-tm">Technical meeting</Label>
              <Input
                id="wz-tm"
                type="datetime-local"
                value={schedule.technicalMeetingAt}
                onChange={(event) => setSchedule((current) => ({ ...current, technicalMeetingAt: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-qualifier">Mulai kualifikasi</Label>
              <Input
                id="wz-qualifier"
                type="datetime-local"
                value={schedule.qualifierStartAt}
                onChange={(event) => setSchedule((current) => ({ ...current, qualifierStartAt: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-main">Mulai babak utama</Label>
              <Input
                id="wz-main"
                type="datetime-local"
                value={schedule.mainEventStartAt}
                onChange={(event) => setSchedule((current) => ({ ...current, mainEventStartAt: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-final">Grand final</Label>
              <Input
                id="wz-final"
                type="datetime-local"
                value={schedule.grandFinalAt}
                onChange={(event) => setSchedule((current) => ({ ...current, grandFinalAt: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2 sm:max-w-sm">
            <Label>Zona waktu</Label>
            <Select
              value={schedule.timezone}
              onValueChange={(value) => setSchedule((current) => ({ ...current, timezone: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ESPORT_TIMEZONES).map(([zone, label]) => (
                  <SelectItem key={zone} value={zone}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {scheduleError ? <p className="text-xs text-destructive">{scheduleError}</p> : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Slot tim & roster</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="wz-maxteams">Kuota tim *</Label>
                <Input
                  id="wz-maxteams"
                  type="number"
                  min={8}
                  max={128}
                  value={teams.maxTeams}
                  onChange={(event) => setTeams((current) => ({ ...current, maxTeams: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Antara 8 sampai 128 tim.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-roster-min">Roster min</Label>
                <Input
                  id="wz-roster-min"
                  type="number"
                  min={1}
                  max={15}
                  value={teams.rosterMin}
                  placeholder={selectedGame ? String(selectedGame.teamSizeMin) : ""}
                  onChange={(event) => setTeams((current) => ({ ...current, rosterMin: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-roster-max">Roster maks</Label>
                <Input
                  id="wz-roster-max"
                  type="number"
                  min={1}
                  max={15}
                  value={teams.rosterMax}
                  placeholder={selectedGame ? String(selectedGame.rosterMax) : ""}
                  onChange={(event) => setTeams((current) => ({ ...current, rosterMax: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-subs">Maks. cadangan</Label>
                <Input
                  id="wz-subs"
                  type="number"
                  min={0}
                  max={10}
                  value={teams.substituteMax}
                  onChange={(event) => setTeams((current) => ({ ...current, substituteMax: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-gamemode">Mode permainan</Label>
                <Input
                  id="wz-gamemode"
                  value={teams.gameMode}
                  maxLength={40}
                  placeholder={selectedGame ? selectedGame.mode : ""}
                  onChange={(event) => setTeams((current) => ({ ...current, gameMode: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Kosongkan untuk memakai mode bawaan game.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-minplayers">Pemain inti minimal</Label>
                <Input
                  id="wz-minplayers"
                  type="number"
                  min={1}
                  max={15}
                  value={teams.minPlayers}
                  placeholder={selectedGame ? String(selectedGame.minPlayers) : ""}
                  onChange={(event) => setTeams((current) => ({ ...current, minPlayers: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Minimal pemain inti yang harus siap saat bertanding.</p>
              </div>
            </div>
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="wz-fee">Biaya masuk (Rp)</Label>
              <Input
                id="wz-fee"
                type="number"
                min={0}
                value={teams.entryFee}
                onChange={(event) => setTeams((current) => ({ ...current, entryFee: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Isi 0 untuk turnamen gratis.</p>
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">Syarat peserta</h3>
              <p className="text-sm text-muted-foreground">
                Kosongkan atau isi 0 bila tidak ada syarat. Syarat tampil di halaman turnamen.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="wz-min-level">Level minimum komunitas</Label>
                <Input
                  id="wz-min-level"
                  type="number"
                  min={0}
                  max={50}
                  value={teams.minLevel}
                  placeholder="0"
                  onChange={(event) => setTeams((current) => ({ ...current, minLevel: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-min-age">Usia minimum (tahun)</Label>
                <Input
                  id="wz-min-age"
                  type="number"
                  min={0}
                  max={99}
                  value={teams.minAge}
                  placeholder="0"
                  onChange={(event) => setTeams((current) => ({ ...current, minAge: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-region">Batasan region</Label>
                <Input
                  id="wz-region"
                  value={teams.regionLock}
                  maxLength={60}
                  placeholder="cth. Jabodetabek"
                  onChange={(event) => setTeams((current) => ({ ...current, regionLock: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Wajib akun terverifikasi</p>
                <p className="text-xs text-muted-foreground">
                  Hanya anggota yang sudah terverifikasi admin yang boleh mendaftar.
                </p>
              </div>
              <Switch
                checked={teams.requireVerified}
                onCheckedChange={(checked) => setTeams((current) => ({ ...current, requireVerified: checked }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-req-extra">Catatan syarat tambahan (opsional)</Label>
              <Textarea
                id="wz-req-extra"
                rows={2}
                maxLength={600}
                value={teams.extra}
                placeholder="cth. Wajib memiliki akun game level 30+ dan tidak sedang menjalani sanksi turnamen."
                onChange={(event) => setTeams((current) => ({ ...current, extra: event.target.value }))}
              />
            </div>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-6">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">Distribusi hadiah</h3>
              <p className="text-sm text-muted-foreground">
                Kosongkan nominal untuk melewatkan juara tersebut. Total hadiah dihitung otomatis.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-secondary/30 p-3">
              <div className="space-y-2">
                <Label htmlFor="wz-prize-bulk">Total hadiah (Rp)</Label>
                <Input
                  id="wz-prize-bulk"
                  type="number"
                  min={0}
                  className="w-44"
                  value={prizePool.bulkTotal}
                  placeholder="cth. 5000000"
                  onChange={(event) => setPrizePool((current) => ({ ...current, bulkTotal: event.target.value }))}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={applyPrizeDistribution}>
                <Sparkles className="size-4" aria-hidden />
                Bagi 50 / 25 / 15 / 10
              </Button>
              <p className="text-xs text-muted-foreground">Distribusi standar untuk empat besar.</p>
            </div>
            <div className="space-y-2">
              {prizePool.rows.map((row, index) => (
                <div key={row.placement} className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-32 items-center justify-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                    Juara {row.placement} · {ESPORT_PRIZE_DISTRIBUTION[index] ?? 0}%
                  </span>
                  <Input
                    type="number"
                    min={0}
                    className="w-44"
                    placeholder="Nominal Rp"
                    value={row.amount}
                    onChange={(event) =>
                      setPrizePool((current) => ({
                        ...current,
                        rows: current.rows.map((item, i) => (i === index ? { ...item, amount: event.target.value } : item)),
                      }))
                    }
                  />
                  <Input
                    className="min-w-[140px] flex-1"
                    maxLength={60}
                    value={row.label}
                    onChange={(event) =>
                      setPrizePool((current) => ({
                        ...current,
                        rows: current.rows.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border px-4 py-3 text-sm">
              <span className="text-muted-foreground">Total hadiah</span>
              <span className="font-semibold">{formatRupiah(prizeTotal)}</span>
            </div>
            {needsApproval ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Hadiah di atas {formatRupiah(ESPORT_PRIZE_APPROVAL_THRESHOLD)} — turnamen perlu persetujuan admin sebelum
                  pendaftaran dibuka.
                </span>
              </div>
            ) : null}
          </div>

          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">Sumber dana & anggaran</h3>
              <p className="text-sm text-muted-foreground">
                Rincian ini membantu admin menilai kelayakan turnamen dan membuka peluang sponsorship.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wz-funding">Sumber dana</Label>
                <Input
                  id="wz-funding"
                  value={prizePool.fundingSource}
                  maxLength={200}
                  placeholder="cth. Kas komunitas + sponsor"
                  onChange={(event) => setPrizePool((current) => ({ ...current, fundingSource: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-ops-budget">Anggaran operasional (Rp)</Label>
                <Input
                  id="wz-ops-budget"
                  type="number"
                  min={0}
                  value={prizePool.operationalBudget}
                  onChange={(event) => setPrizePool((current) => ({ ...current, operationalBudget: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Slot sponsorship</p>
                  <p className="text-xs text-muted-foreground">
                    {sponsorTotal > 0 ? `Total komitmen sponsor: ${formatRupiah(sponsorTotal)}.` : "Belum ada sponsor."}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPrizePool((current) => ({
                      ...current,
                      sponsors: [...current.sponsors, { key: uid(), name: "", amount: "" }],
                    }))
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  Tambah sponsor
                </Button>
              </div>
              {prizePool.sponsors.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">
                  Tambahkan slot sponsor bila ada pihak yang mendukung hadiah atau produksi.
                </p>
              ) : (
                <div className="space-y-2">
                  {prizePool.sponsors.map((row) => (
                    <div key={row.key} className="flex flex-wrap items-center gap-2 rounded-2xl bg-secondary/30 p-3">
                      <Input
                        className="min-w-[160px] flex-1"
                        maxLength={80}
                        value={row.name}
                        placeholder="Nama sponsor"
                        onChange={(event) =>
                          setPrizePool((current) => ({
                            ...current,
                            sponsors: current.sponsors.map((item) =>
                              item.key === row.key ? { ...item, name: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                      <Input
                        type="number"
                        min={0}
                        className="w-40"
                        placeholder="Nominal Rp"
                        value={row.amount}
                        onChange={(event) =>
                          setPrizePool((current) => ({
                            ...current,
                            sponsors: current.sponsors.map((item) =>
                              item.key === row.key ? { ...item, amount: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPrizePool((current) => ({
                            ...current,
                            sponsors: current.sponsors.filter((item) => item.key !== row.key),
                          }))
                        }
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Hapus
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-6">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Ketentuan pertandingan</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Format pertandingan (Best of)</Label>
                <Select value={rules.bestOf} onValueChange={(value) => setRules((current) => ({ ...current, bestOf: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESPORT_BEST_OF_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Best of {n} {n === 1 ? "(1 game)" : `(hingga ${n} game)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Berlaku untuk seluruh babak; laga tertentu bisa diubah saat penyusunan jadwal.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-checkin">Jendela check-in (menit)</Label>
                <Input
                  id="wz-checkin"
                  type="number"
                  min={0}
                  max={180}
                  value={rules.checkinWindow}
                  onChange={(event) => setRules((current) => ({ ...current, checkinWindow: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Check-in tim dibuka sekian menit sebelum pertandingan.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-rules">Peraturan utama (opsional)</Label>
              <Textarea
                id="wz-rules"
                rows={5}
                maxLength={6000}
                value={rules.rules}
                placeholder={"1. Wajib check-in 30 menit sebelum bertanding…\n2. Dilarang menggunakan cheat…"}
                onChange={(event) => setRules((current) => ({ ...current, rules: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Tampil di halaman turnamen sebagai peraturan lengkap.</p>
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">Detail peraturan spesifik</h3>
              <p className="text-sm text-muted-foreground">
                Bagian ini tampil rapi per topik. Kosongkan bila belum diatur — bisa dilengkapi dari halaman kelola.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wz-banpick">Ban & pick</Label>
                <Textarea
                  id="wz-banpick"
                  rows={2}
                  maxLength={600}
                  value={rules.banPick}
                  placeholder="cth. Ban 3 hero per tim, pick bergantian, draft 2-2-1."
                  onChange={(event) => setRules((current) => ({ ...current, banPick: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-gamerules">Aturan spesifik game</Label>
                <Textarea
                  id="wz-gamerules"
                  rows={2}
                  maxLength={2000}
                  value={rules.gameRules}
                  placeholder="cth. Map pool turnamen, mode kustom, batas waktu per game."
                  onChange={(event) => setRules((current) => ({ ...current, gameRules: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-late">Penalti keterlambatan</Label>
                <Textarea
                  id="wz-late"
                  rows={2}
                  maxLength={600}
                  value={rules.latePenalty}
                  placeholder="cth. Terlambat 10 menit = kalah WO untuk game pertama."
                  onChange={(event) => setRules((current) => ({ ...current, latePenalty: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-disconnect">Kebijakan disconnect / jeda</Label>
                <Textarea
                  id="wz-disconnect"
                  rows={2}
                  maxLength={800}
                  value={rules.disconnectPolicy}
                  placeholder="cth. Pause maksimal 10 menit; rematch bila disconnect sebelum menit ke-3."
                  onChange={(event) => setRules((current) => ({ ...current, disconnectPolicy: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-substitute">Kebijakan pemain pengganti</Label>
                <Textarea
                  id="wz-substitute"
                  rows={2}
                  maxLength={600}
                  value={rules.substitutePolicy}
                  placeholder="cth. Pengganti hanya dari daftar cadangan, maksimal 1 pergantian per game."
                  onChange={(event) => setRules((current) => ({ ...current, substitutePolicy: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-anticheat">Anti-cheat</Label>
                <Textarea
                  id="wz-anticheat"
                  rows={2}
                  maxLength={800}
                  value={rules.anticheatPolicy}
                  placeholder="cth. Screenshot perangkat, larangan emulator/script, sanksi diskualifikasi."
                  onChange={(event) => setRules((current) => ({ ...current, anticheatPolicy: event.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="wz-dispute">Kebijakan sengketa</Label>
                <Textarea
                  id="wz-dispute"
                  rows={2}
                  maxLength={800}
                  value={rules.disputePolicy}
                  placeholder="cth. Sengketa diajukan maksimal 30 menit setelah laga lewat fitur Sengketa dengan bukti video."
                  onChange={(event) => setRules((current) => ({ ...current, disputePolicy: event.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 6 ? (
        <div className="space-y-6">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">Siaran langsung</h3>
              <p className="text-sm text-muted-foreground">
                Tautan utama tampil di halaman turnamen; pertandingan tertentu bisa punya tautan sendiri dari halaman kelola.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wz-stream-url">Tautan siaran utama (opsional)</Label>
              <Input
                id="wz-stream-url"
                value={streaming.streamUrl}
                maxLength={300}
                placeholder="https://youtube.com/…"
                onChange={(event) => setStreaming((current) => ({ ...current, streamUrl: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Platform siaran</Label>
              <div className="flex flex-wrap gap-2">
                {ESPORT_STREAM_PLATFORM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => toggleStreamPlatform(preset)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                      streaming.platforms.includes(preset)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-accent",
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wz-concurrent">Siaran paralel maksimal</Label>
                <Input
                  id="wz-concurrent"
                  type="number"
                  min={1}
                  max={20}
                  value={streaming.concurrentStreams}
                  onChange={(event) => setStreaming((current) => ({ ...current, concurrentStreams: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Jumlah laga yang bisa disiarkan bersamaan.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wz-casters">Slot caster</Label>
                <Input
                  id="wz-casters"
                  type="number"
                  min={0}
                  max={20}
                  value={streaming.casterSlots}
                  onChange={(event) => setStreaming((current) => ({ ...current, casterSlots: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Kuota caster yang dapat ditugaskan ke laga.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Produksi</h3>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Overlay siaran</p>
                  <p className="text-xs text-muted-foreground">Pakai paket overlay grafis turnamen saat siaran.</p>
                </div>
                <Switch
                  checked={streaming.overlayEnabled}
                  onCheckedChange={(checked) => setStreaming((current) => ({ ...current, overlayEnabled: checked }))}
                />
              </div>
              {streaming.overlayEnabled ? (
                <div className="space-y-2">
                  <Label htmlFor="wz-overlay-notes">Catatan overlay</Label>
                  <Input
                    id="wz-overlay-notes"
                    value={streaming.overlayNotes}
                    maxLength={400}
                    placeholder="cth. Skor, jadwal, dan bracket tampil di sisi kanan layar."
                    onChange={(event) => setStreaming((current) => ({ ...current, overlayNotes: event.target.value }))}
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Observer khusus</p>
                  <p className="text-xs text-muted-foreground">Sediakan slot observer agar caster mendapat sudut pandang penuh.</p>
                </div>
                <Switch
                  checked={streaming.observerEnabled}
                  onCheckedChange={(checked) => setStreaming((current) => ({ ...current, observerEnabled: checked }))}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Rekaman pertandingan</p>
                  <p className="text-xs text-muted-foreground">Simpan rekaman tiap laga untuk keperluan sengketa dan highlight.</p>
                </div>
                <Switch
                  checked={streaming.recordingEnabled}
                  onCheckedChange={(checked) => setStreaming((current) => ({ ...current, recordingEnabled: checked }))}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 7 ? (
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Ringkasan turnamen</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryRow label="Game" value={selectedGame ? `${selectedGame.icon ?? "🎮"} ${selectedGame.name}` : "—"} />
              <SummaryRow label="Format" value={ESPORT_FORMAT_META[format]?.label ?? format} />
              <SummaryRow label="Platform" value={ESPORT_PLATFORM_META[platform]?.label ?? platform} />
              <SummaryRow label="Kategori" value={ESPORT_CATEGORY_META[basic.category]?.label ?? basic.category} />
              <SummaryRow label="Judul" value={basic.title || "Belum diisi"} />
              <SummaryRow label="Tag" value={basic.tags.trim() || "—"} />
              <SummaryRow
                label="Pendaftaran dibuka"
                value={schedule.registrationOpenAt ? toLocalInputValue(schedule.registrationOpenAt) : "Belum diisi"}
              />
              <SummaryRow
                label="Pendaftaran ditutup"
                value={schedule.registrationCloseAt ? toLocalInputValue(schedule.registrationCloseAt) : "Belum diisi"}
              />
              <SummaryRow
                label="Technical meeting"
                value={schedule.technicalMeetingAt ? toLocalInputValue(schedule.technicalMeetingAt) : "—"}
              />
              <SummaryRow
                label="Kualifikasi"
                value={schedule.qualifierStartAt ? toLocalInputValue(schedule.qualifierStartAt) : "—"}
              />
              <SummaryRow
                label="Babak utama"
                value={schedule.mainEventStartAt ? toLocalInputValue(schedule.mainEventStartAt) : "—"}
              />
              <SummaryRow
                label="Grand final"
                value={schedule.grandFinalAt ? toLocalInputValue(schedule.grandFinalAt) : "—"}
              />
              <SummaryRow label="Zona waktu" value={schedule.timezone} />
              <SummaryRow label="Kuota tim" value={`${teams.maxTeams || "8"} tim`} />
              <SummaryRow label="Roster" value={rosterSummary} />
              <SummaryRow label="Biaya masuk" value={formatRupiah(Math.round(Number(teams.entryFee) || 0))} />
              <SummaryRow label="Syarat peserta" value={requirementSummary} />
              <SummaryRow
                label="Total hadiah"
                value={
                  <span className={needsApproval ? "font-semibold text-amber-700" : "font-semibold"}>
                    {formatRupiah(prizeTotal)}
                  </span>
                }
              />
              <SummaryRow label="Sumber dana" value={prizePool.fundingSource.trim() || "—"} />
              <SummaryRow label="Anggaran operasional" value={formatRupiah(Math.round(Number(prizePool.operationalBudget) || 0))} />
              <SummaryRow
                label="Sponsorship"
                value={
                  prizePool.sponsors.filter((row) => row.name.trim()).length
                    ? `${prizePool.sponsors.filter((row) => row.name.trim()).length} slot · ${formatRupiah(sponsorTotal)}`
                    : "—"
                }
              />
              <SummaryRow label="Format pertandingan" value={`Best of ${rules.bestOf}`} />
              <SummaryRow label="Jendela check-in" value={`${Number(rules.checkinWindow) || 0} menit`} />
              <SummaryRow
                label="Platform siaran"
                value={streaming.platforms.length ? streaming.platforms.join(", ") : "—"}
              />
            </div>
            {basic.bannerData ? (
              <img
                src={basic.bannerData}
                alt="Banner turnamen"
                className="h-40 w-full rounded-2xl border border-border object-cover"
              />
            ) : null}
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Kelengkapan</h3>
            <ul className="space-y-2 text-sm">
              <ReadinessRow
                ok={stepError(0) === null}
                label={stepError(0) === null ? "Game & format siap" : "Game belum dipilih"}
                hint="Pilih game di langkah Game & Format."
              />
              <ReadinessRow
                ok={stepError(1) === null}
                label={stepError(1) === null ? "Info dasar lengkap" : "Info dasar belum lengkap"}
                hint="Isi judul minimal 4 karakter di langkah Info Dasar."
              />
              <ReadinessRow
                ok={stepError(2) === null}
                label={stepError(2) === null ? "Jadwal valid" : "Urutan jadwal belum valid"}
                hint="Periksa urutan tanggal di langkah Jadwal."
              />
              <ReadinessRow
                ok={stepError(3) === null}
                label={stepError(3) === null ? "Tim & peserta valid" : "Pengaturan tim & peserta belum valid"}
                hint="Periksa kuota tim, roster, dan syarat peserta."
              />
              <ReadinessRow
                ok={stepError(4) === null}
                label={stepError(4) === null ? "Hadiah & sponsor valid" : "Hadiah & sponsor belum valid"}
                hint="Periksa nominal hadiah dan nama sponsor."
              />
              <ReadinessRow
                ok={stepError(6) === null}
                label={stepError(6) === null ? "Konfigurasi streaming valid" : "Konfigurasi streaming belum valid"}
                hint="Periksa jumlah siaran paralel dan slot caster."
              />
            </ul>
          </div>

          {needsApproval ? (
            <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:p-6">
              <p className="flex items-center gap-2 font-semibold">
                <CircleAlert className="size-4" aria-hidden />
                Turnamen ini akan ditinjau admin terlebih dahulu
              </p>
              <p>
                Total hadiah {formatRupiah(prizeTotal)} melebihi ambang {formatRupiah(ESPORT_PRIZE_APPROVAL_THRESHOLD)}.
                Setelah dibuat, status menjadi menunggu persetujuan admin sebelum pendaftaran dapat dibuka.
              </p>
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Setelah turnamen dibuat</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setInitialStatus("registration")}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors",
                  initialStatus === "registration"
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-border bg-background hover:bg-secondary/60",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Rocket className="size-4 text-emerald-600" aria-hidden />
                  Buka pendaftaran sekarang
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Turnamen tampil publik dan tim bisa langsung mendaftar. Hadiah besar otomatis menunggu persetujuan admin.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setInitialStatus("draft")}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors",
                  initialStatus === "draft"
                    ? "border-sky-300 bg-sky-50"
                    : "border-border bg-background hover:bg-secondary/60",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Save className="size-4 text-sky-600" aria-hidden />
                  Simpan sebagai draf
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Sempurnakan dulu dari halaman kelola; pendaftaran dibuka kapan saja nanti.
                </span>
              </button>
            </div>

            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Sparkles className="size-3.5" aria-hidden />
                Langkah berikutnya setelah turnamen dibuat
              </p>
              <p className="mt-1">
                Anda diarahkan ke konsol penyelenggara: kelola peserta, undi bagan (mode acak / manual / urutan pendaftaran),
                susun jadwal per babak, tugaskan caster, dan pantau klasemen serta sengketa.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={publishing || basic.title.trim().length < 4}
                onClick={() => void saveDraft({ silent: false }).then((id) => id && toast.success("Draf tersimpan."))}
              >
                {saveState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                Simpan draf
              </Button>
              <Button type="button" disabled={publishing} onClick={() => void publish()}>
                {publishing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
                {initialStatus === "registration" ? "Buat & Buka Pendaftaran" : "Buat sebagai Draf"}
              </Button>
            </div>
            {tournamentId ? (
              <p className="text-xs text-muted-foreground">
                Draf tersimpan dengan ID {tournamentId.slice(0, 8)}… — bisa dilanjutkan kapan saja dari halaman kelola.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
          <ArrowLeft className="size-4" aria-hidden />
          Kembali
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext}>
            Lanjut: {STEPS[step + 1].label}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" onClick={() => void publish()} disabled={publishing}>
            {publishing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
            {initialStatus === "registration" ? "Buat & Buka Pendaftaran" : "Buat sebagai Draf"}
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ReadinessRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      )}
      <span>
        <span className={cn("font-medium", ok ? "text-foreground" : "text-destructive")}>{label}</span>
        {!ok ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </li>
  );
}

function BannerUpload({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const dataUrl = await prepareBannerImage(file);
      onChange(dataUrl);
      toast.success("Banner siap dipakai.");
    } catch (error) {
      toast.error(docErrorText(error));
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>Banner turnamen (opsional)</Label>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img src={value} alt="Pratinjau banner" className="h-24 w-full max-w-xs rounded-2xl border border-border object-cover" />
        ) : null}
        <label
          className={cn(
            "flex size-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/30 transition-colors hover:border-primary/50",
            processing && "pointer-events-none opacity-60",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSelect}
            disabled={processing}
          />
          <span className="flex flex-col items-center gap-1 text-muted-foreground">
            {processing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
            <span className="text-[10px]">Upload</span>
          </span>
        </label>
        {value ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
            <Trash2 className="size-4" aria-hidden />
            Hapus banner
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">JPG/PNG/WebP, disarankan lanskap 16:9. Gambar dikompres otomatis.</p>
    </div>
  );
}
