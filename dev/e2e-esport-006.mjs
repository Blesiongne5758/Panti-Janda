// E2E API test for the E-Sport extension (migration 006):
// battle royale, league, per-game scores, payment tracking, prize payout,
// streams, caster roles, dispute investigation.
// Usage: node dev/e2e-esport-006.mjs  — assumes fixture server on :8000.

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

const ayu = await login("ayu@contoh.id");
const dewi = await login("dewi@contoh.id");
const citra = await login("citra@contoh.id");
const wulan = await login("wulan@contoh.id");
const rina = await login("rina@contoh.id");
const budi = await login("budi@contoh.id");
const admin = await login("admin@pantijanda.id");
check("login semua akun uji", [ayu, dewi, citra, wulan, rina, budi, admin].every(Boolean));

const list = await call("esport.tournaments.list");
const items = list.body?.data?.items ?? [];
const t0 = items.find((t) => t.title === "Piala Srikandi Mobile Legends");
const t1 = items.find((t) => t.title === "Turnamen Rapid Free Fire");
const t3 = items.find((t) => t.title === "Piala Bhinneka Free Fire");
const t4 = items.find((t) => t.title === "Liga Mini eFootball");
check("seed turnamen tampil (T0/T1/T3/T4)", [t0, t1, t3, t4].every(Boolean));

console.log("— game master —");
const games = await call("esport.games.list");
const mlbb = (games.body?.data?.items ?? []).find((g) => g.slug === "mobile-legends");
check("game master: developer/genre/platforms/mapPool", mlbb?.developer === "Moonton" && mlbb?.genre === "MOBA" && mlbb?.platforms?.includes("mobile") && mlbb?.mapPool?.length === 3);
check("game master: defaultFormat/minPlayers/defaultRosterSize", mlbb?.defaultFormat === "single_elim" && mlbb?.minPlayers === 5 && mlbb?.defaultRosterSize === 5);
const ff = (games.body?.data?.items ?? []).find((g) => g.slug === "free-fire");
check("Free Fire default battle_royale", ff?.defaultFormat === "battle_royale");

const badFormat = await call("esport.games.save", { name: "Uji", mode: "MOBA", slug: "uji-format", defaultFormat: "xyz" }, admin);
check("games.save defaultFormat tidak valid → 400", badFormat.status === 400);
const newGame = await call(
  "esport.games.save",
  {
    name: "Counter-Strike 2",
    mode: "Tactical FPS 5v5",
    slug: "cs2",
    icon: "🔫",
    developer: "Valve",
    genre: "Tactical FPS",
    platforms: ["pc"],
    mapPool: ["Dust II", "Mirage"],
    defaultFormat: "single_elim",
    defaultRosterSize: 5,
    minPlayers: 5,
  },
  admin,
);
const cs2Id = newGame.body?.data?.id ?? null;
check("games.save tambah game baru", newGame.status === 200 && Boolean(cs2Id));
const games2 = await call("esport.games.list");
const cs2 = (games2.body?.data?.items ?? []).find((g) => g.slug === "cs2");
check("game baru tampil dengan map pool", cs2?.mapPool?.length === 2 && cs2?.platforms?.includes("pc"));

