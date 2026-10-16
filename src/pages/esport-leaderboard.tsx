import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Coins,
  Crown,
  Gamepad2,
  Handshake,
  Medal,
  RefreshCw,
  Search,
  Swords,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { ESPORT_PLAYER_STATUS_META, ESPORT_TRANSFER_TYPE_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { EsportStatsBoard, EsportStatsPeriod, EsportStatsPlayerRow, EsportStatsTeamRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorNote, LoadingGrid, MemberAvatar } from "@/components/common";
import { cn } from "@/lib/utils";

type TabId = "tim" | "pemain" | "bursa" | "game";

const TABS: { id: TabId; label: string; icon: typeof Trophy }[] = [
  { id: "tim", label: "Peringkat Tim", icon: Trophy },
  { id: "pemain", label: "Peringkat Pemain", icon: Crown },
  { id: "bursa", label: "Bursa Transfer", icon: Handshake },
  { id: "game", label: "Statistik Game", icon: Gamepad2 },
];

const PERIODS: { id: EsportStatsPeriod; label: string }[] = [
  { id: "today", label: "Hari Ini" },
  { id: "week", label: "Minggu Ini" },
  { id: "all", label: "Keseluruhan" },
];

const PERIOD_HINT: Record<EsportStatsPeriod, string> = {
  today: "hari ini",
  week: "minggu ini",
  all: "",
};

const fmtKoin = (value: number | null | undefined): string => `${(value ?? 0).toLocaleString("id-ID")} koin`;

function RankChip({ rank, floating = false }: { rank: number; floating?: boolean }) {
  const tone =
    rank === 1
      ? "border-transparent bg-amber-400 text-amber-950"
      : rank === 2
        ? "border-transparent bg-slate-300 text-slate-800"
        : rank === 3
          ? "border-transparent bg-orange-400 text-orange-950"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold shadow-sm",
        tone,
        floating && "absolute -top-2 -left-2 size-6 border-2 border-card text-[11px]",
      )}
      aria-label={`Peringkat ${rank}`}
    >
      {rank}
    </span>
  );
}

function TeamMark({ name, tag, logo, size = "size-12", rounded = "rounded-2xl" }: { name: string; tag: string | null; logo: string | null; size?: string; rounded?: string }) {
  if (logo) {
    return <img src={logo} alt={name} className={cn("shrink-0 object-cover", size, rounded)} />;
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-orange-100 font-display text-sm font-semibold text-orange-700",
        size,
        rounded,
      )}
      aria-hidden
    >
      {((tag ?? name) || "TM").slice(0, 3).toUpperCase()}
    </span>
  );
}

function MarkRing({ mine, children }: { mine: boolean; children: ReactNode }) {
  if (!mine) return <>{children}</>;
  return <div className="rounded-2xl ring-2 ring-chart-1 ring-offset-2 ring-offset-card">{children}</div>;
}

function StatChip({ label, value, tone }: { label: string; value: ReactNode; tone?: "win" | "loss" | "accent" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold text-foreground",
          tone === "win" && "text-emerald-700",
          tone === "loss" && "text-rose-700",
          tone === "accent" && "text-orange-700",
        )}
      >
        {value}
      </span>
    </span>
  );
}

function ScoreCell({ points }: { points: number }) {
  return (
    <div className="ml-auto shrink-0 text-right">
      <p className="font-display text-xl font-bold text-chart-1">{points}</p>
      <p className="text-[11px] leading-none text-muted-foreground">poin</p>
    </div>
  );
}

