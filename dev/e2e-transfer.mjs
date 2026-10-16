// E2E API test for the E-Sport Transfer Market (migration 010):
// kartu pemain, iklan jual/pinjam/free agent, penawaran & negosiasi,
// escrow koin, kontrak digital, pinjaman + opsi beli, free agent,
// jendela transfer, refund pembatalan, dan pengumuman.
// Usage: restart fixture dulu (node dev/server.mjs), lalu:
//   node dev/e2e-transfer.mjs   — assumes fixture server on :8000.

const BASE = "http://127.0.0.1:8000/functions/v1/app";
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

const wulan = await login("wulan@contoh.id");
const dewi = await login("dewi@contoh.id");
const rina = await login("rina@contoh.id");
const budi = await login("budi@contoh.id");
const citra = await login("citra@contoh.id");
const sari = await login("sari@contoh.id");
const admin = await login("admin@pantijanda.id");
check("login semua akun uji", [wulan, dewi, rina, budi, citra, sari, admin].every(Boolean));

// ---------- §1 visibilitas seed ----------
const listingsOpen = await call("esport.transfer.listings.list", {}, wulan);
const openItems = listingsOpen.body?.data?.items ?? [];
check("listings.list terbuka 200", listingsOpen.status === 200 && openItems.length === 3);
const citraListing = openItems.find((l) => l.player?.ign === "CitraMark");
const sariListing = openItems.find((l) => l.player?.ign === "SariMid");
const budiListing = openItems.find((l) => l.player?.ign === "BudiKades");
check("iklan CitraMark sale 8500 dari Elang Nusantara", citraListing?.listingType === "sale" && citraListing?.askingPrice === 8500 && citraListing?.team?.tag === "ELN");
check("iklan SariMid loan_to_buy 1200/30hr/opsi 4000", sariListing?.listingType === "loan_to_buy" && sariListing?.askingPrice === 1200 && sariListing?.loanDays === 30 && sariListing?.optionPrice === 4000);
check("iklan BudiKades free agent", budiListing?.listingType === "free_agent" && budiListing?.team === null);
check("semua iklan menandai jendela terbuka", openItems.every((l) => l.windowOpen === true && l.windowName));

const typeFilter = await call("esport.transfer.listings.list", { listingType: "sale" }, wulan);
check("filter listingType sale", (typeFilter.body?.data?.items ?? []).every((l) => l.listingType === "sale") && typeFilter.body?.data?.items?.length === 1);

const profFree = await call("esport.transfer.profiles.list", { status: "free_agent" }, wulan);
check("profil free_agent seed hanya BudiKades", profFree.body?.data?.items?.length === 1 && profFree.body?.data?.items[0]?.ign === "BudiKades");

const profListAll = await call("esport.transfer.profiles.list", {}, wulan);
const citraCard = (profListAll.body?.data?.items ?? []).find((p) => p.ign === "CitraMark");
const sariCard = (profListAll.body?.data?.items ?? []).find((p) => p.ign === "SariMid");
const ayuCard = (profListAll.body?.data?.items ?? []).find((p) => p.ign === "AyuRoam");
const budiCard = (profListAll.body?.data?.items ?? []).find((p) => p.ign === "BudiKades");
check("kartu pemain lengkap (game/role/rank)", citraCard?.game?.name === "Mobile Legends: Bang Bang" && citraCard?.mainRole === "Marksman" && citraCard?.rankTier === "Mythical Immortal");
check("kartu SariMid menampilkan agen", sariCard?.agent?.name === "Rani Sport Management" && sariCard?.agent?.commissionPercent === 10);

const sariDetail = await call("esport.transfer.profiles.get", { id: sariCard?.id }, wulan);
check("profiles.get menampilkan iklan & kontrak", sariDetail.status === 200 && sariDetail.body?.data?.listings?.length === 1 && sariDetail.body?.data?.player?.team?.tag === "SRJ");
const ayuDetail = await call("esport.transfer.profiles.get", { id: ayuCard?.id }, wulan);
check("riwayat transfer AyuRoam (seed free agent)", (ayuDetail.body?.data?.history ?? []).length === 1 && ayuDetail.body?.data?.history[0]?.toTeam?.tag === "GRM" && ayuDetail.body?.data?.player?.contract?.type === "free_agent");

