import { useState, useEffect } from "react";
import { Heart, Calendar, Users, TrendingUp } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { ROLE_RANK } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { MemberAvatar, PageBanner } from "@/components/common";
import { SEO } from "@/components/seo";
import type { Campaign, CampaignDetail } from "@/lib/types";
import { PaymentQris } from "@/components/payment-qris";
import { toast } from "sonner";

export function CampaignsPage() {
  const { account, profile } = useAuth();
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CampaignDetail | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api<{ items: Campaign[] }>("campaigns.list");
        if (active && res) setItems(res.items);
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const openCampaign = async (id: string) => {
    const res = await api<CampaignDetail>("campaigns.get", { id });
    if (res) setSelected(res);
  };

  const rank = account ? ROLE_RANK[account.role] ?? 0 : 0;
  const canCreate = rank >= 2;

  return (
    <>
      <SEO
        title="Galang Dana & Solidaritas Komunitas — Panti Janda"
        description="Dukung program sosial, bantuan darurat, dan kemandirian anggota komunitas Panti Janda secara transparan dan amanah."
      />
      <PageBanner art="/images/banner-event.svg" className="mb-8">
        <h1 className="font-display text-3xl font-bold">Galang Dana</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Dukung perjuangan anggota Panti Janda melalui kampanye donasi langsung.
        </p>
      </PageBanner>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Kampanye Aktif</h2>
          {canCreate && (
            <Button asChild size="sm">
              <Link to="/galang-dana/buat">Buat Kampanye</Link>
            </Button>
          )}
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
            <Heart className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground">Belum ada kampanye aktif.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void openCampaign(c.id)}
                className="group gradient-card hover-lift flex h-full flex-col rounded-2xl border border-border bg-card p-5 text-left"
              >
                <div className="mb-3 flex items-center gap-3">
                  <MemberAvatar
                    name={c.creatorName}
                    tier={null}
                    photoData={c.creatorPhoto}
                    size={40}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.creatorName}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.donorCount} donatur
                    </p>
                  </div>
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold line-clamp-2 group-hover:text-primary">
                  {c.title}
                </h3>
                <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                  {c.description}
                </p>
                <div className="mt-auto">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-primary">
                      Rp{c.collectedAmount.toLocaleString("id-ID")}
                    </span>
                    <span className="text-muted-foreground">
                      dari Rp{c.targetAmount.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-2 transition-all"
                      style={{ width: `${Math.min(100, (c.collectedAmount / c.targetAmount) * 100)}%` }}
                    />
                  </div>
                  {c.deadline && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" aria-hidden />
                      <span>
                        Berakhir {new Date(c.deadline).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <CampaignDetailDialog
          campaign={selected}
          onClose={() => setSelected(null)}
          onDonated={() => {
            void openCampaign(selected.id);
          }}
        />
      )}
    </>
  );
}

function CampaignDetailDialog({
  campaign,
  onClose,
  onDonated,
}: {
  campaign: CampaignDetail;
  onClose: () => void;
  onDonated: () => void;
}) {
  const { account } = useAuth();
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [donationMethod, setDonationMethod] = useState<"idr" | "coins">("idr");
  const [coinAmount, setCoinAmount] = useState("");
  const [coinConversionRate, setCoinConversionRate] = useState(100);

  useEffect(() => {
    let active = true;
    api<{ coinSettings: { conversionRate: number } }>("coinSettings.settings")
      .then((res) => { if (active) setCoinConversionRate(res.coinSettings.conversionRate); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const donate = async () => {
    const amt = Number(amount);
    const coins = Number(coinAmount);
    if (donationMethod === "idr" && (!amt || amt < 10000)) return;
    if (donationMethod === "coins" && (!coins || coins < 1)) return;
    setBusy(true);
    try {
      const res = await api<{ redirectUrl?: string | null; donated?: boolean }>("campaigns.donate", {
        campaignId: campaign.id,
        paymentMethod: donationMethod === "coins" ? "coins" : "qris",
        amount: amt,
        coinAmount: coins,
        supporterName: name || undefined,
        supporterEmail: email || undefined,
        message: message || undefined,
      });
      if (res?.redirectUrl) {
        window.open(res.redirectUrl, "_blank");
        onDonated();
      } else if (res?.donated) {
        toast.success("Donasi koin berhasil dikirim ke kampanye.");
        onDonated();
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const progress = Math.min(100, (campaign.collectedAmount / campaign.targetAmount) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <MemberAvatar
              name={campaign.creatorName}
              tier={null}
              photoData={campaign.creatorPhoto}
              size={48}
            />
            <div>
              <p className="font-semibold">{campaign.creatorName}</p>
              <p className="text-xs text-muted-foreground">
                {campaign.donorCount} donatur · {campaign.donations.length} transaksi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>
        <h2 className="mb-2 font-display text-2xl font-semibold">{campaign.title}</h2>
        <p className="mb-4 text-sm text-muted-foreground whitespace-pre-wrap">
          {campaign.description}
        </p>
        <div className="mb-4 rounded-xl bg-secondary/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Terkumpul</span>
            <span className="text-lg font-bold text-primary">
              Rp{campaign.collectedAmount.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="mb-2 h-3 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progress.toFixed(0)}% tercapai</span>
            <span>Target: Rp{campaign.targetAmount.toLocaleString("id-ID")}</span>
          </div>
          {campaign.deadline && (
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="size-3" aria-hidden />
              <span>
                Berakhir {new Date(campaign.deadline).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
        {account && (
          <div className="mb-4 space-y-3">
            <h3 className="font-semibold">Berdonasi</h3>
            <div className="flex gap-2">
              <Button type="button" variant={donationMethod === "idr" ? "default" : "outline"} onClick={() => setDonationMethod("idr")}>Uang (QRIS)</Button>
              <Button type="button" variant={donationMethod === "coins" ? "default" : "outline"} onClick={() => setDonationMethod("coins")}>Koin</Button>
            </div>
            {donationMethod === "idr" ? (
              <>
                <input
                  type="number"
                  min={10000}
                  step={10000}
                  placeholder="Jumlah donasi (min. Rp 10.000)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                {Number(amount) >= 10000 ? <PaymentQris amount={Number(amount)} compact /> : null}
              </>
            ) : (
              <>
                <input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Jumlah koin yang didonasikan"
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Perkiraan nilai donasi: Rp{Math.floor((Number(coinAmount || 0) * 1000) / coinConversionRate).toLocaleString("id-ID")}
                </p>
              </>
            )}
            <input
              type="text"
              placeholder="Nama (opsional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="Email (opsional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Pesan dukungan (opsional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <Button onClick={() => void donate()} disabled={busy || (donationMethod === "idr" ? !amount : !coinAmount)} className="w-full">
              {busy ? "Memproses..." : "Donasi Sekarang"}
            </Button>
          </div>
        )}
        {campaign.donations.length > 0 && (
          <div>
            <h3 className="mb-2 font-semibold">Donatur Terbaru</h3>
            <div className="space-y-2">
              {campaign.donations.slice(0, 10).map((d) => (
                <div key={d.id} className="flex items-start gap-3 rounded-lg bg-secondary/30 p-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                    <Heart className="size-4 text-primary" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{d.supporterName}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.currency === "coins" ? `${(d.coinAmount ?? 0).toLocaleString("id-ID")} koin (≈ Rp${d.amount.toLocaleString("id-ID")})` : `Rp${d.amount.toLocaleString("id-ID")}`} ·{" "}
                      {new Date(d.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    {d.message && (
                      <p className="mt-1 text-xs text-muted-foreground italic">
                        "{d.message}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
