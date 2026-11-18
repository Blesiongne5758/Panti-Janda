import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, PackageCheck, ShoppingBag } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link, useQueryParam, useRoute } from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNote, PageBanner } from "@/components/common";
import { SEO } from "@/components/seo";

type OrderStatus = "pending" | "confirmed" | "fulfilled" | "cancelled";
type MarketplaceOrder = {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerAccountId: string;
  sellerAccountId: string;
  quantity: number;
  buyerMessage: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  direction: "buyer" | "seller";
};

const statusLabel: Record<OrderStatus, string> = {
  pending: "Menunggu konfirmasi",
  confirmed: "Dikonfirmasi",
  fulfilled: "Selesai",
  cancelled: "Dibatalkan",
};

export default function MarketplaceOrdersPage() {
  const { account } = useAuth();
  const { navigate } = useRoute();
  const targetOrderId = useQueryParam("order");
  const [items, setItems] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!account) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setFailed(null);
      try {
        const result = await api<{ items: MarketplaceOrder[] }>("marketplace.orders.list");
        if (active) setItems(result.items ?? []);
      } catch (error) {
        if (active) setFailed(errorText(error) || "Pesanan belum dapat dimuat.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [account?.id, reloadKey]);

  const update = async (order: MarketplaceOrder, status: "confirmed" | "fulfilled" | "cancelled") => {
    setBusyId(order.id);
    setFailed(null);
    try {
      await api("marketplace.orders.update", { id: order.id, status });
      setReloadKey((key) => key + 1);
    } catch (error) {
      setFailed(errorText(error) || "Status pesanan tidak dapat diperbarui.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <SEO title="Pesanan Marketplace — Panti Janda" description="Lihat pesanan yang Anda buat dan pesanan yang masuk ke toko Anda." />
      <PageBanner art="/images/banner-event.svg" className="mb-8">
        <button onClick={() => navigate("/marketplace")} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Kembali ke Marketplace
        </button>
        <h1 className="font-display text-3xl font-bold">Pesanan Marketplace</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Pantau permintaan pesanan Anda sebagai pembeli maupun penjual.</p>
      </PageBanner>
      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-12 sm:px-6">
        {!account ? (
          <Card><CardContent className="space-y-3 py-8 text-center">
            <ShoppingBag className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Masuk untuk melihat pesanan marketplace Anda.</p>
            <Button asChild><Link to="/masuk">Masuk</Link></Button>
          </CardContent></Card>
        ) : loading ? (
          <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin" aria-label="Memuat pesanan" /></div>
        ) : failed ? (
          <ErrorNote message={failed} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((order) => {
              const highlighted = order.id === targetOrderId;
              const canConfirm = order.direction === "seller" && order.status === "pending";
              const canFulfill = order.direction === "seller" && order.status === "confirmed";
              const canCancel = order.direction === "seller" && ["pending", "confirmed"].includes(order.status);
              return (
                <Card key={order.id} id={`order-${order.id}`} className={highlighted ? "border-primary ring-2 ring-primary/20" : undefined}>
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{order.listingTitle}</CardTitle>
                      <CardDescription className="mt-1">{order.direction === "seller" ? "Pesanan masuk" : "Pesanan saya"} · {new Date(order.createdAt).toLocaleString("id-ID")}</CardDescription>
                    </div>
                    <Badge variant={order.status === "pending" ? "outline" : order.status === "cancelled" ? "destructive" : "secondary"}>{statusLabel[order.status] ?? order.status}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">Jumlah: <span className="font-semibold">{order.quantity}</span></p>
                    {order.buyerMessage ? <p className="whitespace-pre-wrap rounded-lg bg-secondary/50 p-3 text-sm">Pesan pembeli: {order.buyerMessage}</p> : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" asChild><Link to={`/marketplace/${order.listingId}`}>Lihat produk</Link></Button>
                      {canConfirm ? <Button size="sm" disabled={busyId === order.id} onClick={() => void update(order, "confirmed")}>{busyId === order.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <PackageCheck className="mr-2 size-4" />}Konfirmasi</Button> : null}
                      {canFulfill ? <Button size="sm" disabled={busyId === order.id} onClick={() => void update(order, "fulfilled")}>{busyId === order.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Tandai selesai</Button> : null}
                      {canCancel ? <Button size="sm" variant="ghost" disabled={busyId === order.id} onClick={() => void update(order, "cancelled")}>Batalkan</Button> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">Ini adalah permintaan pesanan; pembayaran tidak diproses di halaman ini.</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card><CardContent className="space-y-3 py-10 text-center">
            <ShoppingBag className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Belum ada pesanan masuk atau pesanan yang Anda buat.</p>
            <Button asChild variant="outline"><Link to="/marketplace">Jelajahi Marketplace</Link></Button>
          </CardContent></Card>
        )}
      </main>
    </>
  );
}
