import { useState } from "react";
import { AlertCircle, CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { ROLE_RANK } from "@/lib/constants";
import type { EsportTransferDispute } from "@/lib/types";
import { ESPORT_TRANSFER_DISPUTE_STATUS_META } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TransferDisputesPanelProps {
  transferId: string;
  disputes: EsportTransferDispute[];
  onRefresh: () => void;
}

const statusIcon = (status: string) => {
  switch (status) {
    case "open":
      return <AlertCircle className="size-4 text-red-600" aria-hidden />;
    case "under_review":
      return <Clock className="size-4 text-amber-600" aria-hidden />;
    case "resolved":
      return <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />;
    case "dismissed":
      return <XCircle className="size-4 text-slate-600" aria-hidden />;
    default:
      return <AlertCircle className="size-4" aria-hidden />;
  }
};

export function TransferDisputesPanel({ transferId, disputes, onRefresh }: TransferDisputesPanelProps) {
  const auth = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState("");
  const [resolveStatus, setResolveStatus] = useState<"resolved" | "dismissed">("resolved");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = auth.account ? (ROLE_RANK[auth.account.role] ?? 0) >= 6 : false;

  const handleCreate = async () => {
    if (!reason.trim()) {
      toast.error("Alasan sengketa harus diisi");
      return;
    }
    setSubmitting(true);
    try {
      const json = await api<{ dispute: EsportTransferDispute }>("esport.transfer.disputes.create", {
        transferId,
        reason: reason.trim(),
        description: description.trim() || null,
        evidence: [],
      });
      if (json.dispute) {
        toast.success("Sengketa berhasil dibuat");
        setShowCreateDialog(false);
        setReason("");
        setDescription("");
        onRefresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat sengketa");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (disputeId: string) => {
    setSubmitting(true);
    try {
      const json = await api<{ dispute: EsportTransferDispute }>("esport.transfer.disputes.resolve", {
        id: disputeId,
        status: resolveStatus,
        resolution: resolution.trim() || null,
      });
      if (json.dispute) {
        toast.success(`Sengketa ${resolveStatus === "resolved" ? "diselesaikan" : "ditolak"}`);
        setShowResolveDialog(null);
        setResolution("");
        onRefresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menangani sengketa");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-5 text-red-600" aria-hidden />
            Sengketa Transfer
          </span>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            Laporkan Sengketa
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {disputes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Tidak ada sengketa untuk transfer ini.
          </p>
        ) : (
          <div className="space-y-3">
            {disputes.map((dispute) => {
              const statusMeta = ESPORT_TRANSFER_DISPUTE_STATUS_META[dispute.status] ?? {
                label: dispute.status,
                tone: "bg-slate-100 text-slate-700",
              };
              return (
                <div key={dispute.id} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {statusIcon(dispute.status)}
                      <Badge className={cn("text-xs", statusMeta.tone)}>{statusMeta.label}</Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {new Date(dispute.createdAt).toLocaleDateString("id-ID")}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Alasan</p>
                    <p className="text-sm text-muted-foreground">{dispute.reason}</p>
                  </div>
                  {dispute.description && (
                    <div>
                      <p className="text-sm font-medium">Deskripsi</p>
                      <p className="text-sm text-muted-foreground">{dispute.description}</p>
                    </div>
                  )}
                  {dispute.evidence && dispute.evidence.length > 0 && (
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <FileText className="size-3" aria-hidden />
                        Bukti
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {dispute.evidence.map((file, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {file}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {dispute.raisedByUser?.name?.charAt(0) || "?"}
                    </div>
                    <span>Dilaporkan oleh {dispute.raisedByUser?.name || "Anonim"}</span>
                  </div>
                  {dispute.resolution && (
                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium">Resolusi</p>
                      <p className="text-sm text-muted-foreground">{dispute.resolution}</p>
                    </div>
                  )}
                  {isAdmin && dispute.status === "open" && (
                    <div className="pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowResolveDialog(dispute.id)}
                      >
                        Tangani Sengketa
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Laporkan Sengketa Transfer</DialogTitle>
              <DialogDescription>
                Laporkan masalah terkait transfer ini. Admin akan meninjau dan menyelesaikan sengketa.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Alasan Sengketa *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan alasan sengketa..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Deskripsi Detail (opsional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Berikan detail tambahan..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Batal
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? "Mengirim..." : "Kirim Laporan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showResolveDialog} onOpenChange={(open) => !open && setShowResolveDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tangani Sengketa</DialogTitle>
              <DialogDescription>
                Selesaikan atau tolak sengketa transfer ini.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Status Resolusi</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={resolveStatus === "resolved" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setResolveStatus("resolved")}
                  >
                    <CheckCircle2 className="size-4 mr-1" aria-hidden />
                    Selesaikan
                  </Button>
                  <Button
                    variant={resolveStatus === "dismissed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setResolveStatus("dismissed")}
                  >
                    <XCircle className="size-4 mr-1" aria-hidden />
                    Tolak
                  </Button>
                </div>
              </div>
              <div>
                <Label>Resolusi (opsional)</Label>
                <Textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Jelaskan resolusi sengketa..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResolveDialog(null)}>
                Batal
              </Button>
              <Button
                onClick={() => showResolveDialog && handleResolve(showResolveDialog)}
                disabled={submitting}
              >
                {submitting ? "Memproses..." : "Konfirmasi"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
