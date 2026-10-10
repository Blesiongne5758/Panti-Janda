// Panti Janda — business handler for the Sites "app" Function.
// Every data path goes through this router; the browser never talks to the database directly.

const enc = new TextEncoder();
const now = () => new Date().toISOString();

// The platform adapter passes only { request, supabase }; secrets are read from
// the runtime environment (Deno in production, process.env in the local fixture).
const readEnv = (name) => {
  try {
    if (typeof globalThis.Deno !== "undefined" && globalThis.Deno?.env) {
      return globalThis.Deno.env.get(name) ?? undefined;
    }
    return globalThis.process?.env?.[name] ?? undefined;
  } catch {
    return undefined;
  }
};

const ROLE_RANK = { public: 1, kades: 2, wonder_woman: 2, gubernur: 3, sosialita: 3, panglima: 4, high_society: 4, presiden: 5, the_ceo: 5, admin: 6 };
const WIDOW_ROLES = ["wonder_woman", "sosialita", "high_society", "the_ceo"];
const PUBLIC_ROLES = ["kades", "gubernur", "panglima", "presiden"];
const AUDIENCES = ["umum", "anggota", "undangan"];
const PROGRAM_CATEGORIES = ["akademi", "pelatihan", "seminar", "penempatan_kerja"];
const SUPPORT_TYPES = ["dana", "jasa", "barang"];
const VERIFICATION_DOC_TYPES = ["ktp", "pengadilan"];
const MAX_DOC_CHARS = 900_000;
const SIM_CLASSES = ["A", "B1", "B2", "C"];
const MAX_MESSAGE_CHARS = 2000;
const SESSION_DAYS = 30;
const MAX_LEVEL = 50;

const KPI_POINTS = {
  event_create: 50,
  event_committee: 30,
  event_attend: 10,
  donation: 20,
  campaign_donate: 20,
  program_complete: 40,
  profile_update: 5,
  business_submit: 30,
  listing_create: 15,
  listing_sale: 25,
  mentor_chat: 5,
};

function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level - 1, 2));
}

function totalXpForLevel(level) {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

function levelFromXp(xp) {
  for (let lvl = MAX_LEVEL; lvl >= 1; lvl--) {
    if (xp >= totalXpForLevel(lvl)) return lvl;
  }
  return 1;
}

function roleFromLevel(level, isJanda) {
  if (level >= 46) return isJanda ? "the_ceo" : "presiden";
  if (level >= 36) return isJanda ? "high_society" : "panglima";
  if (level >= 21) return isJanda ? "sosialita" : "gubernur";
  if (level >= 1) return isJanda ? "wonder_woman" : "kades";
  return "public";
}

function tierFromLevel(level) {
  if (level >= 46) return "the_ceo";
  if (level >= 36) return "high_society";
  if (level >= 21) return "sosialita";
  return "wonder_woman";
}

function publicTierFromLevel(level) {
  if (level >= 46) return "presiden";
  if (level >= 36) return "panglima";
  if (level >= 21) return "gubernur";
  return "kades";
}

const LEVEL_TITLES = {
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

function levelTitle(level, isJanda) {
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

const BADGE_TIERS = {
  donor_dana: [
    { tier: 1, label: "Pendana Perunggu", minCount: 1 },
    { tier: 2, label: "Pendana Perak", minCount: 3 },
    { tier: 3, label: "Pendana Emas", minCount: 10 },
    { tier: 4, label: "Pendana Berlian", minCount: 25 },
  ],
  donor_kampanye: [
    { tier: 1, label: "Penderma Perunggu", minCount: 1 },
    { tier: 2, label: "Penderma Perak", minCount: 3 },
    { tier: 3, label: "Penderma Emas", minCount: 10 },
    { tier: 4, label: "Penderma Berlian", minCount: 25 },
  ],
  donor_jasa: [
    { tier: 1, label: "Relawan Perunggu", minCount: 1 },
    { tier: 2, label: "Relawan Perak", minCount: 3 },
    { tier: 3, label: "Relawan Emas", minCount: 10 },
    { tier: 4, label: "Relawan Berlian", minCount: 25 },
  ],
  donor_barang: [
    { tier: 1, label: "Penyumbang Perunggu", minCount: 1 },
    { tier: 2, label: "Penyumbang Perak", minCount: 3 },
    { tier: 3, label: "Penyumbang Emas", minCount: 10 },
    { tier: 4, label: "Penyumbang Berlian", minCount: 25 },
  ],
};

const json = (payload, status = 200) =>
  Response.json(payload, { status, headers: { "cache-control": "no-store" } });
const ok = (data) => json({ ok: true, data });
const fail = (status, code) => json({ ok: false, error: code }, status);

// ---------- primitives ----------

const text = (value, max = 500) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const textOrNull = (value, max = 500) => text(value, max) || null;
const email = (value) => {
  const v = text(value, 160).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
};
const intOrNull = (value, min, max) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const dateOrNull = (value) => {
  const v = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
};
const simClassesOf = (value) =>
  Array.isArray(value)
    ? [...new Set(value.map((v) => text(v, 3).toUpperCase()).filter((v) => SIM_CLASSES.includes(v)))]
    : [];
const words = (value, max = 20, itemMax = 60) =>
  Array.isArray(value)
    ? [...new Set(value.map((v) => text(v, itemMax)).filter(Boolean))].slice(0, max)
    : [];

function b64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(value) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function b64url(bytes) {
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, 150000);
  return `pbkdf2$150000$${b64(salt)}$${b64(hash)}`;
}
async function verifyPassword(password, stored) {
  const parts = String(stored ?? "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const salt = unb64(parts[2]);
  const expected = unb64(parts[3]);
  const actual = await pbkdf2(password, salt, Number(parts[1]) || 150000);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

// ---------- auth ----------

async function authenticate(supabase, request) {
  const token = request.headers.get("x-app-session");
  if (!token || token.length > 200) return null;
  const tokenHash = await sha256Hex(token);
  const { data: session } = await supabase
    .from("sessions")
    .select("id,account_id,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!session || new Date(session.expires_at).getTime() < Date.now()) return null;
  const { data: account } = await supabase
    .from("accounts")
    .select("id,email,role,status,display_name,level,xp")
    .eq("id", session.account_id)
    .maybeSingle();
  if (!account || account.status !== "active") return null;
  return { account, sessionId: session.id };
}

async function actor(ctx, minRole = 1) {
  if (ctx._actor === undefined) ctx._actor = await authenticate(ctx.supabase, ctx.request);
  if (!ctx._actor) return { error: fail(401, "not_authenticated") };
  const { account } = ctx._actor;
  if ((ROLE_RANK[account.role] ?? 0) < minRole) return { error: fail(403, "forbidden") };
  return { account, rank: ROLE_RANK[account.role] ?? 0 };
}

const publicAccount = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  status: row.status,
  displayName: row.display_name ?? null,
  level: row.level ?? 1,
  xp: row.xp ?? 0,
});

const publicProfile = (row, includePrivate = false) => {
  const base = {
    id: row.id,
    accountId: row.account_id,
    nickname: row.nickname,
    tier: row.tier,
    city: row.city,
    age: row.age,
    dependents: row.dependents,
    employmentStatus: row.employment_status,
    skills: row.skills ?? [],
    trainings: row.trainings ?? [],
    needsTarget: row.needs_target,
    mainTarget: row.main_target,
    interests: row.interests ?? [],
    bio: row.bio,
    fundingInfo: row.funding_info,
    photoData: row.photo_data ?? null,
    education: row.education ?? null,
    insurance: row.insurance ?? null,
    simClasses: row.sim_classes ?? [],
    passport: row.passport ?? null,
    status: row.status,
    rejectReason: row.reject_reason ?? null,
    verifiedAt: row.verified_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  // full_name, the verification document, bank account details, and the
  // identity-revealing biodata (birth place/date, body measurements) are
  // sensitive: only the profile owner (login/me/update responses) and admin
  // review ever receive them.
  if (includePrivate) {
    base.heightCm = row.height_cm ?? null;
    base.weightKg = row.weight_kg ?? null;
    base.birthPlace = row.birth_place ?? null;
    base.birthDate = row.birth_date ?? null;
    base.fullName = row.full_name ?? null;
    base.whatsapp = row.whatsapp ?? null;
    base.address = row.address ?? null;
    base.verificationDoc = row.verification_doc_data
      ? {
          type: row.verification_doc_type,
          fileName: row.verification_doc_name ?? null,
          dataUrl: row.verification_doc_data,
        }
      : null;
    base.bank = row.bank_name
      ? {
          bankName: row.bank_name,
          bankAccountName: row.bank_account_name ?? null,
          bankAccountNumber: row.bank_account_number ?? null,
        }
      : null;
  }
  return base;
};

const verificationDoc = (value) => {
  if (!value || typeof value !== "object") return { error: "verification_doc_required" };
  if (!VERIFICATION_DOC_TYPES.includes(value.type)) return { error: "invalid_verification_doc" };
  const dataUrl = typeof value.dataUrl === "string" ? value.dataUrl : "";
  if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_DOC_CHARS) {
    return { error: "invalid_verification_doc" };
  }
  return { doc: { type: value.type, name: textOrNull(value.fileName, 200), dataUrl } };
};

async function ownProfile(supabase, accountId) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  return data ?? null;
}

// Widow profiles visible to a viewer: guests/public see verified wonder-woman
// profiles only; widow members see all verified tiers; admin sees everything.
function profileVisible(row, account) {
  const rank = ROLE_RANK[account?.role] ?? 0;
  if (rank >= 6) return true;
  if (row.account_id === account?.id) return true;
  if (rank >= 2) return true;
  return row.tier === "wonder_woman" && row.status === "verified";
}

async function namesFor(supabase, accountIds) {
  const ids = [...new Set(accountIds.filter(Boolean))];
  const map = new Map();
  if (ids.length === 0) return map;
  const { data: accounts } = await supabase.from("accounts").select("id,display_name").in("id", ids);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("account_id,nickname,tier,photo_data")
    .in("account_id", ids);
  const profilesByAccount = new Map((profiles ?? []).map((p) => [p.account_id, p]));
  for (const a of accounts ?? []) {
    const p = profilesByAccount.get(a.id);
    map.set(a.id, {
      displayName: a.display_name ?? null,
      nickname: p?.nickname ?? null,
      tier: p?.tier ?? null,
      photoData: p?.photo_data ?? null,
    });
  }
  return map;
}

async function isEnrolled(supabase, table, column, value, accountId) {
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq(column, value)
    .eq("account_id", accountId)
    .maybeSingle();
  return data?.id ?? null;
}

async function awardKpi(supabase, accountId, sourceType, sourceId) {
  const points = KPI_POINTS[sourceType];
  if (!points) return;
  await supabase.from("kpi_logs").insert({
    id: crypto.randomUUID(),
    account_id: accountId,
    source_type: sourceType,
    source_id: sourceId,
    points,
    created_at: now(),
  });
  const { data: logs } = await supabase
    .from("kpi_logs")
    .select("points")
    .eq("account_id", accountId);
  const totalPoints = (logs ?? []).reduce((sum, l) => sum + l.points, 0);
  const level = levelFromXp(totalPoints);
  const existing = await isEnrolled(supabase, "kpi_summary", "account_id", "account_id", accountId);
  if (existing) {
    await supabase.from("kpi_summary").update({ total_points: totalPoints, level, updated_at: now() }).eq("account_id", accountId);
  } else {
    await supabase.from("kpi_summary").insert({
      account_id: accountId,
      total_points: totalPoints,
      level,
      updated_at: now(),
    });
  }
  const { data: account } = await supabase
    .from("accounts")
    .select("id,role,level,xp")
    .eq("id", accountId)
    .maybeSingle();
  if (account) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("account_id", accountId)
      .maybeSingle();
    const isJanda = Boolean(profile);
    const newRole = roleFromLevel(level, isJanda);
    await supabase
      .from("accounts")
      .update({ level, xp: totalPoints, role: newRole })
      .eq("id", accountId);
  }
}

async function awardBadge(supabase, accountId, badgeType) {
  const tiers = BADGE_TIERS[badgeType];
  if (!tiers) return;
  const { data: logs } = await supabase
    .from("kpi_logs")
    .select("source_type")
    .eq("account_id", accountId)
    .eq("source_type", badgeType === "donor_dana" ? "donation" : badgeType === "donor_kampanye" ? "campaign_donate" : badgeType === "donor_jasa" ? "pledge" : "pledge");
  const count = (logs ?? []).length;
  const tier = tiers.filter((t) => count >= t.minCount).pop()?.tier ?? 0;
  if (tier === 0) return;
  const { data: existing } = await supabase
    .from("badges")
    .select("*")
    .eq("account_id", accountId)
    .eq("badge_type", badgeType)
    .maybeSingle();
  const label = tiers.find((t) => t.tier === tier)?.label ?? "";
  if (existing) {
    if (existing.tier < tier) {
      await supabase.from("badges").update({ tier, label, awarded_at: now() }).eq("id", existing.id);
    }
  } else {
    await supabase.from("badges").insert({
      id: crypto.randomUUID(),
      account_id: accountId,
      badge_type: badgeType,
      label,
      tier,
      awarded_at: now(),
    });
  }
}

async function countRows(supabase, table, build) {
  const { data } = await build(supabase.from(table).select("id"));
  return (data ?? []).length;
}

// ---------- routes ----------

const ROUTES = {
  "auth.register": register,
  "auth.login": login,
  "auth.logout": logout,
  "auth.me": me,

  "home.summary": homeSummary,

  "profiles.list": profilesList,
  "profiles.get": profilesGet,
  "profiles.update": profilesUpdate,

  "updates.list": updatesList,
  "updates.create": updatesCreate,
  "comments.list": commentsList,
  "comments.create": commentsCreate,

  "reports.create": reportsCreate,

  "pledges.create": pledgesCreate,
  "pledges.mine": pledgesMine,

  "donations.create": donationsCreate,
  "donations.mine": donationsMine,
  "donations.list": donationsList,

  "events.list": eventsList,
  "events.get": eventsGet,
  "events.create": eventsCreate,
  "events.cancel": eventsCancel,
  "events.rsvp": eventsRsvp,
  "events.invite": eventsInvite,
  "events.committee.add": eventCommitteeAdd,
  "events.committee.list": eventCommitteeList,
  "events.committee.remove": eventCommitteeRemove,
  "events.tickets.list": eventTicketsList,
  "events.tickets.buy": eventTicketsBuy,
  "events.checkin": eventCheckin,

  "groups.list": groupsList,
  "groups.get": groupsGet,
  "groups.create": groupsCreate,
  "groups.join": groupsJoin,
  "groups.leave": groupsLeave,
  "groups.messages": groupsMessages,
  "groups.send": groupsSend,

  "follows.toggle": followsToggle,
  "follows.mine": followsMine,

  "chat.contacts": chatContacts,
  "chat.thread": chatThread,
  "chat.send": chatSend,

  "programs.list": programsList,
  "programs.create": programsCreate,
  "programs.enroll": programsEnroll,
  "programs.unenroll": programsUnenroll,

  "admin.stats": adminStats,
  "admin.accounts.list": adminAccountsList,
  "admin.accounts.setRole": adminSetRole,
  "admin.accounts.setStatus": adminSetStatus,
  "admin.profiles.pending": adminProfilesPending,
  "admin.profiles.review": adminReviewProfile,
  "admin.reports.list": adminReportsList,
  "admin.reports.resolve": adminResolveReport,
  "admin.settings.get": adminSettingsGet,
  "admin.settings.update": adminSettingsUpdate,
  "admin.trial.status": adminTrialStatus,
  "admin.trial.create": adminTrialCreate,
  "admin.trial.delete": adminTrialDelete,

  "notifications.list": notificationsList,
  "notifications.markRead": notificationsMarkRead,

  "campaigns.list": campaignsList,
  "campaigns.get": campaignsGet,
  "campaigns.create": campaignsCreate,
  "campaigns.donate": campaignsDonate,

  "businesses.list": businessesList,
  "businesses.get": businessesGet,
  "businesses.create": businessesCreate,
  "businesses.mine": businessesMine,
  "businesses.update": businessesUpdate,

  "marketplace.list": marketplaceList,
  "marketplace.get": marketplaceGet,
  "marketplace.create": marketplaceCreate,
  "marketplace.mine": marketplaceMine,
  "marketplace.update": marketplaceUpdate,

  "subscriptions.create": subscriptionsCreate,
  "subscriptions.mine": subscriptionsMine,
  "subscriptions.cancel": subscriptionsCancel,
  "subscriptions.prices": subscriptionsPrices,

  "academy.settings": academySettings,
  "trading.settings": tradingSettings,
  "links.settings": linksSettings,
  "liveTrading.settings": liveTradingSettings,
  "metaTrader5.settings": metaTrader5Settings,
  "aiTradingAgent.settings": aiTradingAgentSettings,
  "coinSettings.settings": coinSettingsPublic,

  "ai.mentor.chat": aiMentorChat,

  "finance.summary": financeSummary,

  "kpi.mine": kpiMine,
  "kpi.badges": kpiBadges,
  "level.info": levelInfo,

  "coins.balance": coinsBalance,
  "coins.packages": coinsPackages,
  "coins.purchase": coinsPurchase,
  "coins.transactions": coinsTransactions,
  "coins.spend": coinsSpend,
  "coins.features": coinsFeatures,
  "coins.withdraw": coinsWithdraw,
};

// ---------- auth handlers ----------

async function register(ctx) {
  const { body, supabase } = ctx;
  const kind = body.kind === "member" ? "member" : "public";
  const mail = email(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!mail) return fail(400, "invalid_email");
  if (password.length < 8 || password.length > 200) return fail(400, "weak_password");

  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("email", mail)
    .maybeSingle();
  if (existing) return fail(409, "email_taken");

  let profile = null;
  if (kind === "member") {
    const nickname = text(body.nickname, 40);
    if (nickname.length < 2) return fail(400, "invalid_nickname");
    const fullName = text(body.fullName, 100);
    if (fullName.length < 2) return fail(400, "invalid_full_name");
    const doc = verificationDoc(body.verificationDoc);
    if (doc.error) return fail(400, doc.error);
    profile = {
      nickname,
      fullName,
      verificationDoc: doc.doc,
      city: textOrNull(body.city, 80),
      age: intOrNull(body.age, 17, 99),
      dependents: intOrNull(body.dependents, 0, 20),
      employmentStatus: textOrNull(body.employmentStatus, 120),
      skills: words(body.skills),
      trainings: words(body.trainings),
      needsTarget: textOrNull(body.needsTarget, 400),
      mainTarget: textOrNull(body.mainTarget, 400),
      interests: words(body.interests),
      bio: textOrNull(body.bio, 1200),
      fundingInfo: textOrNull(body.fundingInfo, 400),
    };
  } else {
    const displayName = text(body.displayName, 60);
    if (displayName.length < 2) return fail(400, "invalid_display_name");
  }

  const { data: anyAccount } = await supabase.from("accounts").select("id").limit(1);
  const isBootstrap = (anyAccount ?? []).length === 0;
  const role = isBootstrap ? "admin" : kind === "member" ? "wonder_woman" : "kades";
  const displayName =
    kind === "member" ? profile.nickname : text(body.displayName, 60);

  const account = {
    id: crypto.randomUUID(),
    email: mail,
    password_hash: await hashPassword(password),
    role,
    status: "active",
    display_name: displayName,
    level: 1,
    xp: 0,
    created_at: now(),
  };
  const { error } = await supabase.from("accounts").insert(account);
  if (error) return fail(error.code === "23505" ? 409 : 500, error.code === "23505" ? "email_taken" : "server_error");

  let createdProfile = null;
  if (kind === "member") {
    createdProfile = {
      id: crypto.randomUUID(),
      account_id: account.id,
      nickname: profile.nickname,
      tier: "wonder_woman",
      full_name: profile.fullName,
      verification_doc_type: profile.verificationDoc.type,
      verification_doc_name: profile.verificationDoc.name,
      verification_doc_data: profile.verificationDoc.dataUrl,
      city: profile.city,
      age: profile.age,
      dependents: profile.dependents,
      employment_status: profile.employmentStatus,
      skills: profile.skills,
      trainings: profile.trainings,
      needs_target: profile.needsTarget,
      main_target: profile.mainTarget,
      interests: profile.interests,
      bio: profile.bio,
      funding_info: profile.fundingInfo,
      status: "pending",
      reject_reason: null,
      verified_at: null,
      created_at: now(),
      updated_at: now(),
    };
    const { error: pError } = await supabase.from("profiles").insert(createdProfile);
    if (pError) return fail(500, "server_error");
  }

  const session = await createSession(supabase, account.id);
  return ok({
    token: session.token,
    account: publicAccount(account),
    profile: createdProfile ? publicProfile(createdProfile, true) : null,
    bootstrap: isBootstrap,
  });
}

async function login(ctx) {
  const { body, supabase } = ctx;
  const mail = email(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!mail || !password) return fail(400, "invalid_credentials");
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("email", mail)
    .maybeSingle();
  if (!account) return fail(401, "invalid_credentials");
  if (!(await verifyPassword(password, account.password_hash))) return fail(401, "invalid_credentials");
  if (account.status !== "active") return fail(403, "account_suspended");
  const session = await createSession(supabase, account.id);
  const profile = WIDOW_ROLES.includes(account.role) ? await ownProfile(supabase, account.id) : null;
  return ok({
    token: session.token,
    account: publicAccount(account),
    profile: profile ? publicProfile(profile, true) : null,
  });
}

async function createSession(supabase, accountId) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = b64url(raw);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await supabase.from("sessions").insert({
    id: crypto.randomUUID(),
    account_id: accountId,
    token_hash: await sha256Hex(token),
    expires_at: expires,
    created_at: now(),
  });
  return { token, expires };
}

