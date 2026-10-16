import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Coins,
  Gamepad2,
  Handshake,
  Plus,
  Radio,
  RefreshCw,
  Swords,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { ESPORT_FORMAT_META, ESPORT_STATUS_META } from "@/lib/constants";
import { formatDateTime, formatRupiahCompact } from "@/lib/format";
import type { EsportGame, EsportTournamentStatus, EsportTournamentSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNote, EmptyState, LoadingGrid, PageBanner } from "@/components/common";
import { cn } from "@/lib/utils";

type StatusSection = "all" | "open" | "live" | "done";

const STATUS_SECTIONS: { id: StatusSection; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "open", label: "Pendaftaran Dibuka" },
  { id: "live", label: "Berlangsung" },
  { id: "done", label: "Selesai" },
];

function statusSectionOf(status: EsportTournamentStatus): StatusSection {
  if (status === "registration" || status === "draft") return "open";
  if (status === "bracket" || status === "ongoing") return "live";
  return "done";
}

export default function EsportHubPage() {
  const { account } = useAuth();
  const [games, setGames] = useState<EsportGame[]>([]);
  const [items, setItems] = useState<EsportTournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [section, setSection] = useState<StatusSection>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gamesRes, listRes] = await Promise.all([
        api<{ items: EsportGame[] }>("esport.games.list"),
        api<{ items: EsportTournamentSummary[] }>("esport.tournaments.list", {
          game: gameFilter === "all" ? undefined : gameFilter,
          mine: scope === "mine" ? true : undefined,
        }),
      ]);
      setGames(gamesRes.items);
      setItems(listRes.items);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [gameFilter, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (section === "all") return items;
    return items.filter((t) => statusSectionOf(t.status) === section);
  }, [items, section]);

  const countFor = useCallback(
    (id: StatusSection) =>
      id === "all" ? items.length : items.filter((t) => statusSectionOf(t.status) === id).length,
    [items],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <PageBanner>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-[0.18em] text-accent-foreground uppercase">Fitur Tersendiri</p>
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Kompetisi E-Sport</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ikuti atau selenggarakan turnamen game: daftarkan tim, bagan pertandingan otomatis, jadwal, skor
              langsung, hingga penentuan juara — semuanya dalam satu tempat.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/kompetisi-esport/tim">
                <Users className="size-4" aria-hidden />
                Tim Saya
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/kompetisi-esport/papan">
                <Trophy className="size-4" aria-hidden />
                Papan Peringkat
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/bursa-transfer">
                <Handshake className="size-4" aria-hidden />
                Bursa Transfer
              </Link>
            </Button>
            <Button asChild>
              <Link to="/kompetisi-esport/baru">
                <Plus className="size-4" aria-hidden />
                Buat Turnamen
              </Link>
            </Button>
          </div>
        </div>
      </PageBanner>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={scope === "all" ? "default" : "outline"}
          onClick={() => setScope("all")}
        >
          Semua Turnamen
        </Button>
        {account ? (
          <Button
            type="button"
            size="sm"
            variant={scope === "mine" ? "default" : "outline"}
            onClick={() => setScope("mine")}
          >
            Turnamen Saya
          </Button>
        ) : null}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
        {STATUS_SECTIONS.map((s) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            variant={section === s.id ? "secondary" : "ghost"}
            onClick={() => setSection(s.id)}
          >
            {s.label}
            <span className="ml-1 text-xs text-muted-foreground">{countFor(s.id)}</span>
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => void load()} aria-label="Muat ulang">
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setGameFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            gameFilter === "all"
              ? "border-orange-300 bg-orange-100 text-orange-800"
              : "border-border bg-background text-muted-foreground hover:bg-secondary",
          )}
        >
          Semua Game
        </button>
        {games.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => setGameFilter(game.slug)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              gameFilter === game.slug
                ? "border-orange-300 bg-orange-100 text-orange-800"
                : "border-border bg-background text-muted-foreground hover:bg-secondary",
            )}
          >
            <span className="mr-1" aria-hidden>
              {game.icon ?? "🎮"}
            </span>
            {game.name}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorNote message={error} onRetry={() => void load()} />
      ) : loading ? (
        <LoadingGrid count={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Gamepad2 className="size-5" aria-hidden />}
          title={scope === "mine" ? "Belum ada turnamen milik Anda" : "Belum ada turnamen di bagian ini"}
          description={
            scope === "mine"
              ? "Mulai selenggarakan turnamen: pilih game, tentukan format, lalu undang tim untuk mendaftar."
              : "Coba ubah filter game atau bagian status, atau buat turnamen baru untuk memulai."
          }
          action={
            <Button asChild>
              <Link to="/kompetisi-esport/baru">
                <Plus className="size-4" aria-hidden />
                Buat Turnamen
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => {
            const statusMeta = ESPORT_STATUS_META[t.status] ?? { label: t.status, tone: "bg-slate-100 text-slate-700" };
            const formatMeta = ESPORT_FORMAT_META[t.format];
            return (
              <Link key={t.id} to={`/kompetisi-esport/${t.id}`} className="group block min-w-0">
                <Card className="hover-lift h-full">
                  <CardContent className="flex h-full flex-col gap-3 pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-xl" aria-hidden>
                          {t.game?.icon ?? "🎮"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-display text-base font-semibold text-foreground group-hover:text-accent-foreground">
                            {t.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t.game?.name ?? "Game"} · {formatMeta?.short ?? t.format}
                          </p>
                        </div>
                      </div>
                      <Badge className={cn("shrink-0 border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden />
                        {t.teamCount}/{t.maxTeams} tim
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="size-3.5" aria-hidden />
                        {formatRupiahCompact(t.prizeTotal)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {t.entryFee > 0 ? (
                          <>
                            <Ticket className="size-3.5" aria-hidden />
                            {formatRupiahCompact(t.entryFee)}
                          </>
                        ) : (
                          <>
                            <Coins className="size-3.5" aria-hidden />
                            Gratis
                          </>
                        )}
                      </span>
                      {t.streamUrl ? (
                        <span className="inline-flex items-center gap-1 text-rose-600">
                          <Radio className="size-3.5" aria-hidden />
                          Live
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3.5" aria-hidden />
                        {t.status === "registration" || t.status === "draft"
                          ? `Daftar s.d. ${t.registrationCloseAt ? formatDateTime(t.registrationCloseAt) : "dibuka"}`
                          : `Mulai ${t.startAt ? formatDateTime(t.startAt) : "—"}`}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Swords className="size-3.5" aria-hidden />
                        {t.creatorName}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <Handshake className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Butuh pemain baru untuk tim Anda?</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Buka Bursa Transfer: cari pemain free agent, ajukan tawaran ke tim lain, atur pinjaman dengan opsi
                beli, dan kelola kontrak digital dengan escrow koin yang aman.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to="/bursa-transfer">
              <Handshake className="size-4" aria-hidden />
              Buka Bursa Transfer
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <Gamepad2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Punya komunitas game sendiri?</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Buat turnamen, atur format dan hadiah, lalu bagikan tautannya ke tim-tim peserta. Sistem akan
                menyusun bagan dan jadwal pertandingan secara otomatis.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to="/kompetisi-esport/baru">
              <Plus className="size-4" aria-hidden />
              Mulai Turnamen
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
