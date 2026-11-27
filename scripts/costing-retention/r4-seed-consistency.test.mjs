import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const seedSql = read("docs/master-data-costing/retention/candidates/R4_PROPOSED_ALLOWLIST_SEED.sql");
const idxSql = read("docs/master-data-costing/retention/candidates/R4_INDEX_CANDIDATES.sql");

const rows = [...seedSql.matchAll(/^\('(\w+)','(\w+)','(\w+)','(\w+)','((?:[^']|'')*)',(true|false)\)/gm)]
  .map((m) => ({ schema: m[1], table: m[2], runCol: m[3], cls: m[4], note: m[5], confirmLive: m[6] === "true" }));
const byName = new Map(rows.map((r) => [r.table, r]));
const PURGE = (t) => byName.get(t)?.cls === "SNAPSHOT_PURGEABLE";

// nested snapshot->snapshot FKs evidenced in supabase/migrations (child.column -> parent, leading index present in repo?)
const EDGES = [
  ["direct_labour_component_pool_snapshot", "direct_labour_pool_snapshot_id", "cost_pool_monthly_snapshot", false],
  ["product_direct_labour_workload_snapshot", "manufacturing_labour_component_pool_snapshot_id", "direct_labour_component_pool_snapshot", false],
  ["sku_packing_labour_workload_snapshot", "packing_labour_component_pool_snapshot_id", "direct_labour_component_pool_snapshot", false],
  ["sku_packing_labour_workload_snapshot", "allocation_basis_snapshot_id", "sku_sales_allocation_basis_snapshot", false],
  ["product_direct_labour_step_snapshot", "product_workload_snapshot_id", "product_direct_labour_workload_snapshot", false],
  ["product_production_overhead_step_snapshot", "product_workload_snapshot_id", "product_production_overhead_workload_snapshot", false],
  ["sku_production_overhead_allocation_snapshot", "product_workload_snapshot_id", "product_production_overhead_workload_snapshot", false],
  ["product_qc_allocation_snapshot", "product_workload_snapshot_id", "product_qc_workload_snapshot", false],
  ["product_qc_allocation_snapshot", "quality_control_pool_snapshot_id", "cost_pool_monthly_snapshot", false],
  ["product_qc_method_workload_snapshot", "product_workload_snapshot_id", "product_qc_workload_snapshot", false],
  ["sku_qc_allocation_snapshot", "product_qc_allocation_snapshot_id", "product_qc_allocation_snapshot", false],
  ["sku_qc_allocation_snapshot", "sales_allocation_basis_snapshot_id", "sku_sales_allocation_basis_snapshot", false],
  ["sku_materials_stores_allocation_snapshot", "pool_snapshot_id", "cost_pool_monthly_snapshot", false],
  ["sku_materials_stores_allocation_snapshot", "workload_snapshot_id", "sku_materials_stores_workload_snapshot", false],
  ["sku_materials_stores_workload_snapshot", "product_rm_workload_snapshot_id", "product_rm_stores_workload_snapshot", false],
  ["sku_materials_stores_workload_snapshot", "sku_pm_workload_snapshot_id", "sku_pm_stores_workload_snapshot", false],
  ["sku_overhead_allocation_snapshot", "production_pool_snapshot_id", "cost_pool_monthly_snapshot", false],
  ["sku_direct_labour_allocation_snapshot", "packing_labour_workload_snapshot_id", "sku_packing_labour_workload_snapshot", false],
  ["sku_pricing_bridge_profit_snapshot", "pricing_bridge_snapshot_id", "sku_pricing_bridge_snapshot", false],
  ["sku_regional_marketing_expense_allocation_snapshot", "regional_basis_snapshot_id", "sku_regional_marketing_allocation_basis_snapshot", false],
  ["sku_regional_marketing_expense_allocation_snapshot", "common_allocation_basis_snapshot_id", "sku_sales_allocation_basis_snapshot", false],
  ["sku_overhead_allocation_snapshot", "materials_stores_allocation_snapshot_id", "sku_materials_stores_allocation_snapshot", true],
  ["sku_overhead_allocation_snapshot", "production_overhead_allocation_snapshot_id", "sku_production_overhead_allocation_snapshot", true],
  ["sku_overhead_allocation_snapshot", "quality_control_allocation_snapshot_id", "sku_qc_allocation_snapshot", true],
  ["sku_production_overhead_allocation_snapshot", "pool_snapshot_id", "cost_pool_monthly_snapshot", true],
  ["product_production_overhead_workload_snapshot", "pool_snapshot_id", "cost_pool_monthly_snapshot", true],
];
// acceptance -> snapshot FKs: removed by R2C before any purge
const R2C_EDGES = [["regional_marketing_evidence_acceptance", "sku_regional_marketing_expense_allocation_snapshot"], ["regional_marketing_evidence_acceptance", "sku_regional_marketing_allocation_basis_snapshot"], ["sales_allocation_quantity_driver_acceptance", "sku_sales_allocation_basis_snapshot"]];