async function logout(ctx) {
  const auth = await actor(ctx);
  if (auth.error) return auth.error;
  await ctx.supabase.from("sessions").delete().eq("id", ctx._actor.sessionId);
  return ok({ loggedOut: true });
}

async function me(ctx) {
  const auth = await actor(ctx);
  if (auth.error) return auth.error;
  const profile = WIDOW_ROLES.includes(auth.account.role)
    ? await ownProfile(ctx.supabase, auth.account.id)
    : null;
  return ok({ account: publicAccount(auth.account), profile: profile ? publicProfile(profile, true) : null });
}

// ---------- home ----------

async function homeSummary(ctx) {
  const { supabase } = ctx;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "verified")
    .eq("tier", "wonder_woman")
    .order("created_at", { ascending: false })
    .limit(4);
  const { data: programs } = await supabase
    .from("programs")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(3);
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .eq("audience", "umum")
    .order("starts_at", { ascending: true })
    .limit(3);
  const verifiedCount = await countRows(supabase, "profiles", (q) => q.eq("status", "verified"));
  const programCount = await countRows(supabase, "programs", (q) => q.eq("status", "published"));
  const memberCount = await countRows(supabase, "accounts", (q) => q.in("role", WIDOW_ROLES));
  return ok({
    profiles: (profiles ?? []).map((row) => publicProfile(row)),
    programs: (programs ?? []).map(programPublic),
    events: (events ?? []).map(eventPublic),
    stats: { verifiedMembers: verifiedCount, programs: programCount, members: memberCount },
    paymentEnabled: Boolean(ctx.env("MIDTRANS_SERVER_KEY")),
  });
}

// ---------- profiles ----------

async function profilesList(ctx) {
  const { body, supabase } = ctx;
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const rank = account ? ROLE_RANK[account.role] ?? 0 : 0;
  const pageNo = Math.max(1, intOrNull(body.page, 1, 500) ?? 1);
  const perPage = Math.min(24, Math.max(4, intOrNull(body.perPage, 4, 24) ?? 12));

  let query = supabase.from("profiles").select("*");
  if (rank >= 6 && (body.status === "pending" || body.status === "rejected" || body.status === "verified")) {
    query = query.eq("status", body.status);
  } else {
    query = query.eq("status", "verified");
    if (rank < 2) query = query.eq("tier", "wonder_woman");
  }
  const tier = body.tier;
  if (rank >= 2 && WIDOW_ROLES.includes(tier)) query = query.eq("tier", tier);
  const city = text(body.city, 80);
  if (city) query = query.eq("city", city);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range((pageNo - 1) * perPage, pageNo * perPage);
  if (error) return fail(500, "server_error");

  const rows = data ?? [];
  const hasMore = rows.length > perPage;
  let items = rows.slice(0, perPage).map((row) => publicProfile(row));
  const q = text(body.q, 80).toLowerCase();
  if (q) {
    items = items.filter((p) =>
      [p.nickname, p.city, p.mainTarget, p.needsTarget, ...(p.skills ?? []), ...(p.interests ?? [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }
  return ok({ items, hasMore, page: pageNo });
}

async function profilesGet(ctx) {
  const { body, supabase } = ctx;
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const id = text(body.id, 60);
  if (!id) return fail(400, "invalid_input");
  const { data: row } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!row || !profileVisible(row, account)) return fail(404, "not_found");

  const { data: donationRows } = await supabase
    .from("donations")
    .select("gross_amount,status")
    .eq("profile_id", id);
  const donationTotal = (donationRows ?? [])
    .filter((d) => d.status === "settled")
    .reduce((sum, d) => sum + Number(d.gross_amount ?? 0), 0);
  const pledgeCount = await countRows(supabase, "pledges", (q) => q.eq("profile_id", id).neq("status", "ditolak"));
  const updateCount = await countRows(supabase, "updates", (q) => q.eq("profile_id", id).eq("status", "visible"));
  const { data: followRows } = await supabase
    .from("follows")
    .select("follower_account_id")
    .eq("followed_account_id", row.account_id);
  const followers = followRows ?? [];
  const viewerFollows =
    Boolean(account) && ROLE_RANK[account.role] >= 2 && followers.some((f) => f.follower_account_id === account.id);

  return ok({
    profile: publicProfile(row),
    support: { donationTotal, pledgeCount, updateCount },
    follow: { followerCount: followers.length, viewerFollows },
    paymentEnabled: Boolean(ctx.env("MIDTRANS_SERVER_KEY")),
  });
}

async function profilesUpdate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profile = await ownProfile(ctx.supabase, auth.account.id);
  if (!profile) return fail(404, "not_found");
  const { body } = ctx;
  const nickname = text(body.nickname, 40);
  if (nickname.length < 2) return fail(400, "invalid_nickname");
  const fullName = text(body.fullName, 100);
  if (fullName.length < 2) return fail(400, "invalid_full_name");
  const patch = {
    nickname,
    full_name: fullName,
    city: textOrNull(body.city, 80),
    age: intOrNull(body.age, 17, 99),
    dependents: intOrNull(body.dependents, 0, 20),
    employment_status: textOrNull(body.employmentStatus, 120),
    skills: words(body.skills),
    trainings: words(body.trainings),
    needs_target: textOrNull(body.needsTarget, 400),
    main_target: textOrNull(body.mainTarget, 400),
    interests: words(body.interests),
    bio: textOrNull(body.bio, 1200),
    funding_info: textOrNull(body.fundingInfo, 400),
    updated_at: now(),
  };
  if (profile.status === "rejected") {
    patch.status = "pending";
    patch.reject_reason = null;
  }
  if (body.verificationDoc !== undefined && body.verificationDoc !== null) {
    const doc = verificationDoc(body.verificationDoc);
    if (doc.error) return fail(400, doc.error);
    patch.verification_doc_type = doc.doc.type;
    patch.verification_doc_name = doc.doc.name;
    patch.verification_doc_data = doc.doc.dataUrl;
  }
  // Settings fields are patched only when provided, so the profile edit dialog
  // never wipes them and vice versa.
  if (body.photo !== undefined) {
    if (body.photo === null) patch.photo_data = null;
    else {
      const dataUrl = typeof body.photo === "string" ? body.photo : "";
      if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_DOC_CHARS) {
        return fail(400, "invalid_photo");
      }
      patch.photo_data = dataUrl;
    }
  }
  if (body.education !== undefined) patch.education = textOrNull(body.education, 60);
  if (body.insurance !== undefined) patch.insurance = textOrNull(body.insurance, 120);
  if (body.height !== undefined) patch.height_cm = intOrNull(body.height, 80, 250);
  if (body.weight !== undefined) patch.weight_kg = intOrNull(body.weight, 25, 300);
  if (body.birthPlace !== undefined) patch.birth_place = textOrNull(body.birthPlace, 80);
  if (body.birthDate !== undefined) patch.birth_date = dateOrNull(body.birthDate);
  if (body.simClasses !== undefined) patch.sim_classes = simClassesOf(body.simClasses);
  if (body.passport !== undefined) {
    patch.passport = body.passport === true ? true : body.passport === false ? false : null;
  }
  if (body.bankName !== undefined) patch.bank_name = textOrNull(body.bankName, 80);
  if (body.bankAccountName !== undefined) patch.bank_account_name = textOrNull(body.bankAccountName, 100);
  if (body.bankAccountNumber !== undefined) patch.bank_account_number = textOrNull(body.bankAccountNumber, 40);
  if (body.whatsapp !== undefined) patch.whatsapp = textOrNull(body.whatsapp, 20);
  if (body.address !== undefined) patch.address = textOrNull(body.address, 500);
  const { error } = await ctx.supabase.from("profiles").update(patch).eq("id", profile.id);
  if (error) return fail(500, "server_error");
  return ok({ profile: publicProfile({ ...profile, ...patch }, true) });
}

// ---------- updates & comments ----------

async function updatesList(ctx) {
  const { body, supabase } = ctx;
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const profileId = text(body.profileId, 60);
  if (!profileId) return fail(400, "invalid_input");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!profile || !profileVisible(profile, account)) return fail(404, "not_found");
  const { data: updates } = await supabase
    .from("updates")
    .select("*")
    .eq("profile_id", profileId)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(20);
  return ok({ items: (updates ?? []).map(updatePublic) });
}

const updatePublic = (row) => ({
  id: row.id,
  profileId: row.profile_id,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
});

async function updatesCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profile = await ownProfile(ctx.supabase, auth.account.id);
  if (!profile) return fail(404, "not_found");
  if (profile.status !== "verified") return fail(403, "profile_not_verified");
  const title = text(ctx.body.title, 120);
  const bodyText = text(ctx.body.body, 2000);
  if (title.length < 3 || bodyText.length < 3) return fail(400, "invalid_input");
  const row = {
    id: crypto.randomUUID(),
    profile_id: profile.id,
    title,
    body: bodyText,
    status: "visible",
    created_at: now(),
  };
  const { error } = await ctx.supabase.from("updates").insert(row);
  if (error) return fail(500, "server_error");
  return ok({ update: updatePublic(row) });
}

async function commentsList(ctx) {
  const { body, supabase } = ctx;
  const updateId = text(body.updateId, 60);
  if (!updateId) return fail(400, "invalid_input");
  const { data: rows } = await supabase
    .from("comments")
    .select("*")
    .eq("update_id", updateId)
    .eq("status", "visible")
    .order("created_at", { ascending: true })
    .limit(100);
  return ok({
    items: (rows ?? []).map((c) => ({
      id: c.id,
      updateId: c.update_id,
      authorName: c.author_name,
      body: c.body,
      createdAt: c.created_at,
    })),
  });
}

async function commentsCreate(ctx) {
  const auth = await actor(ctx, 1);
  if (auth.error) return auth.error;
  const updateId = text(ctx.body.updateId, 60);
  const bodyText = text(ctx.body.body, 600);
  if (!updateId || bodyText.length < 2) return fail(400, "invalid_input");
  const { data: row } = await ctx.supabase.from("updates").select("id,status").eq("id", updateId).maybeSingle();
  if (!row || row.status !== "visible") return fail(404, "not_found");
  const comment = {
    id: crypto.randomUUID(),
    update_id: updateId,
    account_id: auth.account.id,
    author_name: auth.account.display_name ?? "Anggota",
    body: bodyText,
    status: "visible",
    created_at: now(),
  };
  const { error } = await ctx.supabase.from("comments").insert(comment);
  if (error) return fail(500, "server_error");
  return ok({
    comment: {
      id: comment.id,
      updateId,
      authorName: comment.author_name,
      body: comment.body,
      createdAt: comment.created_at,
    },
  });
}

// ---------- reports ----------

async function reportsCreate(ctx) {
  const auth = await actor(ctx, 1);
  if (auth.error) return auth.error;
  const targetType = ["profile", "update", "comment"].includes(ctx.body.targetType)
    ? ctx.body.targetType
    : null;
  const targetId = text(ctx.body.targetId, 60);
  const reason = text(ctx.body.reason, 300);
  if (!targetType || !targetId || reason.length < 5) return fail(400, "invalid_input");
  const { error } = await ctx.supabase.from("reports").insert({
    id: crypto.randomUUID(),
    reporter_id: auth.account.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    detail: textOrNull(ctx.body.detail, 1000),
    status: "open",
    created_at: now(),
    resolved_at: null,
  });
  if (error) return fail(500, "server_error");
  return ok({ reported: true });
}

// ---------- pledges & donations ----------

async function pledgesCreate(ctx) {
  const { body, supabase } = ctx;
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const supportType = SUPPORT_TYPES.includes(body.supportType) ? body.supportType : null;
  if (!supportType) return fail(400, "invalid_input");
  const supporterName =
    text(body.supporterName, 80) || account?.display_name || "";
  if (supporterName.length < 2) return fail(400, "invalid_name");
  const profileId = text(body.profileId, 60) || null;
  if (profileId) {
    const { data: profile } = await supabase.from("profiles").select("id,status").eq("id", profileId).maybeSingle();
    if (!profile || profile.status !== "verified") return fail(404, "not_found");
  }
  const amount = intOrNull(body.amount, 1000, 100000000000);
  const { error } = await supabase.from("pledges").insert({
    id: crypto.randomUUID(),
    profile_id: profileId,
    account_id: account?.id ?? null,
    supporter_name: supporterName,
    contact: textOrNull(body.contact, 120),
    support_type: supportType,
    amount,
    message: textOrNull(body.message, 600),
    status: "baru",
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  if (account?.id) {
    if (supportType === "jasa") await awardBadge(supabase, account.id, "donor_jasa");
    else if (supportType === "barang") await awardBadge(supabase, account.id, "donor_barang");
  }
  return ok({ received: true });
}

const pledgePublic = (row) => ({
  id: row.id,
  profileId: row.profile_id,
  supporterName: row.supporter_name,
  contact: row.contact,
  supportType: row.support_type,
  amount: row.amount,
  message: row.message,
  status: row.status,
  createdAt: row.created_at,
});

async function pledgesMine(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profile = await ownProfile(ctx.supabase, auth.account.id);
  if (!profile) return ok({ items: [] });
  const { data } = await ctx.supabase
    .from("pledges")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return ok({ items: (data ?? []).map(pledgePublic) });
}

async function donationsCreate(ctx) {
  const { body, supabase } = ctx;
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const serverKey = ctx.env("MIDTRANS_SERVER_KEY");
  if (!serverKey) return fail(503, "service_not_configured");
  const profileId = text(body.profileId, 60);
  const amount = intOrNull(body.amount, 10000, 100000000000);
  if (!profileId || !amount) return fail(400, "invalid_input");
  const { data: profile } = await supabase.from("profiles").select("id,nickname,status").eq("id", profileId).maybeSingle();
  if (!profile || profile.status !== "verified") return fail(404, "not_found");

  const orderId = `PJ-${Date.now()}-${b64url(crypto.getRandomValues(new Uint8Array(4)))}`;
  const base = ctx.env("MIDTRANS_ENV") === "production"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
  const supporterName = text(body.supporterName, 80) || account?.display_name || "Sahabat Panti Janda";
  const supporterEmail = email(body.supporterEmail) ?? account?.email ?? null;

  let redirectUrl = null;
  let gatewayError = false;
  try {
    const response = await safeFetch(`${base}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Basic ${b64(enc.encode(`${serverKey}:`))}`,
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: profileId, price: amount, quantity: 1, name: `Dukungan untuk ${profile.nickname}`.slice(0, 50) }],
        customer_details: { first_name: supporterName.slice(0, 50), email: supporterEmail ?? undefined },
      }),
    });
    const payload = await response.json().catch(() => null);
    redirectUrl = typeof payload?.redirect_url === "string" ? payload.redirect_url : null;
    if (!response.ok || !redirectUrl) gatewayError = true;
  } catch {
    gatewayError = true;
  }
  if (gatewayError) return fail(502, "gateway_error");

  const { error } = await supabase.from("donations").insert({
    id: crypto.randomUUID(),
    profile_id: profileId,
    order_id: orderId,
    gross_amount: amount,
    supporter_name: supporterName,
    supporter_email: supporterEmail,
    status: "pending",
    gateway: "midtrans",
    redirect_url: redirectUrl,
    created_at: now(),
    updated_at: now(),
  });
  if (error) return fail(500, "server_error");
  return ok({ redirectUrl, orderId });
}

