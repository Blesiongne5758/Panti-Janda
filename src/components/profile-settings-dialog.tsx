import { useState, useEffect } from "react";
import {
  Banknote,
  Building,
  Check,
  Coins,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/common";
import { PasswordStrengthMeter, StrongPasswordGenerator } from "@/components/password-generator";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { docErrorText, prepareProfilePhoto } from "@/lib/verify-doc";
import type { CryptoWallet, Profile } from "@/lib/types";
import { toast } from "sonner";

const POPULAR_BANKS = [
  "BCA",
  "Mandiri",
  "BRI",
  "BNI",
  "BSI",
  "CIMB Niaga",
  "Bank Permata",
  "Bank Danamon",
  "Bank Jago",
  "SeaBank",
];

interface SupportedCoin {
  id: string;
  symbol: string;
  name: string;
  network: string;
  icon?: string;
}

export function ProfileSettingsDialog({
  trigger,
  defaultTab = "profil",
  onSaved,
}: {
  trigger?: React.ReactNode;
  defaultTab?: "profil" | "keamanan" | "bank" | "crypto";
  onSaved?: (profile: Profile) => void;
}) {
  const { account, profile, setProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string>(defaultTab);

  // Profile Data Form
  const [nickname, setNickname] = useState(profile?.nickname ?? account?.displayName ?? "");
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [photo, setPhoto] = useState<string | null>(profile?.photoData ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Bank Account Form
  const [bankName, setBankName] = useState(profile?.bank?.bankName ?? "");
  const [bankAccountName, setBankAccountName] = useState(profile?.bank?.bankAccountName ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(profile?.bank?.bankAccountNumber ?? "");
  const [savingBank, setSavingBank] = useState(false);

  // Crypto Wallets
  const [cryptoWallets, setCryptoWallets] = useState<CryptoWallet[]>([]);
  const [supportedCoins, setSupportedCoins] = useState<SupportedCoin[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [selectedCoinSymbol, setSelectedCoinSymbol] = useState("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Synchronize state when profile updates
  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? account?.displayName ?? "");
      setFullName(profile.fullName ?? "");
      setWhatsapp(profile.whatsapp ?? "");
      setCity(profile.city ?? "");
      setAddress(profile.address ?? "");
      setPhoto(profile.photoData ?? null);
      setBankName(profile.bank?.bankName ?? "");
      setBankAccountName(profile.bank?.bankAccountName ?? "");
      setBankAccountNumber(profile.bank?.bankAccountNumber ?? "");
    }
  }, [profile, account]);

  // Load crypto wallets and supported coins when dialog opens
  useEffect(() => {
    if (open) {
      loadWallets();
    }
  }, [open]);

  const loadWallets = async () => {
    setLoadingWallets(true);
    try {
      const [walletRes, coinsRes] = await Promise.all([
        api<{ items: CryptoWallet[] }>("crypto.wallets.list").catch(() => ({ items: [] })),
        api<{ items: SupportedCoin[] }>("crypto.coins.list").catch(() => ({ items: [] })),
      ]);
      setCryptoWallets(walletRes.items ?? []);
      setSupportedCoins(coinsRes.items ?? []);
      if (coinsRes.items && coinsRes.items.length > 0 && !selectedCoinSymbol) {
        setSelectedCoinSymbol(coinsRes.items[0].symbol);
      }
    } catch (err) {
      console.error("Gagal memuat wallet crypto:", err);
    } finally {
      setLoadingWallets(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      const compressed = await prepareProfilePhoto(file);
      setPhoto(compressed);
      toast.success("Foto profil berhasil dipilih. Klik 'Simpan Profil' untuk menerapkan.");
    } catch (err) {
      toast.error(docErrorText(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  // Submit Profile Data
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      toast.error("Nama panggilan / tampilan wajib diisi.");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await api<{ profile: Profile }>("profiles.update", {
        nickname: nickname.trim(),
        fullName: fullName.trim(),
        whatsapp: whatsapp.trim() || null,
        city: city.trim() || null,
        address: address.trim() || null,
        photo: photo,
      });
      setProfile(res.profile);
      if (onSaved) onSaved(res.profile);
      toast.success("Data profil berhasil diperbarui!");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSavingProfile(false);
    }
  };

  // Submit Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Masukkan password saat ini.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak cocok.");
      return;
    }
    setSavingPassword(true);
    try {
      await api("auth.changePassword", {
        currentPassword,
        newPassword,
      });
      toast.success("Password Anda berhasil diubah!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSavingPassword(false);
    }
  };

  // Submit Bank Account
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !bankAccountName.trim() || !bankAccountNumber.trim()) {
      toast.error("Lengkapi semua isian data bank.");
      return;
    }
    setSavingBank(true);
    try {
      const res = await api<{ profile: Profile }>("profiles.update", {
        bankName: bankName.trim(),
        bankAccountName: bankAccountName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
      });
      setProfile(res.profile);
      if (onSaved) onSaved(res.profile);
      toast.success("Data rekening bank berhasil disimpan!");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSavingBank(false);
    }
  };

  // Create Crypto Wallet
  const handleCreateCryptoWallet = async () => {
    if (!selectedCoinSymbol) {
      toast.error("Pilih jenis koin crypto terlebih dahulu.");
      return;
    }
    setCreatingWallet(true);
    try {
      const res = await api<CryptoWallet>("crypto.wallets.create", {
        coinSymbol: selectedCoinSymbol,
      });
      toast.success(`Dompet ${res.coinSymbol} (${res.network}) berhasil dibuat!`);
      await loadWallets();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setCreatingWallet(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(text);
      toast.success("Alamat dompet crypto disalin!");
      setTimeout(() => setCopiedAddress(null), 2500);
    } catch {
      toast.error("Gagal menyalin alamat");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="size-4" />
            Pengaturan Akun & Profil
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Settings className="size-5 text-primary" />
            Pengaturan Akun & Profil
          </DialogTitle>
          <DialogDescription>
            Kelola profil diri, keamanan kata sandi, rekening bank pencairan, dan dompet crypto Anda.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profil" className="gap-1.5 text-xs sm:text-sm">
              <User className="size-3.5" />
              <span className="hidden sm:inline">Profil</span>
            </TabsTrigger>
            <TabsTrigger value="keamanan" className="gap-1.5 text-xs sm:text-sm">
              <Lock className="size-3.5" />
              <span className="hidden sm:inline">Kata Sandi</span>
            </TabsTrigger>
            <TabsTrigger value="bank" className="gap-1.5 text-xs sm:text-sm">
              <CreditCard className="size-3.5" />
              <span className="hidden sm:inline">Bank</span>
            </TabsTrigger>
            <TabsTrigger value="crypto" className="gap-1.5 text-xs sm:text-sm">
              <Coins className="size-3.5" />
              <span className="hidden sm:inline">Crypto</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PROFIL & DATA DIRI */}
          <TabsContent value="profil" className="space-y-4 pt-3">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-card/60 p-4">
                <MemberAvatar
                  name={nickname || account?.displayName || "User"}
                  tier={profile?.tier}
                  size={64}
                  photoData={photo}
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Foto Profil</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, atau WebP maksimal 8 MB.</p>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="cursor-pointer">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={photoBusy}
                        onClick={() => document.getElementById("profile-photo-input")?.click()}
                      >
                        {photoBusy ? <Loader2 className="size-3.5 animate-spin" /> : "Pilih Foto"}
                      </Button>
                      <input
                        id="profile-photo-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                    {photo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPhoto(null)}
                        className="text-xs text-destructive hover:bg-destructive/10"
                      >
                        Hapus Foto
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ps-nickname">Nama Panggilan / Display Name *</Label>
                  <Input
                    id="ps-nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    placeholder="Contoh: Srikandi"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ps-fullname">Nama Lengkap</Label>
                  <Input
                    id="ps-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Sesuai kartu identitas"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ps-whatsapp">Nomor WhatsApp</Label>
                  <Input
                    id="ps-whatsapp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="0812xxxxxxx"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ps-city">Kota Domisili</Label>
                  <Input
                    id="ps-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Contoh: Jakarta Selatan"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ps-address">Alamat Lengkap</Label>
                  <Input
                    id="ps-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Jalan, kelurahan, kecamatan"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={savingProfile} className="gap-2">
                  {savingProfile ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Simpan Profil
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* TAB 2: KEAMANAN & UBAH PASSWORD */}
          <TabsContent value="keamanan" className="space-y-4 pt-3">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
              <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Pengaturan Kata Sandi Mandiri</p>
                <p className="mt-0.5">
                  Semua pengguna dapat memperbarui kata sandi akun kapan saja untuk menjaga keamanan akun Anda.
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Password Saat Ini */}
              <div className="space-y-1.5">
                <Label htmlFor="current-pw">Password Saat Ini *</Label>
                <div className="relative">
                  <Input
                    id="current-pw"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Masukkan password Anda saat ini"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>

              {/* Password Baru */}
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">Password Baru * (Min. 8 Karakter)</Label>
                <div className="relative">
                  <Input
                    id="new-pw"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Masukkan password baru yang kuat"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>

                {/* Indikator Kekuatan Password Baru */}
                <PasswordStrengthMeter password={newPassword} />

                {/* Generator Password Kuat Terintegrasi */}
                <div className="pt-2">
                  <StrongPasswordGenerator
                    onApply={(pw) => {
                      setNewPassword(pw);
                      setConfirmPassword(pw);
                    }}
                  />
                </div>
              </div>

              {/* Konfirmasi Password Baru */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw">Konfirmasi Password Baru *</Label>
                <div className="relative">
                  <Input
                    id="confirm-pw"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Ulangi password baru"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Konfirmasi password tidak cocok dengan password baru.</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  className="gap-2"
                >
                  {savingPassword ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  Ubah Password Sekarang
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* TAB 3: DATA REKENING BANK */}
          <TabsContent value="bank" className="space-y-4 pt-3">
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Rekening Pencairan Dana</p>
              <p className="mt-0.5">
                Data rekening bank digunakan secara rahasia dan aman untuk pencairan saldo koin atau penerimaan donasi.
                Data ini tidak pernah ditampilkan di profil publik.
              </p>
            </div>

            <form onSubmit={handleSaveBank} className="space-y-4">
              {/* Pilihan Cepat Bank Populer */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Pilih Cepat Bank Populer:</Label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_BANKS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBankName(b)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                        bankName.toLowerCase() === b.toLowerCase()
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/80 bg-card hover:bg-secondary"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bk-name">Nama Bank *</Label>
                  <Input
                    id="bk-name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                    placeholder="Contoh: BCA, Mandiri, BRI, Bank Jago"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bk-acc-name">Nama Pemilik Rekening *</Label>
                  <Input
                    id="bk-acc-name"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    required
                    placeholder="Sesuai nama di buku tabungan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bk-acc-number">Nomor Rekening *</Label>
                  <Input
                    id="bk-acc-number"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    required
                    inputMode="numeric"
                    placeholder="Contoh: 1234567890"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={savingBank} className="gap-2">
                  {savingBank ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                  Simpan Data Bank
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* TAB 4: DOMPET CRYPTO */}
          <TabsContent value="crypto" className="space-y-4 pt-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
              <Coins className="size-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Integrasi Dompet Crypto Web3</p>
                <p className="mt-0.5">
                  Daftarkan atau buat dompet crypto (USDT TRC-20, BEP-20, Solana, Ethereum, dll.) untuk menerima dana,
                  penarikan hasil kompetisi e-sport, atau konversi ke koin platform.
                </p>
              </div>
            </div>

            {/* List Existing Crypto Wallets */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Dompet Crypto Aktif Anda</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadWallets}
                  disabled={loadingWallets}
                  className="size-7 p-0"
                  title="Segarkan data dompet"
                >
                  <RefreshCw className={`size-3.5 ${loadingWallets ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {loadingWallets ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Memuat daftar dompet crypto...
                </div>
              ) : cryptoWallets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
                  <Wallet className="mx-auto mb-2 size-8 text-muted-foreground/60" />
                  <p>Anda belum memiliki dompet crypto yang terdaftar.</p>
                  <p className="text-xs">Buat dompet baru di bawah ini untuk memulai transaksi crypto.</p>
                </div>
              ) : (
                <div className="grid gap-2.5">
                  {cryptoWallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                          {wallet.coinSymbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm">{wallet.coinSymbol}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {wallet.network}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                            <span className="truncate max-w-[200px] sm:max-w-[280px]">
                              {wallet.walletAddress}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(wallet.walletAddress)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Salin alamat"
                            >
                              {copiedAddress === wallet.walletAddress ? (
                                <Check className="size-3 text-emerald-600" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="text-right sm:pl-4">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {wallet.balance.toLocaleString("id-ID", { maximumFractionDigits: 6 })}{" "}
                          <span className="text-xs font-normal text-muted-foreground">{wallet.coinSymbol}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buat Dompet Crypto Baru */}
            <div className="rounded-xl border border-border/80 bg-secondary/20 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="size-3.5 text-primary" />
                Tambah / Buat Dompet Crypto Baru
              </h4>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="crypto-coin-select" className="text-xs">
                    Pilih Koin & Jaringan:
                  </Label>
                  <select
                    id="crypto-coin-select"
                    value={selectedCoinSymbol}
                    onChange={(e) => setSelectedCoinSymbol(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {supportedCoins.length > 0 ? (
                      supportedCoins.map((coin) => (
                        <option key={coin.id} value={coin.symbol}>
                          {coin.name} ({coin.symbol}) — {coin.network}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="USDT">Tether USD (USDT) — TRC20</option>
                        <option value="USDT-BEP20">Tether USD (USDT) — BSC BEP20</option>
                        <option value="BTC">Bitcoin (BTC) — Bitcoin</option>
                        <option value="ETH">Ethereum (ETH) — ERC20</option>
                        <option value="SOL">Solana (SOL) — Solana</option>
                      </>
                    )}
                  </select>
                </div>
                <Button
                  type="button"
                  onClick={handleCreateCryptoWallet}
                  disabled={creatingWallet || !selectedCoinSymbol}
                  className="gap-2"
                >
                  {creatingWallet ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                  Buat Dompet
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-2 border-t border-border/50">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
