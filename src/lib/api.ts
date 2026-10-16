// App API client for the same-origin `app` Function.
// Response contract: { ok: true, data } | { ok: false, error: <code> }.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 0,
    readonly detail: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Localized, app-owned messages keyed by public error code.
const MESSAGES: Readonly<Record<string, string>> = {
  invalid_email: "Format email tidak valid.",
  weak_password: "Kata sandi minimal 8 karakter.",
  email_taken: "Email sudah terdaftar. Silakan masuk.",
  invalid_nickname: "Nama panggilan minimal 2 karakter.",
  invalid_display_name: "Nama tampilan minimal 2 karakter.",
  invalid_full_name: "Nama lengkap minimal 2 karakter.",
  verification_doc_required: "Dokumen verifikasi (foto KTP atau dokumen pengadilan) wajib diunggah.",
  invalid_verification_doc: "Dokumen verifikasi tidak valid. Gunakan foto JPG, PNG, atau WebP maksimal 8 MB.",
  invalid_photo: "Foto profil tidak valid. Gunakan gambar JPG, PNG, atau WebP maksimal 8 MB.",
  invalid_credentials: "Email atau kata sandi salah.",
  account_suspended: "Akun ini sedang dinonaktifkan. Hubungi admin.",
  not_authenticated: "Silakan masuk terlebih dahulu.",
  access_denied: "Sesi Anda tidak berlaku lagi. Silakan masuk kembali.",
  forbidden: "Anda tidak memiliki akses untuk tindakan ini.",
  not_found: "Data tidak ditemukan atau belum tersedia untuk Anda.",
  invalid_input: "Isian belum lengkap atau tidak valid.",
  invalid_name: "Nama minimal 2 karakter.",
  profile_not_verified: "Profil Anda belum diverifikasi admin, jadi belum bisa membuat kabar.",
  members_only: "Konten ini khusus anggota terverifikasi Panti Janda.",
  group_members_only: "Grup chat ini hanya untuk anggota grup.",
  cannot_follow_self: "Anda tidak dapat mengikuti akun sendiri.",
  cannot_message_self: "Anda tidak dapat mengirim pesan ke akun sendiri.",
  invitation_only: "Event ini hanya untuk anggota yang diundang.",
  event_full: "Kuota event sudah penuh.",
  group_full: "Kuota grup sudah penuh.",
  program_full: "Kuota program sudah penuh.",
  account_not_found: "Akun dengan email tersebut tidak ditemukan.",
  invite_members_only: "Undangan hanya untuk anggota janda yang sudah terdaftar.",
  invalid_role: "Peran yang dipilih tidak valid.",
  invalid_status: "Status yang dipilih tidak valid.",
  cannot_modify_self: "Anda tidak dapat mengubah akun sendiri.",
  cannot_modify_admin: "Akun admin tidak dapat diubah.",
  member_profile_required: "Peran anggota memerlukan profil janda terlebih dahulu.",
  service_not_configured: "Pembayaran online belum aktif. Gunakan formulir komitmen dukungan.",
  gateway_error: "Gagal terhubung ke layanan pembayaran. Coba lagi atau gunakan formulir komitmen.",
  invalid_signature: "Notifikasi pembayaran tidak valid.",
  method_not_allowed: "Permintaan tidak valid.",
  invalid_json: "Permintaan tidak valid.",
  invalid_action: "Permintaan tidak valid.",
  server_error: "Terjadi kendala di server. Coba lagi sebentar lagi.",
  write_rejected: "Perubahan ditolak saat disimpan.",
  network_error: "Koneksi bermasalah. Periksa jaringan lalu coba lagi.",
  invalid_response: "Layanan mengembalikan respons tak terduga.",
  request_failed: "Permintaan gagal. Periksa lagi sebelum mengulang.",
  ticket_not_found: "Tiket tidak ditemukan.",
  ticket_already_used: "Tiket sudah digunakan.",
  ticket_not_valid: "Tiket belum berlaku atau sudah dibatalkan.",
  invalid_ticket_code: "Kode tiket tidak valid.",
  not_committee: "Anda bukan panitia event ini.",
  event_not_paid: "Event ini bukan event berbayar.",
  event_is_free: "Event ini gratis. Gunakan RSVP untuk mendaftar.",
  event_is_paid: "Event ini berbayar. Silakan beli tiket terlebih dahulu.",
  already_purchased: "Anda sudah membeli tiket untuk event ini.",
  already_committee: "Anggota ini sudah menjadi panitia.",
  committee_members_only: "Panitia harus akun aktif anggota (janda atau mitra non-janda).",
  cannot_remove_chair: "Ketua panitia tidak dapat dihapus dari struktur kepanitiaan.",
  cannot_change_chair: "Peran ketua panitia tidak dapat diubah.",
  invite_not_found: "Undangan tidak ditemukan pada event ini.",
  invite_already_used: "Undangan ini sudah dipindai sebelumnya.",
  not_invite_scanner: "Hanya ketua panitia atau panitia Absen Undangan yang dapat memindai undangan.",
  invalid_invite_code: "Kode QR undangan tidak valid.",
  not_group_member: "Anggota ini bukan anggota grup yang ditentukan.",
  already_subscribed: "Anda sudah memiliki langganan aktif.",
  invalid_tier: "Tier langganan yang dipilih tidak valid.",
  not_active: "Langganan ini tidak dalam status aktif.",
  publish_incomplete: "Event belum bisa dipublikasikan — masih ada bagian yang harus dilengkapi.",
  approval_pending: "Event ini sedang menunggu persetujuan admin.",
  not_virtual: "Fitur live hanya tersedia untuk event online atau hybrid.",
  tier_sold_out: "Kuota tier tiket ini sudah habis.",
  tier_not_open: "Penjualan tier tiket ini belum dibuka.",
  tier_closed: "Masa penjualan tier tiket ini sudah berakhir.",
  team_name_taken: "Nama tim sudah dipakai. Pilih nama lain.",
  not_team_captain: "Hanya kapten tim yang dapat melakukan tindakan ini.",
  cannot_remove_captain: "Kapten tim tidak dapat dikeluarkan dari tim.",
  already_team_member: "Anggota ini sudah bergabung ke tim.",
  member_limit_reached: "Jumlah anggota tim sudah mencapai batas maksimal.",
  registration_closed: "Pendaftaran turnamen ini sudah ditutup.",
  tournament_full: "Kuota tim turnamen ini sudah penuh.",
  already_registered: "Tim ini sudah terdaftar di turnamen tersebut.",
  roster_too_small: "Jumlah pemain dalam roster kurang dari ketentuan turnamen.",
  roster_too_large: "Jumlah pemain dalam roster melebihi ketentuan turnamen.",
  roster_not_member: "Semua pemain roster harus anggota tim terlebih dahulu.",
  player_registered_elsewhere: "Ada pemain yang sudah terdaftar di tim lain pada turnamen ini.",
  invalid_seeding: "Mode pengundian tidak valid atau nomor unggulan belum lengkap.",
  bracket_not_ready: "Bagan belum bisa dibuat — peserta belum memenuhi syarat.",
  bracket_exists: "Bagan sudah dibuat sebelumnya. Hapus atau selesaikan dulu pertandingan yang ada.",
  groups_incomplete: "Fase grup belum selesai seluruhnya. Selesaikan semua pertandingan grup dulu.",
  no_matches: "Tidak ada pertandingan yang cocok dengan filter.",
  match_finished: "Pertandingan ini sudah selesai dan tidak dapat diubah lagi.",
  match_cancelled: "Pertandingan ini dibatalkan otomatis karena kedua tim tidak check-in. Hubungi penyelenggara untuk penjadwalan ulang.",
  match_not_ready: "Pertandingan belum siap — tim peserta belum lengkap.",
  invalid_score: "Skor tidak valid.",
  tied_score: "Skor tidak boleh seri pada format best-of. Tentukan pemenangnya.",
  invalid_score_bestof: "Skor tidak sesuai format best-of yang berlaku.",
  checkin_not_open: "Belum waktunya check-in. Coba lagi mendekati jadwal pertandingan.",
  not_match_participant: "Anda bukan kapten tim yang bertanding di pertandingan ini.",
  dispute_exists: "Sudah ada sengketa terbuka untuk pertandingan ini.",
  downstream_locked: "Pertandingan lanjutan sudah dimainkan, skor tidak bisa diubah otomatis.",
  invalid_prize: "Data hadiah tidak valid.",
  invalid_transition: "Perubahan status ini tidak diizinkan dari status turnamen saat ini.",
  invalid_format: "Aksi ini tidak berlaku untuk format turnamen ini.",
  round_incomplete: "Ronde saat ini belum selesai seluruhnya. Selesaikan semua pertandingannya dulu.",
  approval_required: "Hadiah turnamen melebihi ambang batas — menunggu persetujuan admin sebelum pendaftaran dibuka.",
  invalid_schedule_title: "Judul jadwal wajib diisi (maksimal 100 karakter).",
  invalid_schedule_date: "Tanggal jadwal tidak valid.",
  invalid_schedule_time: "Jam jadwal tidak valid — pastikan jam selesai setelah jam mulai.",
  transfer_window_closed: "Jendela transfer untuk game ini sedang ditutup. Tunggu sampai jendela berikutnya dibuka.",
  already_listed: "Pemain ini sudah punya tawaran bursa yang aktif (terbuka atau dijeda).",
  offer_pending: "Tim Anda masih memiliki tawaran berjalan untuk pemain ini. Tarik atau tunggu jawabannya dulu.",
  captain_cannot_be_listed: "Kapten tim tidak dapat dimasukkan ke bursa transfer.",
  own_listing_offer: "Anda tidak dapat menawar pemain yang Anda sendiri daftarkan.",
  own_team_offer: "Pemain ini sudah berada di tim Anda.",
  not_team_member: "Pemain ini bukan anggota tim yang dipilih.",
  insufficient_balance: "Saldo koin tidak mencukupi.",
  already_exists: "Profil pemain untuk game ini sudah ada. Edit profil yang tersedia.",
};

