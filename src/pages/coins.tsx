import { useState, useEffect } from "react";
import { Coins, Loader2, Wallet, History, Sparkles, ArrowDownCircle, CreditCard, Banknote, Bitcoin, ArrowLeftRight, Copy, Plus, ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";
import { api, errorText } from "@/lib/api";
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
import type { CoinBalance, CoinTransaction, CoinFeature, AppSettings, CryptoSupportedCoin, CryptoWallet, CryptoTransaction } from "@/lib/types";
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
  const [cryptoCoins, setCryptoCoins] = useState<CryptoSupportedCoin[]>([]);
  const [cryptoWallets, setCryptoWallets] = useState<CryptoWallet[]>([]);
  const [cryptoTransactions, setCryptoTransactions] = useState<CryptoTransaction[]>([]);
  const [selectedCryptoCoin, setSelectedCryptoCoin] = useState<string>("");
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositTxHash, setDepositTxHash] = useState("");
  const [depositWalletId, setDepositWalletId] = useState<string>("");
  const [depositing, setDepositing] = useState(false);
  const [swapWalletId, setSwapWalletId] = useState<string>("");
  const [swapAmount, setSwapAmount] = useState<string>("");
  const [swapping, setSwapping] = useState(false);
  const [swapDirection, setSwapDirection] = useState<"to_coins" | "from_coins">("to_coins");
  const [cryptoWithdrawing, setCryptoWithdrawing] = useState(false);
  const [cryptoWithdrawWalletId, setCryptoWithdrawWalletId] = useState<string>("");
  const [cryptoWithdrawAmount, setCryptoWithdrawAmount] = useState<string>("");
  const [cryptoWithdrawAddress, setCryptoWithdrawAddress] = useState("");

  const load = async () => {
    try {
      const [featuresRes, settingsRes, cryptoCoinsRes] = await Promise.all([
        api<{ items: CoinFeature[] }>("coins.features").catch(() => null),
        api<{ coinSettings: CoinSettings }>("coinSettings.settings").catch(() => null),
        api<{ items: CryptoSupportedCoin[] }>("crypto.coins.list").catch(() => null),
      ]);
      if (featuresRes) setFeatures(featuresRes.items);
      if (settingsRes) {
        setCoinSettings(settingsRes.coinSettings);
        const firstEnabled = settingsRes.coinSettings.purchaseMethods.find((m) => m.enabled);
        if (firstEnabled) setSelectedPaymentMethod(firstEnabled.id);
        const firstWithdraw = settingsRes.coinSettings.withdrawMethods.find((m) => m.enabled);
        if (firstWithdraw) setWithdrawMethod(firstWithdraw.id);
      }
      if (cryptoCoinsRes) setCryptoCoins(cryptoCoinsRes.items);

      if (account) {
        const [balanceRes, txRes, cryptoWalletsRes, cryptoTxRes] = await Promise.all([
          api<CoinBalance>("coins.balance").catch(() => null),
          api<{ items: CoinTransaction[] }>("coins.transactions").catch(() => null),
          api<{ items: CryptoWallet[] }>("crypto.wallets.list").catch(() => null),
          api<{ items: CryptoTransaction[] }>("crypto.transactions.list").catch(() => null),
        ]);
        if (balanceRes) setBalance(balanceRes);
        if (txRes) setTransactions(txRes.items);
        if (cryptoWalletsRes) setCryptoWallets(cryptoWalletsRes.items);
        if (cryptoTxRes) setCryptoTransactions(cryptoTxRes.items);
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

  const handleCreateWallet = async () => {
    if (!selectedCryptoCoin) {
      toast.error("Pilih cryptocurrency terlebih dahulu.");
      return;
    }
    setCreatingWallet(true);
    try {
      const coin = cryptoCoins.find((c) => c.id === selectedCryptoCoin);
      if (!coin) {
        toast.error("Coin tidak ditemukan.");
        return;
      }
      const res = await api<{ id: string; coinSymbol: string; walletAddress: string; balance: number }>("crypto.wallets.create", { coinSymbol: coin.symbol });
      if (res?.id) {
        toast.success(`Wallet ${res.coinSymbol} berhasil dibuat!`);
        setSelectedCryptoCoin("");
        await load();
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setCreatingWallet(false);
    }
  };

  const handleCryptoDeposit = async () => {
    if (!depositWalletId) {
      toast.error("Pilih wallet terlebih dahulu.");
      return;
    }
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) {
      toast.error("Masukkan jumlah deposit yang valid.");
      return;
    }
    if (!depositTxHash.trim()) {
      toast.error("Masukkan hash transaksi blockchain.");
      return;
    }
    setDepositing(true);
    try {
      const res = await api<{ amountCrypto: number; amountCoins: number; newWalletBalance: number; newCoinBalance: number; status: string }>("crypto.deposit", {
        walletId: depositWalletId,
        amountCrypto: amount,
        txHash: depositTxHash.trim(),
      });
      if (res?.status === "confirmed") {
        toast.success(`Deposit berhasil! +${res.amountCoins} koin dikreditkan.`);
        setDepositAmount("");
        setDepositTxHash("");
        setDepositWalletId("");
        await load();
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setDepositing(false);
    }
  };

  const handleCryptoWithdraw = async () => {
    if (!cryptoWithdrawWalletId) {
      toast.error("Pilih wallet terlebih dahulu.");
      return;
    }
    const amount = Number(cryptoWithdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("Masukkan jumlah penarikan yang valid.");
      return;
    }
    if (!cryptoWithdrawAddress.trim()) {
      toast.error("Masukkan alamat wallet tujuan.");
      return;
    }
    setCryptoWithdrawing(true);
    try {
      const res = await api<{
        amountCrypto: number;
        fee: number;
        netAmount: number;
        amountCoins: number;
        newWalletBalance: number;
        newCoinBalance: number;
        txHash: string;
        status: string;
      }>("crypto.withdraw", {
        walletId: cryptoWithdrawWalletId,
        amountCrypto: amount,
        toAddress: cryptoWithdrawAddress.trim(),
      });
      if (res) {
        toast.success(`Permintaan penarikan ${res.amountCrypto} sedang diproses. Status: ${res.status}`);
        setCryptoWithdrawAmount("");
        setCryptoWithdrawAddress("");
        setCryptoWithdrawWalletId("");
        await load();
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setCryptoWithdrawing(false);
    }
  };

  const handleCryptoSwap = async () => {
    if (!swapWalletId) {
      toast.error("Pilih wallet terlebih dahulu.");
      return;
    }
    const amount = Number(swapAmount);
    if (!amount || amount <= 0) {
      toast.error("Masukkan jumlah yang valid.");
      return;
    }
    setSwapping(true);
    try {
      const endpoint = swapDirection === "to_coins" ? "crypto.swap.to_coins" : "crypto.swap.from_coins";
      const payload = swapDirection === "to_coins"
        ? { walletId: swapWalletId, amountCrypto: amount }
        : { walletId: swapWalletId, amountCoins: amount };
      const res = await api<{
        amountCrypto: number;
        amountCoins: number;
        newWalletBalance: number;
        newCoinBalance: number;
        conversionRate: number;
      }>(endpoint, payload);
      if (res) {
        toast.success(
          swapDirection === "to_coins"
            ? `Berhasil swap ${res.amountCrypto} ke ${res.amountCoins} koin!`
            : `Berhasil swap ${res.amountCoins} koin ke ${res.amountCrypto.toFixed(6)} crypto!`
        );
        setSwapAmount("");
        setSwapWalletId("");
        await load();
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSwapping(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Alamat wallet disalin.");
  };

  const getWalletCoin = (wallet: CryptoWallet) => cryptoCoins.find((c) => c.symbol === wallet.coinSymbol && c.network === wallet.network);

  const CRYPTO_TX_TYPE_LABEL: Record<string, string> = {
    deposit: "Deposit",
    withdraw: "Penarikan",
    swap_to_coins: "Swap ke Koin",
    swap_from_coins: "Swap dari Koin",
    transfer: "Transfer",
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
                <TabsTrigger value="crypto">
                  <Bitcoin className="mr-2 size-4" />
                  Crypto Wallet
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

              <TabsContent value="crypto">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Bitcoin className="size-5 text-primary" />
                        Wallet Crypto Anda
                      </CardTitle>
                      <CardDescription>Kelola wallet crypto terintegrasi dengan koin webapp.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {cryptoWallets.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="mb-4 text-muted-foreground">Anda belum memiliki wallet crypto.</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {cryptoWallets.map((wallet) => {
                            const coin = getWalletCoin(wallet);
                            const coinsEquivalent = wallet.balance * (coin?.coinConversionRate ?? 0);
                            return (
                              <Card key={wallet.id} className="border-primary/20">
                                <CardContent className="space-y-3 pt-5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: coin?.color ?? "#666" }}>
                                        {wallet.coinSymbol.slice(0, 2)}
                                      </div>
                                      <div>
                                        <p className="font-semibold">{coin?.name ?? wallet.coinSymbol}</p>
                                        <p className="text-xs text-muted-foreground">{wallet.network}</p>
                                      </div>
                                    </div>
                                    <Badge variant="secondary">{wallet.coinSymbol}</Badge>
                                  </div>
                                  <div>
                                    <p className="text-2xl font-bold">{wallet.balance.toLocaleString("id-ID", { maximumFractionDigits: 8 })}</p>
                                    <p className="text-xs text-muted-foreground">
                                      ≈ {coinsEquivalent.toLocaleString("id-ID", { maximumFractionDigits: 0 })} koin
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 rounded bg-muted px-2 py-1.5">
                                    <code className="flex-1 truncate text-xs">{wallet.walletAddress}</code>
                                    <button type="button" onClick={() => copyToClipboard(wallet.walletAddress)} className="shrink-0 text-muted-foreground hover:text-foreground">
                                      <Copy className="size-3.5" />
                                    </button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {cryptoWallets.length < cryptoCoins.length && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Plus className="size-4" />
                          Buat Wallet Baru
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="min-w-[200px] flex-1 space-y-1">
                            <Label>Pilih Cryptocurrency</Label>
                            <Select value={selectedCryptoCoin} onValueChange={setSelectedCryptoCoin}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih coin..." />
                              </SelectTrigger>
                              <SelectContent>
                                {cryptoCoins
                                  .filter((c) => !cryptoWallets.some((w) => w.coinSymbol === c.symbol && w.network === c.network))
                                  .map((coin) => (
                                    <SelectItem key={coin.id} value={coin.id}>
                                      {coin.symbol} — {coin.name} ({coin.network})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={handleCreateWallet} disabled={creatingWallet || !selectedCryptoCoin || !account}>
                            {creatingWallet ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Membuat...
                              </>
                            ) : (
                              "Buat Wallet"
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {cryptoWallets.length > 0 && (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <ArrowDownLeft className="size-4 text-green-600" />
                            Deposit Crypto
                          </CardTitle>
                          <CardDescription>Kirim crypto ke alamat wallet Anda, lalu masukkan hash transaksi untuk mengkonversi ke koin webapp.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-1">
                            <Label>Pilih Wallet</Label>
                            <Select value={depositWalletId} onValueChange={setDepositWalletId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih wallet tujuan..." />
                              </SelectTrigger>
                              <SelectContent>
                                {cryptoWallets.map((w) => (
                                  <SelectItem key={w.id} value={w.id}>
                                    {w.coinSymbol} ({w.network}) — {w.walletAddress.slice(0, 12)}...
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label>Jumlah Crypto</Label>
                              <Input type="number" min={0} step="any" placeholder="Contoh: 10.5" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label>Hash Transaksi Blockchain</Label>
                              <Input placeholder="Contoh: 0xabc123..." value={depositTxHash} onChange={(e) => setDepositTxHash(e.target.value)} />
                            </div>
                          </div>
                          {depositWalletId && depositAmount && Number(depositAmount) > 0 && (() => {
                            const wallet = cryptoWallets.find((w) => w.id === depositWalletId);
                            const coin = wallet ? getWalletCoin(wallet) : null;
                            if (!coin) return null;
                            const coinsEquiv = Number(depositAmount) * coin.coinConversionRate;
                            return (
                              <div className="rounded-lg border border-border p-3 text-sm">
                                <span className="text-muted-foreground">Estimasi koin diterima: </span>
                                <span className="font-bold text-primary">{coinsEquiv.toLocaleString("id-ID", { maximumFractionDigits: 0 })} koin</span>
                                <span className="text-muted-foreground"> (1 {coin.symbol} = {coin.coinConversionRate.toLocaleString("id-ID")} koin)</span>
                              </div>
                            );
                          })()}
                          <Button onClick={handleCryptoDeposit} disabled={depositing || !account || !depositWalletId || !depositAmount || !depositTxHash.trim()}>
                            {depositing ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Memproses deposit...
                              </>
                            ) : (
                              "Konfirmasi Deposit"
                            )}
                          </Button>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <ArrowLeftRight className="size-4 text-primary" />
                            Swap Crypto ↔ Koin
                          </CardTitle>
                          <CardDescription>Tukar saldo crypto menjadi koin webapp atau sebaliknya.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${swapDirection === "to_coins" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}
                              onClick={() => setSwapDirection("to_coins")}
                            >
                              <ArrowDownLeft className="mr-1.5 inline size-4" />
                              Crypto → Koin
                            </button>
                            <button
                              type="button"
                              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${swapDirection === "from_coins" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}
                              onClick={() => setSwapDirection("from_coins")}
                            >
                              <ArrowUpRight className="mr-1.5 inline size-4" />
                              Koin → Crypto
                            </button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label>Pilih Wallet</Label>
                              <Select value={swapWalletId} onValueChange={setSwapWalletId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih wallet..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {cryptoWallets.map((w) => (
                                    <SelectItem key={w.id} value={w.id}>
                                      {w.coinSymbol} ({w.network}) — Saldo: {w.balance}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label>Jumlah Crypto</Label>
                              <Input type="number" min={0} step="any" placeholder="Contoh: 5.0" value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)} />
                            </div>
                          </div>
                          {swapWalletId && swapAmount && Number(swapAmount) > 0 && (() => {
                            const wallet = cryptoWallets.find((w) => w.id === swapWalletId);
                            const coin = wallet ? getWalletCoin(wallet) : null;
                            if (!coin) return null;
                            const coinsEquiv = Number(swapAmount) * coin.coinConversionRate;
                            return (
                              <div className="rounded-lg border border-border p-3 text-sm">
                                {swapDirection === "to_coins" ? (
                                  <>
                                    <span className="text-muted-foreground">Koin diterima: </span>
                                    <span className="font-bold text-green-600">+{coinsEquiv.toLocaleString("id-ID", { maximumFractionDigits: 0 })} koin</span>
                                    <span className="text-muted-foreground"> (dikurangi dari saldo crypto)</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-muted-foreground">Crypto diterima: </span>
                                    <span className="font-bold text-green-600">+{Number(swapAmount).toLocaleString("id-ID", { maximumFractionDigits: 8 })} {coin.symbol}</span>
                                    <span className="text-muted-foreground"> (dikurangi {coinsEquiv.toLocaleString("id-ID", { maximumFractionDigits: 0 })} koin dari saldo)</span>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          <Button onClick={handleCryptoSwap} disabled={swapping || !account || !swapWalletId || !swapAmount || Number(swapAmount) <= 0}>
                            {swapping ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Memproses swap...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-2 size-4" />
                                {swapDirection === "to_coins" ? "Swap ke Koin" : "Swap ke Crypto"}
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <ArrowUpRight className="size-4 text-orange-600" />
                            Tarik Crypto ke Blockchain
                          </CardTitle>
                          <CardDescription>Kirim crypto dari wallet Anda ke alamat blockchain eksternal.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-1">
                            <Label>Pilih Wallet</Label>
                            <Select value={cryptoWithdrawWalletId} onValueChange={setCryptoWithdrawWalletId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih wallet sumber..." />
                              </SelectTrigger>
                              <SelectContent>
                                {cryptoWallets.map((w) => (
                                  <SelectItem key={w.id} value={w.id}>
                                    {w.coinSymbol} ({w.network}) — Saldo: {w.balance}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label>Jumlah Crypto</Label>
                              <Input type="number" min={0} step="any" placeholder="Contoh: 5.0" value={cryptoWithdrawAmount} onChange={(e) => setCryptoWithdrawAmount(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label>Alamat Tujuan</Label>
                              <Input placeholder="Alamat wallet blockchain tujuan" value={cryptoWithdrawAddress} onChange={(e) => setCryptoWithdrawAddress(e.target.value)} />
                            </div>
                          </div>
                          {cryptoWithdrawWalletId && cryptoWithdrawAmount && (() => {
                            const wallet = cryptoWallets.find((w) => w.id === cryptoWithdrawWalletId);
                            const coin = wallet ? getWalletCoin(wallet) : null;
                            if (!coin) return null;
                            const amount = Number(cryptoWithdrawAmount) || 0;
                            const fee = amount * (coin.withdrawFeePercent / 100);
                            const net = amount - fee;
                            return amount > 0 ? (
                              <div className="rounded-lg border border-border p-3 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Jumlah kirim</span>
                                  <span>{amount} {coin.symbol}</span>
                                </div>
                                <div className="flex justify-between text-red-600">
                                  <span>Biaya ({coin.withdrawFeePercent}%)</span>
                                  <span>-{fee.toLocaleString("id-ID", { maximumFractionDigits: 8 })} {coin.symbol}</span>
                                </div>
                                <Separator className="my-1.5" />
                                <div className="flex justify-between font-bold">
                                  <span>Diterima</span>
                                  <span className="text-green-600">{net.toLocaleString("id-ID", { maximumFractionDigits: 8 })} {coin.symbol}</span>
                                </div>
                              </div>
                            ) : null;
                          })()}
                          <Button onClick={handleCryptoWithdraw} disabled={cryptoWithdrawing || !account || !cryptoWithdrawWalletId || !cryptoWithdrawAmount || !cryptoWithdrawAddress.trim()}>
                            {cryptoWithdrawing ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Memproses penarikan...
                              </>
                            ) : (
                              "Tarik Crypto"
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <History className="size-4" />
                        Riwayat Transaksi Crypto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {cryptoTransactions.length === 0 ? (
                        <p className="py-6 text-center text-muted-foreground">Belum ada transaksi crypto.</p>
                      ) : (
                        <div className="divide-y">
                          {cryptoTransactions.map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between py-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={tx.status === "confirmed" ? "default" : tx.status === "pending" ? "secondary" : "destructive"} className="text-xs">
                                    {tx.status}
                                  </Badge>
                                  <span className="text-sm font-medium">{CRYPTO_TX_TYPE_LABEL[tx.type] ?? tx.type}</span>
                                  <span className="text-xs text-muted-foreground">{tx.coinSymbol}</span>
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">{tx.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(tx.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${tx.amountCrypto > 0 ? "text-green-600" : "text-red-600"}`}>
                                  {tx.amountCrypto > 0 ? "+" : ""}{tx.amountCrypto.toLocaleString("id-ID", { maximumFractionDigits: 8 })} {tx.coinSymbol}
                                </p>
                                {tx.amountCoins !== 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {tx.amountCoins > 0 ? "+" : ""}{tx.amountCoins.toLocaleString("id-ID")} koin
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </>
  );
}