function PodiumSlot({
  rank,
  name,
  subtitle,
  points,
  mine,
  mark,
}: {
  rank: 1 | 2 | 3;
  name: string;
  subtitle: ReactNode;
  points: number;
  mine: boolean;
  mark: ReactNode;
}) {
  const pedestal =
    rank === 1
      ? "from-amber-400/80 to-amber-500/60 h-14 sm:h-16"
      : rank === 2
        ? "from-slate-300/70 to-slate-400/50 h-9 sm:h-10"
        : "from-orange-400/70 to-orange-500/50 h-6 sm:h-7";
  return (
    <div className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-1 sm:max-w-36">
      {rank === 1 ? <Crown className="mb-0.5 size-6 text-amber-400" aria-hidden /> : null}
      <div className="relative">
        {mark}
        <RankChip rank={rank} floating />
        {mine ? (
          <span className="absolute -right-2 -bottom-1 rounded-full bg-chart-1 px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm">
            Kamu
          </span>
        ) : null}
      </div>
      <p className="w-full truncate text-center text-sm font-semibold text-foreground">{name}</p>
      <p className="w-full truncate text-center text-[11px] text-muted-foreground">{subtitle}</p>
      <p className="font-display text-2xl font-bold text-chart-1">{points}</p>
      <div className={cn("mt-1 w-full rounded-t-xl bg-gradient-to-b", pedestal)} aria-hidden />
    </div>
  );
}

function Podium({ entries, renderMark, subtitleOf, mineOf }: {
  entries: { id: string; name: string; points: number; rank: number }[];
  renderMark: (index: number) => ReactNode;
  subtitleOf: (index: number) => ReactNode;
  mineOf: (index: number) => boolean;
}) {
  if (entries.length === 0) return null;
  const ordered = [entries[1], entries[0], entries[2]].filter(Boolean);
  return (
    <div className="flex items-end justify-center gap-2 pt-4 sm:gap-6">
      {ordered.map((entry) => {
        const index = entry.rank - 1;
        return (
          <PodiumSlot
            key={entry.id}
            rank={entry.rank as 1 | 2 | 3}
            name={entry.name}
            subtitle={subtitleOf(index)}
            points={entry.points}
            mine={mineOf(index)}
            mark={renderMark(index)}
          />
        );
      })}
    </div>
  );
}

function MyPositionCard({ rank, name, subtitle, points, mark, pointsLabel = "poin" }: {
  rank: number;
  name: string;
  subtitle: ReactNode;
  points: number;
  mark: ReactNode;
  pointsLabel?: string;
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-chart-1 via-chart-2 to-chart-1 p-[2px]">
      <div className="flex flex-wrap items-center gap-3 rounded-[15px] bg-card p-3">
        <RankChip rank={rank} />
        {mark}
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate font-display font-semibold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-xl font-bold text-chart-1">{points}</p>
          <p className="text-[11px] leading-none text-muted-foreground">{pointsLabel}</p>
        </div>
      </div>
    </div>
  );
}

