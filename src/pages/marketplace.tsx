import { useState, useEffect, useMemo } from "react";
import { ShoppingBag, MapPin, Briefcase, Package, Search, Pencil, SlidersHorizontal } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNote, MemberAvatar, PageBanner } from "@/components/common";
import { MarketplacePhotoFallback } from "@/components/marketplace-photo-fallback";
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
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [kindFilter, setKindFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [myItems, setMyItems] = useState<MarketplaceListing[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [stockFilter, setStockFilter] = useState("all");
  const [productQuery, setProductQuery] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setFailed(null);
      try {
        const payload: Record<string, unknown> = {};
        if (kindFilter) payload.kind = kindFilter;
        if (categoryFilter) payload.category = categoryFilter;
        const res = await api<{ items: MarketplaceListing[] }>("marketplace.list", payload);
        if (active && res) setItems(res.items);
      } catch (error) {
        if (active) setFailed(errorText(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [kindFilter, categoryFilter, reloadKey]);

  const rank = account ? ROLE_RANK[account.role] ?? 0 : 0;
  const canCreate = rank >= 2;
  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return items.filter((item) => `${item.title} ${item.description ?? ""} ${item.category}`.toLocaleLowerCase("id-ID").includes(query));
  }, [items, search]);
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
        <div className="mb-6 rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari produk atau jasa…" aria-label="Cari produk atau jasa" className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <div className="flex gap-2">
              <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} aria-label="Filter jenis" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm sm:flex-none">
                <option value="">Semua jenis</option><option value="barang">Barang</option><option value="jasa">Jasa</option>
              </select>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter kategori" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm sm:flex-none">
                <option value="">Semua kategori</option>{LISTING_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div className="flex shrink-0 gap-2">
              {account ? <Button asChild size="sm" variant="outline"><Link to="/marketplace/orders">Pesanan saya</Link></Button> : null}
              {canCreate ? <Button asChild size="sm"><Link to="/marketplace/baru">Jual Produk/Jasa</Link></Button> : null}
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 px-1 text-xs text-muted-foreground"><SlidersHorizontal className="size-3.5" aria-hidden="true" />{visibleItems.length} produk dan jasa</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-[4/3] animate-pulse bg-secondary" />
                <CardContent className="space-y-3 p-3 sm:p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : failed ? <ErrorNote message={failed} onRetry={() => setReloadKey((key) => key + 1)} /> : visibleItems.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><ShoppingBag className="mx-auto size-10 text-muted-foreground" /><p className="mt-3 font-medium">{items.length ? "Produk tidak ditemukan" : "Belum ada produk atau jasa yang dijual"}</p><p className="mt-1 text-sm text-muted-foreground">{items.length ? "Coba kata kunci atau filter lainnya." : "Jadilah yang pertama membuka etalase di komunitas."}</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            {visibleItems.map((item) => (
              <Link key={item.id} to={`/marketplace/${item.id}`} className="group min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <Card className="flex h-full flex-col gap-0 overflow-hidden rounded-2xl border-border/80 bg-card py-0 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/70">
                    {item.photos?.[0] ? <><img src={item.photos[0]} alt={item.title} className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextElementSibling?.classList.remove("hidden"); }} /><MarketplacePhotoFallback kindLabel={LISTING_KIND_LABEL[item.kind] ?? item.kind} category={item.category} className="absolute inset-0 hidden" /><span className="absolute left-2 top-2 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-semibold text-primary shadow-sm backdrop-blur sm:text-xs">{LISTING_KIND_LABEL[item.kind] ?? item.kind}</span></> : <MarketplacePhotoFallback kindLabel={LISTING_KIND_LABEL[item.kind] ?? item.kind} category={item.category} className="size-full" />}
                  </div>
                  <CardContent className="flex flex-1 flex-col p-3 sm:p-4">
                    <span className="line-clamp-1 text-[10px] text-muted-foreground sm:text-xs">{item.category}</span>
                    <h3 className="mt-2 line-clamp-2 min-h-10 font-display text-sm font-semibold leading-snug sm:text-base">{item.title}</h3>
                    {item.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{item.description}</p>}
                    <p className="mt-2 font-display text-base font-bold text-primary sm:mt-3 sm:text-xl">{formatRupiah(item.price)}</p>
                    <p className={`mt-2 flex items-center gap-1.5 text-[10px] font-medium sm:text-xs ${item.stock === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      <Package className="size-3.5 shrink-0" aria-hidden />
                      {item.stock === 0 ? "Stok habis" : `Stok tersedia: ${item.stock}`}
                    </p>
                  </CardContent>
                  <div className="flex items-center gap-2 border-t border-border bg-secondary/40 px-3 py-3 sm:px-4">
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
