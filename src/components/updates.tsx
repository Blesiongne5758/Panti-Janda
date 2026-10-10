import { useCallback, useEffect, useState } from "react";
import { Flag, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { CommentItem, UpdateItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UpdateCard } from "@/components/cards";
import { EmptyState, ErrorNote, LoadingGrid } from "@/components/common";
import { toast } from "sonner";

const REPORT_REASONS = [
  { value: "spam", label: "Spam atau promosi berulang" },
  { value: "konten_tidak_pantas", label: "Konten tidak pantas" },
  { value: "informasi_palsu", label: "Informasi palsu / menyesatkan" },
  { value: "pelecehan", label: "Pelecehan atau ujaran kebencian" },
  { value: "lainnya", label: "Lainnya" },
];

export function ReportDialog({
  targetType,
  targetId,
  trigger,
}: {
  targetType: "profile" | "update" | "comment";
  targetId: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.length < 5) {
      toast.error("Pilih alasan laporan terlebih dahulu.");
      return;
    }
    setBusy(true);
    try {
      await api("reports.create", { targetType, targetId, reason, detail });
      toast.success("Laporan terkirim. Admin akan meninjau secepatnya.");
      setOpen(false);
      setReason("");
      setDetail("");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger}
      </span>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Laporkan konten</DialogTitle>
          <DialogDescription>
            Laporan Anda membantu admin menjaga komunitas tetap aman dan bermartabat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih alasan" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_REASONS.map((item) => (
                <SelectItem key={item.value} value={item.label}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Keterangan tambahan (opsional)"
            rows={3}
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Flag className="size-4" aria-hidden />}
            Kirim laporan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommentThread({ updateId, canComment }: { updateId: string; canComment: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CommentItem[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(null);
    try {
      const data = await api<{ items: CommentItem[] }>("comments.list", { updateId });
      setItems(data.items);
      setLoaded(true);
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setLoading(false);
    }
  }, [updateId]);

  const send = async () => {
    const body = draft.trim();
    if (body.length < 2) {
      toast.error("Tulis komentar minimal 2 karakter.");
      return;
    }
    setSending(true);
    try {
      const data = await api<{ comment: CommentItem }>("comments.create", { updateId, body });
      setItems((prev) => [...prev, data.comment]);
      setDraft("");
      toast.success("Komentar terkirim.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSending(false);
    }
  };

  if (!loaded) {
    return (
      <div className="mt-3 border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <MessageCircle className="size-3.5" aria-hidden />}
          Lihat komentar
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {failed ? <ErrorNote message={failed} onRetry={() => void load()} /> : null}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Belum ada komentar. Jadilah yang pertama menyapa.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((comment) => (
            <li key={comment.id} className="rounded-xl bg-secondary/50 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">{comment.authorName}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                  <ReportDialog
                    targetType="comment"
                    targetId={comment.id}
                    trigger={
                      <button
                        type="button"
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Laporkan komentar"
                      >
                        <Flag className="size-3" aria-hidden />
                      </button>
                    }
                  />
                </div>
              </div>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
      {canComment ? (
        <div className="flex items-start gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Tulis komentar yang sopan…"
            rows={2}
            maxLength={600}
            className="min-h-0"
          />
          <Button size="icon" onClick={send} disabled={sending} aria-label="Kirim komentar">
            {sending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          <a href="#/masuk" className="font-medium text-primary underline-offset-2 hover:underline">
            Masuk
          </a>{" "}
          untuk ikut berkomentar.
        </p>
      )}
    </div>
  );
}

export function UpdatesSection({
  profileId,
  canComment,
  refreshKey = 0,
}: {
  profileId: string;
  canComment: boolean;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(null);
    try {
      const data = await api<{ items: UpdateItem[] }>("updates.list", { profileId });
      setItems(data.items);
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading) return <LoadingGrid count={2} className="lg:grid-cols-1" />;
  if (failed) return <ErrorNote message={failed} onRetry={() => void load()} />;
  if (items.length === 0) {
    return (
      <EmptyState
        title="Belum ada kabar"
        description="Kabar kegiatan dan perkembangan dari anggota akan muncul di sini."
        icon={<MessageCircle className="size-5" aria-hidden />}
      />
    );
  }
  return (
    <div className="space-y-4">
      {items.map((update) => (
        <UpdateCard key={update.id} title={update.title} body={update.body} createdAt={update.createdAt}>
          <CommentThread updateId={update.id} canComment={canComment} />
          <div className="mt-2 flex justify-end">
            <ReportDialog
              targetType="update"
              targetId={update.id}
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Flag className="size-3" aria-hidden />
                  Laporkan
                </button>
              }
            />
          </div>
        </UpdateCard>
      ))}
    </div>
  );
}
