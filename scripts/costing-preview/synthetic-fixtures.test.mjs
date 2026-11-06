// Contract invariants for every synthetic fixture. Fails (never skips) when a fixture invents a column, leaks a
// non-synthetic id, or serves a view that no repository contract (types or migration SQL) describes.
import test from "node:test";
import assert from "node:assert/strict";
import { TABLE_FIXTURES, SKUS, PRODUCTS } from "./synthetic-fixtures.mjs";
import * as F from "./synthetic-fixtures.mjs";
import { viewColumns, migrationViewColumns, rpcSignature, clientSelectColumns } from "./contracts-from-types.mjs";
import { COVERAGE } from "./coverage-manifest.mjs";

const fromList = (list) => (list ? Object.fromEntries(list.map((c) => [c, "client-select"])) : null);
// Evidence order: generated types -> migration SQL column list -> the client's own explicit select literal.
const CLIENT_EVIDENCE = {
  v_costing_pricing_period_run_status: () => [...new Set([...clientSelectColumns("costing-approval-screen.js", "period_start,period_status"), ...clientSelectColumns("costing-run-status-badge.js", "period_start,display_state,display_label,display_label_v2")])],
  v_costing_pricing_run_display_status: () => clientSelectColumns("costing-approval-screen.js", "refresh_run_id,period_start"),
};
const contractFor = (name) => viewColumns(name) ?? fromList(migrationViewColumns(name)) ?? fromList(CLIENT_EVIDENCE[name]?.());

test("every served view has a repository contract and fixtures use only contract columns", () => {
  const problems = [];
  for (const [view, rows] of Object.entries(TABLE_FIXTURES)) {
    const contract = contractFor(view);
    if (!contract) { problems.push(view + ": no contract in types/supabase.ts or migrations"); continue; }
    assert.ok(rows.length > 0, view + " must carry at least one row (no silent empty fixtures)");
    for (const row of rows) for (const key of Object.keys(row)) {
      if (key === "synthetic") continue; // marker added by this preview, stripped by no real consumer
      if (!(key in contract)) problems.push(view + "." + key + " is not in the contract");
    }
  }
  assert.deepEqual(problems, []);
});

test("typed RPC fixtures match the generated Returns shape", () => {
  const valuation = F.VALUATION_CONTEXT("2026-11-01")[0];
  const sig = rpcSignature("rpc_get_cost_period_valuation_context");
  for (const key of Object.keys(valuation)) assert.match(sig.returns, new RegExp("\\b" + key + "\\b"), "valuation." + key);
  const sales = rpcSignature("rpc_get_sales_allocation_default_policies");
  for (const key of Object.keys(F.SALES_ALLOCATION_POLICIES[0])) assert.match(sales.returns, new RegExp("\\b" + key + "\\b"), "sales." + key);
});

test("all ids are far outside real ranges and every human label is SYNTHETIC", () => {
  const walk = (value, path, out) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, path + "[" + i + "]", out));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, path + "." + k, out);
    else out.push([path, value]);
  };
  const leaves = [];
  for (const [name, value] of Object.entries(F)) if (/^[A-Z_]+$/.test(name) && typeof value !== "function") walk(value, name, leaves);
  const lowIds = leaves.filter(([p, v]) => /(_id|\.id)$/.test(p) && typeof v === "number" && v < 900000);
  assert.deepEqual(lowIds, [], "ids below 900000");
  const labels = leaves.filter(([p, v]) => /(product_name|staff_display_name|scheme_name|head_name|stock_item_name|route_family_name|cost_centre_name|sku_display_name)$/.test(p) && typeof v === "string" && v && !v.includes("SYNTHETIC"));
  assert.deepEqual(labels, [], "unlabelled names");
  const emails = leaves.filter(([, v]) => typeof v === "string" && /@/.test(v) && !/@example\.invalid$/.test(v));
  assert.deepEqual(emails, []);
});

test("scenario set covers READY, REVIEW_REQUIRED and BLOCKED outcomes plus an approved and a FAILED run", () => {
  assert.deepEqual(SKUS.map((s) => s.outcome), ["READY", "REVIEW_REQUIRED", "BLOCKED"]);
  assert.equal(PRODUCTS.length, 3);
  assert.deepEqual(F.RUN_ROWS.map((r) => r.display_state), ["APPROVED", "DRAFT"]);
  assert.ok(F.RUN_DISPLAY_ROWS.some(r => r.refresh_run_id === 900005 && r.overall_status === "FAILED"), "failed November attempt remains visible but not selected");
  assert.ok(F.COMPARISON_ROWS.some((r) => r.manufacturing_cop === null), "blocked SKU must not receive a cost");
});

test("coverage manifest declares exactly the real lens/workspace inventory and never over-claims", () => {
  const per = {};
  for (const c of COVERAGE) per[c.module] = (per[c.module] ?? 0) + 1;
  assert.deepEqual(per, { "costing-control-center": 4, "material-cost-manager": 3, "cost-build-manager": 4, "pricing-policy-manager": 10, "cost-sheet-review": 6, "production-route-manager": 13 });
  assert.equal(COVERAGE.length, 40);
  for (const c of COVERAGE) {
    assert.equal(c.realData, "NOT TESTED (real auth)", c.id);
    if (c.status === "POPULATED") assert.ok(c.minRows >= 1 && c.deps.length >= 1, c.id);
    else assert.ok(c.blocker || c.status === "RESTRICTED", c.id + " non-populated lens must state its blocker");
  }
});


test("same-period SKU loaded cost and selling price agree across selector, detailed and comparison views", () => {
  const bySku = (rows) => new Map(rows.map(r => [r.sku_id, r]));
  const selector = bySku(F.SKU_SELECTOR_ROWS);
  const details = bySku(F.DETAILED_COST_SHEET_ROWS);
  const comparison = bySku(F.COMPARISON_ROWS);
  for (const sku of SKUS) {
    const a = selector.get(sku.sku_id), b = details.get(sku.sku_id), c = comparison.get(sku.sku_id);
    assert.ok(a && b && c, "missing synthetic SKU " + sku.sku_id);
    assert.equal(a.period_start, b.period_start);
    assert.equal(b.period_start, c.snapshot_period_start);
    assert.equal(a.internal_loaded_cost_per_sku, b.internal_loaded_cost_per_sku, "selector/detail " + sku.sku_id);
    assert.equal(b.internal_loaded_cost_per_sku, c.internal_loaded_cost, "detail/comparison " + sku.sku_id);
    assert.equal(a.ik_selling_price, b.ik_selling_price, "IK selling price " + sku.sku_id);
    assert.equal(a.ok_selling_price, b.ok_selling_price, "OK selling price " + sku.sku_id);
    assert.equal(a.ik_selling_price, c.selling_price_ik, "comparison IK " + sku.sku_id);
    assert.equal(a.ok_selling_price, c.selling_price_ok, "comparison OK " + sku.sku_id);
  }
});

test("scheme margin bands never claim HEALTHY when net realisation or computed margin is absent", () => {
  for (const row of F.SCHEME_COMPARISON_ROWS) {
    for (const region of ["ik", "ok"]) {
      if (row[region + "_net_sales_realisation"] == null ||
          row[region + "_margin_percent_after_scheme"] == null) {
        assert.ok(!["HEALTHY", "PROFITABLE", "PASS"].includes(row[region + "_scheme_margin_band"]),
          "unsupported " + region.toUpperCase() + " viability claim for SKU " + row.sku_id);
      }
    }
  }
});
