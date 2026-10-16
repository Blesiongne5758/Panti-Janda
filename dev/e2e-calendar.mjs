// API E2E agenda kalender (route calendar.agenda + calendar.personal.*).
// Jalankan fixture lebih dulu: node dev/server.mjs
const BASE = process.env.PJ_BASE ?? "http://127.0.0.1:8000/functions/v1/app";

async function call(action, body = {}, token) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-app-session": token } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

let pass = 0;
let fail = 0;
function check(label, cond, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label} ${extra}`);
  }
}

function monthOf(iso) {
  // Bucket Jakarta (UTC+7) seperti handler.
  const shifted = new Date(Date.parse(iso) + 7 * 3600000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

const loginAyu = await call("auth.login", { email: "ayu@contoh.id", password: "rahasia123" });
check("login ayu", loginAyu.status === 200 && !!loginAyu.json?.data?.token);
const tokenAyu = loginAyu.json?.data?.token;

const loginBudi = await call("auth.login", { email: "budi@contoh.id", password: "rahasia123" });
check("login budi", loginBudi.status === 200 && !!loginBudi.json?.data?.token);
const tokenBudi = loginBudi.json?.data?.token;

// ---- Tanpa sesi harus 401
const anonymous = await call("calendar.agenda", {});
check("tanpa sesi -> 401", anonymous.status === 401, `status=${anonymous.status}`);

// ---- Ayu (bulan berjalan)
const ayu = await call("calendar.agenda", {}, tokenAyu);
check("agenda ayu 200", ayu.status === 200, JSON.stringify(ayu.json)?.slice(0, 200));
const ayuData = ayu.json?.data;
check("bulan default = bulan berjalan", ayuData.month === monthOf(ayuData.today), `month=${ayuData.month}`);
check("semua item berada di bulan yang diminta", ayuData.items.every((i) => monthOf(i.startsAt) === ayuData.month || (i.endsAt && monthOf(i.endsAt) === ayuData.month)));
check("item terurut menaik", ayuData.items.every((item, idx) => idx === 0 || Date.parse(ayuData.items[idx - 1].startsAt) <= Date.parse(item.startsAt)));

const ayuKinds = new Set(ayuData.items.map((i) => i.kind));
check("ayu punya item event", ayuKinds.has("event"));
check("ayu punya item turnamen (tonggak/laga)", ayuKinds.has("esport"));
check("ayu punya item konseling", ayuKinds.has("konseling"));

const ayuEsport = ayuData.items.filter((i) => i.kind === "esport");
check("ayu punya laga final (Garuda Merah)", ayuEsport.some((i) => i.title.includes("Garuda Merah") && i.role === "peserta"), JSON.stringify(ayuEsport.map((i) => i.title)));
check("ayu penyelenggara turnamen Piala Srikandi", ayuEsport.some((i) => i.title.includes("Piala Srikandi") && i.role === "penyelenggara" && i.noteKey === "main_event_mulai"));
check("tonggak duplikat start_at tersaring", ayuEsport.filter((i) => i.title.includes("Piala Srikandi")).length <= 4);

const ayuEvent = ayuData.items.filter((i) => i.kind === "event");
check("ayu penyelenggara Bazar UMKM", ayuEvent.some((i) => i.title.includes("Bazar UMKM") && i.role === "penyelenggara"));
check("item event punya link detail", ayuEvent.every((i) => i.link.startsWith("/event/")));

const ayuKonseling = ayuData.items.find((i) => i.kind === "konseling");
check("judul konseling memuat nama konselor", ayuKonseling?.title.includes("Dra. Ratna Puspita"), ayuKonseling?.title);
check("konseling punya akhir sesi", !!ayuKonseling?.endsAt);

const nowMs = Date.now();
check("reminder terurut menaik", ayuData.reminders.every((item, idx) => idx === 0 || Date.parse(ayuData.reminders[idx - 1].startsAt) <= Date.parse(item.startsAt)));
check("reminder di dalam jendela 30 hari", ayuData.reminders.every((i) => Date.parse(i.startsAt) <= nowMs + 30 * 86400000 + 60000 && Date.parse(i.endsAt ?? i.startsAt) >= nowMs - 12 * 3600000 - 60000));
check("reminder maksimal 8", ayuData.reminders.length <= 8);
check("counts sejalan dengan items", ayuData.items.every((i) => (ayuData.counts[i.kind] ?? 0) >= 1));
console.log(`  ayu items: ${ayuData.items.length}, reminders: ${ayuData.reminders.length}, counts: ${JSON.stringify(ayuData.counts)}`);
for (const i of ayuData.items) console.log(`  - [${i.kind}/${i.role ?? "-"}] ${i.title} (${i.noteKey ?? i.note ?? "-"}) ${i.startsAt}`);

// ---- Navigasi bulan berikutnya untuk ayu (langganan jatuh tempo bulan depan)
const nextMonth = (() => {
  const [y, m] = ayuData.month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
})();
const ayuNext = await call("calendar.agenda", { month: nextMonth }, tokenAyu);
check("agenda bulan depan 200", ayuNext.status === 200);
check("bulan depan memuat langganan berakhir", ayuNext.json?.data?.items.some((i) => i.kind === "langganan"), JSON.stringify(ayuNext.json?.data?.items?.map((i) => i.kind)));
check("bulan depan memuat event Makan Malam", ayuNext.json?.data?.items.some((i) => i.kind === "event" && i.title.includes("Makan Malam")), JSON.stringify(ayuNext.json?.data?.items?.map((i) => i.title)));

// ---- Bulan invalid jatuh ke bulan berjalan
const invalid = await call("calendar.agenda", { month: "zzz-invalid" }, tokenAyu);
check("month invalid -> bulan berjalan", invalid.json?.data?.month === ayuData.month);

// ---- Budi (non janda)
const budi = await call("calendar.agenda", {}, tokenBudi);
check("agenda budi 200", budi.status === 200);
const budiData = budi.json?.data;
const budiEvent = budiData.items.filter((i) => i.kind === "event");
check("budi peserta Bazar UMKM (rsvp)", budiEvent.some((i) => i.title.includes("Bazar UMKM") && i.role === "peserta"));
check("budi peserta event lain", budiEvent.some((i) => i.role === "peserta" && !i.title.includes("Bazar")));
const budiEsport = budiData.items.filter((i) => i.kind === "esport");
check("budi penyelenggara Liga Mini eFootball", budiEsport.some((i) => i.title.includes("Liga Mini") && i.role === "penyelenggara" && i.noteKey === "pendaftaran_ditutup"), JSON.stringify(budiEsport.map((i) => `${i.title}:${i.noteKey}`)));
check("budi tanpa item konseling/langganan", !budiData.items.some((i) => i.kind === "konseling" || i.kind === "langganan"));
console.log(`  budi items: ${budiData.items.length}, reminders: ${budiData.reminders.length}, counts: ${JSON.stringify(budiData.counts)}`);
for (const i of budiData.items) console.log(`  - [${i.kind}/${i.role ?? "-"}] ${i.title} (${i.noteKey ?? i.note ?? "-"}) ${i.startsAt}`);

// ---- Jadwal pribadi: seed ayu (bisa jatuh di bulan berjalan atau bulan depan)
const unionAyu = [...ayuData.items, ...(ayuNext.json?.data?.items ?? [])];
const seededTimed = unionAyu.find((i) => i.kind === "pribadi" && i.title === "Kontrol kesehatan rutin");
check("seed jadwal pribadi berjam", !!seededTimed && seededTimed.allDay !== true && !!seededTimed.endsAt, JSON.stringify(seededTimed));
check(
  "seed jadwal pribadi memuat lokasi & catatan",
  seededTimed?.location === "RS Hermina" && (seededTimed?.note ?? "").includes("poli jantung"),
  JSON.stringify(seededTimed),
);
const seededAllDay = unionAyu.find((i) => i.kind === "pribadi" && i.title === "Arisan RT");
check("seed jadwal pribadi seharian", seededAllDay?.allDay === true && seededAllDay.endsAt === null, JSON.stringify(seededAllDay));
check("jadwal pribadi tanpa link", unionAyu.filter((i) => i.kind === "pribadi").every((i) => i.link === null));
check("budi tidak melihat jadwal pribadi ayu", !budiData.items.some((i) => i.kind === "pribadi"));

// ---- Validasi create
const anonCreate = await call("calendar.personal.create", { title: "X", date: ayuData.today });
check("tanpa sesi create -> 401", anonCreate.status === 401, `status=${anonCreate.status}`);
const badTitle = await call("calendar.personal.create", { title: "", date: ayuData.today }, tokenAyu);
check("judul kosong -> invalid_schedule_title", badTitle.status === 400 && badTitle.json?.error === "invalid_schedule_title", JSON.stringify(badTitle.json));
const badDate = await call("calendar.personal.create", { title: "Rapat", date: "2026-02-31" }, tokenAyu);
check("tanggal invalid -> invalid_schedule_date", badDate.status === 400 && badDate.json?.error === "invalid_schedule_date", JSON.stringify(badDate.json));
const badTime = await call(
  "calendar.personal.create",
  { title: "Rapat", date: ayuData.today, startTime: "14:00", endTime: "13:00" },
  tokenAyu,
);
check("jam selesai < mulai -> invalid_schedule_time", badTime.status === 400 && badTime.json?.error === "invalid_schedule_time", JSON.stringify(badTime.json));
const endNoStart = await call("calendar.personal.create", { title: "Rapat", date: ayuData.today, endTime: "13:00" }, tokenAyu);
check("selesai tanpa mulai -> invalid_schedule_time", endNoStart.status === 400 && endNoStart.json?.error === "invalid_schedule_time", JSON.stringify(endNoStart.json));

// ---- Create + muncul di agenda
const created = await call(
  "calendar.personal.create",
  { title: "Uji jadwal pribadi", date: ayuData.today, startTime: "19:00", endTime: "20:30", location: "Rumah", note: "Cek E2E" },
  tokenAyu,
);
check("create jadwal pribadi 200", created.status === 200 && !!created.json?.data?.item?.id, JSON.stringify(created.json));
const createdId = created.json?.data?.item?.id;
check(
  "balikan create lengkap",
  created.json?.data?.item?.startTime === "19:00" && created.json?.data?.item?.date === ayuData.today,
  JSON.stringify(created.json?.data?.item),
);
const afterCreate = await call("calendar.agenda", {}, tokenAyu);
const createdItem = afterCreate.json?.data?.items.find((i) => i.id === `pribadi:${createdId}`);
check("agenda memuat item baru", !!createdItem && createdItem.kind === "pribadi" && createdItem.allDay !== true, JSON.stringify(createdItem));
check("counts.pribadi terhitung", (afterCreate.json?.data?.counts?.pribadi ?? 0) >= 1, JSON.stringify(afterCreate.json?.data?.counts));

// ---- Update (ubah menjadi seharian tanpa jam)
const updated = await call(
  "calendar.personal.update",
  { id: createdId, title: "Uji jadwal pribadi (ubah)", date: ayuData.today },
  tokenAyu,
);
check("update jadwal pribadi 200", updated.status === 200, JSON.stringify(updated.json));
const afterUpdate = await call("calendar.agenda", {}, tokenAyu);
const updatedItem = afterUpdate.json?.data?.items.find((i) => i.id === `pribadi:${createdId}`);
check(
  "perubahan tercermin (seharian, tanpa akhir)",
  updatedItem?.title === "Uji jadwal pribadi (ubah)" && updatedItem?.allDay === true && updatedItem?.endsAt === null,
  JSON.stringify(updatedItem),
);

// ---- Privasi mutasi: budi tidak bisa mengubah/menghapus item ayu
const budiUpdate = await call("calendar.personal.update", { id: createdId, title: "Bajak", date: ayuData.today }, tokenBudi);
check("budi update item ayu -> 404", budiUpdate.status === 404, `status=${budiUpdate.status}`);
const budiRemove = await call("calendar.personal.remove", { id: createdId }, tokenBudi);
check("budi hapus item ayu -> 404", budiRemove.status === 404, `status=${budiRemove.status}`);

// ---- Budi punya jadwal sendiri; tidak terlihat oleh ayu
const budiCreate = await call("calendar.personal.create", { title: "Jadwal budi", date: budiData.today, startTime: "07:00" }, tokenBudi);
check("budi create jadwal pribadi 200", budiCreate.status === 200, JSON.stringify(budiCreate.json));
const budiAfter = await call("calendar.agenda", {}, tokenBudi);
check("budi melihat jadwalnya sendiri", budiAfter.json?.data?.items.some((i) => i.kind === "pribadi" && i.title === "Jadwal budi"));
const ayuAfter = await call("calendar.agenda", {}, tokenAyu);
check("ayu tidak melihat jadwal budi", !ayuAfter.json?.data?.items.some((i) => i.title === "Jadwal budi"));

// ---- Remove + bersih-bersih
const removed = await call("calendar.personal.remove", { id: createdId }, tokenAyu);
check("hapus jadwal pribadi 200", removed.status === 200 && removed.json?.data?.removed === true, JSON.stringify(removed.json));
const afterRemove = await call("calendar.agenda", {}, tokenAyu);
check("item terhapus dari agenda", !afterRemove.json?.data?.items.some((i) => i.id === `pribadi:${createdId}`));
const removeAgain = await call("calendar.personal.remove", { id: createdId }, tokenAyu);
check("hapus ulang -> 404", removeAgain.status === 404, `status=${removeAgain.status}`);
await call("calendar.personal.remove", { id: budiCreate.json?.data?.item?.id }, tokenBudi);

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
