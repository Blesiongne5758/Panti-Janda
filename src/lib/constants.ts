import type { Audience, EsportBudgetTemplate, ProgramCategory, PublicRole, Role, SupportType, WidowRole } from "./types";

export const TIER_META: Record<
  WidowRole,
  { label: string; tagline: string; description: string; accent: string; soft: string }
> = {
  the_ceo: {
    label: "The CEO",
    tagline: "Eksekutif puncak komunitas",
    description:
      "Level 46–50. Memiliki hak manajemen program, persetujuan kerjasama, dan pengawasan keuangan komunitas.",
    accent: "#1B4D3E",
    soft: "#E8F5E9",
  },
  high_society: {
    label: "High Society",
    tagline: "Perencana & pendana",
    description:
      "Level 36–45. Tier puncak yang merencanakan, mendanai, dan mengatur program serta event bagi seluruh anggota.",
    accent: "#B98A2F",
    soft: "#F7EDD8",
  },
  sosialita: {
    label: "Sosialita",
    tagline: "Penggerak kegiatan",
    description:
      "Level 21–35. Mengelola dan menjadwalkan kegiatan, memimpin kelompok minat, dan menggerakkan anggota.",
    accent: "#5B2A4E",
    soft: "#F1E4EE",
  },
  wonder_woman: {
    label: "Wonder Woman",
    tagline: "Operator & wajah komunitas",
    description:
      "Level 1–20. Mengelola profil publik, mengikuti akademi dan pelatihan, serta mencari dukungan untuk target kebutuhannya.",
    accent: "#C2603E",
    soft: "#FBEAE1",
  },
};

export const PUBLIC_TIER_META: Record<
  "ceo" | "sultan",
  { label: string; tagline: string; description: string; accent: string; soft: string }
> = {
  ceo: {
    label: "CEO",
    tagline: "Mitra puncak non-janda",
    description:
      "Tier eksklusif untuk mitra non-janda dengan akses penuh ke semua program dan hak istimewa komunitas.",
    accent: "#1B4D3E",
    soft: "#E8F5E9",
  },
  sultan: {
    label: "Sultan",
    tagline: "Mitra premium non-janda",
    description:
      "Tier premium untuk mitra non-janda dengan akses prioritas ke event dan program eksklusif.",
    accent: "#B98A2F",
    soft: "#F7EDD8",
  },
};

export const PUBLIC_BADGE_META: Record<
  "kades" | "walikota" | "gubernur" | "panglima" | "presiden",
  { label: string; tagline: string; description: string; accent: string; soft: string; minLevel: number }
> = {
  kades: {
    label: "Kades",
    tagline: "Mitra pemula non-janda",
    description: "Badge untuk mitra non-janda yang mencapai level 15.",
    accent: "#C2603E",
    soft: "#FBEAE1",
    minLevel: 15,
  },
  walikota: {
    label: "Walikota",
    tagline: "Mitra menengah non-janda",
    description: "Badge untuk mitra non-janda yang mencapai level 25.",
    accent: "#5B2A4E",
    soft: "#F1E4EE",
    minLevel: 25,
  },
  gubernur: {
    label: "Gubernur",
    tagline: "Mitra senior non-janda",
    description: "Badge untuk mitra non-janda yang mencapai level 35.",
    accent: "#8B4513",
    soft: "#F5E6D3",
    minLevel: 35,
  },
  panglima: {
    label: "Panglima",
    tagline: "Mitra elit non-janda",
    description: "Badge untuk mitra non-janda yang mencapai level 45.",
    accent: "#B98A2F",
    soft: "#F7EDD8",
    minLevel: 45,
  },
  presiden: {
    label: "Presiden",
    tagline: "Mitra puncak non-janda",
    description: "Badge tertinggi untuk mitra non-janda yang mencapai level 50.",
    accent: "#1B4D3E",
    soft: "#E8F5E9",
    minLevel: 50,
  },
};

export const WIDOW_ROLES: WidowRole[] = ["wonder_woman", "sosialita", "high_society", "the_ceo"];
export const PUBLIC_ROLES: PublicRole[] = ["kades", "walikota", "gubernur", "panglima", "presiden", "ceo", "sultan"];
export const PUBLIC_BADGES: Array<"kades" | "walikota" | "gubernur" | "panglima" | "presiden"> = ["kades", "walikota", "gubernur", "panglima", "presiden"];
export const PUBLIC_SUBSCRIPTION_TIERS: Array<"ceo" | "sultan"> = ["ceo", "sultan"];

export const ROLE_RANK: Record<Role, number> = {
  public: 1,
  kades: 2,
  walikota: 3,
  wonder_woman: 2,
  gubernur: 4,
  sosialita: 3,
  panglima: 5,
  high_society: 4,
  presiden: 6,
  the_ceo: 5,
  ceo: 7,
  sultan: 6,
  admin: 8,
};

export const COMMITTEE_ROLE_LABEL: Record<string, string> = {
  ketua_panitia: "Ketua Panitia",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
  koordinator_acara: "Koordinator Acara",
  absen_tiket: "Absen Tiket",
  absen_undangan: "Absen Undangan",
  publikasi: "Publikasi",
  logistik: "Logistik",
  panitia: "Panitia",
};

export const COMMITTEE_ASSIGNABLE_ROLES: string[] = [
  "sekretaris",
  "bendahara",
  "koordinator_acara",
  "absen_tiket",
  "absen_undangan",
  "publikasi",
  "logistik",
  "panitia",
];

export const EVENT_CATEGORY_META: Record<string, { label: string; emoji: string; tone: string }> = {
  workshop: { label: "Workshop", emoji: "🛠️", tone: "bg-amber-100 text-amber-800" },
  webinar: { label: "Webinar", emoji: "💻", tone: "bg-sky-100 text-sky-800" },
  meetup: { label: "Meetup", emoji: "🤝", tone: "bg-emerald-100 text-emerald-800" },
  concert: { label: "Konser", emoji: "🎤", tone: "bg-fuchsia-100 text-fuchsia-800" },
  charity: { label: "Amal", emoji: "❤️", tone: "bg-rose-100 text-rose-800" },
  conference: { label: "Konferensi", emoji: "🏛️", tone: "bg-indigo-100 text-indigo-800" },
  garage_sale: { label: "Garage Sale", emoji: "🏷️", tone: "bg-lime-100 text-lime-800" },
  lelang: { label: "Lelang", emoji: "🔨", tone: "bg-yellow-100 text-yellow-800" },
  bazar: { label: "Bazar", emoji: "🛍️", tone: "bg-teal-100 text-teal-800" },
  nobar: { label: "Nobar", emoji: "📺", tone: "bg-purple-100 text-purple-800" },
  other: { label: "Lainnya", emoji: "🎪", tone: "bg-slate-100 text-slate-700" },
};

