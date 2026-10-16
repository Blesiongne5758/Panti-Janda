import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Flag,
  Gavel,
  LayoutDashboard,
  Loader2,
  Mic,
  Pencil,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  UserX,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import {
  ESPORT_BEST_OF_OPTIONS,
  ESPORT_BR_PLACEMENT_POINTS,
  ESPORT_BUDGET_CATEGORY_META,
  ESPORT_BUDGET_TEMPLATES,
  ESPORT_CASTER_ROLE_META,
  ESPORT_DISPUTE_STATUS_META,
  ESPORT_FORMAT_META,
  ESPORT_MATCH_STATUS_META,
  ESPORT_MEMBER_ROLE_META,
  ESPORT_PAYMENT_STATUS_META,
  ESPORT_PRIZE_STATUS_META,
  ESPORT_REG_STATUS_META,
  ESPORT_SEEDING_META,
  ESPORT_STAGE_LABEL,
  ESPORT_STATUS_META,
  ESPORT_STREAM_PLATFORM_META,
  ROLE_RANK,
} from "@/lib/constants";
import { formatRupiah, toLocalInputValue } from "@/lib/format";
import type {
  EsportBudgetCategory,
  EsportBudgetTemplate,
  EsportCaster,
  EsportDispute,
  EsportMatch,
  EsportRegistration,
  EsportSeedingMode,
  EsportStream,
  EsportTournamentDetail,
  EsportTournamentStatus,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AccountGate, EmptyState, ErrorNote, LoadingGrid, MemberAvatar, PageBanner } from "@/components/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Exec = <T>(key: string, action: string, payload?: Record<string, unknown>) => Promise<T | null>;

const shortDateTime = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtDT(value: string | null): string {
  return value ? shortDateTime.format(new Date(value)) : "—";
}

const toneOf = (map: Record<string, { label: string; tone: string }>, key: string) =>
  map[key] ?? { label: key, tone: "bg-slate-100 text-slate-700" };

const STAGE_ORDER: Record<string, number> = {
  group: 0,
  rr: 1,
  main: 2,
  winners: 3,
  losers: 4,
  playoff: 5,
  grand_final: 6,
};

const MATCH_FILTERS = ["all", "scheduled", "checkin_open", "live", "paused", "disputed", "finished", "walkover", "cancelled"] as const;
type MatchFilter = (typeof MATCH_FILTERS)[number];

function sortMatches(a: EsportMatch, b: EsportMatch): number {
  const stageA = STAGE_ORDER[a.stage] ?? 99;
  const stageB = STAGE_ORDER[b.stage] ?? 99;
  if (stageA !== stageB) return stageA - stageB;
  if (a.round !== b.round) return a.round - b.round;
  return a.matchIndex - b.matchIndex;
}

function matchLabel(match: EsportMatch): string {
  const stage = ESPORT_STAGE_LABEL[match.stage] ?? match.stage;
  const group = match.groupLabel ? ` ${match.groupLabel}` : "";
  return `${stage}${group} · Ronde ${match.round} #${match.matchIndex + 1}`;
}

const SEEDING_MODES = Object.keys(ESPORT_SEEDING_META) as EsportSeedingMode[];
const REG_STATUSES = Object.keys(ESPORT_REG_STATUS_META);
const PAYMENT_STATUSES = Object.keys(ESPORT_PAYMENT_STATUS_META);
const STREAM_PLATFORMS = Object.keys(ESPORT_STREAM_PLATFORM_META);
const CASTER_ROLES = Object.keys(ESPORT_CASTER_ROLE_META);

const NEXT_PRIZE: Record<string, { next: string; label: string }> = {
  pending: { next: "locked", label: "Kunci Hadiah" },
  locked: { next: "distributing", label: "Mulai Pencairan" },
  distributing: { next: "completed", label: "Tandai Hadiah Selesai" },
};

const NEXT_STEP: Partial<
  Record<EsportTournamentStatus, { label: string; next: EsportTournamentStatus; hint: string; success: string }>
> = {
  draft: {
    label: "Buka Pendaftaran",
    next: "registration",
    hint: "Tim dapat mulai mendaftar dan mengelola roster.",
    success: "Pendaftaran dibuka.",
  },
  registration: {
    label: "Kunci Peserta, Lanjut ke Bagan",
    next: "bracket",
    hint: "Pendaftaran ditutup — bagan dibuat otomatis dengan unggulan urutan pendaftaran.",
    success: "Pendaftaran dikunci.",
  },
  bracket: {
    label: "Mulai Turnamen",
    next: "ongoing",
    hint: "Tandai turnamen sedang berlangsung.",
    success: "Turnamen dimulai!",
  },
  ongoing: {
    label: "Tandai Selesai",
    next: "completed",
    hint: "Semua pertandingan harus selesai lebih dulu.",
    success: "Turnamen ditandai selesai.",
  },
};

function StatCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-accent-foreground">
        {icon}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

