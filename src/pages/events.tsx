import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { AUDIENCE_META, ROLE_RANK } from "@/lib/constants";
import { toLocalInputValue } from "@/lib/format";
import type { Audience, EventItem, GroupItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorNote, LoadingGrid, PageBanner, SectionHeading } from "@/components/common";
import { EventCard } from "@/components/cards";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const AUDIENCES = Object.keys(AUDIENCE_META) as Audience[];

function CreateEventDialog({ onCreated }: { onCreated: () => void }) {
  const { account } = useAuth();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState<Audience>("anggota");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [fundingTarget, setFundingTarget] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    if (open && rank >= 2) {
      api<{ items: GroupItem[] }>("groups.list")
        .then((data) => setGroups(data.items))
        .catch(() => {});
    }
  }, [open, rank]);

  const submit = async () => {
    if (title.trim().length < 3 || !startsAt) {
      toast.error("Judul minimal 3 karakter dan waktu mulai wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      await api("events.create", {
        title: title.trim(),
        audience,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        capacity: capacity ? Number(capacity) : undefined,
        fundingTarget: fundingTarget ? Number(fundingTarget) : undefined,
        ticketPrice: ticketPrice ? Number(ticketPrice) : undefined,
        groupId: groupId || undefined,
      });
      toast.success("Event dipublikasikan.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setStartsAt("");
      setEndsAt("");
      setCapacity("");
      setFundingTarget("");
      setTicketPrice("");
      setGroupId("");
      onCreated();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden />
          Buat event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Event baru</DialogTitle>
          <DialogDescription>
            Tentukan jenis akses: umum untuk semua pengunjung, anggota untuk janda terverifikasi, undangan
            khusus untuk tamu terpilih.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ne-title">Judul *</Label>
            <Input
              id="ne-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Seminar kemandirian ekonomi keluarga"
            />
          </div>
          <div className="space-y-2">
            <Label>Akses *</Label>
            <Select value={audience} onValueChange={(value) => setAudience(value as Audience)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((key) => (
                  <SelectItem key={key} value={key} disabled={key === "undangan" && rank < 4}>
                    {AUDIENCE_META[key].label} — {AUDIENCE_META[key].hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ne-desc">Deskripsi</Label>
            <Textarea
              id="ne-desc"
              rows={3}
              maxLength={1500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ne-loc">Tempat</Label>
            <Input
              id="ne-loc"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Aula komunitas / daring"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ne-start">Mulai *</Label>
              <Input
                id="ne-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ne-end">Selesai</Label>
              <Input
                id="ne-end"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ne-cap">Kuota kursi</Label>
              <Input
                id="ne-cap"
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ne-fund">Target dana (Rp)</Label>
              <Input
                id="ne-fund"
                type="number"
                min={0}
                value={fundingTarget}
                onChange={(event) => setFundingTarget(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ne-price">Harga tiket (Rp) — kosongkan jika gratis</Label>
            <Input
              id="ne-price"
              type="number"
              min={0}
              value={ticketPrice}
              onChange={(event) => setTicketPrice(event.target.value)}
              placeholder="0"
            />
          </div>
          {groups.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="ne-group">Grup panitia (opsional)</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih grup untuk panitia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tanpa grup</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {startsAt ? (
            <p className="text-xs text-muted-foreground">
              Waktu tersimpan sebagai {toLocalInputValue(startsAt)} (waktu lokal perangkat).
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Publikasikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
      <PageBanner art="/images/wajah-sosialita.webp">
        <SectionHeading
          title="Event komunitas"
          description="Event umum, anggota, dan undangan — dari seminar terbuka hingga pertemuan privat High Society."
          action={rank >= 2 ? <CreateEventDialog onCreated={load} /> : null}
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
              <Button asChild size="sm" variant="ghost" className="w-full">
                <Link to={`/event/${event.id}`}>Rincian & daftar peserta</Link>
              </Button>
            </EventCard>
          ))}
        </div>
      )}
    </div>
  );
}
