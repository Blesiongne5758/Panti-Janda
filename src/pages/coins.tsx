import { useState, useEffect } from "react";
import { Coins, Loader2, Wallet, History, Sparkles, ArrowDownCircle, CreditCard, Banknote } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PageBanner } from "@/components/common";
import { COIN_PACKAGES, COIN_TRANSACTION_TYPE_LABEL } from "@/lib/constants";
import type { CoinBalance, CoinTransaction, CoinFeature, AppSettings } from "@/lib/types";
import { toast } from "sonner";

type CoinSettings = AppSettings["coinSettings"];

export default function CoinsPage() {
  const { account } = useAuth();
  const [balance, setBalance] = useState<CoinBalance | null>(null);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [features, setFeatures] = useState<CoinFeature[]>([]);
  const [coinSettings, setCoinSettings] = useState<CoinSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawCoins, setWithdrawCoins] = useState<number>(0);
  const [withdrawMethod, setWithdrawMethod] = useState<string>("");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [withdrawHolder, setWithdrawHolder] = useState("");

  const load = async () => {
    try {
      const [balanceRes, txRes, featuresRes, settingsRes] = await Promise.all([
        api<CoinBalance>("coins.balance"),
        api<{ items: CoinTransaction[] }>("coins.transactions"),
        api<{ items: CoinFeature[] }>("coins.features"),
        api<{ coinSettings: CoinSettings }>("coinSettings.settings"),
      ]);
      if (balanceRes) setBalance(balanceRes);
      if (txRes) setTransactions(txRes.items);
      if (featuresRes) setFeatures(featuresRes.items);
      if (settingsRes) {
        setCoinSettings(settingsRes.coinSettings);
        const firstEnabled = settingsRes.coinSettings.purchaseMethods.find((m) => m.enabled);
        if (firstEnabled) setSelectedPaymentMethod(firstEnabled.id);
        const firstWithdraw = settingsRes.coinSettings.withdrawMethods.find((m) => m.enabled);
        if (firstWithdraw) setWithdrawMethod(firstWithdraw.id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [account]);

  const handlePurchase = async (packageId: string) => {
    if (!selectedPaymentMethod) {
      toast.error("Pilih metode pembayaran terlebih dahulu.");
      return;
    }
    setPurchasing(packageId);
    try {
      const res = await api<{ redirectUrl: string | null; orderId: string }>("coins.purchase", {
        packageId,
        paymentMethod: selectedPaymentMethod,
      });
      if (res?.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        toast.success("Pesanan pembelian koin berhasil dibuat.");
        await load();
      }
    } catch {
      toast.error("Gagal memproses pembelian.");
    } finally {
      setPurchasing(null);
    }
  };

  const handleRedeemFeature = async (featureId: string) => {
    setRedeeming(featureId);
    try {
      const res = await api<{ success: boolean; newBalance: number; message: string }>("coins.spend", { featureId });
      if (res?.success) {
        toast.success(res.message);
        await load();
      }
    } catch {
      toast.error("Gagal membeli fitur. Pastikan saldo koin cukup.");
    } finally {
      setRedeeming(null);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawMethod) {
      toast.error("Pilih metode penarikan.");
      return;
    }
    if (withdrawCoins <= 0) {
      toast.error("Masukkan jumlah koin yang ingin ditarik.");
      return;
    }
    if (!withdrawAccount.trim()) {
      toast.error("Masukkan nomor rekening / akun tujuan.");
      return;
    }
    if (!withdrawHolder.trim()) {
      toast.error("Masukkan nama pemilik akun.");
      return;
    }
    setWithdrawing(true);
    try {
      const res = await api<{
        success: boolean;
        netRupiah: number;
        grossRupiah: number;
        adminFee: number;
        withdrawFee: number;
        message: string;
      }>("coins.withdraw", {
        method: withdrawMethod,
        coinAmount: withdrawCoins,
        accountNumber: withdrawAccount.trim(),
        holderName: withdrawHolder.trim(),
      });
      if (res?.success) {
        toast.success(res.message);
        setWithdrawCoins(0);
        await load();
      }
    } catch {
      toast.error("Gagal memproses penarikan.");
    } finally {
      setWithdrawing(false);
    }
  };

  const calcWithdraw = () => {
    if (!coinSettings || withdrawCoins <= 0) return null;
    const { conversionRate, fees } = coinSettings;
    const grossRupiah = (withdrawCoins / conversionRate) * 1000;
    const adminFee = grossRupiah * (fees.adminFeePercent / 100);
    const withdrawFee = grossRupiah * (fees.withdrawFeePercent / 100);
    const netRupiah = Math.floor(grossRupiah - adminFee - withdrawFee);
    return { grossRupiah: Math.floor(grossRupiah), adminFee: Math.floor(adminFee), withdrawFee: Math.floor(withdrawFee), netRupiah };
  };

  const withdrawCalc = calcWithdraw();
  const enabledPurchaseMethods = coinSettings?.purchaseMethods.filter((m) => m.enabled) ?? [];
  const enabledWithdrawMethods = coinSettings?.withdrawMethods.filter((m) => m.enabled) ?? [];

  return (
    <>
      <PageBanner art="/images/banner-event.svg">
        <h1 className="font-display text-3xl font-bold">Koin Panti Janda</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Beli koin untuk mengakses fitur premium, atau tukarkan koin Anda menjadi uang tunai.
        </p>
      </PageBanner>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card className="mb-8 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="size-5 text-primary" />
                  Saldo Koin Anda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary">{balance?.balance ?? 0}</span>
                  <span className="text-lg text-muted-foreground">koin</span>
                </div>
                {balance && coinSettings && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Setara ~{formatRupiah(Math.floor((balance.balance / coinSettings.conversionRate) * 1000))}
                    <span className="mx-2">·</span>
                    Rate: {coinSettings.conversionRate} koin = Rp{(coinSettings.conversionRate * 10).toLocaleString("id-ID")}
                  </div>
                )}
                {balance && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Total pembelian</p>
                      <p className="text-lg font-semibold">{balance.lifetimePurchased.toLocaleString("id-ID")} koin</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total penggunaan</p>
                      <p className="text-lg font-semibold">{balance.lifetimeSpent.toLocaleString("id-ID")} koin</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="buy">
              <TabsList className="mb-6 flex h-auto w-full overflow-x-auto flex-nowrap scrollbar-none">
                <TabsTrigger value="buy">
                  <CreditCard className="mr-2 size-4" />
                  Beli Koin
                </TabsTrigger>
                <TabsTrigger value="withdraw">
                  <ArrowDownCircle className="mr-2 size-4" />
                  Tukar Koin ke Uang
                </TabsTrigger>
                <TabsTrigger value="features">
                  <Sparkles className="mr-2 size-4" />
                  Fitur Premium
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History className="mr-2 size-4" />
                  Riwayat
                </TabsTrigger>
              </TabsList>

              <TabsContent value="buy">
                {enabledPurchaseMethods.length > 0 && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-base">Metode Pembayaran</CardTitle>
                      <CardDescription>Pilih metode pembayaran untuk pembelian koin.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {enabledPurchaseMethods.map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                              selectedPaymentMethod === method.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => setSelectedPaymentMethod(method.id)}
                          >
                            {method.id === "transfer_bank" ? (
                              <Banknote className="mr-1.5 inline size-4" />
                            ) : method.id === "qris" ? (
                              <CreditCard className="mr-1.5 inline size-4" />
                            ) : (
                              <CreditCard className="mr-1.5 inline size-4" />
                            )}
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <h2 className="mb-4 font-display text-2xl font-bold">Paket Koin</h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {COIN_PACKAGES.map((pkg) => {
                    const totalCoins = pkg.coinAmount + pkg.bonusCoins;
                    const pricePerCoin = (pkg.price / totalCoins).toFixed(0);
                    const isPopular = pkg.popular;

                    return (
                      <Card key={pkg.id} className={isPopular ? "border-primary shadow-lg" : ""}>
                        {isPopular && (
                          <div className="bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
                            Paling Populer
                          </div>
                        )}
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Coins className="size-5 text-primary" />
                            {pkg.name}
                          </CardTitle>
                          <CardDescription>
                            {pkg.bonusCoins > 0 && (
                              <Badge variant="secondary" className="mr-2">
                                +{pkg.bonusCoins} bonus
                              </Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {pricePerCoin} rupiah/koin
                            </span>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-3xl font-bold">{totalCoins.toLocaleString("id-ID")}</p>
                            <p className="text-sm text-muted-foreground">koin</p>
                          </div>
                          <p className="text-2xl font-bold text-primary">{formatRupiah(pkg.price)}</p>
                        </CardContent>
                        <CardContent>
                          <Button
                            className="w-full"
                            onClick={() => handlePurchase(pkg.id)}
                            disabled={purchasing === pkg.id || !account}
                          >
                            {purchasing === pkg.id ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Memproses...
                              </>
                            ) : (
                              `Beli via ${enabledPurchaseMethods.find((m) => m.id === selectedPaymentMethod)?.label ?? "..."}`
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="withdraw">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ArrowDownCircle className="size-5 text-primary" />
                      Tukar Koin ke Uang
                    </CardTitle>
                    <CardDescription>
                      Tukarkan koin Anda menjadi uang tunai. Biaya admin {coinSettings?.fees.adminFeePercent}% dan biaya penarikan {coinSettings?.fees.withdrawFeePercent}% akan dipotong dari nilai tukar.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-1">
                      <Label>Jumlah koin yang ditukar</Label>
                      <Input
                        type="number"
                        min={coinSettings?.fees.minWithdrawCoins ?? 0}
                        max={balance?.balance ?? 0}
                        value={withdrawCoins || ""}
                        placeholder={`Min. ${coinSettings?.fees.minWithdrawCoins ?? 0} koin`}
                        onChange={(e) => setWithdrawCoins(Number(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Saldo Anda: {balance?.balance.toLocaleString("id-ID")} koin
                        {coinSettings ? ` · Minimum: ${coinSettings.fees.minWithdrawCoins.toLocaleString("id-ID")} koin` : ""}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label>Metode penarikan</Label>
                      <div className="flex flex-wrap gap-2">
                        {enabledWithdrawMethods.map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                              withdrawMethod === method.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => setWithdrawMethod(method.id)}
                          >
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Nomor rekening / akun tujuan</Label>
                        <Input
                          placeholder="Contoh: 1234567890 atau 08123456789"
                          value={withdrawAccount}
                          onChange={(e) => setWithdrawAccount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Nama pemilik akun</Label>
                        <Input
                          placeholder="Nama sesuai rekening"
                          value={withdrawHolder}
                          onChange={(e) => setWithdrawHolder(e.target.value)}
                        />
                      </div>
                    </div>

                    {withdrawCalc && withdrawCoins > 0 && (
                      <div className="rounded-lg border border-border p-4">
                        <p className="mb-2 text-sm font-medium">Rincian Penarikan</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Nilai tukar ({withdrawCoins.toLocaleString("id-ID")} koin)</span>
                            <span>{formatRupiah(withdrawCalc.grossRupiah)}</span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>Biaya admin ({coinSettings?.fees.adminFeePercent}%)</span>
                            <span>-{formatRupiah(withdrawCalc.adminFee)}</span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>Biaya penarikan ({coinSettings?.fees.withdrawFeePercent}%)</span>
                            <span>-{formatRupiah(withdrawCalc.withdrawFee)}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-bold">
                            <span>Dana diterima</span>
                            <span className="text-green-600">{formatRupiah(withdrawCalc.netRupiah)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      className="w-full"
                      onClick={handleWithdraw}
                      disabled={withdrawing || !account || withdrawCoins <= 0 || !withdrawAccount.trim() || !withdrawHolder.trim()}
                    >
                      {withdrawing ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Memproses penarikan...
                        </>
                      ) : (
                        "Tukar Koin Sekarang"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="features">
                {features.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {features.map((feature) => {
                      const canAfford = (balance?.balance ?? 0) >= feature.cost;
                      return (
                        <Card key={feature.id} className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Sparkles className="size-5 text-primary" />
                              {feature.name}
                            </CardTitle>
                            <CardDescription>{feature.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Biaya</p>
                                <p className="text-2xl font-bold text-primary">{feature.cost} koin</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Durasi</p>
                                <p className="text-lg font-semibold">{feature.duration}</p>
                              </div>
                            </div>
                            <Button
                              className="w-full"
                              onClick={() => handleRedeemFeature(feature.id)}
                              disabled={redeeming === feature.id || !account || !canAfford}
                              variant={canAfford ? "default" : "outline"}
                            >
                              {redeeming === feature.id ? (
                                <>
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                  Memproses...
                                </>
                              ) : canAfford ? (
                                "Beli dengan Koin"
                              ) : (
                                "Saldo Tidak Cukup"
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">Belum ada fitur premium yang tersedia.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="history">
                <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
                  <History className="size-6" />
                  Riwayat Transaksi
                </h2>
                {transactions.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">Belum ada transaksi</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="divide-y">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between py-4">
                          <div className="flex-1">
                            <p className="font-medium">
                              {COIN_TRANSACTION_TYPE_LABEL[tx.type] ?? tx.type}
                            </p>
                            <p className="text-sm text-muted-foreground">{tx.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                              {tx.amount > 0 ? "+" : ""}
                              {tx.amount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Saldo: {tx.balanceAfter}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </>
  );
}