async function midtransNotification(ctx) {
  const { body, supabase } = ctx;
  const serverKey = ctx.env("MIDTRANS_SERVER_KEY");
  const orderId = text(body.order_id, 80);
  const statusCode = text(body.status_code, 10);
  const grossAmount = text(body.gross_amount, 30);
  const signature = text(body.signature_key, 200);
  if (!serverKey || !orderId || !signature) return fail(400, "invalid_input");
  const expected = await sha512Hex(`${orderId}${statusCode}${grossAmount}${serverKey}`);
  if (expected !== signature) return fail(403, "invalid_signature");

  const transaction = text(body.transaction_status, 30);
  const fraud = text(body.fraud_status, 30);
  let status = "pending";
  if (transaction === "capture") status = fraud === "accept" ? "settled" : "challenge";
  else if (transaction === "settlement") status = "settled";
  else if (["deny", "cancel", "expire", "failure"].includes(transaction)) status = "failed";
  else if (transaction === "refund" || transaction === "partial_refund") status = "refunded";
  else if (transaction === "pending") status = "pending";

  if (orderId.startsWith("PJC-")) {
    const { data: donation } = await supabase
      .from("campaign_donations")
      .select("id,status,campaign_id,amount")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!donation) return fail(404, "not_found");
    await supabase.from("campaign_donations").update({ status }).eq("id", donation.id);
    if (status === "settled" && donation.status !== "settled") {
      await supabase
        .from("campaigns")
        .update({
          collected_amount: supabase.rpc ? undefined : undefined,
          donor_count: supabase.rpc ? undefined : undefined,
        })
        .eq("id", donation.campaign_id);
      const { data: camp } = await supabase.from("campaigns").select("collected_amount,donor_count,profile_id").eq("id", donation.campaign_id).maybeSingle();
      if (camp) {
        const newCollected = (camp.collected_amount ?? 0) + donation.amount;
        const newDonorCount = (camp.donor_count ?? 0) + 1;
        await supabase
          .from("campaigns")
          .update({ collected_amount: newCollected, donor_count: newDonorCount })
          .eq("id", donation.campaign_id);
        const { data: prof } = await supabase.from("profiles").select("account_id").eq("id", camp.profile_id).maybeSingle();
        if (prof) {
          await notify(supabase, prof.account_id, "donation", null, `Donasi kampanye Rp${donation.amount.toLocaleString("id-ID")} diterima`, null);
          await awardKpi(supabase, prof.account_id, "campaign_donate", donation.id);
          await awardBadge(supabase, prof.account_id, "donor_kampanye");
        }
      }
    }
  } else if (orderId.startsWith("PJT-")) {
    const { data: ticket } = await supabase
      .from("event_tickets")
      .select("id,event_id,account_id,status")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!ticket) return fail(404, "not_found");
    await supabase.from("event_tickets").update({ payment_status: status, status: status === "settled" ? "valid" : status === "failed" ? "cancelled" : ticket.status }).eq("id", ticket.id);
    if (status === "settled" && ticket.status !== "settled") {
      const { data: event } = await supabase.from("events").select("title").eq("id", ticket.event_id).maybeSingle();
      if (event && ticket.account_id) {
        await notify(supabase, ticket.account_id, "ticket", null, `Tiket ${event.title} telah dikonfirmasi`, null);
      }
    }
  } else if (orderId.startsWith("PJS-")) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id,account_id,status,tier")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!sub) return fail(404, "not_found");
    if (status === "settled" && sub.status === "pending") {
      const startedAt = now();
      const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      await supabase
        .from("subscriptions")
        .update({ status: "active", started_at: startedAt, expires_at: expiresAt })
        .eq("id", sub.id);
      await notify(supabase, sub.account_id, "subscription", null, `Langganan ${sub.tier} aktif selama 30 hari`, null);
    } else if (status === "failed") {
      await supabase.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
    }
  } else {
    const { data: donation } = await supabase
      .from("donations")
      .select("id,status,profile_id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!donation) return fail(404, "not_found");
    await supabase.from("donations").update({ status, updated_at: now() }).eq("id", donation.id);
    if (status === "settled" && donation.status !== "settled") {
      const { data: prof } = await supabase
        .from("profiles")
        .select("account_id,nickname")
        .eq("id", donation.profile_id)
        .maybeSingle();
      if (prof) {
        await notify(supabase, prof.account_id, "donation", null, `Donasi Rp${Number(grossAmount).toLocaleString("id-ID")} diterima`, null);
        await awardKpi(supabase, prof.account_id, "donation", donation.id);
        await awardBadge(supabase, prof.account_id, "donor_dana");
      }
    }
  }
  return ok({ updated: true });
}

async function sha512Hex(value) {
  const digest = await crypto.subtle.digest("SHA-512", enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const donationPublic = (row) => ({
  id: row.id,
  profileId: row.profile_id,
  orderId: row.order_id,
  grossAmount: row.gross_amount,
  supporterName: row.supporter_name,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function donationsMine(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profile = await ownProfile(ctx.supabase, auth.account.id);
  if (!profile) return ok({ items: [] });
  const { data } = await ctx.supabase
    .from("donations")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return ok({ items: (data ?? []).map(donationPublic) });
}

async function donationsList(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("donations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return ok({ items: (data ?? []).map(donationPublic) });
}

// ---------- events ----------

const eventPublic = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  audience: row.audience,
  location: row.location,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  capacity: row.capacity,
  fundingTarget: row.funding_target,
  ticketPrice: row.ticket_price ?? null,
  groupId: row.group_id ?? null,
  status: row.status,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

async function visibleEvents(supabase, account) {
  const rank = ROLE_RANK[account?.role] ?? 0;
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("starts_at", { ascending: true })
    .limit(100);
  const rows = data ?? [];
  if (rank >= 6) return rows;
  let invitedIds = new Set();
  if (account) {
    const { data: invites } = await supabase
      .from("event_invites")
      .select("event_id")
      .eq("account_id", account.id);
    invitedIds = new Set((invites ?? []).map((i) => i.event_id));
  }
  return rows.filter((row) => {
    if (row.audience === "umum") return true;
    if (row.created_by === account?.id) return true;
    if (rank >= 2 && row.audience === "anggota") return true;
    if (invitedIds.has(row.id)) return true;
    return false;
  });
}

async function eventsList(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const rows = await visibleEvents(ctx.supabase, account);
  const ids = rows.map((r) => r.id);
  const myRsvps = new Map();
  const inviteSet = new Set();
  const counts = new Map();
  const committeeSet = new Set();
  if (account && ids.length) {
    const { data: rsvps } = await ctx.supabase
      .from("event_rsvps")
      .select("event_id,account_id,status")
      .in("event_id", ids);
    for (const r of rsvps ?? []) {
      counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + (r.status === "going" ? 1 : 0));
      if (r.account_id === account.id) myRsvps.set(r.event_id, r.status);
    }
    const { data: invites } = await ctx.supabase
      .from("event_invites")
      .select("event_id")
      .in("event_id", ids)
      .eq("account_id", account.id);
    for (const i of invites ?? []) inviteSet.add(i.event_id);
    const { data: committees } = await ctx.supabase
      .from("event_committees")
      .select("event_id")
      .in("event_id", ids)
      .eq("account_id", account.id);
    for (const c of committees ?? []) committeeSet.add(c.event_id);
  }
  const creators = await namesFor(ctx.supabase, rows.map((r) => r.created_by));
  return ok({
    items: rows.map((row) => ({
      ...eventPublic(row),
      goingCount: counts.get(row.id) ?? 0,
      myRsvp: myRsvps.get(row.id) ?? null,
      invited: inviteSet.has(row.id),
      isCommittee: committeeSet.has(row.id),
      creatorName: creators.get(row.created_by)?.nickname ?? creators.get(row.created_by)?.displayName ?? null,
    })),
  });
}

async function eventsGet(ctx) {
  const { body, supabase } = ctx;
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const id = text(body.id, 60);
  const { data: row } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!row) return fail(404, "not_found");
  const rank = ROLE_RANK[account?.role] ?? 0;
  let allowed = row.status === "published" && (row.audience === "umum" || rank >= 2 || row.created_by === account?.id || rank >= 6);
  if (row.audience === "undangan" && rank < 6 && row.created_by !== account?.id) {
    const { data: invite } = await supabase
      .from("event_invites")
      .select("id")
      .eq("event_id", id)
      .eq("account_id", account?.id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    allowed = allowed && Boolean(invite);
  }
  if (!allowed) return fail(404, "not_found");

  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("account_id,status")
    .eq("event_id", id);
  const going = (rsvps ?? []).filter((r) => r.status === "going");
  const names = await namesFor(supabase, going.map((r) => r.account_id));
  const { data: invites } = await supabase
    .from("event_invites")
    .select("account_id")
    .eq("event_id", id);
  const inviteNames = await namesFor(supabase, (invites ?? []).map((i) => i.account_id));
  const creator = (await namesFor(supabase, [row.created_by])).get(row.created_by);
  const { data: committees } = await supabase
    .from("event_committees")
    .select("*")
    .eq("event_id", id);
  const committeeNames = await namesFor(supabase, (committees ?? []).map((c) => c.account_id));
  const isCreator = row.created_by === account?.id;
  const isCommittee = (committees ?? []).some((c) => c.account_id === account?.id);
  let myTicket = null;
  if (account) {
    const { data: ticket } = await supabase
      .from("event_tickets")
      .select("*")
      .eq("event_id", id)
      .eq("account_id", account.id)
      .maybeSingle();
    if (ticket) {
      myTicket = {
        id: ticket.id,
        code: ticket.code,
        ticketType: ticket.ticket_type,
        price: ticket.price,
        paymentStatus: ticket.payment_status,
        status: ticket.status,
      };
    }
  }
  const { data: attendance } = await supabase
    .from("event_attendance")
    .select("id")
    .eq("event_id", id);
  return ok({
    event: {
      ...eventPublic(row),
      goingCount: going.length,
      myRsvp: (rsvps ?? []).find((r) => r.account_id === account?.id)?.status ?? null,
      attendees: going.map((r) => names.get(r.account_id)?.displayName ?? names.get(r.account_id)?.nickname ?? "Anggota").slice(0, 50),
      invited: (invites ?? []).map((i) => inviteNames.get(i.account_id)?.displayName ?? inviteNames.get(i.account_id)?.nickname ?? "Anggota").slice(0, 50),
      creatorName: creator?.nickname ?? creator?.displayName ?? null,
      committees: (committees ?? []).map((c) => ({
        id: c.id,
        accountId: c.account_id,
        accountName: committeeNames.get(c.account_id)?.displayName ?? committeeNames.get(c.account_id)?.nickname ?? "Panitia",
        accountPhoto: committeeNames.get(c.account_id)?.photoData ?? null,
        role: c.role,
      })),
      isCreator,
      isCommittee,
      myTicket,
      attendanceCount: (attendance ?? []).length,
    },
  });
}

async function eventsCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { body } = ctx;
  const title = text(body.title, 140);
  const audience = AUDIENCES.includes(body.audience) ? body.audience : null;
  const startsAt = text(body.startsAt, 40);
  if (title.length < 3 || !audience || !startsAt || Number.isNaN(Date.parse(startsAt))) {
    return fail(400, "invalid_input");
  }
  if (audience === "undangan" && auth.rank < 4) return fail(403, "forbidden");
  const ticketPrice = body.ticketPrice !== undefined && body.ticketPrice !== null && body.ticketPrice !== ""
    ? intOrNull(body.ticketPrice, 0, 1000000000)
    : null;
  const groupId = text(body.groupId, 60) || null;
  if (groupId) {
    const { data: group } = await ctx.supabase.from("groups").select("id").eq("id", groupId).maybeSingle();
    if (!group) return fail(404, "not_found");
  }
  const row = {
    id: crypto.randomUUID(),
    title,
    description: textOrNull(body.description, 1500),
    audience,
    location: textOrNull(body.location, 160),
    starts_at: new Date(startsAt).toISOString(),
    ends_at: body.endsAt && !Number.isNaN(Date.parse(body.endsAt)) ? new Date(body.endsAt).toISOString() : null,
    capacity: intOrNull(body.capacity, 1, 100000),
    funding_target: intOrNull(body.fundingTarget, 0, 1000000000000),
    ticket_price: ticketPrice,
    group_id: groupId,
    status: "published",
    created_by: auth.account.id,
    created_at: now(),
  };
  const { error } = await ctx.supabase.from("events").insert(row);
  if (error) return fail(500, "server_error");
  await awardKpi(ctx.supabase, auth.account.id, "event_create", row.id);
  return ok({ event: eventPublic(row) });
}

async function eventsCancel(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const { data: row } = await ctx.supabase.from("events").select("id,created_by,status").eq("id", id).maybeSingle();
  if (!row) return fail(404, "not_found");
  if (row.created_by !== auth.account.id && auth.rank < 6) return fail(403, "forbidden");
  await ctx.supabase.from("events").update({ status: "cancelled" }).eq("id", id);
  return ok({ cancelled: true });
}

async function eventsRsvp(ctx) {
  const auth = await actor(ctx, 1);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const going = ctx.body.going !== false;
  const { data: row } = await ctx.supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.status !== "published") return fail(404, "not_found");
  if (row.ticket_price && row.ticket_price > 0) return fail(400, "event_is_paid");
  if (row.audience === "anggota" && auth.rank < 2) return fail(403, "members_only");
  if (row.audience === "undangan" && auth.rank < 6 && row.created_by !== auth.account.id) {
    const { data: invite } = await ctx.supabase
      .from("event_invites")
      .select("id")
      .eq("event_id", id)
      .eq("account_id", auth.account.id)
      .maybeSingle();
    if (!invite) return fail(403, "invitation_only");
  }
  const existingId = await isEnrolled(ctx.supabase, "event_rsvps", "event_id", id, auth.account.id);
  if (going) {
    if (row.capacity) {
      const { data: current } = await ctx.supabase
        .from("event_rsvps")
        .select("account_id")
        .eq("event_id", id)
        .eq("status", "going");
      if ((current ?? []).length >= row.capacity && !existingId) return fail(409, "event_full");
    }
    if (existingId) await ctx.supabase.from("event_rsvps").update({ status: "going" }).eq("id", existingId);
    else {
      const { error } = await ctx.supabase.from("event_rsvps").insert({
        id: crypto.randomUUID(),
        event_id: id,
        account_id: auth.account.id,
        status: "going",
        created_at: now(),
      });
      if (error) return fail(500, "server_error");
      const ticketCode = `PJ:${id.slice(0, 8)}:${auth.account.id.slice(0, 8)}-${b64url(crypto.getRandomValues(new Uint8Array(3)))}`;
      await ctx.supabase.from("event_tickets").insert({
        id: crypto.randomUUID(),
        event_id: id,
        account_id: auth.account.id,
        code: ticketCode,
        ticket_type: "free",
        price: 0,
        order_id: null,
        payment_status: null,
        status: "valid",
        created_at: now(),
      });
    }
  } else if (existingId) {
    await ctx.supabase.from("event_rsvps").delete().eq("id", existingId);
    await ctx.supabase.from("event_tickets").delete().eq("event_id", id).eq("account_id", auth.account.id).eq("ticket_type", "free");
  }
  return ok({ going });
}

async function eventsInvite(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const mail = email(ctx.body.email);
  if (!id || !mail) return fail(400, "invalid_input");
  const { data: row } = await ctx.supabase.from("events").select("id,created_by,audience").eq("id", id).maybeSingle();
  if (!row) return fail(404, "not_found");
  if (row.created_by !== auth.account.id && auth.rank < 4) return fail(403, "forbidden");
  const { data: account } = await ctx.supabase
    .from("accounts")
    .select("id,role,status")
    .eq("email", mail)
    .maybeSingle();
  if (!account || account.status !== "active") return fail(404, "account_not_found");
  if ((ROLE_RANK[account.role] ?? 0) < 2) return fail(400, "invite_members_only");
  const existing = await isEnrolled(ctx.supabase, "event_invites", "event_id", id, account.id);
  if (!existing) {
    const { error } = await ctx.supabase.from("event_invites").insert({
      id: crypto.randomUUID(),
      event_id: id,
      account_id: account.id,
      created_at: now(),
    });
    if (error) return fail(500, "server_error");
  }
  return ok({ invited: true });
}

async function eventCommitteeAdd(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const eventId = text(ctx.body.eventId, 60);
  let accountId = text(ctx.body.accountId, 60);
  const email = text(ctx.body.email, 120);
  const role = text(ctx.body.role, 40) || "panitia";
  if (!eventId || (!accountId && !email)) return fail(400, "invalid_input");
  if (!accountId && email) {
    const { data: account } = await ctx.supabase.from("accounts").select("id").eq("email", email.toLowerCase()).maybeSingle();
    if (!account) return fail(404, "account_not_found");
    accountId = account.id;
  }
  const { data: event } = await ctx.supabase.from("events").select("id,created_by,group_id").eq("id", eventId).maybeSingle();
  if (!event) return fail(404, "not_found");
  if (event.created_by !== auth.account.id && auth.rank < 6) return fail(403, "forbidden");
  if (event.group_id) {
    const { data: member } = await ctx.supabase
      .from("group_members")
      .select("id")
      .eq("group_id", event.group_id)
      .eq("account_id", accountId)
      .maybeSingle();
    if (!member && accountId !== auth.account.id) return fail(403, "not_group_member");
  }
  const existing = await isEnrolled(ctx.supabase, "event_committees", "event_id", eventId, accountId);
  if (existing) return fail(409, "already_committee");
  const { error } = await ctx.supabase.from("event_committees").insert({
    id: crypto.randomUUID(),
    event_id: eventId,
    account_id: accountId,
    role,
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  await awardKpi(ctx.supabase, accountId, "event_committee", eventId);
  return ok({ added: true });
}

async function eventCommitteeList(ctx) {
  const auth = await actor(ctx, 1);
  if (auth.error) return auth.error;
  const eventId = text(ctx.body.eventId, 60);
  if (!eventId) return fail(400, "invalid_input");
  const { data: rows } = await ctx.supabase
    .from("event_committees")
    .select("*")
    .eq("event_id", eventId);
  const names = await namesFor(ctx.supabase, (rows ?? []).map((r) => r.account_id));
  return ok({
    items: (rows ?? []).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      accountId: r.account_id,
      accountName: names.get(r.account_id)?.displayName ?? names.get(r.account_id)?.nickname ?? "Anggota",
      accountPhoto: names.get(r.account_id)?.photoData ?? null,
      role: r.role,
      createdAt: r.created_at,
    })),
  });
}

async function eventCommitteeRemove(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const eventId = text(ctx.body.eventId, 60);
  const accountId = text(ctx.body.accountId, 60);
  if (!eventId || !accountId) return fail(400, "invalid_input");
  const { data: event } = await ctx.supabase.from("events").select("id,created_by").eq("id", eventId).maybeSingle();
  if (!event) return fail(404, "not_found");
  if (event.created_by !== auth.account.id && auth.rank < 6) return fail(403, "forbidden");
  await ctx.supabase.from("event_committees").delete().eq("event_id", eventId).eq("account_id", accountId);
  return ok({ removed: true });
}

async function eventTicketsList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const eventId = text(ctx.body.eventId, 60);
  if (!eventId) return fail(400, "invalid_input");
  const { data: event } = await ctx.supabase.from("events").select("id,created_by").eq("id", eventId).maybeSingle();
  if (!event) return fail(404, "not_found");
  const isCreator = event.created_by === auth.account.id;
  const isCommittee = await isEnrolled(ctx.supabase, "event_committees", "event_id", eventId, auth.account.id);
  if (!isCreator && !isCommittee && auth.rank < 6) return fail(403, "forbidden");
  const { data: rows } = await ctx.supabase
    .from("event_tickets")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  const names = await namesFor(ctx.supabase, (rows ?? []).map((r) => r.account_id));
  return ok({
    items: (rows ?? []).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      accountId: r.account_id,
      attendeeName: names.get(r.account_id)?.displayName ?? names.get(r.account_id)?.nickname ?? "Tamu",
      attendeePhoto: names.get(r.account_id)?.photoData ?? null,
      code: r.code,
      ticketType: r.ticket_type,
      price: r.price,
      paymentStatus: r.payment_status,
      status: r.status,
      createdAt: r.created_at,
    })),
  });
}

