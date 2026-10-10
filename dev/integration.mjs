// Local integration check: replays the exact payloads the pages send,
// through the Vite dev proxy (frontend -> /functions/v1/app -> fixture server).
// Usage: node dev/integration.mjs   (Vite dev server + node dev/server.mjs must be running)
const BASE = process.env.PJ_BASE ?? "http://127.0.0.1:5174/functions/v1/app";
const PASSWORD = "rahasia123";
const TEST_DOC = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof";

let pass = 0;
let fail = 0;

function report(name, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(action, payload = {}, token) {
  const response = await fetch(BASE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-app-session": token } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function ok(action, payload, token, name) {
  const res = await call(action, payload, token);
  const good = res.body?.ok === true;
  report(name ?? action, good, good ? "" : `status ${res.status} ${JSON.stringify(res.body)}`);
  return res.body?.data;
}

async function expectError(action, payload, token, code, name) {
  const res = await call(action, payload, token);
  const actual = res.body?.error;
  report(name ?? `${action} -> ${code}`, actual === code, `expected ${code}, got ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function login(email) {
  const data = await ok("auth.login", { email, password: PASSWORD }, undefined, `login ${email}`);
  return data?.token;
}

// ---------- guest ----------
const home = await ok("home.summary", {}, undefined, "guest: home.summary");
report("guest: home.summary shape", Array.isArray(home?.profiles) && Array.isArray(home?.programs), JSON.stringify(Object.keys(home ?? {})));

const list = await ok("profiles.list", { page: 1, perPage: 9 }, undefined, "guest: profiles.list");
report("guest: profiles.list only wonder_woman", (list?.items ?? []).every((p) => p.tier === "wonder_woman"), JSON.stringify((list?.items ?? []).map((p) => p.tier)));
report("guest: profiles.list hasMore flag", typeof list?.hasMore === "boolean");

const first = list?.items?.[0];
const detail = await ok("profiles.get", { id: first?.id }, undefined, "guest: profiles.get");
report("guest: profiles.get shape", Boolean(detail?.profile?.id) && typeof detail?.support === "object" && typeof detail?.paymentEnabled === "boolean", JSON.stringify(Object.keys(detail ?? {})));

await ok("programs.list", {}, undefined, "guest: programs.list");
const events = await ok("events.list", {}, undefined, "guest: events.list");
const publicEvent = (events?.items ?? []).find((e) => e.audience === "umum");

await expectError("groups.list", {}, undefined, "not_authenticated", "guest: groups.list blocked");
await expectError("groups.create", { name: "Grup Uji" }, undefined, "not_authenticated", "guest: groups.create blocked");

await ok(
  "pledges.create",
  {
    profileId: first?.id,
    supporterName: "Pengunjung Uji",
    contact: "081200000000",
    supportType: "dana",
    amount: 250000,
    message: "Semoga usaha Anda tumbuh.",
  },
  undefined,
  "guest: pledges.create (formulir komitmen)",
);

await expectError(
  "donations.create",
  { profileId: first?.id, amount: 100000 },
  undefined,
  "service_not_configured",
  "guest: donations.create without Midtrans key",
);

// ---------- wonder woman ----------
const dewi = await login("dewi@contoh.id");
const me = await ok("auth.me", {}, dewi, "member: auth.me (profil sendiri)");
report("member: auth.me mengembalikan profil akun sendiri", me?.profile?.accountId === me?.account?.id, JSON.stringify({ accountId: me?.account?.id, profileAccountId: me?.profile?.accountId }));
await ok(
  "profiles.update",
  {
    nickname: me?.profile?.nickname ?? "Dewi",
    fullName: me?.profile?.fullName ?? "Dewi Anggraini",
    city: "Jakarta",
    age: 29,
    dependents: 1,
    employmentStatus: "Produksi kue rumahan",
    skills: ["Membuat kue", "Fotografi produk"],
    trainings: ["Akademi Wirausaha Janda Tangguh"],
    needsTarget: "Oven besar dan kemasan berlabel",
    mainTarget: "Produk kue kering masuk ritel modern",
    interests: ["Kuliner", "Branding"],
    bio: "Membiayai anak dari usaha kue kering.",
    fundingInfo: "Bisa dibantu alat produksi.",
  },
  dewi,
  "member: profiles.update",
);

// ---------- pengaturan akun: foto, biodata, data bank ----------
const savedSettings = await ok(
  "profiles.update",
  {
    nickname: me?.profile?.nickname ?? "Dewi",
    fullName: me?.profile?.fullName ?? "Dewi Anggraini",
    photo: TEST_DOC,
    education: "SMA",
    insurance: "BPJS Kesehatan",
    height: 160,
    weight: 52,
    birthPlace: "Semarang",
    birthDate: "1995-03-08",
    simClasses: ["A", "C"],
    passport: true,
    bankName: "BRI",
    bankAccountName: "Dewi Anggraini",
    bankAccountNumber: "9876543210",
  },
  dewi,
  "member: profiles.update (pengaturan + data bank)",
);
report(
  "pengaturan: biodata & data bank tersimpan untuk pemilik",
  savedSettings?.profile?.bank?.bankAccountNumber === "9876543210" &&
    savedSettings?.profile?.education === "SMA" &&
    savedSettings?.profile?.simClasses?.join() === "A,C" &&
    savedSettings?.profile?.passport === true,
  JSON.stringify({ bank: savedSettings?.profile?.bank, sim: savedSettings?.profile?.simClasses }),
);
const publicProfile = await call("profiles.get", { id: savedSettings?.profile?.id });
const publicRow = publicProfile.body?.data?.profile;
report(
  "pengaturan: profil publik menyembunyikan bank, nama lengkap, dan biodata sensitif",
  publicRow?.bank === undefined &&
    publicRow?.fullName === undefined &&
    publicRow?.birthDate === undefined &&
    publicRow?.birthPlace === undefined &&
    publicRow?.heightCm === undefined &&
    publicRow?.weightKg === undefined,
  JSON.stringify({
    bank: publicRow?.bank,
    fullName: publicRow?.fullName,
    birthDate: publicRow?.birthDate,
    birthPlace: publicRow?.birthPlace,
    heightCm: publicRow?.heightCm,
    weightKg: publicRow?.weightKg,
  }),
);
report(
  "pengaturan: pendidikan, asuransi, SIM, paspor tetap publik",
  publicRow?.education === "SMA" &&
    publicRow?.insurance === "BPJS Kesehatan" &&
    publicRow?.simClasses?.join() === "A,C" &&
    publicRow?.passport === true,
  JSON.stringify({
    education: publicRow?.education,
    insurance: publicRow?.insurance,
    simClasses: publicRow?.simClasses,
    passport: publicRow?.passport,
  }),
);

// ---------- follow sesama anggota ----------
const peers = await ok("profiles.list", { page: 1, perPage: 12 }, dewi, "member: profiles.list");
const peer = (peers?.items ?? []).find((p) => p.accountId !== me?.account?.id);
const followed = await ok("follows.toggle", { accountId: peer?.accountId }, dewi, "member: follows.toggle ikuti");
report("follow: status mengikuti true", followed?.following === true, JSON.stringify(followed));
const detailFollow = await call("profiles.get", { id: peer?.id }, dewi);
report(
  "follow: viewerFollows terbaca di profil tujuan",
  detailFollow.body?.data?.follow?.viewerFollows === true,
  JSON.stringify(detailFollow.body?.data?.follow),
);
const unfollowed = await ok("follows.toggle", { accountId: peer?.accountId }, dewi, "member: follows.toggle berhenti");
report("follow: status mengikuti false", unfollowed?.following === false, JSON.stringify(unfollowed));
await expectError("follows.toggle", { accountId: me?.account?.id }, dewi, "cannot_follow_self", "member: follow diri sendiri ditolak");

// ---------- chat pribadi ----------
const contacts = await ok("chat.contacts", {}, dewi, "member: chat.contacts");
report("chat: kontak sesama anggota tersedia", (contacts?.items ?? []).length > 0, JSON.stringify(contacts?.items?.length));
await ok("chat.send", { withAccountId: peer?.accountId, body: "Halo, salam kenal dari uji integrasi." }, dewi, "member: chat.send");
const thread = await ok("chat.thread", { withAccountId: peer?.accountId }, dewi, "member: chat.thread");
report(
  "chat: pesan terkirim muncul di thread",
  (thread?.items ?? []).some((m) => m.body === "Halo, salam kenal dari uji integrasi."),
  JSON.stringify((thread?.items ?? []).map((m) => m.body)),
);
const update = await ok("updates.create", { title: "Kabar minggu ini", body: "Pesanan kue kering naik dua kali lipat." }, dewi, "member: updates.create");
await ok("pledges.mine", {}, dewi, "member: pledges.mine");
await ok("donations.mine", {}, dewi, "member: donations.mine");
await expectError("programs.enroll", { id: "tidak-ada" }, dewi, "not_found", "member: programs.enroll invalid id");

// ---------- sosialita creates programs/events/groups ----------
const rina = await login("rina@contoh.id");
const program = await ok(
  "programs.create",
  { title: "Akademi Wirausaha Angkatan 2", category: "akademi", description: "Kelas berjenjang.", schedule: "Sabtu, 10.00 WIB", seats: 20 },
  rina,
  "sosialita: programs.create",
);
const umumEvent = await ok(
  "events.create",
  {
    title: "Bazar Umum Panti Janda",
    audience: "umum",
    description: "Bazar terbuka.",
    location: "Balai Kota",
    startsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    capacity: 50,
    fundingTarget: 5000000,
  },
  rina,
  "sosialita: events.create (umum)",
);
const anggotaEvent = await ok(
  "events.create",
  {
    title: "Kelas Tertutup Anggota",
    audience: "anggota",
    startsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
  },
  rina,
  "sosialita: events.create (anggota)",
);
await expectError(
  "events.create",
  { title: "Undangan Terbatas", audience: "undangan", startsAt: new Date(Date.now() + 20 * 86400000).toISOString() },
  rina,
  "forbidden",
  "sosialita: events.create (undangan ditolak)",
);
const group = await ok(
  "groups.create",
  { name: "Kelompok Kuliner Rumahan", description: "Berbagi resep dan pemasaran.", audienceMinRole: "wonder_woman", capacity: 15 },
  rina,
  "sosialita: groups.create",
);
await ok("groups.get", { id: group?.group?.id ?? group?.id }, rina, "sosialita: groups.get");
await ok("groups.join", { id: group?.group?.id ?? group?.id }, rina, "sosialita: groups.join");

// ---------- high society invitation + venues ----------
const ayu = await login("ayu@contoh.id");
const invited = await ok(
  "events.create",
  { title: "Jamuan Undangan High Society", audience: "undangan", location: "Rumah Ayu", startsAt: new Date(Date.now() + 21 * 86400000).toISOString() },
  ayu,
  "high_society: events.create (undangan)",
);
const invitedId = invited?.event?.id ?? invited?.id;
await ok("events.invite", { id: invitedId, email: "dewi@contoh.id" }, ayu, "high_society: events.invite anggota");
await expectError("events.invite", { id: invitedId, email: "budi@contoh.id" }, ayu, "invite_members_only", "high_society: events.invite non-member ditolak");
await ok("events.get", { id: invitedId }, dewi, "member: events.get undangan");

// ---------- public user ----------
const budi = await login("budi@contoh.id");
await ok("profiles.list", { page: 1, perPage: 6 }, budi, "public: profiles.list");
await expectError("groups.list", {}, budi, "forbidden", "public: groups.list blocked");
await expectError("groups.create", { name: "Grup Publik" }, budi, "forbidden", "public: groups.create blocked");
await expectError("programs.enroll", { id: program?.program?.id ?? program?.id }, budi, "forbidden", "public: programs.enroll blocked");
await ok("events.rsvp", { id: umumEvent?.event?.id ?? umumEvent?.id, going: true }, budi, "public: events.rsvp umum");
await ok("comments.list", { updateId: update?.update?.id ?? update?.id }, budi, "public: comments.list");
await ok("comments.create", { updateId: update?.update?.id ?? update?.id, body: "Semangat, Bu Dewi!" }, budi, "public: comments.create");
await ok("reports.create", { targetType: "comment", targetId: "apa-saja", reason: "Uji laporan" }, budi, "public: reports.create");

// ---------- new member registration (pending verification) ----------
const email = `uji${Date.now()}@contoh.id`;
const registered = await ok(
  "auth.register",
  {
    kind: "member",
    email,
    password: "rahasia123",
    nickname: "Uji Anggota",
    fullName: "Uji Anggota Purnama",
    verificationDoc: { type: "ktp", fileName: "ktp-uji.jpg", dataUrl: TEST_DOC },
    city: "Semarang",
    age: 33,
    dependents: 2,
    employmentStatus: "Penjahit",
    skills: ["Menjahit"],
    trainings: ["Pelatihan Dasar"],
    needsTarget: "Mesin jahit",
    mainTarget: "Usaha konveksi kecil",
    interests: ["Fesyen"],
    bio: "Ingin memulai usaha.",
  },
  undefined,
  "daftar: auth.register member",
);
const newToken = registered?.token;
report("daftar: profil menunggu verifikasi", registered?.profile?.status === "pending", JSON.stringify(registered?.profile?.status));
report("daftar: bukan admin pertama (bootstrap false)", registered?.bootstrap === false || registered?.account?.role === "wonder_woman", JSON.stringify(registered?.account?.role));
await expectError("updates.create", { title: "Coba", body: "Belum terverifikasi" }, newToken, "profile_not_verified", "member baru: updates.create ditolak");
await ok("groups.list", {}, newToken, "member baru (wonder_woman): groups.list diizinkan");

// ---------- admin ----------
const admin = await login("admin@pantijanda.id");
const stats = await ok("admin.stats", {}, admin, "admin: stats");
report("admin: stats shape", typeof stats?.accounts?.total === "number" && typeof stats?.paymentEnabled === "boolean", JSON.stringify(stats));
const pending = await ok("admin.profiles.pending", {}, admin, "admin: profiles.pending");
const target = (pending?.items ?? []).find((p) => p.nickname === "Uji Anggota");
report("admin: profil baru muncul di antrean", Boolean(target), JSON.stringify((pending?.items ?? []).map((p) => p.nickname)));
await ok("admin.profiles.review", { id: target?.id, approve: true }, admin, "admin: review approve");
await ok("updates.create", { title: "Kabar pertama", body: "Profil sudah terverifikasi." }, newToken, "member terverifikasi: updates.create");

const accounts = await ok("admin.accounts.list", {}, admin, "admin: accounts.list");
const budiRow = (accounts?.items ?? []).find((a) => a.email === "budi@contoh.id");
const dewiRow = (accounts?.items ?? []).find((a) => a.email === "dewi@contoh.id");
await ok("admin.accounts.setRole", { id: dewiRow?.id, role: "sosialita" }, admin, "admin: setRole wonder_woman -> sosialita");
await ok("admin.accounts.setRole", { id: dewiRow?.id, role: "wonder_woman" }, admin, "admin: setRole kembali");
await ok("admin.accounts.setStatus", { id: budiRow?.id, status: "suspended" }, admin, "admin: suspend akun publik");
await ok("admin.accounts.setStatus", { id: budiRow?.id, status: "active" }, admin, "admin: aktifkan kembali");
const reports = await ok("admin.reports.list", {}, admin, "admin: reports.list");
const openReport = (reports?.items ?? [])[0];
if (openReport) {
  await ok("admin.reports.resolve", { id: openReport.id, resolution: "dismiss" }, admin, "admin: reports.resolve dismiss");
} else {
  report("admin: reports.resolve dismiss", true);
}
await ok("donations.list", {}, admin, "admin: donations.list");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
