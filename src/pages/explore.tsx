import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Search, SlidersHorizontal } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { ROLE_RANK, TIER_META, WIDOW_ROLES } from "@/lib/constants";
import type { ListResult, Profile, WidowRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorNote, LoadingGrid, PageBanner, SectionHeading, TierBadge } from "@/components/common";
import { ProfileCard } from "@/components/cards";
import { cn } from "@/lib/utils";

const PER_PAGE = 12;

export function ExplorePage() {
  const { account } = useAuth();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const canFilterTier = rank >= 2;

  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [tier, setTier] = useState<WidowRole | "">("");
  const [items, setItems] = useState<Profile[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(
    async (pageNo: number, replace: boolean, q: string, tierFilter: WidowRole | "") => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setFailed(null);
      try {
        const data = await api<ListResult<Profile>>("profiles.list", {
          page: pageNo,
          perPage: PER_PAGE,
          q: q || undefined,
          tier: tierFilter || undefined,
        });
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
        setHasMore(Boolean(data.hasMore));
        setPage(pageNo);
      } catch (error) {
        setFailed(errorText(error));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(1, true, applied, tier);
  }, [load, applied, tier]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setApplied(query.trim());
  };

  return (
    <div className="mx-auto w-full max-w-6xl animate-rise px-4 py-10 sm:px-6">
      <PageBanner>
        <SectionHeading
          eyebrow="Jelajah anggota"
          title="Kenali para anggota komunitas"
          description={
            canFilterTier
              ? "Telusuri seluruh tingkatan anggota. Gunakan pencarian untuk menemukan keahlian, kota, atau target tertentu."
              : "Profil publik menampilkan anggota Wonder Woman terverifikasi — dengan nama panggilan, keahlian, dan target kebutuhan mereka."
          }
        />
      </PageBanner>

      <form onSubmit={submitSearch} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Label htmlFor="explore-search" className="sr-only">
            Cari anggota
          </Label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="explore-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama panggilan, kota, keahlian, atau target…"
            className="h-11 pl-10"
          />
        </div>
        <Button type="submit" size="lg" className="sm:w-auto">
          Cari
        </Button>
      </form>

      {canFilterTier ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Tingkatan:
          </span>
          <button
            type="button"
            onClick={() => setTier("")}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              tier === "" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary",
            )}
          >
            Semua
          </button>
          {WIDOW_ROLES.map((option) => (
            <button key={option} type="button" onClick={() => setTier(option)} className="transition-transform">
              <TierBadge
                tier={option}
                size="md"
                className={cn(
                  "cursor-pointer",
                  tier === option ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-75 hover:opacity-100",
                )}
              />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Hanya profil <TierBadge tier="wonder_woman" size="sm" className="mx-1 align-middle" /> yang dapat dilihat
          publik. Tingkatan Sosialita dan High Society hanya untuk anggota terverifikasi.
        </p>
      )}

      <div className="mt-8">
        {loading ? (
          <LoadingGrid count={6} />
        ) : failed ? (
          <ErrorNote message={failed} onRetry={() => void load(1, true, applied, tier)} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Tidak ada profil yang cocok"
            description={
              applied
                ? `Tidak ditemukan anggota untuk pencarian “${applied}”. Coba kata kunci lain.`
                : "Belum ada profil terverifikasi yang tampil di sini."
            }
            action={
              applied ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setApplied("");
                  }}
                >
                  Hapus pencarian
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
            {hasMore ? (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={loadingMore}
                  onClick={() => void load(page + 1, false, applied, tier)}
                >
                  {loadingMore ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
                  Muat lebih banyak
                </Button>
              </div>
            ) : (
              <p className="mt-8 text-center text-xs text-muted-foreground">
                {items.length} profil ditampilkan
                {tier ? ` · tingkatan ${TIER_META[tier].label}` : ""}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
