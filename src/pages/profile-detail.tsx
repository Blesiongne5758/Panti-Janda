import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Coins,
  ExternalLink,
  Flag,
  GraduationCap,
  HandCoins,
  HandHeart,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Pencil,
  Target,
  Trophy,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { formatRupiah } from "@/lib/format";
import { ROLE_RANK, SUPPORT_META, TIER_META, BADGE_META } from "@/lib/constants";
import type { Badge, ProfileDetail as ProfileDetailData, SupportType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Chip, EmptyState, ErrorNote, LoadingGrid, MemberAvatar, TierBadge } from "@/components/common";
import { ReportDialog, UpdatesSection } from "@/components/updates";
import { toast } from "sonner";

const PRESET_AMOUNTS = [50000, 100000, 250000, 500000];

function DonationDialog({
  profileId,
  profileName,
  open,
  onOpenChange,
}: {
  profileId: string;
  profileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { account } = useAuth();
  const [amount, setAmount] = useState<number>(100000);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const submit = async () => {
    const value = custom ? Number(custom.replace(/\D/g, "")) : amount;
    if (!value || value < 10000) {
      toast.error("Minimal dukungan dana Rp10.000.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ redirectUrl: string; orderId: string }>("donations.create", {
        profileId,
        amount: value,
        supporterName: name || undefined,
        supporterEmail: email || undefined,
      });
      setPaymentUrl(data.redirectUrl);
      toast.success("Halaman pembayaran siap. Selesaikan pembayaran Anda.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setPaymentUrl(null);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Dukung {profileName}</DialogTitle>
          <DialogDescription>
            Dukungan dana diproses melalui gerbang pembayaran yang aman. Jumlah dan pesan Anda bersifat rahasia.
          </DialogDescription>
        </DialogHeader>

        {paymentUrl ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Transaksi dibuat. Selesaikan pembayaran pada halaman yang terbuka, lalu statusnya diperbarui otomatis.
            </div>
            <Button asChild className="w-full" size="lg">
              <a href={paymentUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                Buka halaman pembayaran
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Jika jendela tidak terbuka otomatis, gunakan tombol di atas. Anda dapat menutup dialog ini setelah
              pembayaran selesai.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pilih nominal</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setAmount(preset);
                      setCustom("");
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      !custom && amount === preset
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    {formatRupiah(preset)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="donation-custom">Nominal lain</Label>
                <Input
                  id="donation-custom"
                  inputMode="numeric"
                  placeholder="cth. 150000"
                  value={custom}
                  onChange={(event) => setCustom(event.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="donation-name">Nama Anda (opsional)</Label>
                <Input
                  id="donation-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={account?.displayName ?? "Sahabat Panti Janda"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="donation-email">Email (opsional, untuk tanda terima)</Label>
              <Input
                id="donation-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={account?.email ?? "nama@email.com"}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {paymentUrl ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Batal
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <HandCoins className="size-4" aria-hidden />}
                Lanjut ke pembayaran
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PledgeDialog({
  profileId,
  profileName,
  open,
  onOpenChange,
}: {
  profileId: string;
  profileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { account } = useAuth();
  const [supporterName, setSupporterName] = useState("");
  const [contact, setContact] = useState("");
  const [supportType, setSupportType] = useState<SupportType>("dana");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const name = supporterName.trim() || account?.displayName || "";
    if (name.length < 2) {
      toast.error("Isi nama Anda minimal 2 karakter.");
      return;
    }
    setBusy(true);
    try {
      await api("pledges.create", {
        profileId,
        supporterName: name,
        contact: contact || undefined,
        supportType,
        amount: amount ? Number(amount.replace(/\D/g, "")) : undefined,
        message: message || undefined,
      });
      setDone(true);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setDone(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Komitmen dukungan untuk {profileName}</DialogTitle>
          <DialogDescription>
            Sampaikan bentuk dukungan Anda — dana, jasa/keahlian, atau barang. Tim komunitas akan menghubungi Anda
            untuk menindaklanjuti. Tidak perlu akun untuk mengirim komitmen.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Komitmen Anda sudah tercatat. Admin akan meninjau dan menghubungi Anda melalui kontak yang diberikan.
            </div>
            <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pledge-name">Nama Anda</Label>
                <Input
                  id="pledge-name"
                  value={supporterName}
                  onChange={(event) => setSupporterName(event.target.value)}
                  placeholder={account?.displayName ?? "Nama atau nama komunitas"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pledge-contact">Kontak (WhatsApp / email)</Label>
                <Input
                  id="pledge-contact"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="0812… atau nama@email.com"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bentuk dukungan</Label>
                <Select value={supportType} onValueChange={(value) => setSupportType(value as SupportType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SUPPORT_META) as SupportType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {SUPPORT_META[type].label} — {SUPPORT_META[type].hint}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pledge-amount">Perkiraan nilai (opsional)</Label>
                <Input
                  id="pledge-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
                  placeholder="cth. 500000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pledge-message">Pesan atau keterangan</Label>
              <Textarea
                id="pledge-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                maxLength={600}
                placeholder="Contoh: saya bisa membantu pelatihan menjahit, atau menyediakan bahan baku."
              />
            </div>
          </div>
        )}

        {!done ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Batal
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <HandHeart className="size-4" aria-hidden />}
              Kirim komitmen
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ProfileDetailPage({ profileId }: { profileId: string }) {
  const { account, profile: ownProfile } = useAuth();
  const [data, setData] = useState<ProfileDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [donationOpen, setDonationOpen] = useState(false);
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [follow, setFollow] = useState({ following: false, count: 0 });
  const [followBusy, setFollowBusy] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(null);
    api<ProfileDetailData>("profiles.get", { id: profileId })
      .then(setData)
      .catch((error) => setFailed(errorText(error)))
      .finally(() => setLoading(false));
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    setFollow({ following: data.follow.viewerFollows, count: data.follow.followerCount });
    api<{ items: Badge[] }>("kpi.badges", { accountId: data.profile.accountId })
      .then((result) => setBadges(result.items))
      .catch(() => setBadges([]));
  }, [data]);

  const openSupport = () => {
    if (data?.paymentEnabled) setDonationOpen(true);
    else setPledgeOpen(true);
  };

  const toggleFollow = async () => {
    if (!data) return;
    setFollowBusy(true);
    try {
      const result = await api<{ following: boolean }>("follows.toggle", {
        accountId: data.profile.accountId,
      });
      setFollow((current) => ({
        following: result.following,
        count: Math.max(0, current.count + (result.following ? 1 : -1)),
      }));
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <LoadingGrid count={3} />
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Profil tidak dapat ditampilkan"
          description={failed ?? "Profil ini tidak tersedia atau belum diverifikasi untuk ditampilkan publik."}
          action={
            <Button asChild variant="outline">
              <Link to="/jelajah">
                <ArrowLeft className="size-4" aria-hidden />
                Kembali ke jelajah
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { profile, support } = data;
  const isOwn = account?.id === profile.accountId;
  const canComment = Boolean(account);
  const canFollow = account !== null && ROLE_RANK[account.role] >= 2 && !isOwn;

  const facts = [
    { icon: MapPin, label: "Kota", value: profile.city },
    { icon: UserRound, label: "Umur", value: profile.age ? `${profile.age} tahun` : null },
    { icon: Users, label: "Tanggungan", value: profile.dependents !== null ? `${profile.dependents} orang` : null },
    { icon: Briefcase, label: "Status pekerjaan", value: profile.employmentStatus },
  ].filter((fact) => fact.value);

  return (
    <div className="mx-auto w-full max-w-6xl animate-rise px-4 py-10 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-5">
        <Link to="/jelajah">
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke jelajah
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden py-0">
            <div className="h-2 w-full" style={{ backgroundColor: TIER_META[profile.tier].accent }} aria-hidden />
            <CardHeader className="gap-4 pt-6">
              <div className="flex flex-wrap items-start gap-4">
                <MemberAvatar
                  name={profile.nickname}
                  tier={profile.tier}
                  size={64}
                  photoData={profile.photoData}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                      {profile.nickname}
                    </h1>
                    <TierBadge tier={profile.tier} size="md" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {profile.status === "verified" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <BadgeCheck className="size-3.5" aria-hidden />
                        Terverifikasi admin
                      </span>
                    ) : null}
                    <span>Bergabung {new Date(profile.createdAt).getFullYear()}</span>
                    {follow.count > 0 ? <span>{follow.count} pengikut</span> : null}
                  </div>
                  {badges.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {badges.slice(0, 6).map((badge) => {
                        const meta = BADGE_META[badge.badgeType];
                        return (
                          <span
                            key={badge.id}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta?.color ?? "bg-secondary text-secondary-foreground"}`}
                            title={meta?.label ?? badge.label}
                          >
                            <span aria-hidden>{meta?.icon ?? "🏅"}</span>
                            <span>{meta?.label ?? badge.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Identitas asli anggota dilindungi. Profil publik hanya menampilkan nama panggilan dan informasi yang
                    dibagikan sukarela.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canFollow ? (
                    <Button
                      variant={follow.following ? "outline" : "default"}
                      size="sm"
                      onClick={toggleFollow}
                      disabled={followBusy}
                    >
                      {followBusy ? (
                        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                      ) : follow.following ? (
                        <UserCheck className="size-3.5" aria-hidden />
                      ) : (
                        <UserPlus className="size-3.5" aria-hidden />
                      )}
                      {follow.following ? "Mengikuti" : "Ikuti"}
                    </Button>
                  ) : null}
                  {canFollow ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/pesan?with=${profile.accountId}`}>
                        <MessageCircle className="size-3.5" aria-hidden />
                        Pesan
                      </Link>
                    </Button>
                  ) : null}
                  {isOwn ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/dasbor">
                        <Pencil className="size-3.5" aria-hidden />
                        Kelola profil
                      </Link>
                    </Button>
                  ) : canComment ? (
                    <ReportDialog
                      targetType="profile"
                      targetId={profile.id}
                      trigger={
                        <Button variant="ghost" size="sm" className="text-muted-foreground">
                          <Flag className="size-3.5" aria-hidden />
                          Laporkan
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pb-7">
              {facts.length ? (
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {facts.map((fact) => (
                    <div key={fact.label} className="rounded-xl border border-border bg-secondary/40 px-3.5 py-3">
                      <dt className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        <fact.icon className="size-3.5" aria-hidden />
                        {fact.label}
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-foreground">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {profile.bio ? (
                <div className="space-y-2">
                  <h2 className="font-display text-lg font-semibold text-foreground">Tentang</h2>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{profile.bio}</p>
                </div>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                {profile.mainTarget ? (
                  <div className="space-y-1.5 rounded-2xl border border-border bg-card px-4 py-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent-foreground uppercase">
                      <Trophy className="size-3.5" aria-hidden />
                      Target utama
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{profile.mainTarget}</p>
                  </div>
                ) : null}
                {profile.needsTarget ? (
                  <div className="space-y-1.5 rounded-2xl border border-border bg-card px-4 py-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
                      <Target className="size-3.5" aria-hidden />
                      Target kebutuhan
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{profile.needsTarget}</p>
                  </div>
                ) : null}
              </div>

              {profile.skills.length ? (
                <div className="space-y-2">
                  <h2 className="font-display text-lg font-semibold text-foreground">Keahlian</h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill) => (
                      <Chip key={skill}>{skill}</Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              {profile.trainings.length ? (
                <div className="space-y-2">
                  <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                    <GraduationCap className="size-4.5 text-primary" aria-hidden />
                    Pelatihan yang diikuti
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {profile.trainings.map((training) => (
                      <li key={training}>
                        <Chip>{training}</Chip>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {profile.interests.length ? (
                <div className="space-y-2">
                  <h2 className="font-display text-lg font-semibold text-foreground">Minat & kelompok</h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((interest) => (
                      <Chip key={interest}>{interest}</Chip>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <section className="space-y-4">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
              <MessageCircle className="size-5 text-primary" aria-hidden />
              Kabar & perkembangan
            </h2>
            <UpdatesSection profileId={profile.id} canComment={canComment} refreshKey={refreshKey} />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="py-0">
            <CardContent className="space-y-5 px-5 py-6">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg font-semibold text-foreground">Dukung {profile.nickname}</p>
                <HandHeart className="size-5 text-accent-foreground" aria-hidden />
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary/50 px-3.5 py-3">
                  <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase">
                    <Coins className="size-3.5" aria-hidden />
                    Dana terkumpul
                  </dt>
                  <dd className="mt-1 font-display text-lg font-semibold text-foreground">
                    {formatRupiah(support.donationTotal)}
                  </dd>
                </div>
                <div className="rounded-xl bg-secondary/50 px-3.5 py-3">
                  <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase">
                    <HandHeart className="size-3.5" aria-hidden />
                    Komitmen
                  </dt>
                  <dd className="mt-1 font-display text-lg font-semibold text-foreground">{support.pledgeCount}</dd>
                </div>
                <div className="col-span-2 rounded-xl bg-secondary/50 px-3.5 py-3">
                  <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase">
                    <CalendarDays className="size-3.5" aria-hidden />
                    Kabar dibagikan
                  </dt>
                  <dd className="mt-1 font-display text-lg font-semibold text-foreground">{support.updateCount}</dd>
                </div>
              </dl>

              {profile.fundingInfo ? (
                <div className="rounded-xl border border-border bg-card px-3.5 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Rencana penggunaan dukungan
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{profile.fundingInfo}</p>
                </div>
              ) : null}

              <Separator />

              <div className="space-y-2.5">
                <Button size="lg" className="w-full" onClick={openSupport}>
                  <HandCoins className="size-4" aria-hidden />
                  {data.paymentEnabled ? "Dukung dengan dana" : "Kirim komitmen dukungan"}
                </Button>
                {data.paymentEnabled ? (
                  <Button size="lg" variant="outline" className="w-full" onClick={() => setPledgeOpen(true)}>
                    <HandHeart className="size-4" aria-hidden />
                    Komitmen jasa / barang
                  </Button>
                ) : (
                  <p className="rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    Pembayaran online belum aktif di lingkungan ini. Anda tetap dapat mengirim komitmen dukungan, dan
                    tim komunitas akan menindaklanjuti langsung.
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setRefreshKey((key) => key + 1)}
                >
                  Segarkan data dukungan
                </Button>
              </div>
            </CardContent>
          </Card>

          {isOwn && ownProfile ? (
            <Card className="border-primary/20 bg-primary/5 py-0">
              <CardContent className="px-5 py-4 text-sm text-foreground">
                Ini adalah tampilan publik profil Anda. Perbarui data melalui dasbor agar informasi tetap akurat.
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      <DonationDialog
        profileId={profile.id}
        profileName={profile.nickname}
        open={donationOpen}
        onOpenChange={setDonationOpen}
      />
      <PledgeDialog
        profileId={profile.id}
        profileName={profile.nickname}
        open={pledgeOpen}
        onOpenChange={setPledgeOpen}
      />
    </div>
  );
}
