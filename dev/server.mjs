// Local fixture server for the Panti Janda Function.
// Usage: node dev/server.mjs   (listens on 127.0.0.1:8000, proxied by Vite as /functions/v1/app)
// Data lives in memory only; restart to reseed. Deno is not required here.

import { createServer } from "node:http";
import { createFakeSupabase } from "./fake-supabase.mjs";
import { handleApp, __internals } from "../functions/handler.mjs";

const { hashPassword } = __internals;
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const days = (n, hours = 9) => {
  const d = new Date(Date.now() + n * 86400000);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
};

async function seed() {
  const password = await hashPassword("rahasia123");
  const accounts = [];
  const profiles = [];
  const account = async (email, role, displayName, extra = {}) => {
    const row = {
      id: id(),
      email,
      password_hash: password,
      role,
      status: "active",
      display_name: displayName,
      level: extra.level ?? 1,
      xp: extra.xp ?? 0,
      created_at: now(),
      ...extra,
    };
    accounts.push(row);
    return row;
  };
  const profile = (owner, fields) => {
    const row = {
      id: id(),
      account_id: owner.id,
      nickname: fields.nickname,
      tier: fields.tier ?? "wonder_woman",
      full_name: fields.fullName ?? null,
      verification_doc_type: fields.verificationDocType ?? null,
      verification_doc_name: fields.verificationDocName ?? null,
      verification_doc_data: fields.verificationDocData ?? null,
      city: fields.city ?? null,
      age: fields.age ?? null,
      dependents: fields.dependents ?? null,
      employment_status: fields.employmentStatus ?? null,
      skills: fields.skills ?? [],
      trainings: fields.trainings ?? [],
      needs_target: fields.needsTarget ?? null,
      main_target: fields.mainTarget ?? null,
      interests: fields.interests ?? [],
      bio: fields.bio ?? null,
      funding_info: fields.fundingInfo ?? null,
      photo_data: fields.photoData ?? null,
      education: fields.education ?? null,
      insurance: fields.insurance ?? null,
      height_cm: fields.heightCm ?? null,
      weight_kg: fields.weightKg ?? null,
      birth_place: fields.birthPlace ?? null,
      birth_date: fields.birthDate ?? null,
      sim_classes: fields.simClasses ?? [],
      passport: fields.passport ?? null,
      bank_name: fields.bankName ?? null,
      bank_account_name: fields.bankAccountName ?? null,
      bank_account_number: fields.bankAccountNumber ?? null,
      whatsapp: fields.whatsapp ?? null,
      address: fields.address ?? null,
      status: fields.status ?? "verified",
      reject_reason: null,
      verified_at: fields.status === "pending" ? null : now(),
      created_at: now(),
      updated_at: now(),
    };
    profiles.push(row);
    return row;
  };

  const admin = await account("admin@pantijanda.id", "admin", "Pengelola Panti Janda", { level: 50, xp: 240100 });
  const wulan = await account("wulan@contoh.id", "wonder_woman", "Wulan", { level: 5, xp: 3600 });
  const sari = await account("sari@contoh.id", "wonder_woman", "Sari", { level: 3, xp: 500 });
  const dewi = await account("dewi@contoh.id", "wonder_woman", "Dewi", { level: 7, xp: 9100 });
  const rina = await account("rina@contoh.id", "sosialita", "Rina", { level: 25, xp: 50700 });
  const ayu = await account("ayu@contoh.id", "high_society", "Ayu", { level: 40, xp: 156800 });
  const citra = await account("citra@contoh.id", "the_ceo", "Citra", { level: 48, xp: 217800 });
  const budi = await account("budi@contoh.id", "kades", "Budi S.", { level: 5, xp: 3000 });

  const pWulan = profile(wulan, {
    nickname: "Wulan",
    fullName: "Wulan Kartika",
    city: "Bandung",
    age: 34,
    dependents: 2,
    employmentStatus: "Penjahit rumahan",
    skills: ["Menjahit", "Desain pola", "Pemasaran online"],
    trainings: ["Pelatihan Menjahit Dasar", "Seminar UMKM Digital"],
    needsTarget: "Modal usaha Rp 15 juta untuk mesin jahit industri dan kain",
    mainTarget: "Membuka butik kecil dan menerima pesanan seragam sekolah",
    interests: ["Fesyen", "Kewirausahaan", "Pendidikan anak"],
    bio: "Sejak suami meninggal tiga tahun lalu, saya menghidupi dua anak dari jahitan. Saya ingin usaha ini tumbuh agar anak-anak bisa terus sekolah.",
    fundingInfo: "Dukungan dana melalui transfer bank (rekening usaha) atau bantuan alat kerja.",
    education: "SMA",
    insurance: "BPJS Kesehatan",
    heightCm: 158,
    weightKg: 54,
    birthPlace: "Bandung",
    birthDate: "1992-03-14",
    simClasses: ["A", "B1"],
    passport: false,
    bankName: "Bank Mandiri",
    bankAccountName: "Wulan Kartika",
    bankAccountNumber: "1370099887766",
    whatsapp: "6281234567890",
    address: "Jl. Cihampelas No. 123, Bandung",
  });
  const pSari = profile(sari, {
    nickname: "Sari",
    fullName: "Sari Wulandari",
    verificationDocType: "ktp",
    verificationDocName: "ktp-sari.jpg",
    verificationDocData:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
    city: "Yogyakarta",
    age: 41,
    dependents: 3,
    employmentStatus: "Pedagang pasar",
    skills: ["Berjualan", "Memasak"],
    trainings: ["Pelatihan Manajemen Kios"],
    needsTarget: "Penambahan modal dagangan sayur Rp 8 juta",
    mainTarget: "Membuka kios sembako kecil di depan rumah",
    interests: ["Kuliner", "Perdagangan"],
    bio: "Saya berdagang sayur di pasar sejak dulu. Ingin menambah modal agar bisa sewa kios tetap.",
    status: "pending",
  });
  const pDewi = profile(dewi, {
    nickname: "Dewi",
    fullName: "Dewi Anggraini",
    city: "Jakarta",
    age: 29,
    dependents: 1,
    employmentStatus: "Produksi kue rumahan",
    skills: ["Membuat kue", "Fotografi produk", "Akuntansi dasar"],
    trainings: ["Akademi Wirausaha Janda Tangguh", "Pelatihan Sertifikasi HALAL"],
    needsTarget: "Oven besar dan kemasan berlabel Rp 12 juta",
    mainTarget: "Produk kue kering masuk ritel modern",
    interests: ["Kuliner", "Branding", "Komunitas"],
    bio: "Empat bulan setelah suami berpulang, saya memulai usaha kue kering untuk membiayai anak saya yang masih balita.",
    fundingInfo: "Bisa dibantu alat produksi atau pembelian produk jadi.",
    education: "D3",
    insurance: "BPJS Kesehatan",
    heightCm: 163,
    weightKg: 58,
    birthPlace: "Bogor",
    birthDate: "1997-08-02",
    simClasses: ["A"],
    passport: true,
    bankName: "Bank BCA",
    bankAccountName: "Dewi Anggraini",
    bankAccountNumber: "5410987654",
  });
  const pRina = profile(rina, {
    nickname: "Rina",
    fullName: "Rina Susanti",
    tier: "sosialita",
    city: "Surabaya",
    age: 45,
    dependents: 2,
    employmentStatus: "Guru les privat",
    skills: ["Mengajar", "Manajemen acara", "Public speaking"],
    trainings: ["Pelatihan Kepemimpinan Komunitas"],
    needsTarget: "Ruangan belajar bersama untuk 20 anak",
    mainTarget: "Pusat belajar komunitas untuk anak anggota",
    interests: ["Pendidikan", "Sosial"],
    bio: "Sepuluh tahun mendampingi ibu-ibu janda di kampung saya untuk bangkit kembali.",
  });
  const pAyu = profile(ayu, {
    nickname: "Ayu",
    fullName: "Ayu Prameswari",
    tier: "high_society",
    city: "Jakarta",
    age: 52,
    dependents: 0,
    employmentStatus: "Pemilik butik",
    skills: ["Bisnis ritel", "Fundraising", "Jaringan usaha"],
    trainings: ["Program Filantropi Perempuan"],
    needsTarget: "Pendanaan program pelatihan tahunan anggota",
    mainTarget: "Menghubungkan 100 janda dengan pekerjaan layak",
    interests: ["Fesyen", "Filantropi"],
    bio: "Saya percaya setiap perempuan berhak memulai babak baru yang bermartabat.",
  });

  const pCitra = profile(citra, {
    nickname: "Citra",
    fullName: "Citra Kusumawardani",
    tier: "the_ceo",
    city: "Surabaya",
    age: 45,
    dependents: 1,
    employmentStatus: "Direktur yayasan",
    skills: ["Manajemen organisasi", "Strategi komunitas", "Public speaking", "Fundraising"],
    trainings: ["Leadership Excellence Program", "Social Enterprise Management"],
    needsTarget: "Pengembangan program pemberdayaan janda nasional",
    mainTarget: "Membangun ekosistem mandiri untuk janda di seluruh Indonesia",
    interests: ["Kepemimpinan", "Pemberdayaan perempuan", "Sosial enterprise"],
    bio: "Dedikasi saya adalah memastikan setiap janda memiliki akses ke peluang dan dukungan yang layak.",
  });

  const updates = [
    {
      id: id(),
      profile_id: pWulan.id,
      title: "Kelas menjahit angkatan kedua dibuka",
      body: "Alhamdulillah, angkatan pertama selesai dengan 12 peserta. Bulan depan saya membuka kelas kedua. Peserta akan diajari pola dasar hingga menjahit seragam anak sekolah.",
      status: "visible",
      created_at: days(-12),
    },
    {
      id: id(),
      profile_id: pWulan.id,
      title: "Terima kasih atas bantuan mesin jahit",
      body: "Mesin jahit bantuan dari donatur sudah terpasang. Pesanan seragam 60 potong selesai tepat waktu. Terima kasih, semoga menjadi kebaikan yang berlipat.",
      status: "visible",
      created_at: days(-5),
    },
    {
      id: id(),
      profile_id: pDewi.id,
      title: "Pesanan kue kering mulai dibuka",
      body: "Saya menerima pesanan kue kering nastar dan kastengel untuk hari raya. Setiap pesanan berarti satu langkah lagi menuju oven baru.",
      status: "visible",
      created_at: days(-3),
    },
  ];
  const comments = [
    {
      id: id(),
      update_id: updates[0].id,
      account_id: budi.id,
      author_name: "Budi S.",
      body: "Sukses terus Bu Wulan! Saya titip pesan seragam untuk anak saya ya.",
      status: "visible",
      created_at: days(-10),
    },
    {
      id: id(),
      update_id: updates[0].id,
      account_id: dewi.id,
      author_name: "Dewi",
      body: "Barakallah, semoga kelasnya penuh peminat.",
      status: "visible",
      created_at: days(-9),
    },
  ];

  const groups = [
    {
      id: id(),
      name: "Kelompok Menjahit Nusantara",
      description: "Kelompok minat menjahit: berbagi pola, teknik, dan menerima pesanan bersama.",
      audience_min_role: "wonder_woman",
      capacity: 40,
      created_by: rina.id,
      created_at: now(),
    },
    {
      id: id(),
      name: "Lingkar Sosialita",
      description: "Ruang koordinasi penggerak kegiatan Panti Janda: jadwal, kelompok, dan evaluasi program.",
      audience_min_role: "sosialita",
      capacity: 20,
      created_by: ayu.id,
      created_at: now(),
    },
  ];

  const events = [
    {
      id: id(),
      title: "Bazar UMKM Perempuan Tangguh",
      description: "Bazar terbuka untuk umum: produk jahitan, kue, dan kerajinan anggota Panti Janda. Seluruh hasil penjualan langsung untuk anggota.",
      audience: "umum",
      location: "Lapangan Banteng, Jakarta",
      starts_at: days(14),
      ends_at: days(15, 16),
      capacity: 500,
      funding_target: null,
      ticket_price: null,
      group_id: null,
      status: "published",
      created_by: ayu.id,
      created_at: now(),
    },
    {
      id: id(),
      title: "Kelas Kepemimpinan Sosialita",
      description: "Pelatihan internal untuk tier Sosialita: mengelola kegiatan, memimpin kelompok, dan menyusun jadwal pendampingan.",
      audience: "anggota",
      location: "Ruang komunitas Panti Janda, Surabaya",
      starts_at: days(7),
      ends_at: days(7, 15),
      capacity: 30,
      funding_target: null,
      ticket_price: null,
      group_id: groups?.[0]?.id ?? null,
      status: "published",
      created_by: rina.id,
      created_at: now(),
    },
    {
      id: id(),
      title: "Makan Malam Donatur Utama",
      description: "Makan malam terbatas bersama para pendukung program. Undangan dikirim langsung kepada tamu terpilih.",
      audience: "undangan",
      location: "Hotel Mulia, Jakarta",
      starts_at: days(21, 18),
      ends_at: days(21, 22),
      capacity: 40,
      funding_target: 250000000,
      ticket_price: 500000,
      group_id: null,
      status: "published",
      created_by: ayu.id,
      created_at: now(),
    },
  ];
  const eventInvites = [
    { id: id(), event_id: events[2].id, account_id: rina.id, created_at: now() },
    { id: id(), event_id: events[2].id, account_id: wulan.id, created_at: now() },
  ];
  const eventRsvps = [
    { id: id(), event_id: events[0].id, account_id: budi.id, status: "going", created_at: now() },
    { id: id(), event_id: events[1].id, account_id: wulan.id, status: "going", created_at: now() },
  ];

  const groupMembers = [
    { id: id(), group_id: groups[0].id, account_id: wulan.id, created_at: now() },
    { id: id(), group_id: groups[0].id, account_id: dewi.id, created_at: now() },
    { id: id(), group_id: groups[1].id, account_id: rina.id, created_at: now() },
    { id: id(), group_id: groups[1].id, account_id: ayu.id, created_at: now() },
  ];

  const follows = [
    { id: id(), follower_account_id: wulan.id, followed_account_id: dewi.id, created_at: days(-3) },
    { id: id(), follower_account_id: dewi.id, followed_account_id: wulan.id, created_at: days(-2) },
    { id: id(), follower_account_id: rina.id, followed_account_id: wulan.id, created_at: days(-1) },
  ];
  const messages = [
    {
      id: id(),
      thread_kind: "dm",
      sender_account_id: dewi.id,
      recipient_account_id: wulan.id,
      group_id: null,
      body: "Assalamualaikum Bu Wulan. Saya Dewi, boleh tanya soal bahan untuk kemasan produk?",
      created_at: days(-2, 10),
    },
    {
      id: id(),
      thread_kind: "dm",
      sender_account_id: wulan.id,
      recipient_account_id: dewi.id,
      group_id: null,
      body: "Waalaikumsalam Dewi. Silakan, mau tanya apa ya?",
      created_at: days(-2, 11),
    },
    {
      id: id(),
      thread_kind: "dm",
      sender_account_id: dewi.id,
      recipient_account_id: wulan.id,
      group_id: null,
      body: "Saya mau kemasan kue yang tahan lama tapi harganya ramah pemula. Ada rekomendasi?",
      created_at: days(-1, 9),
    },
    {
      id: id(),
      thread_kind: "dm",
      sender_account_id: wulan.id,
      recipient_account_id: dewi.id,
      group_id: null,
      body: "Cari toples kaca ukuran 500 ml atau standing pouch laminasi. Nanti saya kirim kontak supplier yang biasa saya pakai.",
      created_at: days(-1, 10),
    },
    {
      id: id(),
      thread_kind: "group",
      sender_account_id: wulan.id,
      recipient_account_id: null,
      group_id: groups[0].id,
      body: "Selamat pagi semua. Sabtu ini kita bahas pola seragam anak, ya. Tolong bawa buku pola masing-masing.",
      created_at: days(-3, 8),
    },
    {
      id: id(),
      thread_kind: "group",
      sender_account_id: dewi.id,
      recipient_account_id: null,
      group_id: groups[0].id,
      body: "Siap, Bu Wulan. Saya juga bawa sampel kemasan kue untuk teman-teman yang mau jualan.",
      created_at: days(-3, 9),
    },
    {
      id: id(),
      thread_kind: "group",
      sender_account_id: wulan.id,
      recipient_account_id: null,
      group_id: groups[0].id,
      body: "Mantap. Kalau ada yang tidak bisa hadir, kabar di grup ini saja.",
      created_at: days(-2, 8),
    },
  ];

  const programs = [
    {
      id: id(),
      title: "Akademi Wirausaha Janda Tangguh",
      category: "akademi",
      description: "Program 4 bulan: menyusun rencana usaha, pembukuan sederhana, pemasaran digital, dan pendampingan modal.",
      schedule: "Kelas online setiap Sabtu, mulai 12 Oktober 2026",
      seats: 30,
      status: "published",
      created_by: ayu.id,
      created_at: now(),
    },
    {
      id: id(),
      title: "Pelatihan Menjahit Lanjutan",
      category: "pelatihan",
      description: "Teknik pola industri dan manajemen pesanan untuk anggota yang sudah menyelesaikan kelas dasar.",
      schedule: "3 sesi, 18–20 Oktober 2026, Bandung",
      seats: 15,
      status: "published",
      created_by: rina.id,
      created_at: now(),
    },
    {
      id: id(),
      title: "Seminar Kesehatan Mental & Ketahanan Diri",
      category: "seminar",
      description: "Bersama psikolog komunitas: mengelola duka, membangun kembali rasa percaya diri, dan merawat anak.",
      schedule: "Sabtu, 8 November 2026, daring",
      seats: 100,
      status: "published",
      created_by: rina.id,
      created_at: now(),
    },
    {
      id: id(),
      title: "Penempatan Kerja: Asisten Toko Profesional",
      category: "penempatan_kerja",
      description: "Kemitraan dengan jaringan ritel untuk menempatkan anggota pada posisi asisten toko dengan upah layak.",
      schedule: "Seleksi berjalan, penempatan mulai Desember 2026",
      seats: 10,
      status: "published",
      created_by: ayu.id,
      created_at: now(),
    },
  ];
  const programParticipants = [
    { id: id(), program_id: programs[0].id, account_id: dewi.id, created_at: now() },
    { id: id(), program_id: programs[0].id, account_id: wulan.id, created_at: now() },
    { id: id(), program_id: programs[2].id, account_id: sari.id, created_at: now() },
  ];

  const pledges = [
    {
      id: id(),
      profile_id: pWulan.id,
      account_id: budi.id,
      supporter_name: "Budi S.",
      contact: "budi@contoh.id",
      support_type: "dana",
      amount: 500000,
      message: "Semoga usahanya makin lancar.",
      status: "baru",
      created_at: days(-4),
    },
    {
      id: id(),
      profile_id: pWulan.id,
      account_id: null,
      supporter_name: "Ibu Ratna",
      contact: "0812-3456-7890",
      support_type: "jasa",
      amount: null,
      message: "Saya bisa bantu foto produk untuk katalog online.",
      status: "ditindaklanjuti",
      created_at: days(-2),
    },
  ];
  const donations = [
    {
      id: id(),
      profile_id: pWulan.id,
      order_id: "PJ-1727000000-abcd",
      gross_amount: 1500000,
      supporter_name: "Hamba Allah",
      supporter_email: null,
      status: "settled",
      gateway: "midtrans",
      redirect_url: null,
      created_at: days(-6),
      updated_at: days(-6),
    },
    {
      id: id(),
      profile_id: pWulan.id,
      order_id: "PJ-1727500000-efgh",
      gross_amount: 500000,
      supporter_name: "Budi S.",
      supporter_email: "budi@contoh.id",
      status: "pending",
      gateway: "midtrans",
      redirect_url: null,
      created_at: days(-1),
      updated_at: days(-1),
    },
  ];

  const campaigns = [
    {
      id: id(),
      profile_id: pWulan.id,
      title: "Mesin Jahit Industri untuk Butik Wulan",
      description: "Bantu Wulan membeli mesin jahit industri senilai Rp 15 juta untuk mengembangkan usaha jahitnya. Dengan mesin ini, Wulan bisa menerima pesanan seragam dalam jumlah besar dan membuka butik kecil.",
      target_amount: 15000000,
      collected_amount: 7500000,
      deadline: days(30),
      status: "open",
      donor_count: 12,
      created_at: days(-10),
    },
    {
      id: id(),
      profile_id: pDewi.id,
      title: "Oven Besar untuk Produksi Kue Dewi",
      description: "Dewi membutuhkan oven besar senilai Rp 12 juta untuk meningkatkan produksi kue keringnya. Donasi akan digunakan untuk membeli oven dan kemasan berlabel HALAL.",
      target_amount: 12000000,
      collected_amount: 3000000,
      deadline: days(45),
      status: "open",
      donor_count: 5,
      created_at: days(-5),
    },
  ];
  const campaignDonations = [
    {
      id: id(),
      campaign_id: campaigns[0].id,
      order_id: "PJC-1727000000-xxxx",
      amount: 5000000,
      supporter_name: "Hamba Allah",
      supporter_email: null,
      message: "Semoga usahanya berkah.",
      status: "settled",
      created_at: days(-8),
    },
    {
      id: id(),
      campaign_id: campaigns[0].id,
      order_id: "PJC-1727500000-yyyy",
      amount: 2500000,
      supporter_name: "Budi S.",
      supporter_email: "budi@contoh.id",
      message: "Sukses Bu Wulan!",
      status: "settled",
      created_at: days(-3),
    },
  ];

  const eventCommittees = [
    {
      id: id(),
      event_id: events[0].id,
      account_id: rina.id,
      role: "koordinator",
      created_at: days(-10),
    },
  ];

  const eventTickets = [
    {
      id: id(),
      event_id: events[0].id,
      account_id: budi.id,
      code: `PJ:${events[0].id.slice(0, 8)}:${budi.id.slice(0, 8)}-abc`,
      ticket_type: "free",
      price: 0,
      order_id: null,
      payment_status: null,
      status: "valid",
      created_at: days(-5),
    },
  ];

  const eventAttendance = [];

  const kpiLogs = [
    {
      id: id(),
      account_id: wulan.id,
      source_type: "event_create",
      source_id: events[0].id,
      points: 50,
      created_at: days(-10),
    },
    {
      id: id(),
      account_id: rina.id,
      source_type: "event_committee",
      source_id: events[0].id,
      points: 30,
      created_at: days(-9),
    },
  ];

  const kpiSummary = [
    {
      account_id: wulan.id,
      total_points: 3600,
      level: 5,
      updated_at: days(-10),
    },
    {
      account_id: sari.id,
      total_points: 500,
      level: 3,
      updated_at: days(-8),
    },
    {
      account_id: dewi.id,
      total_points: 9100,
      level: 7,
      updated_at: days(-7),
    },
    {
      account_id: rina.id,
      total_points: 50700,
      level: 25,
      updated_at: days(-9),
    },
    {
      account_id: ayu.id,
      total_points: 156800,
      level: 40,
      updated_at: days(-6),
    },
    {
      account_id: citra.id,
      total_points: 217800,
      level: 48,
      updated_at: days(-5),
    },
    {
      account_id: budi.id,
      total_points: 3000,
      level: 5,
      updated_at: days(-4),
    },
  ];

  const badges = [];

  const coinBalances = [
    {
      account_id: wulan.id,
      balance: 650,
      lifetime_purchased: 1000,
      lifetime_spent: 350,
      updated_at: days(-2),
    },
    {
      account_id: rina.id,
      balance: 2500,
      lifetime_purchased: 2500,
      lifetime_spent: 0,
      updated_at: days(-1),
    },
    {
      account_id: budi.id,
      balance: 150,
      lifetime_purchased: 500,
      lifetime_spent: 350,
      updated_at: days(-3),
    },
  ];

  const coinTransactions = [
    {
      id: id(),
      account_id: wulan.id,
      type: "purchase",
      amount: 1000,
      balance_after: 1000,
      description: "Pembelian 1.000 koin",
      reference_id: "order-coin-wulan-001",
      created_at: days(-5),
    },
    {
      id: id(),
      account_id: wulan.id,
      type: "spend",
      amount: -350,
      balance_after: 650,
      description: "Penggunaan koin untuk fitur premium",
      reference_id: null,
      created_at: days(-2),
    },
    {
      id: id(),
      account_id: rina.id,
      type: "purchase",
      amount: 2500,
      balance_after: 2500,
      description: "Pembelian 2.500 koin",
      reference_id: "order-coin-rina-001",
      created_at: days(-1),
    },
    {
      id: id(),
      account_id: budi.id,
      type: "purchase",
      amount: 500,
      balance_after: 500,
      description: "Pembelian 500 koin",
      reference_id: "order-coin-budi-001",
      created_at: days(-4),
    },
    {
      id: id(),
      account_id: budi.id,
      type: "spend",
      amount: -350,
      balance_after: 150,
      description: "Penggunaan koin untuk fitur premium",
      reference_id: null,
      created_at: days(-3),
    },
  ];

  return {
    accounts,
    profiles,
    updates,
    comments,
    events,
    event_invites: eventInvites,
    event_rsvps: eventRsvps,
    groups,
    group_members: groupMembers,
    follows,
    messages,
    programs,
    program_participants: programParticipants,
    pledges,
    donations,
    reports: [],
    sessions: [],
    notifications: [
      {
        id: id(),
        recipient_account_id: wulan.id,
        type: "follow",
        actor_account_id: rina.id,
        message: "Mulai mengikuti Anda",
        link: null,
        read: false,
        created_at: days(-1, 14),
      },
      {
        id: id(),
        recipient_account_id: wulan.id,
        type: "message",
        actor_account_id: dewi.id,
        message: "Mengirimkan pesan",
        link: `#/pesan?with=${dewi.id}`,
        read: true,
        created_at: days(-2, 10),
      },
      {
        id: id(),
        recipient_account_id: wulan.id,
        type: "donation",
        actor_account_id: null,
        message: "Donasi Rp1.500.000 diterima",
        link: null,
        read: true,
        created_at: days(-6),
      },
    ],
    campaigns,
    campaign_donations: campaignDonations,
    businesses: [
      {
        id: id(),
        profile_id: pWulan.id,
        business_type: "Fesyen & Tekstil",
        title: "Butik Jahit Wulan",
        description: "Menerima pesanan jahitan pakaian dan seragam sekolah dengan kualitas terbaik.",
        proposal:
          "Saya membutuhkan mesin jahit industri baru dan modal untuk stok kain. Dengan peralatan yang lebih baik, saya bisa menerima pesanan dalam jumlah lebih besar dan menyelesaikan lebih cepat.",
        capital_needed: 15000000,
        status: "approved",
        reject_reason: null,
        created_at: days(-10),
        updated_at: days(-8),
      },
      {
        id: id(),
        profile_id: pSari.id,
        business_type: "Kuliner",
        title: "Kue Kering Sari",
        description: "Produksi kue kering rumahan untuk hari raya dan acara spesial.",
        proposal:
          "Modal dibutuhkan untuk membeli oven industri dan bahan baku dalam jumlah besar. Target produksi 50 toples per minggu selama musim raya.",
        capital_needed: 8000000,
        status: "approved",
        reject_reason: null,
        created_at: days(-7),
        updated_at: days(-5),
      },
    ],
    business_rab: [],
    marketplace_listings: [
      {
        id: id(),
        seller_profile_id: pWulan.id,
        kind: "jasa",
        title: "Jasa Jahit Pakaian Custom",
        description: "Menerima pesanan jahit pakaian custom: kemeja, blouse, rok, dan gaun. Pola dibuat sesuai ukuran tubuh. Pengerjaan 3-7 hari kerja.",
        price: 150000,
        category: "Jasa Menjahit",
        status: "active",
        created_at: days(-5),
        updated_at: days(-5),
      },
      {
        id: id(),
        seller_profile_id: pDewi.id,
        kind: "barang",
        title: "Kue Kering Nastar & Kastengel",
        description: "Kue kering homemade untuk hari raya dan acara spesial. Bahan premium, tanpa pengawet. Tersedia kemasan gift box.",
        price: 85000,
        category: "Makanan & Minuman",
        status: "active",
        created_at: days(-3),
        updated_at: days(-3),
      },
      {
        id: id(),
        seller_profile_id: pRina.id,
        kind: "jasa",
        title: "Les Privat SD & SMP",
        description: "Bimbingan belajar untuk anak SD dan SMP. Mata pelajaran: Matematika, Bahasa Inggris, IPA. Bisa datang ke rumah atau online.",
        price: 75000,
        category: "Pendidikan & Pelatihan",
        status: "active",
        created_at: days(-2),
        updated_at: days(-2),
      },
    ],
    subscriptions: [],
    event_committees: eventCommittees,
    event_tickets: eventTickets,
    event_attendance: eventAttendance,
    kpi_logs: kpiLogs,
    kpi_summary: kpiSummary,
    badges,
    coin_balances: coinBalances,
    coin_transactions: coinTransactions,
  };
}

