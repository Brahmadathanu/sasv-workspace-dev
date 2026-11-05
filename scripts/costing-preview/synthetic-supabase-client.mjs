// Standalone ESM served INSTEAD of public/shared/js/supabaseClient.js only by the
// local loopback preview server. Not imported into the production application.
// ALL data is FICTIONAL ("SYNTHETIC"); ids sit far outside real id ranges (>= 900000).
// DENY BY DEFAULT: only the explicit READ fixtures below can succeed. Any other
// RPC / table / storage / auth operation is refused and recorded; nothing is faked as success.
// No network client is ever created.
// TEST AID: ?synthetic_priv=edit-claimed makes the FAKE permission fixture claim can_edit=true so the
// real page code exposes edit controls. Writes must STILL be denied: denial never depends on permissions.
const CLAIM_EDIT = (() => { try { return new URLSearchParams(location.search).get("synthetic_priv") === "edit-claimed"; } catch { return false; } })();
const TARGETS = Object.freeze([
  "module:costing-control-center", "module:material-cost-manager",
  "module:cost-build-manager", "module:pricing-policy-manager",
  "module:cost-sheet-review", "module:production-route-manager",
]);
const USER = Object.freeze({ id: "00000000-0000-4000-8000-000000000000", email: "synthetic-preview@example.invalid" });
const SESSION = Object.freeze({ access_token: "SYNTHETIC-NOT-A-CREDENTIAL", user: USER });
const LABEL = "SYNTHETIC";

// Fictional SKU status cases. These are display fixtures only, never official costing values.
const sku = (sku_id, product_id, name, pack_size, pack_uom, status, severity, material) => Object.freeze({
  sku_id, product_id, product_name: LABEL + " " + name, pack_size, pack_uom,
  period_start: "2026-11-01", refresh_run_id: 900002, valuation_date: "2026-11-02",
  first_control_status: status, control_severity: severity, material_costing_status: material,
  synthetic: true,
});
const TEST_SKUS = Object.freeze([
  sku(900001, 9001, "Sample Oil", 200, "mL", "READY", "INFO", "READY"),
  sku(900002, 9002, "Sample Powder", 100, "g", "REVIEW_REQUIRED", "REVIEW", "READY"),
  sku(900003, 9003, "Sample Tablet", 60, "nos", "BLOCKED", "BLOCKER", "BLOCKED"),
]);
// Two fictional run states: an approved October run and a FAILED November draft.
const RUN_ROWS = Object.freeze([
  Object.freeze({
    period_start: "2026-10-01", display_state: "APPROVED", display_label: LABEL + " Approved run 900001",
    display_label_v2: LABEL + " Approved run 900001", pricing_use_label: LABEL + " fixture - not an official run",
    displayed_run_id: 900001, approved_run_id: 900001, approved_at: "2026-10-31T10:00:00Z", approved_by: "synthetic-preview",
    newer_draft_run_id: null, active_run_id: null, active_run_status: null,
    official_valuation_date: "2026-10-31", latest_draft_valuation_date: null, latest_draft_run_id: null,
    approved_run_valuation_date: "2026-10-31", newer_draft_count: 0, superseded_run_count: 0,
  }),
  Object.freeze({
    period_start: "2026-11-01", display_state: "NO_SUCCESSFUL_RUN", display_label: LABEL + " Run 900002 FAILED - not approved",
    display_label_v2: LABEL + " Run 900002 FAILED - not approved", pricing_use_label: LABEL + " fixture - not an official run",
    displayed_run_id: null, approved_run_id: null, approved_at: null, approved_by: null,
    newer_draft_run_id: null, active_run_id: 900002, active_run_status: "FAILED",
    official_valuation_date: null, latest_draft_valuation_date: "2026-11-02", latest_draft_run_id: 900002,
    approved_run_valuation_date: null, newer_draft_count: 0, superseded_run_count: 0,
  }),
]);

