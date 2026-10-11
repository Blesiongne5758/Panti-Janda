import { useState, useRef } from "react";
import { ArrowLeft, Loader2, ImagePlus, X } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useRoute, Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageBanner } from "@/components/common";
import { LISTING_CATEGORIES } from "@/lib/constants";

export default function MarketplaceFormPage() {
  const { navigate } = useRoute();
  const [kind, setKind] = useState("barang");
  const [category, setCategory] = useState(LISTING_CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
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
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        newPhotos.push(dataUrl);
      }
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, 5));
    } catch (err) {
      setError("Gagal mengunggah foto.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (title.trim().length < 3) {
      setError("Judul minimal 3 karakter.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ listing: { id: string } }>("marketplace.create", {
        kind,
        category,
        title: title.trim(),
        description: description.trim() || null,
        price: price.trim() ? Number(price.trim()) : null,
        photos,
      });
      if (res?.listing?.id) {
        navigate(`/marketplace/${res.listing.id}`);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
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
        <h1 className="font-display text-3xl font-bold">Jual Produk atau Jasa</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Tawarkan produk atau keahlian Anda kepada komunitas Panti Janda.
        </p>
      </PageBanner>

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Detail Produk/Jasa</CardTitle>
            <CardDescription>Isi informasi tentang produk atau jasa yang ingin Anda jual.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label>Jenis</Label>
                <div className="flex gap-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="kind"
                      value="barang"
                      checked={kind === "barang"}
                      onChange={() => setKind("barang")}
                      className="accent-primary"
                    />
                    <span className="text-sm">Barang</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="kind"
                      value="jasa"
                      checked={kind === "jasa"}
                      onChange={() => setKind("jasa")}
                      className="accent-primary"
                    />
                    <span className="text-sm">Jasa</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mk-category">Kategori</Label>
                <select
                  id="mk-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {LISTING_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mk-title">Judul</Label>
                <Input
                  id="mk-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="Contoh: Kue Kering Nastar Premium"
                  required
                />
                <p className="text-xs text-muted-foreground">{title.length}/120 karakter</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mk-desc">Deskripsi</Label>
                <Textarea
                  id="mk-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Jelaskan produk/jasa Anda, keunggulan, dan cara pemesanan..."
                />
                <p className="text-xs text-muted-foreground">{description.length}/2000 karakter</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mk-price">Harga (Rp)</Label>
                <Input
                  id="mk-price"
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Kosongkan jika ingin pembeli menghubungi"
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">
                  Kosongkan jika ingin pembeli menghubungi Anda untuk harga.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Foto Produk (Maksimal 5)</Label>
                <div className="flex flex-wrap gap-3">
                  {photos.map((photo, index) => (
                    <div key={index} className="group relative size-24 overflow-hidden rounded-lg border border-border">
                      <img src={photo} alt={`Foto ${index + 1}`} className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {photos.length < 5 && (
                    <label className="flex size-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary/50 hover:bg-muted/50">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                      />
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        {uploading ? (
                          <Loader2 className="size-6 animate-spin" />
                        ) : (
                          <ImagePlus className="size-6" />
                        )}
                        <span className="text-[10px]">Upload</span>
                      </div>
                    </label>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tambahkan foto produk/jasa Anda. Format: JPG, PNG, atau WebP. Maksimal 5 MB per file.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Publikasikan
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/marketplace")}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
