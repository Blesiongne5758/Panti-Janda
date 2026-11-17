import { ImageOff, ShoppingBag } from "lucide-react";

type MarketplacePhotoFallbackProps = {
  kindLabel: string;
  category: string;
  className?: string;
};

export function MarketplacePhotoFallback({ kindLabel, category, className = "" }: MarketplacePhotoFallbackProps) {
  return (
    <div
      role="img"
      aria-label={`Foto ${kindLabel.toLocaleLowerCase("id-ID")} belum tersedia; kategori ${category || "produk komunitas"}`}
      className={`relative flex items-center overflow-hidden bg-gradient-to-br from-primary/10 via-secondary/60 to-muted/80 px-4 py-4 text-foreground sm:px-6 sm:py-5 ${className}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full border border-primary/10 sm:size-48" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 right-10 size-36 rounded-full border border-primary/10 sm:size-48" />
      <div className="relative z-10 min-w-0 flex-1">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur sm:text-[10px]">
          <ImageOff className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">Foto belum ditambahkan</span>
        </span>
        <p className="mt-3 line-clamp-2 font-display text-sm font-semibold leading-snug sm:mt-4 sm:text-base">
          {category || "Produk komunitas"}
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
          Etalase {kindLabel.toLocaleLowerCase("id-ID")} komunitas
        </p>
      </div>
      <div aria-hidden="true" className="relative z-10 ml-3 flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/70 text-primary shadow-sm sm:ml-5 sm:size-14">
        <ShoppingBag className="size-5 sm:size-6" />
      </div>
    </div>
  );
}