const windows = await call("esport.transfer.windows.list", {}, wulan);
const mlbWindow = (windows.body?.data?.items ?? []).find((w) => w.gameName === "Mobile Legends: Bang Bang");
const efWindow = (windows.body?.data?.items ?? []).find((w) => w.gameName === "eFootball");
check("jendela MLB terbuka", mlbWindow?.status === "open");
check("jendela eFootball tertutup", efWindow?.status === "closed" && efWindow?.gameId);
check("canManage window hanya rank>=6", windows.body?.data?.canManage === false);
const adminWindows = await call("esport.transfer.windows.list", {}, admin);
check("admin canManage true", adminWindows.body?.data?.canManage === true);

const myWulan = await call("esport.transfer.my", {}, wulan);
check("my(wulan): koin 650 & profil SrikandiGold", myWulan.body?.data?.koinBalance === 650 && myWulan.body?.data?.profiles?.[0]?.ign === "SrikandiGold");
check("my(wulan): iklan tim tampil", (myWulan.body?.data?.listings ?? []).some((l) => l.player?.ign === "SariMid"));
check("my(wulan): jendela openNow", (myWulan.body?.data?.windows ?? []).every((w) => w.openNow === true) && myWulan.body?.data?.windows?.length === 1);
const myDewi = await call("esport.transfer.my", {}, dewi);
check("my(dewi): koin 20000 & tawaran keluar seed", myDewi.body?.data?.koinBalance === 20000 && (myDewi.body?.data?.outgoingOffers ?? []).some((o) => o.player?.ign === "CitraMark" && o.status === "pending"));

const ann0 = await call("esport.transfer.announcements", {}, wulan);
check("pengumuman seed AyuRoam → Garuda Merah", (ann0.body?.data?.items ?? []).some((x) => x.player?.ign === "AyuRoam" && x.toTeam?.tag === "GRM" && x.transferType === "free_agent"));

// ---------- §2 penjaga akses & validasi awal ----------
const guestMy = await call("esport.transfer.my");
const guestList = await call("esport.transfer.listings.list");
const guestAnn = await call("esport.transfer.announcements");
check("tamu tidak bisa akses bursa (401)", guestMy.status === 401 && guestList.status === 401 && guestAnn.status === 401);

const rinaNoTeam = await call("esport.transfer.offers.create", { listingId: citraListing?.id }, rina);
check("tawaran tanpa tim → 404", rinaNoTeam.status === 404 && rinaNoTeam.body?.error === "not_found");
const rinaOwnTeam2 = await call("esport.transfer.offers.create", { listingId: citraListing?.id, teamId: (await call("esport.transfer.my", {}, rina)).body?.data?.teams?.[0] }, rina);
check("kapten ELN tak bisa menawar pemain sendiri (own_team_offer)", rinaOwnTeam2.status === 409 && rinaOwnTeam2.body?.error === "own_team_offer");

const budiOffer = await call("esport.transfer.offers.create", { listingId: citraListing?.id, teamId: myWulan.body?.data?.teams?.[0] }, budi);
check("bukan kapten ditolak (not_team_captain)", budiOffer.status === 403 && budiOffer.body?.error === "not_team_captain");

const rinaSelfList = await call("esport.transfer.listings.create", { profileId: (profListAll.body?.data?.items ?? []).find((p) => p.ign === "RinaExp")?.id, teamId: (await call("esport.transfer.my", {}, rina)).body?.data?.teams?.[0], listingType: "sale", askingPrice: 5000 }, rina);
check("kapten tidak bisa mendaftarkan dirinya (captain_cannot_be_listed)", rinaSelfList.status === 409 && rinaSelfList.body?.error === "captain_cannot_be_listed");

const dupList = await call("esport.transfer.listings.create", { profileId: sariCard?.id, teamId: myWulan.body?.data?.teams?.[0], listingType: "loan", loanDays: 14, askingPrice: 500 }, wulan);
check("profil sudah terdaftar ditolak (already_listed)", dupList.status === 409 && dupList.body?.error === "already_listed");

