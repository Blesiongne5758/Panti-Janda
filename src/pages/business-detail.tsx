import { useEffect, useState } from "react";
import { ArrowLeft, Briefcase, Calendar, FileText } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { Link, useRoute } from "@/lib/router";
import { formatRupiah, timeAgo } from "@/lib/format";
import { BUSINESS_STATUS_LABEL } from "@/lib/constants";
import type { BusinessDetail as BusinessDetailType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberAvatar, PageBanner } from "@/components/common";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function BusinessDetailPage({ id }: { id: string }) {
  const [business, setBusiness] = useState<BusinessDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await api<{ business: BusinessDetailType }>("businesses.get", { id });
        setBusiness(data.business);
      } catch (err) {
        setError(errorText(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <PageBanner>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <Briefcase className="size-6 text-primary" aria-hidden />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Proposal tidak ditemukan</h1>
              {error && <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>}
            </div>
          </div>
        </PageBanner>
        <Button asChild variant="outline">
          <Link to="/bisnis">
            <ArrowLeft className="size-4" />
            Kembali
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/bisnis">
          <ArrowLeft className="size-4" />
          Kembali ke daftar proposal
        </Link>
      </Button>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <MemberAvatar
                name={business.creatorName}
                tier="wonder_woman"
                size={64}
                photoData={business.creatorPhoto}
              />
              <div>
                <p className="text-sm text-muted-foreground">{business.creatorName}</p>
                <CardTitle className="font-display text-2xl">{business.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{business.businessType}</p>
              </div>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {BUSINESS_STATUS_LABEL[business.status] ?? business.status}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 font-semibold">Deskripsi</h3>
            <p className="text-sm text-muted-foreground">
              {business.description ?? "Tidak ada deskripsi."}
            </p>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 font-semibold">Modal Dibutuhkan</h3>
            <p className="font-display text-3xl font-bold text-primary">
              {formatRupiah(business.capitalNeeded)}
            </p>
          </div>

          {business.proposal && (
            <>
              <Separator />
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-semibold">
                  <FileText className="size-4" />
                  Proposal
                </h3>
                <div className="rounded-lg bg-secondary/40 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{business.proposal}</p>
                </div>
              </div>
            </>
          )}

          {business.rabItems.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="mb-3 font-semibold">Rencana Anggaran Biaya (RAB)</h3>
                <div className="overflow-x-auto">
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/60">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Uraian</th>
                        <th className="px-4 py-2 text-right font-medium">Qty</th>
                        <th className="px-4 py-2 text-left font-medium">Unit</th>
                        <th className="px-4 py-2 text-right font-medium">Harga Satuan</th>
                        <th className="px-4 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {business.rabItems.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-4 py-2">{item.description}</td>
                          <td className="px-4 py-2 text-right">{item.quantity}</td>
                          <td className="px-4 py-2">{item.unit}</td>
                          <td className="px-4 py-2 text-right">{formatRupiah(item.unitPrice)}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatRupiah(item.total)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border bg-secondary/40">
                        <td colSpan={4} className="px-4 py-2 text-right font-semibold">
                          Total Keseluruhan
                        </td>
                        <td className="px-4 py-2 text-right font-display text-lg font-bold text-primary">
                          {formatRupiah(business.rabTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              Dibuat {timeAgo(business.createdAt)}
            </span>
            <span>Diperbarui {timeAgo(business.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