const tables = await seed();
const PORT = Number(process.env.PORT ?? 8000);

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, "http://127.0.0.1");
    if (incoming.method === "GET" && url.pathname === "/health") {
      outgoing.writeHead(200, { "content-type": "application/json" });
      outgoing.end('{"ok":true}');
      return;
    }
    if (url.pathname !== "/functions/v1/app") {
      outgoing.writeHead(404, { "content-type": "application/json" });
      outgoing.end('{"error":"not_found"}');
      return;
    }
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    const request = new Request(`http://127.0.0.1:8000${url.pathname}`, {
      method: incoming.method,
      headers: incoming.headers,
      body: raw.byteLength > 0 ? raw : undefined,
    });
    const failAll = url.searchParams.get("fixture") === "error";
    const supabase = createFakeSupabase({ tables, failAll });
    const response = await handleApp({ request, supabase });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.writeHead(500, { "content-type": "application/json" });
    outgoing.end('{"error":"fixture_failed"}');
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Panti Janda fixture Function: http://127.0.0.1:${PORT}/functions/v1/app`);
  console.log("Akun uji (kata sandi semua: rahasia123):");
  console.log("  admin@pantijanda.id  (admin)");
  console.log("  wulan@contoh.id      (wonder woman terverifikasi)");
  console.log("  sari@contoh.id       (wonder woman menunggu verifikasi)");
  console.log("  rina@contoh.id       (sosialita)");
  console.log("  ayu@contoh.id        (high society)");
  console.log("  citra@contoh.id      (the CEO)");
  console.log("  budi@contoh.id       (non janda)");
});
