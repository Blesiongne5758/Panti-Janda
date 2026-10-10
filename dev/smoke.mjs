// API smoke test against the local fixture server (node dev/server.mjs).
// Usage: node dev/smoke.mjs   — assumes the fixture server runs on :8000.

const BASE = "http://127.0.0.1:8000/functions/v1/app";
const TEST_DOC = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof";
let pass = 0;
let fail = 0;

async function call(action, payload = {}, token = null) {
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (token) headers["x-app-session"] = token;
  const response = await fetch(BASE, { method: "POST", headers, body: JSON.stringify({ action, ...payload }) });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function check(name, condition, extra = "") {
  if (condition) {
    pass += 1;
    console.log(`  ok  ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

const login = async (email) => {
  const r = await call("auth.login", { email, password: "rahasia123" });
  return r.body?.data?.token ?? null;
};

console.log("— tamu —");
const home = await call("home.summary");
check("home.summary 200 + profil terverifikasi", home.status === 200 && home.body?.data?.profiles?.length >= 2);
check("hanya wonder woman yang tampil ke tamu", (home.body?.data?.profiles ?? []).every((p) => p.tier === "wonder_woman"));

const list = await call("profiles.list", { perPage: 12 });
check("profiles.list tamu 200", list.status === 200 && Array.isArray(list.body?.data?.items));
check("profil pending tidak tampil", (list.body?.data?.items ?? []).every((p) => p.status === "verified"));
const wulanId = (list.body?.data?.items ?? []).find((p) => p.nickname === "Wulan")?.id;
check("profil Wulan ditemukan", Boolean(wulanId));

const detail = await call("profiles.get", { id: wulanId });
check("profiles.get tamu 200", detail.status === 200 && detail.body?.data?.profile?.nickname === "Wulan");
check("total donasi dihitung", detail.body?.data?.support?.donationTotal === 1500000);

const updates = await call("updates.list", { profileId: wulanId });
check("updates.list tamu 200", updates.status === 200 && updates.body?.data?.items?.length === 2);

const commentedUpdateId = (updates.body?.data?.items ?? []).find((u) => u.title === "Kelas menjahit angkatan kedua dibuka")?.id;
const comments = await call("comments.list", { updateId: commentedUpdateId });
check("comments.list tamu 200", comments.status === 200 && comments.body?.data?.items?.length >= 1);

const guestEvents = await call("events.list");
check("tamu hanya melihat event umum", guestEvents.status === 200 && (guestEvents.body?.data?.items ?? []).every((e) => e.audience === "umum"));

const guestGroups = await call("groups.list");
check("tamu tidak boleh melihat grup", guestGroups.status === 401);

const guestPledge = await call("pledges.create", { profileId: wulanId, supporterName: "Ibu Tamu", supportType: "barang", message: "Bisa bantu kain" });
check("tamu bisa kirim komitmen dukungan", guestPledge.status === 200 && guestPledge.body?.data?.received === true);

const guestComment = await call("comments.create", { updateId: updates.body?.data?.items?.[0]?.id, body: "Halo" });
check("tamu tidak bisa berkomentar", guestComment.status === 401);

const guestDonate = await call("donations.create", { profileId: wulanId, amount: 100000 });
check("gateway belum dikonfigurasi → 503", guestDonate.status === 503 && guestDonate.body?.error === "service_not_configured");

console.log("— registrasi & verifikasi —");
const reg = await call("auth.register", {
  kind: "public", email: "tamu@contoh.id", password: "rahasia123", displayName: "Tamu Baru",
});
check("registrasi publik 200", reg.status === 200 && reg.body?.data?.account?.role === "public");
const regDup = await call("auth.register", { kind: "public", email: "tamu@contoh.id", password: "rahasia123", displayName: "Tamu" });
check("email ganda → 409", regDup.status === 409);

const regMember = await call("auth.register", {
  kind: "member", email: "lastri@contoh.id", password: "rahasia123", nickname: "Lastri",
  fullName: "Lastri Purnama",
  verificationDoc: { type: "ktp", fileName: "ktp-lastri.jpg", dataUrl: TEST_DOC },
  city: "Semarang", age: 38, dependents: 2, skills: ["Menjahit"], needsTarget: "Modal usaha", mainTarget: "Toko sendiri",
});
check("registrasi anggota → wonder_woman + pending", regMember.status === 200 && regMember.body?.data?.profile?.status === "pending");
const newMemberToken = regMember.body?.data?.token;

const loginBad = await call("auth.login", { email: "lastri@contoh.id", password: "salah-sekali" });
check("login salah → 401", loginBad.status === 401);

const adminToken = await login("admin@pantijanda.id");
check("login admin", Boolean(adminToken));
const pending = await call("admin.profiles.pending", {}, adminToken);
check("ada profil menunggu verifikasi", pending.status === 200 && pending.body?.data?.items?.length >= 2);
const newProfileId = (pending.body?.data?.items ?? []).find((p) => p.nickname === "Lastri")?.id;
const review = await call("admin.profiles.review", { id: newProfileId, approve: true }, adminToken);
check("admin menyetujui profil", review.status === 200 && review.body?.data?.status === "verified");
const listAfter = await call("profiles.list", { q: "Lastri" });
check("profil baru langsung terlihat publik", (listAfter.body?.data?.items ?? []).some((p) => p.nickname === "Lastri"));

const roleSet = await call("admin.accounts.setRole", { id: (await call("admin.accounts.list", {}, adminToken)).body?.data?.items?.find((a) => a.email === "lastri@contoh.id")?.id, role: "sosialita" }, adminToken);
check("admin mengubah tier → sosialita", roleSet.status === 200 && roleSet.body?.data?.role === "sosialita");

console.log("— peran anggota —");
const wulanToken = await login("wulan@contoh.id");
check("login wonder woman", Boolean(wulanToken));
const rinaToken = await login("rina@contoh.id");
check("login sosialita", Boolean(rinaToken));
const budiToken = await login("budi@contoh.id");
check("login publik", Boolean(budiToken));

const budiGroup = await call("groups.list", {}, budiToken);
check("publik tidak bisa melihat grup", budiGroup.status === 403);
const wulanGroups = await call("groups.list", {}, wulanToken);
check("anggota melihat grup umum", wulanGroups.status === 200 && wulanGroups.body?.data?.items?.length === 1);
const wulanJoin = await call("groups.join", { id: wulanGroups.body?.data?.items?.[0]?.id }, wulanToken);
check("anggota bergabung grup", wulanJoin.status === 200);

const wulanEvents = await call("events.list", {}, wulanToken);
const wulanEventItems = wulanEvents.body?.data?.items ?? [];
check(
  "anggota melihat umum + anggota, undangan hanya saat diundang",
  wulanEvents.status === 200 &&
    wulanEventItems.length === 3 &&
    wulanEventItems.every((e) => e.audience !== "undangan" || e.invited === true),
);
const inviteEvent = (await call("events.list", {}, rinaToken)).body?.data?.items?.find((e) => e.audience === "undangan");
check("anggota terundang melihat event undangan", Boolean(inviteEvent) && inviteEvent.invited === true);

const wulanUpdate = await call("updates.create", { title: "Kelas ketiga dibuka", body: "Insya Allah bulan depan kami membuka kelas ketiga untuk pemula." }, wulanToken);
check("wonder woman memposting kabar", wulanUpdate.status === 200);

const budiComment = await call("comments.create", { updateId: wulanUpdate.body?.data?.update?.id, body: "Semoga sukses selalu!" }, budiToken);
check("publik berkomentar", budiComment.status === 200);

const createEvent = await call("events.create", { title: "Pelatihan Pemasaran Online", description: "Terbuka untuk anggota", audience: "anggota", startsAt: new Date(Date.now() + 5 * 86400000).toISOString(), location: "Daring" }, rinaToken);
check("sosialita membuat event anggota", createEvent.status === 200);
const publicCreateEvent = await call("events.create", { title: "Coba Buat", audience: "umum", startsAt: new Date(Date.now() + 86400000).toISOString() }, budiToken);
check("publik tidak bisa membuat event", publicCreateEvent.status === 403);

const donate503 = await call("donations.create", { profileId: wulanId, amount: 100000 }, budiToken);
check("donasi w/o gateway → 503", donate503.status === 503 && donate503.body?.error === "service_not_configured");

const myPledges = await call("pledges.mine", {}, wulanToken);
check("wonder woman melihat komitmen dukungan", myPledges.status === 200 && myPledges.body?.data?.items?.length >= 3);

const report = await call("reports.create", { targetType: "update", targetId: wulanUpdate.body?.data?.update?.id, reason: "Uji laporan konten" }, budiToken);
check("publik melaporkan konten", report.status === 200);
const reports = await call("admin.reports.list", {}, adminToken);
check("admin melihat laporan", reports.body?.data?.items?.length === 1);
const resolve = await call("admin.reports.resolve", { id: reports.body?.data?.items?.[0]?.id, resolution: "dismiss" }, adminToken);
check("admin menyelesaikan laporan", resolve.status === 200);

const stats = await call("admin.stats", {}, adminToken);
check("admin.stats 200", stats.status === 200 && stats.body?.data?.accounts?.total >= 8);

const suspended = await call("admin.accounts.setStatus", { id: (await call("admin.accounts.list", {}, adminToken)).body?.data?.items?.find((a) => a.email === "tamu@contoh.id")?.id, status: "suspended" }, adminToken);
check("admin menonaktifkan akun", suspended.status === 200);
const suspendedLogin = await call("auth.login", { email: "tamu@contoh.id", password: "rahasia123" });
check("akun nonaktif tidak bisa masuk", suspendedLogin.status === 403);

console.log("— sesi —");
const me = await call("auth.me", {}, wulanToken);
check("auth.me mengembalikan profil", me.status === 200 && me.body?.data?.profile?.nickname === "Wulan");
const logout = await call("auth.logout", {}, wulanToken);
check("logout 200", logout.status === 200);
const meAfter = await call("auth.me", {}, wulanToken);
check("token tidak berlaku setelah logout", meAfter.status === 401);

console.log(`\n${pass} ok, ${fail} gagal`);
process.exit(fail ? 1 : 0);
