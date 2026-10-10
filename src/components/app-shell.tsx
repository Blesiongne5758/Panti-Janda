import { useState, useEffect, useRef, type ReactNode } from "react";
import { Bell, Crown, HandHeart, LayoutDashboard, LogOut, Menu, ShieldCheck, UserRound } from "lucide-react";
import { Link, useRoute } from "@/lib/router";
import { useAuth } from "@/lib/session";
import { api } from "@/lib/api";
import { ROLE_LABEL, ROLE_RANK, PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MemberAvatar, TierBadge } from "@/components/common";
import { Separator } from "@/components/ui/separator";
import type { NotificationItem } from "@/lib/types";

const NAV = [
  { to: "/", label: "Beranda", exact: true },
  { to: "/jelajah", label: "Jelajah" },
  { to: "/program", label: "Program" },
  { to: "/event", label: "Event" },
  { to: "/galang-dana", label: "Galang Dana" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/learning-center", label: "Learning" },
  { to: "/koin", label: "Koin" },
];

function NavLinks({ onNavigate, memberOnly }: { onNavigate?: () => void; memberOnly: boolean }) {
  const { path } = useRoute();
  const clean = path.split("?")[0];
  const items = memberOnly
    ? [...NAV, { to: "/grup", label: "Grup" }, { to: "/pesan", label: "Pesan" }]
    : NAV;
  return (
    <>
      {items.map((item) => {
        const active = item.exact ? clean === item.to : clean.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await api<{ items: NotificationItem[]; unreadCount: number }>("notifications.list");
      if (active && res) {
        setItems(res.items);
        setUnread(res.unreadCount);
      }
    };
    void load();
    const interval = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    await api("notifications.markRead", { all: true });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const markOneRead = async (id: string) => {
    await api("notifications.markRead", { id });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Notifikasi"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Notifikasi</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-primary hover:underline"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Belum ada notifikasi
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.read) void markOneRead(n.id);
                    if (n.link) {
                      window.location.hash = n.link.replace(/^#/, "");
                      setOpen(false);
                    }
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-secondary/50",
                    !n.read && "bg-primary/5",
                  )}
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    {n.type === "follow" && <UserRound className="size-3.5" aria-hidden />}
                    {n.type === "message" && <HandHeart className="size-3.5" aria-hidden />}
                    {n.type === "donation" && <Crown className="size-3.5" aria-hidden />}
                    {n.type === "verification" && <ShieldCheck className="size-3.5" aria-hidden />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      {n.actorName && <span className="font-semibold">{n.actorName} </span>}
                      <span className="text-muted-foreground">{n.message}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { account, profile, logout, ready } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const rank = account ? ROLE_RANK[account.role] : 0;
  const member = rank >= 2;

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="texture-grain absolute inset-0" />
        <div className="animate-drift absolute -top-40 -left-32 size-[30rem] rounded-full bg-[#B98A2F]/10 blur-3xl" />
        <div className="absolute top-1/4 -right-40 size-[34rem] rounded-full bg-[#C2603E]/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 size-[30rem] rounded-full bg-[#5B2A4E]/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <HandHeart className="size-5" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-semibold text-foreground">{PLATFORM_NAME}</span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">Komunitas & ruang tumbuh</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
            <NavLinks memberOnly={member} />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {!ready ? (
              <div className="h-9 w-24 animate-pulse rounded-full bg-secondary" aria-hidden />
            ) : account ? (
              <>
                {rank >= 5 ? (
                  <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                    <Link to="/admin">
                      <ShieldCheck className="size-3.5" aria-hidden />
                      Admin
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/dasbor">
                    <LayoutDashboard className="size-3.5" aria-hidden />
                    Dasbor
                  </Link>
                </Button>
                <NotificationBell />
                <Link
                  to="/dasbor"
                  className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 transition-colors hover:bg-secondary"
                >
                  <MemberAvatar
                    name={profile?.nickname ?? account.displayName ?? "Anggota"}
                    tier={profile?.tier}
                    photoData={profile?.photoData}
                    size={28}
                  />
                  <span className="hidden max-w-28 truncate text-xs font-medium sm:block">
                    {profile?.nickname ?? account.displayName ?? ROLE_LABEL[account.role]}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Keluar"
                  onClick={() => void logout()}
                  className="hidden sm:inline-flex"
                >
                  <LogOut className="size-4" aria-hidden />
                </Button>
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="md:hidden" aria-label="Buka menu">
                      <Menu className="size-4" aria-hidden />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-72">
                    <SheetHeader>
                      <SheetTitle className="font-display">Menu</SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-1 px-4">
                      <NavLinks memberOnly={member} onNavigate={() => setMenuOpen(false)} />
                      <Separator className="my-3" />
                      <Link
                        to="/dasbor"
                        onClick={() => setMenuOpen(false)}
                        className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
                      >
                        Dasbor
                      </Link>
                      {rank >= 5 ? (
                        <Link
                          to="/admin"
                          onClick={() => setMenuOpen(false)}
                          className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
                        >
                          Admin
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          void logout();
                        }}
                        className="rounded-full px-3.5 py-1.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
                      >
                        Keluar
                      </button>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/masuk">
                    <UserRound className="size-3.5" aria-hidden />
                    Masuk
                  </Link>
                </Button>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link to="/daftar">
                    <Crown className="size-3.5" aria-hidden />
                    Daftar
                  </Link>
                </Button>
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="md:hidden" aria-label="Buka menu">
                      <Menu className="size-4" aria-hidden />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-72">
                    <SheetHeader>
                      <SheetTitle className="font-display">Menu</SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-1 px-4">
                      <NavLinks memberOnly={false} onNavigate={() => setMenuOpen(false)} />
                      <Separator className="my-3" />
                      <Link
                        to="/masuk"
                        onClick={() => setMenuOpen(false)}
                        className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary"
                      >
                        Masuk
                      </Link>
                      <Link
                        to="/daftar"
                        onClick={() => setMenuOpen(false)}
                        className="rounded-full px-3.5 py-1.5 text-sm font-medium text-primary"
                      >
                        Daftar
                      </Link>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>

      <footer className="relative mt-16 overflow-hidden border-t border-border">
        <div aria-hidden className="absolute inset-0">
          <img
            src="/images/hero-community.webp"
            alt=""
            className="h-full w-full object-cover object-[center_32%] opacity-[0.16]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background/70" />
        </div>
        <div className="relative mx-auto grid w-full max-w-6xl gap-6 px-3 py-8 sm:gap-8 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <p className="font-display text-lg font-semibold text-foreground">{PLATFORM_NAME}</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{PLATFORM_TAGLINE}</p>
            <div className="flex flex-wrap gap-2">
              <TierBadge tier="high_society" size="sm" />
              <TierBadge tier="sosialita" size="sm" />
              <TierBadge tier="wonder_woman" size="sm" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">Jelajahi</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li>
                <Link to="/jelajah" className="hover:text-foreground">
                  Profil anggota
                </Link>
              </li>
              <li>
                <Link to="/program" className="hover:text-foreground">
                  Akademi & pelatihan
                </Link>
              </li>
              <li>
                <Link to="/event" className="hover:text-foreground">
                  Event komunitas
                </Link>
              </li>
              <li>
                <Link to="/marketplace" className="hover:text-foreground">
                  Marketplace
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">Untuk anggota</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li>
                <Link to="/daftar" className="hover:text-foreground">
                  Daftar sebagai anggota
                </Link>
              </li>
              <li>
                <Link to="/dasbor" className="hover:text-foreground">
                  Dasbor anggota
                </Link>
              </li>
              <li>
                <Link to="/masuk" className="hover:text-foreground">
                  Masuk
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="relative border-t border-border/70 py-4 text-center text-xs text-muted-foreground">
          {PLATFORM_NAME} — dibangun bersama untuk saling menguatkan.
        </div>
      </footer>
    </div>
  );
}
