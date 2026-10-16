import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { prepareProfilePhoto, docErrorText } from "@/lib/verify-doc";
import { ESPORT_FORMAT_META, ESPORT_REG_STATUS_META, ROLE_RANK } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type {
  EsportMemberCandidate,
  EsportTeam,
  EsportTeamDetail,
  EsportTournamentDetail,
  EsportTournamentSummary,
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
import { AccountGate, EmptyState, ErrorNote, LoadingGrid, PageBanner, MemberAvatar } from "@/components/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MEMBER_ROLE_LABEL: Record<string, string> = {
  captain: "Kapten",
  member: "Anggota",
  substitute: "Cadangan",
  coach: "Pelatih",
  manager: "Manajer",
};

export default function EsportTeamsPage() {
  const { account } = useAuth();
  const rank = account ? (ROLE_RANK[account.role] ?? 0) : 0;
  const [teams, setTeams] = useState<EsportTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [manageTeamId, setManageTeamId] = useState<string | null>(null);
  const [registerTeamId, setRegisterTeamId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ items: EsportTeam[] }>("esport.teams.mine");
      setTeams(res.items);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (account) void load();
  }, [account, load]);

  if (!account) {
    return (
      <AccountGate
        title="Masuk untuk mengelola tim"
        description="Buat tim e-sport, undang anggota, dan daftarkan tim ke turnamen yang sedang dibuka."
      />
    );
  }

  if (rank < 2) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <EmptyState
          icon={<Users className="size-5" aria-hidden />}
          title="Akun belum memenuhi syarat"
          description="Tim e-sport hanya tersedia untuk anggota aktif terverifikasi Panti Janda."
        />
      </div>
    );
  }

  const manageTeam = teams.find((t) => t.id === manageTeamId) ?? null;
  const registerTeam = teams.find((t) => t.id === registerTeamId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/kompetisi-esport">
            <ArrowLeft className="size-4" aria-hidden />
            Kembali ke Kompetisi E-Sport
          </Link>
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Buat Tim Baru
        </Button>
      </div>

      <PageBanner>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl space-y-1">
            <p className="text-xs font-semibold tracking-[0.18em] text-accent-foreground uppercase">Manajemen Tim</p>
            <h1 className="font-display text-2xl font-semibold text-foreground">Tim Saya</h1>
            <p className="text-sm text-muted-foreground">
              Kapten tim dapat menambah atau menghapus anggota, mengatur peran permainan, dan mendaftarkan tim ke
              turnamen yang sedang dibuka.
            </p>
          </div>
        </div>
      </PageBanner>

      {error ? (
        <ErrorNote message={error} onRetry={() => void load()} />
      ) : loading ? (
        <LoadingGrid count={3} />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" aria-hidden />}
          title="Belum punya tim"
          description="Buat tim pertama Anda: tentukan nama, tag singkat, dan logo. Setelah itu undang anggota untuk melengkapi roster."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Buat Tim Baru
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {teams.map((team) => {
            const regMeta = (s: string) => ESPORT_REG_STATUS_META[s] ?? { label: s, tone: "bg-slate-100 text-slate-700" };
            return (
              <Card key={team.id}>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {team.logo ? (
                        <img src={team.logo} alt={team.name} className="size-12 shrink-0 rounded-2xl object-cover" />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 font-display text-lg font-semibold text-orange-700">
                          {(team.tag ?? team.name).slice(0, 3).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-lg">
                          <span className="truncate">{team.name}</span>
                          {team.tag ? <Badge variant="secondary">{team.tag}</Badge> : null}
                          {team.isCaptain ? (
                            <Badge className="border-transparent bg-amber-100 text-amber-800">
                              <Shield className="mr-1 size-3" aria-hidden />
                              Kapten
                            </Badge>
                          ) : (
                            <Badge variant="outline">{MEMBER_ROLE_LABEL[team.myMemberRole] ?? team.myMemberRole}</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          Dibuat {formatDateTime(team.createdAt)} · {team.members.length} anggota
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {team.isCaptain || rank >= 6 ? (
                        <Button size="sm" variant="outline" onClick={() => setManageTeamId(team.id)}>
                          <Pencil className="size-3.5" aria-hidden />
                          Kelola Anggota
                        </Button>
                      ) : null}
                      {team.isCaptain || rank >= 6 ? (
                        <Button size="sm" onClick={() => setRegisterTeamId(team.id)}>
                          <Trophy className="size-3.5" aria-hidden />
                          Daftarkan ke Turnamen
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {team.members.map((m) => (
                      <span
                        key={m.accountId}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
                      >
                        <MemberAvatar name={m.name} photoData={m.photoData} size={20} />
                        <span className="font-medium text-foreground">{m.name}</span>
                        {m.accountId === team.captainId ? (
                          <span className="text-amber-700">• Kapten</span>
                        ) : m.memberRole === "substitute" ? (
                          <span className="text-muted-foreground">• Cadangan</span>
                        ) : m.memberRole === "coach" ? (
                          <span className="text-muted-foreground">• Pelatih</span>
                        ) : m.memberRole === "manager" ? (
                          <span className="text-muted-foreground">• Manajer</span>
                        ) : null}
                        {m.gameRole ? <span className="text-muted-foreground">• {m.gameRole}</span> : null}
                      </span>
                    ))}
                  </div>

                  {team.registrations.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Turnamen yang diikuti
                      </p>
                      <div className="flex flex-col gap-2">
                        {team.registrations.map((r) => {
                          const meta = regMeta(r.status);
                          return (
                            <Link
                              key={r.registrationId}
                              to={`/kompetisi-esport/${r.tournamentId}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 transition-colors hover:bg-secondary"
                            >
                              <span className="flex min-w-0 items-center gap-2 text-sm">
                                <span aria-hidden>{r.gameIcon ?? "🎮"}</span>
                                <span className="truncate font-medium text-foreground">{r.tournamentTitle}</span>
                                <span className="hidden text-xs text-muted-foreground sm:inline">
                                  {r.format ? ESPORT_FORMAT_META[r.format]?.short ?? r.format : ""}
                                </span>
                              </span>
                              <Badge className={cn("shrink-0 border-transparent", meta.tone)}>{meta.label}</Badge>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Tim ini belum mengikuti turnamen. Klik “Daftarkan ke Turnamen” saat pendaftaran dibuka.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void load()} />
      {manageTeam ? (
        <ManageMembersDialog team={manageTeam} onOpenChange={(open) => !open && setManageTeamId(null)} onChanged={() => void load()} />
      ) : null}
      {registerTeam ? (
        <RegisterTeamDialog team={registerTeam} onOpenChange={(open) => !open && setRegisterTeamId(null)} onRegistered={() => void load()} />
      ) : null}
    </div>
  );
}

function CreateTeamDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setTag("");
      setLogo(null);
    }
  }, [open]);

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      setLogo(await prepareProfilePhoto(file));
    } catch (err) {
      toast.error(docErrorText(err));
    }
  };

  const submit = async () => {
    if (name.trim().length < 2) {
      toast.error("Nama tim minimal 2 karakter.");
      return;
    }
    setSaving(true);
    try {
      await api("esport.teams.create", { name: name.trim(), tag: tag.trim() || undefined, logo: logo ?? undefined });
      toast.success("Tim berhasil dibuat. Anda otomatis menjadi kapten.");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buat Tim Baru</DialogTitle>
          <DialogDescription>Nama dan tag akan tampil di bagan dan daftar peserta turnamen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {logo ? (
              <img src={logo} alt="Logo tim" className="size-16 rounded-2xl object-cover" />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-2xl bg-orange-100 text-2xl" aria-hidden>
                🛡️
              </span>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <ImagePlus className="size-4" aria-hidden />
              <span>Unggah logo (opsional)</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickLogo(e.target.files?.[0])}
              />
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="esport-team-name">Nama tim</Label>
            <Input
              id="esport-team-name"
              value={name}
              maxLength={40}
              placeholder="cth. Srikandi Jaya"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="esport-team-tag">Tag singkat (opsional)</Label>
            <Input
              id="esport-team-tag"
              value={tag}
              maxLength={6}
              placeholder="cth. SRJ"
              onChange={(e) => setTag(e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Buat Tim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageMembersDialog({
  team,
  onOpenChange,
  onChanged,
}: {
  team: EsportTeam;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<EsportTeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<EsportMemberCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ team: EsportTeamDetail }>("esport.teams.get", { teamId: team.id });
      setDetail(res.team);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [team.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api<{ items: EsportMemberCandidate[] }>("esport.teams.members.candidates", {
          teamId: team.id,
          q: q.trim(),
        });
        if (!cancelled) setCandidates(res.items);
      } catch {
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, team.id]);

  const addMember = async (accountId: string) => {
    setBusyId(accountId);
    try {
      await api("esport.teams.members.add", { teamId: team.id, accountId });
      toast.success("Anggota ditambahkan.");
      setCandidates((prev) => prev.filter((c) => c.accountId !== accountId));
      await reload();
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (accountId: string) => {
    setBusyId(accountId);
    try {
      await api("esport.teams.members.remove", { teamId: team.id, accountId });
      toast.success("Anggota dihapus dari tim.");
      await reload();
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const setRole = async (accountId: string, memberRole: string, gameRole: string | null) => {
    setBusyId(accountId);
    try {
      await api("esport.teams.members.role", { teamId: team.id, accountId, memberRole, gameRole });
      await reload();
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kelola Anggota — {team.name}</DialogTitle>
          <DialogDescription>
            Anggota inti dan cadangan. Peran permainan (mis. Gold Lane, Jungler) bersifat opsional.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Memuat anggota…
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="space-y-2">
              {detail.members.map((m) => {
                const isCaptain = m.accountId === detail.captainId;
                return (
                  <div
                    key={m.accountId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <MemberAvatar name={m.name} photoData={m.photoData} size={28} />
                      <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                      {isCaptain ? <Badge className="border-transparent bg-amber-100 text-amber-800">Kapten</Badge> : null}
                    </span>
                    {isCaptain ? (
                      <span className="text-xs text-muted-foreground">Kapten tidak dapat diubah</span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2">
                        <Select
                          value={m.memberRole}
                          onValueChange={(v) => void setRole(m.accountId, v, m.gameRole)}
                          disabled={busyId === m.accountId}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Anggota</SelectItem>
                            <SelectItem value="substitute">Cadangan</SelectItem>
                            <SelectItem value="coach">Pelatih</SelectItem>
                            <SelectItem value="manager">Manajer</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          defaultValue={m.gameRole ?? ""}
                          placeholder="Peran in-game"
                          className="h-8 w-32 text-xs"
                          maxLength={20}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (m.gameRole ?? "")) void setRole(m.accountId, m.memberRole, v || null);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={busyId === m.accountId}
                          onClick={() => void removeMember(m.accountId)}
                        >
                          <X className="size-4" aria-hidden />
                          Hapus
                        </Button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <UserPlus className="size-4" aria-hidden />
                Tambah anggota
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={q}
                  placeholder="Cari nama anggota (min. 2 huruf)…"
                  className="pl-9"
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              {searching ? (
                <p className="text-xs text-muted-foreground">Mencari…</p>
              ) : q.trim().length >= 2 && candidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">Tidak ada kandidat yang cocok.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {candidates.map((c) => (
                    <div
                      key={c.accountId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <MemberAvatar name={c.name} photoData={c.photoData} size={26} />
                        <span className="truncate text-sm text-foreground">{c.name}</span>
                        {c.nickname ? <span className="text-xs text-muted-foreground">({c.nickname})</span> : null}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === c.accountId}
                        onClick={() => void addMember(c.accountId)}
                      >
                        {busyId === c.accountId ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Plus className="size-3.5" aria-hidden />
                        )}
                        Tambah
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegisterTeamDialog({
  team,
  onOpenChange,
  onRegistered,
}: {
  team: EsportTeam;
  onOpenChange: (open: boolean) => void;
  onRegistered: () => void;
}) {
  const [open, setOpen] = useState<EsportTournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<EsportTournamentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [roster, setRoster] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ items: EsportTournamentSummary[] }>("esport.tournaments.list", {
          status: "registration",
        });
        if (!cancelled) {
          setOpen(res.items.filter((t) => t.teamCount < t.maxTeams));
        }
      } catch (err) {
        if (!cancelled) toast.error(errorText(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const res = await api<EsportTournamentDetail>("esport.tournaments.get", { id: selectedId });
        if (!cancelled) {
          setDetail(res);
          setRoster(team.members.map((m) => m.accountId));
        }
      } catch (err) {
        if (!cancelled) toast.error(errorText(err));
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, team.members]);

  const toggle = (accountId: string) => {
    setRoster((prev) => (prev.includes(accountId) ? prev.filter((v) => v !== accountId) : [...prev, accountId]));
  };

  const submit = async () => {
    if (!detail) return;
    const min = detail.tournament.rosterMin;
    const max = detail.tournament.rosterMax;
    if (roster.length < min) {
      toast.error(`Minimal ${min} pemain harus dipilih untuk roster.`);
      return;
    }
    if (roster.length > max) {
      toast.error(`Maksimal ${max} pemain untuk roster turnamen ini.`);
      return;
    }
    setSaving(true);
    try {
      await api("esport.registrations.create", {
        tournamentId: detail.tournament.id,
        teamId: team.id,
        rosterAccountIds: roster,
      });
      toast.success(`Tim "${team.name}" berhasil didaftarkan.`);
      onOpenChange(false);
      onRegistered();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Daftarkan “{team.name}” ke Turnamen</DialogTitle>
          <DialogDescription>Pilih turnamen yang pendaftarannya masih dibuka, lalu tentukan roster pemain.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Memuat turnamen…
          </div>
        ) : open.length === 0 ? (
          <EmptyState
            icon={<Trophy className="size-5" aria-hidden />}
            title="Tidak ada turnamen yang dibuka"
            description="Saat ini belum ada turnamen dengan pendaftaran terbuka. Coba lagi nanti."
          />
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Turnamen</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih turnamen…" />
                </SelectTrigger>
                <SelectContent>
                  {open.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.game?.icon ?? "🎮"} {t.title} ({t.teamCount}/{t.maxTeams} tim)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {detailLoading ? (
              <p className="text-xs text-muted-foreground">Memuat ketentuan turnamen…</p>
            ) : detail ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    {ESPORT_FORMAT_META[detail.tournament.format]?.short ?? detail.tournament.format}
                  </Badge>
                  <span className="inline-flex items-center gap-1">
                    Roster: {detail.tournament.rosterMin}–{detail.tournament.rosterMax} pemain
                  </span>
                  {!detail.permissions.registrationOpen ? (
                    <span className="text-destructive">Pendaftaran turnamen ini sedang tidak dibuka.</span>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Roster pemain ({roster.length} dipilih)</Label>
                  {team.members.map((m) => (
                    <label
                      key={m.accountId}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary/50"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-orange-600"
                        checked={roster.includes(m.accountId)}
                        onChange={() => toggle(m.accountId)}
                      />
                      <MemberAvatar name={m.name} photoData={m.photoData} size={24} />
                      <span className="text-foreground">{m.name}</span>
                      {m.memberRole === "substitute" ? (
                        <span className="text-xs text-muted-foreground">Cadangan</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || !detail || !detail.permissions.registrationOpen}
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trophy className="size-4" aria-hidden />}
            Daftar Sekarang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