console.log("— detail T0 —");
const t0Guest = await call("esport.tournaments.get", { id: t0.id });
const t0g = t0Guest.body?.data;
check("T0: gameMode/minPlayers/currency/prizeStatus", t0g?.tournament?.gameMode === "MOBA 5v5" && t0g?.tournament?.minPlayers === 5 && t0g?.tournament?.currency === "IDR" && t0g?.tournament?.prizeStatus === "pending");
check("T0: game mapPool tampil", t0g?.game?.mapPool?.includes("Land of Dawn"));
const semi = (t0g?.matches ?? []).find((m) => m.status === "finished" && m.games?.length === 3);
check("T0: semi memiliki 3 game detail", Boolean(semi));
check("T0: game detail map/skor/bans", semi?.games?.[0]?.map === "Land of Dawn" && semi?.games?.[0]?.homeScore === 18 && semi?.games?.[0]?.bans?.includes("Grock"));
check("T0: caster main + co caster", (t0g?.casters ?? []).length === 2 && t0g?.casters?.some((c) => c.casterRole === "main_caster") && t0g?.casters?.some((c) => c.casterRole === "co_caster"));
check("T0: 2 kanal stream, utama aktif", (t0g?.streams ?? []).length === 2 && t0g?.streams?.some((s) => s.name === "Kanal Utama YouTube" && s.isActive));
const regSemi = (t0g?.registrations ?? []).find((r) => r.paymentStatus === "unpaid");
check("T0: pembayaran reg tampil (paid + unpaid)", (t0g?.registrations ?? []).some((r) => r.paymentStatus === "paid") && Boolean(regSemi));
check("T0 tamu: catatan pembayaran disembunyikan", (t0g?.registrations ?? []).every((r) => r.paymentNote === null));
check("T0: roster memuat IGN + rank", (t0g?.registrations ?? []).some((r) => r.roster?.some((p) => p.inGameName === "SrikandiGold" && p.gameRank)));
const t0Owner = await call("esport.tournaments.get", { id: t0.id }, ayu);
check("T0 penyelenggara: catatan pembayaran tampil", (t0Owner.body?.data?.registrations ?? []).some((r) => r.paymentNote === "Transfer bank BCA"));
check("T0: sengketa multi-bukti", t0Owner.body?.data?.disputes?.[0]?.evidenceUrls?.length === 2 && t0Owner.body?.data?.disputes?.[0]?.status === "open");

console.log("— pembayaran pendaftaran —");
const payUpdate = await call("esport.registrations.update", { registrationId: regSemi.id, paymentStatus: "paid", paymentNote: "Transfer e-wallet" }, ayu);
check("update pembayaran reg → paid", payUpdate.status === 200 && payUpdate.body?.data?.paymentStatus === "paid");
const t0AfterPay = await call("esport.tournaments.get", { id: t0.id }, ayu);
const regSemiAfter = (t0AfterPay.body?.data?.registrations ?? []).find((r) => r.id === regSemi.id);
check("reg paid tercatat paid_at + note", regSemiAfter?.paymentStatus === "paid" && Boolean(regSemiAfter?.paidAt) && regSemiAfter?.paymentNote === "Transfer e-wallet");
const badPay = await call("esport.registrations.update", { registrationId: regSemi.id, paymentStatus: "lunas" }, ayu);
check("status pembayaran tidak valid → 400", badPay.status === 400);

console.log("— sengketa —");
const disp = t0Owner.body?.data?.disputes?.[0];
const inv1 = await call("esport.disputes.investigate", { disputeId: disp.id }, ayu);
check("investigate sengketa → investigating", inv1.status === 200 && inv1.body?.data?.status === "investigating");
const inv2 = await call("esport.disputes.investigate", { disputeId: disp.id }, ayu);
check("investigate ulang → 409", inv2.status === 409);
const invBad = await call("esport.disputes.investigate", { disputeId: disp.id }, dewi);
check("non-penyelenggara investigate → 403", invBad.status === 403);

console.log("— kanal stream —");
const streams1 = await call("esport.streams.list", { tournamentId: t0.id });
check("streams.list → 2 kanal", streams1.body?.data?.items?.length === 2);
const utama = (streams1.body?.data?.items ?? []).find((s) => s.name === "Kanal Utama YouTube");
const streamUpd = await call("esport.streams.save", { tournamentId: t0.id, streamId: utama.id, name: utama.name, platform: "youtube", url: utama.url, currentMatchId: utama.currentMatchId, isActive: false }, ayu);
check("streams.save update kanal", streamUpd.status === 200);
const streamNew = await call("esport.streams.save", { tournamentId: t0.id, name: "Kanal Cadangan Twitch", platform: "twitch", url: "https://twitch.tv/pantijanda", isActive: true }, ayu);
check("streams.save tambah kanal", streamNew.status === 200 && Boolean(streamNew.body?.data?.id));
const streamBad = await call("esport.streams.save", { tournamentId: t0.id, name: "Kanal Uji", platform: "netflix", isActive: false }, ayu);
check("platform stream tidak valid → 400", streamBad.status === 400);
const streams2 = await call("esport.streams.list", { tournamentId: t0.id });
check("streams.list → 3 kanal", streams2.body?.data?.items?.length === 3);
const streamDel = await call("esport.streams.delete", { id: streamNew.body?.data?.id }, ayu);
check("streams.delete", streamDel.status === 200);
const streamDel2 = await call("esport.streams.delete", { id: streamNew.body?.data?.id }, ayu);
check("streams.delete ulang → 404", streamDel2.status === 404);
await call("esport.streams.save", { tournamentId: t0.id, streamId: utama.id, name: utama.name, platform: "youtube", url: utama.url, currentMatchId: utama.currentMatchId, isActive: true }, ayu);

