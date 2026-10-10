import { useState, useEffect } from "react";
import { MapPin, MessageCircle, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link, useRoute } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberAvatar, PageBanner } from "@/components/common";
import { LISTING_KIND_LABEL, LISTING_STATUS_LABEL } from "@/lib/constants";
import type { MarketplaceListing } from "@/lib/types";

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
        </div>
      </PageBanner>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {formatRupiah(listing.price)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
      </div>
    </>
  );
}
