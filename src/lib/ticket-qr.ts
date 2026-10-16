// Payload QR tiket: "PJ-TICKET:<eventId>:<code>".
// Pemindai menerima payload ini, kode mentah, atau URL yang memuat kode tiket.
const PREFIX = "PJ-TICKET:";

export function buildTicketQrPayload(eventId: string, code: string): string {
  return `${PREFIX}${eventId}:${code}`;
}

export interface TicketQrPayload {
  eventId: string | null;
  code: string;
}

export function parseTicketQrPayload(raw: string): TicketQrPayload | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith(PREFIX)) {
    const rest = value.slice(PREFIX.length);
    const sep = rest.indexOf(":");
    if (sep <= 0) return null;
    const eventId = rest.slice(0, sep).trim();
    const code = rest.slice(sep + 1).trim();
    if (!eventId || !code) return null;
    return { eventId, code };
  }

  if (value.startsWith("PJ:")) {
    return { eventId: null, code: value };
  }

  try {
    const url = new URL(value);
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    const queryIndex = hash.indexOf("?");
    if (queryIndex >= 0) {
      const params = new URLSearchParams(hash.slice(queryIndex + 1));
      const code = params.get("code");
      if (code) {
        return { eventId: params.get("event") || null, code: code.trim() };
      }
    }
    const codeParam = url.searchParams.get("code");
    if (codeParam) {
      return { eventId: url.searchParams.get("event"), code: codeParam.trim() };
    }
  } catch {
    // bukan URL — abaikan
  }

  return null;
}

// Payload QR undangan: "PJ-INVITE:<eventId>:<inviteId>".
// Pemindai juga menerima ID undangan mentah atau URL yang memuat parameter invite.
const INVITE_PREFIX = "PJ-INVITE:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildInviteQrPayload(eventId: string, inviteId: string): string {
  return `${INVITE_PREFIX}${eventId}:${inviteId}`;
}

export interface InviteQrPayload {
  eventId: string | null;
  inviteId: string;
}

export function parseInviteQrPayload(raw: string): InviteQrPayload | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith(INVITE_PREFIX)) {
    const rest = value.slice(INVITE_PREFIX.length);
    const sep = rest.indexOf(":");
    if (sep <= 0) return null;
    const eventId = rest.slice(0, sep).trim();
    const inviteId = rest.slice(sep + 1).trim();
    if (!eventId || !inviteId) return null;
    return { eventId, inviteId };
  }

  if (UUID_RE.test(value)) {
    return { eventId: null, inviteId: value };
  }

  try {
    const url = new URL(value);
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    const queryIndex = hash.indexOf("?");
    if (queryIndex >= 0) {
      const params = new URLSearchParams(hash.slice(queryIndex + 1));
      const inviteId = params.get("invite");
      if (inviteId) {
        return { eventId: params.get("event") || null, inviteId: inviteId.trim() };
      }
    }
    const inviteParam = url.searchParams.get("invite");
    if (inviteParam) {
      return { eventId: url.searchParams.get("event"), inviteId: inviteParam.trim() };
    }
  } catch {
    // bukan URL — abaikan
  }

  return null;
}