export const EVENT_STATUS_META: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draf", tone: "bg-slate-100 text-slate-700" },
  planning: { label: "Perencanaan", tone: "bg-sky-100 text-sky-800" },
  budgeting: { label: "Penyusunan Anggaran", tone: "bg-amber-100 text-amber-800" },
  pending_approval: { label: "Menunggu Persetujuan", tone: "bg-orange-100 text-orange-800" },
  published: { label: "Dipublikasikan", tone: "bg-emerald-100 text-emerald-800" },
  ongoing: { label: "Berlangsung", tone: "bg-green-100 text-green-800" },
  completed: { label: "Selesai", tone: "bg-teal-100 text-teal-800" },
  archived: { label: "Diarsipkan", tone: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Dibatalkan", tone: "bg-rose-100 text-rose-800" },
};

export const EVENT_LOCATION_TYPE_LABEL: Record<string, string> = {
  physical: "Tatap Muka",
  virtual: "Online",
  hybrid: "Hybrid",
};

export const VIRTUAL_PLATFORM_LABEL: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  internal: "Live Stream Panti Janda",
};

export const BUDGET_CATEGORY_META: Record<string, { label: string; color: string }> = {
  VENUE: { label: "Tempat", color: "#6366f1" },
  EQUIPMENT: { label: "Peralatan", color: "#0ea5e9" },
  TALENT: { label: "Pengisi Acara", color: "#a855f7" },
  CATERING: { label: "Konsumsi", color: "#f59e0b" },
  MARKETING: { label: "Pemasaran", color: "#ef4444" },
  TRANSPORTATION: { label: "Transportasi", color: "#14b8a6" },
  PERMIT: { label: "Perizinan", color: "#8b5cf6" },
  PRODUCTION: { label: "Produksi", color: "#ec4899" },
  DOCUMENTATION: { label: "Dokumentasi", color: "#22c55e" },
  STAFF: { label: "Petugas", color: "#f97316" },
  CONTINGENCY: { label: "Dana Cadangan", color: "#64748b" },
  OTHER: { label: "Lainnya", color: "#94a3b8" },
};

export const FUNDING_SOURCE_META: Record<string, { label: string; hint: string }> = {
  SELF_FUNDED: { label: "Dana Sendiri", hint: "Kas komunitas atau pribadi penyelenggara" },
  TICKET_SALES: { label: "Penjualan Tiket", hint: "Pendapatan dari tiket berbayar" },
  SPONSORSHIP: { label: "Sponsor", hint: "Perlu persetujuan admin" },
  PLATFORM_FUND: { label: "Dana Platform", hint: "Pengajuan dana — perlu persetujuan admin" },
  DONATION: { label: "Donasi", hint: "Sumbangan donatur untuk acara ini" },
};

export const APPROVAL_REASON_LABEL: Record<string, string> = {
  platform_fund: "Menggunakan Dana Platform",
  sponsorship: "Melibatkan sponsor",
  audience_over_1000: "Target peserta lebih dari 1.000 orang",
  charity_category: "Kategori amal (charity)",
  conference_permit: "Konferensi dengan perizinan",
};

export const EVENT_EXPENSE_THRESHOLD = 1_000_000;