console.log("— caster role —");
const casters = await call("esport.casters.list", { tournamentId: t0.id });
check("casters.list memuat casterRole", (casters.body?.data?.items ?? []).length === 2 && casters.body?.data?.items?.every((c) => ESPORT_CASTER_ROLES_OK(c)));
function ESPORT_CASTER_ROLES_OK(c) {
  return ["main_caster", "co_caster", "analyst", "host", "observer"].includes(c.casterRole);
}
const casterNew = await call("esport.casters.save", { tournamentId: t0.id, name: "Dian Paramita", slotLabel: "Analis", contact: "@dian.p", casterRole: "analyst" }, ayu);
check("casters.save role analis", casterNew.status === 200);
const casterBad = await call("esport.casters.save", { tournamentId: t0.id, name: "Uji Role", casterRole: "penyiar" }, ayu);
check("caster role tidak valid → 400", casterBad.status === 400);
const casterDel = await call("esport.casters.delete", { id: casterNew.body?.data?.id }, ayu);
check("casters.delete", casterDel.status === 200);

console.log("— alur hadiah (prize payout) —");
const tp1 = await call("esport.tournaments.prizeStatus", { id: t1.id, status: "completed", note: "Transfer juara selesai" }, citra);
check("distributing → completed", tp1.status === 200 && tp1.body?.data?.status === "completed");
const t1Get = await call("esport.tournaments.get", { id: t1.id });
check("T1 completed: prizePaidAt terisi", t1Get.body?.data?.tournament?.prizeStatus === "completed" && Boolean(t1Get.body?.data?.tournament?.prizePaidAt));
const tpReset = await call("esport.tournaments.prizeStatus", { id: t1.id, status: "pending" }, citra);
check("reset pending oleh non-admin → 409", tpReset.status === 409);
const tpAdmin = await call("esport.tournaments.prizeStatus", { id: t1.id, status: "pending" }, admin);
check("admin reset → pending", tpAdmin.status === 200);
const t1Reset = await call("esport.tournaments.get", { id: t1.id });
check("reset menghapus paid_at + note", t1Reset.body?.data?.tournament?.prizePaidAt === null && t1Reset.body?.data?.tournament?.prizePayoutNote === null);
const tpLock = await call("esport.tournaments.prizeStatus", { id: t1.id, status: "locked" }, admin);
check("pending → locked", tpLock.status === 200);
const tpSkip = await call("esport.tournaments.prizeStatus", { id: t1.id, status: "completed" }, admin);
check("locked → completed langsung → 409", tpSkip.status === 409);
const tpBad = await call("esport.tournaments.prizeStatus", { id: t0.id, status: "dibayar" }, ayu);
check("status hadiah tidak valid → 400", tpBad.status === 400);