async function eventTicketsBuy(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const serverKey = ctx.env("MIDTRANS_SERVER_KEY");
  if (!serverKey) return fail(503, "service_not_configured");
  const eventId = text(ctx.body.eventId, 60);
  if (!eventId) return fail(400, "invalid_input");
  const { data: event } = await ctx.supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.status !== "published") return fail(404, "not_found");
  if (!event.ticket_price || event.ticket_price <= 0) return fail(400, "event_is_free");
  const existing = await isEnrolled(ctx.supabase, "event_tickets", "event_id", eventId, account?.id ?? "00000000-0000-0000-0000-000000000000");
  if (existing) return fail(409, "already_purchased");
  if (event.capacity) {
    const { data: current } = await ctx.supabase
      .from("event_tickets")
      .select("id")
      .eq("event_id", eventId)
      .eq("status", "valid");
    if ((current ?? []).length >= event.capacity) return fail(409, "event_full");
  }
  const orderId = `PJT-${Date.now()}-${b64url(crypto.getRandomValues(new Uint8Array(4)))}`;
  const base = ctx.env("MIDTRANS_ENV") === "production"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
  const buyerName = account?.display_name ?? "Tamu";
  const buyerEmail = account?.email ?? null;
  let redirectUrl = null;
  let gatewayError = false;
  try {
    const response = await safeFetch(`${base}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Basic ${b64(enc.encode(`${serverKey}:`))}`,
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: event.ticket_price },
        item_details: [{ id: eventId, price: event.ticket_price, quantity: 1, name: event.title.slice(0, 50) }],
        customer_details: { first_name: buyerName.slice(0, 50), email: buyerEmail ?? undefined },
      }),
    });
    const payload = await response.json().catch(() => null);
    redirectUrl = typeof payload?.redirect_url === "string" ? payload.redirect_url : null;
    if (!response.ok || !redirectUrl) gatewayError = true;
  } catch {
    gatewayError = true;
  }
  if (gatewayError) return fail(502, "gateway_error");
  const ticketCode = `PJ:${eventId.slice(0, 8)}:${account?.id?.slice(0, 8) ?? "guest"}-${b64url(crypto.getRandomValues(new Uint8Array(3)))}`;
  const { error } = await ctx.supabase.from("event_tickets").insert({
    id: crypto.randomUUID(),
    event_id: eventId,
    account_id: account?.id ?? null,
    code: ticketCode,
    ticket_type: "paid",
    price: event.ticket_price,
    order_id: orderId,
    payment_status: "pending",
    status: "pending",
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  return ok({ redirectUrl, orderId });
}

async function eventCheckin(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const code = text(ctx.body.code, 100);
  if (!code) return fail(400, "invalid_input");
  const { data: ticket } = await ctx.supabase
    .from("event_tickets")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (!ticket) return fail(404, "ticket_not_found");
  if (ticket.status === "used") return fail(409, "ticket_already_used");
  if (ticket.status !== "valid") return fail(400, "ticket_not_valid");
  const { data: event } = await ctx.supabase.from("events").select("id,created_by").eq("id", ticket.event_id).maybeSingle();
  if (!event) return fail(404, "not_found");
  const isCreator = event.created_by === auth.account.id;
  const isCommittee = await isEnrolled(ctx.supabase, "event_committees", "event_id", event.id, auth.account.id);
  if (!isCreator && !isCommittee && auth.rank < 6) return fail(403, "not_committee");
  await ctx.supabase.from("event_attendance").insert({
    id: crypto.randomUUID(),
    ticket_id: ticket.id,
    event_id: ticket.event_id,
    account_id: ticket.account_id,
    scanned_by: auth.account.id,
    checked_at: now(),
  });
  await ctx.supabase.from("event_tickets").update({ status: "used" }).eq("id", ticket.id);
  await awardKpi(ctx.supabase, ticket.account_id, "event_attend", ticket.event_id);
  return ok({ checkedIn: true, attendeeName: ticket.account_id });
}

async function kpiMine(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: summary } = await ctx.supabase
    .from("kpi_summary")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  const { data: logs } = await ctx.supabase
    .from("kpi_logs")
    .select("*")
    .eq("account_id", auth.account.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("id")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  const isJanda = Boolean(profile);
  const totalPoints = summary?.total_points ?? 0;
  const level = summary?.level ?? 1;
  const currentLevelXp = totalXpForLevel(level);
  const nextLevelXp = level < MAX_LEVEL ? totalXpForLevel(level + 1) : null;
  return ok({
    totalPoints,
    level,
    levelTitle: levelTitle(level, isJanda),
    nextLevelPoints: nextLevelXp,
    nextLevelTitle: level < MAX_LEVEL ? levelTitle(level + 1, isJanda) : null,
    xpToNextLevel: nextLevelXp !== null ? nextLevelXp - totalPoints : null,
    currentLevelXp: totalPoints - currentLevelXp,
    recentLogs: (logs ?? []).map((l) => ({
      id: l.id,
      sourceType: l.source_type,
      sourceId: l.source_id,
      points: l.points,
      createdAt: l.created_at,
    })),
  });
}

async function kpiBadges(ctx) {
  const auth = await actor(ctx, 0);
  const accountId = text(ctx.body.accountId, 60);
  const targetId = accountId || (auth.error ? null : auth.account?.id);
  if (!targetId) return fail(400, "invalid_input");
  const { data: rows } = await ctx.supabase
    .from("badges")
    .select("*")
    .eq("account_id", targetId)
    .order("awarded_at", { ascending: false });
  return ok({
    items: (rows ?? []).map((r) => ({
      id: r.id,
      badgeType: r.badge_type,
      label: r.label,
      tier: r.tier,
      awardedAt: r.awarded_at,
    })),
  });
}

async function levelInfo(ctx) {
  const auth = await actor(ctx, 0);
  const levels = [];
  for (let i = 1; i <= MAX_LEVEL; i++) {
    levels.push({
      level: i,
      xpRequired: totalXpForLevel(i),
      jandaTitle: levelTitle(i, true),
      nonJandaTitle: levelTitle(i, false),
      jandaRole: roleFromLevel(i, true),
      nonJandaRole: roleFromLevel(i, false),
    });
  }
  return ok({
    maxLevel: MAX_LEVEL,
    levels,
    jandaTiers: [
      { role: "wonder_woman", label: "Wonder Woman", minLevel: 1, maxLevel: 20 },
      { role: "sosialita", label: "Sosialita", minLevel: 21, maxLevel: 35 },
      { role: "high_society", label: "High Society", minLevel: 36, maxLevel: 45 },
      { role: "the_ceo", label: "The CEO", minLevel: 46, maxLevel: 50 },
    ],
    nonJandaTiers: [
      { role: "kades", label: "Kades", minLevel: 1, maxLevel: 20 },
      { role: "gubernur", label: "Gubernur", minLevel: 21, maxLevel: 35 },
      { role: "panglima", label: "Panglima", minLevel: 36, maxLevel: 45 },
      { role: "presiden", label: "Presiden", minLevel: 46, maxLevel: 50 },
    ],
  });
}

// ---------- coins ----------

const COIN_PACKAGES = [
  { id: "coins_100", name: "100 Koin", coinAmount: 100, price: 10000, bonusCoins: 0, popular: false },
  { id: "coins_500", name: "500 Koin", coinAmount: 500, price: 45000, bonusCoins: 0, popular: true },
  { id: "coins_1000", name: "1.000 Koin", coinAmount: 1000, price: 85000, bonusCoins: 50, popular: false },
  { id: "coins_2500", name: "2.500 Koin", coinAmount: 2500, price: 200000, bonusCoins: 200, popular: false },
  { id: "coins_5000", name: "5.000 Koin", coinAmount: 5000, price: 380000, bonusCoins: 500, popular: false },
];

async function createSnapTransaction(orderId, amount, account, itemDetails, serverKey, env) {
  const base = env("MIDTRANS_ENV") === "production"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
  const supporterName = account?.display_name || account?.email || "User";
  const supporterEmail = account?.email ?? undefined;

  try {
    const response = await safeFetch(`${base}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Basic ${b64(enc.encode(`${serverKey}:`))}`,
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: itemDetails,
        customer_details: { first_name: supporterName.slice(0, 50), email: supporterEmail },
      }),
    });
    const payload = await response.json().catch(() => null);
    const redirectUrl = typeof payload?.redirect_url === "string" ? payload.redirect_url : null;
    const token = typeof payload?.token === "string" ? payload.token : null;
    if (!response.ok || !redirectUrl) return { error: fail(502, "gateway_error") };
    return { value: { redirect_url: redirectUrl, token } };
  } catch {
    return { error: fail(502, "gateway_error") };
  }
}

async function coinsBalance(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("coin_balances")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  return ok({
    balance: data?.balance ?? 0,
    lifetimePurchased: data?.lifetime_purchased ?? 0,
    lifetimeSpent: data?.lifetime_spent ?? 0,
  });
}

async function coinsPackages(ctx) {
  const auth = await actor(ctx, 0);
  return ok({ items: COIN_PACKAGES });
}

async function coinsTransactions(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("coin_transactions")
    .select("*")
    .eq("account_id", auth.account.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return ok({
    items: (data ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balance_after,
      description: t.description,
      referenceId: t.reference_id,
      createdAt: t.created_at,
    })),
  });
}