export const PUBLISH_MISSING_LABEL: Readonly<Record<string, string>> = {
  plan: "Rencana acara (tujuan & target peserta) belum lengkap",
  budget_items: "Anggaran biaya belum memiliki item",
  funding_deficit: "Sumber dana belum mencukupi total anggaran",
  rundown: "Rundown / sesi acara belum terisi",
};

export const PUBLISH_READY_LABEL: Readonly<Record<string, string>> = {
  plan: "Rencana acara lengkap (tujuan & target peserta)",
  budget_items: "Anggaran biaya sudah memiliki item",
  funding_deficit: "Sumber dana mencukupi total anggaran",
  rundown: "Rundown / sesi acara terisi",
};

export function errorMissing(error: unknown): string[] {
  if (error instanceof ApiError && Array.isArray(error.detail?.missing)) {
    return (error.detail?.missing as unknown[]).filter((v): v is string => typeof v === "string");
  }
  return [];
}

const GENERIC_MESSAGE = "Terjadi kendala. Silakan coba lagi.";

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? error.message ?? GENERIC_MESSAGE;
  }
  return GENERIC_MESSAGE;
}

export async function requestJson(
  url: string,
  init: RequestInit = {},
  messages: Readonly<Record<string, string>> = MESSAGES,
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, credentials: "same-origin" });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(MESSAGES.network_error, "network_error");
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (response.redirected || (!data && !response.ok)) {
    throw new ApiError(MESSAGES.invalid_response, "invalid_response", response.status);
  }
  if (!data || typeof data !== "object") {
    throw new ApiError(MESSAGES.invalid_response, "invalid_response", response.status);
  }
  const body = data as Record<string, unknown>;
  // App failures are { ok: false, error: code }; keep the app-owned code even on 401/403.
  const appCode = body.ok === false && typeof body.error === "string" ? body.error : null;
  if (response.status === 401 || response.status === 403) {
    const code = appCode ?? "access_denied";
    throw new ApiError(messages[code] ?? MESSAGES[code] ?? GENERIC_MESSAGE, code, response.status, appCode ? body : null);
  }
  const code = appCode ?? (response.ok ? null : "request_failed");
  if (!response.ok || body.ok === false || code) {
    const resolved = code ?? "request_failed";
    throw new ApiError(messages[resolved] ?? MESSAGES[resolved] ?? GENERIC_MESSAGE, resolved, response.status, appCode ? body : null);
  }
  return body;
}

// A lost response cannot establish whether a mutation committed. Never replay it here.
export function isWriteOutcomeUnknown(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status === 401 || error.status === 403) return false;
  if (error.code === "write_rejected") return false;
  return (
    ["network_error", "invalid_response", "write_result_unknown"].includes(error.code) ||
    (error.status >= 500 && error.status < 600)
  );
}

const TOKEN_KEY = "pj.token";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode); the session simply does not persist.
  }
}

const NO_SESSION_CLEAR = new Set(["auth.login", "auth.register", "auth.logout"]);

export async function api<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = getToken();
  if (token) headers["x-app-session"] = token;
  try {
    const body = (await requestJson(
      "/functions/v1/app",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ action, ...payload }),
        signal: options.signal,
      },
      MESSAGES,
    )) as { data: T };
    return body.data;
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      !NO_SESSION_CLEAR.has(action) &&
      getToken()
    ) {
      setToken(null);
      window.dispatchEvent(new CustomEvent("pj:unauthorized"));
    }
    throw error;
  }
}
