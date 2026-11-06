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
import * as F from "/shared/js/synthetic-fixtures.mjs";
const TEST_SKUS = F.SKU_STATUS_ROWS;
const RUN_ROWS = F.RUN_ROWS;
// Explicit per-read fixtures. A table name is matched EXACTLY (optionally schema-qualified).
// Contract evidence for every column is asserted in scripts/costing-preview/synthetic-fixtures.test.mjs.
const TABLE_FIXTURES = Object.freeze({
  sku_costing_control_status_snapshot: F.SKU_STATUS_ROWS,
  v_costing_pricing_sku_control_status_snapshot: F.SKU_STATUS_ROWS,
  v_costing_pricing_period_run_status: F.RUN_ROWS,
  v_costing_pricing_run_display_status: F.RUN_ROWS,
  v_costing_pricing_control_dashboard_snapshot: F.DASHBOARD_ROWS,
  v_costing_pricing_business_kpi_summary: F.KPI_ROWS,
  v_costing_pricing_control_integrity_audit_snapshot: F.INTEGRITY_ROWS,
  v_costing_pricing_material_action_queue_snapshot: F.MATERIAL_ACTION_ROWS,
  v_costing_material_review_acceptance_register: F.ACCEPTANCE_ROWS,
  v_costing_manual_rate_manager_action_queue: F.MANUAL_RATE_QUEUE_ROWS,
  v_costing_pricing_sku_selector: F.SKU_SELECTOR_ROWS,
  v_costing_pricing_sku_detailed_cost_sheet: F.DETAILED_COST_SHEET_ROWS,
  v_costing_pricing_printable_cost_sheet_product_summary: F.PRINTABLE_SUMMARY_ROWS,
  v_cost_sheet_snapshot_sku_monthly_comparison_governed: F.COMPARISON_ROWS,
  v_costing_pricing_sku_scheme_comparison: F.SCHEME_COMPARISON_ROWS,
  v_sku_mrp_current: F.SKU_MRP_CURRENT_ROWS,
  v_costing_policy_manager_sku_overview: F.SKU_OVERVIEW_ROWS,
  v_product_mrp_derivation_current: F.DERIVATION_CURRENT_ROWS,
  v_product_mrp_reference_readiness: F.REFERENCE_READINESS_ROWS,
  v_product_mrp_proposal_register: F.PROPOSAL_REGISTER_ROWS,
  v_costing_scheme_master_register: F.SCHEME_MASTER_ROWS,
  v_costing_scheme_policy_rule_register: F.SCHEME_RULE_ROWS,
  v_costing_pricing_commercial_sales_basis: F.COMMERCIAL_BASIS_ROWS,
  v_costing_unclassified_staff_for_costing: F.UNCLASSIFIED_STAFF_ROWS,
  v_costing_manual_provision_pool_options: F.PROVISION_POOL_OPTIONS,
  v_costing_manual_provision_type_options: F.PROVISION_TYPE_OPTIONS,
  v_costing_policy_manager_scheme_options: F.SCHEME_MASTER_ROWS.filter((r) => r.is_active).map(({ scheme_id, scheme_name, paid_qty, free_qty, is_active, remarks }) => ({ scheme_id, scheme_name, paid_qty, free_qty, is_active, remarks })),
  v_costing_scheme_policy_scope_options: F.SKU_STATUS_ROWS.map((r) => ({ policy_scope: "SKU", scope_id: r.sku_id, scope_key: "SKU:" + r.sku_id, scope_name: r.product_name,
    display_name: r.product_name + " " + r.pack_size + r.pack_uom, sku_id: r.sku_id, product_id: r.product_id, product_name: r.product_name })),
  // Named, deliberately EMPTY option lists: explicit "no synthetic rows", not a claim about the real object.
  v_costing_expense_allocation_pool_options: Object.freeze([]),
  v_costing_staff_costing_class_options: Object.freeze([]),
  v_costing_unmapped_expense_heads_for_mapping: Object.freeze([]),
});
// Explicit read RPCs with fixtures. Anything else is UNSUPPORTED, never silent success.
const RPC_FIXTURES = Object.freeze({
  get_user_permissions: () => TARGETS.map((target) => ({ target, can_view: true, can_edit: CLAIM_EDIT })),
  rpc_get_cost_period_valuation_context: (args) => F.VALUATION_CONTEXT(String(args?.p_period_start ?? "2026-11-01")),
  rpc_get_sales_allocation_default_policies: () => F.SALES_ALLOCATION_POLICIES,
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

const LOG = { selects: {}, claimsEdit: CLAIM_EDIT, rpc: [], from: [], deniedWrites: [], unsupported: [], syntheticSkus: TEST_SKUS, syntheticRuns: RUN_ROWS };
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
const MUTATING_NAME = /(^|_)(create|update|upsert|delete|submit|approve|accept|close|supersede|clone|set|apply|archive|retire|import|map|unmap|inactivate|reactivate|deactivate|cancel|correct|request|refresh|recalc|recalculation|finali[sz]e|lock|decide|generate|adjust|run|start|trigger|save|register|insert|remove|reject|reopen|release|publish|post|authori[sz]e)(_|$)/i;
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
    select: (columns) => { (LOG.selects[key] ??= new Set()).add(String(columns ?? "*")); return obj; }, eq: (column, value) => { conditions.push([column, value]); return obj; },
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
