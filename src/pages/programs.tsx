import { useCallback, useEffect, useMemo, useState } from "react";
import { GraduationCap, Loader2, Plus } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { CATEGORY_META, ROLE_RANK } from "@/lib/constants";
import type { ProgramCategory, ProgramItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ProgramCard } from "@/components/cards";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIES = Object.keys(CATEGORY_META) as ProgramCategory[];

function CreateProgramDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ProgramCategory>("pelatihan");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("");
  const [seats, setSeats] = useState("");

  const submit = async () => {
    if (title.trim().length < 3) {
      toast.error("Judul program minimal 3 karakter.");
      return;
    }
    setBusy(true);
    try {
      await api("programs.create", {
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        schedule: schedule.trim() || undefined,
        seats: seats ? Number(seats) : undefined,
      });
      toast.success("Program dipublikasikan.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setSchedule("");
      setSeats("");
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
          Buat program
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Program baru</DialogTitle>
          <DialogDescription>
            Publikasikan akademi, pelatihan, seminar, atau penempatan kerja untuk para anggota.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="np-title">Judul *</Label>
            <Input
              id="np-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Akademi menjahit tingkat dasar"
            />
          </div>
          <div className="space-y-2">
            <Label>Kategori *</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as ProgramCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {CATEGORY_META[key].emoji} {CATEGORY_META[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-desc">Deskripsi</Label>
            <Textarea
              id="np-desc"
              rows={3}
              maxLength={1500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tujuan, materi, dan manfaat program."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="np-schedule">Jadwal</Label>
              <Input
                id="np-schedule"
                value={schedule}
                onChange={(event) => setSchedule(event.target.value)}
                placeholder="Sabtu, 09.00–11.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-seats">Kuota kursi</Label>
              <Input
                id="np-seats"
                type="number"
                min={1}
                value={seats}
                onChange={(event) => setSeats(event.target.value)}
                placeholder="20"
              />
            </div>
          </div>
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

export default function ProgramsPage() {
  const { account } = useAuth();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProgramCategory | "semua">("semua");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ items: ProgramItem[] }>("programs.list");
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
    () => (filter === "semua" ? items : items.filter((item) => item.category === filter)),
    [items, filter],
  );

  const toggle = async (program: ProgramItem) => {
    setBusyId(program.id);
    try {
      await api(program.joined ? "programs.unenroll" : "programs.enroll", { id: program.id });
      setItems((current) =>
        current.map((item) =>
          item.id === program.id
            ? {
                ...item,
                joined: !item.joined,
                participantCount: item.participantCount + (item.joined ? -1 : 1),
              }
            : item,
        ),
      );
      toast.success(program.joined ? "Pendaftaran dibatalkan." : "Berhasil mendaftar program.");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <PageBanner art="/images/wajah-pengusaha.webp">
        <SectionHeading
          title="Program peningkatan kualitas"
          description="Akademi, pelatihan, seminar, dan penempatan kerja untuk mengembangkan skill serta kemandirian anggota."
          action={rank >= 3 ? <CreateProgramDialog onCreated={load} /> : null}
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
          Semua
        </button>
        {CATEGORIES.map((key) => (
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
            <span aria-hidden className="mr-1.5">
              {CATEGORY_META[key].emoji}
            </span>
            {CATEGORY_META[key].label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingGrid count={6} />
      ) : error ? (
        <ErrorNote message={error} onRetry={load} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-5" aria-hidden />}
          title={filter === "semua" ? "Belum ada program terbuka" : "Belum ada program di kategori ini"}
          description="Program baru akan tampil di sini setelah dipublikasikan oleh anggota Sosialita atau High Society."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              canEnroll={rank >= 2}
              busy={busyId === program.id}
              onToggle={toggle}
              guestHint={
                account
                  ? "Pendaftaran program terbuka untuk anggota janda terverifikasi."
                  : "Masuk sebagai anggota untuk mendaftar program."
              }
            />
          ))}
        </div>
      )}

      {!account ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="font-display text-lg">Ingin ikut program?</CardTitle>
            <CardDescription>
              Program dapat diikuti setelah akunmu terdaftar.{" "}
              <Link to="/daftar" className="font-medium text-primary underline-offset-4 hover:underline">
                Daftar sekarang
              </Link>{" "}
              atau{" "}
              <Link to="/masuk" className="font-medium text-primary underline-offset-4 hover:underline">
                masuk
              </Link>{" "}
              jika sudah punya akun.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pengguna non janda bisa mengikuti seminar terbuka dan memberi dukungan pada profil anggota.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
