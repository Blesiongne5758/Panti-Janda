// E2E test untuk Fase A: Player Stats, Reviews, Disputes, Roster History
const BASE = "http://127.0.0.1:8000/functions/v1/app";
let passed = 0;
let failed = 0;

function ok(msg) { passed++; console.log(`  ok  ${msg}`); }
function fail(msg, detail) { failed++; console.log(`  FAIL  ${msg}${detail ? ` — ${detail}` : ""}`); }

async function api(action, token, body) {
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (token) headers["x-app-session"] = token;
  const res = await fetch(BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...body }),
  });
  const json = await res.json();
  return { status: res.status, data: json.data, error: json.error };
}

async function login(email) {
  const r = await api("auth.login", null, { email, password: "rahasia123" });
  return r.data?.token ?? null;
}

async function main() {
  console.log("=== Fase A E2E Test ===\n");

  // Login
  const wulanToken = await login("wulan@contoh.id");
  const dewiToken = await login("dewi@contoh.id");
  const adminToken = await login("admin@pantijanda.id");

  if (!wulanToken || !dewiToken || !adminToken) {
    fail("Login gagal");
    return;
  }
  ok("Login berhasil (wulan, dewi, admin)");

  // Get player profiles to find a profile ID
  const profilesRes = await api("esport.transfer.profiles.list", wulanToken, { limit: 10 });
  if (!profilesRes.data?.items || profilesRes.data.items.length === 0) {
    fail("Tidak ada profil pemain");
    return;
  }
  const profileId = profilesRes.data.items[0].id;
  ok(`Profil pemain ditemukan: ${profileId}`);

  // Test 1: Player Stats
  console.log("\n--- Player Stats ---");
  const statsGetRes = await api("esport.transfer.stats.get", wulanToken, { id: profileId });
  ok(`Stats get: ${statsGetRes.data?.stats ? "ada data" : "null (belum ada)"}`);

  const statsSaveRes = await api("esport.transfer.stats.save", wulanToken, {
    id: profileId,
    totalMatches: 150,
    winRate: 65.5,
    kdaRatio: 3.8,
    gameSpecific: { kills: 1200, deaths: 315, assists: 1800 },
    tournamentsPlayed: 12,
    tournamentsWon: 4,
    mvpAwards: 25,
    teamWinRate: 68.2,
    dataSource: "manual",
  });
  if (statsSaveRes.data?.stats) {
    ok(`Stats save: totalMatches=${statsSaveRes.data.stats.total_matches}`);
  } else {
    fail("Stats save gagal", JSON.stringify(statsSaveRes));
  }

  // Test 2: Player Reviews
  console.log("\n--- Player Reviews ---");
  const reviewCreateRes = await api("esport.transfer.reviews.create", dewiToken, {
    playerProfileId: profileId,
    ratingSkill: 5,
    ratingTeamwork: 4,
    ratingDiscipline: 5,
    ratingCommunication: 4,
    comment: "Pemain luar biasa, sangat profesional!",
  });
  if (reviewCreateRes.data?.review) {
    ok(`Review create: id=${reviewCreateRes.data.review.id}`);
  } else {
    fail("Review create gagal", JSON.stringify(reviewCreateRes));
  }

  const reviewsListRes = await api("esport.transfer.reviews.list", wulanToken, { id: profileId });
  if (reviewsListRes.data?.items) {
    ok(`Reviews list: ${reviewsListRes.data.items.length} review`);
  } else {
    fail("Reviews list gagal");
  }

  const reviewsSummaryRes = await api("esport.transfer.reviews.summary", wulanToken, { id: profileId });
  if (reviewsSummaryRes.data?.summary) {
    const s = reviewsSummaryRes.data.summary;
    ok(`Reviews summary: count=${s.reviewCount}, avgOverall=${s.avgOverall}`);
  } else {
    fail("Reviews summary gagal");
  }

  // Test 3: Transfer Disputes
  console.log("\n--- Transfer Disputes ---");
  // Get a transfer ID first
  const myRes = await api("esport.transfer.my", wulanToken, {});
  if (!myRes.data?.transfers || myRes.data.transfers.length === 0) {
    ok("Tidak ada transfer untuk test dispute (skip)");
  } else {
    const transferId = myRes.data.transfers[0].id;
    const disputeCreateRes = await api("esport.transfer.disputes.create", wulanToken, {
      transferId,
      reason: "Pemain tidak merespons",
      description: "Sudah menunggu 3 hari tanpa kabar",
      evidence: ["screenshot_chat.png"],
    });
    if (disputeCreateRes.data?.dispute) {
      ok(`Dispute create: id=${disputeCreateRes.data.dispute.id}`);

      const disputesListRes = await api("esport.transfer.disputes.list", wulanToken, { transferId });
      if (disputesListRes.data?.items) {
        ok(`Disputes list: ${disputesListRes.data.items.length} dispute`);
      } else {
        fail("Disputes list gagal");
      }

      // Admin resolve
      const disputeResolveRes = await api("esport.transfer.disputes.resolve", adminToken, {
        id: disputeCreateRes.data.dispute.id,
        status: "resolved",
        resolution: "Transfer dilanjutkan dengan mediasi",
      });
      if (disputeResolveRes.data?.dispute) {
        ok(`Dispute resolve: status=${disputeResolveRes.data.dispute.status}`);
      } else {
        fail("Dispute resolve gagal", JSON.stringify(disputeResolveRes));
      }
    } else {
      fail("Dispute create gagal", JSON.stringify(disputeCreateRes));
    }
  }

  // Test 4: Roster History
  console.log("\n--- Roster History ---");
  const rosterRes = await api("esport.transfer.roster.list", wulanToken, { playerProfileId: profileId });
  if (rosterRes.data?.items) {
    ok(`Roster history: ${rosterRes.data.items.length} entri`);
  } else {
    fail("Roster history gagal");
  }

  console.log(`\n=== Hasil: ${passed} ok, ${failed} gagal ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
