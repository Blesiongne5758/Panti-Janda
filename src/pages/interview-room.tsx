import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, Loader2, Video } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { useRoute } from "@/lib/router";
import { useVoiceCall } from "@/lib/call-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type InterviewRoom = {
  id: string;
  jobTitle: string;
  company: string;
  mode: "online" | "onsite";
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  location: string | null;
  note: string | null;
  status: string;
  myRole: "employer" | "candidate";
  otherParticipantName: string;
  otherParticipantId: string;
  canJoin: boolean;
};

export default function InterviewRoomPage({ interviewId }: { interviewId: string }) {
  const { account } = useAuth();
  const { navigate } = useRoute();
  const { callState, incomingCall, startCall } = useVoiceCall();
  const [interview, setInterview] = useState<InterviewRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!account) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await api<{ interview: InterviewRoom }>("job.interviews.get", { id: interviewId });
      setInterview(result.interview);
    } catch (err) {
      setError(errorText(err));
      setInterview(null);
    } finally { setLoading(false); }
  }, [account, interviewId]);

  useEffect(() => { void load(); }, [load]);

  async function joinRoom() {
    if (!interview || !account || busy) return;
    setBusy(true);
    try {
      const authorization = await api<{ authorized: boolean; recipientAccountId: string; mode: "video" }>("job.interviews.join", { id: interview.id });
      if (!authorization.authorized || authorization.mode !== "video" || authorization.recipientAccountId !== interview.otherParticipantId) {
        throw new Error("Akses ruang wawancara tidak tersedia.");
      }
      await startCall({ accountId: authorization.recipientAccountId, name: interview.otherParticipantName, photoData: null }, "video", { interviewId: interview.id });
    } catch (err) { toast.error(errorText(err)); }
    finally { setBusy(false); }
  }

  const activeCall = callState?.interviewId === interviewId;
  const incomingForInterview = incomingCall?.interviewId === interviewId;

  if (!account) return <main className="mx-auto max-w-3xl px-4 py-10"><Card><CardContent className="space-y-3 p-6"><p>Masuk untuk melihat ruang wawancara.</p><Button onClick={() => navigate("/masuk")}>Masuk</Button></CardContent></Card></main>;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3 py-6 sm:px-4 sm:py-10">
      <Button variant="ghost" className="w-fit" onClick={() => navigate("/lowongan/wawancara")}><ArrowLeft className="mr-2 size-4" />Kembali ke jadwal wawancara</Button>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin" /></div> : error || !interview ? (
        <Card><CardContent className="space-y-3 p-6"><p role="alert" className="text-sm text-destructive">{error || "Jadwal wawancara tidak ditemukan atau Anda bukan pesertanya."}</p><Button variant="outline" onClick={() => navigate("/lowongan/wawancara")}>Lihat jadwal saya</Button></CardContent></Card>
      ) : interview.mode !== "online" ? (
        <Card><CardHeader><CardTitle>Wawancara onsite</CardTitle><CardDescription>Wawancara ini berlangsung langsung di lokasi.</CardDescription></CardHeader><CardContent className="space-y-2"><p>{interview.location}</p><Button variant="outline" onClick={() => navigate("/lowongan/wawancara")}>Kembali ke jadwal</Button></CardContent></Card>
      ) : (
        <>
          <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle>Ruang wawancara</CardTitle><CardDescription>{interview.jobTitle} · {interview.company}</CardDescription></div><Badge variant={interview.canJoin ? "default" : "secondary"}>{interview.status === "scheduled" ? "Terjadwal" : interview.status}</Badge></div></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-secondary/30 p-4"><p className="font-medium">Dengan {interview.otherParticipantName}</p><p className="mt-1 text-sm text-muted-foreground"><CalendarClock className="mr-1 inline size-4" />{new Date(interview.scheduledStart).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: interview.timezone })} ({interview.timezone})</p>{interview.note ? <p className="mt-2 whitespace-pre-line text-sm">{interview.note}</p> : null}</div>
              {activeCall ? <p role="status" className="text-sm text-emerald-700">Panggilan video wawancara sedang berlangsung. Gunakan kontrol video di layar untuk mengatur kamera, mikrofon, atau mengakhiri panggilan.</p> : incomingForInterview ? <p role="status" className="text-sm">Panggilan wawancara masuk. Terima melalui dialog panggilan video.</p> : interview.canJoin ? <div className="space-y-2"><Button disabled={busy} onClick={() => void joinRoom()}><Video className="mr-2 size-4" />{busy ? "Menghubungkan…" : "Gabung wawancara video"}</Button><p className="text-xs text-muted-foreground">Browser akan meminta izin kamera dan mikrofon saat Anda bergabung. Akses hanya untuk kandidat dan pemberi kerja yang tercantum.</p></div> : <p className="text-sm text-muted-foreground">Ruang belum dapat dimasuki. Ruang dibuka 30 menit sebelum jadwal dan berakhir paling lama 4 jam setelah waktu selesai.</p>}
            </CardContent>
          </Card>
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Jika panggilan terputus, muat ulang halaman ini dan gabung kembali selama jendela jadwal masih aktif.</CardContent></Card>
        </>
      )}
    </main>
  );
}
