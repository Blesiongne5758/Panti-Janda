import { Compass, Home, Search } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-24 text-center sm:px-6">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        <Compass className="size-6" aria-hidden />
      </span>
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">404</p>
        <h1 className="font-display text-3xl font-semibold text-foreground">Halaman tidak ditemukan</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Tautan yang Anda buka mungkin sudah dipindahkan atau tidak pernah ada. Kembali ke beranda atau telusuri
          profil anggota yang sedang mencari dukungan.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/">
            <Home className="size-4" aria-hidden />
            Beranda
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/jelajah">
            <Search className="size-4" aria-hidden />
            Jelajah anggota
          </Link>
        </Button>
      </div>
    </div>
  );
}
