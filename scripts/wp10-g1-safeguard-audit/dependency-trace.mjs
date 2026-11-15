// WP10 G1 dependency trace: source table -> epoch hook (from the LIVE catalog) -> freshness -> readiness/portfolio -> visible status/remediation.
// The epoch column is DERIVED from the committed catalog, never typed. Consumer/owner columns come from WP-01/WP-04 contracts (cited).
// Usage: node scripts/wp10-g1-safeguard-audit/dependency-trace.mjs [outCsv]
import fs from "node:fs";
import { catalog, toCsvRow } from "./lib.mjs";

const epochTables = new Set(catalog.readiness_epoch_triggers.map((t) => `${t.schema_name}.${t.relname}`));
epochTables.add("public.product_skus");

// [dependency, grain, source tables (as far as repo/catalog prove), guard essential?, time-effective?, owner / remediation route (WP-01), basis of the table list]
const ROWS = [
  ["PM_BOM_REVISION", "SKU x as-of", ["public.plm_bom_revision"], true, true, "PM BOM Manager", "repo: plm_sku_bom_revision_as_of (gate A migration)"],
  ["BATCH_SIZE_REFERENCE", "Product x as-of", ["public.production_batch_size_ref"], true, true, "Supply Batch Plan > Batch Sizes", "live helper text"],
  ["MANUFACTURING_ROUTE", "Product x as-of", ["costing.production_route_family_route", "costing.product_process_route", "costing.production_route_family_product_map", "costing.production_route_family_product_group_map", "costing.production_route_family_product_subgroup_map"], true, true, "Production Route Manager", "repo route-family migrations (route resolvers differ by later migration)"],
  ["MRP_POLICY", "SKU x valuation date", ["costing.sku_mrp_policy"], true, true, "Pricing Policy Manager > MRP", "table name from the hooked set; resolver definition NOT in repo/catalog"],
  ["SELLING_PRICE_POLICY (incl. GST)", "SKU x valuation date", ["costing.sku_selling_price_policy"], true, true, "Pricing Policy Manager > Selling & scheme policies", "table name from the hooked set; resolver definition NOT in repo/catalog"],
  ["SELECTED_SCHEME_POLICY", "SKU x region x date", ["costing.sku_scheme_policy", "costing.sku_selected_scheme_policy_context_snapshot"], false, true, "Pricing Policy Manager > Selling & scheme policies", "WP-01 mapping"],
  ["COMMON/REGIONAL COMMERCIAL SALES BASIS", "SKU x period", ["costing.sku_commercial_sales_assumption", "costing.sales_allocation_default_policy", "costing.sku_sales_allocation_basis_snapshot", "costing.sku_regional_marketing_allocation_basis_snapshot"], false, true, "Pricing Policy Manager > Commercial Sales Assumptions", "WP-01 mapping"],
  ["DIRECT_LABOUR / PRODUCTION_OVERHEAD / QC / MATERIALS_STORES workload policy + allocation", "global policy + SKU evidence", ["costing.direct_labour_workload_policy", "costing.production_overhead_workload_policy", "costing.qc_workload_policy", "costing.materials_stores_workload_policy", "costing.sku_direct_labour_allocation_snapshot", "costing.sku_production_overhead_allocation_snapshot", "costing.sku_qc_allocation_snapshot", "costing.sku_materials_stores_allocation_snapshot"], false, true, "Driver Governance + Production Route Manager / Cost Sheet Review queues", "WP-01 mapping"],
  ["ADMIN / FINANCE OVERHEAD envelope", "global envelope + SKU", ["costing.cost_driver_policy_envelope", "costing.cost_driver_policy_cutover_acceptance", "costing.cost_element_driver_catalog", "costing.sku_admin_finance_overhead_allocation_snapshot"], false, true, "Driver Governance", "WP-01 mapping"],
  ["MARKETING_EXPENSE", "global policy + SKU/region", ["costing.marketing_allocation_policy", "costing.sku_marketing_expense_allocation_snapshot"], false, true, "Driver Governance / Pricing Policy Manager", "WP-01 mapping"],
  ["MATERIAL RATE / EVIDENCE (indirect via refresh run + control snapshot)", "material lines x context", ["costing.costing_refresh_run", "costing.costing_refresh_run_stage", "costing.sku_costing_control_status_snapshot"], false, false, "Material Cost Manager", "WP-01 mapping; DIRECT rate/valuation source tables are NOT in the hooked set"],
  ["PRODUCT lifecycle + master (status, subgroup, base UOM)", "Product", ["public.products", "public.product_groups", "public.sub_groups", "public.categories", "public.sub_categories"], false, false, "Manage Products", "WP-01 / WP-02"],
  ["SKU lifecycle + master (active, pack, UOM, sample, product_id)", "SKU", ["public.product_skus"], false, false, "Manage Products", "catalog trigger"],
  ["COST PERIOD / valuation date", "period", ["costing.cost_periods"], false, false, "Costing Control Center", "catalog trigger"],
  ["PM BOM revision LINES", "SKU revision line", ["public.plm_bom_revision_line"], false, false, "PM BOM Manager", "gate A migration: approved revisions/lines are immutable (header/line immutability triggers)"],
  ["Inventory classification maps / stock-item master (BOM materials)", "stock item", ["public.inv_stock_item_class_map", "public.inv_stock_item"], false, false, "Master Data pages", "NOT PROVEN to be read by any readiness resolver"],
];

export const CSV_COLS = ["dependency", "grain", "source_tables", "epoch_hooked_tables", "epoch_UNHOOKED_tables", "in_activation_guard_five", "effective_dated", "owner_remediation_route", "table_list_basis"];
export function traceRows() {
  return ROWS.map(([dependency, grain, tables, essential, dated, owner, basis]) => ({
    dependency, grain, source_tables: tables.join("|"),
    epoch_hooked_tables: tables.filter((t) => epochTables.has(t)).join("|") || "(none)",
    epoch_UNHOOKED_tables: tables.filter((t) => !epochTables.has(t)).join("|") || "(none)",
    in_activation_guard_five: essential ? "yes" : "no", effective_dated: dated ? "yes (expires without a row write)" : "no",
    owner_remediation_route: owner, table_list_basis: basis,
  }));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = traceRows();
  const csv = [CSV_COLS.join(","), ...rows.map((r) => CSV_COLS.map((c) => toCsvRow(r[c])).join(","))].join("\n") + "\n";
  if (process.argv[2]) fs.writeFileSync(process.argv[2], csv);
  console.log(`dependency rows=${rows.length}; hooked-complete=${rows.filter((r) => r.epoch_UNHOOKED_tables === "(none)").length}`);
}
