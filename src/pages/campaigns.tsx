import { useState, useEffect } from "react";
import { Heart, Calendar, Users, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { ROLE_RANK } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { MemberAvatar, PageBanner } from "@/components/common";
import type { Campaign, CampaignDetail } from "@/lib/types";

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
      <PageBanner art="/images/banner-event.svg">
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
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-lg"
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
                      className="h-full rounded-full bg-primary transition-all"
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

  const donate = async () => {
    const amt = Number(amount);
    if (!amt || amt < 10000) return;
    setBusy(true);
    const res = await api<{ redirectUrl: string | null }>("campaigns.donate", {
      campaignId: campaign.id,
      amount: amt,
      supporterName: name || undefined,
      supporterEmail: email || undefined,
      message: message || undefined,
    });
    setBusy(false);
    if (res?.redirectUrl) {
      window.open(res.redirectUrl, "_blank");
      onDonated();
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
            <input
              type="number"
              min={10000}
              step={10000}
              placeholder="Jumlah donasi (min. Rp 10.000)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
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
            <Button onClick={() => void donate()} disabled={busy || !amount} className="w-full">
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
                      Rp{d.amount.toLocaleString("id-ID")} ·{" "}
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
