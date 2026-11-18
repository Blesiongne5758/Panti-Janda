import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarClock, Loader2, Plus, RefreshCw, Video } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { useRoute } from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Job = {
  id: string; title: string; company: string; description: string | null; jobType: string;
  salaryMin: number | null; salaryMax: number | null; salaryCurrency: string; remote: boolean;
  location: string | null; requirements: string | null; skills: string[]; applied?: boolean; status?: string;
};
type Application = {
  id: string; jobId: string; title: string; company: string; status: string;
  coverLetter: string | null; createdAt: string;
};
type CandidateApplication = {
  id: string; jobId: string; candidateAccountId: string; candidateName: string;
  coverLetter: string | null; status: string; createdAt: string;
};
type Interview = {
  id: string; jobId: string; jobTitle: string; company: string; applicationId: string;
  otherParticipantName: string; myRole: "employer" | "candidate"; mode: "online" | "onsite";
  scheduledStart: string; scheduledEnd: string; timezone: string; location: string | null; note: string | null; status: string;
};

const statusLabel: Record<string, string> = {
  pending: "Menunggu", reviewing: "Ditinjau", accepted: "Diterima", rejected: "Ditolak",
};

function salary(job: Job) {
  const fmt = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
  if (job.salaryMin == null && job.salaryMax == null) return "Gaji dibahas saat proses seleksi";
  if (job.salaryMin != null && job.salaryMax != null) return `${fmt(job.salaryMin)}–${fmt(job.salaryMax)}`;
  return job.salaryMin != null ? `Mulai ${fmt(job.salaryMin)}` : `Sampai ${fmt(job.salaryMax!)}`;
}