async function coinsPurchase(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const packageId = text(ctx.body.packageId, 60);
  const pkg = COIN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return fail(400, "invalid_package");

  const serverKey = ctx.env("MIDTRANS_SERVER_KEY");
  if (!serverKey) return fail(503, "service_not_configured");

  const orderId = `coin-${auth.account.id}-${Date.now()}`;
  const totalCoins = pkg.coinAmount + pkg.bonusCoins;

  const { data: balance } = await ctx.supabase
    .from("coin_balances")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();

  const currentBalance = balance?.balance ?? 0;
  const currentPurchased = balance?.lifetime_purchased ?? 0;

  if (!balance) {
    await ctx.supabase.from("coin_balances").insert({
      account_id: auth.account.id,
      balance: 0,
      lifetime_purchased: 0,
      lifetime_spent: 0,
      updated_at: new Date().toISOString(),
    });
  }

  const transactionId = crypto.randomUUID();
  await ctx.supabase.from("coin_transactions").insert({
    id: transactionId,
    account_id: auth.account.id,
    type: "purchase",
    amount: totalCoins,
    balance_after: currentBalance + totalCoins,
    description: `Pembelian ${pkg.name}${pkg.bonusCoins > 0 ? ` + ${pkg.bonusCoins} bonus` : ""}`,
    reference_id: orderId,
    created_at: new Date().toISOString(),
  });

  await ctx.supabase
    .from("coin_balances")
    .update({
      balance: currentBalance + totalCoins,
      lifetime_purchased: currentPurchased + totalCoins,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", auth.account.id);

  const itemDetails = [
    { id: pkg.id, price: pkg.price, quantity: 1, name: pkg.name },
  ];
  if (pkg.bonusCoins > 0) {
    itemDetails.push({ id: `${pkg.id}_bonus`, price: 0, quantity: 1, name: `Bonus ${pkg.bonusCoins} koin` });
  }

  const snap = await createSnapTransaction(orderId, pkg.price, auth.account, itemDetails, serverKey, ctx.env);
  if (snap.error) return snap.error;

  return ok({
    orderId,
    token: snap.value.token,
    redirectUrl: snap.value.redirect_url,
    package: { ...pkg, totalCoins },
  });
}

const COIN_FEATURES = [
  { id: "featured_profile", name: "Profil Unggulan", description: "Tampil di posisi atas halaman Jelajah selama 7 hari", cost: 500, duration: "7 hari" },
  { id: "premium_badge", name: "Badge Premium", description: "Badge khusus di profil Anda", cost: 200, duration: "Permanen" },
  { id: "ai_mentor_10", name: "10 Kredit AI Mentor", description: "Gunakan AI Mentor untuk 10 sesi konsultasi", cost: 300, duration: "10 sesi" },
  { id: "event_priority", name: "Prioritas Event", description: "Registrasi lebih awal untuk event eksklusif", cost: 150, duration: "1 event" },
];

async function coinsFeatures(ctx) {
  const auth = await actor(ctx, 0);
  return ok({ items: COIN_FEATURES });
}

async function coinsSpend(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;

  const featureId = text(ctx.body.featureId, 60);
  const feature = COIN_FEATURES.find((f) => f.id === featureId);
  if (!feature) return fail(400, "invalid_feature");

  const { data: balance } = await ctx.supabase
    .from("coin_balances")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();

  const currentBalance = balance?.balance ?? 0;
  if (currentBalance < feature.cost) {
    return fail(400, "insufficient_balance");
  }

  const currentSpent = balance?.lifetime_spent ?? 0;
  const newBalance = currentBalance - feature.cost;

  const transactionId = crypto.randomUUID();
  await ctx.supabase.from("coin_transactions").insert({
    id: transactionId,
    account_id: auth.account.id,
    type: "spend",
    amount: -feature.cost,
    balance_after: newBalance,
    description: `Pembelian ${feature.name}`,
    reference_id: featureId,
    created_at: new Date().toISOString(),
  });

  if (!balance) {
    await ctx.supabase.from("coin_balances").insert({
      account_id: auth.account.id,
      balance: newBalance,
      lifetime_purchased: 0,
      lifetime_spent: feature.cost,
      updated_at: new Date().toISOString(),
    });
  } else {
    await ctx.supabase
      .from("coin_balances")
      .update({
        balance: newBalance,
        lifetime_spent: currentSpent + feature.cost,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", auth.account.id);
  }

  return ok({
    success: true,
    feature: feature.name,
    newBalance,
    message: `Berhasil membeli ${feature.name}`,
  });
}

async function coinsWithdraw(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;

  const method = text(ctx.body.method, 50);
  const coinAmount = Number(ctx.body.coinAmount) || 0;
  const accountNumber = text(ctx.body.accountNumber, 100);
  const holderName = text(ctx.body.holderName, 200);

  const validMethods = APP_SETTINGS.coinSettings.withdrawMethods.filter((m) => m.enabled).map((m) => m.id);
  if (!validMethods.includes(method)) return fail(400, "invalid_withdraw_method");

  const { fees, conversionRate } = APP_SETTINGS.coinSettings;
  if (coinAmount < fees.minWithdrawCoins) {
    return fail(400, `Minimum penarikan ${fees.minWithdrawCoins} koin`);
  }

  const { data: balance } = await ctx.supabase
    .from("coin_balances")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();

  const currentBalance = balance?.balance ?? 0;
  if (currentBalance < coinAmount) {
    return fail(400, "insufficient_balance");
  }

  const grossRupiah = (coinAmount / conversionRate) * 1000;
  const adminFee = grossRupiah * (fees.adminFeePercent / 100);
  const withdrawFee = grossRupiah * (fees.withdrawFeePercent / 100);
  const netRupiah = Math.floor(grossRupiah - adminFee - withdrawFee);

  const newBalance = currentBalance - coinAmount;
  const currentSpent = balance?.lifetime_spent ?? 0;

  await ctx.supabase.from("coin_transactions").insert({
    id: crypto.randomUUID(),
    account_id: auth.account.id,
    type: "withdraw",
    amount: -coinAmount,
    balance_after: newBalance,
    description: `Penarikan ${coinAmount} koin via ${method}`,
    reference_id: `wd-${Date.now()}`,
    created_at: new Date().toISOString(),
  });

  if (!balance) {
    await ctx.supabase.from("coin_balances").insert({
      account_id: auth.account.id,
      balance: newBalance,
      lifetime_purchased: 0,
      lifetime_spent: currentSpent + coinAmount,
      updated_at: new Date().toISOString(),
    });
  } else {
    await ctx.supabase
      .from("coin_balances")
      .update({
        balance: newBalance,
        lifetime_spent: currentSpent + coinAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", auth.account.id);
  }

  return ok({
    success: true,
    method,
    coinAmount,
    grossRupiah: Math.floor(grossRupiah),
    adminFee: Math.floor(adminFee),
    withdrawFee: Math.floor(withdrawFee),
    netRupiah,
    newBalance,
    message: `Penarikan ${coinAmount} koin berhasil. Dana akan dikirim via ${method}.`,
  });
}

// ---------- groups ----------

const groupPublic = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  audienceMinRole: row.audience_min_role,
  capacity: row.capacity,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

async function groupsList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);
  const rows = (data ?? []).filter(
    (row) => (ROLE_RANK[row.audience_min_role] ?? 2) <= auth.rank,
  );
  const ids = rows.map((r) => r.id);
  const memberCounts = new Map();
  const myMemberships = new Set();
  if (ids.length) {
    const { data: members } = await ctx.supabase
      .from("group_members")
      .select("group_id,account_id")
      .in("group_id", ids);
    for (const m of members ?? []) {
      memberCounts.set(m.group_id, (memberCounts.get(m.group_id) ?? 0) + 1);
      if (m.account_id === auth.account.id) myMemberships.add(m.group_id);
    }
  }
  return ok({
    items: rows.map((row) => ({
      ...groupPublic(row),
      memberCount: memberCounts.get(row.id) ?? 0,
      joined: myMemberships.has(row.id),
    })),
  });
}

async function groupsGet(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const { data: row } = await ctx.supabase.from("groups").select("*").eq("id", id).maybeSingle();
  if (!row) return fail(404, "not_found");
  if ((ROLE_RANK[row.audience_min_role] ?? 2) > auth.rank) return fail(403, "forbidden");
  const { data: members } = await ctx.supabase
    .from("group_members")
    .select("account_id")
    .eq("group_id", id);
  const names = await namesFor(ctx.supabase, (members ?? []).map((m) => m.account_id));
  return ok({
    group: {
      ...groupPublic(row),
      joined: (members ?? []).some((m) => m.account_id === auth.account.id),
      members: (members ?? [])
        .map((m) => names.get(m.account_id)?.displayName ?? names.get(m.account_id)?.nickname ?? "Anggota")
        .slice(0, 100),
    },
  });
}

async function groupsCreate(ctx) {
  const auth = await actor(ctx, 3);
  if (auth.error) return auth.error;
  const name = text(ctx.body.name, 100);
  if (name.length < 3) return fail(400, "invalid_input");
  const audienceMinRole = WIDOW_ROLES.includes(ctx.body.audienceMinRole)
    ? ctx.body.audienceMinRole
    : "wonder_woman";
  const row = {
    id: crypto.randomUUID(),
    name,
    description: textOrNull(ctx.body.description, 1000),
    audience_min_role: audienceMinRole,
    capacity: intOrNull(ctx.body.capacity, 1, 10000),
    created_by: auth.account.id,
    created_at: now(),
  };
  const { error } = await ctx.supabase.from("groups").insert(row);
  if (error) return fail(500, "server_error");
  return ok({ group: groupPublic(row) });
}

async function groupsJoin(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const { data: row } = await ctx.supabase.from("groups").select("*").eq("id", id).maybeSingle();
  if (!row) return fail(404, "not_found");
  if ((ROLE_RANK[row.audience_min_role] ?? 2) > auth.rank) return fail(403, "forbidden");
  const existing = await isEnrolled(ctx.supabase, "group_members", "group_id", id, auth.account.id);
  if (existing) return ok({ joined: true });
  if (row.capacity) {
    const { data: members } = await ctx.supabase.from("group_members").select("id").eq("group_id", id);
    if ((members ?? []).length >= row.capacity) return fail(409, "group_full");
  }
  const { error } = await ctx.supabase.from("group_members").insert({
    id: crypto.randomUUID(),
    group_id: id,
    account_id: auth.account.id,
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  return ok({ joined: true });
}

async function groupsLeave(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const existing = await isEnrolled(ctx.supabase, "group_members", "group_id", id, auth.account.id);
  if (existing) await ctx.supabase.from("group_members").delete().eq("id", existing);
  return ok({ joined: false });
}

// ---------- group chat ----------

async function groupChatGuard(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return { error: auth.error };
  const id = text(ctx.body.id, 60);
  if (!id) return { error: fail(400, "invalid_input") };
  const { data: group } = await ctx.supabase.from("groups").select("*").eq("id", id).maybeSingle();
  if (!group) return { error: fail(404, "not_found") };
  if ((ROLE_RANK[group.audience_min_role] ?? 2) > auth.rank) return { error: fail(403, "forbidden") };
  const { data: member } = await ctx.supabase
    .from("group_members")
    .select("id")
    .eq("group_id", id)
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!member) return { error: fail(403, "group_members_only") };
  return { auth, group };
}

async function groupsMessages(ctx) {
  const guard = await groupChatGuard(ctx);
  if (guard.error) return guard.error;
  const { data: rows } = await ctx.supabase
    .from("messages")
    .select("*")
    .eq("thread_kind", "group")
    .eq("group_id", guard.group.id)
    .order("created_at", { ascending: true })
    .limit(300);
  const names = await namesFor(ctx.supabase, (rows ?? []).map((r) => r.sender_account_id));
  return ok({
    group: groupPublic(guard.group),
    items: (rows ?? []).map((r) => messagePublic(r, names)),
  });
}

async function groupsSend(ctx) {
  const guard = await groupChatGuard(ctx);
  if (guard.error) return guard.error;
  const body = text(ctx.body.body, MAX_MESSAGE_CHARS);
  if (!body) return fail(400, "invalid_input");
  const row = {
    id: crypto.randomUUID(),
    thread_kind: "group",
    sender_account_id: guard.auth.account.id,
    recipient_account_id: null,
    group_id: guard.group.id,
    body,
    created_at: now(),
  };
  const { error } = await ctx.supabase.from("messages").insert(row);
  if (error) return fail(500, "server_error");
  const names = await namesFor(ctx.supabase, [guard.auth.account.id]);
  return ok({ message: messagePublic(row, names) });
}

// ---------- follows ----------

async function followsToggle(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const targetId = text(ctx.body.accountId, 60);
  if (!targetId) return fail(400, "invalid_input");
  const { data: target } = await ctx.supabase
    .from("accounts")
    .select("id,role,status")
    .eq("id", targetId)
    .maybeSingle();
  if (!target || target.status !== "active" || !WIDOW_ROLES.includes(target.role)) return fail(404, "not_found");
  if (target.id === auth.account.id) return fail(400, "cannot_follow_self");
  const { data: existing } = await ctx.supabase
    .from("follows")
    .select("id")
    .eq("follower_account_id", auth.account.id)
    .eq("followed_account_id", target.id)
    .maybeSingle();
  if (existing) {
    await ctx.supabase.from("follows").delete().eq("id", existing.id);
    return ok({ following: false });
  }
  const { error } = await ctx.supabase.from("follows").insert({
    id: crypto.randomUUID(),
    follower_account_id: auth.account.id,
    followed_account_id: target.id,
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  await notify(ctx.supabase, target.id, "follow", auth.account.id, "Mulai mengikuti Anda", null);
  return ok({ following: true });
}

async function followsMine(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: rows } = await ctx.supabase
    .from("follows")
    .select("*")
    .eq("follower_account_id", auth.account.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const { data: followerRows } = await ctx.supabase
    .from("follows")
    .select("follower_account_id")
    .eq("followed_account_id", auth.account.id);
  const names = await namesFor(ctx.supabase, (rows ?? []).map((r) => r.followed_account_id));
  return ok({
    items: (rows ?? []).map((r) => {
      const info = names.get(r.followed_account_id);
      return {
        accountId: r.followed_account_id,
        nickname: info?.nickname ?? info?.displayName ?? "Anggota",
        tier: info?.tier ?? null,
        photoData: info?.photoData ?? null,
        followedAt: r.created_at,
      };
    }),
    followerCount: (followerRows ?? []).length,
  });
}

// ---------- direct chat ----------

const messagePublic = (row, names) => {
  const info = names?.get(row.sender_account_id);
  return {
    id: row.id,
    threadKind: row.thread_kind,
    senderAccountId: row.sender_account_id,
    senderName: info?.nickname ?? info?.displayName ?? "Anggota",
    senderPhoto: info?.photoData ?? null,
    recipientAccountId: row.recipient_account_id ?? null,
    groupId: row.group_id ?? null,
    body: row.body,
    createdAt: row.created_at,
  };
};

async function chatContacts(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: profileRows } = await ctx.supabase
    .from("profiles")
    .select("id,account_id,nickname,tier,photo_data,status")
    .neq("account_id", auth.account.id)
    .limit(200);
  const { data: sent } = await ctx.supabase
    .from("messages")
    .select("*")
    .eq("thread_kind", "dm")
    .eq("sender_account_id", auth.account.id)
    .limit(500);
  const { data: received } = await ctx.supabase
    .from("messages")
    .select("*")
    .eq("thread_kind", "dm")
    .eq("recipient_account_id", auth.account.id)
    .limit(500);
  const last = new Map();
  for (const m of [...(sent ?? []), ...(received ?? [])]) {
    const other = m.sender_account_id === auth.account.id ? m.recipient_account_id : m.sender_account_id;
    const prev = last.get(other);
    if (!prev || String(m.created_at) > String(prev.createdAt)) {
      last.set(other, {
        body: m.body,
        createdAt: m.created_at,
        fromMe: m.sender_account_id === auth.account.id,
      });
    }
  }
  const items = (profileRows ?? [])
    .map((p) => ({
      accountId: p.account_id,
      profileId: p.id,
      nickname: p.nickname,
      tier: p.tier,
      photoData: p.photo_data ?? null,
      status: p.status,
      lastMessage: last.get(p.account_id) ?? null,
    }))
    .sort((a, b) => {
      if (a.lastMessage && b.lastMessage) return String(b.lastMessage.createdAt).localeCompare(String(a.lastMessage.createdAt));
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      return a.nickname.localeCompare(b.nickname);
    });
  return ok({ items });
}

async function chatThread(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const withId = text(ctx.body.withAccountId, 60);
  if (!withId) return fail(400, "invalid_input");
  const { data: target } = await ctx.supabase
    .from("accounts")
    .select("id,role,status")
    .eq("id", withId)
    .maybeSingle();
  if (!target || target.status !== "active" || !WIDOW_ROLES.includes(target.role)) return fail(404, "not_found");
  const { data: profileRow } = await ctx.supabase
    .from("profiles")
    .select("id,nickname,tier,photo_data")
    .eq("account_id", withId)
    .maybeSingle();
  const { data: sent } = await ctx.supabase
    .from("messages")
    .select("*")
    .eq("thread_kind", "dm")
    .eq("sender_account_id", auth.account.id)
    .eq("recipient_account_id", withId)
    .order("created_at", { ascending: true })
    .limit(300);
  const { data: received } = await ctx.supabase
    .from("messages")
    .select("*")
    .eq("thread_kind", "dm")
    .eq("sender_account_id", withId)
    .eq("recipient_account_id", auth.account.id)
    .order("created_at", { ascending: true })
    .limit(300);
  const merged = [...(sent ?? []), ...(received ?? [])].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );
  const names = await namesFor(ctx.supabase, [auth.account.id, withId]);
  return ok({
    contact: {
      accountId: withId,
      profileId: profileRow?.id ?? null,
      nickname: profileRow?.nickname ?? names.get(withId)?.displayName ?? "Anggota",
      tier: profileRow?.tier ?? null,
      photoData: profileRow?.photo_data ?? null,
    },
    items: merged.map((m) => messagePublic(m, names)),
  });
}

async function chatSend(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const withId = text(ctx.body.withAccountId, 60);
  const body = text(ctx.body.body, MAX_MESSAGE_CHARS);
  if (!withId || !body) return fail(400, "invalid_input");
  if (withId === auth.account.id) return fail(400, "cannot_message_self");
  const { data: target } = await ctx.supabase
    .from("accounts")
    .select("id,role,status")
    .eq("id", withId)
    .maybeSingle();
  if (!target || target.status !== "active" || !WIDOW_ROLES.includes(target.role)) return fail(404, "not_found");
  const row = {
    id: crypto.randomUUID(),
    thread_kind: "dm",
    sender_account_id: auth.account.id,
    recipient_account_id: withId,
    group_id: null,
    body,
    created_at: now(),
  };
  const { error } = await ctx.supabase.from("messages").insert(row);
  if (error) return fail(500, "server_error");
  await notify(ctx.supabase, withId, "message", auth.account.id, "Mengirimkan pesan", `#/pesan?with=${auth.account.id}`);
  const names = await namesFor(ctx.supabase, [auth.account.id]);
  return ok({ message: messagePublic(row, names) });
}

// ---------- programs ----------

const programPublic = (row) => ({
  id: row.id,
  title: row.title,
  category: row.category,
  description: row.description,
  schedule: row.schedule,
  seats: row.seats,
  status: row.status,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

async function programsList(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const { data } = await ctx.supabase
    .from("programs")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(60);
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const counts = new Map();
  const mine = new Set();
  if (ids.length) {
    const { data: participants } = await ctx.supabase
      .from("program_participants")
      .select("program_id,account_id")
      .in("program_id", ids);
    for (const p of participants ?? []) {
      counts.set(p.program_id, (counts.get(p.program_id) ?? 0) + 1);
      if (p.account_id === account?.id) mine.add(p.program_id);
    }
  }
  const creators = await namesFor(ctx.supabase, rows.map((r) => r.created_by));
  return ok({
    items: rows.map((row) => ({
      ...programPublic(row),
      participantCount: counts.get(row.id) ?? 0,
      joined: mine.has(row.id),
      creatorName: creators.get(row.created_by)?.nickname ?? creators.get(row.created_by)?.displayName ?? null,
    })),
  });
}

async function programsCreate(ctx) {
  const auth = await actor(ctx, 3);
  if (auth.error) return auth.error;
  const { body } = ctx;
  const title = text(body.title, 140);
  const category = PROGRAM_CATEGORIES.includes(body.category) ? body.category : null;
  if (title.length < 3 || !category) return fail(400, "invalid_input");
  const row = {
    id: crypto.randomUUID(),
    title,
    category,
    description: textOrNull(body.description, 1500),
    schedule: textOrNull(body.schedule, 160),
    seats: intOrNull(body.seats, 1, 100000),
    status: "published",
    created_by: auth.account.id,
    created_at: now(),
  };
  const { error } = await ctx.supabase.from("programs").insert(row);
  if (error) return fail(500, "server_error");
  return ok({ program: programPublic(row) });
}

async function programsEnroll(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const { data: row } = await ctx.supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (!row || row.status !== "published") return fail(404, "not_found");
  const existing = await isEnrolled(ctx.supabase, "program_participants", "program_id", id, auth.account.id);
  if (existing) return ok({ joined: true });
  if (row.seats) {
    const { data: participants } = await ctx.supabase
      .from("program_participants")
      .select("id")
      .eq("program_id", id);
    if ((participants ?? []).length >= row.seats) return fail(409, "program_full");
  }
  const { error } = await ctx.supabase.from("program_participants").insert({
    id: crypto.randomUUID(),
    program_id: id,
    account_id: auth.account.id,
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  return ok({ joined: true });
}

async function programsUnenroll(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const existing = await isEnrolled(ctx.supabase, "program_participants", "program_id", id, auth.account.id);
  if (existing) await ctx.supabase.from("program_participants").delete().eq("id", existing);
  return ok({ joined: false });
}

// ---------- admin ----------

async function adminStats(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const { data: accounts } = await ctx.supabase.from("accounts").select("id,role,status");
  const byRole = {};
  for (const a of accounts ?? []) byRole[a.role] = (byRole[a.role] ?? 0) + 1;
  const pendingProfiles = await countRows(ctx.supabase, "profiles", (q) => q.eq("status", "pending"));
  const openReports = await countRows(ctx.supabase, "reports", (q) => q.eq("status", "open"));
  const { data: donationRows } = await ctx.supabase.from("donations").select("gross_amount,status");
  const donationTotal = (donationRows ?? [])
    .filter((d) => d.status === "settled")
    .reduce((sum, d) => sum + Number(d.gross_amount ?? 0), 0);
  return ok({
    accounts: { total: (accounts ?? []).length, byRole },
    pendingProfiles,
    openReports,
    donationTotal,
    paymentEnabled: Boolean(ctx.env("MIDTRANS_SERVER_KEY")),
  });
}

async function adminAccountsList(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("accounts")
    .select("id,email,role,status,display_name,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const profiles = await namesFor(ctx.supabase, rows.map((r) => r.id));
  return ok({
    items: rows.map((row) => ({
      ...publicAccount(row),
      createdAt: row.created_at,
      nickname: profiles.get(row.id)?.nickname ?? null,
      tier: profiles.get(row.id)?.tier ?? null,
    })),
  });
}

async function adminSetRole(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const role = text(ctx.body.role, 20);
  if (!WIDOW_ROLES.includes(role)) return fail(400, "invalid_role");
  if (id === auth.account.id) return fail(400, "cannot_modify_self");
  const { data: target } = await ctx.supabase.from("accounts").select("id,role").eq("id", id).maybeSingle();
  if (!target) return fail(404, "not_found");
  const profile = await ownProfile(ctx.supabase, id);
  if (!profile) return fail(400, "member_profile_required");
  await ctx.supabase.from("accounts").update({ role }).eq("id", id);
  await ctx.supabase.from("profiles").update({ tier: role, updated_at: now() }).eq("id", profile.id);
  return ok({ role });
}

async function adminSetStatus(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const status = ctx.body.status === "suspended" ? "suspended" : ctx.body.status === "active" ? "active" : null;
  if (!status) return fail(400, "invalid_status");
  if (id === auth.account.id) return fail(400, "cannot_modify_self");
  const { data: target } = await ctx.supabase.from("accounts").select("id,role").eq("id", id).maybeSingle();
  if (!target) return fail(404, "not_found");
  if (target.role === "admin") return fail(400, "cannot_modify_admin");
  await ctx.supabase.from("accounts").update({ status }).eq("id", id);
  if (status === "suspended") await ctx.supabase.from("sessions").delete().eq("account_id", id);
  return ok({ status });
}

async function adminProfilesPending(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(100);
  const rows = (data ?? []).filter((p) => p.status === "pending" || p.status === "rejected");
  return ok({ items: rows.map((row) => publicProfile(row, true)) });
}

async function adminReviewProfile(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const approve = ctx.body.approve === true;
  const { data: profile } = await ctx.supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) return fail(404, "not_found");
  const patch = approve
    ? { status: "verified", reject_reason: null, verified_at: now(), updated_at: now() }
    : { status: "rejected", reject_reason: textOrNull(ctx.body.reason, 400) ?? "Tidak memenuhi ketentuan.", updated_at: now() };
  const { error } = await ctx.supabase.from("profiles").update(patch).eq("id", id);
  if (error) return fail(500, "server_error");
  return ok({ status: patch.status });
}

async function adminReportsList(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("reports")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  return ok({
    items: (data ?? []).map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      createdAt: r.created_at,
    })),
  });
}

async function adminResolveReport(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const resolution = ctx.body.resolution === "hide" ? "hide" : "dismiss";
  const { data: report } = await ctx.supabase.from("reports").select("*").eq("id", id).maybeSingle();
  if (!report) return fail(404, "not_found");
  if (resolution === "hide") {
    if (report.target_type === "comment") await ctx.supabase.from("comments").update({ status: "hidden" }).eq("id", report.target_id);
    if (report.target_type === "update") await ctx.supabase.from("updates").update({ status: "hidden" }).eq("id", report.target_id);
    if (report.target_type === "profile") await ctx.supabase.from("profiles").update({ status: "suspended", updated_at: now() }).eq("id", report.target_id);
  }
  await ctx.supabase.from("reports").update({ status: "resolved", resolved_at: now() }).eq("id", id);
  return ok({ resolved: true, resolution });
}

// ---------- admin settings ----------

const APP_SETTINGS = {
  payment: {
    midtransServerKey: "",
    midtransClientKey: "",
    midtransEnvironment: "sandbox",
    enabled: true,
  },
  shipping: {
    enabled: false,
    providers: [
      { id: "jne", name: "JNE", enabled: true, baseRate: 15000 },
      { id: "jnt", name: "J&T Express", enabled: true, baseRate: 12000 },
      { id: "sicepat", name: "SiCepat", enabled: false, baseRate: 10000 },
    ],
  },
  subscription: {
    prices: {
      sosialita: 100000,
      high_society: 500000,
      the_ceo: 1000000,
    },
  },
  academy: {
    enabled: true,
    title: "Akademi Wirausaha Janda Tangguh",
    description: "Program pembelajaran untuk mengembangkan keterampilan wirausaha",
    schedule: "Setiap Sabtu, 09:00 - 12:00 WIB",
    location: "Ruang Komunitas Panti Janda",
    modules: [
      { id: "mod1", title: "Dasar-Dasar Bisnis", duration: "2 jam", enabled: true },
      { id: "mod2", title: "Pemasaran Digital", duration: "2 jam", enabled: true },
      { id: "mod3", title: "Keuangan Usaha", duration: "2 jam", enabled: true },
    ],
  },
  trading: {
    enabled: true,
    title: "Belajar Trading",
    description: "Pelatihan trading untuk investasi dan pengelolaan keuangan",
    schedule: "Setiap Rabu, 19:00 - 21:00 WIB",
    location: "Online via Zoom",
    modules: [
      { id: "trade1", title: "Pengantar Trading", duration: "1.5 jam", enabled: true },
      { id: "trade2", title: "Analisis Teknikal", duration: "2 jam", enabled: true },
      { id: "trade3", title: "Manajemen Risiko", duration: "1.5 jam", enabled: true },
    ],
  },
  links: {
    enabled: true,
    items: [
      { id: "link1", title: "Website Resmi", url: "https://pantijanda.id", enabled: true },
      { id: "link2", title: "Instagram", url: "https://instagram.com/pantijanda", enabled: true },
      { id: "link3", title: "WhatsApp Group", url: "https://chat.whatsapp.com/example", enabled: true },
    ],
  },
  liveTrading: {
    enabled: false,
    provider: "tradingview",
    tradingViewWidgetId: "",
    tradingViewSymbol: "IDX:IHSG",
    tradingViewInterval: "15",
    tradingViewTheme: "light",
    apiKey: "",
    apiBaseUrl: "",
    symbols: [
      { id: "sym1", symbol: "IDX:IHSG", label: "IHSG", enabled: true },
      { id: "sym2", symbol: "IDX:BBCA", label: "BBCA", enabled: true },
      { id: "sym3", symbol: "IDX:BBRI", label: "BBRI", enabled: true },
    ],
    refreshInterval: 30,
  },
  metaTrader5: {
    enabled: false,
    broker: "",
    server: "",
    login: "",
    password: "",
    accountType: "demo",
    leverage: 100,
    balance: 10000000,
    currency: "USD",
    allowedSymbols: ["EURUSD", "GBPUSD", "XAUUSD"],
    riskManagement: {
      maxLotSize: 1.0,
      maxOpenPositions: 10,
      stopLossPips: 50,
      takeProfitPips: 100,
      dailyLossLimit: 500,
    },
  },
  aiTradingAgent: {
    enabled: false,
    name: "AI Trading Agent",
    description: "Agent trading otomatis berbasis kecerdasan buatan",
    model: "gpt-4",
    strategy: "momentum",
    riskLevel: "medium",
    maxDailyTrades: 20,
    minConfidence: 0.7,
    autoExecute: false,
    notifyOnTrade: true,
    parameters: {
      lookbackPeriod: 14,
      entryThreshold: 0.65,
      exitThreshold: 0.45,
      positionSizePercent: 5,
    },
    allowedMarkets: ["forex", "crypto", "stocks"],
    schedule: {
      enabled: true,
      startHour: 8,
      endHour: 22,
      timezone: "Asia/Jakarta",
    },
  },
  coinSettings: {
    purchaseMethods: [
      { id: "transfer_bank", label: "Transfer Bank", enabled: true },
      { id: "qris", label: "Scan QRIS", enabled: true },
      { id: "payment_gateway", label: "Payment Gateway", enabled: true },
    ],
    withdrawMethods: [
      { id: "qris", label: "QRIS", enabled: true },
      { id: "transfer_bank", label: "Transfer Bank", enabled: true },
      { id: "dana", label: "DANA", enabled: true },
      { id: "gopay", label: "GoPay", enabled: true },
      { id: "ovo", label: "OVO", enabled: true },
    ],
    conversionRate: 100,
    fees: {
      adminFeePercent: 2,
      withdrawFeePercent: 1.5,
      minWithdrawCoins: 1000,
    },
  },
  blockchainApi: {
    enabled: false,
    apiBaseUrl: "",
    apiKey: "",
    network: "testnet",
    contractAddress: "",
    chainId: "",
    rpcUrl: "",
    webhookSecret: "",
    platformWallet: "",
    gasLimit: 21000,
    confirmations: 12,
  },
  trialAccounts: {
    enabled: false,
    accountsPerTier: 2,
    password: "trial12345",
  },
};

async function adminSettingsGet(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  return ok({ settings: APP_SETTINGS });
}

async function adminSettingsUpdate(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const { payment, shipping, subscription, academy, trading, links, liveTrading, metaTrader5, aiTradingAgent, coinSettings, blockchainApi, trialAccounts } = ctx.body ?? {};
  if (payment) {
    if (typeof payment.midtransServerKey === "string") APP_SETTINGS.payment.midtransServerKey = payment.midtransServerKey;
    if (typeof payment.midtransClientKey === "string") APP_SETTINGS.payment.midtransClientKey = payment.midtransClientKey;
    if (payment.midtransEnvironment === "sandbox" || payment.midtransEnvironment === "production") {
      APP_SETTINGS.payment.midtransEnvironment = payment.midtransEnvironment;
    }
    if (typeof payment.enabled === "boolean") APP_SETTINGS.payment.enabled = payment.enabled;
  }
  if (shipping) {
    if (typeof shipping.enabled === "boolean") APP_SETTINGS.shipping.enabled = shipping.enabled;
    if (Array.isArray(shipping.providers)) {
      APP_SETTINGS.shipping.providers = shipping.providers.map((p) => ({
        id: text(p.id, 50),
        name: text(p.name, 100),
        enabled: Boolean(p.enabled),
        baseRate: Number(p.baseRate) || 0,
      }));
    }
  }
  if (subscription && subscription.prices) {
    const prices = subscription.prices;
    for (const tier of ["sosialita", "high_society", "the_ceo"]) {
      if (typeof prices[tier] === "number" && prices[tier] >= 0) {
        APP_SETTINGS.subscription.prices[tier] = Math.floor(prices[tier]);
      }
    }
  }
  if (academy) {
    if (typeof academy.enabled === "boolean") APP_SETTINGS.academy.enabled = academy.enabled;
    if (typeof academy.title === "string") APP_SETTINGS.academy.title = text(academy.title, 200);
    if (typeof academy.description === "string") APP_SETTINGS.academy.description = text(academy.description, 1000);
    if (typeof academy.schedule === "string") APP_SETTINGS.academy.schedule = text(academy.schedule, 200);
    if (typeof academy.location === "string") APP_SETTINGS.academy.location = text(academy.location, 200);
    if (Array.isArray(academy.modules)) {
      APP_SETTINGS.academy.modules = academy.modules.map((m) => ({
        id: text(m.id, 50),
        title: text(m.title, 200),
        duration: text(m.duration, 50),
        enabled: Boolean(m.enabled),
      }));
    }
  }
  if (trading) {
    if (typeof trading.enabled === "boolean") APP_SETTINGS.trading.enabled = trading.enabled;
    if (typeof trading.title === "string") APP_SETTINGS.trading.title = text(trading.title, 200);
    if (typeof trading.description === "string") APP_SETTINGS.trading.description = text(trading.description, 1000);
    if (typeof trading.schedule === "string") APP_SETTINGS.trading.schedule = text(trading.schedule, 200);
    if (typeof trading.location === "string") APP_SETTINGS.trading.location = text(trading.location, 200);
    if (Array.isArray(trading.modules)) {
      APP_SETTINGS.trading.modules = trading.modules.map((m) => ({
        id: text(m.id, 50),
        title: text(m.title, 200),
        duration: text(m.duration, 50),
        enabled: Boolean(m.enabled),
      }));
    }
  }
  if (links) {
    if (typeof links.enabled === "boolean") APP_SETTINGS.links.enabled = links.enabled;
    if (Array.isArray(links.items)) {
      APP_SETTINGS.links.items = links.items.map((item) => ({
        id: text(item.id, 50),
        title: text(item.title, 200),
        url: text(item.url, 500),
        enabled: Boolean(item.enabled),
      }));
    }
  }
  if (liveTrading) {
    if (typeof liveTrading.enabled === "boolean") APP_SETTINGS.liveTrading.enabled = liveTrading.enabled;
    if (typeof liveTrading.provider === "string") APP_SETTINGS.liveTrading.provider = text(liveTrading.provider, 50);
    if (typeof liveTrading.tradingViewWidgetId === "string") APP_SETTINGS.liveTrading.tradingViewWidgetId = text(liveTrading.tradingViewWidgetId, 100);
    if (typeof liveTrading.tradingViewSymbol === "string") APP_SETTINGS.liveTrading.tradingViewSymbol = text(liveTrading.tradingViewSymbol, 50);
    if (typeof liveTrading.tradingViewInterval === "string") APP_SETTINGS.liveTrading.tradingViewInterval = text(liveTrading.tradingViewInterval, 10);
    if (typeof liveTrading.tradingViewTheme === "string") APP_SETTINGS.liveTrading.tradingViewTheme = text(liveTrading.tradingViewTheme, 20);
    if (typeof liveTrading.apiKey === "string") APP_SETTINGS.liveTrading.apiKey = liveTrading.apiKey;
    if (typeof liveTrading.apiBaseUrl === "string") APP_SETTINGS.liveTrading.apiBaseUrl = text(liveTrading.apiBaseUrl, 500);
    if (Array.isArray(liveTrading.symbols)) {
      APP_SETTINGS.liveTrading.symbols = liveTrading.symbols.map((s) => ({
        id: text(s.id, 50),
        symbol: text(s.symbol, 50),
        label: text(s.label, 100),
        enabled: Boolean(s.enabled),
      }));
    }
    if (typeof liveTrading.refreshInterval === "number") APP_SETTINGS.liveTrading.refreshInterval = Math.max(5, Math.floor(liveTrading.refreshInterval));
  }
  if (metaTrader5) {
    if (typeof metaTrader5.enabled === "boolean") APP_SETTINGS.metaTrader5.enabled = metaTrader5.enabled;
    if (typeof metaTrader5.broker === "string") APP_SETTINGS.metaTrader5.broker = text(metaTrader5.broker, 200);
    if (typeof metaTrader5.server === "string") APP_SETTINGS.metaTrader5.server = text(metaTrader5.server, 200);
    if (typeof metaTrader5.login === "string") APP_SETTINGS.metaTrader5.login = text(metaTrader5.login, 100);
    if (typeof metaTrader5.password === "string") APP_SETTINGS.metaTrader5.password = metaTrader5.password;
    if (metaTrader5.accountType === "demo" || metaTrader5.accountType === "real") {
      APP_SETTINGS.metaTrader5.accountType = metaTrader5.accountType;
    }
    if (typeof metaTrader5.leverage === "number") APP_SETTINGS.metaTrader5.leverage = Math.max(1, Math.floor(metaTrader5.leverage));
    if (typeof metaTrader5.balance === "number") APP_SETTINGS.metaTrader5.balance = Math.max(0, Math.floor(metaTrader5.balance));
    if (typeof metaTrader5.currency === "string") APP_SETTINGS.metaTrader5.currency = text(metaTrader5.currency, 10);
    if (Array.isArray(metaTrader5.allowedSymbols)) {
      APP_SETTINGS.metaTrader5.allowedSymbols = metaTrader5.allowedSymbols.map((s) => text(s, 20));
    }
    if (metaTrader5.riskManagement) {
      const rm = metaTrader5.riskManagement;
      if (typeof rm.maxLotSize === "number") APP_SETTINGS.metaTrader5.riskManagement.maxLotSize = Math.max(0.01, rm.maxLotSize);
      if (typeof rm.maxOpenPositions === "number") APP_SETTINGS.metaTrader5.riskManagement.maxOpenPositions = Math.max(1, Math.floor(rm.maxOpenPositions));
      if (typeof rm.stopLossPips === "number") APP_SETTINGS.metaTrader5.riskManagement.stopLossPips = Math.max(1, Math.floor(rm.stopLossPips));
      if (typeof rm.takeProfitPips === "number") APP_SETTINGS.metaTrader5.riskManagement.takeProfitPips = Math.max(1, Math.floor(rm.takeProfitPips));
      if (typeof rm.dailyLossLimit === "number") APP_SETTINGS.metaTrader5.riskManagement.dailyLossLimit = Math.max(0, Math.floor(rm.dailyLossLimit));
    }
  }
  if (aiTradingAgent) {
    if (typeof aiTradingAgent.enabled === "boolean") APP_SETTINGS.aiTradingAgent.enabled = aiTradingAgent.enabled;
    if (typeof aiTradingAgent.name === "string") APP_SETTINGS.aiTradingAgent.name = text(aiTradingAgent.name, 200);
    if (typeof aiTradingAgent.description === "string") APP_SETTINGS.aiTradingAgent.description = text(aiTradingAgent.description, 1000);
    if (typeof aiTradingAgent.model === "string") APP_SETTINGS.aiTradingAgent.model = text(aiTradingAgent.model, 50);
    if (typeof aiTradingAgent.strategy === "string") APP_SETTINGS.aiTradingAgent.strategy = text(aiTradingAgent.strategy, 50);
    if (typeof aiTradingAgent.riskLevel === "string") APP_SETTINGS.aiTradingAgent.riskLevel = text(aiTradingAgent.riskLevel, 20);
    if (typeof aiTradingAgent.maxDailyTrades === "number") APP_SETTINGS.aiTradingAgent.maxDailyTrades = Math.max(1, Math.floor(aiTradingAgent.maxDailyTrades));
    if (typeof aiTradingAgent.minConfidence === "number") APP_SETTINGS.aiTradingAgent.minConfidence = Math.max(0, Math.min(1, aiTradingAgent.minConfidence));
    if (typeof aiTradingAgent.autoExecute === "boolean") APP_SETTINGS.aiTradingAgent.autoExecute = aiTradingAgent.autoExecute;
    if (typeof aiTradingAgent.notifyOnTrade === "boolean") APP_SETTINGS.aiTradingAgent.notifyOnTrade = aiTradingAgent.notifyOnTrade;
    if (aiTradingAgent.parameters) {
      const p = aiTradingAgent.parameters;
      if (typeof p.lookbackPeriod === "number") APP_SETTINGS.aiTradingAgent.parameters.lookbackPeriod = Math.max(1, Math.floor(p.lookbackPeriod));
      if (typeof p.entryThreshold === "number") APP_SETTINGS.aiTradingAgent.parameters.entryThreshold = Math.max(0, Math.min(1, p.entryThreshold));
      if (typeof p.exitThreshold === "number") APP_SETTINGS.aiTradingAgent.parameters.exitThreshold = Math.max(0, Math.min(1, p.exitThreshold));
      if (typeof p.positionSizePercent === "number") APP_SETTINGS.aiTradingAgent.parameters.positionSizePercent = Math.max(1, Math.min(100, Math.floor(p.positionSizePercent)));
    }
    if (Array.isArray(aiTradingAgent.allowedMarkets)) {
      APP_SETTINGS.aiTradingAgent.allowedMarkets = aiTradingAgent.allowedMarkets.map((m) => text(m, 30));
    }
    if (aiTradingAgent.schedule) {
      const s = aiTradingAgent.schedule;
      if (typeof s.enabled === "boolean") APP_SETTINGS.aiTradingAgent.schedule.enabled = s.enabled;
      if (typeof s.startHour === "number") APP_SETTINGS.aiTradingAgent.schedule.startHour = Math.max(0, Math.min(23, Math.floor(s.startHour)));
      if (typeof s.endHour === "number") APP_SETTINGS.aiTradingAgent.schedule.endHour = Math.max(0, Math.min(23, Math.floor(s.endHour)));
      if (typeof s.timezone === "string") APP_SETTINGS.aiTradingAgent.schedule.timezone = text(s.timezone, 50);
    }
  }
  if (coinSettings) {
    if (Array.isArray(coinSettings.purchaseMethods)) {
      APP_SETTINGS.coinSettings.purchaseMethods = coinSettings.purchaseMethods.map((m) => ({
        id: text(m.id, 50),
        label: text(m.label, 100),
        enabled: Boolean(m.enabled),
      }));
    }
    if (Array.isArray(coinSettings.withdrawMethods)) {
      APP_SETTINGS.coinSettings.withdrawMethods = coinSettings.withdrawMethods.map((m) => ({
        id: text(m.id, 50),
        label: text(m.label, 100),
        enabled: Boolean(m.enabled),
      }));
    }
    if (typeof coinSettings.conversionRate === "number") {
      APP_SETTINGS.coinSettings.conversionRate = Math.max(1, Math.floor(coinSettings.conversionRate));
    }
    if (coinSettings.fees) {
      const f = coinSettings.fees;
      if (typeof f.adminFeePercent === "number") APP_SETTINGS.coinSettings.fees.adminFeePercent = Math.max(0, Math.min(100, f.adminFeePercent));
      if (typeof f.withdrawFeePercent === "number") APP_SETTINGS.coinSettings.fees.withdrawFeePercent = Math.max(0, Math.min(100, f.withdrawFeePercent));
      if (typeof f.minWithdrawCoins === "number") APP_SETTINGS.coinSettings.fees.minWithdrawCoins = Math.max(0, Math.floor(f.minWithdrawCoins));
    }
  }
  if (blockchainApi) {
    if (typeof blockchainApi.enabled === "boolean") APP_SETTINGS.blockchainApi.enabled = blockchainApi.enabled;
    if (typeof blockchainApi.apiBaseUrl === "string") APP_SETTINGS.blockchainApi.apiBaseUrl = text(blockchainApi.apiBaseUrl, 500);
    if (typeof blockchainApi.apiKey === "string") APP_SETTINGS.blockchainApi.apiKey = blockchainApi.apiKey;
    if (typeof blockchainApi.network === "string") APP_SETTINGS.blockchainApi.network = text(blockchainApi.network, 50);
    if (typeof blockchainApi.contractAddress === "string") APP_SETTINGS.blockchainApi.contractAddress = text(blockchainApi.contractAddress, 200);
    if (typeof blockchainApi.chainId === "string") APP_SETTINGS.blockchainApi.chainId = text(blockchainApi.chainId, 50);
    if (typeof blockchainApi.rpcUrl === "string") APP_SETTINGS.blockchainApi.rpcUrl = text(blockchainApi.rpcUrl, 500);
    if (typeof blockchainApi.webhookSecret === "string") APP_SETTINGS.blockchainApi.webhookSecret = blockchainApi.webhookSecret;
    if (typeof blockchainApi.platformWallet === "string") APP_SETTINGS.blockchainApi.platformWallet = text(blockchainApi.platformWallet, 200);
    if (typeof blockchainApi.gasLimit === "number") APP_SETTINGS.blockchainApi.gasLimit = Math.max(21000, Math.floor(blockchainApi.gasLimit));
    if (typeof blockchainApi.confirmations === "number") APP_SETTINGS.blockchainApi.confirmations = Math.max(1, Math.floor(blockchainApi.confirmations));
  }
  if (trialAccounts) {
    if (typeof trialAccounts.accountsPerTier === "number") APP_SETTINGS.trialAccounts.accountsPerTier = Math.max(1, Math.min(10, Math.floor(trialAccounts.accountsPerTier)));
    if (typeof trialAccounts.password === "string" && trialAccounts.password.length >= 8) APP_SETTINGS.trialAccounts.password = trialAccounts.password;
  }
  return ok({ settings: APP_SETTINGS });
}

// ---------- trial accounts ----------

const TRIAL_TIERS = [
  { role: "wonder_woman", label: "Wonder Woman", isMember: true },
  { role: "sosialita", label: "Sosialita", isMember: true },
  { role: "high_society", label: "High Society", isMember: true },
  { role: "the_ceo", label: "The CEO", isMember: true },
  { role: "kades", label: "Kades", isMember: false },
  { role: "gubernur", label: "Gubernur", isMember: false },
  { role: "panglima", label: "Panglima", isMember: false },
  { role: "presiden", label: "Presiden", isMember: false },
];

function trialEmail(tier, index) {
  return `trial.${tier}.${index}@panti.test`;
}

async function adminTrialStatus(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("accounts")
    .select("id,email,role,display_name")
    .like("email", "trial.%@panti.test");
  const byTier = {};
  for (const t of TRIAL_TIERS) byTier[t.role] = [];
  for (const a of data ?? []) {
    const match = a.email.match(/^trial\.(.+)\.\d+@panti\.test$/);
    if (match && byTier[match[1]]) byTier[match[1]].push({ id: a.id, email: a.email, display_name: a.display_name });
  }
  return ok({ total: (data ?? []).length, byTier, settings: APP_SETTINGS.trialAccounts });
}

async function adminTrialCreate(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const count = APP_SETTINGS.trialAccounts.accountsPerTier;
  const password = APP_SETTINGS.trialAccounts.password;
  const hash = await hashPassword(password);
  const created = [];

  for (const tier of TRIAL_TIERS) {
    for (let i = 1; i <= count; i++) {
      const mail = trialEmail(tier.role, i);
      const { data: existing } = await ctx.supabase.from("accounts").select("id").eq("email", mail).maybeSingle();
      if (existing) {
        created.push({ email: mail, role: tier.role, skipped: true });
        continue;
      }
      const accountId = crypto.randomUUID();
      const displayName = `Trial ${tier.label} #${i}`;
      await ctx.supabase.from("accounts").insert({
        id: accountId,
        email: mail,
        password_hash: hash,
        role: tier.role,
        status: "active",
        display_name: displayName,
        level: 1,
        xp: 0,
        created_at: now(),
      });
      if (tier.isMember) {
        await ctx.supabase.from("profiles").insert({
          id: crypto.randomUUID(),
          account_id: accountId,
          nickname: displayName,
          tier: tier.role,
          full_name: displayName,
          verification_doc_type: "ktp",
          verification_doc_name: "trial",
          verification_doc_data: "",
          city: null,
          age: null,
          dependents: null,
          employment_status: null,
          skills: [],
          trainings: [],
          needs_target: null,
          main_target: null,
          interests: [],
          bio: null,
          funding_info: null,
          status: "verified",
          reject_reason: null,
          verified_at: now(),
          created_at: now(),
          updated_at: now(),
        });
      }
      created.push({ email: mail, role: tier.role, skipped: false });
    }
  }
  APP_SETTINGS.trialAccounts.enabled = true;
  return ok({ created: created.length, items: created });
}

async function adminTrialDelete(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("accounts")
    .select("id")
    .like("email", "trial.%@panti.test");
  const ids = (data ?? []).map((a) => a.id);
  if (ids.length > 0) {
    await ctx.supabase.from("sessions").delete().in("account_id", ids);
    await ctx.supabase.from("profiles").delete().in("account_id", ids);
    await ctx.supabase.from("subscriptions").delete().in("account_id", ids);
    await ctx.supabase.from("notifications").delete().in("account_id", ids);
    await ctx.supabase.from("accounts").delete().in("id", ids);
  }
  APP_SETTINGS.trialAccounts.enabled = false;
  return ok({ deleted: ids.length });
}

// ---------- notifications ----------

async function notify(supabase, recipientAccountId, type, actorAccountId, message, link) {
  if (!recipientAccountId || recipientAccountId === actorAccountId) return;
  await supabase.from("notifications").insert({
    id: crypto.randomUUID(),
    recipient_account_id: recipientAccountId,
    type,
    actor_account_id: actorAccountId ?? null,
    message,
    link: link ?? null,
    read: false,
    created_at: now(),
  });
}

async function notificationsList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: rows } = await ctx.supabase
    .from("notifications")
    .select("*")
    .eq("recipient_account_id", auth.account.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_account_id).filter(Boolean))];
  const names = await namesFor(ctx.supabase, actorIds);
  return ok({
    items: (rows ?? []).map((r) => {
      const info = r.actor_account_id ? names.get(r.actor_account_id) : null;
      return {
        id: r.id,
        type: r.type,
        actorName: info?.nickname ?? info?.displayName ?? null,
        actorPhoto: info?.photoData ?? null,
        message: r.message,
        link: r.link ?? null,
        read: r.read,
        createdAt: r.created_at,
      };
    }),
    unreadCount: (rows ?? []).filter((r) => !r.read).length,
  });
}

async function notificationsMarkRead(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const all = ctx.body.all === true;
  if (all) {
    await ctx.supabase
      .from("notifications")
      .update({ read: true })
      .eq("recipient_account_id", auth.account.id)
      .eq("read", false);
    return ok({ updated: true });
  }
  if (!id) return fail(400, "invalid_input");
  await ctx.supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("recipient_account_id", auth.account.id);
  return ok({ updated: true });
}

// ---------- campaigns ----------

const campaignPublic = (row, names) => {
  const info = names?.get(row.profile_id);
  return {
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    description: row.description,
    targetAmount: row.target_amount,
    collectedAmount: row.collected_amount ?? 0,
    deadline: row.deadline ?? null,
    status: row.status,
    creatorName: info?.nickname ?? info?.displayName ?? "Anggota",
    creatorPhoto: info?.photoData ?? null,
    createdAt: row.created_at,
    donorCount: row.donor_count ?? 0,
  };
};

async function campaignsList(ctx) {
  const auth = await actor(ctx, 0);
  const { data: rows } = await ctx.supabase
    .from("campaigns")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);
  const names = await namesFor(ctx.supabase, (rows ?? []).map((r) => r.profile_id));
  return ok({ items: (rows ?? []).map((r) => campaignPublic(r, names)) });
}

async function campaignsGet(ctx) {
  const auth = await actor(ctx, 0);
  const id = text(ctx.body.id, 60);
  if (!id) return fail(400, "invalid_input");
  const { data: row } = await ctx.supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!row) return fail(404, "not_found");
  const names = await namesFor(ctx.supabase, [row.profile_id]);
  const { data: donations } = await ctx.supabase
    .from("campaign_donations")
    .select("*")
    .eq("campaign_id", id)
    .eq("status", "settled")
    .order("created_at", { ascending: false })
    .limit(50);
  return ok({
    ...campaignPublic(row, names),
    donations: (donations ?? []).map((d) => ({
      id: d.id,
      supporterName: d.supporter_name,
      amount: d.amount,
      message: d.message ?? null,
      status: d.status,
      createdAt: d.created_at,
    })),
  });
}