console.log("— daftar tunggu (waitlist) —");
const create5 = await call(
  "esport.tournaments.create",
  {
    gameId: "mobile-legends",
    title: "Uji Daftar Tunggu Srikandi",
    format: "single_elim",
    status: "registration",
    maxTeams: 2,
    rosterMin: 1,
    rosterMax: 3,
    bestOf: 3,
    entryFee: 10000,
    gameMode: "MOBA 5v5",
    minPlayers: 4,
    prizes: [{ placement: 1, amount: 100000 }],
  },
  wulan,
);
const t5 = create5.body?.data?.id ?? null;
check("buat turnamen uji (T5)", create5.status === 200 && Boolean(t5));
const t5Get = await call("esport.tournaments.get", { id: t5 });
check("T5: gameMode/minPlayers round-trip", t5Get.body?.data?.tournament?.gameMode === "MOBA 5v5" && t5Get.body?.data?.tournament?.minPlayers === 4);
check("T5: prizeStatus awal pending", t5Get.body?.data?.tournament?.prizeStatus === "pending");
const regA = await call("esport.registrations.create", { tournamentId: t5, teamId: t0g.registrations.find((r) => r.teamName === "Srikandi Jaya").teamId }, wulan);
check("reg SRJ → registered", regA.status === 200 && regA.body?.data?.status === "registered");
const regB = await call("esport.registrations.create", { tournamentId: t5, teamId: t0g.registrations.find((r) => r.teamName === "Garuda Merah").teamId }, dewi);
check("reg GRM → registered", regB.status === 200 && regB.body?.data?.status === "registered");
const regC = await call("esport.registrations.create", { tournamentId: t5, teamId: t0g.registrations.find((r) => r.teamName === "Elang Nusantara").teamId }, rina);
check("reg ELN saat penuh → waitlist", regC.status === 200 && regC.body?.data?.status === "waitlist");
const regC2 = await call("esport.registrations.create", { tournamentId: t5, teamId: t0g.registrations.find((r) => r.teamName === "Elang Nusantara").teamId }, rina);
check("reg ganda → 409 already_registered", regC2.status === 409 && regC2.body?.error === "already_registered");
const t5After = await call("esport.tournaments.get", { id: t5 }, wulan);
check("T5: pendaftaran ditutup saat penuh", t5After.body?.data?.permissions?.registrationOpen === false);
check("T5: waitlist tercatat unpaid", (t5After.body?.data?.registrations ?? []).find((r) => r.status === "waitlist")?.paymentStatus === "unpaid");

console.log("— bracket + skor per game (BO3) —");
const gen5 = await call("esport.bracket.generate", { id: t5 }, wulan);
check("bracket T5 → 1 pertandingan final", gen5.status === 200 && gen5.body?.data?.generated === 1);
const t5Bracket = await call("esport.tournaments.get", { id: t5 }, wulan);
const m5 = (t5Bracket.body?.data?.matches ?? []).find((m) => m.stage === "main");
check("T5: final terjadwal 2 tim", Boolean(m5?.homeRegId && m5?.awayRegId) && m5?.status === "scheduled");
check("T5: tim waitlist tidak masuk bracket", (t5Bracket.body?.data?.matches ?? []).every((m) => m.homeRegId !== regC.body?.data?.registrationId && m.awayRegId !== regC.body?.data?.registrationId));
const tied = await call("esport.matches.game.save", { matchId: m5.id, homeScore: 8, awayScore: 8 }, wulan);
check("game.save skor seri → 400", tied.status === 400 && tied.body?.error === "tied_score");
const g1 = await call("esport.matches.game.save", { matchId: m5.id, gameIndex: 1, map: "Land of Dawn", homeScore: 18, awayScore: 12, bans: ["Grock"], picks: ["Estes"], durationMinutes: 16 }, wulan);
check("game 1 → 1-0, belum selesai", g1.status === 200 && g1.body?.data?.homeScore === 1 && g1.body?.data?.finished === false);
const g1up = await call("esport.matches.game.save", { matchId: m5.id, gameIndex: 1, map: "Land of Dawn", homeScore: 20, awayScore: 10, durationMinutes: 15 }, wulan);
check("upsert game 1 tanpa duplikasi", g1up.status === 200 && g1up.body?.data?.homeScore === 1);
const g2 = await call("esport.matches.game.save", { matchId: m5.id, gameIndex: 2, map: "Sanctuary", homeScore: 10, awayScore: 16 }, wulan);
check("game 2 → 1-1, belum selesai", g2.status === 200 && g2.body?.data?.finished === false);
const g3 = await call("esport.matches.game.save", { matchId: m5.id, gameIndex: 3, map: "Imperial Sanctuary", homeScore: 15, awayScore: 13 }, wulan);
check("game 3 → seri selesai + champion", g3.status === 200 && g3.body?.data?.finished === true && g3.body?.data?.champion === m5.homeRegId);
const t5Done = await call("esport.tournaments.get", { id: t5 }, wulan);
check("T5 selesai: status completed + juara", t5Done.body?.data?.tournament?.status === "completed" && (t5Done.body?.data?.registrations ?? []).find((r) => r.id === m5.homeRegId)?.status === "winner");
const t5Games = (t5Done.body?.data?.matches ?? []).find((m) => m.id === m5.id)?.games ?? [];
check("T5: 3 game tersimpan rapi", t5Games.length === 3 && t5Games[0].homeScore === 20);
const badIndex = await call("esport.matches.game.save", { matchId: m5.id, gameIndex: 4, homeScore: 1, awayScore: 0 }, wulan);
check("game.save setelah selesai → 409", badIndex.status === 409);
const brOnElim = await call("esport.matches.brResults", { matchId: m5.id, results: [] }, wulan);
check("brResults di turnamen eliminasi → 409", brOnElim.status === 409 && brOnElim.body?.error === "invalid_format");