export default function JobsPage({ section = "browse", jobId }: { section?: "browse" | "create" | "mine" | "applications" | "interviews"; jobId?: string }) {
  const { account } = useAuth();
  const { navigate } = useRoute();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [received, setReceived] = useState<CandidateApplication[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState("full_time");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [remote, setRemote] = useState(true);
  const [location, setLocation] = useState("");
  const [requirements, setRequirements] = useState("");
  const [coverLetterFor, setCoverLetterFor] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [interviewMode, setInterviewMode] = useState<"online" | "onsite">("online");
  const [interviewStart, setInterviewStart] = useState("");
  const [interviewEnd, setInterviewEnd] = useState("");
  const [interviewLocation, setInterviewLocation] = useState("");
  const [interviewNote, setInterviewNote] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ items: Job[] }>("learning.jobs.list");
      setJobs(result.items ?? []);
      if (account) {
        const [mineResult, appliedResult] = await Promise.all([
          api<{ items: Job[] }>("learning.jobs.mine"),
          api<{ items: Application[] }>("learning.jobs.myApplications"),
        ]);
        setMyJobs(mineResult.items ?? []);
        setMyApplications(appliedResult.items ?? []);
        setSelectedJobId((current) => current || mineResult.items?.[0]?.id || "");
        const interviewResult = await api<{ items: Interview[] }>("job.interviews.list").catch(() => ({ items: [] as Interview[] }));
        setInterviews(interviewResult.items ?? []);
      } else {
        setMyJobs([]);
        setMyApplications([]);
        setInterviews([]);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!account || !selectedJobId || section !== "applications") { setReceived([]); return; }
    let active = true;
    void api<{ items: CandidateApplication[] }>("learning.jobs.applications", { jobId: selectedJobId })
      .then((result) => { if (active) setReceived(result.items ?? []); })
      .catch((err) => { if (active) toast.error(errorText(err)); });
    return () => { active = false; };
  }, [account, section, selectedJobId]);

  const visibleJobs = useMemo(() => jobId ? jobs.filter((job) => job.id === jobId) : jobs, [jobId, jobs]);

  async function createJob(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("learning.jobs.create", {
        title, company, description, jobType, remote,
        salaryMin: salaryMin || null, salaryMax: salaryMax || null,
        location: location || null, requirements: requirements || null,
      });
      toast.success("Lowongan berhasil dipublikasikan.");
      setTitle(""); setCompany(""); setDescription(""); setSalaryMin(""); setSalaryMax(""); setLocation(""); setRequirements("");
      await reload();
      navigate("/lowongan/saya");
    } catch (err) { toast.error(errorText(err)); }
    finally { setBusy(false); }
  }

  async function apply(job: Job) {
    setBusy(true);
    try {
      await api("learning.jobs.apply", { jobId: job.id, coverLetter: coverLetter.trim() });
      toast.success("Lamaran berhasil dikirim.");
      setCoverLetterFor(null); setCoverLetter("");
      await reload();
    } catch (err) { toast.error(errorText(err)); }
    finally { setBusy(false); }
  }

  async function updateJobStatus(job: Job) {
    const status = job.status === "closed" ? "active" : "closed";
    try {
      await api("learning.jobs.update", { id: job.id, status });
      setMyJobs((items) => items.map((item) => item.id === job.id ? { ...item, status } : item));
    } catch (err) { toast.error(errorText(err)); }
  }

  async function updateApplication(applicationId: string, status: "reviewing" | "accepted" | "rejected") {
    try {
      await api("learning.jobs.applicationStatus", { applicationId, status });
      setReceived((items) => items.map((item) => item.id === applicationId ? { ...item, status } : item));
      toast.success("Status lamaran diperbarui.");
    } catch (err) { toast.error(errorText(err)); }
  }

  async function scheduleInterview(applicationId: string) {
    if (!interviewStart || !interviewEnd) { toast.error("Lengkapi tanggal dan jam wawancara."); return; }
    if (interviewMode === "onsite" && !interviewLocation.trim()) { toast.error("Lokasi wawancara onsite wajib diisi."); return; }
    setBusy(true);
    try {
      await api("job.interviews.schedule", {
        applicationId, mode: interviewMode,
        scheduledStart: new Date(interviewStart).toISOString(), scheduledEnd: new Date(interviewEnd).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta",
        location: interviewMode === "onsite" ? interviewLocation.trim() : null,
        note: interviewNote.trim() || null,
      });
      toast.success("Jadwal wawancara dibuat dan kandidat diberi notifikasi.");
      setScheduleFor(null); setInterviewStart(""); setInterviewEnd(""); setInterviewLocation(""); setInterviewNote("");
      await reload();
    } catch (err) { toast.error(errorText(err)); }
    finally { setBusy(false); }
  }

  const heading = section === "create" ? "Buat lowongan" : section === "mine" ? "Lowongan saya" : section === "applications" ? "Lamaran kerja" : section === "interviews" ? "Jadwal wawancara" : "Lowongan kerja";
  const selectedJob = myJobs.find((job) => job.id === selectedJobId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-3 py-6 sm:px-4 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><BriefcaseBusiness className="size-7 text-primary" aria-hidden /><div><h1 className="font-display text-2xl font-semibold sm:text-3xl">{heading}</h1><p className="text-sm text-muted-foreground">Temukan peluang kerja atau hubungkan kandidat dengan pekerjaan yang sesuai.</p></div></div>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 size-4" />Muat ulang</Button>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Navigasi lowongan">
        <Button size="sm" variant={section === "browse" ? "default" : "outline"} onClick={() => navigate("/lowongan")}>Jelajahi</Button>
        {account ? <>
          <Button size="sm" variant={section === "create" ? "default" : "outline"} onClick={() => navigate("/lowongan/baru")}><Plus className="mr-1 size-4" />Buat lowongan</Button>
          <Button size="sm" variant={section === "mine" ? "default" : "outline"} onClick={() => navigate("/lowongan/saya")}>Lowongan saya</Button>
          <Button size="sm" variant={section === "applications" ? "default" : "outline"} onClick={() => navigate("/lowongan/lamaran")}>Lamaran</Button>
          <Button size="sm" variant={section === "interviews" ? "default" : "outline"} onClick={() => navigate("/lowongan/wawancara")}>Wawancara</Button>
        </> : null}
      </nav>

      {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      {section === "create" ? (
        <Card><CardHeader><CardTitle>Informasi pekerjaan</CardTitle><CardDescription>Lowongan yang dipublikasikan dapat dilihat oleh pencari kerja lain.</CardDescription></CardHeader><CardContent>
          {!account ? <p className="text-sm text-muted-foreground">Masuk untuk membuat lowongan.</p> : <form onSubmit={(event) => void createJob(event)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="job-title">Jabatan</Label><Input id="job-title" required minLength={3} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="job-company">Perusahaan</Label><Input id="job-company" required minLength={2} maxLength={120} value={company} onChange={(event) => setCompany(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="job-type">Jenis pekerjaan</Label><select id="job-type" value={jobType} onChange={(event) => setJobType(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="full_time">Penuh waktu</option><option value="part_time">Paruh waktu</option><option value="freelance">Lepas</option><option value="magang">Magang</option><option value="remote">Remote</option></select></div>
            <div className="flex items-center gap-2 pt-7"><input id="job-remote" type="checkbox" checked={remote} onChange={(event) => setRemote(event.target.checked)} /><Label htmlFor="job-remote">Bisa dikerjakan remote</Label></div>
            <div className="space-y-2"><Label htmlFor="job-location">Lokasi (opsional)</Label><Input id="job-location" maxLength={200} value={location} onChange={(event) => setLocation(event.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="salary-min">Gaji minimum</Label><Input id="salary-min" type="number" min="0" value={salaryMin} onChange={(event) => setSalaryMin(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="salary-max">Gaji maksimum</Label><Input id="salary-max" type="number" min="0" value={salaryMax} onChange={(event) => setSalaryMax(event.target.value)} /></div></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="job-description">Deskripsi</Label><Textarea id="job-description" required minLength={10} maxLength={5000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="job-requirements">Kualifikasi (opsional)</Label><Textarea id="job-requirements" maxLength={3000} rows={3} value={requirements} onChange={(event) => setRequirements(event.target.value)} /></div>
            <Button type="submit" disabled={busy} className="sm:col-span-2">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Publikasikan lowongan</Button>
          </form>}
        </CardContent></Card>
      ) : null}

      {section === "browse" ? <section className="space-y-3">
        {loading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin" /></div> : visibleJobs.length ? visibleJobs.map((job) => <Card key={job.id}><CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold">{job.title}</h2><p className="text-sm text-muted-foreground">{job.company} · {job.jobType.replaceAll("_", " ")}</p></div><div className="flex gap-2">{job.remote ? <Badge variant="outline">Remote</Badge> : null}<Badge variant="secondary">{salary(job)}</Badge></div></div>
          <p className="mt-3 whitespace-pre-line text-sm">{job.description}</p>
          {job.location ? <p className="mt-2 text-xs text-muted-foreground">Lokasi: {job.location}</p> : null}
          {job.requirements ? <p className="mt-2 text-sm text-muted-foreground">Kualifikasi: {job.requirements}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">{job.applied ? <Badge>Sudah dilamar</Badge> : account ? <Button size="sm" disabled={busy} onClick={() => { setCoverLetterFor(job.id); setCoverLetter(""); }}>Lamar sekarang</Button> : <Button size="sm" variant="outline" onClick={() => navigate("/masuk")}>Masuk untuk melamar</Button>}
            {coverLetterFor === job.id ? <div className="basis-full space-y-2"><Label htmlFor={`cover-${job.id}`}>Surat pengantar (opsional)</Label><Textarea id={`cover-${job.id}`} rows={3} maxLength={3000} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} /><div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void apply(job)}>Kirim lamaran</Button><Button size="sm" variant="ghost" onClick={() => setCoverLetterFor(null)}>Batal</Button></div></div> : null}</div>
        </CardContent></Card>) : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Belum ada lowongan aktif.</CardContent></Card>}
      </section> : null}

      {section === "mine" ? <section className="space-y-3">{loading ? <Loader2 className="mx-auto size-6 animate-spin" /> : myJobs.length ? myJobs.map((job) => <Card key={job.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><h2 className="font-semibold">{job.title}</h2><p className="text-sm text-muted-foreground">{job.company}</p></div><div className="flex items-center gap-2"><Badge variant={job.status === "closed" ? "secondary" : "outline"}>{job.status === "closed" ? "Ditutup" : "Aktif"}</Badge><Button size="sm" variant="outline" onClick={() => void updateJobStatus(job)}>{job.status === "closed" ? "Aktifkan" : "Tutup"}</Button><Button size="sm" onClick={() => { setSelectedJobId(job.id); navigate("/lowongan/lamaran"); }}>Lihat lamaran</Button></div></CardContent></Card>) : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Anda belum membuat lowongan.</CardContent></Card>}</section> : null}

      {section === "interviews" ? <section className="space-y-3">
        {interviews.length ? interviews.map((interview) => <Card key={interview.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><h2 className="font-semibold">{interview.jobTitle}</h2><p className="text-sm text-muted-foreground">{interview.company} · {interview.otherParticipantName} ({interview.myRole === "candidate" ? "pemberi kerja" : "kandidat"})</p><p className="mt-1 text-xs text-muted-foreground">{new Date(interview.scheduledStart).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: interview.timezone })} · {interview.timezone} · {interview.mode === "online" ? "Online" : `Onsite${interview.location ? ` · ${interview.location}` : ""}`}</p>{interview.note ? <p className="mt-1 text-xs text-muted-foreground">{interview.note}</p> : null}</div>
          {interview.mode === "online" ? <Button size="sm" onClick={() => navigate(`/lowongan/wawancara/${interview.id}`)}><Video className="mr-1 size-4" />Ruang wawancara</Button> : null}
        </CardContent></Card>) : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Belum ada jadwal wawancara.</CardContent></Card>}
      </section> : null}

      {section === "applications" ? <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Lamaran yang saya kirim</CardTitle><CardDescription>Status lamaran dan undangan wawancara.</CardDescription></CardHeader><CardContent className="space-y-3">
          {myApplications.length ? myApplications.map((app) => {
            const interview = interviews.find((item) => item.applicationId === app.id);
            return <div key={app.id} className="rounded-lg border p-3"><p className="font-medium">{app.title}</p><p className="text-xs text-muted-foreground">{app.company} · {new Date(app.createdAt).toLocaleDateString("id-ID")}</p><Badge className="mt-2" variant="secondary">{statusLabel[app.status] ?? app.status}</Badge>
              {interview ? <div className="mt-3 rounded-md bg-secondary/40 p-3"><p className="text-sm font-medium"><CalendarClock className="mr-1 inline size-4" aria-hidden />Wawancara {interview.mode === "online" ? "online" : "onsite"}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(interview.scheduledStart).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: interview.timezone })} · {interview.timezone}</p>{interview.location ? <p className="text-xs text-muted-foreground">Lokasi: {interview.location}</p> : null}{interview.mode === "online" ? <Button className="mt-2" size="sm" onClick={() => navigate(`/lowongan/wawancara/${interview.id}`)}><Video className="mr-1 size-4" />Buka ruang wawancara</Button> : null}</div> : null}
            </div>;
          }) : <p className="text-sm text-muted-foreground">Belum ada lamaran yang dikirim.</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Lamaran pada lowongan saya</CardTitle><CardDescription>{selectedJob ? `${selectedJob.title} · ${selectedJob.company}` : "Pilih lowongan yang Anda kelola."}</CardDescription></CardHeader><CardContent className="space-y-3">
          {myJobs.length ? <select aria-label="Pilih lowongan" value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{myJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select> : <p className="text-sm text-muted-foreground">Buat lowongan terlebih dahulu untuk menerima lamaran.</p>}
          {received.length ? received.map((app) => {
            const interview = interviews.find((item) => item.applicationId === app.id);
            return <div key={app.id} className="rounded-lg border p-3"><p className="font-medium">{app.candidateName}</p><p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{app.coverLetter || "Tidak ada surat pengantar."}</p><Badge variant="secondary" className="mt-2">{statusLabel[app.status] ?? app.status}</Badge>
              <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void updateApplication(app.id, "reviewing")}>Tinjau</Button><Button size="sm" onClick={() => void updateApplication(app.id, "accepted")}>Terima</Button><Button size="sm" variant="destructive" onClick={() => void updateApplication(app.id, "rejected")}>Tolak</Button></div>
              {interview ? <div className="mt-3 rounded-md bg-secondary/40 p-3"><p className="text-sm font-medium">Wawancara {interview.mode === "online" ? "online" : "onsite"}</p><p className="text-xs text-muted-foreground">{new Date(interview.scheduledStart).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: interview.timezone })} · {interview.timezone}</p>{interview.mode === "online" ? <Button className="mt-2" size="sm" onClick={() => navigate(`/lowongan/wawancara/${interview.id}`)}><Video className="mr-1 size-4" />Buka ruang wawancara</Button> : interview.location ? <p className="text-xs text-muted-foreground">Lokasi: {interview.location}</p> : null}</div> : <>
                {scheduleFor === app.id ? <div className="mt-3 space-y-3 rounded-md border p-3"><div className="space-y-1"><Label>Jenis wawancara</Label><select value={interviewMode} onChange={(e) => setInterviewMode(e.target.value as "online" | "onsite")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="online">Online</option><option value="onsite">Onsite</option></select></div><div className="grid gap-2 sm:grid-cols-2"><div className="space-y-1"><Label>Mulai</Label><Input type="datetime-local" value={interviewStart} onChange={(e) => setInterviewStart(e.target.value)} /></div><div className="space-y-1"><Label>Selesai</Label><Input type="datetime-local" value={interviewEnd} onChange={(e) => setInterviewEnd(e.target.value)} /></div></div>{interviewMode === "onsite" ? <div className="space-y-1"><Label>Alamat/lokasi</Label><Input value={interviewLocation} maxLength={300} onChange={(e) => setInterviewLocation(e.target.value)} /></div> : null}<div className="space-y-1"><Label>Catatan (opsional)</Label><Textarea value={interviewNote} maxLength={1000} rows={2} onChange={(e) => setInterviewNote(e.target.value)} /></div><div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void scheduleInterview(app.id)}>Jadwalkan & beri tahu kandidat</Button><Button size="sm" variant="ghost" onClick={() => setScheduleFor(null)}>Batal</Button></div></div> : <Button className="mt-3" size="sm" variant="outline" onClick={() => setScheduleFor(app.id)}><CalendarClock className="mr-1 size-4" />Jadwalkan wawancara</Button>}
              </>}
            </div>;
          }) : selectedJob ? <p className="text-sm text-muted-foreground">Belum ada lamaran untuk lowongan ini.</p> : null}
        </CardContent></Card>
      </div> : null}
    </main>
  );
}