const dashboard = (period_start, run, status, ready, review, blocked) => Object.freeze({
  period_start, refresh_run_id: run, valuation_date: period_start === "2026-10-01" ? "2026-10-31" : "2026-11-02",
  overall_control_status: status, overall_control_note: LABEL + " fixture - fictional counts, not official costing",
  ready_sku_count: ready, review_required_sku_count: review, blocked_sku_count: blocked, total_sku_count: ready + review + blocked,
  generated_at: period_start + "T00:00:00Z", snapshot_refreshed_at: period_start + "T00:00:00Z",
  material_cost_blocked_sku_count: blocked, material_review_required_sku_count: review,
  rm_blocker_item_count: blocked, rm_review_item_count: review, pm_blocker_item_count: 0, pm_review_item_count: 0,
  top_rm_blocker_stock_item_name: blocked ? LABEL + " Sample Herb Extract" : null,
  top_rm_review_stock_item_name: review ? LABEL + " Sample Excipient" : null,
});
const DASHBOARD_ROWS = Object.freeze([
  dashboard("2026-11-01", 900002, "BLOCKED", 1, 1, 1),
  dashboard("2026-10-01", 900001, "READY", 3, 0, 0),
]);
const KPI_ROWS = Object.freeze([
  Object.freeze({ period_start: "2026-11-01", costing_ready_sku_count: 1, costing_review_sku_count: 1, costing_blocked_sku_count: 1,
    latest_refresh_status: "FAILED", latest_refresh_scope: LABEL + " fixture", latest_refresh_finished_at: "2026-11-02T00:00:00Z",
    total_pricing_sku_count: 3, workbench_blocked_item_count: 1, workbench_review_item_count: 1, workbench_issue_line_count: 2 }),
  Object.freeze({ period_start: "2026-10-01", costing_ready_sku_count: 3, costing_review_sku_count: 0, costing_blocked_sku_count: 0,
    latest_refresh_status: "SUCCEEDED", latest_refresh_scope: LABEL + " fixture", latest_refresh_finished_at: "2026-10-31T00:00:00Z",
    total_pricing_sku_count: 3, workbench_blocked_item_count: 0, workbench_review_item_count: 0, workbench_issue_line_count: 0 }),
]);
const SCHEME_OPTIONS = Object.freeze([
  Object.freeze({ scheme_id: 900001, scheme_name: LABEL + " Buy 10 Get 1", paid_qty: 10, free_qty: 1, is_active: true, remarks: LABEL + " fixture" }),
]);
const SCOPE_OPTIONS = Object.freeze(TEST_SKUS.map((row) => Object.freeze({
  policy_scope: "SKU", scope_id: row.sku_id, scope_key: "SKU:" + row.sku_id, scope_name: row.product_name,
  display_name: row.product_name + " " + row.pack_size + row.pack_uom, sku_id: row.sku_id, product_id: row.product_id,
  product_name: row.product_name, category_name: LABEL + " Category", group_name: LABEL + " Group",
})));
// Explicit per-read fixtures. A table name is matched EXACTLY (optionally schema-qualified).
const TABLE_FIXTURES = Object.freeze({
  sku_costing_control_status_snapshot: TEST_SKUS,
  v_costing_pricing_period_run_status: RUN_ROWS,
  v_costing_pricing_control_dashboard_snapshot: DASHBOARD_ROWS,
  v_costing_pricing_business_kpi_summary: KPI_ROWS,
  v_costing_policy_manager_scheme_options: SCHEME_OPTIONS,
  v_costing_scheme_policy_scope_options: SCOPE_OPTIONS,
  v_costing_pricing_run_display_status: RUN_ROWS,
  v_costing_pricing_sku_selector: TEST_SKUS,
  // Named, deliberately EMPTY option lists / queues: each is an explicit "no synthetic rows" state,
  // not a claim that the real object is empty or that it exists with this shape.
  v_costing_expense_allocation_pool_options: Object.freeze([]),
  v_costing_staff_costing_class_options: Object.freeze([]),
  v_costing_manual_rate_manager_action_queue: Object.freeze([]),
  v_costing_unmapped_expense_heads_for_mapping: Object.freeze([]),
  v_costing_policy_manager_sku_overview: Object.freeze([]),
  v_costing_pricing_control_integrity_audit_snapshot: Object.freeze([]),
});
// Explicit read RPCs with fixtures. Anything else is UNSUPPORTED, never silent success.
const RPC_FIXTURES = Object.freeze({
  get_user_permissions: () => TARGETS.map((target) => ({ target, can_view: true, can_edit: CLAIM_EDIT })),
});

const KEY = "__costingSyntheticPreviewLog";
const MAX = 200;
const memory = [];
function persist(entry) {
  const record = { t: new Date().toISOString().slice(11, 19), ...entry };
  memory.push(record);
  if (memory.length > MAX) memory.shift();
  try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* storage may be unavailable */ }
}
try {
  const prior = JSON.parse(sessionStorage.getItem(KEY) || "[]");
  if (Array.isArray(prior)) memory.push(...prior.slice(-MAX));
} catch { /* ignore */ }