console.log("— liga round robin (T4) —");
const t4Get = await call("esport.tournaments.get", { id: t4.id });
const regByTeam = (name) => (t4Get.body?.data?.registrations ?? []).find((r) => r.teamName === name);
const rSRJ = regByTeam("Srikandi Jaya");
const rGRM = regByTeam("Garuda Merah");
const rELN = regByTeam("Elang Nusantara");
check("T4: 3 tim terdaftar", [rSRJ, rGRM, rELN].every(Boolean));
const gen4 = await call("esport.bracket.generate", { id: t4.id, seeding: "manual" }, budi);
check("bracket liga → 3 pertandingan", gen4.status === 200 && gen4.body?.data?.generated === 3);
const t4Bracket = await call("esport.tournaments.get", { id: t4.id }, budi);
const leagueMatches = (t4Bracket.body?.data?.matches ?? []).filter((m) => m.stage === "league");
check("T4: semua match stage league", leagueMatches.length === 3);
check("T4: tidak ada tim melawan diri sendiri", leagueMatches.every((m) => m.homeRegId && m.awayRegId && m.homeRegId !== m.awayRegId));
const pairs = new Set(leagueMatches.map((m) => [m.homeRegId, m.awayRegId].sort().join("|")));
check("T4: setiap pasangan bertemu sekali", pairs.size === 3);
const srjWins = (m) => (m.homeRegId === rSRJ.id ? "home" : m.awayRegId === rSRJ.id ? "away" : null);
const grmWins = (m) => (m.homeRegId === rGRM.id ? "home" : m.awayRegId === rGRM.id ? "away" : null);
for (const m of leagueMatches) {
  const side = srjWins(m) ?? grmWins(m);
  const homeScore = side === "home" ? 2 : 0;
  const awayScore = side === "away" ? 2 : 0;
  const res = await call("esport.matches.game.save", { matchId: m.id, homeScore, awayScore, map: "E-Football Arena" }, budi);
  if (m.id !== leagueMatches.at(-1).id) {
    check(`liga match ronde ${m.round} selesai`, res.status === 200 && res.body?.data?.finished === true && res.body?.data?.champion === null);
  } else {
    check("liga match terakhir → champion SRJ", res.status === 200 && res.body?.data?.champion === rSRJ.id);
  }
}
const lb4 = await call("esport.leaderboard", { id: t4.id });
check("klasemen liga: SRJ juara 6 poin", lb4.body?.data?.rows?.[0]?.regId === rSRJ.id && lb4.body?.data?.rows?.[0]?.points === 6);
check("leaderboard championRegId = SRJ", lb4.body?.data?.championRegId === rSRJ.id);
const t4Done = await call("esport.tournaments.get", { id: t4.id });
check("T4 completed + juara", t4Done.body?.data?.tournament?.status === "completed" && (t4Done.body?.data?.registrations ?? []).find((r) => r.id === rSRJ.id)?.status === "winner");

