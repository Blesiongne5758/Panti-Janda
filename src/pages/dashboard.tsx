import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BookOpen,
  Bot,
  Coins,
  Crown,
  FileUp,
  HandCoins,
  Heart,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  Pencil,
  Settings,
  ShieldAlert,
  Sparkles,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { formatDate, formatRupiah, timeAgo } from "@/lib/format";
import {
  DONATION_STATUS_LABEL,
  EDUCATION_OPTIONS,
  KPI_LEVELS,
  PLEDGE_STATUS_LABEL,
  ROLE_LABEL,
  ROLE_RANK,
  SIM_CLASS_OPTIONS,
  SUPPORT_META,
} from "@/lib/constants";
import type { DonationItem, KpiSummary, PledgeItem, Profile } from "@/lib/types";
import { DOC_TYPE_OPTIONS, docErrorText, docKb, prepareProfilePhoto, prepareVerificationDoc } from "@/lib/verify-doc";
import type { VerificationDocType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AccountGate, MemberAvatar, StatusPill, TierBadge } from "@/components/common";
import { toast } from "sonner";

const listToText = (values: string[]) => values.join(", ");
const textToList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function EditProfileDialog({ profile, onSaved }: { profile: Profile; onSaved: (next: Profile) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    nickname: profile.nickname,
    fullName: profile.fullName ?? "",
    city: profile.city ?? "",
    age: profile.age ? String(profile.age) : "",
    dependents: profile.dependents !== null ? String(profile.dependents) : "",
    employmentStatus: profile.employmentStatus ?? "",
    skills: listToText(profile.skills),
    trainings: listToText(profile.trainings),
    needsTarget: profile.needsTarget ?? "",
    mainTarget: profile.mainTarget ?? "",
    interests: listToText(profile.interests),
    bio: profile.bio ?? "",
    fundingInfo: profile.fundingInfo ?? "",
  });
  const [docType, setDocType] = useState<VerificationDocType>(
    profile.verificationDoc?.type ?? DOC_TYPE_OPTIONS[0].value,
  );
  const [doc, setDoc] = useState<{ fileName: string; dataUrl: string } | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const onDocChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setDocError(null);
    setDocBusy(true);
    try {
      setDoc(await prepareVerificationDoc(file));
    } catch (err) {
      setDoc(null);
      setDocError(docErrorText(err));
    } finally {
      setDocBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const data = await api<{ profile: Profile }>("profiles.update", {
        nickname: form.nickname.trim(),
        fullName: form.fullName.trim(),
        verificationDoc: doc
          ? { type: docType, fileName: doc.fileName, dataUrl: doc.dataUrl }
          : undefined,
        city: form.city.trim() || null,
        age: form.age ? Number(form.age) : null,
        dependents: form.dependents ? Number(form.dependents) : null,
        employmentStatus: form.employmentStatus.trim() || null,
        skills: textToList(form.skills),
        trainings: textToList(form.trainings),
        needsTarget: form.needsTarget.trim() || null,
        mainTarget: form.mainTarget.trim() || null,
        interests: textToList(form.interests),
        bio: form.bio.trim() || null,
        fundingInfo: form.fundingInfo.trim() || null,
      });
      onSaved(data.profile);
      setOpen(false);
      toast.success("Profil diperbarui.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" aria-hidden />
          Perbarui profil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Perbarui profil anggota</DialogTitle>
          <DialogDescription>
            Perubahan langsung tampil di profil publik. Jika profilmu sedang berstatus perlu perbaikan,
            menyimpan akan mengajukannya kembali untuk verifikasi.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ep-full">Nama lengkap *</Label>
            <Input id="ep-full" value={form.fullName} onChange={set("fullName")} maxLength={100} />
            <p className="text-xs text-muted-foreground">
              Hanya untuk verifikasi admin — tidak tampil di profil publik.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ep-nick">Nama panggilan *</Label>
            <Input id="ep-nick" value={form.nickname} onChange={set("nickname")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-city">Kota</Label>
            <Input id="ep-city" value={form.city} onChange={set("city")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ep-age">Umur</Label>
              <Input id="ep-age" type="number" min={17} max={99} value={form.age} onChange={set("age")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep-dep">Tanggungan</Label>
              <Input id="ep-dep" type="number" min={0} max={20} value={form.dependents} onChange={set("dependents")} />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ep-job">Status pekerjaan</Label>
            <Input id="ep-job" value={form.employmentStatus} onChange={set("employmentStatus")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-skills">Skill (pisahkan koma)</Label>
            <Input id="ep-skills" value={form.skills} onChange={set("skills")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-train">Pelatihan diikuti</Label>
            <Input id="ep-train" value={form.trainings} onChange={set("trainings")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-needs">Target kebutuhan</Label>
            <Input id="ep-needs" value={form.needsTarget} onChange={set("needsTarget")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-main">Target utama</Label>
            <Input id="ep-main" value={form.mainTarget} onChange={set("mainTarget")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-interest">Minat usaha/kerja</Label>
            <Input id="ep-interest" value={form.interests} onChange={set("interests")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-fund">Info pendanaan</Label>
            <Input id="ep-fund" value={form.fundingInfo} onChange={set("fundingInfo")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ep-bio">Cerita singkat</Label>
            <Textarea id="ep-bio" rows={3} maxLength={1200} value={form.bio} onChange={set("bio")} />
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/40 p-4 sm:col-span-2">
            <div>
              <Label>Dokumen verifikasi (opsional)</Label>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Ganti dokumen bila diminta admin atau dokumen lama tidak jelas — foto KTP terbaru atau
                dokumen resmi pengadilan. Hanya admin yang melihat dokumen ini.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="sm:w-64">
                <Select value={docType} onValueChange={(value) => setDocType(value as VerificationDocType)}>
                  <SelectTrigger aria-label="Jenis dokumen">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent">
                {docBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <FileUp className="size-4" aria-hidden />
                )}
                {doc ? "Ganti gambar" : "Pilih gambar (maks 8 MB)"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={docBusy}
                  onChange={onDocChange}
                />
              </label>
            </div>
            {!doc && profile.verificationDoc ? (
              <p className="text-xs text-muted-foreground">
                Dokumen lama masih tersimpan ({profile.verificationDoc.fileName ?? "tanpa nama berkas"}).
                Biarkan kosong jika tidak ingin mengganti.
              </p>
            ) : null}
            {doc ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-2">
                <img
                  src={doc.dataUrl}
                  alt="Pratinjau dokumen verifikasi"
                  className="size-14 rounded-lg border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">{docKb(doc.dataUrl)} KB · akan mengganti dokumen lama</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDoc(null)} disabled={docBusy}>
                  Hapus
                </Button>
              </div>
            ) : null}
            {docError ? (
              <p role="alert" className="text-sm text-destructive">
                {docError}
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WriteUpdateDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (title.trim().length < 3 || body.trim().length < 3) {
      toast.error("Judul dan isi kabar minimal 3 karakter.");
      return;
    }
    setBusy(true);
    try {
      await api("updates.create", { title: title.trim(), body: body.trim() });
      toast.success("Kabar dipublikasikan di profilmu.");
      setOpen(false);
      setTitle("");
      setBody("");
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
          <Sparkles className="size-4" aria-hidden />
          Tulis kabar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Kabar baru</DialogTitle>
          <DialogDescription>
            Bagikan perkembangan usahamu, pencapaian pelatihan, atau kebutuhan terkini kepada pendukung.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wu-title">Judul *</Label>
            <Input
              id="wu-title"
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Pesanan pertama dari kelas menjahit!"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wu-body">Isi kabar *</Label>
            <Textarea
              id="wu-body"
              rows={5}
              maxLength={2000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
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

const NONE = "none";

function SettingsDialog({ profile, onSaved }: { profile: Profile; onSaved: (next: Profile) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    education: profile.education ?? "",
    insurance: profile.insurance ?? "",
    height: profile.heightCm ? String(profile.heightCm) : "",
    weight: profile.weightKg ? String(profile.weightKg) : "",
    birthPlace: profile.birthPlace ?? "",
    birthDate: profile.birthDate ?? "",
    bankName: profile.bank?.bankName ?? "",
    bankAccountName: profile.bank?.bankAccountName ?? "",
    bankAccountNumber: profile.bank?.bankAccountNumber ?? "",
    whatsapp: profile.whatsapp ?? "",
    address: profile.address ?? "",
  });
  const [simClasses, setSimClasses] = useState<string[]>(profile.simClasses);
  const [passport, setPassport] = useState(profile.passport === null ? NONE : profile.passport ? "yes" : "no");
  const [photo, setPhoto] = useState<string | null>(profile.photoData);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const photoDirty = photo !== profile.photoData;

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const onPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      setPhoto(await prepareProfilePhoto(file));
    } catch (err) {
      setPhotoError(docErrorText(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const toggleSim = (value: string) => (checked: boolean) =>
    setSimClasses((current) =>
      checked ? [...new Set([...current, value])] : current.filter((item) => item !== value),
    );

  const submit = async () => {
    setBusy(true);
    try {
      const data = await api<{ profile: Profile }>("profiles.update", {
        nickname: profile.nickname,
        fullName: profile.fullName ?? "",
        photo: photoDirty ? photo : undefined,
        education: form.education || null,
        insurance: form.insurance.trim() || null,
        height: form.height ? Number(form.height) : null,
        weight: form.weight ? Number(form.weight) : null,
        birthPlace: form.birthPlace.trim() || null,
        birthDate: form.birthDate || null,
        simClasses,
        passport: passport === NONE ? null : passport === "yes",
        bankName: form.bankName.trim() || null,
        bankAccountName: form.bankAccountName.trim() || null,
        bankAccountNumber: form.bankAccountNumber.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        address: form.address.trim() || null,
      });
      onSaved(data.profile);
      setOpen(false);
      toast.success("Pengaturan disimpan.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="size-4" aria-hidden />
          Pengaturan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Pengaturan akun</DialogTitle>
          <DialogDescription>
            Lengkapi data diri dan rekening bank. Data bank bersifat rahasia dan tidak pernah tampil di
            profil publik.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Foto profil</h3>
            <div className="flex flex-wrap items-center gap-4">
              <MemberAvatar name={profile.nickname} tier={profile.tier} size={72} photoData={photo} />
              <div className="flex flex-col gap-2">
                <label className="inline-flex w-fit cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent">
                  {photoBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <FileUp className="size-4" aria-hidden />
                  )}
                  {photo ? "Ganti foto" : "Unggah foto (maks 8 MB)"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={photoBusy}
                    onChange={onPhotoChange}
                  />
                </label>
                {photo && photoDirty ? (
                  <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setPhoto(null)}>
                    Hapus foto baru
                  </Button>
                ) : null}
                {!photo && profile.photoData ? (
                  <p className="text-xs text-muted-foreground">Foto akan dihapus saat disimpan.</p>
                ) : null}
              </div>
            </div>
            {photoError ? (
              <p role="alert" className="text-sm text-destructive">
                {photoError}
              </p>
            ) : null}
          </section>

          <Separator />

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Data diri</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="st-education">Jenjang pendidikan terakhir</Label>
                <Select
                  value={form.education || NONE}
                  onValueChange={(value) => setForm((c) => ({ ...c, education: value === NONE ? "" : value }))}
                >
                  <SelectTrigger id="st-education">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Tidak diisi</SelectItem>
                    {EDUCATION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-insurance">Jenis asuransi yang dimiliki</Label>
                <Input
                  id="st-insurance"
                  value={form.insurance}
                  onChange={set("insurance")}
                  maxLength={120}
                  placeholder="BPJS Kesehatan, asuransi jiwa…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-birth-place">Tempat lahir</Label>
                <Input id="st-birth-place" value={form.birthPlace} onChange={set("birthPlace")} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-birth-date">Tanggal lahir</Label>
                <Input id="st-birth-date" type="date" value={form.birthDate} onChange={set("birthDate")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-height">Tinggi badan (cm)</Label>
                <Input
                  id="st-height"
                  type="number"
                  min={80}
                  max={250}
                  value={form.height}
                  onChange={set("height")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-weight">Berat badan (kg)</Label>
                <Input
                  id="st-weight"
                  type="number"
                  min={25}
                  max={300}
                  value={form.weight}
                  onChange={set("weight")}
                />
              </div>
              <div className="space-y-2">
                <Label>Kepemilikan SIM</Label>
                <div className="flex flex-wrap gap-4 pt-1">
                  {SIM_CLASS_OPTIONS.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={simClasses.includes(option)}
                        onCheckedChange={(checked) => toggleSim(option)(checked === true)}
                      />
                      SIM {option}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-passport">Kepemilikan paspor</Label>
                <Select value={passport} onValueChange={setPassport}>
                  <SelectTrigger id="st-passport">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Punya paspor</SelectItem>
                    <SelectItem value="no">Tidak punya</SelectItem>
                    <SelectItem value={NONE}>Tidak diisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-whatsapp">Nomor WhatsApp</Label>
                <Input
                  id="st-whatsapp"
                  value={form.whatsapp}
                  onChange={set("whatsapp")}
                  maxLength={20}
                  inputMode="tel"
                  placeholder="6281234567890"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="st-address">Alamat</Label>
                <Textarea
                  id="st-address"
                  rows={2}
                  maxLength={500}
                  value={form.address}
                  onChange={(event) => setForm((c) => ({ ...c, address: event.target.value }))}
                  placeholder="Jl. Contoh No. 123, Kota"
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Data bank</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Dipakai untuk menyalurkan dana dukungan. Hanya kamu dan admin yang dapat melihatnya.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="st-bank">Nama bank</Label>
                <Input id="st-bank" value={form.bankName} onChange={set("bankName")} maxLength={80} placeholder="BCA" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-bank-name">Nama pemilik rekening</Label>
                <Input
                  id="st-bank-name"
                  value={form.bankAccountName}
                  onChange={set("bankAccountName")}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="st-bank-number">Nomor rekening</Label>
                <Input
                  id="st-bank-number"
                  value={form.bankAccountNumber}
                  onChange={set("bankAccountNumber")}
                  maxLength={40}
                  inputMode="numeric"
                />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={submit} disabled={busy || photoBusy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const { ready, account, profile, setProfile, refresh } = useAuth();
  const [pledges, setPledges] = useState<PledgeItem[] | null>(null);
  const [donations, setDonations] = useState<DonationItem[] | null>(null);
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const rank = account ? ROLE_RANK[account.role] : 0;

  const loadSupport = useCallback(async () => {
    if (rank < 2) return;
    setLoadingData(true);
    try {
      const [pledgeData, donationData, kpiData] = await Promise.all([
        api<{ items: PledgeItem[] }>("pledges.mine"),
        api<{ items: DonationItem[] }>("donations.mine"),
        api<KpiSummary>("kpi.mine"),
      ]);
      setPledges(pledgeData.items);
      setDonations(donationData.items);
      setKpi(kpiData);
    } catch {
      setPledges([]);
      setDonations([]);
      setKpi(null);
    } finally {
      setLoadingData(false);
    }
  }, [rank]);

  useEffect(() => {
    void loadSupport();
  }, [loadSupport]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!account) {
    return (
      <AccountGate
        title="Masuk untuk membuka dasbor"
        description="Dasbor menampilkan profil anggota, kabar, dan ringkasan dukungan sesuai peran akunmu."
        actionLabel="Masuk sekarang"
      />
    );
  }

  const verified = profile?.status === "verified";
  const donationTotal = (donations ?? [])
    .filter((item) => item.status === "settled")
    .reduce((sum, item) => sum + item.grossAmount, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-6 sm:gap-6 sm:px-4 sm:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <LayoutDashboard className="size-6 text-primary" aria-hidden />
        <h1 className="font-display text-3xl font-semibold">Dasbor</h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          {ROLE_LABEL[account.role]}
        </span>
      </div>

      {rank >= 2 && profile ? (
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <MemberAvatar
                  name={profile.nickname}
                  tier={profile.tier}
                  size={52}
                  photoData={profile.photoData}
                />
                <div>
                  <p className="font-display text-xl font-semibold">{profile.nickname}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <TierBadge tier={profile.tier} size="sm" />
                    <StatusPill kind="profile" status={profile.status} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <EditProfileDialog profile={profile} onSaved={setProfile} />
                <SettingsDialog profile={profile} onSaved={setProfile} />
                {verified ? <WriteUpdateDialog onCreated={refresh} /> : null}
              </div>
            </div>
            {profile.status === "pending" ? (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Profilmu sedang menunggu verifikasi admin. Setelah terverifikasi, profil tampil di halaman
                jelajah dan kamu bisa menerima dukungan.
              </div>
            ) : null}
            {profile.status === "rejected" ? (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Profil perlu perbaikan{profile.rejectReason ? `: ${profile.rejectReason}` : "."} Perbarui data
                  profilmu untuk diajukan ulang.
                </span>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Profil dilihat publik</p>
              <p className="mt-1 text-sm font-medium">
                {verified ? "Aktif di halaman jelajah" : "Belum tayang"}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Dukungan dana diterima</p>
              <p className="mt-1 font-display text-lg font-semibold">{formatRupiah(donationTotal)}</p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Komitmen dukungan masuk</p>
              <p className="mt-1 font-display text-lg font-semibold">{(pledges ?? []).length} komitmen</p>
            </div>
            <div className="sm:col-span-3">
              <Button asChild variant="outline" size="sm">
                <Link to={`/janda/${profile.id}`}>Lihat profil publikmu</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {rank >= 2 && kpi ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Level & XP
            </CardTitle>
            <CardDescription>
              Setiap aktivitas — membuat event, menjadi panitia, menghadiri event, berdonasi, dan lainnya — menambah XP.
              Naik level untuk membuka peran dan akses baru.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                <p className="text-xs text-muted-foreground">Level saat ini</p>
                <p className="mt-1 font-display text-2xl font-bold text-primary">{kpi.levelTitle}</p>
                <p className="text-xs text-muted-foreground">Level {kpi.level} / 50</p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="text-xs text-muted-foreground">Total XP</p>
                <p className="mt-1 font-display text-2xl font-semibold">{kpi.totalPoints.toLocaleString("id-ID")}</p>
                <p className="text-xs text-muted-foreground">
                  {kpi.xpToNextLevel ? `${kpi.xpToNextLevel.toLocaleString("id-ID")} XP lagi ke level ${kpi.level + 1}` : "Level maksimum"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-4">
                <p className="text-xs text-muted-foreground">Aktivitas terbaru</p>
                <p className="mt-1 font-display text-2xl font-semibold">{kpi.recentLogs.length}</p>
                <p className="text-xs text-muted-foreground">log kontribusi</p>
              </div>
            </div>
            {kpi.xpToNextLevel !== null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress ke level {kpi.level + 1}</span>
                  <span>{kpi.currentLevelXp.toLocaleString("id-ID")} / {(kpi.currentLevelXp + kpi.xpToNextLevel).toLocaleString("id-ID")} XP</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (kpi.currentLevelXp / (kpi.currentLevelXp + kpi.xpToNextLevel)) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
            {kpi.recentLogs.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-sm font-medium">Aktivitas terbaru</p>
                <ul className="space-y-1.5">
                  {kpi.recentLogs.slice(0, 5).map((log) => (
                    <li key={log.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {log.sourceType === "event_create" && "Membuat event"}
                        {log.sourceType === "event_committee" && "Menjadi panitia"}
                        {log.sourceType === "event_attend" && "Menghadiri event"}
                        {log.sourceType === "donation" && "Berdonasi"}
                        {log.sourceType === "campaign_donate" && "Donasi kampanye"}
                        {log.sourceType === "program_complete" && "Menyelesaikan program"}
                        {log.sourceType === "profile_update" && "Update profil"}
                        {log.sourceType === "business_submit" && "Mengajukan bisnis"}
                        {log.sourceType === "listing_create" && "Membuat listing"}
                        {log.sourceType === "listing_sale" && "Penjualan marketplace"}
                        {log.sourceType === "mentor_chat" && "Konsultasi AI Mentor"}
                      </span>
                      <span className="font-medium text-primary">+{log.points} XP</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {rank >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Crown className="size-4 text-primary" aria-hidden />
              Langganan Tier
            </CardTitle>
            <CardDescription>
              Dapatkan badge tier tanpa syarat KPI melalui langganan bulanan. Tersedia Sosialita, High Society, dan The CEO.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link to="/langganan">Kelola Langganan</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {rank >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Sparkles className="size-4 text-primary" aria-hidden />
              AI Mentor Bisnis
            </CardTitle>
            <CardDescription>
              Tanyakan apa saja tentang bisnis, proposal, RAB, atau strategi usaha Anda kepada mentor virtual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link to="/mentor-ai">Mulai Konsultasi</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Activity className="size-4 text-emerald-600" aria-hidden />
            Live Trading
          </CardTitle>
          <CardDescription>
            Pantau pergerakan pasar real-time dengan TradingView. Tersedia mode Demo untuk belajar trading tanpa risiko.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/live-trading">Buka Live Trading</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/live-trading?mode=demo">Mode Demo</Link>
          </Button>
        </CardContent>
      </Card>

      {rank >= 3 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Bot className="size-4 text-violet-600" aria-hidden />
              AI Trading Agent
            </CardTitle>
            <CardDescription>
              Agent trading otomatis berbasis AI yang menganalisis pasar dan mengeksekusi strategi sesuai parameter Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link to="/ai-agent">Kelola Agent</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <BookOpen className="size-4 text-blue-600" aria-hidden />
            Learning Center
          </CardTitle>
          <CardDescription>
            Pusat pembelajaran fleksibel: micro-learning 5-15 menit, podcast, literasi keuangan & hukum, job board, inkubasi bisnis, forum komunitas, dan sistem reward.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/learning-center">Buka Learning Center</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/learning-center?tab=micro-learning">Micro-Learning</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/learning-center?tab=komunitas">Forum Komunitas</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Coins className="size-4 text-yellow-600" aria-hidden />
              Koin
            </CardTitle>
            <CardDescription>Beli koin, tarik tunai, dan gunakan untuk fitur premium seperti boost profil atau highlight posting.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link to="/koin">Kelola Koin</Link>
            </Button>
          </CardContent>
        </Card>

        {rank >= 2 ? (
          <>
            <Card className="hover-lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Users className="size-4 text-purple-600" aria-hidden />
                  Grup
                </CardTitle>
                <CardDescription>Bergabung dengan kelompok minat, diskusi, dan kegiatan komunitas bersama anggota lain.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm">
                  <Link to="/grup">Buka Grup</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <MessageCircle className="size-4 text-green-600" aria-hidden />
                  Pesan
                </CardTitle>
                <CardDescription>Kirim dan terima pesan pribadi dari anggota komunitas lainnya.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm">
                  <Link to="/pesan">Buka Pesan</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {rank >= 2 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <HandCoins className="size-4 text-primary" aria-hidden />
                Komitmen dukungan
              </CardTitle>
              <CardDescription>
                Pendukung yang mengisi formulir komitmen — hubungi mereka dan tandai perkembangannya.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                </div>
              ) : (pledges ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada komitmen dukungan.</p>
              ) : (
                <ul className="space-y-3">
                  {(pledges ?? []).slice(0, 8).map((pledge) => (
                    <li key={pledge.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{pledge.supporterName}</p>
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                          {PLEDGE_STATUS_LABEL[pledge.status] ?? pledge.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {SUPPORT_META[pledge.supportType].label}
                        {pledge.amount ? ` · ${formatRupiah(pledge.amount)}` : ""} · {timeAgo(pledge.createdAt)}
                      </p>
                      {pledge.message ? (
                        <p className="mt-2 text-sm text-muted-foreground">“{pledge.message}”</p>
                      ) : null}
                      {pledge.contact ? (
                        <p className="mt-1 text-xs text-muted-foreground">Kontak: {pledge.contact}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Coins className="size-4 text-primary" aria-hidden />
                Donasi daring
              </CardTitle>
              <CardDescription>Pembayaran melalui gerbang pembayaran; status diperbarui otomatis.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
                </div>
              ) : (donations ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada donasi daring.</p>
              ) : (
                <ul className="space-y-3">
                  {(donations ?? []).slice(0, 8).map((donation) => (
                    <li
                      key={donation.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{formatRupiah(donation.grossAmount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {donation.supporterName} · {timeAgo(donation.createdAt)}
                        </p>
                      </div>
                      <StatusPill kind="donation" status={donation.status} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Total berhasil: {formatRupiah(donationTotal)} · {DONATION_STATUS_LABEL.settled} tercatat otomatis
                dari notifikasi pembayaran.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {rank < 2 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Heart className="size-4 text-primary" aria-hidden />
              Terima kasih telah menjadi bagian komunitas
            </CardTitle>
            <CardDescription>
              Sebagai pengguna non janda, kamu bisa menjelajahi profil Wonder Woman, mengikuti program & event
              terbuka, berkomentar, dan menyalurkan dukungan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/jelajah">Jelajahi profil</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/program">Program</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/event">Event</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {account.role === "admin" ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <BadgeCheck className="size-4 text-primary" aria-hidden />
              Panel admin
            </CardTitle>
            <CardDescription>
              Verifikasi profil anggota, kelola peran, tindak lanjuti laporan, dan pantau donasi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/admin">Buka panel admin</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Separator />
      <p className="text-xs text-muted-foreground">
        Akun terdaftar {account.displayName ? `atas nama ${account.displayName}` : account.email} ·{" "}
        {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
}
