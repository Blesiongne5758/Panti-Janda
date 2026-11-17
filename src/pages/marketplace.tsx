import { useState, useEffect } from "react";
import { getAccountRank } from "@/lib/constants";
import { ShoppingBag, MapPin, Briefcase, Search, SlidersHorizontal } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNote, MemberAvatar, PageBanner } from "@/components/common";
import { SEO } from "@/components/seo";
import { LISTING_CATEGORIES, LISTING_KIND_LABEL } from "@/lib/constants";
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

  const rank = getAccountRank(account);
  const canCreate = rank >= 2;
  const visibleItems = items.filter((item) => `${item.title} ${item.description ?? ""} ${item.category}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID")));

  return (
    <>
      <SEO title="Marketplace UMKM — Produk & Jasa Komunitas Panti Janda" description="Belanja produk kerajinan, kuliner, busana, dan sewa jasa profesional dari para pelaku usaha dan wanita mandiri anggota Panti Janda." />
      <PageBanner art="/images/banner-event.svg" className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Usaha komunitas</p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Marketplace</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Temukan produk dan jasa pilihan dari anggota Panti Janda. Belanja sekaligus dukung usaha mandiri.</p>
          </div>
          {canCreate && <Button asChild className="shrink-0"><Link to="/marketplace/baru">Jual Produk/Jasa</Link></Button>}
        </div>
      </PageBanner>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-7 rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk atau jasa…" aria-label="Cari produk atau jasa" className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <div className="flex gap-2">
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} aria-label="Filter jenis" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm sm:flex-none">
                <option value="">Semua jenis</option><option value="barang">Barang</option><option value="jasa">Jasa</option>
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter kategori" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm sm:flex-none">
                <option value="">Semua kategori</option>{LISTING_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 px-1 text-xs text-muted-foreground"><SlidersHorizontal className="size-3.5" />{visibleItems.length} produk dan jasa</p>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Card key={i} className="overflow-hidden"><div className="aspect-[4/3] animate-pulse bg-secondary" /><CardContent className="space-y-3 p-4"><div className="h-4 w-3/4 animate-pulse rounded bg-secondary" /><div className="h-4 w-1/2 animate-pulse rounded bg-secondary" /></CardContent></Card>)}</div>
        ) : failed ? <ErrorNote message={failed} onRetry={() => setReloadKey((key) => key + 1)} /> : visibleItems.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><ShoppingBag className="mx-auto size-10 text-muted-foreground" /><p className="mt-3 font-medium">{items.length ? "Produk tidak ditemukan" : "Belum ada produk atau jasa yang dijual"}</p><p className="mt-1 text-sm text-muted-foreground">{items.length ? "Coba kata kunci atau filter lainnya." : "Jadilah yang pertama membuka etalase di komunitas."}</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((item) => (
              <Link key={item.id} to={`/marketplace/${item.id}`} className="group min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <Card className="flex h-full flex-col gap-0 overflow-hidden rounded-2xl border-border/80 bg-card py-0 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/70">
                    {item.photos?.[0] ? <><img src={item.photos[0]} alt={item.title} className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextElementSibling?.classList.remove("hidden"); }} /><div className="absolute inset-0 hidden flex-col items-center justify-center gap-2 text-muted-foreground"><ShoppingBag className="size-8 opacity-40" /><span className="text-xs">Foto belum tersedia</span></div></> : <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground"><ShoppingBag className="size-8 opacity-40" /><span className="text-xs">Foto belum tersedia</span></div>}
                    <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-semibold text-primary shadow-sm backdrop-blur sm:text-xs">{LISTING_KIND_LABEL[item.kind] ?? item.kind}</span>
                  </div>
                  <CardContent className="flex flex-1 flex-col p-3 sm:p-4">
                    <span className="line-clamp-1 text-[10px] text-muted-foreground sm:text-xs">{item.category}</span>
                    <h3 className="mt-2 line-clamp-2 min-h-10 font-display text-sm font-semibold leading-snug sm:text-base">{item.title}</h3>
                    {item.description && <p className="mt-1 hidden line-clamp-2 text-sm text-muted-foreground sm:block">{item.description}</p>}
                    <p className="mt-2 font-display text-base font-bold text-primary sm:mt-3 sm:text-xl">{formatRupiah(item.price)}</p>
                    {item.coinPrice ? <p className="mt-1 text-xs font-semibold text-amber-700 sm:text-sm">{item.coinPrice.toLocaleString("id-ID")} koin</p> : null}
                  </CardContent>
                  <div className="flex items-center gap-2 border-t border-border/70 bg-secondary/25 px-3 py-3 sm:px-4">
                    <MemberAvatar name={item.sellerName} photoData={item.sellerPhoto} size={28} />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium sm:text-sm">{item.sellerName}</p>{item.sellerCity && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" />{item.sellerCity}</p>}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center gap-3"><Briefcase className="size-6 text-blue-600" aria-hidden /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-blue-900">Cari kerja remote atau part-time?</p><p className="text-xs text-blue-700">Kunjungi Job Board di Learning Center untuk lowongan yang ramah ibu tunggal.</p></div><Button asChild size="sm" variant="outline"><Link to="/learning-center">Buka Learning Center</Link></Button></div>
        </div>
      </div>
    </>
  );
}