test("seed is well formed: no duplicates, valid classes, reasons present, live-unverified rows flagged", () => {
  assert.ok(rows.length >= 45, `rows ${rows.length}`);
  assert.equal(new Set(rows.map((r) => `${r.schema}.${r.table}`)).size, rows.length, "no duplicate relation");
  for (const r of rows) {
    assert.ok(["SNAPSHOT_PURGEABLE", "PERMANENT", "SUMMARY_KEEP"].includes(r.cls), r.table);
    assert.ok(r.note.length > 20, `${r.table} has a stated reason (not naming-only)`);
    assert.ok(/^[a-z_]*refresh_run_id$|^consumed_by_run_id$/.test(r.runCol), r.table);
  }
  assert.ok(rows.filter((r) => r.confirmLive).length >= 15, "live-unverified rows are explicitly flagged");
});
test("governance, approval, acceptance, fingerprint and audit relations are never purgeable; run headers are not listed", () => {
  for (const t of ["costing_run_designation", "costing_run_fingerprint", "costing_period_refresh_authorization", "cost_driver_policy_cutover_acceptance", "manufacturing_cost_behaviour_split",
    "regional_marketing_evidence_acceptance", "sales_allocation_quantity_driver_acceptance", "material_review_acceptance_register", "governance_evidence_event", "costing_run_retention_ledger", "purge_step_receipt"]) {
    assert.equal(byName.get(t)?.cls, "PERMANENT", t);
  }
  assert.equal(byName.get("default_volume_cap_log")?.cls, "SUMMARY_KEEP");
  assert.equal(byName.has("costing_refresh_run"), false);
});
test("scheme viability is classified by its real role (not a redundant cache) and carries the selected-scheme dependency in its reason", () => {
  const r = byName.get("sku_scheme_viability_snapshot");
  assert.equal(r.cls, "SNAPSHOT_PURGEABLE");
  assert.match(r.note, /NOT a redundant cache/);
  assert.match(r.note, /selected-scheme/);
});
test("nested-FK topology from the repository is consistent with the seed: both ends of every edge are purgeable; nothing permanent is a child of a purgeable parent", () => {
  for (const [child, col, parent] of EDGES) {
    assert.ok(PURGE(child), `${child} (child of ${parent}.${col}) must be SNAPSHOT_PURGEABLE in the seed`);
    assert.ok(PURGE(parent), `${parent} must be SNAPSHOT_PURGEABLE in the seed`);
  }
  for (const [child, parent] of R2C_EDGES) {
    assert.equal(byName.get(child).cls, "PERMANENT");
    assert.ok(PURGE(parent));
  }
  for (const r of rows.filter((x) => x.cls !== "SNAPSHOT_PURGEABLE")) {
    assert.equal(EDGES.some(([c]) => c === r.table), false, `${r.table} is not purgeable but is a child in a snapshot edge`);
  }
});
test("index candidates are exactly the repository-evidenced unindexed child columns of purgeable parents (complete, no extras, concurrent, never CASCADE)", () => {
  const stmts = [...idxSql.matchAll(/^CREATE INDEX CONCURRENTLY IF NOT EXISTS (\w+) ON costing\.(\w+) \((\w+)\);$/gm)].map((m) => ({ name: m[1], table: m[2], col: m[3] }));
  const want = EDGES.filter((e) => !e[3]).map(([c, col]) => `${c}.${col}`).sort();
  assert.deepEqual(stmts.map((s) => `${s.table}.${s.col}`).sort(), want);
  assert.equal(new Set(stmts.map((s) => s.name)).size, stmts.length, "unique index names");
  for (const s of stmts) assert.ok(s.name.length <= 63);
  assert.equal(/\bCASCADE\b|DROP |TRUNCATE|DELETE /i.test(idxSql.replace(/^--.*$/gm, "")), false);
  assert.equal(/BEGIN;|COMMIT;/.test(idxSql.replace(/^--.*$/gm, "")), false, "CONCURRENTLY cannot run in a transaction block");
});
test("seed refuses to apply without a named reviewer and writes only the allowlist", () => {
  assert.match(seedSql, /seed_reviewed_by/);
  assert.match(seedSql, /R4 seed refused/);
  const body = seedSql.replace(/^--.*$/gm, "").replace(/ON COMMIT DROP/g, "");
  assert.equal(/\b(DELETE|TRUNCATE|DROP|CASCADE|UPDATE)\b/.test(body), false);
  assert.equal([...body.matchAll(/INSERT INTO ([\w.]+)/g)].map((m) => m[1]).filter((t) => t !== "_seed").join(","), "costing_retention.purge_allowlist");
});