export interface EventTemplate {
  id: string;
  name: string;
  category: string;
  emoji: string;
  description: string;
  checklist: { title: string; category: string; priority: "low" | "medium" | "high"; dayOffset?: number }[];
  budget: { category: string; name: string; quantity: number; unit: string; estimatedCost: number }[];
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: "workshop",
    name: "Workshop",
    category: "workshop",
    emoji: "🛠️",
    description: "Kelas praktik dengan peserta terbatas dan pelatih pendamping.",
    checklist: [
      { title: "Tentukan pelatih dan konfirmasi jadwal", category: "TALENT", priority: "high", dayOffset: -14 },
      { title: "Siapkan ruang dan perlengkapan praktik", category: "EQUIPMENT", priority: "high", dayOffset: -7 },
      { title: "Buka pendaftaran peserta", category: "MARKETING", priority: "medium", dayOffset: -10 },
      { title: "Siapkan modul dan sertifikat", category: "PRODUCTION", priority: "medium", dayOffset: -3 },
      { title: "Dokumentasi kegiatan", category: "DOCUMENTATION", priority: "low", dayOffset: 0 },
    ],
    budget: [
      { category: "TALENT", name: "Honor pelatih", quantity: 1, unit: "orang", estimatedCost: 1500000 },
      { category: "VENUE", name: "Sewa ruang", quantity: 1, unit: "hari", estimatedCost: 1000000 },
      { category: "CATERING", name: "Konsumsi peserta", quantity: 20, unit: "porsi", estimatedCost: 35000 },
      { category: "EQUIPMENT", name: "Perlengkapan praktik", quantity: 1, unit: "paket", estimatedCost: 800000 },
      { category: "DOCUMENTATION", name: "Dokumentasi", quantity: 1, unit: "paket", estimatedCost: 500000 },
    ],
  },
  {
    id: "webinar",
    name: "Webinar",
    category: "webinar",
    emoji: "💻",
    description: "Seminar online dengan kapasitas besar dan biaya rendah.",
    checklist: [
      { title: "Tentukan pembicara dan topik", category: "TALENT", priority: "high", dayOffset: -14 },
      { title: "Buat ruang live stream", category: "PRODUCTION", priority: "high", dayOffset: -7 },
      { title: "Sebarkan tautan pendaftaran", category: "MARKETING", priority: "medium", dayOffset: -10 },
      { title: "Uji coba perangkat dan koneksi", category: "PRODUCTION", priority: "high", dayOffset: -1 },
      { title: "Rekap pertanyaan peserta", category: "OTHER", priority: "low", dayOffset: 0 },
    ],
    budget: [
      { category: "TALENT", name: "Honor pembicara", quantity: 1, unit: "orang", estimatedCost: 1000000 },
      { category: "MARKETING", name: "Promosi online", quantity: 1, unit: "paket", estimatedCost: 500000 },
      { category: "PRODUCTION", name: "Platform dan teknis", quantity: 1, unit: "paket", estimatedCost: 400000 },
      { category: "DOCUMENTATION", name: "Rekaman dan editing", quantity: 1, unit: "paket", estimatedCost: 600000 },
    ],
  },
  {
    id: "meetup",
    name: "Meetup",
    category: "meetup",
    emoji: "🤝",
    description: "Pertemuan komunitas santai untuk saling mengenal dan berbagi.",
    checklist: [
      { title: "Pilih tempat dan reservasi", category: "VENUE", priority: "high", dayOffset: -10 },
      { title: "Buka pendaftaran peserta", category: "MARKETING", priority: "medium", dayOffset: -7 },
      { title: "Atur konsumsi", category: "CATERING", priority: "medium", dayOffset: -3 },
      { title: "Siapkan ice breaker dan agenda", category: "PRODUCTION", priority: "low", dayOffset: -1 },
    ],
    budget: [
      { category: "VENUE", name: "Reservasi tempat", quantity: 1, unit: "paket", estimatedCost: 1500000 },
      { category: "CATERING", name: "Konsumsi ringan", quantity: 30, unit: "porsi", estimatedCost: 25000 },
      { category: "MARKETING", name: "Materi promosi", quantity: 1, unit: "paket", estimatedCost: 200000 },
    ],
  },
  {
    id: "concert",
    name: "Konser",
    category: "concert",
    emoji: "🎤",
    description: "Acara hiburan berskala besar dengan tiket berbayar dan sponsor.",
    checklist: [
      { title: "Booking venue dan panggung", category: "VENUE", priority: "high", dayOffset: -30 },
      { title: "Kontrak pengisi acara", category: "TALENT", priority: "high", dayOffset: -21 },
      { title: "Urus izin keramaian", category: "PERMIT", priority: "high", dayOffset: -14 },
      { title: "Jual tiket (early bird)", category: "MARKETING", priority: "high", dayOffset: -14 },
      { title: "Koordinasi keamanan dan medis", category: "STAFF", priority: "high", dayOffset: -7 },
      { title: "Gladi resik dan cek sound", category: "PRODUCTION", priority: "medium", dayOffset: -2 },
    ],
    budget: [
      { category: "VENUE", name: "Sewa venue", quantity: 1, unit: "hari", estimatedCost: 50000000 },
      { category: "TALENT", name: "Pengisi acara", quantity: 1, unit: "paket", estimatedCost: 30000000 },
      { category: "PRODUCTION", name: "Panggung dan sound", quantity: 1, unit: "paket", estimatedCost: 40000000 },
      { category: "PERMIT", name: "Perizinan", quantity: 1, unit: "paket", estimatedCost: 5000000 },
      { category: "MARKETING", name: "Promosi", quantity: 1, unit: "paket", estimatedCost: 10000000 },
      { category: "STAFF", name: "Petugas dan keamanan", quantity: 20, unit: "orang", estimatedCost: 250000 },
    ],
  },
  {
    id: "charity",
    name: "Amal",
    category: "charity",
    emoji: "❤️",
    description: "Penggalangan dana dengan transparansi anggaran (perlu persetujuan admin).",
    checklist: [
      { title: "Tentukan program penerima manfaat", category: "OTHER", priority: "high", dayOffset: -21 },
      { title: "Siapkan laporan penggunaan dana", category: "OTHER", priority: "high", dayOffset: -7 },
      { title: "Undang donatur dan mitra", category: "MARKETING", priority: "medium", dayOffset: -10 },
      { title: "Publikasi capaian setelah acara", category: "DOCUMENTATION", priority: "medium", dayOffset: 0 },
    ],
    budget: [
      { category: "VENUE", name: "Tempat acara", quantity: 1, unit: "paket", estimatedCost: 3000000 },
      { category: "CATERING", name: "Konsumsi tamu", quantity: 50, unit: "porsi", estimatedCost: 40000 },
      { category: "DOCUMENTATION", name: "Dokumentasi dan laporan", quantity: 1, unit: "paket", estimatedCost: 1000000 },
      { category: "OTHER", name: "Penyaluran dana", quantity: 1, unit: "paket", estimatedCost: 10000000 },
    ],
  },
];

export const ROLE_LABEL: Record<Role, string> = {
  public: "Non Janda",
  kades: "Kades",
  walikota: "Walikota",
  wonder_woman: "Wonder Woman",
  gubernur: "Gubernur",
  sosialita: "Sosialita",
  panglima: "Panglima",
  high_society: "High Society",
  presiden: "Presiden",
  the_ceo: "The CEO",
  ceo: "CEO",
  sultan: "Sultan",
  admin: "Admin",
};

export function roleFromLevel(level: number, isJanda: boolean): Role {
  if (isJanda) {
    if (level >= 46) return "the_ceo";
    if (level >= 36) return "high_society";
    if (level >= 21) return "sosialita";
    if (level >= 1) return "wonder_woman";
    return "public";
  } else {
    if (level >= 50) return "presiden";
    if (level >= 45) return "panglima";
    if (level >= 35) return "gubernur";
    if (level >= 25) return "walikota";
    if (level >= 15) return "kades";
    return "public";
  }
}

export function tierFromLevel(level: number): WidowRole | PublicRole {
  if (level >= 46) return "the_ceo";
  if (level >= 36) return "high_society";
  if (level >= 21) return "sosialita";
  return "wonder_woman";
}

export function publicBadgeFromLevel(level: number): "kades" | "walikota" | "gubernur" | "panglima" | "presiden" | null {
  if (level >= 50) return "presiden";
  if (level >= 45) return "panglima";
  if (level >= 35) return "gubernur";
  if (level >= 25) return "walikota";
  if (level >= 15) return "kades";
  return null;
}