async function campaignsCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profile = await ownProfile(ctx.supabase, auth.account.id);
  if (!profile) return fail(404, "not_found");
  const title = text(ctx.body.title, 120);
  const description = text(ctx.body.description, 2000);
  const targetAmount = intOrNull(ctx.body.targetAmount, 100000, 100000000000);
  const deadline = dateOrNull(ctx.body.deadline);
  if (!title || !description || !targetAmount) return fail(400, "invalid_input");
  const { error } = await ctx.supabase.from("campaigns").insert({
    id: crypto.randomUUID(),
    profile_id: profile.id,
    title,
    description,
    target_amount: targetAmount,
    collected_amount: 0,
    deadline,
    status: "open",
    donor_count: 0,
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  return ok({ created: true });
}

async function campaignsDonate(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const serverKey = ctx.env("MIDTRANS_SERVER_KEY");
  if (!serverKey) return fail(503, "service_not_configured");
  const campaignId = text(ctx.body.campaignId, 60);
  const amount = intOrNull(ctx.body.amount, 10000, 100000000000);
  if (!campaignId || !amount) return fail(400, "invalid_input");
  const { data: campaign } = await ctx.supabase
    .from("campaigns")
    .select("id,title,status,profile_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || campaign.status !== "open") return fail(404, "not_found");
  const orderId = `PJC-${Date.now()}-${b64url(crypto.getRandomValues(new Uint8Array(4)))}`;
  const base = ctx.env("MIDTRANS_ENV") === "production"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
  const supporterName = text(ctx.body.supporterName, 80) || account?.display_name || "Sahabat Panti Janda";
  const supporterEmail = email(ctx.body.supporterEmail) ?? account?.email ?? null;
  let redirectUrl = null;
  let gatewayError = false;
  try {
    const response = await safeFetch(`${base}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Basic ${b64(enc.encode(`${serverKey}:`))}`,
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: campaignId, price: amount, quantity: 1, name: campaign.title.slice(0, 50) }],
        customer_details: { first_name: supporterName.slice(0, 50), email: supporterEmail ?? undefined },
      }),
    });
    const payload = await response.json().catch(() => null);
    redirectUrl = typeof payload?.redirect_url === "string" ? payload.redirect_url : null;
    if (!response.ok || !redirectUrl) gatewayError = true;
  } catch {
    gatewayError = true;
  }
  if (gatewayError) return fail(502, "gateway_error");
  const { error } = await ctx.supabase.from("campaign_donations").insert({
    id: crypto.randomUUID(),
    campaign_id: campaignId,
    order_id: orderId,
    amount,
    supporter_name: supporterName,
    supporter_email: supporterEmail,
    message: textOrNull(ctx.body.message, 200),
    status: "pending",
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  return ok({ redirectUrl, orderId });
}

// ---------- businesses ----------

const BUSINESS_TYPES = [
  "Kuliner",
  "Fesyen & Tekstil",
  "Kerajinan Tangan",
  "Kecantikan & Perawatan",
  "Pertanian & Peternakan",
  "Jasa & Layanan",
  "Retail & Warung",
  "Lainnya",
];

function publicBusiness(row, profile) {
  return {
    id: row.id,
    profileId: row.profile_id,
    businessType: row.business_type,
    title: row.title,
    description: row.description ?? null,
    capitalNeeded: row.capital_needed ?? 0,
    status: row.status ?? "draft",
    rejectReason: row.reject_reason ?? null,
    creatorName: profile?.nickname ?? "Anggota",
    creatorPhoto: profile?.photo_data ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicBusinessDetail(row, profile, rabRows) {
  const base = publicBusiness(row, profile);
  const rabItems = (rabRows ?? []).map((r) => ({
    id: r.id,
    description: r.description,
    quantity: r.quantity ?? 0,
    unit: r.unit ?? "",
    unitPrice: r.unit_price ?? 0,
    total: r.total ?? 0,
  }));
  const rabTotal = rabItems.reduce((sum, item) => sum + item.total, 0);
  return {
    ...base,
    proposal: row.proposal ?? null,
    rabItems,
    rabTotal,
  };
}

async function businessesList(ctx) {
  const { supabase } = ctx;
  const { data: rows } = await supabase
    .from("businesses")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);
  const profileIds = [...new Set((rows ?? []).map((r) => r.profile_id))];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id,nickname,photo_data").in("id", profileIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const items = (rows ?? []).map((r) => publicBusiness(r, profileMap.get(r.profile_id)));
  return ok({ items });
}

async function businessesGet(ctx) {
  const { supabase, body } = ctx;
  const id = text(body.id, 60);
  if (!id) return fail(400, "invalid_input");
  const { data: row } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
  if (!row) return fail(404, "not_found");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,nickname,photo_data")
    .eq("id", row.profile_id)
    .maybeSingle();
  const { data: rabRows } = await supabase
    .from("business_rab")
    .select("*")
    .eq("business_id", id)
    .order("created_at", { ascending: true });
  return ok({ business: publicBusinessDetail(row, profile, rabRows) });
}

async function businessesMine(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("id")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!profile) return fail(404, "not_found");
  const { data: rows } = await ctx.supabase
    .from("businesses")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });
  const { data: profileFull } = await ctx.supabase
    .from("profiles")
    .select("id,nickname,photo_data")
    .eq("id", profile.id)
    .maybeSingle();
  const items = (rows ?? []).map((r) => publicBusiness(r, profileFull));
  return ok({ items });
}

