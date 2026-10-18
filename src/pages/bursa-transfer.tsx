import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  Briefcase,
  CalendarClock,
  Check,
  Clock,
  Coins,
  Gamepad2,
  Handshake,
  Loader2,
  Megaphone,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
  XCircle,
  CreditCard,
} from "lucide-react";
import { SEO } from "@/components/seo";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import {
  ESPORT_CONTRACT_STATUS_META,
  ESPORT_CONTRACT_TYPE_META,
  ESPORT_LISTING_STATUS_META,
  ESPORT_OFFER_STATUS_META,
  ESPORT_PLAYER_STATUS_META,
  ESPORT_TRANSFER_FEE_MAX,
  ESPORT_TRANSFER_STATUS_META,
  ESPORT_TRANSFER_TYPE_META,
  ESPORT_WINDOW_STATUS_META,
  ROLE_RANK,
} from "@/lib/constants";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";
import type {
  EsportGame,
  EsportManagedWindow,
  EsportMyContract,
  EsportMyOffer,
  EsportPlayerCard,
  EsportPlayerDetail,
  EsportPlayerReview,
  EsportPlayerReviewSummary,
  EsportPlayerStats,
  EsportRosterHistory,
  EsportTeam,
  EsportTransfer,
  EsportTransferAnnouncement,
  EsportTransferDispute,
  EsportTransferListing,
  EsportTransferMy,
} from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";
import { AccountGate, EmptyState, ErrorNote, LoadingGrid, MemberAvatar, PageBanner } from "@/components/common";
import { PlayerStatsCard } from "@/components/esport/player-stats-card";
import { PlayerReviewsPanel } from "@/components/esport/player-reviews-panel";
import { RosterHistoryTimeline } from "@/components/esport/roster-history-timeline";
import { TransferDisputesPanel } from "@/components/esport/transfer-disputes-panel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TabId = "pasar" | "pemain" | "kabar" | "saya" | "jendela";

const TABS: { id: TabId; label: string; icon: typeof ShoppingBag }[] = [
  { id: "pasar", label: "Pasar Transfer", icon: ShoppingBag },
  { id: "pemain", label: "Pemain", icon: Users },
  { id: "kabar", label: "Kabar Transfer", icon: Newspaper },
  { id: "saya", label: "Bursa Saya", icon: Briefcase },
  { id: "jendela", label: "Jendela Transfer", icon: CalendarClock },
];

const LISTING_FILTERS = ["open", "paused", "completed"] as const;

const PLAYER_FILTERS = ["all", "free_agent", "contracted", "on_loan", "retired"] as const;

const fmtKoin = (value: number | null | undefined): string => `${(value ?? 0).toLocaleString("id-ID")} koin`;

const toneOf = (map: Record<string, { label: string; tone: string }>, key: string) =>
  map[key] ?? { label: key, tone: "bg-slate-100 text-slate-700" };

const numOrNull = (value: string): number | null => {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

const jakartaDateInput = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(
        new Date(iso),
      )
    : "";

function InfoChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}

function OpenWindowBadge({ open, name }: { open: boolean; name: string | null }) {
  return open ? (
    <Badge className="border-transparent bg-emerald-100 text-emerald-800">
      <CalendarClock className="mr-1 size-3" aria-hidden />
      {name ? `Jendela: ${name}` : "Jendela terbuka"}
    </Badge>
  ) : (
    <Badge className="border-transparent bg-slate-100 text-slate-600">
      <CalendarClock className="mr-1 size-3" aria-hidden />
      Jendela ditutup
    </Badge>
  );
}

