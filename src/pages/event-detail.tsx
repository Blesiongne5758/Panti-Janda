import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Coins,
  Loader2,
  MapPin,
  QrCode,
  Send,
  Settings2,
  Ticket,
  Users,
  XCircle,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link, useRoute } from "@/lib/router";
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format";
import { AUDIENCE_META, ROLE_RANK, TICKET_STATUS_LABEL } from "@/lib/constants";
import type { EventCommittee, EventDetail, EventTicket } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MemberAvatar } from "@/components/common";
import { ErrorNote, LoadingGrid } from "@/components/common";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function EventDetailPage({ id }: { id: string }) {
  const { account } = useAuth();
  const { navigate } = useRoute();
  const rank = account ? ROLE_RANK[account.role] : 0;
  const [data, setData] = useState<EventDetail["event"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

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
              Kembali ke daftar event
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const cancelled = data.status === "cancelled";
  const isPast = new Date(data.startsAt).getTime() < Date.now();
  const isOwner = account?.id === data.createdBy;
  const canManage = isOwner || data.isCommittee || rank >= 4;
  const canInvite = data.audience === "undangan" && (isOwner || rank >= 4);
  const isPaid = Boolean(data.ticketPrice);

  const toggleRsvp = async () => {
    setBusy(true);
    try {
      const going = data.myRsvp !== "going";
      await api("events.rsvp", { id: data.id, going });
      await load();
      toast.success(going ? "Kehadiranmu tercatat." : "Kehadiran dibatalkan.");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const buyTicket = async () => {
    setBusy(true);
    try {
      const result = await api<{ paymentUrl: string | null; orderId: string }>("events.tickets.buy", {
        id: data.id,
      });
      if (result.paymentUrl) {
        window.open(result.paymentUrl, "_blank");
        toast.info("Selesaikan pembayaran di jendela yang terbuka.");
      } else {
        toast.success("Tiket berhasil dibuat. Silakan selesaikan pembayaran.");
      }
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api("events.invite", { id: data.id, email: inviteEmail.trim() });
      setInviteEmail("");
      await load();
      toast.success("Undangan terkirim ke anggota tersebut.");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setInviting(false);
    }
  };

  const cancelEvent = async () => {
    if (!window.confirm("Batalkan event ini? Peserta tidak bisa lagi konfirmasi kehadiran.")) return;
    setBusy(true);
    try {
      await api("events.cancel", { id: data.id });
      toast.success("Event dibatalkan.");
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/event">
          <ArrowLeft className="size-4" aria-hidden />
          Semua event
        </Link>
      </Button>

      <Card className={cn(cancelled && "opacity-75")}>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                data.audience === "umum" && "bg-emerald-100 text-emerald-900",
                data.audience === "anggota" && "bg-indigo-100 text-indigo-900",
                data.audience === "undangan" && "bg-amber-100 text-amber-900",
              )}
            >
              {AUDIENCE_META[data.audience].label}
            </span>
            {isPaid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-900">
                <Ticket className="size-3" aria-hidden />
                {formatRupiah(data.ticketPrice)}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900">
                Gratis
              </span>
            )}
            {cancelled ? (
              <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-900">
                Dibatalkan
              </span>
            ) : null}
          </div>
          <CardTitle className="font-display text-2xl">{data.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{AUDIENCE_META[data.audience].hint}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{data.description}</p>
          ) : null}
          <Separator />
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            <li className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              Mulai {formatDateTime(data.startsAt)}
            </li>
            {data.endsAt ? (
              <li className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4 shrink-0" aria-hidden />
                Selesai {formatDateTime(data.endsAt)}
              </li>
            ) : null}
            {data.location ? (
              <li className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4 shrink-0" aria-hidden />
                {data.location}
              </li>
            ) : null}
            <li className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4 shrink-0" aria-hidden />
              {data.goingCount} akan hadir{data.capacity ? ` · kuota ${data.capacity}` : ""}
            </li>
            {data.fundingTarget ? (
              <li className="flex items-center gap-2 text-muted-foreground">
                <Coins className="size-4 shrink-0" aria-hidden />
                Target dana {formatRupiah(data.fundingTarget)}
              </li>
            ) : null}
            <li className="flex items-center gap-2 text-muted-foreground">
              <QrCode className="size-4 shrink-0" aria-hidden />
              {data.attendanceCount} sudah absen
            </li>
          </ul>
          {data.creatorName ? (
            <p className="text-xs text-muted-foreground">Digagas oleh {data.creatorName}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            {rank >= 1 ? (
              isPaid ? (
                data.myTicket ? (
                  <Button variant="outline" disabled={cancelled || isPast}>
                    <Ticket className="size-4" aria-hidden />
                    Tiket: {TICKET_STATUS_LABEL[data.myTicket.status] ?? data.myTicket.status}
                  </Button>
                ) : (
                  <Button onClick={buyTicket} disabled={busy || cancelled || isPast}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Ticket className="size-4" aria-hidden />}
                    Beli tiket {formatRupiah(data.ticketPrice!)}
                  </Button>
                )
              ) : (
                <Button
                  onClick={toggleRsvp}
                  disabled={busy || cancelled || isPast}
                  variant={data.myRsvp === "going" ? "outline" : "default"}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  {cancelled
                    ? "Event dibatalkan"
                    : isPast
                      ? "Sudah berlalu"
                      : data.myRsvp === "going"
                        ? "Batalkan kehadiran"
                        : "Saya akan hadir"}
                </Button>
              )
            ) : (
              <Button asChild variant="outline">
                <Link to="/masuk">Masuk untuk {isPaid ? "membeli tiket" : "konfirmasi kehadiran"}</Link>
              </Button>
            )}
            {canManage && !cancelled ? (
              <>
                <Button asChild variant="outline">
                  <Link to={`/event/${data.id}/kelola`}>
                    <Settings2 className="size-4" aria-hidden />
                    Kelola event
                  </Link>
                </Button>
                {(isOwner || rank >= 4) ? (
                  <Button variant="outline" onClick={cancelEvent} disabled={busy}>
                    <XCircle className="size-4" aria-hidden />
                    Batalkan event
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {data.myTicket ? <MyTicketCard ticket={data.myTicket} isPaid={isPaid} /> : null}

      {data.committees.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Panitia ({data.committees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-3">
              {data.committees.map((member: EventCommittee) => (
                <li
                  key={member.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <MemberAvatar name={member.accountName} tier="wonder_woman" size={28} photoData={member.accountPhoto} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.accountName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role.replace(/_/g, " ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Akan hadir ({data.attendees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.attendees.length ? (
              <ul className="flex flex-wrap gap-2">
                {data.attendees.map((name, index) => (
                  <li
                    key={`${name}-${index}`}
                    className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada yang konfirmasi kehadiran.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Tamu undangan ({data.invited.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.invited.length ? (
              <ul className="flex flex-wrap gap-2">
                {data.invited.map((name, index) => (
                  <li
                    key={`${name}-${index}`}
                    className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada tamu yang diundang.</p>
            )}
            {canInvite ? (
              <div className="space-y-2 border-t border-border pt-4">
                <Label htmlFor="invite-email">Undang anggota lewat email</Label>
                <div className="flex gap-2">
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="anggota@email.com"
                  />
                  <Button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" aria-hidden />}
                    Undang
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Undangan hanya berlaku untuk anggota janda terverifikasi yang sudah memiliki akun.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Terakhir diperbarui {formatDate(data.createdAt)} ·{" "}
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => navigate("/event")}
        >
          lihat semua event
        </button>
      </p>
    </div>
  );
}

function MyTicketCard({ ticket, isPaid }: { ticket: EventTicket; isPaid: boolean }) {
  const statusLabel = TICKET_STATUS_LABEL[ticket.status] ?? ticket.status;
  return (
    <Card className="border-violet-200 bg-violet-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-lg text-violet-900">
          <Ticket className="size-5" aria-hidden />
          Tiket Saya
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-violet-900">Kode: <span className="font-mono">{ticket.code}</span></p>
            <p className="text-xs text-violet-700">
              {ticket.ticketType === "free" ? "Tiket gratis" : `Tiket berbayar — ${formatRupiah(ticket.price)}`}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              ticket.status === "valid" && "bg-emerald-100 text-emerald-900",
              ticket.status === "used" && "bg-stone-200 text-stone-700",
              ticket.status === "pending" && "bg-amber-100 text-amber-900",
              ticket.status === "cancelled" && "bg-rose-100 text-rose-900",
            )}
          >
            {statusLabel}
          </span>
        </div>
        {ticket.status === "valid" ? (
          <p className="text-xs text-violet-700">
            Tunjukkan kode tiket ini saat absensi di lokasi event. Panitia akan memindai kode QR Anda.
          </p>
        ) : ticket.status === "pending" && isPaid ? (
          <p className="text-xs text-amber-800">
            Selesaikan pembayaran untuk mengaktifkan tiket Anda.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
