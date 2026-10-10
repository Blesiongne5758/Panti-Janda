import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock, Plus, Users } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { ROLE_RANK, TIER_META, WIDOW_ROLES } from "@/lib/constants";
import type { GroupItem, WidowRole } from "@/lib/types";
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
import { GroupCard } from "@/components/cards";
import { Link } from "@/lib/router";
import { toast } from "sonner";

interface GroupDetail extends GroupItem {
  members: string[];
}

function CreateGroupDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audienceMinRole, setAudienceMinRole] = useState<WidowRole>("wonder_woman");
  const [capacity, setCapacity] = useState("");

  const submit = async () => {
    if (name.trim().length < 3) {
      toast.error("Nama grup minimal 3 karakter.");
      return;
    }
    setBusy(true);
    try {
      await api("groups.create", {
        name: name.trim(),
        description: description.trim() || undefined,
        audienceMinRole,
        capacity: capacity ? Number(capacity) : undefined,
      });
      toast.success("Grup dibuat.");
      setOpen(false);
      setName("");
      setDescription("");
      setCapacity("");
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
          Buat grup
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Grup minat baru</DialogTitle>
          <DialogDescription>
            Grup hanya terlihat oleh tier yang kamu tentukan dan di atasnya — bukan untuk pengguna non janda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ng-name">Nama grup *</Label>
            <Input
              id="ng-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Kelas menjahit bersama"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ng-desc">Deskripsi</Label>
            <Textarea
              id="ng-desc"
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Minimal tier</Label>
              <Select value={audienceMinRole} onValueChange={(value) => setAudienceMinRole(value as WidowRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDOW_ROLES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {TIER_META[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ng-cap">Kuota anggota</Label>
              <Input
                id="ng-cap"
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                placeholder="30"
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
            Buat grup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GroupsPage() {
  const { account } = useAuth();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const [items, setItems] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(rank >= 2);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ items: GroupItem[] }>("groups.list");
      setItems(data.items);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rank >= 2) void load();
  }, [load, rank]);

  const toggle = async (group: GroupItem) => {
    setBusyId(group.id);
    try {
      await api(group.joined ? "groups.leave" : "groups.join", { id: group.id });
      setItems((current) =>
        current.map((item) =>
          item.id === group.id
            ? { ...item, joined: !item.joined, memberCount: item.memberCount + (item.joined ? -1 : 1) }
            : item,
        ),
      );
      toast.success(group.joined ? "Kamu keluar dari grup." : "Berhasil bergabung.");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (group: GroupItem) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const result = await api<{ group: GroupDetail }>("groups.get", { id: group.id });
      setDetail(result.group);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setDetailLoading(false);
    }
  };

  if (rank < 2) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16">
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-secondary">
              <Lock className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <CardTitle className="font-display text-2xl">Grup minat khusus anggota</CardTitle>
            <CardDescription className="max-w-lg">
              Grup dan kegiatan kelompok dibangun oleh anggota Sosialita untuk anggota terverifikasi — dari
              kelas keterampilan hingga lingkaran dukungan. Konten ini tidak terbuka untuk pengguna non janda.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            {account ? (
              <p className="text-sm text-muted-foreground">
                Akunmu saat ini berperan sebagai {ROLE_RANK[account.role] >= 2 ? "anggota" : "pengguna non janda"}. Jika
                kamu anggota janda, tunggu verifikasi admin atau hubungi pengurus komunitas.
              </p>
            ) : (
              <Button asChild>
                <Link to="/daftar">Daftar sebagai anggota janda</Link>
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link to="/jelajah">Jelajahi profil Wonder Woman</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <PageBanner art="/images/wajah-umkm.webp">
        <SectionHeading
          title="Grup & kegiatan minat"
          description="Ruang kelompok untuk program berkelanjutan, kelas bersama, dan lingkaran dukungan antar-anggota."
          action={rank >= 3 ? <CreateGroupDialog onCreated={load} /> : null}
        />
      </PageBanner>

      {loading ? (
        <LoadingGrid count={6} />
      ) : error ? (
        <ErrorNote message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" aria-hidden />}
          title="Belum ada grup untuk tier-mu"
          description="Grup baru akan tampil setelah dibuat oleh anggota Sosialita atau High Society."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              canJoin
              busy={busyId === group.id}
              onToggle={toggle}
              onOpen={openDetail}
            />
          ))}
        </div>
      )}

      <Dialog open={detailLoading || detail !== null} onOpenChange={(open) => (!open ? setDetail(null) : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{detail?.name ?? "Memuat grup…"}</DialogTitle>
            <DialogDescription>
              {detail ? `Terbuka untuk ${TIER_META[detail.audienceMinRole].label} ke atas` : "Mengambil daftar anggota"}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            detail.members.length ? (
              <ul className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
                {detail.members.map((name, index) => (
                  <li
                    key={`${name}-${index}`}
                    className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada anggota yang bergabung.</p>
            )
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