export const MAX_LEVEL = 50;

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level - 1, 2));
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

export function levelFromXp(xp: number): number {
  for (let lvl = MAX_LEVEL; lvl >= 1; lvl--) {
    if (xp >= totalXpForLevel(lvl)) return lvl;
  }
  return 1;
}

export const LEVEL_TITLES: Record<number, { janda: string; nonJanda: string }> = {
  1: { janda: "Pemula", nonJanda: "Pendukung Baru" },
  5: { janda: "Aktif", nonJanda: "Teman Komunitas" },
  10: { janda: "Rajin", nonJanda: "Mitra Aktif" },
  15: { janda: "Berdedikasi", nonJanda: "Mitra Dedikasi" },
  20: { janda: "Senior", nonJanda: "Mitra Senior" },
  25: { janda: "Penggerak", nonJanda: "Koordinator" },
  30: { janda: "Pemimpin", nonJanda: "Pemimpin Mitra" },
  35: { janda: "Teladan", nonJanda: "Mitra Teladan" },
  40: { janda: "Elite", nonJanda: "Mitra Elite" },
  45: { janda: "Master", nonJanda: "Mitra Master" },
  50: { janda: "Legenda", nonJanda: "Legenda" },
};

export function levelTitle(level: number, isJanda: boolean): string {
  const exact = LEVEL_TITLES[level];
  if (exact) return isJanda ? exact.janda : exact.nonJanda;
  const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => a - b);
  let closest = keys[0];
  for (const k of keys) {
    if (k <= level) closest = k;
  }
  const entry = LEVEL_TITLES[closest];
  return isJanda ? entry.janda : entry.nonJanda;
}

export const AUDIENCE_META: Record<Audience, { label: string; hint: string }> = {
  umum: { label: "Umum", hint: "Terbuka untuk semua pengunjung" },
  anggota: { label: "Anggota", hint: "Hanya untuk anggota janda terverifikasi" },
  undangan: { label: "Undangan", hint: "Hanya untuk anggota yang diundang" },
};

export const CATEGORY_META: Record<
  ProgramCategory,
  { label: string; emoji: string; description: string }
> = {
  akademi: { label: "Akademi", emoji: "🎓", description: "Kelas berjenjang dengan kurikulum" },
  pelatihan: { label: "Pelatihan", emoji: "🛠️", description: "Keterampilan praktis siap kerja" },
  seminar: { label: "Seminar", emoji: "🎤", description: "Wawasan dan pengembangan diri" },
  penempatan_kerja: {
    label: "Penempatan Kerja",
    emoji: "💼",
    description: "Penyaluran kerja & kemitraan usaha",
  },
};

export const SUPPORT_META: Record<SupportType, { label: string; hint: string }> = {
  dana: { label: "Dana", hint: "Dukungan finansial langsung" },
  jasa: { label: "Jasa / Keahlian", hint: "Bantuan keterampilan atau tenaga" },
  barang: { label: "Barang", hint: "Kebutuhan alat, bahan, atau perlengkapan" },
};

export const PROFILE_STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "Menunggu verifikasi", tone: "bg-amber-100 text-amber-900 border-amber-200" },
  verified: { label: "Terverifikasi", tone: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  rejected: { label: "Perlu perbaikan", tone: "bg-rose-100 text-rose-900 border-rose-200" },
  suspended: { label: "Ditangguhkan", tone: "bg-stone-200 text-stone-800 border-stone-300" },
};

export const DONATION_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu pembayaran",
  settled: "Berhasil",
  challenge: "Perlu peninjauan",
  failed: "Gagal",
  refunded: "Dikembalikan",
};

export const PLEDGE_STATUS_LABEL: Record<string, string> = {
  baru: "Baru",
  dihubungi: "Sedang ditindaklanjuti",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

export const EDUCATION_OPTIONS: readonly string[] = [
  "Tidak bersekolah",
  "SD",
  "SMP",
  "SMA",
  "SMK",
  "D1",
  "D2",
  "D3",
  "D4",
  "S1",
  "S2",
  "S3",
];

export const SIM_CLASS_OPTIONS: readonly string[] = ["A", "B1", "B2", "C"];

export const KPI_LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => ({
  level: i + 1,
  minPoints: totalXpForLevel(i + 1),
  title: `Level ${i + 1}`,
}));

export const BADGE_META: Record<string, { label: string; icon: string; color: string }> = {
  donor_dana: { label: "Pendana Setia", icon: "💰", color: "bg-amber-100 text-amber-900 border-amber-200" },
  donor_kampanye: { label: "Penderma Kampanye", icon: "🎁", color: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  donor_jasa: { label: "Relawan Setia", icon: "🤝", color: "bg-blue-100 text-blue-900 border-blue-200" },
  donor_barang: { label: "Penyumbang Barang", icon: "📦", color: "bg-purple-100 text-purple-900 border-purple-200" },
};

export const TICKET_STATUS_LABEL: Record<string, string> = {
  valid: "Berlaku",
  used: "Sudah dipakai",
  cancelled: "Dibatalkan",
  pending: "Menunggu pembayaran",
};

export const PLATFORM_NAME = "Panti Janda";
export const PLATFORM_TAGLINE = "Ruang tumbuh yang hangat dan bermartabat untuk para janda Indonesia.";

export const BUSINESS_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  pending: "Menunggu persetujuan",
  approved: "Disetujui",
  rejected: "Ditolak",
};

export const BUSINESS_TYPE_OPTIONS: readonly string[] = [
  "Kuliner",
  "Fesyen & Tekstil",
  "Kerajinan Tangan",
  "Kecantikan & Perawatan",
  "Pertanian & Peternakan",
  "Jasa & Layanan",
  "Retail & Warung",
  "Lainnya",
];

export const SUBSCRIPTION_TIERS: readonly string[] = ["sosialita", "high_society", "the_ceo"];
export const PUBLIC_SUBSCRIPTION_TIERS_LIST: readonly string[] = ["ceo", "sultan"];

