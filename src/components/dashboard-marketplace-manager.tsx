import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Eye, Loader2, PackagePlus, Pencil, RefreshCw, Store, Trash2 } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { publishNotificationRefresh } from "@/lib/notification-events";
import { Link } from "@/lib/router";
import { LISTING_KIND_LABEL, LISTING_STATUS_LABEL } from "@/lib/constants";
import type { ListingStatus, MarketplaceListing } from "@/lib/types";
import { MarketplacePhotoFallback } from "@/components/marketplace-photo-fallback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ListingFilter = "all" | ListingStatus;

function marketPrice(amount: number | null) {
  return amount === null ? "Hubungi penjual" : `Rp${amount.toLocaleString("id-ID")}`;
}

function ListingEditor({
  listing,
  onSaved,
}: {
  listing: MarketplaceListing;
  onSaved: (listing: MarketplaceListing) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description ?? "");
  const [price, setPrice] = useState(listing.price === null ? "" : String(listing.price));
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(listing.title);
    setDescription(listing.description ?? "");
    setPrice(listing.price === null ? "" : String(listing.price));
    setFormError("");
  }, [open, listing]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (title.trim().length < 3) {
      setFormError("Judul produk minimal 3 karakter.");
      return;
    }
    const parsedPrice = price.trim() === "" ? null : Number(price);
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setFormError("Harga Rupiah tidak valid.");
      return;
    }

    setBusy(true);
    try {
      const result = await api<{ listing: MarketplaceListing; notificationCreated?: boolean | null }>("marketplace.update", {
        id: listing.id,
        title: title.trim(),
        description: description.trim() || null,
        price: parsedPrice,
      });
      onSaved(result.listing);
      if (result.notificationCreated) publishNotificationRefresh();
      setOpen(false);
      if (result.notificationCreated === false) toast.warning("Perubahan tersimpan, tetapi notifikasi belum berhasil dibuat.");
      else toast.success("Detail produk diperbarui.");
    } catch (error) {
      setFormError(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-9">
          <Pencil className="size-4" aria-hidden="true" />
          Edit detail
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Edit produk atau jasa</DialogTitle>
          <DialogDescription>Perubahan hanya berlaku pada listing milik akun Anda.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          {formError ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p> : null}
          <div className="space-y-2">
            <Label htmlFor={`listing-title-${listing.id}`}>Judul</Label>
            <Input id={`listing-title-${listing.id}`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
            <p className="text-xs text-muted-foreground">{title.length}/120 karakter</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`listing-description-${listing.id}`}>Deskripsi</Label>
            <Textarea id={`listing-description-${listing.id}`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} />
            <p className="text-xs text-muted-foreground">{description.length}/2000 karakter</p>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor={`listing-price-${listing.id}`}>Harga (Rp)</Label>
              <Input id={`listing-price-${listing.id}`} type="number" inputMode="numeric" min={0} step={1} value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Kosongkan jika hubungi penjual" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Simpan perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardMarketplaceManager({ canCreate }: { canCreate: boolean }) {
  const [items, setItems] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<ListingFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setFailed("");
      try {
        const result = await api<{ items: MarketplaceListing[] }>("marketplace.mine");
        if (active) setItems(result.items);
      } catch (error) {
        if (active) setFailed(errorText(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [reloadKey]);

  const counts = useMemo(() => ({
    active: items.filter((item) => item.status === "active").length,
    archived: items.filter((item) => item.status === "archived").length,
    sold: items.filter((item) => item.status === "sold").length,
  }), [items]);
  const visibleItems = filter === "all" ? items : items.filter((item) => item.status === filter);
  const filters: Array<{ value: ListingFilter; label: string; count: number }> = [
    { value: "all", label: "Semua", count: items.length },
    { value: "active", label: "Aktif", count: counts.active },
    { value: "archived", label: "Diarsipkan", count: counts.archived },
    { value: "sold", label: "Terjual", count: counts.sold },
  ];

  const changeStatus = async (listing: MarketplaceListing) => {
    if (listing.status === "sold" || updatingId) return;
    const nextStatus: ListingStatus = listing.status === "active" ? "archived" : "active";
    setUpdatingId(listing.id);
    try {
      const result = await api<{ listing: MarketplaceListing; notificationCreated?: boolean | null }>("marketplace.update", {
        id: listing.id,
        status: nextStatus,
      });
      setItems((current) => current.map((item) => item.id === listing.id ? result.listing : item));
      if (result.notificationCreated) publishNotificationRefresh();
      if (result.notificationCreated === false) toast.warning("Produk diarsipkan, tetapi notifikasi belum berhasil dibuat.");
      else toast.success(nextStatus === "active" ? "Produk diaktifkan kembali." : "Produk diarsipkan.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteListing = async (listing: MarketplaceListing) => {
    if (updatingId || !window.confirm("Hapus produk ini? Produk akan dihapus dari Marketplace dan tidak dapat dikembalikan.")) return;
    setUpdatingId(listing.id);
    try {
      await api("marketplace.delete", { id: listing.id });
      setItems((current) => current.filter((item) => item.id !== listing.id));
      toast.success("Produk dihapus dari etalase.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Store className="size-5 text-primary" aria-hidden="true" />
            Etalase Saya
          </h2>
          <CardDescription>{canCreate ? "Kelola produk, foto, stok, dan status jualan Anda." : "Kelola listing yang sudah ada. Verifikasi profil diperlukan untuk menambahkan produk baru."}</CardDescription>
        </div>
        {canCreate ? <Button asChild className="min-h-10 shrink-0">
          <Link to="/marketplace/baru?from=dashboard"><PackagePlus className="size-4" aria-hidden="true" />Produk baru</Link>
        </Button> : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Ringkasan etalase">
          <div className="rounded-xl bg-secondary/55 p-3"><p className="font-display text-xl font-semibold text-primary">{counts.active}</p><p className="text-xs text-muted-foreground">Aktif</p></div>
          <div className="rounded-xl bg-secondary/55 p-3"><p className="font-display text-xl font-semibold text-primary">{counts.archived}</p><p className="text-xs text-muted-foreground">Diarsipkan</p></div>
          <div className="rounded-xl bg-secondary/55 p-3"><p className="font-display text-xl font-semibold text-primary">{counts.sold}</p><p className="text-xs text-muted-foreground">Terjual</p></div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter status listing">
          {filters.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? "default" : "outline"}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className="min-h-9"
            >
              {option.label}<span className="ml-1 opacity-75">{option.count}</span>
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-label="Memuat listing">
            {[0, 1].map((key) => <div key={key} className="overflow-hidden rounded-2xl border border-border"><div className="aspect-[4/3] animate-pulse bg-secondary" /><div className="space-y-3 p-4"><div className="h-4 w-3/4 animate-pulse rounded bg-secondary" /><div className="h-4 w-1/2 animate-pulse rounded bg-secondary" /></div></div>)}
          </div>
        ) : failed ? (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">Etalase gagal dimuat: {failed}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw className="size-4" aria-hidden="true" />Coba lagi</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-9 text-center">
            <Store className="mx-auto size-8 text-primary" aria-hidden="true" />
            <p className="mt-3 font-display text-lg font-semibold">Etalase Anda masih kosong</p>
            <p className="mt-1 text-sm text-muted-foreground">{canCreate ? "Tambahkan produk atau jasa pertama untuk mulai dikenal komunitas." : "Verifikasi profil diperlukan sebelum Anda dapat menambahkan produk atau jasa."}</p>
            {canCreate ? <Button asChild size="sm" className="mt-4"><Link to="/marketplace/baru?from=dashboard"><PackagePlus className="size-4" aria-hidden="true" />Tambah listing</Link></Button> : null}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-xl bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada produk berstatus {filters.find((option) => option.value === filter)?.label.toLocaleLowerCase("id-ID")}.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visibleItems.map((listing) => (
              <article key={listing.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-secondary/50">
                  {listing.photos[0] ? (
                    <>
                      <img
                        src={listing.photos[0]}
                        alt={listing.title}
                        className="size-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextElementSibling?.classList.remove("hidden"); }}
                      />
                      <MarketplacePhotoFallback kindLabel={LISTING_KIND_LABEL[listing.kind] ?? listing.kind} category={listing.category} className="absolute inset-0 hidden" />
                    </>
                  ) : (
                    <MarketplacePhotoFallback kindLabel={LISTING_KIND_LABEL[listing.kind] ?? listing.kind} category={listing.category} className="size-full" />
                  )}
                  <span className="absolute left-3 top-3 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-xs font-semibold text-primary shadow-sm">
                    {LISTING_STATUS_LABEL[listing.status] ?? listing.status}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <p className="text-xs font-medium text-muted-foreground">{listing.category} · {LISTING_KIND_LABEL[listing.kind] ?? listing.kind}</p>
                  <h3 className="mt-1 line-clamp-2 font-display text-base font-semibold leading-snug">{listing.title}</h3>
                  {listing.description ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{listing.description}</p> : null}
                  <p className="mt-3 font-display text-lg font-semibold text-primary">{marketPrice(listing.price)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Stok tersedia: {listing.stock}</p>
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-border/70 pt-3">
                    <Button asChild type="button" variant="ghost" size="sm" className="min-h-9">
                      <Link to={`/marketplace/${listing.id}`}><Eye className="size-4" aria-hidden="true" />Lihat</Link>
                    </Button>
                    {listing.status !== "sold" ? <ListingEditor key={`${listing.id}-${listing.updatedAt}`} listing={listing} onSaved={(updated) => setItems((current) => current.map((item) => item.id === updated.id ? updated : item))} /> : <span className="inline-flex min-h-9 items-center px-2 text-xs text-muted-foreground">Listing terjual</span>}
                    <Button asChild type="button" variant="outline" size="sm" className="min-h-9"><Link to={`/marketplace/${listing.id}/edit?from=dashboard`} aria-label={`Edit lengkap ${listing.title}`}><Pencil className="size-4" aria-hidden="true" />Edit lengkap</Link></Button>
                    {listing.status !== "sold" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-9"
                        disabled={updatingId === listing.id || updatingId !== null}
                        aria-label={`${listing.status === "active" ? "Arsipkan" : "Aktifkan kembali"} ${listing.title}`}
                        onClick={() => void changeStatus(listing)}
                      >
                        {updatingId === listing.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : listing.status === "active" ? <Archive className="size-4" aria-hidden="true" /> : <ArchiveRestore className="size-4" aria-hidden="true" />}
                        {listing.status === "active" ? "Arsipkan" : "Aktifkan"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="min-h-9"
                      disabled={updatingId !== null}
                      aria-label={`Hapus ${listing.title}`}
                      onClick={() => void deleteListing(listing)}
                    >
                      {updatingId === listing.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                      Hapus
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">Listing aktif tampil di marketplace. Arsip dapat diaktifkan kembali; listing terjual dapat diedit atau dihapus dari dasbor. Pengelolaan dibatasi pada listing milik akun Anda.</p>
      </CardContent>
    </Card>
  );
}
