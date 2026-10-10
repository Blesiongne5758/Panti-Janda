import { useState } from "react";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link, useRoute } from "@/lib/router";
import { BUSINESS_TYPE_OPTIONS } from "@/lib/constants";
import type { BusinessDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageBanner } from "@/components/common";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";

interface RabDraft {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

export default function BusinessFormPage() {
  const { account, profile } = useAuth();
  const { navigate } = useRoute();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [businessType, setBusinessType] = useState(BUSINESS_TYPE_OPTIONS[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [capitalNeeded, setCapitalNeeded] = useState("");
  const [proposal, setProposal] = useState("");
  const [rabItems, setRabItems] = useState<RabDraft[]>([]);

  if (!profile) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
        <PageBanner>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <Briefcase className="size-6 text-primary" aria-hidden />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Akses ditolak</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Kamu harus masuk sebagai anggota janda untuk membuat proposal usaha.
              </p>
            </div>
          </div>
        </PageBanner>
        <Button asChild variant="outline" className="w-fit">
          <Link to="/bisnis">
            <ArrowLeft className="size-4" />
            Kembali
          </Link>
        </Button>
      </div>
    );
  }

  function addRabItem() {
    setRabItems([
      ...rabItems,
      { id: crypto.randomUUID(), description: "", quantity: "1", unit: "", unitPrice: "0" },
    ]);
  }

  function updateRabItem(id: string, field: keyof RabDraft, value: string) {
    setRabItems(rabItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeRabItem(id: string) {
    setRabItems(rabItems.filter((item) => item.id !== id));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError("Judul proposal minimal 3 karakter.");
      return;
    }

    const capital = Number(capitalNeeded);
    if (!Number.isFinite(capital) || capital < 0) {
      setError("Modal dibutuhkan harus angka yang valid.");
      return;
    }

    const rab = rabItems
      .filter((item) => item.description.trim().length > 0)
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unit: item.unit.trim(),
        unitPrice: Number(item.unitPrice) || 0,
      }));

    setBusy(true);
    try {
      const data = await api<{ business: BusinessDetail }>("businesses.create", {
        businessType,
        title: title.trim(),
        description: description.trim() || undefined,
        capitalNeeded: capital,
        proposal: proposal.trim() || undefined,
        rabItems: rab,
      });
      toast.success("Proposal berhasil dibuat dan menunggu persetujuan admin.");
      navigate(`/bisnis/${data.business.id}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/bisnis">
          <ArrowLeft className="size-4" />
          Kembali
        </Link>
      </Button>

      <PageBanner>
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Briefcase className="size-6 text-primary" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Buat Proposal Usaha</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Isi detail usaha dan rencana anggaran untuk mengajukan proposal dukungan.
            </p>
          </div>
        </div>
      </PageBanner>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Detail Proposal</CardTitle>
          <CardDescription>
            Proposal yang diajukan akan ditinjau admin sebelum ditampilkan publik.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="type">Jenis Usaha *</Label>
              <Select value={businessType} onValueChange={setBusinessType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Judul Proposal *</Label>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="Contoh: Butik Jahit Wulan"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi Singkat</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Ceritakan tentang usahamu..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capital">Modal Dibutuhkan (Rp) *</Label>
              <Input
                id="capital"
                type="number"
                min={0}
                value={capitalNeeded}
                onChange={(event) => setCapitalNeeded(event.target.value)}
                placeholder="15000000"
                required
              />
              <p className="text-xs text-muted-foreground">
                Total modal yang dibutuhkan untuk mengembangkan usaha.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposal">Proposal Lengkap</Label>
              <Textarea
                id="proposal"
                value={proposal}
                onChange={(event) => setProposal(event.target.value)}
                maxLength={10000}
                rows={8}
                placeholder="Jelaskan rencana usahamu, bagaimana modal akan digunakan, dan target yang ingin dicapai..."
              />
            </div>

            <div className="space-y-4 rounded-lg border border-border bg-secondary/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Rencana Anggaran Biaya (RAB)</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tambahkan rincian penggunaan modal (opsional).
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addRabItem}>
                  <Plus className="size-4" />
                  Tambah Item
                </Button>
              </div>

              {rabItems.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Belum ada item RAB. Klik "Tambah Item" untuk menambahkan.
                </p>
              ) : (
                <div className="space-y-3">
                  {rabItems.map((item, index) => (
                    <div key={item.id} className="space-y-2 rounded-md border border-border bg-background p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRabItem(item.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Uraian</Label>
                          <Input
                            value={item.description}
                            onChange={(event) => updateRabItem(item.id, "description", event.target.value)}
                            placeholder="Contoh: Mesin jahit industri"
                            maxLength={200}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Jumlah</Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) => updateRabItem(item.id, "quantity", event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Satuan</Label>
                          <Input
                            value={item.unit}
                            onChange={(event) => updateRabItem(item.id, "unit", event.target.value)}
                            placeholder="unit, liter, kg"
                            maxLength={40}
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Harga Satuan (Rp)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(event) => updateRabItem(item.id, "unitPrice", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/bisnis">Batal</Link>
              </Button>
              <Button type="submit" disabled={busy} className="flex-1">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Ajukan Proposal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
