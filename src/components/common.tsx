import type { ReactNode } from "react";
import { Crown, Star, Flower2, CircleAlert, RefreshCw, Inbox, LogIn, UserPlus, Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DONATION_STATUS_LABEL,
  PLEDGE_STATUS_LABEL,
  PROFILE_STATUS_META,
  TIER_META,
  PUBLIC_BADGE_META,
  PUBLIC_TIER_META,
} from "@/lib/constants";
import type { WidowRole, PublicRole } from "@/lib/types";

const TIER_ICON: Record<WidowRole, typeof Crown> = {
  the_ceo: Gem,
  high_society: Crown,
  sosialita: Star,
  wonder_woman: Flower2,
};

const PUBLIC_BADGE_ICON: Record<"kades" | "walikota" | "gubernur" | "panglima" | "presiden", typeof Crown> = {
  presiden: Gem,
  panglima: Crown,
  gubernur: Star,
  walikota: Flower2,
  kades: CircleAlert,
};

export function PjLogo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/images/logo-pj.png"
      alt="Panti Janda"
      aria-hidden
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

export function TierBadge({
  tier,
  size = "md",
  className,
}: {
  tier: WidowRole;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = TIER_META[tier];
  const Icon = TIER_ICON[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm",
        className,
      )}
      style={{ borderColor: `${meta.accent}55`, backgroundColor: meta.soft, color: meta.accent }}
    >
      <Icon className={cn(size === "lg" ? "size-4" : "size-3.5")} aria-hidden />
      {meta.label}
    </span>
  );
}

export function PublicBadge({
  badge,
  size = "md",
  className,
}: {
  badge: "kades" | "walikota" | "gubernur" | "panglima" | "presiden";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = PUBLIC_BADGE_META[badge];
  const Icon = PUBLIC_BADGE_ICON[badge];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm",
        className,
      )}
      style={{ borderColor: `${meta.accent}55`, backgroundColor: meta.soft, color: meta.accent }}
    >
      <Icon className={cn(size === "lg" ? "size-4" : "size-3.5")} aria-hidden />
      {meta.label}
    </span>
  );
}

export function PublicTierBadge({
  tier,
  size = "md",
  className,
}: {
  tier: "ceo" | "sultan";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = PUBLIC_TIER_META[tier];
  const Icon = tier === "ceo" ? Gem : Crown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm",
        className,
      )}
      style={{ borderColor: `${meta.accent}55`, backgroundColor: meta.soft, color: meta.accent }}
    >
      <Icon className={cn(size === "lg" ? "size-4" : "size-3.5")} aria-hidden />
      {meta.label}
    </span>
  );
}

function getTierAccent(tier: WidowRole | PublicRole | null | undefined): string {
  if (!tier) return "#5B2A4E";
  if (tier in TIER_META) return TIER_META[tier as WidowRole].accent;
  if (tier in PUBLIC_BADGE_META) return PUBLIC_BADGE_META[tier as keyof typeof PUBLIC_BADGE_META].accent;
  if (tier in PUBLIC_TIER_META) return PUBLIC_TIER_META[tier as keyof typeof PUBLIC_TIER_META].accent;
  return "#5B2A4E";
}

export function MemberAvatar({
  name,
  tier,
  size = 44,
  photoData,
  className,
}: {
  name: string;
  tier?: WidowRole | PublicRole | null;
  size?: number;
  photoData?: string | null;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const accent = getTierAccent(tier);
  if (photoData) {
    return (
      <img
        src={photoData}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(140deg, ${accent}, ${accent}bb)`,
      }}
      aria-hidden
    >
      {initials || "PJ"}
    </span>
  );
}

export function StatusPill({ status, kind = "profile" }: { status: string; kind?: "profile" | "donation" | "pledge" }) {
  if (kind === "profile") {
    const meta = PROFILE_STATUS_META[status] ?? {
      label: status,
      tone: "bg-stone-100 text-stone-700 border-stone-200",
    };
    return (
      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.tone)}>
        {meta.label}
      </span>
    );
  }
  const label =
    kind === "donation" ? DONATION_STATUS_LABEL[status] ?? status : PLEDGE_STATUS_LABEL[status] ?? status;
  const tone =
    status === "settled" || status === "selesai"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : status === "failed" || status === "ditolak"
        ? "bg-rose-100 text-rose-900 border-rose-200"
        : "bg-amber-100 text-amber-900 border-amber-200";
  return <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", tone)}>{label}</span>;
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-xs text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl space-y-1.5">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.18em] text-accent-foreground uppercase">{eyebrow}</p>
        ) : null}
        <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">{title}</h2>
        {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageBanner({
  children,
  art = "/images/hero-community.webp",
  className,
}: {
  children: ReactNode;
  art?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-chart-1/15 via-card to-chart-2/15 px-5 py-7 shadow-sm sm:px-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-chart-1/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-chart-2/20 blur-3xl" aria-hidden />
      <img
        src={art}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-2/5 object-cover object-[center_30%] opacity-[0.18] [mask-image:linear-gradient(to_left,black,transparent)] sm:block"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="neu-flat gradient-card rounded-2xl px-3 py-3 sm:px-5 sm:py-4">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-foreground sm:text-2xl">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </span>
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        {description ? <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)} aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

export function ErrorNote({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground",
        className,
      )}
      role="alert"
    >
      <span className="flex items-center gap-2">
        <CircleAlert className="size-4 text-destructive" aria-hidden />
        {message}
      </span>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden />
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

export function InlineBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("font-normal", className)}>
      {children}
    </Badge>
  );
}

export function AccountGate({
  title,
  description,
  actionLabel = "Masuk",
  showRegister = true,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  showRegister?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
        <LogIn className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/masuk">{actionLabel}</Link>
        </Button>
        {showRegister ? (
          <Button asChild variant="outline">
            <Link to="/daftar">
              <UserPlus className="size-4" aria-hidden />
              Daftar
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
