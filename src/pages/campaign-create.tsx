import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { useRoute } from "@/lib/router";
import { ROLE_RANK } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/common";

export function CampaignCreatePage() {
  const { account } = useAuth();
  const { navigate } = useRoute();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rank = account ? ROLE_RANK[account.role] ?? 0 : 0;
  if (rank < 2) {
    return (
      <>
        <PageBanner art="/images/banner-event.svg">
          <h1 className="font-display text-3xl font-bold">Buat Kampanye</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Hanya anggota terverifikasi yang dapat membuat kampanye donasi.
          </p>
        </PageBanner>
        <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center">
          <p className="text-muted-foreground">
            Anda harus login sebagai anggota untuk membuat kampanye.
          </p>
        </div>
      </>
    );
  }

  const submit = async () => {
    setError("");
    const amt = Number(targetAmount);
    if (!title.trim() || !description.trim() || !amt || amt < 100000) {
      setError("Judul, deskripsi, dan target donasi (min. Rp 100.000) wajib diisi.");
      return;
    }
    setBusy(true);
    const res = await api<{ created: boolean }>("campaigns.create", {
      title: title.trim(),
      description: description.trim(),
      targetAmount: amt,
      deadline: deadline || undefined,
    });
    setBusy(false);
    if (res?.created) {
      navigate("/galang-dana");
    } else {
      setError("Gagal membuat kampanye. Silakan coba lagi.");
    }
  };

  return (
    <>
      <PageBanner art="/images/banner-event.svg">
        <h1 className="font-display text-3xl font-bold">Buat Kampanye</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Galang dana untuk kebutuhan usaha atau program Anda.
        </p>
      </PageBanner>
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Judul Kampanye</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Mesin Jahit Industri untuk Butik Saya"
                maxLength={120}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Deskripsi</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ceritakan tujuan donasi, rencana penggunaan dana, dan dampak yang diharapkan..."
                rows={6}
                maxLength={2000}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Target Donasi (Rp)</label>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="10000000"
                min={100000}
                step={100000}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Minimal Rp 100.000
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Deadline <span className="text-muted-foreground">(opsional)</span>
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/galang-dana")}>
                Batal
              </Button>
              <Button onClick={() => void submit()} disabled={busy} className="flex-1">
                {busy ? "Membuat..." : "Buat Kampanye"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