console.log("— battle royale (T3) —");
const t3Get = await call("esport.tournaments.get", { id: t3.id });
const breg = (name) => (t3Get.body?.data?.registrations ?? []).find((r) => r.teamName === name);
const bSRJ = breg("Srikandi Jaya");
const bGRM = breg("Garuda Merah");
const bELN = breg("Elang Nusantara");
check("T3: 3 tim terdaftar", [bSRJ, bGRM, bELN].every(Boolean) && t3Get.body?.data?.tournament?.format === "battle_royale");
const gen3 = await call("esport.bracket.generate", { id: t3.id, lobbies: 3 }, wulan);
check("bracket BR → 3 lobi", gen3.status === 200 && gen3.body?.data?.generated === 3 && gen3.body?.data?.stage === "lobby");
const t3Bracket = await call("esport.tournaments.get", { id: t3.id });
const lobbies = (t3Bracket.body?.data?.matches ?? []).filter((m) => m.stage === "lobby");
check("T3: 3 match lobi terjadwal", lobbies.length === 3 && lobbies.every((m) => m.status === "scheduled"));
const lobby1 = lobbies[0];
const brPartial = await call("esport.matches.brResults", { matchId: lobby1.id, results: [{ registrationId: bSRJ.id, placement: 1, kills: 1 }] }, wulan);
check("brResults tim kurang lengkap → 400", brPartial.status === 400);
const brDup = await call("esport.matches.brResults", { matchId: lobby1.id, results: [{ registrationId: bSRJ.id, placement: 1, kills: 1 }, { registrationId: bGRM.id, placement: 1, kills: 1 }, { registrationId: bELN.id, placement: 3, kills: 1 }] }, wulan);
check("brResults placement ganda → 400", brDup.status === 400);
const bres1 = await call("esport.matches.brResults", { matchId: lobby1.id, results: [{ registrationId: bELN.id, placement: 1, kills: 4 }, { registrationId: bSRJ.id, placement: 2, kills: 3 }, { registrationId: bGRM.id, placement: 3, kills: 1 }] }, wulan);
check("lobi 1 tersimpan, belum juara", bres1.status === 200 && bres1.body?.data?.saved === 3 && bres1.body?.data?.champion === null);
const bres2 = await call("esport.matches.brResults", { matchId: lobbies[1].id, results: [{ registrationId: bELN.id, placement: 1, kills: 2 }, { registrationId: bSRJ.id, placement: 2, kills: 5 }, { registrationId: bGRM.id, placement: 3, kills: 0 }] }, wulan);
check("lobi 2 tersimpan", bres2.status === 200 && bres2.body?.data?.champion === null);
const bres3 = await call("esport.matches.brResults", { matchId: lobbies[2].id, results: [{ registrationId: bSRJ.id, placement: 1, kills: 1 }, { registrationId: bELN.id, placement: 2, kills: 1 }, { registrationId: bGRM.id, placement: 3, kills: 2 }] }, wulan);
check("lobi 3 → champion ELN (33 poin)", bres3.status === 200 && bres3.body?.data?.champion === bELN.id);
const lb3 = await call("esport.leaderboard", { id: t3.id });
check("BR klasemen: ELN 33 poin / 7 kill", lb3.body?.data?.rows?.[0]?.regId === bELN.id && lb3.body?.data?.rows?.[0]?.points === 33 && lb3.body?.data?.rows?.[0]?.kills === 7);
check("BR: peringkat terbaik ELN = 1", lb3.body?.data?.rows?.[0]?.bestPlacement === 1);
check("BR championRegId = ELN", lb3.body?.data?.championRegId === bELN.id);
const t3Done = await call("esport.tournaments.get", { id: t3.id });
check("T3 completed + juara ELN", t3Done.body?.data?.tournament?.status === "completed" && (t3Done.body?.data?.registrations ?? []).find((r) => r.id === bELN.id)?.status === "winner");
const gameOnLobby = await call("esport.matches.game.save", { matchId: lobbies[0].id, homeScore: 1, awayScore: 0 }, wulan);
check("game.save di lobi BR → 409", gameOnLobby.status === 409 && gameOnLobby.body?.error === "invalid_format");
const brResultsShown = (t3Done.body?.data?.matches ?? []).find((m) => m.id === lobby1.id)?.brResults ?? [];
check("T3 publik: hasil lobi tampil dengan poin", brResultsShown.length === 3 && brResultsShown.find((r) => r.placement === 1)?.points === 14);

