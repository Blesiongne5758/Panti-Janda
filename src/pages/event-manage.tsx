import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowLeft,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GripVertical,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Mail,
  MessagesSquare,
  Plus,
  Power,
  Radio,
  ReceiptText,
  Rocket,
  Search,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { ApiError, api, errorMissing, errorText, PUBLISH_MISSING_LABEL, PUBLISH_READY_LABEL } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link, useRoute } from "@/lib/router";
import { formatDate, formatDateTime, formatRupiah, timeAgo } from "@/lib/format";
import {
  APPROVAL_REASON_LABEL,
  BUDGET_CATEGORY_META,
  COMMITTEE_ASSIGNABLE_ROLES,
  COMMITTEE_ROLE_LABEL,
  EVENT_EXPENSE_THRESHOLD,
  EVENT_STATUS_META,
  FUNDING_SOURCE_META,
  ROLE_RANK,
  TICKET_STATUS_LABEL,
  VIRTUAL_PLATFORM_LABEL,
} from "@/lib/constants";
import { parseInviteQrPayload, parseTicketQrPayload } from "@/lib/ticket-qr";
import type {
  BudgetItemInfo,
  ChecklistItemInfo,
  CommitteeCandidate,
  EventCommittee,
  EventDetail,
  EventManageData,
  InvitationItem,
  InvitationsList,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { EmptyState, ErrorNote, LoadingGrid } from "@/components/common";
import { QrScannerSection } from "@/components/qr-scanner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab =
  | "ringkasan"
  | "anggaran"
  | "pengeluaran"
  | "checklist"
  | "laporan"
  | "panitia"
  | "tiket"
  | "absensi"
  | "undangan";

interface TicketRow {
  id: string;
  eventId: string;
  accountId: string;
  attendeeName: string;
  attendeePhoto: string | null;
  code: string;
  ticketType: string;
  price: number;
  paymentStatus: string | null;
  status: string;
  createdAt: string;
}

const DRAFT_STATUSES = ["draft", "planning", "budgeting"];

const CHECKLIST_COLUMNS: { key: ChecklistItemInfo["status"]; label: string; tone: string }[] = [
  { key: "pending", label: "Belum dikerjakan", tone: "bg-slate-100 text-slate-700" },
  { key: "in_progress", label: "Sedang dikerjakan", tone: "bg-sky-100 text-sky-800" },
  { key: "done", label: "Selesai", tone: "bg-emerald-100 text-emerald-800" },
];

const PRIORITY_META: Record<string, { label: string; dot: string }> = {
  high: { label: "Prioritas tinggi", dot: "bg-rose-500" },
  medium: { label: "Prioritas sedang", dot: "bg-amber-500" },
  low: { label: "Prioritas rendah", dot: "bg-slate-400" },
};

const AUDIT_LABEL: Record<string, string> = {
  "plan.update": "Rencana acara diperbarui",
  "budget_item.create": "Item anggaran ditambahkan",
  "budget_item.update": "Item anggaran diperbarui",
  "budget_item.delete": "Item anggaran dihapus",
  "funding.create": "Sumber dana ditambahkan",
  "funding.update": "Sumber dana diperbarui",
  "funding.delete": "Sumber dana dihapus",
  "expense.create": "Pengeluaran dicatat",
  "expense.create.pending": "Pengeluaran menunggu persetujuan",
  "expense.approved": "Pengeluaran disetujui",
  "expense.rejected": "Pengeluaran ditolak",
  "report.financial": "Laporan keuangan dibuat",
  "report.attendance": "Laporan kehadiran dibuat",
  "event.draft.create": "Draf event dibuat",
  "event.publish": "Event dipublikasikan",
  "event.start": "Event dimulai",
  "event.complete": "Event diselesaikan",
  "event.archive": "Event diarsipkan",
  "live.start": "Live stream dimulai",
  "live.end": "Live stream diakhiri",
  "approval.approved": "Disetujui admin",
  "approval.rejected": "Ditolak admin",
  "approval.revision": "Perlu revisi dari admin",
};

export default function EventManagePage({ id }: { id: string }) {
  const { account } = useAuth();
  const { navigate } = useRoute();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const [data, setData] = useState<EventDetail["event"] | null>(null);
  const [manage, setManage] = useState<EventManageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("ringkasan");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, manageResult] = await Promise.all([
        api<EventDetail>("events.get", { id }),
        api<EventManageData>("events.manage.get", { id }).catch(() => null),
      ]);
      setData(detail.event);
      setManage(manageResult);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const refreshManage = useCallback(async () => {
    const result = await api<EventManageData>("events.manage.get", { id }).catch(() => null);
    if (result) setManage(result);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <LoadingGrid count={4} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <ErrorNote message={error ?? "Event tidak ditemukan."} onRetry={load} />
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/event">
              <ArrowLeft className="size-4" aria-hidden />
              Kembali
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = account?.id === data.createdBy;
  const canManage = isOwner || data.isCommittee || rank >= 4;
  const canEditStructure = isOwner || account?.role === "admin";

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <ErrorNote message="Anda tidak memiliki akses untuk mengelola event ini." onRetry={() => navigate("/event")} />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [];
  if (manage) {
    tabs.push(
      { key: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
      { key: "anggaran", label: "Anggaran", icon: Wallet },
      { key: "pengeluaran", label: "Pengeluaran", icon: ReceiptText },
      { key: "checklist", label: "Checklist", icon: ListChecks },
      { key: "laporan", label: "Laporan", icon: BarChart3 },
    );
  }
  tabs.push(
    { key: "panitia", label: "Panitia", icon: Users },
    { key: "tiket", label: "Tiket", icon: Ticket },
    { key: "absensi", label: "Absensi", icon: ClipboardCheck },
  );
  if (data.audience === "undangan") {
    tabs.push({ key: "undangan", label: "Undangan", icon: Mail });
  }
  const activeTab: Tab = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;
  const statusMeta = manage ? EVENT_STATUS_META[manage.event.status] : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to={`/event/${id}`}>
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke detail event
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold">{data.title}</h1>
          {statusMeta ? (
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusMeta.tone)}>
              {statusMeta.label}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Dashboard penyelenggara: pantau anggaran, tugas panitia, dan kehadiran peserta.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-secondary/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex min-w-[110px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "ringkasan" && manage ? (
        <OverviewTab eventId={id} manage={manage} canManage={canManage} onReload={load} />
      ) : null}
      {activeTab === "anggaran" && manage ? <BudgetTab manage={manage} /> : null}
      {activeTab === "pengeluaran" && manage ? (
        <ExpensesTab eventId={id} manage={manage} onRefresh={refreshManage} />
      ) : null}
      {activeTab === "checklist" && manage ? (
        <ChecklistTab eventId={id} manage={manage} onRefresh={refreshManage} />
      ) : null}
      {activeTab === "laporan" && manage ? (
        <ReportsTab eventId={id} manage={manage} onRefresh={refreshManage} />
      ) : null}
      {activeTab === "panitia" ? (
        <CommitteeTab
          eventId={id}
          committees={data.committees}
          creatorName={data.creatorName}
          createdBy={data.createdBy}
          canEdit={canEditStructure}
          eventGroupId={data.eventGroupId}
          onReload={load}
        />
      ) : null}
      {activeTab === "tiket" ? <TicketsTab eventId={id} isPaid={Boolean(data.ticketPrice)} /> : null}
      {activeTab === "absensi" ? <AttendanceTab eventId={id} /> : null}
      {activeTab === "undangan" ? <InvitationTab eventId={id} /> : null}
    </div>
  );
}

function OverviewTab({
  eventId,
  manage,
  canManage,
  onReload,
}: {
  eventId: string;
  manage: EventManageData;
  canManage: boolean;
  onReload: () => Promise<void>;
}) {
  const [missing, setMissing] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const status = manage.event.status;
  const isDraft = DRAFT_STATUSES.includes(status);
  const readiness = useMemo(() => {
    const planOk = Boolean(manage.plan?.targetAudience && manage.plan?.objectives);
    const itemsOk = manage.budgetItems.length > 0;
    const fundingOk = itemsOk && manage.totals.totalFunding >= manage.totals.totalBudget;
    const rundownOk = manage.sessions.length > 0;
    return { planOk, itemsOk, fundingOk, rundownOk, ready: planOk && itemsOk && fundingOk && rundownOk };
  }, [manage]);

  const publish = async () => {
    setMissing([]);
    setPublishing(true);
    try {
      const res = await api<{ status: string }>("events.publish", { id: eventId });
      if (res.status === "published") toast.success("Event berhasil dipublikasikan!");
      else toast.info("Event diajukan dan menunggu persetujuan admin.");
      await onReload();
    } catch (err) {
      if (err instanceof ApiError && err.code === "publish_incomplete") {
        const list = errorMissing(err);
        setMissing(list.length ? list : ["plan"]);
        toast.error("Event belum bisa dipublikasikan. Lengkapi item yang ditandai merah.");
      } else if (err instanceof ApiError && err.code === "pending_approval") {
        toast.info("Event ini sedang menunggu persetujuan admin.");
      } else {
        toast.error(errorText(err));
      }
    } finally {
      setPublishing(false);
    }
  };

  const transition = async (kind: "start" | "complete" | "archive") => {
    const labels = { start: "Mulai acara sekarang?", complete: "Tandai acara selesai?", archive: "Arsipkan event ini?" };
    if (!window.confirm(labels[kind])) return;
    setBusy(kind);
    try {
      const res = await api<{ status: string }>("events.lifecycle", { id: eventId, transition: kind });
      const meta = EVENT_STATUS_META[res.status];
      toast.success(`Status event: ${meta?.label ?? res.status}.`);
      await onReload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const liveAction = async (kind: "start" | "end") => {
    setBusy(`live.${kind}`);
    try {
      await api(kind === "start" ? "events.live.start" : "events.live.end", { id: eventId });
      toast.success(kind === "start" ? "Live stream dimulai." : "Live stream diakhiri.");
      await onReload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const approval = manage.approval;
  const days = manage.metrics.daysToEvent;
  const daysLabel =
    days === null ? "—" : days > 1 ? `H-${days}` : days === 1 ? "Besok" : days === 0 ? "Hari ini" : "Lewat";

  return (
    <div className="space-y-4">
      {isDraft ? (
        <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 sm:p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Rocket className="size-4" aria-hidden />
            Draf belum dipublikasikan
          </p>
          <ul className="space-y-2 text-sm">
            <ReadinessLine
              ok={readiness.planOk}
              text={readiness.planOk ? PUBLISH_READY_LABEL.plan : PUBLISH_MISSING_LABEL.plan}
            />
            <ReadinessLine
              ok={readiness.itemsOk}
              text={readiness.itemsOk ? PUBLISH_READY_LABEL.budget_items : PUBLISH_MISSING_LABEL.budget_items}
            />
            <ReadinessLine
              ok={readiness.fundingOk}
              text={readiness.fundingOk ? PUBLISH_READY_LABEL.funding_deficit : PUBLISH_MISSING_LABEL.funding_deficit}
            />
            <ReadinessLine
              ok={readiness.rundownOk}
              text={readiness.rundownOk ? PUBLISH_READY_LABEL.rundown : PUBLISH_MISSING_LABEL.rundown}
            />
          </ul>
          {missing.length ? (
            <div className="space-y-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <p className="flex items-center gap-2 font-medium">
                <XCircle className="size-4" aria-hidden />
                Server menolak publikasi. Yang perlu dilengkapi:
              </p>
              <ul className="list-disc space-y-1 pl-6">
                {missing.map((code) => (
                  <li key={code}>{PUBLISH_MISSING_LABEL[code] ?? code}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {canManage ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="outline" size="sm">
                <Link to={`/event/baru?id=${eventId}`}>
                  <FileText className="size-4" aria-hidden />
                  Lanjutkan mengedit draf
                </Link>
              </Button>
              <Button size="sm" onClick={() => void publish()} disabled={publishing}>
                {publishing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Rocket className="size-4" aria-hidden />
                )}
                Publikasikan event
              </Button>
            </div>
          ) : (
            <p className="text-xs">Hanya pembuat event yang dapat mempublikasikan draf ini.</p>
          )}
        </div>
      ) : null}

      {approval ? (
        <div
          className={cn(
            "space-y-2 rounded-2xl border p-4 text-sm sm:p-5",
            approval.status === "pending" && "border-orange-300 bg-orange-50 text-orange-900",
            approval.status === "approved" && "border-emerald-300 bg-emerald-50 text-emerald-900",
            approval.status === "rejected" && "border-rose-300 bg-rose-50 text-rose-900",
            approval.status === "revision" && "border-amber-300 bg-amber-50 text-amber-900",
          )}
        >
          <p className="flex items-center gap-2 font-semibold">
            <ClipboardCheck className="size-4" aria-hidden />
            {approval.status === "pending"
              ? "Menunggu persetujuan admin"
              : approval.status === "approved"
                ? "Disetujui admin"
                : approval.status === "rejected"
                  ? "Ditolak admin"
                  : "Perlu revisi dari admin"}
          </p>
          {approval.reason.length ? (
            <ul className="list-disc space-y-1 pl-6">
              {approval.reason.map((reason) => (
                <li key={reason}>{APPROVAL_REASON_LABEL[reason] ?? reason}</li>
              ))}
            </ul>
          ) : null}
          {approval.decisionNote ? <p>Catatan admin: {approval.decisionNote}</p> : null}
          <p className="text-xs opacity-80">
            Diajukan {timeAgo(approval.createdAt)}
            {approval.reviewedByName ? ` · ditinjau ${approval.reviewedByName}` : ""}
          </p>
        </div>
      ) : null}

      {manage.liveRoom ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full",
                manage.liveRoom.status === "live" ? "bg-rose-100 text-rose-600" : "bg-secondary text-muted-foreground",
              )}
            >
              <Radio className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">
                Live stream {VIRTUAL_PLATFORM_LABEL[manage.liveRoom.provider] ?? manage.liveRoom.provider}
              </p>
              <p className="text-xs text-muted-foreground">
                {manage.liveRoom.status === "live"
                  ? `Sedang berlangsung sejak ${formatDateTime(manage.liveRoom.startedAt)}`
                  : manage.liveRoom.status === "ended"
                    ? `Berakhir ${formatDateTime(manage.liveRoom.endedAt)}`
                    : "Belum dimulai"}
              </p>
            </div>
          </div>
          {canManage ? (
            manage.liveRoom.status === "live" ? (
              <Button size="sm" variant="outline" onClick={() => void liveAction("end")} disabled={busy !== null}>
                {busy === "live.end" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Power className="size-4" aria-hidden />}
                Akhiri siaran
              </Button>
            ) : (
              <Button size="sm" onClick={() => void liveAction("start")} disabled={busy !== null}>
                {busy === "live.start" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Radio className="size-4" aria-hidden />}
                Mulai siaran
              </Button>
            )
          ) : null}
        </div>
      ) : null}

      {canManage && ["published", "ongoing", "completed"].includes(status) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="mr-auto text-sm text-muted-foreground">Alur siklus acara</p>
          {status === "published" ? (
            <Button size="sm" onClick={() => void transition("start")} disabled={busy !== null}>
              {busy === "start" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
              Mulai acara
            </Button>
          ) : null}
          {status === "ongoing" ? (
            <Button size="sm" onClick={() => void transition("complete")} disabled={busy !== null}>
              {busy === "complete" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}
              Selesaikan acara
            </Button>
          ) : null}
          {status !== "archived" ? (
            <Button size="sm" variant="outline" onClick={() => void transition("archive")} disabled={busy !== null}>
              {busy === "archive" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Archive className="size-4" aria-hidden />}
              Arsipkan
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Peserta terdaftar" value={String(manage.metrics.registrations)} hint={`${manage.metrics.going} konfirmasi hadir`} />
        <KpiCard
          label="Tiket terbayar"
          value={String(manage.metrics.paidCount)}
          hint={`${manage.metrics.tickets} tiket diterbitkan`}
        />
        <KpiCard
          label="Kehadiran tercatat"
          value={String(manage.metrics.attendanceCount)}
          hint={`${manage.metrics.attendedInvites}/${manage.metrics.invites} undangan hadir`}
        />
        <KpiCard
          label="Checklist panitia"
          value={manage.metrics.checklistTotal ? `${manage.metrics.checklistTotal - manage.metrics.pendingChecklists}/${manage.metrics.checklistTotal}` : "0"}
          hint={`${manage.metrics.pendingChecklists} tugas tersisa`}
        />
        <KpiCard label="Sisa waktu" value={daysLabel} hint={manage.event.startsAt ? formatDate(manage.event.startsAt) : "Jadwal belum diisi"} />
        <KpiCard
          label="Pengeluaran"
          value={manage.totals.totalBudget ? `${manage.totals.budgetUsagePct}%` : "—"}
          hint={`${formatRupiah(manage.totals.totalSpent)} dari ${formatRupiah(manage.totals.totalBudget)}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Anggaran & dana</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              Total anggaran <span className="font-semibold text-foreground">{formatRupiah(manage.totals.totalBudget)}</span>
            </span>
            <span className="text-muted-foreground">
              Sumber dana <span className="font-semibold text-foreground">{formatRupiah(manage.totals.totalFunding)}</span>
            </span>
            <span className="text-muted-foreground">
              Sisa <span className="font-semibold text-foreground">{formatRupiah(manage.totals.remaining)}</span>
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full", manage.totals.budgetUsagePct > 100 ? "bg-rose-500" : "bg-primary")}
              style={{ width: `${Math.min(100, manage.totals.budgetUsagePct)}%` }}
            />
          </div>
          {manage.totals.deficit > 0 ? (
            <p className="text-xs text-amber-700">Kekurangan dana {formatRupiah(manage.totals.deficit)} dari target anggaran.</p>
          ) : null}
          {manage.totals.totalSpent > manage.totals.totalBudget && manage.totals.totalBudget > 0 ? (
            <p className="text-xs font-medium text-rose-600">Pengeluaran telah melebihi total anggaran.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <CalendarDays className="size-4" aria-hidden />
            Tugas mendekati tenggat
          </CardTitle>
        </CardHeader>
        <CardContent>
          {manage.dueSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada tugas yang jatuh tempo dalam 3 hari ke depan.</p>
          ) : (
            <ul className="divide-y divide-border">
              {manage.dueSoon.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.assigneeName ?? "Tanpa penanggung jawab"} · jatuh tempo {formatDate(item.dueAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      item.dueAt && Date.parse(item.dueAt) < Date.now() ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800",
                    )}
                  >
                    {item.dueAt && Date.parse(item.dueAt) < Date.now() ? "Terlambat" : "Segera"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Activity className="size-4" aria-hidden />
            Riwayat aktivitas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {manage.auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
          ) : (
            <ul className="divide-y divide-border">
              {manage.auditLogs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm">{AUDIT_LABEL[log.action] ?? log.action}</p>
                    {log.detail ? <p className="truncate text-xs text-muted-foreground">{log.detail}</p> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {log.actorName ?? "Sistem"} · {timeAgo(log.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReadinessLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <XCircle className="size-4 shrink-0 text-destructive" aria-hidden />
      )}
      <span className={cn("font-medium", ok ? "text-foreground" : "text-destructive")}>{text}</span>
    </li>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function BudgetTab({ manage }: { manage: EventManageData }) {
  const { totals } = manage;
  const maxCategory = Math.max(1, ...totals.byCategory.map((c) => Math.max(c.planned, c.actual)));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total anggaran" value={formatRupiah(totals.totalBudget)} hint={`${manage.budgetItems.length} item`} />
        <KpiCard label="Sumber dana" value={formatRupiah(totals.totalFunding)} hint={`${manage.fundingSources.length} sumber`} />
        <KpiCard label="Terpakai" value={formatRupiah(totals.totalSpent)} hint={`${totals.budgetUsagePct}% dari anggaran`} />
        <KpiCard
          label="Sisa anggaran"
          value={formatRupiah(totals.remaining)}
          hint={totals.remaining < 0 ? "Melebihi anggaran" : "Belum terpakai"}
        />
      </div>

      {totals.deficit > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Kekurangan dana {formatRupiah(totals.deficit)} — tambah sumber dana lewat wizard agar publikasi terpenuhi.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Rencana vs realisasi per kategori</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {totals.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada item anggaran.</p>
          ) : (
            totals.byCategory.map((row) => (
              <div key={row.category} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{BUDGET_CATEGORY_META[row.category]?.label ?? row.category}</span>
                  <span className="text-xs text-muted-foreground">
                    Rencana {formatRupiah(row.planned)} · Realisasi {formatRupiah(row.actual)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-slate-400"
                      style={{ width: `${Math.round((row.planned / maxCategory) * 100)}%` }}
                    />
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full", row.actual > row.planned ? "bg-rose-500" : "bg-primary")}
                      style={{ width: `${Math.round((row.actual / maxCategory) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Item anggaran</CardTitle>
        </CardHeader>
        <CardContent>
          {manage.budgetItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada item anggaran.</p>
          ) : (
            <ul className="divide-y divide-border">
              {manage.budgetItems.map((item) => (
                <BudgetItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Sumber dana</CardTitle>
        </CardHeader>
        <CardContent>
          {manage.fundingSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada sumber dana.</p>
          ) : (
            <ul className="divide-y divide-border">
              {manage.fundingSources.map((source) => {
                const share = totals.totalFunding > 0 ? Math.round((source.amount / totals.totalFunding) * 100) : 0;
                return (
                  <li key={source.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{source.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {FUNDING_SOURCE_META[source.type]?.label ?? source.type}
                        {source.notes ? ` · ${source.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-xs text-muted-foreground">{share}% dana</span>
                      <span className="text-sm font-semibold">{formatRupiah(source.amount)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BudgetItemRow({ item }: { item: BudgetItemInfo }) {
  const planned = item.quantity * item.estimatedCost;
  const pct = planned > 0 ? Math.min(100, Math.round((item.actualCost / planned) * 100)) : 0;
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {BUDGET_CATEGORY_META[item.category]?.label ?? item.category} · {item.quantity}
            {item.unit ? ` ${item.unit}` : ""} × {formatRupiah(item.estimatedCost)}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{formatRupiah(planned)}</p>
          <p className={cn("text-xs", item.actualCost > planned ? "text-rose-600" : "text-muted-foreground")}>
            realisasi {formatRupiah(item.actualCost)}
          </p>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", item.actualCost > planned ? "bg-rose-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

function ExpensesTab({
  eventId,
  manage,
  onRefresh,
}: {
  eventId: string;
  manage: EventManageData;
  onRefresh: () => Promise<void>;
}) {
  const canBudget = manage.permissions.canBudget;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [budgetItemId, setBudgetItemId] = useState("none");
  const [spentAt, setSpentAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const submit = async () => {
    const numeric = Math.round(Number(amount));
    if (description.trim().length < 3 || !Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Isi deskripsi dan jumlah pengeluaran dengan benar.");
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ needsApproval: boolean }>("events.expenses.save", {
        id: eventId,
        expense: {
          description: description.trim(),
          amount: numeric,
          budgetItemId: budgetItemId === "none" ? undefined : budgetItemId,
          spentAt,
        },
      });
      toast.success(
        res.needsApproval
          ? "Pengeluaran dicatat dan menunggu persetujuan ketua panitia/admin."
          : "Pengeluaran tercatat.",
      );
      setDescription("");
      setAmount("");
      setBudgetItemId("none");
      await onRefresh();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const review = async (expenseId: string, decision: "approve" | "reject") => {
    setBusyId(expenseId);
    try {
      await api("events.expenses.review", { id: eventId, expenseId, decision });
      toast.success(decision === "approve" ? "Pengeluaran disetujui." : "Pengeluaran ditolak.");
      await onRefresh();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const statusTone: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800",
    pending_approval: "bg-amber-100 text-amber-800",
    rejected: "bg-rose-100 text-rose-800",
  };
  const statusLabel: Record<string, string> = {
    approved: "Disetujui",
    pending_approval: "Menunggu persetujuan",
    rejected: "Ditolak",
  };

  return (
    <div className="space-y-4">
      {canBudget ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Catat pengeluaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ex-desc">Deskripsi</Label>
                <Input
                  id="ex-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sewa sound system"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ex-amount">Jumlah (Rp)</Label>
                <Input
                  id="ex-amount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="750000"
                />
              </div>
              <div className="space-y-2">
                <Label>Item anggaran (opsional)</Label>
                <Select value={budgetItemId} onValueChange={setBudgetItemId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa item anggaran</SelectItem>
                    {manage.budgetItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ex-date">Tanggal</Label>
                <Input id="ex-date" type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Pengeluaran di atas {formatRupiah(EVENT_EXPENSE_THRESHOLD)} otomatis menunggu persetujuan ketua panitia/admin.
            </p>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              Simpan pengeluaran
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Riwayat pengeluaran</CardTitle>
        </CardHeader>
        <CardContent>
          {manage.expenses.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="size-5" aria-hidden />}
              title="Belum ada pengeluaran"
              description="Catat pengeluaran acara agar laporan keuangan akurat."
            />
          ) : (
            <ul className="divide-y divide-border">
              {manage.expenses.map((expense) => (
                <li key={expense.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {BUDGET_CATEGORY_META[expense.category]?.label ?? expense.category} · {formatDate(expense.spentAt)} · oleh{" "}
                      {expense.recordedByName ?? "Anggota"}
                      {expense.reviewedByName ? ` · ditinjau ${expense.reviewedByName}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{formatRupiah(expense.amount)}</span>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusTone[expense.status] ?? "bg-secondary")}>
                      {statusLabel[expense.status] ?? expense.status}
                    </span>
                    {canBudget && expense.status === "pending_approval" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void review(expense.id, "approve")}
                          disabled={busyId === expense.id}
                        >
                          {busyId === expense.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <ThumbsUp className="size-4" aria-hidden />
                          )}
                          Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => void review(expense.id, "reject")}
                          disabled={busyId === expense.id}
                        >
                          <ThumbsDown className="size-4" aria-hidden />
                          Tolak
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChecklistTab({
  eventId,
  manage,
  onRefresh,
}: {
  eventId: string;
  manage: EventManageData;
  onRefresh: () => Promise<void>;
}) {
  const canChecklist = manage.permissions.canChecklist;
  const [items, setItems] = useState<ChecklistItemInfo[]>(manage.checklists);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");
  const [assignee, setAssignee] = useState("none");
  const [adding, setAdding] = useState(false);
  const [reminding, setReminding] = useState(false);

  useEffect(() => {
    setItems(manage.checklists);
  }, [manage.checklists]);

  const moveStatus = async (itemId: string, status: ChecklistItemInfo["status"]) => {
    const current = items.find((i) => i.id === itemId);
    if (!current || current.status === status || savingId) return;
    const previous = items;
    setItems((list) => list.map((i) => (i.id === itemId ? { ...i, status } : i)));
    setSavingId(itemId);
    try {
      await api("events.checklist.save", { id: eventId, item: { id: itemId, status } });
      await onRefresh();
    } catch (err) {
      setItems(previous);
      toast.error(errorText(err));
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (item: ChecklistItemInfo) => {
    if (!window.confirm(`Hapus tugas "${item.title}"?`)) return;
    setSavingId(item.id);
    try {
      await api("events.checklist.delete", { id: eventId, itemId: item.id });
      toast.success("Tugas dihapus.");
      await onRefresh();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSavingId(null);
    }
  };

  const add = async () => {
    if (title.trim().length < 3) {
      toast.error("Judul tugas minimal 3 karakter.");
      return;
    }
    setAdding(true);
    try {
      await api("events.checklist.save", {
        id: eventId,
        item: {
          title: title.trim(),
          priority,
          dueAt: dueAt || undefined,
          assigneeAccountId: assignee === "none" ? undefined : assignee,
        },
      });
      toast.success("Tugas ditambahkan.");
      setTitle("");
      setDueAt("");
      setAssignee("none");
      setPriority("medium");
      await onRefresh();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setAdding(false);
    }
  };

  const remind = async () => {
    setReminding(true);
    try {
      const res = await api<{ reminded: number }>("events.checklist.remind", { id: eventId });
      toast.success(
        res.reminded > 0 ? `${res.reminded} pengingat terkirim ke penanggung jawab.` : "Tidak ada tugas yang perlu diingatkan hari ini.",
      );
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setReminding(false);
    }
  };

  return (
    <div className="space-y-4">
      {canChecklist ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Tambah tugas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="cl-title">Judul tugas</Label>
                <Input
                  id="cl-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Konfirmasi vendor konsumsi"
                />
              </div>
              <div className="space-y-2">
                <Label>Prioritas</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Tinggi</SelectItem>
                    <SelectItem value="medium">Sedang</SelectItem>
                    <SelectItem value="low">Rendah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cl-due">Tenggat</Label>
                <Input id="cl-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Penanggung jawab</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa penanggung jawab</SelectItem>
                    {manage.team.map((member) => (
                      <SelectItem key={member.accountId} value={member.accountId}>
                        {member.name} — {COMMITTEE_ROLE_LABEL[member.role] ?? member.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void add()} disabled={adding}>
                {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                Tambah tugas
              </Button>
              <Button variant="outline" onClick={() => void remind()} disabled={reminding}>
                {reminding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BellRing className="size-4" aria-hidden />}
                Kirim pengingat H-3/H-1
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {CHECKLIST_COLUMNS.map((column) => {
          const columnItems = items.filter((item) => item.status === column.key);
          return (
            <div
              key={column.key}
              onDragOver={(e) => {
                if (canChecklist) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId) void moveStatus(draggingId, column.key);
                setDraggingId(null);
              }}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", column.tone)}>{column.label}</span>
                <span className="text-xs text-muted-foreground">{columnItems.length}</span>
              </div>
              {columnItems.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Tidak ada tugas di kolom ini.
                </p>
              ) : (
                columnItems.map((item) => {
                  const overdue = item.dueAt && item.status !== "done" && Date.parse(item.dueAt) < Date.now();
                  const priorityMeta = PRIORITY_META[item.priority] ?? PRIORITY_META.medium;
                  return (
                    <div
                      key={item.id}
                      draggable={canChecklist}
                      onDragStart={() => setDraggingId(item.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className={cn(
                        "space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm",
                        canChecklist && "cursor-grab active:cursor-grabbing",
                        draggingId === item.id && "opacity-60",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {canChecklist ? <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-medium", item.status === "done" && "text-muted-foreground line-through")}>
                            {item.title}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <span className={cn("size-2 rounded-full", priorityMeta.dot)} aria-hidden />
                              {priorityMeta.label}
                            </span>
                            {item.category ? <span>· {BUDGET_CATEGORY_META[item.category]?.label ?? item.category}</span> : null}
                            {item.dueAt ? (
                              <span className={cn("· ", overdue && "font-medium text-rose-600")}>
                                tenggat {formatDate(item.dueAt)}
                              </span>
                            ) : null}
                          </p>
                          {item.assigneeName ? (
                            <p className="mt-1 text-xs text-muted-foreground">PIC: {item.assigneeName}</p>
                          ) : null}
                        </div>
                      </div>
                      {canChecklist ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={item.status}
                            onValueChange={(value) => void moveStatus(item.id, value as ChecklistItemInfo["status"])}
                            disabled={savingId === item.id}
                          >
                            <SelectTrigger className="h-8 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CHECKLIST_COLUMNS.map((option) => (
                                <SelectItem key={option.key} value={option.key}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:text-rose-700"
                            onClick={() => void remove(item)}
                            disabled={savingId === item.id}
                            aria-label={`Hapus ${item.title}`}
                          >
                            {savingId === item.id ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="size-4" aria-hidden />
                            )}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
      {canChecklist ? (
        <p className="text-xs text-muted-foreground">
          Geser kartu antar kolom untuk mengubah status, atau gunakan pilihan status pada tiap kartu.
        </p>
      ) : null}
    </div>
  );
}

function ReportsTab({
  eventId,
  manage,
  onRefresh,
}: {
  eventId: string;
  manage: EventManageData;
  onRefresh: () => Promise<void>;
}) {
  const canChecklist = manage.permissions.canChecklist;
  const [generating, setGenerating] = useState<string | null>(null);

  const generate = async (kind: "financial" | "attendance") => {
    setGenerating(kind);
    try {
      await api("events.reports.generate", { id: eventId, kind });
      toast.success(kind === "financial" ? "Laporan keuangan dibuat." : "Laporan kehadiran dibuat.");
      await onRefresh();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Buat laporan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Laporan tersimpan sebagai arsip dan bisa dibagikan ke panitia maupun calon sponsor.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void generate("financial")} disabled={!canChecklist || generating !== null}>
              {generating === "financial" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Wallet className="size-4" aria-hidden />
              )}
              Laporan keuangan
            </Button>
            <Button variant="outline" onClick={() => void generate("attendance")} disabled={!canChecklist || generating !== null}>
              {generating === "attendance" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Users className="size-4" aria-hidden />
              )}
              Laporan kehadiran
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Arsip laporan</CardTitle>
        </CardHeader>
        <CardContent>
          {manage.reports.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-5" aria-hidden />}
              title="Belum ada laporan"
              description="Buat laporan keuangan atau kehadiran setelah acara berjalan."
            />
          ) : (
            <ul className="space-y-4">
              {manage.reports.map((report) => (
                <li key={report.id} className="space-y-2 rounded-xl border border-border p-3 sm:p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-medium">{report.kind === "financial" ? "Laporan keuangan" : "Laporan kehadiran"}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.generatedByName ? `oleh ${report.generatedByName} · ` : ""}
                      {timeAgo(report.createdAt)}
                    </p>
                  </div>
                  <ReportPayloadView kind={report.kind} payload={report.payload} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportPayloadView({ kind, payload }: { kind: string; payload: unknown }) {
  const data = (payload ?? {}) as Record<string, unknown>;
  const num = (value: unknown) => (typeof value === "number" ? value : 0);
  if (kind === "financial") {
    const byCategory = Array.isArray(data.byCategory) ? (data.byCategory as { category: string; planned: number; actual: number }[]) : [];
    return (
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
          <span>
            Total anggaran <span className="font-medium text-foreground">{formatRupiah(num(data.totalBudget))}</span>
          </span>
          <span>
            Sumber dana <span className="font-medium text-foreground">{formatRupiah(num(data.totalFunding))}</span>
          </span>
          <span>
            Terpakai <span className="font-medium text-foreground">{formatRupiah(num(data.totalSpent))}</span>
          </span>
          <span>
            Sisa <span className="font-medium text-foreground">{formatRupiah(num(data.remaining))}</span>
          </span>
        </div>
        {byCategory.length ? (
          <ul className="space-y-1">
            {byCategory.map((row) => (
              <li key={row.category} className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                <span>{BUDGET_CATEGORY_META[row.category]?.label ?? row.category}</span>
                <span>
                  rencana {formatRupiah(row.planned)} · realisasi {formatRupiah(row.actual)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
      <span>
        Konfirmasi hadir <span className="font-medium text-foreground">{num(data.going)}</span>
      </span>
      <span>
        Tiket valid <span className="font-medium text-foreground">{num(data.validTickets)}</span>
      </span>
      <span>
        Absensi <span className="font-medium text-foreground">{num(data.attendance)}</span>
      </span>
      <span>
        Undangan hadir{" "}
        <span className="font-medium text-foreground">
          {num(data.attendedInvites)}/{num(data.invites)}
        </span>
      </span>
      <span>
        Tingkat kehadiran <span className="font-medium text-foreground">{num(data.attendanceRate)}%</span>
      </span>
    </div>
  );
}

function MemberAvatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) {
    return <img src={photo} alt="" className="size-9 rounded-full object-cover" />;
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function CommitteeTab({
  eventId,
  committees,
  creatorName,
  createdBy,
  canEdit,
  eventGroupId,
  onReload,
}: {
  eventId: string;
  committees: EventCommittee[];
  creatorName: string | null;
  createdBy: string;
  canEdit: boolean;
  eventGroupId: string | null;
  onReload: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<CommitteeCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [newRole, setNewRole] = useState("panitia");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const chairRow = committees.find((c) => c.role === "ketua_panitia") ?? null;
  const chair: EventCommittee | null =
    chairRow ??
    (creatorName
      ? { id: "chair", accountId: createdBy, accountName: creatorName, accountPhoto: null, role: "ketua_panitia" }
      : null);
  const members = committees.filter((c) => c.role !== "ketua_panitia");

  useEffect(() => {
    const q = query.trim();
    if (!canEdit || q.length < 2) {
      setCandidates([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await api<{ items: CommitteeCandidate[] }>("events.committee.candidates", {
            eventId,
            q,
          });
          setCandidates(result.items);
        } catch {
          setCandidates([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, eventId, canEdit]);

  const addCandidate = async (candidate: CommitteeCandidate) => {
    setAddingId(candidate.accountId);
    try {
      await api("events.committee.add", { eventId, accountId: candidate.accountId, role: newRole });
      toast.success(`${candidate.name} ditambahkan sebagai ${COMMITTEE_ROLE_LABEL[newRole] ?? newRole}.`);
      setQuery("");
      setCandidates([]);
      await onReload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setAddingId(null);
    }
  };

  const changeRole = async (accountId: string, role: string) => {
    setBusyId(accountId);
    try {
      await api("events.committee.role", { eventId, accountId, role });
      toast.success(`Peran diperbarui menjadi ${COMMITTEE_ROLE_LABEL[role] ?? role}.`);
      await onReload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const removeCommittee = async (member: EventCommittee) => {
    if (!window.confirm(`Hapus ${member.accountName} dari kepanitiaan?`)) return;
    setBusyId(member.accountId);
    try {
      await api("events.committee.remove", { eventId, accountId: member.accountId });
      toast.success("Panitia dihapus.");
      await onReload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Struktur kepanitiaan ({committees.length || (chair ? 1 : 0)})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {eventGroupId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Grup chat panitia</p>
              <p className="text-xs text-muted-foreground">Koordinasi kepanitiaan otomatis tersedia di Pesan.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={`/pesan?grup=${eventGroupId}`}>
                <MessagesSquare className="size-4" aria-hidden />
                Buka grup chat
              </Link>
            </Button>
          </div>
        ) : null}

        {canEdit ? (
          <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-sm font-medium">Tambah panitia dari anggota</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="space-y-2">
                <Label htmlFor="cm-search">Cari nama anggota</Label>
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="cm-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ketik minimal 2 huruf nama…"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Peran awal</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMITTEE_ASSIGNABLE_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {COMMITTEE_ROLE_LABEL[role] ?? role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {searching ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Mencari anggota…
              </div>
            ) : candidates.length > 0 ? (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {candidates.map((candidate) => (
                  <li key={candidate.accountId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar name={candidate.name} photo={candidate.photoData} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{candidate.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{candidate.nickname ?? candidate.name}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void addCandidate(candidate)}
                      disabled={addingId === candidate.accountId}
                    >
                      {addingId === candidate.accountId ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UserPlus className="size-4" aria-hidden />
                      )}
                      Tambah
                    </Button>
                  </li>
                ))}
              </ul>
            ) : query.trim().length >= 2 && !searching ? (
              <p className="text-sm text-muted-foreground">Tidak ada anggota aktif yang cocok.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Anggota janda maupun mitra non-janda yang berstatus aktif dapat dipilih sebagai panitia.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Hanya ketua panitia (pembuat event) yang dapat menambah anggota dan mengatur peran.
          </p>
        )}

        {!chair && members.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" aria-hidden />}
            title="Belum ada panitia"
            description="Tambahkan anggota untuk membantu mengelola event ini."
          />
        ) : (
          <ul className="divide-y divide-border">
            {chair ? (
              <li className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar name={chair.accountName} photo={chair.accountPhoto} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{chair.accountName}</p>
                    <p className="text-xs text-muted-foreground">Pembuat event</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  {COMMITTEE_ROLE_LABEL.ketua_panitia}
                </span>
              </li>
            ) : null}
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar name={member.accountName} photo={member.accountPhoto} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.accountName}</p>
                    <p className="text-xs text-muted-foreground">
                      {canEdit ? "Tetapkan peran panitia" : COMMITTEE_ROLE_LABEL[member.role] ?? member.role}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) => void changeRole(member.accountId, value)}
                      disabled={busyId === member.accountId}
                    >
                      <SelectTrigger className="h-9 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMITTEE_ASSIGNABLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {COMMITTEE_ROLE_LABEL[role] ?? role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                      {COMMITTEE_ROLE_LABEL[member.role] ?? member.role}
                    </span>
                  )}
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeCommittee(member)}
                      disabled={busyId === member.accountId}
                      className="text-rose-600 hover:text-rose-700"
                      aria-label={`Hapus ${member.accountName}`}
                    >
                      {busyId === member.accountId ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" aria-hidden />
                      )}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TicketsTab({ eventId, isPaid }: { eventId: string; isPaid: boolean }) {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<{ items: TicketRow[] }>("events.tickets.list", { eventId });
      setTickets(result.items);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingGrid count={3} />;
  if (error) return <ErrorNote message={error} onRetry={load} />;

  const validCount = tickets.filter((t) => t.status === "valid").length;
  const usedCount = tickets.filter((t) => t.status === "used").length;
  const pendingCount = tickets.filter((t) => t.status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Tiket peserta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center sm:p-3">
            <p className="text-xl font-bold text-emerald-700 sm:text-2xl">{validCount}</p>
            <p className="text-[10px] text-emerald-600 sm:text-xs">Berlaku</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 text-center sm:p-3">
            <p className="text-xl font-bold text-stone-600 sm:text-2xl">{usedCount}</p>
            <p className="text-[10px] text-stone-500 sm:text-xs">Sudah dipakai</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center sm:p-3">
            <p className="text-xl font-bold text-amber-700 sm:text-2xl">{pendingCount}</p>
            <p className="text-[10px] text-amber-600 sm:text-xs">Menunggu bayar</p>
          </div>
        </div>

        <Separator />

        {tickets.length === 0 ? (
          <EmptyState
            icon={<Ticket className="size-5" aria-hidden />}
            title="Belum ada tiket"
            description="Tiket akan muncul setelah peserta mendaftar atau membeli tiket."
          />
        ) : (
          <ul className="divide-y divide-border">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{ticket.attendeeName}</p>
                  <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{ticket.code}</code>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {isPaid ? formatRupiah(ticket.price) : ticket.ticketType === "free" ? "Gratis" : ticket.ticketType}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      ticket.status === "valid" && "bg-emerald-100 text-emerald-800",
                      ticket.status === "used" && "bg-stone-200 text-stone-700",
                      ticket.status === "pending" && "bg-amber-100 text-amber-800",
                      ticket.status === "cancelled" && "bg-rose-100 text-rose-800",
                    )}
                  >
                    {TICKET_STATUS_LABEL[ticket.status] ?? ticket.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(ticket.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentCheckins({ items }: { items: { name: string; at: string }[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Absensi terbaru</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Peserta yang diabsen pada sesi ini akan muncul di sini.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground">{timeAgo(item.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttendanceTab({ eventId }: { eventId: string }) {
  const [recentCheckins, setRecentCheckins] = useState<{ name: string; at: string }[]>([]);

  const onDecode = useCallback(
    async (raw: string) => {
      const parsed = parseTicketQrPayload(raw);
      if (!parsed) {
        return { ok: false, message: "Kode QR tidak dikenali sebagai tiket Panti Janda." };
      }
      if (parsed.eventId && parsed.eventId !== eventId) {
        return { ok: false, message: "Tiket ini diterbitkan untuk event lain." };
      }
      try {
        const result = await api<{ checkedIn: boolean; attendeeName: string }>("events.checkin", {
          code: parsed.code,
          eventId,
        });
        const name = result.attendeeName || "Peserta";
        toast.success(`Absensi berhasil untuk ${name}.`);
        setRecentCheckins((prev) => [{ name, at: new Date().toISOString() }, ...prev].slice(0, 20));
        return { ok: true, message: `Absensi berhasil: ${name}` };
      } catch (err) {
        const message = errorText(err);
        toast.error(message);
        return { ok: false, message };
      }
    },
    [eventId],
  );

  return (
    <QrScannerSection
      cameraTitle="Pindai QR tiket"
      cameraDescription="Arahkan kamera ke kode QR pada tiket digital peserta. Absensi tercatat otomatis."
      manualTitle="Absensi manual"
      manualDescription="Kamera tidak tersedia? Masukkan kode tiket yang tertera pada tiket peserta."
      manualLabel="Kode tiket"
      manualPlaceholder="PJ:xxxxxxxx:xxxxxxxx-xxxx"
      submitLabel="Absen peserta"
      onDecode={onDecode}
      manualFooter={<RecentCheckins items={recentCheckins} />}
    />
  );
}

function InvitationTab({ eventId }: { eventId: string }) {
  const [report, setReport] = useState<InvitationsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<{ name: string; at: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<InvitationsList>("events.invitations.list", { eventId });
      setReport(result);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "forbidden" ? "not_scanner" : errorText(err));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDecode = useCallback(
    async (raw: string) => {
      const parsed = parseInviteQrPayload(raw);
      if (!parsed) {
        return { ok: false, message: "Kode QR tidak dikenali sebagai undangan Panti Janda." };
      }
      if (parsed.eventId && parsed.eventId !== eventId) {
        return { ok: false, message: "Undangan ini diterbitkan untuk event lain." };
      }
      try {
        const result = await api<{ checkedIn: boolean; attendeeName: string }>("events.invitations.checkin", {
          eventId,
          inviteId: parsed.inviteId,
        });
        const name = result.attendeeName || "Tamu undangan";
        toast.success(`Kehadiran tercatat: ${name}.`);
        setRecentCheckins((prev) => [{ name, at: new Date().toISOString() }, ...prev].slice(0, 20));
        await load();
        return { ok: true, message: `Kehadiran tercatat: ${name}` };
      } catch (err) {
        const message = errorText(err);
        toast.error(message);
        return { ok: false, message };
      }
    },
    [eventId, load],
  );

  if (loading) return <LoadingGrid count={3} />;
  if (error === "not_scanner") {
    return (
      <EmptyState
        icon={<Mail className="size-5" aria-hidden />}
        title="Khusus panitia absen undangan"
        description="Hanya ketua panitia atau panitia dengan peran Absen Undangan yang dapat memindai undangan dan melihat daftar hadir tamu."
      />
    );
  }
  if (error || !report) return <ErrorNote message={error ?? "Gagal memuat daftar undangan."} onRetry={load} />;

  return (
    <div className="space-y-6">
      <QrScannerSection
        cameraTitle="Pindai QR undangan"
        cameraDescription="Arahkan kamera ke kode QR pada undangan digital tamu. Kehadiran tercatat langsung ke laporan."
        manualTitle="Input kode undangan"
        manualDescription="Kamera tidak tersedia? Tempel kode undangan dari QR tamu."
        manualLabel="Kode undangan"
        manualPlaceholder="PJ-INVITE:xxxxxxxx:xxxxxxxx"
        submitLabel="Catat kehadiran tamu"
        onDecode={onDecode}
        manualFooter={<RecentCheckins items={recentCheckins} />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Laporan daftar hadir undangan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-lg border border-border bg-secondary/40 p-2 text-center sm:p-3">
              <p className="text-xl font-bold text-foreground sm:text-2xl">{report.total}</p>
              <p className="text-[10px] text-muted-foreground sm:text-xs">Total undangan</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center sm:p-3">
              <p className="text-xl font-bold text-emerald-700 sm:text-2xl">{report.attendedCount}</p>
              <p className="text-[10px] text-emerald-600 sm:text-xs">Hadir</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center sm:p-3">
              <p className="text-xl font-bold text-amber-700 sm:text-2xl">{report.total - report.attendedCount}</p>
              <p className="text-[10px] text-amber-600 sm:text-xs">Belum hadir</p>
            </div>
          </div>

          {report.items.length === 0 ? (
            <EmptyState
              icon={<Mail className="size-5" aria-hidden />}
              title="Belum ada tamu undangan"
              description="Undangan yang dikirimkan kepada tamu akan muncul di sini beserta status kehadirannya."
            />
          ) : (
            <ul className="divide-y divide-border">
              {report.items.map((guest: InvitationItem) => (
                <li key={guest.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar name={guest.accountName} photo={guest.accountPhoto} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{guest.accountName}</p>
                      <p className="text-xs text-muted-foreground">
                        Diundang {guest.createdAt ? timeAgo(guest.createdAt) : "—"}
                      </p>
                    </div>
                  </div>
                  {guest.attendedAt ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="size-3.5" aria-hidden />
                      Hadir · {formatDateTime(guest.attendedAt)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      Belum hadir
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
