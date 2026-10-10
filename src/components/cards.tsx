import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Clock,
  Coins,
  GraduationCap,
  MapPin,
  MessageCircle,
  Target,
  Ticket,
  UserRound,
  Users,
} from "lucide-react";
import { Link } from "@/lib/router";
import { formatDate, formatRupiah, timeAgo } from "@/lib/format";
import { AUDIENCE_META, CATEGORY_META, TIER_META } from "@/lib/constants";
import type { EventItem, GroupItem, Profile, ProgramItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Chip, MemberAvatar, TierBadge } from "@/components/common";
import { cn } from "@/lib/utils";

export function ProfileCard({ profile }: { profile: Profile }) {
  const facts = [
    profile.city ? { icon: MapPin, text: profile.city } : null,
    profile.age ? { icon: UserRound, text: `${profile.age} tahun` } : null,
    profile.dependents !== null ? { icon: Users, text: `${profile.dependents} tanggungan` } : null,
    profile.employmentStatus ? { icon: Briefcase, text: profile.employmentStatus } : null,
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <div className="h-1.5 w-full" style={{ backgroundColor: TIER_META[profile.tier].accent }} aria-hidden />
      <CardHeader className="gap-3 pt-5">
        <div className="flex items-start gap-3">
          <MemberAvatar name={profile.nickname} tier={profile.tier} size={46} photoData={profile.photoData} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold text-foreground">{profile.nickname}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <TierBadge tier={profile.tier} size="sm" />
              {profile.status === "verified" ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  Terverifikasi
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {profile.mainTarget ? (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Target className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{profile.mainTarget}</span>
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pb-4">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {facts.slice(0, 3).map((fact) => (
            <li key={fact.text} className="flex items-center gap-2">
              <fact.icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{fact.text}</span>
            </li>
          ))}
        </ul>
        {profile.skills.length ? (
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.slice(0, 4).map((skill) => (
              <Chip key={skill}>{skill}</Chip>
            ))}
            {profile.skills.length > 4 ? <Chip>+{profile.skills.length - 4}</Chip> : null}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="border-t border-border bg-secondary/40 px-6 py-3">
        <Button asChild size="sm" className="w-full">
          <Link to={`/janda/${profile.id}`}>Lihat profil & dukung</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ProgramCard({
  program,
  onToggle,
  busy,
  canEnroll,
  guestHint,
}: {
  program: ProgramItem;
  onToggle?: (program: ProgramItem) => void;
  busy?: boolean;
  canEnroll: boolean;
  guestHint?: string;
}) {
  const meta = CATEGORY_META[program.category];
  return (
    <Card className="flex h-full flex-col gap-0 py-0">
      <CardHeader className="gap-2 pt-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
            <span aria-hidden>{meta.emoji}</span>
            {meta.label}
          </span>
          {program.seats ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" aria-hidden />
              {program.participantCount}/{program.seats} peserta
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" aria-hidden />
              {program.participantCount} peserta
            </span>
          )}
        </div>
        <h3 className="font-display text-lg leading-snug font-semibold text-foreground">{program.title}</h3>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 pb-4">
        {program.description ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{program.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {program.schedule ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden />
              {program.schedule}
            </span>
          ) : null}
          {program.creatorName ? (
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="size-3.5" aria-hidden />
              oleh {program.creatorName}
            </span>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="border-t border-border bg-secondary/40 px-6 py-3">
        {canEnroll ? (
          <Button
            size="sm"
            variant={program.joined ? "outline" : "default"}
            className="w-full"
            disabled={busy}
            onClick={() => onToggle?.(program)}
          >
            {program.joined ? "Batalkan pendaftaran" : "Daftar program"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">{guestHint}</p>
        )}
      </CardFooter>
    </Card>
  );
}

export function EventCard({
  event,
  onRsvp,
  busy,
  canRsvp,
  guestHint,
  children,
}: {
  event: EventItem;
  onRsvp?: (event: EventItem) => void;
  busy?: boolean;
  canRsvp: boolean;
  guestHint?: string;
  children?: React.ReactNode;
}) {
  const audience = AUDIENCE_META[event.audience];
  const cancelled = event.status === "cancelled";
  const isPast = new Date(event.startsAt).getTime() < Date.now();
  return (
    <Card className={cn("flex h-full flex-col gap-0 py-0", cancelled && "opacity-70")}>
      <CardHeader className="gap-2 pt-5 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
              event.audience === "umum" && "bg-emerald-100 text-emerald-900",
              event.audience === "anggota" && "bg-indigo-100 text-indigo-900",
              event.audience === "undangan" && "bg-amber-100 text-amber-900",
            )}
          >
            {audience.label}
          </span>
          {event.ticketPrice ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-900">
              <Ticket className="size-3" aria-hidden />
              {formatRupiah(event.ticketPrice)}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900">
              Gratis
            </span>
          )}
          {event.invited ? (
            <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
              Anda diundang
            </span>
          ) : null}
          {event.isCommittee ? (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-900">
              Panitia
            </span>
          ) : null}
          {cancelled ? (
            <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-900">
              Dibatalkan
            </span>
          ) : null}
        </div>
        <h3 className="font-display text-lg leading-snug font-semibold text-foreground">{event.title}</h3>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 pb-4">
        {event.description ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{event.description}</p>
        ) : null}
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {formatDate(event.startsAt)}
          </li>
          {event.location ? (
            <li className="flex items-center gap-2">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{event.location}</span>
            </li>
          ) : null}
          <li className="flex items-center gap-2">
            <Users className="size-3.5 shrink-0" aria-hidden />
            {event.goingCount} akan hadir
            {event.capacity ? ` · kuota ${event.capacity}` : ""}
          </li>
          {event.fundingTarget ? (
            <li className="flex items-center gap-2">
              <Coins className="size-3.5 shrink-0" aria-hidden />
              Target dana {formatRupiah(event.fundingTarget)}
            </li>
          ) : null}
        </ul>
        {event.creatorName ? (
          <p className="text-xs text-muted-foreground">Digagas oleh {event.creatorName}</p>
        ) : null}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2 border-t border-border bg-secondary/40 px-6 py-3">
        {canRsvp ? (
          <Button
            size="sm"
            variant={event.myRsvp === "going" ? "outline" : "default"}
            disabled={busy || cancelled || isPast}
            onClick={() => onRsvp?.(event)}
          >
            {cancelled ? "Event dibatalkan" : isPast ? "Sudah berlalu" : event.myRsvp === "going" ? "Batalkan kehadiran" : "Saya akan hadir"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">{guestHint}</p>
        )}
        {children}
      </CardFooter>
    </Card>
  );
}

export function GroupCard({
  group,
  onToggle,
  busy,
  canJoin,
  guestHint,
  onOpen,
}: {
  group: GroupItem;
  onToggle?: (group: GroupItem) => void;
  busy?: boolean;
  canJoin: boolean;
  guestHint?: string;
  onOpen?: (group: GroupItem) => void;
}) {
  return (
    <Card className="flex h-full flex-col gap-0 py-0">
      <CardHeader className="gap-2 pt-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            <Users className="size-3.5" aria-hidden />
            {group.memberCount} anggota
            {group.capacity ? ` / ${group.capacity}` : ""}
          </span>
          <TierBadge tier={group.audienceMinRole} size="sm" />
        </div>
        <h3 className="font-display text-lg leading-snug font-semibold text-foreground">{group.name}</h3>
        <p className="text-xs text-muted-foreground">
          Terbuka untuk {TIER_META[group.audienceMinRole].label} ke atas
        </p>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {group.description ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{group.description}</p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t border-border bg-secondary/40 px-6 py-3">
        {canJoin ? (
          <>
            {group.joined ? (
              <Button asChild size="sm" className="flex-1">
                <Link to={`/pesan?grup=${group.id}`}>
                  <MessageCircle className="size-3.5" aria-hidden />
                  Chat grup
                </Link>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onOpen?.(group)}>
              Lihat anggota
            </Button>
            <Button
              size="sm"
              variant={group.joined ? "outline" : "default"}
              className="flex-1"
              disabled={busy}
              onClick={() => onToggle?.(group)}
            >
              {group.joined ? "Keluar grup" : "Gabung grup"}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{guestHint}</p>
        )}
      </CardFooter>
    </Card>
  );
}

export function UpdateCard({
  title,
  body,
  createdAt,
  children,
}: {
  title: string;
  body: string;
  createdAt: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{timeAgo(createdAt)}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{body}</p>
      {children}
    </article>
  );
}
