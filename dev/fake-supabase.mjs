// Minimal in-memory stand-in for the supabase-js query builder used by the
// handler. Supports select/insert/upsert/update/delete with common filters,
// ordering, limits and single-row result modifiers.

const likeToRegExp = (pattern) => {
  const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/%/g, ".*").replace(/_/g, ".")}$`);
};

export function createFakeSupabase({ tables = {}, failAll = false } = {}) {
  const store = new Map(Object.entries(tables));
  const unique = new Map([
    ["accounts", ["email"]],
    ["sessions", ["token_hash"]],
    ["donations", ["order_id"]],
  ]);

  const rowsOf = (table) => {
    if (!store.has(table)) store.set(table, []);
    return store.get(table);
  };

  class Builder {
    constructor(table, op) {
      this.table = table;
      this.op = op;
      this.filters = [];
      this.orderBy = null;
      this.max = null;
      this.rangeSpec = null;
      this.mode = "many";
    }
    select() {
      if (this.op === "update") this.returning = true;
      return this;
    }
    insert(payload) {
      this.op = "insert";
      this.payload = payload;
      return this;
    }
    upsert(payload, options = {}) {
      this.op = "upsert";
      this.payload = payload;
      this.conflictColumns = typeof options.onConflict === "string"
        ? options.onConflict.split(",").map((column) => column.trim()).filter(Boolean)
        : [];
      return this;
    }
    update(patch) {
      this.op = "update";
      this.payload = patch;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(column, value) {
      this.filters.push((row) => String(row[column]) === String(value));
      return this;
    }
    neq(column, value) {
      this.filters.push((row) => String(row[column]) !== String(value));
      return this;
    }
    in(column, values) {
      const set = new Set((values ?? []).map(String));
      this.filters.push((row) => set.has(String(row[column])));
      return this;
    }
    like(column, pattern) {
      const regex = likeToRegExp(pattern);
      this.filters.push((row) => row[column] !== null && row[column] !== undefined && regex.test(String(row[column])));
      return this;
    }
    or(expression) {
      if (!expression) return this;
      this.filters.push((row) => {
        const parts = expression.includes("),and(")
          ? expression.split("),and(").map((p) => p.replace(/^and\(|\)$/g, ""))
          : expression.split(",");
        return parts.some((part) => {
          const subConditions = part.split(",");
          return subConditions.every((cond) => {
            const m = cond.trim().match(/^([a-zA-Z0-9_]+)\.([a-z]+)\.(.*)$/);
            if (!m) return true;
            const [, col, op, val] = m;
            if (op === "eq") return String(row[col]) === String(val);
            if (op === "neq") return String(row[col]) !== String(val);
            return true;
          });
        });
      });
      return this;
    }
    order(column, options = {}) {
      this.orderBy = { column, ascending: options.ascending !== false };
      return this;
    }
    limit(count) {
      this.max = count;
      return this;
    }
    range(from, to) {
      this.rangeSpec = { from, to };
      return this;
    }
    maybeSingle() {
      this.mode = "maybeSingle";
      return this;
    }
    single() {
      this.mode = "single";
      return this;
    }
    match() {
      return this;
    }
    filter(column, operator, value) {
      if (operator === "eq") return this.eq(column, value);
      if (operator === "neq") return this.neq(column, value);
      if (operator === "like") return this.like(column, value);
      return this;
    }
    then(resolve) {
      resolve(this.run());
      return undefined;
    }
    run() {
      if (failAll) return { data: null, error: { message: "fixture failure", code: "500" } };
      const rows = rowsOf(this.table);
      if (this.op === "insert") {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        for (const row of list) {
          for (const column of unique.get(this.table) ?? []) {
            if (rows.some((r) => String(r[column]) === String(row[column]))) {
              return { data: null, error: { message: "duplicate key", code: "23505" } };
            }
          }
        }
        for (const row of list) rows.push({ ...row });
        return { data: list.map((r) => ({ ...r })), error: null };
      }
      if (this.op === "upsert") {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const conflictColumns = this.conflictColumns?.length
          ? this.conflictColumns
          : unique.get(this.table) ?? ["id"];
        const upserted = list.map((row) => {
          const existing = rows.find((candidate) =>
            conflictColumns.every((column) => candidate[column] === row[column]),
          );
          if (existing) {
            Object.assign(existing, row);
            return { ...existing };
          }
          const inserted = {
            id: row.id ?? crypto.randomUUID(),
            created_at: row.created_at ?? new Date().toISOString(),
            ...row,
          };
          rows.push(inserted);
          return { ...inserted };
        });
        if (this.mode === "single") {
          if (upserted.length !== 1) {
            return { data: null, error: { message: "expected one row", code: "PGRST116" } };
          }
          return { data: upserted[0], error: null };
        }
        return { data: upserted, error: null };
      }
      if (this.op === "update") {
        const updatedRows = [];
        for (const row of rows) {
          if (this.filters.every((f) => f(row))) {
            Object.assign(row, this.payload);
            updatedRows.push({ ...row });
          }
        }
        if (!this.returning) return { data: null, error: null, updated: updatedRows.length };
        if (this.mode === "single") {
          if (updatedRows.length !== 1) {
            return { data: null, error: { message: "expected one row", code: "PGRST116" } };
          }
          return { data: updatedRows[0], error: null };
        }
        if (this.mode === "maybeSingle") {
          if (updatedRows.length > 1) {
            return { data: null, error: { message: "multiple rows", code: "PGRST116" } };
          }
          return { data: updatedRows[0] ?? null, error: null };
        }
        return { data: updatedRows, error: null };
      }
      if (this.op === "delete") {
        const keep = rows.filter((row) => !this.filters.every((f) => f(row)));
        rows.splice(0, rows.length, ...keep);
        return { data: null, error: null };
      }
      let result = rows.filter((row) => this.filters.every((f) => f(row)));
      if (this.orderBy) {
        const { column, ascending } = this.orderBy;
        result = [...result].sort((a, b) => {
          const av = a[column];
          const bv = b[column];
          if (av === bv) return 0;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          const cmp = av > bv ? 1 : -1;
          return ascending ? cmp : -cmp;
        });
      }
      if (this.rangeSpec) result = result.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
      if (this.max !== null) result = result.slice(0, this.max);
      if (this.mode === "maybeSingle") {
        if (result.length > 1) return { data: null, error: { message: "multiple rows", code: "PGRST116" } };
        return { data: result[0] ? { ...result[0] } : null, error: null };
      }
      if (this.mode === "single") {
        if (result.length !== 1) return { data: null, error: { message: "expected one row", code: "PGRST116" } };
        return { data: { ...result[0] }, error: null };
      }
      return { data: result.map((r) => ({ ...r })), error: null };
    }
  }

  return {
    from(table) {
      return new Builder(table, "select");
    },
    async rpc(name, args = {}) {
      if (failAll) return { data: null, error: { message: "fixture failure", code: "500" } };
      const rpcError = (error) => ({ data: { error }, error: null });
      const rpcOk = (data) => ({ data, error: null });
      const actor = () => {
        const session = rowsOf("sessions").find((row) => row.id === args.p_session_id);
        const account = session && rowsOf("accounts").find((row) => row.id === session.account_id);
        if (!session || Date.parse(session.expires_at) <= Date.now() || account?.status !== "active") return null;
        return account;
      };
      const isParticipant = (call, accountId) =>
        Boolean(call && (call.caller_account_id === accountId || call.recipient_account_id === accountId));
      const validDescription = (description, type) =>
        Boolean(description && typeof description === "object" && !Array.isArray(description) &&
          description.type === type && typeof description.sdp === "string" && description.sdp.trim());

      if (name === "call_signal_poll") {
        const user = actor();
        if (!user) return rpcError("not_authenticated");
        if (args.p_call_id) {
          const call = rowsOf("call_signals").find((row) => row.id === args.p_call_id);
          if (!isParticipant(call, user.id)) return rpcOk({ call: null });
          const now = Date.now();
          const currentNegotiation = rowsOf("call_signal_negotiations").find(
            (row) => row.call_id === call.id && row.revision === call.current_revision,
          );
          if (currentNegotiation?.status === "pending" && now - Date.parse(currentNegotiation.created_at) > 60_000) {
            currentNegotiation.status = "rejected";
            currentNegotiation.updated_at = new Date().toISOString();
          }
          const renegotiation = currentNegotiation ? {
            revision: currentNegotiation.revision,
            mode: currentNegotiation.mode,
            offererAccountId: currentNegotiation.offerer_account_id,
            offer: currentNegotiation.offer,
            answer: currentNegotiation.answer,
            status: currentNegotiation.status,
          } : null;
          const negotiationCandidates = rowsOf("call_signal_candidates")
            .filter((row) => row.call_id === call.id && row.sender_account_id !== user.id)
            .sort((a, b) => a.id - b.id)
            .slice(-512)
            .map((row) => ({ id: row.id, revision: row.revision, candidate: row.candidate }));
          const remoteCandidates = call.caller_account_id === user.id
            ? call.recipient_candidates
            : call.caller_candidates;
          return rpcOk({ call: {
            id: call.id,
            mode: call.mode,
            callerAccountId: call.caller_account_id,
            recipientAccountId: call.recipient_account_id,
            status: call.status,
            offer: call.offer,
            answer: call.answer,
            remoteCandidates,
            duration: call.duration,
            currentRevision: call.current_revision,
            renegotiation,
            negotiationCandidates,
          } });
        }

        const calls = rowsOf("call_signals");
        const incoming = calls
          .filter((row) => row.recipient_account_id === user.id && row.status === "ringing")
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
        if (incoming && Date.now() - Date.parse(incoming.created_at) <= 45_000) {
          const caller = rowsOf("accounts").find((row) => row.id === incoming.caller_account_id);
          const profile = rowsOf("profiles").find((row) => row.account_id === incoming.caller_account_id);
          return rpcOk({ incomingCall: {
            callId: incoming.id,
            id: incoming.id,
            mode: incoming.mode,
            callerAccountId: incoming.caller_account_id,
            callerName: profile?.nickname ?? caller?.display_name ?? "Pengguna",
            callerPhoto: profile?.photo_data ?? null,
            offer: incoming.offer,
            createdAt: Date.parse(incoming.created_at),
          } });
        }
        if (incoming) incoming.status = "missed";
        return rpcOk({ incomingCall: null });
      }

      if (name === "call_signal_start") {
        const user = actor();
        if (!user) return rpcError("not_authenticated");
        const recipient = rowsOf("accounts").find((row) => row.id === args.p_recipient_account_id && row.status === "active");
        if (!recipient) return rpcError("not_found");
        if (user.id === recipient.id || !["audio", "video"].includes(args.p_mode) || !validDescription(args.p_offer, "offer")) {
          return rpcError("invalid_input");
        }
        const createdAt = new Date().toISOString();
        const call = {
          id: crypto.randomUUID(),
          caller_account_id: user.id,
          recipient_account_id: recipient.id,
          mode: args.p_mode,
          status: "ringing",
          offer: args.p_offer,
          answer: null,
          caller_candidates: [],
          recipient_candidates: [],
          duration: 0,
          current_revision: 0,
          created_at: createdAt,
          updated_at: createdAt,
        };
        rowsOf("call_signals").push(call);
        return rpcOk({ call: {
          id: call.id,
          mode: call.mode,
          callerAccountId: call.caller_account_id,
          recipientAccountId: call.recipient_account_id,
          status: call.status,
          createdAt: Date.parse(createdAt),
        } });
      }

      if (name === "call_signal_answer") {
        const user = actor();
        if (!user) return rpcError("not_authenticated");
        const call = rowsOf("call_signals").find((row) => row.id === args.p_call_id);
        if (!call || call.recipient_account_id !== user.id || call.status !== "ringing" || !validDescription(args.p_answer, "answer")) {
          return rpcError("not_found");
        }
        call.status = "active";
        call.answer = args.p_answer;
        call.updated_at = new Date().toISOString();
        return rpcOk({ ok: true });
      }

      if (name === "call_signal_renegotiate_offer") {
        const user = actor();
        if (!user) return rpcError("not_authenticated");
        const call = rowsOf("call_signals").find((row) => row.id === args.p_call_id);
        if (!isParticipant(call, user.id)) return rpcError("not_found");
        if (call.status !== "active") return rpcError("call_not_active");
        if (!Number.isSafeInteger(args.p_expected_revision) || args.p_expected_revision < 0 ||
            !["audio", "video"].includes(args.p_mode) || !validDescription(args.p_offer, "offer")) {
          return rpcError("invalid_input");
        }
        const nextRevision = args.p_expected_revision + 1;
        const existing = rowsOf("call_signal_negotiations").find((row) =>
          row.call_id === call.id && row.revision === nextRevision && row.offerer_account_id === user.id &&
          row.mode === args.p_mode && JSON.stringify(row.offer) === JSON.stringify(args.p_offer),
        );
        if (existing) return rpcOk({ ok: true, revision: existing.revision, status: existing.status });
        const pending = rowsOf("call_signal_negotiations").some(
          (row) => row.call_id === call.id && row.revision === call.current_revision && row.status === "pending",
        );
        if (call.current_revision !== args.p_expected_revision || pending) return rpcError("offer_conflict");
        const createdAt = new Date().toISOString();
        const negotiation = {
          call_id: call.id,
          revision: nextRevision,
          offerer_account_id: user.id,
          mode: args.p_mode,
          offer: args.p_offer,
          answer: null,
          status: "pending",
          created_at: createdAt,
          updated_at: createdAt,
        };
        rowsOf("call_signal_negotiations").push(negotiation);
        call.current_revision = nextRevision;
        call.updated_at = createdAt;
        return rpcOk({ ok: true, revision: nextRevision });
      }

      if (name === "call_signal_renegotiate_answer" || name === "call_signal_renegotiate_reject") {
        const user = actor();
        if (!user) return rpcError("not_authenticated");
        const call = rowsOf("call_signals").find((row) => row.id === args.p_call_id);
        if (!isParticipant(call, user.id)) return rpcError("not_found");
        if (call.status !== "active") return rpcError("call_not_active");
        if (call.current_revision !== args.p_revision) return rpcError("stale_revision");
        const negotiation = rowsOf("call_signal_negotiations").find(
          (row) => row.call_id === call.id && row.revision === args.p_revision,
        );
        if (!negotiation) return rpcError("negotiation_not_found");
        if (negotiation.offerer_account_id === user.id) return rpcError("forbidden");
        if (name === "call_signal_renegotiate_answer") {
          if (!validDescription(args.p_answer, "answer")) return rpcError("invalid_input");
          if (negotiation.status === "accepted" && JSON.stringify(negotiation.answer) === JSON.stringify(args.p_answer)) {
            return rpcOk({ ok: true, revision: negotiation.revision, mode: negotiation.mode });
          }
          if (negotiation.status !== "pending") return rpcError("negotiation_not_found");
          negotiation.answer = args.p_answer;
          negotiation.status = "accepted";
          negotiation.updated_at = new Date().toISOString();
          call.mode = negotiation.mode;
          call.updated_at = negotiation.updated_at;
          return rpcOk({ ok: true, revision: negotiation.revision, mode: negotiation.mode });
        }
        if (negotiation.status === "rejected") return rpcOk({ ok: true, revision: negotiation.revision });
        if (negotiation.status !== "pending") return rpcError("negotiation_not_found");
        negotiation.status = "rejected";
        negotiation.updated_at = new Date().toISOString();
        return rpcOk({ ok: true, revision: negotiation.revision });
      }

      if (name === "call_signal_candidate" || name === "call_signal_candidate_v2") {
        const user = actor();
        if (!user) return rpcError("not_authenticated");
        const call = rowsOf("call_signals").find((row) => row.id === args.p_call_id);
        if (!isParticipant(call, user.id)) return rpcError("not_found");
        if (!["ringing", "active"].includes(call.status)) return rpcError("call_not_active");
        if (!args.p_candidate || typeof args.p_candidate !== "object" || Array.isArray(args.p_candidate)) {
          return rpcError("invalid_input");
        }
        if (name === "call_signal_candidate") {
          const list = call.caller_account_id === user.id ? call.caller_candidates : call.recipient_candidates;
          if (list.length < 256) list.push(args.p_candidate);
          call.updated_at = new Date().toISOString();
          return rpcOk({ ok: true });
        }
        const revision = args.p_revision;
        if (!Number.isSafeInteger(revision) || revision < 0) return rpcError("invalid_input");
        if (revision > 0 && !rowsOf("call_signal_negotiations").some(
          (row) => row.call_id === call.id && row.revision === revision,
        )) return rpcError("stale_revision");
        const candidates = rowsOf("call_signal_candidates");
        if (candidates.some((row) => row.call_id === call.id && row.revision === revision &&
          row.sender_account_id === user.id && JSON.stringify(row.candidate) === JSON.stringify(args.p_candidate))) {
          return rpcOk({ ok: true });
        }
        if (candidates.filter((row) => row.call_id === call.id && row.sender_account_id === user.id).length >= 256) {
          return rpcError("candidate_limit");
        }
        const nextId = candidates.reduce((maximum, row) => Math.max(maximum, row.id), 0) + 1;
        candidates.push({
          id: nextId,
          call_id: call.id,
          revision,
          sender_account_id: user.id,
          candidate: args.p_candidate,
          created_at: new Date().toISOString(),
        });
        call.updated_at = new Date().toISOString();
        return rpcOk({ ok: true });
      }

      if (name === "call_signal_end") {
        const user = actor();
        if (!user) return rpcError("not_authenticated");
        const call = rowsOf("call_signals").find((row) => row.id === args.p_call_id);
        if (!isParticipant(call, user.id)) return rpcOk({ ok: true });
        const transitioned = ["ringing", "active"].includes(call.status);
        if (!transitioned) return rpcOk({ ok: true, transitioned: false });
        call.status = args.p_reason === "rejected" ? "rejected" : args.p_reason === "missed" ? "missed" : "ended";
        call.duration = Math.min(Math.max(Number(args.p_duration) || 0, 0), 86400);
        call.updated_at = new Date().toISOString();
        return rpcOk({ ok: true, transitioned: true, call: {
          callerAccountId: call.caller_account_id,
          recipientAccountId: call.recipient_account_id,
          mode: call.mode,
          status: call.status,
          duration: call.duration,
        } });
      }

      return {
        data: null,
        error: { message: `RPC ${name} is not implemented in the fixture`, code: "PGRST202" },
      };
    },
    __tables: store,
  };
}
