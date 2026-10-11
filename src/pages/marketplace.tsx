import { useState, useEffect } from "react";
import { ShoppingBag, MapPin, Briefcase } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MemberAvatar, PageBanner } from "@/components/common";
import { LISTING_CATEGORIES, LISTING_KIND_LABEL, ROLE_RANK } from "@/lib/constants";
import type { MarketplaceListing } from "@/lib/types";

function formatRupiah(amount: number | null) {
  if (amount === null) return "Hubungi penjual";
  return `Rp${amount.toLocaleString("id-ID")}`;
}

export default function MarketplacePage() {
  const { account } = useAuth();
  const [items, setItems] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const payload: Record<string, unknown> = {};
        if (kindFilter) payload.kind = kindFilter;
        if (categoryFilter) payload.category = categoryFilter;
        const res = await api<{ items: MarketplaceListing[] }>("marketplace.list", payload);
        if (active && res) setItems(res.items);
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [kindFilter, categoryFilter]);

  const rank = account ? ROLE_RANK[account.role] ?? 0 : 0;
  const canCreate = rank >= 2;

  return (
    <>
      <PageBanner art="/images/banner-event.svg">
        <h1 className="font-display text-3xl font-bold">Marketplace</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Temukan produk dan jasa dari anggota Panti Janda. Dukung usaha mereka langsung.
        </p>
      </PageBanner>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">Semua jenis</option>
              <option value="barang">Barang</option>
              <option value="jasa">Jasa</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">Semua kategori</option>
              {LISTING_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          {canCreate && (
            <Button asChild size="sm">
              <Link to="/marketplace/baru">Jual Produk/Jasa</Link>
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6">
                  <div className="h-4 w-3/4 rounded bg-secondary" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-secondary" />
                  <div className="mt-4 h-8 w-1/3 rounded bg-secondary" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">Belum ada produk atau jasa yang dijual.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Link key={item.id} to={`/marketplace/${item.id}`}>
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                  {item.photos && item.photos.length > 0 && (
                    <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                      <img
                        src={item.photos[0]}
                        alt={item.title}
                        className="size-full object-cover transition-transform hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <CardContent className={item.photos && item.photos.length > 0 ? "pt-4" : "pt-6"}>
                    <div className="flex items-start justify-between">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {LISTING_KIND_LABEL[item.kind] ?? item.kind}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.category}</span>
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold leading-tight">{item.title}</h3>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                    )}
                    <p className="mt-3 font-display text-xl font-bold text-primary">
                      {formatRupiah(item.price)}
                    </p>
                    <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                      <MemberAvatar
                        name={item.sellerName}
                        photoData={item.sellerPhoto}
                        size={28}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.sellerName}</p>
                        {item.sellerCity && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3" />
                            {item.sellerCity}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Briefcase className="size-6 text-blue-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-blue-900">Cari kerja remote atau part-time?</p>
              <p className="text-xs text-blue-700">Kunjungi Job Board di Learning Center untuk lowongan yang ramah ibu tunggal.</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/learning-center">Buka Learning Center</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
