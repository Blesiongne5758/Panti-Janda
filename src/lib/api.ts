// App API client for the same-origin `app` Function.
// Response contract: { ok: true, data } | { ok: false, error: <code> }.
export class ApiError extends Error {
  constructor(message: string, readonly code: string, readonly status: number = 0) {
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
  not_group_member: "Anggota ini bukan anggota grup yang ditentukan.",
  already_subscribed: "Anda sudah memiliki langganan aktif.",
  invalid_tier: "Tier langganan yang dipilih tidak valid.",
  not_active: "Langganan ini tidak dalam status aktif.",
};

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
    throw new ApiError(messages[code] ?? MESSAGES[code] ?? GENERIC_MESSAGE, code, response.status);
  }
  const code = appCode ?? (response.ok ? null : "request_failed");
  if (!response.ok || body.ok === false || code) {
    const resolved = code ?? "request_failed";
    throw new ApiError(messages[resolved] ?? MESSAGES[resolved] ?? GENERIC_MESSAGE, resolved, response.status);
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