async function businessesCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("id,status")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!profile || profile.status !== "verified") return fail(403, "profile_not_verified");
  const { body } = ctx;
  const businessType = text(body.businessType, 60);
  if (!BUSINESS_TYPES.includes(businessType)) return fail(400, "invalid_business_type");
  const title = text(body.title, 120);
  if (title.length < 3) return fail(400, "invalid_title");
  const capitalNeeded = intOrNull(body.capitalNeeded, 0, 100000000000);
  if (capitalNeeded === null) return fail(400, "invalid_capital");
  const description = textOrNull(body.description, 2000);
  const proposal = textOrNull(body.proposal, 10000);
  const rabInput = Array.isArray(body.rabItems) ? body.rabItems : [];
  const rabItems = rabInput.slice(0, 50).map((item) => {
    const desc = text(item.description, 200);
    const quantity = intOrNull(item.quantity, 1, 100000) ?? 1;
    const unit = text(item.unit, 40);
    const unitPrice = intOrNull(item.unitPrice, 0, 100000000000) ?? 0;
    return { description: desc, quantity, unit, unitPrice, total: quantity * unitPrice };
  });
  const id = crypto.randomUUID();
  const ts = now();
  const { error: bizError } = await ctx.supabase.from("businesses").insert({
    id,
    profile_id: profile.id,
    business_type: businessType,
    title,
    description,
    proposal,
    capital_needed: capitalNeeded,
    status: "pending",
    created_at: ts,
    updated_at: ts,
  });
  if (bizError) return fail(500, "server_error");
  if (rabItems.length) {
    const { error: rabError } = await ctx.supabase.from("business_rab").insert(
      rabItems.map((item) => ({
        id: crypto.randomUUID(),
        business_id: id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unitPrice,
        total: item.total,
        created_at: ts,
      })),
    );
    if (rabError) return fail(500, "server_error");
  }
  const { data: row } = await ctx.supabase.from("businesses").select("*").eq("id", id).maybeSingle();
  const { data: profileFull } = await ctx.supabase
    .from("profiles")
    .select("id,nickname,photo_data")
    .eq("id", profile.id)
    .maybeSingle();
  const { data: rabRows } = await ctx.supabase
    .from("business_rab")
    .select("*")
    .eq("business_id", id)
    .order("created_at", { ascending: true });
  return ok({ business: publicBusinessDetail(row, profileFull, rabRows) });
}

async function businessesUpdate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("id,status")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!profile || profile.status !== "verified") return fail(403, "profile_not_verified");
  const id = text(ctx.body.id, 60);
  if (!id) return fail(400, "invalid_input");
  const { data: existing } = await ctx.supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!existing) return fail(404, "not_found");
  const { body } = ctx;
  const patch = { updated_at: now() };
  if (body.businessType !== undefined) {
    const businessType = text(body.businessType, 60);
    if (!BUSINESS_TYPES.includes(businessType)) return fail(400, "invalid_business_type");
    patch.business_type = businessType;
  }
  if (body.title !== undefined) {
    const title = text(body.title, 120);
    if (title.length < 3) return fail(400, "invalid_title");
    patch.title = title;
  }
  if (body.description !== undefined) patch.description = textOrNull(body.description, 2000);
  if (body.proposal !== undefined) patch.proposal = textOrNull(body.proposal, 10000);
  if (body.capitalNeeded !== undefined) {
    const capitalNeeded = intOrNull(body.capitalNeeded, 0, 100000000000);
    if (capitalNeeded === null) return fail(400, "invalid_capital");
    patch.capital_needed = capitalNeeded;
  }
  if (existing.status === "rejected") {
    patch.status = "pending";
    patch.reject_reason = null;
  }
  const { error } = await ctx.supabase.from("businesses").update(patch).eq("id", id);
  if (error) return fail(500, "server_error");
  if (body.rabItems !== undefined && Array.isArray(body.rabItems)) {
    await ctx.supabase.from("business_rab").delete().eq("business_id", id);
    const rabInput = body.rabItems.slice(0, 50);
    if (rabInput.length) {
      const ts = now();
      const rabItems = rabInput.map((item) => {
        const desc = text(item.description, 200);
        const quantity = intOrNull(item.quantity, 1, 100000) ?? 1;
        const unit = text(item.unit, 40);
        const unitPrice = intOrNull(item.unitPrice, 0, 100000000000) ?? 0;
        return {
          id: crypto.randomUUID(),
          business_id: id,
          description: desc,
          quantity,
          unit,
          unit_price: unitPrice,
          total: quantity * unitPrice,
          created_at: ts,
        };
      });
      const { error: rabError } = await ctx.supabase.from("business_rab").insert(rabItems);
      if (rabError) return fail(500, "server_error");
    }
  }
  const { data: row } = await ctx.supabase.from("businesses").select("*").eq("id", id).maybeSingle();
  const { data: profileFull } = await ctx.supabase
    .from("profiles")
    .select("id,nickname,photo_data")
    .eq("id", profile.id)
    .maybeSingle();
  const { data: rabRows } = await ctx.supabase
    .from("business_rab")
    .select("*")
    .eq("business_id", id)
    .order("created_at", { ascending: true });
  return ok({ business: publicBusinessDetail(row, profileFull, rabRows) });
}

