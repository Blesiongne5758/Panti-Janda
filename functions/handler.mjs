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
const EVENT_ASSIGNABLE_ROLES = ["sekretaris", "bendahara", "koordinator_acara", "absen_tiket", "absen_undangan", "publikasi", "logistik", "panitia"];
const INVITE_QR_PREFIX = "PJ-INVITE:";
const EVENT_CATEGORIES = ["workshop", "webinar", "meetup", "concert", "charity", "conference", "garage_sale", "lelang", "bazar", "nobar", "other"];
const EVENT_LOCATION_TYPES = ["physical", "virtual", "hybrid"];
const VIRTUAL_PLATFORMS = ["zoom", "google_meet", "internal"];
const BUDGET_CATEGORIES = ["VENUE", "EQUIPMENT", "TALENT", "CATERING", "MARKETING", "TRANSPORTATION", "PERMIT", "PRODUCTION", "DOCUMENTATION", "STAFF", "CONTINGENCY", "OTHER"];
const FUNDING_SOURCE_TYPES = ["SELF_FUNDED", "TICKET_SALES", "SPONSORSHIP", "PLATFORM_FUND", "DONATION"];
const CHECKLIST_STATUSES = ["pending", "in_progress", "done"];
const EVENT_EXPENSE_APPROVAL_THRESHOLD = 1_000_000;
const EVENT_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];
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
  esport_tournament_create: 60,
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

function tierFromLevel(level) {
  if (level >= 46) return "the_ceo";
  if (level >= 36) return "high_society";
  if (level >= 21) return "sosialita";
  return "wonder_woman";
}

function publicBadgeFromLevel(level) {
  if (level >= 50) return "presiden";
  if (level >= 45) return "panglima";
  if (level >= 35) return "gubernur";
  if (level >= 25) return "walikota";
  if (level >= 15) return "kades";
  return null;
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
  const { data: account } = await supabase
    .from("accounts")
    .select("id,role,level,xp")
    .eq("id", accountId)
    .maybeSingle();
  // Progresi level/poin hanya naik — hadiah KPI tidak boleh menurunkan capaian akun.
  const nextXp = Math.max(totalPoints, Number(account?.xp ?? 0));
  const nextLevel = Math.max(levelFromXp(nextXp), Number(account?.level ?? 1));
  const existing = await isEnrolled(supabase, "kpi_summary", "account_id", "account_id", accountId);
  if (existing) {
    await supabase.from("kpi_summary").update({ total_points: nextXp, level: nextLevel, updated_at: now() }).eq("account_id", accountId);
  } else {
    await supabase.from("kpi_summary").insert({
      account_id: accountId,
      total_points: nextXp,
      level: nextLevel,
      updated_at: now(),
    });
  }
  if (account) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("account_id", accountId)
      .maybeSingle();
    const isJanda = Boolean(profile);
    const suggestedRole = roleFromLevel(nextLevel, isJanda);
    const patch = { level: nextLevel, xp: nextXp };
    if ((ROLE_RANK[suggestedRole] ?? 0) > (ROLE_RANK[account.role] ?? 0)) {
      patch.role = suggestedRole;
    }
    await supabase
      .from("accounts")
      .update(patch)
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

// ---------- learning center ----------

const LEARNING_CATEGORIES = ["umum", "bisnis", "digital", "keuangan", "hukum", "keterampilan", "kepemimpinan"];
const JOB_TYPES = ["freelance", "part_time", "full_time", "magang", "remote"];
const COUNSELOR_TYPES = ["psychologist", "legal", "spiritual", "career"];
const SESSION_TYPES = ["free", "premium"];
const FORUM_STATUSES = ["active", "archived"];

function learningModulePublic(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    description: row.description,
    durationMinutes: row.duration_minutes,
    totalLessons: row.total_lessons,
    icon: row.icon ?? null,
    color: row.color ?? null,
    bgColor: row.bg_color ?? null,
    monetizable: row.monetizable ?? false,
    downloadable: row.downloadable ?? true,
    status: row.status,
    createdAt: row.created_at,
  };
}

function lessonPublic(row) {
  return {
    id: row.id,
    moduleId: row.module_id,
    position: row.position,
    title: row.title,
    description: row.description,
    contentType: row.content_type,
    contentUrl: row.content_url ?? null,
    durationSeconds: row.duration_seconds,
    downloadable: row.downloadable ?? true,
    status: row.status,
  };
}

async function learningModulesList(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const category = text(ctx.body.category, 30) || null;
  const { data } = await ctx.supabase.from("learning_modules").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(60);
  const rows = (data ?? []).filter((r) => !category || r.category === category);
  const progressMap = new Map();
  if (account && rows.length) {
    const moduleIds = rows.map((r) => r.id);
    const { data: progressRows } = await ctx.supabase
      .from("learning_progress")
      .select("module_id,status")
      .eq("account_id", account.id)
      .in("module_id", moduleIds);
    for (const p of progressRows ?? []) {
      if (!progressMap.has(p.module_id)) progressMap.set(p.module_id, { completed: 0, total: 0 });
      const entry = progressMap.get(p.module_id);
      entry.total += 1;
      if (p.status === "completed") entry.completed += 1;
    }
  }
  return ok({
    items: rows.map((row) => ({
      ...learningModulePublic(row),
      progress: account ? progressMap.get(row.id) ?? null : null,
    })),
  });
}

async function learningModulesGet(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const slug = text(ctx.body.slug, 100);
  const id = text(ctx.body.id, 60);
  let moduleRow = null;
  if (slug) {
    const { data } = await ctx.supabase.from("learning_modules").select("*").eq("slug", slug).eq("status", "active").maybeSingle();
    moduleRow = data;
  } else if (id) {
    const { data } = await ctx.supabase.from("learning_modules").select("*").eq("id", id).eq("status", "active").maybeSingle();
    moduleRow = data;
  }
  if (!moduleRow) return fail(404, "not_found");
  const { data: lessons } = await ctx.supabase
    .from("learning_lessons")
    .select("*")
    .eq("module_id", moduleRow.id)
    .eq("status", "active")
    .order("position", { ascending: true });
  let progressRows = [];
  if (account) {
    const { data: p } = await ctx.supabase
      .from("learning_progress")
      .select("lesson_id,status,completed_at,time_spent_seconds")
      .eq("account_id", account.id)
      .eq("module_id", moduleRow.id);
    progressRows = p ?? [];
  }
  const progressByLesson = new Map(progressRows.map((p) => [p.lesson_id, p]));
  return ok({
    module: learningModulePublic(moduleRow),
    lessons: (lessons ?? []).map((l) => ({
      ...lessonPublic(l),
      progress: progressByLesson.get(l.id) ?? null,
    })),
  });
}

async function learningProgressUpdate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const lessonId = text(ctx.body.lessonId, 60);
  const moduleId = text(ctx.body.moduleId, 60);
  const status = ctx.body.status === "completed" ? "completed" : "in_progress";
  const timeSpent = intOrNull(ctx.body.timeSpentSeconds, 0, 999999) ?? 0;
  if (!lessonId || !moduleId) return fail(400, "invalid_input");
  const { data: existing } = await ctx.supabase
    .from("learning_progress")
    .select("*")
    .eq("account_id", auth.account.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (existing) {
    const patch = { status, time_spent_seconds: Math.max(existing.time_spent_seconds, timeSpent) };
    if (status === "completed" && existing.status !== "completed") patch.completed_at = now();
    await ctx.supabase.from("learning_progress").update(patch).eq("id", existing.id);
  } else {
    await ctx.supabase.from("learning_progress").insert({
      id: crypto.randomUUID(),
      account_id: auth.account.id,
      module_id: moduleId,
      lesson_id: lessonId,
      status,
      completed_at: status === "completed" ? now() : null,
      time_spent_seconds: timeSpent,
      created_at: now(),
    });
  }
  if (status === "completed") {
    await ctx.supabase.from("accounts").update({ xp: auth.account.xp + 10 }).eq("id", auth.account.id);
  }
  return ok({ updated: true });
}

async function learningProgressGet(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const moduleId = text(ctx.body.moduleId, 60);
  if (!moduleId) return fail(400, "invalid_input");
  const { data } = await ctx.supabase
    .from("learning_progress")
    .select("*")
    .eq("account_id", auth.account.id)
    .eq("module_id", moduleId);
  return ok({
    items: (data ?? []).map((p) => ({
      id: p.id,
      lessonId: p.lesson_id,
      moduleId: p.module_id,
      status: p.status,
      completedAt: p.completed_at,
      timeSpentSeconds: p.time_spent_seconds,
    })),
  });
}

async function learningDownloadsTrack(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const lessonId = text(ctx.body.lessonId, 60);
  if (!lessonId) return fail(400, "invalid_input");
  const { data: existing } = await ctx.supabase
    .from("learning_downloads")
    .select("*")
    .eq("account_id", auth.account.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (existing) return ok({ downloaded: true, downloadedAt: existing.downloaded_at });
  await ctx.supabase.from("learning_downloads").insert({
    id: crypto.randomUUID(),
    account_id: auth.account.id,
    lesson_id: lessonId,
    file_path: textOrNull(ctx.body.filePath, 500),
    file_size_bytes: intOrNull(ctx.body.fileSizeBytes, 0, 999999999) ?? 0,
    downloaded_at: now(),
  });
  return ok({ downloaded: true });
}

async function learningPodcastsList(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const category = text(ctx.body.category, 30) || null;
  const { data } = await ctx.supabase
    .from("podcasts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);
  const rows = (data ?? []).filter((r) => !category || r.category === category);
  const playMap = new Map();
  if (account && rows.length) {
    const { data: plays } = await ctx.supabase
      .from("podcast_plays")
      .select("podcast_id,played_seconds,completed,last_played_at")
      .eq("account_id", account.id);
    for (const p of plays ?? []) playMap.set(p.podcast_id, p);
  }
  return ok({
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      hostName: row.host_name,
      durationSeconds: row.duration_seconds,
      category: row.category,
      downloadable: row.downloadable,
      play: playMap.get(row.id) ?? null,
      createdAt: row.created_at,
    })),
  });
}

async function learningPodcastsPlay(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const podcastId = text(ctx.body.podcastId, 60);
  const playedSeconds = intOrNull(ctx.body.playedSeconds, 0, 999999) ?? 0;
  if (!podcastId) return fail(400, "invalid_input");
  const { data: existing } = await ctx.supabase
    .from("podcast_plays")
    .select("*")
    .eq("account_id", auth.account.id)
    .eq("podcast_id", podcastId)
    .maybeSingle();
  const completed = playedSeconds > 60;
  if (existing) {
    await ctx.supabase
      .from("podcast_plays")
      .update({
        played_seconds: Math.max(existing.played_seconds, playedSeconds),
        completed: existing.completed || completed,
        last_played_at: now(),
      })
      .eq("id", existing.id);
  } else {
    await ctx.supabase.from("podcast_plays").insert({
      id: crypto.randomUUID(),
      account_id: auth.account.id,
      podcast_id: podcastId,
      played_seconds: playedSeconds,
      completed,
      last_played_at: now(),
    });
  }
  return ok({ updated: true });
}

async function learningStoriesList(ctx) {
  const auth = await actor(ctx, 0);
  const { data } = await ctx.supabase
    .from("success_stories")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(40);
  const profileIds = (data ?? []).map((r) => r.profile_id);
  const uniqueIds = [...new Set(profileIds)];
  const profileMap = new Map();
  if (uniqueIds.length) {
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id,nickname,tier,photo_data,account_id")
      .in("id", uniqueIds);
    for (const p of profiles ?? []) profileMap.set(p.id, p);
  }
  return ok({
    items: (data ?? []).map((row) => {
      const profile = profileMap.get(row.profile_id);
      return {
        id: row.id,
        title: row.title,
        story: row.story,
        achievement: row.achievement,
        photoData: row.photo_data ?? null,
        featured: row.featured,
        authorName: profile?.nickname ?? null,
        authorTier: profile?.tier ?? null,
        authorPhoto: profile?.photo_data ?? null,
        createdAt: row.created_at,
      };
    }),
  });
}

async function learningStoriesCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const title = text(ctx.body.title, 200);
  const story = text(ctx.body.story, 5000);
  if (title.length < 3 || story.length < 10) return fail(400, "invalid_input");
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("id")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!profile) return fail(400, "no_profile");
  const row = {
    id: crypto.randomUUID(),
    profile_id: profile.id,
    title,
    story,
    achievement: textOrNull(ctx.body.achievement, 500),
    photo_data: textOrNull(ctx.body.photoData, MAX_DOC_CHARS),
    featured: false,
    status: "active",
    created_at: now(),
    updated_at: now(),
  };
  const { error } = await ctx.supabase.from("success_stories").insert(row);
  if (error) return fail(500, "server_error");
  return ok({ story: { id: row.id, title: row.title, createdAt: row.created_at } });
}

async function learningForumCategories(ctx) {
  const auth = await actor(ctx, 0);
  const { data } = await ctx.supabase
    .from("forum_categories")
    .select("*")
    .eq("status", "active")
    .order("position", { ascending: true });
  return ok({
    items: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      icon: row.icon ?? null,
      color: row.color ?? null,
      isPrivate: row.is_private,
      moderated: row.moderated,
    })),
  });
}

async function learningForumTopicsList(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const categoryId = text(ctx.body.categoryId, 60) || null;
  let query = ctx.supabase
    .from("forum_topics")
    .select("*")
    .eq("status", "active")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  const { data } = await query;
  const rows = (data ?? []).filter((r) => !categoryId || r.category_id === categoryId);
  const topicIds = rows.map((r) => r.id);
  const postCounts = new Map();
  if (topicIds.length) {
    const { data: posts } = await ctx.supabase
      .from("forum_posts")
      .select("topic_id")
      .eq("status", "active")
      .in("topic_id", topicIds);
    for (const p of posts ?? []) postCounts.set(p.topic_id, (postCounts.get(p.topic_id) ?? 0) + 1);
  }
  const authorNames = await namesFor(ctx.supabase, rows.map((r) => r.author_id));
  return ok({
    items: rows.map((row) => {
      const displayName = row.is_anonymous
        ? row.display_name || "Anonim"
        : authorNames.get(row.author_id)?.nickname ?? authorNames.get(row.author_id)?.displayName ?? "Anggota";
      return {
        id: row.id,
        categoryId: row.category_id,
        title: row.title,
        body: row.body,
        isAnonymous: row.is_anonymous,
        displayName,
        pinned: row.pinned,
        locked: row.locked,
        viewCount: row.view_count,
        postCount: postCounts.get(row.id) ?? 0,
        createdAt: row.created_at,
      };
    }),
  });
}

async function learningForumTopicsGet(ctx) {
  const auth = await actor(ctx, 0);
  const topicId = text(ctx.body.topicId, 60);
  if (!topicId) return fail(400, "invalid_input");
  const { data: topic } = await ctx.supabase.from("forum_topics").select("*").eq("id", topicId).eq("status", "active").maybeSingle();
  if (!topic) return fail(404, "not_found");
  await ctx.supabase
    .from("forum_topics")
    .update({ view_count: (topic.view_count ?? 0) + 1 })
    .eq("id", topicId);
  const { data: posts } = await ctx.supabase
    .from("forum_posts")
    .select("*")
    .eq("topic_id", topicId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(100);
  const authorNames = await namesFor(ctx.supabase, (posts ?? []).map((p) => p.author_id));
  return ok({
    topic: {
      id: topic.id,
      title: topic.title,
      body: topic.body,
      isAnonymous: topic.is_anonymous,
      displayName: topic.is_anonymous ? topic.display_name || "Anonim" : topic.display_name,
      pinned: topic.pinned,
      locked: topic.locked,
      viewCount: topic.view_count + 1,
      createdAt: topic.created_at,
    },
    posts: (posts ?? []).map((p) => {
      const displayName = p.is_anonymous
        ? p.display_name || "Anonim"
        : authorNames.get(p.author_id)?.nickname ?? authorNames.get(p.author_id)?.displayName ?? "Anggota";
      return {
        id: p.id,
        body: p.body,
        isAnonymous: p.is_anonymous,
        displayName,
        parentPostId: p.parent_post_id ?? null,
        createdAt: p.created_at,
      };
    }),
  });
}

async function learningForumTopicsCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const categoryId = text(ctx.body.categoryId, 60);
  const title = text(ctx.body.title, 200);
  const body = text(ctx.body.body, 5000);
  if (!categoryId || title.length < 3 || body.length < 10) return fail(400, "invalid_input");
  const { data: category } = await ctx.supabase
    .from("forum_categories")
    .select("*")
    .eq("id", categoryId)
    .eq("status", "active")
    .maybeSingle();
  if (!category) return fail(404, "category_not_found");
  const isAnonymous = Boolean(ctx.body.isAnonymous);
  let displayName = null;
  if (isAnonymous) {
    const { data: anon } = await ctx.supabase
      .from("anonymous_profiles")
      .select("display_name")
      .eq("account_id", auth.account.id)
      .eq("is_active", true)
      .maybeSingle();
    displayName = anon?.display_name ?? `Anonim-${auth.account.id.slice(0, 6)}`;
  }
  const row = {
    id: crypto.randomUUID(),
    category_id: categoryId,
    author_id: auth.account.id,
    title,
    body,
    is_anonymous: isAnonymous,
    display_name: displayName,
    pinned: false,
    locked: false,
    status: "active",
    view_count: 0,
    created_at: now(),
    updated_at: now(),
  };
  const { error } = await ctx.supabase.from("forum_topics").insert(row);
  if (error) return fail(500, "server_error");
  return ok({ topic: { id: row.id, title: row.title, createdAt: row.created_at } });
}

async function learningForumPostsCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const topicId = text(ctx.body.topicId, 60);
  const body = text(ctx.body.body, 5000);
  if (!topicId || body.length < 3) return fail(400, "invalid_input");
  const { data: topic } = await ctx.supabase
    .from("forum_topics")
    .select("*")
    .eq("id", topicId)
    .eq("status", "active")
    .maybeSingle();
  if (!topic) return fail(404, "topic_not_found");
  if (topic.locked) return fail(403, "topic_locked");
  const isAnonymous = Boolean(ctx.body.isAnonymous);
  let displayName = null;
  if (isAnonymous) {
    const { data: anon } = await ctx.supabase
      .from("anonymous_profiles")
      .select("display_name")
      .eq("account_id", auth.account.id)
      .eq("is_active", true)
      .maybeSingle();
    displayName = anon?.display_name ?? `Anonim-${auth.account.id.slice(0, 6)}`;
  }
  const parentPostId = textOrNull(ctx.body.parentPostId, 60);
  const row = {
    id: crypto.randomUUID(),
    topic_id: topicId,
    author_id: auth.account.id,
    body,
    is_anonymous: isAnonymous,
    display_name: displayName,
    parent_post_id: parentPostId,
    status: "active",
    created_at: now(),
    updated_at: now(),
  };
  const { error } = await ctx.supabase.from("forum_posts").insert(row);
  if (error) return fail(500, "server_error");
  return ok({ post: { id: row.id, createdAt: row.created_at } });
}

async function learningMentoringList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("peer_mentoring")
    .select("*")
    .filter("mentor_id", "eq", auth.account.id)
    .limit(20);
  const { data: menteeData } = await ctx.supabase
    .from("peer_mentoring")
    .select("*")
    .filter("mentee_id", "eq", auth.account.id)
    .limit(20);
  const allRows = [...(data ?? []), ...(menteeData ?? [])];
  const names = await namesFor(
    ctx.supabase,
    allRows.flatMap((r) => [r.mentor_id, r.mentee_id]),
  );
  return ok({
    asMentor: (data ?? []).map((r) => ({
      id: r.id,
      menteeId: r.mentee_id,
      menteeName: names.get(r.mentee_id)?.nickname ?? names.get(r.mentee_id)?.displayName ?? null,
      status: r.status,
      matchedAt: r.matched_at,
      notes: r.notes,
    })),
    asMentee: (menteeData ?? []).map((r) => ({
      id: r.id,
      mentorId: r.mentor_id,
      mentorName: names.get(r.mentor_id)?.nickname ?? names.get(r.mentor_id)?.displayName ?? null,
      status: r.status,
      matchedAt: r.matched_at,
      notes: r.notes,
    })),
  });
}

async function learningMentoringRequest(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const mentorId = text(ctx.body.mentorId, 60);
  const notes = textOrNull(ctx.body.notes, 500);
  if (!mentorId) return fail(400, "invalid_input");
  if (mentorId === auth.account.id) return fail(400, "cannot_mentor_self");
  const { data: existing } = await ctx.supabase
    .from("peer_mentoring")
    .select("*")
    .eq("mentor_id", mentorId)
    .eq("mentee_id", auth.account.id)
    .maybeSingle();
  if (existing) return fail(409, "already_requested");
  await ctx.supabase.from("peer_mentoring").insert({
    id: crypto.randomUUID(),
    mentor_id: mentorId,
    mentee_id: auth.account.id,
    status: "pending",
    matched_at: now(),
    notes,
  });
  return ok({ requested: true });
}

async function learningCounselingList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("counseling_bookings")
    .select("*")
    .eq("account_id", auth.account.id)
    .order("scheduled_at", { ascending: false })
    .limit(30);
  return ok({
    items: (data ?? []).map((row) => ({
      id: row.id,
      counselorName: row.counselor_name,
      counselorType: row.counselor_type,
      sessionType: row.session_type,
      scheduledAt: row.scheduled_at,
      durationMinutes: row.duration_minutes,
      status: row.status,
      meetingUrl: row.meeting_url ?? null,
      amount: row.amount,
      createdAt: row.created_at,
    })),
  });
}

async function learningCounselingBook(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const counselorName = text(ctx.body.counselorName, 100);
  const counselorType = COUNSELOR_TYPES.includes(ctx.body.counselorType) ? ctx.body.counselorType : "psychologist";
  const sessionType = SESSION_TYPES.includes(ctx.body.sessionType) ? ctx.body.sessionType : "free";
  const scheduledAt = text(ctx.body.scheduledAt, 30);
  if (!counselorName || !scheduledAt) return fail(400, "invalid_input");
  const amount = sessionType === "premium" ? (intOrNull(ctx.body.amount, 0, 99999999) ?? 0) : 0;
  const row = {
    id: crypto.randomUUID(),
    account_id: auth.account.id,
    counselor_name: counselorName,
    counselor_type: counselorType,
    session_type: sessionType,
    scheduled_at: scheduledAt,
    duration_minutes: intOrNull(ctx.body.durationMinutes, 15, 180) ?? 60,
    status: "pending",
    notes: textOrNull(ctx.body.notes, 500),
    amount,
    created_at: now(),
  };
  const { error } = await ctx.supabase.from("counseling_bookings").insert(row);
  if (error) return fail(500, "server_error");
  return ok({ booking: { id: row.id, scheduledAt: row.scheduled_at, status: row.status } });
}

async function learningFinancialList(ctx) {
  const auth = await actor(ctx, 0);
  const { data } = await ctx.supabase
    .from("financial_modules")
    .select("*")
    .eq("status", "active")
    .order("position", { ascending: true })
    .limit(40);
  return ok({
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      contentType: row.content_type,
      description: row.description,
      body: row.body,
      toolData: row.tool_data ?? null,
      createdAt: row.created_at,
    })),
  });
}

async function learningLegalList(ctx) {
  const auth = await actor(ctx, 0);
  const { data } = await ctx.supabase
    .from("legal_modules")
    .select("*")
    .eq("status", "active")
    .order("position", { ascending: true })
    .limit(40);
  return ok({
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      contentType: row.content_type,
      description: row.description,
      body: row.body,
      createdAt: row.created_at,
    })),
  });
}

async function learningJobsList(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const jobType = text(ctx.body.jobType, 30) || null;
  const remote = ctx.body.remote;
  let { data } = await ctx.supabase
    .from("job_listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []).filter((r) => {
    if (jobType && r.job_type !== jobType) return false;
    if (remote !== undefined && remote !== null && Boolean(remote) !== r.remote) return false;
    return true;
  });
  const appliedSet = new Set();
  if (account && rows.length) {
    const jobIds = rows.map((r) => r.id);
    const { data: apps } = await ctx.supabase
      .from("job_applications")
      .select("job_id")
      .eq("account_id", account.id)
      .in("job_id", jobIds);
    for (const a of apps ?? []) appliedSet.add(a.job_id);
  }
  return ok({
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      description: row.description,
      jobType: row.job_type,
      salaryMin: row.salary_min,
      salaryMax: row.salary_max,
      salaryCurrency: row.salary_currency,
      remote: row.remote,
      location: row.location,
      requirements: row.requirements,
      skills: row.skills ?? [],
      contactEmail: row.contact_email ?? null,
      contactUrl: row.contact_url ?? null,
      applied: appliedSet.has(row.id),
      createdAt: row.created_at,
    })),
  });
}

async function learningJobsApply(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const jobId = text(ctx.body.jobId, 60);
  const coverLetter = text(ctx.body.coverLetter, 3000);
  if (!jobId) return fail(400, "invalid_input");
  const { data: job } = await ctx.supabase
    .from("job_listings")
    .select("*")
    .eq("id", jobId)
    .eq("status", "active")
    .maybeSingle();
  if (!job) return fail(404, "job_not_found");
  const { data: existing } = await ctx.supabase
    .from("job_applications")
    .select("*")
    .eq("job_id", jobId)
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (existing) return fail(409, "already_applied");
  await ctx.supabase.from("job_applications").insert({
    id: crypto.randomUUID(),
    job_id: jobId,
    account_id: auth.account.id,
    cover_letter: coverLetter || null,
    resume_url: textOrNull(ctx.body.resumeUrl, 500),
    status: "pending",
    created_at: now(),
  });
  return ok({ applied: true });
}

async function learningIncubationList(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const { data } = await ctx.supabase
    .from("incubation_programs")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = data ?? [];
  const progressMap = new Map();
  if (account && rows.length) {
    const programIds = rows.map((r) => r.id);
    const { data: progress } = await ctx.supabase
      .from("incubation_progress")
      .select("program_id,status")
      .eq("account_id", account.id)
      .in("program_id", programIds);
    for (const p of progress ?? []) {
      if (!progressMap.has(p.program_id)) progressMap.set(p.program_id, { completed: 0, total: 0 });
      const entry = progressMap.get(p.program_id);
      entry.total += 1;
      if (p.status === "completed") entry.completed += 1;
    }
  }
  return ok({
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      totalSteps: row.total_steps,
      progress: account ? progressMap.get(row.id) ?? null : null,
      createdAt: row.created_at,
    })),
  });
}

async function learningIncubationGet(ctx) {
  const auth = await actor(ctx, 0);
  const account = auth.error ? null : auth.account;
  const programId = text(ctx.body.programId, 60);
  if (!programId) return fail(400, "invalid_input");
  const { data: program } = await ctx.supabase
    .from("incubation_programs")
    .select("*")
    .eq("id", programId)
    .eq("status", "active")
    .maybeSingle();
  if (!program) return fail(404, "not_found");
  const { data: steps } = await ctx.supabase
    .from("incubation_steps")
    .select("*")
    .eq("program_id", programId)
    .eq("status", "active")
    .order("position", { ascending: true });
  let progressRows = [];
  if (account) {
    const { data: p } = await ctx.supabase
      .from("incubation_progress")
      .select("step_id,status,completed_at,notes")
      .eq("account_id", account.id)
      .eq("program_id", programId);
    progressRows = p ?? [];
  }
  const progressByStep = new Map(progressRows.map((p) => [p.step_id, p]));
  return ok({
    program: {
      id: program.id,
      title: program.title,
      description: program.description,
      totalSteps: program.total_steps,
      createdAt: program.created_at,
    },
    steps: (steps ?? []).map((s) => ({
      id: s.id,
      position: s.position,
      title: s.title,
      description: s.description,
      content: s.content,
      milestone: s.milestone,
      progress: progressByStep.get(s.id) ?? null,
    })),
  });
}

async function learningIncubationProgress(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const stepId = text(ctx.body.stepId, 60);
  const programId = text(ctx.body.programId, 60);
  const status = ctx.body.status === "completed" ? "completed" : "in_progress";
  if (!stepId || !programId) return fail(400, "invalid_input");
  const { data: existing } = await ctx.supabase
    .from("incubation_progress")
    .select("*")
    .eq("account_id", auth.account.id)
    .eq("step_id", stepId)
    .maybeSingle();
  if (existing) {
    const patch = { status };
    if (status === "completed") patch.completed_at = now();
    if (ctx.body.notes) patch.notes = text(ctx.body.notes, 500);
    await ctx.supabase.from("incubation_progress").update(patch).eq("id", existing.id);
  } else {
    await ctx.supabase.from("incubation_progress").insert({
      id: crypto.randomUUID(),
      account_id: auth.account.id,
      program_id: programId,
      step_id: stepId,
      status,
      completed_at: status === "completed" ? now() : null,
      notes: textOrNull(ctx.body.notes, 500),
      created_at: now(),
    });
  }
  if (status === "completed") {
    await ctx.supabase.from("accounts").update({ xp: auth.account.xp + 20 }).eq("id", auth.account.id);
  }
  return ok({ updated: true });
}

async function learningBadgesList(ctx) {
  const auth = await actor(ctx, 0);
  const { data } = await ctx.supabase
    .from("learning_badges")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  const earnedSet = new Set();
  if (auth.account) {
    const { data: earnings } = await ctx.supabase
      .from("learning_badge_earnings")
      .select("badge_id")
      .eq("account_id", auth.account.id);
    for (const e of earnings ?? []) earnedSet.add(e.badge_id);
  }
  return ok({
    items: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      icon: row.icon ?? null,
      emoji: row.emoji ?? null,
      category: row.category,
      requirement: row.requirement,
      xpReward: row.xp_reward,
      earned: earnedSet.has(row.id),
    })),
  });
}

async function learningBadgesMine(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: earnings } = await ctx.supabase
    .from("learning_badge_earnings")
    .select("badge_id,earned_at")
    .eq("account_id", auth.account.id);
  const badgeIds = (earnings ?? []).map((e) => e.badge_id);
  const badgeMap = new Map();
  if (badgeIds.length) {
    const { data: badges } = await ctx.supabase.from("learning_badges").select("*").in("id", badgeIds);
    for (const b of badges ?? []) badgeMap.set(b.id, b);
  }
  return ok({
    items: (earnings ?? []).map((e) => {
      const badge = badgeMap.get(e.badge_id);
      return {
        id: e.badge_id,
        name: badge?.name ?? null,
        emoji: badge?.emoji ?? null,
        icon: badge?.icon ?? null,
        category: badge?.category ?? null,
        earnedAt: e.earned_at,
      };
    }),
  });
}

async function learningAnonymousGet(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("anonymous_profiles")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  return ok({
    profile: data
      ? {
          displayName: data.display_name,
          avatarUrl: data.avatar_url ?? null,
          isActive: data.is_active,
        }
      : null,
  });
}

async function learningAnonymousSet(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const displayName = text(ctx.body.displayName, 60);
  const isActive = Boolean(ctx.body.isActive);
  if (displayName.length < 2) return fail(400, "invalid_input");
  const { data: existing } = await ctx.supabase
    .from("anonymous_profiles")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (existing) {
    await ctx.supabase
      .from("anonymous_profiles")
      .update({ display_name: displayName, is_active: isActive, updated_at: now() })
      .eq("id", existing.id);
  } else {
    await ctx.supabase.from("anonymous_profiles").insert({
      id: crypto.randomUUID(),
      account_id: auth.account.id,
      display_name: displayName,
      is_active: isActive,
      created_at: now(),
      updated_at: now(),
    });
  }
  return ok({ displayName, isActive });
}

// ---------- crypto wallet handlers ----------

function generateWalletAddress(symbol, accountId) {
  const hash = sha256Hex(`${symbol}:${accountId}:${Date.now()}:${Math.random()}`);
  if (symbol === "BTC") return `1${hash.substring(0, 33)}`;
  if (symbol === "ETH" || symbol?.startsWith("USDT-") || symbol === "USDC" || symbol === "MATIC") return `0x${hash.substring(0, 40)}`;
  if (symbol === "SOL") return hash.substring(0, 44);
  if (symbol === "BNB") return `0x${hash.substring(0, 40)}`;
  if (symbol === "USDT") return `T${hash.substring(0, 33)}`;
  return `0x${hash.substring(0, 40)}`;
}

async function cryptoCoinsList(ctx) {
  const { data } = await ctx.supabase
    .from("crypto_supported_coins")
    .select("*")
    .eq("is_active", true)
    .order("symbol");
  return ok({
    items: (data ?? []).map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      network: c.network,
      contractAddress: c.contract_address,
      decimals: c.decimals,
      icon: c.icon,
      color: c.color,
      coinConversionRate: Number(c.coin_conversion_rate),
      minDeposit: Number(c.min_deposit),
      minWithdraw: Number(c.min_withdraw),
      withdrawFeePercent: Number(c.withdraw_fee_percent),
    })),
  });
}

async function cryptoWalletsList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("crypto_wallets")
    .select("*")
    .eq("account_id", auth.account.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return ok({
    items: (data ?? []).map((w) => ({
      id: w.id,
      coinSymbol: w.coin_symbol,
      network: w.network,
      walletAddress: w.wallet_address,
      balance: Number(w.balance),
      createdAt: w.created_at,
    })),
  });
}

async function cryptoWalletsCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const coinSymbol = text(ctx.body.coinSymbol, 20);
  if (!coinSymbol) return fail(400, "coin_symbol_required");

  const { data: coin } = await ctx.supabase
    .from("crypto_supported_coins")
    .select("*")
    .eq("symbol", coinSymbol)
    .eq("is_active", true)
    .maybeSingle();
  if (!coin) return fail(400, "unsupported_coin");

  const { data: existing } = await ctx.supabase
    .from("crypto_wallets")
    .select("id")
    .eq("account_id", auth.account.id)
    .eq("coin_symbol", coinSymbol)
    .eq("network", coin.network)
    .maybeSingle();
  if (existing) return fail(400, "wallet_already_exists");

  const walletAddress = generateWalletAddress(coinSymbol, auth.account.id);
  const { data: wallet, error } = await ctx.supabase
    .from("crypto_wallets")
    .insert({
      account_id: auth.account.id,
      coin_symbol: coinSymbol,
      network: coin.network,
      wallet_address: walletAddress,
      balance: 0,
      is_active: true,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single();
  if (error) return fail(400, "failed_to_create_wallet");

  return ok({
    id: wallet.id,
    coinSymbol: wallet.coin_symbol,
    network: wallet.network,
    walletAddress: wallet.wallet_address,
    balance: Number(wallet.balance),
    createdAt: wallet.created_at,
  });
}

async function cryptoWalletsGet(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const walletId = text(ctx.body.walletId, 60);
  if (!walletId) return fail(400, "wallet_id_required");

  const { data: wallet } = await ctx.supabase
    .from("crypto_wallets")
    .select("*")
    .eq("id", walletId)
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!wallet) return fail(404, "wallet_not_found");

  const { data: txs } = await ctx.supabase
    .from("crypto_transactions")
    .select("*")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return ok({
    wallet: {
      id: wallet.id,
      coinSymbol: wallet.coin_symbol,
      network: wallet.network,
      walletAddress: wallet.wallet_address,
      balance: Number(wallet.balance),
      createdAt: wallet.created_at,
    },
    transactions: (txs ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      coinSymbol: t.coin_symbol,
      amountCrypto: Number(t.amount_crypto),
      amountCoins: t.amount_coins,
      txHash: t.tx_hash,
      fromAddress: t.from_address,
      toAddress: t.to_address,
      status: t.status,
      description: t.description,
      createdAt: t.created_at,
      confirmedAt: t.confirmed_at,
    })),
  });
}

async function cryptoDeposit(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const walletId = text(ctx.body.walletId, 60);
  const amountCrypto = Number(ctx.body.amountCrypto);
  const txHash = text(ctx.body.txHash, 120);
  if (!walletId || !amountCrypto || amountCrypto <= 0) return fail(400, "invalid_deposit_params");

  const { data: wallet } = await ctx.supabase
    .from("crypto_wallets")
    .select("*")
    .eq("id", walletId)
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!wallet) return fail(404, "wallet_not_found");

  const { data: coin } = await ctx.supabase
    .from("crypto_supported_coins")
    .select("*")
    .eq("symbol", wallet.coin_symbol)
    .maybeSingle();
  if (!coin) return fail(400, "coin_not_found");
  if (amountCrypto < Number(coin.min_deposit)) return fail(400, `minimum_deposit_is_${coin.min_deposit}_${coin.symbol}`);

  const amountCoins = Math.floor(amountCrypto * Number(coin.coin_conversion_rate));
  const newBalance = Number(wallet.balance) + amountCrypto;

  await ctx.supabase.from("crypto_wallets").update({
    balance: newBalance,
    updated_at: now(),
  }).eq("id", wallet.id);

  await ctx.supabase.from("crypto_transactions").insert({
    wallet_id: wallet.id,
    account_id: auth.account.id,
    type: "deposit",
    coin_symbol: wallet.coin_symbol,
    amount_crypto: amountCrypto,
    amount_coins: amountCoins,
    tx_hash: txHash || `0x${sha256Hex(`${wallet.id}:${amountCrypto}:${Date.now()}`).substring(0, 64)}`,
    to_address: wallet.wallet_address,
    status: "confirmed",
    description: `Deposit ${amountCrypto} ${wallet.coin_symbol} → ${amountCoins} koin`,
    confirmed_at: now(),
    created_at: now(),
  });

  const { data: coinBal } = await ctx.supabase
    .from("coin_balances")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  const currentBalance = coinBal?.balance ?? 0;
  const newCoinBalance = currentBalance + amountCoins;

  await ctx.supabase.from("coin_balances").upsert({
    account_id: auth.account.id,
    balance: newCoinBalance,
    lifetime_purchased: (coinBal?.lifetime_purchased ?? 0) + amountCoins,
    updated_at: now(),
  });

  await ctx.supabase.from("coin_transactions").insert({
    account_id: auth.account.id,
    type: "purchase",
    amount: amountCoins,
    balance_after: newCoinBalance,
    description: `Konversi deposit ${amountCrypto} ${wallet.coin_symbol}`,
    reference_id: `crypto_deposit_${wallet.id}`,
    created_at: now(),
  });

  return ok({
    amountCrypto,
    amountCoins,
    newWalletBalance: newBalance,
    newCoinBalance,
    status: "confirmed",
  });
}

async function cryptoWithdraw(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const walletId = text(ctx.body.walletId, 60);
  const amountCrypto = Number(ctx.body.amountCrypto);
  const toAddress = text(ctx.body.toAddress, 120);
  if (!walletId || !amountCrypto || amountCrypto <= 0 || !toAddress) return fail(400, "invalid_withdraw_params");

  const { data: wallet } = await ctx.supabase
    .from("crypto_wallets")
    .select("*")
    .eq("id", walletId)
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!wallet) return fail(404, "wallet_not_found");
  if (Number(wallet.balance) < amountCrypto) return fail(400, "insufficient_crypto_balance");

  const { data: coin } = await ctx.supabase
    .from("crypto_supported_coins")
    .select("*")
    .eq("symbol", wallet.coin_symbol)
    .maybeSingle();
  if (!coin) return fail(400, "coin_not_found");
  if (amountCrypto < Number(coin.min_withdraw)) return fail(400, `minimum_withdraw_is_${coin.min_withdraw}_${coin.symbol}`);

  const fee = amountCrypto * (Number(coin.withdraw_fee_percent) / 100);
  const netAmount = amountCrypto - fee;
  const amountCoins = Math.floor(amountCrypto * Number(coin.coin_conversion_rate));

  const { data: coinBal } = await ctx.supabase
    .from("coin_balances")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!coinBal || coinBal.balance < amountCoins) return fail(400, "insufficient_coin_balance");

  const newCoinBalance = coinBal.balance - amountCoins;
  const newWalletBalance = Number(wallet.balance) - amountCrypto;

  await ctx.supabase.from("crypto_wallets").update({
    balance: newWalletBalance,
    updated_at: now(),
  }).eq("id", wallet.id);

  await ctx.supabase.from("coin_balances").update({
    balance: newCoinBalance,
    lifetime_spent: (coinBal.lifetime_spent ?? 0) + amountCoins,
    updated_at: now(),
  }).eq("account_id", auth.account.id);

  await ctx.supabase.from("coin_transactions").insert({
    account_id: auth.account.id,
    type: "withdraw",
    amount: -amountCoins,
    balance_after: newCoinBalance,
    description: `Penarikan ${amountCrypto} ${wallet.coin_symbol} ke ${toAddress.substring(0, 10)}...`,
    reference_id: `crypto_withdraw_${wallet.id}`,
    created_at: now(),
  });

  const txHash = `0x${sha256Hex(`${wallet.id}:${amountCrypto}:${toAddress}:${Date.now()}`).substring(0, 64)}`;
  await ctx.supabase.from("crypto_transactions").insert({
    wallet_id: wallet.id,
    account_id: auth.account.id,
    type: "withdraw",
    coin_symbol: wallet.coin_symbol,
    amount_crypto: amountCrypto,
    amount_coins: amountCoins,
    tx_hash: txHash,
    from_address: wallet.wallet_address,
    to_address: toAddress,
    status: "pending",
    description: `Withdraw ${netAmount} ${wallet.coin_symbol} (fee: ${fee})`,
    gas_fee: fee,
    created_at: now(),
  });

  return ok({
    amountCrypto,
    fee,
    netAmount,
    amountCoins,
    newWalletBalance,
    newCoinBalance,
    txHash,
    status: "pending",
  });
}

async function cryptoSwapToCoins(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const walletId = text(ctx.body.walletId, 60);
  const amountCrypto = Number(ctx.body.amountCrypto);
  if (!walletId || !amountCrypto || amountCrypto <= 0) return fail(400, "invalid_swap_params");

  const { data: wallet } = await ctx.supabase
    .from("crypto_wallets")
    .select("*")
    .eq("id", walletId)
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!wallet) return fail(404, "wallet_not_found");
  if (Number(wallet.balance) < amountCrypto) return fail(400, "insufficient_crypto_balance");

  const { data: coin } = await ctx.supabase
    .from("crypto_supported_coins")
    .select("*")
    .eq("symbol", wallet.coin_symbol)
    .maybeSingle();
  if (!coin) return fail(400, "coin_not_found");

  const amountCoins = Math.floor(amountCrypto * Number(coin.coin_conversion_rate));
  const newWalletBalance = Number(wallet.balance) - amountCrypto;

  await ctx.supabase.from("crypto_wallets").update({
    balance: newWalletBalance,
    updated_at: now(),
  }).eq("id", wallet.id);

  const { data: coinBal } = await ctx.supabase
    .from("coin_balances")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  const currentCoinBalance = coinBal?.balance ?? 0;
  const newCoinBalance = currentCoinBalance + amountCoins;

  await ctx.supabase.from("coin_balances").upsert({
    account_id: auth.account.id,
    balance: newCoinBalance,
    lifetime_purchased: (coinBal?.lifetime_purchased ?? 0) + amountCoins,
    updated_at: now(),
  });

  await ctx.supabase.from("coin_transactions").insert({
    account_id: auth.account.id,
    type: "purchase",
    amount: amountCoins,
    balance_after: newCoinBalance,
    description: `Swap ${amountCrypto} ${wallet.coin_symbol} → ${amountCoins} koin`,
    reference_id: `crypto_swap_${wallet.id}`,
    created_at: now(),
  });

  await ctx.supabase.from("crypto_transactions").insert({
    wallet_id: wallet.id,
    account_id: auth.account.id,
    type: "swap_to_coins",
    coin_symbol: wallet.coin_symbol,
    amount_crypto: amountCrypto,
    amount_coins: amountCoins,
    status: "confirmed",
    description: `Swap ${amountCrypto} ${wallet.coin_symbol} ke ${amountCoins} koin webapp`,
    confirmed_at: now(),
    created_at: now(),
  });

  return ok({
    amountCrypto,
    amountCoins,
    newWalletBalance,
    newCoinBalance,
    conversionRate: Number(coin.coin_conversion_rate),
  });
}

async function cryptoSwapFromCoins(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const walletId = text(ctx.body.walletId, 60);
  const amountCoins = Number(ctx.body.amountCoins);
  if (!walletId || !amountCoins || amountCoins <= 0) return fail(400, "invalid_swap_params");

  const { data: wallet } = await ctx.supabase
    .from("crypto_wallets")
    .select("*")
    .eq("id", walletId)
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!wallet) return fail(404, "wallet_not_found");

  const { data: coin } = await ctx.supabase
    .from("crypto_supported_coins")
    .select("*")
    .eq("symbol", wallet.coin_symbol)
    .maybeSingle();
  if (!coin) return fail(400, "coin_not_found");

  const rate = Number(coin.coin_conversion_rate);
  if (rate <= 0) return fail(400, "invalid_conversion_rate");
  const amountCrypto = amountCoins / rate;

  const { data: coinBal } = await ctx.supabase
    .from("coin_balances")
    .select("*")
    .eq("account_id", auth.account.id)
    .maybeSingle();
  if (!coinBal || coinBal.balance < amountCoins) return fail(400, "insufficient_coin_balance");

  const newCoinBalance = coinBal.balance - amountCoins;
  const newWalletBalance = Number(wallet.balance) + amountCrypto;

  await ctx.supabase.from("coin_balances").update({
    balance: newCoinBalance,
    lifetime_spent: (coinBal.lifetime_spent ?? 0) + amountCoins,
    updated_at: now(),
  }).eq("account_id", auth.account.id);

  await ctx.supabase.from("coin_transactions").insert({
    account_id: auth.account.id,
    type: "spend",
    amount: -amountCoins,
    balance_after: newCoinBalance,
    description: `Swap ${amountCoins} koin → ${amountCrypto.toFixed(6)} ${wallet.coin_symbol}`,
    reference_id: `crypto_swap_from_${wallet.id}`,
    created_at: now(),
  });

  await ctx.supabase.from("crypto_wallets").update({
    balance: newWalletBalance,
    updated_at: now(),
  }).eq("id", wallet.id);

  await ctx.supabase.from("crypto_transactions").insert({
    wallet_id: wallet.id,
    account_id: auth.account.id,
    type: "swap_from_coins",
    coin_symbol: wallet.coin_symbol,
    amount_crypto: amountCrypto,
    amount_coins: amountCoins,
    status: "confirmed",
    description: `Swap ${amountCoins} koin webapp ke ${amountCrypto.toFixed(6)} ${wallet.coin_symbol}`,
    confirmed_at: now(),
    created_at: now(),
  });

  return ok({
    amountCoins,
    amountCrypto,
    newCoinBalance,
    newWalletBalance,
    conversionRate: rate,
  });
}

async function cryptoTransactionsList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data } = await ctx.supabase
    .from("crypto_transactions")
    .select("*")
    .eq("account_id", auth.account.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return ok({
    items: (data ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      coinSymbol: t.coin_symbol,
      amountCrypto: Number(t.amount_crypto),
      amountCoins: t.amount_coins,
      txHash: t.tx_hash,
      fromAddress: t.from_address,
      toAddress: t.to_address,
      status: t.status,
      description: t.description,
      createdAt: t.created_at,
      confirmedAt: t.confirmed_at,
    })),
  });
}

// ---------- Kompetisi E-Sport ----------

const ESPORT_FORMATS = ["single_elim", "double_elim", "round_robin", "group_playoff", "swiss", "battle_royale", "league"];
const ESPORT_STATUSES = ["draft", "registration", "bracket", "ongoing", "completed", "cancelled"];
const ESPORT_TRANSITIONS = {
  registration: ["draft"],
  bracket: ["registration"],
  ongoing: ["bracket"],
  completed: ["ongoing"],
  cancelled: ["draft", "registration", "bracket", "ongoing"],
};
const ESPORT_REG_STATUSES = ["registered", "checked_in", "eliminated", "winner", "disqualified", "withdrawn", "waitlist"];
const ESPORT_MEMBER_ROLES = ["member", "substitute", "coach", "manager"];
const ESPORT_SEEDING_MODES = ["manual", "random", "registration", "rank"];
const ESPORT_PLATFORMS = ["pc", "mobile", "console"];
const ESPORT_CATEGORIES = ["amateur", "semi_pro", "professional"];
const ESPORT_TIMEZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "UTC"];
const ESPORT_APPROVAL_STATUSES = ["none", "pending", "approved", "rejected"];
const ESPORT_PRIZE_APPROVAL_THRESHOLD = 10000000;
const ESPORT_PAYMENT_STATUSES = ["unpaid", "paid", "refunded"];
const ESPORT_PRIZE_STATUSES = ["pending", "locked", "distributing", "completed"];
const ESPORT_PRIZE_TRANSITIONS = {
  locked: ["pending"],
  distributing: ["locked"],
  completed: ["distributing"],
};
const ESPORT_STREAM_PLATFORMS = ["youtube", "twitch", "tiktok", "facebook", "kick", "custom"];
const ESPORT_CASTER_ROLES = ["main_caster", "co_caster", "analyst", "host", "observer"];
const ESPORT_DISPUTE_STATUSES = ["open", "investigating", "resolved", "rejected"];
const ESPORT_BR_PLACEMENT_POINTS = { 1: 10, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1 };
const ESPORT_BR_KILL_POINT = 1;
const ESPORT_BUDGET_CATEGORIES = [
  "PRIZE_POOL",
  "PRODUCTION",
  "TALENT",
  "MARKETING",
  "STAFF",
  "EQUIPMENT",
  "VENUE",
  "PERMIT",
  "CONTINGENCY",
  "OTHER",
];

const esportTimestamp = (value) => {
  const v = text(value, 40);
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

const esportEnumOrDefault = (value, allowed, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const v = text(value, 30);
  return allowed.includes(v) ? v : null;
};

const esportRequirementsOf = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    minLevel: intOrNull(value.minLevel, 1, 50) ?? 0,
    minAge: intOrNull(value.minAge, 0, 99) ?? 0,
    regionLock: text(value.regionLock, 60),
    requireVerified: Boolean(value.requireVerified),
    extra: text(value.extra, 600),
  };
};

const esportRulesDetailOf = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    banPick: text(value.banPick, 600),
    gameRules: text(value.gameRules, 2000),
    latePenalty: text(value.latePenalty, 600),
    disconnectPolicy: text(value.disconnectPolicy, 800),
    substitutePolicy: text(value.substitutePolicy, 600),
    anticheatPolicy: text(value.anticheatPolicy, 800),
    disputePolicy: text(value.disputePolicy, 800),
  };
};

const esportStreamingConfigOf = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    platforms: words(value.platforms, 6, 40),
    concurrentStreams: intOrNull(value.concurrentStreams, 1, 20) ?? 1,
    casterSlots: intOrNull(value.casterSlots, 0, 20) ?? 0,
    overlayEnabled: Boolean(value.overlayEnabled),
    overlayNotes: text(value.overlayNotes, 400),
    observerEnabled: Boolean(value.observerEnabled),
    recordingEnabled: Boolean(value.recordingEnabled),
  };
};

const esportSponsorshipOf = (value) => {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const item of value.slice(0, 12)) {
    const name = text(item?.name, 80);
    if (!name) continue;
    const logo = typeof item?.logo === "string" && item.logo.startsWith("data:image/") ? item.logo.slice(0, 200_000) : null;
    out.push({
      name,
      amount: intOrNull(item?.amount, 0, 1_000_000_000) ?? 0,
      logo,
      website: textOrNull(item?.website, 200),
    });
  }
  return out;
};

const esportBrPointsOf = (placement, kills) => {
  const placementPoints = ESPORT_BR_PLACEMENT_POINTS[placement] ?? 0;
  const killPoints = kills * ESPORT_BR_KILL_POINT;
  return { placementPoints, killPoints, points: placementPoints + killPoints };
};

const esportMemberGameInfoOf = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    inGameName: textOrNull(value.inGameName, 40),
    inGameId: textOrNull(value.inGameId, 40),
    gameRank: textOrNull(value.gameRank, 40),
  };
};

const esportNextPow2 = (n) => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};

const esportRosterOf = (row) => {
  if (!row?.roster) return [];
  try {
    const parsed = JSON.parse(row.roster);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
};

function esportResultFor(bestOf, homeScore, awayScore) {
  const bo = Math.max(1, Number(bestOf) || 1);
  const hs = Number(homeScore);
  const as = Number(awayScore);
  if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0 || hs > 99 || as > 99) {
    return { error: "invalid_score" };
  }
  const needs = Math.floor(bo / 2) + 1;
  if (bo === 1) {
    if (hs === as) return { error: "tied_score" };
    return { winnerSide: hs > as ? "home" : "away" };
  }
  if (hs === needs && as < needs) return { winnerSide: "home" };
  if (as === needs && hs < needs) return { winnerSide: "away" };
  return { error: "invalid_score_bestof" };
}

async function esportTournamentAccess(ctx, tournamentId) {
  const auth = await actor(ctx, 2);
  if (auth.error) return { error: auth.error };
  const { data: tournament } = await ctx.supabase
    .from("esport_tournaments")
    .select("*")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament) return { error: fail(404, "not_found") };
  const isCreator = tournament.creator_id === auth.account.id;
  const isAdmin = auth.rank >= 6;
  if (!isCreator && !isAdmin) return { error: fail(403, "forbidden") };
  return { auth, tournament, isCreator, isAdmin };
}

async function esportTournamentRows(supabase, tournamentId) {
  const { data: regs } = await supabase.from("esport_registrations").select("*").eq("tournament_id", tournamentId);
  const { data: matches } = await supabase.from("esport_matches").select("*").eq("tournament_id", tournamentId);
  const { data: prizes } = await supabase.from("esport_prizes").select("*").eq("tournament_id", tournamentId);
  const { data: casters } = await supabase.from("esport_casters").select("*").eq("tournament_id", tournamentId);
  const regList = regs ?? [];
  const teamIds = [...new Set(regList.map((r) => r.team_id))];
  const teams = [];
  for (const teamId of teamIds) {
    const { data: team } = await supabase.from("esport_teams").select("*").eq("id", teamId).maybeSingle();
    if (team) teams.push(team);
  }
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const regMap = new Map(regList.map((r) => [r.id, r]));
  const sortMatches = (list) => [...list].sort((a, b) => {
    if ((a.stage ?? "") !== (b.stage ?? "")) return (a.stage ?? "") < (b.stage ?? "") ? -1 : 1;
    if ((a.group_label ?? "") !== (b.group_label ?? "")) return (a.group_label ?? "") < (b.group_label ?? "") ? -1 : 1;
    if (a.round !== b.round) return a.round - b.round;
    return (a.match_index ?? 0) - (b.match_index ?? 0);
  });
  return {
    regList,
    regMap,
    teamMap,
    matches: sortMatches(matches ?? []),
    prizes: [...(prizes ?? [])].sort((a, b) => a.placement - b.placement),
    casters: casters ?? [],
  };
}

function esportPublicMatch(row, regMap, teamMap) {
  const teamOf = (regId) => {
    const reg = regId ? regMap.get(regId) : null;
    const team = reg ? teamMap.get(reg.team_id) : null;
    return team ? { name: team.name, tag: team.tag ?? null, logo: team.logo_data ?? null, seed: reg.seed ?? null } : null;
  };
  return {
    id: row.id,
    stage: row.stage,
    round: row.round,
    groupLabel: row.group_label ?? null,
    matchIndex: row.match_index ?? 0,
    bestOf: row.best_of ?? 1,
    homeRegId: row.home_reg_id ?? null,
    awayRegId: row.away_reg_id ?? null,
    homeTeam: teamOf(row.home_reg_id),
    awayTeam: teamOf(row.away_reg_id),
    homeScore: row.home_score ?? null,
    awayScore: row.away_score ?? null,
    winnerRegId: row.winner_reg_id ?? null,
    status: row.status,
    scheduledAt: row.scheduled_at ?? null,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    streamUrl: row.stream_url ?? null,
    casterName: row.caster_name ?? null,
    checkinHomeAt: row.checkin_home_at ?? null,
    checkinAwayAt: row.checkin_away_at ?? null,
    pausedAt: row.paused_at ?? null,
    pauseNote: row.pause_note ?? null,
    nextMatchId: row.next_match_id ?? null,
    nextSlot: row.next_slot ?? null,
    disputed: false,
  };
}

async function esportGamesList(ctx) {
  const { data } = await ctx.supabase.from("esport_games").select("*").order("sort_order", { ascending: true });
  return ok({
    items: (data ?? [])
      .filter((g) => g.active !== false)
      .map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        mode: g.mode,
        teamSizeMin: g.team_size_min,
        teamSizeMax: g.team_size_max,
        rosterMax: g.roster_max,
        icon: g.icon ?? null,
        developer: g.developer ?? null,
        genre: g.genre ?? null,
        platforms: g.platforms ?? null,
        mapPool: g.map_pool ?? null,
        bannerData: g.banner_data ?? null,
        defaultFormat: g.default_format ?? null,
        defaultRosterSize: g.default_roster_size ?? null,
        minPlayers: g.min_players ?? 1,
      })),
  });
}

async function esportTournamentsList(ctx) {
  const gameSlug = text(ctx.body.game, 40).toLowerCase();
  const statusFilter = text(ctx.body.status, 20);
  const mine = Boolean(ctx.body.mine);
  let viewer = null;
  if (mine) {
    const auth = await actor(ctx, 2);
    if (auth.error) return auth.error;
    viewer = auth.account;
  }
  const { data: games } = await ctx.supabase.from("esport_games").select("*");
  const gameMap = new Map((games ?? []).map((g) => [g.id, g]));
  const { data: tournaments } = await ctx.supabase
    .from("esport_tournaments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: regs } = await ctx.supabase.from("esport_registrations").select("id,tournament_id,status");
  const regCounts = new Map();
  for (const r of regs ?? []) {
    regCounts.set(r.tournament_id, (regCounts.get(r.tournament_id) ?? 0) + 1);
  }
  let rows = (tournaments ?? []).filter((t) => t.status !== "draft" || (mine && viewer && t.creator_id === viewer.id));
  if (!mine) rows = rows.filter((t) => t.status !== "cancelled");
  if (mine && viewer) rows = rows.filter((t) => t.creator_id === viewer.id);
  if (statusFilter && ESPORT_STATUSES.includes(statusFilter)) rows = rows.filter((t) => t.status === statusFilter);
  if (gameSlug) {
    const game = (games ?? []).find((g) => g.slug === gameSlug);
    rows = game ? rows.filter((t) => t.game_id === game.id) : [];
  }
  const order = { ongoing: 0, bracket: 1, registration: 2, completed: 3, cancelled: 4, draft: 5 };
  rows = [...rows].sort((a, b) => {
    const oa = order[a.status] ?? 9;
    const ob = order[b.status] ?? 9;
    if (oa !== ob) return oa - ob;
    return (a.created_at ?? "") < (b.created_at ?? "") ? 1 : -1;
  });
  const creatorIds = [...new Set(rows.map((t) => t.creator_id))];
  const names = await namesFor(ctx.supabase, creatorIds);
  return ok({
    items: rows.map((t) => {
      const game = gameMap.get(t.game_id);
      return {
        id: t.id,
        title: t.title,
        format: t.format,
        status: t.status,
        maxTeams: t.max_teams,
        teamCount: regCounts.get(t.id) ?? 0,
        entryFee: Number(t.entry_fee) || 0,
        prizeTotal: Number(t.prize_total) || 0,
        platform: t.platform ?? "mobile",
        category: t.category ?? "amateur",
        tags: t.tags ?? null,
        streamUrl: t.stream_url ?? null,
        registrationCloseAt: t.registration_close_at ?? null,
        startAt: t.start_at ?? null,
        createdAt: t.created_at,
        creatorName: names.get(t.creator_id)?.displayName ?? names.get(t.creator_id)?.nickname ?? "Penyelenggara",
        game: game
          ? { id: game.id, slug: game.slug, name: game.name, mode: game.mode, icon: game.icon ?? null }
          : null,
      };
    }),
  });
}

async function esportTournamentCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const gameRef = text(ctx.body.gameId ?? ctx.body.game, 60);
  if (!gameRef) return fail(400, "invalid_input");
  const { data: game } = await ctx.supabase.from("esport_games").select("*").eq("id", gameRef).maybeSingle();
  const { data: gameBySlug } = game
    ? { data: null }
    : await ctx.supabase.from("esport_games").select("*").eq("slug", gameRef.toLowerCase()).maybeSingle();
  const selectedGame = game ?? gameBySlug;
  if (!selectedGame || selectedGame.active === false) return fail(404, "not_found");
  const title = text(ctx.body.title, 120);
  if (title.length < 4) return fail(400, "invalid_input");
  const format = text(ctx.body.format, 20);
  if (!ESPORT_FORMATS.includes(format)) return fail(400, "invalid_input");
  const initialStatus = text(ctx.body.status, 20) || "registration";
  if (!["draft", "registration"].includes(initialStatus)) return fail(400, "invalid_input");
  const maxTeams = intOrNull(ctx.body.maxTeams, 2, 128) ?? 8;
  const rosterMin = intOrNull(ctx.body.rosterMin, 1, 15);
  const rosterMax = intOrNull(ctx.body.rosterMax, 1, 15);
  if (rosterMin && rosterMax && rosterMin > rosterMax) return fail(400, "invalid_input");
  const minPlayers = intOrNull(ctx.body.minPlayers, 1, 15) ?? selectedGame.min_players ?? selectedGame.team_size_min ?? 1;
  const bestOf = intOrNull(ctx.body.bestOf, 1, 9) ?? 1;
  const entryFee = intOrNull(ctx.body.entryFee, 0, 1_000_000_000) ?? 0;
  const checkinWindow = intOrNull(ctx.body.checkinWindowMinutes, 0, 180) ?? 30;
  const platform = esportEnumOrDefault(ctx.body.platform, ESPORT_PLATFORMS, "mobile");
  if (!platform) return fail(400, "invalid_input");
  const category = esportEnumOrDefault(ctx.body.category, ESPORT_CATEGORIES, "amateur");
  if (!category) return fail(400, "invalid_input");
  const timezone = esportEnumOrDefault(ctx.body.timezone, ESPORT_TIMEZONES, "Asia/Jakarta");
  if (!timezone) return fail(400, "invalid_input");
  const prizesInput = Array.isArray(ctx.body.prizes) ? ctx.body.prizes.slice(0, 10) : [];
  const prizes = [];
  for (const item of prizesInput) {
    const placement = intOrNull(item?.placement, 1, 10);
    const amount = intOrNull(item?.amount, 0, 1_000_000_000);
    const label = text(item?.label, 60);
    if (!placement || amount === null) return fail(400, "invalid_prize");
    prizes.push({ placement, label: label || `Juara ${placement}`, amount });
  }
  const prizeTotal = prizes.reduce((sum, p) => sum + p.amount, 0);
  const needsApproval = prizeTotal > ESPORT_PRIZE_APPROVAL_THRESHOLD;
  if (initialStatus === "registration" && needsApproval && auth.rank < 6) return fail(409, "approval_required");
  const id = crypto.randomUUID();
  const { error } = await ctx.supabase.from("esport_tournaments").insert({
    id,
    creator_id: auth.account.id,
    game_id: selectedGame.id,
    title,
    description: textOrNull(ctx.body.description, 2000),
    format,
    status: initialStatus,
    max_teams: maxTeams,
    roster_min: rosterMin,
    roster_max: rosterMax,
    game_mode: textOrNull(ctx.body.gameMode, 40) ?? selectedGame.mode ?? null,
    min_players: minPlayers,
    prize_status: "pending",
    best_of: bestOf,
    entry_fee: entryFee,
    prize_total: prizeTotal,
    rules: textOrNull(ctx.body.rules, 6000),
    stream_url: textOrNull(ctx.body.streamUrl, 300),
    registration_close_at: esportTimestamp(ctx.body.registrationCloseAt),
    start_at: esportTimestamp(ctx.body.startAt),
    checkin_window_minutes: checkinWindow,
    platform,
    banner_data: textOrNull(ctx.body.bannerData, 900000),
    tags: textOrNull(ctx.body.tags, 200),
    category,
    registration_open_at: esportTimestamp(ctx.body.registrationOpenAt),
    technical_meeting_at: esportTimestamp(ctx.body.technicalMeetingAt),
    qualifier_start_at: esportTimestamp(ctx.body.qualifierStartAt),
    main_event_start_at: esportTimestamp(ctx.body.mainEventStartAt),
    grand_final_at: esportTimestamp(ctx.body.grandFinalAt),
    timezone,
    substitute_max: intOrNull(ctx.body.substituteMax, 0, 10) ?? 0,
    requirements: esportRequirementsOf(ctx.body.requirements),
    funding_source: textOrNull(ctx.body.fundingSource, 200),
    operational_budget: intOrNull(ctx.body.operationalBudget, 0, 1_000_000_000) ?? 0,
    sponsorship_slots: esportSponsorshipOf(ctx.body.sponsorshipSlots),
    rules_detail: esportRulesDetailOf(ctx.body.rulesDetail),
    streaming_config: esportStreamingConfigOf(ctx.body.streamingConfig),
    approval_status: needsApproval && initialStatus === "registration" ? "approved" : "none",
    approval_note: needsApproval && initialStatus === "registration" ? "Dibuat langsung oleh admin." : null,
    approved_by: needsApproval && initialStatus === "registration" ? auth.account.id : null,
    approved_at: needsApproval && initialStatus === "registration" ? now() : null,
    created_at: now(),
    updated_at: now(),
  });
  if (error) return fail(500, "server_error");
  for (const prize of prizes) {
    await ctx.supabase.from("esport_prizes").insert({
      id: crypto.randomUUID(),
      tournament_id: id,
      placement: prize.placement,
      label: prize.label,
      amount: prize.amount,
      created_at: now(),
    });
  }
  await awardKpi(ctx.supabase, auth.account.id, "esport_tournament_create", id);
  return ok({ id });
}

async function esportTournamentUpdate(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await esportTournamentAccess(ctx, id);
  if (access.error) return access.error;
  const { tournament } = access;
  const patch = { updated_at: now() };
  if (ctx.body.title !== undefined) {
    const v = text(ctx.body.title, 120);
    if (v.length < 4) return fail(400, "invalid_input");
    patch.title = v;
  }
  if (ctx.body.description !== undefined) patch.description = textOrNull(ctx.body.description, 2000);
  if (ctx.body.rules !== undefined) patch.rules = textOrNull(ctx.body.rules, 6000);
  if (ctx.body.streamUrl !== undefined) patch.stream_url = textOrNull(ctx.body.streamUrl, 300);
  if (ctx.body.maxTeams !== undefined) {
    const v = intOrNull(ctx.body.maxTeams, 2, 128);
    if (!v) return fail(400, "invalid_input");
    const { data: regs } = await ctx.supabase.from("esport_registrations").select("id").eq("tournament_id", id);
    if ((regs ?? []).length > v) return fail(409, "tournament_full");
    patch.max_teams = v;
  }
  if (ctx.body.rosterMin !== undefined) {
    const v = intOrNull(ctx.body.rosterMin, 1, 15);
    if (!v) return fail(400, "invalid_input");
    patch.roster_min = v;
  }
  if (ctx.body.rosterMax !== undefined) {
    const v = intOrNull(ctx.body.rosterMax, 1, 15);
    if (!v) return fail(400, "invalid_input");
    patch.roster_max = v;
  }
  if (ctx.body.gameMode !== undefined) patch.game_mode = textOrNull(ctx.body.gameMode, 40);
  if (ctx.body.minPlayers !== undefined) {
    const v = intOrNull(ctx.body.minPlayers, 1, 15);
    if (!v) return fail(400, "invalid_input");
    patch.min_players = v;
  }
  if (ctx.body.bestOf !== undefined) {
    const v = intOrNull(ctx.body.bestOf, 1, 9);
    if (!v) return fail(400, "invalid_input");
    patch.best_of = v;
  }
  if (ctx.body.entryFee !== undefined) {
    const v = intOrNull(ctx.body.entryFee, 0, 1_000_000_000);
    if (v === null) return fail(400, "invalid_input");
    patch.entry_fee = v;
  }
  if (ctx.body.checkinWindowMinutes !== undefined) {
    const v = intOrNull(ctx.body.checkinWindowMinutes, 0, 180);
    if (v === null) return fail(400, "invalid_input");
    patch.checkin_window_minutes = v;
  }
  if (ctx.body.registrationCloseAt !== undefined) patch.registration_close_at = esportTimestamp(ctx.body.registrationCloseAt);
  if (ctx.body.startAt !== undefined) patch.start_at = esportTimestamp(ctx.body.startAt);
  if (ctx.body.platform !== undefined) {
    const v = esportEnumOrDefault(ctx.body.platform, ESPORT_PLATFORMS, null);
    if (!v) return fail(400, "invalid_input");
    patch.platform = v;
  }
  if (ctx.body.category !== undefined) {
    const v = esportEnumOrDefault(ctx.body.category, ESPORT_CATEGORIES, null);
    if (!v) return fail(400, "invalid_input");
    patch.category = v;
  }
  if (ctx.body.timezone !== undefined) {
    const v = esportEnumOrDefault(ctx.body.timezone, ESPORT_TIMEZONES, null);
    if (!v) return fail(400, "invalid_input");
    patch.timezone = v;
  }
  if (ctx.body.bannerData !== undefined) patch.banner_data = textOrNull(ctx.body.bannerData, 900000);
  if (ctx.body.tags !== undefined) patch.tags = textOrNull(ctx.body.tags, 200);
  if (ctx.body.registrationOpenAt !== undefined) patch.registration_open_at = esportTimestamp(ctx.body.registrationOpenAt);
  if (ctx.body.technicalMeetingAt !== undefined) patch.technical_meeting_at = esportTimestamp(ctx.body.technicalMeetingAt);
  if (ctx.body.qualifierStartAt !== undefined) patch.qualifier_start_at = esportTimestamp(ctx.body.qualifierStartAt);
  if (ctx.body.mainEventStartAt !== undefined) patch.main_event_start_at = esportTimestamp(ctx.body.mainEventStartAt);
  if (ctx.body.grandFinalAt !== undefined) patch.grand_final_at = esportTimestamp(ctx.body.grandFinalAt);
  if (ctx.body.substituteMax !== undefined) {
    const v = intOrNull(ctx.body.substituteMax, 0, 10);
    if (v === null) return fail(400, "invalid_input");
    patch.substitute_max = v;
  }
  if (ctx.body.requirements !== undefined) patch.requirements = esportRequirementsOf(ctx.body.requirements);
  if (ctx.body.fundingSource !== undefined) patch.funding_source = textOrNull(ctx.body.fundingSource, 200);
  if (ctx.body.operationalBudget !== undefined) {
    const v = intOrNull(ctx.body.operationalBudget, 0, 1_000_000_000);
    if (v === null) return fail(400, "invalid_input");
    patch.operational_budget = v;
  }
  if (ctx.body.sponsorshipSlots !== undefined) patch.sponsorship_slots = esportSponsorshipOf(ctx.body.sponsorshipSlots);
  if (ctx.body.rulesDetail !== undefined) patch.rules_detail = esportRulesDetailOf(ctx.body.rulesDetail);
  if (ctx.body.streamingConfig !== undefined) patch.streaming_config = esportStreamingConfigOf(ctx.body.streamingConfig);
  if (Array.isArray(ctx.body.prizes)) {
    const prizesInput = ctx.body.prizes.slice(0, 10);
    const prizes = [];
    for (const item of prizesInput) {
      const placement = intOrNull(item?.placement, 1, 10);
      const amount = intOrNull(item?.amount, 0, 1_000_000_000);
      const label = text(item?.label, 60);
      if (!placement || amount === null) return fail(400, "invalid_prize");
      prizes.push({ placement, label: label || `Juara ${placement}`, amount });
    }
    await ctx.supabase.from("esport_prizes").delete().eq("tournament_id", id);
    for (const prize of prizes) {
      await ctx.supabase.from("esport_prizes").insert({
        id: crypto.randomUUID(),
        tournament_id: id,
        placement: prize.placement,
        label: prize.label,
        amount: prize.amount,
        created_at: now(),
      });
    }
    patch.prize_total = prizes.reduce((sum, p) => sum + p.amount, 0);
  }
  let bracket = null;
  if (ctx.body.status !== undefined) {
    const next = text(ctx.body.status, 20);
    const allowed = ESPORT_TRANSITIONS[next];
    if (!allowed || !allowed.includes(tournament.status)) return fail(409, "invalid_transition");
    if (next === "registration") {
      const prospectivePrize = patch.prize_total ?? (Number(tournament.prize_total) || 0);
      const approval = tournament.approval_status ?? "none";
      if (prospectivePrize > ESPORT_PRIZE_APPROVAL_THRESHOLD && approval !== "approved" && access.auth.rank < 6) {
        if (approval !== "pending") {
          await ctx.supabase
            .from("esport_tournaments")
            .update({ approval_status: "pending", approval_note: null, approved_by: null, approved_at: null, updated_at: now() })
            .eq("id", id);
        }
        return fail(409, "approval_required");
      }
    }
    if (next === "cancelled") {
      await ctx.supabase
        .from("esport_matches")
        .update({ status: "finished" })
        .eq("tournament_id", id)
        .in("status", ["live", "paused", "disputed"]);
    }
    if (next === "completed" && tournament.format === "swiss") {
      // Swiss tidak punya laga final — juara ditentukan dari pemuncak klasemen.
      const { data: regRows } = await ctx.supabase.from("esport_registrations").select("*").eq("tournament_id", id);
      const { data: matchRows } = await ctx.supabase.from("esport_matches").select("*").eq("tournament_id", id);
      const standings = esportStandings(regRows ?? [], matchRows ?? []);
      if (standings.length) {
        await ctx.supabase.from("esport_registrations").update({ status: "winner" }).eq("id", standings[0].regId);
      }
    }
    if (next === "completed" && tournament.format === "league") {
      // Liga berjalan tanpa bagan — juara adalah pemuncak klasemen poin.
      const { data: regRows } = await ctx.supabase.from("esport_registrations").select("*").eq("tournament_id", id);
      const { data: matchRows } = await ctx.supabase.from("esport_matches").select("*").eq("tournament_id", id);
      const standings = esportStandings(regRows ?? [], matchRows ?? []);
      if (standings.length) {
        await ctx.supabase.from("esport_registrations").update({ status: "winner" }).eq("id", standings[0].regId);
      }
    }
    if (next === "completed" && tournament.format === "battle_royale") {
      // Battle Royale: juara dari akumulasi poin lobby (placement + kill).
      const { data: matchRows } = await ctx.supabase.from("esport_matches").select("*").eq("tournament_id", id);
      const lobbyIds = (matchRows ?? []).filter((m) => m.stage === "lobby").map((m) => m.id);
      const brRows = [];
      for (const lobbyId of lobbyIds) {
        const { data: rows } = await ctx.supabase.from("esport_br_results").select("*").eq("match_id", lobbyId);
        brRows.push(...(rows ?? []));
      }
      const totals = new Map();
      for (const r of brRows) {
        const row = totals.get(r.registration_id) ?? { regId: r.registration_id, points: 0, kills: 0 };
        row.points += Number(r.points) || 0;
        row.kills += Number(r.kills) || 0;
        totals.set(r.registration_id, row);
      }
      const leader = [...totals.values()].sort((a, b) => b.points - a.points || b.kills - a.kills)[0];
      if (leader) {
        await ctx.supabase.from("esport_registrations").update({ status: "winner" }).eq("id", leader.regId);
      }
    }
    if (next === "bracket" && tournament.status === "registration") {
      // Sesuai spesifikasi: bagan dibuat otomatis saat pendaftaran ditutup.
      bracket = await esportAutoBuildBracket(ctx.supabase, { ...tournament, ...patch });
    }
    patch.status = next;
  }
  const { error } = await ctx.supabase.from("esport_tournaments").update(patch).eq("id", id);
  if (error) return fail(500, "server_error");
  return ok({ status: patch.status ?? tournament.status, ...(bracket ? { bracket } : {}) });
}

async function esportTournamentApprove(ctx) {
  const auth = await actor(ctx, 6);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const decision = text(ctx.body.decision, 20);
  if (!["approved", "rejected"].includes(decision)) return fail(400, "invalid_input");
  const { data: tournament } = await ctx.supabase.from("esport_tournaments").select("*").eq("id", id).maybeSingle();
  if (!tournament) return fail(404, "not_found");
  if ((tournament.approval_status ?? "none") !== "pending") return fail(409, "invalid_status");
  const { error } = await ctx.supabase
    .from("esport_tournaments")
    .update({
      approval_status: decision,
      approval_note: textOrNull(ctx.body.note, 400),
      approved_by: auth.account.id,
      approved_at: now(),
      updated_at: now(),
    })
    .eq("id", id);
  if (error) return fail(500, "server_error");
  return ok({ status: decision });
}

async function esportTournamentGet(ctx) {
  const id = text(ctx.body.id, 60);
  const { data: tournament } = await ctx.supabase.from("esport_tournaments").select("*").eq("id", id).maybeSingle();
  if (!tournament) return fail(404, "not_found");
  const { data: game } = await ctx.supabase.from("esport_games").select("*").eq("id", tournament.game_id).maybeSingle();
  const rows = await esportTournamentRows(ctx.supabase, id);
  const { regList, regMap, teamMap, matches, prizes, casters } = rows;
  // Promosi status pertandingan otomatis (check-in dibuka, mulai, walkover) saat data dibaca.
  const lifecycleChanged = await esportSweepMatchLifecycle(ctx.supabase, tournament, matches);
  if (lifecycleChanged) {
    // Promosi bisa mengubah status turnamen serta juara/eliminasi; muat ulang agar
    // respons baca ini sudah mencerminkan hasilnya, bukan data sebelum promosi.
    const { data: freshTournament } = await ctx.supabase.from("esport_tournaments").select("*").eq("id", id).maybeSingle();
    if (freshTournament) Object.assign(tournament, freshTournament);
    const { data: freshRegs } = await ctx.supabase.from("esport_registrations").select("*").eq("tournament_id", id);
    if (freshRegs) {
      for (const reg of regList) {
        const fresh = freshRegs.find((r) => r.id === reg.id);
        if (fresh) Object.assign(reg, fresh);
      }
    }
  }

  const matchGames = new Map();
  const brResults = new Map();
  for (const m of matches) {
    const { data: gameRows } = await ctx.supabase
      .from("esport_match_games")
      .select("*")
      .eq("match_id", m.id)
      .order("game_index", { ascending: true });
    if (gameRows?.length) matchGames.set(m.id, gameRows);
    const { data: brRows } = await ctx.supabase.from("esport_br_results").select("*").eq("match_id", m.id);
    if (brRows?.length) brResults.set(m.id, brRows);
  }
  const { data: streamRows } = await ctx.supabase
    .from("esport_streams")
    .select("*")
    .eq("tournament_id", id)
    .order("created_at", { ascending: true });

  let viewer = null;
  const authTry = await actor(ctx, 2);
  if (!authTry.error) viewer = authTry.account;
  const isCreator = Boolean(viewer && tournament.creator_id === viewer.id);
  const isAdmin = Boolean(viewer && authTry.rank >= 6);
  const canManage = isCreator || isAdmin;

  // Rincian anggaran bersifat internal penyelenggara — jangan bocorkan ke publik.
  const { data: budgetRows } = canManage
    ? await ctx.supabase
        .from("esport_budget_items")
        .select("*")
        .eq("tournament_id", id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const memberAccountIds = [];
  for (const reg of regList) memberAccountIds.push(...esportRosterOf(reg));
  const memberTeamIds = [...new Set(regList.map((r) => r.team_id))];
  const teamMemberRows = [];
  for (const teamId of memberTeamIds) {
    const { data: members } = await ctx.supabase.from("esport_team_members").select("*").eq("team_id", teamId);
    teamMemberRows.push(...(members ?? []));
  }
  const rosterAccountIds = [];
  for (const reg of regList) {
    const rosterIds = esportRosterOf(reg);
    if (rosterIds.length) rosterAccountIds.push(...rosterIds);
  }
  for (const m of teamMemberRows) rosterAccountIds.push(m.account_id);
  const names = await namesFor(ctx.supabase, rosterAccountIds);
  const memberByTeam = new Map();
  for (const m of teamMemberRows) {
    if (!memberByTeam.has(m.team_id)) memberByTeam.set(m.team_id, []);
    memberByTeam.get(m.team_id).push(m);
  }
  const creatorNames = await namesFor(ctx.supabase, [tournament.creator_id]);

  const publicReg = (reg) => {
    const team = teamMap.get(reg.team_id);
    const rosterIds = esportRosterOf(reg);
    const members = memberByTeam.get(reg.team_id) ?? [];
    return {
      id: reg.id,
      teamId: reg.team_id,
      teamName: team?.name ?? "Tim",
      teamTag: team?.tag ?? null,
      teamLogo: team?.logo_data ?? null,
      seed: reg.seed ?? null,
      status: reg.status,
      groupLabel: reg.group_label ?? null,
      registeredAt: reg.registered_at ?? null,
      checkedInAt: reg.checked_in_at ?? null,
      paymentStatus: reg.payment_status ?? "unpaid",
      paidAt: reg.paid_at ?? null,
      paymentNote: canManage ? reg.payment_note ?? null : null,
      roster: rosterIds.map((accountId) => {
        const member = members.find((m) => m.account_id === accountId);
        const info = names.get(accountId);
        return {
          accountId,
          name: info?.displayName ?? info?.nickname ?? "Pemain",
          nickname: info?.nickname ?? null,
          photoData: info?.photoData ?? null,
          memberRole: member?.member_role ?? "member",
          gameRole: member?.game_role ?? null,
          inGameName: member?.in_game_name ?? null,
          inGameId: member?.in_game_id ?? null,
          gameRank: member?.game_rank ?? null,
        };
      }),
    };
  };

  const myRegistrations = [];
  if (viewer) {
    for (const reg of regList) {
      const team = teamMap.get(reg.team_id);
      if (!team) continue;
      if (team.captain_id === viewer.id) {
        myRegistrations.push({
          registrationId: reg.id,
          teamId: team.id,
          teamName: team.name,
          isCaptain: true,
          status: reg.status,
          paymentStatus: reg.payment_status ?? "unpaid",
        });
        continue;
      }
      const { data: membership } = await ctx.supabase
        .from("esport_team_members")
        .select("id")
        .eq("team_id", team.id)
        .eq("account_id", viewer.id)
        .maybeSingle();
      if (membership) {
        myRegistrations.push({
          registrationId: reg.id,
          teamId: team.id,
          teamName: team.name,
          isCaptain: false,
          status: reg.status,
          paymentStatus: reg.payment_status ?? "unpaid",
        });
      }
    }
  }

  let disputes = [];
  if (canManage || myRegistrations.length) {
    const { data: disputeRows } = await ctx.supabase
      .from("esport_disputes")
      .select("*")
      .eq("tournament_id", id)
      .order("created_at", { ascending: false });
    const visible = canManage
      ? disputeRows ?? []
      : (disputeRows ?? []).filter((d) => myRegistrations.some((mr) => mr.registrationId === d.registration_id));
    const filedNames = await namesFor(ctx.supabase, visible.map((d) => d.filed_by));
    disputes = visible.map((d) => {
      const match = matches.find((m) => m.id === d.match_id);
      const reg = regMap.get(d.registration_id);
      const team = reg ? teamMap.get(reg.team_id) : null;
      const info = filedNames.get(d.filed_by);
      return {
        id: d.id,
        matchId: d.match_id,
        matchLabel: match ? `Ronde ${match.round}${match.group_label ? ` (Grup ${match.group_label})` : ""}` : null,
        teamName: team?.name ?? "Tim",
        filedByName: info?.displayName ?? info?.nickname ?? "Anggota",
        reason: d.reason,
        evidenceUrl: d.evidence_url ?? null,
        evidenceUrls: Array.isArray(d.evidence_urls) ? d.evidence_urls : [],
        status: d.status,
        resolution: d.resolution ?? null,
        createdAt: d.created_at,
        investigatedAt: d.investigated_at ?? null,
        resolvedAt: d.resolved_at ?? null,
      };
    });
  }

  // Penanda publik "sedang disengketakan" tanpa membocorkan isi/bukti sengketa.
  const { data: activeDisputeRows } = await ctx.supabase
    .from("esport_disputes")
    .select("match_id")
    .eq("tournament_id", id)
    .in("status", ["open", "investigating"]);
  const disputedMatchIds = new Set((activeDisputeRows ?? []).map((d) => d.match_id));

  const gameRow = game ?? null;
  const rosterMin = tournament.roster_min ?? gameRow?.team_size_min ?? 1;
  const rosterMax = tournament.roster_max ?? gameRow?.roster_max ?? 5;
  return ok({
    tournament: {
      id: tournament.id,
      title: tournament.title,
      description: tournament.description ?? null,
      format: tournament.format,
      status: tournament.status,
      maxTeams: tournament.max_teams,
      rosterMin,
      rosterMax,
      bestOf: tournament.best_of ?? 1,
      entryFee: Number(tournament.entry_fee) || 0,
      prizeTotal: Number(tournament.prize_total) || 0,
      rules: tournament.rules ?? null,
      streamUrl: tournament.stream_url ?? null,
      registrationCloseAt: tournament.registration_close_at ?? null,
      startAt: tournament.start_at ?? null,
      checkinWindowMinutes: tournament.checkin_window_minutes ?? 30,
      platform: tournament.platform ?? "mobile",
      bannerData: tournament.banner_data ?? null,
      tags: tournament.tags ?? null,
      category: tournament.category ?? "amateur",
      registrationOpenAt: tournament.registration_open_at ?? null,
      technicalMeetingAt: tournament.technical_meeting_at ?? null,
      qualifierStartAt: tournament.qualifier_start_at ?? null,
      mainEventStartAt: tournament.main_event_start_at ?? null,
      grandFinalAt: tournament.grand_final_at ?? null,
      timezone: tournament.timezone ?? "Asia/Jakarta",
      substituteMax: tournament.substitute_max ?? 0,
      requirements: tournament.requirements ?? null,
      fundingSource: tournament.funding_source ?? null,
      operationalBudget: Number(tournament.operational_budget) || 0,
      sponsorshipSlots: tournament.sponsorship_slots ?? null,
      rulesDetail: tournament.rules_detail ?? null,
      streamingConfig: tournament.streaming_config ?? null,
      approvalStatus: tournament.approval_status ?? "none",
      approvalNote: canManage ? tournament.approval_note ?? null : null,
      approvalThreshold: ESPORT_PRIZE_APPROVAL_THRESHOLD,
      gameMode: tournament.game_mode ?? gameRow?.mode ?? null,
      minPlayers: tournament.min_players ?? 1,
      currency: tournament.currency ?? "IDR",
      prizeStatus: tournament.prize_status ?? "pending",
      prizePaidAt: tournament.prize_paid_at ?? null,
      prizePayoutNote: tournament.prize_payout_note ?? null,
      createdAt: tournament.created_at,
      creatorId: tournament.creator_id,
      creatorName: creatorNames.get(tournament.creator_id)?.displayName ?? creatorNames.get(tournament.creator_id)?.nickname ?? "Penyelenggara",
      canManage,
    },
    game: gameRow
      ? {
          id: gameRow.id,
          slug: gameRow.slug,
          name: gameRow.name,
          mode: gameRow.mode,
          icon: gameRow.icon ?? null,
          teamSizeMin: gameRow.team_size_min,
          teamSizeMax: gameRow.team_size_max,
          rosterMax: gameRow.roster_max,
          developer: gameRow.developer ?? null,
          genre: gameRow.genre ?? null,
          platforms: gameRow.platforms ?? null,
          mapPool: gameRow.map_pool ?? null,
          bannerData: gameRow.banner_data ?? null,
          defaultFormat: gameRow.default_format ?? null,
          defaultRosterSize: gameRow.default_roster_size ?? null,
          minPlayers: gameRow.min_players ?? 1,
        }
      : null,
    prizes: prizes.map((p) => ({ id: p.id, placement: p.placement, label: p.label, amount: Number(p.amount) || 0 })),
    budgetItems: (budgetRows ?? []).map((b) => ({
      id: b.id,
      category: b.category ?? "OTHER",
      itemName: b.item_name,
      quantity: Number(b.quantity) || 0,
      estimatedCost: Number(b.estimated_cost) || 0,
    })),
    registrations: regList
      .filter((r) => !["withdrawn"].includes(r.status))
      .map(publicReg),
    matches: matches.map((m) => {
      const pub = esportPublicMatch(m, regMap, teamMap);
      pub.disputed = disputedMatchIds.has(m.id);
      const games = matchGames.get(m.id) ?? [];
      pub.games = games.map((g) => ({
        id: g.id,
        gameIndex: g.game_index,
        map: g.map ?? null,
        homeScore: Number(g.home_score) || 0,
        awayScore: Number(g.away_score) || 0,
        winnerRegId: g.winner_reg_id ?? null,
        durationMinutes: g.duration_minutes ?? null,
        bans: g.bans ?? [],
        picks: g.picks ?? [],
        notes: g.notes ?? null,
      }));
      pub.brResults = (brResults.get(m.id) ?? []).map((r) => ({
        registrationId: r.registration_id,
        placement: r.placement,
        kills: r.kills,
        placementPoints: r.placement_points,
        killPoints: r.kill_points,
        points: r.points,
      }));
      return pub;
    }),
    casters: casters.map((c) => ({
      id: c.id,
      name: c.name,
      slotLabel: c.slot_label ?? null,
      casterRole: c.caster_role ?? "main_caster",
      contact: c.contact ?? null,
      assignedMatchId: c.assigned_match_id ?? null,
    })),
    streams: (streamRows ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      platform: s.platform,
      url: s.url ?? null,
      currentMatchId: s.current_match_id ?? null,
      isActive: Boolean(s.is_active),
      createdAt: s.created_at,
    })),
    disputes,
    myRegistrations,
    permissions: {
      registrationOpen:
        tournament.status === "registration" &&
        (!tournament.registration_close_at || Date.parse(tournament.registration_close_at) > Date.now()) &&
        regList.filter((r) => ["registered", "checked_in"].includes(r.status)).length < tournament.max_teams,
    },
  });
}

// Simpan rincian anggaran turnamen (ganti seluruh daftar, seperti daftar hadiah).
// Kolom operational_budget disinkronkan ke total kategori non-hadiah agar angka
// ringkas di pengaturan tidak pernah menyimpang dari rinciannya.
async function esportBudgetSave(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await esportTournamentAccess(ctx, id);
  if (access.error) return access.error;
  const items = Array.isArray(ctx.body.items) ? ctx.body.items : null;
  if (!items || items.length > 100) return fail(400, "invalid_input");
  const rows = [];
  for (const item of items) {
    const name = text(item.itemName, 120);
    if (name.length < 2) return fail(400, "invalid_input");
    const quantity = intOrNull(item.quantity, 1, 9999);
    if (quantity === null) return fail(400, "invalid_input");
    const estimatedCost = intOrNull(item.estimatedCost, 0, 1_000_000_000);
    if (estimatedCost === null) return fail(400, "invalid_input");
    const rawCategory = typeof item.category === "string" ? item.category : "";
    rows.push({
      id: crypto.randomUUID(),
      tournament_id: id,
      category: ESPORT_BUDGET_CATEGORIES.includes(rawCategory) ? rawCategory : "OTHER",
      item_name: name,
      quantity,
      estimated_cost: estimatedCost,
      created_at: now(),
    });
  }
  await ctx.supabase.from("esport_budget_items").delete().eq("tournament_id", id);
  if (rows.length) {
    const { error } = await ctx.supabase.from("esport_budget_items").insert(rows);
    if (error) return fail(500, "server_error");
  }
  const totalEstimated = rows.reduce((sum, r) => sum + r.quantity * r.estimated_cost, 0);
  const operationalBudget = rows
    .filter((r) => r.category !== "PRIZE_POOL")
    .reduce((sum, r) => sum + r.quantity * r.estimated_cost, 0);
  const { error: syncError } = await ctx.supabase
    .from("esport_tournaments")
    .update({ operational_budget: operationalBudget, updated_at: now() })
    .eq("id", id);
  if (syncError) return fail(500, "server_error");
  return ok({ count: rows.length, totalEstimated, operationalBudget });
}

async function esportTeamsMine(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: allTeams } = await ctx.supabase.from("esport_teams").select("*").limit(500);
  const mine = [];
  for (const team of allTeams ?? []) {
    const { data: membership } = await ctx.supabase
      .from("esport_team_members")
      .select("id,member_role,game_role")
      .eq("team_id", team.id)
      .eq("account_id", auth.account.id)
      .maybeSingle();
    if (team.captain_id === auth.account.id || membership) mine.push({ team, membership });
  }
  const teamIds = mine.map((m) => m.team.id);
  const memberRows = [];
  for (const teamId of teamIds) {
    const { data: members } = await ctx.supabase.from("esport_team_members").select("*").eq("team_id", teamId);
    memberRows.push(...(members ?? []));
  }
  const regRows = [];
  for (const teamId of teamIds) {
    const { data: regs } = await ctx.supabase.from("esport_registrations").select("*").eq("team_id", teamId);
    regRows.push(...(regs ?? []));
  }
  const names = await namesFor(ctx.supabase, memberRows.map((m) => m.account_id));
  const { data: tournaments } = await ctx.supabase.from("esport_tournaments").select("id,title,status,format,game_id");
  const tournamentMap = new Map((tournaments ?? []).map((t) => [t.id, t]));
  const { data: games } = await ctx.supabase.from("esport_games").select("id,name,icon");
  const gameMap = new Map((games ?? []).map((g) => [g.id, g]));
  return ok({
    items: mine.map(({ team, membership }) => ({
      id: team.id,
      name: team.name,
      tag: team.tag ?? null,
      logo: team.logo_data ?? null,
      captainId: team.captain_id,
      isCaptain: team.captain_id === auth.account.id,
      myMemberRole: team.captain_id === auth.account.id ? "captain" : membership?.member_role ?? "member",
      myGameRole: membership?.game_role ?? null,
      createdAt: team.created_at,
      members: memberRows
        .filter((m) => m.team_id === team.id)
        .map((m) => {
          const info = names.get(m.account_id);
          return {
            accountId: m.account_id,
            name: info?.displayName ?? info?.nickname ?? "Anggota",
            nickname: info?.nickname ?? null,
            photoData: info?.photoData ?? null,
            memberRole: m.member_role,
            gameRole: m.game_role ?? null,
            inGameName: m.in_game_name ?? null,
            inGameId: m.in_game_id ?? null,
            gameRank: m.game_rank ?? null,
          };
        }),
      registrations: regRows
        .filter((r) => r.team_id === team.id)
        .map((r) => {
          const tournament = tournamentMap.get(r.tournament_id);
          const game = tournament ? gameMap.get(tournament.game_id) : null;
          return {
            registrationId: r.id,
            tournamentId: r.tournament_id,
            tournamentTitle: tournament?.title ?? "Turnamen",
            tournamentStatus: tournament?.status ?? null,
            format: tournament?.format ?? null,
            gameName: game?.name ?? null,
            gameIcon: game?.icon ?? null,
            status: r.status,
            paymentStatus: r.payment_status ?? "unpaid",
            roster: esportRosterOf(r),
          };
        }),
    })),
  });
}

async function esportTeamCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const name = text(ctx.body.name, 40);
  if (name.length < 2) return fail(400, "invalid_input");
  const tag = text(ctx.body.tag, 6).toUpperCase() || null;
  const logo = typeof ctx.body.logo === "string" && ctx.body.logo.startsWith("data:image/") ? ctx.body.logo : null;
  if (logo && logo.length > 400_000) return fail(400, "invalid_photo");
  const { data: existing } = await ctx.supabase.from("esport_teams").select("id").eq("name", name);
  if ((existing ?? []).length) return fail(409, "team_name_taken");
  const id = crypto.randomUUID();
  const { error } = await ctx.supabase.from("esport_teams").insert({
    id,
    name,
    tag,
    logo_data: logo,
    captain_id: auth.account.id,
    created_at: now(),
    updated_at: now(),
  });
  if (error) return fail(500, "server_error");
  await ctx.supabase.from("esport_team_members").insert({
    id: crypto.randomUUID(),
    team_id: id,
    account_id: auth.account.id,
    member_role: "captain",
    game_role: null,
    joined_at: now(),
  });
  return ok({ id });
}

async function esportTeamGet(ctx) {
  const teamId = text(ctx.body.teamId, 60);
  const { data: team } = await ctx.supabase.from("esport_teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) return fail(404, "not_found");
  const { data: members } = await ctx.supabase.from("esport_team_members").select("*").eq("team_id", teamId);
  const names = await namesFor(ctx.supabase, (members ?? []).map((m) => m.account_id));
  return ok({
    team: {
      id: team.id,
      name: team.name,
      tag: team.tag ?? null,
      logo: team.logo_data ?? null,
      captainId: team.captain_id,
      createdAt: team.created_at,
      members: (members ?? []).map((m) => {
        const info = names.get(m.account_id);
        return {
          accountId: m.account_id,
          name: info?.displayName ?? info?.nickname ?? "Anggota",
          nickname: info?.nickname ?? null,
          photoData: info?.photoData ?? null,
          memberRole: m.member_role,
          gameRole: m.game_role ?? null,
          inGameName: m.in_game_name ?? null,
          inGameId: m.in_game_id ?? null,
          gameRank: m.game_rank ?? null,
        };
      }),
    },
  });
}

async function esportTeamMemberCandidates(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const teamId = text(ctx.body.teamId, 60);
  const { data: team } = await ctx.supabase.from("esport_teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) return fail(404, "not_found");
  if (team.captain_id !== auth.account.id && auth.rank < 6) return fail(403, "not_team_captain");
  const q = text(ctx.body.q, 80).toLowerCase();
  if (q.length < 2) return ok({ items: [] });
  const { data: accounts } = await ctx.supabase
    .from("accounts")
    .select("id,display_name,role,status")
    .eq("status", "active")
    .limit(300);
  const eligible = (accounts ?? []).filter((a) => (ROLE_RANK[a.role] ?? 0) >= 2);
  const { data: existing } = await ctx.supabase.from("esport_team_members").select("account_id").eq("team_id", teamId);
  const taken = new Set((existing ?? []).map((r) => r.account_id));
  const names = await namesFor(ctx.supabase, eligible.map((a) => a.id));
  const items = eligible
    .filter((a) => !taken.has(a.id))
    .map((a) => {
      const info = names.get(a.id);
      return {
        accountId: a.id,
        name: info?.displayName ?? info?.nickname ?? "Anggota",
        nickname: info?.nickname ?? null,
        role: a.role,
        tier: info?.tier ?? null,
        photoData: info?.photoData ?? null,
      };
    })
    .filter((item) => [item.name, item.nickname ?? ""].some((v) => v.toLowerCase().includes(q)))
    .slice(0, 10);
  return ok({ items });
}

async function esportTeamMemberAdd(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const teamId = text(ctx.body.teamId, 60);
  const accountId = text(ctx.body.accountId, 60);
  if (!teamId || !accountId) return fail(400, "invalid_input");
  const { data: team } = await ctx.supabase.from("esport_teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) return fail(404, "not_found");
  if (team.captain_id !== auth.account.id && auth.rank < 6) return fail(403, "not_team_captain");
  const { data: targetAccount } = await ctx.supabase.from("accounts").select("id,role,status").eq("id", accountId).maybeSingle();
  if (!targetAccount || targetAccount.status !== "active" || (ROLE_RANK[targetAccount.role] ?? 0) < 2) {
    return fail(400, "committee_members_only");
  }
  const { data: memberRows } = await ctx.supabase.from("esport_team_members").select("id,account_id").eq("team_id", teamId);
  if ((memberRows ?? []).length >= 15) return fail(409, "member_limit_reached");
  if ((memberRows ?? []).some((m) => m.account_id === accountId)) return fail(409, "already_team_member");
  const { error } = await ctx.supabase.from("esport_team_members").insert({
    id: crypto.randomUUID(),
    team_id: teamId,
    account_id: accountId,
    member_role: "member",
    game_role: null,
    joined_at: now(),
  });
  if (error) return fail(500, "server_error");
  await notify(ctx.supabase, accountId, "esport_team", auth.account.id, `Anda ditambahkan ke tim "${team.name}"`, `#/kompetisi-esport/tim`);
  return ok({ added: true });
}

async function esportTeamMemberRemove(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const teamId = text(ctx.body.teamId, 60);
  const accountId = text(ctx.body.accountId, 60);
  const { data: team } = await ctx.supabase.from("esport_teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) return fail(404, "not_found");
  if (team.captain_id !== auth.account.id && auth.rank < 6) return fail(403, "not_team_captain");
  if (accountId === team.captain_id) return fail(409, "cannot_remove_captain");
  await ctx.supabase.from("esport_team_members").delete().eq("team_id", teamId).eq("account_id", accountId);
  return ok({ removed: true });
}

async function esportTeamMemberRole(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const teamId = text(ctx.body.teamId, 60);
  const accountId = text(ctx.body.accountId, 60);
  const memberRole = text(ctx.body.memberRole, 12) || "member";
  const gameRole = textOrNull(ctx.body.gameRole, 20);
  if (!ESPORT_MEMBER_ROLES.includes(memberRole)) return fail(400, "invalid_role");
  const { data: team } = await ctx.supabase.from("esport_teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) return fail(404, "not_found");
  if (team.captain_id !== auth.account.id && auth.rank < 6) return fail(403, "not_team_captain");
  if (accountId === team.captain_id) return fail(409, "cannot_change_chair");
  const gameInfo = esportMemberGameInfoOf(ctx.body.gameInfo);
  const patch = { member_role: memberRole, game_role: gameRole };
  if (gameInfo) {
    patch.in_game_name = gameInfo.inGameName;
    patch.in_game_id = gameInfo.inGameId;
    patch.game_rank = gameInfo.gameRank;
  }
  await ctx.supabase
    .from("esport_team_members")
    .update(patch)
    .eq("team_id", teamId)
    .eq("account_id", accountId);
  return ok({ updated: true });
}

async function esportRegistrationCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const tournamentId = text(ctx.body.tournamentId, 60);
  const teamId = text(ctx.body.teamId, 60);
  if (!tournamentId || !teamId) return fail(400, "invalid_input");
  const { data: tournament } = await ctx.supabase.from("esport_tournaments").select("*").eq("id", tournamentId).maybeSingle();
  if (!tournament) return fail(404, "not_found");
  if (tournament.status !== "registration") return fail(409, "registration_closed");
  if (tournament.registration_close_at && Date.parse(tournament.registration_close_at) < Date.now()) {
    return fail(409, "registration_closed");
  }
  const { data: team } = await ctx.supabase.from("esport_teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) return fail(404, "not_found");
  if (team.captain_id !== auth.account.id && auth.rank < 6) return fail(403, "not_team_captain");
  const { data: game } = await ctx.supabase.from("esport_games").select("*").eq("id", tournament.game_id).maybeSingle();
  const { data: existingRegs } = await ctx.supabase.from("esport_registrations").select("*").eq("tournament_id", tournamentId);
  const activeRegs = (existingRegs ?? []).filter((r) => !["withdrawn", "disqualified", "waitlist"].includes(r.status));
  const slotRegs = (existingRegs ?? []).filter((r) => ["registered", "checked_in"].includes(r.status));
  const isFull = slotRegs.length >= tournament.max_teams;
  if ((existingRegs ?? []).some((r) => r.team_id === teamId && !["withdrawn"].includes(r.status))) {
    return fail(409, "already_registered");
  }
  const { data: memberRows } = await ctx.supabase.from("esport_team_members").select("*").eq("team_id", teamId);
  const teamMemberIds = new Set((memberRows ?? []).map((m) => m.account_id));
  const rosterMin = tournament.roster_min ?? game?.team_size_min ?? 1;
  const rosterMax = tournament.roster_max ?? game?.roster_max ?? 5;
  let rosterIds = Array.isArray(ctx.body.rosterAccountIds)
    ? [...new Set(ctx.body.rosterAccountIds.map((v) => text(v, 60)).filter(Boolean))]
    : (memberRows ?? []).filter((m) => !["coach", "manager"].includes(m.member_role)).map((m) => m.account_id);
  if (!rosterIds.length) return fail(400, "invalid_input");
  if (rosterIds.length < rosterMin) return fail(400, "roster_too_small");
  if (rosterIds.length > rosterMax) return fail(400, "roster_too_large");
  if (rosterIds.some((accountId) => !teamMemberIds.has(accountId))) return fail(400, "roster_not_member");
  const takenPlayers = new Set();
  for (const reg of activeRegs) {
    for (const accountId of esportRosterOf(reg)) takenPlayers.add(accountId);
  }
  if (rosterIds.some((accountId) => takenPlayers.has(accountId))) return fail(409, "player_registered_elsewhere");
  const registrationId = crypto.randomUUID();
  const entryFee = Number(tournament.entry_fee) || 0;
  const initialRegStatus = isFull ? "waitlist" : "registered";
  const { error } = await ctx.supabase.from("esport_registrations").insert({
    id: registrationId,
    tournament_id: tournamentId,
    team_id: teamId,
    seed: null,
    status: initialRegStatus,
    roster: JSON.stringify(rosterIds),
    group_label: null,
    registered_at: now(),
    checked_in_at: null,
    payment_status: entryFee > 0 ? "unpaid" : "paid",
    paid_at: null,
    payment_note: entryFee > 0 ? null : "Gratis (tanpa biaya pendaftaran)",
  });
  if (error) return fail(500, "server_error");
  await notify(
    ctx.supabase,
    tournament.creator_id,
    "esport_registration",
    auth.account.id,
    isFull
      ? `Tim "${team.name}" masuk daftar tunggu turnamen "${tournament.title}"`
      : `Tim "${team.name}" mendaftar ke turnamen "${tournament.title}"`,
    `#/kompetisi-esport/kelola/${tournamentId}`,
  );
  return ok({ registrationId, status: initialRegStatus });
}

async function esportRegistrationUpdate(ctx) {
  const registrationId = text(ctx.body.registrationId, 60);
  const { data: reg } = await ctx.supabase.from("esport_registrations").select("*").eq("id", registrationId).maybeSingle();
  if (!reg) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, reg.tournament_id);
  if (access.error) return access.error;
  const patch = {};
  if (ctx.body.seed !== undefined) {
    const seed = intOrNull(ctx.body.seed, 1, 128);
    if (seed === null) return fail(400, "invalid_input");
    patch.seed = seed;
  }
  if (ctx.body.status !== undefined) {
    const status = text(ctx.body.status, 20);
    if (!ESPORT_REG_STATUSES.includes(status)) return fail(400, "invalid_status");
    patch.status = status;
  }
  if (ctx.body.rosterAccountIds !== undefined) {
    const ids = Array.isArray(ctx.body.rosterAccountIds)
      ? [...new Set(ctx.body.rosterAccountIds.map((v) => text(v, 60)).filter(Boolean))]
      : [];
    if (!ids.length) return fail(400, "invalid_input");
    patch.roster = JSON.stringify(ids);
  }
  if (ctx.body.paymentStatus !== undefined) {
    const paymentStatus = text(ctx.body.paymentStatus, 20);
    if (!ESPORT_PAYMENT_STATUSES.includes(paymentStatus)) return fail(400, "invalid_status");
    patch.payment_status = paymentStatus;
    patch.paid_at = paymentStatus === "paid" ? reg.paid_at ?? now() : null;
    if (ctx.body.paymentNote !== undefined) patch.payment_note = textOrNull(ctx.body.paymentNote, 200);
  } else if (ctx.body.paymentNote !== undefined) {
    patch.payment_note = textOrNull(ctx.body.paymentNote, 200);
  }
  if (!Object.keys(patch).length) return fail(400, "invalid_input");
  await ctx.supabase.from("esport_registrations").update(patch).eq("id", registrationId);
  return ok({ updated: true, paymentStatus: patch.payment_status ?? reg.payment_status ?? "unpaid" });
}

async function esportRosterLevels(supabase, regs) {
  const ids = new Set();
  for (const reg of regs) {
    for (const accountId of esportRosterOf(reg)) ids.add(accountId);
  }
  if (!ids.size) return new Map();
  const { data } = await supabase.from("kpi_summary").select("*").in("account_id", [...ids]);
  const map = new Map();
  for (const row of data ?? []) map.set(row.account_id, Number(row.level) || 1);
  return map;
}

const esportRosterAvgLevel = (reg, levels) => {
  const roster = esportRosterOf(reg);
  if (!roster.length || !levels) return 0;
  let sum = 0;
  for (const accountId of roster) sum += levels.get(accountId) ?? 1;
  return sum / roster.length;
};

function esportSeededOrder(regs, mode, levels = null) {
  const list = [...regs];
  if (mode === "random") {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  if (mode === "manual") {
    return list.sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
  }
  if (mode === "rank") {
    // Unggulan dari rata-rata level anggota roster; seri → yang mendaftar lebih dulu.
    return list.sort(
      (a, b) =>
        esportRosterAvgLevel(b, levels) - esportRosterAvgLevel(a, levels) ||
        ((a.registered_at ?? "") < (b.registered_at ?? "") ? -1 : 1),
    );
  }
  return list.sort((a, b) => ((a.registered_at ?? "") < (b.registered_at ?? "") ? -1 : 1));
}

function esportMatchRow(tournamentId, fields) {
  return {
    id: crypto.randomUUID(),
    tournament_id: tournamentId,
    stage: fields.stage,
    round: fields.round,
    group_label: fields.groupLabel ?? null,
    match_index: fields.matchIndex,
    best_of: fields.bestOf,
    home_reg_id: fields.homeRegId ?? null,
    away_reg_id: fields.awayRegId ?? null,
    home_score: null,
    away_score: null,
    winner_reg_id: fields.winnerRegId ?? null,
    loser_reg_id: null,
    status: fields.status ?? "scheduled",
    scheduled_at: null,
    started_at: null,
    finished_at: fields.finishedAt ?? null,
    stream_url: null,
    caster_name: null,
    checkin_home_at: null,
    checkin_away_at: null,
    next_match_id: fields.nextMatchId ?? null,
    next_slot: fields.nextSlot ?? null,
    loser_next_match_id: fields.loserNextMatchId ?? null,
    loser_next_slot: fields.loserNextSlot ?? null,
    created_at: now(),
  };
}

function esportSeedPositions(size) {
  // Urutan posisi unggulan standar bagan: [1,2] → [1,4,2,3] → [1,8,4,5,2,7,3,6].
  // Menjamin unggulan teratas hanya bisa bertemu unggulan teratas lain di ronde final.
  if (size <= 2) return [1, 2];
  const prev = esportSeedPositions(size / 2);
  const out = [];
  for (const p of prev) out.push(p, size + 1 - p);
  return out;
}

function esportBuildSingleElim(tournamentId, seeds, bestOf, stage = "main", startRound = 1) {
  const n = seeds.length;
  const size = esportNextPow2(n);
  const rounds = Math.log2(size);
  const grid = [];
  for (let r = 0; r < rounds; r += 1) {
    const count = size / 2 ** (r + 1);
    const matches = [];
    for (let j = 0; j < count; j += 1) {
      matches.push(esportMatchRow(tournamentId, { stage, round: startRound + r, matchIndex: j + 1, bestOf }));
    }
    grid.push(matches);
  }
  const positions = esportSeedPositions(size);
  for (let j = 0; j < grid[0].length; j += 1) {
    const left = seeds[positions[j * 2] - 1] ?? null;
    const right = seeds[positions[j * 2 + 1] - 1] ?? null;
    // Bye (satu-satunya tim di pasangan) selalu ditempatkan di slot tuan rumah.
    const home = left ?? right;
    const away = left ? right : null;
    grid[0][j].home_reg_id = home;
    grid[0][j].away_reg_id = away;
    if (home && !away) {
      grid[0][j].status = "finished";
      grid[0][j].winner_reg_id = home;
      grid[0][j].finished_at = now();
    }
  }
  for (let r = 0; r < rounds - 1; r += 1) {
    for (let j = 0; j < grid[r].length; j += 1) {
      grid[r][j].next_match_id = grid[r + 1][Math.floor(j / 2)].id;
      grid[r][j].next_slot = j % 2 === 0 ? "home" : "away";
    }
  }
  for (let r = 0; r < rounds - 1; r += 1) {
    for (const match of grid[r]) {
      if (match.status === "finished" && match.winner_reg_id && match.next_match_id) {
        const target = grid[r + 1].find((m) => m.id === match.next_match_id);
        if (target) {
          if (match.next_slot === "home") target.home_reg_id = target.home_reg_id ?? match.winner_reg_id;
          else target.away_reg_id = target.away_reg_id ?? match.winner_reg_id;
        }
      }
    }
  }
  return grid.flat();
}

function esportBuildDoubleElim(tournamentId, seeds, bestOf) {
  const n = seeds.length;
  const size = esportNextPow2(n);
  const wbRounds = Math.log2(size);
  if (wbRounds < 2) return esportBuildSingleElim(tournamentId, seeds, bestOf);
  const wb = [];
  for (let r = 0; r < wbRounds; r += 1) {
    const count = size / 2 ** (r + 1);
    const matches = [];
    for (let j = 0; j < count; j += 1) {
      matches.push(esportMatchRow(tournamentId, { stage: "winners", round: r + 1, matchIndex: j + 1, bestOf }));
    }
    wb.push(matches);
  }
  const lbRoundCount = 2 * wbRounds - 2;
  const lb = [];
  for (let r = 0; r < lbRoundCount; r += 1) {
    const count = r === 0 ? size / 4 : r % 2 === 0 ? lb[r - 1].length / 2 : wb[(r + 1) / 2].length;
    const matches = [];
    for (let j = 0; j < count; j += 1) {
      matches.push(esportMatchRow(tournamentId, { stage: "losers", round: r + 1, matchIndex: j + 1, bestOf }));
    }
    lb.push(matches);
  }
  const grandFinal = esportMatchRow(tournamentId, { stage: "grand_final", round: 1, matchIndex: 1, bestOf });

  const wbPositions = esportSeedPositions(size);
  for (let j = 0; j < wb[0].length; j += 1) {
    const left = seeds[wbPositions[j * 2] - 1] ?? null;
    const right = seeds[wbPositions[j * 2 + 1] - 1] ?? null;
    const home = left ?? right;
    const away = left ? right : null;
    wb[0][j].home_reg_id = home;
    wb[0][j].away_reg_id = away;
    if (home && !away) {
      wb[0][j].status = "finished";
      wb[0][j].winner_reg_id = home;
      wb[0][j].finished_at = now();
    }
  }
  for (let r = 0; r < wbRounds - 1; r += 1) {
    for (let j = 0; j < wb[r].length; j += 1) {
      wb[r][j].next_match_id = wb[r + 1][Math.floor(j / 2)].id;
      wb[r][j].next_slot = j % 2 === 0 ? "home" : "away";
    }
  }
  wb[wbRounds - 1][0].next_match_id = grandFinal.id;
  wb[wbRounds - 1][0].next_slot = "home";
  for (let r = 0; r < wbRounds; r += 1) {
    for (let j = 0; j < wb[r].length; j += 1) {
      const target = r === 0 ? lb[0][Math.floor(j / 2)] : lb[2 * r - 1][j];
      wb[r][j].loser_next_match_id = target.id;
      wb[r][j].loser_next_slot = r === 0 ? (j % 2 === 0 ? "home" : "away") : "away";
    }
  }
  for (let r = 0; r < lbRoundCount; r += 1) {
    for (let j = 0; j < lb[r].length; j += 1) {
      if (r === lbRoundCount - 1) {
        lb[r][j].next_match_id = grandFinal.id;
        lb[r][j].next_slot = "away";
      } else if (r % 2 === 0) {
        lb[r][j].next_match_id = lb[r + 1][j].id;
        lb[r][j].next_slot = "home";
      } else {
        lb[r][j].next_match_id = lb[r + 1][Math.floor(j / 2)].id;
        lb[r][j].next_slot = j % 2 === 0 ? "home" : "away";
      }
    }
  }
  for (let r = 0; r < wbRounds - 1; r += 1) {
    for (const match of wb[r]) {
      if (match.status === "finished" && match.winner_reg_id && match.next_match_id) {
        const target = wb[r + 1].find((m) => m.id === match.next_match_id);
        if (target) {
          if (match.next_slot === "home") target.home_reg_id = target.home_reg_id ?? match.winner_reg_id;
          else target.away_reg_id = target.away_reg_id ?? match.winner_reg_id;
        }
      }
    }
  }
  return [...wb.flat(), ...lb.flat(), grandFinal];
}

function esportBuildRoundRobin(tournamentId, seeds, bestOf, stage = "rr", groupLabel = null) {
  const arr = [...seeds];
  const pinned = arr.shift() ?? null;
  const rotation = [...arr];
  if (rotation.length % 2 === 0) rotation.push(null);
  const teamCount = rotation.length + 1;
  const matches = [];
  const roundCount = teamCount - 1;
  const half = teamCount / 2;
  for (let r = 0; r < roundCount; r += 1) {
    const lineup = [pinned, ...rotation];
    let index = 1;
    for (let j = 0; j < half; j += 1) {
      const home = lineup[j];
      const away = lineup[teamCount - 1 - j];
      if (home && away) {
        matches.push(
          esportMatchRow(tournamentId, { stage, round: r + 1, groupLabel, matchIndex: index, bestOf, homeRegId: home, awayRegId: away }),
        );
        index += 1;
      }
    }
    rotation.unshift(rotation.pop() ?? null);
  }
  return matches;
}

function esportSwissPairs(orderedIds, history) {
  const pending = [...orderedIds];
  const pairs = [];
  while (pending.length) {
    const home = pending.shift();
    if (!pending.length) {
      pairs.push({ home, away: null });
      break;
    }
    let awayIndex = pending.findIndex((regId) => !(history.get(home)?.has(regId)));
    if (awayIndex === -1) awayIndex = 0;
    const away = pending.splice(awayIndex, 1)[0];
    pairs.push({ home, away });
  }
  return pairs;
}

function esportBuildSwissRound(tournamentId, round, pairs, bestOf) {
  return pairs.map((pair, index) => {
    const match = esportMatchRow(tournamentId, {
      stage: "main",
      round,
      matchIndex: index + 1,
      bestOf,
      homeRegId: pair.home,
      awayRegId: pair.away,
    });
    if (pair.home && !pair.away) {
      match.status = "finished";
      match.winner_reg_id = pair.home;
      match.finished_at = now();
    }
    return match;
  });
}

function esportStandings(regs, matches, groupLabel = null) {
  const table = new Map();
  const regMap = new Map(regs.map((r) => [r.id, r]));
  for (const reg of regs) {
    if (groupLabel && reg.group_label !== groupLabel) continue;
    table.set(reg.id, { regId: reg.id, played: 0, wins: 0, losses: 0, scoreFor: 0, scoreAgainst: 0, points: 0 });
  }
  for (const match of matches) {
    if (groupLabel && match.group_label !== groupLabel) continue;
    if (match.stage === "playoff") continue;
    const home = table.get(match.home_reg_id);
    const away = table.get(match.away_reg_id);
    if (!home || !away) continue;
    const played = match.status === "finished" && match.home_score !== null && match.away_score !== null;
    const walkover = match.status === "walkover" && Boolean(match.winner_reg_id);
    if (!played && !walkover) continue;
    home.played += 1;
    away.played += 1;
    if (played) {
      const hs = Number(match.home_score) || 0;
      const as = Number(match.away_score) || 0;
      home.scoreFor += hs;
      home.scoreAgainst += as;
      away.scoreFor += as;
      away.scoreAgainst += hs;
    }
    if (match.winner_reg_id === match.home_reg_id) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    }
  }
  for (const row of table.values()) {
    row.scoreDiff = row.scoreFor - row.scoreAgainst;
    row.seed = regMap.get(row.regId)?.seed ?? 999;
  }
  return [...table.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
    if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
    return a.seed - b.seed;
  });
}

async function esportInsertBracket(supabase, tournament, orderedRegs, opts = {}) {
  const id = tournament.id;
  const seeds = orderedRegs.map((r) => r.id);
  const bestOf = tournament.best_of ?? 1;
  if (tournament.format === "battle_royale") {
    // Battle Royale: N lobby, semua tim ikut di setiap lobby.
    // Hasil diisi lewat esport.matches.brResults (placement + kills).
    const lobbies = Math.max(1, Math.min(12, Number(opts.lobbies) || 3));
    const matches = [];
    for (let i = 0; i < lobbies; i += 1) {
      matches.push(esportMatchRow(id, { stage: "lobby", round: 1, matchIndex: i + 1, bestOf: 1 }));
    }
    const { error } = await supabase.from("esport_matches").insert(matches);
    if (error) return { error: "server_error" };
    return { matches, lobbies };
  }
  let matches = [];
  if (tournament.format === "single_elim") {
    matches = esportBuildSingleElim(id, seeds, bestOf);
  } else if (tournament.format === "double_elim") {
    matches = esportBuildDoubleElim(id, seeds, bestOf);
  } else if (tournament.format === "round_robin") {
    matches = esportBuildRoundRobin(id, seeds, bestOf);
  } else if (tournament.format === "league") {
    matches = esportBuildRoundRobin(id, seeds, bestOf, "league");
  } else if (tournament.format === "swiss") {
    matches = esportBuildSwissRound(id, 1, esportSwissPairs(seeds, new Map()), bestOf);
  } else if (tournament.format === "group_playoff") {
    const groupA = [];
    const groupB = [];
    seeds.forEach((regId, index) => {
      const slot = index % 4;
      if (slot === 0 || slot === 3) groupA.push(regId);
      else groupB.push(regId);
    });
    for (const reg of orderedRegs) {
      const label = groupA.includes(reg.id) ? "A" : "B";
      await supabase.from("esport_registrations").update({ group_label: label }).eq("id", reg.id);
    }
    matches = [
      ...esportBuildRoundRobin(id, groupA, bestOf, "group", "A"),
      ...esportBuildRoundRobin(id, groupB, bestOf, "group", "B"),
    ];
  } else {
    return { error: "invalid_format" };
  }
  if (!matches.length) return { error: "bracket_not_ready" };
  const { error } = await supabase.from("esport_matches").insert(matches);
  if (error) return { error: "server_error" };
  return { matches };
}

async function esportApplySeeds(supabase, orderedRegs) {
  for (let i = 0; i < orderedRegs.length; i += 1) {
    await supabase.from("esport_registrations").update({ seed: i + 1 }).eq("id", orderedRegs[i].id);
  }
}

// Bagan otomatis saat pendaftaran ditutup (transisi registration → bracket).
// Seeding memakai urutan pendaftaran agar hasilnya deterministik & mudah dijelaskan.
async function esportAutoBuildBracket(supabase, tournament) {
  const { data: regRows } = await supabase.from("esport_registrations").select("*").eq("tournament_id", tournament.id);
  const activeRegs = (regRows ?? []).filter((r) => ["registered", "checked_in"].includes(r.status));
  if (activeRegs.length < 2) return { skipped: "not_enough_teams" };
  if (tournament.format === "group_playoff" && activeRegs.length < 4) return { skipped: "not_enough_teams" };
  const { data: existing } = await supabase.from("esport_matches").select("*").eq("tournament_id", tournament.id);
  if ((existing ?? []).length) return { skipped: "bracket_exists" };
  const orderedRegs = esportSeededOrder(activeRegs, "registration");
  const built = await esportInsertBracket(supabase, tournament, orderedRegs);
  if (built.error) return { skipped: built.error };
  await esportApplySeeds(supabase, orderedRegs);
  const byes = built.matches.filter((m) => m.status === "finished").length;
  return { generated: built.matches.length, byes, lobbies: built.lobbies ?? null };
}

async function esportBracketGenerate(ctx) {
  const id = text(ctx.body.id, 60);
  const stage = text(ctx.body.stage, 20) || "main";
  const access = await esportTournamentAccess(ctx, id);
  if (access.error) return access.error;
  const { tournament } = access;
  const { data: regRows } = await ctx.supabase.from("esport_registrations").select("*").eq("tournament_id", id);
  const activeRegs = (regRows ?? []).filter((r) => ["registered", "checked_in"].includes(r.status));
  const existingMatches = (await ctx.supabase.from("esport_matches").select("*").eq("tournament_id", id)).data ?? [];

  if (tournament.format === "group_playoff" && stage === "playoff") {
    if (!["bracket", "ongoing"].includes(tournament.status)) return fail(409, "invalid_transition");
    if (existingMatches.some((m) => m.stage === "playoff")) return fail(409, "bracket_exists");
    const groupMatches = existingMatches.filter((m) => m.stage === "group");
    if (!groupMatches.length) return fail(409, "bracket_not_ready");
    if (groupMatches.some((m) => !esportMatchDone(m))) return fail(409, "groups_incomplete");
    const groups = [...new Set((regRows ?? []).map((r) => r.group_label).filter(Boolean))].sort();
    const qualifiers = [];
    for (const label of groups.slice(0, 2)) {
      const standings = esportStandings(regRows ?? [], existingMatches, label);
      if (standings.length < 2) return fail(409, "bracket_not_ready");
      qualifiers.push(standings[0].regId, standings[1].regId);
    }
    if (qualifiers.length < 4) return fail(409, "bracket_not_ready");
    // Semifinal silang dengan unggulan peringkat: A1 vs B2, B1 vs A2.
    const seeds = [qualifiers[0], qualifiers[2], qualifiers[1], qualifiers[3]];
    const matches = esportBuildSingleElim(id, seeds, tournament.best_of ?? 1, "playoff");
    const { error } = await ctx.supabase.from("esport_matches").insert(matches);
    if (error) return fail(500, "server_error");
    return ok({ generated: matches.length, stage: "playoff" });
  }

  if (!["registration", "bracket"].includes(tournament.status)) return fail(409, "invalid_transition");
  if (activeRegs.length < 2) return fail(409, "bracket_not_ready");
  if (tournament.format === "group_playoff" && activeRegs.length < 4) return fail(409, "bracket_not_ready");
  if (existingMatches.some((m) => esportMatchDone(m) || ["live", "paused", "disputed"].includes(m.status)))
    return fail(409, "bracket_exists");
  const seedingMode = text(ctx.body.seeding, 20) || "random";
  if (!ESPORT_SEEDING_MODES.includes(seedingMode)) return fail(400, "invalid_seeding");
  if (seedingMode === "manual" && activeRegs.some((r) => !r.seed)) return fail(400, "invalid_seeding");
  const levels = seedingMode === "rank" ? await esportRosterLevels(ctx.supabase, activeRegs) : null;
  // Satu daftar urutan dipakai untuk posisi bagan DAN nomor unggulan agar konsisten.
  const orderedRegs = esportSeededOrder(activeRegs, seedingMode, levels);
  if (existingMatches.length) {
    await ctx.supabase.from("esport_matches").delete().eq("tournament_id", id);
  }
  const built = await esportInsertBracket(ctx.supabase, tournament, orderedRegs, {
    lobbies: intOrNull(ctx.body.lobbies, 1, 12) ?? 3,
  });
  if (built.error) {
    const status = built.error === "invalid_format" ? 400 : built.error === "bracket_not_ready" ? 409 : 500;
    return fail(status, built.error);
  }
  if (tournament.status === "registration") {
    await ctx.supabase.from("esport_tournaments").update({ status: "bracket", updated_at: now() }).eq("id", id);
  }
  if (seedingMode !== "manual") {
    await esportApplySeeds(ctx.supabase, orderedRegs);
  }
  if (built.lobbies) {
    return ok({ generated: built.matches.length, lobbies: built.lobbies, stage: "lobby" });
  }
  const byeCount = built.matches.filter((m) => m.status === "finished").length;
  return ok({ generated: built.matches.length, byes: byeCount });
}

async function esportSwissNextRound(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await esportTournamentAccess(ctx, id);
  if (access.error) return access.error;
  const { tournament } = access;
  if (tournament.format !== "swiss") return fail(409, "invalid_format");
  if (!["bracket", "ongoing"].includes(tournament.status)) return fail(409, "invalid_transition");
  const { data: regRows } = await ctx.supabase.from("esport_registrations").select("*").eq("tournament_id", id);
  const activeRegs = (regRows ?? []).filter((r) => ["registered", "checked_in"].includes(r.status));
  if (activeRegs.length < 2) return fail(409, "bracket_not_ready");
  const existingMatches = (await ctx.supabase.from("esport_matches").select("*").eq("tournament_id", id)).data ?? [];
  const main = existingMatches.filter((m) => m.stage === "main");
  if (!main.length) return fail(409, "bracket_not_ready");
  const maxRound = Math.max(...main.map((m) => m.round));
  if (main.filter((m) => m.round === maxRound).some((m) => !esportMatchDone(m))) return fail(409, "round_incomplete");
  const history = new Map();
  const byeCounts = new Map();
  for (const m of main) {
    if (!m.home_reg_id || !m.away_reg_id) {
      const soloRegId = m.home_reg_id ?? m.away_reg_id;
      if (soloRegId) byeCounts.set(soloRegId, (byeCounts.get(soloRegId) ?? 0) + 1);
      continue;
    }
    if (!history.has(m.home_reg_id)) history.set(m.home_reg_id, new Set());
    if (!history.has(m.away_reg_id)) history.set(m.away_reg_id, new Set());
    history.get(m.home_reg_id).add(m.away_reg_id);
    history.get(m.away_reg_id).add(m.home_reg_id);
  }
  const ordered = esportStandings(activeRegs, main).map((row) => row.regId);
  if (ordered.length % 2 === 1) {
    // Beri bye ke tim dengan bye paling sedikit; seri diputuskan ke peringkat terbawah.
    let byeIndex = 0;
    for (let i = 1; i < ordered.length; i += 1) {
      if ((byeCounts.get(ordered[i]) ?? 0) <= (byeCounts.get(ordered[byeIndex]) ?? 0)) byeIndex = i;
    }
    ordered.push(...ordered.splice(byeIndex, 1));
  }
  const matches = esportBuildSwissRound(id, maxRound + 1, esportSwissPairs(ordered, history), tournament.best_of ?? 1);
  const { error } = await ctx.supabase.from("esport_matches").insert(matches);
  if (error) return fail(500, "server_error");
  return ok({
    round: maxRound + 1,
    generated: matches.length,
    byes: matches.filter((m) => m.status === "finished").length,
  });
}

async function esportAdvanceFromMatch(supabase, match, winnerRegId, loserRegId) {
  if (match.next_match_id && winnerRegId) {
    const column = match.next_slot === "away" ? "away_reg_id" : "home_reg_id";
    await supabase.from("esport_matches").update({ [column]: winnerRegId }).eq("id", match.next_match_id);
  }
  if (match.loser_next_match_id && loserRegId) {
    const column = match.loser_next_slot === "away" ? "away_reg_id" : "home_reg_id";
    await supabase.from("esport_matches").update({ [column]: loserRegId }).eq("id", match.loser_next_match_id);
    // Ronde pertama bracket loeser bisa berisi bye; jika sisi lain datang dari bye,
    // pertandingan otomatis diloloskan tanpa dimainkan.
    if (match.stage === "winners" && match.round === 1) {
      const { data: target } = await supabase.from("esport_matches").select("*").eq("id", match.loser_next_match_id).maybeSingle();
      if (target && target.stage === "losers" && target.round === 1 && target.status === "scheduled") {
        const j0 = (target.match_index ?? 1) - 1;
        const { data: siblings } = await supabase
          .from("esport_matches")
          .select("*")
          .eq("tournament_id", match.tournament_id)
          .eq("stage", "winners")
          .eq("round", 1);
        const homeSource = (siblings ?? []).find((m) => m.match_index === 2 * j0 + 1);
        const awaySource = (siblings ?? []).find((m) => m.match_index === 2 * j0 + 2);
        const homeBye = homeSource && homeSource.away_reg_id === null && homeSource.status === "finished";
        const awayBye = awaySource && awaySource.away_reg_id === null && awaySource.status === "finished";
        const filledHome = target.home_reg_id ?? null;
        const filledAway = target.away_reg_id ?? null;
        if ((homeBye && filledAway && !filledHome) || (awayBye && filledHome && !filledAway)) {
          const bypass = filledHome ?? filledAway;
          await supabase
            .from("esport_matches")
            .update({ status: "finished", winner_reg_id: bypass, finished_at: now() })
            .eq("id", target.id);
          await esportAdvanceFromMatch(supabase, { ...target, winner_reg_id: bypass }, bypass, null);
        }
      }
    }
  }
}

function esportMatchDone(match) {
  return match?.status === "finished" || match?.status === "walkover" || match?.status === "cancelled";
}

async function esportNotifyTeamCaptain(supabase, tournamentId, regId, actorId, message) {
  if (!regId) return;
  const { data: reg } = await supabase.from("esport_registrations").select("*").eq("id", regId).maybeSingle();
  if (!reg) return;
  const { data: team } = await supabase.from("esport_teams").select("*").eq("id", reg.team_id).maybeSingle();
  if (!team?.captain_id) return;
  await notify(supabase, team.captain_id, "esport_match", actorId, message, `#/kompetisi-esport/${tournamentId}`);
}

async function esportTeamNameOf(supabase, regId) {
  if (!regId) return null;
  const { data: reg } = await supabase.from("esport_registrations").select("*").eq("id", regId).maybeSingle();
  if (!reg) return null;
  const { data: team } = await supabase.from("esport_teams").select("*").eq("id", reg.team_id).maybeSingle();
  return team?.name ?? null;
}

async function esportMatchLabel(supabase, match) {
  const names = [];
  for (const regId of [match.home_reg_id, match.away_reg_id]) {
    const name = await esportTeamNameOf(supabase, regId);
    if (name) names.push(name);
  }
  return names.length ? names.join(" vs ") : "Pertandingan";
}

async function esportNotifyBothCaptains(supabase, tournamentId, match, message) {
  await esportNotifyTeamCaptain(supabase, tournamentId, match.home_reg_id, null, message);
  await esportNotifyTeamCaptain(supabase, tournamentId, match.away_reg_id, null, message);
}

// Aksi saat pertandingan mulai berjalan: hidupkan siaran yang tertaut ke laga ini
// dan beri tahu kedua tim bahwa pertandingan sudah dimulai.
async function esportOnMatchStarted(supabase, tournament, match) {
  await supabase
    .from("esport_streams")
    .update({ is_active: true })
    .eq("tournament_id", tournament.id)
    .eq("current_match_id", match.id);
  const label = await esportMatchLabel(supabase, match);
  await esportNotifyBothCaptains(
    supabase,
    tournament.id,
    match,
    `Pertandingan ${label} dimulai sekarang pada turnamen "${tournament.title}". Semoga beruntung!`,
  );
}

async function esportApplyWalkover(supabase, tournament, match, winnerRegId, actorId, reason) {
  const loserRegId = winnerRegId === match.home_reg_id ? match.away_reg_id : match.home_reg_id;
  const patch = {
    status: "walkover",
    winner_reg_id: winnerRegId,
    loser_reg_id: loserRegId,
    finished_at: now(),
  };
  await supabase.from("esport_matches").update(patch).eq("id", match.id);
  const updated = { ...match, ...patch };
  await esportAdvanceFromMatch(supabase, updated, winnerRegId, loserRegId);
  if (tournament.status === "bracket") {
    await supabase.from("esport_tournaments").update({ status: "ongoing", updated_at: now() }).eq("id", tournament.id);
  }
  const champion = await esportMaybeComplete(supabase, tournament, updated);
  await esportNotifyTeamCaptain(
    supabase,
    tournament.id,
    winnerRegId,
    actorId,
    `Tim Anda menang walkover (${reason}) pada turnamen "${tournament.title}"`,
  );
  await esportNotifyTeamCaptain(
    supabase,
    tournament.id,
    loserRegId,
    actorId,
    `Tim Anda kalah walkover (${reason}) pada turnamen "${tournament.title}"`,
  );
  return { updated, champion: champion ?? null };
}

// Transisi otomatis siklus hidup pertandingan, dijalankan saat data turnamen dibaca:
// terjadwal -> check-in dibuka (H-window, kedua tim diberi tahu), kedua tim check-in -> live,
// satu tim hadir lewat jam mulai -> walkover, keduanya absen lewat masa tenggang -> dibatalkan.
async function esportSweepMatchLifecycle(supabase, tournament, matches) {
  const at = Date.now();
  const windowMinutes = tournament?.checkin_window_minutes ?? 30;
  let changed = false;
  for (const match of matches) {
    if (match.status === "scheduled" && match.scheduled_at && match.home_reg_id && match.away_reg_id) {
      const opensAt = Date.parse(match.scheduled_at) - windowMinutes * 60_000;
      if (Number.isFinite(opensAt) && at >= opensAt) {
        match.status = "checkin_open";
        await supabase.from("esport_matches").update({ status: "checkin_open" }).eq("id", match.id);
        const label = await esportMatchLabel(supabase, match);
        await esportNotifyBothCaptains(
          supabase,
          tournament.id,
          match,
          `Check-in dibuka untuk ${label} pada turnamen "${tournament.title}". Mulai ${new Date(match.scheduled_at).toLocaleString("id-ID")} — segera check-in!`,
        );
        changed = true;
      }
    }
    if (match.status === "checkin_open" && match.checkin_home_at && match.checkin_away_at) {
      match.status = "live";
      match.started_at = match.started_at ?? now();
      await supabase.from("esport_matches").update({ status: "live", started_at: match.started_at }).eq("id", match.id);
      if (tournament.status === "bracket") {
        await supabase.from("esport_tournaments").update({ status: "ongoing", updated_at: now() }).eq("id", tournament.id);
        tournament.status = "ongoing";
      }
      await esportOnMatchStarted(supabase, tournament, match);
      changed = true;
      continue;
    }
    if (match.status === "checkin_open" && match.scheduled_at && match.home_reg_id && match.away_reg_id) {
      const startMs = Date.parse(match.scheduled_at);
      const homeIn = Boolean(match.checkin_home_at);
      const awayIn = Boolean(match.checkin_away_at);
      if (Number.isFinite(startMs) && at >= startMs && homeIn !== awayIn) {
        const winnerRegId = homeIn ? match.home_reg_id : match.away_reg_id;
        const { updated } = await esportApplyWalkover(supabase, tournament, match, winnerRegId, null, "lawan tidak check-in");
        Object.assign(match, updated);
        changed = true;
      } else if (Number.isFinite(startMs) && at >= startMs + windowMinutes * 60_000 && !homeIn && !awayIn) {
        // Kedua tim sama-sama absen: batalkan otomatis agar turnamen tidak macet.
        // Penyelenggara bisa menjadwalkan ulang untuk membuka kembali pertandingan.
        const patch = { status: "cancelled", finished_at: now() };
        await supabase.from("esport_matches").update(patch).eq("id", match.id);
        Object.assign(match, patch);
        const label = await esportMatchLabel(supabase, match);
        await esportNotifyBothCaptains(
          supabase,
          tournament.id,
          match,
          `Pertandingan ${label} dibatalkan otomatis karena kedua tim tidak check-in pada turnamen "${tournament.title}". Hubungi penyelenggara untuk penjadwalan ulang.`,
        );
        await notify(
          supabase,
          tournament.creator_id,
          "esport_match",
          null,
          `Pertandingan ${label} di turnamen "${tournament.title}" dibatalkan otomatis (kedua tim tidak check-in). Jadwalkan ulang bila pertandingan tetap dilaksanakan.`,
          `#/kompetisi-esport/kelola/${tournament.id}`,
        );
        changed = true;
      }
    }
  }
  return changed;
}

async function esportBrLeaderOf(supabase, tournamentId) {
  const { data: matchRows } = await supabase.from("esport_matches").select("*").eq("tournament_id", tournamentId);
  const lobbies = (matchRows ?? []).filter((m) => m.stage === "lobby" && m.status === "finished");
  const totals = new Map();
  for (const lobby of lobbies) {
    const { data: brRows } = await supabase.from("esport_br_results").select("*").eq("match_id", lobby.id);
    for (const r of brRows ?? []) {
      const row = totals.get(r.registration_id) ?? { regId: r.registration_id, points: 0, kills: 0 };
      row.points += Number(r.points) || 0;
      row.kills += Number(r.kills) || 0;
      totals.set(r.registration_id, row);
    }
  }
  return [...totals.values()].sort((a, b) => b.points - a.points || b.kills - a.kills)[0]?.regId ?? null;
}

async function esportMaybeComplete(supabase, tournament, finishedMatch) {
  const { data: matches } = await supabase.from("esport_matches").select("*").eq("tournament_id", tournament.id);
  const list = matches ?? [];
  const completeAsLeader = async (leaderRegId) => {
    if (!leaderRegId) return null;
    await supabase.from("esport_tournaments").update({ status: "completed", updated_at: now() }).eq("id", tournament.id);
    await supabase.from("esport_registrations").update({ status: "winner" }).eq("id", leaderRegId);
    return leaderRegId;
  };
  if (tournament.format === "league") {
    const leagueMatches = list.filter((m) => m.stage === "league");
    if (!leagueMatches.length || leagueMatches.some((m) => !esportMatchDone(m))) return null;
    const { data: regRows } = await supabase.from("esport_registrations").select("*").eq("tournament_id", tournament.id);
    const standings = esportStandings(regRows ?? [], list);
    // Semua laga batal tanpa hasil: juara tidak bisa ditentukan otomatis.
    if (!standings.some((row) => row.wins > 0)) return null;
    return completeAsLeader(standings[0]?.regId ?? null);
  }
  if (tournament.format === "battle_royale") {
    const lobbies = list.filter((m) => m.stage === "lobby");
    if (!lobbies.length || lobbies.some((m) => m.status !== "finished")) return null;
    const leader = await esportBrLeaderOf(supabase, tournament.id);
    return completeAsLeader(leader);
  }
  let finalMatch = null;
  if (tournament.format === "single_elim") {
    const main = list.filter((m) => m.stage === "main");
    const maxRound = Math.max(...main.map((m) => m.round), 0);
    finalMatch = main.find((m) => m.round === maxRound) ?? null;
  } else if (tournament.format === "double_elim") {
    finalMatch = list.find((m) => m.stage === "grand_final") ?? null;
  } else if (tournament.format === "round_robin") {
    const rr = list.filter((m) => m.stage === "rr");
    if (rr.length && rr.every((m) => esportMatchDone(m))) finalMatch = finishedMatch;
  } else if (tournament.format === "group_playoff") {
    const playoff = list.filter((m) => m.stage === "playoff");
    const maxRound = Math.max(...playoff.map((m) => m.round), 0);
    finalMatch = playoff.find((m) => m.round === maxRound) ?? null;
  }
  if (!finalMatch || !esportMatchDone(finalMatch) || !finalMatch.winner_reg_id) return null;
  await supabase.from("esport_tournaments").update({ status: "completed", updated_at: now() }).eq("id", tournament.id);
  await supabase.from("esport_registrations").update({ status: "winner" }).eq("id", finalMatch.winner_reg_id);
  if (finalMatch.loser_reg_id) {
    await supabase.from("esport_registrations").update({ status: "eliminated" }).eq("id", finalMatch.loser_reg_id);
  }
  return finalMatch.winner_reg_id;
}

async function esportMatchUpdate(ctx) {
  const matchId = text(ctx.body.matchId, 60);
  const { data: match } = await ctx.supabase.from("esport_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, match.tournament_id);
  if (access.error) return access.error;
  const patch = {};
  if (ctx.body.scheduledAt !== undefined) patch.scheduled_at = esportTimestamp(ctx.body.scheduledAt);
  if (ctx.body.streamUrl !== undefined) patch.stream_url = textOrNull(ctx.body.streamUrl, 300);
  if (ctx.body.casterName !== undefined) patch.caster_name = textOrNull(ctx.body.casterName, 60);
  if (patch.scheduled_at) {
    const atMs = Date.parse(patch.scheduled_at);
    // Jadwal baru bisa membuka kembali laga yang batal otomatis (kedua tim absen)
    // atau yang baru masuk kembali ke luar jendela check-in.
    if (match.status === "cancelled" && atMs > Date.now()) {
      patch.status = "scheduled";
      patch.finished_at = null;
    } else if (
      match.status === "checkin_open" &&
      !match.checkin_home_at &&
      !match.checkin_away_at &&
      Date.now() < atMs - (access.tournament.checkin_window_minutes ?? 30) * 60_000
    ) {
      patch.status = "scheduled";
    }
  }
  if (ctx.body.bestOf !== undefined) {
    const bestOf = intOrNull(ctx.body.bestOf, 1, 9);
    if (!bestOf) return fail(400, "invalid_input");
    patch.best_of = bestOf;
  }
  let startedNow = false;
  if (ctx.body.status !== undefined) {
    const status = text(ctx.body.status, 20);
    if (status === "live") {
      if (!["scheduled", "checkin_open"].includes(match.status)) return fail(409, "invalid_status");
      patch.status = "live";
      patch.started_at = match.started_at ?? now();
      startedNow = true;
      if (access.tournament.status === "bracket") {
        await ctx.supabase.from("esport_tournaments").update({ status: "ongoing", updated_at: now() }).eq("id", match.tournament_id);
      }
    } else if (status === "scheduled") {
      if (!["live", "paused"].includes(match.status)) return fail(409, "invalid_status");
      patch.status = "scheduled";
      patch.started_at = null;
      patch.paused_at = null;
      patch.pause_note = null;
    } else {
      return fail(400, "invalid_status");
    }
  }
  if (!Object.keys(patch).length) return fail(400, "invalid_input");
  await ctx.supabase.from("esport_matches").update(patch).eq("id", matchId);
  if (startedNow) await esportOnMatchStarted(ctx.supabase, access.tournament, { ...match, status: "live" });
  return ok({ updated: true });
}

async function esportMatchesSchedule(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await esportTournamentAccess(ctx, id);
  if (access.error) return access.error;
  const baseAt = esportTimestamp(ctx.body.scheduledAt);
  if (!baseAt) return fail(400, "invalid_input");
  const gapMinutes = intOrNull(ctx.body.gapMinutes, 5, 240) ?? 60;
  const stage = text(ctx.body.stage, 20);
  const round = intOrNull(ctx.body.round, 1, 40);
  const bestOf = ctx.body.bestOf !== undefined ? intOrNull(ctx.body.bestOf, 1, 9) : null;
  const { data: matchRows } = await ctx.supabase.from("esport_matches").select("*").eq("tournament_id", id);
  let targets = matchRows ?? [];
  if (round) targets = targets.filter((m) => m.round === round);
  if (stage) targets = targets.filter((m) => m.stage === stage);
  if (!targets.length) return fail(404, "no_matches");
  targets = [...targets].sort((a, b) => {
    if ((a.group_label ?? "") !== (b.group_label ?? "")) return (a.group_label ?? "") < (b.group_label ?? "") ? -1 : 1;
    if (a.round !== b.round) return a.round - b.round;
    return (a.match_index ?? 0) - (b.match_index ?? 0);
  });
  const baseMs = Date.parse(baseAt);
  const windowMinutes = access.tournament.checkin_window_minutes ?? 30;
  for (let i = 0; i < targets.length; i += 1) {
    const atMs = baseMs + i * gapMinutes * 60_000;
    const patch = { scheduled_at: new Date(atMs).toISOString() };
    if (bestOf) patch.best_of = bestOf;
    const target = targets[i];
    // Jadwal digeser keluar dari jendela check-in: buka kembali status terjadwal
    // selama belum ada tim yang check-in.
    if (
      target.status === "checkin_open" &&
      !target.checkin_home_at &&
      !target.checkin_away_at &&
      Date.now() < atMs - windowMinutes * 60_000
    ) {
      patch.status = "scheduled";
    }
    // Pertandingan yang batal otomatis (kedua tim absen) dibuka kembali oleh jadwal baru.
    if (target.status === "cancelled" && atMs > Date.now()) {
      patch.status = "scheduled";
      patch.finished_at = null;
    }
    await ctx.supabase.from("esport_matches").update(patch).eq("id", target.id);
  }
  return ok({ scheduled: targets.length, firstAt: baseAt, gapMinutes });
}

async function esportMatchScore(ctx) {
  const matchId = text(ctx.body.matchId, 60);
  const { data: match } = await ctx.supabase.from("esport_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, match.tournament_id);
  if (access.error) return access.error;
  if (access.tournament.format === "battle_royale") return fail(409, "invalid_format");
  if (!["scheduled", "checkin_open", "live", "paused", "walkover"].includes(match.status)) return fail(409, "match_finished");
  if (!match.home_reg_id || !match.away_reg_id) return fail(409, "match_not_ready");
  // Koreksi hasil walkover: kosongkan slot lanjutan dulu agar pemenang baru tidak dobel
  // di ronde berikutnya, dan tolak bila pertandingan lanjutan sudah selesai.
  if (match.status === "walkover") {
    if (match.next_match_id) {
      const { data: nextMatch } = await ctx.supabase.from("esport_matches").select("status").eq("id", match.next_match_id).maybeSingle();
      if (nextMatch && esportMatchDone(nextMatch)) return fail(409, "downstream_locked");
      const column = match.next_slot === "away" ? "away_reg_id" : "home_reg_id";
      await ctx.supabase.from("esport_matches").update({ [column]: null }).eq("id", match.next_match_id);
    }
    if (match.loser_next_match_id && match.loser_reg_id) {
      const { data: loserMatch } = await ctx.supabase.from("esport_matches").select("status").eq("id", match.loser_next_match_id).maybeSingle();
      if (loserMatch && esportMatchDone(loserMatch)) return fail(409, "downstream_locked");
      const column = match.loser_next_slot === "away" ? "away_reg_id" : "home_reg_id";
      await ctx.supabase.from("esport_matches").update({ [column]: null }).eq("id", match.loser_next_match_id);
    }
  }
  const result = esportResultFor(match.best_of ?? 1, ctx.body.homeScore, ctx.body.awayScore);
  if (result.error) return fail(400, result.error);
  const homeRegId = match.home_reg_id;
  const awayRegId = match.away_reg_id;
  const winnerRegId = result.winnerSide === "home" ? homeRegId : awayRegId;
  const loserRegId = result.winnerSide === "home" ? awayRegId : homeRegId;
  await ctx.supabase
    .from("esport_matches")
    .update({
      home_score: Number(ctx.body.homeScore),
      away_score: Number(ctx.body.awayScore),
      winner_reg_id: winnerRegId,
      loser_reg_id: loserRegId,
      status: "finished",
      started_at: match.started_at ?? now(),
      finished_at: now(),
    })
    .eq("id", matchId);
  const finishedMatch = { ...match, home_score: Number(ctx.body.homeScore), away_score: Number(ctx.body.awayScore), winner_reg_id: winnerRegId, loser_reg_id: loserRegId, status: "finished" };
  await esportAdvanceFromMatch(ctx.supabase, finishedMatch, winnerRegId, loserRegId);
  if (access.tournament.status === "bracket") {
    await ctx.supabase.from("esport_tournaments").update({ status: "ongoing", updated_at: now() }).eq("id", match.tournament_id);
  }
  const champion = await esportMaybeComplete(ctx.supabase, access.tournament, finishedMatch);
  return ok({ finished: true, winnerRegId, loserRegId, champion: champion ?? null });
}

async function esportMatchGameSave(ctx) {
  const matchId = text(ctx.body.matchId, 60);
  const { data: match } = await ctx.supabase.from("esport_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, match.tournament_id);
  if (access.error) return access.error;
  if (access.tournament.format === "battle_royale") return fail(409, "invalid_format");
  if (!["scheduled", "checkin_open", "live", "paused"].includes(match.status)) return fail(409, "match_finished");
  if (!match.home_reg_id || !match.away_reg_id) return fail(409, "match_not_ready");
  const homeScore = intOrNull(ctx.body.homeScore, 0, 99);
  const awayScore = intOrNull(ctx.body.awayScore, 0, 99);
  if (homeScore === null || awayScore === null) return fail(400, "invalid_score");
  if (homeScore === awayScore) return fail(400, "tied_score");
  const { data: existingGames } = await ctx.supabase
    .from("esport_match_games")
    .select("*")
    .eq("match_id", matchId)
    .order("game_index", { ascending: true });
  const games = existingGames ?? [];
  const gameIndex = intOrNull(ctx.body.gameIndex, 1, 9) ?? games.length + 1;
  const fields = {
    map: textOrNull(ctx.body.map, 60),
    home_score: homeScore,
    away_score: awayScore,
    winner_reg_id: homeScore > awayScore ? match.home_reg_id : match.away_reg_id,
    duration_minutes: intOrNull(ctx.body.durationMinutes, 0, 600),
    bans: words(ctx.body.bans, 20, 40),
    picks: words(ctx.body.picks, 20, 40),
    notes: textOrNull(ctx.body.notes, 300),
  };
  const sameIndex = games.find((g) => g.game_index === gameIndex);
  if (sameIndex) {
    await ctx.supabase.from("esport_match_games").update(fields).eq("id", sameIndex.id);
  } else {
    await ctx.supabase.from("esport_match_games").insert({
      id: crypto.randomUUID(),
      match_id: matchId,
      game_index: gameIndex,
      ...fields,
      created_at: now(),
    });
  }
  const { data: freshGames } = await ctx.supabase.from("esport_match_games").select("*").eq("match_id", matchId);
  const list = freshGames ?? [];
  let homeWins = 0;
  let awayWins = 0;
  for (const g of list) {
    if (g.winner_reg_id === match.home_reg_id) homeWins += 1;
    else if (g.winner_reg_id === match.away_reg_id) awayWins += 1;
  }
  const needs = Math.floor((match.best_of ?? 1) / 2) + 1;
  const seriesDone = homeWins >= needs || awayWins >= needs;
  const patch = {
    home_score: homeWins,
    away_score: awayWins,
    started_at: match.started_at ?? now(),
  };
  let champion = null;
  if (seriesDone) {
    const winnerRegId = homeWins >= needs ? match.home_reg_id : match.away_reg_id;
    const loserRegId = homeWins >= needs ? match.away_reg_id : match.home_reg_id;
    patch.winner_reg_id = winnerRegId;
    patch.loser_reg_id = loserRegId;
    patch.status = "finished";
    patch.finished_at = now();
    patch.paused_at = null;
    patch.pause_note = null;
    await ctx.supabase.from("esport_matches").update(patch).eq("id", matchId);
    const finishedMatch = { ...match, ...patch };
    await esportAdvanceFromMatch(ctx.supabase, finishedMatch, winnerRegId, loserRegId);
    if (access.tournament.status === "bracket") {
      await ctx.supabase.from("esport_tournaments").update({ status: "ongoing", updated_at: now() }).eq("id", access.tournament.id);
    }
    champion = await esportMaybeComplete(ctx.supabase, access.tournament, finishedMatch);
  } else {
    if (match.status !== "live") patch.status = "live";
    patch.paused_at = null;
    patch.pause_note = null;
    await ctx.supabase.from("esport_matches").update(patch).eq("id", matchId);
    if (access.tournament.status === "bracket") {
      await ctx.supabase.from("esport_tournaments").update({ status: "ongoing", updated_at: now() }).eq("id", access.tournament.id);
    }
  }
  return ok({
    gameIndex,
    homeScore: homeWins,
    awayScore: awayWins,
    finished: seriesDone,
    champion: champion ?? null,
  });
}

async function esportBrResultsSave(ctx) {
  const matchId = text(ctx.body.matchId, 60);
  const { data: match } = await ctx.supabase.from("esport_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, match.tournament_id);
  if (access.error) return access.error;
  if (access.tournament.format !== "battle_royale") return fail(409, "invalid_format");
  const { data: regRows } = await ctx.supabase.from("esport_registrations").select("*").eq("tournament_id", match.tournament_id);
  // winner/eliminated tetap ikut: status itu terpasang setelah turnamen selesai,
  // sehingga koreksi hasil tetap memuat seluruh tim yang bertanding di lobi.
  const activeRegs = (regRows ?? []).filter((r) =>
    ["registered", "checked_in", "winner", "eliminated"].includes(r.status),
  );
  if (activeRegs.length < 2) return fail(409, "bracket_not_ready");
  const byRegId = new Map(activeRegs.map((r) => [r.id, r]));
  const results = Array.isArray(ctx.body.results) ? ctx.body.results : [];
  const rows = [];
  const seenRegs = new Set();
  const seenPlacements = new Set();
  for (const item of results) {
    const registrationId = text(item?.registrationId, 60);
    if (!byRegId.has(registrationId) || seenRegs.has(registrationId)) return fail(400, "invalid_input");
    const placement = intOrNull(item?.placement, 1, 100);
    const kills = intOrNull(item?.kills, 0, 200) ?? 0;
    if (!placement || seenPlacements.has(placement)) return fail(400, "invalid_input");
    seenRegs.add(registrationId);
    seenPlacements.add(placement);
    const pts = esportBrPointsOf(placement, kills);
    rows.push({
      id: crypto.randomUUID(),
      match_id: matchId,
      registration_id: registrationId,
      placement,
      kills,
      placement_points: pts.placementPoints,
      kill_points: pts.killPoints,
      points: pts.points,
      created_at: now(),
    });
  }
  if (rows.length !== activeRegs.length) return fail(400, "invalid_input");
  await ctx.supabase.from("esport_br_results").delete().eq("match_id", matchId);
  const { error } = await ctx.supabase.from("esport_br_results").insert(rows);
  if (error) return fail(500, "server_error");
  const winnerRegId = rows.find((r) => r.placement === 1)?.registration_id ?? null;
  await ctx.supabase
    .from("esport_matches")
    .update({ status: "finished", winner_reg_id: winnerRegId, started_at: match.started_at ?? now(), finished_at: now() })
    .eq("id", matchId);
  let champion = null;
  if (access.tournament.status === "bracket") {
    await ctx.supabase.from("esport_tournaments").update({ status: "ongoing", updated_at: now() }).eq("id", access.tournament.id);
  }
  if (access.tournament.status !== "completed") {
    champion = await esportMaybeComplete(ctx.supabase, { ...access.tournament, status: access.tournament.status === "bracket" ? "ongoing" : access.tournament.status }, { ...match, status: "finished" });
  } else {
    // Koreksi hasil pada turnamen selesai: juara dihitung ulang dari klasemen lobi.
    const leader = await esportBrLeaderOf(ctx.supabase, access.tournament.id);
    const currentWinner = (regRows ?? []).find((r) => r.status === "winner");
    if (leader && currentWinner && currentWinner.id !== leader) {
      await ctx.supabase.from("esport_registrations").update({ status: "registered" }).eq("id", currentWinner.id);
      await ctx.supabase.from("esport_registrations").update({ status: "winner" }).eq("id", leader);
    } else if (leader && !currentWinner) {
      await ctx.supabase.from("esport_registrations").update({ status: "winner" }).eq("id", leader);
    }
    champion = leader;
  }
  return ok({ saved: rows.length, winnerRegId, champion: champion ?? null });
}

async function esportMatchCheckin(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const matchId = text(ctx.body.matchId, 60);
  const { data: match } = await ctx.supabase.from("esport_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return fail(404, "not_found");
  if (["finished", "walkover"].includes(match.status)) return fail(409, "match_finished");
  if (match.status === "cancelled") return fail(409, "match_cancelled");
  if (!match.home_reg_id && !match.away_reg_id) return fail(409, "match_not_ready");
  const { data: tournament } = await ctx.supabase.from("esport_tournaments").select("*").eq("id", match.tournament_id).maybeSingle();
  const checkinWindow = tournament?.checkin_window_minutes ?? 30;
  if (match.scheduled_at) {
    const opensAt = Date.parse(match.scheduled_at) - checkinWindow * 60_000;
    if (Date.now() < opensAt) return fail(409, "checkin_not_open");
  }
  const sides = [];
  for (const [side, regId] of [["home", match.home_reg_id], ["away", match.away_reg_id]]) {
    if (!regId) continue;
    const { data: reg } = await ctx.supabase.from("esport_registrations").select("*").eq("id", regId).maybeSingle();
    if (!reg) continue;
    const { data: team } = await ctx.supabase.from("esport_teams").select("*").eq("id", reg.team_id).maybeSingle();
    if (team && (team.captain_id === auth.account.id || auth.rank >= 6)) sides.push({ side, regId, reg, team });
  }
  if (!sides.length) return fail(403, "not_match_participant");
  const { side, reg, team } = sides[0];
  const column = side === "home" ? "checkin_home_at" : "checkin_away_at";
  const checkedInAt = match[column] ?? now();
  const bothCheckedIn = Boolean(side === "home" ? match.checkin_away_at : match.checkin_home_at);
  const patch = { [column]: checkedInAt };
  // Check-in pertama membuka status checkin_open; begitu kedua tim check-in,
  // pertandingan langsung dimulai tanpa menunggu sweep.
  let newStatus = match.status === "scheduled" ? "checkin_open" : match.status;
  if (bothCheckedIn && ["scheduled", "checkin_open"].includes(newStatus)) {
    newStatus = "live";
    patch.started_at = match.started_at ?? now();
  }
  if (newStatus !== match.status) patch.status = newStatus;
  await ctx.supabase.from("esport_matches").update(patch).eq("id", matchId);
  // Check-in pertama saat laga masih terjadwal membuka jendela — lawan diberi dorongan.
  if (match.status === "scheduled" && newStatus === "checkin_open" && tournament) {
    const opponentRegId = side === "home" ? match.away_reg_id : match.home_reg_id;
    const label = await esportMatchLabel(ctx.supabase, match);
    await esportNotifyTeamCaptain(
      ctx.supabase,
      match.tournament_id,
      opponentRegId,
      null,
      `Tim "${team.name}" sudah check-in untuk ${label} pada turnamen "${tournament.title}". Segera check-in agar pertandingan bisa dimulai!`,
    );
  }
  if (newStatus === "live" && match.status !== "live" && tournament) {
    if (tournament.status === "bracket") {
      await ctx.supabase.from("esport_tournaments").update({ status: "ongoing", updated_at: now() }).eq("id", match.tournament_id);
    }
    await esportOnMatchStarted(ctx.supabase, tournament, { ...match, status: "live" });
  }
  if (!reg.checked_in_at) {
    await ctx.supabase
      .from("esport_registrations")
      .update({ checked_in_at: checkedInAt, status: reg.status === "registered" ? "checked_in" : reg.status })
      .eq("id", reg.id);
  }
  await notify(
    ctx.supabase,
    match.tournament_id ? tournament?.creator_id : null,
    "esport_checkin",
    auth.account.id,
    `Tim "${team.name}" check-in untuk pertandingan${match.scheduled_at ? ` ${new Date(match.scheduled_at).toLocaleString("id-ID")}` : ""}`,
    `#/kompetisi-esport/kelola/${match.tournament_id}`,
  );
  return ok({ side, checkedInAt, bothCheckedIn, status: newStatus });
}

async function esportMatchPause(ctx) {
  const matchId = text(ctx.body.matchId, 60);
  const { data: match } = await ctx.supabase.from("esport_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, match.tournament_id);
  if (access.error) return access.error;
  if (match.status !== "live") return fail(409, "invalid_status");
  await ctx.supabase
    .from("esport_matches")
    .update({ status: "paused", paused_at: now(), pause_note: textOrNull(ctx.body.note, 200) })
    .eq("id", matchId);
  return ok({ status: "paused" });
}

async function esportMatchResume(ctx) {
  const matchId = text(ctx.body.matchId, 60);
  const { data: match } = await ctx.supabase.from("esport_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, match.tournament_id);
  if (access.error) return access.error;
  if (match.status !== "paused") return fail(409, "invalid_status");
  await ctx.supabase
    .from("esport_matches")
    .update({ status: "live", paused_at: null, pause_note: null })
    .eq("id", matchId);
  return ok({ status: "live" });
}

async function esportMatchWalkover(ctx) {
  const matchId = text(ctx.body.matchId, 60);
  const { data: match } = await ctx.supabase.from("esport_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, match.tournament_id);
  if (access.error) return access.error;
  if (!["scheduled", "checkin_open"].includes(match.status)) return fail(409, "invalid_status");
  if (!match.home_reg_id || !match.away_reg_id) return fail(409, "match_not_ready");
  const winnerRegId = text(ctx.body.winnerRegId, 60);
  if (winnerRegId !== match.home_reg_id && winnerRegId !== match.away_reg_id) return fail(400, "invalid_input");
  const { champion } = await esportApplyWalkover(
    ctx.supabase,
    access.tournament,
    match,
    winnerRegId,
    access.auth.account.id,
    "penetapan penyelenggara",
  );
  return ok({ winnerRegId, champion });
}

async function esportDisputesCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const matchId = text(ctx.body.matchId, 60);
  const { data: match } = await ctx.supabase.from("esport_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return fail(404, "not_found");
  if (!["live", "paused", "disputed", "finished", "walkover"].includes(match.status)) return fail(409, "invalid_status");
  const reason = text(ctx.body.reason, 500);
  if (reason.length < 5) return fail(400, "invalid_input");
  let filing = null;
  for (const regId of [match.home_reg_id, match.away_reg_id]) {
    if (!regId) continue;
    const { data: reg } = await ctx.supabase.from("esport_registrations").select("*").eq("id", regId).maybeSingle();
    if (!reg) continue;
    const { data: team } = await ctx.supabase.from("esport_teams").select("*").eq("id", reg.team_id).maybeSingle();
    if (team && team.captain_id === auth.account.id) filing = { reg, team };
  }
  if (!filing) return fail(403, "not_match_participant");
  const { data: existing } = await ctx.supabase.from("esport_disputes").select("*").eq("match_id", matchId).eq("registration_id", filing.reg.id).eq("status", "open");
  if ((existing ?? []).length) return fail(409, "dispute_exists");
  const evidenceUrls = Array.isArray(ctx.body.evidenceUrls)
    ? [...new Set(ctx.body.evidenceUrls.map((v) => text(v, 300)).filter(Boolean))].slice(0, 6)
    : [];
  const disputeId = crypto.randomUUID();
  await ctx.supabase.from("esport_disputes").insert({
    id: disputeId,
    tournament_id: match.tournament_id,
    match_id: matchId,
    filed_by: auth.account.id,
    registration_id: filing.reg.id,
    reason,
    evidence_url: textOrNull(ctx.body.evidenceUrl, 300) ?? evidenceUrls[0] ?? null,
    evidence_urls: evidenceUrls.length ? evidenceUrls : null,
    status: "open",
    resolution: null,
    resolved_by: null,
    resolved_at: null,
    investigated_at: null,
    created_at: now(),
  });
  const { data: tournament } = await ctx.supabase.from("esport_tournaments").select("*").eq("id", match.tournament_id).maybeSingle();
  // Pertandingan yang sedang berjalan dibekukan ke status disputed sampai sengketa selesai.
  let matchStatus = match.status;
  if (["live", "paused"].includes(match.status)) {
    matchStatus = "disputed";
    await ctx.supabase.from("esport_matches").update({ status: "disputed" }).eq("id", matchId);
  }
  if (tournament) {
    await notify(
      ctx.supabase,
      tournament.creator_id,
      "esport_dispute",
      auth.account.id,
      `Sengketa baru dari tim "${filing.team.name}" pada turnamen "${tournament.title}"`,
      `#/kompetisi-esport/kelola/${tournament.id}`,
    );
  }
  return ok({ disputeId, matchStatus });
}

async function esportDisputesResolve(ctx) {
  const disputeId = text(ctx.body.disputeId, 60);
  const { data: dispute } = await ctx.supabase.from("esport_disputes").select("*").eq("id", disputeId).maybeSingle();
  if (!dispute) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, dispute.tournament_id);
  if (access.error) return access.error;
  const decision = text(ctx.body.decision, 20);
  if (!["accepted", "rejected"].includes(decision)) return fail(400, "invalid_input");
  const resolution = text(ctx.body.resolution, 500);
  if (resolution.length < 3) return fail(400, "invalid_input");
  const { data: match } = await ctx.supabase.from("esport_matches").select("*").eq("id", dispute.match_id).maybeSingle();
  if (!match) return fail(404, "not_found");
  let matchStatus = match.status;
  if (decision === "accepted" && ctx.body.applyScore) {
    if (!["live", "paused", "disputed", "finished", "walkover"].includes(match.status)) return fail(409, "invalid_status");
    const result = esportResultFor(match.best_of ?? 1, ctx.body.applyScore.homeScore, ctx.body.applyScore.awayScore);
    if (result.error) return fail(400, result.error);
    if (match.next_match_id) {
      const { data: nextMatch } = await ctx.supabase.from("esport_matches").select("status").eq("id", match.next_match_id).maybeSingle();
      if (esportMatchDone(nextMatch)) return fail(409, "downstream_locked");
    }
    if (match.loser_next_match_id) {
      const { data: loserMatch } = await ctx.supabase.from("esport_matches").select("status").eq("id", match.loser_next_match_id).maybeSingle();
      if (esportMatchDone(loserMatch)) return fail(409, "downstream_locked");
    }
    if (match.next_match_id) {
      const column = match.next_slot === "away" ? "away_reg_id" : "home_reg_id";
      await ctx.supabase.from("esport_matches").update({ [column]: null }).eq("id", match.next_match_id);
    }
    if (match.loser_next_match_id && match.loser_reg_id) {
      const column = match.loser_next_slot === "away" ? "away_reg_id" : "home_reg_id";
      await ctx.supabase.from("esport_matches").update({ [column]: null }).eq("id", match.loser_next_match_id);
    }
    const homeRegId = match.home_reg_id;
    const awayRegId = match.away_reg_id;
    const winnerRegId = result.winnerSide === "home" ? homeRegId : awayRegId;
    const loserRegId = result.winnerSide === "home" ? awayRegId : homeRegId;
    await ctx.supabase
      .from("esport_matches")
      .update({
        home_score: Number(ctx.body.applyScore.homeScore),
        away_score: Number(ctx.body.applyScore.awayScore),
        winner_reg_id: winnerRegId,
        loser_reg_id: loserRegId,
        status: "finished",
        finished_at: now(),
        paused_at: null,
        pause_note: null,
      })
      .eq("id", match.id);
    matchStatus = "finished";
    const corrected = { ...match, home_score: Number(ctx.body.applyScore.homeScore), away_score: Number(ctx.body.applyScore.awayScore), winner_reg_id: winnerRegId, loser_reg_id: loserRegId };
    await esportAdvanceFromMatch(ctx.supabase, corrected, winnerRegId, loserRegId);
    await esportMaybeComplete(ctx.supabase, access.tournament, { ...corrected, status: "finished" });
  }
  await ctx.supabase
    .from("esport_disputes")
    .update({ status: decision === "accepted" ? "resolved" : "rejected", resolution, resolved_by: access.auth.account.id, resolved_at: now() })
    .eq("id", disputeId);
  // Bila tidak ada sengketa aktif tersisa, pertandingan yang dibekukan kembali berjalan.
  if (matchStatus === "disputed") {
    const { data: remaining } = await ctx.supabase
      .from("esport_disputes")
      .select("id")
      .eq("match_id", match.id)
      .in("status", ["open", "investigating"]);
    if (!(remaining ?? []).length) {
      const backTo = match.paused_at ? "paused" : "live";
      matchStatus = backTo;
      await ctx.supabase.from("esport_matches").update({ status: backTo }).eq("id", match.id);
    }
  }
  await notify(
    ctx.supabase,
    dispute.filed_by,
    "esport_dispute",
    access.auth.account.id,
    decision === "accepted" ? "Sengketa Anda diterima dan ditindaklanjuti" : "Sengketa Anda ditolak",
    `#/kompetisi-esport/${dispute.tournament_id}`,
  );
  return ok({ status: decision === "accepted" ? "resolved" : "rejected", matchStatus });
}

async function esportDisputesInvestigate(ctx) {
  const disputeId = text(ctx.body.disputeId, 60);
  const { data: dispute } = await ctx.supabase.from("esport_disputes").select("*").eq("id", disputeId).maybeSingle();
  if (!dispute) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, dispute.tournament_id);
  if (access.error) return access.error;
  if (dispute.status !== "open") return fail(409, "invalid_status");
  await ctx.supabase
    .from("esport_disputes")
    .update({ status: "investigating", investigated_at: now() })
    .eq("id", disputeId);
  await notify(
    ctx.supabase,
    dispute.filed_by,
    "esport_dispute",
    access.auth.account.id,
    "Sengketa Anda sedang diinvestigasi penyelenggara",
    `#/kompetisi-esport/${dispute.tournament_id}`,
  );
  return ok({ status: "investigating" });
}

async function esportTournamentPrizeStatus(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await esportTournamentAccess(ctx, id);
  if (access.error) return access.error;
  const { tournament } = access;
  const next = text(ctx.body.status, 20);
  if (!ESPORT_PRIZE_STATUSES.includes(next)) return fail(400, "invalid_status");
  const current = tournament.prize_status ?? "pending";
  if (next === current) return fail(409, "invalid_transition");
  if (next === "pending") {
    if (access.auth.rank < 6) return fail(409, "invalid_transition");
  } else {
    const allowed = ESPORT_PRIZE_TRANSITIONS[next];
    if (!allowed || !allowed.includes(current)) return fail(409, "invalid_transition");
  }
  const note = textOrNull(ctx.body.note, 300);
  const patch = {
    prize_status: next,
    updated_at: now(),
    prize_payout_note: note ?? (next === "pending" ? null : tournament.prize_payout_note ?? null),
    prize_paid_at: next === "completed" ? now() : next === "pending" ? null : tournament.prize_paid_at ?? null,
  };
  const { error } = await ctx.supabase.from("esport_tournaments").update(patch).eq("id", id);
  if (error) return fail(500, "server_error");
  return ok({ status: next });
}

async function esportStreamsList(ctx) {
  const id = text(ctx.body.tournamentId ?? ctx.body.id, 60);
  if (!id) return fail(400, "invalid_input");
  const { data } = await ctx.supabase.from("esport_streams").select("*").eq("tournament_id", id).order("created_at", { ascending: true });
  return ok({
    items: (data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      platform: s.platform,
      url: s.url ?? null,
      currentMatchId: s.current_match_id ?? null,
      isActive: Boolean(s.is_active),
      createdAt: s.created_at,
    })),
  });
}

async function esportStreamSave(ctx) {
  const id = text(ctx.body.tournamentId, 60);
  const access = await esportTournamentAccess(ctx, id);
  if (access.error) return access.error;
  const name = text(ctx.body.name, 80);
  if (name.length < 2) return fail(400, "invalid_input");
  const platform = esportEnumOrDefault(ctx.body.platform, ESPORT_STREAM_PLATFORMS, "youtube");
  if (!platform) return fail(400, "invalid_input");
  const streamId = text(ctx.body.streamId, 60);
  const patch = {
    name,
    platform,
    url: textOrNull(ctx.body.url, 300),
    current_match_id: textOrNull(ctx.body.currentMatchId, 60),
    is_active: Boolean(ctx.body.isActive),
  };
  if (streamId) {
    const { data: existing } = await ctx.supabase.from("esport_streams").select("id").eq("id", streamId).eq("tournament_id", id).maybeSingle();
    if (!existing) return fail(404, "not_found");
    await ctx.supabase.from("esport_streams").update(patch).eq("id", streamId);
    return ok({ id: streamId });
  }
  const newId = crypto.randomUUID();
  await ctx.supabase.from("esport_streams").insert({ id: newId, tournament_id: id, ...patch, created_at: now() });
  return ok({ id: newId });
}

async function esportStreamDelete(ctx) {
  const id = text(ctx.body.id, 60);
  const { data: stream } = await ctx.supabase.from("esport_streams").select("*").eq("id", id).maybeSingle();
  if (!stream) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, stream.tournament_id);
  if (access.error) return access.error;
  await ctx.supabase.from("esport_streams").delete().eq("id", id);
  return ok({ deleted: true });
}

// Siapkan kanal siaran standar sesuai skala turnamen: satu kanal utama, plus dua
// kanal paralel untuk turnamen >= 16 tim. Idempoten — nama yang sudah ada dilewati.
async function esportStreamsSetup(ctx) {
  const id = text(ctx.body.id ?? ctx.body.tournamentId, 60);
  const access = await esportTournamentAccess(ctx, id);
  if (access.error) return access.error;
  const defaults = ["Kanal Utama"];
  if ((Number(access.tournament.max_teams) || 0) >= 16) defaults.push("Siaran Paralel 1", "Siaran Paralel 2");
  const { data: existingRows } = await ctx.supabase.from("esport_streams").select("name").eq("tournament_id", id);
  const existing = new Set((existingRows ?? []).map((s) => String(s.name).trim().toLowerCase()));
  const created = [];
  const skipped = [];
  for (const name of defaults) {
    if (existing.has(name.toLowerCase())) {
      skipped.push(name);
      continue;
    }
    const { error } = await ctx.supabase.from("esport_streams").insert({
      id: crypto.randomUUID(),
      tournament_id: id,
      name,
      platform: "custom",
      url: null,
      current_match_id: null,
      is_active: false,
      created_at: now(),
    });
    if (error) return fail(500, "server_error");
    created.push(name);
  }
  return ok({ created, skipped });
}

// Tautkan satu pertandingan ke kanal siaran: kanal mulai mengarah ke laga ini
// (dan ditandai mengudara), tautan kanal dipasang pada kartu pertandingan,
// lalu kedua kapten diberi tahu jadwal siarnya.
async function esportStreamsAssign(ctx) {
  const id = text(ctx.body.id ?? ctx.body.tournamentId, 60);
  const access = await esportTournamentAccess(ctx, id);
  if (access.error) return access.error;
  const streamId = text(ctx.body.streamId, 60);
  const matchId = text(ctx.body.matchId, 60);
  if (!streamId || !matchId) return fail(400, "invalid_input");
  const { data: stream } = await ctx.supabase
    .from("esport_streams")
    .select("*")
    .eq("id", streamId)
    .eq("tournament_id", id)
    .maybeSingle();
  if (!stream) return fail(404, "not_found");
  const { data: match } = await ctx.supabase
    .from("esport_matches")
    .select("*")
    .eq("id", matchId)
    .eq("tournament_id", id)
    .maybeSingle();
  if (!match) return fail(404, "not_found");
  if (esportMatchDone(match)) return fail(409, "invalid_status");
  const streamUrl = stream.url ?? null;
  await ctx.supabase
    .from("esport_streams")
    .update({ current_match_id: matchId, is_active: true })
    .eq("id", streamId);
  await ctx.supabase.from("esport_matches").update({ stream_url: streamUrl }).eq("id", matchId);
  const label = await esportMatchLabel(ctx.supabase, match);
  await esportNotifyBothCaptains(
    ctx.supabase,
    id,
    match,
    `Laga ${label} akan disiarkan di kanal "${stream.name}"${streamUrl ? ` — tonton di ${streamUrl}` : " (tautan menyusul)"} pada turnamen "${access.tournament.title}".`,
  );
  return ok({ assigned: true, streamId, matchId, streamUrl });
}

async function esportCastersList(ctx) {
  const id = text(ctx.body.tournamentId ?? ctx.body.id, 60);
  if (!id) return fail(400, "invalid_input");
  const { data } = await ctx.supabase.from("esport_casters").select("*").eq("tournament_id", id).order("created_at", { ascending: true });
  return ok({
    items: (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slotLabel: c.slot_label ?? null,
      casterRole: c.caster_role ?? "main_caster",
      contact: c.contact ?? null,
      assignedMatchId: c.assigned_match_id ?? null,
    })),
  });
}

async function esportCasterSave(ctx) {
  const id = text(ctx.body.tournamentId, 60);
  const access = await esportTournamentAccess(ctx, id);
  if (access.error) return access.error;
  const name = text(ctx.body.name, 60);
  if (name.length < 2) return fail(400, "invalid_input");
  const casterRole = esportEnumOrDefault(ctx.body.casterRole, ESPORT_CASTER_ROLES, "main_caster");
  if (!casterRole) return fail(400, "invalid_input");
  const casterId = text(ctx.body.casterId, 60);
  const patch = {
    name,
    slot_label: textOrNull(ctx.body.slotLabel, 40),
    caster_role: casterRole,
    contact: textOrNull(ctx.body.contact, 80),
    assigned_match_id: textOrNull(ctx.body.assignedMatchId, 60),
  };
  if (casterId) {
    const { data: existing } = await ctx.supabase.from("esport_casters").select("id").eq("id", casterId).eq("tournament_id", id).maybeSingle();
    if (!existing) return fail(404, "not_found");
    await ctx.supabase.from("esport_casters").update(patch).eq("id", casterId);
    return ok({ id: casterId });
  }
  const newId = crypto.randomUUID();
  await ctx.supabase.from("esport_casters").insert({ id: newId, tournament_id: id, ...patch, created_at: now() });
  return ok({ id: newId });
}

async function esportCasterDelete(ctx) {
  const id = text(ctx.body.id, 60);
  const { data: caster } = await ctx.supabase.from("esport_casters").select("*").eq("id", id).maybeSingle();
  if (!caster) return fail(404, "not_found");
  const access = await esportTournamentAccess(ctx, caster.tournament_id);
  if (access.error) return access.error;
  await ctx.supabase.from("esport_casters").delete().eq("id", id);
  return ok({ deleted: true });
}

async function esportLeaderboard(ctx) {
  const id = text(ctx.body.id, 60);
  const { data: tournament } = await ctx.supabase.from("esport_tournaments").select("*").eq("id", id).maybeSingle();
  if (!tournament) return fail(404, "not_found");
  const rows = await esportTournamentRows(ctx.supabase, id);
  const { regList, regMap, teamMap, matches } = rows;
  const finished = matches.filter((m) => m.status === "finished" && m.home_score !== null);
  // Walkover ikut dihitung di klasemen: menang kalah tercatat, skor 0-0.
  const standingsMatches = matches.filter(
    (m) => (m.status === "finished" && m.home_score !== null) || (m.status === "walkover" && m.winner_reg_id),
  );
  const playerCount = (regId) => esportRosterOf(regMap.get(regId)).length;

  if (tournament.format === "battle_royale") {
    const lobbies = matches.filter((m) => m.stage === "lobby" && m.status === "finished");
    const totals = new Map();
    for (const reg of regList) {
      if (["withdrawn", "disqualified"].includes(reg.status)) continue;
      const team = teamMap.get(reg.team_id);
      totals.set(reg.id, {
        regId: reg.id,
        teamName: team?.name ?? "Tim",
        teamTag: team?.tag ?? null,
        teamLogo: team?.logo_data ?? null,
        status: reg.status,
        played: 0,
        wins: 0,
        losses: 0,
        kills: 0,
        points: 0,
        bestPlacement: null,
      });
    }
    for (const lobby of lobbies) {
      const { data: brRows } = await ctx.supabase.from("esport_br_results").select("*").eq("match_id", lobby.id);
      for (const r of brRows ?? []) {
        const row = totals.get(r.registration_id);
        if (!row) continue;
        row.played += 1;
        row.kills += Number(r.kills) || 0;
        row.points += Number(r.points) || 0;
        const placement = Number(r.placement) || 99;
        if (row.bestPlacement === null || placement < row.bestPlacement) row.bestPlacement = placement;
        if (placement === 1) row.wins += 1;
        else row.losses += 1;
      }
    }
    const brNames = await namesFor(ctx.supabase, regList.flatMap((r) => esportRosterOf(r)));
    const brList = [...totals.values()].sort(
      (a, b) => b.points - a.points || b.kills - a.kills || (a.bestPlacement ?? 99) - (b.bestPlacement ?? 99),
    );
    const brTopPlayers = [];
    const appearanceCount = new Map();
    for (const reg of regList) {
      if (["withdrawn", "disqualified"].includes(reg.status)) continue;
      for (const accountId of esportRosterOf(reg)) {
        appearanceCount.set(accountId, (appearanceCount.get(accountId) ?? 0) + lobbies.length);
      }
    }
    for (const [accountId, count] of appearanceCount) {
      brTopPlayers.push({
        accountId,
        name: brNames.get(accountId)?.displayName ?? brNames.get(accountId)?.nickname ?? "Pemain",
        photoData: brNames.get(accountId)?.photoData ?? null,
        matchesPlayed: count,
      });
    }
    return ok({
      rows: brList,
      championRegId: regList.find((r) => r.status === "winner")?.id ?? brList[0]?.regId ?? null,
      topPlayers: brTopPlayers.sort((a, b) => b.matchesPlayed - a.matchesPlayed).slice(0, 10),
    });
  }

  const stats = new Map();
  for (const reg of regList) {
    if (["withdrawn", "disqualified"].includes(reg.status)) continue;
    const team = teamMap.get(reg.team_id);
    stats.set(reg.id, {
      regId: reg.id,
      teamName: team?.name ?? "Tim",
      teamTag: team?.tag ?? null,
      teamLogo: team?.logo_data ?? null,
      status: reg.status,
      played: 0,
      wins: 0,
      losses: 0,
      scoreFor: 0,
      scoreAgainst: 0,
    });
    for (const m of standingsMatches) {
      const row = stats.get(reg.id);
      if (m.home_reg_id === reg.id) {
        row.played += 1;
        row.scoreFor += Number(m.home_score) || 0;
        row.scoreAgainst += Number(m.away_score) || 0;
        if (m.winner_reg_id === reg.id) row.wins += 1;
        else row.losses += 1;
      } else if (m.away_reg_id === reg.id) {
        row.played += 1;
        row.scoreFor += Number(m.away_score) || 0;
        row.scoreAgainst += Number(m.home_score) || 0;
        if (m.winner_reg_id === reg.id) row.wins += 1;
        else row.losses += 1;
      }
    }
  }
  const appearances = new Map();
  for (const m of finished) {
    for (const regId of [m.home_reg_id, m.away_reg_id]) {
      if (!regId) continue;
      for (const accountId of esportRosterOf(regMap.get(regId))) {
        appearances.set(accountId, (appearances.get(accountId) ?? 0) + 1);
      }
    }
  }
  const names = await namesFor(ctx.supabase, [...appearances.keys()]);
  const pointsBased = ["round_robin", "league"].includes(tournament.format);
  const list = [...stats.values()]
    .map((row) => ({
      ...row,
      winRate: row.played ? Math.round((row.wins / row.played) * 100) : 0,
      ...(pointsBased ? { points: row.wins * 3 } : {}),
    }))
    .sort((a, b) => (b.wins !== a.wins ? b.wins - a.wins : (b.scoreFor - b.scoreAgainst) - (a.scoreFor - a.scoreAgainst)));
  const finalMatch =
    tournament.format === "double_elim"
      ? matches.find((m) => m.stage === "grand_final") ?? null
      : ["round_robin", "swiss", "league"].includes(tournament.format)
        ? null
        : matches.find((m) => ["main", "playoff"].includes(m.stage) && !m.next_match_id) ?? null;
  const championRegId =
    finalMatch?.winner_reg_id ??
    (["swiss", "league"].includes(tournament.format) ? regList.find((r) => r.status === "winner")?.id ?? null : null);
  const topPlayers = [...appearances.entries()]
    .map(([accountId, count]) => ({
      accountId,
      name: names.get(accountId)?.displayName ?? names.get(accountId)?.nickname ?? "Pemain",
      photoData: names.get(accountId)?.photoData ?? null,
      matchesPlayed: count,
    }))
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed)
    .slice(0, 10);
  return ok({
    rows: list,
    championRegId,
    topPlayers,
  });
}

async function esportGamesAdminSave(ctx) {
  const auth = await actor(ctx, 6);
  if (auth.error) return auth.error;
  const gameId = text(ctx.body.id, 60);
  const defaultFormat = esportEnumOrDefault(ctx.body.defaultFormat, ESPORT_FORMATS, null);
  if (ctx.body.defaultFormat !== undefined && ctx.body.defaultFormat !== null && ctx.body.defaultFormat !== "" && !defaultFormat) {
    return fail(400, "invalid_input");
  }
  const bannerData = typeof ctx.body.bannerData === "string" && ctx.body.bannerData.startsWith("data:image/") ? ctx.body.bannerData.slice(0, 900_000) : null;
  const patch = {
    name: text(ctx.body.name, 80),
    mode: text(ctx.body.mode, 40),
    team_size_min: intOrNull(ctx.body.teamSizeMin, 1, 15) ?? 1,
    team_size_max: intOrNull(ctx.body.teamSizeMax, 1, 15) ?? 5,
    roster_max: intOrNull(ctx.body.rosterMax, 1, 15) ?? 7,
    icon: textOrNull(ctx.body.icon, 8),
    active: ctx.body.active !== false,
    sort_order: intOrNull(ctx.body.sortOrder, 0, 999) ?? 0,
  };
  if (ctx.body.developer !== undefined) patch.developer = textOrNull(ctx.body.developer, 60);
  if (ctx.body.genre !== undefined) patch.genre = textOrNull(ctx.body.genre, 40);
  if (ctx.body.platforms !== undefined) {
    patch.platforms = words(ctx.body.platforms, 3, 20).filter((p) => ESPORT_PLATFORMS.includes(p));
  }
  if (ctx.body.mapPool !== undefined) patch.map_pool = words(ctx.body.mapPool, 20, 40);
  if (ctx.body.bannerData !== undefined) patch.banner_data = bannerData;
  if (ctx.body.defaultFormat !== undefined) patch.default_format = defaultFormat;
  if (ctx.body.defaultRosterSize !== undefined) patch.default_roster_size = intOrNull(ctx.body.defaultRosterSize, 1, 15);
  if (ctx.body.minPlayers !== undefined) patch.min_players = intOrNull(ctx.body.minPlayers, 1, 15) ?? 1;
  if (!patch.name || !patch.mode) return fail(400, "invalid_input");
  if (gameId) {
    const { data: existing } = await ctx.supabase.from("esport_games").select("id").eq("id", gameId).maybeSingle();
    if (!existing) return fail(404, "not_found");
    await ctx.supabase.from("esport_games").update(patch).eq("id", gameId);
    return ok({ id: gameId });
  }
  const slug = text(ctx.body.slug, 40).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!slug) return fail(400, "invalid_input");
  const { data: dup } = await ctx.supabase.from("esport_games").select("id").eq("slug", slug);
  if ((dup ?? []).length) return fail(409, "invalid_input");
  const newId = crypto.randomUUID();
  await ctx.supabase.from("esport_games").insert({ id: newId, slug, ...patch, created_at: now() });
  return ok({ id: newId });
}

// ---------- papan peringkat & statistik e-sport ----------

// Papan peringkat global lintas turnamen: tim, pemain, bursa transfer, dan statistik per game.
// Pertandingan yang dihitung mengikuti aturan klasemen turnamen:
// selesai dengan skor, atau walkover dengan pemenang (bye tanpa lawan tidak dihitung).
// ---------- papan peringkat (esport.stats) ----------

const ESPORT_STATS_PERIODS = ["all", "today", "week"];

// Window periode mengikuti persepsi tanggal pengguna di Asia/Jakarta (konsisten
// dengan agenda kalender): today = sejak 00:00 WIB, week = sejak Senin 00:00 WIB,
// all = tanpa batas waktu.
function esportStatsSinceMs(period) {
  if (period === "all") return null;
  const shifted = new Date(Date.now() + CALENDAR_TZ_OFFSET_MS);
  const day = shifted.getUTCDay();
  const startUtcDay = period === "today" ? shifted.getUTCDate() : shifted.getUTCDate() - ((day + 6) % 7);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), startUtcDay) - CALENDAR_TZ_OFFSET_MS;
}

async function esportStats(ctx) {
  const period = ESPORT_STATS_PERIODS.includes(ctx.body.period) ? ctx.body.period : "all";
  const sinceMs = esportStatsSinceMs(period);
  const inWindow = (value) => {
    if (sinceMs === null) return true;
    const ms = Date.parse(value ?? "");
    return !Number.isNaN(ms) && ms >= sinceMs;
  };

  const [tournamentsRes, regsRes, matchesRes, teamsRes, membersRes, gamesRes, profilesRes, listingsRes, offersRes, transfersRes, contractsRes] =
    await Promise.all([
      ctx.supabase.from("esport_tournaments").select("*"),
      ctx.supabase.from("esport_registrations").select("*"),
      ctx.supabase.from("esport_matches").select("*"),
      ctx.supabase.from("esport_teams").select("*"),
      ctx.supabase.from("esport_team_members").select("*"),
      ctx.supabase.from("esport_games").select("*"),
      ctx.supabase.from("esport_player_profiles").select("*"),
      ctx.supabase.from("esport_transfer_listings").select("*"),
      ctx.supabase.from("esport_transfer_offers").select("*"),
      ctx.supabase.from("esport_transfers").select("*"),
      ctx.supabase.from("esport_player_contracts").select("*"),
    ]);
  const tournaments = tournamentsRes.data ?? [];
  const regs = regsRes.data ?? [];
  const matches = matchesRes.data ?? [];
  const teams = teamsRes.data ?? [];
  const members = membersRes.data ?? [];
  const games = gamesRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const listings = listingsRes.data ?? [];
  const offers = offersRes.data ?? [];
  const transfers = transfersRes.data ?? [];
  const contracts = contractsRes.data ?? [];

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const regMap = new Map(regs.map((r) => [r.id, r]));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const regsByTournament = new Map();
  for (const r of regs) {
    if (!regsByTournament.has(r.tournament_id)) regsByTournament.set(r.tournament_id, []);
    regsByTournament.get(r.tournament_id).push(r);
  }
  const matchesByTournament = new Map();
  for (const m of matches) {
    if (!matchesByTournament.has(m.tournament_id)) matchesByTournament.set(m.tournament_id, []);
    matchesByTournament.get(m.tournament_id).push(m);
  }
  const isCountedMatch = (m) =>
    (m.status === "finished" && m.home_score !== null) || (m.status === "walkover" && Boolean(m.winner_reg_id));
  const isActiveReg = (r) => !["withdrawn", "disqualified"].includes(r.status);

  const teamRows = new Map();
  const ensureTeamRow = (teamId) => {
    if (!teamRows.has(teamId)) {
      const team = teamMap.get(teamId);
      teamRows.set(teamId, {
        teamId,
        name: team?.name ?? "Tim",
        tag: team?.tag ?? null,
        logo: team?.logo_data ?? null,
        captainId: team?.captain_id ?? null,
        tournaments: new Set(),
        matches: 0,
        wins: 0,
        losses: 0,
        championships: 0,
      });
    }
    return teamRows.get(teamId);
  };
  const playerRows = new Map();
  const ensurePlayerRow = (accountId) => {
    if (!playerRows.has(accountId)) {
      playerRows.set(accountId, {
        accountId,
        tournaments: new Set(),
        matches: 0,
        wins: 0,
        losses: 0,
        championships: 0,
      });
    }
    return playerRows.get(accountId);
  };

  for (const t of tournaments) {
    const tRegs = (regsByTournament.get(t.id) ?? []).filter(isActiveReg);
    const counted = (matchesByTournament.get(t.id) ?? []).filter((m) => isCountedMatch(m) && inWindow(m.finished_at));
    const playedByReg = new Map();
    const winsByReg = new Map();
    for (const m of counted) {
      for (const regId of [m.home_reg_id, m.away_reg_id]) {
        if (!regId) continue;
        const reg = regMap.get(regId);
        if (!reg || !isActiveReg(reg)) continue;
        playedByReg.set(regId, (playedByReg.get(regId) ?? 0) + 1);
        if (m.winner_reg_id === regId) winsByReg.set(regId, (winsByReg.get(regId) ?? 0) + 1);
        const teamRow = ensureTeamRow(reg.team_id);
        teamRow.matches += 1;
        if (m.winner_reg_id === regId) teamRow.wins += 1;
        else teamRow.losses += 1;
      }
    }
    // Tidak ada tanggal penobatan juara yang andal (updated_at turnamen bergeser
    // pada edit apa pun) — juara hanya dihitung pada periode "all".
    const championReg = t.status === "completed" && period === "all" ? tRegs.find((r) => r.status === "winner") ?? null : null;
    for (const r of tRegs) {
      const teamRow = ensureTeamRow(r.team_id);
      teamRow.tournaments.add(t.id);
      if (championReg && championReg.id === r.id) teamRow.championships += 1;
      const played = playedByReg.get(r.id) ?? 0;
      const wins = winsByReg.get(r.id) ?? 0;
      for (const accountId of esportRosterOf(r)) {
        const pRow = ensurePlayerRow(accountId);
        pRow.tournaments.add(t.id);
        pRow.matches += played;
        pRow.wins += wins;
        pRow.losses += played - wins;
        if (championReg && championReg.id === r.id) pRow.championships += 1;
      }
    }
  }
  const teamList = [...teamRows.values()]
    .map((row) => ({
      teamId: row.teamId,
      name: row.name,
      tag: row.tag,
      logo: row.logo,
      captainId: row.captainId,
      tournaments: row.tournaments.size,
      matches: row.matches,
      wins: row.wins,
      losses: row.losses,
      winRate: row.matches ? Math.round((row.wins / row.matches) * 100) : 0,
      points: row.wins * 3 + (row.matches - row.wins),
      championships: row.championships,
    }))
    .sort(
      (a, b) =>
        b.championships - a.championships || b.wins - a.wins || b.winRate - a.winRate || b.matches - a.matches,
    );

  // Nilai pasar pemain: harga listing aktif tertinggi, atau fee transfer selesai tertinggi.
  const valueByProfile = new Map();
  for (const l of listings) {
    if (!["open", "paused"].includes(l.status)) continue;
    valueByProfile.set(l.player_profile_id, Math.max(valueByProfile.get(l.player_profile_id) ?? 0, Number(l.asking_price) || 0));
  }
  for (const tr of transfers) {
    if (tr.status !== "completed") continue;
    valueByProfile.set(tr.player_profile_id, Math.max(valueByProfile.get(tr.player_profile_id) ?? 0, Number(tr.fee) || 0));
  }
  const contractByProfile = new Map();
  for (const c of contracts) {
    if (c.status !== "active") continue;
    const prev = contractByProfile.get(c.player_profile_id);
    if (!prev || String(c.created_at ?? "") > String(prev.created_at ?? "")) contractByProfile.set(c.player_profile_id, c);
  }
  const memberTeamByAccount = new Map();
  for (const m of members) {
    if (!memberTeamByAccount.has(m.account_id)) memberTeamByAccount.set(m.account_id, m.team_id);
  }
  const profileByAccount = new Map();
  for (const p of profiles) {
    const prev = profileByAccount.get(p.account_id);
    if (!prev || String(p.updated_at ?? "") > String(prev.updated_at ?? "")) profileByAccount.set(p.account_id, p);
    ensurePlayerRow(p.account_id);
  }
  const accountIds = [...new Set([...playerRows.keys(), ...profiles.map((p) => p.account_id)])];
  const names = await namesFor(ctx.supabase, accountIds);
  const teamOut = (teamId) => {
    const team = teamId ? teamMap.get(teamId) : null;
    return team ? { id: team.id, name: team.name, tag: team.tag ?? null, logo: team.logo_data ?? null } : null;
  };
  const gameOut = (gameId) => {
    const game = gameId ? gameMap.get(gameId) : null;
    return game ? { id: game.id, name: game.name, icon: game.icon ?? null } : null;
  };
  const playerOut = (profileId) => {
    const profile = profileId ? profileMap.get(profileId) : null;
    if (!profile) return null;
    const info = names.get(profile.account_id);
    return {
      profileId: profile.id,
      accountId: profile.account_id,
      ign: profile.ign,
      name: info?.displayName ?? info?.nickname ?? "Pemain",
      photoData: info?.photoData ?? null,
      game: gameOut(profile.game_id),
    };
  };

  const playerSorted = [...playerRows.values()]
    .map((row) => {
      const profile = profileByAccount.get(row.accountId) ?? null;
      const contract = profile ? contractByProfile.get(profile.id) ?? null : null;
      const teamId = contract?.team_id ?? memberTeamByAccount.get(row.accountId) ?? null;
      const info = names.get(row.accountId);
      return {
        accountId: row.accountId,
        profileId: profile?.id ?? null,
        name: info?.displayName ?? info?.nickname ?? "Pemain",
        nickname: info?.nickname ?? null,
        photoData: info?.photoData ?? null,
        ign: profile?.ign ?? info?.nickname ?? null,
        game: gameOut(profile?.game_id),
        status: profile?.status ?? null,
        team: teamOut(teamId),
        tournaments: row.tournaments.size,
        matches: row.matches,
        wins: row.wins,
        losses: row.losses,
        winRate: row.matches ? Math.round((row.wins / row.matches) * 100) : 0,
        championships: row.championships,
        points: row.wins * 3 + (row.matches - row.wins),
        value: profile ? valueByProfile.get(profile.id) ?? 0 : 0,
      };
    })
    .sort(
      (a, b) =>
        b.championships - a.championships ||
        b.wins - a.wins ||
        b.winRate - a.winRate ||
        b.matches - a.matches ||
        b.value - a.value,
    );

  const completedTransfers = transfers.filter((t) => t.status === "completed" && inWindow(t.completed_at));
  const volumeCoins = completedTransfers.reduce((sum, t) => sum + (Number(t.fee) || 0), 0);
  const topTransfers = [...completedTransfers]
    .sort(
      (a, b) =>
        (Number(b.fee) || 0) - (Number(a.fee) || 0) ||
        String(b.completed_at ?? "").localeCompare(String(a.completed_at ?? "")),
    )
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      player: playerOut(t.player_profile_id),
      fromTeam: teamOut(t.from_team_id),
      toTeam: teamOut(t.to_team_id),
      transferType: t.transfer_type,
      fee: Number(t.fee) || 0,
      loanDays: t.loan_days ?? null,
      completedAt: t.completed_at ?? null,
    }));
  const spendByTeam = new Map();
  for (const t of completedTransfers) {
    const fee = Number(t.fee) || 0;
    if (fee <= 0 || !t.to_team_id) continue;
    const agg = spendByTeam.get(t.to_team_id) ?? { spent: 0, transfers: 0 };
    agg.spent += fee;
    agg.transfers += 1;
    spendByTeam.set(t.to_team_id, agg);
  }
  const topSpenders = [...spendByTeam.entries()]
    .sort((a, b) => b[1].spent - a[1].spent)
    .slice(0, 8)
    .map(([teamId, agg]) => ({ team: teamOut(teamId), spent: agg.spent, transfers: agg.transfers }));

  const gameList = games
    .map((g) => {
      const gTournamentIds = tournaments.filter((t) => t.game_id === g.id).map((t) => t.id);
      const teamIds = new Set();
      let matchesPlayed = 0;
      for (const tid of gTournamentIds) {
        for (const r of regsByTournament.get(tid) ?? []) {
          if (isActiveReg(r)) teamIds.add(r.team_id);
        }
        for (const m of matchesByTournament.get(tid) ?? []) {
          if (isCountedMatch(m) && inWindow(m.finished_at)) matchesPlayed += 1;
        }
      }
      const gProfiles = profiles.filter((p) => p.game_id === g.id);
      const gProfileIds = new Set(gProfiles.map((p) => p.id));
      const gTournaments = tournaments.filter((t) => t.game_id === g.id);
      return {
        gameId: g.id,
        name: g.name,
        icon: g.icon ?? null,
        tournaments: gTournaments.length,
        activeTournaments: gTournaments.filter((t) => ["registration", "bracket", "ongoing"].includes(t.status)).length,
        teams: teamIds.size,
        matches: matchesPlayed,
        players: gProfiles.length,
        listings: listings.filter((l) => gProfileIds.has(l.player_profile_id) && ["open", "paused"].includes(l.status)).length,
      };
    })
    .sort((a, b) => b.tournaments * 3 + b.matches - (a.tournaments * 3 + a.matches) || String(a.name).localeCompare(String(b.name)));

  return ok({
    period,
    since: sinceMs === null ? null : new Date(sinceMs).toISOString(),
    teams: period === "all" ? teamList : teamList.filter((row) => row.matches > 0),
    players: (period === "all" ? playerSorted : playerSorted.filter((p) => p.matches > 0)).slice(0, 100),
    market: {
      summary: {
        completedTransfers: completedTransfers.length,
        volumeCoins,
        openListings: listings.filter((l) => l.status === "open").length,
        pendingOffers: offers.filter((o) => o.status === "pending").length,
        freeAgents: profiles.filter((p) => p.status === "free_agent").length,
        activeLoans: contracts.filter((c) => c.status === "active" && c.contract_type === "loan").length,
      },
      topTransfers,
      topSpenders,
      topValuables: playerSorted
        .filter((p) => p.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
        .map((p) => ({
          accountId: p.accountId,
          profileId: p.profileId,
          ign: p.ign,
          name: p.name,
          photoData: p.photoData,
          game: p.game,
          status: p.status,
          team: p.team,
          value: p.value,
        })),
    },
    games: gameList,
  });
}

// ---------- agenda kalender ----------

// Agenda dikelompokkan memakai zona waktu Asia/Jakarta (UTC+7, tanpa DST)
// agar tanggal yang dilihat pengguna sama dengan tanggal server.
const CALENDAR_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const CALENDAR_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function jakartaStamp(value) {
  const ms = Date.parse(value ?? "");
  if (Number.isNaN(ms)) return null;
  const shifted = new Date(ms + CALENDAR_TZ_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return { month: `${y}-${m}`, date: `${y}-${m}-${d}` };
}

// Urutan penting: bila dua tonggak jatuh pada waktu yang sama (mis. start_at
// dan main_event_start_at), label pertama yang tersimpan dipakai.
const CALENDAR_TOURNAMENT_MILESTONES = [
  ["registration_close_at", "pendaftaran_ditutup"],
  ["technical_meeting_at", "technical_meeting"],
  ["qualifier_start_at", "kualifikasi_mulai"],
  ["main_event_start_at", "main_event_mulai"],
  ["grand_final_at", "grand_final"],
  ["start_at", "turnamen_mulai"],
];

async function calendarAgenda(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const accountId = auth.account.id;
  const nowMs = Date.now();
  const todayStamp = jakartaStamp(new Date(nowMs).toISOString());
  const monthParam = text(ctx.body.month, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : todayStamp.month;

  const items = [];
  const push = (item) => items.push(item);

  // ---- Event komunitas: sebagai penyelenggara, panitia, peserta, atau undangan
  const [createdRes, committeeRes, rsvpRes, ticketRes, inviteRes] = await Promise.all([
    ctx.supabase.from("events").select("*").eq("created_by", accountId).limit(300),
    ctx.supabase.from("event_committees").select("*").eq("account_id", accountId).limit(300),
    ctx.supabase.from("event_rsvps").select("*").eq("account_id", accountId).limit(300),
    ctx.supabase.from("event_tickets").select("*").eq("account_id", accountId).limit(300),
    ctx.supabase.from("event_invites").select("*").eq("account_id", accountId).limit(300),
  ]);
  const createdEvents = createdRes.data ?? [];
  const eventRole = new Map();
  const noteEventRole = (eventId, role, priority) => {
    const current = eventRole.get(eventId);
    if (!current || priority > current.priority) eventRole.set(eventId, { role, priority });
  };
  for (const row of createdEvents) noteEventRole(row.id, "penyelenggara", 4);
  for (const row of committeeRes.data ?? []) noteEventRole(row.event_id, "panitia", 3);
  for (const row of rsvpRes.data ?? []) if (row.status === "going") noteEventRole(row.event_id, "peserta", 2);
  for (const row of ticketRes.data ?? []) if (row.status !== "cancelled") noteEventRole(row.event_id, "peserta", 2);
  for (const row of inviteRes.data ?? []) noteEventRole(row.event_id, "undangan", 1);

  const knownEventIds = new Set(createdEvents.map((row) => row.id));
  const missingEventIds = [...eventRole.keys()].filter((id) => !knownEventIds.has(id));
  const missingEvents = missingEventIds.length
    ? (await ctx.supabase.from("events").select("*").in("id", missingEventIds)).data ?? []
    : [];
  const eventById = new Map([...createdEvents, ...missingEvents].map((row) => [row.id, row]));

  for (const [eventId, meta] of eventRole) {
    const row = eventById.get(eventId);
    if (!row || row.status === "cancelled") continue;
    if (!jakartaStamp(row.starts_at)) continue;
    push({
      id: `event:${eventId}`,
      kind: "event",
      title: row.title,
      note: null,
      noteKey: null,
      role: meta.role,
      location: row.venue_name ?? row.location ?? null,
      startsAt: row.starts_at,
      endsAt: row.ends_at ?? null,
      link: `/event/${eventId}`,
    });
  }

  // ---- Tugas kepanitiaan: checklist event milik penyelenggara yang belum selesai
  const createdEventIds = createdEvents.map((row) => row.id);
  if (createdEventIds.length) {
    const { data: checklistRows } = await ctx.supabase
      .from("event_checklists")
      .select("*")
      .in("event_id", createdEventIds)
      .limit(500);
    for (const row of checklistRows ?? []) {
      if (!row.due_at || row.completed_at || !jakartaStamp(row.due_at)) continue;
      push({
        id: `tugas:${row.id}`,
        kind: "tugas",
        title: row.title,
        note: eventById.get(row.event_id)?.title ?? null,
        noteKey: null,
        role: null,
        location: null,
        startsAt: row.due_at,
        endsAt: null,
        link: `/event/${row.event_id}/kelola`,
      });
    }
  }

  // ---- Turnamen E-Sport: penyelenggara & peserta (lewat tim)
  const [membershipRes, teamsRes] = await Promise.all([
    ctx.supabase.from("esport_team_members").select("*").eq("account_id", accountId).limit(50),
    ctx.supabase.from("esport_teams").select("*").limit(1000),
  ]);
  const teamById = new Map((teamsRes.data ?? []).map((row) => [row.id, row]));
  const myTeamIds = new Set(
    [...teamById.values()].filter((row) => row.captain_id === accountId).map((row) => row.id),
  );
  for (const row of membershipRes.data ?? []) myTeamIds.add(row.team_id);

  const myRegIds = new Set();
  const participantTournamentIds = new Set();
  if (myTeamIds.size) {
    const { data: myRegs } = await ctx.supabase
      .from("esport_registrations")
      .select("*")
      .in("team_id", [...myTeamIds])
      .limit(300);
    for (const row of myRegs ?? []) {
      if (["cancelled", "withdrawn", "rejected"].includes(row.status)) continue;
      myRegIds.add(row.id);
      participantTournamentIds.add(row.tournament_id);
    }
  }
  const { data: myTournaments } = await ctx.supabase
    .from("esport_tournaments")
    .select("*")
    .eq("creator_id", accountId)
    .limit(300);
  const organizerIds = new Set((myTournaments ?? []).map((row) => row.id));
  const tournamentIds = [...new Set([...organizerIds, ...participantTournamentIds])];

  if (tournamentIds.length) {
    const tournamentById = new Map((myTournaments ?? []).map((row) => [row.id, row]));
    const missingTournamentIds = tournamentIds.filter((id) => !tournamentById.has(id));
    if (missingTournamentIds.length) {
      const { data: extraTournaments } = await ctx.supabase
        .from("esport_tournaments")
        .select("*")
        .in("id", missingTournamentIds);
      for (const row of extraTournaments ?? []) tournamentById.set(row.id, row);
    }

    for (const tournamentId of tournamentIds) {
      const row = tournamentById.get(tournamentId);
      if (!row || row.status === "cancelled") continue;
      const role = organizerIds.has(tournamentId) ? "penyelenggara" : "peserta";
      const seenStamps = new Set();
      for (const [column, key] of CALENDAR_TOURNAMENT_MILESTONES) {
        const value = row[column];
        const stamp = value ? jakartaStamp(value) : null;
        if (!stamp || seenStamps.has(value)) continue;
        seenStamps.add(value);
        push({
          id: `esport:${tournamentId}:${key}`,
          kind: "esport",
          title: row.title,
          note: null,
          noteKey: key,
          role,
          location: null,
          startsAt: value,
          endsAt: null,
          link: `/kompetisi-esport/${tournamentId}`,
        });
      }
    }

    // Laga terjadwal yang belum selesai — untuk tim sendiri atau turnamen yang diselenggarakan.
    const { data: allRegs } = await ctx.supabase
      .from("esport_registrations")
      .select("*")
      .in("tournament_id", tournamentIds)
      .limit(600);
    const regTeamName = new Map(
      (allRegs ?? []).map((row) => [row.id, teamById.get(row.team_id)?.name ?? "Tim"]),
    );
    const { data: matchRows } = await ctx.supabase
      .from("esport_matches")
      .select("*")
      .in("tournament_id", tournamentIds)
      .limit(600);
    for (const row of matchRows ?? []) {
      if (!row.scheduled_at || !jakartaStamp(row.scheduled_at)) continue;
      if (["finished", "cancelled", "walkover"].includes(row.status)) continue;
      if (!row.home_reg_id && !row.away_reg_id) continue;
      const isMyMatch = myRegIds.has(row.home_reg_id) || myRegIds.has(row.away_reg_id);
      if (!isMyMatch && !organizerIds.has(row.tournament_id)) continue;
      push({
        id: `match:${row.id}`,
        kind: "esport",
        title: `Laga: ${regTeamName.get(row.home_reg_id) ?? "TBD"} vs ${regTeamName.get(row.away_reg_id) ?? "TBD"}`,
        note: tournamentById.get(row.tournament_id)?.title ?? null,
        noteKey: null,
        role: isMyMatch ? "peserta" : "penyelenggara",
        location: null,
        startsAt: row.scheduled_at,
        endsAt: null,
        link: `/kompetisi-esport/${row.tournament_id}`,
      });
    }
  }

  // ---- Learning Center: sesi konseling terjadwal
  const { data: counselingRows } = await ctx.supabase
    .from("counseling_bookings")
    .select("*")
    .eq("account_id", accountId)
    .limit(200);
  for (const row of counselingRows ?? []) {
    if (!row.scheduled_at || ["cancelled", "completed"].includes(row.status)) continue;
    const endMs = Date.parse(row.scheduled_at) + (Number(row.duration_minutes) || 60) * 60000;
    push({
      id: `konseling:${row.id}`,
      kind: "konseling",
      title: `Sesi konseling: ${row.counselor_name}`,
      note: null,
      noteKey: null,
      role: null,
      location: null,
      startsAt: row.scheduled_at,
      endsAt: new Date(endMs).toISOString(),
      link: "/learning-center",
    });
  }

  // ---- Langganan tier: pengingat jatuh tempo
  const { data: subscriptionRows } = await ctx.supabase
    .from("subscriptions")
    .select("*")
    .eq("account_id", accountId)
    .limit(100);
  for (const row of subscriptionRows ?? []) {
    if (row.status !== "active" || !row.expires_at || !jakartaStamp(row.expires_at)) continue;
    push({
      id: `langganan:${row.id}`,
      kind: "langganan",
      title: "Langganan",
      note: null,
      noteKey: "langganan_berakhir",
      role: null,
      location: null,
      startsAt: row.expires_at,
      endsAt: null,
      link: "/langganan",
    });
  }

  // ---- Jadwal pribadi: rencana kegiatan anggota di luar kegiatan platform
  const { data: personalRows } = await ctx.supabase
    .from("personal_calendar_items")
    .select("*")
    .eq("account_id", accountId)
    .limit(300);
  for (const row of personalRows ?? []) {
    const dateValue = strictDate(row.date);
    if (!dateValue) continue;
    const startTime = CALENDAR_TIME_RE.test(row.start_time ?? "") ? row.start_time : null;
    const endTime = CALENDAR_TIME_RE.test(row.end_time ?? "") ? row.end_time : null;
    push({
      id: `pribadi:${row.id}`,
      kind: "pribadi",
      title: row.title,
      note: textOrNull(row.note, 500),
      noteKey: null,
      role: null,
      location: textOrNull(row.location, 160),
      startsAt: `${dateValue}T${startTime ?? "00:00"}:00+07:00`,
      endsAt: endTime ? `${dateValue}T${endTime}:00+07:00` : null,
      allDay: !startTime,
      link: null,
    });
  }

  const monthItems = items
    .filter((item) => {
      if (jakartaStamp(item.startsAt)?.month === month) return true;
      return item.endsAt ? jakartaStamp(item.endsAt)?.month === month : false;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const horizonMs = nowMs + 30 * 24 * 60 * 60 * 1000;
  const activeSinceMs = nowMs - 12 * 60 * 60 * 1000;
  const reminders = items
    .filter((item) => {
      const startMs = Date.parse(item.startsAt);
      const endMs = item.endsAt ? Date.parse(item.endsAt) : startMs;
      return endMs >= activeSinceMs && startMs <= horizonMs;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 8);

  const counts = {};
  for (const item of monthItems) counts[item.kind] = (counts[item.kind] ?? 0) + 1;

  return ok({ month, today: todayStamp.date, items: monthItems, reminders, counts });
}

// ---------- jadwal pribadi (rencana kegiatan di luar platform) ----------

// dateOrNull hanya memastikan format; engine JS meloloskan tanggal meluber
// seperti "2026-02-31" (digulung ke 3 Maret), jadi wajib cek bolak-balik.
function strictDate(value) {
  const v = dateOrNull(value);
  if (!v) return null;
  return new Date(Date.parse(`${v}T00:00:00Z`)).toISOString().slice(0, 10) === v ? v : null;
}

function personalScheduleFields(body) {
  const title = text(body.title, 100);
  if (!title) return { error: "invalid_schedule_title" };
  const date = strictDate(body.date);
  if (!date) return { error: "invalid_schedule_date" };
  const startTime = text(body.startTime, 5);
  const endTime = text(body.endTime, 5);
  if (startTime && !CALENDAR_TIME_RE.test(startTime)) return { error: "invalid_schedule_time" };
  if (endTime && !CALENDAR_TIME_RE.test(endTime)) return { error: "invalid_schedule_time" };
  if (endTime && !startTime) return { error: "invalid_schedule_time" };
  if (startTime && endTime && endTime <= startTime) return { error: "invalid_schedule_time" };
  return {
    title,
    date,
    startTime: startTime || null,
    endTime: endTime || null,
    note: textOrNull(body.note, 500),
    location: textOrNull(body.location, 160),
  };
}

function mapPersonalSchedule(row) {
  return {
    id: row.id,
    title: row.title,
    note: row.note ?? null,
    location: row.location ?? null,
    date: row.date,
    startTime: row.start_time ?? null,
    endTime: row.end_time ?? null,
  };
}

async function personalScheduleOwned(ctx, accountId, itemId) {
  if (!itemId) return null;
  const { data } = await ctx.supabase
    .from("personal_calendar_items")
    .select("*")
    .eq("id", itemId)
    .eq("account_id", accountId)
    .maybeSingle();
  return data ?? null;
}

async function calendarPersonalCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const fields = personalScheduleFields(ctx.body);
  if (fields.error) return fail(400, fields.error);
  const row = {
    id: crypto.randomUUID(),
    account_id: auth.account.id,
    title: fields.title,
    note: fields.note,
    location: fields.location,
    date: fields.date,
    start_time: fields.startTime,
    end_time: fields.endTime,
    created_at: now(),
    updated_at: now(),
  };
  const { error } = await ctx.supabase.from("personal_calendar_items").insert(row);
  if (error) return fail(500, "server_error");
  return ok({ item: mapPersonalSchedule(row) });
}

async function calendarPersonalUpdate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const itemId = text(ctx.body.id, 60);
  const existing = await personalScheduleOwned(ctx, auth.account.id, itemId);
  if (!existing) return fail(404, "not_found");
  const fields = personalScheduleFields(ctx.body);
  if (fields.error) return fail(400, fields.error);
  const patch = {
    title: fields.title,
    note: fields.note,
    location: fields.location,
    date: fields.date,
    start_time: fields.startTime,
    end_time: fields.endTime,
    updated_at: now(),
  };
  const { error } = await ctx.supabase.from("personal_calendar_items").update(patch).eq("id", itemId);
  if (error) return fail(500, "server_error");
  return ok({ item: mapPersonalSchedule({ ...existing, ...patch }) });
}

async function calendarPersonalRemove(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const itemId = text(ctx.body.id, 60);
  const existing = await personalScheduleOwned(ctx, auth.account.id, itemId);
  if (!existing) return fail(404, "not_found");
  await ctx.supabase.from("personal_calendar_items").delete().eq("id", itemId).eq("account_id", auth.account.id);
  return ok({ removed: true });
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
  "events.committee.candidates": eventCommitteeCandidates,
  "events.committee.role": eventCommitteeSetRole,
  "events.tickets.list": eventTicketsList,
  "events.tickets.buy": eventTicketsBuy,
  "events.checkin": eventCheckin,
  "events.attendance.list": eventAttendanceList,
  "events.invitations.list": eventInvitationsList,
  "events.invitations.checkin": eventInvitationsCheckin,
  "events.wizard.save": eventWizardSave,
  "events.publish": eventPublish,
  "events.manage.get": eventManageGet,
  "events.plan.save": eventPlanSave,
  "events.budget.item.save": eventBudgetItemSave,
  "events.budget.item.delete": eventBudgetItemDelete,
  "events.budget.funding.save": eventFundingSave,
  "events.budget.funding.delete": eventFundingDelete,
  "events.sessions.save": eventSessionSave,
  "events.sessions.delete": eventSessionDelete,
  "events.speakers.save": eventSpeakerSave,
  "events.speakers.delete": eventSpeakerDelete,
  "events.checklist.save": eventChecklistSave,
  "events.checklist.delete": eventChecklistDelete,
  "events.checklist.remind": eventChecklistRemind,
  "events.expenses.save": eventExpenseSave,
  "events.expenses.review": eventExpenseReview,
  "events.reports.generate": eventReportGenerate,
  "events.lifecycle": eventLifecycle,
  "events.live.start": eventLiveStart,
  "events.live.end": eventLiveEnd,

  "esport.games.list": esportGamesList,
  "esport.games.save": esportGamesAdminSave,
  "esport.tournaments.list": esportTournamentsList,
  "esport.tournaments.get": esportTournamentGet,
  "esport.tournaments.create": esportTournamentCreate,
  "esport.tournaments.update": esportTournamentUpdate,
  "esport.tournaments.approve": esportTournamentApprove,
  "esport.tournaments.prizeStatus": esportTournamentPrizeStatus,
  "esport.budget.save": esportBudgetSave,
  "esport.teams.mine": esportTeamsMine,
  "esport.teams.create": esportTeamCreate,
  "esport.teams.get": esportTeamGet,
  "esport.teams.members.candidates": esportTeamMemberCandidates,
  "esport.teams.members.add": esportTeamMemberAdd,
  "esport.teams.members.remove": esportTeamMemberRemove,
  "esport.teams.members.role": esportTeamMemberRole,
  "esport.registrations.create": esportRegistrationCreate,
  "esport.registrations.update": esportRegistrationUpdate,
  "esport.bracket.generate": esportBracketGenerate,
  "esport.bracket.swissRound": esportSwissNextRound,
  "esport.matches.update": esportMatchUpdate,
  "esport.matches.schedule": esportMatchesSchedule,
  "esport.matches.score": esportMatchScore,
  "esport.matches.game.save": esportMatchGameSave,
  "esport.matches.brResults": esportBrResultsSave,
  "esport.matches.checkin": esportMatchCheckin,
  "esport.matches.pause": esportMatchPause,
  "esport.matches.resume": esportMatchResume,
  "esport.matches.walkover": esportMatchWalkover,
  "esport.disputes.create": esportDisputesCreate,
  "esport.disputes.resolve": esportDisputesResolve,
  "esport.disputes.investigate": esportDisputesInvestigate,
  "esport.casters.list": esportCastersList,
  "esport.casters.save": esportCasterSave,
  "esport.casters.delete": esportCasterDelete,
  "esport.streams.list": esportStreamsList,
  "esport.streams.save": esportStreamSave,
  "esport.streams.delete": esportStreamDelete,
  "esport.streams.setup": esportStreamsSetup,
  "esport.streams.assign": esportStreamsAssign,
  "esport.leaderboard": esportLeaderboard,
  "esport.stats": esportStats,
  "esport.transfer.announcements": esportTransferAnnouncements,
  "esport.transfer.windows.list": esportTransferWindowsList,
  "esport.transfer.windows.save": esportTransferWindowSave,
  "esport.transfer.windows.delete": esportTransferWindowDelete,
  "esport.transfer.profiles.mine": esportTransferProfilesMine,
  "esport.transfer.profiles.save": esportTransferProfileSave,
  "esport.transfer.profiles.list": esportTransferProfilesList,
  "esport.transfer.profiles.get": esportTransferProfileGet,
  "esport.transfer.agent.save": esportTransferAgentSave,
  "esport.transfer.listings.list": esportTransferListingsList,
  "esport.transfer.listings.create": esportTransferListingCreate,
  "esport.transfer.listings.update": esportTransferListingUpdate,
  "esport.transfer.offers.create": esportTransferOfferCreate,
  "esport.transfer.offers.respond": esportTransferOfferRespond,
  "esport.transfer.pay": esportTransferPay,
  "esport.transfer.confirm": esportTransferConfirm,
  "esport.transfer.cancel": esportTransferCancel,
  "esport.transfer.option.exercise": esportTransferOptionExercise,
  "esport.transfer.my": esportTransferMy,

  // Fase A: Enhanced Transfer Market
  "esport.transfer.stats.get": esportPlayerStatsGet,
  "esport.transfer.stats.save": esportPlayerStatsSave,
  "esport.transfer.reviews.list": esportPlayerReviewsList,
  "esport.transfer.reviews.create": esportPlayerReviewsCreate,
  "esport.transfer.reviews.summary": esportPlayerReviewsSummary,
  "esport.transfer.disputes.list": esportTransferDisputesList,
  "esport.transfer.disputes.create": esportTransferDisputesCreate,
  "esport.transfer.disputes.resolve": esportTransferDisputesResolve,
  "esport.transfer.roster.list": esportRosterHistoryList,

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
  "admin.events.list": adminEventsList,
  "admin.events.approvals": adminEventApprovals,
  "admin.events.decide": adminEventDecide,
  "admin.settings.get": adminSettingsGet,
  "admin.settings.update": adminSettingsUpdate,
  "admin.trial.status": adminTrialStatus,
  "admin.trial.create": adminTrialCreate,
  "admin.trial.delete": adminTrialDelete,

  "notifications.list": notificationsList,
  "notifications.markRead": notificationsMarkRead,

  "calendar.agenda": calendarAgenda,
  "calendar.personal.create": calendarPersonalCreate,
  "calendar.personal.update": calendarPersonalUpdate,
  "calendar.personal.remove": calendarPersonalRemove,

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
  "aiTradingAgent.subAgents.list": aiSubAgentsList,
  "aiTradingAgent.subAgents.update": aiSubAgentsUpdate,
  "aiTradingAgent.servers.list": aiTradingServersList,
  "aiTradingAgent.servers.update": aiTradingServersUpdate,
  "aiTradingAgent.prompts.list": aiPromptsList,
  "aiTradingAgent.prompts.get": aiPromptsGet,
  "aiTradingAgent.prompts.create": aiPromptsCreate,
  "aiTradingAgent.prompts.update": aiPromptsUpdate,
  "aiTradingAgent.prompts.delete": aiPromptsDelete,
  "coinSettings.settings": coinSettingsPublic,

  "storage.presignedUpload": storagePresignedUpload,
  "storage.presignedDownload": storagePresignedDownload,
  "storage.validateFile": storageValidateFile,

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

  "crypto.coins.list": cryptoCoinsList,
  "crypto.wallets.list": cryptoWalletsList,
  "crypto.wallets.create": cryptoWalletsCreate,
  "crypto.wallets.get": cryptoWalletsGet,
  "crypto.deposit": cryptoDeposit,
  "crypto.withdraw": cryptoWithdraw,
  "crypto.swap.to_coins": cryptoSwapToCoins,
  "crypto.swap.from_coins": cryptoSwapFromCoins,
  "crypto.transactions.list": cryptoTransactionsList,

  "learning.modules.list": learningModulesList,
  "learning.modules.get": learningModulesGet,
  "learning.progress.get": learningProgressGet,
  "learning.progress.update": learningProgressUpdate,
  "learning.downloads.track": learningDownloadsTrack,
  "learning.podcasts.list": learningPodcastsList,
  "learning.podcasts.play": learningPodcastsPlay,
  "learning.stories.list": learningStoriesList,
  "learning.stories.create": learningStoriesCreate,
  "learning.forum.categories": learningForumCategories,
  "learning.forum.topics.list": learningForumTopicsList,
  "learning.forum.topics.get": learningForumTopicsGet,
  "learning.forum.topics.create": learningForumTopicsCreate,
  "learning.forum.posts.create": learningForumPostsCreate,
  "learning.mentoring.list": learningMentoringList,
  "learning.mentoring.request": learningMentoringRequest,
  "learning.counseling.list": learningCounselingList,
  "learning.counseling.book": learningCounselingBook,
  "learning.financial.list": learningFinancialList,
  "learning.legal.list": learningLegalList,
  "learning.jobs.list": learningJobsList,
  "learning.jobs.apply": learningJobsApply,
  "learning.incubation.list": learningIncubationList,
  "learning.incubation.get": learningIncubationGet,
  "learning.incubation.progress": learningIncubationProgress,
  "learning.badges.list": learningBadgesList,
  "learning.badges.mine": learningBadgesMine,
  "learning.anonymous.get": learningAnonymousGet,
  "learning.anonymous.set": learningAnonymousSet,
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
      .select("id,event_id,account_id,status,price")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!ticket) return fail(404, "not_found");
    await supabase.from("event_tickets").update({ payment_status: status, status: status === "settled" ? "valid" : status === "failed" ? "cancelled" : ticket.status }).eq("id", ticket.id);
    if (status === "settled" && ticket.status !== "settled") {
      const { data: event } = await supabase.from("events").select("id,title,created_by").eq("id", ticket.event_id).maybeSingle();
      if (event && ticket.account_id) {
        await notify(supabase, ticket.account_id, "ticket", null, `Tiket ${event.title} telah dikonfirmasi`, null);
      }
      if (event?.created_by) {
        await notify(
          supabase,
          event.created_by,
          "event_ticket",
          ticket.account_id ?? null,
          `Tiket berbayar terjual untuk "${event.title}" (Rp${Number(ticket.price ?? 0).toLocaleString("id-ID")})`,
          `/event/${event.id}/kelola`,
        );
        const { data: soldRows } = await supabase
          .from("event_tickets")
          .select("id")
          .eq("event_id", event.id)
          .in("status", ["valid", "used"]);
        await maybeNotifyRegistrationMilestone(supabase, event, (soldRows ?? []).length);
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
  category: row.category ?? "other",
  tags: parseJsonList(row.tags),
  coverImage: row.cover_image ?? null,
  timezone: row.timezone ?? null,
  locationType: row.location_type ?? "physical",
  venueName: row.venue_name ?? null,
  venueAddress: row.venue_address ?? null,
  venueMapsUrl: row.venue_maps_url ?? null,
  virtualPlatform: row.virtual_platform ?? null,
  virtualUrl: row.virtual_url ?? null,
  permitRequired: Boolean(row.permit_required),
  requiresApproval: Boolean(row.requires_approval),
  liveRoomStatus: row.live_room_status ?? "idle",
});

async function visibleEvents(supabase, account) {
  const rank = ROLE_RANK[account?.role] ?? 0;
  const { data } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: true })
    .limit(200);
  const rows = data ?? [];
  if (rank >= 6) return rows;
  let invitedIds = new Set();
  let committeeIds = new Set();
  if (account) {
    const { data: invites } = await supabase
      .from("event_invites")
      .select("event_id")
      .eq("account_id", account.id);
    invitedIds = new Set((invites ?? []).map((i) => i.event_id));
    const { data: committees } = await supabase
      .from("event_committees")
      .select("event_id")
      .eq("account_id", account.id);
    committeeIds = new Set((committees ?? []).map((c) => c.event_id));
  }
  return rows.filter((row) => {
    if (row.created_by === account?.id) return true;
    if (committeeIds.has(row.id)) return true;
    if (row.status !== "published" && row.status !== "ongoing") return false;
    if (row.audience === "umum") return true;
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
  const isOwner = row.created_by === account?.id || rank >= 6;
  let isOnTeam = false;
  if (!isOwner && account) {
    const { data: mine } = await supabase
      .from("event_committees")
      .select("id")
      .eq("event_id", id)
      .eq("account_id", account.id)
      .maybeSingle();
    isOnTeam = Boolean(mine);
  }
  const openStatus = row.status === "published" || row.status === "ongoing";
  let allowed = isOwner || isOnTeam || (openStatus && (row.audience === "umum" || rank >= 2));
  if (row.audience === "undangan" && !isOwner && !isOnTeam) {
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
    .select("id,account_id")
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
  const myCommittee = (committees ?? []).find((c) => c.account_id === account?.id);
  const myCommitteeRole = isCreator ? "ketua_panitia" : myCommittee?.role ?? null;
  const myInviteRow = (invites ?? []).find((i) => i.account_id === account?.id) ?? null;
  let myInvite = null;
  if (myInviteRow) {
    const { data: inviteAttendance } = await supabase
      .from("event_invite_attendance")
      .select("id,checked_at")
      .eq("invite_id", myInviteRow.id)
      .maybeSingle();
    myInvite = { id: myInviteRow.id, attendedAt: inviteAttendance?.checked_at ?? null };
  }
  const { data: tiers } = await supabase
    .from("event_ticket_tiers")
    .select("*")
    .eq("event_id", id);
  const tierSales = new Map();
  const { data: tierTickets } = await supabase
    .from("event_tickets")
    .select("tier_id,status")
    .eq("event_id", id);
  for (const t of tierTickets ?? []) {
    if (!t.tier_id || !["valid", "used"].includes(t.status)) continue;
    tierSales.set(t.tier_id, (tierSales.get(t.tier_id) ?? 0) + 1);
  }
  const { data: liveRoom } = await supabase
    .from("event_live_streams")
    .select("*")
    .eq("event_id", id)
    .maybeSingle();
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
      myCommitteeRole,
      myInvite,
      eventGroupId: row.group_id ?? null,
      attendanceCount: (attendance ?? []).length,
      tiers: (tiers ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        quota: t.quota,
        benefits: t.benefits ?? null,
        saleStart: t.sale_start ?? null,
        saleEnd: t.sale_end ?? null,
        sold: tierSales.get(t.id) ?? 0,
      })),
      liveRoom: liveRoom
        ? { id: liveRoom.id, provider: liveRoom.provider, status: liveRoom.status, startedAt: liveRoom.started_at ?? null, endedAt: liveRoom.ended_at ?? null }
        : null,
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
  // Setiap event otomatis memiliki grup chat panitia dengan nama sesuai judul event.
  const groupRow = {
    id: crypto.randomUUID(),
    name: title,
    description: `Grup koordinasi kepanitiaan event "${title}".`,
    audience_min_role: "wonder_woman",
    capacity: 0,
    created_by: auth.account.id,
    created_at: now(),
  };
  const { error: groupError } = await ctx.supabase.from("groups").insert(groupRow);
  if (groupError) return fail(500, "server_error");
  await ctx.supabase.from("group_members").insert({
    id: crypto.randomUUID(),
    group_id: groupRow.id,
    account_id: auth.account.id,
    created_at: now(),
  });
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
    group_id: groupRow.id,
    status: "published",
    created_by: auth.account.id,
    created_at: now(),
  };
  const { error } = await ctx.supabase.from("events").insert(row);
  if (error) return fail(500, "server_error");
  // Pembuat event otomatis menjadi ketua panitia.
  await ctx.supabase.from("event_committees").insert({
    id: crypto.randomUUID(),
    event_id: row.id,
    account_id: auth.account.id,
    role: "ketua_panitia",
    created_at: now(),
  });
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
  if (!row || (row.status !== "published" && row.status !== "ongoing")) return fail(404, "not_found");
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
  if (going) {
    const { data: current } = await ctx.supabase
      .from("event_rsvps")
      .select("account_id")
      .eq("event_id", id)
      .eq("status", "going");
    await maybeNotifyRegistrationMilestone(ctx.supabase, row, (current ?? []).length);
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

// Grup chat panitia event — dibuat otomatis dengan nama sesuai judul event.
async function ensureEventGroup(supabase, event) {
  if (event.group_id) return event.group_id;
  const groupRow = {
    id: crypto.randomUUID(),
    name: event.title,
    description: `Grup koordinasi kepanitiaan event "${event.title}".`,
    audience_min_role: "wonder_woman",
    capacity: 0,
    created_by: event.created_by,
    created_at: now(),
  };
  const { error } = await supabase.from("groups").insert(groupRow);
  if (error) return null;
  await supabase.from("group_members").insert({
    id: crypto.randomUUID(),
    group_id: groupRow.id,
    account_id: event.created_by,
    created_at: now(),
  });
  await supabase.from("events").update({ group_id: groupRow.id }).eq("id", event.id);
  return groupRow.id;
}

async function addGroupMember(supabase, groupId, accountId) {
  const member = await isEnrolled(supabase, "group_members", "group_id", groupId, accountId);
  if (member) return;
  await supabase.from("group_members").insert({
    id: crypto.randomUUID(),
    group_id: groupId,
    account_id: accountId,
    created_at: now(),
  });
}

async function eventCommitteeAdd(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const eventId = text(ctx.body.eventId, 60);
  let accountId = text(ctx.body.accountId, 60);
  const email = text(ctx.body.email, 120);
  const role = text(ctx.body.role, 40) || "panitia";
  if (!eventId || (!accountId && !email)) return fail(400, "invalid_input");
  if (!EVENT_ASSIGNABLE_ROLES.includes(role)) return fail(400, "invalid_role");
  const { data: event } = await ctx.supabase
    .from("events")
    .select("id,title,created_by,group_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return fail(404, "not_found");
  if (event.created_by !== auth.account.id && auth.rank < 6) return fail(403, "forbidden");
  let candidate = null;
  if (accountId) {
    const { data } = await ctx.supabase.from("accounts").select("id,role,status").eq("id", accountId).maybeSingle();
    candidate = data;
  } else {
    const { data } = await ctx.supabase.from("accounts").select("id,role,status").eq("email", email.toLowerCase()).maybeSingle();
    candidate = data;
    accountId = candidate?.id ?? "";
  }
  if (!candidate) return fail(404, "account_not_found");
  if (candidate.status !== "active" || (ROLE_RANK[candidate.role] ?? 0) < 2) return fail(400, "committee_members_only");
  if (accountId === event.created_by) return fail(409, "already_committee");
  const existing = await isEnrolled(ctx.supabase, "event_committees", "event_id", eventId, accountId);
  if (existing) return fail(409, "already_committee");
  const groupId = await ensureEventGroup(ctx.supabase, event);
  if (!groupId) return fail(500, "server_error");
  await addGroupMember(ctx.supabase, groupId, accountId);
  const { error } = await ctx.supabase.from("event_committees").insert({
    id: crypto.randomUUID(),
    event_id: eventId,
    account_id: accountId,
    role,
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  await awardKpi(ctx.supabase, accountId, "event_committee", eventId);
  return ok({ added: true, groupId });
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
  const { data: event } = await ctx.supabase.from("events").select("id,created_by,group_id").eq("id", eventId).maybeSingle();
  if (!event) return fail(404, "not_found");
  if (event.created_by !== auth.account.id && auth.rank < 6) return fail(403, "forbidden");
  if (accountId === event.created_by) return fail(400, "cannot_remove_chair");
  await ctx.supabase.from("event_committees").delete().eq("event_id", eventId).eq("account_id", accountId);
  if (event.group_id) {
    await ctx.supabase.from("group_members").delete().eq("group_id", event.group_id).eq("account_id", accountId);
  }
  return ok({ removed: true });
}

async function eventCommitteeSetRole(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const eventId = text(ctx.body.eventId, 60);
  const accountId = text(ctx.body.accountId, 60);
  const role = text(ctx.body.role, 40);
  if (!eventId || !accountId || !role) return fail(400, "invalid_input");
  if (!EVENT_ASSIGNABLE_ROLES.includes(role)) return fail(400, "invalid_role");
  const { data: event } = await ctx.supabase.from("events").select("id,created_by").eq("id", eventId).maybeSingle();
  if (!event) return fail(404, "not_found");
  if (event.created_by !== auth.account.id && auth.rank < 6) return fail(403, "forbidden");
  if (accountId === event.created_by) return fail(400, "cannot_change_chair");
  const existing = await isEnrolled(ctx.supabase, "event_committees", "event_id", eventId, accountId);
  if (!existing) return fail(404, "not_found");
  const { error } = await ctx.supabase
    .from("event_committees")
    .update({ role })
    .eq("event_id", eventId)
    .eq("account_id", accountId);
  if (error) return fail(500, "server_error");
  return ok({ updated: true, role });
}

async function eventCommitteeCandidates(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const eventId = text(ctx.body.eventId, 60);
  if (!eventId) return fail(400, "invalid_input");
  const { data: event } = await ctx.supabase.from("events").select("id,created_by").eq("id", eventId).maybeSingle();
  if (!event) return fail(404, "not_found");
  if (event.created_by !== auth.account.id && auth.rank < 6) return fail(403, "forbidden");
  const q = text(ctx.body.q, 80).toLowerCase();
  if (q.length < 2) return ok({ items: [] });
  const { data: accounts } = await ctx.supabase
    .from("accounts")
    .select("id,display_name,role,status")
    .eq("status", "active")
    .limit(300);
  const eligible = (accounts ?? []).filter(
    (a) => (ROLE_RANK[a.role] ?? 0) >= 2 && a.id !== event.created_by,
  );
  const names = await namesFor(ctx.supabase, eligible.map((a) => a.id));
  const { data: existing } = await ctx.supabase
    .from("event_committees")
    .select("account_id")
    .eq("event_id", eventId);
  const taken = new Set((existing ?? []).map((r) => r.account_id));
  const items = eligible
    .filter((a) => !taken.has(a.id))
    .map((a) => {
      const info = names.get(a.id);
      return {
        accountId: a.id,
        name: info?.displayName ?? info?.nickname ?? "Anggota",
        nickname: info?.nickname ?? null,
        role: a.role,
        tier: info?.tier ?? null,
        photoData: info?.photoData ?? null,
      };
    })
    .filter((item) => [item.name, item.nickname ?? ""].some((v) => v.toLowerCase().includes(q)))
    .slice(0, 10);
  return ok({ items });
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
  if (!event || (event.status !== "published" && event.status !== "ongoing")) return fail(404, "not_found");
  const tierId = text(ctx.body.tierId, 60);
  let tier = null;
  if (tierId) {
    const { data: tierRow } = await ctx.supabase
      .from("event_ticket_tiers")
      .select("*")
      .eq("id", tierId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (!tierRow) return fail(404, "not_found");
    tier = tierRow;
  }
  const price = tier ? Number(tier.price) || 0 : Number(event.ticket_price) || 0;
  if (!price || price <= 0) return fail(400, "event_is_free");
  if (tier) {
    const currentTime = Date.now();
    if (tier.sale_start && Date.parse(tier.sale_start) > currentTime) return fail(400, "tier_not_open");
    if (tier.sale_end && Date.parse(tier.sale_end) < currentTime) return fail(400, "tier_closed");
    if (tier.quota) {
      const { data: tierSold } = await ctx.supabase
        .from("event_tickets")
        .select("id,payment_status,status")
        .eq("event_id", eventId)
        .eq("tier_id", tier.id);
      const sold = (tierSold ?? []).filter((t) => t.status !== "cancelled").length;
      if (sold >= tier.quota) return fail(409, "tier_sold_out");
    }
  }
  const existing = await isEnrolled(ctx.supabase, "event_tickets", "event_id", eventId, account?.id ?? "00000000-0000-0000-0000-000000000000");
  if (existing) return fail(409, "already_purchased");
  if (event.capacity) {
    const { data: current } = await ctx.supabase
      .from("event_tickets")
      .select("id")
      .eq("event_id", eventId)
      .eq("status", "valid");
    if ((current ?? []).length + 1 > event.capacity) return fail(409, "event_full");
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
        transaction_details: { order_id: orderId, gross_amount: price },
        item_details: [{ id: tier?.id ?? eventId, price, quantity: 1, name: `${event.title}${tier ? ` — ${tier.name}` : ""}`.slice(0, 50) }],
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
    ticket_type: tier ? `tier:${tier.name}` : "paid",
    tier_id: tier?.id ?? null,
    price,
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
  const names = await namesFor(ctx.supabase, [ticket.account_id]);
  const attendeeName =
    names.get(ticket.account_id)?.displayName ?? names.get(ticket.account_id)?.nickname ?? "Peserta";
  return ok({ checkedIn: true, attendeeName, ticketCode: ticket.code });
}

async function eventAttendanceList(ctx) {
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
    .from("event_attendance")
    .select("*")
    .eq("event_id", eventId)
    .order("checked_at", { ascending: false })
    .limit(50);
  const names = await namesFor(ctx.supabase, (rows ?? []).map((r) => r.account_id));
  return ok({
    items: (rows ?? []).map((r) => ({
      id: r.id,
      accountId: r.account_id,
      attendeeName:
        names.get(r.account_id)?.displayName ?? names.get(r.account_id)?.nickname ?? "Peserta",
      ticketId: r.ticket_id,
      checkedAt: r.checked_at,
    })),
  });
}

async function inviteScanPermission(ctx, eventId) {
  const auth = await actor(ctx, 2);
  if (auth.error) return { error: auth.error };
  const { data: event } = await ctx.supabase.from("events").select("id,created_by").eq("id", eventId).maybeSingle();
  if (!event) return { error: fail(404, "not_found") };
  const isCreator = event.created_by === auth.account.id;
  let committeeRole = null;
  if (!isCreator) {
    const { data: row } = await ctx.supabase
      .from("event_committees")
      .select("role")
      .eq("event_id", eventId)
      .eq("account_id", auth.account.id)
      .maybeSingle();
    committeeRole = row?.role ?? null;
  }
  const canScan = isCreator || auth.rank >= 6 || committeeRole === "absen_undangan";
  return { auth, event, isCreator, committeeRole, canScan };
}

async function eventInvitationsList(ctx) {
  const eventId = text(ctx.body.eventId, 60);
  if (!eventId) return fail(400, "invalid_input");
  const perm = await inviteScanPermission(ctx, eventId);
  if (perm.error) return perm.error;
  if (!perm.canScan) return fail(403, "forbidden");
  const { data: invites } = await ctx.supabase
    .from("event_invites")
    .select("id,account_id,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(200);
  const { data: rows } = await ctx.supabase
    .from("event_invite_attendance")
    .select("*")
    .eq("event_id", eventId)
    .limit(200);
  const attendedByInvite = new Map((rows ?? []).map((r) => [r.invite_id, r.checked_at]));
  const names = await namesFor(ctx.supabase, (invites ?? []).map((i) => i.account_id));
  const items = (invites ?? []).map((i) => {
    const info = names.get(i.account_id);
    return {
      id: i.id,
      accountId: i.account_id,
      accountName: info?.displayName ?? info?.nickname ?? "Tamu undangan",
      accountPhoto: info?.photoData ?? null,
      createdAt: i.created_at ?? null,
      attendedAt: attendedByInvite.get(i.id) ?? null,
    };
  });
  const attendedCount = items.filter((i) => i.attendedAt).length;
  return ok({
    canScan: perm.canScan,
    myRole: perm.isCreator ? "ketua_panitia" : perm.committeeRole,
    total: items.length,
    attendedCount,
    items,
  });
}

async function eventInvitationsCheckin(ctx) {
  const eventId = text(ctx.body.eventId, 60);
  let inviteId = text(ctx.body.inviteId, 60);
  if (!inviteId) {
    const code = text(ctx.body.code, 160);
    if (code.startsWith(INVITE_QR_PREFIX)) {
      const parts = code.slice(INVITE_QR_PREFIX.length).split(":");
      inviteId = (parts[1] ?? parts[0] ?? "").trim();
    } else if (/^[0-9a-f-]{36}$/i.test(code)) {
      inviteId = code;
    } else {
      return fail(400, "invalid_invite_code");
    }
  }
  if (!eventId || !inviteId) return fail(400, "invalid_invite_code");
  const perm = await inviteScanPermission(ctx, eventId);
  if (perm.error) return perm.error;
  if (!perm.canScan) return fail(403, "not_invite_scanner");
  const { data: invite } = await ctx.supabase
    .from("event_invites")
    .select("id,account_id")
    .eq("id", inviteId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!invite) return fail(404, "invite_not_found");
  const { data: existing } = await ctx.supabase
    .from("event_invite_attendance")
    .select("id")
    .eq("invite_id", invite.id)
    .maybeSingle();
  if (existing) return fail(409, "invite_already_used");
  const { error } = await ctx.supabase.from("event_invite_attendance").insert({
    id: crypto.randomUUID(),
    event_id: eventId,
    invite_id: invite.id,
    account_id: invite.account_id,
    scanned_by: perm.auth.account.id,
    checked_at: now(),
  });
  if (error) return fail(500, "server_error");
  await awardKpi(ctx.supabase, invite.account_id, "event_attend", eventId);
  const names = await namesFor(ctx.supabase, [invite.account_id]);
  const info = names.get(invite.account_id);
  return ok({
    checkedIn: true,
    attendeeName: info?.displayName ?? info?.nickname ?? "Tamu undangan",
    inviteId: invite.id,
  });
}

// ---------- event management: lifecycle, planning, budgeting ----------

const parseJsonList = (value, max = 20) => {
  let arr = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      arr = value.split(",");
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => text(v, 80)).filter(Boolean).slice(0, max);
};
const jsonList = (arr, max = 20) => JSON.stringify(parseJsonList(arr, max));
const parseReportPayload = (value) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value ?? null;
  } catch {
    return null;
  }
};

async function eventManageAccess(ctx, eventId, level = "manage") {
  const auth = await actor(ctx, 2);
  if (auth.error) return { error: auth.error };
  const { data: event } = await ctx.supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return { error: fail(404, "not_found") };
  const isCreator = event.created_by === auth.account.id;
  const isAdmin = auth.rank >= 6;
  let committeeRole = null;
  if (!isCreator && !isAdmin) {
    const { data: row } = await ctx.supabase
      .from("event_committees")
      .select("role")
      .eq("event_id", eventId)
      .eq("account_id", auth.account.id)
      .maybeSingle();
    committeeRole = row?.role ?? null;
  }
  const isCommittee = isCreator || Boolean(committeeRole);
  const canManage = isCreator || isAdmin;
  const canBudget = canManage || committeeRole === "ketua_panitia" || committeeRole === "bendahara";
  const canChecklist = canBudget || Boolean(committeeRole);
  const allowed = level === "manage" ? canManage : level === "budget" ? canBudget : canChecklist;
  if (!allowed) return { error: fail(403, "forbidden") };
  return { auth, event, isCreator, isAdmin, isCommittee, committeeRole, canManage, canBudget, canChecklist };
}

async function logEventAudit(supabase, eventId, actorId, action, detail) {
  await supabase.from("event_audit_logs").insert({
    id: crypto.randomUUID(),
    event_id: eventId,
    actor_id: actorId ?? null,
    action,
    detail: detail ? text(detail, 500) : null,
    created_at: now(),
  });
}

const eventPlanTotalBudget = (items) =>
  (items ?? []).reduce((sum, i) => sum + Math.round((Number(i.quantity) || 0) * (Number(i.estimated_cost) || 0)), 0);
const eventFundingSum = (sources) => (sources ?? []).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

function eventApprovalReasons(event, sources) {
  const reasons = [];
  if ((sources ?? []).some((s) => s.type === "PLATFORM_FUND")) reasons.push("platform_fund");
  if ((sources ?? []).some((s) => s.type === "SPONSORSHIP")) reasons.push("sponsorship");
  if ((Number(event.capacity) || 0) > 1000) reasons.push("audience_over_1000");
  if (event.category === "charity") reasons.push("charity_category");
  if (event.category === "conference" && event.permit_required) reasons.push("conference_permit");
  return reasons;
}

async function eventReadiness(supabase, event) {
  const missing = [];
  const { data: plan } = await supabase.from("event_plans").select("*").eq("event_id", event.id).maybeSingle();
  if (!plan || !text(plan.target_audience ?? "", 500) || !text(plan.objectives ?? "", 1000)) missing.push("plan");
  const { data: items } = await supabase.from("event_budget_items").select("quantity,estimated_cost").eq("event_id", event.id);
  const totalBudget = eventPlanTotalBudget(items);
  if (!(items ?? []).length) missing.push("budget_items");
  const { data: sources } = await supabase.from("event_funding_sources").select("type,amount").eq("event_id", event.id);
  const totalFunding = eventFundingSum(sources);
  if ((items ?? []).length && totalFunding < totalBudget) missing.push("funding_deficit");
  const { data: sessions } = await supabase.from("event_sessions").select("id").eq("event_id", event.id);
  if (!(sessions ?? []).length) missing.push("rundown");
  return {
    plan: plan ?? null,
    totalBudget,
    totalFunding,
    deficit: Math.max(0, totalBudget - totalFunding),
    sources: sources ?? [],
    missing,
  };
}

async function publishEventNow(supabase, event, actorId) {
  await supabase.from("events").update({ status: "published", requires_approval: false }).eq("id", event.id);
  if (event.location_type === "virtual" || event.location_type === "hybrid") {
    const { data: room } = await supabase.from("event_live_streams").select("id").eq("event_id", event.id).maybeSingle();
    if (!room) {
      await supabase.from("event_live_streams").insert({
        id: crypto.randomUUID(),
        event_id: event.id,
        provider: event.virtual_platform === "zoom" || event.virtual_platform === "google_meet" ? event.virtual_platform : "internal",
        status: "idle",
        started_at: null,
        ended_at: null,
        created_at: now(),
      });
    }
  }
  await awardKpi(supabase, event.created_by, "event_create", event.id);
  await logEventAudit(supabase, event.id, actorId, "event.publish", null);
}

async function replaceEventCollection(supabase, table, eventId, rows) {
  await supabase.from(table).delete().eq("event_id", eventId);
  for (const row of rows) {
    const { error } = await supabase.from(table).insert({ id: crypto.randomUUID(), event_id: eventId, created_at: now(), ...row });
    if (error) return error;
  }
  return null;
}

async function maybeNotifyRegistrationMilestone(supabase, event, count) {
  const hit = EVENT_MILESTONES.filter((m) => count >= m).pop();
  if (!hit) return;
  const marker = `registration.milestone.${hit}`;
  const { data: existing } = await supabase
    .from("event_audit_logs")
    .select("id")
    .eq("event_id", event.id)
    .eq("action", marker)
    .maybeSingle();
  if (existing) return;
  await logEventAudit(supabase, event.id, null, marker, null);
  await notify(
    supabase,
    event.created_by,
    "event_milestone",
    null,
    `Pendaftar event "${event.title}" mencapai ${hit} orang.`,
    `/event/${event.id}/kelola`,
  );
}

const sanitizeBudgetItem = (row) => ({
  category: BUDGET_CATEGORIES.includes(String(row?.category ?? "").toUpperCase()) ? String(row.category).toUpperCase() : "OTHER",
  name: text(row?.name, 160),
  quantity: Math.max(0, Number(row?.quantity) || 0),
  unit: textOrNull(row?.unit, 40),
  estimated_cost: Math.max(0, Math.round(Number(row?.estimatedCost ?? row?.estimated_cost) || 0)),
  notes: textOrNull(row?.notes, 300),
});

const sanitizeFundingSource = (row) => ({
  type: FUNDING_SOURCE_TYPES.includes(String(row?.type ?? "").toUpperCase()) ? String(row.type).toUpperCase() : "SELF_FUNDED",
  name: text(row?.name, 160),
  amount: Math.max(0, Math.round(Number(row?.amount) || 0)),
  notes: textOrNull(row?.notes, 300),
});

const sanitizeChecklistItem = (row, orderIndex) => ({
  title: text(row?.title, 200),
  category: textOrNull(row?.category, 60),
  status: CHECKLIST_STATUSES.includes(row?.status) ? row.status : "pending",
  priority: ["low", "medium", "high"].includes(row?.priority) ? row.priority : "medium",
  due_at: row?.dueAt && !Number.isNaN(Date.parse(row.dueAt)) ? new Date(row.dueAt).toISOString() : null,
  assignee_account_id: textOrNull(row?.assigneeAccountId, 60),
  order_index: Number.isInteger(row?.orderIndex) ? row.orderIndex : orderIndex,
  reminder_stage: null,
  completed_at: row?.status === "done" ? now() : null,
});

const sanitizeSession = (row) => ({
  title: text(row?.title, 200),
  description: textOrNull(row?.description, 1000),
  starts_at: row?.startsAt && !Number.isNaN(Date.parse(row.startsAt)) ? new Date(row.startsAt).toISOString() : null,
  ends_at: row?.endsAt && !Number.isNaN(Date.parse(row.endsAt)) ? new Date(row.endsAt).toISOString() : null,
  room: textOrNull(row?.room, 160),
  order_index: Number.isInteger(row?.orderIndex) ? row.orderIndex : 0,
});

const sanitizeTier = (row) => ({
  name: text(row?.name, 80),
  price: Math.max(0, Math.round(Number(row?.price) || 0)),
  quota: Math.max(0, Math.round(Number(row?.quota) || 0)),
  benefits: textOrNull(row?.benefits, 600),
  sale_start: row?.saleStart && !Number.isNaN(Date.parse(row.saleStart)) ? new Date(row.saleStart).toISOString() : null,
  sale_end: row?.saleEnd && !Number.isNaN(Date.parse(row.saleEnd)) ? new Date(row.saleEnd).toISOString() : null,
});

async function eventWizardSave(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { body } = ctx;
  const basic = body.basic ?? {};
  const schedule = body.schedule ?? {};
  const plan = body.plan ?? {};
  const budget = body.budget ?? null;

  let event = null;
  const existingId = text(body.eventId, 60);
  if (existingId) {
    const { data: row } = await ctx.supabase.from("events").select("*").eq("id", existingId).maybeSingle();
    if (!row) return fail(404, "not_found");
    if (row.created_by !== auth.account.id && auth.rank < 6) return fail(403, "forbidden");
    if (["cancelled", "archived", "completed"].includes(row.status)) return fail(409, "invalid_status");
    event = row;
  }

  let title = event?.title ?? "";
  if (basic.title !== undefined) title = text(basic.title, 140);
  if (!existingId && title.length < 3) return fail(400, "invalid_input");
  let audience = event?.audience ?? "anggota";
  if (basic.audience !== undefined) audience = AUDIENCES.includes(basic.audience) ? basic.audience : audience;
  if (audience === "undangan" && auth.rank < 4) return fail(403, "forbidden");

  const patch = {};
  if (basic.title !== undefined) patch.title = title;
  if (basic.audience !== undefined) patch.audience = audience;
  if (basic.description !== undefined) patch.description = textOrNull(basic.description, 1500);
  if (basic.category !== undefined) patch.category = EVENT_CATEGORIES.includes(basic.category) ? basic.category : "other";
  if (basic.tags !== undefined) patch.tags = jsonList(basic.tags);
  if (basic.coverImage !== undefined) patch.cover_image = textOrNull(basic.coverImage, 900_000);
  if (schedule.startsAt !== undefined && schedule.startsAt && !Number.isNaN(Date.parse(schedule.startsAt))) {
    patch.starts_at = new Date(schedule.startsAt).toISOString();
  }
  if (schedule.endsAt !== undefined) {
    patch.ends_at = schedule.endsAt && !Number.isNaN(Date.parse(schedule.endsAt)) ? new Date(schedule.endsAt).toISOString() : null;
  }
  if (schedule.timezone !== undefined) patch.timezone = text(schedule.timezone, 60) || "Asia/Jakarta";
  if (schedule.locationType !== undefined) patch.location_type = EVENT_LOCATION_TYPES.includes(schedule.locationType) ? schedule.locationType : "physical";
  if (schedule.venueName !== undefined) patch.venue_name = textOrNull(schedule.venueName, 160);
  if (schedule.venueAddress !== undefined) patch.venue_address = textOrNull(schedule.venueAddress, 300);
  if (schedule.venueMapsUrl !== undefined) patch.venue_maps_url = textOrNull(schedule.venueMapsUrl, 400);
  if (schedule.virtualPlatform !== undefined) {
    patch.virtual_platform = VIRTUAL_PLATFORMS.includes(schedule.virtualPlatform) ? schedule.virtualPlatform : null;
  }
  if (schedule.virtualUrl !== undefined) patch.virtual_url = textOrNull(schedule.virtualUrl, 400);
  if (schedule.capacity !== undefined) patch.capacity = intOrNull(schedule.capacity, 1, 100000);
  if (schedule.permitRequired !== undefined) patch.permit_required = Boolean(schedule.permitRequired);
  if (schedule.fundingTarget !== undefined) {
    patch.funding_target = budget && Array.isArray(budget.items)
      ? eventPlanTotalBudget(budget.items.map(sanitizeBudgetItem))
      : intOrNull(schedule.fundingTarget, 0, 1000000000000);
  }
  const effectiveType = patch.location_type ?? event?.location_type ?? "physical";
  const effectiveVenueName = patch.venueName !== undefined ? patch.venueName : event?.venue_name ?? null;
  const effectiveVenueAddress = patch.venueAddress !== undefined ? patch.venueAddress : event?.venue_address ?? null;
  if (patch.venueName !== undefined || patch.venueAddress !== undefined || patch.location_type !== undefined) {
    if (effectiveType === "virtual") {
      patch.location = effectiveVenueName ?? "Online";
    } else if (effectiveVenueName || effectiveVenueAddress) {
      patch.location = [effectiveVenueName, effectiveVenueAddress].filter(Boolean).join(", ").slice(0, 160);
    }
  }

  if (!event) {
    const groupRow = {
      id: crypto.randomUUID(),
      name: `${title}`.slice(0, 80),
      description: `Grup koordinasi kepanitiaan event "${title}".`,
      audience_min_role: "wonder_woman",
      capacity: 0,
      created_by: auth.account.id,
      created_at: now(),
    };
    const { error: groupError } = await ctx.supabase.from("groups").insert(groupRow);
    if (groupError) return fail(500, "server_error");
    await ctx.supabase.from("group_members").insert({
      id: crypto.randomUUID(),
      group_id: groupRow.id,
      account_id: auth.account.id,
      created_at: now(),
    });
    const row = {
      id: crypto.randomUUID(),
      title,
      description: null,
      audience,
      location: "Akan ditentukan",
      starts_at: patch.starts_at ?? now(),
      ends_at: null,
      capacity: null,
      funding_target: null,
      ticket_price: null,
      group_id: groupRow.id,
      category: "other",
      tags: null,
      cover_image: null,
      timezone: "Asia/Jakarta",
      location_type: "physical",
      venue_name: null,
      venue_address: null,
      venue_maps_url: null,
      virtual_platform: null,
      virtual_url: null,
      permit_required: false,
      requires_approval: false,
      live_room_status: "idle",
      status: "draft",
      created_by: auth.account.id,
      created_at: now(),
      ...patch,
    };
    const { error } = await ctx.supabase.from("events").insert(row);
    if (error) return fail(500, "server_error");
    await ctx.supabase.from("event_committees").insert({
      id: crypto.randomUUID(),
      event_id: row.id,
      account_id: auth.account.id,
      role: "ketua_panitia",
      created_at: now(),
    });
    event = row;
    await logEventAudit(ctx.supabase, row.id, auth.account.id, "event.draft.create", null);
  } else if (Object.keys(patch).length) {
    const { error } = await ctx.supabase.from("events").update(patch).eq("id", event.id);
    if (error) return fail(500, "server_error");
    event = { ...event, ...patch };
  }

  if (body.plan !== undefined) {
    const { data: existingPlan } = await ctx.supabase.from("event_plans").select("id").eq("event_id", event.id).maybeSingle();
    const planPatch = {};
    if (plan.targetAudience !== undefined) planPatch.target_audience = textOrNull(plan.targetAudience, 800);
    if (plan.objectives !== undefined) planPatch.objectives = textOrNull(plan.objectives, 2000);
    if (plan.requirements !== undefined) planPatch.requirements = textOrNull(plan.requirements, 2000);
    if (plan.marketingPlan !== undefined) planPatch.marketing_plan = textOrNull(plan.marketingPlan, 2000);
    if (plan.promotionChannels !== undefined) planPatch.promotion_channels = jsonList(plan.promotionChannels);
    if (plan.riskAssessment !== undefined) planPatch.risk_assessment = textOrNull(plan.riskAssessment, 2000);
    if (existingPlan) {
      await ctx.supabase.from("event_plans").update({ ...planPatch, updated_at: now() }).eq("id", existingPlan.id);
    } else if (Object.keys(planPatch).length) {
      const { error } = await ctx.supabase.from("event_plans").insert({
        id: crypto.randomUUID(),
        event_id: event.id,
        target_audience: null,
        objectives: null,
        requirements: null,
        marketing_plan: null,
        promotion_channels: null,
        risk_assessment: null,
        created_at: now(),
        updated_at: now(),
        ...planPatch,
      });
      if (error) return fail(500, "server_error");
    }
  }

  if (Array.isArray(body.sessions)) {
    const rows = body.sessions.map(sanitizeSession).filter((s) => s.title);
    const error = await replaceEventCollection(ctx.supabase, "event_sessions", event.id, rows);
    if (error) return fail(500, "server_error");
  }
  if (Array.isArray(body.checklist)) {
    const rows = body.checklist.map((r, i) => sanitizeChecklistItem(r, i)).filter((c) => c.title);
    const error = await replaceEventCollection(ctx.supabase, "event_checklists", event.id, rows);
    if (error) return fail(500, "server_error");
  }
  if (budget && Array.isArray(budget.items)) {
    const rows = budget.items.map(sanitizeBudgetItem).filter((i) => i.name);
    const error = await replaceEventCollection(ctx.supabase, "event_budget_items", event.id, rows);
    if (error) return fail(500, "server_error");
    await ctx.supabase.from("events").update({ funding_target: eventPlanTotalBudget(rows) || null }).eq("id", event.id);
  }
  if (budget && Array.isArray(budget.sources)) {
    const rows = budget.sources.map(sanitizeFundingSource).filter((s) => s.name);
    const error = await replaceEventCollection(ctx.supabase, "event_funding_sources", event.id, rows);
    if (error) return fail(500, "server_error");
  }
  if (Array.isArray(body.tiers)) {
    const rows = body.tiers.map(sanitizeTier).filter((t) => t.name);
    const error = await replaceEventCollection(ctx.supabase, "event_ticket_tiers", event.id, rows);
    if (error) return fail(500, "server_error");
  }

  if (["draft", "planning", "budgeting"].includes(event.status)) {
    const { data: planRow } = await ctx.supabase.from("event_plans").select("target_audience,objectives").eq("event_id", event.id).maybeSingle();
    const hasPlan = Boolean(planRow && text(planRow.target_audience ?? "", 500) && text(planRow.objectives ?? "", 1000));
    const { data: itemRows } = await ctx.supabase.from("event_budget_items").select("id").eq("event_id", event.id);
    const { data: sessionRows } = await ctx.supabase.from("event_sessions").select("id").eq("event_id", event.id);
    let nextStatus = "draft";
    if (hasPlan) nextStatus = "planning";
    if (hasPlan && (itemRows ?? []).length && (sessionRows ?? []).length) nextStatus = "budgeting";
    if (nextStatus !== event.status) {
      await ctx.supabase.from("events").update({ status: nextStatus }).eq("id", event.id);
      event = { ...event, status: nextStatus };
    }
  }

  return ok({ eventId: event.id, status: event.status });
}

async function eventPublish(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "manage");
  if (access.error) return access.error;
  const { event } = access;
  if (["cancelled", "archived"].includes(event.status)) return fail(409, "invalid_status");
  if (["published", "ongoing", "completed"].includes(event.status)) return ok({ status: event.status });
  if (event.status === "pending_approval") return fail(409, "approval_pending");
  const ready = await eventReadiness(ctx.supabase, event);
  if (ready.missing.length) {
    return json({ ok: false, error: "publish_incomplete", missing: ready.missing }, 422);
  }
  const reasons = eventApprovalReasons(event, ready.sources);
  if (reasons.length) {
    const { data: pending } = await ctx.supabase
      .from("event_approvals")
      .select("id")
      .eq("event_id", id)
      .eq("status", "pending")
      .maybeSingle();
    if (!pending) {
      await ctx.supabase.from("event_approvals").insert({
        id: crypto.randomUUID(),
        event_id: id,
        status: "pending",
        requested_by: auth.account.id,
        reviewed_by: null,
        reason: reasons.join(","),
        decision_note: null,
        created_at: now(),
        decided_at: null,
      });
    }
    await ctx.supabase.from("events").update({ status: "pending_approval", requires_approval: true }).eq("id", id);
    const { data: admins } = await ctx.supabase.from("accounts").select("id,role").eq("role", "admin");
    for (const admin of admins ?? []) {
      await notify(
        ctx.supabase,
        admin.id,
        "event_approval",
        auth.account.id,
        `Event "${event.title}" menunggu persetujuan Anda.`,
        `/admin`,
      );
    }
    await logEventAudit(ctx.supabase, id, auth.account.id, "approval.submit", reasons.join(","));
    return ok({ status: "pending_approval", reasons });
  }
  await publishEventNow(ctx.supabase, event, auth.account.id);
  return ok({ status: "published" });
}

async function eventManageGet(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "checklist");
  if (access.error) return access.error;
  const { supabase } = ctx;
  const { event } = access;

  const { data: plan } = await supabase.from("event_plans").select("*").eq("event_id", id).maybeSingle();
  const { data: budgetItems } = await supabase.from("event_budget_items").select("*").eq("event_id", id).order("created_at", { ascending: true });
  const { data: fundingSources } = await supabase.from("event_funding_sources").select("*").eq("event_id", id).order("created_at", { ascending: true });
  const { data: sessions } = await supabase.from("event_sessions").select("*").eq("event_id", id).order("order_index", { ascending: true });
  const { data: speakers } = await supabase.from("event_speakers").select("*").eq("event_id", id);
  const { data: checklists } = await supabase.from("event_checklists").select("*").eq("event_id", id).order("order_index", { ascending: true });
  const { data: expenses } = await supabase.from("event_expenses").select("*").eq("event_id", id).order("created_at", { ascending: false });
  const { data: tiers } = await supabase.from("event_ticket_tiers").select("*").eq("event_id", id).order("created_at", { ascending: true });
  const { data: reports } = await supabase.from("event_reports").select("*").eq("event_id", id).order("created_at", { ascending: false }).limit(5);
  const { data: auditLogs } = await supabase.from("event_audit_logs").select("*").eq("event_id", id).order("created_at", { ascending: false }).limit(20);
  const { data: approval } = await supabase.from("event_approvals").select("*").eq("event_id", id).order("created_at", { ascending: false }).limit(1);
  const { data: liveRows } = await supabase.from("event_live_streams").select("*").eq("event_id", id);
  const { data: committees } = await supabase.from("event_committees").select("*").eq("event_id", id).order("created_at", { ascending: true });
  const { data: tickets } = await supabase.from("event_tickets").select("id,status,tier_id,payment_status").eq("event_id", id);
  const { data: rsvpRows } = await supabase.from("event_rsvps").select("account_id,status").eq("event_id", id);
  const { data: attendanceRows } = await supabase.from("event_attendance").select("id").eq("event_id", id);
  const { data: inviteRows } = await supabase.from("event_invites").select("id").eq("event_id", id);
  const { data: inviteAttendanceRows } = await supabase.from("event_invite_attendance").select("id").eq("event_id", id);

  const totalBudget = eventPlanTotalBudget(budgetItems);
  const totalFunding = eventFundingSum(fundingSources);
  const approvedExpenses = (expenses ?? []).filter((e) => e.status === "approved");
  const totalSpent = approvedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const actualByItem = new Map();
  for (const e of approvedExpenses) {
    if (!e.budget_item_id) continue;
    actualByItem.set(e.budget_item_id, (actualByItem.get(e.budget_item_id) ?? 0) + (Number(e.amount) || 0));
  }
  const byCategory = BUDGET_CATEGORIES.map((category) => ({
    category,
    planned: (budgetItems ?? []).filter((i) => i.category === category).reduce((s, i) => s + Math.round((Number(i.quantity) || 0) * (Number(i.estimated_cost) || 0)), 0),
    actual: (expenses ?? []).filter((e) => e.category === category && e.status === "approved").reduce((s, e) => s + (Number(e.amount) || 0), 0),
  })).filter((c) => c.planned > 0 || c.actual > 0);

  const teamIds = (committees ?? []).map((c) => c.account_id);
  const peopleIds = [...new Set([...teamIds, ...(checklists ?? []).map((c) => c.assignee_account_id), ...(expenses ?? []).map((e) => e.recorded_by), ...(auditLogs ?? []).map((a) => a.actor_id), approval?.[0]?.reviewed_by].filter(Boolean))];
  const names = await namesFor(supabase, peopleIds);
  const nameOf = (accountId) => {
    const info = accountId ? names.get(accountId) : null;
    return info?.displayName ?? info?.nickname ?? "Anggota";
  };

  const tierSold = new Map();
  for (const t of tickets ?? []) {
    if (t.tier_id && ["valid", "used"].includes(t.status)) tierSold.set(t.tier_id, (tierSold.get(t.tier_id) ?? 0) + 1);
  }

  const checklistItems = (checklists ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category ?? null,
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at ?? null,
    assigneeAccountId: row.assignee_account_id ?? null,
    assigneeName: row.assignee_account_id ? nameOf(row.assignee_account_id) : null,
    orderIndex: row.order_index ?? 0,
    completedAt: row.completed_at ?? null,
  }));
  const dueSoon = checklistItems.filter(
    (c) => c.status !== "done" && c.dueAt && Date.parse(c.dueAt) - Date.now() <= 3 * 24 * 3600 * 1000,
  );

  const going = (rsvpRows ?? []).filter((r) => r.status === "going").length;
  const ticketCount = (tickets ?? []).length;
  const paidCount = (tickets ?? []).filter((t) => t.status === "valid" || t.status === "used").length;
  const pendingChecklists = checklistItems.filter((c) => c.status !== "done").length;
  const myInviteRow = (inviteRows ?? []).length;

  return ok({
    event: {
      ...eventPublic(event),
      permitRequired: Boolean(event.permit_required),
      requiresApproval: Boolean(event.requires_approval),
      timezone: event.timezone ?? "Asia/Jakarta",
      venueName: event.venue_name ?? null,
      venueAddress: event.venue_address ?? null,
      venueMapsUrl: event.venue_maps_url ?? null,
    },
    permissions: {
      canManage: access.canManage,
      canBudget: access.canBudget,
      canChecklist: access.canChecklist,
      isCreator: access.isCreator,
      committeeRole: access.committeeRole,
    },
    plan: plan
      ? {
          targetAudience: plan.target_audience ?? null,
          objectives: plan.objectives ?? null,
          requirements: plan.requirements ?? null,
          marketingPlan: plan.marketing_plan ?? null,
          promotionChannels: parseJsonList(plan.promotion_channels ?? ""),
          riskAssessment: plan.risk_assessment ?? null,
          updatedAt: plan.updated_at ?? null,
        }
      : null,
    budgetItems: (budgetItems ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      name: row.name,
      quantity: Number(row.quantity) || 0,
      unit: row.unit ?? null,
      estimatedCost: Number(row.estimated_cost) || 0,
      actualCost: actualByItem.get(row.id) ?? 0,
      notes: row.notes ?? null,
    })),
    fundingSources: (fundingSources ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      amount: Number(row.amount) || 0,
      notes: row.notes ?? null,
    })),
    totals: {
      totalBudget,
      totalFunding,
      deficit: Math.max(0, totalBudget - totalFunding),
      totalSpent,
      remaining: totalBudget - totalSpent,
      budgetUsagePct: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
      byCategory,
    },
    sessions: (sessions ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      startsAt: row.starts_at ?? null,
      endsAt: row.ends_at ?? null,
      room: row.room ?? null,
      orderIndex: row.order_index ?? 0,
      speakers: (speakers ?? [])
        .filter((s) => s.session_id === row.id)
        .map((s) => ({ id: s.id, name: s.name, topic: s.topic ?? null, accountId: s.account_id ?? null })),
    })),
    checklists: checklistItems,
    dueSoon,
    expenses: (expenses ?? []).map((row) => ({
      id: row.id,
      budgetItemId: row.budget_item_id ?? null,
      category: row.category,
      description: row.description,
      amount: Number(row.amount) || 0,
      spentAt: row.spent_at ?? null,
      recordedBy: row.recorded_by,
      recordedByName: nameOf(row.recorded_by),
      status: row.status,
      reviewedBy: row.reviewed_by ?? null,
      reviewedByName: row.reviewed_by ? nameOf(row.reviewed_by) : null,
      createdAt: row.created_at,
    })),
    tiers: (tiers ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price) || 0,
      quota: Number(row.quota) || 0,
      benefits: row.benefits ?? null,
      saleStart: row.sale_start ?? null,
      saleEnd: row.sale_end ?? null,
      sold: tierSold.get(row.id) ?? 0,
    })),
    reports: (reports ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      generatedByName: nameOf(row.generated_by),
      createdAt: row.created_at,
      payload: parseReportPayload(row.payload),
    })),
    approval: approval?.[0]
      ? {
          id: approval[0].id,
          status: approval[0].status,
          reason: parseJsonList(approval[0].reason ?? "", 10),
          decisionNote: approval[0].decision_note ?? null,
          createdAt: approval[0].created_at,
          decidedAt: approval[0].decided_at ?? null,
          reviewedByName: approval[0].reviewed_by ? nameOf(approval[0].reviewed_by) : null,
        }
      : null,
    auditLogs: (auditLogs ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      detail: row.detail ?? null,
      actorName: row.actor_id ? nameOf(row.actor_id) : "Sistem",
      createdAt: row.created_at,
    })),
    liveRoom: event.location_type === "virtual" || event.location_type === "hybrid"
      ? {
          status: event.live_room_status ?? "idle",
          startedAt: liveRows?.[0]?.started_at ?? null,
          endedAt: liveRows?.[0]?.ended_at ?? null,
          provider: liveRows?.[0]?.provider ?? (event.virtual_platform ?? "internal"),
          joinPath: `/event/${id}`,
        }
      : null,
    team: (committees ?? []).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      name: nameOf(row.account_id),
      role: row.role,
    })),
    metrics: {
      going,
      tickets: ticketCount,
      registrations: Math.max(going, ticketCount),
      paidCount,
      attendanceCount: (attendanceRows ?? []).length,
      invites: myInviteRow,
      attendedInvites: (inviteAttendanceRows ?? []).length,
      pendingChecklists,
      checklistTotal: checklistItems.length,
      daysToEvent: event.starts_at ? Math.ceil((Date.parse(event.starts_at) - Date.now()) / (24 * 3600 * 1000)) : null,
    },
  });
}

async function eventPlanSave(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "manage");
  if (access.error) return access.error;
  const plan = ctx.body.plan ?? {};
  const { data: existing } = await ctx.supabase.from("event_plans").select("id").eq("event_id", id).maybeSingle();
  const patch = {
    target_audience: textOrNull(plan.targetAudience, 800),
    objectives: textOrNull(plan.objectives, 2000),
    requirements: textOrNull(plan.requirements, 2000),
    marketing_plan: textOrNull(plan.marketingPlan, 2000),
    promotion_channels: jsonList(plan.promotionChannels),
    risk_assessment: textOrNull(plan.riskAssessment, 2000),
    updated_at: now(),
  };
  if (existing) {
    await ctx.supabase.from("event_plans").update(patch).eq("id", existing.id);
  } else {
    await ctx.supabase.from("event_plans").insert({ id: crypto.randomUUID(), event_id: id, created_at: now(), ...patch });
  }
  await logEventAudit(ctx.supabase, id, access.auth.account.id, "plan.update", null);
  return ok({ saved: true });
}

async function eventBudgetItemSave(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "budget");
  if (access.error) return access.error;
  const row = sanitizeBudgetItem(ctx.body.item ?? {});
  if (!row.name) return fail(400, "invalid_input");
  const itemId = text(ctx.body.item?.id, 60);
  if (itemId) {
    const { data: existing } = await ctx.supabase.from("event_budget_items").select("id").eq("id", itemId).eq("event_id", id).maybeSingle();
    if (!existing) return fail(404, "not_found");
    await ctx.supabase.from("event_budget_items").update(row).eq("id", itemId);
    await logEventAudit(ctx.supabase, id, access.auth.account.id, "budget_item.update", `${row.name} (${row.category})`);
    return ok({ item: { id: itemId, ...row } });
  }
  const newId = crypto.randomUUID();
  const { error } = await ctx.supabase.from("event_budget_items").insert({ id: newId, event_id: id, created_at: now(), ...row });
  if (error) return fail(500, "server_error");
  await logEventAudit(ctx.supabase, id, access.auth.account.id, "budget_item.create", `${row.name} (${row.category})`);
  return ok({ item: { id: newId, ...row } });
}

async function eventBudgetItemDelete(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "budget");
  if (access.error) return access.error;
  const itemId = text(ctx.body.itemId, 60);
  const { data: existing } = await ctx.supabase.from("event_budget_items").select("id,name").eq("id", itemId).eq("event_id", id).maybeSingle();
  if (!existing) return fail(404, "not_found");
  await ctx.supabase.from("event_budget_items").delete().eq("id", itemId);
  await logEventAudit(ctx.supabase, id, access.auth.account.id, "budget_item.delete", existing.name);
  return ok({ deleted: true });
}

async function eventFundingSave(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "budget");
  if (access.error) return access.error;
  const row = sanitizeFundingSource(ctx.body.source ?? {});
  if (!row.name) return fail(400, "invalid_input");
  const sourceId = text(ctx.body.source?.id, 60);
  if (sourceId) {
    const { data: existing } = await ctx.supabase.from("event_funding_sources").select("id").eq("id", sourceId).eq("event_id", id).maybeSingle();
    if (!existing) return fail(404, "not_found");
    await ctx.supabase.from("event_funding_sources").update(row).eq("id", sourceId);
    await logEventAudit(ctx.supabase, id, access.auth.account.id, "funding.update", `${row.name} (${row.type})`);
    return ok({ source: { id: sourceId, ...row } });
  }
  const newId = crypto.randomUUID();
  const { error } = await ctx.supabase.from("event_funding_sources").insert({ id: newId, event_id: id, created_at: now(), ...row });
  if (error) return fail(500, "server_error");
  await logEventAudit(ctx.supabase, id, access.auth.account.id, "funding.create", `${row.name} (${row.type})`);
  return ok({ source: { id: newId, ...row } });
}

async function eventFundingDelete(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "budget");
  if (access.error) return access.error;
  const sourceId = text(ctx.body.sourceId, 60);
  const { data: existing } = await ctx.supabase.from("event_funding_sources").select("id,name").eq("id", sourceId).eq("event_id", id).maybeSingle();
  if (!existing) return fail(404, "not_found");
  await ctx.supabase.from("event_funding_sources").delete().eq("id", sourceId);
  await logEventAudit(ctx.supabase, id, access.auth.account.id, "funding.delete", existing.name);
  return ok({ deleted: true });
}

async function eventSessionSave(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "checklist");
  if (access.error) return access.error;
  const row = sanitizeSession(ctx.body.session ?? {});
  if (!row.title) return fail(400, "invalid_input");
  const sessionId = text(ctx.body.session?.id, 60);
  if (sessionId) {
    const { data: existing } = await ctx.supabase.from("event_sessions").select("id").eq("id", sessionId).eq("event_id", id).maybeSingle();
    if (!existing) return fail(404, "not_found");
    await ctx.supabase.from("event_sessions").update(row).eq("id", sessionId);
    return ok({ session: { id: sessionId, ...row } });
  }
  const newId = crypto.randomUUID();
  const { error } = await ctx.supabase.from("event_sessions").insert({ id: newId, event_id: id, created_at: now(), ...row });
  if (error) return fail(500, "server_error");
  return ok({ session: { id: newId, ...row } });
}

async function eventSessionDelete(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "checklist");
  if (access.error) return access.error;
  const sessionId = text(ctx.body.sessionId, 60);
  const { data: existing } = await ctx.supabase.from("event_sessions").select("id").eq("id", sessionId).eq("event_id", id).maybeSingle();
  if (!existing) return fail(404, "not_found");
  await ctx.supabase.from("event_speakers").delete().eq("session_id", sessionId);
  await ctx.supabase.from("event_sessions").delete().eq("id", sessionId);
  return ok({ deleted: true });
}

async function eventSpeakerSave(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "checklist");
  if (access.error) return access.error;
  const speaker = ctx.body.speaker ?? {};
  const name = text(speaker.name, 120);
  if (!name) return fail(400, "invalid_input");
  const sessionId = textOrNull(speaker.sessionId, 60);
  const row = {
    session_id: sessionId,
    account_id: textOrNull(speaker.accountId, 60),
    name,
    topic: textOrNull(speaker.topic, 200),
    bio: textOrNull(speaker.bio, 600),
  };
  const speakerId = text(speaker.id, 60);
  if (speakerId) {
    const { data: existing } = await ctx.supabase.from("event_speakers").select("id").eq("id", speakerId).eq("event_id", id).maybeSingle();
    if (!existing) return fail(404, "not_found");
    await ctx.supabase.from("event_speakers").update(row).eq("id", speakerId);
    return ok({ speaker: { id: speakerId, ...row } });
  }
  const newId = crypto.randomUUID();
  const { error } = await ctx.supabase.from("event_speakers").insert({ id: newId, event_id: id, created_at: now(), ...row });
  if (error) return fail(500, "server_error");
  return ok({ speaker: { id: newId, ...row } });
}

async function eventSpeakerDelete(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "checklist");
  if (access.error) return access.error;
  const speakerId = text(ctx.body.speakerId, 60);
  const { data: existing } = await ctx.supabase.from("event_speakers").select("id").eq("id", speakerId).eq("event_id", id).maybeSingle();
  if (!existing) return fail(404, "not_found");
  await ctx.supabase.from("event_speakers").delete().eq("id", speakerId);
  return ok({ deleted: true });
}

async function eventChecklistSave(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "checklist");
  if (access.error) return access.error;
  const item = ctx.body.item ?? {};
  const itemId = text(item.id, 60);
  if (itemId) {
    const { data: existing } = await ctx.supabase.from("event_checklists").select("*").eq("id", itemId).eq("event_id", id).maybeSingle();
    if (!existing) return fail(404, "not_found");
    const patch = {};
    if (item.title !== undefined) patch.title = text(item.title, 200);
    if (item.category !== undefined) patch.category = textOrNull(item.category, 60);
    if (item.priority !== undefined && ["low", "medium", "high"].includes(item.priority)) patch.priority = item.priority;
    if (item.dueAt !== undefined) patch.due_at = item.dueAt && !Number.isNaN(Date.parse(item.dueAt)) ? new Date(item.dueAt).toISOString() : null;
    if (item.assigneeAccountId !== undefined) patch.assignee_account_id = textOrNull(item.assigneeAccountId, 60);
    if (item.status !== undefined && CHECKLIST_STATUSES.includes(item.status)) {
      patch.status = item.status;
      patch.completed_at = item.status === "done" ? now() : null;
    }
    if (item.orderIndex !== undefined && Number.isInteger(item.orderIndex)) patch.order_index = item.orderIndex;
    if (patch.due_at !== undefined) patch.reminder_stage = null;
    if (patch.title !== undefined && !patch.title) return fail(400, "invalid_input");
    await ctx.supabase.from("event_checklists").update(patch).eq("id", itemId);
    return ok({ item: { ...existing, ...patch } });
  }
  const row = sanitizeChecklistItem(item, 0);
  if (!row.title) return fail(400, "invalid_input");
  const newId = crypto.randomUUID();
  const { error } = await ctx.supabase.from("event_checklists").insert({ id: newId, event_id: id, created_at: now(), ...row });
  if (error) return fail(500, "server_error");
  return ok({ item: { id: newId, ...row } });
}

async function eventChecklistDelete(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "checklist");
  if (access.error) return access.error;
  const itemId = text(ctx.body.itemId, 60);
  const { data: existing } = await ctx.supabase.from("event_checklists").select("id").eq("id", itemId).eq("event_id", id).maybeSingle();
  if (!existing) return fail(404, "not_found");
  await ctx.supabase.from("event_checklists").delete().eq("id", itemId);
  return ok({ deleted: true });
}

async function eventChecklistRemind(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "checklist");
  if (access.error) return access.error;
  const { data: items } = await ctx.supabase
    .from("event_checklists")
    .select("*")
    .eq("event_id", id)
    .neq("status", "done");
  const { event } = access;
  let reminded = 0;
  const dayMs = 24 * 3600 * 1000;
  for (const item of items ?? []) {
    if (!item.due_at) continue;
    const diff = Date.parse(item.due_at) - Date.now();
    const stage = diff <= dayMs ? "h1" : diff <= 3 * dayMs ? "h3" : null;
    if (!stage || item.reminder_stage === stage) continue;
    const isUpgrade = item.reminder_stage === "h3" && stage === "h1";
    if (item.reminder_stage && !isUpgrade) continue;
    const recipient = item.assignee_account_id ?? event.created_by;
    await notify(
      ctx.supabase,
      recipient,
      "event_checklist",
      access.auth.account.id,
      stage === "h1"
        ? `Besok: "${item.title}" untuk event "${event.title}" belum selesai.`
        : `H-3: "${item.title}" untuk event "${event.title}" belum selesai.`,
      `/event/${id}/kelola`,
    );
    await ctx.supabase.from("event_checklists").update({ reminder_stage: stage }).eq("id", item.id);
    reminded += 1;
  }
  return ok({ reminded });
}

async function eventExpenseSave(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "budget");
  if (access.error) return access.error;
  const expense = ctx.body.expense ?? {};
  const description = text(expense.description, 200);
  const amount = Math.max(0, Math.round(Number(expense.amount) || 0));
  if (!description || amount <= 0) return fail(400, "invalid_input");
  const budgetItemId = textOrNull(expense.budgetItemId, 60);
  let category = "OTHER";
  if (budgetItemId) {
    const { data: item } = await ctx.supabase.from("event_budget_items").select("id,category").eq("id", budgetItemId).eq("event_id", id).maybeSingle();
    if (!item) return fail(404, "not_found");
    category = item.category;
  }
  const needsApproval = amount > EVENT_EXPENSE_APPROVAL_THRESHOLD;
  const row = {
    id: crypto.randomUUID(),
    event_id: id,
    budget_item_id: budgetItemId,
    category,
    description,
    amount,
    spent_at: expense.spentAt && !Number.isNaN(Date.parse(expense.spentAt)) ? new Date(expense.spentAt).toISOString() : now(),
    recorded_by: access.auth.account.id,
    status: needsApproval ? "pending_approval" : "approved",
    reviewed_by: null,
    created_at: now(),
  };
  const { error } = await ctx.supabase.from("event_expenses").insert(row);
  if (error) return fail(500, "server_error");
  await logEventAudit(
    ctx.supabase,
    id,
    access.auth.account.id,
    needsApproval ? "expense.create.pending" : "expense.create",
    `${description} (${amount})`,
  );
  if (needsApproval) {
    const { data: admins } = await ctx.supabase.from("accounts").select("id,role").eq("role", "admin");
    for (const admin of admins ?? []) {
      await notify(
        ctx.supabase,
        admin.id,
        "event_expense",
        access.auth.account.id,
        `Pengeluaran ${description} (Rp${amount.toLocaleString("id-ID")}) menunggu persetujuan.`,
        `/event/${id}/kelola`,
      );
    }
    const { data: chairs } = await ctx.supabase
      .from("event_committees")
      .select("account_id,role")
      .eq("event_id", id)
      .eq("role", "ketua_panitia");
    for (const chair of chairs ?? []) {
      await notify(
        ctx.supabase,
        chair.account_id,
        "event_expense",
        access.auth.account.id,
        `Pengeluaran ${description} (Rp${amount.toLocaleString("id-ID")}) menunggu persetujuan.`,
        `/event/${id}/kelola`,
      );
    }
  }
  const ready = await eventReadiness(ctx.supabase, access.event);
  const { data: allExpenses } = await ctx.supabase.from("event_expenses").select("amount,status").eq("event_id", id);
  const totalSpent = (allExpenses ?? []).filter((e) => e.status === "approved").reduce((s, e) => s + (Number(e.amount) || 0), 0);
  if (ready.totalBudget > 0 && totalSpent > ready.totalBudget) {
    const marker = `expense.overrun.${new Date().toISOString().slice(0, 10)}`;
    const { data: existingMarker } = await ctx.supabase
      .from("event_audit_logs")
      .select("id")
      .eq("event_id", id)
      .eq("action", marker)
      .maybeSingle();
    if (!existingMarker) {
      await logEventAudit(ctx.supabase, id, null, marker, null);
      await notify(
        ctx.supabase,
        access.event.created_by,
        "event_budget",
        access.auth.account.id,
        `Peringatan: pengeluaran event "${access.event.title}" melebihi anggaran.`,
        `/event/${id}/kelola`,
      );
    }
  }
  return ok({ expense: { ...row, recordedByName: null }, needsApproval });
}

async function eventExpenseReview(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "budget");
  if (access.error) return access.error;
  const expenseId = text(ctx.body.expenseId, 60);
  const decision = ctx.body.decision === "approve" ? "approved" : ctx.body.decision === "reject" ? "rejected" : null;
  if (!decision) return fail(400, "invalid_input");
  const { data: existing } = await ctx.supabase.from("event_expenses").select("*").eq("id", expenseId).eq("event_id", id).maybeSingle();
  if (!existing) return fail(404, "not_found");
  if (existing.status !== "pending_approval") return fail(409, "invalid_status");
  await ctx.supabase
    .from("event_expenses")
    .update({ status: decision, reviewed_by: access.auth.account.id, spent_at: existing.spent_at })
    .eq("id", expenseId);
  if (existing.budget_item_id && decision === "approved") {
    const { data: approvedRows } = await ctx.supabase
      .from("event_expenses")
      .select("amount")
      .eq("budget_item_id", existing.budget_item_id)
      .eq("status", "approved");
    const actual = (approvedRows ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    await ctx.supabase.from("event_budget_items").update({ actual_cost: actual }).eq("id", existing.budget_item_id);
  }
  await logEventAudit(ctx.supabase, id, access.auth.account.id, `expense.${decision}`, existing.description);
  await notify(
    ctx.supabase,
    existing.recorded_by,
    "event_expense",
    access.auth.account.id,
    decision === "approved"
      ? `Pengeluaran "${existing.description}" telah disetujui.`
      : `Pengeluaran "${existing.description}" ditolak.`,
    `/event/${id}/kelola`,
  );
  return ok({ status: decision });
}

async function eventReportGenerate(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "checklist");
  if (access.error) return access.error;
  const kind = ctx.body.kind === "attendance" ? "attendance" : "financial";
  const { supabase } = ctx;
  const { event } = access;
  const { data: items } = await supabase.from("event_budget_items").select("quantity,estimated_cost").eq("event_id", id);
  const { data: sources } = await supabase.from("event_funding_sources").select("amount").eq("event_id", id);
  const { data: expenses } = await supabase.from("event_expenses").select("category,amount,status").eq("event_id", id);
  const { data: rsvpRows } = await supabase.from("event_rsvps").select("status").eq("event_id", id);
  const { data: tickets } = await supabase.from("event_tickets").select("status,tier_id").eq("event_id", id);
  const { data: attendanceRows } = await supabase.from("event_attendance").select("id").eq("event_id", id);
  const { data: invites } = await supabase.from("event_invites").select("id").eq("event_id", id);
  const { data: inviteAttendance } = await supabase.from("event_invite_attendance").select("id").eq("event_id", id);
  const totalBudget = eventPlanTotalBudget(items);
  const totalFunding = eventFundingSum(sources);
  const approved = (expenses ?? []).filter((e) => e.status === "approved");
  const totalSpent = approved.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const going = (rsvpRows ?? []).filter((r) => r.status === "going").length;
  const payload =
    kind === "financial"
      ? {
          totalBudget,
          totalFunding,
          deficit: Math.max(0, totalBudget - totalFunding),
          totalSpent,
          remaining: totalBudget - totalSpent,
          byCategory: BUDGET_CATEGORIES.map((category) => ({
            category,
            planned: (items ?? []).filter((i) => i.category === category).reduce((s, i) => s + Math.round((Number(i.quantity) || 0) * (Number(i.estimated_cost) || 0)), 0),
            actual: approved.filter((e) => e.category === category).reduce((s, e) => s + (Number(e.amount) || 0), 0),
          })).filter((c) => c.planned > 0 || c.actual > 0),
          expenseCount: (expenses ?? []).length,
        }
      : {
          going,
          tickets: (tickets ?? []).length,
          validTickets: (tickets ?? []).filter((t) => ["valid", "used"].includes(t.status)).length,
          attendance: (attendanceRows ?? []).length,
          invites: (invites ?? []).length,
          attendedInvites: (inviteAttendance ?? []).length,
          attendanceRate: going > 0 ? Math.round(((attendanceRows ?? []).length / going) * 100) : 0,
        };
  const reportId = crypto.randomUUID();
  const { error } = await supabase.from("event_reports").insert({
    id: reportId,
    event_id: id,
    kind,
    generated_by: access.auth.account.id,
    payload: JSON.stringify(payload),
    created_at: now(),
  });
  if (error) return fail(500, "server_error");
  await logEventAudit(supabase, id, access.auth.account.id, `report.${kind}`, null);
  return ok({ report: { id: reportId, kind, createdAt: now(), payload } });
}

async function eventLifecycle(ctx) {
  const id = text(ctx.body.id, 60);
  // `action` juga dipakai router, jadi transisi dibaca dari `transition` lebih dulu.
  const action = [ctx.body.transition, ctx.body.action].find((v) =>
    ["start", "complete", "archive"].includes(v),
  ) ?? null;
  const access = await eventManageAccess(ctx, id, "manage");
  if (access.error) return access.error;
  const { event } = access;
  const transitions = {
    start: { from: ["published"], to: "ongoing" },
    complete: { from: ["ongoing"], to: "completed" },
    archive: { from: ["published", "ongoing", "completed"], to: "archived" },
  };
  const rule = transitions[action];
  if (!rule) return fail(400, "invalid_input");
  if (!rule.from.includes(event.status)) return fail(409, "invalid_status");
  await ctx.supabase.from("events").update({ status: rule.to }).eq("id", id);
  await logEventAudit(ctx.supabase, id, access.auth.account.id, `event.${action}`, `${event.status} -> ${rule.to}`);
  return ok({ status: rule.to });
}

async function eventLiveStart(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "manage");
  if (access.error) return access.error;
  const { event } = access;
  if (!["published", "ongoing"].includes(event.status)) return fail(409, "invalid_status");
  if (event.location_type !== "virtual" && event.location_type !== "hybrid") return fail(409, "not_virtual");
  const { data: room } = await ctx.supabase.from("event_live_streams").select("id").eq("event_id", id).maybeSingle();
  const startedAt = now();
  if (room) {
    await ctx.supabase.from("event_live_streams").update({ status: "live", started_at: startedAt, ended_at: null }).eq("id", room.id);
  } else {
    await ctx.supabase.from("event_live_streams").insert({
      id: crypto.randomUUID(),
      event_id: id,
      provider: event.virtual_platform === "zoom" || event.virtual_platform === "google_meet" ? event.virtual_platform : "internal",
      status: "live",
      started_at: startedAt,
      ended_at: null,
      created_at: now(),
    });
  }
  await ctx.supabase.from("events").update({ live_room_status: "live" }).eq("id", id);
  if (event.status === "published") {
    await ctx.supabase.from("events").update({ status: "ongoing" }).eq("id", id);
  }
  await logEventAudit(ctx.supabase, id, access.auth.account.id, "live.start", null);
  return ok({ status: "live", startedAt });
}

async function eventLiveEnd(ctx) {
  const id = text(ctx.body.id, 60);
  const access = await eventManageAccess(ctx, id, "manage");
  if (access.error) return access.error;
  const { data: room } = await ctx.supabase.from("event_live_streams").select("id").eq("event_id", id).maybeSingle();
  if (!room) return fail(404, "not_found");
  await ctx.supabase.from("event_live_streams").update({ status: "ended", ended_at: now() }).eq("id", room.id);
  await ctx.supabase.from("events").update({ live_room_status: "ended" }).eq("id", id);
  await logEventAudit(ctx.supabase, id, access.auth.account.id, "live.end", null);
  return ok({ status: "ended" });
}

async function adminEventApprovals(ctx) {
  const auth = await actor(ctx, 6);
  if (auth.error) return auth.error;
  const { data: approvals } = await ctx.supabase
    .from("event_approvals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = approvals ?? [];
  const eventIds = [...new Set(rows.map((r) => r.event_id))];
  const events = [];
  for (const eventId of eventIds) {
    const { data: row } = await ctx.supabase.from("events").select("*").eq("id", eventId).maybeSingle();
    if (row) events.push(row);
  }
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const names = await namesFor(ctx.supabase, rows.map((r) => r.requested_by));
  const budgetTotals = new Map();
  for (const eventId of eventIds) {
    const { data: items } = await ctx.supabase.from("event_budget_items").select("quantity,estimated_cost").eq("event_id", eventId);
    const { data: sources } = await ctx.supabase.from("event_funding_sources").select("amount").eq("event_id", eventId);
    budgetTotals.set(eventId, { totalBudget: eventPlanTotalBudget(items), totalFunding: eventFundingSum(sources) });
  }
  return ok({
    items: rows.map((row) => {
      const event = eventMap.get(row.event_id);
      const totals = budgetTotals.get(row.event_id) ?? { totalBudget: 0, totalFunding: 0 };
      const info = names.get(row.requested_by);
      return {
        id: row.id,
        eventId: row.event_id,
        eventTitle: event?.title ?? "Event",
        category: event?.category ?? "other",
        status: row.status,
        reason: parseJsonList(row.reason ?? "", 10),
        decisionNote: row.decision_note ?? null,
        requestedByName: info?.displayName ?? info?.nickname ?? "Anggota",
        capacity: event?.capacity ?? null,
        startsAt: event?.starts_at ?? null,
        totalBudget: totals.totalBudget,
        totalFunding: totals.totalFunding,
        createdAt: row.created_at,
        decidedAt: row.decided_at ?? null,
      };
    }),
    pendingCount: rows.filter((r) => r.status === "pending").length,
  });
}

async function adminEventDecide(ctx) {
  const auth = await actor(ctx, 6);
  if (auth.error) return auth.error;
  const approvalId = text(ctx.body.approvalId, 60);
  const decision = ["approve", "reject", "revision"].includes(ctx.body.decision) ? ctx.body.decision : null;
  if (!approvalId || !decision) return fail(400, "invalid_input");
  const note = textOrNull(ctx.body.note, 600);
  const { data: approval } = await ctx.supabase.from("event_approvals").select("*").eq("id", approvalId).maybeSingle();
  if (!approval) return fail(404, "not_found");
  if (approval.status !== "pending") return fail(409, "invalid_status");
  const { data: event } = await ctx.supabase.from("events").select("*").eq("id", approval.event_id).maybeSingle();
  if (!event) return fail(404, "not_found");
  const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "revision";
  await ctx.supabase
    .from("event_approvals")
    .update({ status, reviewed_by: auth.account.id, decision_note: note, decided_at: now() })
    .eq("id", approvalId);
  if (decision === "approve") {
    await publishEventNow(ctx.supabase, event, auth.account.id);
    await notify(
      ctx.supabase,
      event.created_by,
      "event_approval",
      auth.account.id,
      `Event "${event.title}" disetujui dan telah dipublikasikan.`,
      `/event/${event.id}`,
    );
  } else {
    await ctx.supabase.from("events").update({ status: "draft" }).eq("id", event.id);
    await notify(
      ctx.supabase,
      event.created_by,
      "event_approval",
      auth.account.id,
      decision === "reject"
        ? `Event "${event.title}" ditolak.${note ? ` Catatan: ${note}` : ""}`
        : `Event "${event.title}" perlu revisi.${note ? ` Catatan: ${note}` : ""}`,
      `/event/baru?id=${event.id}`,
    );
  }
  await logEventAudit(ctx.supabase, event.id, auth.account.id, `approval.${status}`, note);
  return ok({ status });
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

// ---------- bursa transfer e-sport ----------

const ESPORT_TRANSFER_TYPES = ["sale", "loan", "loan_to_buy", "free_agent"];
const ESPORT_PROFILE_STATUSES = ["free_agent", "contracted", "on_loan", "retired"];
const ESPORT_TRANSFER_FEE_MAX = 50_000_000;

const esportTodayKey = () => new Date(Date.now() + CALENDAR_TZ_OFFSET_MS).toISOString().slice(0, 10);

const esportTransferDateValue = (value) => {
  const v = text(value, 40);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    if (!strictDate(v)) return null;
    return new Date(Date.parse(`${v}T00:00:00+07:00`)).toISOString();
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

const esportStatsSanitize = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = {};
  for (const [k, v] of Object.entries(value).slice(0, 12)) {
    const key = text(k, 24);
    if (!key) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[key] = Math.max(0, Math.min(1_000_000, Math.round(v)));
    else if (typeof v === "string" && text(v, 40)) out[key] = text(v, 40);
  }
  return Object.keys(out).length ? out : null;
};

async function esportTransferWindowState(supabase, gameId) {
  const { data: windows } = await supabase.from("esport_transfer_windows").select("*").eq("game_id", gameId);
  const list = windows ?? [];
  if (!list.length) return { open: true, any: false, window: null };
  const nowMs = Date.now();
  const open = list.find((w) => Date.parse(w.opens_at) <= nowMs && nowMs <= Date.parse(w.closes_at));
  return { open: !!open, any: true, window: open ?? null };
}

async function esportTeamCaptainOk(supabase, teamId, accountId, rank) {
  const { data: team } = await supabase.from("esport_teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) return { error: fail(404, "not_found") };
  if (team.captain_id !== accountId && rank < 6) return { error: fail(403, "not_team_captain") };
  return { team };
}

async function esportPlayerProfileOwned(supabase, accountId, profileId) {
  const { data } = await supabase.from("esport_player_profiles").select("*").eq("id", profileId).maybeSingle();
  if (!data) return null;
  return data;
}

async function esportPlayerBaseStatus(supabase, profile) {
  const { data: contracts } = await supabase
    .from("esport_player_contracts")
    .select("*")
    .eq("player_profile_id", profile.id)
    .eq("status", "active");
  const active = contracts ?? [];
  if (active.some((c) => c.contract_type === "loan")) return "on_loan";
  if (active.length) return "contracted";
  const { data: member } = await supabase.from("esport_team_members").select("id").eq("account_id", profile.account_id).limit(1);
  return (member ?? []).length ? "contracted" : "free_agent";
}

async function esportPlayerCurrentTeam(supabase, profile) {
  const { data: contracts } = await supabase
    .from("esport_player_contracts")
    .select("*")
    .eq("player_profile_id", profile.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  const contract = (contracts ?? [])[0] ?? null;
  if (contract) {
    const { data: team } = await supabase.from("esport_teams").select("id,name,tag,logo_data").eq("id", contract.team_id).maybeSingle();
    return { team: team ?? null, contract };
  }
  const { data: rows } = await supabase.from("esport_team_members").select("*").eq("account_id", profile.account_id).limit(5);
  for (const row of rows ?? []) {
    const { data: team } = await supabase.from("esport_teams").select("id,name,tag,logo_data").eq("id", row.team_id).maybeSingle();
    if (team) return { team, contract: null };
  }
  return { team: null, contract: null };
}

async function esportPlayerCardOut(supabase, profile, viewerId) {
  const names = await namesFor(supabase, [profile.account_id]);
  const info = names.get(profile.account_id);
  const { data: game } = await supabase.from("esport_games").select("id,name,icon").eq("id", profile.game_id).maybeSingle();
  const { team, contract } = await esportPlayerCurrentTeam(supabase, profile);
  const { data: agent } = await supabase.from("esport_agents").select("*").eq("player_profile_id", profile.id).maybeSingle();
  return {
    id: profile.id,
    accountId: profile.account_id,
    ign: profile.ign,
    mainRole: profile.main_role ?? null,
    region: profile.region ?? null,
    rankTier: profile.rank_tier ?? null,
    rankPoints: profile.rank_points ?? null,
    bio: profile.bio ?? null,
    stats: profile.stats ?? null,
    status: profile.status,
    game: game ? { id: game.id, name: game.name, icon: game.icon } : null,
    team: team ? { id: team.id, name: team.name, tag: team.tag ?? null, logo: team.logo_data ?? null } : null,
    contract: contract
      ? { id: contract.id, type: contract.contract_type, endDate: contract.end_date ?? null, optionPrice: contract.option_price ?? null }
      : null,
    agent: agent ? { name: agent.name, contact: agent.contact ?? null, commissionPercent: agent.commission_percent ?? 10, active: !!agent.active } : null,
    owner: profile.account_id === viewerId,
    name: info?.displayName ?? info?.nickname ?? "Pemain",
    nickname: info?.nickname ?? null,
    photoData: info?.photoData ?? null,
    updatedAt: profile.updated_at,
  };
}

async function esportListingOut(supabase, listing, viewerId) {
  const { data: profile } = await supabase.from("esport_player_profiles").select("*").eq("id", listing.player_profile_id).maybeSingle();
  const player = profile ? await esportPlayerCardOut(supabase, profile, viewerId) : null;
  const { data: team } = listing.team_id
    ? await supabase.from("esport_teams").select("id,name,tag,logo_data").eq("id", listing.team_id).maybeSingle()
    : { data: null };
  const windowState = profile ? await esportTransferWindowState(supabase, profile.game_id) : { open: true, any: false };
  return {
    id: listing.id,
    player,
    team: team ? { id: team.id, name: team.name, tag: team.tag ?? null, logo: team.logo_data ?? null } : null,
    createdBy: listing.created_by,
    listingType: listing.listing_type,
    askingPrice: listing.asking_price ?? 0,
    loanDays: listing.loan_days ?? null,
    optionPrice: listing.option_price ?? null,
    description: listing.description ?? null,
    status: listing.status,
    windowOpen: windowState.open,
    windowName: windowState.window?.name ?? null,
    createdAt: listing.created_at,
    updatedAt: listing.updated_at,
  };
}

async function esportOfferOut(supabase, offer) {
  const { data: team } = await supabase.from("esport_teams").select("id,name,tag,logo_data").eq("id", offer.from_team_id).maybeSingle();
  return {
    id: offer.id,
    listingId: offer.listing_id,
    fromTeam: team ? { id: team.id, name: team.name, tag: team.tag ?? null, logo: team.logo_data ?? null } : null,
    createdBy: offer.created_by,
    offerType: offer.offer_type,
    fee: offer.fee ?? 0,
    loanDays: offer.loan_days ?? null,
    optionPrice: offer.option_price ?? null,
    message: offer.message ?? null,
    status: offer.status,
    counterOf: offer.counter_of ?? null,
    expiresAt: offer.expires_at ?? null,
    respondedAt: offer.responded_at ?? null,
    createdAt: offer.created_at,
  };
}

async function esportTransferOut(supabase, transfer, accountId, rank) {
  const { data: profile } = await supabase.from("esport_player_profiles").select("*").eq("id", transfer.player_profile_id).maybeSingle();
  const { data: toTeam } = await supabase.from("esport_teams").select("id,name,tag,logo_data").eq("id", transfer.to_team_id).maybeSingle();
  const { data: fromTeam } = transfer.from_team_id
    ? await supabase.from("esport_teams").select("id,name,tag,logo_data").eq("id", transfer.from_team_id).maybeSingle()
    : { data: null };
  const names = profile ? await namesFor(supabase, [profile.account_id]) : new Map();
  const info = profile ? names.get(profile.account_id) : null;
  const { data: contract } = await supabase.from("esport_player_contracts").select("id,status,end_date").eq("transfer_id", transfer.id).maybeSingle();
  const active = ["pending_payment", "escrow_held"].includes(transfer.status);
  return {
    id: transfer.id,
    player: profile
      ? {
          id: profile.id,
          accountId: profile.account_id,
          ign: profile.ign,
          mainRole: profile.main_role ?? null,
          rankTier: profile.rank_tier ?? null,
          name: info?.displayName ?? info?.nickname ?? "Pemain",
          photoData: info?.photoData ?? null,
        }
      : null,
    fromTeam: fromTeam ? { id: fromTeam.id, name: fromTeam.name, tag: fromTeam.tag ?? null, logo: fromTeam.logo_data ?? null } : null,
    toTeam: toTeam ? { id: toTeam.id, name: toTeam.name, tag: toTeam.tag ?? null, logo: toTeam.logo_data ?? null } : null,
    transferType: transfer.transfer_type,
    fee: transfer.fee ?? 0,
    loanDays: transfer.loan_days ?? null,
    optionPrice: transfer.option_price ?? null,
    status: transfer.status,
    escrowCoins: transfer.escrow_coins ?? 0,
    paidAt: transfer.paid_at ?? null,
    completedAt: transfer.completed_at ?? null,
    cancelledAt: transfer.cancelled_at ?? null,
    cancelReason: transfer.cancel_reason ?? null,
    contractId: contract?.id ?? null,
    contractEnd: contract?.end_date ?? null,
    active,
    isBuyer: toTeam?.captain_id === accountId,
    isSeller: fromTeam?.captain_id === accountId,
    canPay: transfer.status === "pending_payment" && (toTeam?.captain_id === accountId || rank >= 6),
    canConfirm: transfer.status === "escrow_held" && (fromTeam?.captain_id === accountId || rank >= 6),
    canCancel: active && (toTeam?.captain_id === accountId || fromTeam?.captain_id === accountId || rank >= 6),
    createdAt: transfer.created_at,
  };
}

async function esportCoinAdjust(supabase, accountId, delta, type, description, referenceId) {
  const { data: balance } = await supabase.from("coin_balances").select("*").eq("account_id", accountId).maybeSingle();
  const current = balance?.balance ?? 0;
  const newBalance = current + delta;
  await supabase.from("coin_transactions").insert({
    id: crypto.randomUUID(),
    account_id: accountId,
    type,
    amount: delta,
    balance_after: newBalance,
    description,
    reference_id: referenceId,
    created_at: now(),
  });
  if (!balance) {
    await supabase.from("coin_balances").insert({
      account_id: accountId,
      balance: newBalance,
      lifetime_purchased: 0,
      lifetime_spent: delta < 0 ? -delta : 0,
      updated_at: now(),
    });
  } else {
    await supabase
      .from("coin_balances")
      .update({ balance: newBalance, lifetime_spent: (balance.lifetime_spent ?? 0) + (delta < 0 ? -delta : 0), updated_at: now() })
      .eq("account_id", accountId);
  }
  return newBalance;
}

async function esportTransferExecuteMove(supabase, transfer, profile) {
  if (transfer.from_team_id && transfer.transfer_type !== "loan" && transfer.transfer_type !== "loan_to_buy") {
    const { data: memberRow } = await supabase
      .from("esport_team_members")
      .select("*")
      .eq("team_id", transfer.from_team_id)
      .eq("account_id", profile.account_id)
      .maybeSingle();
    if (memberRow && memberRow.member_role !== "captain") {
      await supabase.from("esport_team_members").delete().eq("id", memberRow.id);
    }
  }
  const { data: existing } = await supabase
    .from("esport_team_members")
    .select("id")
    .eq("team_id", transfer.to_team_id)
    .eq("account_id", profile.account_id)
    .maybeSingle();
  if (!existing) {
    await supabase.from("esport_team_members").insert({
      id: crypto.randomUUID(),
      team_id: transfer.to_team_id,
      account_id: profile.account_id,
      member_role: "member",
      game_role: profile.main_role ?? null,
      in_game_name: profile.ign ?? null,
      in_game_id: null,
      game_rank: profile.rank_tier ?? null,
      joined_at: now(),
    });
  }
  const todayKey = esportTodayKey();
  const contractType = transfer.transfer_type === "sale" ? "permanent" : transfer.transfer_type === "free_agent" ? "free_agent" : "loan";
  let endDate = null;
  if (contractType === "loan" && transfer.loan_days) {
    endDate = new Date(Date.parse(`${todayKey}T00:00:00Z`) + transfer.loan_days * 86400000).toISOString().slice(0, 10);
  }
  const contractId = crypto.randomUUID();
  await supabase.from("esport_player_contracts").insert({
    id: contractId,
    player_profile_id: profile.id,
    team_id: transfer.to_team_id,
    transfer_id: transfer.id,
    contract_type: contractType,
    start_date: todayKey,
    end_date: endDate,
    salary: 0,
    option_price: transfer.transfer_type === "loan_to_buy" ? transfer.option_price ?? null : null,
    option_team_id: transfer.transfer_type === "loan_to_buy" ? transfer.to_team_id : null,
    status: "active",
    created_at: now(),
    updated_at: now(),
  });
  await supabase.from("esport_player_profiles").update({ status: contractType === "loan" ? "on_loan" : "contracted", updated_at: now() }).eq("id", profile.id);
  return { contractId, endDate };
}

async function esportTransferFinalize(supabase, transfer, profile, listing) {
  const { data: fromTeam } = transfer.from_team_id
    ? await supabase.from("esport_teams").select("*").eq("id", transfer.from_team_id).maybeSingle()
    : { data: null };
  const { data: toTeam } = await supabase.from("esport_teams").select("*").eq("id", transfer.to_team_id).maybeSingle();
  const sellerAccountId = fromTeam?.captain_id ?? listing?.created_by ?? null;
  if ((transfer.escrow_coins ?? 0) > 0 && sellerAccountId) {
    await esportCoinAdjust(
      supabase,
      sellerAccountId,
      transfer.escrow_coins,
      "transfer_in",
      `Dana escrow transfer ${profile.ign} dilepas ke ${sellerAccountId === toTeam?.captain_id ? "klub" : "penjual"}`,
      transfer.id,
    );
  }
  const { contractId, endDate } = await esportTransferExecuteMove(supabase, transfer, profile);
  await supabase
    .from("esport_transfers")
    .update({ status: "completed", escrow_coins: 0, completed_at: now() })
    .eq("id", transfer.id);
  if (listing) await supabase.from("esport_transfer_listings").update({ status: "completed", updated_at: now() }).eq("id", listing.id);
  const toName = toTeam?.name ?? "tim baru";
  if (toTeam?.captain_id) {
    const verb = transfer.transfer_type === "free_agent" ? "bergabung dengan" : transfer.transfer_type === "sale" ? "pindah ke" : "dipinjam";
    const extra = endDate ? ` Pinjaman berlaku hingga ${endDate}.` : "";
    await notify(supabase, toTeam.captain_id, "esport_transfer", null, `Transfer selesai — ${profile.ign} resmi ${verb} ${toName}.${extra}`, "#/bursa-transfer");
  }
  if (sellerAccountId && sellerAccountId !== toTeam?.captain_id) {
    await notify(supabase, sellerAccountId, "esport_transfer", null, `Transfer selesai — ${profile.ign} kini di ${toName}.`, "#/bursa-transfer");
  }
  return { contractId, endDate };
}

async function esportTransferSweep(supabase) {
  const { data: offers } = await supabase.from("esport_transfer_offers").select("*").eq("status", "pending").limit(500);
  for (const offer of offers ?? []) {
    if (offer.expires_at && Date.parse(offer.expires_at) < Date.now()) {
      await supabase.from("esport_transfer_offers").update({ status: "expired", responded_at: now() }).eq("id", offer.id);
    }
  }
  const todayKey = esportTodayKey();
  const { data: contracts } = await supabase
    .from("esport_player_contracts")
    .select("*")
    .eq("status", "active")
    .eq("contract_type", "loan")
    .limit(300);
  for (const contract of contracts ?? []) {
    if (!contract.end_date || contract.end_date >= todayKey) continue;
    await supabase.from("esport_player_contracts").update({ status: "expired", updated_at: now() }).eq("id", contract.id);
    const { data: profile } = await supabase.from("esport_player_profiles").select("*").eq("id", contract.player_profile_id).maybeSingle();
    if (!profile) continue;
    const { data: memberRow } = await supabase
      .from("esport_team_members")
      .select("*")
      .eq("team_id", contract.team_id)
      .eq("account_id", profile.account_id)
      .maybeSingle();
    if (memberRow && memberRow.member_role !== "captain") {
      await supabase.from("esport_team_members").delete().eq("id", memberRow.id);
    }
    if (profile.status !== "retired") {
      const base = await esportPlayerBaseStatus(supabase, profile);
      await supabase.from("esport_player_profiles").update({ status: base, updated_at: now() }).eq("id", profile.id);
    }
    const { data: team } = await supabase.from("esport_teams").select("*").eq("id", contract.team_id).maybeSingle();
    if (team?.captain_id) {
      await notify(supabase, team.captain_id, "esport_transfer", null, `Masa pinjaman ${profile.ign} berakhir — pemain kembali ke tim asal.`, "#/bursa-transfer");
    }
  }
}

async function esportTransferWindowsList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: windows } = await ctx.supabase.from("esport_transfer_windows").select("*").order("closes_at", { ascending: false }).limit(100);
  const { data: games } = await ctx.supabase.from("esport_games").select("id,name,icon");
  const gameMap = new Map((games ?? []).map((g) => [g.id, g]));
  const nowMs = Date.now();
  return ok({
    items: (windows ?? []).map((w) => ({
      id: w.id,
      gameId: w.game_id,
      gameName: gameMap.get(w.game_id)?.name ?? "Game",
      gameIcon: gameMap.get(w.game_id)?.icon ?? null,
      name: w.name,
      opensAt: w.opens_at,
      closesAt: w.closes_at,
      status: nowMs < Date.parse(w.opens_at) ? "upcoming" : nowMs <= Date.parse(w.closes_at) ? "open" : "closed",
    })),
    canManage: auth.rank >= 6,
  });
}

async function esportTransferWindowSave(ctx) {
  const auth = await actor(ctx, 6);
  if (auth.error) return auth.error;
  const windowId = text(ctx.body.id, 60);
  const gameId = text(ctx.body.gameId, 60);
  const name = text(ctx.body.name, 60);
  const opensAt = esportTransferDateValue(ctx.body.opensAt);
  const closesAt = esportTransferDateValue(ctx.body.closesAt);
  if (name.length < 2 || !opensAt || !closesAt || Date.parse(opensAt) >= Date.parse(closesAt)) return fail(400, "invalid_input");
  const { data: game } = await ctx.supabase.from("esport_games").select("id").eq("id", gameId).maybeSingle();
  if (!game) return fail(404, "not_found");
  if (windowId) {
    const { data: existing } = await ctx.supabase.from("esport_transfer_windows").select("id").eq("id", windowId).maybeSingle();
    if (!existing) return fail(404, "not_found");
    await ctx.supabase.from("esport_transfer_windows").update({ game_id: gameId, name, opens_at: opensAt, closes_at: closesAt }).eq("id", windowId);
    return ok({ id: windowId });
  }
  const newId = crypto.randomUUID();
  await ctx.supabase.from("esport_transfer_windows").insert({
    id: newId,
    game_id: gameId,
    name,
    opens_at: opensAt,
    closes_at: closesAt,
    created_by: auth.account.id,
    created_at: now(),
  });
  return ok({ id: newId });
}

async function esportTransferWindowDelete(ctx) {
  const auth = await actor(ctx, 6);
  if (auth.error) return auth.error;
  const windowId = text(ctx.body.id, 60);
  const { data: existing } = await ctx.supabase.from("esport_transfer_windows").select("id").eq("id", windowId).maybeSingle();
  if (!existing) return fail(404, "not_found");
  await ctx.supabase.from("esport_transfer_windows").delete().eq("id", windowId);
  return ok({ deleted: true });
}

async function esportTransferProfilesMine(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const { data: profiles } = await ctx.supabase.from("esport_player_profiles").select("*").eq("account_id", auth.account.id);
  const items = [];
  for (const profile of profiles ?? []) {
    const card = await esportPlayerCardOut(ctx.supabase, profile, auth.account.id);
    const { data: listingRows } = await ctx.supabase
      .from("esport_transfer_listings")
      .select("*")
      .eq("player_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(3);
    const openListing = (listingRows ?? []).find((l) => ["open", "paused"].includes(l.status)) ?? null;
    card.listing = openListing
      ? { id: openListing.id, listingType: openListing.listing_type, status: openListing.status, askingPrice: openListing.asking_price ?? 0 }
      : null;
    items.push(card);
  }
  const { data: balance } = await ctx.supabase.from("coin_balances").select("balance").eq("account_id", auth.account.id).maybeSingle();
  return ok({ items, koinBalance: balance?.balance ?? 0 });
}

async function esportTransferProfileSave(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profileId = text(ctx.body.id, 60);
  const gameId = text(ctx.body.gameId, 60);
  const ign = text(ctx.body.ign, 30);
  const mainRole = textOrNull(ctx.body.mainRole, 30);
  const region = textOrNull(ctx.body.region, 40);
  const rankTier = textOrNull(ctx.body.rankTier, 30);
  const rankPoints = intOrNull(ctx.body.rankPoints, 0, 100_000);
  const bio = textOrNull(ctx.body.bio, 300);
  const stats = esportStatsSanitize(ctx.body.stats);
  const retired = ctx.body.retired === true;
  if (ign.length < 2) return fail(400, "invalid_input");
  if (profileId) {
    const existing = await esportPlayerProfileOwned(ctx.supabase, auth.account.id, profileId);
    if (!existing || existing.account_id !== auth.account.id) return fail(404, "not_found");
    const status = retired ? "retired" : await esportPlayerBaseStatus(ctx.supabase, existing);
    await ctx.supabase
      .from("esport_player_profiles")
      .update({
        ign,
        main_role: mainRole,
        region,
        rank_tier: rankTier,
        rank_points: rankPoints,
        bio,
        stats,
        status,
        updated_at: now(),
      })
      .eq("id", profileId);
    return ok({ id: profileId, status });
  }
  const { data: game } = await ctx.supabase.from("esport_games").select("id").eq("id", gameId).maybeSingle();
  if (!game) return fail(404, "not_found");
  const { data: dupe } = await ctx.supabase
    .from("esport_player_profiles")
    .select("id")
    .eq("account_id", auth.account.id)
    .eq("game_id", gameId)
    .maybeSingle();
  if (dupe) return fail(409, "already_exists");
  const { data: member } = await ctx.supabase.from("esport_team_members").select("id").eq("account_id", auth.account.id).limit(1);
  const baseStatus = (member ?? []).length ? "contracted" : "free_agent";
  const newId = crypto.randomUUID();
  await ctx.supabase.from("esport_player_profiles").insert({
    id: newId,
    account_id: auth.account.id,
    game_id: gameId,
    ign,
    main_role: mainRole,
    region,
    rank_tier: rankTier,
    rank_points: rankPoints,
    bio,
    stats,
    status: retired ? "retired" : baseStatus,
    created_at: now(),
    updated_at: now(),
  });
  return ok({ id: newId, status: retired ? "retired" : baseStatus });
}

async function esportTransferProfilesList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const gameId = text(ctx.body.gameId, 60);
  const status = text(ctx.body.status, 20);
  const q = text(ctx.body.q, 40).toLowerCase();
  let query = ctx.supabase.from("esport_player_profiles").select("*").limit(200);
  if (gameId) query = query.eq("game_id", gameId);
  if (status && ESPORT_PROFILE_STATUSES.includes(status)) query = query.eq("status", status);
  const { data: rows } = await query;
  const items = [];
  for (const profile of rows ?? []) {
    const card = await esportPlayerCardOut(ctx.supabase, profile, auth.account.id);
    if (q && !card.ign.toLowerCase().includes(q) && !(card.name ?? "").toLowerCase().includes(q)) continue;
    items.push(card);
    if (items.length >= 100) break;
  }
  items.sort((a, b) => Date.parse(b.updatedAt ?? 0) - Date.parse(a.updatedAt ?? 0));
  return ok({ items });
}

async function esportTransferProfileGet(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profileId = text(ctx.body.profileId ?? ctx.body.id, 60);
  const accountId = text(ctx.body.accountId, 60);
  let profile = null;
  if (profileId) {
    const { data } = await ctx.supabase.from("esport_player_profiles").select("*").eq("id", profileId).maybeSingle();
    profile = data;
  } else if (accountId) {
    const { data } = await ctx.supabase.from("esport_player_profiles").select("*").eq("account_id", accountId).limit(1);
    profile = (data ?? [])[0] ?? null;
  }
  if (!profile) return fail(404, "not_found");
  const card = await esportPlayerCardOut(ctx.supabase, profile, auth.account.id);
  const { data: listings } = await ctx.supabase
    .from("esport_transfer_listings")
    .select("*")
    .eq("player_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const listingItems = [];
  for (const listing of listings ?? []) listingItems.push(await esportListingOut(ctx.supabase, listing, auth.account.id));
  const { data: contracts } = await ctx.supabase
    .from("esport_player_contracts")
    .select("*")
    .eq("player_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const { data: teams } = await ctx.supabase.from("esport_teams").select("id,name,tag,logo_data");
  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
  const contractItems = (contracts ?? []).map((c) => ({
    id: c.id,
    team: teamMap.get(c.team_id) ? { id: c.team_id, name: teamMap.get(c.team_id).name, tag: teamMap.get(c.team_id).tag ?? null, logo: teamMap.get(c.team_id).logo_data ?? null } : null,
    contractType: c.contract_type,
    startDate: c.start_date,
    endDate: c.end_date ?? null,
    status: c.status,
    optionPrice: c.option_price ?? null,
  }));
  const history = [];
  const { data: transfers } = await ctx.supabase
    .from("esport_transfers")
    .select("*")
    .eq("player_profile_id", profile.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(10);
  for (const t of transfers ?? []) {
    const out = await esportTransferOut(ctx.supabase, t, auth.account.id, auth.rank);
    history.push({ id: out.id, fromTeam: out.fromTeam, toTeam: out.toTeam, transferType: out.transferType, fee: out.fee, completedAt: out.completedAt });
  }
  return ok({ player: card, listings: listingItems, contracts: contractItems, history });
}

async function esportTransferAgentSave(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profileId = text(ctx.body.profileId, 60);
  const profile = await esportPlayerProfileOwned(ctx.supabase, auth.account.id, profileId);
  if (!profile || profile.account_id !== auth.account.id) return fail(404, "not_found");
  const name = text(ctx.body.name, 60);
  if (name.length < 2) return fail(400, "invalid_input");
  const contact = textOrNull(ctx.body.contact, 80);
  const commissionPercent = intOrNull(ctx.body.commissionPercent, 0, 50) ?? 10;
  const active = ctx.body.active !== false;
  const { data: existing } = await ctx.supabase.from("esport_agents").select("id").eq("player_profile_id", profileId).maybeSingle();
  if (existing) {
    await ctx.supabase
      .from("esport_agents")
      .update({ name, contact, commission_percent: commissionPercent, active, updated_at: now() })
      .eq("id", existing.id);
    return ok({ id: existing.id });
  }
  const newId = crypto.randomUUID();
  await ctx.supabase.from("esport_agents").insert({
    id: newId,
    player_profile_id: profileId,
    name,
    contact,
    commission_percent: commissionPercent,
    active,
    created_at: now(),
    updated_at: now(),
  });
  return ok({ id: newId });
}

async function esportTransferListingsList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  await esportTransferSweep(ctx.supabase);
  const gameId = text(ctx.body.gameId, 60);
  const listingType = text(ctx.body.listingType, 20);
  const status = text(ctx.body.status, 20) || "open";
  const q = text(ctx.body.q, 40).toLowerCase();
  const { data: rows } = await ctx.supabase.from("esport_transfer_listings").select("*").order("created_at", { ascending: false }).limit(300);
  const items = [];
  for (const listing of rows ?? []) {
    if (!["open", "paused", "closed", "completed"].includes(status) || listing.status !== status) continue;
    if (listingType && ESPORT_TRANSFER_TYPES.includes(listingType) && listing.listing_type !== listingType) continue;
    const out = await esportListingOut(ctx.supabase, listing, auth.account.id);
    if (gameId && out.player?.game?.id !== gameId) continue;
    if (q && !(out.player?.ign ?? "").toLowerCase().includes(q) && !(out.player?.name ?? "").toLowerCase().includes(q)) continue;
    items.push(out);
    if (items.length >= 100) break;
  }
  return ok({ items });
}

async function esportTransferListingCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profileId = text(ctx.body.profileId, 60);
  const teamId = text(ctx.body.teamId, 60);
  const listingType = text(ctx.body.listingType, 20);
  const askingPrice = intOrNull(ctx.body.askingPrice, 0, ESPORT_TRANSFER_FEE_MAX) ?? 0;
  const loanDaysRaw = intOrNull(ctx.body.loanDays, 1, 365);
  const optionPriceRaw = intOrNull(ctx.body.optionPrice, 0, ESPORT_TRANSFER_FEE_MAX);
  const description = textOrNull(ctx.body.description, 400);
  if (!ESPORT_TRANSFER_TYPES.includes(listingType)) return fail(400, "invalid_input");
  const { data: profile } = await ctx.supabase.from("esport_player_profiles").select("*").eq("id", profileId).maybeSingle();
  if (!profile) return fail(404, "not_found");
  if (profile.status === "retired") return fail(409, "invalid_status");
  if (teamId) {
    const captain = await esportTeamCaptainOk(ctx.supabase, teamId, auth.account.id, auth.rank);
    if (captain.error) return captain.error;
    if (listingType === "free_agent") return fail(400, "invalid_input");
    if (profile.account_id === captain.team.captain_id) return fail(409, "captain_cannot_be_listed");
    const { data: memberRow } = await ctx.supabase
      .from("esport_team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("account_id", profile.account_id)
      .maybeSingle();
    if (!memberRow) return fail(409, "not_team_member");
  } else {
    if (listingType !== "free_agent" || profile.account_id !== auth.account.id) return fail(400, "invalid_input");
  }
  if (listingType === "sale" && askingPrice < 1) return fail(400, "invalid_input");
  if (listingType === "loan" && !loanDaysRaw) return fail(400, "invalid_input");
  if (listingType === "loan_to_buy" && (!loanDaysRaw || !optionPriceRaw)) return fail(400, "invalid_input");
  const windowState = await esportTransferWindowState(ctx.supabase, profile.game_id);
  if (!windowState.open) return fail(409, "transfer_window_closed");
  const { data: activeListings } = await ctx.supabase.from("esport_transfer_listings").select("id,status").eq("player_profile_id", profileId).limit(10);
  if ((activeListings ?? []).some((l) => ["open", "paused"].includes(l.status))) return fail(409, "already_listed");
  const newId = crypto.randomUUID();
  await ctx.supabase.from("esport_transfer_listings").insert({
    id: newId,
    player_profile_id: profileId,
    team_id: teamId || null,
    created_by: auth.account.id,
    listing_type: listingType,
    asking_price: listingType === "free_agent" ? 0 : askingPrice,
    loan_days: ["loan", "loan_to_buy"].includes(listingType) ? loanDaysRaw : null,
    option_price: listingType === "loan_to_buy" ? optionPriceRaw : null,
    description,
    status: "open",
    created_at: now(),
    updated_at: now(),
  });
  return ok({ id: newId });
}

async function esportTransferListingUpdate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const listingId = text(ctx.body.id, 60);
  const { data: listing } = await ctx.supabase.from("esport_transfer_listings").select("*").eq("id", listingId).maybeSingle();
  if (!listing) return fail(404, "not_found");
  if (listing.created_by !== auth.account.id && auth.rank < 6) return fail(403, "forbidden");
  const status = text(ctx.body.status, 20) || listing.status;
  if (!["open", "paused", "closed"].includes(status)) return fail(400, "invalid_input");
  const patch = { updated_at: now(), status };
  if (ctx.body.askingPrice !== undefined) patch.asking_price = intOrNull(ctx.body.askingPrice, 0, ESPORT_TRANSFER_FEE_MAX) ?? listing.asking_price;
  if (ctx.body.loanDays !== undefined) patch.loan_days = intOrNull(ctx.body.loanDays, 1, 365) ?? listing.loan_days;
  if (ctx.body.optionPrice !== undefined) patch.option_price = intOrNull(ctx.body.optionPrice, 0, ESPORT_TRANSFER_FEE_MAX) ?? listing.option_price;
  if (ctx.body.description !== undefined) patch.description = textOrNull(ctx.body.description, 400);
  await ctx.supabase.from("esport_transfer_listings").update(patch).eq("id", listingId);
  if (status === "closed") {
    await ctx.supabase
      .from("esport_transfer_offers")
      .update({ status: "rejected", responded_at: now() })
      .eq("listing_id", listingId)
      .eq("status", "pending");
  }
  return ok({ id: listingId, status });
}

async function esportTransferOfferCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const listingId = text(ctx.body.listingId, 60);
  const teamId = text(ctx.body.teamId, 60);
  const { data: listing } = await ctx.supabase.from("esport_transfer_listings").select("*").eq("id", listingId).maybeSingle();
  if (!listing) return fail(404, "not_found");
  if (listing.status !== "open") return fail(409, "invalid_status");
  const { data: profile } = await ctx.supabase.from("esport_player_profiles").select("*").eq("id", listing.player_profile_id).maybeSingle();
  if (!profile) return fail(404, "not_found");
  const captain = await esportTeamCaptainOk(ctx.supabase, teamId, auth.account.id, auth.rank);
  if (captain.error) return captain.error;
  if (listing.team_id === teamId) return fail(409, "own_team_offer");
  if (profile.account_id === auth.account.id) return fail(409, "own_listing_offer");
  const { data: memberRow } = await ctx.supabase
    .from("esport_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("account_id", profile.account_id)
    .maybeSingle();
  if (memberRow) return fail(409, "already_team_member");
  const windowState = await esportTransferWindowState(ctx.supabase, profile.game_id);
  if (!windowState.open) return fail(409, "transfer_window_closed");
  const { data: pendingExisting } = await ctx.supabase
    .from("esport_transfer_offers")
    .select("id")
    .eq("listing_id", listingId)
    .eq("from_team_id", teamId)
    .eq("status", "pending")
    .limit(1);
  if ((pendingExisting ?? []).length) return fail(409, "offer_pending");
  const fee = intOrNull(ctx.body.fee, 0, ESPORT_TRANSFER_FEE_MAX) ?? (listing.listing_type === "free_agent" ? 0 : listing.asking_price ?? 0);
  const loanDays = ["loan", "loan_to_buy"].includes(listing.listing_type) ? intOrNull(ctx.body.loanDays, 1, 365) ?? listing.loan_days : null;
  const optionPrice = listing.listing_type === "loan_to_buy" ? intOrNull(ctx.body.optionPrice, 0, ESPORT_TRANSFER_FEE_MAX) ?? listing.option_price : null;
  const message = textOrNull(ctx.body.message, 300);
  if (listing.listing_type === "sale" && fee < 1) return fail(400, "invalid_input");
  const hours = intOrNull(ctx.body.expiresInHours, 1, 168) ?? 72;
  const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
  const offerId = crypto.randomUUID();
  await ctx.supabase.from("esport_transfer_offers").insert({
    id: offerId,
    listing_id: listingId,
    from_team_id: teamId,
    created_by: auth.account.id,
    offer_type: listing.listing_type,
    fee,
    loan_days: loanDays,
    option_price: optionPrice,
    message,
    status: "pending",
    counter_of: null,
    expires_at: expiresAt,
    responded_at: null,
    created_at: now(),
  });
  const detail =
    listing.listing_type === "free_agent"
      ? `Tim "${captain.team.name}" ingin merekrut ${profile.ign} sebagai free agent.`
      : `Tawaran ${fee.toLocaleString("id-ID")} koin untuk ${profile.ign} dari tim "${captain.team.name}".`;
  await notify(ctx.supabase, listing.created_by, "esport_transfer", auth.account.id, detail, "#/bursa-transfer");
  return ok({ id: offerId, expiresAt });
}

async function esportTransferOfferRespond(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const offerId = text(ctx.body.id, 60);
  const action = text(ctx.body.transition, 20);
  const { data: offer } = await ctx.supabase.from("esport_transfer_offers").select("*").eq("id", offerId).maybeSingle();
  if (!offer) return fail(404, "not_found");
  if (offer.status !== "pending") return fail(409, "invalid_status");
  const { data: listing } = await ctx.supabase.from("esport_transfer_listings").select("*").eq("id", offer.listing_id).maybeSingle();
  if (!listing) return fail(404, "not_found");
  const { data: profile } = await ctx.supabase.from("esport_player_profiles").select("*").eq("id", listing.player_profile_id).maybeSingle();
  if (!profile) return fail(404, "not_found");
  const isSeller = listing.created_by === auth.account.id;
  const isBuyer = offer.created_by === auth.account.id;
  if (!isSeller && !isBuyer && auth.rank < 6) return fail(403, "forbidden");

  if (action === "withdraw") {
    if (!isBuyer && auth.rank < 6) return fail(403, "forbidden");
    await ctx.supabase.from("esport_transfer_offers").update({ status: "withdrawn", responded_at: now() }).eq("id", offerId);
    return ok({ withdrawn: true });
  }
  if (action === "reject") {
    if (!isSeller && auth.rank < 6) return fail(403, "forbidden");
    await ctx.supabase.from("esport_transfer_offers").update({ status: "rejected", responded_at: now() }).eq("id", offerId);
    await notify(ctx.supabase, offer.created_by, "esport_transfer", auth.account.id, `Tawaran untuk ${profile.ign} ditolak.`, "#/bursa-transfer");
    return ok({ rejected: true });
  }
  if (action === "counter") {
    const counter = ctx.body.counter && typeof ctx.body.counter === "object" ? ctx.body.counter : {};
    const fee = intOrNull(counter.fee, 0, ESPORT_TRANSFER_FEE_MAX);
    if (fee === null) return fail(400, "invalid_input");
    const loanDays = ["loan", "loan_to_buy"].includes(offer.offer_type) ? intOrNull(counter.loanDays, 1, 365) ?? offer.loan_days : null;
    const optionPrice = offer.offer_type === "loan_to_buy" ? intOrNull(counter.optionPrice, 0, ESPORT_TRANSFER_FEE_MAX) ?? offer.option_price : null;
    const message = textOrNull(counter.message, 300);
    const newId = crypto.randomUUID();
    await ctx.supabase.from("esport_transfer_offers").insert({
      id: newId,
      listing_id: offer.listing_id,
      from_team_id: offer.from_team_id,
      created_by: auth.account.id,
      offer_type: offer.offer_type,
      fee,
      loan_days: loanDays,
      option_price: optionPrice,
      message,
      status: "pending",
      counter_of: offer.id,
      expires_at: offer.expires_at,
      responded_at: null,
      created_at: now(),
    });
    await ctx.supabase.from("esport_transfer_offers").update({ status: "countered", responded_at: now() }).eq("id", offerId);
    const target = isSeller ? offer.created_by : listing.created_by;
    await notify(ctx.supabase, target, "esport_transfer", auth.account.id, `Negosiasi berlanjut untuk ${profile.ign} — tawaran baru ${fee.toLocaleString("id-ID")} koin.`, "#/bursa-transfer");
    return ok({ counterId: newId });
  }
  if (action !== "accept") return fail(400, "invalid_input");
  if (!isSeller && auth.rank < 6) return fail(403, "forbidden");
  const windowState = await esportTransferWindowState(ctx.supabase, profile.game_id);
  if (!windowState.open) return fail(409, "transfer_window_closed");

  const transferId = crypto.randomUUID();
  const freeSigning = listing.listing_type === "free_agent";
  const fee = freeSigning ? 0 : offer.fee ?? 0;
  await ctx.supabase.from("esport_transfer_offers").update({ status: "accepted", responded_at: now() }).eq("id", offerId);
  await ctx.supabase
    .from("esport_transfer_offers")
    .update({ status: "rejected", responded_at: now() })
    .eq("listing_id", offer.listing_id)
    .eq("status", "pending");
  await ctx.supabase.from("esport_transfer_listings").update({ status: "paused", updated_at: now() }).eq("id", listing.id);
  await ctx.supabase.from("esport_transfers").insert({
    id: transferId,
    offer_id: offer.id,
    listing_id: listing.id,
    player_profile_id: profile.id,
    from_team_id: listing.team_id || null,
    to_team_id: offer.from_team_id,
    transfer_type: offer.offer_type,
    fee,
    loan_days: offer.loan_days ?? null,
    option_price: offer.option_price ?? null,
    status: fee > 0 ? "pending_payment" : "escrow_held",
    escrow_coins: 0,
    paid_by: null,
    paid_at: null,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    created_at: now(),
  });
  if (freeSigning) {
    const { contractId } = await esportTransferFinalize(
      ctx.supabase,
      {
        id: transferId,
        transfer_type: offer.offer_type,
        fee,
        escrow_coins: 0,
        from_team_id: listing.team_id || null,
        to_team_id: offer.from_team_id,
        loan_days: offer.loan_days ?? null,
        option_price: offer.option_price ?? null,
      },
      profile,
      listing,
    );
    return ok({ transferId, completed: true, contractId });
  }
  await notify(
    ctx.supabase,
    offer.created_by,
    "esport_transfer",
    auth.account.id,
    fee > 0
      ? `Tawaran untuk ${profile.ign} diterima — lanjutkan pembayaran escrow ${fee.toLocaleString("id-ID")} koin.`
      : `Tawaran untuk ${profile.ign} diterima — lanjutkan konfirmasi serah terima.`,
    "#/bursa-transfer",
  );
  return ok({ transferId, completed: false });
}

async function esportTransferPay(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const transferId = text(ctx.body.id, 60);
  const { data: transfer } = await ctx.supabase.from("esport_transfers").select("*").eq("id", transferId).maybeSingle();
  if (!transfer) return fail(404, "not_found");
  if (transfer.status !== "pending_payment") return fail(409, "invalid_status");
  const { data: toTeam } = await ctx.supabase.from("esport_teams").select("*").eq("id", transfer.to_team_id).maybeSingle();
  if (toTeam?.captain_id !== auth.account.id && auth.rank < 6) return fail(403, "not_team_captain");
  const { data: profile } = await ctx.supabase.from("esport_player_profiles").select("*").eq("id", transfer.player_profile_id).maybeSingle();
  const fee = transfer.fee ?? 0;
  if (fee <= 0) return fail(400, "invalid_input");
  const { data: balance } = await ctx.supabase.from("coin_balances").select("balance").eq("account_id", auth.account.id).maybeSingle();
  if ((balance?.balance ?? 0) < fee) return fail(400, "insufficient_balance");
  await esportCoinAdjust(ctx.supabase, auth.account.id, -fee, "transfer_escrow", `Escrow transfer ${profile?.ign ?? "pemain"} → ${toTeam?.name ?? "tim"}`, transfer.id);
  await ctx.supabase
    .from("esport_transfers")
    .update({ status: "escrow_held", escrow_coins: fee, paid_by: auth.account.id, paid_at: now() })
    .eq("id", transferId);
  const { data: fromTeam } = transfer.from_team_id
    ? await ctx.supabase.from("esport_teams").select("*").eq("id", transfer.from_team_id).maybeSingle()
    : { data: null };
  const { data: listing } = transfer.listing_id
    ? await ctx.supabase.from("esport_transfer_listings").select("*").eq("id", transfer.listing_id).maybeSingle()
    : { data: null };
  const seller = fromTeam?.captain_id ?? listing?.created_by;
  if (seller) {
    await notify(
      ctx.supabase,
      seller,
      "esport_transfer",
      auth.account.id,
      `Pembayaran escrow ${fee.toLocaleString("id-ID")} koin untuk ${profile?.ign ?? "pemain"} diterima — konfirmasi serah terima.`,
      "#/bursa-transfer",
    );
  }
  return ok({ escrowHeld: true, fee });
}

async function esportTransferConfirm(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const transferId = text(ctx.body.id, 60);
  const { data: transfer } = await ctx.supabase.from("esport_transfers").select("*").eq("id", transferId).maybeSingle();
  if (!transfer) return fail(404, "not_found");
  if (transfer.status !== "escrow_held") return fail(409, "invalid_status");
  const { data: fromTeam } = transfer.from_team_id
    ? await ctx.supabase.from("esport_teams").select("*").eq("id", transfer.from_team_id).maybeSingle()
    : { data: null };
  const { data: listing } = transfer.listing_id
    ? await ctx.supabase.from("esport_transfer_listings").select("*").eq("id", transfer.listing_id).maybeSingle()
    : { data: null };
  const seller = fromTeam?.captain_id ?? listing?.created_by;
  if (seller !== auth.account.id && auth.rank < 6) return fail(403, "forbidden");
  const { data: profile } = await ctx.supabase.from("esport_player_profiles").select("*").eq("id", transfer.player_profile_id).maybeSingle();
  if (!profile) return fail(404, "not_found");
  const { contractId } = await esportTransferFinalize(ctx.supabase, transfer, profile, listing);
  return ok({ completed: true, contractId });
}

async function esportTransferCancel(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const transferId = text(ctx.body.id, 60);
  const reason = textOrNull(ctx.body.reason, 200);
  const { data: transfer } = await ctx.supabase.from("esport_transfers").select("*").eq("id", transferId).maybeSingle();
  if (!transfer) return fail(404, "not_found");
  if (!["pending_payment", "escrow_held"].includes(transfer.status)) return fail(409, "invalid_status");
  const { data: fromTeam } = transfer.from_team_id
    ? await ctx.supabase.from("esport_teams").select("*").eq("id", transfer.from_team_id).maybeSingle()
    : { data: null };
  const { data: toTeam } = await ctx.supabase.from("esport_teams").select("*").eq("id", transfer.to_team_id).maybeSingle();
  const involved = [toTeam?.captain_id, fromTeam?.captain_id].filter(Boolean);
  if (!involved.includes(auth.account.id) && auth.rank < 6) return fail(403, "forbidden");
  const { data: profile } = await ctx.supabase.from("esport_player_profiles").select("*").eq("id", transfer.player_profile_id).maybeSingle();
  if ((transfer.escrow_coins ?? 0) > 0 && transfer.paid_by) {
    await esportCoinAdjust(
      ctx.supabase,
      transfer.paid_by,
      transfer.escrow_coins,
      "transfer_refund",
      `Pengembalian dana escrow transfer ${profile?.ign ?? "pemain"}`,
      transfer.id,
    );
  }
  await ctx.supabase
    .from("esport_transfers")
    .update({ status: "cancelled", escrow_coins: 0, cancelled_at: now(), cancel_reason: reason })
    .eq("id", transferId);
  if (transfer.listing_id) {
    const { data: listing } = await ctx.supabase.from("esport_transfer_listings").select("*").eq("id", transfer.listing_id).maybeSingle();
    if (listing && listing.status === "paused") {
      await ctx.supabase.from("esport_transfer_listings").update({ status: "open", updated_at: now() }).eq("id", listing.id);
    }
  }
  const others = involved.filter((id) => id !== auth.account.id);
  for (const other of others) {
    await notify(ctx.supabase, other, "esport_transfer", auth.account.id, `Transfer ${profile?.ign ?? "pemain"} dibatalkan${reason ? ` (${reason})` : ""}.`, "#/bursa-transfer");
  }
  return ok({ cancelled: true });
}

async function esportTransferOptionExercise(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const contractId = text(ctx.body.contractId, 60);
  const { data: contract } = await ctx.supabase.from("esport_player_contracts").select("*").eq("id", contractId).maybeSingle();
  if (!contract) return fail(404, "not_found");
  if (contract.status !== "active" || contract.contract_type !== "loan" || !contract.option_price || !contract.option_team_id) {
    return fail(409, "invalid_status");
  }
  const captain = await esportTeamCaptainOk(ctx.supabase, contract.option_team_id, auth.account.id, auth.rank);
  if (captain.error) return captain.error;
  const { data: profile } = await ctx.supabase.from("esport_player_profiles").select("*").eq("id", contract.player_profile_id).maybeSingle();
  if (!profile) return fail(404, "not_found");
  const windowState = await esportTransferWindowState(ctx.supabase, profile.game_id);
  if (!windowState.open) return fail(409, "transfer_window_closed");
  const { data: loanTransfer } = contract.transfer_id
    ? await ctx.supabase.from("esport_transfers").select("*").eq("id", contract.transfer_id).maybeSingle()
    : { data: null };
  let fromTeamId = loanTransfer?.from_team_id ?? null;
  if (!fromTeamId) {
    const { data: memberRows } = await ctx.supabase.from("esport_team_members").select("*").eq("account_id", profile.account_id).limit(10);
    fromTeamId = (memberRows ?? []).find((row) => row.team_id !== contract.option_team_id)?.team_id ?? null;
  }
  const transferId = crypto.randomUUID();
  await ctx.supabase.from("esport_transfers").insert({
    id: transferId,
    offer_id: null,
    listing_id: null,
    player_profile_id: profile.id,
    from_team_id: fromTeamId,
    to_team_id: contract.option_team_id,
    transfer_type: "sale",
    fee: contract.option_price,
    loan_days: null,
    option_price: null,
    status: "pending_payment",
    escrow_coins: 0,
    paid_by: null,
    paid_at: null,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    created_at: now(),
  });
  await ctx.supabase.from("esport_player_contracts").update({ status: "terminated", updated_at: now() }).eq("id", contractId);
  const { data: sellerTeam } = fromTeamId
    ? await ctx.supabase.from("esport_teams").select("*").eq("id", fromTeamId).maybeSingle()
    : { data: null };
  if (sellerTeam?.captain_id) {
    await notify(
      ctx.supabase,
      sellerTeam.captain_id,
      "esport_transfer",
      auth.account.id,
      `Opsi beli dieksekusi untuk ${profile.ign} — menunggu pembayaran escrow ${contract.option_price.toLocaleString("id-ID")} koin.`,
      "#/bursa-transfer",
    );
  }
  return ok({ transferId });
}

async function esportTransferMy(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  await esportTransferSweep(ctx.supabase);
  const accountId = auth.account.id;

  const profileCards = [];
  const { data: profiles } = await ctx.supabase.from("esport_player_profiles").select("*").eq("account_id", accountId);
  for (const profile of profiles ?? []) {
    const card = await esportPlayerCardOut(ctx.supabase, profile, accountId);
    const { data: listingRows } = await ctx.supabase
      .from("esport_transfer_listings")
      .select("*")
      .eq("player_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(3);
    const openListing = (listingRows ?? []).find((l) => ["open", "paused"].includes(l.status)) ?? null;
    card.listing = openListing
      ? {
          id: openListing.id,
          listingType: openListing.listing_type,
          status: openListing.status,
          askingPrice: openListing.asking_price ?? 0,
          loanDays: openListing.loan_days ?? null,
          optionPrice: openListing.option_price ?? null,
        }
      : null;
    profileCards.push(card);
  }

  const { data: allTeams } = await ctx.supabase.from("esport_teams").select("*").limit(500);
  const teamIds = [];
  for (const team of allTeams ?? []) {
    if (team.captain_id === accountId) {
      teamIds.push(team.id);
      continue;
    }
    const { data: membership } = await ctx.supabase
      .from("esport_team_members")
      .select("id")
      .eq("team_id", team.id)
      .eq("account_id", accountId)
      .maybeSingle();
    if (membership) teamIds.push(team.id);
  }

  const { data: allListings } = await ctx.supabase.from("esport_transfer_listings").select("*").limit(500);
  const listings = [];
  const listingMap = new Map((allListings ?? []).map((l) => [l.id, l]));
  for (const listing of allListings ?? []) {
    if ((listing.team_id && teamIds.includes(listing.team_id)) || listing.created_by === accountId) {
      listings.push(await esportListingOut(ctx.supabase, listing, accountId));
    }
  }

  const { data: allOffers } = await ctx.supabase.from("esport_transfer_offers").select("*").limit(800);
  const incomingOffers = [];
  const outgoingOffers = [];
  for (const offer of allOffers ?? []) {
    if (!["pending", "countered", "expired"].includes(offer.status) && !["pending", "countered", "expired"].includes(offer.status)) continue;
    const listing = listingMap.get(offer.listing_id);
    if (!listing) continue;
    const isSellerSide = listing.created_by === accountId || (listing.team_id && teamIds.includes(listing.team_id));
    const isBuyerSide = offer.created_by === accountId || teamIds.includes(offer.from_team_id);
    if (!isSellerSide && !isBuyerSide) continue;
    const out = await esportOfferOut(ctx.supabase, offer);
    const { data: profile } = await ctx.supabase
      .from("esport_player_profiles")
      .select("id,ign,main_role,rank_tier")
      .eq("id", listing.player_profile_id)
      .maybeSingle();
    const entry = {
      ...out,
      kind: isSellerSide ? "incoming" : "outgoing",
      listing: {
        id: listing.id,
        listingType: listing.listing_type,
        askingPrice: listing.asking_price ?? 0,
        loanDays: listing.loan_days ?? null,
        optionPrice: listing.option_price ?? null,
        status: listing.status,
        teamId: listing.team_id ?? null,
      },
      player: profile ? { id: profile.id, ign: profile.ign, mainRole: profile.main_role ?? null, rankTier: profile.rank_tier ?? null } : null,
    };
    if (isSellerSide) incomingOffers.push(entry);
    else outgoingOffers.push(entry);
  }
  incomingOffers.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  outgoingOffers.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const { data: allTransfers } = await ctx.supabase.from("esport_transfers").select("*").limit(500);
  const transfers = [];
  for (const transfer of allTransfers ?? []) {
    const isBuyerSide = teamIds.includes(transfer.to_team_id);
    const isSellerSide = transfer.from_team_id ? teamIds.includes(transfer.from_team_id) : false;
    const { data: profile } = await ctx.supabase.from("esport_player_profiles").select("account_id").eq("id", transfer.player_profile_id).maybeSingle();
    const isPlayer = profile?.account_id === accountId;
    if (!isBuyerSide && !isSellerSide && !isPlayer) continue;
    transfers.push(await esportTransferOut(ctx.supabase, transfer, accountId, auth.rank));
  }
  transfers.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const contracts = [];
  const { data: allContracts } = await ctx.supabase.from("esport_player_contracts").select("*").order("created_at", { ascending: false }).limit(500);
  for (const contract of allContracts ?? []) {
    const relatedTeam = teamIds.includes(contract.team_id) || (contract.option_team_id && teamIds.includes(contract.option_team_id));
    const { data: profile } = await ctx.supabase.from("esport_player_profiles").select("*").eq("id", contract.player_profile_id).maybeSingle();
    const isPlayer = profile?.account_id === accountId;
    if (!relatedTeam && !isPlayer) continue;
    const { data: team } = await ctx.supabase.from("esport_teams").select("id,name,tag,logo_data").eq("id", contract.team_id).maybeSingle();
    contracts.push({
      id: contract.id,
      player: profile ? { id: profile.id, ign: profile.ign, mainRole: profile.main_role ?? null, photoData: null, accountId: profile.account_id } : null,
      team: team ? { id: team.id, name: team.name, tag: team.tag ?? null, logo: team.logo_data ?? null } : null,
      contractType: contract.contract_type,
      startDate: contract.start_date,
      endDate: contract.end_date ?? null,
      status: contract.status,
      optionPrice: contract.option_price ?? null,
      optionTeamId: contract.option_team_id ?? null,
      canExerciseOption: Boolean(contract.option_team_id && teamIds.includes(contract.option_team_id) && contract.status === "active"),
      createdAt: contract.created_at,
    });
  }

  const windows = [];
  const { data: allWindows } = await ctx.supabase.from("esport_transfer_windows").select("*").order("closes_at", { ascending: true }).limit(200);
  const { data: games } = await ctx.supabase.from("esport_games").select("id,name,icon");
  const gameMap = new Map((games ?? []).map((g) => [g.id, g]));
  for (const w of allWindows ?? []) {
    if (Date.parse(w.closes_at) < Date.now() - 86400000) continue;
    windows.push({
      id: w.id,
      gameId: w.game_id,
      gameName: gameMap.get(w.game_id)?.name ?? "Game",
      gameIcon: gameMap.get(w.game_id)?.icon ?? null,
      name: w.name,
      opensAt: w.opens_at,
      closesAt: w.closes_at,
      openNow: Date.parse(w.opens_at) <= Date.now() && Date.now() <= Date.parse(w.closes_at),
    });
  }

  const { data: balanceRow } = await ctx.supabase.from("coin_balances").select("balance").eq("account_id", accountId).maybeSingle();

  return ok({
    profiles: profileCards,
    teams: teamIds,
    listings,
    incomingOffers,
    outgoingOffers,
    transfers,
    contracts,
    windows,
    koinBalance: balanceRow?.balance ?? 0,
  });
}

async function esportTransferAnnouncements(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  await esportTransferSweep(ctx.supabase);
  const limit = intOrNull(ctx.body.limit, 1, 50) ?? 30;
  const { data: transfers } = await ctx.supabase
    .from("esport_transfers")
    .select("*")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(limit);
  const items = [];
  for (const transfer of transfers ?? []) {
    const out = await esportTransferOut(ctx.supabase, transfer, auth.account.id, auth.rank);
    items.push({
      id: out.id,
      player: out.player,
      fromTeam: out.fromTeam,
      toTeam: out.toTeam,
      transferType: out.transferType,
      fee: out.fee,
      loanDays: out.loanDays,
      contractEnd: out.contractEnd,
      completedAt: out.completedAt,
    });
  }
  return ok({ items });
}

// ---------- Fase A: Player Stats, Reviews, Disputes, Roster History ----------

async function esportPlayerStatsGet(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profileId = strOr(ctx.body?.id ?? ctx.params?.id);
  if (!profileId) return badRequest("id diperlukan");
  const { data: stats, error } = await ctx.supabase
    .from("esport_player_stats")
    .select("*")
    .eq("player_profile_id", profileId)
    .single();
  if (error && error.code !== "PGRST116") return dbError(error);
  return ok({ stats: stats || null });
}

async function esportPlayerStatsSave(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profileId = strOr(ctx.body?.id);
  if (!profileId) return badRequest("id diperlukan");
  // Verify ownership or admin
  const { data: profile } = await ctx.supabase
    .from("esport_player_profiles")
    .select("account_id")
    .eq("id", profileId)
    .single();
  if (!profile) return notFound("Profil tidak ditemukan");
  if (profile.account_id !== auth.account.id && auth.rank < 6) {
    return forbidden("Hanya pemilik profil atau admin");
  }
  const payload = {
    player_profile_id: profileId,
    total_matches: intOr(ctx.body?.totalMatches, 0),
    win_rate: numOr(ctx.body?.winRate, 0),
    kda_ratio: numOr(ctx.body?.kdaRatio, 0),
    game_specific: ctx.body?.gameSpecific || {},
    tournaments_played: intOr(ctx.body?.tournamentsPlayed, 0),
    tournaments_won: intOr(ctx.body?.tournamentsWon, 0),
    mvp_awards: intOr(ctx.body?.mvpAwards, 0),
    team_win_rate: numOr(ctx.body?.teamWinRate, 0),
    data_source: strOr(ctx.body?.dataSource) || "manual",
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await ctx.supabase
    .from("esport_player_stats")
    .select("id")
    .eq("player_profile_id", profileId)
    .single();
  let result;
  if (existing) {
    const { data, error } = await ctx.supabase
      .from("esport_player_stats")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return dbError(error);
    result = data;
  } else {
    const { data, error } = await ctx.supabase
      .from("esport_player_stats")
      .insert(payload)
      .select()
      .single();
    if (error) return dbError(error);
    result = data;
  }
  return ok({ stats: result });
}

async function esportPlayerReviewsList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profileId = strOr(ctx.body?.id ?? ctx.params?.id);
  if (!profileId) return badRequest("id diperlukan");
  const { data: reviews, error } = await ctx.supabase
    .from("esport_player_reviews")
    .select("*")
    .eq("player_profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) return dbError(error);
  const items = [];
  for (const r of reviews ?? []) {
    const { data: reviewer } = await ctx.supabase
      .from("accounts")
      .select("id, full_name, photo_data")
      .eq("id", r.reviewer_id)
      .single();
    let reviewerTeam = null;
    if (r.reviewer_team_id) {
      const { data: team } = await ctx.supabase
        .from("esport_teams")
        .select("id, name, tag, logo_data")
        .eq("id", r.reviewer_team_id)
        .single();
      if (team) reviewerTeam = { id: team.id, name: team.name, tag: team.tag, logo: team.logo_data };
    }
    items.push({
      id: r.id,
      playerProfileId: r.player_profile_id,
      reviewerId: r.reviewer_id,
      reviewerTeamId: r.reviewer_team_id,
      ratingSkill: r.rating_skill,
      ratingTeamwork: r.rating_teamwork,
      ratingDiscipline: r.rating_discipline,
      ratingCommunication: r.rating_communication,
      comment: r.comment,
      createdAt: r.created_at,
      reviewer: reviewer ? { id: reviewer.id, name: reviewer.full_name, photoData: reviewer.photo_data } : null,
      reviewerTeam,
    });
  }
  return ok({ items });
}

async function esportPlayerReviewsCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profileId = strOr(ctx.body?.playerProfileId);
  if (!profileId) return badRequest("playerProfileId diperlukan");
  const ratingSkill = intOr(ctx.body?.ratingSkill, 0);
  const ratingTeamwork = intOr(ctx.body?.ratingTeamwork, 0);
  const ratingDiscipline = intOr(ctx.body?.ratingDiscipline, 0);
  const ratingCommunication = intOr(ctx.body?.ratingCommunication, 0);
  if ([ratingSkill, ratingTeamwork, ratingDiscipline, ratingCommunication].some((r) => r < 1 || r > 5)) {
    return badRequest("Rating harus antara 1-5");
  }
  const reviewerTeamId = strOr(ctx.body?.reviewerTeamId) || null;
  const comment = strOr(ctx.body?.comment) || null;
  const payload = {
    player_profile_id: profileId,
    reviewer_id: auth.account.id,
    reviewer_team_id: reviewerTeamId,
    rating_skill: ratingSkill,
    rating_teamwork: ratingTeamwork,
    rating_discipline: ratingDiscipline,
    rating_communication: ratingCommunication,
    comment,
  };
  const { data, error } = await ctx.supabase
    .from("esport_player_reviews")
    .upsert(payload, { onConflict: "player_profile_id,reviewer_id" })
    .select()
    .single();
  if (error) return dbError(error);
  return ok({ review: data });
}

async function esportPlayerReviewsSummary(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const profileId = strOr(ctx.body?.id ?? ctx.params?.id);
  if (!profileId) return badRequest("id diperlukan");
  const { data: reviews, error } = await ctx.supabase
    .from("esport_player_reviews")
    .select("rating_skill, rating_teamwork, rating_discipline, rating_communication")
    .eq("player_profile_id", profileId);
  if (error) return dbError(error);
  const count = reviews?.length ?? 0;
  if (count === 0) {
    return ok({
      summary: {
        playerProfileId: profileId,
        reviewCount: 0,
        avgSkill: 0,
        avgTeamwork: 0,
        avgDiscipline: 0,
        avgCommunication: 0,
        avgOverall: 0,
      },
    });
  }
  const avgSkill = reviews.reduce((s, r) => s + r.rating_skill, 0) / count;
  const avgTeamwork = reviews.reduce((s, r) => s + r.rating_teamwork, 0) / count;
  const avgDiscipline = reviews.reduce((s, r) => s + r.rating_discipline, 0) / count;
  const avgCommunication = reviews.reduce((s, r) => s + r.rating_communication, 0) / count;
  const avgOverall = (avgSkill + avgTeamwork + avgDiscipline + avgCommunication) / 4;
  return ok({
    summary: {
      playerProfileId: profileId,
      reviewCount: count,
      avgSkill: Math.round(avgSkill * 10) / 10,
      avgTeamwork: Math.round(avgTeamwork * 10) / 10,
      avgDiscipline: Math.round(avgDiscipline * 10) / 10,
      avgCommunication: Math.round(avgCommunication * 10) / 10,
      avgOverall: Math.round(avgOverall * 10) / 10,
    },
  });
}

async function esportTransferDisputesList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const transferId = strOr(ctx.body?.transferId);
  let query = ctx.supabase.from("esport_transfer_disputes").select("*").order("created_at", { ascending: false });
  if (transferId) query = query.eq("transfer_id", transferId);
  const { data: disputes, error } = await query.limit(50);
  if (error) return dbError(error);
  const items = [];
  for (const d of disputes ?? []) {
    const { data: raiser } = await ctx.supabase
      .from("accounts")
      .select("id, full_name, photo_data")
      .eq("id", d.raised_by)
      .single();
    items.push({
      id: d.id,
      transferId: d.transfer_id,
      raisedBy: d.raised_by,
      reason: d.reason,
      description: d.description,
      evidence: d.evidence || [],
      status: d.status,
      resolvedBy: d.resolved_by,
      resolution: d.resolution,
      resolvedAt: d.resolved_at,
      createdAt: d.created_at,
      raisedByUser: raiser ? { id: raiser.id, name: raiser.full_name, photoData: raiser.photo_data } : null,
    });
  }
  return ok({ items });
}

async function esportTransferDisputesCreate(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const transferId = strOr(ctx.body?.transferId);
  if (!transferId) return badRequest("transferId diperlukan");
  const reason = strOr(ctx.body?.reason);
  if (!reason) return badRequest("reason diperlukan");
  const description = strOr(ctx.body?.description) || null;
  const evidence = Array.isArray(ctx.body?.evidence) ? ctx.body.evidence : [];
  const payload = {
    transfer_id: transferId,
    raised_by: auth.account.id,
    reason,
    description,
    evidence,
    status: "open",
  };
  const { data, error } = await ctx.supabase
    .from("esport_transfer_disputes")
    .insert(payload)
    .select()
    .single();
  if (error) return dbError(error);
  return ok({ dispute: data });
}

async function esportTransferDisputesResolve(ctx) {
  const auth = await actor(ctx, 6);
  if (auth.error) return auth.error;
  const disputeId = strOr(ctx.body?.id);
  if (!disputeId) return badRequest("id diperlukan");
  const status = strOr(ctx.body?.status);
  if (!["resolved", "dismissed"].includes(status)) return badRequest("status harus resolved atau dismissed");
  const resolution = strOr(ctx.body?.resolution) || null;
  const { data, error } = await ctx.supabase
    .from("esport_transfer_disputes")
    .update({
      status,
      resolved_by: auth.account.id,
      resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId)
    .select()
    .single();
  if (error) return dbError(error);
  return ok({ dispute: data });
}

async function esportRosterHistoryList(ctx) {
  const auth = await actor(ctx, 2);
  if (auth.error) return auth.error;
  const teamId = strOr(ctx.body?.teamId);
  const playerId = strOr(ctx.body?.playerProfileId);
  let query = ctx.supabase.from("esport_roster_history").select("*").order("joined_at", { ascending: false });
  if (teamId) query = query.eq("team_id", teamId);
  if (playerId) query = query.eq("player_profile_id", playerId);
  const { data: history, error } = await query.limit(100);
  if (error) return dbError(error);
  const items = [];
  for (const h of history ?? []) {
    const { data: team } = await ctx.supabase
      .from("esport_teams")
      .select("id, name, tag, logo_data")
      .eq("id", h.team_id)
      .single();
    const { data: player } = await ctx.supabase
      .from("esport_player_profiles")
      .select("id, ign, main_role")
      .eq("id", h.player_profile_id)
      .single();
    const { data: account } = await ctx.supabase
      .from("accounts")
      .select("photo_data")
      .eq("id", player ? (await ctx.supabase.from("esport_player_profiles").select("account_id").eq("id", h.player_profile_id).single()).data?.account_id : null)
      .single();
    items.push({
      id: h.id,
      teamId: h.team_id,
      playerProfileId: h.player_profile_id,
      joinedAt: h.joined_at,
      leftAt: h.left_at,
      leaveReason: h.leave_reason,
      transferId: h.transfer_id,
      createdAt: h.created_at,
      team: team ? { id: team.id, name: team.name, tag: team.tag, logo: team.logo_data } : null,
      player: player ? { id: player.id, ign: player.ign, mainRole: player.main_role, photoData: account?.photo_data || null } : null,
    });
  }
  return ok({ items });
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

async function adminEventsList(ctx) {
  const auth = await actor(ctx, 5);
  if (auth.error) return auth.error;
  const { data: rows } = await ctx.supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const events = rows ?? [];
  const ids = events.map((e) => e.id);
  const ticketsByEvent = new Map();
  const attendanceByEvent = new Map();
  if (ids.length) {
    const { data: tickets } = await ctx.supabase
      .from("event_tickets")
      .select("event_id,status,ticket_type,price")
      .in("event_id", ids);
    for (const t of tickets ?? []) {
      const entry = ticketsByEvent.get(t.event_id) ?? { total: 0, valid: 0, used: 0, pending: 0, cancelled: 0, revenue: 0 };
      entry.total += 1;
      if (entry[t.status] !== undefined) entry[t.status] += 1;
      if (t.status === "valid" || t.status === "used") entry.revenue += Number(t.price ?? 0);
      ticketsByEvent.set(t.event_id, entry);
    }
    const { data: attendance } = await ctx.supabase
      .from("event_attendance")
      .select("event_id")
      .in("event_id", ids);
    for (const a of attendance ?? []) {
      attendanceByEvent.set(a.event_id, (attendanceByEvent.get(a.event_id) ?? 0) + 1);
    }
  }
  const creators = await namesFor(ctx.supabase, events.map((e) => e.created_by));
  return ok({
    items: events.map((row) => ({
      id: row.id,
      title: row.title,
      audience: row.audience,
      status: row.status,
      startsAt: row.starts_at,
      createdAt: row.created_at,
      capacity: row.capacity ?? null,
      ticketPrice: row.ticket_price ?? null,
      createdBy: row.created_by,
      creatorName: creators.get(row.created_by)?.displayName ?? creators.get(row.created_by)?.nickname ?? null,
      tickets: ticketsByEvent.get(row.id) ?? { total: 0, valid: 0, used: 0, pending: 0, cancelled: 0, revenue: 0 },
      attendanceCount: attendanceByEvent.get(row.id) ?? 0,
    })),
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
      ceo: 1000000,
      sultan: 2000000,
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
    enabled: true,
    provider: "twelvedata",
    tradingViewWidgetId: "",
    tradingViewSymbol: "IDX:IHSG",
    tradingViewInterval: "15",
    tradingViewTheme: "light",
    apiKey: "39cdbd541ed04eda9475e517d01ff3d6",
    apiBaseUrl: "https://api.twelvedata.com",
    symbols: [
      { id: "sym1", symbol: "AAPL", label: "Apple", enabled: true },
      { id: "sym2", symbol: "GOOGL", label: "Google", enabled: true },
      { id: "sym3", symbol: "MSFT", label: "Microsoft", enabled: true },
      { id: "sym4", symbol: "BTC/USD", label: "Bitcoin", enabled: true },
      { id: "sym5", symbol: "ETH/USD", label: "Ethereum", enabled: true },
      { id: "sym6", symbol: "EUR/USD", label: "EUR/USD", enabled: true },
      { id: "sym7", symbol: "XAU/USD", label: "Emas", enabled: true },
    ],
    refreshInterval: 10,
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
    subAgents: [
      { id: "sa_market_scanner", name: "MARKET SCANNER", icon: "⌁", role: "market_scanner", description: "Memindai aset dan sinyal pasar", status: "active", priority: 1, intervalSeconds: 30, enabled: true, config: {} },
      { id: "sa_trading_executor", name: "TRADING EXECUTOR", icon: "ϟ", role: "trading_executor", description: "Simulasi eksekusi strategi", status: "standby", priority: 2, intervalSeconds: 60, enabled: true, config: {} },
      { id: "sa_risk_manager", name: "RISK MANAGER", icon: "⬡", role: "risk_manager", description: "Limit risiko dan kontrol modal", status: "active", priority: 1, intervalSeconds: 15, enabled: true, config: {} },
      { id: "sa_news_analyzer", name: "NEWS ANALYZER", icon: "▤", role: "news_analyzer", description: "Sentimen dan berita pasar", status: "active", priority: 2, intervalSeconds: 120, enabled: true, config: {} },
      { id: "sa_portfolio_manager", name: "PORTFOLIO MANAGER", icon: "◉", role: "portfolio_manager", description: "Alokasi dan rebalancing", status: "active", priority: 3, intervalSeconds: 300, enabled: true, config: {} },
      { id: "sa_backtester", name: "BACKTESTER", icon: "⚙", role: "backtester", description: "Uji strategi historis", status: "standby", priority: 4, intervalSeconds: 600, enabled: true, config: {} },
      { id: "sa_data_aggregator", name: "DATA AGGREGATOR", icon: "▦", role: "data_aggregator", description: "Normalisasi feed data", status: "active", priority: 1, intervalSeconds: 10, enabled: true, config: {} },
      { id: "sa_wallet_monitor", name: "WALLET MONITOR", icon: "⊚", role: "wallet_monitor", description: "Monitor pergerakan dompet digital trader", status: "active", priority: 2, intervalSeconds: 60, enabled: true, config: {} },
      { id: "sa_social_sentinel", name: "SOCIAL SENTINEL", icon: "◈", role: "social_sentinel", description: "Pantau Telegram, X/Twitter, dan forum", status: "active", priority: 2, intervalSeconds: 45, enabled: true, config: {} },
      { id: "sa_copy_trader", name: "COPY TRADER", icon: "⧉", role: "copy_trader", description: "Salin posisi trader terpilih", status: "standby", priority: 3, intervalSeconds: 30, enabled: false, config: {} },
    ],
    tradingServers: [
      { id: "ts_binance", name: "SERVER 01", provider: "Binance", description: "Binance endpoint", baseUrl: "https://api.binance.com", wsUrl: "wss://stream.binance.com:9443/ws", apiKey: "", apiSecret: "", testnet: true, status: "demo", enabled: true, rateLimit: 1200, symbols: ["BTCUSDT", "ETHUSDT", "BNBUSDT"], features: ["spot", "futures"], lastHeartbeat: null },
      { id: "ts_bybit", name: "SERVER 02", provider: "Bybit", description: "Bybit endpoint", baseUrl: "https://api.bybit.com", wsUrl: "wss://stream.bybit.com/v5/public/spot", apiKey: "", apiSecret: "", testnet: true, status: "demo", enabled: true, rateLimit: 600, symbols: ["BTCUSDT", "ETHUSDT"], features: ["spot", "futures", "copy"], lastHeartbeat: null },
      { id: "ts_okx", name: "SERVER 03", provider: "OKX", description: "OKX endpoint", baseUrl: "https://www.okx.com", wsUrl: "wss://ws.okx.com:8443/ws/v5/public", apiKey: "", apiSecret: "", testnet: true, status: "demo", enabled: true, rateLimit: 600, symbols: ["BTC-USDT", "ETH-USDT"], features: ["spot", "futures"], lastHeartbeat: null },
      { id: "ts_bitget", name: "SERVER 04", provider: "Bitget", description: "Bitget endpoint", baseUrl: "https://api.bitget.com", wsUrl: "wss://ws.bitget.com/spot/v1/stream", apiKey: "", apiSecret: "", testnet: true, status: "demo", enabled: false, rateLimit: 600, symbols: ["BTCUSDT", "ETHUSDT"], features: ["spot", "futures", "copy"], lastHeartbeat: null },
      { id: "ts_custom", name: "SERVER 05", provider: "Custom", description: "Custom / MT5", baseUrl: "", wsUrl: "", apiKey: "", apiSecret: "", testnet: true, status: "demo", enabled: false, rateLimit: 300, symbols: [], features: [], lastHeartbeat: null },
    ],
    promptLibrary: [
      {
        id: "prompt_wallet_monitor_01",
        name: "Monitor Pergerakan Wallet Besar",
        category: "wallet_monitor",
        description: "Deteksi dan analisis pergerakan wallet whale/trader besar di blockchain",
        prompt: "Anda adalah WALLET MONITOR agent. Tugas Anda:\n1. Pantau alamat wallet {{wallet_addresses}} di jaringan {{network}}\n2. Deteksi transaksi masuk/keluar di atas {{threshold_usd}} USD\n3. Analisis pola: akumulasi, distribusi, atau transfer internal\n4. Hitung perubahan saldo 24j/7j/1j terakhir\n5. Beri skor urgensi 1-10 berdasarkan volume dan frekuensi\n6. Jika ada pergerakan mencurigakan, kirim alert dengan detail:\n   - Alamat wallet\n   - Hash transaksi\n   - Nilai dalam USD\n   - Arah transfer\n   - Potensi dampak ke harga\n\nFormat output: JSON dengan field: alert_level, wallet, action, amount_usd, confidence, recommendation",
        variables: ["wallet_addresses", "network", "threshold_usd"],
        enabled: true,
        priority: 1,
        subAgentRoles: ["wallet_monitor", "market_scanner"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
      {
        id: "prompt_wallet_tracker_02",
        name: "Tracker Profit/Loss Trader",
        category: "wallet_monitor",
        description: "Lacak profit/loss real-time dari wallet trader yang di-follow",
        prompt: "Anda adalah WALLET PROFIT TRACKER. Analisis wallet {{wallet_address}}:\n1. Hitung total entry price vs current value\n2. Track unrealized P&L per token\n3. Identifikasi token yang sedang profit/loss tertinggi\n4. Hitung win rate dari historikal transaksi\n5. Bandingkan performa dengan BTC buy-hold\n6. Generate laporan harian:\n   - Total P&L (USD & %)\n   - Best/worst performing token\n   - Rekomendasi: hold/take profit/cut loss\n\nOutput format: { wallet, total_pnl_usd, total_pnl_pct, top_gainers, top_losers, win_rate, recommendation }",
        variables: ["wallet_address"],
        enabled: true,
        priority: 2,
        subAgentRoles: ["wallet_monitor", "portfolio_manager"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
      {
        id: "prompt_news_analysis_01",
        name: "Analisis Sentimen Berita Crypto",
        category: "news_analysis",
        description: "Baca dan analisis sentimen dari berita crypto terkini",
        prompt: "Anda adalah NEWS ANALYZER agent. Tugas Anda:\n1. Baca berita dari {{news_sources}} untuk {{coins}}\n2. Klasifikasi sentimen: bullish/bearish/neutral (skor -10 s/d +10)\n3. Identifikasi kata kunci: regulation, adoption, hack, partnership, listing\n4. Hitung impact score berdasarkan:\n   - Sumber (reputasi)\n   - Reach (jumlah pembaca)\n   - Relevansi dengan coin\n5. Prediksi dampak jangka pendek (1-4 jam) dan menengah (1-7 hari)\n6. Generate trading signal: BUY/HOLD/SELL dengan confidence level\n\nFormat output: { coin, sentiment_score, impact_score, keywords, short_term_outlook, medium_term_outlook, signal, confidence }",
        variables: ["news_sources", "coins"],
        enabled: true,
        priority: 1,
        subAgentRoles: ["news_analyzer", "market_scanner"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
      {
        id: "prompt_news_surveillance_01",
        name: "Surveillance Berita Global",
        category: "news_surveillance",
        description: "Pantau berita global yang berdampak ke pasar crypto dan forex",
        prompt: "Anda adalah GLOBAL NEWS SURVEILLANCE agent. Monitor:\n1. Berita ekonomi makro: Fed rate decision, CPI, GDP, employment data\n2. Regulasi crypto: SEC, CFTC, EU MiCA, Asia regulations\n3. Geopolitik: perang, sanksi, trade war\n4. Black swan events: exchange hack, stablecoin depeg, bank failure\n5. Central bank announcements: ECB, BOJ, PBOC\n\nUntuk setiap event:\n- Kategorikan: crypto_specific, macro_economic, geopolitical, regulatory\n- Hitung market impact: high/medium/low\n- Identifikasi affected assets\n- Estimasi timeframe dampak\n- Rekomendasi action: hedge, reduce exposure, increase position\n\nOutput: { event_type, headline, impact_level, affected_assets, timeframe, recommendation }",
        variables: [],
        enabled: true,
        priority: 1,
        subAgentRoles: ["news_analyzer", "risk_manager"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
      {
        id: "prompt_telegram_forum_01",
        name: "Monitor Telegram Forum Crypto",
        category: "telegram_forum",
        description: "Pantau dan analisis diskusi di grup/channel Telegram crypto",
        prompt: "Anda adalah TELEGRAM FORUM MONITOR. Analisis channel/grup:\n{{telegram_channels}}\n\nTugas:\n1. Track mention frequency untuk {{coins}}\n2. Identifikasi influencer/KOL yang aktif\n3. Deteksi pump & dump signals:\n   - Koordinasi beli di waktu tertentu\n   - Mention tiba-tiba dari coin kecil\n   - Hype tanpa fundamental\n4. Analisis sentimen komunitas: FUD, FOMO, HODL\n5. Track developer activity announcements\n6. Identifikasi alpha: info insider, partnership leak, listing rumor\n\nOutput format: { channel, coin_mentions, sentiment, kol_activity, pump_risk_score, alpha_signals }",
        variables: ["telegram_channels", "coins"],
        enabled: true,
        priority: 2,
        subAgentRoles: ["social_sentinel", "news_analyzer"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
      {
        id: "prompt_twitter_x_01",
        name: "Monitor X/Twitter Crypto Influencer",
        category: "twitter_x",
        description: "Track tweet dari influencer dan akun resmi project crypto",
        prompt: "Anda是 TWITTER/X SENTINEL. Monitor akun:\n{{twitter_accounts}}\n\nAnalisis:\n1. Track tweet tentang {{coins}} dari {{time_range}} terakhir\n2. Hitung engagement: likes, retweets, replies, quote tweets\n3. Identifikasi viral tweets (>1000 engagement)\n4. Deteksi coordinated shilling (multiple akun tweet serupa)\n5. Track announcement dari official accounts\n6. Analisis thread length dan depth (indikasi serious alpha vs noise)\n7. Hitung sentiment score per coin berdasarkan tweet\n\nOutput: { account, tweets_analyzed, viral_tweets, coin_sentiment, engagement_metrics, alpha_score }",
        variables: ["twitter_accounts", "coins", "time_range"],
        enabled: true,
        priority: 2,
        subAgentRoles: ["social_sentinel", "news_analyzer"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
      {
        id: "prompt_copy_trading_01",
        name: "Copy Trading dari Trader Top",
        category: "copy_trading",
        description: "Analisis dan copy posisi dari trader dengan track record terbaik",
        prompt: "Anda adalah COPY TRADING ENGINE. Tugas:\n1. Identifikasi top traders dari {{source_exchange}} dengan kriteria:\n   - Win rate > {{min_win_rate}}%\n   - Profit factor > {{min_profit_factor}}\n   - Minimal {{min_trades}} transaksi\n   - Track record > {{min_track_record_days}} hari\n2. Analisis posisi terbuka trader terpilih:\n   - Entry price, size, leverage\n   - Stop loss, take profit\n   - Risk/reward ratio\n3. Hitung copy signal:\n   - Confidence score berdasarkan historical accuracy\n   - Suggested position size (max {{max_copy_percent}}% dari portfolio)\n   - Adjusted entry untuk slippage\n4. Monitor real-time dan auto-close jika:\n   - Trader close position\n   - Drawdown > {{max_drawdown}}%\n   - Signal confidence turun di bawah {{min_confidence}}\n\nOutput: { trader_id, signal_type, coin, entry_price, suggested_size, stop_loss, take_profit, confidence, risk_reward }",
        variables: ["source_exchange", "min_win_rate", "min_profit_factor", "min_trades", "min_track_record_days", "max_copy_percent", "max_drawdown", "min_confidence"],
        enabled: true,
        priority: 3,
        subAgentRoles: ["copy_trader", "trading_executor"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
      {
        id: "prompt_market_analysis_01",
        name: "Analisis Teknikal Multi-Timeframe",
        category: "market_analysis",
        description: "Analisis teknikal komprehensif dengan multiple timeframe dan indikator",
        prompt: "Anda adalah TECHNICAL ANALYST agent. Analisis {{coin}} di timeframe {{timeframes}}:\n\nIndikator yang harus dihitung:\n1. Trend: EMA 20/50/200, MACD, ADX\n2. Momentum: RSI, Stochastic, CCI\n3. Volatility: Bollinger Bands, ATR\n4. Volume: OBV, Volume Profile, VWAP\n5. Support/Resistance: Pivot points, Fibonacci\n6. Pattern: candlestick patterns, chart patterns\n\nUntuk setiap timeframe:\n- Tentukan trend direction\n- Identifikasi key levels\n- Hitung confluence score (berapa indikator yang confirm)\n- Generate signal: STRONG BUY / BUY / NEUTRAL / SELL / STRONG SELL\n\nMulti-timeframe analysis:\n- Jika semua timeframe align: high confidence signal\n- Jika conflicting: wait for confirmation\n\nOutput: { coin, timeframe_analysis, overall_signal, confidence, key_levels, patterns_detected }",
        variables: ["coin", "timeframes"],
        enabled: true,
        priority: 1,
        subAgentRoles: ["market_scanner", "trading_executor"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
      {
        id: "prompt_risk_assessment_01",
        name: "Risk Assessment Portfolio",
        category: "risk_assessment",
        description: "Evaluasi risiko portfolio dan posisi trading secara real-time",
        prompt: "Anda adalah RISK MANAGER agent. Evaluasi portfolio:\n\n1. Position sizing analysis:\n   - Total exposure per coin\n   - Correlation antar posisi\n   - Concentration risk (max {{max_single_position}}% per coin)\n2. Drawdown monitoring:\n   - Current drawdown vs max allowed {{max_drawdown}}%\n   - Daily/weekly loss vs limit\n3. Leverage risk:\n   - Effective leverage\n   - Liquidation distance\n   - Margin utilization\n4. Market risk:\n   - Volatility regime (low/normal/high/extreme)\n   - Liquidity risk (bid-ask spread, depth)\n   - Event risk (upcoming news, FOMC, dll)\n5. Risk metrics:\n   - VaR (Value at Risk) 95% confidence\n   - Sharpe ratio\n   - Max drawdown historical\n\nAction triggers:\n- Jika drawdown > {{warning_drawdown}}%: WARNING\n- Jika drawdown > {{critical_drawdown}}%: CRITICAL, reduce positions\n- Jika volatility > {{high_vol_threshold}}: reduce leverage\n\nOutput: { portfolio_risk_score, position_risks, drawdown_status, leverage_risk, market_risk, action_required }",
        variables: ["max_single_position", "max_drawdown", "warning_drawdown", "critical_drawdown", "high_vol_threshold"],
        enabled: true,
        priority: 1,
        subAgentRoles: ["risk_manager", "portfolio_manager"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
      {
        id: "prompt_sentiment_aggregate_01",
        name: "Aggregate Sentiment Score",
        category: "sentiment",
        description: "Gabungkan semua sumber sentimen menjadi skor komposit",
        prompt: "Anda是 SENTIMENT AGGREGATOR. Gabungkan data dari:\n1. News sentiment (bobot {{news_weight}}%)\n2. Social media sentiment (bobot {{social_weight}}%)\n3. On-chain metrics (bobot {{onchain_weight}}%)\n4. Technical indicators (bobot {{technical_weight}}%)\n\nUntuk {{coin}}:\n- Hitung weighted sentiment score (-100 s/d +100)\n- Identifikasi divergensi (contoh: price naik tapi sentiment turun)\n- Deteksi extreme sentiment (FOMO > 80 atau FUD > 80)\n- Generate contrarian signal jika extreme\n\nOutput format:\n{ coin, composite_sentiment, news_component, social_component, onchain_component, technical_component, divergence_detected, contrarian_signal, confidence }",
        variables: ["coin", "news_weight", "social_weight", "onchain_weight", "technical_weight"],
        enabled: true,
        priority: 2,
        subAgentRoles: ["market_scanner", "news_analyzer"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
      {
        id: "prompt_execution_01",
        name: "Smart Order Execution",
        category: "execution",
        description: "Eksekusi order dengan optimasi slippage dan timing",
        prompt: "Anda adalah ORDER EXECUTION ENGINE. Tugas:\n1. Terima signal dari {{signal_source}}:\n   - Side: BUY/SELL\n   - Coin: {{coin}}\n   - Size: {{position_size}}\n   - Urgency: {{urgency_level}}\n2. Analisis market microstructure:\n   - Order book depth\n   - Recent trade flow\n   - Spread analysis\n3. Pilih execution strategy:\n   - Market order (untuk urgency tinggi)\n   - Limit order (untuk size besar)\n   - TWAP (Time Weighted Average Price)\n   - VWAP (Volume Weighted Average Price)\n   - Iceberg (untuk hide size)\n4. Split order ke {{num_chunks}} bagian\n5. Monitor slippage dan adjust jika perlu\n6. Report execution quality:\n   - Average fill price vs signal price\n   - Total slippage\n   - Execution time\n\nOutput: { order_id, strategy_used, chunks_executed, avg_fill_price, slippage_bps, execution_time_ms }",
        variables: ["signal_source", "coin", "position_size", "urgency_level", "num_chunks"],
        enabled: true,
        priority: 1,
        subAgentRoles: ["trading_executor"],
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      },
    ],
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
  cryptoSettings: {
    treasuryWallets: [
      { id: "tw-usdt-trc20", coinSymbol: "USDT", network: "TRC20", address: "TN9RRaXkNTKEDaydnSNBeMXaBmMoPxXmBd", label: "Treasury USDT TRC20", balance: 50000, enabled: true },
      { id: "tw-eth-erc20", coinSymbol: "ETH", network: "ERC20", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18", label: "Treasury ETH ERC20", balance: 12.5, enabled: true },
      { id: "tw-btc-main", coinSymbol: "BTC", network: "Bitcoin", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", label: "Treasury BTC", balance: 0.75, enabled: true },
      { id: "tw-sol-main", coinSymbol: "SOL", network: "Solana", address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", label: "Treasury SOL", balance: 250, enabled: false },
    ],
    distribution: {
      autoCreditOnDeposit: true,
      minConfirmations: 3,
      maxDailyWithdrawCrypto: 10000,
      maxDailySwapCoins: 1000000,
      enableAutoSwap: false,
      defaultSwapSlippagePercent: 0.5,
    },
    globalFees: {
      depositFeePercent: 0,
      withdrawFeePercent: 1.5,
      swapFeePercent: 0.5,
      minDepositUsd: 1,
      minWithdrawUsd: 5,
    },
    notifications: {
      notifyOnLargeDeposit: true,
      largeDepositThresholdUsd: 1000,
      notifyOnWithdraw: true,
      notifyOnLowTreasury: true,
      lowTreasuryThresholdUsd: 500,
    },
  },
  apiManagement: {
    apis: [
      {
        id: "api_1",
        name: "CoinGecko Price API",
        description: "API untuk data harga crypto real-time",
        apiKey: "cg-demo-key-xxxxxxxxxxxx",
        apiSecret: "",
        baseUrl: "https://api.coingecko.com/api/v3",
        provider: "CoinGecko",
        category: "price_feed",
        enabled: true,
        rateLimit: 30,
        lastUsed: "2026-10-10T12:00:00Z",
        createdAt: "2026-09-01T00:00:00Z",
      },
      {
        id: "api_2",
        name: "Binance Exchange API",
        description: "API untuk trading dan data market Binance",
        apiKey: "binance-api-key-xxxxxxxxxxxx",
        apiSecret: "binance-secret-xxxxxxxxxxxx",
        baseUrl: "https://api.binance.com/api/v3",
        provider: "Binance",
        category: "exchange",
        enabled: true,
        rateLimit: 60,
        lastUsed: "2026-10-10T11:30:00Z",
        createdAt: "2026-09-05T00:00:00Z",
      },
      {
        id: "api_3",
        name: "OpenAI GPT API",
        description: "API untuk AI trading agent dan analisis pasar",
        apiKey: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
        apiSecret: "",
        baseUrl: "https://api.openai.com/v1",
        provider: "OpenAI",
        category: "ai",
        enabled: false,
        rateLimit: 20,
        lastUsed: null,
        createdAt: "2026-09-10T00:00:00Z",
      },
    ],
    categories: ["price_feed", "exchange", "ai", "blockchain", "notification", "analytics"],
  },
  storage: {
    enabled: false,
    provider: "aws_s3",
    s3: {
      region: "ap-southeast-1",
      endpoint: "",
      accessKeyId: "",
      secretAccessKey: "",
      publicBucket: "panti-janda-public",
      privateBucket: "panti-janda-private",
      cdnUrl: "",
      maxFileSizeMB: 10,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "application/pdf"],
    },
    cloudinary: {
      cloudName: "",
      apiKey: "",
      apiSecret: "",
      uploadPreset: "panti_janda",
      folder: "panti-janda",
    },
    optimization: {
      enabled: true,
      provider: "cloudinary",
      autoFormat: true,
      autoQuality: true,
      thumbnailSizes: [200, 400, 800],
    },
    security: {
      presignedUrlExpirySeconds: 300,
      requireOwnershipForPrivate: true,
      scanForMalware: false,
    },
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
  const { payment, shipping, subscription, academy, trading, links, liveTrading, metaTrader5, aiTradingAgent, coinSettings, blockchainApi, trialAccounts, cryptoSettings, apiManagement, storage } = ctx.body ?? {};
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
    for (const tier of ["sosialita", "high_society", "the_ceo", "ceo", "sultan"]) {
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
  if (cryptoSettings) {
    if (Array.isArray(cryptoSettings.treasuryWallets)) {
      APP_SETTINGS.cryptoSettings.treasuryWallets = cryptoSettings.treasuryWallets
        .filter((w) => w && typeof w.coinSymbol === "string" && typeof w.address === "string")
        .map((w) => ({
          id: w.id || `tw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          coinSymbol: String(w.coinSymbol).toUpperCase(),
          network: String(w.network || ""),
          address: String(w.address),
          label: String(w.label || w.coinSymbol),
          balance: typeof w.balance === "number" ? Math.max(0, w.balance) : 0,
          enabled: w.enabled !== false,
        }));
    }
    if (cryptoSettings.distribution && typeof cryptoSettings.distribution === "object") {
      const d = cryptoSettings.distribution;
      const cur = APP_SETTINGS.cryptoSettings.distribution;
      if (typeof d.autoCreditOnDeposit === "boolean") cur.autoCreditOnDeposit = d.autoCreditOnDeposit;
      if (typeof d.minConfirmations === "number") cur.minConfirmations = Math.max(1, Math.min(100, Math.floor(d.minConfirmations)));
      if (typeof d.maxDailyWithdrawCrypto === "number") cur.maxDailyWithdrawCrypto = Math.max(0, d.maxDailyWithdrawCrypto);
      if (typeof d.maxDailySwapCoins === "number") cur.maxDailySwapCoins = Math.max(0, d.maxDailySwapCoins);
      if (typeof d.enableAutoSwap === "boolean") cur.enableAutoSwap = d.enableAutoSwap;
      if (typeof d.defaultSwapSlippagePercent === "number") cur.defaultSwapSlippagePercent = Math.max(0, Math.min(50, d.defaultSwapSlippagePercent));
    }
    if (cryptoSettings.globalFees && typeof cryptoSettings.globalFees === "object") {
      const f = cryptoSettings.globalFees;
      const cur = APP_SETTINGS.cryptoSettings.globalFees;
      if (typeof f.depositFeePercent === "number") cur.depositFeePercent = Math.max(0, Math.min(50, f.depositFeePercent));
      if (typeof f.withdrawFeePercent === "number") cur.withdrawFeePercent = Math.max(0, Math.min(50, f.withdrawFeePercent));
      if (typeof f.swapFeePercent === "number") cur.swapFeePercent = Math.max(0, Math.min(50, f.swapFeePercent));
      if (typeof f.minDepositUsd === "number") cur.minDepositUsd = Math.max(0, f.minDepositUsd);
      if (typeof f.minWithdrawUsd === "number") cur.minWithdrawUsd = Math.max(0, f.minWithdrawUsd);
    }
    if (cryptoSettings.notifications && typeof cryptoSettings.notifications === "object") {
      const n = cryptoSettings.notifications;
      const cur = APP_SETTINGS.cryptoSettings.notifications;
      if (typeof n.notifyOnLargeDeposit === "boolean") cur.notifyOnLargeDeposit = n.notifyOnLargeDeposit;
      if (typeof n.largeDepositThresholdUsd === "number") cur.largeDepositThresholdUsd = Math.max(0, n.largeDepositThresholdUsd);
      if (typeof n.notifyOnWithdraw === "boolean") cur.notifyOnWithdraw = n.notifyOnWithdraw;
      if (typeof n.notifyOnLowTreasury === "boolean") cur.notifyOnLowTreasury = n.notifyOnLowTreasury;
      if (typeof n.lowTreasuryThresholdUsd === "number") cur.lowTreasuryThresholdUsd = Math.max(0, n.lowTreasuryThresholdUsd);
    }
  }
  if (apiManagement) {
    if (Array.isArray(apiManagement.apis)) {
      const validCategories = new Set(APP_SETTINGS.apiManagement.categories);
      APP_SETTINGS.apiManagement.apis = apiManagement.apis.map((a) => ({
        id: typeof a.id === "string" && a.id ? a.id : `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: typeof a.name === "string" ? a.name.trim().slice(0, 100) : "Untitled API",
        description: typeof a.description === "string" ? a.description.trim().slice(0, 500) : "",
        apiKey: typeof a.apiKey === "string" ? a.apiKey.trim().slice(0, 500) : "",
        apiSecret: typeof a.apiSecret === "string" ? a.apiSecret.trim().slice(0, 500) : "",
        baseUrl: typeof a.baseUrl === "string" ? a.baseUrl.trim().slice(0, 500) : "",
        provider: typeof a.provider === "string" ? a.provider.trim().slice(0, 100) : "",
        category: typeof a.category === "string" && validCategories.has(a.category) ? a.category : "other",
        enabled: typeof a.enabled === "boolean" ? a.enabled : true,
        rateLimit: typeof a.rateLimit === "number" ? Math.max(1, Math.min(10000, Math.floor(a.rateLimit))) : 60,
        lastUsed: typeof a.lastUsed === "string" ? a.lastUsed : null,
        createdAt: typeof a.createdAt === "string" ? a.createdAt : new Date().toISOString(),
      }));
    }
    if (Array.isArray(apiManagement.categories)) {
      APP_SETTINGS.apiManagement.categories = apiManagement.categories
        .filter((c) => typeof c === "string" && c.trim())
        .map((c) => c.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 50));
    }
  }
  if (storage) {
    if (typeof storage.enabled === "boolean") APP_SETTINGS.storage.enabled = storage.enabled;
    if (["aws_s3", "digitalocean_spaces", "minio", "cloudinary"].includes(storage.provider)) {
      APP_SETTINGS.storage.provider = storage.provider;
    }
    if (storage.s3) {
      const s3 = storage.s3;
      if (typeof s3.region === "string") APP_SETTINGS.storage.s3.region = s3.region.slice(0, 50);
      if (typeof s3.endpoint === "string") APP_SETTINGS.storage.s3.endpoint = s3.endpoint.slice(0, 500);
      if (typeof s3.accessKeyId === "string") APP_SETTINGS.storage.s3.accessKeyId = s3.accessKeyId.slice(0, 200);
      if (typeof s3.secretAccessKey === "string") APP_SETTINGS.storage.s3.secretAccessKey = s3.secretAccessKey.slice(0, 200);
      if (typeof s3.publicBucket === "string") APP_SETTINGS.storage.s3.publicBucket = s3.publicBucket.slice(0, 100);
      if (typeof s3.privateBucket === "string") APP_SETTINGS.storage.s3.privateBucket = s3.privateBucket.slice(0, 100);
      if (typeof s3.cdnUrl === "string") APP_SETTINGS.storage.s3.cdnUrl = s3.cdnUrl.slice(0, 500);
      if (typeof s3.maxFileSizeMB === "number" && s3.maxFileSizeMB > 0) {
        APP_SETTINGS.storage.s3.maxFileSizeMB = Math.min(100, Math.floor(s3.maxFileSizeMB));
      }
      if (Array.isArray(s3.allowedMimeTypes)) {
        APP_SETTINGS.storage.s3.allowedMimeTypes = s3.allowedMimeTypes.filter((m) => typeof m === "string").slice(0, 50);
      }
    }
    if (storage.cloudinary) {
      const c = storage.cloudinary;
      if (typeof c.cloudName === "string") APP_SETTINGS.storage.cloudinary.cloudName = c.cloudName.slice(0, 100);
      if (typeof c.apiKey === "string") APP_SETTINGS.storage.cloudinary.apiKey = c.apiKey.slice(0, 200);
      if (typeof c.apiSecret === "string") APP_SETTINGS.storage.cloudinary.apiSecret = c.apiSecret.slice(0, 200);
      if (typeof c.uploadPreset === "string") APP_SETTINGS.storage.cloudinary.uploadPreset = c.uploadPreset.slice(0, 100);
      if (typeof c.folder === "string") APP_SETTINGS.storage.cloudinary.folder = c.folder.slice(0, 200);
    }
    if (storage.optimization) {
      const o = storage.optimization;
      if (typeof o.enabled === "boolean") APP_SETTINGS.storage.optimization.enabled = o.enabled;
      if (["cloudinary", "imagekit", "none"].includes(o.provider)) {
        APP_SETTINGS.storage.optimization.provider = o.provider;
      }
      if (typeof o.autoFormat === "boolean") APP_SETTINGS.storage.optimization.autoFormat = o.autoFormat;
      if (typeof o.autoQuality === "boolean") APP_SETTINGS.storage.optimization.autoQuality = o.autoQuality;
      if (Array.isArray(o.thumbnailSizes)) {
        APP_SETTINGS.storage.optimization.thumbnailSizes = o.thumbnailSizes
          .filter((s) => typeof s === "number" && s > 0 && s <= 2000)
          .map((s) => Math.floor(s))
          .slice(0, 10);
      }
    }
    if (storage.security) {
      const s = storage.security;
      if (typeof s.presignedUrlExpirySeconds === "number" && s.presignedUrlExpirySeconds > 0) {
        APP_SETTINGS.storage.security.presignedUrlExpirySeconds = Math.min(3600, Math.floor(s.presignedUrlExpirySeconds));
      }
      if (typeof s.requireOwnershipForPrivate === "boolean") {
        APP_SETTINGS.storage.security.requireOwnershipForPrivate = s.requireOwnershipForPrivate;
      }
      if (typeof s.scanForMalware === "boolean") APP_SETTINGS.storage.security.scanForMalware = s.scanForMalware;
    }
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

async function aiSubAgentsList(ctx) {
  return ok({ subAgents: APP_SETTINGS.aiTradingAgent.subAgents || [] });
}

async function aiSubAgentsUpdate(ctx) {
  const { body } = ctx;
  const id = typeof body.id === "string" ? body.id : "";
  const agent = (APP_SETTINGS.aiTradingAgent.subAgents || []).find((a) => a.id === id);
  if (!agent) return fail(404, "sub_agent_not_found");
  if (typeof body.name === "string") agent.name = body.name;
  if (typeof body.icon === "string") agent.icon = body.icon;
  if (typeof body.description === "string") agent.description = body.description;
  if (typeof body.status === "string") agent.status = body.status;
  if (typeof body.priority === "number") agent.priority = body.priority;
  if (typeof body.intervalSeconds === "number") agent.intervalSeconds = body.intervalSeconds;
  if (typeof body.enabled === "boolean") agent.enabled = body.enabled;
  if (body.config && typeof body.config === "object") agent.config = body.config;
  return ok({ subAgent: agent });
}

async function aiTradingServersList(ctx) {
  return ok({ tradingServers: APP_SETTINGS.aiTradingAgent.tradingServers || [] });
}

async function aiTradingServersUpdate(ctx) {
  const { body } = ctx;
  const id = typeof body.id === "string" ? body.id : "";
  const server = (APP_SETTINGS.aiTradingAgent.tradingServers || []).find((s) => s.id === id);
  if (!server) return fail(404, "server_not_found");
  if (typeof body.name === "string") server.name = body.name;
  if (typeof body.provider === "string") server.provider = body.provider;
  if (typeof body.description === "string") server.description = body.description;
  if (typeof body.baseUrl === "string") server.baseUrl = body.baseUrl;
  if (typeof body.wsUrl === "string") server.wsUrl = body.wsUrl;
  if (typeof body.apiKey === "string") server.apiKey = body.apiKey;
  if (typeof body.apiSecret === "string") server.apiSecret = body.apiSecret;
  if (typeof body.testnet === "boolean") server.testnet = body.testnet;
  if (typeof body.enabled === "boolean") server.enabled = body.enabled;
  if (typeof body.rateLimit === "number") server.rateLimit = body.rateLimit;
  if (Array.isArray(body.symbols)) server.symbols = body.symbols;
  if (Array.isArray(body.features)) server.features = body.features;
  return ok({ tradingServer: server });
}

async function aiPromptsList(ctx) {
  return ok({ prompts: APP_SETTINGS.aiTradingAgent.promptLibrary || [] });
}

async function aiPromptsGet(ctx) {
  const { body } = ctx;
  const id = typeof body.id === "string" ? body.id : "";
  const prompt = (APP_SETTINGS.aiTradingAgent.promptLibrary || []).find((p) => p.id === id);
  if (!prompt) return fail(404, "prompt_not_found");
  return ok({ prompt });
}

async function aiPromptsCreate(ctx) {
  const { body } = ctx;
  const now = new Date().toISOString();
  const prompt = {
    id: `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: typeof body.name === "string" ? body.name : "Untitled Prompt",
    category: typeof body.category === "string" ? body.category : "market_analysis",
    description: typeof body.description === "string" ? body.description : "",
    prompt: typeof body.prompt === "string" ? body.prompt : "",
    variables: Array.isArray(body.variables) ? body.variables : [],
    enabled: typeof body.enabled === "boolean" ? body.enabled : true,
    priority: typeof body.priority === "number" ? body.priority : 5,
    subAgentRoles: Array.isArray(body.subAgentRoles) ? body.subAgentRoles : [],
    createdAt: now,
    updatedAt: now,
  };
  if (!APP_SETTINGS.aiTradingAgent.promptLibrary) APP_SETTINGS.aiTradingAgent.promptLibrary = [];
  APP_SETTINGS.aiTradingAgent.promptLibrary.push(prompt);
  return ok({ prompt });
}

async function aiPromptsUpdate(ctx) {
  const { body } = ctx;
  const id = typeof body.id === "string" ? body.id : "";
  const prompt = (APP_SETTINGS.aiTradingAgent.promptLibrary || []).find((p) => p.id === id);
  if (!prompt) return fail(404, "prompt_not_found");
  if (typeof body.name === "string") prompt.name = body.name;
  if (typeof body.category === "string") prompt.category = body.category;
  if (typeof body.description === "string") prompt.description = body.description;
  if (typeof body.prompt === "string") prompt.prompt = body.prompt;
  if (Array.isArray(body.variables)) prompt.variables = body.variables;
  if (typeof body.enabled === "boolean") prompt.enabled = body.enabled;
  if (typeof body.priority === "number") prompt.priority = body.priority;
  if (Array.isArray(body.subAgentRoles)) prompt.subAgentRoles = body.subAgentRoles;
  prompt.updatedAt = new Date().toISOString();
  return ok({ prompt });
}

async function aiPromptsDelete(ctx) {
  const { body } = ctx;
  const id = typeof body.id === "string" ? body.id : "";
  const idx = (APP_SETTINGS.aiTradingAgent.promptLibrary || []).findIndex((p) => p.id === id);
  if (idx === -1) return fail(404, "prompt_not_found");
  APP_SETTINGS.aiTradingAgent.promptLibrary.splice(idx, 1);
  return ok({ deleted: true });
}

async function coinSettingsPublic(ctx) {
  return ok({ coinSettings: APP_SETTINGS.coinSettings });
}

// ---------- cloud storage ----------

async function storagePresignedUpload(ctx) {
  const auth = await actor(ctx, 1);
  if (auth.error) return auth.error;
  const { fileName, mimeType, fileSize, bucketType } = ctx.body ?? {};
  if (!fileName || typeof fileName !== "string") return fail(400, "missing_file_name");
  if (!mimeType || typeof mimeType !== "string") return fail(400, "missing_mime_type");
  if (!fileSize || typeof fileSize !== "number" || fileSize <= 0) return fail(400, "invalid_file_size");
  if (!bucketType || !["public", "private"].includes(bucketType)) return fail(400, "invalid_bucket_type");

  const storage = APP_SETTINGS.storage;
  if (!storage.enabled) return fail(403, "storage_disabled");

  const maxBytes = (storage.s3.maxFileSizeMB || 10) * 1024 * 1024;
  if (fileSize > maxBytes) return fail(400, "file_too_large", { maxBytes });

  const allowedTypes = storage.s3.allowedMimeTypes || [];
  if (allowedTypes.length > 0 && !allowedTypes.includes(mimeType)) {
    return fail(400, "invalid_mime_type", { allowed: allowedTypes });
  }

  const bucket = bucketType === "public" ? storage.s3.publicBucket : storage.s3.privateBucket;
  const key = `${auth.account.id}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const presignedUrl = `https://${bucket}.s3.${storage.s3.region}.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&mock=true`;
  const publicUrl = storage.s3.cdnUrl
    ? `${storage.s3.cdnUrl}/${key}`
    : `https://${bucket}.s3.${storage.s3.region}.amazonaws.com/${key}`;

  return ok({
    presignedUrl,
    publicUrl: bucketType === "public" ? publicUrl : null,
    key,
    bucket,
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
  });
}

async function storagePresignedDownload(ctx) {
  const auth = await actor(ctx, 1);
  if (auth.error) return auth.error;
  const { key, bucketType } = ctx.body ?? {};
  if (!key || typeof key !== "string") return fail(400, "missing_key");
  if (!bucketType || !["public", "private"].includes(bucketType)) return fail(400, "invalid_bucket_type");

  const storage = APP_SETTINGS.storage;
  if (!storage.enabled) return fail(403, "storage_disabled");

  const bucket = bucketType === "public" ? storage.s3.publicBucket : storage.s3.privateBucket;

  if (bucketType === "private" && storage.security.requireOwnershipForPrivate) {
    if (!key.startsWith(auth.account.id + "/")) {
      return fail(403, "access_denied");
    }
  }

  const presignedUrl = `https://${bucket}.s3.${storage.s3.region}.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&mock=true`;

  return ok({
    presignedUrl,
    expiresInSeconds: storage.security.presignedUrlExpirySeconds || 300,
  });
}

async function storageValidateFile(ctx) {
  const { mimeType, fileSize, magicBytes } = ctx.body ?? {};
  if (!mimeType || typeof mimeType !== "string") return fail(400, "missing_mime_type");
  if (!fileSize || typeof fileSize !== "number" || fileSize <= 0) return fail(400, "invalid_file_size");

  const storage = APP_SETTINGS.storage;
  const maxBytes = (storage.s3.maxFileSizeMB || 10) * 1024 * 1024;
  if (fileSize > maxBytes) return fail(400, "file_too_large", { maxBytes });

  const allowedTypes = storage.s3.allowedMimeTypes || [];
  if (allowedTypes.length > 0 && !allowedTypes.includes(mimeType)) {
    return fail(400, "invalid_mime_type", { allowed: allowedTypes });
  }

  if (magicBytes && typeof magicBytes === "string") {
    const valid = validateMagicBytes(mimeType, magicBytes);
    if (!valid) return fail(400, "invalid_file_content");
  }

  return ok({ valid: true });
}

function validateMagicBytes(mimeType, magicBytes) {
  const signatures = {
    "image/jpeg": ["ffd8ff"],
    "image/png": ["89504e47"],
    "image/webp": ["52494646"],
    "image/gif": ["47494638"],
    "video/mp4": ["0000001c", "00000020", "66747970"],
    "application/pdf": ["25504446"],
  };
  const expected = signatures[mimeType];
  if (!expected) return true;
  const bytes = magicBytes.toLowerCase().replace(/s/g, "");
  return expected.some((sig) => bytes.startsWith(sig));
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