const missing = await call("esport.transfer.profiles.get", { id: "00000000-0000-4000-8000-000000000000" }, wulan);
check("profil tidak ada → 404", missing.status === 404);
const shortIgn = await call("esport.transfer.profiles.save", { gameId: citraCard?.game?.id, ign: "X" }, wulan);
check("IGN terlalu pendek → 400", shortIgn.status === 400);

// ---------- §3 penjualan permanen CitraMark (ELN → GRM, 8500) ----------
const rinaInbox = await call("esport.transfer.my", {}, rina);
const citraOffer = (rinaInbox.body?.data?.incomingOffers ?? []).find((o) => o.player?.ign === "CitraMark" && o.status === "pending");
check("kapten ELN melihat tawaran masuk 8500 dari GRM", citraOffer?.fee === 8500 && citraOffer?.fromTeam?.tag === "GRM");

const dewiSelfAccept = await call("esport.transfer.offers.respond", { id: citraOffer?.id, transition: "accept" }, dewi);
check("pembeli tak bisa menerima tawarannya sendiri (403)", dewiSelfAccept.status === 403);

const acceptCitra = await call("esport.transfer.offers.respond", { id: citraOffer?.id, transition: "accept" }, rina);
const citraTransfer = acceptCitra.body?.data?.transferId;
check("terima tawaran → transfer pending_payment", acceptCitra.status === 200 && citraTransfer && acceptCitra.body?.data?.completed === false);

const pausedList = await call("esport.transfer.listings.list", { status: "paused" }, wulan);
check("iklan CitraMark dijeda setelah diterima", (pausedList.body?.data?.items ?? []).some((l) => l.player?.ign === "CitraMark"));

const earlyConfirm = await call("esport.transfer.confirm", { id: citraTransfer }, dewi);
check("konfirmasi sebelum bayar ditolak (403/409)", earlyConfirm.status === 403 || earlyConfirm.status === 409);

const payCitra = await call("esport.transfer.pay", { id: citraTransfer }, dewi);
check("pembeli bayar escrow 8500", payCitra.status === 200 && payCitra.body?.data?.escrowHeld === true && payCitra.body?.data?.fee === 8500);
const dewiAfterPay = await call("esport.transfer.my", {}, dewi);
check("saldo dewi 20000 → 11500", dewiAfterPay.body?.data?.koinBalance === 11500);

const payAgain = await call("esport.transfer.pay", { id: citraTransfer }, dewi);
check("bayar dua kali ditolak (invalid_status)", payAgain.status === 409 && payAgain.body?.error === "invalid_status");

const budiConfirm = await call("esport.transfer.confirm", { id: citraTransfer }, budi);
check("pihak tak terlibat tak bisa konfirmasi (403)", budiConfirm.status === 403);

const confirmCitra = await call("esport.transfer.confirm", { id: citraTransfer }, rina);
check("penjual konfirmasi → transfer selesai", confirmCitra.status === 200 && confirmCitra.body?.data?.completed === true && confirmCitra.body?.data?.contractId);
const rinaAfterSale = await call("esport.transfer.my", {}, rina);
const dewiAfterSale = await call("esport.transfer.my", {}, dewi);
check("saldo rina 2500 → 11000", rinaAfterSale.body?.data?.koinBalance === 11000);
check("saldo dewi tetap 11500", dewiAfterSale.body?.data?.koinBalance === 11500);

const cancelDone = await call("esport.transfer.cancel", { id: citraTransfer }, dewi);
check("batal setelah selesai ditolak (invalid_status)", cancelDone.status === 409 && cancelDone.body?.error === "invalid_status");

const citraAfter = await call("esport.transfer.profiles.get", { id: citraCard?.id }, wulan);
check("CitraMark kini di Garuda Merah dengan kontrak permanen", citraAfter.body?.data?.player?.team?.tag === "GRM" && citraAfter.body?.data?.player?.contract?.type === "permanent");
const citraMy = await call("esport.transfer.my", {}, citra);
check("CitraMark keluar dari Elang Nusantara (1 tim)", citraMy.body?.data?.teams?.length === 1);
const annSale = await call("esport.transfer.announcements", {}, wulan);
check("pengumuman CitraMark → GRM fee 8500", (annSale.body?.data?.items ?? []).some((x) => x.player?.ign === "CitraMark" && x.transferType === "sale" && x.fee === 8500 && x.fromTeam?.tag === "ELN"));

