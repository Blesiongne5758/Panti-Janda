import { useEffect, useState } from "react";
import { Briefcase, Calendar, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { formatRupiah, timeAgo } from "@/lib/format";
import { BUSINESS_STATUS_LABEL, BUSINESS_TYPE_OPTIONS } from "@/lib/constants";
import type { BusinessItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MemberAvatar, PageBanner } from "@/components/common";

export default function BusinessesPage() {
  const { account, profile } = useAuth();
  const [items, setItems] = useState<BusinessItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ items: BusinessItem[] }>("businesses.list");
        setItems(data.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <PageBanner>
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Briefcase className="size-6 text-primary" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Proposal Usaha</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Dukung usaha anggota janda dengan melihat proposal dan rencana anggaran mereka.
            </p>
          </div>
        </div>
      </PageBanner>

      {profile && (
        <div className="flex justify-end">
          <Button asChild>
            <Link to="/bisnis/baru">
              <Plus className="size-4" />
              Buat proposal
            </Link>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Briefcase className="size-12 text-muted-foreground" />
            <div>
              <p className="font-medium">Belum ada proposal usaha</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Proposal yang disetujui akan tampil di sini.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <MemberAvatar
                      name={item.creatorName}
                      tier="wonder_woman"
                      size={48}
                      photoData={item.creatorPhoto}
                    />
                    <div>
                      <p className="font-medium">{item.creatorName}</p>
                      <p className="text-xs text-muted-foreground">{item.businessType}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {BUSINESS_STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>

                <div>
                  <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                  )}
                </div>

                <div className="mt-auto space-y-2 border-t border-border pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Modal dibutuhkan</span>
                    <span className="font-display text-lg font-semibold text-primary">
                      {formatRupiah(item.capitalNeeded)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {timeAgo(item.createdAt)}
                    </span>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/bisnis/${item.id}`}>Lihat detail</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