export const SUBSCRIPTION_PRICES: Record<string, number> = {
  sosialita: 100000,
  high_society: 500000,
  the_ceo: 1000000,
  ceo: 1000000,
  sultan: 2000000,
};

export const COIN_PACKAGES = [
  { id: "coins_100", name: "100 Koin", coinAmount: 100, price: 10000, bonusCoins: 0, popular: false },
  { id: "coins_500", name: "500 Koin", coinAmount: 500, price: 45000, bonusCoins: 0, popular: true },
  { id: "coins_1000", name: "1.000 Koin", coinAmount: 1000, price: 85000, bonusCoins: 50, popular: false },
  { id: "coins_2500", name: "2.500 Koin", coinAmount: 2500, price: 200000, bonusCoins: 200, popular: false },
  { id: "coins_5000", name: "5.000 Koin", coinAmount: 5000, price: 380000, bonusCoins: 500, popular: false },
];

export const COIN_TRANSACTION_TYPE_LABEL: Record<string, string> = {
  purchase: "Pembelian koin",
  spend: "Penggunaan koin",
  refund: "Pengembalian koin",
  bonus: "Bonus koin",
  withdraw: "Penarikan koin",
};

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu pembayaran",
  active: "Aktif",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

export const LISTING_KIND_LABEL: Record<string, string> = {
  barang: "Barang",
  jasa: "Jasa",
};

export const LISTING_STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  active: "Aktif",
  sold: "Terjual",
  archived: "Diarsipkan",
};

export const LISTING_CATEGORIES: readonly string[] = [
  "Makanan & Minuman",
  "Fesyen & Tekstil",
  "Kerajinan Tangan",
  "Kecantikan & Perawatan",
  "Pendidikan & Pelatihan",
  "Jasa Rumah Tangga",
  "Jasa Desain & Kreatif",
  "Jasa Menjahit",
  "Jasa Memasak",
  "Lainnya",
];

export const ESPORT_FORMAT_META: Record<string, { label: string; short: string; hint: string }> = {
  single_elim: {
    label: "Eliminasi Tunggal",
    short: "Single Elim",
    hint: "Kalah sekali langsung tersingkir. Paling cepat untuk turnamen singkat.",
  },
  double_elim: {
    label: "Eliminasi Ganda",
    short: "Double Elim",
    hint: "Kalah dua kali baru tersingkir. Ada bracket kalah dan grand final.",
  },
  round_robin: {
    label: "Round Robin",
    short: "Round Robin",
    hint: "Semua tim saling bertemu. Juara ditentukan dari klasemen poin.",
  },
  group_playoff: {
    label: "Grup + Playoff",
    short: "Grup + Playoff",
    hint: "Fase grup dibagi dua, dua teratas tiap grup melaju ke playoff silang.",
  },
  swiss: {
    label: "Swiss System",
    short: "Swiss",
    hint: "Tanpa eliminasi — tiap ronde tim bertemu lawan dengan rekor setara, juara dari klasemen.",
  },
  battle_royale: {
    label: "Battle Royale",
    short: "Battle Royale",
    hint: "Beberapa lobi pertandingan, semua tim ikut di tiap lobi. Poin dari posisi akhir dan total kill.",
  },
  league: {
    label: "Liga",
    short: "Liga",
    hint: "Kompetisi jangka panjang semua tim bertemu — menang 3 poin, klasemen menentukan juara.",
  },
};

export const ESPORT_PLATFORM_META: Record<string, { label: string; hint: string }> = {
  pc: { label: "PC / Desktop", hint: "Dimainkan lewat komputer atau laptop." },
  mobile: { label: "Mobile", hint: "Dimainkan lewat ponsel atau tablet." },
  console: { label: "Konsol", hint: "Dimainkan lewat PlayStation, Xbox, atau sejenisnya." },
};

export const ESPORT_CATEGORY_META: Record<string, { label: string; hint: string }> = {
  amateur: { label: "Amateur", hint: "Terbuka untuk komunitas umum dan pemain kasual." },
  semi_pro: { label: "Semi-Pro", hint: "Untuk tim yang rutin berlaga di turnamen komunitas." },
  professional: { label: "Professional", hint: "Standar kompetisi tinggi dengan aturan dan hadiah besar." },
};

export const ESPORT_TIMEZONES: Record<string, string> = {
  "Asia/Jakarta": "WIB — Asia/Jakarta (GMT+7)",
  "Asia/Makassar": "WITA — Asia/Makassar (GMT+8)",
  "Asia/Jayapura": "WIT — Asia/Jayapura (GMT+9)",
  "Asia/Singapore": "SGT — Asia/Singapore (GMT+8)",
  UTC: "UTC (GMT+0)",
};

export const ESPORT_STREAM_PLATFORM_PRESETS = [
  "YouTube",
  "TikTok",
  "Twitch",
  "Facebook Gaming",
  "Kick",
  "Instagram Live",
] as const;

export const ESPORT_PRIZE_APPROVAL_THRESHOLD = 10_000_000;

export const ESPORT_PRIZE_DISTRIBUTION = [50, 25, 15, 10] as const;

export const ESPORT_BUDGET_CATEGORY_META: Record<string, { label: string; tone: string }> = {
  PRIZE_POOL: { label: "Hadiah", tone: "bg-amber-100 text-amber-800" },
  PRODUCTION: { label: "Produksi Siaran", tone: "bg-sky-100 text-sky-800" },
  TALENT: { label: "Talent & Caster", tone: "bg-violet-100 text-violet-800" },
  MARKETING: { label: "Pemasaran", tone: "bg-pink-100 text-pink-800" },
  STAFF: { label: "Tim Panitia", tone: "bg-teal-100 text-teal-800" },
  EQUIPMENT: { label: "Peralatan", tone: "bg-slate-100 text-slate-700" },
  VENUE: { label: "Venue", tone: "bg-orange-100 text-orange-800" },
  PERMIT: { label: "Perizinan", tone: "bg-rose-100 text-rose-800" },
  CONTINGENCY: { label: "Dana Cadangan", tone: "bg-emerald-100 text-emerald-800" },
  OTHER: { label: "Lainnya", tone: "bg-slate-100 text-slate-600" },
};