// ---------- marketplace ----------

const LISTING_KINDS = ["barang", "jasa"];
const LISTING_CATEGORIES = [
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

function publicListing(row, profile) {
  return {
    id: row.id,
    sellerProfileId: row.seller_profile_id,
    sellerName: profile?.nickname ?? "Anggota",
    sellerPhoto: profile?.photo_data ?? null,
    sellerCity: profile?.city ?? null,
    kind: row.kind,
    title: row.title,
    description: row.description ?? null,
    price: row.price ?? null,
    category: row.category,
    status: row.status ?? "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function marketplaceList(ctx) {
  const kind = text(ctx.body.kind, 10);
  const category = text(ctx.body.category, 60);
  let query = ctx.supabase
    .from("marketplace_listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);
  const { data: rows } = await query;
  const profileIds = [...new Set((rows ?? []).map((r) => r.seller_profile_id))];
  const profilesMap = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id,nickname,photo_data,city")
      .in("id", profileIds);
    for (const p of profiles ?? []) profilesMap[p.id] = p;
  }
  let items = (rows ?? []).map((r) => publicListing(r, profilesMap[r.seller_profile_id]));
  if (kind && LISTING_KINDS.includes(kind)) items = items.filter((i) => i.kind === kind);
  if (category) items = items.filter((i) => i.category === category);
  return ok({ items });
}

async function marketplaceGet(ctx) {
  const id = text(ctx.body.id, 60);
  if (!id) return fail(400, "invalid_input");
  const { data: row } = await ctx.supabase.from("marketplace_listings").select("*").eq("id", id).maybeSingle();
  if (!row) return fail(404, "not_found");
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("id,nickname,photo_data,city,whatsapp")
    .eq("id", row.seller_profile_id)
    .maybeSingle();
  return ok({ listing: publicListing(row, profile), sellerWhatsapp: profile?.whatsapp ?? null });
}

async function marketplaceCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profile = await ownProfile(ctx.supabase, auth.account.id);
  if (!profile) return fail(404, "profile_not_found");
  if (profile.status !== "verified") return fail(403, "profile_not_verified");
  const kind = text(ctx.body.kind, 10);
  if (!LISTING_KINDS.includes(kind)) return fail(400, "invalid_kind");
  const category = text(ctx.body.category, 60);
  if (!LISTING_CATEGORIES.includes(category)) return fail(400, "invalid_category");
  const title = text(ctx.body.title, 120);
  if (title.length < 3) return fail(400, "invalid_title");
  const price = ctx.body.price !== null && ctx.body.price !== undefined && ctx.body.price !== ""
    ? Math.round(Number(ctx.body.price))
    : null;
  if (price !== null && (isNaN(price) || price < 0)) return fail(400, "invalid_price");
  const { data: row, error } = await ctx.supabase.from("marketplace_listings").insert({
    id: crypto.randomUUID(),
    seller_profile_id: profile.id,
    kind,
    title,
    description: textOrNull(ctx.body.description, 2000),
    price,
    category,
    status: "active",
    created_at: now(),
    updated_at: now(),
  }).select("*").maybeSingle();
  if (error) return fail(500, "server_error");
  return ok({ listing: publicListing(row, profile) });
}

async function marketplaceMine(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profile = await ownProfile(ctx.supabase, auth.account.id);
  if (!profile) return fail(404, "profile_not_found");
  const { data: rows } = await ctx.supabase
    .from("marketplace_listings")
    .select("*")
    .eq("seller_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return ok({ items: (rows ?? []).map((r) => publicListing(r, profile)) });
}

async function marketplaceUpdate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profile = await ownProfile(ctx.supabase, auth.account.id);
  if (!profile) return fail(404, "profile_not_found");
  const id = text(ctx.body.id, 60);
  if (!id) return fail(400, "invalid_input");
  const { data: existing } = await ctx.supabase
    .from("marketplace_listings")
    .select("id,seller_profile_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.seller_profile_id !== profile.id) return fail(404, "not_found");
  const updates = { updated_at: now() };
  if (ctx.body.title !== undefined) {
    const title = text(ctx.body.title, 120);
    if (title.length < 3) return fail(400, "invalid_title");
    updates.title = title;
  }
  if (ctx.body.description !== undefined) updates.description = textOrNull(ctx.body.description, 2000);
  if (ctx.body.price !== undefined) {
    const price = ctx.body.price !== null && ctx.body.price !== "" ? Math.round(Number(ctx.body.price)) : null;
    if (price !== null && (isNaN(price) || price < 0)) return fail(400, "invalid_price");
    updates.price = price;
  }
  if (ctx.body.status !== undefined) {
    const status = text(ctx.body.status, 20);
    if (["active", "sold", "archived", "draft"].includes(status)) updates.status = status;
  }
  await ctx.supabase.from("marketplace_listings").update(updates).eq("id", id);
  const { data: row } = await ctx.supabase.from("marketplace_listings").select("*").eq("id", id).maybeSingle();
  return ok({ listing: publicListing(row, profile) });
}

// ---------- subscriptions ----------

const SUBSCRIPTION_TIERS = ["sosialita", "high_society", "the_ceo"];

function getSubscriptionPrice(tier) {
  return APP_SETTINGS.subscription.prices[tier] ?? 0;
}

function publicSubscription(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    tier: row.tier,
    status: row.status,
    monthlyAmount: row.monthly_amount,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    cancelledAt: row.cancelled_at ?? null,
    orderId: row.order_id ?? null,
    createdAt: row.created_at,
  };
}

// ---------- finance ----------

async function financeSummary(ctx) {
  const auth = await actor(ctx, 6);
  if (auth.error) return auth.error;
  const { supabase } = ctx;
  const period = text(ctx.body.period, 20) || "month";

  let daysBack = 30;
  if (period === "week") daysBack = 7;
  else if (period === "year") daysBack = 365;

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const [donations, subscriptions, campaigns] = await Promise.all([
    supabase.from("donations").select("amount").eq("status", "settled").gte("created_at", since),
    supabase.from("subscriptions").select("monthly_amount").eq("status", "active").gte("created_at", since),
    supabase.from("campaign_donations").select("amount").eq("status", "settled").gte("created_at", since),
  ]);

  const totalDonations = (donations.data ?? []).reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalSubscriptions = (subscriptions.data ?? []).reduce((sum, s) => sum + (s.monthly_amount || 0), 0);
  const totalCampaigns = (campaigns.data ?? []).reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalRevenue = totalDonations + totalSubscriptions + totalCampaigns;

  const [recentDonations, recentSubscriptions, recentCampaigns] = await Promise.all([
    supabase
      .from("donations")
      .select("id, amount, status, created_at, accounts!inner(display_name)")
      .eq("status", "settled")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("subscriptions")
      .select("id, monthly_amount, tier, status, created_at, accounts!inner(display_name)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("campaign_donations")
      .select("id, amount, status, created_at, accounts!inner(display_name), campaigns!inner(title)")
      .eq("status", "settled")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const recentTransactions = [
    ...(recentDonations.data ?? []).map((d) => ({
      id: d.id,
      type: "donation",
      amount: d.amount,
      status: d.status,
      createdAt: d.created_at,
      userDisplayName: d.accounts.display_name || "Anonim",
      description: "Donasi platform",
    })),
    ...(recentSubscriptions.data ?? []).map((s) => ({
      id: s.id,
      type: "subscription",
      amount: s.monthly_amount,
      status: s.status,
      createdAt: s.created_at,
      userDisplayName: s.accounts.display_name || "Anonim",
      description: `Langganan ${s.tier}`,
    })),
    ...(recentCampaigns.data ?? []).map((c) => ({
      id: c.id,
      type: "campaign",
      amount: c.amount,
      status: c.status,
      createdAt: c.created_at,
      userDisplayName: c.accounts.display_name || "Anonim",
      description: `Donasi: ${c.campaigns.title}`,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  return ok({
    totalDonations,
    totalSubscriptions,
    totalCampaigns,
    totalRevenue,
    recentTransactions,
  });
}

// ---------- ai mentor ----------

async function aiMentorChat(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const message = text(ctx.body.message, 1000);
  if (!message) return fail(400, "invalid_input");

  const lower = message.toLowerCase();
  let reply = "";

  if (lower.includes("kuliner") || lower.includes("makanan")) {
    reply = "Untuk memulai usaha kuliner dari rumah, Anda bisa mulai dengan:\n\n1. Tentukan menu andalan yang unik dan diminati pasar\n2. Mulai dari skala kecil, terima pesanan dari tetangga atau media sosial\n3. Urus izin PIRT (Pangan Industri Rumah Tangga) untuk legalitas\n4. Manfaatkan platform ojek online untuk memperluas jangkauan\n5. Jaga kualitas dan konsistensi rasa\n\nApakah ada aspek spesifik yang ingin Anda tanyakan lebih lanjut?";
  } else if (lower.includes("proposal")) {
    reply = "Proposal bisnis yang baik harus mencakup:\n\n1. Ringkasan Eksekutif — gambaran umum bisnis Anda\n2. Latar Belakang — mengapa bisnis ini penting\n3. Visi & Misi — arah jangka panjang\n4. Analisis Pasar — target konsumen dan kompetitor\n5. Rencana Pemasaran — strategi promosi\n6. Rencana Operasional — bagaimana bisnis berjalan\n7. Proyeksi Keuangan — estimasi pendapatan dan biaya\n8. RAB — rincian anggaran yang dibutuhkan\n\nSaya bisa membantu Anda menyusun salah satu bagian tersebut.";
  } else if (lower.includes("rab") || lower.includes("anggaran")) {
    reply = "RAB (Rencana Anggaran Biaya) yang baik harus detail dan realistis. Komponen utamanya:\n\n1. Biaya Investasi — peralatan, renovasi, deposit\n2. Biaya Operasional Tetap — sewa, gaji, listrik\n3. Biaya Operasional Variabel — bahan baku, kemasan, transportasi\n4. Biaya Pemasaran — iklan, promosi, sampling\n5. Dana Cadangan — 10-15% dari total anggaran\n\nTips: Selalu tambahkan buffer 10-15% untuk biaya tak terduga. Mau saya bantu hitungkan untuk jenis usaha tertentu?";
  } else if (lower.includes("keuangan") || lower.includes("uang")) {
    reply = "Mengelola keuangan usaha untuk pemula:\n\n1. Pisahkan rekening pribadi dan usaha — ini wajib!\n2. Catat semua transaksi, sekecil apapun\n3. Buat laporan laba rugi sederhana setiap bulan\n4. Sisihkan minimal 20% laba untuk dana darurat\n5. Tentukan gaji sendiri, jangan campur dengan laba usaha\n6. Gunakan aplikasi akuntansi sederhana atau spreadsheet\n\nKonsistensi mencatat adalah kunci. Sudah punya sistem pencatatan?";
  } else if (lower.includes("pemasaran") || lower.includes("marketing") || lower.includes("promosi")) {
    reply = "Strategi pemasaran digital untuk UMKM:\n\n1. Media Sosial — Instagram, TikTok, Facebook (pilih yang sesuai target pasar)\n2. Google Bisnisku — gratis dan muncul di pencarian lokal\n3. Content Marketing — bagikan tips, behind the scene, testimoni\n4. Kolaborasi — kerja sama dengan influencer lokal atau UMKM lain\n5. Promo Pembukaan — diskon, buy 1 get 1, atau sampling gratis\n6. WhatsApp Business — untuk komunikasi langsung dengan pelanggan\n\nMulai dari 1-2 channel dulu, kuatkan di sana sebelum ekspansi. Platform apa yang sudah Anda coba?";
  } else if (lower.includes("modal") || lower.includes("dana")) {
    reply = "Opsi pendanaan untuk usaha:\n\n1. Tabungan Pribadi — paling aman, tidak ada beban utang\n2. Keluarga/Teman — pastikan ada perjanjian tertulis\n3. Kredit Usaha Rakyat (KUR) — bunga rendah dari pemerintah\n4. Peer-to-Peer Lending — platform fintech resmi\n5. Investor — untuk usaha yang scalable\n6. Galang Dana — bisa lewat platform crowdfunding\n\nTips: Mulai dari modal seadanya, buktikan konsep bisnis dulu, baru cari pendanaan lebih besar. Berapa estimasi modal yang Anda butuhkan?";
  } else {
    reply = "Terima kasih atas pertanyaannya! Sebagai AI Mentor, saya bisa membantu Anda dengan:\n\n• Perencanaan bisnis dan penyusunan proposal\n• Penyusunan RAB (Rencana Anggaran Biaya)\n• Strategi pemasaran digital\n• Pengelolaan keuangan usaha\n• Tips memulai usaha dari rumah\n• Akses pendanaan dan modal\n\nCoba tanyakan hal yang lebih spesifik, misalnya:\n- \"Bagaimana cara membuat proposal bisnis?\"\n- \"Tips pemasaran digital untuk UMKM\"\n- \"Cara mengelola keuangan usaha\"\n\nApa yang ingin Anda ketahui lebih lanjut?";
  }

  return ok({ reply });
}

async function subscriptionsCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const tier = text(ctx.body.tier, 30);
  if (!SUBSCRIPTION_TIERS.includes(tier)) return fail(400, "invalid_tier");
  const serverKey = ctx.env("MIDTRANS_SERVER_KEY");
  if (!serverKey) return fail(503, "service_not_configured");
  const amount = getSubscriptionPrice(tier);
  if (amount <= 0) return fail(503, "service_not_configured");
  const { data: existing } = await ctx.supabase
    .from("subscriptions")
    .select("id,status")
    .eq("account_id", auth.account.id)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return fail(409, "already_subscribed");
  const orderId = `PJS-${Date.now()}-${b64url(crypto.getRandomValues(new Uint8Array(4)))}`;
  const base = ctx.env("MIDTRANS_ENV") === "production"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
  const tierLabel = tier === "the_ceo" ? "The CEO" : tier === "high_society" ? "High Society" : "Sosialita";
  let redirectUrl = null;
  let gatewayError = false;
  try {
    const response = await safeFetch(`${base}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Basic ${b64(enc.encode(`${serverKey}:`))}`,
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: `sub-${tier}`, price: amount, quantity: 1, name: `Langganan ${tierLabel}` }],
        customer_details: {
          first_name: auth.account.display_name?.slice(0, 50) ?? "Anggota",
          email: auth.account.email ?? undefined,
        },
      }),
    });
    const payload = await response.json().catch(() => null);
    redirectUrl = typeof payload?.redirect_url === "string" ? payload.redirect_url : null;
    if (!response.ok || !redirectUrl) gatewayError = true;
  } catch {
    gatewayError = true;
  }
  if (gatewayError) return fail(502, "gateway_error");
  const { error } = await ctx.supabase.from("subscriptions").insert({
    id: crypto.randomUUID(),
    account_id: auth.account.id,
    tier,
    status: "pending",
    monthly_amount: amount,
    started_at: null,
    expires_at: null,
    cancelled_at: null,
    order_id: orderId,
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  return ok({ redirectUrl, orderId });
}

async function subscriptionsMine(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: rows } = await ctx.supabase
    .from("subscriptions")
    .select("*")
    .eq("account_id", auth.account.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const items = (rows ?? []).map(publicSubscription);
  const active = items.find((s) => s.status === "active") ?? null;
  return ok({ items, active });
}

async function subscriptionsCancel(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const subId = text(ctx.body.subscriptionId, 60);
  if (!subId) return fail(400, "invalid_input");
  const { data: sub } = await ctx.supabase
    .from("subscriptions")
    .select("id,account_id,status,tier")
    .eq("id", subId)
    .maybeSingle();
  if (!sub || sub.account_id !== auth.account.id) return fail(404, "not_found");
  if (sub.status !== "active") return fail(400, "not_active");
  await ctx.supabase
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: now() })
    .eq("id", subId);
  return ok({ cancelled: true });
}

async function subscriptionsPrices(ctx) {
  return ok({ prices: APP_SETTINGS.subscription.prices });
}

async function academySettings(ctx) {
  return ok({ academy: APP_SETTINGS.academy });
}

async function tradingSettings(ctx) {
  return ok({ trading: APP_SETTINGS.trading });
}

async function linksSettings(ctx) {
  return ok({ links: APP_SETTINGS.links });
}

async function liveTradingSettings(ctx) {
  return ok({ liveTrading: APP_SETTINGS.liveTrading });
}

async function metaTrader5Settings(ctx) {
  return ok({ metaTrader5: APP_SETTINGS.metaTrader5 });
}

async function aiTradingAgentSettings(ctx) {
  return ok({ aiTradingAgent: APP_SETTINGS.aiTradingAgent });
}

async function coinSettingsPublic(ctx) {
  return ok({ coinSettings: APP_SETTINGS.coinSettings });
}

// ---------- entry ----------

export async function handleApp({ request, supabase }) {
  try {
    if (request.method !== "POST") return fail(405, "method_not_allowed");
    let body = null;
    try {
      body = await request.json();
    } catch {
      return fail(400, "invalid_json");
    }
    if (!body || typeof body !== "object") return fail(400, "invalid_json");
    const ctx = { request, supabase, env: readEnv, body, _actor: undefined };
    if (typeof body.signature_key === "string" && typeof body.order_id === "string") {
      return await midtransNotification(ctx);
    }
    const action = typeof body.action === "string" ? body.action : "";
    const run = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : null;
    if (!run) return fail(400, "invalid_action");
    return await run(ctx);
  } catch {
    return fail(500, "server_error");
  }
}

// Network calls must never hang the Function.
async function safeFetch(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

export const __internals = { hashPassword, verifyPassword, sha256Hex, sha512Hex };
