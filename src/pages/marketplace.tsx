import { useState, useEffect, useMemo } from "react";
import { ShoppingBag, MapPin, Briefcase, Package, Search, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MemberAvatar, PageBanner } from "@/components/common";
import { SEO } from "@/components/seo";
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
  const [myItems, setMyItems] = useState<MarketplaceListing[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [stockFilter, setStockFilter] = useState("all");
  const [productQuery, setProductQuery] = useState("");

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
  useEffect(() => {
    if (!account || !canCreate) {
      setMyItems([]);
      return;
    }
    let active = true;
    setMyLoading(true);
    const loadMine = async () => {
      try {
        const res = await api<{ items: MarketplaceListing[] }>("marketplace.mine");
        if (active && res) setMyItems(res.items);
      } catch {
        if (active) setMyItems([]);
      } finally {
        if (active) setMyLoading(false);
      }
    };
    void loadMine();
    return () => { active = false; };
  }, [account, canCreate]);
  const filteredMyItems = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase("id-ID");
    return myItems.filter((item) => {
      const matchesQuery = !query || `${item.title} ${item.category}`.toLocaleLowerCase("id-ID").includes(query);
      const matchesStock = stockFilter === "all"
        || (stockFilter === "available" && item.stock > 5)
        || (stockFilter === "low" && item.stock > 0 && item.stock <= 5)
        || (stockFilter === "out" && item.stock === 0);
      return matchesQuery && matchesStock;
    });
  }, [myItems, productQuery, stockFilter]);

  return (
    <>
      <SEO
        title="Marketplace UMKM — Produk & Jasa Komunitas Panti Janda"
        description="Belanja produk kerajinan, kuliner, busana, dan sewa jasa profesional dari para pelaku usaha dan wanita mandiri anggota Panti Janda."
      />
      <PageBanner art="/images/banner-event.svg" className="mb-8">
        <h1 className="font-display text-3xl font-bold">Marketplace</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Temukan produk dan jasa dari anggota Panti Janda. Dukung usaha mereka langsung.
        </p>
      </PageBanner>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {canCreate && (
          <Card className="mb-8 border-primary/20 bg-primary/[0.03]">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold">Manajemen Produk Saya</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Cari dan pantau ketersediaan stok produk Anda.</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{myItems.length} produk</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Cari nama atau kategori produk..."
                    aria-label="Cari produk saya"
                    className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  aria-label="Filter status stok"
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="all">Semua status stok</option>
                  <option value="available">Tersedia (&gt;5)</option>
                  <option value="low">Menipis (1–5)</option>
                  <option value="out">Habis (0)</option>
                </select>
              </div>
              {myLoading ? (
                <div className="mt-4 h-16 animate-pulse rounded-lg bg-secondary" />
              ) : filteredMyItems.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {myItems.length === 0 ? "Belum ada produk yang Anda jual." : "Tidak ada produk yang cocok dengan pencarian atau filter."}
                </p>
              ) : (
                <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
                  {filteredMyItems.map((item) => {
                    const stockLabel = item.stock === 0 ? "Habis" : item.stock <= 5 ? "Menipis" : "Tersedia";
                    const stockTone = item.stock === 0 ? "text-destructive bg-destructive/10" : item.stock <= 5 ? "text-amber-700 bg-amber-100" : "text-emerald-700 bg-emerald-100";
                    return (
                      <div key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
                        {item.photos?.[0] ? <img src={item.photos[0]} alt="" className="size-12 shrink-0 rounded-md object-cover" /> : <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary"><Package className="size-5 text-muted-foreground" aria-hidden /></div>}
                        <div className="min-w-0 flex-1">
                          <Link to={`/marketplace/${item.id}`} className="truncate text-sm font-semibold hover:text-primary hover:underline">{item.title}</Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.category} · {formatRupiah(item.price)}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stockTone}`}>{stockLabel}: {item.stock}</span>
                        <Button asChild size="sm" variant="outline" aria-label={`Edit ${item.title}`}><Link to={`/marketplace/${item.id}/edit`}><Pencil className="mr-1.5 size-3.5" />Edit</Link></Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
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
          <div className="flex flex-wrap gap-2">
            {account ? <Button asChild size="sm" variant="outline"><Link to="/marketplace/orders">Pesanan saya</Link></Button> : null}
            {canCreate ? <Button asChild size="sm"><Link to="/marketplace/baru">Jual Produk/Jasa</Link></Button> : null}
          </div>
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
                <Card className="hover-lift flex h-full flex-col gap-0 overflow-hidden py-0">
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
                  <CardContent className={item.photos && item.photos.length > 0 ? "flex-1 pb-4 pt-4" : "flex-1 pb-4 pt-6"}>
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
                    <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${item.stock === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      <Package className="size-3.5" aria-hidden />
                      {item.stock === 0 ? "Stok habis" : `Stok tersedia: ${item.stock}`}
                    </p>
                  </CardContent>
                  <div className="flex items-center gap-2 border-t border-border bg-secondary/40 px-6 py-3">
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
