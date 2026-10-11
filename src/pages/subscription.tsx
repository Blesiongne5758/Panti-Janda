import { useState, useEffect } from "react";
import { Crown, Check, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBanner } from "@/components/common";
import { SUBSCRIPTION_STATUS_LABEL, TIER_META, PUBLIC_TIER_META } from "@/lib/constants";
import type { Subscription } from "@/lib/types";

const JANDA_TIERS = ["sosialita", "high_society", "the_ceo"] as const;
const NON_JANDA_TIERS = ["ceo", "sultan"] as const;

function formatRupiah(amount: number) {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

export default function SubscriptionPage() {
  const { account, profile } = useAuth();
  const [active, setActive] = useState<Subscription | null>(null);
  const [items, setItems] = useState<Subscription[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({ sosialita: 100000, high_society: 500000, the_ceo: 1000000, ceo: 1000000, sultan: 2000000 });
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const isJanda = account ? ["wonder_woman", "sosialita", "high_society", "the_ceo"].includes(account.role) : false;
  const tiers = isJanda ? JANDA_TIERS : NON_JANDA_TIERS;

  const load = async () => {
    try {
      const [subsRes, pricesRes] = await Promise.all([
        api<{ items: Subscription[]; active: Subscription | null }>("subscriptions.mine"),
        api<{ prices: Record<string, number> }>("subscriptions.prices"),
      ]);
      if (subsRes) {
        setItems(subsRes.items);
        setActive(subsRes.active);
      }
      if (pricesRes) {
        setPrices(pricesRes.prices);
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

  const handleSubscribe = async (tier: string) => {
    setSubscribing(tier);
    try {
      const res = await api<{ redirectUrl: string | null; orderId: string }>("subscriptions.create", { tier });
      if (res?.redirectUrl) {
        window.location.href = res.redirectUrl;
      }
    } catch {
      // ignore
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    if (!active) return;
    setCancelling(true);
    try {
      await api("subscriptions.cancel", { subscriptionId: active.id });
      await load();
    } catch {
      // ignore
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <PageBanner art="/images/banner-event.svg">
        <h1 className="font-display text-3xl font-bold">Langganan Tier</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Dapatkan badge tier tanpa syarat KPI melalui langganan bulanan. Dukungan Anda membantu operasional komunitas.
        </p>
      </PageBanner>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {active && (
              <Card className="mb-8 border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="size-5 text-primary" />
                    Langganan Aktif: {(isJanda ? TIER_META[active.tier as keyof typeof TIER_META]?.label : PUBLIC_TIER_META[active.tier as keyof typeof PUBLIC_TIER_META]?.label) ?? active.tier}
                  </CardTitle>
                  <CardDescription>
                    Berakhir: {new Date(active.expiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Tagihan bulanan: {formatRupiah(active.monthlyAmount)}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
                    {cancelling ? "Membatalkan..." : "Batalkan Langganan"}
                  </Button>
                </CardFooter>
              </Card>
            )}

            {items.length > 0 && !active && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Riwayat Langganan</CardTitle>
                  <CardDescription>Anda memiliki {items.length} langganan sebelumnya</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {items.slice(0, 3).map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                        <span className="font-medium">
                          {(isJanda ? TIER_META[sub.tier as keyof typeof TIER_META]?.label : PUBLIC_TIER_META[sub.tier as keyof typeof PUBLIC_TIER_META]?.label) ?? sub.tier}
                        </span>
                        <span className="text-muted-foreground">
                          {SUBSCRIPTION_STATUS_LABEL[sub.status] ?? sub.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <h2 className="mb-4 font-display text-2xl font-semibold">Pilih Tier</h2>
            <div className={`grid gap-6 ${isJanda ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {tiers.map((tier) => {
                const meta = isJanda ? TIER_META[tier as keyof typeof TIER_META] : PUBLIC_TIER_META[tier as keyof typeof PUBLIC_TIER_META];
                const price = prices[tier] ?? 0;
                const isCurrent = active?.tier === tier;
                return (
                  <Card key={tier} className={isCurrent ? "border-primary" : ""}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="size-5" style={{ color: meta.accent }} />
                        {meta.label}
                      </CardTitle>
                      <CardDescription>{meta.tagline}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl font-bold">
                        {formatRupiah(price)}
                        <span className="text-base font-normal text-muted-foreground">/bulan</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{meta.description}</p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          Badge tier di profil
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          Akses fitur eksklusif tier
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          Prioritas dalam program komunitas
                        </li>
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        disabled={isCurrent || subscribing !== null || !!active}
                        onClick={() => handleSubscribe(tier)}
                      >
                        {subscribing === tier ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Memproses...
                          </>
                        ) : isCurrent ? (
                          "Tier Anda Saat Ini"
                        ) : active ? (
                          "Batalkan tier aktif terlebih dahulu"
                        ) : (
                          "Berlangganan"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            <Card className="mt-8 bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <X className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Ketentuan Langganan</p>
                    <ul className="mt-2 space-y-1">
                      <li>Langganan aktif selama 30 hari sejak pembayaran dikonfirmasi</li>
                      <li>Badge tier akan ditampilkan di profil selama langganan aktif</li>
                      <li>Anda dapat berlangganan tier lain setelah membatalkan langganan saat ini</li>
                      <li>Pembayaran melalui Midtrans (transfer bank, e-wallet, atau QRIS)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