// Template anggaran turnamen siap pakai: pilih skala, rincian langsung terisi
// dan tetap bisa disesuaikan. Total dihitung dari rincian (kuantitas × harga
// satuan) — tidak ada angka total yang ditulis terpisah.
export const ESPORT_BUDGET_TEMPLATES: EsportBudgetTemplate[] = [
  {
    key: "small",
    name: "Turnamen Kecil (8–16 Tim)",
    hint: "Skala komunitas, final satu hari, produksi siaran sederhana.",
    items: [
      { category: "PRIZE_POOL", itemName: "Total hadiah", quantity: 1, estimatedCost: 5_000_000 },
      { category: "PRODUCTION", itemName: "Produksi siaran (overlay, OBS)", quantity: 1, estimatedCost: 1_500_000 },
      { category: "TALENT", itemName: "Caster (2 orang × 3 hari)", quantity: 6, estimatedCost: 500_000 },
      { category: "MARKETING", itemName: "Promosi media sosial", quantity: 1, estimatedCost: 1_000_000 },
      { category: "STAFF", itemName: "Admin turnamen", quantity: 2, estimatedCost: 750_000 },
      { category: "EQUIPMENT", itemName: "Server & tools", quantity: 1, estimatedCost: 500_000 },
      { category: "CONTINGENCY", itemName: "Dana cadangan", quantity: 1, estimatedCost: 1_000_000 },
    ],
  },
  {
    key: "medium",
    name: "Turnamen Menengah (32–64 Tim)",
    hint: "Multi-hari dengan produksi lebih rapi dan tim panitia tetap.",
    items: [
      { category: "PRIZE_POOL", itemName: "Total hadiah", quantity: 1, estimatedCost: 25_000_000 },
      { category: "PRODUCTION", itemName: "Produksi siaran (multi-cam, overlay)", quantity: 1, estimatedCost: 7_500_000 },
      { category: "TALENT", itemName: "Caster + analis (4 orang × 5 hari)", quantity: 20, estimatedCost: 750_000 },
      { category: "MARKETING", itemName: "Promosi + influencer", quantity: 1, estimatedCost: 5_000_000 },
      { category: "STAFF", itemName: "Tim produksi & admin", quantity: 5, estimatedCost: 1_500_000 },
      { category: "EQUIPMENT", itemName: "Sewa server + tools premium", quantity: 1, estimatedCost: 2_500_000 },
      { category: "VENUE", itemName: "Venue (bila final offline)", quantity: 1, estimatedCost: 10_000_000 },
      { category: "CONTINGENCY", itemName: "Dana cadangan", quantity: 1, estimatedCost: 8_500_000 },
    ],
  },
  {
    key: "large",
    name: "Turnamen Besar (128+ Tim / Pro)",
    hint: "Skala profesional dengan broadcast penuh, venue, dan perizinan.",
    items: [
      { category: "PRIZE_POOL", itemName: "Total hadiah", quantity: 1, estimatedCost: 100_000_000 },
      { category: "PRODUCTION", itemName: "Produksi broadcast penuh", quantity: 1, estimatedCost: 35_000_000 },
      { category: "TALENT", itemName: "Caster, analis, host, observer", quantity: 40, estimatedCost: 1_000_000 },
      { category: "MARKETING", itemName: "Kampanye pemasaran penuh", quantity: 1, estimatedCost: 25_000_000 },
      { category: "STAFF", itemName: "Tim produksi lengkap", quantity: 15, estimatedCost: 3_000_000 },
      { category: "EQUIPMENT", itemName: "Peralatan + server dedicated", quantity: 1, estimatedCost: 15_000_000 },
      { category: "VENUE", itemName: "Venue offline (final)", quantity: 3, estimatedCost: 25_000_000 },
      { category: "PERMIT", itemName: "Perizinan & legal", quantity: 1, estimatedCost: 5_000_000 },
      { category: "CONTINGENCY", itemName: "Dana cadangan", quantity: 1, estimatedCost: 42_500_000 },
    ],
  },
];


export const ESPORT_STATUS_META: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draf", tone: "bg-slate-100 text-slate-700" },
  registration: { label: "Pendaftaran Dibuka", tone: "bg-emerald-100 text-emerald-800" },
  bracket: { label: "Bagan Siap", tone: "bg-sky-100 text-sky-800" },
  ongoing: { label: "Berlangsung", tone: "bg-amber-100 text-amber-800" },
  completed: { label: "Selesai", tone: "bg-teal-100 text-teal-800" },
  cancelled: { label: "Dibatalkan", tone: "bg-rose-100 text-rose-800" },
};

export const ESPORT_REG_STATUS_META: Record<string, { label: string; tone: string }> = {
  registered: { label: "Terdaftar", tone: "bg-sky-100 text-sky-800" },
  checked_in: { label: "Check-in", tone: "bg-emerald-100 text-emerald-800" },
  eliminated: { label: "Tersingkir", tone: "bg-slate-100 text-slate-600" },
  winner: { label: "Juara", tone: "bg-amber-100 text-amber-800" },
  disqualified: { label: "Diskualifikasi", tone: "bg-rose-100 text-rose-800" },
  withdrawn: { label: "Mundur", tone: "bg-slate-100 text-slate-600" },
  waitlist: { label: "Daftar Tunggu", tone: "bg-violet-100 text-violet-800" },
};

export const ESPORT_MATCH_STATUS_META: Record<string, { label: string; tone: string }> = {
  scheduled: { label: "Terjadwal", tone: "bg-sky-100 text-sky-800" },
  checkin_open: { label: "Check-in Dibuka", tone: "bg-amber-100 text-amber-800" },
  live: { label: "Live", tone: "bg-rose-100 text-rose-800" },
  paused: { label: "Dijeda", tone: "bg-orange-100 text-orange-800" },
  disputed: { label: "Sengketa", tone: "bg-violet-100 text-violet-800" },
  finished: { label: "Selesai", tone: "bg-teal-100 text-teal-800" },
  walkover: { label: "Walkover", tone: "bg-slate-200 text-slate-700" },
  cancelled: { label: "Dibatalkan", tone: "bg-rose-100 text-rose-800" },
};

