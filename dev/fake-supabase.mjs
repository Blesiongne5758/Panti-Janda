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
      // The local fixture intentionally stores no WebRTC calls. Match the
      // production RPC's empty-state response so background polling succeeds.
      if (name === "call_signal_poll") {
        return {
          data: args.p_call_id ? { call: null } : { incomingCall: null },
          error: null,
        };
      }
      return {
        data: null,
        error: { message: `RPC ${name} is not implemented in the fixture`, code: "PGRST202" },
      };
    },
    __tables: store,
  };
}
