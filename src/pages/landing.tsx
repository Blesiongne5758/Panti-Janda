import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Crown,
  Flower2,
  Gem,
  HandHeart,
  Megaphone,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/session";
import { Link } from "@/lib/router";
import { CATEGORY_META, TIER_META, WIDOW_ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { HomeSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNote, LoadingGrid, SectionHeading, Stat, TierBadge } from "@/components/common";
import { EventCard, ProfileCard, ProgramCard } from "@/components/cards";

const TIER_ICON = { the_ceo: Gem, high_society: Crown, sosialita: Star, wonder_woman: Flower2 } as const;

const HERO_SLIDES = [
  { src: "/images/hero-community.webp", label: "Lima wajah komunitas", focus: "object-center" },
  { src: "/images/wajah-pengusaha.webp", label: "Pengusaha", focus: "object-[50%_22%]" },
  { src: "/images/wajah-sosialita.webp", label: "Sosialita", focus: "object-[50%_22%]" },
  { src: "/images/wajah-pekerja.webp", label: "Pekerja", focus: "object-[50%_22%]" },
  { src: "/images/wajah-umkm.webp", label: "Pemilik UMKM", focus: "object-[50%_22%]" },
  { src: "/images/wajah-tradisional.webp", label: "Wanita tradisional", focus: "object-[50%_22%]" },
];

const WAJAH = [
  {
    img: "/images/wajah-pengusaha.webp",
    label: "Pengusaha",
    text: "Memimpin usaha, membuka lapangan kerja, dan menopang keluarga lewat keputusan bisnis.",
  },
  {
    img: "/images/wajah-sosialita.webp",
    label: "Sosialita",
    text: "Menggerakkan jaringan, mengelola acara, dan menghubungkan anggota dengan peluang.",
  },
  {
    img: "/images/wajah-pekerja.webp",
    label: "Pekerja",
    text: "Profesional di bidangnya — disiplin, terampil, dan terus naik kelas lewat pelatihan.",
  },
  {
    img: "/images/wajah-umkm.webp",
    label: "Pemilik UMKM",
    text: "Menghidupkan warung, katering, dan usaha rumahan yang menopang ekonomi sekitar.",
  },
  {
    img: "/images/wajah-tradisional.webp",
    label: "Wanita Tradisional",
    text: "Menjaga tradisi dan ladang, menguatkan desa, dan merawat generasi berikutnya.",
  },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

const FLOW = [
  {
    icon: Crown,
    title: "High Society merancang",
    text: "Tier puncak menentukan arah: tempat khusus, event privat, undangan terbatas, dan pendanaan program.",
  },
  {
    icon: Star,
    title: "Sosialita menggerakkan",
    text: "Mengelola jadwal, membentuk kelompok minat, dan memimpin anggota menjalankan kegiatan.",
  },
  {
    icon: Flower2,
    title: "Wonder Woman menjalankan",
    text: "Mengikuti akademi & pelatihan, membagikan kabar, dan mencari dukungan untuk target kebutuhannya.",
  },
  {
    icon: HandHeart,
    title: "Non janda & mitra mendukung",
    text: "Pengunjung dapat membantu lewat komitmen dukungan dana, jasa, atau barang — tanpa perlu akun.",
  },
];

export function LandingPage() {
  const { account } = useAuth();
  const [data, setData] = useState<HomeSummary | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reducedMotion = usePrefersReducedMotion();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % HERO_SLIDES.length), 7000);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const load = () => {
    setLoading(true);
    setFailed(null);
    api<HomeSummary>("home.summary")
      .then(setData)
      .catch((error) => setFailed(errorText(error)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="animate-rise">
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-stage" aria-hidden>
          {HERO_SLIDES.map((item, index) => (
            <div key={item.src} className={cn("hero-slide", index === slide && "is-active")}>
              <img src={item.src} alt="" decoding="async" className={item.focus} />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
          <div className="absolute inset-0 bg-background/70 sm:hidden" />
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl gap-6 px-3 py-12 sm:gap-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-accent-foreground" aria-hidden />
              Komunitas janda Indonesia yang bertumbuh bersama
            </span>
            <h1 className="font-display text-4xl leading-[1.1] font-semibold text-foreground sm:text-5xl lg:text-6xl">
              Ruang tumbuh yang hangat dan bermartabat.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Panti Janda menghubungkan anggota dengan akademi, pelatihan, seminar, dan penempatan kerja — dikelola
              berjenjang oleh High Society, Sosialita, dan Wonder Woman, dengan dukungan terbuka dari masyarakat.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/jelajah">
                  Jelajahi profil anggota
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              {account ? (
                <Button asChild size="lg" variant="outline">
                  <Link to="/dasbor">Buka dasbor saya</Link>
                </Button>
              ) : (
                <Button asChild size="lg" variant="outline">
                  <Link to="/daftar">Daftar jadi anggota</Link>
                </Button>
              )}
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-emerald-600" aria-hidden />
                Profil terverifikasi admin
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-4 text-primary" aria-hidden />
                Hanya nama panggilan yang tampil
              </li>
            </ul>
          </div>

          <div className="grid content-start gap-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Stat label="Anggota" value={data ? data.stats.members : "—"} />
              <Stat label="Profil terverifikasi" value={data ? data.stats.verifiedMembers : "—"} />
              <Stat label="Program aktif" value={data ? data.stats.programs : "—"} />
            </div>
            <Card className="panel-glass border-primary/15">
              <CardContent className="space-y-3 pt-6">
                <p className="font-display text-lg font-semibold text-foreground">Tiga tingkatan anggota</p>
                <ul className="space-y-2.5">
                  {WIDOW_ROLES.map((tier) => (
                    <li
                      key={tier}
                      className="flex items-start gap-3 rounded-xl border border-border bg-background/70 px-3.5 py-3"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: TIER_META[tier].soft, color: TIER_META[tier].accent }}
                      >
                        {(() => {
                          const Icon = TIER_ICON[tier];
                          return <Icon className="size-4.5" aria-hidden />;
                        })()}
                      </span>
                      <span>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{TIER_META[tier].label}</span>
                          <span className="text-[11px] text-muted-foreground">{TIER_META[tier].tagline}</span>
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {TIER_META[tier].description}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-3 pb-4 sm:gap-3 sm:px-6">
          <p className="text-xs font-medium text-muted-foreground">
            Wajah komunitas: <span className="font-semibold text-foreground">{HERO_SLIDES[slide].label}</span>
          </p>
          <div className="flex items-center gap-1.5">
            {HERO_SLIDES.map((item, index) => (
              <button
                key={item.src}
                type="button"
                aria-label={`Tampilkan latar ${item.label}`}
                aria-pressed={index === slide}
                onClick={() => setSlide(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === slide ? "w-7 bg-primary" : "w-1.5 bg-foreground/25 hover:bg-foreground/45",
                )}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-3 py-10 sm:px-6">
        <SectionHeading
          eyebrow="Cara komunitas bekerja"
          title="Berjenjang, terarah, dan saling menguatkan"
          description="Setiap tingkatan punya peran jelas — dari perencanaan sampai pendampingan langsung bagi anggota."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((step, index) => (
            <Card key={step.title} className="h-full gap-0 py-0">
              <CardContent className="space-y-3 px-5 py-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-3xl font-semibold text-border">{index + 1}</span>
                </div>
                <p className="font-display text-base font-semibold text-foreground">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden border-b border-border bg-card/70">
        <div className="relative mx-auto w-full max-w-6xl px-3 py-10 sm:px-6">
          <SectionHeading
            eyebrow="Lima wajah komunitas"
            title="Pengusaha, sosialita, pekerja, pemilik UMKM, dan wanita tradisional"
            description="Mereka adalah wajah Panti Janda — perempuan yang membangun usaha, menggerakkan komunitas, bekerja profesional, menopang ekonomi kecil, dan menjaga akar tradisi."
          />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {WAJAH.map((item, index) => (
              <figure
                key={item.label}
                className="animate-rise group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <img
                  src={item.img}
                  alt={`Ilustrasi ${item.label}`}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2b1a12]/95 via-[#2b1a12]/50 to-transparent px-3.5 pt-12 pb-3.5">
                  <p className="font-display text-sm font-semibold text-white sm:text-base">{item.label}</p>
                  <p className="mt-1 hidden text-[11px] leading-relaxed text-white/80 sm:block">{item.text}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-border bg-secondary/30">
        <img
          src="/images/hero-community.webp"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover object-[center_30%] opacity-[0.12] [mask-image:linear-gradient(to_left,black,transparent)] lg:block"
        />
        <div className="relative mx-auto w-full max-w-6xl px-3 py-10 sm:px-6">
          <SectionHeading
            eyebrow="Kabar komunitas"
            title="Anggota yang siap didukung"
            description="Profil Wonder Woman terverifikasi — lengkap dengan keahlian, target kebutuhan, dan cita-cita mereka."
            action={
              <Button asChild variant="outline">
                <Link to="/jelajah">
                  Lihat semua profil
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            }
          />
          {loading ? (
            <LoadingGrid count={4} className="mt-8 lg:grid-cols-4" />
          ) : failed ? (
            <ErrorNote message={failed} onRetry={load} className="mt-8" />
          ) : data && data.profiles.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.profiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
              Belum ada profil terverifikasi. Anggota baru akan tampil setelah diverifikasi admin.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-3 py-10 sm:gap-10 sm:px-6 lg:grid-cols-2">
        <div className="space-y-6">
          <SectionHeading
            eyebrow="Akademi & pelatihan"
            title="Program untuk naik kelas"
            description="Akademi berjenjang, pelatihan keterampilan, seminar pengembangan diri, dan penempatan kerja."
          />
          {loading ? (
            <LoadingGrid count={2} className="lg:grid-cols-1" />
          ) : data && data.programs.length > 0 ? (
            <div className="grid gap-4">
              {data.programs.map((program) => (
                <Card key={program.id} className="gap-0 py-0">
                  <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-5">
                    <span className="text-2xl" aria-hidden>
                      {CATEGORY_META[program.category].emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-base font-semibold text-foreground">{program.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_META[program.category].label}
                        {program.schedule ? ` · ${program.schedule}` : ""}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/program">Detail</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
              <Button asChild variant="ghost" className="self-start">
                <Link to="/program">
                  Semua program
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-8 text-sm text-muted-foreground">
              Program baru akan segera dibuka. Nantikan kelas perdana dari para penggerak komunitas.
            </p>
          )}
        </div>

        <div className="space-y-6">
          <SectionHeading
            eyebrow="Agenda terbuka"
            title="Event yang bisa Anda hadiri"
            description="Event umum terbuka untuk siapa saja. Event anggota dan undangan tampil sesuai peran Anda."
          />
          {loading ? (
            <LoadingGrid count={2} className="lg:grid-cols-1" />
          ) : data && data.events.length > 0 ? (
            <div className="grid gap-4">
              {data.events.map((event) => (
                <EventCard key={event.id} event={event} canRsvp={false} guestHint="Masuk untuk menyatakan kehadiran." />
              ))}
              <Button asChild variant="ghost" className="self-start">
                <Link to="/event">
                  Semua event
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-8 text-sm text-muted-foreground">
              Belum ada event umum yang dijadwalkan.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-3 pb-4 sm:px-6">
        <Card className="relative gap-0 overflow-hidden border-primary/30 py-0">
          <img
            src="/images/hero-community.webp"
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover object-[center_28%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#241318]/95 via-[#3c1f33]/85 to-[#5B2A4E]/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#241318]/55 via-transparent to-transparent" />
          <CardContent className="relative flex flex-col items-start gap-6 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#f7edd8] backdrop-blur-sm">
                <Megaphone className="size-3.5" aria-hidden />
                Untuk pengunjung & mitra
              </span>
              <h2 className="font-display text-2xl font-semibold text-[#fdf7f0] sm:text-3xl">
                Dukungan Anda membuat target mereka tercapai
              </h2>
              <p className="text-sm leading-relaxed text-[#efe1d6]/90 sm:text-base">
                Buka profil anggota, lihat target kebutuhan dan keahlian mereka, lalu kirim komitmen dukungan — dana,
                jasa, atau barang. Formulir komitmen terbuka tanpa akun, dan bersifat rahasia antar Anda dan tim
                komunitas.
              </p>
            </div>
            <Button asChild size="lg" className="shrink-0 bg-[#f7edd8] text-[#3c1f33] hover:bg-white">
              <Link to="/jelajah">
                Mulai dari profil anggota
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