function SummaryTab({
  id,
  data,
  exec,
  busy,
}: {
  id: string;
  data: EsportTournamentDetail;
  exec: Exec;
  busy: string | null;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const t = data.tournament;
  const step = NEXT_STEP[t.status];
  const unfinished = data.matches.filter(
    (m) => m.homeRegId && m.awayRegId && m.status !== "finished" && m.status !== "walkover" && m.status !== "cancelled",
  );
  const checkedIn = data.registrations.filter((r) => r.checkedInAt).length;
  const finished = data.matches.filter(
    (m) => m.status === "finished" || m.status === "walkover" || m.status === "cancelled",
  ).length;
  const openDisputes = data.disputes.filter((d) => d.status === "open").length;
  const topPrize = [...data.prizes].sort((a, b) => a.placement - b.placement)[0];
  const blockReason = !step
    ? null
    : step.next === "bracket" && data.registrations.length < 2
      ? "Butuh minimal 2 tim terdaftar."
      : step.next === "ongoing" && data.matches.length === 0
        ? "Buat bagan pertandingan terlebih dahulu di tab Bagan."
        : step.next === "completed" && unfinished.length > 0
          ? `${unfinished.length} pertandingan belum selesai.`
          : null;

  const steps = [
    { label: "Pendaftaran dibuka", done: t.status !== "draft" && t.status !== "cancelled" },
    { label: "Minimal 2 tim terdaftar", done: data.registrations.length >= 2 },
    { label: "Bagan pertandingan dibuat", done: data.matches.length > 0 },
    { label: "Jadwal pertandingan diatur", done: data.matches.length > 0 && data.matches.every((m) => Boolean(m.scheduledAt)) },
    { label: "Turnamen selesai", done: t.status === "completed" },
  ];

  const advance = async () => {
    if (!step) return;
    const res = await exec<{
      status: string;
      bracket?: { generated?: number; byes?: number; skipped?: string };
    }>("advance", "esport.tournaments.update", { id, status: step.next });
    if (res) {
      toast.success(step.success);
      if (res.bracket?.generated) {
        toast.info(
          `Bagan dibuat otomatis: ${res.bracket.generated} pertandingan${res.bracket.byes ? ` · ${res.bracket.byes} tim lolos bye` : ""} (unggulan urutan pendaftaran).`,
        );
      } else if (res.bracket?.skipped === "not_enough_teams") {
        toast.info("Bagan belum dibuat otomatis karena peserta belum cukup — buat manual di tab Bagan.");
      }
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            icon={<Users className="size-5" aria-hidden />}
            label="Tim Terdaftar"
            value={`${data.registrations.length}/${t.maxTeams}`}
            hint={`${checkedIn} sudah check-in · ${Math.max(0, t.maxTeams - data.registrations.length)} slot tersisa`}
          />
          <StatCard
            icon={<Swords className="size-5" aria-hidden />}
            label="Pertandingan"
            value={String(data.matches.length)}
            hint={`${finished} selesai · ${data.matches.length - finished} tersisa`}
          />
          <StatCard
            icon={<Gavel className="size-5" aria-hidden />}
            label="Sengketa"
            value={openDisputes ? `${openDisputes} terbuka` : "Bersih"}
            hint={`${data.disputes.length} total diajukan`}
          />
          <StatCard
            icon={<Trophy className="size-5" aria-hidden />}
            label="Total Hadiah"
            value={formatRupiah(t.prizeTotal)}
            hint={topPrize ? `Juara 1: ${formatRupiah(topPrize.amount)}` : "Belum diatur"}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kendali Status Turnamen</CardTitle>
            <CardDescription>Alur status: Draf → Pendaftaran → Bagan → Berlangsung → Selesai.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {t.status === "cancelled" ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Turnamen ini telah dibatalkan.
              </p>
            ) : step ? (
              <div className="space-y-2">
                <Button className="gap-2" disabled={busy !== null || Boolean(blockReason)} onClick={() => void advance()}>
                  {busy === "advance" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                  {step.label}
                </Button>
                <p className="text-xs text-muted-foreground">{blockReason ?? step.hint}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Turnamen telah selesai — tidak ada aksi status lanjutan.</p>
            )}
            <div>
              <Button
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                disabled={busy !== null || t.status === "completed" || t.status === "cancelled"}
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="size-4" aria-hidden /> Batalkan Turnamen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progres Persiapan</CardTitle>
          <CardDescription>Pastikan semua langkah selesai sebelum turnamen bergulir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  s.done ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground",
                )}
              >
                {s.done ? <Check className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
              </span>
              <span className={cn("text-sm", s.done ? "font-medium text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan turnamen?</DialogTitle>
            <DialogDescription>
              Turnamen akan ditandai dibatalkan dan tidak dapat dilanjutkan lewat halaman ini. Aksi ini tercatat oleh
              sistem.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Kembali
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={busy !== null}
              onClick={async () => {
                const res = await exec<{ status: string }>("cancel", "esport.tournaments.update", {
                  id,
                  status: "cancelled",
                });
                if (res) {
                  toast.success("Turnamen dibatalkan.");
                  setCancelOpen(false);
                }
              }}
            >
              {busy === "cancel" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <XCircle className="size-4" aria-hidden />
              )}
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegistrationRow({
  reg,
  exec,
  busy,
}: {
  reg: EsportRegistration;
  exec: Exec;
  busy: string | null;
}) {
  const [seed, setSeed] = useState(reg.seed === null ? "" : String(reg.seed));
  useEffect(() => {
    setSeed(reg.seed === null ? "" : String(reg.seed));
  }, [reg.seed]);
  const [payNote, setPayNote] = useState(reg.paymentNote ?? "");
  useEffect(() => {
    setPayNote(reg.paymentNote ?? "");
  }, [reg.paymentNote]);

  const statusMeta = toneOf(ESPORT_REG_STATUS_META, reg.status);
  const payMeta = toneOf(ESPORT_PAYMENT_STATUS_META, reg.paymentStatus);
  const currentSeed = reg.seed === null ? "" : String(reg.seed);

  const saveSeed = async () => {
    const trimmed = seed.trim();
    if (trimmed === currentSeed) return;
    if (!trimmed) {
      toast.error("Nomor unggulan tidak boleh kosong.");
      setSeed(currentSeed);
      return;
    }
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 1 || value > 128) {
      toast.error("Nomor unggulan harus angka 1-128.");
      setSeed(currentSeed);
      return;
    }
    const res = await exec<{ updated: boolean }>(`seed-${reg.id}`, "esport.registrations.update", {
      registrationId: reg.id,
      seed: value,
    });
    if (res) toast.success(`Nomor unggulan tim ${reg.teamName} disimpan.`);
  };

  const changeStatus = async (value: string) => {
    const res = await exec<{ updated: boolean }>(`status-${reg.id}`, "esport.registrations.update", {
      registrationId: reg.id,
      status: value,
    });
    if (res) toast.success("Status tim diperbarui.");
  };

  const changePayment = async (value: string) => {
    const res = await exec<{ paymentStatus: string }>(`payment-${reg.id}`, "esport.registrations.update", {
      registrationId: reg.id,
      paymentStatus: value,
    });
    if (res) toast.success("Status pembayaran diperbarui.");
  };

  const savePayNote = async () => {
    const trimmed = payNote.trim();
    if (trimmed === (reg.paymentNote ?? "")) return;
    const res = await exec<{ updated: boolean }>(`paynote-${reg.id}`, "esport.registrations.update", {
      registrationId: reg.id,
      paymentNote: trimmed,
    });
    if (res) toast.success("Catatan pembayaran disimpan.");
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-xl"
              aria-hidden
            >
              {reg.teamLogo ?? "🛡️"}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                {reg.teamName}
                {reg.teamTag ? <span className="text-xs font-normal text-muted-foreground">[{reg.teamTag}]</span> : null}
                {reg.groupLabel ? <Badge variant="outline">Grup {reg.groupLabel}</Badge> : null}
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden /> Daftar {fmtDT(reg.registeredAt)}
                </span>
                {reg.checkedInAt ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <Check className="size-3.5" aria-hidden /> Check-in {fmtDT(reg.checkedInAt)}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor={`seed-${reg.id}`} className="text-xs text-muted-foreground">
                Seed
              </Label>
              <Input
                id={`seed-${reg.id}`}
                type="number"
                min={1}
                max={128}
                value={seed}
                placeholder="—"
                className="w-20"
                onChange={(e) => setSeed(e.target.value)}
                onBlur={() => void saveSeed()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                disabled={busy !== null}
              />
            </div>
            <Select value={reg.status} onValueChange={(v) => void changeStatus(v)} disabled={busy !== null}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REG_STATUSES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {ESPORT_REG_STATUS_META[key]?.label ?? key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
          </div>
        </div>
        {reg.roster.length ? (
          <div className="flex flex-wrap gap-1.5">
            {reg.roster.map((member) => (
              <span
                key={member.accountId}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 py-1 pr-2.5 pl-1 text-xs text-foreground"
              >
                <MemberAvatar name={member.name} size={20} />
                {member.name}
                {member.memberRole !== "member" ? (
                  <span className="font-semibold text-accent-foreground">
                    · {ESPORT_MEMBER_ROLE_META[member.memberRole]?.label ?? member.memberRole}
                  </span>
                ) : null}
                {member.gameRole ? <span className="text-muted-foreground">· {member.gameRole}</span> : null}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Banknote className="size-3.5" aria-hidden /> Pembayaran
          </span>
          <Select value={reg.paymentStatus} onValueChange={(v) => void changePayment(v)} disabled={busy !== null}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUSES.map((key) => (
                <SelectItem key={key} value={key}>
                  {ESPORT_PAYMENT_STATUS_META[key]?.label ?? key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge className={cn("border-transparent", payMeta.tone)}>{payMeta.label}</Badge>
          <Input
            value={payNote}
            onChange={(e) => setPayNote(e.target.value)}
            onBlur={() => void savePayNote()}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Catatan pembayaran (mis. transfer BCA 12 Okt)"
            className="min-w-[12rem] flex-1"
            maxLength={200}
            disabled={busy !== null}
          />
          {reg.paidAt ? (
            <span className="text-xs text-muted-foreground">Dibayar {fmtDT(reg.paidAt)}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamsTab({ data, exec, busy }: { data: EsportTournamentDetail; exec: Exec; busy: string | null }) {
  if (!data.registrations.length) {
    return (
      <EmptyState
        icon={<Users className="size-6" aria-hidden />}
        title="Belum ada tim terdaftar"
        description="Tim muncul di sini setelah kapten mendaftarkan tim lewat halaman publik turnamen."
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Atur nomor unggulan (seed) untuk metode penempatan manual, dan kelola status tim seperti diskualifikasi.
      </p>
      {data.registrations.map((reg) => (
        <RegistrationRow key={reg.id} reg={reg} exec={exec} busy={busy} />
      ))}
    </div>
  );
}

function BracketTab({
  id,
  data,
  exec,
  busy,
}: {
  id: string;
  data: EsportTournamentDetail;
  exec: Exec;
  busy: string | null;
}) {
  const [seeding, setSeeding] = useState<EsportSeedingMode>("random");
  const [lobbies, setLobbies] = useState("3");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const t = data.tournament;
  const matches = data.matches;
  const isBr = t.format === "battle_royale";
  const minTeams = t.format === "group_playoff" ? 4 : 2;
  const missingSeeds = data.registrations.filter((r) => r.seed === null).length;
  const statusReady = t.status === "registration" || t.status === "bracket";
  const blockReason =
    data.registrations.length < minTeams
      ? `Butuh minimal ${minTeams} tim terdaftar untuk format ini.`
      : !statusReady
        ? "Ubah status turnamen ke Pendaftaran atau Bagan terlebih dahulu (tab Ringkasan)."
        : seeding === "manual" && missingSeeds > 0
          ? `Masih ada ${missingSeeds} tim tanpa nomor unggulan — atur dulu di tab Peserta.`
          : null;

  const generate = async () => {
    const lobbyCount = Number(lobbies);
    if (isBr && (!Number.isInteger(lobbyCount) || lobbyCount < 1 || lobbyCount > 12)) {
      toast.error("Jumlah lobi harus angka 1-12.");
      return;
    }
    const res = await exec<{ generated: number; byes?: number; stage?: string; lobbies?: number }>(
      "generate",
      "esport.bracket.generate",
      { id, seeding, ...(isBr ? { lobbies: lobbyCount } : {}) },
    );
    if (res) {
      if (res.stage === "playoff") {
        toast.success(`Bagan playoff dibuat: ${res.generated} pertandingan.`);
      } else if (res.stage === "lobby") {
        toast.success(`${res.lobbies ?? res.generated} lobi Battle Royale dibuat.`);
      } else {
        toast.success(
          `Bagan dibuat: ${res.generated} pertandingan${res.byes ? `, ${res.byes} tim lolos bye` : ""}.`,
        );
      }
      setConfirmOpen(false);
    }
  };

  const groupMatches = matches.filter((m) => m.stage === "group");
  const hasPlayoff = matches.some((m) => m.stage === "playoff" || m.stage === "grand_final");
  const groupsDone =
    groupMatches.length > 0 &&
    groupMatches.every((m) => m.status === "finished" || m.status === "walkover" || m.status === "cancelled");

  const generatePlayoff = async () => {
    const res = await exec<{ generated: number }>("generate-playoff", "esport.bracket.generate", {
      id,
      stage: "playoff",
    });
    if (res) toast.success(`Bagan playoff dibuat: ${res.generated} pertandingan.`);
  };

  const swissRounds = t.format === "swiss" ? matches.filter((m) => m.stage === "main") : [];
  const swissCurrentRound = swissRounds.length ? Math.max(...swissRounds.map((m) => m.round)) : 0;
  const swissRoundDone =
    swissCurrentRound > 0 &&
    swissRounds
      .filter((m) => m.round === swissCurrentRound)
      .every((m) => m.status === "finished" || m.status === "walkover" || m.status === "cancelled");

  const nextSwissRound = async () => {
    const res = await exec<{ round: number; generated: number; byes?: number }>("swiss-round", "esport.bracket.swissRound", {
      id,
    });
    if (res) {
      toast.success(
        `Ronde ${res.round} dibuat: ${res.generated} pertandingan${res.byes ? `, ${res.byes} tim lolos bye` : ""}.`,
      );
    }
  };

  const seedingMeta = ESPORT_SEEDING_META[seeding];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="size-5" aria-hidden /> {matches.length ? "Buat Ulang Bagan" : "Buat Bagan"}
          </CardTitle>
          <CardDescription>
            Pilih metode penempatan tim, lalu sistem menyusun bagan otomatis sesuai format{" "}
            {ESPORT_FORMAT_META[t.format]?.label ?? t.format}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={cn("grid gap-3 sm:grid-cols-2", isBr && "sm:grid-cols-3")}>
            <div className="space-y-1.5">
              <Label>Metode Penempatan</Label>
              <Select
                value={seeding}
                onValueChange={(v) => setSeeding(v as EsportSeedingMode)}
                disabled={busy !== null}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEEDING_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {ESPORT_SEEDING_META[mode]?.label ?? mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{seedingMeta?.hint}</p>
            </div>
            {isBr ? (
              <div className="space-y-1.5">
                <Label htmlFor="br-lobbies">Jumlah Lobi</Label>
                <Input
                  id="br-lobbies"
                  type="number"
                  min={1}
                  max={12}
                  value={lobbies}
                  onChange={(e) => setLobbies(e.target.value)}
                  disabled={busy !== null}
                />
                <p className="text-xs text-muted-foreground">
                  Semua tim ikut di setiap lobi. Poin: juara #1 = 10, tiap kill = 1.
                </p>
              </div>
            ) : null}
            <div className="flex items-end">
              <Button
                className="gap-2"
                disabled={busy !== null || Boolean(blockReason)}
                onClick={() => (matches.length ? setConfirmOpen(true) : void generate())}
              >
                {busy === "generate" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Swords className="size-4" aria-hidden />
                )}
                {matches.length ? "Buat Ulang Bagan" : "Buat Bagan Sekarang"}
              </Button>
            </div>
          </div>
          {blockReason ? <p className="text-xs text-amber-700">{blockReason}</p> : null}
          {matches.length ? (
            <p className="text-xs text-muted-foreground">
              Membuat ulang bagan menghapus seluruh pertandingan. Sistem menolak jika sudah ada pertandingan live atau
              selesai.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {t.format === "group_playoff" && groupMatches.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Fase Playoff</CardTitle>
            <CardDescription>Dua tim teratas tiap grup dipertemukan silang di bagan playoff.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {hasPlayoff ? (
              <Badge className="border-transparent bg-emerald-100 text-emerald-800">Bagan playoff sudah dibuat</Badge>
            ) : (
              <>
                <Button className="gap-2" disabled={busy !== null || !groupsDone} onClick={() => void generatePlayoff()}>
                  {busy === "generate-playoff" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Play className="size-4" aria-hidden />
                  )}
                  Buat Bagan Playoff
                </Button>
                {!groupsDone ? (
                  <p className="text-xs text-muted-foreground">
                    Selesaikan seluruh pertandingan fase grup terlebih dahulu.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {t.format === "swiss" && matches.length > 0 && ["bracket", "ongoing"].includes(t.status) ? (
        <Card>
          <CardHeader>
            <CardTitle>Ronde Swiss</CardTitle>
            <CardDescription>
              Ronde baru dipasangkan otomatis dari klasemen — tim dengan rekor setara bertemu, ulangan lawan dihindari.
              Tim puncak klasemen saat turnamen ditandai selesai menjadi juara.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button
              className="gap-2"
              disabled={busy !== null || !swissRoundDone}
              onClick={() => void nextSwissRound()}
            >
              {busy === "swiss-round" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              Buat Ronde {swissCurrentRound + 1}
            </Button>
            {swissRoundDone ? (
              <p className="text-xs text-muted-foreground">
                Ronde {swissCurrentRound} selesai — pasangan ronde berikutnya sudah bisa dibuat.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Selesaikan seluruh pertandingan Ronde {swissCurrentRound} terlebih dahulu.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {matches.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Pratinjau Bagan</h3>
          <EsportBracket matches={matches} disputedMatchIds={matches.filter((m) => m.disputed).map((m) => m.id)} />
        </div>
      ) : (
        <EmptyState
          icon={<Swords className="size-6" aria-hidden />}
          title="Bagan belum dibuat"
          description="Setelah minimal dua tim terdaftar, buat bagan untuk mulai menjadwalkan pertandingan."
        />
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat ulang bagan?</DialogTitle>
            <DialogDescription>
              Seluruh pertandingan yang ada akan dihapus dan digantikan bagan baru. Proses ini ditolak sistem jika sudah
              ada pertandingan live atau selesai.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button className="gap-2" disabled={busy !== null} onClick={() => void generate()}>
              {busy === "generate" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Ya, Buat Ulang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MatchAdminCard({
  match,
  busy,
  lobbyTeams,
  teamNameOf,
  onToggleLive,
  onPause,
  onResume,
  onWalkover,
  onEdit,
  onScore,
  onGames,
  onStream,
}: {
  match: EsportMatch;
  busy: string | null;
  lobbyTeams?: number;
  teamNameOf: (regId: string) => string;
  onToggleLive: () => void;
  onPause: () => void;
  onResume: () => void;
  onWalkover: () => void;
  onEdit: () => void;
  onScore: () => void;
  onGames: () => void;
  onStream: () => void;
}) {
  const statusMeta = toneOf(ESPORT_MATCH_STATUS_META, match.status);
  const isLobby = match.stage === "lobby";
  const playable = isLobby ? true : Boolean(match.homeRegId && match.awayRegId);
  const isBye = match.status === "finished" && match.homeTeam && !match.awayTeam && match.homeScore === null;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{matchLabel(match)}</Badge>
          {isLobby ? <span>Battle Royale · {lobbyTeams ?? 0} tim</span> : <span>BO{match.bestOf}</span>}
          {isBye ? <Badge variant="outline">Bye</Badge> : null}
        </div>
        <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
      </div>

      {isLobby ? (
        <p className="text-sm text-muted-foreground">
          {match.status === "finished"
            ? "Hasil lobi sudah tersimpan — gunakan tombol Ubah Hasil Lobi bila perlu mengoreksi posisi akhir atau kill."
            : "Semua tim bertanding di lobi ini — hasil posisi akhir dan kill dilaporkan lewat tombol Input Hasil Lobi."}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground">
          <span className={cn("font-medium", match.status === "walkover" && match.winnerRegId === match.homeRegId && "text-emerald-700")}>
            {match.homeTeam?.name ?? "TBD"}
          </span>
          <span className="rounded-lg bg-secondary px-2 py-0.5 font-semibold tabular-nums">
            {match.status === "walkover"
              ? "WO"
              : match.status === "cancelled"
                ? "BATAL"
                : `${match.homeScore ?? "–"} : ${match.awayScore ?? "–"}`}
          </span>
          <span
            className={cn(
              "font-medium",
              match.status === "walkover" && match.winnerRegId === match.awayRegId && "text-emerald-700",
            )}
          >
            {match.awayTeam?.name ?? (isBye ? "Bye" : "TBD")}
          </span>
        </div>
      )}

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

      {isLobby && match.brResults.length ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-semibold tracking-wide uppercase">Juara Lobi</span>
          {[...match.brResults]
            .sort((a, b) => a.placement - b.placement)
            .slice(0, 3)
            .map((r) => (
              <span key={r.registrationId} className="text-foreground">
                #{r.placement} {teamNameOf(r.registrationId)}{" "}
                <span className="text-muted-foreground">({r.points} poin)</span>
              </span>
            ))}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" aria-hidden /> {match.scheduledAt ? fmtDT(match.scheduledAt) : "Belum dijadwalkan"}
        </span>
        {match.streamUrl ? (
          <a
            href={match.streamUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent-foreground hover:underline"
          >
            <Radio className="size-3.5" aria-hidden /> Stream <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
        {match.casterName ? (
          <span className="inline-flex items-center gap-1">
            <Mic className="size-3.5" aria-hidden /> {match.casterName}
          </span>
        ) : null}
        {match.checkinHomeAt ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <Check className="size-3.5" aria-hidden /> {match.homeTeam?.name ?? "Tim"}
          </span>
        ) : null}
        {match.checkinAwayAt ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <Check className="size-3.5" aria-hidden /> {match.awayTeam?.name ?? "Tim"}
          </span>
        ) : null}
        {match.status === "paused" ? (
          <span className="inline-flex items-center gap-1 text-orange-700">
            <Pause className="size-3.5" aria-hidden />
            Dijeda {match.pausedAt ? fmtDT(match.pausedAt) : ""}
            {match.pauseNote ? <span className="text-muted-foreground">— {match.pauseNote}</span> : null}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {["scheduled", "checkin_open"].includes(match.status) && playable ? (
          <Button size="sm" className="gap-1.5" disabled={busy !== null} onClick={onToggleLive}>
            {busy === `live-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}{" "}
            Mulai
          </Button>
        ) : null}
        {["live", "paused"].includes(match.status) ? (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null} onClick={onToggleLive}>
            {busy === `live-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <XCircle className="size-4" aria-hidden />
            )}{" "}
            Hentikan
          </Button>
        ) : null}
        {match.status === "live" ? (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null} onClick={onPause}>
            {busy === `pause-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Pause className="size-4" aria-hidden />
            )}{" "}
            Jeda
          </Button>
        ) : null}
        {match.status === "paused" ? (
          <Button size="sm" className="gap-1.5" disabled={busy !== null} onClick={onResume}>
            {busy === `resume-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}{" "}
            Lanjutkan
          </Button>
        ) : null}
        {playable &&
        (isLobby
          ? match.status !== "finished"
          : ["scheduled", "checkin_open", "live", "paused", "walkover"].includes(match.status)) ? (
          <Button
            size="sm"
            variant={["finished", "walkover"].includes(match.status) ? "outline" : "default"}
            className="gap-1.5"
            disabled={busy !== null}
            onClick={onScore}
          >
            <Flag className="size-4" aria-hidden />{" "}
            {isLobby
              ? match.status === "finished"
                ? "Ubah Hasil Lobi"
                : "Input Hasil Lobi"
              : match.status === "walkover"
                ? "Koreksi Skor"
                : "Input Skor"}
          </Button>
        ) : null}
        {!isLobby && match.bestOf > 1 && ["scheduled", "checkin_open", "live", "paused"].includes(match.status) ? (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null} onClick={onGames}>
            <Swords className="size-4" aria-hidden /> Input Game
          </Button>
        ) : null}
        {!isLobby && ["scheduled", "checkin_open"].includes(match.status) && playable ? (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null} onClick={onWalkover}>
            <UserX className="size-4" aria-hidden /> Walkover
          </Button>
        ) : null}
        {["scheduled", "checkin_open", "live", "paused"].includes(match.status) ? (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null} onClick={onStream}>
            <Radio className="size-4" aria-hidden /> {match.streamUrl ? "Ganti Siaran" : "Siarkan"}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null} onClick={onEdit}>
          <Pencil className="size-4" aria-hidden /> Atur
        </Button>
      </div>
    </div>
  );
}

function EditMatchDialog({
  match,
  busy,
  onClose,
  onSubmit,
}: {
  match: EsportMatch | null;
  busy: string | null;
  onClose: () => void;
  onSubmit: (match: EsportMatch, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [at, setAt] = useState("");
  const [stream, setStream] = useState("");
  const [caster, setCaster] = useState("");
  const [bo, setBo] = useState("1");

  useEffect(() => {
    if (!match) return;
    setAt(toLocalInputValue(match.scheduledAt));
    setStream(match.streamUrl ?? "");
    setCaster(match.casterName ?? "");
    setBo(String(match.bestOf));
  }, [match]);

  if (!match) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atur Pertandingan</DialogTitle>
          <DialogDescription>
            {matchLabel(match)} — {match.homeTeam?.name ?? "TBD"} vs {match.awayTeam?.name ?? "TBD"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="match-at">Waktu Pertandingan</Label>
            <Input id="match-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
            <p className="text-xs text-muted-foreground">Kosongkan untuk menghapus jadwal pertandingan.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="match-stream">URL Live Streaming</Label>
            <Input
              id="match-stream"
              placeholder="https://youtube.com/live/..."
              value={stream}
              onChange={(e) => setStream(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="match-caster">Nama Caster</Label>
            <Input
              id="match-caster"
              placeholder="Nama komentator"
              value={caster}
              onChange={(e) => setCaster(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Format Best of</Label>
            <Select value={bo} onValueChange={setBo}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESPORT_BEST_OF_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    Best of {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="gap-2"
            disabled={busy !== null}
            onClick={() =>
              void onSubmit(match, {
                matchId: match.id,
                scheduledAt: at ? new Date(at).toISOString() : "",
                streamUrl: stream.trim(),
                casterName: caster.trim(),
                bestOf: Number(bo),
              })
            }
          >
            {busy === `edit-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}{" "}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignStreamDialog({
  match,
  streams,
  busy,
  onClose,
  onSubmit,
}: {
  match: EsportMatch | null;
  streams: EsportStream[];
  busy: string | null;
  onClose: () => void;
  onSubmit: (match: EsportMatch, streamId: string) => Promise<void>;
}) {
  const [streamId, setStreamId] = useState("");

  useEffect(() => {
    if (!match) return;
    const current = streams.find((s) => s.currentMatchId === match.id);
    setStreamId(current?.id ?? "");
  }, [match, streams]);

  if (!match) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Siarkan Pertandingan</DialogTitle>
          <DialogDescription>
            {matchLabel(match)} — pilih kanal siaran. Kanal akan mengarah ke laga ini dan ditandai LIVE, tautannya
            ikut tampil di kartu pertandingan.
          </DialogDescription>
        </DialogHeader>
        {streams.length ? (
          <div className="grid gap-2">
            {streams.map((s) => (
              <label
                key={s.id}
                className={cn(
                  "flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                  streamId === s.id ? "border-rose-300 bg-rose-50/60" : "border-border bg-secondary/40",
                )}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <input
                    type="radio"
                    name="assign-stream"
                    className="size-4 shrink-0 accent-rose-600"
                    checked={streamId === s.id}
                    onChange={() => setStreamId(s.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{s.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ESPORT_STREAM_PLATFORM_META[s.platform]?.label ?? s.platform}
                      {s.url ? ` · ${s.url}` : " · tanpa tautan"}
                      {s.isActive ? " · sedang LIVE" : ""}
                    </span>
                  </span>
                </span>
                {s.currentMatchId === match.id ? <Badge variant="outline">Laga ini</Badge> : null}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Belum ada kanal siaran — buka tab Siaran untuk menambah kanal atau menyiapkan kanal standar terlebih dulu.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button className="gap-2" disabled={busy !== null || !streamId} onClick={() => void onSubmit(match, streamId)}>
            {busy === `assign-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Radio className="size-4" aria-hidden />
            )}{" "}
            Siarkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PauseMatchDialog({
  match,
  busy,
  onClose,
  onSubmit,
}: {
  match: EsportMatch | null;
  busy: string | null;
  onClose: () => void;
  onSubmit: (match: EsportMatch, note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (match) setNote("");
  }, [match]);

  if (!match) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jeda Pertandingan</DialogTitle>
          <DialogDescription>
            {matchLabel(match)} — {match.homeTeam?.name ?? "TBD"} vs {match.awayTeam?.name ?? "TBD"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="pause-note">Catatan Jeda (opsional)</Label>
          <Textarea
            id="pause-note"
            placeholder="Contoh: kendala koneksi pemain, menunggu keputusan panitia"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground">
            Pertandingan dapat dilanjutkan kembali kapan saja dari kartu pertandingan.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button className="gap-2" disabled={busy !== null} onClick={() => void onSubmit(match, note.trim())}>
            {busy === `pause-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Pause className="size-4" aria-hidden />
            )}{" "}
            Jeda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WalkoverDialog({
  match,
  busy,
  onClose,
  onSubmit,
}: {
  match: EsportMatch | null;
  busy: string | null;
  onClose: () => void;
  onSubmit: (match: EsportMatch, winnerRegId: string) => Promise<void>;
}) {
  const [winnerRegId, setWinnerRegId] = useState("");

  useEffect(() => {
    if (match) setWinnerRegId("");
  }, [match]);

  if (!match) return null;

  const options = [
    { regId: match.homeRegId, name: match.homeTeam?.name ?? "Tim" },
    { regId: match.awayRegId, name: match.awayTeam?.name ?? "Tim" },
  ].filter((option): option is { regId: string; name: string } => Boolean(option.regId));

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tetapkan Walkover</DialogTitle>
          <DialogDescription>
            {matchLabel(match)} — pilih tim yang dinyatakan menang karena lawannya tidak hadir.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {options.map((option) => (
            <button
              key={option.regId}
              type="button"
              onClick={() => setWinnerRegId(option.regId)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                winnerRegId === option.regId
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-border bg-secondary/30",
              )}
            >
              {option.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Pemenang otomatis melaju ke ronde berikutnya dan kedua kapten menerima notifikasi. Skor walkover dapat
          dikoreksi jika pertandingan tetap dimainkan.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="gap-2"
            disabled={busy !== null || !winnerRegId}
            onClick={() => void onSubmit(match, winnerRegId)}
          >
            {busy === `wo-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserX className="size-4" aria-hidden />
            )}{" "}
            Simpan Walkover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScoreDialog({
  match,
  busy,
  onClose,
  onSubmit,
}: {
  match: EsportMatch | null;
  busy: string | null;
  onClose: () => void;
  onSubmit: (match: EsportMatch, home: number, away: number) => Promise<void>;
}) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");

  useEffect(() => {
    if (!match) return;
    setHome(match.homeScore === null ? "" : String(match.homeScore));
    setAway(match.awayScore === null ? "" : String(match.awayScore));
  }, [match]);

  if (!match) return null;

  const needs = Math.floor(match.bestOf / 2) + 1;
  const hint =
    match.bestOf > 1
      ? `Pemenang harus meraih tepat ${needs} game, lawan kurang dari ${needs}. Contoh: ${needs}-0 s/d ${needs}-${
          needs - 1
        }.`
      : "Best of 1: skor tidak boleh seri.";

  const submit = () => {
    const h = Number(home);
    const a = Number(away);
    if (home.trim() === "" || away.trim() === "" || !Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      toast.error("Masukkan skor berupa angka bulat.");
      return;
    }
    void onSubmit(match, h, a);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Input Skor</DialogTitle>
          <DialogDescription>
            {match.homeTeam?.name ?? "TBD"} vs {match.awayTeam?.name ?? "TBD"} — {matchLabel(match)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="score-home">{match.homeTeam?.name ?? "Tim Tuan Rumah"}</Label>
            <Input
              id="score-home"
              type="number"
              min={0}
              max={99}
              value={home}
              onChange={(e) => setHome(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="score-away">{match.awayTeam?.name ?? "Tim Tamu"}</Label>
            <Input
              id="score-away"
              type="number"
              min={0}
              max={99}
              value={away}
              onChange={(e) => setAway(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
        <p className="text-xs text-muted-foreground">
          Menyimpan skor menuntaskan pertandingan dan otomatis mengisi babak berikutnya.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button className="gap-2" disabled={busy !== null} onClick={submit}>
            {busy === `score-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Flag className="size-4" aria-hidden />
            )}{" "}
            Simpan Skor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GameDialog({
  match,
  busy,
  onClose,
  onSubmit,
}: {
  match: EsportMatch | null;
  busy: string | null;
  onClose: () => void;
  onSubmit: (match: EsportMatch, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [gameIndex, setGameIndex] = useState("1");
  const [map, setMap] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [duration, setDuration] = useState("");
  const [bans, setBans] = useState("");
  const [picks, setPicks] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!match) return;
    setGameIndex(String(match.games.length + 1));
    setMap("");
    setHome("");
    setAway("");
    setDuration("");
    setBans("");
    setPicks("");
    setNotes("");
  }, [match]);

  if (!match) return null;

  const toList = (value: string) => [...new Set(value.split(",").map((v) => v.trim()).filter(Boolean))];

  const submit = () => {
    const idx = Number(gameIndex);
    const h = Number(home);
    const a = Number(away);
    if (!Number.isInteger(idx) || idx < 1 || idx > 9) {
      toast.error("Nomor game harus 1-9.");
      return;
    }
    if (
      home.trim() === "" ||
      away.trim() === "" ||
      !Number.isInteger(h) ||
      !Number.isInteger(a) ||
      h < 0 ||
      a < 0 ||
      h > 99 ||
      a > 99
    ) {
      toast.error("Skor game harus angka bulat 0-99.");
      return;
    }
    if (h === a) {
      toast.error("Skor game tidak boleh seri.");
      return;
    }
    const dur = duration.trim() ? Number(duration) : null;
    if (dur !== null && (!Number.isInteger(dur) || dur < 0 || dur > 600)) {
      toast.error("Durasi game harus 0-600 menit.");
      return;
    }
    void onSubmit(match, {
      matchId: match.id,
      gameIndex: idx,
      map: map.trim(),
      homeScore: h,
      awayScore: a,
      durationMinutes: dur,
      bans: toList(bans),
      picks: toList(picks),
      notes: notes.trim(),
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Input Hasil Game</DialogTitle>
          <DialogDescription>
            {match.homeTeam?.name ?? "TBD"} vs {match.awayTeam?.name ?? "TBD"} — Best of {match.bestOf}. Simpan dengan
            nomor game yang sama untuk memperbarui hasil game tersebut.
          </DialogDescription>
        </DialogHeader>
        {match.games.length ? (
          <div className="flex flex-wrap gap-1.5">
            {match.games.map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2 py-1 text-[11px]"
              >
                <span className="font-semibold text-muted-foreground">Game {g.gameIndex}</span>
                {g.map ? <span className="text-foreground">{g.map}</span> : null}
                <span className="font-medium tabular-nums text-foreground">
                  {g.homeScore}–{g.awayScore}
                </span>
              </span>
            ))}
          </div>
        ) : null}
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="game-index">Game Ke-</Label>
              <Input
                id="game-index"
                type="number"
                min={1}
                max={9}
                value={gameIndex}
                onChange={(e) => setGameIndex(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="game-map">Peta / Map</Label>
              <Input
                id="game-map"
                value={map}
                maxLength={60}
                placeholder="cth. Miramar"
                onChange={(e) => setMap(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="game-duration">Durasi (menit)</Label>
              <Input
                id="game-duration"
                type="number"
                min={0}
                max={600}
                value={duration}
                placeholder="Opsional"
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="game-home">{match.homeTeam?.name ?? "Tim Tuan Rumah"}</Label>
              <Input id="game-home" type="number" min={0} max={99} value={home} onChange={(e) => setHome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="game-away">{match.awayTeam?.name ?? "Tim Tamu"}</Label>
              <Input id="game-away" type="number" min={0} max={99} value={away} onChange={(e) => setAway(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="game-bans">Ban (pisahkan dengan koma)</Label>
              <Input
                id="game-bans"
                value={bans}
                onChange={(e) => setBans(e.target.value)}
                placeholder="cth. Hero A, Hero B"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="game-picks">Pick (pisahkan dengan koma)</Label>
              <Input
                id="game-picks"
                value={picks}
                onChange={(e) => setPicks(e.target.value)}
                placeholder="cth. Hero X, Hero Y"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-notes">Catatan</Label>
            <Textarea
              id="game-notes"
              rows={2}
              value={notes}
              maxLength={300}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan untuk game ini (opsional)."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button className="gap-2" disabled={busy !== null} onClick={submit}>
            {busy === `game-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Swords className="size-4" aria-hidden />
            )}{" "}
            Simpan Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BrRowState {
  registrationId: string;
  teamName: string;
  teamTag: string | null;
  placement: string;
  kills: string;
}

function BrResultsDialog({
  match,
  regs,
  busy,
  onClose,
  onSubmit,
}: {
  match: EsportMatch | null;
  regs: EsportRegistration[];
  busy: string | null;
  onClose: () => void;
  onSubmit: (
    match: EsportMatch,
    results: { registrationId: string; placement: number; kills: number }[],
  ) => Promise<void>;
}) {
  const [rows, setRows] = useState<BrRowState[]>([]);

  useEffect(() => {
    if (!match) return;
    const existing = new Map(match.brResults.map((r) => [r.registrationId, r]));
    setRows(
      regs.map((reg, index) => ({
        registrationId: reg.id,
        teamName: reg.teamName,
        teamTag: reg.teamTag,
        placement: existing.has(reg.id) ? String(existing.get(reg.id)!.placement) : String(index + 1),
        kills: existing.has(reg.id) ? String(existing.get(reg.id)!.kills) : "0",
      })),
    );
  }, [match, regs]);

  if (!match) return null;

  const pointsOf = (placement: string, kills: string): number | null => {
    const p = Number(placement);
    const k = Number(kills);
    if (!Number.isInteger(p) || p < 1) return null;
    return (ESPORT_BR_PLACEMENT_POINTS[p] ?? 0) + (Number.isInteger(k) && k > 0 ? k : 0);
  };

  const submit = () => {
    const parsed = rows.map((r) => ({
      registrationId: r.registrationId,
      placement: Number(r.placement),
      kills: Number(r.kills),
    }));
    if (
      parsed.some(
        (r) => !Number.isInteger(r.placement) || r.placement < 1 || !Number.isInteger(r.kills) || r.kills < 0,
      )
    ) {
      toast.error("Isi posisi (1 ke atas) dan jumlah kill (0 ke atas) untuk semua tim.");
      return;
    }
    if (new Set(parsed.map((r) => r.placement)).size !== parsed.length) {
      toast.error("Posisi akhir tidak boleh sama antar tim.");
      return;
    }
    void onSubmit(match, parsed);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{match.status === "finished" ? "Ubah Hasil Lobi" : "Input Hasil Lobi"}</DialogTitle>
          <DialogDescription>
            Lobi {match.matchIndex} — isi posisi akhir dan jumlah kill tiap tim. Poin dihitung otomatis: poin posisi
            akhir + 1 poin per kill.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
          {rows.map((row, index) => (
            <div key={row.registrationId} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {row.teamName}
                {row.teamTag ? <span className="ml-1.5 text-xs text-muted-foreground">{row.teamTag}</span> : null}
              </span>
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`br-pos-${row.registrationId}`} className="text-xs text-muted-foreground">
                  Posisi
                </Label>
                <Input
                  id={`br-pos-${row.registrationId}`}
                  type="number"
                  min={1}
                  max={100}
                  value={row.placement}
                  className="w-20"
                  disabled={busy !== null}
                  onChange={(e) =>
                    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, placement: e.target.value } : r)))
                  }
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`br-kill-${row.registrationId}`} className="text-xs text-muted-foreground">
                  Kill
                </Label>
                <Input
                  id={`br-kill-${row.registrationId}`}
                  type="number"
                  min={0}
                  max={200}
                  value={row.kills}
                  className="w-20"
                  disabled={busy !== null}
                  onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, kills: e.target.value } : r)))}
                />
              </div>
              <span className="w-20 text-right text-xs font-semibold text-foreground">
                {pointsOf(row.placement, row.kills) !== null ? `+${pointsOf(row.placement, row.kills)} poin` : "–"}
              </span>
            </div>
          ))}
          {!rows.length ? (
            <p className="text-sm text-muted-foreground">
              Belum ada tim aktif yang bisa dilombakan. Pastikan minimal dua tim berstatus Terdaftar atau Check-in.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button className="gap-2" disabled={busy !== null || !rows.length} onClick={submit}>
            {busy === `br-${match.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Flag className="size-4" aria-hidden />
            )}{" "}
            Simpan Hasil Lobi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MatchesTab({
  id,
  data,
  exec,
  busy,
}: {
  id: string;
  data: EsportTournamentDetail;
  exec: Exec;
  busy: string | null;
}) {
  const matches = data.matches;
  const [schedAt, setSchedAt] = useState("");
  const [schedGap, setSchedGap] = useState("60");
  const [schedStage, setSchedStage] = useState("all");
  const [schedRound, setSchedRound] = useState("");
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [editMatch, setEditMatch] = useState<EsportMatch | null>(null);
  const [scoreMatch, setScoreMatch] = useState<EsportMatch | null>(null);
  const [gamesMatch, setGamesMatch] = useState<EsportMatch | null>(null);
  const [brMatch, setBrMatch] = useState<EsportMatch | null>(null);
  const [pauseMatch, setPauseMatch] = useState<EsportMatch | null>(null);
  const [walkoverMatch, setWalkoverMatch] = useState<EsportMatch | null>(null);
  const [streamMatch, setStreamMatch] = useState<EsportMatch | null>(null);

  const sorted = useMemo(() => [...matches].sort(sortMatches), [matches]);
  const stageOptions = useMemo(() => {
    const set = new Set(matches.map((m) => m.stage));
    return [...set].sort((a, b) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99));
  }, [matches]);
  const counts = useMemo(() => {
    const map: Record<MatchFilter, number> = {
      all: matches.length,
      scheduled: 0,
      checkin_open: 0,
      live: 0,
      paused: 0,
      disputed: 0,
      finished: 0,
      walkover: 0,
      cancelled: 0,
    };
    for (const match of matches) {
      map[match.status] += 1;
    }
    return map;
  }, [matches]);
  const visible = filter === "all" ? sorted : sorted.filter((m) => m.status === filter);
  const activeRegs = data.registrations.filter((r) =>
    ["registered", "checked_in", "winner", "eliminated"].includes(r.status),
  );

  const runSchedule = async () => {
    if (!schedAt) {
      toast.error("Pilih waktu mulai pertandingan pertama.");
      return;
    }
    const gap = Math.min(240, Math.max(5, Math.round(Number(schedGap) || 60)));
    const payload: Record<string, unknown> = {
      id,
      scheduledAt: new Date(schedAt).toISOString(),
      gapMinutes: gap,
    };
    if (schedStage !== "all") payload.stage = schedStage;
    const round = Number(schedRound);
    if (schedRound.trim() && Number.isInteger(round) && round >= 1 && round <= 40) payload.round = round;
    const res = await exec<{ scheduled: number; firstAt: string; gapMinutes: number }>(
      "schedule",
      "esport.matches.schedule",
      payload,
    );
    if (res) {
      toast.success(
        `${res.scheduled} pertandingan dijadwalkan mulai ${fmtDT(res.firstAt)} (jeda ${res.gapMinutes} menit).`,
      );
    }
  };

  const toggleLive = async (match: EsportMatch) => {
    const back = ["live", "paused"].includes(match.status);
    const target = back ? "scheduled" : "live";
    const res = await exec<{ updated: boolean }>(`live-${match.id}`, "esport.matches.update", {
      matchId: match.id,
      status: target,
    });
    if (res) {
      toast.success(back ? "Pertandingan dikembalikan ke terjadwal." : "Pertandingan dimulai — status live.");
    }
  };

  const submitPause = async (match: EsportMatch, note: string) => {
    const res = await exec<{ status: string }>(`pause-${match.id}`, "esport.matches.pause", {
      matchId: match.id,
      note,
    });
    if (res) {
      toast.success("Pertandingan dijeda. Gunakan tombol Lanjutkan untuk melanjutkan.");
      setPauseMatch(null);
    }
  };

  const resumeMatch = async (match: EsportMatch) => {
    const res = await exec<{ status: string }>(`resume-${match.id}`, "esport.matches.resume", {
      matchId: match.id,
    });
    if (res) toast.success("Pertandingan dilanjutkan — status live.");
  };

  const submitWalkover = async (match: EsportMatch, winnerRegId: string) => {
    const res = await exec<{ winnerRegId: string; champion: string | null }>(
      `wo-${match.id}`,
      "esport.matches.walkover",
      { matchId: match.id, winnerRegId },
    );
    if (!res) return;
    const name = (regId: string | null) => data.registrations.find((r) => r.id === regId)?.teamName ?? "Tim";
    if (res.champion) toast.success(`Turnamen selesai! Juara: ${name(res.champion)}.`);
    else toast.success(`Walkover tersimpan. Pemenang: ${name(res.winnerRegId)}.`);
    setWalkoverMatch(null);
  };

  const submitAssign = async (match: EsportMatch, streamId: string) => {
    const res = await exec<{ assigned: boolean; streamUrl: string | null }>(
      `assign-${match.id}`,
      "esport.streams.assign",
      { id, streamId, matchId: match.id },
    );
    if (res) {
      const stream = data.streams.find((s) => s.id === streamId);
      toast.success(
        `Laga disiarkan di kanal "${stream?.name ?? "Siaran"}"${res.streamUrl ? "." : " — tautan tontonan menyusul."}`,
      );
      setStreamMatch(null);
    }
  };

  const submitEdit = async (match: EsportMatch, payload: Record<string, unknown>) => {
    const res = await exec<{ updated: boolean }>(`edit-${match.id}`, "esport.matches.update", payload);
    if (res) {
      toast.success("Detail pertandingan disimpan.");
      setEditMatch(null);
    }
  };

  const submitScore = async (match: EsportMatch, home: number, away: number) => {
    const res = await exec<{ finished: boolean; winnerRegId: string | null; champion: string | null }>(
      `score-${match.id}`,
      "esport.matches.score",
      { matchId: match.id, homeScore: home, awayScore: away },
    );
    if (!res) return;
    const name = (regId: string | null) => data.registrations.find((r) => r.id === regId)?.teamName ?? "Pemenang";
    if (res.champion) toast.success(`Turnamen selesai! Juara: ${name(res.champion)}.`);
    else toast.success(`Skor tersimpan. Pemenang: ${name(res.winnerRegId)}.`);
    setScoreMatch(null);
  };

  const submitGame = async (match: EsportMatch, payload: Record<string, unknown>) => {
    const res = await exec<{
      gameIndex: number;
      homeScore: number;
      awayScore: number;
      finished: boolean;
      champion: string | null;
    }>(`game-${match.id}`, "esport.matches.game.save", payload);
    if (!res) return;
    const name = (regId: string | null) => data.registrations.find((r) => r.id === regId)?.teamName ?? "Pemenang";
    if (res.champion) toast.success(`Turnamen selesai! Juara: ${name(res.champion)}.`);
    else if (res.finished) toast.success(`Seri selesai dengan skor ${res.homeScore}-${res.awayScore}.`);
    else toast.success(`Hasil Game ${res.gameIndex} tersimpan — skor sementara ${res.homeScore}-${res.awayScore}.`);
    setGamesMatch(null);
  };

  const submitBr = async (
    match: EsportMatch,
    results: { registrationId: string; placement: number; kills: number }[],
  ) => {
    const res = await exec<{ saved: number; winnerRegId: string | null; champion: string | null }>(
      `br-${match.id}`,
      "esport.matches.brResults",
      { matchId: match.id, results },
    );
    if (!res) return;
    const name = (regId: string | null) => data.registrations.find((r) => r.id === regId)?.teamName ?? "Tim";
    if (res.champion) toast.success(`Turnamen selesai! Juara: ${name(res.champion)}.`);
    else toast.success(`Hasil lobi tersimpan — juara lobi: ${name(res.winnerRegId)}.`);
    setBrMatch(null);
  };

  const teamNameOf = (regId: string) => data.registrations.find((r) => r.id === regId)?.teamName ?? "Tim";

  if (!matches.length) {
    return (
      <EmptyState
        icon={<CalendarDays className="size-6" aria-hidden />}
        title="Belum ada pertandingan"
        description="Buat bagan terlebih dahulu di tab Bagan, lalu atur jadwal pertandingan di sini."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-5" aria-hidden /> Atur Jadwal Massal
          </CardTitle>
          <CardDescription>Jadwalkan pertandingan otomatis berurutan dengan jeda antar pertandingan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="sched-at">Waktu Mulai Pertama</Label>
              <Input
                id="sched-at"
                type="datetime-local"
                value={schedAt}
                onChange={(e) => setSchedAt(e.target.value)}
                disabled={busy !== null}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-gap">Jeda (menit)</Label>
              <Input
                id="sched-gap"
                type="number"
                min={5}
                max={240}
                value={schedGap}
                onChange={(e) => setSchedGap(e.target.value)}
                disabled={busy !== null}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fase</Label>
              <Select value={schedStage} onValueChange={setSchedStage} disabled={busy !== null}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua fase</SelectItem>
                  {stageOptions.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {ESPORT_STAGE_LABEL[stage] ?? stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-round">Ronde (opsional)</Label>
              <Input
                id="sched-round"
                type="number"
                min={1}
                max={40}
                placeholder="Semua ronde"
                value={schedRound}
                onChange={(e) => setSchedRound(e.target.value)}
                disabled={busy !== null}
              />
            </div>
          </div>
          <Button className="gap-2" disabled={busy !== null || !schedAt} onClick={() => void runSchedule()}>
            {busy === "schedule" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CalendarClock className="size-4" aria-hidden />
            )}{" "}
            Terapkan Jadwal
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {MATCH_FILTERS.filter((key) => key === "all" || counts[key] > 0).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key)}
          >
            {key === "all" ? "Semua" : toneOf(ESPORT_MATCH_STATUS_META, key).label} ({counts[key]})
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((match) => (
          <MatchAdminCard
            key={match.id}
            match={match}
            busy={busy}
            lobbyTeams={match.stage === "lobby" ? activeRegs.length : undefined}
            teamNameOf={teamNameOf}
            onToggleLive={() => void toggleLive(match)}
            onPause={() => setPauseMatch(match)}
            onResume={() => void resumeMatch(match)}
            onWalkover={() => setWalkoverMatch(match)}
            onEdit={() => setEditMatch(match)}
            onStream={() => setStreamMatch(match)}
            onScore={() => (match.stage === "lobby" ? setBrMatch(match) : setScoreMatch(match))}
            onGames={() => setGamesMatch(match)}
          />
        ))}
        {!visible.length ? (
          <p className="text-sm text-muted-foreground">Tidak ada pertandingan dengan status ini.</p>
        ) : null}
      </div>

      <EditMatchDialog match={editMatch} busy={busy} onClose={() => setEditMatch(null)} onSubmit={submitEdit} />
      <ScoreDialog match={scoreMatch} busy={busy} onClose={() => setScoreMatch(null)} onSubmit={submitScore} />
      <GameDialog match={gamesMatch} busy={busy} onClose={() => setGamesMatch(null)} onSubmit={submitGame} />
      <BrResultsDialog match={brMatch} regs={activeRegs} busy={busy} onClose={() => setBrMatch(null)} onSubmit={submitBr} />
      <PauseMatchDialog match={pauseMatch} busy={busy} onClose={() => setPauseMatch(null)} onSubmit={submitPause} />
      <AssignStreamDialog
        match={streamMatch}
        streams={data.streams}
        busy={busy}
        onClose={() => setStreamMatch(null)}
        onSubmit={submitAssign}
      />
      <WalkoverDialog
        match={walkoverMatch}
        busy={busy}
        onClose={() => setWalkoverMatch(null)}
        onSubmit={submitWalkover}
      />
    </div>
  );
}

function ResolveDisputeDialog({
  dispute,
  match,
  busy,
  onClose,
  onSubmit,
}: {
  dispute: EsportDispute | null;
  match: EsportMatch | null;
  busy: string | null;
  onClose: () => void;
  onSubmit: (dispute: EsportDispute, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [decision, setDecision] = useState<"accepted" | "rejected">("accepted");
  const [resolution, setResolution] = useState("");
  const [applyScore, setApplyScore] = useState(false);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");

  useEffect(() => {
    if (!dispute) return;
    setDecision("accepted");
    setResolution("");
    setApplyScore(false);
    setHome(match?.homeScore === null || match?.homeScore === undefined ? "" : String(match.homeScore));
    setAway(match?.awayScore === null || match?.awayScore === undefined ? "" : String(match.awayScore));
  }, [dispute, match]);

  if (!dispute) return null;

  const canApply = Boolean(match && match.status === "finished" && match.homeRegId && match.awayRegId);
  const evidenceLinks = dispute.evidenceUrls.length
    ? dispute.evidenceUrls
    : dispute.evidenceUrl
      ? [dispute.evidenceUrl]
      : [];

  const submit = () => {
    if (resolution.trim().length < 3) {
      toast.error("Tuliskan hasil tinjauan minimal 3 karakter.");
      return;
    }
    const payload: Record<string, unknown> = { disputeId: dispute.id, decision, resolution: resolution.trim() };
    if (decision === "accepted" && applyScore && canApply) {
      payload.applyScore = { homeScore: Number(home), awayScore: Number(away) };
    }
    void onSubmit(dispute, payload);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tinjau Sengketa</DialogTitle>
          <DialogDescription>
            {dispute.matchLabel ?? "Pertandingan"} — diajukan oleh {dispute.filedByName || dispute.teamName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground">
            {dispute.reason}
          </div>
          {evidenceLinks.length ? (
            <div className="flex flex-wrap gap-2">
              {evidenceLinks.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-foreground hover:underline"
                >
                  <ExternalLink className="size-3.5" aria-hidden /> {evidenceLinks.length > 1 ? `Bukti ${i + 1}` : "Lihat Bukti"}
                </a>
              ))}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Keputusan</Label>
            <Select value={decision} onValueChange={(v) => setDecision(v as "accepted" | "rejected")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accepted">Terima sengketa</SelectItem>
                <SelectItem value="rejected">Tolak sengketa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dispute-resolution">Hasil Tinjauan</Label>
            <Textarea
              id="dispute-resolution"
              rows={3}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Jelaskan dasar keputusan untuk tim pelapor."
            />
          </div>
          {decision === "accepted" && canApply ? (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={applyScore}
                  onChange={(e) => setApplyScore(e.target.checked)}
                />
                Terapkan koreksi skor pertandingan
              </label>
              {applyScore ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dispute-home">{match?.homeTeam?.name ?? "Tim A"}</Label>
                    <Input
                      id="dispute-home"
                      type="number"
                      min={0}
                      max={99}
                      value={home}
                      onChange={(e) => setHome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dispute-away">{match?.awayTeam?.name ?? "Tim B"}</Label>
                    <Input
                      id="dispute-away"
                      type="number"
                      min={0}
                      max={99}
                      value={away}
                      onChange={(e) => setAway(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Koreksi skor otomatis memperbarui babak lanjutan. Proses ditolak sistem jika pertandingan babak
                berikutnya sudah selesai.
              </p>
            </div>
          ) : null}
          {decision === "accepted" && match && match.status !== "finished" ? (
            <p className="text-xs text-amber-700">
              Koreksi skor hanya tersedia untuk pertandingan yang sudah selesai.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button className="gap-2" disabled={busy !== null} onClick={submit}>
            {busy === `resolve-${dispute.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Gavel className="size-4" aria-hidden />
            )}{" "}
            Simpan Keputusan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisputesTab({ data, exec, busy }: { data: EsportTournamentDetail; exec: Exec; busy: string | null }) {
  const [active, setActive] = useState<EsportDispute | null>(null);

  const disputes = [...data.disputes].sort((a, b) => {
    const openDiff = Number(b.status === "open") - Number(a.status === "open");
    if (openDiff !== 0) return openDiff;
    return (b.createdAt ?? "") < (a.createdAt ?? "") ? -1 : 1;
  });

  const submitResolve = async (dispute: EsportDispute, payload: Record<string, unknown>) => {
    const res = await exec<{ status: string }>(`resolve-${dispute.id}`, "esport.disputes.resolve", payload);
    if (res) {
      toast.success(res.status === "resolved" ? "Sengketa diterima dan ditindaklanjuti." : "Sengketa ditolak.");
      setActive(null);
    }
  };

  const investigate = async (dispute: EsportDispute) => {
    const res = await exec<{ status: string }>(`investigate-${dispute.id}`, "esport.disputes.investigate", {
      disputeId: dispute.id,
    });
    if (res) toast.success("Sengketa masuk tahap investigasi.");
  };

  if (!disputes.length) {
    return (
      <EmptyState
        icon={<Gavel className="size-6" aria-hidden />}
        title="Tidak ada sengketa"
        description="Sengketa yang diajukan kapten tim akan muncul di sini untuk ditinjau."
      />
    );
  }

  const activeMatch = active ? data.matches.find((m) => m.id === active.matchId) ?? null : null;

  return (
    <div className="space-y-3">
      {disputes.map((dispute) => {
        const statusMeta = toneOf(ESPORT_DISPUTE_STATUS_META, dispute.status);
        const evidenceLinks = dispute.evidenceUrls.length
          ? dispute.evidenceUrls
          : dispute.evidenceUrl
            ? [dispute.evidenceUrl]
            : [];
        return (
          <div key={dispute.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{dispute.matchLabel ?? "Pertandingan"}</Badge>
                <span className="font-medium text-foreground">{dispute.teamName}</span>
                <span>oleh {dispute.filedByName}</span>
                <span>{fmtDT(dispute.createdAt)}</span>
              </div>
              <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
            </div>
            <p className="text-sm text-foreground">{dispute.reason}</p>
            {evidenceLinks.length ? (
              <div className="flex flex-wrap gap-2">
                {evidenceLinks.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent-foreground hover:underline"
                  >
                    <ExternalLink className="size-3.5" aria-hidden /> {evidenceLinks.length > 1 ? `Bukti ${i + 1}` : "Lihat Bukti"}
                  </a>
                ))}
              </div>
            ) : null}
            {dispute.resolution ? (
              <p className="rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                Keputusan: {dispute.resolution}
              </p>
            ) : null}
            {dispute.status === "open" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={busy !== null}
                  onClick={() => void investigate(dispute)}
                >
                  {busy === `investigate-${dispute.id}` ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Clock className="size-4" aria-hidden />
                  )}{" "}
                  Mulai Investigasi
                </Button>
                <Button size="sm" className="gap-1.5" disabled={busy !== null} onClick={() => setActive(dispute)}>
                  <Gavel className="size-4" aria-hidden /> Tinjau Sengketa
                </Button>
              </div>
            ) : null}
            {dispute.status === "investigating" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className="gap-1.5" disabled={busy !== null} onClick={() => setActive(dispute)}>
                  <Gavel className="size-4" aria-hidden /> Tinjau Sengketa
                </Button>
                <span className="text-xs text-muted-foreground">
                  Sedang diinvestigasi{dispute.investigatedAt ? ` sejak ${fmtDT(dispute.investigatedAt)}` : ""}.
                </span>
              </div>
            ) : null}
          </div>
        );
      })}

      <ResolveDisputeDialog
        dispute={active}
        match={activeMatch}
        busy={busy}
        onClose={() => setActive(null)}
        onSubmit={submitResolve}
      />
    </div>
  );
}

function CasterDialog({
  open,
  caster,
  matches,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  caster: EsportCaster | null;
  matches: EsportMatch[];
  busy: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [slot, setSlot] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState("main_caster");
  const [assigned, setAssigned] = useState("none");

  useEffect(() => {
    if (!open) return;
    setName(caster?.name ?? "");
    setSlot(caster?.slotLabel ?? "");
    setContact(caster?.contact ?? "");
    setRole(caster?.casterRole ?? "main_caster");
    setAssigned(caster?.assignedMatchId ?? "none");
  }, [open, caster]);

  const submit = () => {
    if (name.trim().length < 2) {
      toast.error("Nama caster minimal 2 karakter.");
      return;
    }
    void onSubmit({
      name: name.trim(),
      casterRole: role,
      slotLabel: slot.trim(),
      contact: contact.trim(),
      assignedMatchId: assigned === "none" ? null : assigned,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{caster ? "Ubah Slot Caster" : "Tambah Caster"}</DialogTitle>
          <DialogDescription>Catat komentator atau host dan tugaskan ke pertandingan tertentu.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="caster-name">Nama</Label>
            <Input
              id="caster-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama caster / host"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Peran Siaran</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASTER_ROLES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {ESPORT_CASTER_ROLE_META[key]?.label ?? key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ESPORT_CASTER_ROLE_META[role]?.hint}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="caster-slot">Slot</Label>
              <Input
                id="caster-slot"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                placeholder="Cth: Utama / Cadangan"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="caster-contact">Kontak</Label>
              <Input
                id="caster-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Nomor WA / akun"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pertandingan</Label>
            <Select value={assigned} onValueChange={setAssigned}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Belum ditugaskan</SelectItem>
                {matches.map((match) => (
                  <SelectItem key={match.id} value={match.id}>
                    {match.homeTeam?.name ?? "TBD"} vs {match.awayTeam?.name ?? "TBD"} — {matchLabel(match)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button className="gap-2" disabled={busy !== null} onClick={submit}>
            {busy === "caster-save" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}{" "}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CastersTab({
  id,
  data,
  exec,
  busy,
}: {
  id: string;
  data: EsportTournamentDetail;
  exec: Exec;
  busy: string | null;
}) {
  const [editing, setEditing] = useState<EsportCaster | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<EsportCaster | null>(null);

  const matchName = (matchId: string | null) => {
    if (!matchId) return "Belum ditugaskan";
    const match = data.matches.find((m) => m.id === matchId);
    if (!match) return "Pertandingan tidak ditemukan";
    return `${match.homeTeam?.name ?? "TBD"} vs ${match.awayTeam?.name ?? "TBD"} (${matchLabel(match)})`;
  };

  const remove = async (caster: EsportCaster) => {
    const res = await exec<{ deleted: boolean }>("caster-delete", "esport.casters.delete", { id: caster.id });
    if (res) {
      toast.success("Slot caster dihapus.");
      setDeleting(null);
    }
  };

  const save = async (caster: EsportCaster | null, payload: Record<string, unknown>) => {
    const body: Record<string, unknown> = { tournamentId: id, ...payload };
    if (caster) body.casterId = caster.id;
    const res = await exec<{ id: string }>("caster-save", "esport.casters.save", body);
    if (res) {
      toast.success("Slot caster disimpan.");
      setEditing(null);
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Slot caster untuk siaran — informasi ini tampil di halaman publik turnamen.
        </p>
        <Button size="sm" className="gap-2" disabled={busy !== null} onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden /> Tambah Caster
        </Button>
      </div>

      {data.casters.length ? (
        data.casters.map((caster) => (
          <div
            key={caster.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                <Mic className="size-4 text-muted-foreground" aria-hidden /> {caster.name}
                <Badge variant="secondary">
                  {ESPORT_CASTER_ROLE_META[caster.casterRole]?.label ?? caster.casterRole}
                </Badge>
                {caster.slotLabel ? <Badge variant="outline">{caster.slotLabel}</Badge> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {caster.contact ?? "Tanpa kontak"} · {matchName(caster.assignedMatchId)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busy !== null}
                onClick={() => setEditing(caster)}
              >
                <Pencil className="size-4" aria-hidden /> Ubah
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive hover:text-destructive"
                disabled={busy !== null}
                onClick={() => setDeleting(caster)}
              >
                <Trash2 className="size-4" aria-hidden /> Hapus
              </Button>
            </div>
          </div>
        ))
      ) : (
        <EmptyState
          icon={<Mic className="size-6" aria-hidden />}
          title="Belum ada slot caster"
          description="Tambahkan caster untuk mengelola pembagian siaran pertandingan."
        />
      )}

      <CasterDialog
        open={creating || Boolean(editing)}
        caster={editing}
        matches={data.matches}
        busy={busy}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={(payload) => save(editing, payload)}
      />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus slot caster?</DialogTitle>
            <DialogDescription>
              Slot caster untuk {deleting?.name ?? "ini"} akan dihapus dari turnamen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={busy !== null}
              onClick={() => deleting && void remove(deleting)}
            >
              {busy === "caster-delete" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}{" "}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StreamDialog({
  open,
  stream,
  matches,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  stream: EsportStream | null;
  matches: EsportMatch[];
  busy: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [url, setUrl] = useState("");
  const [active, setActive] = useState(true);
  const [currentMatch, setCurrentMatch] = useState("none");

  useEffect(() => {
    if (!open) return;
    setName(stream?.name ?? "");
    setPlatform(stream?.platform ?? "youtube");
    setUrl(stream?.url ?? "");
    setActive(stream ? stream.isActive : true);
    setCurrentMatch(stream?.currentMatchId ?? "none");
  }, [open, stream]);

  const submit = () => {
    if (name.trim().length < 2) {
      toast.error("Nama siaran minimal 2 karakter.");
      return;
    }
    void onSubmit({
      name: name.trim(),
      platform,
      url: url.trim(),
      isActive: active,
      currentMatchId: currentMatch === "none" ? null : currentMatch,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{stream ? "Ubah Siaran" : "Tambah Siaran"}</DialogTitle>
          <DialogDescription>
            Kanal siaran tampil di halaman publik turnamen — tandai yang sedang mengudara agar disorot LIVE.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="stream-name">Nama Siaran</Label>
              <Input
                id="stream-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth. Siaran Utama"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STREAM_PLATFORMS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {ESPORT_STREAM_PLATFORM_META[key]?.label ?? key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stream-url">URL Siaran</Label>
            <Input
              id="stream-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/live/..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pertandingan Saat Ini</Label>
            <Select value={currentMatch} onValueChange={setCurrentMatch}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak dipertandingkan</SelectItem>
                {matches.map((match) => (
                  <SelectItem key={match.id} value={match.id}>
                    {match.stage === "lobby"
                      ? `Lobi ${match.matchIndex}`
                      : `${match.homeTeam?.name ?? "TBD"} vs ${match.awayTeam?.name ?? "TBD"}`}{" "}
                    — {matchLabel(match)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch checked={active} onCheckedChange={setActive} disabled={busy !== null} />
            Tandai sedang mengudara (LIVE)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button className="gap-2" disabled={busy !== null} onClick={submit}>
            {busy === "stream-save" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}{" "}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StreamsTab({
  id,
  data,
  exec,
  busy,
}: {
  id: string;
  data: EsportTournamentDetail;
  exec: Exec;
  busy: string | null;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EsportStream | null>(null);
  const [deleting, setDeleting] = useState<EsportStream | null>(null);

  const matchName = (matchId: string | null) => {
    if (!matchId) return "Belum diarahkan ke pertandingan";
    const match = data.matches.find((m) => m.id === matchId);
    if (!match) return "Pertandingan tidak ditemukan";
    if (match.stage === "lobby") return `Lobi ${match.matchIndex} (${matchLabel(match)})`;
    return `${match.homeTeam?.name ?? "TBD"} vs ${match.awayTeam?.name ?? "TBD"} (${matchLabel(match)})`;
  };

  const remove = async (stream: EsportStream) => {
    const res = await exec<{ deleted: boolean }>("stream-delete", "esport.streams.delete", { id: stream.id });
    if (res) {
      toast.success("Kanal siaran dihapus.");
      setDeleting(null);
    }
  };

  const setup = async () => {
    const res = await exec<{ created: string[]; skipped: string[] }>("streams-setup", "esport.streams.setup", { id });
    if (res) {
      if (res.created.length) {
        toast.success(`Kanal standar disiapkan: ${res.created.join(", ")}.`);
      } else {
        toast.info("Semua kanal standar sudah tersedia.");
      }
    }
  };

  const save = async (stream: EsportStream | null, payload: Record<string, unknown>) => {
    const body: Record<string, unknown> = { tournamentId: id, ...payload };
    if (stream) body.streamId = stream.id;
    const res = await exec<{ id: string }>("stream-save", "esport.streams.save", body);
    if (res) {
      toast.success("Kanal siaran disimpan.");
      setEditing(null);
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Kanal siaran turnamen — tandai yang sedang mengudara agar tampil menonjol di halaman publik.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2" disabled={busy !== null} onClick={() => void setup()}>
            {busy === "streams-setup" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}{" "}
            Siapkan Kanal Standar
          </Button>
          <Button size="sm" className="gap-2" disabled={busy !== null} onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> Tambah Siaran
          </Button>
        </div>
      </div>

      {data.streams.length ? (
        data.streams.map((stream) => (
          <div
            key={stream.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                <Radio className="size-4 text-muted-foreground" aria-hidden /> {stream.name}
                <Badge variant="outline">
                  {ESPORT_STREAM_PLATFORM_META[stream.platform]?.label ?? stream.platform}
                </Badge>
                {stream.isActive ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-rose-600">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
                    </span>
                    LIVE
                  </span>
                ) : null}
              </p>
              <p className="min-w-0 text-xs text-muted-foreground">
                {stream.url ? (
                  <a href={stream.url} target="_blank" rel="noreferrer" className="break-all hover:underline">
                    {stream.url}
                  </a>
                ) : (
                  "Tanpa tautan"
                )}
                {" · "}
                {matchName(stream.currentMatchId)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busy !== null}
                onClick={() => setEditing(stream)}
              >
                <Pencil className="size-4" aria-hidden /> Ubah
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive hover:text-destructive"
                disabled={busy !== null}
                onClick={() => setDeleting(stream)}
              >
                <Trash2 className="size-4" aria-hidden /> Hapus
              </Button>
            </div>
          </div>
        ))
      ) : (
        <EmptyState
          icon={<Radio className="size-6" aria-hidden />}
          title="Belum ada kanal siaran"
          description="Tambahkan kanal siaran untuk menampilkan tautan tontonan di halaman publik turnamen."
        />
      )}

      <StreamDialog
        open={creating || Boolean(editing)}
        stream={editing}
        matches={data.matches}
        busy={busy}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={(payload) => save(editing, payload)}
      />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus kanal siaran?</DialogTitle>
            <DialogDescription>
              Kanal siaran {deleting?.name ?? "ini"} akan dihapus dari turnamen dan hilang dari halaman publik.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={busy !== null}
              onClick={() => deleting && void remove(deleting)}
            >
              {busy === "stream-delete" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}{" "}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PrizeRow {
  placement: number;
  label: string;
  amount: string;
}

function SettingsTab({
  id,
  data,
  exec,
  busy,
  canResetPrize,
}: {
  id: string;
  data: EsportTournamentDetail;
  exec: Exec;
  busy: string | null;
  canResetPrize: boolean;
}) {
  const t = data.tournament;
  const [form, setForm] = useState(() => ({
    title: t.title,
    description: t.description ?? "",
    rules: t.rules ?? "",
    streamUrl: t.streamUrl ?? "",
    maxTeams: String(t.maxTeams),
    rosterMin: String(t.rosterMin),
    rosterMax: String(t.rosterMax),
    bestOf: String(t.bestOf),
    entryFee: String(t.entryFee),
    checkinWindowMinutes: String(t.checkinWindowMinutes),
    registrationCloseAt: toLocalInputValue(t.registrationCloseAt),
    startAt: toLocalInputValue(t.startAt),
  }));
  const [prizes, setPrizes] = useState<PrizeRow[]>(() =>
    data.prizes.map((p) => ({ placement: p.placement, label: p.label, amount: String(p.amount) })),
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [prizeNote, setPrizeNote] = useState(t.prizePayoutNote ?? "");
  useEffect(() => {
    setPrizeNote(t.prizePayoutNote ?? "");
  }, [t.prizePayoutNote]);

  const prizeMeta = ESPORT_PRIZE_STATUS_META[t.prizeStatus ?? "pending"] ?? ESPORT_PRIZE_STATUS_META.pending;
  const nextPrize = NEXT_PRIZE[t.prizeStatus ?? "pending"];

  const update = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const addPrize = () => {
    setPrizes((prev) => {
      if (prev.length >= 10) return prev;
      const nextPlacement = Math.min(10, Math.max(0, ...prev.map((p) => p.placement)) + 1);
      return [...prev, { placement: nextPlacement, label: `Juara ${nextPlacement}`, amount: "" }];
    });
  };
  const updatePrize = (index: number, patch: Partial<PrizeRow>) =>
    setPrizes((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const removePrize = (index: number) => setPrizes((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    const title = form.title.trim();
    if (title.length < 4) {
      toast.error("Judul turnamen minimal 4 karakter.");
      return;
    }
    const maxTeams = Number(form.maxTeams);
    if (!Number.isInteger(maxTeams) || maxTeams < 2 || maxTeams > 64) {
      toast.error("Maksimal tim harus 2-64.");
      return;
    }
    const rosterMin = Number(form.rosterMin);
    const rosterMax = Number(form.rosterMax);
    if (
      !Number.isInteger(rosterMin) ||
      rosterMin < 1 ||
      rosterMin > 15 ||
      !Number.isInteger(rosterMax) ||
      rosterMax < 1 ||
      rosterMax > 15
    ) {
      toast.error("Batas roster harus 1-15.");
      return;
    }
    if (rosterMin > rosterMax) {
      toast.error("Roster minimal tidak boleh melebihi roster maksimal.");
      return;
    }
    const entryFee = Number(form.entryFee);
    if (!Number.isInteger(entryFee) || entryFee < 0) {
      toast.error("Biaya pendaftaran tidak valid.");
      return;
    }
    const checkin = Number(form.checkinWindowMinutes);
    if (!Number.isInteger(checkin) || checkin < 0 || checkin > 180) {
      toast.error("Jendela check-in harus 0-180 menit.");
      return;
    }

    const payload: Record<string, unknown> = {
      id,
      title,
      description: form.description.trim(),
      rules: form.rules.trim(),
      streamUrl: form.streamUrl.trim(),
      maxTeams,
      rosterMin,
      rosterMax,
      bestOf: Number(form.bestOf),
      entryFee,
      checkinWindowMinutes: checkin,
      registrationCloseAt: form.registrationCloseAt ? new Date(form.registrationCloseAt).toISOString() : "",
      startAt: form.startAt ? new Date(form.startAt).toISOString() : "",
      prizes: prizes.map((p) => ({
        placement: p.placement,
        label: p.label.trim(),
        amount: Number(p.amount.replace(/[^\d]/g, "") || 0),
      })),
    };
    const res = await exec<{ status: string }>("settings", "esport.tournaments.update", payload);
    if (res) toast.success("Pengaturan turnamen tersimpan.");
  };

  const advancePrize = async () => {
    if (!nextPrize) return;
    const res = await exec<{ status: string }>("prize-status", "esport.tournaments.prizeStatus", {
      id,
      status: nextPrize.next,
      note: prizeNote.trim() || undefined,
    });
    if (res) toast.success(`Status hadiah diperbarui: ${nextPrize.label.toLowerCase()}.`);
  };

  const resetPrize = async () => {
    const res = await exec<{ status: string }>("prize-status", "esport.tournaments.prizeStatus", {
      id,
      status: "pending",
    });
    if (res) toast.success("Status hadiah direset ke pending.");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Informasi Turnamen</CardTitle>
          <CardDescription>
            Game dan format turnamen tidak dapat diubah setelah dibuat. Status dikelola dari tab Ringkasan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="set-title">Judul Turnamen</Label>
            <Input id="set-title" value={form.title} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-description">Deskripsi</Label>
            <Textarea
              id="set-description"
              rows={3}
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-rules">Peraturan & Ketentuan</Label>
            <Textarea
              id="set-rules"
              rows={5}
              value={form.rules}
              onChange={(e) => update({ rules: e.target.value })}
              placeholder="Tuliskan peraturan turnamen yang akan dibaca peserta."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-stream">URL Live Streaming Utama</Label>
            <Input
              id="set-stream"
              value={form.streamUrl}
              onChange={(e) => update({ streamUrl: e.target.value })}
              placeholder="https://youtube.com/live/..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Peserta & Jadwal</CardTitle>
          <CardDescription>Batas tim, roster, biaya, dan jendela check-in pertandingan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="set-max">Maksimal Tim</Label>
              <Input
                id="set-max"
                type="number"
                min={2}
                max={64}
                value={form.maxTeams}
                onChange={(e) => update({ maxTeams: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-roster-min">Roster Minimal</Label>
              <Input
                id="set-roster-min"
                type="number"
                min={1}
                max={15}
                value={form.rosterMin}
                onChange={(e) => update({ rosterMin: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-roster-max">Roster Maksimal</Label>
              <Input
                id="set-roster-max"
                type="number"
                min={1}
                max={15}
                value={form.rosterMax}
                onChange={(e) => update({ rosterMax: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Best of Bawaan</Label>
              <Select value={form.bestOf} onValueChange={(v) => update({ bestOf: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESPORT_BEST_OF_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      Best of {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-fee">Biaya Pendaftaran (Rp)</Label>
              <Input
                id="set-fee"
                type="number"
                min={0}
                value={form.entryFee}
                onChange={(e) => update({ entryFee: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-checkin">Jendela Check-in (menit)</Label>
              <Input
                id="set-checkin"
                type="number"
                min={0}
                max={180}
                value={form.checkinWindowMinutes}
                onChange={(e) => update({ checkinWindowMinutes: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">0 = check-in nonaktif.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-reg-close">Pendaftaran Ditutup</Label>
              <Input
                id="set-reg-close"
                type="datetime-local"
                value={form.registrationCloseAt}
                onChange={(e) => update({ registrationCloseAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-start">Mulai Turnamen</Label>
              <Input
                id="set-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => update({ startAt: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hadiah</CardTitle>
          <CardDescription>Total hadiah dihitung otomatis dari daftar posisi di bawah (maksimal 10).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {prizes.map((prize, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min={1}
                max={10}
                value={prize.placement}
                onChange={(e) => updatePrize(index, { placement: Number(e.target.value) || 1 })}
                className="w-20"
                aria-label="Posisi hadiah"
              />
              <Input
                value={prize.label}
                onChange={(e) => updatePrize(index, { label: e.target.value })}
                placeholder="Nama hadiah"
                className="min-w-[10rem] flex-1"
                aria-label="Nama hadiah"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Rp</span>
                <Input
                  type="number"
                  min={0}
                  value={prize.amount}
                  onChange={(e) => updatePrize(index, { amount: e.target.value })}
                  className="w-36"
                  aria-label="Nominal hadiah"
                />
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => removePrize(index)}
                aria-label="Hapus baris hadiah"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={prizes.length >= 10}
              onClick={addPrize}
            >
              <Plus className="size-4" aria-hidden /> Tambah Posisi
            </Button>
            <span className="text-xs text-muted-foreground">
              Total: {formatRupiah(prizes.reduce((sum, p) => sum + (Number(p.amount.replace(/[^\d]/g, "")) || 0), 0))}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button className="gap-2" disabled={busy !== null} onClick={() => void save()}>
          {busy === "settings" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}{" "}
          Simpan Pengaturan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Banknote className="size-5" aria-hidden /> Pencairan Hadiah
            <Badge className={cn("border-transparent", prizeMeta.tone)}>{prizeMeta.label}</Badge>
          </CardTitle>
          <CardDescription>{prizeMeta.hint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Total hadiah: {formatRupiah(t.prizeTotal)}</span>
            {t.prizePaidAt ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <Check className="size-3.5" aria-hidden /> Dibayarkan {fmtDT(t.prizePaidAt)}
              </span>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-prize-note">Catatan Pencairan</Label>
            <Input
              id="set-prize-note"
              value={prizeNote}
              maxLength={300}
              placeholder="Contoh: transfer batch 1 untuk juara 1-3"
              onChange={(e) => setPrizeNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Catatan ikut tersimpan saat status hadiah diubah.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nextPrize ? (
              <Button className="gap-2" disabled={busy !== null} onClick={() => void advancePrize()}>
                {busy === "prize-status" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                {nextPrize.label}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Hadiah sudah selesai dibagikan kepada para juara.</p>
            )}
            {canResetPrize && t.prizeStatus !== "pending" ? (
              <Button
                variant="outline"
                className="gap-2"
                disabled={busy !== null}
                onClick={() => void resetPrize()}
              >
                <RefreshCw className="size-4" aria-hidden /> Reset ke Pending
              </Button>
            ) : null}
          </div>
          {canResetPrize ? (
            <p className="text-xs text-muted-foreground">
              Reset mengembalikan status ke pending dan menghapus waktu pembayaran — khusus admin.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Zona Berbahaya</CardTitle>
          <CardDescription>
            Membatalkan turnamen menghentikan seluruh aktivitas dan tidak dapat diurungkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            disabled={busy !== null || t.status === "completed" || t.status === "cancelled"}
            onClick={() => setCancelOpen(true)}
          >
            <XCircle className="size-4" aria-hidden /> Batalkan Turnamen
          </Button>
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan turnamen?</DialogTitle>
            <DialogDescription>
              Turnamen akan ditandai dibatalkan dan tidak dapat dilanjutkan lewat halaman ini.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Kembali
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={busy !== null}
              onClick={async () => {
                const res = await exec<{ status: string }>("cancel", "esport.tournaments.update", {
                  id,
                  status: "cancelled",
                });
                if (res) {
                  toast.success("Turnamen dibatalkan.");
                  setCancelOpen(false);
                }
              }}
            >
              {busy === "cancel" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <XCircle className="size-4" aria-hidden />
              )}{" "}
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type BudgetDraft = {
  key: string;
  category: EsportBudgetCategory;
  itemName: string;
  quantity: string;
  estimatedCost: string;
};

const BUDGET_CATEGORIES = Object.keys(ESPORT_BUDGET_CATEGORY_META) as EsportBudgetCategory[];

const toBudgetDraft = (item: {
  id: string;
  category: EsportBudgetCategory;
  itemName: string;
  quantity: number;
  estimatedCost: number;
}): BudgetDraft => ({
  key: item.id,
  category: item.category,
  itemName: item.itemName,
  quantity: String(item.quantity),
  estimatedCost: String(item.estimatedCost),
});

const budgetLineTotal = (item: BudgetDraft): number => {
  const quantity = Math.max(0, Math.round(Number(item.quantity) || 0));
  const cost = Math.max(0, Math.round(Number(item.estimatedCost) || 0));
  return quantity * cost;
};

function BudgetTab({ id, data, exec, busy }: { id: string; data: EsportTournamentDetail; exec: Exec; busy: string | null }) {
  const [items, setItems] = useState<BudgetDraft[]>(() => data.budgetItems.map(toBudgetDraft));
  const [dirty, setDirty] = useState(false);
  const [templateAsk, setTemplateAsk] = useState<EsportBudgetTemplate | null>(null);

  // Segarkan editor dari server setelah simpan/muat ulang agar tidak menampilkan data basi.
  useEffect(() => {
    setItems(data.budgetItems.map(toBudgetDraft));
    setDirty(false);
  }, [data.budgetItems]);

  const applyTemplate = (template: EsportBudgetTemplate) => {
    setItems(
      template.items.map((item, index) => ({
        key: `template-${template.key}-${index}`,
        category: item.category,
        itemName: item.itemName,
        quantity: String(item.quantity),
        estimatedCost: String(item.estimatedCost),
      })),
    );
    setDirty(true);
    toast.info(`Template "${template.name}" diterapkan — periksa rincian lalu simpan.`);
  };

  const requestTemplate = (template: EsportBudgetTemplate) => {
    if (items.length) {
      setTemplateAsk(template);
      return;
    }
    applyTemplate(template);
  };

  const update = (key: string, patch: Partial<BudgetDraft>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
    setDirty(true);
  };

  const totals = useMemo(() => {
    let all = 0;
    let prize = 0;
    for (const item of items) {
      const line = budgetLineTotal(item);
      all += line;
      if (item.category === "PRIZE_POOL") prize += line;
    }
    return { all, prize, operational: all - prize };
  }, [items]);

  const byCategory = useMemo(() => {
    const map = new Map<EsportBudgetCategory, number>();
    for (const item of items) {
      map.set(item.category, (map.get(item.category) ?? 0) + budgetLineTotal(item));
    }
    return [...map.entries()];
  }, [items]);

  const save = async () => {
    for (const item of items) {
      if (item.itemName.trim().length < 2) {
        toast.error("Setiap item butuh nama minimal 2 karakter.");
        return;
      }
      if (!((Math.round(Number(item.quantity) || 0)) >= 1)) {
        toast.error(`Kuantitas "${item.itemName}" minimal 1.`);
        return;
      }
      if ((Number(item.estimatedCost) || 0) < 0) {
        toast.error(`Biaya satuan "${item.itemName}" tidak valid.`);
        return;
      }
    }
    const res = await exec<{ count: number; totalEstimated: number }>("budget-save", "esport.budget.save", {
      id,
      items: items.map((item) => ({
        category: item.category,
        itemName: item.itemName.trim(),
        quantity: Math.round(Number(item.quantity) || 0),
        estimatedCost: Math.round(Number(item.estimatedCost) || 0),
      })),
    });
    if (res) toast.success(`Anggaran tersimpan — ${res.count} item, total ${formatRupiah(res.totalEstimated)}.`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-5" aria-hidden /> Template Anggaran
          </CardTitle>
          <CardDescription>
            Pilih skala turnamen untuk mengisi rincian otomatis — semua angka bisa disesuaikan sebelum disimpan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {ESPORT_BUDGET_TEMPLATES.map((template) => {
            const total = template.items.reduce((sum, item) => sum + item.quantity * item.estimatedCost, 0);
            const prize = template.items
              .filter((item) => item.category === "PRIZE_POOL")
              .reduce((sum, item) => sum + item.quantity * item.estimatedCost, 0);
            return (
              <div key={template.key} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">{template.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{template.hint}</p>
                </div>
                <p className="text-lg font-semibold">{formatRupiah(total)}</p>
                <p className="text-xs text-muted-foreground">
                  {template.items.length} item · hadiah {formatRupiah(prize)} + operasional {formatRupiah(total - prize)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-auto gap-1.5"
                  disabled={busy !== null}
                  onClick={() => requestTemplate(template)}
                >
                  <Sparkles className="size-4" aria-hidden /> Gunakan Template
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Wallet className="size-5" aria-hidden /> Rincian Anggaran
            <Badge className="border-transparent bg-secondary text-secondary-foreground">{items.length} item</Badge>
          </CardTitle>
          <CardDescription>Susun kebutuhan turnamen: hadiah, produksi, talent, pemasaran, panitia, dan lainnya.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <EmptyState
              icon={<Wallet className="size-6" aria-hidden />}
              title="Belum ada rincian anggaran"
              description="Mulai dari salah satu template di atas, atau tambah item satu per satu."
            />
          ) : (
            <>
              <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[10rem_minmax(0,1fr)_6rem_9rem_2.5rem]">
                <span>Kategori</span>
                <span>Nama item</span>
                <span>Kuantitas</span>
                <span>Biaya satuan (Rp)</span>
                <span />
              </div>
              {items.map((item) => (
                <div key={item.key} className="rounded-xl border border-border p-3">
                  <div className="grid gap-2 lg:grid-cols-[10rem_minmax(0,1fr)_6rem_9rem_2.5rem]">
                    <Select
                      value={item.category}
                      onValueChange={(value) => update(item.key, { category: value as EsportBudgetCategory })}
                    >
                      <SelectTrigger className="w-full" aria-label="Kategori anggaran">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUDGET_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {ESPORT_BUDGET_CATEGORY_META[category].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={item.itemName}
                      maxLength={120}
                      placeholder="Nama item"
                      aria-label="Nama item anggaran"
                      onChange={(event) => update(item.key, { itemName: event.target.value })}
                    />
                    <Input
                      type="number"
                      min={1}
                      max={9999}
                      value={item.quantity}
                      aria-label="Kuantitas"
                      onChange={(event) => update(item.key, { quantity: event.target.value })}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={item.estimatedCost}
                      aria-label="Biaya satuan rupiah"
                      onChange={(event) => update(item.key, { estimatedCost: event.target.value })}
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="justify-self-end text-destructive hover:text-destructive"
                      aria-label={`Hapus ${item.itemName || "item"}`}
                      onClick={() => {
                        setItems((current) => current.filter((row) => row.key !== item.key));
                        setDirty(true);
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Badge className={cn("border-transparent", ESPORT_BUDGET_CATEGORY_META[item.category]?.tone)}>
                      {ESPORT_BUDGET_CATEGORY_META[item.category]?.label ?? item.category}
                    </Badge>
                    <span>Subtotal: {formatRupiah(budgetLineTotal(item))}</span>
                  </div>
                </div>
              ))}
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={items.length >= 100}
              onClick={() => {
                setItems((current) => [
                  ...current,
                  { key: crypto.randomUUID(), category: "OTHER", itemName: "", quantity: "1", estimatedCost: "0" },
                ]);
                setDirty(true);
              }}
            >
              <Plus className="size-4" aria-hidden /> Tambah Item
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Anggaran</CardTitle>
          <CardDescription>Total dihitung otomatis dari kuantitas × biaya satuan setiap item.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Total estimasi</p>
              <p className="text-2xl font-semibold">{formatRupiah(totals.all)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hadiah</p>
              <p className="text-lg font-medium">{formatRupiah(totals.prize)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Operasional (di luar hadiah)</p>
              <p className="text-lg font-medium">{formatRupiah(totals.operational)}</p>
            </div>
          </div>
          {byCategory.length ? (
            <div className="flex flex-wrap gap-2">
              {byCategory.map(([category, total]) => (
                <span
                  key={category}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    ESPORT_BUDGET_CATEGORY_META[category]?.tone,
                  )}
                >
                  {ESPORT_BUDGET_CATEGORY_META[category]?.label ?? category}
                  <span className="font-semibold">{formatRupiah(total)}</span>
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Saat disimpan, "Anggaran operasional" pada data turnamen ikut diperbarui menjadi{" "}
            {formatRupiah(totals.operational)}.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button className="gap-2" disabled={busy !== null || !dirty} onClick={() => void save()}>
          {busy === "budget-save" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}{" "}
          Simpan Anggaran
        </Button>
        {dirty ? (
          <span className="text-xs font-medium text-amber-700">Ada perubahan yang belum disimpan.</span>
        ) : (
          <span className="text-xs text-muted-foreground">Rincian anggaran tersimpan.</span>
        )}
      </div>

      <Dialog
        open={Boolean(templateAsk)}
        onOpenChange={(open) => {
          if (!open) setTemplateAsk(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ganti rincian anggaran?</DialogTitle>
            <DialogDescription>
              Template "{templateAsk?.name}" akan menggantikan {items.length} item yang sedang ada di editor. Perubahan
              baru tersimpan setelah menekan Simpan Anggaran.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateAsk(null)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                if (templateAsk) applyTemplate(templateAsk);
                setTemplateAsk(null);
              }}
            >
              Ya, Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EsportManagePage({ id }: { id: string }) {
  const { account } = useAuth();
  const [data, setData] = useState<EsportTournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("ringkasan");
  const [busy, setBusy] = useState<string | null>(null);

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

  const exec = useCallback(
    async <T,>(key: string, action: string, payload: Record<string, unknown> = {}): Promise<T | null> => {
      setBusy(key);
      try {
        const res = await api<T>(action, payload);
        await load(true);
        return res;
      } catch (err) {
        toast.error(errorText(err));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  if (!account) {
    return (
      <AccountGate
        title="Masuk untuk mengelola turnamen"
        description="Halaman kelola turnamen hanya tersedia untuk penyelenggara."
        actionLabel="Masuk"
      />
    );
  }

  if (loading && !data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <LoadingGrid count={4} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <ErrorNote message={error ?? "Turnamen tidak ditemukan."} onRetry={() => void load()} />
      </div>
    );
  }

  const t = data.tournament;

  if (!t.canManage) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-rose-500" aria-hidden /> Akses Terbatas
            </CardTitle>
            <CardDescription>Hanya penyelenggara turnamen yang dapat membuka halaman kelola.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="gap-2" asChild>
              <Link to={`/kompetisi-esport/${id}`}>
                <ArrowLeft className="size-4" aria-hidden /> Kembali ke Detail Turnamen
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusMeta = toneOf(ESPORT_STATUS_META, t.status);
  const formatMeta = ESPORT_FORMAT_META[t.format];
  const openDisputes = data.disputes.filter((d) => d.status === "open").length;
  const liveCount = data.matches.filter((m) => m.status === "live").length;
  const activeStreams = data.streams.filter((s) => s.isActive).length;
  const canResetPrize = account ? (ROLE_RANK[account.role] ?? 0) >= 6 : false;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/kompetisi-esport/${id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Kembali ke halaman turnamen
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden /> Muat Ulang
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link to={`/kompetisi-esport/${id}`}>
              <ExternalLink className="size-4" aria-hidden /> Lihat Halaman Publik
            </Link>
          </Button>
        </div>
      </div>

      <PageBanner>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.18em] text-accent-foreground uppercase">
              <span aria-hidden>{data.game?.icon ?? "🎮"}</span>
              Konsol Penyelenggara
              {data.game?.name ? (
                <span className="font-normal normal-case opacity-80">· {data.game.name}</span>
              ) : null}
            </p>
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">{t.title}</h1>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
              <Badge variant="outline">{formatMeta?.label ?? t.format}</Badge>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3.5" aria-hidden /> {data.registrations.length}/{t.maxTeams} tim
              </span>
              {liveCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                  <Radio className="size-3.5" aria-hidden /> {liveCount} live
                </span>
              ) : null}
              {openDisputes > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Gavel className="size-3.5" aria-hidden /> {openDisputes} sengketa terbuka
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </PageBanner>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto! w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="ringkasan" className="gap-1.5">
            <LayoutDashboard className="size-4" aria-hidden /> Ringkasan
          </TabsTrigger>
          <TabsTrigger value="peserta" className="gap-1.5">
            <Users className="size-4" aria-hidden /> Peserta ({data.registrations.length})
          </TabsTrigger>
          <TabsTrigger value="bagan" className="gap-1.5">
            <Swords className="size-4" aria-hidden /> Bagan
          </TabsTrigger>
          <TabsTrigger value="pertandingan" className="gap-1.5">
            <CalendarDays className="size-4" aria-hidden /> Pertandingan ({data.matches.length})
          </TabsTrigger>
          <TabsTrigger value="sengketa" className="gap-1.5">
            <Gavel className="size-4" aria-hidden /> Sengketa{openDisputes ? ` (${openDisputes})` : ""}
          </TabsTrigger>
          <TabsTrigger value="caster" className="gap-1.5">
            <Mic className="size-4" aria-hidden /> Caster
          </TabsTrigger>
          <TabsTrigger value="siaran" className="gap-1.5">
            <Radio className="size-4" aria-hidden /> Siaran{activeStreams ? ` (${activeStreams})` : ""}
          </TabsTrigger>
          <TabsTrigger value="anggaran" className="gap-1.5">
            <Wallet className="size-4" aria-hidden /> Anggaran
          </TabsTrigger>
          <TabsTrigger value="pengaturan" className="gap-1.5">
            <ShieldCheck className="size-4" aria-hidden /> Pengaturan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan" className="mt-4">
          <SummaryTab id={id} data={data} exec={exec} busy={busy} />
        </TabsContent>
        <TabsContent value="peserta" className="mt-4">
          <TeamsTab data={data} exec={exec} busy={busy} />
        </TabsContent>
        <TabsContent value="bagan" className="mt-4">
          <BracketTab id={id} data={data} exec={exec} busy={busy} />
        </TabsContent>
        <TabsContent value="pertandingan" className="mt-4">
          <MatchesTab id={id} data={data} exec={exec} busy={busy} />
        </TabsContent>
        <TabsContent value="sengketa" className="mt-4">
          <DisputesTab data={data} exec={exec} busy={busy} />
        </TabsContent>
        <TabsContent value="caster" className="mt-4">
          <CastersTab id={id} data={data} exec={exec} busy={busy} />
        </TabsContent>
        <TabsContent value="siaran" className="mt-4">
          <StreamsTab id={id} data={data} exec={exec} busy={busy} />
        </TabsContent>
        <TabsContent value="anggaran" className="mt-4">
          <BudgetTab id={id} data={data} exec={exec} busy={busy} />
        </TabsContent>
        <TabsContent value="pengaturan" className="mt-4">
          <SettingsTab id={id} data={data} exec={exec} busy={busy} canResetPrize={canResetPrize} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
