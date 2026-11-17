import { useEffect, useMemo, useState } from "react";
import { Package, Pencil, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import type { MarketplaceListing } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatRupiah(amount: number | null) {
  if (amount === null) return "Hubungi penjual";
  return `Rp${amount.toLocaleString("id-ID")}`;
}

export function MarketplaceManagement() {
  const { account } = useAuth();
  const [items, setItems] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockFilter, setStockFilter] = useState("all");
  const [productQuery, setProductQuery] = useState("");

  useEffect(() => {
    let active = true;
    api<{ items: MarketplaceListing[] }>("marketplace.mine")
      .then((result) => { if (active) setItems(result.items); })
      .catch(() => { if (active) setItems([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [account]);

  const filteredItems = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase("id-ID");
    return items.filter((item) => {
      const matchesQuery = !query || `${item.title} ${item.category}`.toLocaleLowerCase("id-ID").includes(query);
      const matchesStock = stockFilter === "all"
        || (stockFilter === "available" && item.stock > 5)
        || (stockFilter === "low" && item.stock > 0 && item.stock <= 5)
        || (stockFilter === "out" && item.stock === 0);
      return matchesQuery && matchesStock;
    });
  }, [items, productQuery, stockFilter]);

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Manajemen Produk Saya</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cari dan pantau ketersediaan stok produk Anda.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{items.length} produk</span>
            <Button asChild size="sm"><Link to="/marketplace/baru">Jual Produk/Jasa</Link></Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Cari nama atau kategori produk..."
              aria-label="Cari produk saya"
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value)}
            aria-label="Filter status stok"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">Semua status stok</option>
            <option value="available">Tersedia (&gt;5)</option>
            <option value="low">Menipis (1–5)</option>
            <option value="out">Habis (0)</option>
          </select>
        </div>
        {loading ? (
          <div className="mt-4 h-16 animate-pulse rounded-lg bg-secondary" />
        ) : filteredItems.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {items.length === 0 ? "Belum ada produk yang Anda jual." : "Tidak ada produk yang cocok dengan pencarian atau filter."}
          </p>
        ) : (
          <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
            {filteredItems.map((item) => {
              const stockLabel = item.stock === 0 ? "Habis" : item.stock <= 5 ? "Menipis" : "Tersedia";
              const stockTone = item.stock === 0 ? "text-destructive bg-destructive/10" : item.stock <= 5 ? "text-amber-700 bg-amber-100" : "text-emerald-700 bg-emerald-100";
              return (
                <div key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
                  {item.photos?.[0] ? <img src={item.photos[0]} alt="" loading="lazy" decoding="async" className="size-12 shrink-0 rounded-md object-cover" /> : <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary"><Package className="size-5 text-muted-foreground" aria-hidden /></div>}
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
  );
}
