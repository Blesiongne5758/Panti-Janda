import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const BUCKET = "chat-attachments";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ROLE_RANK: Record<string, number> = {
  public: 1, kades: 2, wonder_woman: 2, walikota: 3, sosialita: 3,
  gubernur: 4, high_society: 4, panglima: 5, the_ceo: 5, presiden: 6,
  sultan: 6, ceo: 7, admin: 8,
};
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  rar: "application/vnd.rar",
};
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const CHAT_KEY = new RegExp(`^(${UUID})/(${UUID})\\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar)$`, "i");
const SIGNATURES: Readonly<Record<string, string[]>> = {
  "application/pdf": ["25504446"],
  "application/msword": ["d0cf11e0"],
  "application/vnd.ms-excel": ["d0cf11e0"],
  "application/vnd.ms-powerpoint": ["d0cf11e0"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["504b0304"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["504b0304"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["504b0304"],
  "application/zip": ["504b0304"],
  "application/vnd.rar": ["526172211a07"],
};
const enc = new TextEncoder();
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-app-session, x-client-info",
  "cache-control": "no-store",
};

function reply(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
function ok(data: unknown): Response {
  return reply({ ok: true, data });
}
function fail(status: number, error: string): Response {
  return reply({ ok: false, error }, status);
}
function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function isSafeTextPrefix(bytes: Uint8Array): boolean {
  return !bytes.some((byte) => byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13));
}
function validateMagicBytes(mimeType: string, magicBytes: string): boolean {
  if (!/^(?:[0-9a-f]{2}){1,16}$/i.test(magicBytes)) return false;
  const bytes = Uint8Array.from(magicBytes.match(/.{2}/g) ?? [], (value) => parseInt(value, 16));
  const expected = SIGNATURES[mimeType];
  if (expected) return expected.some((signature) => magicBytes.toLowerCase().startsWith(signature));
  if (mimeType === "text/plain" || mimeType === "text/csv") return isSafeTextPrefix(bytes);
  return false;
}
function attachmentMetadata(body: unknown): { url: string; name: string; size: number; mimeType: string } | null {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body);
    const file = parsed?.__attachment === true ? parsed.attachment : null;
    if (file?.type !== "file" || typeof file.url !== "string") return null;
    return {
      url: file.url,
      name: text(file.name, 180),
      size: Number.isSafeInteger(file.size) ? file.size : 0,
      mimeType: text(file.mimeType, 120),
    };
  } catch {
    return null;
  }
}
function fileDetails(fileName: unknown, mimeValue: unknown, sizeValue: unknown, magicValue: unknown) {
  const name = text(fileName, 180);
  const mimeType = text(mimeValue, 120).toLowerCase();
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const fileSize = Number(sizeValue);
  const magicBytes = text(magicValue, 32).toLowerCase();
  if (!name || !name.includes(".") || MIME_BY_EXTENSION[extension] !== mimeType) return null;
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_FILE_BYTES) return null;
  if (!validateMagicBytes(mimeType, magicBytes)) return null;
  return { name, extension, mimeType, fileSize, magicBytes };
}
async function authenticate(supabase: ReturnType<typeof createClient>, request: Request) {
  const token = request.headers.get("x-app-session");
  if (!token || token.length > 200) return null;
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(token));
  const tokenHash = hex(new Uint8Array(digest));
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id,account_id,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (sessionError || !session || Date.parse(session.expires_at) <= Date.now()) return null;
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id,role,status")
    .eq("id", session.account_id)
    .maybeSingle();
  if (accountError || account?.status !== "active" || (ROLE_RANK[account.role] ?? 0) < 1) return null;
  return account as { id: string; role: string; status: string };
}
async function loadObject(supabase: ReturnType<typeof createClient>, key: string, expectedSize?: number) {
  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error || !data || data.size < 1 || data.size > MAX_FILE_BYTES) return null;
  if (expectedSize && expectedSize !== data.size) return null;
  const actualMime = MIME_BY_EXTENSION[key.split(".").pop()?.toLowerCase() ?? ""];
  if (!actualMime) return null;
  const prefix = hex(new Uint8Array(await data.slice(0, 16).arrayBuffer()));
  if (!validateMagicBytes(actualMime, prefix)) return null;
  return { blob: data, mimeType: actualMime };
}
async function findSharedMessage(
  supabase: ReturnType<typeof createClient>,
  viewerId: string,
  ownerId: string,
  key: string,
) {
  const { data: rows, error } = await supabase
    .from("messages")
    .select("body,thread_kind,recipient_account_id,group_id")
    .eq("sender_account_id", ownerId)
    .like("body", `%${key}%`)
    .limit(20);
  if (error) return { error: true as const, message: null };
  for (const row of rows ?? []) {
    const attachment = attachmentMetadata(row.body);
    if (!attachment || attachment.url !== key) continue;
    if (row.thread_kind === "dm" && row.recipient_account_id === viewerId) {
      return { error: false as const, message: attachment };
    }
    if (row.thread_kind === "group" && row.group_id) {
      const { data: member, error: memberError } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", row.group_id)
        .eq("account_id", viewerId)
        .maybeSingle();
      if (memberError) return { error: true as const, message: null };
      if (member) return { error: false as const, message: attachment };
    }
  }
  return { error: false as const, message: null };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return fail(405, "method_not_allowed");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return fail(500, "server_misconfigured");

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const account = await authenticate(supabase, request);
    if (!account) return fail(401, "not_authenticated");

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return fail(400, "invalid_json");
    const action = text(body.action, 80);

    if (action === "chatStorage.validate" || action === "chatStorage.upload") {
      const details = fileDetails(body.fileName, body.mimeType, body.fileSize, body.magicBytes);
      if (!details) return fail(400, "invalid_attachment");
      if (action === "chatStorage.validate") return ok({ valid: true, mimeType: details.mimeType, maxBytes: MAX_FILE_BYTES });

      const key = `${account.id}/${crypto.randomUUID()}.${details.extension}`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(key, { upsert: false });
      if (error || !data?.token) return fail(503, "storage_unavailable");
      return ok({
        provider: "supabase",
        bucket: BUCKET,
        key,
        mimeType: details.mimeType,
        uploadToken: data.token,
        presignedUrl: "",
        publicUrl: null,
        method: "PUT",
        headers: { "Content-Type": details.mimeType },
      });
    }

    if (action === "chatStorage.verifyUpload") {
      const key = text(body.key, 200);
      const match = CHAT_KEY.exec(key);
      if (!match || match[1].toLowerCase() !== account.id.toLowerCase()) return fail(403, "access_denied");
      const expectedSize = Number(body.fileSize);
      const stored = await loadObject(supabase, key, expectedSize);
      if (!stored) return fail(400, "invalid_attachment");
      return ok({ verified: true, key, mimeType: stored.mimeType, size: stored.blob.size });
    }

    if (action === "chatStorage.download") {
      const key = text(body.key, 200);
      const match = CHAT_KEY.exec(key);
      if (!match) return fail(404, "not_found");
      const ownerId = match[1];
      const shared = await findSharedMessage(supabase, account.id, ownerId, key);
      if (shared.error) return fail(500, "server_error");
      if (ownerId.toLowerCase() !== account.id.toLowerCase() && !shared.message) {
        return fail(403, "access_denied");
      }
      const stored = await loadObject(supabase, key, shared.message?.size);
      if (!stored) return fail(404, "attachment_unavailable");
      const filename = shared.message?.name || `dokumen.${match[3].toLowerCase()}`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, 300, { download: filename });
      if (error || !data?.signedUrl) return fail(503, "storage_unavailable");
      return ok({ presignedUrl: data.signedUrl, expiresInSeconds: 300 });
    }

    return fail(400, "invalid_action");
  } catch (error) {
    console.error("chat-storage error:", error instanceof Error ? error.message : "unknown");
    return fail(500, "server_error");
  }
});
