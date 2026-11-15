import { Component, type ReactNode } from "react";
import { Home, RefreshCw } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("Gagal memuat halaman", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-center justify-center gap-5 px-4 py-14 text-center">
          <div role="alert" aria-live="assertive" className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Halaman terganggu</p>
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Halaman ini tidak dapat dimuat
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Muat ulang halaman atau kembali ke beranda. Jika masalah berlanjut, coba lagi beberapa saat.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" aria-hidden />
              Muat ulang
            </Button>
            <Button asChild variant="outline">
              <Link to="/">
                <Home className="size-4" aria-hidden />
                Beranda
              </Link>
            </Button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