// ---------- §4 pinjaman + opsi beli SariMid (SRJ → GRM) ----------
const grmTeamId = myDewi.body?.data?.teams?.[0];
const offerSari1 = await call("esport.transfer.offers.create", { listingId: sariListing?.id, teamId: grmTeamId, message: "Uji pinjam 30 hari." }, dewi);
check("tawaran pinjam dibuat (fee default 1200)", offerSari1.status === 200 && offerSari1.body?.data?.id);
const dupOffer = await call("esport.transfer.offers.create", { listingId: sariListing?.id, teamId: grmTeamId }, dewi);
check("tawaran pending ganda ditolak (offer_pending)", dupOffer.status === 409 && dupOffer.body?.error === "offer_pending");
const dewiAcceptOwn = await call("esport.transfer.offers.respond", { id: offerSari1.body?.data?.id, transition: "accept" }, dewi);
check("pembeli tak bisa menerima tawarannya sendiri (403)", dewiAcceptOwn.status === 403);

const acceptSari1 = await call("esport.transfer.offers.respond", { id: offerSari1.body?.data?.id, transition: "accept" }, wulan);
const sariTransfer1 = acceptSari1.body?.data?.transferId;
check("terima tawaran pinjam → pending_payment", acceptSari1.status === 200 && sariTransfer1);
const paySari1 = await call("esport.transfer.pay", { id: sariTransfer1 }, dewi);
check("dewi bayar escrow pinjam 1200", paySari1.status === 200 && paySari1.body?.data?.fee === 1200);
const dewiAfterPay2 = await call("esport.transfer.my", {}, dewi);
check("saldo dewi 11500 → 10300", dewiAfterPay2.body?.data?.koinBalance === 10300);

const cancelSari = await call("esport.transfer.cancel", { id: sariTransfer1, reason: "Uji pembatalan pinjaman" }, dewi);
check("pembatalan sebelum serah terima berhasil", cancelSari.status === 200 && cancelSari.body?.data?.cancelled === true);
const dewiAfterRefund = await call("esport.transfer.my", {}, dewi);
check("refund escrow kembali → saldo dewi 11500", dewiAfterRefund.body?.data?.koinBalance === 11500);
const reopened = await call("esport.transfer.listings.list", {}, wulan);
check("iklan SariMid kembali terbuka", (reopened.body?.data?.items ?? []).some((l) => l.player?.ign === "SariMid" && l.status === "open"));

const offerSari2 = await call("esport.transfer.offers.create", { listingId: sariListing?.id, teamId: grmTeamId }, dewi);
const acceptSari2 = await call("esport.transfer.offers.respond", { id: offerSari2.body?.data?.id, transition: "accept" }, wulan);
const sariTransfer2 = acceptSari2.body?.data?.transferId;
const paySari2 = await call("esport.transfer.pay", { id: sariTransfer2 }, dewi);
check("ulang alur pinjam: bayar escrow", paySari2.status === 200);
const confirmSari2 = await call("esport.transfer.confirm", { id: sariTransfer2 }, wulan);
check("konfirmasi pinjaman selesai", confirmSari2.status === 200 && confirmSari2.body?.data?.completed === true);

const wulanAfterLoan = await call("esport.transfer.my", {}, wulan);
check("saldo wulan 650 → 1850", wulanAfterLoan.body?.data?.koinBalance === 1850);
const sariMid = await call("esport.transfer.profiles.get", { id: sariCard?.id }, wulan);
check("SariMid dipinjam GRM (kontrak loan, opsi 4000)", sariMid.body?.data?.player?.team?.tag === "GRM" && sariMid.body?.data?.player?.contract?.type === "loan" && sariMid.body?.data?.player?.contract?.optionPrice === 4000 && Boolean(sariMid.body?.data?.player?.contract?.endDate));
check("status SariMid on_loan", sariMid.body?.data?.player?.status === "on_loan");
const sariMy = await call("esport.transfer.my", {}, sari);
check("SariMid tercatat di 2 tim (SRJ + GRM)", sariMy.body?.data?.teams?.length === 2);

