import { useState, useEffect } from "react";
import {
  Award,
  BookOpen,
  Briefcase,
  Download,
  GraduationCap,
  Headphones,
  Heart,
  Lock,
  Play,
  Rocket,
  Scale,
  Shield,
  Star,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/lib/router";

interface LearningModule {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string | null;
  durationMinutes: number;
  totalLessons: number;
  icon: string | null;
  color: string | null;
  bgColor: string | null;
  monetizable: boolean;
  downloadable: boolean;
}

interface Podcast {
  id: string;
  title: string;
  description: string | null;
  hostName: string;
  durationSeconds: number;
  category: string;
}

interface SuccessStory {
  id: string;
  title: string;
  story: string;
  achievement: string | null;
  authorName: string | null;
  authorTier: string | null;
}

interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isPrivate: boolean;
  moderated: boolean;
}

interface FinancialModule {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  description: string | null;
}

interface LegalModule {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  description: string | null;
}

interface JobListing {
  id: string;
  title: string;
  company: string;
  description: string | null;
  jobType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  remote: boolean;
  applied: boolean;
}

interface IncubationProgram {
  id: string;
  title: string;
  description: string | null;
  totalSteps: number;
}

interface LearningBadge {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  category: string;
  earned: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp: TrendingUp,
  BookOpen: BookOpen,
  Star: Star,
  Heart: Heart,
  Rocket: Rocket,
  Briefcase: Briefcase,
  Wallet: Wallet,
  Headphones: Headphones,
  Award: Award,
  Target: Target,
  Users: Users,
  Scale: Scale,
  Shield: Shield,
  Lock: Lock,
  Download: Download,
  Play: Play,
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} jam ${remainingMinutes} menit`;
}

function formatSalary(min: number | null, max: number | null, currency: string): string {
  if (min === null && max === null) return "Hubungi perusahaan";
  const fmt = (n: number) => `${currency === "IDR" ? "Rp" : currency}${n.toLocaleString("id-ID")}`;
  if (min !== null && max !== null) return `${fmt(min)}-${fmt(max)}`;
  if (min !== null) return `Mulai ${fmt(min)}`;
  return `Sampai ${fmt(max!)}`;
}

export default function LearningCenter() {
  const [activeTab, setActiveTab] = useState("micro-learning");
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [stories, setStories] = useState<SuccessStory[]>([]);
  const [forumCategories, setForumCategories] = useState<ForumCategory[]>([]);
  const [financialModules, setFinancialModules] = useState<FinancialModule[]>([]);
  const [legalModules, setLegalModules] = useState<LegalModule[]>([]);
  const [jobListings, setJobListings] = useState<JobListing[]>([]);
  const [incubationPrograms, setIncubationPrograms] = useState<IncubationProgram[]>([]);
  const [badges, setBadges] = useState<LearningBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [modulesRes, podcastsRes, storiesRes, forumRes, financialRes, legalRes, jobsRes, incubationRes, badgesRes] = await Promise.all([
          api<{ items: LearningModule[] }>("learning.modules.list").catch(() => ({ items: [] })),
          api<{ items: Podcast[] }>("learning.podcasts.list").catch(() => ({ items: [] })),
          api<{ items: SuccessStory[] }>("learning.stories.list").catch(() => ({ items: [] })),
          api<{ items: ForumCategory[] }>("learning.forum.categories").catch(() => ({ items: [] })),
          api<{ items: FinancialModule[] }>("learning.financial.list").catch(() => ({ items: [] })),
          api<{ items: LegalModule[] }>("learning.legal.list").catch(() => ({ items: [] })),
          api<{ items: JobListing[] }>("learning.jobs.list").catch(() => ({ items: [] })),
          api<{ items: IncubationProgram[] }>("learning.incubation.list").catch(() => ({ items: [] })),
          api<{ items: LearningBadge[] }>("learning.badges.list").catch(() => ({ items: [] })),
        ]);
        if (active) {
          setModules(modulesRes.items);
          setPodcasts(podcastsRes.items);
          setStories(storiesRes.items);
          setForumCategories(forumRes.items);
          setFinancialModules(financialRes.items);
          setLegalModules(legalRes.items);
          setJobListings(jobsRes.items);
          setIncubationPrograms(incubationRes.items);
          setBadges(badgesRes.items);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-6 sm:gap-6 sm:px-4 sm:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <GraduationCap className="size-6 text-primary" aria-hidden />
        <h1 className="font-display text-3xl font-semibold">Learning Center</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Pusat pembelajaran fleksibel untuk wanita — belajar sesuai waktumu, kembangkan skill yang bisa langsung menghasilkan.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="micro-learning" className="text-xs sm:text-sm">Micro-Learning</TabsTrigger>
          <TabsTrigger value="komunitas" className="text-xs sm:text-sm">Komunitas</TabsTrigger>
          <TabsTrigger value="literasi" className="text-xs sm:text-sm">Literasi</TabsTrigger>
          <TabsTrigger value="monetisasi" className="text-xs sm:text-sm">Monetisasi</TabsTrigger>
          <TabsTrigger value="gamifikasi" className="text-xs sm:text-sm">Reward</TabsTrigger>
          <TabsTrigger value="keamanan" className="text-xs sm:text-sm">Keamanan</TabsTrigger>
        </TabsList>

        {/* MICRO-LEARNING */}
        <TabsContent value="micro-learning" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <BookOpen className="size-5 text-blue-600" aria-hidden />
                Pembelajaran Mikro — "Siap Jual"
              </CardTitle>
              <CardDescription>
                Video & materi pendek 5-15 menit. Fokus pada keahlian yang bisa langsung dimonetisasi dengan modal minim.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="h-32" />
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {modules.map((mod) => {
                    const Icon = (mod.icon && ICON_MAP[mod.icon]) || BookOpen;
                    return (
                      <Card key={mod.id} className="transition-shadow hover:shadow-md">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="rounded-lg p-2" style={{ backgroundColor: mod.bgColor ?? "#dbeafe" }}>
                              <Icon className="size-5" style={{ color: mod.color ?? "#2563eb" }} aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold">{mod.title}</p>
                              <Badge variant="secondary" className="mt-1 text-[10px]">{mod.category}</Badge>
                            </div>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">{mod.description}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Play className="size-3" aria-hidden /> {mod.totalLessons} video
                            </span>
                            <span>·</span>
                            <span>{formatDuration(mod.durationMinutes * 60)}</span>
                            {mod.monetizable ? (
                              <>
                                <span>·</span>
                                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">Siap Jual</Badge>
                              </>
                            ) : null}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="text-xs">
                              <Play className="mr-1 size-3" aria-hidden /> Mulai
                            </Button>
                            {mod.downloadable && (
                              <Button size="sm" variant="ghost" className="text-xs">
                                <Download className="mr-1 size-3" aria-hidden /> Unduh
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Headphones className="size-5 text-purple-600" aria-hidden />
                Podcast — Dengar Sambil Bekerja
              </CardTitle>
              <CardDescription>
                Tips bisnis, motivasi, dan soft skills dalam format audio. Cocok didengar saat memasak, menyetir, atau beristirahat.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl border border-border" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-3">
                  {podcasts.map((pod) => (
                    <li key={pod.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                      <div className="rounded-lg bg-purple-50 p-2">
                        <Headphones className="size-4 text-purple-600" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{pod.title}</p>
                        <p className="text-xs text-muted-foreground">oleh {pod.hostName} · {formatDuration(pod.durationSeconds)}</p>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs">
                        <Play className="mr-1 size-3" aria-hidden /> Dengar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <Download className="size-8 text-blue-600" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Mode Offline</p>
                <p className="text-xs text-muted-foreground">
                  Unduh materi untuk dipelajari tanpa kuota internet. Tersedia untuk semua modul video dan podcast.
                </p>
              </div>
              <Button size="sm" variant="outline" className="text-xs">
                Kelola Unduhan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KOMUNITAS & DUKUNGAN EMOSIONAL */}
        <TabsContent value="komunitas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Heart className="size-5 text-rose-600" aria-hidden />
                Forum Komunitas
              </CardTitle>
              <CardDescription>
                Grup diskusi tertutup dan termoderasi. Berbagi pengalaman, curhat, atau bertanya tanpa takut dihakimi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="h-24" />
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {forumCategories.map((cat) => (
                    <Card key={cat.id} className="border-rose-200">
                      <CardContent className="p-4">
                        <p className="text-sm font-semibold">{cat.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
                        <Badge variant="secondary" className="mt-2 text-[10px]">
                          {cat.isPrivate ? "Tertutup" : "Terbuka"} {cat.moderated ? "· Termoderasi" : ""}
                        </Badge>
                        <Button size="sm" className="mt-3 w-full text-xs">Masuk Forum</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Star className="size-5 text-amber-600" aria-hidden />
                Kisah Inspiratif (Success Stories)
              </CardTitle>
              <CardDescription>
                "Jika dia bisa, saya juga bisa." Baca perjalanan wanita janda lain yang telah sukses mandiri.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl border border-border" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-4">
                  {stories.map((story) => (
                    <li key={story.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{story.authorName ?? "Anonim"}</p>
                        <Badge variant="outline" className="text-[10px]">{story.authorTier ?? "—"}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium">{story.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{story.story}</p>
                      {story.achievement && (
                        <div className="mt-2 flex items-center gap-2">
                          <Award className="size-4 text-amber-600" aria-hidden />
                          <span className="text-xs font-medium text-amber-700">{story.achievement}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Users className="size-5 text-emerald-600" aria-hidden />
                Peer-Mentoring (Buddy System)
              </CardTitle>
              <CardDescription>
                Dipasangkan dengan mentor sebaya yang sudah lebih mahir. Saling mendukung dan belajar bersama.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">Status: Belum dipasangkan</p>
                <p className="text-xs text-muted-foreground">Kami akan mencocokkan Anda dengan mentor berdasarkan minat dan tujuan.</p>
              </div>
              <Button size="sm">Daftar Mentoring</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Heart className="size-5 text-pink-600" aria-hidden />
                Akses Konseling
              </CardTitle>
              <CardDescription>
                Booking sesi konseling dengan psikolog/konselor yang bekerja sama. Gratis atau biaya terjangkau.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-sm font-medium">Konseling Gratis</p>
                  <p className="text-xs text-muted-foreground">Kuota terbatas — didanai oleh donasi komunitas</p>
                  <Button size="sm" variant="outline" className="mt-2 text-xs">Booking Gratis</Button>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-sm font-medium">Konseling Berbayar</p>
                  <p className="text-xs text-muted-foreground">Rp50.000/sesi — psikolog terlisensi</p>
                  <Button size="sm" variant="outline" className="mt-2 text-xs">Booking Berbayar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LITERASI KEUANGAN & HUKUM */}
        <TabsContent value="literasi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Wallet className="size-5 text-emerald-600" aria-hidden />
                Literasi Keuangan
              </CardTitle>
              <CardDescription>
                Kelola keuangan Anda dengan percaya diri. Dari anggaran rumah tangga hingga investasi dasar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl border border-border" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-3">
                  {financialModules.map((mod) => (
                    <li key={mod.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <Wallet className="size-4 text-emerald-600" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{mod.title}</p>
                        <p className="text-xs text-muted-foreground">{mod.description}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{mod.contentType}</Badge>
                      <Button size="sm" variant="outline" className="text-xs">Buka</Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Scale className="size-5 text-indigo-600" aria-hidden />
                Pojok Hukum & Hak
              </CardTitle>
              <CardDescription>
                Pahami hak-hak Anda: waris, asuh anak, dokumen kependudukan, dan legalitas usaha.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl border border-border" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-3">
                  {legalModules.map((mod) => (
                    <li key={mod.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                      <div className="rounded-lg bg-indigo-50 p-2">
                        <Scale className="size-4 text-indigo-600" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{mod.title}</p>
                        <p className="text-xs text-muted-foreground">{mod.description}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{mod.contentType}</Badge>
                      <Button size="sm" variant="outline" className="text-xs">Baca</Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MONETISASI & KONEKSI PASAR */}
        <TabsContent value="monetisasi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Briefcase className="size-5 text-blue-600" aria-hidden />
                Job Board — Kerja Remote & Part-time
              </CardTitle>
              <CardDescription>
                Lowongan kerja terkurasi yang ramah untuk ibu tunggal: remote, part-time, dan freelance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl border border-border" />
                  ))}
                </div>
              ) : (
                <>
                  <ul className="space-y-3">
                    {jobListings.map((job) => (
                      <li key={job.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{job.title}</p>
                          <p className="text-xs text-muted-foreground">{job.company} · {job.jobType}</p>
                          <p className="mt-1 text-xs font-medium text-emerald-700">
                            {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                          </p>
                        </div>
                        {job.remote ? <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300">Remote</Badge> : null}
                        <Button size="sm" variant="outline" className="text-xs" disabled={job.applied}>
                          {job.applied ? "Dilamar" : "Lamar"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link to="/marketplace">Buka Marketplace</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/bisnis">Program Bisnis</Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Rocket className="size-5 text-orange-600" aria-hidden />
                Inkubasi Bisnis Mini
              </CardTitle>
              <CardDescription>
                Panduan langkah demi langkah memulai usaha: dari ide, modal, produksi, hingga pemasaran.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl border border-border" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {incubationPrograms.map((program) => (
                    <div key={program.id} className="rounded-xl border border-border p-4">
                      <p className="text-sm font-semibold">{program.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{program.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{program.totalSteps} langkah</Badge>
                        <Button size="sm" className="text-xs">Mulai Inkubasi</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GAMIFIKASI & MOTIVASI */}
        <TabsContent value="gamifikasi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Target className="size-5 text-primary" aria-hidden />
                Pelacak Progres Belajar
              </CardTitle>
              <CardDescription>
                Lihat seberapa jauh Anda telah belajar dan potensi penghasilan yang bisa diraih.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-primary/10 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Modul Selesai</p>
                  <p className="mt-1 font-display text-2xl font-bold text-primary">0 / {modules.length}</p>
                </div>
                <div className="rounded-xl bg-secondary/60 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Jam Belajar</p>
                  <p className="mt-1 font-display text-2xl font-bold">0</p>
                </div>
                <div className="rounded-xl bg-secondary/60 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Potensi Penghasilan</p>
                  <p className="mt-1 font-display text-2xl font-bold text-emerald-600">Rp2-5jt</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress keseluruhan</span>
                  <span>0%</span>
                </div>
                <Progress value={0} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Award className="size-5 text-amber-600" aria-hidden />
                Lencana & Reward
              </CardTitle>
              <CardDescription>
                Penghargaan digital atas pencapaian Anda. Setiap lencana membuka akses ke fitur eksklusif.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl border border-border" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`rounded-xl border p-3 text-center ${
                        badge.earned ? "border-amber-300 bg-amber-50" : "border-border opacity-60"
                      }`}
                    >
                      <p className="text-2xl">{badge.emoji || "🏆"}</p>
                      <p className="mt-1 text-sm font-semibold">{badge.name}</p>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                      {badge.earned ? (
                        <Badge className="mt-2 text-[10px] bg-amber-600">Diraih</Badge>
                      ) : (
                        <Badge variant="outline" className="mt-2 text-[10px]">Belum diraih</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KEAMANAN & PRIVASI */}
        <TabsContent value="keamanan" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Shield className="size-5 text-emerald-600" aria-hidden />
                Verifikasi & Moderasi
              </CardTitle>
              <CardDescription>
                Keamanan Anda adalah prioritas. Semua anggota diverifikasi dan forum dimoderasi untuk mencegah penipuan dan eksploitasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <Shield className="mt-0.5 size-4 text-emerald-600" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Verifikasi Identitas</p>
                  <p className="text-xs text-muted-foreground">
                    Semua anggota wajib verifikasi KTP/surat pengadilan. Ini memastikan tidak ada penipu atau pihak yang berniat mengeksploitasi.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <Users className="mt-0.5 size-4 text-emerald-600" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Moderasi Aktif</p>
                  <p className="text-xs text-muted-foreground">
                    Tim admin memoderasi forum, komentar, dan listing marketplace. Laporan ditindaklanjuti dalam 24 jam.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <Lock className="mt-0.5 size-4 text-emerald-600" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Proteksi Data Pribadi</p>
                  <p className="text-xs text-muted-foreground">
                    Data sensitif (alamat, nomor telepon, dokumen) dienkripsi dan hanya bisa dilihat oleh Anda dan admin.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Lock className="size-5 text-violet-600" aria-hidden />
                Opsi Anonimitas
              </CardTitle>
              <CardDescription>
                Lindungi privasi Anda di forum komunitas. Gunakan nama samaran untuk berdiskusi tanpa mengungkap identitas asli.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Nama Samaran di Forum</p>
                  <p className="text-xs text-muted-foreground">
                    Profil utama tetap terverifikasi, tapi Anda bisa menggunakan nama samaran saat berdiskusi di forum dan grup.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="text-xs">Aktifkan</Button>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Sembunyikan Foto Profil</p>
                  <p className="text-xs text-muted-foreground">
                    Tampilkan avatar default alih-alih foto asli di area komunitas tertentu.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="text-xs">Pengaturan</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