console.log("— koreksi hasil lobi setelah turnamen selesai (T3) —");
const brOutsider = await call("esport.matches.brResults", { matchId: lobby1.id, results: [{ registrationId: bSRJ.id, placement: 1, kills: 6 }, { registrationId: bELN.id, placement: 2, kills: 2 }, { registrationId: bGRM.id, placement: 3, kills: 1 }] }, dewi);
check("koreksi lobi oleh bukan penyelenggara → 403", brOutsider.status === 403);
const brMissingWinner = await call("esport.matches.brResults", { matchId: lobby1.id, results: [{ registrationId: bSRJ.id, placement: 1, kills: 6 }, { registrationId: bGRM.id, placement: 3, kills: 1 }] }, wulan);
check("koreksi tanpa tim juara → 400 (seluruh tim wajib ikut)", brMissingWinner.status === 400);
const brCorrect = await call("esport.matches.brResults", { matchId: lobby1.id, results: [{ registrationId: bSRJ.id, placement: 1, kills: 6 }, { registrationId: bELN.id, placement: 2, kills: 2 }, { registrationId: bGRM.id, placement: 3, kills: 1 }] }, wulan);
check("koreksi hasil lobi setelah selesai → tersimpan + juara baru", brCorrect.status === 200 && brCorrect.body?.data?.saved === 3 && brCorrect.body?.data?.champion === bSRJ.id);
const lb3Corr = await call("esport.leaderboard", { id: t3.id });
check("koreksi: SRJ memimpin 38 poin", lb3Corr.body?.data?.rows?.[0]?.regId === bSRJ.id && lb3Corr.body?.data?.rows?.[0]?.points === 38);
check("koreksi: championRegId pindah ke SRJ", lb3Corr.body?.data?.championRegId === bSRJ.id);
const t3Corr = await call("esport.tournaments.get", { id: t3.id });
const corrRegs = t3Corr.body?.data?.registrations ?? [];
check("koreksi: status juara pindah ke SRJ", corrRegs.find((r) => r.id === bSRJ.id)?.status === "winner" && corrRegs.find((r) => r.id === bELN.id)?.status !== "winner");
const brRestore = await call("esport.matches.brResults", { matchId: lobby1.id, results: [{ registrationId: bELN.id, placement: 1, kills: 4 }, { registrationId: bSRJ.id, placement: 2, kills: 3 }, { registrationId: bGRM.id, placement: 3, kills: 1 }] }, wulan);
check("pemulihan hasil lobi → tersimpan", brRestore.status === 200 && brRestore.body?.data?.champion === bELN.id);
const lb3Restored = await call("esport.leaderboard", { id: t3.id });
check("pemulihan: ELN juara 33 poin", lb3Restored.body?.data?.rows?.[0]?.regId === bELN.id && lb3Restored.body?.data?.rows?.[0]?.points === 33 && lb3Restored.body?.data?.championRegId === bELN.id);
const t3Restored = await call("esport.tournaments.get", { id: t3.id });
check("pemulihan: status juara kembali ke ELN", (t3Restored.body?.data?.registrations ?? []).find((r) => r.id === bELN.id)?.status === "winner");

console.log(`\n${pass} ok, ${fail} gagal`);
process.exit(fail ? 1 : 0);
