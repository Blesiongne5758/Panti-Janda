// Minimal in-memory stand-in for the supabase-js query builder used by the
// handler. Supports the chain shapes the handler relies on: select/insert/
// update/delete with eq/neq/in/order/limit/range/maybeSingle/single.

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
      return this;
    }
    insert(payload) {
      this.op = "insert";
      this.payload = payload;
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
      if (this.op === "update") {
        let updated = 0;
        for (const row of rows) {
          if (this.filters.every((f) => f(row))) {
            Object.assign(row, this.payload);
            updated += 1;
          }
        }
        return { data: null, error: null, updated };
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
    __tables: store,
  };
}