const dewiContracts = await call("esport.transfer.my", {}, dewi);
const sariLoanContract = (dewiContracts.body?.data?.contracts ?? []).find((c) => c.player?.ign === "SariMid" && c.canExerciseOption);
check("kontrak pinjam menandai canExerciseOption", Boolean(sariLoanContract) && sariLoanContract?.optionPrice === 4000);

const wulanExercise = await call("esport.transfer.option.exercise", { contractId: sariLoanContract?.id }, wulan);
check("bukan pemegang opsi tak bisa eksekusi (403)", wulanExercise.status === 403);

// ---------- §5 eksekusi opsi beli (SariMid permanen ke GRM, 4000) ----------
const exercise = await call("esport.transfer.option.exercise", { contractId: sariLoanContract?.id }, dewi);
const sariTransfer3 = exercise.body?.data?.transferId;
check("eksekusi opsi → transfer pending_payment", exercise.status === 200 && sariTransfer3);
const payOption = await call("esport.transfer.pay", { id: sariTransfer3 }, dewi);
check("dewi bayar opsi 4000", payOption.status === 200 && payOption.body?.data?.fee === 4000);
const dewiAfterOption = await call("esport.transfer.my", {}, dewi);
check("saldo dewi 10300 → 6300", dewiAfterOption.body?.data?.koinBalance === 6300);
const confirmOption = await call("esport.transfer.confirm", { id: sariTransfer3 }, wulan);
check("penjual (SRJ) konfirmasi opsi → selesai", confirmOption.status === 200 && confirmOption.body?.data?.completed === true);
const wulanAfterOption = await call("esport.transfer.my", {}, wulan);
check("escrow opsi masuk ke SRJ → saldo wulan 5850", wulanAfterOption.body?.data?.koinBalance === 5850);

const sariFinal = await call("esport.transfer.profiles.get", { id: sariCard?.id }, wulan);
check("SariMid kini permanen di GRM", sariFinal.body?.data?.player?.team?.tag === "GRM" && sariFinal.body?.data?.player?.contract?.type === "permanent" && sariFinal.body?.data?.player?.status === "contracted");
const sariMyFinal = await call("esport.transfer.my", {}, sari);
check("SariMid keluar dari SRJ (1 tim)", sariMyFinal.body?.data?.teams?.length === 1);

// ---------- §6 free agent BudiKades (GRM, gratis) ----------
const citraOfferBudi = await call("esport.transfer.offers.create", { listingId: budiListing?.id, teamId: citraMy.body?.data?.teams?.[0] }, citra);
check("anggota biasa tak bisa menawar (403)", citraOfferBudi.status === 403 && citraOfferBudi.body?.error === "not_team_captain");

const pauseBudi = await call("esport.transfer.listings.update", { id: budiListing?.id, status: "paused" }, budi);
check("budi menjeda iklannya", pauseBudi.status === 200 && pauseBudi.body?.data?.status === "paused");
const offerPaused = await call("esport.transfer.offers.create", { listingId: budiListing?.id, teamId: grmTeamId }, dewi);
check("tawaran pada iklan dijeda ditolak (invalid_status)", offerPaused.status === 409 && offerPaused.body?.error === "invalid_status");
const reopenBudi = await call("esport.transfer.listings.update", { id: budiListing?.id, status: "open" }, budi);
check("budi membuka kembali iklannya", reopenBudi.status === 200);