function SectionCard({ icon, title, description, action, children }: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              {icon}
            </span>
            <div className="min-w-0">
              <CardTitle className="font-display text-lg">{title}</CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export default function BursaTransferPage() {
  const { account } = useAuth();
  const rank = account ? (ROLE_RANK[account.role] ?? 0) : 0;

  const [tab, setTab] = useState<TabId>("pasar");
  const [games, setGames] = useState<EsportGame[]>([]);
  const [myTeams, setMyTeams] = useState<EsportTeam[]>([]);
  const [gameFilter, setGameFilter] = useState("all");
  const [q, setQ] = useState("");
  const [listingFilter, setListingFilter] = useState<string>("open");
  const [playerFilter, setPlayerFilter] = useState<string>("all");
  const [listings, setListings] = useState<EsportTransferListing[]>([]);
  const [players, setPlayers] = useState<EsportPlayerCard[]>([]);
  const [news, setNews] = useState<EsportTransferAnnouncement[]>([]);
  const [mine, setMine] = useState<EsportTransferMy | null>(null);
  const [windows, setWindows] = useState<EsportManagedWindow[]>([]);
  const [canManageWindows, setCanManageWindows] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState<{ profile: EsportPlayerCard | null } | null>(null);
  const [agentFor, setAgentFor] = useState<EsportPlayerCard | null>(null);
  const [listingForm, setListingForm] = useState<{ player: EsportPlayerCard; listing: EsportTransferListing | null } | null>(null);
  const [offerFor, setOfferFor] = useState<EsportTransferListing | null>(null);
  const [counterFor, setCounterFor] = useState<EsportMyOffer | null>(null);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [cancelFor, setCancelFor] = useState<EsportTransfer | null>(null);
  const [disputeFor, setDisputeFor] = useState<EsportTransfer | null>(null);
  const [disputes, setDisputes] = useState<EsportTransferDispute[]>([]);
  const [windowForm, setWindowForm] = useState<{ window: EsportManagedWindow | null } | null>(null);
  const [windowDelete, setWindowDelete] = useState<EsportManagedWindow | null>(null);

  const gameIdFilter = gameFilter === "all" ? undefined : gameFilter;
  const captainTeams = useMemo(() => myTeams.filter((t) => t.isCaptain || rank >= 6), [myTeams, rank]);
  const myListingIds = useMemo(() => new Set((mine?.listings ?? []).map((l) => l.id)), [mine]);

  const loadBase = useCallback(async () => {
    try {
      const [gamesRes, teamsRes] = await Promise.all([
        api<{ items: EsportGame[] }>("esport.games.list"),
        api<{ items: EsportTeam[] }>("esport.teams.mine"),
      ]);
      setGames(gamesRes.items);
      setMyTeams(teamsRes.items);
    } catch {
      // daftar game/tim gagal dimuat — halaman tetap bisa dipakai
    }
  }, []);

  const loadMy = useCallback(async () => {
    if (!account || rank < 2) return;
    try {
      setMine(await api<EsportTransferMy>("esport.transfer.my"));
    } catch {
      // ringkasan pribadi gagal dimuat — jangan blokir halaman
    }
  }, [account, rank]);

  const loadTab = useCallback(async () => {
    if (!account || rank < 2) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === "pasar") {
        const res = await api<{ items: EsportTransferListing[] }>("esport.transfer.listings.list", {
          status: listingFilter,
          gameId: gameIdFilter,
        });
        setListings(res.items);
      } else if (tab === "pemain") {
        const res = await api<{ items: EsportPlayerCard[] }>("esport.transfer.profiles.list", {
          status: playerFilter === "all" ? undefined : playerFilter,
          gameId: gameIdFilter,
        });
        setPlayers(res.items);
      } else if (tab === "kabar") {
        const res = await api<{ items: EsportTransferAnnouncement[] }>("esport.transfer.announcements", {});
        setNews(res.items);
      } else if (tab === "saya") {
        setMine(await api<EsportTransferMy>("esport.transfer.my"));
      } else {
        const res = await api<{ items: EsportManagedWindow[]; canManage: boolean }>("esport.transfer.windows.list");
        setWindows(res.items);
        setCanManageWindows(res.canManage);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [account, rank, tab, listingFilter, playerFilter, gameIdFilter]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  useEffect(() => {
    void loadMy();
  }, [loadMy]);

  const refresh = useCallback(() => {
    void loadMy();
    void loadTab();
  }, [loadMy, loadTab]);

  const openDispute = useCallback(async (transfer: EsportTransfer) => {
    setDisputeFor(transfer);
    setDisputes([]);
    try {
      const res = await api<{ items: EsportTransferDispute[] }>("esport.transfer.disputes.list", { transferId: transfer.id });
      setDisputes(res.items ?? []);
    } catch {
      // ignore
    }
  }, []);

  const needle = q.trim().toLowerCase();
  const visibleListings = useMemo(() => {
    if (!needle) return listings;
    return listings.filter(
      (l) => (l.player?.ign ?? "").toLowerCase().includes(needle) || (l.player?.name ?? "").toLowerCase().includes(needle),
    );
  }, [listings, needle]);
  const visiblePlayers = useMemo(() => {
    if (!needle) return players;
    return players.filter(
      (p) => p.ign.toLowerCase().includes(needle) || (p.name ?? "").toLowerCase().includes(needle),
    );
  }, [players, needle]);

  const counts: Partial<Record<TabId, number>> = {
    pasar: listings.length,
    pemain: players.length,
    kabar: news.length,
    jendela: windows.length,
    saya: mine ? mine.incomingOffers.filter((o) => o.status === "pending").length : undefined,
  };

  const actionCopy = (() => {
    if (!pending) return null;
    if (pending.kind === "accept") {
      const o = pending.offer;
      const free = o.offerType === "free_agent";
      return {
        title: "Terima Tawaran",
        description: free
          ? `Terima rekrutmen gratis dari tim "${o.fromTeam?.name ?? "tamu"}" untuk ${o.player?.ign ?? "pemain"}? Pemain langsung bergabung dan kontrak digital dibuat otomatis.`
          : `Terima tawaran ${fmtKoin(o.fee)} dari tim "${o.fromTeam?.name ?? "tamu"}" untuk ${o.player?.ign ?? "pemain"}? Pembeli akan melanjutkan pembayaran escrow.`,
        confirmLabel: free ? "Rekrut Sekarang" : "Terima Tawaran",
        danger: false,
      };
    }
    if (pending.kind === "reject") {
      const o = pending.offer;
      return {
        title: "Tolak Tawaran",
        description: `Tolak tawaran ${fmtKoin(o.fee)} dari tim "${o.fromTeam?.name ?? "tamu"}" untuk ${o.player?.ign ?? "pemain"}?`,
        confirmLabel: "Tolak Tawaran",
        danger: true,
      };
    }
    if (pending.kind === "withdraw") {
      const o = pending.offer;
      return {
        title: "Tarik Tawaran",
        description: `Tarik tawaran Anda untuk ${o.player?.ign ?? "pemain"}? Tawaran tidak lagi menunggu jawaban penjual.`,
        confirmLabel: "Tarik Tawaran",
        danger: true,
      };
    }
    if (pending.kind === "pay") {
      const t = pending.transfer;
      return {
        title: "Bayar Escrow Transfer",
        description: `Bayar escrow ${fmtKoin(t.fee)} untuk ${t.player?.ign ?? "pemain"}? Saldo koin Anda saat ini ${fmtKoin(mine?.koinBalance ?? 0)}. Dana ditahan sistem sampai penjual mengonfirmasi serah terima.`,
        confirmLabel: `Bayar ${fmtKoin(t.fee)}`,
        danger: false,
      };
    }
    if (pending.kind === "confirm") {
      const t = pending.transfer;
      return {
        title: "Konfirmasi Serah Terima",
        description: `Konfirmasi serah terima ${t.player?.ign ?? "pemain"} ke tim "${t.toTeam?.name ?? "pembeli"}"? Escrow ${fmtKoin(t.escrowCoins)} koin diteruskan ke penjual dan kontrak digital dibuat.`,
        confirmLabel: "Konfirmasi Transfer",
        danger: false,
      };
    }
    const c = pending.contract;
    return {
      title: "Eksekusi Opsi Beli",
      description: `Eksekusi opsi beli ${c.player?.ign ?? "pemain"} seharga ${fmtKoin(c.optionPrice)}? Kontrak pinjaman berakhir dan pembayaran escrow dilakukan pada langkah berikutnya.`,
      confirmLabel: "Eksekusi Opsi",
      danger: false,
    };
  })();

  const runPending = async () => {
    if (!pending) return;
    setActionBusy(true);
    try {
      if (pending.kind === "accept") {
        const res = await api<{ transferId: string; completed: boolean; contractId?: string }>(
          "esport.transfer.offers.respond",
          { id: pending.offer.id, transition: "accept" },
        );
        toast.success(
          res.completed
            ? "Rekrutmen selesai — pemain langsung bergabung dengan kontrak digital."
            : "Tawaran diterima. Lanjutkan pembayaran escrow di Bursa Saya.",
        );
      } else if (pending.kind === "reject") {
        await api("esport.transfer.offers.respond", { id: pending.offer.id, transition: "reject" });
        toast.success("Tawaran ditolak.");
      } else if (pending.kind === "withdraw") {
        await api("esport.transfer.offers.respond", { id: pending.offer.id, transition: "withdraw" });
        toast.success("Tawaran ditarik.");
      } else if (pending.kind === "pay") {
        await api("esport.transfer.pay", { id: pending.transfer.id });
        toast.success("Pembayaran escrow berhasil. Menunggu konfirmasi penjual.");
      } else if (pending.kind === "confirm") {
        await api("esport.transfer.confirm", { id: pending.transfer.id });
        toast.success("Transfer selesai — pemain resmi berpindah tim.");
      } else {
        await api("esport.transfer.option.exercise", { contractId: pending.contract.id });
        toast.success("Opsi beli dieksekusi. Lanjutkan pembayaran escrow untuk mempermanenkan pemain.");
      }
      setPending(null);
      refresh();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setActionBusy(false);
    }
  };

  const [gatewayBusy, setGatewayBusy] = useState(false);

  const handleGatewayPayTransfer = async (transferId: string) => {
    setGatewayBusy(true);
    try {
      const res = await api<{ token?: string; redirectUrl?: string; orderId: string }>(
        "esport.transfer.gatewayPay",
        { id: transferId },
      );
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        toast.success("Instruksi pembayaran payment gateway berhasil dibuat.");
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setGatewayBusy(false);
    }
  };

  if (!account) {
    return (
      <AccountGate
        title="Masuk untuk membuka bursa transfer"
        description="Bursa transfer pemain tersedia untuk anggota terverifikasi: kelola profil pemain, tawar-menawar antar tim, dan pantau kontrak serta kabar transfer."
      />
    );
  }

  if (rank < 2) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <EmptyState
          icon={<Handshake className="size-5" aria-hidden />}
          title="Akun belum memenuhi syarat"
          description="Bursa transfer hanya tersedia untuk anggota aktif terverifikasi Panti Janda."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <SEO
        title="Bursa Transfer Pemain E-Sport — Jual Beli & Rekrut Roster"
        description="Bursa transfer pemain turnamen game dan e-sport komunitas Panti Janda. Transaksi aman dengan sistem escrow, kontrak digital, dan payment gateway."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/kompetisi-esport">
            <ArrowLeft className="size-4" aria-hidden />
            Kembali ke Kompetisi E-Sport
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="h-8 px-3 text-sm">
            <Wallet className="mr-1 size-4" aria-hidden />
            {fmtKoin(mine?.koinBalance ?? 0)}
          </Badge>
          <Button asChild size="sm" variant="outline">
            <Link to="/koin">
              <Coins className="size-4" aria-hidden />
              Isi Koin
            </Link>
          </Button>
        </div>
      </div>

      <PageBanner>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-[0.18em] text-accent-foreground uppercase">Fitur Tersendiri</p>
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Bursa Transfer Pemain</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Jual, beli, pinjamkan, atau rekrut pemain e-sport antar tim: negosiasi tawaran, kontrak digital,
              pembayaran escrow koin yang aman, hingga kabar transfer terbaru komunitas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/kompetisi-esport/tim">
                <Users className="size-4" aria-hidden />
                Tim Saya
              </Link>
            </Button>
            <Button
              onClick={() => {
                const myProfiles = mine?.profiles ?? [];
                if (myProfiles.length) setProfileForm({ profile: myProfiles[0] });
                else setProfileForm({ profile: null });
              }}
            >
              <Plus className="size-4" aria-hidden />
              Profil Pemain Saya
            </Button>
          </div>
        </div>
      </PageBanner>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          const count = counts[t.id];
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
              {typeof count === "number" && count > 0 ? (
                <span className={cn("ml-1 text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {count}
                </span>
              ) : null}
            </Button>
          );
        })}
        <Button type="button" size="sm" variant="ghost" onClick={() => refresh()} aria-label="Muat ulang">
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
        </Button>
      </div>

      {(tab === "pasar" || tab === "pemain") && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={q}
                placeholder={tab === "pasar" ? "Cari nama pemain di bursa…" : "Cari nama atau IGN pemain…"}
                className="pl-9"
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            {games.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGameFilter(g.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  gameFilter === g.id
                    ? "border-orange-300 bg-orange-100 text-orange-800"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary",
                )}
              >
                <span className="mr-1" aria-hidden>
                  {g.icon ?? "🎮"}
                </span>
                {g.name}
              </button>
            ))}
          </div>
          {tab === "pasar" ? (
            <div className="flex flex-wrap items-center gap-2">
              {LISTING_FILTERS.map((s) => {
                const meta = toneOf(ESPORT_LISTING_STATUS_META, s);
                return (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={listingFilter === s ? "secondary" : "ghost"}
                    onClick={() => setListingFilter(s)}
                  >
                    {meta.label}
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {PLAYER_FILTERS.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={playerFilter === s ? "secondary" : "ghost"}
                  onClick={() => setPlayerFilter(s)}
                >
                  {s === "all" ? "Semua" : toneOf(ESPORT_PLAYER_STATUS_META, s).label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {error ? (
        <ErrorNote message={error} onRetry={() => refresh()} />
      ) : loading ? (
        <LoadingGrid count={6} />
      ) : tab === "pasar" ? (
        visibleListings.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="size-5" aria-hidden />}
            title="Belum ada pemain di bursa ini"
            description="Ubah filter game/status, atau daftarkan pemain Anda sendiri dari tab Bursa Saya agar tim lain bisa menawar."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isSellerSide={myListingIds.has(listing.id)}
                canOffer={captainTeams.length > 0}
                onDetail={() => listing.player && setDetailFor(listing.player.id)}
                onOffer={() => setOfferFor(listing)}
                onManage={() =>
                  listing.player &&
                  setListingForm({ player: listing.player, listing: mine?.listings.find((l) => l.id === listing.id) ?? null })
                }
              />
            ))}
          </div>
        )
      ) : tab === "pemain" ? (
        visiblePlayers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" aria-hidden />}
            title="Belum ada profil pemain"
            description="Ubah filter atau kata kunci pencarian. Anda juga bisa membuat profil pemain sendiri lewat tombol “Profil Pemain Saya”."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePlayers.map((player) => (
              <PlayerTile
                key={player.id}
                player={player}
                onDetail={() => setDetailFor(player.id)}
                onEdit={() => setProfileForm({ profile: player })}
                onList={() => setListingForm({ player, listing: null })}
              />
            ))}
          </div>
        )
      ) : tab === "kabar" ? (
        news.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="size-5" aria-hidden />}
            title="Belum ada kabar transfer"
            description="Setiap transfer pemain yang tuntas akan muncul di sini sebagai kabar komunitas."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {news.map((item) => (
              <KabarRow key={item.id} item={item} />
            ))}
          </div>
        )
      ) : tab === "jendela" ? (
        <div className="flex flex-col gap-4">
          {canManageWindows ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Jendela transfer mengatur kapan listing dan tawaran boleh dibuat untuk tiap game.
              </p>
              <Button size="sm" onClick={() => setWindowForm({ window: null })}>
                <Plus className="size-4" aria-hidden />
                Tambah Jendela
              </Button>
            </div>
          ) : null}
          {windows.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-5" aria-hidden />}
              title="Belum ada jendela transfer"
              description="Jika sebuah game belum punya jendela transfer, bursa untuk game tersebut otomatis selalu terbuka."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {windows.map((w) => {
                const meta = toneOf(ESPORT_WINDOW_STATUS_META, w.status);
                return (
                  <Card key={w.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-lg" aria-hidden>
                          {w.gameIcon ?? "🎮"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{w.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {w.gameName} · {formatDate(w.opensAt)} — {formatDate(w.closesAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("border-transparent", meta.tone)}>{meta.label}</Badge>
                        {canManageWindows ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setWindowForm({ window: w })}>
                              <Pencil className="size-3.5" aria-hidden />
                              Ubah
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setWindowDelete(w)}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                              Hapus
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <MyPanel
          mine={mine}
          captainTeams={captainTeams}
          onRefresh={refresh}
          onEditProfile={(p) => setProfileForm({ profile: p })}
          onAgent={(p) => setAgentFor(p)}
          onList={(player, listing) => setListingForm({ player, listing })}
          onDetail={(playerId) => setDetailFor(playerId)}
          onCounter={(offer) => setCounterFor(offer)}
          onPending={(p) => setPending(p)}
          onCancelTransfer={(t) => setCancelFor(t)}
          onDispute={openDispute}
        />
      )}

      {profileForm ? (
        <ProfileFormDialog
          key={profileForm.profile?.id ?? "new"}
          profile={profileForm.profile}
          games={games}
          onOpenChange={(open) => !open && setProfileForm(null)}
          onSaved={() => {
            setProfileForm(null);
            refresh();
          }}
        />
      ) : null}

      {agentFor ? (
        <AgentDialog
          key={agentFor.id}
          player={agentFor}
          onOpenChange={(open) => !open && setAgentFor(null)}
          onSaved={() => {
            setAgentFor(null);
            refresh();
          }}
        />
      ) : null}

      {listingForm ? (
        <ListingFormDialog
          key={listingForm.listing?.id ?? `new-${listingForm.player.id}`}
          player={listingForm.player}
          listing={listingForm.listing}
          captainTeams={captainTeams}
          onOpenChange={(open) => !open && setListingForm(null)}
          onSaved={() => {
            setListingForm(null);
            refresh();
          }}
        />
      ) : null}

      {offerFor ? (
        <OfferDialog
          key={offerFor.id}
          listing={offerFor}
          captainTeams={captainTeams}
          onOpenChange={(open) => !open && setOfferFor(null)}
          onSaved={() => {
            setOfferFor(null);
            refresh();
          }}
        />
      ) : null}

      {counterFor ? (
        <CounterDialog
          key={counterFor.id}
          offer={counterFor}
          onOpenChange={(open) => !open && setCounterFor(null)}
          onSaved={() => {
            setCounterFor(null);
            refresh();
          }}
        />
      ) : null}

      {detailFor ? <PlayerDetailDialog profileId={detailFor} onOpenChange={(open) => !open && setDetailFor(null)} /> : null}

      {pending && actionCopy ? (
        <Dialog open onOpenChange={(open) => !open && !actionBusy && !gatewayBusy && setPending(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{actionCopy.title}</DialogTitle>
              <DialogDescription>{actionCopy.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setPending(null)} disabled={actionBusy || gatewayBusy}>
                Batal
              </Button>
              {pending.kind === "pay" ? (
                <>
                  <Button
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => void handleGatewayPayTransfer(pending.transfer.id)}
                    disabled={actionBusy || gatewayBusy}
                  >
                    {gatewayBusy ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                    ) : (
                      <CreditCard className="mr-1.5 size-4" aria-hidden />
                    )}
                    Bayar via Payment Gateway
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void runPending()}
                    disabled={actionBusy || gatewayBusy}
                  >
                    {actionBusy ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                    ) : (
                      <Coins className="mr-1.5 size-4" aria-hidden />
                    )}
                    Bayar via Koin ({fmtKoin(pending.transfer.fee)})
                  </Button>
                </>
              ) : (
                <Button
                  variant={actionCopy.danger ? "destructive" : "default"}
                  onClick={() => void runPending()}
                  disabled={actionBusy || gatewayBusy}
                >
                  {actionBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-4" aria-hidden />
                  )}
                  {actionCopy.confirmLabel}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {cancelFor ? (
        <CancelTransferDialog
          transfer={cancelFor}
          onOpenChange={(open) => !open && setCancelFor(null)}
          onDone={() => {
            setCancelFor(null);
            refresh();
          }}
        />
      ) : null}

      {disputeFor ? (
        <Dialog open onOpenChange={(open) => !open && setDisputeFor(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Sengketa Transfer</DialogTitle>
              <DialogDescription>
                {disputeFor.player?.ign ?? "Pemain"} — {disputeFor.fromTeam?.name ?? "Free Agent"} → {disputeFor.toTeam?.name ?? "—"}
              </DialogDescription>
            </DialogHeader>
            <TransferDisputesPanel
              transferId={disputeFor.id}
              disputes={disputes}
              onRefresh={async () => {
                try {
                  const res = await api<{ items: EsportTransferDispute[] }>("esport.transfer.disputes.list", { transferId: disputeFor.id });
                  setDisputes(res.items ?? []);
                } catch {
                  // ignore
                }
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisputeFor(null)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {windowForm ? (
        <WindowFormDialog
          key={windowForm.window?.id ?? "new"}
          window={windowForm.window}
          games={games}
          onOpenChange={(open) => !open && setWindowForm(null)}
          onSaved={() => {
            setWindowForm(null);
            refresh();
          }}
        />
      ) : null}

      {windowDelete ? (
        <Dialog open onOpenChange={(open) => !open && setWindowDelete(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus Jendela Transfer</DialogTitle>
              <DialogDescription>
                Hapus jendela “{windowDelete.name}”? Bursa untuk {windowDelete.gameName} akan kembali selalu terbuka
                jika tidak ada jendela lain.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWindowDelete(null)}>
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const target = windowDelete;
                  setWindowDelete(null);
                  void (async () => {
                    try {
                      await api("esport.transfer.windows.delete", { id: target.id });
                      toast.success("Jendela transfer dihapus.");
                      refresh();
                    } catch (err) {
                      toast.error(errorText(err));
                    }
                  })();
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Hapus
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

type PendingAction =
  | { kind: "accept"; offer: EsportMyOffer }
  | { kind: "reject"; offer: EsportMyOffer }
  | { kind: "withdraw"; offer: EsportMyOffer }
  | { kind: "pay"; transfer: EsportTransfer }
  | { kind: "confirm"; transfer: EsportTransfer }
  | { kind: "option"; contract: EsportMyContract };

function ListingCard({ listing, isSellerSide, canOffer, onDetail, onOffer, onManage }: {
  listing: EsportTransferListing;
  isSellerSide: boolean;
  canOffer: boolean;
  onDetail: () => void;
  onOffer: () => void;
  onManage: () => void;
}) {
  const player = listing.player;
  const statusMeta = toneOf(ESPORT_LISTING_STATUS_META, listing.status);
  const typeMeta = ESPORT_TRANSFER_TYPE_META[listing.listingType];
  const playerMeta = player ? toneOf(ESPORT_PLAYER_STATUS_META, player.status) : null;
  const offerDisabled = !canOffer || isSellerSide || listing.status !== "open" || !listing.windowOpen;

  return (
    <Card className="hover-lift h-full min-w-0">
      <CardContent className="flex h-full flex-col gap-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar name={player?.name ?? "Pemain"} photoData={player?.photoData ?? null} size={40} />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-foreground">{player?.ign ?? "Pemain"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {player?.name ?? ""} {player?.game ? `· ${player.game.icon ?? "🎮"} ${player.game.name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
            {playerMeta ? <Badge className={cn("border-transparent", playerMeta.tone)}>{playerMeta.label}</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Badge className={cn("border-transparent", typeMeta?.tone ?? "")}>{typeMeta?.label ?? listing.listingType}</Badge>
          {player?.mainRole ? <InfoChip icon={<UserRound className="size-3.5" aria-hidden />}>{player.mainRole}</InfoChip> : null}
          {player?.region ? <InfoChip>{player.region}</InfoChip> : null}
          {player?.rankTier ? <InfoChip>{player.rankTier}</InfoChip> : null}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="size-3.5" aria-hidden />
            {listing.team ? `${listing.team.name}${listing.team.tag ? ` (${listing.team.tag})` : ""}` : "Tanpa tim"}
          </span>
          {player?.agent?.active ? <span>Agen: {player.agent.name}</span> : null}
        </div>

        <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm">
          {listing.listingType === "free_agent" ? (
            <span className="font-semibold text-emerald-700">Gratis — rekrut sebagai free agent</span>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-semibold text-foreground">{fmtKoin(listing.askingPrice)}</span>
              {listing.loanDays ? <span className="text-muted-foreground">Pinjaman {listing.loanDays} hari</span> : null}
              {listing.optionPrice ? <span className="text-muted-foreground">Opsi beli {fmtKoin(listing.optionPrice)}</span> : null}
            </div>
          )}
        </div>

        {listing.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{listing.description}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <OpenWindowBadge open={listing.windowOpen} name={listing.windowName} />
          <span className="text-xs text-muted-foreground">{timeAgo(listing.createdAt)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onDetail}>
            <UserRound className="size-3.5" aria-hidden />
            Lihat Pemain
          </Button>
          {isSellerSide ? (
            <Button size="sm" onClick={onManage}>
              <Pencil className="size-3.5" aria-hidden />
              Kelola Listing
            </Button>
          ) : (
            <Button size="sm" onClick={onOffer} disabled={offerDisabled}>
              <Send className="size-3.5" aria-hidden />
              Ajukan Tawaran
            </Button>
          )}
        </div>
        {!isSellerSide && !offerDisabled ? null : !isSellerSide ? (
          <p className="text-xs text-muted-foreground">
            {!canOffer
              ? "Anda perlu menjadi kapten tim untuk menawar."
              : !listing.windowOpen
                ? "Jendela transfer game ini sedang ditutup."
                : "Listing ini belum dibuka untuk tawaran."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PlayerTile({ player, onDetail, onEdit, onList }: {
  player: EsportPlayerCard;
  onDetail: () => void;
  onEdit: () => void;
  onList: () => void;
}) {
  const statusMeta = toneOf(ESPORT_PLAYER_STATUS_META, player.status);
  return (
    <Card className="hover-lift h-full min-w-0">
      <CardContent className="flex h-full flex-col gap-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar name={player.name} photoData={player.photoData} size={40} />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-foreground">{player.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {player.game?.icon ?? "🎮"} {player.ign}
                {player.game ? ` · ${player.game.name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
            {player.owner ? <Badge variant="outline">Milik Anda</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {player.mainRole ? <InfoChip icon={<UserRound className="size-3.5" aria-hidden />}>{player.mainRole}</InfoChip> : null}
          {player.region ? <InfoChip>{player.region}</InfoChip> : null}
          {player.rankTier ? <InfoChip>{player.rankTier}</InfoChip> : null}
          {typeof player.rankPoints === "number" ? <InfoChip>{player.rankPoints.toLocaleString("id-ID")} poin</InfoChip> : null}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="size-3.5" aria-hidden />
            {player.team ? player.team.name : "Tanpa tim"}
          </span>
          {player.contract ? (
            <span>
              {toneOf(ESPORT_CONTRACT_TYPE_META, player.contract.type).label}
              {player.contract.endDate ? ` · s.d. ${formatDate(player.contract.endDate)}` : ""}
            </span>
          ) : null}
          {player.agent?.active ? <span>Agen: {player.agent.name}</span> : null}
        </div>

        {player.listing ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
            <span className="font-semibold">{toneOf(ESPORT_LISTING_STATUS_META, player.listing.status).label} di bursa</span>
            {" · "}
            {toneOf(ESPORT_TRANSFER_TYPE_META, player.listing.listingType).label}
            {player.listing.listingType === "free_agent" ? " · Gratis" : ` · ${fmtKoin(player.listing.askingPrice)}`}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-3">
          <Button size="sm" variant="outline" onClick={onDetail}>
            <UserRound className="size-3.5" aria-hidden />
            Lihat Detail
          </Button>
          {player.owner ? (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil className="size-3.5" aria-hidden />
                Edit Profil
              </Button>
              {!player.listing && player.status !== "retired" ? (
                <Button size="sm" onClick={onList}>
                  <ShoppingBag className="size-3.5" aria-hidden />
                  Daftarkan ke Bursa
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function KabarRow({ item }: { item: EsportTransferAnnouncement }) {
  const typeMeta = ESPORT_TRANSFER_TYPE_META[item.transferType];
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-5">
        <MemberAvatar name={item.player?.name ?? "Pemain"} photoData={item.player?.photoData ?? null} size={40} />
        <div className="min-w-0 flex-1 basis-56">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            <span className="truncate">{item.player?.ign ?? "Pemain"}</span>
            <Badge className={cn("border-transparent", typeMeta?.tone ?? "")}>{typeMeta?.label ?? item.transferType}</Badge>
          </p>
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{item.fromTeam?.name ?? "Free Agent"}</span>
            <ArrowLeftRight className="size-3.5" aria-hidden />
            <span className="font-medium text-foreground">{item.toTeam?.name ?? "—"}</span>
            {item.fee > 0 ? <span>· {fmtKoin(item.fee)}</span> : <span>· Gratis</span>}
            {item.loanDays ? <span>· pinjaman {item.loanDays} hari</span> : null}
            {item.contractEnd ? <span>· kontrak s.d. {formatDate(item.contractEnd)}</span> : null}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          {item.completedAt ? timeAgo(item.completedAt) : "—"}
        </span>
      </CardContent>
    </Card>
  );
}

function MyPanel({ mine, captainTeams, onRefresh, onEditProfile, onAgent, onList, onDetail, onCounter, onPending, onCancelTransfer, onDispute }: {
  mine: EsportTransferMy | null;
  captainTeams: EsportTeam[];
  onRefresh: () => void;
  onEditProfile: (player: EsportPlayerCard) => void;
  onAgent: (player: EsportPlayerCard) => void;
  onList: (player: EsportPlayerCard, listing: EsportTransferListing | null) => void;
  onDetail: (profileId: string) => void;
  onCounter: (offer: EsportMyOffer) => void;
  onPending: (action: PendingAction) => void;
  onCancelTransfer: (transfer: EsportTransfer) => void;
  onDispute: (transfer: EsportTransfer) => void;
}) {
  if (!mine) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Memuat ringkasan bursa Anda…
      </div>
    );
  }

  const pendingIncoming = mine.incomingOffers.filter((o) => o.status === "pending");
  const otherIncoming = mine.incomingOffers.filter((o) => o.status !== "pending");
  const activeTransfers = mine.transfers.filter((t) => t.active);
  const doneTransfers = mine.transfers.filter((t) => !t.active);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-orange-200/70 bg-gradient-to-r from-orange-50 to-amber-50">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm">
              <Wallet className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-orange-700 uppercase">Saldo Koin Transfer</p>
              <p className="font-display text-xl font-semibold text-foreground">{fmtKoin(mine.koinBalance)}</p>
              <p className="text-xs text-muted-foreground">
                Dana escrow ditahan sistem dan diteruskan ke penjual setelah serah terima dikonfirmasi.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mine.teams.length ? (
              <Badge variant="outline">{mine.teams.length} tim terkait</Badge>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to="/koin">
                <Coins className="size-4" aria-hidden />
                Isi Koin
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={onRefresh} aria-label="Muat ulang">
              <RefreshCw className="size-4" aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>

      <SectionCard
        icon={<UserRound className="size-5" aria-hidden />}
        title="Profil Pemain Saya"
        description="Profil pemain adalah paspor Anda di bursa: menampilkan status, tim, kontrak, dan kesepakatan agen."
      >
        {mine.profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Anda belum punya profil pemain. Buat lewat tombol “Profil Pemain Saya” di atas untuk bisa masuk bursa.
          </p>
        ) : (
          mine.profiles.map((player) => {
            const statusMeta = toneOf(ESPORT_PLAYER_STATUS_META, player.status);
            const listingRef = player.listing;
            const fullListing = listingRef ? mine.listings.find((l) => l.id === listingRef.id) ?? null : null;
            return (
              <div
                key={player.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar name={player.name} photoData={player.photoData} size={36} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="truncate">{player.name}</span>
                      <span className="text-muted-foreground">({player.ign})</span>
                      <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
                    </p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{player.game?.icon ?? "🎮"} {player.game?.name ?? "Game"}</span>
                      {player.mainRole ? <span>{player.mainRole}</span> : null}
                      {player.team ? <span>Tim: {player.team.name}</span> : <span>Tanpa tim</span>}
                      {player.contract ? (
                        <span>
                          {toneOf(ESPORT_CONTRACT_TYPE_META, player.contract.type).label}
                          {player.contract.endDate ? ` s.d. ${formatDate(player.contract.endDate)}` : ""}
                        </span>
                      ) : null}
                      {player.agent?.active ? <span>Agen: {player.agent.name}</span> : null}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onDetail(player.id)}>
                    <UserRound className="size-3.5" aria-hidden />
                    Detail
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onEditProfile(player)}>
                    <Pencil className="size-3.5" aria-hidden />
                    Edit Profil
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onAgent(player)}>
                    <Handshake className="size-3.5" aria-hidden />
                    Agen
                  </Button>
                  {listingRef ? (
                    <Button size="sm" onClick={() => onList(player, fullListing)}>
                      <ShoppingBag className="size-3.5" aria-hidden />
                      Kelola Listing
                    </Button>
                  ) : player.status !== "retired" ? (
                    <Button size="sm" onClick={() => onList(player, null)}>
                      <ShoppingBag className="size-3.5" aria-hidden />
                      Daftarkan ke Bursa
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </SectionCard>

      <SectionCard
        icon={<Megaphone className="size-5" aria-hidden />}
        title="Tawaran Masuk"
        description="Tawaran dari tim lain untuk pemain yang Anda daftarkan atau miliki timnya."
      >
        {pendingIncoming.length === 0 && otherIncoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada tawaran masuk.</p>
        ) : (
          <>
            {pendingIncoming.map((offer) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                side="incoming"
                onAccept={() => onPending({ kind: "accept", offer })}
                onReject={() => onPending({ kind: "reject", offer })}
                onCounter={() => onCounter(offer)}
              />
            ))}
            {otherIncoming.map((offer) => (
              <OfferRow key={offer.id} offer={offer} side="incoming" />
            ))}
          </>
        )}
      </SectionCard>

      <SectionCard
        icon={<Send className="size-5" aria-hidden />}
        title="Tawaran Keluar"
        description="Tawaran yang Anda kirim ke pemain tim lain beserta statusnya."
      >
        {mine.outgoingOffers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada tawaran keluar.</p>
        ) : (
          mine.outgoingOffers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              side="outgoing"
              onWithdraw={() => onPending({ kind: "withdraw", offer })}
            />
          ))
        )}
      </SectionCard>

      <SectionCard
        icon={<ArrowLeftRight className="size-5" aria-hidden />}
        title="Transaksi Transfer"
        description="Proses transfer berjalan: pembayaran escrow, serah terima, hingga pembatalan."
      >
        {activeTransfers.length === 0 && doneTransfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada transaksi transfer.</p>
        ) : (
          <>
            {activeTransfers.map((t) => (
              <TransferRow key={t.id} transfer={t} onPending={onPending} onCancel={onCancelTransfer} onDispute={onDispute} />
            ))}
            {doneTransfers.map((t) => (
              <TransferRow key={t.id} transfer={t} onPending={onPending} onCancel={onCancelTransfer} onDispute={onDispute} />
            ))}
          </>
        )}
      </SectionCard>

      <SectionCard
        icon={<ShieldCheck className="size-5" aria-hidden />}
        title="Kontrak Pemain"
        description="Kontrak digital yang melibatkan tim Anda atau pemain Anda — termasuk opsi beli."
      >
        {mine.contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada kontrak.</p>
        ) : (
          mine.contracts.map((c) => {
            const typeMeta = toneOf(ESPORT_CONTRACT_TYPE_META, c.contractType);
            const statusMeta = toneOf(ESPORT_CONTRACT_STATUS_META, c.status);
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="truncate">{c.player?.ign ?? "Pemain"}</span>
                    <Badge className={cn("border-transparent", typeMeta.tone)}>{typeMeta.label}</Badge>
                    <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
                  </p>
                  <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>Tim: {c.team?.name ?? "—"}</span>
                    <span>{formatDate(c.startDate)} — {c.endDate ? formatDate(c.endDate) : "tanpa batas"}</span>
                    {c.optionPrice ? <span>Opsi beli: {fmtKoin(c.optionPrice)}</span> : null}
                  </p>
                </div>
                {c.canExerciseOption ? (
                  <Button size="sm" onClick={() => onPending({ kind: "option", contract: c })}>
                    <Coins className="size-3.5" aria-hidden />
                    Eksekusi Opsi Beli
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </SectionCard>

      {captainTeams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                <Users className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Ingin merekrut pemain untuk tim Anda?</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Jadilah kapten tim e-sport terlebih dahulu — hanya kapten yang dapat mengirim tawaran transfer.
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link to="/kompetisi-esport/tim">
                <Users className="size-4" aria-hidden />
                Buat / Buka Tim
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function OfferRow({ offer, side, onAccept, onReject, onCounter, onWithdraw }: {
  offer: EsportMyOffer;
  side: "incoming" | "outgoing";
  onAccept?: () => void;
  onReject?: () => void;
  onCounter?: () => void;
  onWithdraw?: () => void;
}) {
  const statusMeta = toneOf(ESPORT_OFFER_STATUS_META, offer.status);
  const typeMeta = ESPORT_TRANSFER_TYPE_META[offer.offerType];
  const pending = offer.status === "pending";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          <span className="truncate">
            {side === "incoming"
              ? `Dari tim ${offer.fromTeam?.name ?? "Tamu"}`
              : `Untuk ${offer.player?.ign ?? "pemain"}`}
          </span>
          <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
          <Badge className={cn("border-transparent", typeMeta?.tone ?? "")}>{typeMeta?.short ?? offer.offerType}</Badge>
        </p>
        <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {side === "incoming" ? <span>Pemain: {offer.player?.ign ?? "—"}</span> : null}
          <span>{offer.offerType === "free_agent" ? "Gratis" : fmtKoin(offer.fee)}</span>
          {offer.loanDays ? <span>Pinjaman {offer.loanDays} hari</span> : null}
          {offer.optionPrice ? <span>Opsi {fmtKoin(offer.optionPrice)}</span> : null}
          {offer.expiresAt && pending ? <span>Berlaku sampai {formatDateTime(offer.expiresAt)}</span> : null}
          <span>Dikirim {timeAgo(offer.createdAt)}</span>
        </p>
        {offer.message ? <p className="mt-1 text-xs italic text-muted-foreground">“{offer.message}”</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {side === "incoming" && pending && onAccept && onReject && onCounter ? (
          <>
            <Button size="sm" onClick={onAccept}>
              <Check className="size-3.5" aria-hidden />
              Terima
            </Button>
            <Button size="sm" variant="outline" onClick={onCounter}>
              <Handshake className="size-3.5" aria-hidden />
              Balas
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onReject}>
              <X className="size-3.5" aria-hidden />
              Tolak
            </Button>
          </>
        ) : null}
        {side === "outgoing" && pending && onWithdraw ? (
          <Button size="sm" variant="outline" onClick={onWithdraw}>
            <X className="size-3.5" aria-hidden />
            Tarik
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TransferRow({ transfer, onPending, onCancel, onDispute }: {
  transfer: EsportTransfer;
  onPending: (action: PendingAction) => void;
  onCancel: (transfer: EsportTransfer) => void;
  onDispute: (transfer: EsportTransfer) => void;
}) {
  const statusMeta = toneOf(ESPORT_TRANSFER_STATUS_META, transfer.status);
  const typeMeta = ESPORT_TRANSFER_TYPE_META[transfer.transferType];
  const waitingText =
    transfer.status === "pending_payment"
      ? "Menunggu pembayaran escrow dari tim pembeli."
      : transfer.status === "escrow_held"
        ? "Escrow ditahan — menunggu konfirmasi serah terima dari penjual."
        : null;
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            <span className="truncate">{transfer.player?.ign ?? "Pemain"}</span>
            <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge>
            <Badge className={cn("border-transparent", typeMeta?.tone ?? "")}>{typeMeta?.short ?? transfer.transferType}</Badge>
            {transfer.isBuyer ? <Badge variant="outline">Anda pembeli</Badge> : null}
            {transfer.isSeller ? <Badge variant="outline">Anda penjual</Badge> : null}
          </p>
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{transfer.fromTeam?.name ?? "Free Agent"}</span>
            <ArrowLeftRight className="size-3.5" aria-hidden />
            <span className="font-medium text-foreground">{transfer.toTeam?.name ?? "—"}</span>
            <span>· {transfer.transferType === "free_agent" ? "Gratis" : fmtKoin(transfer.fee)}</span>
            {transfer.escrowCoins > 0 ? <span>· escrow {fmtKoin(transfer.escrowCoins)}</span> : null}
            {transfer.loanDays ? <span>· pinjaman {transfer.loanDays} hari</span> : null}
            {transfer.optionPrice ? <span>· opsi {fmtKoin(transfer.optionPrice)}</span> : null}
            {transfer.contractEnd ? <span>· kontrak s.d. {formatDate(transfer.contractEnd)}</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">
            Dibuat {timeAgo(transfer.createdAt)}
            {transfer.paidAt ? ` · dibayar ${timeAgo(transfer.paidAt)}` : ""}
            {transfer.completedAt ? ` · selesai ${timeAgo(transfer.completedAt)}` : ""}
            {transfer.cancelledAt ? ` · dibatalkan ${timeAgo(transfer.cancelledAt)}` : ""}
          </p>
          {transfer.cancelReason ? (
            <p className="text-xs italic text-muted-foreground">Alasan batal: {transfer.cancelReason}</p>
          ) : waitingText ? (
            <p className="text-xs text-muted-foreground">{waitingText}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {transfer.canPay ? (
            <Button size="sm" onClick={() => onPending({ kind: "pay", transfer })}>
              <Coins className="size-3.5" aria-hidden />
              Bayar Escrow
            </Button>
          ) : null}
          {transfer.canConfirm ? (
            <Button size="sm" onClick={() => onPending({ kind: "confirm", transfer })}>
              <Check className="size-3.5" aria-hidden />
              Konfirmasi Serah Terima
            </Button>
          ) : null}
          {transfer.status !== "cancelled" ? (
            <Button size="sm" variant="outline" onClick={() => onDispute(transfer)}>
              <AlertCircle className="size-3.5" aria-hidden />
              Sengketa
            </Button>
          ) : null}
          {transfer.canCancel ? (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onCancel(transfer)}>
              <XCircle className="size-3.5" aria-hidden />
              Batalkan
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProfileFormDialog({ profile, games, onOpenChange, onSaved }: {
  profile: EsportPlayerCard | null;
  games: EsportGame[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [gameId, setGameId] = useState(profile?.game?.id ?? games[0]?.id ?? "");
  const [ign, setIgn] = useState(profile?.ign ?? "");
  const [mainRole, setMainRole] = useState(profile?.mainRole ?? "");
  const [region, setRegion] = useState(profile?.region ?? "");
  const [rankTier, setRankTier] = useState(profile?.rankTier ?? "");
  const [rankPoints, setRankPoints] = useState(profile?.rankPoints != null ? String(profile.rankPoints) : "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [retired, setRetired] = useState(profile?.status === "retired");
  const [statsRows, setStatsRows] = useState<{ key: string; value: string }[]>(
    profile?.stats ? Object.entries(profile.stats).map(([k, v]) => ({ key: k, value: String(v) })) : [],
  );
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (ign.trim().length < 2) {
      toast.error("Nama in-game (IGN) minimal 2 karakter.");
      return;
    }
    if (!profile && !gameId) {
      toast.error("Pilih game terlebih dahulu.");
      return;
    }
    const stats: Record<string, string | number> = {};
    for (const row of statsRows) {
      const key = row.key.trim();
      const value = row.value.trim();
      if (!key || !value) continue;
      const asNumber = Number(value);
      stats[key] = Number.isFinite(asNumber) && value !== "" ? asNumber : value;
    }
    setBusy(true);
    try {
      await api("esport.transfer.profiles.save", {
        id: profile?.id,
        gameId: profile?.game?.id ?? gameId,
        ign: ign.trim(),
        mainRole: mainRole.trim() || undefined,
        region: region.trim() || undefined,
        rankTier: rankTier.trim() || undefined,
        rankPoints: numOrNull(rankPoints) ?? undefined,
        bio: bio.trim() || undefined,
        stats: Object.keys(stats).length ? stats : undefined,
        retired,
      });
      toast.success(profile ? "Profil pemain diperbarui." : "Profil pemain dibuat. Selamat bergabung di bursa!");
      onSaved();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit Profil Pemain" : "Profil Pemain Baru"}</DialogTitle>
          <DialogDescription>
            Profil pemain tampil di bursa transfer: IGN, peran, peringkat, dan statistik yang ingin Anda pamerkan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!profile ? (
            <div className="space-y-2">
              <Label>Game</Label>
              <Select value={gameId} onValueChange={setGameId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih game…" />
                </SelectTrigger>
                <SelectContent>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.icon ?? "🎮"} {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="bp-ign">Nama in-game (IGN)</Label>
            <Input id="bp-ign" value={ign} maxLength={30} placeholder="cth. SrikandiGold" onChange={(e) => setIgn(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bp-role">Peran utama (opsional)</Label>
              <Input id="bp-role" value={mainRole} maxLength={30} placeholder="cth. Gold Lane" onChange={(e) => setMainRole(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-region">Regional (opsional)</Label>
              <Input id="bp-region" value={region} maxLength={40} placeholder="cth. Jakarta" onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-tier">Tingkat peringkat (opsional)</Label>
              <Input id="bp-tier" value={rankTier} maxLength={30} placeholder="cth. Mythical Glory" onChange={(e) => setRankTier(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-points">Poin peringkat (opsional)</Label>
              <Input
                id="bp-points"
                type="number"
                min={0}
                max={100000}
                value={rankPoints}
                placeholder="cth. 1250"
                onChange={(e) => setRankPoints(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-bio">Bio singkat (opsional)</Label>
            <Textarea
              id="bp-bio"
              value={bio}
              maxLength={300}
              placeholder="Prestasi, gaya bermain, atau hal lain yang ingin Anda tonjolkan."
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Statistik (opsional, maksimal 12)</Label>
            {statsRows.map((row, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <Input
                  value={row.key}
                  placeholder="Nama statistik (cth. Matches)"
                  className="min-w-0 flex-1 basis-40"
                  maxLength={24}
                  onChange={(e) =>
                    setStatsRows((prev) => prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))
                  }
                />
                <Input
                  value={row.value}
                  placeholder="Nilai"
                  className="min-w-0 flex-1 basis-28"
                  maxLength={40}
                  onChange={(e) =>
                    setStatsRows((prev) => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  aria-label="Hapus statistik"
                  onClick={() => setStatsRows((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            {statsRows.length < 12 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStatsRows((prev) => [...prev, { key: "", value: "" }])}
              >
                <Plus className="size-3.5" aria-hidden />
                Tambah Statistik
              </Button>
            ) : null}
          </div>
          {profile ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Status pensiun</p>
                <p className="text-xs text-muted-foreground">
                  Pemain pensiun tidak bisa didaftarkan ke bursa sampai statusnya diaktifkan kembali.
                </p>
              </div>
              <Switch checked={retired} onCheckedChange={setRetired} />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {profile ? "Simpan Perubahan" : "Buat Profil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentDialog({ player, onOpenChange, onSaved }: {
  player: EsportPlayerCard;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(player.agent?.name ?? "");
  const [contact, setContact] = useState(player.agent?.contact ?? "");
  const [commission, setCommission] = useState(String(player.agent?.commissionPercent ?? 10));
  const [active, setActive] = useState(player.agent?.active ?? true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) {
      toast.error("Nama agen minimal 2 karakter.");
      return;
    }
    setBusy(true);
    try {
      await api("esport.transfer.agent.save", {
        profileId: player.id,
        name: name.trim(),
        contact: contact.trim() || undefined,
        commissionPercent: numOrNull(commission) ?? 10,
        active,
      });
      toast.success("Data agen disimpan.");
      onSaved();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agen Pemain — {player.ign}</DialogTitle>
          <DialogDescription>
            Agen membantu menegosiasikan transfer. Datanya tampil di kartu pemain Anda (opsional).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bp-agent-name">Nama agen / manajemen</Label>
            <Input id="bp-agent-name" value={name} maxLength={60} placeholder="cth. Rani Sport Management" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-agent-contact">Kontak (opsional)</Label>
            <Input id="bp-agent-contact" value={contact} maxLength={80} placeholder="cth. 0812xxxx / @rani" onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-agent-commission">Komisi agen (%)</Label>
            <Input
              id="bp-agent-commission"
              type="number"
              min={0}
              max={50}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Status agen aktif</p>
              <p className="text-xs text-muted-foreground">Matikan jika pemain tidak lagi diwakili agen ini.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Handshake className="size-4" aria-hidden />}
            Simpan Agen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListingFormDialog({ player, listing, captainTeams, onOpenChange, onSaved }: {
  player: EsportPlayerCard;
  listing: EsportTransferListing | null;
  captainTeams: EsportTeam[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const editing = Boolean(listing);
  const [listingType, setListingType] = useState(listing?.listingType ?? "sale");
  const [teamId, setTeamId] = useState(listing?.team?.id ?? captainTeams[0]?.id ?? "");
  const [askingPrice, setAskingPrice] = useState(listing && listing.askingPrice ? String(listing.askingPrice) : "");
  const [loanDays, setLoanDays] = useState(listing?.loanDays ? String(listing.loanDays) : "30");
  const [optionPrice, setOptionPrice] = useState(listing?.optionPrice ? String(listing.optionPrice) : "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [status, setStatus] = useState(listing?.status ?? "open");
  const [busy, setBusy] = useState(false);

  const needsTeam = listingType !== "free_agent";
  const needsLoanDays = listingType === "loan" || listingType === "loan_to_buy";
  const needsOptionPrice = listingType === "loan_to_buy";
  const typeMeta = ESPORT_TRANSFER_TYPE_META[listingType];

  const submit = async () => {
    if (!editing) {
      if (needsTeam && !teamId) {
        toast.error("Pilih tim yang mendaftarkan pemain ini.");
        return;
      }
      if (listingType === "sale" && (numOrNull(askingPrice) ?? 0) < 1) {
        toast.error("Harga transfer minimal 1 koin.");
        return;
      }
      if (needsLoanDays && !numOrNull(loanDays)) {
        toast.error("Durasi pinjaman wajib diisi (1–365 hari).");
        return;
      }
      if (needsOptionPrice && !numOrNull(optionPrice)) {
        toast.error("Harga opsi beli wajib diisi untuk pinjaman dengan opsi.");
        return;
      }
    }
    setBusy(true);
    try {
      if (!editing) {
        await api("esport.transfer.listings.create", {
          profileId: player.id,
          teamId: needsTeam ? teamId : undefined,
          listingType,
          askingPrice: listingType === "free_agent" ? 0 : numOrNull(askingPrice) ?? 0,
          loanDays: needsLoanDays ? numOrNull(loanDays) ?? undefined : undefined,
          optionPrice: needsOptionPrice ? numOrNull(optionPrice) ?? undefined : undefined,
          description: description.trim() || undefined,
        });
        toast.success("Pemain didaftarkan ke bursa transfer.");
      } else if (listing) {
        await api("esport.transfer.listings.update", {
          id: listing.id,
          status,
          askingPrice: listingType === "free_agent" ? undefined : numOrNull(askingPrice) ?? undefined,
          loanDays: needsLoanDays ? numOrNull(loanDays) ?? undefined : undefined,
          optionPrice: needsOptionPrice ? numOrNull(optionPrice) ?? undefined : undefined,
          description: description.trim() || undefined,
        });
        toast.success("Listing diperbarui.");
      }
      onSaved();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Kelola Listing — ${player.ign}` : `Daftarkan ${player.ign} ke Bursa`}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Perbarui harga, durasi, atau status listing. Menutup listing otomatis menolak tawaran yang masih menunggu."
              : "Pilih jenis transfer dan besarannya. Listing hanya bisa dibuat saat jendela transfer game ini terbuka."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!editing ? (
            <>
              <div className="space-y-2">
                <Label>Jenis transfer</Label>
                <Select value={listingType} onValueChange={(v) => setListingType(v as typeof listingType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ESPORT_TRANSFER_TYPE_META).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {typeMeta ? <p className="text-xs text-muted-foreground">{typeMeta.hint}</p> : null}
              </div>
              {needsTeam ? (
                <div className="space-y-2">
                  <Label>Tim pendaftar</Label>
                  {captainTeams.length ? (
                    <Select value={teamId} onValueChange={setTeamId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih tim…" />
                      </SelectTrigger>
                      <SelectContent>
                        {captainTeams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.tag ? ` (${t.tag})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-destructive">
                      Anda belum menjadi kapten tim mana pun — hanya free agent yang bisa didaftarkan tanpa tim.
                    </p>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border-transparent", typeMeta?.tone ?? "")}>{typeMeta?.label ?? listingType}</Badge>
              {listing?.team ? <Badge variant="outline">{listing.team.name}</Badge> : <Badge variant="outline">Tanpa tim</Badge>}
            </div>
          )}

          {listingType !== "free_agent" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bp-price">{listingType === "sale" ? "Harga transfer (koin)" : "Biaya pinjaman (koin)"}</Label>
                <Input
                  id="bp-price"
                  type="number"
                  min={0}
                  max={ESPORT_TRANSFER_FEE_MAX}
                  value={askingPrice}
                  placeholder="cth. 8500"
                  onChange={(e) => setAskingPrice(e.target.value)}
                />
              </div>
              {needsLoanDays ? (
                <div className="space-y-2">
                  <Label htmlFor="bp-days">Durasi pinjaman (hari)</Label>
                  <Input
                    id="bp-days"
                    type="number"
                    min={1}
                    max={365}
                    value={loanDays}
                    onChange={(e) => setLoanDays(e.target.value)}
                  />
                </div>
              ) : null}
              {needsOptionPrice ? (
                <div className="space-y-2">
                  <Label htmlFor="bp-option">Harga opsi beli (koin)</Label>
                  <Input
                    id="bp-option"
                    type="number"
                    min={0}
                    max={ESPORT_TRANSFER_FEE_MAX}
                    value={optionPrice}
                    placeholder="cth. 4000"
                    onChange={(e) => setOptionPrice(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Free agent direkrut tanpa pembayaran — tim peminat cukup mengirim tawaran rekrutmen.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="bp-desc">Catatan listing (opsional)</Label>
            <Textarea
              id="bp-desc"
              value={description}
              maxLength={400}
              placeholder="cth. Siap kontrak musiman, jam latihan malam."
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {editing ? (
            <div className="space-y-2">
              <Label>Status listing</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ESPORT_LISTING_STATUS_META)
                    .filter(([key]) => key !== "completed")
                    .map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        {meta.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShoppingBag className="size-4" aria-hidden />}
            {editing ? "Simpan Listing" : "Daftarkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OfferDialog({ listing, captainTeams, onOpenChange, onSaved }: {
  listing: EsportTransferListing;
  captainTeams: EsportTeam[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const others = captainTeams.filter((t) => t.id !== listing.team?.id);
  const [teamId, setTeamId] = useState(others[0]?.id ?? "");
  const [fee, setFee] = useState(listing.listingType === "free_agent" ? "0" : listing.askingPrice ? String(listing.askingPrice) : "");
  const [loanDays, setLoanDays] = useState(listing.loanDays ? String(listing.loanDays) : "30");
  const [optionPrice, setOptionPrice] = useState(listing.optionPrice ? String(listing.optionPrice) : "");
  const [message, setMessage] = useState("");
  const [expires, setExpires] = useState("72");
  const [busy, setBusy] = useState(false);

  const needsLoanDays = listing.listingType === "loan" || listing.listingType === "loan_to_buy";
  const needsOptionPrice = listing.listingType === "loan_to_buy";
  const typeMeta = ESPORT_TRANSFER_TYPE_META[listing.listingType];

  const submit = async () => {
    if (!teamId) {
      toast.error("Pilih tim Anda yang mengirim tawaran.");
      return;
    }
    if (listing.listingType === "sale" && (numOrNull(fee) ?? 0) < 1) {
      toast.error("Nilai tawaran minimal 1 koin.");
      return;
    }
    if (needsOptionPrice && !numOrNull(optionPrice)) {
      toast.error("Sertakan harga opsi beli dalam tawaran.");
      return;
    }
    setBusy(true);
    try {
      await api("esport.transfer.offers.create", {
        listingId: listing.id,
        teamId,
        fee: listing.listingType === "free_agent" ? undefined : numOrNull(fee) ?? undefined,
        loanDays: needsLoanDays ? numOrNull(loanDays) ?? undefined : undefined,
        optionPrice: needsOptionPrice ? numOrNull(optionPrice) ?? undefined : undefined,
        message: message.trim() || undefined,
        expiresInHours: Number(expires),
      });
      toast.success("Tawaran terkirim — menunggu jawaban penjual.");
      onSaved();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajukan Tawaran — {listing.player?.ign ?? "Pemain"}</DialogTitle>
          <DialogDescription>
            {typeMeta?.label ?? listing.listingType}
            {listing.team ? ` dari ${listing.team.name}` : " tanpa tim"}
            {listing.listingType !== "free_agent" ? ` · harga ${fmtKoin(listing.askingPrice)}` : " · gratis"}
            . Bawa saldo koin yang cukup — escrow dibayar setelah tawaran diterima.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tim Anda</Label>
            {others.length ? (
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tim…" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.tag ? ` (${t.tag})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-destructive">
                Tidak ada tim yang bisa diikutkan — Anda tidak boleh menawar pemain dari tim sendiri.
              </p>
            )}
          </div>
          {listing.listingType !== "free_agent" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bp-offer-fee">
                  {listing.listingType === "sale" ? "Nilai tawaran (koin)" : "Biaya pinjaman ditawarkan (koin)"}
                </Label>
                <Input
                  id="bp-offer-fee"
                  type="number"
                  min={0}
                  max={ESPORT_TRANSFER_FEE_MAX}
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </div>
              {needsLoanDays ? (
                <div className="space-y-2">
                  <Label htmlFor="bp-offer-days">Durasi pinjaman (hari)</Label>
                  <Input
                    id="bp-offer-days"
                    type="number"
                    min={1}
                    max={365}
                    value={loanDays}
                    onChange={(e) => setLoanDays(e.target.value)}
                  />
                </div>
              ) : null}
              {needsOptionPrice ? (
                <div className="space-y-2">
                  <Label htmlFor="bp-offer-option">Harga opsi beli (koin)</Label>
                  <Input
                    id="bp-offer-option"
                    type="number"
                    min={0}
                    max={ESPORT_TRANSFER_FEE_MAX}
                    value={optionPrice}
                    onChange={(e) => setOptionPrice(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="bp-offer-msg">Pesan untuk penjual (opsional)</Label>
            <Textarea
              id="bp-offer-msg"
              value={message}
              maxLength={300}
              placeholder="cth. Kami butuh jungler untuk turnamen bulan depan."
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Masa berlaku tawaran</Label>
            <Select value={expires} onValueChange={setExpires}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 jam</SelectItem>
                <SelectItem value="48">2 hari</SelectItem>
                <SelectItem value="72">3 hari</SelectItem>
                <SelectItem value="168">7 hari</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !others.length}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            Kirim Tawaran
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CounterDialog({ offer, onOpenChange, onSaved }: {
  offer: EsportMyOffer;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [fee, setFee] = useState(String(offer.fee));
  const [loanDays, setLoanDays] = useState(offer.loanDays ? String(offer.loanDays) : "30");
  const [optionPrice, setOptionPrice] = useState(offer.optionPrice ? String(offer.optionPrice) : "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const needsLoanDays = offer.offerType === "loan" || offer.offerType === "loan_to_buy";
  const needsOptionPrice = offer.offerType === "loan_to_buy";
  const typeMeta = ESPORT_TRANSFER_TYPE_META[offer.offerType];

  const submit = async () => {
    if (offer.offerType === "sale" && (numOrNull(fee) ?? 0) < 1) {
      toast.error("Nilai balasan minimal 1 koin.");
      return;
    }
    if (needsOptionPrice && !numOrNull(optionPrice)) {
      toast.error("Sertakan harga opsi beli pada balasan.");
      return;
    }
    setBusy(true);
    try {
      await api("esport.transfer.offers.respond", {
        id: offer.id,
        transition: "counter",
        counter: {
          fee: offer.offerType === "free_agent" ? 0 : numOrNull(fee) ?? 0,
          loanDays: needsLoanDays ? numOrNull(loanDays) ?? undefined : undefined,
          optionPrice: needsOptionPrice ? numOrNull(optionPrice) ?? undefined : undefined,
          message: message.trim() || undefined,
        },
      });
      toast.success("Balasan penawaran terkirim.");
      onSaved();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Balas Penawaran — {offer.player?.ign ?? "Pemain"}</DialogTitle>
          <DialogDescription>
            Tawaran awal dari tim {offer.fromTeam?.name ?? "tamu"}: {fmtKoin(offer.fee)}
            {typeMeta ? ` (${typeMeta.label})` : ""}. Ajukan nilai balasan Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {offer.offerType !== "free_agent" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bp-counter-fee">
                  {offer.offerType === "sale" ? "Nilai balasan (koin)" : "Biaya pinjaman balasan (koin)"}
                </Label>
                <Input
                  id="bp-counter-fee"
                  type="number"
                  min={0}
                  max={ESPORT_TRANSFER_FEE_MAX}
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </div>
              {needsLoanDays ? (
                <div className="space-y-2">
                  <Label htmlFor="bp-counter-days">Durasi pinjaman (hari)</Label>
                  <Input
                    id="bp-counter-days"
                    type="number"
                    min={1}
                    max={365}
                    value={loanDays}
                    onChange={(e) => setLoanDays(e.target.value)}
                  />
                </div>
              ) : null}
              {needsOptionPrice ? (
                <div className="space-y-2">
                  <Label htmlFor="bp-counter-option">Harga opsi beli (koin)</Label>
                  <Input
                    id="bp-counter-option"
                    type="number"
                    min={0}
                    max={ESPORT_TRANSFER_FEE_MAX}
                    value={optionPrice}
                    onChange={(e) => setOptionPrice(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="bp-counter-msg">Catatan (opsional)</Label>
            <Textarea
              id="bp-counter-msg"
              value={message}
              maxLength={300}
              placeholder="cth. Bisa dilepas di angka 9000 untuk kontrak musiman."
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Handshake className="size-4" aria-hidden />}
            Kirim Balasan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlayerDetailDialog({ profileId, onOpenChange }: {
  profileId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<EsportPlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EsportPlayerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [reviews, setReviews] = useState<EsportPlayerReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState<EsportPlayerReviewSummary | null>(null);
  const [rosterHistory, setRosterHistory] = useState<EsportRosterHistory[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api<EsportPlayerDetail>("esport.transfer.profiles.get", { profileId });
        if (!cancelled) setDetail(res);
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const res = await api<{ stats: EsportPlayerStats | null }>("esport.transfer.stats.get", { id: profileId });
        if (!cancelled) setStats(res.stats);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    (async () => {
      try {
        const [revRes, sumRes, rosterRes] = await Promise.all([
          api<{ reviews: EsportPlayerReview[] }>("esport.transfer.reviews.list", { playerProfileId: profileId }),
          api<{ summary: EsportPlayerReviewSummary }>("esport.transfer.reviews.summary", { playerProfileId: profileId }),
          api<{ items: EsportRosterHistory[] }>("esport.transfer.roster.list", { playerProfileId: profileId }),
        ]);
        if (!cancelled) {
          setReviews(revRes.reviews ?? []);
          setReviewSummary(sumRes.summary ?? null);
          setRosterHistory(rosterRes.items ?? []);
        }
      } catch {
        if (!cancelled) {
          setReviews([]);
          setReviewSummary(null);
          setRosterHistory([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const refreshReviews = async () => {
    try {
      const [revRes, sumRes] = await Promise.all([
        api<{ reviews: EsportPlayerReview[] }>("esport.transfer.reviews.list", { playerProfileId: profileId }),
        api<{ summary: EsportPlayerReviewSummary }>("esport.transfer.reviews.summary", { playerProfileId: profileId }),
      ]);
      setReviews(revRes.reviews ?? []);
      setReviewSummary(sumRes.summary ?? null);
    } catch {
      // ignore
    }
  };

  const player = detail?.player;
  const statusMeta = player ? toneOf(ESPORT_PLAYER_STATUS_META, player.status) : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail Pemain</DialogTitle>
          <DialogDescription>Kartu pemain, statistik, review, riwayat kontrak, dan perjalanan transfernya di komunitas.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Memuat detail pemain…
          </div>
        ) : error || !player || !detail ? (
          <ErrorNote message={error ?? "Detail pemain tidak ditemukan."} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <MemberAvatar name={player.name} photoData={player.photoData} size={48} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold text-foreground">
                  <span className="truncate">{player.name}</span>
                  <span className="text-sm text-muted-foreground">({player.ign})</span>
                  {statusMeta ? <Badge className={cn("border-transparent", statusMeta.tone)}>{statusMeta.label}</Badge> : null}
                  {player.owner ? <Badge variant="outline">Milik Anda</Badge> : null}
                </p>
                <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>{player.game?.icon ?? "🎮"} {player.game?.name ?? "Game"}</span>
                  {player.mainRole ? <span>{player.mainRole}</span> : null}
                  {player.region ? <span>{player.region}</span> : null}
                  {player.rankTier ? <span>{player.rankTier}</span> : null}
                  {typeof player.rankPoints === "number" ? <span>{player.rankPoints.toLocaleString("id-ID")} poin</span> : null}
                </p>
              </div>
            </div>

            {player.bio ? <p className="text-sm leading-relaxed text-muted-foreground">{player.bio}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                <ShieldCheck className="mr-1 size-3" aria-hidden />
                {player.team ? `Tim: ${player.team.name}` : "Tanpa tim"}
              </Badge>
              {player.contract ? (
                <Badge variant="outline">
                  {toneOf(ESPORT_CONTRACT_TYPE_META, player.contract.type).label}
                  {player.contract.endDate ? ` s.d. ${formatDate(player.contract.endDate)}` : ""}
                  {player.contract.optionPrice ? ` · opsi ${fmtKoin(player.contract.optionPrice)}` : ""}
                </Badge>
              ) : null}
              {player.agent?.active ? (
                <Badge variant="outline">
                  <Handshake className="mr-1 size-3" aria-hidden />
                  Agen: {player.agent.name} ({player.agent.commissionPercent}%)
                </Badge>
              ) : null}
            </div>

            <PlayerStatsCard stats={stats} loading={statsLoading} />

            <PlayerReviewsPanel
              playerProfileId={profileId}
              reviews={reviews}
              summary={reviewSummary}
              onRefresh={refreshReviews}
            />

            <RosterHistoryTimeline history={rosterHistory} title="Riwayat Tim Pemain" />

            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Listing</p>
              {detail.listings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada listing.</p>
              ) : (
                detail.listings.map((l) => {
                  const meta = toneOf(ESPORT_LISTING_STATUS_META, l.status);
                  const tMeta = ESPORT_TRANSFER_TYPE_META[l.listingType];
                  return (
                    <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("border-transparent", tMeta?.tone ?? "")}>{tMeta?.short ?? l.listingType}</Badge>
                        <span className="text-foreground">
                          {l.listingType === "free_agent" ? "Gratis" : fmtKoin(l.askingPrice)}
                          {l.loanDays ? ` · ${l.loanDays} hari` : ""}
                          {l.optionPrice ? ` · opsi ${fmtKoin(l.optionPrice)}` : ""}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <OpenWindowBadge open={l.windowOpen} name={l.windowName} />
                        <Badge className={cn("border-transparent", meta.tone)}>{meta.label}</Badge>
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Kontrak</p>
              {detail.contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada kontrak.</p>
              ) : (
                detail.contracts.map((c) => {
                  const tMeta = toneOf(ESPORT_CONTRACT_TYPE_META, c.contractType);
                  const sMeta = toneOf(ESPORT_CONTRACT_STATUS_META, c.status);
                  return (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("border-transparent", tMeta.tone)}>{tMeta.label}</Badge>
                        <span className="text-foreground">{c.team?.name ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(c.startDate)} — {c.endDate ? formatDate(c.endDate) : "tanpa batas"}
                        </span>
                      </span>
                      <Badge className={cn("border-transparent", sMeta.tone)}>{sMeta.label}</Badge>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Riwayat Transfer</p>
              {detail.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada riwayat transfer.</p>
              ) : (
                detail.history.map((h) => (
                  <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="font-medium text-foreground">{h.fromTeam?.name ?? "Free Agent"}</span>
                      <ArrowLeftRight className="size-3.5 text-muted-foreground" aria-hidden />
                      <span className="font-medium text-foreground">{h.toTeam?.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        · {ESPORT_TRANSFER_TYPE_META[h.transferType]?.short ?? h.transferType}
                        {h.fee > 0 ? ` · ${fmtKoin(h.fee)}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{h.completedAt ? formatDateTime(h.completedAt) : "—"}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelTransferDialog({ transfer, onOpenChange, onDone }: {
  transfer: EsportTransfer;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api("esport.transfer.cancel", { id: transfer.id, reason: reason.trim() || undefined });
      toast.success(
        transfer.escrowCoins > 0 ? "Transfer dibatalkan — dana escrow dikembalikan ke pembayar." : "Transfer dibatalkan.",
      );
      onDone();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Batalkan Transfer</DialogTitle>
          <DialogDescription>
            Batalkan transfer {transfer.player?.ign ?? "pemain"} dari tim "{transfer.fromTeam?.name ?? "Free Agent"}" ke
            tim "{transfer.toTeam?.name ?? "—"}"?{" "}
            {transfer.escrowCoins > 0 ? "Dana escrow akan dikembalikan penuh ke pembayar." : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bp-cancel-reason">Alasan (opsional)</Label>
          <Textarea
            id="bp-cancel-reason"
            value={reason}
            maxLength={200}
            placeholder="cth. Kesepakatan berubah."
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Tidak Jadi
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
            Batalkan Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WindowFormDialog({ window: windowRow, games, onOpenChange, onSaved }: {
  window: EsportManagedWindow | null;
  games: EsportGame[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [gameId, setGameId] = useState(windowRow?.gameId ?? games[0]?.id ?? "");
  const [name, setName] = useState(windowRow?.name ?? "");
  const [opensAt, setOpensAt] = useState(jakartaDateInput(windowRow?.opensAt));
  const [closesAt, setClosesAt] = useState(jakartaDateInput(windowRow?.closesAt));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) {
      toast.error("Nama jendela minimal 2 karakter.");
      return;
    }
    if (!gameId) {
      toast.error("Pilih game terlebih dahulu.");
      return;
    }
    if (!opensAt || !closesAt || opensAt >= closesAt) {
      toast.error("Tanggal tidak valid — pastikan tanggal tutup setelah tanggal buka.");
      return;
    }
    setBusy(true);
    try {
      await api("esport.transfer.windows.save", {
        id: windowRow?.id,
        gameId,
        name: name.trim(),
        opensAt,
        closesAt,
      });
      toast.success(windowRow ? "Jendela transfer diperbarui." : "Jendela transfer dibuat.");
      onSaved();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{windowRow ? "Ubah Jendela Transfer" : "Tambah Jendela Transfer"}</DialogTitle>
          <DialogDescription>
            Listing dan tawaran hanya bisa dibuat saat jendela terbuka. Game tanpa jendela otomatis selalu terbuka.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Game</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih game…" />
              </SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.icon ?? "🎮"} {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-window-name">Nama jendela</Label>
            <Input
              id="bp-window-name"
              value={name}
              maxLength={60}
              placeholder="cth. Jendela Musim Komunitas 2026"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bp-window-open">Dibuka</Label>
              <Input id="bp-window-open" type="date" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-window-close">Ditutup</Label>
              <Input id="bp-window-close" type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {windowRow ? "Simpan Perubahan" : "Buat Jendela"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
