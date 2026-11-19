import { useState, useEffect } from "react";
import { MapPin, MessageCircle, ArrowLeft, Package } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link, useRoute } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberAvatar, PageBanner } from "@/components/common";
import { LISTING_KIND_LABEL, LISTING_STATUS_LABEL } from "@/lib/constants";
import type { MarketplaceListing } from "@/lib/types";
import { PaymentQris } from "@/components/payment-qris";

function formatRupiah(amount: number | null) {
  if (amount === null) return "Hubungi penjual";
  return `Rp${amount.toLocaleString("id-ID")}`;
}

export default function MarketplaceDetailPage() {
  const { navigate } = useRoute();
  const { account } = useAuth();
  const pathParts = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "").split("/").filter(Boolean) : [];
  const id = pathParts[1] ?? "";
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [sellerWhatsapp, setSellerWhatsapp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState("1");
  const [buyerMessage, setBuyerMessage] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api<{ listing: MarketplaceListing; sellerWhatsapp: string | null }>("marketplace.get", { id });
        if (active && res) {
          setListing(res.listing);
          setSellerWhatsapp(res.sellerWhatsapp);
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded bg-secondary" />
          <div className="h-4 w-2/3 rounded bg-secondary" />
          <div className="h-32 rounded bg-secondary" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6">
        <p className="text-muted-foreground">Produk tidak ditemukan.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/marketplace">Kembali ke Marketplace</Link>
        </Button>
      </div>
    );
  }

  const whatsappLink = sellerWhatsapp
    ? `https://wa.me/${sellerWhatsapp.replace(/\D/g, "")}?text=Halo, saya tertarik dengan "${listing.title}" di Marketplace Panti Janda.`
    : null;

  const createOrder = async () => {
    setOrderBusy(true);
    setOrderError(null);
    try {
      const result = await api<{ order: { id: string } }>("marketplace.orders.create", {
        listingId: listing.id,
        quantity: Number(quantity),
        message: buyerMessage.trim() || undefined,
      });
      navigate(`/marketplace/orders?order=${encodeURIComponent(result.order.id)}`);
    } catch (error) {
      setOrderError(errorText(error) || "Permintaan pesanan belum dapat dibuat.");
    } finally {
      setOrderBusy(false);
    }
  };

  return (
    <>
      <PageBanner art="/images/banner-event.svg">
        <button
          onClick={() => navigate("/marketplace")}
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Marketplace
        </button>
        <h1 className="font-display text-3xl font-bold">{listing.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {LISTING_KIND_LABEL[listing.kind] ?? listing.kind}
          </span>
          <span className="text-sm text-muted-foreground">{listing.category}</span>
          <span className="text-sm text-muted-foreground">
            {LISTING_STATUS_LABEL[listing.status] ?? listing.status}
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Package className="size-3.5" aria-hidden />
            Stok: {listing.stock}
          </span>
        </div>
      </PageBanner>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {listing.price !== null && <div className="mb-4"><PaymentQris amount={listing.price} compact /></div>}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardTitle className="font-display text-2xl">{formatRupiah(listing.price)}</CardTitle>
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="size-4" aria-hidden />
              Stok tersedia: <span className="font-semibold text-foreground">{listing.stock}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {listing.photos && listing.photos.length > 0 && (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-border">
                  <img
                    src={listing.photos[0]}
                    alt={listing.title}
                    className="aspect-[16/9] w-full object-cover"
                  />
                </div>
                {listing.photos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {listing.photos.slice(1).map((photo, index) => (
                      <div
                        key={index}
                        className="size-20 shrink-0 overflow-hidden rounded-lg border border-border"
                      >
                        <img
                          src={photo}
                          alt={`${listing.title} ${index + 2}`}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {listing.description && (
              <div>
                <h3 className="mb-2 font-medium">Deskripsi</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{listing.description}</p>
              </div>
            )}

            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <h3 className="mb-3 font-medium">Penjual</h3>
              <div className="flex items-center gap-3">
                <MemberAvatar
                  name={listing.sellerName}
                  photoData={listing.sellerPhoto}
                  size={48}
                />
                <div>
                  <Link
                    to={`/janda/${listing.sellerProfileId}`}
                    className="font-medium hover:underline"
                  >
                    {listing.sellerName}
                  </Link>
                  {listing.sellerCity && (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3" />
                      {listing.sellerCity}
                    </p>
                  )}
                </div>
              </div>
              {whatsappLink && account && (
                <Button asChild className="mt-4 w-full sm:w-auto">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 size-4" />
                    Hubungi via WhatsApp
                  </a>
                </Button>
              )}
              {account && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Atau kunjungi{" "}
                  <Link to={`/janda/${listing.sellerProfileId}`} className="text-primary hover:underline">
                    profil penjual
                  </Link>
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Dipublikasikan: {new Date(listing.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </CardContent>
        </Card>
        {account && listing.status === "active" ? (
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-lg">Ajukan pesanan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label htmlFor="order-quantity" className="block text-sm font-medium">Jumlah</label>
              <input id="order-quantity" type="number" min={1} max={99} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full max-w-32 rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <label htmlFor="order-message" className="block text-sm font-medium">Pesan untuk penjual (opsional)</label>
              <textarea id="order-message" maxLength={1000} rows={3} value={buyerMessage} onChange={(event) => setBuyerMessage(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              {orderError ? <p role="alert" className="text-sm text-destructive">{orderError}</p> : null}
              <Button disabled={orderBusy || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 99} onClick={() => void createOrder()}>
                {orderBusy ? "Mengirim…" : "Kirim permintaan pesanan"}
              </Button>
              <p className="text-xs text-muted-foreground">Pesanan menunggu konfirmasi penjual. Pembayaran tidak diproses di sini.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