export const ESPORT_DISPUTE_STATUS_META: Record<string, { label: string; tone: string }> = {
  open: { label: "Menunggu Tinjauan", tone: "bg-amber-100 text-amber-800" },
  investigating: { label: "Sedang Diinvestigasi", tone: "bg-sky-100 text-sky-800" },
  resolved: { label: "Diterima", tone: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Ditolak", tone: "bg-rose-100 text-rose-800" },
};

export const ESPORT_PAYMENT_STATUS_META: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "Belum Bayar", tone: "bg-amber-100 text-amber-800" },
  paid: { label: "Sudah Bayar", tone: "bg-emerald-100 text-emerald-800" },
  refunded: { label: "Dana Dikembalikan", tone: "bg-slate-100 text-slate-600" },
};

export const ESPORT_PRIZE_STATUS_META: Record<string, { label: string; tone: string; hint: string }> = {
  pending: {
    label: "Menunggu",
    tone: "bg-slate-100 text-slate-700",
    hint: "Hadiah belum dikunci — panitia masih bisa mengubah daftar hadiah.",
  },
  locked: {
    label: "Terkunci",
    tone: "bg-sky-100 text-sky-800",
    hint: "Daftar hadiah dan penerima sudah final, siap masuk proses pencairan.",
  },
  distributing: {
    label: "Sedang Dicairkan",
    tone: "bg-amber-100 text-amber-800",
    hint: "Dana hadiah sedang diproses dan ditransfer ke para juara.",
  },
  completed: {
    label: "Selesai Dibagikan",
    tone: "bg-teal-100 text-teal-800",
    hint: "Seluruh hadiah sudah diterima para juara.",
  },
};

export const ESPORT_CASTER_ROLE_META: Record<string, { label: string; hint: string }> = {
  main_caster: { label: "Caster Utama", hint: "Memandu jalannya pertandingan dari awal sampai akhir." },
  co_caster: { label: "Caster Pendamping", hint: "Mendampingi caster utama dengan analisis ringan dan hiburan." },
  analyst: { label: "Analis", hint: "Membahas strategi, statistik, dan prediksi pertandingan." },
  host: { label: "Host", hint: "Membawakan acara, wawancara, dan segmen antar pertandingan." },
  observer: { label: "Observer", hint: "Mengatur sudut kamera dan jalannya siaran pertandingan." },
};

export const ESPORT_STREAM_PLATFORM_META: Record<string, { label: string }> = {
  youtube: { label: "YouTube" },
  twitch: { label: "Twitch" },
  tiktok: { label: "TikTok" },
  facebook: { label: "Facebook" },
  kick: { label: "Kick" },
  custom: { label: "Lainnya" },
};

export const ESPORT_MEMBER_ROLE_META: Record<string, { label: string }> = {
  captain: { label: "Kapten" },
  member: { label: "Anggota" },
  substitute: { label: "Pemain Cadangan" },
  coach: { label: "Pelatih" },
  manager: { label: "Manajer" },
};

export const ESPORT_BR_PLACEMENT_POINTS: Record<number, number> = {
  1: 10,
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
  7: 1,
  8: 1,
};

export const ESPORT_STAGE_LABEL: Record<string, string> = {
  main: "Bagan Utama",
  winners: "Bracket Menang",
  losers: "Bracket Kalah",
  grand_final: "Grand Final",
  group: "Fase Grup",
  playoff: "Playoff",
  rr: "Round Robin",
  league: "Liga",
  lobby: "Lobi Battle Royale",
};

const ESPORT_KNOCKOUT_STAGES = new Set(["main", "playoff", "winners", "losers"]);

// Nama ronde knockout dihitung dari jarak ke ronde terakhir, agar ronde penentu
// selalu terbaca sebagai Semifinal/Grand Final berapa pun jumlah timnya.
export function esportRoundLabel(stage: string, round: number, maxRound: number): string {
  if (stage === "grand_final") return "Grand Final";
  if (!ESPORT_KNOCKOUT_STAGES.has(stage)) return `Ronde ${round}`;
  const fromEnd = maxRound - round;
  if (fromEnd === 0) {
    if (stage === "winners") return "Final Bracket Menang";
    if (stage === "losers") return "Final Bracket Kalah";
    return "Grand Final";
  }
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Perempat Final";
  if (fromEnd === 3) return "Babak 16 Besar";
  if (fromEnd === 4) return "Babak 32 Besar";
  return `Ronde ${round}`;
}

export const ESPORT_SEEDING_META: Record<string, { label: string; hint: string }> = {
  random: { label: "Acak", hint: "Urutan tim diundi acak oleh sistem." },
  registration: { label: "Urutan Daftar", hint: "Tim pertama mendaftar mendapat unggulan teratas." },
  rank: { label: "Peringkat Pemain", hint: "Tim dengan rata-rata level anggota tertinggi menjadi unggulan teratas." },
  manual: { label: "Manual", hint: "Atur nomor unggulan tiap tim sendiri sebelum membuat bagan." },
};

export const ESPORT_BEST_OF_OPTIONS: readonly number[] = [1, 3, 5, 7];

export const ESPORT_TRANSFER_FEE_MAX = 50_000_000;

export const ESPORT_TRANSFER_TYPE_META: Record<string, { label: string; short: string; hint: string; tone: string }> = {
  sale: {
    label: "Transfer Permanen",
    short: "Permanen",
    hint: "Pemain pindah selamanya ke tim pembeli setelah pembayaran escrow dan konfirmasi.",
    tone: "bg-sky-100 text-sky-800",
  },
  loan: {
    label: "Pinjaman",
    short: "Pinjaman",
    hint: "Pemain bermain untuk tim peminjam sampai masa pinjaman berakhir, lalu kembali ke tim asal.",
    tone: "bg-violet-100 text-violet-800",
  },
  loan_to_buy: {
    label: "Pinjaman + Opsi Beli",
    short: "Opsi Beli",
    hint: "Pinjaman dengan harga opsi — tim peminjam bisa mempermanenkan pemain selama masa pinjaman.",
    tone: "bg-indigo-100 text-indigo-800",
  },
  free_agent: {
    label: "Free Agent",
    short: "Free Agent",
    hint: "Pemain tanpa tim yang bisa direkrut gratis tanpa pembayaran escrow.",
    tone: "bg-emerald-100 text-emerald-800",
  },
};

