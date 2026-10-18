import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { AUDIENCE_META, ROLE_RANK } from "@/lib/constants";
import type { Audience, EventItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNote, LoadingGrid, PageBanner, SectionHeading } from "@/components/common";
import { EventCard } from "@/components/cards";
import { Link } from "@/lib/router";
import { SEO } from "@/components/seo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const AUDIENCES = Object.keys(AUDIENCE_META) as Audience[];
const DRAFT_STATUSES = ["draft", "planning", "budgeting", "pending_approval"];

export default function EventsPage() {
  const { account } = useAuth();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Audience | "semua">("semua");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ items: EventItem[] }>("events.list");
      setItems(data.items);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === "semua" ? items : items.filter((item) => item.audience === filter)),
    [items, filter],
  );

  const toggleRsvp = async (event: EventItem) => {
    setBusyId(event.id);
    try {
      const going = event.myRsvp !== "going";
      await api("events.rsvp", { id: event.id, going });
      setItems((current) =>
        current.map((item) =>
          item.id === event.id
            ? { ...item, myRsvp: going ? "going" : "not_going", goingCount: item.goingCount + (going ? 1 : -1) }
            : item,
        ),
      );
      toast.success(going ? "Kehadiranmu tercatat." : "Kehadiran dibatalkan.");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <SEO
        title="Event, Gathering & Seminar Komunitas — Panti Janda"
        description="Jadwal event, workshop, seminar bisnis, dan gathering komunitas Panti Janda. Beli tiket daring mudah dan aman."
      />
      <PageBanner art="/images/wajah-sosialita.webp">
        <SectionHeading
          title="Event komunitas"
          description="Event umum, anggota, dan undangan — kelola rencana, anggaran, dan tiket lewat wizard 6 langkah."
          action={
            rank >= 2 ? (
              <Button asChild size="sm">
                <Link to="/event/baru">
                  <Plus className="size-4" aria-hidden />
                  Buat event
                </Link>
              </Button>
            ) : null
          }
        />
      </PageBanner>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("semua")}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            filter === "semua"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-accent",
          )}
        >
          Semua event
        </button>
        {AUDIENCES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            {AUDIENCE_META[key].label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingGrid count={6} />
      ) : error ? (
        <ErrorNote message={error} onRetry={load} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-5" aria-hidden />}
          title="Belum ada event di kategori ini"
          description="Event baru akan tampil sesuai akses yang ditentukan penyelenggara."
          action={
            rank >= 2 ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/event/baru">
                  <Plus className="size-4" aria-hidden />
                  Mulai wizard event
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              canRsvp={rank >= 1}
              busy={busyId === event.id}
              onRsvp={toggleRsvp}
              guestHint={
                account
                  ? "Masuk sebagai anggota untuk konfirmasi kehadiran."
                  : "Masuk untuk konfirmasi kehadiran."
              }
            >
              {DRAFT_STATUSES.includes(event.status) ? (
                <Button asChild size="sm" variant="ghost" className="w-full">
                  <Link to={`/event/${event.id}/kelola`}>Kelola draf event</Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="ghost" className="w-full">
                  <Link to={`/event/${event.id}`}>Rincian & daftar peserta</Link>
                </Button>
              )}
            </EventCard>
          ))}
        </div>
      )}
    </div>
  );
}
