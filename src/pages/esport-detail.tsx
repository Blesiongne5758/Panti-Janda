import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  Check,
  Clock,
  CreditCard,
  Crown,
  ExternalLink,
  Gavel,
  Loader2,
  Medal,
  Mic,
  Pause,
  Play,
  Plus,
  Radio,
  Shield,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { SEO } from "@/components/seo";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import {
  ESPORT_BEST_OF_OPTIONS,
  ESPORT_CASTER_ROLE_META,
  ESPORT_DISPUTE_STATUS_META,
  ESPORT_FORMAT_META,
  ESPORT_MATCH_STATUS_META,
  ESPORT_MEMBER_ROLE_META,
  ESPORT_PAYMENT_STATUS_META,
  ESPORT_PRIZE_STATUS_META,
  ESPORT_REG_STATUS_META,
  ESPORT_STAGE_LABEL,
  ESPORT_STATUS_META,
  ESPORT_STREAM_PLATFORM_META,
  esportRoundLabel,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format";
import type {
  EsportLeaderboard,
  EsportMatch,
  EsportMyRegistration,
  EsportRegistration,
  EsportTournamentDetail,
} from "@/lib/types";
import { EsportBracket } from "@/components/esport-bracket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorNote, LoadingGrid, MemberAvatar, PageBanner } from "@/components/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const shortDateTime = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const shortDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

function fmtDT(value: string | null): string {
  return value ? shortDateTime.format(new Date(value)) : "";
}

const toneOf = (map: Record<string, { label: string; tone: string }>, key: string) =>
  map[key] ?? { label: key, tone: "bg-slate-100 text-slate-700" };

function standingsGridClass(format: string): string {
  if (format === "battle_royale") return "sm:grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem_3rem_3.5rem_4rem]";
  if (format === "round_robin" || format === "league") return "sm:grid-cols-[2rem_1fr_3rem_3rem_3rem_5rem_4rem_4rem]";
  return "sm:grid-cols-[2rem_1fr_3rem_3rem_3rem_5rem_4rem]";
}

export default function EsportDetailPage({ id }: { id: string }) {
  const { account } = useAuth();
  const [data, setData] = useState<EsportTournamentDetail | null>(null);
  const [board, setBoard] = useState<EsportLeaderboard | null>(null);
  const [boardForId, setBoardForId] = useState<string | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("info");
  const [now, setNow] = useState(() => Date.now());
  const [checkinBusy, setCheckinBusy] = useState<string | null>(null);
  const [disputeMatch, setDisputeMatch] = useState<EsportMatch | null>(null);
  const [payingRegId, setPayingRegId] = useState<string | null>(null);

  const handlePayRegistration = async (regId: string) => {
    setPayingRegId(regId);
    try {
      const res = await api<{ token?: string; redirectUrl?: string; orderId: string }>(
        "esport.registrations.gatewayPay",
        { registrationId: regId },
      );
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        toast.success("Instruksi pembayaran berhasil dibuat.");
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setPayingRegId(null);
    }
  };

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await api<EsportTournamentDetail>("esport.tournaments.get", { id });
        setData(res);
        setError(null);
      } catch (err) {
        if (!silent) setError(errorText(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const status = data?.tournament.status ?? null;
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      if (status && status !== "completed" && status !== "cancelled" && status !== "draft") void load(true);
    }, 30_000);
    return () => clearInterval(timer);
  }, [status, load]);

  useEffect(() => {
    if (tab !== "score" || boardForId === id) return;
    let cancelled = false;
    setBoardLoading(true);
    api<EsportLeaderboard>("esport.leaderboard", { id })
      .then((res) => {
        if (cancelled) return;
        setBoard(res);
        setBoardForId(id);
      })
      .catch(() => {
        if (cancelled) return;
        setBoard({ rows: [], championRegId: null, topPlayers: [] });
        setBoardForId(id);
      })
      .finally(() => {
        if (!cancelled) setBoardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, boardForId, id]);

  const myRegIds = useMemo(() => new Set((data?.myRegistrations ?? []).map((r) => r.registrationId)), [data]);
  const myCaptRegIds = useMemo(
    () => new Set((data?.myRegistrations ?? []).filter((r) => r.isCaptain).map((r) => r.registrationId)),
    [data],
  );
  const myTeamNames = useMemo(() => new Set((data?.myRegistrations ?? []).map((r) => r.teamName)), [data]);
  const regById = useMemo(
    () => new Map((data?.registrations ?? []).map((r) => [r.id, r])),
    [data],
  );
  const myOpenDisputes = useMemo(() => {
    const set = new Set<string>();
    for (const d of data?.disputes ?? []) {
      if (d.status === "open" && myTeamNames.has(d.teamName)) set.add(d.matchId);
    }
    return set;
  }, [data, myTeamNames]);

  const checkin = useCallback(
    async (match: EsportMatch) => {
      setCheckinBusy(match.id);
      try {
        const res = await api<{ side: string; bothCheckedIn: boolean }>("esport.matches.checkin", { matchId: match.id });
        toast.success(
          res.bothCheckedIn
            ? "Check-in berhasil. Kedua tim sudah siap bertanding!"
            : "Check-in berhasil. Menunggu tim lawan melakukan check-in.",
        );
        void load(true);
      } catch (err) {
        toast.error(errorText(err));
      } finally {
        setCheckinBusy(null);
      }
    },
    [load],
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <LoadingGrid count={4} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-12">
        <ErrorNote message={error ?? "Turnamen tidak ditemukan."} onRetry={() => void load()} />
        <Button asChild variant="outline">
          <Link to="/kompetisi-esport">
            <ArrowLeft className="size-4" aria-hidden />
            Kembali ke Kompetisi E-Sport
          </Link>
        </Button>
      </div>
    );
  }

  const t = data.tournament;
  const statusMeta = toneOf(ESPORT_STATUS_META, t.status);
  const formatMeta = ESPORT_FORMAT_META[t.format];
  const isBrFormat = t.format === "battle_royale";
  const isPointsFormat = t.format === "round_robin" || t.format === "league";
  const liveMatches = data.matches.filter((m) => ["live", "paused", "disputed"].includes(m.status));
  const upcoming = data.matches
    .filter((m) => ["scheduled", "checkin_open"].includes(m.status))
    .sort((a, b) => (a.scheduledAt ? Date.parse(a.scheduledAt) : Infinity) - (b.scheduledAt ? Date.parse(b.scheduledAt) : Infinity));
  const finished = data.matches
    .filter((m) => ["finished", "walkover", "cancelled"].includes(m.status))
    .sort((a, b) => Date.parse(b.finishedAt ?? "") - Date.parse(a.finishedAt ?? ""));
  const participants = [...data.registrations].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
  const showRegisterHint = Boolean(account) && t.status === "registration" && data.myRegistrations.length === 0;
  const maxRoundByStage = new Map<string, number>();
  for (const m of data.matches) maxRoundByStage.set(m.stage, Math.max(maxRoundByStage.get(m.stage) ?? 0, m.round));
  const matchCtx: MatchCtx = {
    myRegIds,
    myCaptRegIds,
    myOpenDisputes,
    checkinWindow: t.checkinWindowMinutes,
    now,
    checkinBusy,
    regById,
    maxRoundByStage,
    onCheckin: (m) => void checkin(m),
    onDispute: setDisputeMatch,
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <SEO
        title={`${t.title} — Turnamen E-Sport Panti Janda`}
        description={t.description || `Ikuti kompetisi ${t.title} di platform komunitas Panti Janda.`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/kompetisi-esport">
            <ArrowLeft className="size-4" aria-hidden />
            Kembali ke Kompetisi E-Sport
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {t.streamUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={t.streamUrl} target="_blank" rel="noreferrer">
                <Play className="size-4" aria-hidden />
                Tonton Siaran
              </a>
            </Button>
          ) : null}
          {t.canManage ? (
            <Button asChild size="sm">
              <Link to={`/kompetisi-esport/kelola/${t.id}`}>
                <Shield className="size-4" aria-hidden />
                Kelola Turnamen
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <PageBanner>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.18em] text-accent-foreground uppercase">
              <span aria-hidden>{data.game?.icon ?? "🎮"}</span>
              {data.game?.name ?? "Turnamen"}
              {data.game?.mode ? <span className="font-normal normal-case opacity-80">· {data.game.mode}</span> : null}
            </p>
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">{t.title}</h1>
            {t.description ? <p className="text-sm leading-relaxed text-muted-foreground">{t.description}</p> : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
              <Badge variant="outline">{formatMeta?.label ?? t.format}</Badge>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3.5" aria-hidden />
                {data.registrations.length}/{t.maxTeams} tim
              </span>
              {t.prizeTotal > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Trophy className="size-3.5" aria-hidden />
                  Hadiah {formatRupiah(t.prizeTotal)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Swords className="size-3.5" aria-hidden />
                {t.format === "battle_royale" ? `${t.minPlayers}+ pemain/lobi` : `BO${t.bestOf}`}
              </span>
              {t.format !== "battle_royale" && t.gameMode ? (
                <span className="text-xs text-muted-foreground">Mode {t.gameMode}</span>
              ) : null}
              {t.format !== "battle_royale" ? (
                <span className="text-xs text-muted-foreground">
                  Roster {t.rosterMin}–{t.rosterMax} pemain
                </span>
              ) : null}
              {liveMatches.length ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
                  </span>
                  {liveMatches.length} pertandingan live
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Diselenggarakan oleh {t.creatorName}
              {t.registrationCloseAt ? ` · Pendaftaran tutup ${formatDate(t.registrationCloseAt)}` : ""}
              {t.startAt ? ` · Mulai ${formatDateTime(t.startAt)}` : ""}
            </p>
          </div>
          <div className="w-full shrink-0 space-y-2 sm:w-56">
            <div className="neu-flat rounded-2xl px-4 py-3 text-sm">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Biaya masuk</p>
              <p className="font-display text-lg font-semibold text-foreground">
                {t.entryFee > 0 ? formatRupiah(t.entryFee) : "Gratis"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">per tim</p>
            </div>
          </div>
        </div>
      </PageBanner>

      {data.myRegistrations.length ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tim Anda</span>
              {data.myRegistrations.map((r) => (
                <RegBadge key={r.registrationId} reg={r} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Kapten dapat check-in dan mengajukan sengketa dari tab Jadwal; ubah roster lewat halaman{" "}
              <Link to="/kompetisi-esport/tim" className="font-medium text-accent-foreground underline-offset-2 hover:underline">
                Tim Saya
              </Link>
              .
            </p>
            {data.myRegistrations.some((r) => r.status === "waitlist") ? (
              <p className="w-full text-xs text-violet-700">
                Ada tim Anda di daftar tunggu — slot otomatis terisi bila ada tim lain yang mundur sebelum check-in.
              </p>
            ) : null}
            {t.entryFee > 0 && data.myRegistrations.some((r) => r.paymentStatus === "unpaid") ? (
              <div className="w-full space-y-2 pt-1">
                {data.myRegistrations
                  .filter((r) => r.paymentStatus === "unpaid")
                  .map((r) => (
                    <div
                      key={r.registrationId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5"
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                          Biaya Pendaftaran Belum Dibayar: <span className="font-bold">{r.teamName}</span>
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Tagihan: <span className="font-bold">{formatRupiah(t.entryFee)}</span>. Bayar otomatis melalui Payment Gateway (QRIS, VA, E-Wallet).
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={payingRegId === r.registrationId}
                        onClick={() => void handlePayRegistration(r.registrationId)}
                        className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                      >
                        <CreditCard className="mr-1.5 size-4" />
                        {payingRegId === r.registrationId ? "Membuka Gateway..." : "Bayar Sekarang (Payment Gateway)"}
                      </Button>
                    </div>
                  ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : showRegisterHint ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-muted-foreground">
              Pendaftaran sedang dibuka. Siapkan tim Anda dan daftarkan sebelum kuota penuh atau tenggat tiba.
            </p>
            <Button asChild size="sm">
              <Link to="/kompetisi-esport/tim">
                <Trophy className="size-4" aria-hidden />
                Daftarkan Tim
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto! flex-wrap justify-start gap-1">
          <TabsTrigger value="info">Informasi</TabsTrigger>
          <TabsTrigger value="teams">Peserta ({data.registrations.length})</TabsTrigger>
          <TabsTrigger value="bracket">{t.format === "battle_royale" ? "Lobi" : "Bagan"}</TabsTrigger>
          <TabsTrigger value="schedule">
            Jadwal
            {liveMatches.length ? (
              <span className="ml-1 inline-flex size-2 rounded-full bg-rose-500" aria-hidden />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="score">Papan Skor</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              {t.description ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-base">Tentang Turnamen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{t.description}</p>
                  </CardContent>
                </Card>
              ) : null}
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-base">Peraturan & Ketentuan</CardTitle>
                  <CardDescription>Wajib dipatuhi seluruh peserta turnamen.</CardDescription>
                </CardHeader>
                <CardContent>
                  {t.rules ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{t.rules}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Penyelenggara belum menambahkan peraturan khusus. Format pertandingan:{" "}
                      {formatMeta?.label ?? t.format} ({formatMeta?.hint ?? ""}).
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-base">Deteksi Teknis</CardTitle>
                  <CardDescription>Ketentuan teknis yang berlaku untuk seluruh pertandingan.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <InfoRow label="Format" value={formatMeta?.label ?? t.format} />
                  <InfoRow
                    label="Format pertandingan"
                    value={
                      t.format === "battle_royale"
                        ? "Battle Royale — poin posisi akhir + kill"
                        : t.format === "league" || t.format === "round_robin"
                          ? "Klasemen — menang 3 poin"
                          : `Best of ${t.bestOf} (menang ${Math.floor(t.bestOf / 2) + 1} game)`
                    }
                  />
                  {t.gameMode ? <InfoRow label="Mode permainan" value={t.gameMode} /> : null}
                  <InfoRow
                    label={t.format === "battle_royale" ? "Pemain per tim (min)" : "Pemain inti (min)"}
                    value={`${t.minPlayers} pemain`}
                  />
                  <InfoRow label="Roster" value={`${t.rosterMin}–${t.rosterMax} pemain`} />
                  <InfoRow label="Jendela check-in" value={`${t.checkinWindowMinutes} menit sebelum jadwal`} />
                  <InfoRow label="Kuota tim" value={`${data.registrations.length} dari ${t.maxTeams} tim`} />
                  {t.timezone ? <InfoRow label="Zona waktu" value={t.timezone.replace("_", " ")} /> : null}
                </CardContent>
              </Card>
              {data.game?.mapPool?.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-base">Peta & Rotasi</CardTitle>
                    <CardDescription>Kumpulan map yang dipakai pada pertandingan turnamen ini.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {data.game.mapPool.map((map) => (
                        <span
                          key={map}
                          className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs font-medium text-foreground"
                        >
                          {map}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-base">
                    <Trophy className="size-4 text-amber-600" aria-hidden />
                    Hadiah & Distribusi
                  </CardTitle>
                  {t.prizeTotal > 0 ? (
                    <CardDescription>Total hadiah {formatRupiah(t.prizeTotal)}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {data.prizes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada distribusi hadiah yang diumumkan.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {data.prizes.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2"
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <Medal
                              className={cn(
                                "size-4",
                                p.placement === 1 ? "text-amber-500" : p.placement === 2 ? "text-slate-400" : "text-orange-400",
                              )}
                              aria-hidden
                            />
                            <span className="font-medium text-foreground">{p.label}</span>
                          </span>
                          <span className="text-sm font-semibold text-foreground">{formatRupiah(p.amount)}</span>
                        </div>
                      ))}
                      {t.prizeStatus !== "pending" ? (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Badge className={cn("border-transparent", toneOf(ESPORT_PRIZE_STATUS_META, t.prizeStatus).tone)}>
                            Hadiah: {toneOf(ESPORT_PRIZE_STATUS_META, t.prizeStatus).label}
                          </Badge>
                          {t.prizePaidAt ? (
                            <span className="text-xs text-muted-foreground">Dibagikan {formatDate(t.prizePaidAt)}</span>
                          ) : null}
                          {t.prizePayoutNote ? (
                            <span className="text-xs text-muted-foreground">{t.prizePayoutNote}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-base">
                    <Radio className="size-4 text-rose-600" aria-hidden />
                    Siaran & Caster
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.streams.length ? (
                    <div className="flex flex-col gap-2">
                      {data.streams.map((s) => (
                        <div
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm"
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <Radio
                              className={cn("size-4 shrink-0", s.isActive ? "text-rose-600" : "text-muted-foreground")}
                              aria-hidden
                            />
                            <span className="truncate font-medium text-foreground">{s.name}</span>
                            <Badge variant="outline" className="shrink-0">
                              {ESPORT_STREAM_PLATFORM_META[s.platform]?.label ?? s.platform}
                            </Badge>
                            {s.isActive ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                                <span className="relative flex size-2">
                                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
                                  <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
                                </span>
                                LIVE
                              </span>
                            ) : null}
                          </span>
                          {s.url ? (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent-foreground hover:underline"
                            >
                              Tonton
                              <ExternalLink className="size-3.5" aria-hidden />
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : t.streamUrl ? (
                    <a
                      href={t.streamUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm transition-colors hover:bg-secondary"
                    >
                      <span className="inline-flex items-center gap-2 font-medium text-foreground">
                        <Play className="size-4 text-rose-600" aria-hidden />
                        Siaran langsung utama
                      </span>
                      <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
                    </a>
                  ) : null}
                  {data.casters.length ? (
                    <div className="flex flex-col gap-2">
                      {data.casters.map((c) => (
                        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="inline-flex items-center gap-2 text-foreground">
                            <Mic className="size-4 text-muted-foreground" aria-hidden />
                            {c.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {ESPORT_CASTER_ROLE_META[c.casterRole]?.label ?? "Caster"}
                            {c.slotLabel ? ` · ${c.slotLabel}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!data.streams.length && !t.streamUrl && !data.casters.length ? (
                    <p className="text-sm text-muted-foreground">
                      Biarkan tab ini terbuka — tautan siaran akan tampil di sini saat penyelenggara mempublikasikannya.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-base">
                    <CalendarClock className="size-4 text-sky-600" aria-hidden />
                    Jadwal Penting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <InfoRow label="Pendaftaran tutup" value={t.registrationCloseAt ? formatDateTime(t.registrationCloseAt) : "Belum ditentukan"} />
                  <InfoRow label="Turnamen mulai" value={t.startAt ? formatDateTime(t.startAt) : "Belum ditentukan"} />
                  <InfoRow label="Dibuat" value={formatDate(t.createdAt)} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="pt-4">
          {participants.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" aria-hidden />}
              title="Belum ada tim terdaftar"
              description="Tim yang mendaftar akan tampil di sini beserta roster pemainnya."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {participants.map((r) => {
                const meta = toneOf(ESPORT_REG_STATUS_META, r.status);
                return (
                  <Card key={r.id}>
                    <CardHeader className="gap-2 pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          {r.teamLogo ? (
                            <img src={r.teamLogo} alt={r.teamName} className="size-11 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 font-display text-sm font-semibold text-orange-700">
                              {(r.teamTag ?? r.teamName).slice(0, 3).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <CardTitle className="flex flex-wrap items-center gap-2 font-display text-base">
                              <span className="truncate">{r.teamName}</span>
                              {r.teamTag ? <Badge variant="secondary">{r.teamTag}</Badge> : null}
                            </CardTitle>
                            <CardDescription className="flex flex-wrap items-center gap-2">
                              {r.seed ? <span>Unggulan {r.seed}</span> : <span>Tanpa unggulan</span>}
                              {r.groupLabel ? <span>· Grup {r.groupLabel}</span> : null}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className={cn("shrink-0 border-transparent", meta.tone)}>{meta.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {r.roster.map((m) => (
                          <span
                            key={m.accountId}
                            className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
                          >
                            <MemberAvatar name={m.name} photoData={m.photoData} size={20} />
                            <span className="font-medium text-foreground">{m.name}</span>
                            {m.inGameName ? <span className="text-muted-foreground">• IGN {m.inGameName}</span> : null}
                            {m.gameRank ? <span className="text-muted-foreground">• {m.gameRank}</span> : null}
                            {m.gameRole ? <span className="text-muted-foreground">• {m.gameRole}</span> : null}
                            {m.memberRole !== "member" ? (
                              <span className="text-muted-foreground">
                                • {ESPORT_MEMBER_ROLE_META[m.memberRole]?.label ?? m.memberRole}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Terdaftar {r.registeredAt ? formatDateTime(r.registeredAt) : "—"}
                        {r.checkedInAt ? ` · Check-in ${formatDateTime(r.checkedInAt)}` : ""}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bracket" className="pt-4">
          {t.format === "battle_royale" ? (
            data.matches.length === 0 ? (
              <EmptyState
                icon={<Swords className="size-5" aria-hidden />}
                title="Lobi belum dibuat"
                description="Lobi pertandingan otomatis muncul setelah penyelenggara mengundi peserta."
              />
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base">Lobi Battle Royale</CardTitle>
                  <CardDescription>
                    Format Battle Royale tidak memakai bagan eliminasi — semua tim bertanding di setiap lobi dan juara
                    ditentukan dari total poin (posisi akhir + kill).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    {data.matches
                      .filter((m) => m.stage === "lobby")
                      .map((m) => (
                        <MatchCard key={m.id} match={m} ctx={matchCtx} />
                      ))}
                  </div>
                </CardContent>
              </Card>
            )
          ) : data.matches.length === 0 ? (
            <EmptyState
              icon={<Swords className="size-5" aria-hidden />}
              title="Bagan belum dibuat"
              description="Bagan pertandingan otomatis muncul setelah penyelenggara mengundi peserta dan membuat jadwal pertandingan."
            />
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base">Bagan Pertandingan</CardTitle>
                <CardDescription>
                  Kotak bertanda “Tim Anda” adalah pertandingan tim Anda. Angka # menandai nomor unggulan tim, dan
                  garis oranye menunjukkan jalur pemenang yang sudah memastikan tempatnya di ronde berikutnya.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EsportBracket
                  matches={data.matches}
                  myRegIds={[...myRegIds]}
                  disputedMatchIds={data.matches.filter((m) => m.disputed).map((m) => m.id)}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="pt-4">
          {data.matches.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-5" aria-hidden />}
              title="Jadwal belum tersedia"
              description="Jadwal pertandingan disusun setelah bagan dibuat oleh penyelenggara."
            />
          ) : (
            <div className="flex flex-col gap-6">
              {liveMatches.length ? (
                <MatchGroup title="Sedang Berlangsung" matches={liveMatches} tone="text-rose-600" ctx={matchCtx} />
              ) : null}
              {upcoming.length ? <MatchGroup title="Akan Datang" matches={upcoming} ctx={matchCtx} /> : null}
              {finished.length ? <MatchGroup title="Selesai" matches={finished} ctx={matchCtx} /> : null}
            </div>
          )}

          {data.disputes.length ? (
            <div className="mt-6 space-y-3">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <Gavel className="size-4 text-amber-600" aria-hidden />
                Sengketa
              </h3>
              <div className="flex flex-col gap-3">
                {data.disputes.map((d) => {
                  const meta = toneOf(ESPORT_DISPUTE_STATUS_META, d.status);
                  const evidenceLinks = d.evidenceUrls.length ? d.evidenceUrls : d.evidenceUrl ? [d.evidenceUrl] : [];
                  return (
                    <Card key={d.id}>
                      <CardContent className="space-y-2 pt-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {d.teamName} — {d.matchLabel ?? "pertandingan"}
                          </p>
                          <Badge className={cn("border-transparent", meta.tone)}>{meta.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{d.reason}</p>
                        {evidenceLinks.length ? (
                          <div className="flex flex-wrap gap-2">
                            {evidenceLinks.map((u, i) => (
                              <a
                                key={u}
                                href={u}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-accent-foreground hover:underline"
                              >
                                <ExternalLink className="size-3.5" aria-hidden />
                                {evidenceLinks.length > 1 ? `Bukti ${i + 1}` : "Lihat bukti"}
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {d.resolution ? (
                          <p className="rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                            Keputusan penyelenggara: {d.resolution}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          Diajukan oleh {d.filedByName} · {formatDateTime(d.createdAt)}
                          {d.investigatedAt ? ` · Mulai diinvestigasi ${formatDateTime(d.investigatedAt)}` : ""}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="score" className="pt-4">
          {boardForId !== id || boardLoading ? (
            <LoadingGrid count={2} />
          ) : !board || board.rows.length === 0 ? (
            <EmptyState
              icon={<Trophy className="size-5" aria-hidden />}
              title="Belum ada hasil pertandingan"
              description="Klasemen dan statistik pemain akan terisi setelah pertandingan dimainkan dan skornya dilaporkan."
            />
          ) : (
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base">Klasemen Tim</CardTitle>
                  <CardDescription>
                    {isBrFormat
                      ? "Diurutkan berdasarkan total poin lobi (poin posisi akhir + 1 poin per kill)."
                      : isPointsFormat
                        ? "Diurutkan berdasarkan jumlah kemenangan; selisih skor menjadi penentu. Setiap kemenangan bernilai 3 poin."
                        : "Diurutkan berdasarkan kemenangan lalu selisih skor."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={cn(
                      "hidden text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:grid sm:gap-2 sm:px-2",
                      standingsGridClass(t.format),
                    )}
                  >
                    <span>#</span>
                    <span>Tim</span>
                    <span className="text-right">M</span>
                    <span className="text-right">W</span>
                    <span className="text-right">L</span>
                    {isBrFormat ? (
                      <>
                        <span className="text-right">Kill</span>
                        <span className="text-right">Poin</span>
                        <span className="text-right">Terbaik</span>
                      </>
                    ) : (
                      <>
                        <span className="text-right">Skor</span>
                        <span className="text-right">Menang</span>
                        {isPointsFormat ? <span className="text-right">Poin</span> : null}
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    {board.rows.map((row, index) => {
                      const champion = board.championRegId === row.regId;
                      return (
                        <div
                          key={row.regId}
                          className={cn(
                            "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border px-3 py-2 sm:grid sm:gap-2 sm:px-2",
                            standingsGridClass(t.format),
                            champion && "border-amber-300 bg-amber-50/70",
                          )}
                        >
                          <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                            {champion ? <Crown className="size-4 text-amber-500" aria-hidden /> : index + 1}
                          </span>
                          <span className="flex min-w-0 items-center gap-2">
                            {row.teamLogo ? (
                              <img src={row.teamLogo} alt="" className="size-6 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-[9px] font-bold text-slate-600">
                                {(row.teamTag ?? row.teamName).slice(0, 3).toUpperCase()}
                              </span>
                            )}
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">{row.teamName}</span>
                            {champion ? (
                              <Badge className="border-transparent bg-amber-100 text-amber-800">Juara</Badge>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground sm:text-right">
                            {row.played} <span className="sm:hidden">{isBrFormat ? "lobi" : "main"}</span>
                          </span>
                          <span className="text-xs text-muted-foreground sm:text-right">
                            {row.wins} <span className="sm:hidden">{isBrFormat ? "juara lobi" : "menang"}</span>
                          </span>
                          <span className="text-xs text-muted-foreground sm:text-right">
                            {row.losses} <span className="sm:hidden">{isBrFormat ? "lainnya" : "kalah"}</span>
                          </span>
                          {isBrFormat ? (
                            <>
                              <span className="text-xs text-muted-foreground sm:text-right">
                                {row.kills ?? 0} <span className="sm:hidden">kill</span>
                              </span>
                              <span className="text-xs font-semibold text-foreground sm:text-right">
                                {row.points ?? 0} <span className="sm:hidden">poin</span>
                              </span>
                              <span className="text-xs text-muted-foreground sm:text-right">
                                {row.bestPlacement ? `#${row.bestPlacement}` : "–"}{" "}
                                <span className="sm:hidden">terbaik</span>
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground sm:text-right">
                                {row.scoreFor}:{row.scoreAgainst} <span className="sm:hidden">skor</span>
                              </span>
                              <span className="text-xs font-semibold text-foreground sm:text-right">{row.winRate}%</span>
                              {isPointsFormat ? (
                                <span className="text-xs font-semibold text-foreground sm:text-right">
                                  {row.points ?? 0} <span className="sm:hidden">poin</span>
                                </span>
                              ) : null}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {board.topPlayers.length ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      <ShieldCheck className="size-4 text-emerald-600" aria-hidden />
                      Pemain Paling Aktif
                    </CardTitle>
                    <CardDescription>Berdasarkan jumlah pertandingan yang dimainkan.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {board.topPlayers.map((p, index) => (
                        <div
                          key={p.accountId}
                          className="flex min-w-[180px] flex-1 items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2"
                        >
                          <span className="font-display text-sm font-semibold text-muted-foreground">{index + 1}</span>
                          <MemberAvatar name={p.name} photoData={p.photoData} size={32} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.matchesPlayed} pertandingan</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {disputeMatch ? (
        <DisputeDialog
          match={disputeMatch}
          onOpenChange={(open) => !open && setDisputeMatch(null)}
          onFiled={() => void load(true)}
        />
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function RegBadge({ reg }: { reg: EsportMyRegistration }) {
  const meta = toneOf(ESPORT_REG_STATUS_META, reg.status);
  const payMeta = toneOf(ESPORT_PAYMENT_STATUS_META, reg.paymentStatus);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
      <span className="font-medium text-foreground">{reg.teamName}</span>
      {reg.isCaptain ? <span className="text-amber-700">• Kapten</span> : null}
      <Badge className={cn("border-transparent", meta.tone)}>{meta.label}</Badge>
      {reg.paymentStatus !== "paid" ? (
        <Badge className={cn("border-transparent", payMeta.tone)}>{payMeta.label}</Badge>
      ) : null}
    </span>
  );
}

interface MatchCtx {
  myRegIds: Set<string>;
  myCaptRegIds: Set<string>;
  myOpenDisputes: Set<string>;
  checkinWindow: number;
  now: number;
  checkinBusy: string | null;
  regById: Map<string, EsportRegistration>;
  maxRoundByStage: Map<string, number>;
  onCheckin: (m: EsportMatch) => void;
  onDispute: (m: EsportMatch) => void;
}

function MatchGroup({ title, matches, tone, ctx }: { title: string; matches: EsportMatch[]; tone?: string; ctx: MatchCtx }) {
  return (
    <section className="space-y-3">
      <h3 className={cn("font-display text-base font-semibold text-foreground", tone)}>
        {title} ({matches.length})
      </h3>
      <div className="flex flex-col gap-3">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}

function LobbyCard({ match, ctx }: { match: EsportMatch; ctx: MatchCtx }) {
  const { myRegIds, regById } = ctx;
  const meta = toneOf(ESPORT_MATCH_STATUS_META, match.status);
  const mine = myRegIds.size > 0;
  const results = [...match.brResults].sort((a, b) => a.placement - b.placement);
  return (
    <Card className={cn(mine && "border-orange-200")}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Lobi {match.matchIndex}</Badge>
            {match.scheduledAt ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                {fmtDT(match.scheduledAt)}
              </span>
            ) : null}
            {mine ? <Badge className="border-transparent bg-orange-100 text-orange-700">Tim Anda Bertanding</Badge> : null}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {match.casterName ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Mic className="size-3.5" aria-hidden />
                {match.casterName}
              </span>
            ) : null}
            {match.streamUrl ? (
              <a
                href={match.streamUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
              >
                <Play className="size-3.5" aria-hidden />
                Tonton
              </a>
            ) : null}
            {match.disputed ? (
              <Badge className="border-transparent bg-amber-100 text-amber-800">
                <Gavel aria-hidden />
                Sengketa terbuka
              </Badge>
            ) : null}
            <Badge className={cn("border-transparent", meta.tone)}>{meta.label}</Badge>
          </span>
        </div>

        {results.length ? (
          <>
            <div className="flex flex-col gap-1.5">
              {results.map((r) => {
                const reg = regById.get(r.registrationId);
                const first = r.placement === 1;
                return (
                  <div
                    key={r.registrationId}
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2",
                      first ? "border-amber-300 bg-amber-50/70" : "border-border bg-secondary/30",
                    )}
                  >
                    <span className="w-8 shrink-0 font-display text-sm font-semibold tabular-nums text-muted-foreground">
                      #{r.placement}
                    </span>
                    {reg?.teamLogo ? (
                      <img src={reg.teamLogo} alt="" className="size-7 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-[9px] font-bold text-slate-600">
                        {((reg?.teamTag ?? reg?.teamName) ?? "?").slice(0, 3).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {reg?.teamName ?? "Tim"}
                      {reg?.teamTag ? <span className="ml-1.5 text-xs text-muted-foreground">{reg.teamTag}</span> : null}
                    </span>
                    <span className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">{r.kills} kill</span>
                      <span className="font-semibold text-foreground">{r.points} poin</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Poin lobi = poin posisi akhir + 1 poin per kill. Juara turnamen adalah tim dengan total poin tertinggi.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {match.status === "finished"
              ? "Hasil lobi belum dilaporkan penyelenggara."
              : "Hasil lobi akan tampil di sini setelah pertandingan dimainkan."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MatchCard({ match, ctx }: { match: EsportMatch; ctx: MatchCtx }) {
  const { myRegIds, myCaptRegIds, myOpenDisputes, checkinWindow, now, checkinBusy } = ctx;
  const meta = toneOf(ESPORT_MATCH_STATUS_META, match.status);
  const isWalkover = match.status === "walkover";
  const isBye = match.status === "finished" && match.homeTeam && !match.awayTeam && match.homeScore === null;
  const showScore = !isBye && (match.status === "finished" || isWalkover);
  const mine = myRegIds.has(match.homeRegId ?? "") || myRegIds.has(match.awayRegId ?? "");
  const winner = (side: "home" | "away") =>
    showScore && Boolean(match.winnerRegId) && match.winnerRegId === (side === "home" ? match.homeRegId : match.awayRegId);
  const stageName = ESPORT_STAGE_LABEL[match.stage] ?? match.stage;

  if (match.stage === "lobby") return <LobbyCard match={match} ctx={ctx} />;

  const waitReady = ["scheduled", "checkin_open"].includes(match.status) && Boolean(match.homeRegId || match.awayRegId);
  const opensAt = match.scheduledAt ? Date.parse(match.scheduledAt) - checkinWindow * 60_000 : null;
  const checkinOpen = !opensAt || now >= opensAt;
  const mySide: "home" | "away" | null = myCaptRegIds.has(match.homeRegId ?? "")
    ? "home"
    : myCaptRegIds.has(match.awayRegId ?? "")
      ? "away"
      : null;
  const myCheckinAt = mySide === "home" ? match.checkinHomeAt : mySide === "away" ? match.checkinAwayAt : null;
  const canDispute = ["live", "paused", "disputed", "finished", "walkover"].includes(match.status) && mySide !== null;

  return (
    <Card className={cn(mine && "border-orange-200")}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{stageName}</Badge>
            <span>{esportRoundLabel(match.stage, match.round, ctx.maxRoundByStage.get(match.stage) ?? match.round)}</span>
            {match.groupLabel ? <span>· Grup {match.groupLabel}</span> : null}
            <span>· BO{match.bestOf}</span>
            {match.scheduledAt ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                {fmtDT(match.scheduledAt)}
              </span>
            ) : null}
            {mine ? <Badge className="border-transparent bg-orange-100 text-orange-700">Tim Anda</Badge> : null}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {match.casterName ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Mic className="size-3.5" aria-hidden />
                {match.casterName}
              </span>
            ) : null}
            {match.streamUrl ? (
              <a
                href={match.streamUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
              >
                <Play className="size-3.5" aria-hidden />
                Tonton
              </a>
            ) : null}
            {match.disputed ? (
              <Badge className="border-transparent bg-amber-100 text-amber-800">
                <Gavel aria-hidden />
                Sengketa terbuka
              </Badge>
            ) : null}
            <Badge className={cn("border-transparent", meta.tone)}>{meta.label}</Badge>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <MatchTeamRow
            team={match.homeTeam}
            score={match.homeScore}
            winner={winner("home")}
            showScore={showScore}
            walkover={isWalkover}
          />
          <MatchTeamRow
            team={match.awayTeam}
            score={match.awayScore}
            winner={winner("away")}
            showScore={showScore}
            walkover={isWalkover}
            label={isBye ? "Lolos tanpa lawan (bye)" : null}
          />
        </div>

        {match.status === "paused" ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-800">
            <Pause className="size-3.5" aria-hidden />
            <span className="font-semibold">Pertandingan dijeda</span>
            {match.pausedAt ? <span>· {fmtDT(match.pausedAt)}</span> : null}
            {match.pauseNote ? <span className="text-orange-700">— {match.pauseNote}</span> : null}
          </p>
        ) : null}

        {match.status === "cancelled" ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <Ban className="size-3.5" aria-hidden />
            <span className="font-semibold">Pertandingan dibatalkan</span>
            <span>· kedua tim tidak melakukan check-in — hubungi penyelenggara untuk penjadwalan ulang.</span>
          </p>
        ) : null}

        {match.games.length ? (
          <div className="flex flex-wrap gap-1.5">
            {match.games.map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
              >
                <span className="font-semibold text-muted-foreground">Game {g.gameIndex}</span>
                {g.map ? <span className="text-foreground">{g.map}</span> : null}
                <span className="font-medium tabular-nums text-foreground">
                  {g.homeScore}–{g.awayScore}
                </span>
                {g.durationMinutes ? <span className="text-muted-foreground">{g.durationMinutes} mnt</span> : null}
              </span>
            ))}
          </div>
        ) : null}

        {waitReady ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold tracking-wide uppercase">Check-in</span>
              <span className="inline-flex items-center gap-1">
                {match.homeTeam?.tag ?? match.homeTeam?.name ?? "Tuan rumah"}:
                {match.checkinHomeAt ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <Check className="size-3" aria-hidden />
                    siap
                  </span>
                ) : (
                  "belum"
                )}
              </span>
              <span className="inline-flex items-center gap-1">
                {match.awayTeam?.tag ?? match.awayTeam?.name ?? "Tamu"}:
                {match.checkinAwayAt ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <Check className="size-3" aria-hidden />
                    siap
                  </span>
                ) : (
                  "belum"
                )}
              </span>
            </span>
            {mySide ? (
              myCheckinAt ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Anda sudah check-in
                </span>
              ) : (
                <Button
                  size="sm"
                  variant={checkinOpen ? "default" : "outline"}
                  disabled={!checkinOpen || checkinBusy === match.id}
                  onClick={() => ctx.onCheckin(match)}
                >
                  {checkinBusy === match.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ShieldCheck className="size-3.5" aria-hidden />
                  )}
                  {checkinOpen ? "Check-in Sekarang" : opensAt ? `Dibuka ${fmtDT(new Date(opensAt).toISOString())}` : "Belum dibuka"}
                </Button>
              )
            ) : null}
          </div>
        ) : null}

        {canDispute ? (
          myOpenDisputes.has(match.id) ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-amber-700">
              <Gavel className="size-3.5" aria-hidden />
              Sengketa Anda untuk pertandingan ini sedang ditinjau penyelenggara.
            </p>
          ) : (
            <Button size="sm" variant="outline" onClick={() => ctx.onDispute(match)}>
              <Gavel className="size-3.5" aria-hidden />
              Ajukan Sengketa
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function MatchTeamRow({
  team,
  score,
  winner,
  showScore,
  walkover,
  label,
}: {
  team: EsportMatch["homeTeam"];
  score: number | null;
  winner: boolean;
  showScore: boolean;
  walkover?: boolean;
  label?: string | null;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2",
        winner && showScore ? "border-emerald-200 bg-emerald-50/70" : "border-border bg-secondary/30",
      )}
    >
      {team ? (
        <>
          {team.logo ? (
            <img src={team.logo} alt="" className="size-9 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-[10px] font-bold text-slate-600">
              {(team.tag ?? team.name).slice(0, 3).toUpperCase()}
            </span>
          )}
          {team.seed ? (
            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">#{team.seed}</span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm", winner ? "font-semibold text-foreground" : "text-foreground")}>
              {team.name}
            </p>
            {team.tag ? <p className="text-xs text-muted-foreground">{team.tag}</p> : null}
          </div>
        </>
      ) : (
        <>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground" aria-hidden>
            ?
          </span>
          <p className="flex-1 text-sm text-muted-foreground italic">{label ?? "Menunggu pemenang pertandingan sebelumnya"}</p>
        </>
      )}
      {team && showScore ? (
        walkover ? (
          <span
            className={cn(
              "rounded-lg px-2 py-0.5 text-sm font-bold tracking-wide",
              winner ? "bg-emerald-100 text-emerald-800" : "text-muted-foreground",
            )}
          >
            {winner ? "WO" : "–"}
          </span>
        ) : (
          <span className={cn("text-2xl font-semibold tabular-nums", winner ? "text-emerald-700" : "text-muted-foreground")}>
            {score ?? 0}
          </span>
        )
      ) : team ? (
        <span className="text-lg text-muted-foreground">–</span>
      ) : null}
    </div>
  );
}

function DisputeDialog({
  match,
  onOpenChange,
  onFiled,
}: {
  match: EsportMatch;
  onOpenChange: (open: boolean) => void;
  onFiled: () => void;
}) {
  const [reason, setReason] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Jelaskan alasan sengketa minimal 5 karakter.");
      return;
    }
    const urls = [...new Set(evidenceUrls.map((u) => u.trim()).filter(Boolean))];
    setSaving(true);
    try {
      await api("esport.disputes.create", {
        matchId: match.id,
        reason: reason.trim(),
        evidenceUrls: urls.length ? urls : undefined,
      });
      toast.success("Sengketa terkirim. Penyelenggara akan meninjau dan memberi keputusan.");
      onOpenChange(false);
      onFiled();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajukan Sengketa</DialogTitle>
          <DialogDescription>
            Laporkan masalah pada pertandingan {match.homeTeam?.name ?? "?"} vs {match.awayTeam?.name ?? "?"}. Sertakan
            bukti bila ada — keputusan penyelenggara bersifat final.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">Alasan sengketa</Label>
            <Textarea
              id="dispute-reason"
              value={reason}
              maxLength={500}
              rows={4}
              placeholder="cth. Skor akhir tidak sesuai dengan hasil pertandingan; lawan memakai pemain di luar roster."
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dispute-evidence-0">Tautan bukti (opsional)</Label>
            {evidenceUrls.map((url, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  id={`dispute-evidence-${i}`}
                  value={url}
                  maxLength={300}
                  placeholder="cth. tautan rekaman pertandingan"
                  className="min-w-0 flex-1"
                  onChange={(e) => setEvidenceUrls((prev) => prev.map((v, k) => (k === i ? e.target.value : v)))}
                />
                {evidenceUrls.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus tautan bukti ${i + 1}`}
                    onClick={() => setEvidenceUrls((prev) => prev.filter((_, k) => k !== i))}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}
            {evidenceUrls.length < 3 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setEvidenceUrls((prev) => [...prev, ""])}>
                <Plus className="size-3.5" aria-hidden />
                Tambah tautan
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Tautan didukung hingga 3 bukti, misalnya rekaman siaran atau tangkapan layar hasil pertandingan.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Gavel className="size-4" aria-hidden />}
            Kirim Sengketa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
