import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  Loader2,
  QrCode,
  Ticket,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link, useRoute } from "@/lib/router";
import { formatDateTime, formatRupiah, timeAgo } from "@/lib/format";
import { ROLE_RANK, TICKET_STATUS_LABEL } from "@/lib/constants";
import type { EventCommittee, EventDetail, EventItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { EmptyState, ErrorNote, LoadingGrid } from "@/components/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "panitia" | "tiket" | "absensi";

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

export default function EventManagePage({ id }: { id: string }) {
  const { account } = useAuth();
  const { navigate } = useRoute();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const [data, setData] = useState<EventDetail["event"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("panitia");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<EventDetail>("events.get", { id });
      setData(result.event);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
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

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <ErrorNote message="Anda tidak memiliki akses untuk mengelola event ini." onRetry={() => navigate("/event")} />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "panitia", label: "Panitia", icon: Users },
    { key: "tiket", label: "Tiket", icon: Ticket },
    { key: "absensi", label: "Absensi", icon: ClipboardCheck },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to={`/event/${id}`}>
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke detail event
        </Link>
      </Button>

      <div>
        <h1 className="font-display text-2xl font-bold">{data.title}</h1>
        <p className="text-sm text-muted-foreground">Kelola panitia, tiket, dan absensi peserta.</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-secondary/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "panitia" ? <CommitteeTab eventId={id} committees={data.committees} onReload={load} /> : null}
      {tab === "tiket" ? <TicketsTab eventId={id} isPaid={Boolean(data.ticketPrice)} /> : null}
      {tab === "absensi" ? <AttendanceTab eventId={id} /> : null}
    </div>
  );
}

function CommitteeTab({
  eventId,
  committees,
  onReload,
}: {
  eventId: string;
  committees: EventCommittee[];
  onReload: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("panitia");
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const addCommittee = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api("events.committee.add", { eventId, email: email.trim(), role });
      toast.success("Panitia ditambahkan.");
      setEmail("");
      await onReload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const removeCommittee = async (accountId: string) => {
    if (!window.confirm("Hapus anggota panitia ini?")) return;
    setRemovingId(accountId);
    try {
      await api("events.committee.remove", { eventId, accountId });
      toast.success("Panitia dihapus.");
      await onReload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Panitia event ({committees.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium">Tambah panitia baru</p>
          <div className="space-y-2">
            <Label htmlFor="cm-email">Email anggota</Label>
            <Input
              id="cm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="anggota@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cm-role">Peran</Label>
            <Input
              id="cm-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="koordinator, logistik, dll."
            />
          </div>
          <Button onClick={addCommittee} disabled={busy || !email.trim()} size="sm">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" aria-hidden />}
            Tambahkan
          </Button>
        </div>

        {committees.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" aria-hidden />}
            title="Belum ada panitia"
            description="Tambahkan anggota untuk membantu mengelola event ini."
          />
        ) : (
          <ul className="divide-y divide-border">
            {committees.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{member.accountName}</p>
                  <p className="text-xs capitalize text-muted-foreground">{member.role.replace(/_/g, " ")}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCommittee(member.accountId)}
                  disabled={removingId === member.accountId}
                  className="text-rose-600 hover:text-rose-700"
                >
                  {removingId === member.accountId ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" aria-hidden />
                  )}
                </Button>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Peserta</th>
                  <th className="pb-2 pr-4">Kode</th>
                  <th className="pb-2 pr-4">{isPaid ? "Harga" : "Jenis"}</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Terbit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="py-2.5 pr-4 font-medium">{ticket.attendeeName}</td>
                    <td className="py-2.5 pr-4">
                      <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{ticket.code}</code>
                    </td>
                    <td className="py-2.5 pr-4">
                      {isPaid ? formatRupiah(ticket.price) : ticket.ticketType === "free" ? "Gratis" : ticket.ticketType}
                    </td>
                    <td className="py-2.5 pr-4">
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
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{timeAgo(ticket.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttendanceTab({ eventId }: { eventId: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [recentCheckins, setRecentCheckins] = useState<{ name: string; at: string }[]>([]);

  const checkin = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const result = await api<{ checkedIn: boolean; attendeeName: string }>("events.checkin", {
        code: code.trim(),
        eventId,
      });
      toast.success(`Absensi berhasil untuk ${result.attendeeName}.`);
      setRecentCheckins((prev) => [{ name: result.attendeeName, at: new Date().toISOString() }, ...prev].slice(0, 20));
      setCode("");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <QrCode className="size-5" aria-hidden />
            Absensi manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Masukkan kode tiket yang tertera pada tiket peserta, atau pindai kode QR tiket untuk melakukan absensi.
          </p>
          <div className="space-y-2">
            <Label htmlFor="checkin-code">Kode tiket</Label>
            <Input
              id="checkin-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PJ:xxxxxxxx:xxxxxxxx-xxxx"
              onKeyDown={(e) => {
                if (e.key === "Enter") void checkin();
              }}
            />
          </div>
          <Button onClick={() => void checkin()} disabled={busy || !code.trim()} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" aria-hidden />}
            Absen peserta
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Absensi terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCheckins.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="size-5" aria-hidden />}
              title="Belum ada absensi"
              description="Peserta yang diabsen akan muncul di sini."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentCheckins.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(item.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
