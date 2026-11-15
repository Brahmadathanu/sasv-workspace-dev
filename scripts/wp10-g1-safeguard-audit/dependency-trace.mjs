// WP10 G1 dependency trace: source table -> epoch hook (from the LIVE catalog) -> freshness fingerprint -> readiness/portfolio -> visible status/remediation.
// Reconciled with the independent live catalog: the table lists for the MRP, selling-price and route-family resolvers are DERIVED from their live
// definitions; hook coverage and fingerprint definition coverage are DERIVED from the live catalog, never typed. Owner/route columns come from WP-01.
// Usage: node scripts/wp10-g1-safeguard-audit/dependency-trace.mjs [outCsv]
import fs from "node:fs";
import { catalog, liveFn2, toCsvRow } from "./lib.mjs";

const resolverTables = (name) => [...new Set([...liveFn2("costing", name).matchAll(/(?:from|join)\s+((?:costing|public)\.[a-z_]+)/gi)].map((m) => m[1].toLowerCase()))];
// canonical function definitions hashed into the live fingerprint (a DDL change to any of them invalidates the build)
const fpText = liveFn2("costing", "fn_wp04_readiness_source_fingerprint");
const fpFns = new Set([...fpText.matchAll(/'((?:costing|public)\.[a-z_0-9]+)\(/g)].map((m) => m[1]));
const epochTables = new Set(catalog.readiness_epoch_triggers.map((t) => `${t.schema_name}.${t.relname}`));

// [dependency, grain, tables (array | {resolver: fn}), guard essential?, effective-dated?, definition hashed by fingerprint (fn name or ""), owner/route, evidence basis]
const ROWS = [
  ["PM_BOM_REVISION", "SKU x as-of", ["public.plm_bom_revision"], true, true, "public.plm_sku_bom_revision_as_of", "PM BOM Manager", "REPO: gate A migration (live definition hashed by the fingerprint)"],
  ["BATCH_SIZE_REFERENCE", "Product x as-of", ["public.production_batch_size_ref"], true, true, "", "Supply Batch Plan > Batch Sizes", "LIVE helper text: an INLINE predicate, no resolver function exists"],
  ["MANUFACTURING_ROUTE", "Product x as-of", { resolver: "fn_resolve_route_family_for_product", extra: ["costing.production_route_family_route", "costing.product_process_route", "costing.production_route_family_route_step"] }, true, true, "costing.fn_product_process_route_readiness", "Production Route Manager", "LIVE route-family resolver text; the validation chain (4 callee functions) is NOT captured, so its table closure is NOT PROVEN"],
  ["MRP_POLICY", "SKU x valuation date", { resolver: "fn_resolve_sku_mrp_as_of" }, true, true, "costing.fn_resolve_sku_mrp_as_of", "Pricing Policy Manager > MRP", "LIVE resolver text (status APPROVED, effective window)"],
  ["SELLING_PRICE_POLICY (incl. GST)", "SKU x valuation date", { resolver: "fn_resolve_sku_selling_price_policy_as_of" }, true, true, "costing.fn_resolve_sku_selling_price_policy_as_of", "Pricing Policy Manager > Selling & scheme policies", "LIVE resolver text (is_active, effective window)"],
  ["SELECTED_SCHEME_POLICY", "SKU x region x date", ["costing.sku_scheme_policy", "costing.sku_selected_scheme_policy_context_snapshot"], false, true, "", "Pricing Policy Manager > Selling & scheme policies", "WP-01 mapping"],
  ["COMMON/REGIONAL COMMERCIAL SALES BASIS", "SKU x period", ["costing.sku_commercial_sales_assumption", "costing.sales_allocation_default_policy", "costing.sku_sales_allocation_basis_snapshot", "costing.sku_regional_marketing_allocation_basis_snapshot"], false, true, "costing.fn_resolve_sku_commercial_sales_basis_point", "Pricing Policy Manager > Commercial Sales Assumptions", "WP-01 mapping; point resolver hashed by the fingerprint"],
  ["DIRECT_LABOUR / PRODUCTION_OVERHEAD / QC / MATERIALS_STORES workload policy + allocation", "global policy + SKU evidence", ["costing.direct_labour_workload_policy", "costing.production_overhead_workload_policy", "costing.qc_workload_policy", "costing.materials_stores_workload_policy", "costing.sku_direct_labour_allocation_snapshot", "costing.sku_production_overhead_allocation_snapshot", "costing.sku_qc_allocation_snapshot", "costing.sku_materials_stores_allocation_snapshot"], false, true, "costing.fn_wp04_c_live_core", "Driver Governance + Production Route Manager / Cost Sheet Review queues", "WP-01 mapping"],
  ["ADMIN / FINANCE OVERHEAD envelope", "global envelope + SKU", ["costing.cost_driver_policy_envelope", "costing.cost_driver_policy_cutover_acceptance", "costing.cost_element_driver_catalog", "costing.sku_admin_finance_overhead_allocation_snapshot"], false, true, "", "Driver Governance", "WP-01 mapping"],
  ["MARKETING_EXPENSE", "global policy + SKU/region", ["costing.marketing_allocation_policy", "costing.sku_marketing_expense_allocation_snapshot"], false, true, "", "Driver Governance / Pricing Policy Manager", "WP-01 mapping"],
  ["MATERIAL RATE / EVIDENCE (indirect via refresh run + control snapshot)", "material lines x context", ["costing.costing_refresh_run", "costing.costing_refresh_run_stage", "costing.sku_costing_control_status_snapshot"], false, false, "", "Material Cost Manager", "WP-01 mapping; DIRECT rate/valuation tables are not in the hooked set (reached via refresh runs and snapshots)"],
  ["PRODUCT lifecycle + master (status, subgroup, base UOM)", "Product", ["public.products", "public.product_groups", "public.sub_groups", "public.categories", "public.sub_categories"], false, false, "", "Manage Products", "LIVE: products BEFORE UPDATE OF status guard + epoch hooks"],
  ["SKU lifecycle + master (active, pack, UOM, sample, product_id)", "SKU", ["public.product_skus"], false, false, "", "Manage Products", "LIVE catalog triggers"],
  ["COST PERIOD / valuation date", "period", ["costing.cost_periods"], false, false, "", "Costing Control Center", "LIVE fingerprint reads the governed valuation date"],
  ["PM BOM revision LINES", "SKU revision line", ["public.plm_bom_revision_line"], false, false, "", "PM BOM Manager", "gate A migration: approved revisions/lines are immutable"],
  ["Inventory classification maps / stock-item master (BOM materials)", "stock item", ["public.inv_stock_item_class_map", "public.inv_stock_item"], false, false, "", "Master Data pages", "NOT PROVEN to be read by any captured readiness resolver"],
];

export const CSV_COLS = ["dependency", "grain", "source_tables", "epoch_hooked_tables", "epoch_UNHOOKED_tables", "in_activation_guard_five", "effective_dated", "fingerprint_hashes_definition", "owner_remediation_route", "evidence_basis"];
export function traceRows() {
  return ROWS.map(([dependency, grain, spec, essential, dated, fnName, owner, basis]) => {
    const tables = Array.isArray(spec) ? spec : [...new Set([...resolverTables(spec.resolver), ...(spec.extra || [])])];
    return {
      dependency, grain, source_tables: tables.join("|"),
      epoch_hooked_tables: tables.filter((t) => epochTables.has(t)).join("|") || "(none)",
      epoch_UNHOOKED_tables: tables.filter((t) => !epochTables.has(t)).join("|") || "(none)",
      in_activation_guard_five: essential ? "yes" : "no",
      effective_dated: dated ? "yes (can lapse with no row write)" : "no",
      fingerprint_hashes_definition: fnName ? (fpFns.has(fnName) ? `yes (${fnName})` : `no (${fnName} not in the live fingerprint list)`) : "n/a",
      owner_remediation_route: owner, evidence_basis: basis,
    };
  });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = traceRows();
  const csv = [CSV_COLS.join(","), ...rows.map((r) => CSV_COLS.map((c) => toCsvRow(r[c])).join(","))].join("\n") + "\n";
  if (process.argv[2]) fs.writeFileSync(process.argv[2], csv);
  console.log(`dependency rows=${rows.length}; hooked-complete=${rows.filter((r) => r.epoch_UNHOOKED_tables === "(none)").length}; fingerprint function list=${fpFns.size}`);
}