function NotOnBoardHint({ tab }: { tab: "tim" | "pemain" }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
      {tab === "tim" ? (
        <>
          Tim kamu belum tercatat di periode ini.{" "}
          <Link to="/kompetisi-esport" className="font-semibold text-chart-1 underline-offset-2 hover:underline">
            Ikuti turnamen
          </Link>{" "}
          agar timmu tampil di papan peringkat.
        </>
      ) : (
        <>
          Kamu belum tercatat bermain di periode ini.{" "}
          <Link to="/kompetisi-esport" className="font-semibold text-chart-1 underline-offset-2 hover:underline">
            Lihat turnamen yang membuka pendaftaran
          </Link>
          .
        </>
      )}
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            {icon}
          </span>
          <CardTitle className="font-display text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export default function EsportLeaderboardPage() {
  const { account } = useAuth();
  const [tab, setTab] = useState<TabId>("tim");
  const [period, setPeriod] = useState<EsportStatsPeriod>("all");
  const [board, setBoard] = useState<EsportStatsBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [playerGameFilter, setPlayerGameFilter] = useState("all");
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  const load = useCallback(async (p: EsportStatsPeriod, showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await api<EsportStatsBoard>("esport.stats", { period: p });
      setBoard(res);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(period, true);
  }, [load, period]);

  const playerGames = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of board?.players ?? []) {
      if (p.game && !seen.has(p.game.id)) seen.set(p.game.id, p.game.name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [board]);

  const visiblePlayers = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (board?.players ?? []).filter((p) => {
      if (playerGameFilter !== "all" && p.game?.id !== playerGameFilter) return false;
      if (!term) return true;
      const haystack = [p.name, p.nickname, p.ign, p.team?.name, p.team?.tag]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [board, q, playerGameFilter]);

  const counts: Record<TabId, number> = {
    tim: board?.teams.length ?? 0,
    pemain: board?.players.length ?? 0,
    bursa: board ? board.market.topTransfers.length : 0,
    game: board ? board.games.filter((g) => g.tournaments > 0 || g.matches > 0 || g.teams > 0).length : 0,
  };

  const myTeamIndex = useMemo(
    () => (account ? (board?.teams ?? []).findIndex((t) => t.captainId === account.id) : -1),
    [board, account],
  );
  const myPlayerIndex = useMemo(
    () => (account ? (board?.players ?? []).findIndex((p) => p.accountId === account.id) : -1),
    [board, account],
  );

  // Podium selalu memakai peringkat global; pencarian hanya memfilter daftar di bawahnya.
  const playerRows = useMemo(() => {
    const all = board?.players ?? [];
    const globalRank = new Map(all.map((p, i) => [p.accountId, i + 1]));
    return visiblePlayers
      .filter((p) => (globalRank.get(p.accountId) ?? 0) > 3)
      .map((p) => ({ player: p, rank: globalRank.get(p.accountId) ?? 0 }));
  }, [visiblePlayers, board]);

  const teamSubtitle = (team: EsportStatsTeamRow) => (
    <>
      {team.tournaments} turnamen diikuti
      {team.championships > 0 ? (
        <span className="text-amber-600"> · {team.championships} juara</span>
      ) : null}
    </>
  );

  const playerSubtitle = (player: EsportStatsPlayerRow) => (
    <>
      {player.team ? player.team.name : "Tanpa tim"}
      {player.game ? ` · ${player.game.name}` : ""}
    </>
  );

  const periodAwareEmpty = (base: string, hint: string) =>
    PERIOD_HINT[period] ? `${base} ${PERIOD_HINT[period]}. ${hint}` : `${base}. ${hint}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-chart-1/15 via-card to-chart-2/15 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-chart-1/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-chart-2/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Fitur Tersendiri</p>
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Papan Peringkat E-Sport</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Rekam jejak lintas turnamen: peringkat tim dan pemain dari seluruh kompetisi, sorotan bursa transfer
              beserta nilai pasarnya, hingga statistik per game — semua dihitung otomatis dari hasil pertandingan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/kompetisi-esport">
                <Trophy className="size-4" aria-hidden />
                Kompetisi E-Sport
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/bursa-transfer">
                <Handshake className="size-4" aria-hidden />
                Bursa Transfer
              </Link>
            </Button>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Periode peringkat">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "relative rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                  period === p.id
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
                {period === p.id ? (
                  <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-chart-1" aria-hidden />
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <p className="hidden text-[11px] text-muted-foreground sm:block">Poin: menang +3 · bermain +1</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void load(period, false)}
              aria-label="Muat ulang"
            >
              <RefreshCw className={cn("size-4", (loading || refreshing) && "animate-spin")} aria-hidden />
            </Button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => setTab(t.id)}
            >
              <Icon className="size-4" aria-hidden />
              {t.label}
              {counts[t.id] > 0 ? (
                <span className={cn("ml-1 text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {counts[t.id]}
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>

      {loading ? (
        <LoadingGrid count={6} />
      ) : error ? (
        <ErrorNote message={error} onRetry={() => void load(period, true)} />
      ) : !board ? null : tab === "tim" ? (
        board.teams.length === 0 ? (
          <EmptyState
            icon={<Trophy className="size-5" aria-hidden />}
            title="Belum ada tim bertanding"
            description={periodAwareEmpty(
              "Belum ada tim bertanding",
              "Coba periode Keseluruhan untuk melihat rekor penuh.",
            )}
          />
        ) : (
          <div className="flex flex-col gap-5">
            <Card className="overflow-hidden">
              <CardContent className="px-3 pt-2 pb-4 sm:px-6">
                <Podium
                  entries={board.teams.slice(0, 3).map((t, i) => ({
                    id: t.teamId,
                    name: t.name,
                    points: t.points,
                    rank: i + 1,
                  }))}
                  renderMark={(i) => {
                    const team = board.teams[i];
                    return (
                      <MarkRing mine={!!account && team.captainId === account.id}>
                        <TeamMark
                          name={team.name}
                          tag={team.tag}
                          logo={team.logo}
                          size={i === 0 ? "size-16" : "size-14"}
                        />
                      </MarkRing>
                    );
                  }}
                  subtitleOf={(i) => teamSubtitle(board.teams[i])}
                  mineOf={(i) => !!account && board.teams[i].captainId === account.id}
                />
              </CardContent>
            </Card>

            {myTeamIndex >= 0 ? (
              <MyPositionCard
                rank={myTeamIndex + 1}
                name={`Posisi saya · ${board.teams[myTeamIndex].name}`}
                subtitle={teamSubtitle(board.teams[myTeamIndex])}
                points={board.teams[myTeamIndex].points}
                mark={
                  <TeamMark
                    name={board.teams[myTeamIndex].name}
                    tag={board.teams[myTeamIndex].tag}
                    logo={board.teams[myTeamIndex].logo}
                    size="size-10"
                  />
                }
              />
            ) : account ? (
              <NotOnBoardHint tab="tim" />
            ) : null}

            {board.teams.length > 3 ? (
              <div className="flex flex-col gap-3">
                {board.teams.slice(3).map((team, index) => (
                  <Card key={team.teamId} className="hover-lift min-w-0">
                    <CardContent className="flex flex-wrap items-center gap-3">
                      <RankChip rank={index + 4} />
                      <TeamMark name={team.name} tag={team.tag} logo={team.logo} />
                      <div className="min-w-0 flex-1 basis-44">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-display font-semibold text-foreground">{team.name}</span>
                          {team.tag ? <Badge variant="secondary">{team.tag}</Badge> : null}
                          {account && team.captainId === account.id ? (
                            <Badge className="border-transparent bg-chart-1 text-primary-foreground">Tim saya</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {team.tournaments} turnamen · {team.matches} laga · {team.wins}M {team.losses}K ·{" "}
                          {team.matches ? `${team.winRate}%` : "–"} rasio
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {team.championships > 0 ? (
                          <Badge className="border-transparent bg-amber-100 text-amber-900">
                            <Trophy className="mr-1 size-3" aria-hidden />
                            {team.championships} juara
                          </Badge>
                        ) : null}
                        <StatChip label="M" value={team.wins} tone="win" />
                        <StatChip label="K" value={team.losses} tone="loss" />
                      </div>
                      <ScoreCell points={team.points} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        )
      ) : tab === "pemain" ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama pemain, IGN, atau tim…"
                className="pl-9"
                aria-label="Cari pemain"
              />
            </div>
            <Select value={playerGameFilter} onValueChange={setPlayerGameFilter}>
              <SelectTrigger className="w-48" aria-label="Filter game">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Game</SelectItem>
                {playerGames.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visiblePlayers.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" aria-hidden />}
              title="Tidak ada pemain ditemukan"
              description={periodAwareEmpty(
                "Tidak ada pemain ditemukan",
                "Ubah kata kunci atau filter game untuk melihat pemain lain.",
              )}
            />
          ) : (
            <>
              <Card className="overflow-hidden">
                <CardContent className="px-3 pt-2 pb-4 sm:px-6">
                  <Podium
                    entries={board.players.slice(0, 3).map((p, i) => ({
                      id: p.accountId,
                      name: p.name,
                      points: p.points,
                      rank: i + 1,
                    }))}
                    renderMark={(i) => {
                      const player = board.players[i];
                      return (
                        <MarkRing mine={!!account && player.accountId === account.id}>
                          <MemberAvatar
                            name={player.name}
                            size={i === 0 ? 64 : 54}
                            photoData={player.photoData}
                          />
                        </MarkRing>
                      );
                    }}
                    subtitleOf={(i) => playerSubtitle(board.players[i])}
                    mineOf={(i) => !!account && board.players[i].accountId === account.id}
                  />
                </CardContent>
              </Card>

              {myPlayerIndex >= 0 ? (
                <MyPositionCard
                  rank={myPlayerIndex + 1}
                  name={`Posisi saya · ${board.players[myPlayerIndex].name}`}
                  subtitle={playerSubtitle(board.players[myPlayerIndex])}
                  points={board.players[myPlayerIndex].points}
                  mark={
                    <MemberAvatar
                      name={board.players[myPlayerIndex].name}
                      size={40}
                      photoData={board.players[myPlayerIndex].photoData}
                    />
                  }
                />
              ) : account ? (
                <NotOnBoardHint tab="pemain" />
              ) : null}

              {playerRows.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {(showAllPlayers ? playerRows : playerRows.slice(0, 20)).map(({ player, rank }) => {
                    const statusMeta = player.status ? ESPORT_PLAYER_STATUS_META[player.status] : null;
                    return (
                      <Card key={player.accountId} className="hover-lift min-w-0">
                        <CardContent className="flex flex-wrap items-center gap-3">
                          <RankChip rank={rank} />
                          <MemberAvatar name={player.name} size={44} photoData={player.photoData} />
                          <div className="min-w-0 flex-1 basis-44">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-display font-semibold text-foreground">{player.name}</span>
                              {player.ign ? <span className="text-xs text-muted-foreground">@{player.ign}</span> : null}
                              {account && player.accountId === account.id ? (
                                <Badge className="border-transparent bg-chart-1 text-primary-foreground">Saya</Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {player.game ? (
                                <span>
                                  {player.game.icon ?? "🎮"} {player.game.name}
                                </span>
                              ) : null}
                              <span>
                                {player.team ? `${player.team.name}${player.team.tag ? ` (${player.team.tag})` : ""}` : "Tanpa tim"}
                              </span>
                              <span>
                                {player.matches} laga · {player.wins}M {player.losses}K ·{" "}
                                {player.matches ? `${player.winRate}%` : "–"} rasio
                              </span>
                              {statusMeta ? (
                                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", statusMeta.tone)}>
                                  {statusMeta.label}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {player.championships > 0 ? (
                              <Badge className="border-transparent bg-amber-100 text-amber-900">
                                <Trophy className="mr-1 size-3" aria-hidden />
                                {player.championships} juara
                              </Badge>
                            ) : null}
                            {player.value > 0 ? <StatChip label="Nilai" value={fmtKoin(player.value)} tone="accent" /> : null}
                          </div>
                          <ScoreCell points={player.points} />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : null}

              {playerRows.length > 20 ? (
                <div className="flex justify-center">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAllPlayers((v) => !v)}>
                    {showAllPlayers ? "Tampilkan lebih ringkas" : `Tampilkan semua (${playerRows.length})`}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : tab === "bursa" ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                { label: "Transfer Selesai", value: board.market.summary.completedTransfers },
                { label: "Volume Koin", value: fmtKoin(board.market.summary.volumeCoins) },
                { label: "Listing Terbuka", value: board.market.summary.openListings },
                { label: "Tawaran Pending", value: board.market.summary.pendingOffers },
                { label: "Free Agent", value: board.market.summary.freeAgents },
                { label: "Pinjaman Aktif", value: board.market.summary.activeLoans },
              ] as { label: string; value: string | number }[]
            ).map((item) => (
              <Card key={item.label} className="min-w-0">
                <CardContent className="space-y-1">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-display text-lg font-semibold text-foreground">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <SectionCard icon={<TrendingUp className="size-5" aria-hidden />} title="Transfer Termahal">
            {board.market.topTransfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {periodAwareEmpty(
                  "Belum ada transfer tuntas",
                  "Riwayat akan muncul di sini setelah ada transfer yang selesai.",
                )}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {board.market.topTransfers.map((tr) => {
                  const typeMeta = ESPORT_TRANSFER_TYPE_META[tr.transferType];
                  return (
                    <div key={tr.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3">
                      <MemberAvatar name={tr.player?.name ?? "Pemain"} size={40} photoData={tr.player?.photoData ?? null} />
                      <div className="min-w-0 flex-1 basis-40">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-foreground">{tr.player?.name ?? "Pemain"}</span>
                          <span className="text-xs text-muted-foreground">{tr.player?.ign ? `@${tr.player.ign}` : ""}</span>
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", typeMeta?.tone ?? "bg-slate-100 text-slate-700")}>
                            {typeMeta?.short ?? tr.transferType}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {tr.fromTeam ? tr.fromTeam.name : "Free Agent"}
                          {" → "}
                          {tr.toTeam ? tr.toTeam.name : "-"}
                          {tr.completedAt ? ` · ${formatDateTime(tr.completedAt)}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-display font-semibold text-chart-1">
                        {tr.fee > 0 ? fmtKoin(tr.fee) : "Gratis"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard icon={<Coins className="size-5" aria-hidden />} title="Pembelanja Teratas">
              {board.market.topSpenders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada pembelian bernilai koin. Tim pertama yang menuntaskan transfer berbayar akan memimpin di sini.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {board.market.topSpenders.map((sp, index) => (
                    <div key={sp.team?.id ?? index} className="flex flex-wrap items-center gap-3">
                      <RankChip rank={index + 1} />
                      <TeamMark
                        name={sp.team?.name ?? "Tim"}
                        tag={sp.team?.tag ?? null}
                        logo={sp.team?.logo ?? null}
                        size="size-9"
                        rounded="rounded-xl"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{sp.team?.name ?? "Tim"}</span>
                      <span className="text-xs text-muted-foreground">{sp.transfers} transfer</span>
                      <span className="font-display font-semibold text-chart-1">{fmtKoin(sp.spent)}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard icon={<Medal className="size-5" aria-hidden />} title="Pemain Paling Bernilai">
              {board.market.topValuables.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pemain dengan harga pasar — listing aktif akan tampil di sini.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {board.market.topValuables.map((p, index) => (
                    <div key={p.accountId} className="flex flex-wrap items-center gap-3">
                      <RankChip rank={index + 1} />
                      <MemberAvatar name={p.name} size={36} photoData={p.photoData} />
                      <div className="min-w-0 flex-1 basis-32">
                        <p className="truncate font-medium text-foreground">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.team ? p.team.name : "Tanpa tim"}
                          {p.ign ? ` · @${p.ign}` : ""}
                        </p>
                      </div>
                      <span className="font-display font-semibold text-chart-1">{fmtKoin(p.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {board.games.map((g) => {
            const idle = g.tournaments === 0 && g.matches === 0 && g.teams === 0;
            return (
              <Card key={g.gameId} className={cn("hover-lift h-full min-w-0", idle && "opacity-70")}>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-xl" aria-hidden>
                        {g.icon ?? "🎮"}
                      </span>
                      <CardTitle className="min-w-0 truncate font-display text-lg">{g.name}</CardTitle>
                    </div>
                    {g.activeTournaments > 0 ? (
                      <Badge className="border-transparent bg-emerald-100 text-emerald-800">
                        <Swords className="mr-1 size-3" aria-hidden />
                        {g.activeTournaments} aktif
                      </Badge>
                    ) : (
                      <Badge className="border-transparent bg-slate-100 text-slate-600">Tidak ada turnamen aktif</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <StatChip label="Turnamen" value={g.tournaments} />
                  <StatChip label="Tim" value={g.teams} />
                  <StatChip label="Laga" value={g.matches} />
                  <StatChip label="Pemain" value={g.players} />
                  <StatChip label="Listing" value={g.listings} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
