import type { Audience, ProgramCategory, PublicRole, Role, SupportType, WidowRole } from "./types";

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
