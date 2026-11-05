// Standalone ESM served INSTEAD of public/shared/js/supabaseClient.js only by the
// local loopback preview server. Not imported into the production application.
// All data is synthetic; ALL writes are denied; no network client is created.
const TARGETS = Object.freeze([
  "module:costing-control-center", "module:material-cost-manager",
  "module:cost-build-manager", "module:pricing-policy-manager",
  "module:cost-sheet-review", "module:production-route-manager",
]);
const USER = Object.freeze({ id: "00000000-0000-4000-8000-000000000000", email: "synthetic-preview@example.invalid" });
const SESSION = Object.freeze({ access_token: "SYNTHETIC-NOT-A-CREDENTIAL", user: USER });

const TEST_SKUS = Object.freeze([
  Object.freeze({ sku_id: 900001, product_id: 9001, product_name: "SYNTHETIC Sample Oil", pack_size: 200, pack_uom: "mL", period_start: "2026-11-01", refresh_run_id: 90001, valuation_date: "2026-11-02", first_control_status: "READY", control_severity: "INFO", material_costing_status: "READY" }),
  Object.freeze({ sku_id: 900002, product_id: 9002, product_name: "SYNTHETIC Sample Powder", pack_size: 100, pack_uom: "g", period_start: "2026-11-01", refresh_run_id: 90001, valuation_date: "2026-11-02", first_control_status: "REVIEW_REQUIRED", control_severity: "REVIEW", material_costing_status: "READY" }),
]);
const LOG = { rpc: [], from: [], deniedWrites: [], syntheticSkus: TEST_SKUS };
try {
  Object.defineProperty(window, "__costingSyntheticPreview", { value: LOG, configurable: false, writable: false });
} catch { /* browser may already have fixture diagnostics */ }
const result = (data = []) => ({ data, error: null, count: Array.isArray(data) ? data.length : null });
const errorResult = () => ({ data: null, error: { code: "SYNTHETIC_PREVIEW_WRITE_DENIED", message: "Mock preview is read-only; no backend exists." } });
const deny = (operation) => { LOG.deniedWrites.push(operation); return Promise.resolve(errorResult()); };
const isWrite = (method) => /^(insert|update|upsert|delete)$/.test(method);
const isWriteRpc = (name) => /^rpc_(create|update|upsert|delete|submit|approve|accept|close|supersede|clone|set|apply|archive|retire|import|map|unmap|inactivate|cancel|correct|request|refresh|recalc|finali|lock|decide|generate|adjust|run|start|trigger)/i.test(String(name || ""));
function query(table) {
  const conditions = [];
  let single = false;
  let maximum = null;
  let fromIndex = 0;
  const data = () => {
    let rows = /sku_costing_control_status_snapshot|v_sku_control_status|sku_control_status/i.test(table) ? [...TEST_SKUS] : [];
    for (const [key, value] of conditions) rows = rows.filter((row) => String(row[key]) === String(value));
    if (fromIndex) rows = rows.slice(fromIndex);
    if (maximum !== null) rows = rows.slice(0, maximum);
    return result(single ? rows[0] ?? null : rows);
  };
  const promise = () => Promise.resolve(data());
  const obj = {
    select: () => obj, eq: (key, value) => { conditions.push([key, value]); return obj; },
    in: (key, values) => { conditions.push([key, (values ?? [])[0]]); return obj; },
    gte: () => obj, lte: () => obj, gt: () => obj, lt: () => obj, neq: () => obj,
    order: () => obj, limit: (num) => { maximum = Math.max(0, Number(num) || 0); return obj; },
    range: (from, to) => { fromIndex = Number(from) || 0; maximum = (Number(to) || fromIndex) - fromIndex + 1; return obj; },
    single: () => { single = true; return obj; }, maybeSingle: () => { single = true; return obj; },
    insert: () => deny(table + ".insert"), update: () => deny(table + ".update"),
    upsert: () => deny(table + ".upsert"), delete: () => deny(table + ".delete"),
    then: (ok, bad) => promise().then(ok, bad), catch: (bad) => promise().catch(bad),
  };
  return obj;
}
function createMockClient() {
  const client = {
    auth: {
      getSession: async () => result({ session: SESSION }),
      getUser: async () => result({ user: USER }),
      refreshSession: async () => result({ session: SESSION }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
      signInWithPassword: () => deny("auth.signInWithPassword"),
      updateUser: () => deny("auth.updateUser"),
    },
    rpc: (name, args) => {
      LOG.rpc.push({ name: String(name), args: args ? JSON.parse(JSON.stringify(args)) : {} });
      if (isWriteRpc(name)) return deny("rpc." + name);
      if (name === "get_user_permissions") return Promise.resolve(result(TARGETS.map(target => ({ target, can_view: true, can_edit: false }))));
      return Promise.resolve(result([]));
    },
    from: (table) => { LOG.from.push(String(table)); return query(String(table)); },
    schema: () => client,
    channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
    removeChannel: async () => "ok",
    storage: { from: () => ({ upload: () => deny("storage.upload"), remove: () => deny("storage.remove"), download: async () => errorResult() }) },
  };
  return client;
}
export const supabase = createMockClient();
export const labSupabase = supabase.schema("lab");
export const hrSupabase = supabase.schema("hr");
export const handleSupabaseError = (error) => error;