export const ESPORT_PLAYER_STATUS_META: Record<string, { label: string; tone: string }> = {
  free_agent: { label: "Free Agent", tone: "bg-emerald-100 text-emerald-800" },
  contracted: { label: "Terikat Kontrak", tone: "bg-sky-100 text-sky-800" },
  on_loan: { label: "Sedang Dipinjam", tone: "bg-violet-100 text-violet-800" },
  retired: { label: "Pensiun", tone: "bg-slate-200 text-slate-700" },
};

export const ESPORT_LISTING_STATUS_META: Record<string, { label: string; tone: string }> = {
  open: { label: "Terbuka", tone: "bg-emerald-100 text-emerald-800" },
  paused: { label: "Dijeda", tone: "bg-amber-100 text-amber-800" },
  closed: { label: "Ditutup", tone: "bg-slate-100 text-slate-600" },
  completed: { label: "Selesai", tone: "bg-teal-100 text-teal-800" },
};

export const ESPORT_OFFER_STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "Menunggu Jawaban", tone: "bg-amber-100 text-amber-800" },
  countered: { label: "Dibalas Penawaran", tone: "bg-sky-100 text-sky-800" },
  accepted: { label: "Diterima", tone: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Ditolak", tone: "bg-rose-100 text-rose-800" },
  withdrawn: { label: "Ditarik", tone: "bg-slate-100 text-slate-600" },
  expired: { label: "Kedaluwarsa", tone: "bg-slate-100 text-slate-600" },
};

export const ESPORT_TRANSFER_STATUS_META: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: "Menunggu Pembayaran", tone: "bg-amber-100 text-amber-800" },
  escrow_held: { label: "Escrow Diterima", tone: "bg-sky-100 text-sky-800" },
  completed: { label: "Selesai", tone: "bg-teal-100 text-teal-800" },
  cancelled: { label: "Dibatalkan", tone: "bg-rose-100 text-rose-800" },
};

export const ESPORT_CONTRACT_TYPE_META: Record<string, { label: string; tone: string }> = {
  permanent: { label: "Kontrak Permanen", tone: "bg-sky-100 text-sky-800" },
  free_agent: { label: "Kontrak Free Agent", tone: "bg-emerald-100 text-emerald-800" },
  loan: { label: "Kontrak Pinjaman", tone: "bg-violet-100 text-violet-800" },
};

export const ESPORT_CONTRACT_STATUS_META: Record<string, { label: string; tone: string }> = {
  active: { label: "Aktif", tone: "bg-emerald-100 text-emerald-800" },
  terminated: { label: "Diakhiri", tone: "bg-slate-100 text-slate-600" },
  expired: { label: "Berakhir", tone: "bg-slate-100 text-slate-600" },
};

export const ESPORT_WINDOW_STATUS_META: Record<string, { label: string; tone: string }> = {
  upcoming: { label: "Belum Dibuka", tone: "bg-sky-100 text-sky-800" },
  open: { label: "Dibuka", tone: "bg-emerald-100 text-emerald-800" },
  closed: { label: "Ditutup", tone: "bg-slate-100 text-slate-600" },
};

// ========== Fase A: Enhanced Transfer Market Constants ==========

export const ESPORT_PLAYER_ROLE_META: Record<string, { label: string; short: string }> = {
  tank: { label: "Tank", short: "TK" },
  fighter: { label: "Fighter", short: "FG" },
  assassin: { label: "Assassin", short: "AS" },
  mage: { label: "Mage", short: "MG" },
  marksman: { label: "Marksman", short: "MM" },
  support: { label: "Support", short: "SP" },
  jungler: { label: "Jungler", short: "JG" },
  roamer: { label: "Roamer", short: "RM" },
  exp_lane: { label: "Exp Lane", short: "EXP" },
  mid_lane: { label: "Mid Lane", short: "MID" },
  gold_lane: { label: "Gold Lane", short: "GLD" },
  captain: { label: "Kapten", short: "CPT" },
  coach: { label: "Pelatih", short: "COA" },
  analyst: { label: "Analis", short: "ANL" },
  substitute: { label: "Pemain Cadangan", short: "SUB" },
  sniper: { label: "Sniper", short: "SNP" },
  entry_fragger: { label: "Entry Fragger", short: "EFR" },
  support_fragger: { label: "Support Fragger", short: "SFR" },
  awper: { label: "AWPer", short: "AWP" },
  igl: { label: "In-Game Leader", short: "IGL" },
};

export const ESPORT_TRANSFER_DISPUTE_STATUS_META: Record<string, { label: string; tone: string }> = {
  open: { label: "Terbuka", tone: "bg-red-100 text-red-800" },
  under_review: { label: "Sedang Ditinjau", tone: "bg-amber-100 text-amber-800" },
  resolved: { label: "Diselesaikan", tone: "bg-emerald-100 text-emerald-800" },
  dismissed: { label: "Ditolak", tone: "bg-slate-100 text-slate-600" },
};

export const ESPORT_DATA_SOURCE_META: Record<string, { label: string; hint: string }> = {
  manual: { label: "Input Manual", hint: "Data diinput oleh pemain atau admin" },
  api: { label: "API Game", hint: "Data otomatis dari API game" },
  verified: { label: "Terverifikasi", hint: "Data telah diverifikasi oleh admin" },
};

export const ESPORT_RATING_LABELS: Record<number, string> = {
  1: "Sangat Buruk",
  2: "Buruk",
  3: "Cukup",
  4: "Baik",
  5: "Sangat Baik",
};

export const CALENDAR_KIND_META: Record<string, { emoji: string; tone: string; dot: string }> = {
  event: { emoji: "📅", tone: "bg-indigo-100 text-indigo-800 border-indigo-200", dot: "bg-indigo-500" },
  esport: { emoji: "🎮", tone: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  tugas: { emoji: "✅", tone: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  konseling: { emoji: "💬", tone: "bg-violet-100 text-violet-800 border-violet-200", dot: "bg-violet-500" },
  langganan: { emoji: "💎", tone: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  pribadi: { emoji: "📌", tone: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-500" },
};