const offerBudi = await call("esport.transfer.offers.create", { listingId: budiListing?.id, teamId: grmTeamId }, dewi);
check("tawaran free agent dibuat tanpa fee", offerBudi.status === 200 && offerBudi.body?.data?.id);
const acceptBudi = await call("esport.transfer.offers.respond", { id: offerBudi.body?.data?.id, transition: "accept" }, budi);
check("pemain free agent menerima → transfer langsung selesai", acceptBudi.status === 200 && acceptBudi.body?.data?.completed === true && acceptBudi.body?.data?.contractId);
const budiAfter = await call("esport.transfer.my", {}, budi);
check("budi bergabung GRM tanpa biaya (koin tetap 150)", budiAfter.body?.data?.teams?.length === 1 && budiAfter.body?.data?.koinBalance === 150);
const budiCardAfter = await call("esport.transfer.profiles.get", { id: budiCard?.id }, wulan);
check("kontrak free agent BudiKades aktif", budiCardAfter.body?.data?.player?.contract?.type === "free_agent" && budiCardAfter.body?.data?.player?.status === "contracted" && budiCardAfter.body?.data?.player?.team?.tag === "GRM");
const annFree = await call("esport.transfer.announcements", {}, wulan);
check("pengumuman BudiKades → GRM fee 0", (annFree.body?.data?.items ?? []).some((x) => x.player?.ign === "BudiKades" && x.transferType === "free_agent" && x.fee === 0));
const completedLists = await call("esport.transfer.listings.list", { status: "completed" }, wulan);
check("iklan selesai tidak tampil di daftar terbuka", (completedLists.body?.data?.items ?? []).length === 3);

// ---------- §7 jendela transfer & profil baru ----------
const efProfile = await call("esport.transfer.profiles.save", { gameId: efWindow?.gameId, ign: "WulanGK", mainRole: "Kiper", region: "Jakarta", rankTier: "Legend", rankPoints: 800 }, wulan);
check("profil eFootball dibuat", efProfile.status === 200 && efProfile.body?.data?.id);
const efListClosed = await call("esport.transfer.listings.create", { profileId: efProfile.body?.data?.id, listingType: "free_agent" }, wulan);
check("listing saat jendela tertutup ditolak (transfer_window_closed)", efListClosed.status === 409 && efListClosed.body?.error === "transfer_window_closed");

const badWindow = await call("esport.transfer.windows.save", { gameId: efWindow?.gameId, name: "Jendela Uji", opensAt: "2026-02-31", closesAt: "2026-12-31" }, admin);
check("tanggal tidak valid ditolak (400)", badWindow.status === 400 && badWindow.body?.error === "invalid_input");
const wulanWindow = await call("esport.transfer.windows.save", { gameId: efWindow?.gameId, name: "Jendela Uji", opensAt: "2026-09-01", closesAt: "2026-12-31" }, wulan);
check("bukan admin tak bisa kelola jendela (403)", wulanWindow.status === 403);

const newWindow = await call("esport.transfer.windows.save", { gameId: efWindow?.gameId, name: "Jendela Uji Komunitas", opensAt: "2026-01-01", closesAt: "2026-12-31" }, admin);
check("admin membuat jendela baru", newWindow.status === 200 && newWindow.body?.data?.id);
const efListOpen = await call("esport.transfer.listings.create", { profileId: efProfile.body?.data?.id, listingType: "free_agent" }, wulan);
check("listing berhasil setelah jendela dibuka", efListOpen.status === 200 && efListOpen.body?.data?.id);
const delWindow = await call("esport.transfer.windows.delete", { id: newWindow.body?.data?.id }, admin);
check("admin menghapus jendela", delWindow.status === 200 && delWindow.body?.data?.deleted === true);

// ---------- §8 rekap akhir ----------
const finalWulan = await call("esport.transfer.my", {}, wulan);
const finalDewi = await call("esport.transfer.my", {}, dewi);
const finalRina = await call("esport.transfer.my", {}, rina);
check("saldo akhir wulan 5850 / dewi 6300 / rina 11000", finalWulan.body?.data?.koinBalance === 5850 && finalDewi.body?.data?.koinBalance === 6300 && finalRina.body?.data?.koinBalance === 11000);

const finalAnn = await call("esport.transfer.announcements", { limit: 10 }, wulan);
const annItems = finalAnn.body?.data?.items ?? [];
check("pengumuman berisi 5 transfer (ayu, citra, sari×2, budi)", annItems.length === 5);
check("pengumuman terbaru di atas", annItems[0]?.player?.ign === "BudiKades");

const dewiTransfers = await call("esport.transfer.my", {}, dewi);
check("riwayat transfer GRM mencakup 6 transaksi (5 baru + seed AyuRoam)", (dewiTransfers.body?.data?.transfers ?? []).length === 6);

console.log(`\n${pass} ok, ${fail} gagal`);
process.exit(fail ? 1 : 0);
