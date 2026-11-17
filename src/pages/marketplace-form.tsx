import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, ImagePlus, X, Package } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useRoute } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageBanner } from "@/components/common";
import { LISTING_CATEGORIES } from "@/lib/constants";
import type { MarketplaceListing } from "@/lib/types";
import { usePresignedUpload } from "@/hooks/use-presigned-upload";

export default function MarketplaceFormPage() {
  const { navigate, path } = useRoute();
  const pathParts = path.split("?")[0].split("/").filter(Boolean);
  const editId = pathParts[1] && pathParts[1] !== "baru" && pathParts[2] === "edit" ? pathParts[1] : "";
  const isEdit = Boolean(editId);
  const [kind, setKind] = useState("barang");
  const [category, setCategory] = useState(LISTING_CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [photos, setPhotos] = useState<string[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploading: hookUploading, uploadFile, error: uploadHookError } = usePresignedUpload();
  const uploading = hookUploading;

  useEffect(() => {
    if (!editId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await api<{ listing: MarketplaceListing }>("marketplace.get", { id: editId });
        if (!active || !res?.listing) return;
        const listing = res.listing;
        setKind(listing.kind);
        setCategory(listing.category);
        setTitle(listing.title);
        setDescription(listing.description ?? "");
        setPrice(listing.price === null ? "" : String(listing.price));
        setStock(String(listing.stock ?? 1));
        setPhotos(listing.photos ?? []);
      } catch (err) {
        if (active) setError(errorText(err));
      } finally {
        if (active) setLoadingEdit(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [editId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError("");
    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) {
          setError("Hanya file gambar yang diperbolehkan.");
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          setError("Ukuran file maksimal 5 MB.");
          continue;
        }
        const result = await uploadFile(file, "public");
        if (result) newPhotos.push(result.publicUrl || result.key);
      }
      if (uploadHookError) setError(uploadHookError);
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, 5));
    } catch {
      setError("Gagal mengunggah foto.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (title.trim().length < 3) {
      setError("Judul minimal 3 karakter.");
      return;
    }
    const numericStock = Number(stock);
    if (!Number.isInteger(numericStock) || numericStock < 0) {
      setError("Stok harus berupa bilangan bulat 0 atau lebih.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        kind,
        category,
        title: title.trim(),
        description: description.trim() || null,
        price: price.trim() ? Number(price.trim()) : null,
        stock: numericStock,
        photos,
      };
      const res = isEdit
        ? await api<{ listing: { id: string } }>("marketplace.update", { ...payload, id: editId, status: "active" })
        : await api<{ listing: { id: string } }>("marketplace.create", payload);
      if (res?.listing?.id) navigate(`/marketplace/${res.listing.id}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEdit) {
    return <div className="mx-auto flex min-h-[40vh] max-w-2xl items-center justify-center"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <PageBanner art="/images/banner-event.svg">
        <button onClick={() => navigate(isEdit ? `/marketplace/${editId}` : "/marketplace")} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Kembali ke Marketplace
        </button>
        <h1 className="font-display text-3xl font-bold">{isEdit ? "Edit Produk atau Jasa" : "Jual Produk atau Jasa"}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {isEdit ? "Perbarui informasi produk, harga, dan stok yang Anda jual." : "Tawarkan produk atau keahlian Anda kepada komunitas Panti Janda."}
        </p>
      </PageBanner>
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? "Perbarui Detail Produk/Jasa" : "Detail Produk/Jasa"}</CardTitle>
            <CardDescription>Isi informasi yang akan dilihat oleh calon pembeli.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              <div className="space-y-2">
                <Label>Jenis</Label>
                <div className="flex gap-3">
                  {[["barang", "Barang"], ["jasa", "Jasa"]].map(([value, label]) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2">
                      <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="accent-primary" />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mk-category">Kategori</Label>
                <select id="mk-category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {LISTING_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mk-title">Judul</Label>
                <Input id="mk-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Contoh: Kue Kering Nastar Premium" required />
                <p className="text-xs text-muted-foreground">{title.length}/120 karakter</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mk-desc">Deskripsi</Label>
                <Textarea id="mk-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={4} placeholder="Jelaskan produk/jasa Anda, keunggulan, dan cara pemesanan..." />
                <p className="text-xs text-muted-foreground">{description.length}/2000 karakter</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mk-price">Harga (Rp)</Label>
                  <Input id="mk-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Hubungi penjual" inputMode="numeric" />
                  <p className="text-xs text-muted-foreground">Kosongkan jika harga melalui kesepakatan.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mk-stock">Jumlah stok</Label>
                  <div className="relative">
                    <Package className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="mk-stock" type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} className="pl-9" inputMode="numeric" required />
                  </div>
                  <p className="text-xs text-muted-foreground">Masukkan 0 jika produk sedang habis.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Foto Produk (Maksimal 5)</Label>
                <div className="flex flex-wrap gap-3">
                  {photos.map((photo, index) => (
                    <div key={index} className="group relative size-24 overflow-hidden rounded-lg border border-border">
                      <img src={photo} alt={`Foto ${index + 1}`} className="size-full object-cover" />
                      <button type="button" onClick={() => removePhoto(index)} className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {photos.length < 5 && (
                    <label className="flex size-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary/50 hover:bg-muted/50">
                      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" disabled={uploading} />
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
                        <span className="text-[10px]">Upload</span>
                      </div>
                    </label>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Format JPG, PNG, atau WebP. Maksimal 5 MB per file.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting || uploading}>
                  {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {isEdit ? "Simpan Perubahan" : "Publikasikan"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(isEdit ? `/marketplace/${editId}` : "/marketplace")}>Batal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