const LOG = { claimsEdit: CLAIM_EDIT, rpc: [], from: [], deniedWrites: [], unsupported: [], syntheticSkus: TEST_SKUS, syntheticRuns: RUN_ROWS };
try {
  Object.defineProperty(window, "__costingSyntheticPreview", { value: LOG, configurable: false, writable: false });
} catch { /* browser may already have fixture diagnostics */ }
const result = (data = []) => ({ data, error: null, count: Array.isArray(data) ? data.length : null });
const failure = (code, message) => ({ data: null, error: { code, message } });
// Mutations are denied regardless of any permission the page believes it holds.
const deny = (operation) => {
  LOG.deniedWrites.push(operation);
  persist({ kind: "DENIED", op: operation });
  return Promise.resolve(failure("SYNTHETIC_PREVIEW_WRITE_DENIED", "Mock preview is read-only; no backend exists."));
};
const unsupported = (operation) => {
  LOG.unsupported.push(operation);
  persist({ kind: "UNSUPPORTED", op: operation });
  return Promise.resolve(failure("SYNTHETIC_PREVIEW_UNSUPPORTED_OFFLINE",
    "This operation has no synthetic fixture; the module cannot populate offline."));
};
// Read-shaped names are never "denied writes": without a fixture they are UNSUPPORTED offline.
const READ_SHAPED = /^(rpc_)?(get|list|preview|validate|explain|export)_/i;
const MUTATING_NAME = /(^|_)(create|update|upsert|delete|submit|approve|accept|close|supersede|clone|set|apply|archive|retire|import|map|unmap|inactivate|reactivate|deactivate|cancel|correct|request|refresh|recalc|recalculation|finali[sz]e|lock|decide|generate|adjust|run|start|trigger|save|register|insert|remove|reject|reopen|release|publish|post)(_|$)/i;
function query(table) {
  const conditions = [];
  let single = false;
  let maximum = null;
  let fromIndex = 0;
  const key = table.replace(/^[a-z_]+\./i, "");
  const known = Object.hasOwn(TABLE_FIXTURES, key);
  if (known) persist({ kind: "READ", op: "from." + key });
  const data = () => {
    if (!known) { LOG.unsupported.push("from." + key); persist({ kind: "UNSUPPORTED", op: "from." + key }); return failure("SYNTHETIC_PREVIEW_UNSUPPORTED_OFFLINE", "No synthetic fixture for this table; the module cannot populate offline."); }
    let rows = [...TABLE_FIXTURES[key]];
    for (const [column, value] of conditions) rows = rows.filter((row) => String(row[column]) === String(value));
    if (fromIndex) rows = rows.slice(fromIndex);
    if (maximum !== null) rows = rows.slice(0, maximum);
    return result(single ? rows[0] ?? null : rows);
  };
  const promise = () => Promise.resolve(data());
  const obj = {
    select: () => obj, eq: (column, value) => { conditions.push([column, value]); return obj; },
    in: (column, values) => { conditions.push([column, (values ?? [])[0]]); return obj; },
    gte: () => obj, lte: () => obj, gt: () => obj, lt: () => obj, neq: () => obj, is: () => obj, not: () => obj,
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
      const rpcName = String(name);
      LOG.rpc.push({ name: rpcName, args: args ? JSON.parse(JSON.stringify(args)) : {} });
      if (!Object.hasOwn(RPC_FIXTURES, rpcName) && !READ_SHAPED.test(rpcName) && MUTATING_NAME.test(rpcName)) return deny("rpc." + rpcName);
      if (Object.hasOwn(RPC_FIXTURES, rpcName)) {
        persist({ kind: "READ", op: "rpc." + rpcName });
        return Promise.resolve(result(RPC_FIXTURES[rpcName](args)));
      }
      return unsupported("rpc." + rpcName);
    },
    from: (table) => { LOG.from.push(String(table)); return query(String(table)); },
    schema: () => client,
    channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
    removeChannel: async () => "ok",
    storage: { from: () => ({ upload: () => deny("storage.upload"), remove: () => deny("storage.remove"), download: () => unsupported("storage.download") }) },
  };
  return client;
}
export const supabase = createMockClient();
export const labSupabase = supabase.schema("lab");
export const hrSupabase = supabase.schema("hr");
export const handleSupabaseError = (error) => error;
